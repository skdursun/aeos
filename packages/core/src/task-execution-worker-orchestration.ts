import type {
  AgenticLifecycleIssue,
  AgenticWorkBatchId,
  AgenticWorkItemId,
} from "./agentic-lifecycle.js";
import type {
  TaskExecutionAttempt,
} from "./task-execution-attempt.js";
import {
  validateTaskExecutionAttemptForTaskState,
} from "./task-execution-attempt.js";
import {
  createTaskExecutionInvocationDispatchIntentAuditEvent,
  createTaskExecutionInvocationFailedAuditEvent,
  createTaskExecutionInvocationOutcomeUnknownAuditEvent,
  createTaskExecutionInvocationReturnedAuditEvent,
} from "./task-execution-audit.js";
import {
  appendTaskExecutionAuditEvent,
} from "./task-execution-audit-persistence.js";
import type {
  TaskExecutionClaudeCodeWorkerAdapter,
  TaskExecutionClaudeCodeWorkerConfiguration,
} from "./task-execution-claude-code-worker.js";
import {
  evaluateTaskExecutionClaudeCodeWorkerConformance,
} from "./task-execution-claude-code-worker.js";
import type {
  TaskExecutionCodexWorkerAdapter,
  TaskExecutionCodexWorkerConfiguration,
} from "./task-execution-codex-worker.js";
import {
  evaluateTaskExecutionCodexWorkerConformance,
} from "./task-execution-codex-worker.js";
import type {
  TaskExecutionInvocationRecord,
  TaskExecutionInvocationRecordTransitionIntent,
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
  PersistedTaskState,
} from "./task-state-persistence.js";
import {
  validatePersistedTaskState,
} from "./task-state-persistence.js";
import type {
  TaskExecutionWorkerIssue,
  TaskExecutionWorkerPermissionFacts,
  TaskExecutionWorkerRequest,
  TaskExecutionWorkerResult,
  TaskExecutionWorkerWorkspaceReference,
} from "./task-execution-worker.js";
import type {
  TaskExecutionWorkerRoutingDecision,
} from "./task-execution-worker-routing.js";
import type { AeosError } from "./types.js";

export const TASK_EXECUTION_WORKER_ORCHESTRATION_READY = true;
export const TASK_EXECUTION_WORKER_ORCHESTRATION_REAL_CODEX_CALLS = 0;
export const TASK_EXECUTION_WORKER_ORCHESTRATION_REAL_CLAUDE_CALLS = 0;
export const TASK_EXECUTION_WORKER_ORCHESTRATION_WORKER_PROCESSES = 0;
export const TASK_EXECUTION_WORKER_ORCHESTRATION_PRIMARY_APPLIES = 0;
export const TASK_EXECUTION_WORKER_ORCHESTRATION_CLOUD_CALLS = 0;
export const TASK_EXECUTION_WORKER_ORCHESTRATION_AUTOMATIC_LOOP_ENABLED = false;
export const TASK_EXECUTION_WORKER_ORCHESTRATION_COMPLETION_AUTHORITY = false;

export type TaskExecutionWorkerOrchestrationDecision =
  | "worker_invocation_returned"
  | "worker_invocation_failed"
  | "worker_invocation_outcome_unknown"
  | "already_returned"
  | "already_failed"
  | "already_outcome_unknown"
  | "blocked";

export interface TaskExecutionWorkerOrchestrationAdapters {
  readonly codex?: {
    readonly adapter: TaskExecutionCodexWorkerAdapter;
    readonly configuration: TaskExecutionCodexWorkerConfiguration;
  };
  readonly claudeCode?: {
    readonly adapter: TaskExecutionClaudeCodeWorkerAdapter;
    readonly configuration: TaskExecutionClaudeCodeWorkerConfiguration;
  };
}

