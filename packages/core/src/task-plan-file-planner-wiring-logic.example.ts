import type {
  AgenticRunnerPlanningInput,
  AgenticRunnerPlanningReference,
  AgenticRunnerPlanningResult,
} from "./agentic-runner-planning.js";
import type {
  TaskContractMappingResult,
  TaskContractMappingStatus,
} from "./task-contract-mapping.js";
import type { TaskPlanInputResult } from "./task-plan-input.js";
import type {
  TaskPlanFileJsonOutput,
  TaskPlanFilePlannerWiringInput,
  TaskPlanFilePlannerWiringResult,
  TaskPlanFilePlannerWiringStatus,
} from "./task-plan-file-planner-wiring.js";
import {
  createTaskPlanFileHumanOutput,
  createTaskPlanFileJsonOutput,
  createTaskPlanFilePlannerWiringResult,
  createTaskPlanFileSafetyStage,
  evaluateTaskPlanFilePlannerWiringGates,
  mapTaskPlanFileWiringStatusToExitCode,
  summarizeTaskPlanFilePlannerWiringResult,
  type TaskPlanFilePlannerFunction,
} from "./task-plan-file-planner-wiring-logic.js";

const taskId = "TASK-0258";
const sourceFile = "TASKS/TASK-0258.json";
const updatedAt = "2026-08-05T00:00:00.000Z";

const parsedTaskReference = {
  id: `parsed-task:${taskId}`,
  path: sourceFile,
} satisfies AgenticRunnerPlanningReference;

const planningInputReference = {
  id: `runner-planning-input:${taskId}`,
  path: sourceFile,
} satisfies AgenticRunnerPlanningReference;

const planningResultReference = {
  id: `runner-planning-result:${taskId}`,
  path: sourceFile,
  metadata: {
    inMemoryOnly: true,
    noExecution: true,
    noWrites: true,
  },
} satisfies AgenticRunnerPlanningReference;

const validatedTaskContract = {
  id: taskId,
  title: "Add task plan file planner wiring logic examples.",
  status: "planned",
} as unknown as NonNullable<TaskPlanInputResult["validation"]["task"]>;

const plannerInput = {
  taskId,
  mode: "plan",
  taskContract: {
    kind: "reference",
    reference: parsedTaskReference,
  },
  workItems: [],
  batches: [],
  options: {
    requireVerifier: true,
    requireAudit: true,
    outputMode: "json",
  },
  auditRequirements: {
    expectedAuditEventIds: [`audit:${taskId}:plan`],
    requiredEventKinds: ["plan_created"],
    auditRequired: true,
    issues: [],
  },
  verifierRequirements: {
    verifierRequired: true,
    expectedCoverageRule:
      "expected_items == completed_items + explicitly_failed_items + explicitly_skipped_items",
    completionGatedByVerifier: true,
    issues: [],
  },
  metadata: {
    noExecution: true,
    noWrites: true,
    runnerExecutionStarted: false,
    adapterCallsMade: false,
    auditEventsEmitted: false,
    taskPersistenceWritten: false,
  },
} satisfies AgenticRunnerPlanningInput;

const successfulParserResult = {
  ok: true,
  mode: "plan",
  sourceFile,
  pathCheck: {
    originalPath: sourceFile,
    resolvedPath: sourceFile,
    relativePath: sourceFile,
    status: "ok",
    exists: true,
    isFile: true,
    isDirectory: false,
    withinWorkingDirectory: true,
    issues: [],
  },
  parse: {
    ok: true,
    format: "json",
    valueReference: {
      kind: "parsed_value",
      format: "json",
      sourceFile,
      taskId,
    },
    rawSizeBytes: 1,
    issues: [],
  },
  validation: {
    requested: true,
    status: "pass",
    taskId,
    task: validatedTaskContract,
    result: {
      valid: true,
      status: "pass",
      taskId,
      issues: [],
    },
    issues: [],
  },
  mapping: {
    requested: false,
    status: "not_requested",
    runnerPlanningExecuted: false,
    issues: [],
  },
  issues: [],
  summary: {
    hasSourceFile: true,
    pathOk: true,
    parseOk: true,
    validationRequested: true,
    validationOk: true,
    mappingRequested: false,
    mappingOk: false,
    issueCount: 0,
    noExecution: true,
    noWrites: true,
    runnerPlanningExecuted: false,
    taskPersistenceWritten: false,
    trustsModelSelfReporting: false,
  },
} satisfies TaskPlanInputResult;

