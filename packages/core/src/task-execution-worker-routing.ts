// @ts-expect-error Node built-ins are available at runtime; this package does not depend on Node ambient types yet.
import { createHash } from "node:crypto";

import type {
  AgenticTaskId,
  AgenticWorkBatchId,
  AgenticWorkItemId,
} from "./agentic-lifecycle.js";
import type { PersistedTaskState } from "./task-state-persistence.js";
import type { TaskExecutionAdapterOperationKind } from "./task-execution-adapter.js";
import type {
  TaskExecutionWorkerCapabilities,
  TaskExecutionWorkerFamily,
  TaskExecutionWorkerIdentity,
} from "./task-execution-worker.js";
import type { AeosError } from "./types.js";

export const TASK_EXECUTION_WORKER_ROUTING_DECISION_VERSION = 1;
export const TASK_EXECUTION_WORKER_ROUTING_AUTHORITY_READY = true;
export const TASK_EXECUTION_WORKER_ROUTING_REAL_CODEX_CALLS = 0;
export const TASK_EXECUTION_WORKER_ROUTING_REAL_CLAUDE_CALLS = 0;
export const TASK_EXECUTION_WORKER_ROUTING_WORKER_PROCESSES = 0;
export const TASK_EXECUTION_WORKER_ROUTING_PRIMARY_APPLIES = 0;
export const TASK_EXECUTION_WORKER_ROUTING_CLOUD_CALLS = 0;
export const TASK_EXECUTION_WORKER_ROUTING_AUTOMATIC_WORKER_LAUNCH_ENABLED =
  false;
export const TASK_EXECUTION_WORKER_ROUTING_GENERAL_PRIMARY_APPLY_ENABLED =
  false;
export const TASK_EXECUTION_WORKER_ROUTING_AUTOMATIC_PATCH_APPLY_ENABLED =
  false;

export type TaskExecutionWorkerRoutingCapability =
  | "planner"
  | "implementation"
  | "verifier"
  | "repositoryRead"
  | "repositoryWrite"
  | "processExecution"
  | "shellExecution"
  | "toolExecution"
  | "modelReasoning"
  | "patchGeneration"
  | "testExecution"
  | "boundedDiagnostics"
  | "deterministicTestResult";

export interface TaskExecutionWorkerRoutingProposal {
  readonly proposalId?: string;
  readonly taskId: AgenticTaskId;
  readonly sourceTaskRevision: number;
  readonly workItemId: AgenticWorkItemId;
  readonly batchId?: AgenticWorkBatchId;
  readonly operationKind: TaskExecutionAdapterOperationKind;
  readonly recommendedWorkerFamily: TaskExecutionWorkerFamily;
  readonly capabilityRequirements?: readonly TaskExecutionWorkerRoutingCapability[];
  readonly reasonReference?: string;
  readonly expectedOperationClass?: "planning" | "implementation" | "verification";
}

export interface TaskExecutionWorkerRoutingIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: "info" | "warning" | "error";
  readonly category: AeosError["category"];
}

export interface EvaluatedTaskExecutionWorkerRoutingProposal {
  readonly accepted: boolean;
  readonly proposal: TaskExecutionWorkerRoutingProposal | null;
  readonly ignoredAuthorityFields: readonly string[];
  readonly issues: readonly TaskExecutionWorkerRoutingIssue[];
}

export interface TaskExecutionWorkerRegistryEntry {
  readonly identity: TaskExecutionWorkerIdentity;
  readonly capabilities: TaskExecutionWorkerCapabilities;
  readonly eligible: boolean;
  readonly allowedOperations: readonly TaskExecutionAdapterOperationKind[];
  readonly registrationAuthority: "system";
}

export interface TaskExecutionWorkerRoutingPolicyRule {
  readonly ruleRef: string;
  readonly operationKind: TaskExecutionAdapterOperationKind;
  readonly allowedWorkerFamilies: readonly TaskExecutionWorkerFamily[];
  readonly requiredCapabilities: readonly TaskExecutionWorkerRoutingCapability[];
  readonly allowedPlannerFamilies: readonly TaskExecutionWorkerFamily[];
}

