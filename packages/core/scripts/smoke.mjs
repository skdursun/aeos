import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile as writeNodeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { createFilesystemGenerationAdapter } from "../dist/filesystem-generation-writer.js";
import { runInitPipeline } from "../dist/init-pipeline.js";
import {
  fileGenerationLifecycle,
  incompleteSitemapLifecycle,
  incompleteSitemapResult,
  lifecycleResultFromExample,
  plannedSitemapLifecycle,
  resumeCursorExample,
  verifiedCompleteLifecycle,
} from "../dist/agentic-lifecycle.example.js";
import {
  artifactCoverageIncompleteResult,
  batchInventoryAndAuditCoverageResult,
  completeItemCoverageResult,
  incompleteSitemapCoverageResult,
} from "../dist/agentic-coverage-verifier.example.js";
import {
  auditHandoffGap,
  auditHandoffGapIssue,
  incompleteSitemapResult as incompleteSitemapRunnerResult,
  plannedRunnerResult,
  resumeRunnerState,
  verifiedCompleteResult as verifiedCompleteRunnerResult,
  waitingForApprovalResult,
} from "../dist/agentic-runner.example.js";
import {
  auditExpectationGapPlanningResult,
  blockedPolicyPlanningResult,
  resumePlanningResult,
  sitemapAuditPlanningInput,
  sitemapAuditPlanningResult,
  verifierGatedCompletionPlanningResult,
  waitingForApprovalPlanningResult,
} from "../dist/agentic-runner-planning.example.js";
import { planAgenticRunner, verifyAgenticCoverage } from "../dist/index.js";

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

function issueCodes(result) {
  return result.issues.map((issue) => issue.code);
}

function resultIssueCodes(result) {
  return result.errors.map((issue) => issue.code);
}

function createInitRequest(projectRoot) {
  return {
    projectRoot,
    template: {
      templateId: "smoke-template",
      templateVersion: "0.0.0-smoke",
    },
    variables: {
      projectName: "Smoke Project",
    },
    requestedAt: "2026-08-03T00:00:00.000Z",
  };
}

function createRenderedArtifact(targetPath, content) {
  return {
    path: targetPath,
    summary: `Render ${targetPath}.`,
    stage: "rendering",
    renderedArtifact: {
      targetPath,
      content,
      kind: "text",
      summary: `Render ${targetPath}.`,
      sourcePath: "smoke-template/AGENTS.md",
      templateId: "smoke-template",
      templateVersion: "0.0.0-smoke",
    },
  };
}

function createRenderOnlyAdapters(artifacts) {
  return {
    render: {
      runRendering() {
        return {
          stage: "rendering",
          status: "success",
          issues: [],
          artifacts,
        };
      },
    },
  };
}

async function runRenderedInitPipeline(targetRoot, artifacts, generation) {
  return runInitPipeline(
    createInitRequest(targetRoot),
    createRenderOnlyAdapters(artifacts),
    {
      stages: ["rendering", "file_writing"],
      generation,
    },
  );
}

function generatedFileFor(result, path) {
  return result.generatedFiles.find((file) => file.path === path);
}

function assertLifecycleSummaryMatchesShape(lifecycle, expected) {
  assert.deepEqual(
    lifecycle.summary,
    expected,
    `${lifecycle.taskId} summary fields should remain stable`,
  );
  assert.equal(
    lifecycle.summary.issueCount,
    lifecycle.issues.length,
    `${lifecycle.taskId} issue count should match issues array length`,
  );
}

function assertIssueCountMatches(result) {
  assert.equal(
    result.summary.issueCount,
    result.issues.length,
    `${result.taskId} result issue count should match issues array length`,
  );
}

function assertVerifierIssueCountMatches(result) {
  assert.equal(
    result.summary.issueCount,
    result.issues.length,
    `${result.taskId} verifier issue count should match issues array length`,
  );
}

function assertVerifierResultShape(result) {
  assert.ok(
    Object.hasOwn(result, "ok"),
    `${result.taskId} verifier result should expose ok`,
  );
  assert.ok(
    Object.hasOwn(result, "taskId"),
    `${result.taskId} verifier result should expose taskId`,
  );
  assert.ok(
    Object.hasOwn(result, "status"),
    `${result.taskId} verifier result should expose status`,
  );
  assert.ok(
    Object.hasOwn(result, "itemCoverage"),
    `${result.taskId} verifier result should expose itemCoverage`,
  );
  assert.ok(
    Object.hasOwn(result, "artifactCoverage"),
    `${result.taskId} verifier result should expose artifactCoverage`,
  );
  assert.ok(
    Object.hasOwn(result, "batchCoverage"),
    `${result.taskId} verifier result should expose batchCoverage`,
  );
  assert.ok(
    Object.hasOwn(result, "inventoryCoverage"),
    `${result.taskId} verifier result should expose inventoryCoverage`,
  );
  assert.ok(
    Object.hasOwn(result, "auditConsistency"),
    `${result.taskId} verifier result should expose auditConsistency`,
  );
  assert.ok(
    Object.hasOwn(result, "issues"),
    `${result.taskId} verifier result should expose issues`,
  );
  assert.ok(
    Object.hasOwn(result, "summary"),
    `${result.taskId} verifier result should expose summary`,
  );
}

function assertRunnerResultShape(result) {
  for (const field of [
    "ok",
    "taskId",
    "state",
    "mode",
    "plan",
    "policy",
    "executionBoundary",
    "audit",
    "verifier",
    "issues",
    "summary",
  ]) {
    assert.ok(
      Object.hasOwn(result, field),
      `${result.taskId} runner result should expose stable field ${field}`,
    );
  }

  for (const field of ["lifecycle", "resume"]) {
    assert.ok(
      !Object.hasOwn(result, field) || typeof result[field] === "object",
      `${result.taskId} runner result ${field} field should remain optional object shape`,
    );
  }

  assert.ok(
    Array.isArray(result.plan.steps),
    `${result.taskId} runner result should expose planned steps`,
  );
  assert.ok(
    Array.isArray(result.issues),
    `${result.taskId} runner result should expose issues array`,
  );
}

function assertRunnerSummaryConsistent(result) {
  assert.equal(
    result.summary.plannedSteps,
    result.plan.steps.length,
    `${result.taskId} runner summary planned step count should match plan`,
  );
  assert.equal(
    result.summary.expectedWorkItems,
    result.plan.expectedWorkItemCount,
    `${result.taskId} runner summary expected work items should match plan`,
  );
  assert.equal(
    result.summary.auditEventsEmitted,
    result.audit.emittedAuditEventIds.length,
    `${result.taskId} runner summary emitted audit count should match handoff`,
  );
  assert.equal(
    result.summary.verifierIssueCount,
    result.verifier.verifierIssues.length,
    `${result.taskId} runner summary verifier issue count should match verifier handoff`,
  );
  assert.equal(
    result.summary.issueCount,
    result.issues.length,
    `${result.taskId} runner summary issue count should match issues`,
  );
}

function assertVerifierGateHonest(result) {
  if (result.ok || result.state === "completed") {
    assert.equal(
      result.verifier.verifierStatus,
      "verified",
      `${result.taskId} runner result must not complete without verified handoff`,
    );
  }
}

function planningIssueCount(result) {
  return (
    result.issues.length +
    result.prerequisites.reduce(
      (count, prerequisite) => count + prerequisite.issues.length,
      0,
    ) +
    result.workItems.reduce((count, workItem) => count + workItem.issues.length, 0) +
    result.batches.reduce((count, batch) => count + batch.issues.length, 0) +
    result.steps.reduce((count, step) => count + step.issues.length, 0) +
    result.policy.reduce((count, policy) => count + policy.issues.length, 0) +
    result.adapterBoundary.issues.length +
    result.audit.issues.length +
    result.verifier.issues.length
  );
}

function assertPlanningResultShape(result) {
  for (const field of [
    "ok",
    "taskId",
    "mode",
    "prerequisites",
    "workItems",
    "batches",
    "steps",
    "policy",
    "adapterBoundary",
    "audit",
    "verifier",
    "issues",
    "summary",
  ]) {
    assert.ok(
      Object.hasOwn(result, field),
      `${result.taskId} planning result should expose stable field ${field}`,
    );
  }

  assert.ok(
    !Object.hasOwn(result, "resume") ||
      result.resume === undefined ||
      typeof result.resume === "object",
    `${result.taskId} planning result resume field should remain optional object shape`,
  );
  assert.ok(
    Array.isArray(result.prerequisites),
    `${result.taskId} planning result should expose prerequisites array`,
  );
  assert.ok(
    Array.isArray(result.workItems),
    `${result.taskId} planning result should expose work item plan array`,
  );
  assert.ok(
    Array.isArray(result.batches),
    `${result.taskId} planning result should expose batch plan array`,
  );
  assert.ok(
    Array.isArray(result.steps),
    `${result.taskId} planning result should expose step plan array`,
  );
  assert.ok(
    Array.isArray(result.policy),
    `${result.taskId} planning result should expose policy plan array`,
  );
  assert.ok(
    Array.isArray(result.issues),
    `${result.taskId} planning result should expose issues array`,
  );
}

function assertPlanningSummaryConsistent(result) {
  const adapterReferenceCount =
    result.adapterBoundary.modelAdapterReferences.length +
    result.adapterBoundary.toolAdapterReferences.length;

  assert.equal(
    result.summary.prerequisiteCount,
    result.prerequisites.length,
    `${result.taskId} planning summary prerequisite count should match prerequisites`,
  );
  assert.ok(
    result.summary.workItemCount >= result.workItems.length,
    `${result.taskId} planning summary work item count should cover represented work item plans`,
  );
  assert.ok(
    result.summary.batchCount >= result.batches.length,
    `${result.taskId} planning summary batch count should cover represented batches`,
  );
  assert.equal(
    result.summary.stepCount,
    result.steps.length,
    `${result.taskId} planning summary step count should match steps`,
  );
  assert.equal(
    result.summary.policyGateCount,
    result.policy.length,
    `${result.taskId} planning summary policy gate count should match policy plans`,
  );
  assert.equal(
    result.summary.adapterReferenceCount,
    adapterReferenceCount,
    `${result.taskId} planning summary adapter reference count should match adapter boundary`,
  );
  assert.equal(
    result.summary.expectedAuditEventCount,
    result.audit.expectedAuditEventIds.length,
    `${result.taskId} planning summary expected audit event count should match audit expectations`,
  );
  assert.equal(
    result.summary.verifierRequired,
    result.verifier.verifierRequired,
    `${result.taskId} planning summary verifierRequired should match verifier plan`,
  );
  assert.equal(
    result.summary.approvalRequired,
    result.adapterBoundary.approvalRequired ||
      result.policy.some((policy) => policy.approvalRequired),
    `${result.taskId} planning summary approvalRequired should match approval gates`,
  );
  assert.equal(
    result.summary.issueCount,
    result.issues.length,
    `${result.taskId} planning summary issue count should match top-level issues`,
  );
  assert.ok(
    planningIssueCount(result) >= result.summary.issueCount,
    `${result.taskId} planning nested issues should include summary issues where represented`,
  );
}

function assertDirectPlanningSummaryHonest(result) {
  const adapterReferenceCount =
    result.adapterBoundary.modelAdapterReferences.length +
    result.adapterBoundary.toolAdapterReferences.length;

  assert.deepEqual(
    result.summary,
    {
      prerequisiteCount: result.prerequisites.length,
      workItemCount: result.workItems.length,
      batchCount: result.batches.length,
      stepCount: result.steps.length,
      policyGateCount: result.policy.length,
      adapterReferenceCount,
      expectedAuditEventCount: result.audit.expectedAuditEventIds.length,
      verifierRequired: result.verifier.verifierRequired,
      approvalRequired:
        result.adapterBoundary.approvalRequired ||
        result.policy.some((policy) => policy.approvalRequired),
      issueCount: result.issues.length,
    },
    `${result.taskId} direct planning summary should match represented result shape`,
  );
}

function assertDirectPlanningResultShape(result) {
  assert.deepEqual(
    Object.keys(result),
    [
      "ok",
      "taskId",
      "mode",
      "prerequisites",
      "workItems",
      "batches",
      "steps",
      "policy",
      "adapterBoundary",
      "audit",
      "verifier",
      "resume",
      "issues",
      "summary",
    ],
    `${result.taskId} direct planning result should expose stable top-level fields`,
  );
  assertPlanningResultShape(result);
}

function assertPlanningStepsNotCompleted(result, message) {
  assert.equal(
    result.steps.some((step) => step.state === "completed"),
    false,
    message,
  );
}

function planningIssueSummaries(result) {
  return result.issues.map((issue) => ({
    code: issue.code,
    message: issue.message,
    workItemId: issue.workItemId,
    batchId: issue.batchId,
    policyGateId: issue.policyGateId,
    auditEventIds: issue.auditEventIds,
  }));
}

function createPlanningTaskContract(taskId) {
  return {
    kind: "reference",
    reference: {
      id: `task-contract-${taskId}`,
    },
  };
}

function createPlanningWorkItem(id, batchId, state = "pending", issues = []) {
  return {
    id,
    state,
    batchId,
    issues,
  };
}

function createPlanningBatch(id, workItemIds) {
  return {
    id,
    workItemIds,
    expectedItemCount: workItemIds.length,
    completedCount: 0,
    failedCount: 0,
    skippedCount: 0,
    retryableCount: 0,
  };
}

function createVerifierRequirement(verifierId) {
  return {
    verifierRequired: true,
    verifierId,
    expectedCoverageRule:
      "expected_items == completed_items + explicitly_failed_items + explicitly_skipped_items",
    completionGatedByVerifier: true,
    issues: [],
    metadata: {
      verifierHandoffRequired: true,
    },
  };
}

