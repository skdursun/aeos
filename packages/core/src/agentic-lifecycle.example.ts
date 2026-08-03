import type {
  AgenticAuditReference,
  AgenticCoverage,
  AgenticCoverageRule,
  AgenticExecutionAttempt,
  AgenticLifecycleIssue,
  AgenticLifecycleResult,
  AgenticLifecycleSummary,
  AgenticResumeCursor,
  AgenticTaskInventory,
  AgenticTaskLifecycle,
  AgenticTaskState,
  AgenticVerificationSnapshot,
  AgenticWorkBatch,
  AgenticWorkItem,
  AgenticWorkItemState,
} from "./agentic-lifecycle.js";

const plannedState: AgenticTaskState = "planned";
const pendingWorkItemState: AgenticWorkItemState = "pending";

export const plannedSitemapInventory: AgenticTaskInventory = {
  source: "sitemap.xml",
  expectedItemCount: 400,
  discoveredItemCount: 400,
  status: "complete",
  issues: [],
  updatedAt: "2026-08-03T09:00:00.000Z",
};

export const plannedSitemapWorkItems: readonly AgenticWorkItem[] = [
  {
    id: "url-001",
    state: pendingWorkItemState,
    title: "Crawl homepage",
    source: "https://example.test/",
    batchId: "batch-001",
    expectedArtifacts: ["crawl/url-001.json"],
    updatedAt: "2026-08-03T09:01:00.000Z",
  },
  {
    id: "url-002",
    state: "pending",
    title: "Crawl pricing page",
    source: "https://example.test/pricing",
    batchId: "batch-001",
    expectedArtifacts: ["crawl/url-002.json"],
    updatedAt: "2026-08-03T09:01:00.000Z",
  },
];

export const plannedSitemapBatches: readonly AgenticWorkBatch[] = [
  {
    id: "batch-001",
    workItemIds: ["url-001", "url-002"],
    expectedItemCount: 100,
    completedCount: 0,
    failedCount: 0,
    skippedCount: 0,
    retryableCount: 0,
  },
  {
    id: "batch-002",
    workItemIds: [],
    expectedItemCount: 100,
    completedCount: 0,
    failedCount: 0,
    skippedCount: 0,
    retryableCount: 0,
  },
  {
    id: "batch-003",
    workItemIds: [],
    expectedItemCount: 100,
    completedCount: 0,
    failedCount: 0,
    skippedCount: 0,
    retryableCount: 0,
  },
  {
    id: "batch-004",
    workItemIds: [],
    expectedItemCount: 100,
    completedCount: 0,
    failedCount: 0,
    skippedCount: 0,
    retryableCount: 0,
  },
];

export const plannedSitemapCoverageRules: readonly AgenticCoverageRule[] = [
  {
    id: "inventory-complete",
    kind: "inventory_completion",
    description: "All discovered sitemap URLs are represented in inventory.",
    required: true,
    expression: "discovered_items == inventoried_items",
    status: "satisfied",
  },
  {
    id: "item-accounting",
    kind: "item_completion_accounting",
    description: "No item completion is required before execution starts.",
    required: true,
    expression:
      "expected_items == completed_items + explicitly_failed_items + explicitly_skipped_items",
    status: "unknown",
  },
];

export const plannedSitemapCoverage: AgenticCoverage = {
  status: "unknown",
  expectedItemCount: 400,
  completedItemCount: 0,
  verifiedItemCount: 0,
  explicitlyFailedItemCount: 0,
  explicitlySkippedItemCount: 0,
  pendingItemCount: 400,
  retryableItemCount: 0,
  discoveredButNotInventoriedCount: 0,
  artifacts: {
    expectedArtifacts: [],
    verifiedArtifacts: [],
    missingArtifacts: [],
    extraArtifacts: [],
  },
  rules: plannedSitemapCoverageRules,
  issues: [],
  updatedAt: "2026-08-03T09:02:00.000Z",
};

