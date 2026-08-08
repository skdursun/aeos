import {
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  unlink,
// @ts-expect-error Node built-ins are available at runtime; this package does not depend on Node ambient types yet.
} from "node:fs/promises";
// @ts-expect-error Node built-ins are available at runtime; this package does not depend on Node ambient types yet.
import { randomUUID } from "node:crypto";
// @ts-expect-error Node built-ins are available at runtime; this package does not depend on Node ambient types yet.
import { isAbsolute, join, relative, resolve } from "node:path";

import type {
  AgenticLifecycleIssue,
  AgenticTaskId,
  AgenticWorkBatch,
  AgenticWorkBatchId,
  AgenticWorkItem,
  AgenticWorkItemId,
} from "./agentic-lifecycle.js";
import type {
  AgenticRunnerPlanningReference,
  AgenticRunnerPlanningSummary,
} from "./agentic-runner-planning.js";
import type { AgenticRunnerResumeState } from "./agentic-runner.js";
import type { AeosError, Result } from "./types.js";

export const AEOS_TASK_STATE_SCHEMA_VERSION = 1;
export const AEOS_TASK_STATE_ROOT_RELATIVE_PATH = ".aeos/state/tasks";

export type PersistedTaskLifecycleState =
  | "new"
  | "planned"
  | "dry_run_ready"
  | "verification_required"
  | "blocked"
  | "failed";

export type PersistedTaskPlanStatus = "not_planned" | "planned";

export type PersistedTaskVerifierStatus =
  | "not_required"
  | "pending"
  | "required_not_run"
  | "failed"
  | "blocked";

export type PersistedTaskCompletionGateStatus =
  | "not_satisfied"
  | "verification_required"
  | "blocked"
  | "failed";

export interface PersistedTaskSourceReference {
  readonly kind: "file" | "reference" | "unknown";
  readonly path?: string;
  readonly id?: string;
  readonly version?: string;
}

export interface PersistedTaskPlanReference {
  readonly status: PersistedTaskPlanStatus;
  readonly reference?: AgenticRunnerPlanningReference;
  readonly summary?: Pick<
    AgenticRunnerPlanningSummary,
    | "workItemCount"
    | "batchCount"
    | "stepCount"
    | "verifierRequired"
    | "approvalRequired"
    | "issueCount"
  >;
}

export interface PersistedTaskVerifierRequirement {
  readonly required: boolean;
  readonly status: PersistedTaskVerifierStatus;
  readonly completionGatedByVerifier: true;
  readonly resultReference?: AgenticRunnerPlanningReference;
}

export interface PersistedTaskCompletionGate {
  readonly status: PersistedTaskCompletionGateStatus;
  readonly satisfied: false;
  readonly completed: false;
  readonly verified: false;
  readonly authority: "system";
  readonly evidenceReferences: readonly string[];
}

export interface PersistedTaskSafetyMetadata {
  readonly completionAuthority: "system";
  readonly modelSelfReportTrusted: false;
  readonly executionPerformed: false;
  readonly verifierRun: false;
  readonly approved: false;
  readonly completed: false;
  readonly verified: false;
  readonly persistedSuccessClaimAllowed: false;
}

