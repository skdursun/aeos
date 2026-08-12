import type {
  AgenticExecutionAttemptId,
  AgenticTaskId,
  AgenticWorkBatchId,
  AgenticWorkItemId,
} from "./agentic-lifecycle.js";
import type {
  TaskExecutionAdapterOperationKind,
} from "./task-execution-adapter.js";
import type {
  TaskExecutionPermissionGateResult,
  TaskExecutionPermissionKind,
} from "./task-execution-permission-gate.js";
import type {
  TaskExecutionInvocationRecord,
} from "./task-execution-invocation-record.js";
import {
  validateTaskExecutionInvocationRecord,
} from "./task-execution-invocation-record.js";
import type { AeosError, JsonObject, JsonValue } from "./types.js";

export const TASK_EXECUTION_WORKER_RUNTIME_EXECUTION_ENABLED = false;

export type TaskExecutionWorkerFamily = "generic" | "codex" | "claude_code";

export type TaskExecutionWorkerRuntimeKind = "test_worker";

export type TaskExecutionWorkerRole =
  | "planner"
  | "implementation"
  | "verifier";

export type TaskExecutionWorkerOutcomeStatus =
  | "returned"
  | "failed"
  | "in_progress"
  | "unavailable"
  | "rejected";

export type TaskExecutionWorkerFailureCategory =
  | "unavailable"
  | "timeout"
  | "rejected"
  | "invalid_request"
  | "worker_error"
  | "unknown";

export interface TaskExecutionWorkerIdentity {
  readonly workerId: string;
  readonly workerFamily: TaskExecutionWorkerFamily;
  readonly runtimeKind: TaskExecutionWorkerRuntimeKind;
  readonly implementationVersion: string;
  readonly capabilityVersion: string;
  readonly identityAuthority: "system";
  readonly selectionAuthority: "system";
}

export interface TaskExecutionWorkerCapabilities {
  readonly roles: readonly TaskExecutionWorkerRole[];
  readonly repositoryRead: boolean;
  readonly repositoryWrite: boolean;
  readonly processExecution: boolean;
  readonly shellExecution: boolean;
  readonly toolExecution: boolean;
  readonly modelReasoning: boolean;
  readonly patchGeneration: boolean;
  readonly testExecution: boolean;
  readonly boundedDiagnostics: boolean;
  readonly deterministicTestResult: boolean;
}

export interface TaskExecutionWorkerWorkspaceReference {
  readonly authority: "system";
  readonly workspaceRef: string;
  readonly projectRef: string;
  readonly repositoryRef?: string;
  readonly allowedPathRefs?: readonly string[];
  readonly repositoryWriteAllowed: boolean;
}

export interface TaskExecutionWorkerPermissionFacts {
  readonly authority: "system";
  readonly permissionGateId: string;
  readonly allowed: boolean;
  readonly decision: TaskExecutionPermissionGateResult["decision"];
  readonly capabilitySatisfied: boolean;
  readonly permissionsSatisfied: boolean;
  readonly policyAuthorized: boolean;
  readonly requiredPermissions: readonly TaskExecutionPermissionKind[];
}

export interface TaskExecutionWorkerRequest {
  readonly taskId: AgenticTaskId;
  readonly sourceTaskRevision: number;
  readonly attemptId: AgenticExecutionAttemptId;
  readonly attemptNumber: number;
  readonly invocationId: string;
  readonly idempotencyKey: string;
  readonly workItemId?: AgenticWorkItemId;
  readonly batchId?: AgenticWorkBatchId;
  readonly operationKind: TaskExecutionAdapterOperationKind;
  readonly workerIdentity: TaskExecutionWorkerIdentity;
  readonly boundedInstructions: string;
  readonly contextReferences: readonly string[];
  readonly workspace: TaskExecutionWorkerWorkspaceReference;
  readonly permissionFacts: TaskExecutionWorkerPermissionFacts;
  readonly trace?: {
    readonly correlationId: string;
    readonly traceId?: string;
  };
}

export interface TaskExecutionWorkerIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: "info" | "warning" | "error";
  readonly category: AeosError["category"];
}

export interface TaskExecutionWorkerFailure {
  readonly code: string;
  readonly category: TaskExecutionWorkerFailureCategory;
  readonly message?: string;
}

export interface TaskExecutionWorkerRawFailure {
  readonly code?: string;
  readonly category?: TaskExecutionWorkerFailureCategory;
  readonly message?: string;
  readonly diagnostic?: string;
}

