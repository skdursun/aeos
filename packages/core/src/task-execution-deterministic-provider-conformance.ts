import type {
  TaskExecutionProductionProviderConformanceDispatchRequest,
  TaskExecutionProductionProviderConformanceLookupRequest,
  TaskExecutionProductionProviderConformanceObservation,
  TaskExecutionProductionProviderConformanceReplayRequest,
  TaskExecutionProductionProviderConformanceStatusRequest,
  TaskExecutionProductionProviderConformanceSubject,
  TaskExecutionProductionProviderConformanceStatus,
} from "./task-execution-production-provider-conformance.js";
import type { JsonObject } from "./types.js";

export interface DeterministicProviderRecoveryInvocationFixture {
  readonly idempotencyKey: string;
  readonly providerInvocationRef: string;
  readonly status: TaskExecutionProductionProviderConformanceStatus;
  readonly resultReference: string;
  readonly output?: JsonObject;
  readonly message?: string;
  readonly failureCode?: string;
  readonly sideEffectCount: number;
}

export interface DeterministicProviderRecoveryFixtureOptions {
  readonly subjectId?: string;
  readonly dispatchReturnsMismatchedIdempotencyKey?: boolean;
  readonly lookupOmitsIdempotencyKey?: boolean;
  readonly lookupReturnsAmbiguousMatches?: boolean;
  readonly lookupUnavailable?: boolean;
  readonly statusUnavailable?: boolean;
  readonly replayUnavailable?: boolean;
  readonly replayCausesSideEffect?: boolean;
}

export interface DeterministicProviderRecoveryFixture {
  readonly subject: TaskExecutionProductionProviderConformanceSubject;
  readonly calls: {
    readonly dispatchInvocations: DeterministicProviderDispatchCall[];
    readonly lookupInvocations: DeterministicProviderLookupCall[];
    readonly statusQueries: DeterministicProviderStatusCall[];
    readonly replayReads: DeterministicProviderReplayCall[];
  };
  readonly invocationsByScenarioAndKey: Map<
    string,
    DeterministicProviderRecoveryInvocationFixture
  >;
}

export interface DeterministicProviderDispatchCall {
  readonly idempotencyKey: string;
  readonly invocationName: string;
  readonly payloadReference: string;
  readonly resultReference: string;
}

export interface DeterministicProviderLookupCall {
  readonly idempotencyKey: string;
}

export interface DeterministicProviderStatusCall {
  readonly providerInvocationRef: string;
}

export interface DeterministicProviderReplayCall {
  readonly providerInvocationRef: string;
  readonly resultReference: string;
}

export const DETERMINISTIC_PROVIDER_RECOVERY_PROFILE = {
  providerFamilyRef: "deterministic-provider-fixture",
  providerRef: "deterministic-provider-recovery-fixture",
  createOperation: "dispatchInvocation",
  idempotencyRequestField: "idempotencyKey",
  providerInvocationReferenceField: "providerInvocationRef",
  recoveryLookupOperation: "lookupInvocationByIdempotencyKey",
  recoveryLookupEvidenceField: "idempotencyKey",
  statusOperation: "getInvocationStatus",
  durableResultLocation: "resultReference",
  realCallReady: false,
  productionExecutionEnabled: false,
} as const;

function keyFor(scenario: string, idempotencyKey: string): string {
  return `${scenario}:${idempotencyKey}`;
}

function providerInvocationRefFor(
  scenario: string,
  idempotencyKey: string,
): string {
  return `deterministic-provider-invocation:${scenario}:${idempotencyKey.slice(
    -24,
  )}`;
}

function resultReferenceFor(idempotencyKey: string): string {
  return `deterministic-provider-result:${idempotencyKey}`;
}

function statusForScenario(
  scenario: TaskExecutionProductionProviderConformanceDispatchRequest["scenario"],
): TaskExecutionProductionProviderConformanceStatus {
  if (scenario === "failure") {
    return "failed";
  }

  if (scenario === "in_progress") {
    return "in_progress";
  }

  return "returned";
}

