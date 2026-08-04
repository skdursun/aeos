import type {
  AeosTask,
  TaskValidationIssue,
  TaskValidationResult,
} from "./tasks.js";
import {
  type TaskPlanInputFileFormat,
  type TaskPlanInputFileRequest,
  type TaskPlanInputIssue,
  type TaskPlanInputMappingHandoff,
  type TaskPlanInputParseResult,
  type TaskPlanInputPathCheck,
  type TaskPlanInputPathCheckStatus,
  type TaskPlanInputResult,
  type TaskPlanInputSummary,
  type TaskPlanInputValidationHandoff,
} from "./task-plan-input.js";
import { validateAeosTask } from "./task-validation.js";

export const DEFAULT_TASK_PLAN_INPUT_MAX_FILE_SIZE_BYTES = 64_000;

export interface TaskPlanInputJsonParseOptions {
  readonly requireJsonObject?: boolean;
  readonly sourceFile?: string;
}

type JsonRecord = Record<string, unknown>;

interface FileStat {
  readonly size: number;
  isDirectory(): boolean;
  isFile(): boolean;
}

interface FsPromisesModule {
  readFile(filePath: string, encoding: "utf8"): Promise<string>;
  realpath(filePath: string): Promise<string>;
  stat(filePath: string): Promise<FileStat>;
}

interface PathModule {
  extname(filePath: string): string;
  isAbsolute(filePath: string): boolean;
  relative(from: string, to: string): string;
  resolve(...paths: readonly string[]): string;
}

const importBuiltinModule = Function(
  "specifier",
  "return import(specifier)",
) as (specifier: "node:fs/promises" | "node:path") => Promise<unknown>;

let fsPromisesModulePromise: Promise<FsPromisesModule> | undefined;
let pathModulePromise: Promise<PathModule> | undefined;

function hasFunction(value: JsonRecord, key: string): boolean {
  return typeof value[key] === "function";
}

function isFsPromisesModule(value: unknown): value is FsPromisesModule {
  return (
    isRecord(value) &&
    hasFunction(value, "readFile") &&
    hasFunction(value, "realpath") &&
    hasFunction(value, "stat")
  );
}

function isPathModule(value: unknown): value is PathModule {
  return (
    isRecord(value) &&
    hasFunction(value, "extname") &&
    hasFunction(value, "isAbsolute") &&
    hasFunction(value, "relative") &&
    hasFunction(value, "resolve")
  );
}

async function loadFsPromisesModule(): Promise<FsPromisesModule> {
  if (fsPromisesModulePromise === undefined) {
    fsPromisesModulePromise = importBuiltinModule("node:fs/promises").then(
      (moduleValue) => {
        if (!isFsPromisesModule(moduleValue)) {
          throw new Error("node:fs/promises module shape is unsupported.");
        }

        return moduleValue;
      },
    );
  }

  return fsPromisesModulePromise;
}

async function loadPathModule(): Promise<PathModule> {
  if (pathModulePromise === undefined) {
    pathModulePromise = importBuiltinModule("node:path").then((moduleValue) => {
      if (!isPathModule(moduleValue)) {
        throw new Error("node:path module shape is unsupported.");
      }

      return moduleValue;
    });
  }

  return pathModulePromise;
}

function createIssue(
  code: string,
  message: string,
  phase: TaskPlanInputIssue["phase"],
  pathValue?: string,
  metadata?: Record<string, unknown>,
): TaskPlanInputIssue {
  return {
    code,
    message,
    severity: "error",
    phase,
    path: pathValue,
    metadata,
  };
}

