import type {
  TaskExecutionProductionPreparedDispatch,
} from "./task-execution-production-adapter.js";
import type {
  TaskExecutionInvocationProviderReconciliationCapabilities,
  TaskExecutionInvocationProviderReconciliationEvidence,
} from "./task-execution-invocation-reconciliation.js";
import {
  TASK_EXECUTION_ADAPTER_PRODUCTION_EXECUTION_ENABLED,
} from "./task-execution-adapter.js";
import type { AeosError, JsonObject, JsonValue } from "./types.js";

export type TaskExecutionProductionProviderConformanceScenario =
  | "success"
  | "failure"
  | "in_progress"
  | "never_accepted"
  | "status_unavailable"
  | "replay_unavailable";

export type TaskExecutionProductionProviderConformanceStatus =
  | "accepted"
  | "duplicate_replayed"
  | "duplicate_rejected"
  | "returned"
  | "failed"
  | "in_progress"
  | "not_found"
  | "unavailable";

export interface TaskExecutionProductionProviderCapabilityProfile
  extends TaskExecutionInvocationProviderReconciliationCapabilities {
  readonly capabilityAuthority: "system";
  readonly providesDeterministicProviderInvocationReference: boolean;
}

export interface TaskExecutionProductionProviderConformanceIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: "error" | "warning";
  readonly category: AeosError["category"];
}

export interface TaskExecutionProductionProviderConformanceDispatchRequest {
  readonly scenario: TaskExecutionProductionProviderConformanceScenario;
  readonly invocationId: string;
  readonly idempotencyKey: string;
  readonly taskId: string;
  readonly sourceTaskRevision: number;
  readonly attemptId: string;
  readonly attemptNumber: number;
  readonly providerRef: string;
  readonly operationClass: string;
  readonly normalizedInput?: JsonValue;
  readonly credentialRef: string | null;
  readonly credentialScope: readonly string[];
}

export interface TaskExecutionProductionProviderConformanceLookupRequest {
  readonly scenario: TaskExecutionProductionProviderConformanceScenario;
  readonly idempotencyKey: string;
  readonly providerInvocationRef?: string;
}

export interface TaskExecutionProductionProviderConformanceStatusRequest {
  readonly scenario: TaskExecutionProductionProviderConformanceScenario;
  readonly idempotencyKey: string;
  readonly providerInvocationRef?: string;
}

export interface TaskExecutionProductionProviderConformanceReplayRequest {
  readonly scenario: TaskExecutionProductionProviderConformanceScenario;
  readonly idempotencyKey: string;
  readonly providerInvocationRef: string;
}

export interface TaskExecutionProductionProviderConformanceObservation {
  readonly status: TaskExecutionProductionProviderConformanceStatus;
  readonly receivedIdempotencyKey?: string;
  readonly lookupIdempotencyKey?: string;
  readonly providerInvocationRef?: string;
  readonly providerInvocationRefBeforeAcceptance?: string;
  readonly invocationOk?: boolean;
  readonly output?: JsonValue;
  readonly resultReference?: string;
  readonly diagnosticCode?: string;
  readonly message?: string;
  readonly metadata?: JsonObject;
  readonly failureCode?: string;
  readonly failureCategory?: "execution_failure" | "adapter_failure" | "unknown";
  readonly retryable?: boolean;
  readonly diagnostic?: string;
  readonly sideEffectCount: number;
}

export interface TaskExecutionProductionProviderConformanceSubject {
  readonly subjectId: string;
  readonly capabilityProfile: TaskExecutionProductionProviderCapabilityProfile;
  readonly dispatch: (
    request: TaskExecutionProductionProviderConformanceDispatchRequest,
  ) =>
    | TaskExecutionProductionProviderConformanceObservation
    | Promise<TaskExecutionProductionProviderConformanceObservation>;
  readonly lookupByIdempotencyKey: (
    request: TaskExecutionProductionProviderConformanceLookupRequest,
  ) =>
    | TaskExecutionProductionProviderConformanceObservation
    | Promise<TaskExecutionProductionProviderConformanceObservation>;
  readonly getInvocationStatus: (
    request: TaskExecutionProductionProviderConformanceStatusRequest,
  ) =>
    | TaskExecutionProductionProviderConformanceObservation
    | Promise<TaskExecutionProductionProviderConformanceObservation>;
  readonly replayResult: (
    request: TaskExecutionProductionProviderConformanceReplayRequest,
  ) =>
    | TaskExecutionProductionProviderConformanceObservation
    | Promise<TaskExecutionProductionProviderConformanceObservation>;
}

