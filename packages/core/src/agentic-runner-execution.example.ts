import type {
  AgenticRunnerAdapterCallKind,
  AgenticRunnerAdapterCallRecord,
  AgenticRunnerApprovalExecution,
  AgenticRunnerAuditExecutionHandoff,
  AgenticRunnerBatchExecution,
  AgenticRunnerBatchExecutionState,
  AgenticRunnerExecutionInput,
  AgenticRunnerExecutionIssue,
  AgenticRunnerExecutionMode,
  AgenticRunnerExecutionOptions,
  AgenticRunnerExecutionResult,
  AgenticRunnerExecutionState,
  AgenticRunnerExecutionSummary,
  AgenticRunnerPolicyExecution,
  AgenticRunnerResumeUpdate,
  AgenticRunnerStepExecution,
  AgenticRunnerStepExecutionState,
  AgenticRunnerVerifierExecutionHandoff,
  AgenticRunnerWorkItemOutcome,
  AgenticRunnerWorkItemOutcomeState,
} from "./agentic-runner-execution.js";

export const executionExampleMode: AgenticRunnerExecutionMode = "dry_run";

export const executionExampleState: AgenticRunnerExecutionState = "preflight";

export const executionExampleStepState: AgenticRunnerStepExecutionState =
  "pending";

export const executionExampleBatchState: AgenticRunnerBatchExecutionState =
  "retryable";

export const executionExampleWorkItemOutcomeState:
  AgenticRunnerWorkItemOutcomeState = "completed";

export const executionExampleAdapterCallKind: AgenticRunnerAdapterCallKind =
  "model";

export const executionExampleOptions: AgenticRunnerExecutionOptions = {
  requirePolicy: true,
  requireApproval: false,
  requireAudit: true,
  requireVerifier: true,
  completionGatedByVerifier: true,
  maxWorkItems: 400,
  maxBatchSize: 50,
  maxAttempts: 2,
  timeoutMs: 120_000,
  outputMode: "summary",
  metadata: {
    exampleOnly: true,
  },
};

export const executionExampleIssue: AgenticRunnerExecutionIssue = {
  code: "verifier_not_run",
  message: "Completion is gated by verifier handoff and cannot be inferred.",
  severity: "warning",
  category: "verification_failure",
  retryable: true,
  createdAt: "2026-08-04T09:00:00.000Z",
};

export const executionExampleWorkItemOutcome: AgenticRunnerWorkItemOutcome = {
  workItemId: "item-001",
  batchId: "batch-001",
  state: "completed",
  observedAt: "2026-08-04T09:01:00.000Z",
  outputArtifactIds: ["artifact:item-001-report"],
  issues: [],
};

export const executionExampleAdapterCalls: readonly AgenticRunnerAdapterCallRecord[] =
  [
    {
      callId: "adapter-call-model-001",
      kind: "model",
      adapterId: "model:planner",
      operation: "propose-work-item-outcome",
      status: "ok",
      startedAt: "2026-08-04T09:01:00.000Z",
      completedAt: "2026-08-04T09:01:05.000Z",
      outputReference: {
        id: "model-output:item-001",
        version: "1",
      },
      issues: [],
      observationOnly: true,
      completionAuthority: false,
      metadata: {
        adapterRecordsAreObservationsOnly: true,
        notTaskCompletionAuthority: true,
      },
    },
    {
      callId: "adapter-call-tool-001",
      kind: "tool",
      adapterId: "tool:http-checker",
      operation: "observe-url-status",
      status: "ok",
      startedAt: "2026-08-04T09:01:06.000Z",
      completedAt: "2026-08-04T09:01:08.000Z",
      observedOutcomeReference: {
        id: "tool-observation:item-001",
        url: "https://example.test/page-001",
      },
      auditEventIds: ["audit:item-001-observed"],
      issues: [],
      observationOnly: true,
      completionAuthority: false,
      metadata: {
        adapterRecordsAreObservationsOnly: true,
        verifierStillRequiredForCompletion: true,
      },
    },
  ];