export interface TaskExecutionWorkerRawResult {
  readonly status: Exclude<TaskExecutionWorkerOutcomeStatus, "rejected">;
  readonly workerId?: string;
  readonly workerFamily?: TaskExecutionWorkerFamily;
  readonly runtimeKind?: TaskExecutionWorkerRuntimeKind;
  readonly invocationId?: string;
  readonly idempotencyKey?: string;
  readonly taskId?: AgenticTaskId;
  readonly sourceTaskRevision?: number;
  readonly attemptId?: AgenticExecutionAttemptId;
  readonly attemptNumber?: number;
  readonly workItemId?: AgenticWorkItemId;
  readonly batchId?: AgenticWorkBatchId;
  readonly invocationOk?: boolean;
  readonly output?: JsonValue;
  readonly outputReference?: string;
  readonly patchArtifactReference?: string;
  readonly changedFileManifestReference?: string;
  readonly testSummaryReference?: string;
  readonly diagnosticCode?: string;
  readonly message?: string;
  readonly metadata?: JsonObject;
  readonly failure?: TaskExecutionWorkerRawFailure;
  readonly failureCode?: string;
  readonly failureCategory?: TaskExecutionWorkerFailureCategory;
  readonly diagnostic?: string;
  readonly observedAt?: string;
}

export interface TaskExecutionWorkerResultSafety {
  readonly runtimeExecutionEnabled: false;
  readonly realCodexInvoked: false;
  readonly realClaudeCodeInvoked: false;
  readonly cloudCalled: false;
  readonly networkCalled: false;
  readonly filesystemTouched: false;
  readonly repositoryWritten: false;
  readonly subprocessExecuted: false;
  readonly shellExecuted: false;
  readonly modelInvoked: false;
  readonly taskStateModified: false;
  readonly attemptStateModified: false;
  readonly invocationStateModified: false;
  readonly workAccountingModified: false;
  readonly auditWritten: false;
  readonly verifierRun: false;
  readonly workCompleted: false;
  readonly taskCompleted: false;
  readonly verified: false;
  readonly approved: false;
  readonly safeToRetry: false;
  readonly rawWorkerOutputAuthoritative: false;
}

export interface TaskExecutionWorkerResult {
  readonly ok: boolean;
  readonly invocationReturned: boolean;
  readonly invocationOk: boolean;
  readonly outcomeStatus: TaskExecutionWorkerOutcomeStatus;
  readonly workerIdentity: TaskExecutionWorkerIdentity;
  readonly taskId: AgenticTaskId;
  readonly sourceTaskRevision: number;
  readonly attemptId: AgenticExecutionAttemptId;
  readonly attemptNumber: number;
  readonly invocationId: string;
  readonly idempotencyKey: string;
  readonly workItemId: AgenticWorkItemId | null;
  readonly batchId: AgenticWorkBatchId | null;
  readonly output?: JsonValue;
  readonly outputReference?: string;
  readonly patchArtifactReference?: string;
  readonly changedFileManifestReference?: string;
  readonly testSummaryReference?: string;
  readonly diagnosticCode?: string;
  readonly message?: string;
  readonly metadata?: JsonObject;
  readonly failure?: TaskExecutionWorkerFailure;
  readonly issues: readonly TaskExecutionWorkerIssue[];
  readonly safety: TaskExecutionWorkerResultSafety;
}

export interface TaskExecutionWorkerAdapter {
  readonly identity: TaskExecutionWorkerIdentity;
  readonly capabilities: TaskExecutionWorkerCapabilities;
  readonly run: (
    request: TaskExecutionWorkerRequest,
  ) =>
    | TaskExecutionWorkerRawResult
    | unknown
    | Promise<TaskExecutionWorkerRawResult | unknown>;
}

export interface TaskExecutionWorkerConformanceInput {
  readonly worker: unknown;
  readonly request: TaskExecutionWorkerRequest;
  readonly invocationRecord: unknown;
  readonly permissionGateResult?: TaskExecutionPermissionGateResult;
  readonly expectedIdempotencyKey?: string;
  readonly taskOrModelWorkerSelectionClaims?: unknown;
  readonly taskOrModelCapabilityClaims?: unknown;
  readonly stateSnapshotBefore?: string;
  readonly stateSnapshotAfter?: string;
  readonly attemptSnapshotBefore?: string;
  readonly attemptSnapshotAfter?: string;
  readonly invocationSnapshotBefore?: string;
  readonly invocationSnapshotAfter?: string;
  readonly workAccountingSnapshotBefore?: string;
  readonly workAccountingSnapshotAfter?: string;
}

