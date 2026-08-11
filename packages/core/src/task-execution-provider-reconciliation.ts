import type {
  AgenticExecutionAttemptId,
  AgenticTaskId,
  AgenticWorkBatchId,
  AgenticWorkItemId,
} from "./agentic-lifecycle.js";
import type { TaskExecutionFailureCategory } from "./task-execution-attempt.js";
import type {
  TaskExecutionInvocationRecord,
} from "./task-execution-invocation-record.js";
import {
  validateTaskExecutionInvocationRecord,
} from "./task-execution-invocation-record.js";
import type { TaskExecutionInvocationDependencyKind } from "./task-execution-invocation.js";
import type {
  TaskExecutionInvocationAuthoritativeReconciliationEvidence,
  TaskExecutionInvocationProviderReconciliationCapabilities,
  TaskExecutionInvocationProviderReconciliationEvidence,
  TaskExecutionInvocationReconciliationEvidenceSource,
} from "./task-execution-invocation-reconciliation.js";
import type { AeosError, JsonObject, JsonValue } from "./types.js";

export type TaskExecutionProviderReconciliationAdapterKind =
  "test_reconciliation";

export type TaskExecutionProviderReconciliationRawStatus =
  | "not_found"
  | "in_progress"
  | "returned"
  | "failed"
  | "unavailable";

export type TaskExecutionProviderReconciliationNormalizedStatus =
  TaskExecutionInvocationProviderReconciliationEvidence["kind"];

export interface TaskExecutionProviderReconciliationCapabilities
  extends TaskExecutionInvocationProviderReconciliationCapabilities {}

export interface TaskExecutionProviderReconciliationRequest {
  readonly adapterKind: TaskExecutionProviderReconciliationAdapterKind;
  readonly adapterId: string;
  readonly invocationId: string;
  readonly idempotencyKey: string;
  readonly taskId: AgenticTaskId;
  readonly taskStateRevision: number;
  readonly attemptId: AgenticExecutionAttemptId;
  readonly attemptNumber: number;
  readonly workItemId?: AgenticWorkItemId;
  readonly batchId?: AgenticWorkBatchId;
  readonly dependencyKind: TaskExecutionInvocationDependencyKind;
  readonly requestFingerprint: string;
  readonly allowedOperationReferences: readonly string[];
  readonly verifierRequired: boolean;
  readonly completionGatedByVerifier: true;
}

export interface TaskExecutionProviderReconciliationRawResult {
  readonly status: TaskExecutionProviderReconciliationRawStatus;
  readonly invocationId?: string;
  readonly idempotencyKey?: string;
  readonly taskId?: AgenticTaskId;
  readonly taskStateRevision?: number;
  readonly attemptId?: AgenticExecutionAttemptId;
  readonly attemptNumber?: number;
  readonly workItemId?: AgenticWorkItemId;
  readonly batchId?: AgenticWorkBatchId;
  readonly requestFingerprint?: string;
  readonly invocationOk?: boolean;
  readonly output?: JsonValue;
  readonly resultReference?: string;
  readonly diagnosticCode?: string;
  readonly message?: string;
  readonly metadata?: JsonObject;
  readonly failureCode?: string;
  readonly failureCategory?: TaskExecutionFailureCategory;
  readonly retryable?: boolean;
  readonly diagnostic?: string;
  readonly observedAt?: string;
}

export interface TaskExecutionProviderReconciliationAdapter {
  readonly kind: TaskExecutionProviderReconciliationAdapterKind;
  readonly adapterId: string;
  readonly capabilities: TaskExecutionProviderReconciliationCapabilities;
  readonly reconcile: (
    request: TaskExecutionProviderReconciliationRequest,
  ) =>
    | TaskExecutionProviderReconciliationRawResult
    | unknown
    | Promise<TaskExecutionProviderReconciliationRawResult | unknown>;
}

export interface TaskExecutionProviderReconciliationIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: "warning" | "error";
  readonly category: AeosError["category"];
}

