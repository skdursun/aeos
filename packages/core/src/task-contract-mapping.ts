import type {
  AgenticRunnerAdapterBoundaryPlan,
  AgenticRunnerAuditExpectationPlan,
  AgenticRunnerPlanningDataReference,
  AgenticRunnerPlanningInput,
  AgenticRunnerPlanningReference,
  AgenticRunnerPolicyPlan,
  AgenticRunnerResumePlan,
  AgenticRunnerVerifierRequirementPlan,
  AgenticRunnerWorkItemPlan,
} from "./agentic-runner-planning.js";
import type {
  AeosTask,
  AeosTaskId,
  TaskValidationIssue,
  TaskValidationResult,
} from "./tasks.js";

export type TaskContractMappingMode =
  | "plan"
  | "dry_run"
  | "validate"
  | "unknown";

export type TaskContractMappingStatus =
  | "mapped"
  | "unsupported"
  | "invalid"
  | "blocked"
  | "failed"
  | "unknown";

export type TaskContractMappingIssueSeverity =
  | "error"
  | "warning"
  | "info"
  | "critical";

export type TaskContractMappingIssueCategory =
  | "input"
  | "validation"
  | "work_items"
  | "batches"
  | "policy"
  | "adapters"
  | "audit"
  | "verifier"
  | "resume"
  | "planning_input"
  | "safety"
  | "unsupported"
  | "unknown";

export type TaskContractWorkItemMappingSource =
  | "explicit_work_item"
  | "single_work_item_fallback"
  | "unknown";

export interface TaskContractMappingIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: TaskContractMappingIssueSeverity;
  readonly category: TaskContractMappingIssueCategory;
  readonly taskId?: AeosTaskId;
  readonly sourceFile?: string;
  readonly sourceReference?: AgenticRunnerPlanningReference;
  readonly workItemId?: AgenticRunnerWorkItemPlan["id"];
  readonly batchId?: string;
  readonly policyGateId?: AgenticRunnerPolicyPlan["policyGateId"];
  readonly adapterReferenceId?: string;
  readonly auditEventIds?: AgenticRunnerAuditExpectationPlan["expectedAuditEventIds"];
  readonly field?: string;
  readonly retryable?: boolean;
  readonly sourceIssue?: TaskValidationIssue;
  readonly metadata?: Record<string, unknown>;
}

export interface TaskContractMappingOptions {
  readonly allowSingleWorkItemFallback?: boolean;
  readonly requireExplicitWorkItems?: boolean;
  readonly requireVerifier?: boolean;
  readonly createDefaultBatch?: boolean;
  readonly createAuditExpectations?: boolean;
  readonly createPolicyBoundary?: boolean;
  readonly createAdapterBoundary?: boolean;
}

export interface TaskContractMappingValidationHandoff {
  readonly status?: TaskValidationResult["status"];
  readonly valid?: boolean;
  readonly result?: TaskValidationResult;
  readonly reference?: AgenticRunnerPlanningReference;
  readonly issues: readonly TaskValidationIssue[];
}

export interface TaskContractMappingInput {
  readonly taskId?: AeosTaskId;
  readonly task?: AeosTask;
  readonly taskContract?: AgenticRunnerPlanningDataReference<AeosTask>;
  readonly sourceFile?: string;
  readonly mode: TaskContractMappingMode;
  readonly options?: TaskContractMappingOptions;
  readonly validation?: TaskContractMappingValidationHandoff;
  readonly noExecution: true;
  readonly noWrites: true;
}

export interface TaskContractWorkItemMapping {
  readonly sourceTaskId: AeosTaskId;
  readonly workItemId: AgenticRunnerWorkItemPlan["id"];
  readonly sourceReference?: AgenticRunnerPlanningReference;
  readonly initialState: AgenticRunnerWorkItemPlan["initialState"];
  readonly derivedFrom: TaskContractWorkItemMappingSource;
  readonly issues: readonly TaskContractMappingIssue[];
}

export interface TaskContractBatchMapping {
  readonly batchId: string;
  readonly workItemIds: readonly AgenticRunnerWorkItemPlan["id"][];
  readonly expectedItemCount: number;
  readonly derivedDefaultBatch: boolean;
  readonly issues: readonly TaskContractMappingIssue[];
}