export interface TaskExecutionWorkerConformanceResult {
  readonly ok: boolean;
  readonly testWorkerConformant: boolean;
  readonly runtimeExecutionEnabled: false;
  readonly workerInvoked: boolean;
  readonly workerIdentity: TaskExecutionWorkerIdentity | null;
  readonly capabilities: TaskExecutionWorkerCapabilities | null;
  readonly request: TaskExecutionWorkerRequest;
  readonly normalizedResult: TaskExecutionWorkerResult | null;
  readonly issues: readonly TaskExecutionWorkerIssue[];
  readonly safety: TaskExecutionWorkerResultSafety;
}

const safeIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/;

const allowedRoles = new Set<string>([
  "planner",
  "implementation",
  "verifier",
]);

const allowedFamilies = new Set<string>(["generic", "codex", "claude_code"]);

const allowedFailureCategories = new Set<string>([
  "unavailable",
  "timeout",
  "rejected",
  "invalid_request",
  "worker_error",
  "unknown",
]);

const forbiddenAuthorityKeys = new Set<string>([
  "completed",
  "verified",
  "approved",
  "alldone",
  "allcomplete",
  "taskcomplete",
  "taskcompleted",
  "workcompleted",
  "completiongatesatisfied",
  "verifiersatisfied",
  "safetoretry",
  "retryable",
  "ownershiptoken",
]);

const forbiddenSecretKeys = new Set<string>([
  "apikey",
  "accesskey",
  "accesstoken",
  "token",
  "secret",
  "password",
  "authorization",
  "credential",
]);

const resultSafety: TaskExecutionWorkerResultSafety = {
  runtimeExecutionEnabled: TASK_EXECUTION_WORKER_RUNTIME_EXECUTION_ENABLED,
  realCodexInvoked: false,
  realClaudeCodeInvoked: false,
  cloudCalled: false,
  networkCalled: false,
  filesystemTouched: false,
  repositoryWritten: false,
  subprocessExecuted: false,
  shellExecuted: false,
  modelInvoked: false,
  taskStateModified: false,
  attemptStateModified: false,
  invocationStateModified: false,
  workAccountingModified: false,
  auditWritten: false,
  verifierRun: false,
  workCompleted: false,
  taskCompleted: false,
  verified: false,
  approved: false,
  safeToRetry: false,
  rawWorkerOutputAuthoritative: false,
};

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

function isSafeReference(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value === value.trim() &&
    value.length > 0 &&
    value.length <= 256 &&
    value !== "." &&
    value !== ".." &&
    !value.includes("../") &&
    !value.includes("..\\") &&
    !value.startsWith("/") &&
    !/^[A-Za-z]:[\\/]/.test(value)
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

function cloneRequest(
  request: TaskExecutionWorkerRequest,
): TaskExecutionWorkerRequest {
  return JSON.parse(JSON.stringify(request)) as TaskExecutionWorkerRequest;
}

function identityFromUnknown(
  value: unknown,
): TaskExecutionWorkerIdentity | undefined {
  if (
    !isRecord(value) ||
    !isSafeId(value.workerId) ||
    typeof value.workerFamily !== "string" ||
    !allowedFamilies.has(value.workerFamily) ||
    value.runtimeKind !== "test_worker" ||
    !isSafeId(value.implementationVersion) ||
    !isSafeId(value.capabilityVersion) ||
    value.identityAuthority !== "system" ||
    value.selectionAuthority !== "system"
  ) {
    return undefined;
  }

  return value as unknown as TaskExecutionWorkerIdentity;
}

function capabilitiesFromUnknown(
  value: unknown,
): TaskExecutionWorkerCapabilities | undefined {
  if (!isRecord(value) || !isStringArray(value.roles)) {
    return undefined;
  }

  if (!value.roles.every((role) => allowedRoles.has(role))) {
    return undefined;
  }

  for (const field of [
    "repositoryRead",
    "repositoryWrite",
    "processExecution",
    "shellExecution",
    "toolExecution",
    "modelReasoning",
    "patchGeneration",
    "testExecution",
    "boundedDiagnostics",
    "deterministicTestResult",
  ] as const) {
    if (typeof value[field] !== "boolean") {
      return undefined;
    }
  }

  return value as unknown as TaskExecutionWorkerCapabilities;
}

function workerFromUnknown(
  value: unknown,
): TaskExecutionWorkerAdapter | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const identity = identityFromUnknown(value.identity);
  const capabilities = capabilitiesFromUnknown(value.capabilities);

  if (
    identity === undefined ||
    capabilities === undefined ||
    typeof value.run !== "function"
  ) {
    return undefined;
  }

  return {
    identity,
    capabilities,
    run: value.run as TaskExecutionWorkerAdapter["run"],
  };
}

