import type {
  AgenticArtifactCoverageCheck,
  AgenticAuditConsistencyCheck,
  AgenticBatchCoverageCheck,
  AgenticCoverageCheck,
  AgenticCoverageVerificationStatus,
  AgenticCoverageVerifierInput,
  AgenticCoverageVerifierIssue,
  AgenticCoverageVerifierMode,
  AgenticCoverageVerifierResult,
  AgenticCoverageVerifierSummary,
  AgenticInventoryCoverageCheck,
  AgenticItemCoverageCheck,
} from "./agentic-coverage-verifier.js";

export const agenticCoverageVerifierExampleMode: AgenticCoverageVerifierMode =
  "completion";

export const agenticCoverageVerifierExampleStatus: AgenticCoverageVerificationStatus =
  "incomplete";

export const incompleteSitemapCoverageIssue: AgenticCoverageVerifierIssue = {
  code: "sitemap_coverage_incomplete",
  message: "Sitemap audit has 380 pending items out of 400 expected items.",
  severity: "error",
  category: "coverage_failure",
  checkId: "sitemap-item-coverage",
  retryable: true,
  createdAt: "2026-08-03T09:00:00.000Z",
};

export const incompleteSitemapItemCoverageCheck: AgenticItemCoverageCheck = {
  id: "sitemap-item-coverage",
  kind: "item_coverage",
  required: true,
  status: "incomplete",
  coverageComplete: false,
  issues: [incompleteSitemapCoverageIssue],
  rule: "expected_items == completed_items + explicitly_failed_items + explicitly_skipped_items",
  expectedItems: 400,
  completedItems: 20,
  failedItems: 0,
  skippedItems: 0,
  pendingItems: 380,
  retryableItems: 0,
  missingItemIds: ["url-0021", "url-0022", "url-0023"],
};

export const incompleteSitemapArtifactCoverageCheck: AgenticArtifactCoverageCheck =
  {
    id: "sitemap-artifact-coverage",
    kind: "artifact_coverage",
    required: false,
    status: "verified",
    coverageComplete: true,
    issues: [],
    expectedArtifacts: ["reports/sitemap-audit.json"],
    verifiedArtifacts: ["reports/sitemap-audit.json"],
    missingArtifacts: [],
    extraArtifacts: [],
  };

export const incompleteSitemapInventoryCoverageCheck: AgenticInventoryCoverageCheck =
  {
    id: "sitemap-inventory-coverage",
    kind: "inventory_coverage",
    required: true,
    status: "verified",
    coverageComplete: true,
    issues: [],
    inventorySource: "sitemap.xml",
    expectedItemCount: 400,
    discoveredItemCount: 400,
    inventoryComplete: true,
  };

export const incompleteSitemapAuditConsistencyCheck: AgenticAuditConsistencyCheck =
  {
    id: "sitemap-audit-consistency",
    kind: "audit_consistency",
    required: false,
    status: "verified",
    coverageComplete: true,
    issues: [],
    expectedAuditEventCount: 2,
    observedAuditEventCount: 2,
    missingAuditEventIds: [],
    consistencyStatus: "verified",
  };

export const incompleteSitemapCoverageSummary: AgenticCoverageVerifierSummary = {
  expectedItems: 400,
  completedItems: 20,
  failedItems: 0,
  skippedItems: 0,
  pendingItems: 380,
  retryableItems: 0,
  expectedArtifacts: 1,
  verifiedArtifacts: 1,
  missingArtifacts: 0,
  issueCount: 1,
};

export const incompleteSitemapCoverageInput: AgenticCoverageVerifierInput = {
  taskId: "sitemap-audit",
  mode: "completion",
  workItems: [
    {
      id: "url-0001",
      state: "completed",
      title: "Verify homepage URL",
      source: "sitemap.xml",
    },
    {
      id: "url-0021",
      state: "pending",
      title: "Verify pending sitemap URL",
      source: "sitemap.xml",
    },
  ],
  options: {
    requireInventoryComplete: true,
    requireAuditConsistency: false,
    allowExtraArtifacts: false,
    mode: "completion",
  },
};

export const incompleteSitemapCoverageResult: AgenticCoverageVerifierResult = {
  ok: false,
  taskId: "sitemap-audit",
  status: "incomplete",
  itemCoverage: incompleteSitemapItemCoverageCheck,
  artifactCoverage: incompleteSitemapArtifactCoverageCheck,
  batchCoverage: [],
  inventoryCoverage: incompleteSitemapInventoryCoverageCheck,
  auditConsistency: incompleteSitemapAuditConsistencyCheck,
  issues: [incompleteSitemapCoverageIssue],
  summary: incompleteSitemapCoverageSummary,
};