const parserFailureResult = {
  ...successfulParserResult,
  ok: false,
  parse: {
    ok: false,
    format: "json",
    parseErrorMessage: "Example parser failure.",
    issues: [
      {
        code: "task_plan_input_parse_failed",
        message: "Example parser failure.",
        severity: "error",
        phase: "parse",
        path: sourceFile,
      },
    ],
  },
  validation: {
    requested: false,
    status: "not_requested",
    issues: [],
  },
  issues: [
    {
      code: "task_plan_input_parse_failed",
      message: "Example parser failure.",
      severity: "error",
      phase: "parse",
      path: sourceFile,
    },
  ],
  summary: {
    ...successfulParserResult.summary,
    parseOk: false,
    validationRequested: false,
    validationOk: false,
    issueCount: 1,
  },
} satisfies TaskPlanInputResult;

const validationFailureResult = {
  ...successfulParserResult,
  ok: false,
  validation: {
    requested: true,
    status: "fail",
    taskId,
      result: {
      valid: false,
      status: "fail",
      taskId,
      issues: [
        {
          code: "task_validation_failed",
          message: "Example validation failure.",
          severity: "error",
          field: "title",
        },
      ],
    },
    issues: [
      {
        code: "task_validation_failed",
        message: "Example validation failure.",
        severity: "error",
        field: "title",
      },
    ],
  },
  issues: [
    {
      code: "task_validation_failed",
      message: "Example validation failure.",
      severity: "error",
      phase: "validation",
      path: sourceFile,
      field: "title",
    },
  ],
  summary: {
    ...successfulParserResult.summary,
    validationOk: false,
    issueCount: 1,
  },
} satisfies TaskPlanInputResult;

const mappingIssue = {
  code: "task_contract_mapping_example_issue",
  message: "Example mapping issue.",
  severity: "error",
  category: "planning_input",
  taskId,
  sourceFile,
} satisfies TaskContractMappingResult["issues"][number];

const mappedResult = {
  ok: true,
  taskId,
  mode: "plan",
  status: "mapped",
  sourceFile,
  workItems: [
    {
      sourceTaskId: taskId,
      workItemId: `work-item:${taskId}:default`,
      sourceReference: parsedTaskReference,
      initialState: "pending",
      derivedFrom: "single_work_item_fallback",
      issues: [],
    },
  ],
  batches: [
    {
      batchId: `batch:${taskId}:default`,
      workItemIds: [`work-item:${taskId}:default`],
      expectedItemCount: 1,
      derivedDefaultBatch: true,
      issues: [],
    },
  ],
  policy: {
    policyGateId: `policy:${taskId}:plan`,
    required: true,
    approvalRequired: false,
    status: "not_evaluated",
    issues: [],
  },
  audit: {
    expectedAuditEventIds: [`audit:${taskId}:plan`],
    requiredEventKinds: ["plan_created"],
    auditRequired: true,
    issues: [],
  },
  verifier: {
    verifierRequired: true,
    expectedCoverageRule:
      "expected_items == completed_items + explicitly_failed_items + explicitly_skipped_items",
    completionGatedByVerifier: true,
    issues: [],
  },
  resume: {
    pendingWorkItemIds: [`work-item:${taskId}:default`],
    retryableWorkItemIds: [],
    nextBatchId: `batch:${taskId}:default`,
    issues: [],
  },
  planningInput: {
    handoffRequested: true,
    handoffStatus: "mapped",
    runnerPlanningInput: plannerInput,
    runnerPlanningInputReference: planningInputReference,
    runnerPlanningExecuted: false,
    taskPersistenceWritten: false,
    issues: [],
  },
  issues: [],
  summary: {
    workItemCount: 1,
    batchCount: 1,
    policyRequired: true,
    approvalRequired: false,
    adapterReferenceCount: 0,
    expectedAuditEventCount: 1,
    verifierRequired: true,
    completionGatedByVerifier: true,
    mappingSupported: true,
    noExecution: true,
    noWrites: true,
    issueCount: 0,
  },
} satisfies TaskContractMappingResult;

const unsupportedMappingResult = {
  ...mappedResult,
  ok: false,
  status: "unsupported",
  planningInput: {
    handoffRequested: true,
    handoffStatus: "unsupported",
    runnerPlanningExecuted: false,
    taskPersistenceWritten: false,
    unsupportedReason: "Example unsupported mapping.",
    issues: [mappingIssue],
  },
  issues: [
    {
      ...mappingIssue,
      code: "task_contract_mapping_unsupported",
      message: "Example unsupported mapping.",
      category: "unsupported",
    },
  ],
  summary: {
    ...mappedResult.summary,
    mappingSupported: false,
    issueCount: 1,
  },
} satisfies TaskContractMappingResult;

