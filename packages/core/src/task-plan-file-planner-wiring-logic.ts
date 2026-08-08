import type {
  AgenticRunnerPlanningInput,
  AgenticRunnerPlanningReference,
  AgenticRunnerPlanningResult,
} from "./agentic-runner-planning.js";
import type {
  TaskPlanFileHumanOutput,
  TaskPlanFileJsonOutput,
  TaskPlanFileMappingStage,
  TaskPlanFileParseStage,
  TaskPlanFilePlannerExitCode,
  TaskPlanFilePlannerStage,
  TaskPlanFilePlannerWiringInput,
  TaskPlanFilePlannerWiringIssue,
  TaskPlanFilePlannerWiringIssuePhase,
  TaskPlanFilePlannerWiringIssueSeverity,
  TaskPlanFilePlannerWiringResult,
  TaskPlanFilePlannerWiringStatus,
  TaskPlanFilePlannerWiringSummary,
  TaskPlanFileSafetyStage,
} from "./task-plan-file-planner-wiring.js";

export type TaskPlanFilePlannerFunction = (
  input: AgenticRunnerPlanningInput,
) => AgenticRunnerPlanningResult;

export interface TaskPlanFilePlannerWiringDependencies {
  readonly planner?: TaskPlanFilePlannerFunction;
  readonly planningResultReference?: AgenticRunnerPlanningReference;
}

export interface TaskPlanFilePlannerWiringGateEvaluationInput {
  readonly input: TaskPlanFilePlannerWiringInput;
  readonly parse?: TaskPlanFileParseStage;
  readonly mapping?: TaskPlanFileMappingStage;
  readonly safety?: TaskPlanFileSafetyStage;
}

export interface TaskPlanFilePlannerWiringGateEvaluation {
  readonly parserAllowed: boolean;
  readonly validationAllowed: boolean;
  readonly mappingAllowed: boolean;
  readonly planningAllowed: boolean;
  readonly safetyAllowed: boolean;
  readonly plannerAllowed: boolean;
  readonly issues: readonly TaskPlanFilePlannerWiringIssue[];
}

interface SafetyStageInput {
  readonly input?: TaskPlanFilePlannerWiringInput;
  readonly parse?: TaskPlanFileParseStage;
  readonly mapping?: TaskPlanFileMappingStage;
  readonly planner?: TaskPlanFilePlannerStage;
  readonly plannerMayRunLater?: boolean;
  readonly issues?: readonly TaskPlanFilePlannerWiringIssue[];
}

const phaseOrder: readonly TaskPlanFilePlannerWiringIssuePhase[] = [
  "input",
  "parse",
  "validation",
  "mapping",
  "planner",
  "safety",
  "output",
  "unknown",
];

const severityOrder: readonly TaskPlanFilePlannerWiringIssueSeverity[] = [
  "critical",
  "error",
  "warning",
  "info",
];

const unsafeRuntimeTruthFields = new Set([
  "adapterCallHappened",
  "adapterCalls",
  "adapterCallsMade",
  "auditEventsEmitted",
  "auditWriteHappened",
  "auditWrites",
  "completedStateCreated",
  "executionEnabled",
  "filesystemMutation",
  "filesystemMutationHappened",
  "mapperExecuted",
  "mapperExecutedHere",
  "parserExecuted",
  "parserExecutedHere",
  "persistence",
  "persistenceWritten",
  "planAgenticRunnerExecuted",
  "plannerExecuted",
  "plannerExecutedHere",
  "runnerExecuted",
  "runnerExecutionHappened",
  "runnerExecutionStarted",
  "runnerPlanningExecuted",
  "taskPersistenceWritten",
  "verifierExecuted",
  "verifierRun",
]);

function compareString(left: string, right: string): number {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function booleanField(value: unknown, field: string): boolean | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const fieldValue = value[field];

  return typeof fieldValue === "boolean" ? fieldValue : undefined;
}

function collectUnsafeRuntimeTruthPaths(
  value: unknown,
  rootPath: string,
): readonly string[] {
  const unsafePaths: string[] = [];

  function visit(nestedValue: unknown, currentPath: string): void {
    if (Array.isArray(nestedValue)) {
      nestedValue.forEach((item, index) => visit(item, `${currentPath}[${index}]`));
      return;
    }

    if (!isRecord(nestedValue)) {
      return;
    }

    for (const [key, childValue] of Object.entries(nestedValue).sort(
      ([left], [right]) => compareString(left, right),
    )) {
      const childPath = `${currentPath}.${key}`;

      if (
        unsafeRuntimeTruthFields.has(key) &&
        childValue === true
      ) {
        unsafePaths.push(childPath);
      }

      if (
        (key === "state" || key === "initialState") &&
        childValue === "completed"
      ) {
        unsafePaths.push(childPath);
      }

      visit(childValue, childPath);
    }
  }

  visit(value, rootPath);

  return [...new Set(unsafePaths)].sort(compareString);
}

function createUnsafeRuntimeTruthIssues(input: {
  readonly value: unknown;
  readonly rootPath: string;
  readonly phase: TaskPlanFilePlannerWiringIssuePhase;
  readonly taskId?: string;
  readonly sourceFile?: string;
  readonly sourceReference?: AgenticRunnerPlanningReference;
}): readonly TaskPlanFilePlannerWiringIssue[] {
  return collectUnsafeRuntimeTruthPaths(input.value, input.rootPath).map(
    (path) =>
      createIssue({
        code: "task_plan_file_unsafe_runtime_truth_claim",
        message:
          "Represented task plan file planner wiring data claims an unsafe runtime side effect or completed state.",
        severity: "critical",
        phase: input.phase,
        taskId: input.taskId,
        sourceFile: input.sourceFile,
        field: path,
        sourceReference: input.sourceReference,
      }),
  );
}

