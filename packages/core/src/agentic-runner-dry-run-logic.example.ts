import type {
  AgenticRunnerDryRunAdapterCallPreview,
  AgenticRunnerDryRunAuditPreview,
  AgenticRunnerDryRunBatchPreview,
  AgenticRunnerDryRunInput,
  AgenticRunnerDryRunIssue,
  AgenticRunnerDryRunResult,
  AgenticRunnerDryRunResumePreview,
  AgenticRunnerDryRunStepPreview,
  AgenticRunnerDryRunVerifierPreview,
  AgenticRunnerDryRunWorkItemPreview,
} from "./agentic-runner-dry-run.js";
import {
  createAgenticDryRunAdapterCallPreviews,
  createAgenticDryRunAuditPreview,
  createAgenticDryRunBatchPreviews,
  createAgenticDryRunResumePreview,
  createAgenticDryRunStepPreviews,
  createAgenticDryRunVerifierPreview,
  createAgenticDryRunWorkItemPreviews,
  runAgenticRunnerDryRun,
  summarizeAgenticRunnerDryRunResult,
} from "./agentic-runner-dry-run-logic.js";

const exampleUpdatedAt = "2026-08-04T09:00:00.000Z";

const baseRunnerPlan = (taskId: string): AgenticRunnerDryRunInput["runnerPlan"] => ({
  kind: "data",
  data: {
    taskId,
    previewOnly: true,
    noRunnerExecution: true,
  },
  reference: {
    id: `${taskId}.runner-plan.preview`,
  },
});

const dryRunIssue = (
  code: string,
  message: string,
  category: AgenticRunnerDryRunIssue["category"],
  severity: AgenticRunnerDryRunIssue["severity"],
): AgenticRunnerDryRunIssue => ({
  code,
  message,
  category,
  severity,
  createdAt: exampleUpdatedAt,
});

const stepPreview = (
  stepId: string,
  plannedAdapterCallIds: readonly string[],
  expectedAuditEventIds: readonly string[],
): AgenticRunnerDryRunStepPreview => ({
  stepId,
  stepKind: "batch_execution",
  previewState: "preview_ready",
  wouldRun: true,
  approvalRequired: false,
  plannedAdapterCallIds,
  expectedAuditEventIds,
  verifierRequired: true,
  issues: [],
});

const batchPreview = (
  batchId: string,
  workItemIds: readonly string[],
): AgenticRunnerDryRunBatchPreview => ({
  batchId,
  workItemIds,
  expectedItemCount: workItemIds.length,
  previewState: "preview_ready",
  wouldRun: true,
  issues: [],
});

const workItemPreview = (
  workItemId: string,
  batchId: string,
): AgenticRunnerDryRunWorkItemPreview => ({
  workItemId,
  batchId,
  previewState: "preview_ready",
  wouldProcess: true,
  expectedArtifactIds: [`${workItemId}.preview.json`],
  issues: [],
});

const modelAdapterPreview = (
  callId: string,
): AgenticRunnerDryRunAdapterCallPreview => ({
  callId,
  kind: "model",
  adapterId: "model-adapter-preview",
  operation: "preview_patch_plan",
  wouldCall: false,
  approvalRequired: false,
  inputReference: {
    id: `${callId}.input`,
  },
  outputReference: null,
  issues: [],
  observationOnly: true,
  completionAuthority: false,
  metadata: {
    previewOnly: true,
    adapterNotCompletionAuthority: true,
  },
});

const toolAdapterPreview = (
  callId: string,
): AgenticRunnerDryRunAdapterCallPreview => ({
  callId,
  kind: "tool",
  adapterId: "tool-adapter-preview",
  operation: "preview_tool_invocation",
  wouldCall: false,
  approvalRequired: false,
  inputReference: {
    id: `${callId}.input`,
  },
  issues: [],
  observationOnly: true,
  completionAuthority: false,
  metadata: {
    previewOnly: true,
    adapterNotCompletionAuthority: true,
    outputReferenceAbsent: true,
  },
});

