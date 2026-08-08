import type {
  AgenticRunnerPlanningDataReference,
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
  TaskPlanFilePlannerExitCode,
  TaskPlanFilePlannerWiringStatus,
} from "./task-plan-file-planner-wiring.js";
import type {
  TaskPlanInputFileRequest,
  TaskPlanInputIssue,
  TaskPlanInputResult,
  TaskPlanInputValidationStatus,
} from "./task-plan-input.js";
import type { AeosTaskId } from "./tasks.js";

export type CliTaskPlanPlannerIntegrationMode =
  | "plan"
  | "dry_run"
  | "validate"
  | "unknown";

export type CliTaskPlanPlannerIntegrationStatus =
  | TaskPlanFilePlannerWiringStatus
  | "wiring_failed";

export type CliTaskPlanExitCode =
  | TaskPlanFilePlannerExitCode
  | "wiring_failure";

export type CliTaskPlanPlannerIntegrationIssueSeverity =
  | "error"
  | "warning"
  | "info"
  | "critical";

export type CliTaskPlanPlannerIntegrationIssuePhase =
  | "cli"
  | "input"
  | "parse"
  | "validation"
  | "mapping"
  | "wiring"
  | "planner"
  | "safety"
  | "output"
  | "unknown";

export interface CliTaskPlanPlannerIntegrationIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: CliTaskPlanPlannerIntegrationIssueSeverity;
  readonly phase: CliTaskPlanPlannerIntegrationIssuePhase;
  readonly taskId?: AeosTaskId;
  readonly sourceFile?: string;
  readonly field?: string;
  readonly sourceIssue?: TaskPlanInputIssue;
  readonly sourceReference?: AgenticRunnerPlanningReference;
  readonly metadata?: Record<string, unknown>;
}

export interface CliTaskPlanJsonOnlyBehavior {
  readonly jsonRequested: boolean;
  readonly suppressHumanOutput: boolean;
  readonly validJsonOnly: boolean;
  readonly noProsePrefix: true;
  readonly noProseSuffix: true;
  readonly noStackTraces: true;
  readonly noRawEngineErrors: true;
  readonly deterministicIssues: boolean;
}

export interface CliTaskPlanPlannerIntegrationOptions {
  readonly json: boolean;
  readonly failClosedOnParserFailure: boolean;
  readonly failClosedOnValidationFailure: boolean;
  readonly failClosedOnUnsupportedMapping: boolean;
  readonly failClosedWithoutRunnerPlanningInput: boolean;
  readonly failClosedWithoutVerifier: boolean;
  readonly failClosedWithoutNoExecution: boolean;
  readonly failClosedWithoutNoWrites: boolean;
  readonly failClosedOnUnsafeMetadata: boolean;
  readonly suppressHumanOutputInJsonMode: boolean;
  readonly deterministicIssues: boolean;
}

export interface CliTaskPlanPlannerIntegrationInput {
  readonly argv?: readonly string[];
  readonly command?: readonly string[];
  readonly taskFile: string;
  readonly json: boolean;
  readonly mode: CliTaskPlanPlannerIntegrationMode;
  readonly parserRequest?: TaskPlanInputFileRequest;
  readonly parserResult?: TaskPlanInputResult;
  readonly parserResultReference?: AgenticRunnerPlanningReference;
  readonly mappingOptions?: TaskContractMappingOptions;
  readonly mappingResult?: TaskContractMappingResult;
  readonly mappingResultReference?: AgenticRunnerPlanningReference;
  readonly wiringResultReference?: AgenticRunnerPlanningReference;
  readonly plannerDependencyReference?: AgenticRunnerPlanningReference;
  readonly noExecution: true;
  readonly noWrites: true;
}

export interface CliTaskPlanParserIntegrationStage {
  readonly attempted: boolean;
  readonly ok: boolean;
  readonly sourceFile?: string;
  readonly pathOk: boolean;
  readonly parseOk: boolean;
  readonly validationStatus?: TaskPlanInputValidationStatus;
  readonly validationCompatible?: boolean;
  readonly parserResult?: TaskPlanInputResult;
  readonly parserResultReference?: AgenticRunnerPlanningReference;
  readonly parsedTaskData?: TaskPlanInputResult["validation"]["task"];
  readonly parsedTaskReference?: AgenticRunnerPlanningReference;
  readonly issues: readonly CliTaskPlanPlannerIntegrationIssue[];
}

export interface CliTaskPlanMappingIntegrationStage {
  readonly attempted: boolean;
  readonly ok: boolean;
  readonly status: TaskContractMappingStatus | "not_attempted" | "unknown";
  readonly mappingResult?: TaskContractMappingResult;
  readonly mappingResultReference?: AgenticRunnerPlanningReference;
  readonly runnerPlanningInput?: AgenticRunnerPlanningInput;
  readonly runnerPlanningInputReference?: AgenticRunnerPlanningReference;
  readonly runnerPlanningInputData?: AgenticRunnerPlanningDataReference<AgenticRunnerPlanningInput>;
  readonly runnerPlanningInputAvailable: boolean;
  readonly noExecution: true;
  readonly noWrites: true;
  readonly verifierRequired: boolean;
  readonly completionGatedByVerifier: boolean;
  readonly issues: readonly CliTaskPlanPlannerIntegrationIssue[];
}