export const completeItemCoverageCheck: AgenticItemCoverageCheck = {
  id: "complete-item-coverage",
  kind: "item_coverage",
  required: true,
  status: "verified",
  coverageComplete: true,
  issues: [],
  rule: "expected_items == completed_items + explicitly_failed_items + explicitly_skipped_items",
  expectedItems: 10,
  completedItems: 7,
  failedItems: 2,
  skippedItems: 1,
  pendingItems: 0,
  retryableItems: 0,
  missingItemIds: [],
};

export const completeItemCoverageResult: AgenticCoverageVerifierResult = {
  ok: true,
  taskId: "complete-item-task",
  status: "verified",
  itemCoverage: completeItemCoverageCheck,
  artifactCoverage: {
    id: "complete-item-artifacts",
    kind: "artifact_coverage",
    required: false,
    status: "verified",
    coverageComplete: true,
    issues: [],
    expectedArtifacts: [],
    verifiedArtifacts: [],
    missingArtifacts: [],
    extraArtifacts: [],
  },
  batchCoverage: [],
  inventoryCoverage: {
    id: "complete-item-inventory",
    kind: "inventory_coverage",
    required: false,
    status: "verified",
    coverageComplete: true,
    issues: [],
    inventorySource: "static-list",
    expectedItemCount: 10,
    discoveredItemCount: 10,
    inventoryComplete: true,
  },
  auditConsistency: {
    id: "complete-item-audit",
    kind: "audit_consistency",
    required: false,
    status: "verified",
    coverageComplete: true,
    issues: [],
    expectedAuditEventCount: 0,
    observedAuditEventCount: 0,
    missingAuditEventIds: [],
    consistencyStatus: "verified",
  },
  issues: [],
  summary: {
    expectedItems: 10,
    completedItems: 7,
    failedItems: 2,
    skippedItems: 1,
    pendingItems: 0,
    retryableItems: 0,
    expectedArtifacts: 0,
    verifiedArtifacts: 0,
    missingArtifacts: 0,
    issueCount: 0,
  },
};

export const artifactCoverageIncompleteIssue: AgenticCoverageVerifierIssue = {
  code: "artifact_coverage_incomplete",
  message: "Expected 5 artifacts but only 4 artifacts were verified.",
  severity: "error",
  category: "artifact_failure",
  checkId: "artifact-coverage-incomplete",
  artifactPath: "reports/final-summary.json",
  createdAt: "2026-08-03T09:05:00.000Z",
};

export const artifactCoverageIncompleteCheck: AgenticArtifactCoverageCheck = {
  id: "artifact-coverage-incomplete",
  kind: "artifact_coverage",
  required: true,
  status: "incomplete",
  coverageComplete: false,
  issues: [artifactCoverageIncompleteIssue],
  expectedArtifacts: [
    "reports/items.json",
    "reports/issues.json",
    "reports/artifacts.json",
    "reports/audit.json",
    "reports/final-summary.json",
  ],
  verifiedArtifacts: [
    "reports/items.json",
    "reports/issues.json",
    "reports/artifacts.json",
    "reports/audit.json",
  ],
  missingArtifacts: ["reports/final-summary.json"],
  extraArtifacts: [],
};

export const artifactCoverageIncompleteResult: AgenticCoverageVerifierResult = {
  ok: false,
  taskId: "artifact-audit",
  status: "incomplete",
  itemCoverage: {
    id: "artifact-item-coverage",
    kind: "item_coverage",
    required: false,
    status: "verified",
    coverageComplete: true,
    issues: [],
    rule: "expected_items == completed_items + explicitly_failed_items + explicitly_skipped_items",
    expectedItems: 1,
    completedItems: 1,
    failedItems: 0,
    skippedItems: 0,
    pendingItems: 0,
    retryableItems: 0,
  },
  artifactCoverage: artifactCoverageIncompleteCheck,
  batchCoverage: [],
  inventoryCoverage: {
    id: "artifact-inventory",
    kind: "inventory_coverage",
    required: false,
    status: "verified",
    coverageComplete: true,
    issues: [],
    inventorySource: "artifact-manifest",
    expectedItemCount: 1,
    discoveredItemCount: 1,
    inventoryComplete: true,
  },
  auditConsistency: {
    id: "artifact-audit-consistency",
    kind: "audit_consistency",
    required: false,
    status: "verified",
    coverageComplete: true,
    issues: [],
    missingAuditEventIds: [],
    consistencyStatus: "verified",
  },
  issues: [artifactCoverageIncompleteIssue],
  summary: {
    expectedItems: 1,
    completedItems: 1,
    failedItems: 0,
    skippedItems: 0,
    pendingItems: 0,
    retryableItems: 0,
    expectedArtifacts: 5,
    verifiedArtifacts: 4,
    missingArtifacts: 1,
    issueCount: 1,
  },
};