export const executionExampleStep: AgenticRunnerStepExecution = {
  stepId: "step-execute-batch-001",
  stepKind: "batch_execution",
  state: "completed",
  startedAt: "2026-08-04T09:01:00.000Z",
  completedAt: "2026-08-04T09:02:00.000Z",
  observedOutcomes: [executionExampleWorkItemOutcome],
  adapterCallIds: ["adapter-call-model-001", "adapter-call-tool-001"],
  auditEventIds: ["audit:item-001-observed"],
  issues: [],
};

export const executionExampleBatch: AgenticRunnerBatchExecution = {
  batchId: "batch-001",
  workItemIds: ["item-001", "item-002", "item-003"],
  state: "partially_completed",
  startedAt: "2026-08-04T09:01:00.000Z",
  expectedItemCount: 3,
  observedCompletedCount: 1,
  observedFailedCount: 0,
  observedSkippedCount: 0,
  observedRetryableCount: 2,
  issues: [],
};

export const executionExamplePolicy: AgenticRunnerPolicyExecution = {
  policyGateId: "policy:network",
  status: "checked",
  decision: "allowed",
  checkedAt: "2026-08-04T09:00:00.000Z",
  auditEventIds: ["audit:policy-network-checked"],
  issues: [],
};

export const executionExampleApproval: AgenticRunnerApprovalExecution = {
  approvalRequired: false,
  approvalStatus: "not_required",
  issues: [],
};

export const executionExampleAuditHandoff: AgenticRunnerAuditExecutionHandoff =
  {
    expectedAuditEventIds: [
      "audit:policy-network-checked",
      "audit:item-001-observed",
    ],
    emittedAuditEventIds: [
      "audit:policy-network-checked",
      "audit:item-001-observed",
    ],
    missingAuditEventIds: [],
    lastAuditEventId: "audit:item-001-observed",
    auditStatus: "complete",
    issues: [],
  };

export const executionExampleVerifierHandoff:
  AgenticRunnerVerifierExecutionHandoff = {
    verifierRequired: true,
    verifierStatus: "verified",
    verifierResultReference: {
      id: "verification:sitemap-audit",
      version: "1",
    },
    coverageStatus: "satisfied",
    checkedAt: "2026-08-04T09:03:00.000Z",
    completionGatedByVerifier: true,
    completionGateSatisfied: true,
    auditEventIds: ["audit:verification-satisfied"],
    issues: [],
  };

export const executionExampleResumeUpdate: AgenticRunnerResumeUpdate = {
  resumeCursorReference: {
    id: "resume:sitemap-audit",
    version: "1",
  },
  nextStepId: "step-execute-batch-002",
  nextBatchId: "batch-002",
  pendingWorkItemIds: ["url-021", "url-022"],
  retryableWorkItemIds: ["url-019", "url-020"],
  updatedAt: "2026-08-04T09:04:00.000Z",
};

export const executionExampleSummary: AgenticRunnerExecutionSummary = {
  plannedSteps: 1,
  executedSteps: 1,
  completedSteps: 1,
  failedSteps: 0,
  blockedSteps: 0,
  retryableSteps: 0,
  plannedBatches: 1,
  completedBatches: 0,
  failedBatches: 0,
  expectedWorkItems: 3,
  completedWorkItems: 1,
  failedWorkItems: 0,
  skippedWorkItems: 0,
  retryableWorkItems: 2,
  adapterCallCount: 2,
  auditEventsEmitted: 2,
  verifierIssueCount: 0,
  issueCount: 0,
};

