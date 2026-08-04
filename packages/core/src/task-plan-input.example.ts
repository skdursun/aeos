import type {
  TaskPlanInputFileFormat,
  TaskPlanInputFileMode,
  TaskPlanInputFileOptions,
  TaskPlanInputFileRequest,
  TaskPlanInputIssue,
  TaskPlanInputMappingHandoff,
  TaskPlanInputMappingStatus,
  TaskPlanInputParseResult,
  TaskPlanInputPathCheck,
  TaskPlanInputPathCheckStatus,
  TaskPlanInputResult,
  TaskPlanInputSummary,
  TaskPlanInputValidationHandoff,
} from "./task-plan-input.js";

type ExampleTaskPlanInputJson = {
  readonly id: string;
  readonly title: string;
};

export const taskPlanInputExampleMode: TaskPlanInputFileMode = "plan";

export const taskPlanInputExampleFormat: TaskPlanInputFileFormat = "json";

export const taskPlanInputExamplePathCheckStatus: TaskPlanInputPathCheckStatus =
  "ok";

export const taskPlanInputExampleMappingStatus: TaskPlanInputMappingStatus =
  "unsupported";

export const taskPlanInputExampleOptions: TaskPlanInputFileOptions = {
  allowAbsolutePath: false,
  allowParentTraversal: false,
  maxFileSizeBytes: 64_000,
  requireJsonObject: true,
  validateContract: true,
  createPlanningHandoff: true,
  noExecution: true,
  noWrites: true,
  trustModelSelfReporting: false,
};

export const validLocalJsonTaskFileRequest: TaskPlanInputFileRequest = {
  inputPath: "tasks/sitemap-audit.json",
  currentWorkingDirectory: "/workspace/pro-performans",
  mode: "plan",
  options: taskPlanInputExampleOptions,
  expectedFormat: "json",
  maxFileSizeBytes: 64_000,
  noExecution: true,
  noWrites: true,
};

export const missingFileIssue: TaskPlanInputIssue = {
  code: "task_plan_input_file_missing",
  message: "Task plan input file was not found.",
  severity: "error",
  phase: "path",
  path: "tasks/missing.json",
};

export const directoryInsteadOfFileIssue: TaskPlanInputIssue = {
  code: "task_plan_input_path_is_directory",
  message: "Task plan input path points to a directory.",
  severity: "error",
  phase: "path",
  path: "tasks/",
};

export const outsideWorkingDirectoryIssue: TaskPlanInputIssue = {
  code: "task_plan_input_outside_working_directory",
  message: "Task plan input path is outside the working directory.",
  severity: "error",
  phase: "safety",
  path: "../outside/task.json",
};

export const invalidJsonIssue: TaskPlanInputIssue = {
  code: "task_plan_input_invalid_json",
  message: "Task plan input file is not valid JSON.",
  severity: "error",
  phase: "parse",
  path: "tasks/sitemap-audit.json",
};

export const unsupportedMappingIssue: TaskPlanInputIssue = {
  code: "task_plan_input_mapping_unsupported",
  message: "Mapping parsed task input to runner planning is not supported.",
  severity: "warning",
  phase: "mapping",
  path: "tasks/sitemap-audit.json",
};

export const successfulPathCheck: TaskPlanInputPathCheck = {
  originalPath: "tasks/sitemap-audit.json",
  resolvedPath: "/workspace/pro-performans/tasks/sitemap-audit.json",
  relativePath: "tasks/sitemap-audit.json",
  status: "ok",
  exists: true,
  isFile: true,
  isDirectory: false,
  withinWorkingDirectory: true,
  issues: [],
};

export const missingFilePathCheck: TaskPlanInputPathCheck = {
  originalPath: "tasks/missing.json",
  resolvedPath: "/workspace/pro-performans/tasks/missing.json",
  relativePath: "tasks/missing.json",
  status: "missing",
  exists: false,
  isFile: false,
  isDirectory: false,
  withinWorkingDirectory: true,
  issues: [missingFileIssue],
};

export const directoryInsteadOfFilePathCheck: TaskPlanInputPathCheck = {
  originalPath: "tasks/",
  resolvedPath: "/workspace/pro-performans/tasks",
  relativePath: "tasks",
  status: "directory",
  exists: true,
  isFile: false,
  isDirectory: true,
  withinWorkingDirectory: true,
  issues: [directoryInsteadOfFileIssue],
};

export const outsideWorkingDirectoryPathCheck: TaskPlanInputPathCheck = {
  originalPath: "../outside/task.json",
  resolvedPath: "/workspace/outside/task.json",
  relativePath: "../outside/task.json",
  status: "outside_working_directory",
  exists: true,
  isFile: true,
  isDirectory: false,
  withinWorkingDirectory: false,
  issues: [outsideWorkingDirectoryIssue],
};

export const invalidJsonParseResult: TaskPlanInputParseResult = {
  ok: false,
  format: "json",
  rawSizeBytes: 128,
  parseErrorMessage: "Unexpected token } in JSON at position 42.",
  issues: [invalidJsonIssue],
};

export const validJsonParseResult: TaskPlanInputParseResult<ExampleTaskPlanInputJson> =
  {
    ok: true,
    format: "json",
    value: {
      id: "TASK-0233",
      title: "Add task plan input parser contract examples.",
    },
    valueReference: {
      kind: "parsed_value",
      format: "json",
      sourceFile: "tasks/sitemap-audit.json",
      taskId: "TASK-0233",
    },
    rawSizeBytes: 512,
    issues: [],
  };

