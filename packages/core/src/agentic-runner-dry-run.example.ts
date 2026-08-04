import type {
  AgenticRunnerDryRunAdapterCallPreview,
  AgenticRunnerDryRunAuditPreview,
  AgenticRunnerDryRunBatchPreview,
  AgenticRunnerDryRunInput,
  AgenticRunnerDryRunIssue,
  AgenticRunnerDryRunOptions,
  AgenticRunnerDryRunResult,
  AgenticRunnerDryRunResumePreview,
  AgenticRunnerDryRunState,
  AgenticRunnerDryRunStepPreview,
  AgenticRunnerDryRunSummary,
  AgenticRunnerDryRunVerifierPreview,
  AgenticRunnerDryRunWorkItemPreview,
} from "./agentic-runner-dry-run.js";

const exampleUpdatedAt = "2026-08-04T09:00:00.000Z";

export const safeDryRunOptions: AgenticRunnerDryRunOptions = {
  requirePolicy: true,
  requireApproval: false,
  requireAudit: true,
  requireVerifier: true,
  completionGatedByVerifier: true,
  maxWorkItems: 2,
  maxBatchSize: 2,
  outputMode: "summary",
  metadata: {
    contractOnly: true,
    noFilesystemIo: true,
    noRunnerExecution: true,
  },
};

export const safeDryRunState: AgenticRunnerDryRunState = "preview_ready";

export const safeStepPreview: AgenticRunnerDryRunStepPreview = {
  stepId: "step-plan-safe-preview",
  stepKind: "batch_execution",
  previewState: safeDryRunState,
  wouldRun: true,
  approvalRequired: false,
  plannedAdapterCallIds: ["adapter-call-model-preview"],
  expectedAuditEventIds: ["audit.safe.preview.expected"],
  verifierRequired: true,
  issues: [],
  metadata: {
    dryRunOnly: true,
  },
};

export const safeBatchPreview: AgenticRunnerDryRunBatchPreview = {
  batchId: "batch-safe-001",
  workItemIds: ["work-safe-001", "work-safe-002"],
  expectedItemCount: 2,
  previewState: safeDryRunState,
  wouldRun: true,
  issues: [],
};

export const safeWorkItemPreviews: readonly AgenticRunnerDryRunWorkItemPreview[] =
  [
    {
      workItemId: "work-safe-001",
      batchId: "batch-safe-001",
      previewState: safeDryRunState,
      wouldProcess: true,
      expectedArtifactIds: ["artifact-safe-001"],
      issues: [],
    },
    {
      workItemId: "work-safe-002",
      batchId: "batch-safe-001",
      previewState: safeDryRunState,
      wouldProcess: true,
      expectedArtifactIds: ["artifact-safe-002"],
      issues: [],
    },
  ];

export const modelAdapterCallPreview: AgenticRunnerDryRunAdapterCallPreview = {
  callId: "adapter-call-model-preview",
  kind: "model",
  adapterId: "model-adapter-preview",
  operation: "draft_patch_plan",
  wouldCall: false,
  approvalRequired: false,
  inputReference: {
    id: "input.model.preview",
    metadata: {
      source: "dry-run contract example",
    },
  },
  outputReference: null,
  issues: [],
  observationOnly: true,
  completionAuthority: false,
  metadata: {
    adapterNotCompletionAuthority: true,
    previewOnly: true,
  },
};

export const toolAdapterCallPreview: AgenticRunnerDryRunAdapterCallPreview = {
  callId: "adapter-call-tool-preview",
  kind: "tool",
  adapterId: "tool-adapter-preview",
  operation: "apply_patch",
  wouldCall: false,
  approvalRequired: false,
  inputReference: {
    id: "input.tool.preview",
  },
  issues: [],
  observationOnly: true,
  completionAuthority: false,
  metadata: {
    adapterNotCompletionAuthority: true,
    outputReferenceAbsentByContract: true,
  },
};

export const safeAuditPreview: AgenticRunnerDryRunAuditPreview = {
  expectedAuditEventIds: [
    "audit.safe.preview.expected",
    "audit.safe.verifier.expected",
  ],
  emittedAuditEventIds: [],
  missingAuditEventIds: [
    "audit.safe.preview.expected",
    "audit.safe.verifier.expected",
  ],
  wouldWriteAudit: false,
  auditStatus: "missing",
  issues: [],
  metadata: {
    auditWritesDisabled: true,
  },
};

export const safeVerifierPreview: AgenticRunnerDryRunVerifierPreview = {
  verifierRequired: true,
  wouldRunVerifier: false,
  verifierStatus: "required_not_run",
  coverageStatus: "incomplete",
  verifierResultReference: null,
  completionGatedByVerifier: true,
  completionGateSatisfied: false,
  issues: [],
  metadata: {
    verifierExecutionDisabled: true,
  },
};