function assertPlanningVerifierGateHonest(result) {
  const executableOperations = result.adapterBoundary.allowedOperations.some(
    (operation) =>
      operation === "batch.execute" ||
      operation === "runner.complete" ||
      operation === "verifier.handoff",
  );
  const explicitException =
    result.ok === false &&
    (result.prerequisites.some((prerequisite) =>
      ["blocked", "failed", "incomplete", "missing"].includes(
        prerequisite.status,
      ),
    ) ||
      result.policy.some((policy) =>
        ["denied", "requires_approval", "blocked"].includes(policy.status),
      ) ||
      result.issues.length > 0 ||
      result.adapterBoundary.approvalRequired);

  if (result.ok && executableOperations) {
    assert.equal(
      result.verifier.verifierRequired || result.verifier.completionGatedByVerifier,
      true,
      `${result.taskId} planning result must gate executable planning with verifier requirements`,
    );
    assert.notEqual(
      result.steps.some((step) => step.state === "completed"),
      true,
      `${result.taskId} planning result must not represent completed steps before verifier handoff`,
    );
  } else {
    assert.equal(
      explicitException || !executableOperations,
      true,
      `${result.taskId} non-verifier-gated planning result should expose an explicit non-executable exception`,
    );
  }
}

function emptyArtifactCoverage() {
  return {
    expectedArtifacts: [],
    verifiedArtifacts: [],
    missingArtifacts: [],
    extraArtifacts: [],
  };
}

function completeInventory(expectedItemCount, source = "smoke-inventory") {
  return {
    source,
    expectedItemCount,
    discoveredItemCount: expectedItemCount,
    status: "complete",
    issues: [],
  };
}

function coverageCounts({
  expectedItemCount,
  completedItemCount,
  failedItemCount = 0,
  skippedItemCount = 0,
  pendingItemCount = 0,
  retryableItemCount = 0,
  artifacts = emptyArtifactCoverage(),
}) {
  return {
    status:
      pendingItemCount === 0 && retryableItemCount === 0
        ? "satisfied"
        : "incomplete",
    expectedItemCount,
    completedItemCount,
    verifiedItemCount: completedItemCount,
    explicitlyFailedItemCount: failedItemCount,
    explicitlySkippedItemCount: skippedItemCount,
    pendingItemCount,
    retryableItemCount,
    artifacts,
    rules: [],
    issues: [],
  };
}

function assertNoIssueCountDrift(result) {
  assert.equal(
    result.summary.issueCount,
    result.issues.length,
    `${result.taskId} summary issue count should match verifier issues`,
  );
}

function assertVerifierSummaryHonest(result) {
  assert.equal(
    result.summary.expectedItems,
    result.itemCoverage.expectedItems,
    `${result.taskId} summary expected item count should match item coverage`,
  );
  assert.equal(
    result.summary.completedItems,
    result.itemCoverage.completedItems,
    `${result.taskId} summary completed item count should match item coverage`,
  );
  assert.equal(
    result.summary.failedItems,
    result.itemCoverage.failedItems,
    `${result.taskId} summary failed item count should match item coverage`,
  );
  assert.equal(
    result.summary.skippedItems,
    result.itemCoverage.skippedItems,
    `${result.taskId} summary skipped item count should match item coverage`,
  );
  assert.equal(
    result.summary.pendingItems,
    result.itemCoverage.pendingItems,
    `${result.taskId} summary pending item count should match item coverage`,
  );
  assert.equal(
    result.summary.retryableItems,
    result.itemCoverage.retryableItems,
    `${result.taskId} summary retryable item count should match item coverage`,
  );
  assert.equal(
    result.summary.expectedArtifacts,
    result.artifactCoverage.expectedArtifacts.length,
    `${result.taskId} summary expected artifact count should match artifact coverage`,
  );
  assert.equal(
    result.summary.verifiedArtifacts,
    result.artifactCoverage.verifiedArtifacts.length,
    `${result.taskId} summary verified artifact count should match artifact coverage`,
  );
  assert.equal(
    result.summary.missingArtifacts,
    result.artifactCoverage.missingArtifacts.length,
    `${result.taskId} summary missing artifact count should match artifact coverage`,
  );
  assertNoIssueCountDrift(result);
}

function assertRejectedVerifierResult(result, expectedStatuses, message) {
  assertVerifierResultShape(result);
  assertVerifierSummaryHonest(result);
  assert.equal(result.ok, false, `${message} should not be ok`);
  assert.ok(
    expectedStatuses.includes(result.status),
    `${message} should report one of ${expectedStatuses.join(", ")}`,
  );
  assert.ok(result.issues.length > 0, `${message} should expose issues`);
}

function assertVerifiedVerifierResult(result, message) {
  assertVerifierResultShape(result);
  assertVerifierSummaryHonest(result);
  assert.equal(result.ok, true, `${message} should be ok`);
  assert.equal(result.status, "verified", `${message} should be verified`);
  assert.equal(result.issues.length, 0, `${message} should not expose issues`);
}

const verifierResults = [
  incompleteSitemapCoverageResult,
  completeItemCoverageResult,
  artifactCoverageIncompleteResult,
  batchInventoryAndAuditCoverageResult,
];

for (const verifierResult of verifierResults) {
  assertVerifierResultShape(verifierResult);
  assertVerifierIssueCountMatches(verifierResult);
}

const smokeIncompleteSitemapCoverage = verifyAgenticCoverage({
  taskId: "smoke-incomplete-sitemap-coverage",
  inventory: completeInventory(400, "sitemap.xml"),
  coverage: coverageCounts({
    expectedItemCount: 400,
    completedItemCount: 20,
    pendingItemCount: 380,
  }),
});

assertVerifierResultShape(smokeIncompleteSitemapCoverage);
assertNoIssueCountDrift(smokeIncompleteSitemapCoverage);
assert.equal(
  smokeIncompleteSitemapCoverage.itemCoverage.expectedItems,
  400,
  "logic smoke A should represent 400 expected sitemap items",
);
assert.equal(
  smokeIncompleteSitemapCoverage.itemCoverage.completedItems,
  20,
  "logic smoke A should represent only 20 completed sitemap items",
);
assert.equal(
  smokeIncompleteSitemapCoverage.itemCoverage.pendingItems,
  380,
  "logic smoke A should represent 380 remaining sitemap items",
);
assert.equal(
  smokeIncompleteSitemapCoverage.ok,
  false,
  "logic smoke A must reject incomplete sitemap coverage",
);
assert.equal(
  smokeIncompleteSitemapCoverage.status,
  "incomplete",
  "logic smoke A should be incomplete",
);
assert.ok(
  smokeIncompleteSitemapCoverage.issues.length > 0,
  "logic smoke A should expose verifier issues",
);
assert.equal(
  smokeIncompleteSitemapCoverage.itemCoverage.coverageComplete,
  false,
  "logic smoke A must not mark item coverage complete",
);
assert.notEqual(
  smokeIncompleteSitemapCoverage.itemCoverage.completedItems,
  smokeIncompleteSitemapCoverage.itemCoverage.expectedItems,
  "logic smoke A must not allow 20 of 400 to pass as complete",
);

const smokeCompleteItemCoverage = verifyAgenticCoverage({
  taskId: "smoke-complete-item-coverage",
  inventory: completeInventory(10),
  coverage: coverageCounts({
    expectedItemCount: 10,
    completedItemCount: 7,
    failedItemCount: 2,
    skippedItemCount: 1,
  }),
});
const smokeCompleteAccountedItems =
  smokeCompleteItemCoverage.itemCoverage.completedItems +
  smokeCompleteItemCoverage.itemCoverage.failedItems +
  smokeCompleteItemCoverage.itemCoverage.skippedItems;

assertVerifierResultShape(smokeCompleteItemCoverage);
assertNoIssueCountDrift(smokeCompleteItemCoverage);
assert.equal(
  smokeCompleteItemCoverage.itemCoverage.expectedItems,
  smokeCompleteAccountedItems,
  "logic smoke B should account for completed, failed, and skipped items",
);
assert.equal(
  smokeCompleteItemCoverage.itemCoverage.pendingItems,
  0,
  "logic smoke B should have no pending items",
);
assert.equal(
  smokeCompleteItemCoverage.itemCoverage.retryableItems,
  0,
  "logic smoke B should have no retryable items",
);
assert.equal(
  smokeCompleteItemCoverage.ok,
  true,
  "logic smoke B should verify complete item coverage",
);
assert.equal(
  smokeCompleteItemCoverage.status,
  "verified",
  "logic smoke B should be verified",
);
assert.equal(
  smokeCompleteItemCoverage.summary.issueCount,
  0,
  "logic smoke B should not report verifier issues",
);

const smokePendingRetryableCoverage = verifyAgenticCoverage({
  taskId: "smoke-pending-retryable-coverage",
  inventory: completeInventory(3),
  coverage: coverageCounts({
    expectedItemCount: 3,
    completedItemCount: 2,
    failedItemCount: 1,
    pendingItemCount: 1,
    retryableItemCount: 1,
  }),
});

assertNoIssueCountDrift(smokePendingRetryableCoverage);
assert.equal(
  smokePendingRetryableCoverage.itemCoverage.expectedItems,
  smokePendingRetryableCoverage.itemCoverage.completedItems +
    smokePendingRetryableCoverage.itemCoverage.failedItems +
    smokePendingRetryableCoverage.itemCoverage.skippedItems,
  "logic smoke C should balance only when pending and retryable items are ignored",
);
assert.equal(
  smokePendingRetryableCoverage.status,
  "incomplete",
  "logic smoke C should keep pending and retryable coverage incomplete",
);
assert.equal(
  smokePendingRetryableCoverage.ok,
  false,
  "logic smoke C must not verify while pending or retryable items remain",
);
assert.ok(
  smokePendingRetryableCoverage.issues.some(
    (issue) => issue.code === "item_coverage_incomplete",
  ),
  "logic smoke C should expose an item coverage issue",
);

const smokeArtifactGapCoverage = verifyAgenticCoverage({
  taskId: "smoke-artifact-gap-coverage",
  inventory: completeInventory(1, "artifact-manifest"),
  coverage: coverageCounts({
    expectedItemCount: 1,
    completedItemCount: 1,
    artifacts: {
      expectedArtifacts: ["report.json", "summary.json"],
      verifiedArtifacts: ["report.json"],
      missingArtifacts: [],
      extraArtifacts: [],
    },
  }),
});

assertNoIssueCountDrift(smokeArtifactGapCoverage);
assert.equal(
  smokeArtifactGapCoverage.summary.expectedArtifacts,
  2,
  "logic smoke D should represent expected artifact count",
);
assert.equal(
  smokeArtifactGapCoverage.summary.verifiedArtifacts,
  1,
  "logic smoke D should represent verified artifact count",
);
assert.ok(
  smokeArtifactGapCoverage.summary.missingArtifacts > 0,
  "logic smoke D should represent missing artifacts",
);
assert.equal(
  smokeArtifactGapCoverage.artifactCoverage.status,
  "incomplete",
  "logic smoke D artifact coverage should be incomplete",
);
assert.equal(
  smokeArtifactGapCoverage.status,
  "incomplete",
  "logic smoke D result should be incomplete",
);
assert.equal(
  smokeArtifactGapCoverage.ok,
  false,
  "logic smoke D must reject missing artifacts",
);

const smokeBatchMismatchCoverage = verifyAgenticCoverage({
  taskId: "smoke-batch-mismatch-coverage",
  inventory: completeInventory(2, "batch-inventory"),
  workItems: [
    { id: "batch-item-a", state: "completed" },
    { id: "batch-item-b", state: "completed" },
  ],
  batches: [
    {
      id: "batch-a",
      workItemIds: ["batch-item-a", "batch-item-b"],
      expectedItemCount: 2,
      completedCount: 1,
      failedCount: 1,
      skippedCount: 0,
      retryableCount: 0,
    },
  ],
});
const [smokeBatchMismatchCheck] = smokeBatchMismatchCoverage.batchCoverage;

assertNoIssueCountDrift(smokeBatchMismatchCoverage);
assert.ok(
  smokeBatchMismatchCheck.issues.some(
    (issue) => issue.code === "batch_accounting_mismatch",
  ),
  "logic smoke E should expose a mismatched batch issue",
);
assert.ok(
  ["failed", "incomplete"].includes(smokeBatchMismatchCheck.status),
  "logic smoke E batch check should be failed or incomplete",
);
assert.ok(
  ["failed", "incomplete"].includes(smokeBatchMismatchCoverage.status),
  "logic smoke E result should be failed or incomplete",
);
assert.equal(
  smokeBatchMismatchCoverage.summary.issueCount,
  smokeBatchMismatchCoverage.issues.length,
  "logic smoke E summary issue count should match issues length",
);

const smokeInventoryMismatchCoverage = verifyAgenticCoverage({
  taskId: "smoke-inventory-mismatch-coverage",
  inventory: {
    source: "crawler-inventory",
    expectedItemCount: 3,
    discoveredItemCount: 2,
    status: "incomplete",
    issues: [],
  },
});

assertNoIssueCountDrift(smokeInventoryMismatchCoverage);
assert.notEqual(
  smokeInventoryMismatchCoverage.inventoryCoverage.expectedItemCount,
  smokeInventoryMismatchCoverage.inventoryCoverage.discoveredItemCount,
  "logic smoke F should expose inventory expected/discovered mismatch",
);
assert.equal(
  smokeInventoryMismatchCoverage.inventoryCoverage.inventoryComplete,
  false,
  "logic smoke F should mark inventory incomplete",
);
assert.notEqual(
  smokeInventoryMismatchCoverage.status,
  "verified",
  "logic smoke F must not verify inventory mismatches",
);
assert.equal(
  smokeInventoryMismatchCoverage.ok,
  false,
  "logic smoke F must reject inventory mismatches",
);
assert.ok(
  smokeInventoryMismatchCoverage.issues.length > 0,
  "logic smoke F should expose verifier issues",
);

