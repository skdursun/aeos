export type AgenticRunnerDryRunTaskId = string;

export type AgenticRunnerDryRunStepId = string;

export type AgenticRunnerDryRunBatchId = string;

export type AgenticRunnerDryRunWorkItemId = string;

export type AgenticRunnerDryRunAdapterCallId = string;

export type AgenticRunnerDryRunAdapterId = string;

export type AgenticRunnerDryRunAuditEventId = string;

export type AgenticRunnerDryRunISODateTime = string;

export type AgenticRunnerDryRunJsonObject = Record<string, unknown>;

export type AgenticRunnerDryRunMode = "dry_run";

export type AgenticRunnerDryRunState =
  | "not_started"
  | "preflight"
  | "waiting_for_approval"
  | "blocked"
  | "failed"
  | "verification_required"
  | "preview_ready"
  | "cancelled"
  | "unknown";

export type AgenticRunnerDryRunAdapterCallKind =
  | "model"
  | "tool"
  | "unknown";

export type AgenticRunnerDryRunAuditStatus =
  | "not_required"
  | "pending"
  | "partial"
  | "complete_from_input"
  | "missing"
  | "failed"
  | "unknown";

export type AgenticRunnerDryRunVerifierStatus =
  | "not_required"
  | "required_not_run"
  | "blocked"
  | "failed"
  | "unknown";

export type AgenticRunnerDryRunCoverageStatus =
  | "incomplete"
  | "failed"
  | "blocked"
  | "unknown";

export type AgenticRunnerDryRunIssueSeverity =
  | "info"
  | "warning"
  | "error"
  | "critical";

export type AgenticRunnerDryRunIssueCategory =
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
  | "dry_run_safety"
  | "unknown";

export interface AgenticRunnerDryRunReference {
  readonly id: string;
  readonly path?: string;
  readonly url?: string;
  readonly version?: string;
  readonly metadata?: AgenticRunnerDryRunJsonObject;
}

export type AgenticRunnerDryRunDataReference<
  TData = AgenticRunnerDryRunJsonObject,
> =
  | {
      readonly kind: "reference";
      readonly reference: AgenticRunnerDryRunReference;
    }
  | {
      readonly kind: "data";
      readonly data: TData;
      readonly reference?: AgenticRunnerDryRunReference;
    };

export interface AgenticRunnerDryRunOptions {
  readonly requirePolicy?: boolean;
  readonly requireApproval?: boolean;
  readonly requireAudit?: boolean;
  readonly requireVerifier?: boolean;
  readonly completionGatedByVerifier?: boolean;
  readonly maxWorkItems?: number;
  readonly maxBatchSize?: number;
  readonly outputMode?: "human" | "json" | "summary";
  readonly metadata?: AgenticRunnerDryRunJsonObject;
}

export interface AgenticRunnerDryRunIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: AgenticRunnerDryRunIssueSeverity;
  readonly category: AgenticRunnerDryRunIssueCategory;
  readonly stepId?: AgenticRunnerDryRunStepId;
  readonly batchId?: AgenticRunnerDryRunBatchId;
  readonly workItemId?: AgenticRunnerDryRunWorkItemId;
  readonly adapterCallId?: AgenticRunnerDryRunAdapterCallId;
  readonly adapterId?: AgenticRunnerDryRunAdapterId;
  readonly auditEventIds?: readonly AgenticRunnerDryRunAuditEventId[];
  readonly retryable?: boolean;
  readonly createdAt?: AgenticRunnerDryRunISODateTime;
  readonly metadata?: AgenticRunnerDryRunJsonObject;
}

export interface AgenticRunnerDryRunStepPreview {
  readonly stepId: AgenticRunnerDryRunStepId;
  readonly stepKind: string;
  readonly previewState: AgenticRunnerDryRunState;
  readonly wouldRun: boolean;
  readonly blockedReason?: string;
  readonly approvalRequired?: boolean;
  readonly plannedAdapterCallIds: readonly AgenticRunnerDryRunAdapterCallId[];
  readonly expectedAuditEventIds: readonly AgenticRunnerDryRunAuditEventId[];
  readonly verifierRequired: boolean;
  readonly issues: readonly AgenticRunnerDryRunIssue[];
  readonly metadata?: AgenticRunnerDryRunJsonObject;
}

export interface AgenticRunnerDryRunBatchPreview {
  readonly batchId: AgenticRunnerDryRunBatchId;
  readonly workItemIds: readonly AgenticRunnerDryRunWorkItemId[];
  readonly expectedItemCount: number;
  readonly previewState: AgenticRunnerDryRunState;
  readonly wouldRun: boolean;
  readonly issues: readonly AgenticRunnerDryRunIssue[];
  readonly metadata?: AgenticRunnerDryRunJsonObject;
}

export interface AgenticRunnerDryRunWorkItemPreview {
  readonly workItemId: AgenticRunnerDryRunWorkItemId;
  readonly batchId?: AgenticRunnerDryRunBatchId;
  readonly previewState: AgenticRunnerDryRunState;
  readonly wouldProcess: boolean;
  readonly expectedArtifactIds?: readonly string[];
  readonly issues: readonly AgenticRunnerDryRunIssue[];
  readonly metadata?: AgenticRunnerDryRunJsonObject;
}

