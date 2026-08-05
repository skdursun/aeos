import type {
  AgenticRunnerPlanningInput,
  AgenticRunnerPlanningReference,
  AgenticRunnerPlanningResult,
} from "./agentic-runner-planning.js";
import type {
  TaskContractMappingOptions,
  TaskContractMappingResult,
  TaskContractMappingStatus,
} from "./task-contract-mapping.js";
import type {
  TaskPlanInputFileRequest,
  TaskPlanInputIssue,
  TaskPlanInputResult,
  TaskPlanInputValidationStatus,
} from "./task-plan-input.js";
import type { AeosTaskId } from "./tasks.js";

export type TaskPlanFilePlannerWiringMode =
  | "plan"
  | "dry_run"
  | "validate"
  | "unknown";

export type TaskPlanFilePlannerWiringStatus =
  | "planned"
  | "parser_failed"
  | "validation_failed"
  | "mapping_failed"
  | "unsupported_mapping"
  | "planner_failed"
  | "blocked"
  | "failed"
  | "unknown";

export type TaskPlanFilePlannerExitCode =
  | "success"
  | "parser_failure"
  | "validation_failure"
  | "unsupported_mapping"
  | "mapping_failure"
  | "planner_failure"
  | "blocked"
  | "unknown_failure";

export type TaskPlanFilePlannerWiringIssueSeverity =
  | "error"
  | "warning"
  | "info"
  | "critical";

export type TaskPlanFilePlannerWiringIssuePhase =
  | "input"
  | "parse"
  | "validation"
  | "mapping"
  | "planner"
  | "safety"
  | "output"
  | "unknown";

export interface TaskPlanFilePlannerWiringIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: TaskPlanFilePlannerWiringIssueSeverity;
  readonly phase: TaskPlanFilePlannerWiringIssuePhase;
  readonly taskId?: AeosTaskId;
  readonly sourceFile?: string;
  readonly field?: string;
  readonly sourceIssue?: TaskPlanInputIssue;
  readonly sourceReference?: AgenticRunnerPlanningReference;
  readonly metadata?: Record<string, unknown>;
}

export interface TaskPlanFilePlannerWiringOptions {
  readonly json: boolean;
  readonly allowSingleWorkItemFallback: boolean;
  readonly requireExplicitWorkItems: boolean;
  readonly requireVerifier: boolean;
  readonly createDefaultBatch: boolean;
  readonly createAuditExpectations: boolean;
  readonly failClosedOnUnsupportedMapping: boolean;
  readonly failClosedWithoutPlanningInput: boolean;
  readonly failClosedWithoutVerifier: boolean;
  readonly failClosedWithoutNoExecution: boolean;
  readonly failClosedWithoutNoWrites: boolean;
}

export interface TaskPlanFilePlannerWiringInput {
  readonly taskFile: string;
  readonly argv?: readonly string[];
  readonly json: boolean;
  readonly mode: TaskPlanFilePlannerWiringMode;
  readonly parserRequest?: TaskPlanInputFileRequest;
  readonly parserResult?: TaskPlanInputResult;
  readonly mappingOptions?: TaskContractMappingOptions;
  readonly mappingResult?: TaskContractMappingResult;
  readonly plannerInput?: AgenticRunnerPlanningInput;
  readonly plannerOptions?: AgenticRunnerPlanningInput["options"];
  readonly noExecution: true;
  readonly noWrites: true;
}

export interface TaskPlanFileParseStage {
  readonly attempted: boolean;
  readonly ok: boolean;
  readonly sourceFile?: string;
  readonly pathOk: boolean;
  readonly parseOk: boolean;
  readonly validationStatus?: TaskPlanInputValidationStatus;
  readonly validationCompatible: boolean;
  readonly parserResult?: TaskPlanInputResult;
  readonly parsedTaskReference?: AgenticRunnerPlanningReference;
  readonly parsedTaskData?: TaskPlanInputResult["validation"]["task"];
  readonly failClosedWithoutParserOk: boolean;
  readonly failClosedWithoutValidationOk: boolean;
  readonly issues: readonly TaskPlanFilePlannerWiringIssue[];
}

export interface TaskPlanFileMappingStage {
  readonly attempted: boolean;
  readonly ok: boolean;
  readonly status: TaskContractMappingStatus | "not_attempted" | "unknown";
  readonly mappingResult?: TaskContractMappingResult;
  readonly planningInput?: AgenticRunnerPlanningInput;
  readonly planningInputReference?: AgenticRunnerPlanningReference;
  readonly planningInputAvailable: boolean;
  readonly noExecution: true;
  readonly noWrites: true;
  readonly verifierRequired: boolean;
  readonly completionGatedByVerifier: boolean;
  readonly failClosedWithoutMappedStatus: boolean;
  readonly failClosedWithoutPlanningInput: boolean;
  readonly failClosedWithoutNoExecution: boolean;
  readonly failClosedWithoutNoWrites: boolean;
  readonly failClosedWithoutVerifierRequired: boolean;
  readonly failClosedWithoutCompletionGate: boolean;
  readonly issues: readonly TaskPlanFilePlannerWiringIssue[];
}

