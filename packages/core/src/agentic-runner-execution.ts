export type AgenticRunnerExecutionId = string;

export type AgenticRunnerExecutionTaskId = string;

export type AgenticRunnerExecutionStepId = string;

export type AgenticRunnerExecutionBatchId = string;

export type AgenticRunnerExecutionWorkItemId = string;

export type AgenticRunnerExecutionAdapterCallId = string;

export type AgenticRunnerExecutionAdapterId = string;

export type AgenticRunnerExecutionAuditEventId = string;

export type AgenticRunnerExecutionISODateTime = string;

export type AgenticRunnerExecutionJsonObject = Record<string, unknown>;

export type AgenticRunnerExecutionMode =
  | "dry_run"
  | "execute"
  | "resume"
  | "verify"
  | "unknown";

export type AgenticRunnerExecutionState =
  | "not_started"
  | "preflight"
  | "waiting_for_approval"
  | "running"
  | "partially_completed"
  | "retryable"
  | "blocked"
  | "failed"
  | "verification_required"
  | "verified"
  | "completed"
  | "cancelled"
  | "unknown";

export type AgenticRunnerStepExecutionState =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "blocked"
  | "skipped"
  | "retryable"
  | "verified"
  | "unknown";

export type AgenticRunnerBatchExecutionState =
  | "pending"
  | "running"
  | "completed"
  | "partially_completed"
  | "failed"
  | "blocked"
  | "retryable"
  | "skipped"
  | "unknown";

export type AgenticRunnerWorkItemOutcomeState =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "skipped"
  | "retryable"
  | "verified"
  | "unknown";

export type AgenticRunnerAdapterCallKind =
  | "model"
  | "tool"
  | "unknown";

export type AgenticRunnerAdapterCallStatus =
  | "not_started"
  | "running"
  | "ok"
  | "partial"
  | "blocked"
  | "unsupported"
  | "timeout"
  | "failed"
  | "cancelled"
  | "unknown";

export type AgenticRunnerPolicyExecutionStatus =
  | "not_checked"
  | "checking"
  | "checked"
  | "failed"
  | "unknown";

export type AgenticRunnerPolicyExecutionDecision =
  | "allowed"
  | "denied"
  | "needs_approval"
  | "unknown";

export type AgenticRunnerApprovalExecutionStatus =
  | "not_required"
  | "pending"
  | "requested"
  | "approved"
  | "denied"
  | "expired"
  | "revoked"
  | "unknown";

export type AgenticRunnerAuditExecutionStatus =
  | "not_required"
  | "pending"
  | "partial"
  | "complete"
  | "missing"
  | "failed"
  | "unknown";

export type AgenticRunnerVerifierExecutionStatus =
  | "not_required"
  | "pending"
  | "running"
  | "verified"
  | "incomplete"
  | "failed"
  | "blocked"
  | "unknown";

export type AgenticRunnerExecutionCoverageStatus =
  | "satisfied"
  | "incomplete"
  | "failed"
  | "blocked"
  | "unknown";

export type AgenticRunnerExecutionIssueSeverity =
  | "info"
  | "warning"
  | "error"
  | "critical";

export type AgenticRunnerExecutionIssueCategory =
  | "scope_failure"
  | "policy_failure"
  | "execution_failure"
  | "verification_failure"
  | "coverage_failure"
  | "artifact_failure"
  | "adapter_failure"
  | "audit_failure"
  | "inventory_failure"
  | "resume_failure"
  | "approval_failure"
  | "unknown";

export interface AgenticRunnerExecutionReference {
  readonly id: string;
  readonly path?: string;
  readonly url?: string;
  readonly version?: string;
  readonly metadata?: AgenticRunnerExecutionJsonObject;
}

export type AgenticRunnerExecutionDataReference<
  TData = AgenticRunnerExecutionJsonObject,
> =
  | {
      readonly kind: "reference";
      readonly reference: AgenticRunnerExecutionReference;
    }
  | {
      readonly kind: "data";
      readonly data: TData;
      readonly reference?: AgenticRunnerExecutionReference;
    };

export interface AgenticRunnerExecutionOptions {
  readonly requirePolicy?: boolean;
  readonly requireApproval?: boolean;
  readonly requireAudit?: boolean;
  readonly requireVerifier?: boolean;
  readonly completionGatedByVerifier?: boolean;
  readonly maxWorkItems?: number;
  readonly maxBatchSize?: number;
  readonly maxAttempts?: number;
  readonly timeoutMs?: number;
  readonly outputMode?: "human" | "json" | "summary";
  readonly metadata?: AgenticRunnerExecutionJsonObject;
}

export interface AgenticRunnerExecutionIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: AgenticRunnerExecutionIssueSeverity;
  readonly category: AgenticRunnerExecutionIssueCategory;
  readonly stepId?: AgenticRunnerExecutionStepId;
  readonly batchId?: AgenticRunnerExecutionBatchId;
  readonly workItemId?: AgenticRunnerExecutionWorkItemId;
  readonly adapterCallId?: AgenticRunnerExecutionAdapterCallId;
  readonly adapterId?: AgenticRunnerExecutionAdapterId;
  readonly policyGateId?: string;
  readonly approvalReference?: AgenticRunnerExecutionReference;
  readonly auditEventIds?: readonly AgenticRunnerExecutionAuditEventId[];
  readonly retryable?: boolean;
  readonly createdAt?: AgenticRunnerExecutionISODateTime;
  readonly metadata?: AgenticRunnerExecutionJsonObject;
}

export interface AgenticRunnerWorkItemOutcome {
  readonly workItemId: AgenticRunnerExecutionWorkItemId;
  readonly batchId?: AgenticRunnerExecutionBatchId;
  readonly state: AgenticRunnerWorkItemOutcomeState;
  readonly observedAt?: AgenticRunnerExecutionISODateTime;
  readonly sourceReference?: AgenticRunnerExecutionReference;
  readonly outputArtifactIds?: readonly string[];
  readonly errorCode?: string;
  readonly errorMessage?: string;
  readonly retryableReason?: string;
  readonly issues: readonly AgenticRunnerExecutionIssue[];
  readonly metadata?: AgenticRunnerExecutionJsonObject;
}

export interface AgenticRunnerAdapterCallRecord {
  readonly callId: AgenticRunnerExecutionAdapterCallId;
  readonly kind: AgenticRunnerAdapterCallKind;
  readonly adapterId: AgenticRunnerExecutionAdapterId;
  readonly operation: string;
  readonly status: AgenticRunnerAdapterCallStatus;
  readonly startedAt?: AgenticRunnerExecutionISODateTime;
  readonly completedAt?: AgenticRunnerExecutionISODateTime;
  readonly inputReference?: AgenticRunnerExecutionReference;
  readonly outputReference?: AgenticRunnerExecutionReference;
  readonly observedOutcomeReference?: AgenticRunnerExecutionReference;
  readonly auditEventIds?: readonly AgenticRunnerExecutionAuditEventId[];
  readonly issues: readonly AgenticRunnerExecutionIssue[];
  readonly metadata?: AgenticRunnerExecutionJsonObject;
  readonly observationOnly: true;
  readonly completionAuthority: false;
}

export interface AgenticRunnerStepExecution {
  readonly stepId: AgenticRunnerExecutionStepId;
  readonly stepKind: string;
  readonly state: AgenticRunnerStepExecutionState;
  readonly startedAt?: AgenticRunnerExecutionISODateTime;
  readonly completedAt?: AgenticRunnerExecutionISODateTime;
  readonly observedOutcomes: readonly AgenticRunnerWorkItemOutcome[];
  readonly adapterCallIds: readonly AgenticRunnerExecutionAdapterCallId[];
  readonly auditEventIds: readonly AgenticRunnerExecutionAuditEventId[];
  readonly issues: readonly AgenticRunnerExecutionIssue[];
  readonly metadata?: AgenticRunnerExecutionJsonObject;
}

export interface AgenticRunnerBatchExecution {
  readonly batchId: AgenticRunnerExecutionBatchId;
  readonly workItemIds: readonly AgenticRunnerExecutionWorkItemId[];
  readonly state: AgenticRunnerBatchExecutionState;
  readonly startedAt?: AgenticRunnerExecutionISODateTime;
  readonly completedAt?: AgenticRunnerExecutionISODateTime;
  readonly expectedItemCount: number;
  readonly observedCompletedCount: number;
  readonly observedFailedCount: number;
  readonly observedSkippedCount: number;
  readonly observedRetryableCount: number;
  readonly issues: readonly AgenticRunnerExecutionIssue[];
  readonly metadata?: AgenticRunnerExecutionJsonObject;
}

export interface AgenticRunnerPolicyExecution {
  readonly policyGateId: string;
  readonly status: AgenticRunnerPolicyExecutionStatus;
  readonly decisionReference?: AgenticRunnerExecutionReference;
  readonly decision: AgenticRunnerPolicyExecutionDecision;
  readonly checkedAt?: AgenticRunnerExecutionISODateTime;
  readonly auditEventIds?: readonly AgenticRunnerExecutionAuditEventId[];
  readonly issues: readonly AgenticRunnerExecutionIssue[];
  readonly metadata?: AgenticRunnerExecutionJsonObject;
}

export interface AgenticRunnerApprovalExecution {
  readonly approvalRequired: boolean;
  readonly approvalStatus: AgenticRunnerApprovalExecutionStatus;
  readonly requestedAt?: AgenticRunnerExecutionISODateTime;
  readonly decidedAt?: AgenticRunnerExecutionISODateTime;
  readonly approverReference?: AgenticRunnerExecutionReference;
  readonly approvalReference?: AgenticRunnerExecutionReference;
  readonly auditEventIds?: readonly AgenticRunnerExecutionAuditEventId[];
  readonly issues: readonly AgenticRunnerExecutionIssue[];
  readonly metadata?: AgenticRunnerExecutionJsonObject;
}

