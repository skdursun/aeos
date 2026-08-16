import type { AgenticExecutionAttemptId, AgenticTaskId } from "./agentic-lifecycle.js";
import type { TaskExecutionFailureCategory } from "./task-execution-attempt.js";
import { loadTaskExecutionAttempt } from "./task-execution-attempt-persistence.js";
import type {
  TaskExecutionInvocationFailureRecord,
  TaskExecutionInvocationLifecycle,
  TaskExecutionInvocationRecord,
  TaskExecutionInvocationResultRecord,
} from "./task-execution-invocation-record.js";
import { validateTaskExecutionInvocationRecord } from "./task-execution-invocation-record.js";
import {
  loadTaskExecutionInvocation,
  updateTaskExecutionInvocation,
} from "./task-execution-invocation-persistence.js";
import { loadTaskState } from "./task-state-persistence.js";
import type { AeosError, JsonObject, JsonValue } from "./types.js";

export type TaskExecutionInvocationReconciliationRecordStatus =
  | "loaded"
  | "missing"
  | "corrupt";

export type TaskExecutionInvocationReconciliationStatus =
  | TaskExecutionInvocationLifecycle
  | "missing"
  | "corrupt";

export type TaskExecutionInvocationReconciliationAction =
  | "use_persisted_result"
  | "no_action"
  | "reconciliation_required"
  | "explicit_retry_required"
  | "operator_review_required"
  | "recover_reservation";

export interface TaskExecutionInvocationProviderReconciliationCapabilities {
  readonly supportsIdempotencyKey: boolean;
  readonly supportsLookupByIdempotencyKey: boolean;
  readonly supportsInvocationStatusQuery: boolean;
  readonly supportsResultReplay: boolean;
}

export type TaskExecutionInvocationProviderReconciliationEvidence =
  | {
      readonly kind: "provider_not_found";
      readonly idempotencyKey: string;
      readonly observedAt?: string;
    }
  | {
      readonly kind: "provider_in_progress";
      readonly idempotencyKey: string;
      readonly observedAt?: string;
    }
  | {
      readonly kind: "provider_returned";
      readonly idempotencyKey: string;
      readonly invocationOk: boolean;
      readonly output?: JsonValue;
      readonly resultReference?: string;
      readonly diagnosticCode?: string;
      readonly message?: string;
      readonly metadata?: JsonObject;
      readonly observedAt?: string;
    }
  | {
      readonly kind: "provider_failed";
      readonly idempotencyKey: string;
      readonly failureCode: string;
      readonly failureCategory?: TaskExecutionFailureCategory;
      readonly retryable: boolean;
      readonly diagnostic?: string;
      readonly observedAt?: string;
    }
  | {
      readonly kind: "provider_status_unavailable";
      readonly observedAt?: string;
    };

export type TaskExecutionInvocationReconciliationEvidenceConclusion =
  | "none"
  | "unsupported"
  | "status_unavailable"
  | "not_found"
  | "in_progress"
  | "returned"
  | "failed"
  | "idempotency_mismatch"
  | "invalid";

export interface TaskExecutionInvocationReconciliationIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: "info" | "warning" | "error";
  readonly category: AeosError["category"];
}

export interface TaskExecutionInvocationReconciliationRecordReference {
  readonly taskId: AgenticTaskId | null;
  readonly invocationId: string | null;
  readonly idempotencyReference: string | null;
  readonly attemptId: AgenticExecutionAttemptId | null;
  readonly attemptNumber: number | null;
  readonly sourceTaskRevision: number | null;
  readonly currentTaskRevision: number | null;
  readonly staleAgainstCurrentTask: boolean | null;
}

export interface TaskExecutionInvocationReconciliationPersistedResult {
  readonly invocationOk: boolean;
  readonly outputReference: string | null;
  readonly diagnosticCode: string | null;
  readonly message: string | null;
  readonly returnedAt: string;
}

export interface TaskExecutionInvocationReconciliationRetryPlan {
  readonly priorInvocationId: string;
  readonly priorAttemptId: AgenticExecutionAttemptId;
  readonly failureCode: string;
  readonly failureCategory: TaskExecutionFailureCategory;
  readonly retryableBySystem: boolean;
  readonly sourceTaskRevision: number;
  readonly requiresNewAuthority: true;
}

export interface TaskExecutionInvocationReconciliationInput {
  readonly recordStatus?: TaskExecutionInvocationReconciliationRecordStatus;
  readonly record?: unknown;
  readonly taskId?: AgenticTaskId;
  readonly invocationId?: string;
  readonly currentTaskRevision?: number;
  readonly reservationRecovery?: {
    readonly sameRecordRecoveryAuthorized: boolean;
  };
  readonly providerCapabilities?: unknown;
  readonly evidence?: unknown;
  readonly selfReport?: unknown;
  readonly providerCapabilityClaims?: unknown;
}

export interface TaskExecutionInvocationAuthoritativeReconciliationEvidenceSource {
  readonly kind: "test_authoritative";
  readonly sourceId?: string;
}

export type TaskExecutionInvocationAuthoritativeReconciliationEvidence =
  TaskExecutionInvocationProviderReconciliationEvidence & {
    readonly source: TaskExecutionInvocationAuthoritativeReconciliationEvidenceSource;
  };