export interface AgenticRunnerDryRunAdapterCallPreview {
  readonly callId: AgenticRunnerDryRunAdapterCallId;
  readonly kind: AgenticRunnerDryRunAdapterCallKind;
  readonly adapterId: AgenticRunnerDryRunAdapterId;
  readonly operation: string;
  readonly wouldCall: boolean;
  readonly approvalRequired: boolean;
  readonly deniedReason?: string;
  readonly inputReference?: AgenticRunnerDryRunReference;
  readonly outputReference?: AgenticRunnerDryRunReference | null;
  readonly issues: readonly AgenticRunnerDryRunIssue[];
  readonly observationOnly: true;
  readonly completionAuthority: false;
  readonly metadata?: AgenticRunnerDryRunJsonObject;
}

export interface AgenticRunnerDryRunAuditPreview {
  readonly expectedAuditEventIds: readonly AgenticRunnerDryRunAuditEventId[];
  readonly emittedAuditEventIds: readonly AgenticRunnerDryRunAuditEventId[];
  readonly missingAuditEventIds: readonly AgenticRunnerDryRunAuditEventId[];
  readonly wouldWriteAudit: false;
  readonly auditStatus: AgenticRunnerDryRunAuditStatus;
  readonly auditReference?: AgenticRunnerDryRunReference;
  readonly issues: readonly AgenticRunnerDryRunIssue[];
  readonly metadata?: AgenticRunnerDryRunJsonObject;
}

export interface AgenticRunnerDryRunVerifierPreview {
  readonly verifierRequired: boolean;
  readonly wouldRunVerifier: false;
  readonly verifierStatus: AgenticRunnerDryRunVerifierStatus;
  readonly coverageStatus: AgenticRunnerDryRunCoverageStatus;
  readonly verifierResultReference?: AgenticRunnerDryRunReference | null;
  readonly completionGatedByVerifier: boolean;
  readonly completionGateSatisfied: false;
  readonly issues: readonly AgenticRunnerDryRunIssue[];
  readonly metadata?: AgenticRunnerDryRunJsonObject;
}

export interface AgenticRunnerDryRunResumePreview {
  readonly wouldUpdateResume: false;
  readonly nextStepId?: AgenticRunnerDryRunStepId;
  readonly nextBatchId?: AgenticRunnerDryRunBatchId;
  readonly pendingWorkItemIds: readonly AgenticRunnerDryRunWorkItemId[];
  readonly retryableWorkItemIds: readonly AgenticRunnerDryRunWorkItemId[];
  readonly updatedAt?: AgenticRunnerDryRunISODateTime;
  readonly issues: readonly AgenticRunnerDryRunIssue[];
  readonly metadata?: AgenticRunnerDryRunJsonObject;
}

export interface AgenticRunnerDryRunInput {
  readonly taskId: AgenticRunnerDryRunTaskId;
  readonly runnerPlan?: AgenticRunnerDryRunDataReference;
  readonly planningResult?: AgenticRunnerDryRunDataReference;
  readonly lifecycle?: AgenticRunnerDryRunDataReference;
  readonly mode: AgenticRunnerDryRunMode;
  readonly options?: AgenticRunnerDryRunOptions;
  readonly plannedSteps: readonly AgenticRunnerDryRunStepPreview[];
  readonly plannedBatches: readonly AgenticRunnerDryRunBatchPreview[];
  readonly plannedWorkItems: readonly AgenticRunnerDryRunWorkItemPreview[];
  readonly policyPreview?: AgenticRunnerDryRunDataReference;
  readonly adapterBoundaryPreview?: AgenticRunnerDryRunDataReference;
  readonly adapterCalls?: readonly AgenticRunnerDryRunAdapterCallPreview[];
  readonly auditPreviewInput?: AgenticRunnerDryRunDataReference;
  readonly verifierPreviewInput?: AgenticRunnerDryRunDataReference;
  readonly resumePreviewInput?: AgenticRunnerDryRunDataReference;
  readonly metadata?: AgenticRunnerDryRunJsonObject;
}

export interface AgenticRunnerDryRunSummary {
  readonly plannedSteps: number;
  readonly runnableSteps: number;
  readonly blockedSteps: number;
  readonly plannedBatches: number;
  readonly runnableBatches: number;
  readonly plannedWorkItems: number;
  readonly processableWorkItems: number;
  readonly plannedAdapterCalls: number;
  readonly wouldCallAdapters: number;
  readonly expectedAuditEvents: number;
  readonly wouldWriteAudit: false;
  readonly verifierRequired: boolean;
  readonly wouldRunVerifier: false;
  readonly issueCount: number;
}

export interface AgenticRunnerDryRunResult {
  readonly ok: boolean;
  readonly taskId: AgenticRunnerDryRunTaskId;
  readonly mode: AgenticRunnerDryRunMode;
  readonly state: AgenticRunnerDryRunState;
  readonly plan?: AgenticRunnerDryRunDataReference;
  readonly planningResult?: AgenticRunnerDryRunDataReference;
  readonly lifecycle?: AgenticRunnerDryRunDataReference;
  readonly steps: readonly AgenticRunnerDryRunStepPreview[];
  readonly batches: readonly AgenticRunnerDryRunBatchPreview[];
  readonly workItems: readonly AgenticRunnerDryRunWorkItemPreview[];
  readonly adapterCalls: readonly AgenticRunnerDryRunAdapterCallPreview[];
  readonly audit: AgenticRunnerDryRunAuditPreview;
  readonly verifier: AgenticRunnerDryRunVerifierPreview;
  readonly resume?: AgenticRunnerDryRunResumePreview;
  readonly issues: readonly AgenticRunnerDryRunIssue[];
  readonly summary: AgenticRunnerDryRunSummary;
}