export const validationHandoffRequested: TaskPlanInputValidationHandoff = {
  requested: true,
  status: "pass",
  taskId: "TASK-0233",
  result: {
    taskId: "TASK-0233",
    status: "pass",
    valid: true,
    issues: [],
  },
  issues: [],
};

export const unsupportedMappingHandoff: TaskPlanInputMappingHandoff = {
  requested: true,
  status: "unsupported",
  runnerPlanningExecuted: false,
  unsupportedReason:
    "Parser contract examples do not execute runner planning or adapters.",
  issues: [unsupportedMappingIssue],
};

export const taskPlanInputSuccessSummary: TaskPlanInputSummary = {
  hasSourceFile: true,
  pathOk: true,
  parseOk: true,
  validationRequested: true,
  validationOk: true,
  mappingRequested: true,
  mappingOk: false,
  issueCount: 1,
  noExecution: true,
  noWrites: true,
  runnerPlanningExecuted: false,
  taskPersistenceWritten: false,
  trustsModelSelfReporting: false,
};

export const fullTaskPlanInputResultShape: TaskPlanInputResult<ExampleTaskPlanInputJson> =
  {
    ok: true,
    mode: "plan",
    sourceFile: "tasks/sitemap-audit.json",
    pathCheck: successfulPathCheck,
    parse: validJsonParseResult,
    validation: validationHandoffRequested,
    mapping: unsupportedMappingHandoff,
    issues: [unsupportedMappingIssue],
    summary: taskPlanInputSuccessSummary,
  };

export const missingFileResult: TaskPlanInputResult = {
  ok: false,
  mode: "plan",
  sourceFile: "tasks/missing.json",
  pathCheck: missingFilePathCheck,
  parse: {
    ok: false,
    format: "unknown",
    issues: [],
  },
  validation: {
    requested: false,
    status: "not_requested",
    issues: [],
  },
  mapping: {
    requested: false,
    status: "not_requested",
    runnerPlanningExecuted: false,
    issues: [],
  },
  issues: [missingFileIssue],
  summary: {
    hasSourceFile: true,
    pathOk: false,
    parseOk: false,
    validationRequested: false,
    validationOk: false,
    mappingRequested: false,
    mappingOk: false,
    issueCount: 1,
    noExecution: true,
    noWrites: true,
    runnerPlanningExecuted: false,
    taskPersistenceWritten: false,
    trustsModelSelfReporting: false,
  },
};

export const directoryInsteadOfFileResult: TaskPlanInputResult = {
  ok: false,
  mode: "plan",
  sourceFile: "tasks/",
  pathCheck: directoryInsteadOfFilePathCheck,
  parse: {
    ok: false,
    format: "unknown",
    issues: [],
  },
  validation: {
    requested: false,
    status: "not_requested",
    issues: [],
  },
  mapping: {
    requested: false,
    status: "not_requested",
    runnerPlanningExecuted: false,
    issues: [],
  },
  issues: [directoryInsteadOfFileIssue],
  summary: {
    hasSourceFile: true,
    pathOk: false,
    parseOk: false,
    validationRequested: false,
    validationOk: false,
    mappingRequested: false,
    mappingOk: false,
    issueCount: 1,
    noExecution: true,
    noWrites: true,
    runnerPlanningExecuted: false,
    taskPersistenceWritten: false,
    trustsModelSelfReporting: false,
  },
};

export const unsafeOutsideWorkingDirectoryResult: TaskPlanInputResult = {
  ok: false,
  mode: "plan",
  sourceFile: "../outside/task.json",
  pathCheck: outsideWorkingDirectoryPathCheck,
  parse: {
    ok: false,
    format: "unknown",
    issues: [],
  },
  validation: {
    requested: false,
    status: "not_requested",
    issues: [],
  },
  mapping: {
    requested: false,
    status: "not_requested",
    runnerPlanningExecuted: false,
    issues: [],
  },
  issues: [outsideWorkingDirectoryIssue],
  summary: {
    hasSourceFile: true,
    pathOk: false,
    parseOk: false,
    validationRequested: false,
    validationOk: false,
    mappingRequested: false,
    mappingOk: false,
    issueCount: 1,
    noExecution: true,
    noWrites: true,
    runnerPlanningExecuted: false,
    taskPersistenceWritten: false,
    trustsModelSelfReporting: false,
  },
};

export const invalidJsonResult: TaskPlanInputResult = {
  ok: false,
  mode: "plan",
  sourceFile: "tasks/sitemap-audit.json",
  pathCheck: successfulPathCheck,
  parse: invalidJsonParseResult,
  validation: {
    requested: false,
    status: "not_requested",
    issues: [],
  },
  mapping: {
    requested: false,
    status: "not_requested",
    runnerPlanningExecuted: false,
    issues: [],
  },
  issues: [invalidJsonIssue],
  summary: {
    hasSourceFile: true,
    pathOk: true,
    parseOk: false,
    validationRequested: false,
    validationOk: false,
    mappingRequested: false,
    mappingOk: false,
    issueCount: 1,
    noExecution: true,
    noWrites: true,
    runnerPlanningExecuted: false,
    taskPersistenceWritten: false,
    trustsModelSelfReporting: false,
  },
};
