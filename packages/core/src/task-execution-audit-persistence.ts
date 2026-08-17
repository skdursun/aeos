import {
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  unlink,
// @ts-expect-error Node built-ins are available at runtime; this package does not depend on Node ambient types yet.
} from "node:fs/promises";
// @ts-expect-error Node built-ins are available at runtime; this package does not depend on Node ambient types yet.
import { randomUUID } from "node:crypto";
// @ts-expect-error Node built-ins are available at runtime; this package does not depend on Node ambient types yet.
import { isAbsolute, join, relative, resolve } from "node:path";

import type { AgenticTaskId } from "./agentic-lifecycle.js";
import type {
  TaskExecutionAuditEvent,
  TaskExecutionAuditEventDraft,
  TaskExecutionAuditIssue,
} from "./task-execution-audit.js";
import {
  AEOS_TASK_EXECUTION_AUDIT_SCHEMA_VERSION,
  canonicalTaskExecutionAuditJson,
  computeTaskExecutionAuditEventDigest,
  isTaskExecutionAuditEvent,
} from "./task-execution-audit.js";
import type { AeosError, JsonObject, JsonValue, Result } from "./types.js";

export const AEOS_TASK_EXECUTION_AUDIT_ROOT_RELATIVE_PATH =
  ".aeos/state/audit";

export interface TaskExecutionAuditStorageInput {
  readonly projectRoot: string;
  readonly taskId: AgenticTaskId;
}

export interface TaskExecutionAuditStoragePath {
  readonly stateRoot: string;
  readonly taskAuditRoot: string;
}

export interface AppendTaskExecutionAuditEventInput
  extends TaskExecutionAuditStorageInput {
  readonly event: TaskExecutionAuditEventDraft;
  readonly forbiddenValues?: readonly string[];
}

export interface AppendTaskExecutionAuditEventSuccess {
  readonly event: TaskExecutionAuditEvent;
  readonly path: string;
  readonly status: "appended";
}

export interface LoadTaskExecutionAuditEventsResult {
  readonly taskId: AgenticTaskId;
  readonly events: readonly TaskExecutionAuditEvent[];
  readonly path: string | null;
}

export interface TaskExecutionAuditVerificationResult {
  readonly ok: boolean;
  readonly verified: boolean;
  readonly taskId: AgenticTaskId;
  readonly eventCount: number;
  readonly events: readonly TaskExecutionAuditEvent[];
  readonly issues: readonly TaskExecutionAuditIssue[];
}

export type TaskExecutionAuditPersistenceError = AeosError;

const safeIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/;
const forbiddenKeyNames = new Set([
  "apikey",
  "accesskey",
  "accesstoken",
  "refreshtoken",
  "token",
  "ownershiptoken",
  "locktoken",
  "capabilitytoken",
  "password",
  "authorization",
  "privatekey",
  "rawcredential",
  "rawcredentialmaterial",
  "rawsecret",
  "secretvalue",
]);

function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

function err(error: TaskExecutionAuditPersistenceError): Result<never, TaskExecutionAuditPersistenceError> {
  return { ok: false, error };
}

function createError(
  code: string,
  message: string,
  category: AeosError["category"],
  details?: JsonObject,
): TaskExecutionAuditPersistenceError {
  return {
    code,
    message,
    category,
    retryable: false,
    details,
  };
}

