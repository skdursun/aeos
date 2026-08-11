import type {
  AgenticExecutionAttemptId,
  AgenticTaskId,
  AgenticWorkBatchId,
  AgenticWorkItemId,
} from "./agentic-lifecycle.js";
import type {
  TaskExecutionInvocationProviderReconciliationCapabilities,
} from "./task-execution-invocation-reconciliation.js";
import type { AeosError, JsonObject, JsonValue } from "./types.js";

export const TASK_EXECUTION_ADAPTER_PRODUCTION_EXECUTION_ENABLED = false;

export type TaskExecutionAdapterKind = "test_execution";

export type TaskExecutionAdapterOperationKind =
  | "execute_task_attempt"
  | "query_invocation_status"
  | "replay_invocation_result"
  | "cancel_invocation";

export interface TaskExecutionAdapterIdentity {
  readonly adapterId: string;
  readonly adapterKind: TaskExecutionAdapterKind;
  readonly implementationVersion: string;
  readonly capabilityVersion: string;
  readonly identityAuthority: "system";
}

export interface TaskExecutionAdapterCapabilities
  extends TaskExecutionInvocationProviderReconciliationCapabilities {
  readonly providesDeterministicProviderInvocationReference: boolean;
  readonly supportsBoundedErrors: boolean;
  readonly supportsCancellation: boolean;
  readonly supportsStreaming: boolean;
  readonly supportsToolCalls: boolean;
  readonly supportsNetworkAccess: boolean;
  readonly supportsFilesystemAccess: boolean;
  readonly supportsProcessExecution: boolean;
  readonly supportsShellExecution: boolean;
  readonly supportsModelInvocation: boolean;
  readonly supportsExternalSideEffects: boolean;
}

export interface TaskExecutionAdapterPermissions {
  readonly permissionAuthority: "system";
  readonly policyRequired: boolean;
  readonly policyAuthorized: false;
  readonly externalSideEffectPermission: boolean;
  readonly networkPermission: boolean;
  readonly filesystemPermission: boolean;
  readonly processPermission: boolean;
  readonly shellPermission: boolean;
  readonly toolCallPermission: boolean;
  readonly modelInvocationPermission: boolean;
}

export interface TaskExecutionAdapterCredentialReference {
  readonly credentialRef: string;
  readonly secretProviderRef?: string;
  readonly credentialScope: readonly string[];
  readonly credentialAuthority: "system";
  readonly rawCredentialMaterialPresent: false;
}

export interface TaskExecutionAdapterTraceReference {
  readonly correlationId: string;
  readonly traceId?: string;
}

export interface TaskExecutionAdapterInvocationRequest {
  readonly invocationId: string;
  readonly idempotencyKey: string;
  readonly taskId: AgenticTaskId;
  readonly sourceTaskRevision: number;
  readonly attemptId: AgenticExecutionAttemptId;
  readonly attemptNumber: number;
  readonly workItemId?: AgenticWorkItemId;
  readonly batchId?: AgenticWorkBatchId;
  readonly operationKind: TaskExecutionAdapterOperationKind;
  readonly adapterIdentity: TaskExecutionAdapterIdentity;
  readonly input?: JsonValue;
  readonly inputReference?: string;
  readonly credentialReference?: TaskExecutionAdapterCredentialReference;
  readonly permissionRequirements: TaskExecutionAdapterPermissions;
  readonly trace?: TaskExecutionAdapterTraceReference;
}

export type TaskExecutionAdapterRawStatus =
  | "returned"
  | "failed"
  | "in_progress"
  | "unavailable";

export type TaskExecutionAdapterNormalizedOutcomeStatus =
  | "returned"
  | "failed"
  | "in_progress"
  | "unavailable"
  | "rejected";

export type TaskExecutionAdapterFailureCategory =
  | "unavailable"
  | "timeout"
  | "rejected"
  | "invalid_request"
  | "provider_error"
  | "unknown";

export interface TaskExecutionAdapterRawFailure {
  readonly code?: string;
  readonly category?: TaskExecutionAdapterFailureCategory;
  readonly message?: string;
  readonly diagnostic?: string;
}

export interface TaskExecutionAdapterRawResponse {
  readonly status: TaskExecutionAdapterRawStatus;
  readonly invocationId?: string;
  readonly idempotencyKey?: string;
  readonly taskId?: AgenticTaskId;
  readonly sourceTaskRevision?: number;
  readonly attemptId?: AgenticExecutionAttemptId;
  readonly attemptNumber?: number;
  readonly workItemId?: AgenticWorkItemId;
  readonly batchId?: AgenticWorkBatchId;
  readonly providerInvocationRef?: string;
  readonly reconciliationRef?: string;
  readonly invocationOk?: boolean;
  readonly output?: JsonValue;
  readonly outputReference?: string;
  readonly diagnosticCode?: string;
  readonly message?: string;
  readonly metadata?: JsonObject;
  readonly failure?: TaskExecutionAdapterRawFailure;
  readonly failureCode?: string;
  readonly failureCategory?: TaskExecutionAdapterFailureCategory;
  readonly diagnostic?: string;
  readonly observedAt?: string;
}

