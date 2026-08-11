import type {
  TaskExecutionAdapterIdentity,
  TaskExecutionAdapterOperationKind,
} from "./task-execution-adapter.js";
import type {
  TaskExecutionCredentialProvider,
  TaskExecutionCredentialProviderIdentity,
  TaskExecutionCredentialProviderResolution,
  TaskExecutionCredentialResolutionRequest,
  TaskExecutionResolvedCredentialKind,
} from "./task-execution-credential.js";
import type { AeosError } from "./types.js";

export interface TaskExecutionProductionCredentialProviderIdentity
  extends TaskExecutionCredentialProviderIdentity {
  readonly kind: "environment_reference";
}

export interface TaskExecutionEnvironmentReferenceCredentialMapping {
  readonly credentialRef: string;
  readonly environmentVariableName: string;
  readonly credentialKind: TaskExecutionResolvedCredentialKind;
  readonly credentialScope: readonly string[];
  readonly adapterId: string;
  readonly adapterKind: TaskExecutionAdapterIdentity["adapterKind"];
  readonly operationKind: TaskExecutionAdapterOperationKind;
  readonly configurationAuthority: "system";
  readonly expiresAt?: string;
  readonly resolutionReference?: string;
}

export interface TaskExecutionProductionCredentialProviderConfiguration {
  readonly providerId: string;
  readonly providerKind: "environment_reference";
  readonly configurationVersion: string;
  readonly configurationAuthority: "system";
  readonly credentials: readonly TaskExecutionEnvironmentReferenceCredentialMapping[];
}

export interface TaskExecutionCredentialProviderRegistry {
  readonly providers: readonly TaskExecutionCredentialProvider[];
  readonly resolveProvider: (
    providerId: string,
  ) => TaskExecutionCredentialProvider | undefined;
}

export interface TaskExecutionProductionCredentialProviderConfigurationIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: "error" | "warning";
  readonly category: AeosError["category"];
}

export interface TaskExecutionProductionCredentialProviderConfigurationResult {
  readonly ok: boolean;
  readonly providerAccepted: boolean;
  readonly providerId: string | null;
  readonly providerKind: "environment_reference" | null;
  readonly configurationVersion: string | null;
  readonly credentialRefs: readonly string[];
  readonly issues: readonly TaskExecutionProductionCredentialProviderConfigurationIssue[];
}

export interface CreateEnvironmentReferenceCredentialProviderInput {
  readonly identity: TaskExecutionProductionCredentialProviderIdentity;
  readonly configuration: TaskExecutionProductionCredentialProviderConfiguration;
  readonly readEnvironmentVariable?: (environmentVariableName: string) => string | undefined;
}

const safeIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/;
const safeEnvironmentVariableNamePattern = /^[A-Z][A-Z0-9_]{0,127}$/;
const allowedCredentialKinds = new Set<string>([
  "opaque_secret",
  "api_key",
  "bearer_token",
]);
const allowedOperations = new Set<TaskExecutionAdapterOperationKind>([
  "execute_task_attempt",
  "query_invocation_status",
  "replay_invocation_result",
  "cancel_invocation",
]);
const configurationKeys = new Set<string>([
  "providerId",
  "providerKind",
  "configurationVersion",
  "configurationAuthority",
  "credentials",
]);
const mappingKeys = new Set<string>([
  "credentialRef",
  "environmentVariableName",
  "credentialKind",
  "credentialScope",
  "adapterId",
  "adapterKind",
  "operationKind",
  "configurationAuthority",
  "expiresAt",
  "resolutionReference",
]);
const forbiddenRawSecretKeys = new Set<string>([
  "apikey",
  "token",
  "accesstoken",
  "refreshtoken",
  "secret",
  "password",
  "authorization",
  "bearer",
  "privatekey",
  "credentialvalue",
]);

function issue(input: {
  readonly code: string;
  readonly message: string;
  readonly category: AeosError["category"];
  readonly severity?: "error" | "warning";
}): TaskExecutionProductionCredentialProviderConfigurationIssue {
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

function canonicalKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function containsForbiddenRawSecretKey(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => containsForbiddenRawSecretKey(item));
  }

  if (!isRecord(value)) {
    return false;
  }

  return Object.entries(value).some(
    ([key, item]) =>
      forbiddenRawSecretKeys.has(canonicalKey(key)) ||
      containsForbiddenRawSecretKey(item),
  );
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

function isSafeEnvironmentVariableName(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value === value.trim() &&
    safeEnvironmentVariableNamePattern.test(value)
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

function scopesEqual(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const leftSorted = [...left].sort();
  const rightSorted = [...right].sort();

  return leftSorted.every((item, index) => item === rightSorted[index]);
}

function safeResolutionReference(value: unknown): value is string | undefined {
  return value === undefined || isSafeId(value);
}

function safeOptionalText(value: unknown): value is string | undefined {
  if (value === undefined) {
    return true;
  }

  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= 512 &&
    !/(\n\s*at\s+|Error:|stack)/i.test(value)
  );
}