export interface PersistedTaskState {
  readonly schemaVersion: typeof AEOS_TASK_STATE_SCHEMA_VERSION;
  readonly taskId: AgenticTaskId;
  readonly sourceTask: PersistedTaskSourceReference;
  readonly lifecycleState: PersistedTaskLifecycleState;
  readonly workItems: readonly AgenticWorkItem[];
  readonly batches: readonly AgenticWorkBatch[];
  readonly pendingWorkItemIds: readonly AgenticWorkItemId[];
  readonly retryableWorkItemIds: readonly AgenticWorkItemId[];
  readonly currentBatchId?: AgenticWorkBatchId;
  readonly nextBatchId?: AgenticWorkBatchId;
  readonly plan: PersistedTaskPlanReference;
  readonly verifier: PersistedTaskVerifierRequirement;
  readonly completionGate: PersistedTaskCompletionGate;
  readonly resume?: AgenticRunnerResumeState;
  readonly issues: readonly AgenticLifecycleIssue[];
  readonly revision: number;
  readonly safety: PersistedTaskSafetyMetadata;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type TaskStatePersistenceError = AeosError;

export interface CreateInitialTaskStateInput {
  readonly taskId: AgenticTaskId;
  readonly sourceTaskPath?: string;
  readonly sourceTaskId?: string;
  readonly verifierRequired?: boolean;
  readonly createdAt?: string;
}

export interface TaskStateStorageInput {
  readonly projectRoot: string;
  readonly taskId: AgenticTaskId;
}

export interface SaveTaskStateInput {
  readonly projectRoot: string;
  readonly state: PersistedTaskState;
  readonly expectedRevision?: number;
}

export interface LoadTaskStateInput extends TaskStateStorageInput {}

export interface UpdateTaskStateInput extends TaskStateStorageInput {
  readonly expectedRevision: number;
  readonly updatedAt?: string;
  readonly update: (state: PersistedTaskState) => PersistedTaskState;
}

export interface TaskStateStoragePath {
  readonly stateRoot: string;
  readonly path: string;
}

export interface TaskStatePersistenceResult {
  readonly state: PersistedTaskState;
  readonly path: string;
}

const safeTaskIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

const allowedLifecycleStates = new Set<string>([
  "new",
  "planned",
  "dry_run_ready",
  "verification_required",
  "blocked",
  "failed",
]);

const allowedPlanStatuses = new Set<string>(["not_planned", "planned"]);

const allowedVerifierStatuses = new Set<string>([
  "not_required",
  "pending",
  "required_not_run",
  "failed",
  "blocked",
]);

const allowedCompletionGateStatuses = new Set<string>([
  "not_satisfied",
  "verification_required",
  "blocked",
  "failed",
]);

const forbiddenLifecycleStates = new Set<string>([
  "approved",
  "completed",
  "verified",
  "execution_success",
]);

const allowedTransitions: Readonly<
  Record<PersistedTaskLifecycleState, readonly PersistedTaskLifecycleState[]>
> = {
  new: ["planned", "blocked", "failed"],
  planned: ["dry_run_ready", "verification_required", "blocked", "failed"],
  dry_run_ready: ["planned", "verification_required", "blocked", "failed"],
  verification_required: ["planned", "dry_run_ready", "blocked", "failed"],
  blocked: ["planned", "failed"],
  failed: [],
};

function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

function err(error: TaskStatePersistenceError): Result<never, TaskStatePersistenceError> {
  return { ok: false, error };
}

function createError(
  code: string,
  message: string,
  category: AeosError["category"],
  details?: Record<string, string | number | boolean | null>,
): TaskStatePersistenceError {
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

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isInsideOrEqual(parentPath: string, childPath: string): boolean {
  const relativePath = relative(parentPath, childPath);

  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !isAbsolute(relativePath))
  );
}

function validateTaskId(
  taskId: AgenticTaskId,
): Result<AgenticTaskId, TaskStatePersistenceError> {
  if (typeof taskId !== "string" || taskId.trim().length === 0) {
    return err(
      createError(
        "task_state_task_id_required",
        "Task state task id is required.",
        "validation",
      ),
    );
  }

  if (
    taskId !== taskId.trim() ||
    taskId === "." ||
    taskId === ".." ||
    isAbsolute(taskId) ||
    !safeTaskIdPattern.test(taskId)
  ) {
    return err(
      createError(
        "task_state_unsafe_task_id",
        "Task id is not safe for persisted task-state storage.",
        "validation",
        { taskId },
      ),
    );
  }

  return ok(taskId);
}

export function getTaskStateStoragePath(
  input: TaskStateStorageInput,
): Result<TaskStateStoragePath, TaskStatePersistenceError> {
  const taskIdResult = validateTaskId(input.taskId);

  if (!taskIdResult.ok) {
    return taskIdResult;
  }

  const projectRoot = resolve(input.projectRoot);
  const stateRoot = resolve(projectRoot, AEOS_TASK_STATE_ROOT_RELATIVE_PATH);
  const path = resolve(stateRoot, `${taskIdResult.value}.json`);

  if (
    !isInsideOrEqual(projectRoot, stateRoot) ||
    !isInsideOrEqual(stateRoot, path)
  ) {
    return err(
      createError(
        "task_state_path_outside_root",
        "Task state storage path escaped the AEOS state root.",
        "permission",
      ),
    );
  }

  return ok({ stateRoot, path });
}

function createSafetyMetadata(): PersistedTaskSafetyMetadata {
  return {
    completionAuthority: "system",
    modelSelfReportTrusted: false,
    executionPerformed: false,
    verifierRun: false,
    approved: false,
    completed: false,
    verified: false,
    persistedSuccessClaimAllowed: false,
  };
}

