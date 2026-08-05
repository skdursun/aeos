import type {
  AgenticRunnerPlanningInput,
  AgenticRunnerPlanningReference,
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
  TaskPlanFilePlannerWiringMode,
  TaskPlanFilePlannerWiringOptions,
  TaskPlanFilePlannerWiringResult,
  TaskPlanFilePlannerWiringStatus,
  TaskPlanFilePlannerWiringSummary,
  TaskPlanFileSafetyStage,
} from "./task-plan-file-planner-wiring.js";

const taskId = "TASK-0255";
const taskFile = "TASKS/TASK-0255.json";

const taskReference = {
  id: "task-contract:TASK-0255",
  path: taskFile,
} satisfies AgenticRunnerPlanningReference;

const planningInputReference = {
  id: "runner-planning-input:TASK-0255",
  path: taskFile,
} satisfies AgenticRunnerPlanningReference;

const planningResultReference = {
  id: "runner-planning-result:TASK-0255",
  path: taskFile,
  metadata: {
    executionDeferred: true,
    noExecution: true,
    noWrites: true,
  },
} satisfies AgenticRunnerPlanningReference;

const planningInput = {
  taskId,
  mode: "plan",
  taskContract: {
    kind: "reference",
    reference: taskReference,
  },
  options: {
    requireVerifier: true,
    requireAudit: true,
    outputMode: "json",
  },
  metadata: {
    parserExecutedHere: false,
    mapperExecutedHere: false,
    plannerExecutedHere: false,
    noExecution: true,
    noWrites: true,
  },
} satisfies AgenticRunnerPlanningInput;

export const taskPlanFilePlannerWiringModeExample =
  "plan" satisfies TaskPlanFilePlannerWiringMode;

export const taskPlanFilePlannerWiringStatusExample =
  "planned" satisfies TaskPlanFilePlannerWiringStatus;

export const taskPlanFilePlannerExitCodeExample =
  "success" satisfies TaskPlanFilePlannerExitCode;

export const taskPlanFilePlannerWiringIssueSeverityExample =
  "error" satisfies TaskPlanFilePlannerWiringIssueSeverity;

export const taskPlanFilePlannerWiringIssuePhaseExample =
  "safety" satisfies TaskPlanFilePlannerWiringIssuePhase;

export const taskPlanFilePlannerWiringOptionsExample = {
  json: true,
  allowSingleWorkItemFallback: true,
  requireExplicitWorkItems: false,
  requireVerifier: true,
  createDefaultBatch: true,
  createAuditExpectations: true,
  failClosedOnUnsupportedMapping: true,
  failClosedWithoutPlanningInput: true,
  failClosedWithoutVerifier: true,
  failClosedWithoutNoExecution: true,
  failClosedWithoutNoWrites: true,
} satisfies TaskPlanFilePlannerWiringOptions;

export const taskPlanFilePlannerWiringInputExample = {
  taskFile,
  argv: ["--json", taskFile],
  json: true,
  mode: "plan",
  plannerInput: planningInput,
  plannerOptions: planningInput.options,
  noExecution: true,
  noWrites: true,
} satisfies TaskPlanFilePlannerWiringInput;

const parserIssue = {
  code: "task_plan_file_parse_failed",
  message: "The task plan file could not be parsed as a task contract.",
  severity: "error",
  phase: "parse",
  taskId,
  sourceFile: taskFile,
} satisfies TaskPlanFilePlannerWiringIssue;

const validationIssue = {
  code: "task_plan_file_validation_failed",
  message: "The parsed task contract is not validation-compatible.",
  severity: "error",
  phase: "validation",
  taskId,
  sourceFile: taskFile,
  field: "validation.status",
} satisfies TaskPlanFilePlannerWiringIssue;

const unsupportedMappingIssue = {
  code: "task_contract_mapping_unsupported",
  message: "The parsed task contract cannot be mapped into runner planning input.",
  severity: "error",
  phase: "mapping",
  taskId,
  sourceFile: taskFile,
} satisfies TaskPlanFilePlannerWiringIssue;

const missingVerifierGateIssue = {
  code: "task_contract_mapping_missing_verifier_gate",
  message: "Mapping is fail-closed because verifier-gated completion is absent.",
  severity: "critical",
  phase: "safety",
  taskId,
  sourceFile: taskFile,
  field: "mapping.verifier",
} satisfies TaskPlanFilePlannerWiringIssue;

