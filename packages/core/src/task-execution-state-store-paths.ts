import {
  lstat,
  mkdir,
  realpath,
// @ts-expect-error Node built-ins are available at runtime; this package does not depend on Node ambient types yet.
} from "node:fs/promises";
// @ts-expect-error Node built-ins are available at runtime; this package does not depend on Node ambient types yet.
import { isAbsolute, join, relative, resolve } from "node:path";

import type { AeosError, Result } from "./types.js";

/**
 * Shared path-safety helpers for AEOS per-task state stores.
 *
 * Five modules already carry private copies of this logic
 * (`task-state-persistence`, `task-execution-invocation-persistence`,
 * `task-execution-attempt-persistence`, `task-execution-audit-persistence`,
 * `task-execution-policy-approval-persistence`).  A sixth copy is not
 * defensible, so new stores use this module instead.
 *
 * The five existing stores are deliberately NOT migrated here.  That is a
 * mechanical refactor across five proven P0 persistence paths and belongs in
 * its own change; folding it into a task about step idempotency would put
 * working durable-state code at risk for no benefit to that task.
 *
 * Error codes are namespaced by the caller's `errorPrefix` so each store keeps
 * the code vocabulary its own tests and operators already rely on.
 */

export interface StateStorePathInput {
  readonly projectRoot: string;
  /** e.g. ".aeos/state/iteration-steps" */
  readonly rootRelativePath: string;
  /** Per-task subdirectory name; must be a safe id. */
  readonly taskId: string;
  /** File name inside the per-task directory, without extension. */
  readonly recordId: string;
  /** Code namespace, e.g. "iteration_step". */
  readonly errorPrefix: string;
}

export interface StateStorePath {
  readonly stateRoot: string;
  readonly taskRoot: string;
  readonly path: string;
}

export interface EnsureStateStoreRootInput {
  readonly projectRoot: string;
  readonly rootRelativePath: string;
  readonly taskId: string;
  readonly create: boolean;
  readonly errorPrefix: string;
}

const safeStoreIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/;

function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

function err(error: AeosError): Result<never, AeosError> {
  return { ok: false, error };
}

function createError(
  code: string,
  message: string,
  category: AeosError["category"],
  details?: Record<string, string | number | boolean | null>,
): AeosError {
  return details === undefined
    ? { code, message, category, retryable: false }
    : { code, message, category, retryable: false, details };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isInsideOrEqual(parentPath: string, childPath: string): boolean {
  const relativePath = relative(parentPath, childPath);

  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !isAbsolute(relativePath))
  );
}

export function validateSafeStoreId(input: {
  readonly value: unknown;
  readonly field: string;
  readonly errorPrefix: string;
}): Result<string, AeosError> {
  if (
    typeof input.value !== "string" ||
    !safeStoreIdPattern.test(input.value)
  ) {
    return err(
      createError(
        `${input.errorPrefix}_unsafe_identifier`,
        "AEOS state store identifiers must be safe path segments.",
        "validation",
        { field: input.field },
      ),
    );
  }

  return ok(input.value);
}

/**
 * Resolve the on-disk path for a per-task state record, refusing any path that
 * escapes the project root or the store root.
 */
export function getStateStorePath(
  input: StateStorePathInput,
): Result<StateStorePath, AeosError> {
  const taskIdResult = validateSafeStoreId({
    value: input.taskId,
    field: "taskId",
    errorPrefix: input.errorPrefix,
  });

  if (!taskIdResult.ok) {
    return taskIdResult;
  }

  const recordIdResult = validateSafeStoreId({
    value: input.recordId,
    field: "recordId",
    errorPrefix: input.errorPrefix,
  });

  if (!recordIdResult.ok) {
    return recordIdResult;
  }

  const projectRoot = resolve(input.projectRoot);
  const stateRoot = resolve(projectRoot, input.rootRelativePath);
  const taskRoot = resolve(stateRoot, taskIdResult.value);
  const path = resolve(taskRoot, `${recordIdResult.value}.json`);

  if (
    !isInsideOrEqual(projectRoot, stateRoot) ||
    !isInsideOrEqual(stateRoot, taskRoot) ||
    !isInsideOrEqual(taskRoot, path)
  ) {
    return err(
      createError(
        `${input.errorPrefix}_path_outside_root`,
        "AEOS state store path escaped the state root.",
        "permission",
      ),
    );
  }

  return ok({ stateRoot, taskRoot, path });
}

/**
 * Walk and (optionally) create the per-task store directory, refusing symlinks,
 * non-directories and anything resolving outside the project root at every
 * segment.  Returns the real path of the per-task directory.
 */
export async function ensureStateStoreRoot(
  input: EnsureStateStoreRootInput,
): Promise<Result<string, AeosError>> {
  const taskIdResult = validateSafeStoreId({
    value: input.taskId,
    field: "taskId",
    errorPrefix: input.errorPrefix,
  });

  if (!taskIdResult.ok) {
    return taskIdResult;
  }

  let projectRootRealPath: string;

  try {
    projectRootRealPath = (await realpath(
      resolve(input.projectRoot),
    )) as string;
  } catch {
    return err(
      createError(
        `${input.errorPrefix}_project_root_missing`,
        "AEOS state store project root was not found.",
        "not_found",
      ),
    );
  }

  const stateRoot = join(projectRootRealPath, input.rootRelativePath);
  const segments = [
    ...input.rootRelativePath.split("/"),
    taskIdResult.value,
  ];
  let currentPath = projectRootRealPath;

  for (const segment of segments) {
    currentPath = join(currentPath, segment);

    try {
      const stats = await lstat(currentPath);

      if (stats.isSymbolicLink() || !stats.isDirectory()) {
        return err(
          createError(
            `${input.errorPrefix}_unsafe_state_root`,
            "AEOS state store root contains an unsafe symlink or non-directory path.",
            "permission",
          ),
        );
      }

      const currentRealPath = (await realpath(currentPath)) as string;

      if (!isInsideOrEqual(projectRootRealPath, currentRealPath)) {
        return err(
          createError(
            `${input.errorPrefix}_state_root_escape`,
            "AEOS state store root resolves outside the project root.",
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
              `${input.errorPrefix}_not_found`,
              "Persisted AEOS state store record was not found.",
              "not_found",
            ),
          );
        }

        break;
      }

      throw error;
    }
  }

  const taskRoot = join(stateRoot, taskIdResult.value);

  if (input.create) {
    await mkdir(taskRoot, { recursive: true });
  }

  let rootStats: Awaited<ReturnType<typeof lstat>>;

  try {
    rootStats = await lstat(taskRoot);
  } catch {
    return err(
      createError(
        `${input.errorPrefix}_not_found`,
        "Persisted AEOS state store record was not found.",
        "not_found",
      ),
    );
  }

  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
    return err(
      createError(
        `${input.errorPrefix}_unsafe_state_root`,
        "AEOS state store root is not a safe directory.",
        "permission",
      ),
    );
  }

  const taskRootRealPath = (await realpath(taskRoot)) as string;

  if (!isInsideOrEqual(projectRootRealPath, taskRootRealPath)) {
    return err(
      createError(
        `${input.errorPrefix}_state_root_escape`,
        "AEOS state store root resolves outside the project root.",
        "permission",
      ),
    );
  }

  return ok(taskRootRealPath);
}