export function createInitialTaskState(
  input: CreateInitialTaskStateInput,
): PersistedTaskState {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const verifierRequired = input.verifierRequired ?? true;

  return {
    schemaVersion: AEOS_TASK_STATE_SCHEMA_VERSION,
    taskId: input.taskId,
    sourceTask: {
      kind: input.sourceTaskPath === undefined ? "unknown" : "file",
      path: input.sourceTaskPath,
      id: input.sourceTaskId,
    },
    lifecycleState: "new",
    workItems: [],
    batches: [],
    pendingWorkItemIds: [],
    retryableWorkItemIds: [],
    plan: {
      status: "not_planned",
    },
    verifier: {
      required: verifierRequired,
      status: verifierRequired ? "pending" : "not_required",
      completionGatedByVerifier: true,
    },
    completionGate: {
      status: verifierRequired ? "verification_required" : "not_satisfied",
      satisfied: false,
      completed: false,
      verified: false,
      authority: "system",
      evidenceReferences: [],
    },
    issues: [],
    revision: 1,
    safety: createSafetyMetadata(),
    createdAt,
    updatedAt: createdAt,
  };
}

export function isSafeTaskStateTransition(
  from: PersistedTaskLifecycleState,
  to: PersistedTaskLifecycleState,
): boolean {
  return allowedTransitions[from]?.includes(to) ?? false;
}

export function transitionPersistedTaskState(
  state: PersistedTaskState,
  lifecycleState: PersistedTaskLifecycleState,
  updatedAt = new Date().toISOString(),
): Result<PersistedTaskState, TaskStatePersistenceError> {
  const stateResult = validatePersistedTaskState(state);

  if (!stateResult.ok) {
    return stateResult;
  }

  if (!allowedLifecycleStates.has(lifecycleState)) {
    return err(
      createError(
        "task_state_invalid_lifecycle_state",
        "Persisted task state transition target is invalid.",
        "validation",
      ),
    );
  }

  if (!isSafeTaskStateTransition(state.lifecycleState, lifecycleState)) {
    return err(
      createError(
        "task_state_invalid_transition",
        "Persisted task state transition is not allowed.",
        "validation",
        {
          from: state.lifecycleState,
          to: lifecycleState,
        },
      ),
    );
  }

  return ok({
    ...state,
    lifecycleState,
    updatedAt,
  });
}

function validateLifecycleState(
  value: unknown,
): Result<PersistedTaskLifecycleState, TaskStatePersistenceError> {
  if (typeof value !== "string") {
    return err(
      createError(
        "task_state_lifecycle_state_required",
        "Persisted task lifecycle state is required.",
        "validation",
      ),
    );
  }

  if (forbiddenLifecycleStates.has(value)) {
    return err(
      createError(
        "task_state_forbidden_lifecycle_state",
        "Persisted task state cannot authorize completed, verified, approved, or execution-success states in the MVP.",
        "validation",
        { lifecycleState: value },
      ),
    );
  }

  if (!allowedLifecycleStates.has(value)) {
    return err(
      createError(
        "task_state_invalid_lifecycle_state",
        "Persisted task lifecycle state is unknown.",
        "validation",
        { lifecycleState: value },
      ),
    );
  }

  return ok(value as PersistedTaskLifecycleState);
}

function validateWorkItems(
  value: unknown,
): Result<readonly AgenticWorkItem[], TaskStatePersistenceError> {
  if (!Array.isArray(value)) {
    return err(
      createError(
        "task_state_work_items_required",
        "Persisted task state work items must be an array.",
        "validation",
      ),
    );
  }

  const ids = new Set<string>();

  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== "string" || item.id.length === 0) {
      return err(
        createError(
          "task_state_invalid_work_item",
          "Persisted task state work item ids must be non-empty strings.",
          "validation",
        ),
      );
    }

    if (ids.has(item.id)) {
      return err(
        createError(
          "task_state_duplicate_work_item",
          "Persisted task state work item ids must be unique.",
          "validation",
          { workItemId: item.id },
        ),
      );
    }

    ids.add(item.id);

    if (item.state === "completed" || item.state === "verified") {
      return err(
        createError(
          "task_state_forbidden_work_item_state",
          "Persisted task state MVP cannot authorize completed or verified work item states.",
          "validation",
          { workItemId: item.id, state: item.state },
        ),
      );
    }
  }

  return ok(value as readonly AgenticWorkItem[]);
}

