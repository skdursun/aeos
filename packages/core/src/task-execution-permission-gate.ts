import type {
  AgenticExecutionAttemptId,
  AgenticTaskId,
  AgenticWorkBatchId,
  AgenticWorkItemId,
} from "./agentic-lifecycle.js";
import type {
  TaskExecutionAdapterCapabilities,
  TaskExecutionAdapterCredentialReference,
  TaskExecutionAdapterIdentity,
  TaskExecutionAdapterInvocationRequest,
  TaskExecutionAdapterOperationKind,
  TaskExecutionAdapterPermissions,
} from "./task-execution-adapter.js";
import {
  TASK_EXECUTION_ADAPTER_PRODUCTION_EXECUTION_ENABLED,
} from "./task-execution-adapter.js";
import type { AeosError } from "./types.js";

export type TaskExecutionPermissionKind =
  | "model_invocation"
  | "tool_call"
  | "network"
  | "filesystem"
  | "process"
  | "shell"
  | "external_side_effect";

export interface TaskExecutionPermissionRequirement {
  readonly permission: TaskExecutionPermissionKind;
  readonly required: boolean;
  readonly granted: boolean;
  readonly authority: "system";
}

export interface TaskExecutionCapabilityRequirement {
  readonly capability:
    | keyof TaskExecutionAdapterCapabilities
    | "test_execution_adapter";
  readonly required: boolean;
  readonly authority: "system";
}

export interface TaskExecutionPermissionGatePolicyRequirement {
  readonly required: boolean;
  readonly policyGateId: string;
  readonly referenceId?: string;
  readonly authority: "system";
}

export type TaskExecutionPolicyAuthorizationDecision =
  | "allowed"
  | "denied"
  | "approval_required"
  | "unknown";

export interface TaskExecutionPolicyAuthorizationProofSource {
  readonly kind: "test_policy_authority";
  readonly authority: "system";
  readonly sourceId: string;
}

export interface TaskExecutionPolicyAuthorizationProofBinding {
  readonly taskId: AgenticTaskId;
  readonly taskRevision: number;
  readonly attemptId: AgenticExecutionAttemptId;
  readonly invocationId: string;
  readonly adapterId: string;
  readonly operationKind: TaskExecutionAdapterOperationKind;
  readonly requiredPermissions: readonly TaskExecutionPermissionKind[];
  readonly policyGateId: string;
}

export interface TaskExecutionPolicyAuthorizationProof {
  readonly proofId: string;
  readonly source: TaskExecutionPolicyAuthorizationProofSource;
  readonly decision: TaskExecutionPolicyAuthorizationDecision;
  readonly binding: TaskExecutionPolicyAuthorizationProofBinding;
  readonly issuedAt?: string;
  readonly expiresAt?: string;
}

export type TaskExecutionPermissionDecision =
  | "allowed"
  | "denied"
  | "approval_required"
  | "proof_missing"
  | "capability_missing"
  | "permission_missing"
  | "blocked"
  | "unknown";

export interface TaskExecutionPermissionGateIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: "error" | "warning";
  readonly category: AeosError["category"];
}

export interface TaskExecutionPermissionGateSafety {
  readonly adapterInvoked: false;
  readonly productionExecutionEnabled: false;
  readonly taskModified: false;
  readonly attemptModified: false;
  readonly invocationModified: false;
  readonly workCompleted: false;
  readonly taskCompleted: false;
  readonly verifierRun: false;
  readonly auditWritten: false;
}

export interface TaskExecutionPermissionGateInput {
  readonly request: TaskExecutionAdapterInvocationRequest;
  readonly adapterIdentity: TaskExecutionAdapterIdentity;
  readonly adapterCapabilities: TaskExecutionAdapterCapabilities;
  readonly adapterPermissions: TaskExecutionAdapterPermissions;
  readonly operationKind: TaskExecutionAdapterOperationKind;
  readonly policyRequirement?: TaskExecutionPermissionGatePolicyRequirement;
  readonly requiredCapabilities?: readonly TaskExecutionCapabilityRequirement[];
  readonly requiredPermissions?: readonly TaskExecutionPermissionRequirement[];
  readonly policyAuthorizationProof?: TaskExecutionPolicyAuthorizationProof;
  readonly credentialReferenceRequired?: boolean;
  readonly credentialReference?: TaskExecutionAdapterCredentialReference;
  readonly auditRequired?: boolean;
  readonly evaluatedAt?: string;
  readonly taskOrModelAuthorizationClaims?: unknown;
  readonly adapterAuthorizationClaims?: unknown;
}

