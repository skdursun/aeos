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
  AgenticExecutionAttemptId,
  AgenticTaskId,
  AgenticWorkBatchId,
  AgenticWorkItem,
  AgenticWorkItemId,
} from "./agentic-lifecycle.js";
import type { PersistedTaskState } from "./task-state-persistence.js";
import {
  loadTaskState,
  validatePersistedTaskState,
} from "./task-state-persistence.js";
import type {
  TaskExecutionAttempt,
  TaskExecutionAttemptError,
  TaskExecutionFailureCategory,
} from "./task-execution-attempt.js";
import { validateTaskExecutionAttempt } from "./task-execution-attempt.js";
import { loadTaskExecutionAttempt } from "./task-execution-attempt-persistence.js";
import type {
  CreateReservedTaskExecutionInvocationRecordInput,
  TaskExecutionInvocationIdentity,
  TaskExecutionInvocationLifecycle,
  TaskExecutionInvocationOutcomeCertainty,
  TaskExecutionInvocationRecord,
  TaskExecutionInvocationRecordError,
  TaskExecutionInvocationRecordTransitionIntent,
} from "./task-execution-invocation-record.js";
import {
  createReservedTaskExecutionInvocationRecord,
  deriveTaskExecutionInvocationIdentity,
  transitionTaskExecutionInvocationRecord,
  validateTaskExecutionInvocationRecord,
} from "./task-execution-invocation-record.js";
import type { TaskExecutionInvocationDependencyKind } from "./task-execution-invocation.js";
import type { AeosError, Result } from "./types.js";

export const AEOS_TASK_EXECUTION_INVOCATION_ROOT_RELATIVE_PATH =
  ".aeos/state/invocations";

export interface TaskExecutionInvocationStorageInput {
  readonly projectRoot: string;
  readonly taskId: AgenticTaskId;
  readonly invocationId: string;
}

export interface TaskExecutionInvocationStoragePath {
  readonly stateRoot: string;
  readonly taskInvocationRoot: string;
  readonly path: string;
}

export interface ReserveTaskExecutionInvocationInput {
  readonly projectRoot: string;
  readonly state: unknown;
  readonly attempt: unknown;
  readonly dependencyKind: TaskExecutionInvocationDependencyKind;
  readonly expectedRevision?: number;
  readonly latestAttemptNumberForContext?: number;
  readonly allowedOperationReferences?: readonly string[];
  readonly claimedAt?: string;
  readonly ownerId?: string;
  readonly ownershipToken?: string;
}

export type ReserveTaskExecutionInvocationStatus =
  | "reserved"
  | "already_reserved";

export interface ReserveTaskExecutionInvocationResult {
  readonly status: ReserveTaskExecutionInvocationStatus;
  readonly record: TaskExecutionInvocationRecord;
  readonly path: string;
}

export interface LoadTaskExecutionInvocationInput
  extends TaskExecutionInvocationStorageInput {}

export interface UpdateTaskExecutionInvocationInput
  extends TaskExecutionInvocationStorageInput {
  readonly ownershipToken: string;
  readonly expectedLifecycle: TaskExecutionInvocationLifecycle;
  readonly intent: TaskExecutionInvocationRecordTransitionIntent;
}

export interface TaskExecutionInvocationPersistenceResult {
  readonly record: TaskExecutionInvocationRecord;
  readonly path: string;
}

export interface LoadTaskExecutionInvocationStatusInput
  extends TaskExecutionInvocationStorageInput {}

export interface TaskExecutionInvocationStatusIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: "error";
  readonly category: AeosError["category"];
}

export interface TaskExecutionInvocationStatusResultDiagnostic {
  readonly invocationOk: boolean;
  readonly outputReference: string | null;
  readonly diagnosticCode: string | null;
  readonly message: string | null;
  readonly returnedAt: string;
  readonly executorClaims: {
    readonly completed: boolean;
    readonly verified: boolean;
    readonly approved: boolean;
    readonly allDone: boolean;
    readonly executionSucceeded: boolean;
  };
}

export interface TaskExecutionInvocationStatusFailureDiagnostic {
  readonly code: string;
  readonly category: TaskExecutionFailureCategory;
  readonly diagnostic: string | null;
  readonly retryable: boolean;
  readonly failedAt: string;
}