function validateBatches(
  value: unknown,
): Result<readonly AgenticWorkBatch[], TaskStatePersistenceError> {
  if (!Array.isArray(value)) {
    return err(
      createError(
        "task_state_batches_required",
        "Persisted task state batches must be an array.",
        "validation",
      ),
    );
  }

  const ids = new Set<string>();

  for (const batch of value) {
    if (
      !isRecord(batch) ||
      typeof batch.id !== "string" ||
      batch.id.length === 0 ||
      !isStringArray(batch.workItemIds)
    ) {
      return err(
        createError(
          "task_state_invalid_batch",
          "Persisted task state batches must have stable ids and work item ids.",
          "validation",
        ),
      );
    }

    if (ids.has(batch.id)) {
      return err(
        createError(
          "task_state_duplicate_batch",
          "Persisted task state batch ids must be unique.",
          "validation",
          { batchId: batch.id },
        ),
      );
    }

    ids.add(batch.id);

    if (
      typeof batch.expectedItemCount !== "number" ||
      batch.expectedItemCount !== batch.workItemIds.length
    ) {
      return err(
        createError(
          "task_state_batch_count_mismatch",
          "Persisted task state batch expected item count must match work item ids.",
          "validation",
          { batchId: batch.id },
        ),
      );
    }

    if (
      !isNonNegativeInteger(batch.completedCount) ||
      !isNonNegativeInteger(batch.failedCount) ||
      !isNonNegativeInteger(batch.skippedCount) ||
      !isNonNegativeInteger(batch.retryableCount)
    ) {
      return err(
        createError(
          "task_state_invalid_batch_accounting",
          "Persisted task state batch accounting counts must be non-negative integers.",
          "validation",
          { batchId: batch.id },
        ),
      );
    }

    if (batch.completedCount !== 0) {
      return err(
        createError(
          "task_state_forbidden_batch_completion",
          "Persisted task state MVP cannot authorize completed batch item counts.",
          "validation",
          { batchId: batch.id },
        ),
      );
    }
  }

  return ok(value as readonly AgenticWorkBatch[]);
}

function validateUniqueReferenceIds(
  ids: readonly string[],
  code: string,
  message: string,
): Result<void, TaskStatePersistenceError> {
  const seenIds = new Set<string>();

  for (const id of ids) {
    if (seenIds.has(id)) {
      return err(
        createError(code, message, "validation", { workItemId: id }),
      );
    }

    seenIds.add(id);
  }

  return ok(undefined);
}

function countBatchItemsByState(
  workItems: readonly AgenticWorkItem[],
  batch: AgenticWorkBatch,
  state: AgenticWorkItem["state"],
): number {
  const workItemsById = new Map(workItems.map((item) => [item.id, item]));

  return batch.workItemIds.filter(
    (workItemId) => workItemsById.get(workItemId)?.state === state,
  ).length;
}

