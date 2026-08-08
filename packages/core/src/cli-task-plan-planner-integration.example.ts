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
  CliTaskPlanPlannerIntegrationMode,
  CliTaskPlanPlannerIntegrationOptions,
  CliTaskPlanPlannerIntegrationResult,
  CliTaskPlanPlannerIntegrationStage,
  CliTaskPlanPlannerIntegrationStatus,
  CliTaskPlanPlannerIntegrationSummary,
  CliTaskPlanSafetyIntegrationStage,
  CliTaskPlanWiringIntegrationStage,
} from "./cli-task-plan-planner-integration.js";

export const cliTaskPlanPlannerIntegrationModesExample = [
  "plan",
  "dry_run",
  "validate",
  "unknown",
] as const satisfies readonly CliTaskPlanPlannerIntegrationMode[];

export const cliTaskPlanPlannerIntegrationStatusesExample = [
  "planned",
  "parser_failed",
  "validation_failed",
  "mapping_failed",
  "unsupported_mapping",
  "planner_failed",
  "blocked",
  "failed",
  "unknown",
  "wiring_failed",
] as const satisfies readonly CliTaskPlanPlannerIntegrationStatus[];

export const cliTaskPlanExitCodesExample = [
  "success",
  "parser_failure",
  "validation_failure",
  "unsupported_mapping",
  "mapping_failure",
  "planner_failure",
  "blocked",
  "unknown_failure",
  "wiring_failure",
] as const satisfies readonly CliTaskPlanExitCode[];

export const cliTaskPlanIssueSeveritiesExample = [
  "error",
  "warning",
  "info",
  "critical",
] as const satisfies readonly CliTaskPlanPlannerIntegrationIssueSeverity[];

export const cliTaskPlanIssuePhasesExample = [
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
] as const satisfies readonly CliTaskPlanPlannerIntegrationIssuePhase[];

const taskId = "TASK-0265";
const taskFile = "TASKS/TASK-0265.json";

const noIssues = [] as const satisfies readonly CliTaskPlanPlannerIntegrationIssue[];

const parserOk = {
  attempted: true,
  ok: true,
  sourceFile: taskFile,
  pathOk: true,
  parseOk: true,
  validationStatus: "pass",
  validationCompatible: true,
  parsedTaskReference: {
    id: "parsed-task:TASK-0265",
    path: taskFile,
  },
  issues: noIssues,
} as const satisfies CliTaskPlanParserIntegrationStage;

const parserNotAttempted = {
  attempted: false,
  ok: false,
  sourceFile: taskFile,
  pathOk: false,
  parseOk: false,
  issues: noIssues,
} as const satisfies CliTaskPlanParserIntegrationStage;

const runnerPlanningInput = {
  taskId,
  mode: "plan",
  options: {
    requireVerifier: true,
    requireAudit: true,
    outputMode: "summary",
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
  },
} as const;

const mappingOk = {
  attempted: true,
  ok: true,
  status: "mapped",
  runnerPlanningInput,
  runnerPlanningInputReference: {
    id: "runner-planning-input:TASK-0265",
    path: taskFile,
  },
  runnerPlanningInputData: {
    kind: "data",
    data: runnerPlanningInput,
    reference: {
      id: "runner-planning-input-data:TASK-0265",
      path: taskFile,
    },
  },
  runnerPlanningInputAvailable: true,
  noExecution: true,
  noWrites: true,
  verifierRequired: true,
  completionGatedByVerifier: true,
  issues: noIssues,
} as const satisfies CliTaskPlanMappingIntegrationStage;

const mappingNotAttempted = {
  attempted: false,
  ok: false,
  status: "not_attempted",
  runnerPlanningInputAvailable: false,
  noExecution: true,
  noWrites: true,
  verifierRequired: false,
  completionGatedByVerifier: false,
  issues: noIssues,
} as const satisfies CliTaskPlanMappingIntegrationStage;