export const plannedSitemapSummary: AgenticLifecycleSummary = {
  totalWorkItemCount: 400,
  completedWorkItemCount: 0,
  verifiedWorkItemCount: 0,
  failedWorkItemCount: 0,
  skippedWorkItemCount: 0,
  retryableWorkItemCount: 0,
  pendingWorkItemCount: 400,
  batchCount: 4,
  issueCount: 0,
  artifactCoverageStatus: "unknown",
  verificationStatus: "skipped",
};

export const plannedSitemapLifecycle: AgenticTaskLifecycle = {
  taskId: "task-sitemap-planned",
  state: plannedState,
  inventory: plannedSitemapInventory,
  workItems: plannedSitemapWorkItems,
  batches: plannedSitemapBatches,
  coverage: plannedSitemapCoverage,
  attempts: [],
  issues: [],
  summary: plannedSitemapSummary,
  createdAt: "2026-08-03T09:00:00.000Z",
  updatedAt: "2026-08-03T09:02:00.000Z",
};

export const incompleteCoverageIssue: AgenticLifecycleIssue = {
  code: "SITEMAP_COVERAGE_INCOMPLETE",
  message: "Only 20 of 400 sitemap work items are completed; 380 remain pending.",
  severity: "warning",
  category: "coverage_failure",
  retryable: true,
  createdAt: "2026-08-03T10:00:00.000Z",
};

export const incompleteSitemapAttempt: AgenticExecutionAttempt = {
  id: "attempt-sitemap-001",
  adapterId: "crawl-adapter",
  startedAt: "2026-08-03T09:30:00.000Z",
  completedAt: "2026-08-03T10:00:00.000Z",
  status: "retryable",
  batchId: "batch-001",
  workItemIds: ["url-001", "url-002"],
  issues: [incompleteCoverageIssue],
};

export const incompleteSitemapCoverage: AgenticCoverage = {
  status: "incomplete",
  expectedItemCount: 400,
  completedItemCount: 20,
  verifiedItemCount: 20,
  explicitlyFailedItemCount: 0,
  explicitlySkippedItemCount: 0,
  pendingItemCount: 380,
  retryableItemCount: 0,
  discoveredButNotInventoriedCount: 0,
  artifacts: {
    expectedArtifacts: [],
    verifiedArtifacts: [],
    missingArtifacts: [],
    extraArtifacts: [],
  },
  rules: [
    {
      id: "item-accounting",
      kind: "item_completion_accounting",
      description: "Every sitemap work item must be completed, failed, or skipped.",
      required: true,
      expression:
        "expected_items == completed_items + explicitly_failed_items + explicitly_skipped_items",
      status: "incomplete",
    },
  ],
  issues: [incompleteCoverageIssue],
  updatedAt: "2026-08-03T10:00:00.000Z",
};

export const incompleteSitemapLifecycle: AgenticTaskLifecycle = {
  taskId: "task-sitemap-incomplete",
  state: "running",
  inventory: plannedSitemapInventory,
  workItems: [
    {
      id: "url-001",
      state: "completed",
      source: "https://example.test/",
      batchId: "batch-001",
    },
    {
      id: "url-021",
      state: "pending",
      source: "https://example.test/page-21",
      batchId: "batch-002",
      issues: [incompleteCoverageIssue],
    },
  ],
  batches: [
    {
      id: "batch-001",
      workItemIds: ["url-001"],
      expectedItemCount: 100,
      completedCount: 20,
      failedCount: 0,
      skippedCount: 0,
      retryableCount: 0,
    },
    {
      id: "batch-002",
      workItemIds: ["url-021"],
      expectedItemCount: 100,
      completedCount: 0,
      failedCount: 0,
      skippedCount: 0,
      retryableCount: 0,
    },
  ],
  coverage: incompleteSitemapCoverage,
  attempts: [incompleteSitemapAttempt],
  resume: {
    nextPendingBatchId: "batch-002",
    remainingWorkItemIds: ["url-021", "url-022"],
    retryableWorkItemIds: [],
    updatedAt: "2026-08-03T10:00:00.000Z",
  },
  issues: [incompleteCoverageIssue],
  summary: {
    totalWorkItemCount: 400,
    completedWorkItemCount: 20,
    verifiedWorkItemCount: 20,
    failedWorkItemCount: 0,
    skippedWorkItemCount: 0,
    retryableWorkItemCount: 0,
    pendingWorkItemCount: 380,
    batchCount: 4,
    issueCount: 1,
    artifactCoverageStatus: "unknown",
    verificationStatus: "skipped",
  },
  createdAt: "2026-08-03T09:00:00.000Z",
  updatedAt: "2026-08-03T10:00:00.000Z",
};

