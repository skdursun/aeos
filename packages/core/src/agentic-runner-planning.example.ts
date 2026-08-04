import type {
  AgenticRunnerAdapterBoundaryPlan,
  AgenticRunnerAuditExpectationPlan,
  AgenticRunnerBatchPlan,
  AgenticRunnerPlanningInput,
  AgenticRunnerPlanningIssue,
  AgenticRunnerPlanningMode,
  AgenticRunnerPlanningOptions,
  AgenticRunnerPlanningPrerequisite,
  AgenticRunnerPlanningResult,
  AgenticRunnerPlanningSummary,
  AgenticRunnerPolicyPlan,
  AgenticRunnerResumePlan,
  AgenticRunnerStepPlan,
  AgenticRunnerVerifierRequirementPlan,
  AgenticRunnerWorkItemPlan,
} from "./agentic-runner-planning.js";

export const agenticRunnerPlanningExampleMode: AgenticRunnerPlanningMode =
  "plan";

export const agenticRunnerPlanningExampleOptions: AgenticRunnerPlanningOptions =
  {
    requireVerifier: true,
    requireAudit: true,
    requireApproval: false,
    maxWorkItems: 400,
    maxBatchSize: 100,
    outputMode: "summary",
    metadata: {
      deterministicBatches: true,
    },
  };

export const sitemapAuditPolicyPreflightStep: AgenticRunnerStepPlan = {
  id: "step-policy-preflight",
  kind: "policy_preflight",
  state: "pending",
  dependsOn: [],
  requiredPolicyGateId: "policy-sitemap-audit",
  expectedAuditEventIds: ["audit-policy-preflight-planned"],
  verifierRequired: false,
  issues: [],
};

export const sitemapAuditBatchPlans: readonly AgenticRunnerBatchPlan[] = [
  {
    id: "batch-001",
    workItemIds: ["sitemap-url-001", "sitemap-url-002"],
    expectedItemCount: 2,
    deterministicOrder: ["sitemap-url-001", "sitemap-url-002"],
    issues: [],
    metadata: {
      range: "1-100",
    },
  },
  {
    id: "batch-002",
    workItemIds: ["sitemap-url-101", "sitemap-url-102"],
    expectedItemCount: 2,
    deterministicOrder: ["sitemap-url-101", "sitemap-url-102"],
    issues: [],
    metadata: {
      range: "101-200",
    },
  },
  {
    id: "batch-003",
    workItemIds: ["sitemap-url-201", "sitemap-url-202"],
    expectedItemCount: 2,
    deterministicOrder: ["sitemap-url-201", "sitemap-url-202"],
    issues: [],
    metadata: {
      range: "201-300",
    },
  },
  {
    id: "batch-004",
    workItemIds: ["sitemap-url-301", "sitemap-url-302"],
    expectedItemCount: 2,
    deterministicOrder: ["sitemap-url-301", "sitemap-url-302"],
    issues: [],
    metadata: {
      range: "301-400",
    },
  },
];

export const sitemapAuditWorkItemPlan: AgenticRunnerWorkItemPlan = {
  id: "sitemap-url-001",
  sourceUrl: "https://example.test/sitemap.xml#url-001",
  initialState: "pending",
  batchId: "batch-001",
  expectedArtifactIds: ["artifact-sitemap-url-001-audit"],
  issues: [],
};

export const sitemapAuditPolicyPlan: AgenticRunnerPolicyPlan = {
  policyGateId: "policy-sitemap-audit",
  status: "allowed",
  decisionReference: "decision-sitemap-audit-allowed",
  approvalRequired: false,
  reasons: ["Read-only sitemap audit is permitted by policy."],
  issues: [],
};

export const sitemapAuditAdapterBoundaryPlan: AgenticRunnerAdapterBoundaryPlan =
  {
    modelAdapterReferences: [],
    toolAdapterReferences: [],
    allowedOperations: ["http.read", "artifact.plan"],
    deniedOperations: ["filesystem.write", "cli.execute"],
    approvalRequired: false,
    issues: [],
  };

