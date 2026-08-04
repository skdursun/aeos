import type {
  AgenticAuditEventId,
  AgenticAuditReference,
  AgenticCoverage,
  AgenticLifecycleIssueCategory,
  AgenticLifecycleIssueSeverity,
  AgenticTaskInventory,
  AgenticVerificationSnapshot,
  AgenticWorkBatch,
  AgenticWorkItem,
  AgenticWorkItemId,
} from "./agentic-lifecycle.js";
import type {
  AgenticArtifactCoverageCheck,
  AgenticAuditConsistencyCheck,
  AgenticBatchCoverageCheck,
  AgenticCoverageVerifierInput,
  AgenticCoverageVerifierIssue,
  AgenticCoverageVerifierOptions,
  AgenticCoverageVerifierResult,
  AgenticCoverageVerifierSummary,
  AgenticCoverageVerificationStatus,
  AgenticInventoryCoverageCheck,
  AgenticItemCoverageCheck,
} from "./agentic-coverage-verifier.js";

interface NormalizedVerifierInput {
  readonly taskId: string;
  readonly inventory?: AgenticTaskInventory;
  readonly workItems: readonly AgenticWorkItem[];
  readonly batches: readonly AgenticWorkBatch[];
  readonly coverage?: AgenticCoverage;
  readonly verificationSnapshot?: AgenticVerificationSnapshot;
  readonly auditReferences: readonly AgenticAuditReference[];
  readonly options: Required<AgenticCoverageVerifierOptions>;
}

interface ItemCounts {
  readonly completed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly pending: number;
  readonly retryable: number;
}

const DEFAULT_OPTIONS: Required<AgenticCoverageVerifierOptions> = {
  requireInventoryComplete: true,
  requireAuditConsistency: false,
  allowExtraArtifacts: false,
  mode: "completion",
};

const ITEM_RULE =
  "expected_items == completed_items + explicitly_failed_items + explicitly_skipped_items";

export function verifyAgenticCoverage(
  input: AgenticCoverageVerifierInput,
): AgenticCoverageVerifierResult {
  const normalized = normalizeInput(input);
  const itemCoverage = verifyAgenticItemCoverage(input);
  const artifactCoverage = verifyAgenticArtifactCoverage(input);
  const batchCoverage = verifyAgenticBatchCoverage(input);
  const inventoryCoverage = verifyAgenticInventoryCoverage(input);
  const auditConsistency = verifyAgenticAuditConsistency(input);

  const issues = uniqueIssues([
    ...itemCoverage.issues,
    ...artifactCoverage.issues,
    ...batchCoverage.flatMap((check) => check.issues),
    ...inventoryCoverage.issues,
    ...auditConsistency.issues,
  ]);
  const summary = summarizeAgenticCoverageVerification({
    itemCoverage,
    artifactCoverage,
    issues,
  });
  const status = aggregateStatus([
    itemCoverage.status,
    artifactCoverage.status,
    ...batchCoverage.map((check) => check.status),
    inventoryCoverage.status,
    auditConsistency.status,
  ]);

  return {
    ok: status === "verified" && issues.length === 0,
    taskId: normalized.taskId,
    status,
    itemCoverage,
    artifactCoverage,
    batchCoverage,
    inventoryCoverage,
    auditConsistency,
    issues,
    summary,
  };
}