export const batchMismatchCoverageIssue: AgenticCoverageVerifierIssue = {
  code: "batch_accounting_mismatch",
  message:
    "Batch expected count does not match completed, failed, skipped, and retryable totals.",
  severity: "error",
  category: "coverage_failure",
  checkId: "batch-coverage-mismatch",
  batchId: "batch-001",
  retryable: false,
};

export const batchMismatchCoverageCheck: AgenticBatchCoverageCheck = {
  id: "batch-coverage-mismatch",
  kind: "batch_coverage",
  required: true,
  status: "failed",
  coverageComplete: false,
  issues: [batchMismatchCoverageIssue],
  batchId: "batch-001",
  expectedItems: 10,
  completedItems: 4,
  failedItems: 1,
  skippedItems: 1,
  retryableItems: 1,
};

export const inventoryIncompleteIssue: AgenticCoverageVerifierIssue = {
  code: "inventory_item_count_mismatch",
  message: "Expected 12 inventory items but discovered 10 items.",
  severity: "error",
  category: "inventory_failure",
  checkId: "inventory-coverage-incomplete",
};

export const inventoryIncompleteCoverageCheck: AgenticInventoryCoverageCheck = {
  id: "inventory-coverage-incomplete",
  kind: "inventory_coverage",
  required: true,
  status: "incomplete",
  coverageComplete: false,
  issues: [inventoryIncompleteIssue],
  inventorySource: "project-profile",
  expectedItemCount: 12,
  discoveredItemCount: 10,
  inventoryComplete: false,
};

export const auditConsistencyIssue: AgenticCoverageVerifierIssue = {
  code: "audit_event_missing",
  message: "Expected audit events were not observed.",
  severity: "error",
  category: "audit_failure",
  checkId: "audit-consistency-missing-events",
  auditEventIds: ["audit-event-002", "audit-event-004"],
};

export const auditConsistencyCoverageCheck: AgenticAuditConsistencyCheck = {
  id: "audit-consistency-missing-events",
  kind: "audit_consistency",
  required: true,
  status: "failed",
  coverageComplete: false,
  issues: [auditConsistencyIssue],
  expectedAuditEventCount: 4,
  observedAuditEventCount: 2,
  missingAuditEventIds: ["audit-event-002", "audit-event-004"],
  consistencyStatus: "failed",
};

export const baseCoverageCheckExample: AgenticCoverageCheck =
  auditConsistencyCoverageCheck;

export const batchInventoryAndAuditCoverageResult: AgenticCoverageVerifierResult =
  {
    ok: false,
    taskId: "batch-inventory-audit",
    status: "failed",
    itemCoverage: {
      id: "batch-inventory-item-coverage",
      kind: "item_coverage",
      required: true,
      status: "verified",
      coverageComplete: true,
      issues: [],
      rule: "expected_items == completed_items + explicitly_failed_items + explicitly_skipped_items",
      expectedItems: 7,
      completedItems: 5,
      failedItems: 1,
      skippedItems: 1,
      pendingItems: 0,
      retryableItems: 0,
      missingItemIds: [],
    },
    artifactCoverage: {
      id: "batch-inventory-artifact-coverage",
      kind: "artifact_coverage",
      required: false,
      status: "verified",
      coverageComplete: true,
      issues: [],
      expectedArtifacts: ["reports/batch.json"],
      verifiedArtifacts: ["reports/batch.json"],
      missingArtifacts: [],
      extraArtifacts: [],
    },
    batchCoverage: [batchMismatchCoverageCheck],
    inventoryCoverage: inventoryIncompleteCoverageCheck,
    auditConsistency: auditConsistencyCoverageCheck,
    issues: [
      batchMismatchCoverageIssue,
      inventoryIncompleteIssue,
      auditConsistencyIssue,
    ],
    summary: {
      expectedItems: 7,
      completedItems: 5,
      failedItems: 1,
      skippedItems: 1,
      pendingItems: 0,
      retryableItems: 0,
      expectedArtifacts: 1,
      verifiedArtifacts: 1,
      missingArtifacts: 0,
      issueCount: 3,
    },
  };