export const completeVerificationSnapshot: AgenticVerificationSnapshot = {
  verifierId: "coverage-verifier",
  status: "pass",
  checkedAt: "2026-08-03T11:00:00.000Z",
  coverageStatus: "satisfied",
  issues: [],
  auditEventIds: ["audit-verified-complete"],
};

export const completeAuditReference: AgenticAuditReference = {
  auditEventIds: ["audit-started", "audit-completed", "audit-verified-complete"],
  createdAt: "2026-08-03T10:30:00.000Z",
  lastEventAt: "2026-08-03T11:00:00.000Z",
};

export const verifiedCompleteLifecycle: AgenticTaskLifecycle = {
  taskId: "task-item-based-complete",
  state: "verified",
  inventory: {
    source: "item-list",
    expectedItemCount: 4,
    discoveredItemCount: 4,
    status: "complete",
    issues: [],
  },
  workItems: [
    { id: "item-001", state: "verified", batchId: "batch-items" },
    { id: "item-002", state: "completed", batchId: "batch-items" },
    { id: "item-003", state: "failed", batchId: "batch-items" },
    { id: "item-004", state: "skipped", batchId: "batch-items" },
  ],
  batches: [
    {
      id: "batch-items",
      workItemIds: ["item-001", "item-002", "item-003", "item-004"],
      expectedItemCount: 4,
      completedCount: 2,
      failedCount: 1,
      skippedCount: 1,
      retryableCount: 0,
    },
  ],
  coverage: {
    status: "satisfied",
    expectedItemCount: 4,
    completedItemCount: 2,
    verifiedItemCount: 1,
    explicitlyFailedItemCount: 1,
    explicitlySkippedItemCount: 1,
    pendingItemCount: 0,
    retryableItemCount: 0,
    artifacts: {
      expectedArtifacts: [],
      verifiedArtifacts: [],
      missingArtifacts: [],
      extraArtifacts: [],
    },
    rules: [
      {
        id: "item-accounting",
        kind: "item_completion_accounting",
        description:
          "Expected items equal completed plus explicitly failed and skipped items.",
        required: true,
        expression:
          "expected_items == completed_items + explicitly_failed_items + explicitly_skipped_items",
        status: "satisfied",
      },
    ],
    issues: [],
  },
  attempts: [
    {
      id: "attempt-items-001",
      adapterId: "item-adapter",
      startedAt: "2026-08-03T10:30:00.000Z",
      completedAt: "2026-08-03T10:50:00.000Z",
      status: "completed",
      batchId: "batch-items",
      issues: [],
    },
  ],
  verification: completeVerificationSnapshot,
  audit: completeAuditReference,
  issues: [],
  summary: {
    totalWorkItemCount: 4,
    completedWorkItemCount: 2,
    verifiedWorkItemCount: 1,
    failedWorkItemCount: 1,
    skippedWorkItemCount: 1,
    retryableWorkItemCount: 0,
    pendingWorkItemCount: 0,
    batchCount: 1,
    issueCount: 0,
    artifactCoverageStatus: "satisfied",
    verificationStatus: "pass",
  },
};