export interface CliTaskPlanWiringIntegrationStage {
  readonly attempted: boolean;
  readonly ok: boolean;
  readonly status:
    | "not_attempted"
    | "wired"
    | "blocked"
    | "failed"
    | "unknown";
  readonly wiringResultReference?: AgenticRunnerPlanningReference;
  readonly wiringResultData?: AgenticRunnerPlanningDataReference<unknown>;
  readonly plannerDependencyInjected: boolean;
  readonly plannerInvocationAllowed: boolean;
  readonly dependencyInjectedPlannerOnly: true;
  readonly topLevelPlannerInputBypassAllowed: false;
  readonly issues: readonly CliTaskPlanPlannerIntegrationIssue[];
}

export interface CliTaskPlanPlannerIntegrationStage {
  readonly attempted: boolean;
  readonly ok: boolean;
  readonly status:
    | "not_attempted"
    | "planned"
    | "blocked"
    | "failed"
    | "unknown";
  readonly plannerDependencyReference?: AgenticRunnerPlanningReference;
  readonly planningResult?: AgenticRunnerPlanningResult;
  readonly planningResultReference?: AgenticRunnerPlanningReference;
  readonly planningResultData?: AgenticRunnerPlanningDataReference<AgenticRunnerPlanningResult>;
  readonly planStepCount?: number;
  readonly issues: readonly CliTaskPlanPlannerIntegrationIssue[];
}

export interface CliTaskPlanSafetyIntegrationStage {
  readonly cliPlanCommandMayRunParserMapperWiringPlannerLater: boolean;
  readonly executionEnabled: false;
  readonly adapterCalls: false;
  readonly auditWrites: false;
  readonly verifierRun: false;
  readonly persistence: false;
  readonly filesystemMutation: false;
  readonly completedStateCreated: false;
  readonly noExecution: true;
  readonly noWrites: true;
  readonly failClosedWithoutRunnerPlanningInput: boolean;
  readonly failClosedWithoutNoExecution: boolean;
  readonly failClosedWithoutNoWrites: boolean;
  readonly failClosedWithoutVerifierRequired: boolean;
  readonly failClosedWithoutCompletionGate: boolean;
  readonly failClosedOnUnsafeMetadata: boolean;
  readonly dependencyInjectedPlannerOnly: true;
  readonly topLevelPlannerInputBypassAllowed: false;
  readonly issues: readonly CliTaskPlanPlannerIntegrationIssue[];
}

export interface CliTaskPlanHumanRenderModel {
  readonly title: string;
  readonly taskId?: AeosTaskId;
  readonly sourceFile?: string;
  readonly mode: CliTaskPlanPlannerIntegrationMode;
  readonly parsed: boolean;
  readonly mapping: TaskContractMappingStatus | "not_attempted" | "unknown";
  readonly planning: CliTaskPlanPlannerIntegrationStage["status"];
  readonly workItems: number;
  readonly batches: number;
  readonly steps: number;
  readonly policyRequired: boolean;
  readonly approvalRequired: boolean;
  readonly verifierRequired: boolean;
  readonly completionGatedByVerifier: boolean;
  readonly auditExpected: boolean;
  readonly realExecution: false;
  readonly adapterCalls: false;
  readonly auditWrites: false;
  readonly verifierRun: false;
  readonly persistence: false;
  readonly filesystemMutation: false;
  readonly completedStateCreated: false;
  readonly issues: readonly CliTaskPlanPlannerIntegrationIssue[];
}

export interface CliTaskPlanJsonRenderModel {
  readonly ok: boolean;
  readonly status: CliTaskPlanPlannerIntegrationStatus;
  readonly exitCode: CliTaskPlanExitCode;
  readonly taskId?: AeosTaskId;
  readonly mode: CliTaskPlanPlannerIntegrationMode;
  readonly sourceFile?: string;
  readonly parse: CliTaskPlanParserIntegrationStage;
  readonly mapping: CliTaskPlanMappingIntegrationStage;
  readonly wiring: CliTaskPlanWiringIntegrationStage;
  readonly plan: CliTaskPlanPlannerIntegrationStage;
  readonly safety: CliTaskPlanSafetyIntegrationStage;
  readonly issues: readonly CliTaskPlanPlannerIntegrationIssue[];
  readonly summary: CliTaskPlanPlannerIntegrationSummary;
}

export interface CliTaskPlanPlannerIntegrationSummary {
  readonly parsed: boolean;
  readonly mapped: boolean;
  readonly wired: boolean;
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
  readonly runnerPlanningInputAvailable: boolean;
  readonly plannerDependencyInjected: boolean;
  readonly plannerInvocationAllowed: boolean;
}

export interface CliTaskPlanPlannerIntegrationResult {
  readonly ok: boolean;
  readonly status: CliTaskPlanPlannerIntegrationStatus;
  readonly exitCode: CliTaskPlanExitCode;
  readonly taskId?: AeosTaskId;
  readonly mode: CliTaskPlanPlannerIntegrationMode;
  readonly sourceFile?: string;
  readonly parser: CliTaskPlanParserIntegrationStage;
  readonly mapping: CliTaskPlanMappingIntegrationStage;
  readonly wiring: CliTaskPlanWiringIntegrationStage;
  readonly planner: CliTaskPlanPlannerIntegrationStage;
  readonly safety: CliTaskPlanSafetyIntegrationStage;
  readonly humanOutput?: CliTaskPlanHumanRenderModel;
  readonly jsonOutput?: CliTaskPlanJsonRenderModel;
  readonly jsonOnly: CliTaskPlanJsonOnlyBehavior;
  readonly issues: readonly CliTaskPlanPlannerIntegrationIssue[];
  readonly summary: CliTaskPlanPlannerIntegrationSummary;
}