export interface TaskExecutionInvocationReadOnlyStatus {
  readonly status: "invocation_status_loaded";
  readonly taskId: AgenticTaskId;
  readonly invocationId: string;
  readonly invocation: {
    readonly lifecycle: TaskExecutionInvocationLifecycle;
    readonly dependencyKind: TaskExecutionInvocationDependencyKind;
    readonly attemptId: AgenticExecutionAttemptId;
    readonly attemptNumber: number;
    readonly attemptLifecycle: TaskExecutionAttempt["lifecycle"] | null;
    readonly attemptLoaded: boolean;
    readonly attemptContextValid: boolean;
    readonly taskStateRevision: number;
    readonly currentTaskRevision: number | null;
    readonly taskContextLoaded: boolean;
    readonly taskContextValid: boolean;
    readonly staleAgainstCurrentTask: boolean | null;
    readonly currentlyExecutionAuthoritative: boolean;
    readonly workItemId: AgenticWorkItemId | null;
    readonly batchId: AgenticWorkBatchId | null;
    readonly idempotencyReference: string;
    readonly requestFingerprint: string;
    readonly allowedOperationReferences: readonly string[];
    readonly verifierRequired: boolean;
    readonly completionGatedByVerifier: boolean;
    readonly outcomeCertainty: TaskExecutionInvocationOutcomeCertainty;
    readonly outcomeKnown: boolean;
    readonly reconciliationRequired: boolean;
    readonly safeToBlindRetry: false;
    readonly retryable: boolean;
    readonly result: TaskExecutionInvocationStatusResultDiagnostic | null;
    readonly failure: TaskExecutionInvocationStatusFailureDiagnostic | null;
    readonly recordRevision: number;
    readonly recordSchemaVersion: number;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly enteredAt: string | null;
    readonly outcomeUnknownAt: string | null;
  };
  readonly safety: {
    readonly readOnly: true;
    readonly dependencyInvokedByStatus: false;
    readonly stateModified: false;
    readonly attemptModified: false;
    readonly taskModified: false;
    readonly workCompleted: false;
    readonly taskCompleted: false;
    readonly verifierRun: false;
    readonly auditWritten: false;
    readonly policyRun: false;
    readonly safeToBlindRetry: false;
    readonly ownershipSecretRendered: false;
    readonly statusUsableAsOwnershipCredential: false;
  };
  readonly issues: readonly TaskExecutionInvocationStatusIssue[];
}

export type TaskExecutionInvocationPersistenceError =
  | TaskExecutionInvocationRecordError
  | TaskExecutionAttemptError
  | AeosError;

const safeIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/;

function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

function err(
  error: TaskExecutionInvocationPersistenceError,
): Result<never, TaskExecutionInvocationPersistenceError> {
  return { ok: false, error };
}

function createError(
  code: string,
  message: string,
  category: AeosError["category"],
  details?: Record<string, string | number | boolean | null>,
): TaskExecutionInvocationPersistenceError {
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

function statusIssueFromError(
  error: AeosError,
): TaskExecutionInvocationStatusIssue {
  return {
    code: error.code,
    message: error.message,
    severity: "error",
    category: error.category,
  };
}

function statusIssue(input: {
  readonly code: string;
  readonly message: string;
  readonly category: AeosError["category"];
}): TaskExecutionInvocationStatusIssue {
  return {
    code: input.code,
    message: input.message,
    severity: "error",
    category: input.category,
  };
}

function statusCategoryFromLifecycleIssueCategory(
  category: string,
): AeosError["category"] {
  if (category === "policy_failure") {
    return "policy";
  }

  if (category === "resume_failure") {
    return "conflict";
  }

  return "unknown";
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

function isInsideOrEqual(parentPath: string, childPath: string): boolean {
  const relativePath = relative(parentPath, childPath);

  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !isAbsolute(relativePath))
  );
}

function jsonContent(value: TaskExecutionInvocationRecord): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function validateSafeId(input: {
  readonly value: string;
  readonly field: "taskId" | "invocationId";
}): Result<string, TaskExecutionInvocationPersistenceError> {
  if (typeof input.value !== "string" || input.value.trim().length === 0) {
    return err(
      createError(
        `task_execution_invocation_${input.field}_required`,
        "Task execution invocation storage id is required.",
        "validation",
      ),
    );
  }

  if (
    input.value !== input.value.trim() ||
    input.value === "." ||
    input.value === ".." ||
    isAbsolute(input.value) ||
    input.value.includes("/") ||
    input.value.includes("\\") ||
    !safeIdPattern.test(input.value)
  ) {
    return err(
      createError(
        `task_execution_invocation_unsafe_${input.field}`,
        "Task execution invocation storage id is not safe for persisted storage.",
        "validation",
        { [input.field]: input.value },
      ),
    );
  }

  return ok(input.value);
}

export function getTaskExecutionInvocationStoragePath(
  input: TaskExecutionInvocationStorageInput,
): Result<
  TaskExecutionInvocationStoragePath,
  TaskExecutionInvocationPersistenceError
> {
  const taskIdResult = validateSafeId({
    value: input.taskId,
    field: "taskId",
  });

  if (!taskIdResult.ok) {
    return taskIdResult;
  }

  const invocationIdResult = validateSafeId({
    value: input.invocationId,
    field: "invocationId",
  });

  if (!invocationIdResult.ok) {
    return invocationIdResult;
  }

  const projectRoot = resolve(input.projectRoot);
  const stateRoot = resolve(
    projectRoot,
    AEOS_TASK_EXECUTION_INVOCATION_ROOT_RELATIVE_PATH,
  );
  const taskInvocationRoot = resolve(stateRoot, taskIdResult.value);
  const path = resolve(taskInvocationRoot, `${invocationIdResult.value}.json`);

  if (
    !isInsideOrEqual(projectRoot, stateRoot) ||
    !isInsideOrEqual(stateRoot, taskInvocationRoot) ||
    !isInsideOrEqual(taskInvocationRoot, path)
  ) {
    return err(
      createError(
        "task_execution_invocation_path_outside_root",
        "Task execution invocation storage path escaped the AEOS invocation state root.",
        "permission",
      ),
    );
  }

  return ok({ stateRoot, taskInvocationRoot, path });
}

