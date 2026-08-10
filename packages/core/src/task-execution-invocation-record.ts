// @ts-expect-error Node built-ins are available at runtime; this package does not depend on Node ambient types yet.
import { createHash, randomUUID } from "node:crypto";

import type {
  AgenticExecutionAttemptId,
  AgenticLifecycleIssue,
  AgenticTaskId,
  AgenticWorkBatchId,
  AgenticWorkItemId,
} from "./agentic-lifecycle.js";
import type { TaskExecutionFailureCategory } from "./task-execution-attempt.js";
import type { TaskExecutionInvocationDependencyKind } from "./task-execution-invocation.js";
import type { AeosError, JsonObject, JsonValue, Result } from "./types.js";

export const AEOS_TASK_EXECUTION_INVOCATION_RECORD_SCHEMA_VERSION = 1;

export type TaskExecutionInvocationLifecycle =
  | "reserved"
  | "invoking"
  | "returned"
  | "failed"
  | "outcome_unknown";

export type TaskExecutionInvocationOutcomeCertainty =
  | "not_entered"
  | "entered_pending"
  | "known"
  | "unknown";

export interface TaskExecutionInvocationIdentity {
  readonly invocationId: string;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
}

export interface TaskExecutionInvocationOwnership {
  readonly authority: "system";
  readonly ownerId: string;
  readonly ownershipToken: string;
  readonly claimedAt: string;
}

export interface TaskExecutionInvocationRequestReference {
  readonly fingerprint: string;
  readonly allowedOperationReferences: readonly string[];
  readonly verifierRequired: boolean;
  readonly completionGatedByVerifier: boolean;
}

export interface TaskExecutionInvocationResultRecord {
  readonly invocationOk: boolean;
  readonly output?: JsonValue;
  readonly outputReference?: string;
  readonly diagnosticCode?: string;
  readonly message?: string;
  readonly metadata?: JsonObject;
  readonly returnedAt: string;
}

export interface TaskExecutionInvocationFailureRecord {
  readonly code: string;
  readonly category: TaskExecutionFailureCategory;
  readonly diagnostic?: string;
  readonly retryable: boolean;
  readonly failedAt: string;
}

export interface PersistedTaskExecutionInvocationSafety {
  readonly authority: "system";
  readonly dependencyAllowlist: "test_noop_only";
  readonly productionAdapterInvoked: false;
  readonly externalExecutionPerformed: false;
  readonly taskStateModified: false;
  readonly attemptStateModified: false;
  readonly auditWritten: false;
  readonly verifierRun: false;
  readonly policyRuntimeRun: false;
  readonly workCompleted: false;
  readonly taskCompleted: false;
  readonly verified: false;
  readonly approved: false;
  readonly modelSelfReportTrusted: false;
}

export interface TaskExecutionInvocationRecord {
  readonly schemaVersion: typeof AEOS_TASK_EXECUTION_INVOCATION_RECORD_SCHEMA_VERSION;
  readonly invocationId: string;
  readonly idempotencyKey: string;
  readonly taskId: AgenticTaskId;
  readonly taskStateRevision: number;
  readonly attemptId: AgenticExecutionAttemptId;
  readonly attemptNumber: number;
  readonly workItemId?: AgenticWorkItemId;
  readonly batchId?: AgenticWorkBatchId;
  readonly lifecycle: TaskExecutionInvocationLifecycle;
  readonly ownership: TaskExecutionInvocationOwnership;
  readonly dependencyKind: TaskExecutionInvocationDependencyKind;
  readonly request: TaskExecutionInvocationRequestReference;
  readonly result?: TaskExecutionInvocationResultRecord;
  readonly failure?: TaskExecutionInvocationFailureRecord;
  readonly outcomeCertainty: TaskExecutionInvocationOutcomeCertainty;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly enteredAt?: string;
  readonly outcomeUnknownAt?: string;
  readonly safety: PersistedTaskExecutionInvocationSafety;
  readonly issues: readonly AgenticLifecycleIssue[];
}

