import type { TaskExecutionAuditEvent } from "./task-execution-audit.js";
import {
  createTaskExecutionInvocationFailedAuditEvent,
  createTaskExecutionInvocationOutcomeUnknownAuditEvent,
  createTaskExecutionInvocationReturnedAuditEvent,
} from "./task-execution-audit.js";
import { appendTaskExecutionAuditEvent } from "./task-execution-audit-persistence.js";
import type {
  TaskExecutionInvocationRecord,
} from "./task-execution-invocation-record.js";
import {
  validateTaskExecutionInvocationRecord,
} from "./task-execution-invocation-record.js";
import { updateTaskExecutionInvocation } from "./task-execution-invocation-persistence.js";
import type {
  TaskExecutionPermissionGateResult,
  TaskExecutionPermissionKind,
} from "./task-execution-permission-gate.js";
import type {
  TaskExecutionWorkerFamily,
  TaskExecutionWorkerIdentity,
  TaskExecutionWorkerIssue,
  TaskExecutionWorkerRequest,
  TaskExecutionWorkerWorkspaceReference,
} from "./task-execution-worker.js";
import type { AeosError, JsonObject, JsonValue } from "./types.js";

// @ts-expect-error Node built-ins are available at runtime; this package does not depend on Node ambient types yet.
import { spawn } from "node:child_process";
// @ts-expect-error Node built-ins are available at runtime; this package does not depend on Node ambient types yet.
import { Buffer } from "node:buffer";
// @ts-expect-error Node built-ins are available at runtime; this package does not depend on Node ambient types yet.
import { realpath } from "node:fs/promises";
// @ts-expect-error Node built-ins are available at runtime; this package does not depend on Node ambient types yet.
import { isAbsolute } from "node:path";
// @ts-expect-error Node built-ins are available at runtime; this package does not depend on Node ambient types yet.
import process from "node:process";

export const TASK_EXECUTION_LOCAL_WORKER_PROCESS_CONTRACT_READY = true;
export const TASK_EXECUTION_LOCAL_WORKER_EXTERNAL_PROCESS_ALLOWED = false;
export const TASK_EXECUTION_LOCAL_WORKER_REAL_CODEX_EXECUTION_ENABLED = false;
export const TASK_EXECUTION_LOCAL_WORKER_REAL_CLAUDE_CODE_EXECUTION_ENABLED =
  false;

export type TaskExecutionLocalWorkerExecutableKind =
  | "codex_exec"
  | "claude_code";

export type TaskExecutionLocalWorkerProcessDecision =
  | "authorized"
  | "blocked";

export interface TaskExecutionLocalWorkerExecutableAuthority {
  readonly authority: "system";
  readonly executableRef: string;
  readonly executableKind: TaskExecutionLocalWorkerExecutableKind;
}

export interface TaskExecutionLocalWorkerProcessPermission {
  readonly authority: "system";
  readonly permissionId: string;
  readonly requiredPermission: Extract<TaskExecutionPermissionKind, "process">;
  readonly processExecutionAllowed: boolean;
}

export interface TaskExecutionLocalWorkerWorkspaceAuthority
  extends TaskExecutionWorkerWorkspaceReference {
  readonly workingDirectoryRef: string;
}

export interface TaskExecutionLocalWorkerProcessConfiguration {
  readonly authority: "system";
  readonly identity: TaskExecutionWorkerIdentity;
  readonly executable: TaskExecutionLocalWorkerExecutableAuthority;
  readonly workspace: TaskExecutionLocalWorkerWorkspaceAuthority;
  readonly processPermission: TaskExecutionLocalWorkerProcessPermission;
  readonly futureProcessCapability: boolean;
  readonly timeoutMs: number;
  readonly stdoutLimitBytes: number;
  readonly stderrLimitBytes: number;
}

export interface TaskExecutionLocalWorkerProcessRequest {
  readonly executable: TaskExecutionLocalWorkerExecutableAuthority;
  readonly argv: readonly string[];
  readonly workingDirectory: TaskExecutionLocalWorkerWorkspaceAuthority;
  readonly stdin: string;
  readonly timeoutMs: number;
  readonly stdoutLimitBytes: number;
  readonly stderrLimitBytes: number;
  readonly environment: {
    readonly authority: "system";
    readonly inheritance?: TaskExecutionLocalWorkerRuntimeEnvironmentInheritance;
    readonly variables: readonly [];
  };
}

export interface TaskExecutionLocalWorkerPreparedInvocation {
  readonly taskId: string;
  readonly sourceTaskRevision: number;
  readonly attemptId: string;
  readonly attemptNumber: number;
  readonly invocationId: string;
  readonly idempotencyKey: string;
  readonly workItemId: string | null;
  readonly batchId: string | null;
  readonly workerIdentity: TaskExecutionWorkerIdentity;
  readonly processRequest: TaskExecutionLocalWorkerProcessRequest;
  readonly exactWorkerSelected: boolean;
  readonly invocationAuthorityBound: boolean;
  readonly workspaceAuthorityBound: boolean;
  readonly futureProcessCapabilityDeclared: boolean;
  readonly processPermissionAllowed: boolean;
  readonly permissionFactsAllowed: boolean;
  readonly runnable: boolean;
  readonly realExecutionEnabled: false;
}

export interface TaskExecutionLocalWorkerProcessReadiness {
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
  readonly realClaudeCodeExecutionEnabled: false;
  readonly externalProcessAllowed: false;
  readonly actualCodexCalls: 0;
  readonly actualClaudeCalls: 0;
  readonly actualWorkerProcessesSpawned: 0;
  readonly cloudCalls: 0;
}

export interface TaskExecutionLocalWorkerProcessAuthority {
  readonly boundary: string;
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
  readonly workerFamily: TaskExecutionWorkerFamily;
  readonly workspaceRef: string;
  readonly projectRef: string;
  readonly executableRef: string;
  readonly executableKind: TaskExecutionLocalWorkerExecutableKind;
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
    readonly inheritance: TaskExecutionLocalWorkerRuntimeEnvironmentInheritance;
    readonly approvedVariableRefs: readonly string[];
  };
  readonly realCodexExecutionEnabled: false;
  readonly realClaudeCodeExecutionEnabled: false;
  readonly externalProcessAllowed: false;
}