function rawResultFromUnknown(
  value: unknown,
): TaskExecutionWorkerRawResult | undefined {
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

  return value as unknown as TaskExecutionWorkerRawResult;
}

function workspaceIssues(
  workspace: TaskExecutionWorkerWorkspaceReference,
): readonly TaskExecutionWorkerIssue[] {
  const issues: TaskExecutionWorkerIssue[] = [];

  if (
    workspace.authority !== "system" ||
    !isSafeReference(workspace.workspaceRef) ||
    !isSafeReference(workspace.projectRef) ||
    typeof workspace.repositoryWriteAllowed !== "boolean" ||
    (workspace.repositoryRef !== undefined &&
      !isSafeReference(workspace.repositoryRef)) ||
    (workspace.allowedPathRefs !== undefined &&
      (!isStringArray(workspace.allowedPathRefs) ||
        !workspace.allowedPathRefs.every((item) => isSafeReference(item))))
  ) {
    issues.push(
      issue({
        code: "task_execution_worker_workspace_reference_invalid",
        message:
          "Worker workspace reference must be system-owned bounded metadata and cannot grant arbitrary filesystem root authority.",
        category: "permission",
      }),
    );
  }

  return issues;
}

function permissionFactIssues(
  facts: TaskExecutionWorkerPermissionFacts,
): readonly TaskExecutionWorkerIssue[] {
  const issues: TaskExecutionWorkerIssue[] = [];

  if (
    facts.authority !== "system" ||
    !isSafeReference(facts.permissionGateId) ||
    typeof facts.allowed !== "boolean" ||
    typeof facts.capabilitySatisfied !== "boolean" ||
    typeof facts.permissionsSatisfied !== "boolean" ||
    typeof facts.policyAuthorized !== "boolean" ||
    !isStringArray(facts.requiredPermissions)
  ) {
    issues.push(
      issue({
        code: "task_execution_worker_permission_facts_invalid",
        message:
          "Worker permission facts must be bounded system-owned permission gate facts.",
        category: "permission",
      }),
    );
  }

  return issues;
}

function requestIssues(
  request: TaskExecutionWorkerRequest,
): readonly TaskExecutionWorkerIssue[] {
  const issues: TaskExecutionWorkerIssue[] = [];

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
    request.operationKind !== "execute_task_attempt" ||
    typeof request.boundedInstructions !== "string" ||
    request.boundedInstructions.trim().length === 0 ||
    request.boundedInstructions.length > 4096 ||
    !isStringArray(request.contextReferences)
  ) {
    issues.push(
      issue({
        code: "task_execution_worker_request_invalid",
        message:
          "Worker request must be bounded and built from authoritative AEOS invocation context.",
        category: "validation",
      }),
    );
  }

  const identity = identityFromUnknown(request.workerIdentity);

  if (identity === undefined) {
    issues.push(
      issue({
        code: "task_execution_worker_request_identity_invalid",
        message:
          "Worker request must carry a valid system-owned worker identity.",
        category: "validation",
      }),
    );
  }

  if (hasForbiddenKey(request)) {
    issues.push(
      issue({
        code: "task_execution_worker_request_forbidden_authority_or_secret",
        message:
          "Worker request cannot expose ownership tokens, raw credentials, or completion authority fields.",
        category: "validation",
      }),
    );
  }

  issues.push(...workspaceIssues(request.workspace));
  issues.push(...permissionFactIssues(request.permissionFacts));

  return issues;
}

