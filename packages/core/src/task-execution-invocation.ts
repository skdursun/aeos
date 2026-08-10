import type {
  AgenticExecutionAttemptId,
  AgenticTaskId,
  AgenticWorkBatchId,
  AgenticWorkItem,
  AgenticWorkItemId,
} from "./agentic-lifecycle.js";
import type { PersistedTaskState } from "./task-state-persistence.js";
import { validatePersistedTaskState } from "./task-state-persistence.js";
import type { TaskExecutionAttempt } from "./task-execution-attempt.js";
import { validateTaskExecutionAttempt } from "./task-execution-attempt.js";
import type { AeosError, JsonObject, JsonValue } from "./types.js";

export type TaskExecutionInvocationDependencyKind = "test_noop";

export interface TaskExecutionInvocationRequest {
  readonly taskId: AgenticTaskId;
  readonly attemptId: AgenticExecutionAttemptId;
  readonly attemptNumber: number;
  readonly sourceTaskRevision: number;
  readonly workItemId?: AgenticWorkItemId;
  readonly batchId?: AgenticWorkBatchId;
  readonly idempotencyReference: string;
  readonly allowedOperationReferences: readonly string[];
  readonly verifierRequired: boolean;
  readonly completionGatedByVerifier: boolean;
}

export interface TaskExecutionInvocationDependencyResult {
  readonly ok: boolean;
  readonly output?: JsonValue;
  readonly outputReference?: string;
  readonly diagnosticCode?: string;
  readonly message?: string;
  readonly metadata?: JsonObject;
}

export interface TaskExecutionInvocationDependency {
  readonly kind: TaskExecutionInvocationDependencyKind;
  readonly invoke: (
    request: TaskExecutionInvocationRequest,
  ) =>
    | TaskExecutionInvocationDependencyResult
    | Promise<TaskExecutionInvocationDependencyResult>;
}

export interface TaskExecutionInvocationInput {
  readonly state: unknown;
  readonly attempt: unknown;
  readonly dependency: unknown;
  readonly expectedRevision?: number;
  readonly latestAttemptNumberForContext?: number;
  readonly invocationId?: string;
  readonly allowedOperationReferences?: readonly string[];
}

export interface TaskExecutionInvocationIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: "error";
  readonly category: AeosError["category"];
  readonly taskId?: AgenticTaskId;
  readonly attemptId?: AgenticExecutionAttemptId;
  readonly workItemId?: AgenticWorkItemId;
  readonly batchId?: AgenticWorkBatchId;
}

export interface TaskExecutionInvocationSafety {
  readonly productionAdapterInvoked: false;
  readonly externalExecutionPerformed: false;
  readonly taskStateModified: false;
  readonly attemptStateModified: false;
  readonly auditWritten: false;
  readonly verifierRun: false;
  readonly policyRuntimeRun: false;
  readonly workCompleted: false;
  readonly taskCompleted: false;
  readonly verified: false;
}

export interface TaskExecutionInvocationSummary {
  readonly invocationAllowed: boolean;
  readonly dependencyKind: TaskExecutionInvocationDependencyKind | null;
  readonly dependencyInvoked: boolean;
  readonly invocationReturned: boolean;
  readonly invocationOk: boolean;
  readonly executorClaimedCompleted: boolean;
  readonly executorClaimedVerified: boolean;
  readonly executorClaimedApproved: boolean;
  readonly executorClaimedAllDone: boolean;
  readonly duplicateInvocationProtection: "not_persisted_mvp_noop_only";
  readonly resultAuthority: "invocation_diagnostic_only";
  readonly issueCount: number;
}

export interface TaskExecutionInvocationResult {
  readonly ok: boolean;
  readonly invocationStatus: "blocked" | "succeeded" | "failed";
  readonly invocationAllowed: boolean;
  readonly dependencyKind: TaskExecutionInvocationDependencyKind | null;
  readonly dependencyInvoked: boolean;
  readonly invocationReturned: boolean;
  readonly invocationOk: boolean;
  readonly taskId: AgenticTaskId | null;
  readonly attemptId: AgenticExecutionAttemptId | null;
  readonly attemptNumber: number | null;
  readonly sourceTaskRevision: number | null;
  readonly currentTaskRevision: number | null;
  readonly expectedRevision: number | null;
  readonly latestAttemptNumberForContext: number | null;
  readonly workItemId: AgenticWorkItemId | null;
  readonly batchId: AgenticWorkBatchId | null;
  readonly idempotencyReference: string | null;
  readonly verifierRequired: boolean | null;
  readonly completionGatedByVerifier: boolean | null;
  readonly output?: JsonValue;
  readonly outputReference?: string;
  readonly diagnosticCode?: string;
  readonly message?: string;
  readonly metadata?: JsonObject;
  readonly issues: readonly TaskExecutionInvocationIssue[];
  readonly safety: TaskExecutionInvocationSafety;
  readonly summary: TaskExecutionInvocationSummary;
}