export const missingArtifactIssue: AgenticLifecycleIssue = {
  code: "ARTIFACT_MISSING",
  message: "Expected artifact dist/report.json was not verified.",
  severity: "error",
  category: "artifact_failure",
  workItemId: "artifact-report-json",
  retryable: true,
};

export const fileGenerationLifecycle: AgenticTaskLifecycle = {
  taskId: "task-file-generation",
  state: "failed",
  inventory: {
    source: "artifact-manifest",
    expectedItemCount: 3,
    discoveredItemCount: 3,
    status: "complete",
    issues: [],
  },
  workItems: [
    {
      id: "artifact-readme",
      state: "verified",
      expectedArtifacts: ["README.generated.md"],
    },
    {
      id: "artifact-report-json",
      state: "retryable",
      expectedArtifacts: ["dist/report.json"],
      issues: [missingArtifactIssue],
    },
  ],
  batches: [
    {
      id: "batch-artifacts",
      workItemIds: ["artifact-readme", "artifact-report-json"],
      expectedItemCount: 3,
      completedCount: 2,
      failedCount: 0,
      skippedCount: 0,
      retryableCount: 1,
    },
  ],
  coverage: {
    status: "failed",
    expectedItemCount: 3,
    completedItemCount: 2,
    verifiedItemCount: 2,
    explicitlyFailedItemCount: 0,
    explicitlySkippedItemCount: 0,
    pendingItemCount: 0,
    retryableItemCount: 1,
    artifacts: {
      expectedArtifacts: [
        "README.generated.md",
        "dist/report.json",
        "dist/summary.json",
      ],
      verifiedArtifacts: ["README.generated.md", "dist/summary.json"],
      missingArtifacts: ["dist/report.json"],
      extraArtifacts: [],
    },
    rules: [
      {
        id: "artifact-accounting",
        kind: "artifact_completion_accounting",
        description: "Every expected generated file is verified by artifact path.",
        required: true,
        expression: "expected_artifacts == verified_artifacts",
        status: "failed",
      },
    ],
    issues: [missingArtifactIssue],
  },
  attempts: [],
  issues: [missingArtifactIssue],
  summary: {
    totalWorkItemCount: 3,
    completedWorkItemCount: 2,
    verifiedWorkItemCount: 2,
    failedWorkItemCount: 0,
    skippedWorkItemCount: 0,
    retryableWorkItemCount: 1,
    pendingWorkItemCount: 0,
    batchCount: 1,
    issueCount: 1,
    artifactCoverageStatus: "failed",
    verificationStatus: "fail",
  },
};

export const resumeCursorExample: AgenticResumeCursor = {
  nextPendingBatchId: "batch-002",
  remainingWorkItemIds: ["url-021", "url-022", "url-023"],
  retryableWorkItemIds: ["url-018"],
  updatedAt: "2026-08-03T10:05:00.000Z",
};

export const incompleteSitemapResult: AgenticLifecycleResult = {
  ok: false,
  taskId: incompleteSitemapLifecycle.taskId,
  state: incompleteSitemapLifecycle.state,
  inventory: incompleteSitemapLifecycle.inventory,
  batches: incompleteSitemapLifecycle.batches,
  coverage: incompleteSitemapLifecycle.coverage,
  verification: incompleteSitemapLifecycle.verification,
  audit: incompleteSitemapLifecycle.audit,
  resume: resumeCursorExample,
  issues: incompleteSitemapLifecycle.issues,
  summary: incompleteSitemapLifecycle.summary,
};

export function lifecycleResultFromExample(
  lifecycle: AgenticTaskLifecycle,
): AgenticLifecycleResult {
  return {
    ok: lifecycle.state === "verified" || lifecycle.state === "completed",
    taskId: lifecycle.taskId,
    state: lifecycle.state,
    inventory: lifecycle.inventory,
    batches: lifecycle.batches,
    coverage: lifecycle.coverage,
    verification: lifecycle.verification,
    audit: lifecycle.audit,
    resume: lifecycle.resume,
    issues: lifecycle.issues,
    summary: lifecycle.summary,
  };
}