function createValidationIssue(
  code: string,
  message: string,
  field?: string,
): TaskValidationIssue {
  return {
    code,
    message,
    severity: "error",
    field,
  };
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasString(value: JsonRecord, key: string): boolean {
  return typeof value[key] === "string";
}

function hasBoolean(value: JsonRecord, key: string): boolean {
  return typeof value[key] === "boolean";
}

function hasArray(value: JsonRecord, key: string): boolean {
  return Array.isArray(value[key]);
}

function hasRecord(value: JsonRecord, key: string): boolean {
  return isRecord(value[key]);
}

function hasTaskContractShape(value: unknown): value is AeosTask {
  if (!isRecord(value)) {
    return false;
  }

  if (
    !hasString(value, "id") ||
    !hasString(value, "title") ||
    !hasString(value, "purpose") ||
    !hasString(value, "status") ||
    !hasString(value, "executionMode")
  ) {
    return false;
  }

  const context = value.context;
  const fileBoundary = value.fileBoundary;
  const stopCondition = value.stopCondition;

  if (
    !isRecord(context) ||
    !isRecord(fileBoundary) ||
    !isRecord(stopCondition)
  ) {
    return false;
  }

  return (
    hasArray(context, "load") &&
    hasArray(context, "doNotLoad") &&
    hasArray(fileBoundary, "filesToModify") &&
    hasArray(fileBoundary, "filesNotToTouch") &&
    hasBoolean(fileBoundary, "allowGeneratedFiles") &&
    hasBoolean(fileBoundary, "requireStopOnBoundaryConflict") &&
    hasString(stopCondition, "description") &&
    hasBoolean(stopCondition, "stopAfterCompletion") &&
    hasArray(value, "allowedOperations") &&
    hasArray(value, "forbiddenOperations") &&
    hasArray(value, "steps") &&
    hasArray(value, "verification")
  );
}

function isLocalUrlLike(inputPath: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(inputPath);
}

function containsParentTraversal(inputPath: string): boolean {
  return inputPath
    .split(/[\\/]+/)
    .filter((segment) => segment.length > 0)
    .includes("..");
}

function isPathInside(
  pathModule: PathModule,
  basePath: string,
  candidatePath: string,
): boolean {
  const relative = pathModule.relative(basePath, candidatePath);

  return (
    relative.length > 0 &&
    !relative.startsWith("..") &&
    !pathModule.isAbsolute(relative)
  );
}

function extensionToFormat(
  pathModule: PathModule,
  inputPath: string,
): TaskPlanInputFileFormat {
  return pathModule.extname(inputPath).toLowerCase() === ".json"
    ? "json"
    : "unsupported";
}

function utf8ByteLength(text: string): number {
  let byteLength = 0;

  for (let index = 0; index < text.length; index += 1) {
    const codePoint = text.codePointAt(index) ?? 0;

    if (codePoint > 0xffff) {
      index += 1;
    }

    if (codePoint <= 0x7f) {
      byteLength += 1;
    } else if (codePoint <= 0x7ff) {
      byteLength += 2;
    } else if (codePoint <= 0xffff) {
      byteLength += 3;
    } else {
      byteLength += 4;
    }
  }

  return byteLength;
}

function emptyParseResult(
  format: TaskPlanInputFileFormat = "unknown",
): TaskPlanInputParseResult {
  return {
    ok: false,
    format,
    issues: [],
  };
}

function notRequestedValidationHandoff(): TaskPlanInputValidationHandoff {
  return {
    requested: false,
    status: "not_requested",
    issues: [],
  };
}

function notRequestedMappingHandoff(): TaskPlanInputMappingHandoff {
  return {
    requested: false,
    status: "not_requested",
    runnerPlanningExecuted: false,
    issues: [],
  };
}

function mapValidationIssue(
  issue: TaskValidationIssue,
  sourceFile?: string,
): TaskPlanInputIssue {
  return {
    code: issue.code,
    message: issue.message,
    severity: issue.severity,
    phase: "validation",
    path: issue.path ?? sourceFile,
    field: issue.field,
    sourceIssue: issue,
  };
}

function buildResult<TParsed>(
  request: TaskPlanInputFileRequest,
  sourceFile: string | undefined,
  pathCheck: TaskPlanInputPathCheck,
  parse: TaskPlanInputParseResult<TParsed>,
  validation: TaskPlanInputValidationHandoff,
  mapping: TaskPlanInputMappingHandoff,
): TaskPlanInputResult<TParsed> {
  const issues = [
    ...pathCheck.issues,
    ...parse.issues,
    ...validation.issues.map((issue) => mapValidationIssue(issue, sourceFile)),
    ...mapping.issues,
  ];
  const summary = summarizeTaskPlanInputResultParts({
    sourceFile,
    pathCheck,
    parse,
    validation,
    mapping,
    issueCount: issues.length,
  });

  return {
    ok:
      summary.pathOk &&
      summary.parseOk &&
      (!summary.validationRequested || summary.validationOk) &&
      (!summary.mappingRequested || summary.mappingOk),
    mode: request.mode,
    sourceFile,
    pathCheck,
    parse,
    validation,
    mapping,
    issues,
    summary,
  };
}

function summarizeTaskPlanInputResultParts(parts: {
  readonly sourceFile?: string;
  readonly pathCheck: TaskPlanInputPathCheck;
  readonly parse: TaskPlanInputParseResult;
  readonly validation: TaskPlanInputValidationHandoff;
  readonly mapping: TaskPlanInputMappingHandoff;
  readonly issueCount: number;
}): TaskPlanInputSummary {
  return {
    hasSourceFile: parts.sourceFile !== undefined && parts.sourceFile.length > 0,
    pathOk: parts.pathCheck.status === "ok",
    parseOk: parts.parse.ok,
    validationRequested: parts.validation.requested,
    validationOk:
      parts.validation.requested && parts.validation.status === "pass",
    mappingRequested: parts.mapping.requested,
    mappingOk: parts.mapping.requested && parts.mapping.status === "ready",
    issueCount: parts.issueCount,
    noExecution: true,
    noWrites: true,
    runnerPlanningExecuted: false,
    taskPersistenceWritten: false,
    trustsModelSelfReporting: false,
  };
}

export async function checkTaskPlanInputPath(
  request: TaskPlanInputFileRequest,
): Promise<TaskPlanInputPathCheck> {
  const pathModule = await loadPathModule();
  const fsPromises = await loadFsPromisesModule();
  const inputPath = request.inputPath;
  const resolvedPath = pathModule.resolve(
    request.currentWorkingDirectory,
    inputPath,
  );
  const relativePath = pathModule.relative(
    request.currentWorkingDirectory,
    resolvedPath,
  );

  if (inputPath.trim().length === 0) {
    const issue = createIssue(
      "task_plan_input_path_required",
      "Task plan input path is required.",
      "request",
      inputPath,
    );

    return {
      originalPath: inputPath,
      resolvedPath,
      relativePath,
      status: "unsafe_path",
      issues: [issue],
    };
  }

  if (isLocalUrlLike(inputPath)) {
    const issue = createIssue(
      "task_plan_input_remote_path_unsupported",
      "Task plan input path must be a local file path.",
      "path",
      inputPath,
    );

    return {
      originalPath: inputPath,
      resolvedPath,
      relativePath,
      status: "unsupported",
      issues: [issue],
    };
  }

  if (pathModule.isAbsolute(inputPath) && !request.options.allowAbsolutePath) {
    const issue = createIssue(
      "task_plan_input_absolute_path_disallowed",
      "Absolute task plan input paths are not allowed.",
      "safety",
      inputPath,
    );

    return {
      originalPath: inputPath,
      resolvedPath,
      relativePath,
      status: "unsafe_path",
      issues: [issue],
    };
  }

  if (
    containsParentTraversal(inputPath) &&
    !request.options.allowParentTraversal
  ) {
    const issue = createIssue(
      "task_plan_input_parent_traversal_disallowed",
      "Parent traversal is not allowed in task plan input paths.",
      "safety",
      inputPath,
    );

    return {
      originalPath: inputPath,
      resolvedPath,
      relativePath,
      status: "unsafe_path",
      issues: [issue],
    };
  }

  let workingDirectoryRealPath: string;
  let taskFileRealPath: string;

  try {
    workingDirectoryRealPath = await fsPromises.realpath(
      request.currentWorkingDirectory,
    );
  } catch {
    const issue = createIssue(
      "task_plan_input_working_directory_unavailable",
      "Current working directory could not be resolved.",
      "path",
      request.currentWorkingDirectory,
    );

    return {
      originalPath: inputPath,
      resolvedPath,
      relativePath,
      status: "unknown",
      issues: [issue],
    };
  }

  try {
    taskFileRealPath = await fsPromises.realpath(resolvedPath);
  } catch {
    const issue = createIssue(
      "task_plan_input_file_missing",
      "Task plan input file was not found.",
      "path",
      inputPath,
    );

    return {
      originalPath: inputPath,
      resolvedPath,
      relativePath,
      status: "missing",
      exists: false,
      isFile: false,
      isDirectory: false,
      withinWorkingDirectory: isPathInside(
        pathModule,
        workingDirectoryRealPath,
        resolvedPath,
      ),
      issues: [issue],
    };
  }

  const withinWorkingDirectory = isPathInside(
    pathModule,
    workingDirectoryRealPath,
    taskFileRealPath,
  );

  if (!withinWorkingDirectory) {
    const issue = createIssue(
      "task_plan_input_outside_working_directory",
      "Task plan input path is outside the working directory.",
      "safety",
      inputPath,
    );

    return {
      originalPath: inputPath,
      resolvedPath: taskFileRealPath,
      relativePath: pathModule.relative(
        workingDirectoryRealPath,
        taskFileRealPath,
      ),
      status: "outside_working_directory",
      exists: true,
      withinWorkingDirectory: false,
      issues: [issue],
    };
  }

  let fileStat: FileStat;

  try {
    fileStat = await fsPromises.stat(taskFileRealPath);
  } catch {
    const issue = createIssue(
      "task_plan_input_file_stat_failed",
      "Task plan input file status could not be read.",
      "path",
      inputPath,
    );

    return {
      originalPath: inputPath,
      resolvedPath: taskFileRealPath,
      relativePath: pathModule.relative(
        workingDirectoryRealPath,
        taskFileRealPath,
      ),
      status: "unknown",
      exists: true,
      withinWorkingDirectory: true,
      issues: [issue],
    };
  }

  if (fileStat.isDirectory()) {
    const issue = createIssue(
      "task_plan_input_path_is_directory",
      "Task plan input path points to a directory.",
      "path",
      inputPath,
    );

    return {
      originalPath: inputPath,
      resolvedPath: taskFileRealPath,
      relativePath: pathModule.relative(
        workingDirectoryRealPath,
        taskFileRealPath,
      ),
      status: "directory",
      exists: true,
      isFile: false,
      isDirectory: true,
      withinWorkingDirectory: true,
      issues: [issue],
    };
  }

  if (!fileStat.isFile()) {
    const issue = createIssue(
      "task_plan_input_path_not_regular_file",
      "Task plan input path must be a regular file.",
      "path",
      inputPath,
    );

    return {
      originalPath: inputPath,
      resolvedPath: taskFileRealPath,
      relativePath: pathModule.relative(
        workingDirectoryRealPath,
        taskFileRealPath,
      ),
      status: "not_file",
      exists: true,
      isFile: false,
      isDirectory: false,
      withinWorkingDirectory: true,
      issues: [issue],
    };
  }

  return {
    originalPath: inputPath,
    resolvedPath: taskFileRealPath,
    relativePath: pathModule.relative(
      workingDirectoryRealPath,
      taskFileRealPath,
    ),
    status: "ok",
    exists: true,
    isFile: true,
    isDirectory: false,
    withinWorkingDirectory: true,
    issues: [],
  };
}

export function parseTaskPlanInputJson(
  text: string,
  options: TaskPlanInputJsonParseOptions = {},
): TaskPlanInputParseResult {
  const sourceFile = options.sourceFile;
  const requireJsonObject = options.requireJsonObject ?? true;
  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(text);
  } catch (error: unknown) {
    const parseErrorMessage =
      error instanceof Error ? error.message : "Invalid JSON.";
    const issue = createIssue(
      "task_plan_input_invalid_json",
      "Task plan input file is not valid JSON.",
      "parse",
      sourceFile,
    );

    return {
      ok: false,
      format: "json",
      rawSizeBytes: utf8ByteLength(text),
      parseErrorMessage,
      issues: [issue],
    };
  }

  if (requireJsonObject && !isRecord(parsedValue)) {
    const issue = createIssue(
      "task_plan_input_json_root_not_object",
      "Task plan input JSON root must be an object.",
      "parse",
      sourceFile,
    );

    return {
      ok: false,
      format: "json",
      rawSizeBytes: utf8ByteLength(text),
      issues: [issue],
    };
  }

  return {
    ok: true,
    format: "json",
    value: parsedValue,
    valueReference: {
      kind: "parsed_value",
      format: "json",
      sourceFile: sourceFile ?? "",
      taskId:
        isRecord(parsedValue) && typeof parsedValue.id === "string"
          ? parsedValue.id
          : undefined,
    },
    rawSizeBytes: utf8ByteLength(text),
    issues: [],
  };
}