function issueFromError(error: AeosError): TaskExecutionAuditIssue {
  return {
    code: error.code,
    message: error.message,
    severity: "error",
    category: error.category,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
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

function canonicalKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function containsForbiddenSecretShape(input: {
  readonly value: unknown;
  readonly forbiddenValues: readonly string[];
}): boolean {
  const value = input.value;

  if (typeof value === "string") {
    return input.forbiddenValues.some(
      (forbidden) => forbidden.length > 0 && value.includes(forbidden),
    );
  }

  if (Array.isArray(value)) {
    return value.some((item) =>
      containsForbiddenSecretShape({
        value: item,
        forbiddenValues: input.forbiddenValues,
      }),
    );
  }

  if (!isRecord(value)) {
    return false;
  }

  return Object.entries(value).some(
    ([key, item]) =>
      forbiddenKeyNames.has(canonicalKey(key)) ||
      containsForbiddenSecretShape({
        value: item,
        forbiddenValues: input.forbiddenValues,
      }),
  );
}

function jsonContent(value: TaskExecutionAuditEvent): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function eventFileName(event: TaskExecutionAuditEvent): string {
  return `${String(event.sequence).padStart(12, "0")}-${event.auditEventId}.json`;
}

function eventPath(root: string, event: TaskExecutionAuditEvent): string {
  return join(root, eventFileName(event));
}

function parseSequenceFromFileName(fileName: string): number | null {
  const match = /^([0-9]{12})-([A-Za-z0-9._:-]+)\.json$/.exec(fileName);

  if (match === null) {
    return null;
  }

  const sequence = Number.parseInt(match[1]!, 10);

  return Number.isSafeInteger(sequence) && sequence > 0 ? sequence : null;
}

function validateSafeTaskId(taskId: string): Result<string, TaskExecutionAuditPersistenceError> {
  if (!isSafeId(taskId)) {
    return err(
      createError(
        "task_execution_audit_unsafe_task_id",
        "Task execution audit task id is not safe for persisted storage.",
        "validation",
      ),
    );
  }

  return ok(taskId);
}

export function getTaskExecutionAuditStoragePath(
  input: TaskExecutionAuditStorageInput,
): Result<TaskExecutionAuditStoragePath, TaskExecutionAuditPersistenceError> {
  const taskIdResult = validateSafeTaskId(input.taskId);

  if (!taskIdResult.ok) {
    return taskIdResult;
  }

  const projectRoot = resolve(input.projectRoot);
  const stateRoot = resolve(projectRoot, AEOS_TASK_EXECUTION_AUDIT_ROOT_RELATIVE_PATH);
  const taskAuditRoot = resolve(stateRoot, taskIdResult.value);

  if (
    !isInsideOrEqual(projectRoot, stateRoot) ||
    !isInsideOrEqual(stateRoot, taskAuditRoot)
  ) {
    return err(
      createError(
        "task_execution_audit_path_outside_root",
        "Task execution audit storage path escaped the AEOS audit state root.",
        "permission",
      ),
    );
  }

  return ok({ stateRoot, taskAuditRoot });
}

async function ensureAuditRoot(input: {
  readonly projectRoot: string;
  readonly taskId: AgenticTaskId;
  readonly create: boolean;
}): Promise<Result<string | null, TaskExecutionAuditPersistenceError>> {
  let projectRootRealPath: string;

  try {
    projectRootRealPath = await realpath(resolve(input.projectRoot));
  } catch {
    return err(
      createError(
        "task_execution_audit_project_root_missing",
        "Task execution audit project root was not found.",
        "not_found",
      ),
    );
  }

  const segments = [
    ...AEOS_TASK_EXECUTION_AUDIT_ROOT_RELATIVE_PATH.split("/"),
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
            "task_execution_audit_unsafe_state_root",
            "AEOS task execution audit root contains an unsafe symlink or non-directory path.",
            "permission",
          ),
        );
      }

      const currentRealPath = await realpath(currentPath);

      if (!isInsideOrEqual(projectRootRealPath, currentRealPath)) {
        return err(
          createError(
            "task_execution_audit_state_root_escape",
            "AEOS task execution audit root resolves outside the project root.",
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
          return ok(null);
        }

        break;
      }

      throw error;
    }
  }

  const taskAuditRoot = join(
    projectRootRealPath,
    AEOS_TASK_EXECUTION_AUDIT_ROOT_RELATIVE_PATH,
    input.taskId,
  );

  if (input.create) {
    await mkdir(taskAuditRoot, { recursive: true });
  }

  const rootStats = await lstat(taskAuditRoot);

  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
    return err(
      createError(
        "task_execution_audit_unsafe_state_root",
        "AEOS task execution audit root is not a safe directory.",
        "permission",
      ),
    );
  }

  const rootRealPath = await realpath(taskAuditRoot);

  if (!isInsideOrEqual(projectRootRealPath, rootRealPath)) {
    return err(
      createError(
        "task_execution_audit_state_root_escape",
        "AEOS task execution audit root resolves outside the project root.",
        "permission",
      ),
    );
  }

  return ok(rootRealPath);
}