export interface TaskExecutionWorkerOrchestrationInput {
  readonly projectRoot: string;
  readonly state: unknown;
  readonly routingDecision: unknown;
  readonly attempt: unknown;
  readonly invocationRecord: unknown;
  readonly ownershipToken: string;
  readonly adapters: TaskExecutionWorkerOrchestrationAdapters;
  readonly permissionGateResult: TaskExecutionPermissionGateResult;
  readonly permissionFacts: TaskExecutionWorkerPermissionFacts;
  readonly workspace: TaskExecutionWorkerWorkspaceReference;
  readonly boundedInstructions: string;
  readonly contextReferences?: readonly string[];
  readonly expectedInvocationId?: string;
  readonly expectedInvocationRevision?: number;
  readonly expectedIdempotencyKey?: string;
  readonly latestAttemptNumberForContext?: number;
  readonly correlationId?: string;
  readonly occurredAt?: string;
  readonly auditRequired?: boolean;
  readonly forbiddenAuditValues?: readonly string[];
  readonly taskOrModelAuthorityClaims?: unknown;
  readonly workerAuthorityClaims?: unknown;
  readonly taskOrModelProcessClaims?: unknown;
}

export interface TaskExecutionWorkerOrchestrationResult {
  readonly ok: boolean;
  readonly decision: TaskExecutionWorkerOrchestrationDecision;
  readonly routingDecisionId: string | null;
  readonly selectedWorker: TaskExecutionWorkerRoutingDecision["selectedWorkerIdentity"];
  readonly taskRef: {
    readonly taskId: string | null;
    readonly revision: number | null;
  };
  readonly workRef: {
    readonly workItemId: AgenticWorkItemId | null;
    readonly batchId: AgenticWorkBatchId | null;
    readonly operationKind: string | null;
  };
  readonly attemptRef: {
    readonly attemptId: string | null;
    readonly attemptNumber: number | null;
    readonly lifecycle: string | null;
  };
  readonly invocationRef: {
    readonly invocationId: string | null;
    readonly invocationRevision: number | null;
    readonly idempotencyKey: string | null;
    readonly lifecycle: string | null;
  };
  readonly workerPrepared: boolean;
  readonly workerInvoked: boolean;
  readonly normalizedOutcome: TaskExecutionWorkerResult | null;
  readonly invocationLifecycle: string | null;
  readonly evidenceRefs: readonly string[];
  readonly completionAuthority: false;
  readonly issues: readonly TaskExecutionWorkerIssue[];
  readonly safety: {
    readonly RealCodexCalls: 0;
    readonly RealClaudeCalls: 0;
    readonly WorkerProcesses: 0;
    readonly PrimaryApplies: 0;
    readonly CloudCalls: 0;
    readonly WorkerSelfRoutingAllowed: false;
    readonly AutomaticLoopEnabled: false;
    readonly PrimaryApplyEnabled: false;
    readonly CompletionAuthority: false;
    readonly VerifierSatisfied: false;
    readonly CompletionGateSatisfied: false;
    readonly TaskComplete: false;
  };
}

interface SelectedWorkerConformance {
  readonly normalizedResult: TaskExecutionWorkerResult | null;
  readonly issues: readonly TaskExecutionWorkerIssue[];
  readonly workerConformance: {
    readonly workerInvoked: boolean;
  } | null;
}

const safety = {
  RealCodexCalls: 0,
  RealClaudeCalls: 0,
  WorkerProcesses: 0,
  PrimaryApplies: 0,
  CloudCalls: 0,
  WorkerSelfRoutingAllowed: false,
  AutomaticLoopEnabled: false,
  PrimaryApplyEnabled: false,
  CompletionAuthority: false,
  VerifierSatisfied: false,
  CompletionGateSatisfied: false,
  TaskComplete: false,
} as const;