export interface DeriveTaskExecutionInvocationIdentityInput {
  readonly taskId: AgenticTaskId;
  readonly taskStateRevision: number;
  readonly attemptId: AgenticExecutionAttemptId;
  readonly attemptNumber: number;
  readonly workItemId?: AgenticWorkItemId;
  readonly batchId?: AgenticWorkBatchId;
  readonly dependencyKind: TaskExecutionInvocationDependencyKind;
  readonly allowedOperationReferences?: readonly string[];
  readonly verifierRequired: boolean;
  readonly completionGatedByVerifier: boolean;
}

export interface CreateReservedTaskExecutionInvocationRecordInput
  extends DeriveTaskExecutionInvocationIdentityInput {
  readonly claimedAt?: string;
  readonly ownerId?: string;
  readonly ownershipToken?: string;
}

export type TaskExecutionInvocationRecordTransitionIntent =
  | {
      readonly kind: "enter_invocation";
      readonly occurredAt?: string;
    }
  | {
      readonly kind: "record_returned";
      readonly result: Omit<TaskExecutionInvocationResultRecord, "returnedAt"> &
        Partial<Pick<TaskExecutionInvocationResultRecord, "returnedAt">>;
    }
  | {
      readonly kind: "record_failed";
      readonly failure: Omit<TaskExecutionInvocationFailureRecord, "failedAt"> &
        Partial<Pick<TaskExecutionInvocationFailureRecord, "failedAt">>;
    }
  | {
      readonly kind: "mark_outcome_unknown";
      readonly occurredAt?: string;
      readonly issue?: AgenticLifecycleIssue;
    };

export interface TransitionTaskExecutionInvocationRecordInput {
  readonly record: unknown;
  readonly intent: unknown;
}

export type TaskExecutionInvocationRecordError = AeosError;

const safeIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/;

const allowedLifecycles = new Set<string>([
  "reserved",
  "invoking",
  "returned",
  "failed",
  "outcome_unknown",
]);

const forbiddenLifecycles = new Set<string>([
  "completed",
  "verified",
  "approved",
  "task_success",
  "execution_success",
  "succeeded",
]);

const allowedOutcomeCertainty = new Set<string>([
  "not_entered",
  "entered_pending",
  "known",
  "unknown",
]);

const allowedFailureCategories = new Set<string>([
  "scope_failure",
  "policy_failure",
  "execution_failure",
  "verification_failure",
  "coverage_failure",
  "artifact_failure",
  "adapter_failure",
  "audit_failure",
  "resume_failure",
  "unknown",
]);

function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

function err(
  error: TaskExecutionInvocationRecordError,
): Result<never, TaskExecutionInvocationRecordError> {
  return { ok: false, error };
}

