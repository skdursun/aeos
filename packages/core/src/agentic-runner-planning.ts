import type {
  AdapterKind,
  ApprovalState,
} from "./adapters.js";
import type {
  AgenticAuditEventId,
  AgenticISODateTime,
  AgenticLifecycleIssueCategory,
  AgenticLifecycleIssueSeverity,
  AgenticTaskId,
  AgenticTaskInventory,
  AgenticTaskLifecycle,
  AgenticVerifierId,
  AgenticWorkBatch,
  AgenticWorkBatchId,
  AgenticWorkItem,
  AgenticWorkItemId,
  AgenticWorkItemState,
} from "./agentic-lifecycle.js";
import type {
  AgenticRunnerAdapterReference,
  AgenticRunnerStepState,
} from "./agentic-runner.js";
import type { PolicyDecision, PolicyDecisionId } from "./policy.js";
import type { AeosTask } from "./tasks.js";
import type { AeosId } from "./types.js";

export type AgenticRunnerPlanningMode =
  | "plan"
  | "dry_run"
  | "resume"
  | "verify"
  | "unknown";

export type AgenticRunnerPlanningPrerequisiteKind =
  | "task_contract"
  | "inventory"
  | "work_items"
  | "policy"
  | "adapters"
  | "audit"
  | "verifier"
  | "approval"
  | "unknown";

export type AgenticRunnerPlanningPrerequisiteStatus =
  | "missing"
  | "present"
  | "incomplete"
  | "blocked"
  | "satisfied"
  | "failed"
  | "unknown";

export type AgenticRunnerPlanningStepKind =
  | "policy_preflight"
  | "approval"
  | "inventory"
  | "batch_execution"
  | "audit_append"
  | "verification"
  | "resume_update"
  | "unknown";

export type AgenticRunnerPolicyPlanStatus =
  | "not_evaluated"
  | "allowed"
  | "denied"
  | "requires_approval"
  | "blocked"
  | "unknown";

export interface AgenticRunnerPlanningReference {
  readonly id: string;
  readonly path?: string;
  readonly url?: string;
  readonly version?: string;
  readonly metadata?: Record<string, unknown>;
}

export type AgenticRunnerPlanningDataReference<TData> =
  | {
      readonly kind: "reference";
      readonly reference: AgenticRunnerPlanningReference;
    }
  | {
      readonly kind: "data";
      readonly data: TData;
      readonly reference?: AgenticRunnerPlanningReference;
    };

export type AgenticRunnerTaskContractPlanningInput =
  | {
      readonly kind: "reference";
      readonly reference: AgenticRunnerPlanningReference;
    }
  | {
      readonly kind: "metadata";
      readonly task: AeosTask;
      readonly reference?: AgenticRunnerPlanningReference;
    };

export interface AgenticRunnerPlanningOptions {
  readonly requireVerifier?: boolean;
  readonly requireAudit?: boolean;
  readonly requireApproval?: boolean;
  readonly maxWorkItems?: number;
  readonly maxBatchSize?: number;
  readonly outputMode?: "human" | "json" | "summary";
  readonly metadata?: Record<string, unknown>;
}

export interface AgenticRunnerPlanningIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: AgenticLifecycleIssueSeverity;
  readonly category: AgenticLifecycleIssueCategory;
  readonly prerequisiteId?: string;
  readonly workItemId?: AgenticWorkItemId;
  readonly batchId?: AgenticWorkBatchId;
  readonly stepId?: string;
  readonly policyGateId?: AeosId;
  readonly adapterReferenceId?: AeosId;
  readonly auditEventIds?: readonly AgenticAuditEventId[];
  readonly retryable?: boolean;
  readonly createdAt?: AgenticISODateTime;
  readonly metadata?: Record<string, unknown>;
}

export interface AgenticRunnerPlanningPrerequisite {
  readonly id: string;
  readonly kind: AgenticRunnerPlanningPrerequisiteKind;
  readonly status: AgenticRunnerPlanningPrerequisiteStatus;
  readonly required: boolean;
  readonly reason?: string;
  readonly issues: readonly AgenticRunnerPlanningIssue[];
}

export interface AgenticRunnerWorkItemPlan {
  readonly id: AgenticWorkItemId;
  readonly sourceId?: string;
  readonly sourcePath?: string;
  readonly sourceUrl?: string;
  readonly initialState: AgenticWorkItemState;
  readonly batchId?: AgenticWorkBatchId;
  readonly expectedArtifactIds?: readonly string[];
  readonly issues: readonly AgenticRunnerPlanningIssue[];
  readonly metadata?: Record<string, unknown>;
}

export interface AgenticRunnerBatchPlan {
  readonly id: AgenticWorkBatchId;
  readonly workItemIds: readonly AgenticWorkItemId[];
  readonly expectedItemCount: number;
  readonly deterministicOrder: readonly AgenticWorkItemId[];
  readonly issues: readonly AgenticRunnerPlanningIssue[];
  readonly metadata?: Record<string, unknown>;
}