function validateRepresentedStateReferences(
  state: Record<string, unknown>,
  workItems: readonly AgenticWorkItem[],
  batches: readonly AgenticWorkBatch[],
): Result<void, TaskStatePersistenceError> {
  const workItemsById = new Map(workItems.map((item) => [item.id, item]));
  const batchesById = new Map(batches.map((batch) => [batch.id, batch]));
  const pendingIds = state.pendingWorkItemIds as readonly string[];
  const retryableIds = state.retryableWorkItemIds as readonly string[];

  const pendingUniqueResult = validateUniqueReferenceIds(
    pendingIds,
    "task_state_duplicate_pending_work_item",
    "Persisted task state pending work item ids must be unique.",
  );

  if (!pendingUniqueResult.ok) {
    return pendingUniqueResult;
  }

  const retryableUniqueResult = validateUniqueReferenceIds(
    retryableIds,
    "task_state_duplicate_retryable_work_item",
    "Persisted task state retryable work item ids must be unique.",
  );

  if (!retryableUniqueResult.ok) {
    return retryableUniqueResult;
  }

  const pendingIdSet = new Set(pendingIds);

  for (const retryableId of retryableIds) {
    if (pendingIdSet.has(retryableId)) {
      return err(
        createError(
          "task_state_resume_id_conflict",
          "Persisted task state work item ids cannot be both pending and retryable.",
          "validation",
          { workItemId: retryableId },
        ),
      );
    }
  }

  for (const workItemId of pendingIds) {
    const workItem = workItemsById.get(workItemId);

    if (workItem === undefined) {
      return err(
        createError(
          "task_state_resume_id_unknown",
          "Persisted task state resume ids must reference represented work items.",
          "validation",
          { workItemId },
        ),
      );
    }

    if (workItem.state !== "pending") {
      return err(
        createError(
          "task_state_pending_id_state_mismatch",
          "Persisted task state pending ids must reference pending work items.",
          "validation",
          { workItemId, state: workItem.state },
        ),
      );
    }
  }

  for (const workItemId of retryableIds) {
    const workItem = workItemsById.get(workItemId);

    if (workItem === undefined) {
      return err(
        createError(
          "task_state_resume_id_unknown",
          "Persisted task state resume ids must reference represented work items.",
          "validation",
          { workItemId },
        ),
      );
    }

    if (workItem.state !== "retryable") {
      return err(
        createError(
          "task_state_retryable_id_state_mismatch",
          "Persisted task state retryable ids must reference retryable work items.",
          "validation",
          { workItemId, state: workItem.state },
        ),
      );
    }
  }

  for (const batch of batches) {
    const batchWorkItemIds = new Set<string>();

    for (const workItemId of batch.workItemIds) {
      if (batchWorkItemIds.has(workItemId)) {
        return err(
          createError(
            "task_state_duplicate_batch_work_item",
            "Persisted task state batch work item ids must be unique within the batch.",
            "validation",
            { batchId: batch.id, workItemId },
          ),
        );
      }

      batchWorkItemIds.add(workItemId);

      if (!workItemsById.has(workItemId)) {
        return err(
          createError(
            "task_state_batch_work_item_unknown",
            "Persisted task state batches must reference represented work items.",
            "validation",
            { batchId: batch.id, workItemId },
          ),
        );
      }
    }

    if (
      batch.failedCount !== countBatchItemsByState(workItems, batch, "failed") ||
      batch.skippedCount !== countBatchItemsByState(workItems, batch, "skipped") ||
      batch.retryableCount !== countBatchItemsByState(workItems, batch, "retryable")
    ) {
      return err(
        createError(
          "task_state_batch_accounting_mismatch",
          "Persisted task state batch accounting must match represented work item states.",
          "validation",
          { batchId: batch.id },
        ),
      );
    }
  }

  for (const workItem of workItems) {
    if (workItem.batchId !== undefined) {
      const batch = batchesById.get(workItem.batchId);

      if (batch === undefined || !batch.workItemIds.includes(workItem.id)) {
        return err(
          createError(
            "task_state_work_item_batch_mismatch",
            "Persisted task state work item batch references must match represented batches.",
            "validation",
            { workItemId: workItem.id, batchId: workItem.batchId },
          ),
        );
      }
    }
  }

  for (const batchField of ["currentBatchId", "nextBatchId"] as const) {
    const batchId = state[batchField];

    if (batchId === undefined) {
      continue;
    }

    if (typeof batchId !== "string" || !batchesById.has(batchId)) {
      return err(
        createError(
          "task_state_batch_reference_unknown",
          "Persisted task state current and next batch ids must reference represented batches.",
          "validation",
          { batchId: typeof batchId === "string" ? batchId : null },
        ),
      );
    }
  }

  if (typeof state.nextBatchId === "string") {
    const nextBatch = batchesById.get(state.nextBatchId);
    const eligibleIds = new Set([...pendingIds, ...retryableIds]);

    if (
      nextBatch !== undefined &&
      !nextBatch.workItemIds.some((workItemId) => eligibleIds.has(workItemId))
    ) {
      return err(
        createError(
          "task_state_next_batch_not_resumable",
          "Persisted task state next batch must contain pending or retryable work.",
          "validation",
          { batchId: state.nextBatchId },
        ),
      );
    }
  }

  return ok(undefined);
}

function validateCompletionFields(
  state: Record<string, unknown>,
): Result<void, TaskStatePersistenceError> {
  const completionGate = state.completionGate;
  const safety = state.safety;
  const verifier = state.verifier;

  if (!isRecord(completionGate)) {
    return err(
      createError(
        "task_state_completion_gate_required",
        "Persisted task state completion gate is required.",
        "validation",
      ),
    );
  }

  if (
    completionGate.satisfied !== false ||
    completionGate.completed !== false ||
    completionGate.verified !== false ||
    completionGate.authority !== "system"
  ) {
    return err(
      createError(
        "task_state_forbidden_completion_gate",
        "Persisted task state MVP cannot persist satisfied, completed, or verified completion gates.",
        "validation",
      ),
    );
  }

  if (!isRecord(safety) || !isRecord(verifier)) {
    return err(
      createError(
        "task_state_safety_metadata_required",
        "Persisted task state safety and verifier metadata are required.",
        "validation",
      ),
    );
  }

  if (
    typeof completionGate.status !== "string" ||
    !allowedCompletionGateStatuses.has(completionGate.status)
  ) {
    return err(
      createError(
        "task_state_invalid_completion_gate_status",
        "Persisted task state completion gate status is invalid.",
        "validation",
      ),
    );
  }

  if (
    safety.completionAuthority !== "system" ||
    safety.modelSelfReportTrusted !== false ||
    safety.executionPerformed !== false ||
    safety.verifierRun !== false ||
    safety.approved !== false ||
    safety.completed !== false ||
    safety.verified !== false ||
    safety.persistedSuccessClaimAllowed !== false
  ) {
    return err(
      createError(
        "task_state_forbidden_safety_metadata",
        "Persisted task state safety metadata cannot trust self-reporting or claim execution, approval, completion, or verification.",
        "validation",
      ),
    );
  }

  if (
    typeof verifier.required !== "boolean" ||
    typeof verifier.status !== "string" ||
    !allowedVerifierStatuses.has(verifier.status) ||
    verifier.completionGatedByVerifier !== true ||
    verifier.status === "verified"
  ) {
    return err(
      createError(
        "task_state_forbidden_verifier_state",
        "Persisted task state MVP cannot persist verified verifier status and must remain completion-gated.",
        "validation",
      ),
    );
  }

  return ok(undefined);
}