export interface TaskExecutionInvocationReconciliationEvidenceSource {
  readonly source: TaskExecutionInvocationAuthoritativeReconciliationEvidenceSource;
  readonly getEvidence: (input: {
    readonly taskId: AgenticTaskId;
    readonly invocationId: string;
    readonly idempotencyKey: string;
    readonly lifecycle: TaskExecutionInvocationLifecycle;
    readonly recordRevision: number;
    readonly currentTaskRevision: number | null;
    readonly staleAgainstCurrentTask: boolean | null;
  }) =>
    | TaskExecutionInvocationAuthoritativeReconciliationEvidence
    | unknown
    | Promise<TaskExecutionInvocationAuthoritativeReconciliationEvidence | unknown>;
}

export interface TaskExecutionInvocationReconciliationApplySafety {
  readonly providerCalledByAEOS: false;
  readonly dependencyInvoked: false;
  readonly retryPerformed: false;
  readonly taskModified: false;
  readonly attemptModified: false;
  readonly workCompleted: false;
  readonly taskCompleted: false;
  readonly verifierRun: false;
  readonly auditWritten: false;
  readonly policyRuntimeRun: false;
  readonly ownershipSecretRendered: false;
}

export interface ApplyTaskExecutionInvocationReconciliationInput {
  readonly projectRoot: string;
  readonly taskId: AgenticTaskId;
  readonly invocationId: string;
  readonly expectedInvocationRevision?: number;
  readonly evidenceSource?: unknown;
}

export interface TaskExecutionInvocationReconciliationApplyResult {
  readonly ok: boolean;
  readonly status:
    | "reconciliation_applied"
    | "reconciliation_unresolved"
    | "reconciliation_not_required"
    | "reconciliation_blocked";
  readonly reconciliationApplied: boolean;
  readonly previousLifecycle: TaskExecutionInvocationLifecycle | null;
  readonly lifecycle: TaskExecutionInvocationLifecycle | null;
  readonly evidenceKind: TaskExecutionInvocationProviderReconciliationEvidence["kind"] | null;
  readonly evidenceConclusion: TaskExecutionInvocationReconciliationEvidenceConclusion;
  readonly outcomeKnown: boolean;
  readonly reconciliationRequired: boolean;
  readonly retryRequiresNewAuthority: boolean;
  readonly safeToBlindRetry: false;
  readonly currentAuthorityEligible: boolean;
  readonly record: TaskExecutionInvocationReconciliationRecordReference;
  readonly persistedResult: TaskExecutionInvocationReconciliationPersistedResult | null;
  readonly retryPlan: TaskExecutionInvocationReconciliationRetryPlan | null;
  readonly safety: TaskExecutionInvocationReconciliationApplySafety;
  readonly issues: readonly TaskExecutionInvocationReconciliationIssue[];
}

export interface TaskExecutionInvocationReconciliationResult {
  readonly status: TaskExecutionInvocationReconciliationStatus;
  readonly action: TaskExecutionInvocationReconciliationAction;
  readonly lifecycle: TaskExecutionInvocationLifecycle | null;
  readonly record: TaskExecutionInvocationReconciliationRecordReference;
  readonly currentAuthorityEligible: boolean;
  readonly persistedResult: TaskExecutionInvocationReconciliationPersistedResult | null;
  readonly retryPlan: TaskExecutionInvocationReconciliationRetryPlan | null;
  readonly providerCapabilities: TaskExecutionInvocationProviderReconciliationCapabilities | null;
  readonly evidenceConclusion: TaskExecutionInvocationReconciliationEvidenceConclusion;
  readonly safeToBlindRetry: false;
  readonly retryRequiresNewAuthority: boolean;
  readonly reconciliationRequired: boolean;
  readonly workCompleted: false;
  readonly taskCompleted: false;
  readonly verifierSatisfied: false;
  readonly lifecycleMutationPlanned: false;
  readonly taskStateMutationPlanned: false;
  readonly attemptStateMutationPlanned: false;
  readonly issues: readonly TaskExecutionInvocationReconciliationIssue[];
}