function hasUnsafeRuntimeTruth(value: unknown): boolean {
  return collectUnsafeRuntimeTruthPaths(value, "value").length > 0;
}

function issueKey(issue: TaskPlanFilePlannerWiringIssue): string {
  return [
    issue.phase,
    issue.severity,
    issue.code,
    issue.message,
    issue.taskId ?? "",
    issue.sourceFile ?? "",
    issue.field ?? "",
  ].join("\u0000");
}

function sortIssues(
  issues: readonly TaskPlanFilePlannerWiringIssue[],
): readonly TaskPlanFilePlannerWiringIssue[] {
  const unique = new Map<string, TaskPlanFilePlannerWiringIssue>();

  for (const issue of issues) {
    unique.set(issueKey(issue), issue);
  }

  return [...unique.values()].sort((left, right) => {
    const phase =
      phaseOrder.indexOf(left.phase) - phaseOrder.indexOf(right.phase);

    if (phase !== 0) {
      return phase;
    }

    const severity =
      severityOrder.indexOf(left.severity) -
      severityOrder.indexOf(right.severity);

    if (severity !== 0) {
      return severity;
    }

    const code = compareString(left.code, right.code);

    if (code !== 0) {
      return code;
    }

    const message = compareString(left.message, right.message);

    if (message !== 0) {
      return message;
    }

    return compareString(left.field ?? "", right.field ?? "");
  });
}

function createIssue(input: {
  readonly code: string;
  readonly message: string;
  readonly severity?: TaskPlanFilePlannerWiringIssueSeverity;
  readonly phase: TaskPlanFilePlannerWiringIssuePhase;
  readonly taskId?: string;
  readonly sourceFile?: string;
  readonly field?: string;
  readonly sourceReference?: AgenticRunnerPlanningReference;
  readonly metadata?: Record<string, unknown>;
}): TaskPlanFilePlannerWiringIssue {
  return {
    code: input.code,
    message: input.message,
    severity: input.severity ?? "error",
    phase: input.phase,
    taskId: input.taskId,
    sourceFile: input.sourceFile,
    field: input.field,
    sourceReference: input.sourceReference,
    metadata: input.metadata,
  };
}

function resolveSourceFile(input: TaskPlanFilePlannerWiringInput): string {
  return (
    input.parserResult?.sourceFile ??
    input.mappingResult?.sourceFile ??
    input.parserRequest?.inputPath ??
    input.taskFile
  );
}

function resolveTaskId(
  input: TaskPlanFilePlannerWiringInput,
): string | undefined {
  return (
    input.mappingResult?.taskId ??
    input.parserResult?.validation.taskId ??
    input.parserResult?.parse.valueReference?.taskId ??
    input.plannerInput?.taskId
  );
}

function mapParserIssue(
  issue: NonNullable<TaskPlanFilePlannerWiringInput["parserResult"]>["issues"][number],
  input: TaskPlanFilePlannerWiringInput,
): TaskPlanFilePlannerWiringIssue {
  const phase =
    issue.phase === "format" || issue.phase === "path"
      ? "parse"
      : issue.phase === "request"
        ? "input"
      : issue.phase;

  return {
    code: issue.code,
    message: issue.message,
    severity: issue.severity,
    phase,
    taskId: resolveTaskId(input),
    sourceFile: issue.path ?? resolveSourceFile(input),
    field: issue.field,
    sourceIssue: issue,
    metadata: issue.metadata,
  };
}

function mapMappingIssue(
  issue: NonNullable<TaskPlanFilePlannerWiringInput["mappingResult"]>["issues"][number],
  input: TaskPlanFilePlannerWiringInput,
): TaskPlanFilePlannerWiringIssue {
  return {
    code: issue.code,
    message: issue.message,
    severity: issue.severity,
    phase: mapMappingIssueCategoryToPhase(issue.category),
    taskId: issue.taskId ?? resolveTaskId(input),
    sourceFile: issue.sourceFile ?? resolveSourceFile(input),
    field: issue.field,
    sourceReference: issue.sourceReference,
    metadata: {
      category: issue.category,
      workItemId: issue.workItemId,
      batchId: issue.batchId,
      policyGateId: issue.policyGateId,
      adapterReferenceId: issue.adapterReferenceId,
      retryable: issue.retryable,
    },
  };
}

function mapPlannerIssue(
  issue: AgenticRunnerPlanningResult["issues"][number],
  input: TaskPlanFilePlannerWiringInput,
): TaskPlanFilePlannerWiringIssue {
  return {
    code: issue.code,
    message: issue.message,
    severity: issue.severity,
    phase: "planner",
    taskId: resolveTaskId(input),
    sourceFile: resolveSourceFile(input),
    field:
      issue.stepId !== undefined
        ? "plan.steps"
        : issue.batchId !== undefined
          ? "plan.batches"
          : issue.workItemId !== undefined
            ? "plan.workItems"
            : undefined,
    metadata: {
      category: issue.category,
      prerequisiteId: issue.prerequisiteId,
      workItemId: issue.workItemId,
      batchId: issue.batchId,
      stepId: issue.stepId,
      policyGateId: issue.policyGateId,
      adapterReferenceId: issue.adapterReferenceId,
      retryable: issue.retryable,
    },
  };
}

function mapMappingIssueCategoryToPhase(
  category: NonNullable<
    TaskPlanFilePlannerWiringInput["mappingResult"]
  >["issues"][number]["category"],
): TaskPlanFilePlannerWiringIssuePhase {
  if (category === "validation") {
    return "validation";
  }

  if (category === "safety") {
    return "safety";
  }

  if (category === "input") {
    return "input";
  }

  return "mapping";
}