const smokeAuditConsistencyCoverage = verifyAgenticCoverage({
  taskId: "smoke-audit-consistency-coverage",
  inventory: completeInventory(1, "audit-inventory"),
  coverage: coverageCounts({
    expectedItemCount: 1,
    completedItemCount: 1,
  }),
  verificationSnapshot: {
    verifierId: "coverage-verifier",
    status: "fail",
    checkedAt: "2026-08-03T10:00:00.000Z",
    coverageStatus: "incomplete",
    issues: [],
    auditEventIds: ["audit-a", "audit-b", "audit-c"],
  },
  auditReferences: [
    {
      auditEventIds: ["audit-a"],
      createdAt: "2026-08-03T09:55:00.000Z",
      lastEventAt: "2026-08-03T09:59:00.000Z",
    },
  ],
  options: {
    requireAuditConsistency: true,
  },
});

assertNoIssueCountDrift(smokeAuditConsistencyCoverage);
assert.deepEqual(
  smokeAuditConsistencyCoverage.auditConsistency.missingAuditEventIds,
  ["audit-b", "audit-c"],
  "logic smoke G should represent missing audit event ids",
);
assert.notEqual(
  smokeAuditConsistencyCoverage.auditConsistency.consistencyStatus,
  "verified",
  "logic smoke G audit consistency should not be verified",
);
assert.notEqual(
  smokeAuditConsistencyCoverage.status,
  "verified",
  "logic smoke G result should not verify when required audit events are missing",
);
assert.ok(
  smokeAuditConsistencyCoverage.issues.some(
    (issue) => issue.code === "audit_event_missing",
  ),
  "logic smoke G should expose an audit consistency issue",
);

const smokeAggregatedInput = {
  taskId: "smoke-aggregated-coverage",
  inventory: {
    source: "aggregate-inventory",
    expectedItemCount: 3,
    discoveredItemCount: 2,
    status: "incomplete",
    issues: [],
  },
  workItems: [
    { id: "aggregate-item-a", state: "completed" },
    { id: "aggregate-item-b", state: "pending" },
  ],
  batches: [
    {
      id: "aggregate-batch",
      workItemIds: ["aggregate-item-a", "aggregate-item-b"],
      expectedItemCount: 3,
      completedCount: 2,
      failedCount: 0,
      skippedCount: 0,
      retryableCount: 0,
    },
  ],
  coverage: coverageCounts({
    expectedItemCount: 3,
    completedItemCount: 1,
    pendingItemCount: 2,
    artifacts: {
      expectedArtifacts: ["aggregate-report.json"],
      verifiedArtifacts: [],
      missingArtifacts: [],
      extraArtifacts: [],
    },
  }),
  verificationSnapshot: {
    verifierId: "coverage-verifier",
    status: "fail",
    checkedAt: "2026-08-03T10:00:00.000Z",
    coverageStatus: "failed",
    issues: [],
    auditEventIds: ["aggregate-audit-a", "aggregate-audit-b"],
  },
  auditReferences: [
    {
      auditEventIds: ["aggregate-audit-a"],
      createdAt: "2026-08-03T09:55:00.000Z",
      lastEventAt: "2026-08-03T09:59:00.000Z",
    },
  ],
  options: {
    requireAuditConsistency: true,
  },
};
const smokeAggregatedCoverage = verifyAgenticCoverage(smokeAggregatedInput);
const smokeRepeatedAggregatedCoverage =
  verifyAgenticCoverage(smokeAggregatedInput);

assertNoIssueCountDrift(smokeAggregatedCoverage);
assert.equal(
  smokeAggregatedCoverage.status,
  "failed",
  "logic smoke H should follow deterministic failed status priority",
);
assert.deepEqual(
  smokeRepeatedAggregatedCoverage,
  smokeAggregatedCoverage,
  "logic smoke H repeated verification should produce equivalent results",
);
assert.deepEqual(
  smokeAggregatedCoverage.issues.map((issue) => issue.code),
  smokeRepeatedAggregatedCoverage.issues.map((issue) => issue.code),
  "logic smoke H issue ordering should be stable",
);

const smokeCompletedLifecycleCoverage = verifyAgenticCoverage({
  taskId: "smoke-completed-lifecycle-without-proof",
  lifecycle: {
    taskId: "smoke-completed-lifecycle-without-proof",
    state: "completed",
    inventory: completeInventory(4, "lifecycle-inventory"),
    workItems: [],
    batches: [],
    coverage: coverageCounts({
      expectedItemCount: 4,
      completedItemCount: 1,
      pendingItemCount: 3,
    }),
    attempts: [],
    issues: [],
    summary: {
      totalWorkItemCount: 4,
      completedWorkItemCount: 1,
      verifiedWorkItemCount: 1,
      failedWorkItemCount: 0,
      skippedWorkItemCount: 0,
      retryableWorkItemCount: 0,
      pendingWorkItemCount: 3,
      batchCount: 0,
      issueCount: 0,
      artifactCoverageStatus: "incomplete",
      verificationStatus: "skipped",
    },
  },
});

assertNoIssueCountDrift(smokeCompletedLifecycleCoverage);
assert.ok(
  ["failed", "incomplete"].includes(smokeCompletedLifecycleCoverage.status),
  "logic smoke I should reject completed lifecycle state without coverage proof",
);
assert.equal(
  smokeCompletedLifecycleCoverage.ok,
  false,
  "logic smoke I must not accept lifecycle self-report as proof",
);
assert.ok(
  smokeCompletedLifecycleCoverage.issues.length > 0,
  "logic smoke I should expose coverage proof issues",
);
assert.ok(
  smokeCompletedLifecycleCoverage.issues.some(
    (issue) => issue.code === "item_accounting_incomplete",
  ),
  "logic smoke I should explain coverage mismatch",
);

const invalidItemCoverageCases = [
  {
    name: "400 expected, 20 completed, 380 pending",
    input: {
      taskId: "smoke-invalid-items-400-20-380",
      inventory: completeInventory(400, "invalid-item-inventory"),
      coverage: coverageCounts({
        expectedItemCount: 400,
        completedItemCount: 20,
        pendingItemCount: 380,
      }),
    },
  },
  {
    name: "400 expected, 400 completed, 1 retryable",
    input: {
      taskId: "smoke-invalid-items-400-400-retryable",
      inventory: completeInventory(400, "invalid-item-inventory"),
      coverage: coverageCounts({
        expectedItemCount: 400,
        completedItemCount: 400,
        retryableItemCount: 1,
      }),
    },
  },
  {
    name: "400 expected, 399 completed, no explicit terminal remainder",
    input: {
      taskId: "smoke-invalid-items-400-399",
      inventory: completeInventory(400, "invalid-item-inventory"),
      coverage: coverageCounts({
        expectedItemCount: 400,
        completedItemCount: 399,
      }),
    },
  },
  {
    name: "400 expected, 399 completed, 1 skipped, 1 pending",
    input: {
      taskId: "smoke-invalid-items-400-399-skipped-pending",
      inventory: completeInventory(400, "invalid-item-inventory"),
      coverage: coverageCounts({
        expectedItemCount: 400,
        completedItemCount: 399,
        skippedItemCount: 1,
        pendingItemCount: 1,
      }),
    },
  },
];

for (const testCase of invalidItemCoverageCases) {
  assertRejectedVerifierResult(
    verifyAgenticCoverage(testCase.input),
    ["incomplete", "failed", "blocked"],
    `logic smoke J invalid item coverage ${testCase.name}`,
  );
}

const validItemCoverageCases = [
  {
    name: "completed only",
    input: {
      taskId: "smoke-valid-items-completed-only",
      inventory: completeInventory(4, "valid-item-inventory"),
      coverage: coverageCounts({
        expectedItemCount: 4,
        completedItemCount: 4,
      }),
    },
  },
  {
    name: "completed and explicit failed",
    input: {
      taskId: "smoke-valid-items-completed-failed",
      inventory: completeInventory(4, "valid-item-inventory"),
      coverage: coverageCounts({
        expectedItemCount: 4,
        completedItemCount: 3,
        failedItemCount: 1,
      }),
    },
  },
  {
    name: "completed and explicit skipped",
    input: {
      taskId: "smoke-valid-items-completed-skipped",
      inventory: completeInventory(4, "valid-item-inventory"),
      coverage: coverageCounts({
        expectedItemCount: 4,
        completedItemCount: 3,
        skippedItemCount: 1,
      }),
    },
  },
  {
    name: "completed, explicit failed, and explicit skipped",
    input: {
      taskId: "smoke-valid-items-completed-failed-skipped",
      inventory: completeInventory(4, "valid-item-inventory"),
      coverage: coverageCounts({
        expectedItemCount: 4,
        completedItemCount: 2,
        failedItemCount: 1,
        skippedItemCount: 1,
      }),
    },
  },
];

for (const testCase of validItemCoverageCases) {
  assertVerifiedVerifierResult(
    verifyAgenticCoverage(testCase.input),
    `logic smoke K valid item coverage ${testCase.name}`,
  );
}

const smokeLifecycleCoverageSelfReportMismatch = verifyAgenticCoverage({
  taskId: "smoke-lifecycle-self-report-coverage-mismatch",
  lifecycle: {
    taskId: "smoke-lifecycle-self-report-coverage-mismatch",
    state: "completed",
    inventory: completeInventory(400, "lifecycle-self-report-inventory"),
    workItems: Array.from({ length: 20 }, (_, index) => ({
      id: `self-report-item-${String(index + 1).padStart(3, "0")}`,
      state: "completed",
    })),
    batches: [],
    coverage: coverageCounts({
      expectedItemCount: 400,
      completedItemCount: 400,
    }),
    attempts: [],
    issues: [],
    summary: {
      totalWorkItemCount: 400,
      completedWorkItemCount: 400,
      verifiedWorkItemCount: 400,
      failedWorkItemCount: 0,
      skippedWorkItemCount: 0,
      retryableWorkItemCount: 0,
      pendingWorkItemCount: 0,
      batchCount: 0,
      issueCount: 0,
      artifactCoverageStatus: "satisfied",
      verificationStatus: "pass",
    },
  },
});

assertRejectedVerifierResult(
  smokeLifecycleCoverageSelfReportMismatch,
  ["incomplete", "failed", "blocked"],
  "logic smoke L completed lifecycle self-report with partial work item proof",
);
assert.ok(
  smokeLifecycleCoverageSelfReportMismatch.issues.some(
    (issue) => issue.code === "work_item_inventory_count_mismatch",
  ),
  "logic smoke L should report partial work item proof mismatch",
);

const smokeArtifactCoveragePass = verifyAgenticCoverage({
  taskId: "smoke-artifacts-all-verified",
  inventory: completeInventory(1, "artifact-inventory"),
  coverage: coverageCounts({
    expectedItemCount: 1,
    completedItemCount: 1,
    artifacts: {
      expectedArtifacts: ["report.json", "summary.json"],
      verifiedArtifacts: ["summary.json", "report.json"],
      missingArtifacts: [],
      extraArtifacts: [],
    },
  }),
});
assertVerifiedVerifierResult(
  smokeArtifactCoveragePass,
  "logic smoke M all expected artifacts verified",
);

const smokeExtraArtifactCoverage = verifyAgenticCoverage({
  taskId: "smoke-artifact-extra",
  inventory: completeInventory(1, "artifact-inventory"),
  coverage: coverageCounts({
    expectedItemCount: 1,
    completedItemCount: 1,
    artifacts: {
      expectedArtifacts: ["report.json"],
      verifiedArtifacts: ["extra.json", "report.json"],
      missingArtifacts: [],
      extraArtifacts: [],
    },
  }),
});
assertRejectedVerifierResult(
  smokeExtraArtifactCoverage,
  ["incomplete", "failed", "blocked"],
  "logic smoke N extra artifact reporting",
);
assert.ok(
  smokeExtraArtifactCoverage.issues.some(
    (issue) => issue.code === "artifact_extra",
  ),
  "logic smoke N should report an extra artifact issue",
);

const smokeZeroArtifactCoverage = verifyAgenticCoverage({
  taskId: "smoke-zero-artifacts",
  inventory: completeInventory(1, "artifact-inventory"),
  coverage: coverageCounts({
    expectedItemCount: 1,
    completedItemCount: 1,
    artifacts: emptyArtifactCoverage(),
  }),
});
assertVerifiedVerifierResult(
  smokeZeroArtifactCoverage,
  "logic smoke O zero expected artifacts",
);

const smokeBatchCoverageMatch = verifyAgenticCoverage({
  taskId: "smoke-batch-counts-match",
  inventory: completeInventory(3, "batch-inventory"),
  workItems: [
    { id: "batch-match-a", state: "completed" },
    { id: "batch-match-b", state: "failed" },
    { id: "batch-match-c", state: "skipped" },
  ],
  batches: [
    {
      id: "batch-match",
      workItemIds: ["batch-match-c", "batch-match-a", "batch-match-b"],
      expectedItemCount: 3,
      completedCount: 1,
      failedCount: 1,
      skippedCount: 1,
      retryableCount: 0,
    },
  ],
});
assertVerifiedVerifierResult(
  smokeBatchCoverageMatch,
  "logic smoke P batch counts match",
);