function validateRequiredStateSections(
  value: Record<string, unknown>,
): Result<void, TaskStatePersistenceError> {
  if (!isRecord(value.sourceTask)) {
    return err(
      createError(
        "task_state_source_reference_required",
        "Persisted task state source task reference is required.",
        "validation",
      ),
    );
  }

  if (!isRecord(value.plan) || typeof value.plan.status !== "string") {
    return err(
      createError(
        "task_state_plan_reference_required",
        "Persisted task state plan reference is required.",
        "validation",
      ),
    );
  }

  if (!allowedPlanStatuses.has(value.plan.status)) {
    return err(
      createError(
        "task_state_invalid_plan_status",
        "Persisted task state plan status is invalid.",
        "validation",
      ),
    );
  }

  if (!Array.isArray(value.issues)) {
    return err(
      createError(
        "task_state_issues_required",
        "Persisted task state issues must be an array.",
        "validation",
      ),
    );
  }

  if (
    typeof value.createdAt !== "string" ||
    value.createdAt.length === 0 ||
    typeof value.updatedAt !== "string" ||
    value.updatedAt.length === 0
  ) {
    return err(
      createError(
        "task_state_timestamps_required",
        "Persisted task state createdAt and updatedAt timestamps are required.",
        "validation",
      ),
    );
  }

  return ok(undefined);
}

export function validatePersistedTaskState(
  value: unknown,
): Result<PersistedTaskState, TaskStatePersistenceError> {
  if (!isRecord(value)) {
    return err(
      createError(
        "task_state_invalid_shape",
        "Persisted task state must be a JSON object.",
        "validation",
      ),
    );
  }

  if (value.schemaVersion !== AEOS_TASK_STATE_SCHEMA_VERSION) {
    return err(
      createError(
        "task_state_schema_version_unsupported",
        "Persisted task state schema version is unsupported.",
        "validation",
      ),
    );
  }

  const taskIdResult = validateTaskId(value.taskId as AgenticTaskId);

  if (!taskIdResult.ok) {
    return taskIdResult;
  }

  const lifecycleStateResult = validateLifecycleState(value.lifecycleState);

  if (!lifecycleStateResult.ok) {
    return lifecycleStateResult;
  }

  const sectionResult = validateRequiredStateSections(value);

  if (!sectionResult.ok) {
    return sectionResult;
  }

  if (
    typeof value.revision !== "number" ||
    !Number.isInteger(value.revision) ||
    value.revision < 1
  ) {
    return err(
      createError(
        "task_state_invalid_revision",
        "Persisted task state revision must be a positive integer.",
        "validation",
      ),
    );
  }

  const workItemsResult = validateWorkItems(value.workItems);

  if (!workItemsResult.ok) {
    return workItemsResult;
  }

  const batchesResult = validateBatches(value.batches);

  if (!batchesResult.ok) {
    return batchesResult;
  }

  if (
    !isStringArray(value.pendingWorkItemIds) ||
    !isStringArray(value.retryableWorkItemIds)
  ) {
    return err(
      createError(
        "task_state_resume_ids_invalid",
        "Persisted task state pending and retryable ids must be string arrays.",
        "validation",
      ),
    );
  }

  const representedReferencesResult = validateRepresentedStateReferences(
    value,
    workItemsResult.value,
    batchesResult.value,
  );

  if (!representedReferencesResult.ok) {
    return representedReferencesResult;
  }

  const completionResult = validateCompletionFields(value);

  if (!completionResult.ok) {
    return completionResult;
  }

  return ok(value as unknown as PersistedTaskState);
}

