import type {
  TaskExecutionInvocationRecord,
} from "./task-execution-invocation-record.js";
import {
  validateTaskExecutionInvocationRecord,
} from "./task-execution-invocation-record.js";
import type { TaskExecutionAuditEvent } from "./task-execution-audit.js";
import type {
  TaskExecutionPermissionGateResult,
  TaskExecutionPermissionKind,
} from "./task-execution-permission-gate.js";
import type {
  TaskExecutionWorkerAdapter,
  TaskExecutionWorkerCapabilities,
  TaskExecutionWorkerConformanceInput,
  TaskExecutionWorkerConformanceResult,
  TaskExecutionWorkerIdentity,
  TaskExecutionWorkerIssue,
  TaskExecutionWorkerRawResult,
  TaskExecutionWorkerRequest,
  TaskExecutionWorkerResult,
  TaskExecutionWorkerWorkspaceReference,
} from "./task-execution-worker.js";
import {
  evaluateTaskExecutionWorkerConformance,
  normalizeTaskExecutionWorkerResult,
  TASK_EXECUTION_WORKER_RUNTIME_EXECUTION_ENABLED,
} from "./task-execution-worker.js";
import type { AeosError, JsonObject, JsonValue } from "./types.js";

export const TASK_EXECUTION_CODEX_WORKER_REAL_EXECUTION_ENABLED = false;
export const TASK_EXECUTION_CODEX_WORKER_EXTERNAL_PROCESS_ALLOWED = false;
export const TASK_EXECUTION_CODEX_PROCESS_CONTRACT_READY = true;
export const TASK_EXECUTION_CODEX_PROCESS_BOUNDARY =
  "AUTHORIZED_LOCAL_CODEX_PROCESS";

export type TaskExecutionCodexReasoningEffort =
  | "minimal"
  | "low"
  | "medium"
  | "high";

export type TaskExecutionCodexSandboxMode = "read-only" | "workspace-write";

export type TaskExecutionCodexApprovalPolicy = "never" | "on-request";

export type TaskExecutionCodexProcessTerminationReason =
  | "exited"
  | "nonzero_exit"
  | "timeout"
  | "interrupted"
  | "signal";

export type TaskExecutionCodexWorkerIdentity = TaskExecutionWorkerIdentity & {
  readonly workerFamily: "codex";
  readonly runtimeKind: "test_worker";
};

export interface TaskExecutionCodexExecutableAuthority {
  readonly authority: "system";
  readonly executableRef: string;
  readonly executableKind: "codex_exec";
}

export interface TaskExecutionCodexModelConfiguration {
  readonly authority: "system";
  readonly model: string;
  readonly reasoningEffort: TaskExecutionCodexReasoningEffort;
}

export interface TaskExecutionCodexProcessPermission {
  readonly authority: "system";
  readonly permissionId: string;
  readonly requiredPermission: Extract<TaskExecutionPermissionKind, "process">;
  readonly processExecutionAllowed: boolean;
}

export interface TaskExecutionCodexWorkspaceAuthority
  extends TaskExecutionWorkerWorkspaceReference {
  readonly workingDirectoryRef: string;
}

export interface TaskExecutionCodexWorkerConfiguration {
  readonly authority: "system";
  readonly identity: TaskExecutionCodexWorkerIdentity;
  readonly executable: TaskExecutionCodexExecutableAuthority;
  readonly model: TaskExecutionCodexModelConfiguration;
  readonly workspace: TaskExecutionCodexWorkspaceAuthority;
  readonly processPermission: TaskExecutionCodexProcessPermission;
  readonly futureProcessCapability: boolean;
  readonly sandboxMode: TaskExecutionCodexSandboxMode;
  readonly approvalPolicy: TaskExecutionCodexApprovalPolicy;
  readonly timeoutMs: number;
  readonly stdoutLimitBytes: number;
  readonly stderrLimitBytes: number;
  readonly structuredResultContractRef?: string;
}

export interface TaskExecutionCodexProcessRequest {
  readonly executable: TaskExecutionCodexExecutableAuthority;
  readonly argv: readonly string[];
  readonly workingDirectory: TaskExecutionCodexWorkspaceAuthority;
  readonly stdin: string;
  readonly timeoutMs: number;
  readonly stdoutLimitBytes: number;
  readonly stderrLimitBytes: number;
  readonly environment: {
    readonly authority: "system";
    readonly variables: readonly [];
  };
}

export interface TaskExecutionCodexPreparedInvocation {
  readonly taskId: string;
  readonly sourceTaskRevision: number;
  readonly attemptId: string;
  readonly attemptNumber: number;
  readonly invocationId: string;
  readonly idempotencyKey: string;
  readonly workItemId: string | null;
  readonly batchId: string | null;
  readonly workerIdentity: TaskExecutionCodexWorkerIdentity;
  readonly processRequest: TaskExecutionCodexProcessRequest;
  readonly exactWorkerSelected: boolean;
  readonly invocationAuthorityBound: boolean;
  readonly workspaceAuthorityBound: boolean;
  readonly futureProcessCapabilityDeclared: boolean;
  readonly processPermissionAllowed: boolean;
  readonly permissionFactsAllowed: boolean;
  readonly runnable: boolean;
  readonly realExecutionEnabled: false;
}

export interface TaskExecutionCodexProcessResult {
  readonly invocationRef: string;
  readonly terminationReason: TaskExecutionCodexProcessTerminationReason;
  readonly exitCode: number | null;
  readonly signal?: string;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
  readonly interrupted: boolean;
  readonly observedAt?: string;
}

export interface TaskExecutionCodexWorkerAdapter
  extends TaskExecutionWorkerAdapter {
  readonly codexAdapterKind: "task_execution_codex_worker_adapter";
  readonly identity: TaskExecutionCodexWorkerIdentity;
  readonly capabilities: TaskExecutionWorkerCapabilities;
  readonly configuration: TaskExecutionCodexWorkerConfiguration;
  readonly processCallCount: () => number;
  readonly actualChildProcessCount: () => 0;
  readonly actualCodexCallCount: () => 0;
  readonly actualClaudeCodeCallCount: () => 0;
  readonly cloudCallCount: () => 0;
}

export interface TaskExecutionCodexWorkerConformanceInput
  extends Omit<TaskExecutionWorkerConformanceInput, "worker"> {
  readonly worker: unknown;
  readonly configuration: TaskExecutionCodexWorkerConfiguration;
  readonly taskOrModelProcessClaims?: unknown;
}

export interface TaskExecutionCodexWorkerConformanceResult {
  readonly ok: boolean;
  readonly codexWorkerConformant: boolean;
  readonly preparedInvocation: TaskExecutionCodexPreparedInvocation;
  readonly workerConformance: TaskExecutionWorkerConformanceResult | null;
  readonly normalizedResult: TaskExecutionWorkerResult | null;
  readonly issues: readonly TaskExecutionWorkerIssue[];
  readonly processCallCount: number;
  readonly actualChildProcessCount: 0;
  readonly actualCodexCallCount: 0;
  readonly actualClaudeCodeCallCount: 0;
  readonly cloudCallCount: 0;
  readonly realExecutionEnabled: false;
}

export type TaskExecutionWorkerProcessDecision =
  | "authorized"
  | "blocked";

export interface TaskExecutionWorkerProcessReadiness {
  readonly taskAuthorityReady: boolean;
  readonly attemptAuthorityReady: boolean;
  readonly invocationAuthorityReady: boolean;
  readonly workerAuthorityReady: boolean;
  readonly executableAuthorityReady: boolean;
  readonly workspaceAuthorityReady: boolean;
  readonly argvReady: boolean;
  readonly environmentReady: boolean;
  readonly outputLimitsReady: boolean;
  readonly timeoutReady: boolean;
  readonly permissionReady: boolean;
  readonly auditReady: boolean;
  readonly duplicateExecutionSafetyReady: boolean;
  readonly processContractReady: boolean;
  readonly realCodexExecutionEnabled: false;
  readonly externalProcessAllowed: false;
  readonly actualCodexCalls: 0;
  readonly actualClaudeCalls: 0;
  readonly actualWorkerProcessesSpawned: 0;
  readonly cloudCalls: 0;
}