async function ensureInvocationRoot(input: {
  readonly projectRoot: string;
  readonly taskId: AgenticTaskId;
  readonly create: boolean;
}): Promise<Result<string, TaskExecutionInvocationPersistenceError>> {
  let projectRootRealPath: string;

  try {
    projectRootRealPath = await realpath(resolve(input.projectRoot));
  } catch {
    return err(
      createError(
        "task_execution_invocation_project_root_missing",
        "Task execution invocation project root was not found.",
        "not_found",
      ),
    );
  }

  const stateRoot = join(
    projectRootRealPath,
    AEOS_TASK_EXECUTION_INVOCATION_ROOT_RELATIVE_PATH,
  );
  const segments = [
    ...AEOS_TASK_EXECUTION_INVOCATION_ROOT_RELATIVE_PATH.split("/"),
    input.taskId,
  ];
  let currentPath = projectRootRealPath;

  for (const segment of segments) {
    currentPath = join(currentPath, segment);

    try {
      const stats = await lstat(currentPath);

      if (stats.isSymbolicLink() || !stats.isDirectory()) {
        return err(
          createError(
            "task_execution_invocation_unsafe_state_root",
            "AEOS task execution invocation root contains an unsafe symlink or non-directory path.",
            "permission",
          ),
        );
      }

      const currentRealPath = await realpath(currentPath);

      if (!isInsideOrEqual(projectRootRealPath, currentRealPath)) {
        return err(
          createError(
            "task_execution_invocation_state_root_escape",
            "AEOS task execution invocation root resolves outside the project root.",
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
        if (!input.create) {
          return err(
            createError(
              "task_execution_invocation_not_found",
              "Persisted task execution invocation was not found.",
              "not_found",
            ),
          );
        }

        break;
      }

      throw error;
    }
  }

  const taskInvocationRoot = join(stateRoot, input.taskId);

  if (input.create) {
    await mkdir(taskInvocationRoot, { recursive: true });
  }

  const rootStats = await lstat(taskInvocationRoot);

  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
    return err(
      createError(
        "task_execution_invocation_unsafe_state_root",
        "AEOS task execution invocation root is not a safe directory.",
        "permission",
      ),
    );
  }

  const taskInvocationRootRealPath = await realpath(taskInvocationRoot);

  if (!isInsideOrEqual(projectRootRealPath, taskInvocationRootRealPath)) {
    return err(
      createError(
        "task_execution_invocation_state_root_escape",
        "AEOS task execution invocation root resolves outside the project root.",
        "permission",
      ),
    );
  }

  return ok(taskInvocationRootRealPath);
}

async function ensureInvocationLockRoot(input: {
  readonly projectRoot: string;
  readonly taskId: AgenticTaskId;
}): Promise<Result<string, TaskExecutionInvocationPersistenceError>> {
  let projectRootRealPath: string;

  try {
    projectRootRealPath = await realpath(resolve(input.projectRoot));
  } catch {
    return err(
      createError(
        "task_execution_invocation_project_root_missing",
        "Task execution invocation project root was not found.",
        "not_found",
      ),
    );
  }

  const lockRoot = join(
    projectRootRealPath,
    AEOS_TASK_EXECUTION_INVOCATION_ROOT_RELATIVE_PATH,
    ".locks",
    input.taskId,
  );
  const segments = [
    ...AEOS_TASK_EXECUTION_INVOCATION_ROOT_RELATIVE_PATH.split("/"),
    ".locks",
    input.taskId,
  ];
  let currentPath = projectRootRealPath;

  for (const segment of segments) {
    currentPath = join(currentPath, segment);

    try {
      const stats = await lstat(currentPath);

      if (stats.isSymbolicLink() || !stats.isDirectory()) {
        return err(
          createError(
            "task_execution_invocation_unsafe_lock_root",
            "AEOS task execution invocation lock root contains an unsafe symlink or non-directory path.",
            "permission",
          ),
        );
      }

      const currentRealPath = await realpath(currentPath);

      if (!isInsideOrEqual(projectRootRealPath, currentRealPath)) {
        return err(
          createError(
            "task_execution_invocation_lock_root_escape",
            "AEOS task execution invocation lock root resolves outside the project root.",
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
        break;
      }

      throw error;
    }
  }

  await mkdir(lockRoot, { recursive: true });

  const lockStats = await lstat(lockRoot);

  if (lockStats.isSymbolicLink() || !lockStats.isDirectory()) {
    return err(
      createError(
        "task_execution_invocation_unsafe_lock_root",
        "AEOS task execution invocation lock root is not a safe directory.",
        "permission",
      ),
    );
  }

  const lockRootRealPath = await realpath(lockRoot);

  if (!isInsideOrEqual(projectRootRealPath, lockRootRealPath)) {
    return err(
      createError(
        "task_execution_invocation_lock_root_escape",
        "AEOS task execution invocation lock root resolves outside the project root.",
        "permission",
      ),
    );
  }

  return ok(lockRootRealPath);
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

async function readJsonInvocation(
  path: string,
): Promise<Result<unknown, TaskExecutionInvocationPersistenceError>> {
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
          "task_execution_invocation_not_found",
          "Persisted task execution invocation was not found.",
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
        "task_execution_invocation_corrupt_json",
        "Persisted task execution invocation JSON is corrupt and cannot be trusted.",
        "validation",
      ),
    );
  }
}

async function readInvocationContent(
  path: string,
): Promise<Result<string, TaskExecutionInvocationPersistenceError>> {
  if (await existingPathIsMissing(path)) {
    return err(
      createError(
        "task_execution_invocation_not_found",
        "Persisted task execution invocation was not found.",
        "not_found",
      ),
    );
  }

  const stats = await lstat(path);

  if (stats.isSymbolicLink() || !stats.isFile()) {
    return err(
      createError(
        "task_execution_invocation_unsafe_target",
        "Persisted task execution invocation target is not a safe file path.",
        "permission",
      ),
    );
  }

  return ok(await readFile(path, "utf8"));
}

async function readExistingInvocation(
  path: string,
): Promise<
  Result<
    TaskExecutionInvocationRecord | undefined,
    TaskExecutionInvocationPersistenceError
  >
> {
  if (await existingPathIsMissing(path)) {
    return ok(undefined);
  }

  const stats = await lstat(path);

  if (stats.isSymbolicLink() || !stats.isFile()) {
    return err(
      createError(
        "task_execution_invocation_unsafe_target",
        "Persisted task execution invocation target is not a safe file path.",
        "permission",
      ),
    );
  }

  const jsonResult = await readJsonInvocation(path);

  if (!jsonResult.ok) {
    return jsonResult;
  }

  return validateTaskExecutionInvocationRecord(jsonResult.value);
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

function validateWorkBatchBinding(input: {
  readonly state: PersistedTaskState;
  readonly attempt: TaskExecutionAttempt;
}): Result<void, TaskExecutionInvocationPersistenceError> {
  const eligibleIds = eligibleWorkItemIdsForState(input.state);

  if (input.attempt.workItemId !== undefined) {
    const workItem = representedWorkItem(input.state, input.attempt.workItemId);

    if (workItem === undefined) {
      return err(
        createError(
          "task_execution_invocation_work_item_missing",
          "Started attempt work item no longer exists in current authoritative task state.",
          "validation",
          {
            taskId: input.state.taskId,
            attemptId: input.attempt.attemptId,
            workItemId: input.attempt.workItemId,
          },
        ),
      );
    }

    if (!eligibleIds.has(input.attempt.workItemId)) {
      return err(
        createError(
          "task_execution_invocation_work_item_not_executable",
          "Started attempt work item is no longer pending or retryable in current authoritative task state.",
          "validation",
          {
            taskId: input.state.taskId,
            attemptId: input.attempt.attemptId,
            workItemId: input.attempt.workItemId,
          },
        ),
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
        return err(
          createError(
            "task_execution_invocation_work_batch_mismatch",
            "Started attempt work item and batch binding no longer matches current authoritative task state.",
            "validation",
            {
              taskId: input.state.taskId,
              attemptId: input.attempt.attemptId,
              workItemId: input.attempt.workItemId,
              batchId: input.attempt.batchId,
            },
          ),
        );
      }
    }

    return ok(undefined);
  }

  if (input.attempt.batchId !== undefined) {
    const batch = input.state.batches.find(
      (item) => item.id === input.attempt.batchId,
    );

    if (batch === undefined) {
      return err(
        createError(
          "task_execution_invocation_batch_missing",
          "Started attempt batch no longer exists in current authoritative task state.",
          "validation",
          {
            taskId: input.state.taskId,
            attemptId: input.attempt.attemptId,
            batchId: input.attempt.batchId,
          },
        ),
      );
    }

    if (!batch.workItemIds.some((workItemId) => eligibleIds.has(workItemId))) {
      return err(
        createError(
          "task_execution_invocation_batch_not_executable",
          "Started attempt batch no longer contains pending or retryable work.",
          "validation",
          {
            taskId: input.state.taskId,
            attemptId: input.attempt.attemptId,
            batchId: input.attempt.batchId,
          },
        ),
      );
    }

    return ok(undefined);
  }

  if (eligibleIds.size === 0) {
    return err(
      createError(
        "task_execution_invocation_no_executable_work",
        "Current authoritative task state has no pending or retryable work eligible for invocation.",
        "validation",
        {
          taskId: input.state.taskId,
          attemptId: input.attempt.attemptId,
        },
      ),
    );
  }

  return ok(undefined);
}

function validateReservationAuthority(input: {
  readonly state: unknown;
  readonly attempt: unknown;
  readonly expectedRevision?: number;
  readonly latestAttemptNumberForContext?: number;
}): Result<
  { readonly state: PersistedTaskState; readonly attempt: TaskExecutionAttempt },
  TaskExecutionInvocationPersistenceError
> {
  const stateResult = validatePersistedTaskState(input.state);

  if (!stateResult.ok) {
    return stateResult;
  }

  const attemptResult = validateTaskExecutionAttempt(input.attempt);

  if (!attemptResult.ok) {
    return attemptResult;
  }

  const state = stateResult.value;
  const attempt = attemptResult.value;

  if (
    input.expectedRevision !== undefined &&
    !isPositiveInteger(input.expectedRevision)
  ) {
    return err(
      createError(
        "task_execution_invocation_expected_revision_invalid",
        "Task execution invocation reservation expected revision must be a positive integer.",
        "validation",
      ),
    );
  }

  if (
    input.expectedRevision !== undefined &&
    input.expectedRevision !== state.revision
  ) {
    return err(
      createError(
        "task_execution_invocation_expected_revision_mismatch",
        "Expected task revision does not match current authoritative task state revision.",
        "conflict",
      ),
    );
  }

  if (attempt.taskId !== state.taskId) {
    return err(
      createError(
        "task_execution_invocation_task_mismatch",
        "Started attempt task id does not match current authoritative task state.",
        "validation",
      ),
    );
  }

  if (attempt.taskStateRevision !== state.revision) {
    return err(
      createError(
        "task_execution_invocation_stale_task_revision",
        "Started attempt source revision does not match current authoritative task state revision.",
        "conflict",
      ),
    );
  }

  if (attempt.lifecycle !== "started") {
    return err(
      createError(
        "task_execution_invocation_attempt_not_started",
        "Only authoritative started attempts are eligible for invocation reservation.",
        "validation",
      ),
    );
  }

  if (
    input.latestAttemptNumberForContext !== undefined &&
    (!isPositiveInteger(input.latestAttemptNumberForContext) ||
      input.latestAttemptNumberForContext !== attempt.attemptNumber)
  ) {
    return err(
      createError(
        "task_execution_invocation_attempt_number_obsolete",
        "A later or conflicting persisted attempt number supersedes this started attempt for the same task/revision/work/batch context.",
        "conflict",
      ),
    );
  }

  const bindingResult = validateWorkBatchBinding({ state, attempt });

  if (!bindingResult.ok) {
    return bindingResult;
  }

  if (
    attempt.policyRequirement.required ||
    state.plan.summary?.approvalRequired === true
  ) {
    return err(
      createError(
        "task_execution_invocation_policy_not_authorized",
        "Policy is required, but no authoritative policy approval proof exists in the current invocation MVP.",
        "policy",
      ),
    );
  }

  return ok({ state, attempt });
}

function sameInvocationAuthority(input: {
  readonly expected: TaskExecutionInvocationRecord;
  readonly existing: TaskExecutionInvocationRecord;
}): boolean {
  return (
    input.existing.invocationId === input.expected.invocationId &&
    input.existing.idempotencyKey === input.expected.idempotencyKey &&
    input.existing.taskId === input.expected.taskId &&
    input.existing.taskStateRevision === input.expected.taskStateRevision &&
    input.existing.attemptId === input.expected.attemptId &&
    input.existing.attemptNumber === input.expected.attemptNumber &&
    input.existing.workItemId === input.expected.workItemId &&
    input.existing.batchId === input.expected.batchId &&
    input.existing.dependencyKind === input.expected.dependencyKind
  );
}

export async function loadTaskExecutionInvocation(
  input: LoadTaskExecutionInvocationInput,
): Promise<
  Result<
    TaskExecutionInvocationPersistenceResult,
    TaskExecutionInvocationPersistenceError
  >
> {
  const pathResult = getTaskExecutionInvocationStoragePath(input);

  if (!pathResult.ok) {
    return pathResult;
  }

  const rootResult = await ensureInvocationRoot({
    projectRoot: input.projectRoot,
    taskId: input.taskId,
    create: false,
  });

  if (!rootResult.ok) {
    return rootResult;
  }

  const targetPath = join(rootResult.value, `${input.invocationId}.json`);
  const existingInvocationResult = await readExistingInvocation(targetPath);

  if (!existingInvocationResult.ok) {
    return existingInvocationResult;
  }

  if (existingInvocationResult.value === undefined) {
    return err(
      createError(
        "task_execution_invocation_not_found",
        "Persisted task execution invocation was not found.",
        "not_found",
      ),
    );
  }

  if (
    existingInvocationResult.value.taskId !== input.taskId ||
    existingInvocationResult.value.invocationId !== input.invocationId
  ) {
    return err(
      createError(
        "task_execution_invocation_identity_mismatch",
        "Persisted task execution invocation identity did not match the requested identity.",
        "validation",
      ),
    );
  }

  return ok({
    record: existingInvocationResult.value,
    path: targetPath,
  });
}

export async function reserveTaskExecutionInvocation(
  input: ReserveTaskExecutionInvocationInput,
): Promise<
  Result<
    ReserveTaskExecutionInvocationResult,
    TaskExecutionInvocationPersistenceError
  >
> {
  if (input.dependencyKind !== "test_noop") {
    return err(
      createError(
        "task_execution_invocation_dependency_not_test_noop",
        "Task execution invocation MVP accepts only an explicitly injected test/no-op dependency.",
        "validation",
      ),
    );
  }

  const authorityResult = validateReservationAuthority(input);

  if (!authorityResult.ok) {
    return authorityResult;
  }

  const verifierRequired =
    authorityResult.value.state.verifier.required ||
    authorityResult.value.attempt.verifierRequirement.required;
  const completionGatedByVerifier =
    authorityResult.value.state.verifier.completionGatedByVerifier &&
    authorityResult.value.attempt.verifierRequirement.completionGatedByVerifier;
  const recordInput: CreateReservedTaskExecutionInvocationRecordInput = {
    taskId: authorityResult.value.attempt.taskId,
    taskStateRevision: authorityResult.value.attempt.taskStateRevision,
    attemptId: authorityResult.value.attempt.attemptId,
    attemptNumber: authorityResult.value.attempt.attemptNumber,
    workItemId: authorityResult.value.attempt.workItemId,
    batchId: authorityResult.value.attempt.batchId,
    dependencyKind: input.dependencyKind,
    allowedOperationReferences: input.allowedOperationReferences,
    verifierRequired,
    completionGatedByVerifier,
    claimedAt: input.claimedAt,
    ownerId: input.ownerId,
    ownershipToken: input.ownershipToken,
  };
  const recordResult = createReservedTaskExecutionInvocationRecord(recordInput);

  if (!recordResult.ok) {
    return recordResult;
  }

  const pathResult = getTaskExecutionInvocationStoragePath({
    projectRoot: input.projectRoot,
    taskId: recordResult.value.taskId,
    invocationId: recordResult.value.invocationId,
  });

  if (!pathResult.ok) {
    return pathResult;
  }

  const rootResult = await ensureInvocationRoot({
    projectRoot: input.projectRoot,
    taskId: recordResult.value.taskId,
    create: true,
  });

  if (!rootResult.ok) {
    return rootResult;
  }

  const targetPath = join(
    rootResult.value,
    `${recordResult.value.invocationId}.json`,
  );
  let fileHandle: Awaited<ReturnType<typeof open>> | undefined;

  try {
    fileHandle = await open(targetPath, "wx");
    await fileHandle.writeFile(jsonContent(recordResult.value), "utf8");
    await fileHandle.sync();
    await fileHandle.close();
    fileHandle = undefined;

    return ok({
      status: "reserved",
      record: recordResult.value,
      path: targetPath,
    });
  } catch (error) {
    if (fileHandle !== undefined) {
      await fileHandle.close().catch(() => undefined);
    }

    if (
      isRecord(error) &&
      typeof error.code === "string" &&
      error.code === "EEXIST"
    ) {
      const stats = await lstat(targetPath).catch(() => undefined);

      if (stats?.isSymbolicLink() === true || stats?.isFile() !== true) {
        return err(
          createError(
            "task_execution_invocation_unsafe_target",
            "Persisted task execution invocation target is not a safe file path.",
            "permission",
          ),
        );
      }

      const existingResult = await readExistingInvocation(targetPath);

      if (!existingResult.ok) {
        return existingResult;
      }

      if (existingResult.value === undefined) {
        return err(
          createError(
            "task_execution_invocation_reservation_conflict",
            "Persisted task execution invocation reservation collided with an unreadable authority record.",
            "conflict",
          ),
        );
      }

      if (
        !sameInvocationAuthority({
          expected: recordResult.value,
          existing: existingResult.value,
        })
      ) {
        return err(
          createError(
            "task_execution_invocation_authority_collision",
            "Persisted task execution invocation authority did not match the requested attempt context.",
            "validation",
          ),
        );
      }

      return ok({
        status: "already_reserved",
        record: existingResult.value,
        path: targetPath,
      });
    }

    throw error;
  }
}

function immutableInvocationIdentityChanged(input: {
  readonly current: TaskExecutionInvocationRecord;
  readonly updated: TaskExecutionInvocationRecord;
}): boolean {
  return (
    input.updated.invocationId !== input.current.invocationId ||
    input.updated.idempotencyKey !== input.current.idempotencyKey ||
    input.updated.taskId !== input.current.taskId ||
    input.updated.taskStateRevision !== input.current.taskStateRevision ||
    input.updated.attemptId !== input.current.attemptId ||
    input.updated.attemptNumber !== input.current.attemptNumber ||
    input.updated.workItemId !== input.current.workItemId ||
    input.updated.batchId !== input.current.batchId ||
    input.updated.dependencyKind !== input.current.dependencyKind ||
    JSON.stringify(input.updated.ownership) !==
      JSON.stringify(input.current.ownership) ||
    JSON.stringify(input.updated.request) !== JSON.stringify(input.current.request) ||
    input.updated.createdAt !== input.current.createdAt ||
    JSON.stringify(input.updated.safety) !== JSON.stringify(input.current.safety)
  );
}

export async function updateTaskExecutionInvocation(
  input: UpdateTaskExecutionInvocationInput,
): Promise<
  Result<
    TaskExecutionInvocationPersistenceResult,
    TaskExecutionInvocationPersistenceError
  >
> {
  const pathResult = getTaskExecutionInvocationStoragePath(input);

  if (!pathResult.ok) {
    return pathResult;
  }

  const rootResult = await ensureInvocationRoot({
    projectRoot: input.projectRoot,
    taskId: input.taskId,
    create: false,
  });

  if (!rootResult.ok) {
    return rootResult;
  }

  const lockRootResult = await ensureInvocationLockRoot({
    projectRoot: input.projectRoot,
    taskId: input.taskId,
  });

  if (!lockRootResult.ok) {
    return lockRootResult;
  }

  const targetPath = join(rootResult.value, `${input.invocationId}.json`);
  const lockPath = join(lockRootResult.value, `${input.invocationId}.lock`);

  if (!isInsideOrEqual(lockRootResult.value, lockPath)) {
    return err(
      createError(
        "task_execution_invocation_lock_path_outside_root",
        "Task execution invocation lock path escaped the AEOS invocation lock root.",
        "permission",
      ),
    );
  }

  let lockHandle: Awaited<ReturnType<typeof open>> | undefined;

  try {
    try {
      lockHandle = await open(lockPath, "wx");
      await lockHandle.writeFile(
        `${JSON.stringify({
          taskId: input.taskId,
          invocationId: input.invocationId,
          createdAt: new Date().toISOString(),
        })}\n`,
        "utf8",
      );
      await lockHandle.sync();
      await lockHandle.close();
      lockHandle = undefined;
    } catch (error) {
      if (
        isRecord(error) &&
        typeof error.code === "string" &&
        error.code === "EEXIST"
      ) {
        const lockStats = await lstat(lockPath).catch(() => undefined);

        if (lockStats?.isSymbolicLink() === true) {
          return err(
            createError(
              "task_execution_invocation_unsafe_lock_target",
              "Task execution invocation update lock target is unsafe.",
              "permission",
            ),
          );
        }

        return err(
          createError(
            "task_execution_invocation_update_locked",
            "Persisted task execution invocation is already locked for update.",
            "conflict",
            {
              taskId: input.taskId,
              invocationId: input.invocationId,
            },
          ),
        );
      }

      throw error;
    }

    const initialContentResult = await readInvocationContent(targetPath);

    if (!initialContentResult.ok) {
      return initialContentResult;
    }

    const existingInvocationResult = await readExistingInvocation(targetPath);

    if (!existingInvocationResult.ok) {
      return existingInvocationResult;
    }

    const currentRecord = existingInvocationResult.value;

    if (currentRecord === undefined) {
      return err(
        createError(
          "task_execution_invocation_not_found",
          "Persisted task execution invocation was not found.",
          "not_found",
        ),
      );
    }

    if (
      currentRecord.taskId !== input.taskId ||
      currentRecord.invocationId !== input.invocationId
    ) {
      return err(
        createError(
          "task_execution_invocation_identity_mismatch",
          "Persisted task execution invocation identity did not match the requested identity.",
          "validation",
        ),
      );
    }

    if (currentRecord.ownership.ownershipToken !== input.ownershipToken) {
      return err(
        createError(
          "task_execution_invocation_ownership_mismatch",
          "Persisted task execution invocation update requires matching system ownership proof.",
          "permission",
        ),
      );
    }

    if (currentRecord.lifecycle !== input.expectedLifecycle) {
      return err(
        createError(
          "task_execution_invocation_lifecycle_conflict",
          "Persisted task execution invocation lifecycle did not match the expected lifecycle.",
          "conflict",
          {
            expectedLifecycle: input.expectedLifecycle,
            actualLifecycle: currentRecord.lifecycle,
          },
        ),
      );
    }

    const updatedRecordResult = transitionTaskExecutionInvocationRecord({
      record: currentRecord,
      intent: input.intent,
    });

    if (!updatedRecordResult.ok) {
      return updatedRecordResult;
    }

    const updatedRecordValidation = validateTaskExecutionInvocationRecord(
      updatedRecordResult.value,
    );

    if (!updatedRecordValidation.ok) {
      return updatedRecordValidation;
    }

    if (
      immutableInvocationIdentityChanged({
        current: currentRecord,
        updated: updatedRecordValidation.value,
      })
    ) {
      return err(
        createError(
          "task_execution_invocation_immutable_field_changed",
          "Task execution invocation update cannot change immutable identity, ownership, request, or safety fields.",
          "validation",
        ),
      );
    }

    const latestContentResult = await readInvocationContent(targetPath);

    if (!latestContentResult.ok) {
      return latestContentResult;
    }

    if (latestContentResult.value !== initialContentResult.value) {
      return err(
        createError(
          "task_execution_invocation_update_conflict",
          "Persisted task execution invocation changed before update could be applied.",
          "conflict",
          {
            taskId: input.taskId,
            invocationId: input.invocationId,
          },
        ),
      );
    }

    const tempPath = `${targetPath}.tmp-${Date.now()}-${randomUUID()}`;
    const content = jsonContent(updatedRecordValidation.value);
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
      record: updatedRecordValidation.value,
      path: targetPath,
    });
  } finally {
    if (lockHandle !== undefined) {
      await lockHandle.close().catch(() => undefined);
    }

    await unlink(lockPath).catch(() => undefined);
  }
}

