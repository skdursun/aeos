import type { AuditEventId } from "./audit.js";
import type { PolicyDecisionId } from "./policy.js";
import type { AeosTaskId } from "./tasks.js";
import type {
  AeosError,
  AeosId,
  FileChangeSummary,
  ISODateTime,
  JsonObject,
  Result,
  VerificationStatus,
  VerificationSummary,
} from "./types.js";

export type VerificationPlanId = AeosId;

export type VerificationCheckId = AeosId;

export type VerificationRunId = AeosId;

export type VerificationReportId = AeosId;

export type VerificationLevel =
  | "none"
  | "existence_check"
  | "format_check"
  | "static_check"
  | "unit_test"
  | "integration_test"
  | "smoke_test"
  | "security_check"
  | "manual_approval_required";

export type VerificationEvidenceKind =
  | "path"
  | "command"
  | "test"
  | "policy_decision"
  | "audit_event"
  | "manual_approval"
  | "summary"
  | "structured_data";

export type VerificationTargetType =
  | "task"
  | "file"
  | "directory"
  | "repository"
  | "package"
  | "cli_command"
  | "adapter"
  | "tool"
  | "mcp_tool"
  | "memory"
  | "policy"
  | "audit"
  | "documentation"
  | "scaffold"
  | "system";

export type VerificationMemoryWriteStatus =
  | "not_applicable"
  | "verified"
  | "failed"
  | "blocked"
  | "skipped";

export interface VerificationTarget {
  readonly type: VerificationTargetType;
  readonly id?: AeosId | string;
  readonly path?: string;
  readonly name?: string;
  readonly scope?: readonly string[];
  readonly metadata?: JsonObject;
}

export interface VerificationScope {
  readonly taskId?: AeosTaskId;
  readonly workspacePath?: string;
  readonly targets: readonly VerificationTarget[];
  readonly includePaths?: readonly string[];
  readonly excludePaths?: readonly string[];
  readonly loadedContext?: readonly string[];
  readonly allowedOperations?: readonly string[];
  readonly forbiddenOperations?: readonly string[];
  readonly metadata?: JsonObject;
}

export interface VerificationAuditReference {
  readonly auditRequired: boolean;
  readonly correlationId?: AeosId;
  readonly eventIds?: readonly AuditEventId[];
  readonly policyDecisionIds?: readonly PolicyDecisionId[];
  readonly taskId?: AeosTaskId;
  readonly summary?: string;
  readonly redactionsApplied?: boolean;
  readonly metadata?: JsonObject;
}

export interface VerificationEvidence {
  readonly kind: VerificationEvidenceKind;
  readonly summary: string;
  readonly references?: readonly string[];
  readonly affectedPaths?: readonly string[];
  readonly exitCode?: number;
  readonly auditReference?: VerificationAuditReference;
  readonly policyDecisionId?: PolicyDecisionId;
  readonly collectedAt?: ISODateTime;
  readonly data?: JsonObject;
}

export interface VerificationFailure {
  readonly code: string;
  readonly message: string;
  readonly severity: "warning" | "error" | "critical";
  readonly checkId?: VerificationCheckId;
  readonly target?: VerificationTarget;
  readonly evidence?: readonly VerificationEvidence[];
  readonly error?: AeosError;
  readonly metadata?: JsonObject;
}

export interface VerificationBlockedReason {
  readonly code: string;
  readonly message: string;
  readonly category:
    | "approval_required"
    | "missing_input"
    | "missing_dependency"
    | "environment_unavailable"
    | "out_of_scope"
    | "policy_denied"
    | "tool_unavailable"
    | "unknown";
  readonly checkId?: VerificationCheckId;
  readonly target?: VerificationTarget;
  readonly auditReference?: VerificationAuditReference;
  readonly metadata?: JsonObject;
}

export interface VerificationSkipReason {
  readonly code: string;
  readonly message: string;
  readonly category:
    | "not_required"
    | "excluded_by_scope"
    | "no_runtime_behavior"
    | "not_applicable"
    | "replaced_by_stronger_check";
  readonly checkId?: VerificationCheckId;
  readonly target?: VerificationTarget;
  readonly metadata?: JsonObject;
}