export function createTaskPlanInputValidationHandoff(
  parsedValue: unknown,
  requested = true,
): TaskPlanInputValidationHandoff {
  if (!requested) {
    return notRequestedValidationHandoff();
  }

  if (!hasTaskContractShape(parsedValue)) {
    const issue = createValidationIssue(
      "task_plan_input_contract_shape_invalid",
      "Task plan input JSON does not match the AEOS task contract shape.",
    );

    return {
      requested: true,
      status: "fail",
      issues: [issue],
    };
  }

  const result: TaskValidationResult = validateAeosTask(parsedValue);

  return {
    requested: true,
    status: result.status,
    taskId: result.taskId,
    task: result.valid ? parsedValue : undefined,
    result,
    issues: result.issues,
  };
}

export function createTaskPlanInputMappingHandoff(
  validation: TaskPlanInputValidationHandoff,
  requested = false,
  sourceFile?: string,
): TaskPlanInputMappingHandoff {
  if (!requested) {
    return notRequestedMappingHandoff();
  }

  if (validation.status !== "pass" || validation.task === undefined) {
    const issue = createIssue(
      "task_plan_input_mapping_blocked",
      "Mapping parsed task input to runner planning is blocked until validation passes.",
      "mapping",
      sourceFile,
    );

    return {
      requested: true,
      status: "blocked",
      runnerPlanningExecuted: false,
      issues: [issue],
    };
  }

  const issue = createIssue(
    "task_plan_input_mapping_unsupported",
    "Mapping parsed task input to runner planning is not supported.",
    "mapping",
    sourceFile,
  );

  return {
    requested: true,
    status: "unsupported",
    runnerPlanningExecuted: false,
    unsupportedReason:
      "AEOS task contracts cannot yet be safely mapped to runner planning input.",
    issues: [issue],
  };
}

