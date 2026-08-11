import type {
  AgenticExecutionAttemptId,
  AgenticTaskId,
  AgenticWorkBatchId,
  AgenticWorkItemId,
} from "./agentic-lifecycle.js";
import {
  TASK_EXECUTION_ADAPTER_PRODUCTION_EXECUTION_ENABLED,
} from "./task-execution-adapter.js";
import type {
  TaskExecutionCredentialPublicResolutionResult,
} from "./task-execution-credential.js";
import type {
  TaskExecutionAttempt,
} from "./task-execution-attempt.js";
import {
  validateTaskExecutionAttempt,
} from "./task-execution-attempt.js";
import type {
  TaskExecutionAuditEvent,
} from "./task-execution-audit.js";
import {
  isTaskExecutionAuditEvent,
} from "./task-execution-audit.js";
import type {
  TaskExecutionInvocationRecord,
} from "./task-execution-invocation-record.js";
import {
  validateTaskExecutionInvocationRecord,
} from "./task-execution-invocation-record.js";
import {
  updateTaskExecutionInvocation,
} from "./task-execution-invocation-persistence.js";
import type {
  TaskExecutionPermissionGateResult,
} from "./task-execution-permission-gate.js";
import type {
  TaskExecutionPolicyApprovalPublicStatus,
} from "./task-execution-policy-approval.js";
import type {
  TaskExecutionProductionAdapterReadiness,
  TaskExecutionProductionPreparedDispatch,
} from "./task-execution-production-adapter.js";
import type {
  TaskExecutionProductionProviderConformanceResult,
} from "./task-execution-production-provider-conformance.js";
import {
  validatePersistedTaskState,
} from "./task-state-persistence.js";
import type { AeosError } from "./types.js";

export const TASK_EXECUTION_PRODUCTION_DISPATCH_BOUNDARY =
  "EXTERNAL_PROVIDER_CALL";
export const TASK_EXECUTION_PRODUCTION_DISPATCH_ENABLED =
  TASK_EXECUTION_ADAPTER_PRODUCTION_EXECUTION_ENABLED;

export type TaskExecutionProductionDispatchDecision =
  | "ready"
  | "execution_disabled"
  | "stale_authority"
  | "attempt_not_started"
  | "invocation_not_current"
  | "adapter_not_ready"
  | "provider_recovery_not_ready"
  | "permission_denied"
  | "policy_proof_missing"
  | "credential_not_ready"
  | "audit_precondition_missing"
  | "invoking_transition_blocked"
  | "blocked"
  | "unknown";

export interface TaskExecutionProductionDispatchIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: "error" | "warning";
  readonly category: AeosError["category"];
}

export interface TaskExecutionProductionDispatchAuthority {
  readonly taskId: AgenticTaskId;
  readonly taskRevision: number;
  readonly attemptId: AgenticExecutionAttemptId;
  readonly attemptNumber: number;
  readonly attemptLifecycle: TaskExecutionAttempt["lifecycle"];
  readonly invocationId: string;
  readonly invocationRevision: number;
  readonly invocationLifecycle: TaskExecutionInvocationRecord["lifecycle"];
  readonly idempotencyKey: string;
  readonly workItemId: AgenticWorkItemId | null;
  readonly batchId: AgenticWorkBatchId | null;
  readonly adapterId: string;
  readonly providerRef: string;
  readonly providerFamilyRef: string | null;
  readonly operation: "execute_task_attempt";
  readonly permissionGateId: string;
  readonly policyRequired: boolean;
  readonly policyDecisionReference: string | null;
  readonly credentialRequired: boolean;
  readonly credentialRef: string | null;
  readonly credentialScope: readonly string[];
  readonly credentialResolutionReference: string | null;
  readonly preDispatchAuditEventId: string | null;
  readonly preDispatchAuditSequence: number | null;
  readonly productionExecutionEnabled: false;
  readonly externalBoundary: typeof TASK_EXECUTION_PRODUCTION_DISPATCH_BOUNDARY;
}

export interface TaskExecutionProductionDispatchReadiness {
  readonly taskAuthorityReady: boolean;
  readonly attemptReady: boolean;
  readonly invocationReady: boolean;
  readonly adapterReady: boolean;
  readonly providerRecoveryReady: boolean;
  readonly permissionReady: boolean;
  readonly policyReady: boolean;
  readonly credentialReady: boolean;
  readonly auditReady: boolean;
  readonly invokingTransitionReady: boolean;
  readonly dispatchContractReady: boolean;
  readonly globalExecutionGateOpen: false;
  readonly productionExecutionEnabled: false;
  readonly externalCallAllowed: false;
}

