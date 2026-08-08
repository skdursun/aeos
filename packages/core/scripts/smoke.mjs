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
  createTaskPlanFilePlannerWiringResult,
  createCliTaskPlanHumanRenderModel,
  createCliTaskPlanJsonRenderModel,
  createCliTaskPlanPlannerIntegrationResult,
  parseTaskPlanInputFile,
  mapTaskContractToRunnerPlanningInput,
  mapCliTaskPlanStatusToExitCode,
  planAgenticRunner,
  runAgenticRunnerDryRun,
  createInitialTaskState,
  createTaskResumeHandoff,
  evaluateTaskStateTransition,
  getTaskStateStoragePath,
  loadTaskResumeHandoff,
  loadTaskState,
  saveTaskState,
  summarizeCliTaskPlanPlannerIntegrationResult,
  transitionTaskState,
  transitionPersistedTaskState,
  updateTaskState,
  validatePersistedTaskState,
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
import {
  humanOutputShapeExample,
  jsonOnlyParserFailurePlannerWiringResultExample,
  jsonOutputShapeExample,
  mappingWithoutNoExecutionNoWritesPlannerWiringResultExample,
  mappingWithoutVerifierGatePlannerWiringResultExample,
  parserFailurePlannerWiringResultExample,
  plannerFailurePlannerWiringResultExample,
  safetyStageExplicitFalseFlagsExample,
  successfulMinimalPlannerWiringResultExample,
  summaryShapeExample,
  unsupportedMappingPlannerWiringResultExample,
  validationFailurePlannerWiringResultExample,
} from "../dist/task-plan-file-planner-wiring.example.js";
import {
  createScenarioNOptionalDependencyInjectedPlannerBehavior,
  scenarioASuccessfulMinimalPlanningHandoff,
  scenarioBParserFailureFailClosed,
  scenarioCValidationFailureFailClosed,
  scenarioDUnsupportedMappingFailClosed,
  scenarioEMissingVerifierGateFailClosed,
  scenarioFMissingNoExecutionNoWritesGateFailClosed,
  scenarioGPlannerFailureFailClosed,
  scenarioHSafetyStageCreation,
  scenarioIHumanOutputPayload,
  scenarioJJsonOutputPayload,
  scenarioKSummaryGeneration,
  scenarioLExitCodeMapping,
  scenarioMDeterministicOutput,
} from "../dist/task-plan-file-planner-wiring-logic.example.js";
import {
  cliTaskPlanPlannerIntegrationInputExample,
  cliTaskPlanPlannerIntegrationOptionsExample,
  scenarioASuccessfulCliTaskPlanIntegration,
  scenarioBJsonSuccessModel,
  scenarioCParserFailure,
  scenarioDValidationFailure,
  scenarioEUnsupportedMapping,
  scenarioFMissingRunnerPlanningInput,
  scenarioGMissingVerifierGate,
  scenarioHMissingNoExecutionNoWrites,
  scenarioIUnsafeRepresentedMetadata,
  scenarioJPlannerFailure,
  scenarioKHumanRenderModel,
  scenarioLJsonRenderModel,
  scenarioMJsonOnlyFailureBehavior,
  scenarioNSummaryShape,
  scenarioOExitCodeExamples,
  scenarioPSafetyStage,
} from "../dist/cli-task-plan-planner-integration.example.js";
import {
  cliTaskPlanPlannerIntegrationLogicExamples,
  scenarioASuccessfulCliTaskPlanIntegrationLogic as cliLogicScenarioA,
  scenarioASuccessfulCliTaskPlanIntegrationLogicChecks as cliLogicScenarioAChecks,
  scenarioBJsonSuccessBehavior as cliLogicScenarioB,
  scenarioBJsonSuccessBehaviorChecks as cliLogicScenarioBChecks,
  scenarioCParserFailure as cliLogicScenarioC,
  scenarioCParserFailureChecks as cliLogicScenarioCChecks,
  scenarioDValidationFailure as cliLogicScenarioD,
  scenarioDValidationFailureChecks as cliLogicScenarioDChecks,
  scenarioEUnsupportedMapping as cliLogicScenarioE,
  scenarioEUnsupportedMappingChecks as cliLogicScenarioEChecks,
  scenarioFMissingRunnerPlanningInput as cliLogicScenarioF,
  scenarioFMissingRunnerPlanningInputChecks as cliLogicScenarioFChecks,
  scenarioGMissingVerifierGate as cliLogicScenarioG,
  scenarioGMissingVerifierGateChecks as cliLogicScenarioGChecks,
  scenarioHMissingNoExecutionNoWrites as cliLogicScenarioH,
  scenarioHMissingNoExecutionNoWritesChecks as cliLogicScenarioHChecks,
  scenarioIUnsafeRepresentedMetadata as cliLogicScenarioI,
  scenarioIUnsafeRepresentedMetadataChecks as cliLogicScenarioIChecks,
  scenarioJPlannerFailure as cliLogicScenarioJ,
  scenarioJPlannerFailureChecks as cliLogicScenarioJChecks,
  scenarioKHumanRenderModel as cliLogicScenarioK,
  scenarioKHumanRenderModelFields as cliLogicScenarioKFields,
  scenarioLJsonRenderModel as cliLogicScenarioL,
  scenarioLJsonRenderModelFields as cliLogicScenarioLFields,
  scenarioMJsonOnlyFailureBehavior as cliLogicScenarioM,
  scenarioMJsonOnlyFailureBehaviorChecks as cliLogicScenarioMChecks,
  scenarioNSummaryGeneration as cliLogicScenarioN,
  scenarioNSummaryGenerationMatches as cliLogicScenarioNMatches,
  scenarioOExitCodeMapping as cliLogicScenarioO,
  scenarioPDeterministicOutput as cliLogicScenarioP,
  scenarioQDependencyInjectedPlannerBehavior as cliLogicScenarioQ,
} from "../dist/cli-task-plan-planner-integration-logic.example.js";

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

