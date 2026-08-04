import type {
  AgenticWorkBatch,
  AgenticWorkItem,
  AgenticWorkItemId,
} from "./agentic-lifecycle.js";
import type {
  AgenticRunnerAuditExpectationPlan,
  AgenticRunnerPlanningInput,
  AgenticRunnerPlanningIssue,
  AgenticRunnerPlanningResult,
  AgenticRunnerPolicyPlan,
  AgenticRunnerResumePlan,
  AgenticRunnerVerifierRequirementPlan,
} from "./agentic-runner-planning.js";
import {
  createAgenticRunnerBatchPlans,
  createAgenticRunnerPrerequisites,
  createAgenticRunnerStepPlans,
  createAgenticRunnerVerifierRequirementPlan,
  createAgenticRunnerWorkItemPlans,
  planAgenticRunner,
  summarizeAgenticRunnerPlanningResult,
} from "./agentic-runner-planning-logic.js";

type PlanningLogicExampleChecks = {
  readonly ok: boolean;
  readonly represented: readonly boolean[];
};

const sitemapItemCount = 400;
const sitemapBatchSize = 100;
const plannedAt = "2026-08-04T09:00:00.000Z";

function sitemapWorkItemId(index: number): AgenticWorkItemId {
  return `sitemap-url-${String(index + 1).padStart(3, "0")}`;
}

function createSitemapWorkItems(): readonly AgenticWorkItem[] {
  return Array.from({ length: sitemapItemCount }, (_, index): AgenticWorkItem => {
    const id = sitemapWorkItemId(index);
    const batchNumber = Math.floor(index / sitemapBatchSize) + 1;

    return {
      id,
      state: "pending",
      title: `Sitemap URL ${String(index + 1).padStart(3, "0")}`,
      source: `https://example.test/sitemap.xml#${id}`,
      batchId: `batch-${String(batchNumber).padStart(3, "0")}`,
      expectedArtifacts: [`artifact-${id}-audit`],
      updatedAt: plannedAt,
    };
  });
}

function createSitemapBatches(
  workItems: readonly AgenticWorkItem[],
): readonly AgenticWorkBatch[] {
  return Array.from(
    { length: sitemapItemCount / sitemapBatchSize },
    (_, batchIndex): AgenticWorkBatch => {
      const workItemIds = workItems
        .slice(
          batchIndex * sitemapBatchSize,
          (batchIndex + 1) * sitemapBatchSize,
        )
        .map((workItem) => workItem.id);

      return {
        id: `batch-${String(batchIndex + 1).padStart(3, "0")}`,
        workItemIds,
        expectedItemCount: workItemIds.length,
        completedCount: 0,
        failedCount: 0,
        skippedCount: 0,
        retryableCount: 0,
      };
    },
  );
}

const sitemapWorkItems = createSitemapWorkItems();
const sitemapBatches = createSitemapBatches(sitemapWorkItems);

export const sitemapPolicyPlan: AgenticRunnerPolicyPlan = {
  policyGateId: "policy-sitemap-audit",
  status: "allowed",
  decisionReference: "decision-sitemap-audit-allowed",
  approvalRequired: false,
  reasons: ["Read-only sitemap planning is allowed."],
  issues: [],
  metadata: {
    allowedOperations: ["http.read", "artifact.plan"],
    deniedOperations: ["filesystem.write", "cli.execute"],
  },
};

export const sitemapVerifierRequirements: AgenticRunnerVerifierRequirementPlan = {
  verifierRequired: true,
  verifierId: "coverage-verifier-sitemap",
  expectedCoverageRule:
    "expected_items == completed_items + explicitly_failed_items + explicitly_skipped_items",
  completionGatedByVerifier: true,
  issues: [],
};

export const sitemapPlanningInput: AgenticRunnerPlanningInput = {
  taskId: "sitemap-audit",
  taskContract: {
    kind: "reference",
    reference: {
      id: "task-contract-sitemap-audit",
      path: "tasks/sitemap-audit.json",
      version: "1",
    },
  },
  workItems: sitemapWorkItems,
  batches: sitemapBatches,
  mode: "plan",
  options: {
    requireAudit: true,
    requireVerifier: true,
    maxWorkItems: sitemapItemCount,
    maxBatchSize: sitemapBatchSize,
    outputMode: "summary",
    metadata: {
      deterministicBatches: true,
    },
  },
  policyRequirements: [sitemapPolicyPlan],
  verifierRequirements: sitemapVerifierRequirements,
  metadata: {
    executionPerformed: false,
  },
};