export interface TaskExecutionProductionProviderConformanceInput {
  readonly subject: TaskExecutionProductionProviderConformanceSubject;
  readonly preparedDispatch: TaskExecutionProductionPreparedDispatch;
  readonly alternatePreparedDispatch: TaskExecutionProductionPreparedDispatch;
  readonly forbiddenValues?: readonly string[];
  readonly forbiddenOwnershipToken?: string;
  readonly taskOrModelCapabilityClaims?: unknown;
  readonly providerOutputCapabilityClaims?: unknown;
}

export interface TaskExecutionProductionProviderConformanceResult {
  readonly ok: boolean;
  readonly subjectId: string;
  readonly contractConformant: boolean;
  readonly idempotencyProven: boolean;
  readonly duplicateSuppressionProven: boolean;
  readonly providerReferenceProven: boolean;
  readonly lookupProven: boolean;
  readonly statusQueryProven: boolean;
  readonly resultReplayProven: boolean;
  readonly crashRecoveryProven: boolean;
  readonly blindRetryPrevented: boolean;
  readonly secretSafe: boolean;
  readonly ownershipSecretSafe: boolean;
  readonly productionExecutionEnabled: false;
  readonly ProductionExecutionEnabled: false;
  readonly FirstCallProviderRecoveryReady: boolean;
  readonly sideEffectCount: number;
  readonly duplicateSideEffectCount: number;
  readonly differentKeySideEffectCount: number;
  readonly providerInvocationRef: string | null;
  readonly evidence: {
    readonly success: TaskExecutionInvocationProviderReconciliationEvidence | null;
    readonly failure: TaskExecutionInvocationProviderReconciliationEvidence | null;
    readonly inProgress: TaskExecutionInvocationProviderReconciliationEvidence | null;
    readonly notFound: TaskExecutionInvocationProviderReconciliationEvidence | null;
    readonly unavailable: TaskExecutionInvocationProviderReconciliationEvidence | null;
  };
  readonly safety: {
    readonly networkCalled: false;
    readonly httpCalled: false;
    readonly vendorSdkCalled: false;
    readonly productionDispatchEnabled: false;
    readonly blindRetryPerformed: false;
    readonly replayPerformedExternalSideEffect: false;
    readonly providerSuccessCompletesWork: false;
    readonly providerOutputGrantsRetryAuthority: false;
  };
  readonly issues: readonly TaskExecutionProductionProviderConformanceIssue[];
}

