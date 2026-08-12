// @ts-expect-error Node built-ins are available at runtime; this package does not depend on Node ambient types yet.
import { readFile } from "node:fs/promises";
// @ts-expect-error Node built-ins are available at runtime; this package does not depend on Node ambient types yet.
import { join } from "node:path";

import type {
  TaskExecutionAdapterFailureCategory,
  TaskExecutionAdapterPermissions,
} from "./task-execution-adapter.js";
import type {
  TaskExecutionCredentialProvider,
} from "./task-execution-credential.js";
import {
  createEnvironmentReferenceCredentialProvider,
} from "./task-execution-production-credential.js";
import type {
  TaskExecutionProductionAdapterCapabilities,
  TaskExecutionProductionAdapterConfiguration,
  TaskExecutionProductionAdapterIdentity,
} from "./task-execution-production-adapter.js";
import type {
  TaskExecutionProductionProviderConformanceResult,
} from "./task-execution-production-provider-conformance.js";
import type {
  TaskExecutionControlledHttpProductionProviderConfiguration,
  TaskExecutionProductionProviderDispatchTransport,
  TaskExecutionProductionProviderDispatchTransportResult,
} from "./task-execution-production-provider-dispatch.js";
import {
  createControlledHttpProductionProviderDispatchTransport,
} from "./task-execution-production-provider-dispatch.js";
import type { AeosError, JsonObject, JsonValue, Result } from "./types.js";

export const AEOS_PRODUCTION_PROVIDER_PROFILES_RELATIVE_PATH =
  ".aeos/system/production-provider-profiles.json";

export type TaskExecutionTrustedProductionProviderProfileKind =
  | "controlled_http"
  | "controlled_http_test_fixture";

export interface LoadTaskExecutionTrustedProductionProviderProfileInput {
  readonly projectRoot: string;
  readonly providerProfileId: string;
  readonly fetch?: (
    url: string,
    init: {
      readonly method: "POST";
      readonly redirect?: "error";
      readonly headers: Record<string, string>;
      readonly body: string;
    },
  ) => Promise<{
    readonly ok: boolean;
    readonly status: number;
    readonly headers: {
      readonly get: (name: string) => string | null;
    };
    readonly text: () => Promise<string>;
  }>;
}

export interface TaskExecutionTrustedProductionProviderRuntimeProfile {
  readonly providerProfileId: string;
  readonly kind: TaskExecutionTrustedProductionProviderProfileKind;
  readonly realCallReady: boolean;
  readonly adapterConfiguration: TaskExecutionProductionAdapterConfiguration;
  readonly credentialProvider: TaskExecutionCredentialProvider;
  readonly credentialProviderId: string;
  readonly credentialRef: string;
  readonly credentialScope: readonly string[];
  readonly providerConformance: TaskExecutionProductionProviderConformanceResult;
  readonly transport: TaskExecutionProductionProviderDispatchTransport;
  readonly httpConfiguration: TaskExecutionControlledHttpProductionProviderConfiguration | null;
}

interface TrustedProviderProfileFile {
  readonly schemaVersion: 1;
  readonly profiles: readonly unknown[];
}

const safeIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/;

function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

function err(
  code: string,
  message: string,
  category: AeosError["category"] = "validation",
): Result<never, AeosError> {
  return {
    ok: false,
    error: {
      code,
      message,
      category,
      retryable: false,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeId(value: unknown): value is string {
  return typeof value === "string" && safeIdPattern.test(value);
}

function stringArray(value: unknown): readonly string[] | undefined {
  return Array.isArray(value) && value.every((item) => isSafeId(item))
    ? value
    : undefined;
}

function booleanRecord(value: unknown): Record<string, boolean> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const output: Record<string, boolean> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== "boolean") {
      return undefined;
    }
    output[key] = item;
  }
  return output;
}