export interface TaskExecutionAdapterFailure {
  readonly code: string;
  readonly category: TaskExecutionAdapterFailureCategory;
  readonly message?: string;
}

export interface TaskExecutionAdapterProviderInvocationReference {
  readonly providerInvocationRef: string;
  readonly idempotencyKey: string;
  readonly reconciliationRef?: string;
}

export interface TaskExecutionAdapterNormalizedSafety {
  readonly productionExecutionEnabled: false;
  readonly productionAdapterInvoked: false;
  readonly externalExecutionPerformed: false;
  readonly networkCalled: false;
  readonly filesystemTouched: false;
  readonly subprocessExecuted: false;
  readonly shellExecuted: false;
  readonly toolCallsExecuted: false;
  readonly modelInvoked: false;
  readonly taskStateModified: false;
  readonly attemptStateModified: false;
  readonly invocationStateModified: false;
  readonly auditWritten: false;
  readonly verifierRun: false;
  readonly policyRuntimeRun: false;
  readonly workCompleted: false;
  readonly taskCompleted: false;
  readonly verified: false;
  readonly approved: false;
  readonly policyAuthorized: false;
  readonly rawProviderOutputAuthoritative: false;
}

export interface TaskExecutionAdapterConformanceIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: "info" | "warning" | "error";
  readonly category: AeosError["category"];
}

export interface TaskExecutionAdapterNormalizedResult {
  readonly ok: boolean;
  readonly invocationReturned: boolean;
  readonly invocationOk: boolean;
  readonly outcomeStatus: TaskExecutionAdapterNormalizedOutcomeStatus;
  readonly adapterIdentity: TaskExecutionAdapterIdentity;
  readonly invocationId: string;
  readonly idempotencyKey: string;
  readonly taskId: AgenticTaskId;
  readonly sourceTaskRevision: number;
  readonly attemptId: AgenticExecutionAttemptId;
  readonly attemptNumber: number;
  readonly workItemId: AgenticWorkItemId | null;
  readonly batchId: AgenticWorkBatchId | null;
  readonly providerInvocation: TaskExecutionAdapterProviderInvocationReference | null;
  readonly output?: JsonValue;
  readonly outputReference?: string;
  readonly diagnosticCode?: string;
  readonly message?: string;
  readonly metadata?: JsonObject;
  readonly failure?: TaskExecutionAdapterFailure;
  readonly reconciliationCapabilities: TaskExecutionInvocationProviderReconciliationCapabilities;
  readonly issues: readonly TaskExecutionAdapterConformanceIssue[];
  readonly safety: TaskExecutionAdapterNormalizedSafety;
}

export interface TaskExecutionAdapter {
  readonly identity: TaskExecutionAdapterIdentity;
  readonly capabilities: TaskExecutionAdapterCapabilities;
  readonly permissions: TaskExecutionAdapterPermissions;
  readonly invoke: (
    request: TaskExecutionAdapterInvocationRequest,
  ) =>
    | TaskExecutionAdapterRawResponse
    | unknown
    | Promise<TaskExecutionAdapterRawResponse | unknown>;
}

export interface TaskExecutionAdapterConformanceInput {
  readonly adapter: unknown;
  readonly request: TaskExecutionAdapterInvocationRequest;
  readonly expectedIdempotencyKey?: string;
  readonly taskOrModelCapabilityClaims?: unknown;
  readonly taskOrModelAdapterIdentityClaims?: unknown;
  readonly stateSnapshotBefore?: string;
  readonly stateSnapshotAfter?: string;
  readonly attemptSnapshotBefore?: string;
  readonly attemptSnapshotAfter?: string;
  readonly invocationSnapshotBefore?: string;
  readonly invocationSnapshotAfter?: string;
}

export interface TaskExecutionAdapterConformanceResult {
  readonly ok: boolean;
  readonly testExecutionConformant: boolean;
  readonly productionContractConformant: boolean;
  readonly productionExecutionEnabled: false;
  readonly adapterInvoked: boolean;
  readonly adapterIdentity: TaskExecutionAdapterIdentity | null;
  readonly capabilities: TaskExecutionAdapterCapabilities | null;
  readonly permissions: TaskExecutionAdapterPermissions | null;
  readonly request: TaskExecutionAdapterInvocationRequest;
  readonly normalizedResult: TaskExecutionAdapterNormalizedResult | null;
  readonly reconciliationCapabilities:
    | TaskExecutionInvocationProviderReconciliationCapabilities
    | null;
  readonly issues: readonly TaskExecutionAdapterConformanceIssue[];
  readonly safety: TaskExecutionAdapterNormalizedSafety;
}

const safeIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/;

const allowedFailureCategories = new Set<string>([
  "unavailable",
  "timeout",
  "rejected",
  "invalid_request",
  "provider_error",
  "unknown",
]);

