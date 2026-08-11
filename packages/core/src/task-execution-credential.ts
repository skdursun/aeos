import type {
  AgenticExecutionAttemptId,
  AgenticTaskId,
} from "./agentic-lifecycle.js";
import type {
  TaskExecutionAdapterCredentialReference,
  TaskExecutionAdapterIdentity,
  TaskExecutionAdapterInvocationRequest,
  TaskExecutionAdapterOperationKind,
} from "./task-execution-adapter.js";
import {
  TASK_EXECUTION_ADAPTER_PRODUCTION_EXECUTION_ENABLED,
} from "./task-execution-adapter.js";
import type {
  TaskExecutionPermissionGateResult,
} from "./task-execution-permission-gate.js";
import type { AeosError } from "./types.js";

export type TaskExecutionCredentialReference =
  TaskExecutionAdapterCredentialReference;

export type TaskExecutionCredentialProviderKind =
  | "test_secret_provider"
  | "environment"
  | "keychain"
  | "vault"
  | "aws_secrets_manager"
  | "gcp_secret_manager"
  | "azure_key_vault"
  | "filesystem"
  | "generic_external";

export type TaskExecutionResolvedCredentialKind =
  | "opaque_secret"
  | "api_key"
  | "bearer_token";

export interface TaskExecutionCredentialProviderIdentity {
  readonly providerId: string;
  readonly kind: TaskExecutionCredentialProviderKind;
  readonly authority: "system";
}

export interface TaskExecutionCredentialResolutionRequest {
  readonly taskId: AgenticTaskId;
  readonly taskRevision: number;
  readonly attemptId: AgenticExecutionAttemptId;
  readonly invocationId: string;
  readonly adapterId: string;
  readonly adapterKind: TaskExecutionAdapterIdentity["adapterKind"];
  readonly operationKind: TaskExecutionAdapterOperationKind;
  readonly credentialRef: string;
  readonly credentialScope: readonly string[];
  readonly permissionGateId: string;
  readonly policyAuthorized: boolean;
}

export type TaskExecutionCredentialProviderResolution =
  | {
      readonly status: "resolved";
      readonly kind: TaskExecutionResolvedCredentialKind;
      readonly value: string;
      readonly expiresAt?: string;
      readonly scope?: readonly string[];
      readonly resolutionReference?: string;
    }
  | {
      readonly status: "missing" | "denied" | "error";
      readonly code?: string;
      readonly message?: string;
    };

export interface TaskExecutionCredentialProvider {
  readonly identity: TaskExecutionCredentialProviderIdentity;
  readonly resolve: (
    request: TaskExecutionCredentialResolutionRequest,
  ) =>
    | TaskExecutionCredentialProviderResolution
    | Promise<TaskExecutionCredentialProviderResolution>;
}

export interface TaskExecutionResolvedCredential {
  readonly kind: TaskExecutionResolvedCredentialKind;
  readonly value: string;
  readonly credentialRef: string;
  readonly providerId: string;
  readonly scope: readonly string[];
  readonly expiresAt?: string;
  readonly resolutionReference?: string;
}

export interface TaskExecutionCredentialIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: "error" | "warning";
  readonly category: AeosError["category"];
}

export interface TaskExecutionCredentialSafety {
  readonly productionExecutionEnabled: false;
  readonly productionProviderResolved: false;
  readonly productionAdapterInvoked: false;
  readonly externalSecretManagerCalled: false;
  readonly environmentRead: false;
  readonly filesystemRead: false;
  readonly networkCalled: false;
  readonly rawSecretPersisted: false;
  readonly rawSecretRendered: false;
  readonly taskModified: false;
  readonly attemptModified: false;
  readonly invocationModified: false;
  readonly auditWritten: false;
  readonly verifierRun: false;
  readonly policyRuntimeRun: false;
}

