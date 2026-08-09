import {
  lstat,
  mkdir,
  open,
  readdir,
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
} from "./agentic-lifecycle.js";
import type {
  TaskExecutionAttempt,
  TaskExecutionAttemptError,
} from "./task-execution-attempt.js";
import { validateTaskExecutionAttempt } from "./task-execution-attempt.js";
import type { AeosError, Result } from "./types.js";

export const AEOS_TASK_EXECUTION_ATTEMPT_ROOT_RELATIVE_PATH =
  ".aeos/state/executions";

export interface TaskExecutionAttemptStorageInput {
  readonly projectRoot: string;
  readonly taskId: AgenticTaskId;
  readonly attemptId: AgenticExecutionAttemptId;
}

export interface TaskExecutionAttemptStoragePath {
  readonly stateRoot: string;
  readonly taskExecutionRoot: string;
  readonly path: string;
}

export interface SaveTaskExecutionAttemptInput {
  readonly projectRoot: string;
  readonly attempt: TaskExecutionAttempt;
}

export interface LoadTaskExecutionAttemptInput
  extends TaskExecutionAttemptStorageInput {}

export interface DeriveNextTaskExecutionAttemptNumberInput {
  readonly projectRoot: string;
  readonly taskId: AgenticTaskId;
  readonly taskStateRevision: number;
  readonly workItemId?: string;
  readonly batchId?: string;
}

export interface TaskExecutionAttemptPersistenceResult {
  readonly attempt: TaskExecutionAttempt;
  readonly path: string;
}

export type TaskExecutionAttemptPersistenceError =
  | TaskExecutionAttemptError
  | AeosError;

const safeIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,191}$/;

function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

function err(
  error: TaskExecutionAttemptPersistenceError,
): Result<never, TaskExecutionAttemptPersistenceError> {
  return { ok: false, error };
}

function createError(
  code: string,
  message: string,
  category: AeosError["category"],
  details?: Record<string, string | number | boolean | null>,
): TaskExecutionAttemptPersistenceError {
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

function isInsideOrEqual(parentPath: string, childPath: string): boolean {
  const relativePath = relative(parentPath, childPath);

  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !isAbsolute(relativePath))
  );
}

function validateSafeId(input: {
  readonly value: string;
  readonly field: "taskId" | "attemptId";
}): Result<string, TaskExecutionAttemptPersistenceError> {
  if (typeof input.value !== "string" || input.value.trim().length === 0) {
    return err(
      createError(
        `task_execution_attempt_${input.field}_required`,
        "Task execution attempt storage id is required.",
        "validation",
      ),
    );
  }

  if (
    input.value !== input.value.trim() ||
    input.value === "." ||
    input.value === ".." ||
    isAbsolute(input.value) ||
    !safeIdPattern.test(input.value)
  ) {
    return err(
      createError(
        `task_execution_attempt_unsafe_${input.field}`,
        "Task execution attempt storage id is not safe for persisted storage.",
        "validation",
        { [input.field]: input.value },
      ),
    );
  }

  return ok(input.value);
}

export function getTaskExecutionAttemptStoragePath(
  input: TaskExecutionAttemptStorageInput,
): Result<
  TaskExecutionAttemptStoragePath,
  TaskExecutionAttemptPersistenceError
> {
  const taskIdResult = validateSafeId({
    value: input.taskId,
    field: "taskId",
  });

  if (!taskIdResult.ok) {
    return taskIdResult;
  }

  const attemptIdResult = validateSafeId({
    value: input.attemptId,
    field: "attemptId",
  });

  if (!attemptIdResult.ok) {
    return attemptIdResult;
  }

  const projectRoot = resolve(input.projectRoot);
  const stateRoot = resolve(projectRoot, AEOS_TASK_EXECUTION_ATTEMPT_ROOT_RELATIVE_PATH);
  const taskExecutionRoot = resolve(stateRoot, taskIdResult.value);
  const path = resolve(taskExecutionRoot, `${attemptIdResult.value}.json`);

  if (
    !isInsideOrEqual(projectRoot, stateRoot) ||
    !isInsideOrEqual(stateRoot, taskExecutionRoot) ||
    !isInsideOrEqual(taskExecutionRoot, path)
  ) {
    return err(
      createError(
        "task_execution_attempt_path_outside_root",
        "Task execution attempt storage path escaped the AEOS execution state root.",
        "permission",
      ),
    );
  }

  return ok({ stateRoot, taskExecutionRoot, path });
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

async function ensureExecutionRoot(input: {
  readonly projectRoot: string;
  readonly taskId: AgenticTaskId;
  readonly create: boolean;
  readonly allowMissing?: boolean;
}): Promise<Result<string, TaskExecutionAttemptPersistenceError>> {
  let projectRootRealPath: string;

  try {
    projectRootRealPath = await realpath(resolve(input.projectRoot));
  } catch {
    return err(
      createError(
        "task_execution_attempt_project_root_missing",
        "Task execution attempt project root was not found.",
        "not_found",
      ),
    );
  }

  const stateRoot = join(
    projectRootRealPath,
    AEOS_TASK_EXECUTION_ATTEMPT_ROOT_RELATIVE_PATH,
  );
  const segments = [
    ...AEOS_TASK_EXECUTION_ATTEMPT_ROOT_RELATIVE_PATH.split("/"),
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
            "task_execution_attempt_unsafe_state_root",
            "AEOS task execution attempt root contains an unsafe symlink or non-directory path.",
            "permission",
          ),
        );
      }

      const currentRealPath = await realpath(currentPath);

      if (!isInsideOrEqual(projectRootRealPath, currentRealPath)) {
        return err(
          createError(
            "task_execution_attempt_state_root_escape",
            "AEOS task execution attempt root resolves outside the project root.",
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
        if (input.allowMissing === true) {
          return ok(currentPath);
        }

        if (!input.create) {
          return err(
            createError(
              "task_execution_attempt_not_found",
              "Persisted task execution attempt was not found.",
              "not_found",
            ),
          );
        }

        break;
      }

      throw error;
    }
  }

  const taskExecutionRoot = join(stateRoot, input.taskId);

  if (input.create) {
    await mkdir(taskExecutionRoot, { recursive: true });
  }

  const rootStats = await lstat(taskExecutionRoot);

  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
    return err(
      createError(
        "task_execution_attempt_unsafe_state_root",
        "AEOS task execution attempt root is not a safe directory.",
        "permission",
      ),
    );
  }

  const taskExecutionRootRealPath = await realpath(taskExecutionRoot);

  if (!isInsideOrEqual(projectRootRealPath, taskExecutionRootRealPath)) {
    return err(
      createError(
        "task_execution_attempt_state_root_escape",
        "AEOS task execution attempt root resolves outside the project root.",
        "permission",
      ),
    );
  }

  return ok(taskExecutionRootRealPath);
}

