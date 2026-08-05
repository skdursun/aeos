import type {
  TaskContractMappingInput,
  TaskContractMappingResult,
  TaskContractMappingSummary,
  TaskContractResumeMapping,
  TaskContractWorkItemMapping,
} from "./task-contract-mapping.js";
import type { AeosTask, TaskValidationResult } from "./tasks.js";
import {
  createTaskContractAdapterBoundaryMapping,
  createTaskContractAuditExpectationMapping,
  createTaskContractBatchMappings,
  createTaskContractPolicyMapping,
  createTaskContractResumeMapping,
  createTaskContractVerifierRequirementMapping,
  createTaskContractWorkItemMappings,
  mapTaskContractToRunnerPlanningInput,
  summarizeTaskContractMappingResult,
} from "./task-contract-mapper.js";

interface UnsupportedExplicitWorkItemsTask extends AeosTask {
  readonly workItems: readonly {
    readonly id: string;
    readonly title: string;
  }[];
}

interface UnsupportedResumeTask extends AeosTask {
  readonly resume: {
    readonly resumeCursorReference: {
      readonly id: string;
      readonly path: string;
    };
    readonly pendingWorkItemIds: readonly string[];
    readonly retryableWorkItemIds: readonly string[];
  };
}

const taskContractSourceFile = "TASKS/TASK-0248.json";

export const mapperExampleTask: AeosTask = {
  id: "TASK-0248",
  title: "Add task contract mapping logic examples",
  purpose:
    "Add compile-checked TypeScript examples for task contract mapper helper usage.",
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
    filesToModify: [
      "packages/core/src/task-contract-mapper.example.ts",
      "PROJECT_CONTEXT.md",
    ],
    filesNotToTouch: [
      "packages/core/src/task-contract-mapper.ts",
      "packages/core/src/task-contract-mapping.ts",
    ],
    allowGeneratedFiles: true,
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
    "install_dependency",
    "deploy",
    "push_git",
    "continue_next_task",
  ],
  steps: [
    {
      order: 1,
      instruction: "Create mapper helper usage examples.",
      required: true,
      expectedOutcome: "Examples compile without runner execution.",
    },
  ],
  verification: [
    {
      command: "pnpm --filter @aeos/core check",
      level: "static_check",
      required: true,
      scope: ["packages/core/src/task-contract-mapper.example.ts"],
      expectedEvidence: ["TypeScript accepts mapper helper examples."],
    },
  ],
  stopCondition: {
    description: "Stop after TASK-0248 examples and context update.",
    stopAfterCompletion: true,
  },
  modelRecommendation: {
    purpose: "Compile-check task contract mapping examples.",
    requiredCapabilities: ["typescript", "static_analysis", "planning"],
    preferredExecutionMode: "planning",
    constraints: ["no_execution", "no_writes", "no_adapter_calls"],
  },
};

export const mapperExampleValidationResult: TaskValidationResult = {
  taskId: mapperExampleTask.id,
  status: "pass",
  valid: true,
  issues: [],
  fileBoundary: mapperExampleTask.fileBoundary,
};

export const minimalTaskMappingInput: TaskContractMappingInput = {
  taskId: mapperExampleTask.id,
  task: mapperExampleTask,
  taskContract: {
    kind: "data",
    data: mapperExampleTask,
    reference: {
      id: `task-contract:${mapperExampleTask.id}`,
      path: taskContractSourceFile,
    },
  },
  sourceFile: taskContractSourceFile,
  mode: "plan",
  options: {
    requireVerifier: true,
  },
  validation: {
    status: "pass",
    valid: true,
    result: mapperExampleValidationResult,
    reference: {
      id: `task-validation:${mapperExampleTask.id}`,
      path: "TASKS/TASK-0248.validation.json",
    },
    issues: [],
  },
  noExecution: true,
  noWrites: true,
};

