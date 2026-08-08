import type {
  AgenticLifecycleIssue,
  AgenticTaskId,
  AgenticWorkBatchId,
  AgenticWorkItemId,
} from "./agentic-lifecycle.js";
import type { AeosError, Result } from "./types.js";
import {
  loadTaskState,
  validatePersistedTaskState,
  type LoadTaskStateInput,
  type PersistedTaskLifecycleState,
  type PersistedTaskState,
  type TaskStatePersistenceError,
} from "./task-state-persistence.js";

export interface TaskResumeHandoff {
  readonly taskId: AgenticTaskId;
  readonly sourceRevision: number;
  readonly lifecycleState: PersistedTaskLifecycleState | "unknown";
  readonly pendingWorkItemIds: readonly AgenticWorkItemId[];
  readonly retryableWorkItemIds: readonly AgenticWorkItemId[];
  readonly nextBatchId?: AgenticWorkBatchId;
  readonly currentBatchId?: AgenticWorkBatchId;
  readonly remainingWorkItemCount: number;
  readonly verifierRequired: boolean;
  readonly completionGatedByVerifier: boolean;
  readonly resumeAllowed: boolean;
  readonly blockedReason?: string;
  readonly issues: readonly AgenticLifecycleIssue[];
  readonly noExecution: true;
  readonly noWrites: true;
}

export interface LoadTaskResumeHandoffResult {
  readonly handoff: TaskResumeHandoff;
  readonly path: string;
}

export type LoadTaskResumeHandoffInput = LoadTaskStateInput;

export type TaskResumeHandoffError = TaskStatePersistenceError | AeosError;

const resumableLifecycleStates = new Set<string>([
  "planned",
  "dry_run_ready",
  "verification_required",
]);

function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

function createIssue(
  code: string,
  message: string,
  workItemId?: AgenticWorkItemId,
  batchId?: AgenticWorkBatchId,
): AgenticLifecycleIssue {
  return {
    code,
    message,
    severity: "error",
    category: "resume_failure",
    workItemId,
    batchId,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArrayOrEmpty(value: unknown): readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : [];
}

function taskIdFromUnknown(value: unknown): AgenticTaskId {
  return isRecord(value) && typeof value.taskId === "string"
    ? value.taskId
    : "unknown";
}

function revisionFromUnknown(value: unknown): number {
  return isRecord(value) &&
    typeof value.revision === "number" &&
    Number.isInteger(value.revision) &&
    value.revision > 0
    ? value.revision
    : 0;
}

function lifecycleFromUnknown(
  value: unknown,
): PersistedTaskLifecycleState | "unknown" {
  if (!isRecord(value) || typeof value.lifecycleState !== "string") {
    return "unknown";
  }

  return resumableLifecycleStates.has(value.lifecycleState) ||
    value.lifecycleState === "new" ||
    value.lifecycleState === "blocked" ||
    value.lifecycleState === "failed"
    ? value.lifecycleState as PersistedTaskLifecycleState
    : "unknown";
}

function blockedHandoff(
  value: unknown,
  issues: readonly AgenticLifecycleIssue[],
): TaskResumeHandoff {
  const recordValue = isRecord(value) ? value : {};
  const verifier = recordValue.verifier;

  return {
    taskId: taskIdFromUnknown(value),
    sourceRevision: revisionFromUnknown(value),
    lifecycleState: lifecycleFromUnknown(value),
    pendingWorkItemIds: stringArrayOrEmpty(recordValue.pendingWorkItemIds),
    retryableWorkItemIds: stringArrayOrEmpty(recordValue.retryableWorkItemIds),
    remainingWorkItemCount: 0,
    verifierRequired:
      isRecord(verifier) && typeof verifier.required === "boolean"
        ? verifier.required
        : false,
    completionGatedByVerifier:
      isRecord(verifier) && verifier.completionGatedByVerifier === true,
    resumeAllowed: false,
    blockedReason: issues[0]?.message ?? "Resume handoff is blocked.",
    issues,
    noExecution: true,
    noWrites: true,
  };
}

function deriveNextBatchId(
  state: PersistedTaskState,
  remainingIds: ReadonlySet<string>,
): AgenticWorkBatchId | undefined {
  if (state.nextBatchId !== undefined) {
    return state.nextBatchId;
  }

  return state.batches.find((batch) =>
    batch.workItemIds.some((workItemId) => remainingIds.has(workItemId)),
  )?.id;
}

export function createTaskResumeHandoff(
  state: unknown,
): TaskResumeHandoff {
  const stateResult = validatePersistedTaskState(state);

  if (!stateResult.ok) {
    return blockedHandoff(state, [
      createIssue(
        stateResult.error.code,
        stateResult.error.message,
      ),
    ]);
  }

  const persistedState = stateResult.value;
  const issues: AgenticLifecycleIssue[] = [];

  if (!resumableLifecycleStates.has(persistedState.lifecycleState)) {
    issues.push(
      createIssue(
        "task_resume_lifecycle_not_resumable",
        "Persisted task lifecycle state is not resumable.",
      ),
    );
  }

  const remainingWorkItemIds = [
    ...persistedState.pendingWorkItemIds,
    ...persistedState.retryableWorkItemIds,
  ];
  const remainingIdSet = new Set(remainingWorkItemIds);

  if (remainingWorkItemIds.length === 0) {
    issues.push(
      createIssue(
        "task_resume_no_remaining_work",
        "Resume handoff requires authoritative pending or retryable work.",
      ),
    );
  }

  const nextBatchId = deriveNextBatchId(persistedState, remainingIdSet);

  if (nextBatchId !== undefined) {
    const nextBatch = persistedState.batches.find(
      (batch) => batch.id === nextBatchId,
    );

    if (
      nextBatch === undefined ||
      !nextBatch.workItemIds.some((workItemId) => remainingIdSet.has(workItemId))
    ) {
      issues.push(
        createIssue(
          "task_resume_next_batch_not_resumable",
          "Resume handoff next batch must reference pending or retryable work.",
          undefined,
          nextBatchId,
        ),
      );
    }
  }

  const blockedReason = issues[0]?.message;

  return {
    taskId: persistedState.taskId,
    sourceRevision: persistedState.revision,
    lifecycleState: persistedState.lifecycleState,
    pendingWorkItemIds: persistedState.pendingWorkItemIds,
    retryableWorkItemIds: persistedState.retryableWorkItemIds,
    nextBatchId,
    currentBatchId: persistedState.currentBatchId,
    remainingWorkItemCount: remainingWorkItemIds.length,
    verifierRequired: persistedState.verifier.required,
    completionGatedByVerifier:
      persistedState.verifier.completionGatedByVerifier,
    resumeAllowed: issues.length === 0,
    blockedReason,
    issues,
    noExecution: true,
    noWrites: true,
  };
}

export async function loadTaskResumeHandoff(
  input: LoadTaskResumeHandoffInput,
): Promise<Result<LoadTaskResumeHandoffResult, TaskResumeHandoffError>> {
  const loadResult = await loadTaskState(input);

  if (!loadResult.ok) {
    return loadResult;
  }

  return ok({
    handoff: createTaskResumeHandoff(loadResult.value.state),
    path: loadResult.value.path,
  });
}