async function existingPathIsMissing(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return false;
  } catch (error) {
    if (
      isRecord(error) &&
      typeof error.code === "string" &&
      error.code === "ENOENT"
    ) {
      return true;
    }

    throw error;
  }
}

async function ensureStateRoot(
  projectRoot: string,
  create: boolean,
): Promise<Result<string, TaskStatePersistenceError>> {
  let projectRootRealPath: string;

  try {
    projectRootRealPath = await realpath(resolve(projectRoot));
  } catch {
    return err(
      createError(
        "task_state_project_root_missing",
        "Task state project root was not found.",
        "not_found",
      ),
    );
  }

  const stateRoot = join(projectRootRealPath, AEOS_TASK_STATE_ROOT_RELATIVE_PATH);
  const segments = AEOS_TASK_STATE_ROOT_RELATIVE_PATH.split("/");
  let currentPath = projectRootRealPath;

  for (const segment of segments) {
    currentPath = join(currentPath, segment);

    try {
      const stats = await lstat(currentPath);

      if (stats.isSymbolicLink() || !stats.isDirectory()) {
        return err(
          createError(
            "task_state_unsafe_state_root",
            "AEOS task state root contains an unsafe symlink or non-directory path.",
            "permission",
          ),
        );
      }

      const currentRealPath = await realpath(currentPath);

      if (!isInsideOrEqual(projectRootRealPath, currentRealPath)) {
        return err(
          createError(
            "task_state_state_root_escape",
            "AEOS task state root resolves outside the project root.",
            "permission",
          ),
        );
      }
    } catch (error) {
      if (
        isRecord(error) &&
        typeof error.code === "string" &&
        error.code === "ENOENT"
      ) {
        if (!create) {
          return err(
            createError(
              "task_state_not_found",
              "Persisted task state was not found.",
              "not_found",
            ),
          );
        }

        break;
      }

      throw error;
    }
  }

  if (create) {
    await mkdir(stateRoot, { recursive: true });
  }

  const rootStats = await lstat(stateRoot);

  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
    return err(
      createError(
        "task_state_unsafe_state_root",
        "AEOS task state root is not a safe directory.",
        "permission",
      ),
    );
  }

  const stateRootRealPath = await realpath(stateRoot);

  if (!isInsideOrEqual(projectRootRealPath, stateRootRealPath)) {
    return err(
      createError(
        "task_state_state_root_escape",
        "AEOS task state root resolves outside the project root.",
        "permission",
      ),
    );
  }

  return ok(stateRootRealPath);
}

async function readJsonState(
  path: string,
): Promise<Result<unknown, TaskStatePersistenceError>> {
  let content: string;

  try {
    content = await readFile(path, "utf8");
  } catch (error) {
    if (
      isRecord(error) &&
      typeof error.code === "string" &&
      error.code === "ENOENT"
    ) {
      return err(
        createError(
          "task_state_not_found",
          "Persisted task state was not found.",
          "not_found",
        ),
      );
    }

    throw error;
  }

  try {
    return ok(JSON.parse(content) as unknown);
  } catch {
    return err(
      createError(
        "task_state_corrupt_json",
        "Persisted task state JSON is corrupt and cannot be trusted.",
        "validation",
      ),
    );
  }
}

export async function loadTaskState(
  input: LoadTaskStateInput,
): Promise<Result<TaskStatePersistenceResult, TaskStatePersistenceError>> {
  const pathResult = getTaskStateStoragePath(input);

  if (!pathResult.ok) {
    return pathResult;
  }

  const rootResult = await ensureStateRoot(input.projectRoot, false);

  if (!rootResult.ok) {
    return rootResult;
  }

  const targetPath = join(rootResult.value, `${input.taskId}.json`);
  const existingStateResult = await readExistingState(targetPath);

  if (!existingStateResult.ok) {
    return existingStateResult;
  }

  if (existingStateResult.value === undefined) {
    return err(
      createError(
        "task_state_not_found",
        "Persisted task state was not found.",
        "not_found",
      ),
    );
  }

  if (existingStateResult.value.taskId !== input.taskId) {
    return err(
      createError(
        "task_state_task_id_mismatch",
        "Persisted task state task id did not match the requested task id.",
        "validation",
      ),
    );
  }

  return ok({
    state: existingStateResult.value,
    path: targetPath,
  });
}