export interface TaskExecutionProductionDispatchGateInput {
  readonly state: unknown;
  readonly attempt: unknown;
  readonly invocationRecord: unknown;
  readonly preparedDispatch: unknown;
  readonly adapterReadiness: TaskExecutionProductionAdapterReadiness | null;
  readonly providerConformance:
    | TaskExecutionProductionProviderConformanceResult
    | null;
  readonly permissionGateResult: TaskExecutionPermissionGateResult | null;
  readonly policyApprovalStatus?: TaskExecutionPolicyApprovalPublicStatus;
  readonly credentialResolutionResult?: TaskExecutionCredentialPublicResolutionResult;
  readonly preDispatchAuditEvent?: unknown;
  readonly latestAttemptNumberForContext?: number;
  readonly expectedInvocationRevision?: number;
  readonly taskOrModelAuthorityClaims?: unknown;
  readonly adapterAuthorityClaims?: unknown;
  readonly providerAuthorityClaims?: unknown;
}

export interface TaskExecutionProductionDispatchGateResult
  extends TaskExecutionProductionDispatchReadiness {
  readonly ok: boolean;
  readonly decision: TaskExecutionProductionDispatchDecision;
  readonly authority: TaskExecutionProductionDispatchAuthority | null;
  readonly issues: readonly TaskExecutionProductionDispatchIssue[];
  readonly safety: {
    readonly productionExecutionEnabled: false;
    readonly productionAdapterInvoked: false;
    readonly providerCalled: false;
    readonly networkCalled: false;
    readonly filesystemTouched: false;
    readonly subprocessExecuted: false;
    readonly shellExecuted: false;
    readonly modelInvoked: false;
    readonly toolCallsExecuted: false;
    readonly rawSecretSerialized: false;
    readonly ownershipSecretSerialized: false;
    readonly taskModified: false;
    readonly attemptModified: false;
    readonly invocationModified: boolean;
    readonly workCompleted: false;
    readonly taskCompleted: false;
    readonly verifierRun: false;
    readonly retryPerformed: false;
    readonly genericTransportAccepted: false;
  };
  readonly outcomeRecording: {
    readonly providerResultCompletesWork: false;
    readonly providerResultCompletesTask: false;
    readonly supportedInvocationOutcomes: readonly [
      "returned",
      "failed",
      "outcome_unknown",
    ];
    readonly ambiguousOutcomeRequiresReconciliation: true;
    readonly blindRedispatchAllowed: false;
    readonly postDispatchAuditRequired: boolean;
  };
}

export interface AuthorizeTaskExecutionProductionDispatchInput
  extends TaskExecutionProductionDispatchGateInput {
  readonly projectRoot: string;
  readonly occurredAt?: string;
}

export interface TaskExecutionProductionDispatchAuthorizationResult
  extends TaskExecutionProductionDispatchGateResult {
  readonly invocationTransitioned: boolean;
  readonly invocation: {
    readonly lifecycle: TaskExecutionInvocationRecord["lifecycle"] | null;
    readonly revision: number | null;
    readonly enteredAt: string | null;
  };
  readonly persistedInvocation: {
    readonly invocationId: string;
    readonly taskId: AgenticTaskId;
    readonly taskStateRevision: number;
    readonly attemptId: AgenticExecutionAttemptId;
    readonly attemptNumber: number;
    readonly workItemId: AgenticWorkItemId | null;
    readonly batchId: AgenticWorkBatchId | null;
    readonly lifecycle: TaskExecutionInvocationRecord["lifecycle"];
    readonly idempotencyKey: string;
    readonly revision: number;
    readonly enteredAt: string | null;
    readonly path: string;
  } | null;
  readonly externalBoundary:
    | typeof TASK_EXECUTION_PRODUCTION_DISPATCH_BOUNDARY
    | null;
}

const safeIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/;

const hostileAuthorityKeys = new Set<string>([
  "productionexecutionenabled",
  "executionenabled",
  "approved",
  "policyauthorized",
  "safetoretry",
  "alldone",
  "verified",
  "completed",
  "force",
  "enableproduction",
  "transport",
  "callback",
]);