export const minimalTaskMappingResult: TaskContractMappingResult =
  mapTaskContractToRunnerPlanningInput(minimalTaskMappingInput);

export const minimalTaskMappingVerifierRequired: boolean =
  minimalTaskMappingResult.verifier?.verifierRequired === true;

export const minimalTaskMappingCompletionGatedByVerifier: boolean =
  minimalTaskMappingResult.verifier?.completionGatedByVerifier === true;

export const minimalTaskMappingHasNoCompletedState: boolean =
  minimalTaskMappingResult.workItems.every(
    (workItem) => workItem.initialState !== "completed",
  ) &&
  minimalTaskMappingResult.planningInput.runnerPlanningInput?.workItems?.every(
    (workItem) => workItem.state !== "completed",
  ) === true &&
  minimalTaskMappingResult.planningInput.runnerPlanningInput?.metadata?.[
    "mappingNoCompletedState"
  ] === true;

export const singleWorkItemFallbackMappingInput: TaskContractMappingInput = {
  ...minimalTaskMappingInput,
  options: {
    allowSingleWorkItemFallback: true,
    createDefaultBatch: true,
    requireVerifier: true,
  },
};

export const singleWorkItemFallbackWorkItems: readonly TaskContractWorkItemMapping[] =
  createTaskContractWorkItemMappings(singleWorkItemFallbackMappingInput);

export const singleWorkItemFallbackBatches =
  createTaskContractBatchMappings(
    singleWorkItemFallbackMappingInput,
    singleWorkItemFallbackWorkItems,
  );

export const singleWorkItemFallbackMappingResult: TaskContractMappingResult =
  mapTaskContractToRunnerPlanningInput(singleWorkItemFallbackMappingInput);

export const singleWorkItemFallbackExpectedCount: number =
  singleWorkItemFallbackMappingResult.batches[0]?.expectedItemCount ?? 0;

export const singleWorkItemFallbackPlanningHandoffRepresented: boolean =
  singleWorkItemFallbackMappingResult.planningInput.runnerPlanningInput !==
    undefined &&
  singleWorkItemFallbackMappingResult.planningInput.runnerPlanningExecuted ===
    false;

const unsupportedExplicitWorkItemsTask: UnsupportedExplicitWorkItemsTask = {
  ...mapperExampleTask,
  id: "TASK-0248-EXPLICIT",
  workItems: [
    {
      id: "work-item:TASK-0248-EXPLICIT:001",
      title: "First unsupported explicit work item",
    },
    {
      id: "work-item:TASK-0248-EXPLICIT:002",
      title: "Second unsupported explicit work item",
    },
  ],
};

export const explicitWorkItemMappingUnsupportedInput: TaskContractMappingInput =
  {
    ...minimalTaskMappingInput,
    taskId: unsupportedExplicitWorkItemsTask.id,
    task: unsupportedExplicitWorkItemsTask,
    taskContract: {
      kind: "data",
      data: unsupportedExplicitWorkItemsTask,
      reference: {
        id: `task-contract:${unsupportedExplicitWorkItemsTask.id}`,
        path: "TASKS/TASK-0248-explicit.json",
      },
    },
    sourceFile: "TASKS/TASK-0248-explicit.json",
    options: {
      allowSingleWorkItemFallback: true,
      requireExplicitWorkItems: true,
      createDefaultBatch: true,
    },
  };

export const explicitWorkItemMappingUnsupportedResult: TaskContractMappingResult =
  mapTaskContractToRunnerPlanningInput(explicitWorkItemMappingUnsupportedInput);

export const explicitWorkItemMappingUnsupportedHonestly: boolean =
  explicitWorkItemMappingUnsupportedResult.ok === false &&
  explicitWorkItemMappingUnsupportedResult.status === "unsupported" &&
  explicitWorkItemMappingUnsupportedResult.planningInput.runnerPlanningInput ===
    undefined &&
  explicitWorkItemMappingUnsupportedResult.planningInput.runnerPlanningExecuted ===
    false;