const missingVerifierGateMappingResult = {
  ...mappedResult,
  ok: true,
  verifier: {
    verifierRequired: false,
    completionGatedByVerifier: false,
    issues: [
      {
        ...mappingIssue,
        code: "task_contract_mapping_verifier_not_required",
        message: "Example missing verifier gate.",
        category: "safety",
      },
    ],
  },
  planningInput: {
    ...mappedResult.planningInput,
    runnerPlanningInput: {
      ...plannerInput,
      verifierRequirements: {
        verifierRequired: false,
        completionGatedByVerifier: false,
        issues: [],
      },
    },
  },
  issues: [
    {
      ...mappingIssue,
      code: "task_contract_mapping_verifier_not_required",
      message: "Example missing verifier gate.",
      category: "safety",
    },
  ],
  summary: {
    ...mappedResult.summary,
    verifierRequired: false,
    completionGatedByVerifier: false,
    issueCount: 1,
  },
} satisfies TaskContractMappingResult;

const missingNoExecutionNoWritesMappingResult = {
  ...mappedResult,
  ok: true,
  issues: [
    {
      ...mappingIssue,
      code: "task_contract_mapping_no_execution_not_proven",
      message: "Example missing no-execution/no-write gate.",
      severity: "critical",
      category: "safety",
    },
  ],
  summary: {
    ...mappedResult.summary,
    noExecution: false as true,
    noWrites: false as true,
    issueCount: 1,
  },
} satisfies TaskContractMappingResult;

const successfulPlannerResult = {
  ok: true,
  taskId,
  mode: "plan",
  prerequisites: [
    {
      id: `prerequisite:${taskId}:task-contract`,
      kind: "task_contract",
      status: "satisfied",
      required: true,
      issues: [],
    },
  ],
  workItems: [
    {
      id: `work-item:${taskId}:default`,
      sourceId: taskId,
      sourcePath: sourceFile,
      initialState: "pending",
      batchId: `batch:${taskId}:default`,
      issues: [],
    },
  ],
  batches: [
    {
      id: `batch:${taskId}:default`,
      workItemIds: [`work-item:${taskId}:default`],
      expectedItemCount: 1,
      deterministicOrder: [`work-item:${taskId}:default`],
      issues: [],
    },
  ],
  steps: [
    {
      id: "policy-preflight",
      kind: "policy_preflight",
      state: "pending",
      dependsOn: [],
      expectedAuditEventIds: [],
      verifierRequired: false,
      issues: [],
    },
    {
      id: "batch-default",
      kind: "batch_execution",
      state: "pending",
      dependsOn: ["policy-preflight"],
      expectedAuditEventIds: [`audit:${taskId}:plan`],
      verifierRequired: true,
      issues: [],
    },
    {
      id: "coverage-verification",
      kind: "verification",
      state: "pending",
      dependsOn: ["batch-default"],
      expectedAuditEventIds: [],
      verifierRequired: true,
      issues: [],
    },
  ],
  policy: [
    {
      policyGateId: `policy:${taskId}:plan`,
      status: "not_evaluated",
      approvalRequired: false,
      reasons: [],
      issues: [],
    },
  ],
  adapterBoundary: {
    modelAdapterReferences: [],
    toolAdapterReferences: [],
    allowedOperations: [],
    deniedOperations: [
      "call_adapter",
      "execute_runner_plan",
      "mutate_filesystem",
      "persist_task_state",
      "run_verifier",
    ],
    approvalRequired: false,
    issues: [],
  },
  audit: {
    expectedAuditEventIds: [`audit:${taskId}:plan`],
    requiredEventKinds: ["plan_created"],
    auditRequired: true,
    issues: [],
  },
  verifier: {
    verifierRequired: true,
    expectedCoverageRule:
      "expected_items == completed_items + explicitly_failed_items + explicitly_skipped_items",
    completionGatedByVerifier: true,
    issues: [],
  },
  resume: {
    nextStepId: "policy-preflight",
    nextBatchId: `batch:${taskId}:default`,
    pendingWorkItemIds: [`work-item:${taskId}:default`],
    retryableWorkItemIds: [],
    updatedAt,
  },
  issues: [],
  summary: {
    prerequisiteCount: 1,
    workItemCount: 1,
    batchCount: 1,
    stepCount: 3,
    policyGateCount: 1,
    adapterReferenceCount: 0,
    expectedAuditEventCount: 1,
    verifierRequired: true,
    approvalRequired: false,
    issueCount: 0,
  },
} satisfies AgenticRunnerPlanningResult;

