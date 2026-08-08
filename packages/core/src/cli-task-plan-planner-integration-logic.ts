import type {
  AgenticRunnerPlanningInput,
  AgenticRunnerPlanningReference,
  AgenticRunnerPlanningResult,
} from "./agentic-runner-planning.js";
import type {
  CliTaskPlanExitCode,
  CliTaskPlanHumanRenderModel,
  CliTaskPlanJsonOnlyBehavior,
  CliTaskPlanJsonRenderModel,
  CliTaskPlanMappingIntegrationStage,
  CliTaskPlanParserIntegrationStage,
  CliTaskPlanPlannerIntegrationInput,
  CliTaskPlanPlannerIntegrationIssue,
  CliTaskPlanPlannerIntegrationIssuePhase,
  CliTaskPlanPlannerIntegrationIssueSeverity,
  CliTaskPlanPlannerIntegrationResult,
  CliTaskPlanPlannerIntegrationStage,
  CliTaskPlanPlannerIntegrationStatus,
  CliTaskPlanPlannerIntegrationSummary,
  CliTaskPlanSafetyIntegrationStage,
  CliTaskPlanWiringIntegrationStage,
} from "./cli-task-plan-planner-integration.js";
import type {
  TaskContractMappingIssue,
  TaskContractMappingStatus,
} from "./task-contract-mapping.js";
import type { TaskPlanInputIssue } from "./task-plan-input.js";

export type CliTaskPlanPlannerFunction = (
  input: AgenticRunnerPlanningInput,
) => AgenticRunnerPlanningResult;

export interface CliTaskPlanPlannerIntegrationDependencies {
  readonly planner?: CliTaskPlanPlannerFunction;
  readonly planningResultReference?: AgenticRunnerPlanningReference;
}

export interface CliTaskPlanPlannerIntegrationGateEvaluationInput {
  readonly input: CliTaskPlanPlannerIntegrationInput;
  readonly parser?: CliTaskPlanParserIntegrationStage;
  readonly mapping?: CliTaskPlanMappingIntegrationStage;
  readonly safety?: CliTaskPlanSafetyIntegrationStage;
  readonly plannerDependencyInjected?: boolean;
}

export interface CliTaskPlanPlannerIntegrationGateEvaluation {
  readonly parserAllowed: boolean;
  readonly validationAllowed: boolean;
  readonly mappingAllowed: boolean;
  readonly runnerPlanningInputAllowed: boolean;
  readonly safetyAllowed: boolean;
  readonly wiringAllowed: boolean;
  readonly plannerDependencyInjected: boolean;
  readonly plannerInvocationAllowed: boolean;
  readonly issues: readonly CliTaskPlanPlannerIntegrationIssue[];
}

interface SafetyStageInput {
  readonly input?: CliTaskPlanPlannerIntegrationInput;
  readonly parser?: CliTaskPlanParserIntegrationStage;
  readonly mapping?: CliTaskPlanMappingIntegrationStage;
  readonly planner?: CliTaskPlanPlannerIntegrationStage;
  readonly issues?: readonly CliTaskPlanPlannerIntegrationIssue[];
}

type JsonRecord = Record<string, unknown>;

const phaseOrder: readonly CliTaskPlanPlannerIntegrationIssuePhase[] = [
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
];

const severityOrder: readonly CliTaskPlanPlannerIntegrationIssueSeverity[] = [
  "critical",
  "error",
  "warning",
  "info",
];

const unsafeRuntimeTruthFields = new Set([
  "adapterCallHappened",
  "adapterCalls",
  "adapterCallsMade",
  "approved",
  "auditEventsEmitted",
  "auditWriteHappened",
  "auditWrites",
  "completed",
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
  "verified",
  "verifierExecuted",
  "verifierRun",
]);

const unsafeMetadataClaimValues = new Set([
  "all done",
  "approved",
  "completed",
  "done",
  "verified",
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

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function booleanField(value: unknown, field: string): boolean | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const fieldValue = value[field];

  return typeof fieldValue === "boolean" ? fieldValue : undefined;
}

function issueKey(issue: CliTaskPlanPlannerIntegrationIssue): string {
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
  issues: readonly CliTaskPlanPlannerIntegrationIssue[],
): readonly CliTaskPlanPlannerIntegrationIssue[] {
  const unique = new Map<string, CliTaskPlanPlannerIntegrationIssue>();

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
  readonly severity?: CliTaskPlanPlannerIntegrationIssueSeverity;
  readonly phase: CliTaskPlanPlannerIntegrationIssuePhase;
  readonly taskId?: string;
  readonly sourceFile?: string;
  readonly field?: string;
  readonly sourceIssue?: TaskPlanInputIssue;
  readonly sourceReference?: AgenticRunnerPlanningReference;
  readonly metadata?: Record<string, unknown>;
}): CliTaskPlanPlannerIntegrationIssue {
  return {
    code: input.code,
    message: input.message,
    severity: input.severity ?? "error",
    phase: input.phase,
    taskId: input.taskId,
    sourceFile: input.sourceFile,
    field: input.field,
    sourceIssue: input.sourceIssue,
    sourceReference: input.sourceReference,
    metadata: input.metadata,
  };
}