export interface VerificationRequirement {
  readonly id: AeosId;
  readonly level: VerificationLevel;
  readonly required: boolean;
  readonly scope: VerificationScope;
  readonly expectedEvidence: readonly string[];
  readonly command?: string;
  readonly policyRequired?: boolean;
  readonly auditRequired?: boolean;
  readonly manualApprovalRequired?: boolean;
  readonly metadata?: JsonObject;
}

export interface VerificationCheck {
  readonly id: VerificationCheckId;
  readonly name: string;
  readonly description?: string;
  readonly level: VerificationLevel;
  readonly target: readonly VerificationTarget[];
  readonly required: boolean;
  readonly expectedEvidence: readonly string[];
  readonly requirements?: readonly VerificationRequirement[];
  readonly blockedByApproval?: boolean;
  readonly policyDecisionIds?: readonly PolicyDecisionId[];
  readonly metadata?: JsonObject;
}

export interface VerificationProfile {
  readonly id: AeosId;
  readonly name: string;
  readonly description?: string;
  readonly levels: readonly VerificationLevel[];
  readonly requiredChecks: readonly VerificationCheck[];
  readonly optionalChecks?: readonly VerificationCheck[];
  readonly policyRequired: boolean;
  readonly auditRequired: boolean;
  readonly metadata?: JsonObject;
}

export interface VerificationPlan {
  readonly id: VerificationPlanId;
  readonly taskId: AeosTaskId;
  readonly name?: string;
  readonly scope: VerificationScope;
  readonly requiredChecks: readonly VerificationCheck[];
  readonly optionalChecks?: readonly VerificationCheck[];
  readonly profile?: VerificationProfile;
  readonly policyRequired: boolean;
  readonly auditRequired: boolean;
  readonly auditReference?: VerificationAuditReference;
  readonly createdAt?: ISODateTime;
  readonly metadata?: JsonObject;
}

export interface VerificationResult {
  readonly checkId: VerificationCheckId;
  readonly runId?: VerificationRunId;
  readonly level: VerificationLevel;
  readonly status: VerificationStatus;
  readonly summary: string;
  readonly evidence?: readonly VerificationEvidence[];
  readonly affectedPaths?: readonly string[];
  readonly exitCode?: number;
  readonly errorCode?: string;
  readonly failure?: VerificationFailure;
  readonly blockedReason?: VerificationBlockedReason;
  readonly skipReason?: VerificationSkipReason;
  readonly policyDecisionId?: PolicyDecisionId;
  readonly auditEventId?: AuditEventId;
  readonly metadata?: JsonObject;
}

export interface VerificationRun {
  readonly id: VerificationRunId;
  readonly planId: VerificationPlanId;
  readonly taskId: AeosTaskId;
  readonly actorId: string;
  readonly verifierId?: AeosId;
  readonly status: VerificationStatus;
  readonly startedAt: ISODateTime;
  readonly completedAt?: ISODateTime;
  readonly results: readonly VerificationResult[];
  readonly auditEventIds?: readonly AuditEventId[];
  readonly policyDecisionIds?: readonly PolicyDecisionId[];
  readonly metadata?: JsonObject;
}

export interface VerificationReport {
  readonly id: VerificationReportId;
  readonly taskId: AeosTaskId;
  readonly planId?: VerificationPlanId;
  readonly runId?: VerificationRunId;
  readonly status: VerificationStatus;
  readonly checkedScope: VerificationScope;
  readonly results: readonly VerificationResult[];
  readonly passed: readonly VerificationCheckId[];
  readonly failed: readonly VerificationCheckId[];
  readonly blocked: readonly VerificationCheckId[];
  readonly skipped: readonly VerificationCheckId[];
  readonly evidenceSummary: string;
  readonly policySummary?: string;
  readonly auditSummary?: string;
  readonly memoryWriteStatus?: VerificationMemoryWriteStatus;
  readonly fileChanges?: readonly FileChangeSummary[];
  readonly summary?: VerificationSummary;
  readonly auditReferences?: readonly VerificationAuditReference[];
  readonly generatedAt: ISODateTime;
  readonly metadata?: JsonObject;
}

export type VerificationPlanResult = Result<VerificationPlan, AeosError>;

export type VerificationRunResult = Result<VerificationReport, AeosError>;