async function ensureAuditLockRoot(input: {
  readonly projectRoot: string;
  readonly taskId: AgenticTaskId;
}): Promise<Result<string, TaskExecutionAuditPersistenceError>> {
  let projectRootRealPath: string;

  try {
    projectRootRealPath = await realpath(resolve(input.projectRoot));
  } catch {
    return err(
      createError(
        "task_execution_audit_project_root_missing",
        "Task execution audit project root was not found.",
        "not_found",
      ),
    );
  }

  const lockRoot = join(
    projectRootRealPath,
    AEOS_TASK_EXECUTION_AUDIT_ROOT_RELATIVE_PATH,
    ".locks",
    input.taskId,
  );
  const segments = [
    ...AEOS_TASK_EXECUTION_AUDIT_ROOT_RELATIVE_PATH.split("/"),
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
            "task_execution_audit_unsafe_lock_root",
            "AEOS task execution audit lock root contains an unsafe symlink or non-directory path.",
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
        "task_execution_audit_unsafe_lock_root",
        "AEOS task execution audit lock root is not a safe directory.",
        "permission",
      ),
    );
  }

  const lockRootRealPath = await realpath(lockRoot);

  if (!isInsideOrEqual(projectRootRealPath, lockRootRealPath)) {
    return err(
      createError(
        "task_execution_audit_lock_root_escape",
        "AEOS task execution audit lock root resolves outside the project root.",
        "permission",
      ),
    );
  }

  return ok(lockRootRealPath);
}

function validateEventSchema(
  value: unknown,
): Result<TaskExecutionAuditEvent, TaskExecutionAuditPersistenceError> {
  if (!isTaskExecutionAuditEvent(value)) {
    return err(
      createError(
        "task_execution_audit_event_schema_invalid",
        "Persisted task execution audit event schema is invalid.",
        "validation",
      ),
    );
  }

  if (
    value.schemaVersion !== AEOS_TASK_EXECUTION_AUDIT_SCHEMA_VERSION ||
    value.taskId !== value.binding.taskId ||
    value.taskStateRevision !== value.binding.taskStateRevision ||
    value.attemptId !== value.binding.attemptId ||
    value.invocationId !== value.binding.invocationId
  ) {
    return err(
      createError(
        "task_execution_audit_event_binding_mismatch",
        "Persisted task execution audit event does not match its authoritative binding.",
        "validation",
      ),
    );
  }

  if (
    containsForbiddenSecretShape({
      value,
      forbiddenValues: [],
    })
  ) {
    return err(
      createError(
        "task_execution_audit_forbidden_secret_shape",
        "Task execution audit event contains forbidden secret or capability-token fields.",
        "validation",
      ),
    );
  }

  return ok(value);
}

