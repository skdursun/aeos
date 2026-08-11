import {
  link,
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  unlink,
// @ts-expect-error Node built-ins are available at runtime; this package does not depend on Node ambient types yet.
} from "node:fs/promises";
// @ts-expect-error Node built-ins are available at runtime; this package does not depend on Node ambient types yet.
import { randomUUID } from "node:crypto";
// @ts-expect-error Node built-ins are available at runtime; this package does not depend on Node ambient types yet.
import { isAbsolute, join, relative, resolve } from "node:path";

import type { AgenticTaskId } from "./agentic-lifecycle.js";
import type {
  TaskExecutionPolicyApprovalBinding,
  TaskExecutionPolicyApprovalError,
  TaskExecutionPolicyApprovalPublicStatus,
  TaskExecutionPolicyApprovalRecord,
} from "./task-execution-policy-approval.js";
import {
  createTaskExecutionPolicyAuthorizationProofFromApproval,
  deriveTaskExecutionPolicyApprovalId,
  sanitizeTaskExecutionPolicyApprovalRecord,
  taskExecutionPolicyApprovalMatchesBinding,
  validateTaskExecutionPolicyApprovalRecord,
} from "./task-execution-policy-approval.js";
import type {
  TaskExecutionPolicyAuthorizationProof,
} from "./task-execution-permission-gate.js";
import type { AeosError, Result } from "./types.js";

export const AEOS_TASK_EXECUTION_POLICY_APPROVAL_ROOT_RELATIVE_PATH =
  ".aeos/state/policy/approvals";

export interface TaskExecutionPolicyApprovalStorageInput {
  readonly projectRoot: string;
  readonly taskId: AgenticTaskId;
  readonly approvalId: string;
}

export interface TaskExecutionPolicyApprovalStoragePath {
  readonly stateRoot: string;
  readonly taskApprovalRoot: string;
  readonly path: string;
}

export interface SaveTaskExecutionPolicyApprovalInput {
  readonly projectRoot: string;
  readonly approval: TaskExecutionPolicyApprovalRecord;
}

export interface LoadTaskExecutionPolicyApprovalInput
  extends TaskExecutionPolicyApprovalStorageInput {}

export interface LoadTaskExecutionPolicyApprovalForContextInput {
  readonly projectRoot: string;
  readonly binding: TaskExecutionPolicyApprovalBinding;
  readonly now?: string;
}

export type SaveTaskExecutionPolicyApprovalStatus =
  | "created"
  | "already_exists";

export interface TaskExecutionPolicyApprovalPersistenceResult {
  readonly approval: TaskExecutionPolicyApprovalRecord;
  readonly path: string;
}

export interface SaveTaskExecutionPolicyApprovalResult
  extends TaskExecutionPolicyApprovalPersistenceResult {
  readonly status: SaveTaskExecutionPolicyApprovalStatus;
}

export interface TaskExecutionPolicyApprovalProofLoadResult
  extends TaskExecutionPolicyApprovalPersistenceResult {
  readonly proof: TaskExecutionPolicyAuthorizationProof;
  readonly status: TaskExecutionPolicyApprovalPublicStatus;
}

export type TaskExecutionPolicyApprovalPersistenceError =
  | TaskExecutionPolicyApprovalError
  | AeosError;

const safeIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/;

function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

function err(
  error: TaskExecutionPolicyApprovalPersistenceError,
): Result<never, TaskExecutionPolicyApprovalPersistenceError> {
  return { ok: false, error };
}

function createError(
  code: string,
  message: string,
  category: AeosError["category"],
  details?: Record<string, string | number | boolean | null>,
): TaskExecutionPolicyApprovalPersistenceError {
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

function isSafeId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value === value.trim() &&
    value !== "." &&
    value !== ".." &&
    !isAbsolute(value) &&
    !value.includes("/") &&
    !value.includes("\\") &&
    safeIdPattern.test(value)
  );
}

