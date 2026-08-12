import type { TaskExecutionAuditEvent } from "./task-execution-audit.js";
import type {
  TaskExecutionInvocationRecord,
} from "./task-execution-invocation-record.js";
import {
  validateTaskExecutionInvocationRecord,
} from "./task-execution-invocation-record.js";
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
import type { AeosError } from "./types.js";

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
    readonly inheritance: "none";
    readonly approvedVariableRefs: readonly [];
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

const safeReferencePattern = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,255}$/;

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
            inheritance: "none",
            approvedVariableRefs: [],
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