const wiringOk = {
  attempted: true,
  ok: true,
  status: "wired",
  wiringResultReference: {
    id: "task-plan-file-planner-wiring:TASK-0265",
    path: taskFile,
  },
  plannerDependencyInjected: true,
  plannerInvocationAllowed: true,
  dependencyInjectedPlannerOnly: true,
  topLevelPlannerInputBypassAllowed: false,
  issues: noIssues,
} as const satisfies CliTaskPlanWiringIntegrationStage;

const wiringNotAttempted = {
  attempted: false,
  ok: false,
  status: "not_attempted",
  plannerDependencyInjected: false,
  plannerInvocationAllowed: false,
  dependencyInjectedPlannerOnly: true,
  topLevelPlannerInputBypassAllowed: false,
  issues: noIssues,
} as const satisfies CliTaskPlanWiringIntegrationStage;

const wiringBlocked = {
  attempted: true,
  ok: false,
  status: "blocked",
  plannerDependencyInjected: false,
  plannerInvocationAllowed: false,
  dependencyInjectedPlannerOnly: true,
  topLevelPlannerInputBypassAllowed: false,
  issues: noIssues,
} as const satisfies CliTaskPlanWiringIntegrationStage;

const plannerOk = {
  attempted: true,
  ok: true,
  status: "planned",
  plannerDependencyReference: {
    id: "dependency-injected-planner:TASK-0265",
  },
  planningResultReference: {
    id: "agentic-runner-planning-result:TASK-0265",
  },
  planStepCount: 3,
  issues: noIssues,
} as const satisfies CliTaskPlanPlannerIntegrationStage;

const plannerNotAttempted = {
  attempted: false,
  ok: false,
  status: "not_attempted",
  issues: noIssues,
} as const satisfies CliTaskPlanPlannerIntegrationStage;

const safetyNoSideEffects = {
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
  failClosedWithoutRunnerPlanningInput: true,
  failClosedWithoutNoExecution: true,
  failClosedWithoutNoWrites: true,
  failClosedWithoutVerifierRequired: true,
  failClosedWithoutCompletionGate: true,
  failClosedOnUnsafeMetadata: true,
  dependencyInjectedPlannerOnly: true,
  topLevelPlannerInputBypassAllowed: false,
  issues: noIssues,
} as const satisfies CliTaskPlanSafetyIntegrationStage;

const jsonOnlyOff = {
  jsonRequested: false,
  suppressHumanOutput: false,
  validJsonOnly: false,
  noProsePrefix: true,
  noProseSuffix: true,
  noStackTraces: true,
  noRawEngineErrors: true,
  deterministicIssues: true,
} as const satisfies CliTaskPlanJsonOnlyBehavior;

const jsonOnlyOn = {
  jsonRequested: true,
  suppressHumanOutput: true,
  validJsonOnly: true,
  noProsePrefix: true,
  noProseSuffix: true,
  noStackTraces: true,
  noRawEngineErrors: true,
  deterministicIssues: true,
} as const satisfies CliTaskPlanJsonOnlyBehavior;

const successfulSummary = {
  parsed: true,
  mapped: true,
  wired: true,
  planned: true,
  workItemCount: 1,
  batchCount: 1,
  planStepCount: 3,
  issueCount: 0,
  json: false,
  noExecution: true,
  noWrites: true,
  executionEnabled: false,
  adapterCalls: false,
  auditWrites: false,
  verifierRun: false,
  persistence: false,
  filesystemMutation: false,
  completedStateCreated: false,
  verifierRequired: true,
  completionGatedByVerifier: true,
  runnerPlanningInputAvailable: true,
  plannerDependencyInjected: true,
  plannerInvocationAllowed: true,
} as const satisfies CliTaskPlanPlannerIntegrationSummary;

