import type {
  AgenticExecutionAttemptId,
  AgenticTaskId,
  AgenticWorkBatchId,
  AgenticWorkItemId,
} from "./agentic-lifecycle.js";
import type { TaskExecutionAdapterOperationKind } from "./task-execution-adapter.js";
import type { TaskExecutionCredentialPublicResolutionResult } from "./task-execution-credential.js";
import type { TaskExecutionInvocationRecord } from "./task-execution-invocation-record.js";
import type { TaskExecutionPermissionGateResult } from "./task-execution-permission-gate.js";
import type { AeosError, JsonObject, JsonValue, Result } from "./types.js";

// @ts-expect-error Node built-ins are available at runtime; this package does not depend on Node ambient types yet.
import { createHash } from "node:crypto";

export const AEOS_TASK_EXECUTION_AUDIT_SCHEMA_VERSION = 1;

export type TaskExecutionAuditEventKind =
  | "execution_permission_evaluated"
  | "execution_credential_resolution_evaluated"
  | "execution_invocation_dispatch_intent"
  | "execution_invocation_returned"
  | "execution_invocation_failed"
  | "execution_invocation_outcome_unknown"
  | "execution_reconciliation_applied"
  | "execution_work_accounting_applied";

export type TaskExecutionAuditResultStatus =
  | "ok"
  | "partial"
  | "blocked"
  | "denied"
  | "failed"
  | "not_run";

export interface TaskExecutionAuditIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: "error" | "warning" | "info";
  readonly category: AeosError["category"];
}

export interface TaskExecutionAuditActor {
  readonly id: "aeos.execution";
  readonly type: "system";
  readonly authority: "system";
}

export interface TaskExecutionAuditTarget {
  readonly type:
    | "task"
    | "policy"
    | "secret"
    | "tool"
    | "system";
  readonly id?: string;
}

export interface TaskExecutionAuditResult {
  readonly status: TaskExecutionAuditResultStatus;
  readonly decision?: string;
  readonly referenceId?: string;
  readonly errorCode?: string;
}

export interface TaskExecutionAuditBinding {
  readonly taskId: AgenticTaskId;
  readonly taskStateRevision: number;
  readonly attemptId: AgenticExecutionAttemptId;
  readonly attemptNumber?: number;
  readonly invocationId: string;
  readonly workItemId?: AgenticWorkItemId;
  readonly batchId?: AgenticWorkBatchId;
}

export interface TaskExecutionAuditAdapterReference {
  readonly adapterId: string;
  readonly operation: TaskExecutionAdapterOperationKind;
  readonly idempotencyReference?: string;
}

export interface TaskExecutionAuditPolicyReference {
  readonly policyGateId?: string;
  readonly policyDecisionReference?: string;
  readonly policyAuthorized?: boolean;
  readonly auditRequired?: boolean;
}

export interface TaskExecutionAuditCredentialReference {
  readonly credentialRef?: string;
  readonly secretProviderRef?: string;
  readonly credentialResolutionReference?: string;
  readonly credentialRequired?: boolean;
  readonly credentialResolved?: boolean;
}

export interface TaskExecutionAuditCorrelation {
  readonly correlationId: string;
  readonly traceId?: string;
}

export interface TaskExecutionAuditEvent {
  readonly schemaVersion: typeof AEOS_TASK_EXECUTION_AUDIT_SCHEMA_VERSION;
  readonly auditEventId: string;
  readonly eventKind: TaskExecutionAuditEventKind;
  readonly occurredAt: string;
  readonly recordedAt: string;
  readonly taskId: AgenticTaskId;
  readonly taskStateRevision: number;
  readonly attemptId: AgenticExecutionAttemptId;
  readonly invocationId: string;
  readonly actor: TaskExecutionAuditActor;
  readonly action: string;
  readonly target: TaskExecutionAuditTarget;
  readonly result: TaskExecutionAuditResult;
  readonly binding: TaskExecutionAuditBinding;
  readonly adapter?: TaskExecutionAuditAdapterReference;
  readonly policy?: TaskExecutionAuditPolicyReference;
  readonly credential?: TaskExecutionAuditCredentialReference;
  readonly correlation?: TaskExecutionAuditCorrelation;
  readonly resultReference?: string;
  readonly failureReference?: string;
  readonly sequence: number;
  readonly previousEventDigest: string | null;
  readonly eventDigest: string;
  readonly issues: readonly TaskExecutionAuditIssue[];
  readonly redactionStatus: "not_required" | "redacted";
  readonly redactionsApplied: boolean;
  readonly retentionPolicy: "task_lifetime";
}

