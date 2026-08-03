import type {
  AgenticCoverage,
  AgenticCoverageVerifierInput,
  AgenticCoverageVerifierIssue,
  AgenticCoverageVerifierResult,
  AgenticCoverageVerifierSummary,
  AgenticTaskInventory,
  AgenticVerificationSnapshot,
  AgenticWorkBatch,
  AgenticWorkItem,
} from "./index.js";
import {
  summarizeAgenticCoverageVerification,
  verifyAgenticArtifactCoverage,
  verifyAgenticAuditConsistency,
  verifyAgenticBatchCoverage,
  verifyAgenticCoverage,
  verifyAgenticInventoryCoverage,
  verifyAgenticItemCoverage,
} from "./index.js";

const emptyCoverageArtifacts = {
  expectedArtifacts: [],
  verifiedArtifacts: [],
  missingArtifacts: [],
  extraArtifacts: [],
} as const;

const completeInventory: AgenticTaskInventory = {
  source: "example-inventory",
  expectedItemCount: 10,
  discoveredItemCount: 10,
  status: "complete",
  issues: [],
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
  artifacts: emptyCoverageArtifacts,
  rules: [],
  issues: [],
};

export const incompleteSitemapCoverageInput: AgenticCoverageVerifierInput = {
  taskId: "sitemap-coverage-400-items",
  inventory: {
    source: "sitemap.xml",
    expectedItemCount: 400,
    discoveredItemCount: 400,
    status: "complete",
    issues: [],
  },
  coverage: incompleteSitemapCoverage,
};

export const incompleteSitemapItemCoverage = verifyAgenticItemCoverage(
  incompleteSitemapCoverageInput,
);

export const incompleteSitemapCoverageResult = verifyAgenticCoverage(
  incompleteSitemapCoverageInput,
);

export const incompleteSitemapCoverageExpectation = {
  ok: incompleteSitemapCoverageResult.ok,
  status: incompleteSitemapCoverageResult.status,
  expectedItems: incompleteSitemapItemCoverage.expectedItems,
  completedItems: incompleteSitemapItemCoverage.completedItems,
  pendingItems: incompleteSitemapItemCoverage.pendingItems,
  issueCodes: incompleteSitemapCoverageResult.issues.map((issue) => issue.code),
};

export const incompleteSitemapRejectsTwentyOfFourHundredComplete =
  incompleteSitemapCoverageExpectation.ok === false &&
  incompleteSitemapCoverageExpectation.status === "incomplete" &&
  incompleteSitemapCoverageExpectation.issueCodes.includes(
    "item_accounting_incomplete",
  );

export const completeItemCoverage: AgenticCoverage = {
  status: "satisfied",
  expectedItemCount: 10,
  completedItemCount: 7,
  verifiedItemCount: 7,
  explicitlyFailedItemCount: 2,
  explicitlySkippedItemCount: 1,
  pendingItemCount: 0,
  retryableItemCount: 0,
  artifacts: emptyCoverageArtifacts,
  rules: [],
  issues: [],
};

export const completeItemCoverageInput: AgenticCoverageVerifierInput = {
  taskId: "complete-item-coverage",
  inventory: completeInventory,
  coverage: completeItemCoverage,
};

export const completeItemCoverageCheck = verifyAgenticItemCoverage(
  completeItemCoverageInput,
);

export const completeItemCoverageResult = verifyAgenticCoverage(
  completeItemCoverageInput,
);

export const completeItemCoverageExpectation = {
  ok: completeItemCoverageResult.ok,
  status: completeItemCoverageResult.status,
  expectedItems: completeItemCoverageCheck.expectedItems,
  accountedItems:
    completeItemCoverageCheck.completedItems +
    completeItemCoverageCheck.failedItems +
    completeItemCoverageCheck.skippedItems,
  pendingItems: completeItemCoverageCheck.pendingItems,
  retryableItems: completeItemCoverageCheck.retryableItems,
};

export const artifactCoverageIncomplete: AgenticCoverage = {
  status: "incomplete",
  expectedItemCount: 1,
  completedItemCount: 1,
  verifiedItemCount: 1,
  explicitlyFailedItemCount: 0,
  explicitlySkippedItemCount: 0,
  pendingItemCount: 0,
  retryableItemCount: 0,
  artifacts: {
    expectedArtifacts: [
      "artifacts/inventory.json",
      "artifacts/items.json",
      "artifacts/batches.json",
      "artifacts/audit.json",
      "artifacts/summary.json",
    ],
    verifiedArtifacts: [
      "artifacts/inventory.json",
      "artifacts/items.json",
      "artifacts/batches.json",
      "artifacts/audit.json",
    ],
    missingArtifacts: ["artifacts/summary.json"],
    extraArtifacts: [],
  },
  rules: [],
  issues: [],
};

export const artifactCoverageIncompleteInput: AgenticCoverageVerifierInput = {
  taskId: "artifact-coverage-incomplete",
  inventory: {
    source: "artifact-manifest",
    expectedItemCount: 1,
    discoveredItemCount: 1,
    status: "complete",
    issues: [],
  },
  coverage: artifactCoverageIncomplete,
};

export const artifactCoverageIncompleteCheck = verifyAgenticArtifactCoverage(
  artifactCoverageIncompleteInput,
);

export const artifactCoverageIncompleteExpectation = {
  status: artifactCoverageIncompleteCheck.status,
  expectedArtifacts: artifactCoverageIncompleteCheck.expectedArtifacts.length,
  verifiedArtifacts: artifactCoverageIncompleteCheck.verifiedArtifacts.length,
  missingArtifacts: artifactCoverageIncompleteCheck.missingArtifacts.length,
};

