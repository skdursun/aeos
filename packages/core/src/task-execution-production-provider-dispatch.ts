import type {
  TaskExecutionProductionPreparedDispatch,
} from "./task-execution-production-adapter.js";
import type {
  TaskExecutionProductionDispatchAuthorizationResult,
} from "./task-execution-production-dispatch.js";
import {
  TASK_EXECUTION_PRODUCTION_DISPATCH_BOUNDARY,
} from "./task-execution-production-dispatch.js";
import type {
  TaskExecutionInvocationRecord,
} from "./task-execution-invocation-record.js";
import {
  validateTaskExecutionInvocationRecord,
} from "./task-execution-invocation-record.js";
import {
  updateTaskExecutionInvocation,
} from "./task-execution-invocation-persistence.js";
import {
  appendTaskExecutionAuditEvent,
} from "./task-execution-audit-persistence.js";
import {
  createTaskExecutionInvocationFailedAuditEvent,
  createTaskExecutionInvocationOutcomeUnknownAuditEvent,
  createTaskExecutionInvocationReturnedAuditEvent,
} from "./task-execution-audit.js";
import type { AeosError, JsonObject, JsonValue } from "./types.js";

export interface TaskExecutionProductionOneShotDispatchAuthority {
  readonly authority: "system_operator";
  readonly purpose: "one_shot_production_dispatch";
  readonly operatorInitiated: true;
  readonly taskId: string;
  readonly taskRevision: number;
  readonly attemptId: string;
  readonly invocationId: string;
  readonly invocationRevision: number;
  readonly idempotencyKey: string;
  readonly adapterId: string;
  readonly providerRef: string;
  readonly operation: "execute_task_attempt";
  readonly boundary: typeof TASK_EXECUTION_PRODUCTION_DISPATCH_BOUNDARY;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly nonce: string;
  readonly consumed: false;
}

export interface TaskExecutionProductionEphemeralCredential {
  readonly kind: string;
  readonly value: string;
  readonly resolutionReference: string;
}

export interface TaskExecutionProductionProviderDispatchRequest {
  readonly preparedDispatch: TaskExecutionProductionPreparedDispatch;
  readonly idempotencyKey: string;
  readonly providerRef: string;
  readonly credential?: TaskExecutionProductionEphemeralCredential;
  readonly input?: JsonValue;
  readonly inputReference?: string;
}

export type TaskExecutionProductionProviderDispatchTransportResult =
  | {
      readonly status: "returned";
      readonly providerInvocationRef: string;
      readonly output?: JsonValue;
      readonly outputReference?: string;
      readonly diagnosticCode?: string;
      readonly message?: string;
      readonly metadata?: JsonObject;
      readonly observedAt?: string;
    }
  | {
      readonly status: "failed";
      readonly providerInvocationRef?: string;
      readonly code: string;
      readonly category:
        | "adapter_failure"
        | "execution_failure"
        | "policy_failure"
        | "audit_failure"
        | "unknown";
      readonly retryable: false;
      readonly diagnostic?: string;
      readonly observedAt?: string;
    }
  | {
      readonly status: "outcome_unknown";
      readonly providerInvocationRef?: string;
      readonly code: string;
      readonly diagnostic?: string;
      readonly observedAt?: string;
    };

export interface TaskExecutionProductionProviderDispatchTransport {
  readonly dispatch: (
    request: TaskExecutionProductionProviderDispatchRequest,
  ) => Promise<TaskExecutionProductionProviderDispatchTransportResult>;
}

export interface TaskExecutionControlledHttpProductionProviderConfiguration {
  readonly authority: "system";
  readonly providerRef: string;
  readonly endpoint: string;
  readonly timeoutMs: number;
  readonly maxRequestBytes: number;
  readonly maxResponseBytes: number;
  readonly credentialMode: "none" | "authorization_bearer";
}

export interface TaskExecutionControlledHttpFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly headers: {
    readonly get: (name: string) => string | null;
  };
  readonly text: () => Promise<string>;
}