function hasIssueInPhase(
  issues: readonly TaskPlanFilePlannerWiringIssue[],
  phase: TaskPlanFilePlannerWiringIssuePhase,
): boolean {
  return issues.some((issue) => issue.phase === phase);
}

function hasIssueForField(
  issues: readonly TaskPlanFilePlannerWiringIssue[],
  field: string,
): boolean {
  return issues.some((issue) => issue.field === field);
}

function createParseStage(
  input: TaskPlanFilePlannerWiringInput,
): TaskPlanFileParseStage {
  const parserResult = input.parserResult;
  const sourceFile = resolveSourceFile(input);
  const taskId = resolveTaskId(input);
  const attempted = parserResult !== undefined;
  const pathOk = parserResult?.summary.pathOk === true;
  const parseOk = parserResult?.summary.parseOk === true;
  const validationStatus = parserResult?.validation.status;
  const validationCompatible =
    parserResult?.validation.status === "pass" &&
    parserResult.validation.task !== undefined &&
    parserResult.validation.result?.valid !== false;
  const sourceIssues =
    parserResult === undefined
      ? []
      : parserResult.issues.map((issue) => mapParserIssue(issue, input));
  const unsafeParserIssues =
    parserResult === undefined
      ? []
      : createUnsafeRuntimeTruthIssues({
          value: parserResult,
          rootPath: "parserResult",
          phase: "safety",
          taskId,
          sourceFile,
        });
  const syntheticIssues: TaskPlanFilePlannerWiringIssue[] = [];

  if (!attempted) {
    syntheticIssues.push(
      createIssue({
        code: "task_plan_file_parser_result_missing",
        message:
          "Task plan file planner wiring requires an in-memory parser result.",
        phase: "parse",
        taskId,
        sourceFile,
        field: "parserResult",
      }),
    );
  }

  if (attempted && !pathOk && !hasIssueInPhase(sourceIssues, "parse")) {
    syntheticIssues.push(
      createIssue({
        code: "task_plan_file_path_not_ok",
        message: "Task plan file parser path checks did not pass.",
        phase: "parse",
        taskId,
        sourceFile,
        field: "parse.pathOk",
      }),
    );
  }

  if (attempted && !parseOk && !hasIssueInPhase(sourceIssues, "parse")) {
    syntheticIssues.push(
      createIssue({
        code: "task_plan_file_parse_not_ok",
        message: "Task plan file parsing did not pass.",
        phase: "parse",
        taskId,
        sourceFile,
        field: "parse.parseOk",
      }),
    );
  }

  if (
    attempted &&
    pathOk &&
    parseOk &&
    !validationCompatible &&
    !hasIssueInPhase(sourceIssues, "validation")
  ) {
    syntheticIssues.push(
      createIssue({
        code: "task_plan_file_validation_not_compatible",
        message:
          "Task plan file validation handoff did not provide a validated task contract.",
        phase: "validation",
        taskId,
        sourceFile,
        field: "validation.status",
      }),
    );
  }

  const issues = sortIssues([
    ...sourceIssues,
    ...unsafeParserIssues,
    ...syntheticIssues,
  ]);
  const safeParserResult =
    unsafeParserIssues.length === 0 ? parserResult : undefined;

  return {
    attempted,
    ok: attempted && pathOk && parseOk && validationCompatible,
    sourceFile,
    pathOk,
    parseOk,
    validationStatus,
    validationCompatible,
    parserResult: safeParserResult,
    parsedTaskReference:
      safeParserResult?.parse.valueReference === undefined
        ? undefined
        : {
            id: `parsed-task:${safeParserResult.parse.valueReference.taskId ?? "unknown"}`,
            path: safeParserResult.parse.valueReference.sourceFile,
            metadata: {
              kind: safeParserResult.parse.valueReference.kind,
              format: safeParserResult.parse.valueReference.format,
            },
          },
    parsedTaskData: safeParserResult?.validation.task,
    failClosedWithoutParserOk: !attempted || !pathOk || !parseOk,
    failClosedWithoutValidationOk: !validationCompatible,
    issues,
  };
}