const safety: TaskExecutionProductionDispatchGateResult["safety"] = {
  productionExecutionEnabled: TASK_EXECUTION_PRODUCTION_DISPATCH_ENABLED,
  productionAdapterInvoked: false,
  providerCalled: false,
  networkCalled: false,
  filesystemTouched: false,
  subprocessExecuted: false,
  shellExecuted: false,
  modelInvoked: false,
  toolCallsExecuted: false,
  rawSecretSerialized: false,
  ownershipSecretSerialized: false,
  taskModified: false,
  attemptModified: false,
  invocationModified: false,
  workCompleted: false,
  taskCompleted: false,
  verifierRun: false,
  retryPerformed: false,
  genericTransportAccepted: false,
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

function canonicalKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function containsHostileAuthorityClaim(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsHostileAuthorityClaim);
  }

  if (!isRecord(value)) {
    return false;
  }

  return Object.entries(value).some(
    ([key, item]) =>
      hostileAuthorityKeys.has(canonicalKey(key)) ||
      containsHostileAuthorityClaim(item),
  );
}

function issue(input: {
  readonly code: string;
  readonly message: string;
  readonly category: AeosError["category"];
  readonly severity?: "error" | "warning";
}): TaskExecutionProductionDispatchIssue {
  return {
    code: input.code,
    message: input.message,
    category: input.category,
    severity: input.severity ?? "error",
  };
}

function preparedDispatchFromUnknown(
  value: unknown,
): TaskExecutionProductionPreparedDispatch | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  if (
    !isSafeId(value.taskId) ||
    !isPositiveInteger(value.sourceTaskRevision) ||
    !isSafeId(value.attemptId) ||
    !isPositiveInteger(value.attemptNumber) ||
    !isSafeId(value.invocationId) ||
    typeof value.idempotencyKey !== "string" ||
    value.idempotencyKey.length === 0 ||
    !isSafeId(value.adapterId) ||
    !isRecord(value.adapterIdentity) ||
    value.adapterIdentity.adapterId !== value.adapterId ||
    value.adapterIdentity.adapterKind !== "production_execution" ||
    value.adapterIdentity.identityAuthority !== "system" ||
    !isRecord(value.provider) ||
    !isSafeId(value.provider.providerRef) ||
    value.provider.authority !== "system" ||
    value.operationKind !== "execute_task_attempt" ||
    !Array.isArray(value.credentialScope) ||
    !isRecord(value.reconciliationCapabilities) ||
    value.productionExecutionEnabled !== false
  ) {
    return undefined;
  }

  return value as unknown as TaskExecutionProductionPreparedDispatch;
}

function auditEventFromUnknown(value: unknown): TaskExecutionAuditEvent | undefined {
  return isTaskExecutionAuditEvent(value) ? value : undefined;
}

function sameOptionalId(
  left: string | undefined,
  right: string | null | undefined,
): boolean {
  return (left ?? null) === (right ?? null);
}

function sortedStrings(value: readonly string[]): readonly string[] {
  return [...value].sort();
}

function stringArraysEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  const sortedLeft = sortedStrings(left);
  const sortedRight = sortedStrings(right);

  return (
    sortedLeft.length === sortedRight.length &&
    sortedLeft.every((item, index) => item === sortedRight[index])
  );
}

function policyReady(input: {
  readonly gate: TaskExecutionPermissionGateResult | null;
  readonly prepared: TaskExecutionProductionPreparedDispatch | undefined;
  readonly status?: TaskExecutionPolicyApprovalPublicStatus;
  readonly issues: TaskExecutionProductionDispatchIssue[];
}): boolean {
  if (input.gate === null) {
    input.issues.push(
      issue({
        code: "task_execution_production_dispatch_permission_gate_missing",
        message:
          "Production dispatch requires the exact permission gate result before policy readiness can be evaluated.",
        category: "permission",
      }),
    );
    return false;
  }

  if (!input.gate.policyRequired) {
    return true;
  }

  const status = input.status;
  const prepared = input.prepared;

  if (status === undefined || prepared === undefined) {
    input.issues.push(
      issue({
        code: "task_execution_production_dispatch_policy_proof_missing",
        message:
          "Policy-required production dispatch requires a durable exact-context approval proof.",
        category: "policy",
      }),
    );
    return false;
  }

  if (
    status.decision !== "approved" ||
    status.expired ||
    status.policyGateId !== input.gate.policyGateId ||
    status.taskId !== prepared.taskId ||
    status.taskStateRevision !== prepared.sourceTaskRevision ||
    status.attemptId !== prepared.attemptId ||
    status.invocationId !== prepared.invocationId ||
    status.adapterId !== prepared.adapterId ||
    status.operation !== prepared.operationKind ||
    prepared.policyDecisionReference !== status.approvalId
  ) {
    input.issues.push(
      issue({
        code: "task_execution_production_dispatch_policy_proof_mismatch",
        message:
          "Durable policy approval proof does not match the exact current dispatch authority.",
        category: "policy",
      }),
    );
    return false;
  }

  return true;
}