export async function orchestrateTaskExecutionWorkerRoute(
  input: TaskExecutionWorkerOrchestrationInput,
): Promise<TaskExecutionWorkerOrchestrationResult> {
  const issues: TaskExecutionWorkerIssue[] = [];
  const stateResult = validatePersistedTaskState(input.state);
  const route = routeFromUnknown(input.routingDecision);
  const attemptResult = validateTaskExecutionAttemptForTaskState({
    attempt: input.attempt,
    state: input.state,
  });
  const invocationResult = validateTaskExecutionInvocationRecord(
    input.invocationRecord,
  );

  if (!stateResult.ok) {
    issues.push(issueFromError(stateResult.error));
  }

  if (route === undefined) {
    issues.push(
      issue({
        code: "task_execution_worker_orchestration_route_required",
        message:
          "Worker orchestration requires a current system-owned AEOS routing decision.",
        category: "validation",
      }),
    );
  }

  if (!attemptResult.ok) {
    issues.push(issueFromError(attemptResult.error));
  }

  if (!invocationResult.ok) {
    issues.push(issueFromError(invocationResult.error));
  }

  const state = stateResult.ok ? stateResult.value : null;
  const attempt = attemptResult.ok ? attemptResult.value : null;
  const invocation = invocationResult.ok ? invocationResult.value : null;

  if (route !== undefined && state !== null) {
    issues.push(...routeStateIssues(route, state));
  }

  if (route !== undefined && attempt !== null) {
    issues.push(
      ...routeAttemptIssues({
        route,
        attempt,
        latestAttemptNumberForContext: input.latestAttemptNumberForContext,
      }),
    );
  }

  if (route !== undefined && invocation !== null && attempt !== null) {
    issues.push(
      ...routeInvocationIssues({
        route,
        attempt,
        invocation,
        expectedInvocationId: input.expectedInvocationId,
        expectedInvocationRevision: input.expectedInvocationRevision,
        expectedIdempotencyKey: input.expectedIdempotencyKey,
      }),
    );
  }

  issues.push(...permissionIssues(input));

  if (input.taskOrModelAuthorityClaims !== undefined) {
    issues.push(
      issue({
        code: "task_execution_worker_orchestration_model_authority_ignored",
        message:
          "Task/model execution authority claims are ignored; AEOS routing decision and invocation state are authoritative.",
        severity: "warning",
        category: "validation",
      }),
    );
  }

  if (input.workerAuthorityClaims !== undefined) {
    issues.push(
      issue({
        code: "task_execution_worker_orchestration_worker_authority_ignored",
        message:
          "Worker completion, retry, routing, or approval claims remain bounded evidence only.",
        severity: "warning",
        category: "validation",
      }),
    );
  }

  if (input.taskOrModelProcessClaims !== undefined) {
    issues.push(
      issue({
        code:
          "task_execution_worker_orchestration_process_authority_ignored",
        message:
          "Task/model process, cwd, executable, argv, credential, or permission claims are ignored before worker adapter preparation.",
        severity: "warning",
        category: "validation",
      }),
    );
  }

  if (invocation !== null && invocation.lifecycle === "returned") {
    return result({
      input,
      route,
      attempt,
      invocation,
      decision: "already_returned",
      normalizedOutcome: null,
      issues,
    });
  }

  if (invocation !== null && invocation.lifecycle === "failed") {
    return result({
      input,
      route,
      attempt,
      invocation,
      decision: "already_failed",
      normalizedOutcome: null,
      issues,
    });
  }

  if (invocation !== null && invocation.lifecycle === "outcome_unknown") {
    return result({
      input,
      route,
      attempt,
      invocation,
      decision: "already_outcome_unknown",
      normalizedOutcome: null,
      issues,
    });
  }

  if (issues.some((item) => item.severity === "error")) {
    return result({
      input,
      route,
      attempt,
      invocation,
      decision: "blocked",
      normalizedOutcome: null,
      issues,
    });
  }

  if (state === null || route === undefined || attempt === null || invocation === null) {
    return result({
      input,
      route,
      attempt,
      invocation,
      decision: "blocked",
      normalizedOutcome: null,
      issues,
    });
  }

  const request = createWorkerRequest({
    input,
    route,
    attempt,
    invocation,
  });
  const dispatchAudit = input.auditRequired === false
    ? undefined
    : await appendDispatchAudit({
        input,
        invocation,
        workerId: route.selectedWorkerIdentity?.workerId ?? "unknown-worker",
      });

  if (dispatchAudit?.ok === false) {
    return result({
      input,
      route,
      attempt,
      invocation,
      decision: "blocked",
      normalizedOutcome: null,
      workerPrepared: true,
      issues: [...issues, issueFromError(dispatchAudit.error)],
    });
  }

  const selected = await evaluateSelectedWorker({
    input,
    route,
    request,
    invocation,
    attempt,
    state,
  });
  const normalizedOutcome = selected.normalizedResult;
  const conformanceIssues = [...issues, ...selected.issues];

  if (normalizedOutcome === null) {
    return result({
      input,
      route,
      attempt,
      invocation,
      decision: "blocked",
      normalizedOutcome,
      workerPrepared: true,
      workerInvoked: selectedWorkerInvoked(selected),
      issues: conformanceIssues,
    });
  }

  const transitionIntent = transitionIntentFromWorkerResult(normalizedOutcome);
  const updatedInvocation = await updateTaskExecutionInvocation({
    projectRoot: input.projectRoot,
    taskId: invocation.taskId,
    invocationId: invocation.invocationId,
    ownershipToken: input.ownershipToken,
    expectedLifecycle: "invoking",
    expectedRevision: input.expectedInvocationRevision ?? invocation.revision,
    intent: transitionIntent,
  });

  if (!updatedInvocation.ok) {
    return result({
      input,
      route,
      attempt,
      invocation,
      decision: "blocked",
      normalizedOutcome,
      workerPrepared: true,
      workerInvoked: selectedWorkerInvoked(selected),
      issues: [...conformanceIssues, issueFromError(updatedInvocation.error)],
    });
  }

  const outcomeAudit = input.auditRequired === false
    ? undefined
    : await appendOutcomeAudit({
        input,
        record: updatedInvocation.value.record,
      });

  const finalIssues = outcomeAudit?.ok === false
    ? [...conformanceIssues, issueFromError(outcomeAudit.error)]
    : conformanceIssues;

  return result({
    input,
    route,
    attempt,
    invocation: updatedInvocation.value.record,
    decision: decisionFromTransition(transitionIntent),
    normalizedOutcome,
    workerPrepared: true,
    workerInvoked: selectedWorkerInvoked(selected),
    issues: finalIssues,
  });
}