const smokeBatchRetryablePreventsVerification = verifyAgenticCoverage({
  taskId: "smoke-batch-retryable-prevents-verified",
  inventory: completeInventory(2, "batch-inventory"),
  workItems: [
    { id: "batch-retry-a", state: "completed" },
    { id: "batch-retry-b", state: "retryable" },
  ],
  batches: [
    {
      id: "batch-retryable",
      workItemIds: ["batch-retry-b", "batch-retry-a"],
      expectedItemCount: 2,
      completedCount: 1,
      failedCount: 0,
      skippedCount: 0,
      retryableCount: 1,
    },
  ],
});
assertRejectedVerifierResult(
  smokeBatchRetryablePreventsVerification,
  ["incomplete", "failed", "blocked"],
  "logic smoke Q retryable batch work",
);
assert.ok(
  smokeBatchRetryablePreventsVerification.batchCoverage.some((check) =>
    check.issues.some((issue) => issue.code === "batch_unfinished_items"),
  ),
  "logic smoke Q should expose unfinished batch item coverage",
);

const smokeBatchOrderingInput = {
  taskId: "smoke-batch-issue-ordering",
  inventory: completeInventory(2, "batch-inventory"),
  workItems: [{ id: "shared-item", state: "completed" }],
  batches: [
    {
      id: "batch-z",
      workItemIds: ["shared-item", "unknown-z"],
      expectedItemCount: 3,
      completedCount: 2,
      failedCount: 0,
      skippedCount: 0,
      retryableCount: 0,
    },
    {
      id: "batch-a",
      workItemIds: ["shared-item", "unknown-a"],
      expectedItemCount: 3,
      completedCount: 2,
      failedCount: 0,
      skippedCount: 0,
      retryableCount: 0,
    },
  ],
};
assert.deepEqual(
  verifyAgenticCoverage(smokeBatchOrderingInput).issues.map((issue) => issue.code),
  verifyAgenticCoverage(smokeBatchOrderingInput).issues.map((issue) => issue.code),
  "logic smoke R batch issue ordering should be deterministic",
);

const smokeInventoryCompleteCoverage = verifyAgenticCoverage({
  taskId: "smoke-inventory-complete",
  inventory: completeInventory(2, "inventory-complete"),
  coverage: coverageCounts({
    expectedItemCount: 2,
    completedItemCount: 2,
  }),
});
assertVerifiedVerifierResult(
  smokeInventoryCompleteCoverage,
  "logic smoke S complete inventory",
);

const smokeUnknownInventoryRequired = verifyAgenticCoverage({
  taskId: "smoke-unknown-inventory-required",
  coverage: coverageCounts({
    expectedItemCount: 1,
    completedItemCount: 1,
  }),
});
assertRejectedVerifierResult(
  smokeUnknownInventoryRequired,
  ["incomplete", "failed", "blocked"],
  "logic smoke T required unknown inventory",
);

const smokeAuditOptionalMissingEvents = verifyAgenticCoverage({
  taskId: "smoke-audit-optional-missing-events",
  inventory: completeInventory(1, "audit-inventory"),
  coverage: coverageCounts({
    expectedItemCount: 1,
    completedItemCount: 1,
  }),
  verificationSnapshot: {
    verifierId: "coverage-verifier",
    status: "pass",
    checkedAt: "2026-08-03T10:00:00.000Z",
    coverageStatus: "satisfied",
    issues: [],
    auditEventIds: ["optional-audit-a"],
  },
});
assertVerifiedVerifierResult(
  smokeAuditOptionalMissingEvents,
  "logic smoke U optional audit expectations",
);

const smokeAuditOrderingInput = {
  taskId: "smoke-audit-issue-ordering",
  inventory: completeInventory(1, "audit-inventory"),
  coverage: coverageCounts({
    expectedItemCount: 1,
    completedItemCount: 1,
  }),
  verificationSnapshot: {
    verifierId: "coverage-verifier",
    status: "fail",
    checkedAt: "2026-08-03T10:00:00.000Z",
    coverageStatus: "failed",
    issues: [],
    auditEventIds: ["audit-c", "audit-a", "audit-b"],
  },
  auditReferences: [
    {
      auditEventIds: ["audit-a"],
      createdAt: "2026-08-03T09:55:00.000Z",
      lastEventAt: "2026-08-03T09:59:00.000Z",
    },
  ],
  options: {
    requireAuditConsistency: true,
  },
};
const smokeAuditOrderingCoverage = verifyAgenticCoverage(smokeAuditOrderingInput);
assert.deepEqual(
  smokeAuditOrderingCoverage.auditConsistency.missingAuditEventIds,
  ["audit-b", "audit-c"],
  "logic smoke V audit missing event ordering should be deterministic",
);

const smokeHardBatchAndIncompleteItems = verifyAgenticCoverage({
  taskId: "smoke-aggregate-hard-batch-incomplete-items",
  inventory: completeInventory(2, "aggregate-inventory"),
  workItems: [
    { id: "aggregate-hard-a", state: "completed" },
    { id: "aggregate-hard-b", state: "pending" },
  ],
  batches: [
    {
      id: "aggregate-hard-batch",
      workItemIds: ["aggregate-hard-a", "aggregate-hard-b"],
      expectedItemCount: 2,
      completedCount: 2,
      failedCount: 0,
      skippedCount: 0,
      retryableCount: 0,
    },
  ],
});
assert.equal(
  smokeHardBatchAndIncompleteItems.status,
  "failed",
  "logic smoke W hard batch mismatch should take deterministic priority over incomplete items",
);

const smokeMissingArtifactsAndAuditIssue = verifyAgenticCoverage({
  taskId: "smoke-aggregate-artifact-audit",
  inventory: completeInventory(1, "aggregate-inventory"),
  coverage: coverageCounts({
    expectedItemCount: 1,
    completedItemCount: 1,
    artifacts: {
      expectedArtifacts: ["aggregate-report.json"],
      verifiedArtifacts: [],
      missingArtifacts: [],
      extraArtifacts: [],
    },
  }),
  verificationSnapshot: {
    verifierId: "coverage-verifier",
    status: "fail",
    checkedAt: "2026-08-03T10:00:00.000Z",
    coverageStatus: "failed",
    issues: [],
    auditEventIds: ["audit-required"],
  },
  options: {
    requireAuditConsistency: true,
  },
});
assert.equal(
  smokeMissingArtifactsAndAuditIssue.status,
  "failed",
  "logic smoke X audit failure should take deterministic priority over missing artifacts",
);

const smokeInventoryIncompleteItemComplete = verifyAgenticCoverage({
  taskId: "smoke-aggregate-inventory-incomplete-item-complete",
  inventory: {
    source: "aggregate-inventory",
    expectedItemCount: 2,
    discoveredItemCount: 1,
    status: "incomplete",
    issues: [],
  },
  coverage: coverageCounts({
    expectedItemCount: 2,
    completedItemCount: 2,
  }),
});
assert.equal(
  smokeInventoryIncompleteItemComplete.status,
  "incomplete",
  "logic smoke Y incomplete inventory should prevent verified even when item accounting is complete",
);

for (const result of [
  smokeCompletedLifecycleCoverage,
  smokeLifecycleCoverageSelfReportMismatch,
  smokeArtifactCoveragePass,
  smokeExtraArtifactCoverage,
  smokeZeroArtifactCoverage,
  smokeBatchCoverageMatch,
  smokeBatchRetryablePreventsVerification,
  smokeInventoryCompleteCoverage,
  smokeUnknownInventoryRequired,
  smokeAuditOptionalMissingEvents,
  smokeMissingArtifactsAndAuditIssue,
  smokeInventoryIncompleteItemComplete,
]) {
  assertVerifierSummaryHonest(result);
}

assertVerifierResultShape(smokeAggregatedCoverage);

assert.equal(
  incompleteSitemapCoverageResult.taskId,
  "sitemap-audit",
  "incomplete sitemap coverage result should preserve the sitemap task id",
);
assert.equal(
  incompleteSitemapCoverageResult.itemCoverage.expectedItems,
  400,
  "incomplete sitemap verifier coverage should represent 400 expected items",
);
assert.equal(
  incompleteSitemapCoverageResult.itemCoverage.completedItems,
  20,
  "incomplete sitemap verifier coverage should represent only 20 completed items",
);
assert.equal(
  incompleteSitemapCoverageResult.itemCoverage.pendingItems,
  380,
  "incomplete sitemap verifier coverage should represent 380 pending items",
);
assert.equal(
  incompleteSitemapCoverageResult.summary.pendingItems,
  380,
  "incomplete sitemap verifier summary should represent 380 remaining items",
);
assert.equal(
  incompleteSitemapCoverageResult.status,
  "incomplete",
  "incomplete sitemap verifier coverage should report incomplete status",
);
assert.equal(
  incompleteSitemapCoverageResult.ok,
  false,
  "incomplete sitemap verifier result must not report ok",
);
assert.ok(
  incompleteSitemapCoverageResult.issues.length > 0,
  "incomplete sitemap verifier result should include issues",
);
assert.notEqual(
  incompleteSitemapCoverageResult.itemCoverage.completedItems,
  incompleteSitemapCoverageResult.itemCoverage.expectedItems,
  "20 of 400 completed items must not satisfy verifier item coverage",
);
assert.equal(
  incompleteSitemapCoverageResult.itemCoverage.coverageComplete,
  false,
  "20 of 400 completed items must not be marked coverage complete",
);

const completeVerifierAccountedItems =
  completeItemCoverageResult.itemCoverage.completedItems +
  completeItemCoverageResult.itemCoverage.failedItems +
  completeItemCoverageResult.itemCoverage.skippedItems;

assert.equal(
  completeItemCoverageResult.itemCoverage.expectedItems,
  completeVerifierAccountedItems,
  "complete verifier item coverage should account for completed, failed, and skipped items",
);
assert.equal(
  completeItemCoverageResult.status,
  "verified",
  "complete verifier item coverage should report verified status",
);
assert.equal(
  completeItemCoverageResult.ok,
  true,
  "complete verifier item coverage should report ok",
);
assert.equal(
  completeItemCoverageResult.itemCoverage.pendingItems,
  0,
  "complete verifier item coverage should not have pending items",
);
assert.equal(
  completeItemCoverageResult.itemCoverage.retryableItems,
  0,
  "complete verifier item coverage should not have retryable items",
);
assert.equal(
  completeItemCoverageResult.summary.expectedItems,
  completeVerifierAccountedItems,
  "complete verifier summary should account for completed, failed, and skipped items",
);
assert.equal(
  completeItemCoverageResult.summary.pendingItems,
  0,
  "complete verifier summary should not have pending items",
);
assert.equal(
  completeItemCoverageResult.summary.retryableItems,
  0,
  "complete verifier summary should not have retryable items",
);

assert.equal(
  artifactCoverageIncompleteResult.summary.expectedArtifacts,
  5,
  "incomplete artifact verifier summary should represent expected artifact count",
);
assert.equal(
  artifactCoverageIncompleteResult.summary.verifiedArtifacts,
  4,
  "incomplete artifact verifier summary should represent verified artifact count",
);
assert.equal(
  artifactCoverageIncompleteResult.summary.missingArtifacts,
  1,
  "incomplete artifact verifier summary should represent missing artifact count",
);
assert.equal(
  artifactCoverageIncompleteResult.artifactCoverage.expectedArtifacts.length,
  5,
  "incomplete artifact verifier coverage should represent expected artifacts",
);
assert.equal(
  artifactCoverageIncompleteResult.artifactCoverage.verifiedArtifacts.length,
  4,
  "incomplete artifact verifier coverage should represent verified artifacts",
);
assert.equal(
  artifactCoverageIncompleteResult.artifactCoverage.missingArtifacts.length,
  1,
  "incomplete artifact verifier coverage should represent missing artifacts",
);
assert.equal(
  artifactCoverageIncompleteResult.status,
  "incomplete",
  "missing artifact verifier coverage should report incomplete status",
);
assert.equal(
  artifactCoverageIncompleteResult.ok,
  false,
  "missing artifact verifier coverage must not report ok",
);
assert.equal(
  artifactCoverageIncompleteResult.artifactCoverage.coverageComplete,
  false,
  "missing artifacts must not be marked artifact coverage complete",
);
assert.notEqual(
  artifactCoverageIncompleteResult.summary.expectedArtifacts,
  artifactCoverageIncompleteResult.summary.verifiedArtifacts,
  "missing artifacts must prevent pretending full artifact completion",
);

const [batchMismatchCoverage] =
  batchInventoryAndAuditCoverageResult.batchCoverage;

assert.ok(
  batchInventoryAndAuditCoverageResult.batchCoverage.length > 0,
  "batch mismatch verifier result should represent batch coverage",
);
assert.ok(
  batchMismatchCoverage.issues.length > 0,
  "batch mismatch verifier check should include issues",
);
assert.ok(
  ["failed", "incomplete"].includes(batchMismatchCoverage.status),
  "batch mismatch verifier check should report failed or incomplete status",
);
assert.ok(
  ["failed", "incomplete"].includes(
    batchInventoryAndAuditCoverageResult.status,
  ),
  "batch mismatch verifier result should report failed or incomplete status",
);

assert.notEqual(
  batchInventoryAndAuditCoverageResult.inventoryCoverage.expectedItemCount,
  batchInventoryAndAuditCoverageResult.inventoryCoverage.discoveredItemCount,
  "inventory incomplete verifier coverage should expose differing expected and discovered counts",
);
assert.equal(
  batchInventoryAndAuditCoverageResult.inventoryCoverage.inventoryComplete,
  false,
  "inventory incomplete verifier coverage should mark inventory incomplete",
);
assert.ok(
  batchInventoryAndAuditCoverageResult.inventoryCoverage.issues.length > 0,
  "inventory incomplete verifier coverage should include issues",
);
assert.notEqual(
  batchInventoryAndAuditCoverageResult.status,
  "verified",
  "inventory incomplete verifier result must not report verified status",
);
assert.equal(
  batchInventoryAndAuditCoverageResult.ok,
  false,
  "inventory incomplete verifier result must not report ok",
);

