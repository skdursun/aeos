import type {
  AgenticRunnerPlanningInput,
  AgenticRunnerPlanningIssue,
  AgenticRunnerPlanningResult,
} from "./agentic-runner-planning.js";
import type {
  CliTaskPlanExitCode,
  CliTaskPlanHumanRenderModel,
  CliTaskPlanJsonOnlyBehavior,
  CliTaskPlanJsonRenderModel,
  CliTaskPlanPlannerIntegrationInput,
  CliTaskPlanPlannerIntegrationResult,
  CliTaskPlanPlannerIntegrationStatus,
  CliTaskPlanPlannerIntegrationSummary,
} from "./cli-task-plan-planner-integration.js";
import {
  createCliTaskPlanHumanRenderModel,
  createCliTaskPlanJsonOnlyBehavior,
  createCliTaskPlanJsonRenderModel,
  createCliTaskPlanPlannerIntegrationResult,
  evaluateCliTaskPlanPlannerIntegrationGates,
  mapCliTaskPlanStatusToExitCode,
  summarizeCliTaskPlanPlannerIntegrationResult,
  type CliTaskPlanPlannerFunction,
} from "./cli-task-plan-planner-integration-logic.js";
import type { TaskContractMappingResult } from "./task-contract-mapping.js";
import type { TaskPlanInputResult } from "./task-plan-input.js";

const taskId = "TASK-0268";
const taskFile = "TASKS/TASK-0268.json";
const runnerPlanningInputReference = {
  id: "runner-planning-input:TASK-0268",
  path: taskFile,
} as const;

type ParsedTask = NonNullable<TaskPlanInputResult["validation"]["task"]>;

const parsedTask = {
  id: taskId,
  title: "Add CLI task plan planner integration logic examples.",
  status: "planned",
} as unknown as ParsedTask;