function routeFromUnknown(value: unknown):
  | TaskExecutionWorkerRoutingDecision
  | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  if (
    value.authority !== "system" ||
    value.status !== "authorized" ||
    typeof value.decisionId !== "string" ||
    typeof value.taskId !== "string" ||
    typeof value.sourceTaskRevision !== "number" ||
    typeof value.operationKind !== "string" ||
    !isRecord(value.selectedWorkerIdentity) ||
    value.selectedWorkerFamily !== value.selectedWorkerIdentity.workerFamily ||
    value.selectedWorkerIdentity.runtimeKind !== "test_worker" ||
    value.selectedWorkerIdentity.identityAuthority !== "system" ||
    value.selectedWorkerIdentity.selectionAuthority !== "system"
  ) {
    return undefined;
  }

  return value as unknown as TaskExecutionWorkerRoutingDecision;
}

function routeStateIssues(
  route: TaskExecutionWorkerRoutingDecision,
  state: PersistedTaskState,
): readonly TaskExecutionWorkerIssue[] {
  const issues: TaskExecutionWorkerIssue[] = [];
  const workItem = state.workItems.find((item) => item.id === route.workItemId);
  const routeBatchId = route.batchId ?? null;

  if (route.taskId !== state.taskId) {
    issues.push(
      issue({
        code: "task_execution_worker_orchestration_task_mismatch",
        message: "Routing decision task does not match current task state.",
        category: "conflict",
      }),
    );
  }

  if (route.sourceTaskRevision !== state.revision) {
    issues.push(
      issue({
        code: "task_execution_worker_orchestration_stale_route",
        message: "Routing decision revision does not match current task state.",
        category: "conflict",
      }),
    );
  }

  if (workItem === undefined || route.workItemId === null) {
    issues.push(
      issue({
        code: "task_execution_worker_orchestration_work_item_mismatch",
        message: "Routing decision does not bind a current authoritative work item.",
        category: "not_found",
      }),
    );
  } else if (
    !state.pendingWorkItemIds.includes(workItem.id) &&
    !state.retryableWorkItemIds.includes(workItem.id)
  ) {
    issues.push(
      issue({
        code: "task_execution_worker_orchestration_work_ineligible",
        message:
          "Routing decision cannot execute work that is no longer pending or retryable.",
        category: "conflict",
      }),
    );
  }

  if (workItem !== undefined && (workItem.batchId ?? null) !== routeBatchId) {
    issues.push(
      issue({
        code: "task_execution_worker_orchestration_batch_mismatch",
        message: "Routing decision batch does not match the work item batch.",
        category: "conflict",
      }),
    );
  }

  if (routeBatchId !== null) {
    const batch = state.batches.find((item) => item.id === routeBatchId);

    if (batch === undefined || !batch.workItemIds.includes(route.workItemId!)) {
      issues.push(
        issue({
          code: "task_execution_worker_orchestration_batch_containment_mismatch",
          message:
            "Routing decision batch does not authoritatively contain the work item.",
          category: "conflict",
        }),
      );
    }
  }

  return issues;
}