export interface TaskExecutionLocalWorkerProcessGateInput {
  readonly processBoundary: string;
  readonly expectedWorkerFamily: TaskExecutionWorkerFamily;
  readonly expectedExecutableKind: TaskExecutionLocalWorkerExecutableKind;
  readonly workerFamilyLabel: string;
  readonly workerMismatchCode: string;
  readonly configuration: TaskExecutionLocalWorkerProcessConfiguration;
  readonly request: TaskExecutionWorkerRequest;
  readonly invocationRecord: unknown;
  readonly preparedInvocation: TaskExecutionLocalWorkerPreparedInvocation;
  readonly permissionGateResult?: TaskExecutionPermissionGateResult;
  readonly preProcessAuditEvent?: TaskExecutionAuditEvent;
  readonly expectedInvocationRevision?: number;
  readonly additionalIssues?: readonly TaskExecutionWorkerIssue[];
  readonly argvIssues?: readonly TaskExecutionWorkerIssue[];
  readonly taskOrModelEnvironmentClaims?: unknown;
}

export interface TaskExecutionLocalWorkerProcessGateResult {
  readonly ok: boolean;
  readonly decision: TaskExecutionLocalWorkerProcessDecision;
  readonly readiness: TaskExecutionLocalWorkerProcessReadiness;
  readonly authority: TaskExecutionLocalWorkerProcessAuthority | null;
  readonly issues: readonly TaskExecutionWorkerIssue[];
  readonly ProcessContractReady: boolean;
  readonly RealCodexExecutionEnabled: false;
  readonly RealClaudeCodeExecutionEnabled: false;
  readonly ExternalProcessAllowed: false;
  readonly ActualCodexCalls: 0;
  readonly ActualClaudeCalls: 0;
  readonly ActualWorkerProcessesSpawned: 0;
  readonly CloudCalls: 0;
}

export type TaskExecutionLocalWorkerProcessTerminationReason =
  | "exited"
  | "nonzero_exit"
  | "timeout"
  | "signal"
  | "spawn_failure"
  | "output_limit_exceeded"
  | "unknown";

export type TaskExecutionLocalWorkerProcessRuntimeStatus =
  | "launch_blocked"
  | "launch_reserved"
  | "process_returned"
  | "process_failed"
  | "process_timeout"
  | "process_signal"
  | "process_spawn_failed"
  | "process_output_oversized"
  | "process_outcome_unknown"
  | "outcome_persistence_failed";

export interface TaskExecutionLocalWorkerRuntimeExecutableBinding {
  readonly authority: "system";
  readonly executableRef: string;
  readonly executableKind: TaskExecutionLocalWorkerExecutableKind;
  readonly executablePath: string;
  readonly executionMode:
    | "benign_test_fixture"
    | "real_codex_read_only_planner_canary"
    | "real_claude_code_read_only_canary"
    | "real_claude_code_write_canary";
}

export interface TaskExecutionLocalWorkerRuntimeWorkspaceBinding {
  readonly authority: "system";
  readonly workspaceRef: string;
  readonly projectRef: string;
  readonly absolutePath: string;
  readonly repositoryWriteAllowed: false;
}

export interface TaskExecutionLocalWorkerRuntimeEnvironmentPolicy {
  readonly authority: "system";
  readonly inheritance: TaskExecutionLocalWorkerRuntimeEnvironmentInheritance;
  readonly variables: readonly {
    readonly name: string;
    readonly value: string;
  }[];
}

export type TaskExecutionLocalWorkerRuntimeEnvironmentInheritance =
  | "none"
  | "system_claude_code_read_only_canary"
  | "system_claude_code_write_canary";

export interface TaskExecutionLocalWorkerProcessEvidence {
  readonly invocationRef: string;
  readonly terminationReason: TaskExecutionLocalWorkerProcessTerminationReason;
  readonly exitCode: number | null;
  readonly signal?: string;
  readonly stdout: string;
  readonly stderr: string;
  readonly stdoutBytes: number;
  readonly stderrBytes: number;
  readonly stdoutTruncated: boolean;
  readonly stderrTruncated: boolean;
  readonly timedOut: boolean;
  readonly interrupted: boolean;
  readonly spawned: boolean;
  readonly observedAt: string;
}

export interface ExecuteTaskExecutionLocalWorkerProcessInput {
  readonly projectRoot: string;
  readonly authority: TaskExecutionLocalWorkerProcessAuthority;
  readonly invocationRecord: unknown;
  readonly preProcessAuditEvent: TaskExecutionAuditEvent;
  readonly executable: TaskExecutionLocalWorkerRuntimeExecutableBinding;
  readonly workspace: TaskExecutionLocalWorkerRuntimeWorkspaceBinding;
  readonly environment?: TaskExecutionLocalWorkerRuntimeEnvironmentPolicy;
  readonly stdin: string;
  readonly occurredAt?: string;
  readonly forbiddenValues?: readonly string[];
}

export interface TaskExecutionLocalWorkerProcessRuntimeResult {
  readonly ok: boolean;
  readonly status: TaskExecutionLocalWorkerProcessRuntimeStatus;
  readonly launchReservationPersisted: boolean;
  readonly oneShotAuthorityConsumed: boolean;
  readonly processSpawned: boolean;
  readonly actualWorkerProcessesSpawned: 0 | 1;
  readonly actualCodexCalls: 0;
  readonly actualClaudeCalls: 0;
  readonly cloudCalls: 0;
  readonly invocationLifecycle: string | null;
  readonly invocationRevision: number | null;
  readonly processResult: TaskExecutionLocalWorkerProcessEvidence | null;
  readonly reconciliationRequired: boolean;
  readonly postDispatchAuditWritten: boolean;
  readonly postDispatchAuditIncomplete: boolean;
  readonly issues: readonly TaskExecutionWorkerIssue[];
  readonly safety: {
    readonly processEvidenceOnly: true;
    readonly shellExecuted: false;
    readonly parentEnvironmentInherited: false;
    readonly taskEnvironmentAccepted: false;
    readonly repositoryWritten: false;
    readonly retryAttempted: false;
    readonly blindRelaunchAllowed: false;
    readonly workAccountingModified: false;
    readonly taskCompleted: false;
    readonly verifierRun: false;
    readonly completionGateSatisfied: false;
    readonly rawWorkerOutputAuthoritative: false;
    readonly realCodexInvoked: false;
    readonly realClaudeCodeInvoked: false;
    readonly cloudCalled: false;
  };
}

const safeReferencePattern = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,255}$/;
const safeEnvNamePattern = /^[A-Z_][A-Z0-9_]{0,63}$/;
const maxEnvironmentVariables = 16;
const claudeCodeReadOnlyCanaryInheritedEnvNames = [
  "HOME",
  "USER",
  "LOGNAME",
  "TMPDIR",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
] as const;

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