export const sitemapWorkItemPlans =
  createAgenticRunnerWorkItemPlans(sitemapPlanningInput);
export const sitemapBatchPlans = createAgenticRunnerBatchPlans(
  sitemapPlanningInput,
  sitemapWorkItemPlans,
);
export const sitemapPrerequisites =
  createAgenticRunnerPrerequisites(sitemapPlanningInput);
export const sitemapStepPlans = createAgenticRunnerStepPlans(sitemapPlanningInput);
export const sitemapVerifierPlan = createAgenticRunnerVerifierRequirementPlan(
  sitemapPlanningInput,
  true,
);
export const sitemapPlanningResult = planAgenticRunner(sitemapPlanningInput);

export const sitemapPlanningChecks: PlanningLogicExampleChecks = {
  ok: sitemapPlanningResult.ok,
  represented: [
    sitemapPlanningResult.taskId === "sitemap-audit",
    sitemapPlanningResult.workItems.length === sitemapItemCount,
    sitemapPlanningResult.batches.length === 4,
    sitemapPlanningResult.batches.every(
      (batch) =>
        batch.workItemIds.length === sitemapBatchSize &&
        batch.deterministicOrder.length === sitemapBatchSize,
    ),
    sitemapPlanningResult.steps.some(
      (step) => step.kind === "policy_preflight",
    ),
    sitemapPlanningResult.steps.filter(
      (step) => step.kind === "batch_execution",
    ).length === 4,
    sitemapPlanningResult.verifier.verifierRequired,
    sitemapPlanningResult.audit.auditRequired,
    sitemapPlanningResult.issues.length === 0,
  ],
};

export const approvalGatedPolicyPlan: AgenticRunnerPolicyPlan = {
  policyGateId: "policy-approval-gated-plan",
  status: "requires_approval",
  decisionReference: "decision-approval-required",
  approvalRequired: true,
  approvalState: "required",
  reasons: ["A human approval checkpoint is required before execution."],
  issues: [],
};

export const approvalGatedPlanningInput: AgenticRunnerPlanningInput = {
  taskId: "approval-gated-plan",
  taskContract: {
    kind: "reference",
    reference: {
      id: "task-contract-approval-gated-plan",
    },
  },
  workItems: [
    {
      id: "approval-work-item-001",
      state: "pending",
      batchId: "approval-batch-001",
    },
  ],
  batches: [
    {
      id: "approval-batch-001",
      workItemIds: ["approval-work-item-001"],
      expectedItemCount: 1,
      completedCount: 0,
      failedCount: 0,
      skippedCount: 0,
      retryableCount: 0,
    },
  ],
  mode: "plan",
  options: {
    requireAudit: true,
    requireApproval: true,
  },
  policyRequirements: [approvalGatedPolicyPlan],
};

export const approvalGatedPlanningResult = planAgenticRunner(
  approvalGatedPlanningInput,
);

export const approvalGatedPlanningChecks: PlanningLogicExampleChecks = {
  ok: !approvalGatedPlanningResult.ok,
  represented: [
    approvalGatedPlanningResult.policy.some(
      (policyPlan) => policyPlan.approvalRequired,
    ),
    approvalGatedPlanningResult.adapterBoundary.approvalRequired,
    approvalGatedPlanningResult.prerequisites.some(
      (prerequisite) =>
        prerequisite.kind === "approval" && prerequisite.status === "blocked",
    ),
    approvalGatedPlanningResult.steps.some((step) => step.kind === "approval"),
    approvalGatedPlanningResult.steps.every(
      (step) => step.kind !== "batch_execution",
    ),
  ],
};

export const blockedPolicyIssue: AgenticRunnerPlanningIssue = {
  code: "POLICY_DENIED_OPERATION",
  message: "The requested operation is denied by policy.",
  severity: "error",
  category: "policy_failure",
  policyGateId: "policy-denied-operation",
  retryable: false,
  createdAt: plannedAt,
};