export const safeResumePreview: AgenticRunnerDryRunResumePreview = {
  wouldUpdateResume: false,
  nextStepId: "step-plan-safe-preview",
  nextBatchId: "batch-safe-001",
  pendingWorkItemIds: ["work-safe-001", "work-safe-002"],
  retryableWorkItemIds: [],
  updatedAt: exampleUpdatedAt,
  issues: [],
  metadata: {
    previewOnly: true,
  },
};

export const safeDryRunSummary: AgenticRunnerDryRunSummary = {
  plannedSteps: 1,
  runnableSteps: 1,
  blockedSteps: 0,
  plannedBatches: 1,
  runnableBatches: 1,
  plannedWorkItems: 2,
  processableWorkItems: 2,
  plannedAdapterCalls: 1,
  wouldCallAdapters: 0,
  expectedAuditEvents: 2,
  wouldWriteAudit: false,
  verifierRequired: true,
  wouldRunVerifier: false,
  issueCount: 0,
};

export const safeDryRunInput: AgenticRunnerDryRunInput = {
  taskId: "safe-preview",
  mode: "dry_run",
  options: safeDryRunOptions,
  plannedSteps: [safeStepPreview],
  plannedBatches: [safeBatchPreview],
  plannedWorkItems: safeWorkItemPreviews,
  adapterCalls: [modelAdapterCallPreview],
  auditPreviewInput: {
    kind: "data",
    data: {
      expectedAuditEventIds: safeAuditPreview.expectedAuditEventIds,
      wouldWriteAudit: false,
    },
  },
  verifierPreviewInput: {
    kind: "data",
    data: {
      verifierRequired: true,
      wouldRunVerifier: false,
    },
  },
  resumePreviewInput: {
    kind: "data",
    data: {
      wouldUpdateResume: false,
      nextStepId: safeResumePreview.nextStepId,
    },
  },
};

export const safeDryRunResult: AgenticRunnerDryRunResult = {
  ok: true,
  taskId: safeDryRunInput.taskId,
  mode: "dry_run",
  state: safeDryRunState,
  steps: safeDryRunInput.plannedSteps,
  batches: safeDryRunInput.plannedBatches,
  workItems: safeDryRunInput.plannedWorkItems,
  adapterCalls: safeDryRunInput.adapterCalls ?? [],
  audit: safeAuditPreview,
  verifier: safeVerifierPreview,
  resume: safeResumePreview,
  issues: [],
  summary: safeDryRunSummary,
};

export const approvalDryRunIssue: AgenticRunnerDryRunIssue = {
  code: "APPROVAL_REQUIRED",
  message: "Dry-run preview is waiting for approval before execution could start.",
  severity: "info",
  category: "approval_failure",
  stepId: "step-approval-preview",
  retryable: true,
  createdAt: exampleUpdatedAt,
};

export const approvalDryRunResult: AgenticRunnerDryRunResult = {
  ok: true,
  taskId: "approval-preview",
  mode: "dry_run",
  state: "waiting_for_approval",
  steps: [
    {
      stepId: "step-approval-preview",
      stepKind: "approval",
      previewState: "waiting_for_approval",
      wouldRun: false,
      approvalRequired: true,
      plannedAdapterCallIds: ["adapter-call-approval-model-preview"],
      expectedAuditEventIds: ["audit.approval.request.expected"],
      verifierRequired: true,
      issues: [approvalDryRunIssue],
    },
  ],
  batches: [
    {
      batchId: "batch-approval-001",
      workItemIds: ["work-approval-001"],
      expectedItemCount: 1,
      previewState: "waiting_for_approval",
      wouldRun: false,
      issues: [approvalDryRunIssue],
    },
  ],
  workItems: [
    {
      workItemId: "work-approval-001",
      batchId: "batch-approval-001",
      previewState: "waiting_for_approval",
      wouldProcess: false,
      issues: [approvalDryRunIssue],
    },
  ],
  adapterCalls: [
    {
      callId: "adapter-call-approval-model-preview",
      kind: "model",
      adapterId: "model-adapter-preview",
      operation: "draft_approved_change",
      wouldCall: false,
      approvalRequired: true,
      issues: [approvalDryRunIssue],
      observationOnly: true,
      completionAuthority: false,
    },
  ],
  audit: {
    expectedAuditEventIds: ["audit.approval.request.expected"],
    emittedAuditEventIds: [],
    missingAuditEventIds: ["audit.approval.request.expected"],
    wouldWriteAudit: false,
    auditStatus: "pending",
    issues: [approvalDryRunIssue],
  },
  verifier: safeVerifierPreview,
  resume: {
    wouldUpdateResume: false,
    nextStepId: "step-approval-preview",
    nextBatchId: "batch-approval-001",
    pendingWorkItemIds: ["work-approval-001"],
    retryableWorkItemIds: [],
    updatedAt: exampleUpdatedAt,
    issues: [approvalDryRunIssue],
  },
  issues: [approvalDryRunIssue],
  summary: {
    plannedSteps: 1,
    runnableSteps: 0,
    blockedSteps: 0,
    plannedBatches: 1,
    runnableBatches: 0,
    plannedWorkItems: 1,
    processableWorkItems: 0,
    plannedAdapterCalls: 1,
    wouldCallAdapters: 0,
    expectedAuditEvents: 1,
    wouldWriteAudit: false,
    verifierRequired: true,
    wouldRunVerifier: false,
    issueCount: 1,
  },
};

