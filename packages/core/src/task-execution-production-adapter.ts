import type {
  AgenticExecutionAttemptId,
  AgenticTaskId,
  AgenticWorkBatchId,
  AgenticWorkItemId,
} from "./agentic-lifecycle.js";
import type {
  TaskExecutionAdapterCapabilities,
  TaskExecutionAdapterCredentialReference,
  TaskExecutionAdapterFailureCategory,
  TaskExecutionAdapterIdentity,
  TaskExecutionAdapterInvocationRequest,
  TaskExecutionAdapterOperationKind,
  TaskExecutionAdapterPermissions,
} from "./task-execution-adapter.js";
import {
  TASK_EXECUTION_ADAPTER_PRODUCTION_EXECUTION_ENABLED,
} from "./task-execution-adapter.js";
import type {
  TaskExecutionCredentialResolutionResult,
  TaskExecutionResolvedCredential,
} from "./task-execution-credential.js";
import type {
  TaskExecutionInvocationProviderReconciliationCapabilities,
} from "./task-execution-invocation-reconciliation.js";
import type {
  TaskExecutionInvocationRecord,
} from "./task-execution-invocation-record.js";
import {
  validateTaskExecutionInvocationRecord,
} from "./task-execution-invocation-record.js";
import type {
  TaskExecutionAuditEvent,
} from "./task-execution-audit.js";
import {
  isTaskExecutionAuditEvent,
} from "./task-execution-audit.js";
import type {
  TaskExecutionPermissionGateResult,
} from "./task-execution-permission-gate.js";
import type { AeosError, JsonValue } from "./types.js";

export interface TaskExecutionProductionAdapterIdentity
  extends TaskExecutionAdapterIdentity {
  readonly adapterKind: "production_execution";
}

export interface TaskExecutionProductionAdapterProviderReference {
  readonly providerRef: string;
  readonly providerFamilyRef?: string;
  readonly operationClass: string;
  readonly authority: "system";
}

export interface TaskExecutionProductionAdapterCapabilities
  extends TaskExecutionAdapterCapabilities {
  readonly supportsFailureNormalization: true;
}

export interface TaskExecutionProductionAdapterConfiguration {
  readonly identity: TaskExecutionProductionAdapterIdentity;
  readonly configurationAuthority: "system";
  readonly configurationVersion: string;
  readonly provider: TaskExecutionProductionAdapterProviderReference;
  readonly operationKind: "execute_task_attempt";
  readonly capabilities: TaskExecutionProductionAdapterCapabilities;
  readonly permissions: TaskExecutionAdapterPermissions;
  readonly credentialRequired: boolean;
  readonly credentialReference?: TaskExecutionAdapterCredentialReference;
  readonly auditRequired: boolean;
  readonly policyRequired: boolean;
  readonly reconciliation: TaskExecutionInvocationProviderReconciliationCapabilities;
  readonly failureNormalization: {
    readonly authority: "system";
    readonly categories: readonly TaskExecutionAdapterFailureCategory[];
  };
}

export interface TaskExecutionProductionProviderContractMethod {
  readonly name:
    | "lookupByIdempotencyKey"
    | "getInvocationStatus"
    | "replayResult";
  readonly status: "contract_only";
  readonly providerIoImplemented: false;
}

export interface TaskExecutionProductionNormalizedRequest {
  readonly input?: JsonValue;
  readonly inputReference?: string;
  readonly payloadAuthority: "aeos_invocation_request";
}

export interface TaskExecutionProductionDispatchRequest {
  readonly configuration: unknown;
  readonly request: TaskExecutionAdapterInvocationRequest;
  readonly invocationRecord: unknown;
  readonly permissionGateResult: TaskExecutionPermissionGateResult;
  readonly credentialResolutionResult?: TaskExecutionCredentialResolutionResult;
  readonly preDispatchAuditEvent?: unknown;
  readonly taskOrModelDispatchClaims?: unknown;
  readonly taskOrModelConfigurationClaims?: unknown;
  readonly forbiddenCredentialValues?: readonly string[];
}