export const sitemapAuditExpectationPlan: AgenticRunnerAuditExpectationPlan = {
  expectedAuditEventIds: [
    "audit-policy-preflight-planned",
    "audit-batch-001-planned",
    "audit-batch-002-planned",
    "audit-batch-003-planned",
    "audit-batch-004-planned",
    "audit-verifier-handoff-planned",
  ],
  requiredEventKinds: [
    "policy.preflight.planned",
    "batch.execution.planned",
    "verification.handoff.planned",
  ],
  auditRequired: true,
  issues: [],
};

export const sitemapAuditVerifierRequirementPlan: AgenticRunnerVerifierRequirementPlan =
  {
    verifierRequired: true,
    verifierId: "coverage-verifier-sitemap",
    expectedCoverageRule:
      "expected_items == completed_items + explicitly_failed_items + explicitly_skipped_items",
    completionGatedByVerifier: true,
    issues: [],
  };

export const sitemapAuditSummary: AgenticRunnerPlanningSummary = {
  prerequisiteCount: 4,
  workItemCount: 400,
  batchCount: 4,
  stepCount: 6,
  policyGateCount: 1,
  adapterReferenceCount: 0,
  expectedAuditEventCount: 6,
  verifierRequired: true,
  approvalRequired: false,
  issueCount: 0,
};

export const sitemapAuditPlanningInput: AgenticRunnerPlanningInput = {
  taskId: "sitemap-audit",
  taskContract: {
    kind: "reference",
    reference: {
      id: "task-contract-sitemap-audit",
      path: "tasks/sitemap-audit.json",
      version: "1",
    },
  },
  mode: agenticRunnerPlanningExampleMode,
  options: agenticRunnerPlanningExampleOptions,
  policyRequirements: [sitemapAuditPolicyPlan],
  adapterReferences: [],
  adapterKinds: [],
  auditRequirements: sitemapAuditExpectationPlan,
  verifierRequirements: sitemapAuditVerifierRequirementPlan,
  metadata: {
    expectedWorkItems: 400,
    executionPerformed: false,
  },
};

export const sitemapAuditPlanningResult: AgenticRunnerPlanningResult = {
  ok: true,
  taskId: "sitemap-audit",
  mode: "plan",
  prerequisites: [
    {
      id: "prereq-task-contract",
      kind: "task_contract",
      status: "satisfied",
      required: true,
      issues: [],
    },
    {
      id: "prereq-policy",
      kind: "policy",
      status: "satisfied",
      required: true,
      issues: [],
    },
    {
      id: "prereq-audit",
      kind: "audit",
      status: "satisfied",
      required: true,
      issues: [],
    },
    {
      id: "prereq-verifier",
      kind: "verifier",
      status: "satisfied",
      required: true,
      issues: [],
    },
  ],
  workItems: [sitemapAuditWorkItemPlan],
  batches: sitemapAuditBatchPlans,
  steps: [
    sitemapAuditPolicyPreflightStep,
    {
      id: "step-batch-001",
      kind: "batch_execution",
      state: "pending",
      dependsOn: ["step-policy-preflight"],
      expectedAuditEventIds: ["audit-batch-001-planned"],
      verifierRequired: false,
      issues: [],
    },
    {
      id: "step-batch-002",
      kind: "batch_execution",
      state: "pending",
      dependsOn: ["step-batch-001"],
      expectedAuditEventIds: ["audit-batch-002-planned"],
      verifierRequired: false,
      issues: [],
    },
    {
      id: "step-batch-003",
      kind: "batch_execution",
      state: "pending",
      dependsOn: ["step-batch-002"],
      expectedAuditEventIds: ["audit-batch-003-planned"],
      verifierRequired: false,
      issues: [],
    },
    {
      id: "step-batch-004",
      kind: "batch_execution",
      state: "pending",
      dependsOn: ["step-batch-003"],
      expectedAuditEventIds: ["audit-batch-004-planned"],
      verifierRequired: false,
      issues: [],
    },
    {
      id: "step-verifier-handoff",
      kind: "verification",
      state: "pending",
      dependsOn: ["step-batch-004"],
      expectedAuditEventIds: ["audit-verifier-handoff-planned"],
      verifierRequired: true,
      issues: [],
    },
  ],
  policy: [sitemapAuditPolicyPlan],
  adapterBoundary: sitemapAuditAdapterBoundaryPlan,
  audit: sitemapAuditExpectationPlan,
  verifier: sitemapAuditVerifierRequirementPlan,
  issues: [],
  summary: sitemapAuditSummary,
};