export type TaskExecutionControlledHttpFetch = (
  url: string,
  init: {
    readonly method: "POST";
    readonly redirect?: "error";
    readonly headers: Record<string, string>;
    readonly body: string;
  },
) => Promise<TaskExecutionControlledHttpFetchResponse>;

export interface CreateControlledHttpProductionProviderDispatchTransportInput {
  readonly configuration: TaskExecutionControlledHttpProductionProviderConfiguration;
  readonly fetch: TaskExecutionControlledHttpFetch;
}

export interface DispatchTaskExecutionProductionProviderInput {
  readonly projectRoot: string;
  readonly invocationRecord: unknown;
  readonly preparedDispatch: TaskExecutionProductionPreparedDispatch | null;
  readonly dispatchAuthorization: TaskExecutionProductionDispatchAuthorizationResult;
  readonly oneShotAuthority?: TaskExecutionProductionOneShotDispatchAuthority;
  readonly transport: TaskExecutionProductionProviderDispatchTransport;
  readonly credential?: TaskExecutionProductionEphemeralCredential;
  readonly forbiddenCredentialValues?: readonly string[];
  readonly occurredAt?: string;
}

export interface TaskExecutionProductionProviderDispatchIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: "error" | "warning";
  readonly category: AeosError["category"];
}

export interface TaskExecutionProductionProviderDispatchResult {
  readonly ok: boolean;
  readonly status:
    | "provider_dispatch_blocked"
    | "provider_returned"
    | "provider_failed"
    | "provider_outcome_unknown"
    | "outcome_persistence_failed";
  readonly providerCalled: boolean;
  readonly oneShotAuthorityConsumed: boolean;
  readonly invocationLifecycle: string | null;
  readonly invocationRevision: number | null;
  readonly providerInvocationRef: string | null;
  readonly reconciliationRequired: boolean;
  readonly postDispatchAuditWritten: boolean;
  readonly postDispatchAuditIncomplete: boolean;
  readonly automatedRealProviderCall: false;
  readonly productionCompletionReady: false;
  readonly safety: {
    readonly providerResultIsInvocationEvidenceOnly: true;
    readonly retryAttempted: false;
    readonly blindRedispatchAllowed: false;
    readonly workAccountingModified: false;
    readonly taskCompleted: false;
    readonly verifierRun: false;
    readonly completionProseTrusted: false;
    readonly rawSecretSerialized: false;
  };
  readonly issues: readonly TaskExecutionProductionProviderDispatchIssue[];
}

const authorityKeys = new Set<string>([
  "completed",
  "verified",
  "approved",
  "alldone",
  "safetoretry",
  "taskcompleted",
  "policyauthorized",
  "productionexecutionenabled",
  "completiongatesatisfied",
  "verifiersatisfied",
]);

function issue(input: {
  readonly code: string;
  readonly message: string;
  readonly category?: AeosError["category"];
  readonly severity?: "error" | "warning";
}): TaskExecutionProductionProviderDispatchIssue {
  return {
    code: input.code,
    message: input.message,
    category: input.category ?? "validation",
    severity: input.severity ?? "error",
  };
}

function result(input: {
  readonly ok: boolean;
  readonly status: TaskExecutionProductionProviderDispatchResult["status"];
  readonly providerCalled?: boolean;
  readonly oneShotAuthorityConsumed?: boolean;
  readonly invocationLifecycle?: string | null;
  readonly invocationRevision?: number | null;
  readonly providerInvocationRef?: string | null;
  readonly reconciliationRequired?: boolean;
  readonly postDispatchAuditWritten?: boolean;
  readonly postDispatchAuditIncomplete?: boolean;
  readonly issues: readonly TaskExecutionProductionProviderDispatchIssue[];
}): TaskExecutionProductionProviderDispatchResult {
  return {
    ok: input.ok,
    status: input.status,
    providerCalled: input.providerCalled ?? false,
    oneShotAuthorityConsumed: input.oneShotAuthorityConsumed ?? false,
    invocationLifecycle: input.invocationLifecycle ?? null,
    invocationRevision: input.invocationRevision ?? null,
    providerInvocationRef: input.providerInvocationRef ?? null,
    reconciliationRequired: input.reconciliationRequired ?? false,
    postDispatchAuditWritten: input.postDispatchAuditWritten ?? false,
    postDispatchAuditIncomplete: input.postDispatchAuditIncomplete ?? false,
    automatedRealProviderCall: false,
    productionCompletionReady: false,
    safety: {
      providerResultIsInvocationEvidenceOnly: true,
      retryAttempted: false,
      blindRedispatchAllowed: false,
      workAccountingModified: false,
      taskCompleted: false,
      verifierRun: false,
      completionProseTrusted: false,
      rawSecretSerialized: false,
    },
    issues: input.issues,
  };
}

function canonicalKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeText(
  value: string | undefined,
  forbiddenValues: readonly string[],
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return forbiddenValues.reduce(
    (current, forbidden) =>
      forbidden.length === 0 ? current : current.split(forbidden).join("[redacted]"),
    value,
  );
}

function sanitizeJsonValue(
  value: JsonValue | undefined,
  forbiddenValues: readonly string[],
): JsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "string") {
    return sanitizeText(value, forbiddenValues) ?? "";
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeJsonValue(item, forbiddenValues) ?? null);
  }

  const sanitized: Record<string, JsonValue> = {};
  for (const [key, item] of Object.entries(value)) {
    if (authorityKeys.has(canonicalKey(key))) {
      continue;
    }
    sanitized[key] = sanitizeJsonValue(item, forbiddenValues) ?? null;
  }
  return sanitized;
}

function sanitizeJsonObject(
  value: JsonObject | undefined,
  forbiddenValues: readonly string[],
): JsonObject | undefined {
  const sanitized = sanitizeJsonValue(value, forbiddenValues);
  return isJsonRecord(sanitized) ? sanitized as JsonObject : undefined;
}

function safeDiagnosticText(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0
    ? value.slice(0, 512)
    : undefined;
}

function isSafeHttpsEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.username === "" && url.password === "";
  } catch {
    return false;
  }
}

function controlledHttpConfigurationIssues(
  configuration: TaskExecutionControlledHttpProductionProviderConfiguration,
): readonly TaskExecutionProductionProviderDispatchIssue[] {
  const issues: TaskExecutionProductionProviderDispatchIssue[] = [];

  if (configuration.authority !== "system") {
    issues.push(
      issue({
        code: "task_execution_production_provider_http_configuration_authority_invalid",
        message:
          "Controlled HTTP production provider configuration must be system-owned.",
        category: "permission",
      }),
    );
  }

  if (!isSafeHttpsEndpoint(configuration.endpoint)) {
    issues.push(
      issue({
        code: "task_execution_production_provider_http_endpoint_invalid",
        message:
          "Controlled HTTP production provider endpoint must be an HTTPS system configuration value.",
      }),
    );
  }

  if (
    !Number.isInteger(configuration.timeoutMs) ||
    configuration.timeoutMs < 1 ||
    configuration.timeoutMs > 60_000
  ) {
    issues.push(
      issue({
        code: "task_execution_production_provider_http_timeout_invalid",
        message:
          "Controlled HTTP production provider timeout must be a bounded positive integer.",
      }),
    );
  }

  if (
    !Number.isInteger(configuration.maxRequestBytes) ||
    configuration.maxRequestBytes < 1 ||
    configuration.maxRequestBytes > 65_536 ||
    !Number.isInteger(configuration.maxResponseBytes) ||
    configuration.maxResponseBytes < 1 ||
    configuration.maxResponseBytes > 262_144
  ) {
    issues.push(
      issue({
        code: "task_execution_production_provider_http_size_limit_invalid",
        message:
          "Controlled HTTP production provider request and response limits must be bounded.",
      }),
    );
  }

  return issues;
}

