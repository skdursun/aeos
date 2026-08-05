import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  symlink,
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
import {
  auditHandoffGapExample,
  dryRunExecutionInputExample,
  executionExampleAdapterCalls,
  failedBlockedExecutionResultExample,
  partialSitemapExecutionResultExample,
  verifiedCompleteExecutionResultExample,
  waitingForApprovalExecutionResultExample,
} from "../dist/agentic-runner-execution.example.js";
import {
  approvalDryRunResult,
  auditDryRunPreview,
  blockedDryRunResult,
  modelAdapterCallPreview,
  resumeDryRunPreview,
  safeAuditPreview,
  safeDryRunResult,
  safeResumePreview,
  safeVerifierPreview,
  sitemapDryRunResult,
  toolAdapterCallPreview,
  verifierDryRunPreview,
} from "../dist/agentic-runner-dry-run.example.js";
import {
  adapterCallPreviews as logicAdapterCallPreviews,
  adapterPreviewChecks as logicAdapterPreviewChecks,
  approvalRequiredDryRunChecks as logicApprovalRequiredDryRunChecks,
  approvalRequiredDryRunResult as logicApprovalRequiredDryRunResult,
  auditPreview as logicAuditPreview,
  auditPreviewChecks as logicAuditPreviewChecks,
  blockedDryRunChecks as logicBlockedDryRunChecks,
  blockedDryRunResult as logicBlockedDryRunResult,
  deterministicDryRunOutput,
  individualPreviewHelpers,
  resumePreview as logicResumePreview,
  resumePreviewChecks as logicResumePreviewChecks,
  safeDryRunPreviewChecks as logicSafeDryRunPreviewChecks,
  safeDryRunPreviewResult as logicSafeDryRunPreviewResult,
  sitemapDryRunPreviewCounts as logicSitemapDryRunPreviewCounts,
  sitemapDryRunResult as logicSitemapDryRunResult,
  summaryBehavior,
  summaryBehaviorChecks,
  verifierPreview as logicVerifierPreview,
  verifierPreviewChecks as logicVerifierPreviewChecks,
} from "../dist/agentic-runner-dry-run-logic.example.js";
import {
  parseTaskPlanInputFile,
  planAgenticRunner,
  runAgenticRunnerDryRun,
  verifyAgenticCoverage,
} from "../dist/index.js";
import {
  directoryInsteadOfFilePathCheck,
  directoryInsteadOfFileResult,
  fullTaskPlanInputResultShape,
  invalidJsonParseResult,
  invalidJsonResult,
  missingFilePathCheck,
  missingFileResult,
  outsideWorkingDirectoryPathCheck,
  successfulPathCheck,
  unsupportedMappingHandoff,
  unsafeOutsideWorkingDirectoryResult,
  validJsonParseResult,
  validLocalJsonTaskFileRequest,
  validationHandoffRequested,
} from "../dist/task-plan-input.example.js";
import {
  adapterBoundaryMappingExample,
  auditExpectationMappingExample,
  explicitWorkItemBatchMapping,
  explicitWorkItemMappingResult,
  fullMappingResultShapeExample,
  invalidTaskContractMappingInput,
  invalidTaskContractMappingResult,
  minimalTaskContractMappingInput,
  planningInputHandoffExample,
  policyMappingExample,
  resumeMappingExample,
  singleWorkItemFallbackMappingResult,
  taskContractMappingExampleOptions,
  taskContractMappingExamples,
  unsupportedMappingResult,
  validMinimalTaskMappingResult,
  verifierRequirementMappingExample,
} from "../dist/task-contract-mapping.example.js";

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

function assertExecutionResultShape(result) {
  for (const field of [
    "ok",
    "taskId",
    "mode",
    "state",
    "steps",
    "batches",
    "workItemOutcomes",
    "adapterCalls",
    "audit",
    "verifier",
    "issues",
    "summary",
  ]) {
    assert.ok(
      Object.hasOwn(result, field),
      `${result.taskId} execution result should expose stable field ${field}`,
    );
  }

  for (const optionalField of ["plan", "policy", "approval", "resume"]) {
    assert.ok(
      !Object.hasOwn(result, optionalField) ||
        result[optionalField] === undefined ||
        typeof result[optionalField] === "object",
      `${result.taskId} execution result ${optionalField} field should remain optional object shape`,
    );
  }

  assert.ok(
    Array.isArray(result.steps),
    `${result.taskId} execution result should expose steps array`,
  );
  assert.ok(
    Array.isArray(result.batches),
    `${result.taskId} execution result should expose batches array`,
  );
  assert.ok(
    Array.isArray(result.workItemOutcomes),
    `${result.taskId} execution result should expose work item outcomes array`,
  );
  assert.ok(
    Array.isArray(result.adapterCalls),
    `${result.taskId} execution result should expose adapter calls array`,
  );
  assert.ok(
    Array.isArray(result.issues),
    `${result.taskId} execution result should expose issues array`,
  );
}

function assertExecutionSummaryConsistent(result) {
  const executedSteps = result.steps.filter((step) => step.startedAt).length;
  const completedSteps = result.steps.filter(
    (step) => step.state === "completed",
  ).length;
  const failedSteps = result.steps.filter((step) => step.state === "failed").length;
  const blockedSteps = result.steps.filter(
    (step) => step.state === "blocked",
  ).length;
  const retryableSteps = result.steps.filter(
    (step) => step.state === "retryable",
  ).length;
  const completedBatches = result.batches.filter(
    (batch) => batch.state === "completed",
  ).length;
  const failedBatches = result.batches.filter(
    (batch) => batch.state === "failed",
  ).length;

  assert.equal(
    result.summary.plannedSteps,
    result.steps.length,
    `${result.taskId} execution summary planned steps should match steps array`,
  );
  assert.equal(
    result.summary.executedSteps,
    executedSteps,
    `${result.taskId} execution summary executed steps should match started steps`,
  );
  assert.equal(
    result.summary.completedSteps,
    completedSteps,
    `${result.taskId} execution summary completed steps should match completed step states`,
  );
  assert.equal(
    result.summary.failedSteps,
    failedSteps,
    `${result.taskId} execution summary failed steps should match failed step states`,
  );
  assert.equal(
    result.summary.blockedSteps,
    blockedSteps,
    `${result.taskId} execution summary blocked steps should match blocked step states`,
  );
  assert.equal(
    result.summary.retryableSteps,
    retryableSteps,
    `${result.taskId} execution summary retryable steps should match retryable step states`,
  );
  assert.equal(
    result.summary.plannedBatches,
    result.batches.length,
    `${result.taskId} execution summary planned batches should match batches array`,
  );
  assert.equal(
    result.summary.completedBatches,
    completedBatches,
    `${result.taskId} execution summary completed batches should match completed batch states`,
  );
  assert.equal(
    result.summary.failedBatches,
    failedBatches,
    `${result.taskId} execution summary failed batches should match failed batch states`,
  );
  assert.equal(
    result.summary.expectedWorkItems,
    result.batches.reduce((count, batch) => count + batch.expectedItemCount, 0),
    `${result.taskId} execution summary expected work items should match batches`,
  );
  assert.equal(
    result.summary.completedWorkItems,
    result.batches.reduce(
      (count, batch) => count + batch.observedCompletedCount,
      0,
    ),
    `${result.taskId} execution summary completed work items should match batches`,
  );
  assert.equal(
    result.summary.failedWorkItems,
    result.batches.reduce((count, batch) => count + batch.observedFailedCount, 0),
    `${result.taskId} execution summary failed work items should match batches`,
  );
  assert.equal(
    result.summary.skippedWorkItems,
    result.batches.reduce(
      (count, batch) => count + batch.observedSkippedCount,
      0,
    ),
    `${result.taskId} execution summary skipped work items should match batches`,
  );
  assert.equal(
    result.summary.retryableWorkItems,
    result.batches.reduce(
      (count, batch) => count + batch.observedRetryableCount,
      0,
    ),
    `${result.taskId} execution summary retryable work items should match batches`,
  );
  assert.equal(
    result.summary.adapterCallCount,
    result.adapterCalls.length,
    `${result.taskId} execution summary adapter call count should match adapter calls`,
  );
  assert.equal(
    result.summary.auditEventsEmitted,
    result.audit.emittedAuditEventIds.length,
    `${result.taskId} execution summary audit count should match emitted audit events`,
  );
  assert.equal(
    result.summary.verifierIssueCount,
    result.verifier.issues.length,
    `${result.taskId} execution summary verifier issue count should match verifier issues`,
  );
  assert.equal(
    result.summary.issueCount,
    result.issues.length,
    `${result.taskId} execution summary issue count should match issues array`,
  );
}

function assertExecutionVerifierGateHonest(result) {
  if (result.ok || result.state === "completed" || result.state === "verified") {
    assert.equal(
      result.verifier.verifierStatus,
      "verified",
      `${result.taskId} execution completion must be gated by verified verifier handoff`,
    );
    assert.equal(
      result.verifier.completionGateSatisfied,
      true,
      `${result.taskId} execution completion must satisfy verifier completion gate`,
    );
  }
}

function assertDryRunResultShape(result) {
  for (const field of [
    "ok",
    "taskId",
    "mode",
    "state",
    "steps",
    "batches",
    "workItems",
    "adapterCalls",
    "audit",
    "verifier",
    "issues",
    "summary",
  ]) {
    assert.ok(
      Object.hasOwn(result, field),
      `${result.taskId} dry-run result should expose stable field ${field}`,
    );
  }

  for (const optionalField of ["plan", "planningResult", "lifecycle", "resume"]) {
    assert.ok(
      !Object.hasOwn(result, optionalField) ||
        result[optionalField] === undefined ||
        typeof result[optionalField] === "object",
      `${result.taskId} dry-run result ${optionalField} field should remain optional object shape`,
    );
  }

  assert.ok(
    Array.isArray(result.steps),
    `${result.taskId} dry-run result should expose steps array`,
  );
  assert.ok(
    Array.isArray(result.batches),
    `${result.taskId} dry-run result should expose batches array`,
  );
  assert.ok(
    Array.isArray(result.workItems),
    `${result.taskId} dry-run result should expose work items array`,
  );
  assert.ok(
    Array.isArray(result.adapterCalls),
    `${result.taskId} dry-run result should expose adapter previews array`,
  );
  assert.ok(
    Array.isArray(result.issues),
    `${result.taskId} dry-run result should expose issues array`,
  );
}

function assertDryRunSummaryConsistent(result) {
  const runnableSteps = result.steps.filter((step) => step.wouldRun).length;
  const blockedSteps = result.steps.filter(
    (step) => step.previewState === "blocked",
  ).length;
  const runnableBatches = result.batches.filter((batch) => batch.wouldRun).length;
  const processableWorkItems = result.workItems.filter(
    (workItem) => workItem.wouldProcess,
  ).length;
  const wouldCallAdapters = result.adapterCalls.filter(
    (call) => call.wouldCall,
  ).length;

  assert.equal(
    result.summary.plannedSteps,
    result.steps.length,
    `${result.taskId} dry-run summary planned steps should match steps array`,
  );
  assert.equal(
    result.summary.runnableSteps,
    runnableSteps,
    `${result.taskId} dry-run summary runnable steps should match step previews`,
  );
  assert.equal(
    result.summary.blockedSteps,
    blockedSteps,
    `${result.taskId} dry-run summary blocked steps should match step previews`,
  );
  assert.equal(
    result.summary.plannedBatches,
    result.batches.length,
    `${result.taskId} dry-run summary planned batches should match batches array`,
  );
  assert.equal(
    result.summary.runnableBatches,
    runnableBatches,
    `${result.taskId} dry-run summary runnable batches should match batch previews`,
  );
  assert.equal(
    result.summary.plannedWorkItems,
    result.workItems.length,
    `${result.taskId} dry-run summary planned work items should match work item previews`,
  );
  assert.equal(
    result.summary.processableWorkItems,
    processableWorkItems,
    `${result.taskId} dry-run summary processable work items should match previews`,
  );
  assert.equal(
    result.summary.plannedAdapterCalls,
    result.adapterCalls.length,
    `${result.taskId} dry-run summary adapter call count should match previews`,
  );
  assert.equal(
    result.summary.wouldCallAdapters,
    wouldCallAdapters,
    `${result.taskId} dry-run summary wouldCallAdapters should match previews`,
  );
  assert.equal(
    result.summary.expectedAuditEvents,
    result.audit.expectedAuditEventIds.length,
    `${result.taskId} dry-run summary expected audit events should match audit preview`,
  );
  assert.equal(
    result.summary.wouldWriteAudit,
    result.audit.wouldWriteAudit,
    `${result.taskId} dry-run summary audit write flag should match audit preview`,
  );
  assert.equal(
    result.summary.verifierRequired,
    result.verifier.verifierRequired,
    `${result.taskId} dry-run summary verifierRequired should match verifier preview`,
  );
  assert.equal(
    result.summary.wouldRunVerifier,
    result.verifier.wouldRunVerifier,
    `${result.taskId} dry-run summary verifier run flag should match verifier preview`,
  );
  assert.equal(
    result.summary.issueCount,
    result.issues.length,
    `${result.taskId} dry-run summary issue count should match issues array`,
  );
}