export interface TaskExecutionProductionPreparedDispatch {
  readonly taskId: AgenticTaskId;
  readonly sourceTaskRevision: number;
  readonly attemptId: AgenticExecutionAttemptId;
  readonly attemptNumber: number;
  readonly invocationId: string;
  readonly idempotencyKey: string;
  readonly adapterId: string;
  readonly adapterIdentity: TaskExecutionProductionAdapterIdentity;
  readonly implementationVersion: string;
  readonly capabilityVersion: string;
  readonly provider: TaskExecutionProductionAdapterProviderReference;
  readonly operationKind: TaskExecutionAdapterOperationKind;
  readonly workItemId: AgenticWorkItemId | null;
  readonly batchId: AgenticWorkBatchId | null;
  readonly credentialRef: string | null;
  readonly credentialScope: readonly string[];
  readonly credentialResolutionReference: string | null;
  readonly policyGateId: string | null;
  readonly policyDecisionReference: string | null;
  readonly auditEventId: string | null;
  readonly auditSequence: number | null;
  readonly normalizedRequest: TaskExecutionProductionNormalizedRequest;
  readonly reconciliationCapabilities: TaskExecutionInvocationProviderReconciliationCapabilities;
  readonly providerContracts: readonly TaskExecutionProductionProviderContractMethod[];
  readonly productionExecutionEnabled: false;
  readonly safety: TaskExecutionProductionDispatchSafety;
}

export interface TaskExecutionProductionDispatchSafety {
  readonly productionExecutionEnabled: false;
  readonly productionAdapterInvoked: false;
  readonly providerCalled: false;
  readonly networkCalled: false;
  readonly filesystemTouched: false;
  readonly subprocessExecuted: false;
  readonly shellExecuted: false;
  readonly modelInvoked: false;
  readonly toolCallsExecuted: false;
  readonly taskStateModified: false;
  readonly attemptStateModified: false;
  readonly invocationStateModified: false;
  readonly workCompleted: false;
  readonly taskCompleted: false;
  readonly verifierRun: false;
  readonly rawSecretSerialized: false;
  readonly rawProviderOutputAuthoritative: false;
}

export interface TaskExecutionProductionAdapterIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: "error" | "warning" | "info";
  readonly category: AeosError["category"];
}

export interface TaskExecutionProductionAdapterReadiness {
  readonly ok: boolean;
  readonly ProductionAdapterVerticalSliceReady: boolean;
  readonly ProductionDispatchPrepared: boolean;
  readonly ProductionExecutionEnabled: false;
  readonly contractConformant: boolean;
  readonly credentialBoundaryReady: boolean;
  readonly permissionGateReady: boolean;
  readonly policyProofReady: boolean;
  readonly auditBoundaryReady: boolean;
  readonly reconciliationCapabilitiesReady: boolean;
  readonly idempotencyReady: boolean;
  readonly productionDispatchContractReady: boolean;
  readonly productionExecutionEnabled: false;
  readonly remainingDispatchBlockers: readonly string[];
  readonly issues: readonly TaskExecutionProductionAdapterIssue[];
}

export interface TaskExecutionProductionDispatchResult
  extends TaskExecutionProductionAdapterReadiness {
  readonly preparedDispatch: TaskExecutionProductionPreparedDispatch | null;
}

const safeIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/;
const configurationKeys = new Set<string>([
  "identity",
  "configurationAuthority",
  "configurationVersion",
  "provider",
  "operationKind",
  "capabilities",
  "permissions",
  "credentialRequired",
  "credentialReference",
  "auditRequired",
  "policyRequired",
  "reconciliation",
  "failureNormalization",
]);
const providerKeys = new Set<string>([
  "providerRef",
  "providerFamilyRef",
  "operationClass",
  "authority",
]);
const requiredFailureCategories = new Set<TaskExecutionAdapterFailureCategory>([
  "unavailable",
  "timeout",
  "rejected",
  "invalid_request",
  "provider_error",
  "unknown",
]);
const authorityOverrideKeys = new Set<string>([
  "idempotencykey",
  "adapterid",
  "provider",
  "providerref",
  "credentialref",
  "endpoint",
  "url",
  "productionexecutionenabled",
  "policyauthorized",
  "ownershiptoken",
  "locktoken",
  "capabilitysecret",
]);
const secretKeys = new Set<string>([
  "apikey",
  "accesskey",
  "accesstoken",
  "refreshtoken",
  "token",
  "secret",
  "password",
  "authorization",
  "privatekey",
  "rawcredential",
]);

const dispatchSafety: TaskExecutionProductionDispatchSafety = {
  productionExecutionEnabled: TASK_EXECUTION_ADAPTER_PRODUCTION_EXECUTION_ENABLED,
  productionAdapterInvoked: false,
  providerCalled: false,
  networkCalled: false,
  filesystemTouched: false,
  subprocessExecuted: false,
  shellExecuted: false,
  modelInvoked: false,
  toolCallsExecuted: false,
  taskStateModified: false,
  attemptStateModified: false,
  invocationStateModified: false,
  workCompleted: false,
  taskCompleted: false,
  verifierRun: false,
  rawSecretSerialized: false,
  rawProviderOutputAuthoritative: false,
};