const forbiddenAuthorityKeys = new Set<string>([
  "completed",
  "verified",
  "approved",
  "alldone",
  "allcomplete",
  "taskcompleted",
  "workcompleted",
  "completiongatesatisfied",
  "policyauthorized",
  "safetoretry",
  "executionenabled",
  "productionexecutionenabled",
]);

const forbiddenSecretKeys = new Set<string>([
  "apikey",
  "accesskey",
  "accesstoken",
  "token",
  "secret",
  "password",
  "authorization",
]);

const normalizedSafety: TaskExecutionAdapterNormalizedSafety = {
  productionExecutionEnabled: false,
  productionAdapterInvoked: false,
  externalExecutionPerformed: false,
  networkCalled: false,
  filesystemTouched: false,
  subprocessExecuted: false,
  shellExecuted: false,
  toolCallsExecuted: false,
  modelInvoked: false,
  taskStateModified: false,
  attemptStateModified: false,
  invocationStateModified: false,
  auditWritten: false,
  verifierRun: false,
  policyRuntimeRun: false,
  workCompleted: false,
  taskCompleted: false,
  verified: false,
  approved: false,
  policyAuthorized: false,
  rawProviderOutputAuthoritative: false,
};

function issue(input: {
  readonly code: string;
  readonly message: string;
  readonly severity?: "info" | "warning" | "error";
  readonly category?: AeosError["category"];
}): TaskExecutionAdapterConformanceIssue {
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

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
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

function jsonWithinLimit(value: JsonValue): boolean {
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

function canonicalKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isForbiddenOutputKey(key: string): boolean {
  const normalized = canonicalKey(key);

  return (
    forbiddenAuthorityKeys.has(normalized) ||
    forbiddenSecretKeys.has(normalized)
  );
}

function sanitizeJsonValue(value: unknown, depth = 0): JsonValue | undefined {
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
      const sanitized = sanitizeJsonValue(item, depth + 1);

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
    if (isForbiddenOutputKey(key)) {
      continue;
    }

    const sanitizedItem = sanitizeJsonValue(item, depth + 1);

    if (sanitizedItem !== undefined) {
      sanitized[key] = sanitizedItem;
    }
  }

  return sanitized;
}

function hasForbiddenKey(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => hasForbiddenKey(item));
  }

  if (!isRecord(value)) {
    return false;
  }

  return Object.entries(value).some(
    ([key, item]) => isForbiddenOutputKey(key) || hasForbiddenKey(item),
  );
}

function hasTrueKey(value: unknown, keys: ReadonlySet<string>): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => hasTrueKey(item, keys));
  }

  if (!isRecord(value)) {
    return false;
  }

  for (const [key, item] of Object.entries(value)) {
    if (keys.has(canonicalKey(key)) && item === true) {
      return true;
    }

    if (hasTrueKey(item, keys)) {
      return true;
    }
  }

  return false;
}

function cloneRequest(
  request: TaskExecutionAdapterInvocationRequest,
): TaskExecutionAdapterInvocationRequest {
  return JSON.parse(JSON.stringify(request)) as TaskExecutionAdapterInvocationRequest;
}

function identityFromUnknown(
  value: unknown,
): TaskExecutionAdapterIdentity | undefined {
  if (
    !isRecord(value) ||
    !isSafeId(value.adapterId) ||
    value.adapterKind !== "test_execution" ||
    !isSafeId(value.implementationVersion) ||
    !isSafeId(value.capabilityVersion) ||
    value.identityAuthority !== "system"
  ) {
    return undefined;
  }

  return value as unknown as TaskExecutionAdapterIdentity;
}

function capabilitiesFromUnknown(
  value: unknown,
): TaskExecutionAdapterCapabilities | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  for (const field of [
    "supportsIdempotencyKey",
    "supportsLookupByIdempotencyKey",
    "supportsInvocationStatusQuery",
    "supportsResultReplay",
    "providesDeterministicProviderInvocationReference",
    "supportsBoundedErrors",
    "supportsCancellation",
    "supportsStreaming",
    "supportsToolCalls",
    "supportsNetworkAccess",
    "supportsFilesystemAccess",
    "supportsProcessExecution",
    "supportsShellExecution",
    "supportsModelInvocation",
    "supportsExternalSideEffects",
  ] as const) {
    if (typeof value[field] !== "boolean") {
      return undefined;
    }
  }

  return value as unknown as TaskExecutionAdapterCapabilities;
}

function permissionsFromUnknown(
  value: unknown,
): TaskExecutionAdapterPermissions | undefined {
  if (
    !isRecord(value) ||
    value.permissionAuthority !== "system" ||
    typeof value.policyRequired !== "boolean" ||
    value.policyAuthorized !== false
  ) {
    return undefined;
  }

  for (const field of [
    "externalSideEffectPermission",
    "networkPermission",
    "filesystemPermission",
    "processPermission",
    "shellPermission",
    "toolCallPermission",
    "modelInvocationPermission",
  ] as const) {
    if (typeof value[field] !== "boolean") {
      return undefined;
    }
  }

  return value as unknown as TaskExecutionAdapterPermissions;
}