export const approvalPrerequisite: AgenticRunnerPlanningPrerequisite = {
  id: "prereq-human-approval",
  kind: "approval",
  status: "blocked",
  required: true,
  reason: "Human approval is required before execution planning can proceed.",
  issues: [],
};

export const waitingForApprovalPolicyPlan: AgenticRunnerPolicyPlan = {
  policyGateId: "policy-human-approval",
  status: "requires_approval",
  decisionReference: "decision-human-approval-required",
  approvalRequired: true,
  approvalState: "required",
  reasons: ["The planned operation requires a human approval checkpoint."],
  issues: [],
};

export const waitingForApprovalAdapterBoundaryPlan: AgenticRunnerAdapterBoundaryPlan =
  {
    modelAdapterReferences: [],
    toolAdapterReferences: [],
    allowedOperations: ["approval.request"],
    deniedOperations: ["batch.execute"],
    approvalRequired: true,
    issues: [],
    metadata: {
      humanApprovalRequired: true,
    },
  };

export const waitingForApprovalPlanningResult: AgenticRunnerPlanningResult = {
  ok: false,
  taskId: "approval-gated-runner",
  mode: "plan",
  prerequisites: [approvalPrerequisite],
  workItems: [],
  batches: [],
  steps: [
    {
      id: "step-request-approval",
      kind: "approval",
      state: "pending",
      dependsOn: [],
      requiredPolicyGateId: "policy-human-approval",
      expectedAuditEventIds: ["audit-approval-request-planned"],
      verifierRequired: false,
      issues: [],
    },
  ],
  policy: [waitingForApprovalPolicyPlan],
  adapterBoundary: waitingForApprovalAdapterBoundaryPlan,
  audit: {
    expectedAuditEventIds: ["audit-approval-request-planned"],
    requiredEventKinds: ["approval.request.planned"],
    auditRequired: true,
    issues: [],
  },
  verifier: {
    verifierRequired: false,
    completionGatedByVerifier: false,
    issues: [],
  },
  issues: [],
  summary: {
    prerequisiteCount: 1,
    workItemCount: 0,
    batchCount: 0,
    stepCount: 1,
    policyGateCount: 1,
    adapterReferenceCount: 0,
    expectedAuditEventCount: 1,
    verifierRequired: false,
    approvalRequired: true,
    issueCount: 0,
  },
};

export const blockedPolicyIssue: AgenticRunnerPlanningIssue = {
  code: "POLICY_DENIED_OPERATION",
  message: "The requested write operation is denied by policy.",
  severity: "error",
  category: "policy_failure",
  prerequisiteId: "prereq-policy",
  policyGateId: "policy-denied-write",
  retryable: false,
  createdAt: "2026-08-04T09:00:00.000Z",
};

