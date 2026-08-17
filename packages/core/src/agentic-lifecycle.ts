export type AgenticTaskId = string;

export type AgenticWorkItemId = string;

export type AgenticWorkBatchId = string;

/**
 * Identity of a requirement — the durable unit of expected work that a group of
 * work items satisfies.  Optional on a work item: items without one are grouped
 * under the reserved unassigned bucket by the progress ledger.
 */
export type AgenticRequirementId = string;

export type AgenticExecutionAttemptId = string;

export type AgenticAdapterId = string;

export type AgenticVerifierId = string;

export type AgenticAuditEventId = string;

export type AgenticISODateTime = string;

export type AgenticTaskState =
  | "draft"
  | "planned"
  | "approved"
  | "running"
  | "blocked"
  | "failed"
  | "verified"
  | "completed"
  | "cancelled";

export type AgenticWorkItemState =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "skipped"
  | "retryable"
  | "verified";

export type AgenticInventoryStatus = "complete" | "incomplete";

export type AgenticAttemptStatus =
  | "running"
  | "completed"
  | "blocked"
  | "failed"
  | "retryable"
  | "cancelled";

export type AgenticVerificationStatus =
  | "pass"
  | "fail"
  | "blocked"
  | "skipped";

export type AgenticCoverageStatus =
  | "satisfied"
  | "incomplete"
  | "failed"
  | "blocked"
  | "unknown";

export type AgenticLifecycleIssueSeverity =
  | "info"
  | "warning"
  | "error"
  | "critical";

export type AgenticLifecycleIssueCategory =
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
  | "unknown";

export interface AgenticLifecycleIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: AgenticLifecycleIssueSeverity;
  readonly category: AgenticLifecycleIssueCategory;
  readonly workItemId?: AgenticWorkItemId;
  readonly batchId?: AgenticWorkBatchId;
  readonly attemptId?: AgenticExecutionAttemptId;
  readonly auditEventIds?: readonly AgenticAuditEventId[];
  readonly retryable?: boolean;
  readonly createdAt?: AgenticISODateTime;
}

export interface AgenticTaskInventory {
  readonly source: string;
  readonly expectedItemCount: number;
  readonly discoveredItemCount: number;
  readonly status: AgenticInventoryStatus;
  readonly issues: readonly AgenticLifecycleIssue[];
  readonly updatedAt?: AgenticISODateTime;
}

export interface AgenticWorkItem {
  readonly id: AgenticWorkItemId;
  readonly state: AgenticWorkItemState;
  readonly title?: string;
  readonly source?: string;
  readonly dependsOn?: readonly AgenticWorkItemId[];
  readonly batchId?: AgenticWorkBatchId;
  /** Requirement this work item counts towards in the progress ledger. */
  readonly requirementId?: AgenticRequirementId;
  readonly expectedArtifacts?: readonly string[];
  readonly issues?: readonly AgenticLifecycleIssue[];
  readonly updatedAt?: AgenticISODateTime;
}

export interface AgenticWorkBatch {
  readonly id: AgenticWorkBatchId;
  readonly workItemIds: readonly AgenticWorkItemId[];
  readonly expectedItemCount: number;
  readonly completedCount: number;
  readonly failedCount: number;
  readonly skippedCount: number;
  readonly retryableCount: number;
}

export type AgenticCoverageRuleKind =
  | "item_completion_accounting"
  | "artifact_completion_accounting"
  | "inventory_completion";

export interface AgenticCoverageRule {
  readonly id: string;
  readonly kind: AgenticCoverageRuleKind;
  readonly description: string;
  readonly required: boolean;
  readonly expression:
    | "expected_items == completed_items + explicitly_failed_items + explicitly_skipped_items"
    | "expected_artifacts == verified_artifacts"
    | "discovered_items == inventoried_items";
  readonly status: AgenticCoverageStatus;
}

export interface AgenticArtifactCoverage {
  readonly expectedArtifacts: readonly string[];
  readonly verifiedArtifacts: readonly string[];
  readonly missingArtifacts: readonly string[];
  readonly extraArtifacts: readonly string[];
}