export function verifyAgenticItemCoverage(
  input: AgenticCoverageVerifierInput,
): AgenticItemCoverageCheck {
  const normalized = normalizeInput(input);
  const expectedItems = getExpectedItemCount(normalized);
  const derivedCounts = countItems(normalized.workItems);
  const preferCoverageCounts = normalized.coverage !== undefined;
  const completedItems =
    !preferCoverageCounts && normalized.workItems.length > 0
      ? derivedCounts.completed
      : (normalized.coverage?.completedItemCount ?? 0);
  const failedItems =
    !preferCoverageCounts && normalized.workItems.length > 0
      ? derivedCounts.failed
      : (normalized.coverage?.explicitlyFailedItemCount ?? 0);
  const skippedItems =
    !preferCoverageCounts && normalized.workItems.length > 0
      ? derivedCounts.skipped
      : (normalized.coverage?.explicitlySkippedItemCount ?? 0);
  const pendingItems =
    !preferCoverageCounts && normalized.workItems.length > 0
      ? derivedCounts.pending
      : (normalized.coverage?.pendingItemCount ?? 0);
  const retryableItems =
    !preferCoverageCounts && normalized.workItems.length > 0
      ? derivedCounts.retryable
      : (normalized.coverage?.retryableItemCount ?? 0);
  const missingItemIds = normalized.workItems
    .filter((item) => item.state === "pending" || item.state === "in_progress")
    .map((item) => item.id)
    .sort();

  const issues: AgenticCoverageVerifierIssue[] = [];
  const terminalItems = completedItems + failedItems + skippedItems;

  if (expectedItems < 0) {
    issues.push(
      issue(
        "item_expected_count_invalid",
        "Expected item count must be non-negative.",
        "error",
        "coverage_failure",
        "item-coverage",
        false,
      ),
    );
  }

  if (pendingItems > 0 || retryableItems > 0) {
    issues.push(
      issue(
        "item_coverage_incomplete",
        `Item coverage has ${pendingItems} pending items and ${retryableItems} retryable items.`,
        "error",
        "coverage_failure",
        "item-coverage",
        true,
      ),
    );
  }

  if (expectedItems !== terminalItems) {
    issues.push(
      issue(
        "item_accounting_incomplete",
        `Expected ${expectedItems} items but completed, failed, and skipped items account for ${terminalItems}.`,
        "error",
        "coverage_failure",
        "item-coverage",
        true,
      ),
    );
  }

  issues.push(
    ...coverageCountMismatchIssues(normalized, derivedCounts, expectedItems),
  );
  issues.push(...workItemInventoryCountIssues(normalized.workItems, expectedItems));
  issues.push(...duplicateWorkItemIssues(normalized.workItems));

  const status = statusFromIssues(issues, expectedItems === terminalItems);

  return {
    id: "item-coverage",
    kind: "item_coverage",
    required: true,
    status,
    coverageComplete: status === "verified",
    issues: uniqueIssues(issues),
    rule: ITEM_RULE,
    expectedItems,
    completedItems,
    failedItems,
    skippedItems,
    pendingItems,
    retryableItems,
    missingItemIds,
  };
}

export function verifyAgenticArtifactCoverage(
  input: AgenticCoverageVerifierInput,
): AgenticArtifactCoverageCheck {
  const normalized = normalizeInput(input);
  const artifactCoverage = normalized.coverage?.artifacts;
  const expectedArtifacts = uniqueSorted([
    ...(artifactCoverage?.expectedArtifacts ?? []),
    ...normalized.workItems.flatMap((item) => item.expectedArtifacts ?? []),
  ]);
  const verifiedArtifacts = uniqueSorted(artifactCoverage?.verifiedArtifacts ?? []);
  const declaredMissing = artifactCoverage?.missingArtifacts ?? [];
  const missingArtifacts = uniqueSorted([
    ...declaredMissing,
    ...expectedArtifacts.filter((artifact) => !verifiedArtifacts.includes(artifact)),
  ]);
  const extraArtifacts = uniqueSorted([
    ...(artifactCoverage?.extraArtifacts ?? []),
    ...verifiedArtifacts.filter((artifact) => !expectedArtifacts.includes(artifact)),
  ]);
  const issues: AgenticCoverageVerifierIssue[] = [];

  for (const artifactPath of missingArtifacts) {
    issues.push(
      issue(
        "artifact_missing",
        `Expected artifact ${artifactPath} was not verified.`,
        "error",
        "artifact_failure",
        "artifact-coverage",
        true,
        { artifactPath },
      ),
    );
  }

  if (!normalized.options.allowExtraArtifacts) {
    for (const artifactPath of extraArtifacts) {
      issues.push(
        issue(
          "artifact_extra",
          `Verified artifact ${artifactPath} was not expected.`,
          "warning",
          "artifact_failure",
          "artifact-coverage",
          false,
          { artifactPath },
        ),
      );
    }
  }

  const required = expectedArtifacts.length > 0;
  const status = statusFromIssues(issues, missingArtifacts.length === 0);

  return {
    id: "artifact-coverage",
    kind: "artifact_coverage",
    required,
    status,
    coverageComplete: status === "verified",
    issues: uniqueIssues(issues),
    expectedArtifacts,
    verifiedArtifacts,
    missingArtifacts,
    extraArtifacts,
  };
}