const invocationSafety: TaskExecutionInvocationSafety = {
  productionAdapterInvoked: false,
  externalExecutionPerformed: false,
  taskStateModified: false,
  attemptStateModified: false,
  auditWritten: false,
  verifierRun: false,
  policyRuntimeRun: false,
  workCompleted: false,
  taskCompleted: false,
  verified: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return Number.isFinite(value as number) || typeof value !== "number";
  }

  if (Array.isArray(value)) {
    return value.every((item) => isJsonValue(item));
  }

  if (isRecord(value)) {
    return Object.values(value).every((item) => isJsonValue(item));
  }

  return false;
}

function isJsonObject(value: unknown): value is JsonObject {
  return isRecord(value) && isJsonValue(value);
}

function safeText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  if (/(\n\s*at\s+|Error:|stack)/i.test(value)) {
    return "Dependency returned unsafe diagnostic data.";
  }

  return value;
}

function issue(input: {
  readonly code: string;
  readonly message: string;
  readonly category: AeosError["category"];
  readonly taskId?: AgenticTaskId;
  readonly attemptId?: AgenticExecutionAttemptId;
  readonly workItemId?: AgenticWorkItemId;
  readonly batchId?: AgenticWorkBatchId;
}): TaskExecutionInvocationIssue {
  return {
    code: input.code,
    message: input.message,
    severity: "error",
    category: input.category,
    taskId: input.taskId,
    attemptId: input.attemptId,
    workItemId: input.workItemId,
    batchId: input.batchId,
  };
}

function issueFromError(error: AeosError): TaskExecutionInvocationIssue {
  return issue({
    code: error.code,
    message: error.message,
    category: error.category,
  });
}

function eligibleWorkItemIdsForState(
  state: PersistedTaskState,
): ReadonlySet<AgenticWorkItemId> {
  return new Set([...state.pendingWorkItemIds, ...state.retryableWorkItemIds]);
}

function representedWorkItem(
  state: PersistedTaskState,
  workItemId: AgenticWorkItemId,
): AgenticWorkItem | undefined {
  return state.workItems.find((workItem) => workItem.id === workItemId);
}