function capabilitiesFromProfile(value: unknown): TaskExecutionProductionAdapterCapabilities {
  const capabilities = booleanRecord(value) ?? {};

  return {
    supportsIdempotencyKey: capabilities.supportsIdempotencyKey === true,
    supportsLookupByIdempotencyKey:
      capabilities.supportsLookupByIdempotencyKey === true,
    supportsInvocationStatusQuery:
      capabilities.supportsInvocationStatusQuery === true,
    supportsResultReplay: capabilities.supportsResultReplay === true,
    providesDeterministicProviderInvocationReference:
      capabilities.providesDeterministicProviderInvocationReference === true,
    supportsBoundedErrors: capabilities.supportsBoundedErrors === true,
    supportsCancellation: capabilities.supportsCancellation === true,
    supportsStreaming: capabilities.supportsStreaming === true,
    supportsToolCalls: capabilities.supportsToolCalls === true,
    supportsNetworkAccess: capabilities.supportsNetworkAccess === true,
    supportsFilesystemAccess: false,
    supportsProcessExecution: false,
    supportsShellExecution: false,
    supportsModelInvocation: false,
    supportsExternalSideEffects: capabilities.supportsExternalSideEffects === true,
    supportsFailureNormalization: true,
  };
}

function permissionsFromProfile(input: {
  readonly policyRequired: boolean;
}): TaskExecutionAdapterPermissions {
  return {
    permissionAuthority: "system",
    policyRequired: input.policyRequired,
    policyAuthorized: false,
    externalSideEffectPermission: true,
    networkPermission: true,
    filesystemPermission: false,
    processPermission: false,
    shellPermission: false,
    toolCallPermission: false,
    modelInvocationPermission: false,
  };
}

function conformanceFromProfile(input: {
  readonly profileId: string;
  readonly recovery: Record<string, boolean>;
  readonly authority: unknown;
  readonly realCallReady: boolean;
}): TaskExecutionProductionProviderConformanceResult {
  const realEvidenceReady =
    input.authority === "provider_runtime_evidence" && input.realCallReady;
  const testEvidenceReady = input.authority === "test_authoritative";
  const acceptedAuthority = realEvidenceReady || testEvidenceReady;
  const idempotencyProven =
    acceptedAuthority && input.recovery.idempotencyProven === true;
  const duplicateSuppressionProven =
    acceptedAuthority && input.recovery.duplicateSuppressionProven === true;
  const providerReferenceProven =
    acceptedAuthority && input.recovery.providerReferenceProven === true;
  const lookupProven = acceptedAuthority && input.recovery.lookupProven === true;
  const statusQueryProven =
    acceptedAuthority && input.recovery.statusQueryProven === true;
  const resultReplayProven =
    acceptedAuthority && input.recovery.resultReplayProven === true;
  const crashRecoveryProven =
    acceptedAuthority && input.recovery.crashRecoveryProven === true;
  const blindRetryPrevented =
    acceptedAuthority && input.recovery.blindRetryPrevented === true;
  const contractConformant =
    idempotencyProven &&
    duplicateSuppressionProven &&
    providerReferenceProven &&
    lookupProven &&
    statusQueryProven &&
    resultReplayProven &&
    crashRecoveryProven &&
    blindRetryPrevented;

  return {
    ok: contractConformant,
    subjectId: input.profileId,
    contractConformant,
    FirstCallProviderRecoveryReady: contractConformant,
    idempotencyProven,
    duplicateSuppressionProven,
    providerReferenceProven,
    lookupProven,
    statusQueryProven,
    resultReplayProven,
    crashRecoveryProven,
    blindRetryPrevented,
    secretSafe: true,
    ownershipSecretSafe: true,
    productionExecutionEnabled: false,
    ProductionExecutionEnabled: false,
    sideEffectCount: 0,
    duplicateSideEffectCount: 0,
    differentKeySideEffectCount: 0,
    providerInvocationRef: null,
    evidence: {
      success: null,
      failure: null,
      inProgress: null,
      notFound: null,
      unavailable: null,
    },
    issues: contractConformant
      ? []
      : [
          {
            code: "task_execution_production_provider_profile_recovery_not_proven",
            message:
              "Trusted provider profile does not carry accepted provider runtime recovery evidence.",
            severity: "error",
            category: "conflict",
          },
        ],
    safety: {
      networkCalled: false,
      httpCalled: false,
      vendorSdkCalled: false,
      productionDispatchEnabled: false,
      blindRetryPerformed: false,
      replayPerformedExternalSideEffect: false,
      providerSuccessCompletesWork: false,
      providerOutputGrantsRetryAuthority: false,
    },
  };
}