const plannerFailureResult = {
  ...successfulPlannerResult,
  ok: false,
  steps: [],
  issues: [
    {
      code: "agentic_runner_planning_failed",
      message: "Example planner failure.",
      severity: "error",
      category: "unknown",
      retryable: false,
    },
  ],
  summary: {
    ...successfulPlannerResult.summary,
    stepCount: 0,
    issueCount: 1,
  },
} satisfies AgenticRunnerPlanningResult;

const successfulPlanner: TaskPlanFilePlannerFunction = () =>
  successfulPlannerResult;

const failingPlanner: TaskPlanFilePlannerFunction = () => plannerFailureResult;

const successfulJsonInput = {
  taskFile: sourceFile,
  json: true,
  mode: "plan",
  parserResult: successfulParserResult,
  mappingResult: mappedResult,
  noExecution: true,
  noWrites: true,
} satisfies TaskPlanFilePlannerWiringInput;

const successfulHumanInput = {
  ...successfulJsonInput,
  json: false,
} satisfies TaskPlanFilePlannerWiringInput;

const parserFailureInput = {
  ...successfulJsonInput,
  parserResult: parserFailureResult,
  mappingResult: undefined,
} satisfies TaskPlanFilePlannerWiringInput;

const validationFailureInput = {
  ...successfulJsonInput,
  parserResult: validationFailureResult,
  mappingResult: undefined,
} satisfies TaskPlanFilePlannerWiringInput;

const unsupportedMappingInput = {
  ...successfulJsonInput,
  mappingResult: unsupportedMappingResult,
} satisfies TaskPlanFilePlannerWiringInput;

const missingVerifierGateInput = {
  ...successfulJsonInput,
  mappingResult: missingVerifierGateMappingResult,
} satisfies TaskPlanFilePlannerWiringInput;

const missingNoExecutionNoWritesInput = {
  ...successfulJsonInput,
  mappingResult: missingNoExecutionNoWritesMappingResult,
} satisfies TaskPlanFilePlannerWiringInput;

export const scenarioASuccessfulMinimalPlanningHandoff =
  createTaskPlanFilePlannerWiringResult(successfulJsonInput, {
    planner: successfulPlanner,
    planningResultReference,
  }) satisfies TaskPlanFilePlannerWiringResult;

export const scenarioBParserFailureFailClosed =
  createTaskPlanFilePlannerWiringResult(parserFailureInput, {
    planner: successfulPlanner,
    planningResultReference,
  }) satisfies TaskPlanFilePlannerWiringResult;

export const scenarioCValidationFailureFailClosed =
  createTaskPlanFilePlannerWiringResult(validationFailureInput, {
    planner: successfulPlanner,
    planningResultReference,
  }) satisfies TaskPlanFilePlannerWiringResult;

export const scenarioDUnsupportedMappingFailClosed =
  createTaskPlanFilePlannerWiringResult(unsupportedMappingInput, {
    planner: successfulPlanner,
    planningResultReference,
  }) satisfies TaskPlanFilePlannerWiringResult;

export const scenarioEMissingVerifierGateFailClosed =
  createTaskPlanFilePlannerWiringResult(missingVerifierGateInput, {
    planner: successfulPlanner,
    planningResultReference,
  }) satisfies TaskPlanFilePlannerWiringResult;

export const scenarioFMissingNoExecutionNoWritesGateFailClosed =
  createTaskPlanFilePlannerWiringResult(missingNoExecutionNoWritesInput, {
    planner: successfulPlanner,
    planningResultReference,
  }) satisfies TaskPlanFilePlannerWiringResult;

export const scenarioGPlannerFailureFailClosed =
  createTaskPlanFilePlannerWiringResult(successfulJsonInput, {
    planner: failingPlanner,
    planningResultReference,
  }) satisfies TaskPlanFilePlannerWiringResult;

export const scenarioHSafetyStageCreation = createTaskPlanFileSafetyStage({
  input: successfulJsonInput,
  plannerMayRunLater: true,
}) satisfies ReturnType<typeof createTaskPlanFileSafetyStage>;

const successfulHumanResult = createTaskPlanFilePlannerWiringResult(
  successfulHumanInput,
  {
    planner: successfulPlanner,
    planningResultReference,
  },
);

export const scenarioIHumanOutputPayload =
  createTaskPlanFileHumanOutput(successfulHumanResult);

export const scenarioJJsonOutputPayload =
  createTaskPlanFileJsonOutput(
    scenarioASuccessfulMinimalPlanningHandoff,
  ) satisfies TaskPlanFileJsonOutput;