function routeAttemptIssues(input: {
  readonly route: TaskExecutionWorkerRoutingDecision;
  readonly attempt: TaskExecutionAttempt;
  readonly latestAttemptNumberForContext?: number;
}): readonly TaskExecutionWorkerIssue[] {
  const issues: TaskExecutionWorkerIssue[] = [];

  if (input.attempt.lifecycle !== "started") {
    issues.push(
      issue({
        code: "task_execution_worker_orchestration_attempt_not_started",
        message: "Worker orchestration requires a started execution attempt.",
        category: "conflict",
      }),
    );
  }

  if (
    input.latestAttemptNumberForContext !== undefined &&
    input.attempt.attemptNumber !== input.latestAttemptNumberForContext
  ) {
    issues.push(
      issue({
        code: "task_execution_worker_orchestration_attempt_not_current",
        message: "Worker orchestration requires the current authoritative attempt.",
        category: "conflict",
      }),
    );
  }

  if (
    input.attempt.taskId !== input.route.taskId ||
    input.attempt.taskStateRevision !== input.route.sourceTaskRevision ||
    (input.attempt.workItemId ?? null) !== input.route.workItemId ||
    (input.attempt.batchId ?? null) !== input.route.batchId
  ) {
    issues.push(
      issue({
        code: "task_execution_worker_orchestration_attempt_mismatch",
        message: "Attempt authority does not match the routing decision.",
        category: "conflict",
      }),
    );
  }

  return issues;
}

function routeInvocationIssues(input: {
  readonly route: TaskExecutionWorkerRoutingDecision;
  readonly attempt: TaskExecutionAttempt;
  readonly invocation: TaskExecutionInvocationRecord;
  readonly expectedInvocationId?: string;
  readonly expectedInvocationRevision?: number;
  readonly expectedIdempotencyKey?: string;
}): readonly TaskExecutionWorkerIssue[] {
  const issues: TaskExecutionWorkerIssue[] = [];
  const invocation = input.invocation;

  if (invocation.lifecycle !== "invoking") {
    return issues;
  }

  if (
    input.expectedInvocationId !== undefined &&
    invocation.invocationId !== input.expectedInvocationId
  ) {
    issues.push(
      issue({
        code: "task_execution_worker_orchestration_invocation_mismatch",
        message: "Invocation id does not match expected authoritative invocation.",
        category: "conflict",
      }),
    );
  }

  if (
    input.expectedInvocationRevision !== undefined &&
    invocation.revision !== input.expectedInvocationRevision
  ) {
    issues.push(
      issue({
        code: "task_execution_worker_orchestration_invocation_revision_mismatch",
        message: "Invocation revision is stale or mismatched.",
        category: "conflict",
      }),
    );
  }

  if (
    input.expectedIdempotencyKey !== undefined &&
    invocation.idempotencyKey !== input.expectedIdempotencyKey
  ) {
    issues.push(
      issue({
        code: "task_execution_worker_orchestration_idempotency_mismatch",
        message: "Invocation idempotency key does not match expected authority.",
        category: "conflict",
      }),
    );
  }

  if (
    invocation.taskId !== input.route.taskId ||
    invocation.taskStateRevision !== input.route.sourceTaskRevision ||
    invocation.attemptId !== input.attempt.attemptId ||
    invocation.attemptNumber !== input.attempt.attemptNumber ||
    (invocation.workItemId ?? null) !== input.route.workItemId ||
    (invocation.batchId ?? null) !== input.route.batchId
  ) {
    issues.push(
      issue({
        code: "task_execution_worker_orchestration_invocation_mismatch",
        message: "Invocation authority does not match route and attempt binding.",
        category: "conflict",
      }),
    );
  }

  return issues;
}

function permissionIssues(
  input: TaskExecutionWorkerOrchestrationInput,
): readonly TaskExecutionWorkerIssue[] {
  const issues: TaskExecutionWorkerIssue[] = [];

  if (
    !input.permissionGateResult.allowed ||
    input.permissionGateResult.decision !== "allowed" ||
    !input.permissionFacts.allowed ||
    !input.permissionFacts.capabilitySatisfied ||
    !input.permissionFacts.permissionsSatisfied ||
    input.permissionFacts.decision !== "allowed"
  ) {
    issues.push(
      issue({
        code: "task_execution_worker_orchestration_permission_denied",
        message:
          "A valid route does not override worker permission or policy denial.",
        category: "permission",
      }),
    );
  }

  if (input.permissionFacts.authority !== "system") {
    issues.push(
      issue({
        code: "task_execution_worker_orchestration_permission_authority_invalid",
        message: "Worker permission facts must be system-owned.",
        category: "permission",
      }),
    );
  }

  return issues;
}