export interface AgenticCoverage {
  readonly status: AgenticCoverageStatus;
  readonly expectedItemCount: number;
  readonly completedItemCount: number;
  readonly verifiedItemCount: number;
  readonly explicitlyFailedItemCount: number;
  readonly explicitlySkippedItemCount: number;
  readonly pendingItemCount: number;
  readonly retryableItemCount: number;
  readonly discoveredButNotInventoriedCount?: number;
  readonly artifacts: AgenticArtifactCoverage;
  readonly rules: readonly AgenticCoverageRule[];
  readonly issues: readonly AgenticLifecycleIssue[];
  readonly updatedAt?: AgenticISODateTime;
}

export interface AgenticExecutionAttempt {
  readonly id: AgenticExecutionAttemptId;
  readonly adapterId: AgenticAdapterId;
  readonly startedAt: AgenticISODateTime;
  readonly completedAt?: AgenticISODateTime;
  readonly status: AgenticAttemptStatus;
  readonly workItemIds?: readonly AgenticWorkItemId[];
  readonly batchId?: AgenticWorkBatchId;
  readonly issues: readonly AgenticLifecycleIssue[];
}

export interface AgenticVerificationSnapshot {
  readonly verifierId: AgenticVerifierId;
  readonly status: AgenticVerificationStatus;
  readonly checkedAt: AgenticISODateTime;
  readonly coverageStatus: AgenticCoverageStatus;
  readonly issues: readonly AgenticLifecycleIssue[];
  readonly auditEventIds?: readonly AgenticAuditEventId[];
}

export interface AgenticAuditReference {
  readonly auditEventIds: readonly AgenticAuditEventId[];
  readonly createdAt: AgenticISODateTime;
  readonly lastEventAt: AgenticISODateTime;
}

export interface AgenticResumeCursor {
  readonly nextPendingBatchId?: AgenticWorkBatchId;
  readonly remainingWorkItemIds: readonly AgenticWorkItemId[];
  readonly retryableWorkItemIds: readonly AgenticWorkItemId[];
  readonly updatedAt: AgenticISODateTime;
}

export interface AgenticLifecycleSummary {
  readonly totalWorkItemCount: number;
  readonly completedWorkItemCount: number;
  readonly verifiedWorkItemCount: number;
  readonly failedWorkItemCount: number;
  readonly skippedWorkItemCount: number;
  readonly retryableWorkItemCount: number;
  readonly pendingWorkItemCount: number;
  readonly batchCount: number;
  readonly issueCount: number;
  readonly artifactCoverageStatus: AgenticCoverageStatus;
  readonly verificationStatus: AgenticVerificationStatus;
}

export interface AgenticTaskLifecycle {
  readonly taskId: AgenticTaskId;
  readonly state: AgenticTaskState;
  readonly inventory: AgenticTaskInventory;
  readonly workItems: readonly AgenticWorkItem[];
  readonly batches: readonly AgenticWorkBatch[];
  readonly coverage: AgenticCoverage;
  readonly attempts: readonly AgenticExecutionAttempt[];
  readonly verification?: AgenticVerificationSnapshot;
  readonly audit?: AgenticAuditReference;
  readonly resume?: AgenticResumeCursor;
  readonly issues: readonly AgenticLifecycleIssue[];
  readonly summary: AgenticLifecycleSummary;
  readonly createdAt?: AgenticISODateTime;
  readonly updatedAt?: AgenticISODateTime;
}

export interface AgenticLifecycleResult {
  readonly ok: boolean;
  readonly taskId: AgenticTaskId;
  readonly state: AgenticTaskState;
  readonly inventory: AgenticTaskInventory;
  readonly batches: readonly AgenticWorkBatch[];
  readonly coverage: AgenticCoverage;
  readonly verification?: AgenticVerificationSnapshot;
  readonly audit?: AgenticAuditReference;
  readonly resume?: AgenticResumeCursor;
  readonly issues: readonly AgenticLifecycleIssue[];
  readonly summary: AgenticLifecycleSummary;
}
