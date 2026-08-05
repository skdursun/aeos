import type { AeosTask } from "./tasks.js";
import type {
  TaskPlanInputFileRequest,
  TaskPlanInputIssue,
  TaskPlanInputParseResult,
  TaskPlanInputPathCheck,
  TaskPlanInputResult,
  TaskPlanInputSummary,
  TaskPlanInputValidationHandoff,
} from "./task-plan-input.js";
import {
  checkTaskPlanInputPath,
  createTaskPlanInputMappingHandoff,
  createTaskPlanInputValidationHandoff,
  DEFAULT_TASK_PLAN_INPUT_MAX_FILE_SIZE_BYTES,
  parseTaskPlanInputFile,
  parseTaskPlanInputJson,
  summarizeTaskPlanInputResult,
} from "./task-plan-input-parser.js";

type TaskPlanInputParserSafetyFlags = {
  readonly noExecution: true;
  readonly noWrites: true;
  readonly runnerPlanningExecuted: false;
  readonly taskPersistenceWritten: false;
  readonly adapterCallsExecuted: false;
  readonly auditWritten: false;
  readonly verifierExecuted: false;
};

type TaskPlanInputPathCheckExamples = {
  readonly validFilePath: TaskPlanInputPathCheck;
  readonly missingFilePath: TaskPlanInputPathCheck;
  readonly directoryInputPath: TaskPlanInputPathCheck;
  readonly outsideWorkingDirectoryPath: TaskPlanInputPathCheck;
  readonly unsafeParentTraversalPath: TaskPlanInputPathCheck;
  readonly absolutePathDeniedByDefault: TaskPlanInputPathCheck;
};

type TaskPlanInputParserDeterminismExample = {
  readonly first: TaskPlanInputParseResult;
  readonly second: TaskPlanInputParseResult;
  readonly equivalentShape: boolean;
  readonly safety: TaskPlanInputParserSafetyFlags;
};

export const taskPlanInputParserExampleSafety: TaskPlanInputParserSafetyFlags = {
  noExecution: true,
  noWrites: true,
  runnerPlanningExecuted: false,
  taskPersistenceWritten: false,
  adapterCallsExecuted: false,
  auditWritten: false,
  verifierExecuted: false,
};

export const safeLocalJsonTaskFileParseRequest: TaskPlanInputFileRequest = {
  inputPath: "TASKS/TASK-0236.json",
  currentWorkingDirectory: "/workspace/pro-performans",
  mode: "plan",
  expectedFormat: "json",
  maxFileSizeBytes: DEFAULT_TASK_PLAN_INPUT_MAX_FILE_SIZE_BYTES,
  options: {
    allowAbsolutePath: false,
    allowParentTraversal: false,
    maxFileSizeBytes: DEFAULT_TASK_PLAN_INPUT_MAX_FILE_SIZE_BYTES,
    requireJsonObject: true,
    validateContract: true,
    createPlanningHandoff: true,
    noExecution: true,
    noWrites: true,
    trustModelSelfReporting: false,
  },
  noExecution: true,
  noWrites: true,
};

export const fileSizeLimitParseRequest: TaskPlanInputFileRequest = {
  ...safeLocalJsonTaskFileParseRequest,
  maxFileSizeBytes: 32,
  options: {
    ...safeLocalJsonTaskFileParseRequest.options,
    maxFileSizeBytes: 32,
  },
};

export const fileTooLargeIssueShape: TaskPlanInputIssue = {
  code: "task_plan_input_file_too_large",
  message: "Task plan input file exceeds the maximum allowed size.",
  severity: "error",
  phase: "path",
  path: fileSizeLimitParseRequest.inputPath,
  metadata: {
    maxFileSizeBytes: fileSizeLimitParseRequest.maxFileSizeBytes,
    actualFileSizeBytes: 128,
  },
};

export const invalidJsonParseExample = parseTaskPlanInputJson(
  '{"id":"TASK-0236",}',
  {
    requireJsonObject: true,
    sourceFile: safeLocalJsonTaskFileParseRequest.inputPath,
  },
);