function collectWorkBatchIssues(input: {
  readonly state: PersistedTaskState;
  readonly attempt: TaskExecutionAttempt;
}): readonly TaskExecutionInvocationIssue[] {
  const issues: TaskExecutionInvocationIssue[] = [];
  const eligibleIds = eligibleWorkItemIdsForState(input.state);

  if (input.attempt.workItemId !== undefined) {
    const workItem = representedWorkItem(input.state, input.attempt.workItemId);

    if (workItem === undefined) {
      return [
        issue({
          code: "task_execution_invocation_work_item_missing",
          message:
            "Started attempt work item no longer exists in current authoritative task state.",
          category: "validation",
          taskId: input.state.taskId,
          attemptId: input.attempt.attemptId,
          workItemId: input.attempt.workItemId,
          batchId: input.attempt.batchId,
        }),
      ];
    }

    if (!eligibleIds.has(input.attempt.workItemId)) {
      issues.push(
        issue({
          code: "task_execution_invocation_work_item_not_executable",
          message:
            "Started attempt work item is no longer pending or retryable in current authoritative task state.",
          category: "validation",
          taskId: input.state.taskId,
          attemptId: input.attempt.attemptId,
          workItemId: input.attempt.workItemId,
          batchId: input.attempt.batchId,
        }),
      );
    }

    if (input.attempt.batchId !== undefined) {
      const batch = input.state.batches.find(
        (item) => item.id === input.attempt.batchId,
      );

      if (
        batch === undefined ||
        workItem.batchId !== input.attempt.batchId ||
        !batch.workItemIds.includes(input.attempt.workItemId)
      ) {
        issues.push(
          issue({
            code: "task_execution_invocation_work_batch_mismatch",
            message:
              "Started attempt work item and batch binding no longer matches current authoritative task state.",
            category: "validation",
            taskId: input.state.taskId,
            attemptId: input.attempt.attemptId,
            workItemId: input.attempt.workItemId,
            batchId: input.attempt.batchId,
          }),
        );
      }
    }

    return issues;
  }

  if (input.attempt.batchId !== undefined) {
    const batch = input.state.batches.find(
      (item) => item.id === input.attempt.batchId,
    );

    if (batch === undefined) {
      return [
        issue({
          code: "task_execution_invocation_batch_missing",
          message:
            "Started attempt batch no longer exists in current authoritative task state.",
          category: "validation",
          taskId: input.state.taskId,
          attemptId: input.attempt.attemptId,
          batchId: input.attempt.batchId,
        }),
      ];
    }

    if (!batch.workItemIds.some((workItemId) => eligibleIds.has(workItemId))) {
      issues.push(
        issue({
          code: "task_execution_invocation_batch_not_executable",
          message:
            "Started attempt batch no longer contains pending or retryable work.",
          category: "validation",
          taskId: input.state.taskId,
          attemptId: input.attempt.attemptId,
          batchId: input.attempt.batchId,
        }),
      );
    }

    return issues;
  }

  if (eligibleIds.size === 0) {
    issues.push(
      issue({
        code: "task_execution_invocation_no_executable_work",
        message:
          "Current authoritative task state has no pending or retryable work eligible for invocation.",
        category: "validation",
        taskId: input.state.taskId,
        attemptId: input.attempt.attemptId,
      }),
    );
  }

  return issues;
}

function dependencyFromUnknown(
  value: unknown,
): TaskExecutionInvocationDependency | undefined {
  if (!isRecord(value) || value.kind !== "test_noop") {
    return undefined;
  }

  if (typeof value.invoke !== "function") {
    return undefined;
  }

  return value as unknown as TaskExecutionInvocationDependency;
}

function hasTrueKey(value: unknown, keys: ReadonlySet<string>): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => hasTrueKey(item, keys));
  }

  if (!isRecord(value)) {
    return false;
  }

  for (const [key, item] of Object.entries(value)) {
    if (keys.has(key) && item === true) {
      return true;
    }

    if (hasTrueKey(item, keys)) {
      return true;
    }
  }

  return false;
}

function summarize(input: {
  readonly invocationAllowed: boolean;
  readonly dependencyKind: TaskExecutionInvocationDependencyKind | null;
  readonly dependencyInvoked: boolean;
  readonly invocationReturned: boolean;
  readonly invocationOk: boolean;
  readonly dependencyResult?: TaskExecutionInvocationDependencyResult;
  readonly issueCount: number;
}): TaskExecutionInvocationSummary {
  return {
    invocationAllowed: input.invocationAllowed,
    dependencyKind: input.dependencyKind,
    dependencyInvoked: input.dependencyInvoked,
    invocationReturned: input.invocationReturned,
    invocationOk: input.invocationOk,
    executorClaimedCompleted: hasTrueKey(input.dependencyResult, new Set(["completed"])),
    executorClaimedVerified: hasTrueKey(input.dependencyResult, new Set(["verified"])),
    executorClaimedApproved: hasTrueKey(input.dependencyResult, new Set(["approved"])),
    executorClaimedAllDone: hasTrueKey(input.dependencyResult, new Set(["allDone"])),
    duplicateInvocationProtection: "not_persisted_mvp_noop_only",
    resultAuthority: "invocation_diagnostic_only",
    issueCount: input.issueCount,
  };
}