export interface TaskExecutionProviderReconciliationEvidenceProvenance {
  readonly adapterKind: TaskExecutionProviderReconciliationAdapterKind;
  readonly adapterId: string;
  readonly source: "provider_reconciliation_bridge";
  readonly normalizedStatus: TaskExecutionProviderReconciliationNormalizedStatus;
  readonly invocationId: string;
  readonly idempotencyKey: string;
  readonly taskId: AgenticTaskId;
  readonly taskStateRevision: number;
  readonly attemptId: AgenticExecutionAttemptId;
  readonly attemptNumber: number;
  readonly workItemId?: AgenticWorkItemId;
  readonly batchId?: AgenticWorkBatchId;
  readonly requestFingerprint: string;
  readonly capabilities: TaskExecutionProviderReconciliationCapabilities;
}

type TaskExecutionProviderReconciliationEvidence =
  TaskExecutionInvocationAuthoritativeReconciliationEvidence & {
    readonly provenance: TaskExecutionProviderReconciliationEvidenceProvenance;
  };

export interface TaskExecutionProviderReconciliationSafety {
  readonly productionAdapterInvoked: false;
  readonly networkCalled: false;
  readonly filesystemTouched: false;
  readonly subprocessExecuted: false;
  readonly dependencyInvoked: false;
  readonly taskModified: false;
  readonly attemptModified: false;
  readonly invocationModified: false;
  readonly workCompleted: false;
  readonly taskCompleted: false;
  readonly verifierRun: false;
  readonly policyRuntimeRun: false;
  readonly retryPerformed: false;
  readonly ownershipSecretRendered: false;
  readonly rawProviderOutputAuthoritative: false;
}

export interface TaskExecutionProviderReconciliationResult {
  readonly ok: boolean;
  readonly status:
    | "evidence_collected"
    | "evidence_unavailable"
    | "evidence_rejected"
    | "provider_not_called";
  readonly adapterKind: TaskExecutionProviderReconciliationAdapterKind | null;
  readonly adapterId: string | null;
  readonly providerCalled: boolean;
  readonly durableOutcomeUsed: boolean;
  readonly request: TaskExecutionProviderReconciliationRequest | null;
  readonly capabilities: TaskExecutionProviderReconciliationCapabilities | null;
  readonly normalizedStatus: TaskExecutionProviderReconciliationNormalizedStatus | null;
  readonly evidence: TaskExecutionProviderReconciliationEvidence | null;
  readonly evidenceSource: TaskExecutionInvocationReconciliationEvidenceSource | null;
  readonly issues: readonly TaskExecutionProviderReconciliationIssue[];
  readonly safety: TaskExecutionProviderReconciliationSafety;
}

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

const safeAdapterIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/;

const bridgeSafety: TaskExecutionProviderReconciliationSafety = {
  productionAdapterInvoked: false,
  networkCalled: false,
  filesystemTouched: false,
  subprocessExecuted: false,
  dependencyInvoked: false,
  taskModified: false,
  attemptModified: false,
  invocationModified: false,
  workCompleted: false,
  taskCompleted: false,
  verifierRun: false,
  policyRuntimeRun: false,
  retryPerformed: false,
  ownershipSecretRendered: false,
  rawProviderOutputAuthoritative: false,
};

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

function jsonWithinBridgeLimit(value: JsonValue | JsonObject): boolean {
  return JSON.stringify(value).length <= 4096;
}

