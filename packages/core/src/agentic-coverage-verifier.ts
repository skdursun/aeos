import type {
  AgenticAuditEventId,
  AgenticAuditReference,
  AgenticCoverage,
  AgenticISODateTime,
  AgenticLifecycleIssueCategory,
  AgenticLifecycleIssueSeverity,
  AgenticLifecycleResult,
  AgenticTaskId,
  AgenticTaskInventory,
  AgenticTaskLifecycle,
  AgenticVerificationSnapshot,
  AgenticWorkBatch,
  AgenticWorkBatchId,
  AgenticWorkItem,
  AgenticWorkItemId,
} from "./agentic-lifecycle.js";

export type AgenticCoverageVerificationStatus =
  | "verified"
  | "incomplete"
  | "failed"
  | "blocked"
  | "unknown";

export type AgenticCoverageVerifierMode =
  | "completion"
  | "status"
  | "resume"
  | "audit";

export type AgenticCoverageCheckKind =
  | "item_coverage"
  | "artifact_coverage"
  | "batch_coverage"
  | "inventory_coverage"
  | "audit_consistency";

export interface AgenticCoverageVerifierOptions {
  readonly requireInventoryComplete?: boolean;
  readonly requireAuditConsistency?: boolean;
  readonly allowExtraArtifacts?: boolean;
  readonly mode?: AgenticCoverageVerifierMode;
}

export interface AgenticCoverageVerifierIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: AgenticLifecycleIssueSeverity;
  readonly category: AgenticLifecycleIssueCategory;
  readonly checkId?: string;
  readonly workItemId?: AgenticWorkItemId;
  readonly batchId?: AgenticWorkBatchId;
  readonly artifactPath?: string;
  readonly auditEventIds?: readonly AgenticAuditEventId[];
  readonly retryable?: boolean;
  readonly createdAt?: AgenticISODateTime;
}

export interface AgenticCoverageCheck {
  readonly id: string;
  readonly kind: AgenticCoverageCheckKind;
  readonly required: boolean;
  readonly status: AgenticCoverageVerificationStatus;
  readonly coverageComplete: boolean;
  readonly issues: readonly AgenticCoverageVerifierIssue[];
}

export interface AgenticItemCoverageCheck extends AgenticCoverageCheck {
  readonly kind: "item_coverage";
  readonly rule:
    "expected_items == completed_items + explicitly_failed_items + explicitly_skipped_items";
  readonly expectedItems: number;
  readonly completedItems: number;
  readonly failedItems: number;
  readonly skippedItems: number;
  readonly pendingItems: number;
  readonly retryableItems: number;
  readonly missingItemIds?: readonly AgenticWorkItemId[];
}

export interface AgenticArtifactCoverageCheck extends AgenticCoverageCheck {
  readonly kind: "artifact_coverage";
  readonly expectedArtifacts: readonly string[];
  readonly verifiedArtifacts: readonly string[];
  readonly missingArtifacts: readonly string[];
  readonly extraArtifacts: readonly string[];
}

export interface AgenticBatchCoverageCheck extends AgenticCoverageCheck {
  readonly kind: "batch_coverage";
  readonly batchId: AgenticWorkBatchId;
  readonly expectedItems: number;
  readonly completedItems: number;
  readonly failedItems: number;
  readonly skippedItems: number;
  readonly retryableItems: number;
}

export interface AgenticInventoryCoverageCheck extends AgenticCoverageCheck {
  readonly kind: "inventory_coverage";
  readonly inventorySource: string;
  readonly expectedItemCount: number;
  readonly discoveredItemCount: number;
  readonly inventoryComplete: boolean;
}

export interface AgenticAuditConsistencyCheck extends AgenticCoverageCheck {
  readonly kind: "audit_consistency";
  readonly expectedAuditEventCount?: number;
  readonly observedAuditEventCount?: number;
  readonly missingAuditEventIds: readonly AgenticAuditEventId[];
  readonly consistencyStatus: AgenticCoverageVerificationStatus;
}

export interface AgenticCoverageVerifierSummary {
  readonly expectedItems: number;
  readonly completedItems: number;
  readonly failedItems: number;
  readonly skippedItems: number;
  readonly pendingItems: number;
  readonly retryableItems: number;
  readonly expectedArtifacts: number;
  readonly verifiedArtifacts: number;
  readonly missingArtifacts: number;
  readonly issueCount: number;
}

export interface AgenticCoverageVerifierInput {
  readonly taskId: AgenticTaskId;
  readonly lifecycleResult?: AgenticLifecycleResult;
  readonly lifecycle?: AgenticTaskLifecycle;
  readonly inventory?: AgenticTaskInventory;
  readonly workItems?: readonly AgenticWorkItem[];
  readonly batches?: readonly AgenticWorkBatch[];
  readonly coverage?: AgenticCoverage;
  readonly verificationSnapshot?: AgenticVerificationSnapshot;
  readonly auditReferences?: readonly AgenticAuditReference[];
  readonly mode?: AgenticCoverageVerifierMode;
  readonly options?: AgenticCoverageVerifierOptions;
}

export interface AgenticCoverageVerifierResult {
  readonly ok: boolean;
  readonly taskId: AgenticTaskId;
  readonly status: AgenticCoverageVerificationStatus;
  readonly itemCoverage: AgenticItemCoverageCheck;
  readonly artifactCoverage: AgenticArtifactCoverageCheck;
  readonly batchCoverage: readonly AgenticBatchCoverageCheck[];
  readonly inventoryCoverage: AgenticInventoryCoverageCheck;
  readonly auditConsistency: AgenticAuditConsistencyCheck;
  readonly issues: readonly AgenticCoverageVerifierIssue[];
  readonly summary: AgenticCoverageVerifierSummary;
}