const successfulHumanOutput = {
  title: "CLI Task Plan Planner Integration",
  taskId,
  sourceFile: taskFile,
  mode: "plan",
  parsed: true,
  mapping: "mapped",
  planning: "planned",
  workItems: 1,
  batches: 1,
  steps: 3,
  policyRequired: true,
  approvalRequired: false,
  verifierRequired: true,
  completionGatedByVerifier: true,
  auditExpected: true,
  realExecution: false,
  adapterCalls: false,
  auditWrites: false,
  verifierRun: false,
  persistence: false,
  filesystemMutation: false,
  completedStateCreated: false,
  issues: noIssues,
} as const satisfies CliTaskPlanHumanRenderModel;

export const scenarioASuccessfulCliTaskPlanIntegration = {
  ok: true,
  status: "planned",
  exitCode: "success",
  taskId,
  mode: "plan",
  sourceFile: taskFile,
  parser: parserOk,
  mapping: mappingOk,
  wiring: wiringOk,
  planner: plannerOk,
  safety: safetyNoSideEffects,
  humanOutput: successfulHumanOutput,
  jsonOnly: jsonOnlyOff,
  issues: noIssues,
  summary: successfulSummary,
} as const satisfies CliTaskPlanPlannerIntegrationResult;

const jsonSuccessSummary = {
  ...successfulSummary,
  json: true,
} as const satisfies CliTaskPlanPlannerIntegrationSummary;

const jsonSuccessOutput = {
  ok: true,
  status: "planned",
  exitCode: "success",
  taskId,
  mode: "plan",
  sourceFile: taskFile,
  parse: parserOk,
  mapping: mappingOk,
  wiring: wiringOk,
  plan: plannerOk,
  safety: safetyNoSideEffects,
  issues: noIssues,
  summary: jsonSuccessSummary,
} as const satisfies CliTaskPlanJsonRenderModel;

export const scenarioBJsonSuccessModel = {
  ok: true,
  status: "planned",
  exitCode: "success",
  taskId,
  mode: "plan",
  sourceFile: taskFile,
  parser: parserOk,
  mapping: mappingOk,
  wiring: wiringOk,
  planner: plannerOk,
  safety: safetyNoSideEffects,
  jsonOutput: jsonSuccessOutput,
  jsonOnly: jsonOnlyOn,
  issues: noIssues,
  summary: jsonSuccessSummary,
} as const satisfies CliTaskPlanPlannerIntegrationResult;

const parserFailureIssue = {
  code: "cli_task_plan_parse_failed",
  message: "The task plan input could not be parsed.",
  severity: "error",
  phase: "parse",
  sourceFile: taskFile,
  field: "taskFile",
} as const satisfies CliTaskPlanPlannerIntegrationIssue;

const parserFailed = {
  attempted: true,
  ok: false,
  sourceFile: taskFile,
  pathOk: true,
  parseOk: false,
  validationStatus: "not_requested",
  validationCompatible: false,
  issues: [parserFailureIssue],
} as const satisfies CliTaskPlanParserIntegrationStage;

const parserFailureSummary = {
  ...successfulSummary,
  parsed: false,
  mapped: false,
  wired: false,
  planned: false,
  workItemCount: 0,
  batchCount: 0,
  planStepCount: 0,
  issueCount: 1,
  runnerPlanningInputAvailable: false,
  plannerDependencyInjected: false,
  plannerInvocationAllowed: false,
} as const satisfies CliTaskPlanPlannerIntegrationSummary;

export const scenarioCParserFailure = {
  ok: false,
  status: "parser_failed",
  exitCode: "parser_failure",
  mode: "plan",
  sourceFile: taskFile,
  parser: parserFailed,
  mapping: mappingNotAttempted,
  wiring: wiringNotAttempted,
  planner: plannerNotAttempted,
  safety: safetyNoSideEffects,
  jsonOutput: {
    ok: false,
    status: "parser_failed",
    exitCode: "parser_failure",
    mode: "plan",
    sourceFile: taskFile,
    parse: parserFailed,
    mapping: mappingNotAttempted,
    wiring: wiringNotAttempted,
    plan: plannerNotAttempted,
    safety: safetyNoSideEffects,
    issues: [parserFailureIssue],
    summary: {
      ...parserFailureSummary,
      json: true,
    },
  },
  jsonOnly: jsonOnlyOn,
  issues: [parserFailureIssue],
  summary: {
    ...parserFailureSummary,
    json: true,
  },
} as const satisfies CliTaskPlanPlannerIntegrationResult;