function adapterFromUnknown(value: unknown): TaskExecutionAdapter | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const identity = identityFromUnknown(value.identity);
  const capabilities = capabilitiesFromUnknown(value.capabilities);
  const permissions = permissionsFromUnknown(value.permissions);

  if (
    identity === undefined ||
    capabilities === undefined ||
    permissions === undefined ||
    typeof value.invoke !== "function"
  ) {
    return undefined;
  }

  return {
    identity,
    capabilities,
    permissions,
    invoke: value.invoke as TaskExecutionAdapter["invoke"],
  };
}

function rawResponseFromUnknown(
  value: unknown,
): TaskExecutionAdapterRawResponse | undefined {
  if (!isRecord(value) || typeof value.status !== "string") {
    return undefined;
  }

  if (
    value.status !== "returned" &&
    value.status !== "failed" &&
    value.status !== "in_progress" &&
    value.status !== "unavailable"
  ) {
    return {
      status: "unavailable",
      observedAt: safeText(value.observedAt),
    };
  }

  return value as unknown as TaskExecutionAdapterRawResponse;
}

function reconciliationCapabilities(
  capabilities: TaskExecutionAdapterCapabilities,
): TaskExecutionInvocationProviderReconciliationCapabilities {
  return {
    supportsIdempotencyKey: capabilities.supportsIdempotencyKey,
    supportsLookupByIdempotencyKey: capabilities.supportsLookupByIdempotencyKey,
    supportsInvocationStatusQuery: capabilities.supportsInvocationStatusQuery,
    supportsResultReplay: capabilities.supportsResultReplay,
  };
}

function baseNormalizedResult(input: {
  readonly request: TaskExecutionAdapterInvocationRequest;
  readonly adapterIdentity: TaskExecutionAdapterIdentity;
  readonly capabilities: TaskExecutionAdapterCapabilities;
  readonly outcomeStatus: TaskExecutionAdapterNormalizedOutcomeStatus;
  readonly invocationReturned?: boolean;
  readonly invocationOk?: boolean;
  readonly providerInvocation?: TaskExecutionAdapterProviderInvocationReference | null;
  readonly output?: JsonValue;
  readonly outputReference?: string;
  readonly diagnosticCode?: string;
  readonly message?: string;
  readonly metadata?: JsonObject;
  readonly failure?: TaskExecutionAdapterFailure;
  readonly issues: readonly TaskExecutionAdapterConformanceIssue[];
}): TaskExecutionAdapterNormalizedResult {
  return {
    ok:
      input.outcomeStatus === "returned" &&
      input.invocationOk === true &&
      input.issues.every((item) => item.severity !== "error"),
    invocationReturned: input.invocationReturned ?? false,
    invocationOk: input.invocationOk ?? false,
    outcomeStatus: input.outcomeStatus,
    adapterIdentity: input.adapterIdentity,
    invocationId: input.request.invocationId,
    idempotencyKey: input.request.idempotencyKey,
    taskId: input.request.taskId,
    sourceTaskRevision: input.request.sourceTaskRevision,
    attemptId: input.request.attemptId,
    attemptNumber: input.request.attemptNumber,
    workItemId: input.request.workItemId ?? null,
    batchId: input.request.batchId ?? null,
    providerInvocation: input.providerInvocation ?? null,
    output: input.output,
    outputReference: input.outputReference,
    diagnosticCode: input.diagnosticCode,
    message: input.message,
    metadata: input.metadata,
    failure: input.failure,
    reconciliationCapabilities: reconciliationCapabilities(input.capabilities),
    issues: input.issues,
    safety: normalizedSafety,
  };
}

function mismatchIssues(input: {
  readonly request: TaskExecutionAdapterInvocationRequest;
  readonly rawResult: TaskExecutionAdapterRawResponse;
}): readonly TaskExecutionAdapterConformanceIssue[] {
  const issues: TaskExecutionAdapterConformanceIssue[] = [];
  const checks: readonly {
    readonly field: keyof TaskExecutionAdapterRawResponse;
    readonly expected: string | number | undefined;
  }[] = [
    { field: "invocationId", expected: input.request.invocationId },
    { field: "idempotencyKey", expected: input.request.idempotencyKey },
    { field: "taskId", expected: input.request.taskId },
    { field: "sourceTaskRevision", expected: input.request.sourceTaskRevision },
    { field: "attemptId", expected: input.request.attemptId },
    { field: "attemptNumber", expected: input.request.attemptNumber },
    { field: "workItemId", expected: input.request.workItemId },
    { field: "batchId", expected: input.request.batchId },
  ];

  for (const check of checks) {
    const actual = input.rawResult[check.field];

    if (actual !== undefined && actual !== check.expected) {
      issues.push(
        issue({
          code:
            check.field === "idempotencyKey"
              ? "task_execution_adapter_idempotency_mismatch"
              : "task_execution_adapter_invocation_binding_mismatch",
          message:
            "Execution adapter raw response did not match the authoritative invocation request binding.",
          category: "validation",
        }),
      );
      break;
    }
  }

  return issues;
}