function defaultEnvironmentVariableReader(
  environmentVariableName: string,
): string | undefined {
  const runtime = globalThis as unknown as {
    readonly process?: {
      readonly env?: Record<string, string | undefined>;
    };
  };

  return runtime.process?.env?.[environmentVariableName];
}

function mappingFromUnknown(
  value: unknown,
): TaskExecutionEnvironmentReferenceCredentialMapping | undefined {
  if (
    !isRecord(value) ||
    !isSafeId(value.credentialRef) ||
    !isSafeEnvironmentVariableName(value.environmentVariableName) ||
    typeof value.credentialKind !== "string" ||
    !allowedCredentialKinds.has(value.credentialKind) ||
    !isStringScope(value.credentialScope) ||
    !isSafeId(value.adapterId) ||
    value.adapterKind !== "test_execution" ||
    typeof value.operationKind !== "string" ||
    !allowedOperations.has(value.operationKind as TaskExecutionAdapterOperationKind) ||
    value.configurationAuthority !== "system" ||
    !safeResolutionReference(value.resolutionReference) ||
    !safeOptionalText(value.expiresAt) ||
    !Object.keys(value).every((key) => mappingKeys.has(key)) ||
    containsForbiddenRawSecretKey(value)
  ) {
    return undefined;
  }

  return value as unknown as TaskExecutionEnvironmentReferenceCredentialMapping;
}

function configurationFromUnknown(
  value: unknown,
): TaskExecutionProductionCredentialProviderConfiguration | undefined {
  if (
    !isRecord(value) ||
    !isSafeId(value.providerId) ||
    value.providerKind !== "environment_reference" ||
    !isSafeId(value.configurationVersion) ||
    value.configurationAuthority !== "system" ||
    !Array.isArray(value.credentials) ||
    value.credentials.length === 0 ||
    value.credentials.length > 64 ||
    !Object.keys(value).every((key) => configurationKeys.has(key)) ||
    containsForbiddenRawSecretKey(value)
  ) {
    return undefined;
  }

  const credentials = value.credentials.map(mappingFromUnknown);

  if (credentials.some((item) => item === undefined)) {
    return undefined;
  }

  const typedCredentials =
    credentials as readonly TaskExecutionEnvironmentReferenceCredentialMapping[];
  const refs = typedCredentials.map((item) => item.credentialRef);

  if (new Set(refs).size !== refs.length) {
    return undefined;
  }

  return {
    providerId: value.providerId,
    providerKind: "environment_reference",
    configurationVersion: value.configurationVersion,
    configurationAuthority: "system",
    credentials: typedCredentials,
  };
}

function providerIdentityValid(
  identity: unknown,
): identity is TaskExecutionProductionCredentialProviderIdentity {
  return (
    isRecord(identity) &&
    isSafeId(identity.providerId) &&
    identity.kind === "environment_reference" &&
    identity.authority === "system" &&
    isSafeId(identity.implementationVersion) &&
    isSafeId(identity.configurationVersion) &&
    !containsForbiddenRawSecretKey(identity)
  );
}

export function evaluateTaskExecutionProductionCredentialProviderConfiguration(input: {
  readonly identity: unknown;
  readonly configuration: unknown;
}): TaskExecutionProductionCredentialProviderConfigurationResult {
  const issues: TaskExecutionProductionCredentialProviderConfigurationIssue[] = [];
  const identity = providerIdentityValid(input.identity)
    ? input.identity
    : undefined;
  const configuration = configurationFromUnknown(input.configuration);

  if (identity === undefined) {
    issues.push(
      issue({
        code: "task_execution_production_credential_provider_identity_invalid",
        message:
          "Production credential provider identity must be system-owned environment_reference metadata.",
        category: "validation",
      }),
    );
  }

  if (configuration === undefined) {
    issues.push(
      issue({
        code: "task_execution_production_credential_configuration_invalid",
        message:
          "Production credential provider configuration must be a system-owned logical credential mapping.",
        category: "validation",
      }),
    );
  }

  if (
    identity !== undefined &&
    configuration !== undefined &&
    (identity.providerId !== configuration.providerId ||
      identity.configurationVersion !== configuration.configurationVersion)
  ) {
    issues.push(
      issue({
        code: "task_execution_production_credential_identity_configuration_mismatch",
        message:
          "Production credential provider identity must match its system-owned configuration.",
        category: "validation",
      }),
    );
  }

  return {
    ok: issues.every((item) => item.severity !== "error"),
    providerAccepted: issues.every((item) => item.severity !== "error"),
    providerId: identity?.providerId ?? configuration?.providerId ?? null,
    providerKind:
      identity?.kind ?? configuration?.providerKind ?? null,
    configurationVersion:
      identity?.configurationVersion ?? configuration?.configurationVersion ?? null,
    credentialRefs:
      configuration?.credentials.map((item) => item.credentialRef).sort() ?? [],
    issues,
  };
}