export function verifyAgenticBatchCoverage(
  input: AgenticCoverageVerifierInput,
): readonly AgenticBatchCoverageCheck[] {
  const normalized = normalizeInput(input);
  const itemById = new Map(
    normalized.workItems.map((item): readonly [AgenticWorkItemId, AgenticWorkItem] => [
      item.id,
      item,
    ]),
  );
  const batchByItem = new Map<AgenticWorkItemId, string>();

  return [...normalized.batches]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((batch) => {
      const batchItems = batch.workItemIds
        .map((id) => itemById.get(id))
        .filter((item): item is AgenticWorkItem => item !== undefined);
      const counts = countItems(batchItems);
      const completedItems =
        batchItems.length > 0 ? counts.completed : batch.completedCount;
      const failedItems = batchItems.length > 0 ? counts.failed : batch.failedCount;
      const skippedItems =
        batchItems.length > 0 ? counts.skipped : batch.skippedCount;
      const retryableItems =
        batchItems.length > 0 ? counts.retryable : batch.retryableCount;
      const accountedItems =
        completedItems +
        failedItems +
        skippedItems +
        retryableItems +
        counts.pending;
      const issues: AgenticCoverageVerifierIssue[] = [];

      for (const workItemId of batch.workItemIds) {
        if (!itemById.has(workItemId)) {
          issues.push(
            issue(
              "batch_unknown_item",
              `Batch ${batch.id} references unknown work item ${workItemId}.`,
              "error",
              "inventory_failure",
              `batch-coverage:${batch.id}`,
              false,
              { batchId: batch.id, workItemId },
            ),
          );
        }

        const existingBatchId = batchByItem.get(workItemId);
        if (existingBatchId !== undefined && existingBatchId !== batch.id) {
          issues.push(
            issue(
              "batch_duplicate_item",
              `Work item ${workItemId} appears in more than one batch.`,
              "error",
              "coverage_failure",
              `batch-coverage:${batch.id}`,
              false,
              { batchId: batch.id, workItemId },
            ),
          );
        }
        batchByItem.set(workItemId, batch.id);
      }

      if (
        batchItems.length > 0 &&
        (batch.completedCount !== counts.completed ||
          batch.failedCount !== counts.failed ||
          batch.skippedCount !== counts.skipped ||
          batch.retryableCount !== counts.retryable)
      ) {
        issues.push(
          issue(
            "batch_accounting_mismatch",
            "Batch counters do not match referenced work item states.",
            "error",
            "coverage_failure",
            `batch-coverage:${batch.id}`,
            false,
            { batchId: batch.id },
          ),
        );
      }

      if (accountedItems > batch.expectedItemCount) {
        issues.push(
          issue(
            "batch_accounting_overflow",
            `Batch ${batch.id} accounts for ${accountedItems} items but expected ${batch.expectedItemCount}.`,
            "error",
            "coverage_failure",
            `batch-coverage:${batch.id}`,
            false,
            { batchId: batch.id },
          ),
        );
      }

      if (accountedItems < batch.expectedItemCount) {
        issues.push(
          issue(
            "batch_coverage_incomplete",
            `Batch ${batch.id} accounts for ${accountedItems} of ${batch.expectedItemCount} expected items.`,
            "error",
            "coverage_failure",
            `batch-coverage:${batch.id}`,
            true,
            { batchId: batch.id },
          ),
        );
      }

      const status = statusFromIssues(
        issues,
        accountedItems === batch.expectedItemCount,
      );

      return {
        id: `batch-coverage:${batch.id}`,
        kind: "batch_coverage",
        required: true,
        status,
        coverageComplete: status === "verified",
        issues: uniqueIssues(issues),
        batchId: batch.id,
        expectedItems: batch.expectedItemCount,
        completedItems,
        failedItems,
        skippedItems,
        retryableItems,
      };
    });
}