assert.deepEqual(
  batchInventoryAndAuditCoverageResult.auditConsistency.missingAuditEventIds,
  ["audit-event-002", "audit-event-004"],
  "audit consistency verifier coverage should represent missing audit event ids",
);
assert.notEqual(
  batchInventoryAndAuditCoverageResult.auditConsistency.consistencyStatus,
  "verified",
  "audit consistency verifier coverage should not be verified",
);
assert.ok(
  batchInventoryAndAuditCoverageResult.auditConsistency.issues.length > 0,
  "audit consistency verifier coverage should include issues",
);

const plannedResult = lifecycleResultFromExample(plannedSitemapLifecycle);

assert.equal(
  plannedSitemapLifecycle.inventory.expectedItemCount,
  400,
  "planned sitemap inventory should represent 400 expected items",
);
assert.equal(
  plannedSitemapLifecycle.inventory.discoveredItemCount,
  400,
  "planned sitemap inventory should represent 400 discovered items",
);
assert.equal(
  plannedSitemapLifecycle.state,
  "planned",
  "planned sitemap lifecycle should remain planned",
);
assert.equal(
  plannedResult.state,
  "planned",
  "planned sitemap result should preserve planned state",
);
assert.ok(
  plannedSitemapLifecycle.batches.length > 0,
  "planned sitemap batches should be represented",
);
assert.ok(
  plannedSitemapLifecycle.workItems.some((workItem) => workItem.id === "url-001"),
  "planned sitemap work item representation should exist",
);
assertLifecycleSummaryMatchesShape(plannedSitemapLifecycle, {
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
});

assert.equal(
  incompleteSitemapLifecycle.coverage.expectedItemCount,
  400,
  "incomplete sitemap coverage should represent 400 expected items",
);
assert.equal(
  incompleteSitemapLifecycle.coverage.completedItemCount,
  20,
  "incomplete sitemap coverage should represent only 20 completed items",
);
assert.equal(
  incompleteSitemapLifecycle.coverage.pendingItemCount,
  380,
  "incomplete sitemap coverage should represent remaining pending items",
);
assert.notEqual(
  incompleteSitemapLifecycle.state,
  "completed",
  "incomplete sitemap lifecycle must not be completed",
);
assert.notEqual(
  incompleteSitemapResult.ok,
  true,
  "incomplete sitemap result must not report ok",
);
assert.equal(
  incompleteSitemapLifecycle.coverage.status,
  "incomplete",
  "incomplete sitemap coverage should report incomplete status",
);
assert.ok(
  incompleteSitemapLifecycle.coverage.rules.some(
    (rule) => rule.status === "incomplete",
  ),
  "incomplete sitemap coverage should include an incomplete rule",
);
assert.ok(
  incompleteSitemapLifecycle.coverage.issues.some(
    (issue) => issue.category === "coverage_failure",
  ),
  "incomplete sitemap coverage should include a coverage failure issue",
);
assert.notEqual(
  incompleteSitemapLifecycle.coverage.completedItemCount,
  incompleteSitemapLifecycle.coverage.expectedItemCount,
  "20 of 400 completed items must not satisfy item coverage",
);
assertIssueCountMatches(incompleteSitemapResult);

const verifiedCompleteResult =
  lifecycleResultFromExample(verifiedCompleteLifecycle);
const verifiedAccountedItems =
  verifiedCompleteLifecycle.coverage.completedItemCount +
  verifiedCompleteLifecycle.coverage.explicitlyFailedItemCount +
  verifiedCompleteLifecycle.coverage.explicitlySkippedItemCount;

assert.equal(
  verifiedCompleteLifecycle.coverage.expectedItemCount,
  verifiedAccountedItems,
  "verified complete lifecycle should account for completed, failed, and skipped items",
);
assert.equal(
  verifiedCompleteLifecycle.verification?.status,
  "pass",
  "verified complete lifecycle should have passing verification",
);
assert.equal(
  verifiedCompleteLifecycle.verification?.coverageStatus,
  "satisfied",
  "verified complete lifecycle verification should satisfy coverage",
);
assert.equal(
  verifiedCompleteResult.ok,
  true,
  "verified complete result should report ok",
);
assert.equal(
  verifiedCompleteResult.state,
  verifiedCompleteLifecycle.state,
  "verified complete result should preserve lifecycle state",
);
assert.equal(
  verifiedCompleteResult.summary.verificationStatus,
  verifiedCompleteLifecycle.verification?.status,
  "verified complete result summary should match verification status",
);
assert.equal(
  verifiedCompleteResult.summary.artifactCoverageStatus,
  verifiedCompleteResult.coverage.status,
  "verified complete result summary should match coverage status",
);
assertIssueCountMatches(verifiedCompleteResult);

assert.deepEqual(
  fileGenerationLifecycle.coverage.artifacts.expectedArtifacts,
  ["README.generated.md", "dist/report.json", "dist/summary.json"],
  "file-generation lifecycle should represent expected artifacts",
);
assert.deepEqual(
  fileGenerationLifecycle.coverage.artifacts.verifiedArtifacts,
  ["README.generated.md", "dist/summary.json"],
  "file-generation lifecycle should represent verified artifacts",
);
assert.deepEqual(
  fileGenerationLifecycle.coverage.artifacts.missingArtifacts,
  ["dist/report.json"],
  "file-generation lifecycle should represent missing artifacts",
);
assert.equal(
  fileGenerationLifecycle.coverage.status,
  "failed",
  "missing artifacts should prevent satisfied artifact coverage",
);
assert.notEqual(
  fileGenerationLifecycle.summary.artifactCoverageStatus,
  "satisfied",
  "missing artifacts should prevent summary from pretending full artifact completion",
);

assert.equal(
  resumeCursorExample.nextPendingBatchId,
  "batch-002",
  "resume cursor should represent next pending batch id",
);
assert.deepEqual(
  resumeCursorExample.remainingWorkItemIds,
  ["url-021", "url-022", "url-023"],
  "resume cursor should represent remaining work item ids",
);
assert.deepEqual(
  resumeCursorExample.retryableWorkItemIds,
  ["url-018"],
  "resume cursor should represent retryable work item ids",
);
assert.equal(
  resumeCursorExample.updatedAt,
  "2026-08-03T10:05:00.000Z",
  "resume cursor should expose updatedAt",
);

assertLifecycleSummaryMatchesShape(incompleteSitemapLifecycle, {
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
});
assertLifecycleSummaryMatchesShape(verifiedCompleteLifecycle, {
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
});
assertLifecycleSummaryMatchesShape(fileGenerationLifecycle, {
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
});

const runnerResults = [
  plannedRunnerResult,
  waitingForApprovalResult,
  incompleteSitemapRunnerResult,
  verifiedCompleteRunnerResult,
];

for (const runnerResult of runnerResults) {
  assertRunnerResultShape(runnerResult);
  assertRunnerSummaryConsistent(runnerResult);
  assertVerifierGateHonest(runnerResult);
}

assert.equal(
  plannedRunnerResult.mode,
  "plan",
  "runner smoke A should represent planning mode",
);
assert.equal(
  plannedRunnerResult.state,
  "planned",
  "runner smoke A should represent planned state",
);
assert.equal(
  plannedRunnerResult.verifier.verifierRequired,
  true,
  "runner smoke A should require verifier handoff",
);
assert.equal(
  plannedRunnerResult.plan.verifierRequired,
  true,
  "runner smoke A plan should require verifier",
);
assert.equal(
  plannedRunnerResult.policy.status,
  "evaluated",
  "runner smoke A should represent policy preflight",
);
assert.equal(
  plannedRunnerResult.policy.result,
  "allowed",
  "runner smoke A should represent allowed policy gate",
);
assert.ok(
  plannedRunnerResult.plan.requiredPolicyChecks.length > 0,
  "runner smoke A should represent required policy checks",
);
assert.ok(
  plannedRunnerResult.plan.steps.length > 0,
  "runner smoke A should represent planned steps",
);
assert.equal(
  plannedRunnerResult.summary.completedSteps,
  0,
  "runner smoke A should not imply execution completion",
);
assert.equal(
  plannedRunnerResult.summary.completedWorkItems,
  0,
  "runner smoke A should not imply completed work",
);
assert.notEqual(
  plannedRunnerResult.ok,
  true,
  "runner smoke A should not report ok before execution and verification",
);

assert.equal(
  waitingForApprovalResult.state,
  "waiting_for_approval",
  "runner smoke B should represent approval wait state",
);
assert.equal(
  waitingForApprovalResult.executionBoundary.humanApprovalRequired,
  true,
  "runner smoke B should require human approval in execution boundary",
);
assert.equal(
  waitingForApprovalResult.policy.status,
  "waiting_for_approval",
  "runner smoke B policy gate should wait for approval",
);
assert.equal(
  waitingForApprovalResult.policy.result,
  "needs_approval",
  "runner smoke B policy gate should need approval",
);
assert.ok(
  waitingForApprovalResult.plan.requiredApprovals.length > 0,
  "runner smoke B should represent required approvals",
);
assert.notEqual(
  waitingForApprovalResult.ok,
  true,
  "runner smoke B should not report completed result",
);
assert.notEqual(
  waitingForApprovalResult.state,
  "completed",
  "runner smoke B should not be completed",
);

assert.equal(
  incompleteSitemapRunnerResult.taskId,
  "sitemap-audit",
  "runner smoke C should preserve sitemap audit task id",
);
assert.equal(
  incompleteSitemapRunnerResult.summary.expectedWorkItems,
  400,
  "runner smoke C should represent 400 expected work items",
);
assert.equal(
  incompleteSitemapRunnerResult.summary.completedWorkItems,
  20,
  "runner smoke C should represent only 20 completed work items",
);
assert.equal(
  incompleteSitemapRunnerResult.summary.pendingWorkItems,
  380,
  "runner smoke C should represent 380 pending work items",
);
assert.equal(
  incompleteSitemapRunnerResult.verifier.coverageStatus,
  "incomplete",
  "runner smoke C verifier handoff should be incomplete",
);
assert.equal(
  incompleteSitemapRunnerResult.state,
  "incomplete",
  "runner smoke C should represent incomplete runner state",
);
assert.equal(
  incompleteSitemapRunnerResult.ok,
  false,
  "runner smoke C should not report ok",
);
assert.notEqual(
  incompleteSitemapRunnerResult.state,
  "completed",
  "runner smoke C should not be completed",
);
assert.notEqual(
  incompleteSitemapRunnerResult.verifier.verifierStatus,
  "verified",
  "runner smoke C should not let adapter references imply verified completion",
);
assert.ok(
  incompleteSitemapRunnerResult.executionBoundary.modelAdapter,
  "runner smoke C may reference a model adapter",
);
assert.notEqual(
  incompleteSitemapRunnerResult.executionBoundary.modelAdapter.status,
  "completed",
  "runner smoke C model adapter reference must not make the result completed",
);

assert.equal(
  verifiedCompleteRunnerResult.verifier.verifierStatus,
  "verified",
  "runner smoke D verifier handoff should be verified",
);
assert.ok(
  ["verified", "completed"].includes(verifiedCompleteRunnerResult.state),
  "runner smoke D should be verified or completed by current contract",
);
assert.equal(
  verifiedCompleteRunnerResult.ok,
  true,
  "runner smoke D should report ok after verified handoff",
);
assert.equal(
  verifiedCompleteRunnerResult.summary.pendingWorkItems,
  0,
  "runner smoke D should have no pending work items",
);
assert.equal(
  verifiedCompleteRunnerResult.summary.retryableWorkItems,
  0,
  "runner smoke D should have no retryable work items",
);
assert.equal(
  verifiedCompleteRunnerResult.summary.completedWorkItems,
  verifiedCompleteRunnerResult.summary.expectedWorkItems,
  "runner smoke D summary should account for expected work items",
);

assert.ok(
  resumeRunnerState.nextStepId,
  "runner smoke E should represent next step id",
);
assert.ok(
  resumeRunnerState.nextBatchId,
  "runner smoke E should represent next batch id",
);
assert.ok(
  resumeRunnerState.pendingWorkItemIds.length > 0,
  "runner smoke E should represent pending work item ids",
);
assert.ok(
  resumeRunnerState.retryableWorkItemIds.length > 0,
  "runner smoke E should represent retryable work item ids",
);
assert.ok(
  resumeRunnerState.updatedAt,
  "runner smoke E should expose updatedAt",
);
assert.deepEqual(
  incompleteSitemapRunnerResult.resume?.pendingWorkItemIds,
  ["url:021", "url:022"],
  "runner smoke E incomplete sitemap result should include resume pending work ids",
);
assert.ok(
  incompleteSitemapRunnerResult.resume?.nextStepId,
  "runner smoke E incomplete sitemap result should include resume next step id",
);

assert.ok(
  auditHandoffGap.plannedAuditEventIds.length > 0,
  "runner smoke F should represent planned audit event ids",
);
assert.ok(
  auditHandoffGap.emittedAuditEventIds.length > 0,
  "runner smoke F should represent emitted audit event ids",
);
assert.deepEqual(
  auditHandoffGap.missingAuditEventIds,
  ["audit:gap:missing"],
  "runner smoke F should represent missing audit event ids",
);
assert.ok(
  !["complete", "verified"].includes(auditHandoffGap.auditStatus),
  "runner smoke F audit handoff gap should not be complete or verified",
);
assert.equal(
  auditHandoffGapIssue.code,
  "RUNNER_AUDIT_HANDOFF_GAP",
  "runner smoke F should expose an audit handoff issue",
);
assert.equal(
  auditHandoffGapIssue.category,
  "audit_failure",
  "runner smoke F issue should be categorized as audit failure",
);