export interface AgenticRunnerStepPlan {
  readonly id: string;
  readonly kind: AgenticRunnerPlanningStepKind;
  readonly state: AgenticRunnerStepState;
  readonly dependsOn: readonly string[];
  readonly requiredPolicyGateId?: AeosId;
  readonly requiredAdapterReferenceId?: AeosId;
  readonly expectedAuditEventIds: readonly AgenticAuditEventId[];
  readonly verifierRequired: boolean;
  readonly issues: readonly AgenticRunnerPlanningIssue[];
  readonly metadata?: Record<string, unknown>;
}

export interface AgenticRunnerPolicyPlan {
  readonly policyGateId: AeosId;
  readonly status: AgenticRunnerPolicyPlanStatus;
  readonly decisionReference?: PolicyDecisionId;
  readonly decision?: PolicyDecision;
  readonly approvalRequired: boolean;
  readonly approvalState?: ApprovalState;
  readonly reasons: readonly string[];
  readonly issues: readonly AgenticRunnerPlanningIssue[];
  readonly metadata?: Record<string, unknown>;
}

export interface AgenticRunnerAdapterBoundaryPlan {
  readonly modelAdapterReferences: readonly AgenticRunnerAdapterReference[];
  readonly toolAdapterReferences: readonly AgenticRunnerAdapterReference[];
  readonly allowedOperations: readonly string[];
  readonly deniedOperations: readonly string[];
  readonly approvalRequired: boolean;
  readonly issues: readonly AgenticRunnerPlanningIssue[];
  readonly metadata?: Record<string, unknown>;
}

export interface AgenticRunnerAuditExpectationPlan {
  readonly expectedAuditEventIds: readonly AgenticAuditEventId[];
  readonly requiredEventKinds: readonly string[];
  readonly missingAuditEventIds?: readonly AgenticAuditEventId[];
  readonly auditRequired: boolean;
  readonly issues: readonly AgenticRunnerPlanningIssue[];
  readonly metadata?: Record<string, unknown>;
}

export interface AgenticRunnerVerifierRequirementPlan {
  readonly verifierRequired: boolean;
  readonly verifierId?: AgenticVerifierId;
  readonly expectedCoverageRule?: string;
  readonly completionGatedByVerifier: boolean;
  readonly issues: readonly AgenticRunnerPlanningIssue[];
  readonly metadata?: Record<string, unknown>;
}

export interface AgenticRunnerResumePlan {
  readonly resumeCursorReference?: AgenticRunnerPlanningReference;
  readonly nextStepId?: string;
  readonly nextBatchId?: AgenticWorkBatchId;
  readonly pendingWorkItemIds: readonly AgenticWorkItemId[];
  readonly retryableWorkItemIds: readonly AgenticWorkItemId[];
  readonly updatedAt: AgenticISODateTime;
  readonly metadata?: Record<string, unknown>;
}

export interface AgenticRunnerPlanningSummary {
  readonly prerequisiteCount: number;
  readonly workItemCount: number;
  readonly batchCount: number;
  readonly stepCount: number;
  readonly policyGateCount: number;
  readonly adapterReferenceCount: number;
  readonly expectedAuditEventCount: number;
  readonly verifierRequired: boolean;
  readonly approvalRequired: boolean;
  readonly issueCount: number;
}

export interface AgenticRunnerPlanningInput {
  readonly taskId: AgenticTaskId;
  readonly taskContract?: AgenticRunnerTaskContractPlanningInput;
  readonly taskMetadata?: AeosTask;
  readonly lifecycle?: AgenticRunnerPlanningDataReference<AgenticTaskLifecycle>;
  readonly inventory?: AgenticRunnerPlanningDataReference<AgenticTaskInventory>;
  readonly workItems?: readonly AgenticWorkItem[];
  readonly batches?: readonly AgenticWorkBatch[];
  readonly mode: AgenticRunnerPlanningMode;
  readonly options?: AgenticRunnerPlanningOptions;
  readonly policyRequirements?: readonly AgenticRunnerPolicyPlan[];
  readonly adapterReferences?: readonly AgenticRunnerAdapterReference[];
  readonly adapterKinds?: readonly AdapterKind[];
  readonly auditRequirements?: AgenticRunnerAuditExpectationPlan;
  readonly verifierRequirements?: AgenticRunnerVerifierRequirementPlan;
  readonly resumeData?: AgenticRunnerResumePlan;
  readonly metadata?: Record<string, unknown>;
}

export interface AgenticRunnerPlanningResult {
  readonly ok: boolean;
  readonly taskId: AgenticTaskId;
  readonly mode: AgenticRunnerPlanningMode;
  readonly prerequisites: readonly AgenticRunnerPlanningPrerequisite[];
  readonly workItems: readonly AgenticRunnerWorkItemPlan[];
  readonly batches: readonly AgenticRunnerBatchPlan[];
  readonly steps: readonly AgenticRunnerStepPlan[];
  readonly policy: readonly AgenticRunnerPolicyPlan[];
  readonly adapterBoundary: AgenticRunnerAdapterBoundaryPlan;
  readonly audit: AgenticRunnerAuditExpectationPlan;
  readonly verifier: AgenticRunnerVerifierRequirementPlan;
  readonly resume?: AgenticRunnerResumePlan;
  readonly issues: readonly AgenticRunnerPlanningIssue[];
  readonly summary: AgenticRunnerPlanningSummary;
}