function isPositiveInteger(value: unknown, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= max;
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

function sameOptionalId(left: string | null | undefined, right: string | null | undefined): boolean {
  return (left ?? null) === (right ?? null);
}

function processGateDecision(
  issues: readonly TaskExecutionWorkerIssue[],
): TaskExecutionLocalWorkerProcessDecision {
  return issues.some((item) => item.severity === "error")
    ? "blocked"
    : "authorized";
}

function environmentClaimIssues(
  claims: unknown,
): readonly TaskExecutionWorkerIssue[] {
  if (claims === undefined) {
    return [];
  }

  return [
    issue({
      code: "task_execution_worker_process_gate_task_model_env_override_rejected",
      message:
        "Task or model environment claims are rejected; future local worker process environment inheritance is system-owned.",
      category: "permission",
    }),
  ];
}

function preparedInvocationMatchesAuthority(input: {
  readonly prepared: TaskExecutionLocalWorkerPreparedInvocation;
  readonly request: TaskExecutionWorkerRequest;
  readonly record: TaskExecutionInvocationRecord;
  readonly configuration: TaskExecutionLocalWorkerProcessConfiguration;
  readonly expectedWorkerFamily: TaskExecutionWorkerFamily;
}): boolean {
  const { prepared, request, record, configuration, expectedWorkerFamily } =
    input;

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
    prepared.workerIdentity.workerFamily === expectedWorkerFamily &&
    request.workerIdentity.workerFamily === expectedWorkerFamily &&
    configuration.identity.workerFamily === expectedWorkerFamily
  );
}