export interface TaskExecutionWorkerProcessAuthority {
  readonly boundary: typeof TASK_EXECUTION_CODEX_PROCESS_BOUNDARY;
  readonly taskId: string;
  readonly taskRevision: number;
  readonly attemptId: string;
  readonly attemptNumber: number;
  readonly invocationId: string;
  readonly invocationRevision: number;
  readonly invocationLifecycle: "invoking";
  readonly idempotencyKey: string;
  readonly workItemId: string | null;
  readonly batchId: string | null;
  readonly workerId: string;
  readonly workerFamily: "codex";
  readonly workspaceRef: string;
  readonly projectRef: string;
  readonly executableRef: string;
  readonly executableKind: "codex_exec";
  readonly argv: readonly string[];
  readonly requiredPermissions: readonly Extract<TaskExecutionPermissionKind, "process">[];
  readonly permissionGateId: string;
  readonly preProcessAuditEventId: string;
  readonly preProcessAuditSequence: number;
  readonly stdoutLimitBytes: number;
  readonly stderrLimitBytes: number;
  readonly timeoutMs: number;
  readonly environment: {
    readonly authority: "system";
    readonly inheritance: "none";
    readonly approvedVariableRefs: readonly [];
  };
  readonly realCodexExecutionEnabled: false;
  readonly externalProcessAllowed: false;
}

export interface TaskExecutionWorkerProcessGateInput {
  readonly configuration: TaskExecutionCodexWorkerConfiguration;
  readonly request: TaskExecutionWorkerRequest;
  readonly invocationRecord: unknown;
  readonly preparedInvocation: TaskExecutionCodexPreparedInvocation;
  readonly permissionGateResult?: TaskExecutionPermissionGateResult;
  readonly preProcessAuditEvent?: TaskExecutionAuditEvent;
  readonly expectedInvocationRevision?: number;
  readonly taskOrModelProcessClaims?: unknown;
  readonly taskOrModelEnvironmentClaims?: unknown;
}

export interface TaskExecutionWorkerProcessGateResult {
  readonly ok: boolean;
  readonly decision: TaskExecutionWorkerProcessDecision;
  readonly readiness: TaskExecutionWorkerProcessReadiness;
  readonly authority: TaskExecutionWorkerProcessAuthority | null;
  readonly issues: readonly TaskExecutionWorkerIssue[];
  readonly CodexProcessContractReady: boolean;
  readonly RealCodexExecutionEnabled: false;
  readonly ExternalProcessAllowed: false;
  readonly ActualCodexCalls: 0;
  readonly ActualClaudeCalls: 0;
  readonly ActualWorkerProcessesSpawned: 0;
  readonly CloudCalls: 0;
}

const safeReferencePattern = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,255}$/;
const safeModelPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const dangerousCodexArgs = new Set([
  "--dangerously-bypass-approvals-and-sandbox",
  "danger-full-access",
  "--danger-full-access",
]);
const forbiddenArgPrefixes = [
  "--config",
  "-c",
  "--mcp",
  "--mcp-config",
  "--provider",
  "--api-key",
  "--credential",
  "--env",
];
const codexAuthorityOutputKeys = new Set(["policyauthorized"]);

function issue(input: {
  readonly code: string;
  readonly message: string;
  readonly severity?: "info" | "warning" | "error";
  readonly category?: AeosError["category"];
}): TaskExecutionWorkerIssue {
  return {
    code: input.code,
    message: input.message,
    severity: input.severity ?? "error",
    category: input.category ?? "validation",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown, depth = 0): value is JsonValue {
  if (depth > 8) {
    return false;
  }

  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.every((item) => isJsonValue(item, depth + 1));
  }

  if (isRecord(value)) {
    return Object.values(value).every((item) => isJsonValue(item, depth + 1));
  }

  return false;
}

function isJsonObject(value: unknown): value is JsonObject {
  return isRecord(value) && isJsonValue(value);
}

function canonicalKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function sanitizeCodexJsonValue(value: unknown, depth = 0): JsonValue | undefined {
  if (depth > 8) {
    return undefined;
  }

  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (Array.isArray(value)) {
    const items: JsonValue[] = [];

    for (const item of value) {
      const sanitized = sanitizeCodexJsonValue(item, depth + 1);

      if (sanitized !== undefined) {
        items.push(sanitized);
      }
    }

    return items;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  const sanitized: Record<string, JsonValue> = {};

  for (const [key, item] of Object.entries(value)) {
    if (codexAuthorityOutputKeys.has(canonicalKey(key))) {
      continue;
    }

    const sanitizedItem = sanitizeCodexJsonValue(item, depth + 1);

    if (sanitizedItem !== undefined) {
      sanitized[key] = sanitizedItem;
    }
  }

  return sanitized;
}

function isSafeReference(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value === value.trim() &&
    safeReferencePattern.test(value) &&
    value !== "." &&
    value !== ".." &&
    !value.includes("../") &&
    !value.includes("..\\") &&
    !value.startsWith("/") &&
    !/^[A-Za-z]:[\\/]/.test(value)
  );
}

function isSafeModel(value: unknown): value is string {
  return typeof value === "string" && safeModelPattern.test(value);
}

function isPositiveInteger(value: unknown, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= max;
}

function isCodexIdentity(
  identity: TaskExecutionWorkerIdentity,
): identity is TaskExecutionCodexWorkerIdentity {
  return (
    identity.workerFamily === "codex" &&
    identity.runtimeKind === "test_worker" &&
    identity.identityAuthority === "system" &&
    identity.selectionAuthority === "system"
  );
}

function validateConfiguration(
  configuration: TaskExecutionCodexWorkerConfiguration,
): readonly TaskExecutionWorkerIssue[] {
  const issues: TaskExecutionWorkerIssue[] = [];

  if (
    configuration.authority !== "system" ||
    !isCodexIdentity(configuration.identity) ||
    configuration.executable.authority !== "system" ||
    configuration.executable.executableKind !== "codex_exec" ||
    !isSafeReference(configuration.executable.executableRef) ||
    configuration.model.authority !== "system" ||
    !isSafeModel(configuration.model.model) ||
    !["minimal", "low", "medium", "high"].includes(
      configuration.model.reasoningEffort,
    ) ||
    configuration.processPermission.authority !== "system" ||
    configuration.processPermission.requiredPermission !== "process" ||
    !isSafeReference(configuration.processPermission.permissionId) ||
    typeof configuration.processPermission.processExecutionAllowed !==
      "boolean" ||
    typeof configuration.futureProcessCapability !== "boolean" ||
    !["read-only", "workspace-write"].includes(configuration.sandboxMode) ||
    !["never", "on-request"].includes(configuration.approvalPolicy) ||
    !isPositiveInteger(configuration.timeoutMs, 600000) ||
    !isPositiveInteger(configuration.stdoutLimitBytes, 65536) ||
    !isPositiveInteger(configuration.stderrLimitBytes, 32768) ||
    (configuration.structuredResultContractRef !== undefined &&
      !isSafeReference(configuration.structuredResultContractRef))
  ) {
    issues.push(
      issue({
        code: "task_execution_codex_worker_configuration_invalid",
        message:
          "Codex worker configuration must be bounded, system-owned, and TEST-only.",
      }),
    );
  }

  if (
    configuration.workspace.authority !== "system" ||
    configuration.workspace.repositoryWriteAllowed !== false ||
    !isSafeReference(configuration.workspace.workspaceRef) ||
    !isSafeReference(configuration.workspace.projectRef) ||
    !isSafeReference(configuration.workspace.workingDirectoryRef) ||
    (configuration.workspace.repositoryRef !== undefined &&
      !isSafeReference(configuration.workspace.repositoryRef)) ||
    (configuration.workspace.allowedPathRefs !== undefined &&
      !configuration.workspace.allowedPathRefs.every((item) =>
        isSafeReference(item),
      ))
  ) {
    issues.push(
      issue({
        code: "task_execution_codex_worker_workspace_authority_invalid",
        message:
          "Codex process cwd must come from bounded system workspace authority.",
        category: "permission",
      }),
    );
  }

  return issues;
}