export interface TaskExecutionPermissionGateResult {
  readonly ok: boolean;
  readonly allowed: boolean;
  readonly decision: TaskExecutionPermissionDecision;
  readonly taskId: AgenticTaskId;
  readonly sourceTaskRevision: number;
  readonly attemptId: AgenticExecutionAttemptId;
  readonly invocationId: string;
  readonly adapterId: string;
  readonly operation: TaskExecutionAdapterOperationKind;
  readonly workItemId: AgenticWorkItemId | null;
  readonly batchId: AgenticWorkBatchId | null;
  readonly capabilitySatisfied: boolean;
  readonly permissionsSatisfied: boolean;
  readonly policyRequired: boolean;
  readonly policyAuthorized: boolean;
  readonly policyGateId: string;
  readonly credentialReferenceRequired: boolean;
  readonly credentialReferencePresent: boolean;
  readonly auditRequired: boolean;
  readonly issues: readonly TaskExecutionPermissionGateIssue[];
  readonly safety: TaskExecutionPermissionGateSafety;
}

const safeIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/;

const permissionSpecs: readonly {
  readonly permission: TaskExecutionPermissionKind;
  readonly field: keyof TaskExecutionAdapterPermissions;
  readonly capability?: keyof TaskExecutionAdapterCapabilities;
}[] = [
  {
    permission: "model_invocation",
    field: "modelInvocationPermission",
    capability: "supportsModelInvocation",
  },
  {
    permission: "tool_call",
    field: "toolCallPermission",
    capability: "supportsToolCalls",
  },
  {
    permission: "network",
    field: "networkPermission",
    capability: "supportsNetworkAccess",
  },
  {
    permission: "filesystem",
    field: "filesystemPermission",
    capability: "supportsFilesystemAccess",
  },
  {
    permission: "process",
    field: "processPermission",
    capability: "supportsProcessExecution",
  },
  {
    permission: "shell",
    field: "shellPermission",
    capability: "supportsShellExecution",
  },
  {
    permission: "external_side_effect",
    field: "externalSideEffectPermission",
    capability: "supportsExternalSideEffects",
  },
];

const permissionOrder = new Map(
  permissionSpecs.map((spec, index) => [spec.permission, index]),
);