function baseResult(input: {
  readonly state?: PersistedTaskState;
  readonly attempt?: TaskExecutionAttempt;
  readonly dependencyKind?: TaskExecutionInvocationDependencyKind | null;
  readonly expectedRevision?: number | null;
  readonly latestAttemptNumberForContext?: number | null;
  readonly idempotencyReference?: string | null;
  readonly verifierRequired?: boolean | null;
  readonly completionGatedByVerifier?: boolean | null;
  readonly invocationStatus: "blocked" | "succeeded" | "failed";
  readonly invocationAllowed: boolean;
  readonly dependencyInvoked: boolean;
  readonly invocationReturned: boolean;
  readonly invocationOk: boolean;
  readonly dependencyResult?: TaskExecutionInvocationDependencyResult;
  readonly issues: readonly TaskExecutionInvocationIssue[];
}): TaskExecutionInvocationResult {
  const output =
    input.dependencyResult?.output !== undefined &&
    isJsonValue(input.dependencyResult.output)
      ? input.dependencyResult.output
      : undefined;
  const metadata =
    input.dependencyResult?.metadata !== undefined &&
    isJsonObject(input.dependencyResult.metadata)
      ? input.dependencyResult.metadata
      : undefined;

  return {
    ok: input.invocationStatus === "succeeded",
    invocationStatus: input.invocationStatus,
    invocationAllowed: input.invocationAllowed,
    dependencyKind: input.dependencyKind ?? null,
    dependencyInvoked: input.dependencyInvoked,
    invocationReturned: input.invocationReturned,
    invocationOk: input.invocationOk,
    taskId: input.state?.taskId ?? input.attempt?.taskId ?? null,
    attemptId: input.attempt?.attemptId ?? null,
    attemptNumber: input.attempt?.attemptNumber ?? null,
    sourceTaskRevision: input.attempt?.taskStateRevision ?? null,
    currentTaskRevision: input.state?.revision ?? null,
    expectedRevision: input.expectedRevision ?? null,
    latestAttemptNumberForContext: input.latestAttemptNumberForContext ?? null,
    workItemId: input.attempt?.workItemId ?? null,
    batchId: input.attempt?.batchId ?? null,
    idempotencyReference: input.idempotencyReference ?? null,
    verifierRequired: input.verifierRequired ?? null,
    completionGatedByVerifier: input.completionGatedByVerifier ?? null,
    output,
    outputReference: safeText(input.dependencyResult?.outputReference),
    diagnosticCode: safeText(input.dependencyResult?.diagnosticCode),
    message: safeText(input.dependencyResult?.message),
    metadata,
    issues: input.issues,
    safety: invocationSafety,
    summary: summarize({
      invocationAllowed: input.invocationAllowed,
      dependencyKind: input.dependencyKind ?? null,
      dependencyInvoked: input.dependencyInvoked,
      invocationReturned: input.invocationReturned,
      invocationOk: input.invocationOk,
      dependencyResult: input.dependencyResult,
      issueCount: input.issues.length,
    }),
  };
}

function idempotencyReferenceFor(input: {
  readonly invocationId?: string;
  readonly attempt: TaskExecutionAttempt;
}): string {
  return (
    input.invocationId ??
    `invocation-${input.attempt.attemptId}-r${input.attempt.taskStateRevision}-n${input.attempt.attemptNumber}`
  );
}

function validateAllowedOperationReferences(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is string =>
      typeof item === "string" && item.trim().length > 0,
  );
}