export const invalidJsonSafetyExample = {
  parseOk: invalidJsonParseExample.ok,
  parseErrorMessage: invalidJsonParseExample.parseErrorMessage,
  issue: invalidJsonParseExample.issues[0],
  noExecution: true,
  noWrites: true,
} as const;

export const validJsonParseExample = parseTaskPlanInputJson(
  JSON.stringify({
    id: "TASK-0236",
    title: "Add task plan input parser logic examples.",
  }),
  {
    requireJsonObject: true,
    sourceFile: safeLocalJsonTaskFileParseRequest.inputPath,
  },
);

export const jsonRootObjectRequiredExample = parseTaskPlanInputJson(
  '["TASK-0236"]',
  {
    requireJsonObject: true,
    sourceFile: safeLocalJsonTaskFileParseRequest.inputPath,
  },
);

export const parsedArrayAllowedWhenObjectNotRequiredExample =
  parseTaskPlanInputJson('["TASK-0236"]', {
    requireJsonObject: false,
    sourceFile: safeLocalJsonTaskFileParseRequest.inputPath,
  });

export const validTaskPlanInputParserTask: AeosTask = {
  id: "TASK-0236",
  title: "Add task plan input parser logic examples.",
  purpose:
    "Add compile-checked examples for AEOS task plan input parser logic.",
  status: "pending",
  executionMode: "code",
  context: {
    load: [
      {
        path: "packages/core/src/task-plan-input-parser.ts",
        required: true,
      },
    ],
    doNotLoad: [
      {
        path: "docs/",
        required: true,
      },
    ],
  },
  fileBoundary: {
    filesToModify: [
      "packages/core/src/task-plan-input-parser.example.ts",
      "PROJECT_CONTEXT.md",
    ],
    filesNotToTouch: ["packages/core/src/task-plan-input-parser.ts"],
    allowGeneratedFiles: true,
    requireStopOnBoundaryConflict: true,
  },
  allowedOperations: [
    "read_context",
    "create_file",
    "modify_file",
    "run_verification",
    "check_git_status",
  ],
  forbiddenOperations: [
    "read_unlisted_context",
    "modify_unlisted_file",
    "rename_file",
    "delete_file",
    "install_dependency",
    "change_package_config",
    "deploy",
    "push_git",
    "run_destructive_command",
    "continue_next_task",
  ],
  steps: [
    {
      order: 1,
      instruction: "Create parser logic examples.",
      required: true,
    },
  ],
  verification: [
    {
      command: "pnpm --filter @aeos/core check",
      level: "static_check",
      required: true,
      scope: ["packages/core/src/task-plan-input-parser.example.ts"],
      expectedEvidence: ["TypeScript examples compile."],
    },
  ],
  stopCondition: {
    description: "Stop after TASK-0236 examples and context update.",
    stopAfterCompletion: true,
  },
};

export const validationHandoffExample: TaskPlanInputValidationHandoff =
  createTaskPlanInputValidationHandoff(validTaskPlanInputParserTask, true);

export const invalidValidationHandoffExample =
  createTaskPlanInputValidationHandoff(
    {
      id: "TASK-0236",
      title: "Missing task contract fields.",
    },
    true,
  );

export const mappingHandoffExample = createTaskPlanInputMappingHandoff(
  validationHandoffExample,
  true,
  safeLocalJsonTaskFileParseRequest.inputPath,
);

export const blockedMappingHandoffExample = createTaskPlanInputMappingHandoff(
  invalidValidationHandoffExample,
  true,
  safeLocalJsonTaskFileParseRequest.inputPath,
);

export const mappingUnsupportedExample = {
  requested: mappingHandoffExample.requested,
  status: mappingHandoffExample.status,
  unsupportedReason: mappingHandoffExample.unsupportedReason,
  runnerPlanningExecuted: mappingHandoffExample.runnerPlanningExecuted,
  planAgenticRunnerRun: false,
} as const;