function processRequestMatchesConfiguration(input: {
  readonly prepared: TaskExecutionLocalWorkerPreparedInvocation;
  readonly configuration: TaskExecutionLocalWorkerProcessConfiguration;
  readonly expectedExecutableKind: TaskExecutionLocalWorkerExecutableKind;
}): boolean {
  const request = input.prepared.processRequest;
  const configuration = input.configuration;

  return (
    request.executable.authority === "system" &&
    request.executable.executableKind === input.expectedExecutableKind &&
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

function auditEventMatchesProcessAuthority(input: {
  readonly event?: TaskExecutionAuditEvent;
  readonly prepared: TaskExecutionLocalWorkerPreparedInvocation;
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

export function evaluateTaskExecutionLocalWorkerProcessGate(
  input: TaskExecutionLocalWorkerProcessGateInput,
): TaskExecutionLocalWorkerProcessGateResult {
  const issues: TaskExecutionWorkerIssue[] = [
    ...(input.additionalIssues ?? []),
    ...environmentClaimIssues(input.taskOrModelEnvironmentClaims),
    ...(input.argvIssues ?? []),
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
          "Local worker process readiness requires a valid authoritative AEOS invocation record.",
        category: invocationResult.error.category,
      }),
    );
  }

  const preparedAuthorityReady =
    invocation !== undefined &&
    preparedInvocationMatchesAuthority({
      prepared: input.preparedInvocation,
      request: input.request,
      record: invocation,
      configuration: input.configuration,
      expectedWorkerFamily: input.expectedWorkerFamily,
    });

  if (!preparedAuthorityReady) {
    issues.push(
      issue({
        code: "task_execution_worker_process_gate_authority_mismatch",
        message:
          "Local worker process readiness must bind exact task, revision, attempt, invocation, idempotency, work item, batch, and worker authority.",
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
          "Local worker process readiness is only valid for the current invoking invocation; returned, failed, reserved, or outcome-unknown records cannot launch another process.",
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
          "Local worker process readiness requires the expected invocation revision to match persisted authority.",
        category: "conflict",
      }),
    );
  }

  const exactWorkerReady =
    input.preparedInvocation.exactWorkerSelected &&
    input.configuration.identity.workerFamily === input.expectedWorkerFamily &&
    input.configuration.identity.runtimeKind === "test_worker" &&
    input.configuration.identity.identityAuthority === "system" &&
    input.configuration.identity.selectionAuthority === "system" &&
    input.request.workerIdentity.workerFamily === input.expectedWorkerFamily &&
    input.request.workerIdentity.runtimeKind === "test_worker" &&
    input.request.workerIdentity.identityAuthority === "system" &&
    input.request.workerIdentity.selectionAuthority === "system";

  if (!exactWorkerReady) {
    issues.push(
      issue({
        code: input.workerMismatchCode,
        message: `Local ${input.workerFamilyLabel} process readiness requires the exact system-owned ${input.workerFamilyLabel} worker identity.`,
        category: "permission",
      }),
    );
  }

  const executableAndWorkspaceReady =
    input.preparedInvocation.invocationAuthorityBound &&
    input.preparedInvocation.workspaceAuthorityBound &&
    processRequestMatchesConfiguration({
      prepared: input.preparedInvocation,
      configuration: input.configuration,
      expectedExecutableKind: input.expectedExecutableKind,
    });

  if (!executableAndWorkspaceReady) {
    issues.push(
      issue({
        code: "task_execution_worker_process_gate_process_request_mismatch",
        message:
          "Local worker process executable, workspace, timeout, and output limits must match system-owned prepared authority.",
        category: "permission",
      }),
    );
  }

  const executableReady =
    input.preparedInvocation.processRequest.executable.authority === "system" &&
    input.preparedInvocation.processRequest.executable.executableKind ===
      input.expectedExecutableKind &&
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
  const argvReady = (input.argvIssues ?? []).length === 0;
  const preparedEnvironmentInheritance =
    input.preparedInvocation.processRequest.environment.inheritance ?? "none";
  const environmentReady =
    input.preparedInvocation.processRequest.environment.authority === "system" &&
    Array.isArray(input.preparedInvocation.processRequest.environment.variables) &&
    input.preparedInvocation.processRequest.environment.variables.length === 0 &&
    (preparedEnvironmentInheritance === "none" ||
      (preparedEnvironmentInheritance ===
        "system_claude_code_read_only_canary" &&
        input.expectedWorkerFamily === "claude_code") ||
      (preparedEnvironmentInheritance ===
        "system_claude_code_write_canary" &&
        input.expectedWorkerFamily === "claude_code"));
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
          "Local worker process readiness rejects arbitrary environment maps and parent environment exposure.",
        category: "permission",
      }),
    );
  }

  if (!executableReady || !workspaceReady) {
    issues.push(
      issue({
        code: "task_execution_worker_process_gate_process_request_mismatch",
        message:
          "Local worker process readiness requires executable and workspace refs to remain exactly bound to system authority.",
        category: "permission",
      }),
    );
  }

  if (!outputLimitsReady) {
    issues.push(
      issue({
        code: "task_execution_worker_process_gate_output_limits_invalid",
        message:
          "Local worker process readiness requires explicit bounded stdout and stderr limits.",
        category: "validation",
      }),
    );
  }

  if (!timeoutReady) {
    issues.push(
      issue({
        code: "task_execution_worker_process_gate_timeout_invalid",
        message:
          "Local worker process readiness requires an explicit bounded positive timeout.",
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
          "Local worker process readiness requires an allowed system permission gate with authoritative process permission, not capability alone.",
        category: "permission",
      }),
    );
  }

  const auditReady = auditEventMatchesProcessAuthority({
    event: input.preProcessAuditEvent,
    prepared: input.preparedInvocation,
    gate: input.permissionGateResult,
  });

  if (!auditReady) {
    issues.push(
      issue({
        code: "task_execution_worker_process_gate_pre_process_audit_missing",
        message:
          "Local worker process readiness requires a durable matching dispatch-intent audit event before any future local process spawn.",
        category: "validation",
      }),
    );
  }

  const readiness: TaskExecutionLocalWorkerProcessReadiness = {
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
    processContractReady: TASK_EXECUTION_LOCAL_WORKER_PROCESS_CONTRACT_READY,
    realCodexExecutionEnabled:
      TASK_EXECUTION_LOCAL_WORKER_REAL_CODEX_EXECUTION_ENABLED,
    realClaudeCodeExecutionEnabled:
      TASK_EXECUTION_LOCAL_WORKER_REAL_CLAUDE_CODE_EXECUTION_ENABLED,
    externalProcessAllowed: TASK_EXECUTION_LOCAL_WORKER_EXTERNAL_PROCESS_ALLOWED,
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
            "realClaudeCodeExecutionEnabled",
            "externalProcessAllowed",
            "actualCodexCalls",
            "actualClaudeCalls",
            "actualWorkerProcessesSpawned",
            "cloudCalls",
          ].includes(key),
      )
      .every(([, value]) => value === true) &&
    TASK_EXECUTION_LOCAL_WORKER_REAL_CODEX_EXECUTION_ENABLED === false &&
    TASK_EXECUTION_LOCAL_WORKER_REAL_CLAUDE_CODE_EXECUTION_ENABLED === false &&
    TASK_EXECUTION_LOCAL_WORKER_EXTERNAL_PROCESS_ALLOWED === false;
  const decision = processGateDecision(issues);
  const authority: TaskExecutionLocalWorkerProcessAuthority | null =
    decision === "authorized" &&
    contractReady &&
    invocation !== undefined &&
    input.preProcessAuditEvent !== undefined &&
    input.permissionGateResult !== undefined
      ? {
          boundary: input.processBoundary,
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
          workerFamily: input.expectedWorkerFamily,
          workspaceRef:
            input.preparedInvocation.processRequest.workingDirectory.workspaceRef,
          projectRef:
            input.preparedInvocation.processRequest.workingDirectory.projectRef,
          executableRef:
            input.preparedInvocation.processRequest.executable.executableRef,
          executableKind: input.expectedExecutableKind,
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
            inheritance: preparedEnvironmentInheritance,
            approvedVariableRefs:
              preparedEnvironmentInheritance ===
                "system_claude_code_read_only_canary" ||
              preparedEnvironmentInheritance === "system_claude_code_write_canary"
                ? [...claudeCodeReadOnlyCanaryInheritedEnvNames]
                : [],
          },
          realCodexExecutionEnabled:
            TASK_EXECUTION_LOCAL_WORKER_REAL_CODEX_EXECUTION_ENABLED,
          realClaudeCodeExecutionEnabled:
            TASK_EXECUTION_LOCAL_WORKER_REAL_CLAUDE_CODE_EXECUTION_ENABLED,
          externalProcessAllowed:
            TASK_EXECUTION_LOCAL_WORKER_EXTERNAL_PROCESS_ALLOWED,
        }
      : null;

  return {
    ok: authority !== null,
    decision: authority === null ? "blocked" : decision,
    readiness,
    authority,
    issues,
    ProcessContractReady: contractReady,
    RealCodexExecutionEnabled:
      TASK_EXECUTION_LOCAL_WORKER_REAL_CODEX_EXECUTION_ENABLED,
    RealClaudeCodeExecutionEnabled:
      TASK_EXECUTION_LOCAL_WORKER_REAL_CLAUDE_CODE_EXECUTION_ENABLED,
    ExternalProcessAllowed: TASK_EXECUTION_LOCAL_WORKER_EXTERNAL_PROCESS_ALLOWED,
    ActualCodexCalls: 0,
    ActualClaudeCalls: 0,
    ActualWorkerProcessesSpawned: 0,
    CloudCalls: 0,
  };
}

function runtimeResult(input: {
  readonly ok: boolean;
  readonly status: TaskExecutionLocalWorkerProcessRuntimeStatus;
  readonly launchReservationPersisted?: boolean;
  readonly oneShotAuthorityConsumed?: boolean;
  readonly processSpawned?: boolean;
  readonly actualWorkerProcessesSpawned?: 0 | 1;
  readonly invocationLifecycle?: string | null;
  readonly invocationRevision?: number | null;
  readonly processResult?: TaskExecutionLocalWorkerProcessEvidence | null;
  readonly reconciliationRequired?: boolean;
  readonly postDispatchAuditWritten?: boolean;
  readonly postDispatchAuditIncomplete?: boolean;
  readonly issues: readonly TaskExecutionWorkerIssue[];
}): TaskExecutionLocalWorkerProcessRuntimeResult {
  return {
    ok: input.ok,
    status: input.status,
    launchReservationPersisted: input.launchReservationPersisted ?? false,
    oneShotAuthorityConsumed: input.oneShotAuthorityConsumed ?? false,
    processSpawned: input.processSpawned ?? false,
    actualWorkerProcessesSpawned: input.actualWorkerProcessesSpawned ?? 0,
    actualCodexCalls: 0,
    actualClaudeCalls: 0,
    cloudCalls: 0,
    invocationLifecycle: input.invocationLifecycle ?? null,
    invocationRevision: input.invocationRevision ?? null,
    processResult: input.processResult ?? null,
    reconciliationRequired: input.reconciliationRequired ?? false,
    postDispatchAuditWritten: input.postDispatchAuditWritten ?? false,
    postDispatchAuditIncomplete: input.postDispatchAuditIncomplete ?? false,
    issues: input.issues,
    safety: {
      processEvidenceOnly: true,
      shellExecuted: false,
      parentEnvironmentInherited: false,
      taskEnvironmentAccepted: false,
      repositoryWritten: false,
      retryAttempted: false,
      blindRelaunchAllowed: false,
      workAccountingModified: false,
      taskCompleted: false,
      verifierRun: false,
      completionGateSatisfied: false,
      rawWorkerOutputAuthoritative: false,
      realCodexInvoked: false,
      realClaudeCodeInvoked: false,
      cloudCalled: false,
    },
  };
}