function invocationBindingIssues(input: {
  readonly request: TaskExecutionWorkerRequest;
  readonly record: TaskExecutionInvocationRecord;
}): readonly TaskExecutionWorkerIssue[] {
  const issues: TaskExecutionWorkerIssue[] = [];
  const request = input.request;
  const record = input.record;

  if (record.taskId !== request.taskId) {
    issues.push(
      issue({
        code: "task_execution_worker_task_binding_mismatch",
        message:
          "Worker request task id must match the exact AEOS invocation record.",
        category: "conflict",
      }),
    );
  }

  if (record.taskStateRevision !== request.sourceTaskRevision) {
    issues.push(
      issue({
        code: "task_execution_worker_revision_binding_mismatch",
        message:
          "Worker request task revision must match the exact AEOS invocation record.",
        category: "conflict",
      }),
    );
  }

  if (
    record.attemptId !== request.attemptId ||
    record.attemptNumber !== request.attemptNumber
  ) {
    issues.push(
      issue({
        code: "task_execution_worker_attempt_binding_mismatch",
        message:
          "Worker request attempt binding must match the exact AEOS invocation record.",
        category: "conflict",
      }),
    );
  }

  if (
    record.invocationId !== request.invocationId ||
    record.idempotencyKey !== request.idempotencyKey
  ) {
    issues.push(
      issue({
        code: "task_execution_worker_invocation_binding_mismatch",
        message:
          "Worker request invocation and idempotency binding must match AEOS authority.",
        category: "conflict",
      }),
    );
  }

  if (
    (record.workItemId ?? null) !== (request.workItemId ?? null) ||
    (record.batchId ?? null) !== (request.batchId ?? null)
  ) {
    issues.push(
      issue({
        code: "task_execution_worker_work_batch_binding_mismatch",
        message:
          "Worker request work-item and batch binding must match the exact AEOS invocation record.",
        category: "conflict",
      }),
    );
  }

  if (record.lifecycle !== "invoking") {
    issues.push(
      issue({
        code: "task_execution_worker_invocation_lifecycle_not_invoking",
        message:
          "Worker execution requires an AEOS invocation already transitioned to invoking.",
        category: "conflict",
      }),
    );
  }

  if (record.dependencyKind !== "test_noop") {
    issues.push(
      issue({
        code: "task_execution_worker_dependency_not_test_noop",
        message:
          "TASK-0312 worker runtime is TEST-only and cannot run non-test invocation dependencies.",
        category: "permission",
      }),
    );
  }

  return issues;
}

function permissionGateIssues(input: {
  readonly request: TaskExecutionWorkerRequest;
  readonly gate: TaskExecutionPermissionGateResult | undefined;
}): readonly TaskExecutionWorkerIssue[] {
  const gate = input.gate;
  const request = input.request;
  const issues: TaskExecutionWorkerIssue[] = [];

  if (request.permissionFacts.allowed !== true) {
    issues.push(
      issue({
        code: "task_execution_worker_permission_not_allowed",
        message:
          "Worker execution requires system permission facts that allow the exact invocation.",
        category: "permission",
      }),
    );
  }

  if (gate === undefined) {
    return issues;
  }

  if (
    gate.taskId !== request.taskId ||
    gate.sourceTaskRevision !== request.sourceTaskRevision ||
    gate.attemptId !== request.attemptId ||
    gate.invocationId !== request.invocationId ||
    gate.operation !== request.operationKind ||
    gate.workItemId !== (request.workItemId ?? null) ||
    gate.batchId !== (request.batchId ?? null) ||
    gate.policyGateId !== request.permissionFacts.permissionGateId ||
    gate.allowed !== request.permissionFacts.allowed ||
    gate.capabilitySatisfied !== request.permissionFacts.capabilitySatisfied ||
    gate.permissionsSatisfied !== request.permissionFacts.permissionsSatisfied ||
    gate.policyAuthorized !== request.permissionFacts.policyAuthorized
  ) {
    issues.push(
      issue({
        code: "task_execution_worker_permission_gate_binding_mismatch",
        message:
          "Worker permission facts must match the exact AEOS permission gate result.",
        category: "permission",
      }),
    );
  }

  return issues;
}