function createMappingStage(
  input: TaskPlanFilePlannerWiringInput,
): TaskPlanFileMappingStage {
  const mappingResult = input.mappingResult;
  const sourceFile = resolveSourceFile(input);
  const taskId = resolveTaskId(input);
  const attempted = mappingResult !== undefined;
  const status = mappingResult?.status ?? "not_attempted";
  const rawPlanningInput =
    mappingResult?.planningInput.runnerPlanningInput ?? input.plannerInput;
  const planningInputReference =
    mappingResult?.planningInput.runnerPlanningInputReference;
  const unsafeMappingIssues =
    mappingResult === undefined
      ? []
      : createUnsafeRuntimeTruthIssues({
          value: mappingResult,
          rootPath: "mappingResult",
          phase: "safety",
          taskId,
          sourceFile,
          sourceReference: planningInputReference,
        });
  const unsafePlannerInputIssues =
    rawPlanningInput === undefined
      ? []
      : createUnsafeRuntimeTruthIssues({
          value: rawPlanningInput,
          rootPath: "plannerInput",
          phase: "safety",
          taskId,
          sourceFile,
          sourceReference: planningInputReference,
        });
  const unsafeIssues = [
    ...unsafeMappingIssues,
    ...unsafePlannerInputIssues,
  ];
  const planningInput =
    unsafeIssues.length === 0 ? rawPlanningInput : undefined;
  const planningInputAvailable = planningInput !== undefined;
  const noExecution = mappingResultNoExecution(input);
  const noWrites = mappingResultNoWrites(input);
  const verifierRequired =
    mappingResult?.verifier?.verifierRequired === true ||
    mappingResult?.summary.verifierRequired === true ||
    rawPlanningInput?.verifierRequirements?.verifierRequired === true;
  const completionGatedByVerifier =
    mappingResult?.verifier?.completionGatedByVerifier === true ||
    mappingResult?.summary.completionGatedByVerifier === true ||
    rawPlanningInput?.verifierRequirements?.completionGatedByVerifier === true;
  const sourceIssues =
    mappingResult === undefined
      ? []
      : mappingResult.issues.map((issue) => mapMappingIssue(issue, input));
  const syntheticIssues: TaskPlanFilePlannerWiringIssue[] = [];
  const failClosedWithoutMappedStatus = status !== "mapped";
  const failClosedWithoutPlanningInput = !planningInputAvailable;
  const failClosedWithoutNoExecution = !noExecution;
  const failClosedWithoutNoWrites = !noWrites;
  const failClosedWithoutVerifierRequired = !verifierRequired;
  const failClosedWithoutCompletionGate = !completionGatedByVerifier;

  if (!attempted) {
    syntheticIssues.push(
      createIssue({
        code: "task_contract_mapping_result_missing",
        message:
          "Task plan file planner wiring requires an in-memory mapping result.",
        phase: "mapping",
        taskId,
        sourceFile,
        field: "mappingResult",
      }),
    );
  }

  if (
    attempted &&
    status === "unsupported" &&
    !hasIssueInPhase(sourceIssues, "mapping")
  ) {
    syntheticIssues.push(
      createIssue({
        code: "task_contract_mapping_unsupported",
        message:
          "The parsed task contract cannot be mapped into runner planning input.",
        phase: "mapping",
        taskId,
        sourceFile,
      }),
    );
  }

  if (
    attempted &&
    status !== "mapped" &&
    status !== "unsupported" &&
    !hasIssueInPhase(sourceIssues, "mapping")
  ) {
    syntheticIssues.push(
      createIssue({
        code: "task_contract_mapping_not_mapped",
        message:
          "Task contract mapping did not produce a mapped planning handoff.",
        phase: "mapping",
        taskId,
        sourceFile,
        field: "mapping.status",
      }),
    );
  }

  if (
    attempted &&
    failClosedWithoutPlanningInput &&
    !hasIssueForField(sourceIssues, "mapping.planningInput")
  ) {
    syntheticIssues.push(
      createIssue({
        code: "task_contract_mapping_planning_input_missing",
        message:
          "Task contract mapping did not provide runner planning input.",
        phase: "mapping",
        taskId,
        sourceFile,
        field: "mapping.planningInput",
      }),
    );
  }

  if (attempted && failClosedWithoutNoExecution) {
    syntheticIssues.push(
      createIssue({
        code: "task_contract_mapping_no_execution_not_proven",
        message:
          "Task contract mapping did not prove no-execution safety.",
        severity: "critical",
        phase: "safety",
        taskId,
        sourceFile,
        field: "mapping.noExecution",
      }),
    );
  }

  if (attempted && failClosedWithoutNoWrites) {
    syntheticIssues.push(
      createIssue({
        code: "task_contract_mapping_no_writes_not_proven",
        message: "Task contract mapping did not prove no-write safety.",
        severity: "critical",
        phase: "safety",
        taskId,
        sourceFile,
        field: "mapping.noWrites",
      }),
    );
  }

  if (attempted && failClosedWithoutVerifierRequired) {
    syntheticIssues.push(
      createIssue({
        code: "task_contract_mapping_verifier_not_required",
        message:
          "Task contract mapping did not require verifier-gated planning.",
        severity: "critical",
        phase: "safety",
        taskId,
        sourceFile,
        field: "mapping.verifierRequired",
      }),
    );
  }

  if (attempted && failClosedWithoutCompletionGate) {
    syntheticIssues.push(
      createIssue({
        code: "task_contract_mapping_completion_not_verifier_gated",
        message:
          "Task contract mapping did not gate completion by verifier handoff.",
        severity: "critical",
        phase: "safety",
        taskId,
        sourceFile,
        field: "mapping.completionGatedByVerifier",
      }),
    );
  }

  const issues = sortIssues([
    ...sourceIssues,
    ...unsafeIssues,
    ...syntheticIssues,
  ]);
  const safeMappingResult =
    unsafeIssues.length === 0 ? mappingResult : undefined;

  return {
    attempted,
    ok:
      attempted &&
      mappingResult?.ok === true &&
      status === "mapped" &&
      planningInputAvailable &&
      noExecution &&
      noWrites &&
      verifierRequired &&
      completionGatedByVerifier &&
      unsafeIssues.length === 0,
    status,
    mappingResult: safeMappingResult,
    planningInput,
    planningInputReference,
    planningInputAvailable,
    noExecution: true,
    noWrites: true,
    verifierRequired,
    completionGatedByVerifier,
    failClosedWithoutMappedStatus,
    failClosedWithoutPlanningInput,
    failClosedWithoutNoExecution,
    failClosedWithoutNoWrites,
    failClosedWithoutVerifierRequired,
    failClosedWithoutCompletionGate,
    issues,
  };
}