function parseControlledHttpProviderResponse(input: {
  readonly body: string;
  readonly responseStatus: number;
  readonly observedAt: string;
}): TaskExecutionProductionProviderDispatchTransportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.body);
  } catch {
    return {
      status: "outcome_unknown",
      code: "task_execution_production_provider_http_response_invalid_json",
      diagnostic: "Controlled HTTP provider returned invalid JSON.",
      observedAt: input.observedAt,
    };
  }

  if (!isJsonRecord(parsed)) {
    return {
      status: "outcome_unknown",
      code: "task_execution_production_provider_http_response_invalid",
      diagnostic: "Controlled HTTP provider response was not an object.",
      observedAt: input.observedAt,
    };
  }

  const providerInvocationRef = safeDiagnosticText(parsed.providerInvocationRef);
  if (providerInvocationRef === undefined) {
    return {
      status: "outcome_unknown",
      code: "task_execution_production_provider_http_reference_missing",
      diagnostic:
        "Controlled HTTP provider did not return a stable provider invocation reference.",
      observedAt: input.observedAt,
    };
  }

  if (parsed.status === "returned") {
    return {
      status: "returned",
      providerInvocationRef,
      output: parsed.output as JsonValue | undefined,
      outputReference: safeDiagnosticText(parsed.outputReference),
      diagnosticCode: safeDiagnosticText(parsed.diagnosticCode),
      message: safeDiagnosticText(parsed.message),
      metadata: isJsonRecord(parsed.metadata)
        ? parsed.metadata as JsonObject
        : undefined,
      observedAt: input.observedAt,
    };
  }

  if (parsed.status === "failed") {
    return {
      status: "failed",
      providerInvocationRef,
      code:
        safeDiagnosticText(parsed.code) ??
        "task_execution_production_provider_http_failed",
      category: "adapter_failure",
      retryable: false,
      diagnostic: safeDiagnosticText(parsed.diagnostic),
      observedAt: input.observedAt,
    };
  }

  return {
    status: "outcome_unknown",
    providerInvocationRef,
    code:
      safeDiagnosticText(parsed.code) ??
      `task_execution_production_provider_http_status_${input.responseStatus}`,
    diagnostic: safeDiagnosticText(parsed.diagnostic),
    observedAt: input.observedAt,
  };
}

export function createControlledHttpProductionProviderDispatchTransport(
  input: CreateControlledHttpProductionProviderDispatchTransportInput,
): TaskExecutionProductionProviderDispatchTransport {
  return {
    dispatch: async (request) => {
      const issues = controlledHttpConfigurationIssues(input.configuration);
      const observedAt = new Date().toISOString();

      if (issues.length > 0) {
        return {
          status: "outcome_unknown",
          code: issues[0]!.code,
          diagnostic: issues[0]!.message,
          observedAt,
        };
      }

      if (request.providerRef !== input.configuration.providerRef) {
        return {
          status: "outcome_unknown",
          code: "task_execution_production_provider_http_provider_mismatch",
          diagnostic:
            "Controlled HTTP provider configuration did not match prepared provider authority.",
          observedAt,
        };
      }

      const body = JSON.stringify({
        taskId: request.preparedDispatch.taskId,
        taskRevision: request.preparedDispatch.sourceTaskRevision,
        attemptId: request.preparedDispatch.attemptId,
        invocationId: request.preparedDispatch.invocationId,
        idempotencyKey: request.idempotencyKey,
        operation: request.preparedDispatch.operationKind,
        input: request.input,
        inputReference: request.inputReference,
      });

      if (body.length > input.configuration.maxRequestBytes) {
        return {
          status: "outcome_unknown",
          code: "task_execution_production_provider_http_request_too_large",
          diagnostic:
            "Controlled HTTP provider request exceeded the configured size limit.",
          observedAt,
        };
      }

      const headers: Record<string, string> = {
        "content-type": "application/json",
        "idempotency-key": request.idempotencyKey,
        "aeos-invocation-id": request.preparedDispatch.invocationId,
      };

      if (input.configuration.credentialMode === "authorization_bearer") {
        if (request.credential?.value === undefined) {
          return {
            status: "outcome_unknown",
            code: "task_execution_production_provider_http_credential_missing",
            diagnostic:
              "Controlled HTTP provider required an ephemeral credential that was not supplied.",
            observedAt,
          };
        }
        headers.authorization = `Bearer ${request.credential.value}`;
      }

      let timedOut = false;
      const timeout = new Promise<"timeout">((resolve) => {
        setTimeout(() => {
          timedOut = true;
          resolve("timeout");
        }, input.configuration.timeoutMs);
      });
      const response = await Promise.race([
        input.fetch(input.configuration.endpoint, {
          method: "POST",
          redirect: "error",
          headers,
          body,
        }),
        timeout,
      ]);

      if (response === "timeout" || timedOut) {
        return {
          status: "outcome_unknown",
          code: "task_execution_production_provider_http_timeout",
          diagnostic:
            "Controlled HTTP provider timed out; provider lookup/status/replay reconciliation is required.",
          observedAt: new Date().toISOString(),
        };
      }

      const responseBody = await response.text();
      if (responseBody.length > input.configuration.maxResponseBytes) {
        return {
          status: "outcome_unknown",
          code: "task_execution_production_provider_http_response_too_large",
          diagnostic:
            "Controlled HTTP provider response exceeded the configured size limit.",
          observedAt: new Date().toISOString(),
        };
      }

      return parseControlledHttpProviderResponse({
        body: responseBody,
        responseStatus: response.status,
        observedAt: new Date().toISOString(),
      });
    },
  };
}

