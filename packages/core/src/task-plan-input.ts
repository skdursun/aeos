import type {
  AgenticRunnerPlanningDataReference,
  AgenticRunnerPlanningInput,
  AgenticRunnerPlanningReference,
} from "./agentic-runner-planning.js";
import type {
  AeosTask,
  AeosTaskId,
  TaskValidationIssue,
  TaskValidationResult,
} from "./tasks.js";

export type TaskPlanInputFileMode =
  | "plan"
  | "dry_run"
  | "validate"
  | "unknown";

export type TaskPlanInputFileFormat =
  | "json"
  | "unsupported"
  | "unknown";

export type TaskPlanInputPathCheckStatus =
  | "ok"
  | "missing"
  | "not_file"
  | "directory"
  | "outside_working_directory"
  | "unsafe_path"
  | "unsupported"
  | "unknown";

export type TaskPlanInputIssueSeverity =
  | "error"
  | "warning"
  | "info";

export type TaskPlanInputIssuePhase =
  | "request"
  | "path"
  | "format"
  | "parse"
  | "validation"
  | "mapping"
  | "safety"
  | "unknown";

export type TaskPlanInputValidationStatus =
  | "not_requested"
  | TaskValidationResult["status"]
  | "unsupported"
  | "unknown";

export type TaskPlanInputMappingStatus =
  | "not_requested"
  | "ready"
  | "unsupported"
  | "blocked"
  | "unknown";

export interface TaskPlanInputIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: TaskPlanInputIssueSeverity;
  readonly phase: TaskPlanInputIssuePhase;
  readonly path?: string;
  readonly field?: string;
  readonly sourceIssue?: TaskValidationIssue;
  readonly metadata?: Record<string, unknown>;
}

export interface TaskPlanInputFileOptions {
  readonly allowAbsolutePath: boolean;
  readonly allowParentTraversal: boolean;
  readonly maxFileSizeBytes?: number;
  readonly requireJsonObject: boolean;
  readonly validateContract: boolean;
  readonly createPlanningHandoff: boolean;
  readonly noExecution: true;
  readonly noWrites: true;
  readonly trustModelSelfReporting: false;
}

export interface TaskPlanInputFileRequest {
  readonly inputPath: string;
  readonly currentWorkingDirectory: string;
  readonly mode: TaskPlanInputFileMode;
  readonly options: TaskPlanInputFileOptions;
  readonly expectedFormat: TaskPlanInputFileFormat;
  readonly maxFileSizeBytes?: number;
  readonly noExecution: true;
  readonly noWrites: true;
}

export interface TaskPlanInputPathCheck {
  readonly originalPath: string;
  readonly resolvedPath?: string;
  readonly relativePath?: string;
  readonly status: TaskPlanInputPathCheckStatus;
  readonly exists?: boolean;
  readonly isFile?: boolean;
  readonly isDirectory?: boolean;
  readonly withinWorkingDirectory?: boolean;
  readonly issues: readonly TaskPlanInputIssue[];
}

export interface TaskPlanInputParsedValueReference {
  readonly kind: "parsed_value";
  readonly format: TaskPlanInputFileFormat;
  readonly sourceFile: string;
  readonly taskId?: AeosTaskId;
}

export interface TaskPlanInputParseResult<TParsed = unknown> {
  readonly ok: boolean;
  readonly format: TaskPlanInputFileFormat;
  readonly value?: TParsed;
  readonly valueReference?: TaskPlanInputParsedValueReference;
  readonly rawSizeBytes?: number;
  readonly parseErrorMessage?: string;
  readonly issues: readonly TaskPlanInputIssue[];
}

export interface TaskPlanInputValidationHandoff {
  readonly requested: boolean;
  readonly status: TaskPlanInputValidationStatus;
  readonly taskId?: AeosTaskId;
  readonly task?: AeosTask;
  readonly result?: TaskValidationResult;
  readonly issues: readonly TaskValidationIssue[];
}

export interface TaskPlanInputMappingHandoff {
  readonly requested: boolean;
  readonly status: TaskPlanInputMappingStatus;
  readonly runnerPlanningInput?: AgenticRunnerPlanningInput;
  readonly runnerPlanningInputReference?: AgenticRunnerPlanningReference;
  readonly runnerPlanningInputData?: AgenticRunnerPlanningDataReference<AgenticRunnerPlanningInput>;
  readonly runnerPlanningExecuted: false;
  readonly unsupportedReason?: string;
  readonly issues: readonly TaskPlanInputIssue[];
}

export interface TaskPlanInputSummary {
  readonly hasSourceFile: boolean;
  readonly pathOk: boolean;
  readonly parseOk: boolean;
  readonly validationRequested: boolean;
  readonly validationOk: boolean;
  readonly mappingRequested: boolean;
  readonly mappingOk: boolean;
  readonly issueCount: number;
  readonly noExecution: true;
  readonly noWrites: true;
  readonly runnerPlanningExecuted: false;
  readonly taskPersistenceWritten: false;
  readonly trustsModelSelfReporting: false;
}

export interface TaskPlanInputResult<TParsed = unknown> {
  readonly ok: boolean;
  readonly mode: TaskPlanInputFileMode;
  readonly sourceFile?: string;
  readonly pathCheck: TaskPlanInputPathCheck;
  readonly parse: TaskPlanInputParseResult<TParsed>;
  readonly validation: TaskPlanInputValidationHandoff;
  readonly mapping: TaskPlanInputMappingHandoff;
  readonly issues: readonly TaskPlanInputIssue[];
  readonly summary: TaskPlanInputSummary;
}