function mappingResultNoExecution(
  input: TaskPlanFilePlannerWiringInput,
): boolean {
  const mappingResult = input.mappingResult;
  const planningInput = mappingResult?.planningInput.runnerPlanningInput;

  return (
    booleanField(input, "noExecution") === true &&
    mappingResult !== undefined &&
    !hasUnsafeRuntimeTruth(mappingResult) &&
    booleanField(mappingResult.summary, "noExecution") === true &&
    booleanField(mappingResult.planningInput, "runnerPlanningExecuted") === false &&
    planningInput?.metadata?.runnerExecutionStarted !== true &&
    planningInput?.metadata?.adapterCallsMade !== true &&
    planningInput?.metadata?.executionEnabled !== true &&
    planningInput?.metadata?.adapterCalls !== true &&
    planningInput?.metadata?.verifierRun !== true &&
    planningInput?.metadata?.verifierExecuted !== true
  );
}

function mappingResultNoWrites(input: TaskPlanFilePlannerWiringInput): boolean {
  const mappingResult = input.mappingResult;
  const planningInput = mappingResult?.planningInput.runnerPlanningInput;

  return (
    booleanField(input, "noWrites") === true &&
    mappingResult !== undefined &&
    !hasUnsafeRuntimeTruth(mappingResult) &&
    booleanField(mappingResult.summary, "noWrites") === true &&
    booleanField(mappingResult.planningInput, "taskPersistenceWritten") === false &&
    planningInput?.metadata?.auditEventsEmitted !== true &&
    planningInput?.metadata?.taskPersistenceWritten !== true &&
    planningInput?.metadata?.auditWrites !== true &&
    planningInput?.metadata?.persistence !== true &&
    planningInput?.metadata?.filesystemMutation !== true &&
    planningInput?.metadata?.completedStateCreated !== true
  );
}

export function evaluateTaskPlanFilePlannerWiringGates(
  gateInput:
    | TaskPlanFilePlannerWiringInput
    | TaskPlanFilePlannerWiringGateEvaluationInput,
): TaskPlanFilePlannerWiringGateEvaluation {
  const input = "input" in gateInput ? gateInput.input : gateInput;
  const parse =
    "input" in gateInput && gateInput.parse !== undefined
      ? gateInput.parse
      : createParseStage(input);
  const mapping =
    "input" in gateInput && gateInput.mapping !== undefined
      ? gateInput.mapping
      : createMappingStage(input);
  const safety =
    "input" in gateInput && gateInput.safety !== undefined
      ? gateInput.safety
      : createTaskPlanFileSafetyStage({
          input,
          parse,
          mapping,
          plannerMayRunLater: false,
        });
  const parserAllowed =
    parse.attempted &&
    parse.ok &&
    parse.pathOk &&
    parse.parseOk &&
    !parse.failClosedWithoutParserOk;
  const validationAllowed =
    parserAllowed &&
    parse.validationCompatible &&
    !parse.failClosedWithoutValidationOk;
  const mappingAllowed =
    validationAllowed &&
    mapping.attempted &&
    mapping.ok &&
    mapping.status === "mapped" &&
    !mapping.failClosedWithoutMappedStatus;
  const planningAllowed =
    mappingAllowed &&
    mapping.planningInputAvailable &&
    !mapping.failClosedWithoutPlanningInput;
  const safetyAllowed =
    safety.issues.length === 0 &&
    planningAllowed &&
    mapping.noExecution === true &&
    mapping.noWrites === true &&
    mapping.verifierRequired &&
    mapping.completionGatedByVerifier &&
    !mapping.failClosedWithoutNoExecution &&
    !mapping.failClosedWithoutNoWrites &&
    !mapping.failClosedWithoutVerifierRequired &&
    !mapping.failClosedWithoutCompletionGate;
  const issues = sortIssues([
    ...parse.issues,
    ...mapping.issues,
    ...safety.issues,
  ]);

  return {
    parserAllowed,
    validationAllowed,
    mappingAllowed,
    planningAllowed,
    safetyAllowed,
    plannerAllowed: safetyAllowed,
    issues,
  };
}

function createPlannerStage(
  input: TaskPlanFilePlannerWiringInput,
  mapping: TaskPlanFileMappingStage,
  gates: TaskPlanFilePlannerWiringGateEvaluation,
  dependencies: TaskPlanFilePlannerWiringDependencies,
): TaskPlanFilePlannerStage {
  const planningInput = mapping.planningInput;
  const planningInputReference = mapping.planningInputReference;
  const sourceFile = resolveSourceFile(input);
  const taskId = resolveTaskId(input);

  if (!gates.plannerAllowed || planningInput === undefined) {
    return {
      attempted: false,
      ok: false,
      status: "not_attempted",
      planningInput,
      planningInputReference,
      plannerExecuted: false,
      issues: [],
    };
  }

  if (dependencies.planner === undefined) {
    return {
      attempted: false,
      ok: false,
      status: "not_attempted",
      planningInput,
      planningInputReference,
      plannerExecuted: false,
      issues: [
        createIssue({
          code: "task_plan_file_planner_dependency_missing",
          message:
            "Planner handoff is gated but no in-memory planner function was supplied.",
          phase: "planner",
          taskId,
          sourceFile,
          field: "planner",
          sourceReference: planningInputReference,
        }),
      ],
    };
  }

  let planningResult: AgenticRunnerPlanningResult;

  try {
    planningResult = dependencies.planner(planningInput);
  } catch (error) {
    return {
      attempted: true,
      ok: false,
      status: "failed",
      planningInput,
      planningInputReference,
      plannerExecuted: false,
      issues: [
        createIssue({
          code: "task_plan_file_planner_threw",
          message:
            "The supplied in-memory planner function failed before producing a plan.",
          phase: "planner",
          taskId,
          sourceFile,
          field: "planner",
          sourceReference: planningInputReference,
          metadata: {
            errorName: error instanceof Error ? error.name : undefined,
          },
        }),
      ],
    };
  }

  const plannerIssues = planningResult.issues.map((issue) =>
    mapPlannerIssue(issue, input),
  );
  const unsafePlannerIssues = createUnsafeRuntimeTruthIssues({
    value: planningResult,
    rootPath: "planningResult",
    phase: "safety",
    taskId,
    sourceFile,
    sourceReference: planningInputReference,
  });
  const syntheticIssues =
    planningResult.ok || plannerIssues.length > 0
      ? []
      : [
          createIssue({
            code: "task_plan_file_planner_not_ok",
            message:
              "The supplied in-memory planner result was not ok.",
            phase: "planner",
            taskId,
            sourceFile,
            sourceReference: planningInputReference,
          }),
        ];
  const issues = sortIssues([
    ...plannerIssues,
    ...unsafePlannerIssues,
    ...syntheticIssues,
  ]);
  const plannerSafe = unsafePlannerIssues.length === 0;

  return {
    attempted: true,
    ok: planningResult.ok && plannerSafe,
    status: planningResult.ok && plannerSafe ? "planned" : "failed",
    planningInput,
    planningInputReference,
    planningResult: plannerSafe ? planningResult : undefined,
    planningResultReference: plannerSafe
      ? dependencies.planningResultReference
      : undefined,
    planStepCount: plannerSafe ? planningResult.steps.length : 0,
    plannerExecuted: false,
    issues,
  };
}