const missingNoExecutionNoWritesIssue = {
  code: "task_contract_mapping_missing_no_execution_or_no_writes",
  message:
    "Mapping is fail-closed because source safety handoff did not prove no-execution and no-write guarantees.",
  severity: "critical",
  phase: "safety",
  taskId,
  sourceFile: taskFile,
  metadata: {
    sourceNoExecution: false,
    sourceNoWrites: false,
    representedByFailClosedFlags: true,
  },
} satisfies TaskPlanFilePlannerWiringIssue;

const plannerIssue = {
  code: "task_plan_file_planner_failed",
  message: "Planner handoff failed before any runner execution.",
  severity: "error",
  phase: "planner",
  taskId,
  sourceFile: taskFile,
  sourceReference: planningInputReference,
} satisfies TaskPlanFilePlannerWiringIssue;

export const taskPlanFilePlannerWiringIssueExample =
  missingVerifierGateIssue satisfies TaskPlanFilePlannerWiringIssue;

const successfulParseStage = {
  attempted: true,
  ok: true,
  sourceFile: taskFile,
  pathOk: true,
  parseOk: true,
  validationStatus: "pass",
  validationCompatible: true,
  parsedTaskReference: taskReference,
  failClosedWithoutParserOk: false,
  failClosedWithoutValidationOk: false,
  issues: [],
} satisfies TaskPlanFileParseStage;

const parserFailureParseStage = {
  attempted: true,
  ok: false,
  sourceFile: taskFile,
  pathOk: true,
  parseOk: false,
  validationStatus: "not_requested",
  validationCompatible: false,
  failClosedWithoutParserOk: true,
  failClosedWithoutValidationOk: true,
  issues: [parserIssue],
} satisfies TaskPlanFileParseStage;

const validationFailureParseStage = {
  attempted: true,
  ok: false,
  sourceFile: taskFile,
  pathOk: true,
  parseOk: true,
  validationStatus: "fail",
  validationCompatible: false,
  parsedTaskReference: taskReference,
  failClosedWithoutParserOk: false,
  failClosedWithoutValidationOk: true,
  issues: [validationIssue],
} satisfies TaskPlanFileParseStage;

const successfulMappingStage = {
  attempted: true,
  ok: true,
  status: "mapped",
  planningInput,
  planningInputReference,
  planningInputAvailable: true,
  noExecution: true,
  noWrites: true,
  verifierRequired: true,
  completionGatedByVerifier: true,
  failClosedWithoutMappedStatus: false,
  failClosedWithoutPlanningInput: false,
  failClosedWithoutNoExecution: false,
  failClosedWithoutNoWrites: false,
  failClosedWithoutVerifierRequired: false,
  failClosedWithoutCompletionGate: false,
  issues: [],
} satisfies TaskPlanFileMappingStage;

const notAttemptedMappingStage = {
  attempted: false,
  ok: false,
  status: "not_attempted",
  planningInputAvailable: false,
  noExecution: true,
  noWrites: true,
  verifierRequired: false,
  completionGatedByVerifier: false,
  failClosedWithoutMappedStatus: true,
  failClosedWithoutPlanningInput: true,
  failClosedWithoutNoExecution: false,
  failClosedWithoutNoWrites: false,
  failClosedWithoutVerifierRequired: true,
  failClosedWithoutCompletionGate: true,
  issues: [],
} satisfies TaskPlanFileMappingStage;

const unsupportedMappingStage = {
  attempted: true,
  ok: false,
  status: "unsupported",
  planningInputAvailable: false,
  noExecution: true,
  noWrites: true,
  verifierRequired: true,
  completionGatedByVerifier: true,
  failClosedWithoutMappedStatus: true,
  failClosedWithoutPlanningInput: true,
  failClosedWithoutNoExecution: false,
  failClosedWithoutNoWrites: false,
  failClosedWithoutVerifierRequired: false,
  failClosedWithoutCompletionGate: false,
  issues: [unsupportedMappingIssue],
} satisfies TaskPlanFileMappingStage;