function authorityMatchesRecord(input: {
  readonly authority: TaskExecutionLocalWorkerProcessAuthority;
  readonly record: TaskExecutionInvocationRecord;
}): boolean {
  const { authority, record } = input;

  return (
    authority.taskId === record.taskId &&
    authority.taskRevision === record.taskStateRevision &&
    authority.attemptId === record.attemptId &&
    authority.attemptNumber === record.attemptNumber &&
    authority.invocationId === record.invocationId &&
    authority.invocationRevision === record.revision &&
    authority.invocationLifecycle === record.lifecycle &&
    authority.idempotencyKey === record.idempotencyKey &&
    sameOptionalId(authority.workItemId, record.workItemId) &&
    sameOptionalId(authority.batchId, record.batchId)
  );
}

function auditMatchesLaunchAuthority(input: {
  readonly authority: TaskExecutionLocalWorkerProcessAuthority;
  readonly event: TaskExecutionAuditEvent;
}): boolean {
  const { authority, event } = input;

  return (
    event.auditEventId === authority.preProcessAuditEventId &&
    event.sequence === authority.preProcessAuditSequence &&
    event.eventKind === "execution_invocation_dispatch_intent" &&
    event.result.status === "ok" &&
    event.taskId === authority.taskId &&
    event.taskStateRevision === authority.taskRevision &&
    event.attemptId === authority.attemptId &&
    event.invocationId === authority.invocationId &&
    event.binding.taskId === authority.taskId &&
    event.binding.taskStateRevision === authority.taskRevision &&
    event.binding.attemptId === authority.attemptId &&
    event.binding.attemptNumber === authority.attemptNumber &&
    event.binding.invocationId === authority.invocationId &&
    sameOptionalId(event.binding.workItemId, authority.workItemId) &&
    sameOptionalId(event.binding.batchId, authority.batchId) &&
    event.adapter?.adapterId === authority.workerId &&
    event.adapter?.operation === "execute_task_attempt" &&
    event.adapter?.idempotencyReference === authority.idempotencyKey &&
    event.policy?.policyGateId === authority.permissionGateId &&
    event.policy?.auditRequired === true
  );
}

function executableBindingReady(input: {
  readonly authority: TaskExecutionLocalWorkerProcessAuthority;
  readonly executable: TaskExecutionLocalWorkerRuntimeExecutableBinding;
}): boolean {
  const toolsIndex = input.authority.argv.indexOf("--tools");
  const permissionModeIndex = input.authority.argv.indexOf("--permission-mode");
  const executionModeReady =
    input.executable.executionMode === "benign_test_fixture" ||
    (input.executable.executionMode === "real_codex_read_only_planner_canary" &&
      input.authority.workerFamily === "codex" &&
      input.authority.executableKind === "codex_exec" &&
      input.authority.environment.inheritance === "none" &&
      input.authority.argv.includes("exec") &&
      input.authority.argv.includes("--sandbox") &&
      input.authority.argv.includes("read-only") &&
      input.authority.argv.includes("--ask-for-approval") &&
      input.authority.argv.includes("never") &&
      input.authority.argv.includes("--output-schema") &&
      !input.authority.argv.some((arg) =>
        /danger|yolo|bypass|mcp|provider|api-key|credential/i.test(arg),
      )) ||
    (input.executable.executionMode === "real_claude_code_read_only_canary" &&
      input.authority.workerFamily === "claude_code" &&
      input.authority.executableKind === "claude_code" &&
      input.authority.environment.inheritance ===
        "system_claude_code_read_only_canary" &&
      input.authority.argv.includes("--safe-mode") &&
      input.authority.argv.includes("--strict-mcp-config") &&
      input.authority.argv.includes("--no-session-persistence") &&
      input.authority.argv.includes("--json-schema") &&
      input.authority.argv.includes("--tools") &&
      toolsIndex >= 0 &&
      input.authority.argv[toolsIndex + 1] === "Read" &&
      input.authority.argv.includes("--permission-mode") &&
      permissionModeIndex >= 0 &&
      input.authority.argv[permissionModeIndex + 1] === "plan" &&
      !input.authority.argv.some((arg) =>
        /dangerously-skip-permissions|bypassPermissions/i.test(arg),
      )) ||
    (input.executable.executionMode === "real_claude_code_write_canary" &&
      input.authority.workerFamily === "claude_code" &&
      input.authority.executableKind === "claude_code" &&
      input.authority.environment.inheritance ===
        "system_claude_code_write_canary" &&
      input.authority.argv.includes("--safe-mode") &&
      input.authority.argv.includes("--strict-mcp-config") &&
      input.authority.argv.includes("--no-session-persistence") &&
      input.authority.argv.includes("--json-schema") &&
      input.authority.argv.includes("--tools") &&
      toolsIndex >= 0 &&
      input.authority.argv[toolsIndex + 1] === "Read,Edit" &&
      input.authority.argv.includes("--permission-mode") &&
      permissionModeIndex >= 0 &&
      input.authority.argv[permissionModeIndex + 1] === "acceptEdits" &&
      input.authority.argv.includes("--disallowedTools") &&
      input.authority.argv.some(
        (arg) =>
          arg.includes("Bash") &&
          arg.includes("Write") &&
          arg.includes("WebFetch") &&
          arg.includes("WebSearch") &&
          arg.includes("mcp__*"),
      ) &&
      !input.authority.argv.some((arg) =>
        /dangerously-skip-permissions|bypassPermissions/i.test(arg),
      ));

  return (
    input.executable.authority === "system" &&
    executionModeReady &&
    input.executable.executableRef === input.authority.executableRef &&
    input.executable.executableKind === input.authority.executableKind &&
    isAbsolute(input.executable.executablePath) &&
    !input.executable.executablePath.includes("\0")
  );
}