export interface TaskExecutionWorkerRoutingPermissionPolicyStatus {
  readonly authority: "system";
  readonly allowed: boolean;
  readonly policyContradiction: boolean;
  readonly permissionContradiction: boolean;
  readonly capabilityContradiction?: boolean;
  readonly policyRuleRef?: string;
}

export interface TaskExecutionWorkerRoutingSafety {
  readonly realCodexCalls: 0;
  readonly realClaudeCalls: 0;
  readonly workerProcesses: 0;
  readonly primaryApplies: 0;
  readonly cloudCalls: 0;
  readonly filesystemMutations: 0;
  readonly automaticWorkerLaunchEnabled: false;
  readonly generalPrimaryApplyEnabled: false;
  readonly automaticPatchApply: false;
  readonly workAccountingModified: false;
  readonly verifierSatisfied: false;
  readonly completionGateSatisfied: false;
  readonly taskComplete: false;
  readonly retryAuthorized: false;
  readonly modelSelfReportTrusted: false;
}

export interface TaskExecutionWorkerRoutingDecision {
  readonly decisionVersion: typeof TASK_EXECUTION_WORKER_ROUTING_DECISION_VERSION;
  readonly decisionId: string;
  readonly authority: "system";
  readonly status: "authorized" | "blocked";
  readonly taskId: AgenticTaskId;
  readonly sourceTaskRevision: number;
  readonly workItemId: AgenticWorkItemId | null;
  readonly batchId: AgenticWorkBatchId | null;
  readonly operationKind: TaskExecutionAdapterOperationKind;
  readonly requiredCapabilities: readonly TaskExecutionWorkerRoutingCapability[];
  readonly selectedWorkerFamily: TaskExecutionWorkerFamily | null;
  readonly selectedWorkerIdentity: TaskExecutionWorkerIdentity | null;
  readonly routingPolicyRuleRef: string;
  readonly issues: readonly TaskExecutionWorkerRoutingIssue[];
  readonly ignoredAuthorityFields: readonly string[];
  readonly safety: TaskExecutionWorkerRoutingSafety;
}

export interface TaskExecutionWorkerRoutingAuthority {
  readonly authority: "system";
  readonly decisionVersion: typeof TASK_EXECUTION_WORKER_ROUTING_DECISION_VERSION;
  readonly authorizeRoute: typeof authorizeTaskExecutionWorkerRoute;
}

export interface AuthorizeTaskExecutionWorkerRouteInput {
  readonly state: PersistedTaskState;
  readonly proposals:
    | TaskExecutionWorkerRoutingProposal
    | unknown
    | readonly (TaskExecutionWorkerRoutingProposal | unknown)[];
  readonly orchestratorIdentity: TaskExecutionWorkerIdentity;
  readonly orchestratorCapabilities: TaskExecutionWorkerCapabilities;
  readonly workerRegistry: readonly TaskExecutionWorkerRegistryEntry[];
  readonly permissionPolicyStatus?: TaskExecutionWorkerRoutingPermissionPolicyStatus;
  readonly policyRules?: readonly TaskExecutionWorkerRoutingPolicyRule[];
}

const safeIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/;

const allowedFamilies = new Set<string>(["generic", "codex", "claude_code"]);
const allowedOperations = new Set<string>([
  "execute_task_attempt",
  "query_invocation_status",
  "replay_invocation_result",
  "cancel_invocation",
]);
const allowedCapabilities = new Set<string>([
  "planner",
  "implementation",
  "verifier",
  "repositoryRead",
  "repositoryWrite",
  "processExecution",
  "shellExecution",
  "toolExecution",
  "modelReasoning",
  "patchGeneration",
  "testExecution",
  "boundedDiagnostics",
  "deterministicTestResult",
]);
const forbiddenAuthorityKeys = new Set<string>([
  "attemptid",
  "completed",
  "completionclaim",
  "completiongatesatisfied",
  "credential",
  "cwd",
  "environment",
  "executable",
  "idempotencykey",
  "invocationid",
  "invokenow",
  "ownershiptoken",
  "permissiongrant",
  "permissiongranted",
  "policyapproval",
  "policyapproved",
  "retryauthority",
  "role",
  "safetoretry",
  "selectedworker",
  "taskcompleted",
  "overridetaskrevision",
  "verified",
  "verifiersatisfied",
  "workeridentity",
]);