function capabilityIssues(
  capabilities: TaskExecutionWorkerCapabilities,
): readonly TaskExecutionWorkerIssue[] {
  const issues: TaskExecutionWorkerIssue[] = [];

  if (!capabilities.boundedDiagnostics) {
    issues.push(
      issue({
        code: "task_execution_worker_bounded_diagnostics_required",
        message:
          "Worker runtime requires bounded diagnostic result support.",
        category: "validation",
      }),
    );
  }

  if (!capabilities.deterministicTestResult) {
    issues.push(
      issue({
        code: "task_execution_worker_deterministic_test_result_required",
        message:
          "TASK-0312 executable worker runtime is limited to deterministic TEST workers.",
        category: "validation",
      }),
    );
  }

  for (const [field, code] of [
    ["repositoryWrite", "task_execution_worker_repository_write_capability_forbidden"],
    ["processExecution", "task_execution_worker_process_capability_forbidden"],
    ["shellExecution", "task_execution_worker_shell_capability_forbidden"],
  ] as const) {
    if (capabilities[field]) {
      issues.push(
        issue({
          code,
          message:
            "TASK-0312 TEST workers cannot claim write, process, or shell execution capabilities.",
          category: "permission",
        }),
      );
    }
  }

  return issues;
}

function normalizedFailure(
  rawResult: TaskExecutionWorkerRawResult | undefined,
  fallback: TaskExecutionWorkerFailure,
): TaskExecutionWorkerFailure {
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

function mismatchIssues(input: {
  readonly request: TaskExecutionWorkerRequest;
  readonly rawResult: TaskExecutionWorkerRawResult;
}): readonly TaskExecutionWorkerIssue[] {
  const issues: TaskExecutionWorkerIssue[] = [];
  const checks: readonly {
    readonly field: keyof TaskExecutionWorkerRawResult;
    readonly expected: string | number | undefined;
  }[] = [
    { field: "workerId", expected: input.request.workerIdentity.workerId },
    {
      field: "workerFamily",
      expected: input.request.workerIdentity.workerFamily,
    },
    { field: "runtimeKind", expected: input.request.workerIdentity.runtimeKind },
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
              ? "task_execution_worker_idempotency_mismatch"
              : "task_execution_worker_result_binding_mismatch",
          message:
            "Worker raw result did not match the authoritative worker request binding.",
          category: "validation",
        }),
      );
      break;
    }
  }

  return issues;
}

function baseResult(input: {
  readonly request: TaskExecutionWorkerRequest;
  readonly outcomeStatus: TaskExecutionWorkerOutcomeStatus;
  readonly invocationReturned?: boolean;
  readonly invocationOk?: boolean;
  readonly output?: JsonValue;
  readonly outputReference?: string;
  readonly patchArtifactReference?: string;
  readonly changedFileManifestReference?: string;
  readonly testSummaryReference?: string;
  readonly diagnosticCode?: string;
  readonly message?: string;
  readonly metadata?: JsonObject;
  readonly failure?: TaskExecutionWorkerFailure;
  readonly issues: readonly TaskExecutionWorkerIssue[];
}): TaskExecutionWorkerResult {
  return {
    ok:
      input.outcomeStatus === "returned" &&
      input.invocationOk === true &&
      input.issues.every((item) => item.severity !== "error"),
    invocationReturned: input.invocationReturned ?? false,
    invocationOk: input.invocationOk ?? false,
    outcomeStatus: input.outcomeStatus,
    workerIdentity: input.request.workerIdentity,
    taskId: input.request.taskId,
    sourceTaskRevision: input.request.sourceTaskRevision,
    attemptId: input.request.attemptId,
    attemptNumber: input.request.attemptNumber,
    invocationId: input.request.invocationId,
    idempotencyKey: input.request.idempotencyKey,
    workItemId: input.request.workItemId ?? null,
    batchId: input.request.batchId ?? null,
    output: input.output,
    outputReference: input.outputReference,
    patchArtifactReference: input.patchArtifactReference,
    changedFileManifestReference: input.changedFileManifestReference,
    testSummaryReference: input.testSummaryReference,
    diagnosticCode: input.diagnosticCode,
    message: input.message,
    metadata: input.metadata,
    failure: input.failure,
    issues: input.issues,
    safety: resultSafety,
  };
}