function createInvocation(input: {
  readonly request: TaskExecutionProductionProviderConformanceDispatchRequest;
  readonly idempotencyKey: string;
}): DeterministicProviderRecoveryInvocationFixture {
  const providerInvocationRef = providerInvocationRefFor(
    input.request.scenario,
    input.idempotencyKey,
  );
  const resultReference = resultReferenceFor(input.idempotencyKey);
  return {
    idempotencyKey: input.idempotencyKey,
    providerInvocationRef,
    status: statusForScenario(input.request.scenario),
    resultReference,
    output: {
      recordId: input.request.invocationId,
      modelInput: {
        taskId: input.request.taskId,
        attemptId: input.request.attemptId,
      },
      providerOutput: {
        invocationEvidenceOnly: true,
        providerInvocationRef,
        resultReference,
        completed: true,
        verified: true,
        safeToRetry: true,
        policyAuthorized: true,
      },
    },
    failureCode: "deterministic_provider_invocation_failed",
    message: "TEST deterministic provider invocation evidence.",
    sideEffectCount: 1,
  };
}

function unavailable(
  idempotencyKey: string,
  sideEffectCount = 0,
): TaskExecutionProductionProviderConformanceObservation {
  return {
    status: "unavailable",
    lookupIdempotencyKey: idempotencyKey,
    sideEffectCount,
  };
}

function notFound(
  idempotencyKey: string,
): TaskExecutionProductionProviderConformanceObservation {
  return {
    status: "not_found",
    lookupIdempotencyKey: idempotencyKey,
    sideEffectCount: 0,
  };
}

function observationFromInvocation(input: {
  readonly invocation: DeterministicProviderRecoveryInvocationFixture;
  readonly status?: TaskExecutionProductionProviderConformanceStatus;
}): TaskExecutionProductionProviderConformanceObservation {
  const status = input.status ?? input.invocation.status;
  const base = {
    status,
    receivedIdempotencyKey: input.invocation.idempotencyKey,
    lookupIdempotencyKey: input.invocation.idempotencyKey,
    providerInvocationRef: input.invocation.providerInvocationRef,
    resultReference: input.invocation.resultReference,
    sideEffectCount: input.invocation.sideEffectCount,
    metadata: {
      deterministicProvider: {
        idempotencyKey: input.invocation.idempotencyKey,
        providerInvocationRef: input.invocation.providerInvocationRef,
        status: input.invocation.status,
        resultReference: input.invocation.resultReference,
      },
    },
  } satisfies TaskExecutionProductionProviderConformanceObservation;

  if (status === "returned") {
    return {
      ...base,
      invocationOk: true,
      output: input.invocation.output,
      diagnosticCode: "deterministic_provider_invocation_returned",
      message: input.invocation.message,
    };
  }

  if (status === "failed") {
    return {
      ...base,
      failureCode: input.invocation.failureCode,
      failureCategory: "adapter_failure",
      retryable: false,
      diagnostic: input.invocation.message,
    };
  }

  return base;
}