const routingSafety: TaskExecutionWorkerRoutingSafety = {
  realCodexCalls: TASK_EXECUTION_WORKER_ROUTING_REAL_CODEX_CALLS,
  realClaudeCalls: TASK_EXECUTION_WORKER_ROUTING_REAL_CLAUDE_CALLS,
  workerProcesses: TASK_EXECUTION_WORKER_ROUTING_WORKER_PROCESSES,
  primaryApplies: TASK_EXECUTION_WORKER_ROUTING_PRIMARY_APPLIES,
  cloudCalls: TASK_EXECUTION_WORKER_ROUTING_CLOUD_CALLS,
  filesystemMutations: 0,
  automaticWorkerLaunchEnabled:
    TASK_EXECUTION_WORKER_ROUTING_AUTOMATIC_WORKER_LAUNCH_ENABLED,
  generalPrimaryApplyEnabled:
    TASK_EXECUTION_WORKER_ROUTING_GENERAL_PRIMARY_APPLY_ENABLED,
  automaticPatchApply:
    TASK_EXECUTION_WORKER_ROUTING_AUTOMATIC_PATCH_APPLY_ENABLED,
  workAccountingModified: false,
  verifierSatisfied: false,
  completionGateSatisfied: false,
  taskComplete: false,
  retryAuthorized: false,
  modelSelfReportTrusted: false,
};

const defaultRoutingPolicyRules: readonly TaskExecutionWorkerRoutingPolicyRule[] =
  [
    {
      ruleRef: "aeos-routing-policy:execute-task-attempt:test-worker-v1",
      operationKind: "execute_task_attempt",
      allowedWorkerFamilies: ["claude_code", "codex", "generic"],
      requiredCapabilities: [
        "implementation",
        "boundedDiagnostics",
        "deterministicTestResult",
      ],
      allowedPlannerFamilies: ["codex", "generic"],
    },
  ];

export const taskExecutionWorkerRoutingAuthority: TaskExecutionWorkerRoutingAuthority =
  {
    authority: "system",
    decisionVersion: TASK_EXECUTION_WORKER_ROUTING_DECISION_VERSION,
    authorizeRoute: authorizeTaskExecutionWorkerRoute,
  };