const safeDryRunInput: AgenticRunnerDryRunInput = {
  taskId: "safe-preview",
  mode: "dry_run",
  runnerPlan: baseRunnerPlan("safe-preview"),
  options: {
    requireAudit: true,
    requireVerifier: true,
    completionGatedByVerifier: true,
    outputMode: "summary",
    metadata: {
      noFilesystemIo: true,
      noRunnerExecution: true,
    },
  },
  plannedSteps: [
    stepPreview("step-safe-preview", ["model-call-safe"], [
      "audit.safe.plan.previewed",
      "audit.safe.verifier.required",
    ]),
  ],
  plannedBatches: [batchPreview("batch-safe", ["work-safe-001", "work-safe-002"])],
  plannedWorkItems: [
    workItemPreview("work-safe-001", "batch-safe"),
    workItemPreview("work-safe-002", "batch-safe"),
  ],
  adapterCalls: [modelAdapterPreview("model-call-safe")],
  auditPreviewInput: {
    kind: "data",
    data: {
      expectedAuditEventIds: ["audit.safe.plan.previewed"],
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
};

export const safeDryRunPreviewResult = runAgenticRunnerDryRun(safeDryRunInput);

export const safeDryRunPreviewChecks = {
  state: safeDryRunPreviewResult.state,
  stateRequiresVerification: safeDryRunPreviewResult.state === "verification_required",
  adapterCallsWouldExecute: safeDryRunPreviewResult.adapterCalls.some(
    (adapterCall) => adapterCall.wouldCall,
  ),
  wouldWriteAudit: safeDryRunPreviewResult.audit.wouldWriteAudit,
  wouldRunVerifier: safeDryRunPreviewResult.verifier.wouldRunVerifier,
  finalStateNotCompleted: safeDryRunPreviewResult.state !== ("completed" as string),
};

const approvalDryRunInput: AgenticRunnerDryRunInput = {
  ...safeDryRunInput,
  taskId: "approval-preview",
  runnerPlan: baseRunnerPlan("approval-preview"),
  options: {
    ...safeDryRunInput.options,
    requireApproval: true,
  },
  plannedSteps: [
    {
      ...stepPreview("step-approval-preview", ["model-call-approval"], [
        "audit.approval.requested",
      ]),
      approvalRequired: true,
    },
  ],
  plannedBatches: [batchPreview("batch-approval", ["work-approval-001"])],
  plannedWorkItems: [workItemPreview("work-approval-001", "batch-approval")],
  adapterCalls: [modelAdapterPreview("model-call-approval")],
};

export const approvalRequiredDryRunResult = runAgenticRunnerDryRun(
  approvalDryRunInput,
);

export const approvalRequiredDryRunChecks = {
  state: approvalRequiredDryRunResult.state,
  approvalRequiredRepresented:
    approvalRequiredDryRunResult.steps[0]?.approvalRequired === true,
  adapterCallsWouldExecute: approvalRequiredDryRunResult.adapterCalls.some(
    (adapterCall) => adapterCall.wouldCall,
  ),
  verifierWouldRun: approvalRequiredDryRunResult.verifier.wouldRunVerifier,
};

const blockedIssue = dryRunIssue(
  "OPERATION_DENIED",
  "Dry-run preview identifies a denied operation.",
  "policy_failure",
  "error",
);

const blockedDryRunInput: AgenticRunnerDryRunInput = {
  taskId: "blocked-preview",
  mode: "dry_run",
  runnerPlan: baseRunnerPlan("blocked-preview"),
  options: {
    requireAudit: true,
    requireVerifier: true,
    completionGatedByVerifier: true,
  },
  policyPreview: {
    kind: "data",
    data: {
      status: "denied",
      decision: "denied",
      issues: [blockedIssue],
    },
  },
  adapterBoundaryPreview: {
    kind: "data",
    data: {
      deniedOperations: ["write_outside_workspace"],
    },
  },
  plannedSteps: [
    {
      ...stepPreview("step-blocked-preview", [], ["audit.blocked.previewed"]),
      previewState: "blocked",
      wouldRun: false,
      blockedReason: "write_outside_workspace denied",
      issues: [blockedIssue],
    },
  ],
  plannedBatches: [
    {
      ...batchPreview("batch-blocked", ["work-blocked-001"]),
      previewState: "blocked",
      wouldRun: false,
      issues: [blockedIssue],
    },
  ],
  plannedWorkItems: [
    {
      ...workItemPreview("work-blocked-001", "batch-blocked"),
      previewState: "blocked",
      wouldProcess: false,
      issues: [blockedIssue],
    },
  ],
  adapterCalls: [
    {
      ...toolAdapterPreview("tool-call-blocked"),
      deniedReason: "write_outside_workspace denied",
      issues: [blockedIssue],
    },
  ],
};

export const blockedDryRunResult = runAgenticRunnerDryRun(blockedDryRunInput);

export const blockedDryRunChecks = {
  state: blockedDryRunResult.state,
  stateBlockedOrFailed:
    blockedDryRunResult.state === "blocked" || blockedDryRunResult.state === "failed",
  issueCount: blockedDryRunResult.issues.length,
  adapterCallsWouldExecute: blockedDryRunResult.adapterCalls.some(
    (adapterCall) => adapterCall.wouldCall,
  ),
  wouldWriteAudit: blockedDryRunResult.audit.wouldWriteAudit,
  wouldRunVerifier: blockedDryRunResult.verifier.wouldRunVerifier,
};

const makeSitemapWorkItem = (index: number): AgenticRunnerDryRunWorkItemPreview => {
  const paddedIndex = String(index).padStart(3, "0");
  const batchIndex = Math.ceil(index / 100);

  return workItemPreview(`sitemap-page-${paddedIndex}`, `sitemap-batch-${batchIndex}`);
};

const sitemapWorkItems: readonly AgenticRunnerDryRunWorkItemPreview[] = Array.from(
  { length: 400 },
  (_unused, index) => makeSitemapWorkItem(index + 1),
);

const sitemapBatches: readonly AgenticRunnerDryRunBatchPreview[] = Array.from(
  { length: 4 },
  (_unused, index) => {
    const batchNumber = index + 1;
    const workItemIds = sitemapWorkItems
      .slice(index * 100, batchNumber * 100)
      .map((workItem) => workItem.workItemId);

    return batchPreview(`sitemap-batch-${batchNumber}`, workItemIds);
  },
);

const sitemapDryRunInput: AgenticRunnerDryRunInput = {
  taskId: "sitemap-audit",
  mode: "dry_run",
  runnerPlan: baseRunnerPlan("sitemap-audit"),
  options: {
    requireAudit: true,
    requireVerifier: true,
    completionGatedByVerifier: true,
    maxWorkItems: 400,
    maxBatchSize: 100,
  },
  plannedSteps: [
    stepPreview("step-sitemap-preview", [], [
      "audit.sitemap.plan.previewed",
      "audit.sitemap.verifier.required",
    ]),
  ],
  plannedBatches: sitemapBatches,
  plannedWorkItems: sitemapWorkItems,
  verifierPreviewInput: {
    kind: "data",
    data: {
      verifierRequired: true,
      wouldRunVerifier: false,
    },
  },
};

export const sitemapDryRunResult = runAgenticRunnerDryRun(sitemapDryRunInput);

export const sitemapDryRunPreviewCounts = {
  plannedWorkItems: sitemapDryRunResult.workItems.length,
  completedWorkItems: 0,
  plannedBatches: sitemapDryRunResult.batches.length,
  verifierRequired: sitemapDryRunResult.verifier.verifierRequired,
  wouldRunVerifier: sitemapDryRunResult.verifier.wouldRunVerifier,
  finalStateNotCompleted: sitemapDryRunResult.state !== ("completed" as string),
};

const adapterPreviewInput: AgenticRunnerDryRunInput = {
  taskId: "adapter-preview",
  mode: "dry_run",
  runnerPlan: baseRunnerPlan("adapter-preview"),
  plannedSteps: [
    stepPreview(
      "step-adapter-preview",
      ["model-call-preview", "tool-call-preview"],
      ["audit.adapter.previewed"],
    ),
  ],
  plannedBatches: [batchPreview("batch-adapter", ["work-adapter-001"])],
  plannedWorkItems: [workItemPreview("work-adapter-001", "batch-adapter")],
  adapterCalls: [
    modelAdapterPreview("model-call-preview"),
    toolAdapterPreview("tool-call-preview"),
  ],
};

export const adapterCallPreviews = createAgenticDryRunAdapterCallPreviews(
  adapterPreviewInput,
);

export const adapterPreviewChecks = {
  modelAdapterPreview: adapterCallPreviews.find(
    (adapterCall) => adapterCall.kind === "model",
  ),
  toolAdapterPreview: adapterCallPreviews.find(
    (adapterCall) => adapterCall.kind === "tool",
  ),
  wouldCallAdapters: adapterCallPreviews.some((adapterCall) => adapterCall.wouldCall),
  outputReferencesArePreviewOnly: adapterCallPreviews.every(
    (adapterCall) => adapterCall.outputReference === null || !adapterCall.wouldCall,
  ),
  adaptersAreNotCompletionAuthority: adapterCallPreviews.every(
    (adapterCall) => adapterCall.completionAuthority === false,
  ),
};

const auditPreviewInput: AgenticRunnerDryRunInput = {
  ...adapterPreviewInput,
  taskId: "audit-preview",
  auditPreviewInput: {
    kind: "data",
    data: {
      expectedAuditEventIds: [
        "audit.input.accepted",
        "audit.adapter.previewed",
        "audit.verifier.required",
      ],
      emittedAuditEventIds: ["audit.input.accepted"],
      missingAuditEventIds: ["audit.adapter.previewed", "audit.verifier.required"],
      wouldWriteAudit: false,
      auditReference: {
        id: "audit.preview.input",
        metadata: {
          inputDerivedOnly: true,
        },
      },
    },
  },
};

export const auditPreview: AgenticRunnerDryRunAuditPreview =
  createAgenticDryRunAuditPreview(auditPreviewInput);

export const auditPreviewChecks = {
  expectedAuditEventIds: auditPreview.expectedAuditEventIds,
  emittedAuditEventIds: auditPreview.emittedAuditEventIds,
  missingAuditEventIds: auditPreview.missingAuditEventIds,
  wouldWriteAudit: auditPreview.wouldWriteAudit,
};

const verifierPreviewInput: AgenticRunnerDryRunInput = {
  ...safeDryRunInput,
  taskId: "verifier-preview",
  verifierPreviewInput: {
    kind: "data",
    data: {
      verifierRequired: true,
      completionGatedByVerifier: true,
      wouldRunVerifier: false,
    },
  },
};

export const verifierPreview: AgenticRunnerDryRunVerifierPreview =
  createAgenticDryRunVerifierPreview(verifierPreviewInput);

export const verifierPreviewChecks = {
  verifierRequired: verifierPreview.verifierRequired,
  wouldRunVerifier: verifierPreview.wouldRunVerifier,
  verifierStatusNotVerified: verifierPreview.verifierStatus !== ("verified" as string),
  verifierResultReference: verifierPreview.verifierResultReference,
};

const resumePreviewInput: AgenticRunnerDryRunInput = {
  ...safeDryRunInput,
  taskId: "resume-preview",
  plannedSteps: [
    stepPreview("step-resume-001", [], ["audit.resume.first"]),
    stepPreview("step-resume-002", [], ["audit.resume.second"]),
  ],
  plannedBatches: [
    batchPreview("batch-resume-001", ["work-resume-001"]),
    batchPreview("batch-resume-002", ["work-resume-002", "work-resume-003"]),
  ],
  plannedWorkItems: [
    {
      ...workItemPreview("work-resume-001", "batch-resume-001"),
      previewState: "blocked",
      wouldProcess: false,
    },
    workItemPreview("work-resume-002", "batch-resume-002"),
    workItemPreview("work-resume-003", "batch-resume-002"),
  ],
  resumePreviewInput: {
    kind: "data",
    data: {
      nextStepId: "step-resume-002",
      nextBatchId: "batch-resume-002",
      pendingWorkItemIds: ["work-resume-002", "work-resume-003"],
      retryableWorkItemIds: ["work-resume-001"],
      wouldUpdateResume: false,
      updatedAt: exampleUpdatedAt,
    },
  },
};

export const resumePreview: AgenticRunnerDryRunResumePreview | undefined =
  createAgenticDryRunResumePreview(resumePreviewInput);

export const resumePreviewChecks = {
  nextStepId: resumePreview?.nextStepId,
  nextBatchId: resumePreview?.nextBatchId,
  pendingWorkItemIds: resumePreview?.pendingWorkItemIds ?? [],
  retryableWorkItemIds: resumePreview?.retryableWorkItemIds ?? [],
  wouldUpdateResume: resumePreview?.wouldUpdateResume ?? false,
};

const summaryBehaviorResult = runAgenticRunnerDryRun(adapterPreviewInput);

export const summaryBehavior = summarizeAgenticRunnerDryRunResult({
  ok: summaryBehaviorResult.ok,
  taskId: summaryBehaviorResult.taskId,
  mode: summaryBehaviorResult.mode,
  state: summaryBehaviorResult.state,
  plan: summaryBehaviorResult.plan,
  planningResult: summaryBehaviorResult.planningResult,
  lifecycle: summaryBehaviorResult.lifecycle,
  steps: summaryBehaviorResult.steps,
  batches: summaryBehaviorResult.batches,
  workItems: summaryBehaviorResult.workItems,
  adapterCalls: summaryBehaviorResult.adapterCalls,
  audit: summaryBehaviorResult.audit,
  verifier: summaryBehaviorResult.verifier,
  resume: summaryBehaviorResult.resume,
  issues: summaryBehaviorResult.issues,
});

export const summaryBehaviorChecks = {
  plannedStepsMatchesArray: summaryBehavior.plannedSteps === summaryBehaviorResult.steps.length,
  plannedBatchesMatchesArray:
    summaryBehavior.plannedBatches === summaryBehaviorResult.batches.length,
  plannedWorkItemsMatchesArray:
    summaryBehavior.plannedWorkItems === summaryBehaviorResult.workItems.length,
  wouldCallAdapters: summaryBehavior.wouldCallAdapters,
  wouldWriteAudit: summaryBehavior.wouldWriteAudit,
  wouldRunVerifier: summaryBehavior.wouldRunVerifier,
};

const deterministicFirstResult: AgenticRunnerDryRunResult =
  runAgenticRunnerDryRun(safeDryRunInput);
const deterministicSecondResult: AgenticRunnerDryRunResult =
  runAgenticRunnerDryRun(safeDryRunInput);

export const deterministicDryRunOutput = {
  first: deterministicFirstResult,
  second: deterministicSecondResult,
  equivalent:
    JSON.stringify(deterministicFirstResult) === JSON.stringify(deterministicSecondResult),
};

export const individualPreviewHelpers = {
  steps: createAgenticDryRunStepPreviews(safeDryRunInput),
  batches: createAgenticDryRunBatchPreviews(safeDryRunInput),
  workItems: createAgenticDryRunWorkItemPreviews(safeDryRunInput),
  adapterCalls: createAgenticDryRunAdapterCallPreviews(safeDryRunInput),
  audit: createAgenticDryRunAuditPreview(safeDryRunInput),
  verifier: createAgenticDryRunVerifierPreview(safeDryRunInput),
  resume: createAgenticDryRunResumePreview(safeDryRunInput),
};