function createWorkerRequest(input: {
  readonly input: TaskExecutionWorkerOrchestrationInput;
  readonly route: TaskExecutionWorkerRoutingDecision;
  readonly attempt: TaskExecutionAttempt;
  readonly invocation: TaskExecutionInvocationRecord;
}): TaskExecutionWorkerRequest {
  return {
    taskId: input.invocation.taskId,
    sourceTaskRevision: input.invocation.taskStateRevision,
    attemptId: input.invocation.attemptId,
    attemptNumber: input.invocation.attemptNumber,
    invocationId: input.invocation.invocationId,
    idempotencyKey: input.invocation.idempotencyKey,
    workItemId: input.route.workItemId ?? undefined,
    batchId: input.route.batchId ?? undefined,
    operationKind: input.route.operationKind,
    workerIdentity: input.route.selectedWorkerIdentity!,
    boundedInstructions: input.input.boundedInstructions,
    contextReferences: [...(input.input.contextReferences ?? [])].sort(),
    workspace: input.input.workspace,
    permissionFacts: input.input.permissionFacts,
    trace: {
      correlationId:
        input.input.correlationId ??
        `worker-orchestration:${input.route.decisionId}`,
    },
  };
}

async function evaluateSelectedWorker(input: {
  readonly input: TaskExecutionWorkerOrchestrationInput;
  readonly route: TaskExecutionWorkerRoutingDecision;
  readonly request: TaskExecutionWorkerRequest;
  readonly invocation: TaskExecutionInvocationRecord;
  readonly attempt: TaskExecutionAttempt;
  readonly state: PersistedTaskState;
}): Promise<SelectedWorkerConformance> {
  const snapshotState = JSON.stringify(input.state);
  const snapshotAttempt = JSON.stringify(input.attempt);
  const snapshotInvocation = JSON.stringify(input.invocation);
  const snapshotAccounting = JSON.stringify({
    workItemId: input.route.workItemId,
    batchId: input.route.batchId,
  });

  if (input.route.selectedWorkerFamily === "codex") {
    if (input.input.adapters.codex === undefined) {
      return missingAdapterResult("codex", input.request);
    }

    return evaluateTaskExecutionCodexWorkerConformance({
      worker: input.input.adapters.codex.adapter,
      configuration: input.input.adapters.codex.configuration,
      request: input.request,
      invocationRecord: input.invocation,
      permissionGateResult: input.input.permissionGateResult,
      expectedIdempotencyKey: input.invocation.idempotencyKey,
      taskOrModelWorkerSelectionClaims: input.input.taskOrModelAuthorityClaims,
      taskOrModelCapabilityClaims: input.input.workerAuthorityClaims,
      stateSnapshotBefore: snapshotState,
      stateSnapshotAfter: snapshotState,
      attemptSnapshotBefore: snapshotAttempt,
      attemptSnapshotAfter: snapshotAttempt,
      invocationSnapshotBefore: snapshotInvocation,
      invocationSnapshotAfter: snapshotInvocation,
      workAccountingSnapshotBefore: snapshotAccounting,
      workAccountingSnapshotAfter: snapshotAccounting,
    });
  }

  if (input.route.selectedWorkerFamily === "claude_code") {
    if (input.input.adapters.claudeCode === undefined) {
      return missingAdapterResult("claude_code", input.request);
    }

    return evaluateTaskExecutionClaudeCodeWorkerConformance({
      worker: input.input.adapters.claudeCode.adapter,
      configuration: input.input.adapters.claudeCode.configuration,
      request: input.request,
      invocationRecord: input.invocation,
      permissionGateResult: input.input.permissionGateResult,
      expectedIdempotencyKey: input.invocation.idempotencyKey,
      taskOrModelWorkerSelectionClaims: input.input.taskOrModelAuthorityClaims,
      taskOrModelCapabilityClaims: input.input.workerAuthorityClaims,
      stateSnapshotBefore: snapshotState,
      stateSnapshotAfter: snapshotState,
      attemptSnapshotBefore: snapshotAttempt,
      attemptSnapshotAfter: snapshotAttempt,
      invocationSnapshotBefore: snapshotInvocation,
      invocationSnapshotAfter: snapshotInvocation,
      workAccountingSnapshotBefore: snapshotAccounting,
      workAccountingSnapshotAfter: snapshotAccounting,
    });
  }

  return missingAdapterResult("unknown", input.request);
}