function providerRecoveryReady(
  providerConformance:
    | TaskExecutionProductionProviderConformanceResult
    | null,
  issues: TaskExecutionProductionDispatchIssue[],
): boolean {
  if (
    providerConformance?.contractConformant === true &&
    providerConformance.FirstCallProviderRecoveryReady === true &&
    providerConformance.idempotencyProven === true &&
    providerConformance.duplicateSuppressionProven === true &&
    providerConformance.providerReferenceProven === true &&
    providerConformance.lookupProven === true &&
    providerConformance.statusQueryProven === true &&
    providerConformance.resultReplayProven === true &&
    providerConformance.crashRecoveryProven === true &&
    providerConformance.blindRetryPrevented === true
  ) {
    return true;
  }

  issues.push(
    issue({
      code: "task_execution_production_dispatch_provider_recovery_not_ready",
      message:
        "Production dispatch requires behavioral provider recovery conformance, not capability claims alone.",
      category: "conflict",
    }),
  );
  return false;
}

function credentialReady(input: {
  readonly prepared: TaskExecutionProductionPreparedDispatch | undefined;
  readonly credential?: TaskExecutionCredentialPublicResolutionResult;
  readonly issues: TaskExecutionProductionDispatchIssue[];
}): boolean {
  const prepared = input.prepared;

  if (prepared === undefined) {
    return false;
  }

  if (prepared.credentialRef === null) {
    return true;
  }

  const credential = input.credential;

  if (
    credential?.ok === true &&
    credential.resolved === true &&
    credential.taskId === prepared.taskId &&
    credential.taskRevision === prepared.sourceTaskRevision &&
    credential.attemptId === prepared.attemptId &&
    credential.invocationId === prepared.invocationId &&
    credential.adapterId === prepared.adapterId &&
    credential.adapterKind === "production_execution" &&
    credential.operationKind === prepared.operationKind &&
    credential.credentialRef === prepared.credentialRef &&
    stringArraysEqual(credential.credentialScope, prepared.credentialScope) &&
    credential.resolutionReference === prepared.credentialResolutionReference
  ) {
    return true;
  }

  input.issues.push(
    issue({
      code: "task_execution_production_dispatch_credential_not_ready",
      message:
        "Resolved credential metadata does not match the exact current production dispatch binding.",
      category: "permission",
    }),
  );
  return false;
}

function auditReady(input: {
  readonly prepared: TaskExecutionProductionPreparedDispatch | undefined;
  readonly gate: TaskExecutionPermissionGateResult | null;
  readonly credential?: TaskExecutionCredentialPublicResolutionResult;
  readonly auditEvent?: TaskExecutionAuditEvent;
  readonly issues: TaskExecutionProductionDispatchIssue[];
}): boolean {
  const prepared = input.prepared;

  if (prepared === undefined) {
    return false;
  }

  if (prepared.auditEventId === null || prepared.auditSequence === null) {
    input.issues.push(
      issue({
        code: "task_execution_production_dispatch_pre_dispatch_audit_missing",
        message:
          "Production dispatch always requires a durable matching pre-dispatch audit event before invoking transition.",
        category: "validation",
      }),
    );
    return false;
  }

  const event = input.auditEvent;
  const gate = input.gate;

  if (
    event !== undefined &&
    gate !== null &&
    event.eventKind === "execution_invocation_dispatch_intent" &&
    event.auditEventId === prepared.auditEventId &&
    event.sequence === prepared.auditSequence &&
    event.taskId === prepared.taskId &&
    event.taskStateRevision === prepared.sourceTaskRevision &&
    event.attemptId === prepared.attemptId &&
    event.invocationId === prepared.invocationId &&
    event.binding.taskId === prepared.taskId &&
    event.binding.taskStateRevision === prepared.sourceTaskRevision &&
    event.binding.attemptId === prepared.attemptId &&
    event.binding.attemptNumber === prepared.attemptNumber &&
    event.binding.invocationId === prepared.invocationId &&
    event.binding.workItemId === (prepared.workItemId ?? undefined) &&
    event.binding.batchId === (prepared.batchId ?? undefined) &&
    event.adapter?.adapterId === prepared.adapterId &&
    event.adapter.operation === prepared.operationKind &&
    event.adapter.idempotencyReference === prepared.idempotencyKey &&
    event.policy?.policyGateId === gate.policyGateId &&
    event.policy.policyDecisionReference === prepared.policyDecisionReference &&
    event.policy.policyAuthorized === gate.policyAuthorized &&
    event.credential?.credentialRef === (prepared.credentialRef ?? undefined) &&
    event.credential?.credentialResolutionReference ===
      (input.credential?.resolutionReference ?? undefined)
  ) {
    return true;
  }

  input.issues.push(
    issue({
      code: "task_execution_production_dispatch_pre_dispatch_audit_missing",
      message:
        "Production dispatch requires a durable matching pre-dispatch audit event before invoking transition.",
      category: "validation",
    }),
  );
  return false;
}