export const blockedPolicyPlanningResult: AgenticRunnerPlanningResult = {
  ok: false,
  taskId: "blocked-policy-plan",
  mode: "plan",
  prerequisites: [
    {
      id: "prereq-policy",
      kind: "policy",
      status: "failed",
      required: true,
      reason: "Policy denied the requested operation.",
      issues: [blockedPolicyIssue],
    },
  ],
  workItems: [],
  batches: [],
  steps: [
    {
      id: "step-policy-preflight",
      kind: "policy_preflight",
      state: "blocked",
      dependsOn: [],
      requiredPolicyGateId: "policy-denied-write",
      expectedAuditEventIds: ["audit-policy-denial-planned"],
      verifierRequired: false,
      issues: [blockedPolicyIssue],
    },
  ],
  policy: [
    {
      policyGateId: "policy-denied-write",
      status: "denied",
      decisionReference: "decision-write-denied",
      approvalRequired: false,
      reasons: ["filesystem.write is not allowed for this planning request."],
      issues: [blockedPolicyIssue],
    },
  ],
  adapterBoundary: {
    modelAdapterReferences: [],
    toolAdapterReferences: [],
    allowedOperations: [],
    deniedOperations: ["filesystem.write"],
    approvalRequired: false,
    issues: [blockedPolicyIssue],
  },
  audit: {
    expectedAuditEventIds: ["audit-policy-denial-planned"],
    requiredEventKinds: ["policy.denial.planned"],
    auditRequired: true,
    issues: [],
  },
  verifier: {
    verifierRequired: false,
    completionGatedByVerifier: false,
    issues: [],
  },
  issues: [blockedPolicyIssue],
  summary: {
    prerequisiteCount: 1,
    workItemCount: 0,
    batchCount: 0,
    stepCount: 1,
    policyGateCount: 1,
    adapterReferenceCount: 0,
    expectedAuditEventCount: 1,
    verifierRequired: false,
    approvalRequired: false,
    issueCount: 1,
  },
};

export const resumePlanningExample: AgenticRunnerResumePlan = {
  resumeCursorReference: {
    id: "resume-cursor-sitemap-audit-2026-08-04",
    path: "state/sitemap-audit/resume.json",
    version: "4",
  },
  nextStepId: "step-batch-003",
  nextBatchId: "batch-003",
  pendingWorkItemIds: ["sitemap-url-201", "sitemap-url-202"],
  retryableWorkItemIds: ["sitemap-url-118"],
  updatedAt: "2026-08-04T10:15:00.000Z",
};

export const resumePlanningResult: AgenticRunnerPlanningResult = {
  ok: true,
  taskId: "sitemap-audit",
  mode: "resume",
  prerequisites: [
    {
      id: "prereq-resume-state",
      kind: "work_items",
      status: "present",
      required: true,
      issues: [],
    },
  ],
  workItems: [],
  batches: [],
  steps: [
    {
      id: "step-resume-update",
      kind: "resume_update",
      state: "pending",
      dependsOn: [],
      expectedAuditEventIds: ["audit-resume-update-planned"],
      verifierRequired: false,
      issues: [],
    },
    {
      id: "step-batch-003",
      kind: "batch_execution",
      state: "pending",
      dependsOn: ["step-resume-update"],
      expectedAuditEventIds: ["audit-batch-003-resume-planned"],
      verifierRequired: false,
      issues: [],
    },
  ],
  policy: [],
  adapterBoundary: {
    modelAdapterReferences: [],
    toolAdapterReferences: [],
    allowedOperations: ["batch.execute"],
    deniedOperations: [],
    approvalRequired: false,
    issues: [],
  },
  audit: {
    expectedAuditEventIds: [
      "audit-resume-update-planned",
      "audit-batch-003-resume-planned",
    ],
    requiredEventKinds: ["resume.update.planned", "batch.execution.planned"],
    auditRequired: true,
    issues: [],
  },
  verifier: {
    verifierRequired: true,
    verifierId: "coverage-verifier-sitemap",
    expectedCoverageRule:
      "expected_items == completed_items + explicitly_failed_items + explicitly_skipped_items",
    completionGatedByVerifier: true,
    issues: [],
  },
  resume: resumePlanningExample,
  issues: [],
  summary: {
    prerequisiteCount: 1,
    workItemCount: 3,
    batchCount: 1,
    stepCount: 2,
    policyGateCount: 0,
    adapterReferenceCount: 0,
    expectedAuditEventCount: 2,
    verifierRequired: true,
    approvalRequired: false,
    issueCount: 0,
  },
};