export type TaskExecutionAuditEventDraft = Omit<
  TaskExecutionAuditEvent,
  "recordedAt" | "sequence" | "previousEventDigest" | "eventDigest"
>;

export type TaskExecutionAuditEventIdentityInput = Omit<
  TaskExecutionAuditEventDraft,
  | "schemaVersion"
  | "auditEventId"
  | "occurredAt"
  | "actor"
  | "redactionStatus"
  | "redactionsApplied"
  | "retentionPolicy"
>;

export interface CreateTaskExecutionDispatchIntentAuditEventInput {
  readonly record: TaskExecutionInvocationRecord;
  readonly adapterId?: string;
  readonly operation?: TaskExecutionAdapterOperationKind;
  readonly policyGateId?: string;
  readonly policyDecisionReference?: string;
  readonly policyAuthorized?: boolean;
  readonly auditRequired?: boolean;
  readonly credentialRef?: string;
  readonly secretProviderRef?: string;
  readonly credentialResolutionReference?: string;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface CreateTaskExecutionInvocationOutcomeAuditEventInput {
  readonly record: TaskExecutionInvocationRecord;
  readonly occurredAt?: string;
}

export interface CreateTaskExecutionPermissionEvaluatedAuditEventInput {
  readonly gate: TaskExecutionPermissionGateResult;
  readonly policyDecisionReference?: string;
  readonly occurredAt?: string;
}

export interface CreateTaskExecutionCredentialEvaluatedAuditEventInput {
  readonly credential: TaskExecutionCredentialPublicResolutionResult;
  readonly occurredAt?: string;
}

export interface CreateWorkItemCompletedAccountingAuditEventInput {
  readonly taskId: AgenticTaskId;
  readonly taskStateRevision: number;
  readonly attemptId: AgenticExecutionAttemptId;
  readonly attemptNumber: number;
  readonly invocationId: string;
  readonly workItemId: AgenticWorkItemId;
  readonly batchId: AgenticWorkBatchId;
  readonly occurredAt?: string;
}

const safeIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/;

function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

function err(error: AeosError): Result<never, AeosError> {
  return { ok: false, error };
}

function createError(
  code: string,
  message: string,
  category: AeosError["category"],
  details?: JsonObject,
): AeosError {
  return {
    code,
    message,
    category,
    retryable: false,
    details,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isSafeId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value === value.trim() &&
    value !== "." &&
    value !== ".." &&
    !value.includes("/") &&
    !value.includes("\\") &&
    safeIdPattern.test(value)
  );
}

function safeOptionalId(value: unknown): boolean {
  return value === undefined || isSafeId(value);
}

function nowIso(): string {
  return new Date().toISOString();
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sortedEntries(value: Record<string, unknown>): readonly [string, unknown][] {
  return Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
}

export function canonicalTaskExecutionAuditJson(value: JsonValue): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalTaskExecutionAuditJson(item)).join(",")}]`;
  }

  return `{${sortedEntries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .map(
      ([key, item]) =>
        `${JSON.stringify(key)}:${canonicalTaskExecutionAuditJson(item as JsonValue)}`,
    )
    .join(",")}}`;
}

function jsonClone<T extends JsonValue>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function auditEventIdentity(
  input: TaskExecutionAuditEventIdentityInput,
): string {
  // Strip occurredAt before hashing.  The declared type omits occurredAt, but
  // baseEvent intersects TaskExecutionAuditEventIdentityInput with
  // { occurredAt?: string }, so the runtime object carries the property and the
  // spread would include it in the SHA-256.  Explicitly destructuring it out
  // here keeps the declared type and the runtime hash honestly aligned: the id
  // is derived solely from stable identity fields, making a replay at any time
  // produce the same id and be correctly rejected by the dedup gate.
  //
  // Every other caller of auditEventIdentity passes a value whose runtime shape
  // is TaskExecutionAuditEventIdentityInput (no extra occurredAt) — they are
  // unaffected.  The only caller that intersects occurredAt is baseEvent.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { occurredAt: _stripped, ...identityFields } =
    input as typeof input & { occurredAt?: unknown };
  return `exec-audit-${sha256(
    canonicalTaskExecutionAuditJson(
      jsonClone({
        schemaVersion: AEOS_TASK_EXECUTION_AUDIT_SCHEMA_VERSION,
        ...identityFields,
      } as unknown as JsonObject),
    ),
  ).slice(0, 32)}`;
}

function baseEvent(
  input: TaskExecutionAuditEventIdentityInput & {
    readonly occurredAt?: string;
  },
): Result<TaskExecutionAuditEventDraft, AeosError> {
  if (
    !isSafeId(input.taskId) ||
    !isSafeId(input.attemptId) ||
    !isSafeId(input.invocationId) ||
    !isPositiveInteger(input.taskStateRevision) ||
    !isPositiveInteger(input.binding.taskStateRevision) ||
    input.taskId !== input.binding.taskId ||
    input.taskStateRevision !== input.binding.taskStateRevision ||
    input.attemptId !== input.binding.attemptId ||
    input.invocationId !== input.binding.invocationId ||
    (input.binding.attemptNumber !== undefined &&
      !isPositiveInteger(input.binding.attemptNumber)) ||
    !safeOptionalId(input.binding.workItemId) ||
    !safeOptionalId(input.binding.batchId) ||
    !safeOptionalId(input.adapter?.adapterId) ||
    !safeOptionalId(input.policy?.policyGateId) ||
    !safeOptionalId(input.policy?.policyDecisionReference) ||
    !safeOptionalId(input.credential?.credentialRef) ||
    !safeOptionalId(input.credential?.secretProviderRef) ||
    !safeOptionalId(input.credential?.credentialResolutionReference) ||
    !safeOptionalId(input.resultReference) ||
    !safeOptionalId(input.failureReference) ||
    !safeOptionalId(input.correlation?.traceId)
  ) {
    return err(
      createError(
        "task_execution_audit_event_binding_invalid",
        "Task execution audit event requires safe system-owned task, attempt, invocation, adapter, policy, and credential references.",
        "validation",
      ),
    );
  }

  if (input.adapter !== undefined && input.adapter.operation !== "execute_task_attempt") {
    return err(
      createError(
        "task_execution_audit_operation_not_supported",
        "Task execution audit currently supports only the execute_task_attempt boundary.",
        "validation",
      ),
    );
  }

  return ok({
    schemaVersion: AEOS_TASK_EXECUTION_AUDIT_SCHEMA_VERSION,
    auditEventId: auditEventIdentity(input),
    eventKind: input.eventKind,
    occurredAt: input.occurredAt ?? nowIso(),
    taskId: input.taskId,
    taskStateRevision: input.taskStateRevision,
    attemptId: input.attemptId,
    invocationId: input.invocationId,
    actor: {
      id: "aeos.execution",
      type: "system",
      authority: "system",
    },
    action: input.action,
    target: input.target,
    result: input.result,
    binding: input.binding,
    adapter: input.adapter,
    policy: input.policy,
    credential: input.credential,
    correlation: input.correlation,
    resultReference: input.resultReference,
    failureReference: input.failureReference,
    issues: input.issues,
    redactionStatus: "not_required",
    redactionsApplied: false,
    retentionPolicy: "task_lifetime",
  });
}

function bindingFromInvocationRecord(
  record: TaskExecutionInvocationRecord,
): TaskExecutionAuditBinding {
  return {
    taskId: record.taskId,
    taskStateRevision: record.taskStateRevision,
    attemptId: record.attemptId,
    attemptNumber: record.attemptNumber,
    invocationId: record.invocationId,
    workItemId: record.workItemId,
    batchId: record.batchId,
  };
}

export function createTaskExecutionInvocationDispatchIntentAuditEvent(
  input: CreateTaskExecutionDispatchIntentAuditEventInput,
): Result<TaskExecutionAuditEventDraft, AeosError> {
  const adapterId = input.adapterId ?? input.record.dependencyKind;

  return baseEvent({
    eventKind: "execution_invocation_dispatch_intent",
    occurredAt: input.occurredAt,
    taskId: input.record.taskId,
    taskStateRevision: input.record.taskStateRevision,
    attemptId: input.record.attemptId,
    invocationId: input.record.invocationId,
    action: "record_invocation_dispatch_intent",
    target: {
      type: "tool",
      id: adapterId,
    },
    result: {
      status: "ok",
      referenceId: input.record.invocationId,
    },
    binding: bindingFromInvocationRecord(input.record),
    adapter: {
      adapterId,
      operation: input.operation ?? "execute_task_attempt",
      idempotencyReference: input.record.idempotencyKey,
    },
    policy: {
      policyGateId: input.policyGateId,
      policyDecisionReference: input.policyDecisionReference,
      policyAuthorized: input.policyAuthorized,
      auditRequired: input.auditRequired,
    },
    credential: {
      credentialRef: input.credentialRef,
      secretProviderRef: input.secretProviderRef,
      credentialResolutionReference: input.credentialResolutionReference,
    },
    correlation: {
      correlationId: input.correlationId ?? `corr-${input.record.taskId}`,
    },
    issues: [],
  });
}

export function createTaskExecutionInvocationReturnedAuditEvent(
  input: CreateTaskExecutionInvocationOutcomeAuditEventInput,
): Result<TaskExecutionAuditEventDraft, AeosError> {
  return baseEvent({
    eventKind: "execution_invocation_returned",
    occurredAt: input.occurredAt ?? input.record.result?.returnedAt,
    taskId: input.record.taskId,
    taskStateRevision: input.record.taskStateRevision,
    attemptId: input.record.attemptId,
    invocationId: input.record.invocationId,
    action: "record_invocation_returned",
    target: {
      type: "tool",
      id: input.record.dependencyKind,
    },
    result: {
      status: input.record.result?.invocationOk === true ? "ok" : "partial",
      referenceId: input.record.invocationId,
    },
    binding: bindingFromInvocationRecord(input.record),
    adapter: {
      adapterId: input.record.dependencyKind,
      operation: "execute_task_attempt",
      idempotencyReference: input.record.idempotencyKey,
    },
    resultReference: `invocation-result-r${input.record.revision}`,
    issues: [],
  });
}

export function createTaskExecutionInvocationFailedAuditEvent(
  input: CreateTaskExecutionInvocationOutcomeAuditEventInput,
): Result<TaskExecutionAuditEventDraft, AeosError> {
  return baseEvent({
    eventKind: "execution_invocation_failed",
    occurredAt: input.occurredAt ?? input.record.failure?.failedAt,
    taskId: input.record.taskId,
    taskStateRevision: input.record.taskStateRevision,
    attemptId: input.record.attemptId,
    invocationId: input.record.invocationId,
    action: "record_invocation_failed",
    target: {
      type: "tool",
      id: input.record.dependencyKind,
    },
    result: {
      status: "failed",
      referenceId: input.record.invocationId,
      errorCode: input.record.failure?.code,
    },
    binding: bindingFromInvocationRecord(input.record),
    adapter: {
      adapterId: input.record.dependencyKind,
      operation: "execute_task_attempt",
      idempotencyReference: input.record.idempotencyKey,
    },
    failureReference: `invocation-failure-r${input.record.revision}`,
    issues: input.record.issues.map((item) => ({
      code: item.code,
      message: item.message,
      severity: item.severity === "critical" ? "error" : item.severity,
      category: item.category === "policy_failure" ? "policy" : "unknown",
    })),
  });
}

export function createTaskExecutionInvocationOutcomeUnknownAuditEvent(
  input: CreateTaskExecutionInvocationOutcomeAuditEventInput,
): Result<TaskExecutionAuditEventDraft, AeosError> {
  return baseEvent({
    eventKind: "execution_invocation_outcome_unknown",
    occurredAt: input.occurredAt ?? input.record.outcomeUnknownAt,
    taskId: input.record.taskId,
    taskStateRevision: input.record.taskStateRevision,
    attemptId: input.record.attemptId,
    invocationId: input.record.invocationId,
    action: "record_invocation_outcome_unknown",
    target: {
      type: "tool",
      id: input.record.dependencyKind,
    },
    result: {
      status: "partial",
      referenceId: input.record.invocationId,
    },
    binding: bindingFromInvocationRecord(input.record),
    adapter: {
      adapterId: input.record.dependencyKind,
      operation: "execute_task_attempt",
      idempotencyReference: input.record.idempotencyKey,
    },
    failureReference: `invocation-outcome-unknown-r${input.record.revision}`,
    issues: input.record.issues.map((item) => ({
      code: item.code,
      message: item.message,
      severity: item.severity === "critical" ? "error" : item.severity,
      category: item.category === "policy_failure" ? "policy" : "unknown",
    })),
  });
}

export function createTaskExecutionPermissionEvaluatedAuditEvent(
  input: CreateTaskExecutionPermissionEvaluatedAuditEventInput,
): Result<TaskExecutionAuditEventDraft, AeosError> {
  return baseEvent({
    eventKind: "execution_permission_evaluated",
    occurredAt: input.occurredAt,
    taskId: input.gate.taskId,
    taskStateRevision: input.gate.sourceTaskRevision,
    attemptId: input.gate.attemptId,
    invocationId: input.gate.invocationId,
    action: "evaluate_execution_permission",
    target: {
      type: "policy",
      id: input.gate.policyGateId,
    },
    result: {
      status: input.gate.allowed ? "ok" : input.gate.decision === "denied" ? "denied" : "blocked",
      decision: input.gate.decision,
      referenceId: input.policyDecisionReference,
    },
    binding: {
      taskId: input.gate.taskId,
      taskStateRevision: input.gate.sourceTaskRevision,
      attemptId: input.gate.attemptId,
      invocationId: input.gate.invocationId,
      workItemId: input.gate.workItemId ?? undefined,
      batchId: input.gate.batchId ?? undefined,
    },
    adapter: {
      adapterId: input.gate.adapterId,
      operation: input.gate.operation,
    },
    policy: {
      policyGateId: input.gate.policyGateId,
      policyDecisionReference: input.policyDecisionReference,
      policyAuthorized: input.gate.policyAuthorized,
      auditRequired: input.gate.auditRequired,
    },
    issues: input.gate.issues,
  });
}

export function createTaskExecutionCredentialResolutionEvaluatedAuditEvent(
  input: CreateTaskExecutionCredentialEvaluatedAuditEventInput,
): Result<TaskExecutionAuditEventDraft, AeosError> {
  if (
    input.credential.taskId === null ||
    input.credential.taskRevision === null ||
    input.credential.attemptId === null ||
    input.credential.invocationId === null ||
    input.credential.adapterId === null ||
    input.credential.operationKind === null
  ) {
    return err(
      createError(
        "task_execution_audit_credential_binding_missing",
        "Credential audit event requires a resolved invocation binding.",
        "validation",
      ),
    );
  }

  return baseEvent({
    eventKind: "execution_credential_resolution_evaluated",
    occurredAt: input.occurredAt,
    taskId: input.credential.taskId,
    taskStateRevision: input.credential.taskRevision,
    attemptId: input.credential.attemptId,
    invocationId: input.credential.invocationId,
    action: "evaluate_execution_credential_resolution",
    target: {
      type: "secret",
      id: input.credential.credentialRef ?? undefined,
    },
    result: {
      status: input.credential.ok ? "ok" : "blocked",
      referenceId: input.credential.resolutionReference ?? undefined,
    },
    binding: {
      taskId: input.credential.taskId,
      taskStateRevision: input.credential.taskRevision,
      attemptId: input.credential.attemptId,
      invocationId: input.credential.invocationId,
    },
    adapter: {
      adapterId: input.credential.adapterId,
      operation: input.credential.operationKind,
    },
    policy: {
      policyGateId: input.credential.permissionGateId ?? undefined,
      policyAuthorized: input.credential.policyAuthorized,
    },
    credential: {
      credentialRef: input.credential.credentialRef ?? undefined,
      secretProviderRef: input.credential.providerId ?? undefined,
      credentialResolutionReference:
        input.credential.resolutionReference ?? undefined,
      credentialRequired: input.credential.credentialRequired,
      credentialResolved: input.credential.credentialResolved,
    },
    issues: input.credential.issues,
  });
}

// Factory for the AEOS-owned accounting audit event.  The event is produced by
// applyWorkAccountingEvent after durable invocation evidence is validated — never
// by a worker claiming its own completion.
export function createWorkItemCompletedAccountingAuditEvent(
  input: CreateWorkItemCompletedAccountingAuditEventInput,
): Result<TaskExecutionAuditEventDraft, AeosError> {
  return baseEvent({
    eventKind: "execution_work_accounting_applied",
    occurredAt: input.occurredAt,
    taskId: input.taskId,
    taskStateRevision: input.taskStateRevision,
    attemptId: input.attemptId,
    invocationId: input.invocationId,
    action: "record_work_item_completed",
    target: {
      type: "task",
      id: input.workItemId,
    },
    result: {
      status: "ok",
      referenceId: input.workItemId,
    },
    binding: {
      taskId: input.taskId,
      taskStateRevision: input.taskStateRevision,
      attemptId: input.attemptId,
      attemptNumber: input.attemptNumber,
      invocationId: input.invocationId,
      workItemId: input.workItemId,
      batchId: input.batchId,
    },
    resultReference: input.invocationId,
    issues: [],
  });
}

export function taskExecutionAuditEventDigestPayload(
  event: TaskExecutionAuditEvent,
): JsonObject {
  const { eventDigest: _eventDigest, ...payload } = event;

  return payload as unknown as JsonObject;
}

export function computeTaskExecutionAuditEventDigest(
  event: TaskExecutionAuditEvent,
): string {
  return sha256(canonicalTaskExecutionAuditJson(taskExecutionAuditEventDigestPayload(event)));
}

export function isTaskExecutionAuditEvent(value: unknown): value is TaskExecutionAuditEvent {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.schemaVersion === AEOS_TASK_EXECUTION_AUDIT_SCHEMA_VERSION &&
    isSafeId(value.auditEventId) &&
    typeof value.eventKind === "string" &&
    [
      "execution_permission_evaluated",
      "execution_credential_resolution_evaluated",
      "execution_invocation_dispatch_intent",
      "execution_invocation_returned",
      "execution_invocation_failed",
      "execution_invocation_outcome_unknown",
      "execution_reconciliation_applied",
      "execution_work_accounting_applied",
    ].includes(value.eventKind) &&
    isSafeId(value.taskId) &&
    isPositiveInteger(value.taskStateRevision) &&
    isSafeId(value.attemptId) &&
    isSafeId(value.invocationId) &&
    isRecord(value.binding) &&
    isSafeId(value.binding.taskId) &&
    isPositiveInteger(value.binding.taskStateRevision) &&
    isSafeId(value.binding.attemptId) &&
    isSafeId(value.binding.invocationId) &&
    isPositiveInteger(value.sequence) &&
    (value.previousEventDigest === null ||
      (typeof value.previousEventDigest === "string" &&
        /^[a-f0-9]{64}$/.test(value.previousEventDigest))) &&
    typeof value.eventDigest === "string" &&
    /^[a-f0-9]{64}$/.test(value.eventDigest) &&
    Array.isArray(value.issues)
  );
}