function testFixtureTransport(input: {
  readonly outcome: Record<string, unknown>;
}): TaskExecutionProductionProviderDispatchTransport {
  return {
    dispatch: async () => {
      const status = input.outcome.status;
      const providerInvocationRef =
        typeof input.outcome.providerInvocationRef === "string"
          ? input.outcome.providerInvocationRef
          : "test-fixture-provider-ref";

      if (status === "returned") {
        return {
          status: "returned",
          providerInvocationRef,
          output: input.outcome.output as JsonValue | undefined,
          observedAt:
            typeof input.outcome.observedAt === "string"
              ? input.outcome.observedAt
              : undefined,
        };
      }

      if (status === "failed") {
        return {
          status: "failed",
          providerInvocationRef,
          code:
            typeof input.outcome.code === "string"
              ? input.outcome.code
              : "task_execution_production_provider_profile_fixture_failed",
          category: "adapter_failure",
          retryable: false,
          diagnostic:
            typeof input.outcome.diagnostic === "string"
              ? input.outcome.diagnostic
              : undefined,
          observedAt:
            typeof input.outcome.observedAt === "string"
              ? input.outcome.observedAt
              : undefined,
        };
      }

      return {
        status: "outcome_unknown",
        providerInvocationRef,
        code:
          typeof input.outcome.code === "string"
            ? input.outcome.code
            : "task_execution_production_provider_profile_fixture_unknown",
        diagnostic:
          typeof input.outcome.diagnostic === "string"
            ? input.outcome.diagnostic
            : undefined,
        observedAt:
          typeof input.outcome.observedAt === "string"
            ? input.outcome.observedAt
            : undefined,
      };
    },
  };
}

function parseProfileFile(value: unknown): TrustedProviderProfileFile | undefined {
  return isRecord(value) &&
    value.schemaVersion === 1 &&
    Array.isArray(value.profiles)
    ? { schemaVersion: 1, profiles: value.profiles }
    : undefined;
}

export async function loadTaskExecutionTrustedProductionProviderProfile(
  input: LoadTaskExecutionTrustedProductionProviderProfileInput,
): Promise<
  Result<TaskExecutionTrustedProductionProviderRuntimeProfile, AeosError>