function decisionFromIssues(input: {
  readonly issues: readonly TaskExecutionProductionDispatchIssue[];
  readonly dispatchContractReady: boolean;
}): TaskExecutionProductionDispatchDecision {
  const codes = input.issues
    .filter((item) => item.severity === "error")
    .map((item) => item.code);

  if (codes.length === 0) {
    return TASK_EXECUTION_PRODUCTION_DISPATCH_ENABLED
      ? "ready"
      : "execution_disabled";
  }

  if (codes.includes("task_execution_production_dispatch_attempt_not_started")) {
    return "attempt_not_started";
  }

  if (
    codes.some((code) =>
      [
        "task_execution_production_dispatch_invocation_not_reserved",
        "task_execution_production_dispatch_invocation_authority_mismatch",
      ].includes(code),
    )
  ) {
    return "invocation_not_current";
  }

  if (
    codes.some((code) =>
      [
        "task_execution_production_dispatch_task_revision_mismatch",
        "task_execution_production_dispatch_prepared_authority_mismatch",
      ].includes(code),
    )
  ) {
    return "stale_authority";
  }

  if (codes.includes("task_execution_production_dispatch_adapter_not_ready")) {
    return "adapter_not_ready";
  }

  if (
    codes.includes(
      "task_execution_production_dispatch_provider_recovery_not_ready",
    )
  ) {
    return "provider_recovery_not_ready";
  }

  if (codes.includes("task_execution_production_dispatch_permission_denied")) {
    return "permission_denied";
  }

  if (
    codes.some((code) =>
      [
        "task_execution_production_dispatch_policy_proof_missing",
        "task_execution_production_dispatch_policy_proof_mismatch",
      ].includes(code),
    )
  ) {
    return "policy_proof_missing";
  }

  if (codes.includes("task_execution_production_dispatch_credential_not_ready")) {
    return "credential_not_ready";
  }

  if (
    codes.includes(
      "task_execution_production_dispatch_pre_dispatch_audit_missing",
    )
  ) {
    return "audit_precondition_missing";
  }

  if (
    codes.includes(
      "task_execution_production_dispatch_invoking_transition_blocked",
    )
  ) {
    return "invoking_transition_blocked";
  }

  return input.dispatchContractReady ? "unknown" : "blocked";
}

function result(input: {
  readonly readiness: TaskExecutionProductionDispatchReadiness;
  readonly decision: TaskExecutionProductionDispatchDecision;
  readonly authority: TaskExecutionProductionDispatchAuthority | null;
  readonly issues: readonly TaskExecutionProductionDispatchIssue[];
  readonly postDispatchAuditRequired: boolean;
}): TaskExecutionProductionDispatchGateResult {
  return {
    ok: input.readiness.dispatchContractReady,
    decision: input.decision,
    authority: input.authority,
    ...input.readiness,
    issues: input.issues,
    safety,
    outcomeRecording: {
      providerResultCompletesWork: false,
      providerResultCompletesTask: false,
      supportedInvocationOutcomes: ["returned", "failed", "outcome_unknown"],
      ambiguousOutcomeRequiresReconciliation: true,
      blindRedispatchAllowed: false,
      postDispatchAuditRequired: input.postDispatchAuditRequired,
    },
  };
}