assert.equal(
  verifiedCompleteRunnerResult.verifier.coverageStatus,
  "satisfied",
  "runner smoke H verified example should expose satisfied coverage",
);
assert.equal(
  incompleteSitemapRunnerResult.verifier.coverageStatus,
  "incomplete",
  "runner smoke H incomplete example should expose incomplete coverage",
);
assert.equal(
  verifiedCompleteRunnerResult.ok,
  verifiedCompleteRunnerResult.verifier.verifierStatus === "verified",
  "runner smoke H ok true should be gated by verified verifier handoff",
);
assert.equal(
  incompleteSitemapRunnerResult.ok,
  false,
  "runner smoke H incomplete example should remain not ok",
);
assert.notEqual(
  incompleteSitemapRunnerResult.verifier.verifierStatus,
  "verified",
  "runner smoke H incomplete example should not have verified handoff",
);

const planningResults = [
  sitemapAuditPlanningResult,
  waitingForApprovalPlanningResult,
  blockedPolicyPlanningResult,
  resumePlanningResult,
  verifierGatedCompletionPlanningResult,
  auditExpectationGapPlanningResult,
];

for (const planningResult of planningResults) {
  assertPlanningResultShape(planningResult);
  assertPlanningSummaryConsistent(planningResult);
  assertPlanningVerifierGateHonest(planningResult);
}

assert.equal(
  sitemapAuditPlanningResult.taskId,
  "sitemap-audit",
  "planning smoke A should preserve sitemap audit task id",
);
assert.equal(
  sitemapAuditPlanningInput.metadata?.expectedWorkItems,
  400,
  "planning smoke A input metadata should represent 400 expected work items",
);
assert.equal(
  sitemapAuditPlanningResult.summary.workItemCount,
  400,
  "planning smoke A summary should represent 400 expected work items",
);
assert.ok(
  sitemapAuditPlanningResult.workItems.length > 0,
  "planning smoke A should include represented work item plans",
);
assert.ok(
  sitemapAuditPlanningResult.batches.length > 0,
  "planning smoke A should represent batches",
);
assert.ok(
  sitemapAuditPlanningResult.steps.some(
    (step) => step.kind === "policy_preflight",
  ),
  "planning smoke A should represent a policy preflight step",
);
assert.equal(
  sitemapAuditPlanningResult.verifier.verifierRequired,
  true,
  "planning smoke A should represent verifier requirement",
);
assert.ok(
  sitemapAuditPlanningResult.steps.some(
    (step) => step.kind === "verification" && step.verifierRequired,
  ),
  "planning smoke A should include a verifier handoff step",
);
assert.ok(
  sitemapAuditPlanningResult.audit.expectedAuditEventIds.length > 0,
  "planning smoke A should represent audit expectations",
);
assert.equal(
  sitemapAuditPlanningInput.metadata?.executionPerformed,
  false,
  "planning smoke A input should not imply execution was performed",
);
assert.notEqual(
  sitemapAuditPlanningResult.steps.some((step) => step.state === "completed"),
  true,
  "planning smoke A result should not imply execution was performed",
);

assert.ok(
  waitingForApprovalPlanningResult.prerequisites.some(
    (prerequisite) =>
      prerequisite.kind === "approval" &&
      prerequisite.required &&
      prerequisite.status === "blocked",
  ),
  "planning smoke B should represent approval prerequisite",
);
assert.ok(
  waitingForApprovalPlanningResult.policy.some(
    (policy) =>
      policy.status === "requires_approval" && policy.approvalRequired,
  ),
  "planning smoke B should represent approval-required policy plan",
);
assert.equal(
  waitingForApprovalPlanningResult.adapterBoundary.approvalRequired,
  true,
  "planning smoke B adapter boundary should require approval",
);
assert.equal(
  waitingForApprovalPlanningResult.adapterBoundary.metadata
    ?.humanApprovalRequired,
  true,
  "planning smoke B adapter boundary should represent human approval requirement",
);
assert.equal(
  waitingForApprovalPlanningResult.ok,
  false,
  "planning smoke B should not imply execution can proceed without approval",
);
assert.ok(
  waitingForApprovalPlanningResult.adapterBoundary.deniedOperations.includes(
    "batch.execute",
  ),
  "planning smoke B should deny batch execution while waiting for approval",
);
assert.ok(
  waitingForApprovalPlanningResult.prerequisites.some(
    (prerequisite) => prerequisite.status === "blocked",
  ),
  "planning smoke B should represent blocked or waiting state",
);

assert.ok(
  blockedPolicyPlanningResult.prerequisites.some(
    (prerequisite) =>
      prerequisite.kind === "policy" &&
      ["blocked", "failed"].includes(prerequisite.status),
  ),
  "planning smoke C should represent failed or blocked policy prerequisite",
);
assert.ok(
  blockedPolicyPlanningResult.policy.some(
    (policy) => policy.status === "denied",
  ),
  "planning smoke C should represent denied policy plan",
);
assert.ok(
  blockedPolicyPlanningResult.adapterBoundary.deniedOperations.includes(
    "filesystem.write",
  ),
  "planning smoke C should represent denied operation",
);
assert.ok(
  blockedPolicyPlanningResult.issues.length > 0,
  "planning smoke C should include issues",
);
assert.equal(
  blockedPolicyPlanningResult.ok,
  false,
  "planning smoke C should not imply executable batch execution",
);
assert.ok(
  blockedPolicyPlanningResult.steps.every(
    (step) => step.kind !== "batch_execution" || step.state === "blocked",
  ),
  "planning smoke C should not represent executable batch execution",
);

assert.ok(
  resumePlanningResult.resume?.resumeCursorReference,
  "planning smoke D should represent resume cursor reference",
);
assert.equal(
  resumePlanningResult.resume?.nextStepId,
  "step-batch-003",
  "planning smoke D should represent next step id",
);
assert.equal(
  resumePlanningResult.resume?.nextBatchId,
  "batch-003",
  "planning smoke D should represent next batch id",
);
assert.deepEqual(
  resumePlanningResult.resume?.pendingWorkItemIds,
  ["sitemap-url-201", "sitemap-url-202"],
  "planning smoke D should represent pending work item ids",
);
assert.deepEqual(
  resumePlanningResult.resume?.retryableWorkItemIds,
  ["sitemap-url-118"],
  "planning smoke D should represent retryable work item ids",
);
assert.ok(
  resumePlanningResult.resume?.updatedAt,
  "planning smoke D should expose updatedAt",
);

assert.equal(
  verifierGatedCompletionPlanningResult.verifier.verifierRequired,
  true,
  "planning smoke E should require verifier",
);
assert.equal(
  verifierGatedCompletionPlanningResult.verifier.completionGatedByVerifier,
  true,
  "planning smoke E should gate completion by verifier",
);
assert.equal(
  verifierGatedCompletionPlanningResult.verifier.expectedCoverageRule,
  "expected_items == completed_items + explicitly_failed_items + explicitly_skipped_items",
  "planning smoke E should represent expected coverage rule",
);
assert.ok(
  verifierGatedCompletionPlanningResult.adapterBoundary.deniedOperations.includes(
    "runner.complete",
  ),
  "planning smoke E should deny completed state without verifier handoff",
);
assert.notEqual(
  verifierGatedCompletionPlanningResult.steps.some(
    (step) => step.state === "completed",
  ),
  true,
  "planning smoke E should not represent completed state before verifier handoff",
);
assert.equal(
  verifierGatedCompletionPlanningResult.verifier.metadata
    ?.verifierHandoffRequired,
  true,
  "planning smoke E should make verifier handoff requirement explicit",
);

assert.deepEqual(
  auditExpectationGapPlanningResult.audit.expectedAuditEventIds,
  [
    "audit-policy-preflight-planned",
    "audit-batch-001-planned",
    "audit-batch-002-planned",
  ],
  "planning smoke F should represent expected audit event ids",
);
assert.deepEqual(
  auditExpectationGapPlanningResult.audit.requiredEventKinds,
  ["policy.preflight.planned", "batch.execution.planned"],
  "planning smoke F should represent required event kinds",
);
assert.deepEqual(
  auditExpectationGapPlanningResult.audit.missingAuditEventIds,
  ["audit-batch-002-planned"],
  "planning smoke F should represent missing event ids",
);
assert.ok(
  auditExpectationGapPlanningResult.issues.some(
    (issue) => issue.code === "AUDIT_EXPECTATION_GAP",
  ),
  "planning smoke F should include audit expectation gap issue",
);

const directSitemapWorkItems = Array.from({ length: 400 }, (_, index) => {
  const itemNumber = index + 1;
  const batchNumber = Math.floor(index / 100) + 1;
  const id = `sitemap-url-${String(itemNumber).padStart(3, "0")}`;

  return createPlanningWorkItem(
    id,
    `batch-${String(batchNumber).padStart(3, "0")}`,
  );
});
const directSitemapBatches = Array.from({ length: 4 }, (_, index) => {
  const firstIndex = index * 100;
  const ids = directSitemapWorkItems
    .slice(firstIndex, firstIndex + 100)
    .map((workItem) => workItem.id);

  return createPlanningBatch(`batch-${String(index + 1).padStart(3, "0")}`, ids);
});
const directSitemapPlanningInput = {
  taskId: "sitemap-audit",
  taskContract: createPlanningTaskContract("sitemap-audit"),
  workItems: directSitemapWorkItems,
  batches: directSitemapBatches,
  mode: "plan",
  options: {
    requireAudit: true,
    requireVerifier: true,
    maxWorkItems: 400,
    maxBatchSize: 100,
  },
  policyRequirements: [
    {
      policyGateId: "policy-sitemap-audit",
      status: "allowed",
      approvalRequired: false,
      reasons: ["Read-only sitemap planning is allowed."],
      issues: [],
      metadata: {
        allowedOperations: ["batch.execute"],
        deniedOperations: ["filesystem.write"],
      },
    },
  ],
  verifierRequirements: createVerifierRequirement("coverage-verifier-sitemap"),
  metadata: {
    executionPerformed: false,
  },
};
const directSitemapPlanningResult = planAgenticRunner(directSitemapPlanningInput);

assertDirectPlanningResultShape(directSitemapPlanningResult);
assertDirectPlanningSummaryHonest(directSitemapPlanningResult);
assertPlanningVerifierGateHonest(directSitemapPlanningResult);
assert.equal(
  directSitemapPlanningResult.taskId,
  "sitemap-audit",
  "planning logic smoke A should preserve sitemap task id",
);
assert.equal(
  directSitemapPlanningResult.workItems.length,
  400,
  "planning logic smoke A should represent 400 work items",
);
assert.deepEqual(
  directSitemapPlanningResult.batches.map((batch) => batch.id),
  ["batch-001", "batch-002", "batch-003", "batch-004"],
  "planning logic smoke A should produce deterministic batch order",
);
assert.deepEqual(
  directSitemapPlanningResult.batches.map((batch) => batch.expectedItemCount),
  [100, 100, 100, 100],
  "planning logic smoke A should preserve deterministic batch sizes",
);
assert.deepEqual(
  directSitemapPlanningResult.batches[0]?.deterministicOrder.slice(0, 3),
  ["sitemap-url-001", "sitemap-url-002", "sitemap-url-003"],
  "planning logic smoke A should preserve deterministic work item ordering",
);
assert.ok(
  directSitemapPlanningResult.steps.some(
    (step) => step.kind === "policy_preflight",
  ),
  "planning logic smoke A should include policy preflight",
);
assert.equal(
  directSitemapPlanningResult.steps.filter(
    (step) => step.kind === "batch_execution",
  ).length,
  4,
  "planning logic smoke A should include one execution step per batch",
);
assert.ok(
  directSitemapPlanningResult.steps.some(
    (step) => step.kind === "verification" && step.verifierRequired,
  ),
  "planning logic smoke A should include verifier handoff step",
);
assert.equal(
  directSitemapPlanningResult.verifier.verifierRequired,
  true,
  "planning logic smoke A should require verifier",
);
assert.equal(
  directSitemapPlanningResult.verifier.completionGatedByVerifier,
  true,
  "planning logic smoke A should gate completion by verifier",
);
assertPlanningStepsNotCompleted(
  directSitemapPlanningResult,
  "planning logic smoke A should not imply execution completion",
);

const directApprovalPlanningResult = planAgenticRunner({
  taskId: "approval-gated-plan",
  taskContract: createPlanningTaskContract("approval-gated-plan"),
  workItems: [
    createPlanningWorkItem("approval-work-item-001", "approval-batch-001"),
  ],
  batches: [
    createPlanningBatch("approval-batch-001", ["approval-work-item-001"]),
  ],
  mode: "plan",
  options: {
    requireAudit: true,
    requireApproval: true,
  },
  policyRequirements: [
    {
      policyGateId: "policy-approval-required",
      status: "requires_approval",
      approvalRequired: true,
      approvalState: "required",
      reasons: ["Human approval is required before execution."],
      issues: [],
      metadata: {
        allowedOperations: ["approval.request"],
        deniedOperations: ["batch.execute"],
      },
    },
  ],
  adapterReferences: [
    {
      adapterId: "tool-approval-gate",
      kind: "tool",
      status: "blocked",
      metadata: {
        allowedOperations: ["approval.request"],
        deniedOperations: ["batch.execute"],
      },
    },
  ],
});