const parserSuccess = {
  ok: true,
  mode: "plan",
  sourceFile: taskFile,
  pathCheck: {
    originalPath: taskFile,
    relativePath: taskFile,
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
    value: parsedTask,
    valueReference: {
      kind: "parsed_value",
      format: "json",
      sourceFile: taskFile,
      taskId,
    },
    rawSizeBytes: 256,
    issues: [],
  },
  validation: {
    requested: true,
    status: "pass",
    taskId,
    task: parsedTask,
    result: {
      valid: true,
      status: "pass",
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
} as const satisfies TaskPlanInputResult;

const parserFailure = {
  ...parserSuccess,
  ok: false,
  parse: {
    ok: false,
    format: "json",
    parseErrorMessage: "Expected object.",
    issues: [
      {
        code: "task_plan_input_parse_failed",
        message: "Task plan input could not be parsed.",
        severity: "error",
        phase: "parse",
        path: taskFile,
        field: "root",
      },
    ],
  },
  validation: {
    requested: true,
    status: "unknown",
    issues: [],
  },
  issues: [
    {
      code: "task_plan_input_parse_failed",
      message: "Task plan input could not be parsed.",
      severity: "error",
      phase: "parse",
      path: taskFile,
      field: "root",
    },
  ],
  summary: {
    ...parserSuccess.summary,
    parseOk: false,
    validationOk: false,
    issueCount: 1,
  },
} as const satisfies TaskPlanInputResult;

const validationFailure = {
  ...parserSuccess,
  ok: false,
  validation: {
    requested: true,
    status: "fail",
    taskId,
    result: {
      valid: false,
      status: "fail",
      issues: [
        {
          code: "task_title_missing",
          message: "Task title is required.",
          severity: "error",
          field: "title",
        },
      ],
    },
    issues: [
      {
        code: "task_title_missing",
        message: "Task title is required.",
        severity: "error",
        field: "title",
      },
    ],
  },
  issues: [
    {
      code: "task_title_missing",
      message: "Task title is required.",
      severity: "error",
      phase: "validation",
      path: taskFile,
      field: "title",
    },
  ],
  summary: {
    ...parserSuccess.summary,
    validationOk: false,
    issueCount: 1,
  },
} as const satisfies TaskPlanInputResult;

const runnerPlanningInput = {
  taskId,
  mode: "plan",
  options: {
    requireVerifier: true,
    requireAudit: true,
    outputMode: "summary",
  },
  auditRequirements: {
    expectedAuditEventIds: ["audit:TASK-0268:planned"],
    requiredEventKinds: ["plan_created"],
    auditRequired: true,
    issues: [],
  },
  verifierRequirements: {
    verifierRequired: true,
    completionGatedByVerifier: true,
    expectedCoverageRule:
      "expected_items == completed_items + explicitly_failed_items + explicitly_skipped_items",
    issues: [],
  },
  metadata: {
    noExecution: true,
    noWrites: true,
    runnerExecutionStarted: false,
    adapterCallsMade: false,
    executionEnabled: false,
    auditEventsEmitted: false,
    taskPersistenceWritten: false,
  },
} as const satisfies AgenticRunnerPlanningInput;

const mappingSuccess = {
  ok: true,
  taskId,
  mode: "plan",
  status: "mapped",
  sourceFile: taskFile,
  workItems: [
    {
      sourceTaskId: taskId,
      workItemId: "work-item:TASK-0268:default",
      initialState: "pending",
      derivedFrom: "single_work_item_fallback",
      issues: [],
    },
  ],
  batches: [
    {
      batchId: "batch:TASK-0268:default",
      workItemIds: ["work-item:TASK-0268:default"],
      expectedItemCount: 1,
      derivedDefaultBatch: true,
      issues: [],
    },
  ],
  policy: {
    policyGateId: "policy:TASK-0268",
    required: true,
    approvalRequired: false,
    status: "allowed",
    issues: [],
  },
  audit: {
    expectedAuditEventIds: ["audit:TASK-0268:planned"],
    requiredEventKinds: ["plan_created"],
    auditRequired: true,
    issues: [],
  },
  verifier: {
    verifierRequired: true,
    completionGatedByVerifier: true,
    expectedCoverageRule:
      "expected_items == completed_items + explicitly_failed_items + explicitly_skipped_items",
    issues: [],
  },
  planningInput: {
    handoffRequested: true,
    handoffStatus: "mapped",
    runnerPlanningInput,
    runnerPlanningInputReference,
    runnerPlanningInputData: {
      kind: "data",
      data: runnerPlanningInput,
      reference: runnerPlanningInputReference,
    },
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
} as const satisfies TaskContractMappingResult;

const baseInput = {
  taskFile,
  json: false,
  mode: "plan",
  parserResult: parserSuccess,
  parserResultReference: {
    id: "parser-result:TASK-0268",
    path: taskFile,
  },
  mappingResult: mappingSuccess,
  mappingResultReference: {
    id: "mapping-result:TASK-0268",
    path: taskFile,
  },
  wiringResultReference: {
    id: "wiring-result:TASK-0268",
    path: taskFile,
  },
  plannerDependencyReference: {
    id: "dependency-injected-fake-planner",
  },
  noExecution: true,
  noWrites: true,
} as const satisfies CliTaskPlanPlannerIntegrationInput;

const plannerFailureIssue = {
  code: "agentic_runner_planning_failed",
  message: "The in-memory planner could not create steps.",
  severity: "error",
  category: "unknown",
  retryable: false,
} as const satisfies AgenticRunnerPlanningIssue;

function createPlanningResult(input: AgenticRunnerPlanningInput): AgenticRunnerPlanningResult {
  return {
    ok: true,
    taskId: input.taskId,
    mode: input.mode,
    prerequisites: [
      {
        id: "prerequisite:task-contract",
        kind: "task_contract",
        status: "satisfied",
        required: true,
        issues: [],
      },
    ],
    workItems: [
      {
        id: "work-item:TASK-0268:default",
        sourceId: input.taskId,
        initialState: "pending",
        batchId: "batch:TASK-0268:default",
        issues: [],
      },
    ],
    batches: [
      {
        id: "batch:TASK-0268:default",
        workItemIds: ["work-item:TASK-0268:default"],
        expectedItemCount: 1,
        deterministicOrder: ["work-item:TASK-0268:default"],
        issues: [],
      },
    ],
    steps: [
      {
        id: "step:TASK-0268:policy",
        kind: "policy_preflight",
        state: "pending",
        dependsOn: [],
        expectedAuditEventIds: [],
        verifierRequired: false,
        issues: [],
      },
      {
        id: "step:TASK-0268:batch",
        kind: "batch_execution",
        state: "pending",
        dependsOn: ["step:TASK-0268:policy"],
        expectedAuditEventIds: ["audit:TASK-0268:planned"],
        verifierRequired: false,
        issues: [],
      },
      {
        id: "step:TASK-0268:verify",
        kind: "verification",
        state: "pending",
        dependsOn: ["step:TASK-0268:batch"],
        expectedAuditEventIds: [],
        verifierRequired: true,
        issues: [],
      },
    ],
    policy: [
      {
        policyGateId: "policy:TASK-0268",
        status: "allowed",
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
      ],
      approvalRequired: false,
      issues: [],
    },
    audit: {
      expectedAuditEventIds: ["audit:TASK-0268:planned"],
      requiredEventKinds: ["plan_created"],
      auditRequired: true,
      issues: [],
    },
    verifier: {
      verifierRequired: true,
      completionGatedByVerifier: true,
      expectedCoverageRule:
        "expected_items == completed_items + explicitly_failed_items + explicitly_skipped_items",
      issues: [],
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
  };
}

function createFailedPlanningResult(
  input: AgenticRunnerPlanningInput,
): AgenticRunnerPlanningResult {
  return {
    ...createPlanningResult(input),
    ok: false,
    steps: [],
    issues: [plannerFailureIssue],
    summary: {
      ...createPlanningResult(input).summary,
      stepCount: 0,
      issueCount: 1,
    },
  };
}

function createCountingPlanner(): {
  readonly planner: CliTaskPlanPlannerFunction;
  readonly calls: () => number;
} {
  let callCount = 0;

  return {
    planner: (input) => {
      callCount += 1;

      return createPlanningResult(input);
    },
    calls: () => callCount,
  };
}

const successfulPlanner = createCountingPlanner();

export const scenarioASuccessfulCliTaskPlanIntegrationLogic =
  createCliTaskPlanPlannerIntegrationResult(baseInput, {
    planner: successfulPlanner.planner,
    planningResultReference: {
      id: "planning-result:TASK-0268",
    },
  });

export const scenarioASuccessfulCliTaskPlanIntegrationLogicChecks = {
  taskFileRepresented: scenarioASuccessfulCliTaskPlanIntegrationLogic.sourceFile === taskFile,
  jsonRequestedFalse:
    scenarioASuccessfulCliTaskPlanIntegrationLogic.jsonOnly.jsonRequested === false,
  modePlan: scenarioASuccessfulCliTaskPlanIntegrationLogic.mode === "plan",
  parserStageOk: scenarioASuccessfulCliTaskPlanIntegrationLogic.parser.ok,
  mappingStageOk: scenarioASuccessfulCliTaskPlanIntegrationLogic.mapping.ok,
  runnerPlanningInputAvailable:
    scenarioASuccessfulCliTaskPlanIntegrationLogic.mapping.runnerPlanningInputAvailable,
  mappingResultHasRunnerPlanningInput:
    scenarioASuccessfulCliTaskPlanIntegrationLogic.mapping.mappingResult?.planningInput
      .runnerPlanningInput !== undefined,
  noExecution: scenarioASuccessfulCliTaskPlanIntegrationLogic.mapping.noExecution,
  noWrites: scenarioASuccessfulCliTaskPlanIntegrationLogic.mapping.noWrites,
  verifierRequired:
    scenarioASuccessfulCliTaskPlanIntegrationLogic.mapping.verifierRequired,
  completionGatedByVerifier:
    scenarioASuccessfulCliTaskPlanIntegrationLogic.mapping
      .completionGatedByVerifier,
  wiringStageOk: scenarioASuccessfulCliTaskPlanIntegrationLogic.wiring.ok,
  plannerDependencyInjected:
    scenarioASuccessfulCliTaskPlanIntegrationLogic.wiring
      .plannerDependencyInjected,
  plannerInvocationAllowed:
    scenarioASuccessfulCliTaskPlanIntegrationLogic.wiring
      .plannerInvocationAllowed,
  fakePlannerInvokedOnlyAfterGatesPass:
    successfulPlanner.calls() === 1 &&
    scenarioASuccessfulCliTaskPlanIntegrationLogic.wiring.plannerInvocationAllowed,
  ok: scenarioASuccessfulCliTaskPlanIntegrationLogic.ok,
  statusPlanned:
    scenarioASuccessfulCliTaskPlanIntegrationLogic.status === "planned",
  exitCodeSuccess:
    scenarioASuccessfulCliTaskPlanIntegrationLogic.exitCode === "success",
  safetySideEffectFlagsFalse:
    scenarioASuccessfulCliTaskPlanIntegrationLogic.safety.executionEnabled === false &&
    scenarioASuccessfulCliTaskPlanIntegrationLogic.safety.adapterCalls === false &&
    scenarioASuccessfulCliTaskPlanIntegrationLogic.safety.auditWrites === false &&
    scenarioASuccessfulCliTaskPlanIntegrationLogic.safety.verifierRun === false &&
    scenarioASuccessfulCliTaskPlanIntegrationLogic.safety.persistence === false &&
    scenarioASuccessfulCliTaskPlanIntegrationLogic.safety.filesystemMutation === false &&
    scenarioASuccessfulCliTaskPlanIntegrationLogic.safety.completedStateCreated === false,
} as const;

export const scenarioBJsonSuccessBehavior =
  createCliTaskPlanPlannerIntegrationResult(
    {
      ...baseInput,
      json: true,
    },
    {
      planner: createPlanningResult,
      planningResultReference: {
        id: "json-planning-result:TASK-0268",
      },
    },
  );

export const scenarioBJsonSuccessBehaviorChecks = {
  jsonRequested: scenarioBJsonSuccessBehavior.jsonOnly.jsonRequested,
  suppressHumanOutput: scenarioBJsonSuccessBehavior.jsonOnly.suppressHumanOutput,
  validJsonOnly: scenarioBJsonSuccessBehavior.jsonOnly.validJsonOnly,
  noProsePrefix: scenarioBJsonSuccessBehavior.jsonOnly.noProsePrefix,
  noProseSuffix: scenarioBJsonSuccessBehavior.jsonOnly.noProseSuffix,
  noStackTraces: scenarioBJsonSuccessBehavior.jsonOnly.noStackTraces,
  noRawEngineErrors: scenarioBJsonSuccessBehavior.jsonOnly.noRawEngineErrors,
  deterministicIssues: scenarioBJsonSuccessBehavior.jsonOnly.deterministicIssues,
  jsonOutputPresent: scenarioBJsonSuccessBehavior.jsonOutput !== undefined,
  humanOutputSuppressed: scenarioBJsonSuccessBehavior.humanOutput === undefined,
  ok: scenarioBJsonSuccessBehavior.ok,
  statusPlanned: scenarioBJsonSuccessBehavior.status === "planned",
  exitCodeSuccess: scenarioBJsonSuccessBehavior.exitCode === "success",
} as const;

export const scenarioCParserFailure = createCliTaskPlanPlannerIntegrationResult(
  {
    ...baseInput,
    parserResult: parserFailure,
  },
  {
    planner: createPlanningResult,
  },
);

export const scenarioCParserFailureChecks = {
  parserAttempted: scenarioCParserFailure.parser.attempted,
  parserOkFalse: scenarioCParserFailure.parser.ok === false,
  mappingAttemptedFalse: scenarioCParserFailure.mapping.attempted === false,
  wiringAttemptedFalse: scenarioCParserFailure.wiring.attempted === false,
  plannerAttemptedFalse: scenarioCParserFailure.planner.attempted === false,
  statusParserFailed: scenarioCParserFailure.status === "parser_failed",
  exitCodeParserFailure: scenarioCParserFailure.exitCode === "parser_failure",
  okFalse: scenarioCParserFailure.ok === false,
  executionEnabledFalse: scenarioCParserFailure.safety.executionEnabled === false,
  issueRepresented: scenarioCParserFailure.issues.length > 0,
} as const;

export const scenarioDValidationFailure =
  createCliTaskPlanPlannerIntegrationResult(
    {
      ...baseInput,
      parserResult: validationFailure,
    },
    {
      planner: createPlanningResult,
    },
  );

export const scenarioDValidationFailureChecks = {
  parserOkFalseAfterValidation: scenarioDValidationFailure.parser.ok === false,
  validationIncompatible:
    scenarioDValidationFailure.parser.validationCompatible === false,
  validationStatusFailed:
    scenarioDValidationFailure.parser.validationStatus === "fail",
  mappingAttemptedFalse: scenarioDValidationFailure.mapping.attempted === false,
  wiringAttemptedFalse: scenarioDValidationFailure.wiring.attempted === false,
  plannerAttemptedFalse: scenarioDValidationFailure.planner.attempted === false,
  statusValidationFailed: scenarioDValidationFailure.status === "validation_failed",
  exitCodeValidationFailure:
    scenarioDValidationFailure.exitCode === "validation_failure",
  failClosed: scenarioDValidationFailure.ok === false,
} as const;

const unsupportedMapping = {
  ...mappingSuccess,
  ok: false,
  status: "unsupported",
  planningInput: {
    handoffRequested: true,
    handoffStatus: "unsupported",
    runnerPlanningExecuted: false,
    taskPersistenceWritten: false,
    unsupportedReason: "Current mapping supports plan-mode task contracts only.",
    issues: [
      {
        code: "task_contract_mapping_mode_unsupported",
        message: "Task contract mapping currently supports plan mode only.",
        severity: "error",
        category: "unsupported",
        field: "mode",
        retryable: false,
      },
    ],
  },
  issues: [
    {
      code: "task_contract_mapping_mode_unsupported",
      message: "Task contract mapping currently supports plan mode only.",
      severity: "error",
      category: "unsupported",
      field: "mode",
      retryable: false,
    },
  ],
  summary: {
    ...mappingSuccess.summary,
    workItemCount: 0,
    batchCount: 0,
    mappingSupported: false,
    issueCount: 1,
  },
} as const satisfies TaskContractMappingResult;

export const scenarioEUnsupportedMapping =
  createCliTaskPlanPlannerIntegrationResult(
    {
      ...baseInput,
      mappingResult: unsupportedMapping,
    },
    {
      planner: createPlanningResult,
    },
  );

export const scenarioEUnsupportedMappingChecks = {
  mappingAttempted: scenarioEUnsupportedMapping.mapping.attempted,
  mappingOkFalse: scenarioEUnsupportedMapping.mapping.ok === false,
  mappingStatusUnsupported:
    scenarioEUnsupportedMapping.mapping.status === "unsupported",
  runnerPlanningInputAvailableFalse:
    scenarioEUnsupportedMapping.mapping.runnerPlanningInputAvailable === false,
  wiringBlocked: scenarioEUnsupportedMapping.wiring.ok === false,
  plannerBlocked: scenarioEUnsupportedMapping.planner.attempted === false,
  statusUnsupportedMapping:
    scenarioEUnsupportedMapping.status === "unsupported_mapping",
  exitCodeUnsupportedMapping:
    scenarioEUnsupportedMapping.exitCode === "unsupported_mapping",
  noFakeSuccess: scenarioEUnsupportedMapping.ok === false,
} as const;

const mappedWithoutRunnerPlanningInput = {
  ...mappingSuccess,
  ok: true,
  planningInput: {
    handoffRequested: true,
    handoffStatus: "mapped",
    runnerPlanningExecuted: false,
    taskPersistenceWritten: false,
    issues: [],
  },
} as const satisfies TaskContractMappingResult;

export const scenarioFMissingRunnerPlanningInput =
  createCliTaskPlanPlannerIntegrationResult(
    {
      ...baseInput,
      mappingResult: mappedWithoutRunnerPlanningInput,
    },
    {
      planner: createPlanningResult,
    },
  );

export const scenarioFMissingRunnerPlanningInputChecks = {
  mappingOkFalse:
    scenarioFMissingRunnerPlanningInput.mapping.ok === false,
  runnerPlanningInputAvailableFalse:
    scenarioFMissingRunnerPlanningInput.mapping.runnerPlanningInputAvailable === false,
  mappingResultRunnerPlanningInputAbsent:
    scenarioFMissingRunnerPlanningInput.mapping.mappingResult?.planningInput
      .runnerPlanningInput === undefined,
  topLevelPlannerInputCannotBypass:
    scenarioFMissingRunnerPlanningInput.wiring.topLevelPlannerInputBypassAllowed ===
    false,
  plannerInvocationAllowedFalse:
    scenarioFMissingRunnerPlanningInput.wiring.plannerInvocationAllowed === false,
  plannerNotInvoked: scenarioFMissingRunnerPlanningInput.planner.attempted === false,
  statusMappingFailed:
    scenarioFMissingRunnerPlanningInput.status === "mapping_failed",
  issueRepresented: scenarioFMissingRunnerPlanningInput.issues.length > 0,
} as const;

const mappingWithoutVerifierGate = {
  ...mappingSuccess,
  verifier: {
    verifierRequired: false,
    completionGatedByVerifier: false,
    issues: [],
  },
  planningInput: {
    ...mappingSuccess.planningInput,
    runnerPlanningInput: {
      ...runnerPlanningInput,
      verifierRequirements: {
        verifierRequired: false,
        completionGatedByVerifier: false,
        issues: [],
      },
    },
  },
  summary: {
    ...mappingSuccess.summary,
    verifierRequired: false,
    completionGatedByVerifier: false,
  },
} as const satisfies TaskContractMappingResult;

export const scenarioGMissingVerifierGate =
  createCliTaskPlanPlannerIntegrationResult(
    {
      ...baseInput,
      mappingResult: mappingWithoutVerifierGate,
    },
    {
      planner: createPlanningResult,
    },
  );

export const scenarioGMissingVerifierGateChecks = {
  verifierRequiredFalse:
    scenarioGMissingVerifierGate.mapping.verifierRequired === false,
  completionGatedByVerifierFalse:
    scenarioGMissingVerifierGate.mapping.completionGatedByVerifier === false,
  plannerInvocationAllowedFalse:
    scenarioGMissingVerifierGate.wiring.plannerInvocationAllowed === false,
  plannerNotInvoked: scenarioGMissingVerifierGate.planner.attempted === false,
  okFalse: scenarioGMissingVerifierGate.ok === false,
  statusBlocked: scenarioGMissingVerifierGate.status === "blocked",
  issueRepresented: scenarioGMissingVerifierGate.issues.length > 0,
  executionEnabledFalse: scenarioGMissingVerifierGate.safety.executionEnabled === false,
} as const;

const mappingWithoutNoExecutionNoWrites = {
  ...mappingSuccess,
  planningInput: {
    ...mappingSuccess.planningInput,
    runnerPlanningInput: {
      ...runnerPlanningInput,
      metadata: {
        noExecution: false,
        noWrites: false,
      },
    },
    runnerPlanningInputData: undefined,
  },
} as const satisfies TaskContractMappingResult;

export const scenarioHMissingNoExecutionNoWrites =
  createCliTaskPlanPlannerIntegrationResult(
    {
      ...baseInput,
      mappingResult: mappingWithoutNoExecutionNoWrites,
    },
    {
      planner: createPlanningResult,
    },
  );

export const scenarioHMissingNoExecutionNoWritesChecks = {
  noExecutionNotProven:
    scenarioHMissingNoExecutionNoWrites.mapping.ok === false,
  noWritesNotProven:
    scenarioHMissingNoExecutionNoWrites.mapping.ok === false,
  plannerInvocationAllowedFalse:
    scenarioHMissingNoExecutionNoWrites.wiring.plannerInvocationAllowed === false,
  plannerNotInvoked:
    scenarioHMissingNoExecutionNoWrites.planner.attempted === false,
  okFalse: scenarioHMissingNoExecutionNoWrites.ok === false,
  statusBlocked: scenarioHMissingNoExecutionNoWrites.status === "blocked",
  issueRepresented: scenarioHMissingNoExecutionNoWrites.issues.length > 0,
  filesystemMutationFalse:
    scenarioHMissingNoExecutionNoWrites.safety.filesystemMutation === false,
  executionEnabledFalse:
    scenarioHMissingNoExecutionNoWrites.safety.executionEnabled === false,
} as const;

const mappingWithUnsafeRepresentedMetadata = {
  ...mappingSuccess,
  planningInput: {
    ...mappingSuccess.planningInput,
    runnerPlanningInput: {
      ...runnerPlanningInput,
      metadata: {
        ...runnerPlanningInput.metadata,
        verifierRun: true,
        filesystemMutation: true,
        completedStateCreated: true,
      },
    },
  },
} as const satisfies TaskContractMappingResult;

export const scenarioIUnsafeRepresentedMetadata =
  createCliTaskPlanPlannerIntegrationResult(
    {
      ...baseInput,
      mappingResult: mappingWithUnsafeRepresentedMetadata,
    },
    {
      planner: createPlanningResult,
    },
  );

export const scenarioIUnsafeRepresentedMetadataChecks = {
  representedVerifierRunTrue:
    mappingWithUnsafeRepresentedMetadata.planningInput.runnerPlanningInput
      .metadata.verifierRun === true,
  representedFilesystemMutationTrue:
    mappingWithUnsafeRepresentedMetadata.planningInput.runnerPlanningInput
      .metadata.filesystemMutation === true,
  representedCompletedStateCreatedTrue:
    mappingWithUnsafeRepresentedMetadata.planningInput.runnerPlanningInput
      .metadata.completedStateCreated === true,
  okFalse: scenarioIUnsafeRepresentedMetadata.ok === false,
  statusBlocked: scenarioIUnsafeRepresentedMetadata.status === "blocked",
  issueRepresented: scenarioIUnsafeRepresentedMetadata.issues.length > 0,
  plannerInvocationAllowedFalse:
    scenarioIUnsafeRepresentedMetadata.wiring.plannerInvocationAllowed === false,
  plannerNotInvoked: scenarioIUnsafeRepresentedMetadata.planner.attempted === false,
  failClosed: scenarioIUnsafeRepresentedMetadata.ok === false,
} as const;

export const scenarioJPlannerFailure = createCliTaskPlanPlannerIntegrationResult(
  baseInput,
  {
    planner: createFailedPlanningResult,
    planningResultReference: {
      id: "failed-planning-result:TASK-0268",
    },
  },
);

export const scenarioJPlannerFailureChecks = {
  parserOk: scenarioJPlannerFailure.parser.ok,
  mappingOk: scenarioJPlannerFailure.mapping.ok,
  runnerPlanningInputAvailable:
    scenarioJPlannerFailure.mapping.runnerPlanningInputAvailable,
  wiringOk: scenarioJPlannerFailure.wiring.ok,
  plannerAttempted: scenarioJPlannerFailure.planner.attempted,
  plannerOkFalse: scenarioJPlannerFailure.planner.ok === false,
  statusPlannerFailed: scenarioJPlannerFailure.status === "planner_failed",
  exitCodePlannerFailure: scenarioJPlannerFailure.exitCode === "planner_failure",
  okFalse: scenarioJPlannerFailure.ok === false,
  noExecution: scenarioJPlannerFailure.safety.executionEnabled === false,
} as const;

export const scenarioKHumanRenderModel =
  createCliTaskPlanHumanRenderModel(
    scenarioASuccessfulCliTaskPlanIntegrationLogic,
  ) satisfies CliTaskPlanHumanRenderModel;

export const scenarioKHumanRenderModelFields = {
  title: scenarioKHumanRenderModel.title,
  taskId: scenarioKHumanRenderModel.taskId,
  sourceFile: scenarioKHumanRenderModel.sourceFile,
  mode: scenarioKHumanRenderModel.mode,
  parsed: scenarioKHumanRenderModel.parsed,
  mapping: scenarioKHumanRenderModel.mapping,
  planning: scenarioKHumanRenderModel.planning,
  workItems: scenarioKHumanRenderModel.workItems,
  batches: scenarioKHumanRenderModel.batches,
  steps: scenarioKHumanRenderModel.steps,
  policyRequired: scenarioKHumanRenderModel.policyRequired,
  approvalRequired: scenarioKHumanRenderModel.approvalRequired,
  verifierRequired: scenarioKHumanRenderModel.verifierRequired,
  completionGatedByVerifier:
    scenarioKHumanRenderModel.completionGatedByVerifier,
  auditExpected: scenarioKHumanRenderModel.auditExpected,
  realExecution: scenarioKHumanRenderModel.realExecution,
  adapterCalls: scenarioKHumanRenderModel.adapterCalls,
  auditWrites: scenarioKHumanRenderModel.auditWrites,
  verifierRun: scenarioKHumanRenderModel.verifierRun,
  persistence: scenarioKHumanRenderModel.persistence,
  filesystemMutation: scenarioKHumanRenderModel.filesystemMutation,
  completedStateCreated: scenarioKHumanRenderModel.completedStateCreated,
  issues: scenarioKHumanRenderModel.issues,
} as const;

export const scenarioLJsonRenderModel =
  createCliTaskPlanJsonRenderModel(
    scenarioASuccessfulCliTaskPlanIntegrationLogic,
  ) satisfies CliTaskPlanJsonRenderModel;

export const scenarioLJsonRenderModelFields = {
  ok: scenarioLJsonRenderModel.ok,
  status: scenarioLJsonRenderModel.status,
  exitCode: scenarioLJsonRenderModel.exitCode,
  taskId: scenarioLJsonRenderModel.taskId,
  mode: scenarioLJsonRenderModel.mode,
  sourceFile: scenarioLJsonRenderModel.sourceFile,
  parse: scenarioLJsonRenderModel.parse,
  mapping: scenarioLJsonRenderModel.mapping,
  wiring: scenarioLJsonRenderModel.wiring,
  plan: scenarioLJsonRenderModel.plan,
  safety: scenarioLJsonRenderModel.safety,
  issues: scenarioLJsonRenderModel.issues,
  summary: scenarioLJsonRenderModel.summary,
} as const;

export const scenarioMJsonOnlyFailureBehavior =
  createCliTaskPlanPlannerIntegrationResult(
    {
      ...baseInput,
      json: true,
      parserResult: parserFailure,
    },
    {
      planner: createPlanningResult,
    },
  );

export const scenarioMJsonOnlyFailureBehaviorChecks = {
  jsonRequested: scenarioMJsonOnlyFailureBehavior.jsonOnly.jsonRequested,
  okFalse: scenarioMJsonOnlyFailureBehavior.ok === false,
  statusParserFailed:
    scenarioMJsonOnlyFailureBehavior.status === "parser_failed",
  exitCodeNonSuccess:
    scenarioMJsonOnlyFailureBehavior.exitCode !== "success",
  jsonOutputPresent: scenarioMJsonOnlyFailureBehavior.jsonOutput !== undefined,
  suppressHumanOutput:
    scenarioMJsonOnlyFailureBehavior.jsonOnly.suppressHumanOutput,
  validJsonOnly: scenarioMJsonOnlyFailureBehavior.jsonOnly.validJsonOnly,
  noProsePrefix: scenarioMJsonOnlyFailureBehavior.jsonOnly.noProsePrefix,
  noProseSuffix: scenarioMJsonOnlyFailureBehavior.jsonOnly.noProseSuffix,
  noStackTraces: scenarioMJsonOnlyFailureBehavior.jsonOnly.noStackTraces,
  noRawEngineErrors:
    scenarioMJsonOnlyFailureBehavior.jsonOnly.noRawEngineErrors,
  deterministicIssues:
    scenarioMJsonOnlyFailureBehavior.jsonOnly.deterministicIssues,
} as const;

export const scenarioNSummaryGeneration =
  summarizeCliTaskPlanPlannerIntegrationResult({
    ...scenarioASuccessfulCliTaskPlanIntegrationLogic,
  }) satisfies CliTaskPlanPlannerIntegrationSummary;

export const scenarioNSummaryGenerationMatches = {
  parsed:
    scenarioNSummaryGeneration.parsed ===
    scenarioASuccessfulCliTaskPlanIntegrationLogic.parser.ok,
  mapped:
    scenarioNSummaryGeneration.mapped ===
    scenarioASuccessfulCliTaskPlanIntegrationLogic.mapping.ok,
  wired:
    scenarioNSummaryGeneration.wired ===
    scenarioASuccessfulCliTaskPlanIntegrationLogic.wiring.ok,
  planned:
    scenarioNSummaryGeneration.planned ===
    scenarioASuccessfulCliTaskPlanIntegrationLogic.planner.ok,
  workItemCount: scenarioNSummaryGeneration.workItemCount,
  batchCount: scenarioNSummaryGeneration.batchCount,
  planStepCount: scenarioNSummaryGeneration.planStepCount,
  issueCount: scenarioNSummaryGeneration.issueCount,
  json: scenarioNSummaryGeneration.json,
  noExecution: scenarioNSummaryGeneration.noExecution,
  noWrites: scenarioNSummaryGeneration.noWrites,
  executionEnabled: scenarioNSummaryGeneration.executionEnabled,
  adapterCalls: scenarioNSummaryGeneration.adapterCalls,
  auditWrites: scenarioNSummaryGeneration.auditWrites,
  verifierRun: scenarioNSummaryGeneration.verifierRun,
  persistence: scenarioNSummaryGeneration.persistence,
  filesystemMutation: scenarioNSummaryGeneration.filesystemMutation,
  completedStateCreated: scenarioNSummaryGeneration.completedStateCreated,
  verifierRequired: scenarioNSummaryGeneration.verifierRequired,
  completionGatedByVerifier:
    scenarioNSummaryGeneration.completionGatedByVerifier,
  runnerPlanningInputAvailable:
    scenarioNSummaryGeneration.runnerPlanningInputAvailable,
  plannerDependencyInjected:
    scenarioNSummaryGeneration.plannerDependencyInjected,
  plannerInvocationAllowed: scenarioNSummaryGeneration.plannerInvocationAllowed,
} as const;

export const scenarioOExitCodeMapping = {
  planned: mapCliTaskPlanStatusToExitCode("planned"),
  parser_failed: mapCliTaskPlanStatusToExitCode("parser_failed"),
  validation_failed: mapCliTaskPlanStatusToExitCode("validation_failed"),
  unsupported_mapping: mapCliTaskPlanStatusToExitCode("unsupported_mapping"),
  mapping_failed: mapCliTaskPlanStatusToExitCode("mapping_failed"),
  wiring_failed: mapCliTaskPlanStatusToExitCode("wiring_failed"),
  planner_failed: mapCliTaskPlanStatusToExitCode("planner_failed"),
  blocked: mapCliTaskPlanStatusToExitCode("blocked"),
  failed: mapCliTaskPlanStatusToExitCode("failed"),
  unknown: mapCliTaskPlanStatusToExitCode("unknown"),
} as const satisfies Record<CliTaskPlanPlannerIntegrationStatus, CliTaskPlanExitCode>;

const deterministicRunOne = createCliTaskPlanPlannerIntegrationResult(
  baseInput,
  {
    planner: createPlanningResult,
  },
);

const deterministicRunTwo = createCliTaskPlanPlannerIntegrationResult(
  baseInput,
  {
    planner: createPlanningResult,
  },
);

export const scenarioPDeterministicOutput = {
  sameStatus: deterministicRunOne.status === deterministicRunTwo.status,
  sameExitCode: deterministicRunOne.exitCode === deterministicRunTwo.exitCode,
  sameIssueOrdering:
    deterministicRunOne.issues.map((issue) => issue.code).join("|") ===
    deterministicRunTwo.issues.map((issue) => issue.code).join("|"),
  sameSummary:
    JSON.stringify(deterministicRunOne.summary) ===
    JSON.stringify(deterministicRunTwo.summary),
  sameSafetyFlags:
    JSON.stringify(deterministicRunOne.safety) ===
    JSON.stringify(deterministicRunTwo.safety),
  samePlannerInvocationAllowed:
    deterministicRunOne.wiring.plannerInvocationAllowed ===
    deterministicRunTwo.wiring.plannerInvocationAllowed,
} as const;

const gatedPlanner = createCountingPlanner();
const parserFailurePlanner = createCountingPlanner();
const unsupportedMappingPlanner = createCountingPlanner();
const missingRunnerInputPlanner = createCountingPlanner();
const missingVerifierPlanner = createCountingPlanner();
const missingNoExecutionNoWritesPlanner = createCountingPlanner();

export const scenarioQDependencyInjectedPlannerBehavior = {
  gatesPass: evaluateCliTaskPlanPlannerIntegrationGates(baseInput, {
    planner: gatedPlanner.planner,
  }),
  plannedAfterGatesPass: createCliTaskPlanPlannerIntegrationResult(baseInput, {
    planner: gatedPlanner.planner,
  }),
  parserFailureBlocked: createCliTaskPlanPlannerIntegrationResult(
    {
      ...baseInput,
      parserResult: parserFailure,
    },
    {
      planner: parserFailurePlanner.planner,
    },
  ),
  unsupportedMappingBlocked: createCliTaskPlanPlannerIntegrationResult(
    {
      ...baseInput,
      mappingResult: unsupportedMapping,
    },
    {
      planner: unsupportedMappingPlanner.planner,
    },
  ),
  missingRunnerPlanningInputBlocked:
    createCliTaskPlanPlannerIntegrationResult(
      {
        ...baseInput,
        mappingResult: mappedWithoutRunnerPlanningInput,
      },
      {
        planner: missingRunnerInputPlanner.planner,
      },
    ),
  missingVerifierGateBlocked: createCliTaskPlanPlannerIntegrationResult(
    {
      ...baseInput,
      mappingResult: mappingWithoutVerifierGate,
    },
    {
      planner: missingVerifierPlanner.planner,
    },
  ),
  missingNoExecutionNoWritesBlocked:
    createCliTaskPlanPlannerIntegrationResult(
      {
        ...baseInput,
        mappingResult: mappingWithoutNoExecutionNoWrites,
      },
      {
        planner: missingNoExecutionNoWritesPlanner.planner,
      },
    ),
  calls: {
    gatesPassedPlanner: gatedPlanner.calls(),
    parserFailurePlanner: parserFailurePlanner.calls(),
    unsupportedMappingPlanner: unsupportedMappingPlanner.calls(),
    missingRunnerPlanningInputPlanner: missingRunnerInputPlanner.calls(),
    missingVerifierPlanner: missingVerifierPlanner.calls(),
    missingNoExecutionNoWritesPlanner:
      missingNoExecutionNoWritesPlanner.calls(),
  },
  noDirectPlanAgenticRunnerImportOrCall: true,
  noTopLevelPlannerInputBypass:
    scenarioFMissingRunnerPlanningInput.wiring.topLevelPlannerInputBypassAllowed ===
    false,
} as const;

export const cliTaskPlanJsonOnlyBehaviorExample =
  createCliTaskPlanJsonOnlyBehavior({
    jsonRequested: true,
  }) satisfies CliTaskPlanJsonOnlyBehavior;

export const cliTaskPlanPlannerIntegrationLogicExamples = {
  successful: scenarioASuccessfulCliTaskPlanIntegrationLogic,
  jsonSuccess: scenarioBJsonSuccessBehavior,
  parserFailure: scenarioCParserFailure,
  validationFailure: scenarioDValidationFailure,
  unsupportedMapping: scenarioEUnsupportedMapping,
  missingRunnerPlanningInput: scenarioFMissingRunnerPlanningInput,
  missingVerifierGate: scenarioGMissingVerifierGate,
  missingNoExecutionNoWrites: scenarioHMissingNoExecutionNoWrites,
  unsafeRepresentedMetadata: scenarioIUnsafeRepresentedMetadata,
  plannerFailure: scenarioJPlannerFailure,
  humanRenderModel: scenarioKHumanRenderModel,
  jsonRenderModel: scenarioLJsonRenderModel,
  jsonOnlyFailure: scenarioMJsonOnlyFailureBehavior,
  summary: scenarioNSummaryGeneration,
  exitCodes: scenarioOExitCodeMapping,
  deterministicOutput: scenarioPDeterministicOutput,
  dependencyInjectedPlanner: scenarioQDependencyInjectedPlannerBehavior,
} as const satisfies {
  readonly successful: CliTaskPlanPlannerIntegrationResult;
  readonly jsonSuccess: CliTaskPlanPlannerIntegrationResult;
  readonly parserFailure: CliTaskPlanPlannerIntegrationResult;
  readonly validationFailure: CliTaskPlanPlannerIntegrationResult;
  readonly unsupportedMapping: CliTaskPlanPlannerIntegrationResult;
  readonly missingRunnerPlanningInput: CliTaskPlanPlannerIntegrationResult;
  readonly missingVerifierGate: CliTaskPlanPlannerIntegrationResult;
  readonly missingNoExecutionNoWrites: CliTaskPlanPlannerIntegrationResult;
  readonly unsafeRepresentedMetadata: CliTaskPlanPlannerIntegrationResult;
  readonly plannerFailure: CliTaskPlanPlannerIntegrationResult;
  readonly humanRenderModel: CliTaskPlanHumanRenderModel;
  readonly jsonRenderModel: CliTaskPlanJsonRenderModel;
  readonly jsonOnlyFailure: CliTaskPlanPlannerIntegrationResult;
  readonly summary: CliTaskPlanPlannerIntegrationSummary;
  readonly exitCodes: Record<
    CliTaskPlanPlannerIntegrationStatus,
    CliTaskPlanExitCode
  >;
  readonly deterministicOutput: typeof scenarioPDeterministicOutput;
  readonly dependencyInjectedPlanner: typeof scenarioQDependencyInjectedPlannerBehavior;
};