const mappingWithoutVerifierGateStage = {
  attempted: true,
  ok: false,
  status: "blocked",
  planningInput,
  planningInputReference,
  planningInputAvailable: true,
  noExecution: true,
  noWrites: true,
  verifierRequired: false,
  completionGatedByVerifier: false,
  failClosedWithoutMappedStatus: false,
  failClosedWithoutPlanningInput: false,
  failClosedWithoutNoExecution: false,
  failClosedWithoutNoWrites: false,
  failClosedWithoutVerifierRequired: true,
  failClosedWithoutCompletionGate: true,
  issues: [missingVerifierGateIssue],
} satisfies TaskPlanFileMappingStage;

const mappingWithoutNoExecutionNoWritesStage = {
  attempted: true,
  ok: false,
  status: "blocked",
  planningInputAvailable: false,
  noExecution: true,
  noWrites: true,
  verifierRequired: true,
  completionGatedByVerifier: true,
  failClosedWithoutMappedStatus: false,
  failClosedWithoutPlanningInput: true,
  failClosedWithoutNoExecution: true,
  failClosedWithoutNoWrites: true,
  failClosedWithoutVerifierRequired: false,
  failClosedWithoutCompletionGate: false,
  issues: [missingNoExecutionNoWritesIssue],
} satisfies TaskPlanFileMappingStage;

const successfulPlannerStage = {
  attempted: true,
  ok: true,
  status: "planned",
  planningInput,
  planningInputReference,
  planningResultReference,
  planStepCount: 3,
  plannerExecuted: false,
  issues: [],
} satisfies TaskPlanFilePlannerStage;

const notAttemptedPlannerStage = {
  attempted: false,
  ok: false,
  status: "not_attempted",
  plannerExecuted: false,
  issues: [],
} satisfies TaskPlanFilePlannerStage;

const failedPlannerStage = {
  attempted: true,
  ok: false,
  status: "failed",
  planningInput,
  planningInputReference,
  planStepCount: 0,
  plannerExecuted: false,
  issues: [plannerIssue],
} satisfies TaskPlanFilePlannerStage;

const safeNoExecutionStage = {
  executionEnabled: false,
  adapterCalls: false,
  auditWrites: false,
  verifierRun: false,
  persistence: false,
  filesystemMutation: false,
  completedStateCreated: false,
  plannerMayRunLater: true,
  parserExecutedHere: false,
  mapperExecutedHere: false,
  plannerExecutedHere: false,
  noExecution: true,
  noWrites: true,
  issues: [],
} satisfies TaskPlanFileSafetyStage;

const blockedSafetyStage = {
  executionEnabled: false,
  adapterCalls: false,
  auditWrites: false,
  verifierRun: false,
  persistence: false,
  filesystemMutation: false,
  completedStateCreated: false,
  plannerMayRunLater: false,
  parserExecutedHere: false,
  mapperExecutedHere: false,
  plannerExecutedHere: false,
  noExecution: true,
  noWrites: true,
  issues: [missingNoExecutionNoWritesIssue],
} satisfies TaskPlanFileSafetyStage;

export const taskPlanFileParseStageExample =
  successfulParseStage satisfies TaskPlanFileParseStage;

export const taskPlanFileMappingStageExample =
  successfulMappingStage satisfies TaskPlanFileMappingStage;

export const taskPlanFilePlannerStageExample =
  successfulPlannerStage satisfies TaskPlanFilePlannerStage;

export const taskPlanFileSafetyStageExample =
  safeNoExecutionStage satisfies TaskPlanFileSafetyStage;

const successfulSummary = {
  parsed: true,
  mapped: true,
  planned: true,
  workItemCount: 1,
  batchCount: 1,
  planStepCount: 3,
  issueCount: 0,
  json: true,
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
  mappingSupported: true,
  planningInputAvailable: true,
} satisfies TaskPlanFilePlannerWiringSummary;

export const taskPlanFilePlannerWiringSummaryExample =
  successfulSummary satisfies TaskPlanFilePlannerWiringSummary;

export const successfulMinimalPlannerWiringResultExample = {
  ok: true,
  status: "planned",
  exitCode: "success",
  taskId,
  mode: "plan",
  sourceFile: taskFile,
  parse: successfulParseStage,
  mapping: successfulMappingStage,
  planner: successfulPlannerStage,
  safety: safeNoExecutionStage,
  issues: [],
  summary: successfulSummary,
} satisfies TaskPlanFilePlannerWiringResult;