const safety: TaskExecutionPermissionGateSafety = {
  adapterInvoked: false,
  productionExecutionEnabled: TASK_EXECUTION_ADAPTER_PRODUCTION_EXECUTION_ENABLED,
  taskModified: false,
  attemptModified: false,
  invocationModified: false,
  workCompleted: false,
  taskCompleted: false,
  verifierRun: false,
  auditWritten: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function issue(input: {
  readonly code: string;
  readonly message: string;
  readonly category: AeosError["category"];
  readonly severity?: "error" | "warning";
}): TaskExecutionPermissionGateIssue {
  return {
    code: input.code,
    message: input.message,
    category: input.category,
    severity: input.severity ?? "error",
  };
}

function identityValid(identity: TaskExecutionAdapterIdentity): boolean {
  return (
    isSafeId(identity.adapterId) &&
    identity.adapterKind === "test_execution" &&
    isSafeId(identity.implementationVersion) &&
    isSafeId(identity.capabilityVersion) &&
    identity.identityAuthority === "system"
  );
}

function operationCapabilityRequirements(
  operationKind: TaskExecutionAdapterOperationKind,
): readonly TaskExecutionCapabilityRequirement[] {
  if (operationKind === "execute_task_attempt") {
    return [
      {
        capability: "test_execution_adapter",
        required: true,
        authority: "system",
      },
      { capability: "supportsIdempotencyKey", required: true, authority: "system" },
      { capability: "supportsBoundedErrors", required: true, authority: "system" },
    ];
  }

  if (operationKind === "query_invocation_status") {
    return [
      {
        capability: "supportsInvocationStatusQuery",
        required: true,
        authority: "system",
      },
    ];
  }

  if (operationKind === "replay_invocation_result") {
    return [
      { capability: "supportsResultReplay", required: true, authority: "system" },
    ];
  }

  if (operationKind === "cancel_invocation") {
    return [
      { capability: "supportsCancellation", required: true, authority: "system" },
    ];
  }

  return [];
}

function permissionsFromAdapterRequirements(
  permissions: TaskExecutionAdapterPermissions,
): readonly TaskExecutionPermissionRequirement[] {
  return permissionSpecs.map((spec) => ({
    permission: spec.permission,
    required: permissions[spec.field] === true,
    granted: permissions[spec.field] === true,
    authority: "system",
  }));
}

function sortedRequiredPermissionKinds(
  requirements: readonly TaskExecutionPermissionRequirement[],
): readonly TaskExecutionPermissionKind[] {
  return requirements
    .filter((requirement) => requirement.required)
    .map((requirement) => requirement.permission)
    .sort((left, right) => permissionOrder.get(left)! - permissionOrder.get(right)!);
}

function arraysEqual(
  left: readonly TaskExecutionPermissionKind[],
  right: readonly TaskExecutionPermissionKind[],
): boolean {
  return (
    left.length === right.length &&
    left.every((item, index) => item === right[index])
  );
}

function policyRequirementFromInput(
  input: TaskExecutionPermissionGateInput,
): TaskExecutionPermissionGatePolicyRequirement {
  if (
    input.policyRequirement?.authority === "system" &&
    typeof input.policyRequirement.required === "boolean" &&
    isSafeId(input.policyRequirement.policyGateId)
  ) {
    return input.policyRequirement;
  }

  return {
    required:
      input.request.permissionRequirements.policyRequired === true ||
      input.adapterPermissions.policyRequired === true,
    policyGateId: `policy-gate:${input.request.taskId}:${input.request.sourceTaskRevision}:${input.request.attemptId}:${input.request.invocationId}`,
    authority: "system",
  };
}

function proofSourceValid(
  proof: TaskExecutionPolicyAuthorizationProof | undefined,
): boolean {
  return (
    proof !== undefined &&
    isRecord(proof.source) &&
    proof.source.kind === "test_policy_authority" &&
    proof.source.authority === "system" &&
    isSafeId(proof.source.sourceId)
  );
}

function proofExpired(input: {
  readonly proof: TaskExecutionPolicyAuthorizationProof;
  readonly evaluatedAt?: string;
}): boolean {
  return (
    input.evaluatedAt !== undefined &&
    input.proof.expiresAt !== undefined &&
    input.proof.expiresAt < input.evaluatedAt
  );
}

function decisionFromIssues(
  issues: readonly TaskExecutionPermissionGateIssue[],
): TaskExecutionPermissionDecision {
  const errorCodes = issues
    .filter((item) => item.severity === "error")
    .map((item) => item.code);

  if (errorCodes.length === 0) {
    return "allowed";
  }

  if (errorCodes.includes("task_execution_permission_gate_policy_proof_missing")) {
    return "proof_missing";
  }

  if (errorCodes.includes("task_execution_permission_gate_policy_denied")) {
    return "denied";
  }

  if (errorCodes.includes("task_execution_permission_gate_policy_approval_required")) {
    return "approval_required";
  }

  if (
    errorCodes.some((code) =>
      [
        "task_execution_permission_gate_capability_missing",
        "task_execution_permission_gate_operation_capability_missing",
      ].includes(code),
    )
  ) {
    return "capability_missing";
  }

  if (
    errorCodes.some((code) =>
      [
        "task_execution_permission_gate_permission_missing",
        "task_execution_permission_gate_credential_reference_missing",
      ].includes(code),
    )
  ) {
    return "permission_missing";
  }

  return "blocked";
}

export function evaluateTaskExecutionPermissionGate(
  input: TaskExecutionPermissionGateInput,
): TaskExecutionPermissionGateResult {
  const issues: TaskExecutionPermissionGateIssue[] = [];
  const policyRequirement = policyRequirementFromInput(input);
  const requiredCapabilities = [
    ...operationCapabilityRequirements(input.operationKind),
    ...(input.requiredCapabilities ?? []),
  ];
  const permissionRequirements =
    input.requiredPermissions ??
    permissionsFromAdapterRequirements(input.request.permissionRequirements);
  const requiredPermissions = sortedRequiredPermissionKinds(permissionRequirements);
  const credentialReference =
    input.credentialReference ?? input.request.credentialReference;
  const credentialReferenceRequired = input.credentialReferenceRequired ?? false;

  if (!identityValid(input.adapterIdentity)) {
    issues.push(
      issue({
        code: "task_execution_permission_gate_adapter_identity_invalid",
        message:
          "Execution permission gate requires a valid system-owned test execution adapter identity.",
        category: "validation",
      }),
    );
  }

  if (input.adapterIdentity.adapterId !== input.request.adapterIdentity.adapterId) {
    issues.push(
      issue({
        code: "task_execution_permission_gate_adapter_identity_mismatch",
        message:
          "Adapter identity does not match the authoritative invocation request binding.",
        category: "validation",
      }),
    );
  }

  if (input.operationKind !== input.request.operationKind) {
    issues.push(
      issue({
        code: "task_execution_permission_gate_operation_mismatch",
        message:
          "Requested operation does not match the authoritative invocation request operation.",
        category: "validation",
      }),
    );
  }

  if (
    !isSafeId(input.request.invocationId) ||
    !isSafeId(input.request.taskId) ||
    !isPositiveInteger(input.request.sourceTaskRevision) ||
    !isSafeId(input.request.attemptId) ||
    !isPositiveInteger(input.request.attemptNumber)
  ) {
    issues.push(
      issue({
        code: "task_execution_permission_gate_invocation_binding_invalid",
        message:
          "Permission gate input must be bound to a valid authoritative invocation context.",
        category: "validation",
      }),
    );
  }

  if (input.adapterPermissions.permissionAuthority !== "system") {
    issues.push(
      issue({
        code: "task_execution_permission_gate_permission_authority_invalid",
        message:
          "Execution permission grants must come from system authority.",
        category: "permission",
      }),
    );
  }

  if (input.adapterPermissions.policyAuthorized !== false) {
    issues.push(
      issue({
        code: "task_execution_permission_gate_adapter_self_authorization_forbidden",
        message:
          "Execution adapters cannot self-authorize policy approval.",
        category: "policy",
      }),
    );
  }

  if (input.request.permissionRequirements.policyAuthorized !== false) {
    issues.push(
      issue({
        code: "task_execution_permission_gate_request_self_authorization_forbidden",
        message:
          "Invocation permission requirements cannot carry self-authorized policy approval.",
        category: "policy",
      }),
    );
  }

  if (
    input.policyRequirement !== undefined &&
    (input.policyRequirement.authority !== "system" ||
      typeof input.policyRequirement.required !== "boolean" ||
      !isSafeId(input.policyRequirement.policyGateId))
  ) {
    issues.push(
      issue({
        code: "task_execution_permission_gate_policy_requirement_invalid",
        message:
          "Policy requirement must be valid system-owned gate metadata.",
        category: "policy",
      }),
    );
  }

  for (const capabilityRequirement of requiredCapabilities) {
    if (
      capabilityRequirement.authority !== "system" ||
      capabilityRequirement.required !== true
    ) {
      continue;
    }

    const capabilitySatisfied =
      capabilityRequirement.capability === "test_execution_adapter"
        ? input.adapterIdentity.adapterKind === "test_execution"
        : input.adapterCapabilities[capabilityRequirement.capability] === true;

    if (!capabilitySatisfied) {
      issues.push(
        issue({
          code: "task_execution_permission_gate_capability_missing",
          message:
            "System-owned adapter capability metadata does not satisfy the requested operation.",
          category: "permission",
        }),
      );
    }
  }

  for (const permissionRequirement of permissionRequirements) {
    const spec = permissionSpecs.find(
      (item) => item.permission === permissionRequirement.permission,
    );

    if (spec === undefined || permissionRequirement.authority !== "system") {
      issues.push(
        issue({
          code: "task_execution_permission_gate_permission_requirement_invalid",
          message:
            "Permission requirement must use the closed system-owned execution permission set.",
          category: "permission",
        }),
      );
      continue;
    }

    if (!permissionRequirement.required) {
      continue;
    }

    if (
      spec.capability !== undefined &&
      input.adapterCapabilities[spec.capability] !== true
    ) {
      issues.push(
        issue({
          code: "task_execution_permission_gate_capability_missing",
          message:
            "Permission requires an adapter capability that the system-owned adapter definition does not provide.",
          category: "permission",
        }),
      );
    }

    if (
      permissionRequirement.granted !== true ||
      input.adapterPermissions[spec.field] !== true
    ) {
      issues.push(
        issue({
          code: "task_execution_permission_gate_permission_missing",
          message:
            "Required execution permission is not granted by the current system-owned execution context.",
          category: "permission",
        }),
      );
    }
  }

  if (credentialReferenceRequired && credentialReference === undefined) {
    issues.push(
      issue({
        code: "task_execution_permission_gate_credential_reference_missing",
        message:
          "A credential reference is required, but no system-owned credential reference is present.",
        category: "permission",
      }),
    );
  }

  if (policyRequirement.authority !== "system") {
    issues.push(
      issue({
        code: "task_execution_permission_gate_policy_requirement_authority_invalid",
        message:
          "Policy requirement must come from system authority.",
        category: "policy",
      }),
    );
  }

  if (input.taskOrModelAuthorizationClaims !== undefined) {
    issues.push(
      issue({
        code: "task_execution_permission_gate_task_model_authorization_claims_ignored",
        message:
          "Task or model authorization prose is ignored by the execution permission gate.",
        severity: "warning",
        category: "validation",
      }),
    );
  }

  if (input.adapterAuthorizationClaims !== undefined) {
    issues.push(
      issue({
        code: "task_execution_permission_gate_adapter_authorization_claims_ignored",
        message:
          "Adapter authorization claims are ignored by the execution permission gate.",
        severity: "warning",
        category: "validation",
      }),
    );
  }

  if (policyRequirement.required) {
    const proof = input.policyAuthorizationProof;

    if (proof === undefined || !isRecord(proof)) {
      issues.push(
        issue({
          code: "task_execution_permission_gate_policy_proof_missing",
          message:
            "Policy is required, but no authoritative policy authorization proof was supplied.",
          category: "policy",
        }),
      );
    } else if (!proofSourceValid(proof)) {
      issues.push(
        issue({
          code: "task_execution_permission_gate_policy_proof_source_invalid",
          message:
            "Policy authorization proof must come from the TEST-only system policy authority.",
          category: "policy",
        }),
      );
    } else if (proofExpired({ proof, evaluatedAt: input.evaluatedAt })) {
      issues.push(
        issue({
          code: "task_execution_permission_gate_policy_proof_expired",
          message:
            "Policy authorization proof expired before this gate evaluation.",
          category: "policy",
        }),
      );
    } else if (
      proof.binding.taskId !== input.request.taskId ||
      proof.binding.taskRevision !== input.request.sourceTaskRevision ||
      proof.binding.attemptId !== input.request.attemptId ||
      proof.binding.invocationId !== input.request.invocationId ||
      proof.binding.adapterId !== input.adapterIdentity.adapterId ||
      proof.binding.operationKind !== input.operationKind ||
      proof.binding.policyGateId !== policyRequirement.policyGateId ||
      !arraysEqual(proof.binding.requiredPermissions, requiredPermissions)
    ) {
      issues.push(
        issue({
          code: "task_execution_permission_gate_policy_proof_binding_mismatch",
          message:
            "Policy authorization proof does not match the exact authoritative invocation context.",
          category: "policy",
        }),
      );
    } else if (proof.decision === "denied") {
      issues.push(
        issue({
          code: "task_execution_permission_gate_policy_denied",
          message:
            "Policy authorization proof explicitly denied this invocation.",
          category: "policy",
        }),
      );
    } else if (proof.decision === "approval_required") {
      issues.push(
        issue({
          code: "task_execution_permission_gate_policy_approval_required",
          message:
            "Policy authorization proof reports that approval remains required.",
          category: "policy",
        }),
      );
    } else if (proof.decision !== "allowed") {
      issues.push(
        issue({
          code: "task_execution_permission_gate_policy_decision_unknown",
          message:
            "Unknown or missing policy authorization proof decision fails closed.",
          category: "policy",
        }),
      );
    }
  }

  const decision = decisionFromIssues(issues);
  const allowed = decision === "allowed";
  const capabilitySatisfied = !issues.some(
    (item) =>
      item.severity === "error" &&
      item.code === "task_execution_permission_gate_capability_missing",
  );
  const permissionsSatisfied = !issues.some(
    (item) =>
      item.severity === "error" &&
      [
        "task_execution_permission_gate_permission_missing",
        "task_execution_permission_gate_credential_reference_missing",
        "task_execution_permission_gate_permission_authority_invalid",
      ].includes(item.code),
  );

  return {
    ok: allowed,
    allowed,
    decision,
    taskId: input.request.taskId,
    sourceTaskRevision: input.request.sourceTaskRevision,
    attemptId: input.request.attemptId,
    invocationId: input.request.invocationId,
    adapterId: input.adapterIdentity.adapterId,
    operation: input.operationKind,
    workItemId: input.request.workItemId ?? null,
    batchId: input.request.batchId ?? null,
    capabilitySatisfied,
    permissionsSatisfied,
    policyRequired: policyRequirement.required,
    policyAuthorized:
      policyRequirement.required &&
      input.policyAuthorizationProof?.decision === "allowed" &&
      allowed,
    policyGateId: policyRequirement.policyGateId,
    credentialReferenceRequired,
    credentialReferencePresent: credentialReference !== undefined,
    auditRequired: input.auditRequired ?? false,
    issues,
    safety,
  };
}