function resolveSourceFile(
  input: CliTaskPlanPlannerIntegrationInput,
): string {
  return (
    input.parserResult?.sourceFile ??
    input.mappingResult?.sourceFile ??
    input.parserRequest?.inputPath ??
    input.taskFile
  );
}

function resolveTaskId(
  input: CliTaskPlanPlannerIntegrationInput,
): string | undefined {
  return (
    input.mappingResult?.taskId ??
    input.parserResult?.validation.taskId ??
    input.parserResult?.parse.valueReference?.taskId
  );
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

    const insideMetadata =
      currentPath.endsWith(".metadata") || currentPath.includes(".metadata.");

    for (const [key, childValue] of Object.entries(nestedValue).sort(
      ([left], [right]) => compareString(left, right),
    )) {
      const childPath = `${currentPath}.${key}`;

      if (unsafeRuntimeTruthFields.has(key) && childValue === true) {
        unsafePaths.push(childPath);
      }

      if (
        (key === "state" || key === "initialState") &&
        childValue === "completed"
      ) {
        unsafePaths.push(childPath);
      }

      if (
        insideMetadata &&
        typeof childValue === "string" &&
        unsafeMetadataClaimValues.has(childValue.trim().toLowerCase())
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
  readonly phase: CliTaskPlanPlannerIntegrationIssuePhase;
  readonly taskId?: string;
  readonly sourceFile?: string;
  readonly sourceReference?: AgenticRunnerPlanningReference;
}): readonly CliTaskPlanPlannerIntegrationIssue[] {
  return collectUnsafeRuntimeTruthPaths(input.value, input.rootPath).map(
    (path) =>
      createIssue({
        code: "cli_task_plan_unsafe_represented_metadata",
        message:
          "Represented CLI task plan integration data claims an unsafe runtime side effect, approval, verification, or completed state.",
        severity: "critical",
        phase: input.phase,
        taskId: input.taskId,
        sourceFile: input.sourceFile,
        field: path,
        sourceReference: input.sourceReference,
      }),
  );
}

function mapParserIssue(
  issue: TaskPlanInputIssue,
  input: CliTaskPlanPlannerIntegrationInput,
): CliTaskPlanPlannerIntegrationIssue {
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

function mapMappingIssueCategoryToPhase(
  issue: TaskContractMappingIssue,
): CliTaskPlanPlannerIntegrationIssuePhase {
  if (issue.category === "validation") {
    return "validation";
  }

  if (issue.category === "safety") {
    return "safety";
  }

  if (issue.category === "input") {
    return "input";
  }

  return "mapping";
}

function mapMappingIssue(
  issue: TaskContractMappingIssue,
  input: CliTaskPlanPlannerIntegrationInput,
): CliTaskPlanPlannerIntegrationIssue {
  return {
    code: issue.code,
    message: issue.message,
    severity: issue.severity,
    phase: mapMappingIssueCategoryToPhase(issue),
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
  input: CliTaskPlanPlannerIntegrationInput,
): CliTaskPlanPlannerIntegrationIssue {
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

function hasIssueInPhase(
  issues: readonly CliTaskPlanPlannerIntegrationIssue[],
  phase: CliTaskPlanPlannerIntegrationIssuePhase,
): boolean {
  return issues.some((issue) => issue.phase === phase);
}

function hasIssueForField(
  issues: readonly CliTaskPlanPlannerIntegrationIssue[],
  field: string,
): boolean {
  return issues.some((issue) => issue.field === field);
}

function mappingResultNoExecution(
  input: CliTaskPlanPlannerIntegrationInput,
): boolean {
  const mappingResult = input.mappingResult;
  const runnerPlanningInput = mappingResult?.planningInput.runnerPlanningInput;
  const runnerPlanningInputMetadata = runnerPlanningInput?.metadata;

  return (
    booleanField(input, "noExecution") === true &&
    mappingResult !== undefined &&
    booleanField(mappingResult.summary, "noExecution") === true &&
    booleanField(runnerPlanningInputMetadata, "noExecution") === true &&
    booleanField(mappingResult.planningInput, "runnerPlanningExecuted") ===
      false &&
    runnerPlanningInputMetadata?.runnerExecutionStarted !== true &&
    runnerPlanningInputMetadata?.adapterCallsMade !== true &&
    runnerPlanningInputMetadata?.executionEnabled !== true &&
    runnerPlanningInputMetadata?.adapterCalls !== true &&
    runnerPlanningInputMetadata?.verifierRun !== true &&
    runnerPlanningInputMetadata?.verifierExecuted !== true
  );
}

function mappingResultNoWrites(
  input: CliTaskPlanPlannerIntegrationInput,
): boolean {
  const mappingResult = input.mappingResult;
  const runnerPlanningInput = mappingResult?.planningInput.runnerPlanningInput;
  const runnerPlanningInputMetadata = runnerPlanningInput?.metadata;

  return (
    booleanField(input, "noWrites") === true &&
    mappingResult !== undefined &&
    booleanField(mappingResult.summary, "noWrites") === true &&
    booleanField(runnerPlanningInputMetadata, "noWrites") === true &&
    booleanField(mappingResult.planningInput, "taskPersistenceWritten") ===
      false &&
    runnerPlanningInputMetadata?.auditEventsEmitted !== true &&
    runnerPlanningInputMetadata?.taskPersistenceWritten !== true &&
    runnerPlanningInputMetadata?.auditWrites !== true &&
    runnerPlanningInputMetadata?.persistence !== true &&
    runnerPlanningInputMetadata?.filesystemMutation !== true &&
    runnerPlanningInputMetadata?.completedStateCreated !== true
  );
}

function createParserStage(
  input: CliTaskPlanPlannerIntegrationInput,
): CliTaskPlanParserIntegrationStage {
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
          sourceReference: input.parserResultReference,
        });
  const syntheticIssues: CliTaskPlanPlannerIntegrationIssue[] = [];

  if (!attempted) {
    syntheticIssues.push(
      createIssue({
        code: "cli_task_plan_parser_result_missing",
        message:
          "CLI task plan planner integration requires an in-memory parser result.",
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
        code: "cli_task_plan_path_not_ok",
        message: "Task plan input path checks did not pass.",
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
        code: "cli_task_plan_parse_not_ok",
        message: "Task plan input parsing did not pass.",
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
        code: "cli_task_plan_validation_not_compatible",
        message:
          "Task plan input validation did not provide a validated task contract.",
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
    ok:
      attempted &&
      parserResult?.ok === true &&
      pathOk &&
      parseOk &&
      validationCompatible &&
      unsafeParserIssues.length === 0,
    sourceFile,
    pathOk,
    parseOk,
    validationStatus,
    validationCompatible,
    parserResult: safeParserResult,
    parserResultReference:
      unsafeParserIssues.length === 0 ? input.parserResultReference : undefined,
    parsedTaskData: safeParserResult?.validation.task,
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
    issues,
  };
}

function createMappingStage(
  input: CliTaskPlanPlannerIntegrationInput,
): CliTaskPlanMappingIntegrationStage {
  const mappingResult = input.mappingResult;
  const sourceFile = resolveSourceFile(input);
  const taskId = resolveTaskId(input);
  const attempted = mappingResult !== undefined;
  const status = mappingResult?.status ?? "not_attempted";
  const rawRunnerPlanningInput =
    mappingResult?.planningInput.runnerPlanningInput;
  const runnerPlanningInputReference =
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
          sourceReference: runnerPlanningInputReference,
        });
  const unsafeRunnerPlanningInputIssues =
    rawRunnerPlanningInput === undefined
      ? []
      : createUnsafeRuntimeTruthIssues({
          value: rawRunnerPlanningInput,
          rootPath: "mappingResult.planningInput.runnerPlanningInput",
          phase: "safety",
          taskId,
          sourceFile,
          sourceReference: runnerPlanningInputReference,
        });
  const unsafeIssues = [
    ...unsafeMappingIssues,
    ...unsafeRunnerPlanningInputIssues,
  ];
  const runnerPlanningInput =
    unsafeIssues.length === 0 ? rawRunnerPlanningInput : undefined;
  const runnerPlanningInputAvailable = runnerPlanningInput !== undefined;
  const noExecution = mappingResultNoExecution(input) && unsafeIssues.length === 0;
  const noWrites = mappingResultNoWrites(input) && unsafeIssues.length === 0;
  const verifierRequired =
    mappingResult?.verifier?.verifierRequired === true &&
    mappingResult?.summary.verifierRequired === true &&
    rawRunnerPlanningInput?.verifierRequirements?.verifierRequired === true;
  const completionGatedByVerifier =
    mappingResult?.verifier?.completionGatedByVerifier === true &&
    mappingResult?.summary.completionGatedByVerifier === true &&
    rawRunnerPlanningInput?.verifierRequirements?.completionGatedByVerifier ===
      true;
  const sourceIssues =
    mappingResult === undefined
      ? []
      : mappingResult.issues.map((issue) => mapMappingIssue(issue, input));
  const syntheticIssues: CliTaskPlanPlannerIntegrationIssue[] = [];

  if (!attempted) {
    syntheticIssues.push(
      createIssue({
        code: "cli_task_plan_mapping_result_missing",
        message:
          "CLI task plan planner integration requires an in-memory mapping result.",
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
        code: "cli_task_plan_mapping_unsupported",
        message:
          "The parsed task contract cannot be mapped to runner planning input.",
        phase: "mapping",
        taskId,
        sourceFile,
        field: "mapping.status",
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
        code: "cli_task_plan_mapping_not_mapped",
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
    status === "mapped" &&
    !runnerPlanningInputAvailable &&
    !hasIssueForField(sourceIssues, "mapping.planningInput")
  ) {
    syntheticIssues.push(
      createIssue({
        code: "cli_task_plan_runner_planning_input_missing",
        message:
          "Mapping did not produce runnerPlanningInput; wiring and planning remain blocked.",
        phase: "mapping",
        taskId,
        sourceFile,
        field: "mapping.planningInput.runnerPlanningInput",
      }),
    );
  }

  if (attempted && !noExecution) {
    syntheticIssues.push(
      createIssue({
        code: "cli_task_plan_no_execution_not_proven",
        message:
          "The integration must fail closed when noExecution cannot be proven true.",
        severity: "critical",
        phase: "safety",
        taskId,
        sourceFile,
        field: "mapping.noExecution",
        metadata: {
          requiredNoExecution: true,
          representedNoExecution: booleanField(
            rawRunnerPlanningInput?.metadata,
            "noExecution",
          ),
          representedInputNoExecution: booleanField(input, "noExecution"),
          representedSummaryNoExecution: booleanField(
            mappingResult?.summary,
            "noExecution",
          ),
        },
      }),
    );
  }

  if (attempted && !noWrites) {
    syntheticIssues.push(
      createIssue({
        code: "cli_task_plan_no_writes_not_proven",
        message:
          "The integration must fail closed when noWrites cannot be proven true.",
        severity: "critical",
        phase: "safety",
        taskId,
        sourceFile,
        field: "mapping.noWrites",
        metadata: {
          requiredNoWrites: true,
          representedNoWrites: booleanField(
            rawRunnerPlanningInput?.metadata,
            "noWrites",
          ),
          representedInputNoWrites: booleanField(input, "noWrites"),
          representedSummaryNoWrites: booleanField(
            mappingResult?.summary,
            "noWrites",
          ),
        },
      }),
    );
  }

  if (attempted && !verifierRequired) {
    syntheticIssues.push(
      createIssue({
        code: "cli_task_plan_verifier_not_required",
        message:
          "The integration must fail closed unless verifier requirements are represented.",
        severity: "critical",
        phase: "safety",
        taskId,
        sourceFile,
        field: "mapping.verifierRequired",
      }),
    );
  }

  if (attempted && !completionGatedByVerifier) {
    syntheticIssues.push(
      createIssue({
        code: "cli_task_plan_completion_not_verifier_gated",
        message:
          "Completion must remain gated by verifier requirements before planning is allowed.",
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
      runnerPlanningInputAvailable &&
      noExecution &&
      noWrites &&
      verifierRequired &&
      completionGatedByVerifier &&
      unsafeIssues.length === 0,
    status,
    mappingResult: safeMappingResult,
    mappingResultReference:
      unsafeIssues.length === 0 ? input.mappingResultReference : undefined,
    runnerPlanningInput,
    runnerPlanningInputReference,
    runnerPlanningInputData:
      unsafeIssues.length === 0
        ? mappingResult?.planningInput.runnerPlanningInputData
        : undefined,
    runnerPlanningInputAvailable,
    noExecution: true,
    noWrites: true,
    verifierRequired,
    completionGatedByVerifier,
    issues,
  };
}

function hasBlockingSafetyFlags(
  safety: CliTaskPlanSafetyIntegrationStage,
): boolean {
  return (
    safety.executionEnabled ||
    safety.adapterCalls ||
    safety.auditWrites ||
    safety.verifierRun ||
    safety.persistence ||
    safety.filesystemMutation ||
    safety.completedStateCreated
  );
}

export function createCliTaskPlanSafetyIntegrationStage(
  safetyInput: SafetyStageInput = {},
): CliTaskPlanSafetyIntegrationStage {
  const input = safetyInput.input;
  const sourceFile = input === undefined ? undefined : resolveSourceFile(input);
  const taskId = input === undefined ? undefined : resolveTaskId(input);
  const issues: CliTaskPlanPlannerIntegrationIssue[] = [
    ...(safetyInput.issues ?? []),
  ];

  if (input !== undefined && booleanField(input, "noExecution") !== true) {
    issues.push(
      createIssue({
        code: "cli_task_plan_execution_not_disabled",
        message:
          "CLI task plan planner integration requires noExecution to be true.",
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
        code: "cli_task_plan_writes_not_disabled",
        message:
          "CLI task plan planner integration requires noWrites to be true.",
        severity: "critical",
        phase: "safety",
        taskId,
        sourceFile,
        field: "noWrites",
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
        sourceReference: input.parserResultReference,
      }),
    );
  }

  if (
    input?.parserResult !== undefined &&
    booleanField(input.parserResult.summary, "runnerPlanningExecuted") !== false
  ) {
    issues.push(
      createIssue({
        code: "cli_task_plan_parser_claims_runner_planning_executed",
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

  if (
    input?.parserResult !== undefined &&
    booleanField(input.parserResult.summary, "taskPersistenceWritten") !== false
  ) {
    issues.push(
      createIssue({
        code: "cli_task_plan_parser_claims_persistence_written",
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
        code: "cli_task_plan_parser_trusts_model_self_reporting",
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

  if (
    input?.mappingResult !== undefined &&
    booleanField(input.mappingResult.planningInput, "runnerPlanningExecuted") !==
      false
  ) {
    issues.push(
      createIssue({
        code: "cli_task_plan_mapping_claims_runner_planning_executed",
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
        code: "cli_task_plan_mapping_claims_persistence_written",
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

  if (safetyInput.planner?.planningResult !== undefined) {
    issues.push(
      ...createUnsafeRuntimeTruthIssues({
        value: safetyInput.planner.planningResult,
        rootPath: "planningResult",
        phase: "safety",
        taskId,
        sourceFile,
        sourceReference: safetyInput.planner.planningResultReference,
      }),
    );
  }

  issues.push(
    ...(safetyInput.parser?.issues.filter((issue) => issue.phase === "safety") ??
      []),
    ...(safetyInput.mapping?.issues.filter((issue) => issue.phase === "safety") ??
      []),
    ...(safetyInput.planner?.issues.filter((issue) => issue.phase === "safety") ??
      []),
  );

  const safeIssues = sortIssues(issues);

  return {
    cliPlanCommandMayRunParserMapperWiringPlannerLater: true,
    executionEnabled: false,
    adapterCalls: false,
    auditWrites: false,
    verifierRun: false,
    persistence: false,
    filesystemMutation: false,
    completedStateCreated: false,
    noExecution: true,
    noWrites: true,
    failClosedWithoutRunnerPlanningInput:
      safetyInput.mapping?.runnerPlanningInputAvailable !== true,
    failClosedWithoutNoExecution:
      safetyInput.mapping?.noExecution !== true ||
      hasIssueForField(safetyInput.mapping?.issues ?? [], "mapping.noExecution"),
    failClosedWithoutNoWrites:
      safetyInput.mapping?.noWrites !== true ||
      hasIssueForField(safetyInput.mapping?.issues ?? [], "mapping.noWrites"),
    failClosedWithoutVerifierRequired:
      safetyInput.mapping?.verifierRequired !== true,
    failClosedWithoutCompletionGate:
      safetyInput.mapping?.completionGatedByVerifier !== true,
    failClosedOnUnsafeMetadata: true,
    dependencyInjectedPlannerOnly: true,
    topLevelPlannerInputBypassAllowed: false,
    issues: safeIssues,
  };
}

export function createCliTaskPlanJsonOnlyBehavior(
  input:
    | Pick<CliTaskPlanPlannerIntegrationInput, "json">
    | { readonly jsonRequested: boolean },
): CliTaskPlanJsonOnlyBehavior {
  const jsonRequested =
    "jsonRequested" in input ? input.jsonRequested : input.json;

  return {
    jsonRequested,
    suppressHumanOutput: jsonRequested,
    validJsonOnly: jsonRequested,
    noProsePrefix: true,
    noProseSuffix: true,
    noStackTraces: true,
    noRawEngineErrors: true,
    deterministicIssues: true,
  };
}

export function evaluateCliTaskPlanPlannerIntegrationGates(
  gateInput:
    | CliTaskPlanPlannerIntegrationInput
    | CliTaskPlanPlannerIntegrationGateEvaluationInput,
  dependencies: CliTaskPlanPlannerIntegrationDependencies = {},
): CliTaskPlanPlannerIntegrationGateEvaluation {
  const input = "input" in gateInput ? gateInput.input : gateInput;
  const parser =
    "input" in gateInput && gateInput.parser !== undefined
      ? gateInput.parser
      : createParserStage(input);
  const mapping =
    "input" in gateInput && gateInput.mapping !== undefined
      ? gateInput.mapping
      : createMappingStage(input);
  const safety =
    "input" in gateInput && gateInput.safety !== undefined
      ? gateInput.safety
      : createCliTaskPlanSafetyIntegrationStage({
          input,
          parser,
          mapping,
        });
  const plannerDependencyInjected = dependencies.planner !== undefined;
  const parserAllowed =
    parser.attempted &&
    parser.ok &&
    parser.pathOk &&
    parser.parseOk &&
    !hasIssueInPhase(parser.issues, "parse") &&
    !hasIssueInPhase(parser.issues, "safety");
  const validationAllowed =
    parserAllowed &&
    parser.validationCompatible === true &&
    parser.validationStatus === "pass" &&
    !hasIssueInPhase(parser.issues, "validation");
  const mappingAllowed =
    validationAllowed &&
    mapping.attempted &&
    mapping.ok &&
    mapping.status === "mapped" &&
    !hasIssueInPhase(mapping.issues, "mapping") &&
    !hasIssueInPhase(mapping.issues, "safety");
  const runnerPlanningInputAllowed =
    mappingAllowed && mapping.runnerPlanningInputAvailable;
  const safetyAllowed =
    runnerPlanningInputAllowed &&
    safety.issues.length === 0 &&
    !hasBlockingSafetyFlags(safety) &&
    mapping.noExecution === true &&
    mapping.noWrites === true &&
    mapping.verifierRequired &&
    mapping.completionGatedByVerifier &&
    !safety.failClosedWithoutRunnerPlanningInput &&
    !safety.failClosedWithoutNoExecution &&
    !safety.failClosedWithoutNoWrites &&
    !safety.failClosedWithoutVerifierRequired &&
    !safety.failClosedWithoutCompletionGate &&
    safety.failClosedOnUnsafeMetadata;
  const wiringAllowed = safetyAllowed && plannerDependencyInjected;
  const issues = sortIssues([...parser.issues, ...mapping.issues, ...safety.issues]);

  return {
    parserAllowed,
    validationAllowed,
    mappingAllowed,
    runnerPlanningInputAllowed,
    safetyAllowed,
    wiringAllowed,
    plannerDependencyInjected,
    plannerInvocationAllowed:
      wiringAllowed &&
      dependencies.planner !== undefined &&
      mapping.runnerPlanningInput !== undefined,
    issues,
  };
}

function createWiringStage(
  input: CliTaskPlanPlannerIntegrationInput,
  gates: CliTaskPlanPlannerIntegrationGateEvaluation,
): CliTaskPlanWiringIntegrationStage {
  const sourceFile = resolveSourceFile(input);
  const taskId = resolveTaskId(input);
  const issues: CliTaskPlanPlannerIntegrationIssue[] = [];

  if (gates.safetyAllowed && !gates.plannerDependencyInjected) {
    issues.push(
      createIssue({
        code: "cli_task_plan_planner_dependency_missing",
        message:
          "Planner invocation is blocked until a dependency-injected planner function is supplied.",
        phase: "wiring",
        taskId,
        sourceFile,
        field: "planner",
      }),
    );
  }

  return {
    attempted: gates.safetyAllowed,
    ok: gates.wiringAllowed,
    status: gates.wiringAllowed
      ? "wired"
      : gates.safetyAllowed
        ? "blocked"
        : "not_attempted",
    wiringResultReference: gates.wiringAllowed
      ? input.wiringResultReference
      : undefined,
    wiringResultData: undefined,
    plannerDependencyInjected: gates.plannerDependencyInjected,
    plannerInvocationAllowed: gates.plannerInvocationAllowed,
    dependencyInjectedPlannerOnly: true,
    topLevelPlannerInputBypassAllowed: false,
    issues: sortIssues(issues),
  };
}

function createPlannerStage(
  input: CliTaskPlanPlannerIntegrationInput,
  mapping: CliTaskPlanMappingIntegrationStage,
  gates: CliTaskPlanPlannerIntegrationGateEvaluation,
  dependencies: CliTaskPlanPlannerIntegrationDependencies,
): CliTaskPlanPlannerIntegrationStage {
  const runnerPlanningInput = mapping.runnerPlanningInput;
  const sourceFile = resolveSourceFile(input);
  const taskId = resolveTaskId(input);

  const planner = dependencies.planner;

  if (
    !gates.plannerInvocationAllowed ||
    runnerPlanningInput === undefined ||
    planner === undefined
  ) {
    return {
      attempted: false,
      ok: false,
      status: "not_attempted",
      plannerDependencyReference: input.plannerDependencyReference,
      issues: [],
    };
  }

  let planningResult: AgenticRunnerPlanningResult;

  try {
    planningResult = planner(runnerPlanningInput);
  } catch (error) {
    return {
      attempted: true,
      ok: false,
      status: "failed",
      plannerDependencyReference: input.plannerDependencyReference,
      planStepCount: 0,
      issues: [
        createIssue({
          code: "cli_task_plan_planner_threw",
          message:
            "The dependency-injected planner failed before producing a plan.",
          phase: "planner",
          taskId,
          sourceFile,
          field: "planner",
          sourceReference: mapping.runnerPlanningInputReference,
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
    sourceReference: dependencies.planningResultReference,
  });
  const syntheticIssues =
    planningResult.ok || plannerIssues.length > 0
      ? []
      : [
          createIssue({
            code: "cli_task_plan_planner_failed",
            message:
              "The dependency-injected planner returned a failed plan result.",
            phase: "planner",
            taskId,
            sourceFile,
            field: "planner",
            sourceReference: mapping.runnerPlanningInputReference,
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
    plannerDependencyReference: input.plannerDependencyReference,
    planningResult: plannerSafe ? planningResult : undefined,
    planningResultReference: plannerSafe
      ? dependencies.planningResultReference
      : undefined,
    planningResultData: plannerSafe
      ? {
          kind: "data",
          data: planningResult,
          reference: dependencies.planningResultReference,
        }
      : undefined,
    planStepCount: plannerSafe ? planningResult.steps.length : 0,
    issues,
  };
}

function determineStatus(input: {
  readonly parser: CliTaskPlanParserIntegrationStage;
  readonly mapping: CliTaskPlanMappingIntegrationStage;
  readonly wiring: CliTaskPlanWiringIntegrationStage;
  readonly planner: CliTaskPlanPlannerIntegrationStage;
  readonly safety: CliTaskPlanSafetyIntegrationStage;
}): CliTaskPlanPlannerIntegrationStatus {
  if (
    !input.parser.attempted ||
    !input.parser.pathOk ||
    !input.parser.parseOk ||
    (input.parser.attempted && input.parser.ok !== true && !input.parser.parseOk)
  ) {
    return "parser_failed";
  }

  if (
    input.parser.validationCompatible !== true ||
    input.parser.validationStatus !== "pass"
  ) {
    return "validation_failed";
  }

  if (!input.parser.ok) {
    return "parser_failed";
  }

  if (input.mapping.status === "unsupported") {
    return "unsupported_mapping";
  }

  if (
    input.mapping.attempted &&
    input.mapping.status === "mapped" &&
    input.mapping.mappingResult !== undefined &&
    input.mapping.mappingResult?.planningInput.runnerPlanningInput === undefined
  ) {
    return "mapping_failed";
  }

  if (
    input.safety.issues.length > 0 ||
    hasBlockingSafetyFlags(input.safety) ||
    input.safety.failClosedWithoutNoExecution ||
    input.safety.failClosedWithoutNoWrites ||
    input.safety.failClosedWithoutVerifierRequired ||
    input.safety.failClosedWithoutCompletionGate
  ) {
    return "blocked";
  }

  if (
    !input.mapping.attempted ||
    input.mapping.status === "failed" ||
    input.mapping.status === "invalid" ||
    input.mapping.status === "unknown" ||
    input.mapping.status === "blocked" ||
    input.mapping.status === "not_attempted" ||
    input.mapping.status !== "mapped" ||
    !input.mapping.runnerPlanningInputAvailable
  ) {
    return "mapping_failed";
  }

  if (!input.wiring.ok && input.wiring.attempted) {
    return "blocked";
  }

  if (input.planner.attempted && !input.planner.ok) {
    return "planner_failed";
  }

  if (input.planner.ok && input.planner.status === "planned") {
    return "planned";
  }

  return "unknown";
}

export function mapCliTaskPlanStatusToExitCode(
  status: CliTaskPlanPlannerIntegrationStatus,
): CliTaskPlanExitCode {
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

  if (status === "wiring_failed") {
    return "wiring_failure";
  }

  if (status === "blocked") {
    return "blocked";
  }

  return "unknown_failure";
}

function countMappedWorkItems(
  result: Pick<
    CliTaskPlanPlannerIntegrationResult,
    "mapping" | "planner"
  >,
): number {
  return (
    result.planner.planningResult?.summary.workItemCount ??
    result.mapping.mappingResult?.summary.workItemCount ??
    0
  );
}

function countMappedBatches(
  result: Pick<
    CliTaskPlanPlannerIntegrationResult,
    "mapping" | "planner"
  >,
): number {
  return (
    result.planner.planningResult?.summary.batchCount ??
    result.mapping.mappingResult?.summary.batchCount ??
    0
  );
}

function countPlanSteps(
  result: Pick<CliTaskPlanPlannerIntegrationResult, "planner">,
): number {
  return (
    result.planner.planStepCount ??
    result.planner.planningResult?.summary.stepCount ??
    0
  );
}

function determinePolicyRequired(
  result: Pick<CliTaskPlanPlannerIntegrationResult, "mapping" | "planner">,
): boolean {
  return (
    (result.planner.planningResult?.policy.length ?? 0) > 0 ||
    result.mapping.mappingResult?.summary.policyRequired === true
  );
}

function determineApprovalRequired(
  result: Pick<CliTaskPlanPlannerIntegrationResult, "mapping" | "planner">,
): boolean {
  return (
    result.planner.planningResult?.summary.approvalRequired === true ||
    result.mapping.mappingResult?.summary.approvalRequired === true
  );
}

function determineAuditExpected(
  result: Pick<CliTaskPlanPlannerIntegrationResult, "mapping" | "planner">,
): boolean {
  const plannerAudit = result.planner.planningResult?.audit;
  const mappingAudit = result.mapping.mappingResult?.audit;

  return (
    plannerAudit?.auditRequired === true ||
    (plannerAudit?.expectedAuditEventIds.length ?? 0) > 0 ||
    mappingAudit?.auditRequired === true ||
    (mappingAudit?.expectedAuditEventIds.length ?? 0) > 0
  );
}

export function summarizeCliTaskPlanPlannerIntegrationResult(
  result: Omit<CliTaskPlanPlannerIntegrationResult, "summary">,
): CliTaskPlanPlannerIntegrationSummary {
  return {
    parsed: result.parser.ok,
    mapped: result.mapping.ok,
    wired: result.wiring.ok,
    planned: result.planner.ok && result.planner.status === "planned",
    workItemCount: countMappedWorkItems(result),
    batchCount: countMappedBatches(result),
    planStepCount: countPlanSteps(result),
    issueCount: result.issues.length,
    json: result.jsonOnly.jsonRequested,
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
      result.planner.planningResult?.verifier.verifierRequired === true,
    completionGatedByVerifier:
      result.mapping.completionGatedByVerifier ||
      result.planner.planningResult?.verifier.completionGatedByVerifier === true,
    runnerPlanningInputAvailable: result.mapping.runnerPlanningInputAvailable,
    plannerDependencyInjected: result.wiring.plannerDependencyInjected,
    plannerInvocationAllowed: result.wiring.plannerInvocationAllowed,
  };
}

export function createCliTaskPlanHumanRenderModel(
  result: CliTaskPlanPlannerIntegrationResult,
): CliTaskPlanHumanRenderModel {
  return {
    title: "Task Plan",
    taskId: result.taskId,
    sourceFile: result.sourceFile,
    mode: result.mode,
    parsed: result.parser.ok,
    mapping: result.mapping.status,
    planning: result.planner.status,
    workItems: result.summary.workItemCount,
    batches: result.summary.batchCount,
    steps: result.summary.planStepCount,
    policyRequired: determinePolicyRequired(result),
    approvalRequired: determineApprovalRequired(result),
    verifierRequired: result.summary.verifierRequired,
    completionGatedByVerifier: result.summary.completionGatedByVerifier,
    auditExpected: determineAuditExpected(result),
    realExecution: false,
    adapterCalls: false,
    auditWrites: false,
    verifierRun: false,
    persistence: false,
    filesystemMutation: false,
    completedStateCreated: false,
    issues: result.issues,
  };
}

export function createCliTaskPlanJsonRenderModel(
  result: CliTaskPlanPlannerIntegrationResult,
): CliTaskPlanJsonRenderModel {
  return {
    ok: result.ok,
    status: result.status,
    exitCode: result.exitCode,
    taskId: result.taskId,
    mode: result.mode,
    sourceFile: result.sourceFile,
    parse: result.parser,
    mapping: result.mapping,
    wiring: result.wiring,
    plan: result.planner,
    safety: result.safety,
    issues: result.issues,
    summary: result.summary,
  };
}

export function createCliTaskPlanPlannerIntegrationResult(
  input: CliTaskPlanPlannerIntegrationInput,
  dependencies: CliTaskPlanPlannerIntegrationDependencies = {},
): CliTaskPlanPlannerIntegrationResult {
  const parser = createParserStage(input);
  const mapping: CliTaskPlanMappingIntegrationStage =
    parser.ok && parser.validationCompatible === true
      ? createMappingStage(input)
      : {
          attempted: false,
          ok: false,
          status: "not_attempted" as const,
          runnerPlanningInputAvailable: false,
          noExecution: true,
          noWrites: true,
          verifierRequired: false,
          completionGatedByVerifier: false,
          issues: [] as const,
        };
  const prePlannerSafety = createCliTaskPlanSafetyIntegrationStage({
    input,
    parser,
    mapping,
  });
  const gates = evaluateCliTaskPlanPlannerIntegrationGates(
    {
      input,
      parser,
      mapping,
      safety: prePlannerSafety,
      plannerDependencyInjected: dependencies.planner !== undefined,
    },
    dependencies,
  );
  const wiring = createWiringStage(input, gates);
  const planner = createPlannerStage(input, mapping, gates, dependencies);
  const safety = createCliTaskPlanSafetyIntegrationStage({
    input,
    parser,
    mapping,
    planner,
  });
  const issues = sortIssues([
    ...parser.issues,
    ...mapping.issues,
    ...wiring.issues,
    ...planner.issues,
    ...safety.issues,
  ]);
  const jsonOnly = createCliTaskPlanJsonOnlyBehavior(input);
  const baseResult = {
    ok: false,
    status: "unknown",
    exitCode: "unknown_failure",
    taskId: resolveTaskId(input),
    mode: input.mode,
    sourceFile: resolveSourceFile(input),
    parser,
    mapping,
    wiring,
    planner,
    safety,
    jsonOnly,
    issues,
  } satisfies Omit<
    CliTaskPlanPlannerIntegrationResult,
    "humanOutput" | "jsonOutput" | "summary"
  >;
  const status = determineStatus(baseResult);
  const exitCode = mapCliTaskPlanStatusToExitCode(status);
  const resultWithoutSummary = {
    ...baseResult,
    ok: status === "planned",
    status,
    exitCode,
    humanOutput: undefined,
    jsonOutput: undefined,
  } satisfies Omit<CliTaskPlanPlannerIntegrationResult, "summary">;
  const summary = summarizeCliTaskPlanPlannerIntegrationResult(
    resultWithoutSummary,
  );
  const result = {
    ...resultWithoutSummary,
    summary,
  } satisfies CliTaskPlanPlannerIntegrationResult;

  if (jsonOnly.jsonRequested) {
    return {
      ...result,
      jsonOutput: createCliTaskPlanJsonRenderModel(result),
    };
  }

  return {
    ...result,
    humanOutput: createCliTaskPlanHumanRenderModel(result),
  };
}