export const blockedPolicyPlanningInput: AgenticRunnerPlanningInput = {
  taskId: "blocked-policy-plan",
  taskContract: {
    kind: "reference",
    reference: {
      id: "task-contract-blocked-policy-plan",
    },
  },
  workItems: [
    {
      id: "blocked-work-item-001",
      state: "pending",
      batchId: "blocked-batch-001",
    },
  ],
  batches: [
    {
      id: "blocked-batch-001",
      workItemIds: ["blocked-work-item-001"],
      expectedItemCount: 1,
      completedCount: 0,
      failedCount: 0,
      skippedCount: 0,
      retryableCount: 0,
    },
  ],
  mode: "plan",
  options: {
    requireAudit: true,
  },
  policyRequirements: [
    {
      policyGateId: "policy-denied-operation",
      status: "denied",
      decisionReference: "decision-operation-denied",
      approvalRequired: false,
      reasons: ["The policy plan denies executable batch work."],
      issues: [blockedPolicyIssue],
      metadata: {
        deniedOperations: ["batch.execute"],
      },
    },
  ],
};

export const blockedPolicyPlanningResult = planAgenticRunner(
  blockedPolicyPlanningInput,
);

export const blockedPolicyPlanningChecks: PlanningLogicExampleChecks = {
  ok: !blockedPolicyPlanningResult.ok,
  represented: [
    blockedPolicyPlanningResult.policy.some(
      (policyPlan) => policyPlan.status === "denied",
    ),
    blockedPolicyPlanningResult.issues.some(
      (issue) => issue.code === "POLICY_DENIED_OPERATION",
    ),
    blockedPolicyPlanningResult.steps.some(
      (step) => step.kind === "policy_preflight" && step.state === "blocked",
    ),
    blockedPolicyPlanningResult.steps.every(
      (step) => step.kind !== "batch_execution",
    ),
  ],
};

export const resumePlan: AgenticRunnerResumePlan = {
  resumeCursorReference: {
    id: "resume-cursor-sitemap-audit",
    path: "state/sitemap-audit/resume.json",
    version: "4",
  },
  nextStepId: "step-batch-003",
  nextBatchId: "batch-003",
  pendingWorkItemIds: ["sitemap-url-201", "sitemap-url-202"],
  retryableWorkItemIds: ["sitemap-url-118"],
  updatedAt: "2026-08-04T10:15:00.000Z",
};

export const resumePlanningInput: AgenticRunnerPlanningInput = {
  taskId: "sitemap-audit",
  taskContract: {
    kind: "reference",
    reference: {
      id: "task-contract-sitemap-audit",
    },
  },
  workItems: [
    {
      id: "sitemap-url-118",
      state: "retryable",
      batchId: "batch-003",
      issues: [
        {
          code: "RETRYABLE_FETCH_FAILURE",
          message: "Fetch failed and can be retried.",
          severity: "warning",
          category: "execution_failure",
          retryable: true,
          createdAt: "2026-08-04T10:00:00.000Z",
        },
      ],
    },
    {
      id: "sitemap-url-201",
      state: "pending",
      batchId: "batch-003",
    },
    {
      id: "sitemap-url-202",
      state: "pending",
      batchId: "batch-003",
    },
  ],
  batches: [
    {
      id: "batch-003",
      workItemIds: ["sitemap-url-118", "sitemap-url-201", "sitemap-url-202"],
      expectedItemCount: 3,
      completedCount: 0,
      failedCount: 0,
      skippedCount: 0,
      retryableCount: 1,
    },
  ],
  mode: "resume",
  options: {
    requireAudit: true,
    requireVerifier: true,
  },
  verifierRequirements: sitemapVerifierRequirements,
  resumeData: resumePlan,
  metadata: {
    allowedOperations: ["batch.resume"],
  },
};

export const resumePlanningResult = planAgenticRunner(resumePlanningInput);

export const resumePlanningChecks: PlanningLogicExampleChecks = {
  ok: resumePlanningResult.ok,
  represented: [
    resumePlanningResult.resume?.nextStepId === "step-batch-003",
    resumePlanningResult.resume?.nextBatchId === "batch-003",
    resumePlanningResult.resume?.pendingWorkItemIds.join(",") ===
      "sitemap-url-201,sitemap-url-202",
    resumePlanningResult.resume?.retryableWorkItemIds.join(",") ===
      "sitemap-url-118",
    resumePlanningResult.resume?.updatedAt === "2026-08-04T10:15:00.000Z",
    resumePlanningResult.steps.some((step) => step.kind === "resume_update"),
  ],
};