function normalizedFailure(
  rawResult: TaskExecutionAdapterRawResponse | undefined,
  fallback: TaskExecutionAdapterFailure,
): TaskExecutionAdapterFailure {
  if (rawResult === undefined) {
    return fallback;
  }

  const rawFailure = rawResult.failure;
  const category =
    rawFailure?.category !== undefined &&
    allowedFailureCategories.has(rawFailure.category)
      ? rawFailure.category
      : rawResult.failureCategory !== undefined &&
          allowedFailureCategories.has(rawResult.failureCategory)
        ? rawResult.failureCategory
        : fallback.category;

  return {
    code:
      safeText(rawFailure?.code) ??
      safeText(rawResult.failureCode) ??
      fallback.code,
    category,
    message:
      safeText(rawFailure?.message) ??
      safeText(rawFailure?.diagnostic) ??
      safeText(rawResult.message) ??
      safeText(rawResult.diagnostic) ??
      fallback.message,
  };
}

export function normalizeTaskExecutionAdapterResult(input: {
  readonly adapterIdentity: TaskExecutionAdapterIdentity;
  readonly capabilities: TaskExecutionAdapterCapabilities;
  readonly request: TaskExecutionAdapterInvocationRequest;
  readonly rawResponse: unknown;
}): TaskExecutionAdapterNormalizedResult {
  const issues: TaskExecutionAdapterConformanceIssue[] = [];
  const rawResult = rawResponseFromUnknown(input.rawResponse);

  if (rawResult === undefined) {
    issues.push(
      issue({
        code: "task_execution_adapter_raw_response_invalid",
        message:
          "Execution adapter raw response was invalid and was normalized to unavailable.",
        category: "validation",
      }),
    );

    return baseNormalizedResult({
      request: input.request,
      adapterIdentity: input.adapterIdentity,
      capabilities: input.capabilities,
      outcomeStatus: "unavailable",
      failure: {
        code: "task_execution_adapter_response_unavailable",
        category: "unavailable",
        message: "Execution adapter response was unavailable.",
      },
      issues,
    });
  }

  issues.push(
    ...mismatchIssues({
      request: input.request,
      rawResult,
    }),
  );

  if (hasTrueKey(rawResult, forbiddenAuthorityKeys)) {
    issues.push(
      issue({
        code: "task_execution_adapter_authority_claim_ignored",
        message:
          "Execution adapter output contained completion, verification, approval, policy, or retry authority claims; they were stripped from normalized output.",
          severity: "warning",
          category: "validation",
        }),
    );
  }

  if (hasForbiddenKey(rawResult)) {
    issues.push(
      issue({
        code: "task_execution_adapter_forbidden_output_fields_stripped",
        message:
          "Execution adapter output contained forbidden authority or credential fields; they were stripped from normalized output.",
          severity: "warning",
          category: "validation",
      }),
    );
  }

  if (issues.some((item) => item.severity === "error")) {
    return baseNormalizedResult({
      request: input.request,
      adapterIdentity: input.adapterIdentity,
      capabilities: input.capabilities,
      outcomeStatus: "rejected",
      failure: normalizedFailure(rawResult, {
        code: "task_execution_adapter_response_rejected",
        category: "invalid_request",
        message:
          "Execution adapter response was rejected because it did not match invocation authority.",
      }),
      issues,
    });
  }

  const output =
    rawResult.output !== undefined
      ? sanitizeJsonValue(rawResult.output)
      : undefined;
  const boundedOutput =
    output !== undefined && jsonWithinLimit(output) ? output : undefined;
  const metadata =
    rawResult.metadata !== undefined
      ? sanitizeJsonValue(rawResult.metadata)
      : undefined;
  const boundedMetadata =
    metadata !== undefined && isJsonObject(metadata) && jsonWithinLimit(metadata)
      ? metadata
      : undefined;
  const providerInvocationRef = safeText(rawResult.providerInvocationRef);
  const reconciliationRef = safeText(rawResult.reconciliationRef);
  const providerInvocation =
    providerInvocationRef === undefined
      ? null
      : {
          providerInvocationRef,
          idempotencyKey: input.request.idempotencyKey,
          reconciliationRef,
        };

  if (rawResult.status === "returned") {
    if (typeof rawResult.invocationOk !== "boolean") {
      issues.push(
        issue({
          code: "task_execution_adapter_returned_invocation_ok_missing",
          message:
            "Execution adapter returned response must include a typed invocationOk boolean.",
          category: "validation",
        }),
      );
    }

    return baseNormalizedResult({
      request: input.request,
      adapterIdentity: input.adapterIdentity,
      capabilities: input.capabilities,
      outcomeStatus:
        typeof rawResult.invocationOk === "boolean" ? "returned" : "rejected",
      invocationReturned: typeof rawResult.invocationOk === "boolean",
      invocationOk: rawResult.invocationOk === true,
      providerInvocation,
      output: boundedOutput,
      outputReference: safeText(rawResult.outputReference),
      diagnosticCode: safeText(rawResult.diagnosticCode),
      message: safeText(rawResult.message),
      metadata: boundedMetadata,
      failure:
        typeof rawResult.invocationOk === "boolean"
          ? undefined
          : {
              code: "task_execution_adapter_returned_invalid",
              category: "invalid_request",
              message:
                "Execution adapter returned response was missing invocationOk.",
            },
      issues,
    });
  }

  if (rawResult.status === "in_progress") {
    return baseNormalizedResult({
      request: input.request,
      adapterIdentity: input.adapterIdentity,
      capabilities: input.capabilities,
      outcomeStatus: "in_progress",
      providerInvocation,
      outputReference: safeText(rawResult.outputReference),
      diagnosticCode: safeText(rawResult.diagnosticCode),
      message: safeText(rawResult.message),
      metadata: boundedMetadata,
      issues,
    });
  }

  const failure = normalizedFailure(rawResult, {
    code:
      rawResult.status === "unavailable"
        ? "task_execution_adapter_unavailable"
        : "task_execution_adapter_failed",
    category: rawResult.status === "unavailable" ? "unavailable" : "unknown",
    message:
      rawResult.status === "unavailable"
        ? "Execution adapter status is unavailable."
        : "Execution adapter reported a structured failure.",
  });

  return baseNormalizedResult({
    request: input.request,
    adapterIdentity: input.adapterIdentity,
    capabilities: input.capabilities,
    outcomeStatus: rawResult.status,
    providerInvocation,
    outputReference: safeText(rawResult.outputReference),
    diagnosticCode: safeText(rawResult.diagnosticCode),
    message: safeText(rawResult.message),
    metadata: boundedMetadata,
    failure,
    issues,
  });
}