assertDirectPlanningResultShape(directApprovalPlanningResult);
assertDirectPlanningSummaryHonest(directApprovalPlanningResult);
assertPlanningVerifierGateHonest(directApprovalPlanningResult);
assert.equal(
  directApprovalPlanningResult.adapterBoundary.approvalRequired,
  true,
  "planning logic smoke B should preserve adapter approval requirement",
);
assert.ok(
  directApprovalPlanningResult.policy.some(
    (policy) =>
      policy.status === "requires_approval" && policy.approvalRequired,
  ),
  "planning logic smoke B should preserve policy approval requirement",
);
assert.ok(
  directApprovalPlanningResult.steps.some((step) => step.kind === "approval"),
  "planning logic smoke B should include approval step",
);
assert.equal(
  directApprovalPlanningResult.steps.some(
    (step) => step.kind === "batch_execution",
  ),
  false,
  "planning logic smoke B should not proceed to batch execution without approval",
);
assert.equal(
  directApprovalPlanningResult.ok,
  false,
  "planning logic smoke B should not be ok while approval is required",
);
assert.equal(
  directApprovalPlanningResult.summary.approvalRequired,
  true,
  "planning logic smoke B summary should reflect approval requirement",
);
assert.ok(
  directApprovalPlanningResult.prerequisites.some(
    (prerequisite) =>
      prerequisite.kind === "approval" && prerequisite.status === "blocked",
  ),
  "planning logic smoke B should represent blocked approval prerequisite",
);

const directBlockedPolicyIssue = {
  code: "POLICY_DENIED_OPERATION",
  message: "filesystem.write is denied for this planner smoke.",
  severity: "error",
  category: "policy_failure",
  policyGateId: "policy-denied-filesystem-write",
  retryable: false,
  createdAt: "2026-08-04T09:00:00.000Z",
};
const directBlockedPolicyResult = planAgenticRunner({
  taskId: "blocked-policy-plan",
  taskContract: createPlanningTaskContract("blocked-policy-plan"),
  workItems: [createPlanningWorkItem("blocked-work-item-001", "blocked-batch-001")],
  batches: [createPlanningBatch("blocked-batch-001", ["blocked-work-item-001"])],
  mode: "plan",
  options: {
    requireAudit: true,
  },
  policyRequirements: [
    {
      policyGateId: "policy-denied-filesystem-write",
      status: "denied",
      approvalRequired: false,
      reasons: ["filesystem.write is not allowed for planning."],
      issues: [directBlockedPolicyIssue],
      metadata: {
        deniedOperations: ["filesystem.write"],
      },
    },
  ],
});

assertDirectPlanningResultShape(directBlockedPolicyResult);
assertDirectPlanningSummaryHonest(directBlockedPolicyResult);
assertPlanningVerifierGateHonest(directBlockedPolicyResult);
assert.deepEqual(
  planningIssueSummaries(directBlockedPolicyResult),
  [
    {
      code: "POLICY_DENIED_OPERATION",
      message: "filesystem.write is denied for this planner smoke.",
      workItemId: undefined,
      batchId: undefined,
      policyGateId: "policy-denied-filesystem-write",
      auditEventIds: undefined,
    },
  ],
  "planning logic smoke C should create deterministic blocked policy issue",
);
assert.ok(
  directBlockedPolicyResult.adapterBoundary.deniedOperations.includes(
    "filesystem.write",
  ),
  "planning logic smoke C should preserve denied operation",
);
assert.equal(
  directBlockedPolicyResult.ok,
  false,
  "planning logic smoke C should not be ok for denied policy",
);
assertPlanningStepsNotCompleted(
  directBlockedPolicyResult,
  "planning logic smoke C should not imply executable completion",
);

const directResumePlanningResult = planAgenticRunner({
  taskId: "resume-planning-smoke",
  taskContract: createPlanningTaskContract("resume-planning-smoke"),
  mode: "resume",
  options: {
    requireAudit: true,
    requireVerifier: true,
  },
  verifierRequirements: createVerifierRequirement("coverage-verifier-resume"),
  resumeData: {
    resumeCursorReference: {
      id: "resume-cursor-planning-smoke",
      path: "state/resume-planning-smoke.json",
      version: "7",
    },
    nextStepId: "step-batch-003",
    nextBatchId: "batch-003",
    pendingWorkItemIds: ["sitemap-url-202", "sitemap-url-201", "sitemap-url-202"],
    retryableWorkItemIds: ["sitemap-url-118", "sitemap-url-017"],
    updatedAt: "2026-08-04T10:15:00.000Z",
    metadata: {
      source: "resume-cursor",
    },
  },
});

assertDirectPlanningResultShape(directResumePlanningResult);
assertDirectPlanningSummaryHonest(directResumePlanningResult);
assertPlanningVerifierGateHonest(directResumePlanningResult);
assert.deepEqual(
  directResumePlanningResult.resume?.resumeCursorReference,
  {
    id: "resume-cursor-planning-smoke",
    path: "state/resume-planning-smoke.json",
    version: "7",
  },
  "planning logic smoke D should preserve resume cursor reference",
);
assert.equal(
  directResumePlanningResult.resume?.nextStepId,
  "step-batch-003",
  "planning logic smoke D should preserve next step id",
);
assert.equal(
  directResumePlanningResult.resume?.nextBatchId,
  "batch-003",
  "planning logic smoke D should preserve next batch id",
);
assert.deepEqual(
  directResumePlanningResult.resume?.pendingWorkItemIds,
  ["sitemap-url-201", "sitemap-url-202"],
  "planning logic smoke D should deterministically order pending work item ids",
);
assert.deepEqual(
  directResumePlanningResult.resume?.retryableWorkItemIds,
  ["sitemap-url-017", "sitemap-url-118"],
  "planning logic smoke D should deterministically order retryable work item ids",
);
assert.ok(
  directResumePlanningResult.resume?.updatedAt,
  "planning logic smoke D should expose updatedAt",
);

const directVerifierGatedPlanningResult = planAgenticRunner({
  taskId: "verifier-gated-executable-plan",
  taskContract: createPlanningTaskContract("verifier-gated-executable-plan"),
  workItems: [
    createPlanningWorkItem("verifier-work-item-001", "verifier-batch-001"),
  ],
  batches: [
    createPlanningBatch("verifier-batch-001", ["verifier-work-item-001"]),
  ],
  mode: "dry_run",
  options: {
    requireAudit: true,
    requireVerifier: true,
  },
  verifierRequirements: createVerifierRequirement("coverage-verifier-executable"),
});
const directVerifierDisabledPlanningResult = planAgenticRunner({
  taskId: "verifier-disabled-executable-plan",
  taskContract: createPlanningTaskContract("verifier-disabled-executable-plan"),
  workItems: [
    createPlanningWorkItem("verifier-disabled-item-001", "verifier-disabled-batch"),
  ],
  batches: [
    createPlanningBatch("verifier-disabled-batch", [
      "verifier-disabled-item-001",
    ]),
  ],
  mode: "dry_run",
  options: {
    requireAudit: true,
  },
  verifierRequirements: {
    verifierRequired: false,
    completionGatedByVerifier: false,
    issues: [],
  },
});

assertDirectPlanningResultShape(directVerifierGatedPlanningResult);
assertDirectPlanningSummaryHonest(directVerifierGatedPlanningResult);
assertPlanningVerifierGateHonest(directVerifierGatedPlanningResult);
assert.equal(
  directVerifierGatedPlanningResult.verifier.verifierRequired,
  true,
  "planning logic smoke E should require verifier for executable plans",
);
assert.equal(
  directVerifierGatedPlanningResult.verifier.completionGatedByVerifier,
  true,
  "planning logic smoke E should gate completion by verifier",
);
assert.ok(
  directVerifierGatedPlanningResult.steps.some(
    (step) => step.kind === "verification" && step.verifierRequired,
  ),
  "planning logic smoke E should include verification step",
);
assert.equal(
  directVerifierDisabledPlanningResult.ok,
  false,
  "planning logic smoke E should reject executable plans that disable verifier",
);
assert.deepEqual(
  directVerifierDisabledPlanningResult.issues.map((issue) => issue.code),
  ["VERIFIER_COMPLETION_GATE_FALSE", "VERIFIER_REQUIREMENT_FALSE"],
  "planning logic smoke E should expose deterministic verifier gating issues",
);

const directAuditExpectationGapResult = planAgenticRunner({
  taskId: "audit-expectation-gap",
  taskContract: createPlanningTaskContract("audit-expectation-gap"),
  mode: "plan",
  options: {
    requireAudit: true,
  },
  auditRequirements: {
    expectedAuditEventIds: [
      "audit-policy-preflight-planned",
      "audit-batch-001-planned",
      "audit-batch-002-planned",
    ],
    requiredEventKinds: ["policy.preflight.planned", "batch.execution.planned"],
    missingAuditEventIds: ["audit-batch-002-planned"],
    auditRequired: true,
    issues: [],
  },
});

assertDirectPlanningResultShape(directAuditExpectationGapResult);
assertDirectPlanningSummaryHonest(directAuditExpectationGapResult);
assertPlanningVerifierGateHonest(directAuditExpectationGapResult);
assert.deepEqual(
  directAuditExpectationGapResult.audit.expectedAuditEventIds,
  [
    "audit-batch-001-planned",
    "audit-batch-002-planned",
    "audit-policy-preflight-planned",
  ],
  "planning logic smoke F should represent expected audit event ids deterministically",
);
assert.deepEqual(
  directAuditExpectationGapResult.audit.requiredEventKinds,
  ["batch.execution.planned", "policy.preflight.planned"],
  "planning logic smoke F should represent required event kinds deterministically",
);
assert.deepEqual(
  directAuditExpectationGapResult.audit.missingAuditEventIds,
  ["audit-batch-002-planned"],
  "planning logic smoke F should represent missing audit event ids",
);
assert.deepEqual(
  directAuditExpectationGapResult.issues.map((issue) => issue.code),
  ["AUDIT_EXPECTATION_MISSING_EVENT_ID"],
  "planning logic smoke F should create deterministic audit issue",
);
assert.equal(
  directAuditExpectationGapResult.summary.issueCount,
  1,
  "planning logic smoke F issue count should be stable",
);

const directDuplicateWorkItemResult = planAgenticRunner({
  taskId: "duplicate-work-item-plan",
  taskContract: createPlanningTaskContract("duplicate-work-item-plan"),
  workItems: [
    createPlanningWorkItem("duplicate-work-item-001"),
    createPlanningWorkItem("duplicate-work-item-001"),
  ],
  mode: "plan",
  options: {
    requireAudit: true,
    requireVerifier: true,
  },
  verifierRequirements: createVerifierRequirement("coverage-verifier-duplicates"),
});

assertDirectPlanningResultShape(directDuplicateWorkItemResult);
assertDirectPlanningSummaryHonest(directDuplicateWorkItemResult);
assertPlanningVerifierGateHonest(directDuplicateWorkItemResult);
assert.equal(
  directDuplicateWorkItemResult.ok,
  false,
  "planning logic smoke G should reject or issue duplicate work item ids",
);
assert.deepEqual(
  directDuplicateWorkItemResult.issues.map((issue) => issue.code),
  ["DUPLICATE_WORK_ITEM_ID"],
  "planning logic smoke G should produce deterministic duplicate work item issue",
);
assert.ok(
  directDuplicateWorkItemResult.issues[0]?.message.includes(
    "duplicate-work-item-001",
  ),
  "planning logic smoke G should mention duplicate id in issue message",
);

const directMissingBatchReferenceResult = planAgenticRunner({
  taskId: "missing-batch-reference-plan",
  taskContract: createPlanningTaskContract("missing-batch-reference-plan"),
  workItems: [
    createPlanningWorkItem("known-work-item-001", "batch-with-missing-reference"),
  ],
  batches: [
    createPlanningBatch("batch-with-missing-reference", [
      "known-work-item-001",
      "missing-work-item-999",
    ]),
  ],
  mode: "plan",
  options: {
    requireAudit: true,
    requireVerifier: true,
  },
  verifierRequirements: createVerifierRequirement("coverage-verifier-missing"),
});

assertDirectPlanningResultShape(directMissingBatchReferenceResult);
assertDirectPlanningSummaryHonest(directMissingBatchReferenceResult);
assertPlanningVerifierGateHonest(directMissingBatchReferenceResult);
assert.equal(
  directMissingBatchReferenceResult.ok,
  false,
  "planning logic smoke H should reject or issue missing batch work item reference",
);
assert.deepEqual(
  directMissingBatchReferenceResult.issues.map((issue) => issue.code),
  ["BATCH_REFERENCES_MISSING_WORK_ITEM"],
  "planning logic smoke H should produce deterministic missing reference issue",
);
assert.equal(
  directMissingBatchReferenceResult.issues[0]?.workItemId,
  "missing-work-item-999",
  "planning logic smoke H should preserve missing work item id",
);

const directDuplicateAcrossBatchesInput = {
  taskId: "duplicate-across-batches-plan",
  taskContract: createPlanningTaskContract("duplicate-across-batches-plan"),
  workItems: [
    createPlanningWorkItem("cross-batch-item-001", "batch-b"),
    createPlanningWorkItem("cross-batch-item-002", "batch-a"),
  ],
  batches: [
    createPlanningBatch("batch-b", ["cross-batch-item-001"]),
    createPlanningBatch("batch-a", [
      "cross-batch-item-001",
      "cross-batch-item-002",
    ]),
  ],
  mode: "plan",
  options: {
    requireAudit: true,
    requireVerifier: true,
  },
  verifierRequirements: createVerifierRequirement("coverage-verifier-cross-batch"),
};
const directDuplicateAcrossBatchesResult = planAgenticRunner(
  directDuplicateAcrossBatchesInput,
);
const repeatedDuplicateAcrossBatchesResult = planAgenticRunner(
  directDuplicateAcrossBatchesInput,
);