async function readAuthoritativeAttemptFile(input: {
  readonly taskExecutionRoot: string;
  readonly fileName: string;
  readonly taskId: AgenticTaskId;
}): Promise<Result<TaskExecutionAttempt, TaskExecutionAttemptPersistenceError>> {
  if (!input.fileName.endsWith(".json")) {
    return err(
      createError(
        "task_execution_attempt_unsafe_record",
        "Task execution attempt authority root contains an unexpected record.",
        "validation",
        { fileName: input.fileName },
      ),
    );
  }

  const attemptId = input.fileName.slice(0, -".json".length);
  const attemptIdResult = validateSafeId({
    value: attemptId,
    field: "attemptId",
  });

  if (!attemptIdResult.ok) {
    return attemptIdResult;
  }

  const targetPath = join(input.taskExecutionRoot, input.fileName);
  const stats = await lstat(targetPath);

  if (stats.isSymbolicLink() || !stats.isFile()) {
    return err(
      createError(
        "task_execution_attempt_unsafe_target",
        "Persisted task execution attempt target is not a safe file path.",
        "permission",
      ),
    );
  }

  const jsonResult = await readJsonAttempt(targetPath);

  if (!jsonResult.ok) {
    return jsonResult;
  }

  const attemptResult = validateTaskExecutionAttempt(jsonResult.value);

  if (!attemptResult.ok) {
    return attemptResult;
  }

  if (
    attemptResult.value.taskId !== input.taskId ||
    attemptResult.value.attemptId !== attemptId
  ) {
    return err(
      createError(
        "task_execution_attempt_identity_mismatch",
        "Persisted task execution attempt identity did not match its authoritative storage location.",
        "validation",
      ),
    );
  }

  return ok(attemptResult.value);
}

export async function deriveNextTaskExecutionAttemptNumber(
  input: DeriveNextTaskExecutionAttemptNumberInput,
): Promise<Result<number, TaskExecutionAttemptPersistenceError>> {
  const taskIdResult = validateSafeId({
    value: input.taskId,
    field: "taskId",
  });

  if (!taskIdResult.ok) {
    return taskIdResult;
  }

  if (!isPositiveInteger(input.taskStateRevision)) {
    return err(
      createError(
        "task_execution_attempt_source_revision_invalid",
        "Task execution attempt number authority requires a positive source revision.",
        "validation",
      ),
    );
  }

  const rootResult = await ensureExecutionRoot({
    projectRoot: input.projectRoot,
    taskId: taskIdResult.value,
    create: false,
    allowMissing: true,
  });

  if (!rootResult.ok) {
    return rootResult;
  }

  let entries: readonly string[];

  try {
    entries = (await readdir(rootResult.value)).sort();
  } catch (error) {
    if (
      isRecord(error) &&
      typeof error.code === "string" &&
      error.code === "ENOENT"
    ) {
      return ok(1);
    }

    throw error;
  }

  const usedAttemptNumbers = new Set<number>();

  for (const fileName of entries) {
    const attemptResult = await readAuthoritativeAttemptFile({
      taskExecutionRoot: rootResult.value,
      fileName,
      taskId: taskIdResult.value,
    });

    if (!attemptResult.ok) {
      return attemptResult;
    }

    const attempt = attemptResult.value;

    if (
      attempt.taskStateRevision !== input.taskStateRevision ||
      attempt.workItemId !== input.workItemId ||
      attempt.batchId !== input.batchId
    ) {
      continue;
    }

    if (usedAttemptNumbers.has(attempt.attemptNumber)) {
      return err(
        createError(
          "task_execution_attempt_duplicate_number",
          "Persisted task execution attempt authority contains duplicate numbering for the same source/work/batch context.",
          "validation",
          { attemptNumber: attempt.attemptNumber },
        ),
      );
    }

    usedAttemptNumbers.add(attempt.attemptNumber);
  }

  let nextAttemptNumber = 1;

  while (usedAttemptNumbers.has(nextAttemptNumber)) {
    nextAttemptNumber += 1;
  }

  return ok(nextAttemptNumber);
}