function validateCredentialReference(
  value: unknown,
): readonly TaskExecutionAdapterConformanceIssue[] {
  if (value === undefined) {
    return [];
  }

  if (
    !isRecord(value) ||
    !isSafeId(value.credentialRef) ||
    (value.secretProviderRef !== undefined && !isSafeId(value.secretProviderRef)) ||
    !isStringArray(value.credentialScope) ||
    value.credentialAuthority !== "system" ||
    value.rawCredentialMaterialPresent !== false ||
    hasForbiddenKey(value)
  ) {
    return [
      issue({
        code: "task_execution_adapter_credential_reference_invalid",
        message:
          "Execution adapter credentials must be system-owned references without raw credential material.",
        category: "validation",
      }),
    ];
  }

  return [];
}

function capabilityIssues(
  capabilities: TaskExecutionAdapterCapabilities,
): readonly TaskExecutionAdapterConformanceIssue[] {
  const issues: TaskExecutionAdapterConformanceIssue[] = [];

  if (
    capabilities.supportsLookupByIdempotencyKey &&
    !capabilities.supportsIdempotencyKey
  ) {
    issues.push(
      issue({
        code: "task_execution_adapter_capability_contradiction",
        message:
          "Lookup by idempotency key requires idempotency-key propagation support.",
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
        code: "task_execution_adapter_result_replay_contradiction",
        message:
          "Result replay requires status query and idempotency-key lookup capability.",
        category: "validation",
      }),
    );
  }

  for (const [field, code] of [
    [
      "supportsNetworkAccess",
      "task_execution_adapter_test_network_capability_unsupported",
    ],
    [
      "supportsFilesystemAccess",
      "task_execution_adapter_test_filesystem_capability_unsupported",
    ],
    [
      "supportsProcessExecution",
      "task_execution_adapter_test_process_capability_unsupported",
    ],
    [
      "supportsShellExecution",
      "task_execution_adapter_test_shell_capability_unsupported",
    ],
    [
      "supportsModelInvocation",
      "task_execution_adapter_test_model_capability_unsupported",
    ],
    [
      "supportsExternalSideEffects",
      "task_execution_adapter_test_external_side_effects_unsupported",
    ],
  ] as const) {
    if (capabilities[field]) {
      issues.push(
        issue({
          code,
          message:
            "TASK-0298 test execution adapters cannot claim real execution side-effect capabilities.",
          category: "permission",
        }),
      );
    }
  }

  return issues;
}