export function evaluateTaskExecutionWorkerRoutingProposal(
  proposal: unknown,
): EvaluatedTaskExecutionWorkerRoutingProposal {
  const issues: TaskExecutionWorkerRoutingIssue[] = [];

  if (!isRecord(proposal)) {
    return {
      accepted: false,
      proposal: null,
      ignoredAuthorityFields: [],
      issues: [
        issue({
          code: "task_execution_worker_routing_proposal_invalid",
          message: "Worker routing proposal must be a bounded object.",
          category: "validation",
        }),
      ],
    };
  }

  const ignoredAuthorityFields = Object.keys(proposal)
    .filter((key) => forbiddenAuthorityKeys.has(key.toLowerCase()))
    .sort();

  if (ignoredAuthorityFields.length > 0) {
    issues.push(
      issue({
        code: "task_execution_worker_routing_proposal_authority_fields_ignored",
        message:
          "Task/model routing proposal contained authority fields that AEOS routing ignores.",
        severity: "warning",
        category: "validation",
      }),
    );
  }

  const taskId = stringField(proposal, "taskId");
  const workItemId = stringField(proposal, "workItemId");
  const sourceTaskRevision = numberField(proposal, "sourceTaskRevision");
  const batchId = optionalStringField(proposal, "batchId");
  const operationKind = stringField(proposal, "operationKind");
  const recommendedWorkerFamily = stringField(
    proposal,
    "recommendedWorkerFamily",
  );
  const capabilityRequirements = capabilityRequirementsFromUnknown(
    proposal.capabilityRequirements,
  );
  const reasonReference = optionalStringField(proposal, "reasonReference");
  const proposalId = optionalStringField(proposal, "proposalId");
  const expectedOperationClass = operationClassFromUnknown(
    proposal.expectedOperationClass,
  );

  if (!isSafeId(taskId)) {
    issues.push(
      issue({
        code: "task_execution_worker_routing_proposal_task_invalid",
        message: "Routing proposal must name a valid task id.",
        category: "validation",
      }),
    );
  }

  if (!isPositiveInteger(sourceTaskRevision)) {
    issues.push(
      issue({
        code: "task_execution_worker_routing_proposal_revision_invalid",
        message: "Routing proposal must name a positive task revision.",
        category: "validation",
      }),
    );
  }

  if (!isSafeId(workItemId)) {
    issues.push(
      issue({
        code: "task_execution_worker_routing_proposal_work_item_invalid",
        message: "Routing proposal must name a valid work item id.",
        category: "validation",
      }),
    );
  }

  if (batchId !== undefined && !isSafeId(batchId)) {
    issues.push(
      issue({
        code: "task_execution_worker_routing_proposal_batch_invalid",
        message: "Routing proposal batch id must be a safe id when present.",
        category: "validation",
      }),
    );
  }

  if (!allowedOperations.has(operationKind ?? "")) {
    issues.push(
      issue({
        code: "task_execution_worker_routing_proposal_operation_invalid",
        message: "Routing proposal operation is not in the closed operation set.",
        category: "validation",
      }),
    );
  }

  if (!allowedFamilies.has(recommendedWorkerFamily ?? "")) {
    issues.push(
      issue({
        code: "task_execution_worker_routing_worker_unknown",
        message: "Routing proposal selected an unknown worker family.",
        category: "not_found",
      }),
    );
  }

  if (capabilityRequirements === undefined) {
    issues.push(
      issue({
        code: "task_execution_worker_routing_capability_requirement_invalid",
        message:
          "Routing proposal capability requirements must use the closed capability set.",
        category: "validation",
      }),
    );
  }

  const accepted = !issues.some((item) => item.severity === "error");

  return {
    accepted,
    proposal: accepted
      ? {
          proposalId,
          taskId: taskId as AgenticTaskId,
          sourceTaskRevision: sourceTaskRevision as number,
          workItemId: workItemId as AgenticWorkItemId,
          batchId: batchId as AgenticWorkBatchId | undefined,
          operationKind: operationKind as TaskExecutionAdapterOperationKind,
          recommendedWorkerFamily:
            recommendedWorkerFamily as TaskExecutionWorkerFamily,
          capabilityRequirements,
          reasonReference,
          expectedOperationClass,
        }
      : null,
    ignoredAuthorityFields,
    issues,
  };
}