export interface TaskExecutionCredentialPublicResolutionResult {
  readonly ok: boolean;
  readonly resolved: boolean;
  readonly credentialRequired: boolean;
  readonly referenceValid: boolean;
  readonly permissionGateSatisfied: boolean;
  readonly providerAccepted: boolean;
  readonly credentialResolved: boolean;
  readonly scopeSatisfied: boolean;
  readonly secretExposed: false;
  readonly adapterInvoked: false;
  readonly productionExecutionEnabled: false;
  readonly taskId: AgenticTaskId | null;
  readonly taskRevision: number | null;
  readonly attemptId: AgenticExecutionAttemptId | null;
  readonly invocationId: string | null;
  readonly adapterId: string | null;
  readonly adapterKind: TaskExecutionAdapterIdentity["adapterKind"] | null;
  readonly operationKind: TaskExecutionAdapterOperationKind | null;
  readonly credentialRef: string | null;
  readonly providerId: string | null;
  readonly credentialScope: readonly string[];
  readonly expiresAt: string | null;
  readonly resolutionReference: string | null;
  readonly permissionGateId: string | null;
  readonly policyAuthorized: boolean;
  readonly issues: readonly TaskExecutionCredentialIssue[];
  readonly safety: TaskExecutionCredentialSafety;
}

export interface TaskExecutionCredentialResolutionResult
  extends TaskExecutionCredentialPublicResolutionResult {
  readonly resolvedCredential?: TaskExecutionResolvedCredential;
}

export interface ResolveTaskExecutionCredentialInput {
  readonly request: TaskExecutionAdapterInvocationRequest;
  readonly permissionGateResult: TaskExecutionPermissionGateResult;
  readonly credentialRequired: boolean;
  readonly provider?: TaskExecutionCredentialProvider;
  readonly credentialReference?: TaskExecutionCredentialReference;
  readonly requiredCredentialScope?: readonly string[];
  readonly now?: string;
  readonly taskOrModelCredentialClaims?: unknown;
  readonly operatorCredentialClaims?: unknown;
}

const safeIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/;

const forbiddenCredentialKeys = new Set<string>([
  "apikey",
  "token",
  "accesstoken",
  "refreshtoken",
  "secret",
  "password",
  "authorization",
  "bearer",
  "privatekey",
]);

const credentialSafety: TaskExecutionCredentialSafety = {
  productionExecutionEnabled: TASK_EXECUTION_ADAPTER_PRODUCTION_EXECUTION_ENABLED,
  productionProviderResolved: false,
  productionAdapterInvoked: false,
  externalSecretManagerCalled: false,
  environmentRead: false,
  filesystemRead: false,
  networkCalled: false,
  rawSecretPersisted: false,
  rawSecretRendered: false,
  taskModified: false,
  attemptModified: false,
  invocationModified: false,
  auditWritten: false,
  verifierRun: false,
  policyRuntimeRun: false,
};

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

function canonicalKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function containsForbiddenCredentialKey(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => containsForbiddenCredentialKey(item));
  }

  if (!isRecord(value)) {
    return false;
  }

  return Object.entries(value).some(
    ([key, item]) =>
      forbiddenCredentialKeys.has(canonicalKey(key)) ||
      containsForbiddenCredentialKey(item),
  );
}

function isStringScope(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 16 &&
    value.every((item) => isSafeId(item)) &&
    new Set(value).size === value.length
  );
}

function scopeContainsAll(input: {
  readonly available: readonly string[];
  readonly required: readonly string[];
}): boolean {
  const available = new Set(input.available);

  return input.required.every((scope) => available.has(scope));
}

function scopesEqual(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const leftSorted = [...left].sort();
  const rightSorted = [...right].sort();

  return leftSorted.every((item, index) => item === rightSorted[index]);
}