export const dryRunExecutionInputExample: AgenticRunnerExecutionInput = {
  taskId: "dry-run-contract",
  mode: "dry_run",
  options: {
    requirePolicy: true,
    requireApproval: false,
    requireAudit: true,
    requireVerifier: true,
    completionGatedByVerifier: true,
    outputMode: "summary",
  },
  plannedSteps: [
    {
      stepId: "step-preflight",
      stepKind: "policy_preflight",
      state: "pending",
      observedOutcomes: [],
      adapterCallIds: [],
      auditEventIds: [],
      issues: [],
    },
    {
      stepId: "step-verify",
      stepKind: "verification",
      state: "pending",
      observedOutcomes: [],
      adapterCallIds: [],
      auditEventIds: [],
      issues: [],
    },
  ],
  plannedBatches: [
    {
      batchId: "batch-dry-run",
      workItemIds: ["item-001", "item-002"],
      state: "pending",
      expectedItemCount: 2,
      observedCompletedCount: 0,
      observedFailedCount: 0,
      observedSkippedCount: 0,
      observedRetryableCount: 0,
      issues: [],
    },
  ],
  plannedWorkItems: [
    {
      workItemId: "item-001",
      batchId: "batch-dry-run",
      state: "pending",
      issues: [],
    },
    {
      workItemId: "item-002",
      batchId: "batch-dry-run",
      state: "pending",
      issues: [],
    },
  ],
  adapterCalls: [],
  audit: {
    expectedAuditEventIds: ["audit:dry-run-planned"],
    emittedAuditEventIds: [],
    missingAuditEventIds: ["audit:dry-run-planned"],
    auditStatus: "pending",
    issues: [],
  },
  verifier: {
    verifierRequired: true,
    verifierStatus: "pending",
    coverageStatus: "unknown",
    completionGatedByVerifier: true,
    completionGateSatisfied: false,
    issues: [],
    metadata: {
      verifierRequiredButNotRun: true,
    },
  },
  metadata: {
    expectedExecutionState: "preflight",
    noAdapterCallsExecuted: true,
    noAuditEventsEmitted: true,
  },
};

export const waitingForApprovalExecutionResultExample:
  AgenticRunnerExecutionResult = {
    ok: false,
    taskId: "approval-gated-task",
    mode: "execute",
    state: "waiting_for_approval",
    steps: [
      {
        stepId: "step-approval",
        stepKind: "approval",
        state: "blocked",
        observedOutcomes: [],
        adapterCallIds: [],
        auditEventIds: [],
        issues: [],
      },
    ],
    batches: [],
    workItemOutcomes: [],
    policy: {
      policyGateId: "policy:write-access",
      status: "checked",
      decision: "needs_approval",
      checkedAt: "2026-08-04T10:00:00.000Z",
      issues: [],
    },
    approval: {
      approvalRequired: true,
      approvalStatus: "pending",
      requestedAt: "2026-08-04T10:00:05.000Z",
      issues: [],
    },
    adapterCalls: [],
    audit: {
      expectedAuditEventIds: ["audit:approval-requested"],
      emittedAuditEventIds: [],
      missingAuditEventIds: ["audit:approval-requested"],
      auditStatus: "pending",
      issues: [],
    },
    verifier: {
      verifierRequired: true,
      verifierStatus: "pending",
      coverageStatus: "unknown",
      completionGatedByVerifier: true,
      completionGateSatisfied: false,
      issues: [],
    },
    issues: [],
    summary: {
      plannedSteps: 1,
      executedSteps: 0,
      completedSteps: 0,
      failedSteps: 0,
      blockedSteps: 1,
      retryableSteps: 0,
      plannedBatches: 0,
      completedBatches: 0,
      failedBatches: 0,
      expectedWorkItems: 0,
      completedWorkItems: 0,
      failedWorkItems: 0,
      skippedWorkItems: 0,
      retryableWorkItems: 0,
      adapterCallCount: 0,
      auditEventsEmitted: 0,
      verifierIssueCount: 0,
      issueCount: 0,
    },
  };

const partialSitemapVerifierIssue: AgenticRunnerExecutionIssue = {
  code: "sitemap_coverage_incomplete",
  message: "Only 20 of 400 sitemap work items have terminal outcomes.",
  severity: "error",
  category: "coverage_failure",
  batchId: "batch-sitemap-001",
  retryable: true,
  createdAt: "2026-08-04T11:00:00.000Z",
};