export interface TaskPlanFilePlannerStage {
  readonly attempted: boolean;
  readonly ok: boolean;
  readonly status:
    | "not_attempted"
    | "planned"
    | "blocked"
    | "failed"
    | "unknown";
  readonly planningInput?: AgenticRunnerPlanningInput;
  readonly planningInputReference?: AgenticRunnerPlanningReference;
  readonly planningResult?: AgenticRunnerPlanningResult;
  readonly planningResultReference?: AgenticRunnerPlanningReference;
  readonly planStepCount?: number;
  readonly plannerExecuted: false;
  readonly issues: readonly TaskPlanFilePlannerWiringIssue[];
}

export interface TaskPlanFileSafetyStage {
  readonly executionEnabled: false;
  readonly adapterCalls: false;
  readonly auditWrites: false;
  readonly verifierRun: false;
  readonly persistence: false;
  readonly filesystemMutation: false;
  readonly completedStateCreated: false;
  readonly plannerMayRunLater: boolean;
  readonly parserExecutedHere: false;
  readonly mapperExecutedHere: false;
  readonly plannerExecutedHere: false;
  readonly noExecution: true;
  readonly noWrites: true;
  readonly issues: readonly TaskPlanFilePlannerWiringIssue[];
}

export interface TaskPlanFileHumanOutput {
  readonly title: string;
  readonly taskId?: AeosTaskId;
  readonly sourceFile?: string;
  readonly mode: TaskPlanFilePlannerWiringMode;
  readonly parsed: boolean;
  readonly mapping: TaskContractMappingStatus | "not_attempted" | "unknown";
  readonly planning: TaskPlanFilePlannerStage["status"];
  readonly workItems: number;
  readonly batches: number;
  readonly steps: number;
  readonly policy:
    | "allowed"
    | "blocked"
    | "requires_approval"
    | "not_evaluated"
    | "unknown";
  readonly approvalRequired: boolean;
  readonly verifierRequired: boolean;
  readonly completionGatedByVerifier: boolean;
  readonly auditExpected: boolean;
  readonly realExecution: false;
  readonly adapterCalls: false;
  readonly auditWrites: false;
  readonly verifierRun: false;
  readonly persistence: false;
  readonly issues: readonly TaskPlanFilePlannerWiringIssue[];
}

export interface TaskPlanFileJsonOutput {
  readonly ok: boolean;
  readonly status: TaskPlanFilePlannerWiringStatus;
  readonly exitCode: TaskPlanFilePlannerExitCode;
  readonly taskId?: AeosTaskId;
  readonly mode: TaskPlanFilePlannerWiringMode;
  readonly sourceFile?: string;
  readonly parse: TaskPlanFileParseStage;
  readonly mapping: TaskPlanFileMappingStage;
  readonly plan: TaskPlanFilePlannerStage;
  readonly policy?: AgenticRunnerPlanningResult["policy"];
  readonly verifier?: AgenticRunnerPlanningResult["verifier"];
  readonly audit?: AgenticRunnerPlanningResult["audit"];
  readonly resume?: AgenticRunnerPlanningResult["resume"];
  readonly executionEnabled: false;
  readonly adapterCalls: false;
  readonly auditWrites: false;
  readonly verifierRun: false;
  readonly persistence: false;
  readonly issues: readonly TaskPlanFilePlannerWiringIssue[];
  readonly summary: TaskPlanFilePlannerWiringSummary;
}

export interface TaskPlanFilePlannerWiringSummary {
  readonly parsed: boolean;
  readonly mapped: boolean;
  readonly planned: boolean;
  readonly workItemCount: number;
  readonly batchCount: number;
  readonly planStepCount: number;
  readonly issueCount: number;
  readonly json: boolean;
  readonly noExecution: true;
  readonly noWrites: true;
  readonly executionEnabled: false;
  readonly adapterCalls: false;
  readonly auditWrites: false;
  readonly verifierRun: false;
  readonly persistence: false;
  readonly filesystemMutation: false;
  readonly completedStateCreated: false;
  readonly verifierRequired: boolean;
  readonly completionGatedByVerifier: boolean;
  readonly mappingSupported: boolean;
  readonly planningInputAvailable: boolean;
}

export interface TaskPlanFilePlannerWiringResult {
  readonly ok: boolean;
  readonly status: TaskPlanFilePlannerWiringStatus;
  readonly exitCode: TaskPlanFilePlannerExitCode;
  readonly taskId?: AeosTaskId;
  readonly mode: TaskPlanFilePlannerWiringMode;
  readonly sourceFile?: string;
  readonly parse: TaskPlanFileParseStage;
  readonly mapping: TaskPlanFileMappingStage;
  readonly planner: TaskPlanFilePlannerStage;
  readonly safety: TaskPlanFileSafetyStage;
  readonly humanOutput?: TaskPlanFileHumanOutput;
  readonly jsonOutput?: TaskPlanFileJsonOutput;
  readonly issues: readonly TaskPlanFilePlannerWiringIssue[];
  readonly summary: TaskPlanFilePlannerWiringSummary;
}