export const verifierGatedCompletionPlan: AgenticRunnerVerifierRequirementPlan =
  {
    verifierRequired: true,
    verifierId: "coverage-verifier-completion",
    expectedCoverageRule:
      "expected_items == completed_items + explicitly_failed_items + explicitly_skipped_items",
    completionGatedByVerifier: true,
    issues: [],
    metadata: {
      completionStatePlanned: false,
      verifierHandoffRequired: true,
    },
  };

export const verifierGatedCompletionPlanningResult: AgenticRunnerPlanningResult =
  {
    ok: true,
    taskId: "verifier-gated-completion",
    mode: "verify",
    prerequisites: [
      {
        id: "prereq-verifier",
        kind: "verifier",
        status: "satisfied",
        required: true,
        issues: [],
      },
    ],
    workItems: [],
    batches: [],
    steps: [
      {
        id: "step-verifier-handoff",
        kind: "verification",
        state: "pending",
        dependsOn: [],
        expectedAuditEventIds: ["audit-verifier-handoff-planned"],
        verifierRequired: true,
        issues: [],
      },
    ],
    policy: [],
    adapterBoundary: {
      modelAdapterReferences: [],
      toolAdapterReferences: [],
      allowedOperations: ["verifier.handoff"],
      deniedOperations: ["runner.complete"],
      approvalRequired: false,
      issues: [],
    },
    audit: {
      expectedAuditEventIds: ["audit-verifier-handoff-planned"],
      requiredEventKinds: ["verification.handoff.planned"],
      auditRequired: true,
      issues: [],
    },
    verifier: verifierGatedCompletionPlan,
    issues: [],
    summary: {
      prerequisiteCount: 1,
      workItemCount: 0,
      batchCount: 0,
      stepCount: 1,
      policyGateCount: 0,
      adapterReferenceCount: 0,
      expectedAuditEventCount: 1,
      verifierRequired: true,
      approvalRequired: false,
      issueCount: 0,
    },
  };

export const auditExpectationGapIssue: AgenticRunnerPlanningIssue = {
  code: "AUDIT_EXPECTATION_GAP",
  message: "A required audit event is expected but not currently represented.",
  severity: "warning",
  category: "audit_failure",
  auditEventIds: ["audit-batch-002-planned"],
  retryable: true,
  createdAt: "2026-08-04T11:00:00.000Z",
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
  issues: [auditExpectationGapIssue],
};

export const auditExpectationGapPlanningResult: AgenticRunnerPlanningResult = {
  ok: false,
  taskId: "audit-expectation-gap",
  mode: "plan",
  prerequisites: [
    {
      id: "prereq-audit",
      kind: "audit",
      status: "incomplete",
      required: true,
      reason: "One planned audit event is missing from the expectation set.",
      issues: [auditExpectationGapIssue],
    },
  ],
  workItems: [],
  batches: [],
  steps: [
    {
      id: "step-audit-gap-review",
      kind: "audit_append",
      state: "blocked",
      dependsOn: [],
      expectedAuditEventIds: auditExpectationGapPlan.expectedAuditEventIds,
      verifierRequired: false,
      issues: [auditExpectationGapIssue],
    },
  ],
  policy: [],
  adapterBoundary: {
    modelAdapterReferences: [],
    toolAdapterReferences: [],
    allowedOperations: [],
    deniedOperations: ["batch.execute"],
    approvalRequired: false,
    issues: [auditExpectationGapIssue],
  },
  audit: auditExpectationGapPlan,
  verifier: {
    verifierRequired: false,
    completionGatedByVerifier: false,
    issues: [],
  },
  issues: [auditExpectationGapIssue],
  summary: {
    prerequisiteCount: 1,
    workItemCount: 0,
    batchCount: 0,
    stepCount: 1,
    policyGateCount: 0,
    adapterReferenceCount: 0,
    expectedAuditEventCount: 3,
    verifierRequired: false,
    approvalRequired: false,
    issueCount: 1,
  },
};