export function deriveTaskExecutionInvocationIdentityForAttempt(input: {
  readonly attempt: TaskExecutionAttempt;
  readonly dependencyKind: TaskExecutionInvocationDependencyKind;
  readonly allowedOperationReferences?: readonly string[];
  readonly verifierRequired: boolean;
  readonly completionGatedByVerifier: boolean;
}): Result<TaskExecutionInvocationIdentity, TaskExecutionInvocationPersistenceError> {
  return deriveTaskExecutionInvocationIdentity({
    taskId: input.attempt.taskId,
    taskStateRevision: input.attempt.taskStateRevision,
    attemptId: input.attempt.attemptId,
    attemptNumber: input.attempt.attemptNumber,
    workItemId: input.attempt.workItemId,
    batchId: input.attempt.batchId,
    dependencyKind: input.dependencyKind,
    allowedOperationReferences: input.allowedOperationReferences,
    verifierRequired: input.verifierRequired,
    completionGatedByVerifier: input.completionGatedByVerifier,
  });
}

function resultDiagnosticForStatus(
  record: TaskExecutionInvocationRecord,
): TaskExecutionInvocationStatusResultDiagnostic | null {
  if (record.result === undefined) {
    return null;
  }

  return {
    invocationOk: record.result.invocationOk,
    outputReference: record.result.outputReference ?? null,
    diagnosticCode: record.result.diagnosticCode ?? null,
    message: record.result.message ?? null,
    returnedAt: record.result.returnedAt,
    executorClaims: {
      completed: hasTrueKey(record.result, new Set(["completed"])),
      verified: hasTrueKey(record.result, new Set(["verified"])),
      approved: hasTrueKey(record.result, new Set(["approved"])),
      allDone: hasTrueKey(record.result, new Set(["allDone"])),
      executionSucceeded: hasTrueKey(
        record.result,
        new Set(["executionSucceeded"]),
      ),
    },
  };
}