const validationFailureIssue = {
  code: "cli_task_plan_validation_failed",
  message: "The parsed task contract did not pass validation.",
  severity: "error",
  phase: "validation",
  taskId,
  sourceFile: taskFile,
  field: "validation",
} as const satisfies CliTaskPlanPlannerIntegrationIssue;

const validationFailedParser = {
  ...parserOk,
  ok: false,
  validationStatus: "fail",
  validationCompatible: false,
  issues: [validationFailureIssue],
} as const satisfies CliTaskPlanParserIntegrationStage;

export const scenarioDValidationFailure = {
  ok: false,
  status: "validation_failed",
  exitCode: "validation_failure",
  taskId,
  mode: "plan",
  sourceFile: taskFile,
  parser: validationFailedParser,
  mapping: mappingNotAttempted,
  wiring: wiringNotAttempted,
  planner: plannerNotAttempted,
  safety: safetyNoSideEffects,
  jsonOnly: jsonOnlyOff,
  issues: [validationFailureIssue],
  summary: {
    ...parserFailureSummary,
    parsed: true,
  },
} as const satisfies CliTaskPlanPlannerIntegrationResult;

const unsupportedMappingIssue = {
  code: "cli_task_plan_mapping_unsupported",
  message: "The parsed task contract cannot be mapped to runner planning input.",
  severity: "error",
  phase: "mapping",
  taskId,
  sourceFile: taskFile,
  field: "mapping.status",
} as const satisfies CliTaskPlanPlannerIntegrationIssue;

const unsupportedMapping = {
  attempted: true,
  ok: false,
  status: "unsupported",
  runnerPlanningInputAvailable: false,
  noExecution: true,
  noWrites: true,
  verifierRequired: true,
  completionGatedByVerifier: true,
  issues: [unsupportedMappingIssue],
} as const satisfies CliTaskPlanMappingIntegrationStage;

export const scenarioEUnsupportedMapping = {
  ok: false,
  status: "unsupported_mapping",
  exitCode: "unsupported_mapping",
  taskId,
  mode: "plan",
  sourceFile: taskFile,
  parser: parserOk,
  mapping: unsupportedMapping,
  wiring: wiringNotAttempted,
  planner: plannerNotAttempted,
  safety: safetyNoSideEffects,
  jsonOnly: jsonOnlyOff,
  issues: [unsupportedMappingIssue],
  summary: {
    ...parserFailureSummary,
    parsed: true,
    issueCount: 1,
    verifierRequired: true,
    completionGatedByVerifier: true,
  },
} as const satisfies CliTaskPlanPlannerIntegrationResult;

const missingRunnerPlanningInputIssue = {
  code: "cli_task_plan_runner_planning_input_missing",
  message:
    "Mapping did not produce runnerPlanningInput; wiring and planning remain blocked.",
  severity: "error",
  phase: "mapping",
  taskId,
  sourceFile: taskFile,
  field: "mapping.runnerPlanningInput",
} as const satisfies CliTaskPlanPlannerIntegrationIssue;

const mappingWithoutRunnerPlanningInput = {
  attempted: true,
  ok: true,
  status: "mapped",
  runnerPlanningInputAvailable: false,
  noExecution: true,
  noWrites: true,
  verifierRequired: true,
  completionGatedByVerifier: true,
  issues: [missingRunnerPlanningInputIssue],
} as const satisfies CliTaskPlanMappingIntegrationStage;

