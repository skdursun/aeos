// @ts-expect-error Node built-ins are available at runtime; this package does not depend on Node ambient types yet.
import { createHash } from "node:crypto";

import type {
  AgenticExecutionAttemptId,
  AgenticTaskId,
} from "./agentic-lifecycle.js";
import type {
  TaskExecutionAdapterOperationKind,
} from "./task-execution-adapter.js";
import type {
  TaskExecutionPermissionKind,
  TaskExecutionPolicyAuthorizationProof,
} from "./task-execution-permission-gate.js";
import type { AeosError, Result } from "./types.js";

export const AEOS_TASK_EXECUTION_POLICY_APPROVAL_SCHEMA_VERSION = 1;
export const AEOS_TASK_EXECUTION_POLICY_APPROVAL_REVISION = 1;
export const TASK_EXECUTION_LOCAL_OPERATOR_POLICY_AUTHORITY_ID =
  "local-operator-policy-authority";
export const TASK_EXECUTION_POLICY_APPROVAL_TEST_ADAPTER_ID =
  "test-execution-adapter";

export type TaskExecutionPolicyApprovalDecision = "approved" | "denied";

export interface TaskExecutionPolicyApprovalBinding {
  readonly policyGateId: string;
  readonly taskId: AgenticTaskId;
  readonly taskStateRevision: number;
  readonly attemptId: AgenticExecutionAttemptId;
  readonly invocationId: string;
  readonly adapterId: string;
  readonly operation: TaskExecutionAdapterOperationKind;
  readonly requiredPermissions: readonly TaskExecutionPermissionKind[];
}

export interface TaskExecutionPolicyApprovalAuthority {
  readonly kind: "local_operator";
  readonly authority: "system";
  readonly sourceId: typeof TASK_EXECUTION_LOCAL_OPERATOR_POLICY_AUTHORITY_ID;
}

export interface TaskExecutionPolicyApprovalSafety {
  readonly authority: "system";
  readonly rawCredentialMaterialPresent: false;
  readonly invocationOwnershipCapabilityPresent: false;
  readonly adapterInvoked: false;
  readonly providerCalled: false;
  readonly credentialResolved: false;
  readonly taskModified: false;
  readonly attemptModified: false;
  readonly invocationModified: false;
  readonly auditUsedAsAuthorization: false;
  readonly workCompleted: false;
  readonly taskCompleted: false;
  readonly verifierRun: false;
  readonly productionExecutionEnabled: false;
}

export interface TaskExecutionPolicyApprovalIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: "error" | "warning";
  readonly category: AeosError["category"];
}

export interface TaskExecutionPolicyApprovalRecord {
  readonly schemaVersion: typeof AEOS_TASK_EXECUTION_POLICY_APPROVAL_SCHEMA_VERSION;
  readonly approvalId: string;
  readonly policyGateId: string;
  readonly taskId: AgenticTaskId;
  readonly taskStateRevision: number;
  readonly attemptId: AgenticExecutionAttemptId;
  readonly invocationId: string;
  readonly adapterId: string;
  readonly operation: TaskExecutionAdapterOperationKind;
  readonly requiredPermissions: readonly TaskExecutionPermissionKind[];
  readonly decision: TaskExecutionPolicyApprovalDecision;
  readonly authority: TaskExecutionPolicyApprovalAuthority;
  readonly createdAt: string;
  readonly expiresAt?: string;
  readonly revision: typeof AEOS_TASK_EXECUTION_POLICY_APPROVAL_REVISION;
  readonly issues: readonly TaskExecutionPolicyApprovalIssue[];
  readonly safety: TaskExecutionPolicyApprovalSafety;
}

export interface CreateTaskExecutionPolicyApprovalRecordInput
  extends TaskExecutionPolicyApprovalBinding {
  readonly decision: TaskExecutionPolicyApprovalDecision;
  readonly createdAt?: string;
  readonly expiresAt?: string;
}

export interface TaskExecutionPolicyApprovalPublicStatus {
  readonly schemaVersion: number;
  readonly approvalId: string;
  readonly policyGateId: string;
  readonly taskId: AgenticTaskId;
  readonly taskStateRevision: number;
  readonly attemptId: AgenticExecutionAttemptId;
  readonly invocationId: string;
  readonly adapterId: string;
  readonly operation: TaskExecutionAdapterOperationKind;
  readonly requiredPermissions: readonly TaskExecutionPermissionKind[];
  readonly decision: TaskExecutionPolicyApprovalDecision;
  readonly authorityKind: TaskExecutionPolicyApprovalAuthority["kind"];
  readonly authority: "system";
  readonly createdAt: string;
  readonly expiresAt: string | null;
  readonly expired: boolean;
  readonly revision: number;
  readonly issues: readonly TaskExecutionPolicyApprovalIssue[];
  readonly safety: TaskExecutionPolicyApprovalSafety;
}