export function createTaskPlanFileSafetyStage(
  safetyInput: SafetyStageInput = {},
): TaskPlanFileSafetyStage {
  const input = safetyInput.input;
  const parse = safetyInput.parse;
  const mapping = safetyInput.mapping;
  const planner = safetyInput.planner;
  const sourceFile = input === undefined ? undefined : resolveSourceFile(input);
  const taskId = input === undefined ? undefined : resolveTaskId(input);
  const issues: TaskPlanFilePlannerWiringIssue[] = [
    ...(safetyInput.issues ?? []),
  ];

  if (input !== undefined && booleanField(input, "noExecution") !== true) {
    issues.push(
      createIssue({
        code: "task_plan_file_execution_not_disabled",
        message:
          "Task plan file planner wiring requires noExecution to be true.",
        severity: "critical",
        phase: "safety",
        taskId,
        sourceFile,
        field: "noExecution",
      }),
    );
  }

  if (input !== undefined && booleanField(input, "noWrites") !== true) {
    issues.push(
      createIssue({
        code: "task_plan_file_writes_not_disabled",
        message: "Task plan file planner wiring requires noWrites to be true.",
        severity: "critical",
        phase: "safety",
        taskId,
        sourceFile,
        field: "noWrites",
      }),
    );
  }

  if (
    input?.parserResult !== undefined &&
    booleanField(input.parserResult.summary, "runnerPlanningExecuted") !== false
  ) {
    issues.push(
      createIssue({
        code: "task_plan_file_parser_claims_runner_planning_executed",
        message:
          "Parser handoff is unsafe because it claims runner planning executed.",
        severity: "critical",
        phase: "safety",
        taskId,
        sourceFile,
        field: "parser.summary.runnerPlanningExecuted",
      }),
    );
  }

  if (input?.parserResult !== undefined) {
    issues.push(
      ...createUnsafeRuntimeTruthIssues({
        value: input.parserResult,
        rootPath: "parserResult",
        phase: "safety",
        taskId,
        sourceFile,
      }),
    );
  }

  if (
    input?.parserResult !== undefined &&
    booleanField(input.parserResult.summary, "taskPersistenceWritten") !== false
  ) {
    issues.push(
      createIssue({
        code: "task_plan_file_parser_claims_persistence_written",
        message:
          "Parser handoff is unsafe because it claims task persistence was written.",
        severity: "critical",
        phase: "safety",
        taskId,
        sourceFile,
        field: "parser.summary.taskPersistenceWritten",
      }),
    );
  }

  if (
    input?.parserResult !== undefined &&
    booleanField(input.parserResult.summary, "trustsModelSelfReporting") !==
      false
  ) {
    issues.push(
      createIssue({
        code: "task_plan_file_parser_trusts_model_self_reporting",
        message:
          "Parser handoff is unsafe because model self-reporting is trusted.",
        severity: "critical",
        phase: "safety",
        taskId,
        sourceFile,
        field: "parser.summary.trustsModelSelfReporting",
      }),
    );
  }

  if (
    input?.mappingResult !== undefined &&
    booleanField(input.mappingResult.planningInput, "runnerPlanningExecuted") !==
      false
  ) {
    issues.push(
      createIssue({
        code: "task_contract_mapping_claims_runner_planning_executed",
        message:
          "Mapping handoff is unsafe because it claims runner planning executed.",
        severity: "critical",
        phase: "safety",
        taskId,
        sourceFile,
        field: "mapping.planningInput.runnerPlanningExecuted",
      }),
    );
  }

  if (
    input?.mappingResult !== undefined &&
    booleanField(input.mappingResult.planningInput, "taskPersistenceWritten") !==
      false
  ) {
    issues.push(
      createIssue({
        code: "task_contract_mapping_claims_persistence_written",
        message:
          "Mapping handoff is unsafe because it claims task persistence was written.",
        severity: "critical",
        phase: "safety",
        taskId,
        sourceFile,
        field: "mapping.planningInput.taskPersistenceWritten",
      }),
    );
  }

  if (input?.mappingResult !== undefined) {
    issues.push(
      ...createUnsafeRuntimeTruthIssues({
        value: input.mappingResult,
        rootPath: "mappingResult",
        phase: "safety",
        taskId,
        sourceFile,
        sourceReference:
          input.mappingResult.planningInput.runnerPlanningInputReference,
      }),
    );
  }

  if (mapping?.failClosedWithoutNoExecution === true) {
    issues.push(...mapping.issues.filter((issue) => issue.phase === "safety"));
  }

  if (mapping?.failClosedWithoutNoWrites === true) {
    issues.push(...mapping.issues.filter((issue) => issue.phase === "safety"));
  }

  if (planner?.planningResult !== undefined) {
    issues.push(
      ...createUnsafeRuntimeTruthIssues({
        value: planner.planningResult,
        rootPath: "planningResult",
        phase: "safety",
        taskId,
        sourceFile,
        sourceReference: planner.planningResultReference,
      }),
    );
  }

  const safeIssues = sortIssues(issues);

  return {
    executionEnabled: false,
    adapterCalls: false,
    auditWrites: false,
    verifierRun: false,
    persistence: false,
    filesystemMutation: false,
    completedStateCreated: false,
    plannerMayRunLater:
      safetyInput.plannerMayRunLater === true && safeIssues.length === 0,
    parserExecutedHere: false,
    mapperExecutedHere: false,
    plannerExecutedHere: false,
    noExecution: true,
    noWrites: true,
    issues: safeIssues,
  };
}