export const scenarioFMissingRunnerPlanningInput = {
  ok: false,
  status: "mapping_failed",
  exitCode: "mapping_failure",
  taskId,
  mode: "plan",
  sourceFile: taskFile,
  parser: parserOk,
  mapping: mappingWithoutRunnerPlanningInput,
  wiring: wiringBlocked,
  planner: plannerNotAttempted,
  safety: safetyNoSideEffects,
  jsonOnly: jsonOnlyOff,
  issues: [missingRunnerPlanningInputIssue],
  summary: {
    ...parserFailureSummary,
    parsed: true,
    mapped: true,
    verifierRequired: true,
    completionGatedByVerifier: true,
  },
} as const satisfies CliTaskPlanPlannerIntegrationResult;

const missingVerifierGateIssue = {
  code: "cli_task_plan_verifier_gate_missing",
  message:
    "Completion must remain gated by verifier requirements before planning is allowed.",
  severity: "critical",
  phase: "safety",
  taskId,
  sourceFile: taskFile,
  field: "mapping.completionGatedByVerifier",
} as const satisfies CliTaskPlanPlannerIntegrationIssue;

const mappingWithoutVerifierGate = {
  ...mappingOk,
  verifierRequired: false,
  completionGatedByVerifier: false,
  issues: [missingVerifierGateIssue],
} as const satisfies CliTaskPlanMappingIntegrationStage;

export const scenarioGMissingVerifierGate = {
  ok: false,
  status: "blocked",
  exitCode: "blocked",
  taskId,
  mode: "plan",
  sourceFile: taskFile,
  parser: parserOk,
  mapping: mappingWithoutVerifierGate,
  wiring: wiringBlocked,
  planner: plannerNotAttempted,
  safety: {
    ...safetyNoSideEffects,
    issues: [missingVerifierGateIssue],
  },
  jsonOnly: jsonOnlyOff,
  issues: [missingVerifierGateIssue],
  summary: {
    ...parserFailureSummary,
    parsed: true,
    mapped: true,
    runnerPlanningInputAvailable: true,
  },
} as const satisfies CliTaskPlanPlannerIntegrationResult;

const missingNoExecutionNoWritesIssue = {
  code: "cli_task_plan_no_execution_no_writes_missing",
  message:
    "The integration must fail closed when noExecution or noWrites cannot be proven true.",
  severity: "critical",
  phase: "safety",
  taskId,
  sourceFile: taskFile,
  field: "input.noExecution",
  metadata: {
    representedNoExecution: false,
    representedNoWrites: false,
  },
} as const satisfies CliTaskPlanPlannerIntegrationIssue;

export const scenarioHMissingNoExecutionNoWrites = {
  ok: false,
  status: "blocked",
  exitCode: "blocked",
  taskId,
  mode: "plan",
  sourceFile: taskFile,
  parser: parserOk,
  mapping: mappingOk,
  wiring: wiringBlocked,
  planner: plannerNotAttempted,
  safety: {
    ...safetyNoSideEffects,
    filesystemMutation: false,
    issues: [missingNoExecutionNoWritesIssue],
  },
  jsonOnly: jsonOnlyOff,
  issues: [missingNoExecutionNoWritesIssue],
  summary: {
    ...parserFailureSummary,
    parsed: true,
    mapped: true,
    runnerPlanningInputAvailable: true,
    verifierRequired: true,
    completionGatedByVerifier: true,
  },
} as const satisfies CliTaskPlanPlannerIntegrationResult;

const unsafeMetadataIssue = {
  code: "cli_task_plan_unsafe_represented_metadata",
  message:
    "Represented metadata claims verifier execution, filesystem mutation, or completed state.",
  severity: "critical",
  phase: "safety",
  taskId,
  sourceFile: taskFile,
  field: "metadata",
  metadata: {
    representedUnsafeTruths: [
      "verifierRun",
      "filesystemMutation",
      "completedStateCreated",
    ],
  },
} as const satisfies CliTaskPlanPlannerIntegrationIssue;