export function authorizeTaskExecutionWorkerRoute(
  input: AuthorizeTaskExecutionWorkerRouteInput,
): TaskExecutionWorkerRoutingDecision {
  const proposals = Array.isArray(input.proposals)
    ? input.proposals
    : [input.proposals];
  const evaluated = proposals.map((proposal) =>
    evaluateTaskExecutionWorkerRoutingProposal(proposal),
  );
  const issues = evaluated.flatMap((item) => item.issues);
  const ignoredAuthorityFields = uniqueSorted(
    evaluated.flatMap((item) => item.ignoredAuthorityFields),
  );
  const acceptedProposals = evaluated
    .map((item) => item.proposal)
    .filter((item): item is TaskExecutionWorkerRoutingProposal => item !== null);

  if (acceptedProposals.length === 0) {
    return blockedDecision({
      input,
      proposal: null,
      issues,
      ignoredAuthorityFields,
      ruleRef: "aeos-routing-policy:none",
    });
  }

  const firstProposal = acceptedProposals[0];
  if (!acceptedProposals.every((proposal) => proposalsEquivalent(firstProposal, proposal))) {
    issues.push(
      issue({
        code: "task_execution_worker_routing_conflicting_proposals",
        message:
          "Conflicting routing proposals require an explicit AEOS decision gate and are blocked.",
        category: "conflict",
      }),
    );
    return blockedDecision({
      input,
      proposal: firstProposal,
      issues,
      ignoredAuthorityFields,
      ruleRef: "aeos-routing-policy:conflict",
    });
  }

  const proposal = firstProposal;
  const policyRule = selectPolicyRule(input.policyRules, proposal.operationKind);
  const ruleRef = input.permissionPolicyStatus?.policyRuleRef
    ?? policyRule?.ruleRef
    ?? "aeos-routing-policy:none";
  const workItem = input.state.workItems.find(
    (item) => item.id === proposal.workItemId,
  );
  const proposalBatchId = proposal.batchId ?? null;
  const authoritativeBatchId = workItem?.batchId ?? proposal.batchId ?? null;

  if (!identityValid(input.orchestratorIdentity)) {
    issues.push(
      issue({
        code: "task_execution_worker_routing_orchestrator_identity_invalid",
        message: "Routing requires a valid system-owned orchestrator identity.",
        category: "validation",
      }),
    );
  }

  if (
    !input.orchestratorCapabilities.roles.includes("planner") ||
    !input.orchestratorCapabilities.deterministicTestResult
  ) {
    issues.push(
      issue({
        code: "task_execution_worker_routing_orchestrator_not_authorized",
        message:
          "Worker routing proposals require system-owned planner capability and do not trust worker self-routing.",
        category: "permission",
      }),
    );
  }

  if (
    policyRule !== undefined &&
    !policyRule.allowedPlannerFamilies.includes(
      input.orchestratorIdentity.workerFamily,
    )
  ) {
    issues.push(
      issue({
        code: "task_execution_worker_routing_orchestrator_family_not_allowed",
        message:
          "Routing policy does not allow this worker family to act as planner for the operation.",
        category: "policy",
      }),
    );
  }

  if (proposal.taskId !== input.state.taskId) {
    issues.push(
      issue({
        code: "task_execution_worker_routing_task_mismatch",
        message: "Routing proposal attempted to route a different task.",
        category: "conflict",
      }),
    );
  }

  if (proposal.sourceTaskRevision !== input.state.revision) {
    issues.push(
      issue({
        code: "task_execution_worker_routing_stale_task_revision",
        message:
          "Routing proposal source revision must match the current task state revision.",
        category: "conflict",
      }),
    );
  }

  if (workItem === undefined) {
    issues.push(
      issue({
        code: "task_execution_worker_routing_work_item_unknown",
        message: "Routing proposal referenced an unknown authoritative work item.",
        category: "not_found",
      }),
    );
  }

  if (
    workItem !== undefined &&
    proposalBatchId !== null &&
    workItem.batchId !== proposalBatchId
  ) {
    issues.push(
      issue({
        code: "task_execution_worker_routing_batch_mismatch",
        message:
          "Routing proposal batch does not match the authoritative work item batch.",
        category: "conflict",
      }),
    );
  }

  const authoritativeBatch =
    authoritativeBatchId === null
      ? undefined
      : input.state.batches.find((batch) => batch.id === authoritativeBatchId);

  if (
    authoritativeBatchId !== null &&
    (authoritativeBatch === undefined ||
      !authoritativeBatch.workItemIds.includes(proposal.workItemId))
  ) {
    issues.push(
      issue({
        code: "task_execution_worker_routing_batch_unknown",
        message:
          "Routing proposal referenced a batch that does not authoritatively contain the work item.",
        category: "not_found",
      }),
    );
  }

  if (policyRule === undefined) {
    issues.push(
      issue({
        code: "task_execution_worker_routing_policy_rule_missing",
        message: "No system-owned routing policy rule permits this operation.",
        category: "policy",
      }),
    );
  } else if (
    !policyRule.allowedWorkerFamilies.includes(proposal.recommendedWorkerFamily)
  ) {
    issues.push(
      issue({
        code: "task_execution_worker_routing_worker_family_not_allowed",
        message:
          "System routing policy does not permit the proposed worker family for this operation.",
        category: "policy",
      }),
    );
  }

  const permissionPolicyStatus = input.permissionPolicyStatus;
  if (
    permissionPolicyStatus !== undefined &&
    (permissionPolicyStatus.authority !== "system" ||
      !permissionPolicyStatus.allowed ||
      permissionPolicyStatus.policyContradiction ||
      permissionPolicyStatus.permissionContradiction ||
      permissionPolicyStatus.capabilityContradiction === true)
  ) {
    issues.push(
      issue({
        code: "task_execution_worker_routing_permission_policy_contradiction",
        message:
          "System permission or policy context contradicts the proposed worker route.",
        category: "permission",
      }),
    );
  }

  const requiredCapabilities = uniqueSorted([
    ...(policyRule?.requiredCapabilities ?? []),
    ...(proposal.capabilityRequirements ?? []),
  ]);
  const selectedWorker = selectWorker({
    registry: input.workerRegistry,
    family: proposal.recommendedWorkerFamily,
    operationKind: proposal.operationKind,
    requiredCapabilities,
  });
  issues.push(...selectedWorker.issues);

  if (issues.some((item) => item.severity === "error")) {
    return blockedDecision({
      input,
      proposal,
      issues,
      ignoredAuthorityFields,
      ruleRef,
      requiredCapabilities,
      authoritativeBatchId,
    });
  }

  return {
    decisionVersion: TASK_EXECUTION_WORKER_ROUTING_DECISION_VERSION,
    decisionId: decisionIdFrom({
      status: "authorized",
      taskId: input.state.taskId,
      sourceTaskRevision: input.state.revision,
      workItemId: proposal.workItemId,
      batchId: authoritativeBatchId,
      operationKind: proposal.operationKind,
      requiredCapabilities,
      selectedWorkerFamily: selectedWorker.worker.identity.workerFamily,
      selectedWorkerId: selectedWorker.worker.identity.workerId,
      routingPolicyRuleRef: ruleRef,
    }),
    authority: "system",
    status: "authorized",
    taskId: input.state.taskId,
    sourceTaskRevision: input.state.revision,
    workItemId: proposal.workItemId,
    batchId: authoritativeBatchId,
    operationKind: proposal.operationKind,
    requiredCapabilities,
    selectedWorkerFamily: selectedWorker.worker.identity.workerFamily,
    selectedWorkerIdentity: selectedWorker.worker.identity,
    routingPolicyRuleRef: ruleRef,
    issues,
    ignoredAuthorityFields,
    safety: routingSafety,
  };
}

