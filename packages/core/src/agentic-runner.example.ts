import type {
  AgenticRunnerAdapterReference,
  AgenticRunnerAuditHandoff,
  AgenticRunnerExecutionBoundary,
  AgenticRunnerInput,
  AgenticRunnerIssue,
  AgenticRunnerMode,
  AgenticRunnerOptions,
  AgenticRunnerPlan,
  AgenticRunnerPolicyGate,
  AgenticRunnerResult,
  AgenticRunnerResumeState,
  AgenticRunnerState,
  AgenticRunnerStep,
  AgenticRunnerStepState,
  AgenticRunnerSummary,
  AgenticRunnerVerifierHandoff,
} from "./agentic-runner.js";

const exampleUpdatedAt = "2026-08-04T09:00:00.000Z";

export const plannedRunnerMode: AgenticRunnerMode = "plan";

export const plannedRunnerState: AgenticRunnerState = "planned";

export const pendingStepState: AgenticRunnerStepState = "pending";

export const plannedRunnerOptions: AgenticRunnerOptions = {
  dryRun: true,
  requireHumanApproval: false,
  maxWorkItems: 400,
  maxBatchSize: 20,
  maxAttempts: 1,
  outputMode: "summary",
  metadata: {
    contractExample: true,
  },
};

export const modelAdapterReference: AgenticRunnerAdapterReference = {
  adapterId: "adapter:model:contract-example",
  kind: "model",
  capabilityNames: ["planning"],
  status: "not_run",
  metadata: {
    callsPerformed: 0,
  },
};

export const toolAdapterReference: AgenticRunnerAdapterReference = {
  adapterId: "adapter:tool:contract-example",
  kind: "tool",
  capabilityNames: ["read_only_inspection"],
  status: "not_run",
};

export const policyPreflightGate: AgenticRunnerPolicyGate = {
  status: "evaluated",
  result: "allowed",
  policyStatus: "allow",
  reasons: ["planning mode does not perform execution"],
  issues: [],
  auditEventIds: ["audit:policy:preflight"],
  evaluatedAt: exampleUpdatedAt,
};

export const plannedAuditHandoff: AgenticRunnerAuditHandoff = {
  plannedAuditEventIds: [
    "audit:runner:planned",
    "audit:policy:preflight",
    "audit:verifier:required",
  ],
  emittedAuditEventIds: ["audit:policy:preflight"],
  missingAuditEventIds: ["audit:runner:planned", "audit:verifier:required"],
  lastAuditEventId: "audit:policy:preflight",
  auditStatus: "planned",
  correlationId: "correlation:task:contract-example",
};

export const requiredVerifierHandoff: AgenticRunnerVerifierHandoff = {
  verifierRequired: true,
  verifierStatus: "pending",
  coverageStatus: "unknown",
  verifierIssues: [],
  auditEventIds: ["audit:verifier:required"],
};

export const inventoryStep: AgenticRunnerStep = {
  id: "step:inventory",
  order: 1,
  title: "Represent expected work inventory",
  state: "pending",
  workItemIds: ["item:inventory"],
  batchId: "batch:planning",
  requiredPolicyDecisionIds: ["policy:preflight"],
  expectedAuditEventIds: ["audit:runner:planned"],
  adapterReferences: [modelAdapterReference],
  updatedAt: exampleUpdatedAt,
};

export const verifierGateStep: AgenticRunnerStep = {
  id: "step:verify",
  order: 2,
  title: "Require external verifier before completion",
  state: pendingStepState,
  workItemIds: ["item:verify"],
  batchId: "batch:verification",
  expectedAuditEventIds: ["audit:verifier:required"],
  updatedAt: exampleUpdatedAt,
};

export const plannedRunnerPlan: AgenticRunnerPlan = {
  steps: [inventoryStep, verifierGateStep],
  expectedWorkItemCount: 2,
  expectedBatchCount: 2,
  requiredApprovals: [],
  requiredPolicyChecks: ["policy:preflight"],
  expectedAuditEvents: [
    "audit:runner:planned",
    "audit:policy:preflight",
    "audit:verifier:required",
  ],
  verifierRequired: true,
};

export const plannedExecutionBoundary: AgenticRunnerExecutionBoundary = {
  modelAdapter: modelAdapterReference,
  toolAdapter: toolAdapterReference,
  allowedOperations: ["plan"],
  deniedOperations: ["execute", "write_files", "invoke_tools"],
  permissionMode: "read_only",
  humanApprovalRequired: false,
  policyDecisionIds: ["policy:preflight"],
  metadata: {
    executionPerformed: false,
  },
};

export const plannedRunnerInput: AgenticRunnerInput = {
  taskId: "contract-example",
  task: {
    kind: "reference",
    id: "contract-example",
    path: "TASKS/contract-example.md",
  },
  mode: plannedRunnerMode,
  options: plannedRunnerOptions,
  policyGate: policyPreflightGate,
  adapterReferences: [modelAdapterReference, toolAdapterReference],
  auditReferences: [plannedAuditHandoff],
  verifierHandoff: requiredVerifierHandoff,
  metadata: {
    scenario: "planned_runner_execution",
  },
};