export function evaluateTaskExecutionProductionDispatchGate(
  input: TaskExecutionProductionDispatchGateInput,
): TaskExecutionProductionDispatchGateResult {
  const issues: TaskExecutionProductionDispatchIssue[] = [];
  const stateResult = validatePersistedTaskState(input.state);
  const attemptResult = validateTaskExecutionAttempt(input.attempt);
  const invocationResult = validateTaskExecutionInvocationRecord(
    input.invocationRecord,
  );
  const prepared = preparedDispatchFromUnknown(input.preparedDispatch);
  const auditEvent = auditEventFromUnknown(input.preDispatchAuditEvent);

  if (!stateResult.ok) {
    issues.push(
      issue({
        code: stateResult.error.code,
        message:
          "Production dispatch requires a valid current authoritative task state.",
        category: stateResult.error.category,
      }),
    );
  }

  if (!attemptResult.ok) {
    issues.push(
      issue({
        code: attemptResult.error.code,
        message:
          "Production dispatch requires a valid authoritative execution attempt.",
        category: attemptResult.error.category,
      }),
    );
  }

  if (!invocationResult.ok) {
    issues.push(
      issue({
        code: invocationResult.error.code,
        message:
          "Production dispatch requires a valid authoritative invocation record.",
        category: invocationResult.error.category,
      }),
    );
  }

  if (prepared === undefined) {
    issues.push(
      issue({
        code: "task_execution_production_dispatch_prepared_dispatch_invalid",
        message:
          "Production dispatch requires a valid prepared dispatch contract.",
        category: "validation",
      }),
    );
  }

  const state = stateResult.ok ? stateResult.value : undefined;
  const attempt = attemptResult.ok ? attemptResult.value : undefined;
  const invocation = invocationResult.ok ? invocationResult.value : undefined;

  if (
    containsHostileAuthorityClaim(input.taskOrModelAuthorityClaims) ||
    containsHostileAuthorityClaim(input.adapterAuthorityClaims) ||
    containsHostileAuthorityClaim(input.providerAuthorityClaims)
  ) {
    issues.push(
      issue({
        code: "task_execution_production_dispatch_hostile_authority_claims_ignored",
        message:
          "Task, model, adapter, and provider prose cannot enable production execution, policy, retry, verification, or completion authority.",
        category: "validation",
        severity: "warning",
      }),
    );
  }

  let taskAuthorityReady = false;
  let attemptReady = false;
  let invocationReady = false;

  if (state !== undefined && attempt !== undefined && invocation !== undefined) {
    taskAuthorityReady =
      state.taskId === attempt.taskId &&
      state.taskId === invocation.taskId &&
      state.revision === attempt.taskStateRevision &&
      state.revision === invocation.taskStateRevision;

    if (!taskAuthorityReady) {
      issues.push(
        issue({
          code: "task_execution_production_dispatch_task_revision_mismatch",
          message:
            "Task, attempt, and invocation must bind the exact current task revision.",
          category: "conflict",
        }),
      );
    }

    attemptReady =
      attempt.lifecycle === "started" &&
      invocation.attemptId === attempt.attemptId &&
      invocation.attemptNumber === attempt.attemptNumber &&
      sameOptionalId(invocation.workItemId, attempt.workItemId) &&
      sameOptionalId(invocation.batchId, attempt.batchId) &&
      (input.latestAttemptNumberForContext === undefined ||
        input.latestAttemptNumberForContext === attempt.attemptNumber);

    if (attempt.lifecycle !== "started") {
      issues.push(
        issue({
          code: "task_execution_production_dispatch_attempt_not_started",
          message:
            "Prepared attempts and non-started attempt lifecycles cannot become production dispatch authority.",
          category: "validation",
        }),
      );
    } else if (!attemptReady) {
      issues.push(
        issue({
          code: "task_execution_production_dispatch_attempt_authority_mismatch",
          message:
            "Invocation authority does not match the exact started attempt context.",
          category: "conflict",
        }),
      );
    }

    invocationReady =
      invocation.lifecycle === "reserved" &&
      invocation.dependencyKind === "test_noop" &&
      isPositiveInteger(invocation.revision) &&
      (input.expectedInvocationRevision === undefined ||
        input.expectedInvocationRevision === invocation.revision);

    if (invocation.lifecycle !== "reserved") {
      issues.push(
        issue({
          code: "task_execution_production_dispatch_invocation_not_reserved",
          message:
            "Production dispatch can only cross the boundary from the current reserved invocation.",
          category: "conflict",
        }),
      );
    }

    if (
      input.expectedInvocationRevision !== undefined &&
      (!isPositiveInteger(input.expectedInvocationRevision) ||
        input.expectedInvocationRevision !== invocation.revision)
    ) {
      issues.push(
        issue({
          code: "task_execution_production_dispatch_invoking_transition_blocked",
          message:
            "Expected invocation revision does not match the guarded invoking transition authority.",
          category: "conflict",
        }),
      );
    }
  }

  if (
    prepared !== undefined &&
    invocation !== undefined &&
    attempt !== undefined &&
    state !== undefined
  ) {
    const preparedMatches =
      prepared.taskId === state.taskId &&
      prepared.sourceTaskRevision === state.revision &&
      prepared.attemptId === attempt.attemptId &&
      prepared.attemptNumber === attempt.attemptNumber &&
      prepared.invocationId === invocation.invocationId &&
      prepared.idempotencyKey === invocation.idempotencyKey &&
      prepared.workItemId === (invocation.workItemId ?? null) &&
      prepared.batchId === (invocation.batchId ?? null) &&
      prepared.operationKind === "execute_task_attempt";

    if (!preparedMatches) {
      issues.push(
        issue({
          code: "task_execution_production_dispatch_prepared_authority_mismatch",
          message:
            "Prepared dispatch cannot replace task, revision, attempt, invocation, work, batch, operation, or idempotency authority.",
          category: "conflict",
        }),
      );
    }
  }

  const adapterReady =
    input.adapterReadiness?.productionDispatchContractReady === true &&
    input.adapterReadiness.ProductionDispatchPrepared === true &&
    input.adapterReadiness.productionExecutionEnabled === false;

  if (!adapterReady) {
    issues.push(
      issue({
        code: "task_execution_production_dispatch_adapter_not_ready",
        message:
          "Production dispatch authority requires the prepared production adapter contract to be ready.",
        category: "validation",
      }),
    );
  }

  const providerReady = providerRecoveryReady(input.providerConformance, issues);
  const permissionReady =
    input.permissionGateResult?.allowed === true &&
    input.permissionGateResult.decision === "allowed" &&
    input.permissionGateResult.taskId === prepared?.taskId &&
    input.permissionGateResult.sourceTaskRevision ===
      prepared?.sourceTaskRevision &&
    input.permissionGateResult.attemptId === prepared?.attemptId &&
    input.permissionGateResult.invocationId === prepared?.invocationId &&
    input.permissionGateResult.adapterId === prepared?.adapterId &&
    input.permissionGateResult.operation === prepared?.operationKind;

  if (!permissionReady) {
    issues.push(
      issue({
        code: "task_execution_production_dispatch_permission_denied",
        message:
          "Production dispatch requires an allowed permission gate bound to the exact invocation.",
        category: "permission",
      }),
    );
  }

  const policyStageReady = policyReady({
    gate: input.permissionGateResult,
    prepared,
    status: input.policyApprovalStatus,
    issues,
  });
  const credentialStageReady = credentialReady({
    prepared,
    credential: input.credentialResolutionResult,
    issues,
  });
  const auditStageReady = auditReady({
    prepared,
    gate: input.permissionGateResult,
    credential: input.credentialResolutionResult,
    auditEvent,
    issues,
  });
  const invokingTransitionReady =
    taskAuthorityReady &&
    attemptReady &&
    invocationReady &&
    adapterReady &&
    providerReady &&
    permissionReady &&
    policyStageReady &&
    credentialStageReady &&
    auditStageReady;

  const dispatchContractReady = invokingTransitionReady;
  const readiness: TaskExecutionProductionDispatchReadiness = {
    taskAuthorityReady,
    attemptReady,
    invocationReady,
    adapterReady,
    providerRecoveryReady: providerReady,
    permissionReady,
    policyReady: policyStageReady,
    credentialReady: credentialStageReady,
    auditReady: auditStageReady,
    invokingTransitionReady,
    dispatchContractReady,
    globalExecutionGateOpen: TASK_EXECUTION_PRODUCTION_DISPATCH_ENABLED,
    productionExecutionEnabled: TASK_EXECUTION_PRODUCTION_DISPATCH_ENABLED,
    externalCallAllowed: false,
  };
  const decision = decisionFromIssues({ issues, dispatchContractReady });
  const authority: TaskExecutionProductionDispatchAuthority | null =
    prepared !== undefined && invocation !== undefined && attempt !== undefined
      ? {
          taskId: prepared.taskId,
          taskRevision: prepared.sourceTaskRevision,
          attemptId: prepared.attemptId,
          attemptNumber: prepared.attemptNumber,
          attemptLifecycle: attempt.lifecycle,
          invocationId: prepared.invocationId,
          invocationRevision: invocation.revision,
          invocationLifecycle: invocation.lifecycle,
          idempotencyKey: prepared.idempotencyKey,
          workItemId: prepared.workItemId,
          batchId: prepared.batchId,
          adapterId: prepared.adapterId,
          providerRef: prepared.provider.providerRef,
          providerFamilyRef: prepared.provider.providerFamilyRef ?? null,
          operation: "execute_task_attempt",
          permissionGateId: input.permissionGateResult?.policyGateId ?? "",
          policyRequired: input.permissionGateResult?.policyRequired ?? false,
          policyDecisionReference: prepared.policyDecisionReference,
          credentialRequired: prepared.credentialRef !== null,
          credentialRef: prepared.credentialRef,
          credentialScope: prepared.credentialScope,
          credentialResolutionReference: prepared.credentialResolutionReference,
          preDispatchAuditEventId: prepared.auditEventId,
          preDispatchAuditSequence: prepared.auditSequence,
          productionExecutionEnabled:
            TASK_EXECUTION_PRODUCTION_DISPATCH_ENABLED,
          externalBoundary: TASK_EXECUTION_PRODUCTION_DISPATCH_BOUNDARY,
        }
      : null;

  return result({
    readiness,
    decision,
    authority,
    issues,
    postDispatchAuditRequired:
      prepared !== undefined && prepared.auditEventId !== null,
  });
}

