import type {
  AgenticExecutionAttemptId,
  AgenticTaskId,
  AgenticWorkBatchId,
  AgenticWorkItem,
  AgenticWorkItemId,
} from "./agentic-lifecycle.js";
import type {
  PersistedTaskState,
  TaskStatePersistenceError,
} from "./task-state-persistence.js";
import { validatePersistedTaskState } from "./task-state-persistence.js";
import type {
  TaskExecutionAttempt,
  TaskExecutionAttemptError,
  TaskExecutionAttemptLifecycle,
} from "./task-execution-attempt.js";
import { validateTaskExecutionAttempt } from "./task-execution-attempt.js";
import type { AeosError, Result } from "./types.js";

export interface TaskExecutionStartAuthorizationInput {
  readonly state: unknown;
  readonly attempt: unknown;
  readonly expectedRevision?: number;
  readonly latestAttemptNumberForContext?: number;
}

export interface TaskExecutionStartAuthorizationIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: "error";
  readonly category: AeosError["category"];
  readonly taskId?: AgenticTaskId;
  readonly attemptId?: AgenticExecutionAttemptId;
  readonly workItemId?: AgenticWorkItemId;
  readonly batchId?: AgenticWorkBatchId;
}

export interface TaskExecutionStartAuthorizationSafety {
  readonly readOnly: true;
  readonly attemptStarted: false;
  readonly executionPerformed: false;
  readonly adapterCalls: false;
  readonly auditWrites: false;
  readonly verifierRun: false;
  readonly taskStateModified: false;
  readonly attemptModified: false;
  readonly workCompleted: false;
  readonly taskCompleted: false;
}

export interface TaskExecutionStartAuthorizationResult {
  readonly ok: boolean;
  readonly taskId: AgenticTaskId | null;
  readonly attemptId: AgenticExecutionAttemptId | null;
  readonly sourceRevision: number | null;
  readonly currentTaskRevision: number | null;
  readonly expectedRevision: number | null;
  readonly attemptNumber: number | null;
  readonly latestAttemptNumberForContext: number | null;
  readonly workItemId: AgenticWorkItemId | null;
  readonly batchId: AgenticWorkBatchId | null;
  readonly lifecycle: TaskExecutionAttemptLifecycle | string | null;
  readonly startAllowed: boolean;
  readonly policyRequired: boolean | null;
  readonly policyAuthorized: boolean | null;
  readonly policyStatus:
    | "not_required"
    | "not_authorized"
    | "blocked"
    | "unknown";
  readonly verifierRequired: boolean | null;
  readonly completionGatedByVerifier: boolean | null;
  readonly issues: readonly TaskExecutionStartAuthorizationIssue[];
  readonly safety: TaskExecutionStartAuthorizationSafety;
}

export type TaskExecutionStartAuthorizationError =
  | TaskStatePersistenceError
  | TaskExecutionAttemptError
  | AeosError;

const executableLifecycleStates = new Set<string>([
  "planned",
  "dry_run_ready",
  "verification_required",
]);

const startAuthorizationSafety: TaskExecutionStartAuthorizationSafety = {
  readOnly: true,
  attemptStarted: false,
  executionPerformed: false,
  adapterCalls: false,
  auditWrites: false,
  verifierRun: false,
  taskStateModified: false,
  attemptModified: false,
  workCompleted: false,
  taskCompleted: false,
};

function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

function err(
  error: TaskExecutionStartAuthorizationError,
): Result<never, TaskExecutionStartAuthorizationError> {
  return { ok: false, error };
}