export const unsupportedMappingInput: TaskContractMappingInput = {
  ...minimalTaskMappingInput,
  taskId: "TASK-0248-UNSUPPORTED",
  task: {
    ...mapperExampleTask,
    id: "TASK-0248-UNSUPPORTED",
  },
  sourceFile: "TASKS/TASK-0248-unsupported.json",
  mode: "dry_run",
};

export const unsupportedMappingResult: TaskContractMappingResult =
  mapTaskContractToRunnerPlanningInput(unsupportedMappingInput);

export const unsupportedMappingPlanningInputNotCreated: boolean =
  unsupportedMappingResult.status === "unsupported" &&
  unsupportedMappingResult.ok === false &&
  unsupportedMappingResult.planningInput.unsupportedReason !== undefined &&
  unsupportedMappingResult.planningInput.runnerPlanningInput === undefined &&
  unsupportedMappingResult.planningInput.runnerPlanningExecuted === false;

const duplicateExplicitWorkItemsTask: UnsupportedExplicitWorkItemsTask = {
  ...mapperExampleTask,
  id: "TASK-0248-DUPLICATE",
  workItems: [
    {
      id: "work-item:TASK-0248-DUPLICATE:001",
      title: "Duplicate unsupported explicit work item",
    },
    {
      id: "work-item:TASK-0248-DUPLICATE:001",
      title: "Duplicate unsupported explicit work item",
    },
  ],
};

export const duplicateWorkItemUnsupportedInput: TaskContractMappingInput = {
  ...minimalTaskMappingInput,
  taskId: duplicateExplicitWorkItemsTask.id,
  task: duplicateExplicitWorkItemsTask,
  taskContract: {
    kind: "data",
    data: duplicateExplicitWorkItemsTask,
    reference: {
      id: `task-contract:${duplicateExplicitWorkItemsTask.id}`,
      path: "TASKS/TASK-0248-duplicate.json",
    },
  },
  sourceFile: "TASKS/TASK-0248-duplicate.json",
};

export const duplicateWorkItemUnsupportedResult: TaskContractMappingResult =
  mapTaskContractToRunnerPlanningInput(duplicateWorkItemUnsupportedInput);

export const duplicateWorkItemIssueHandlingRepresented: boolean =
  duplicateWorkItemUnsupportedResult.ok === false &&
  duplicateWorkItemUnsupportedResult.summary.issueCount > 0 &&
  duplicateWorkItemUnsupportedResult.issues.some(
    (issue) => issue.code === "task_contract_explicit_work_items_unsupported",
  );

export const policyMappingExample =
  createTaskContractPolicyMapping(singleWorkItemFallbackMappingInput);

export const policyMappingApprovalRepresented: boolean =
  policyMappingExample?.required === true &&
  policyMappingExample.approvalRequired === false &&
  policyMappingExample.policyGateId ===
    `policy-gate:${mapperExampleTask.id}:task-contract`;

export const adapterBoundaryMappingExample =
  createTaskContractAdapterBoundaryMapping(singleWorkItemFallbackMappingInput);

export const adapterBoundaryNoCallsImplied: boolean =
  adapterBoundaryMappingExample !== undefined &&
  adapterBoundaryMappingExample.modelAdapterReferences.length === 1 &&
  adapterBoundaryMappingExample.toolAdapterReferences.length === 0 &&
  adapterBoundaryMappingExample.allowedOperations.includes("read_context") &&
  adapterBoundaryMappingExample.deniedOperations.includes("call_adapter");

export const auditExpectationMappingExample =
  createTaskContractAuditExpectationMapping(
    singleWorkItemFallbackMappingInput,
    singleWorkItemFallbackBatches,
  );

export const auditExpectationOnlyRepresented: boolean =
  auditExpectationMappingExample !== undefined &&
  auditExpectationMappingExample.expectedAuditEventIds.length > 0 &&
  auditExpectationMappingExample.requiredEventKinds.includes(
    "verification.handoff.planned",
  );