export function verifyAgenticInventoryCoverage(
  input: AgenticCoverageVerifierInput,
): AgenticInventoryCoverageCheck {
  const normalized = normalizeInput(input);
  const expectedItemCount = getExpectedItemCount(normalized);
  const discoveredItemCount =
    normalized.inventory?.discoveredItemCount ??
    normalized.coverage?.expectedItemCount ??
    normalized.workItems.length;
  const inventoryComplete = normalized.inventory?.status === "complete";
  const discoveredButNotInventoried =
    normalized.coverage?.discoveredButNotInventoriedCount ?? 0;
  const issues: AgenticCoverageVerifierIssue[] = [];

  if (normalized.options.requireInventoryComplete && !inventoryComplete) {
    issues.push(
      issue(
        "inventory_incomplete",
        "Inventory is not complete.",
        "error",
        "inventory_failure",
        "inventory-coverage",
        true,
      ),
    );
  }

  if (expectedItemCount < 0 || discoveredItemCount < 0) {
    issues.push(
      issue(
        "inventory_count_invalid",
        "Inventory item counts must be non-negative.",
        "error",
        "inventory_failure",
        "inventory-coverage",
        false,
      ),
    );
  }

  if (expectedItemCount !== discoveredItemCount) {
    issues.push(
      issue(
        "inventory_item_count_mismatch",
        `Expected ${expectedItemCount} inventory items but discovered ${discoveredItemCount} items.`,
        "error",
        "inventory_failure",
        "inventory-coverage",
        true,
      ),
    );
  }

  if (discoveredButNotInventoried > 0) {
    issues.push(
      issue(
        "inventory_discovered_not_inventoried",
        `${discoveredButNotInventoried} discovered items are not inventoried.`,
        "error",
        "inventory_failure",
        "inventory-coverage",
        true,
      ),
    );
  }

  const status = statusFromIssues(
    issues,
    !normalized.options.requireInventoryComplete ||
      (inventoryComplete &&
        expectedItemCount === discoveredItemCount &&
        discoveredButNotInventoried === 0),
  );

  return {
    id: "inventory-coverage",
    kind: "inventory_coverage",
    required: normalized.options.requireInventoryComplete,
    status,
    coverageComplete: status === "verified",
    issues: uniqueIssues(issues),
    inventorySource: normalized.inventory?.source ?? "unknown",
    expectedItemCount,
    discoveredItemCount,
    inventoryComplete,
  };
}

export function verifyAgenticAuditConsistency(
  input: AgenticCoverageVerifierInput,
): AgenticAuditConsistencyCheck {
  const normalized = normalizeInput(input);
  const observedAuditEventIds = uniqueSorted(
    normalized.auditReferences.flatMap((reference) => reference.auditEventIds),
  );
  const expectedAuditEventIds = uniqueSorted([
    ...(normalized.verificationSnapshot?.auditEventIds ?? []),
    ...(normalized.coverage?.issues.flatMap((entry) => entry.auditEventIds ?? []) ??
      []),
  ]);
  const missingAuditEventIds = expectedAuditEventIds.filter(
    (eventId) => !observedAuditEventIds.includes(eventId),
  );
  const issues: AgenticCoverageVerifierIssue[] = [];

  if (normalized.options.requireAuditConsistency && missingAuditEventIds.length > 0) {
    issues.push(
      issue(
        "audit_event_missing",
        "Expected audit events were not observed.",
        "error",
        "audit_failure",
        "audit-consistency",
        false,
        { auditEventIds: missingAuditEventIds },
      ),
    );
  }

  const status =
    !normalized.options.requireAuditConsistency || missingAuditEventIds.length === 0
      ? "verified"
      : "failed";

  return {
    id: "audit-consistency",
    kind: "audit_consistency",
    required: normalized.options.requireAuditConsistency,
    status,
    coverageComplete: status === "verified",
    issues,
    expectedAuditEventCount:
      expectedAuditEventIds.length > 0 ? expectedAuditEventIds.length : undefined,
    observedAuditEventCount:
      expectedAuditEventIds.length > 0 ? observedAuditEventIds.length : undefined,
    missingAuditEventIds,
    consistencyStatus: status,
  };
}