const providerContracts: readonly TaskExecutionProductionProviderContractMethod[] = [
  {
    name: "lookupByIdempotencyKey",
    status: "contract_only",
    providerIoImplemented: false,
  },
  {
    name: "getInvocationStatus",
    status: "contract_only",
    providerIoImplemented: false,
  },
  {
    name: "replayResult",
    status: "contract_only",
    providerIoImplemented: false,
  },
];

function issue(input: {
  readonly code: string;
  readonly message: string;
  readonly category: AeosError["category"];
  readonly severity?: "error" | "warning" | "info";
}): TaskExecutionProductionAdapterIssue {
  return {
    code: input.code,
    message: input.message,
    category: input.category,
    severity: input.severity ?? "error",
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

function canonicalKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function containsForbiddenKey(input: {
  readonly value: unknown;
  readonly keys: ReadonlySet<string>;
}): boolean {
  if (Array.isArray(input.value)) {
    return input.value.some((item) =>
      containsForbiddenKey({ value: item, keys: input.keys }),
    );
  }

  if (!isRecord(input.value)) {
    return false;
  }

  return Object.entries(input.value).some(
    ([key, item]) =>
      input.keys.has(canonicalKey(key)) ||
      containsForbiddenKey({ value: item, keys: input.keys }),
  );
}

function containsForbiddenValue(input: {
  readonly value: unknown;
  readonly forbiddenValues: readonly string[];
}): boolean {
  const value = input.value;
  const forbiddenValues = input.forbiddenValues.filter((item) => item.length > 0);

  if (forbiddenValues.length === 0) {
    return false;
  }

  if (typeof value === "string") {
    return forbiddenValues.some((item) => value.includes(item));
  }

  if (Array.isArray(value)) {
    return value.some((item) =>
      containsForbiddenValue({ value: item, forbiddenValues }),
    );
  }

  if (!isRecord(value)) {
    return false;
  }

  return Object.values(value).some((item) =>
    containsForbiddenValue({ value: item, forbiddenValues }),
  );
}

function isJsonValue(value: unknown, depth = 0): value is JsonValue {
  if (depth > 8) {
    return false;
  }

  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.every((item) => isJsonValue(item, depth + 1));
  }

  if (isRecord(value)) {
    return Object.values(value).every((item) => isJsonValue(item, depth + 1));
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
    const normalizedKey = canonicalKey(key);

    if (
      authorityOverrideKeys.has(normalizedKey) ||
      secretKeys.has(normalizedKey)
    ) {
      continue;
    }

    const sanitizedItem = sanitizeJsonValue(item, depth + 1);

    if (sanitizedItem !== undefined) {
      sanitized[key] = sanitizedItem;
    }
  }

  return sanitized;
}

function jsonWithinLimit(value: JsonValue): boolean {
  return JSON.stringify(value).length <= 4096;
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

function credentialReferenceValid(
  value: unknown,
): value is TaskExecutionAdapterCredentialReference {
  return (
    isRecord(value) &&
    isSafeId(value.credentialRef) &&
    (value.secretProviderRef === undefined ||
      isSafeId(value.secretProviderRef)) &&
    isStringScope(value.credentialScope) &&
    value.credentialAuthority === "system" &&
    value.rawCredentialMaterialPresent === false &&
    !containsForbiddenKey({ value, keys: secretKeys })
  );
}

function capabilitiesValid(
  value: unknown,
): value is TaskExecutionProductionAdapterCapabilities {
  if (!isRecord(value)) {
    return false;
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
      return false;
    }
  }

  return value.supportsFailureNormalization === true;
}

function permissionsValid(value: unknown): value is TaskExecutionAdapterPermissions {
  if (
    !isRecord(value) ||
    value.permissionAuthority !== "system" ||
    typeof value.policyRequired !== "boolean" ||
    value.policyAuthorized !== false
  ) {
    return false;
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
      return false;
    }
  }

  return true;
}

