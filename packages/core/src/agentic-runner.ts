import type {
  AdapterKind,
  AdapterResultStatus,
  ApprovalState,
} from "./adapters.js";
import type {
  AgenticAuditEventId,
  AgenticCoverageStatus,
  AgenticISODateTime,
  AgenticLifecycleIssueCategory,
  AgenticLifecycleIssueSeverity,
  AgenticTaskId,
  AgenticTaskLifecycle,
  AgenticWorkBatch,
  AgenticWorkBatchId,
  AgenticWorkItem,
  AgenticWorkItemId,
} from "./agentic-lifecycle.js";
import type {
  AgenticCoverageVerifierIssue,
  AgenticCoverageVerificationStatus,
} from "./agentic-coverage-verifier.js";
import type { AuditCorrelationId, AuditEventId } from "./audit.js";
import type { PolicyDecision, PolicyDecisionId } from "./policy.js";
import type { AeosTask } from "./tasks.js";
import type {
  AeosId,
  JsonObject,
  PermissionLevel,
  PolicyDecisionStatus,
} from "./types.js";
import type { VerificationReportId } from "./verification.js";

export type AgenticRunnerMode =
  | "plan"
  | "dry_run"
  | "execute"
  | "resume"
  | "verify"
  | "unknown";

export type AgenticRunnerState =
  | "planned"
  | "waiting_for_approval"
  | "running"
  | "blocked"
  | "failed"
  | "incomplete"
  | "verified"
  | "completed"
  | "cancelled"
  | "unknown";

export type AgenticRunnerStepState =
  | "pending"
  | "approved"
  | "running"
  | "completed"
  | "failed"
  | "blocked"
  | "skipped"
  | "retryable"
  | "verified";

export type AgenticRunnerPolicyGateStatus =
  | "not_evaluated"
  | "evaluated"
  | "waiting_for_approval"
  | "denied"
  | "failed"
  | "unknown";

export type AgenticRunnerPolicyGateResult =
  | "allowed"
  | "denied"
  | "needs_approval"
  | "unknown";

export type AgenticRunnerAuditStatus =
  | "not_required"
  | "planned"
  | "partial"
  | "complete"
  | "missing"
  | "failed"
  | "unknown";

export type AgenticRunnerVerifierStatus =
  | "not_required"
  | "pending"
  | "running"
  | "verified"
  | "failed"
  | "blocked"
  | "unknown";

export type AgenticRunnerTaskContractReference =
  | {
      readonly kind: "reference";
      readonly id: AgenticTaskId;
      readonly path?: string;
      readonly version?: string;
      readonly metadata?: JsonObject;
    }
  | {
      readonly kind: "metadata";
      readonly task: AeosTask;
      readonly metadata?: JsonObject;
    };

export interface AgenticRunnerOptions {
  readonly dryRun?: boolean;
  readonly requireHumanApproval?: boolean;
  readonly maxWorkItems?: number;
  readonly maxBatchSize?: number;
  readonly maxAttempts?: number;
  readonly timeoutMs?: number;
  readonly outputMode?: "human" | "json" | "summary";
  readonly metadata?: JsonObject;
}

export interface AgenticRunnerAdapterReference {
  readonly adapterId: AeosId;
  readonly kind: AdapterKind;
  readonly capabilityNames?: readonly string[];
  readonly status?: AdapterResultStatus | "not_run" | "unknown";
  readonly attemptId?: AeosId;
  readonly auditEventIds?: readonly AuditEventId[];
  readonly metadata?: JsonObject;
}

export interface AgenticRunnerExecutionBoundary {
  readonly modelAdapter?: AgenticRunnerAdapterReference;
  readonly toolAdapter?: AgenticRunnerAdapterReference;
  readonly allowedOperations: readonly string[];
  readonly deniedOperations: readonly string[];
  readonly permissionMode: PermissionLevel;
  readonly humanApprovalRequired: boolean;
  readonly approvalState?: ApprovalState;
  readonly policyDecisionIds?: readonly PolicyDecisionId[];
  readonly metadata?: JsonObject;
}

export interface AgenticRunnerIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: AgenticLifecycleIssueSeverity;
  readonly category: AgenticLifecycleIssueCategory;
  readonly stepId?: string;
  readonly workItemId?: AgenticWorkItemId;
  readonly batchId?: AgenticWorkBatchId;
  readonly adapterId?: AeosId;
  readonly policyDecisionId?: PolicyDecisionId;
  readonly auditEventIds?: readonly AgenticAuditEventId[];
  readonly retryable?: boolean;
  readonly createdAt?: AgenticISODateTime;
  readonly metadata?: JsonObject;
}