function missingAdapterResult(
  family: string,
  request: TaskExecutionWorkerRequest,
): SelectedWorkerConformance {
  return {
    workerConformance: null,
    normalizedResult: null,
    issues: [
      issue({
        code: "task_execution_worker_orchestration_worker_adapter_missing",
        message: `No concrete TEST worker adapter is registered for route family ${family}.`,
        category: "not_found",
      }),
    ],
  };
}

function transitionIntentFromWorkerResult(
  normalized: TaskExecutionWorkerResult,
): TaskExecutionInvocationRecordTransitionIntent {
  if (normalized.outcomeStatus === "returned") {
    return {
      kind: "record_returned",
      result: {
        invocationOk: normalized.invocationOk,
        output: normalized.output,
        outputReference: normalized.outputReference,
        diagnosticCode: normalized.diagnosticCode,
        message: normalized.message,
        metadata: normalized.metadata,
      },
    };
  }

  if (normalized.outcomeStatus === "in_progress") {
    return {
      kind: "mark_outcome_unknown",
      issue: lifecycleIssue({
        code: "task_execution_worker_orchestration_ambiguous_worker_result",
        message:
          "Worker result remained in progress; invocation outcome is unknown and no retry is authorized.",
        category: "execution_failure",
      }),
    };
  }

  return {
    kind: "record_failed",
    failure: {
      code:
        normalized.failure?.code ??
        `task_execution_worker_${normalized.outcomeStatus}`,
      category: "adapter_failure",
      diagnostic: normalized.diagnosticCode ?? normalized.message,
      retryable: false,
    },
  };
}

function decisionFromTransition(
  intent: TaskExecutionInvocationRecordTransitionIntent,
): TaskExecutionWorkerOrchestrationDecision {
  if (intent.kind === "record_returned") {
    return "worker_invocation_returned";
  }

  if (intent.kind === "record_failed") {
    return "worker_invocation_failed";
  }

  return "worker_invocation_outcome_unknown";
}

async function appendDispatchAudit(input: {
  readonly input: TaskExecutionWorkerOrchestrationInput;
  readonly invocation: TaskExecutionInvocationRecord;
  readonly workerId: string;
}): Promise<{ ok: true } | { ok: false; error: AeosError }> {
  const draft = createTaskExecutionInvocationDispatchIntentAuditEvent({
    record: input.invocation,
    adapterId: input.workerId,
    operation: "execute_task_attempt",
    policyGateId: input.input.permissionGateResult.policyGateId,
    policyAuthorized: input.input.permissionGateResult.policyAuthorized,
    auditRequired: input.input.auditRequired ?? true,
    occurredAt: input.input.occurredAt,
    correlationId: input.input.correlationId,
  });

  if (!draft.ok) {
    return draft;
  }

  const appended = await appendTaskExecutionAuditEvent({
    projectRoot: input.input.projectRoot,
    taskId: input.invocation.taskId,
    event: draft.value,
    forbiddenValues: input.input.forbiddenAuditValues,
  });

  return appended.ok ? { ok: true } : appended;
}

async function appendOutcomeAudit(input: {
  readonly input: TaskExecutionWorkerOrchestrationInput;
  readonly record: TaskExecutionInvocationRecord;
}): Promise<{ ok: true } | { ok: false; error: AeosError }> {
  const draft =
    input.record.lifecycle === "returned"
      ? createTaskExecutionInvocationReturnedAuditEvent({
          record: input.record,
          occurredAt: input.input.occurredAt,
        })
      : input.record.lifecycle === "failed"
        ? createTaskExecutionInvocationFailedAuditEvent({
            record: input.record,
            occurredAt: input.input.occurredAt,
          })
        : createTaskExecutionInvocationOutcomeUnknownAuditEvent({
            record: input.record,
            occurredAt: input.input.occurredAt,
          });

  if (!draft.ok) {
    return draft;
  }

  const appended = await appendTaskExecutionAuditEvent({
    projectRoot: input.input.projectRoot,
    taskId: input.record.taskId,
    event: draft.value,
    forbiddenValues: input.input.forbiddenAuditValues,
  });

  return appended.ok ? { ok: true } : appended;
}