function assertDryRunSideEffectFree(result) {
  assert.equal(
    result.mode,
    "dry_run",
    `${result.taskId} dry-run result should preserve dry_run mode`,
  );
  assert.notEqual(
    result.state,
    "completed",
    `${result.taskId} dry-run preview must not represent real execution completion`,
  );
  assert.notEqual(
    result.state,
    "verified",
    `${result.taskId} dry-run preview must not represent verified completion`,
  );
  assert.equal(
    result.steps.some((step) => step.previewState === "completed"),
    false,
    `${result.taskId} dry-run steps must not represent completed execution`,
  );
  assert.equal(
    result.steps.some((step) => step.previewState === "verified"),
    false,
    `${result.taskId} dry-run steps must not represent verified execution`,
  );
  assert.equal(
    result.batches.some((batch) => batch.previewState === "completed"),
    false,
    `${result.taskId} dry-run batches must not represent completed execution`,
  );
  assert.equal(
    result.batches.some((batch) => batch.previewState === "verified"),
    false,
    `${result.taskId} dry-run batches must not represent verified execution`,
  );
  assert.equal(
    result.workItems.some((workItem) => workItem.previewState === "completed"),
    false,
    `${result.taskId} dry-run work items must not represent completed execution`,
  );
  assert.equal(
    result.workItems.some((workItem) => workItem.previewState === "verified"),
    false,
    `${result.taskId} dry-run work items must not represent verified execution`,
  );
  assert.equal(
    result.adapterCalls.some((call) => call.wouldCall),
    false,
    `${result.taskId} dry-run adapter previews must not execute adapters`,
  );
  assert.equal(
    result.adapterCalls.some((call) => call.completionAuthority),
    false,
    `${result.taskId} dry-run adapter previews must not be completion authority`,
  );
  assert.equal(
    result.audit.wouldWriteAudit,
    false,
    `${result.taskId} dry-run audit preview must not write audit events`,
  );
  assert.equal(
    result.verifier.wouldRunVerifier,
    false,
    `${result.taskId} dry-run verifier preview must not run verifier`,
  );
  assert.equal(
    result.verifier.completionGateSatisfied,
    false,
    `${result.taskId} dry-run preview must not satisfy verifier completion gate`,
  );
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

function assertTaskPlanInputIssueRepresented(issue, message) {
  assert.equal(typeof issue.code, "string", `${message} should expose issue code`);
  assert.ok(issue.code.length > 0, `${message} issue code should not be empty`);
  assert.equal(
    typeof issue.message,
    "string",
    `${message} should expose issue message`,
  );
  assert.ok(
    issue.message.length > 0,
    `${message} issue message should not be empty`,
  );
  assert.ok(
    ["error", "warning", "info"].includes(issue.severity),
    `${message} should expose known issue severity`,
  );
  assert.ok(
    [
      "request",
      "path",
      "format",
      "parse",
      "validation",
      "mapping",
      "safety",
      "unknown",
    ].includes(issue.phase),
    `${message} should expose known issue phase`,
  );
}

function assertTaskPlanInputResultShape(result, message) {
  for (const field of [
    "ok",
    "mode",
    "sourceFile",
    "pathCheck",
    "parse",
    "validation",
    "mapping",
    "issues",
    "summary",
  ]) {
    assert.ok(
      Object.hasOwn(result, field),
      `${message} should expose stable field ${field}`,
    );
  }

  assert.ok(Array.isArray(result.issues), `${message} should expose issues array`);
  assert.ok(
    Array.isArray(result.pathCheck.issues),
    `${message} should expose path check issues array`,
  );
  assert.ok(
    Array.isArray(result.parse.issues),
    `${message} should expose parse issues array`,
  );
  assert.ok(
    Array.isArray(result.validation.issues),
    `${message} should expose validation issues array`,
  );
  assert.ok(
    Array.isArray(result.mapping.issues),
    `${message} should expose mapping issues array`,
  );
}

function assertTaskPlanInputSummaryConsistent(result, message) {
  assert.equal(
    result.summary.hasSourceFile,
    Boolean(result.sourceFile),
    `${message} summary hasSourceFile should match represented source file`,
  );
  assert.equal(
    result.summary.pathOk,
    result.pathCheck.status === "ok",
    `${message} summary pathOk should match path check status`,
  );
  assert.equal(
    result.summary.parseOk,
    result.parse.ok,
    `${message} summary parseOk should match parse result`,
  );
  assert.equal(
    result.summary.validationRequested,
    result.validation.requested,
    `${message} summary validationRequested should match validation handoff`,
  );
  assert.equal(
    result.summary.validationOk,
    result.validation.status === "pass",
    `${message} summary validationOk should match validation status`,
  );
  assert.equal(
    result.summary.mappingRequested,
    result.mapping.requested,
    `${message} summary mappingRequested should match mapping handoff`,
  );
  assert.equal(
    result.summary.mappingOk,
    result.mapping.status === "ready",
    `${message} summary mappingOk should match mapping status`,
  );
  assert.equal(
    result.summary.issueCount,
    result.issues.length,
    `${message} summary issue count should match issues array length`,
  );
  assert.equal(
    result.summary.noExecution,
    true,
    `${message} summary should preserve noExecution`,
  );
  assert.equal(
    result.summary.noWrites,
    true,
    `${message} summary should preserve noWrites`,
  );
}

function assertTaskPlanInputSafety(result, message) {
  assert.equal(
    result.mapping.runnerPlanningExecuted,
    false,
    `${message} mapping handoff must not execute runner planning`,
  );
  assert.equal(
    result.summary.runnerPlanningExecuted,
    false,
    `${message} summary must not imply runner planning execution`,
  );
  assert.equal(
    result.summary.taskPersistenceWritten,
    false,
    `${message} summary must not imply task persistence writes`,
  );
  assert.equal(
    result.summary.noExecution,
    true,
    `${message} summary must keep no-execution flag explicit`,
  );
  assert.equal(
    result.summary.noWrites,
    true,
    `${message} summary must keep no-write flag explicit`,
  );
  assert.equal(
    result.summary.trustsModelSelfReporting,
    false,
    `${message} summary must not trust model self-reporting`,
  );

  const forbiddenTruthFields = new Set([
    "auditWritten",
    "verifierExecuted",
    "adapterCallHappened",
    "filesystemMutationHappened",
    "taskPersistenceExists",
  ]);
  const visit = (value) => {
    if (value === null || typeof value !== "object") {
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item);
      }
      return;
    }

    for (const [key, nestedValue] of Object.entries(value)) {
      assert.equal(
        !(forbiddenTruthFields.has(key) && nestedValue === true),
        true,
        `${message} must not imply ${key}`,
      );
      visit(nestedValue);
    }
  };

  visit(result);
}

function createTaskPlanInputSmokeOptions(overrides = {}) {
  return {
    allowAbsolutePath: false,
    allowParentTraversal: false,
    maxFileSizeBytes: 64_000,
    requireJsonObject: true,
    validateContract: false,
    createPlanningHandoff: false,
    noExecution: true,
    noWrites: true,
    trustModelSelfReporting: false,
    ...overrides,
  };
}

function createTaskPlanInputSmokeRequest(
  currentWorkingDirectory,
  inputPath,
  optionOverrides = {},
  requestOverrides = {},
) {
  const options = createTaskPlanInputSmokeOptions(optionOverrides);

  return {
    inputPath,
    currentWorkingDirectory,
    mode: "plan",
    options,
    expectedFormat: "json",
    maxFileSizeBytes: options.maxFileSizeBytes,
    noExecution: true,
    noWrites: true,
    ...requestOverrides,
  };
}

function createTaskPlanInputSmokeTask() {
  return {
    id: "TASK-0237",
    title: "Add task plan input parser logic smoke tests.",
    purpose:
      "Add dependency-free smoke tests for AEOS task plan input parser logic.",
    status: "pending",
    executionMode: "code",
    context: {
      load: [
        {
          path: "packages/core/src/task-plan-input-parser.ts",
          required: true,
        },
      ],
      doNotLoad: [
        {
          path: "docs/",
          required: true,
        },
      ],
    },
    fileBoundary: {
      filesToModify: ["packages/core/scripts/smoke.mjs", "PROJECT_CONTEXT.md"],
      filesNotToTouch: ["packages/core/src/task-plan-input-parser.ts"],
      allowGeneratedFiles: false,
      requireStopOnBoundaryConflict: true,
    },
    allowedOperations: [
      "read_context",
      "modify_file",
      "run_verification",
      "check_git_status",
    ],
    forbiddenOperations: [
      "read_unlisted_context",
      "modify_unlisted_file",
      "rename_file",
      "delete_file",
      "install_dependency",
      "change_package_config",
      "deploy",
      "push_git",
      "run_destructive_command",
      "continue_next_task",
    ],
    steps: [
      {
        order: 1,
        instruction: "Extend smoke tests for parser logic.",
        required: true,
      },
    ],
    verification: [
      {
        command: "pnpm --filter @aeos/core smoke",
        level: "smoke_test",
        required: true,
        scope: ["packages/core/scripts/smoke.mjs"],
        expectedEvidence: ["Parser input smoke scenarios pass."],
      },
    ],
    stopCondition: {
      description: "Stop after TASK-0237 smoke tests and context update.",
      stopAfterCompletion: true,
    },
  };
}

function stableTaskPlanInputFields(result) {
  return {
    pathStatus: result.pathCheck.status,
    parseOk: result.parse.ok,
    validationRequested: result.validation.requested,
    validationStatus: result.validation.status,
    mappingRequested: result.mapping.requested,
    mappingStatus: result.mapping.status,
    summary: result.summary,
    parseErrorMessage: result.parse.parseErrorMessage,
    issues: result.issues.map((issue) => ({
      code: issue.code,
      message: issue.message,
      severity: issue.severity,
      phase: issue.phase,
    })),
  };
}

async function snapshotDirectoryEntries(root) {
  const entries = [];

  async function visit(directory, relativeDirectory) {
    const dirents = await readdir(directory, { withFileTypes: true });
    const sortedDirents = [...dirents].sort((left, right) =>
      left.name.localeCompare(right.name),
    );

    for (const dirent of sortedDirents) {
      const absolutePath = join(directory, dirent.name);
      const relativePath =
        relativeDirectory.length > 0
          ? join(relativeDirectory, dirent.name)
          : dirent.name;
      const entryStat = await stat(absolutePath);
      const entryType = dirent.isDirectory()
        ? "directory"
        : dirent.isFile()
          ? "file"
          : "other";

      entries.push({
        path: relativePath,
        type: entryType,
        size: entryStat.size,
        mtimeMs: entryStat.mtimeMs,
      });

      if (dirent.isDirectory()) {
        await visit(absolutePath, relativePath);
      }
    }
  }

  await visit(root, "");

  return entries;
}

function assertTaskPlanInputParserReadOnly(result, message) {
  assertTaskPlanInputSafety(result, message);
  assert.equal(
    Object.hasOwn(result, "plan"),
    false,
    `${message} must not produce a runner plan`,
  );
  assert.equal(
    Object.hasOwn(result, "planningResult"),
    false,
    `${message} must not produce a planning result`,
  );
  assert.equal(
    Object.hasOwn(result, "runnerPlanningResult"),
    false,
    `${message} must not produce a runner planning result`,
  );
  assert.equal(
    Object.hasOwn(result, "adapterCalls"),
    false,
    `${message} must not expose adapter calls`,
  );
  assert.equal(
    Object.hasOwn(result, "audit"),
    false,
    `${message} must not expose audit runtime output`,
  );
  assert.equal(
    Object.hasOwn(result, "verifier"),
    false,
    `${message} must not expose verifier runtime output`,
  );
  assert.equal(
    result.mapping.runnerPlanningInput,
    undefined,
    `${message} must not create runner planning input`,
  );
  assert.equal(
    result.mapping.runnerPlanningInputReference,
    undefined,
    `${message} must not create runner planning references`,
  );
  assert.equal(
    result.mapping.runnerPlanningInputData,
    undefined,
    `${message} must not create runner planning data handoff`,
  );
}

function assertTaskPlanInputTempCleanupTarget(tempRoot, prefix, message) {
  const resolvedTmpDir = resolve(tmpdir());
  const expectedPrefix = resolve(join(tmpdir(), prefix));
  const resolvedTempRoot = resolve(tempRoot);

  assert.ok(
    resolvedTempRoot.startsWith(expectedPrefix),
    `${message} cleanup target should be the created task plan parser temp directory`,
  );
  assert.notEqual(
    resolvedTempRoot,
    resolvedTmpDir,
    `${message} cleanup target must not be os.tmpdir()`,
  );
  assert.notEqual(
    resolvedTempRoot,
    expectedPrefix,
    `${message} cleanup target must include mkdtemp suffix`,
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
      result.verifier.verifierRequired,
      true,
      `${result.taskId} executable planning result must require verifier`,
    );
    assert.equal(
      result.verifier.completionGatedByVerifier,
      true,
      `${result.taskId} executable planning result must gate completion by verifier`,
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

function assertTaskContractMappingResultShape(result, message) {
  for (const field of [
    "ok",
    "taskId",
    "mode",
    "status",
    "sourceFile",
    "workItems",
    "batches",
    "policy",
    "adapterBoundary",
    "audit",
    "verifier",
    "resume",
    "planningInput",
    "issues",
    "summary",
  ]) {
    assert.ok(
      Object.hasOwn(result, field) || result[field] === undefined,
      `${message} should expose stable field ${field} when represented`,
    );
  }

  assert.ok(Array.isArray(result.workItems), `${message} should expose work items`);
  assert.ok(Array.isArray(result.batches), `${message} should expose batches`);
  assert.ok(Array.isArray(result.issues), `${message} should expose issues`);
  assert.equal(
    result.planningInput.runnerPlanningExecuted,
    false,
    `${message} must not imply planAgenticRunner execution`,
  );
  assert.equal(
    result.planningInput.taskPersistenceWritten,
    false,
    `${message} must not imply task persistence writes`,
  );
}

function assertTaskContractMappingSummaryConsistent(result, message) {
  const planningInputData = result.planningInput.runnerPlanningInputData?.data;
  const adapterReferenceCount =
    (result.adapterBoundary?.modelAdapterReferences.length ?? 0) +
    (result.adapterBoundary?.toolAdapterReferences.length ?? 0) ||
    planningInputData?.adapterReferences?.length ||
    0;
  const policyRequired =
    result.policy?.required ??
    Boolean(planningInputData?.policyRequirements?.length);
  const approvalRequired =
    (result.policy?.approvalRequired ?? false) ||
    (result.adapterBoundary?.approvalRequired ?? false) ||
    Boolean(
      planningInputData?.policyRequirements?.some(
        (policy) => policy.approvalRequired,
      ),
    );
  const expectedAuditEventCount =
    result.audit?.expectedAuditEventIds.length ??
    planningInputData?.auditRequirements?.expectedAuditEventIds.length ??
    0;
  const verifierRequired =
    result.verifier?.verifierRequired ??
    planningInputData?.verifierRequirements?.verifierRequired ??
    false;
  const completionGatedByVerifier =
    result.verifier?.completionGatedByVerifier ??
    planningInputData?.verifierRequirements?.completionGatedByVerifier ??
    false;

  assert.equal(
    result.summary.workItemCount,
    result.workItems.length,
    `${message} summary work item count should match mappings`,
  );
  assert.equal(
    result.summary.batchCount,
    result.batches.length,
    `${message} summary batch count should match mappings`,
  );
  assert.equal(
    result.summary.policyRequired,
    policyRequired,
    `${message} summary policyRequired should match policy mapping`,
  );
  assert.equal(
    result.summary.approvalRequired,
    approvalRequired,
    `${message} summary approvalRequired should match gates`,
  );
  assert.equal(
    result.summary.adapterReferenceCount,
    adapterReferenceCount,
    `${message} summary adapter count should match adapter boundary`,
  );
  assert.equal(
    result.summary.expectedAuditEventCount,
    expectedAuditEventCount,
    `${message} summary audit event count should match audit expectations`,
  );
  assert.equal(
    result.summary.verifierRequired,
    verifierRequired,
    `${message} summary verifierRequired should match verifier mapping`,
  );
  assert.equal(
    result.summary.completionGatedByVerifier,
    completionGatedByVerifier,
    `${message} summary verifier completion gate should match verifier mapping`,
  );
  assert.equal(
    result.summary.mappingSupported,
    result.status === "mapped",
    `${message} summary mappingSupported should match mapped status`,
  );
  assert.equal(
    result.summary.noExecution,
    true,
    `${message} summary should keep noExecution explicit`,
  );
  assert.equal(
    result.summary.noWrites,
    true,
    `${message} summary should keep noWrites explicit`,
  );
  assert.equal(
    result.summary.issueCount,
    result.issues.length,
    `${message} summary issue count should match issues array`,
  );
}

function assertTaskContractMappingSafety(result, message) {
  assert.equal(
    result.planningInput.runnerPlanningExecuted,
    false,
    `${message} must not execute runner planning`,
  );
  assert.equal(
    result.planningInput.taskPersistenceWritten,
    false,
    `${message} must not write task persistence`,
  );
  assert.equal(
    Object.hasOwn(result, "plan"),
    false,
    `${message} must not expose runner plan execution output`,
  );
  assert.equal(
    Object.hasOwn(result, "runnerPlanningResult"),
    false,
    `${message} must not expose runner planning result output`,
  );
  assert.equal(
    Object.hasOwn(result, "executionResult"),
    false,
    `${message} must not expose runner execution output`,
  );

  const forbiddenTrueFields = new Set([
    "taskParsingExecuted",
    "taskValidationExecuted",
    "planAgenticRunnerExecuted",
    "runnerPlanningExecuted",
    "runnerExecutionExecuted",
    "taskPersistenceExists",
    "taskPersistenceWritten",
    "auditWritten",
    "auditEventsEmitted",
    "verifierExecuted",
    "adapterCallHappened",
    "adapterCallsMade",
    "filesystemMutationHappened",
  ]);

  const visit = (value) => {
    if (value === null || typeof value !== "object") {
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item);
      }
      return;
    }

    for (const [key, nestedValue] of Object.entries(value)) {
      assert.equal(
        !(forbiddenTrueFields.has(key) && nestedValue === true),
        true,
        `${message} must not imply ${key}`,
      );
      visit(nestedValue);
    }
  };

  visit(result);
}