async function readJsonAttempt(
  path: string,
): Promise<Result<unknown, TaskExecutionAttemptPersistenceError>> {
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
          "task_execution_attempt_not_found",
          "Persisted task execution attempt was not found.",
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
        "task_execution_attempt_corrupt_json",
        "Persisted task execution attempt JSON is corrupt and cannot be trusted.",
        "validation",
      ),
    );
  }
}

async function readExistingAttempt(
  path: string,
): Promise<
  Result<TaskExecutionAttempt | undefined, TaskExecutionAttemptPersistenceError>
> {
  if (await existingPathIsMissing(path)) {
    return ok(undefined);
  }

  const stats = await lstat(path);

  if (stats.isSymbolicLink() || !stats.isFile()) {
    return err(
      createError(
        "task_execution_attempt_unsafe_target",
        "Persisted task execution attempt target is not a safe file path.",
        "permission",
      ),
    );
  }

  const jsonResult = await readJsonAttempt(path);

  if (!jsonResult.ok) {
    return jsonResult;
  }

  const attemptResult = validateTaskExecutionAttempt(jsonResult.value);

  if (!attemptResult.ok) {
    return attemptResult;
  }

  return ok(attemptResult.value);
}

export async function loadTaskExecutionAttempt(
  input: LoadTaskExecutionAttemptInput,
): Promise<
  Result<
    TaskExecutionAttemptPersistenceResult,
    TaskExecutionAttemptPersistenceError
  >
> {
  const pathResult = getTaskExecutionAttemptStoragePath(input);

  if (!pathResult.ok) {
    return pathResult;
  }

  const rootResult = await ensureExecutionRoot({
    projectRoot: input.projectRoot,
    taskId: input.taskId,
    create: false,
  });

  if (!rootResult.ok) {
    return rootResult;
  }

  const targetPath = join(rootResult.value, `${input.attemptId}.json`);
  const existingAttemptResult = await readExistingAttempt(targetPath);

  if (!existingAttemptResult.ok) {
    return existingAttemptResult;
  }

  if (existingAttemptResult.value === undefined) {
    return err(
      createError(
        "task_execution_attempt_not_found",
        "Persisted task execution attempt was not found.",
        "not_found",
      ),
    );
  }

  if (
    existingAttemptResult.value.taskId !== input.taskId ||
    existingAttemptResult.value.attemptId !== input.attemptId
  ) {
    return err(
      createError(
        "task_execution_attempt_identity_mismatch",
        "Persisted task execution attempt identity did not match the requested identity.",
        "validation",
      ),
    );
  }

  return ok({
    attempt: existingAttemptResult.value,
    path: targetPath,
  });
}

export async function saveTaskExecutionAttempt(
  input: SaveTaskExecutionAttemptInput,
): Promise<
  Result<
    TaskExecutionAttemptPersistenceResult,
    TaskExecutionAttemptPersistenceError
  >
> {
  const attemptResult = validateTaskExecutionAttempt(input.attempt);

  if (!attemptResult.ok) {
    return attemptResult;
  }

  const pathResult = getTaskExecutionAttemptStoragePath({
    projectRoot: input.projectRoot,
    taskId: attemptResult.value.taskId,
    attemptId: attemptResult.value.attemptId,
  });

  if (!pathResult.ok) {
    return pathResult;
  }

  const rootResult = await ensureExecutionRoot({
    projectRoot: input.projectRoot,
    taskId: attemptResult.value.taskId,
    create: true,
  });

  if (!rootResult.ok) {
    return rootResult;
  }

  const targetPath = join(rootResult.value, `${attemptResult.value.attemptId}.json`);
  const existingAttemptResult = await readExistingAttempt(targetPath);

  if (!existingAttemptResult.ok) {
    return existingAttemptResult;
  }

  if (existingAttemptResult.value !== undefined) {
    return err(
      createError(
        "task_execution_attempt_already_exists",
        "Persisted task execution attempt identity already exists and cannot be overwritten.",
        "conflict",
        {
          taskId: attemptResult.value.taskId,
          attemptId: attemptResult.value.attemptId,
        },
      ),
    );
  }

  const tempPath = `${targetPath}.tmp-${Date.now()}-${randomUUID()}`;
  const content = `${JSON.stringify(attemptResult.value, null, 2)}\n`;
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
    attempt: attemptResult.value,
    path: targetPath,
  });
}