function issue(input: {
  readonly code: string;
  readonly message: string;
  readonly category: AeosError["category"];
  readonly severity?: "error" | "warning";
}): TaskExecutionCredentialIssue {
  return {
    code: input.code,
    message: input.message,
    category: input.category,
    severity: input.severity ?? "error",
  };
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

function referenceIssues(
  value: unknown,
): readonly TaskExecutionCredentialIssue[] {
  if (
    !isRecord(value) ||
    !isSafeId(value.credentialRef) ||
    (value.secretProviderRef !== undefined && !isSafeId(value.secretProviderRef)) ||
    !isStringScope(value.credentialScope) ||
    value.credentialAuthority !== "system" ||
    value.rawCredentialMaterialPresent !== false
  ) {
    return [
      issue({
        code: "task_execution_credential_reference_invalid",
        message:
          "Credential resolution requires a valid system-owned credential reference without raw credential material.",
        category: "validation",
      }),
    ];
  }

  if (containsForbiddenCredentialKey(value)) {
    return [
      issue({
        code: "task_execution_credential_reference_raw_material_rejected",
        message:
          "Credential reference contained forbidden raw credential-like fields and was rejected.",
        category: "validation",
      }),
    ];
  }

  return [];
}

function providerIdentityIssues(
  provider: TaskExecutionCredentialProvider | undefined,
  reference: TaskExecutionCredentialReference,
): readonly TaskExecutionCredentialIssue[] {
  if (provider === undefined) {
    return [
      issue({
        code: "task_execution_credential_provider_missing",
        message:
          "Credential resolution requires an injected system-owned TEST secret provider.",
        category: "not_found",
      }),
    ];
  }

  if (
    !isRecord(provider.identity) ||
    !isSafeId(provider.identity.providerId) ||
    provider.identity.authority !== "system"
  ) {
    return [
      issue({
        code: "task_execution_credential_provider_identity_invalid",
        message:
          "Credential provider identity must be system-owned safe metadata.",
        category: "validation",
      }),
    ];
  }

  if (provider.identity.kind !== "test_secret_provider") {
    return [
      issue({
        code: "task_execution_credential_provider_kind_rejected",
        message:
          "TASK-0300 permits only the injected TEST secret provider kind.",
        category: "permission",
      }),
    ];
  }

  if (
    reference.secretProviderRef !== undefined &&
    reference.secretProviderRef !== provider.identity.providerId
  ) {
    return [
      issue({
        code: "task_execution_credential_provider_reference_mismatch",
        message:
          "Credential reference provider id must match the injected system-owned TEST provider.",
        category: "permission",
      }),
    ];
  }

  return [];
}

function gateIssues(input: {
  readonly request: TaskExecutionAdapterInvocationRequest;
  readonly gate: TaskExecutionPermissionGateResult;
}): readonly TaskExecutionCredentialIssue[] {
  const issues: TaskExecutionCredentialIssue[] = [];

  if (!input.gate.allowed) {
    issues.push(
      issue({
        code: "task_execution_credential_permission_gate_not_satisfied",
        message:
          "Credential resolution is blocked until the permission/policy gate allows the invocation.",
        category: "permission",
      }),
    );
  }

  if (
    input.gate.taskId !== input.request.taskId ||
    input.gate.sourceTaskRevision !== input.request.sourceTaskRevision ||
    input.gate.attemptId !== input.request.attemptId ||
    input.gate.invocationId !== input.request.invocationId ||
    input.gate.adapterId !== input.request.adapterIdentity.adapterId ||
    input.gate.operation !== input.request.operationKind
  ) {
    issues.push(
      issue({
        code: "task_execution_credential_permission_gate_binding_mismatch",
        message:
          "Permission gate result does not match the exact invocation credential resolution binding.",
        category: "permission",
      }),
    );
  }

  return issues;
}

function requestBindingIssues(
  request: TaskExecutionAdapterInvocationRequest,
): readonly TaskExecutionCredentialIssue[] {
  if (
    !isSafeId(request.taskId) ||
    !isPositiveInteger(request.sourceTaskRevision) ||
    !isSafeId(request.attemptId) ||
    !isSafeId(request.invocationId) ||
    !isSafeId(request.adapterIdentity.adapterId) ||
    request.adapterIdentity.adapterKind !== "test_execution" ||
    request.adapterIdentity.identityAuthority !== "system"
  ) {
    return [
      issue({
        code: "task_execution_credential_resolution_binding_invalid",
        message:
          "Credential resolution request must be bound to authoritative system invocation context.",
        category: "validation",
      }),
    ];
  }

  return [];
}

function providerResolutionIssues(
  value: TaskExecutionCredentialProviderResolution,
): readonly TaskExecutionCredentialIssue[] {
  if (!isRecord(value) || typeof value.status !== "string") {
    return [
      issue({
        code: "task_execution_credential_provider_result_invalid",
        message:
          "Credential provider returned an invalid resolution result.",
        category: "validation",
      }),
    ];
  }

  if (value.status === "missing") {
    return [
      issue({
        code: "task_execution_credential_missing",
        message:
          "Required credential was not found by the TEST secret provider.",
        category: "not_found",
      }),
    ];
  }

  if (value.status === "denied") {
    return [
      issue({
        code: "task_execution_credential_denied",
        message:
          "Required credential resolution was denied by the TEST secret provider.",
        category: "permission",
      }),
    ];
  }

  if (value.status === "error") {
    return [
      issue({
        code: safeText(value.code) ?? "task_execution_credential_provider_error",
        message:
          safeText(value.message) ??
          "TEST secret provider reported a sanitized credential resolution error.",
        category: "unknown",
      }),
    ];
  }

  if (
    value.status !== "resolved" ||
    !["opaque_secret", "api_key", "bearer_token"].includes(value.kind) ||
    typeof value.value !== "string" ||
    value.value.length === 0 ||
    (value.expiresAt !== undefined && safeText(value.expiresAt) === undefined) ||
    (value.resolutionReference !== undefined &&
      !isSafeId(value.resolutionReference)) ||
    (value.scope !== undefined && !isStringScope(value.scope))
  ) {
    return [
      issue({
        code: "task_execution_credential_provider_result_invalid",
        message:
          "Credential provider resolved result must be bounded TEST credential metadata plus an ephemeral value.",
        category: "validation",
      }),
    ];
  }

  return [];
}

function expired(input: {
  readonly expiresAt?: string;
  readonly now?: string;
}): boolean {
  if (input.expiresAt === undefined || input.now === undefined) {
    return false;
  }

  const expiresAtMs = Date.parse(input.expiresAt);
  const nowMs = Date.parse(input.now);

  return Number.isFinite(expiresAtMs) && Number.isFinite(nowMs)
    ? expiresAtMs <= nowMs
    : input.expiresAt <= input.now;
}

function createResolvedCredential(input: {
  readonly providerId: string;
  readonly reference: TaskExecutionCredentialReference;
  readonly providerResult: Extract<
    TaskExecutionCredentialProviderResolution,
    { readonly status: "resolved" }
  >;
}): TaskExecutionResolvedCredential {
  const credential = {
    kind: input.providerResult.kind,
    credentialRef: input.reference.credentialRef,
    providerId: input.providerId,
    scope: input.reference.credentialScope,
    expiresAt: input.providerResult.expiresAt,
    resolutionReference: input.providerResult.resolutionReference,
  } as TaskExecutionResolvedCredential;

  Object.defineProperty(credential, "value", {
    value: input.providerResult.value,
    enumerable: false,
  });

  return credential;
}

function baseResult(input: {
  readonly request?: TaskExecutionAdapterInvocationRequest;
  readonly credentialRequired: boolean;
  readonly reference?: TaskExecutionCredentialReference;
  readonly providerId?: string | null;
  readonly expiresAt?: string | null;
  readonly resolutionReference?: string | null;
  readonly permissionGateId?: string | null;
  readonly policyAuthorized?: boolean;
  readonly referenceValid: boolean;
  readonly permissionGateSatisfied: boolean;
  readonly providerAccepted: boolean;
  readonly credentialResolved: boolean;
  readonly scopeSatisfied: boolean;
  readonly issues: readonly TaskExecutionCredentialIssue[];
  readonly resolvedCredential?: TaskExecutionResolvedCredential;
}): TaskExecutionCredentialResolutionResult {
  const result = {
    ok:
      input.issues.every((item) => item.severity !== "error") &&
      (!input.credentialRequired || input.credentialResolved),
    resolved: input.credentialResolved,
    credentialRequired: input.credentialRequired,
    referenceValid: input.referenceValid,
    permissionGateSatisfied: input.permissionGateSatisfied,
    providerAccepted: input.providerAccepted,
    credentialResolved: input.credentialResolved,
    scopeSatisfied: input.scopeSatisfied,
    secretExposed: false,
    adapterInvoked: false,
    productionExecutionEnabled: TASK_EXECUTION_ADAPTER_PRODUCTION_EXECUTION_ENABLED,
    taskId: input.request?.taskId ?? null,
    taskRevision: input.request?.sourceTaskRevision ?? null,
    attemptId: input.request?.attemptId ?? null,
    invocationId: input.request?.invocationId ?? null,
    adapterId: input.request?.adapterIdentity.adapterId ?? null,
    adapterKind: input.request?.adapterIdentity.adapterKind ?? null,
    operationKind: input.request?.operationKind ?? null,
    credentialRef: input.reference?.credentialRef ?? null,
    providerId: input.providerId ?? input.reference?.secretProviderRef ?? null,
    credentialScope: input.reference?.credentialScope ?? [],
    expiresAt: input.expiresAt ?? null,
    resolutionReference: input.resolutionReference ?? null,
    permissionGateId: input.permissionGateId ?? null,
    policyAuthorized: input.policyAuthorized ?? false,
    issues: input.issues,
    safety: credentialSafety,
  } satisfies TaskExecutionCredentialResolutionResult;

  if (input.resolvedCredential !== undefined) {
    Object.defineProperty(result, "resolvedCredential", {
      value: input.resolvedCredential,
      enumerable: false,
    });
  }

  return result;
}

export function sanitizeTaskExecutionCredentialResult(
  result: TaskExecutionCredentialResolutionResult,
): TaskExecutionCredentialPublicResolutionResult {
  return {
    ok: result.ok,
    resolved: result.resolved,
    credentialRequired: result.credentialRequired,
    referenceValid: result.referenceValid,
    permissionGateSatisfied: result.permissionGateSatisfied,
    providerAccepted: result.providerAccepted,
    credentialResolved: result.credentialResolved,
    scopeSatisfied: result.scopeSatisfied,
    secretExposed: false,
    adapterInvoked: false,
    productionExecutionEnabled: result.productionExecutionEnabled,
    taskId: result.taskId,
    taskRevision: result.taskRevision,
    attemptId: result.attemptId,
    invocationId: result.invocationId,
    adapterId: result.adapterId,
    adapterKind: result.adapterKind,
    operationKind: result.operationKind,
    credentialRef: result.credentialRef,
    providerId: result.providerId,
    credentialScope: result.credentialScope,
    expiresAt: result.expiresAt,
    resolutionReference: result.resolutionReference,
    permissionGateId: result.permissionGateId,
    policyAuthorized: result.policyAuthorized,
    issues: result.issues,
    safety: result.safety,
  };
}

export async function resolveTaskExecutionCredential(
  input: ResolveTaskExecutionCredentialInput,
): Promise<TaskExecutionCredentialResolutionResult> {
  const issues: TaskExecutionCredentialIssue[] = [
    ...requestBindingIssues(input.request),
    ...gateIssues({
      request: input.request,
      gate: input.permissionGateResult,
    }),
  ];
  const credentialReference =
    input.credentialReference ?? input.request.credentialReference;

  if (input.taskOrModelCredentialClaims !== undefined) {
    issues.push(
      issue({
        code: "task_execution_credential_task_model_claims_ignored",
        message:
          "Task or model credential prose is ignored by credential resolution.",
        severity: "warning",
        category: "validation",
      }),
    );
  }

  if (input.operatorCredentialClaims !== undefined) {
    issues.push(
      issue({
        code: "task_execution_credential_operator_raw_claims_ignored",
        message:
          "Operator-provided raw credential claims are ignored by credential resolution.",
        severity: "warning",
        category: "validation",
      }),
    );
  }

  if (!input.credentialRequired && credentialReference === undefined) {
    return baseResult({
      request: input.request,
      credentialRequired: false,
      referenceValid: true,
      permissionGateSatisfied: issues.every((item) => item.severity !== "error"),
      providerAccepted: false,
      credentialResolved: false,
      scopeSatisfied: true,
      permissionGateId: input.permissionGateResult.policyGateId,
      policyAuthorized: input.permissionGateResult.policyAuthorized,
      issues,
    });
  }

  if (credentialReference === undefined) {
    issues.push(
      issue({
        code: "task_execution_credential_reference_missing",
        message:
          "Credential is required, but no system-owned credential reference is present.",
        category: "permission",
      }),
    );

    return baseResult({
      request: input.request,
      credentialRequired: input.credentialRequired,
      referenceValid: false,
      permissionGateSatisfied: false,
      providerAccepted: false,
      credentialResolved: false,
      scopeSatisfied: false,
      permissionGateId: input.permissionGateResult.policyGateId,
      policyAuthorized: input.permissionGateResult.policyAuthorized,
      issues,
    });
  }

  const refIssues = referenceIssues(credentialReference);
  issues.push(...refIssues);
  const referenceValid = refIssues.every((item) => item.severity !== "error");
  const gateSatisfied = !issues.some(
    (item) =>
      item.severity === "error" &&
      [
        "task_execution_credential_permission_gate_not_satisfied",
        "task_execution_credential_permission_gate_binding_mismatch",
        "task_execution_credential_resolution_binding_invalid",
      ].includes(item.code),
  );
  const requiredScope =
    input.requiredCredentialScope ?? credentialReference.credentialScope;
  const scopeSatisfied =
    isStringScope(requiredScope) &&
    scopeContainsAll({
      available: credentialReference.credentialScope,
      required: requiredScope,
    });

  if (!scopeSatisfied) {
    issues.push(
      issue({
        code: "task_execution_credential_scope_mismatch",
        message:
          "Credential reference scope does not satisfy the system-required adapter operation scope.",
        category: "permission",
      }),
    );
  }

  if (!referenceValid || !gateSatisfied || !scopeSatisfied) {
    return baseResult({
      request: input.request,
      credentialRequired: input.credentialRequired,
      reference: credentialReference,
      referenceValid,
      permissionGateSatisfied: gateSatisfied,
      providerAccepted: false,
      credentialResolved: false,
      scopeSatisfied,
      permissionGateId: input.permissionGateResult.policyGateId,
      policyAuthorized: input.permissionGateResult.policyAuthorized,
      issues,
    });
  }

  const providerIssues = providerIdentityIssues(input.provider, credentialReference);
  issues.push(...providerIssues);

  if (providerIssues.some((item) => item.severity === "error")) {
    return baseResult({
      request: input.request,
      credentialRequired: input.credentialRequired,
      reference: credentialReference,
      providerId: input.provider?.identity.providerId,
      referenceValid,
      permissionGateSatisfied: gateSatisfied,
      providerAccepted: false,
      credentialResolved: false,
      scopeSatisfied,
      permissionGateId: input.permissionGateResult.policyGateId,
      policyAuthorized: input.permissionGateResult.policyAuthorized,
      issues,
    });
  }

  const provider = input.provider!;
  let providerResult: TaskExecutionCredentialProviderResolution;
  const resolutionRequest: TaskExecutionCredentialResolutionRequest = {
    taskId: input.request.taskId,
    taskRevision: input.request.sourceTaskRevision,
    attemptId: input.request.attemptId,
    invocationId: input.request.invocationId,
    adapterId: input.request.adapterIdentity.adapterId,
    adapterKind: input.request.adapterIdentity.adapterKind,
    operationKind: input.request.operationKind,
    credentialRef: credentialReference.credentialRef,
    credentialScope: credentialReference.credentialScope,
    permissionGateId: input.permissionGateResult.policyGateId,
    policyAuthorized: input.permissionGateResult.policyAuthorized,
  };

  try {
    providerResult = await provider.resolve(resolutionRequest);
  } catch {
    providerResult = {
      status: "error",
      code: "task_execution_credential_provider_threw",
      message:
        "TEST secret provider threw; raw provider error text is not authoritative.",
    };
  }

  const resultIssues = providerResolutionIssues(providerResult);
  issues.push(...resultIssues);

  if (providerResult.status !== "resolved" || resultIssues.length > 0) {
    return baseResult({
      request: input.request,
      credentialRequired: input.credentialRequired,
      reference: credentialReference,
      providerId: provider.identity.providerId,
      referenceValid,
      permissionGateSatisfied: gateSatisfied,
      providerAccepted: true,
      credentialResolved: false,
      scopeSatisfied,
      permissionGateId: input.permissionGateResult.policyGateId,
      policyAuthorized: input.permissionGateResult.policyAuthorized,
      issues,
    });
  }

  if (
    providerResult.scope !== undefined &&
    !scopesEqual(providerResult.scope, credentialReference.credentialScope)
  ) {
    issues.push(
      issue({
        code: "task_execution_credential_provider_scope_expansion_rejected",
        message:
          "TEST provider resolved scope must not expand or override the system credential reference scope.",
        category: "permission",
      }),
    );
  }

  if (
    expired({
      expiresAt: providerResult.expiresAt,
      now: input.now,
    })
  ) {
    issues.push(
      issue({
        code: "task_execution_credential_expired",
        message:
          "Resolved TEST credential expired before adapter invocation.",
        category: "permission",
      }),
    );
  }

  if (issues.some((item) => item.severity === "error")) {
    return baseResult({
      request: input.request,
      credentialRequired: input.credentialRequired,
      reference: credentialReference,
      providerId: provider.identity.providerId,
      expiresAt: providerResult.expiresAt ?? null,
      resolutionReference: providerResult.resolutionReference ?? null,
      referenceValid,
      permissionGateSatisfied: gateSatisfied,
      providerAccepted: true,
      credentialResolved: false,
      scopeSatisfied,
      permissionGateId: input.permissionGateResult.policyGateId,
      policyAuthorized: input.permissionGateResult.policyAuthorized,
      issues,
    });
  }

  const resolvedCredential = createResolvedCredential({
    providerId: provider.identity.providerId,
    reference: credentialReference,
    providerResult,
  });

  return baseResult({
    request: input.request,
    credentialRequired: input.credentialRequired,
    reference: credentialReference,
    providerId: provider.identity.providerId,
    expiresAt: providerResult.expiresAt ?? null,
    resolutionReference: providerResult.resolutionReference ?? null,
    referenceValid,
    permissionGateSatisfied: gateSatisfied,
    providerAccepted: true,
    credentialResolved: true,
    scopeSatisfied,
    permissionGateId: input.permissionGateResult.policyGateId,
    policyAuthorized: input.permissionGateResult.policyAuthorized,
    issues,
    resolvedCredential,
  });
}