assert.equal(
  minimalTaskContractMappingInput.taskId,
  validMinimalTaskMappingResult.taskId,
  "task contract mapping smoke A should represent task id",
);
assert.equal(
  validMinimalTaskMappingResult.sourceFile,
  minimalTaskContractMappingInput.sourceFile,
  "task contract mapping smoke A should represent source file",
);
assert.equal(
  validMinimalTaskMappingResult.mode,
  "plan",
  "task contract mapping smoke A should represent plan mode",
);
assert.equal(
  minimalTaskContractMappingInput.noExecution,
  true,
  "task contract mapping smoke A input should preserve noExecution",
);
assert.equal(
  minimalTaskContractMappingInput.noWrites,
  true,
  "task contract mapping smoke A input should preserve noWrites",
);
assert.equal(
  validMinimalTaskMappingResult.summary.noExecution,
  true,
  "task contract mapping smoke A result should preserve noExecution",
);
assert.equal(
  validMinimalTaskMappingResult.summary.noWrites,
  true,
  "task contract mapping smoke A result should preserve noWrites",
);
assert.equal(
  validMinimalTaskMappingResult.verifier.verifierRequired,
  true,
  "task contract mapping smoke A should require verifier",
);
assert.equal(
  validMinimalTaskMappingResult.verifier.completionGatedByVerifier,
  true,
  "task contract mapping smoke A should gate completion by verifier",
);

assert.equal(
  taskContractMappingExampleOptions.allowSingleWorkItemFallback,
  true,
  "task contract mapping smoke B should represent single work item fallback option",
);
assert.equal(
  singleWorkItemFallbackMappingResult.workItems.length,
  1,
  "task contract mapping smoke B should represent one work item mapping",
);
assert.equal(
  singleWorkItemFallbackMappingResult.workItems[0].derivedFrom,
  "single_work_item_fallback",
  "task contract mapping smoke B should represent fallback derivation",
);
assert.equal(
  singleWorkItemFallbackMappingResult.batches[0].derivedDefaultBatch,
  true,
  "task contract mapping smoke B should represent default batch",
);
assert.equal(
  singleWorkItemFallbackMappingResult.batches[0].expectedItemCount,
  1,
  "task contract mapping smoke B default batch expected count should be one",
);
assert.equal(
  singleWorkItemFallbackMappingResult.verifier.verifierRequired,
  true,
  "task contract mapping smoke B should require verifier",
);
assertTaskContractMappingSafety(
  singleWorkItemFallbackMappingResult,
  "task contract mapping smoke B",
);

assert.equal(
  explicitWorkItemMappingResult.workItems.length,
  2,
  "task contract mapping smoke C should represent multiple work items",
);
assert.deepEqual(
  explicitWorkItemMappingResult.workItems.map((workItem) => workItem.workItemId),
  [
    "work-item:TASK-0245:001-load-contracts",
    "work-item:TASK-0245:002-add-examples",
  ],
  "task contract mapping smoke C work item ids should remain deterministic",
);
assert.deepEqual(
  explicitWorkItemBatchMapping.workItemIds,
  explicitWorkItemMappingResult.workItems.map((workItem) => workItem.workItemId),
  "task contract mapping smoke C batch should reference work item ids",
);
assert.equal(
  explicitWorkItemBatchMapping.expectedItemCount,
  explicitWorkItemBatchMapping.workItemIds.length,
  "task contract mapping smoke C batch expected count should match work item ids",
);

assert.equal(
  unsupportedMappingResult.status,
  "unsupported",
  "task contract mapping smoke D should represent unsupported status",
);
assert.equal(
  unsupportedMappingResult.ok,
  false,
  "task contract mapping smoke D should not be ok",
);
assert.equal(
  typeof unsupportedMappingResult.planningInput.unsupportedReason,
  "string",
  "task contract mapping smoke D should represent unsupported reason",
);
assert.equal(
  unsupportedMappingResult.planningInput.handoffStatus,
  "unsupported",
  "task contract mapping smoke D planning handoff should be unsupported",
);
assertTaskContractMappingSafety(
  unsupportedMappingResult,
  "task contract mapping smoke D",
);

assert.ok(
  ["invalid", "failed"].includes(invalidTaskContractMappingResult.status),
  "task contract mapping smoke E should represent invalid or failed status",
);
assert.equal(
  invalidTaskContractMappingInput.validation.status,
  "fail",
  "task contract mapping smoke E should represent validation status",
);
assert.equal(
  invalidTaskContractMappingInput.validation.reference.id,
  "task-validation:TASK-INVALID",
  "task contract mapping smoke E should represent validation reference",
);
assert.ok(
  invalidTaskContractMappingResult.issues.length > 0,
  "task contract mapping smoke E should represent an issue",
);
assert.equal(
  invalidTaskContractMappingResult.ok,
  false,
  "task contract mapping smoke E should not be ok",
);

assert.equal(
  policyMappingExample.required,
  true,
  "task contract mapping smoke F should represent required policy",
);
assert.equal(
  typeof policyMappingExample.approvalRequired,
  "boolean",
  "task contract mapping smoke F should represent approval requirement",
);
assert.equal(
  policyMappingExample.policyGateId,
  "policy-gate:TASK-0245:no-writes",
  "task contract mapping smoke F should represent policy gate id",
);
assert.equal(
  policyMappingExample.status,
  "not_evaluated",
  "task contract mapping smoke F should not imply policy enforcement",
);

assert.ok(
  adapterBoundaryMappingExample.modelAdapterReferences.length > 0,
  "task contract mapping smoke G should represent model adapter refs",
);
assert.ok(
  adapterBoundaryMappingExample.toolAdapterReferences.length > 0,
  "task contract mapping smoke G should represent tool adapter refs",
);
assert.ok(
  adapterBoundaryMappingExample.allowedOperations.length > 0,
  "task contract mapping smoke G should represent allowed operations",
);
assert.ok(
  adapterBoundaryMappingExample.deniedOperations.length > 0,
  "task contract mapping smoke G should represent denied operations",
);
assert.equal(
  typeof adapterBoundaryMappingExample.approvalRequired,
  "boolean",
  "task contract mapping smoke G should represent approval requirement",
);
assert.ok(
  adapterBoundaryMappingExample.deniedOperations.includes("call_adapter"),
  "task contract mapping smoke G should not imply adapter calls",
);

assert.ok(
  auditExpectationMappingExample.expectedAuditEventIds.length > 0,
  "task contract mapping smoke H should represent expected audit event ids",
);
assert.ok(
  auditExpectationMappingExample.requiredEventKinds.length > 0,
  "task contract mapping smoke H should represent required audit event kinds",
);
assert.equal(
  auditExpectationMappingExample.auditRequired,
  true,
  "task contract mapping smoke H should represent audit requirement",
);
assert.equal(
  planningInputHandoffExample.runnerPlanningInputData.data.metadata
    .auditEventsEmitted,
  false,
  "task contract mapping smoke H should not imply audit events emitted",
);

assert.equal(
  verifierRequirementMappingExample.verifierRequired,
  true,
  "task contract mapping smoke I should require verifier",
);
assert.equal(
  verifierRequirementMappingExample.completionGatedByVerifier,
  true,
  "task contract mapping smoke I should gate completion by verifier",
);
assert.equal(
  typeof verifierRequirementMappingExample.expectedCoverageRule,
  "string",
  "task contract mapping smoke I should represent expected coverage rule",
);
assert.notEqual(
  fullMappingResultShapeExample.status,
  "completed",
  "task contract mapping smoke I should not imply completed state",
);

assert.equal(
  resumeMappingExample.resumeCursorReference.id,
  "resume-cursor:TASK-0245:example",
  "task contract mapping smoke J should represent resume cursor reference",
);
assert.ok(
  resumeMappingExample.pendingWorkItemIds.length > 0,
  "task contract mapping smoke J should represent pending work item ids",
);
assert.ok(
  resumeMappingExample.retryableWorkItemIds.length > 0,
  "task contract mapping smoke J should represent retryable work item ids",
);
assert.equal(
  resumeMappingExample.nextBatchId,
  "batch:TASK-0245:explicit",
  "task contract mapping smoke J should represent next batch id",
);
assert.equal(
  fullMappingResultShapeExample.planningInput.taskPersistenceWritten,
  false,
  "task contract mapping smoke J should not imply persistence",
);

assert.deepEqual(
  Object.keys(fullMappingResultShapeExample),
  [
    "ok",
    "taskId",
    "mode",
    "status",
    "sourceFile",
    "workItems",
    "batches",
    "policy",
    "adapterBoundary",
    "audit",
    "verifier",
    "resume",
    "planningInput",
    "issues",
    "summary",
  ],
  "task contract mapping smoke K full result should expose stable fields",
);

for (const [message, result] of [
  ["task contract mapping smoke K full result", fullMappingResultShapeExample],
  ["task contract mapping smoke L full result", fullMappingResultShapeExample],
  ...taskContractMappingExamples.map((result, index) => [
    `task contract mapping smoke M example ${index + 1}`,
    result,
  ]),
]) {
  assertTaskContractMappingResultShape(result, message);
  assertTaskContractMappingSummaryConsistent(result, message);
  assertTaskContractMappingSafety(result, message);
}

assert.equal(
  validLocalJsonTaskFileRequest.inputPath,
  "tasks/sitemap-audit.json",
  "task plan smoke A should represent input path",
);
assert.equal(
  validLocalJsonTaskFileRequest.currentWorkingDirectory,
  "/workspace/pro-performans",
  "task plan smoke A should represent current working directory",
);
assert.equal(
  validLocalJsonTaskFileRequest.mode,
  "plan",
  "task plan smoke A should represent plan mode",
);
assert.equal(
  validLocalJsonTaskFileRequest.expectedFormat,
  "json",
  "task plan smoke A should expect json format",
);
assert.equal(
  validLocalJsonTaskFileRequest.noExecution,
  true,
  "task plan smoke A request should preserve noExecution",
);
assert.equal(
  validLocalJsonTaskFileRequest.noWrites,
  true,
  "task plan smoke A request should preserve noWrites",
);
assert.equal(
  validLocalJsonTaskFileRequest.options.noExecution,
  true,
  "task plan smoke A options should preserve noExecution",
);
assert.equal(
  validLocalJsonTaskFileRequest.options.noWrites,
  true,
  "task plan smoke A options should preserve noWrites",
);

assert.equal(
  successfulPathCheck.status,
  "ok",
  "task plan smoke B successful path check should be ok",
);
assert.equal(
  successfulPathCheck.exists,
  true,
  "task plan smoke B successful path check should exist",
);
assert.equal(
  successfulPathCheck.isFile,
  true,
  "task plan smoke B successful path check should be a file",
);
assert.equal(
  successfulPathCheck.isDirectory,
  false,
  "task plan smoke B successful path check should not be a directory",
);
assert.equal(
  successfulPathCheck.withinWorkingDirectory,
  true,
  "task plan smoke B successful path check should stay within working directory",
);
assert.equal(
  successfulPathCheck.issues.some((issue) => issue.severity === "error"),
  false,
  "task plan smoke B successful path check should have no error issues",
);

assert.equal(
  missingFilePathCheck.status,
  "missing",
  "task plan smoke C missing path check should be missing",
);
assert.equal(
  missingFileResult.ok,
  false,
  "task plan smoke C missing file result should not be ok",
);
assert.ok(
  missingFilePathCheck.issues.length > 0,
  "task plan smoke C missing file path check should expose an issue",
);
assertTaskPlanInputIssueRepresented(
  missingFilePathCheck.issues[0],
  "task plan smoke C missing file path issue",
);
assertTaskPlanInputSafety(missingFileResult, "task plan smoke C missing file result");

assert.ok(
  ["directory", "not_file"].includes(directoryInsteadOfFilePathCheck.status),
  "task plan smoke D directory path check should report directory or not_file",
);
assert.ok(
  directoryInsteadOfFilePathCheck.issues.length > 0,
  "task plan smoke D directory path check should expose an issue",
);
assert.equal(
  directoryInsteadOfFileResult.ok,
  false,
  "task plan smoke D directory result should not be ok",
);
assertTaskPlanInputIssueRepresented(
  directoryInsteadOfFilePathCheck.issues[0],
  "task plan smoke D directory path issue",
);

assert.ok(
  ["outside_working_directory", "unsafe_path"].includes(
    outsideWorkingDirectoryPathCheck.status,
  ),
  "task plan smoke E unsafe path check should report outside or unsafe path",
);
assert.ok(
  outsideWorkingDirectoryPathCheck.issues.length > 0,
  "task plan smoke E unsafe path check should expose an issue",
);
assertTaskPlanInputIssueRepresented(
  outsideWorkingDirectoryPathCheck.issues[0],
  "task plan smoke E unsafe path issue",
);
assertTaskPlanInputSafety(
  unsafeOutsideWorkingDirectoryResult,
  "task plan smoke E unsafe path result",
);

assert.equal(
  invalidJsonParseResult.ok,
  false,
  "task plan smoke F invalid json parse should not be ok",
);
assert.equal(
  invalidJsonParseResult.format,
  "json",
  "task plan smoke F invalid json parse should represent json format",
);
assert.equal(
  typeof invalidJsonParseResult.parseErrorMessage,
  "string",
  "task plan smoke F invalid json parse should represent error message",
);
assert.ok(
  invalidJsonParseResult.parseErrorMessage.length > 0,
  "task plan smoke F invalid json parse error message should not be empty",
);
assert.ok(
  invalidJsonParseResult.issues.length > 0,
  "task plan smoke F invalid json parse should expose an issue",
);
assertTaskPlanInputIssueRepresented(
  invalidJsonParseResult.issues[0],
  "task plan smoke F invalid json parse issue",
);

assert.equal(
  validJsonParseResult.ok,
  true,
  "task plan smoke G valid json parse should be ok",
);
assert.equal(
  validationHandoffRequested.requested,
  true,
  "task plan smoke G validation should be requested",
);
assert.equal(
  typeof validationHandoffRequested.status,
  "string",
  "task plan smoke G validation status should be represented",
);
assert.equal(
  validationHandoffRequested.taskId,
  "TASK-0233",
  "task plan smoke G validation task id should be represented",
);

assert.equal(
  unsupportedMappingHandoff.requested,
  true,
  "task plan smoke H mapping should be requested",
);
assert.ok(
  ["unsupported", "blocked"].includes(unsupportedMappingHandoff.status),
  "task plan smoke H mapping should represent unsupported or failed status",
);
assert.equal(
  typeof unsupportedMappingHandoff.unsupportedReason,
  "string",
  "task plan smoke H unsupported mapping reason should be represented",
);
assert.equal(
  unsupportedMappingHandoff.runnerPlanningExecuted,
  false,
  "task plan smoke H unsupported mapping must not imply runner planning execution",
);

assert.deepEqual(
  Object.keys(fullTaskPlanInputResultShape),
  [
    "ok",
    "mode",
    "sourceFile",
    "pathCheck",
    "parse",
    "validation",
    "mapping",
    "issues",
    "summary",
  ],
  "task plan smoke I full result should expose stable top-level fields",
);
assertTaskPlanInputResultShape(
  fullTaskPlanInputResultShape,
  "task plan smoke I full result",
);

for (const [message, result] of [
  ["task plan smoke I full result", fullTaskPlanInputResultShape],
  ["task plan smoke J missing file result", missingFileResult],
  ["task plan smoke J directory result", directoryInsteadOfFileResult],
  ["task plan smoke J unsafe path result", unsafeOutsideWorkingDirectoryResult],
  ["task plan smoke J invalid json result", invalidJsonResult],
]) {
  assertTaskPlanInputResultShape(result, message);
  assertTaskPlanInputSummaryConsistent(result, message);
  assertTaskPlanInputSafety(result, message);
}