function productionProfileIssues(
  capabilities: TaskExecutionAdapterCapabilities,
): readonly TaskExecutionAdapterConformanceIssue[] {
  const issues: TaskExecutionAdapterConformanceIssue[] = [];

  for (const [field, code] of [
    ["supportsIdempotencyKey", "task_execution_adapter_production_idempotency_required"],
    [
      "providesDeterministicProviderInvocationReference",
      "task_execution_adapter_production_provider_reference_required",
    ],
    [
      "supportsLookupByIdempotencyKey",
      "task_execution_adapter_production_idempotency_lookup_required",
    ],
    [
      "supportsInvocationStatusQuery",
      "task_execution_adapter_production_status_query_required",
    ],
    ["supportsResultReplay", "task_execution_adapter_production_result_replay_required"],
    ["supportsBoundedErrors", "task_execution_adapter_production_bounded_errors_required"],
  ] as const) {
    if (!capabilities[field]) {
      issues.push(
        issue({
          code,
          message:
            "Production-capable execution adapter contract profile is missing a required capability.",
          severity: "warning",
          category: "conflict",
        }),
      );
    }
  }

  return issues;
}

function permissionIssues(
  permissions: TaskExecutionAdapterPermissions,
): readonly TaskExecutionAdapterConformanceIssue[] {
  const issues: TaskExecutionAdapterConformanceIssue[] = [];

  if (permissions.policyAuthorized !== false) {
    issues.push(
      issue({
        code: "task_execution_adapter_policy_self_authorization_forbidden",
        message:
          "Execution adapters cannot self-grant policy authorization.",
        category: "policy",
      }),
    );
  }

  for (const [field, code] of [
    [
      "externalSideEffectPermission",
      "task_execution_adapter_external_side_effect_permission_forbidden",
    ],
    ["networkPermission", "task_execution_adapter_network_permission_forbidden"],
    [
      "filesystemPermission",
      "task_execution_adapter_filesystem_permission_forbidden",
    ],
    ["processPermission", "task_execution_adapter_process_permission_forbidden"],
    ["shellPermission", "task_execution_adapter_shell_permission_forbidden"],
    ["toolCallPermission", "task_execution_adapter_tool_call_permission_forbidden"],
    [
      "modelInvocationPermission",
      "task_execution_adapter_model_invocation_permission_forbidden",
    ],
  ] as const) {
    if (permissions[field]) {
      issues.push(
        issue({
          code,
          message:
            "TASK-0298 test execution conformance forbids real external-effect permissions.",
          category: "permission",
        }),
      );
    }
  }

  return issues;
}

function requestIssues(
  request: TaskExecutionAdapterInvocationRequest,
): readonly TaskExecutionAdapterConformanceIssue[] {
  const issues: TaskExecutionAdapterConformanceIssue[] = [];

  if (
    !isSafeId(request.invocationId) ||
    typeof request.idempotencyKey !== "string" ||
    request.idempotencyKey.length === 0 ||
    !isSafeId(request.taskId) ||
    !isPositiveInteger(request.sourceTaskRevision) ||
    !isSafeId(request.attemptId) ||
    !isPositiveInteger(request.attemptNumber) ||
    (request.workItemId !== undefined && typeof request.workItemId !== "string") ||
    (request.batchId !== undefined && typeof request.batchId !== "string") ||
    request.operationKind !== "execute_task_attempt"
  ) {
    issues.push(
      issue({
        code: "task_execution_adapter_request_invalid",
        message:
          "Execution adapter invocation request must be built from authoritative AEOS invocation context.",
        category: "validation",
      }),
    );
  }

  const identity = identityFromUnknown(request.adapterIdentity);

  if (identity === undefined) {
    issues.push(
      issue({
        code: "task_execution_adapter_request_identity_invalid",
        message:
          "Execution adapter request must carry a valid system-owned adapter identity.",
        category: "validation",
      }),
    );
  }

  issues.push(...validateCredentialReference(request.credentialReference));
  issues.push(...permissionIssues(request.permissionRequirements));

  return issues;
}

function snapshotsChanged(input: {
  readonly before?: string;
  readonly after?: string;
}): boolean {
  return input.before !== undefined && input.after !== undefined && input.before !== input.after;
}