function createTaskContractMapperLogicSmokeTask(overrides = {}) {
  return {
    id: "TASK-0249-SMOKE",
    title: "Add task contract mapping logic smoke tests.",
    purpose: "Verify task contract mapper behavior without side effects.",
    status: "pending",
    executionMode: "planning",
    context: {
      load: [
        {
          path: "PROJECT_CONTEXT.md",
          required: true,
        },
        {
          path: "packages/core/src/task-contract-mapper.ts",
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
      filesNotToTouch: [
        "packages/core/src/task-contract-mapper.ts",
        "packages/core/src/task-contract-mapping.ts",
      ],
      allowGeneratedFiles: false,
      requireStopOnBoundaryConflict: true,
    },
    allowedOperations: [
      "read_context",
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
        instruction: "Add dependency-free mapper logic smoke tests.",
        required: true,
        expectedOutcome: "Mapper behavior is represented without execution.",
      },
    ],
    verification: [
      {
        command: "pnpm --filter @aeos/core smoke",
        level: "smoke_test",
        required: true,
        scope: ["packages/core/scripts/smoke.mjs"],
        expectedEvidence: ["Mapper logic smoke scenarios pass."],
      },
    ],
    stopCondition: {
      description: "Stop after TASK-0249 smoke tests and context update.",
      stopAfterCompletion: true,
    },
    modelRecommendation: {
      purpose: "Plan deterministic mapper smoke coverage.",
      requiredCapabilities: ["typescript", "static_analysis", "planning"],
      preferredExecutionMode: "planning",
      constraints: ["no_execution", "no_writes", "no_adapter_calls"],
    },
    ...overrides,
  };
}

function createTaskContractMapperLogicSmokeInput({
  task = createTaskContractMapperLogicSmokeTask(),
  mode = "plan",
  options = {},
  sourceFile = `TASKS/${task.id}.json`,
} = {}) {
  const validationResult = {
    taskId: task.id,
    status: "pass",
    valid: true,
    issues: [],
    fileBoundary: task.fileBoundary,
  };

  return {
    taskId: task.id,
    task,
    taskContract: {
      kind: "data",
      data: task,
      reference: {
        id: `task-contract:${task.id}`,
        path: sourceFile,
      },
    },
    sourceFile,
    mode,
    options: {
      allowSingleWorkItemFallback: true,
      requireExplicitWorkItems: false,
      requireVerifier: true,
      createDefaultBatch: true,
      createAuditExpectations: true,
      createPolicyBoundary: true,
      createAdapterBoundary: true,
      ...options,
    },
    validation: {
      status: "pass",
      valid: true,
      result: validationResult,
      reference: {
        id: `task-validation:${task.id}`,
        path: `TASKS/${task.id}.validation.json`,
      },
      issues: [],
    },
    noExecution: true,
    noWrites: true,
  };
}

function taskContractMapperLogicSignature(result) {
  return {
    ok: result.ok,
    taskId: result.taskId,
    mode: result.mode,
    status: result.status,
    sourceFile: result.sourceFile,
    workItemIds: result.workItems.map((workItem) => workItem.workItemId),
    batchIds: result.batches.map((batch) => batch.batchId),
    batchWorkItemIds: result.batches.map((batch) => batch.workItemIds),
    issueCodes: result.issues.map((issue) => issue.code),
    issueFields: result.issues.map((issue) => issue.field),
    summary: result.summary,
    handoffStatus: result.planningInput.handoffStatus,
    runnerPlanningExecuted: result.planningInput.runnerPlanningExecuted,
    taskPersistenceWritten: result.planningInput.taskPersistenceWritten,
  };
}

function assertTaskContractMappingNoCompletedState(result, message) {
  assert.equal(
    result.workItems.some((workItem) => workItem.initialState === "completed"),
    false,
    `${message} must not create completed work item mappings`,
  );
  assert.equal(
    result.planningInput.runnerPlanningInput?.workItems?.some(
      (workItem) => workItem.state === "completed",
    ) ?? false,
    false,
    `${message} must not create completed runner work items`,
  );
  assert.equal(
    result.planningInput.runnerPlanningInput?.batches?.some(
      (batch) => batch.completedCount > 0,
    ) ?? false,
    false,
    `${message} must not create completed batch counts`,
  );
  assert.notEqual(
    result.status,
    "completed",
    `${message} must not represent completed mapping status`,
  );
}

function assertTaskContractMappingNoRuntimeArtifacts(result, message) {
  assertTaskContractMappingSafety(result, message);
  assertTaskContractMappingNoCompletedState(result, message);
  assert.equal(
    Object.hasOwn(result, "taskParsingResult"),
    false,
    `${message} must not expose task parsing output`,
  );
  assert.equal(
    Object.hasOwn(result, "taskValidationResult"),
    false,
    `${message} must not expose task validation execution output`,
  );
  assert.equal(
    Object.hasOwn(result, "runnerExecutionResult"),
    false,
    `${message} must not expose runner execution result`,
  );
  assert.equal(
    Object.hasOwn(result, "persistence"),
    false,
    `${message} must not expose persistence output`,
  );
  assert.equal(
    Object.hasOwn(result, "adapterCalls"),
    false,
    `${message} must not expose adapter call output`,
  );

  const metadata = result.planningInput.runnerPlanningInput?.metadata ?? {};

  if (result.status === "mapped") {
    assert.equal(
      metadata.planAgenticRunnerExecuted,
      false,
      `${message} metadata must keep planAgenticRunner execution false`,
    );
    assert.equal(
      metadata.runnerExecutionStarted,
      false,
      `${message} metadata must keep runner execution false`,
    );
    assert.equal(
      metadata.adapterCallsMade,
      false,
      `${message} metadata must keep adapter calls false`,
    );
    assert.equal(
      metadata.auditEventsEmitted,
      false,
      `${message} metadata must keep audit writes false`,
    );
    assert.equal(
      metadata.verifierExecuted,
      false,
      `${message} metadata must keep verifier execution false`,
    );
    assert.equal(
      metadata.taskPersistenceWritten,
      false,
      `${message} metadata must keep persistence writes false`,
    );
    assert.equal(
      metadata.mappingNoCompletedState,
      true,
      `${message} metadata must represent no completed state`,
    );
  }
}

function assertWiringFields(value, fields, message) {
  for (const field of fields) {
    assert.ok(
      Object.hasOwn(value, field),
      `${message} should expose stable field ${field}`,
    );
  }
}

function assertWiringIssueRepresented(result, message) {
  assert.ok(result.issues.length > 0, `${message} should expose issues`);
  for (const issue of result.issues) {
    assert.equal(
      typeof issue.code,
      "string",
      `${message} issue should expose code`,
    );
    assert.ok(issue.code.length > 0, `${message} issue code should not be empty`);
    assert.equal(
      typeof issue.message,
      "string",
      `${message} issue should expose message`,
    );
    assert.ok(
      issue.message.length > 0,
      `${message} issue message should not be empty`,
    );
    assert.ok(
      ["error", "warning", "info", "critical"].includes(issue.severity),
      `${message} issue should expose known severity`,
    );
    assert.ok(
      [
        "input",
        "parse",
        "validation",
        "mapping",
        "planner",
        "safety",
        "output",
        "unknown",
      ].includes(issue.phase),
      `${message} issue should expose known phase`,
    );
  }
}

function assertWiringSideEffectFalseFields(value, message) {
  for (const field of [
    "executionEnabled",
    "adapterCalls",
    "auditWrites",
    "verifierRun",
    "persistence",
  ]) {
    if (Object.hasOwn(value, field)) {
      assert.equal(value[field], false, `${message} ${field} should be false`);
    }
  }
}

function assertWiringSafetyStageExplicit(result, message) {
  assertWiringSideEffectFalseFields(result.safety, `${message} safety`);
  assert.equal(
    result.safety.filesystemMutation,
    false,
    `${message} safety filesystemMutation should be false`,
  );
  assert.equal(
    result.safety.completedStateCreated,
    false,
    `${message} safety completedStateCreated should be false`,
  );
  assert.equal(
    result.safety.parserExecutedHere,
    false,
    `${message} safety parserExecutedHere should be false`,
  );
  assert.equal(
    result.safety.mapperExecutedHere,
    false,
    `${message} safety mapperExecutedHere should be false`,
  );
  assert.equal(
    result.safety.plannerExecutedHere,
    false,
    `${message} safety plannerExecutedHere should be false`,
  );
  assert.equal(
    result.safety.noExecution,
    true,
    `${message} safety noExecution should be true`,
  );
  assert.equal(
    result.safety.noWrites,
    true,
    `${message} safety noWrites should be true`,
  );
}

function assertWiringNoExecutionNoWriteResult(result, message) {
  assertWiringSafetyStageExplicit(result, message);
  assert.equal(
    result.mapping.noExecution,
    true,
    `${message} mapping noExecution should be explicit`,
  );
  assert.equal(
    result.mapping.noWrites,
    true,
    `${message} mapping noWrites should be explicit`,
  );
  assert.equal(
    result.summary.noExecution,
    true,
    `${message} summary noExecution should be explicit`,
  );
  assert.equal(
    result.summary.noWrites,
    true,
    `${message} summary noWrites should be explicit`,
  );
  assert.equal(
    result.summary.executionEnabled,
    false,
    `${message} summary executionEnabled should be false`,
  );
  assert.equal(
    result.summary.adapterCalls,
    false,
    `${message} summary adapterCalls should be false`,
  );
  assert.equal(
    result.summary.auditWrites,
    false,
    `${message} summary auditWrites should be false`,
  );
  assert.equal(
    result.summary.verifierRun,
    false,
    `${message} summary verifierRun should be false`,
  );
  assert.equal(
    result.summary.persistence,
    false,
    `${message} summary persistence should be false`,
  );
  assert.equal(
    result.summary.filesystemMutation,
    false,
    `${message} summary filesystemMutation should be false`,
  );
  assert.equal(
    result.summary.completedStateCreated,
    false,
    `${message} summary completedStateCreated should be false`,
  );
  assert.equal(
    result.planner.plannerExecuted,
    false,
    `${message} planner execution should be false`,
  );
}

function assertWiringSummaryHonest(result, message) {
  assert.equal(
    result.summary.parsed,
    result.parse.ok,
    `${message} summary parsed should match parse ok`,
  );
  assert.equal(
    result.summary.mapped,
    result.mapping.ok,
    `${message} summary mapped should match mapping ok`,
  );
  assert.equal(
    result.summary.planned,
    result.planner.ok,
    `${message} summary planned should match planner ok`,
  );
  assert.equal(
    result.summary.planStepCount,
    result.planner.planStepCount ?? 0,
    `${message} summary plan step count should match planner stage`,
  );
  assert.equal(
    result.summary.issueCount,
    result.issues.length,
    `${message} summary issue count should match issues array`,
  );
  const missingVerifierGateRepresented = result.issues.some(
    (issue) => issue.code === "cli_task_plan_verifier_gate_missing",
  );

  if (result.mapping.attempted && !missingVerifierGateRepresented) {
    assert.equal(
      result.summary.verifierRequired,
      result.mapping.verifierRequired,
      `${message} summary verifierRequired should match attempted mapping stage`,
    );
    assert.equal(
      result.summary.completionGatedByVerifier,
      result.mapping.completionGatedByVerifier,
      `${message} summary completion gate should match attempted mapping stage`,
    );
  }
  assert.equal(
    result.summary.mappingSupported,
    result.mapping.status === "mapped",
    `${message} summary mappingSupported should match mapping status`,
  );
  assert.equal(
    result.summary.planningInputAvailable,
    result.mapping.planningInputAvailable,
    `${message} summary planningInputAvailable should match mapping stage`,
  );
}

function assertPlannerNotAttempted(result, message) {
  assert.equal(
    result.planner.attempted,
    false,
    `${message} planner should not be attempted`,
  );
  assert.equal(result.planner.ok, false, `${message} planner should not be ok`);
  assert.equal(
    result.planner.status,
    "not_attempted",
    `${message} planner status should be not_attempted`,
  );
}

function assertWiringFailClosed(result, message) {
  assert.equal(result.ok, false, `${message} should fail closed`);
  assert.equal(
    result.safety.executionEnabled,
    false,
    `${message} safety execution should remain disabled`,
  );
  assert.equal(
    result.summary.executionEnabled,
    false,
    `${message} summary execution should remain disabled`,
  );
  assertWiringNoExecutionNoWriteResult(result, message);
  assertWiringIssueRepresented(result, message);
}

function assertNoRuntimeTruth(value, message) {
  const forbiddenTrueFields = new Set([
    "parserExecuted",
    "parserExecutedHere",
    "mapperExecuted",
    "mapperExecutedHere",
    "planAgenticRunnerExecuted",
    "plannerExecuted",
    "plannerExecutedHere",
    "runnerExecuted",
    "runnerExecutionHappened",
    "runnerExecutionStarted",
    "adapterCallHappened",
    "adapterCallsMade",
    "auditWriteHappened",
    "auditWritten",
    "auditEventsEmitted",
    "verifierExecuted",
    "verifierRun",
    "persistenceWritten",
    "taskPersistenceWritten",
    "filesystemMutation",
    "filesystemMutationHappened",
    "completedStateCreated",
  ]);

  const visit = (nestedValue, path = message) => {
    if (nestedValue === null || typeof nestedValue !== "object") {
      return;
    }

    if (Array.isArray(nestedValue)) {
      nestedValue.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }

    for (const [key, childValue] of Object.entries(nestedValue)) {
      assert.equal(
        !(forbiddenTrueFields.has(key) && childValue === true),
        true,
        `${path} must not imply ${key}`,
      );
      visit(childValue, `${path}.${key}`);
    }
  };

  visit(value);
}

function assertCliIssueRepresented(result, message) {
  assert.ok(result.issues.length > 0, `${message} should expose issues`);
  for (const issue of result.issues) {
    assert.equal(typeof issue.code, "string", `${message} issue code`);
    assert.ok(issue.code.length > 0, `${message} issue code should not be empty`);
    assert.equal(typeof issue.message, "string", `${message} issue message`);
    assert.ok(
      issue.message.length > 0,
      `${message} issue message should not be empty`,
    );
    assert.ok(
      ["error", "warning", "info", "critical"].includes(issue.severity),
      `${message} issue severity should be known`,
    );
    assert.ok(
      [
        "cli",
        "input",
        "parse",
        "validation",
        "mapping",
        "wiring",
        "planner",
        "safety",
        "output",
        "unknown",
      ].includes(issue.phase),
      `${message} issue phase should be known`,
    );
  }
}

function assertCliFields(value, fields, message) {
  for (const field of fields) {
    assert.ok(
      Object.hasOwn(value, field),
      `${message} should expose stable field ${field}`,
    );
  }
}

function assertCliSideEffectFalseFields(value, message) {
  for (const field of [
    "executionEnabled",
    "adapterCalls",
    "auditWrites",
    "verifierRun",
    "persistence",
    "filesystemMutation",
    "completedStateCreated",
  ]) {
    if (Object.hasOwn(value, field)) {
      assert.equal(value[field], false, `${message} ${field} should be false`);
    }
  }
}

function assertCliSafetyExplicit(result, message) {
  assertCliSideEffectFalseFields(result.safety, `${message} safety`);
  assert.equal(
    result.safety.noExecution,
    true,
    `${message} safety noExecution should be true`,
  );
  assert.equal(
    result.safety.noWrites,
    true,
    `${message} safety noWrites should be true`,
  );
  assert.equal(
    result.safety.dependencyInjectedPlannerOnly,
    true,
    `${message} safety should require dependency-injected planner`,
  );
  assert.equal(
    result.safety.topLevelPlannerInputBypassAllowed,
    false,
    `${message} safety should forbid top-level planner input bypass`,
  );
}

function assertCliNoExecutionNoWrites(result, message) {
  assertCliSafetyExplicit(result, message);
  assert.equal(
    result.mapping.noExecution,
    true,
    `${message} mapping noExecution should be explicit`,
  );
  assert.equal(
    result.mapping.noWrites,
    true,
    `${message} mapping noWrites should be explicit`,
  );
  assert.equal(
    result.summary.noExecution,
    true,
    `${message} summary noExecution should be explicit`,
  );
  assert.equal(
    result.summary.noWrites,
    true,
    `${message} summary noWrites should be explicit`,
  );
  assertCliSideEffectFalseFields(result.summary, `${message} summary`);
}

function assertCliPlannerNotAttempted(result, message) {
  assert.equal(
    result.planner.attempted,
    false,
    `${message} planner should not be attempted`,
  );
  assert.equal(result.planner.ok, false, `${message} planner should not be ok`);
  assert.equal(
    result.planner.status,
    "not_attempted",
    `${message} planner status should be not_attempted`,
  );
}

function assertCliSummaryHonest(result, message) {
  assert.equal(
    result.summary.parsed,
    result.parser.ok || result.parser.validationStatus === "fail",
    `${message} summary parsed should match represented parser stage`,
  );
  assert.equal(
    result.summary.mapped,
    result.mapping.ok,
    `${message} summary mapped should match mapping stage`,
  );
  assert.equal(
    result.summary.wired,
    result.wiring.ok,
    `${message} summary wired should match wiring stage`,
  );
  assert.equal(
    result.summary.planned,
    result.planner.ok && result.planner.status === "planned",
    `${message} summary planned should match planner stage`,
  );
  assert.equal(
    result.summary.planStepCount,
    result.planner.planStepCount ?? 0,
    `${message} summary step count should match planner stage`,
  );
  assert.equal(
    result.summary.issueCount,
    result.issues.length,
    `${message} summary issue count should match issues array`,
  );
  assert.equal(
    result.summary.json,
    result.jsonOnly.jsonRequested,
    `${message} summary json should match JSON option`,
  );
  assert.equal(
    result.summary.executionEnabled,
    result.safety.executionEnabled,
    `${message} summary executionEnabled should match safety`,
  );
  assert.equal(
    result.summary.adapterCalls,
    result.safety.adapterCalls,
    `${message} summary adapterCalls should match safety`,
  );
  assert.equal(
    result.summary.auditWrites,
    result.safety.auditWrites,
    `${message} summary auditWrites should match safety`,
  );
  assert.equal(
    result.summary.verifierRun,
    result.safety.verifierRun,
    `${message} summary verifierRun should match safety`,
  );
  assert.equal(
    result.summary.persistence,
    result.safety.persistence,
    `${message} summary persistence should match safety`,
  );
  assert.equal(
    result.summary.filesystemMutation,
    result.safety.filesystemMutation,
    `${message} summary filesystemMutation should match safety`,
  );
  assert.equal(
    result.summary.completedStateCreated,
    result.safety.completedStateCreated,
    `${message} summary completedStateCreated should match safety`,
  );
  const missingVerifierGateRepresented = result.issues.some(
    (issue) => issue.code === "cli_task_plan_verifier_gate_missing",
  );

  if (result.mapping.attempted && !missingVerifierGateRepresented) {
    assert.equal(
      result.summary.verifierRequired,
      result.mapping.verifierRequired,
      `${message} summary verifierRequired should match attempted mapping stage`,
    );
    assert.equal(
      result.summary.completionGatedByVerifier,
      result.mapping.completionGatedByVerifier,
      `${message} summary completion gate should match attempted mapping stage`,
    );
  }
  assert.equal(
    result.summary.runnerPlanningInputAvailable,
    result.mapping.runnerPlanningInputAvailable,
    `${message} summary runner planning input should match mapping stage`,
  );
  if (result.wiring.attempted) {
    assert.equal(
      result.summary.plannerDependencyInjected,
      result.wiring.plannerDependencyInjected,
      `${message} summary dependency injection should match attempted wiring stage`,
    );
    assert.equal(
      result.summary.plannerInvocationAllowed,
      result.wiring.plannerInvocationAllowed,
      `${message} summary planner allowance should match attempted wiring stage`,
    );
  }
}

function assertCliJsonOnlyBehavior(result, message) {
  assert.equal(result.jsonOnly.jsonRequested, true, `${message} JSON requested`);
  assert.equal(
    result.jsonOnly.suppressHumanOutput,
    true,
    `${message} human output should be suppressed`,
  );
  assert.equal(result.jsonOnly.validJsonOnly, true, `${message} JSON only`);
  assert.equal(
    result.jsonOnly.noProsePrefix,
    true,
    `${message} no prose prefix`,
  );
  assert.equal(
    result.jsonOnly.noProseSuffix,
    true,
    `${message} no prose suffix`,
  );
  assert.equal(
    result.jsonOnly.noStackTraces,
    true,
    `${message} no stack traces`,
  );
  assert.equal(
    result.jsonOnly.noRawEngineErrors,
    true,
    `${message} no raw engine errors`,
  );
  assert.equal(
    result.jsonOnly.deterministicIssues,
    true,
    `${message} deterministic issues`,
  );
  assert.ok(result.jsonOutput, `${message} should expose JSON output`);
}

function assertCliLogicSummaryMatchesResult(result, message) {
  const planningSummary = result.planner.planningResult?.summary;
  const mappingSummary = result.mapping.mappingResult?.summary;

  assert.equal(
    result.summary.parsed,
    result.parser.ok,
    `${message} summary parsed should match parser stage`,
  );
  assert.equal(
    result.summary.mapped,
    result.mapping.ok,
    `${message} summary mapped should match mapping stage`,
  );
  assert.equal(
    result.summary.wired,
    result.wiring.ok,
    `${message} summary wired should match wiring stage`,
  );
  assert.equal(
    result.summary.planned,
    result.planner.ok && result.planner.status === "planned",
    `${message} summary planned should match planner stage`,
  );
  assert.equal(
    result.summary.workItemCount,
    planningSummary?.workItemCount ?? mappingSummary?.workItemCount ?? 0,
    `${message} summary work item count should match represented stages`,
  );
  assert.equal(
    result.summary.batchCount,
    planningSummary?.batchCount ?? mappingSummary?.batchCount ?? 0,
    `${message} summary batch count should match represented stages`,
  );
  assert.equal(
    result.summary.planStepCount,
    result.planner.planStepCount ?? planningSummary?.stepCount ?? 0,
    `${message} summary plan step count should match represented stages`,
  );
  assert.equal(
    result.summary.issueCount,
    result.issues.length,
    `${message} summary issue count should match issues array`,
  );
  assert.equal(
    result.summary.json,
    result.jsonOnly.jsonRequested,
    `${message} summary json should match JSON mode`,
  );
  assert.equal(result.summary.noExecution, true, `${message} noExecution`);
  assert.equal(result.summary.noWrites, true, `${message} noWrites`);
  assert.equal(
    result.summary.executionEnabled,
    result.safety.executionEnabled,
    `${message} summary executionEnabled should match safety`,
  );
  assert.equal(
    result.summary.adapterCalls,
    result.safety.adapterCalls,
    `${message} summary adapterCalls should match safety`,
  );
  assert.equal(
    result.summary.auditWrites,
    result.safety.auditWrites,
    `${message} summary auditWrites should match safety`,
  );
  assert.equal(
    result.summary.verifierRun,
    result.safety.verifierRun,
    `${message} summary verifierRun should match safety`,
  );
  assert.equal(
    result.summary.persistence,
    result.safety.persistence,
    `${message} summary persistence should match safety`,
  );
  assert.equal(
    result.summary.filesystemMutation,
    result.safety.filesystemMutation,
    `${message} summary filesystemMutation should match safety`,
  );
  assert.equal(
    result.summary.completedStateCreated,
    result.safety.completedStateCreated,
    `${message} summary completedStateCreated should match safety`,
  );
  assert.equal(
    result.summary.verifierRequired,
    result.mapping.verifierRequired ||
      result.planner.planningResult?.verifier.verifierRequired === true,
    `${message} summary verifierRequired should match stages`,
  );
  assert.equal(
    result.summary.completionGatedByVerifier,
    result.mapping.completionGatedByVerifier ||
      result.planner.planningResult?.verifier.completionGatedByVerifier === true,
    `${message} summary completion gate should match stages`,
  );
  assert.equal(
    result.summary.runnerPlanningInputAvailable,
    result.mapping.runnerPlanningInputAvailable,
    `${message} summary runnerPlanningInputAvailable should match mapping stage`,
  );
  assert.equal(
    result.summary.plannerDependencyInjected,
    result.wiring.plannerDependencyInjected,
    `${message} summary plannerDependencyInjected should match wiring stage`,
  );
  assert.equal(
    result.summary.plannerInvocationAllowed,
    result.wiring.plannerInvocationAllowed,
    `${message} summary plannerInvocationAllowed should match wiring stage`,
  );
}

function assertCliLogicNoExecutionNoWrites(result, message) {
  assertCliNoExecutionNoWrites(result, message);
  assert.equal(
    result.safety.cliPlanCommandMayRunParserMapperWiringPlannerLater,
    true,
    `${message} should only represent later CLI planning capability`,
  );
  assert.equal(
    result.safety.dependencyInjectedPlannerOnly,
    true,
    `${message} should require dependency-injected planner`,
  );
  assert.equal(
    result.safety.topLevelPlannerInputBypassAllowed,
    false,
    `${message} should forbid top-level plannerInput bypass`,
  );
  assertNoRuntimeTruth(result, message);
}

function cliLogicResultSignature(result) {
  return {
    ok: result.ok,
    status: result.status,
    exitCode: result.exitCode,
    issueCodes: result.issues.map((issue) => issue.code),
    issueFields: result.issues.map((issue) => issue.field),
    summary: result.summary,
    safety: result.safety,
    plannerInvocationAllowed: result.wiring.plannerInvocationAllowed,
  };
}

function createCliLogicInputFromResult(result, overrides = {}) {
  return {
    taskFile: result.sourceFile,
    json: result.jsonOnly.jsonRequested,
    mode: result.mode,
    parserResult: result.parser.parserResult,
    parserResultReference: result.parser.parserResultReference,
    mappingResult: result.mapping.mappingResult,
    mappingResultReference: result.mapping.mappingResultReference,
    wiringResultReference: result.wiring.wiringResultReference,
    plannerDependencyReference: result.planner.plannerDependencyReference,
    noExecution: true,
    noWrites: true,
    ...overrides,
  };
}

function createCliLogicCountingPlanner(planningResult) {
  let callCount = 0;

  return {
    planner(input) {
      callCount += 1;

      return {
        ...planningResult,
        taskId: input.taskId,
        mode: input.mode,
      };
    },
    calls() {
      return callCount;
    },
  };
}

function assertWiringLogicSummaryMatchesResult(result, message) {
  const planningSummary = result.planner.planningResult?.summary;
  const mappingSummary = result.mapping.mappingResult?.summary;

  assert.equal(
    result.summary.parsed,
    result.parse.ok,
    `${message} summary parsed should match parse stage`,
  );
  assert.equal(
    result.summary.mapped,
    result.mapping.ok,
    `${message} summary mapped should match mapping stage`,
  );
  assert.equal(
    result.summary.planned,
    result.planner.ok && result.planner.status === "planned",
    `${message} summary planned should match planner stage`,
  );
  assert.equal(
    result.summary.workItemCount,
    planningSummary?.workItemCount ?? mappingSummary?.workItemCount ?? 0,
    `${message} summary work item count should match represented stages`,
  );
  assert.equal(
    result.summary.batchCount,
    planningSummary?.batchCount ?? mappingSummary?.batchCount ?? 0,
    `${message} summary batch count should match represented stages`,
  );
  assert.equal(
    result.summary.planStepCount,
    result.planner.planStepCount ?? planningSummary?.stepCount ?? 0,
    `${message} summary step count should match represented stages`,
  );
  assert.equal(
    result.summary.issueCount,
    result.issues.length,
    `${message} summary issue count should match issues array`,
  );
  assert.equal(
    result.summary.json,
    result.jsonOutput !== undefined,
    `${message} summary json should match output payload`,
  );
  assert.equal(result.summary.noExecution, true, `${message} noExecution`);
  assert.equal(result.summary.noWrites, true, `${message} noWrites`);
  assert.equal(
    result.summary.executionEnabled,
    result.safety.executionEnabled,
    `${message} summary executionEnabled should match safety`,
  );
  assert.equal(
    result.summary.adapterCalls,
    result.safety.adapterCalls,
    `${message} summary adapterCalls should match safety`,
  );
  assert.equal(
    result.summary.auditWrites,
    result.safety.auditWrites,
    `${message} summary auditWrites should match safety`,
  );
  assert.equal(
    result.summary.verifierRun,
    result.safety.verifierRun,
    `${message} summary verifierRun should match safety`,
  );
  assert.equal(
    result.summary.persistence,
    result.safety.persistence,
    `${message} summary persistence should match safety`,
  );
  assert.equal(
    result.summary.filesystemMutation,
    result.safety.filesystemMutation,
    `${message} summary filesystemMutation should match safety`,
  );
  assert.equal(
    result.summary.completedStateCreated,
    result.safety.completedStateCreated,
    `${message} summary completedStateCreated should match safety`,
  );
  assert.equal(
    result.summary.verifierRequired,
    result.mapping.verifierRequired ||
      result.planner.planningResult?.verifier.verifierRequired === true,
    `${message} summary verifierRequired should match stages`,
  );
  assert.equal(
    result.summary.completionGatedByVerifier,
    result.mapping.completionGatedByVerifier ||
      result.planner.planningResult?.verifier.completionGatedByVerifier === true,
    `${message} summary completion gate should match stages`,
  );
  assert.equal(
    result.summary.mappingSupported,
    result.mapping.status === "mapped",
    `${message} summary mappingSupported should match mapping status`,
  );
  assert.equal(
    result.summary.planningInputAvailable,
    result.mapping.planningInputAvailable,
    `${message} summary planningInputAvailable should match mapping stage`,
  );
}

function assertWiringLogicNoExecutionNoWrites(result, message) {
  assertWiringNoExecutionNoWriteResult(result, message);
  assert.equal(
    result.safety.adapterCalls,
    false,
    `${message} must not call adapters`,
  );
  assert.equal(
    result.safety.auditWrites,
    false,
    `${message} must not write audit events`,
  );
  assert.equal(
    result.safety.verifierRun,
    false,
    `${message} must not run verifier`,
  );
  assert.equal(
    result.safety.persistence,
    false,
    `${message} must not persist task state`,
  );
  assert.equal(
    result.safety.filesystemMutation,
    false,
    `${message} must not mutate filesystem`,
  );
  assert.equal(
    result.safety.completedStateCreated,
    false,
    `${message} must not create completed state`,
  );
  assert.equal(
    result.planner.plannerExecuted,
    false,
    `${message} must not mark direct planner execution`,
  );
  assertNoRuntimeTruth(result, message);
}

function assertStableWiringPayloadShape(left, right, message) {
  assert.deepEqual(
    Object.keys(left),
    Object.keys(right),
    `${message} result payload shape should be stable`,
  );

  if (left.jsonOutput !== undefined && right.jsonOutput !== undefined) {
    assert.deepEqual(
      Object.keys(left.jsonOutput),
      Object.keys(right.jsonOutput),
      `${message} JSON output payload shape should be stable`,
    );
  }

  if (left.humanOutput !== undefined && right.humanOutput !== undefined) {
    assert.deepEqual(
      Object.keys(left.humanOutput),
      Object.keys(right.humanOutput),
      `${message} human output payload shape should be stable`,
    );
  }
}

function createWiringInputFromResult(result, json = true) {
  return {
    taskFile: result.sourceFile,
    json,
    mode: result.mode,
    parserResult: result.parse.parserResult,
    mappingResult: result.mapping.mappingResult,
    noExecution: true,
    noWrites: true,
  };
}

assert.equal(
  successfulMinimalPlannerWiringResultExample.ok,
  true,
  "task plan file planner wiring smoke A should be ok",
);
assert.ok(
  ["planned"].includes(successfulMinimalPlannerWiringResultExample.status),
  "task plan file planner wiring smoke A should report successful status",
);
assert.equal(
  successfulMinimalPlannerWiringResultExample.exitCode,
  "success",
  "task plan file planner wiring smoke A should report success exit code",
);
assert.ok(
  successfulMinimalPlannerWiringResultExample.taskId,
  "task plan file planner wiring smoke A should represent task id",
);
assert.equal(
  successfulMinimalPlannerWiringResultExample.mode,
  "plan",
  "task plan file planner wiring smoke A should represent plan mode",
);
assert.equal(
  successfulMinimalPlannerWiringResultExample.parse.attempted,
  true,
  "task plan file planner wiring smoke A parser should be attempted",
);
assert.equal(
  successfulMinimalPlannerWiringResultExample.parse.ok,
  true,
  "task plan file planner wiring smoke A parser should be ok",
);
assert.equal(
  successfulMinimalPlannerWiringResultExample.parse.pathOk,
  true,
  "task plan file planner wiring smoke A path should be ok",
);
assert.equal(
  successfulMinimalPlannerWiringResultExample.parse.parseOk,
  true,
  "task plan file planner wiring smoke A parse should be ok",
);
assert.equal(
  successfulMinimalPlannerWiringResultExample.mapping.attempted,
  true,
  "task plan file planner wiring smoke A mapping should be attempted",
);
assert.equal(
  successfulMinimalPlannerWiringResultExample.mapping.ok,
  true,
  "task plan file planner wiring smoke A mapping should be ok",
);
assert.equal(
  successfulMinimalPlannerWiringResultExample.mapping.planningInputAvailable,
  true,
  "task plan file planner wiring smoke A planning input should be available",
);
assertWiringFields(
  successfulMinimalPlannerWiringResultExample.planner,
  [
    "attempted",
    "ok",
    "status",
    "planningInput",
    "planningInputReference",
    "planningResultReference",
    "planStepCount",
    "plannerExecuted",
    "issues",
  ],
  "task plan file planner wiring smoke A planner stage",
);
assert.equal(
  successfulMinimalPlannerWiringResultExample.mapping.verifierRequired,
  true,
  "task plan file planner wiring smoke A should require verifier",
);
assert.equal(
  successfulMinimalPlannerWiringResultExample.mapping.completionGatedByVerifier,
  true,
  "task plan file planner wiring smoke A should gate completion by verifier",
);
assertWiringNoExecutionNoWriteResult(
  successfulMinimalPlannerWiringResultExample,
  "task plan file planner wiring smoke A",
);
assertWiringSummaryHonest(
  successfulMinimalPlannerWiringResultExample,
  "task plan file planner wiring smoke A",
);

assert.equal(
  parserFailurePlannerWiringResultExample.ok,
  false,
  "task plan file planner wiring smoke B should not be ok",
);
assert.equal(
  parserFailurePlannerWiringResultExample.status,
  "parser_failed",
  "task plan file planner wiring smoke B should report parser_failed",
);
assert.equal(
  parserFailurePlannerWiringResultExample.exitCode,
  "parser_failure",
  "task plan file planner wiring smoke B should report parser failure exit code",
);
assert.equal(
  parserFailurePlannerWiringResultExample.parse.attempted,
  true,
  "task plan file planner wiring smoke B parser should be attempted",
);
assert.equal(
  parserFailurePlannerWiringResultExample.parse.ok,
  false,
  "task plan file planner wiring smoke B parser should fail",
);
assert.equal(
  parserFailurePlannerWiringResultExample.mapping.attempted,
  false,
  "task plan file planner wiring smoke B mapping should not be attempted",
);
assertPlannerNotAttempted(
  parserFailurePlannerWiringResultExample,
  "task plan file planner wiring smoke B",
);
assert.equal(
  parserFailurePlannerWiringResultExample.mapping.planningInputAvailable,
  false,
  "task plan file planner wiring smoke B planning input should be unavailable",
);
assert.equal(
  parserFailurePlannerWiringResultExample.safety.executionEnabled,
  false,
  "task plan file planner wiring smoke B execution should remain disabled",
);
assert.equal(
  parserFailurePlannerWiringResultExample.summary.noWrites,
  true,
  "task plan file planner wiring smoke B noWrites should remain explicit",
);
assertWiringIssueRepresented(
  parserFailurePlannerWiringResultExample,
  "task plan file planner wiring smoke B",
);

assert.equal(
  validationFailurePlannerWiringResultExample.ok,
  false,
  "task plan file planner wiring smoke C should not be ok",
);
assert.equal(
  validationFailurePlannerWiringResultExample.status,
  "validation_failed",
  "task plan file planner wiring smoke C should report validation_failed",
);
assert.equal(
  validationFailurePlannerWiringResultExample.exitCode,
  "validation_failure",
  "task plan file planner wiring smoke C should report validation failure exit code",
);
assert.equal(
  validationFailurePlannerWiringResultExample.parse.parseOk,
  true,
  "task plan file planner wiring smoke C parse can be ok",
);
assert.equal(
  validationFailurePlannerWiringResultExample.parse.validationCompatible,
  false,
  "task plan file planner wiring smoke C validation compatibility should fail",
);
assert.equal(
  validationFailurePlannerWiringResultExample.parse.validationStatus,
  "fail",
  "task plan file planner wiring smoke C validation status should fail",
);
assert.equal(
  validationFailurePlannerWiringResultExample.mapping.attempted,
  false,
  "task plan file planner wiring smoke C mapping should not be attempted",
);
assertPlannerNotAttempted(
  validationFailurePlannerWiringResultExample,
  "task plan file planner wiring smoke C",
);
assertWiringFailClosed(
  validationFailurePlannerWiringResultExample,
  "task plan file planner wiring smoke C",
);

assert.equal(
  unsupportedMappingPlannerWiringResultExample.ok,
  false,
  "task plan file planner wiring smoke D should not be ok",
);
assert.equal(
  unsupportedMappingPlannerWiringResultExample.status,
  "unsupported_mapping",
  "task plan file planner wiring smoke D should report unsupported_mapping",
);
assert.equal(
  unsupportedMappingPlannerWiringResultExample.exitCode,
  "unsupported_mapping",
  "task plan file planner wiring smoke D should report unsupported mapping exit code",
);
assert.equal(
  unsupportedMappingPlannerWiringResultExample.mapping.attempted,
  true,
  "task plan file planner wiring smoke D mapping should be attempted",
);
assert.equal(
  unsupportedMappingPlannerWiringResultExample.mapping.ok,
  false,
  "task plan file planner wiring smoke D mapping should not be ok",
);
assert.equal(
  unsupportedMappingPlannerWiringResultExample.mapping.status,
  "unsupported",
  "task plan file planner wiring smoke D mapping status should be unsupported",
);
assert.equal(
  unsupportedMappingPlannerWiringResultExample.mapping.planningInputAvailable,
  false,
  "task plan file planner wiring smoke D planning input should be unavailable",
);
assertPlannerNotAttempted(
  unsupportedMappingPlannerWiringResultExample,
  "task plan file planner wiring smoke D",
);
assert.notEqual(
  unsupportedMappingPlannerWiringResultExample.status,
  "planned",
  "task plan file planner wiring smoke D should not fake success",
);
assertWiringIssueRepresented(
  unsupportedMappingPlannerWiringResultExample,
  "task plan file planner wiring smoke D",
);

assert.equal(
  mappingWithoutVerifierGatePlannerWiringResultExample.ok,
  false,
  "task plan file planner wiring smoke E should not be ok",
);
assert.ok(
  ["mapping_failed", "blocked"].includes(
    mappingWithoutVerifierGatePlannerWiringResultExample.status,
  ),
  "task plan file planner wiring smoke E should report blocked mapping status",
);
assertPlannerNotAttempted(
  mappingWithoutVerifierGatePlannerWiringResultExample,
  "task plan file planner wiring smoke E",
);
assert.equal(
  mappingWithoutVerifierGatePlannerWiringResultExample.mapping.verifierRequired,
  false,
  "task plan file planner wiring smoke E should represent missing verifier requirement",
);
assert.equal(
  mappingWithoutVerifierGatePlannerWiringResultExample.mapping
    .completionGatedByVerifier,
  false,
  "task plan file planner wiring smoke E should represent missing completion gate",
);
assertWiringFailClosed(
  mappingWithoutVerifierGatePlannerWiringResultExample,
  "task plan file planner wiring smoke E",
);

assert.equal(
  mappingWithoutNoExecutionNoWritesPlannerWiringResultExample.ok,
  false,
  "task plan file planner wiring smoke F should not be ok",
);
assert.ok(
  ["mapping_failed", "blocked"].includes(
    mappingWithoutNoExecutionNoWritesPlannerWiringResultExample.status,
  ),
  "task plan file planner wiring smoke F should report blocked mapping status",
);
assertPlannerNotAttempted(
  mappingWithoutNoExecutionNoWritesPlannerWiringResultExample,
  "task plan file planner wiring smoke F",
);
assert.equal(
  mappingWithoutNoExecutionNoWritesPlannerWiringResultExample.mapping
    .failClosedWithoutNoExecution,
  true,
  "task plan file planner wiring smoke F should represent missing noExecution",
);
assert.equal(
  mappingWithoutNoExecutionNoWritesPlannerWiringResultExample.mapping
    .failClosedWithoutNoWrites,
  true,
  "task plan file planner wiring smoke F should represent missing noWrites",
);
assert.equal(
  mappingWithoutNoExecutionNoWritesPlannerWiringResultExample.issues[0].metadata
    .sourceNoExecution,
  false,
  "task plan file planner wiring smoke F issue should represent source noExecution false",
);
assert.equal(
  mappingWithoutNoExecutionNoWritesPlannerWiringResultExample.issues[0].metadata
    .sourceNoWrites,
  false,
  "task plan file planner wiring smoke F issue should represent source noWrites false",
);
assert.equal(
  mappingWithoutNoExecutionNoWritesPlannerWiringResultExample.safety
    .executionEnabled,
  false,
  "task plan file planner wiring smoke F execution should remain disabled",
);
assert.equal(
  mappingWithoutNoExecutionNoWritesPlannerWiringResultExample.safety
    .filesystemMutation,
  false,
  "task plan file planner wiring smoke F filesystem mutation should remain false",
);
assertWiringFailClosed(
  mappingWithoutNoExecutionNoWritesPlannerWiringResultExample,
  "task plan file planner wiring smoke F",
);

assert.equal(
  plannerFailurePlannerWiringResultExample.parse.ok,
  true,
  "task plan file planner wiring smoke G parser should be ok",
);
assert.equal(
  plannerFailurePlannerWiringResultExample.mapping.ok,
  true,
  "task plan file planner wiring smoke G mapping should be ok",
);
assert.equal(
  plannerFailurePlannerWiringResultExample.mapping.planningInputAvailable,
  true,
  "task plan file planner wiring smoke G planning input should be available",
);
assert.equal(
  plannerFailurePlannerWiringResultExample.planner.attempted,
  true,
  "task plan file planner wiring smoke G planner should be attempted",
);
assert.equal(
  plannerFailurePlannerWiringResultExample.planner.ok,
  false,
  "task plan file planner wiring smoke G planner should fail",
);
assert.equal(
  plannerFailurePlannerWiringResultExample.status,
  "planner_failed",
  "task plan file planner wiring smoke G should report planner_failed",
);
assert.equal(
  plannerFailurePlannerWiringResultExample.exitCode,
  "planner_failure",
  "task plan file planner wiring smoke G should report planner failure exit code",
);
assert.equal(
  plannerFailurePlannerWiringResultExample.safety.executionEnabled,
  false,
  "task plan file planner wiring smoke G execution should remain disabled",
);
assertWiringIssueRepresented(
  plannerFailurePlannerWiringResultExample,
  "task plan file planner wiring smoke G",
);

assertWiringFields(
  humanOutputShapeExample,
  [
    "title",
    "taskId",
    "sourceFile",
    "mode",
    "parsed",
    "mapping",
    "planning",
    "workItems",
    "batches",
    "steps",
    "policy",
    "approvalRequired",
    "verifierRequired",
    "completionGatedByVerifier",
    "auditExpected",
    "realExecution",
    "adapterCalls",
    "auditWrites",
    "verifierRun",
    "persistence",
    "issues",
  ],
  "task plan file planner wiring smoke H human output",
);
assertWiringSideEffectFalseFields(
  humanOutputShapeExample,
  "task plan file planner wiring smoke H human output",
);
assert.equal(
  humanOutputShapeExample.realExecution,
  false,
  "task plan file planner wiring smoke H real execution should be false",
);

assertWiringFields(
  jsonOutputShapeExample,
  [
    "ok",
    "status",
    "exitCode",
    "taskId",
    "mode",
    "sourceFile",
    "parse",
    "mapping",
    "plan",
    "policy",
    "verifier",
    "audit",
    "resume",
    "executionEnabled",
    "adapterCalls",
    "auditWrites",
    "verifierRun",
    "persistence",
    "issues",
    "summary",
  ],
  "task plan file planner wiring smoke I JSON output",
);
assertWiringSideEffectFalseFields(
  jsonOutputShapeExample,
  "task plan file planner wiring smoke I JSON output",
);

assertWiringFields(
  summaryShapeExample,
  [
    "parsed",
    "mapped",
    "planned",
    "workItemCount",
    "batchCount",
    "planStepCount",
    "issueCount",
    "json",
    "noExecution",
    "noWrites",
    "executionEnabled",
    "adapterCalls",
    "auditWrites",
    "verifierRun",
    "persistence",
    "filesystemMutation",
    "completedStateCreated",
    "verifierRequired",
    "completionGatedByVerifier",
    "mappingSupported",
    "planningInputAvailable",
  ],
  "task plan file planner wiring smoke J summary",
);
assertWiringSummaryHonest(
  successfulMinimalPlannerWiringResultExample,
  "task plan file planner wiring smoke J",
);
assert.equal(
  successfulMinimalPlannerWiringResultExample.summary.issueCount,
  successfulMinimalPlannerWiringResultExample.issues.length,
  "task plan file planner wiring smoke J issue count should match issues",
);

assertWiringSideEffectFalseFields(
  safetyStageExplicitFalseFlagsExample,
  "task plan file planner wiring smoke K safety stage",
);
assert.equal(
  safetyStageExplicitFalseFlagsExample.filesystemMutation,
  false,
  "task plan file planner wiring smoke K filesystemMutation should be false",
);
assert.equal(
  safetyStageExplicitFalseFlagsExample.completedStateCreated,
  false,
  "task plan file planner wiring smoke K completedStateCreated should be false",
);
assert.equal(
  safetyStageExplicitFalseFlagsExample.noExecution,
  true,
  "task plan file planner wiring smoke K noExecution should be true",
);
assert.equal(
  safetyStageExplicitFalseFlagsExample.noWrites,
  true,
  "task plan file planner wiring smoke K noWrites should be true",
);

assert.equal(
  jsonOnlyParserFailurePlannerWiringResultExample.summary.json,
  true,
  "task plan file planner wiring smoke L should represent json output",
);
assert.ok(
  jsonOnlyParserFailurePlannerWiringResultExample.jsonOutput,
  "task plan file planner wiring smoke L should include json output",
);
assert.equal(
  jsonOnlyParserFailurePlannerWiringResultExample.ok,
  false,
  "task plan file planner wiring smoke L should not be ok",
);
assert.equal(
  jsonOnlyParserFailurePlannerWiringResultExample.exitCode,
  "parser_failure",
  "task plan file planner wiring smoke L should report parser failure exit code",
);
assert.equal(
  jsonOnlyParserFailurePlannerWiringResultExample.parse.ok,
  false,
  "task plan file planner wiring smoke L should represent parser failure",
);
assert.equal(
  Object.hasOwn(jsonOnlyParserFailurePlannerWiringResultExample, "humanOutput"),
  false,
  "task plan file planner wiring smoke L should not require success human prose",
);
assert.equal(
  jsonOnlyParserFailurePlannerWiringResultExample.safety.executionEnabled,
  false,
  "task plan file planner wiring smoke L execution should remain disabled",
);

for (const [message, result] of [
  ["task plan file planner wiring smoke M parser failed", parserFailurePlannerWiringResultExample],
  [
    "task plan file planner wiring smoke M validation failed",
    validationFailurePlannerWiringResultExample,
  ],
  [
    "task plan file planner wiring smoke M unsupported mapping",
    unsupportedMappingPlannerWiringResultExample,
  ],
  [
    "task plan file planner wiring smoke M planning input unavailable",
    mappingWithoutNoExecutionNoWritesPlannerWiringResultExample,
  ],
  [
    "task plan file planner wiring smoke M verifier gate missing",
    mappingWithoutVerifierGatePlannerWiringResultExample,
  ],
  [
    "task plan file planner wiring smoke M noExecution/noWrites missing",
    mappingWithoutNoExecutionNoWritesPlannerWiringResultExample,
  ],
]) {
  assertPlannerNotAttempted(result, message);
}

for (const [message, result] of [
  [
    "task plan file planner wiring smoke N success",
    successfulMinimalPlannerWiringResultExample,
  ],
  ["task plan file planner wiring smoke N parser failure", parserFailurePlannerWiringResultExample],
  [
    "task plan file planner wiring smoke N validation failure",
    validationFailurePlannerWiringResultExample,
  ],
  [
    "task plan file planner wiring smoke N unsupported mapping",
    unsupportedMappingPlannerWiringResultExample,
  ],
  [
    "task plan file planner wiring smoke N missing verifier gate",
    mappingWithoutVerifierGatePlannerWiringResultExample,
  ],
  [
    "task plan file planner wiring smoke N missing noExecution/noWrites",
    mappingWithoutNoExecutionNoWritesPlannerWiringResultExample,
  ],
  ["task plan file planner wiring smoke N planner failure", plannerFailurePlannerWiringResultExample],
  [
    "task plan file planner wiring smoke N json parser failure",
    jsonOnlyParserFailurePlannerWiringResultExample,
  ],
]) {
  assertNoRuntimeTruth(result, message);
}

console.log("task plan file planner wiring contract smoke tests passed");

assert.equal(
  scenarioASuccessfulMinimalPlanningHandoff.parse.ok,
  true,
  "task plan file planner wiring logic smoke A parser stage should be ok",
);
assert.equal(
  scenarioASuccessfulMinimalPlanningHandoff.mapping.ok,
  true,
  "task plan file planner wiring logic smoke A mapping stage should be ok",
);
assert.equal(
  scenarioASuccessfulMinimalPlanningHandoff.mapping.planningInputAvailable,
  true,
  "task plan file planner wiring logic smoke A planning input should be available",
);
assert.equal(
  scenarioASuccessfulMinimalPlanningHandoff.mapping.noExecution,
  true,
  "task plan file planner wiring logic smoke A noExecution should be true",
);
assert.equal(
  scenarioASuccessfulMinimalPlanningHandoff.mapping.noWrites,
  true,
  "task plan file planner wiring logic smoke A noWrites should be true",
);
assert.equal(
  scenarioASuccessfulMinimalPlanningHandoff.mapping.verifierRequired,
  true,
  "task plan file planner wiring logic smoke A should require verifier",
);
assert.equal(
  scenarioASuccessfulMinimalPlanningHandoff.mapping.completionGatedByVerifier,
  true,
  "task plan file planner wiring logic smoke A should gate completion by verifier",
);
assertWiringLogicNoExecutionNoWrites(
  scenarioASuccessfulMinimalPlanningHandoff,
  "task plan file planner wiring logic smoke A",
);
assert.equal(
  scenarioASuccessfulMinimalPlanningHandoff.ok,
  true,
  "task plan file planner wiring logic smoke A should be ok",
);
assert.ok(
  ["planned"].includes(scenarioASuccessfulMinimalPlanningHandoff.status),
  "task plan file planner wiring logic smoke A status should be planned",
);
assert.equal(
  scenarioASuccessfulMinimalPlanningHandoff.exitCode,
  "success",
  "task plan file planner wiring logic smoke A exit code should be success",
);

assert.equal(
  scenarioBParserFailureFailClosed.parse.attempted,
  true,
  "task plan file planner wiring logic smoke B parser should be attempted",
);
assert.equal(
  scenarioBParserFailureFailClosed.parse.ok,
  false,
  "task plan file planner wiring logic smoke B parser should fail",
);
assert.equal(
  scenarioBParserFailureFailClosed.mapping.attempted,
  false,
  "task plan file planner wiring logic smoke B mapping should not be attempted",
);
assertPlannerNotAttempted(
  scenarioBParserFailureFailClosed,
  "task plan file planner wiring logic smoke B",
);
assert.equal(
  scenarioBParserFailureFailClosed.ok,
  false,
  "task plan file planner wiring logic smoke B should fail closed",
);
assert.equal(
  scenarioBParserFailureFailClosed.status,
  "parser_failed",
  "task plan file planner wiring logic smoke B should report parser_failed",
);
assert.equal(
  scenarioBParserFailureFailClosed.exitCode,
  "parser_failure",
  "task plan file planner wiring logic smoke B exit code should be parser_failure",
);
assert.equal(
  scenarioBParserFailureFailClosed.safety.executionEnabled,
  false,
  "task plan file planner wiring logic smoke B execution should be disabled",
);
assertWiringIssueRepresented(
  scenarioBParserFailureFailClosed,
  "task plan file planner wiring logic smoke B",
);

assert.equal(
  scenarioCValidationFailureFailClosed.parse.ok,
  false,
  "task plan file planner wiring logic smoke C parse stage should fail validation",
);
assert.equal(
  scenarioCValidationFailureFailClosed.parse.parseOk,
  true,
  "task plan file planner wiring logic smoke C parsing should be ok",
);
assert.equal(
  scenarioCValidationFailureFailClosed.parse.validationCompatible,
  false,
  "task plan file planner wiring logic smoke C validation compatibility should fail",
);
assert.equal(
  scenarioCValidationFailureFailClosed.parse.validationStatus,
  "fail",
  "task plan file planner wiring logic smoke C validation status should fail",
);
assert.equal(
  scenarioCValidationFailureFailClosed.mapping.attempted,
  false,
  "task plan file planner wiring logic smoke C mapping should not be attempted",
);
assertPlannerNotAttempted(
  scenarioCValidationFailureFailClosed,
  "task plan file planner wiring logic smoke C",
);
assert.equal(
  scenarioCValidationFailureFailClosed.ok,
  false,
  "task plan file planner wiring logic smoke C should fail closed",
);
assert.equal(
  scenarioCValidationFailureFailClosed.status,
  "validation_failed",
  "task plan file planner wiring logic smoke C should report validation_failed",
);
assert.equal(
  scenarioCValidationFailureFailClosed.exitCode,
  "validation_failure",
  "task plan file planner wiring logic smoke C exit code should be validation_failure",
);
assert.equal(
  scenarioCValidationFailureFailClosed.safety.executionEnabled,
  false,
  "task plan file planner wiring logic smoke C execution should be disabled",
);
assertWiringIssueRepresented(
  scenarioCValidationFailureFailClosed,
  "task plan file planner wiring logic smoke C",
);

assert.equal(
  scenarioDUnsupportedMappingFailClosed.mapping.attempted,
  true,
  "task plan file planner wiring logic smoke D mapping should be attempted",
);
assert.equal(
  scenarioDUnsupportedMappingFailClosed.mapping.ok,
  false,
  "task plan file planner wiring logic smoke D mapping should fail",
);
assert.equal(
  scenarioDUnsupportedMappingFailClosed.mapping.status,
  "unsupported",
  "task plan file planner wiring logic smoke D should represent unsupported mapping",
);
assert.equal(
  scenarioDUnsupportedMappingFailClosed.mapping.planningInputAvailable,
  false,
  "task plan file planner wiring logic smoke D planning input should be unavailable",
);
assertPlannerNotAttempted(
  scenarioDUnsupportedMappingFailClosed,
  "task plan file planner wiring logic smoke D",
);
assert.equal(
  scenarioDUnsupportedMappingFailClosed.ok,
  false,
  "task plan file planner wiring logic smoke D should fail closed",
);
assert.equal(
  scenarioDUnsupportedMappingFailClosed.status,
  "unsupported_mapping",
  "task plan file planner wiring logic smoke D should report unsupported_mapping",
);
assert.equal(
  scenarioDUnsupportedMappingFailClosed.exitCode,
  "unsupported_mapping",
  "task plan file planner wiring logic smoke D exit code should be unsupported_mapping",
);
assert.notEqual(
  scenarioDUnsupportedMappingFailClosed.status,
  "planned",
  "task plan file planner wiring logic smoke D should not fake success",
);
assertWiringIssueRepresented(
  scenarioDUnsupportedMappingFailClosed,
  "task plan file planner wiring logic smoke D",
);

assert.equal(
  scenarioEMissingVerifierGateFailClosed.mapping.verifierRequired === false ||
    scenarioEMissingVerifierGateFailClosed.mapping.completionGatedByVerifier ===
      false,
  true,
  "task plan file planner wiring logic smoke E should represent missing verifier gate",
);
assertPlannerNotAttempted(
  scenarioEMissingVerifierGateFailClosed,
  "task plan file planner wiring logic smoke E",
);
assert.equal(
  scenarioEMissingVerifierGateFailClosed.ok,
  false,
  "task plan file planner wiring logic smoke E should fail closed",
);
assert.ok(
  ["mapping_failed", "blocked"].includes(
    scenarioEMissingVerifierGateFailClosed.status,
  ),
  "task plan file planner wiring logic smoke E should be blocked or mapping_failed",
);
assert.equal(
  scenarioEMissingVerifierGateFailClosed.safety.executionEnabled,
  false,
  "task plan file planner wiring logic smoke E execution should be disabled",
);
assertWiringIssueRepresented(
  scenarioEMissingVerifierGateFailClosed,
  "task plan file planner wiring logic smoke E",
);

assert.equal(
  scenarioFMissingNoExecutionNoWritesGateFailClosed.mapping
    .failClosedWithoutNoExecution ||
    scenarioFMissingNoExecutionNoWritesGateFailClosed.mapping
      .failClosedWithoutNoWrites,
  true,
  "task plan file planner wiring logic smoke F should represent missing noExecution/noWrites gate",
);
assertPlannerNotAttempted(
  scenarioFMissingNoExecutionNoWritesGateFailClosed,
  "task plan file planner wiring logic smoke F",
);
assert.equal(
  scenarioFMissingNoExecutionNoWritesGateFailClosed.ok,
  false,
  "task plan file planner wiring logic smoke F should fail closed",
);
assert.ok(
  ["mapping_failed", "blocked"].includes(
    scenarioFMissingNoExecutionNoWritesGateFailClosed.status,
  ),
  "task plan file planner wiring logic smoke F should be blocked or mapping_failed",
);
assert.equal(
  scenarioFMissingNoExecutionNoWritesGateFailClosed.safety.executionEnabled,
  false,
  "task plan file planner wiring logic smoke F execution should be disabled",
);
assert.equal(
  scenarioFMissingNoExecutionNoWritesGateFailClosed.safety.filesystemMutation,
  false,
  "task plan file planner wiring logic smoke F filesystem mutation should be false",
);
assertWiringIssueRepresented(
  scenarioFMissingNoExecutionNoWritesGateFailClosed,
  "task plan file planner wiring logic smoke F",
);

assert.equal(
  scenarioGPlannerFailureFailClosed.parse.ok,
  true,
  "task plan file planner wiring logic smoke G parser should be ok",
);
assert.equal(
  scenarioGPlannerFailureFailClosed.mapping.ok,
  true,
  "task plan file planner wiring logic smoke G mapping should be ok",
);
assert.equal(
  scenarioGPlannerFailureFailClosed.mapping.planningInputAvailable,
  true,
  "task plan file planner wiring logic smoke G planning input should be available",
);
assert.equal(
  scenarioGPlannerFailureFailClosed.planner.attempted,
  true,
  "task plan file planner wiring logic smoke G planner should be attempted",
);
assert.equal(
  scenarioGPlannerFailureFailClosed.planner.ok,
  false,
  "task plan file planner wiring logic smoke G planner should fail",
);
assert.equal(
  scenarioGPlannerFailureFailClosed.ok,
  false,
  "task plan file planner wiring logic smoke G should fail closed",
);
assert.equal(
  scenarioGPlannerFailureFailClosed.status,
  "planner_failed",
  "task plan file planner wiring logic smoke G should report planner_failed",
);
assert.equal(
  scenarioGPlannerFailureFailClosed.exitCode,
  "planner_failure",
  "task plan file planner wiring logic smoke G exit code should be planner_failure",
);
assert.equal(
  scenarioGPlannerFailureFailClosed.safety.executionEnabled,
  false,
  "task plan file planner wiring logic smoke G execution should be disabled",
);
assertWiringIssueRepresented(
  scenarioGPlannerFailureFailClosed,
  "task plan file planner wiring logic smoke G",
);

assertWiringFields(
  scenarioHSafetyStageCreation,
  [
    "executionEnabled",
    "adapterCalls",
    "auditWrites",
    "verifierRun",
    "persistence",
    "filesystemMutation",
    "completedStateCreated",
    "noExecution",
    "noWrites",
  ],
  "task plan file planner wiring logic smoke H safety stage",
);
assert.equal(
  scenarioHSafetyStageCreation.executionEnabled,
  false,
  "task plan file planner wiring logic smoke H executionEnabled should be false",
);
assert.equal(
  scenarioHSafetyStageCreation.adapterCalls,
  false,
  "task plan file planner wiring logic smoke H adapterCalls should be false",
);
assert.equal(
  scenarioHSafetyStageCreation.auditWrites,
  false,
  "task plan file planner wiring logic smoke H auditWrites should be false",
);
assert.equal(
  scenarioHSafetyStageCreation.verifierRun,
  false,
  "task plan file planner wiring logic smoke H verifierRun should be false",
);
assert.equal(
  scenarioHSafetyStageCreation.persistence,
  false,
  "task plan file planner wiring logic smoke H persistence should be false",
);
assert.equal(
  scenarioHSafetyStageCreation.filesystemMutation,
  false,
  "task plan file planner wiring logic smoke H filesystemMutation should be false",
);
assert.equal(
  scenarioHSafetyStageCreation.completedStateCreated,
  false,
  "task plan file planner wiring logic smoke H completedStateCreated should be false",
);
assert.equal(
  scenarioHSafetyStageCreation.noExecution,
  true,
  "task plan file planner wiring logic smoke H noExecution should be true",
);
assert.equal(
  scenarioHSafetyStageCreation.noWrites,
  true,
  "task plan file planner wiring logic smoke H noWrites should be true",
);

assertWiringFields(
  scenarioIHumanOutputPayload,
  [
    "title",
    "taskId",
    "sourceFile",
    "mode",
    "parsed",
    "mapping",
    "planning",
    "workItems",
    "batches",
    "steps",
    "policy",
    "approvalRequired",
    "verifierRequired",
    "completionGatedByVerifier",
    "auditExpected",
    "realExecution",
    "adapterCalls",
    "auditWrites",
    "verifierRun",
    "persistence",
    "issues",
  ],
  "task plan file planner wiring logic smoke I human output",
);
assert.equal(
  scenarioIHumanOutputPayload.realExecution,
  false,
  "task plan file planner wiring logic smoke I realExecution should be false",
);
assertWiringSideEffectFalseFields(
  scenarioIHumanOutputPayload,
  "task plan file planner wiring logic smoke I human output",
);

assertWiringFields(
  scenarioJJsonOutputPayload,
  [
    "ok",
    "status",
    "exitCode",
    "taskId",
    "mode",
    "sourceFile",
    "parse",
    "mapping",
    "plan",
    "policy",
    "verifier",
    "audit",
    "resume",
    "executionEnabled",
    "adapterCalls",
    "auditWrites",
    "verifierRun",
    "persistence",
    "issues",
    "summary",
  ],
  "task plan file planner wiring logic smoke J JSON output",
);
assertWiringSideEffectFalseFields(
  scenarioJJsonOutputPayload,
  "task plan file planner wiring logic smoke J JSON output",
);

assertWiringFields(
  scenarioKSummaryGeneration,
  [
    "parsed",
    "mapped",
    "planned",
    "workItemCount",
    "batchCount",
    "planStepCount",
    "issueCount",
    "json",
    "noExecution",
    "noWrites",
    "executionEnabled",
    "adapterCalls",
    "auditWrites",
    "verifierRun",
    "persistence",
    "filesystemMutation",
    "completedStateCreated",
    "verifierRequired",
    "completionGatedByVerifier",
    "mappingSupported",
    "planningInputAvailable",
  ],
  "task plan file planner wiring logic smoke K summary",
);
assert.deepEqual(
  scenarioKSummaryGeneration,
  scenarioASuccessfulMinimalPlanningHandoff.summary,
  "task plan file planner wiring logic smoke K summary should match result summary",
);
assertWiringLogicSummaryMatchesResult(
  scenarioASuccessfulMinimalPlanningHandoff,
  "task plan file planner wiring logic smoke K",
);

assert.deepEqual(
  scenarioLExitCodeMapping,
  {
    planned: "success",
    parser_failed: "parser_failure",
    validation_failed: "validation_failure",
    unsupported_mapping: "unsupported_mapping",
    mapping_failed: "mapping_failure",
    planner_failed: "planner_failure",
    blocked: "blocked",
    failed: "unknown_failure",
    unknown: "unknown_failure",
  },
  "task plan file planner wiring logic smoke L exit code mapping should remain stable",
);

const deterministicPlanner = () =>
  scenarioASuccessfulMinimalPlanningHandoff.planner.planningResult;
const deterministicInput = createWiringInputFromResult(
  scenarioASuccessfulMinimalPlanningHandoff,
);
const deterministicFirst = createTaskPlanFilePlannerWiringResult(
  deterministicInput,
  {
    planner: deterministicPlanner,
    planningResultReference:
      scenarioASuccessfulMinimalPlanningHandoff.planner.planningResultReference,
  },
);
const deterministicSecond = createTaskPlanFilePlannerWiringResult(
  deterministicInput,
  {
    planner: deterministicPlanner,
    planningResultReference:
      scenarioASuccessfulMinimalPlanningHandoff.planner.planningResultReference,
  },
);

assert.deepEqual(
  deterministicFirst,
  deterministicSecond,
  "task plan file planner wiring logic smoke M repeated result should be equivalent",
);
assert.deepEqual(
  deterministicFirst.issues.map((issue) => issue.code),
  deterministicSecond.issues.map((issue) => issue.code),
  "task plan file planner wiring logic smoke M issue ordering should be stable",
);
assert.deepEqual(
  deterministicFirst.summary,
  deterministicSecond.summary,
  "task plan file planner wiring logic smoke M summary should be stable",
);
assert.deepEqual(
  deterministicFirst.safety,
  deterministicSecond.safety,
  "task plan file planner wiring logic smoke M safety flags should be stable",
);
assertStableWiringPayloadShape(
  deterministicFirst,
  deterministicSecond,
  "task plan file planner wiring logic smoke M",
);
assert.deepEqual(
  scenarioMDeterministicOutput.sameSummary,
  scenarioMDeterministicOutput.repeatedSummary,
  "task plan file planner wiring logic smoke M exported summary should be stable",
);
assert.equal(
  scenarioMDeterministicOutput.sameOk &&
    scenarioMDeterministicOutput.sameStatus &&
    scenarioMDeterministicOutput.sameExitCode &&
    scenarioMDeterministicOutput.sameTaskId &&
    scenarioMDeterministicOutput.adapterCallsRemainFalse &&
    scenarioMDeterministicOutput.filesystemMutationRemainsFalse,
  true,
  "task plan file planner wiring logic smoke M exported deterministic flags should be stable",
);

const injectedPlannerScenario =
  createScenarioNOptionalDependencyInjectedPlannerBehavior();

assert.equal(
  injectedPlannerScenario.plannerInvokedOnlyAfterGatesPass,
  true,
  "task plan file planner wiring logic smoke N exported fake planner should be gated",
);
assert.equal(
  injectedPlannerScenario.directPlanAgenticRunnerCall,
  false,
  "task plan file planner wiring logic smoke N should not direct-call planAgenticRunner",
);
assert.equal(
  injectedPlannerScenario.planned.planner.attempted,
  true,
  "task plan file planner wiring logic smoke N fake planner should run after gates pass",
);
assert.equal(
  injectedPlannerScenario.callsAfterSuccessfulGate,
  1,
  "task plan file planner wiring logic smoke N fake planner should be called once on success",
);
assert.equal(
  injectedPlannerScenario.callsAfterParserFailedGate,
  1,
  "task plan file planner wiring logic smoke N fake planner should not run for parser failure",
);
assert.equal(
  injectedPlannerScenario.callsAfterBlockedGate,
  1,
  "task plan file planner wiring logic smoke N fake planner should not run for missing verifier gate",
);

let injectedPlannerCalls = 0;
const injectedPlanner = (input) => {
  injectedPlannerCalls += 1;
  return {
    ...scenarioASuccessfulMinimalPlanningHandoff.planner.planningResult,
    taskId: input.taskId,
  };
};
const injectedPlannerOptions = {
  planner: injectedPlanner,
  planningResultReference:
    scenarioASuccessfulMinimalPlanningHandoff.planner.planningResultReference,
};

createTaskPlanFilePlannerWiringResult(
  createWiringInputFromResult(scenarioASuccessfulMinimalPlanningHandoff),
  injectedPlannerOptions,
);
assert.equal(
  injectedPlannerCalls,
  1,
  "task plan file planner wiring logic smoke N fake planner should run after all gates pass",
);
createTaskPlanFilePlannerWiringResult(
  createWiringInputFromResult(scenarioBParserFailureFailClosed),
  injectedPlannerOptions,
);
assert.equal(
  injectedPlannerCalls,
  1,
  "task plan file planner wiring logic smoke N fake planner should not run for parser failure",
);
createTaskPlanFilePlannerWiringResult(
  createWiringInputFromResult(scenarioDUnsupportedMappingFailClosed),
  injectedPlannerOptions,
);
assert.equal(
  injectedPlannerCalls,
  1,
  "task plan file planner wiring logic smoke N fake planner should not run for unsupported mapping",
);
createTaskPlanFilePlannerWiringResult(
  createWiringInputFromResult(scenarioEMissingVerifierGateFailClosed),
  injectedPlannerOptions,
);
assert.equal(
  injectedPlannerCalls,
  1,
  "task plan file planner wiring logic smoke N fake planner should not run for missing verifier gate",
);

function createWiringInputWithRunnerPlanningInput(
  runnerPlanningInputOverrides,
  mappingResultOverrides = {},
) {
  const base = createWiringInputFromResult(
    scenarioASuccessfulMinimalPlanningHandoff,
  );
  const mappingResult = base.mappingResult;
  const runnerPlanningInput = mappingResult.planningInput.runnerPlanningInput;

  return {
    ...base,
    mappingResult: {
      ...mappingResult,
      ...mappingResultOverrides,
      planningInput: {
        ...mappingResult.planningInput,
        runnerPlanningInput: {
          ...runnerPlanningInput,
          ...runnerPlanningInputOverrides,
          metadata: {
            ...runnerPlanningInput.metadata,
            noExecution: true,
            noWrites: true,
            ...runnerPlanningInputOverrides.metadata,
          },
          verifierRequirements: {
            ...runnerPlanningInput.verifierRequirements,
            ...runnerPlanningInputOverrides.verifierRequirements,
          },
        },
        runnerPlanningInputData: undefined,
      },
    },
  };
}

function assertBlockedAuthoritativeWiringProof(
  result,
  plannerCallsBefore,
  plannerCallsAfter,
  issueFields,
  message,
) {
  assert.equal(
    plannerCallsAfter,
    plannerCallsBefore,
    `${message} planner should not be invoked`,
  );
  assert.equal(result.ok, false, `${message} should fail closed`);
  assert.equal(result.status, "blocked", `${message} should report blocked`);
  assertPlannerNotAttempted(result, message);
  for (const field of issueFields) {
    assert.equal(
      result.issues.some((issue) => issue.field === field),
      true,
      `${message} should report deterministic issue for ${field}`,
    );
  }
  assertWiringLogicNoExecutionNoWrites(result, message);
}

const authoritativeVerifierOuterTrueCallsBefore = injectedPlannerCalls;
const authoritativeVerifierOuterTrueResult = createTaskPlanFilePlannerWiringResult(
  createWiringInputWithRunnerPlanningInput(
    {
      verifierRequirements: {
        verifierRequired: false,
        completionGatedByVerifier: false,
      },
    },
    {
      verifier: {
        ...scenarioASuccessfulMinimalPlanningHandoff.mapping.mappingResult
          .verifier,
        verifierRequired: true,
        completionGatedByVerifier: true,
      },
      summary: {
        ...scenarioASuccessfulMinimalPlanningHandoff.mapping.mappingResult
          .summary,
        verifierRequired: true,
        completionGatedByVerifier: true,
      },
    },
  ),
  injectedPlannerOptions,
);
assertBlockedAuthoritativeWiringProof(
  authoritativeVerifierOuterTrueResult,
  authoritativeVerifierOuterTrueCallsBefore,
  injectedPlannerCalls,
  ["mapping.verifierRequired", "mapping.completionGatedByVerifier"],
  "task plan file planner wiring logic smoke N2 authoritative verifier false with outer true",
);

const authoritativeVerifierMissingCallsBefore = injectedPlannerCalls;
const authoritativeVerifierMissingResult = createTaskPlanFilePlannerWiringResult(
  createWiringInputWithRunnerPlanningInput(
    {
      verifierRequirements: {
        verifierRequired: undefined,
        completionGatedByVerifier: undefined,
      },
    },
    {
      verifier: {
        ...scenarioASuccessfulMinimalPlanningHandoff.mapping.mappingResult
          .verifier,
        verifierRequired: true,
        completionGatedByVerifier: true,
      },
      summary: {
        ...scenarioASuccessfulMinimalPlanningHandoff.mapping.mappingResult
          .summary,
        verifierRequired: true,
        completionGatedByVerifier: true,
      },
    },
  ),
  injectedPlannerOptions,
);
assertBlockedAuthoritativeWiringProof(
  authoritativeVerifierMissingResult,
  authoritativeVerifierMissingCallsBefore,
  injectedPlannerCalls,
  ["mapping.verifierRequired", "mapping.completionGatedByVerifier"],
  "task plan file planner wiring logic smoke N3 authoritative verifier proof missing",
);

const authoritativeNoExecutionMissingCallsBefore = injectedPlannerCalls;
const authoritativeNoExecutionMissingResult =
  createTaskPlanFilePlannerWiringResult(
    createWiringInputWithRunnerPlanningInput({
      metadata: {
        noExecution: undefined,
        noWrites: true,
      },
    }),
    injectedPlannerOptions,
  );
assertBlockedAuthoritativeWiringProof(
  authoritativeNoExecutionMissingResult,
  authoritativeNoExecutionMissingCallsBefore,
  injectedPlannerCalls,
  ["mapping.noExecution"],
  "task plan file planner wiring logic smoke N4 authoritative noExecution proof missing",
);

const authoritativeNoWritesMissingCallsBefore = injectedPlannerCalls;
const authoritativeNoWritesMissingResult =
  createTaskPlanFilePlannerWiringResult(
    createWiringInputWithRunnerPlanningInput({
      metadata: {
        noExecution: true,
        noWrites: undefined,
      },
    }),
    injectedPlannerOptions,
  );
assertBlockedAuthoritativeWiringProof(
  authoritativeNoWritesMissingResult,
  authoritativeNoWritesMissingCallsBefore,
  injectedPlannerCalls,
  ["mapping.noWrites"],
  "task plan file planner wiring logic smoke N5 authoritative noWrites proof missing",
);

createTaskPlanFilePlannerWiringResult(
  createWiringInputFromResult(scenarioFMissingNoExecutionNoWritesGateFailClosed),
  injectedPlannerOptions,
);
assert.equal(
  injectedPlannerCalls,
  1,
  "task plan file planner wiring logic smoke N fake planner should not run for missing noExecution/noWrites",
);

const topLevelPlannerInputBypassBase = createWiringInputFromResult(
  scenarioASuccessfulMinimalPlanningHandoff,
);
const { runnerPlanningInput, ...planningInputHandoffWithoutRunnerInput } =
  topLevelPlannerInputBypassBase.mappingResult.planningInput;
const topLevelPlannerInputBypassCallsBefore = injectedPlannerCalls;
const topLevelPlannerInputBypassResult = createTaskPlanFilePlannerWiringResult(
  {
    ...topLevelPlannerInputBypassBase,
    plannerInput: runnerPlanningInput,
    mappingResult: {
      ...topLevelPlannerInputBypassBase.mappingResult,
      planningInput: planningInputHandoffWithoutRunnerInput,
    },
  },
  injectedPlannerOptions,
);
assert.equal(
  injectedPlannerCalls,
  topLevelPlannerInputBypassCallsBefore,
  "task plan file planner wiring logic smoke N top-level plannerInput should not bypass missing mapping handoff input",
);
assert.equal(
  topLevelPlannerInputBypassResult.mapping.planningInputAvailable,
  false,
  "task plan file planner wiring logic smoke N missing mapping runnerPlanningInput should block planning input availability",
);
assert.ok(
  ["mapping_failed", "blocked"].includes(topLevelPlannerInputBypassResult.status),
  "task plan file planner wiring logic smoke N missing mapping runnerPlanningInput should fail closed",
);
assertPlannerNotAttempted(
  topLevelPlannerInputBypassResult,
  "task plan file planner wiring logic smoke N top-level plannerInput bypass",
);

function createUnsafePlanningMetadataInput(field) {
  const base = createWiringInputFromResult(
    scenarioASuccessfulMinimalPlanningHandoff,
  );
  const mappingResult = base.mappingResult;
  const planningInputHandoff = mappingResult.planningInput;
  const runnerPlanningInput = planningInputHandoff.runnerPlanningInput;

  return {
    ...base,
    mappingResult: {
      ...mappingResult,
      planningInput: {
        ...planningInputHandoff,
        runnerPlanningInput: {
          ...runnerPlanningInput,
          metadata: {
            ...runnerPlanningInput.metadata,
            [field]: true,
          },
        },
      },
    },
  };
}

for (const field of [
  "executionEnabled",
  "adapterCalls",
  "auditWrites",
  "verifierRun",
  "persistence",
  "filesystemMutation",
  "completedStateCreated",
]) {
  const callsBeforeUnsafeGate = injectedPlannerCalls;
  const unsafeResult = createTaskPlanFilePlannerWiringResult(
    createUnsafePlanningMetadataInput(field),
    injectedPlannerOptions,
  );

  assert.equal(
    injectedPlannerCalls,
    callsBeforeUnsafeGate,
    `task plan file planner wiring logic smoke P fake planner should not run when ${field} is true`,
  );
  assert.equal(
    unsafeResult.ok,
    false,
    `task plan file planner wiring logic smoke P should fail closed when ${field} is true`,
  );
  assert.equal(
    unsafeResult.status,
    "blocked",
    `task plan file planner wiring logic smoke P should report blocked when ${field} is true`,
  );
  assertPlannerNotAttempted(
    unsafeResult,
    `task plan file planner wiring logic smoke P ${field}`,
  );
  assert.equal(
    unsafeResult.issues.some(
      (issue) =>
        issue.code === "task_plan_file_unsafe_runtime_truth_claim" &&
        issue.field?.endsWith(field),
    ),
    true,
    `task plan file planner wiring logic smoke P should represent unsafe ${field} issue`,
  );
  assertWiringLogicNoExecutionNoWrites(
    unsafeResult,
    `task plan file planner wiring logic smoke P ${field}`,
  );
}

const unsafeParserInput = {
  ...createWiringInputFromResult(scenarioASuccessfulMinimalPlanningHandoff),
  parserResult: {
    ...scenarioASuccessfulMinimalPlanningHandoff.parse.parserResult,
    summary: {
      ...scenarioASuccessfulMinimalPlanningHandoff.parse.parserResult.summary,
      runnerPlanningExecuted: true,
    },
  },
};
const parserUnsafeCallsBefore = injectedPlannerCalls;
const unsafeParserResult = createTaskPlanFilePlannerWiringResult(
  unsafeParserInput,
  injectedPlannerOptions,
);
assert.equal(
  injectedPlannerCalls,
  parserUnsafeCallsBefore,
  "task plan file planner wiring logic smoke Q fake planner should not run when parser claims runner planning executed",
);
assert.equal(
  unsafeParserResult.ok,
  false,
  "task plan file planner wiring logic smoke Q should fail closed",
);
assert.equal(
  unsafeParserResult.status,
  "blocked",
  "task plan file planner wiring logic smoke Q should report blocked",
);
assert.equal(
  unsafeParserResult.parse.parserResult,
  undefined,
  "task plan file planner wiring logic smoke Q should not retain unsafe parser payload",
);
assertWiringLogicNoExecutionNoWrites(
  unsafeParserResult,
  "task plan file planner wiring logic smoke Q",
);

let unsafePlannerCalls = 0;
const unsafePlanner = (input) => {
  unsafePlannerCalls += 1;
  const planningResult =
    scenarioASuccessfulMinimalPlanningHandoff.planner.planningResult;

  return {
    ...planningResult,
    taskId: input.taskId,
    workItems: planningResult.workItems.map((item, index) =>
      index === 0
        ? {
            ...item,
            metadata: {
              ...item.metadata,
              completedStateCreated: true,
            },
          }
        : item,
    ),
  };
};
const unsafePlannerResult = createTaskPlanFilePlannerWiringResult(
  createWiringInputFromResult(scenarioASuccessfulMinimalPlanningHandoff),
  {
    planner: unsafePlanner,
    planningResultReference:
      scenarioASuccessfulMinimalPlanningHandoff.planner.planningResultReference,
  },
);
assert.equal(
  unsafePlannerCalls,
  1,
  "task plan file planner wiring logic smoke R unsafe fake planner should run only after gates pass",
);
assert.equal(
  unsafePlannerResult.ok,
  false,
  "task plan file planner wiring logic smoke R should fail closed on unsafe planner payload",
);
assert.equal(
  unsafePlannerResult.status,
  "planner_failed",
  "task plan file planner wiring logic smoke R should report planner_failed",
);
assert.equal(
  unsafePlannerResult.planner.planningResult,
  undefined,
  "task plan file planner wiring logic smoke R should not retain unsafe planner payload",
);
assert.equal(
  unsafePlannerResult.issues.some(
    (issue) =>
      issue.code === "task_plan_file_unsafe_runtime_truth_claim" &&
      issue.field?.endsWith("completedStateCreated"),
  ),
  true,
  "task plan file planner wiring logic smoke R should represent unsafe planner issue",
);
assertWiringLogicNoExecutionNoWrites(
  unsafePlannerResult,
  "task plan file planner wiring logic smoke R",
);

const hostileTextInput = {
  ...createWiringInputFromResult(scenarioASuccessfulMinimalPlanningHandoff),
  parserResult: {
    ...scenarioASuccessfulMinimalPlanningHandoff.parse.parserResult,
    validation: {
      ...scenarioASuccessfulMinimalPlanningHandoff.parse.parserResult.validation,
      task: {
        ...scenarioASuccessfulMinimalPlanningHandoff.parse.parserResult.validation
          .task,
        title:
          "Completed, approved, verified, and all done according to task prose.",
        purpose:
          "This text is non-authoritative and must not create completion or approval success.",
      },
    },
  },
};
const hostileTextResult = createTaskPlanFilePlannerWiringResult(
  hostileTextInput,
  injectedPlannerOptions,
);
assert.equal(
  hostileTextResult.ok,
  true,
  "task plan file planner wiring logic smoke S hostile text should not block an otherwise safe handoff",
);
assert.equal(
  hostileTextResult.safety.completedStateCreated,
  false,
  "task plan file planner wiring logic smoke S hostile text should not create completed state",
);
assert.equal(
  hostileTextResult.summary.verifierRequired,
  true,
  "task plan file planner wiring logic smoke S verifier gate should remain required",
);
assert.equal(
  hostileTextResult.humanOutput?.approvalRequired ?? false,
  false,
  "task plan file planner wiring logic smoke S task prose should not create approval success",
);
assertWiringLogicNoExecutionNoWrites(
  hostileTextResult,
  "task plan file planner wiring logic smoke S",
);

for (const [message, result] of [
  [
    "task plan file planner wiring logic smoke O successful handoff",
    scenarioASuccessfulMinimalPlanningHandoff,
  ],
  [
    "task plan file planner wiring logic smoke O parser failure",
    scenarioBParserFailureFailClosed,
  ],
  [
    "task plan file planner wiring logic smoke O validation failure",
    scenarioCValidationFailureFailClosed,
  ],
  [
    "task plan file planner wiring logic smoke O unsupported mapping",
    scenarioDUnsupportedMappingFailClosed,
  ],
  [
    "task plan file planner wiring logic smoke O missing verifier gate",
    scenarioEMissingVerifierGateFailClosed,
  ],
  [
    "task plan file planner wiring logic smoke O missing noExecution/noWrites",
    scenarioFMissingNoExecutionNoWritesGateFailClosed,
  ],
  [
    "task plan file planner wiring logic smoke O planner failure",
    scenarioGPlannerFailureFailClosed,
  ],
]) {
  assertWiringLogicNoExecutionNoWrites(result, message);
  assert.equal(
    Object.hasOwn(result, "filesystemIoHappened"),
    false,
    `${message} must not represent filesystem IO`,
  );
  assert.equal(
    Object.hasOwn(result, "cliRan"),
    false,
    `${message} must not represent CLI execution`,
  );
  assert.equal(
    Object.hasOwn(result, "runnerExecutionHappened"),
    false,
    `${message} must not represent runner execution`,
  );
  assert.equal(
    Object.hasOwn(result, "directPlanAgenticRunnerCall"),
    false,
    `${message} must not represent direct planAgenticRunner call`,
  );
}

console.log("task plan file planner wiring logic smoke tests passed");

assert.deepEqual(
  cliTaskPlanPlannerIntegrationInputExample.argv,
  ["plan", "TASKS/TASK-0265.json"],
  "CLI task plan integration smoke input should represent taskFile argument",
);
assert.equal(
  cliTaskPlanPlannerIntegrationInputExample.taskFile,
  "TASKS/TASK-0265.json",
  "CLI task plan integration smoke input should represent task file",
);
assert.equal(
  cliTaskPlanPlannerIntegrationInputExample.json,
  false,
  "CLI task plan integration smoke input should default JSON to false",
);
assert.equal(
  cliTaskPlanPlannerIntegrationInputExample.mode,
  "plan",
  "CLI task plan integration smoke input should represent plan mode",
);
assert.equal(
  cliTaskPlanPlannerIntegrationOptionsExample.json,
  false,
  "CLI task plan integration smoke options should represent json false",
);
assert.equal(
  cliTaskPlanPlannerIntegrationOptionsExample.failClosedOnParserFailure,
  true,
  "CLI task plan integration smoke options should fail closed on parser failure",
);
assert.equal(
  cliTaskPlanPlannerIntegrationOptionsExample.failClosedWithoutRunnerPlanningInput,
  true,
  "CLI task plan integration smoke options should fail closed without runner planning input",
);
assert.equal(
  cliTaskPlanPlannerIntegrationOptionsExample.failClosedWithoutVerifier,
  true,
  "CLI task plan integration smoke options should fail closed without verifier",
);
assert.equal(
  cliTaskPlanPlannerIntegrationOptionsExample.suppressHumanOutputInJsonMode,
  true,
  "CLI task plan integration smoke options should suppress human JSON output",
);
assert.equal(
  cliTaskPlanPlannerIntegrationOptionsExample.deterministicIssues,
  true,
  "CLI task plan integration smoke options should keep issues deterministic",
);

assert.equal(
  scenarioASuccessfulCliTaskPlanIntegration.parser.attempted,
  true,
  "CLI task plan integration smoke A parser should be attempted",
);
assert.equal(
  scenarioASuccessfulCliTaskPlanIntegration.parser.ok,
  true,
  "CLI task plan integration smoke A parser should be ok",
);
assert.equal(
  scenarioASuccessfulCliTaskPlanIntegration.parser.pathOk,
  true,
  "CLI task plan integration smoke A path should be ok",
);
assert.equal(
  scenarioASuccessfulCliTaskPlanIntegration.parser.parseOk,
  true,
  "CLI task plan integration smoke A parse should be ok",
);
assert.equal(
  scenarioASuccessfulCliTaskPlanIntegration.mapping.attempted,
  true,
  "CLI task plan integration smoke A mapping should be attempted",
);
assert.equal(
  scenarioASuccessfulCliTaskPlanIntegration.mapping.ok,
  true,
  "CLI task plan integration smoke A mapping should be ok",
);
assert.equal(
  scenarioASuccessfulCliTaskPlanIntegration.mapping.runnerPlanningInputAvailable,
  true,
  "CLI task plan integration smoke A runner planning input should be available",
);
assert.equal(
  scenarioASuccessfulCliTaskPlanIntegration.mapping.noExecution,
  true,
  "CLI task plan integration smoke A noExecution should be explicit",
);
assert.equal(
  scenarioASuccessfulCliTaskPlanIntegration.mapping.noWrites,
  true,
  "CLI task plan integration smoke A noWrites should be explicit",
);
assert.equal(
  scenarioASuccessfulCliTaskPlanIntegration.mapping.verifierRequired,
  true,
  "CLI task plan integration smoke A should require verifier",
);
assert.equal(
  scenarioASuccessfulCliTaskPlanIntegration.mapping.completionGatedByVerifier,
  true,
  "CLI task plan integration smoke A should gate completion by verifier",
);
assert.equal(
  scenarioASuccessfulCliTaskPlanIntegration.wiring.attempted,
  true,
  "CLI task plan integration smoke A wiring should be attempted",
);
assert.equal(
  scenarioASuccessfulCliTaskPlanIntegration.wiring.ok,
  true,
  "CLI task plan integration smoke A wiring should be ok",
);
assert.equal(
  scenarioASuccessfulCliTaskPlanIntegration.wiring.plannerDependencyInjected,
  true,
  "CLI task plan integration smoke A planner dependency should be injected",
);
assert.equal(
  scenarioASuccessfulCliTaskPlanIntegration.wiring.plannerInvocationAllowed,
  true,
  "CLI task plan integration smoke A planner invocation should be allowed",
);
assert.equal(
  scenarioASuccessfulCliTaskPlanIntegration.ok,
  true,
  "CLI task plan integration smoke A should be ok",
);
assert.equal(
  scenarioASuccessfulCliTaskPlanIntegration.status,
  "planned",
  "CLI task plan integration smoke A should report planned",
);
assert.equal(
  scenarioASuccessfulCliTaskPlanIntegration.exitCode,
  "success",
  "CLI task plan integration smoke A should report success exit code",
);
assertCliNoExecutionNoWrites(
  scenarioASuccessfulCliTaskPlanIntegration,
  "CLI task plan integration smoke A",
);

assertCliJsonOnlyBehavior(
  scenarioBJsonSuccessModel,
  "CLI task plan integration smoke B",
);
assert.equal(
  scenarioBJsonSuccessModel.ok,
  true,
  "CLI task plan integration smoke B should be ok",
);
assert.equal(
  scenarioBJsonSuccessModel.status,
  "planned",
  "CLI task plan integration smoke B should report planned",
);
assert.equal(
  scenarioBJsonSuccessModel.exitCode,
  "success",
  "CLI task plan integration smoke B should report success",
);
assert.equal(
  Object.hasOwn(scenarioBJsonSuccessModel, "humanOutput"),
  false,
  "CLI task plan integration smoke B should suppress human output",
);

assert.equal(
  scenarioCParserFailure.ok,
  false,
  "CLI task plan integration smoke C should fail",
);
assert.equal(
  scenarioCParserFailure.status,
  "parser_failed",
  "CLI task plan integration smoke C should report parser_failed",
);
assert.equal(
  scenarioCParserFailure.exitCode,
  "parser_failure",
  "CLI task plan integration smoke C should report parser failure",
);
assert.equal(
  scenarioCParserFailure.parser.attempted,
  true,
  "CLI task plan integration smoke C parser should be attempted",
);
assert.equal(
  scenarioCParserFailure.parser.ok,
  false,
  "CLI task plan integration smoke C parser should fail",
);
assert.equal(
  scenarioCParserFailure.mapping.attempted,
  false,
  "CLI task plan integration smoke C mapping should not be attempted",
);
assert.equal(
  scenarioCParserFailure.wiring.attempted,
  false,
  "CLI task plan integration smoke C wiring should not be attempted",
);
assertCliPlannerNotAttempted(
  scenarioCParserFailure,
  "CLI task plan integration smoke C",
);
assert.equal(
  scenarioCParserFailure.safety.executionEnabled,
  false,
  "CLI task plan integration smoke C execution should be disabled",
);
assertCliIssueRepresented(scenarioCParserFailure, "CLI task plan integration smoke C");

assert.equal(
  scenarioDValidationFailure.parser.parseOk,
  true,
  "CLI task plan integration smoke D parse should be ok",
);
assert.equal(
  scenarioDValidationFailure.parser.validationStatus,
  "fail",
  "CLI task plan integration smoke D validation should fail",
);
assert.equal(
  scenarioDValidationFailure.parser.validationCompatible,
  false,
  "CLI task plan integration smoke D validation should be incompatible",
);
assert.equal(
  scenarioDValidationFailure.mapping.attempted,
  false,
  "CLI task plan integration smoke D mapping should not be attempted",
);
assert.equal(
  scenarioDValidationFailure.wiring.attempted,
  false,
  "CLI task plan integration smoke D wiring should not be attempted",
);
assertCliPlannerNotAttempted(
  scenarioDValidationFailure,
  "CLI task plan integration smoke D",
);
assert.equal(
  scenarioDValidationFailure.status,
  "validation_failed",
  "CLI task plan integration smoke D should report validation_failed",
);
assert.equal(
  scenarioDValidationFailure.exitCode,
  "validation_failure",
  "CLI task plan integration smoke D should report validation failure",
);
assert.equal(
  scenarioDValidationFailure.ok,
  false,
  "CLI task plan integration smoke D should fail closed",
);
assertCliIssueRepresented(
  scenarioDValidationFailure,
  "CLI task plan integration smoke D",
);

assert.equal(
  scenarioEUnsupportedMapping.mapping.attempted,
  true,
  "CLI task plan integration smoke E mapping should be attempted",
);
assert.equal(
  scenarioEUnsupportedMapping.mapping.ok,
  false,
  "CLI task plan integration smoke E mapping should fail",
);
assert.equal(
  scenarioEUnsupportedMapping.mapping.status,
  "unsupported",
  "CLI task plan integration smoke E should represent unsupported mapping",
);
assert.equal(
  scenarioEUnsupportedMapping.mapping.runnerPlanningInputAvailable,
  false,
  "CLI task plan integration smoke E runner planning input should be unavailable",
);
assert.equal(
  scenarioEUnsupportedMapping.wiring.attempted,
  false,
  "CLI task plan integration smoke E wiring should not be attempted",
);
assertCliPlannerNotAttempted(
  scenarioEUnsupportedMapping,
  "CLI task plan integration smoke E",
);
assert.equal(
  scenarioEUnsupportedMapping.status,
  "unsupported_mapping",
  "CLI task plan integration smoke E should report unsupported_mapping",
);
assert.equal(
  scenarioEUnsupportedMapping.exitCode,
  "unsupported_mapping",
  "CLI task plan integration smoke E should report unsupported mapping exit code",
);
assert.notEqual(
  scenarioEUnsupportedMapping.ok,
  true,
  "CLI task plan integration smoke E should not fake success",
);
assertCliIssueRepresented(
  scenarioEUnsupportedMapping,
  "CLI task plan integration smoke E",
);

assert.equal(
  scenarioFMissingRunnerPlanningInput.mapping.attempted,
  true,
  "CLI task plan integration smoke F mapping should be attempted",
);
assert.equal(
  scenarioFMissingRunnerPlanningInput.mapping.runnerPlanningInputAvailable,
  false,
  "CLI task plan integration smoke F runner planning input should be missing",
);
assert.equal(
  scenarioFMissingRunnerPlanningInput.wiring.ok,
  false,
  "CLI task plan integration smoke F wiring should be blocked",
);
assertCliPlannerNotAttempted(
  scenarioFMissingRunnerPlanningInput,
  "CLI task plan integration smoke F",
);
assert.ok(
  ["mapping_failed", "blocked"].includes(scenarioFMissingRunnerPlanningInput.status),
  "CLI task plan integration smoke F should report blocked or mapping_failed",
);
assert.equal(
  scenarioFMissingRunnerPlanningInput.ok,
  false,
  "CLI task plan integration smoke F should fail",
);
assert.equal(
  scenarioFMissingRunnerPlanningInput.wiring.topLevelPlannerInputBypassAllowed,
  false,
  "CLI task plan integration smoke F should not imply top-level planner input bypass",
);
assert.equal(
  scenarioFMissingRunnerPlanningInput.wiring.plannerInvocationAllowed,
  false,
  "CLI task plan integration smoke F planner invocation should be disallowed",
);
assertCliIssueRepresented(
  scenarioFMissingRunnerPlanningInput,
  "CLI task plan integration smoke F",
);

assert.equal(
  scenarioGMissingVerifierGate.mapping.verifierRequired === false ||
    scenarioGMissingVerifierGate.mapping.completionGatedByVerifier === false,
  true,
  "CLI task plan integration smoke G should represent missing verifier gate",
);
assert.equal(
  scenarioGMissingVerifierGate.wiring.ok,
  false,
  "CLI task plan integration smoke G wiring should be blocked",
);
assertCliPlannerNotAttempted(
  scenarioGMissingVerifierGate,
  "CLI task plan integration smoke G",
);
assert.equal(
  scenarioGMissingVerifierGate.ok,
  false,
  "CLI task plan integration smoke G should fail",
);
assert.ok(
  ["mapping_failed", "blocked"].includes(scenarioGMissingVerifierGate.status),
  "CLI task plan integration smoke G should report blocked or mapping_failed",
);
assert.equal(
  scenarioGMissingVerifierGate.safety.executionEnabled,
  false,
  "CLI task plan integration smoke G execution should be disabled",
);
assertCliIssueRepresented(
  scenarioGMissingVerifierGate,
  "CLI task plan integration smoke G",
);

assert.equal(
  scenarioHMissingNoExecutionNoWrites.issues.some(
    (issue) =>
      issue.metadata?.representedNoExecution === false ||
      issue.metadata?.representedNoWrites === false,
  ),
  true,
  "CLI task plan integration smoke H should represent missing noExecution/noWrites",
);
assert.equal(
  scenarioHMissingNoExecutionNoWrites.wiring.ok,
  false,
  "CLI task plan integration smoke H wiring should be blocked",
);
assertCliPlannerNotAttempted(
  scenarioHMissingNoExecutionNoWrites,
  "CLI task plan integration smoke H",
);
assert.equal(
  scenarioHMissingNoExecutionNoWrites.ok,
  false,
  "CLI task plan integration smoke H should fail",
);
assert.ok(
  ["mapping_failed", "blocked"].includes(scenarioHMissingNoExecutionNoWrites.status),
  "CLI task plan integration smoke H should report blocked or mapping_failed",
);
assert.equal(
  scenarioHMissingNoExecutionNoWrites.safety.filesystemMutation,
  false,
  "CLI task plan integration smoke H filesystem mutation should remain false",
);
assert.equal(
  scenarioHMissingNoExecutionNoWrites.safety.executionEnabled,
  false,
  "CLI task plan integration smoke H execution should be disabled",
);
assertCliIssueRepresented(
  scenarioHMissingNoExecutionNoWrites,
  "CLI task plan integration smoke H",
);

assert.equal(
  scenarioIUnsafeRepresentedMetadata.issues.some((issue) =>
    issue.metadata?.representedUnsafeTruths?.includes("verifierRun"),
  ),
  true,
  "CLI task plan integration smoke I should represent unsafe verifier metadata",
);
assert.equal(
  scenarioIUnsafeRepresentedMetadata.issues.some((issue) =>
    issue.metadata?.representedUnsafeTruths?.includes("filesystemMutation"),
  ),
  true,
  "CLI task plan integration smoke I should represent unsafe filesystem metadata",
);
assert.equal(
  scenarioIUnsafeRepresentedMetadata.issues.some((issue) =>
    issue.metadata?.representedUnsafeTruths?.includes("completedStateCreated"),
  ),
  true,
  "CLI task plan integration smoke I should represent unsafe completed-state metadata",
);
assert.equal(
  scenarioIUnsafeRepresentedMetadata.ok,
  false,
  "CLI task plan integration smoke I should fail",
);
assert.equal(
  scenarioIUnsafeRepresentedMetadata.status,
  "blocked",
  "CLI task plan integration smoke I should report blocked",
);
assert.equal(
  scenarioIUnsafeRepresentedMetadata.wiring.plannerInvocationAllowed,
  false,
  "CLI task plan integration smoke I planner invocation should be disallowed",
);
assert.equal(
  scenarioIUnsafeRepresentedMetadata.safety.failClosedOnUnsafeMetadata,
  true,
  "CLI task plan integration smoke I should fail closed on unsafe metadata",
);
assertCliIssueRepresented(
  scenarioIUnsafeRepresentedMetadata,
  "CLI task plan integration smoke I",
);

assert.equal(
  scenarioJPlannerFailure.parser.ok,
  true,
  "CLI task plan integration smoke J parser should be ok",
);
assert.equal(
  scenarioJPlannerFailure.mapping.ok,
  true,
  "CLI task plan integration smoke J mapping should be ok",
);
assert.equal(
  scenarioJPlannerFailure.mapping.runnerPlanningInputAvailable,
  true,
  "CLI task plan integration smoke J runner planning input should be available",
);
assert.equal(
  scenarioJPlannerFailure.wiring.ok,
  true,
  "CLI task plan integration smoke J wiring should be ok",
);
assert.equal(
  scenarioJPlannerFailure.planner.attempted,
  true,
  "CLI task plan integration smoke J planner should be attempted",
);
assert.equal(
  scenarioJPlannerFailure.planner.ok,
  false,
  "CLI task plan integration smoke J planner should fail",
);
assert.equal(
  scenarioJPlannerFailure.status,
  "planner_failed",
  "CLI task plan integration smoke J should report planner_failed",
);
assert.equal(
  scenarioJPlannerFailure.exitCode,
  "planner_failure",
  "CLI task plan integration smoke J should report planner failure",
);
assert.equal(
  scenarioJPlannerFailure.ok,
  false,
  "CLI task plan integration smoke J should fail",
);
assert.equal(
  scenarioJPlannerFailure.safety.executionEnabled,
  false,
  "CLI task plan integration smoke J execution should be disabled",
);
assertCliIssueRepresented(scenarioJPlannerFailure, "CLI task plan integration smoke J");

assertCliFields(
  scenarioKHumanRenderModel,
  [
    "title",
    "taskId",
    "sourceFile",
    "mode",
    "parsed",
    "mapping",
    "planning",
    "workItems",
    "batches",
    "steps",
    "policyRequired",
    "approvalRequired",
    "verifierRequired",
    "completionGatedByVerifier",
    "auditExpected",
    "realExecution",
    "adapterCalls",
    "auditWrites",
    "verifierRun",
    "persistence",
    "filesystemMutation",
    "completedStateCreated",
    "issues",
  ],
  "CLI task plan integration smoke K human render model",
);
assertCliSideEffectFalseFields(
  scenarioKHumanRenderModel,
  "CLI task plan integration smoke K human render model",
);
assert.equal(
  scenarioKHumanRenderModel.realExecution,
  false,
  "CLI task plan integration smoke K real execution should be false",
);

assertCliFields(
  scenarioLJsonRenderModel,
  [
    "ok",
    "status",
    "exitCode",
    "taskId",
    "mode",
    "sourceFile",
    "parse",
    "mapping",
    "wiring",
    "plan",
    "safety",
    "issues",
    "summary",
  ],
  "CLI task plan integration smoke L JSON render model",
);
assertCliSideEffectFalseFields(
  scenarioLJsonRenderModel.safety,
  "CLI task plan integration smoke L JSON render model safety",
);

assertCliJsonOnlyBehavior(
  scenarioMJsonOnlyFailureBehavior,
  "CLI task plan integration smoke M",
);
assert.equal(
  scenarioMJsonOnlyFailureBehavior.ok,
  false,
  "CLI task plan integration smoke M should fail",
);
assert.ok(
  ["parser_failed", "blocked"].includes(scenarioMJsonOnlyFailureBehavior.status),
  "CLI task plan integration smoke M should report parser_failed or blocked",
);
assert.notEqual(
  scenarioMJsonOnlyFailureBehavior.exitCode,
  "success",
  "CLI task plan integration smoke M exit code should be non-success",
);

assertCliFields(
  scenarioNSummaryShape,
  [
    "parsed",
    "mapped",
    "wired",
    "planned",
    "workItemCount",
    "batchCount",
    "planStepCount",
    "issueCount",
    "json",
    "noExecution",
    "noWrites",
    "executionEnabled",
    "adapterCalls",
    "auditWrites",
    "verifierRun",
    "persistence",
    "filesystemMutation",
    "completedStateCreated",
    "verifierRequired",
    "completionGatedByVerifier",
    "runnerPlanningInputAvailable",
    "plannerDependencyInjected",
    "plannerInvocationAllowed",
  ],
  "CLI task plan integration smoke N summary",
);
assert.deepEqual(
  scenarioNSummaryShape,
  scenarioASuccessfulCliTaskPlanIntegration.summary,
  "CLI task plan integration smoke N summary should match successful result summary",
);
for (const [message, result] of [
  ["CLI task plan integration smoke N success", scenarioASuccessfulCliTaskPlanIntegration],
  ["CLI task plan integration smoke N parser failure", scenarioCParserFailure],
  ["CLI task plan integration smoke N validation failure", scenarioDValidationFailure],
  ["CLI task plan integration smoke N unsupported mapping", scenarioEUnsupportedMapping],
  [
    "CLI task plan integration smoke N missing runner planning input",
    scenarioFMissingRunnerPlanningInput,
  ],
  ["CLI task plan integration smoke N missing verifier gate", scenarioGMissingVerifierGate],
  [
    "CLI task plan integration smoke N missing noExecution/noWrites",
    scenarioHMissingNoExecutionNoWrites,
  ],
  ["CLI task plan integration smoke N planner failure", scenarioJPlannerFailure],
]) {
  assertCliSummaryHonest(result, message);
}

assert.deepEqual(
  scenarioOExitCodeExamples,
  {
    planned: "success",
    parser_failed: "parser_failure",
    validation_failed: "validation_failure",
    unsupported_mapping: "unsupported_mapping",
    mapping_failed: "mapping_failure",
    wiring_failed: "wiring_failure",
    planner_failed: "planner_failure",
    blocked: "blocked",
    failed: "unknown_failure",
    unknown: "unknown_failure",
  },
  "CLI task plan integration smoke O exit code mapping should remain stable",
);

assert.equal(
  scenarioPSafetyStage.executionEnabled,
  false,
  "CLI task plan integration smoke P executionEnabled should be false",
);
assert.equal(
  scenarioPSafetyStage.adapterCalls,
  false,
  "CLI task plan integration smoke P adapterCalls should be false",
);
assert.equal(
  scenarioPSafetyStage.auditWrites,
  false,
  "CLI task plan integration smoke P auditWrites should be false",
);
assert.equal(
  scenarioPSafetyStage.verifierRun,
  false,
  "CLI task plan integration smoke P verifierRun should be false",
);
assert.equal(
  scenarioPSafetyStage.persistence,
  false,
  "CLI task plan integration smoke P persistence should be false",
);
assert.equal(
  scenarioPSafetyStage.filesystemMutation,
  false,
  "CLI task plan integration smoke P filesystemMutation should be false",
);
assert.equal(
  scenarioPSafetyStage.completedStateCreated,
  false,
  "CLI task plan integration smoke P completedStateCreated should be false",
);
assert.equal(
  scenarioPSafetyStage.noExecution,
  true,
  "CLI task plan integration smoke P noExecution should be true",
);
assert.equal(
  scenarioPSafetyStage.noWrites,
  true,
  "CLI task plan integration smoke P noWrites should be true",
);

for (const [message, result] of [
  ["CLI task plan integration smoke Q success", scenarioASuccessfulCliTaskPlanIntegration],
  ["CLI task plan integration smoke Q JSON success", scenarioBJsonSuccessModel],
  ["CLI task plan integration smoke Q parser failure", scenarioCParserFailure],
  ["CLI task plan integration smoke Q validation failure", scenarioDValidationFailure],
  ["CLI task plan integration smoke Q unsupported mapping", scenarioEUnsupportedMapping],
  [
    "CLI task plan integration smoke Q missing runner planning input",
    scenarioFMissingRunnerPlanningInput,
  ],
  ["CLI task plan integration smoke Q missing verifier gate", scenarioGMissingVerifierGate],
  [
    "CLI task plan integration smoke Q missing noExecution/noWrites",
    scenarioHMissingNoExecutionNoWrites,
  ],
  ["CLI task plan integration smoke Q unsafe metadata", scenarioIUnsafeRepresentedMetadata],
  ["CLI task plan integration smoke Q planner failure", scenarioJPlannerFailure],
]) {
  assertCliNoExecutionNoWrites(result, message);
  assertNoRuntimeTruth(result, message);
  for (const field of [
    "cliCommandExecuted",
    "cliRan",
    "parserExecutionHappened",
    "mapperExecutionHappened",
    "wiringLogicExecuted",
    "plannerExecutionHappened",
    "directPlanAgenticRunnerCall",
    "runnerExecutionHappened",
    "adapterCallHappened",
    "auditWriteHappened",
    "verifierExecutionHappened",
    "persistenceHappened",
    "filesystemIoHappened",
    "filesystemMutationHappened",
    "completedStateCreated",
  ]) {
    assert.equal(
      Object.hasOwn(result, field),
      false,
      `${message} must not expose ${field}`,
    );
  }
}

console.log("CLI task plan planner integration contract smoke tests passed");

for (const [check, passed] of Object.entries(cliLogicScenarioAChecks)) {
  assert.equal(
    passed,
    true,
    `CLI task plan integration logic smoke A ${check} should pass`,
  );
}
assert.equal(
  cliLogicScenarioA.taskId,
  cliLogicScenarioA.mapping.mappingResult?.planningInput.runnerPlanningInput
    ?.taskId,
  "CLI task plan integration logic smoke A should pass mapped runnerPlanningInput to planner",
);
assert.equal(
  cliLogicScenarioA.jsonOnly.jsonRequested,
  false,
  "CLI task plan integration logic smoke A JSON should be false",
);
assert.equal(
  cliLogicScenarioA.mode,
  "plan",
  "CLI task plan integration logic smoke A should preserve plan mode",
);
assertCliLogicNoExecutionNoWrites(
  cliLogicScenarioA,
  "CLI task plan integration logic smoke A",
);

for (const [check, passed] of Object.entries(cliLogicScenarioBChecks)) {
  assert.equal(
    passed,
    true,
    `CLI task plan integration logic smoke B ${check} should pass`,
  );
}
assertCliJsonOnlyBehavior(
  cliLogicScenarioB,
  "CLI task plan integration logic smoke B",
);
assert.equal(
  cliLogicScenarioB.humanOutput,
  undefined,
  "CLI task plan integration logic smoke B should suppress human output model",
);
assert.equal(
  cliLogicScenarioB.ok,
  true,
  "CLI task plan integration logic smoke B should be ok",
);
assert.equal(
  cliLogicScenarioB.status,
  "planned",
  "CLI task plan integration logic smoke B should report planned",
);
assert.equal(
  cliLogicScenarioB.exitCode,
  "success",
  "CLI task plan integration logic smoke B should report success",
);

for (const [check, passed] of Object.entries(cliLogicScenarioCChecks)) {
  assert.equal(
    passed,
    true,
    `CLI task plan integration logic smoke C ${check} should pass`,
  );
}
assert.equal(
  cliLogicScenarioC.mapping.attempted,
  false,
  "CLI task plan integration logic smoke C mapping should not be attempted",
);
assert.equal(
  cliLogicScenarioC.wiring.attempted,
  false,
  "CLI task plan integration logic smoke C wiring should not be attempted",
);
assertCliPlannerNotAttempted(
  cliLogicScenarioC,
  "CLI task plan integration logic smoke C",
);
assertCliIssueRepresented(
  cliLogicScenarioC,
  "CLI task plan integration logic smoke C",
);

for (const [check, passed] of Object.entries(cliLogicScenarioDChecks)) {
  assert.equal(
    passed,
    true,
    `CLI task plan integration logic smoke D ${check} should pass`,
  );
}
assert.equal(
  cliLogicScenarioD.mapping.attempted,
  false,
  "CLI task plan integration logic smoke D mapping should not be attempted",
);
assert.equal(
  cliLogicScenarioD.wiring.attempted,
  false,
  "CLI task plan integration logic smoke D wiring should not be attempted",
);
assertCliPlannerNotAttempted(
  cliLogicScenarioD,
  "CLI task plan integration logic smoke D",
);
assertCliIssueRepresented(
  cliLogicScenarioD,
  "CLI task plan integration logic smoke D",
);

for (const [check, passed] of Object.entries(cliLogicScenarioEChecks)) {
  assert.equal(
    passed,
    true,
    `CLI task plan integration logic smoke E ${check} should pass`,
  );
}
assert.equal(
  cliLogicScenarioE.mapping.status,
  "unsupported",
  "CLI task plan integration logic smoke E should represent unsupported mapping",
);
assert.equal(
  cliLogicScenarioE.wiring.plannerInvocationAllowed,
  false,
  "CLI task plan integration logic smoke E planner should be blocked",
);
assertCliPlannerNotAttempted(
  cliLogicScenarioE,
  "CLI task plan integration logic smoke E",
);
assert.notEqual(
  cliLogicScenarioE.ok,
  true,
  "CLI task plan integration logic smoke E should not fake success",
);

for (const [check, passed] of Object.entries(cliLogicScenarioFChecks)) {
  assert.equal(
    passed,
    true,
    `CLI task plan integration logic smoke F ${check} should pass`,
  );
}
assert.equal(
  cliLogicScenarioF.mapping.mappingResult?.planningInput.runnerPlanningInput,
  undefined,
  "CLI task plan integration logic smoke F mapping result should not contain runnerPlanningInput",
);
assert.equal(
  cliLogicScenarioF.wiring.plannerInvocationAllowed,
  false,
  "CLI task plan integration logic smoke F planner invocation should be blocked",
);
assertCliPlannerNotAttempted(
  cliLogicScenarioF,
  "CLI task plan integration logic smoke F",
);
assert.ok(
  ["mapping_failed", "blocked"].includes(cliLogicScenarioF.status),
  "CLI task plan integration logic smoke F should report mapping_failed or blocked",
);
assertCliIssueRepresented(
  cliLogicScenarioF,
  "CLI task plan integration logic smoke F",
);

for (const [check, passed] of Object.entries(cliLogicScenarioGChecks)) {
  assert.equal(
    passed,
    true,
    `CLI task plan integration logic smoke G ${check} should pass`,
  );
}
assert.equal(
  cliLogicScenarioG.mapping.verifierRequired === false ||
    cliLogicScenarioG.mapping.completionGatedByVerifier === false,
  true,
  "CLI task plan integration logic smoke G should represent a missing verifier gate",
);
assert.equal(
  cliLogicScenarioG.wiring.plannerInvocationAllowed,
  false,
  "CLI task plan integration logic smoke G planner invocation should be blocked",
);
assertCliPlannerNotAttempted(
  cliLogicScenarioG,
  "CLI task plan integration logic smoke G",
);
assertCliIssueRepresented(
  cliLogicScenarioG,
  "CLI task plan integration logic smoke G",
);

for (const [check, passed] of Object.entries(cliLogicScenarioHChecks)) {
  assert.equal(
    passed,
    true,
    `CLI task plan integration logic smoke H ${check} should pass`,
  );
}
assert.equal(
  cliLogicScenarioH.issues.some((issue) =>
    ["mapping.noExecution", "mapping.noWrites"].includes(issue.field),
  ),
  true,
  "CLI task plan integration logic smoke H should represent missing noExecution/noWrites proof",
);
assert.equal(
  cliLogicScenarioH.wiring.plannerInvocationAllowed,
  false,
  "CLI task plan integration logic smoke H planner invocation should be blocked",
);
assertCliPlannerNotAttempted(
  cliLogicScenarioH,
  "CLI task plan integration logic smoke H",
);
assert.equal(
  cliLogicScenarioH.safety.filesystemMutation,
  false,
  "CLI task plan integration logic smoke H filesystem mutation should be false",
);
assert.equal(
  cliLogicScenarioH.safety.executionEnabled,
  false,
  "CLI task plan integration logic smoke H execution should be false",
);

const cliLogicStrictNoExecutionNoWritesPlanner = createCliLogicCountingPlanner(
  cliLogicScenarioA.planner.planningResult,
);
const cliLogicStrictNoExecutionNoWritesMappingResult = {
  ...cliLogicScenarioA.mapping.mappingResult,
  planningInput: {
    ...cliLogicScenarioA.mapping.mappingResult.planningInput,
    runnerPlanningInput: {
      ...cliLogicScenarioA.mapping.mappingResult.planningInput.runnerPlanningInput,
      metadata: {
        runnerExecutionStarted: false,
        adapterCallsMade: false,
        executionEnabled: false,
        adapterCalls: false,
        verifierRun: false,
        verifierExecuted: false,
        auditEventsEmitted: false,
        taskPersistenceWritten: false,
        auditWrites: false,
        persistence: false,
        filesystemMutation: false,
        completedStateCreated: false,
      },
    },
    runnerPlanningInputData: undefined,
  },
};
const cliLogicStrictNoExecutionNoWritesResult =
  createCliTaskPlanPlannerIntegrationResult(
    createCliLogicInputFromResult(cliLogicScenarioA, {
      mappingResult: cliLogicStrictNoExecutionNoWritesMappingResult,
    }),
    {
      planner: cliLogicStrictNoExecutionNoWritesPlanner.planner,
      planningResultReference: cliLogicScenarioA.planner.planningResultReference,
    },
  );
assert.equal(
  cliLogicStrictNoExecutionNoWritesResult.mapping.runnerPlanningInputAvailable,
  true,
  "CLI task plan integration logic smoke H strict proof case should represent runnerPlanningInput availability",
);
assert.equal(
  cliLogicStrictNoExecutionNoWritesResult.mapping.ok,
  false,
  "CLI task plan integration logic smoke H strict proof case should fail mapping gate",
);
assert.equal(
  cliLogicStrictNoExecutionNoWritesResult.wiring.plannerInvocationAllowed,
  false,
  "CLI task plan integration logic smoke H strict proof case planner invocation should be blocked",
);
assert.equal(
  cliLogicStrictNoExecutionNoWritesPlanner.calls(),
  0,
  "CLI task plan integration logic smoke H strict proof case fake planner should not be invoked",
);
assertCliPlannerNotAttempted(
  cliLogicStrictNoExecutionNoWritesResult,
  "CLI task plan integration logic smoke H strict proof case",
);
assert.equal(
  cliLogicStrictNoExecutionNoWritesResult.ok,
  false,
  "CLI task plan integration logic smoke H strict proof case should fail closed",
);
assert.ok(
  ["mapping_failed", "blocked"].includes(
    cliLogicStrictNoExecutionNoWritesResult.status,
  ),
  "CLI task plan integration logic smoke H strict proof case should report mapping_failed or blocked",
);
assert.equal(
  cliLogicStrictNoExecutionNoWritesResult.issues.some((issue) =>
    ["mapping.noExecution", "mapping.noWrites"].includes(issue.field),
  ),
  true,
  "CLI task plan integration logic smoke H strict proof case should represent deterministic safety issue",
);
assert.equal(
  cliLogicStrictNoExecutionNoWritesResult.safety.executionEnabled,
  false,
  "CLI task plan integration logic smoke H strict proof case execution should remain disabled",
);
assert.equal(
  cliLogicStrictNoExecutionNoWritesResult.safety.filesystemMutation,
  false,
  "CLI task plan integration logic smoke H strict proof case filesystem mutation should remain false",
);
assert.equal(
  cliLogicStrictNoExecutionNoWritesResult.safety.completedStateCreated,
  false,
  "CLI task plan integration logic smoke H strict proof case completed state should not be created",
);

const cliLogicStrictNoExecutionOnlyOutsidePlanner = createCliLogicCountingPlanner(
  cliLogicScenarioA.planner.planningResult,
);
const cliLogicStrictNoExecutionOnlyOutsideResult =
  createCliTaskPlanPlannerIntegrationResult(
    createCliLogicInputFromResult(cliLogicScenarioA, {
      mappingResult: {
        ...cliLogicScenarioA.mapping.mappingResult,
        planningInput: {
          ...cliLogicScenarioA.mapping.mappingResult.planningInput,
          runnerPlanningInput: {
            ...cliLogicScenarioA.mapping.mappingResult.planningInput
              .runnerPlanningInput,
            metadata: {
              noWrites: true,
              runnerExecutionStarted: false,
              adapterCallsMade: false,
              executionEnabled: false,
              adapterCalls: false,
              verifierRun: false,
              verifierExecuted: false,
              auditEventsEmitted: false,
              taskPersistenceWritten: false,
              auditWrites: false,
              persistence: false,
              filesystemMutation: false,
              completedStateCreated: false,
            },
          },
          runnerPlanningInputData: undefined,
        },
        summary: {
          ...cliLogicScenarioA.mapping.mappingResult.summary,
          noExecution: true,
        },
      },
      noExecution: true,
    }),
    {
      planner: cliLogicStrictNoExecutionOnlyOutsidePlanner.planner,
      planningResultReference: cliLogicScenarioA.planner.planningResultReference,
    },
  );
assert.equal(
  cliLogicStrictNoExecutionOnlyOutsideResult.mapping.runnerPlanningInputAvailable,
  true,
  "CLI task plan integration logic smoke H strict outside-only noExecution should still have runnerPlanningInput",
);
assert.equal(
  cliLogicStrictNoExecutionOnlyOutsideResult.mapping.ok,
  false,
  "CLI task plan integration logic smoke H strict outside-only noExecution should fail mapping gate",
);
assert.equal(
  cliLogicStrictNoExecutionOnlyOutsideResult.wiring.plannerInvocationAllowed,
  false,
  "CLI task plan integration logic smoke H strict outside-only noExecution should block planner invocation",
);
assert.equal(
  cliLogicStrictNoExecutionOnlyOutsidePlanner.calls(),
  0,
  "CLI task plan integration logic smoke H strict outside-only noExecution fake planner should not run",
);
assert.equal(
  cliLogicStrictNoExecutionOnlyOutsideResult.issues.some(
    (issue) => issue.field === "mapping.noExecution",
  ),
  true,
  "CLI task plan integration logic smoke H strict outside-only noExecution should report deterministic issue",
);
assert.equal(
  cliLogicStrictNoExecutionOnlyOutsideResult.ok,
  false,
  "CLI task plan integration logic smoke H strict outside-only noExecution should fail closed",
);

const cliLogicStrictNoWritesNonTruePlanner = createCliLogicCountingPlanner(
  cliLogicScenarioA.planner.planningResult,
);
const cliLogicStrictNoWritesNonTrueResult =
  createCliTaskPlanPlannerIntegrationResult(
    createCliLogicInputFromResult(cliLogicScenarioA, {
      mappingResult: {
        ...cliLogicScenarioA.mapping.mappingResult,
        planningInput: {
          ...cliLogicScenarioA.mapping.mappingResult.planningInput,
          runnerPlanningInput: {
            ...cliLogicScenarioA.mapping.mappingResult.planningInput
              .runnerPlanningInput,
            metadata: {
              ...cliLogicScenarioA.mapping.mappingResult.planningInput
                .runnerPlanningInput.metadata,
              noWrites: "true",
            },
          },
          runnerPlanningInputData: undefined,
        },
        summary: {
          ...cliLogicScenarioA.mapping.mappingResult.summary,
          noWrites: true,
        },
      },
      noWrites: true,
    }),
    {
      planner: cliLogicStrictNoWritesNonTruePlanner.planner,
      planningResultReference: cliLogicScenarioA.planner.planningResultReference,
    },
  );
assert.equal(
  cliLogicStrictNoWritesNonTrueResult.mapping.ok,
  false,
  "CLI task plan integration logic smoke H strict non-true noWrites should fail mapping gate",
);
assert.equal(
  cliLogicStrictNoWritesNonTrueResult.wiring.plannerInvocationAllowed,
  false,
  "CLI task plan integration logic smoke H strict non-true noWrites should block planner invocation",
);
assert.equal(
  cliLogicStrictNoWritesNonTruePlanner.calls(),
  0,
  "CLI task plan integration logic smoke H strict non-true noWrites fake planner should not run",
);
assert.equal(
  cliLogicStrictNoWritesNonTrueResult.issues.some(
    (issue) => issue.field === "mapping.noWrites",
  ),
  true,
  "CLI task plan integration logic smoke H strict non-true noWrites should report deterministic issue",
);

const cliLogicStrictRunnerVerifierPlanner = createCliLogicCountingPlanner(
  cliLogicScenarioA.planner.planningResult,
);
const cliLogicStrictRunnerVerifierMappingResult = {
  ...cliLogicScenarioA.mapping.mappingResult,
  verifier: {
    ...cliLogicScenarioA.mapping.mappingResult.verifier,
    verifierRequired: true,
    completionGatedByVerifier: true,
  },
  planningInput: {
    ...cliLogicScenarioA.mapping.mappingResult.planningInput,
    runnerPlanningInput: {
      ...cliLogicScenarioA.mapping.mappingResult.planningInput.runnerPlanningInput,
      verifierRequirements: {
        ...cliLogicScenarioA.mapping.mappingResult.planningInput
          .runnerPlanningInput.verifierRequirements,
        verifierRequired: false,
        completionGatedByVerifier: false,
      },
    },
    runnerPlanningInputData: undefined,
  },
  summary: {
    ...cliLogicScenarioA.mapping.mappingResult.summary,
    verifierRequired: true,
    completionGatedByVerifier: true,
  },
};
const cliLogicStrictRunnerVerifierResult =
  createCliTaskPlanPlannerIntegrationResult(
    createCliLogicInputFromResult(cliLogicScenarioA, {
      mappingResult: cliLogicStrictRunnerVerifierMappingResult,
    }),
    {
      planner: cliLogicStrictRunnerVerifierPlanner.planner,
      planningResultReference: cliLogicScenarioA.planner.planningResultReference,
    },
  );
assert.equal(
  cliLogicStrictRunnerVerifierResult.mapping.runnerPlanningInputAvailable,
  true,
  "CLI task plan integration logic smoke H strict verifier case should represent runnerPlanningInput availability",
);
assert.equal(
  cliLogicStrictRunnerVerifierResult.mapping.verifierRequired,
  false,
  "CLI task plan integration logic smoke H strict verifier case should reject contradictory runner verifierRequired proof",
);
assert.equal(
  cliLogicStrictRunnerVerifierResult.mapping.completionGatedByVerifier,
  false,
  "CLI task plan integration logic smoke H strict verifier case should reject contradictory runner completion gate proof",
);
assert.equal(
  cliLogicStrictRunnerVerifierResult.wiring.plannerInvocationAllowed,
  false,
  "CLI task plan integration logic smoke H strict verifier case planner invocation should be blocked",
);
assert.equal(
  cliLogicStrictRunnerVerifierPlanner.calls(),
  0,
  "CLI task plan integration logic smoke H strict verifier case fake planner should not be invoked",
);
assertCliPlannerNotAttempted(
  cliLogicStrictRunnerVerifierResult,
  "CLI task plan integration logic smoke H strict verifier case",
);
assert.equal(
  cliLogicStrictRunnerVerifierResult.ok,
  false,
  "CLI task plan integration logic smoke H strict verifier case should fail closed",
);
assert.equal(
  cliLogicStrictRunnerVerifierResult.status,
  "blocked",
  "CLI task plan integration logic smoke H strict verifier case should report blocked",
);
assert.equal(
  cliLogicStrictRunnerVerifierResult.issues.some((issue) =>
    [
      "mapping.verifierRequired",
      "mapping.completionGatedByVerifier",
    ].includes(issue.field),
  ),
  true,
  "CLI task plan integration logic smoke H strict verifier case should represent deterministic verifier issue",
);
assert.equal(
  cliLogicStrictRunnerVerifierResult.safety.executionEnabled,
  false,
  "CLI task plan integration logic smoke H strict verifier case execution should remain disabled",
);
assert.equal(
  cliLogicStrictRunnerVerifierResult.safety.filesystemMutation,
  false,
  "CLI task plan integration logic smoke H strict verifier case filesystem mutation should remain false",
);
assert.equal(
  cliLogicStrictRunnerVerifierResult.safety.completedStateCreated,
  false,
  "CLI task plan integration logic smoke H strict verifier case completed state should not be created",
);

const cliLogicVerifierOnlyOutsidePlanner = createCliLogicCountingPlanner(
  cliLogicScenarioA.planner.planningResult,
);
const cliLogicVerifierOnlyOutsideResult = createCliTaskPlanPlannerIntegrationResult(
  createCliLogicInputFromResult(cliLogicScenarioA, {
    mappingResult: {
      ...cliLogicScenarioA.mapping.mappingResult,
      verifier: {
        ...cliLogicScenarioA.mapping.mappingResult.verifier,
        verifierRequired: true,
        completionGatedByVerifier: true,
      },
      planningInput: {
        ...cliLogicScenarioA.mapping.mappingResult.planningInput,
        runnerPlanningInput: {
          ...cliLogicScenarioA.mapping.mappingResult.planningInput
            .runnerPlanningInput,
          verifierRequirements: {
            issues: [],
          },
        },
        runnerPlanningInputData: undefined,
      },
      summary: {
        ...cliLogicScenarioA.mapping.mappingResult.summary,
        verifierRequired: true,
        completionGatedByVerifier: true,
      },
    },
  }),
  {
    planner: cliLogicVerifierOnlyOutsidePlanner.planner,
    planningResultReference: cliLogicScenarioA.planner.planningResultReference,
  },
);
assert.equal(
  cliLogicVerifierOnlyOutsideResult.mapping.runnerPlanningInputAvailable,
  true,
  "CLI task plan integration logic smoke H outside-only verifier proof should still have runnerPlanningInput",
);
assert.equal(
  cliLogicVerifierOnlyOutsideResult.mapping.verifierRequired,
  false,
  "CLI task plan integration logic smoke H outside-only verifier proof should reject missing runner verifierRequired",
);
assert.equal(
  cliLogicVerifierOnlyOutsideResult.mapping.completionGatedByVerifier,
  false,
  "CLI task plan integration logic smoke H outside-only verifier proof should reject missing runner completion gate",
);
assert.equal(
  cliLogicVerifierOnlyOutsideResult.wiring.plannerInvocationAllowed,
  false,
  "CLI task plan integration logic smoke H outside-only verifier proof should block planner invocation",
);
assert.equal(
  cliLogicVerifierOnlyOutsidePlanner.calls(),
  0,
  "CLI task plan integration logic smoke H outside-only verifier proof fake planner should not run",
);
assert.equal(
  cliLogicVerifierOnlyOutsideResult.issues.some((issue) =>
    [
      "mapping.verifierRequired",
      "mapping.completionGatedByVerifier",
    ].includes(issue.field),
  ),
  true,
  "CLI task plan integration logic smoke H outside-only verifier proof should report deterministic issue",
);

for (const [check, passed] of Object.entries(cliLogicScenarioIChecks)) {
  assert.equal(
    passed,
    true,
    `CLI task plan integration logic smoke I ${check} should pass`,
  );
}
assert.equal(
  cliLogicScenarioI.status,
  "blocked",
  "CLI task plan integration logic smoke I should report blocked",
);
assert.equal(
  cliLogicScenarioI.wiring.plannerInvocationAllowed,
  false,
  "CLI task plan integration logic smoke I planner invocation should be blocked",
);
assertCliPlannerNotAttempted(
  cliLogicScenarioI,
  "CLI task plan integration logic smoke I",
);
assertCliIssueRepresented(
  cliLogicScenarioI,
  "CLI task plan integration logic smoke I",
);

const cliLogicHostileTextPlanner = createCliLogicCountingPlanner(
  cliLogicScenarioA.planner.planningResult,
);
const cliLogicHostileTextResult = createCliTaskPlanPlannerIntegrationResult(
  createCliLogicInputFromResult(cliLogicScenarioA, {
    mappingResult: {
      ...cliLogicScenarioA.mapping.mappingResult,
      planningInput: {
        ...cliLogicScenarioA.mapping.mappingResult.planningInput,
        runnerPlanningInput: {
          ...cliLogicScenarioA.mapping.mappingResult.planningInput
            .runnerPlanningInput,
          metadata: {
            ...cliLogicScenarioA.mapping.mappingResult.planningInput
              .runnerPlanningInput.metadata,
            approvalClaim: "approved",
            verifierClaim: "verified",
            taskClaim: "all done",
          },
        },
        runnerPlanningInputData: undefined,
      },
    },
  }),
  {
    planner: cliLogicHostileTextPlanner.planner,
    planningResultReference: cliLogicScenarioA.planner.planningResultReference,
  },
);
assert.equal(
  cliLogicHostileTextResult.ok,
  false,
  "CLI task plan integration logic smoke I hostile text claims should fail closed",
);
assert.equal(
  cliLogicHostileTextResult.wiring.plannerInvocationAllowed,
  false,
  "CLI task plan integration logic smoke I hostile text claims should block planner invocation",
);
assert.equal(
  cliLogicHostileTextPlanner.calls(),
  0,
  "CLI task plan integration logic smoke I hostile text claims fake planner should not run",
);
assert.equal(
  cliLogicHostileTextResult.issues.some(
    (issue) =>
      issue.code === "cli_task_plan_unsafe_represented_metadata" &&
      issue.field?.includes("approvalClaim"),
  ),
  true,
  "CLI task plan integration logic smoke I hostile approved text should be represented as unsafe",
);
assert.equal(
  cliLogicHostileTextResult.issues.some(
    (issue) =>
      issue.code === "cli_task_plan_unsafe_represented_metadata" &&
      issue.field?.includes("verifierClaim"),
  ),
  true,
  "CLI task plan integration logic smoke I hostile verified text should be represented as unsafe",
);
assert.equal(
  cliLogicHostileTextResult.issues.some(
    (issue) =>
      issue.code === "cli_task_plan_unsafe_represented_metadata" &&
      issue.field?.includes("taskClaim"),
  ),
  true,
  "CLI task plan integration logic smoke I hostile all-done text should be represented as unsafe",
);

for (const [check, passed] of Object.entries(cliLogicScenarioJChecks)) {
  assert.equal(
    passed,
    true,
    `CLI task plan integration logic smoke J ${check} should pass`,
  );
}
assert.equal(
  cliLogicScenarioJ.planner.attempted,
  true,
  "CLI task plan integration logic smoke J planner should be attempted",
);
assert.equal(
  cliLogicScenarioJ.planner.ok,
  false,
  "CLI task plan integration logic smoke J planner should fail",
);
assert.equal(
  cliLogicScenarioJ.status,
  "planner_failed",
  "CLI task plan integration logic smoke J should report planner_failed",
);
assert.equal(
  cliLogicScenarioJ.exitCode,
  "planner_failure",
  "CLI task plan integration logic smoke J should report planner failure",
);
assert.equal(
  cliLogicScenarioJ.planner.planningResult?.steps.some(
    (step) => step.state === "completed",
  ) ?? false,
  false,
  "CLI task plan integration logic smoke J should not create completed planner state",
);
assertCliIssueRepresented(
  cliLogicScenarioJ,
  "CLI task plan integration logic smoke J",
);

assertCliFields(
  cliLogicScenarioK,
  Object.keys(cliLogicScenarioKFields),
  "CLI task plan integration logic smoke K human render model",
);
assert.deepEqual(
  createCliTaskPlanHumanRenderModel(cliLogicScenarioA),
  cliLogicScenarioK,
  "CLI task plan integration logic smoke K human render model should come from helper",
);
assertCliSideEffectFalseFields(
  cliLogicScenarioK,
  "CLI task plan integration logic smoke K human render model",
);
assert.equal(
  cliLogicScenarioK.realExecution,
  false,
  "CLI task plan integration logic smoke K real execution should be false",
);

assertCliFields(
  cliLogicScenarioL,
  Object.keys(cliLogicScenarioLFields),
  "CLI task plan integration logic smoke L JSON render model",
);
assert.deepEqual(
  createCliTaskPlanJsonRenderModel(cliLogicScenarioA),
  cliLogicScenarioL,
  "CLI task plan integration logic smoke L JSON render model should come from helper",
);
assertCliSideEffectFalseFields(
  cliLogicScenarioL.safety,
  "CLI task plan integration logic smoke L JSON render model safety",
);

for (const [check, passed] of Object.entries(cliLogicScenarioMChecks)) {
  assert.equal(
    passed,
    true,
    `CLI task plan integration logic smoke M ${check} should pass`,
  );
}
assertCliJsonOnlyBehavior(
  cliLogicScenarioM,
  "CLI task plan integration logic smoke M",
);
assert.equal(
  cliLogicScenarioM.ok,
  false,
  "CLI task plan integration logic smoke M should fail",
);
assert.notEqual(
  cliLogicScenarioM.exitCode,
  "success",
  "CLI task plan integration logic smoke M exit code should be non-success",
);

const cliLogicMissingPlannerDependencyResult =
  createCliTaskPlanPlannerIntegrationResult(
    createCliLogicInputFromResult(cliLogicScenarioA),
  );
assert.equal(
  cliLogicMissingPlannerDependencyResult.wiring.attempted,
  true,
  "CLI task plan integration logic smoke Q missing dependency should attempt wiring after safety gates",
);
assert.equal(
  cliLogicMissingPlannerDependencyResult.wiring.ok,
  false,
  "CLI task plan integration logic smoke Q missing dependency should fail wiring",
);
assert.equal(
  cliLogicMissingPlannerDependencyResult.wiring.plannerDependencyInjected,
  false,
  "CLI task plan integration logic smoke Q missing dependency should report no injected planner",
);
assert.equal(
  cliLogicMissingPlannerDependencyResult.wiring.plannerInvocationAllowed,
  false,
  "CLI task plan integration logic smoke Q missing dependency should block planner invocation",
);
assert.equal(
  cliLogicMissingPlannerDependencyResult.issues.some(
    (issue) => issue.code === "cli_task_plan_planner_dependency_missing",
  ),
  true,
  "CLI task plan integration logic smoke Q missing dependency should report deterministic issue",
);
assert.equal(
  cliLogicMissingPlannerDependencyResult.status,
  "blocked",
  "CLI task plan integration logic smoke Q missing dependency should report blocked",
);
assert.equal(
  cliLogicMissingPlannerDependencyResult.exitCode,
  "blocked",
  "CLI task plan integration logic smoke Q missing dependency should use blocked exit code",
);
assertCliPlannerNotAttempted(
  cliLogicMissingPlannerDependencyResult,
  "CLI task plan integration logic smoke Q missing dependency",
);

assert.deepEqual(
  summarizeCliTaskPlanPlannerIntegrationResult(cliLogicScenarioA),
  cliLogicScenarioN,
  "CLI task plan integration logic smoke N summary should come from helper",
);
const cliLogicScenarioNExpectedFalseFields = new Set([
  "json",
  "executionEnabled",
  "adapterCalls",
  "auditWrites",
  "verifierRun",
  "persistence",
  "filesystemMutation",
  "completedStateCreated",
]);
for (const [field, value] of Object.entries(cliLogicScenarioNMatches)) {
  if (typeof value === "boolean") {
    assert.equal(
      value,
      !cliLogicScenarioNExpectedFalseFields.has(field),
      `CLI task plan integration logic smoke N ${field} should match`,
    );
  }
}
for (const [message, result] of [
  ["CLI task plan integration logic smoke N success", cliLogicScenarioA],
  ["CLI task plan integration logic smoke N JSON success", cliLogicScenarioB],
  ["CLI task plan integration logic smoke N parser failure", cliLogicScenarioC],
  ["CLI task plan integration logic smoke N validation failure", cliLogicScenarioD],
  ["CLI task plan integration logic smoke N unsupported mapping", cliLogicScenarioE],
  [
    "CLI task plan integration logic smoke N missing runnerPlanningInput",
    cliLogicScenarioF,
  ],
  ["CLI task plan integration logic smoke N missing verifier gate", cliLogicScenarioG],
  [
    "CLI task plan integration logic smoke N missing noExecution/noWrites",
    cliLogicScenarioH,
  ],
  [
    "CLI task plan integration logic smoke N outside-only noExecution proof",
    cliLogicStrictNoExecutionOnlyOutsideResult,
  ],
  [
    "CLI task plan integration logic smoke N non-true noWrites proof",
    cliLogicStrictNoWritesNonTrueResult,
  ],
  [
    "CLI task plan integration logic smoke N contradictory runner verifier gate",
    cliLogicStrictRunnerVerifierResult,
  ],
  [
    "CLI task plan integration logic smoke N outside-only verifier proof",
    cliLogicVerifierOnlyOutsideResult,
  ],
  ["CLI task plan integration logic smoke N unsafe metadata", cliLogicScenarioI],
  [
    "CLI task plan integration logic smoke N hostile text claims",
    cliLogicHostileTextResult,
  ],
  [
    "CLI task plan integration logic smoke N missing planner dependency",
    cliLogicMissingPlannerDependencyResult,
  ],
  ["CLI task plan integration logic smoke N planner failure", cliLogicScenarioJ],
]) {
  assertCliLogicSummaryMatchesResult(result, message);
}

assert.deepEqual(
  cliLogicScenarioO,
  {
    planned: "success",
    parser_failed: "parser_failure",
    validation_failed: "validation_failure",
    unsupported_mapping: "unsupported_mapping",
    mapping_failed: "mapping_failure",
    wiring_failed: "wiring_failure",
    planner_failed: "planner_failure",
    blocked: "blocked",
    failed: "unknown_failure",
    unknown: "unknown_failure",
  },
  "CLI task plan integration logic smoke O exit code mapping should remain stable",
);
for (const [status, exitCode] of Object.entries(cliLogicScenarioO)) {
  assert.equal(
    mapCliTaskPlanStatusToExitCode(status),
    exitCode,
    `CLI task plan integration logic smoke O ${status} exit code should match helper`,
  );
}

for (const [check, passed] of Object.entries(cliLogicScenarioP)) {
  assert.equal(
    passed,
    true,
    `CLI task plan integration logic smoke P ${check} should pass`,
  );
}
const cliLogicDeterministicPlannerOne = createCliLogicCountingPlanner(
  cliLogicScenarioA.planner.planningResult,
);
const cliLogicDeterministicPlannerTwo = createCliLogicCountingPlanner(
  cliLogicScenarioA.planner.planningResult,
);
const cliLogicDeterministicInput = createCliLogicInputFromResult(cliLogicScenarioA);
const cliLogicDeterministicRunOne = createCliTaskPlanPlannerIntegrationResult(
  cliLogicDeterministicInput,
  {
    planner: cliLogicDeterministicPlannerOne.planner,
    planningResultReference: cliLogicScenarioA.planner.planningResultReference,
  },
);
const cliLogicDeterministicRunTwo = createCliTaskPlanPlannerIntegrationResult(
  cliLogicDeterministicInput,
  {
    planner: cliLogicDeterministicPlannerTwo.planner,
    planningResultReference: cliLogicScenarioA.planner.planningResultReference,
  },
);
assert.deepEqual(
  cliLogicResultSignature(cliLogicDeterministicRunOne),
  cliLogicResultSignature(cliLogicDeterministicRunTwo),
  "CLI task plan integration logic smoke P repeated helper output should be deterministic",
);
assert.equal(
  cliLogicDeterministicPlannerOne.calls(),
  1,
  "CLI task plan integration logic smoke P first fake planner should be called once",
);
assert.equal(
  cliLogicDeterministicPlannerTwo.calls(),
  1,
  "CLI task plan integration logic smoke P second fake planner should be called once",
);

assert.equal(
  cliLogicScenarioQ.gatesPass.plannerInvocationAllowed,
  true,
  "CLI task plan integration logic smoke Q gates should allow planner on success",
);
assert.equal(
  cliLogicScenarioQ.plannedAfterGatesPass.wiring.plannerInvocationAllowed,
  true,
  "CLI task plan integration logic smoke Q helper should allow planner after gates pass",
);
assert.equal(
  cliLogicScenarioQ.calls.gatesPassedPlanner,
  1,
  "CLI task plan integration logic smoke Q exported fake planner should run only on success",
);
assert.equal(
  cliLogicScenarioQ.calls.parserFailurePlanner,
  0,
  "CLI task plan integration logic smoke Q fake planner should not run for parser failure",
);
assert.equal(
  cliLogicScenarioQ.calls.unsupportedMappingPlanner,
  0,
  "CLI task plan integration logic smoke Q fake planner should not run for unsupported mapping",
);
assert.equal(
  cliLogicScenarioQ.calls.missingRunnerPlanningInputPlanner,
  0,
  "CLI task plan integration logic smoke Q fake planner should not run without runnerPlanningInput",
);
assert.equal(
  cliLogicScenarioQ.calls.missingVerifierPlanner,
  0,
  "CLI task plan integration logic smoke Q fake planner should not run without verifier gate",
);
assert.equal(
  cliLogicScenarioQ.calls.missingNoExecutionNoWritesPlanner,
  0,
  "CLI task plan integration logic smoke Q fake planner should not run without noExecution/noWrites proof",
);
assert.equal(
  cliLogicScenarioQ.noDirectPlanAgenticRunnerImportOrCall,
  true,
  "CLI task plan integration logic smoke Q should not need direct planAgenticRunner call",
);

const plannerGatedScenarios = [
  [
    "parser failure",
    createCliLogicInputFromResult(cliLogicScenarioA, {
      parserResult: cliLogicScenarioC.parser.parserResult,
    }),
  ],
  [
    "validation failure",
    createCliLogicInputFromResult(cliLogicScenarioA, {
      parserResult: cliLogicScenarioD.parser.parserResult,
    }),
  ],
  [
    "unsupported mapping",
    createCliLogicInputFromResult(cliLogicScenarioA, {
      mappingResult: cliLogicScenarioE.mapping.mappingResult,
    }),
  ],
  [
    "missing runnerPlanningInput",
    createCliLogicInputFromResult(cliLogicScenarioA, {
      mappingResult: cliLogicScenarioF.mapping.mappingResult,
    }),
  ],
  [
    "missing verifier gate",
    createCliLogicInputFromResult(cliLogicScenarioA, {
      mappingResult: cliLogicScenarioG.mapping.mappingResult,
    }),
  ],
  [
    "missing noExecution/noWrites",
    createCliLogicInputFromResult(cliLogicScenarioA, {
      mappingResult: cliLogicScenarioH.mapping.mappingResult,
    }),
  ],
  [
    "outside-only noExecution proof",
    createCliLogicInputFromResult(cliLogicScenarioA, {
      mappingResult: cliLogicStrictNoExecutionOnlyOutsideResult.mapping
        .mappingResult,
    }),
  ],
  [
    "non-true noWrites proof",
    createCliLogicInputFromResult(cliLogicScenarioA, {
      mappingResult: cliLogicStrictNoWritesNonTrueResult.mapping.mappingResult,
    }),
  ],
  [
    "contradictory runner verifier gate",
    createCliLogicInputFromResult(cliLogicScenarioA, {
      mappingResult: cliLogicStrictRunnerVerifierMappingResult,
    }),
  ],
  [
    "outside-only verifier proof",
    createCliLogicInputFromResult(cliLogicScenarioA, {
      mappingResult: cliLogicVerifierOnlyOutsideResult.mapping.mappingResult,
    }),
  ],
  [
    "unsafe represented metadata",
    createCliLogicInputFromResult(cliLogicScenarioA, {
      parserResult: {
        ...cliLogicScenarioA.parser.parserResult,
        summary: {
          ...cliLogicScenarioA.parser.parserResult.summary,
          runnerPlanningExecuted: true,
        },
      },
    }),
  ],
];

const gatedSuccessPlanner = createCliLogicCountingPlanner(
  cliLogicScenarioA.planner.planningResult,
);
const gatedSuccessResult = createCliTaskPlanPlannerIntegrationResult(
  createCliLogicInputFromResult(cliLogicScenarioA),
  {
    planner: gatedSuccessPlanner.planner,
    planningResultReference: cliLogicScenarioA.planner.planningResultReference,
  },
);
assert.equal(
  gatedSuccessResult.wiring.plannerInvocationAllowed,
  true,
  "CLI task plan integration logic smoke Q in-memory fake planner should be allowed after gates pass",
);
assert.equal(
  gatedSuccessPlanner.calls(),
  1,
  "CLI task plan integration logic smoke Q in-memory fake planner should be invoked after gates pass",
);

for (const [name, input] of plannerGatedScenarios) {
  const blockedPlanner = createCliLogicCountingPlanner(
    cliLogicScenarioA.planner.planningResult,
  );
  const blockedResult = createCliTaskPlanPlannerIntegrationResult(input, {
    planner: blockedPlanner.planner,
    planningResultReference: cliLogicScenarioA.planner.planningResultReference,
  });

  assert.equal(
    blockedResult.wiring.plannerInvocationAllowed,
    false,
    `CLI task plan integration logic smoke Q fake planner should be disallowed for ${name}`,
  );
  assert.equal(
    blockedPlanner.calls(),
    0,
    `CLI task plan integration logic smoke Q fake planner should not run for ${name}`,
  );
  assertCliPlannerNotAttempted(
    blockedResult,
    `CLI task plan integration logic smoke Q ${name}`,
  );
}

const topLevelBypassPlanner = createCliLogicCountingPlanner(
  cliLogicScenarioA.planner.planningResult,
);
const cliLogicTopLevelPlannerInputBypassInput = createCliLogicInputFromResult(
  cliLogicScenarioA,
  {
    mappingResult: cliLogicScenarioF.mapping.mappingResult,
    plannerInput: cliLogicScenarioA.mapping.runnerPlanningInput,
  },
);
assert.equal(
  Object.hasOwn(cliLogicTopLevelPlannerInputBypassInput, "plannerInput"),
  true,
  "CLI task plan integration logic smoke R should represent a top-level plannerInput field",
);
const cliLogicTopLevelPlannerInputBypassResult =
  createCliTaskPlanPlannerIntegrationResult(
    cliLogicTopLevelPlannerInputBypassInput,
    {
      planner: topLevelBypassPlanner.planner,
      planningResultReference: cliLogicScenarioA.planner.planningResultReference,
    },
  );
const cliLogicTopLevelPlannerInputBypassRepeat =
  createCliTaskPlanPlannerIntegrationResult(cliLogicTopLevelPlannerInputBypassInput, {
    planner: createCliLogicCountingPlanner(cliLogicScenarioA.planner.planningResult)
      .planner,
    planningResultReference: cliLogicScenarioA.planner.planningResultReference,
  });
assert.equal(
  cliLogicTopLevelPlannerInputBypassResult.mapping.runnerPlanningInputAvailable,
  false,
  "CLI task plan integration logic smoke R mapping runnerPlanningInput should remain unavailable",
);
assert.equal(
  cliLogicTopLevelPlannerInputBypassResult.mapping.mappingResult?.planningInput
    .runnerPlanningInput,
  undefined,
  "CLI task plan integration logic smoke R mappingResult runnerPlanningInput should remain absent",
);
assert.equal(
  cliLogicTopLevelPlannerInputBypassResult.wiring.plannerInvocationAllowed,
  false,
  "CLI task plan integration logic smoke R top-level plannerInput should not allow planner invocation",
);
assert.equal(
  topLevelBypassPlanner.calls(),
  0,
  "CLI task plan integration logic smoke R fake planner should not be invoked",
);
assert.equal(
  cliLogicTopLevelPlannerInputBypassResult.ok,
  false,
  "CLI task plan integration logic smoke R should fail closed",
);
assert.ok(
  ["mapping_failed", "blocked"].includes(
    cliLogicTopLevelPlannerInputBypassResult.status,
  ),
  "CLI task plan integration logic smoke R should report mapping_failed or blocked",
);
assert.equal(
  cliLogicTopLevelPlannerInputBypassResult.issues.some(
    (issue) => issue.code === "cli_task_plan_runner_planning_input_missing",
  ),
  true,
  "CLI task plan integration logic smoke R should represent deterministic missing runnerPlanningInput issue",
);
assert.deepEqual(
  cliLogicTopLevelPlannerInputBypassResult.issues.map((issue) => issue.code),
  cliLogicTopLevelPlannerInputBypassRepeat.issues.map((issue) => issue.code),
  "CLI task plan integration logic smoke R issue ordering should be deterministic",
);

for (const [message, result] of [
  ["CLI task plan integration logic smoke S success", cliLogicScenarioA],
  ["CLI task plan integration logic smoke S JSON success", cliLogicScenarioB],
  ["CLI task plan integration logic smoke S parser failure", cliLogicScenarioC],
  ["CLI task plan integration logic smoke S validation failure", cliLogicScenarioD],
  ["CLI task plan integration logic smoke S unsupported mapping", cliLogicScenarioE],
  [
    "CLI task plan integration logic smoke S missing runnerPlanningInput",
    cliLogicScenarioF,
  ],
  ["CLI task plan integration logic smoke S missing verifier gate", cliLogicScenarioG],
  [
    "CLI task plan integration logic smoke S missing noExecution/noWrites",
    cliLogicScenarioH,
  ],
  [
    "CLI task plan integration logic smoke S missing strict noExecution/noWrites proof",
    cliLogicStrictNoExecutionNoWritesResult,
  ],
  [
    "CLI task plan integration logic smoke S outside-only noExecution proof",
    cliLogicStrictNoExecutionOnlyOutsideResult,
  ],
  [
    "CLI task plan integration logic smoke S non-true noWrites proof",
    cliLogicStrictNoWritesNonTrueResult,
  ],
  [
    "CLI task plan integration logic smoke S contradictory runner verifier gate",
    cliLogicStrictRunnerVerifierResult,
  ],
  [
    "CLI task plan integration logic smoke S outside-only verifier proof",
    cliLogicVerifierOnlyOutsideResult,
  ],
  ["CLI task plan integration logic smoke S unsafe metadata", cliLogicScenarioI],
  [
    "CLI task plan integration logic smoke S hostile text claims",
    cliLogicHostileTextResult,
  ],
  [
    "CLI task plan integration logic smoke S missing planner dependency",
    cliLogicMissingPlannerDependencyResult,
  ],
  ["CLI task plan integration logic smoke S planner failure", cliLogicScenarioJ],
  [
    "CLI task plan integration logic smoke S top-level bypass",
    cliLogicTopLevelPlannerInputBypassResult,
  ],
]) {
  assertCliLogicNoExecutionNoWrites(result, message);
  for (const field of [
    "cliCommandChanged",
    "cliCommandExecuted",
    "cliRan",
    "outputPrinted",
    "outputRendered",
    "renderedToStdout",
    "filesystemIoHappened",
    "filesystemMutationHappened",
    "directPlanAgenticRunnerCall",
    "runnerExecutionHappened",
    "runnerExecuted",
    "adapterCallHappened",
    "auditWriteHappened",
    "verifierExecutionHappened",
    "persistenceHappened",
    "trustedModelSelfReportCompletion",
    "trustedModelSelfReportApproval",
  ]) {
    assert.equal(
      Object.hasOwn(result, field),
      false,
      `${message} must not expose ${field}`,
    );
  }
  assert.equal(
    result.safety.executionEnabled,
    false,
    `${message} must not enable execution`,
  );
  assert.equal(
    result.safety.adapterCalls,
    false,
    `${message} must not call adapters`,
  );
  assert.equal(
    result.safety.auditWrites,
    false,
    `${message} must not write audit events`,
  );
  assert.equal(
    result.safety.verifierRun,
    false,
    `${message} must not run verifier`,
  );
  assert.equal(
    result.safety.persistence,
    false,
    `${message} must not persist task state`,
  );
  assert.equal(
    result.safety.filesystemMutation,
    false,
    `${message} must not mutate filesystem`,
  );
  assert.equal(
    result.safety.completedStateCreated,
    false,
    `${message} must not create completed state`,
  );
}

assert.deepEqual(
  cliTaskPlanPlannerIntegrationLogicExamples.successful,
  cliLogicScenarioA,
  "CLI task plan integration logic examples index should expose successful scenario",
);
assert.deepEqual(
  cliTaskPlanPlannerIntegrationLogicExamples.dependencyInjectedPlanner,
  cliLogicScenarioQ,
  "CLI task plan integration logic examples index should expose dependency-injected planner scenario",
);

console.log("CLI task plan planner integration logic smoke tests passed");

const taskContractMapperLogicMinimalInput =
  createTaskContractMapperLogicSmokeInput();
const taskContractMapperLogicMinimalResult =
  mapTaskContractToRunnerPlanningInput(taskContractMapperLogicMinimalInput);

assert.equal(
  taskContractMapperLogicMinimalResult.taskId,
  taskContractMapperLogicMinimalInput.taskId,
  "task contract mapper logic smoke A should represent task id",
);
assert.equal(
  taskContractMapperLogicMinimalResult.mode,
  "plan",
  "task contract mapper logic smoke A should represent plan mode",
);
assert.equal(
  taskContractMapperLogicMinimalInput.noExecution,
  true,
  "task contract mapper logic smoke A input should keep noExecution",
);
assert.equal(
  taskContractMapperLogicMinimalInput.noWrites,
  true,
  "task contract mapper logic smoke A input should keep noWrites",
);
assert.equal(
  taskContractMapperLogicMinimalResult.summary.noExecution,
  true,
  "task contract mapper logic smoke A result should keep noExecution",
);
assert.equal(
  taskContractMapperLogicMinimalResult.summary.noWrites,
  true,
  "task contract mapper logic smoke A result should keep noWrites",
);
assert.equal(
  taskContractMapperLogicMinimalResult.verifier.verifierRequired,
  true,
  "task contract mapper logic smoke A should require verifier",
);
assert.equal(
  taskContractMapperLogicMinimalResult.verifier.completionGatedByVerifier,
  true,
  "task contract mapper logic smoke A should gate completion by verifier",
);
assert.equal(
  taskContractMapperLogicMinimalResult.planningInput.runnerPlanningInput
    ?.metadata?.noExecution,
  true,
  "task contract mapper logic smoke A actual runnerPlanningInput metadata should prove noExecution",
);
assert.equal(
  taskContractMapperLogicMinimalResult.planningInput.runnerPlanningInput
    ?.metadata?.noWrites,
  true,
  "task contract mapper logic smoke A actual runnerPlanningInput metadata should prove noWrites",
);
assert.equal(
  taskContractMapperLogicMinimalResult.planningInput.runnerPlanningInput
    ?.verifierRequirements?.verifierRequired,
  true,
  "task contract mapper logic smoke A actual runnerPlanningInput should require verifier",
);
assert.equal(
  taskContractMapperLogicMinimalResult.planningInput.runnerPlanningInput
    ?.verifierRequirements?.completionGatedByVerifier,
  true,
  "task contract mapper logic smoke A actual runnerPlanningInput should gate completion by verifier",
);
assertTaskContractMappingNoRuntimeArtifacts(
  taskContractMapperLogicMinimalResult,
  "task contract mapper logic smoke A",
);

const taskContractMapperLogicFallbackInput =
  createTaskContractMapperLogicSmokeInput({
    options: {
      allowSingleWorkItemFallback: true,
      createDefaultBatch: true,
    },
  });
const taskContractMapperLogicFallbackResult =
  mapTaskContractToRunnerPlanningInput(taskContractMapperLogicFallbackInput);

assert.equal(
  taskContractMapperLogicFallbackInput.options.allowSingleWorkItemFallback,
  true,
  "task contract mapper logic smoke B should enable fallback option",
);
assert.equal(
  taskContractMapperLogicFallbackResult.workItems.length,
  1,
  "task contract mapper logic smoke B should produce one fallback work item",
);
assert.equal(
  taskContractMapperLogicFallbackResult.workItems[0].derivedFrom,
  "single_work_item_fallback",
  "task contract mapper logic smoke B work item should be fallback derived",
);
assert.equal(
  taskContractMapperLogicFallbackResult.workItems[0].initialState,
  "pending",
  "task contract mapper logic smoke B work item should start pending",
);
assert.equal(
  taskContractMapperLogicFallbackResult.batches.length,
  1,
  "task contract mapper logic smoke B should represent one default batch",
);
assert.equal(
  taskContractMapperLogicFallbackResult.batches[0].derivedDefaultBatch,
  true,
  "task contract mapper logic smoke B should represent default batch",
);
assert.equal(
  taskContractMapperLogicFallbackResult.batches[0].expectedItemCount,
  1,
  "task contract mapper logic smoke B batch expected count should be one",
);
assert.equal(
  taskContractMapperLogicFallbackResult.summary.workItemCount,
  1,
  "task contract mapper logic smoke B summary work item count should be one",
);
assert.equal(
  taskContractMapperLogicFallbackResult.summary.batchCount,
  1,
  "task contract mapper logic smoke B summary batch count should be one",
);

const taskContractMapperLogicExplicitTask =
  createTaskContractMapperLogicSmokeTask({
    id: "TASK-0249-EXPLICIT",
    workItems: [
      {
        id: "work-item:TASK-0249-EXPLICIT:001",
        title: "First explicit work item.",
      },
      {
        id: "work-item:TASK-0249-EXPLICIT:002",
        title: "Second explicit work item.",
      },
    ],
  });
const taskContractMapperLogicExplicitResult =
  mapTaskContractToRunnerPlanningInput(
    createTaskContractMapperLogicSmokeInput({
      task: taskContractMapperLogicExplicitTask,
      options: {
        requireExplicitWorkItems: true,
      },
    }),
  );

if (
  taskContractMapperLogicExplicitResult.status === "unsupported" ||
  taskContractMapperLogicExplicitResult.issues.some(
    (issue) => issue.code === "task_contract_explicit_work_items_unsupported",
  )
) {
  assert.equal(
    taskContractMapperLogicExplicitResult.ok,
    false,
    "task contract mapper logic smoke C unsupported explicit mapping should not be ok",
  );
  assert.ok(
    taskContractMapperLogicExplicitResult.issues.some(
      (issue) =>
        issue.code === "task_contract_explicit_work_items_unsupported" ||
        issue.code === "task_contract_explicit_work_items_required",
    ),
    "task contract mapper logic smoke C should represent unsupported explicit work item issue",
  );
  assert.equal(
    taskContractMapperLogicExplicitResult.workItems.length,
    0,
    "task contract mapper logic smoke C should not fake successful explicit work item mappings",
  );
} else {
  assert.deepEqual(
    taskContractMapperLogicExplicitResult.workItems.map(
      (workItem) => workItem.workItemId,
    ),
    [
      "work-item:TASK-0249-EXPLICIT:001",
      "work-item:TASK-0249-EXPLICIT:002",
    ],
    "task contract mapper logic smoke C explicit work item ids should be deterministic when supported",
  );
  assert.deepEqual(
    taskContractMapperLogicExplicitResult.batches.flatMap(
      (batch) => batch.workItemIds,
    ),
    taskContractMapperLogicExplicitResult.workItems.map(
      (workItem) => workItem.workItemId,
    ),
    "task contract mapper logic smoke C batch should reference mapped work item ids when supported",
  );
  assert.equal(
    taskContractMapperLogicExplicitResult.batches.reduce(
      (count, batch) => count + batch.expectedItemCount,
      0,
    ),
    taskContractMapperLogicExplicitResult.workItems.length,
    "task contract mapper logic smoke C expected count should match mapped work items when supported",
  );
}
assertTaskContractMappingNoRuntimeArtifacts(
  taskContractMapperLogicExplicitResult,
  "task contract mapper logic smoke C",
);

const taskContractMapperLogicDuplicateTask =
  createTaskContractMapperLogicSmokeTask({
    id: "TASK-0249-DUPLICATE",
    workItems: [
      {
        id: "work-item:TASK-0249-DUPLICATE:001",
        title: "Duplicate explicit work item.",
      },
      {
        id: "work-item:TASK-0249-DUPLICATE:001",
        title: "Duplicate explicit work item.",
      },
    ],
  });
const taskContractMapperLogicDuplicateResult =
  mapTaskContractToRunnerPlanningInput(
    createTaskContractMapperLogicSmokeInput({
      task: taskContractMapperLogicDuplicateTask,
    }),
  );

assert.equal(
  taskContractMapperLogicDuplicateResult.ok === false ||
    taskContractMapperLogicDuplicateResult.summary.issueCount > 0,
  true,
  "task contract mapper logic smoke D duplicate/invalid shape should not be silently successful",
);
assert.ok(
  taskContractMapperLogicDuplicateResult.issues.some(
    (issue) => issue.code === "task_contract_explicit_work_items_unsupported",
  ),
  "task contract mapper logic smoke D should represent deterministic unsupported duplicate shape issue",
);
assert.deepEqual(
  taskContractMapperLogicDuplicateResult.issues.map((issue) => issue.code),
  [...taskContractMapperLogicDuplicateResult.issues.map((issue) => issue.code)].sort(),
  "task contract mapper logic smoke D issue ordering should be stable",
);
assertTaskContractMappingNoRuntimeArtifacts(
  taskContractMapperLogicDuplicateResult,
  "task contract mapper logic smoke D",
);

const taskContractMapperLogicUnsupportedResult =
  mapTaskContractToRunnerPlanningInput(
    createTaskContractMapperLogicSmokeInput({
      task: createTaskContractMapperLogicSmokeTask({
        id: "TASK-0249-UNSUPPORTED",
      }),
      mode: "dry_run",
    }),
  );

assert.equal(
  taskContractMapperLogicUnsupportedResult.ok,
  false,
  "task contract mapper logic smoke E unsupported mode should not be ok",
);
assert.equal(
  taskContractMapperLogicUnsupportedResult.summary.mappingSupported,
  false,
  "task contract mapper logic smoke E unsupported mode should not be mappingSupported",
);
assert.ok(
  taskContractMapperLogicUnsupportedResult.issues.some(
    (issue) => issue.code === "task_contract_mapping_mode_unsupported",
  ),
  "task contract mapper logic smoke E should represent unsupported issue",
);
assert.equal(
  taskContractMapperLogicUnsupportedResult.planningInput.handoffStatus,
  "unsupported",
  "task contract mapper logic smoke E planning handoff should be unsupported",
);
assert.equal(
  taskContractMapperLogicUnsupportedResult.planningInput.runnerPlanningInput,
  undefined,
  "task contract mapper logic smoke E should not create planning input",
);
assertTaskContractMappingNoRuntimeArtifacts(
  taskContractMapperLogicUnsupportedResult,
  "task contract mapper logic smoke E",
);

const taskContractMapperLogicPolicyResult =
  mapTaskContractToRunnerPlanningInput(
    createTaskContractMapperLogicSmokeInput({
      task: createTaskContractMapperLogicSmokeTask({
        id: "TASK-0249-POLICY",
        riskProfile: {
          riskClass: "medium",
          permissionLevel: "approval_required",
          requiresApproval: true,
          rationale: "Smoke test policy mapping only.",
        },
      }),
    }),
  );

assert.equal(
  taskContractMapperLogicPolicyResult.policy.required,
  true,
  "task contract mapper logic smoke F should represent policy requirement",
);
assert.equal(
  taskContractMapperLogicPolicyResult.policy.approvalRequired,
  true,
  "task contract mapper logic smoke F should represent approval requirement",
);
assert.equal(
  taskContractMapperLogicPolicyResult.policy.policyGateId,
  "policy-gate:TASK-0249-POLICY:task-contract",
  "task contract mapper logic smoke F should represent policy gate id",
);
assert.equal(
  taskContractMapperLogicPolicyResult.policy.status,
  "requires_approval",
  "task contract mapper logic smoke F should not imply policy enforcement",
);
assert.equal(
  taskContractMapperLogicPolicyResult.planningInput.runnerPlanningInput
    ?.policyRequirements?.[0]?.metadata?.noPolicyAdapterCalled,
  true,
  "task contract mapper logic smoke F should not imply policy adapter enforcement",
);

assert.ok(
  taskContractMapperLogicFallbackResult.adapterBoundary.modelAdapterReferences
    .length > 0,
  "task contract mapper logic smoke G should represent model adapter refs when supported",
);
assert.ok(
  Array.isArray(
    taskContractMapperLogicFallbackResult.adapterBoundary.toolAdapterReferences,
  ),
  "task contract mapper logic smoke G should represent tool adapter refs array",
);
assert.ok(
  taskContractMapperLogicFallbackResult.adapterBoundary.allowedOperations.length >
    0,
  "task contract mapper logic smoke G should represent allowed operations",
);
assert.ok(
  taskContractMapperLogicFallbackResult.adapterBoundary.deniedOperations.includes(
    "call_adapter",
  ),
  "task contract mapper logic smoke G should represent denied adapter calls",
);
assert.equal(
  taskContractMapperLogicFallbackResult.summary.adapterReferenceCount,
  taskContractMapperLogicFallbackResult.adapterBoundary.modelAdapterReferences
    .length +
    taskContractMapperLogicFallbackResult.adapterBoundary.toolAdapterReferences
      .length,
  "task contract mapper logic smoke G adapter reference summary should be deterministic",
);

assert.ok(
  taskContractMapperLogicFallbackResult.audit.expectedAuditEventIds.length > 0,
  "task contract mapper logic smoke H should represent expected audit event ids",
);
assert.ok(
  taskContractMapperLogicFallbackResult.audit.requiredEventKinds.includes(
    "verification.handoff.planned",
  ),
  "task contract mapper logic smoke H should represent required audit event kinds",
);
assert.equal(
  taskContractMapperLogicFallbackResult.audit.auditRequired,
  true,
  "task contract mapper logic smoke H should represent audit requirement",
);
assert.equal(
  taskContractMapperLogicFallbackResult.planningInput.runnerPlanningInput
    ?.auditRequirements?.metadata?.auditEventsEmitted,
  false,
  "task contract mapper logic smoke H should not emit audit events",
);
assert.equal(
  taskContractMapperLogicFallbackResult.summary.expectedAuditEventCount,
  taskContractMapperLogicFallbackResult.audit.expectedAuditEventIds.length,
  "task contract mapper logic smoke H expected audit summary should be deterministic",
);

assert.equal(
  taskContractMapperLogicFallbackResult.verifier.verifierRequired,
  true,
  "task contract mapper logic smoke I should require verifier",
);
assert.equal(
  taskContractMapperLogicFallbackResult.verifier.completionGatedByVerifier,
  true,
  "task contract mapper logic smoke I should gate completion by verifier",
);
assert.equal(
  taskContractMapperLogicFallbackResult.planningInput.runnerPlanningInput
    ?.metadata?.noExecution,
  true,
  "task contract mapper logic smoke I actual mapper output should prove noExecution on runnerPlanningInput metadata",
);
assert.equal(
  taskContractMapperLogicFallbackResult.planningInput.runnerPlanningInput
    ?.metadata?.noWrites,
  true,
  "task contract mapper logic smoke I actual mapper output should prove noWrites on runnerPlanningInput metadata",
);
assert.equal(
  taskContractMapperLogicFallbackResult.planningInput.runnerPlanningInput
    ?.verifierRequirements?.verifierRequired,
  true,
  "task contract mapper logic smoke I actual mapper output should include strict verifier proof",
);
assert.equal(
  taskContractMapperLogicFallbackResult.planningInput.runnerPlanningInput
    ?.verifierRequirements?.completionGatedByVerifier,
  true,
  "task contract mapper logic smoke I actual mapper output should include strict completion gate proof",
);
assert.equal(
  typeof taskContractMapperLogicFallbackResult.verifier.expectedCoverageRule,
  "string",
  "task contract mapper logic smoke I should represent expected coverage rule",
);
assertTaskContractMappingNoCompletedState(
  taskContractMapperLogicFallbackResult,
  "task contract mapper logic smoke I",
);

const taskContractMapperLogicResumeTask =
  createTaskContractMapperLogicSmokeTask({
    id: "TASK-0249-RESUME",
    resume: {
      resumeCursorReference: {
        id: "resume-cursor:TASK-0249-RESUME",
        path: "TASKS/TASK-0249-RESUME.cursor.json",
      },
      pendingWorkItemIds: ["work-item:TASK-0249-RESUME:default"],
      retryableWorkItemIds: ["work-item:TASK-0249-RESUME:default"],
    },
  });
const taskContractMapperLogicResumeResult =
  mapTaskContractToRunnerPlanningInput(
    createTaskContractMapperLogicSmokeInput({
      task: taskContractMapperLogicResumeTask,
    }),
  );

if (taskContractMapperLogicResumeResult.resume.resumeCursorReference) {
  assert.equal(
    taskContractMapperLogicResumeResult.resume.resumeCursorReference.id,
    "resume-cursor:TASK-0249-RESUME",
    "task contract mapper logic smoke J should represent resume cursor reference when supported",
  );
} else {
  assert.ok(
    taskContractMapperLogicResumeResult.resume.issues.some(
      (issue) => issue.code === "task_contract_resume_unsupported",
    ),
    "task contract mapper logic smoke J should honestly represent unsupported resume mapping",
  );
}
assert.deepEqual(
  taskContractMapperLogicResumeResult.resume.pendingWorkItemIds,
  [...taskContractMapperLogicResumeResult.resume.pendingWorkItemIds].sort(),
  "task contract mapper logic smoke J pending ids should be deterministic when represented",
);
assert.deepEqual(
  taskContractMapperLogicResumeResult.resume.retryableWorkItemIds,
  [...taskContractMapperLogicResumeResult.resume.retryableWorkItemIds].sort(),
  "task contract mapper logic smoke J retryable ids should be deterministic when represented",
);
assert.equal(
  taskContractMapperLogicResumeResult.planningInput.taskPersistenceWritten,
  false,
  "task contract mapper logic smoke J should not imply persistence",
);

const taskContractMapperLogicMissingIdTask =
  createTaskContractMapperLogicSmokeTask({
    id: "",
  });
const taskContractMapperLogicMissingIdResult =
  mapTaskContractToRunnerPlanningInput(
    createTaskContractMapperLogicSmokeInput({
      task: taskContractMapperLogicMissingIdTask,
      sourceFile: "TASKS/missing-id.json",
    }),
  );

assert.equal(
  taskContractMapperLogicMissingIdResult.ok,
  false,
  "task contract mapper logic smoke J1 missing id should not be ok",
);
assert.equal(
  taskContractMapperLogicMissingIdResult.status,
  "invalid",
  "task contract mapper logic smoke J1 missing id should be invalid",
);
assert.ok(
  taskContractMapperLogicMissingIdResult.issues.some(
    (issue) => issue.code === "task_contract_task_id_missing",
  ),
  "task contract mapper logic smoke J1 should expose deterministic missing id issue",
);
assert.equal(
  taskContractMapperLogicMissingIdResult.planningInput.runnerPlanningInput,
  undefined,
  "task contract mapper logic smoke J1 should not create planning input",
);
assertTaskContractMappingNoRuntimeArtifacts(
  taskContractMapperLogicMissingIdResult,
  "task contract mapper logic smoke J1",
);

const taskContractMapperLogicEmptyExplicitTask =
  createTaskContractMapperLogicSmokeTask({
    id: "TASK-0249-EMPTY-EXPLICIT",
    workItems: [],
  });
const taskContractMapperLogicEmptyExplicitResult =
  mapTaskContractToRunnerPlanningInput(
    createTaskContractMapperLogicSmokeInput({
      task: taskContractMapperLogicEmptyExplicitTask,
      options: {
        requireExplicitWorkItems: true,
      },
    }),
  );

assert.equal(
  taskContractMapperLogicEmptyExplicitResult.ok,
  false,
  "task contract mapper logic smoke J2 empty explicit work items should not be ok",
);
assert.equal(
  taskContractMapperLogicEmptyExplicitResult.status,
  "unsupported",
  "task contract mapper logic smoke J2 empty explicit work items should remain unsupported",
);
assert.deepEqual(
  taskContractMapperLogicEmptyExplicitResult.issues.map((issue) => issue.code),
  [
    "task_contract_explicit_work_items_required",
    "task_contract_explicit_work_items_unsupported",
  ],
  "task contract mapper logic smoke J2 should expose stable empty explicit work item issues",
);
assert.equal(
  taskContractMapperLogicEmptyExplicitResult.workItems.length,
  0,
  "task contract mapper logic smoke J2 should not fake explicit work item mappings",
);
assertTaskContractMappingNoRuntimeArtifacts(
  taskContractMapperLogicEmptyExplicitResult,
  "task contract mapper logic smoke J2",
);

const taskContractMapperLogicEmptyBatchTask =
  createTaskContractMapperLogicSmokeTask({
    id: "TASK-0249-EMPTY-BATCH",
    batches: [],
  });
const taskContractMapperLogicEmptyBatchResult =
  mapTaskContractToRunnerPlanningInput(
    createTaskContractMapperLogicSmokeInput({
      task: taskContractMapperLogicEmptyBatchTask,
    }),
  );

assert.equal(
  taskContractMapperLogicEmptyBatchResult.ok,
  false,
  "task contract mapper logic smoke J3 empty batch shape should not be ok",
);
assert.equal(
  taskContractMapperLogicEmptyBatchResult.status,
  "unsupported",
  "task contract mapper logic smoke J3 empty batch shape should remain unsupported",
);
assert.ok(
  taskContractMapperLogicEmptyBatchResult.issues.some(
    (issue) => issue.code === "task_contract_explicit_batches_unsupported",
  ),
  "task contract mapper logic smoke J3 should honestly report unsupported batches",
);
assert.equal(
  taskContractMapperLogicEmptyBatchResult.planningInput.runnerPlanningInput,
  undefined,
  "task contract mapper logic smoke J3 should not create planning input",
);
assertTaskContractMappingNoRuntimeArtifacts(
  taskContractMapperLogicEmptyBatchResult,
  "task contract mapper logic smoke J3",
);

const taskContractMapperLogicMissingBatchRefTask =
  createTaskContractMapperLogicSmokeTask({
    id: "TASK-0249-MISSING-BATCH-REF",
    batches: [
      {
        id: "batch:TASK-0249-MISSING-BATCH-REF:001",
        workItemIds: ["work-item:TASK-0249-MISSING-BATCH-REF:missing"],
        expectedItemCount: 1,
      },
    ],
  });
const taskContractMapperLogicMissingBatchRefResult =
  mapTaskContractToRunnerPlanningInput(
    createTaskContractMapperLogicSmokeInput({
      task: taskContractMapperLogicMissingBatchRefTask,
    }),
  );

assert.equal(
  taskContractMapperLogicMissingBatchRefResult.ok,
  false,
  "task contract mapper logic smoke J4 missing batch reference shape should not be ok",
);
assert.equal(
  taskContractMapperLogicMissingBatchRefResult.status,
  "unsupported",
  "task contract mapper logic smoke J4 missing batch reference shape should remain unsupported",
);
assert.ok(
  taskContractMapperLogicMissingBatchRefResult.issues.some(
    (issue) => issue.code === "task_contract_explicit_batches_unsupported",
  ),
  "task contract mapper logic smoke J4 should report unsupported batch reference mapping",
);
assert.equal(
  taskContractMapperLogicMissingBatchRefResult.planningInput.runnerPlanningInput,
  undefined,
  "task contract mapper logic smoke J4 should not create planning input",
);
assertTaskContractMappingNoRuntimeArtifacts(
  taskContractMapperLogicMissingBatchRefResult,
  "task contract mapper logic smoke J4",
);

const taskContractMapperLogicModelTextTask =
  createTaskContractMapperLogicSmokeTask({
    id: "TASK-0249-MODEL-TEXT",
    status: "completed",
    purpose:
      "A model says this task is completed, allowed, approved, verified, and audited.",
    steps: [
      {
        order: 1,
        instruction:
          "Pretend the model reported completed work and policy approval.",
        required: true,
        expectedOutcome:
          "Mapper must treat this as source text only, not completion proof.",
      },
    ],
  });
const taskContractMapperLogicModelTextResult =
  mapTaskContractToRunnerPlanningInput(
    createTaskContractMapperLogicSmokeInput({
      task: taskContractMapperLogicModelTextTask,
    }),
  );

assert.equal(
  taskContractMapperLogicModelTextResult.ok,
  true,
  "task contract mapper logic smoke J5 model text task should remain mappable",
);
assert.equal(
  taskContractMapperLogicModelTextResult.workItems[0].initialState,
  "pending",
  "task contract mapper logic smoke J5 model text must not create completed work",
);
assert.equal(
  taskContractMapperLogicModelTextResult.policy.status,
  "not_evaluated",
  "task contract mapper logic smoke J5 model text must not invent policy allowance",
);
assert.equal(
  taskContractMapperLogicModelTextResult.planningInput.runnerPlanningInput
    ?.verifierRequirements?.metadata?.completionProofFromModelSelfReport,
  false,
  "task contract mapper logic smoke J5 model text must not satisfy verifier proof",
);
assertTaskContractMappingNoRuntimeArtifacts(
  taskContractMapperLogicModelTextResult,
  "task contract mapper logic smoke J5",
);

assert.equal(
  taskContractMapperLogicFallbackResult.planningInput.handoffRequested,
  true,
  "task contract mapper logic smoke K should request planning input handoff",
);
assert.equal(
  taskContractMapperLogicFallbackResult.planningInput.handoffStatus,
  "mapped",
  "task contract mapper logic smoke K should represent handoff status",
);
assert.equal(
  taskContractMapperLogicFallbackResult.planningInput.runnerPlanningInputData
    .kind,
  "data",
  "task contract mapper logic smoke K planning input handoff should be data only",
);
assert.equal(
  typeof taskContractMapperLogicFallbackResult.planningInput
    .runnerPlanningInputData.reference.id,
  "string",
  "task contract mapper logic smoke K planning input handoff should include reference only",
);
assert.equal(
  taskContractMapperLogicFallbackResult.planningInput.runnerPlanningExecuted,
  false,
  "task contract mapper logic smoke K should not run planAgenticRunner",
);
assert.equal(
  Object.hasOwn(taskContractMapperLogicFallbackResult, "runnerPlanningResult"),
  false,
  "task contract mapper logic smoke K should not produce runner planning result",
);

const taskContractMapperLogicDeterministicFirst =
  mapTaskContractToRunnerPlanningInput(taskContractMapperLogicFallbackInput);
const taskContractMapperLogicDeterministicSecond =
  mapTaskContractToRunnerPlanningInput(taskContractMapperLogicFallbackInput);

assert.deepEqual(
  taskContractMapperLogicDeterministicSecond,
  taskContractMapperLogicDeterministicFirst,
  "task contract mapper logic smoke L should produce equivalent results",
);
assert.deepEqual(
  taskContractMapperLogicSignature(taskContractMapperLogicDeterministicSecond),
  taskContractMapperLogicSignature(taskContractMapperLogicDeterministicFirst),
  "task contract mapper logic smoke L ordering and summary should remain stable",
);

for (const [message, result] of [
  ["task contract mapper logic smoke M minimal", taskContractMapperLogicMinimalResult],
  ["task contract mapper logic smoke M fallback", taskContractMapperLogicFallbackResult],
  ["task contract mapper logic smoke M explicit unsupported", taskContractMapperLogicExplicitResult],
  ["task contract mapper logic smoke M duplicate invalid", taskContractMapperLogicDuplicateResult],
  ["task contract mapper logic smoke M unsupported", taskContractMapperLogicUnsupportedResult],
  ["task contract mapper logic smoke M policy", taskContractMapperLogicPolicyResult],
  ["task contract mapper logic smoke M resume", taskContractMapperLogicResumeResult],
  ["task contract mapper logic smoke M missing id", taskContractMapperLogicMissingIdResult],
  ["task contract mapper logic smoke M empty explicit", taskContractMapperLogicEmptyExplicitResult],
  ["task contract mapper logic smoke M empty batch", taskContractMapperLogicEmptyBatchResult],
  ["task contract mapper logic smoke M missing batch ref", taskContractMapperLogicMissingBatchRefResult],
  ["task contract mapper logic smoke M model text", taskContractMapperLogicModelTextResult],
]) {
  assertTaskContractMappingResultShape(result, message);
  assertTaskContractMappingSummaryConsistent(result, message);
  assertTaskContractMappingNoRuntimeArtifacts(result, message);
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
  "task contract mapping smoke C static contract fixture should represent multiple work items only as a future typed shape",
);
assert.deepEqual(
  explicitWorkItemMappingResult.workItems.map((workItem) => workItem.workItemId),
  [
    "work-item:TASK-0245:001-load-contracts",
    "work-item:TASK-0245:002-add-examples",
  ],
  "task contract mapping smoke C static contract fixture work item ids should remain deterministic",
);
assert.deepEqual(
  explicitWorkItemBatchMapping.workItemIds,
  explicitWorkItemMappingResult.workItems.map((workItem) => workItem.workItemId),
  "task contract mapping smoke C static contract fixture batch should reference work item ids",
);
assert.equal(
  explicitWorkItemBatchMapping.expectedItemCount,
  explicitWorkItemBatchMapping.workItemIds.length,
  "task contract mapping smoke C static contract fixture batch expected count should match work item ids",
);
assert.equal(
  taskContractMapperLogicExplicitResult.ok,
  false,
  "task contract mapping smoke C implemented mapper must not accept unvalidated explicit work items as supported",
);
assert.equal(
  taskContractMapperLogicExplicitResult.status,
  "unsupported",
  "task contract mapping smoke C implemented mapper should report unsupported explicit work item mapping",
);
assert.equal(
  taskContractMapperLogicExplicitResult.planningInput.runnerPlanningInput,
  undefined,
  "task contract mapping smoke C implemented mapper should not create planning input for unsupported explicit work items",
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

const persistenceTempRoot = await mkdtemp(
  join(tmpdir(), "aeos-task-state-smoke-"),
);

try {
  const createdAt = "2026-08-08T00:00:00.000Z";
  const persistenceRoot = join(persistenceTempRoot, "project");
  await mkdir(persistenceRoot, { recursive: true });

  const initialState = createInitialTaskState({
    taskId: "TASK-STATE-SMOKE",
    sourceTaskPath: "tasks/task-state-smoke.json",
    sourceTaskId: "TASK-STATE-SMOKE",
    verifierRequired: true,
    createdAt,
  });

  assert.equal(
    initialState.taskId,
    "TASK-STATE-SMOKE",
    "task state smoke A should preserve task id",
  );
  assert.equal(
    initialState.lifecycleState,
    "new",
    "task state smoke A should start in safe new state",
  );
  assert.equal(
    initialState.revision,
    1,
    "task state smoke A should initialize revision",
  );
  assert.equal(
    initialState.completionGate.completed,
    false,
    "task state smoke A should not be completed",
  );
  assert.equal(
    initialState.completionGate.verified,
    false,
    "task state smoke A should not be verified",
  );
  assert.equal(
    initialState.safety.modelSelfReportTrusted,
    false,
    "task state smoke A should not trust model self-report",
  );

  const storagePathResult = getTaskStateStoragePath({
    projectRoot: persistenceRoot,
    taskId: initialState.taskId,
  });
  assert.equal(
    storagePathResult.ok,
    true,
    "task state smoke C should resolve deterministic storage path",
  );
  assert.equal(
    storagePathResult.value.path,
    join(persistenceRoot, ".aeos", "state", "tasks", "TASK-STATE-SMOKE.json"),
    "task state smoke C should use canonical task state path",
  );

  for (const unsafeTaskId of [
    "../TASK-STATE-SMOKE",
    "TASK-STATE-SMOKE/escape",
    "/tmp/TASK-STATE-SMOKE",
  ]) {
    const unsafePathResult = getTaskStateStoragePath({
      projectRoot: persistenceRoot,
      taskId: unsafeTaskId,
    });
    assert.equal(
      unsafePathResult.ok,
      false,
      `task state smoke D/E should reject unsafe task id ${unsafeTaskId}`,
    );
    assert.equal(
      unsafePathResult.error.code,
      "task_state_unsafe_task_id",
      `task state smoke D/E should report unsafe id for ${unsafeTaskId}`,
    );
  }

  const symlinkProjectRoot = join(persistenceTempRoot, "symlink-project");
  const symlinkOutsideRoot = join(persistenceTempRoot, "symlink-outside");
  const symlinkTasksParent = join(symlinkProjectRoot, ".aeos", "state");
  await mkdir(symlinkTasksParent, { recursive: true });
  await mkdir(symlinkOutsideRoot, { recursive: true });
  await symlink(symlinkOutsideRoot, join(symlinkTasksParent, "tasks"), "dir");
  const symlinkSaveResult = await saveTaskState({
    projectRoot: symlinkProjectRoot,
    state: createInitialTaskState({
      taskId: "TASK-STATE-SYMLINK",
      createdAt,
    }),
  });
  assert.equal(
    symlinkSaveResult.ok,
    false,
    "task state smoke D should reject state-root symlink escape",
  );
  assert.equal(
    symlinkSaveResult.error.code,
    "task_state_unsafe_state_root",
    "task state smoke D should report unsafe state root symlink",
  );
  assert.equal(
    await pathExists(join(symlinkOutsideRoot, "TASK-STATE-SYMLINK.json")),
    false,
    "task state smoke L should not write through state-root symlink",
  );

  const fileSymlinkProjectRoot = join(
    persistenceTempRoot,
    "file-symlink-project",
  );
  const fileSymlinkStateRoot = join(
    fileSymlinkProjectRoot,
    ".aeos",
    "state",
    "tasks",
  );
  const fileSymlinkOutsideRoot = join(
    persistenceTempRoot,
    "file-symlink-outside",
  );
  await mkdir(fileSymlinkStateRoot, { recursive: true });
  await mkdir(fileSymlinkOutsideRoot, { recursive: true });
  const fileSymlinkOutsideState = join(
    fileSymlinkOutsideRoot,
    "TASK-STATE-FILE-SYMLINK.json",
  );
  await writeNodeFile(
    fileSymlinkOutsideState,
    `${JSON.stringify(
      createInitialTaskState({
        taskId: "TASK-STATE-FILE-SYMLINK",
        createdAt,
      }),
      null,
      2,
    )}\n`,
  );
  await symlink(
    fileSymlinkOutsideState,
    join(fileSymlinkStateRoot, "TASK-STATE-FILE-SYMLINK.json"),
  );
  const fileSymlinkLoadResult = await loadTaskState({
    projectRoot: fileSymlinkProjectRoot,
    taskId: "TASK-STATE-FILE-SYMLINK",
  });
  assert.equal(
    fileSymlinkLoadResult.ok,
    false,
    "task state smoke D should reject state-file symlink escape on load",
  );
  assert.equal(
    fileSymlinkLoadResult.error.code,
    "task_state_unsafe_target",
    "task state smoke D should report unsafe state-file symlink",
  );

  const saveResult = await saveTaskState({
    projectRoot: persistenceRoot,
    state: initialState,
  });
  assert.equal(
    saveResult.ok,
    true,
    "task state smoke B should save initial state",
  );

  const loadResult = await loadTaskState({
    projectRoot: persistenceRoot,
    taskId: initialState.taskId,
  });
  assert.equal(
    loadResult.ok,
    true,
    "task state smoke B should load saved state",
  );
  assert.deepEqual(
    loadResult.value.state,
    saveResult.value.state,
    "task state smoke B should roundtrip authoritative state",
  );

  const missingResult = await loadTaskState({
    projectRoot: persistenceRoot,
    taskId: "TASK-STATE-MISSING",
  });
  assert.equal(
    missingResult.ok,
    false,
    "task state smoke G should fail missing state",
  );
  assert.equal(
    missingResult.error.code,
    "task_state_not_found",
    "task state smoke G should report deterministic not-found",
  );

  const corruptRoot = join(persistenceTempRoot, "corrupt-project");
  const corruptStateRoot = join(corruptRoot, ".aeos", "state", "tasks");
  await mkdir(corruptStateRoot, { recursive: true });
  await writeNodeFile(
    join(corruptStateRoot, "TASK-STATE-CORRUPT.json"),
    "{ corrupt json",
  );
  const corruptResult = await loadTaskState({
    projectRoot: corruptRoot,
    taskId: "TASK-STATE-CORRUPT",
  });
  assert.equal(
    corruptResult.ok,
    false,
    "task state smoke F should reject corrupt JSON",
  );
  assert.equal(
    corruptResult.error.code,
    "task_state_corrupt_json",
    "task state smoke F should fail closed on corrupt JSON",
  );

  const firstUpdate = await updateTaskState({
    projectRoot: persistenceRoot,
    taskId: initialState.taskId,
    expectedRevision: 1,
    updatedAt: "2026-08-08T00:01:00.000Z",
    update(state) {
      return {
        ...state,
        lifecycleState: "planned",
        workItems: [
          {
            id: "work-a",
            state: "pending",
            batchId: "batch-a",
          },
          {
            id: "work-b",
            state: "retryable",
            batchId: "batch-a",
            issues: [
              {
                code: "retryable-smoke",
                message: "Retryable smoke item.",
                severity: "warning",
                category: "execution_failure",
                retryable: true,
              },
            ],
          },
        ],
        batches: [
          {
            id: "batch-a",
            workItemIds: ["work-a", "work-b"],
            expectedItemCount: 2,
            completedCount: 0,
            failedCount: 0,
            skippedCount: 0,
            retryableCount: 1,
          },
        ],
        pendingWorkItemIds: ["work-a"],
        retryableWorkItemIds: ["work-b"],
        nextBatchId: "batch-a",
        plan: {
          status: "planned",
          summary: {
            workItemCount: 2,
            batchCount: 1,
            stepCount: 3,
            verifierRequired: true,
            approvalRequired: false,
            issueCount: 0,
          },
        },
        resume: {
          nextBatchId: "batch-a",
          pendingWorkItemIds: ["work-a"],
          retryableWorkItemIds: ["work-b"],
          updatedAt: "2026-08-08T00:01:00.000Z",
        },
      };
    },
  });
  assert.equal(
    firstUpdate.ok,
    true,
    "task state smoke I should update with valid revision",
  );
  assert.equal(
    firstUpdate.value.state.revision,
    2,
    "task state smoke I should increment revision",
  );
  assert.deepEqual(
    firstUpdate.value.state.pendingWorkItemIds,
    ["work-a"],
    "task state smoke M should roundtrip pending ids",
  );
  assert.deepEqual(
    firstUpdate.value.state.retryableWorkItemIds,
    ["work-b"],
    "task state smoke M should roundtrip retryable ids",
  );

  const handoff = createTaskResumeHandoff(firstUpdate.value.state);
  assert.equal(
    handoff.resumeAllowed,
    true,
    "task resume handoff smoke M should allow valid planned state",
  );
  assert.equal(
    handoff.taskId,
    "TASK-STATE-SMOKE",
    "task resume handoff smoke M should preserve task id",
  );
  assert.equal(
    handoff.sourceRevision,
    2,
    "task resume handoff smoke P should preserve source revision",
  );
  assert.equal(
    handoff.lifecycleState,
    "planned",
    "task resume handoff smoke M should preserve lifecycle state",
  );
  assert.deepEqual(
    handoff.pendingWorkItemIds,
    ["work-a"],
    "task resume handoff smoke N should preserve pending ids",
  );
  assert.deepEqual(
    handoff.retryableWorkItemIds,
    ["work-b"],
    "task resume handoff smoke O should preserve retryable ids",
  );
  assert.equal(
    handoff.nextBatchId,
    "batch-a",
    "task resume handoff smoke M should preserve safe next batch",
  );
  assert.equal(
    handoff.remainingWorkItemCount,
    2,
    "task resume handoff smoke Q should derive deterministic remaining count",
  );
  assert.equal(
    handoff.verifierRequired,
    true,
    "task resume handoff smoke M should preserve verifier requirement",
  );
  assert.equal(
    handoff.completionGatedByVerifier,
    true,
    "task resume handoff smoke M should preserve verifier gate",
  );
  assert.equal(
    handoff.noExecution,
    true,
    "task resume handoff smoke M should be no-execution data",
  );
  assert.equal(
    handoff.noWrites,
    true,
    "task resume handoff smoke M should be no-write data",
  );
  assert.deepEqual(
    createTaskResumeHandoff(firstUpdate.value.state),
    handoff,
    "task resume handoff smoke W should be equivalent for same state",
  );

  const stateFileBeforeHandoff = await readFile(firstUpdate.value.path, "utf8");
  const stateStatBeforeHandoff = await stat(firstUpdate.value.path);
  const loadedHandoff = await loadTaskResumeHandoff({
    projectRoot: persistenceRoot,
    taskId: initialState.taskId,
  });
  const stateFileAfterHandoff = await readFile(firstUpdate.value.path, "utf8");
  const stateStatAfterHandoff = await stat(firstUpdate.value.path);
  assert.equal(
    loadedHandoff.ok,
    true,
    "task resume handoff smoke M should load read-only handoff",
  );
  assert.deepEqual(
    loadedHandoff.value.handoff,
    handoff,
    "task resume handoff smoke W should match direct derivation",
  );
  assert.equal(
    stateFileAfterHandoff,
    stateFileBeforeHandoff,
    "task resume handoff smoke X should not modify persisted file",
  );
  assert.equal(
    stateStatAfterHandoff.mtimeMs,
    stateStatBeforeHandoff.mtimeMs,
    "task resume handoff smoke X should not modify persisted file mtime",
  );
  assert.equal(
    loadedHandoff.value.handoff.sourceRevision,
    2,
    "task resume handoff smoke X should not increment revision",
  );

  const dryRunTransitionEvidence = {
    kind: "dry_run",
    dryRunSucceeded: true,
    noExecution: true,
    noWrites: true,
    adapterCalls: false,
    auditWrites: false,
    verifierRun: false,
    persistence: false,
    filesystemMutation: false,
    completedStateCreated: false,
    resultReference: {
      id: "dry-run-smoke",
      path: "dry-run/smoke.json",
      version: "1",
    },
  };
  const dryRunIntent = {
    kind: "mark_dry_run_ready",
  };
  const dryRunEvaluation = evaluateTaskStateTransition({
    state: firstUpdate.value.state,
    intent: dryRunIntent,
    evidence: dryRunTransitionEvidence,
    updatedAt: "2026-08-08T00:02:00.000Z",
  });
  assert.equal(
    dryRunEvaluation.ok,
    true,
    "task state transition smoke A should evaluate planned -> dry_run_ready",
  );
  assert.equal(
    dryRunEvaluation.value.from,
    "planned",
    "task state transition smoke A should preserve source lifecycle",
  );
  assert.equal(
    dryRunEvaluation.value.to,
    "dry_run_ready",
    "task state transition smoke A should derive target from system intent",
  );

  const stateBeforePureTransition = JSON.stringify(firstUpdate.value.state);
  const pureDryRunTransition = transitionTaskState({
    state: firstUpdate.value.state,
    intent: dryRunIntent,
    evidence: dryRunTransitionEvidence,
    updatedAt: "2026-08-08T00:02:00.000Z",
  });
  assert.equal(
    pureDryRunTransition.ok,
    true,
    "task state transition smoke B should apply allowed pure transition",
  );
  assert.equal(
    pureDryRunTransition.value.state.lifecycleState,
    "dry_run_ready",
    "task state transition smoke B should produce dry_run_ready state",
  );
  assert.equal(
    pureDryRunTransition.value.state.revision,
    2,
    "task state transition smoke S should not increment revision in pure transition",
  );
  assert.equal(
    JSON.stringify(firstUpdate.value.state),
    stateBeforePureTransition,
    "task state transition smoke S should not mutate caller-owned input",
  );
  assert.deepEqual(
    transitionTaskState({
      state: firstUpdate.value.state,
      intent: dryRunIntent,
      evidence: dryRunTransitionEvidence,
      updatedAt: "2026-08-08T00:02:00.000Z",
    }),
    pureDryRunTransition,
    "task state transition smoke T should be deterministic for same input",
  );
  assert.deepEqual(
    transitionTaskState({
      state: firstUpdate.value.state,
      intent: dryRunIntent,
      evidence: dryRunTransitionEvidence,
    }),
    transitionTaskState({
      state: firstUpdate.value.state,
      intent: dryRunIntent,
      evidence: dryRunTransitionEvidence,
    }),
    "task state transition smoke T should be deterministic without a supplied timestamp",
  );
  const blockedTransitionEvidence = {
    kind: "blocked_work",
    issues: [
      {
        code: "blocked-smoke",
        message: "Authoritative blocked smoke issue.",
        severity: "error",
        category: "execution_failure",
      },
    ],
  };
  const pureBlockedTransition = transitionTaskState({
    state: firstUpdate.value.state,
    intent: {
      kind: "mark_blocked",
    },
    evidence: blockedTransitionEvidence,
    updatedAt: "2026-08-08T00:02:30.000Z",
  });
  assert.equal(
    pureBlockedTransition.ok,
    true,
    "task state transition smoke B should allow authoritative blocked transition",
  );
  assert.equal(
    pureBlockedTransition.value.state.lifecycleState,
    "blocked",
    "task state transition smoke B should derive blocked lifecycle from intent",
  );
  assert.equal(
    pureBlockedTransition.value.state.completionGate.status,
    "blocked",
    "task state transition smoke B should keep completion gate blocked",
  );

  const persistedDryRunTransition = await transitionPersistedTaskState({
    projectRoot: persistenceRoot,
    taskId: initialState.taskId,
    expectedRevision: 2,
    intent: dryRunIntent,
    evidence: dryRunTransitionEvidence,
    updatedAt: "2026-08-08T00:02:00.000Z",
  });
  assert.equal(
    persistedDryRunTransition.ok,
    true,
    "task state transition smoke B should persist allowed non-terminal transition",
  );
  assert.equal(
    persistedDryRunTransition.value.state.revision,
    3,
    "task state transition smoke C should increment revision exactly once",
  );
  assert.equal(
    persistedDryRunTransition.value.state.lifecycleState,
    "dry_run_ready",
    "task state transition smoke B should persist derived lifecycle state",
  );
  const dryRunHandoff = await loadTaskResumeHandoff({
    projectRoot: persistenceRoot,
    taskId: initialState.taskId,
  });
  assert.equal(
    dryRunHandoff.ok,
    true,
    "task state transition smoke status/resume should load transitioned state",
  );
  assert.equal(
    dryRunHandoff.value.handoff.lifecycleState,
    "dry_run_ready",
    "task state transition smoke resume should reflect transitioned lifecycle",
  );
  assert.equal(
    dryRunHandoff.value.handoff.sourceRevision,
    3,
    "task state transition smoke resume should reflect transitioned revision",
  );

  const beforeFailedTransitionContent = await readFile(firstUpdate.value.path, "utf8");
  const beforeFailedTransitionStat = await stat(firstUpdate.value.path);
  const unknownTransition = await transitionPersistedTaskState({
    projectRoot: persistenceRoot,
    taskId: initialState.taskId,
    expectedRevision: 3,
    intent: {
      kind: "unknown_transition_intent",
    },
    evidence: dryRunTransitionEvidence,
    updatedAt: "2026-08-08T00:03:00.000Z",
  });
  const afterFailedTransitionContent = await readFile(firstUpdate.value.path, "utf8");
  const afterFailedTransitionStat = await stat(firstUpdate.value.path);
  assert.equal(
    unknownTransition.ok,
    false,
    "task state transition smoke F should block unknown transition intent",
  );
  assert.equal(
    unknownTransition.error.code,
    "task_state_transition_unknown_intent",
    "task state transition smoke F should report deterministic unknown intent",
  );
  assert.equal(
    afterFailedTransitionContent,
    beforeFailedTransitionContent,
    "task state transition smoke U should preserve bytes after failed transition",
  );
  assert.equal(
    afterFailedTransitionStat.mtimeMs,
    beforeFailedTransitionStat.mtimeMs,
    "task state transition smoke U should preserve mtime after failed transition",
  );

  const staleTransition = await transitionPersistedTaskState({
    projectRoot: persistenceRoot,
    taskId: initialState.taskId,
    expectedRevision: 2,
    intent: {
      kind: "require_verification",
    },
    evidence: {
      kind: "verification_requirement",
      verifierRequired: true,
      completionGatedByVerifier: true,
      requirementReference: {
        id: "verification-required-smoke",
      },
    },
    updatedAt: "2026-08-08T00:04:00.000Z",
  });
  assert.equal(
    staleTransition.ok,
    false,
    "task state transition smoke D should block stale revision",
  );
  assert.equal(
    staleTransition.error.code,
    "task_state_revision_conflict",
    "task state transition smoke D should report revision conflict",
  );
  assert.equal(
    await readFile(firstUpdate.value.path, "utf8"),
    beforeFailedTransitionContent,
    "task state transition smoke E should preserve bytes after stale transition",
  );

  const rootSymlinkTransition = await transitionPersistedTaskState({
    projectRoot: symlinkProjectRoot,
    taskId: "TASK-STATE-SYMLINK",
    expectedRevision: 1,
    intent: dryRunIntent,
    evidence: dryRunTransitionEvidence,
    updatedAt: "2026-08-08T00:05:00.000Z",
  });
  assert.equal(
    rootSymlinkTransition.ok,
    false,
    "task state transition smoke R should reject state-root symlink",
  );
  assert.equal(
    rootSymlinkTransition.error.code,
    "task_state_unsafe_state_root",
    "task state transition smoke R should report unsafe state root",
  );

  const fileSymlinkTransition = await transitionPersistedTaskState({
    projectRoot: fileSymlinkProjectRoot,
    taskId: "TASK-STATE-FILE-SYMLINK",
    expectedRevision: 1,
    intent: dryRunIntent,
    evidence: dryRunTransitionEvidence,
    updatedAt: "2026-08-08T00:05:00.000Z",
  });
  assert.equal(
    fileSymlinkTransition.ok,
    false,
    "task state transition smoke Q should reject state-file symlink",
  );
  assert.equal(
    fileSymlinkTransition.error.code,
    "task_state_unsafe_target",
    "task state transition smoke Q should report unsafe state-file target",
  );

  const arbitraryTargetTransition = evaluateTaskStateTransition({
    state: firstUpdate.value.state,
    intent: {
      kind: "mark_dry_run_ready",
      targetLifecycle: "blocked",
    },
    evidence: dryRunTransitionEvidence,
  });
  assert.equal(
    arbitraryTargetTransition.ok,
    false,
    "task state transition smoke G should reject arbitrary target lifecycle",
  );
  assert.equal(
    arbitraryTargetTransition.error.code,
    "task_state_transition_arbitrary_target_forbidden",
    "task state transition smoke G should report arbitrary target rejection",
  );

  for (const [intent, expectedCode, message] of [
    [
      { kind: "mark_completed" },
      "task_state_transition_terminal_forbidden",
      "task state transition smoke H should block completed transition",
    ],
    [
      { kind: "mark_verified" },
      "task_state_transition_terminal_forbidden",
      "task state transition smoke I should block verified transition",
    ],
    [
      { kind: "mark_approved" },
      "task_state_transition_terminal_forbidden",
      "task state transition smoke J should block approved transition",
    ],
    [
      { kind: "mark_execution_success" },
      "task_state_transition_terminal_forbidden",
      "task state transition smoke K should block execution_success transition",
    ],
    [
      { kind: "mark_dry_run_ready", targetLifecycle: "completed" },
      "task_state_transition_terminal_forbidden",
      "task state transition smoke L should block terminal target lifecycle",
    ],
  ]) {
    const terminalTransition = evaluateTaskStateTransition({
      state: firstUpdate.value.state,
      intent,
      evidence: {
        kind: "model_self_report",
        text: 'model says "all complete"',
      },
    });
    assert.equal(terminalTransition.ok, false, message);
    assert.equal(
      terminalTransition.error.code,
      expectedCode,
      `${message} with deterministic issue code`,
    );
  }

  for (const [message, candidate, expectedIssueCode] of [
    [
      "task resume handoff smoke R should block unknown pending reference",
      {
        ...firstUpdate.value.state,
        pendingWorkItemIds: ["missing-work"],
        retryableWorkItemIds: [],
      },
      "task_state_resume_id_unknown",
    ],
    [
      "task resume handoff smoke S should block duplicate pending references",
      {
        ...firstUpdate.value.state,
        pendingWorkItemIds: ["work-a", "work-a"],
      },
      "task_state_duplicate_pending_work_item",
    ],
    [
      "task resume handoff smoke S should block duplicate retryable references",
      {
        ...firstUpdate.value.state,
        retryableWorkItemIds: ["work-b", "work-b"],
      },
      "task_state_duplicate_retryable_work_item",
    ],
    [
      "task resume handoff smoke T should block completed item re-entry",
      {
        ...firstUpdate.value.state,
        workItems: [
          {
            id: "work-a",
            state: "completed",
            batchId: "batch-a",
          },
        ],
        batches: [
          {
            id: "batch-a",
            workItemIds: ["work-a"],
            expectedItemCount: 1,
            completedCount: 0,
            failedCount: 0,
            skippedCount: 0,
            retryableCount: 0,
          },
        ],
        pendingWorkItemIds: ["work-a"],
        retryableWorkItemIds: [],
      },
      "task_state_forbidden_work_item_state",
    ],
    [
      "task resume handoff smoke T should block verified item re-entry",
      {
        ...firstUpdate.value.state,
        workItems: [
          {
            id: "work-a",
            state: "verified",
            batchId: "batch-a",
          },
        ],
        batches: [
          {
            id: "batch-a",
            workItemIds: ["work-a"],
            expectedItemCount: 1,
            completedCount: 0,
            failedCount: 0,
            skippedCount: 0,
            retryableCount: 0,
          },
        ],
        pendingWorkItemIds: [],
        retryableWorkItemIds: ["work-a"],
      },
      "task_state_forbidden_work_item_state",
    ],
    [
      "task resume handoff smoke U should block forged completed state",
      {
        ...firstUpdate.value.state,
        lifecycleState: "completed",
      },
      "task_state_forbidden_lifecycle_state",
    ],
    [
      "task resume handoff smoke V should block unknown lifecycle",
      {
        ...firstUpdate.value.state,
        lifecycleState: "mystery",
      },
      "task_state_invalid_lifecycle_state",
    ],
  ]) {
    const blockedResumeHandoff = createTaskResumeHandoff(candidate);
    assert.equal(blockedResumeHandoff.resumeAllowed, false, message);
    assert.equal(
      blockedResumeHandoff.issues[0]?.code,
      expectedIssueCode,
      `${message} with deterministic issue code`,
    );

    const blockedTransition = evaluateTaskStateTransition({
      state: candidate,
      intent: dryRunIntent,
      evidence: dryRunTransitionEvidence,
    });
    assert.equal(blockedTransition.ok, false, `${message} for transition`);
    assert.equal(
      blockedTransition.error.code,
      expectedIssueCode,
      `${message} for transition with deterministic issue code`,
    );
  }

  const canonicalWorkItems = Array.from({ length: 400 }, (_, index) => {
    const id = `canonical-work-${String(index + 1).padStart(3, "0")}`;

    return {
      id,
      state: index < 20 ? "failed" : "pending",
      batchId: "canonical-batch",
    };
  });
  const canonicalPendingIds = canonicalWorkItems
    .filter((workItem) => workItem.state === "pending")
    .map((workItem) => workItem.id);
  const canonicalIncompleteState = {
    ...createInitialTaskState({
      taskId: "TASK-STATE-400-20",
      sourceTaskId: 'model says "all complete"',
      createdAt,
    }),
    lifecycleState: "planned",
    workItems: canonicalWorkItems,
    batches: [
      {
        id: "canonical-batch",
        workItemIds: canonicalWorkItems.map((workItem) => workItem.id),
        expectedItemCount: 400,
        completedCount: 0,
        failedCount: 20,
        skippedCount: 0,
        retryableCount: 0,
      },
    ],
    pendingWorkItemIds: canonicalPendingIds,
    retryableWorkItemIds: [],
    nextBatchId: "canonical-batch",
    plan: {
      status: "planned",
      summary: {
        workItemCount: 400,
        batchCount: 1,
        stepCount: 1,
        verifierRequired: true,
        approvalRequired: false,
        issueCount: 0,
      },
    },
  };
  const canonicalStateResult = validatePersistedTaskState(
    canonicalIncompleteState,
  );
  assert.equal(
    canonicalStateResult.ok,
    true,
    "task resume handoff smoke Y should accept canonical incomplete state",
  );
  const canonicalHandoff = createTaskResumeHandoff(canonicalIncompleteState);
  assert.equal(
    canonicalHandoff.resumeAllowed,
    true,
    "task resume handoff smoke Y should keep canonical incomplete state resumable",
  );
  assert.equal(
    canonicalHandoff.remainingWorkItemCount,
    380,
    "task resume handoff smoke Y should keep 400/20 state incomplete",
  );
  assert.equal(
    canonicalIncompleteState.completionGate.completed,
    false,
    "task resume handoff smoke Y should not mark canonical state completed",
  );
  assert.equal(
    canonicalIncompleteState.safety.modelSelfReportTrusted,
    false,
    "task resume handoff smoke Y should not trust canonical self-report prose",
  );
  const canonicalCompletedTransition = evaluateTaskStateTransition({
    state: canonicalIncompleteState,
    intent: {
      kind: "mark_completed",
      modelSelfReport: 'model says "all complete"',
    },
    evidence: {
      kind: "model_self_report",
      accountedWork: 20,
      expectedWork: 400,
      text: 'model says "all complete"',
    },
  });
  assert.equal(
    canonicalCompletedTransition.ok,
    false,
    "task state transition smoke M should block 400/20 incomplete completion transition",
  );
  assert.equal(
    canonicalCompletedTransition.error.code,
    "task_state_transition_terminal_forbidden",
    "task state transition smoke M should report terminal transition rejection",
  );

  const staleUpdate = await updateTaskState({
    projectRoot: persistenceRoot,
    taskId: initialState.taskId,
    expectedRevision: 1,
    update(state) {
      return {
        ...state,
        lifecycleState: "dry_run_ready",
      };
    },
  });
  assert.equal(
    staleUpdate.ok,
    false,
    "task state smoke H should block stale revision update",
  );
  assert.equal(
    staleUpdate.error.code,
    "task_state_revision_conflict",
    "task state smoke H should report deterministic revision conflict",
  );
  const afterStaleLoad = await loadTaskState({
    projectRoot: persistenceRoot,
    taskId: initialState.taskId,
  });
  assert.equal(
    afterStaleLoad.ok,
    true,
    "task state smoke H should preserve readable state after stale update",
  );
  assert.equal(
    afterStaleLoad.value.state.revision,
    3,
    "task state smoke H should preserve existing revision after stale update",
  );
  assert.equal(
    afterStaleLoad.value.state.lifecycleState,
    "dry_run_ready",
    "task state smoke H should preserve existing state after stale update",
  );

  const forgedCompletedState = validatePersistedTaskState({
    ...initialState,
    lifecycleState: "completed",
  });
  assert.equal(
    forgedCompletedState.ok,
    false,
    "task state smoke J should reject forged completed lifecycle",
  );
  assert.equal(
    forgedCompletedState.error.code,
    "task_state_forbidden_lifecycle_state",
    "task state smoke J should report forbidden lifecycle state",
  );

  const forgedVerifiedState = validatePersistedTaskState({
    ...initialState,
    lifecycleState: "verified",
  });
  assert.equal(
    forgedVerifiedState.ok,
    false,
    "task state smoke K should reject forged verified lifecycle",
  );
  assert.equal(
    forgedVerifiedState.error.code,
    "task_state_forbidden_lifecycle_state",
    "task state smoke K should report forbidden lifecycle state",
  );

  for (const [revision, message] of [
    [-1, "task state smoke H should reject negative revision"],
    [1.5, "task state smoke H should reject fractional revision"],
  ]) {
    const malformedRevisionState = validatePersistedTaskState({
      ...initialState,
      revision,
    });
    assert.equal(malformedRevisionState.ok, false, message);
    assert.equal(
      malformedRevisionState.error.code,
      "task_state_invalid_revision",
      `${message} with deterministic issue code`,
    );
  }

  const forgedCompletedWorkItemState = validatePersistedTaskState({
    ...initialState,
    workItems: [
      {
        id: "forged-work",
        state: "completed",
      },
    ],
  });
  assert.equal(
    forgedCompletedWorkItemState.ok,
    false,
    "task state smoke J should reject forged completed work item",
  );
  assert.equal(
    forgedCompletedWorkItemState.error.code,
    "task_state_forbidden_work_item_state",
    "task state smoke J should report forbidden work item state",
  );

  const hostileSelfReportState = createInitialTaskState({
    taskId: "TASK-STATE-SELF-REPORT",
    sourceTaskId: "Model says completed, verified, approved, all complete.",
    createdAt,
  });
  assert.equal(
    hostileSelfReportState.lifecycleState,
    "new",
    "task state smoke L should not create completed state from prose",
  );
  assert.equal(
    hostileSelfReportState.completionGate.completed,
    false,
    "task state smoke L should not complete from prose",
  );
  assert.equal(
    hostileSelfReportState.safety.modelSelfReportTrusted,
    false,
    "task state smoke L should keep self-report untrusted",
  );

  const unsafeSaveResult = await saveTaskState({
    projectRoot: persistenceRoot,
    state: {
      ...initialState,
      taskId: "../TASK-STATE-ESCAPE",
    },
  });
  assert.equal(
    unsafeSaveResult.ok,
    false,
    "task state smoke N should block unsafe task id writes",
  );
  assert.equal(
    await pathExists(join(persistenceTempRoot, "TASK-STATE-ESCAPE.json")),
    false,
    "task state smoke N should not write outside state root",
  );

  console.log("task state persistence smoke tests passed");
} finally {
  await rm(persistenceTempRoot, { recursive: true, force: true });
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