export const plannedRunnerSummary: AgenticRunnerSummary = {
  plannedSteps: 2,
  completedSteps: 0,
  failedSteps: 0,
  blockedSteps: 0,
  retryableSteps: 0,
  expectedWorkItems: 2,
  completedWorkItems: 0,
  pendingWorkItems: 2,
  retryableWorkItems: 0,
  auditEventsEmitted: 1,
  verifierIssueCount: 0,
  issueCount: 0,
};

export const plannedRunnerResult: AgenticRunnerResult = {
  ok: false,
  taskId: "contract-example",
  state: plannedRunnerState,
  mode: plannedRunnerMode,
  plan: plannedRunnerPlan,
  policy: policyPreflightGate,
  executionBoundary: plannedExecutionBoundary,
  audit: plannedAuditHandoff,
  verifier: requiredVerifierHandoff,
  issues: [],
  summary: plannedRunnerSummary,
};

export const approvalRequiredPolicyGate: AgenticRunnerPolicyGate = {
  status: "waiting_for_approval",
  result: "needs_approval",
  policyStatus: "requires_approval",
  reasons: ["write operation requires human approval"],
  issues: [],
  auditEventIds: ["audit:policy:approval_required"],
  evaluatedAt: exampleUpdatedAt,
};

export const approvalRequiredBoundary: AgenticRunnerExecutionBoundary = {
  modelAdapter: modelAdapterReference,
  allowedOperations: ["plan"],
  deniedOperations: ["write_files"],
  permissionMode: "read_only",
  humanApprovalRequired: true,
  policyDecisionIds: ["policy:approval_required"],
};

export const waitingForApprovalResult: AgenticRunnerResult = {
  ok: false,
  taskId: "approval-required",
  state: "waiting_for_approval",
  mode: "execute",
  plan: {
    steps: [
      {
        id: "step:await-approval",
        order: 1,
        title: "Wait for human approval before execution",
        state: "blocked",
        workItemIds: ["item:write"],
        requiredApprovalIds: ["approval:write"],
        requiredPolicyDecisionIds: ["policy:approval_required"],
      },
    ],
    expectedWorkItemCount: 1,
    expectedBatchCount: 1,
    requiredApprovals: ["approval:write"],
    requiredPolicyChecks: ["policy:approval_required"],
    expectedAuditEvents: ["audit:policy:approval_required"],
    verifierRequired: true,
  },
  policy: approvalRequiredPolicyGate,
  executionBoundary: approvalRequiredBoundary,
  audit: {
    plannedAuditEventIds: ["audit:policy:approval_required"],
    emittedAuditEventIds: ["audit:policy:approval_required"],
    missingAuditEventIds: [],
    lastAuditEventId: "audit:policy:approval_required",
    auditStatus: "partial",
  },
  verifier: {
    verifierRequired: true,
    verifierStatus: "pending",
    coverageStatus: "blocked",
    verifierIssues: [],
  },
  issues: [],
  summary: {
    plannedSteps: 1,
    completedSteps: 0,
    failedSteps: 0,
    blockedSteps: 1,
    retryableSteps: 0,
    expectedWorkItems: 1,
    completedWorkItems: 0,
    pendingWorkItems: 1,
    retryableWorkItems: 0,
    auditEventsEmitted: 1,
    verifierIssueCount: 0,
    issueCount: 0,
  },
};

export const incompleteSitemapIssue: AgenticRunnerIssue = {
  code: "RUNNER_INCOMPLETE_COVERAGE",
  message: "Only 20 of 400 sitemap work items are complete.",
  severity: "error",
  category: "coverage_failure",
  retryable: true,
  createdAt: exampleUpdatedAt,
};