function isInsideOrEqual(parentPath: string, childPath: string): boolean {
  const relativePath = relative(parentPath, childPath);

  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !isAbsolute(relativePath))
  );
}

function jsonContent(value: TaskExecutionPolicyApprovalRecord): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function validateSafeId(input: {
  readonly value: string;
  readonly field: "taskId" | "approvalId";
}): Result<string, TaskExecutionPolicyApprovalPersistenceError> {
  if (!isSafeId(input.value)) {
    return err(
      createError(
        `task_execution_policy_approval_unsafe_${input.field}`,
        "Task execution policy approval storage id is not safe for persisted storage.",
        "validation",
      ),
    );
  }

  return ok(input.value);
}

export function getTaskExecutionPolicyApprovalStoragePath(
  input: TaskExecutionPolicyApprovalStorageInput,
): Result<
  TaskExecutionPolicyApprovalStoragePath,
  TaskExecutionPolicyApprovalPersistenceError
> {
  const taskIdResult = validateSafeId({
    value: input.taskId,
    field: "taskId",
  });

  if (!taskIdResult.ok) {
    return taskIdResult;
  }

  const approvalIdResult = validateSafeId({
    value: input.approvalId,
    field: "approvalId",
  });

  if (!approvalIdResult.ok) {
    return approvalIdResult;
  }

  const projectRoot = resolve(input.projectRoot);
  const stateRoot = resolve(
    projectRoot,
    AEOS_TASK_EXECUTION_POLICY_APPROVAL_ROOT_RELATIVE_PATH,
  );
  const taskApprovalRoot = resolve(stateRoot, taskIdResult.value);
  const path = resolve(taskApprovalRoot, `${approvalIdResult.value}.json`);

  if (
    !isInsideOrEqual(projectRoot, stateRoot) ||
    !isInsideOrEqual(stateRoot, taskApprovalRoot) ||
    !isInsideOrEqual(taskApprovalRoot, path)
  ) {
    return err(
      createError(
        "task_execution_policy_approval_path_outside_root",
        "Task execution policy approval storage path escaped the AEOS policy approval state root.",
        "permission",
      ),
    );
  }

  return ok({ stateRoot, taskApprovalRoot, path });
}

async function ensureApprovalRoot(input: {
  readonly projectRoot: string;
  readonly taskId: AgenticTaskId;
  readonly create: boolean;
}): Promise<Result<string, TaskExecutionPolicyApprovalPersistenceError>> {
  let projectRootRealPath: string;

  try {
    projectRootRealPath = await realpath(resolve(input.projectRoot));
  } catch {
    return err(
      createError(
        "task_execution_policy_approval_project_root_missing",
        "Task execution policy approval project root was not found.",
        "not_found",
      ),
    );
  }

  const stateRoot = join(
    projectRootRealPath,
    AEOS_TASK_EXECUTION_POLICY_APPROVAL_ROOT_RELATIVE_PATH,
  );
  const segments = [
    ...AEOS_TASK_EXECUTION_POLICY_APPROVAL_ROOT_RELATIVE_PATH.split("/"),
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
            "task_execution_policy_approval_unsafe_state_root",
            "AEOS task execution policy approval root contains an unsafe symlink or non-directory path.",
            "permission",
          ),
        );
      }

      const currentRealPath = await realpath(currentPath);

      if (!isInsideOrEqual(projectRootRealPath, currentRealPath)) {
        return err(
          createError(
            "task_execution_policy_approval_state_root_escape",
            "AEOS task execution policy approval root resolves outside the project root.",
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
              "task_execution_policy_approval_not_found",
              "Persisted task execution policy approval was not found.",
              "not_found",
            ),
          );
        }

        break;
      }

      throw error;
    }
  }

  const taskApprovalRoot = join(stateRoot, input.taskId);

  if (input.create) {
    await mkdir(taskApprovalRoot, { recursive: true });
  }

  const rootStats = await lstat(taskApprovalRoot);

  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
    return err(
      createError(
        "task_execution_policy_approval_unsafe_state_root",
        "AEOS task execution policy approval root is not a safe directory.",
        "permission",
      ),
    );
  }

  const taskApprovalRootRealPath = await realpath(taskApprovalRoot);

  if (!isInsideOrEqual(projectRootRealPath, taskApprovalRootRealPath)) {
    return err(
      createError(
        "task_execution_policy_approval_state_root_escape",
        "AEOS task execution policy approval root resolves outside the project root.",
        "permission",
      ),
    );
  }

  return ok(taskApprovalRootRealPath);
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