export const partialSitemapExecutionResultExample:
  AgenticRunnerExecutionResult = {
    ok: false,
    taskId: "sitemap-audit",
    mode: "execute",
    state: "retryable",
    steps: [
      {
        stepId: "step-sitemap-batch-001",
        stepKind: "batch_execution",
        state: "retryable",
        startedAt: "2026-08-04T11:00:00.000Z",
        observedOutcomes: [
          {
            workItemId: "url-001",
            batchId: "batch-sitemap-001",
            state: "completed",
            observedAt: "2026-08-04T11:01:00.000Z",
            issues: [],
          },
          {
            workItemId: "url-021",
            batchId: "batch-sitemap-001",
            state: "retryable",
            observedAt: "2026-08-04T11:01:30.000Z",
            retryableReason: "Deferred until remaining sitemap URLs are visited.",
            issues: [],
          },
        ],
        adapterCallIds: ["adapter-call-model-sitemap-001"],
        auditEventIds: ["audit:sitemap-url-001"],
        issues: [partialSitemapVerifierIssue],
      },
    ],
    batches: [
      {
        batchId: "batch-sitemap-001",
        workItemIds: ["url-001", "url-020", "url-021", "url-400"],
        state: "retryable",
        startedAt: "2026-08-04T11:00:00.000Z",
        expectedItemCount: 400,
        observedCompletedCount: 20,
        observedFailedCount: 0,
        observedSkippedCount: 0,
        observedRetryableCount: 380,
        issues: [partialSitemapVerifierIssue],
        metadata: {
          representativeWorkItemIdsOnly: true,
        },
      },
    ],
    workItemOutcomes: [
      {
        workItemId: "url-001",
        batchId: "batch-sitemap-001",
        state: "completed",
        observedAt: "2026-08-04T11:01:00.000Z",
        issues: [],
      },
      {
        workItemId: "url-021",
        batchId: "batch-sitemap-001",
        state: "retryable",
        observedAt: "2026-08-04T11:01:30.000Z",
        retryableReason: "Not yet observed by verifier.",
        issues: [],
      },
    ],
    adapterCalls: [
      {
        callId: "adapter-call-model-sitemap-001",
        kind: "model",
        adapterId: "model:sitemap-worker",
        operation: "propose-sitemap-complete",
        status: "ok",
        startedAt: "2026-08-04T11:00:15.000Z",
        completedAt: "2026-08-04T11:00:30.000Z",
        issues: [],
        observationOnly: true,
        completionAuthority: false,
        metadata: {
          proposedDone: true,
          ignoredAsCompletionAuthority: true,
        },
      },
    ],
    audit: {
      expectedAuditEventIds: ["audit:sitemap-url-001", "audit:sitemap-complete"],
      emittedAuditEventIds: ["audit:sitemap-url-001"],
      missingAuditEventIds: ["audit:sitemap-complete"],
      lastAuditEventId: "audit:sitemap-url-001",
      auditStatus: "partial",
      issues: [],
    },
    verifier: {
      verifierRequired: true,
      verifierStatus: "incomplete",
      coverageStatus: "incomplete",
      checkedAt: "2026-08-04T11:02:00.000Z",
      completionGatedByVerifier: true,
      completionGateSatisfied: false,
      issues: [partialSitemapVerifierIssue],
    },
    resume: {
      nextStepId: "step-sitemap-batch-001",
      nextBatchId: "batch-sitemap-001",
      pendingWorkItemIds: ["url-021", "url-022", "url-400"],
      retryableWorkItemIds: ["url-021", "url-022", "url-400"],
      updatedAt: "2026-08-04T11:02:30.000Z",
      metadata: {
        pendingCount: 380,
      },
    },
    issues: [partialSitemapVerifierIssue],
    summary: {
      plannedSteps: 1,
      executedSteps: 1,
      completedSteps: 0,
      failedSteps: 0,
      blockedSteps: 0,
      retryableSteps: 1,
      plannedBatches: 1,
      completedBatches: 0,
      failedBatches: 0,
      expectedWorkItems: 400,
      completedWorkItems: 20,
      failedWorkItems: 0,
      skippedWorkItems: 0,
      retryableWorkItems: 380,
      adapterCallCount: 1,
      auditEventsEmitted: 1,
      verifierIssueCount: 1,
      issueCount: 1,
    },
  };