export const blockedDryRunIssue: AgenticRunnerDryRunIssue = {
  code: "OPERATION_DENIED",
  message: "Dry-run preview identifies a denied operation and remains blocked.",
  severity: "error",
  category: "policy_failure",
  stepId: "step-denied-operation",
  createdAt: exampleUpdatedAt,
  metadata: {
    deniedOperation: "write_outside_workspace",
  },
};

export const blockedDryRunResult: AgenticRunnerDryRunResult = {
  ok: false,
  taskId: "blocked-preview",
  mode: "dry_run",
  state: "blocked",
  steps: [
    {
      stepId: "step-denied-operation",
      stepKind: "policy_preflight",
      previewState: "blocked",
      wouldRun: false,
      blockedReason: "write_outside_workspace denied",
      approvalRequired: false,
      plannedAdapterCallIds: [],
      expectedAuditEventIds: ["audit.denied.preview.expected"],
      verifierRequired: true,
      issues: [blockedDryRunIssue],
    },
  ],
  batches: [
    {
      batchId: "batch-blocked-001",
      workItemIds: ["work-blocked-001"],
      expectedItemCount: 1,
      previewState: "blocked",
      wouldRun: false,
      issues: [blockedDryRunIssue],
    },
  ],
  workItems: [
    {
      workItemId: "work-blocked-001",
      batchId: "batch-blocked-001",
      previewState: "blocked",
      wouldProcess: false,
      issues: [blockedDryRunIssue],
    },
  ],
  adapterCalls: [],
  audit: {
    expectedAuditEventIds: ["audit.denied.preview.expected"],
    emittedAuditEventIds: [],
    missingAuditEventIds: ["audit.denied.preview.expected"],
    wouldWriteAudit: false,
    auditStatus: "missing",
    issues: [blockedDryRunIssue],
  },
  verifier: {
    verifierRequired: true,
    wouldRunVerifier: false,
    verifierStatus: "blocked",
    coverageStatus: "blocked",
    verifierResultReference: null,
    completionGatedByVerifier: true,
    completionGateSatisfied: false,
    issues: [blockedDryRunIssue],
  },
  issues: [blockedDryRunIssue],
  summary: {
    plannedSteps: 1,
    runnableSteps: 0,
    blockedSteps: 1,
    plannedBatches: 1,
    runnableBatches: 0,
    plannedWorkItems: 1,
    processableWorkItems: 0,
    plannedAdapterCalls: 0,
    wouldCallAdapters: 0,
    expectedAuditEvents: 1,
    wouldWriteAudit: false,
    verifierRequired: true,
    wouldRunVerifier: false,
    issueCount: 1,
  },
};

export const makeSitemapWorkItemPreview = (
  index: number,
): AgenticRunnerDryRunWorkItemPreview => {
  const paddedIndex = String(index).padStart(3, "0");

  return {
    workItemId: `sitemap-page-${paddedIndex}`,
    batchId: `sitemap-batch-${Math.ceil(index / 100)}`,
    previewState: "preview_ready",
    wouldProcess: true,
    expectedArtifactIds: [`sitemap-page-${paddedIndex}.audit.json`],
    issues: [],
  };
};

export const sitemapDryRunWorkItems: readonly AgenticRunnerDryRunWorkItemPreview[] =
  Array.from({ length: 400 }, (_unused, index) =>
    makeSitemapWorkItemPreview(index + 1),
  );

export const sitemapDryRunBatches: readonly AgenticRunnerDryRunBatchPreview[] =
  [
    {
      batchId: "sitemap-batch-1",
      workItemIds: sitemapDryRunWorkItems
        .slice(0, 100)
        .map((item) => item.workItemId),
      expectedItemCount: 100,
      previewState: "preview_ready",
      wouldRun: true,
      issues: [],
    },
    {
      batchId: "sitemap-batch-2",
      workItemIds: sitemapDryRunWorkItems
        .slice(100, 200)
        .map((item) => item.workItemId),
      expectedItemCount: 100,
      previewState: "preview_ready",
      wouldRun: true,
      issues: [],
    },
    {
      batchId: "sitemap-batch-3",
      workItemIds: sitemapDryRunWorkItems
        .slice(200, 300)
        .map((item) => item.workItemId),
      expectedItemCount: 100,
      previewState: "preview_ready",
      wouldRun: true,
      issues: [],
    },
    {
      batchId: "sitemap-batch-4",
      workItemIds: sitemapDryRunWorkItems
        .slice(300, 400)
        .map((item) => item.workItemId),
      expectedItemCount: 100,
      previewState: "preview_ready",
      wouldRun: true,
      issues: [],
    },
  ];