function createError(
  code: string,
  message: string,
  category: AeosError["category"],
  details?: Record<string, string | number | boolean | null>,
): TaskExecutionInvocationRecordError {
  if (details === undefined) {
    return {
      code,
      message,
      category,
      retryable: false,
    };
  }

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

function isJsonValue(value: unknown, depth = 0): value is JsonValue {
  if (depth > 8) {
    return false;
  }

  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return Number.isFinite(value as number) || typeof value !== "number";
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

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isSafeId(value: string): boolean {
  return (
    value === value.trim() &&
    value !== "." &&
    value !== ".." &&
    !value.includes("/") &&
    !value.includes("\\") &&
    safeIdPattern.test(value)
  );
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalAuthorityPayload(
  input: DeriveTaskExecutionInvocationIdentityInput,
): string {
  return JSON.stringify({
    schemaVersion: AEOS_TASK_EXECUTION_INVOCATION_RECORD_SCHEMA_VERSION,
    taskId: input.taskId,
    taskStateRevision: input.taskStateRevision,
    attemptId: input.attemptId,
    attemptNumber: input.attemptNumber,
    workItemId: input.workItemId ?? null,
    batchId: input.batchId ?? null,
    dependencyKind: input.dependencyKind,
    verifierRequired: input.verifierRequired,
    completionGatedByVerifier: input.completionGatedByVerifier,
  });
}

function canonicalRequestPayload(
  input: DeriveTaskExecutionInvocationIdentityInput,
): string {
  return JSON.stringify({
    authority: JSON.parse(canonicalAuthorityPayload(input)) as JsonObject,
    allowedOperationReferences: [
      ...(input.allowedOperationReferences ?? []),
    ].sort(),
  });
}

function safeText(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }

  const trimmed = value.trim();

  if (
    trimmed.length === 0 ||
    trimmed.length > 512 ||
    /(\n\s*at\s+|Error:|stack)/i.test(trimmed)
  ) {
    return undefined;
  }

  return trimmed;
}

function jsonWithinRecordLimit(value: unknown): boolean {
  if (!isJsonValue(value)) {
    return false;
  }

  return JSON.stringify(value).length <= 16_384;
}

function createSafety(): PersistedTaskExecutionInvocationSafety {
  return {
    authority: "system",
    dependencyAllowlist: "test_noop_only",
    productionAdapterInvoked: false,
    externalExecutionPerformed: false,
    taskStateModified: false,
    attemptStateModified: false,
    auditWritten: false,
    verifierRun: false,
    policyRuntimeRun: false,
    workCompleted: false,
    taskCompleted: false,
    verified: false,
    approved: false,
    modelSelfReportTrusted: false,
  };
}

export function deriveTaskExecutionInvocationIdentity(
  input: DeriveTaskExecutionInvocationIdentityInput,
): Result<TaskExecutionInvocationIdentity, TaskExecutionInvocationRecordError> {
  if (
    typeof input.taskId !== "string" ||
    !isSafeId(input.taskId) ||
    typeof input.attemptId !== "string" ||
    !isSafeId(input.attemptId) ||
    !isPositiveInteger(input.taskStateRevision) ||
    !isPositiveInteger(input.attemptNumber) ||
    input.dependencyKind !== "test_noop" ||
    typeof input.verifierRequired !== "boolean" ||
    input.completionGatedByVerifier !== true
  ) {
    return err(
      createError(
        "task_execution_invocation_identity_input_invalid",
        "Task execution invocation identity requires safe system-owned task, attempt, revision, and dependency context.",
        "validation",
      ),
    );
  }

  if (
    (input.workItemId !== undefined &&
      (typeof input.workItemId !== "string" ||
        input.workItemId.length === 0)) ||
    (input.batchId !== undefined &&
      (typeof input.batchId !== "string" || input.batchId.length === 0)) ||
    (input.allowedOperationReferences !== undefined &&
      !isStringArray(input.allowedOperationReferences))
  ) {
    return err(
      createError(
        "task_execution_invocation_identity_reference_invalid",
        "Task execution invocation identity references must be system-provided strings.",
        "validation",
      ),
    );
  }

  const authorityPayload = canonicalAuthorityPayload(input);
  const requestPayload = canonicalRequestPayload(input);
  const identityHash = sha256(`identity:${authorityPayload}`);
  const requestFingerprint = sha256(`request:${requestPayload}`);

  return ok({
    invocationId: `invocation-r${input.taskStateRevision}-n${input.attemptNumber}-${identityHash.slice(0, 24)}`,
    idempotencyKey: `aeos-invocation-v1-${sha256(`idempotency:${authorityPayload}`)}`,
    requestFingerprint,
  });
}

export function createReservedTaskExecutionInvocationRecord(
  input: CreateReservedTaskExecutionInvocationRecordInput,
): Result<TaskExecutionInvocationRecord, TaskExecutionInvocationRecordError> {
  const identityResult = deriveTaskExecutionInvocationIdentity(input);

  if (!identityResult.ok) {
    return identityResult;
  }

  const claimedAt = input.claimedAt ?? new Date().toISOString();
  const ownershipToken = input.ownershipToken ?? randomUUID();
  const ownerId = input.ownerId ?? `owner-${randomUUID()}`;

  if (!isSafeId(ownerId) || !isSafeId(ownershipToken)) {
    return err(
      createError(
        "task_execution_invocation_ownership_invalid",
        "Task execution invocation ownership identifiers must be system-generated safe identifiers.",
        "validation",
      ),
    );
  }

  const record: TaskExecutionInvocationRecord = {
    schemaVersion: AEOS_TASK_EXECUTION_INVOCATION_RECORD_SCHEMA_VERSION,
    invocationId: identityResult.value.invocationId,
    idempotencyKey: identityResult.value.idempotencyKey,
    taskId: input.taskId,
    taskStateRevision: input.taskStateRevision,
    attemptId: input.attemptId,
    attemptNumber: input.attemptNumber,
    workItemId: input.workItemId,
    batchId: input.batchId,
    lifecycle: "reserved",
    ownership: {
      authority: "system",
      ownerId,
      ownershipToken,
      claimedAt,
    },
    dependencyKind: input.dependencyKind,
    request: {
      fingerprint: identityResult.value.requestFingerprint,
      allowedOperationReferences: [
        ...(input.allowedOperationReferences ?? []),
      ].sort(),
      verifierRequired: input.verifierRequired,
      completionGatedByVerifier: input.completionGatedByVerifier,
    },
    outcomeCertainty: "not_entered",
    revision: 1,
    createdAt: claimedAt,
    updatedAt: claimedAt,
    safety: createSafety(),
    issues: [],
  };

  return validateTaskExecutionInvocationRecord(record);
}

function validateResultRecord(
  value: unknown,
): Result<TaskExecutionInvocationResultRecord, TaskExecutionInvocationRecordError> {
  if (
    !isRecord(value) ||
    typeof value.invocationOk !== "boolean" ||
    typeof value.returnedAt !== "string" ||
    value.returnedAt.length === 0
  ) {
    return err(
      createError(
        "task_execution_invocation_result_invalid",
        "Task execution invocation returned result must be structured system-owned invocation evidence.",
        "validation",
      ),
    );
  }

  if (
    value.output !== undefined &&
    !jsonWithinRecordLimit(value.output)
  ) {
    return err(
      createError(
        "task_execution_invocation_result_output_invalid",
        "Task execution invocation result output must be bounded JSON diagnostic data.",
        "validation",
      ),
    );
  }

  if (
    value.metadata !== undefined &&
    (!isJsonObject(value.metadata) || !jsonWithinRecordLimit(value.metadata))
  ) {
    return err(
      createError(
        "task_execution_invocation_result_metadata_invalid",
        "Task execution invocation result metadata must be bounded JSON diagnostic data.",
        "validation",
      ),
    );
  }

  for (const field of ["outputReference", "diagnosticCode", "message"] as const) {
    if (value[field] !== undefined && safeText(value[field]) === undefined) {
      return err(
        createError(
          "task_execution_invocation_result_text_invalid",
          "Task execution invocation result text cannot persist raw stack traces or oversized prose.",
          "validation",
          { field },
        ),
      );
    }
  }

  return ok(value as unknown as TaskExecutionInvocationResultRecord);
}

function validateFailureRecord(
  value: unknown,
): Result<TaskExecutionInvocationFailureRecord, TaskExecutionInvocationRecordError> {
  if (
    !isRecord(value) ||
    typeof value.code !== "string" ||
    safeText(value.code) === undefined ||
    typeof value.category !== "string" ||
    !allowedFailureCategories.has(value.category) ||
    typeof value.retryable !== "boolean" ||
    typeof value.failedAt !== "string" ||
    value.failedAt.length === 0
  ) {
    return err(
      createError(
        "task_execution_invocation_failure_invalid",
        "Task execution invocation failure must be structured system-owned failure evidence.",
        "validation",
      ),
    );
  }

  if (value.diagnostic !== undefined && safeText(value.diagnostic) === undefined) {
    return err(
      createError(
        "task_execution_invocation_failure_diagnostic_invalid",
        "Task execution invocation failure diagnostic cannot persist raw stack traces or oversized prose.",
        "validation",
      ),
    );
  }

  return ok(value as unknown as TaskExecutionInvocationFailureRecord);
}

export function validateTaskExecutionInvocationRecord(
  value: unknown,
): Result<TaskExecutionInvocationRecord, TaskExecutionInvocationRecordError> {
  if (!isRecord(value)) {
    return err(
      createError(
        "task_execution_invocation_record_invalid_shape",
        "Task execution invocation record must be a JSON object.",
        "validation",
      ),
    );
  }

  if (
    value.schemaVersion !== AEOS_TASK_EXECUTION_INVOCATION_RECORD_SCHEMA_VERSION
  ) {
    return err(
      createError(
        "task_execution_invocation_record_schema_version_unsupported",
        "Task execution invocation record schema version is unsupported.",
        "validation",
      ),
    );
  }

  if (typeof value.lifecycle !== "string") {
    return err(
      createError(
        "task_execution_invocation_lifecycle_required",
        "Task execution invocation lifecycle is required.",
        "validation",
      ),
    );
  }

  if (forbiddenLifecycles.has(value.lifecycle)) {
    return err(
      createError(
        "task_execution_invocation_lifecycle_forbidden",
        "Task execution invocation lifecycle cannot claim task completion, verification, approval, or success authority.",
        "validation",
        { lifecycle: value.lifecycle },
      ),
    );
  }

  if (!allowedLifecycles.has(value.lifecycle)) {
    return err(
      createError(
        "task_execution_invocation_lifecycle_unknown",
        "Task execution invocation lifecycle is unknown.",
        "validation",
        { lifecycle: value.lifecycle },
      ),
    );
  }

  if (
    typeof value.invocationId !== "string" ||
    !isSafeId(value.invocationId) ||
    typeof value.idempotencyKey !== "string" ||
    value.idempotencyKey.length === 0 ||
    typeof value.taskId !== "string" ||
    !isSafeId(value.taskId) ||
    typeof value.attemptId !== "string" ||
    !isSafeId(value.attemptId) ||
    !isPositiveInteger(value.taskStateRevision) ||
    !isPositiveInteger(value.attemptNumber) ||
    value.dependencyKind !== "test_noop" ||
    !isRecord(value.ownership) ||
    value.ownership.authority !== "system" ||
    typeof value.ownership.ownerId !== "string" ||
    !isSafeId(value.ownership.ownerId) ||
    typeof value.ownership.ownershipToken !== "string" ||
    !isSafeId(value.ownership.ownershipToken) ||
    typeof value.ownership.claimedAt !== "string" ||
    value.ownership.claimedAt.length === 0 ||
    !isRecord(value.request) ||
    typeof value.request.fingerprint !== "string" ||
    !isStringArray(value.request.allowedOperationReferences) ||
    typeof value.request.verifierRequired !== "boolean" ||
    value.request.completionGatedByVerifier !== true ||
    typeof value.outcomeCertainty !== "string" ||
    !allowedOutcomeCertainty.has(value.outcomeCertainty) ||
    !isPositiveInteger(value.revision) ||
    typeof value.createdAt !== "string" ||
    value.createdAt.length === 0 ||
    typeof value.updatedAt !== "string" ||
    value.updatedAt.length === 0 ||
    !isRecord(value.safety) ||
    !Array.isArray(value.issues)
  ) {
    return err(
      createError(
        "task_execution_invocation_record_required_fields_invalid",
        "Task execution invocation record required authority fields are invalid.",
        "validation",
      ),
    );
  }

  if (
    (value.workItemId !== undefined &&
      (typeof value.workItemId !== "string" || value.workItemId.length === 0)) ||
    (value.batchId !== undefined &&
      (typeof value.batchId !== "string" || value.batchId.length === 0))
  ) {
    return err(
      createError(
        "task_execution_invocation_record_binding_invalid",
        "Task execution invocation work and batch bindings must be stable strings when present.",
        "validation",
      ),
    );
  }

  const identityResult = deriveTaskExecutionInvocationIdentity({
    taskId: value.taskId,
    taskStateRevision: value.taskStateRevision,
    attemptId: value.attemptId,
    attemptNumber: value.attemptNumber,
    workItemId: value.workItemId as AgenticWorkItemId | undefined,
    batchId: value.batchId as AgenticWorkBatchId | undefined,
    dependencyKind: value.dependencyKind as TaskExecutionInvocationDependencyKind,
    allowedOperationReferences: value.request.allowedOperationReferences,
    verifierRequired: value.request.verifierRequired,
    completionGatedByVerifier: value.request.completionGatedByVerifier,
  });

  if (!identityResult.ok) {
    return identityResult;
  }

  if (
    value.invocationId !== identityResult.value.invocationId ||
    value.idempotencyKey !== identityResult.value.idempotencyKey ||
    value.request.fingerprint !== identityResult.value.requestFingerprint
  ) {
    return err(
      createError(
        "task_execution_invocation_identity_mismatch",
        "Task execution invocation record identity must match the system-derived attempt context.",
        "validation",
      ),
    );
  }

  if (
    value.safety.authority !== "system" ||
    value.safety.dependencyAllowlist !== "test_noop_only" ||
    value.safety.productionAdapterInvoked !== false ||
    value.safety.externalExecutionPerformed !== false ||
    value.safety.taskStateModified !== false ||
    value.safety.attemptStateModified !== false ||
    value.safety.auditWritten !== false ||
    value.safety.verifierRun !== false ||
    value.safety.policyRuntimeRun !== false ||
    value.safety.workCompleted !== false ||
    value.safety.taskCompleted !== false ||
    value.safety.verified !== false ||
    value.safety.approved !== false ||
    value.safety.modelSelfReportTrusted !== false
  ) {
    return err(
      createError(
        "task_execution_invocation_forbidden_safety_metadata",
        "Task execution invocation record safety metadata cannot claim production execution, completion, verification, approval, or model self-report trust.",
        "validation",
      ),
    );
  }

  if (value.result !== undefined) {
    const resultRecord = validateResultRecord(value.result);

    if (!resultRecord.ok) {
      return resultRecord;
    }
  }

  if (value.failure !== undefined) {
    const failureRecord = validateFailureRecord(value.failure);

    if (!failureRecord.ok) {
      return failureRecord;
    }
  }

  if (
    value.lifecycle === "reserved" &&
    (value.enteredAt !== undefined ||
      value.result !== undefined ||
      value.failure !== undefined ||
      value.outcomeUnknownAt !== undefined ||
      value.outcomeCertainty !== "not_entered")
  ) {
    return err(
      createError(
        "task_execution_invocation_reserved_record_invalid",
        "Reserved invocation records cannot claim entry, result, failure, or unknown outcome.",
        "validation",
      ),
    );
  }

  if (
    value.lifecycle === "invoking" &&
    (typeof value.enteredAt !== "string" ||
      value.enteredAt.length === 0 ||
      value.result !== undefined ||
      value.failure !== undefined ||
      value.outcomeUnknownAt !== undefined ||
      value.outcomeCertainty !== "entered_pending")
  ) {
    return err(
      createError(
        "task_execution_invocation_invoking_record_invalid",
        "Invoking records require entry evidence and cannot claim result or failure.",
        "validation",
      ),
    );
  }

  if (
    value.lifecycle === "returned" &&
    (typeof value.enteredAt !== "string" ||
      value.result === undefined ||
      value.failure !== undefined ||
      value.outcomeUnknownAt !== undefined ||
      value.outcomeCertainty !== "known")
  ) {
    return err(
      createError(
        "task_execution_invocation_returned_record_invalid",
        "Returned invocation records require structured result evidence only.",
        "validation",
      ),
    );
  }

  if (
    value.lifecycle === "failed" &&
    (typeof value.enteredAt !== "string" ||
      value.result !== undefined ||
      value.failure === undefined ||
      value.outcomeUnknownAt !== undefined ||
      value.outcomeCertainty !== "known")
  ) {
    return err(
      createError(
        "task_execution_invocation_failed_record_invalid",
        "Failed invocation records require structured deterministic failure evidence only.",
        "validation",
      ),
    );
  }

  if (
    value.lifecycle === "outcome_unknown" &&
    (typeof value.enteredAt !== "string" ||
      value.result !== undefined ||
      value.failure !== undefined ||
      typeof value.outcomeUnknownAt !== "string" ||
      value.outcomeUnknownAt.length === 0 ||
      value.outcomeCertainty !== "unknown")
  ) {
    return err(
      createError(
        "task_execution_invocation_unknown_record_invalid",
        "Outcome-unknown invocation records require explicit unknown outcome evidence and no result.",
        "validation",
      ),
    );
  }

  return ok(value as unknown as TaskExecutionInvocationRecord);
}

function validateTransitionIntent(
  value: unknown,
): Result<
  TaskExecutionInvocationRecordTransitionIntent,
  TaskExecutionInvocationRecordError
> {
  if (!isRecord(value) || typeof value.kind !== "string") {
    return err(
      createError(
        "task_execution_invocation_transition_unknown",
        "Task execution invocation transition intent is unknown or unsupported.",
        "validation",
      ),
    );
  }

  if (value.kind === "enter_invocation") {
    return ok({
      kind: "enter_invocation",
      occurredAt:
        typeof value.occurredAt === "string" ? value.occurredAt : undefined,
    });
  }

  if (value.kind === "record_returned") {
    const result = isRecord(value.result)
      ? {
          ...value.result,
          returnedAt:
            typeof value.result.returnedAt === "string"
              ? value.result.returnedAt
              : new Date().toISOString(),
        }
      : undefined;
    const resultValidation = validateResultRecord(result);

    if (!resultValidation.ok) {
      return resultValidation;
    }

    return ok({ kind: "record_returned", result: resultValidation.value });
  }

  if (value.kind === "record_failed") {
    const failure = isRecord(value.failure)
      ? {
          ...value.failure,
          failedAt:
            typeof value.failure.failedAt === "string"
              ? value.failure.failedAt
              : new Date().toISOString(),
        }
      : undefined;
    const failureValidation = validateFailureRecord(failure);

    if (!failureValidation.ok) {
      return failureValidation;
    }

    return ok({ kind: "record_failed", failure: failureValidation.value });
  }

  if (value.kind === "mark_outcome_unknown") {
    return ok({
      kind: "mark_outcome_unknown",
      occurredAt:
        typeof value.occurredAt === "string" ? value.occurredAt : undefined,
      issue: isRecord(value.issue)
        ? (value.issue as unknown as AgenticLifecycleIssue)
        : undefined,
    });
  }

  return err(
    createError(
      "task_execution_invocation_transition_unknown",
      "Task execution invocation transition intent is unknown or unsupported.",
      "validation",
      { intent: value.kind },
    ),
  );
}

export function transitionTaskExecutionInvocationRecord(
  input: TransitionTaskExecutionInvocationRecordInput,
): Result<TaskExecutionInvocationRecord, TaskExecutionInvocationRecordError> {
  const recordResult = validateTaskExecutionInvocationRecord(input.record);

  if (!recordResult.ok) {
    return recordResult;
  }

  const intentResult = validateTransitionIntent(input.intent);

  if (!intentResult.ok) {
    return intentResult;
  }

  const record = recordResult.value;
  const intent = intentResult.value;

  if (record.lifecycle === "reserved" && intent.kind === "enter_invocation") {
    const occurredAt = intent.occurredAt ?? new Date().toISOString();

    return validateTaskExecutionInvocationRecord({
      ...record,
      lifecycle: "invoking",
      enteredAt: occurredAt,
      outcomeCertainty: "entered_pending",
      revision: record.revision + 1,
      updatedAt: occurredAt,
    });
  }

  if (record.lifecycle === "invoking" && intent.kind === "record_returned") {
    const returnedAt =
      intent.result.returnedAt ?? new Date().toISOString();

    return validateTaskExecutionInvocationRecord({
      ...record,
      lifecycle: "returned",
      result: {
        ...intent.result,
        returnedAt,
      },
      outcomeCertainty: "known",
      revision: record.revision + 1,
      updatedAt: returnedAt,
    });
  }

  if (record.lifecycle === "invoking" && intent.kind === "record_failed") {
    const failedAt = intent.failure.failedAt ?? new Date().toISOString();

    return validateTaskExecutionInvocationRecord({
      ...record,
      lifecycle: "failed",
      failure: {
        ...intent.failure,
        failedAt,
      },
      outcomeCertainty: "known",
      revision: record.revision + 1,
      updatedAt: failedAt,
    });
  }

  if (
    record.lifecycle === "invoking" &&
    intent.kind === "mark_outcome_unknown"
  ) {
    const occurredAt = intent.occurredAt ?? new Date().toISOString();

    return validateTaskExecutionInvocationRecord({
      ...record,
      lifecycle: "outcome_unknown",
      outcomeCertainty: "unknown",
      outcomeUnknownAt: occurredAt,
      issues:
        intent.issue === undefined
          ? record.issues
          : [...record.issues, intent.issue],
      revision: record.revision + 1,
      updatedAt: occurredAt,
    });
  }

  return err(
    createError(
      "task_execution_invocation_transition_not_allowed",
      "Task execution invocation transition is not allowed from the current lifecycle.",
      "validation",
      { lifecycle: record.lifecycle, intent: intent.kind },
    ),
  );
}