export const parserFailurePlannerWiringResultExample = {
  ok: false,
  status: "parser_failed",
  exitCode: "parser_failure",
  taskId,
  mode: "plan",
  sourceFile: taskFile,
  parse: parserFailureParseStage,
  mapping: notAttemptedMappingStage,
  planner: notAttemptedPlannerStage,
  safety: {
    ...blockedSafetyStage,
    issues: [parserIssue],
  },
  issues: [parserIssue],
  summary: {
    ...successfulSummary,
    parsed: false,
    mapped: false,
    planned: false,
    workItemCount: 0,
    batchCount: 0,
    planStepCount: 0,
    issueCount: 1,
    mappingSupported: false,
    planningInputAvailable: false,
  },
} satisfies TaskPlanFilePlannerWiringResult;

export const validationFailurePlannerWiringResultExample = {
  ok: false,
  status: "validation_failed",
  exitCode: "validation_failure",
  taskId,
  mode: "plan",
  sourceFile: taskFile,
  parse: validationFailureParseStage,
  mapping: notAttemptedMappingStage,
  planner: notAttemptedPlannerStage,
  safety: {
    ...blockedSafetyStage,
    issues: [validationIssue],
  },
  issues: [validationIssue],
  summary: {
    ...successfulSummary,
    parsed: false,
    mapped: false,
    planned: false,
    workItemCount: 0,
    batchCount: 0,
    planStepCount: 0,
    issueCount: 1,
    mappingSupported: false,
    planningInputAvailable: false,
  },
} satisfies TaskPlanFilePlannerWiringResult;

export const unsupportedMappingPlannerWiringResultExample = {
  ok: false,
  status: "unsupported_mapping",
  exitCode: "unsupported_mapping",
  taskId,
  mode: "plan",
  sourceFile: taskFile,
  parse: successfulParseStage,
  mapping: unsupportedMappingStage,
  planner: notAttemptedPlannerStage,
  safety: {
    ...blockedSafetyStage,
    issues: [unsupportedMappingIssue],
  },
  issues: [unsupportedMappingIssue],
  summary: {
    ...successfulSummary,
    mapped: false,
    planned: false,
    workItemCount: 0,
    batchCount: 0,
    planStepCount: 0,
    issueCount: 1,
    mappingSupported: false,
    planningInputAvailable: false,
  },
} satisfies TaskPlanFilePlannerWiringResult;

export const mappingWithoutVerifierGatePlannerWiringResultExample = {
  ok: false,
  status: "blocked",
  exitCode: "blocked",
  taskId,
  mode: "plan",
  sourceFile: taskFile,
  parse: successfulParseStage,
  mapping: mappingWithoutVerifierGateStage,
  planner: notAttemptedPlannerStage,
  safety: {
    ...blockedSafetyStage,
    issues: [missingVerifierGateIssue],
  },
  issues: [missingVerifierGateIssue],
  summary: {
    ...successfulSummary,
    mapped: false,
    planned: false,
    workItemCount: 0,
    batchCount: 0,
    planStepCount: 0,
    issueCount: 1,
    verifierRequired: false,
    completionGatedByVerifier: false,
  },
} satisfies TaskPlanFilePlannerWiringResult;

export const mappingWithoutNoExecutionNoWritesPlannerWiringResultExample = {
  ok: false,
  status: "blocked",
  exitCode: "blocked",
  taskId,
  mode: "plan",
  sourceFile: taskFile,
  parse: successfulParseStage,
  mapping: mappingWithoutNoExecutionNoWritesStage,
  planner: notAttemptedPlannerStage,
  safety: blockedSafetyStage,
  issues: [missingNoExecutionNoWritesIssue],
  summary: {
    ...successfulSummary,
    mapped: false,
    planned: false,
    workItemCount: 0,
    batchCount: 0,
    planStepCount: 0,
    issueCount: 1,
    planningInputAvailable: false,
  },
} satisfies TaskPlanFilePlannerWiringResult;

export const plannerFailurePlannerWiringResultExample = {
  ok: false,
  status: "planner_failed",
  exitCode: "planner_failure",
  taskId,
  mode: "plan",
  sourceFile: taskFile,
  parse: successfulParseStage,
  mapping: successfulMappingStage,
  planner: failedPlannerStage,
  safety: {
    ...blockedSafetyStage,
    issues: [plannerIssue],
  },
  issues: [plannerIssue],
  summary: {
    ...successfulSummary,
    planned: false,
    planStepCount: 0,
    issueCount: 1,
  },
} satisfies TaskPlanFilePlannerWiringResult;