function selectedWorkerInvoked(result: SelectedWorkerConformance): boolean {
  return result.workerConformance?.workerInvoked === true;
}

function evidenceRefs(result: TaskExecutionWorkerResult | null): readonly string[] {
  if (result === null) {
    return [];
  }

  return [
    result.outputReference,
    result.patchArtifactReference,
    result.changedFileManifestReference,
    result.testSummaryReference,
  ].filter((item): item is string => typeof item === "string");
}

function result(input: {
  readonly input: TaskExecutionWorkerOrchestrationInput;
  readonly route?: TaskExecutionWorkerRoutingDecision;
  readonly attempt: TaskExecutionAttempt | null;
  readonly invocation: TaskExecutionInvocationRecord | null;
  readonly decision: TaskExecutionWorkerOrchestrationDecision;
  readonly normalizedOutcome: TaskExecutionWorkerResult | null;
  readonly workerPrepared?: boolean;
  readonly workerInvoked?: boolean;
  readonly issues: readonly TaskExecutionWorkerIssue[];
}): TaskExecutionWorkerOrchestrationResult {
  const errorFree = !input.issues.some((item) => item.severity === "error");

  return {
    ok:
      errorFree &&
      (input.decision === "worker_invocation_returned" ||
        input.decision === "worker_invocation_failed" ||
        input.decision === "worker_invocation_outcome_unknown" ||
        input.decision === "already_returned" ||
        input.decision === "already_failed" ||
        input.decision === "already_outcome_unknown"),
    decision: input.decision,
    routingDecisionId: input.route?.decisionId ?? null,
    selectedWorker: input.route?.selectedWorkerIdentity ?? null,
    taskRef: {
      taskId: input.route?.taskId ?? input.invocation?.taskId ?? null,
      revision:
        input.route?.sourceTaskRevision ??
        input.invocation?.taskStateRevision ??
        null,
    },
    workRef: {
      workItemId:
        input.route?.workItemId ?? input.invocation?.workItemId ?? null,
      batchId: input.route?.batchId ?? input.invocation?.batchId ?? null,
      operationKind: input.route?.operationKind ?? null,
    },
    attemptRef: {
      attemptId: input.attempt?.attemptId ?? input.invocation?.attemptId ?? null,
      attemptNumber:
        input.attempt?.attemptNumber ?? input.invocation?.attemptNumber ?? null,
      lifecycle: input.attempt?.lifecycle ?? null,
    },
    invocationRef: {
      invocationId: input.invocation?.invocationId ?? null,
      invocationRevision: input.invocation?.revision ?? null,
      idempotencyKey: input.invocation?.idempotencyKey ?? null,
      lifecycle: input.invocation?.lifecycle ?? null,
    },
    workerPrepared: input.workerPrepared ?? false,
    workerInvoked: input.workerInvoked ?? false,
    normalizedOutcome: input.normalizedOutcome,
    invocationLifecycle: input.invocation?.lifecycle ?? null,
    evidenceRefs: evidenceRefs(input.normalizedOutcome),
    completionAuthority: false,
    issues: input.issues,
    safety,
  };
}

function issue(input: {
  readonly code: string;
  readonly message: string;
  readonly severity?: TaskExecutionWorkerIssue["severity"];
  readonly category?: AeosError["category"];
}): TaskExecutionWorkerIssue {
  return {
    code: input.code,
    message: input.message,
    severity: input.severity ?? "error",
    category: input.category ?? "validation",
  };
}

function issueFromError(error: AeosError): TaskExecutionWorkerIssue {
  return issue({
    code: error.code,
    message: error.message,
    category: error.category,
  });
}

function lifecycleIssue(input: {
  readonly code: string;
  readonly message: string;
  readonly category: AgenticLifecycleIssue["category"];
}): AgenticLifecycleIssue {
  return {
    code: input.code,
    message: input.message,
    severity: "warning",
    category: input.category,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