function safeText(value: unknown): string | undefined {
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

function issue(input: {
  readonly code: string;
  readonly message: string;
  readonly severity?: "warning" | "error";
  readonly category?: AeosError["category"];
}): TaskExecutionProviderReconciliationIssue {
  return {
    code: input.code,
    message: input.message,
    severity: input.severity ?? "error",
    category: input.category ?? "validation",
  };
}

function result(input: {
  readonly ok: boolean;
  readonly status: TaskExecutionProviderReconciliationResult["status"];
  readonly adapter?: TaskExecutionProviderReconciliationAdapter;
  readonly providerCalled?: boolean;
  readonly durableOutcomeUsed?: boolean;
  readonly request?: TaskExecutionProviderReconciliationRequest | null;
  readonly normalizedStatus?: TaskExecutionProviderReconciliationNormalizedStatus | null;
  readonly evidence?: TaskExecutionProviderReconciliationResult["evidence"];
  readonly issues: readonly TaskExecutionProviderReconciliationIssue[];
}): TaskExecutionProviderReconciliationResult {
  const evidence = input.evidence ?? null;

  return {
    ok: input.ok,
    status: input.status,
    adapterKind: input.adapter?.kind ?? null,
    adapterId: input.adapter?.adapterId ?? null,
    providerCalled: input.providerCalled ?? false,
    durableOutcomeUsed: input.durableOutcomeUsed ?? false,
    request: input.request ?? null,
    capabilities: input.adapter?.capabilities ?? null,
    normalizedStatus: input.normalizedStatus ?? evidence?.kind ?? null,
    evidence,
    evidenceSource: evidence === null
      ? null
      : {
          source: evidence.source,
          getEvidence(request) {
            if (
              request.taskId !== evidence.provenance.taskId ||
              request.invocationId !== evidence.provenance.invocationId ||
              request.idempotencyKey !== evidence.provenance.idempotencyKey ||
              request.recordRevision < 1
            ) {
              return {
                source: evidence.source,
                kind: "provider_status_unavailable",
                observedAt: new Date(0).toISOString(),
                provenance: {
                  ...evidence.provenance,
                  normalizedStatus: "provider_status_unavailable",
                },
              };
            }

            return evidence;
          },
        },
    issues: input.issues,
    safety: bridgeSafety,
  };
}

function adapterFromUnknown(
  value: unknown,
): TaskExecutionProviderReconciliationAdapter | undefined {
  if (
    !isRecord(value) ||
    value.kind !== "test_reconciliation" ||
    typeof value.adapterId !== "string" ||
    !safeAdapterIdPattern.test(value.adapterId) ||
    !isRecord(value.capabilities) ||
    typeof value.capabilities.supportsIdempotencyKey !== "boolean" ||
    typeof value.capabilities.supportsLookupByIdempotencyKey !== "boolean" ||
    typeof value.capabilities.supportsInvocationStatusQuery !== "boolean" ||
    typeof value.capabilities.supportsResultReplay !== "boolean" ||
    typeof value.reconcile !== "function"
  ) {
    return undefined;
  }

  return value as unknown as TaskExecutionProviderReconciliationAdapter;
}

function capabilityIssues(
  capabilities: TaskExecutionProviderReconciliationCapabilities,
): readonly TaskExecutionProviderReconciliationIssue[] {
  const issues: TaskExecutionProviderReconciliationIssue[] = [];

  if (
    capabilities.supportsLookupByIdempotencyKey &&
    !capabilities.supportsIdempotencyKey
  ) {
    issues.push(
      issue({
        code: "task_execution_provider_reconciliation_capability_contradiction",
        message:
          "Provider reconciliation lookup by idempotency key requires idempotency-key support.",
        category: "validation",
      }),
    );
  }

  if (
    capabilities.supportsResultReplay &&
    (!capabilities.supportsInvocationStatusQuery ||
      !capabilities.supportsLookupByIdempotencyKey)
  ) {
    issues.push(
      issue({
        code: "task_execution_provider_reconciliation_result_replay_contradiction",
        message:
          "Provider reconciliation result replay requires status query and idempotency lookup support.",
        category: "validation",
      }),
    );
  }

  return issues;
}

function requestCapabilityIssues(
  capabilities: TaskExecutionProviderReconciliationCapabilities,
): readonly TaskExecutionProviderReconciliationIssue[] {
  const issues: TaskExecutionProviderReconciliationIssue[] = [
    ...capabilityIssues(capabilities),
  ];

  if (
    !capabilities.supportsIdempotencyKey ||
    !capabilities.supportsLookupByIdempotencyKey ||
    !capabilities.supportsInvocationStatusQuery
  ) {
    issues.push(
      issue({
        code: "task_execution_provider_reconciliation_status_query_unsupported",
        message:
          "Provider reconciliation evidence collection requires system-owned idempotency, idempotency lookup, and status-query capability.",
        category: "conflict",
      }),
    );
  }

  return issues;
}

export function buildTaskExecutionProviderReconciliationRequest(input: {
  readonly record: unknown;
  readonly adapter: unknown;
}): TaskExecutionProviderReconciliationResult {
  const adapter = adapterFromUnknown(input.adapter);

  if (adapter === undefined) {
    return result({
      ok: false,
      status: "evidence_rejected",
      issues: [
        issue({
          code: isRecord(input.adapter) && typeof input.adapter.kind === "string"
            ? "task_execution_provider_reconciliation_adapter_kind_unsupported"
            : "task_execution_provider_reconciliation_adapter_invalid",
          message:
            "Provider reconciliation accepts only an explicitly injected test_reconciliation adapter.",
          category: "validation",
        }),
      ],
    });
  }

  const capabilityValidation = requestCapabilityIssues(adapter.capabilities);

  if (capabilityValidation.length > 0) {
    return result({
      ok: false,
      status: "evidence_rejected",
      adapter,
      issues: capabilityValidation,
    });
  }

  const recordValidation = validateTaskExecutionInvocationRecord(input.record);

  if (!recordValidation.ok) {
    return result({
      ok: false,
      status: "evidence_rejected",
      adapter,
      issues: [
        issue({
          code: recordValidation.error.code,
          message:
            "Provider reconciliation request requires a valid persisted invocation record.",
          category: recordValidation.error.category,
        }),
      ],
    });
  }

  const record = recordValidation.value;
  const request: TaskExecutionProviderReconciliationRequest = {
    adapterKind: adapter.kind,
    adapterId: adapter.adapterId,
    invocationId: record.invocationId,
    idempotencyKey: record.idempotencyKey,
    taskId: record.taskId,
    taskStateRevision: record.taskStateRevision,
    attemptId: record.attemptId,
    attemptNumber: record.attemptNumber,
    workItemId: record.workItemId,
    batchId: record.batchId,
    dependencyKind: record.dependencyKind,
    requestFingerprint: record.request.fingerprint,
    allowedOperationReferences: record.request.allowedOperationReferences,
    verifierRequired: record.request.verifierRequired,
    completionGatedByVerifier: true,
  };

  return result({
    ok: true,
    status: "provider_not_called",
    adapter,
    request,
    issues: [],
  });
}

function rawResultFromUnknown(
  value: unknown,
): TaskExecutionProviderReconciliationRawResult | undefined {
  if (!isRecord(value) || typeof value.status !== "string") {
    return undefined;
  }

  if (
    value.status !== "not_found" &&
    value.status !== "in_progress" &&
    value.status !== "returned" &&
    value.status !== "failed" &&
    value.status !== "unavailable"
  ) {
    return {
      ...value,
      status: "unavailable",
      observedAt: typeof value.observedAt === "string"
        ? value.observedAt
        : undefined,
    };
  }

  return value as unknown as TaskExecutionProviderReconciliationRawResult;
}

function mismatchIssues(input: {
  readonly request: TaskExecutionProviderReconciliationRequest;
  readonly rawResult: TaskExecutionProviderReconciliationRawResult;
}): readonly TaskExecutionProviderReconciliationIssue[] {
  const issues: TaskExecutionProviderReconciliationIssue[] = [];
  const checks: readonly {
    readonly field: keyof TaskExecutionProviderReconciliationRawResult;
    readonly expected: string | number | undefined;
  }[] = [
    { field: "invocationId", expected: input.request.invocationId },
    { field: "idempotencyKey", expected: input.request.idempotencyKey },
    { field: "taskId", expected: input.request.taskId },
    { field: "taskStateRevision", expected: input.request.taskStateRevision },
    { field: "attemptId", expected: input.request.attemptId },
    { field: "attemptNumber", expected: input.request.attemptNumber },
    { field: "workItemId", expected: input.request.workItemId },
    { field: "batchId", expected: input.request.batchId },
    { field: "requestFingerprint", expected: input.request.requestFingerprint },
  ];

  for (const check of checks) {
    const actual = input.rawResult[check.field];

    if (actual !== undefined && actual !== check.expected) {
      issues.push(
        issue({
          code: "task_execution_provider_reconciliation_context_mismatch",
          message:
            "Provider reconciliation raw result did not match the authoritative invocation request binding.",
          category: "validation",
        }),
      );
      break;
    }
  }

  return issues;
}

function provenance(input: {
  readonly adapter: TaskExecutionProviderReconciliationAdapter;
  readonly request: TaskExecutionProviderReconciliationRequest;
  readonly normalizedStatus: TaskExecutionProviderReconciliationNormalizedStatus;
}): TaskExecutionProviderReconciliationEvidenceProvenance {
  return {
    adapterKind: input.adapter.kind,
    adapterId: input.adapter.adapterId,
    source: "provider_reconciliation_bridge",
    normalizedStatus: input.normalizedStatus,
    invocationId: input.request.invocationId,
    idempotencyKey: input.request.idempotencyKey,
    taskId: input.request.taskId,
    taskStateRevision: input.request.taskStateRevision,
    attemptId: input.request.attemptId,
    attemptNumber: input.request.attemptNumber,
    workItemId: input.request.workItemId,
    batchId: input.request.batchId,
    requestFingerprint: input.request.requestFingerprint,
    capabilities: input.adapter.capabilities,
  };
}

function evidenceWithSource(input: {
  readonly adapter: TaskExecutionProviderReconciliationAdapter;
  readonly request: TaskExecutionProviderReconciliationRequest;
  readonly evidence: TaskExecutionInvocationProviderReconciliationEvidence;
}): TaskExecutionProviderReconciliationEvidence {
  return {
    ...input.evidence,
    source: {
      kind: "test_authoritative",
      sourceId: input.adapter.adapterId,
    },
    provenance: provenance({
      adapter: input.adapter,
      request: input.request,
      normalizedStatus: input.evidence.kind,
    }),
  };
}

export function normalizeTaskExecutionProviderReconciliationResult(input: {
  readonly adapter: unknown;
  readonly request: TaskExecutionProviderReconciliationRequest;
  readonly rawResult: unknown;
}): TaskExecutionProviderReconciliationResult {
  const adapter = adapterFromUnknown(input.adapter);

  if (adapter === undefined) {
    return result({
      ok: false,
      status: "evidence_rejected",
      request: input.request,
      issues: [
        issue({
          code: "task_execution_provider_reconciliation_adapter_kind_unsupported",
          message:
            "Provider reconciliation normalization accepts only test_reconciliation adapter output.",
          category: "validation",
        }),
      ],
    });
  }

  const rawStatusUnknown =
    isRecord(input.rawResult) &&
    typeof input.rawResult.status === "string" &&
    input.rawResult.status !== "not_found" &&
    input.rawResult.status !== "in_progress" &&
    input.rawResult.status !== "returned" &&
    input.rawResult.status !== "failed" &&
    input.rawResult.status !== "unavailable";
  const rawResult = rawResultFromUnknown(input.rawResult);

  if (rawResult === undefined) {
    const evidence = evidenceWithSource({
      adapter,
      request: input.request,
      evidence: {
        kind: "provider_status_unavailable",
        observedAt: new Date(0).toISOString(),
      },
    });

    return result({
      ok: true,
      status: "evidence_unavailable",
      adapter,
      request: input.request,
      normalizedStatus: "provider_status_unavailable",
      evidence,
      issues: [
        issue({
          code: "task_execution_provider_reconciliation_raw_result_invalid",
          message:
            "Provider reconciliation raw result was invalid and was normalized to status unavailable.",
          category: "validation",
        }),
      ],
    });
  }

  const mismatches = mismatchIssues({
    request: input.request,
    rawResult,
  });

  if (mismatches.length > 0) {
    return result({
      ok: false,
      status: "evidence_rejected",
      adapter,
      request: input.request,
      issues: mismatches,
    });
  }

  if (rawStatusUnknown) {
    const evidence = evidenceWithSource({
      adapter,
      request: input.request,
      evidence: {
        kind: "provider_status_unavailable",
        observedAt: safeText(rawResult.observedAt),
      },
    });

    return result({
      ok: true,
      status: "evidence_unavailable",
      adapter,
      request: input.request,
      normalizedStatus: evidence.kind,
      evidence,
      issues: [
        issue({
          code: "task_execution_provider_reconciliation_raw_status_unknown",
          message:
            "Unknown provider reconciliation status was normalized to status unavailable.",
          category: "validation",
        }),
      ],
    });
  }

  const observedAt = safeText(rawResult.observedAt);

  if (rawResult.status === "unavailable") {
    const evidence = evidenceWithSource({
      adapter,
      request: input.request,
      evidence: {
        kind: "provider_status_unavailable",
        observedAt,
      },
    });

    return result({
      ok: true,
      status: "evidence_unavailable",
      adapter,
      request: input.request,
      normalizedStatus: evidence.kind,
      evidence,
      issues: [],
    });
  }

  if (rawResult.status === "not_found") {
    const evidence = evidenceWithSource({
      adapter,
      request: input.request,
      evidence: {
        kind: "provider_not_found",
        idempotencyKey: input.request.idempotencyKey,
        observedAt,
      },
    });

    return result({
      ok: true,
      status: "evidence_collected",
      adapter,
      request: input.request,
      normalizedStatus: evidence.kind,
      evidence,
      issues: [],
    });
  }

  if (rawResult.status === "in_progress") {
    const evidence = evidenceWithSource({
      adapter,
      request: input.request,
      evidence: {
        kind: "provider_in_progress",
        idempotencyKey: input.request.idempotencyKey,
        observedAt,
      },
    });

    return result({
      ok: true,
      status: "evidence_collected",
      adapter,
      request: input.request,
      normalizedStatus: evidence.kind,
      evidence,
      issues: [],
    });
  }

  if (rawResult.status === "returned") {
    if (!adapter.capabilities.supportsResultReplay) {
      return result({
        ok: false,
        status: "evidence_rejected",
        adapter,
        request: input.request,
        issues: [
          issue({
            code: "task_execution_provider_reconciliation_result_replay_unsupported",
            message:
              "Provider returned-result evidence requires system-declared result replay capability.",
            category: "conflict",
          }),
        ],
      });
    }

    if (typeof rawResult.invocationOk !== "boolean") {
      return result({
        ok: false,
        status: "evidence_rejected",
        adapter,
        request: input.request,
        issues: [
          issue({
            code: "task_execution_provider_reconciliation_returned_invalid",
            message:
              "Provider returned evidence requires a typed invocationOk boolean.",
            category: "validation",
          }),
        ],
      });
    }

    const output =
      rawResult.output !== undefined &&
      isJsonValue(rawResult.output) &&
      jsonWithinBridgeLimit(rawResult.output)
        ? rawResult.output
        : undefined;
    const metadata =
      rawResult.metadata !== undefined &&
      isJsonObject(rawResult.metadata) &&
      jsonWithinBridgeLimit(rawResult.metadata)
        ? rawResult.metadata
        : undefined;
    const evidence = evidenceWithSource({
      adapter,
      request: input.request,
      evidence: {
        kind: "provider_returned",
        idempotencyKey: input.request.idempotencyKey,
        invocationOk: rawResult.invocationOk,
        output,
        resultReference: safeText(rawResult.resultReference),
        diagnosticCode: safeText(rawResult.diagnosticCode),
        message: safeText(rawResult.message),
        metadata,
        observedAt,
      },
    });

    return result({
      ok: true,
      status: "evidence_collected",
      adapter,
      request: input.request,
      normalizedStatus: evidence.kind,
      evidence,
      issues: [],
    });
  }

  if (typeof rawResult.failureCode !== "string") {
    return result({
      ok: false,
      status: "evidence_rejected",
      adapter,
      request: input.request,
      issues: [
        issue({
          code: "task_execution_provider_reconciliation_failed_invalid",
          message:
            "Provider failed evidence requires a typed failure code.",
          category: "validation",
        }),
      ],
    });
  }

  const failureCategory =
    typeof rawResult.failureCategory === "string" &&
    allowedFailureCategories.has(rawResult.failureCategory)
      ? rawResult.failureCategory
      : undefined;
  const evidence = evidenceWithSource({
    adapter,
    request: input.request,
    evidence: {
      kind: "provider_failed",
      idempotencyKey: input.request.idempotencyKey,
      failureCode:
        safeText(rawResult.failureCode) ??
        "task_execution_provider_reconciliation_provider_failed",
      failureCategory,
      retryable: rawResult.retryable === true,
      diagnostic: safeText(rawResult.diagnostic),
      observedAt,
    },
  });

  return result({
    ok: true,
    status: "evidence_collected",
    adapter,
    request: input.request,
    normalizedStatus: evidence.kind,
    evidence,
    issues: [],
  });
}

export async function collectTaskExecutionProviderReconciliationEvidence(input: {
  readonly record: unknown;
  readonly adapter: unknown;
}): Promise<TaskExecutionProviderReconciliationResult> {
  const requestResult = buildTaskExecutionProviderReconciliationRequest(input);

  if (!requestResult.ok || requestResult.request === null) {
    return requestResult;
  }

  const adapter = adapterFromUnknown(input.adapter);

  if (adapter === undefined) {
    return requestResult;
  }

  const recordValidation = validateTaskExecutionInvocationRecord(input.record);

  if (!recordValidation.ok) {
    return requestResult;
  }

  const record: TaskExecutionInvocationRecord = recordValidation.value;

  if (record.lifecycle === "returned" || record.lifecycle === "failed") {
    return result({
      ok: true,
      status: "provider_not_called",
      adapter,
      request: requestResult.request,
      durableOutcomeUsed: true,
      issues: [],
    });
  }

  if (record.lifecycle !== "invoking" && record.lifecycle !== "outcome_unknown") {
    return result({
      ok: true,
      status: "provider_not_called",
      adapter,
      request: requestResult.request,
      issues: [
        issue({
          code: "task_execution_provider_reconciliation_lifecycle_not_queryable",
          message:
            "Provider reconciliation query is reserved for invoking or outcome_unknown invocation records.",
          severity: "warning",
          category: "conflict",
        }),
      ],
    });
  }

  let rawResult: unknown;

  try {
    rawResult = await adapter.reconcile(requestResult.request);
  } catch {
    const evidence = evidenceWithSource({
      adapter,
      request: requestResult.request,
      evidence: {
        kind: "provider_status_unavailable",
        observedAt: new Date(0).toISOString(),
      },
    });

    return result({
      ok: true,
      status: "evidence_unavailable",
      adapter,
      providerCalled: true,
      request: requestResult.request,
      normalizedStatus: evidence.kind,
      evidence,
      issues: [
        issue({
          code: "task_execution_provider_reconciliation_adapter_threw",
          message:
            "Provider reconciliation adapter threw; outcome remains unresolved and raw error text is not authoritative.",
          category: "unknown",
        }),
      ],
    });
  }

  const normalized = normalizeTaskExecutionProviderReconciliationResult({
    adapter,
    request: requestResult.request,
    rawResult,
  });

  return {
    ...normalized,
    providerCalled: true,
  };
}