export interface AgenticRunnerPolicyGate {
  readonly status: AgenticRunnerPolicyGateStatus;
  readonly result: AgenticRunnerPolicyGateResult;
  readonly decisionId?: PolicyDecisionId;
  readonly decision?: PolicyDecision;
  readonly policyStatus?: PolicyDecisionStatus;
  readonly reasons: readonly string[];
  readonly issues: readonly AgenticRunnerIssue[];
  readonly auditEventIds?: readonly AuditEventId[];
  readonly evaluatedAt?: AgenticISODateTime;
}

export interface AgenticRunnerAuditHandoff {
  readonly plannedAuditEventIds: readonly AgenticAuditEventId[];
  readonly emittedAuditEventIds: readonly AgenticAuditEventId[];
  readonly missingAuditEventIds: readonly AgenticAuditEventId[];
  readonly lastAuditEventId?: AgenticAuditEventId;
  readonly auditStatus: AgenticRunnerAuditStatus;
  readonly correlationId?: AuditCorrelationId;
}

export interface AgenticRunnerVerifierHandoff {
  readonly verifierRequired: boolean;
  readonly verifierResultReference?: VerificationReportId | string;
  readonly verifierStatus: AgenticRunnerVerifierStatus;
  readonly coverageStatus: AgenticCoverageStatus | AgenticCoverageVerificationStatus;
  readonly verifierIssues: readonly AgenticCoverageVerifierIssue[];
  readonly auditEventIds?: readonly AgenticAuditEventId[];
}

export interface AgenticRunnerResumeState {
  readonly resumeCursor?: string;
  readonly nextStepId?: string;
  readonly nextBatchId?: AgenticWorkBatchId;
  readonly pendingWorkItemIds: readonly AgenticWorkItemId[];
  readonly retryableWorkItemIds: readonly AgenticWorkItemId[];
  readonly updatedAt: AgenticISODateTime;
}

export interface AgenticRunnerStep {
  readonly id: string;
  readonly order: number;
  readonly title: string;
  readonly state: AgenticRunnerStepState;
  readonly workItemIds: readonly AgenticWorkItemId[];
  readonly batchId?: AgenticWorkBatchId;
  readonly requiredApprovalIds?: readonly AeosId[];
  readonly requiredPolicyDecisionIds?: readonly PolicyDecisionId[];
  readonly expectedAuditEventIds?: readonly AgenticAuditEventId[];
  readonly adapterReferences?: readonly AgenticRunnerAdapterReference[];
  readonly issues?: readonly AgenticRunnerIssue[];
  readonly updatedAt?: AgenticISODateTime;
  readonly metadata?: JsonObject;
}

export interface AgenticRunnerPlan {
  readonly steps: readonly AgenticRunnerStep[];
  readonly expectedWorkItemCount: number;
  readonly expectedBatchCount: number;
  readonly requiredApprovals: readonly AeosId[];
  readonly requiredPolicyChecks: readonly PolicyDecisionId[];
  readonly expectedAuditEvents: readonly AgenticAuditEventId[];
  readonly verifierRequired: boolean;
}

export interface AgenticRunnerInput {
  readonly taskId: AgenticTaskId;
  readonly task: AgenticRunnerTaskContractReference;
  readonly lifecycle?: AgenticTaskLifecycle;
  readonly workItems?: readonly AgenticWorkItem[];
  readonly batches?: readonly AgenticWorkBatch[];
  readonly mode: AgenticRunnerMode;
  readonly options?: AgenticRunnerOptions;
  readonly policyGate?: AgenticRunnerPolicyGate;
  readonly adapterReferences?: readonly AgenticRunnerAdapterReference[];
  readonly auditReferences?: readonly AgenticRunnerAuditHandoff[];
  readonly verifierHandoff?: AgenticRunnerVerifierHandoff;
  readonly resumeState?: AgenticRunnerResumeState;
  readonly metadata?: JsonObject;
}

export interface AgenticRunnerSummary {
  readonly plannedSteps: number;
  readonly completedSteps: number;
  readonly failedSteps: number;
  readonly blockedSteps: number;
  readonly retryableSteps: number;
  readonly expectedWorkItems: number;
  readonly completedWorkItems: number;
  readonly pendingWorkItems: number;
  readonly retryableWorkItems: number;
  readonly auditEventsEmitted: number;
  readonly verifierIssueCount: number;
  readonly issueCount: number;
}

export interface AgenticRunnerResult {
  readonly ok: boolean;
  readonly taskId: AgenticTaskId;
  readonly state: AgenticRunnerState;
  readonly mode: AgenticRunnerMode;
  readonly plan: AgenticRunnerPlan;
  readonly lifecycle?: AgenticTaskLifecycle;
  readonly policy: AgenticRunnerPolicyGate;
  readonly executionBoundary: AgenticRunnerExecutionBoundary;
  readonly audit: AgenticRunnerAuditHandoff;
  readonly verifier: AgenticRunnerVerifierHandoff;
  readonly resume?: AgenticRunnerResumeState;
  readonly issues: readonly AgenticRunnerIssue[];
  readonly summary: AgenticRunnerSummary;
}