async function workspaceBindingReady(input: {
  readonly authority: TaskExecutionLocalWorkerProcessAuthority;
  readonly workspace: TaskExecutionLocalWorkerRuntimeWorkspaceBinding;
}): Promise<boolean> {
  if (
    input.workspace.authority !== "system" ||
    input.workspace.workspaceRef !== input.authority.workspaceRef ||
    input.workspace.projectRef !== input.authority.projectRef ||
    input.workspace.repositoryWriteAllowed !== false ||
    !isAbsolute(input.workspace.absolutePath) ||
    input.workspace.absolutePath.includes("\0")
  ) {
    return false;
  }

  const resolved = await realpath(input.workspace.absolutePath).catch(
    () => undefined,
  );

  return resolved === input.workspace.absolutePath;
}

function environmentPolicyReady(
  environment?: TaskExecutionLocalWorkerRuntimeEnvironmentPolicy,
): boolean {
  if (environment === undefined) {
    return true;
  }

  if (
    environment.authority !== "system" ||
    (environment.inheritance !== "none" &&
      environment.inheritance !== "system_claude_code_read_only_canary" &&
      environment.inheritance !== "system_claude_code_write_canary") ||
    environment.variables.length > maxEnvironmentVariables
  ) {
    return false;
  }

  return environment.variables.every(
    (item) =>
      safeEnvNamePattern.test(item.name) &&
      item.value.length <= 256 &&
      !/TOKEN|SECRET|KEY|PASSWORD|CREDENTIAL/i.test(item.name),
  );
}

function environmentFromPolicy(
  environment?: TaskExecutionLocalWorkerRuntimeEnvironmentPolicy,
): Record<string, string> {
  const variables = Object.fromEntries(
    (environment?.variables ?? []).map((item) => [item.name, item.value]),
  );

  if (
    environment?.inheritance !== "system_claude_code_read_only_canary" &&
    environment?.inheritance !== "system_claude_code_write_canary"
  ) {
    return variables;
  }

  for (const name of claudeCodeReadOnlyCanaryInheritedEnvNames) {
    const value = (process as { env?: Record<string, string | undefined> }).env?.[
      name
    ];

    if (value !== undefined) {
      variables[name] = value;
    }
  }

  variables.CLAUDE_CODE_SAFE_MODE = "1";
  variables.CLAUDE_CODE_SKIP_PROMPT_HISTORY = "1";

  return variables;
}

function sanitizeOutput(value: string): string {
  return value
    .replace(/\u001b\[[0-9;]*[A-Za-z]/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
}

function truncateUtf8(value: string, maxBytes: number): string {
  let current = "";

  for (const char of value) {
    const next = `${current}${char}`;

    if (Buffer.byteLength(next, "utf8") > maxBytes) {
      return current;
    }

    current = next;
  }

  return current;
}

function appendChunk(input: {
  readonly current: string;
  readonly chunk: unknown;
  readonly maxBytes: number;
}): {
  readonly value: string;
  readonly bytes: number;
  readonly oversized: boolean;
} {
  const chunk = input.chunk;
  const chunkText = sanitizeOutput(
    typeof chunk === "string"
      ? chunk
      : Buffer.isBuffer(chunk)
        ? (chunk as { toString: (encoding: string) => string }).toString("utf8")
        : String(chunk),
  );
  const next = `${input.current}${chunkText}`;
  const bytes = Buffer.byteLength(next, "utf8");

  if (bytes <= input.maxBytes) {
    return { value: next, bytes, oversized: false };
  }

  return {
    value: truncateUtf8(next, input.maxBytes),
    bytes,
    oversized: true,
  };
}

function spawnStatusFromEvidence(
  evidence: TaskExecutionLocalWorkerProcessEvidence,
): TaskExecutionLocalWorkerProcessRuntimeStatus {
  if (evidence.terminationReason === "spawn_failure") {
    return "process_spawn_failed";
  }

  if (evidence.terminationReason === "output_limit_exceeded") {
    return "process_output_oversized";
  }

  if (evidence.terminationReason === "timeout") {
    return "process_timeout";
  }

  if (evidence.terminationReason === "signal") {
    return "process_signal";
  }

  if (
    evidence.terminationReason === "exited" &&
    evidence.exitCode === 0
  ) {
    return "process_returned";
  }

  if (evidence.terminationReason === "unknown") {
    return "process_outcome_unknown";
  }

  return "process_failed";
}

function failureCategoryFromEvidence(
  evidence: TaskExecutionLocalWorkerProcessEvidence,
): "execution_failure" | "unknown" {
  if (evidence.terminationReason === "timeout") {
    return "execution_failure";
  }

  if (evidence.terminationReason === "nonzero_exit") {
    return "execution_failure";
  }

  return evidence.terminationReason === "output_limit_exceeded"
    ? "execution_failure"
    : "unknown";
}

function diagnosticFromEvidence(
  evidence: TaskExecutionLocalWorkerProcessEvidence,
): string {
  return truncateUtf8(
    [
      `termination=${evidence.terminationReason}`,
      `exitCode=${evidence.exitCode ?? "null"}`,
      evidence.signal === undefined ? undefined : `signal=${evidence.signal}`,
      evidence.stderr.length === 0 ? undefined : `stderr=${evidence.stderr}`,
    ]
      .filter((item): item is string => item !== undefined)
      .join("; "),
    2048,
  );
}

async function executeBoundedChildProcess(input: {
  readonly authority: TaskExecutionLocalWorkerProcessAuthority;
  readonly executable: TaskExecutionLocalWorkerRuntimeExecutableBinding;
  readonly workspace: TaskExecutionLocalWorkerRuntimeWorkspaceBinding;
  readonly environment?: TaskExecutionLocalWorkerRuntimeEnvironmentPolicy;
  readonly stdin: string;
  readonly observedAt: string;
}): Promise<TaskExecutionLocalWorkerProcessEvidence> {
  return await new Promise((resolveProcess) => {
    let stdout = "";
    let stderr = "";
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let stdoutOversized = false;
    let stderrOversized = false;
    let timedOut = false;
    let spawned = false;
    let resolved = false;

    const finish = (
      evidence: Omit<
        TaskExecutionLocalWorkerProcessEvidence,
        "invocationRef" | "stdout" | "stderr" | "stdoutBytes" | "stderrBytes" | "stdoutTruncated" | "stderrTruncated" | "timedOut" | "spawned" | "observedAt"
      >,
    ) => {
      if (resolved) {
        return;
      }

      resolved = true;
      resolveProcess({
        invocationRef: `local-worker-process:${input.authority.invocationId}`,
        ...evidence,
        stdout,
        stderr,
        stdoutBytes,
        stderrBytes,
        stdoutTruncated: stdoutOversized,
        stderrTruncated: stderrOversized,
        timedOut,
        spawned,
        observedAt: input.observedAt,
      });
    };

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    let killHandle: ReturnType<typeof setTimeout> | undefined;

    try {
      const child = spawn(input.executable.executablePath, input.authority.argv, {
        cwd: input.workspace.absolutePath,
        env: environmentFromPolicy(input.environment),
        shell: false,
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      });

      const terminateForLimit = () => {
        child.kill("SIGTERM");
        killHandle = setTimeout(() => {
          child.kill("SIGKILL");
        }, 50);
      };

      child.once("spawn", () => {
        spawned = true;
      });

      child.stdout?.on("data", (chunk: unknown) => {
        const appended = appendChunk({
          current: stdout,
          chunk,
          maxBytes: input.authority.stdoutLimitBytes,
        });
        stdout = appended.value;
        stdoutBytes = appended.bytes;

        if (appended.oversized && !stdoutOversized) {
          stdoutOversized = true;
          terminateForLimit();
        }
      });

      child.stderr?.on("data", (chunk: unknown) => {
        const appended = appendChunk({
          current: stderr,
          chunk,
          maxBytes: input.authority.stderrLimitBytes,
        });
        stderr = appended.value;
        stderrBytes = appended.bytes;

        if (appended.oversized && !stderrOversized) {
          stderrOversized = true;
          terminateForLimit();
        }
      });

      child.once("error", () => {
        if (timeoutHandle !== undefined) {
          clearTimeout(timeoutHandle);
        }
        if (killHandle !== undefined) {
          clearTimeout(killHandle);
        }

        finish({
          terminationReason: "spawn_failure",
          exitCode: null,
          interrupted: false,
        });
      });

      child.once("close", (exitCode: number | null, signal: string | null) => {
        if (timeoutHandle !== undefined) {
          clearTimeout(timeoutHandle);
        }
        if (killHandle !== undefined) {
          clearTimeout(killHandle);
        }

        if (stdoutOversized || stderrOversized) {
          finish({
            terminationReason: "output_limit_exceeded",
            exitCode,
            signal: signal ?? undefined,
            interrupted: true,
          });
          return;
        }

        if (timedOut) {
          finish({
            terminationReason: "timeout",
            exitCode,
            signal: signal ?? undefined,
            interrupted: true,
          });
          return;
        }

        if (signal !== null) {
          finish({
            terminationReason: "signal",
            exitCode,
            signal,
            interrupted: true,
          });
          return;
        }

        finish({
          terminationReason: exitCode === 0 ? "exited" : "nonzero_exit",
          exitCode,
          interrupted: false,
        });
      });

      child.stdin?.end(input.stdin, "utf8");
      timeoutHandle = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
        killHandle = setTimeout(() => {
          child.kill("SIGKILL");
        }, 50);
      }, input.authority.timeoutMs);
    } catch {
      finish({
        terminationReason: "spawn_failure",
        exitCode: null,
        interrupted: false,
      });
    }
  });
}