function requestValid(
  request: TaskExecutionCredentialResolutionRequest,
): boolean {
  return (
    isSafeId(request.taskId) &&
    isPositiveInteger(request.taskRevision) &&
    isSafeId(request.attemptId) &&
    isSafeId(request.invocationId) &&
    isSafeId(request.adapterId) &&
    request.adapterKind === "test_execution" &&
    allowedOperations.has(request.operationKind) &&
    isSafeId(request.credentialRef) &&
    isStringScope(request.credentialScope) &&
    isSafeId(request.permissionGateId) &&
    typeof request.policyRequired === "boolean" &&
    typeof request.policyAuthorized === "boolean"
  );
}

function resolveEnvironmentReferenceCredential(input: {
  readonly identity: TaskExecutionProductionCredentialProviderIdentity;
  readonly configuration: TaskExecutionProductionCredentialProviderConfiguration;
  readonly request: TaskExecutionCredentialResolutionRequest;
  readonly readEnvironmentVariable: (environmentVariableName: string) => string | undefined;
}): TaskExecutionCredentialProviderResolution {
  if (!requestValid(input.request)) {
    return {
      status: "error",
      code: "task_execution_production_credential_request_invalid",
      message:
        "Production credential resolution request did not match authoritative execution context.",
    };
  }

  if (
    input.configuration.providerId !== input.identity.providerId ||
    input.configuration.configurationVersion !== input.identity.configurationVersion
  ) {
    return {
      status: "error",
      code: "task_execution_production_credential_configuration_mismatch",
      message:
        "Production credential provider configuration did not match provider identity.",
    };
  }

  if (input.request.policyRequired && !input.request.policyAuthorized) {
    return {
      status: "denied",
      code: "task_execution_production_credential_policy_not_authorized",
      message:
        "Production credential resolution requires the exact authorized policy gate when policy is required.",
    };
  }

  const mapping = input.configuration.credentials.find(
    (item) => item.credentialRef === input.request.credentialRef,
  );

  if (mapping === undefined) {
    return {
      status: "missing",
      code: "task_execution_production_credential_mapping_not_found",
      message:
        "Logical credential reference is not present in the system-owned provider configuration.",
      safety: {
        environmentRead: false,
        productionProviderResolved: false,
      },
    };
  }

  if (
    mapping.adapterId !== input.request.adapterId ||
    mapping.adapterKind !== input.request.adapterKind ||
    mapping.operationKind !== input.request.operationKind ||
    !scopesEqual(mapping.credentialScope, input.request.credentialScope)
  ) {
    return {
      status: "denied",
      code: "task_execution_production_credential_context_mismatch",
      message:
        "Logical credential reference is not bound to the requested adapter, operation, and scope context.",
      safety: {
        environmentRead: false,
        productionProviderResolved: false,
      },
    };
  }

  const value = input.readEnvironmentVariable(mapping.environmentVariableName);

  if (value === undefined || value.length === 0) {
    return {
      status: "missing",
      code: "task_execution_credential_missing",
      message:
        "System-owned environment reference did not resolve a usable credential value.",
      safety: {
        environmentRead: true,
        productionProviderResolved: false,
      },
    };
  }

  return {
    status: "resolved",
    kind: mapping.credentialKind,
    value,
    expiresAt: mapping.expiresAt,
    scope: mapping.credentialScope,
    resolutionReference:
      mapping.resolutionReference ??
      `credential-resolution:${input.identity.providerId}:${mapping.credentialRef}`,
    safety: {
      environmentRead: true,
      productionProviderResolved: true,
    },
  };
}

export function createEnvironmentReferenceCredentialProvider(
  input: CreateEnvironmentReferenceCredentialProviderInput,
): TaskExecutionCredentialProvider {
  const configurationResult =
    evaluateTaskExecutionProductionCredentialProviderConfiguration({
      identity: input.identity,
      configuration: input.configuration,
    });
  const configuration = configurationFromUnknown(input.configuration);
  const reader =
    input.readEnvironmentVariable ?? defaultEnvironmentVariableReader;

  return {
    identity: input.identity,
    resolve(request) {
      if (!configurationResult.ok || configuration === undefined) {
        return {
          status: "error",
          code: "task_execution_production_credential_configuration_invalid",
          message:
            "Production credential provider configuration is invalid.",
        };
      }

      return resolveEnvironmentReferenceCredential({
        identity: input.identity,
        configuration,
        request,
        readEnvironmentVariable: reader,
      });
    },
  };
}

export function createTaskExecutionCredentialProviderRegistry(
  providers: readonly TaskExecutionCredentialProvider[],
): TaskExecutionCredentialProviderRegistry {
  const providerMap = new Map(
    providers.map((provider) => [provider.identity.providerId, provider]),
  );

  return {
    providers,
    resolveProvider(providerId) {
      return providerMap.get(providerId);
    },
  };
}