function oneShotAuthorityIssues(input: {
  readonly authority?: TaskExecutionProductionOneShotDispatchAuthority;
  readonly prepared: TaskExecutionProductionPreparedDispatch;
  readonly dispatchAuthorization: TaskExecutionProductionDispatchAuthorizationResult;
  readonly now: string;
}): readonly TaskExecutionProductionProviderDispatchIssue[] {
  const issues: TaskExecutionProductionProviderDispatchIssue[] = [];
  const authority = input.authority;
  const persisted = input.dispatchAuthorization.persistedInvocation;

  if (authority === undefined) {
    return [
      issue({
        code: "task_execution_production_provider_dispatch_one_shot_authority_required",
        message:
          "Real provider dispatch requires explicit system/operator one-shot authority.",
        category: "permission",
      }),
    ];
  }

  if (
    authority.authority !== "system_operator" ||
    authority.purpose !== "one_shot_production_dispatch" ||
    authority.operatorInitiated !== true ||
    authority.consumed !== false
  ) {
    issues.push(
      issue({
        code: "task_execution_production_provider_dispatch_one_shot_authority_invalid",
        message:
          "One-shot production dispatch authority must be system-owned, operator initiated, and unconsumed.",
        category: "permission",
      }),
    );
  }

  if (authority.expiresAt <= input.now || authority.issuedAt > input.now) {
    issues.push(
      issue({
        code: "task_execution_production_provider_dispatch_one_shot_authority_expired",
        message:
          "One-shot production dispatch authority must be current and short-lived.",
        category: "permission",
      }),
    );
  }

  if (
    persisted === null ||
    authority.taskId !== input.prepared.taskId ||
    authority.taskRevision !== input.prepared.sourceTaskRevision ||
    authority.attemptId !== input.prepared.attemptId ||
    authority.invocationId !== input.prepared.invocationId ||
    authority.invocationRevision !== persisted.revision ||
    authority.idempotencyKey !== input.prepared.idempotencyKey ||
    authority.adapterId !== input.prepared.adapterId ||
    authority.providerRef !== input.prepared.provider.providerRef ||
    authority.operation !== input.prepared.operationKind ||
    authority.boundary !== TASK_EXECUTION_PRODUCTION_DISPATCH_BOUNDARY
  ) {
    issues.push(
      issue({
        code: "task_execution_production_provider_dispatch_one_shot_authority_mismatch",
        message:
          "One-shot production dispatch authority must bind the exact invocation, revision, idempotency key, adapter, provider, and boundary.",
        category: "conflict",
      }),
    );
  }

  return issues;
}