function taskOrModelClaimIssues(
  claims: unknown,
): readonly TaskExecutionWorkerIssue[] {
  if (claims === undefined) {
    return [];
  }

  const serialized = JSON.stringify(claims);
  const issues: TaskExecutionWorkerIssue[] = [
    issue({
      code: "task_execution_codex_worker_task_model_process_claims_rejected",
      message:
        "Task or model Codex process claims are rejected; executable, argv, cwd, model, and permissions are system-owned.",
      category: "permission",
    }),
  ];

  if (
    /(^|[^A-Za-z0-9_])(?:\/bin\/sh|bash|zsh|sh)\s+-c/i.test(serialized) ||
    /(?:^|[^A-Za-z0-9_])(?:command|shell|stringCommand)(?:[^A-Za-z0-9_]|$)/i.test(
      serialized,
    )
  ) {
    issues.push(
      issue({
        code: "task_execution_codex_worker_shell_command_rejected",
        message:
          "Codex worker process preparation rejects shell strings and interactive command automation.",
        category: "permission",
      }),
    );
  }

  for (const dangerous of dangerousCodexArgs) {
    if (serialized.includes(dangerous)) {
      issues.push(
        issue({
          code: "task_execution_codex_worker_dangerous_flag_rejected",
          message:
            "Codex worker process preparation rejects sandbox bypass and full-access flags.",
          category: "permission",
        }),
      );
      break;
    }
  }

  if (/credential|api[-_]?key|token|provider|mcp|danger-full-access/i.test(serialized)) {
    issues.push(
      issue({
        code: "task_execution_codex_worker_authority_override_rejected",
        message:
          "Codex worker process preparation rejects credential, provider, MCP, and authority overrides.",
        category: "permission",
      }),
    );
  }

  return issues;
}

function buildCodexArgv(
  configuration: TaskExecutionCodexWorkerConfiguration,
): readonly string[] {
  const argv = [
    "exec",
    "--model",
    configuration.model.model,
    "--reasoning-effort",
    configuration.model.reasoningEffort,
    "--sandbox",
    configuration.sandboxMode,
    "--ask-for-approval",
    configuration.approvalPolicy,
  ];

  if (configuration.structuredResultContractRef !== undefined) {
    argv.push("--output-schema", configuration.structuredResultContractRef);
  }

  return argv;
}