function blockedDecision(input: {
  readonly input: AuthorizeTaskExecutionWorkerRouteInput;
  readonly proposal: TaskExecutionWorkerRoutingProposal | null;
  readonly issues: readonly TaskExecutionWorkerRoutingIssue[];
  readonly ignoredAuthorityFields: readonly string[];
  readonly ruleRef: string;
  readonly requiredCapabilities?: readonly TaskExecutionWorkerRoutingCapability[];
  readonly authoritativeBatchId?: AgenticWorkBatchId | null;
}): TaskExecutionWorkerRoutingDecision {
  const requiredCapabilities = input.requiredCapabilities ?? [];
  const taskId = input.proposal?.taskId ?? input.input.state.taskId;
  const sourceTaskRevision =
    input.proposal?.sourceTaskRevision ?? input.input.state.revision;
  const workItemId = input.proposal?.workItemId ?? null;
  const batchId = input.authoritativeBatchId ?? input.proposal?.batchId ?? null;
  const operationKind = input.proposal?.operationKind ?? "execute_task_attempt";

  return {
    decisionVersion: TASK_EXECUTION_WORKER_ROUTING_DECISION_VERSION,
    decisionId: decisionIdFrom({
      status: "blocked",
      taskId,
      sourceTaskRevision,
      workItemId,
      batchId,
      operationKind,
      requiredCapabilities,
      selectedWorkerFamily: input.proposal?.recommendedWorkerFamily ?? null,
      selectedWorkerId: null,
      routingPolicyRuleRef: input.ruleRef,
      issueCodes: input.issues.map((item) => item.code),
    }),
    authority: "system",
    status: "blocked",
    taskId,
    sourceTaskRevision,
    workItemId,
    batchId,
    operationKind,
    requiredCapabilities,
    selectedWorkerFamily: null,
    selectedWorkerIdentity: null,
    routingPolicyRuleRef: input.ruleRef,
    issues: input.issues,
    ignoredAuthorityFields: input.ignoredAuthorityFields,
    safety: routingSafety,
  };
}