function determineStatus(input: {
  readonly parse: TaskPlanFileParseStage;
  readonly mapping: TaskPlanFileMappingStage;
  readonly planner: TaskPlanFilePlannerStage;
  readonly safety: TaskPlanFileSafetyStage;
}): TaskPlanFilePlannerWiringStatus {
  if (
    !input.parse.attempted ||
    input.parse.failClosedWithoutParserOk ||
    !input.parse.pathOk ||
    !input.parse.parseOk
  ) {
    return "parser_failed";
  }

  if (
    input.parse.failClosedWithoutValidationOk ||
    !input.parse.validationCompatible
  ) {
    return "validation_failed";
  }

  if (input.mapping.status === "unsupported") {
    return "unsupported_mapping";
  }

  if (
    input.safety.issues.length > 0 ||
    input.mapping.failClosedWithoutNoExecution ||
    input.mapping.failClosedWithoutNoWrites ||
    input.mapping.failClosedWithoutVerifierRequired ||
    input.mapping.failClosedWithoutCompletionGate
  ) {
    return "blocked";
  }

  if (
    !input.mapping.attempted ||
    input.mapping.status === "failed" ||
    input.mapping.status === "invalid" ||
    input.mapping.status === "unknown" ||
    input.mapping.failClosedWithoutMappedStatus ||
    input.mapping.failClosedWithoutPlanningInput
  ) {
    return "mapping_failed";
  }

  if (input.planner.attempted && !input.planner.ok) {
    return "planner_failed";
  }

  if (input.planner.ok && input.planner.status === "planned") {
    return "planned";
  }

  if (!input.planner.attempted && input.planner.issues.length > 0) {
    return "blocked";
  }

  return "unknown";
}

export function mapTaskPlanFileWiringStatusToExitCode(
  status: TaskPlanFilePlannerWiringStatus,
): TaskPlanFilePlannerExitCode {
  if (status === "planned") {
    return "success";
  }

  if (status === "parser_failed") {
    return "parser_failure";
  }

  if (status === "validation_failed") {
    return "validation_failure";
  }

  if (status === "unsupported_mapping") {
    return "unsupported_mapping";
  }

  if (status === "mapping_failed") {
    return "mapping_failure";
  }

  if (status === "planner_failed") {
    return "planner_failure";
  }

  if (status === "blocked") {
    return "blocked";
  }

  return "unknown_failure";
}

export function summarizeTaskPlanFilePlannerWiringResult(
  result: Omit<TaskPlanFilePlannerWiringResult, "summary">,
): TaskPlanFilePlannerWiringSummary {
  return summarizeTaskPlanFilePlannerWiringResultParts(
    result,
    result.jsonOutput !== undefined,
  );
}

function summarizeTaskPlanFilePlannerWiringResultParts(
  result: Omit<TaskPlanFilePlannerWiringResult, "summary">,
  json: boolean,
): TaskPlanFilePlannerWiringSummary {
  const mappingResult = result.mapping.mappingResult;
  const planningResult = result.planner.planningResult;

  return {
    parsed: result.parse.ok,
    mapped: result.mapping.ok,
    planned: result.planner.ok && result.planner.status === "planned",
    workItemCount:
      planningResult?.summary.workItemCount ??
      mappingResult?.summary.workItemCount ??
      0,
    batchCount:
      planningResult?.summary.batchCount ??
      mappingResult?.summary.batchCount ??
      0,
    planStepCount:
      result.planner.planStepCount ?? planningResult?.summary.stepCount ?? 0,
    issueCount: result.issues.length,
    json,
    noExecution: true,
    noWrites: true,
    executionEnabled: false,
    adapterCalls: false,
    auditWrites: false,
    verifierRun: false,
    persistence: false,
    filesystemMutation: false,
    completedStateCreated: false,
    verifierRequired:
      result.mapping.verifierRequired ||
      planningResult?.verifier.verifierRequired === true,
    completionGatedByVerifier:
      result.mapping.completionGatedByVerifier ||
      planningResult?.verifier.completionGatedByVerifier === true,
    mappingSupported: result.mapping.status === "mapped",
    planningInputAvailable: result.mapping.planningInputAvailable,
  };
}