> {
  const profilePath = join(
    input.projectRoot,
    AEOS_PRODUCTION_PROVIDER_PROFILES_RELATIVE_PATH,
  );
  let parsed: unknown;

  try {
    parsed = JSON.parse(await readFile(profilePath, "utf8"));
  } catch {
    return err(
      "task_execution_production_provider_profile_missing",
      "Trusted production provider profile configuration was not found or was not valid JSON.",
      "not_found",
    );
  }

  const file = parseProfileFile(parsed);
  if (file === undefined) {
    return err(
      "task_execution_production_provider_profile_file_invalid",
      "Trusted production provider profile configuration has an invalid schema.",
    );
  }

  const rawProfile = file.profiles.find(
    (item) =>
      isRecord(item) && item.providerProfileId === input.providerProfileId,
  );

  if (!isRecord(rawProfile)) {
    return err(
      "task_execution_production_provider_profile_not_found",
      "Requested trusted production provider profile was not found.",
      "not_found",
    );
  }

  if (
    rawProfile.authority !== "system" ||
    !isSafeId(rawProfile.providerProfileId) ||
    (rawProfile.kind !== "controlled_http" &&
      rawProfile.kind !== "controlled_http_test_fixture")
  ) {
    return err(
      "task_execution_production_provider_profile_invalid",
      "Trusted production provider profile must be system-owned and use a closed provider kind.",
    );
  }

  if (
    typeof rawProfile.endpoint === "string" &&
    rawProfile.endpoint.includes("?")
  ) {
    return err(
      "task_execution_production_provider_profile_endpoint_secret_risk",
      "Trusted production provider profile endpoints cannot include query strings.",
      "permission",
    );
  }

  const credential = isRecord(rawProfile.credential)
    ? rawProfile.credential
    : undefined;
  const recovery = booleanRecord(rawProfile.recovery) ?? {};
  const credentialScope = stringArray(credential?.credentialScope) ?? [];
  const credentialRequired = rawProfile.credentialRequired !== false;
  const policyRequired = rawProfile.policyRequired === true;
  const auditRequired = rawProfile.auditRequired !== false;
  const capabilities = capabilitiesFromProfile(rawProfile.capabilities);
  const adapterIdentity: TaskExecutionProductionAdapterIdentity = {
    adapterId: isSafeId(rawProfile.adapterId)
      ? rawProfile.adapterId
      : rawProfile.providerProfileId,
    adapterKind: "production_execution",
    implementationVersion:
      typeof rawProfile.implementationVersion === "string"
        ? rawProfile.implementationVersion
        : "trusted-provider-profile-v1",
    capabilityVersion:
      typeof rawProfile.capabilityVersion === "string"
        ? rawProfile.capabilityVersion
        : "trusted-provider-profile-v1",
    identityAuthority: "system",
  };
  const providerRef = isSafeId(rawProfile.providerRef)
    ? rawProfile.providerRef
    : rawProfile.providerProfileId;
  const providerFamilyRef = isSafeId(rawProfile.providerFamilyRef)
    ? rawProfile.providerFamilyRef
    : undefined;
  const adapterConfiguration: TaskExecutionProductionAdapterConfiguration = {
    identity: adapterIdentity,
    configurationAuthority: "system",
    configurationVersion:
      typeof rawProfile.configurationVersion === "string"
        ? rawProfile.configurationVersion
        : "trusted-provider-profile-v1",
    provider: {
      providerRef,
      ...(providerFamilyRef === undefined ? {} : { providerFamilyRef }),
      operationClass: "task_attempt_execution",
      authority: "system",
    },
    operationKind: "execute_task_attempt",
    capabilities,
    permissions: permissionsFromProfile({ policyRequired }),
    credentialRequired,
    credentialReference: credentialRequired
      ? {
          credentialRef: isSafeId(credential?.credentialRef)
            ? credential.credentialRef
            : "provider.production.primary",
          secretProviderRef: isSafeId(credential?.secretProviderRef)
            ? credential.secretProviderRef
            : "trusted-environment-reference-provider",
          credentialScope,
          credentialAuthority: "system",
          rawCredentialMaterialPresent: false,
        }
      : undefined,
    auditRequired,
    policyRequired,
    reconciliation: {
      supportsIdempotencyKey: capabilities.supportsIdempotencyKey,
      supportsLookupByIdempotencyKey:
        capabilities.supportsLookupByIdempotencyKey,
      supportsInvocationStatusQuery:
        capabilities.supportsInvocationStatusQuery,
      supportsResultReplay: capabilities.supportsResultReplay,
    },
    failureNormalization: {
      authority: "system",
      categories: [
        "unavailable",
        "timeout",
        "rejected",
        "invalid_request",
        "provider_error",
        "unknown",
      ] satisfies readonly TaskExecutionAdapterFailureCategory[],
    },
  };

  const credentialProviderId =
    adapterConfiguration.credentialReference?.secretProviderRef ??
    "trusted-environment-reference-provider";
  const credentialRef =
    adapterConfiguration.credentialReference?.credentialRef ?? "";
  const credentialProvider = createEnvironmentReferenceCredentialProvider({
    identity: {
      providerId: credentialProviderId,
      kind: "environment_reference",
      implementationVersion: "trusted-provider-profile-v1",
      configurationVersion: "trusted-provider-profile-v1",
      authority: "system",
    },
    configuration: {
      providerId: credentialProviderId,
      providerKind: "environment_reference",
      configurationAuthority: "system",
      configurationVersion: "trusted-provider-profile-v1",
      credentials: credentialRequired
        ? [
            {
              credentialRef,
              environmentVariableName:
                typeof credential?.environmentVariableName === "string"
                  ? credential.environmentVariableName
                  : "AEOS_PRODUCTION_PROVIDER_CREDENTIAL",
              credentialKind:
                credential?.credentialKind === "opaque_secret"
                  ? "opaque_secret"
                  : credential?.credentialKind === "api_key"
                  ? "api_key"
                  : "bearer_token",
              credentialScope,
              adapterId: adapterIdentity.adapterId,
              adapterKind: "production_execution",
              operationKind: "execute_task_attempt",
              configurationAuthority: "system",
              resolutionReference:
                typeof credential?.resolutionReference === "string"
                  ? credential.resolutionReference
                  : `credential-resolution:${credentialProviderId}:${credentialRef}`,
            },
          ]
        : [],
    },
  });
  const realCallReady = rawProfile.realCallReady === true;
  const providerConformance = conformanceFromProfile({
    profileId: rawProfile.providerProfileId,
    recovery,
    authority: rawProfile.recoveryEvidenceAuthority,
    realCallReady,
  });

  if (rawProfile.kind === "controlled_http_test_fixture") {
    const outcome = isRecord(rawProfile.testFixtureOutcome)
      ? rawProfile.testFixtureOutcome
      : { status: "outcome_unknown" };

    return ok({
      providerProfileId: rawProfile.providerProfileId,
      kind: rawProfile.kind,
      realCallReady: false,
      adapterConfiguration,
      credentialProvider,
      credentialProviderId,
      credentialRef,
      credentialScope,
      providerConformance,
      transport: testFixtureTransport({ outcome }),
      httpConfiguration: null,
    });
  }

  const fetch = input.fetch;
  if (fetch === undefined) {
    return err(
      "task_execution_production_provider_profile_fetch_unavailable",
      "Controlled HTTP production provider profile requires a runtime fetch implementation.",
      "validation",
    );
  }

  const httpConfiguration: TaskExecutionControlledHttpProductionProviderConfiguration = {
    authority: "system",
    providerRef,
    endpoint:
      typeof rawProfile.endpoint === "string" ? rawProfile.endpoint : "",
    timeoutMs:
      typeof rawProfile.timeoutMs === "number" ? rawProfile.timeoutMs : 10_000,
    maxRequestBytes:
      typeof rawProfile.maxRequestBytes === "number"
        ? rawProfile.maxRequestBytes
        : 16_384,
    maxResponseBytes:
      typeof rawProfile.maxResponseBytes === "number"
        ? rawProfile.maxResponseBytes
        : 65_536,
    credentialMode:
      rawProfile.credentialMode === "none" ? "none" : "authorization_bearer",
  };

  return ok({
    providerProfileId: rawProfile.providerProfileId,
    kind: rawProfile.kind,
    realCallReady,
    adapterConfiguration,
    credentialProvider,
    credentialProviderId,
    credentialRef,
    credentialScope,
    providerConformance,
    transport: createControlledHttpProductionProviderDispatchTransport({
      configuration: httpConfiguration,
      fetch,
    }),
    httpConfiguration,
  });
}