export const sitemapDryRunResult: AgenticRunnerDryRunResult = {
  ok: true,
  taskId: "sitemap-audit",
  mode: "dry_run",
  state: "verification_required",
  steps: [
    {
      stepId: "step-sitemap-preview",
      stepKind: "batch_execution",
      previewState: "preview_ready",
      wouldRun: true,
      approvalRequired: false,
      plannedAdapterCallIds: [],
      expectedAuditEventIds: [
        "audit.sitemap.preview.expected",
        "audit.sitemap.verifier.expected",
      ],
      verifierRequired: true,
      issues: [],
    },
  ],
  batches: sitemapDryRunBatches,
  workItems: sitemapDryRunWorkItems,
  adapterCalls: [],
  audit: {
    expectedAuditEventIds: [
      "audit.sitemap.preview.expected",
      "audit.sitemap.verifier.expected",
    ],
    emittedAuditEventIds: [],
    missingAuditEventIds: [
      "audit.sitemap.preview.expected",
      "audit.sitemap.verifier.expected",
    ],
    wouldWriteAudit: false,
    auditStatus: "missing",
    issues: [],
  },
  verifier: {
    verifierRequired: true,
    wouldRunVerifier: false,
    verifierStatus: "required_not_run",
    coverageStatus: "incomplete",
    verifierResultReference: null,
    completionGatedByVerifier: true,
    completionGateSatisfied: false,
    issues: [],
  },
  resume: {
    wouldUpdateResume: false,
    nextStepId: "step-sitemap-preview",
    nextBatchId: "sitemap-batch-1",
    pendingWorkItemIds: sitemapDryRunWorkItems.map((item) => item.workItemId),
    retryableWorkItemIds: [],
    updatedAt: exampleUpdatedAt,
    issues: [],
  },
  issues: [],
  summary: {
    plannedSteps: 1,
    runnableSteps: 1,
    blockedSteps: 0,
    plannedBatches: 4,
    runnableBatches: 4,
    plannedWorkItems: 400,
    processableWorkItems: 400,
    plannedAdapterCalls: 0,
    wouldCallAdapters: 0,
    expectedAuditEvents: 2,
    wouldWriteAudit: false,
    verifierRequired: true,
    wouldRunVerifier: false,
    issueCount: 0,
  },
};

export const auditDryRunPreview: AgenticRunnerDryRunAuditPreview = {
  expectedAuditEventIds: [
    "audit.input.accepted",
    "audit.plan.preview.expected",
    "audit.verifier.preview.expected",
  ],
  emittedAuditEventIds: ["audit.input.accepted"],
  missingAuditEventIds: [
    "audit.plan.preview.expected",
    "audit.verifier.preview.expected",
  ],
  wouldWriteAudit: false,
  auditStatus: "partial",
  auditReference: {
    id: "audit-input-reference",
    metadata: {
      inputDerivedOnly: true,
    },
  },
  issues: [],
};

export const verifierDryRunPreview: AgenticRunnerDryRunVerifierPreview = {
  verifierRequired: true,
  wouldRunVerifier: false,
  verifierStatus: "required_not_run",
  coverageStatus: "incomplete",
  completionGatedByVerifier: true,
  completionGateSatisfied: false,
  issues: [],
  metadata: {
    verifierResultReferenceAbsentUnlessInputDerived: true,
  },
};

export const resumeDryRunPreview: AgenticRunnerDryRunResumePreview = {
  wouldUpdateResume: false,
  nextStepId: "step-resume-preview",
  nextBatchId: "batch-resume-002",
  pendingWorkItemIds: ["work-resume-002", "work-resume-003"],
  retryableWorkItemIds: ["work-resume-001"],
  updatedAt: exampleUpdatedAt,
  issues: [],
};

export const dryRunSummaryShape: AgenticRunnerDryRunSummary = {
  plannedSteps: 3,
  runnableSteps: 2,
  blockedSteps: 1,
  plannedBatches: 2,
  runnableBatches: 1,
  plannedWorkItems: 5,
  processableWorkItems: 3,
  plannedAdapterCalls: 2,
  wouldCallAdapters: 0,
  expectedAuditEvents: 4,
  wouldWriteAudit: false,
  verifierRequired: true,
  wouldRunVerifier: false,
  issueCount: 1,
};