async function readJsonApproval(
  path: string,
): Promise<Result<unknown, TaskExecutionPolicyApprovalPersistenceError>> {
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
          "task_execution_policy_approval_not_found",
          "Persisted task execution policy approval was not found.",
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
        "task_execution_policy_approval_corrupt_json",
        "Persisted task execution policy approval JSON is corrupt and cannot be trusted.",
        "validation",
      ),
    );
  }
}

async function readExistingApproval(
  path: string,
): Promise<
  Result<
    TaskExecutionPolicyApprovalRecord | undefined,
    TaskExecutionPolicyApprovalPersistenceError
  >
> {
  if (await existingPathIsMissing(path)) {
    return ok(undefined);
  }

  const stats = await lstat(path);

  if (stats.isSymbolicLink() || !stats.isFile()) {
    return err(
      createError(
        "task_execution_policy_approval_unsafe_target",
        "Persisted task execution policy approval target is not a safe file path.",
        "permission",
      ),
    );
  }

  const jsonResult = await readJsonApproval(path);

  if (!jsonResult.ok) {
    return jsonResult;
  }

  return validateTaskExecutionPolicyApprovalRecord(jsonResult.value);
}

function sameApprovalAuthority(input: {
  readonly expected: TaskExecutionPolicyApprovalRecord;
  readonly existing: TaskExecutionPolicyApprovalRecord;
}): boolean {
  return JSON.stringify(input.expected) === JSON.stringify(input.existing);
}

export async function saveTaskExecutionPolicyApproval(
  input: SaveTaskExecutionPolicyApprovalInput,
): Promise<
  Result<
    SaveTaskExecutionPolicyApprovalResult,
    TaskExecutionPolicyApprovalPersistenceError
  >
> {
  const approvalValidation = validateTaskExecutionPolicyApprovalRecord(
    input.approval,
  );

  if (!approvalValidation.ok) {
    return approvalValidation;
  }

  const pathResult = getTaskExecutionPolicyApprovalStoragePath({
    projectRoot: input.projectRoot,
    taskId: approvalValidation.value.taskId,
    approvalId: approvalValidation.value.approvalId,
  });

  if (!pathResult.ok) {
    return pathResult;
  }

  const rootResult = await ensureApprovalRoot({
    projectRoot: input.projectRoot,
    taskId: approvalValidation.value.taskId,
    create: true,
  });

  if (!rootResult.ok) {
    return rootResult;
  }

  const targetPath = join(
    rootResult.value,
    `${approvalValidation.value.approvalId}.json`,
  );
  const tempPath = join(
    rootResult.value,
    `.tmp-${approvalValidation.value.approvalId}-${Date.now()}-${randomUUID()}`,
  );
  let fileHandle: Awaited<ReturnType<typeof open>> | undefined;

  try {
    fileHandle = await open(tempPath, "wx");
    await fileHandle.writeFile(jsonContent(approvalValidation.value), "utf8");
    await fileHandle.sync();
    await fileHandle.close();
    fileHandle = undefined;

    try {
      await link(tempPath, targetPath);
    } catch (error) {
      if (
        isRecord(error) &&
        typeof error.code === "string" &&
        error.code === "EEXIST"
      ) {
        const stats = await lstat(targetPath).catch(() => undefined);

        if (stats?.isSymbolicLink() === true || stats?.isFile() !== true) {
          return err(
            createError(
              "task_execution_policy_approval_unsafe_target",
              "Persisted task execution policy approval target is not a safe file path.",
              "permission",
            ),
          );
        }

        const existingResult = await readExistingApproval(targetPath);

        if (!existingResult.ok) {
          return existingResult;
        }

        if (
          existingResult.value === undefined ||
          !sameApprovalAuthority({
            expected: approvalValidation.value,
            existing: existingResult.value,
          })
        ) {
          return err(
            createError(
              "task_execution_policy_approval_authority_conflict",
              "Persisted task execution policy approval already exists for this exact context with different authority.",
              "conflict",
            ),
          );
        }

        return ok({
          status: "already_exists",
          approval: existingResult.value,
          path: targetPath,
        });
      }

      throw error;
    }

    return ok({
      status: "created",
      approval: approvalValidation.value,
      path: targetPath,
    });
  } finally {
    if (fileHandle !== undefined) {
      await fileHandle.close().catch(() => undefined);
    }

    await unlink(tempPath).catch(() => undefined);
  }
}