export function createTaskPlanFileHumanOutput(
  result: TaskPlanFilePlannerWiringResult,
): TaskPlanFileHumanOutput {
  return {
    title: "Task Plan",
    taskId: result.taskId,
    sourceFile: result.sourceFile,
    mode: result.mode,
    parsed: result.parse.ok,
    mapping: result.mapping.status,
    planning: result.planner.status,
    workItems: result.summary.workItemCount,
    batches: result.summary.batchCount,
    steps: result.summary.planStepCount,
    policy: determineHumanPolicy(result),
    approvalRequired: determineApprovalRequired(result),
    verifierRequired: result.summary.verifierRequired,
    completionGatedByVerifier: result.summary.completionGatedByVerifier,
    auditExpected: determineAuditExpected(result),
    realExecution: false,
    adapterCalls: false,
    auditWrites: false,
    verifierRun: false,
    persistence: false,
    issues: result.issues,
  };
}

export function createTaskPlanFileJsonOutput(
  result: TaskPlanFilePlannerWiringResult,
): TaskPlanFileJsonOutput {
  return {
    ok: result.ok,
    status: result.status,
    exitCode: result.exitCode,
    taskId: result.taskId,
    mode: result.mode,
    sourceFile: result.sourceFile,
    parse: result.parse,
    mapping: result.mapping,
    plan: result.planner,
    policy: result.planner.planningResult?.policy,
    verifier: result.planner.planningResult?.verifier,
    audit: result.planner.planningResult?.audit,
    resume: result.planner.planningResult?.resume,
    executionEnabled: false,
    adapterCalls: false,
    auditWrites: false,
    verifierRun: false,
    persistence: false,
    issues: result.issues,
    summary: result.summary,
  };
}

function determineHumanPolicy(
  result: TaskPlanFilePlannerWiringResult,
): TaskPlanFileHumanOutput["policy"] {
  const plannerPolicies = result.planner.planningResult?.policy ?? [];

  if (
    plannerPolicies.some(
      (policy) => policy.status === "blocked" || policy.status === "denied",
    )
  ) {
    return "blocked";
  }

  if (plannerPolicies.some((policy) => policy.status === "requires_approval")) {
    return "requires_approval";
  }

  if (plannerPolicies.some((policy) => policy.status === "allowed")) {
    return "allowed";
  }

  if (plannerPolicies.some((policy) => policy.status === "not_evaluated")) {
    return "not_evaluated";
  }

  const mappingPolicy = result.mapping.mappingResult?.policy?.status;

  if (mappingPolicy === "blocked" || mappingPolicy === "denied") {
    return "blocked";
  }

  if (mappingPolicy === "requires_approval") {
    return "requires_approval";
  }

  if (mappingPolicy === "allowed" || mappingPolicy === "not_evaluated") {
    return mappingPolicy;
  }

  return "unknown";
}

function determineApprovalRequired(
  result: TaskPlanFilePlannerWiringResult,
): boolean {
  return (
    result.planner.planningResult?.summary.approvalRequired === true ||
    result.mapping.mappingResult?.summary.approvalRequired === true
  );
}

function determineAuditExpected(result: TaskPlanFilePlannerWiringResult): boolean {
  const plannerAudit = result.planner.planningResult?.audit;
  const mappingAudit = result.mapping.mappingResult?.audit;

  return (
    plannerAudit?.auditRequired === true ||
    (plannerAudit?.expectedAuditEventIds.length ?? 0) > 0 ||
    mappingAudit?.auditRequired === true ||
    (mappingAudit?.expectedAuditEventIds.length ?? 0) > 0
  );
}

export function createTaskPlanFilePlannerWiringResult(
  input: TaskPlanFilePlannerWiringInput,
  dependencies: TaskPlanFilePlannerWiringDependencies = {},
): TaskPlanFilePlannerWiringResult {
  const parse = createParseStage(input);
  const mapping = createMappingStage(input);
  const prePlannerSafety = createTaskPlanFileSafetyStage({
    input,
    parse,
    mapping,
    plannerMayRunLater: false,
  });
  const gates = evaluateTaskPlanFilePlannerWiringGates({
    input,
    parse,
    mapping,
    safety: prePlannerSafety,
  });
  const planner = createPlannerStage(input, mapping, gates, dependencies);
  const safety = createTaskPlanFileSafetyStage({
    input,
    parse,
    mapping,
    planner,
    plannerMayRunLater: gates.plannerAllowed,
  });
  const issues = sortIssues([
    ...parse.issues,
    ...mapping.issues,
    ...planner.issues,
    ...safety.issues,
  ]);
  const baseResult = {
    ok: false,
    status: "unknown",
    exitCode: "unknown_failure",
    taskId: resolveTaskId(input),
    mode: input.mode,
    sourceFile: resolveSourceFile(input),
    parse,
    mapping,
    planner,
    safety,
    issues,
  } satisfies Omit<
    TaskPlanFilePlannerWiringResult,
    "humanOutput" | "jsonOutput" | "summary"
  >;
  const status = determineStatus(baseResult);
  const exitCode = mapTaskPlanFileWiringStatusToExitCode(status);
  const resultWithoutSummary = {
    ...baseResult,
    ok: status === "planned",
    status,
    exitCode,
    humanOutput: undefined,
    jsonOutput: undefined,
  } satisfies Omit<TaskPlanFilePlannerWiringResult, "summary">;
  const summary = summarizeTaskPlanFilePlannerWiringResultParts(
    resultWithoutSummary,
    input.json,
  );
  const result = {
    ...resultWithoutSummary,
    summary,
  } satisfies TaskPlanFilePlannerWiringResult;

  if (input.json) {
    return {
      ...result,
      jsonOutput: createTaskPlanFileJsonOutput(result),
    };
  }

  return {
    ...result,
    humanOutput: createTaskPlanFileHumanOutput(result),
  };
}