export function summarizeTaskPlanInputResult(
  result: TaskPlanInputResult,
): TaskPlanInputSummary {
  return summarizeTaskPlanInputResultParts({
    sourceFile: result.sourceFile,
    pathCheck: result.pathCheck,
    parse: result.parse,
    validation: result.validation,
    mapping: result.mapping,
    issueCount: result.issues.length,
  });
}

export async function parseTaskPlanInputFile(
  request: TaskPlanInputFileRequest,
): Promise<TaskPlanInputResult> {
  const pathModule = await loadPathModule();
  const fsPromises = await loadFsPromisesModule();
  const sourceFile = request.inputPath;
  const pathCheck = await checkTaskPlanInputPath(request);

  if (pathCheck.status !== "ok" || pathCheck.resolvedPath === undefined) {
    return buildResult(
      request,
      sourceFile,
      pathCheck,
      emptyParseResult(),
      notRequestedValidationHandoff(),
      notRequestedMappingHandoff(),
    );
  }

  const format = extensionToFormat(pathModule, pathCheck.resolvedPath);

  if (request.expectedFormat !== "json" || format !== "json") {
    const issue = createIssue(
      "task_plan_input_unsupported_format",
      "Task plan input file must be a .json file.",
      "format",
      sourceFile,
      {
        expectedFormat: request.expectedFormat,
        detectedFormat: format,
      },
    );
    const parse: TaskPlanInputParseResult = {
      ok: false,
      format,
      issues: [issue],
    };

    return buildResult(
      request,
      sourceFile,
      pathCheck,
      parse,
      notRequestedValidationHandoff(),
      notRequestedMappingHandoff(),
    );
  }

  const fileStat = await fsPromises.stat(pathCheck.resolvedPath);
  const maxFileSizeBytes =
    request.maxFileSizeBytes ??
    request.options.maxFileSizeBytes ??
    DEFAULT_TASK_PLAN_INPUT_MAX_FILE_SIZE_BYTES;

  if (fileStat.size > maxFileSizeBytes) {
    const issue = createIssue(
      "task_plan_input_file_too_large",
      "Task plan input file exceeds the maximum allowed size.",
      "path",
      sourceFile,
      {
        maxFileSizeBytes,
        actualFileSizeBytes: fileStat.size,
      },
    );
    const parse: TaskPlanInputParseResult = {
      ok: false,
      format: "json",
      rawSizeBytes: fileStat.size,
      issues: [issue],
    };

    return buildResult(
      request,
      sourceFile,
      pathCheck,
      parse,
      notRequestedValidationHandoff(),
      notRequestedMappingHandoff(),
    );
  }

  let fileText: string;

  try {
    fileText = await fsPromises.readFile(pathCheck.resolvedPath, "utf8");
  } catch {
    const issue = createIssue(
      "task_plan_input_file_read_failed",
      "Task plan input file could not be read.",
      "path",
      sourceFile,
    );
    const parse: TaskPlanInputParseResult = {
      ok: false,
      format: "json",
      issues: [issue],
    };

    return buildResult(
      request,
      sourceFile,
      pathCheck,
      parse,
      notRequestedValidationHandoff(),
      notRequestedMappingHandoff(),
    );
  }

  const parse = parseTaskPlanInputJson(fileText, {
    requireJsonObject: request.options.requireJsonObject,
    sourceFile,
  });

  if (!parse.ok) {
    return buildResult(
      request,
      sourceFile,
      pathCheck,
      parse,
      notRequestedValidationHandoff(),
      notRequestedMappingHandoff(),
    );
  }

  const validation = createTaskPlanInputValidationHandoff(
    parse.value,
    request.options.validateContract,
  );
  const mapping = createTaskPlanInputMappingHandoff(
    validation,
    request.options.createPlanningHandoff,
    sourceFile,
  );

  return buildResult(request, sourceFile, pathCheck, parse, validation, mapping);
}
