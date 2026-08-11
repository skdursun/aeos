import type { AgenticExecutionAttemptId, AgenticTaskId } from "./agentic-lifecycle.js";
import type { TaskExecutionFailureCategory } from "./task-execution-attempt.js";
import type {
  TaskExecutionInvocationFailureRecord,
  TaskExecutionInvocationLifecycle,
  TaskExecutionInvocationRecord,
  TaskExecutionInvocationResultRecord,
} from "./task-execution-invocation-record.js";
import { validateTaskExecutionInvocationRecord } from "./task-execution-invocation-record.js";
import type { AeosError } from "./types.js";

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
      readonly resultReference?: string;
      readonly observedAt?: string;
    }
  | {
      readonly kind: "provider_failed";
      readonly idempotencyKey: string;
      readonly failureCode: string;
      readonly retryable: boolean;
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