export const scenarioIUnsafeRepresentedMetadata = {
  ok: false,
  status: "blocked",
  exitCode: "blocked",
  taskId,
  mode: "plan",
  sourceFile: taskFile,
  parser: parserOk,
  mapping: mappingOk,
  wiring: {
    ...wiringBlocked,
    plannerInvocationAllowed: false,
  },
  planner: plannerNotAttempted,
  safety: {
    ...safetyNoSideEffects,
    failClosedOnUnsafeMetadata: true,
    issues: [unsafeMetadataIssue],
  },
  jsonOnly: jsonOnlyOff,
  issues: [unsafeMetadataIssue],
  summary: {
    ...parserFailureSummary,
    parsed: true,
    mapped: true,
    runnerPlanningInputAvailable: true,
    verifierRequired: true,
    completionGatedByVerifier: true,
  },
} as const satisfies CliTaskPlanPlannerIntegrationResult;

const plannerFailureIssue = {
  code: "cli_task_plan_planner_failed",
  message: "The dependency-injected planner returned a failed plan result.",
  severity: "error",
  phase: "planner",
  taskId,
  sourceFile: taskFile,
  field: "planner",
} as const satisfies CliTaskPlanPlannerIntegrationIssue;

const plannerFailed = {
  attempted: true,
  ok: false,
  status: "failed",
  plannerDependencyReference: {
    id: "dependency-injected-planner:TASK-0265",
  },
  planStepCount: 0,
  issues: [plannerFailureIssue],
} as const satisfies CliTaskPlanPlannerIntegrationStage;

export const scenarioJPlannerFailure = {
  ok: false,
  status: "planner_failed",
  exitCode: "planner_failure",
  taskId,
  mode: "plan",
  sourceFile: taskFile,
  parser: parserOk,
  mapping: mappingOk,
  wiring: wiringOk,
  planner: plannerFailed,
  safety: safetyNoSideEffects,
  jsonOnly: jsonOnlyOff,
  issues: [plannerFailureIssue],
  summary: {
    ...parserFailureSummary,
    parsed: true,
    mapped: true,
    wired: true,
    runnerPlanningInputAvailable: true,
    plannerDependencyInjected: true,
    plannerInvocationAllowed: true,
    verifierRequired: true,
    completionGatedByVerifier: true,
  },
} as const satisfies CliTaskPlanPlannerIntegrationResult;

export const scenarioKHumanRenderModel = {
  title: "CLI Task Plan Planner Integration",
  taskId,
  sourceFile: taskFile,
  mode: "plan",
  parsed: true,
  mapping: "mapped",
  planning: "planned",
  workItems: 1,
  batches: 1,
  steps: 3,
  policyRequired: true,
  approvalRequired: false,
  verifierRequired: true,
  completionGatedByVerifier: true,
  auditExpected: true,
  realExecution: false,
  adapterCalls: false,
  auditWrites: false,
  verifierRun: false,
  persistence: false,
  filesystemMutation: false,
  completedStateCreated: false,
  issues: noIssues,
} as const satisfies CliTaskPlanHumanRenderModel;

export const scenarioLJsonRenderModel = {
  ok: true,
  status: "planned",
  exitCode: "success",
  taskId,
  mode: "plan",
  sourceFile: taskFile,
  parse: parserOk,
  mapping: mappingOk,
  wiring: wiringOk,
  plan: plannerOk,
  safety: safetyNoSideEffects,
  issues: noIssues,
  summary: successfulSummary,
} as const satisfies CliTaskPlanJsonRenderModel;

export const scenarioMJsonOnlyFailureBehavior = {
  ok: false,
  status: "parser_failed",
  exitCode: "parser_failure",
  mode: "plan",
  sourceFile: taskFile,
  parser: parserFailed,
  mapping: mappingNotAttempted,
  wiring: wiringNotAttempted,
  planner: plannerNotAttempted,
  safety: safetyNoSideEffects,
  jsonOutput: {
    ok: false,
    status: "parser_failed",
    exitCode: "parser_failure",
    mode: "plan",
    sourceFile: taskFile,
    parse: parserFailed,
    mapping: mappingNotAttempted,
    wiring: wiringNotAttempted,
    plan: plannerNotAttempted,
    safety: safetyNoSideEffects,
    issues: [parserFailureIssue],
    summary: {
      ...parserFailureSummary,
      json: true,
    },
  },
  jsonOnly: jsonOnlyOn,
  issues: [parserFailureIssue],
  summary: {
    ...parserFailureSummary,
    json: true,
  },
} as const satisfies CliTaskPlanPlannerIntegrationResult;