function failureDiagnosticForStatus(
  record: TaskExecutionInvocationRecord,
): TaskExecutionInvocationStatusFailureDiagnostic | null {
  if (record.failure === undefined) {
    return null;
  }

  return {
    code: record.failure.code,
    category: record.failure.category,
    diagnostic: record.failure.diagnostic ?? null,
    retryable: record.failure.retryable,
    failedAt: record.failure.failedAt,
  };
}

function attemptMatchesInvocationContext(input: {
  readonly attempt: TaskExecutionAttempt;
  readonly record: TaskExecutionInvocationRecord;
}): boolean {
  return (
    input.attempt.taskId === input.record.taskId &&
    input.attempt.attemptId === input.record.attemptId &&
    input.attempt.attemptNumber === input.record.attemptNumber &&
    input.attempt.taskStateRevision === input.record.taskStateRevision &&
    input.attempt.workItemId === input.record.workItemId &&
    input.attempt.batchId === input.record.batchId
  );
}

export async function loadTaskExecutionInvocationStatus(
  input: LoadTaskExecutionInvocationStatusInput,
): Promise<
  Result<
    TaskExecutionInvocationReadOnlyStatus,
    TaskExecutionInvocationPersistenceError
  >
> {
  const invocationResult = await loadTaskExecutionInvocation(input);

  if (!invocationResult.ok) {
    return invocationResult;
  }

  const record = invocationResult.value.record;
  const issues: TaskExecutionInvocationStatusIssue[] = record.issues.map(
    (issue) =>
      statusIssue({
        code: issue.code,
        message: issue.message,
        category: statusCategoryFromLifecycleIssueCategory(issue.category),
      }),
  );

  let currentTaskRevision: number | null = null;
  let taskContextLoaded = false;
  let taskContextValid = false;
  const taskResult = await loadTaskState({
    projectRoot: input.projectRoot,
    taskId: record.taskId,
  });

  if (taskResult.ok) {
    taskContextLoaded = true;
    taskContextValid = true;
    currentTaskRevision = taskResult.value.state.revision;
  } else {
    issues.push(statusIssueFromError(taskResult.error));
  }

  let attemptLifecycle: TaskExecutionAttempt["lifecycle"] | null = null;
  let attemptLoaded = false;
  let attemptContextValid = false;
  const attemptResult = await loadTaskExecutionAttempt({
    projectRoot: input.projectRoot,
    taskId: record.taskId,
    attemptId: record.attemptId,
  });

  if (attemptResult.ok) {
    attemptLoaded = true;
    attemptLifecycle = attemptResult.value.attempt.lifecycle;
    attemptContextValid = attemptMatchesInvocationContext({
      attempt: attemptResult.value.attempt,
      record,
    });

    if (!attemptContextValid) {
      issues.push(
        statusIssue({
          code: "task_execution_invocation_attempt_context_mismatch",
          message:
            "Persisted execution attempt context does not match invocation authority.",
          category: "validation",
        }),
      );
    }
  } else {
    issues.push(statusIssueFromError(attemptResult.error));
  }

  const staleAgainstCurrentTask =
    currentTaskRevision === null
      ? null
      : currentTaskRevision !== record.taskStateRevision;
  const currentlyExecutionAuthoritative =
    taskContextValid &&
    attemptContextValid &&
    staleAgainstCurrentTask === false &&
    attemptLifecycle === "started" &&
    (record.lifecycle === "reserved" || record.lifecycle === "invoking");

  return ok({
    status: "invocation_status_loaded",
    taskId: record.taskId,
    invocationId: record.invocationId,
    invocation: {
      lifecycle: record.lifecycle,
      dependencyKind: record.dependencyKind,
      attemptId: record.attemptId,
      attemptNumber: record.attemptNumber,
      attemptLifecycle,
      attemptLoaded,
      attemptContextValid,
      taskStateRevision: record.taskStateRevision,
      currentTaskRevision,
      taskContextLoaded,
      taskContextValid,
      staleAgainstCurrentTask,
      currentlyExecutionAuthoritative,
      workItemId: record.workItemId ?? null,
      batchId: record.batchId ?? null,
      idempotencyReference: record.idempotencyKey,
      requestFingerprint: record.request.fingerprint,
      allowedOperationReferences: record.request.allowedOperationReferences,
      verifierRequired: record.request.verifierRequired,
      completionGatedByVerifier: record.request.completionGatedByVerifier,
      outcomeCertainty: record.outcomeCertainty,
      outcomeKnown: record.outcomeCertainty === "known",
      reconciliationRequired: record.lifecycle === "outcome_unknown",
      safeToBlindRetry: false,
      retryable: record.failure?.retryable ?? false,
      result: resultDiagnosticForStatus(record),
      failure: failureDiagnosticForStatus(record),
      recordRevision: record.revision,
      recordSchemaVersion: record.schemaVersion,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      enteredAt: record.enteredAt ?? null,
      outcomeUnknownAt: record.outcomeUnknownAt ?? null,
    },
    safety: {
      readOnly: true,
      dependencyInvokedByStatus: false,
      stateModified: false,
      attemptModified: false,
      taskModified: false,
      workCompleted: false,
      taskCompleted: false,
      verifierRun: false,
      auditWritten: false,
      policyRun: false,
      safeToBlindRetry: false,
      ownershipSecretRendered: false,
      statusUsableAsOwnershipCredential: false,
    },
    issues,
  });
}