export const verifiedCompleteExecutionResultExample:
  AgenticRunnerExecutionResult = {
    ok: true,
    taskId: "verified-contract",
    mode: "verify",
    state: "verified",
    steps: [
      {
        stepId: "step-execute-terminal-items",
        stepKind: "batch_execution",
        state: "verified",
        startedAt: "2026-08-04T12:00:00.000Z",
        completedAt: "2026-08-04T12:02:00.000Z",
        observedOutcomes: [
          {
            workItemId: "item-complete",
            batchId: "batch-terminal",
            state: "completed",
            observedAt: "2026-08-04T12:01:00.000Z",
            issues: [],
          },
          {
            workItemId: "item-failed",
            batchId: "batch-terminal",
            state: "failed",
            observedAt: "2026-08-04T12:01:10.000Z",
            errorCode: "source_unavailable",
            errorMessage: "Source was explicitly unavailable.",
            issues: [],
          },
          {
            workItemId: "item-skipped",
            batchId: "batch-terminal",
            state: "skipped",
            observedAt: "2026-08-04T12:01:20.000Z",
            issues: [],
          },
        ],
        adapterCallIds: ["adapter-call-tool-terminal-001"],
        auditEventIds: [
          "audit:item-complete",
          "audit:item-failed",
          "audit:item-skipped",
        ],
        issues: [],
      },
    ],
    batches: [
      {
        batchId: "batch-terminal",
        workItemIds: ["item-complete", "item-failed", "item-skipped"],
        state: "completed",
        startedAt: "2026-08-04T12:00:00.000Z",
        completedAt: "2026-08-04T12:02:00.000Z",
        expectedItemCount: 3,
        observedCompletedCount: 1,
        observedFailedCount: 1,
        observedSkippedCount: 1,
        observedRetryableCount: 0,
        issues: [],
      },
    ],
    workItemOutcomes: [
      {
        workItemId: "item-complete",
        batchId: "batch-terminal",
        state: "completed",
        observedAt: "2026-08-04T12:01:00.000Z",
        issues: [],
      },
      {
        workItemId: "item-failed",
        batchId: "batch-terminal",
        state: "failed",
        observedAt: "2026-08-04T12:01:10.000Z",
        errorCode: "source_unavailable",
        issues: [],
      },
      {
        workItemId: "item-skipped",
        batchId: "batch-terminal",
        state: "skipped",
        observedAt: "2026-08-04T12:01:20.000Z",
        issues: [],
      },
    ],
    adapterCalls: [
      {
        callId: "adapter-call-tool-terminal-001",
        kind: "tool",
        adapterId: "tool:artifact-checker",
        operation: "observe-terminal-outcomes",
        status: "ok",
        startedAt: "2026-08-04T12:00:30.000Z",
        completedAt: "2026-08-04T12:01:30.000Z",
        auditEventIds: [
          "audit:item-complete",
          "audit:item-failed",
          "audit:item-skipped",
        ],
        issues: [],
        observationOnly: true,
        completionAuthority: false,
      },
    ],
    audit: {
      expectedAuditEventIds: [
        "audit:item-complete",
        "audit:item-failed",
        "audit:item-skipped",
        "audit:verification-satisfied",
      ],
      emittedAuditEventIds: [
        "audit:item-complete",
        "audit:item-failed",
        "audit:item-skipped",
        "audit:verification-satisfied",
      ],
      missingAuditEventIds: [],
      lastAuditEventId: "audit:verification-satisfied",
      auditStatus: "complete",
      issues: [],
    },
    verifier: {
      verifierRequired: true,
      verifierStatus: "verified",
      verifierResultReference: {
        id: "verifier:terminal-outcomes",
        version: "1",
      },
      coverageStatus: "satisfied",
      checkedAt: "2026-08-04T12:03:00.000Z",
      completionGatedByVerifier: true,
      completionGateSatisfied: true,
      auditEventIds: ["audit:verification-satisfied"],
      issues: [],
    },
    issues: [],
    summary: {
      plannedSteps: 1,
      executedSteps: 1,
      completedSteps: 0,
      failedSteps: 0,
      blockedSteps: 0,
      retryableSteps: 0,
      plannedBatches: 1,
      completedBatches: 1,
      failedBatches: 0,
      expectedWorkItems: 3,
      completedWorkItems: 1,
      failedWorkItems: 1,
      skippedWorkItems: 1,
      retryableWorkItems: 0,
      adapterCallCount: 1,
      auditEventsEmitted: 4,
      verifierIssueCount: 0,
      issueCount: 0,
    },
  };