export interface TaskContractPolicyMapping {
  readonly policyGateId: AgenticRunnerPolicyPlan["policyGateId"];
  readonly required: boolean;
  readonly approvalRequired: boolean;
  readonly status?: AgenticRunnerPolicyPlan["status"];
  readonly decisionReference?: AgenticRunnerPolicyPlan["decisionReference"];
  readonly issues: readonly TaskContractMappingIssue[];
}

export interface TaskContractAdapterBoundaryMapping {
  readonly modelAdapterReferences: AgenticRunnerAdapterBoundaryPlan["modelAdapterReferences"];
  readonly toolAdapterReferences: AgenticRunnerAdapterBoundaryPlan["toolAdapterReferences"];
  readonly allowedOperations: readonly string[];
  readonly deniedOperations: readonly string[];
  readonly approvalRequired: boolean;
  readonly issues: readonly TaskContractMappingIssue[];
}

export interface TaskContractAuditExpectationMapping {
  readonly expectedAuditEventIds: AgenticRunnerAuditExpectationPlan["expectedAuditEventIds"];
  readonly requiredEventKinds: readonly string[];
  readonly auditRequired: boolean;
  readonly issues: readonly TaskContractMappingIssue[];
}

export interface TaskContractVerifierRequirementMapping {
  readonly verifierRequired: boolean;
  readonly completionGatedByVerifier: boolean;
  readonly expectedCoverageRule?: AgenticRunnerVerifierRequirementPlan["expectedCoverageRule"];
  readonly issues: readonly TaskContractMappingIssue[];
}

export interface TaskContractResumeMapping {
  readonly resumeCursorReference?: AgenticRunnerResumePlan["resumeCursorReference"];
  readonly pendingWorkItemIds: AgenticRunnerResumePlan["pendingWorkItemIds"];
  readonly retryableWorkItemIds: AgenticRunnerResumePlan["retryableWorkItemIds"];
  readonly nextBatchId?: AgenticRunnerResumePlan["nextBatchId"];
  readonly issues: readonly TaskContractMappingIssue[];
}

export interface TaskContractPlanningInputHandoff {
  readonly handoffRequested: boolean;
  readonly handoffStatus: TaskContractMappingStatus;
  readonly runnerPlanningInput?: AgenticRunnerPlanningInput;
  readonly runnerPlanningInputReference?: AgenticRunnerPlanningReference;
  readonly runnerPlanningInputData?: AgenticRunnerPlanningDataReference<AgenticRunnerPlanningInput>;
  readonly runnerPlanningExecuted: false;
  readonly taskPersistenceWritten: false;
  readonly unsupportedReason?: string;
  readonly issues: readonly TaskContractMappingIssue[];
}

export interface TaskContractMappingSummary {
  readonly workItemCount: number;
  readonly batchCount: number;
  readonly policyRequired: boolean;
  readonly approvalRequired: boolean;
  readonly adapterReferenceCount: number;
  readonly expectedAuditEventCount: number;
  readonly verifierRequired: boolean;
  readonly completionGatedByVerifier: boolean;
  readonly mappingSupported: boolean;
  readonly noExecution: true;
  readonly noWrites: true;
  readonly issueCount: number;
}

export interface TaskContractMappingResult {
  readonly ok: boolean;
  readonly taskId?: AeosTaskId;
  readonly mode: TaskContractMappingMode;
  readonly status: TaskContractMappingStatus;
  readonly sourceFile?: string;
  readonly workItems: readonly TaskContractWorkItemMapping[];
  readonly batches: readonly TaskContractBatchMapping[];
  readonly policy?: TaskContractPolicyMapping;
  readonly adapterBoundary?: TaskContractAdapterBoundaryMapping;
  readonly audit?: TaskContractAuditExpectationMapping;
  readonly verifier?: TaskContractVerifierRequirementMapping;
  readonly resume?: TaskContractResumeMapping;
  readonly planningInput: TaskContractPlanningInputHandoff;
  readonly issues: readonly TaskContractMappingIssue[];
  readonly summary: TaskContractMappingSummary;
}