export const verifierRequirementMappingExample =
  createTaskContractVerifierRequirementMapping(
    singleWorkItemFallbackMappingInput,
  );

export const verifierRequirementNoCompletedState: boolean =
  verifierRequirementMappingExample.verifierRequired === true &&
  verifierRequirementMappingExample.completionGatedByVerifier === true &&
  verifierRequirementMappingExample.expectedCoverageRule !== undefined &&
  minimalTaskMappingHasNoCompletedState;

const unsupportedResumeTask: UnsupportedResumeTask = {
  ...mapperExampleTask,
  id: "TASK-0248-RESUME",
  resume: {
    resumeCursorReference: {
      id: "resume-cursor:TASK-0248-RESUME",
      path: "TASKS/TASK-0248-RESUME.cursor.json",
    },
    pendingWorkItemIds: ["work-item:TASK-0248-RESUME:default"],
    retryableWorkItemIds: ["work-item:TASK-0248-RESUME:default"],
  },
};

export const resumeMappingUnsupportedInput: TaskContractMappingInput = {
  ...minimalTaskMappingInput,
  taskId: unsupportedResumeTask.id,
  task: unsupportedResumeTask,
  taskContract: {
    kind: "data",
    data: unsupportedResumeTask,
    reference: {
      id: `task-contract:${unsupportedResumeTask.id}`,
      path: "TASKS/TASK-0248-resume.json",
    },
  },
  sourceFile: "TASKS/TASK-0248-resume.json",
};

export const resumeMappingUnsupported: TaskContractResumeMapping =
  createTaskContractResumeMapping(resumeMappingUnsupportedInput);

export const resumeMappingUnsupportedResult: TaskContractMappingResult =
  mapTaskContractToRunnerPlanningInput(resumeMappingUnsupportedInput);

export const resumeMappingNoPersistenceImplied: boolean =
  resumeMappingUnsupported.pendingWorkItemIds.length === 0 &&
  resumeMappingUnsupported.retryableWorkItemIds.length === 0 &&
  resumeMappingUnsupportedResult.planningInput.taskPersistenceWritten === false;

export const fullMappingResultShapeExample: TaskContractMappingResult =
  singleWorkItemFallbackMappingResult;

export const fullMappingResultShapeKeysRepresented = {
  ok: fullMappingResultShapeExample.ok,
  taskId: fullMappingResultShapeExample.taskId,
  mode: fullMappingResultShapeExample.mode,
  status: fullMappingResultShapeExample.status,
  sourceFile: fullMappingResultShapeExample.sourceFile,
  workItems: fullMappingResultShapeExample.workItems,
  batches: fullMappingResultShapeExample.batches,
  policy: fullMappingResultShapeExample.policy,
  adapterBoundary: fullMappingResultShapeExample.adapterBoundary,
  audit: fullMappingResultShapeExample.audit,
  verifier: fullMappingResultShapeExample.verifier,
  resume: fullMappingResultShapeExample.resume,
  planningInput: fullMappingResultShapeExample.planningInput,
  issues: fullMappingResultShapeExample.issues,
  summary: fullMappingResultShapeExample.summary,
};

export const summaryBehaviorExample: TaskContractMappingSummary =
  singleWorkItemFallbackMappingResult.summary;

export const summaryBehaviorRepresented: boolean =
  summaryBehaviorExample.workItemCount === 1 &&
  summaryBehaviorExample.batchCount === 1 &&
  summaryBehaviorExample.policyRequired === true &&
  summaryBehaviorExample.approvalRequired === false &&
  summaryBehaviorExample.adapterReferenceCount === 1 &&
  summaryBehaviorExample.expectedAuditEventCount > 0 &&
  summaryBehaviorExample.verifierRequired === true &&
  summaryBehaviorExample.completionGatedByVerifier === true &&
  summaryBehaviorExample.mappingSupported === true &&
  summaryBehaviorExample.noExecution === true &&
  summaryBehaviorExample.noWrites === true &&
  summaryBehaviorExample.issueCount === 0;