export async function evaluateTaskExecutionAdapterConformance(
  input: TaskExecutionAdapterConformanceInput,
): Promise<TaskExecutionAdapterConformanceResult> {
  const issues: TaskExecutionAdapterConformanceIssue[] = [
    ...requestIssues(input.request),
  ];

  if (input.taskOrModelCapabilityClaims !== undefined) {
    issues.push(
      issue({
        code: "task_execution_adapter_task_capability_claims_ignored",
        message:
          "Task or model capability claims are ignored; only system adapter metadata is considered.",
        severity: "warning",
        category: "validation",
      }),
    );
  }

  if (input.taskOrModelAdapterIdentityClaims !== undefined) {
    issues.push(
      issue({
        code: "task_execution_adapter_task_identity_claims_ignored",
        message:
          "Task or model adapter identity claims are ignored; identity is system-owned.",
        severity: "warning",
        category: "validation",
      }),
    );
  }

  if (
    snapshotsChanged({
      before: input.stateSnapshotBefore,
      after: input.stateSnapshotAfter,
    }) ||
    snapshotsChanged({
      before: input.attemptSnapshotBefore,
      after: input.attemptSnapshotAfter,
    }) ||
    snapshotsChanged({
      before: input.invocationSnapshotBefore,
      after: input.invocationSnapshotAfter,
    })
  ) {
    issues.push(
      issue({
        code: "task_execution_adapter_conformance_state_mutation_detected",
        message:
          "Execution adapter conformance harness detected mutation of supplied authoritative state snapshots.",
        category: "conflict",
      }),
    );
  }

  const adapter = adapterFromUnknown(input.adapter);

  if (adapter === undefined) {
    const invalidResult: TaskExecutionAdapterConformanceResult = {
      ok: false,
      testExecutionConformant: false,
      productionContractConformant: false,
      productionExecutionEnabled: false,
      adapterInvoked: false,
      adapterIdentity: null,
      capabilities: null,
      permissions: null,
      request: input.request,
      normalizedResult: null,
      reconciliationCapabilities: null,
      issues: [
        ...issues,
        issue({
          code: "task_execution_adapter_invalid",
          message:
            "Execution adapter must be an explicitly injected test_execution adapter with system-owned identity, capabilities, and permissions.",
          category: "validation",
        }),
      ],
      safety: normalizedSafety,
    };

    return invalidResult;
  }

  if (adapter.identity.adapterId !== input.request.adapterIdentity.adapterId) {
    issues.push(
      issue({
        code: "task_execution_adapter_request_identity_mismatch",
        message:
          "Execution adapter request identity must match the injected adapter identity.",
        category: "validation",
      }),
    );
  }

  issues.push(...capabilityIssues(adapter.capabilities));
  issues.push(...permissionIssues(adapter.permissions));

  if (
    input.expectedIdempotencyKey !== undefined &&
    input.request.idempotencyKey !== input.expectedIdempotencyKey
  ) {
    issues.push(
      issue({
        code: "task_execution_adapter_request_idempotency_mismatch",
        message:
          "Execution adapter request idempotency key does not match the persisted AEOS idempotency authority.",
        category: "validation",
      }),
    );
  }

  let adapterInvoked = false;
  let rawResponse: unknown;
  const requestBefore = JSON.stringify(input.request);

  if (!issues.some((item) => item.severity === "error")) {
    try {
      adapterInvoked = true;
      rawResponse = await adapter.invoke(cloneRequest(input.request));
    } catch {
      rawResponse = {
        status: "unavailable",
        failureCode: "task_execution_adapter_threw",
        failureCategory: "provider_error",
        message:
          "Execution adapter threw; raw error text is not authoritative.",
      };
    }
  }

  if (JSON.stringify(input.request) !== requestBefore) {
    issues.push(
      issue({
        code: "task_execution_adapter_request_mutation_detected",
        message:
          "Execution adapter conformance detected mutation of the invocation request object.",
        category: "conflict",
      }),
    );
  }

  const normalizedResult =
    rawResponse === undefined
      ? null
      : normalizeTaskExecutionAdapterResult({
          adapterIdentity: adapter.identity,
          capabilities: adapter.capabilities,
          request: input.request,
          rawResponse,
        });
  const combinedIssues = [
    ...issues,
    ...(normalizedResult?.issues ?? []),
    ...productionProfileIssues(adapter.capabilities),
  ];
  const errorFree = combinedIssues.every((item) => item.severity !== "error");
  const productionRequiredCapabilities =
    adapter.capabilities.supportsIdempotencyKey &&
    adapter.capabilities.providesDeterministicProviderInvocationReference &&
    adapter.capabilities.supportsLookupByIdempotencyKey &&
    adapter.capabilities.supportsInvocationStatusQuery &&
    adapter.capabilities.supportsResultReplay &&
    adapter.capabilities.supportsBoundedErrors;
  const productionHasProviderRef =
    normalizedResult === null ||
    normalizedResult.outcomeStatus !== "returned" ||
    normalizedResult.providerInvocation !== null;
  const productionContractConformant =
    errorFree && productionRequiredCapabilities && productionHasProviderRef;
  const testExecutionConformant =
    errorFree &&
    adapter.identity.adapterKind === "test_execution" &&
    adapter.permissions.networkPermission === false &&
    adapter.permissions.filesystemPermission === false &&
    adapter.permissions.shellPermission === false &&
    adapter.permissions.processPermission === false &&
    adapter.permissions.toolCallPermission === false &&
    adapter.permissions.modelInvocationPermission === false &&
    adapter.permissions.externalSideEffectPermission === false &&
    normalizedResult !== null &&
    normalizedResult.outcomeStatus !== "rejected";

  return {
    ok: testExecutionConformant,
    testExecutionConformant,
    productionContractConformant,
    productionExecutionEnabled: false,
    adapterInvoked,
    adapterIdentity: adapter.identity,
    capabilities: adapter.capabilities,
    permissions: adapter.permissions,
    request: input.request,
    normalizedResult,
    reconciliationCapabilities: reconciliationCapabilities(adapter.capabilities),
    issues: combinedIssues,
    safety: normalizedSafety,
  };
}