export async function invokeStartedTaskExecutionAttempt(
  input: TaskExecutionInvocationInput,
): Promise<TaskExecutionInvocationResult> {
  const stateResult = validatePersistedTaskState(input.state);

  if (!stateResult.ok) {
    return baseResult({
      invocationStatus: "blocked",
      invocationAllowed: false,
      dependencyKind: null,
      dependencyInvoked: false,
      invocationReturned: false,
      invocationOk: false,
      issues: [issueFromError(stateResult.error)],
    });
  }

  const attemptResult = validateTaskExecutionAttempt(input.attempt);

  if (!attemptResult.ok) {
    return baseResult({
      state: stateResult.value,
      invocationStatus: "blocked",
      invocationAllowed: false,
      dependencyKind: null,
      expectedRevision: input.expectedRevision ?? null,
      latestAttemptNumberForContext: input.latestAttemptNumberForContext ?? null,
      dependencyInvoked: false,
      invocationReturned: false,
      invocationOk: false,
      issues: [issueFromError(attemptResult.error)],
    });
  }

  const state = stateResult.value;
  const attempt = attemptResult.value;
  const dependency = dependencyFromUnknown(input.dependency);
  const dependencyKind = dependency?.kind ?? null;
  const issues: TaskExecutionInvocationIssue[] = [];

  if (dependency === undefined) {
    issues.push(
      issue({
        code: "task_execution_invocation_dependency_not_test_noop",
        message:
          "Task execution invocation MVP accepts only an explicitly injected test/no-op dependency.",
        category: "validation",
        taskId: state.taskId,
        attemptId: attempt.attemptId,
      }),
    );
  }

  if (
    input.expectedRevision !== undefined &&
    !isPositiveInteger(input.expectedRevision)
  ) {
    issues.push(
      issue({
        code: "task_execution_invocation_expected_revision_invalid",
        message:
          "Task execution invocation expected revision must be a positive integer.",
        category: "validation",
        taskId: state.taskId,
        attemptId: attempt.attemptId,
      }),
    );
  } else if (
    input.expectedRevision !== undefined &&
    input.expectedRevision !== state.revision
  ) {
    issues.push(
      issue({
        code: "task_execution_invocation_expected_revision_mismatch",
        message:
          "Expected task revision does not match current authoritative task state revision.",
        category: "conflict",
        taskId: state.taskId,
        attemptId: attempt.attemptId,
      }),
    );
  }

  if (attempt.taskId !== state.taskId) {
    issues.push(
      issue({
        code: "task_execution_invocation_task_mismatch",
        message:
          "Started attempt task id does not match current authoritative task state.",
        category: "validation",
        taskId: state.taskId,
        attemptId: attempt.attemptId,
      }),
    );
  }

  if (attempt.taskStateRevision !== state.revision) {
    issues.push(
      issue({
        code: "task_execution_invocation_stale_task_revision",
        message:
          "Started attempt source revision does not match current authoritative task state revision.",
        category: "conflict",
        taskId: state.taskId,
        attemptId: attempt.attemptId,
      }),
    );
  }

  if (attempt.lifecycle !== "started") {
    issues.push(
      issue({
        code: "task_execution_invocation_attempt_not_started",
        message:
          "Only authoritative started attempts are eligible for invocation.",
        category: "validation",
        taskId: state.taskId,
        attemptId: attempt.attemptId,
        workItemId: attempt.workItemId,
        batchId: attempt.batchId,
      }),
    );
  }

  if (
    input.latestAttemptNumberForContext !== undefined &&
    (!isPositiveInteger(input.latestAttemptNumberForContext) ||
      input.latestAttemptNumberForContext !== attempt.attemptNumber)
  ) {
    issues.push(
      issue({
        code: "task_execution_invocation_attempt_number_obsolete",
        message:
          "A later or conflicting persisted attempt number supersedes this started attempt for the same task/revision/work/batch context.",
        category: "conflict",
        taskId: state.taskId,
        attemptId: attempt.attemptId,
        workItemId: attempt.workItemId,
        batchId: attempt.batchId,
      }),
    );
  }

  issues.push(...collectWorkBatchIssues({ state, attempt }));

  const policyRequired =
    attempt.policyRequirement.required ||
    state.plan.summary?.approvalRequired === true;

  if (policyRequired) {
    issues.push(
      issue({
        code: "task_execution_invocation_policy_not_authorized",
        message:
          "Policy is required, but no authoritative policy approval proof exists in the current invocation MVP.",
        category: "policy",
        taskId: state.taskId,
        attemptId: attempt.attemptId,
      }),
    );
  }

  const verifierRequired =
    state.verifier.required || attempt.verifierRequirement.required;
  const completionGatedByVerifier =
    state.verifier.completionGatedByVerifier &&
    attempt.verifierRequirement.completionGatedByVerifier;
  const idempotencyReference = idempotencyReferenceFor({
    attempt,
    invocationId: input.invocationId,
  });

  if (issues.length > 0 || dependency === undefined) {
    return baseResult({
      state,
      attempt,
      dependencyKind,
      expectedRevision: input.expectedRevision ?? null,
      latestAttemptNumberForContext: input.latestAttemptNumberForContext ?? null,
      idempotencyReference,
      verifierRequired,
      completionGatedByVerifier,
      invocationStatus: "blocked",
      invocationAllowed: false,
      dependencyInvoked: false,
      invocationReturned: false,
      invocationOk: false,
      issues,
    });
  }

  const request: TaskExecutionInvocationRequest = {
    taskId: attempt.taskId,
    attemptId: attempt.attemptId,
    attemptNumber: attempt.attemptNumber,
    sourceTaskRevision: attempt.taskStateRevision,
    workItemId: attempt.workItemId,
    batchId: attempt.batchId,
    idempotencyReference,
    allowedOperationReferences: validateAllowedOperationReferences(
      input.allowedOperationReferences,
    ),
    verifierRequired,
    completionGatedByVerifier,
  };

  let dependencyResult: TaskExecutionInvocationDependencyResult;

  try {
    dependencyResult = await dependency.invoke(request);
  } catch {
    const dependencyIssue = issue({
      code: "task_execution_invocation_dependency_threw",
      message:
        "Injected test/no-op dependency threw during invocation; no authoritative state was changed.",
      category: "unknown",
      taskId: state.taskId,
      attemptId: attempt.attemptId,
      workItemId: attempt.workItemId,
      batchId: attempt.batchId,
    });

    return baseResult({
      state,
      attempt,
      dependencyKind,
      expectedRevision: input.expectedRevision ?? null,
      latestAttemptNumberForContext: input.latestAttemptNumberForContext ?? null,
      idempotencyReference,
      verifierRequired,
      completionGatedByVerifier,
      invocationStatus: "failed",
      invocationAllowed: true,
      dependencyInvoked: true,
      invocationReturned: false,
      invocationOk: false,
      issues: [dependencyIssue],
    });
  }

  if (!isRecord(dependencyResult) || typeof dependencyResult.ok !== "boolean") {
    return baseResult({
      state,
      attempt,
      dependencyKind,
      expectedRevision: input.expectedRevision ?? null,
      latestAttemptNumberForContext: input.latestAttemptNumberForContext ?? null,
      idempotencyReference,
      verifierRequired,
      completionGatedByVerifier,
      invocationStatus: "failed",
      invocationAllowed: true,
      dependencyInvoked: true,
      invocationReturned: true,
      invocationOk: false,
      issues: [
        issue({
          code: "task_execution_invocation_dependency_result_invalid",
          message:
            "Injected test/no-op dependency returned an invalid diagnostic result shape.",
          category: "validation",
          taskId: state.taskId,
          attemptId: attempt.attemptId,
          workItemId: attempt.workItemId,
          batchId: attempt.batchId,
        }),
      ],
    });
  }

  if (
    (dependencyResult.output !== undefined &&
      !isJsonValue(dependencyResult.output)) ||
    (dependencyResult.metadata !== undefined &&
      !isJsonObject(dependencyResult.metadata))
  ) {
    return baseResult({
      state,
      attempt,
      dependencyKind,
      expectedRevision: input.expectedRevision ?? null,
      latestAttemptNumberForContext: input.latestAttemptNumberForContext ?? null,
      idempotencyReference,
      verifierRequired,
      completionGatedByVerifier,
      invocationStatus: "failed",
      invocationAllowed: true,
      dependencyInvoked: true,
      invocationReturned: true,
      invocationOk: false,
      dependencyResult,
      issues: [
        issue({
          code: "task_execution_invocation_dependency_result_not_json",
          message:
            "Injected test/no-op dependency returned non-JSON diagnostic data.",
          category: "validation",
          taskId: state.taskId,
          attemptId: attempt.attemptId,
          workItemId: attempt.workItemId,
          batchId: attempt.batchId,
        }),
      ],
    });
  }

  const resultIssue = dependencyResult.ok
    ? []
    : [
        issue({
          code:
            safeText(dependencyResult.diagnosticCode) ??
            "task_execution_invocation_dependency_not_ok",
          message:
            safeText(dependencyResult.message) ??
            "Injected test/no-op dependency returned a non-ok invocation diagnostic.",
          category: "unknown",
          taskId: state.taskId,
          attemptId: attempt.attemptId,
          workItemId: attempt.workItemId,
          batchId: attempt.batchId,
        }),
      ];

  return baseResult({
    state,
    attempt,
    dependencyKind,
    expectedRevision: input.expectedRevision ?? null,
    latestAttemptNumberForContext: input.latestAttemptNumberForContext ?? null,
    idempotencyReference,
    verifierRequired,
    completionGatedByVerifier,
    invocationStatus: dependencyResult.ok ? "succeeded" : "failed",
    invocationAllowed: true,
    dependencyInvoked: true,
    invocationReturned: true,
    invocationOk: dependencyResult.ok,
    dependencyResult,
    issues: resultIssue,
  });
}