export interface TaskExecutionInvocationReconciliationSummary {
  readonly status: TaskExecutionInvocationReconciliationStatus;
  readonly action: TaskExecutionInvocationReconciliationAction;
  readonly safeToBlindRetry: false;
  readonly retryRequiresNewAuthority: boolean;
  readonly reconciliationRequired: boolean;
  readonly staleAgainstCurrentTask: boolean | null;
  readonly currentAuthorityEligible: boolean;
  readonly evidenceConclusion: TaskExecutionInvocationReconciliationEvidenceConclusion;
  readonly issueCodes: readonly string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCapabilities(
  value: unknown,
): value is TaskExecutionInvocationProviderReconciliationCapabilities {
  return (
    isRecord(value) &&
    typeof value.supportsIdempotencyKey === "boolean" &&
    typeof value.supportsLookupByIdempotencyKey === "boolean" &&
    typeof value.supportsInvocationStatusQuery === "boolean" &&
    typeof value.supportsResultReplay === "boolean"
  );
}

function isEvidenceSource(
  value: unknown,
): value is TaskExecutionInvocationReconciliationEvidenceSource {
  return (
    isRecord(value) &&
    isRecord(value.source) &&
    value.source.kind === "test_authoritative" &&
    (value.source.sourceId === undefined ||
      typeof value.source.sourceId === "string") &&
    typeof value.getEvidence === "function"
  );
}

function hasAuthoritativeEvidenceSource(
  value: unknown,
): value is TaskExecutionInvocationAuthoritativeReconciliationEvidence {
  if (!isRecord(value)) {
    return false;
  }

  const source = value.source;

  return (
    isEvidence(value) &&
    isRecord(source) &&
    source.kind === "test_authoritative" &&
    (source.sourceId === undefined || typeof source.sourceId === "string")
  );
}

function isEvidence(
  value: unknown,
): value is TaskExecutionInvocationProviderReconciliationEvidence {
  if (!isRecord(value) || typeof value.kind !== "string") {
    return false;
  }

  if (value.kind === "provider_status_unavailable") {
    return true;
  }

  if (typeof value.idempotencyKey !== "string" || value.idempotencyKey.length === 0) {
    return false;
  }

  if (value.kind === "provider_not_found" || value.kind === "provider_in_progress") {
    return true;
  }

  if (value.kind === "provider_returned") {
    return typeof value.invocationOk === "boolean";
  }

  if (value.kind === "provider_failed") {
    return (
      typeof value.failureCode === "string" &&
      value.failureCode.length > 0 &&
      typeof value.retryable === "boolean"
    );
  }

  return false;
}

function issue(input: {
  readonly code: string;
  readonly message: string;
  readonly severity?: "info" | "warning" | "error";
  readonly category?: AeosError["category"];
}): TaskExecutionInvocationReconciliationIssue {
  return {
    code: input.code,
    message: input.message,
    severity: input.severity ?? "error",
    category: input.category ?? "conflict",
  };
}

function referenceFromRecord(input: {
  readonly record?: TaskExecutionInvocationRecord;
  readonly taskId?: AgenticTaskId;
  readonly invocationId?: string;
  readonly currentTaskRevision?: number;
}): TaskExecutionInvocationReconciliationRecordReference {
  const stale =
    input.record === undefined || input.currentTaskRevision === undefined
      ? null
      : input.record.taskStateRevision !== input.currentTaskRevision;

  return {
    taskId: input.record?.taskId ?? input.taskId ?? null,
    invocationId: input.record?.invocationId ?? input.invocationId ?? null,
    idempotencyReference: input.record?.idempotencyKey ?? null,
    attemptId: input.record?.attemptId ?? null,
    attemptNumber: input.record?.attemptNumber ?? null,
    sourceTaskRevision: input.record?.taskStateRevision ?? null,
    currentTaskRevision: input.currentTaskRevision ?? null,
    staleAgainstCurrentTask: stale,
  };
}

function resultFromRecord(
  result: TaskExecutionInvocationResultRecord | undefined,
): TaskExecutionInvocationReconciliationPersistedResult | null {
  if (result === undefined) {
    return null;
  }

  return {
    invocationOk: result.invocationOk,
    outputReference: result.outputReference ?? null,
    diagnosticCode: result.diagnosticCode ?? null,
    message: result.message ?? null,
    returnedAt: result.returnedAt,
  };
}

const applySafety: TaskExecutionInvocationReconciliationApplySafety = {
  providerCalledByAEOS: false,
  dependencyInvoked: false,
  retryPerformed: false,
  taskModified: false,
  attemptModified: false,
  workCompleted: false,
  taskCompleted: false,
  verifierRun: false,
  auditWritten: false,
  policyRuntimeRun: false,
  ownershipSecretRendered: false,
};

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function safeDiagnosticText(value: unknown): string | undefined {
  if (typeof value !== "string") {
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

function attemptContextMatches(input: {
  readonly record: TaskExecutionInvocationRecord;
  readonly attempt: {
    readonly taskId: AgenticTaskId;
    readonly attemptId: AgenticExecutionAttemptId;
    readonly attemptNumber: number;
    readonly taskStateRevision: number;
    readonly workItemId?: string;
    readonly batchId?: string;
  };
}): boolean {
  return (
    input.attempt.taskId === input.record.taskId &&
    input.attempt.attemptId === input.record.attemptId &&
    input.attempt.attemptNumber === input.record.attemptNumber &&
    input.attempt.taskStateRevision === input.record.taskStateRevision &&
    input.attempt.workItemId === input.record.workItemId &&
    input.attempt.batchId === input.record.batchId
  );
}

function applyResult(input: {
  readonly ok: boolean;
  readonly status: TaskExecutionInvocationReconciliationApplyResult["status"];
  readonly reconciliationApplied: boolean;
  readonly previousLifecycle: TaskExecutionInvocationLifecycle | null;
  readonly lifecycle: TaskExecutionInvocationLifecycle | null;
  readonly evidenceKind?: TaskExecutionInvocationProviderReconciliationEvidence["kind"] | null;
  readonly evidenceConclusion?: TaskExecutionInvocationReconciliationEvidenceConclusion;
  readonly outcomeKnown?: boolean;
  readonly reconciliationRequired?: boolean;
  readonly retryRequiresNewAuthority?: boolean;
  readonly currentAuthorityEligible?: boolean;
  readonly record: TaskExecutionInvocationReconciliationRecordReference;
  readonly persistedResult?: TaskExecutionInvocationReconciliationPersistedResult | null;
  readonly retryPlan?: TaskExecutionInvocationReconciliationRetryPlan | null;
  readonly issues: readonly TaskExecutionInvocationReconciliationIssue[];
}): TaskExecutionInvocationReconciliationApplyResult {
  return {
    ok: input.ok,
    status: input.status,
    reconciliationApplied: input.reconciliationApplied,
    previousLifecycle: input.previousLifecycle,
    lifecycle: input.lifecycle,
    evidenceKind: input.evidenceKind ?? null,
    evidenceConclusion: input.evidenceConclusion ?? "none",
    outcomeKnown:
      input.outcomeKnown ??
      (input.lifecycle === "returned" || input.lifecycle === "failed"),
    reconciliationRequired: input.reconciliationRequired ?? false,
    retryRequiresNewAuthority: input.retryRequiresNewAuthority ?? false,
    safeToBlindRetry: false,
    currentAuthorityEligible: input.currentAuthorityEligible ?? false,
    record: input.record,
    persistedResult: input.persistedResult ?? null,
    retryPlan: input.retryPlan ?? null,
    safety: applySafety,
    issues: input.issues,
  };
}

function issueFromError(error: AeosError): TaskExecutionInvocationReconciliationIssue {
  return issue({
    code: error.code,
    message: error.message,
    category: error.category,
  });
}

function retryPlanFromRecord(input: {
  readonly record: TaskExecutionInvocationRecord;
  readonly failure?: TaskExecutionInvocationFailureRecord;
}): TaskExecutionInvocationReconciliationRetryPlan | null {
  if (input.failure === undefined || !input.failure.retryable) {
    return null;
  }

  return {
    priorInvocationId: input.record.invocationId,
    priorAttemptId: input.record.attemptId,
    failureCode: input.failure.code,
    failureCategory: input.failure.category,
    retryableBySystem: input.failure.retryable,
    sourceTaskRevision: input.record.taskStateRevision,
    requiresNewAuthority: true,
  };
}

function evaluateEvidence(input: {
  readonly record?: TaskExecutionInvocationRecord;
  readonly capabilities: TaskExecutionInvocationProviderReconciliationCapabilities | null;
  readonly evidence: unknown;
  readonly issues: TaskExecutionInvocationReconciliationIssue[];
}): TaskExecutionInvocationReconciliationEvidenceConclusion {
  if (input.evidence === undefined) {
    return "none";
  }

  if (!isEvidence(input.evidence)) {
    input.issues.push(
      issue({
        code: "task_execution_invocation_reconciliation_evidence_invalid",
        message:
          "Reconciliation evidence must be typed system/provider evidence, not prose.",
        category: "validation",
      }),
    );
    return "invalid";
  }

  if (input.capabilities === null) {
    input.issues.push(
      issue({
        code: "task_execution_invocation_reconciliation_capability_missing",
        message:
          "Provider reconciliation evidence is ignored until system adapter capability metadata is supplied.",
        category: "validation",
      }),
    );
    return "unsupported";
  }

  if (
    !input.capabilities.supportsIdempotencyKey ||
    !input.capabilities.supportsLookupByIdempotencyKey ||
    !input.capabilities.supportsInvocationStatusQuery
  ) {
    input.issues.push(
      issue({
        code: "task_execution_invocation_reconciliation_capability_insufficient",
        message:
          "Provider reconciliation evidence is insufficient without idempotency-key lookup and status-query capability.",
        category: "conflict",
      }),
    );
    return "unsupported";
  }

  if (input.evidence.kind === "provider_status_unavailable") {
    return "status_unavailable";
  }

  if (
    input.record !== undefined &&
    input.evidence.idempotencyKey !== input.record.idempotencyKey
  ) {
    input.issues.push(
      issue({
        code: "task_execution_invocation_reconciliation_idempotency_mismatch",
        message:
          "Provider evidence idempotency key does not match the persisted invocation authority.",
        category: "validation",
      }),
    );
    return "idempotency_mismatch";
  }

  if (input.evidence.kind === "provider_not_found") {
    return "not_found";
  }

  if (input.evidence.kind === "provider_in_progress") {
    return "in_progress";
  }

  if (input.evidence.kind === "provider_returned") {
    return "returned";
  }

  return "failed";
}

function baseResult(input: {
  readonly status: TaskExecutionInvocationReconciliationStatus;
  readonly action: TaskExecutionInvocationReconciliationAction;
  readonly lifecycle: TaskExecutionInvocationLifecycle | null;
  readonly reference: TaskExecutionInvocationReconciliationRecordReference;
  readonly currentAuthorityEligible: boolean;
  readonly persistedResult?: TaskExecutionInvocationReconciliationPersistedResult | null;
  readonly retryPlan?: TaskExecutionInvocationReconciliationRetryPlan | null;
  readonly providerCapabilities?: TaskExecutionInvocationProviderReconciliationCapabilities | null;
  readonly evidenceConclusion?: TaskExecutionInvocationReconciliationEvidenceConclusion;
  readonly retryRequiresNewAuthority?: boolean;
  readonly reconciliationRequired?: boolean;
  readonly issues: readonly TaskExecutionInvocationReconciliationIssue[];
}): TaskExecutionInvocationReconciliationResult {
  return {
    status: input.status,
    action: input.action,
    lifecycle: input.lifecycle,
    record: input.reference,
    currentAuthorityEligible: input.currentAuthorityEligible,
    persistedResult: input.persistedResult ?? null,
    retryPlan: input.retryPlan ?? null,
    providerCapabilities: input.providerCapabilities ?? null,
    evidenceConclusion: input.evidenceConclusion ?? "none",
    safeToBlindRetry: false,
    retryRequiresNewAuthority: input.retryRequiresNewAuthority ?? false,
    reconciliationRequired: input.reconciliationRequired ?? false,
    workCompleted: false,
    taskCompleted: false,
    verifierSatisfied: false,
    lifecycleMutationPlanned: false,
    taskStateMutationPlanned: false,
    attemptStateMutationPlanned: false,
    issues: input.issues,
  };
}

/**
 * Returns true when an invocation lifecycle value alone is sufficient to
 * conclude that reconciliation is required, without any additional context
 * (staleness, corruption, provider evidence). "invoking" means the launch was
 * initiated but no outcome was written; "outcome_unknown" means the process
 * finished but the outcome could not be determined. Both are ambiguous states
 * that must block re-execution until reconciled.
 *
 * This is the single authoritative definition used by both the reconciliation
 * engine and any read-only inspector that does not have full reconciliation
 * context available. Do not duplicate this predicate elsewhere.
 */
export function isTaskExecutionInvocationReconciliationRequiredByLifecycle(
  lifecycle: TaskExecutionInvocationLifecycle,
): boolean {
  return lifecycle === "invoking" || lifecycle === "outcome_unknown";
}

export function evaluateTaskExecutionInvocationReconciliation(
  input: TaskExecutionInvocationReconciliationInput,
): TaskExecutionInvocationReconciliationResult {
  const issues: TaskExecutionInvocationReconciliationIssue[] = [];
  const recordStatus =
    input.recordStatus ?? (input.record === undefined ? "missing" : "loaded");
  const capabilities = input.providerCapabilities === undefined
    ? null
    : isCapabilities(input.providerCapabilities)
      ? input.providerCapabilities
      : null;

  if (input.providerCapabilities !== undefined && capabilities === null) {
    issues.push(
      issue({
        code: "task_execution_invocation_reconciliation_capability_invalid",
        message:
          "Provider reconciliation capability must come from typed system adapter metadata.",
        category: "validation",
      }),
    );
  }

  if (input.providerCapabilityClaims !== undefined) {
    issues.push(
      issue({
        code: "task_execution_invocation_reconciliation_capability_claim_ignored",
        message:
          "Provider capability prose or task/model claims are ignored for reconciliation authority.",
        severity: "warning",
        category: "validation",
      }),
    );
  }

  if (input.selfReport !== undefined) {
    issues.push(
      issue({
        code: "task_execution_invocation_reconciliation_self_report_ignored",
        message:
          "Task, model, executor, or operator prose cannot authorize retry or resolve invocation outcome.",
        severity: "warning",
        category: "validation",
      }),
    );
  }

  if (recordStatus === "missing") {
    const reference = referenceFromRecord({
      taskId: input.taskId,
      invocationId: input.invocationId,
      currentTaskRevision: input.currentTaskRevision,
    });
    const evidenceConclusion = evaluateEvidence({
      capabilities,
      evidence: input.evidence,
      issues,
    });

    issues.push(
      issue({
        code: "task_execution_invocation_reconciliation_record_missing",
        message:
          "Missing invocation authority is not proof that no invocation exists and cannot authorize execution.",
        category: "not_found",
      }),
    );

    return baseResult({
      status: "missing",
      action: "operator_review_required",
      lifecycle: null,
      reference,
      currentAuthorityEligible: false,
      providerCapabilities: capabilities,
      evidenceConclusion,
      issues,
    });
  }

  if (recordStatus === "corrupt") {
    const reference = referenceFromRecord({
      taskId: input.taskId,
      invocationId: input.invocationId,
      currentTaskRevision: input.currentTaskRevision,
    });
    const evidenceConclusion = evaluateEvidence({
      capabilities,
      evidence: input.evidence,
      issues,
    });

    issues.push(
      issue({
        code: "task_execution_invocation_reconciliation_record_corrupt",
        message:
          "Corrupt invocation authority is not absence; AEOS must fail closed and avoid replacement execution.",
        category: "validation",
      }),
    );

    return baseResult({
      status: "corrupt",
      action: "operator_review_required",
      lifecycle: null,
      reference,
      currentAuthorityEligible: false,
      providerCapabilities: capabilities,
      evidenceConclusion,
      reconciliationRequired: true,
      issues,
    });
  }

  const recordResult = validateTaskExecutionInvocationRecord(input.record);

  if (!recordResult.ok) {
    const reference = referenceFromRecord({
      taskId: input.taskId,
      invocationId: input.invocationId,
      currentTaskRevision: input.currentTaskRevision,
    });
    const evidenceConclusion = evaluateEvidence({
      capabilities,
      evidence: input.evidence,
      issues,
    });

    issues.push(
      issue({
        code: recordResult.error.code,
        message:
          "Invalid invocation authority is treated as corrupt and cannot authorize execution.",
        category: recordResult.error.category,
      }),
    );

    return baseResult({
      status: "corrupt",
      action: "operator_review_required",
      lifecycle: null,
      reference,
      currentAuthorityEligible: false,
      providerCapabilities: capabilities,
      evidenceConclusion,
      reconciliationRequired: true,
      issues,
    });
  }

  const record = recordResult.value;
  const reference = referenceFromRecord({
    record,
    currentTaskRevision: input.currentTaskRevision,
  });
  const stale = reference.staleAgainstCurrentTask === true;

  if (stale) {
    issues.push(
      issue({
        code: "task_execution_invocation_reconciliation_stale_task_revision",
        message:
          "Historical invocation remains inspectable but is not current execution authority.",
        category: "conflict",
      }),
    );
  }

  const evidenceConclusion = evaluateEvidence({
    record,
    capabilities,
    evidence: input.evidence,
    issues,
  });

  if (record.lifecycle === "returned") {
    return baseResult({
      status: "returned",
      action: "use_persisted_result",
      lifecycle: record.lifecycle,
      reference,
      currentAuthorityEligible: false,
      persistedResult: resultFromRecord(record.result),
      providerCapabilities: capabilities,
      evidenceConclusion,
      reconciliationRequired: stale,
      issues,
    });
  }

  if (record.lifecycle === "failed") {
    const retryPlan = retryPlanFromRecord({
      record,
      failure: record.failure,
    });

    return baseResult({
      status: "failed",
      action: record.failure?.retryable === true
        ? "explicit_retry_required"
        : "no_action",
      lifecycle: record.lifecycle,
      reference,
      currentAuthorityEligible: false,
      retryPlan,
      providerCapabilities: capabilities,
      evidenceConclusion,
      retryRequiresNewAuthority: retryPlan !== null,
      issues,
    });
  }

  if (record.lifecycle === "invoking") {
    return baseResult({
      status: "invoking",
      action: "reconciliation_required",
      lifecycle: record.lifecycle,
      reference,
      currentAuthorityEligible: false,
      providerCapabilities: capabilities,
      evidenceConclusion,
      reconciliationRequired: true,
      issues,
    });
  }

  if (record.lifecycle === "outcome_unknown") {
    return baseResult({
      status: "outcome_unknown",
      action: "reconciliation_required",
      lifecycle: record.lifecycle,
      reference,
      currentAuthorityEligible: false,
      providerCapabilities: capabilities,
      evidenceConclusion,
      reconciliationRequired: true,
      issues,
    });
  }

  const canRecoverReservation =
    !stale && input.reservationRecovery?.sameRecordRecoveryAuthorized === true;

  if (!canRecoverReservation) {
    issues.push(
      issue({
        code: "task_execution_invocation_reconciliation_reservation_recovery_limited",
        message:
          "Reserved invocation recovery requires separate same-record ownership/lease authority; no blind invocation is authorized.",
        severity: "warning",
        category: "conflict",
      }),
    );
  }

  return baseResult({
    status: "reserved",
    action: canRecoverReservation ? "recover_reservation" : "operator_review_required",
    lifecycle: record.lifecycle,
    reference,
    currentAuthorityEligible: canRecoverReservation,
    providerCapabilities: capabilities,
    evidenceConclusion,
    issues,
  });
}

export async function applyTaskExecutionInvocationReconciliation(
  input: ApplyTaskExecutionInvocationReconciliationInput,
): Promise<TaskExecutionInvocationReconciliationApplyResult> {
  const issues: TaskExecutionInvocationReconciliationIssue[] = [];
  const missingReference = referenceFromRecord({
    taskId: input.taskId,
    invocationId: input.invocationId,
  });

  if (
    input.expectedInvocationRevision !== undefined &&
    !isPositiveInteger(input.expectedInvocationRevision)
  ) {
    issues.push(
      issue({
        code: "task_execution_invocation_reconciliation_expected_revision_invalid",
        message:
          "Invocation reconciliation apply expected revision must be a positive integer.",
        category: "validation",
      }),
    );

    return applyResult({
      ok: false,
      status: "reconciliation_blocked",
      reconciliationApplied: false,
      previousLifecycle: null,
      lifecycle: null,
      record: missingReference,
      issues,
    });
  }

  const invocationResult = await loadTaskExecutionInvocation({
    projectRoot: input.projectRoot,
    taskId: input.taskId,
    invocationId: input.invocationId,
  });

  if (!invocationResult.ok) {
    issues.push(issueFromError(invocationResult.error));

    return applyResult({
      ok: false,
      status: "reconciliation_blocked",
      reconciliationApplied: false,
      previousLifecycle: null,
      lifecycle: null,
      record: missingReference,
      reconciliationRequired: invocationResult.error.category !== "not_found",
      issues,
    });
  }

  const record = invocationResult.value.record;
  let currentTaskRevision: number | null = null;
  const taskResult = await loadTaskState({
    projectRoot: input.projectRoot,
    taskId: record.taskId,
  });

  if (!taskResult.ok) {
    issues.push(issueFromError(taskResult.error));

    return applyResult({
      ok: false,
      status: "reconciliation_blocked",
      reconciliationApplied: false,
      previousLifecycle: record.lifecycle,
      lifecycle: record.lifecycle,
      record: referenceFromRecord({ record }),
      reconciliationRequired:
        isTaskExecutionInvocationReconciliationRequiredByLifecycle(record.lifecycle),
      issues,
    });
  }

  currentTaskRevision = taskResult.value.state.revision;
  const reference = referenceFromRecord({
    record,
    currentTaskRevision,
  });

  if (
    input.expectedInvocationRevision !== undefined &&
    input.expectedInvocationRevision !== record.revision
  ) {
    issues.push(
      issue({
        code: "task_execution_invocation_reconciliation_revision_conflict",
        message:
          "Invocation reconciliation evidence was not applied because the persisted invocation revision changed before evaluation.",
        category: "conflict",
      }),
    );

    return applyResult({
      ok: false,
      status: "reconciliation_blocked",
      reconciliationApplied: false,
      previousLifecycle: record.lifecycle,
      lifecycle: record.lifecycle,
      record: reference,
      reconciliationRequired:
        isTaskExecutionInvocationReconciliationRequiredByLifecycle(record.lifecycle),
      issues,
    });
  }

  const attemptResult = await loadTaskExecutionAttempt({
    projectRoot: input.projectRoot,
    taskId: record.taskId,
    attemptId: record.attemptId,
  });

  if (!attemptResult.ok) {
    issues.push(issueFromError(attemptResult.error));

    return applyResult({
      ok: false,
      status: "reconciliation_blocked",
      reconciliationApplied: false,
      previousLifecycle: record.lifecycle,
      lifecycle: record.lifecycle,
      record: reference,
      reconciliationRequired:
        isTaskExecutionInvocationReconciliationRequiredByLifecycle(record.lifecycle),
      issues,
    });
  }

  if (
    !attemptContextMatches({
      record,
      attempt: attemptResult.value.attempt,
    })
  ) {
    issues.push(
      issue({
        code: "task_execution_invocation_reconciliation_attempt_context_mismatch",
        message:
          "Invocation reconciliation apply requires the persisted attempt context to match invocation authority.",
        category: "validation",
      }),
    );

    return applyResult({
      ok: false,
      status: "reconciliation_blocked",
      reconciliationApplied: false,
      previousLifecycle: record.lifecycle,
      lifecycle: record.lifecycle,
      record: reference,
      reconciliationRequired:
        isTaskExecutionInvocationReconciliationRequiredByLifecycle(record.lifecycle),
      issues,
    });
  }

  if (reference.staleAgainstCurrentTask === true) {
    issues.push(
      issue({
        code: "task_execution_invocation_reconciliation_stale_task_revision",
        message:
          "Historical invocation may be reconciled for record correctness, but it remains non-current execution authority.",
        category: "conflict",
      }),
    );
  }

  if (record.lifecycle === "returned") {
    return applyResult({
      ok: true,
      status: "reconciliation_not_required",
      reconciliationApplied: false,
      previousLifecycle: record.lifecycle,
      lifecycle: record.lifecycle,
      outcomeKnown: true,
      record: reference,
      persistedResult: resultFromRecord(record.result),
      reconciliationRequired: reference.staleAgainstCurrentTask === true,
      issues,
    });
  }

  if (record.lifecycle === "failed") {
    const retryPlan = retryPlanFromRecord({
      record,
      failure: record.failure,
    });

    return applyResult({
      ok: true,
      status: "reconciliation_not_required",
      reconciliationApplied: false,
      previousLifecycle: record.lifecycle,
      lifecycle: record.lifecycle,
      outcomeKnown: true,
      record: reference,
      retryPlan,
      retryRequiresNewAuthority: retryPlan !== null,
      issues,
    });
  }

  if (record.lifecycle === "reserved") {
    issues.push(
      issue({
        code: "task_execution_invocation_reconciliation_reserved_not_applyable",
        message:
          "Reserved invocation recovery is separate from authoritative provider outcome reconciliation.",
        severity: "warning",
        category: "conflict",
      }),
    );

    return applyResult({
      ok: true,
      status: "reconciliation_unresolved",
      reconciliationApplied: false,
      previousLifecycle: record.lifecycle,
      lifecycle: record.lifecycle,
      outcomeKnown: false,
      record: reference,
      issues,
    });
  }

  if (!isEvidenceSource(input.evidenceSource)) {
    issues.push(
      issue({
        code: isRecord(input.evidenceSource) && isRecord(input.evidenceSource.source)
          ? "task_execution_invocation_reconciliation_evidence_source_unsupported"
          : "task_execution_invocation_reconciliation_evidence_source_required",
        message:
          "Reconciliation apply in TASK-0295 requires an explicitly injected test_authoritative evidence source.",
        category: "validation",
      }),
    );

    return applyResult({
      ok: false,
      status: "reconciliation_blocked",
      reconciliationApplied: false,
      previousLifecycle: record.lifecycle,
      lifecycle: record.lifecycle,
      evidenceConclusion: "unsupported",
      outcomeKnown: false,
      record: reference,
      reconciliationRequired: true,
      issues,
    });
  }

  let evidence: unknown;

  try {
    evidence = await input.evidenceSource.getEvidence({
      taskId: record.taskId,
      invocationId: record.invocationId,
      idempotencyKey: record.idempotencyKey,
      lifecycle: record.lifecycle,
      recordRevision: record.revision,
      currentTaskRevision,
      staleAgainstCurrentTask: reference.staleAgainstCurrentTask,
    });
  } catch {
    issues.push(
      issue({
        code: "task_execution_invocation_reconciliation_evidence_source_failed",
        message:
          "Reconciliation evidence source failed; invocation outcome remains unresolved.",
        category: "unknown",
      }),
    );

    return applyResult({
      ok: false,
      status: "reconciliation_blocked",
      reconciliationApplied: false,
      previousLifecycle: record.lifecycle,
      lifecycle: record.lifecycle,
      evidenceConclusion: "invalid",
      outcomeKnown: false,
      record: reference,
      reconciliationRequired: true,
      issues,
    });
  }

  if (!hasAuthoritativeEvidenceSource(evidence)) {
    issues.push(
      issue({
        code: "task_execution_invocation_reconciliation_authoritative_evidence_invalid",
        message:
          "Reconciliation apply rejected non-authoritative, non-test, arbitrary, or prose evidence.",
        category: "validation",
      }),
    );

    return applyResult({
      ok: false,
      status: "reconciliation_blocked",
      reconciliationApplied: false,
      previousLifecycle: record.lifecycle,
      lifecycle: record.lifecycle,
      evidenceConclusion: "invalid",
      outcomeKnown: false,
      record: reference,
      reconciliationRequired: true,
      issues,
    });
  }

  if (
    evidence.kind !== "provider_status_unavailable" &&
    evidence.idempotencyKey !== record.idempotencyKey
  ) {
    issues.push(
      issue({
        code: "task_execution_invocation_reconciliation_idempotency_mismatch",
        message:
          "Authoritative reconciliation evidence idempotency key does not match persisted invocation authority.",
        category: "validation",
      }),
    );

    return applyResult({
      ok: false,
      status: "reconciliation_blocked",
      reconciliationApplied: false,
      previousLifecycle: record.lifecycle,
      lifecycle: record.lifecycle,
      evidenceKind: evidence.kind,
      evidenceConclusion: "idempotency_mismatch",
      outcomeKnown: false,
      record: reference,
      reconciliationRequired: true,
      issues,
    });
  }

  if (evidence.kind === "provider_status_unavailable") {
    return applyResult({
      ok: true,
      status: "reconciliation_unresolved",
      reconciliationApplied: false,
      previousLifecycle: record.lifecycle,
      lifecycle: record.lifecycle,
      evidenceKind: evidence.kind,
      evidenceConclusion: "status_unavailable",
      outcomeKnown: false,
      record: reference,
      reconciliationRequired: true,
      issues,
    });
  }

  if (evidence.kind === "provider_in_progress") {
    return applyResult({
      ok: true,
      status: "reconciliation_unresolved",
      reconciliationApplied: false,
      previousLifecycle: record.lifecycle,
      lifecycle: record.lifecycle,
      evidenceKind: evidence.kind,
      evidenceConclusion: "in_progress",
      outcomeKnown: false,
      record: reference,
      reconciliationRequired: true,
      issues,
    });
  }

  if (evidence.kind === "provider_not_found") {
    issues.push(
      issue({
        code: "task_execution_invocation_reconciliation_not_found_unresolved",
        message:
          "Provider not-found evidence is not proof of failure and does not authorize blind retry in TASK-0295.",
        severity: "warning",
        category: "conflict",
      }),
    );

    return applyResult({
      ok: true,
      status: "reconciliation_unresolved",
      reconciliationApplied: false,
      previousLifecycle: record.lifecycle,
      lifecycle: record.lifecycle,
      evidenceKind: evidence.kind,
      evidenceConclusion: "not_found",
      outcomeKnown: false,
      record: reference,
      reconciliationRequired: true,
      issues,
    });
  }

  const updateResult = await updateTaskExecutionInvocation({
    projectRoot: input.projectRoot,
    taskId: record.taskId,
    invocationId: record.invocationId,
    ownershipToken: record.ownership.ownershipToken,
    expectedLifecycle: record.lifecycle,
    expectedRevision: record.revision,
    intent: evidence.kind === "provider_returned"
      ? {
          kind: "record_returned",
          result: {
            invocationOk: evidence.invocationOk,
            output: evidence.output,
            outputReference: safeDiagnosticText(evidence.resultReference),
            diagnosticCode: safeDiagnosticText(evidence.diagnosticCode),
            message: safeDiagnosticText(evidence.message),
            metadata: evidence.metadata,
            returnedAt: evidence.observedAt,
          },
        }
      : {
          kind: "record_failed",
          failure: {
            code:
              safeDiagnosticText(evidence.failureCode) ??
              "task_execution_invocation_reconciliation_provider_failed",
            category: evidence.failureCategory ?? "adapter_failure",
            retryable: evidence.retryable,
            diagnostic: safeDiagnosticText(evidence.diagnostic),
            failedAt: evidence.observedAt,
          },
        },
  });

  if (!updateResult.ok) {
    issues.push(issueFromError(updateResult.error));

    return applyResult({
      ok: false,
      status: "reconciliation_blocked",
      reconciliationApplied: false,
      previousLifecycle: record.lifecycle,
      lifecycle: record.lifecycle,
      evidenceKind: evidence.kind,
      evidenceConclusion: evidence.kind === "provider_returned" ? "returned" : "failed",
      outcomeKnown: false,
      record: reference,
      reconciliationRequired: true,
      issues,
    });
  }

  const updatedRecord = updateResult.value.record;
  const updatedReference = referenceFromRecord({
    record: updatedRecord,
    currentTaskRevision,
  });
  const retryPlan = updatedRecord.lifecycle === "failed"
    ? retryPlanFromRecord({
        record: updatedRecord,
        failure: updatedRecord.failure,
      })
    : null;

  return applyResult({
    ok: true,
    status: "reconciliation_applied",
    reconciliationApplied: true,
    previousLifecycle: record.lifecycle,
    lifecycle: updatedRecord.lifecycle,
    evidenceKind: evidence.kind,
    evidenceConclusion: evidence.kind === "provider_returned" ? "returned" : "failed",
    outcomeKnown: true,
    record: updatedReference,
    persistedResult: resultFromRecord(updatedRecord.result),
    retryPlan,
    retryRequiresNewAuthority: retryPlan !== null,
    reconciliationRequired: updatedReference.staleAgainstCurrentTask === true,
    issues,
  });
}

export function summarizeTaskExecutionInvocationReconciliation(
  result: TaskExecutionInvocationReconciliationResult,
): TaskExecutionInvocationReconciliationSummary {
  return {
    status: result.status,
    action: result.action,
    safeToBlindRetry: result.safeToBlindRetry,
    retryRequiresNewAuthority: result.retryRequiresNewAuthority,
    reconciliationRequired: result.reconciliationRequired,
    staleAgainstCurrentTask: result.record.staleAgainstCurrentTask,
    currentAuthorityEligible: result.currentAuthorityEligible,
    evidenceConclusion: result.evidenceConclusion,
    issueCodes: result.issues.map((item) => item.code),
  };
}