export type TaskExecutionPolicyApprovalError = AeosError;

const safeIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/;

const permissionOrder = new Map<TaskExecutionPermissionKind, number>([
  ["model_invocation", 0],
  ["tool_call", 1],
  ["network", 2],
  ["filesystem", 3],
  ["process", 4],
  ["shell", 5],
  ["external_side_effect", 6],
]);

const allowedOperations = new Set<TaskExecutionAdapterOperationKind>([
  "execute_task_attempt",
  "query_invocation_status",
  "replay_invocation_result",
  "cancel_invocation",
]);

const approvalRecordKeys = new Set([
  "schemaVersion",
  "approvalId",
  "policyGateId",
  "taskId",
  "taskStateRevision",
  "attemptId",
  "invocationId",
  "adapterId",
  "operation",
  "requiredPermissions",
  "decision",
  "authority",
  "createdAt",
  "expiresAt",
  "revision",
  "issues",
  "safety",
]);

function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

function err(
  error: TaskExecutionPolicyApprovalError,
): Result<never, TaskExecutionPolicyApprovalError> {
  return { ok: false, error };
}

function createError(
  code: string,
  message: string,
  category: AeosError["category"],
  details?: Record<string, string | number | boolean | null>,
): TaskExecutionPolicyApprovalError {
  if (details === undefined) {
    return {
      code,
      message,
      category,
      retryable: false,
    };
  }

  return {
    code,
    message,
    category,
    retryable: false,
    details,
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

function isIsoLikeDate(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function safety(): TaskExecutionPolicyApprovalSafety {
  return {
    authority: "system",
    rawCredentialMaterialPresent: false,
    invocationOwnershipCapabilityPresent: false,
    adapterInvoked: false,
    providerCalled: false,
    credentialResolved: false,
    taskModified: false,
    attemptModified: false,
    invocationModified: false,
    auditUsedAsAuthorization: false,
    workCompleted: false,
    taskCompleted: false,
    verifierRun: false,
    productionExecutionEnabled: false,
  };
}

function sortedRequiredPermissions(
  permissions: readonly TaskExecutionPermissionKind[],
): readonly TaskExecutionPermissionKind[] {
  return [...permissions].sort(
    (left, right) => permissionOrder.get(left)! - permissionOrder.get(right)!,
  );
}

function permissionsValid(
  permissions: unknown,
): permissions is readonly TaskExecutionPermissionKind[] {
  return (
    Array.isArray(permissions) &&
    permissions.length === new Set(permissions).size &&
    permissions.every(
      (permission) =>
        typeof permission === "string" && permissionOrder.has(permission as TaskExecutionPermissionKind),
    )
  );
}

function bindingPayload(
  binding: TaskExecutionPolicyApprovalBinding,
): string {
  return JSON.stringify({
    schemaVersion: AEOS_TASK_EXECUTION_POLICY_APPROVAL_SCHEMA_VERSION,
    policyGateId: binding.policyGateId,
    taskId: binding.taskId,
    taskStateRevision: binding.taskStateRevision,
    attemptId: binding.attemptId,
    invocationId: binding.invocationId,
    adapterId: binding.adapterId,
    operation: binding.operation,
    requiredPermissions: sortedRequiredPermissions(binding.requiredPermissions),
  });
}

export function deriveTaskExecutionPolicyApprovalId(
  binding: TaskExecutionPolicyApprovalBinding,
): Result<string, TaskExecutionPolicyApprovalError> {
  const bindingResult = validateTaskExecutionPolicyApprovalBinding(binding);

  if (!bindingResult.ok) {
    return bindingResult;
  }

  return ok(
    `policy-approval-v1-${sha256(bindingPayload(bindingResult.value)).slice(0, 32)}`,
  );
}

export function deriveTaskExecutionPolicyGateId(input: {
  readonly taskId: AgenticTaskId;
  readonly taskStateRevision: number;
  readonly attemptId: AgenticExecutionAttemptId;
  readonly invocationId: string;
}): Result<string, TaskExecutionPolicyApprovalError> {
  if (
    !isSafeId(input.taskId) ||
    !isPositiveInteger(input.taskStateRevision) ||
    !isSafeId(input.attemptId) ||
    !isSafeId(input.invocationId)
  ) {
    return err(
      createError(
        "task_execution_policy_gate_binding_invalid",
        "Policy gate identity requires safe task, revision, attempt, and invocation bindings.",
        "validation",
      ),
    );
  }

  return ok(
    `policy-gate:${input.taskId}:${input.taskStateRevision}:${input.attemptId}:${input.invocationId}`,
  );
}

export function validateTaskExecutionPolicyApprovalBinding(
  value: unknown,
): Result<TaskExecutionPolicyApprovalBinding, TaskExecutionPolicyApprovalError> {
  if (!isRecord(value)) {
    return err(
      createError(
        "task_execution_policy_approval_binding_invalid_shape",
        "Policy approval binding must be a JSON object.",
        "validation",
      ),
    );
  }

  if (
    !isSafeId(value.policyGateId) ||
    !isSafeId(value.taskId) ||
    !isPositiveInteger(value.taskStateRevision) ||
    !isSafeId(value.attemptId) ||
    !isSafeId(value.invocationId) ||
    !isSafeId(value.adapterId) ||
    typeof value.operation !== "string" ||
    !allowedOperations.has(value.operation as TaskExecutionAdapterOperationKind) ||
    !permissionsValid(value.requiredPermissions)
  ) {
    return err(
      createError(
        "task_execution_policy_approval_binding_invalid",
        "Policy approval binding must match the closed system-owned execution context shape.",
        "validation",
      ),
    );
  }

  return ok({
    policyGateId: value.policyGateId,
    taskId: value.taskId,
    taskStateRevision: value.taskStateRevision,
    attemptId: value.attemptId,
    invocationId: value.invocationId,
    adapterId: value.adapterId,
    operation: value.operation as TaskExecutionAdapterOperationKind,
    requiredPermissions: sortedRequiredPermissions(value.requiredPermissions),
  });
}

export function createTaskExecutionPolicyApprovalRecord(
  input: CreateTaskExecutionPolicyApprovalRecordInput,
): Result<TaskExecutionPolicyApprovalRecord, TaskExecutionPolicyApprovalError> {
  const bindingResult = validateTaskExecutionPolicyApprovalBinding(input);

  if (!bindingResult.ok) {
    return bindingResult;
  }

  if (input.decision !== "approved" && input.decision !== "denied") {
    return err(
      createError(
        "task_execution_policy_approval_decision_invalid",
        "Policy approval decision must be approved or denied.",
        "validation",
      ),
    );
  }

  const createdAt = input.createdAt ?? new Date().toISOString();

  if (!isIsoLikeDate(createdAt)) {
    return err(
      createError(
        "task_execution_policy_approval_created_at_invalid",
        "Policy approval creation time must be an ISO-like date string.",
        "validation",
      ),
    );
  }

  if (input.expiresAt !== undefined && !isIsoLikeDate(input.expiresAt)) {
    return err(
      createError(
        "task_execution_policy_approval_expires_at_invalid",
        "Policy approval expiry time must be an ISO-like date string when supplied.",
        "validation",
      ),
    );
  }

  const approvalIdResult = deriveTaskExecutionPolicyApprovalId(bindingResult.value);

  if (!approvalIdResult.ok) {
    return approvalIdResult;
  }

  const record: TaskExecutionPolicyApprovalRecord = {
    schemaVersion: AEOS_TASK_EXECUTION_POLICY_APPROVAL_SCHEMA_VERSION,
    approvalId: approvalIdResult.value,
    policyGateId: bindingResult.value.policyGateId,
    taskId: bindingResult.value.taskId,
    taskStateRevision: bindingResult.value.taskStateRevision,
    attemptId: bindingResult.value.attemptId,
    invocationId: bindingResult.value.invocationId,
    adapterId: bindingResult.value.adapterId,
    operation: bindingResult.value.operation,
    requiredPermissions: bindingResult.value.requiredPermissions,
    decision: input.decision,
    authority: {
      kind: "local_operator",
      authority: "system",
      sourceId: TASK_EXECUTION_LOCAL_OPERATOR_POLICY_AUTHORITY_ID,
    },
    createdAt,
    expiresAt: input.expiresAt,
    revision: AEOS_TASK_EXECUTION_POLICY_APPROVAL_REVISION,
    issues: [],
    safety: safety(),
  };

  return validateTaskExecutionPolicyApprovalRecord(record);
}

export function validateTaskExecutionPolicyApprovalRecord(
  value: unknown,
): Result<TaskExecutionPolicyApprovalRecord, TaskExecutionPolicyApprovalError> {
  if (!isRecord(value)) {
    return err(
      createError(
        "task_execution_policy_approval_record_invalid_shape",
        "Policy approval record must be a JSON object.",
        "validation",
      ),
    );
  }

  if (!Object.keys(value).every((key) => approvalRecordKeys.has(key))) {
    return err(
      createError(
        "task_execution_policy_approval_unknown_field",
        "Policy approval record cannot contain unrecognized fields.",
        "validation",
      ),
    );
  }

  if (value.schemaVersion !== AEOS_TASK_EXECUTION_POLICY_APPROVAL_SCHEMA_VERSION) {
    return err(
      createError(
        "task_execution_policy_approval_schema_version_unsupported",
        "Policy approval record schema version is unsupported.",
        "validation",
      ),
    );
  }

  if (value.decision !== "approved" && value.decision !== "denied") {
    return err(
      createError(
        "task_execution_policy_approval_decision_unknown",
        "Unknown policy approval decision fails closed.",
        "policy",
      ),
    );
  }

  const bindingResult = validateTaskExecutionPolicyApprovalBinding(value);

  if (!bindingResult.ok) {
    return bindingResult;
  }

  const approvalIdResult = deriveTaskExecutionPolicyApprovalId(bindingResult.value);

  if (!approvalIdResult.ok) {
    return approvalIdResult;
  }

  if (
    value.approvalId !== approvalIdResult.value ||
    !isRecord(value.authority) ||
    Object.keys(value.authority).length !== 3 ||
    value.authority.kind !== "local_operator" ||
    value.authority.authority !== "system" ||
    value.authority.sourceId !== TASK_EXECUTION_LOCAL_OPERATOR_POLICY_AUTHORITY_ID ||
    !isIsoLikeDate(value.createdAt) ||
    (value.expiresAt !== undefined && !isIsoLikeDate(value.expiresAt)) ||
    value.revision !== AEOS_TASK_EXECUTION_POLICY_APPROVAL_REVISION ||
    !Array.isArray(value.issues) ||
    value.issues.length !== 0 ||
    !isRecord(value.safety) ||
    JSON.stringify(value.safety) !== JSON.stringify(safety())
  ) {
    return err(
      createError(
        "task_execution_policy_approval_record_invalid",
        "Policy approval record did not match the closed authoritative approval schema.",
        "validation",
      ),
    );
  }

  return ok(value as unknown as TaskExecutionPolicyApprovalRecord);
}

export function taskExecutionPolicyApprovalExpired(input: {
  readonly approval: TaskExecutionPolicyApprovalRecord;
  readonly now?: string;
}): boolean {
  return (
    input.now !== undefined &&
    input.approval.expiresAt !== undefined &&
    input.approval.expiresAt < input.now
  );
}

export function taskExecutionPolicyApprovalMatchesBinding(input: {
  readonly approval: TaskExecutionPolicyApprovalRecord;
  readonly binding: TaskExecutionPolicyApprovalBinding;
}): boolean {
  const bindingResult = validateTaskExecutionPolicyApprovalBinding(input.binding);

  if (!bindingResult.ok) {
    return false;
  }

  return bindingPayload(input.approval) === bindingPayload(bindingResult.value);
}

export function createTaskExecutionPolicyAuthorizationProofFromApproval(input: {
  readonly approval: TaskExecutionPolicyApprovalRecord;
}): Result<TaskExecutionPolicyAuthorizationProof, TaskExecutionPolicyApprovalError> {
  const validation = validateTaskExecutionPolicyApprovalRecord(input.approval);

  if (!validation.ok) {
    return validation;
  }

  return ok({
    proofId: validation.value.approvalId,
    source: {
      kind: "local_operator_policy_authority",
      authority: "system",
      sourceId: validation.value.authority.sourceId,
    },
    decision: validation.value.decision,
    binding: {
      taskId: validation.value.taskId,
      taskRevision: validation.value.taskStateRevision,
      attemptId: validation.value.attemptId,
      invocationId: validation.value.invocationId,
      adapterId: validation.value.adapterId,
      operationKind: validation.value.operation,
      requiredPermissions: validation.value.requiredPermissions,
      policyGateId: validation.value.policyGateId,
    },
    issuedAt: validation.value.createdAt,
    expiresAt: validation.value.expiresAt,
  });
}

export function sanitizeTaskExecutionPolicyApprovalRecord(input: {
  readonly approval: TaskExecutionPolicyApprovalRecord;
  readonly now?: string;
}): TaskExecutionPolicyApprovalPublicStatus {
  return {
    schemaVersion: input.approval.schemaVersion,
    approvalId: input.approval.approvalId,
    policyGateId: input.approval.policyGateId,
    taskId: input.approval.taskId,
    taskStateRevision: input.approval.taskStateRevision,
    attemptId: input.approval.attemptId,
    invocationId: input.approval.invocationId,
    adapterId: input.approval.adapterId,
    operation: input.approval.operation,
    requiredPermissions: input.approval.requiredPermissions,
    decision: input.approval.decision,
    authorityKind: input.approval.authority.kind,
    authority: input.approval.authority.authority,
    createdAt: input.approval.createdAt,
    expiresAt: input.approval.expiresAt ?? null,
    expired: taskExecutionPolicyApprovalExpired({
      approval: input.approval,
      now: input.now,
    }),
    revision: input.approval.revision,
    issues: input.approval.issues,
    safety: input.approval.safety,
  };
}