async function readExistingState(
  path: string,
): Promise<Result<PersistedTaskState | undefined, TaskStatePersistenceError>> {
  if (await existingPathIsMissing(path)) {
    return ok(undefined);
  }

  const stats = await lstat(path);

  if (stats.isSymbolicLink() || !stats.isFile()) {
    return err(
      createError(
        "task_state_unsafe_target",
        "Persisted task state target is not a safe file path.",
        "permission",
      ),
    );
  }

  const jsonResult = await readJsonState(path);

  if (!jsonResult.ok) {
    return jsonResult;
  }

  const stateResult = validatePersistedTaskState(jsonResult.value);

  if (!stateResult.ok) {
    return stateResult;
  }

  return ok(stateResult.value);
}

export async function saveTaskState(
  input: SaveTaskStateInput,
): Promise<Result<TaskStatePersistenceResult, TaskStatePersistenceError>> {
  const stateResult = validatePersistedTaskState(input.state);

  if (!stateResult.ok) {
    return stateResult;
  }

  const pathResult = getTaskStateStoragePath({
    projectRoot: input.projectRoot,
    taskId: stateResult.value.taskId,
  });

  if (!pathResult.ok) {
    return pathResult;
  }

  const rootResult = await ensureStateRoot(input.projectRoot, true);

  if (!rootResult.ok) {
    return rootResult;
  }

  const targetPath = join(rootResult.value, `${stateResult.value.taskId}.json`);
  const existingStateResult = await readExistingState(targetPath);

  if (!existingStateResult.ok) {
    return existingStateResult;
  }

  const existingState = existingStateResult.value;
  const existingRevision = existingState?.revision;

  if (existingRevision !== undefined) {
    if (existingState?.taskId !== stateResult.value.taskId) {
      return err(
        createError(
          "task_state_task_id_mismatch",
          "Existing persisted task state task id did not match the replacement task id.",
          "validation",
        ),
      );
    }

    if (input.expectedRevision === undefined) {
      return err(
        createError(
          "task_state_revision_required",
          "Existing persisted task state requires an expected revision.",
          "conflict",
        ),
      );
    }

    if (existingRevision !== input.expectedRevision) {
      return err(
        createError(
          "task_state_revision_conflict",
          "Persisted task state revision did not match the expected revision.",
          "conflict",
          {
            expectedRevision: input.expectedRevision,
            actualRevision: existingRevision,
          },
        ),
      );
    }

    if (stateResult.value.revision !== input.expectedRevision + 1) {
      return err(
        createError(
          "task_state_next_revision_invalid",
          "Persisted task state replacement must increment the expected revision.",
          "conflict",
          {
            expectedRevision: input.expectedRevision,
            nextRevision: stateResult.value.revision,
          },
        ),
      );
    }
  } else if (stateResult.value.revision !== 1) {
    return err(
      createError(
        "task_state_initial_revision_invalid",
        "Initial persisted task state revision must be 1.",
        "validation",
        { revision: stateResult.value.revision },
      ),
    );
  }

  const tempPath = `${targetPath}.tmp-${Date.now()}-${randomUUID()}`;
  const content = `${JSON.stringify(stateResult.value, null, 2)}\n`;
  let fileHandle: Awaited<ReturnType<typeof open>> | undefined;

  try {
    fileHandle = await open(tempPath, "wx");
    await fileHandle.writeFile(content, "utf8");
    await fileHandle.sync();
    await fileHandle.close();
    fileHandle = undefined;
    await rename(tempPath, targetPath);
  } catch (error) {
    if (fileHandle !== undefined) {
      await fileHandle.close();
    }

    await unlink(tempPath).catch(() => undefined);
    throw error;
  }

  return ok({
    state: stateResult.value,
    path: targetPath,
  });
}

export async function updateTaskState(
  input: UpdateTaskStateInput,
): Promise<Result<TaskStatePersistenceResult, TaskStatePersistenceError>> {
  const currentResult = await loadTaskState(input);

  if (!currentResult.ok) {
    return currentResult;
  }

  const currentState = currentResult.value.state;

  if (currentState.revision !== input.expectedRevision) {
    return err(
      createError(
        "task_state_revision_conflict",
        "Persisted task state revision did not match the expected revision.",
        "conflict",
        {
          expectedRevision: input.expectedRevision,
          actualRevision: currentState.revision,
        },
      ),
    );
  }

  const updatedAt = input.updatedAt ?? new Date().toISOString();
  const updatedState = {
    ...input.update(currentState),
    taskId: currentState.taskId,
    revision: currentState.revision + 1,
    updatedAt,
  };

  return saveTaskState({
    projectRoot: input.projectRoot,
    state: updatedState,
    expectedRevision: currentState.revision,
  });
}