const taskPlanParserTempPrefix = "aeos-task-plan-input-parser-smoke-";
const taskPlanParserTempRoot = await mkdtemp(
  join(tmpdir(), taskPlanParserTempPrefix),
);

assertTaskPlanInputTempCleanupTarget(
  taskPlanParserTempRoot,
  taskPlanParserTempPrefix,
  "task plan parser logic smoke temp root",
);

try {
  const parserProjectRoot = join(taskPlanParserTempRoot, "project");
  const parserTasksDirectory = join(parserProjectRoot, "tasks");
  const validTaskPlanPath = join(parserTasksDirectory, "sitemap-audit.json");
  const invalidJsonPath = join(parserTasksDirectory, "invalid.json");
  const nonObjectJsonPath = join(parserTasksDirectory, "non-object.json");
  const unsupportedFormatPath = join(parserTasksDirectory, "task.txt");
  const unsupportedMarkdownPath = join(parserTasksDirectory, "task.md");
  const unsupportedYamlPath = join(parserTasksDirectory, "task.yaml");
  const unsupportedTomlPath = join(parserTasksDirectory, "task.toml");
  const unsupportedSymlinkPath = join(parserTasksDirectory, "task-link.txt");
  const outsideSymlinkPath = join(parserTasksDirectory, "outside-link.json");
  const oversizedJsonPath = join(parserTasksDirectory, "too-large.json");
  const contractJsonPath = join(parserTasksDirectory, "contract.json");
  const invalidContractJsonPath = join(
    parserTasksDirectory,
    "invalid-contract.json",
  );
  const outsideJsonPath = join(taskPlanParserTempRoot, "outside.json");
  const validTaskPlanContent = JSON.stringify(
    {
      id: "TASK-0237",
      title: "Parser smoke valid JSON.",
    },
    null,
    2,
  );
  const invalidJsonContent = '{"id":"TASK-0237",}';
  const nonObjectJsonContent = JSON.stringify(["TASK-0237"]);
  const unsupportedFormatContent = '{"id":"TASK-0237"}';
  const oversizedJsonContent = JSON.stringify({
    id: "TASK-0237",
    title: "Parser smoke oversized JSON.",
    purpose: "This content intentionally exceeds the small smoke max size.",
  });
  const contractJsonContent = JSON.stringify(
    createTaskPlanInputSmokeTask(),
    null,
    2,
  );
  const invalidContractJsonContent = JSON.stringify(
    {
      id: "TASK-0238",
      title: "Invalid parser safety review fixture.",
    },
    null,
    2,
  );
  const outsideJsonContent = JSON.stringify({
    id: "TASK-OUTSIDE",
    title: "Outside parser smoke fixture.",
  });

  await mkdir(parserTasksDirectory, { recursive: true });
  await writeNodeFile(validTaskPlanPath, validTaskPlanContent);
  await writeNodeFile(invalidJsonPath, invalidJsonContent);
  await writeNodeFile(nonObjectJsonPath, nonObjectJsonContent);
  await writeNodeFile(unsupportedFormatPath, unsupportedFormatContent);
  await writeNodeFile(unsupportedMarkdownPath, unsupportedFormatContent);
  await writeNodeFile(unsupportedYamlPath, unsupportedFormatContent);
  await writeNodeFile(unsupportedTomlPath, unsupportedFormatContent);
  await writeNodeFile(oversizedJsonPath, oversizedJsonContent);
  await writeNodeFile(contractJsonPath, contractJsonContent);
  await writeNodeFile(invalidContractJsonPath, invalidContractJsonContent);
  await writeNodeFile(outsideJsonPath, outsideJsonContent);
  await symlink(validTaskPlanPath, unsupportedSymlinkPath);
  await symlink(outsideJsonPath, outsideSymlinkPath);

  const parserSnapshotBefore = await snapshotDirectoryEntries(
    taskPlanParserTempRoot,
  );

  const parserSmokeAValidLocalJson = await parseTaskPlanInputFile(
    createTaskPlanInputSmokeRequest(
      parserProjectRoot,
      "tasks/sitemap-audit.json",
    ),
  );

  assertTaskPlanInputResultShape(
    parserSmokeAValidLocalJson,
    "task plan parser logic smoke A valid local JSON result",
  );
  assertTaskPlanInputSummaryConsistent(
    parserSmokeAValidLocalJson,
    "task plan parser logic smoke A valid local JSON result",
  );
  assertTaskPlanInputParserReadOnly(
    parserSmokeAValidLocalJson,
    "task plan parser logic smoke A valid local JSON result",
  );
  assert.equal(
    parserSmokeAValidLocalJson.ok,
    true,
    "task plan parser logic smoke A valid local JSON should be ok",
  );
  assert.ok(
    parserSmokeAValidLocalJson.sourceFile,
    "task plan parser logic smoke A should expose sourceFile",
  );
  assert.equal(
    parserSmokeAValidLocalJson.pathCheck.status,
    "ok",
    "task plan parser logic smoke A path check should be ok",
  );
  assert.equal(
    parserSmokeAValidLocalJson.parse.ok,
    true,
    "task plan parser logic smoke A parse should be ok",
  );
  assert.equal(
    parserSmokeAValidLocalJson.summary.noExecution,
    true,
    "task plan parser logic smoke A should preserve noExecution",
  );
  assert.equal(
    parserSmokeAValidLocalJson.summary.noWrites,
    true,
    "task plan parser logic smoke A should preserve noWrites",
  );

  const parserSmokeBMissingFile = await parseTaskPlanInputFile(
    createTaskPlanInputSmokeRequest(parserProjectRoot, "tasks/missing.json"),
  );

  assert.equal(
    parserSmokeBMissingFile.ok,
    false,
    "task plan parser logic smoke B missing file should not be ok",
  );
  assert.equal(
    parserSmokeBMissingFile.pathCheck.status,
    "missing",
    "task plan parser logic smoke B should report missing path",
  );
  assert.ok(
    parserSmokeBMissingFile.issues.length > 0,
    "task plan parser logic smoke B should expose an issue",
  );
  assert.deepEqual(
    issueCodes(parserSmokeBMissingFile),
    ["task_plan_input_file_missing"],
    "task plan parser logic smoke B should expose deterministic missing file issue",
  );
  assertTaskPlanInputParserReadOnly(
    parserSmokeBMissingFile,
    "task plan parser logic smoke B missing file result",
  );

  const parserSmokeCDirectory = await parseTaskPlanInputFile(
    createTaskPlanInputSmokeRequest(parserProjectRoot, "tasks"),
  );

  assert.equal(
    parserSmokeCDirectory.ok,
    false,
    "task plan parser logic smoke C directory input should not be ok",
  );
  assert.ok(
    parserSmokeCDirectory.pathCheck.status === "directory",
    "task plan parser logic smoke C should report directory deterministically",
  );
  assert.ok(
    parserSmokeCDirectory.issues.length > 0,
    "task plan parser logic smoke C should expose an issue",
  );
  assert.deepEqual(
    issueCodes(parserSmokeCDirectory),
    ["task_plan_input_path_is_directory"],
    "task plan parser logic smoke C should expose deterministic directory issue",
  );

  const parserSmokeDParentTraversal = await parseTaskPlanInputFile(
    createTaskPlanInputSmokeRequest(parserProjectRoot, "../outside.json"),
  );

  assert.equal(
    parserSmokeDParentTraversal.ok,
    false,
    "task plan parser logic smoke D parent traversal should not be ok",
  );
  assert.ok(
    parserSmokeDParentTraversal.pathCheck.status === "unsafe_path",
    "task plan parser logic smoke D should deny parent traversal before reading",
  );
  assert.ok(
    parserSmokeDParentTraversal.issues.length > 0,
    "task plan parser logic smoke D should expose an issue",
  );
  assert.deepEqual(
    issueCodes(parserSmokeDParentTraversal),
    ["task_plan_input_parent_traversal_disallowed"],
    "task plan parser logic smoke D should expose deterministic parent traversal issue",
  );
  assert.equal(
    await readFile(outsideJsonPath, "utf8"),
    outsideJsonContent,
    "task plan parser logic smoke D outside file should remain unchanged",
  );
  assertTaskPlanInputParserReadOnly(
    parserSmokeDParentTraversal,
    "task plan parser logic smoke D parent traversal result",
  );

  const parserSmokeDNormalizedTraversal = await parseTaskPlanInputFile(
    createTaskPlanInputSmokeRequest(
      parserProjectRoot,
      "tasks/../tasks/sitemap-audit.json",
    ),
  );

  assert.equal(
    parserSmokeDNormalizedTraversal.ok,
    false,
    "task plan parser logic smoke D2 normalized parent traversal should not be ok",
  );
  assert.equal(
    parserSmokeDNormalizedTraversal.pathCheck.status,
    "unsafe_path",
    "task plan parser logic smoke D2 should deny normalized parent traversal before reading",
  );
  assert.deepEqual(
    issueCodes(parserSmokeDNormalizedTraversal),
    ["task_plan_input_parent_traversal_disallowed"],
    "task plan parser logic smoke D2 should expose deterministic parent traversal issue",
  );
  assertTaskPlanInputParserReadOnly(
    parserSmokeDNormalizedTraversal,
    "task plan parser logic smoke D2 normalized parent traversal result",
  );

  const parserSmokeEAbsoluteDenied = await parseTaskPlanInputFile(
    createTaskPlanInputSmokeRequest(parserProjectRoot, validTaskPlanPath),
  );

  assert.equal(
    parserSmokeEAbsoluteDenied.ok,
    false,
    "task plan parser logic smoke E absolute path default should not be ok",
  );
  assert.ok(
    parserSmokeEAbsoluteDenied.pathCheck.status === "unsafe_path",
    "task plan parser logic smoke E should deny absolute paths by default",
  );
  assert.ok(
    parserSmokeEAbsoluteDenied.issues.length > 0,
    "task plan parser logic smoke E should expose an issue",
  );
  assert.deepEqual(
    issueCodes(parserSmokeEAbsoluteDenied),
    ["task_plan_input_absolute_path_disallowed"],
    "task plan parser logic smoke E should expose deterministic absolute path issue",
  );

  const parserSmokeFAbsoluteAllowed = await parseTaskPlanInputFile(
    createTaskPlanInputSmokeRequest(parserProjectRoot, validTaskPlanPath, {
      allowAbsolutePath: true,
    }),
  );

  assert.equal(
    parserSmokeFAbsoluteAllowed.pathCheck.status,
    "ok",
    "task plan parser logic smoke F allowed absolute path should pass path check",
  );
  assert.equal(
    parserSmokeFAbsoluteAllowed.parse.ok,
    true,
    "task plan parser logic smoke F allowed absolute path should parse JSON",
  );
  assert.equal(
    parserSmokeFAbsoluteAllowed.summary.noWrites,
    true,
    "task plan parser logic smoke F should remain read-only",
  );
  assert.equal(
    await readFile(validTaskPlanPath, "utf8"),
    validTaskPlanContent,
    "task plan parser logic smoke F source file should remain unchanged",
  );

  const parserSmokeGInvalidJson = await parseTaskPlanInputFile(
    createTaskPlanInputSmokeRequest(parserProjectRoot, "tasks/invalid.json"),
  );

  assert.equal(
    parserSmokeGInvalidJson.pathCheck.status,
    "ok",
    "task plan parser logic smoke G invalid JSON path should be ok",
  );
  assert.equal(
    parserSmokeGInvalidJson.parse.ok,
    false,
    "task plan parser logic smoke G invalid JSON parse should not be ok",
  );
  assert.equal(
    typeof parserSmokeGInvalidJson.parse.parseErrorMessage,
    "string",
    "task plan parser logic smoke G should expose parse error message",
  );
  assert.equal(
    parserSmokeGInvalidJson.parse.parseErrorMessage,
    "Invalid JSON.",
    "task plan parser logic smoke G parse error message should be deterministic",
  );
  assert.deepEqual(
    issueCodes(parserSmokeGInvalidJson),
    ["task_plan_input_invalid_json"],
    "task plan parser logic smoke G should expose deterministic invalid JSON issue",
  );
  assert.ok(
    parserSmokeGInvalidJson.issues.length > 0,
    "task plan parser logic smoke G should expose an issue",
  );
  assert.equal(
    parserSmokeGInvalidJson.ok,
    false,
    "task plan parser logic smoke G invalid JSON result should not be ok",
  );

  const parserSmokeHNonObjectJson = await parseTaskPlanInputFile(
    createTaskPlanInputSmokeRequest(parserProjectRoot, "tasks/non-object.json"),
  );

  assert.equal(
    parserSmokeHNonObjectJson.parse.ok,
    false,
    "task plan parser logic smoke H non-object JSON should be rejected by default",
  );
  assert.equal(
    parserSmokeHNonObjectJson.ok,
    false,
    "task plan parser logic smoke H non-object JSON result should not be ok",
  );
  assert.ok(
    parserSmokeHNonObjectJson.issues.length > 0,
    "task plan parser logic smoke H should expose an issue",
  );
  assert.deepEqual(
    issueCodes(parserSmokeHNonObjectJson),
    ["task_plan_input_json_root_not_object"],
    "task plan parser logic smoke H should expose deterministic non-object JSON issue",
  );

  const parserSmokeIUnsupportedFormat = await parseTaskPlanInputFile(
    createTaskPlanInputSmokeRequest(parserProjectRoot, "tasks/task.txt"),
  );

  assert.equal(
    parserSmokeIUnsupportedFormat.ok,
    false,
    "task plan parser logic smoke I unsupported extension should not be ok",
  );
  assert.equal(
    parserSmokeIUnsupportedFormat.pathCheck.status,
    "ok",
    "task plan parser logic smoke I unsupported extension path should be ok",
  );
  assert.equal(
    parserSmokeIUnsupportedFormat.parse.format,
    "unsupported",
    "task plan parser logic smoke I should represent unsupported format",
  );
  assert.ok(
    parserSmokeIUnsupportedFormat.issues.length > 0,
    "task plan parser logic smoke I should expose an issue",
  );
  assert.deepEqual(
    issueCodes(parserSmokeIUnsupportedFormat),
    ["task_plan_input_unsupported_format"],
    "task plan parser logic smoke I should expose deterministic unsupported format issue",
  );

  const parserSmokeIUnsupportedFormatVariants = [];

  for (const inputPath of [
    "tasks/task.md",
    "tasks/task.yaml",
    "tasks/task.toml",
  ]) {
    parserSmokeIUnsupportedFormatVariants.push(
      await parseTaskPlanInputFile(
        createTaskPlanInputSmokeRequest(parserProjectRoot, inputPath),
      ),
    );
  }

  for (const result of parserSmokeIUnsupportedFormatVariants) {
    assert.equal(
      result.ok,
      false,
      "task plan parser logic smoke I2 unsupported format variant should not be ok",
    );
    assert.equal(
      result.pathCheck.status,
      "ok",
      "task plan parser logic smoke I2 unsupported format variant path should be ok",
    );
    assert.equal(
      result.parse.format,
      "unsupported",
      "task plan parser logic smoke I2 unsupported format variant should not parse content",
    );
    assert.deepEqual(
      issueCodes(result),
      ["task_plan_input_unsupported_format"],
      "task plan parser logic smoke I2 unsupported format variant should expose deterministic unsupported format issue",
    );
    assertTaskPlanInputParserReadOnly(
      result,
      "task plan parser logic smoke I2 unsupported format variant result",
    );
  }

  const parserSmokeIUnsupportedSymlink = await parseTaskPlanInputFile(
    createTaskPlanInputSmokeRequest(parserProjectRoot, "tasks/task-link.txt"),
  );

  assert.equal(
    parserSmokeIUnsupportedSymlink.ok,
    false,
    "task plan parser logic smoke I3 unsupported symlink input extension should not be ok",
  );
  assert.equal(
    parserSmokeIUnsupportedSymlink.pathCheck.status,
    "ok",
    "task plan parser logic smoke I3 unsupported symlink path should pass path safety",
  );
  assert.equal(
    parserSmokeIUnsupportedSymlink.parse.format,
    "unsupported",
    "task plan parser logic smoke I3 should use the operator input extension",
  );
  assert.deepEqual(
    issueCodes(parserSmokeIUnsupportedSymlink),
    ["task_plan_input_unsupported_format"],
    "task plan parser logic smoke I3 should expose deterministic unsupported symlink issue",
  );
  assertTaskPlanInputParserReadOnly(
    parserSmokeIUnsupportedSymlink,
    "task plan parser logic smoke I3 unsupported symlink result",
  );

  const parserSmokeJOversized = await parseTaskPlanInputFile(
    createTaskPlanInputSmokeRequest(
      parserProjectRoot,
      "tasks/too-large.json",
      {
        maxFileSizeBytes: 16,
      },
      {
        maxFileSizeBytes: 16,
      },
    ),
  );

  assert.equal(
    parserSmokeJOversized.ok,
    false,
    "task plan parser logic smoke J oversized file should not be ok",
  );
  assert.ok(
    parserSmokeJOversized.issues.length > 0,
    "task plan parser logic smoke J should expose an issue",
  );
  assert.equal(
    parserSmokeJOversized.parse.ok,
    false,
    "task plan parser logic smoke J should not pretend parse success",
  );
  assert.deepEqual(
    issueCodes(parserSmokeJOversized),
    ["task_plan_input_file_too_large"],
    "task plan parser logic smoke J should expose deterministic oversized file issue",
  );
  assert.equal(
    parserSmokeJOversized.summary.noWrites,
    true,
    "task plan parser logic smoke J should remain read-only",
  );

  const parserSmokeKInvalidValidation = await parseTaskPlanInputFile(
    createTaskPlanInputSmokeRequest(
      parserProjectRoot,
      "tasks/invalid-contract.json",
      {
        validateContract: true,
      },
    ),
  );

  assert.equal(
    parserSmokeKInvalidValidation.ok,
    false,
    "task plan parser logic smoke K invalid contract should not be ok",
  );
  assert.equal(
    parserSmokeKInvalidValidation.validation.requested,
    true,
    "task plan parser logic smoke K invalid contract validation should be requested",
  );
  assert.equal(
    parserSmokeKInvalidValidation.validation.status,
    "fail",
    "task plan parser logic smoke K invalid contract validation should fail honestly",
  );
  assert.deepEqual(
    issueCodes(parserSmokeKInvalidValidation),
    ["task_plan_input_contract_shape_invalid"],
    "task plan parser logic smoke K invalid contract should expose deterministic validation issue",
  );
  assert.equal(
    parserSmokeKInvalidValidation.validation.task,
    undefined,
    "task plan parser logic smoke K invalid contract must not be treated as valid",
  );
  assertTaskPlanInputParserReadOnly(
    parserSmokeKInvalidValidation,
    "task plan parser logic smoke K invalid contract result",
  );

  const parserSmokeKValidation = await parseTaskPlanInputFile(
    createTaskPlanInputSmokeRequest(parserProjectRoot, "tasks/contract.json", {
      validateContract: true,
    }),
  );

  assert.equal(
    parserSmokeKValidation.validation.requested,
    true,
    "task plan parser logic smoke K validation should be requested",
  );
  assert.equal(
    typeof parserSmokeKValidation.validation.status,
    "string",
    "task plan parser logic smoke K validation status should be represented",
  );
  assert.equal(
    parserSmokeKValidation.validation.status,
    "pass",
    "task plan parser logic smoke K valid contract should pass validation",
  );
  assert.equal(
    parserSmokeKValidation.mapping.runnerPlanningExecuted,
    false,
    "task plan parser logic smoke K must not execute runner planning",
  );

  const parserSmokeLMappingUnsupported = await parseTaskPlanInputFile(
    createTaskPlanInputSmokeRequest(parserProjectRoot, "tasks/contract.json", {
      validateContract: true,
      createPlanningHandoff: true,
    }),
  );

  assert.equal(
    parserSmokeLMappingUnsupported.mapping.requested,
    true,
    "task plan parser logic smoke L mapping should be requested",
  );
  assert.ok(
    parserSmokeLMappingUnsupported.mapping.status === "unsupported",
    "task plan parser logic smoke L should report unsupported mapping handoff",
  );
  assert.equal(
    typeof parserSmokeLMappingUnsupported.mapping.unsupportedReason,
    "string",
    "task plan parser logic smoke L should represent unsupported reason",
  );
  assert.equal(
    parserSmokeLMappingUnsupported.mapping.runnerPlanningExecuted,
    false,
    "task plan parser logic smoke L must not run planAgenticRunner",
  );
  assert.deepEqual(
    issueCodes(parserSmokeLMappingUnsupported),
    ["task_plan_input_mapping_unsupported"],
    "task plan parser logic smoke L should expose deterministic unsupported mapping issue",
  );

  const parserSmokeLSymlinkOutside = await parseTaskPlanInputFile(
    createTaskPlanInputSmokeRequest(parserProjectRoot, "tasks/outside-link.json"),
  );

  assert.equal(
    parserSmokeLSymlinkOutside.ok,
    false,
    "task plan parser logic smoke L2 outside symlink should not be ok",
  );
  assert.equal(
    parserSmokeLSymlinkOutside.pathCheck.status,
    "outside_working_directory",
    "task plan parser logic smoke L2 should deny symlink escape deterministically",
  );
  assert.deepEqual(
    issueCodes(parserSmokeLSymlinkOutside),
    ["task_plan_input_outside_working_directory"],
    "task plan parser logic smoke L2 should expose deterministic outside working directory issue",
  );
  assert.equal(
    await readFile(outsideJsonPath, "utf8"),
    outsideJsonContent,
    "task plan parser logic smoke L2 outside symlink target should remain unchanged",
  );
  assertTaskPlanInputParserReadOnly(
    parserSmokeLSymlinkOutside,
    "task plan parser logic smoke L2 outside symlink result",
  );

  const parserSmokeMFirst = await parseTaskPlanInputFile(
    createTaskPlanInputSmokeRequest(parserProjectRoot, "tasks/contract.json", {
      validateContract: true,
      createPlanningHandoff: true,
    }),
  );
  const parserSmokeMSecond = await parseTaskPlanInputFile(
    createTaskPlanInputSmokeRequest(parserProjectRoot, "tasks/contract.json", {
      validateContract: true,
      createPlanningHandoff: true,
    }),
  );

  assert.deepEqual(
    stableTaskPlanInputFields(parserSmokeMFirst),
    stableTaskPlanInputFields(parserSmokeMSecond),
    "task plan parser logic smoke M repeated parse should be deterministic",
  );

  const parserSmokeMInvalidFirst = await parseTaskPlanInputFile(
    createTaskPlanInputSmokeRequest(parserProjectRoot, "tasks/invalid.json"),
  );
  const parserSmokeMInvalidSecond = await parseTaskPlanInputFile(
    createTaskPlanInputSmokeRequest(parserProjectRoot, "tasks/invalid.json"),
  );

  assert.deepEqual(
    stableTaskPlanInputFields(parserSmokeMInvalidFirst),
    stableTaskPlanInputFields(parserSmokeMInvalidSecond),
    "task plan parser logic smoke M invalid repeated parse should be deterministic",
  );

  for (const [message, result] of [
    ["task plan parser logic smoke A", parserSmokeAValidLocalJson],
    ["task plan parser logic smoke B", parserSmokeBMissingFile],
    ["task plan parser logic smoke C", parserSmokeCDirectory],
    ["task plan parser logic smoke D", parserSmokeDParentTraversal],
    ["task plan parser logic smoke D2", parserSmokeDNormalizedTraversal],
    ["task plan parser logic smoke E", parserSmokeEAbsoluteDenied],
    ["task plan parser logic smoke F", parserSmokeFAbsoluteAllowed],
    ["task plan parser logic smoke G", parserSmokeGInvalidJson],
    ["task plan parser logic smoke H", parserSmokeHNonObjectJson],
    ["task plan parser logic smoke I", parserSmokeIUnsupportedFormat],
    ...parserSmokeIUnsupportedFormatVariants.map((result, index) => [
      `task plan parser logic smoke I2 variant ${index + 1}`,
      result,
    ]),
    ["task plan parser logic smoke I3", parserSmokeIUnsupportedSymlink],
    ["task plan parser logic smoke J", parserSmokeJOversized],
    ["task plan parser logic smoke K invalid", parserSmokeKInvalidValidation],
    ["task plan parser logic smoke K", parserSmokeKValidation],
    ["task plan parser logic smoke L", parserSmokeLMappingUnsupported],
    ["task plan parser logic smoke L2", parserSmokeLSymlinkOutside],
    ["task plan parser logic smoke M first", parserSmokeMFirst],
    ["task plan parser logic smoke M second", parserSmokeMSecond],
    ["task plan parser logic smoke M invalid first", parserSmokeMInvalidFirst],
    ["task plan parser logic smoke M invalid second", parserSmokeMInvalidSecond],
  ]) {
    assertTaskPlanInputResultShape(result, `${message} result`);
    assertTaskPlanInputSummaryConsistent(result, `${message} result`);
    assertTaskPlanInputParserReadOnly(result, `${message} result`);
    assert.ok(
      result.issues.length === 0 || result.issues.every((issue) => issue.message),
      `${message} issues should include deterministic messages`,
    );
  }

  const parserSnapshotAfter = await snapshotDirectoryEntries(
    taskPlanParserTempRoot,
  );

  assert.deepEqual(
    parserSnapshotAfter,
    parserSnapshotBefore,
    "task plan parser logic smoke N parser calls should not create, delete, or modify files",
  );
  assert.equal(
    await readFile(outsideJsonPath, "utf8"),
    outsideJsonContent,
    "task plan parser logic smoke N outside fixture should remain unchanged",
  );
  assert.equal(
    parserSmokeAValidLocalJson.summary.noExecution &&
      parserSmokeFAbsoluteAllowed.summary.noExecution &&
      parserSmokeLMappingUnsupported.summary.noExecution,
    true,
    "task plan parser logic smoke N summaries should keep noExecution true",
  );
  assert.equal(
    parserSmokeAValidLocalJson.summary.noWrites &&
      parserSmokeFAbsoluteAllowed.summary.noWrites &&
      parserSmokeLMappingUnsupported.summary.noWrites,
    true,
    "task plan parser logic smoke N summaries should keep noWrites true",
  );
} finally {
  assertTaskPlanInputTempCleanupTarget(
    taskPlanParserTempRoot,
    taskPlanParserTempPrefix,
    "task plan parser logic smoke temp cleanup",
  );
  await rm(taskPlanParserTempRoot, { recursive: true, force: true });
  assert.equal(
    await pathExists(taskPlanParserTempRoot),
    false,
    "task plan parser logic smoke cleanup should remove only the created temp directory",
  );
  assert.equal(
    await pathExists(tmpdir()),
    true,
    "task plan parser logic smoke cleanup must not remove os.tmpdir()",
  );
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

assert.equal(
  dryRunExecutionInputExample.mode,
  "dry_run",
  "execution smoke A dry-run input should preserve dry_run mode",
);
assert.equal(
  dryRunExecutionInputExample.metadata?.expectedExecutionState,
  "preflight",
  "execution smoke A dry-run input should represent preflight state expectation",
);
assert.ok(
  dryRunExecutionInputExample.plannedSteps.every(
    (step) => step.state === "pending",
  ),
  "execution smoke A dry-run input should not imply completed steps",
);
assert.ok(
  dryRunExecutionInputExample.plannedBatches.every(
    (batch) =>
      batch.state === "pending" &&
      batch.observedCompletedCount === 0 &&
      batch.observedFailedCount === 0 &&
      batch.observedSkippedCount === 0 &&
      batch.observedRetryableCount === 0,
  ),
  "execution smoke A dry-run input should not imply batch execution",
);
assert.ok(
  dryRunExecutionInputExample.plannedWorkItems.every(
    (workItem) => workItem.state === "pending",
  ),
  "execution smoke A dry-run input should not imply completed work items",
);
assert.equal(
  dryRunExecutionInputExample.adapterCalls?.length,
  0,
  "execution smoke A dry-run input should not record adapter calls",
);
assert.equal(
  dryRunExecutionInputExample.audit?.emittedAuditEventIds.length,
  0,
  "execution smoke A dry-run input should not emit audit events",
);
assert.equal(
  dryRunExecutionInputExample.verifier?.verifierRequired,
  true,
  "execution smoke A dry-run input should represent verifier requirement",
);
assert.equal(
  dryRunExecutionInputExample.verifier?.verifierStatus,
  "pending",
  "execution smoke A dry-run input should not falsely complete verifier handoff",
);
assert.equal(
  dryRunExecutionInputExample.verifier?.completionGateSatisfied,
  false,
  "execution smoke A dry-run input should not satisfy completion gate",
);

const executionResults = [
  waitingForApprovalExecutionResultExample,
  partialSitemapExecutionResultExample,
  verifiedCompleteExecutionResultExample,
  failedBlockedExecutionResultExample,
];

for (const executionResult of executionResults) {
  assertExecutionResultShape(executionResult);
  assertExecutionSummaryConsistent(executionResult);
  assertExecutionVerifierGateHonest(executionResult);
}

assert.equal(
  waitingForApprovalExecutionResultExample.approval?.approvalRequired,
  true,
  "execution smoke B should require approval",
);
assert.equal(
  waitingForApprovalExecutionResultExample.approval?.approvalStatus,
  "pending",
  "execution smoke B should represent pending approval",
);
assert.equal(
  waitingForApprovalExecutionResultExample.state,
  "waiting_for_approval",
  "execution smoke B should wait for approval",
);
assert.equal(
  waitingForApprovalExecutionResultExample.policy?.decision,
  "needs_approval",
  "execution smoke B policy execution should need approval",
);
assert.equal(
  waitingForApprovalExecutionResultExample.adapterCalls.length,
  0,
  "execution smoke B should not execute model or tool adapter calls",
);
assert.equal(
  waitingForApprovalExecutionResultExample.ok,
  false,
  "execution smoke B should not be ok while approval is pending",
);
assert.notEqual(
  waitingForApprovalExecutionResultExample.state,
  "completed",
  "execution smoke B should not be completed",
);

assert.equal(
  partialSitemapExecutionResultExample.taskId,
  "sitemap-audit",
  "execution smoke C should preserve sitemap audit task id",
);
assert.equal(
  partialSitemapExecutionResultExample.summary.expectedWorkItems,
  400,
  "execution smoke C should represent 400 expected work items",
);
assert.equal(
  partialSitemapExecutionResultExample.summary.completedWorkItems,
  20,
  "execution smoke C should represent only 20 completed work items",
);
assert.equal(
  partialSitemapExecutionResultExample.summary.retryableWorkItems,
  380,
  "execution smoke C should represent 380 retryable remaining work items",
);
assert.ok(
  ["partially_completed", "retryable"].includes(
    partialSitemapExecutionResultExample.batches[0]?.state,
  ),
  "execution smoke C batch should be partially completed or retryable",
);
assert.equal(
  partialSitemapExecutionResultExample.verifier.verifierStatus,
  "incomplete",
  "execution smoke C verifier handoff should be incomplete",
);
assert.ok(
  ["partially_completed", "retryable"].includes(
    partialSitemapExecutionResultExample.state,
  ),
  "execution smoke C state should remain incomplete or retryable",
);
assert.equal(
  partialSitemapExecutionResultExample.ok,
  false,
  "execution smoke C should not report ok",
);
assert.notEqual(
  partialSitemapExecutionResultExample.state,
  "completed",
  "execution smoke C should not be completed",
);
assert.ok(
  partialSitemapExecutionResultExample.adapterCalls.some(
    (call) => call.metadata?.proposedDone === true,
  ),
  "execution smoke C should represent adapter proposed done",
);
assert.equal(
  partialSitemapExecutionResultExample.verifier.completionGateSatisfied,
  false,
  "execution smoke C adapter proposed done must not satisfy verifier gate",
);

const completeExecutionAccountedItems =
  verifiedCompleteExecutionResultExample.summary.completedWorkItems +
  verifiedCompleteExecutionResultExample.summary.failedWorkItems +
  verifiedCompleteExecutionResultExample.summary.skippedWorkItems;

assert.equal(
  verifiedCompleteExecutionResultExample.verifier.verifierStatus,
  "verified",
  "execution smoke D verifier handoff should be verified",
);
assert.ok(
  ["verified", "completed"].includes(verifiedCompleteExecutionResultExample.state),
  "execution smoke D should be verified or completed by current contract",
);
assert.equal(
  verifiedCompleteExecutionResultExample.ok,
  true,
  "execution smoke D should report ok after verified handoff",
);
assert.equal(
  verifiedCompleteExecutionResultExample.summary.expectedWorkItems,
  completeExecutionAccountedItems,
  "execution smoke D summary should account for terminal work item outcomes",
);
assert.equal(
  verifiedCompleteExecutionResultExample.verifier.completionGatedByVerifier,
  true,
  "execution smoke D should make verifier-gated completion explicit",
);
assert.equal(
  verifiedCompleteExecutionResultExample.verifier.completionGateSatisfied,
  true,
  "execution smoke D completed state should be verifier-gated",
);

const modelAdapterCall = executionExampleAdapterCalls.find(
  (call) => call.kind === "model",
);
const toolAdapterCall = executionExampleAdapterCalls.find(
  (call) => call.kind === "tool",
);

assert.ok(
  modelAdapterCall,
  "execution smoke E should include a model adapter call record",
);
assert.ok(
  toolAdapterCall,
  "execution smoke E should include a tool adapter call record",
);
for (const adapterCall of executionExampleAdapterCalls) {
  assert.ok(
    ["model", "tool"].includes(adapterCall.kind),
    "execution smoke E adapter records should expose model or tool kind",
  );
  assert.ok(
    adapterCall.adapterId,
    "execution smoke E adapter records should expose adapter id",
  );
  assert.ok(
    adapterCall.operation,
    "execution smoke E adapter records should expose operation",
  );
  assert.equal(
    adapterCall.observationOnly,
    true,
    "execution smoke E adapter records should be observations only",
  );
  assert.equal(
    adapterCall.completionAuthority,
    false,
    "execution smoke E adapter records must not be task completion authority",
  );
}
assert.equal(
  partialSitemapExecutionResultExample.adapterCalls[0]?.completionAuthority,
  false,
  "execution smoke E adapter output must not be treated as completion proof",
);
assert.notEqual(
  partialSitemapExecutionResultExample.verifier.verifierStatus,
  "verified",
  "execution smoke E adapter output must not replace verifier proof",
);

assert.ok(
  auditHandoffGapExample.expectedAuditEventIds.length > 0,
  "execution smoke F should represent expected audit event ids",
);
assert.ok(
  auditHandoffGapExample.emittedAuditEventIds.length > 0,
  "execution smoke F should represent emitted audit event ids",
);
assert.deepEqual(
  auditHandoffGapExample.missingAuditEventIds,
  ["audit:handoff-finished"],
  "execution smoke F should represent missing audit event ids",
);
assert.ok(
  !["complete", "verified"].includes(auditHandoffGapExample.auditStatus),
  "execution smoke F audit status should not be complete or verified",
);
assert.ok(
  auditHandoffGapExample.issues.some(
    (issue) => issue.code === "audit_event_missing",
  ),
  "execution smoke F should expose an audit handoff issue",
);

assert.ok(
  partialSitemapExecutionResultExample.resume?.nextStepId,
  "execution smoke G should represent next step id",
);
assert.ok(
  partialSitemapExecutionResultExample.resume?.nextBatchId,
  "execution smoke G should represent next batch id",
);
assert.ok(
  partialSitemapExecutionResultExample.resume?.pendingWorkItemIds.length > 0,
  "execution smoke G should represent pending work item ids",
);
assert.ok(
  partialSitemapExecutionResultExample.resume?.retryableWorkItemIds.length > 0,
  "execution smoke G should represent retryable work item ids",
);
assert.ok(
  partialSitemapExecutionResultExample.resume?.updatedAt,
  "execution smoke G should expose updatedAt",
);

assert.equal(
  failedBlockedExecutionResultExample.policy?.decision,
  "denied",
  "execution smoke H should represent denied policy",
);
assert.equal(
  failedBlockedExecutionResultExample.approval?.approvalStatus,
  "denied",
  "execution smoke H should represent blocked approval",
);
assert.ok(
  ["blocked", "failed"].includes(failedBlockedExecutionResultExample.state),
  "execution smoke H should be blocked or failed",
);
assert.ok(
  failedBlockedExecutionResultExample.issues.length > 0,
  "execution smoke H should include issues",
);
assert.equal(
  failedBlockedExecutionResultExample.adapterCalls.length,
  0,
  "execution smoke H should not execute adapters after policy denial",
);
assert.notEqual(
  failedBlockedExecutionResultExample.state,
  "completed",
  "execution smoke H should not imply completed state",
);
assert.equal(
  failedBlockedExecutionResultExample.ok,
  false,
  "execution smoke H should not report ok",
);

for (const executionResult of executionResults) {
  if (executionResult.ok || executionResult.state === "completed") {
    assert.equal(
      executionResult.verifier.verifierStatus,
      "verified",
      "execution smoke J should not allow ok/completed without verified verifier status",
    );
  }
}
assert.equal(
  partialSitemapExecutionResultExample.ok,
  false,
  "execution smoke J partial sitemap should remain ok false",
);
assert.notEqual(
  partialSitemapExecutionResultExample.verifier.verifierStatus,
  "verified",
  "execution smoke J partial sitemap should remain incomplete",
);
assert.equal(
  verifiedCompleteExecutionResultExample.verifier.verifierStatus,
  "verified",
  "execution smoke J verified complete example should have verified verifier status",
);

const dryRunResults = [
  safeDryRunResult,
  approvalDryRunResult,
  blockedDryRunResult,
  sitemapDryRunResult,
];

for (const dryRunResult of dryRunResults) {
  assertDryRunResultShape(dryRunResult);
  assertDryRunSummaryConsistent(dryRunResult);
  assertDryRunSideEffectFree(dryRunResult);
}

assert.equal(
  safeDryRunResult.mode,
  "dry_run",
  "dry-run smoke A should represent dry-run mode",
);
assert.equal(
  safeDryRunResult.state,
  "preview_ready",
  "dry-run smoke A should represent preview-ready state",
);
assert.ok(
  safeDryRunResult.steps.length > 0,
  "dry-run smoke A should represent planned steps",
);
assert.ok(
  safeDryRunResult.batches.length > 0,
  "dry-run smoke A should represent planned batches",
);
assert.ok(
  safeDryRunResult.workItems.length > 0,
  "dry-run smoke A should represent planned work items",
);
assert.equal(
  safeDryRunResult.adapterCalls.some((call) => call.wouldCall),
  false,
  "dry-run smoke A should not execute adapter calls",
);
assert.equal(
  safeDryRunResult.audit.wouldWriteAudit,
  false,
  "dry-run smoke A should not represent audit writes",
);
assert.equal(
  safeDryRunResult.verifier.verifierRequired,
  true,
  "dry-run smoke A should represent verifier requirement",
);
assert.equal(
  safeDryRunResult.verifier.wouldRunVerifier,
  false,
  "dry-run smoke A should not run verifier",
);
assert.notEqual(
  safeDryRunResult.state,
  "completed",
  "dry-run smoke A should not represent completed state",
);

assert.equal(
  approvalDryRunResult.state,
  "waiting_for_approval",
  "dry-run smoke B should wait for approval",
);
assert.ok(
  approvalDryRunResult.steps.some((step) => step.approvalRequired),
  "dry-run smoke B should represent approval requirement",
);
assert.ok(
  approvalDryRunResult.adapterCalls.every((call) => call.wouldCall === false),
  "dry-run smoke B adapter previews should not call adapters",
);
assert.equal(
  approvalDryRunResult.steps.some((step) => step.wouldRun),
  false,
  "dry-run smoke B should not imply execution while approval is pending",
);
assert.ok(
  approvalDryRunResult.issues.some(
    (issue) => issue.code === "APPROVAL_REQUIRED",
  ),
  "dry-run smoke B should represent approval status as an issue",
);
assert.equal(
  approvalDryRunResult.summary.processableWorkItems,
  0,
  "dry-run smoke B should not represent processable work before approval",
);

assert.equal(
  blockedDryRunResult.state,
  "blocked",
  "dry-run smoke C should represent blocked state",
);
assert.ok(
  blockedDryRunResult.issues.some(
    (issue) => issue.metadata?.deniedOperation === "write_outside_workspace",
  ),
  "dry-run smoke C should represent denied operation",
);
assert.ok(
  blockedDryRunResult.issues.length > 0,
  "dry-run smoke C should include issues",
);
assert.equal(
  blockedDryRunResult.summary.wouldCallAdapters,
  0,
  "dry-run smoke C should not expose executable adapter calls",
);
assert.equal(
  blockedDryRunResult.audit.wouldWriteAudit,
  false,
  "dry-run smoke C should not write audit events",
);
assert.equal(
  blockedDryRunResult.verifier.wouldRunVerifier,
  false,
  "dry-run smoke C should not run verifier",
);

assert.equal(
  sitemapDryRunResult.taskId,
  "sitemap-audit",
  "dry-run smoke D should preserve sitemap audit task id",
);
assert.equal(
  sitemapDryRunResult.workItems.length,
  400,
  "dry-run smoke D should represent 400 planned work items",
);
assert.ok(
  sitemapDryRunResult.batches.length > 0,
  "dry-run smoke D should preview batches",
);
assert.equal(
  sitemapDryRunResult.workItems.some(
    (workItem) => workItem.previewState === "completed",
  ),
  false,
  "dry-run smoke D should keep completed work item count at zero",
);
assert.equal(
  sitemapDryRunResult.verifier.verifierRequired,
  true,
  "dry-run smoke D should require verifier",
);
assert.equal(
  sitemapDryRunResult.verifier.wouldRunVerifier,
  false,
  "dry-run smoke D should not run verifier",
);
assert.notEqual(
  sitemapDryRunResult.state,
  "completed",
  "dry-run smoke D final state should not be completed",
);

assert.equal(
  modelAdapterCallPreview.kind,
  "model",
  "dry-run smoke E should include a model adapter preview",
);
assert.equal(
  toolAdapterCallPreview.kind,
  "tool",
  "dry-run smoke E should include a tool adapter preview",
);
for (const adapterPreview of [modelAdapterCallPreview, toolAdapterCallPreview]) {
  assert.equal(
    adapterPreview.wouldCall,
    false,
    "dry-run smoke E adapter preview should not call adapters",
  );
  assert.equal(
    adapterPreview.observationOnly,
    true,
    "dry-run smoke E adapter preview should be observation-only",
  );
  assert.equal(
    adapterPreview.completionAuthority,
    false,
    "dry-run smoke E adapter preview must not be completion authority",
  );
  assert.equal(
    adapterPreview.outputReference === undefined ||
      adapterPreview.outputReference === null ||
      adapterPreview.metadata?.previewOnly === true,
    true,
    "dry-run smoke E adapter output should be absent, null, or preview-only",
  );
}

for (const auditPreview of [safeAuditPreview, auditDryRunPreview]) {
  assert.ok(
    auditPreview.expectedAuditEventIds.length > 0,
    "dry-run smoke F should represent expected audit event ids",
  );
  assert.equal(
    auditPreview.wouldWriteAudit,
    false,
    "dry-run smoke F should not write audit events",
  );
  assert.ok(
    auditPreview.missingAuditEventIds.length > 0,
    "dry-run smoke F should represent missing audit event ids",
  );
  assert.equal(
    auditPreview.emittedAuditEventIds.length === 0 ||
      auditPreview.auditReference?.metadata?.inputDerivedOnly === true,
    true,
    "dry-run smoke F emitted audit ids should be empty or input-derived only",
  );
}

for (const verifierPreview of [safeVerifierPreview, verifierDryRunPreview]) {
  assert.equal(
    verifierPreview.verifierRequired,
    true,
    "dry-run smoke G should require verifier",
  );
  assert.equal(
    verifierPreview.wouldRunVerifier,
    false,
    "dry-run smoke G should not run verifier",
  );
  assert.notEqual(
    verifierPreview.verifierStatus,
    "verified",
    "dry-run smoke G verifier status should not be verified",
  );
  assert.equal(
    verifierPreview.verifierResultReference === undefined ||
      verifierPreview.verifierResultReference === null ||
      verifierPreview.verifierResultReference.metadata?.inputDerivedOnly === true,
    true,
    "dry-run smoke G verifier result reference should be absent unless input-derived",
  );
}

for (const resumePreview of [safeResumePreview, resumeDryRunPreview]) {
  assert.equal(
    resumePreview.wouldUpdateResume,
    false,
    "dry-run smoke H should not update resume state",
  );
  assert.ok(
    resumePreview.nextStepId,
    "dry-run smoke H should represent next step id",
  );
  assert.ok(
    resumePreview.nextBatchId,
    "dry-run smoke H should represent next batch id",
  );
  assert.ok(
    resumePreview.pendingWorkItemIds.length > 0,
    "dry-run smoke H should represent pending work item ids",
  );
  assert.ok(
    Array.isArray(resumePreview.retryableWorkItemIds),
    "dry-run smoke H should represent retryable work item ids",
  );
  assert.ok(
    resumePreview.updatedAt,
    "dry-run smoke H should expose updatedAt",
  );
}

const dryRunLogicResults = [
  logicSafeDryRunPreviewResult,
  logicApprovalRequiredDryRunResult,
  logicBlockedDryRunResult,
  logicSitemapDryRunResult,
];

for (const dryRunLogicResult of dryRunLogicResults) {
  assertDryRunResultShape(dryRunLogicResult);
  assertDryRunSummaryConsistent(dryRunLogicResult);
  assertDryRunSideEffectFree(dryRunLogicResult);
}

assert.equal(
  logicSafeDryRunPreviewResult.mode,
  "dry_run",
  "dry-run logic smoke A should represent dry-run mode",
);
assert.ok(
  ["preview_ready", "verification_required"].includes(
    logicSafeDryRunPreviewResult.state,
  ),
  "dry-run logic smoke A should be preview-ready or verification-required",
);
assert.ok(
  logicSafeDryRunPreviewResult.steps.length > 0,
  "dry-run logic smoke A should represent planned steps",
);
assert.ok(
  logicSafeDryRunPreviewResult.batches.length > 0,
  "dry-run logic smoke A should represent planned batches",
);
assert.ok(
  logicSafeDryRunPreviewResult.workItems.length > 0,
  "dry-run logic smoke A should represent planned work items",
);
assert.equal(
  logicSafeDryRunPreviewResult.steps.some(
    (step) => step.previewState === "completed",
  ),
  false,
  "dry-run logic smoke A should not produce completed step state",
);
assert.equal(
  logicSafeDryRunPreviewResult.workItems.some(
    (workItem) => workItem.previewState === "completed",
  ),
  false,
  "dry-run logic smoke A should not complete work items",
);
assert.equal(
  logicSafeDryRunPreviewResult.ok &&
    logicSafeDryRunPreviewResult.state === "completed",
  false,
  "dry-run logic smoke A ok/state must not imply real execution completion",
);
assert.deepEqual(
  logicSafeDryRunPreviewChecks,
  {
    state: logicSafeDryRunPreviewResult.state,
    stateRequiresVerification:
      logicSafeDryRunPreviewResult.state === "verification_required",
    adapterCallsWouldExecute: false,
    wouldWriteAudit: false,
    wouldRunVerifier: false,
    finalStateNotCompleted: true,
  },
  "dry-run logic smoke A exported checks should summarize safe preview behavior",
);

assert.equal(
  logicApprovalRequiredDryRunResult.state,
  "waiting_for_approval",
  "dry-run logic smoke B should wait for approval",
);
assert.ok(
  logicApprovalRequiredDryRunResult.steps.some(
    (step) => step.approvalRequired === true,
  ),
  "dry-run logic smoke B should represent approval requirement",
);
assert.ok(
  logicApprovalRequiredDryRunResult.adapterCalls.every(
    (adapterCall) => adapterCall.wouldCall === false,
  ),
  "dry-run logic smoke B adapter previews should have wouldCall false",
);
assert.equal(
  logicApprovalRequiredDryRunResult.audit.wouldWriteAudit,
  false,
  "dry-run logic smoke B should not write audit events",
);
assert.equal(
  logicApprovalRequiredDryRunResult.verifier.wouldRunVerifier,
  false,
  "dry-run logic smoke B should not run verifier",
);
assert.equal(
  logicApprovalRequiredDryRunResult.summary.processableWorkItems,
  0,
  "dry-run logic smoke B should not imply execution while approval is pending",
);
assert.deepEqual(
  logicApprovalRequiredDryRunChecks,
  {
    state: "waiting_for_approval",
    approvalRequiredRepresented: true,
    adapterCallsWouldExecute: false,
    verifierWouldRun: false,
  },
  "dry-run logic smoke B exported checks should summarize approval wait behavior",
);

assert.ok(
  ["blocked", "failed"].includes(logicBlockedDryRunResult.state),
  "dry-run logic smoke C should report blocked or failed state",
);
assert.ok(
  logicBlockedDryRunResult.issues.length > 0,
  "dry-run logic smoke C should include denied or blocked issues",
);
assert.ok(
  logicBlockedDryRunResult.issues.some(
    (issue) =>
      issue.code === "OPERATION_DENIED" ||
      issue.category === "policy_failure" ||
      issue.category === "dry_run_safety",
  ),
  "dry-run logic smoke C should represent denied or blocked condition",
);
assert.equal(
  logicBlockedDryRunResult.adapterCalls.some((adapterCall) => adapterCall.wouldCall),
  false,
  "dry-run logic smoke C should keep wouldCallAdapters false",
);
assert.equal(
  logicBlockedDryRunResult.audit.wouldWriteAudit,
  false,
  "dry-run logic smoke C should not write audit events",
);
assert.equal(
  logicBlockedDryRunResult.verifier.wouldRunVerifier,
  false,
  "dry-run logic smoke C should not run verifier",
);
assert.deepEqual(
  logicBlockedDryRunChecks,
  {
    state: logicBlockedDryRunResult.state,
    stateBlockedOrFailed: true,
    issueCount: logicBlockedDryRunResult.issues.length,
    adapterCallsWouldExecute: false,
    wouldWriteAudit: false,
    wouldRunVerifier: false,
  },
  "dry-run logic smoke C exported checks should summarize blocked behavior",
);

assert.equal(
  logicSitemapDryRunResult.taskId,
  "sitemap-audit",
  "dry-run logic smoke D should preserve sitemap task id",
);
assert.equal(
  logicSitemapDryRunResult.workItems.length,
  400,
  "dry-run logic smoke D should represent 400 planned work items",
);
assert.equal(
  logicSitemapDryRunResult.workItems.some(
    (workItem) => workItem.previewState === "completed",
  ),
  false,
  "dry-run logic smoke D completed work item count should remain zero",
);
assert.ok(
  logicSitemapDryRunResult.batches.length > 0,
  "dry-run logic smoke D should preview batches",
);
assert.equal(
  logicSitemapDryRunResult.verifier.verifierRequired,
  true,
  "dry-run logic smoke D should require verifier",
);
assert.equal(
  logicSitemapDryRunResult.verifier.wouldRunVerifier,
  false,
  "dry-run logic smoke D should not run verifier",
);
assert.notEqual(
  logicSitemapDryRunResult.state,
  "completed",
  "dry-run logic smoke D final state should not be completed",
);
assert.deepEqual(
  logicSitemapDryRunPreviewCounts,
  {
    plannedWorkItems: 400,
    completedWorkItems: 0,
    plannedBatches: logicSitemapDryRunResult.batches.length,
    verifierRequired: true,
    wouldRunVerifier: false,
    finalStateNotCompleted: true,
  },
  "dry-run logic smoke D exported counts should summarize sitemap preview behavior",
);

assert.ok(
  logicAdapterPreviewChecks.modelAdapterPreview,
  "dry-run logic smoke E should include a model adapter preview",
);
assert.ok(
  logicAdapterPreviewChecks.toolAdapterPreview,
  "dry-run logic smoke E should include a tool adapter preview",
);
assert.equal(
  logicAdapterPreviewChecks.wouldCallAdapters,
  false,
  "dry-run logic smoke E should not call adapters",
);
assert.equal(
  logicAdapterPreviewChecks.outputReferencesArePreviewOnly,
  true,
  "dry-run logic smoke E output references should be absent, null, or preview-only",
);
assert.equal(
  logicAdapterPreviewChecks.adaptersAreNotCompletionAuthority,
  true,
  "dry-run logic smoke E adapters should not be completion authority",
);
for (const adapterPreview of logicAdapterCallPreviews) {
  assert.equal(
    adapterPreview.wouldCall,
    false,
    "dry-run logic smoke E every adapter preview should have wouldCall false",
  );
  assert.equal(
    adapterPreview.outputReference === undefined ||
      adapterPreview.outputReference === null ||
      adapterPreview.metadata?.previewOnly === true,
    true,
    "dry-run logic smoke E adapter output should be absent, null, or preview-only",
  );
  assert.equal(
    adapterPreview.completionAuthority,
    false,
    "dry-run logic smoke E adapter previews are not completion authority",
  );
  assert.equal(
    adapterPreview.status === undefined || adapterPreview.status !== "completed",
    true,
    "dry-run logic smoke E adapter call status must not imply real completed task",
  );
}

assert.deepEqual(
  logicAuditPreviewChecks.expectedAuditEventIds,
  logicAuditPreview.expectedAuditEventIds,
  "dry-run logic smoke F expected audit ids should be represented",
);
assert.ok(
  logicAuditPreview.expectedAuditEventIds.includes("audit.input.accepted"),
  "dry-run logic smoke F should preserve expected audit event ids",
);
assert.equal(
  logicAuditPreview.emittedAuditEventIds.length === 0 ||
    logicAuditPreview.auditReference?.metadata?.inputDerivedOnly === true,
  true,
  "dry-run logic smoke F emitted audit ids should be empty or input-derived only",
);
assert.equal(
  logicAuditPreview.wouldWriteAudit,
  false,
  "dry-run logic smoke F should not write audit events",
);
assert.equal(
  logicAuditPreview.auditStatus !== "complete_from_input" ||
    logicAuditPreview.auditReference?.metadata?.inputDerivedOnly === true,
  true,
  "dry-run logic smoke F audit status must not imply runtime completion unless input-derived",
);
assert.equal(
  logicAuditPreviewChecks.wouldWriteAudit,
  false,
  "dry-run logic smoke F exported checks should keep audit writes disabled",
);

assert.equal(
  logicVerifierPreview.verifierRequired,
  true,
  "dry-run logic smoke G should represent verifier requirement",
);
assert.equal(
  logicVerifierPreview.wouldRunVerifier,
  false,
  "dry-run logic smoke G should not run verifier",
);
assert.notEqual(
  logicVerifierPreview.verifierStatus,
  "verified",
  "dry-run logic smoke G verifier status should not be verified",
);
assert.equal(
  logicVerifierPreview.verifierResultReference === undefined ||
    logicVerifierPreview.verifierResultReference === null ||
    logicVerifierPreview.verifierResultReference.metadata?.inputDerivedOnly === true,
  true,
  "dry-run logic smoke G verifier result reference should be absent unless input-derived",
);
assert.equal(
  logicVerifierPreview.completionGateSatisfied,
  false,
  "dry-run logic smoke G verifier preview cannot complete the dry-run",
);
assert.deepEqual(
  logicVerifierPreviewChecks,
  {
    verifierRequired: true,
    wouldRunVerifier: false,
    verifierStatusNotVerified: true,
    verifierResultReference: logicVerifierPreview.verifierResultReference,
  },
  "dry-run logic smoke G exported checks should summarize verifier preview behavior",
);

assert.ok(
  logicResumePreview,
  "dry-run logic smoke H should expose resume preview data",
);
assert.equal(
  logicResumePreviewChecks.nextStepId,
  "step-resume-002",
  "dry-run logic smoke H should represent deterministic next step id",
);
assert.equal(
  logicResumePreviewChecks.nextBatchId,
  "batch-resume-002",
  "dry-run logic smoke H should represent deterministic next batch id",
);
assert.deepEqual(
  logicResumePreviewChecks.pendingWorkItemIds,
  ["work-resume-002", "work-resume-003"],
  "dry-run logic smoke H pending work item ids should be deterministic",
);
assert.deepEqual(
  logicResumePreviewChecks.retryableWorkItemIds,
  ["work-resume-001"],
  "dry-run logic smoke H retryable work item ids should be deterministic",
);
assert.equal(
  logicResumePreviewChecks.wouldUpdateResume,
  false,
  "dry-run logic smoke H should not update resume state",
);

assert.equal(
  deterministicDryRunOutput.equivalent,
  true,
  "dry-run logic smoke I repeated dry-run output should be equivalent",
);
assert.deepEqual(
  deterministicDryRunOutput.first,
  deterministicDryRunOutput.second,
  "dry-run logic smoke I repeated dry-run output should deep-equal",
);
assert.deepEqual(
  deterministicDryRunOutput.first.steps.map((step) => step.stepId),
  deterministicDryRunOutput.second.steps.map((step) => step.stepId),
  "dry-run logic smoke I step ordering should be stable",
);
assert.deepEqual(
  deterministicDryRunOutput.first.batches.map((batch) => batch.batchId),
  deterministicDryRunOutput.second.batches.map((batch) => batch.batchId),
  "dry-run logic smoke I batch ordering should be stable",
);
assert.deepEqual(
  deterministicDryRunOutput.first.workItems.map((workItem) => workItem.workItemId),
  deterministicDryRunOutput.second.workItems.map((workItem) => workItem.workItemId),
  "dry-run logic smoke I work item ordering should be stable",
);
assert.deepEqual(
  deterministicDryRunOutput.first.adapterCalls.map(
    (adapterCall) => adapterCall.callId,
  ),
  deterministicDryRunOutput.second.adapterCalls.map(
    (adapterCall) => adapterCall.callId,
  ),
  "dry-run logic smoke I adapter call ordering should be stable",
);
assert.deepEqual(
  deterministicDryRunOutput.first.issues.map((issue) => issue.code),
  deterministicDryRunOutput.second.issues.map((issue) => issue.code),
  "dry-run logic smoke I issue ordering should be stable",
);
assert.deepEqual(
  deterministicDryRunOutput.first.summary,
  deterministicDryRunOutput.second.summary,
  "dry-run logic smoke I summary should be stable",
);

assertDryRunSummaryConsistent(logicSafeDryRunPreviewResult);
assertDryRunSummaryConsistent(logicApprovalRequiredDryRunResult);
assertDryRunSummaryConsistent(logicBlockedDryRunResult);
assertDryRunSummaryConsistent(logicSitemapDryRunResult);
assert.equal(
  summaryBehavior.plannedSteps,
  logicAdapterCallPreviews.length > 0 ? 1 : 0,
  "dry-run logic smoke J summary should represent planned steps",
);
assert.deepEqual(
  summaryBehaviorChecks,
  {
    plannedStepsMatchesArray: true,
    plannedBatchesMatchesArray: true,
    plannedWorkItemsMatchesArray: true,
    wouldCallAdapters: 0,
    wouldWriteAudit: false,
    wouldRunVerifier: false,
  },
  "dry-run logic smoke J exported summary checks should be honest",
);

assert.deepEqual(
  individualPreviewHelpers.steps,
  logicSafeDryRunPreviewResult.steps,
  "dry-run logic smoke K direct step helper should match result steps",
);
assert.deepEqual(
  individualPreviewHelpers.batches,
  logicSafeDryRunPreviewResult.batches,
  "dry-run logic smoke K direct batch helper should match result batches",
);
assert.deepEqual(
  individualPreviewHelpers.workItems,
  logicSafeDryRunPreviewResult.workItems,
  "dry-run logic smoke K direct work item helper should match result work items",
);
assert.deepEqual(
  individualPreviewHelpers.adapterCalls,
  logicSafeDryRunPreviewResult.adapterCalls,
  "dry-run logic smoke K direct adapter helper should match result adapter previews",
);
assert.deepEqual(
  individualPreviewHelpers.audit,
  logicSafeDryRunPreviewResult.audit,
  "dry-run logic smoke K direct audit helper should match result audit preview",
);
assert.deepEqual(
  individualPreviewHelpers.verifier,
  logicSafeDryRunPreviewResult.verifier,
  "dry-run logic smoke K direct verifier helper should match result verifier preview",
);
assert.deepEqual(
  individualPreviewHelpers.resume,
  logicSafeDryRunPreviewResult.resume,
  "dry-run logic smoke K direct resume helper should match result resume preview",
);
for (const dryRunLogicResult of dryRunLogicResults) {
  assert.equal(
    dryRunLogicResult.adapterCalls.some((adapterCall) => adapterCall.wouldCall),
    false,
    "dry-run logic smoke K should never represent actual adapter execution",
  );
  assert.equal(
    dryRunLogicResult.audit.wouldWriteAudit,
    false,
    "dry-run logic smoke K should never represent actual audit writes",
  );
  assert.equal(
    dryRunLogicResult.verifier.wouldRunVerifier,
    false,
    "dry-run logic smoke K should never represent actual verifier execution",
  );
  assert.equal(
    dryRunLogicResult.resume?.wouldUpdateResume ?? false,
    false,
    "dry-run logic smoke K should never represent lifecycle or resume mutation",
  );
  assert.equal(
    dryRunLogicResult.workItems.some(
      (workItem) => workItem.previewState === "completed",
    ),
    false,
    "dry-run logic smoke K should never complete work items",
  );
  assert.notEqual(
    dryRunLogicResult.state,
    "completed",
    "dry-run logic smoke K should never represent real completed state",
  );
}

const invalidBlockedDryRunResult = runAgenticRunnerDryRun({
  taskId: "invalid-blocked-preview",
  mode: "dry_run",
  runnerPlan: {
    kind: "data",
    data: {
      previewOnly: true,
    },
  },
  options: {
    requireAudit: true,
    requireVerifier: true,
    completionGatedByVerifier: true,
    maxWorkItems: 1,
  },
  policyPreview: {
    kind: "data",
    data: {
      status: "denied",
      decision: "denied",
    },
  },
  plannedSteps: [
    {
      stepId: "",
      stepKind: "batch_execution",
      previewState: "blocked",
      wouldRun: true,
      approvalRequired: false,
      plannedAdapterCallIds: ["missing-adapter-call"],
      expectedAuditEventIds: ["audit.invalid.expected"],
      verifierRequired: true,
      issues: [],
    },
  ],
  plannedBatches: [
    {
      batchId: "batch-invalid",
      workItemIds: ["work-invalid-002"],
      expectedItemCount: 2,
      previewState: "preview_ready",
      wouldRun: true,
      issues: [],
    },
  ],
  plannedWorkItems: [
    {
      workItemId: "work-invalid-001",
      batchId: "batch-invalid",
      previewState: "preview_ready",
      wouldProcess: true,
      issues: [],
    },
    {
      workItemId: "work-invalid-001",
      batchId: "batch-invalid",
      previewState: "preview_ready",
      wouldProcess: true,
      issues: [],
    },
  ],
  adapterCalls: [
    {
      callId: "adapter-invalid",
      kind: "tool",
      adapterId: "tool-adapter-preview",
      operation: "preview_tool_invocation",
      wouldCall: true,
      approvalRequired: false,
      issues: [],
      observationOnly: true,
      completionAuthority: false,
    },
  ],
  auditPreviewInput: {
    kind: "data",
    data: {
      expectedAuditEventIds: ["audit.invalid.expected"],
      wouldWriteAudit: true,
    },
  },
  verifierPreviewInput: {
    kind: "data",
    data: {
      verifierRequired: true,
      wouldRunVerifier: true,
      verifierStatus: "verified",
    },
  },
  resumePreviewInput: {
    kind: "data",
    data: {
      pendingWorkItemIds: ["work-invalid-001"],
      retryableWorkItemIds: ["work-invalid-002"],
      wouldUpdateResume: true,
    },
  },
});

assertDryRunResultShape(invalidBlockedDryRunResult);
assertDryRunSummaryConsistent(invalidBlockedDryRunResult);
assertDryRunSideEffectFree(invalidBlockedDryRunResult);
assert.notEqual(
  invalidBlockedDryRunResult.state,
  "completed",
  "dry-run logic smoke L invalid input should not complete",
);
assert.ok(
  invalidBlockedDryRunResult.issues.length > 0,
  "dry-run logic smoke L invalid input should expose issues",
);
assert.equal(
  invalidBlockedDryRunResult.summary.runnableSteps,
  0,
  "dry-run logic smoke L invalid input should not invent runnable steps",
);
assert.equal(
  invalidBlockedDryRunResult.summary.runnableBatches,
  0,
  "dry-run logic smoke L invalid input should not invent runnable batches",
);
assert.equal(
  invalidBlockedDryRunResult.summary.processableWorkItems,
  0,
  "dry-run logic smoke L invalid input should not invent processable work",
);
assert.equal(
  invalidBlockedDryRunResult.adapterCalls.some((adapterCall) => adapterCall.wouldCall),
  false,
  "dry-run logic smoke L invalid input should not call adapters",
);
assert.equal(
  invalidBlockedDryRunResult.audit.wouldWriteAudit,
  false,
  "dry-run logic smoke L invalid input should not write audit events",
);
assert.equal(
  invalidBlockedDryRunResult.verifier.wouldRunVerifier,
  false,
  "dry-run logic smoke L invalid input should not run verifier",
);
assert.equal(
  invalidBlockedDryRunResult.resume?.wouldUpdateResume,
  false,
  "dry-run logic smoke L invalid input should not mutate resume state",
);

const terminalPreviewDryRunResult = runAgenticRunnerDryRun({
  taskId: "terminal-preview-claims",
  mode: "dry_run",
  runnerPlan: {
    kind: "data",
    data: {
      previewOnly: true,
    },
  },
  options: {
    requireAudit: true,
    requireVerifier: true,
    completionGatedByVerifier: true,
  },
  plannedSteps: [
    {
      stepId: "step-terminal-completed-claim",
      stepKind: "batch_execution",
      previewState: "completed",
      wouldRun: true,
      approvalRequired: false,
      plannedAdapterCallIds: [],
      expectedAuditEventIds: ["audit.terminal.step.completed.expected"],
      verifierRequired: true,
      issues: [],
    },
    {
      stepId: "step-terminal-verified-claim",
      stepKind: "verification",
      previewState: "verified",
      wouldRun: true,
      approvalRequired: false,
      plannedAdapterCallIds: [],
      expectedAuditEventIds: ["audit.terminal.step.verified.expected"],
      verifierRequired: true,
      issues: [],
    },
  ],
  plannedBatches: [
    {
      batchId: "batch-terminal-completed-claim",
      workItemIds: ["work-terminal-completed-claim"],
      expectedItemCount: 1,
      previewState: "completed",
      wouldRun: true,
      issues: [],
    },
    {
      batchId: "batch-terminal-verified-claim",
      workItemIds: ["work-terminal-verified-claim"],
      expectedItemCount: 1,
      previewState: "verified",
      wouldRun: true,
      issues: [],
    },
  ],
  plannedWorkItems: [
    {
      workItemId: "work-terminal-completed-claim",
      batchId: "batch-terminal-completed-claim",
      previewState: "completed",
      wouldProcess: true,
      expectedArtifactIds: ["work-terminal-completed-claim.preview.json"],
      issues: [],
    },
    {
      workItemId: "work-terminal-verified-claim",
      batchId: "batch-terminal-verified-claim",
      previewState: "verified",
      wouldProcess: true,
      expectedArtifactIds: ["work-terminal-verified-claim.preview.json"],
      issues: [],
    },
  ],
  auditPreviewInput: {
    kind: "data",
    data: {
      expectedAuditEventIds: [
        "audit.terminal.batch.completed.expected",
        "audit.terminal.batch.verified.expected",
      ],
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
});

assertDryRunResultShape(terminalPreviewDryRunResult);
assertDryRunSummaryConsistent(terminalPreviewDryRunResult);
assertDryRunSideEffectFree(terminalPreviewDryRunResult);
assert.equal(
  terminalPreviewDryRunResult.ok,
  false,
  "dry-run logic smoke M terminal preview claims should fail closed",
);
assert.equal(
  terminalPreviewDryRunResult.state,
  "failed",
  "dry-run logic smoke M terminal preview claims should produce failed state",
);
assert.deepEqual(
  terminalPreviewDryRunResult.steps.map((step) => step.previewState),
  ["failed", "failed"],
  "dry-run logic smoke M completed and verified step previews should be sanitized",
);
assert.deepEqual(
  terminalPreviewDryRunResult.batches.map((batch) => batch.previewState),
  ["failed", "failed"],
  "dry-run logic smoke M completed and verified batch previews should be sanitized",
);
assert.deepEqual(
  terminalPreviewDryRunResult.workItems.map((workItem) => workItem.previewState),
  ["failed", "failed"],
  "dry-run logic smoke M completed and verified work item previews should be sanitized",
);
assert.equal(
  terminalPreviewDryRunResult.summary.runnableSteps,
  0,
  "dry-run logic smoke M terminal preview claims should not be runnable",
);
assert.equal(
  terminalPreviewDryRunResult.summary.runnableBatches,
  0,
  "dry-run logic smoke M terminal preview claims should not run batches",
);
assert.equal(
  terminalPreviewDryRunResult.summary.processableWorkItems,
  0,
  "dry-run logic smoke M terminal preview claims should not process work items",
);
assert.ok(
  terminalPreviewDryRunResult.issues.some(
    (issue) =>
      issue.code === "DRY_RUN_STEP_COMPLETION_STATE_FORBIDDEN" &&
      issue.stepId === "step-terminal-completed-claim",
  ),
  "dry-run logic smoke M should report forbidden completed step preview",
);
assert.ok(
  terminalPreviewDryRunResult.issues.some(
    (issue) =>
      issue.code === "DRY_RUN_STEP_COMPLETION_STATE_FORBIDDEN" &&
      issue.stepId === "step-terminal-verified-claim",
  ),
  "dry-run logic smoke M should report forbidden verified step preview",
);
assert.ok(
  terminalPreviewDryRunResult.issues.some(
    (issue) =>
      issue.code === "DRY_RUN_BATCH_COMPLETION_STATE_FORBIDDEN" &&
      issue.batchId === "batch-terminal-completed-claim",
  ),
  "dry-run logic smoke M should report forbidden completed batch preview",
);
assert.ok(
  terminalPreviewDryRunResult.issues.some(
    (issue) =>
      issue.code === "DRY_RUN_BATCH_COMPLETION_STATE_FORBIDDEN" &&
      issue.batchId === "batch-terminal-verified-claim",
  ),
  "dry-run logic smoke M should report forbidden verified batch preview",
);
assert.ok(
  terminalPreviewDryRunResult.issues.some(
    (issue) =>
      issue.code === "DRY_RUN_WORK_ITEM_COMPLETION_STATE_FORBIDDEN" &&
      issue.workItemId === "work-terminal-completed-claim",
  ),
  "dry-run logic smoke M should report forbidden completed work item preview",
);
assert.ok(
  terminalPreviewDryRunResult.issues.some(
    (issue) =>
      issue.code === "DRY_RUN_WORK_ITEM_COMPLETION_STATE_FORBIDDEN" &&
      issue.workItemId === "work-terminal-verified-claim",
  ),
  "dry-run logic smoke M should report forbidden verified work item preview",
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

const directEmptyExecutableWorkResult = planAgenticRunner({
  taskId: "empty-executable-work-plan",
  taskContract: createPlanningTaskContract("empty-executable-work-plan"),
  mode: "dry_run",
  options: {
    requireAudit: true,
    requireVerifier: true,
  },
  verifierRequirements: createVerifierRequirement("coverage-verifier-empty-work"),
  metadata: {
    allowedOperations: ["batch.execute"],
  },
});

assertDirectPlanningResultShape(directEmptyExecutableWorkResult);
assertDirectPlanningSummaryHonest(directEmptyExecutableWorkResult);
assertPlanningVerifierGateHonest(directEmptyExecutableWorkResult);
assert.equal(
  directEmptyExecutableWorkResult.ok,
  false,
  "planning logic smoke J should reject executable work planning without work items",
);
assert.deepEqual(
  directEmptyExecutableWorkResult.issues.map((issue) => issue.code),
  ["EXECUTABLE_WORK_ITEMS_MISSING"],
  "planning logic smoke J should report missing executable work deterministically",
);
assert.equal(
  directEmptyExecutableWorkResult.steps.some(
    (step) => step.kind === "batch_execution",
  ),
  false,
  "planning logic smoke J should not create batch execution steps for empty work",
);
assert.equal(
  directEmptyExecutableWorkResult.verifier.verifierRequired,
  true,
  "planning logic smoke J should still require verifier for executable planning modes",
);

const directExplicitZeroWorkItemsResult = planAgenticRunner({
  taskId: "explicit-zero-work-items-plan",
  taskContract: createPlanningTaskContract("explicit-zero-work-items-plan"),
  workItems: [],
  mode: "dry_run",
  options: {
    requireAudit: true,
    requireVerifier: true,
  },
  verifierRequirements: createVerifierRequirement(
    "coverage-verifier-explicit-zero-work",
  ),
  metadata: {
    allowedOperations: ["batch.execute"],
  },
});

assertDirectPlanningResultShape(directExplicitZeroWorkItemsResult);
assertDirectPlanningSummaryHonest(directExplicitZeroWorkItemsResult);
assertPlanningVerifierGateHonest(directExplicitZeroWorkItemsResult);
assert.equal(
  directExplicitZeroWorkItemsResult.ok,
  false,
  "planning logic smoke J2 should reject explicit zero executable work items",
);
assert.deepEqual(
  directExplicitZeroWorkItemsResult.issues.map((issue) => issue.code),
  ["EXECUTABLE_WORK_ITEMS_MISSING"],
  "planning logic smoke J2 should report explicit zero work items deterministically",
);
assert.equal(
  directExplicitZeroWorkItemsResult.steps.some(
    (step) => step.kind === "batch_execution",
  ),
  false,
  "planning logic smoke J2 should not create execution steps for explicit zero work items",
);

const directExplicitEmptyBatchesResult = planAgenticRunner({
  taskId: "explicit-empty-batches-plan",
  taskContract: createPlanningTaskContract("explicit-empty-batches-plan"),
  workItems: [createPlanningWorkItem("explicit-empty-batches-item")],
  batches: [],
  mode: "dry_run",
  options: {
    requireAudit: true,
    requireVerifier: true,
  },
  verifierRequirements: createVerifierRequirement(
    "coverage-verifier-explicit-empty-batches",
  ),
  metadata: {
    allowedOperations: ["batch.execute"],
  },
});

assertDirectPlanningResultShape(directExplicitEmptyBatchesResult);
assertDirectPlanningSummaryHonest(directExplicitEmptyBatchesResult);
assertPlanningVerifierGateHonest(directExplicitEmptyBatchesResult);
assert.equal(
  directExplicitEmptyBatchesResult.ok,
  false,
  "planning logic smoke J3 should reject explicit empty executable batches",
);
assert.deepEqual(
  directExplicitEmptyBatchesResult.issues.map((issue) => issue.code),
  ["EXECUTABLE_BATCHES_EMPTY"],
  "planning logic smoke J3 should report explicit empty batches deterministically",
);
assert.equal(
  directExplicitEmptyBatchesResult.batches.length,
  0,
  "planning logic smoke J3 should not synthesize a batch from explicit empty batches",
);
assert.equal(
  directExplicitEmptyBatchesResult.steps.some(
    (step) => step.kind === "batch_execution",
  ),
  false,
  "planning logic smoke J3 should not create execution steps for explicit empty batches",
);

const directEmptyBatchPlanningResult = planAgenticRunner({
  taskId: "empty-batch-plan",
  taskContract: createPlanningTaskContract("empty-batch-plan"),
  workItems: [createPlanningWorkItem("empty-batch-work-item")],
  batches: [createPlanningBatch("empty-batch", [])],
  mode: "plan",
  options: {
    requireAudit: true,
    requireVerifier: true,
  },
  verifierRequirements: createVerifierRequirement("coverage-verifier-empty-batch"),
});

assertDirectPlanningResultShape(directEmptyBatchPlanningResult);
assertDirectPlanningSummaryHonest(directEmptyBatchPlanningResult);
assertPlanningVerifierGateHonest(directEmptyBatchPlanningResult);
assert.equal(
  directEmptyBatchPlanningResult.ok,
  false,
  "planning logic smoke K should reject empty represented batches",
);
assert.deepEqual(
  directEmptyBatchPlanningResult.issues.map((issue) => issue.code),
  ["BATCH_WORK_ITEMS_EMPTY"],
  "planning logic smoke K should report empty batch issue deterministically",
);
assert.equal(
  directEmptyBatchPlanningResult.issues[0]?.batchId,
  "empty-batch",
  "planning logic smoke K should preserve empty batch id on issue",
);

const directMissingBatchWorkItemIdResult = planAgenticRunner({
  taskId: "missing-batch-work-item-id-plan",
  taskContract: createPlanningTaskContract("missing-batch-work-item-id-plan"),
  workItems: [createPlanningWorkItem("known-batch-work-item")],
  batches: [createPlanningBatch("batch-missing-item-id", [""])],
  mode: "plan",
  options: {
    requireAudit: true,
    requireVerifier: true,
  },
  verifierRequirements: createVerifierRequirement(
    "coverage-verifier-missing-batch-item-id",
  ),
});

assertDirectPlanningResultShape(directMissingBatchWorkItemIdResult);
assertDirectPlanningSummaryHonest(directMissingBatchWorkItemIdResult);
assertPlanningVerifierGateHonest(directMissingBatchWorkItemIdResult);
assert.equal(
  directMissingBatchWorkItemIdResult.ok,
  false,
  "planning logic smoke L should reject missing work item ids inside batches",
);
assert.deepEqual(
  directMissingBatchWorkItemIdResult.issues.map((issue) => issue.code),
  ["BATCH_REFERENCES_MISSING_WORK_ITEM", "BATCH_WORK_ITEM_ID_MISSING"],
  "planning logic smoke L should report missing batch work item id deterministically",
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
  directEmptyExecutableWorkResult,
  directExplicitZeroWorkItemsResult,
  directExplicitEmptyBatchesResult,
  directEmptyBatchPlanningResult,
  directMissingBatchWorkItemIdResult,
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