function argvIssues(argv: readonly string[]): readonly TaskExecutionWorkerIssue[] {
  const issues: TaskExecutionWorkerIssue[] = [];

  if (argv.length > 16 || !argv.every((arg) => arg.length > 0 && arg.length <= 160)) {
    issues.push(
      issue({
        code: "task_execution_codex_worker_argv_unbounded",
        message: "Codex process argv must remain bounded.",
      }),
    );
  }

  for (const arg of argv) {
    if (dangerousCodexArgs.has(arg) || arg.includes("danger-full-access")) {
      issues.push(
        issue({
          code: "task_execution_codex_worker_dangerous_flag_rejected",
          message:
            "Codex process argv cannot include sandbox bypass or full-access flags.",
          category: "permission",
        }),
      );
    }

    if (
      forbiddenArgPrefixes.some(
        (prefix) => arg === prefix || arg.startsWith(`${prefix}=`),
      )
    ) {
      issues.push(
        issue({
          code: "task_execution_codex_worker_authority_override_rejected",
          message:
            "Codex process argv cannot carry config, MCP, provider, credential, or environment overrides.",
          category: "permission",
        }),
      );
    }

    if (/\s+-c\s+|[|;&<>`$]/.test(arg)) {
      issues.push(
        issue({
          code: "task_execution_codex_worker_shell_command_rejected",
          message: "Codex process argv cannot represent a shell command string.",
          category: "permission",
        }),
      );
    }
  }

  return issues;
}

function buildInstructionPayload(request: TaskExecutionWorkerRequest): string {
  return JSON.stringify({
    aeosCodexWorkerInstructionVersion: 1,
    taskId: request.taskId,
    sourceTaskRevision: request.sourceTaskRevision,
    attemptId: request.attemptId,
    attemptNumber: request.attemptNumber,
    invocationId: request.invocationId,
    idempotencyKey: request.idempotencyKey,
    workItemId: request.workItemId ?? null,
    batchId: request.batchId ?? null,
    operationKind: request.operationKind,
    workItem: request.workItemId ?? null,
    constraints: request.boundedInstructions,
    contextReferences: request.contextReferences,
    expectedEvidence: [
      "structured-result",
      "bounded-diagnostics",
      "changed-file-manifest-reference",
      "patch-artifact-reference",
      "test-summary-reference",
    ],
  });
}

function invocationRecordMatchesRequest(input: {
  readonly request: TaskExecutionWorkerRequest;
  readonly record: TaskExecutionInvocationRecord;
}): boolean {
  const { request, record } = input;

  return (
    record.taskId === request.taskId &&
    record.taskStateRevision === request.sourceTaskRevision &&
    record.attemptId === request.attemptId &&
    record.attemptNumber === request.attemptNumber &&
    record.invocationId === request.invocationId &&
    record.idempotencyKey === request.idempotencyKey &&
    (record.workItemId ?? null) === (request.workItemId ?? null) &&
    (record.batchId ?? null) === (request.batchId ?? null) &&
    record.lifecycle === "invoking"
  );
}

export function prepareTaskExecutionCodexWorkerInvocation(input: {
  readonly configuration: TaskExecutionCodexWorkerConfiguration;
  readonly request: TaskExecutionWorkerRequest;
  readonly invocationRecord: unknown;
  readonly taskOrModelProcessClaims?: unknown;
}): {
  readonly preparedInvocation: TaskExecutionCodexPreparedInvocation;
  readonly issues: readonly TaskExecutionWorkerIssue[];
} {
  const issues: TaskExecutionWorkerIssue[] = [
    ...validateConfiguration(input.configuration),
    ...taskOrModelClaimIssues(input.taskOrModelProcessClaims),
  ];
  const argv = buildCodexArgv(input.configuration);
  issues.push(...argvIssues(argv));

  const invocationValidation = validateTaskExecutionInvocationRecord(
    input.invocationRecord,
  );
  const invocationAuthorityBound =
    invocationValidation.ok &&
    invocationRecordMatchesRequest({
      request: input.request,
      record: invocationValidation.value,
    });

  if (!invocationAuthorityBound) {
    issues.push(
      issue({
        code: "task_execution_codex_worker_invocation_authority_mismatch",
        message:
          "Prepared Codex invocation must bind the exact AEOS task, revision, attempt, invocation, idempotency, work item, and batch.",
        category: "conflict",
      }),
    );
  }

  const exactWorkerSelected =
    input.request.workerIdentity.workerId === input.configuration.identity.workerId &&
    input.request.workerIdentity.workerFamily === "codex" &&
    input.configuration.identity.workerFamily === "codex" &&
    input.request.workerIdentity.runtimeKind === "test_worker";

  if (!exactWorkerSelected) {
    issues.push(
      issue({
        code: "task_execution_codex_worker_selection_mismatch",
        message:
          "Codex adapter requires exact system-selected Codex worker identity.",
        category: "permission",
      }),
    );
  }

  const workspaceAuthorityBound =
    input.request.workspace.authority === "system" &&
    input.request.workspace.workspaceRef === input.configuration.workspace.workspaceRef &&
    input.request.workspace.projectRef === input.configuration.workspace.projectRef &&
    input.configuration.workspace.workingDirectoryRef ===
      input.request.workspace.workspaceRef;

  if (!workspaceAuthorityBound) {
    issues.push(
      issue({
        code: "task_execution_codex_worker_workspace_mismatch",
        message:
          "Codex process working directory must match system-owned worker workspace authority.",
        category: "permission",
      }),
    );
  }

  if (!input.configuration.futureProcessCapability) {
    issues.push(
      issue({
        code: "task_execution_codex_worker_process_capability_missing",
        message:
          "Future Codex process execution requires a system-declared process execution capability.",
        category: "permission",
      }),
    );
  }

  if (!input.configuration.processPermission.processExecutionAllowed) {
    issues.push(
      issue({
        code: "task_execution_codex_worker_process_permission_denied",
        message:
          "Prepared Codex process requests do not grant permission to run without an explicit process permission.",
        category: "permission",
      }),
    );
  }

  const stdin = buildInstructionPayload(input.request);

  if (stdin.length > 8192) {
    issues.push(
      issue({
        code: "task_execution_codex_worker_instruction_payload_unbounded",
        message: "Codex worker instruction payload must remain bounded.",
      }),
    );
  }

  const processRequest: TaskExecutionCodexProcessRequest = {
    executable: input.configuration.executable,
    argv,
    workingDirectory: input.configuration.workspace,
    stdin,
    timeoutMs: input.configuration.timeoutMs,
    stdoutLimitBytes: input.configuration.stdoutLimitBytes,
    stderrLimitBytes: input.configuration.stderrLimitBytes,
    environment: {
      authority: "system",
      variables: [],
    },
  };
  const preparedInvocation: TaskExecutionCodexPreparedInvocation = {
    taskId: input.request.taskId,
    sourceTaskRevision: input.request.sourceTaskRevision,
    attemptId: input.request.attemptId,
    attemptNumber: input.request.attemptNumber,
    invocationId: input.request.invocationId,
    idempotencyKey: input.request.idempotencyKey,
    workItemId: input.request.workItemId ?? null,
    batchId: input.request.batchId ?? null,
    workerIdentity: input.configuration.identity,
    processRequest,
    exactWorkerSelected,
    invocationAuthorityBound,
    workspaceAuthorityBound,
    futureProcessCapabilityDeclared: input.configuration.futureProcessCapability,
    processPermissionAllowed:
      input.configuration.processPermission.processExecutionAllowed,
    permissionFactsAllowed: input.request.permissionFacts.allowed,
    runnable:
      TASK_EXECUTION_CODEX_WORKER_REAL_EXECUTION_ENABLED &&
      issues.every((item) => item.severity !== "error") &&
      exactWorkerSelected &&
      invocationAuthorityBound &&
      workspaceAuthorityBound &&
      input.configuration.futureProcessCapability &&
      input.configuration.processPermission.processExecutionAllowed &&
      input.request.permissionFacts.allowed,
    realExecutionEnabled: TASK_EXECUTION_CODEX_WORKER_REAL_EXECUTION_ENABLED,
  };

  return {
    preparedInvocation,
    issues,
  };
}

function taskOrModelEnvironmentClaimIssues(
  claims: unknown,
): readonly TaskExecutionWorkerIssue[] {
  if (claims === undefined) {
    return [];
  }

  return [
    issue({
      code: "task_execution_worker_process_gate_task_model_env_override_rejected",
      message:
        "Task or model environment claims are rejected; future Codex process environment inheritance is system-owned.",
      category: "permission",
    }),
  ];
}

function sameOptionalId(left: string | null | undefined, right: string | null | undefined): boolean {
  return (left ?? null) === (right ?? null);
}

function codexPreparedInvocationMatchesAuthority(input: {
  readonly prepared: TaskExecutionCodexPreparedInvocation;
  readonly request: TaskExecutionWorkerRequest;
  readonly record: TaskExecutionInvocationRecord;
  readonly configuration: TaskExecutionCodexWorkerConfiguration;
}): boolean {
  const { prepared, request, record, configuration } = input;

  return (
    prepared.taskId === request.taskId &&
    prepared.taskId === record.taskId &&
    prepared.sourceTaskRevision === request.sourceTaskRevision &&
    prepared.sourceTaskRevision === record.taskStateRevision &&
    prepared.attemptId === request.attemptId &&
    prepared.attemptId === record.attemptId &&
    prepared.attemptNumber === request.attemptNumber &&
    prepared.attemptNumber === record.attemptNumber &&
    prepared.invocationId === request.invocationId &&
    prepared.invocationId === record.invocationId &&
    prepared.idempotencyKey === request.idempotencyKey &&
    prepared.idempotencyKey === record.idempotencyKey &&
    sameOptionalId(prepared.workItemId, request.workItemId) &&
    sameOptionalId(prepared.workItemId, record.workItemId) &&
    sameOptionalId(prepared.batchId, request.batchId) &&
    sameOptionalId(prepared.batchId, record.batchId) &&
    prepared.workerIdentity.workerId === configuration.identity.workerId &&
    prepared.workerIdentity.workerId === request.workerIdentity.workerId &&
    prepared.workerIdentity.workerFamily === "codex" &&
    request.workerIdentity.workerFamily === "codex"
  );
}

function codexProcessRequestMatchesConfiguration(input: {
  readonly prepared: TaskExecutionCodexPreparedInvocation;
  readonly configuration: TaskExecutionCodexWorkerConfiguration;
}): boolean {
  const request = input.prepared.processRequest;
  const configuration = input.configuration;

  return (
    request.executable.authority === "system" &&
    request.executable.executableKind === "codex_exec" &&
    request.executable.executableRef === configuration.executable.executableRef &&
    request.workingDirectory.authority === "system" &&
    request.workingDirectory.workspaceRef === configuration.workspace.workspaceRef &&
    request.workingDirectory.projectRef === configuration.workspace.projectRef &&
    request.workingDirectory.workingDirectoryRef ===
      configuration.workspace.workingDirectoryRef &&
    request.timeoutMs === configuration.timeoutMs &&
    request.stdoutLimitBytes === configuration.stdoutLimitBytes &&
    request.stderrLimitBytes === configuration.stderrLimitBytes
  );
}

function auditEventMatchesCodexProcessAuthority(input: {
  readonly event?: TaskExecutionAuditEvent;
  readonly prepared: TaskExecutionCodexPreparedInvocation;
  readonly gate?: TaskExecutionPermissionGateResult;
}): boolean {
  const { event, prepared, gate } = input;

  return (
    event !== undefined &&
    gate !== undefined &&
    event.eventKind === "execution_invocation_dispatch_intent" &&
    isPositiveInteger(event.sequence, 999999999) &&
    typeof event.eventDigest === "string" &&
    event.eventDigest.length > 0 &&
    event.result.status === "ok" &&
    event.taskId === prepared.taskId &&
    event.taskStateRevision === prepared.sourceTaskRevision &&
    event.attemptId === prepared.attemptId &&
    event.invocationId === prepared.invocationId &&
    event.binding.taskId === prepared.taskId &&
    event.binding.taskStateRevision === prepared.sourceTaskRevision &&
    event.binding.attemptId === prepared.attemptId &&
    event.binding.attemptNumber === prepared.attemptNumber &&
    event.binding.invocationId === prepared.invocationId &&
    sameOptionalId(event.binding.workItemId, prepared.workItemId) &&
    sameOptionalId(event.binding.batchId, prepared.batchId) &&
    event.adapter?.adapterId === prepared.workerIdentity.workerId &&
    event.adapter?.operation === "execute_task_attempt" &&
    event.adapter?.idempotencyReference === prepared.idempotencyKey &&
    event.policy?.policyGateId === gate.policyGateId &&
    event.policy?.auditRequired === true
  );
}

function processGateDecision(
  issues: readonly TaskExecutionWorkerIssue[],
): TaskExecutionWorkerProcessDecision {
  return issues.some((item) => item.severity === "error")
    ? "blocked"
    : "authorized";
}

export function evaluateTaskExecutionWorkerProcessGate(
  input: TaskExecutionWorkerProcessGateInput,
): TaskExecutionWorkerProcessGateResult {
  const issues: TaskExecutionWorkerIssue[] = [
    ...validateConfiguration(input.configuration),
    ...taskOrModelClaimIssues(input.taskOrModelProcessClaims),
    ...taskOrModelEnvironmentClaimIssues(input.taskOrModelEnvironmentClaims),
    ...argvIssues(input.preparedInvocation.processRequest.argv),
  ];
  const invocationResult = validateTaskExecutionInvocationRecord(
    input.invocationRecord,
  );
  const invocation =
    invocationResult.ok ? invocationResult.value : undefined;

  if (!invocationResult.ok) {
    issues.push(
      issue({
        code: invocationResult.error.code,
        message:
          "Codex process readiness requires a valid authoritative AEOS invocation record.",
        category: invocationResult.error.category,
      }),
    );
  }

  const preparedAuthorityReady =
    invocation !== undefined &&
    codexPreparedInvocationMatchesAuthority({
      prepared: input.preparedInvocation,
      request: input.request,
      record: invocation,
      configuration: input.configuration,
    });

  if (!preparedAuthorityReady) {
    issues.push(
      issue({
        code: "task_execution_worker_process_gate_authority_mismatch",
        message:
          "Codex process readiness must bind exact task, revision, attempt, invocation, idempotency, work item, batch, and worker authority.",
        category: "conflict",
      }),
    );
  }

  const invocationLifecycleReady = invocation?.lifecycle === "invoking";

  if (invocation !== undefined && !invocationLifecycleReady) {
    issues.push(
      issue({
        code: "task_execution_worker_process_gate_invocation_not_invoking",
        message:
          "Codex process readiness is only valid for the current invoking invocation; returned, failed, reserved, or outcome-unknown records cannot launch another process.",
        category: "conflict",
      }),
    );
  }

  const invocationRevisionReady =
    invocation !== undefined &&
    (input.expectedInvocationRevision === undefined ||
      input.expectedInvocationRevision === invocation.revision);

  if (
    input.expectedInvocationRevision !== undefined &&
    (!isPositiveInteger(input.expectedInvocationRevision, 999999999) ||
      input.expectedInvocationRevision !== invocation?.revision)
  ) {
    issues.push(
      issue({
        code: "task_execution_worker_process_gate_invocation_revision_mismatch",
        message:
          "Codex process readiness requires the expected invocation revision to match persisted authority.",
        category: "conflict",
      }),
    );
  }

  const exactWorkerReady =
    input.preparedInvocation.exactWorkerSelected &&
    isCodexIdentity(input.configuration.identity) &&
    isCodexIdentity(input.request.workerIdentity);

  if (!exactWorkerReady) {
    issues.push(
      issue({
        code: "task_execution_worker_process_gate_worker_not_codex",
        message:
          "Local Codex process readiness requires the exact system-owned Codex worker identity.",
        category: "permission",
      }),
    );
  }

  const executableAndWorkspaceReady =
    input.preparedInvocation.invocationAuthorityBound &&
    input.preparedInvocation.workspaceAuthorityBound &&
    codexProcessRequestMatchesConfiguration({
      prepared: input.preparedInvocation,
      configuration: input.configuration,
    });

  if (!executableAndWorkspaceReady) {
    issues.push(
      issue({
        code: "task_execution_worker_process_gate_process_request_mismatch",
        message:
          "Codex process executable, workspace, timeout, and output limits must match system-owned prepared authority.",
        category: "permission",
      }),
    );
  }

  const executableReady =
    input.preparedInvocation.processRequest.executable.authority === "system" &&
    input.preparedInvocation.processRequest.executable.executableKind ===
      "codex_exec" &&
    input.preparedInvocation.processRequest.executable.executableRef ===
      input.configuration.executable.executableRef &&
    isSafeReference(
      input.preparedInvocation.processRequest.executable.executableRef,
    );
  const workspaceReady =
    input.preparedInvocation.processRequest.workingDirectory.authority ===
      "system" &&
    input.preparedInvocation.processRequest.workingDirectory.workspaceRef ===
      input.request.workspace.workspaceRef &&
    input.preparedInvocation.processRequest.workingDirectory.projectRef ===
      input.request.workspace.projectRef &&
    input.preparedInvocation.processRequest.workingDirectory.repositoryWriteAllowed ===
      false;
  const argvReady =
    argvIssues(input.preparedInvocation.processRequest.argv).length === 0;
  const environmentReady =
    input.preparedInvocation.processRequest.environment.authority === "system" &&
    Array.isArray(input.preparedInvocation.processRequest.environment.variables) &&
    input.preparedInvocation.processRequest.environment.variables.length === 0;
  const outputLimitsReady =
    isPositiveInteger(
      input.preparedInvocation.processRequest.stdoutLimitBytes,
      65536,
    ) &&
    isPositiveInteger(
      input.preparedInvocation.processRequest.stderrLimitBytes,
      32768,
    );
  const timeoutReady = isPositiveInteger(
    input.preparedInvocation.processRequest.timeoutMs,
    600000,
  );

  if (!environmentReady) {
    issues.push(
      issue({
        code: "task_execution_worker_process_gate_environment_unbounded",
        message:
          "Codex process readiness rejects arbitrary environment maps and parent environment exposure.",
        category: "permission",
      }),
    );
  }

  if (!executableReady || !workspaceReady) {
    issues.push(
      issue({
        code: "task_execution_worker_process_gate_process_request_mismatch",
        message:
          "Codex process readiness requires executable and workspace refs to remain exactly bound to system authority.",
        category: "permission",
      }),
    );
  }

  if (!outputLimitsReady) {
    issues.push(
      issue({
        code: "task_execution_worker_process_gate_output_limits_invalid",
        message:
          "Codex process readiness requires explicit bounded stdout and stderr limits.",
        category: "validation",
      }),
    );
  }

  if (!timeoutReady) {
    issues.push(
      issue({
        code: "task_execution_worker_process_gate_timeout_invalid",
        message:
          "Codex process readiness requires an explicit bounded positive timeout.",
        category: "validation",
      }),
    );
  }

  const permissionReady =
    input.configuration.futureProcessCapability === true &&
    input.configuration.processPermission.processExecutionAllowed === true &&
    input.preparedInvocation.futureProcessCapabilityDeclared === true &&
    input.preparedInvocation.processPermissionAllowed === true &&
    input.request.permissionFacts.authority === "system" &&
    input.request.permissionFacts.allowed === true &&
    input.request.permissionFacts.capabilitySatisfied === true &&
    input.request.permissionFacts.permissionsSatisfied === true &&
    input.request.permissionFacts.requiredPermissions.includes("process") &&
    input.permissionGateResult?.allowed === true &&
    input.permissionGateResult.decision === "allowed" &&
    input.permissionGateResult.capabilitySatisfied === true &&
    input.permissionGateResult.permissionsSatisfied === true &&
    input.permissionGateResult.auditRequired === true &&
    input.permissionGateResult.taskId === input.preparedInvocation.taskId &&
    input.permissionGateResult.sourceTaskRevision ===
      input.preparedInvocation.sourceTaskRevision &&
    input.permissionGateResult.attemptId === input.preparedInvocation.attemptId &&
    input.permissionGateResult.invocationId ===
      input.preparedInvocation.invocationId &&
    input.permissionGateResult.operation === "execute_task_attempt" &&
    sameOptionalId(
      input.permissionGateResult.workItemId,
      input.preparedInvocation.workItemId,
    ) &&
    sameOptionalId(
      input.permissionGateResult.batchId,
      input.preparedInvocation.batchId,
    );

  if (!permissionReady) {
    issues.push(
      issue({
        code: "task_execution_worker_process_gate_permission_denied",
        message:
          "Codex process readiness requires an allowed system permission gate with authoritative process permission, not capability alone.",
        category: "permission",
      }),
    );
  }

  const auditReady = auditEventMatchesCodexProcessAuthority({
    event: input.preProcessAuditEvent,
    prepared: input.preparedInvocation,
    gate: input.permissionGateResult,
  });

  if (!auditReady) {
    issues.push(
      issue({
        code: "task_execution_worker_process_gate_pre_process_audit_missing",
        message:
          "Codex process readiness requires a durable matching dispatch-intent audit event before any future local process spawn.",
        category: "validation",
      }),
    );
  }

  const readiness: TaskExecutionWorkerProcessReadiness = {
    taskAuthorityReady: preparedAuthorityReady,
    attemptAuthorityReady: preparedAuthorityReady,
    invocationAuthorityReady:
      preparedAuthorityReady &&
      invocationLifecycleReady &&
      invocationRevisionReady,
    workerAuthorityReady: exactWorkerReady,
    executableAuthorityReady: executableReady,
    workspaceAuthorityReady: workspaceReady,
    argvReady,
    environmentReady,
    outputLimitsReady,
    timeoutReady,
    permissionReady,
    auditReady,
    duplicateExecutionSafetyReady:
      invocationLifecycleReady && invocationRevisionReady,
    processContractReady: TASK_EXECUTION_CODEX_PROCESS_CONTRACT_READY,
    realCodexExecutionEnabled: TASK_EXECUTION_CODEX_WORKER_REAL_EXECUTION_ENABLED,
    externalProcessAllowed: TASK_EXECUTION_CODEX_WORKER_EXTERNAL_PROCESS_ALLOWED,
    actualCodexCalls: 0,
    actualClaudeCalls: 0,
    actualWorkerProcessesSpawned: 0,
    cloudCalls: 0,
  };
  const contractReady =
    Object.entries(readiness)
      .filter(
        ([key]) =>
          ![
            "realCodexExecutionEnabled",
            "externalProcessAllowed",
            "actualCodexCalls",
            "actualClaudeCalls",
            "actualWorkerProcessesSpawned",
            "cloudCalls",
          ].includes(key),
      )
      .every(([, value]) => value === true) &&
    TASK_EXECUTION_CODEX_WORKER_REAL_EXECUTION_ENABLED === false &&
    TASK_EXECUTION_CODEX_WORKER_EXTERNAL_PROCESS_ALLOWED === false;
  const decision = processGateDecision(issues);
  const authority: TaskExecutionWorkerProcessAuthority | null =
    decision === "authorized" &&
    contractReady &&
    invocation !== undefined &&
    input.preProcessAuditEvent !== undefined &&
    input.permissionGateResult !== undefined
      ? {
          boundary: TASK_EXECUTION_CODEX_PROCESS_BOUNDARY,
          taskId: input.preparedInvocation.taskId,
          taskRevision: input.preparedInvocation.sourceTaskRevision,
          attemptId: input.preparedInvocation.attemptId,
          attemptNumber: input.preparedInvocation.attemptNumber,
          invocationId: input.preparedInvocation.invocationId,
          invocationRevision: invocation.revision,
          invocationLifecycle: "invoking",
          idempotencyKey: input.preparedInvocation.idempotencyKey,
          workItemId: input.preparedInvocation.workItemId,
          batchId: input.preparedInvocation.batchId,
          workerId: input.preparedInvocation.workerIdentity.workerId,
          workerFamily: "codex",
          workspaceRef:
            input.preparedInvocation.processRequest.workingDirectory.workspaceRef,
          projectRef:
            input.preparedInvocation.processRequest.workingDirectory.projectRef,
          executableRef:
            input.preparedInvocation.processRequest.executable.executableRef,
          executableKind: "codex_exec",
          argv: input.preparedInvocation.processRequest.argv,
          requiredPermissions: ["process"],
          permissionGateId: input.permissionGateResult.policyGateId,
          preProcessAuditEventId: input.preProcessAuditEvent.auditEventId,
          preProcessAuditSequence: input.preProcessAuditEvent.sequence,
          stdoutLimitBytes:
            input.preparedInvocation.processRequest.stdoutLimitBytes,
          stderrLimitBytes:
            input.preparedInvocation.processRequest.stderrLimitBytes,
          timeoutMs: input.preparedInvocation.processRequest.timeoutMs,
          environment: {
            authority: "system",
            inheritance: "none",
            approvedVariableRefs: [],
          },
          realCodexExecutionEnabled:
            TASK_EXECUTION_CODEX_WORKER_REAL_EXECUTION_ENABLED,
          externalProcessAllowed:
            TASK_EXECUTION_CODEX_WORKER_EXTERNAL_PROCESS_ALLOWED,
        }
      : null;

  return {
    ok: authority !== null,
    decision: authority === null ? "blocked" : decision,
    readiness,
    authority,
    issues,
    CodexProcessContractReady: contractReady,
    RealCodexExecutionEnabled: TASK_EXECUTION_CODEX_WORKER_REAL_EXECUTION_ENABLED,
    ExternalProcessAllowed: TASK_EXECUTION_CODEX_WORKER_EXTERNAL_PROCESS_ALLOWED,
    ActualCodexCalls: 0,
    ActualClaudeCalls: 0,
    ActualWorkerProcessesSpawned: 0,
    CloudCalls: 0,
  };
}

export function authorizeTaskExecutionWorkerProcess(
  input: TaskExecutionWorkerProcessGateInput,
): TaskExecutionWorkerProcessGateResult {
  return evaluateTaskExecutionWorkerProcessGate(input);
}

function boundedDiagnostic(value: string, limit: number): string | undefined {
  const trimmed = value.trim();

  if (trimmed.length === 0 || trimmed.length > limit || /(\n\s*at\s+|stack)/i.test(trimmed)) {
    return undefined;
  }

  return trimmed;
}

function rawFailure(input: {
  readonly request: TaskExecutionWorkerRequest;
  readonly code: string;
  readonly category: TaskExecutionWorkerRawResult["failureCategory"];
  readonly message: string;
  readonly diagnostic?: string;
}): TaskExecutionWorkerRawResult {
  return {
    status: "failed",
    workerId: input.request.workerIdentity.workerId,
    workerFamily: input.request.workerIdentity.workerFamily,
    runtimeKind: input.request.workerIdentity.runtimeKind,
    invocationId: input.request.invocationId,
    idempotencyKey: input.request.idempotencyKey,
    taskId: input.request.taskId,
    sourceTaskRevision: input.request.sourceTaskRevision,
    attemptId: input.request.attemptId,
    attemptNumber: input.request.attemptNumber,
    workItemId: input.request.workItemId,
    batchId: input.request.batchId,
    failureCode: input.code,
    failureCategory: input.category,
    message: input.message,
    diagnostic: input.diagnostic,
  };
}

function unavailableFailure(input: {
  readonly request: TaskExecutionWorkerRequest;
  readonly code: string;
  readonly category: TaskExecutionWorkerRawResult["failureCategory"];
  readonly message: string;
}): TaskExecutionWorkerRawResult {
  return {
    ...rawFailure(input),
    status: "unavailable",
  };
}

function structuredBindingsMatch(input: {
  readonly request: TaskExecutionWorkerRequest;
  readonly value: Record<string, unknown>;
}): boolean {
  const request = input.request;
  const value = input.value;

  return (
    value.workerId === request.workerIdentity.workerId &&
    value.workerFamily === request.workerIdentity.workerFamily &&
    value.runtimeKind === request.workerIdentity.runtimeKind &&
    value.invocationId === request.invocationId &&
    value.idempotencyKey === request.idempotencyKey &&
    value.taskId === request.taskId &&
    value.sourceTaskRevision === request.sourceTaskRevision &&
    value.attemptId === request.attemptId &&
    value.attemptNumber === request.attemptNumber &&
    (value.workItemId ?? null) === (request.workItemId ?? null) &&
    (value.batchId ?? null) === (request.batchId ?? null)
  );
}

function structuredResultToRaw(input: {
  readonly request: TaskExecutionWorkerRequest;
  readonly value: unknown;
  readonly stdoutLimitBytes: number;
}): {
  readonly rawResult: TaskExecutionWorkerRawResult;
  readonly issues: readonly TaskExecutionWorkerIssue[];
} {
  const issues: TaskExecutionWorkerIssue[] = [];

  if (
    !isRecord(input.value) ||
    input.value.aeosCodexWorkerResultVersion !== 1 ||
    !structuredBindingsMatch({ request: input.request, value: input.value })
  ) {
    return {
      rawResult: rawFailure({
        request: input.request,
        code: "task_execution_codex_worker_structured_result_invalid",
        category: "invalid_request",
        message:
          "Codex process output was not a closed structured result bound to the AEOS invocation.",
      }),
      issues: [
        issue({
          code: "task_execution_codex_worker_structured_result_invalid",
          message:
            "Malformed or mismatched Codex structured output failed closed.",
        }),
      ],
    };
  }

  if (
    input.value.output !== undefined &&
    JSON.stringify(input.value.output).length > input.stdoutLimitBytes
  ) {
    return {
      rawResult: rawFailure({
        request: input.request,
        code: "task_execution_codex_worker_structured_output_oversized",
        category: "invalid_request",
        message: "Codex structured output exceeded the bounded output limit.",
      }),
      issues: [
        issue({
          code: "task_execution_codex_worker_structured_output_oversized",
          message: "Oversized Codex structured output was rejected.",
        }),
      ],
    };
  }

  const status = input.value.status;
  const output = sanitizeCodexJsonValue(input.value.output);
  const metadata = sanitizeCodexJsonValue(input.value.metadata);

  if (
    status !== "returned" &&
    status !== "failed" &&
    status !== "in_progress" &&
    status !== "unavailable"
  ) {
    return {
      rawResult: rawFailure({
        request: input.request,
        code: "task_execution_codex_worker_structured_status_invalid",
        category: "invalid_request",
        message: "Codex structured output contained an invalid status.",
      }),
      issues: [
        issue({
          code: "task_execution_codex_worker_structured_status_invalid",
          message: "Invalid Codex structured status failed closed.",
        }),
      ],
    };
  }

  if (output !== undefined && !isJsonValue(output)) {
    issues.push(
      issue({
        code: "task_execution_codex_worker_structured_output_invalid",
        message: "Non-JSON Codex output was dropped from worker evidence.",
        severity: "warning",
      }),
    );
  }

  if (metadata !== undefined && !isJsonObject(metadata)) {
    issues.push(
      issue({
        code: "task_execution_codex_worker_structured_metadata_invalid",
        message: "Non-object Codex metadata was dropped from worker evidence.",
        severity: "warning",
      }),
    );
  }

  return {
    rawResult: {
      status,
      workerId: input.request.workerIdentity.workerId,
      workerFamily: input.request.workerIdentity.workerFamily,
      runtimeKind: input.request.workerIdentity.runtimeKind,
      invocationId: input.request.invocationId,
      idempotencyKey: input.request.idempotencyKey,
      taskId: input.request.taskId,
      sourceTaskRevision: input.request.sourceTaskRevision,
      attemptId: input.request.attemptId,
      attemptNumber: input.request.attemptNumber,
      workItemId: input.request.workItemId,
      batchId: input.request.batchId,
      invocationOk:
        typeof input.value.invocationOk === "boolean"
          ? input.value.invocationOk
          : undefined,
      output: isJsonValue(output) ? output : undefined,
      outputReference:
        typeof input.value.outputReference === "string"
          ? input.value.outputReference
          : undefined,
      patchArtifactReference:
        typeof input.value.patchArtifactReference === "string"
          ? input.value.patchArtifactReference
          : undefined,
      changedFileManifestReference:
        typeof input.value.changedFileManifestReference === "string"
          ? input.value.changedFileManifestReference
          : undefined,
      testSummaryReference:
        typeof input.value.testSummaryReference === "string"
          ? input.value.testSummaryReference
          : undefined,
      diagnosticCode:
        typeof input.value.diagnosticCode === "string"
          ? input.value.diagnosticCode
          : undefined,
      message:
        typeof input.value.message === "string" ? input.value.message : undefined,
      metadata: isJsonObject(metadata) ? metadata : undefined,
      failure: isRecord(input.value.failure)
        ? (input.value.failure as unknown as TaskExecutionWorkerRawResult["failure"])
        : undefined,
      failureCode:
        typeof input.value.failureCode === "string"
          ? input.value.failureCode
          : undefined,
      failureCategory:
        typeof input.value.failureCategory === "string"
          ? (input.value.failureCategory as TaskExecutionWorkerRawResult["failureCategory"])
          : undefined,
      diagnostic:
        typeof input.value.diagnostic === "string"
          ? input.value.diagnostic
          : undefined,
    },
    issues,
  };
}

export function normalizeTaskExecutionCodexProcessRawResult(input: {
  readonly request: TaskExecutionWorkerRequest;
  readonly processResult: TaskExecutionCodexProcessResult;
  readonly stdoutLimitBytes?: number;
  readonly stderrLimitBytes?: number;
}): {
  readonly rawResult: TaskExecutionWorkerRawResult;
  readonly issues: readonly TaskExecutionWorkerIssue[];
} {
  const stdoutLimitBytes = input.stdoutLimitBytes ?? 8192;
  const stderrLimitBytes = input.stderrLimitBytes ?? 2048;
  const diagnostic = boundedDiagnostic(input.processResult.stderr, stderrLimitBytes);

  if (input.processResult.timedOut || input.processResult.terminationReason === "timeout") {
    return {
      rawResult: unavailableFailure({
        request: input.request,
        code: "task_execution_codex_worker_process_timeout",
        category: "timeout",
        message:
          "Codex process timed out; this is evidence only and does not authorize completion or retry.",
      }),
      issues: [],
    };
  }

  if (
    input.processResult.interrupted ||
    input.processResult.terminationReason === "interrupted" ||
    input.processResult.terminationReason === "signal"
  ) {
    return {
      rawResult: unavailableFailure({
        request: input.request,
        code: "task_execution_codex_worker_process_interrupted",
        category: "unknown",
        message:
          "Codex process was interrupted; this is evidence only and does not complete work.",
      }),
      issues: [],
    };
  }

  if (input.processResult.stdout.length > stdoutLimitBytes) {
    return {
      rawResult: rawFailure({
        request: input.request,
        code: "task_execution_codex_worker_stdout_oversized",
        category: "invalid_request",
        message: "Codex process stdout exceeded the configured bounded limit.",
        diagnostic,
      }),
      issues: [
        issue({
          code: "task_execution_codex_worker_stdout_oversized",
          message: "Oversized Codex stdout was rejected.",
        }),
      ],
    };
  }

  if (
    input.processResult.exitCode !== 0 ||
    input.processResult.terminationReason === "nonzero_exit"
  ) {
    return {
      rawResult: rawFailure({
        request: input.request,
        code: "task_execution_codex_worker_process_nonzero_exit",
        category: "worker_error",
        message:
          "Codex process exited nonzero; exit status is not completion authority.",
        diagnostic,
      }),
      issues: [],
    };
  }

  try {
    return structuredResultToRaw({
      request: input.request,
      value: JSON.parse(input.processResult.stdout) as unknown,
      stdoutLimitBytes,
    });
  } catch {
    return {
      rawResult: rawFailure({
        request: input.request,
        code: "task_execution_codex_worker_structured_result_malformed",
        category: "invalid_request",
        message:
          "Codex process stdout was not valid structured JSON and failed closed.",
        diagnostic,
      }),
      issues: [
        issue({
          code: "task_execution_codex_worker_structured_result_malformed",
          message: "Malformed Codex structured output failed closed.",
        }),
      ],
    };
  }
}

export function normalizeTaskExecutionCodexProcessResult(input: {
  readonly request: TaskExecutionWorkerRequest;
  readonly processResult: TaskExecutionCodexProcessResult;
  readonly stdoutLimitBytes?: number;
  readonly stderrLimitBytes?: number;
}): TaskExecutionWorkerResult {
  const normalizedRaw = normalizeTaskExecutionCodexProcessRawResult(input);
  const normalized = normalizeTaskExecutionWorkerResult({
    request: input.request,
    rawResult: normalizedRaw.rawResult,
  });

  return {
    ...normalized,
    issues: [...normalized.issues, ...normalizedRaw.issues],
  };
}

function successfulProcessResult(
  request: TaskExecutionWorkerRequest,
): TaskExecutionCodexProcessResult {
  return {
    invocationRef: `test-codex-process:${request.invocationId}`,
    terminationReason: "exited",
    exitCode: 0,
    timedOut: false,
    interrupted: false,
    stderr: "",
    stdout: JSON.stringify({
      aeosCodexWorkerResultVersion: 1,
      status: "returned",
      workerId: request.workerIdentity.workerId,
      workerFamily: request.workerIdentity.workerFamily,
      runtimeKind: request.workerIdentity.runtimeKind,
      invocationId: request.invocationId,
      idempotencyKey: request.idempotencyKey,
      taskId: request.taskId,
      sourceTaskRevision: request.sourceTaskRevision,
      attemptId: request.attemptId,
      attemptNumber: request.attemptNumber,
      workItemId: request.workItemId ?? null,
      batchId: request.batchId ?? null,
      invocationOk: true,
      outputReference: "artifact:codex-worker-output",
      patchArtifactReference: "artifact:codex-worker-patch",
      changedFileManifestReference: "artifact:codex-worker-changed-files",
      testSummaryReference: "artifact:codex-worker-tests",
      diagnosticCode: "codex_worker_test_process_returned",
    }),
  };
}

export function createTaskExecutionCodexWorkerAdapter(input: {
  readonly configuration: TaskExecutionCodexWorkerConfiguration;
  readonly deterministicProcessResult?: TaskExecutionCodexProcessResult;
}): TaskExecutionCodexWorkerAdapter {
  let processCalls = 0;

  return {
    codexAdapterKind: "task_execution_codex_worker_adapter",
    identity: input.configuration.identity,
    capabilities: {
      roles: ["implementation"],
      repositoryRead: true,
      repositoryWrite: false,
      processExecution: false,
      shellExecution: false,
      toolExecution: false,
      modelReasoning: true,
      patchGeneration: true,
      testExecution: true,
      boundedDiagnostics: true,
      deterministicTestResult: true,
    },
    configuration: input.configuration,
    processCallCount: () => processCalls,
    actualChildProcessCount: () => 0,
    actualCodexCallCount: () => 0,
    actualClaudeCodeCallCount: () => 0,
    cloudCallCount: () => 0,
    run: (request) => {
      processCalls += 1;
      const normalizedRaw = normalizeTaskExecutionCodexProcessRawResult({
        request,
        processResult:
          input.deterministicProcessResult ?? successfulProcessResult(request),
        stdoutLimitBytes: input.configuration.stdoutLimitBytes,
        stderrLimitBytes: input.configuration.stderrLimitBytes,
      });

      if (normalizedRaw.issues.some((item) => item.severity === "error")) {
        return normalizedRaw.rawResult;
      }

      return normalizedRaw.rawResult;
    },
  };
}

function codexAdapterFromUnknown(
  worker: unknown,
): TaskExecutionCodexWorkerAdapter | undefined {
  if (!isRecord(worker)) {
    return undefined;
  }

  if (
    worker.codexAdapterKind !== "task_execution_codex_worker_adapter" ||
    typeof worker.processCallCount !== "function" ||
    typeof worker.actualChildProcessCount !== "function" ||
    typeof worker.actualCodexCallCount !== "function" ||
    typeof worker.actualClaudeCodeCallCount !== "function" ||
    typeof worker.cloudCallCount !== "function"
  ) {
    return undefined;
  }

  return worker as unknown as TaskExecutionCodexWorkerAdapter;
}

export async function evaluateTaskExecutionCodexWorkerConformance(
  input: TaskExecutionCodexWorkerConformanceInput,
): Promise<TaskExecutionCodexWorkerConformanceResult> {
  const adapter = codexAdapterFromUnknown(input.worker);
  const prepared = prepareTaskExecutionCodexWorkerInvocation({
    configuration: input.configuration,
    request: input.request,
    invocationRecord: input.invocationRecord,
    taskOrModelProcessClaims: input.taskOrModelProcessClaims,
  });
  const preflightIssues = [...prepared.issues];

  if (adapter === undefined) {
    preflightIssues.push(
      issue({
        code: "task_execution_codex_worker_adapter_invalid",
        message:
          "Codex worker must be the concrete local Codex adapter boundary.",
      }),
    );
  }

  if (adapter !== undefined && adapter.identity.workerId !== input.configuration.identity.workerId) {
    preflightIssues.push(
      issue({
        code: "task_execution_codex_worker_adapter_configuration_mismatch",
        message: "Codex adapter identity must match the supplied configuration.",
        category: "conflict",
      }),
    );
  }

  if (preflightIssues.some((item) => item.severity === "error")) {
    return {
      ok: false,
      codexWorkerConformant: false,
      preparedInvocation: prepared.preparedInvocation,
      workerConformance: null,
      normalizedResult: null,
      issues: preflightIssues,
      processCallCount: adapter?.processCallCount() ?? 0,
      actualChildProcessCount: 0,
      actualCodexCallCount: 0,
      actualClaudeCodeCallCount: 0,
      cloudCallCount: 0,
      realExecutionEnabled: TASK_EXECUTION_CODEX_WORKER_REAL_EXECUTION_ENABLED,
    };
  }

  if (adapter === undefined) {
    return {
      ok: false,
      codexWorkerConformant: false,
      preparedInvocation: prepared.preparedInvocation,
      workerConformance: null,
      normalizedResult: null,
      issues: preflightIssues,
      processCallCount: 0,
      actualChildProcessCount: 0,
      actualCodexCallCount: 0,
      actualClaudeCodeCallCount: 0,
      cloudCallCount: 0,
      realExecutionEnabled: TASK_EXECUTION_CODEX_WORKER_REAL_EXECUTION_ENABLED,
    };
  }

  const workerConformance = await evaluateTaskExecutionWorkerConformance({
    worker: adapter,
    request: input.request,
    invocationRecord: input.invocationRecord,
    permissionGateResult: input.permissionGateResult,
    expectedIdempotencyKey: input.expectedIdempotencyKey,
    taskOrModelWorkerSelectionClaims: input.taskOrModelWorkerSelectionClaims,
    taskOrModelCapabilityClaims: input.taskOrModelCapabilityClaims,
    stateSnapshotBefore: input.stateSnapshotBefore,
    stateSnapshotAfter: input.stateSnapshotAfter,
    attemptSnapshotBefore: input.attemptSnapshotBefore,
    attemptSnapshotAfter: input.attemptSnapshotAfter,
    invocationSnapshotBefore: input.invocationSnapshotBefore,
    invocationSnapshotAfter: input.invocationSnapshotAfter,
    workAccountingSnapshotBefore: input.workAccountingSnapshotBefore,
    workAccountingSnapshotAfter: input.workAccountingSnapshotAfter,
  });
  const issues = [...preflightIssues, ...workerConformance.issues];
  const codexWorkerConformant =
    workerConformance.testWorkerConformant &&
    workerConformance.workerIdentity?.workerFamily === "codex" &&
    workerConformance.workerInvoked &&
    adapter.actualChildProcessCount() === 0 &&
    adapter.actualCodexCallCount() === 0 &&
    adapter.actualClaudeCodeCallCount() === 0 &&
    adapter.cloudCallCount() === 0;

  return {
    ok: codexWorkerConformant && issues.every((item) => item.severity !== "error"),
    codexWorkerConformant,
    preparedInvocation: prepared.preparedInvocation,
    workerConformance,
    normalizedResult: workerConformance.normalizedResult,
    issues,
    processCallCount: adapter.processCallCount(),
    actualChildProcessCount: adapter.actualChildProcessCount(),
    actualCodexCallCount: adapter.actualCodexCallCount(),
    actualClaudeCodeCallCount: adapter.actualClaudeCodeCallCount(),
    cloudCallCount: adapter.cloudCallCount(),
    realExecutionEnabled: TASK_EXECUTION_CODEX_WORKER_REAL_EXECUTION_ENABLED,
  };
}