function selectPolicyRule(
  rules: readonly TaskExecutionWorkerRoutingPolicyRule[] | undefined,
  operationKind: TaskExecutionAdapterOperationKind,
): TaskExecutionWorkerRoutingPolicyRule | undefined {
  return [...(rules ?? defaultRoutingPolicyRules)]
    .filter((rule) => rule.operationKind === operationKind)
    .sort((left, right) => left.ruleRef.localeCompare(right.ruleRef))[0];
}

function selectWorker(input: {
  readonly registry: readonly TaskExecutionWorkerRegistryEntry[];
  readonly family: TaskExecutionWorkerFamily;
  readonly operationKind: TaskExecutionAdapterOperationKind;
  readonly requiredCapabilities: readonly TaskExecutionWorkerRoutingCapability[];
}): {
  readonly worker: TaskExecutionWorkerRegistryEntry;
  readonly issues: readonly TaskExecutionWorkerRoutingIssue[];
} {
  const registryIssues = input.registry
    .filter((entry) => entry.identity.workerFamily === input.family)
    .flatMap((entry) => registryEntryIssues(entry));
  const familyEntries = input.registry.filter(
    (entry) =>
      registryEntryIssues(entry).length === 0 &&
      entry.identity.workerFamily === input.family,
  );
  const operationEntries = familyEntries.filter((entry) =>
    entry.allowedOperations.includes(input.operationKind),
  );
  const eligibleEntries = operationEntries.filter((entry) => entry.eligible);
  const capableEntries = eligibleEntries.filter((entry) =>
    input.requiredCapabilities.every((capability) =>
      capabilitySatisfied(entry.capabilities, capability),
    ),
  );
  const selected = [...capableEntries].sort((left, right) =>
    left.identity.workerId.localeCompare(right.identity.workerId),
  )[0];

  if (selected !== undefined) {
    return {
      worker: selected,
      issues: registryIssues,
    };
  }

  if (familyEntries.length === 0) {
    return {
      worker: missingWorker(input.family),
      issues: [
        ...registryIssues,
        issue({
          code: "task_execution_worker_routing_worker_unknown",
          message: "No system-registered worker exists for the proposed family.",
          category: "not_found",
        }),
      ],
    };
  }

  if (operationEntries.length === 0) {
    return {
      worker: missingWorker(input.family),
      issues: [
        ...registryIssues,
        issue({
          code: "task_execution_worker_routing_worker_operation_not_allowed",
          message:
            "Registered worker family is not allowed for the requested operation.",
          category: "policy",
        }),
      ],
    };
  }

  if (eligibleEntries.length === 0) {
    return {
      worker: missingWorker(input.family),
      issues: [
        ...registryIssues,
        issue({
          code: "task_execution_worker_routing_worker_ineligible",
          message: "Registered worker exists but is not eligible for routing.",
          category: "permission",
        }),
      ],
    };
  }

  return {
    worker: missingWorker(input.family),
    issues: [
      ...registryIssues,
      issue({
        code: "task_execution_worker_routing_capability_mismatch",
        message:
          "Registered worker capabilities do not satisfy the system-owned route requirements.",
        category: "permission",
      }),
    ],
  };
}

function registryEntryIssues(
  entry: TaskExecutionWorkerRegistryEntry,
): readonly TaskExecutionWorkerRoutingIssue[] {
  const issues: TaskExecutionWorkerRoutingIssue[] = [];

  if (entry.registrationAuthority !== "system" || !identityValid(entry.identity)) {
    issues.push(
      issue({
        code: "task_execution_worker_routing_registry_entry_invalid",
        message: "Worker registry entries must use system-owned worker identity.",
        category: "validation",
      }),
    );
  }

  if (!entry.capabilities.deterministicTestResult) {
    issues.push(
      issue({
        code: "task_execution_worker_routing_registry_worker_not_test",
        message:
          "TASK-0322 routing only authorizes deterministic TEST worker identities.",
        category: "validation",
      }),
    );
  }

  return issues;
}