export const incompleteSitemapResult: AgenticRunnerResult = {
  ok: false,
  taskId: "sitemap-audit",
  state: "incomplete",
  mode: "execute",
  plan: {
    steps: [
      {
        id: "step:sitemap-batch-001",
        order: 1,
        title: "Audit first sitemap batch",
        state: "completed",
        workItemIds: ["url:001", "url:002"],
        batchId: "batch:001",
        adapterReferences: [modelAdapterReference],
      },
      {
        id: "step:sitemap-batch-002",
        order: 2,
        title: "Continue pending sitemap batches",
        state: "pending",
        workItemIds: ["url:021", "url:022"],
        batchId: "batch:002",
      },
    ],
    expectedWorkItemCount: 400,
    expectedBatchCount: 20,
    requiredApprovals: [],
    requiredPolicyChecks: ["policy:sitemap:preflight"],
    expectedAuditEvents: ["audit:sitemap:start", "audit:sitemap:batch:001"],
    verifierRequired: true,
  },
  policy: {
    status: "evaluated",
    result: "allowed",
    reasons: ["read-only sitemap audit allowed"],
    issues: [],
    evaluatedAt: exampleUpdatedAt,
  },
  executionBoundary: {
    modelAdapter: modelAdapterReference,
    allowedOperations: ["read_urls", "summarize_findings"],
    deniedOperations: ["write_files", "deploy"],
    permissionMode: "read_only",
    humanApprovalRequired: false,
  },
  audit: {
    plannedAuditEventIds: ["audit:sitemap:start", "audit:sitemap:batch:001"],
    emittedAuditEventIds: ["audit:sitemap:start", "audit:sitemap:batch:001"],
    missingAuditEventIds: [],
    lastAuditEventId: "audit:sitemap:batch:001",
    auditStatus: "partial",
  },
  verifier: {
    verifierRequired: true,
    verifierStatus: "pending",
    coverageStatus: "incomplete",
    verifierIssues: [
      {
        code: "ITEM_COVERAGE_INCOMPLETE",
        message: "380 sitemap work items remain pending.",
        severity: "error",
        category: "coverage_failure",
        retryable: true,
        createdAt: exampleUpdatedAt,
      },
    ],
  },
  resume: {
    nextStepId: "step:sitemap-batch-002",
    nextBatchId: "batch:002",
    pendingWorkItemIds: ["url:021", "url:022"],
    retryableWorkItemIds: [],
    updatedAt: exampleUpdatedAt,
  },
  issues: [incompleteSitemapIssue],
  summary: {
    plannedSteps: 2,
    completedSteps: 1,
    failedSteps: 0,
    blockedSteps: 0,
    retryableSteps: 0,
    expectedWorkItems: 400,
    completedWorkItems: 20,
    pendingWorkItems: 380,
    retryableWorkItems: 0,
    auditEventsEmitted: 2,
    verifierIssueCount: 1,
    issueCount: 1,
  },
};

export const verifiedCompleteResult: AgenticRunnerResult = {
  ok: true,
  taskId: "verified-complete",
  state: "verified",
  mode: "verify",
  plan: {
    steps: [
      {
        id: "step:verified-work",
        order: 1,
        title: "Represent completed and verified work",
        state: "verified",
        workItemIds: ["item:verified:001", "item:verified:002"],
        expectedAuditEventIds: ["audit:verified:work"],
      },
    ],
    expectedWorkItemCount: 2,
    expectedBatchCount: 1,
    requiredApprovals: [],
    requiredPolicyChecks: ["policy:verified:preflight"],
    expectedAuditEvents: ["audit:verified:work", "audit:verified:report"],
    verifierRequired: true,
  },
  policy: {
    status: "evaluated",
    result: "allowed",
    reasons: ["verification completed after all expected work was accounted for"],
    issues: [],
    evaluatedAt: exampleUpdatedAt,
  },
  executionBoundary: {
    modelAdapter: modelAdapterReference,
    allowedOperations: ["verify"],
    deniedOperations: ["execute", "write_files"],
    permissionMode: "read_only",
    humanApprovalRequired: false,
  },
  audit: {
    plannedAuditEventIds: ["audit:verified:work", "audit:verified:report"],
    emittedAuditEventIds: ["audit:verified:work", "audit:verified:report"],
    missingAuditEventIds: [],
    lastAuditEventId: "audit:verified:report",
    auditStatus: "complete",
  },
  verifier: {
    verifierRequired: true,
    verifierResultReference: "verification:verified-complete",
    verifierStatus: "verified",
    coverageStatus: "satisfied",
    verifierIssues: [],
    auditEventIds: ["audit:verified:report"],
  },
  issues: [],
  summary: {
    plannedSteps: 1,
    completedSteps: 0,
    failedSteps: 0,
    blockedSteps: 0,
    retryableSteps: 0,
    expectedWorkItems: 2,
    completedWorkItems: 2,
    pendingWorkItems: 0,
    retryableWorkItems: 0,
    auditEventsEmitted: 2,
    verifierIssueCount: 0,
    issueCount: 0,
  },
};

export const resumeRunnerState: AgenticRunnerResumeState = {
  resumeCursor: "resume:sitemap-audit:batch-002",
  nextStepId: "step:sitemap-batch-002",
  nextBatchId: "batch:002",
  pendingWorkItemIds: ["url:021", "url:022", "url:023"],
  retryableWorkItemIds: ["url:019"],
  updatedAt: exampleUpdatedAt,
};

export const auditHandoffGapIssue: AgenticRunnerIssue = {
  code: "RUNNER_AUDIT_HANDOFF_GAP",
  message: "A planned audit event was not emitted before verifier handoff.",
  severity: "error",
  category: "audit_failure",
  auditEventIds: ["audit:gap:missing"],
  retryable: true,
  createdAt: exampleUpdatedAt,
};

export const auditHandoffGap: AgenticRunnerAuditHandoff = {
  plannedAuditEventIds: [
    "audit:gap:planned",
    "audit:gap:emitted",
    "audit:gap:missing",
  ],
  emittedAuditEventIds: ["audit:gap:planned", "audit:gap:emitted"],
  missingAuditEventIds: ["audit:gap:missing"],
  lastAuditEventId: "audit:gap:emitted",
  auditStatus: "partial",
  correlationId: "correlation:audit-gap",
};