function issue(input: {
  readonly code: string;
  readonly message: string;
  readonly category?: AeosError["category"];
  readonly severity?: "error" | "warning";
}): TaskExecutionProductionProviderConformanceIssue {
  return {
    code: input.code,
    message: input.message,
    category: input.category ?? "validation",
    severity: input.severity ?? "error",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canonicalKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function hasForbiddenKey(value: unknown, keys: ReadonlySet<string>): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => hasForbiddenKey(item, keys));
  }

  if (!isRecord(value)) {
    return false;
  }

  return Object.entries(value).some(
    ([key, item]) => keys.has(canonicalKey(key)) || hasForbiddenKey(item, keys),
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

const forbiddenAuthorityKeys = new Set<string>([
  "completed",
  "verified",
  "approved",
  "alldone",
  "taskcompleted",
  "policyauthorized",
  "safetoretry",
  "supportsidempotencykey",
  "supportslookupbyidempotencykey",
  "supportsinvocationstatusquery",
  "supportsresultreplay",
]);

const forbiddenSecretKeys = new Set<string>([
  "apikey",
  "token",
  "accesstoken",
  "refreshtoken",
  "secret",
  "password",
  "authorization",
  "ownershiptoken",
  "locktoken",
]);

function dispatchRequestFromPrepared(input: {
  readonly preparedDispatch: TaskExecutionProductionPreparedDispatch;
  readonly scenario: TaskExecutionProductionProviderConformanceScenario;
}): TaskExecutionProductionProviderConformanceDispatchRequest {
  return {
    scenario: input.scenario,
    invocationId: input.preparedDispatch.invocationId,
    idempotencyKey: input.preparedDispatch.idempotencyKey,
    taskId: input.preparedDispatch.taskId,
    sourceTaskRevision: input.preparedDispatch.sourceTaskRevision,
    attemptId: input.preparedDispatch.attemptId,
    attemptNumber: input.preparedDispatch.attemptNumber,
    providerRef: input.preparedDispatch.provider.providerRef,
    operationClass: input.preparedDispatch.provider.operationClass,
    normalizedInput: input.preparedDispatch.normalizedRequest.input,
    credentialRef: input.preparedDispatch.credentialRef,
    credentialScope: input.preparedDispatch.credentialScope,
  };
}

function evidenceFromObservation(input: {
  readonly observation: TaskExecutionProductionProviderConformanceObservation;
  readonly idempotencyKey: string;
}): TaskExecutionInvocationProviderReconciliationEvidence {
  const observedAt = "1970-01-01T00:00:00.000Z";

  if (input.observation.status === "returned") {
    return {
      kind: "provider_returned",
      idempotencyKey: input.idempotencyKey,
      invocationOk: input.observation.invocationOk === true,
      output: input.observation.output,
      resultReference: input.observation.resultReference,
      diagnosticCode: input.observation.diagnosticCode,
      message: input.observation.message,
      metadata: input.observation.metadata,
      observedAt,
    };
  }

  if (input.observation.status === "failed") {
    return {
      kind: "provider_failed",
      idempotencyKey: input.idempotencyKey,
      failureCode:
        input.observation.failureCode ??
        "task_execution_provider_conformance_failed",
      failureCategory: input.observation.failureCategory ?? "execution_failure",
      retryable: input.observation.retryable === true,
      diagnostic: input.observation.diagnostic,
      observedAt,
    };
  }

  if (input.observation.status === "in_progress") {
    return {
      kind: "provider_in_progress",
      idempotencyKey: input.idempotencyKey,
      observedAt,
    };
  }

  if (input.observation.status === "not_found") {
    return {
      kind: "provider_not_found",
      idempotencyKey: input.idempotencyKey,
      observedAt,
    };
  }

  return {
    kind: "provider_status_unavailable",
    observedAt,
  };
}

function statusIsOutcome(status: TaskExecutionProductionProviderConformanceStatus): boolean {
  return status === "returned" || status === "failed" || status === "in_progress";
}

async function observe(input: {
  readonly operationName: string;
  readonly idempotencyKey: string;
  readonly issues: TaskExecutionProductionProviderConformanceIssue[];
  readonly operation: () =>
    | TaskExecutionProductionProviderConformanceObservation
    | Promise<TaskExecutionProductionProviderConformanceObservation>;
}): Promise<TaskExecutionProductionProviderConformanceObservation> {
  try {
    return await input.operation();
  } catch {
    input.issues.push(
      issue({
        code: "task_execution_production_provider_conformance_subject_unavailable",
        message:
          "Provider conformance subject operation was unavailable; raw error text is not authoritative.",
        category: "unknown",
      }),
    );

    return {
      status: "unavailable",
      lookupIdempotencyKey: input.idempotencyKey,
      sideEffectCount: 0,
    };
  }
}

function sameProviderRef(
  left: TaskExecutionProductionProviderConformanceObservation,
  right: TaskExecutionProductionProviderConformanceObservation,
): boolean {
  return (
    left.providerInvocationRef !== undefined &&
    right.providerInvocationRef !== undefined &&
    left.providerInvocationRef === right.providerInvocationRef
  );
}

function result(input: {
  readonly subjectId: string;
  readonly idempotencyProven: boolean;
  readonly duplicateSuppressionProven: boolean;
  readonly providerReferenceProven: boolean;
  readonly lookupProven: boolean;
  readonly statusQueryProven: boolean;
  readonly resultReplayProven: boolean;
  readonly crashRecoveryProven: boolean;
  readonly blindRetryPrevented: boolean;
  readonly secretSafe?: boolean;
  readonly ownershipSecretSafe?: boolean;
  readonly sideEffectCount?: number;
  readonly duplicateSideEffectCount?: number;
  readonly differentKeySideEffectCount?: number;
  readonly providerInvocationRef?: string | null;
  readonly evidence?: TaskExecutionProductionProviderConformanceResult["evidence"];
  readonly issues: readonly TaskExecutionProductionProviderConformanceIssue[];
}): TaskExecutionProductionProviderConformanceResult {
  const errorFree = input.issues.every((item) => item.severity !== "error");
  const contractConformant =
    errorFree &&
    input.idempotencyProven &&
    input.duplicateSuppressionProven &&
    input.providerReferenceProven &&
    input.lookupProven &&
    input.statusQueryProven &&
    input.resultReplayProven &&
    input.crashRecoveryProven &&
    input.blindRetryPrevented &&
    input.secretSafe !== false &&
    input.ownershipSecretSafe !== false &&
    TASK_EXECUTION_ADAPTER_PRODUCTION_EXECUTION_ENABLED === false;

  return {
    ok: contractConformant,
    subjectId: input.subjectId,
    contractConformant,
    idempotencyProven: input.idempotencyProven,
    duplicateSuppressionProven: input.duplicateSuppressionProven,
    providerReferenceProven: input.providerReferenceProven,
    lookupProven: input.lookupProven,
    statusQueryProven: input.statusQueryProven,
    resultReplayProven: input.resultReplayProven,
    crashRecoveryProven: input.crashRecoveryProven,
    blindRetryPrevented: input.blindRetryPrevented,
    secretSafe: input.secretSafe !== false,
    ownershipSecretSafe: input.ownershipSecretSafe !== false,
    productionExecutionEnabled: TASK_EXECUTION_ADAPTER_PRODUCTION_EXECUTION_ENABLED,
    ProductionExecutionEnabled: TASK_EXECUTION_ADAPTER_PRODUCTION_EXECUTION_ENABLED,
    FirstCallProviderRecoveryReady: contractConformant,
    sideEffectCount: input.sideEffectCount ?? 0,
    duplicateSideEffectCount: input.duplicateSideEffectCount ?? 0,
    differentKeySideEffectCount: input.differentKeySideEffectCount ?? 0,
    providerInvocationRef: input.providerInvocationRef ?? null,
    evidence: input.evidence ?? {
      success: null,
      failure: null,
      inProgress: null,
      notFound: null,
      unavailable: null,
    },
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
    issues: input.issues,
  };
}

export async function evaluateTaskExecutionProductionProviderConformance(
  input: TaskExecutionProductionProviderConformanceInput,
): Promise<TaskExecutionProductionProviderConformanceResult> {
  const issues: TaskExecutionProductionProviderConformanceIssue[] = [];
  const capabilities = input.subject.capabilityProfile;

  if (capabilities.capabilityAuthority !== "system") {
    issues.push(
      issue({
        code: "task_execution_production_provider_conformance_capability_authority_invalid",
        message:
          "Provider conformance capability profile must be system-owned.",
      }),
    );
  }

  for (const [field, code] of [
    ["supportsIdempotencyKey", "task_execution_production_provider_conformance_idempotency_missing"],
    [
      "supportsLookupByIdempotencyKey",
      "task_execution_production_provider_conformance_lookup_missing",
    ],
    [
      "supportsInvocationStatusQuery",
      "task_execution_production_provider_conformance_status_missing",
    ],
    ["supportsResultReplay", "task_execution_production_provider_conformance_replay_missing"],
    [
      "providesDeterministicProviderInvocationReference",
      "task_execution_production_provider_conformance_provider_ref_missing",
    ],
  ] as const) {
    if (capabilities[field] !== true) {
      issues.push(
        issue({
          code,
          message:
            "Provider conformance requires this recovery capability to be proven, not merely asserted by prose.",
          category: "conflict",
        }),
      );
    }
  }

  if (input.taskOrModelCapabilityClaims !== undefined) {
    issues.push(
      issue({
        code: "task_execution_production_provider_conformance_task_model_claims_ignored",
        message:
          "Task/model provider capability claims are ignored for conformance authority.",
        severity: "warning",
      }),
    );
  }

  if (input.providerOutputCapabilityClaims !== undefined) {
    issues.push(
      issue({
        code: "task_execution_production_provider_conformance_provider_claims_ignored",
        message:
          "Provider output cannot grant idempotency, lookup, status, replay, retry, policy, verifier, or completion authority.",
        severity: "warning",
      }),
    );
  }

  if (input.preparedDispatch.productionExecutionEnabled !== false) {
    issues.push(
      issue({
        code: "task_execution_production_provider_conformance_execution_enabled",
        message:
          "Production execution must remain globally disabled during provider conformance.",
        category: "permission",
      }),
    );
  }

  if (
    input.preparedDispatch.idempotencyKey ===
    input.alternatePreparedDispatch.idempotencyKey
  ) {
    issues.push(
      issue({
        code: "task_execution_production_provider_conformance_alternate_key_missing",
        message:
          "Conformance requires a second prepared dispatch with a different AEOS idempotency key.",
      }),
    );
  }

  const successDispatch = await observe({
    operationName: "dispatch",
    idempotencyKey: input.preparedDispatch.idempotencyKey,
    issues,
    operation: () =>
      input.subject.dispatch(
        dispatchRequestFromPrepared({
          preparedDispatch: input.preparedDispatch,
          scenario: "success",
        }),
      ),
  });
  const duplicateDispatch = await observe({
    operationName: "dispatch",
    idempotencyKey: input.preparedDispatch.idempotencyKey,
    issues,
    operation: () =>
      input.subject.dispatch(
        dispatchRequestFromPrepared({
          preparedDispatch: input.preparedDispatch,
          scenario: "success",
        }),
      ),
  });
  const alternateDispatch = await observe({
    operationName: "dispatch",
    idempotencyKey: input.alternatePreparedDispatch.idempotencyKey,
    issues,
    operation: () =>
      input.subject.dispatch(
        dispatchRequestFromPrepared({
          preparedDispatch: input.alternatePreparedDispatch,
          scenario: "success",
        }),
      ),
  });

  const knownLookup = await observe({
    operationName: "lookupByIdempotencyKey",
    idempotencyKey: input.preparedDispatch.idempotencyKey,
    issues,
    operation: () =>
      input.subject.lookupByIdempotencyKey({
        scenario: "success",
        idempotencyKey: input.preparedDispatch.idempotencyKey,
        providerInvocationRef: successDispatch.providerInvocationRef,
      }),
  });
  const unknownLookup = await observe({
    operationName: "lookupByIdempotencyKey",
    idempotencyKey: "aeos-conformance-unknown-key",
    issues,
    operation: () =>
      input.subject.lookupByIdempotencyKey({
        scenario: "never_accepted",
        idempotencyKey: "aeos-conformance-unknown-key",
      }),
  });
  const wrongLookup = await observe({
    operationName: "lookupByIdempotencyKey",
    idempotencyKey: `${input.preparedDispatch.idempotencyKey}-wrong`,
    issues,
    operation: () =>
      input.subject.lookupByIdempotencyKey({
        scenario: "never_accepted",
        idempotencyKey: `${input.preparedDispatch.idempotencyKey}-wrong`,
      }),
  });
  const mismatchLookup = await observe({
    operationName: "lookupByIdempotencyKey",
    idempotencyKey: input.preparedDispatch.idempotencyKey,
    issues,
    operation: () =>
      input.subject.lookupByIdempotencyKey({
        scenario: "success",
        idempotencyKey: input.preparedDispatch.idempotencyKey,
        providerInvocationRef: "provider-ref-mismatch",
      }),
  });

  const successStatus = await observe({
    operationName: "getInvocationStatus",
    idempotencyKey: input.preparedDispatch.idempotencyKey,
    issues,
    operation: () =>
      input.subject.getInvocationStatus({
        scenario: "success",
        idempotencyKey: input.preparedDispatch.idempotencyKey,
        providerInvocationRef: successDispatch.providerInvocationRef,
      }),
  });
  const failureDispatch = await observe({
    operationName: "dispatch",
    idempotencyKey: input.preparedDispatch.idempotencyKey,
    issues,
    operation: () =>
      input.subject.dispatch(
        dispatchRequestFromPrepared({
          preparedDispatch: input.preparedDispatch,
          scenario: "failure",
        }),
      ),
  });
  const failureStatus = await observe({
    operationName: "getInvocationStatus",
    idempotencyKey: input.preparedDispatch.idempotencyKey,
    issues,
    operation: () =>
      input.subject.getInvocationStatus({
        scenario: "failure",
        idempotencyKey: input.preparedDispatch.idempotencyKey,
        providerInvocationRef: failureDispatch.providerInvocationRef,
      }),
  });
  const inProgressDispatch = await observe({
    operationName: "dispatch",
    idempotencyKey: input.preparedDispatch.idempotencyKey,
    issues,
    operation: () =>
      input.subject.dispatch(
        dispatchRequestFromPrepared({
          preparedDispatch: input.preparedDispatch,
          scenario: "in_progress",
        }),
      ),
  });
  const inProgressStatus = await observe({
    operationName: "getInvocationStatus",
    idempotencyKey: input.preparedDispatch.idempotencyKey,
    issues,
    operation: () =>
      input.subject.getInvocationStatus({
        scenario: "in_progress",
        idempotencyKey: input.preparedDispatch.idempotencyKey,
        providerInvocationRef: inProgressDispatch.providerInvocationRef,
      }),
  });
  const unavailableStatus = await observe({
    operationName: "getInvocationStatus",
    idempotencyKey: input.preparedDispatch.idempotencyKey,
    issues,
    operation: () =>
      input.subject.getInvocationStatus({
        scenario: "status_unavailable",
        idempotencyKey: input.preparedDispatch.idempotencyKey,
        providerInvocationRef: successDispatch.providerInvocationRef,
      }),
  });

  const replayBeforeCount = successStatus.sideEffectCount;
  const replay = successDispatch.providerInvocationRef === undefined
    ? successStatus
    : await observe({
        operationName: "replayResult",
        idempotencyKey: input.preparedDispatch.idempotencyKey,
        issues,
        operation: () =>
          input.subject.replayResult({
            scenario: "success",
            idempotencyKey: input.preparedDispatch.idempotencyKey,
            providerInvocationRef: successDispatch.providerInvocationRef!,
          }),
      });
  const replayUnavailable = successDispatch.providerInvocationRef === undefined
    ? unavailableStatus
    : await observe({
        operationName: "replayResult",
        idempotencyKey: input.preparedDispatch.idempotencyKey,
        issues,
        operation: () =>
          input.subject.replayResult({
            scenario: "replay_unavailable",
            idempotencyKey: input.preparedDispatch.idempotencyKey,
            providerInvocationRef: successDispatch.providerInvocationRef!,
          }),
      });

  const acceptedStatuses = new Set<TaskExecutionProductionProviderConformanceStatus>([
    "accepted",
    "duplicate_replayed",
    "duplicate_rejected",
    "returned",
  ]);
  const idempotencyProven =
    input.preparedDispatch.idempotencyKey === successDispatch.receivedIdempotencyKey &&
    input.preparedDispatch.idempotencyKey === duplicateDispatch.receivedIdempotencyKey &&
    input.preparedDispatch.idempotencyKey === knownLookup.lookupIdempotencyKey;

  if (!idempotencyProven) {
    issues.push(
      issue({
        code: "task_execution_production_provider_conformance_idempotency_mismatch",
        message:
          "Prepared dispatch, provider dispatch, duplicate dispatch, and lookup did not use the exact AEOS idempotency key.",
      }),
    );
  }

  const duplicateSuppressionProven =
    acceptedStatuses.has(successDispatch.status) &&
    duplicateDispatch.sideEffectCount === 1 &&
    (sameProviderRef(successDispatch, duplicateDispatch) ||
      duplicateDispatch.status === "duplicate_rejected");

  if (!duplicateSuppressionProven) {
    issues.push(
      issue({
        code: "task_execution_production_provider_conformance_duplicate_side_effect",
        message:
          "Duplicate same-key dispatch produced an unsafe independent provider side effect or unstable invocation identity.",
        category: "conflict",
      }),
    );
  }

  const providerReferenceProven =
    successDispatch.providerInvocationRefBeforeAcceptance === undefined &&
    typeof successDispatch.providerInvocationRef === "string" &&
    successDispatch.providerInvocationRef.length > 0 &&
    successDispatch.providerInvocationRef === knownLookup.providerInvocationRef &&
    successDispatch.providerInvocationRef === successStatus.providerInvocationRef &&
    alternateDispatch.providerInvocationRef !== successDispatch.providerInvocationRef;

  if (!providerReferenceProven) {
    issues.push(
      issue({
        code: "task_execution_production_provider_conformance_provider_ref_unstable",
        message:
          "Provider invocation reference was missing before/after acceptance, unstable, AEOS-invented, or not bound to the idempotency key.",
        category: "conflict",
      }),
    );
  }

  const lookupProven =
    knownLookup.status !== "not_found" &&
    knownLookup.status !== "unavailable" &&
    knownLookup.lookupIdempotencyKey === input.preparedDispatch.idempotencyKey &&
    unknownLookup.status === "not_found" &&
    wrongLookup.status === "not_found" &&
    mismatchLookup.status === "unavailable";

  if (!lookupProven) {
    issues.push(
      issue({
        code: "task_execution_production_provider_conformance_lookup_unproven",
        message:
          "Lookup by idempotency key did not prove known, unknown, wrong-key, and mismatched-ref behavior.",
        category: "conflict",
      }),
    );
  }

  const statusQueryProven =
    successStatus.status === "returned" &&
    failureStatus.status === "failed" &&
    inProgressStatus.status === "in_progress" &&
    unavailableStatus.status === "unavailable";

  if (!statusQueryProven) {
    issues.push(
      issue({
        code: "task_execution_production_provider_conformance_status_unproven",
        message:
          "Status query did not normalize returned, failed, in-progress, and unavailable states.",
        category: "conflict",
      }),
    );
  }

  const resultReplayProven =
    replay.status === "returned" &&
    replay.sideEffectCount === replayBeforeCount &&
    JSON.stringify(replay.output ?? null) ===
      JSON.stringify(successStatus.output ?? null) &&
    replayUnavailable.status === "unavailable";

  if (!resultReplayProven) {
    issues.push(
      issue({
        code: "task_execution_production_provider_conformance_replay_unproven",
        message:
          "Result replay did not return durable outcome evidence without a new side effect or did not preserve ambiguity on replay failure.",
        category: "conflict",
      }),
    );
  }

  const crashRecoveryProven =
    successStatus.status === "returned" &&
    failureStatus.status === "failed" &&
    inProgressStatus.status === "in_progress" &&
    unknownLookup.status === "not_found" &&
    successStatus.sideEffectCount === replay.sideEffectCount &&
    failureStatus.sideEffectCount === failureDispatch.sideEffectCount &&
    inProgressStatus.sideEffectCount === inProgressDispatch.sideEffectCount;

  if (!crashRecoveryProven) {
    issues.push(
      issue({
        code: "task_execution_production_provider_conformance_crash_recovery_unproven",
        message:
          "Crash recovery did not recover through lookup/status/replay evidence while preserving ambiguous states.",
        category: "conflict",
      }),
    );
  }

  const blindRetryPrevented =
    successDispatch.sideEffectCount === replay.sideEffectCount &&
    failureDispatch.sideEffectCount === failureStatus.sideEffectCount &&
    inProgressDispatch.sideEffectCount === inProgressStatus.sideEffectCount &&
    unknownLookup.status === "not_found" &&
    !statusIsOutcome(unknownLookup.status);

  if (!blindRetryPrevented) {
    issues.push(
      issue({
        code: "task_execution_production_provider_conformance_blind_retry_detected",
        message:
          "Recovery behavior performed or authorized a blind redispatch instead of bounded reconciliation.",
        category: "conflict",
      }),
    );
  }

  if (
    hasForbiddenKey(successStatus.output, forbiddenAuthorityKeys) ||
    hasForbiddenKey(successStatus.metadata, forbiddenAuthorityKeys)
  ) {
    issues.push(
      issue({
        code: "task_execution_production_provider_conformance_hostile_output_diagnostic_only",
        message:
          "Provider output carried hostile completion, verification, approval, retry, or capability claims; conformance keeps them diagnostic only.",
        severity: "warning",
      }),
    );
  }

  const partial = result({
    subjectId: input.subject.subjectId,
    idempotencyProven,
    duplicateSuppressionProven,
    providerReferenceProven,
    lookupProven,
    statusQueryProven,
    resultReplayProven,
    crashRecoveryProven,
    blindRetryPrevented,
    sideEffectCount: successDispatch.sideEffectCount,
    duplicateSideEffectCount: duplicateDispatch.sideEffectCount,
    differentKeySideEffectCount: alternateDispatch.sideEffectCount,
    providerInvocationRef: successDispatch.providerInvocationRef ?? null,
    evidence: {
      success: evidenceFromObservation({
        observation: successStatus,
        idempotencyKey: input.preparedDispatch.idempotencyKey,
      }),
      failure: evidenceFromObservation({
        observation: failureStatus,
        idempotencyKey: input.preparedDispatch.idempotencyKey,
      }),
      inProgress: evidenceFromObservation({
        observation: inProgressStatus,
        idempotencyKey: input.preparedDispatch.idempotencyKey,
      }),
      notFound: evidenceFromObservation({
        observation: unknownLookup,
        idempotencyKey: input.preparedDispatch.idempotencyKey,
      }),
      unavailable: evidenceFromObservation({
        observation: unavailableStatus,
        idempotencyKey: input.preparedDispatch.idempotencyKey,
      }),
    },
    issues,
  });

  const resultJson = JSON.stringify(partial);
  const secretSafe =
    !containsForbiddenValue({
      value: partial,
      forbiddenValues: input.forbiddenValues ?? [],
    }) && !hasForbiddenKey(partial, forbiddenSecretKeys);
  const ownershipSecretSafe =
    input.forbiddenOwnershipToken === undefined ||
    !resultJson.includes(input.forbiddenOwnershipToken);

  const safetyIssues: TaskExecutionProductionProviderConformanceIssue[] = [];

  if (!secretSafe) {
    safetyIssues.push(
      issue({
        code: "task_execution_production_provider_conformance_secret_leak",
        message:
          "Provider conformance result exposed forbidden credential material.",
      }),
    );
  }

  if (!ownershipSecretSafe) {
    safetyIssues.push(
      issue({
        code: "task_execution_production_provider_conformance_ownership_secret_leak",
        message:
          "Provider conformance result exposed invocation ownership authority.",
      }),
    );
  }

  return result({
    ...partial,
    secretSafe,
    ownershipSecretSafe,
    issues: [...issues, ...safetyIssues],
  });
}