function reconciliationValid(
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

function configurationFromUnknown(
  value: unknown,
): TaskExecutionProductionAdapterConfiguration | undefined {
  const failureNormalization = isRecord(value)
    ? value.failureNormalization
    : undefined;
  const failureCategories = isRecord(failureNormalization)
    ? failureNormalization.categories
    : undefined;

  if (
    !isRecord(value) ||
    !Object.keys(value).every((key) => configurationKeys.has(key)) ||
    value.configurationAuthority !== "system" ||
    !isSafeId(value.configurationVersion) ||
    value.operationKind !== "execute_task_attempt" ||
    typeof value.credentialRequired !== "boolean" ||
    typeof value.auditRequired !== "boolean" ||
    typeof value.policyRequired !== "boolean" ||
    !isRecord(value.identity) ||
    !isSafeId(value.identity.adapterId) ||
    value.identity.adapterKind !== "production_execution" ||
    !isSafeId(value.identity.implementationVersion) ||
    !isSafeId(value.identity.capabilityVersion) ||
    value.identity.identityAuthority !== "system" ||
    !isRecord(value.provider) ||
    !Object.keys(value.provider).every((key) => providerKeys.has(key)) ||
    !isSafeId(value.provider.providerRef) ||
    (value.provider.providerFamilyRef !== undefined &&
      !isSafeId(value.provider.providerFamilyRef)) ||
    !isSafeId(value.provider.operationClass) ||
    value.provider.authority !== "system" ||
    !capabilitiesValid(value.capabilities) ||
    !permissionsValid(value.permissions) ||
    !reconciliationValid(value.reconciliation) ||
    (value.credentialReference !== undefined &&
      !credentialReferenceValid(value.credentialReference)) ||
    !isRecord(failureNormalization) ||
    failureNormalization.authority !== "system" ||
    !Array.isArray(failureCategories) ||
    ![...requiredFailureCategories].every((category) =>
      failureCategories.includes(category),
    ) ||
    containsForbiddenKey({ value, keys: secretKeys })
  ) {
    return undefined;
  }

  return value as unknown as TaskExecutionProductionAdapterConfiguration;
}

function requiredCapabilityIssues(
  capabilities: TaskExecutionProductionAdapterCapabilities,
): readonly TaskExecutionProductionAdapterIssue[] {
  const issues: TaskExecutionProductionAdapterIssue[] = [];

  for (const [field, code] of [
    ["supportsIdempotencyKey", "task_execution_production_adapter_idempotency_missing"],
    [
      "supportsLookupByIdempotencyKey",
      "task_execution_production_adapter_lookup_missing",
    ],
    [
      "supportsInvocationStatusQuery",
      "task_execution_production_adapter_status_query_missing",
    ],
    ["supportsResultReplay", "task_execution_production_adapter_replay_missing"],
    [
      "providesDeterministicProviderInvocationReference",
      "task_execution_production_adapter_provider_reference_missing",
    ],
    ["supportsBoundedErrors", "task_execution_production_adapter_bounded_errors_missing"],
    [
      "supportsFailureNormalization",
      "task_execution_production_adapter_failure_normalization_missing",
    ],
  ] as const) {
    if (capabilities[field] !== true) {
      issues.push(
        issue({
          code,
          message:
            "Production adapter candidate is missing a required system-owned capability.",
          category: "validation",
        }),
      );
    }
  }

  return issues;
}

function readiness(input: {
  readonly configuration?: TaskExecutionProductionAdapterConfiguration;
  readonly issues: readonly TaskExecutionProductionAdapterIssue[];
  readonly request?: TaskExecutionAdapterInvocationRequest;
  readonly gate?: TaskExecutionPermissionGateResult;
  readonly credential?: TaskExecutionCredentialResolutionResult;
  readonly auditEvent?: TaskExecutionAuditEvent;
  readonly prepared: boolean;
}): TaskExecutionProductionAdapterReadiness {
  const configuration = input.configuration;
  const capabilityIssues =
    configuration === undefined
      ? []
      : requiredCapabilityIssues(configuration.capabilities);
  const issues = [...input.issues, ...capabilityIssues];
  const reconciliation = configuration?.reconciliation;
  const reconciliationCapabilitiesReady =
    reconciliation !== undefined &&
    reconciliation.supportsIdempotencyKey &&
    reconciliation.supportsLookupByIdempotencyKey &&
    reconciliation.supportsInvocationStatusQuery &&
    reconciliation.supportsResultReplay;
  const idempotencyReady =
    configuration?.capabilities.supportsIdempotencyKey === true &&
    configuration.reconciliation.supportsIdempotencyKey === true &&
    (input.request === undefined || isSafeId(input.request.idempotencyKey));
  const contractConformant =
    configuration !== undefined &&
    capabilityIssues.every((item) => item.severity !== "error") &&
    reconciliationCapabilitiesReady &&
    idempotencyReady;
  const credentialBoundaryReady =
    configuration !== undefined &&
    (!configuration.credentialRequired ||
      (configuration.credentialReference !== undefined &&
        credentialReferenceValid(configuration.credentialReference) &&
        input.credential?.ok === true &&
        input.credential.resolved === true));
  const permissionGateReady = input.gate?.allowed === true;
  const policyProofReady =
    configuration !== undefined &&
    (!configuration.policyRequired || input.gate?.policyAuthorized === true);
  const auditBoundaryReady =
    configuration !== undefined &&
    (!configuration.auditRequired || input.auditEvent !== undefined);
  const productionDispatchContractReady =
    contractConformant &&
    credentialBoundaryReady &&
    permissionGateReady &&
    policyProofReady &&
    auditBoundaryReady &&
    reconciliationCapabilitiesReady &&
    idempotencyReady;

  return {
    ok: productionDispatchContractReady,
    ProductionAdapterVerticalSliceReady: productionDispatchContractReady,
    ProductionDispatchPrepared: input.prepared,
    ProductionExecutionEnabled: TASK_EXECUTION_ADAPTER_PRODUCTION_EXECUTION_ENABLED,
    contractConformant,
    credentialBoundaryReady,
    permissionGateReady,
    policyProofReady,
    auditBoundaryReady,
    reconciliationCapabilitiesReady,
    idempotencyReady,
    productionDispatchContractReady,
    productionExecutionEnabled: TASK_EXECUTION_ADAPTER_PRODUCTION_EXECUTION_ENABLED,
    remainingDispatchBlockers: [
      "provider idempotency conformance",
      "provider status lookup",
      "provider result replay",
      "crash/reconciliation production integration",
      "explicit dispatch enable gate",
    ],
    issues,
  };
}

export function evaluateTaskExecutionProductionAdapterReadiness(input: {
  readonly configuration: unknown;
  readonly request?: TaskExecutionAdapterInvocationRequest;
  readonly permissionGateResult?: TaskExecutionPermissionGateResult;
  readonly credentialResolutionResult?: TaskExecutionCredentialResolutionResult;
  readonly preDispatchAuditEvent?: unknown;
  readonly taskOrModelConfigurationClaims?: unknown;
}): TaskExecutionProductionAdapterReadiness {
  const issues: TaskExecutionProductionAdapterIssue[] = [];
  const configuration = configurationFromUnknown(input.configuration);

  if (configuration === undefined) {
    issues.push(
      issue({
        code: "task_execution_production_adapter_configuration_invalid",
        message:
          "Production adapter configuration must be system-owned provider-neutral metadata without raw secrets or task-provided endpoints.",
        category: "validation",
      }),
    );
  }

  if (input.taskOrModelConfigurationClaims !== undefined) {
    issues.push(
      issue({
        code: "task_execution_production_adapter_task_model_configuration_claims_ignored",
        message:
          "Task/model adapter, provider, endpoint, credential, and execution-enable claims are ignored.",
        severity: "warning",
        category: "validation",
      }),
    );
  }

  const auditEvent =
    input.preDispatchAuditEvent !== undefined &&
    isTaskExecutionAuditEvent(input.preDispatchAuditEvent)
      ? input.preDispatchAuditEvent
      : undefined;

  return readiness({
    configuration,
    issues,
    request: input.request,
    gate: input.permissionGateResult,
    credential: input.credentialResolutionResult,
    auditEvent,
    prepared: false,
  });
}

function requestBindingIssues(input: {
  readonly configuration: TaskExecutionProductionAdapterConfiguration;
  readonly request: TaskExecutionAdapterInvocationRequest;
  readonly record: TaskExecutionInvocationRecord;
}): readonly TaskExecutionProductionAdapterIssue[] {
  const issues: TaskExecutionProductionAdapterIssue[] = [];
  const request = input.request;
  const record = input.record;

  if (
    request.adapterIdentity.adapterId !== input.configuration.identity.adapterId ||
    request.adapterIdentity.adapterKind !== "production_execution" ||
    request.adapterIdentity.identityAuthority !== "system" ||
    request.operationKind !== input.configuration.operationKind
  ) {
    issues.push(
      issue({
        code: "task_execution_production_adapter_request_configuration_mismatch",
        message:
          "Prepared production dispatch requires the authoritative invocation request to match system-owned adapter configuration.",
        category: "validation",
      }),
    );
  }

  if (
    request.invocationId !== record.invocationId ||
    request.idempotencyKey !== record.idempotencyKey ||
    request.taskId !== record.taskId ||
    request.sourceTaskRevision !== record.taskStateRevision ||
    request.attemptId !== record.attemptId ||
    request.attemptNumber !== record.attemptNumber ||
    request.workItemId !== record.workItemId ||
    request.batchId !== record.batchId
  ) {
    issues.push(
      issue({
        code: "task_execution_production_adapter_invocation_binding_mismatch",
        message:
          "Prepared production dispatch cannot replace invocation, task, attempt, work, batch, or idempotency authority.",
        category: "validation",
      }),
    );
  }

  return issues;
}

function gateBindingIssues(input: {
  readonly configuration: TaskExecutionProductionAdapterConfiguration;
  readonly request: TaskExecutionAdapterInvocationRequest;
  readonly gate: TaskExecutionPermissionGateResult;
}): readonly TaskExecutionProductionAdapterIssue[] {
  const gate = input.gate;
  const request = input.request;
  const issues: TaskExecutionProductionAdapterIssue[] = [];

  if (!gate.allowed) {
    issues.push(
      issue({
        code: "task_execution_production_adapter_permission_gate_blocked",
        message:
          "Production dispatch preparation is blocked until the permission/policy gate allows the exact invocation.",
        category: "permission",
      }),
    );
  }

  if (
    gate.taskId !== request.taskId ||
    gate.sourceTaskRevision !== request.sourceTaskRevision ||
    gate.attemptId !== request.attemptId ||
    gate.invocationId !== request.invocationId ||
    gate.adapterId !== input.configuration.identity.adapterId ||
    gate.operation !== request.operationKind
  ) {
    issues.push(
      issue({
        code: "task_execution_production_adapter_permission_gate_binding_mismatch",
        message:
          "Permission gate result does not match the exact prepared production dispatch binding.",
        category: "permission",
      }),
    );
  }

  if (input.configuration.policyRequired && !gate.policyAuthorized) {
    issues.push(
      issue({
        code: "task_execution_production_adapter_policy_proof_missing",
        message:
          "Production dispatch preparation requires exact-context durable policy authorization when policy is required.",
        category: "policy",
      }),
    );
  }

  return issues;
}

function credentialBindingIssues(input: {
  readonly configuration: TaskExecutionProductionAdapterConfiguration;
  readonly request: TaskExecutionAdapterInvocationRequest;
  readonly credential?: TaskExecutionCredentialResolutionResult;
}): readonly TaskExecutionProductionAdapterIssue[] {
  if (!input.configuration.credentialRequired) {
    return [];
  }

  const credential = input.credential;
  const reference = input.configuration.credentialReference;

  if (reference === undefined) {
    return [
      issue({
        code: "task_execution_production_adapter_credential_reference_missing",
        message:
          "Production adapter configuration requires a system-owned credential reference.",
        category: "permission",
      }),
    ];
  }

  if (credential?.ok !== true || credential.resolved !== true) {
    return [
      issue({
        code: "task_execution_production_adapter_credential_not_resolved",
        message:
          "Production dispatch preparation requires credential resolution after an allowed gate.",
        category: "permission",
      }),
    ];
  }

  if (
    credential.taskId !== input.request.taskId ||
    credential.taskRevision !== input.request.sourceTaskRevision ||
    credential.attemptId !== input.request.attemptId ||
    credential.invocationId !== input.request.invocationId ||
    credential.adapterId !== input.configuration.identity.adapterId ||
    credential.adapterKind !== "production_execution" ||
    credential.operationKind !== input.request.operationKind ||
    credential.credentialRef !== reference.credentialRef ||
    JSON.stringify([...credential.credentialScope].sort()) !==
      JSON.stringify([...reference.credentialScope].sort())
  ) {
    return [
      issue({
        code: "task_execution_production_adapter_credential_binding_mismatch",
        message:
          "Resolved credential metadata does not match the exact production dispatch credential binding.",
        category: "permission",
      }),
    ];
  }

  return [];
}

function auditBindingIssues(input: {
  readonly configuration: TaskExecutionProductionAdapterConfiguration;
  readonly request: TaskExecutionAdapterInvocationRequest;
  readonly gate: TaskExecutionPermissionGateResult;
  readonly credential?: TaskExecutionCredentialResolutionResult;
  readonly auditEvent?: unknown;
  readonly forbiddenCredentialValues?: readonly string[];
}): readonly TaskExecutionProductionAdapterIssue[] {
  if (!input.configuration.auditRequired) {
    return [];
  }

  if (
    input.auditEvent === undefined ||
    !isTaskExecutionAuditEvent(input.auditEvent)
  ) {
    return [
      issue({
        code: "task_execution_production_adapter_pre_dispatch_audit_missing",
        message:
          "Production dispatch preparation requires a durable pre-dispatch audit event when audit is required.",
        category: "validation",
      }),
    ];
  }

  const event = input.auditEvent;

  if (
    event.eventKind !== "execution_invocation_dispatch_intent" ||
    event.taskId !== input.request.taskId ||
    event.taskStateRevision !== input.request.sourceTaskRevision ||
    event.attemptId !== input.request.attemptId ||
    event.invocationId !== input.request.invocationId ||
    event.adapter?.adapterId !== input.configuration.identity.adapterId ||
    event.adapter.idempotencyReference !== input.request.idempotencyKey ||
    event.policy?.policyGateId !== input.gate.policyGateId ||
    event.policy.policyAuthorized !== input.gate.policyAuthorized ||
    (input.configuration.credentialRequired &&
      event.credential?.credentialRef !== input.configuration.credentialReference?.credentialRef) ||
    (input.credential?.resolutionReference !== null &&
      input.credential?.resolutionReference !== undefined &&
      event.credential?.credentialResolutionReference !==
        input.credential.resolutionReference)
  ) {
    return [
      issue({
        code: "task_execution_production_adapter_pre_dispatch_audit_mismatch",
        message:
          "Pre-dispatch audit event does not match the exact prepared production dispatch binding.",
        category: "validation",
      }),
    ];
  }

  if (
    containsForbiddenValue({
      value: event,
      forbiddenValues: input.forbiddenCredentialValues ?? [],
    })
  ) {
    return [
      issue({
        code: "task_execution_production_adapter_pre_dispatch_audit_secret_rejected",
        message:
          "Pre-dispatch audit event contains forbidden credential material.",
        category: "validation",
      }),
    ];
  }

  return [];
}

function normalizedRequest(
  request: TaskExecutionAdapterInvocationRequest,
): TaskExecutionProductionNormalizedRequest {
  const normalized: TaskExecutionProductionNormalizedRequest = {
    payloadAuthority: "aeos_invocation_request",
  };
  const sanitized =
    request.input === undefined ? undefined : sanitizeJsonValue(request.input);

  if (
    sanitized !== undefined &&
    isJsonValue(sanitized) &&
    jsonWithinLimit(sanitized)
  ) {
    return {
      ...normalized,
      input: sanitized,
      inputReference: request.inputReference,
    };
  }

  return {
    ...normalized,
    inputReference: request.inputReference,
  };
}

function resolvedCredentialMaterial(
  credential?: TaskExecutionCredentialResolutionResult,
): TaskExecutionResolvedCredential | undefined {
  return credential?.resolvedCredential;
}

export function prepareTaskExecutionProductionDispatch(
  input: TaskExecutionProductionDispatchRequest,
): TaskExecutionProductionDispatchResult {
  const issues: TaskExecutionProductionAdapterIssue[] = [];
  const configuration = configurationFromUnknown(input.configuration);

  if (configuration === undefined) {
    issues.push(
      issue({
        code: "task_execution_production_adapter_configuration_invalid",
        message:
          "Production adapter configuration must be system-owned provider-neutral metadata without raw secrets or task-provided endpoints.",
        category: "validation",
      }),
    );

    return {
      ...readiness({
        configuration,
        issues,
        request: input.request,
        gate: input.permissionGateResult,
        credential: input.credentialResolutionResult,
        prepared: false,
      }),
      preparedDispatch: null,
    };
  }

  const recordValidation = validateTaskExecutionInvocationRecord(
    input.invocationRecord,
  );

  if (!recordValidation.ok) {
    issues.push(
      issue({
        code: recordValidation.error.code,
        message:
          "Prepared production dispatch requires a valid persisted invocation record.",
        category: recordValidation.error.category,
      }),
    );
  }

  if (input.taskOrModelConfigurationClaims !== undefined) {
    issues.push(
      issue({
        code: "task_execution_production_adapter_task_model_configuration_claims_ignored",
        message:
          "Task/model production adapter configuration claims are ignored.",
        severity: "warning",
        category: "validation",
      }),
    );
  }

  if (
    input.taskOrModelDispatchClaims !== undefined &&
    containsForbiddenKey({
      value: input.taskOrModelDispatchClaims,
      keys: authorityOverrideKeys,
    })
  ) {
    issues.push(
      issue({
        code: "task_execution_production_adapter_hostile_dispatch_claims_rejected",
        message:
          "Task/model dispatch claims attempting to override adapter, provider, idempotency, credential, endpoint, policy, or production execution authority were ignored.",
        severity: "warning",
        category: "validation",
      }),
    );
  }

  if (
    input.taskOrModelDispatchClaims !== undefined &&
    containsForbiddenKey({ value: input.taskOrModelDispatchClaims, keys: secretKeys })
  ) {
    issues.push(
      issue({
        code: "task_execution_production_adapter_hostile_secret_claims_rejected",
        message:
          "Task/model dispatch claims containing raw credential-like fields were ignored.",
        severity: "warning",
        category: "validation",
      }),
    );
  }

  const record = recordValidation.ok ? recordValidation.value : undefined;

  if (record !== undefined) {
    issues.push(
      ...requestBindingIssues({
        configuration,
        request: input.request,
        record,
      }),
    );
  }

  issues.push(
    ...gateBindingIssues({
      configuration,
      request: input.request,
      gate: input.permissionGateResult,
    }),
  );
  issues.push(
    ...credentialBindingIssues({
      configuration,
      request: input.request,
      credential: input.credentialResolutionResult,
    }),
  );
  issues.push(
    ...auditBindingIssues({
      configuration,
      request: input.request,
      gate: input.permissionGateResult,
      credential: input.credentialResolutionResult,
      auditEvent: input.preDispatchAuditEvent,
      forbiddenCredentialValues: input.forbiddenCredentialValues,
    }),
  );

  const auditEvent =
    input.preDispatchAuditEvent !== undefined &&
    isTaskExecutionAuditEvent(input.preDispatchAuditEvent)
      ? input.preDispatchAuditEvent
      : undefined;
  const readinessResult = readiness({
    configuration,
    issues,
    request: input.request,
    gate: input.permissionGateResult,
    credential: input.credentialResolutionResult,
    auditEvent,
    prepared: false,
  });

  if (
    !readinessResult.productionDispatchContractReady ||
    record === undefined ||
    issues.some((item) => item.severity === "error")
  ) {
    return {
      ...readinessResult,
      preparedDispatch: null,
    };
  }

  const ephemeralCredential = resolvedCredentialMaterial(
    input.credentialResolutionResult,
  );

  if (
    configuration.credentialRequired &&
    (ephemeralCredential === undefined || typeof ephemeralCredential.value !== "string")
  ) {
    const blockedReadiness = readiness({
      configuration,
      issues: [
        ...issues,
        issue({
          code: "task_execution_production_adapter_ephemeral_credential_missing",
          message:
            "Production dispatch preparation requires ephemeral credential material in memory, but it is never serialized.",
          category: "permission",
        }),
      ],
      request: input.request,
      gate: input.permissionGateResult,
      credential: input.credentialResolutionResult,
      auditEvent,
      prepared: false,
    });

    return {
      ...blockedReadiness,
      preparedDispatch: null,
    };
  }

  const preparedDispatch: TaskExecutionProductionPreparedDispatch = {
    taskId: record.taskId,
    sourceTaskRevision: record.taskStateRevision,
    attemptId: record.attemptId,
    attemptNumber: record.attemptNumber,
    invocationId: record.invocationId,
    idempotencyKey: record.idempotencyKey,
    adapterId: configuration.identity.adapterId,
    adapterIdentity: configuration.identity,
    implementationVersion: configuration.identity.implementationVersion,
    capabilityVersion: configuration.identity.capabilityVersion,
    provider: configuration.provider,
    operationKind: input.request.operationKind,
    workItemId: record.workItemId ?? null,
    batchId: record.batchId ?? null,
    credentialRef: configuration.credentialReference?.credentialRef ?? null,
    credentialScope: configuration.credentialReference?.credentialScope ?? [],
    credentialResolutionReference:
      input.credentialResolutionResult?.resolutionReference ?? null,
    policyGateId: input.permissionGateResult.policyGateId,
    policyDecisionReference:
      auditEvent?.policy?.policyDecisionReference ??
      (input.permissionGateResult.policyAuthorized
        ? input.permissionGateResult.policyGateId
        : null),
    auditEventId: auditEvent?.auditEventId ?? null,
    auditSequence: auditEvent?.sequence ?? null,
    normalizedRequest: normalizedRequest(input.request),
    reconciliationCapabilities: configuration.reconciliation,
    providerContracts,
    productionExecutionEnabled:
      TASK_EXECUTION_ADAPTER_PRODUCTION_EXECUTION_ENABLED,
    safety: dispatchSafety,
  };

  const finalReadiness = readiness({
    configuration,
    issues,
    request: input.request,
    gate: input.permissionGateResult,
    credential: input.credentialResolutionResult,
    auditEvent,
    prepared: true,
  });

  return {
    ...finalReadiness,
    preparedDispatch,
  };
}