async function appendRuntimeOutcomeAudit(input: {
  readonly projectRoot: string;
  readonly record: TaskExecutionInvocationRecord;
  readonly forbiddenValues: readonly string[];
}): Promise<boolean> {
  const event =
    input.record.lifecycle === "returned"
      ? createTaskExecutionInvocationReturnedAuditEvent({ record: input.record })
      : input.record.lifecycle === "failed"
        ? createTaskExecutionInvocationFailedAuditEvent({ record: input.record })
        : createTaskExecutionInvocationOutcomeUnknownAuditEvent({
            record: input.record,
          });

  if (!event.ok) {
    return false;
  }

  const append = await appendTaskExecutionAuditEvent({
    projectRoot: input.projectRoot,
    taskId: input.record.taskId,
    event: event.value,
    forbiddenValues: input.forbiddenValues,
  });

  return append.ok;
}

function processEvidenceMetadata(
  evidence: TaskExecutionLocalWorkerProcessEvidence,
): JsonObject {
  return {
    invocationRef: evidence.invocationRef,
    terminationReason: evidence.terminationReason,
    exitCode: evidence.exitCode,
    signal: evidence.signal ?? null,
    stdoutBytes: evidence.stdoutBytes,
    stderrBytes: evidence.stderrBytes,
    stdoutTruncated: evidence.stdoutTruncated,
    stderrTruncated: evidence.stderrTruncated,
    timedOut: evidence.timedOut,
    interrupted: evidence.interrupted,
    spawned: evidence.spawned,
  };
}

function sanitizedFailureDiagnostic(
  evidence: TaskExecutionLocalWorkerProcessEvidence,
  forbiddenValues: readonly string[],
): string {
  const diagnostic = diagnosticFromEvidence(evidence);

  return forbiddenValues.reduce(
    (current, forbidden) =>
      forbidden.length === 0 ? current : current.split(forbidden).join("[redacted]"),
    diagnostic,
  );
}