export const verifierGatedPlanningInput: AgenticRunnerPlanningInput = {
  taskId: "verifier-gated-executable-plan",
  taskContract: {
    kind: "reference",
    reference: {
      id: "task-contract-verifier-gated-executable-plan",
    },
  },
  workItems: [
    {
      id: "verifier-work-item-001",
      state: "pending",
      batchId: "verifier-batch-001",
    },
  ],
  batches: [
    {
      id: "verifier-batch-001",
      workItemIds: ["verifier-work-item-001"],
      expectedItemCount: 1,
      completedCount: 0,
      failedCount: 0,
      skippedCount: 0,
      retryableCount: 0,
    },
  ],
  mode: "dry_run",
  options: {
    requireAudit: true,
    requireVerifier: true,
  },
  verifierRequirements: {
    verifierRequired: true,
    verifierId: "coverage-verifier-executable",
    expectedCoverageRule:
      "expected_items == completed_items + explicitly_failed_items + explicitly_skipped_items",
    completionGatedByVerifier: true,
    issues: [],
    metadata: {
      completedStateRepresented: false,
    },
  },
};

export const verifierGatedPlanningResult = planAgenticRunner(
  verifierGatedPlanningInput,
);

export const verifierGatedPlanningChecks: PlanningLogicExampleChecks = {
  ok: verifierGatedPlanningResult.ok,
  represented: [
    verifierGatedPlanningResult.verifier.verifierRequired,
    verifierGatedPlanningResult.verifier.completionGatedByVerifier,
    verifierGatedPlanningResult.steps.some(
      (step) => step.kind === "verification" && step.verifierRequired,
    ),
    verifierGatedPlanningResult.steps.every(
      (step) => step.state !== "completed",
    ),
  ],
};

export const auditExpectationGapPlan: AgenticRunnerAuditExpectationPlan = {
  expectedAuditEventIds: [
    "audit-policy-preflight-planned",
    "audit-batch-001-planned",
    "audit-batch-002-planned",
  ],
  requiredEventKinds: ["policy.preflight.planned", "batch.execution.planned"],
  missingAuditEventIds: ["audit-batch-002-planned"],
  auditRequired: true,
  issues: [],
};

export const auditExpectationGapPlanningInput: AgenticRunnerPlanningInput = {
  taskId: "audit-expectation-gap",
  taskContract: {
    kind: "reference",
    reference: {
      id: "task-contract-audit-expectation-gap",
    },
  },
  mode: "plan",
  options: {
    requireAudit: true,
  },
  auditRequirements: auditExpectationGapPlan,
};

export const auditExpectationGapPlanningResult = planAgenticRunner(
  auditExpectationGapPlanningInput,
);

export const auditExpectationGapPlanningChecks: PlanningLogicExampleChecks = {
  ok: !auditExpectationGapPlanningResult.ok,
  represented: [
    auditExpectationGapPlanningResult.audit.expectedAuditEventIds.length === 3,
    auditExpectationGapPlanningResult.audit.missingAuditEventIds?.join(",") ===
      "audit-batch-002-planned",
    auditExpectationGapPlanningResult.issues.some(
      (issue) => issue.code === "AUDIT_EXPECTATION_MISSING_EVENT_ID",
    ),
  ],
};

export const duplicateWorkItemPlanningInput: AgenticRunnerPlanningInput = {
  taskId: "duplicate-work-item-plan",
  taskContract: {
    kind: "reference",
    reference: {
      id: "task-contract-duplicate-work-item-plan",
    },
  },
  workItems: [
    {
      id: "duplicate-work-item-001",
      state: "pending",
    },
    {
      id: "duplicate-work-item-001",
      state: "pending",
    },
  ],
  mode: "plan",
  options: {
    requireAudit: true,
    requireVerifier: true,
  },
  verifierRequirements: {
    verifierRequired: true,
    completionGatedByVerifier: true,
    issues: [],
  },
};