export const batchMismatchWorkItems: readonly AgenticWorkItem[] = [
  { id: "batch-item-1", state: "completed" },
  { id: "batch-item-2", state: "completed" },
];

export const batchMismatchBatches: readonly AgenticWorkBatch[] = [
  {
    id: "batch-mismatch",
    workItemIds: ["batch-item-1", "batch-item-2"],
    expectedItemCount: 2,
    completedCount: 1,
    failedCount: 1,
    skippedCount: 0,
    retryableCount: 0,
  },
];

export const batchMismatchCoverageChecks = verifyAgenticBatchCoverage({
  taskId: "batch-mismatch",
  inventory: {
    source: "batch-list",
    expectedItemCount: 2,
    discoveredItemCount: 2,
    status: "complete",
    issues: [],
  },
  workItems: batchMismatchWorkItems,
  batches: batchMismatchBatches,
});

export const batchMismatchHasIssue = batchMismatchCoverageChecks.some((check) =>
  check.issues.some((issue) => issue.code === "batch_accounting_mismatch"),
);

export const inventoryIncompleteInput: AgenticCoverageVerifierInput = {
  taskId: "inventory-incomplete",
  inventory: {
    source: "crawler-inventory",
    expectedItemCount: 12,
    discoveredItemCount: 10,
    status: "incomplete",
    issues: [],
  },
};

export const inventoryIncompleteCheck = verifyAgenticInventoryCoverage(
  inventoryIncompleteInput,
);

export const inventoryIncompleteExpectation = {
  status: inventoryIncompleteCheck.status,
  coverageComplete: inventoryIncompleteCheck.coverageComplete,
  expectedItemCount: inventoryIncompleteCheck.expectedItemCount,
  discoveredItemCount: inventoryIncompleteCheck.discoveredItemCount,
  issueCodes: inventoryIncompleteCheck.issues.map((issue) => issue.code),
};

export const inventoryIncompleteHasIssue =
  inventoryIncompleteExpectation.issueCodes.includes(
    "inventory_item_count_mismatch",
  );

export const auditConsistencySnapshot: AgenticVerificationSnapshot = {
  verifierId: "coverage-verifier",
  status: "fail",
  checkedAt: "2026-08-03T10:00:00.000Z",
  coverageStatus: "incomplete",
  issues: [],
  auditEventIds: ["audit-001", "audit-002", "audit-003"],
};

export const auditConsistencyCheck = verifyAgenticAuditConsistency({
  taskId: "audit-consistency",
  verificationSnapshot: auditConsistencySnapshot,
  auditReferences: [
    {
      auditEventIds: ["audit-001"],
      createdAt: "2026-08-03T09:55:00.000Z",
      lastEventAt: "2026-08-03T09:59:00.000Z",
    },
  ],
  options: {
    requireAuditConsistency: true,
  },
});

export const auditConsistencyExpectation = {
  status: auditConsistencyCheck.status,
  coverageComplete: auditConsistencyCheck.coverageComplete,
  missingAuditEventIds: auditConsistencyCheck.missingAuditEventIds,
};

export const aggregatedVerifierInput: AgenticCoverageVerifierInput = {
  taskId: "aggregated-coverage",
  inventory: inventoryIncompleteInput.inventory,
  workItems: batchMismatchWorkItems,
  batches: batchMismatchBatches,
  coverage: artifactCoverageIncomplete,
  verificationSnapshot: auditConsistencySnapshot,
  auditReferences: [
    {
      auditEventIds: ["audit-001"],
      createdAt: "2026-08-03T09:55:00.000Z",
      lastEventAt: "2026-08-03T09:59:00.000Z",
    },
  ],
  options: {
    requireAuditConsistency: true,
  },
};

export const aggregatedVerifierResult = verifyAgenticCoverage(
  aggregatedVerifierInput,
);

export const aggregatedVerifierSummary =
  summarizeAgenticCoverageVerification({
    itemCoverage: aggregatedVerifierResult.itemCoverage,
    artifactCoverage: aggregatedVerifierResult.artifactCoverage,
    issues: aggregatedVerifierResult.issues,
  });

export const aggregatedVerifierExpectation = {
  ok: aggregatedVerifierResult.ok,
  status: aggregatedVerifierResult.status,
  batchIssueCount: aggregatedVerifierResult.batchCoverage.reduce(
    (count, check) => count + check.issues.length,
    0,
  ),
  inventoryStatus: aggregatedVerifierResult.inventoryCoverage.status,
  auditStatus: aggregatedVerifierResult.auditConsistency.status,
  summary: aggregatedVerifierSummary,
};

export const aggregatedVerifierIssueCodes: readonly string[] =
  aggregatedVerifierResult.issues.map((issue) => issue.code);

export const aggregatedVerifierRequiredIssuesPresent =
  aggregatedVerifierIssueCodes.includes("artifact_missing") &&
  aggregatedVerifierIssueCodes.includes("batch_accounting_mismatch") &&
  aggregatedVerifierIssueCodes.includes("inventory_item_count_mismatch") &&
  aggregatedVerifierIssueCodes.includes("audit_event_missing");

export const aggregatedVerifierResultShape: AgenticCoverageVerifierResult =
  aggregatedVerifierResult;

export const aggregatedVerifierIssues: readonly AgenticCoverageVerifierIssue[] =
  aggregatedVerifierResult.issues;