async function appendOutcomeAudit(input: {
  readonly projectRoot: string;
  readonly record: TaskExecutionInvocationRecord;
  readonly forbiddenValues: readonly string[];
}): Promise<boolean> {
  const eventResult =
    input.record.lifecycle === "returned"
      ? createTaskExecutionInvocationReturnedAuditEvent({ record: input.record })
      : input.record.lifecycle === "failed"
        ? createTaskExecutionInvocationFailedAuditEvent({ record: input.record })
        : createTaskExecutionInvocationOutcomeUnknownAuditEvent({
            record: input.record,
          });

  if (!eventResult.ok) {
    return false;
  }

  const appendResult = await appendTaskExecutionAuditEvent({
    projectRoot: input.projectRoot,
    taskId: input.record.taskId,
    event: eventResult.value,
    forbiddenValues: input.forbiddenValues,
  });

  return appendResult.ok;
}

export async function dispatchTaskExecutionProductionProvider(
  input: DispatchTaskExecutionProductionProviderInput,
): Promise<TaskExecutionProductionProviderDispatchResult> {
  const issues: TaskExecutionProductionProviderDispatchIssue[] = [];
  const recordResult = validateTaskExecutionInvocationRecord(
    input.invocationRecord,
  );
  const prepared = input.preparedDispatch;
  const now = input.occurredAt ?? new Date().toISOString();

  if (!recordResult.ok) {
    issues.push(
      issue({
        code: recordResult.error.code,
        message:
          "Production provider dispatch requires a valid authoritative invocation record.",
        category: recordResult.error.category,
      }),
    );
  }

  if (prepared === null) {
    issues.push(
      issue({
        code: "task_execution_production_provider_dispatch_prepared_dispatch_required",
        message:
          "Production provider dispatch requires the prepared production dispatch contract.",
      }),
    );
  }

  if (
    !input.dispatchAuthorization.dispatchContractReady ||
    !input.dispatchAuthorization.invocationTransitioned ||
    input.dispatchAuthorization.persistedInvocation === null ||
    input.dispatchAuthorization.externalBoundary !==
      TASK_EXECUTION_PRODUCTION_DISPATCH_BOUNDARY
  ) {
    issues.push(
      issue({
        code: "task_execution_production_provider_dispatch_authorization_required",
        message:
          "Production provider dispatch requires the TASK-0307 gate and durable invoking transition first.",
        category: "permission",
      }),
    );
  }

  if (prepared !== null) {
    issues.push(
      ...oneShotAuthorityIssues({
        authority: input.oneShotAuthority,
        prepared,
        dispatchAuthorization: input.dispatchAuthorization,
        now,
      }),
    );
  }

  if (
    prepared !== null &&
    prepared.credentialRef !== null &&
    input.credential?.resolutionReference !==
      prepared.credentialResolutionReference
  ) {
    issues.push(
      issue({
        code: "task_execution_production_provider_dispatch_credential_required",
        message:
          "Production provider dispatch requires the exact ephemeral credential resolution reference prepared after policy approval.",
        category: "permission",
      }),
    );
  }

  if (issues.some((item) => item.severity === "error")) {
    return result({
      ok: false,
      status: "provider_dispatch_blocked",
      invocationLifecycle:
        input.dispatchAuthorization.persistedInvocation?.lifecycle ?? null,
      invocationRevision:
        input.dispatchAuthorization.persistedInvocation?.revision ?? null,
      issues,
    });
  }

  if (!recordResult.ok || prepared === null) {
    return result({
      ok: false,
      status: "provider_dispatch_blocked",
      invocationLifecycle:
        input.dispatchAuthorization.persistedInvocation?.lifecycle ?? null,
      invocationRevision:
        input.dispatchAuthorization.persistedInvocation?.revision ?? null,
      issues,
    });
  }

  const record = recordResult.value;
  const persisted = input.dispatchAuthorization.persistedInvocation!;
  const forbiddenValues = [
    ...(input.forbiddenCredentialValues ?? []),
    input.credential?.value ?? "",
    record.ownership.ownershipToken,
  ].filter((value) => value.length > 0);

  let transportResult: TaskExecutionProductionProviderDispatchTransportResult;
  try {
    transportResult = await input.transport.dispatch({
      preparedDispatch: prepared!,
      idempotencyKey: prepared!.idempotencyKey,
      providerRef: prepared!.provider.providerRef,
      credential: input.credential,
      input: prepared!.normalizedRequest.input,
      inputReference: prepared!.normalizedRequest.inputReference,
    });
  } catch {
    transportResult = {
      status: "outcome_unknown",
      code: "task_execution_production_provider_dispatch_transport_failed",
      diagnostic:
        "Provider transport threw before AEOS could classify the outcome; reconciliation is required.",
      observedAt: now,
    };
  }

  const observedAt = transportResult.observedAt ?? now;
  const updateResult = await updateTaskExecutionInvocation({
    projectRoot: input.projectRoot,
    taskId: record.taskId,
    invocationId: record.invocationId,
    ownershipToken: record.ownership.ownershipToken,
    expectedLifecycle: "invoking",
    expectedRevision: persisted.revision,
    intent:
      transportResult.status === "returned"
        ? {
            kind: "record_returned",
            result: {
              invocationOk: true,
              output: sanitizeJsonValue(transportResult.output, forbiddenValues),
              outputReference: sanitizeText(
                transportResult.outputReference,
                forbiddenValues,
              ),
              diagnosticCode: sanitizeText(
                transportResult.diagnosticCode,
                forbiddenValues,
              ),
              message: sanitizeText(transportResult.message, forbiddenValues),
              metadata: sanitizeJsonObject(
                transportResult.metadata,
                forbiddenValues,
              ),
              returnedAt: observedAt,
            },
          }
        : transportResult.status === "failed"
          ? {
              kind: "record_failed",
              failure: {
                code: sanitizeText(transportResult.code, forbiddenValues) ??
                  "task_execution_production_provider_dispatch_failed",
                category: transportResult.category,
                retryable: false,
                diagnostic: sanitizeText(
                  transportResult.diagnostic,
                  forbiddenValues,
                ),
                failedAt: observedAt,
              },
            }
          : {
              kind: "mark_outcome_unknown",
              occurredAt: observedAt,
              issue: {
                code: sanitizeText(transportResult.code, forbiddenValues) ??
                  "task_execution_production_provider_dispatch_outcome_unknown",
                message:
                  "Production provider dispatch outcome is ambiguous; reconciliation is required and blind retry is forbidden.",
                severity: "error",
                category: "unknown",
              },
            },
  });

  if (!updateResult.ok) {
    return result({
      ok: false,
      status: "outcome_persistence_failed",
      providerCalled: true,
      oneShotAuthorityConsumed: true,
      invocationLifecycle: persisted.lifecycle,
      invocationRevision: persisted.revision,
      providerInvocationRef:
        "providerInvocationRef" in transportResult
          ? transportResult.providerInvocationRef ?? null
          : null,
      reconciliationRequired: true,
      issues: [
        issue({
          code: updateResult.error.code,
          message:
            "Provider returned after the external boundary, but AEOS could not persist the invocation outcome; reconciliation is required and no retry was attempted.",
          category: updateResult.error.category,
        }),
      ],
    });
  }

  const updatedRecord = updateResult.value.record;
  const postAuditWritten = await appendOutcomeAudit({
    projectRoot: input.projectRoot,
    record: updatedRecord,
    forbiddenValues,
  });

  return result({
    ok: transportResult.status !== "outcome_unknown",
    status:
      transportResult.status === "returned"
        ? "provider_returned"
        : transportResult.status === "failed"
          ? "provider_failed"
          : "provider_outcome_unknown",
    providerCalled: true,
    oneShotAuthorityConsumed: true,
    invocationLifecycle: updatedRecord.lifecycle,
    invocationRevision: updatedRecord.revision,
    providerInvocationRef:
      "providerInvocationRef" in transportResult
        ? transportResult.providerInvocationRef ?? null
        : null,
    reconciliationRequired:
      transportResult.status === "outcome_unknown" || !postAuditWritten,
    postDispatchAuditWritten: postAuditWritten,
    postDispatchAuditIncomplete: !postAuditWritten,
    issues: postAuditWritten
      ? issues
      : [
          ...issues,
          issue({
            code: "task_execution_production_provider_dispatch_post_audit_incomplete",
            message:
              "Provider outcome was persisted, but post-dispatch audit append failed; AEOS did not retry the provider.",
            category: "unknown",
          }),
        ],
  });
}