export const duplicateWorkItemPlanningResult = planAgenticRunner(
  duplicateWorkItemPlanningInput,
);

export const duplicateWorkItemPlanningChecks: PlanningLogicExampleChecks = {
  ok:
    !duplicateWorkItemPlanningResult.ok ||
    duplicateWorkItemPlanningResult.summary.issueCount > 0,
  represented: [
    duplicateWorkItemPlanningResult.issues.some(
      (issue) => issue.code === "DUPLICATE_WORK_ITEM_ID",
    ),
  ],
};

export const missingBatchReferencePlanningInput: AgenticRunnerPlanningInput = {
  taskId: "missing-batch-reference-plan",
  taskContract: {
    kind: "reference",
    reference: {
      id: "task-contract-missing-batch-reference-plan",
    },
  },
  workItems: [
    {
      id: "known-work-item-001",
      state: "pending",
      batchId: "batch-with-missing-reference",
    },
  ],
  batches: [
    {
      id: "batch-with-missing-reference",
      workItemIds: ["known-work-item-001", "missing-work-item-999"],
      expectedItemCount: 2,
      completedCount: 0,
      failedCount: 0,
      skippedCount: 0,
      retryableCount: 0,
    },
  ],
  mode: "plan",
  options: {
    requireAudit: true,
    requireVerifier: true,
  },
  verifierRequirements: {
    verifierRequired: true,
    completionGatedByVerifier: true,
    issues: [],
  },
};

export const missingBatchReferencePlanningResult = planAgenticRunner(
  missingBatchReferencePlanningInput,
);

export const missingBatchReferencePlanningChecks: PlanningLogicExampleChecks = {
  ok: !missingBatchReferencePlanningResult.ok,
  represented: [
    missingBatchReferencePlanningResult.issues.some(
      (issue) => issue.code === "BATCH_REFERENCES_MISSING_WORK_ITEM",
    ),
  ],
};

function planningResultWithoutSummary(
  result: AgenticRunnerPlanningResult,
): Omit<AgenticRunnerPlanningResult, "summary"> {
  return {
    ok: result.ok,
    taskId: result.taskId,
    mode: result.mode,
    prerequisites: result.prerequisites,
    workItems: result.workItems,
    batches: result.batches,
    steps: result.steps,
    policy: result.policy,
    adapterBoundary: result.adapterBoundary,
    audit: result.audit,
    verifier: result.verifier,
    resume: result.resume,
    issues: result.issues,
  };
}

export const sitemapPlanningSummaryFromHelper = summarizeAgenticRunnerPlanningResult(
  planningResultWithoutSummary(sitemapPlanningResult),
);

export const summaryBehaviorChecks: PlanningLogicExampleChecks = {
  ok:
    sitemapPlanningSummaryFromHelper.issueCount ===
    sitemapPlanningResult.issues.length,
  represented: [
    sitemapPlanningSummaryFromHelper.prerequisiteCount ===
      sitemapPlanningResult.prerequisites.length,
    sitemapPlanningSummaryFromHelper.workItemCount ===
      sitemapPlanningResult.workItems.length,
    sitemapPlanningSummaryFromHelper.batchCount ===
      sitemapPlanningResult.batches.length,
    sitemapPlanningSummaryFromHelper.stepCount ===
      sitemapPlanningResult.steps.length,
    sitemapPlanningSummaryFromHelper.policyGateCount ===
      sitemapPlanningResult.policy.length,
    sitemapPlanningSummaryFromHelper.expectedAuditEventCount ===
      sitemapPlanningResult.audit.expectedAuditEventIds.length,
    sitemapPlanningSummaryFromHelper.verifierRequired,
    !sitemapPlanningSummaryFromHelper.approvalRequired,
  ],
};

export function allPlanningLogicExampleChecksPass(): boolean {
  const exampleChecks = [
    sitemapPlanningChecks,
    approvalGatedPlanningChecks,
    blockedPolicyPlanningChecks,
    resumePlanningChecks,
    verifierGatedPlanningChecks,
    auditExpectationGapPlanningChecks,
    duplicateWorkItemPlanningChecks,
    missingBatchReferencePlanningChecks,
    summaryBehaviorChecks,
  ];

  return exampleChecks.every(
    (checks) => checks.ok && checks.represented.every(Boolean),
  );
}