const missingAuditIssue: AgenticRunnerExecutionIssue = {
  code: "audit_event_missing",
  message: "Required execution audit event was not emitted.",
  severity: "error",
  category: "audit_failure",
  auditEventIds: ["audit:handoff-finished"],
  retryable: true,
  createdAt: "2026-08-04T13:00:00.000Z",
};

export const auditHandoffGapExample: AgenticRunnerAuditExecutionHandoff = {
  expectedAuditEventIds: [
    "audit:handoff-started",
    "audit:handoff-finished",
  ],
  emittedAuditEventIds: ["audit:handoff-started"],
  missingAuditEventIds: ["audit:handoff-finished"],
  lastAuditEventId: "audit:handoff-started",
  auditStatus: "missing",
  issues: [missingAuditIssue],
};

const deniedPolicyIssue: AgenticRunnerExecutionIssue = {
  code: "policy_denied",
  message: "Policy denied execution before any adapter call was allowed.",
  severity: "critical",
  category: "policy_failure",
  policyGateId: "policy:restricted-operation",
  retryable: false,
  createdAt: "2026-08-04T14:00:00.000Z",
};

export const failedBlockedExecutionResultExample:
  AgenticRunnerExecutionResult = {
    ok: false,
    taskId: "blocked-policy-task",
    mode: "execute",
    state: "blocked",
    steps: [
      {
        stepId: "step-policy-preflight",
        stepKind: "policy_preflight",
        state: "blocked",
        observedOutcomes: [],
        adapterCallIds: [],
        auditEventIds: ["audit:policy-denied"],
        issues: [deniedPolicyIssue],
      },
    ],
    batches: [],
    workItemOutcomes: [],
    policy: {
      policyGateId: "policy:restricted-operation",
      status: "checked",
      decision: "denied",
      checkedAt: "2026-08-04T14:00:00.000Z",
      auditEventIds: ["audit:policy-denied"],
      issues: [deniedPolicyIssue],
    },
    approval: {
      approvalRequired: true,
      approvalStatus: "denied",
      decidedAt: "2026-08-04T14:00:30.000Z",
      auditEventIds: ["audit:approval-denied"],
      issues: [deniedPolicyIssue],
    },
    adapterCalls: [],
    audit: {
      expectedAuditEventIds: ["audit:policy-denied", "audit:approval-denied"],
      emittedAuditEventIds: ["audit:policy-denied", "audit:approval-denied"],
      missingAuditEventIds: [],
      lastAuditEventId: "audit:approval-denied",
      auditStatus: "complete",
      issues: [],
    },
    verifier: {
      verifierRequired: true,
      verifierStatus: "blocked",
      coverageStatus: "blocked",
      checkedAt: "2026-08-04T14:01:00.000Z",
      completionGatedByVerifier: true,
      completionGateSatisfied: false,
      issues: [deniedPolicyIssue],
    },
    issues: [deniedPolicyIssue],
    summary: {
      plannedSteps: 1,
      executedSteps: 0,
      completedSteps: 0,
      failedSteps: 0,
      blockedSteps: 1,
      retryableSteps: 0,
      plannedBatches: 0,
      completedBatches: 0,
      failedBatches: 0,
      expectedWorkItems: 0,
      completedWorkItems: 0,
      failedWorkItems: 0,
      skippedWorkItems: 0,
      retryableWorkItems: 0,
      adapterCallCount: 0,
      auditEventsEmitted: 2,
      verifierIssueCount: 1,
      issueCount: 1,
    },
  };