export function summarizeAgenticCoverageVerification(input: {
  readonly itemCoverage: AgenticItemCoverageCheck;
  readonly artifactCoverage: AgenticArtifactCoverageCheck;
  readonly issues: readonly AgenticCoverageVerifierIssue[];
}): AgenticCoverageVerifierSummary {
  return {
    expectedItems: input.itemCoverage.expectedItems,
    completedItems: input.itemCoverage.completedItems,
    failedItems: input.itemCoverage.failedItems,
    skippedItems: input.itemCoverage.skippedItems,
    pendingItems: input.itemCoverage.pendingItems,
    retryableItems: input.itemCoverage.retryableItems,
    expectedArtifacts: input.artifactCoverage.expectedArtifacts.length,
    verifiedArtifacts: input.artifactCoverage.verifiedArtifacts.length,
    missingArtifacts: input.artifactCoverage.missingArtifacts.length,
    issueCount: input.issues.length,
  };
}

function normalizeInput(
  input: AgenticCoverageVerifierInput,
): NormalizedVerifierInput {
  const lifecycle = input.lifecycle;
  const lifecycleResult = input.lifecycleResult;
  const options = {
    ...DEFAULT_OPTIONS,
    ...input.options,
    mode: input.mode ?? input.options?.mode ?? DEFAULT_OPTIONS.mode,
  };

  return {
    taskId: input.taskId,
    inventory:
      input.inventory ?? lifecycle?.inventory ?? lifecycleResult?.inventory,
    workItems: input.workItems ?? lifecycle?.workItems ?? [],
    batches: input.batches ?? lifecycle?.batches ?? lifecycleResult?.batches ?? [],
    coverage:
      input.coverage ?? lifecycle?.coverage ?? lifecycleResult?.coverage,
    verificationSnapshot:
      input.verificationSnapshot ??
      lifecycle?.verification ??
      lifecycleResult?.verification,
    auditReferences: [
      ...(input.auditReferences ?? []),
      ...(lifecycle?.audit ? [lifecycle.audit] : []),
      ...(lifecycleResult?.audit ? [lifecycleResult.audit] : []),
    ],
    options,
  };
}

function getExpectedItemCount(input: NormalizedVerifierInput): number {
  return (
    input.inventory?.expectedItemCount ??
    input.coverage?.expectedItemCount ??
    input.workItems.length
  );
}

function countItems(items: readonly AgenticWorkItem[]): ItemCounts {
  let completed = 0;
  let failed = 0;
  let skipped = 0;
  let pending = 0;
  let retryable = 0;

  for (const item of items) {
    if (item.state === "completed" || item.state === "verified") {
      completed += 1;
    } else if (item.state === "failed") {
      failed += 1;
    } else if (item.state === "skipped") {
      skipped += 1;
    } else if (item.state === "retryable") {
      retryable += 1;
    } else {
      pending += 1;
    }
  }

  return { completed, failed, skipped, pending, retryable };
}

function coverageCountMismatchIssues(
  input: NormalizedVerifierInput,
  counts: ItemCounts,
  expectedItems: number,
): readonly AgenticCoverageVerifierIssue[] {
  if (
    input.coverage === undefined ||
    input.workItems.length === 0 ||
    input.workItems.length !== expectedItems
  ) {
    return [];
  }

  const checks: readonly {
    readonly code: string;
    readonly label: string;
    readonly expected: number;
    readonly observed: number;
  }[] = [
    {
      code: "coverage_completed_count_mismatch",
      label: "completed",
      expected: counts.completed,
      observed: input.coverage.completedItemCount,
    },
    {
      code: "coverage_failed_count_mismatch",
      label: "failed",
      expected: counts.failed,
      observed: input.coverage.explicitlyFailedItemCount,
    },
    {
      code: "coverage_skipped_count_mismatch",
      label: "skipped",
      expected: counts.skipped,
      observed: input.coverage.explicitlySkippedItemCount,
    },
    {
      code: "coverage_pending_count_mismatch",
      label: "pending",
      expected: counts.pending,
      observed: input.coverage.pendingItemCount,
    },
    {
      code: "coverage_retryable_count_mismatch",
      label: "retryable",
      expected: counts.retryable,
      observed: input.coverage.retryableItemCount,
    },
  ];

  return checks
    .filter((check) => check.expected !== check.observed)
    .map((check) =>
      issue(
        check.code,
        `Coverage reports ${check.observed} ${check.label} items but work item states show ${check.expected}.`,
        "error",
        "coverage_failure",
        "item-coverage",
        false,
      ),
    );
}