export const summarizedFullMappingResult: TaskContractMappingSummary =
  summarizeTaskContractMappingResult({
    ok: fullMappingResultShapeExample.ok,
    taskId: fullMappingResultShapeExample.taskId,
    mode: fullMappingResultShapeExample.mode,
    status: fullMappingResultShapeExample.status,
    sourceFile: fullMappingResultShapeExample.sourceFile,
    workItems: fullMappingResultShapeExample.workItems,
    batches: fullMappingResultShapeExample.batches,
    policy: fullMappingResultShapeExample.policy,
    adapterBoundary: fullMappingResultShapeExample.adapterBoundary,
    audit: fullMappingResultShapeExample.audit,
    verifier: fullMappingResultShapeExample.verifier,
    resume: fullMappingResultShapeExample.resume,
    planningInput: fullMappingResultShapeExample.planningInput,
    issues: fullMappingResultShapeExample.issues,
  });

export const deterministicMappingFirst: TaskContractMappingResult =
  mapTaskContractToRunnerPlanningInput(singleWorkItemFallbackMappingInput);

export const deterministicMappingSecond: TaskContractMappingResult =
  mapTaskContractToRunnerPlanningInput(singleWorkItemFallbackMappingInput);

function mappingShapeSignature(result: TaskContractMappingResult): {
  readonly ok: boolean;
  readonly taskId?: string;
  readonly mode: string;
  readonly status: string;
  readonly sourceFile?: string;
  readonly workItemIds: readonly string[];
  readonly batchIds: readonly string[];
  readonly issueCodes: readonly string[];
  readonly summary: TaskContractMappingSummary;
  readonly runnerPlanningExecuted: false;
  readonly taskPersistenceWritten: false;
} {
  return {
    ok: result.ok,
    taskId: result.taskId,
    mode: result.mode,
    status: result.status,
    sourceFile: result.sourceFile,
    workItemIds: result.workItems.map((workItem) => workItem.workItemId),
    batchIds: result.batches.map((batch) => batch.batchId),
    issueCodes: result.issues.map((issue) => issue.code),
    summary: result.summary,
    runnerPlanningExecuted: result.planningInput.runnerPlanningExecuted,
    taskPersistenceWritten: result.planningInput.taskPersistenceWritten,
  };
}

export const deterministicMappingEquivalent: boolean =
  JSON.stringify(mappingShapeSignature(deterministicMappingFirst)) ===
  JSON.stringify(mappingShapeSignature(deterministicMappingSecond));

export const noExecutionNoWriteSafetyRepresented: boolean =
  singleWorkItemFallbackMappingResult.planningInput.runnerPlanningExecuted ===
    false &&
  singleWorkItemFallbackMappingResult.planningInput.taskPersistenceWritten ===
    false &&
  singleWorkItemFallbackMappingResult.planningInput.runnerPlanningInput
    ?.metadata?.["planAgenticRunnerExecuted"] === false &&
  singleWorkItemFallbackMappingResult.planningInput.runnerPlanningInput
    ?.metadata?.["runnerExecutionStarted"] === false &&
  singleWorkItemFallbackMappingResult.planningInput.runnerPlanningInput
    ?.metadata?.["adapterCallsMade"] === false &&
  singleWorkItemFallbackMappingResult.planningInput.runnerPlanningInput
    ?.metadata?.["auditEventsEmitted"] === false &&
  singleWorkItemFallbackMappingResult.planningInput.runnerPlanningInput
    ?.metadata?.["verifierExecuted"] === false &&
  singleWorkItemFallbackMappingResult.planningInput.runnerPlanningInput
    ?.metadata?.["taskPersistenceWritten"] === false;