export function createDeterministicProviderRecoveryConformanceSubject(
  options: DeterministicProviderRecoveryFixtureOptions = {},
): DeterministicProviderRecoveryFixture {
  const invocationsByScenarioAndKey = new Map<
    string,
    DeterministicProviderRecoveryInvocationFixture
  >();
  const calls: DeterministicProviderRecoveryFixture["calls"] = {
    dispatchInvocations: [],
    lookupInvocations: [],
    statusQueries: [],
    replayReads: [],
  };

  function findByKey(
    scenario: string,
    idempotencyKey: string,
  ): readonly DeterministicProviderRecoveryInvocationFixture[] {
    const invocation = invocationsByScenarioAndKey.get(
      keyFor(scenario, idempotencyKey),
    );
    if (invocation === undefined) {
      return [];
    }

    if (options.lookupReturnsAmbiguousMatches === true) {
      return [
        invocation,
        {
          ...invocation,
          providerInvocationRef: `${invocation.providerInvocationRef}:ambiguous`,
        },
      ];
    }

    return [invocation];
  }

  function authoritativeLookup(
    request: TaskExecutionProductionProviderConformanceLookupRequest,
  ): TaskExecutionProductionProviderConformanceObservation {
    calls.lookupInvocations.push({
      idempotencyKey: request.idempotencyKey,
    });

    if (options.lookupUnavailable === true) {
      return unavailable(request.idempotencyKey);
    }

    const matches = findByKey(request.scenario, request.idempotencyKey).filter(
      (invocation) =>
        options.lookupOmitsIdempotencyKey !== true &&
        invocation.idempotencyKey === request.idempotencyKey,
    );

    if (matches.length === 0) {
      return notFound(request.idempotencyKey);
    }

    if (matches.length !== 1) {
      return unavailable(request.idempotencyKey, matches[0].sideEffectCount);
    }

    const invocation = matches[0];
    if (
      request.providerInvocationRef !== undefined &&
      request.providerInvocationRef !== invocation.providerInvocationRef
    ) {
      return unavailable(request.idempotencyKey, invocation.sideEffectCount);
    }

    return observationFromInvocation({ invocation, status: "accepted" });
  }

  function getInvocationStatus(
    request: TaskExecutionProductionProviderConformanceStatusRequest,
  ): TaskExecutionProductionProviderConformanceObservation {
    if (request.scenario === "status_unavailable") {
      calls.statusQueries.push({
        providerInvocationRef: request.providerInvocationRef ?? "",
      });
      const matchingInvocation = [...invocationsByScenarioAndKey.values()].find(
        (invocation) =>
          invocation.providerInvocationRef === request.providerInvocationRef,
      );
      return unavailable(
        request.idempotencyKey,
        matchingInvocation?.sideEffectCount ?? 0,
      );
    }

    const lookup = authoritativeLookup(request);
    if (lookup.status === "not_found" || lookup.status === "unavailable") {
      return lookup;
    }

    calls.statusQueries.push({
      providerInvocationRef: lookup.providerInvocationRef ?? "",
    });

    const invocation = invocationsByScenarioAndKey.get(
      keyFor(request.scenario, request.idempotencyKey),
    );
    if (invocation === undefined) {
      return notFound(request.idempotencyKey);
    }

    if (options.statusUnavailable === true) {
      return unavailable(request.idempotencyKey, invocation.sideEffectCount);
    }

    return observationFromInvocation({ invocation });
  }

  return {
    subject: {
      subjectId:
        options.subjectId ?? "deterministic-provider-recovery-conformance-test",
      capabilityProfile: {
        capabilityAuthority: "system",
        supportsIdempotencyKey: true,
        supportsLookupByIdempotencyKey: true,
        supportsInvocationStatusQuery: true,
        supportsResultReplay: true,
        providesDeterministicProviderInvocationReference: true,
      },
      dispatch(request) {
        if (request.scenario === "never_accepted") {
          return notFound(request.idempotencyKey);
        }

        const idempotencyKey =
          options.dispatchReturnsMismatchedIdempotencyKey === true
            ? `${request.idempotencyKey}Different`
            : request.idempotencyKey;
        calls.dispatchInvocations.push({
          idempotencyKey,
          invocationName: `aeos-${request.invocationId.slice(-24)}`,
          payloadReference: `payload:${request.invocationId}`,
          resultReference: resultReferenceFor(idempotencyKey),
        });

        const key = keyFor(request.scenario, idempotencyKey);
        const existing = invocationsByScenarioAndKey.get(key);
        if (existing !== undefined) {
          return observationFromInvocation({
            invocation: existing,
            status: "duplicate_replayed",
          });
        }

        const invocation = createInvocation({ request, idempotencyKey });
        invocationsByScenarioAndKey.set(key, invocation);
        return {
          ...observationFromInvocation({ invocation, status: "accepted" }),
          providerInvocationRefBeforeAcceptance: undefined,
        };
      },
      lookupByIdempotencyKey(request) {
        return authoritativeLookup(request);
      },
      getInvocationStatus(request) {
        return getInvocationStatus(request);
      },
      replayResult(request) {
        const invocation = invocationsByScenarioAndKey.get(
          keyFor("success", request.idempotencyKey),
        );
        if (invocation === undefined) {
          return notFound(request.idempotencyKey);
        }

        if (request.providerInvocationRef !== invocation.providerInvocationRef) {
          return unavailable(request.idempotencyKey, invocation.sideEffectCount);
        }

        calls.statusQueries.push({
          providerInvocationRef: invocation.providerInvocationRef,
        });

        if (invocation.status !== "returned") {
          return observationFromInvocation({ invocation });
        }

        calls.replayReads.push({
          providerInvocationRef: invocation.providerInvocationRef,
          resultReference: invocation.resultReference,
        });

        if (
          options.replayUnavailable === true ||
          request.scenario === "replay_unavailable"
        ) {
          return unavailable(request.idempotencyKey, invocation.sideEffectCount);
        }

        if (options.replayCausesSideEffect === true) {
          const updated = {
            ...invocation,
            sideEffectCount: invocation.sideEffectCount + 1,
          };
          invocationsByScenarioAndKey.set(
            keyFor("success", request.idempotencyKey),
            updated,
          );
          return observationFromInvocation({ invocation: updated });
        }

        return observationFromInvocation({ invocation });
      },
    },
    calls,
    invocationsByScenarioAndKey,
  };
}