export const scenarioNSummaryShape = {
  parsed: true,
  mapped: true,
  wired: true,
  planned: true,
  workItemCount: 1,
  batchCount: 1,
  planStepCount: 3,
  issueCount: 0,
  json: false,
  noExecution: true,
  noWrites: true,
  executionEnabled: false,
  adapterCalls: false,
  auditWrites: false,
  verifierRun: false,
  persistence: false,
  filesystemMutation: false,
  completedStateCreated: false,
  verifierRequired: true,
  completionGatedByVerifier: true,
  runnerPlanningInputAvailable: true,
  plannerDependencyInjected: true,
  plannerInvocationAllowed: true,
} as const satisfies CliTaskPlanPlannerIntegrationSummary;

export const scenarioOExitCodeExamples = {
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
} as const satisfies Record<
  CliTaskPlanPlannerIntegrationStatus,
  CliTaskPlanExitCode
>;

export const scenarioPSafetyStage = {
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
  failClosedWithoutRunnerPlanningInput: true,
  failClosedWithoutNoExecution: true,
  failClosedWithoutNoWrites: true,
  failClosedWithoutVerifierRequired: true,
  failClosedWithoutCompletionGate: true,
  failClosedOnUnsafeMetadata: true,
  dependencyInjectedPlannerOnly: true,
  topLevelPlannerInputBypassAllowed: false,
  issues: noIssues,
} as const satisfies CliTaskPlanSafetyIntegrationStage;

export const cliTaskPlanPlannerIntegrationInputExample = {
  argv: ["plan", taskFile],
  command: ["aeos", "task-plan"],
  taskFile,
  json: false,
  mode: "plan",
  parserRequest: {
    inputPath: taskFile,
    currentWorkingDirectory: "/workspace",
    mode: "plan",
    options: {
      allowAbsolutePath: false,
      allowParentTraversal: false,
      requireJsonObject: true,
      validateContract: true,
      createPlanningHandoff: true,
      noExecution: true,
      noWrites: true,
      trustModelSelfReporting: false,
    },
    expectedFormat: "json",
    noExecution: true,
    noWrites: true,
  },
  mappingOptions: {
    allowSingleWorkItemFallback: true,
    requireExplicitWorkItems: false,
    requireVerifier: true,
    createDefaultBatch: true,
    createAuditExpectations: true,
    createPolicyBoundary: true,
    createAdapterBoundary: true,
  },
  parserResultReference: {
    id: "parser-result:TASK-0265",
    path: taskFile,
  },
  mappingResultReference: {
    id: "mapping-result:TASK-0265",
    path: taskFile,
  },
  wiringResultReference: {
    id: "wiring-result:TASK-0265",
    path: taskFile,
  },
  plannerDependencyReference: {
    id: "dependency-injected-planner:TASK-0265",
  },
  noExecution: true,
  noWrites: true,
} as const satisfies CliTaskPlanPlannerIntegrationInput;

export const cliTaskPlanPlannerIntegrationOptionsExample = {
  json: false,
  failClosedOnParserFailure: true,
  failClosedOnValidationFailure: true,
  failClosedOnUnsupportedMapping: true,
  failClosedWithoutRunnerPlanningInput: true,
  failClosedWithoutVerifier: true,
  failClosedWithoutNoExecution: true,
  failClosedWithoutNoWrites: true,
  failClosedOnUnsafeMetadata: true,
  suppressHumanOutputInJsonMode: true,
  deterministicIssues: true,
} as const satisfies CliTaskPlanPlannerIntegrationOptions;