export function normalizeTaskExecutionWorkerResult(input: {
  readonly request: TaskExecutionWorkerRequest;
  readonly rawResult: unknown;
}): TaskExecutionWorkerResult {
  const issues: TaskExecutionWorkerIssue[] = [];
  const rawResult = rawResultFromUnknown(input.rawResult);

  if (rawResult === undefined) {
    issues.push(
      issue({
        code: "task_execution_worker_raw_result_invalid",
        message:
          "Worker raw result was invalid and was normalized to unavailable.",
        category: "validation",
      }),
    );

    return baseResult({
      request: input.request,
      outcomeStatus: "unavailable",
      failure: {
        code: "task_execution_worker_result_unavailable",
        category: "unavailable",
        message: "Worker result was unavailable.",
      },
      issues,
    });
  }

  issues.push(...mismatchIssues({ request: input.request, rawResult }));

  if (hasTrueKey(rawResult, forbiddenAuthorityKeys)) {
    issues.push(
      issue({
        code: "task_execution_worker_authority_claim_ignored",
        message:
          "Worker output contained completion, verification, approval, or retry authority claims; normalized output remains evidence only.",
        severity: "warning",
        category: "validation",
      }),
    );
  }

  if (hasForbiddenKey(rawResult)) {
    issues.push(
      issue({
        code: "task_execution_worker_forbidden_output_fields_stripped",
        message:
          "Worker output contained forbidden authority or credential fields; they were stripped from normalized output.",
        severity: "warning",
        category: "validation",
      }),
    );
  }

  if (issues.some((item) => item.severity === "error")) {
    return baseResult({
      request: input.request,
      outcomeStatus: "rejected",
      failure: normalizedFailure(rawResult, {
        code: "task_execution_worker_result_rejected",
        category: "invalid_request",
        message:
          "Worker result was rejected because it did not match AEOS invocation authority.",
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

  if (rawResult.status === "returned") {
    if (typeof rawResult.invocationOk !== "boolean") {
      issues.push(
        issue({
          code: "task_execution_worker_returned_invocation_ok_missing",
          message:
            "Worker returned result must include a typed invocationOk boolean.",
          category: "validation",
        }),
      );
    }

    return baseResult({
      request: input.request,
      outcomeStatus:
        typeof rawResult.invocationOk === "boolean" ? "returned" : "rejected",
      invocationReturned: typeof rawResult.invocationOk === "boolean",
      invocationOk: rawResult.invocationOk === true,
      output: boundedOutput,
      outputReference: safeText(rawResult.outputReference),
      patchArtifactReference: safeText(rawResult.patchArtifactReference),
      changedFileManifestReference: safeText(
        rawResult.changedFileManifestReference,
      ),
      testSummaryReference: safeText(rawResult.testSummaryReference),
      diagnosticCode: safeText(rawResult.diagnosticCode),
      message: safeText(rawResult.message),
      metadata: boundedMetadata,
      failure:
        typeof rawResult.invocationOk === "boolean"
          ? undefined
          : {
              code: "task_execution_worker_returned_invalid",
              category: "invalid_request",
              message: "Worker returned result was missing invocationOk.",
            },
      issues,
    });
  }

  if (rawResult.status === "in_progress") {
    return baseResult({
      request: input.request,
      outcomeStatus: "in_progress",
      outputReference: safeText(rawResult.outputReference),
      patchArtifactReference: safeText(rawResult.patchArtifactReference),
      changedFileManifestReference: safeText(
        rawResult.changedFileManifestReference,
      ),
      testSummaryReference: safeText(rawResult.testSummaryReference),
      diagnosticCode: safeText(rawResult.diagnosticCode),
      message: safeText(rawResult.message),
      metadata: boundedMetadata,
      issues,
    });
  }

  return baseResult({
    request: input.request,
    outcomeStatus: rawResult.status,
    outputReference: safeText(rawResult.outputReference),
    diagnosticCode: safeText(rawResult.diagnosticCode),
    message: safeText(rawResult.message),
    metadata: boundedMetadata,
    failure: normalizedFailure(rawResult, {
      code:
        rawResult.status === "unavailable"
          ? "task_execution_worker_unavailable"
          : "task_execution_worker_failed",
      category: rawResult.status === "unavailable" ? "unavailable" : "unknown",
      message:
        rawResult.status === "unavailable"
          ? "Worker status is unavailable."
          : "Worker reported a structured failure.",
    }),
    issues,
  });
}

function snapshotsChanged(input: {
  readonly before?: string;
  readonly after?: string;
}): boolean {
  return input.before !== undefined && input.after !== undefined && input.before !== input.after;
}

export async function evaluateTaskExecutionWorkerConformance(
  input: TaskExecutionWorkerConformanceInput,
): Promise<TaskExecutionWorkerConformanceResult> {
  const issues: TaskExecutionWorkerIssue[] = [
    ...requestIssues(input.request),
  ];
  const invocationResult = validateTaskExecutionInvocationRecord(
    input.invocationRecord,
  );

  if (!invocationResult.ok) {
    issues.push(
      issue({
        code: invocationResult.error.code,
        message:
          "Worker execution requires a valid authoritative AEOS invocation record.",
        category: invocationResult.error.category,
      }),
    );
  } else {
    issues.push(
      ...invocationBindingIssues({
        request: input.request,
        record: invocationResult.value,
      }),
    );
  }

  issues.push(
    ...permissionGateIssues({
      request: input.request,
      gate: input.permissionGateResult,
    }),
  );

  if (input.taskOrModelWorkerSelectionClaims !== undefined) {
    issues.push(
      issue({
        code: "task_execution_worker_task_model_selection_claims_ignored",
        message:
          "Task or model worker selection claims are ignored; worker identity is system-owned.",
        severity: "warning",
        category: "validation",
      }),
    );
  }

  if (input.taskOrModelCapabilityClaims !== undefined) {
    issues.push(
      issue({
        code: "task_execution_worker_task_model_capability_claims_ignored",
        message:
          "Task or model capability claims are ignored; worker capabilities are system-owned facts.",
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
    }) ||
    snapshotsChanged({
      before: input.workAccountingSnapshotBefore,
      after: input.workAccountingSnapshotAfter,
    })
  ) {
    issues.push(
      issue({
        code: "task_execution_worker_authoritative_state_mutation_detected",
        message:
          "Worker conformance detected mutation of supplied task, attempt, invocation, or work-accounting snapshots.",
        category: "conflict",
      }),
    );
  }

  const worker = workerFromUnknown(input.worker);

  if (worker === undefined) {
    return {
      ok: false,
      testWorkerConformant: false,
      runtimeExecutionEnabled: false,
      workerInvoked: false,
      workerIdentity: null,
      capabilities: null,
      request: input.request,
      normalizedResult: null,
      issues: [
        ...issues,
        issue({
          code: "task_execution_worker_invalid",
          message:
            "Worker must be an explicitly injected deterministic test_worker with system-owned identity and capabilities.",
          category: "validation",
        }),
      ],
      safety: resultSafety,
    };
  }

  if (worker.identity.workerId !== input.request.workerIdentity.workerId) {
    issues.push(
      issue({
        code: "task_execution_worker_request_identity_mismatch",
        message:
          "Worker request identity must match the injected worker identity.",
        category: "validation",
      }),
    );
  }

  issues.push(...capabilityIssues(worker.capabilities));

  if (
    input.expectedIdempotencyKey !== undefined &&
    input.request.idempotencyKey !== input.expectedIdempotencyKey
  ) {
    issues.push(
      issue({
        code: "task_execution_worker_request_idempotency_mismatch",
        message:
          "Worker request idempotency key does not match persisted AEOS invocation authority.",
        category: "validation",
      }),
    );
  }

  let workerInvoked = false;
  let rawResult: unknown;
  const requestBefore = JSON.stringify(input.request);

  if (!issues.some((item) => item.severity === "error")) {
    try {
      workerInvoked = true;
      rawResult = await worker.run(cloneRequest(input.request));
    } catch {
      rawResult = {
        status: "unavailable",
        failureCode: "task_execution_worker_threw",
        failureCategory: "worker_error",
        message: "Worker threw; raw error text is not authoritative.",
      };
    }
  }

  if (JSON.stringify(input.request) !== requestBefore) {
    issues.push(
      issue({
        code: "task_execution_worker_request_mutation_detected",
        message:
          "Worker conformance detected mutation of the worker request object.",
        category: "conflict",
      }),
    );
  }

  const normalizedResult =
    rawResult === undefined
      ? null
      : normalizeTaskExecutionWorkerResult({
          request: input.request,
          rawResult,
        });
  const combinedIssues = [
    ...issues,
    ...(normalizedResult?.issues ?? []),
  ];
  const errorFree = combinedIssues.every((item) => item.severity !== "error");
  const testWorkerConformant =
    errorFree &&
    worker.identity.runtimeKind === "test_worker" &&
    worker.capabilities.deterministicTestResult &&
    worker.capabilities.boundedDiagnostics &&
    normalizedResult !== null &&
    normalizedResult.outcomeStatus !== "rejected";

  return {
    ok: testWorkerConformant,
    testWorkerConformant,
    runtimeExecutionEnabled: false,
    workerInvoked,
    workerIdentity: worker.identity,
    capabilities: worker.capabilities,
    request: input.request,
    normalizedResult,
    issues: combinedIssues,
    safety: resultSafety,
  };
}