assertDirectPlanningResultShape(directDuplicateAcrossBatchesResult);
assertDirectPlanningSummaryHonest(directDuplicateAcrossBatchesResult);
assertPlanningVerifierGateHonest(directDuplicateAcrossBatchesResult);
assert.equal(
  directDuplicateAcrossBatchesResult.ok,
  false,
  "planning logic smoke I should reject duplicate work item id across batches",
);
assert.deepEqual(
  directDuplicateAcrossBatchesResult.issues.map((issue) => issue.code),
  ["WORK_ITEM_IN_MULTIPLE_BATCHES"],
  "planning logic smoke I should produce deterministic duplicate-across-batches issue",
);
assert.deepEqual(
  planningIssueSummaries(directDuplicateAcrossBatchesResult),
  planningIssueSummaries(repeatedDuplicateAcrossBatchesResult),
  "planning logic smoke I issue ordering should be stable",
);

const directOrderingPlanningInput = {
  taskId: "deterministic-ordering-plan",
  taskContract: createPlanningTaskContract("deterministic-ordering-plan"),
  workItems: [
    createPlanningWorkItem("item-c", "batch-c"),
    createPlanningWorkItem("item-a", "batch-a"),
    createPlanningWorkItem("item-b", "batch-b"),
  ],
  batches: [
    createPlanningBatch("batch-c", ["item-c"]),
    createPlanningBatch("batch-a", ["item-a"]),
    createPlanningBatch("batch-b", ["item-b"]),
  ],
  mode: "plan",
  options: {
    requireAudit: true,
    requireVerifier: true,
  },
  verifierRequirements: createVerifierRequirement("coverage-verifier-ordering"),
};
const directOrderingPlanningResult = planAgenticRunner(
  directOrderingPlanningInput,
);
const repeatedOrderingPlanningResult = planAgenticRunner(
  directOrderingPlanningInput,
);

assertDirectPlanningResultShape(directOrderingPlanningResult);
assertDirectPlanningSummaryHonest(directOrderingPlanningResult);
assertPlanningVerifierGateHonest(directOrderingPlanningResult);
assert.deepEqual(
  directOrderingPlanningResult.workItems.map((workItem) => workItem.id),
  ["item-a", "item-b", "item-c"],
  "planning logic smoke J should deterministically order work items",
);
assert.deepEqual(
  directOrderingPlanningResult.batches.map((batch) => batch.id),
  ["batch-a", "batch-b", "batch-c"],
  "planning logic smoke J should deterministically order batches",
);
assert.deepEqual(
  directOrderingPlanningResult.steps.map((step) => step.id),
  [
    "step-policy-preflight",
    "step-batch-a",
    "step-batch-b",
    "step-batch-c",
    "step-audit-append",
    "step-verifier-handoff",
  ],
  "planning logic smoke J should deterministically order steps",
);
assert.deepEqual(
  repeatedOrderingPlanningResult,
  directOrderingPlanningResult,
  "planning logic smoke J repeated planner calls should be equivalent",
);

for (const directPlanningResult of [
  directSitemapPlanningResult,
  directApprovalPlanningResult,
  directBlockedPolicyResult,
  directResumePlanningResult,
  directVerifierGatedPlanningResult,
  directVerifierDisabledPlanningResult,
  directAuditExpectationGapResult,
  directDuplicateWorkItemResult,
  directMissingBatchReferenceResult,
  directDuplicateAcrossBatchesResult,
  directOrderingPlanningResult,
]) {
  assertDirectPlanningSummaryHonest(directPlanningResult);
  assertDirectPlanningResultShape(directPlanningResult);
}

const tempRoot = await mkdtemp(join(tmpdir(), "aeos-core-smoke-"));

try {
  const targetRoot = join(tempRoot, "target");
  const outsideRoot = join(tempRoot, "outside");
  const adapter = createFilesystemGenerationAdapter({ targetRoot });

  const dryRunDirectoryPath = "planned-dir";
  const dryRunDirectory = await adapter.ensureDirectory({
    path: dryRunDirectoryPath,
    dryRun: true,
  });

  assert.equal(
    dryRunDirectory.ok,
    true,
    "dry-run directory ensure should report ok",
  );
  assert.equal(
    dryRunDirectory.status,
    "planned",
    "dry-run directory ensure should be planned",
  );
  assert.equal(
    dryRunDirectory.created,
    false,
    "dry-run directory ensure should not create directories",
  );
  assert.deepEqual(
    issueCodes(dryRunDirectory),
    ["write_skipped"],
    "dry-run directory ensure should report skipped write behavior",
  );
  assert.equal(
    await pathExists(join(targetRoot, dryRunDirectoryPath)),
    false,
    "dry-run directory ensure must not create the directory",
  );

  const dryRunFilePath = "planned/file.txt";
  const dryRunFile = await adapter.writeFile({
    path: dryRunFilePath,
    content: "planned content\n",
    dryRun: true,
    overwrite: false,
  });

  assert.equal(dryRunFile.ok, true, "dry-run file write should report ok");
  assert.equal(
    dryRunFile.status,
    "planned",
    "dry-run file write should be planned",
  );
  assert.equal(
    dryRunFile.written,
    false,
    "dry-run file write should not report a write",
  );
  assert.equal(
    dryRunFile.skipped,
    true,
    "dry-run file write should report skipped behavior",
  );
  assert.deepEqual(
    issueCodes(dryRunFile),
    ["write_skipped"],
    "dry-run file write should report skipped write behavior",
  );
  assert.equal(
    await pathExists(join(targetRoot, dryRunFilePath)),
    false,
    "dry-run file write must not create the file",
  );

  const safeFilePath = "safe/note.txt";
  const safeContent = "safe content\n";
  const safeWrite = await adapter.writeFile({
    path: safeFilePath,
    content: safeContent,
    dryRun: false,
    overwrite: false,
  });

  assert.equal(safeWrite.ok, true, "safe file write should report ok");
  assert.equal(safeWrite.status, "written", "safe file write should write");
  assert.equal(
    safeWrite.written,
    true,
    "safe file write should report a written file",
  );
  assert.equal(
    await readFile(join(targetRoot, safeFilePath), "utf8"),
    safeContent,
    "safe file write should persist the expected content",
  );

  const existingPath = "existing.txt";
  const existingAbsolutePath = join(targetRoot, existingPath);
  await adapter.writeFile({
    path: existingPath,
    content: "original\n",
    dryRun: false,
    overwrite: false,
  });

  const overwriteDisabled = await adapter.writeFile({
    path: existingPath,
    content: "replacement\n",
    dryRun: false,
    overwrite: false,
  });

  assert.equal(
    overwriteDisabled.ok,
    false,
    "overwrite-disabled file write should not report ok",
  );
  assert.equal(
    overwriteDisabled.status,
    "blocked",
    "overwrite-disabled file write should be blocked",
  );
  assert.equal(
    overwriteDisabled.skipped,
    true,
    "overwrite-disabled file write should report skipped behavior",
  );
  assert.deepEqual(
    issueCodes(overwriteDisabled),
    ["overwrite_disabled"],
    "overwrite-disabled file write should report overwrite_disabled",
  );
  assert.equal(
    await readFile(existingAbsolutePath, "utf8"),
    "original\n",
    "overwrite-disabled file write must not overwrite existing content",
  );

  const traversalTarget = "../outside/traversal.md";
  const traversalWrite = await adapter.writeFile({
    path: traversalTarget,
    content: "outside\n",
    dryRun: false,
    overwrite: false,
  });

  assert.equal(
    traversalWrite.ok,
    false,
    "path traversal file write should not report ok",
  );
  assert.equal(
    traversalWrite.status,
    "blocked",
    "path traversal file write should be blocked",
  );
  assert.deepEqual(
    issueCodes(traversalWrite),
    ["target_outside_root"],
    "path traversal file write should report target_outside_root",
  );
  assert.equal(
    await pathExists(join(outsideRoot, "traversal.md")),
    false,
    "path traversal file write must not write outside targetRoot",
  );

  const absoluteOutsidePath = resolve(outsideRoot, "absolute.md");
  const absoluteWrite = await adapter.writeFile({
    path: absoluteOutsidePath,
    content: "absolute outside\n",
    dryRun: false,
    overwrite: false,
  });

  assert.equal(
    absoluteWrite.ok,
    false,
    "absolute target path file write should not report ok",
  );
  assert.equal(
    absoluteWrite.status,
    "blocked",
    "absolute target path file write should be blocked",
  );
  assert.deepEqual(
    issueCodes(absoluteWrite),
    ["target_outside_root"],
    "absolute target path file write should report target_outside_root",
  );
  assert.equal(
    await pathExists(absoluteOutsidePath),
    false,
    "absolute target path file write must not write outside targetRoot",
  );

  const defaultPipelineRoot = join(tempRoot, "init-default-pipeline");
  const defaultPipelineContent = "# Default Pipeline\n";
  const defaultPipelineResult = await runRenderedInitPipeline(
    defaultPipelineRoot,
    [createRenderedArtifact("AGENTS.md", defaultPipelineContent)],
  );

  assert.equal(
    defaultPipelineResult.ok,
    true,
    "default init pipeline generation should report ok",
  );
  assert.deepEqual(
    resultIssueCodes(defaultPipelineResult),
    [],
    "default init pipeline generation should not report errors",
  );
  assert.equal(
    await pathExists(join(defaultPipelineRoot, "AGENTS.md")),
    false,
    "default init pipeline generation must not write files",
  );
  assert.deepEqual(
    defaultPipelineResult.generatedFiles,
    [
      {
        path: "AGENTS.md",
        status: "planned",
        summary: "Render AGENTS.md.",
        sourcePath: "smoke-template/AGENTS.md",
      },
    ],
    "default init pipeline generation should report planned files",
  );

  const writePipelineRoot = join(tempRoot, "init-write-pipeline");
  const writePipelineContent = "# Written Pipeline\n";
  const writePipelineResult = await runRenderedInitPipeline(
    writePipelineRoot,
    [createRenderedArtifact("AGENTS.md", writePipelineContent)],
    {
      fileSystemAdapter: createFilesystemGenerationAdapter({
        targetRoot: writePipelineRoot,
      }),
      writeMode: "write",
    },
  );

  assert.equal(
    writePipelineResult.ok,
    true,
    "explicit filesystem-backed init pipeline generation should report ok",
  );
  assert.equal(
    await readFile(join(writePipelineRoot, "AGENTS.md"), "utf8"),
    writePipelineContent,
    "explicit filesystem-backed init pipeline generation should write rendered content",
  );
  assert.deepEqual(
    generatedFileFor(writePipelineResult, "AGENTS.md"),
    {
      path: "AGENTS.md",
      status: "created",
      summary: "Render AGENTS.md.",
      sourcePath: "smoke-template/AGENTS.md",
    },
    "explicit filesystem-backed init pipeline generation should report created files",
  );

  const conflictPipelineRoot = join(tempRoot, "init-conflict-pipeline");
  const conflictPath = join(conflictPipelineRoot, "AGENTS.md");
  const existingContent = "# Existing\n";
  await mkdir(conflictPipelineRoot, { recursive: true });
  await writeNodeFile(conflictPath, existingContent);

  const conflictPipelineResult = await runRenderedInitPipeline(
    conflictPipelineRoot,
    [createRenderedArtifact("AGENTS.md", "# Replacement\n")],
    {
      fileSystemAdapter: createFilesystemGenerationAdapter({
        targetRoot: conflictPipelineRoot,
      }),
      writeMode: "write",
    },
  );

  assert.equal(
    conflictPipelineResult.ok,
    false,
    "overwrite-disabled init pipeline generation should fail on conflict",
  );
  assert.equal(
    await readFile(conflictPath, "utf8"),
    existingContent,
    "overwrite-disabled init pipeline generation must not replace existing content",
  );
  assert.deepEqual(
    resultIssueCodes(conflictPipelineResult),
    ["generation_target_exists"],
    "overwrite-disabled init pipeline generation should report target_exists",
  );
  assert.equal(
    generatedFileFor(conflictPipelineResult, "AGENTS.md")?.status,
    "blocked",
    "overwrite-disabled init pipeline generation should report blocked file status",
  );

  const traversalPipelineRoot = join(tempRoot, "init-traversal-pipeline");
  const outsidePipelinePath = join(tempRoot, "outside.md");
  const traversalPipelineResult = await runRenderedInitPipeline(
    traversalPipelineRoot,
    [createRenderedArtifact("../outside.md", "# Outside\n")],
    {
      fileSystemAdapter: createFilesystemGenerationAdapter({
        targetRoot: traversalPipelineRoot,
      }),
      writeMode: "write",
    },
  );

  assert.equal(
    traversalPipelineResult.ok,
    false,
    "path traversal init pipeline generation should fail",
  );
  assert.equal(
    await pathExists(outsidePipelinePath),
    false,
    "path traversal init pipeline generation must not write outside targetRoot",
  );
  assert.ok(
    resultIssueCodes(traversalPipelineResult).includes(
      "generation_target_outside_root",
    ),
    "path traversal init pipeline generation should report target_outside_root",
  );
  assert.equal(
    generatedFileFor(traversalPipelineResult, "../outside.md")?.status,
    "blocked",
    "path traversal init pipeline generation should report blocked file status",
  );

  console.log("filesystem generation writer smoke tests passed");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