export async function loadTaskExecutionPolicyApproval(
  input: LoadTaskExecutionPolicyApprovalInput,
): Promise<
  Result<
    TaskExecutionPolicyApprovalPersistenceResult,
    TaskExecutionPolicyApprovalPersistenceError
  >
> {
  const pathResult = getTaskExecutionPolicyApprovalStoragePath(input);

  if (!pathResult.ok) {
    return pathResult;
  }

  const rootResult = await ensureApprovalRoot({
    projectRoot: input.projectRoot,
    taskId: input.taskId,
    create: false,
  });

  if (!rootResult.ok) {
    return rootResult;
  }

  const targetPath = join(rootResult.value, `${input.approvalId}.json`);
  const existingResult = await readExistingApproval(targetPath);

  if (!existingResult.ok) {
    return existingResult;
  }

  if (existingResult.value === undefined) {
    return err(
      createError(
        "task_execution_policy_approval_not_found",
        "Persisted task execution policy approval was not found.",
        "not_found",
      ),
    );
  }

  if (
    existingResult.value.taskId !== input.taskId ||
    existingResult.value.approvalId !== input.approvalId
  ) {
    return err(
      createError(
        "task_execution_policy_approval_identity_mismatch",
        "Persisted task execution policy approval identity did not match the requested identity.",
        "validation",
      ),
    );
  }

  return ok({
    approval: existingResult.value,
    path: targetPath,
  });
}

export async function loadTaskExecutionPolicyApprovalForContext(
  input: LoadTaskExecutionPolicyApprovalForContextInput,
): Promise<
  Result<
    TaskExecutionPolicyApprovalProofLoadResult,
    TaskExecutionPolicyApprovalPersistenceError
  >
> {
  const approvalIdResult = deriveTaskExecutionPolicyApprovalId(input.binding);

  if (!approvalIdResult.ok) {
    return approvalIdResult;
  }

  const approvalResult = await loadTaskExecutionPolicyApproval({
    projectRoot: input.projectRoot,
    taskId: input.binding.taskId,
    approvalId: approvalIdResult.value,
  });

  if (!approvalResult.ok) {
    return approvalResult;
  }

  if (
    !taskExecutionPolicyApprovalMatchesBinding({
      approval: approvalResult.value.approval,
      binding: input.binding,
    })
  ) {
    return err(
      createError(
        "task_execution_policy_approval_binding_mismatch",
        "Persisted task execution policy approval does not match the exact requested execution context.",
        "policy",
      ),
    );
  }

  const proofResult = createTaskExecutionPolicyAuthorizationProofFromApproval({
    approval: approvalResult.value.approval,
  });

  if (!proofResult.ok) {
    return proofResult;
  }

  return ok({
    approval: approvalResult.value.approval,
    proof: proofResult.value,
    status: sanitizeTaskExecutionPolicyApprovalRecord({
      approval: approvalResult.value.approval,
      now: input.now,
    }),
    path: approvalResult.value.path,
  });
}