export const scenarioKSummaryGeneration =
  summarizeTaskPlanFilePlannerWiringResult({
    ok: scenarioASuccessfulMinimalPlanningHandoff.ok,
    status: scenarioASuccessfulMinimalPlanningHandoff.status,
    exitCode: scenarioASuccessfulMinimalPlanningHandoff.exitCode,
    taskId: scenarioASuccessfulMinimalPlanningHandoff.taskId,
    mode: scenarioASuccessfulMinimalPlanningHandoff.mode,
    sourceFile: scenarioASuccessfulMinimalPlanningHandoff.sourceFile,
    parse: scenarioASuccessfulMinimalPlanningHandoff.parse,
    mapping: scenarioASuccessfulMinimalPlanningHandoff.mapping,
    planner: scenarioASuccessfulMinimalPlanningHandoff.planner,
    safety: scenarioASuccessfulMinimalPlanningHandoff.safety,
    jsonOutput: scenarioASuccessfulMinimalPlanningHandoff.jsonOutput,
    issues: scenarioASuccessfulMinimalPlanningHandoff.issues,
  });

export const scenarioLExitCodeMapping = {
  planned: mapTaskPlanFileWiringStatusToExitCode("planned"),
  parser_failed: mapTaskPlanFileWiringStatusToExitCode("parser_failed"),
  validation_failed: mapTaskPlanFileWiringStatusToExitCode("validation_failed"),
  unsupported_mapping: mapTaskPlanFileWiringStatusToExitCode(
    "unsupported_mapping",
  ),
  mapping_failed: mapTaskPlanFileWiringStatusToExitCode("mapping_failed"),
  planner_failed: mapTaskPlanFileWiringStatusToExitCode("planner_failed"),
  blocked: mapTaskPlanFileWiringStatusToExitCode("blocked"),
  failed: mapTaskPlanFileWiringStatusToExitCode("failed"),
  unknown: mapTaskPlanFileWiringStatusToExitCode("unknown"),
} satisfies Record<TaskPlanFilePlannerWiringStatus, string>;

const deterministicFirst = createTaskPlanFilePlannerWiringResult(
  successfulJsonInput,
  {
    planner: successfulPlanner,
    planningResultReference,
  },
);

const deterministicSecond = createTaskPlanFilePlannerWiringResult(
  successfulJsonInput,
  {
    planner: successfulPlanner,
    planningResultReference,
  },
);

export const scenarioMDeterministicOutput = {
  sameOk: deterministicFirst.ok === deterministicSecond.ok,
  sameStatus: deterministicFirst.status === deterministicSecond.status,
  sameExitCode: deterministicFirst.exitCode === deterministicSecond.exitCode,
  sameTaskId: deterministicFirst.taskId === deterministicSecond.taskId,
  sameSummary: deterministicFirst.summary,
  repeatedSummary: deterministicSecond.summary,
  adapterCallsRemainFalse:
    deterministicFirst.safety.adapterCalls === false &&
    deterministicSecond.safety.adapterCalls === false,
  filesystemMutationRemainsFalse:
    deterministicFirst.safety.filesystemMutation === false &&
    deterministicSecond.safety.filesystemMutation === false,
};

export function createScenarioNOptionalDependencyInjectedPlannerBehavior() {
  let plannerCalls = 0;
  const injectedPlanner: TaskPlanFilePlannerFunction = (input) => {
    plannerCalls += 1;
    return {
      ...successfulPlannerResult,
      taskId: input.taskId,
    };
  };

  const planned = createTaskPlanFilePlannerWiringResult(successfulJsonInput, {
    planner: injectedPlanner,
    planningResultReference,
  });
  const callsAfterSuccessfulGate = plannerCalls;
  const parserFailed = createTaskPlanFilePlannerWiringResult(
    parserFailureInput,
    {
      planner: injectedPlanner,
      planningResultReference,
    },
  );
  const callsAfterParserFailedGate = plannerCalls;
  const blocked = createTaskPlanFilePlannerWiringResult(
    missingVerifierGateInput,
    {
      planner: injectedPlanner,
      planningResultReference,
    },
  );
  const callsAfterBlockedGate = plannerCalls;

  return {
    planned,
    parserFailed,
    blocked,
    callsAfterSuccessfulGate,
    callsAfterParserFailedGate,
    callsAfterBlockedGate,
    plannerInvokedOnlyAfterGatesPass:
      callsAfterSuccessfulGate === 1 &&
      callsAfterParserFailedGate === 1 &&
      callsAfterBlockedGate === 1,
    directPlanAgenticRunnerCall: false,
  };
}

export const successfulPlanningGateEvaluation =
  evaluateTaskPlanFilePlannerWiringGates(successfulJsonInput);

export const blockedPlanningGateEvaluation =
  evaluateTaskPlanFilePlannerWiringGates(missingVerifierGateInput);