export async function createTaskPlanInputPathCheckExamples(
  currentWorkingDirectory: string,
): Promise<TaskPlanInputPathCheckExamples> {
  const requestBase: TaskPlanInputFileRequest = {
    ...safeLocalJsonTaskFileParseRequest,
    currentWorkingDirectory,
  };

  const validFilePath = await checkTaskPlanInputPath({
    ...requestBase,
    inputPath: "TASKS/TASK-0236.json",
  });
  const missingFilePath = await checkTaskPlanInputPath({
    ...requestBase,
    inputPath: "TASKS/missing-task-plan-input.json",
  });
  const directoryInputPath = await checkTaskPlanInputPath({
    ...requestBase,
    inputPath: "TASKS",
  });
  const outsideWorkingDirectoryPath = await checkTaskPlanInputPath({
    ...requestBase,
    inputPath: "../outside-task-plan-input.json",
    options: {
      ...requestBase.options,
      allowParentTraversal: true,
    },
  });
  const unsafeParentTraversalPath = await checkTaskPlanInputPath({
    ...requestBase,
    inputPath: "../outside-task-plan-input.json",
  });
  const absolutePathDeniedByDefault = await checkTaskPlanInputPath({
    ...requestBase,
    inputPath: `${currentWorkingDirectory}/TASKS/TASK-0236.json`,
  });

  return {
    validFilePath,
    missingFilePath,
    directoryInputPath,
    outsideWorkingDirectoryPath,
    unsafeParentTraversalPath,
    absolutePathDeniedByDefault,
  };
}

export async function parseSafeLocalJsonTaskFileExample(
  request: TaskPlanInputFileRequest = safeLocalJsonTaskFileParseRequest,
): Promise<TaskPlanInputResult> {
  return parseTaskPlanInputFile(request);
}

export async function parseFileTooLargeExample(
  request: TaskPlanInputFileRequest = fileSizeLimitParseRequest,
): Promise<TaskPlanInputResult> {
  return parseTaskPlanInputFile(request);
}

export async function createFullParseResultExample(
  request: TaskPlanInputFileRequest = safeLocalJsonTaskFileParseRequest,
): Promise<{
  readonly sourceFile: string | undefined;
  readonly pathCheck: TaskPlanInputPathCheck;
  readonly parse: TaskPlanInputParseResult;
  readonly validation: TaskPlanInputValidationHandoff;
  readonly mapping: TaskPlanInputResult["mapping"];
  readonly issues: TaskPlanInputResult["issues"];
  readonly summary: TaskPlanInputSummary;
}> {
  const result = await parseTaskPlanInputFile(request);

  return {
    sourceFile: result.sourceFile,
    pathCheck: result.pathCheck,
    parse: result.parse,
    validation: result.validation,
    mapping: result.mapping,
    issues: result.issues,
    summary: result.summary,
  };
}

export const taskPlanInputSummaryBehaviorExample: TaskPlanInputSummary = {
  hasSourceFile: true,
  pathOk: true,
  parseOk: true,
  validationRequested: validationHandoffExample.requested,
  validationOk: validationHandoffExample.status === "pass",
  mappingRequested: mappingHandoffExample.requested,
  mappingOk: mappingHandoffExample.status === "ready",
  issueCount: mappingHandoffExample.issues.length,
  noExecution: true,
  noWrites: true,
  runnerPlanningExecuted: false,
  taskPersistenceWritten: false,
  trustsModelSelfReporting: false,
};

export function summarizeParsedTaskPlanInputExample(
  result: TaskPlanInputResult,
): TaskPlanInputSummary {
  return summarizeTaskPlanInputResult(result);
}

export function createDeterministicNoSideEffectExample(): TaskPlanInputParserDeterminismExample {
  const text = JSON.stringify({
    id: "TASK-0236",
    title: "Add task plan input parser logic examples.",
  });
  const options = {
    requireJsonObject: true,
    sourceFile: safeLocalJsonTaskFileParseRequest.inputPath,
  };
  const first = parseTaskPlanInputJson(text, options);
  const second = parseTaskPlanInputJson(text, options);

  return {
    first,
    second,
    equivalentShape:
      first.ok === second.ok &&
      first.format === second.format &&
      first.rawSizeBytes === second.rawSizeBytes &&
      first.issues.length === second.issues.length,
    safety: taskPlanInputParserExampleSafety,
  };
}