export async function executeTaskExecutionLocalWorkerProcess(
  input: ExecuteTaskExecutionLocalWorkerProcessInput,
): Promise<TaskExecutionLocalWorkerProcessRuntimeResult> {
  const issues: TaskExecutionWorkerIssue[] = [];
  const invocationResult = validateTaskExecutionInvocationRecord(
    input.invocationRecord,
  );
  const now = input.occurredAt ?? new Date().toISOString();

  if (!invocationResult.ok) {
    issues.push(
      issue({
        code: invocationResult.error.code,
        message:
          "Local worker process runtime requires a valid authoritative invocation record.",
        category: invocationResult.error.category,
      }),
    );
  }

  const invocation = invocationResult.ok ? invocationResult.value : undefined;

  if (
    invocation === undefined ||
    !authorityMatchesRecord({ authority: input.authority, record: invocation })
  ) {
    issues.push(
      issue({
        code: "task_execution_local_worker_runtime_authority_mismatch",
        message:
          "Local worker process runtime requires exact task, revision, attempt, invocation, idempotency, and work binding authority before launch.",
        category: "conflict",
      }),
    );
  }

  if (
    !auditMatchesLaunchAuthority({
      authority: input.authority,
      event: input.preProcessAuditEvent,
    })
  ) {
    issues.push(
      issue({
        code: "task_execution_local_worker_runtime_pre_process_audit_missing",
        message:
          "Local worker process runtime requires the exact durable pre-process dispatch audit event before launch.",
        category: "validation",
      }),
    );
  }

  if (!executableBindingReady(input)) {
    issues.push(
      issue({
        code: "task_execution_local_worker_runtime_executable_mismatch",
        message:
          "Local worker process runtime requires a matching system-owned trusted executable binding.",
        category: "permission",
      }),
    );
  }

  if (!(await workspaceBindingReady(input))) {
    issues.push(
      issue({
        code: "task_execution_local_worker_runtime_workspace_mismatch",
        message:
          "Local worker process runtime requires the cwd to exactly match system-owned workspace authority.",
        category: "permission",
      }),
    );
  }

  if (!environmentPolicyReady(input.environment)) {
    issues.push(
      issue({
        code: "task_execution_local_worker_runtime_environment_rejected",
        message:
          "Local worker process runtime rejects parent environment inheritance, secret-shaped variables, and task-controlled env maps.",
        category: "permission",
      }),
    );
  }

  if (issues.some((item) => item.severity === "error") || invocation === undefined) {
    return runtimeResult({
      ok: false,
      status: "launch_blocked",
      invocationLifecycle: invocation?.lifecycle ?? null,
      invocationRevision: invocation?.revision ?? null,
      issues,
    });
  }

  const reservation = await updateTaskExecutionInvocation({
    projectRoot: input.projectRoot,
    taskId: invocation.taskId,
    invocationId: invocation.invocationId,
    ownershipToken: invocation.ownership.ownershipToken,
    expectedLifecycle: "invoking",
    expectedRevision: input.authority.invocationRevision,
    intent: {
      kind: "mark_outcome_unknown",
      occurredAt: now,
      issue: {
        code: "task_execution_local_worker_process_launched_outcome_pending",
        message:
          "Local worker process launch authority was consumed before spawn; if AEOS stops before result persistence, reconciliation is required and blind relaunch is forbidden.",
        severity: "error",
        category: "unknown",
      },
    },
  });

  if (!reservation.ok) {
    return runtimeResult({
      ok: false,
      status: "launch_blocked",
      invocationLifecycle: invocation.lifecycle,
      invocationRevision: invocation.revision,
      issues: [
        ...issues,
        issue({
          code: reservation.error.code,
          message:
            "Local worker process launch reservation could not be durably consumed; no child process was spawned.",
          category: reservation.error.category,
        }),
      ],
    });
  }

  const evidence = await executeBoundedChildProcess({
    authority: input.authority,
    executable: input.executable,
    workspace: input.workspace,
    environment: input.environment,
    stdin: input.stdin,
    observedAt: now,
  });
  const status = spawnStatusFromEvidence(evidence);
  const processSucceeded =
    evidence.terminationReason === "exited" && evidence.exitCode === 0;
  const updateResult = await updateTaskExecutionInvocation({
    projectRoot: input.projectRoot,
    taskId: invocation.taskId,
    invocationId: invocation.invocationId,
    ownershipToken: invocation.ownership.ownershipToken,
    expectedLifecycle: "outcome_unknown",
    expectedRevision: reservation.value.record.revision,
    intent: processSucceeded
      ? {
          kind: "record_returned",
          result: {
            invocationOk: true,
            diagnosticCode:
              "task_execution_local_worker_process_returned_evidence",
            message:
              "Local worker process exited zero; stdout/stderr remain bounded non-authoritative worker evidence.",
            metadata: processEvidenceMetadata(evidence),
            returnedAt: evidence.observedAt,
          },
        }
      : {
          kind: "record_failed",
          failure: {
            code:
              evidence.terminationReason === "spawn_failure"
                ? "task_execution_local_worker_process_spawn_failed"
                : evidence.terminationReason === "output_limit_exceeded"
                  ? "task_execution_local_worker_process_output_oversized"
                  : evidence.terminationReason === "timeout"
                    ? "task_execution_local_worker_process_timeout"
                    : evidence.terminationReason === "signal"
                      ? "task_execution_local_worker_process_signal"
                      : "task_execution_local_worker_process_failed",
            category: failureCategoryFromEvidence(evidence),
            diagnostic: sanitizedFailureDiagnostic(
              evidence,
              input.forbiddenValues ?? [],
            ),
            retryable: false,
            failedAt: evidence.observedAt,
          },
        },
  });

  if (!updateResult.ok) {
    return runtimeResult({
      ok: false,
      status: "outcome_persistence_failed",
      launchReservationPersisted: true,
      oneShotAuthorityConsumed: true,
      processSpawned: evidence.spawned,
      actualWorkerProcessesSpawned: evidence.spawned ? 1 : 0,
      invocationLifecycle: reservation.value.record.lifecycle,
      invocationRevision: reservation.value.record.revision,
      processResult: evidence,
      reconciliationRequired: true,
      issues: [
        ...issues,
        issue({
          code: updateResult.error.code,
          message:
            "Local worker process finished after the launch boundary, but AEOS could not persist the outcome; reconciliation is required and no relaunch was attempted.",
          category: updateResult.error.category,
        }),
      ],
    });
  }

  const auditWritten = await appendRuntimeOutcomeAudit({
    projectRoot: input.projectRoot,
    record: updateResult.value.record,
    forbiddenValues: input.forbiddenValues ?? [],
  });

  return runtimeResult({
    ok: processSucceeded && auditWritten,
    status,
    launchReservationPersisted: true,
    oneShotAuthorityConsumed: true,
    processSpawned: evidence.spawned,
    actualWorkerProcessesSpawned: evidence.spawned ? 1 : 0,
    invocationLifecycle: updateResult.value.record.lifecycle,
    invocationRevision: updateResult.value.record.revision,
    processResult: evidence,
    reconciliationRequired: !auditWritten,
    postDispatchAuditWritten: auditWritten,
    postDispatchAuditIncomplete: !auditWritten,
    issues: auditWritten
      ? issues
      : [
          ...issues,
          issue({
            code: "task_execution_local_worker_process_post_audit_incomplete",
            message:
              "Local worker process outcome was persisted, but post-dispatch audit append failed; AEOS did not relaunch the process.",
            category: "unknown",
          }),
        ],
  });
}