export interface AgenticRunnerAuditExecutionHandoff {
  readonly expectedAuditEventIds: readonly AgenticRunnerExecutionAuditEventId[];
  readonly emittedAuditEventIds: readonly AgenticRunnerExecutionAuditEventId[];
  readonly missingAuditEventIds: readonly AgenticRunnerExecutionAuditEventId[];
  readonly lastAuditEventId?: AgenticRunnerExecutionAuditEventId;
  readonly auditStatus: AgenticRunnerAuditExecutionStatus;
  readonly auditReference?: AgenticRunnerExecutionReference;
  readonly issues: readonly AgenticRunnerExecutionIssue[];
  readonly metadata?: AgenticRunnerExecutionJsonObject;
}

export interface AgenticRunnerVerifierExecutionHandoff {
  readonly verifierRequired: boolean;
  readonly verifierStatus: AgenticRunnerVerifierExecutionStatus;
  readonly verifierResultReference?: AgenticRunnerExecutionReference;
  readonly coverageStatus: AgenticRunnerExecutionCoverageStatus;
  readonly checkedAt?: AgenticRunnerExecutionISODateTime;
  readonly completionGatedByVerifier: true;
  readonly completionGateSatisfied: boolean;
  readonly auditEventIds?: readonly AgenticRunnerExecutionAuditEventId[];
  readonly issues: readonly AgenticRunnerExecutionIssue[];
  readonly metadata?: AgenticRunnerExecutionJsonObject;
}

export interface AgenticRunnerResumeUpdate {
  readonly resumeCursorReference?: AgenticRunnerExecutionReference;
  readonly nextStepId?: AgenticRunnerExecutionStepId;
  readonly nextBatchId?: AgenticRunnerExecutionBatchId;
  readonly pendingWorkItemIds: readonly AgenticRunnerExecutionWorkItemId[];
  readonly retryableWorkItemIds: readonly AgenticRunnerExecutionWorkItemId[];
  readonly updatedAt: AgenticRunnerExecutionISODateTime;
  readonly metadata?: AgenticRunnerExecutionJsonObject;
}

export interface AgenticRunnerExecutionInput {
  readonly taskId: AgenticRunnerExecutionTaskId;
  readonly runnerPlan?: AgenticRunnerExecutionDataReference;
  readonly lifecycle?: AgenticRunnerExecutionDataReference;
  readonly plannedSteps: readonly AgenticRunnerStepExecution[];
  readonly plannedBatches: readonly AgenticRunnerBatchExecution[];
  readonly plannedWorkItems: readonly AgenticRunnerWorkItemOutcome[];
  readonly mode: AgenticRunnerExecutionMode;
  readonly options?: AgenticRunnerExecutionOptions;
  readonly policy?: AgenticRunnerPolicyExecution;
  readonly approval?: AgenticRunnerApprovalExecution;
  readonly adapterCalls?: readonly AgenticRunnerAdapterCallRecord[];
  readonly audit?: AgenticRunnerAuditExecutionHandoff;
  readonly verifier?: AgenticRunnerVerifierExecutionHandoff;
  readonly resume?: AgenticRunnerResumeUpdate;
  readonly metadata?: AgenticRunnerExecutionJsonObject;
}

export interface AgenticRunnerExecutionSummary {
  readonly plannedSteps: number;
  readonly executedSteps: number;
  readonly completedSteps: number;
  readonly failedSteps: number;
  readonly blockedSteps: number;
  readonly retryableSteps: number;
  readonly plannedBatches: number;
  readonly completedBatches: number;
  readonly failedBatches: number;
  readonly expectedWorkItems: number;
  readonly completedWorkItems: number;
  readonly failedWorkItems: number;
  readonly skippedWorkItems: number;
  readonly retryableWorkItems: number;
  readonly adapterCallCount: number;
  readonly auditEventsEmitted: number;
  readonly verifierIssueCount: number;
  readonly issueCount: number;
}

export interface AgenticRunnerExecutionResult {
  readonly ok: boolean;
  readonly taskId: AgenticRunnerExecutionTaskId;
  readonly mode: AgenticRunnerExecutionMode;
  readonly state: AgenticRunnerExecutionState;
  readonly plan?: AgenticRunnerExecutionDataReference;
  readonly steps: readonly AgenticRunnerStepExecution[];
  readonly batches: readonly AgenticRunnerBatchExecution[];
  readonly workItemOutcomes: readonly AgenticRunnerWorkItemOutcome[];
  readonly policy?: AgenticRunnerPolicyExecution;
  readonly approval?: AgenticRunnerApprovalExecution;
  readonly adapterCalls: readonly AgenticRunnerAdapterCallRecord[];
  readonly audit: AgenticRunnerAuditExecutionHandoff;
  readonly verifier: AgenticRunnerVerifierExecutionHandoff;
  readonly resume?: AgenticRunnerResumeUpdate;
  readonly issues: readonly AgenticRunnerExecutionIssue[];
  readonly summary: AgenticRunnerExecutionSummary;
}