function workItemInventoryCountIssues(
  workItems: readonly AgenticWorkItem[],
  expectedItems: number,
): readonly AgenticCoverageVerifierIssue[] {
  if (workItems.length === 0 || workItems.length === expectedItems) {
    return [];
  }

  return [
    issue(
      "work_item_inventory_count_mismatch",
      `Expected ${expectedItems} work item ids but verifier input includes ${workItems.length}.`,
      "error",
      "inventory_failure",
      "item-coverage",
      true,
    ),
  ];
}

function duplicateWorkItemIssues(
  workItems: readonly AgenticWorkItem[],
): readonly AgenticCoverageVerifierIssue[] {
  const seen = new Set<AgenticWorkItemId>();
  const duplicates = new Set<AgenticWorkItemId>();

  for (const item of workItems) {
    if (seen.has(item.id)) {
      duplicates.add(item.id);
    }
    seen.add(item.id);
  }

  return [...duplicates].sort().map((workItemId) =>
    issue(
      "work_item_duplicate",
      `Work item ${workItemId} appears more than once.`,
      "error",
      "inventory_failure",
      "item-coverage",
      false,
      { workItemId },
    ),
  );
}

function aggregateStatus(
  statuses: readonly AgenticCoverageVerificationStatus[],
): AgenticCoverageVerificationStatus {
  if (statuses.includes("failed")) {
    return "failed";
  }
  if (statuses.includes("blocked")) {
    return "blocked";
  }
  if (statuses.includes("incomplete")) {
    return "incomplete";
  }
  if (statuses.every((status) => status === "verified")) {
    return "verified";
  }
  return "unknown";
}

function statusFromIssues(
  issues: readonly AgenticCoverageVerifierIssue[],
  complete: boolean,
): AgenticCoverageVerificationStatus {
  if (issues.some((entry) => entry.severity === "critical")) {
    return "failed";
  }
  if (issues.some((entry) => entry.category === "audit_failure")) {
    return "failed";
  }
  if (issues.some((entry) => entry.retryable === false)) {
    return "failed";
  }
  if (issues.length > 0 || !complete) {
    return "incomplete";
  }
  return "verified";
}

function issue(
  code: string,
  message: string,
  severity: AgenticLifecycleIssueSeverity,
  category: AgenticLifecycleIssueCategory,
  checkId: string,
  retryable: boolean,
  references: {
    readonly workItemId?: AgenticWorkItemId;
    readonly batchId?: string;
    readonly artifactPath?: string;
    readonly auditEventIds?: readonly AgenticAuditEventId[];
  } = {},
): AgenticCoverageVerifierIssue {
  return {
    code,
    message,
    severity,
    category,
    checkId,
    retryable,
    ...references,
  };
}

function uniqueIssues(
  issues: readonly AgenticCoverageVerifierIssue[],
): readonly AgenticCoverageVerifierIssue[] {
  const byKey = new Map<string, AgenticCoverageVerifierIssue>();

  for (const entry of issues) {
    const key = [
      entry.code,
      entry.checkId ?? "",
      entry.workItemId ?? "",
      entry.batchId ?? "",
      entry.artifactPath ?? "",
      entry.auditEventIds?.join(",") ?? "",
    ].join("|");
    if (!byKey.has(key)) {
      byKey.set(key, entry);
    }
  }

  return [...byKey.values()].sort(compareIssues);
}

function compareIssues(
  left: AgenticCoverageVerifierIssue,
  right: AgenticCoverageVerifierIssue,
): number {
  return (
    (left.checkId?.localeCompare(right.checkId ?? "") ?? 0) ||
    left.code.localeCompare(right.code) ||
    (left.workItemId ?? "").localeCompare(right.workItemId ?? "") ||
    (left.batchId ?? "").localeCompare(right.batchId ?? "") ||
    (left.artifactPath ?? "").localeCompare(right.artifactPath ?? "")
  );
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort();
}