function missingWorker(
  family: TaskExecutionWorkerFamily,
): TaskExecutionWorkerRegistryEntry {
  return {
    identity: {
      workerId: "missing-worker",
      workerFamily: family,
      runtimeKind: "test_worker",
      implementationVersion: "missing",
      capabilityVersion: "missing",
      identityAuthority: "system",
      selectionAuthority: "system",
    },
    capabilities: {
      roles: [],
      repositoryRead: false,
      repositoryWrite: false,
      processExecution: false,
      shellExecution: false,
      toolExecution: false,
      modelReasoning: false,
      patchGeneration: false,
      testExecution: false,
      boundedDiagnostics: false,
      deterministicTestResult: false,
    },
    eligible: false,
    allowedOperations: [],
    registrationAuthority: "system",
  };
}

function capabilitySatisfied(
  capabilities: TaskExecutionWorkerCapabilities,
  capability: TaskExecutionWorkerRoutingCapability,
): boolean {
  if (
    capability === "planner" ||
    capability === "implementation" ||
    capability === "verifier"
  ) {
    return capabilities.roles.includes(capability);
  }

  return capabilities[capability];
}

function capabilityRequirementsFromUnknown(
  value: unknown,
): readonly TaskExecutionWorkerRoutingCapability[] | undefined {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    return undefined;
  }

  const capabilities = value.filter(
    (item): item is TaskExecutionWorkerRoutingCapability =>
      typeof item === "string" && allowedCapabilities.has(item),
  );

  if (capabilities.length !== value.length) {
    return undefined;
  }

  return uniqueSorted(capabilities);
}

function operationClassFromUnknown(
  value: unknown,
): TaskExecutionWorkerRoutingProposal["expectedOperationClass"] | undefined {
  if (
    value === "planning" ||
    value === "implementation" ||
    value === "verification"
  ) {
    return value;
  }

  return undefined;
}

function proposalsEquivalent(
  left: TaskExecutionWorkerRoutingProposal,
  right: TaskExecutionWorkerRoutingProposal,
): boolean {
  return (
    left.taskId === right.taskId &&
    left.sourceTaskRevision === right.sourceTaskRevision &&
    left.workItemId === right.workItemId &&
    (left.batchId ?? null) === (right.batchId ?? null) &&
    left.operationKind === right.operationKind &&
    left.recommendedWorkerFamily === right.recommendedWorkerFamily &&
    canonicalStringify(left.capabilityRequirements ?? []) ===
      canonicalStringify(right.capabilityRequirements ?? [])
  );
}

function identityValid(identity: TaskExecutionWorkerIdentity): boolean {
  return (
    isSafeId(identity.workerId) &&
    allowedFamilies.has(identity.workerFamily) &&
    identity.runtimeKind === "test_worker" &&
    isSafeId(identity.implementationVersion) &&
    isSafeId(identity.capabilityVersion) &&
    identity.identityAuthority === "system" &&
    identity.selectionAuthority === "system"
  );
}

function decisionIdFrom(value: unknown): string {
  return `worker-route:${createHash("sha256")
    .update(canonicalStringify(value))
    .digest("hex")
    .slice(0, 32)}`;
}

function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalStringify(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalStringify(record[key])}`)
    .join(",")}}`;
}

function issue(input: {
  readonly code: string;
  readonly message: string;
  readonly severity?: TaskExecutionWorkerRoutingIssue["severity"];
  readonly category?: AeosError["category"];
}): TaskExecutionWorkerRoutingIssue {
  return {
    code: input.code,
    message: input.message,
    severity: input.severity ?? "error",
    category: input.category ?? "validation",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(
  record: Record<string, unknown>,
  field: string,
): string | undefined {
  return typeof record[field] === "string" ? record[field] : undefined;
}

function optionalStringField(
  record: Record<string, unknown>,
  field: string,
): string | undefined {
  return record[field] === undefined ? undefined : stringField(record, field);
}

function numberField(
  record: Record<string, unknown>,
  field: string,
): number | undefined {
  return typeof record[field] === "number" ? record[field] : undefined;
}

function isSafeId(value: unknown): value is string {
  return typeof value === "string" && safeIdPattern.test(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function uniqueSorted<T extends string>(items: readonly T[]): readonly T[] {
  return [...new Set(items)].sort((left, right) => left.localeCompare(right));
}