export const humanOutputShapeExample = {
  title: "Task plan file planner wiring",
  taskId,
  sourceFile: taskFile,
  mode: "plan",
  parsed: true,
  mapping: "mapped",
  planning: "planned",
  workItems: 1,
  batches: 1,
  steps: 3,
  policy: "not_evaluated",
  approvalRequired: false,
  verifierRequired: true,
  completionGatedByVerifier: true,
  auditExpected: true,
  realExecution: false,
  adapterCalls: false,
  auditWrites: false,
  verifierRun: false,
  persistence: false,
  issues: [],
} satisfies TaskPlanFileHumanOutput;

export const jsonOutputShapeExample = {
  ok: true,
  status: "planned",
  exitCode: "success",
  taskId,
  mode: "plan",
  sourceFile: taskFile,
  parse: successfulParseStage,
  mapping: successfulMappingStage,
  plan: successfulPlannerStage,
  policy: [],
  verifier: {
    verifierRequired: true,
    expectedCoverageRule:
      "expected_items == completed_items + explicitly_failed_items + explicitly_skipped_items",
    completionGatedByVerifier: true,
    issues: [],
  },
  audit: {
    expectedAuditEventIds: ["audit:TASK-0255:plan"],
    requiredEventKinds: ["plan_created"],
    auditRequired: true,
    issues: [],
  },
  resume: {
    nextStepId: "policy-preflight",
    nextBatchId: "batch:TASK-0255:default",
    pendingWorkItemIds: ["work-item:TASK-0255"],
    retryableWorkItemIds: [],
    updatedAt: "2026-08-05T00:00:00.000Z",
  },
  executionEnabled: false,
  adapterCalls: false,
  auditWrites: false,
  verifierRun: false,
  persistence: false,
  issues: [],
  summary: successfulSummary,
} satisfies TaskPlanFileJsonOutput;

export const summaryShapeExample = {
  parsed: true,
  mapped: true,
  planned: true,
  workItemCount: 1,
  batchCount: 1,
  planStepCount: 3,
  issueCount: 0,
  json: true,
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
  mappingSupported: true,
  planningInputAvailable: true,
} satisfies TaskPlanFilePlannerWiringSummary;

export const safetyStageExplicitFalseFlagsExample = {
  executionEnabled: false,
  adapterCalls: false,
  auditWrites: false,
  verifierRun: false,
  persistence: false,
  filesystemMutation: false,
  completedStateCreated: false,
  plannerMayRunLater: false,
  parserExecutedHere: false,
  mapperExecutedHere: false,
  plannerExecutedHere: false,
  noExecution: true,
  noWrites: true,
  issues: [],
} satisfies TaskPlanFileSafetyStage;

export const jsonOnlyParserFailureOutputExample = {
  ok: false,
  status: "parser_failed",
  exitCode: "parser_failure",
  taskId,
  mode: "plan",
  sourceFile: taskFile,
  parse: parserFailureParseStage,
  mapping: notAttemptedMappingStage,
  plan: notAttemptedPlannerStage,
  executionEnabled: false,
  adapterCalls: false,
  auditWrites: false,
  verifierRun: false,
  persistence: false,
  issues: [parserIssue],
  summary: {
    ...successfulSummary,
    parsed: false,
    mapped: false,
    planned: false,
    workItemCount: 0,
    batchCount: 0,
    planStepCount: 0,
    issueCount: 1,
    mappingSupported: false,
    planningInputAvailable: false,
  },
} satisfies TaskPlanFileJsonOutput;

export const jsonOnlyParserFailurePlannerWiringResultExample = {
  ok: false,
  status: "parser_failed",
  exitCode: "parser_failure",
  taskId,
  mode: "plan",
  sourceFile: taskFile,
  parse: parserFailureParseStage,
  mapping: notAttemptedMappingStage,
  planner: notAttemptedPlannerStage,
  safety: {
    ...blockedSafetyStage,
    issues: [parserIssue],
  },
  jsonOutput: jsonOnlyParserFailureOutputExample,
  issues: [parserIssue],
  summary: jsonOnlyParserFailureOutputExample.summary,
} satisfies TaskPlanFilePlannerWiringResult;
