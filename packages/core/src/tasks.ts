import type {
  AeosId,
  FileChangeSummary,
  HandoffSummary,
  ISODateTime,
  JsonObject,
  PermissionLevel,
  RiskClass,
  TaskStatus,
  VerificationStatus,
  VerificationSummary,
} from "./types.js";

export type AeosTaskId = AeosId;

export type TaskTitle = string;

export type TaskPurpose = string;

export type TaskExecutionMode =
  | "planning"
  | "documentation"
  | "scaffold"
  | "code"
  | "verification"
  | "maintenance";

export type TaskAllowedOperation =
  | "read_context"
  | "create_file"
  | "modify_file"
  | "run_verification"
  | "check_git_status"
  | "request_approval";

export type TaskForbiddenOperation =
  | "read_unlisted_context"
  | "modify_unlisted_file"
  | "rename_file"
  | "delete_file"
  | "install_dependency"
  | "change_package_config"
  | "deploy"
  | "push_git"
  | "run_destructive_command"
  | "continue_next_task";

export interface TaskContextRule {
  readonly path: string;
  readonly reason?: string;
  readonly required: boolean;
}

export interface TaskContextLoad {
  readonly load: readonly TaskContextRule[];
  readonly doNotLoad: readonly TaskContextRule[];
  readonly notes?: readonly string[];
}

export interface TaskFileBoundary {
  readonly filesToModify: readonly string[];
  readonly filesNotToTouch: readonly string[];
  readonly allowGeneratedFiles: boolean;
  readonly requireStopOnBoundaryConflict: boolean;
}

export interface TaskStep {
  readonly order: number;
  readonly instruction: string;
  readonly required: boolean;
  readonly expectedOutcome?: string;
}

export interface TaskVerificationRequirement {
  readonly command?: string;
  readonly level:
    | "none"
    | "existence_check"
    | "format_check"
    | "static_check"
    | "unit_test"
    | "integration_test"
    | "smoke_test"
    | "security_check"
    | "manual_approval_required";
  readonly required: boolean;
  readonly scope: readonly string[];
  readonly expectedEvidence: readonly string[];
}

export interface TaskStopCondition {
  readonly description: string;
  readonly stopAfterCompletion: boolean;
  readonly blockedReasons?: readonly string[];
}

export interface TaskRiskProfile {
  readonly riskClass: RiskClass;
  readonly permissionLevel: PermissionLevel;
  readonly requiresApproval: boolean;
  readonly sensitiveScopes?: readonly string[];
  readonly rationale?: string;
}

export interface TaskModelRecommendation {
  readonly purpose: string;
  readonly requiredCapabilities: readonly string[];
  readonly preferredExecutionMode?: TaskExecutionMode;
  readonly constraints?: readonly string[];
}

export interface AeosTask {
  readonly id: AeosTaskId;
  readonly title: TaskTitle;
  readonly purpose: TaskPurpose;
  readonly status: TaskStatus;
  readonly executionMode: TaskExecutionMode;
  readonly context: TaskContextLoad;
  readonly fileBoundary: TaskFileBoundary;
  readonly allowedOperations: readonly TaskAllowedOperation[];
  readonly forbiddenOperations: readonly TaskForbiddenOperation[];
  readonly steps: readonly TaskStep[];
  readonly verification: readonly TaskVerificationRequirement[];
  readonly stopCondition: TaskStopCondition;
  readonly riskProfile?: TaskRiskProfile;
  readonly modelRecommendation?: TaskModelRecommendation;
  readonly createdAt?: ISODateTime;
  readonly updatedAt?: ISODateTime;
  readonly metadata?: JsonObject;
}

export interface TaskContextUpdateSnippet {
  readonly completedTaskId: AeosTaskId;
  readonly result: TaskStatus;
  readonly summary: string;
  readonly updatedFiles: readonly string[];
  readonly nextSuggestedTask?: AeosTaskId;
  readonly blockers?: readonly string[];
}

export interface TaskHandoffReport extends HandoffSummary {
  readonly workspacePath: string;
  readonly filesCreated: readonly string[];
  readonly filesModified: readonly string[];
  readonly verificationRun: readonly string[];
  readonly verificationResult: VerificationSummary;
  readonly contextUpdateSnippet: TaskContextUpdateSnippet;
}

export interface TaskValidationIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: "error" | "warning";
  readonly path?: string;
  readonly field?: string;
}

export interface TaskValidationResult {
  readonly taskId?: AeosTaskId;
  readonly status: VerificationStatus;
  readonly valid: boolean;
  readonly issues: readonly TaskValidationIssue[];
  readonly fileBoundary?: TaskFileBoundary;
  readonly expectedChanges?: readonly FileChangeSummary[];
}