export async function authorizeTaskExecutionProductionDispatch(
  input: AuthorizeTaskExecutionProductionDispatchInput,
): Promise<TaskExecutionProductionDispatchAuthorizationResult> {
  const gate = evaluateTaskExecutionProductionDispatchGate(input);
  const invocationResult = validateTaskExecutionInvocationRecord(
    input.invocationRecord,
  );

  if (!gate.dispatchContractReady || !invocationResult.ok) {
    return {
      ...gate,
      invocationTransitioned: false,
      invocation: {
        lifecycle: invocationResult.ok ? invocationResult.value.lifecycle : null,
        revision: invocationResult.ok ? invocationResult.value.revision : null,
        enteredAt: invocationResult.ok ? invocationResult.value.enteredAt ?? null : null,
      },
      persistedInvocation: null,
      externalBoundary: null,
    };
  }

  const record = invocationResult.value;
  const transitionResult = await updateTaskExecutionInvocation({
    projectRoot: input.projectRoot,
    taskId: record.taskId,
    invocationId: record.invocationId,
    ownershipToken: record.ownership.ownershipToken,
    expectedLifecycle: "reserved",
    expectedRevision: input.expectedInvocationRevision ?? record.revision,
    intent: {
      kind: "enter_invocation",
      occurredAt: input.occurredAt,
    },
  });

  if (!transitionResult.ok) {
    const transitionIssue = issue({
      code: "task_execution_production_dispatch_invoking_transition_blocked",
      message:
        "Guarded invocation transition to invoking failed, so no external provider call can be eligible.",
      category: transitionResult.error.category,
    });
    const readiness: TaskExecutionProductionDispatchReadiness = {
      ...gate,
      invokingTransitionReady: false,
      dispatchContractReady: false,
      externalCallAllowed: false,
    };

    return {
      ...result({
        readiness,
        decision: "invoking_transition_blocked",
        authority: gate.authority,
        issues: [...gate.issues, transitionIssue],
        postDispatchAuditRequired: gate.outcomeRecording.postDispatchAuditRequired,
      }),
      invocationTransitioned: false,
      invocation: {
        lifecycle: record.lifecycle,
        revision: record.revision,
        enteredAt: record.enteredAt ?? null,
      },
      persistedInvocation: null,
      externalBoundary: null,
    };
  }

  return {
    ...gate,
    safety: {
      ...gate.safety,
      invocationModified: true,
    },
    invocationTransitioned: true,
    invocation: {
      lifecycle: transitionResult.value.record.lifecycle,
      revision: transitionResult.value.record.revision,
      enteredAt: transitionResult.value.record.enteredAt ?? null,
    },
    persistedInvocation: {
      invocationId: transitionResult.value.record.invocationId,
      taskId: transitionResult.value.record.taskId,
      taskStateRevision: transitionResult.value.record.taskStateRevision,
      attemptId: transitionResult.value.record.attemptId,
      attemptNumber: transitionResult.value.record.attemptNumber,
      workItemId: transitionResult.value.record.workItemId ?? null,
      batchId: transitionResult.value.record.batchId ?? null,
      lifecycle: transitionResult.value.record.lifecycle,
      idempotencyKey: transitionResult.value.record.idempotencyKey,
      revision: transitionResult.value.record.revision,
      enteredAt: transitionResult.value.record.enteredAt ?? null,
      path: transitionResult.value.path,
    },
    externalBoundary: TASK_EXECUTION_PRODUCTION_DISPATCH_BOUNDARY,
  };
}