function createError(
  code: string,
  message: string,
  category: AeosError["category"],
  details?: Record<string, string | number | boolean | null>,
): TaskExecutionStartAuthorizationError {
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

function issue(input: {
  readonly code: string;
  readonly message: string;
  readonly category: AeosError["category"];
  readonly taskId?: AgenticTaskId;
  readonly attemptId?: AgenticExecutionAttemptId;
  readonly workItemId?: AgenticWorkItemId;
  readonly batchId?: AgenticWorkBatchId;
}): TaskExecutionStartAuthorizationIssue {
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

function issueFromError(
  error: TaskExecutionStartAuthorizationError,
): TaskExecutionStartAuthorizationIssue {
  return issue({
    code: error.code,
    message: error.message,
    category: error.category,
  });
}

function baseResult(input?: {
  readonly state?: PersistedTaskState;
  readonly attempt?: TaskExecutionAttempt;
  readonly expectedRevision?: number;
  readonly latestAttemptNumberForContext?: number;
  readonly issues?: readonly TaskExecutionStartAuthorizationIssue[];
  readonly ok?: boolean;
  readonly startAllowed?: boolean;
  readonly policyRequired?: boolean | null;
  readonly policyAuthorized?: boolean | null;
  readonly policyStatus?: TaskExecutionStartAuthorizationResult["policyStatus"];
  readonly verifierRequired?: boolean | null;
  readonly completionGatedByVerifier?: boolean | null;
}): TaskExecutionStartAuthorizationResult {
  return {
    ok: input?.ok ?? false,
    taskId: input?.state?.taskId ?? input?.attempt?.taskId ?? null,
    attemptId: input?.attempt?.attemptId ?? null,
    sourceRevision: input?.attempt?.taskStateRevision ?? null,
    currentTaskRevision: input?.state?.revision ?? null,
    expectedRevision: input?.expectedRevision ?? null,
    attemptNumber: input?.attempt?.attemptNumber ?? null,
    latestAttemptNumberForContext: input?.latestAttemptNumberForContext ?? null,
    workItemId: input?.attempt?.workItemId ?? null,
    batchId: input?.attempt?.batchId ?? null,
    lifecycle: input?.attempt?.lifecycle ?? null,
    startAllowed: input?.startAllowed ?? false,
    policyRequired: input?.policyRequired ?? input?.attempt?.policyRequirement.required ?? null,
    policyAuthorized: input?.policyAuthorized ?? null,
    policyStatus: input?.policyStatus ?? "unknown",
    verifierRequired:
      input?.verifierRequired ??
      (input?.state === undefined && input?.attempt === undefined
        ? null
        : Boolean(
            input?.state?.verifier.required ??
              input?.attempt?.verifierRequirement.required,
          )),
    completionGatedByVerifier:
      input?.completionGatedByVerifier ??
      (input?.state === undefined && input?.attempt === undefined
        ? null
        : Boolean(
            input?.state?.verifier.completionGatedByVerifier ??
              input?.attempt?.verifierRequirement.completionGatedByVerifier,
          )),
    issues: input?.issues ?? [],
    safety: startAuthorizationSafety,
  };
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(36).padStart(7, "0");
}

function createAttemptId(input: {
  readonly taskId: AgenticTaskId;
  readonly taskStateRevision: number;
  readonly attemptNumber: number;
  readonly workItemId?: AgenticWorkItemId;
  readonly batchId?: AgenticWorkBatchId;
}): AgenticExecutionAttemptId {
  const discriminator = JSON.stringify({
    taskId: input.taskId,
    taskStateRevision: input.taskStateRevision,
    attemptNumber: input.attemptNumber,
    workItemId: input.workItemId ?? null,
    batchId: input.batchId ?? null,
  });

  return `attempt-${input.taskId}-r${input.taskStateRevision}-n${input.attemptNumber}-${stableHash(discriminator)}`;
}

function representedWorkItem(
  state: PersistedTaskState,
  workItemId: AgenticWorkItemId,
): AgenticWorkItem | undefined {
  return state.workItems.find((workItem) => workItem.id === workItemId);
}

function eligibleWorkItemIdsForState(
  state: PersistedTaskState,
): ReadonlySet<AgenticWorkItemId> {
  return new Set([...state.pendingWorkItemIds, ...state.retryableWorkItemIds]);
}

function currentPolicyRequired(input: {
  readonly state: PersistedTaskState;
  readonly attempt: TaskExecutionAttempt;
}): boolean {
  return (
    input.attempt.policyRequirement.required ||
    input.state.plan.summary?.approvalRequired === true
  );
}

function validateExpectedRevision(
  expectedRevision: number | undefined,
): Result<number | undefined, TaskExecutionStartAuthorizationError> {
  if (expectedRevision === undefined) {
    return ok(undefined);
  }

  if (!isPositiveInteger(expectedRevision)) {
    return err(
      createError(
        "task_execution_start_expected_revision_invalid",
        "Task execution start authorization expected revision must be a positive integer.",
        "validation",
      ),
    );
  }

  return ok(expectedRevision);
}

function collectWorkBatchIssues(input: {
  readonly state: PersistedTaskState;
  readonly attempt: TaskExecutionAttempt;
}): readonly TaskExecutionStartAuthorizationIssue[] {
  const issues: TaskExecutionStartAuthorizationIssue[] = [];
  const eligibleIds = eligibleWorkItemIdsForState(input.state);

  if (input.attempt.workItemId !== undefined) {
    const workItem = representedWorkItem(input.state, input.attempt.workItemId);

    if (workItem === undefined) {
      issues.push(
        issue({
          code: "task_execution_start_work_item_missing",
          message:
            "Prepared attempt work item no longer exists in current persisted task state.",
          category: "validation",
          taskId: input.state.taskId,
          attemptId: input.attempt.attemptId,
          workItemId: input.attempt.workItemId,
          batchId: input.attempt.batchId,
        }),
      );

      return issues;
    }

    if (!eligibleIds.has(input.attempt.workItemId)) {
      issues.push(
        issue({
          code: "task_execution_start_work_item_not_executable",
          message:
            "Prepared attempt work item is no longer pending or retryable in current persisted task state.",
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
            code: "task_execution_start_work_batch_mismatch",
            message:
              "Prepared attempt work item and batch binding no longer matches current persisted task state.",
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
      issues.push(
        issue({
          code: "task_execution_start_batch_missing",
          message:
            "Prepared attempt batch no longer exists in current persisted task state.",
          category: "validation",
          taskId: input.state.taskId,
          attemptId: input.attempt.attemptId,
          batchId: input.attempt.batchId,
        }),
      );

      return issues;
    }

    if (!batch.workItemIds.some((workItemId) => eligibleIds.has(workItemId))) {
      issues.push(
        issue({
          code: "task_execution_start_batch_not_executable",
          message:
            "Prepared attempt batch no longer contains pending or retryable work.",
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
        code: "task_execution_start_no_executable_work",
        message:
          "Current persisted task state has no pending or retryable work eligible for execution start.",
        category: "validation",
        taskId: input.state.taskId,
        attemptId: input.attempt.attemptId,
      }),
    );
  }

  return issues;
}

export function authorizeTaskExecutionStart(
  input: TaskExecutionStartAuthorizationInput,
): TaskExecutionStartAuthorizationResult {
  const stateResult = validatePersistedTaskState(input.state);

  if (!stateResult.ok) {
    return baseResult({
      issues: [issueFromError(stateResult.error)],
    });
  }

  const expectedRevisionResult = validateExpectedRevision(input.expectedRevision);

  if (!expectedRevisionResult.ok) {
    return baseResult({
      state: stateResult.value,
      issues: [issueFromError(expectedRevisionResult.error)],
    });
  }

  const attemptResult = validateTaskExecutionAttempt(input.attempt);

  if (!attemptResult.ok) {
    return baseResult({
      state: stateResult.value,
      expectedRevision: expectedRevisionResult.value,
      issues: [issueFromError(attemptResult.error)],
    });
  }

  const state = stateResult.value;
  const attempt = attemptResult.value;
  const issues: TaskExecutionStartAuthorizationIssue[] = [];

  if (attempt.taskId !== state.taskId) {
    issues.push(
      issue({
        code: "task_execution_start_task_mismatch",
        message:
          "Persisted attempt task id does not match current authoritative task state.",
        category: "validation",
        taskId: state.taskId,
        attemptId: attempt.attemptId,
      }),
    );
  }

  if (expectedRevisionResult.value !== undefined && state.revision !== expectedRevisionResult.value) {
    issues.push(
      issue({
        code: "task_execution_start_expected_revision_mismatch",
        message:
          "Expected task revision does not match current authoritative task state revision.",
        category: "conflict",
        taskId: state.taskId,
        attemptId: attempt.attemptId,
      }),
    );
  }

  if (attempt.taskStateRevision !== state.revision) {
    issues.push(
      issue({
        code: "task_execution_start_stale_task_revision",
        message:
          "Prepared attempt source revision does not match current authoritative task state revision.",
        category: "conflict",
        taskId: state.taskId,
        attemptId: attempt.attemptId,
      }),
    );
  }

  if (attempt.lifecycle !== "prepared") {
    issues.push(
      issue({
        code: "task_execution_start_attempt_not_prepared",
        message:
          "Only persisted prepared attempts are eligible for execution start authorization.",
        category: "validation",
        taskId: state.taskId,
        attemptId: attempt.attemptId,
      }),
    );
  }

  const expectedAttemptId = createAttemptId({
    taskId: attempt.taskId,
    taskStateRevision: attempt.taskStateRevision,
    attemptNumber: attempt.attemptNumber,
    workItemId: attempt.workItemId,
    batchId: attempt.batchId,
  });

  if (attempt.attemptId !== expectedAttemptId) {
    issues.push(
      issue({
        code: "task_execution_start_identity_mismatch",
        message:
          "Persisted attempt identity does not match its system-derived task/revision/work/batch binding.",
        category: "validation",
        taskId: state.taskId,
        attemptId: attempt.attemptId,
        workItemId: attempt.workItemId,
        batchId: attempt.batchId,
      }),
    );
  }

  if (!executableLifecycleStates.has(state.lifecycleState)) {
    issues.push(
      issue({
        code: "task_execution_start_task_lifecycle_not_executable",
        message:
          "Current task lifecycle is not eligible for execution start.",
        category: "validation",
        taskId: state.taskId,
        attemptId: attempt.attemptId,
      }),
    );
  }

  if (
    input.latestAttemptNumberForContext !== undefined &&
    (!isPositiveInteger(input.latestAttemptNumberForContext) ||
      attempt.attemptNumber !== input.latestAttemptNumberForContext)
  ) {
    issues.push(
      issue({
        code: "task_execution_start_attempt_number_obsolete",
        message:
          "A later or conflicting persisted attempt number supersedes this prepared attempt for the same task/revision/work/batch context.",
        category: "conflict",
        taskId: state.taskId,
        attemptId: attempt.attemptId,
        workItemId: attempt.workItemId,
        batchId: attempt.batchId,
      }),
    );
  }

  if (attempt.adapterReferences.adapterCallIds.length > 0) {
    issues.push(
      issue({
        code: "task_execution_start_prepared_adapter_calls_forbidden",
        message:
          "Prepared attempts cannot claim prior adapter calls before execution start.",
        category: "validation",
        taskId: state.taskId,
        attemptId: attempt.attemptId,
      }),
    );
  }

  issues.push(
    ...collectWorkBatchIssues({
      state,
      attempt,
    }),
  );

  const policyRequired = currentPolicyRequired({ state, attempt });
  const verifierRequired =
    state.verifier.required || attempt.verifierRequirement.required;
  const completionGatedByVerifier =
    state.verifier.completionGatedByVerifier &&
    attempt.verifierRequirement.completionGatedByVerifier;

  if (policyRequired) {
    issues.push(
      issue({
        code: "task_execution_start_policy_not_authorized",
        message:
          "Policy is required, but no authoritative policy approval proof exists in the current MVP.",
        category: "policy",
        taskId: state.taskId,
        attemptId: attempt.attemptId,
      }),
    );
  }

  const startAllowed = issues.length === 0;

  return baseResult({
    state,
    attempt,
    expectedRevision: expectedRevisionResult.value,
    latestAttemptNumberForContext: input.latestAttemptNumberForContext,
    issues,
    ok:
      startAllowed ||
      issues.every((item) =>
        [
          "task_execution_start_task_lifecycle_not_executable",
          "task_execution_start_work_item_missing",
          "task_execution_start_work_item_not_executable",
          "task_execution_start_work_batch_mismatch",
          "task_execution_start_batch_missing",
          "task_execution_start_batch_not_executable",
          "task_execution_start_no_executable_work",
          "task_execution_start_policy_not_authorized",
        ].includes(item.code),
      ),
    startAllowed,
    policyRequired,
    policyAuthorized: policyRequired ? false : true,
    policyStatus: policyRequired ? "not_authorized" : "not_required",
    verifierRequired,
    completionGatedByVerifier,
  });
}

export function summarizeTaskExecutionStartAuthorization(
  result: TaskExecutionStartAuthorizationResult,
): readonly string[] {
  return [
    `Task id: ${result.taskId ?? ""}`,
    `Attempt id: ${result.attemptId ?? ""}`,
    `Attempt number: ${result.attemptNumber ?? ""}`,
    `Attempt lifecycle: ${result.lifecycle ?? ""}`,
    `Source revision: ${result.sourceRevision ?? ""}`,
    `Current task revision: ${result.currentTaskRevision ?? ""}`,
    `Work item: ${result.workItemId ?? "none"}`,
    `Batch: ${result.batchId ?? "none"}`,
    `Start allowed: ${String(result.startAllowed)}`,
    `Policy required: ${String(result.policyRequired ?? false)}`,
    `Policy authorized: ${String(result.policyAuthorized ?? false)}`,
    `Verifier required: ${String(result.verifierRequired ?? false)}`,
    `Completion gated by verifier: ${String(result.completionGatedByVerifier ?? false)}`,
  ];
}