async function readEventFile(
  path: string,
): Promise<Result<TaskExecutionAuditEvent, TaskExecutionAuditPersistenceError>> {
  const stats = await lstat(path);

  if (stats.isSymbolicLink() || !stats.isFile()) {
    return err(
      createError(
        "task_execution_audit_unsafe_event_target",
        "Persisted task execution audit event target is not a safe file path.",
        "permission",
      ),
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
  } catch {
    return err(
      createError(
        "task_execution_audit_corrupt_json",
        "Persisted task execution audit event JSON is corrupt and cannot be trusted.",
        "validation",
      ),
    );
  }

  return validateEventSchema(parsed);
}

async function readEventsFromRoot(input: {
  readonly taskId: AgenticTaskId;
  readonly root: string | null;
}): Promise<Result<readonly TaskExecutionAuditEvent[], TaskExecutionAuditPersistenceError>> {
  if (input.root === null) {
    return ok([]);
  }

  const dirents = await readdir(input.root, { withFileTypes: true });
  const files: { readonly name: string; readonly sequence: number }[] = [];

  for (const dirent of dirents) {
    if (dirent.name.startsWith(".tmp-")) {
      continue;
    }

    if (dirent.isSymbolicLink() || !dirent.isFile()) {
      return err(
        createError(
          "task_execution_audit_unsafe_event_target",
          "Task execution audit root contains an unsafe event target.",
          "permission",
        ),
      );
    }

    const sequence = parseSequenceFromFileName(dirent.name);

    if (sequence === null) {
      return err(
        createError(
          "task_execution_audit_event_filename_invalid",
          "Task execution audit event filename does not encode an authoritative sequence.",
          "validation",
        ),
      );
    }

    files.push({ name: dirent.name, sequence });
  }

  const events: TaskExecutionAuditEvent[] = [];

  for (const file of files.sort((left, right) => left.sequence - right.sequence)) {
    const eventResult = await readEventFile(join(input.root, file.name));

    if (!eventResult.ok) {
      return eventResult;
    }

    if (eventResult.value.taskId !== input.taskId) {
      return err(
        createError(
          "task_execution_audit_task_id_mismatch",
          "Persisted task execution audit event task id does not match its storage root.",
          "validation",
        ),
      );
    }

    if (eventResult.value.sequence !== file.sequence) {
      return err(
        createError(
          "task_execution_audit_filename_sequence_mismatch",
          "Persisted task execution audit event sequence does not match its filename.",
          "validation",
        ),
      );
    }

    if (eventFileName(eventResult.value) !== file.name) {
      return err(
        createError(
          "task_execution_audit_filename_identity_mismatch",
          "Persisted task execution audit event identity does not match its filename.",
          "validation",
        ),
      );
    }

    events.push(eventResult.value);
  }

  return ok(events);
}

function verifyEventChain(
  events: readonly TaskExecutionAuditEvent[],
): readonly TaskExecutionAuditIssue[] {
  const issues: TaskExecutionAuditIssue[] = [];
  const seenSequences = new Set<number>();
  const seenEventIds = new Set<string>();
  let previousDigest: string | null = null;

  for (const [index, event] of events.entries()) {
    const expectedSequence = index + 1;

    if (event.sequence !== expectedSequence) {
      issues.push({
        code: "task_execution_audit_sequence_gap_or_reorder",
        message:
          "Task execution audit event sequence must be contiguous and sorted from one.",
        severity: "error",
        category: "validation",
      });
    }

    if (seenSequences.has(event.sequence)) {
      issues.push({
        code: "task_execution_audit_duplicate_sequence",
        message: "Task execution audit contains a duplicate sequence.",
        severity: "error",
        category: "validation",
      });
    }

    if (seenEventIds.has(event.auditEventId)) {
      issues.push({
        code: "task_execution_audit_duplicate_event_id",
        message: "Task execution audit contains a duplicate event identity.",
        severity: "error",
        category: "conflict",
      });
    }

    if (event.previousEventDigest !== previousDigest) {
      issues.push({
        code: "task_execution_audit_previous_digest_mismatch",
        message: "Task execution audit previous digest pointer is invalid.",
        severity: "error",
        category: "validation",
      });
    }

    const expectedDigest = computeTaskExecutionAuditEventDigest(event);

    if (event.eventDigest !== expectedDigest) {
      issues.push({
        code: "task_execution_audit_event_digest_mismatch",
        message: "Task execution audit event digest does not match event content.",
        severity: "error",
        category: "validation",
      });
    }

    seenSequences.add(event.sequence);
    seenEventIds.add(event.auditEventId);
    previousDigest = event.eventDigest;
  }

  return issues;
}

function sequencedEvent(input: {
  readonly draft: TaskExecutionAuditEventDraft;
  readonly sequence: number;
  readonly previousEventDigest: string | null;
}): TaskExecutionAuditEvent {
  const eventWithoutDigest = {
    ...input.draft,
    recordedAt: new Date().toISOString(),
    sequence: input.sequence,
    previousEventDigest: input.previousEventDigest,
    eventDigest: "",
  } satisfies TaskExecutionAuditEvent;

  return {
    ...eventWithoutDigest,
    eventDigest: computeTaskExecutionAuditEventDigest(eventWithoutDigest),
  };
}

export async function loadTaskExecutionAuditEvents(
  input: TaskExecutionAuditStorageInput,
): Promise<Result<LoadTaskExecutionAuditEventsResult, TaskExecutionAuditPersistenceError>> {
  const taskIdResult = validateSafeTaskId(input.taskId);

  if (!taskIdResult.ok) {
    return taskIdResult;
  }

  const rootResult = await ensureAuditRoot({
    projectRoot: input.projectRoot,
    taskId: input.taskId,
    create: false,
  });

  if (!rootResult.ok) {
    return rootResult;
  }

  const eventsResult = await readEventsFromRoot({
    taskId: input.taskId,
    root: rootResult.value,
  });

  if (!eventsResult.ok) {
    return eventsResult;
  }

  return ok({
    taskId: input.taskId,
    events: eventsResult.value,
    path: rootResult.value,
  });
}

export async function verifyTaskExecutionAuditChain(
  input: TaskExecutionAuditStorageInput,
): Promise<TaskExecutionAuditVerificationResult> {
  const loadResult = await loadTaskExecutionAuditEvents(input);

  if (!loadResult.ok) {
    return {
      ok: false,
      verified: false,
      taskId: input.taskId,
      eventCount: 0,
      events: [],
      issues: [issueFromError(loadResult.error)],
    };
  }

  const issues = verifyEventChain(loadResult.value.events);

  return {
    ok: issues.length === 0,
    verified: issues.length === 0,
    taskId: input.taskId,
    eventCount: loadResult.value.events.length,
    events: loadResult.value.events,
    issues,
  };
}

export async function appendTaskExecutionAuditEvent(
  input: AppendTaskExecutionAuditEventInput,
): Promise<Result<AppendTaskExecutionAuditEventSuccess, TaskExecutionAuditPersistenceError>> {
  const taskIdResult = validateSafeTaskId(input.taskId);

  if (!taskIdResult.ok) {
    return taskIdResult;
  }

  if (input.event.taskId !== input.taskId) {
    return err(
      createError(
        "task_execution_audit_append_task_mismatch",
        "Task execution audit event task id does not match the target audit root.",
        "validation",
      ),
    );
  }

  if (
    containsForbiddenSecretShape({
      value: input.event,
      forbiddenValues: input.forbiddenValues ?? [],
    })
  ) {
    return err(
      createError(
        "task_execution_audit_secret_or_capability_rejected",
        "Task execution audit event contains a forbidden secret value or capability token.",
        "validation",
      ),
    );
  }

  const rootResult = await ensureAuditRoot({
    projectRoot: input.projectRoot,
    taskId: input.taskId,
    create: true,
  });

  if (!rootResult.ok) {
    return rootResult;
  }

  const lockRootResult = await ensureAuditLockRoot({
    projectRoot: input.projectRoot,
    taskId: input.taskId,
  });

  if (!lockRootResult.ok) {
    return lockRootResult;
  }

  const lockPath = join(lockRootResult.value, "append.lock");

  if (!isInsideOrEqual(lockRootResult.value, lockPath)) {
    return err(
      createError(
        "task_execution_audit_lock_path_outside_root",
        "Task execution audit lock path escaped the AEOS audit lock root.",
        "permission",
      ),
    );
  }

  let lockHandle: Awaited<ReturnType<typeof open>> | undefined;
  // Only the caller that created this lock file may remove it (GitHub #77).  An
  // unconditional unlink here had the caller that LOST the open("wx") race delete
  // the winner's lock mid-update, letting a third caller into the same critical
  // section; both would pass the revision guard and both return ok, each
  // believing it owned the transition.
  //
  // The flag is set immediately after open() returns, NOT after the write
  // completes: if writeFile or sync throws, the lock file still exists on disk and
  // this caller is the right agent to clean it up.  Gating on "fully written"
  // instead would trade the race for a permanently orphaned lock — a wedged
  // record needing manual intervention, which is worse than the original defect.
  let lockFileOpenedByThisCaller = false;

  try {
    try {
      lockHandle = await open(lockPath, "wx");
      lockFileOpenedByThisCaller = true;
      await lockHandle.writeFile(
        `${JSON.stringify({
          taskId: input.taskId,
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
        const stats = await lstat(lockPath).catch(() => undefined);

        if (stats?.isSymbolicLink() === true) {
          return err(
            createError(
              "task_execution_audit_unsafe_lock_target",
              "Task execution audit append lock target is unsafe.",
              "permission",
            ),
          );
        }

        return err(
          createError(
            "task_execution_audit_append_locked",
            "Task execution audit is already locked for append by a cooperating writer.",
            "conflict",
          ),
        );
      }

      throw error;
    }

    const existingResult = await readEventsFromRoot({
      taskId: input.taskId,
      root: rootResult.value,
    });

    if (!existingResult.ok) {
      return existingResult;
    }

    const chainIssues = verifyEventChain(existingResult.value);

    if (chainIssues.length > 0) {
      return err(
        createError(
          "task_execution_audit_chain_invalid",
          "Existing task execution audit chain is invalid and blocks append.",
          "validation",
        ),
      );
    }

    if (
      existingResult.value.some(
        (event) => event.auditEventId === input.event.auditEventId,
      )
    ) {
      return err(
        createError(
          "task_execution_audit_duplicate_event",
          "Task execution audit event identity already exists and cannot be appended again.",
          "conflict",
        ),
      );
    }

    const previousEvent =
      existingResult.value.length === 0
        ? null
        : existingResult.value[existingResult.value.length - 1]!;
    const event = sequencedEvent({
      draft: input.event,
      sequence: existingResult.value.length + 1,
      previousEventDigest: previousEvent?.eventDigest ?? null,
    });
    const validationResult = validateEventSchema(event);

    if (!validationResult.ok) {
      return validationResult;
    }

    const targetPath = eventPath(rootResult.value!, event);
    const tempPath = join(
      rootResult.value!,
      `.tmp-${event.auditEventId}-${Date.now()}-${randomUUID()}`,
    );
    let fileHandle: Awaited<ReturnType<typeof open>> | undefined;

    try {
      const existingTarget = await lstat(targetPath).catch(() => undefined);

      if (existingTarget !== undefined) {
        return err(
          createError(
            "task_execution_audit_sequence_collision",
            "Task execution audit target sequence already exists.",
            "conflict",
          ),
        );
      }

      fileHandle = await open(tempPath, "wx");
      await fileHandle.writeFile(jsonContent(event), "utf8");
      await fileHandle.sync();
      await fileHandle.close();
      fileHandle = undefined;
      await rename(tempPath, targetPath);
    } catch (error) {
      if (fileHandle !== undefined) {
        await fileHandle.close().catch(() => undefined);
      }

      await unlink(tempPath).catch(() => undefined);
      throw error;
    }

    return ok({
      event,
      path: targetPath,
      status: "appended",
    });
  } finally {
    if (lockHandle !== undefined) {
      await lockHandle.close().catch(() => undefined);
    }

    if (lockFileOpenedByThisCaller) {
      await unlink(lockPath).catch(() => undefined);
    }
  }
}
