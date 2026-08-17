// @ts-expect-error Node built-ins are available at runtime; this package does not depend on Node ambient types yet.
import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  readFile,
  realpath,
  rename,
  writeFile,
// @ts-expect-error Node built-ins are available at runtime; this package does not depend on Node ambient types yet.
} from "node:fs/promises";
// @ts-expect-error Node built-ins are available at runtime; this package does not depend on Node ambient types yet.
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import type {
  AgenticTaskId,
  AgenticWorkBatchId,
  AgenticWorkItemId,
} from "./agentic-lifecycle.js";
import {
  createInitialTaskState,
  loadTaskState,
  saveTaskState,
  validatePersistedTaskState,
} from "./task-state-persistence.js";
import type { PersistedTaskState } from "./task-state-persistence.js";
import {
  prepareTaskExecutionAttempt,
  transitionTaskExecutionAttempt,
} from "./task-execution-attempt.js";
import type {
  TaskExecutionAttempt,
  TaskExecutionFailureCategory,
} from "./task-execution-attempt.js";
import {
  loadTaskExecutionAttempt,
  saveTaskExecutionAttempt,
} from "./task-execution-attempt-persistence.js";
import {
  loadTaskExecutionInvocation,
  reserveTaskExecutionInvocation,
  updateTaskExecutionInvocation,
} from "./task-execution-invocation-persistence.js";
import type {
  TaskExecutionInvocationLifecycle,
  TaskExecutionInvocationRecord,
} from "./task-execution-invocation-record.js";
import { AEOS_TASK_STATE_ROOT_RELATIVE_PATH } from "./task-state-persistence.js";
import { AEOS_TASK_EXECUTION_INVOCATION_ROOT_RELATIVE_PATH } from "./task-execution-invocation-persistence.js";
import { AEOS_TASK_EXECUTION_ATTEMPT_ROOT_RELATIVE_PATH } from "./task-execution-attempt-persistence.js";
import { AEOS_TASK_EXECUTION_AUDIT_ROOT_RELATIVE_PATH } from "./task-execution-audit-persistence.js";
import {
  AEOS_ITERATION_STEP_LOCK_ROOT_RELATIVE_PATH,
  AEOS_ITERATION_STEP_ROOT_RELATIVE_PATH,
} from "./task-execution-iteration-step.js";
import { isTaskExecutionInvocationReconciliationRequiredByLifecycle } from "./task-execution-invocation-reconciliation.js";
import {
  appendTaskExecutionAuditEvent,
} from "./task-execution-audit-persistence.js";
import {
  createTaskExecutionInvocationDispatchIntentAuditEvent,
} from "./task-execution-audit.js";
import type {
  TaskExecutionAuditEvent,
} from "./task-execution-audit.js";
import {
  evaluateTaskExecutionPermissionGate,
} from "./task-execution-permission-gate.js";
import type {
  TaskExecutionPermissionGatePolicyRequirement,
} from "./task-execution-permission-gate.js";
import type {
  TaskExecutionAdapterCapabilities,
  TaskExecutionAdapterIdentity,
  TaskExecutionAdapterPermissions,
} from "./task-execution-adapter.js";
import {
  authorizeTaskExecutionWorkerProcess,
  normalizeTaskExecutionCodexProcessResult,
  runTaskExecutionCodexExecContractPreflight,
  prepareTaskExecutionCodexWorkerInvocation,
} from "./task-execution-codex-worker.js";
import type {
  TaskExecutionCodexExecContractPreflightResult,
  TaskExecutionCodexProcessResult,
  TaskExecutionCodexWorkerConfiguration,
} from "./task-execution-codex-worker.js";
import {
  evaluateTaskExecutionClaudeCodeWorkerProcessGate,
  normalizeTaskExecutionClaudeCodeProcessResult,
  prepareTaskExecutionClaudeCodeWorkerInvocation,
} from "./task-execution-claude-code-worker.js";
import type {
  TaskExecutionClaudeCodeProcessResult,
  TaskExecutionClaudeCodeWorkerConfiguration,
} from "./task-execution-claude-code-worker.js";
import {
  executeTaskExecutionLocalWorkerProcess,
} from "./task-execution-local-worker-process.js";
import type {
  TaskExecutionLocalWorkerProcessEvidence,
  TaskExecutionLocalWorkerProcessAuthority,
  TaskExecutionLocalWorkerProcessRuntimeResult,
} from "./task-execution-local-worker-process.js";
import {
  authorizeTaskExecutionWorkerRoute,
} from "./task-execution-worker-routing.js";
import type {
  TaskExecutionWorkerRoutingCapability,
  TaskExecutionWorkerRoutingDecision,
  TaskExecutionWorkerRoutingProposal,
} from "./task-execution-worker-routing.js";
import type {
  TaskExecutionWorkerCapabilities,
  TaskExecutionWorkerIdentity,
  TaskExecutionWorkerIssue,
  TaskExecutionWorkerPermissionFacts,
  TaskExecutionWorkerRequest,
  TaskExecutionWorkerResult,
  TaskExecutionWorkerWorkspaceReference,
} from "./task-execution-worker.js";
import {
  runTaskExecutionClaudeCodeAuthPreflight,
} from "./task-execution-claude-code-auth-preflight.js";
import type {
  TaskExecutionClaudeCodeAuthPreflightResult,
} from "./task-execution-claude-code-auth-preflight.js";
import {
  runTaskExecutionCodexAuthPreflight,
} from "./task-execution-codex-auth-preflight.js";
import type {
  TaskExecutionCodexAuthPreflightResult,
} from "./task-execution-codex-auth-preflight.js";
import type { AeosError, JsonValue } from "./types.js";

export const TASK_EXECUTION_TWO_MODEL_CANARY_SCHEMA_VERSION = 1;
export const TASK_EXECUTION_TWO_MODEL_CANARY_TASK_ID =
  "TASK-0324-real-two-model-canary";
export const TASK_EXECUTION_TWO_MODEL_CANARY_WORK_ITEM_ID =
  "task-0324-read-only-route";
export const TASK_EXECUTION_TWO_MODEL_CANARY_BATCH_ID =
  "task-0324-one-hop-batch";
export const TASK_EXECUTION_TWO_MODEL_CANARY_ORCHESTRATION_ID =
  "task-0324-codex-to-claude-read-only-canary";
export const TASK_EXECUTION_TWO_MODEL_CANARY_READY = true;
export const TASK_EXECUTION_REAL_CODEX_PLANNER_CANARY_READY = true;
export const TASK_EXECUTION_REAL_CLAUDE_ROUTED_WORKER_CANARY_READY = true;
export const TASK_EXECUTION_TWO_MODEL_CANARY_EXECUTED = false;
export const TASK_EXECUTION_TWO_MODEL_CANARY_REAL_CODEX_CALLS = 0;
export const TASK_EXECUTION_TWO_MODEL_CANARY_REAL_CLAUDE_CALLS = 0;
export const TASK_EXECUTION_TWO_MODEL_CANARY_PRIMARY_APPLIES = 0;
export const TASK_EXECUTION_TWO_MODEL_CANARY_CLOUD_CALLS = 0;

export type TaskExecutionTwoModelCanaryLifecycle =
  | "prepared"
  | "planner_failed"
  | "route_blocked"
  | "worker_failed"
  | "worker_returned"
  | "outcome_unknown";

export interface TaskExecutionTwoModelCanaryRecord {
  readonly schemaVersion: typeof TASK_EXECUTION_TWO_MODEL_CANARY_SCHEMA_VERSION;
  readonly orchestrationId: string;
  readonly taskId: AgenticTaskId;
  readonly taskRevision: number;
  readonly workItemId: AgenticWorkItemId;
  readonly batchId: AgenticWorkBatchId;
  readonly plannerAttemptId: string;
  readonly plannerInvocationId: string;
  readonly plannerInvocationRevision: number;
  readonly workerAttemptId: string;
  readonly workerInvocationId: string;
  readonly workerInvocationRevision: number;
  readonly routeDecisionId: string | null;
  readonly routeDecisionStatus: "authorized" | "blocked" | "not_run";
  readonly selectedWorkerFamily: "claude_code" | null;
  readonly lifecycle: TaskExecutionTwoModelCanaryLifecycle;
  readonly realCodexPlannerExecuted: boolean;
  readonly realClaudeRoutedWorkerExecuted: boolean;
  readonly realTwoModelCanaryExecuted: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly issues: readonly TaskExecutionWorkerIssue[];
  readonly safety: {
    readonly repositoryWriteAllowed: false;
    readonly shellAllowed: false;
    readonly primaryApplyAllowed: false;
    readonly automaticLoopEnabled: false;
    readonly completionAuthority: false;
    readonly verifierRun: false;
    readonly taskCompleted: false;
    readonly workCompleted: false;
    readonly codexLaunchesClaude: false;
  };
}

export interface TaskExecutionTwoModelCanaryPrepareResult {
  readonly ok: boolean;
  readonly status: "prepared" | "already_prepared" | "blocked";
  readonly taskState: PersistedTaskState | null;
  readonly plannerAttempt: TaskExecutionAttempt | null;
  readonly plannerInvocation: TaskExecutionInvocationRecord | null;
  readonly workerAttempt: TaskExecutionAttempt | null;
  readonly workerInvocation: TaskExecutionInvocationRecord | null;
  readonly orchestration: TaskExecutionTwoModelCanaryRecord | null;
  readonly issues: readonly TaskExecutionWorkerIssue[];
}

export interface TaskExecutionTwoModelCanaryInspectResult {
  readonly ok: boolean;
  readonly status: "inspected" | "not_found" | "blocked";
  readonly taskId: string | null;
  readonly taskRevision: number | null;
  readonly orchestrationId: string;
  readonly orchestrationLifecycle: TaskExecutionTwoModelCanaryLifecycle | null;
  readonly orchestrationPrepared: boolean | null;
  readonly orchestrationConsumed: boolean | null;
  readonly plannerInvocationId: string | null;
  readonly plannerLifecycle: TaskExecutionInvocationLifecycle | null;
  readonly plannerRevision: number | null;
  readonly plannerOneShotConsumed: boolean | null;
  readonly plannerOutcomePresent: boolean | null;
  readonly plannerReconciliationRequired: boolean | null;
  readonly workerInvocationId: string | null;
  readonly workerLifecycle: TaskExecutionInvocationLifecycle | null;
  readonly workerRevision: number | null;
  readonly workerOneShotConsumed: boolean | null;
  readonly workerOutcomePresent: boolean | null;
  readonly workerReconciliationRequired: boolean | null;
  readonly routePresent: boolean | null;
  readonly routeDecisionStatus: "authorized" | "blocked" | "not_run" | null;
  readonly selectedWorkerFamily: "claude_code" | null;
  readonly reconciliationRequired: boolean | null;
  readonly issues: readonly TaskExecutionWorkerIssue[];
}

export interface TaskExecutionTwoModelCanaryRunResult {
  readonly ok: boolean;
  readonly status:
    | "worker_returned"
    | "planner_failed"
    | "route_blocked"
    | "worker_failed"
    | "outcome_unknown"
    | "planner_outcome_persistence_failed"
    | "worker_outcome_persistence_failed"
    | "already_consumed"
    | "blocked";
  readonly orchestration: TaskExecutionTwoModelCanaryRecord | null;
  readonly plannerInvocation: TaskExecutionInvocationRecord | null;
  readonly workerInvocation: TaskExecutionInvocationRecord | null;
  readonly routeDecision: TaskExecutionWorkerRoutingDecision | null;
  readonly plannerResult: TaskExecutionWorkerResult | null;
  readonly workerResult: TaskExecutionWorkerResult | null;
  readonly plannerCalls: 0 | 1;
  readonly workerCalls: 0 | 1;
  readonly issues: readonly TaskExecutionWorkerIssue[];
  readonly safety: {
    readonly orchestrationPrepared: boolean;
    readonly orchestrationConsumed: boolean;
    readonly plannerAuthChecked: boolean;
    readonly plannerAuthReady: boolean;
    readonly plannerProcessOutcomeKnown: boolean;
    readonly plannerInvocationOutcomePersisted: boolean;
    readonly plannerReconciliationRequired: boolean;
    readonly plannerInvocationModified: boolean;
    readonly plannerOneShotConsumed: boolean;
    readonly realCodexProcessSpawned: boolean;
    readonly realCodexModelCall: boolean;
    readonly routeCreated: boolean;
    readonly realClaudeProcessSpawned: boolean;
    readonly realClaudeModelCall: boolean;
    readonly workerInvocationModified: boolean;
    readonly realCodexPlannerExecuted: boolean;
    readonly realClaudeRoutedWorkerExecuted: boolean;
    readonly repositoryWriteAllowed: false;
    readonly shellAllowed: false;
    readonly primaryApplyAllowed: false;
    readonly automaticLoopEnabled: false;
    readonly completionAuthority: false;
    readonly verifierRun: false;
    readonly taskCompleted: false;
    readonly workCompleted: false;
    readonly cloudCalls: 0;
  };
}

export interface TaskExecutionTwoModelCanaryRunner {
  readonly codexAuthPreflight?: () => Promise<TaskExecutionCodexAuthPreflightResult>;
  readonly codexExecContractPreflight?: () => Promise<TaskExecutionCodexExecContractPreflightResult>;
  readonly claudeAuthPreflight?: () => Promise<TaskExecutionClaudeCodeAuthPreflightResult>;
  readonly policyRequirement?: (input: {
    readonly phase: "planner" | "worker";
    readonly invocation: TaskExecutionInvocationRecord;
    readonly worker: TaskExecutionWorkerIdentity;
  }) => TaskExecutionPermissionGatePolicyRequirement;
  readonly codexProcess?: (
    request: TaskExecutionWorkerRequest,
  ) => Promise<TaskExecutionCodexProcessResult>;
  readonly claudeProcess?: (
    request: TaskExecutionWorkerRequest,
  ) => Promise<TaskExecutionClaudeCodeProcessResult>;
}

interface TaskExecutionTwoModelCanaryRefs {
  readonly taskId: AgenticTaskId;
  readonly orchestrationId: string;
  readonly workItemId: AgenticWorkItemId;
  readonly batchId: AgenticWorkBatchId;
}

const storageRootRelativePath = ".aeos/state/orchestration-canaries";
const trustedCodexExecutablePath = "/Users/magnero/.local/bin/codex";
const trustedCodexExecutableRef = "system:trusted-local-codex-exec";
const trustedClaudeCodeExecutablePath = "/Users/magnero/.local/bin/claude";
const trustedClaudeCodeExecutableRef =
  "system:trusted-local-claude-code-2.1.229";
const codexPlannerSchemaPath = resolve(
  dirname(new URL(import.meta.url).pathname),
  "../schemas/codex-planner-routing-proposal-v1.schema.json",
);

function defaultCanaryRefs(input?: {
  readonly taskId?: string;
  readonly orchestrationId?: string;
  readonly workItemId?: string;
  readonly batchId?: string;
}): TaskExecutionTwoModelCanaryRefs {
  return {
    taskId: input?.taskId ?? TASK_EXECUTION_TWO_MODEL_CANARY_TASK_ID,
    orchestrationId:
      input?.orchestrationId ?? TASK_EXECUTION_TWO_MODEL_CANARY_ORCHESTRATION_ID,
    workItemId: input?.workItemId ?? TASK_EXECUTION_TWO_MODEL_CANARY_WORK_ITEM_ID,
    batchId: input?.batchId ?? TASK_EXECUTION_TWO_MODEL_CANARY_BATCH_ID,
  };
}

const codexPlannerIdentity: TaskExecutionWorkerIdentity = {
  workerId: "system:codex-read-only-planner-canary",
  workerFamily: "codex",
  runtimeKind: "test_worker",
  implementationVersion: "task-0324",
  capabilityVersion: "codex-read-only-planner-canary-v1",
  identityAuthority: "system",
  selectionAuthority: "system",
};

const claudeWorkerIdentity: TaskExecutionWorkerIdentity = {
  workerId: "system:claude-code-read-only-canary",
  workerFamily: "claude_code",
  runtimeKind: "test_worker",
  implementationVersion: "task-0317",
  capabilityVersion: "claude-code-read-only-canary-v1",
  identityAuthority: "system",
  selectionAuthority: "system",
};

const plannerCapabilities: TaskExecutionWorkerCapabilities = {
  roles: ["planner"],
  repositoryRead: true,
  repositoryWrite: false,
  processExecution: false,
  shellExecution: false,
  toolExecution: false,
  modelReasoning: true,
  patchGeneration: false,
  testExecution: false,
  boundedDiagnostics: true,
  deterministicTestResult: true,
};

const claudeCapabilities: TaskExecutionWorkerCapabilities = {
  roles: ["implementation"],
  repositoryRead: true,
  repositoryWrite: false,
  processExecution: false,
  shellExecution: false,
  toolExecution: false,
  modelReasoning: true,
  patchGeneration: false,
  testExecution: false,
  boundedDiagnostics: true,
  deterministicTestResult: true,
};

const workspace: TaskExecutionWorkerWorkspaceReference = {
  authority: "system",
  workspaceRef: "workspace:pro-performans",
  projectRef: "project:pro-performans",
  repositoryRef: "repository:pro-performans",
  allowedPathRefs: ["src:task-execution-two-model-canary"],
  repositoryWriteAllowed: false,
};

const adapterCapabilities: TaskExecutionAdapterCapabilities = {
  providesDeterministicProviderInvocationReference: false,
  supportsIdempotencyKey: true,
  supportsLookupByIdempotencyKey: false,
  supportsInvocationStatusQuery: false,
  supportsResultReplay: false,
  supportsCancellation: false,
  supportsStreaming: false,
  supportsToolCalls: false,
  supportsNetworkAccess: false,
  supportsFilesystemAccess: false,
  supportsProcessExecution: true,
  supportsShellExecution: false,
  supportsModelInvocation: true,
  supportsExternalSideEffects: false,
  supportsBoundedErrors: true,
};

const adapterPermissions: TaskExecutionAdapterPermissions = {
  permissionAuthority: "system",
  policyRequired: false,
  policyAuthorized: false,
  externalSideEffectPermission: false,
  networkPermission: false,
  filesystemPermission: false,
  processPermission: true,
  shellPermission: false,
  toolCallPermission: false,
  modelInvocationPermission: false,
};

const safety = {
  repositoryWriteAllowed: false,
  shellAllowed: false,
  primaryApplyAllowed: false,
  automaticLoopEnabled: false,
  completionAuthority: false,
  verifierRun: false,
  taskCompleted: false,
  workCompleted: false,
  codexLaunchesClaude: false,
} as const;

function issue(input: {
  readonly code: string;
  readonly message: string;
  readonly severity?: "info" | "warning" | "error";
  readonly category?: AeosError["category"];
}): TaskExecutionWorkerIssue {
  return {
    code: input.code,
    message: input.message,
    severity: input.severity ?? "error",
    category: input.category ?? "validation",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value === value.trim() &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/.test(value) &&
    value !== "." &&
    value !== ".." &&
    !value.includes("/") &&
    !value.includes("\\")
  );
}

function isInsideOrEqual(parentPath: string, childPath: string): boolean {
  const relativePath = relative(parentPath, childPath);

  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !isAbsolute(relativePath))
  );
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function createErrorIssue(error: AeosError): TaskExecutionWorkerIssue {
  return issue({
    code: error.code,
    message: error.message,
    category: error.category,
  });
}

async function storagePath(input: {
  readonly projectRoot: string;
  readonly taskId: string;
  readonly orchestrationId: string;
}): Promise<
  | { readonly ok: true; readonly path: string; readonly root: string }
  | { readonly ok: false; readonly issue: TaskExecutionWorkerIssue }
> {
  if (!isSafeId(input.taskId) || !isSafeId(input.orchestrationId)) {
    return {
      ok: false,
      issue: issue({
        code: "task_execution_two_model_canary_storage_id_invalid",
        message: "Two-model canary storage ids must be safe system identifiers.",
      }),
    };
  }

  const projectRoot = await realpath(resolve(input.projectRoot)).catch(
    () => null,
  );
  if (projectRoot === null) {
    return {
      ok: false,
      issue: issue({
        code: "task_execution_two_model_canary_project_root_missing",
        message: "Two-model canary project root was not found.",
        category: "not_found",
      }),
    };
  }

  const root = resolve(projectRoot, storageRootRelativePath, input.taskId);
  const path = resolve(root, `${input.orchestrationId}.json`);
  if (!isInsideOrEqual(projectRoot, root) || !isInsideOrEqual(root, path)) {
    return {
      ok: false,
      issue: issue({
        code: "task_execution_two_model_canary_storage_escape",
        message: "Two-model canary storage path escaped AEOS state root.",
        category: "permission",
      }),
    };
  }

  return { ok: true, root, path };
}

async function saveCanaryRecord(input: {
  readonly projectRoot: string;
  readonly record: TaskExecutionTwoModelCanaryRecord;
}): Promise<
  | { readonly ok: true; readonly record: TaskExecutionTwoModelCanaryRecord; readonly path: string }
  | { readonly ok: false; readonly issue: TaskExecutionWorkerIssue }
> {
  const pathResult = await storagePath({
    projectRoot: input.projectRoot,
    taskId: input.record.taskId,
    orchestrationId: input.record.orchestrationId,
  });
  if (!pathResult.ok) {
    return pathResult;
  }

  await mkdir(pathResult.root, { recursive: true });
  const tempPath = `${pathResult.path}.tmp-${sha256(JSON.stringify(input.record)).slice(0, 12)}`;
  await writeFile(tempPath, `${JSON.stringify(input.record, null, 2)}\n`, {
    flag: "wx",
  });
  await rename(tempPath, pathResult.path);

  return { ok: true, record: input.record, path: pathResult.path };
}

export async function loadTaskExecutionTwoModelCanaryRecord(input: {
  readonly projectRoot: string;
  readonly taskId: string;
  readonly orchestrationId: string;
}): Promise<
  | { readonly ok: true; readonly record: TaskExecutionTwoModelCanaryRecord; readonly path: string }
  | { readonly ok: false; readonly issue: TaskExecutionWorkerIssue }
> {
  const pathResult = await storagePath(input);
  if (!pathResult.ok) {
    return pathResult;
  }

  try {
    const stats = await lstat(pathResult.path);
    if (stats.isSymbolicLink() || !stats.isFile()) {
      return {
        ok: false,
        issue: issue({
          code: "task_execution_two_model_canary_record_unsafe",
          message: "Two-model canary record path is not a safe file.",
          category: "permission",
        }),
      };
    }
    const parsed = JSON.parse(await readFile(pathResult.path, "utf8")) as unknown;
    if (
      !isRecord(parsed) ||
      parsed.schemaVersion !== TASK_EXECUTION_TWO_MODEL_CANARY_SCHEMA_VERSION ||
      parsed.orchestrationId !== input.orchestrationId ||
      parsed.taskId !== input.taskId
    ) {
      return {
        ok: false,
        issue: issue({
          code: "task_execution_two_model_canary_record_invalid",
          message: "Two-model canary record is not bound to requested authority.",
        }),
      };
    }
    return {
      ok: true,
      record: parsed as unknown as TaskExecutionTwoModelCanaryRecord,
      path: pathResult.path,
    };
  } catch {
    return {
      ok: false,
      issue: issue({
        code: "task_execution_two_model_canary_record_not_found",
        message: "Two-model canary record was not found.",
        category: "not_found",
      }),
    };
  }
}

type PathProbeResult =
  | { readonly kind: "exists" }
  | { readonly kind: "absent" }
  | { readonly kind: "error"; readonly errno: string };

// Probes whether a filesystem path exists without masking non-ENOENT errors.
// ENOENT and ENOTDIR both mean "genuinely absent" (the latter arises when an
// ancestor component is a non-directory — also a proof of absence). Any other
// error (EACCES, EIO, etc.) means the probe could not determine existence and
// must fail closed: the caller must treat it as unverifiable rather than absent.
async function probePath(path: string): Promise<PathProbeResult> {
  try {
    await lstat(path);
    return { kind: "exists" };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      return { kind: "absent" };
    }
    return { kind: "error", errno: code ?? "UNKNOWN" };
  }
}

/**
 * Verifies that a two-model canary identity (taskId) has never produced any
 * durable artifact anywhere under .aeos/state/. This is a read-only probe: it
 * never creates, mutates, or deletes anything. It exists to fail closed
 * against silent identity reuse (see
 * task_execution_two_model_canary_identity_not_fresh below).
 */
async function findIdentityCollision(input: {
  readonly projectRoot: string;
  readonly taskId: string;
}): Promise<
  | { readonly ok: true }
  | { readonly ok: false; readonly issue: TaskExecutionWorkerIssue }
> {
  if (!isSafeId(input.taskId)) {
    return {
      ok: false,
      issue: issue({
        code: "task_execution_two_model_canary_storage_id_invalid",
        message: "Two-model canary storage ids must be safe system identifiers.",
      }),
    };
  }

  const projectRoot = await realpath(resolve(input.projectRoot)).catch(
    () => null,
  );
  if (projectRoot === null) {
    return {
      ok: false,
      issue: issue({
        code: "task_execution_two_model_canary_project_root_missing",
        message: "Two-model canary project root was not found.",
        category: "not_found",
      }),
    };
  }

  const candidates: readonly {
    readonly root: string;
    readonly path: string;
  }[] = [
    {
      root: resolve(projectRoot, storageRootRelativePath),
      path: resolve(projectRoot, storageRootRelativePath, input.taskId),
    },
    {
      root: resolve(projectRoot, AEOS_TASK_EXECUTION_INVOCATION_ROOT_RELATIVE_PATH),
      path: resolve(
        projectRoot,
        AEOS_TASK_EXECUTION_INVOCATION_ROOT_RELATIVE_PATH,
        input.taskId,
      ),
    },
    {
      root: resolve(projectRoot, AEOS_TASK_EXECUTION_ATTEMPT_ROOT_RELATIVE_PATH),
      path: resolve(
        projectRoot,
        AEOS_TASK_EXECUTION_ATTEMPT_ROOT_RELATIVE_PATH,
        input.taskId,
      ),
    },
    {
      root: resolve(projectRoot, AEOS_TASK_STATE_ROOT_RELATIVE_PATH),
      path: resolve(
        projectRoot,
        AEOS_TASK_STATE_ROOT_RELATIVE_PATH,
        `${input.taskId}.json`,
      ),
    },
    {
      root: resolve(projectRoot, AEOS_TASK_EXECUTION_AUDIT_ROOT_RELATIVE_PATH),
      path: resolve(
        projectRoot,
        AEOS_TASK_EXECUTION_AUDIT_ROOT_RELATIVE_PATH,
        input.taskId,
      ),
    },
    // Iteration step stores (TASK-0328).  Added so the freshness probe stays
    // exhaustive as new per-task state roots appear: a canary taskId that
    // already owns steps or step locks is not fresh, and the AEOS rule that
    // historical canaries are never replayed has to cover every state root, not
    // just the ones that existed when the probe was written.
    {
      root: resolve(projectRoot, AEOS_ITERATION_STEP_ROOT_RELATIVE_PATH),
      path: resolve(
        projectRoot,
        AEOS_ITERATION_STEP_ROOT_RELATIVE_PATH,
        input.taskId,
      ),
    },
    {
      root: resolve(projectRoot, AEOS_ITERATION_STEP_LOCK_ROOT_RELATIVE_PATH),
      path: resolve(
        projectRoot,
        AEOS_ITERATION_STEP_LOCK_ROOT_RELATIVE_PATH,
        input.taskId,
      ),
    },
  ];

  for (const candidate of candidates) {
    if (
      !isInsideOrEqual(projectRoot, candidate.root) ||
      !isInsideOrEqual(candidate.root, candidate.path)
    ) {
      return {
        ok: false,
        issue: issue({
          code: "task_execution_two_model_canary_storage_escape",
          message:
            "Two-model canary identity freshness probe path escaped AEOS state root.",
          category: "permission",
        }),
      };
    }

    const probe = await probePath(candidate.path);
    if (probe.kind === "error") {
      return {
        ok: false,
        issue: issue({
          code: "task_execution_two_model_canary_identity_freshness_unverifiable",
          message: `Two-model canary identity freshness could not be verified: probe at ${relative(projectRoot, candidate.path)} failed with errno ${probe.errno}. Failing closed to prevent silent identity reuse.`,
          category: "conflict",
        }),
      };
    }
    if (probe.kind === "exists") {
      return {
        ok: false,
        issue: issue({
          code: "task_execution_two_model_canary_identity_not_fresh",
          message: `Two-model canary identity is not fresh: a durable artifact already exists at ${relative(projectRoot, candidate.path)}.`,
          category: "conflict",
        }),
      };
    }
  }

  return { ok: true };
}

function createCanaryTaskState(
  now: string,
  refs: TaskExecutionTwoModelCanaryRefs,
): PersistedTaskState {
  const state = createInitialTaskState({
    taskId: refs.taskId,
    sourceTaskId: "TASK-0324",
    verifierRequired: true,
    createdAt: now,
  });
  const pendingIds = [
    refs.workItemId,
    ...Array.from({ length: 379 }, (_item, index) =>
      `task-0324-pending-${String(index + 2).padStart(3, "0")}`,
    ),
  ];
  const accountedIds = Array.from({ length: 20 }, (_item, index) =>
    `task-0324-accounted-${String(index + 1).padStart(3, "0")}`,
  );
  const workItems = [
    {
      id: refs.workItemId,
      state: "pending" as const,
      title: "TASK-0324 read-only routed two-model canary",
      source: "aeos://task/TASK-0324",
      batchId: refs.batchId,
      expectedArtifacts: ["artifact:task-0324-route-evidence"],
      updatedAt: now,
    },
    ...pendingIds.slice(1).map((id) => ({
      id,
      state: "pending" as const,
      batchId: refs.batchId,
      updatedAt: now,
    })),
    ...accountedIds.map((id) => ({
      id,
      state: "skipped" as const,
      batchId: refs.batchId,
      updatedAt: now,
    })),
  ];

  return {
    ...state,
    lifecycleState: "planned",
    workItems,
    batches: [
      {
        id: refs.batchId,
        workItemIds: [...pendingIds, ...accountedIds],
        expectedItemCount: 400,
        completedCount: 0,
        failedCount: 0,
        skippedCount: 20,
        retryableCount: 0,
      },
    ],
    pendingWorkItemIds: pendingIds,
    currentBatchId: refs.batchId,
    nextBatchId: refs.batchId,
    plan: {
      status: "planned",
      summary: {
        workItemCount: 400,
        batchCount: 1,
        stepCount: 1,
        verifierRequired: true,
        approvalRequired: false,
        issueCount: 0,
      },
    },
    verifier: {
      required: true,
      status: "pending",
      completionGatedByVerifier: true,
    },
    completionGate: {
      status: "verification_required",
      satisfied: false,
      completed: false,
      verified: false,
      authority: "system",
      evidenceReferences: [],
    },
    updatedAt: now,
  };
}

async function createStartedAttempt(input: {
  readonly projectRoot: string;
  readonly state: PersistedTaskState;
  readonly refs: TaskExecutionTwoModelCanaryRefs;
  readonly attemptNumber: number;
  readonly modelAdapterId: string;
  readonly now: string;
}): Promise<
  | { readonly ok: true; readonly attempt: TaskExecutionAttempt }
  | { readonly ok: false; readonly issues: readonly TaskExecutionWorkerIssue[] }
> {
  const prepared = prepareTaskExecutionAttempt({
    state: input.state,
    expectedRevision: input.state.revision,
    workItemId: input.refs.workItemId,
    batchId: input.refs.batchId,
    attemptNumber: input.attemptNumber,
    createdAt: input.now,
    adapterReferences: {
      modelAdapterId: input.modelAdapterId,
    },
  });
  if (!prepared.ok) {
    return { ok: false, issues: [createErrorIssue(prepared.error)] };
  }
  const started = transitionTaskExecutionAttempt({
    attempt: prepared.value.attempt,
    intent: { kind: "start" },
    occurredAt: input.now,
  });
  if (!started.ok) {
    return { ok: false, issues: [createErrorIssue(started.error)] };
  }
  const saved = await saveTaskExecutionAttempt({
    projectRoot: input.projectRoot,
    attempt: started.value.attempt,
  });
  if (!saved.ok) {
    return { ok: false, issues: [createErrorIssue(saved.error)] };
  }

  return { ok: true, attempt: saved.value.attempt };
}

async function reserveInvocationForAttempt(input: {
  readonly projectRoot: string;
  readonly state: PersistedTaskState;
  readonly attempt: TaskExecutionAttempt;
  readonly now: string;
  readonly ownerId: string;
}): Promise<
  | { readonly ok: true; readonly record: TaskExecutionInvocationRecord }
  | { readonly ok: false; readonly issues: readonly TaskExecutionWorkerIssue[] }
> {
  const reserved = await reserveTaskExecutionInvocation({
    projectRoot: input.projectRoot,
    state: input.state,
    attempt: input.attempt,
    dependencyKind: "test_noop",
    expectedRevision: input.state.revision,
    latestAttemptNumberForContext: input.attempt.attemptNumber,
    allowedOperationReferences: [
      "aeos://task/TASK-0324/operation/read-only-routed-worker-canary",
    ],
    claimedAt: input.now,
    ownerId: input.ownerId,
  });
  if (!reserved.ok) {
    return { ok: false, issues: [createErrorIssue(reserved.error)] };
  }

  return { ok: true, record: reserved.value.record };
}

export async function prepareTaskExecutionTwoModelCanary(input: {
  readonly projectRoot: string;
  readonly now?: string;
  readonly taskId?: string;
  readonly orchestrationId?: string;
  readonly workItemId?: string;
  readonly batchId?: string;
  readonly requireFreshIdentity?: boolean;
}): Promise<TaskExecutionTwoModelCanaryPrepareResult> {
  const now = input.now ?? new Date().toISOString();
  const refs = defaultCanaryRefs(input);

  if (input.requireFreshIdentity === true) {
    const collision = await findIdentityCollision({
      projectRoot: input.projectRoot,
      taskId: refs.taskId,
    });
    if (!collision.ok) {
      return blockedPrepare(null, [collision.issue]);
    }
  }

  const existing = await loadTaskExecutionTwoModelCanaryRecord({
    projectRoot: input.projectRoot,
    taskId: refs.taskId,
    orchestrationId: refs.orchestrationId,
  });
  if (existing.ok) {
    if (input.requireFreshIdentity === true) {
      // A pre-existing orchestration record is a collision, not a success,
      // when the caller demanded a provably fresh identity. The
      // findIdentityCollision probe above should already have caught this
      // (the orchestration-canaries/<taskId>/ directory would exist), but
      // this guard keeps the invariant explicit and fails closed even if the
      // probe's coverage ever changes.
      return blockedPrepare(null, [
        issue({
          code: "task_execution_two_model_canary_identity_not_fresh",
          message: `Two-model canary identity is not fresh: an orchestration record already exists for taskId ${existing.record.taskId}.`,
          category: "conflict",
        }),
      ]);
    }
    const plannerInvocation = await loadTaskExecutionInvocation({
      projectRoot: input.projectRoot,
      taskId: existing.record.taskId,
      invocationId: existing.record.plannerInvocationId,
    });
    const workerInvocation = await loadTaskExecutionInvocation({
      projectRoot: input.projectRoot,
      taskId: existing.record.taskId,
      invocationId: existing.record.workerInvocationId,
    });
    const state = await loadTaskState({
      projectRoot: input.projectRoot,
      taskId: existing.record.taskId,
    });

    return {
      ok: true,
      status: "already_prepared",
      taskState: state.ok ? state.value.state : null,
      plannerAttempt: null,
      plannerInvocation: plannerInvocation.ok ? plannerInvocation.value.record : null,
      workerAttempt: null,
      workerInvocation: workerInvocation.ok ? workerInvocation.value.record : null,
      orchestration: existing.record,
      issues: [],
    };
  }

  const state = createCanaryTaskState(now, refs);
  const stateValidation = validatePersistedTaskState(state);
  if (!stateValidation.ok) {
    return {
      ok: false,
      status: "blocked",
      taskState: null,
      plannerAttempt: null,
      plannerInvocation: null,
      workerAttempt: null,
      workerInvocation: null,
      orchestration: null,
      issues: [createErrorIssue(stateValidation.error)],
    };
  }
  const savedState = await saveTaskState({
    projectRoot: input.projectRoot,
    state: stateValidation.value,
  });
  if (!savedState.ok) {
    return {
      ok: false,
      status: "blocked",
      taskState: null,
      plannerAttempt: null,
      plannerInvocation: null,
      workerAttempt: null,
      workerInvocation: null,
      orchestration: null,
      issues: [createErrorIssue(savedState.error)],
    };
  }

  const plannerAttempt = await createStartedAttempt({
    projectRoot: input.projectRoot,
    state: savedState.value.state,
    refs,
    attemptNumber: 1,
    modelAdapterId: codexPlannerIdentity.workerId,
    now,
  });
  if (!plannerAttempt.ok) {
    return blockedPrepare(savedState.value.state, plannerAttempt.issues);
  }
  const plannerInvocation = await reserveInvocationForAttempt({
    projectRoot: input.projectRoot,
    state: savedState.value.state,
    attempt: plannerAttempt.attempt,
    now,
    ownerId: "owner-task-0324-codex-planner",
  });
  if (!plannerInvocation.ok) {
    return blockedPrepare(savedState.value.state, plannerInvocation.issues);
  }

  const workerAttempt = await createStartedAttempt({
    projectRoot: input.projectRoot,
    state: savedState.value.state,
    refs,
    attemptNumber: 2,
    modelAdapterId: claudeWorkerIdentity.workerId,
    now,
  });
  if (!workerAttempt.ok) {
    return blockedPrepare(savedState.value.state, workerAttempt.issues);
  }
  const workerInvocation = await reserveInvocationForAttempt({
    projectRoot: input.projectRoot,
    state: savedState.value.state,
    attempt: workerAttempt.attempt,
    now,
    ownerId: "owner-task-0324-claude-worker",
  });
  if (!workerInvocation.ok) {
    return blockedPrepare(savedState.value.state, workerInvocation.issues);
  }

  const record: TaskExecutionTwoModelCanaryRecord = {
    schemaVersion: TASK_EXECUTION_TWO_MODEL_CANARY_SCHEMA_VERSION,
    orchestrationId: refs.orchestrationId,
    taskId: savedState.value.state.taskId,
    taskRevision: savedState.value.state.revision,
    workItemId: refs.workItemId,
    batchId: refs.batchId,
    plannerAttemptId: plannerAttempt.attempt.attemptId,
    plannerInvocationId: plannerInvocation.record.invocationId,
    plannerInvocationRevision: plannerInvocation.record.revision,
    workerAttemptId: workerAttempt.attempt.attemptId,
    workerInvocationId: workerInvocation.record.invocationId,
    workerInvocationRevision: workerInvocation.record.revision,
    routeDecisionId: null,
    routeDecisionStatus: "not_run",
    selectedWorkerFamily: null,
    lifecycle: "prepared",
    realCodexPlannerExecuted: false,
    realClaudeRoutedWorkerExecuted: false,
    realTwoModelCanaryExecuted: false,
    createdAt: now,
    updatedAt: now,
    issues: [],
    safety,
  };
  const savedRecord = await saveCanaryRecord({
    projectRoot: input.projectRoot,
    record,
  });
  if (!savedRecord.ok) {
    return blockedPrepare(savedState.value.state, [savedRecord.issue]);
  }

  return {
    ok: true,
    status: "prepared",
    taskState: savedState.value.state,
    plannerAttempt: plannerAttempt.attempt,
    plannerInvocation: plannerInvocation.record,
    workerAttempt: workerAttempt.attempt,
    workerInvocation: workerInvocation.record,
    orchestration: savedRecord.record,
    issues: [],
  };
}

function blockedPrepare(
  state: PersistedTaskState | null,
  issues: readonly TaskExecutionWorkerIssue[],
): TaskExecutionTwoModelCanaryPrepareResult {
  return {
    ok: false,
    status: "blocked",
    taskState: state,
    plannerAttempt: null,
    plannerInvocation: null,
    workerAttempt: null,
    workerInvocation: null,
    orchestration: null,
    issues,
  };
}

function emptyInspectResult(input: {
  readonly status: "not_found" | "blocked";
  readonly orchestrationId: string;
  readonly issues: readonly TaskExecutionWorkerIssue[];
}): TaskExecutionTwoModelCanaryInspectResult {
  return {
    ok: false,
    status: input.status,
    taskId: null,
    taskRevision: null,
    orchestrationId: input.orchestrationId,
    orchestrationLifecycle: null,
    orchestrationPrepared: null,
    orchestrationConsumed: null,
    plannerInvocationId: null,
    plannerLifecycle: null,
    plannerRevision: null,
    plannerOneShotConsumed: null,
    plannerOutcomePresent: null,
    plannerReconciliationRequired: null,
    workerInvocationId: null,
    workerLifecycle: null,
    workerRevision: null,
    workerOneShotConsumed: null,
    workerOutcomePresent: null,
    workerReconciliationRequired: null,
    routePresent: null,
    routeDecisionStatus: null,
    selectedWorkerFamily: null,
    reconciliationRequired: null,
    issues: input.issues,
  };
}

// The persisted invocation record shape (schemaVersion, invocationId,
// lifecycle, ownership, request, result?, failure?, outcomeCertainty,
// revision, safety, issues) has no literal "oneShotLaunchConsumed" field.
// "reserved" is the only lifecycle a one-shot invocation can occupy before
// its single launch attempt has been made (see
// reserveTaskExecutionInvocation / updateTaskExecutionInvocation's
// "enter_invocation" intent, which moves lifecycle out of "reserved"), so
// oneShotConsumed is honestly derived as lifecycle !== "reserved" rather than
// invented.
function deriveOneShotConsumed(
  record: TaskExecutionInvocationRecord | null,
): boolean | null {
  return record === null ? null : record.lifecycle !== "reserved";
}

// outcomePresent is derived from whether a returned result or a failure
// record was actually persisted onto the invocation, not from a synthetic
// flag.
function deriveOutcomePresent(
  record: TaskExecutionInvocationRecord | null,
): boolean | null {
  return record === null
    ? null
    : record.result !== undefined || record.failure !== undefined;
}

// reconciliationRequired uses the single authoritative predicate exported from
// task-execution-invocation-reconciliation.ts. Do not duplicate the lifecycle
// check here — that module is the source of truth. The predicate covers both
// "invoking" (launch initiated, no outcome written) and "outcome_unknown"
// (process finished but outcome indeterminate); either is an ambiguous state
// that must block re-execution until reconciled. Staleness and corruption
// require additional context not available to a read-only inspector and are
// not evaluated here — those components must be checked separately if needed.
function deriveReconciliationRequired(
  record: TaskExecutionInvocationRecord | null,
): boolean | null {
  return record === null
    ? null
    : isTaskExecutionInvocationReconciliationRequiredByLifecycle(
        record.lifecycle,
      );
}

/**
 * Purely read-only inspection of a two-model canary identity's durable
 * state. Never writes, creates, or touches any file; loads only existing
 * records via loadTaskExecutionTwoModelCanaryRecord and
 * loadTaskExecutionInvocation.
 */
export async function inspectTaskExecutionTwoModelCanary(input: {
  readonly projectRoot: string;
  readonly taskId: string;
  readonly orchestrationId: string;
}): Promise<TaskExecutionTwoModelCanaryInspectResult> {
  const loaded = await loadTaskExecutionTwoModelCanaryRecord({
    projectRoot: input.projectRoot,
    taskId: input.taskId,
    orchestrationId: input.orchestrationId,
  });
  if (!loaded.ok) {
    return emptyInspectResult({
      status:
        loaded.issue.code === "task_execution_two_model_canary_record_not_found"
          ? "not_found"
          : "blocked",
      orchestrationId: input.orchestrationId,
      issues: [loaded.issue],
    });
  }

  const record = loaded.record;
  const issues: TaskExecutionWorkerIssue[] = [];

  const plannerInvocation = await loadTaskExecutionInvocation({
    projectRoot: input.projectRoot,
    taskId: record.taskId,
    invocationId: record.plannerInvocationId,
  });
  if (!plannerInvocation.ok) {
    issues.push(
      issue({
        code:
          "task_execution_two_model_canary_inspect_planner_invocation_unavailable",
        message:
          "Planner invocation record could not be loaded for inspection; derived planner facts are unavailable.",
        severity: "warning",
      }),
    );
  }
  const workerInvocation = await loadTaskExecutionInvocation({
    projectRoot: input.projectRoot,
    taskId: record.taskId,
    invocationId: record.workerInvocationId,
  });
  if (!workerInvocation.ok) {
    issues.push(
      issue({
        code:
          "task_execution_two_model_canary_inspect_worker_invocation_unavailable",
        message:
          "Worker invocation record could not be loaded for inspection; derived worker facts are unavailable.",
        severity: "warning",
      }),
    );
  }

  const plannerRecord = plannerInvocation.ok ? plannerInvocation.value.record : null;
  const workerRecord = workerInvocation.ok ? workerInvocation.value.record : null;
  const plannerReconciliationRequired = deriveReconciliationRequired(plannerRecord);
  const workerReconciliationRequired = deriveReconciliationRequired(workerRecord);

  return {
    ok: true,
    status: "inspected",
    taskId: record.taskId,
    taskRevision: record.taskRevision,
    orchestrationId: record.orchestrationId,
    orchestrationLifecycle: record.lifecycle,
    orchestrationPrepared: record.lifecycle === "prepared",
    orchestrationConsumed: record.lifecycle !== "prepared",
    plannerInvocationId: record.plannerInvocationId,
    plannerLifecycle: plannerRecord?.lifecycle ?? null,
    plannerRevision: plannerRecord?.revision ?? null,
    plannerOneShotConsumed: deriveOneShotConsumed(plannerRecord),
    plannerOutcomePresent: deriveOutcomePresent(plannerRecord),
    plannerReconciliationRequired,
    workerInvocationId: record.workerInvocationId,
    workerLifecycle: workerRecord?.lifecycle ?? null,
    workerRevision: workerRecord?.revision ?? null,
    workerOneShotConsumed: deriveOneShotConsumed(workerRecord),
    workerOutcomePresent: deriveOutcomePresent(workerRecord),
    workerReconciliationRequired,
    routePresent: record.routeDecisionId !== null,
    routeDecisionStatus: record.routeDecisionStatus,
    selectedWorkerFamily: record.selectedWorkerFamily,
    reconciliationRequired:
      plannerReconciliationRequired === null &&
      workerReconciliationRequired === null
        ? null
        : Boolean(plannerReconciliationRequired) ||
          Boolean(workerReconciliationRequired),
    issues,
  };
}

function createAdapterIdentity(
  worker: TaskExecutionWorkerIdentity,
): TaskExecutionAdapterIdentity {
  return {
    adapterId: worker.workerId,
    adapterKind: "test_execution",
    implementationVersion: worker.implementationVersion,
    capabilityVersion: worker.capabilityVersion,
    identityAuthority: "system",
  };
}

function createRequest(input: {
  readonly invocation: TaskExecutionInvocationRecord;
  readonly workerIdentity: TaskExecutionWorkerIdentity;
  readonly boundedInstructions: string;
  readonly contextReferences: readonly string[];
  readonly permissionFacts: TaskExecutionWorkerPermissionFacts;
}): TaskExecutionWorkerRequest {
  return {
    invocationId: input.invocation.invocationId,
    idempotencyKey: input.invocation.idempotencyKey,
    taskId: input.invocation.taskId,
    sourceTaskRevision: input.invocation.taskStateRevision,
    attemptId: input.invocation.attemptId,
    attemptNumber: input.invocation.attemptNumber,
    ...(input.invocation.workItemId === undefined
      ? {}
      : { workItemId: input.invocation.workItemId }),
    ...(input.invocation.batchId === undefined
      ? {}
      : { batchId: input.invocation.batchId }),
    operationKind: "execute_task_attempt",
    workerIdentity: input.workerIdentity,
    boundedInstructions: input.boundedInstructions,
    contextReferences: input.contextReferences,
    workspace,
    permissionFacts: input.permissionFacts,
  };
}

function permissionFacts(input: {
  readonly gate: ReturnType<typeof evaluateTaskExecutionPermissionGate>;
}): TaskExecutionWorkerPermissionFacts {
  return {
    authority: "system",
    permissionGateId: input.gate.policyGateId,
    allowed: input.gate.allowed,
    decision: input.gate.decision,
    capabilitySatisfied: input.gate.capabilitySatisfied,
    permissionsSatisfied: input.gate.permissionsSatisfied,
    policyAuthorized: input.gate.policyAuthorized,
    requiredPermissions: ["process"],
  };
}

function createCanaryPolicyRequirement(input: {
  readonly invocation: TaskExecutionInvocationRecord;
  readonly worker: TaskExecutionWorkerIdentity;
}): TaskExecutionPermissionGatePolicyRequirement {
  const payload = JSON.stringify({
    taskId: input.invocation.taskId,
    taskStateRevision: input.invocation.taskStateRevision,
    attemptId: input.invocation.attemptId,
    invocationId: input.invocation.invocationId,
    workerId: input.worker.workerId,
    operationKind: "execute_task_attempt",
    requiredPermissions: ["process"],
  });
  const policyGateId = `policy-gate:task-0324:${sha256(payload).slice(0, 32)}`;

  return {
    required: false,
    policyGateId,
    referenceId: policyGateId,
    authority: "system",
  };
}

function evaluateProcessPermission(input: {
  readonly invocation: TaskExecutionInvocationRecord;
  readonly worker: TaskExecutionWorkerIdentity;
  readonly policyRequirement?: TaskExecutionPermissionGatePolicyRequirement;
}) {
  const adapterIdentity = createAdapterIdentity(input.worker);

  return evaluateTaskExecutionPermissionGate({
    request: {
      invocationId: input.invocation.invocationId,
      idempotencyKey: input.invocation.idempotencyKey,
      taskId: input.invocation.taskId,
      sourceTaskRevision: input.invocation.taskStateRevision,
      attemptId: input.invocation.attemptId,
      attemptNumber: input.invocation.attemptNumber,
      ...(input.invocation.workItemId === undefined
        ? {}
        : { workItemId: input.invocation.workItemId }),
      ...(input.invocation.batchId === undefined
        ? {}
        : { batchId: input.invocation.batchId }),
      operationKind: "execute_task_attempt",
      adapterIdentity,
      inputReference: `aeos://task/${input.invocation.taskId}/two-model-canary/${input.invocation.invocationId}`,
      permissionRequirements: adapterPermissions,
    },
    adapterIdentity,
    adapterCapabilities,
    adapterPermissions,
    operationKind: "execute_task_attempt",
    policyRequirement: input.policyRequirement ??
      createCanaryPolicyRequirement(input),
    requiredPermissions: [
      {
        permission: "process",
        required: true,
        granted: true,
        authority: "system",
      },
    ],
    credentialReferenceRequired: false,
    auditRequired: true,
  });
}

function createPlannerConfiguration(): TaskExecutionCodexWorkerConfiguration {
  return {
    authority: "system",
    identity: codexPlannerIdentity as TaskExecutionCodexWorkerConfiguration["identity"],
    executable: {
      authority: "system",
      executableRef: trustedCodexExecutableRef,
      executableKind: "codex_exec",
    },
    model: {
      authority: "system",
      model: "gpt-5.5",
      reasoningEffort: "high",
    },
    workspace: {
      ...workspace,
      workingDirectoryRef: workspace.workspaceRef,
    },
    processPermission: {
      authority: "system",
      permissionId: "permission:codex-read-only-planner-canary-process",
      requiredPermission: "process",
      processExecutionAllowed: true,
    },
    futureProcessCapability: true,
    sandboxMode: "read-only",
    approvalPolicy: "never",
    timeoutMs: 120000,
    stdoutLimitBytes: 32768,
    stderrLimitBytes: 8192,
    structuredResultContractRef: "contract:aeos-codex-planner-routing-proposal-v1",
    structuredResultSchemaPath: codexPlannerSchemaPath,
    environmentInheritance: "system_codex_read_only_planner_canary",
  };
}

function createClaudeConfiguration(): TaskExecutionClaudeCodeWorkerConfiguration {
  return {
    authority: "system",
    identity: claudeWorkerIdentity as TaskExecutionClaudeCodeWorkerConfiguration["identity"],
    executable: {
      authority: "system",
      executableRef: trustedClaudeCodeExecutableRef,
      executableKind: "claude_code",
    },
    workspace: {
      ...workspace,
      workingDirectoryRef: workspace.workspaceRef,
    },
    processPermission: {
      authority: "system",
      permissionId: "permission:claude-code-read-only-canary-process",
      requiredPermission: "process",
      processExecutionAllowed: true,
    },
    futureProcessCapability: true,
    timeoutMs: 120000,
    stdoutLimitBytes: 32768,
    stderrLimitBytes: 8192,
    structuredResultContractRef: "contract:aeos-claude-code-worker-result-v1",
    readOnlyCanaryProfile: {
      authority: "system",
      profileId: "claude_code_read_only_canary_v1",
      enabled: true,
      permissionMode: "plan",
      toolSet: ["Read"],
      hostCustomizationIsolation: "safe_mode",
      strictMcpConfig: true,
      sessionPersistence: false,
      repositoryWriteAllowed: false,
      structuredOutput: "json_schema",
    },
  };
}

function routeProposalFromPlannerResult(input: {
  readonly plannerResult: TaskExecutionWorkerResult;
  readonly expectedTaskId: string;
  readonly expectedRevision: number;
  readonly expectedWorkItemId: string;
  readonly expectedBatchId: string;
}): {
  readonly proposal: TaskExecutionWorkerRoutingProposal | null;
  readonly issues: readonly TaskExecutionWorkerIssue[];
  readonly ignoredAuthorityFields: readonly string[];
} {
  const ignoredAuthorityFields: string[] = [];
  const output = input.plannerResult.output;
  const proposalValue =
    isRecord(output) && isRecord(output.routingProposal)
      ? output.routingProposal
      : null;

  if (proposalValue === null || input.plannerResult.outcomeStatus !== "returned") {
    return {
      proposal: null,
      ignoredAuthorityFields,
      issues: [
        issue({
          code: "task_execution_two_model_canary_planner_proposal_malformed",
          message: "Codex planner did not return a bounded routing proposal.",
        }),
      ],
    };
  }

  // Defense-in-depth: the wire schema constrains invocationOk to const:true,
  // but a route must never be produced from a normalized result that itself
  // disputes success. This does not depend on the wire schema and must hold
  // for any plannerResult, schema-conformant or not.
  if (input.plannerResult.invocationOk !== true) {
    return {
      proposal: null,
      ignoredAuthorityFields,
      issues: [
        issue({
          code: "task_execution_two_model_canary_planner_invocation_not_ok",
          message:
            "Codex planner result did not assert invocationOk; routing requires an explicit successful invocation.",
          category: "conflict",
        }),
      ],
    };
  }

  const forbidden = [
    "invokeNow",
    "completed",
    "verified",
    "safeToRetry",
    "policyRequired",
    "policyAuthorized",
    "approved",
    "permissionGranted",
    "cwd",
    "executable",
    "invocationId",
    "idempotencyKey",
    "workerIdentity",
    "taskCompleted",
  ];
  for (const key of forbidden) {
    if (key in proposalValue) {
      ignoredAuthorityFields.push(key);
    }
  }

  const capabilityRequirements = proposalValue.capabilityRequirements;
  const allowedCapabilities = new Set<TaskExecutionWorkerRoutingCapability>([
    "implementation",
    "repositoryRead",
    "modelReasoning",
    "boundedDiagnostics",
  ]);

  // The wire schema can no longer express minItems:1 (provider-rejected
  // keyword), so an empty capabilityRequirements array — vacuously accepted
  // by Array.prototype.every — must be rejected here instead.
  if (
    Array.isArray(capabilityRequirements) &&
    capabilityRequirements.length === 0
  ) {
    return {
      proposal: null,
      ignoredAuthorityFields,
      issues: [
        issue({
          code:
            "task_execution_two_model_canary_planner_capability_requirements_empty",
          message:
            "Codex planner proposal capabilityRequirements must not be empty.",
          category: "conflict",
        }),
      ],
    };
  }

  // The wire schema can no longer express uniqueItems:true (provider-rejected
  // keyword), so duplicate entries — also vacuously accepted by
  // Array.prototype.every — must be rejected here instead.
  if (
    Array.isArray(capabilityRequirements) &&
    new Set(capabilityRequirements).size !== capabilityRequirements.length
  ) {
    return {
      proposal: null,
      ignoredAuthorityFields,
      issues: [
        issue({
          code:
            "task_execution_two_model_canary_planner_capability_requirements_duplicate",
          message:
            "Codex planner proposal capabilityRequirements must not contain duplicate entries.",
          category: "conflict",
        }),
      ],
    };
  }

  // The wire schema can no longer express maxItems:8. Emptiness and
  // uniqueness above already bound this to at most the 4 allowed distinct
  // capability values, making this check moot in practice; it is kept as a
  // cheap explicit bound for defense-in-depth.
  if (
    Array.isArray(capabilityRequirements) &&
    capabilityRequirements.length > 8
  ) {
    return {
      proposal: null,
      ignoredAuthorityFields,
      issues: [
        issue({
          code:
            "task_execution_two_model_canary_planner_capability_requirements_oversized",
          message:
            "Codex planner proposal capabilityRequirements exceeded the maximum bounded size.",
          category: "conflict",
        }),
      ],
    };
  }

  if (
    proposalValue.taskId !== input.expectedTaskId ||
    proposalValue.sourceTaskRevision !== input.expectedRevision ||
    proposalValue.workItemId !== input.expectedWorkItemId ||
    (proposalValue.batchId ?? input.expectedBatchId) !== input.expectedBatchId ||
    proposalValue.operationKind !== "execute_task_attempt" ||
    proposalValue.recommendedWorkerFamily !== "claude_code" ||
    proposalValue.expectedOperationClass !== "implementation" ||
    !Array.isArray(capabilityRequirements) ||
    !capabilityRequirements.every((item) => allowedCapabilities.has(item))
  ) {
    return {
      proposal: null,
      ignoredAuthorityFields,
      issues: [
        issue({
          code: "task_execution_two_model_canary_planner_proposal_invalid",
          message: "Codex planner proposal did not match the exact TASK-0324 route authority.",
          category: "conflict",
        }),
      ],
    };
  }

  return {
    proposal: {
      proposalId:
        typeof proposalValue.proposalId === "string"
          ? proposalValue.proposalId
          : "task-0324-codex-planner-proposal",
      taskId: input.expectedTaskId,
      sourceTaskRevision: input.expectedRevision,
      workItemId: input.expectedWorkItemId,
      batchId: input.expectedBatchId,
      operationKind: "execute_task_attempt",
      recommendedWorkerFamily: "claude_code",
      capabilityRequirements,
      reasonReference:
        typeof proposalValue.reasonReference === "string"
          ? proposalValue.reasonReference
          : "aeos://task/TASK-0324/operation/read-only-routed-worker-canary",
      expectedOperationClass: "implementation",
    },
    ignoredAuthorityFields,
    issues: ignoredAuthorityFields.map((field) =>
      issue({
        code: "task_execution_two_model_canary_planner_authority_field_ignored",
        message: `Codex planner authority field was ignored: ${field}.`,
        severity: "warning",
      }),
    ),
  };
}

async function appendDispatchAudit(input: {
  readonly projectRoot: string;
  readonly invocation: TaskExecutionInvocationRecord;
  readonly workerId: string;
  readonly permissionGateId: string;
}): Promise<
  | { readonly ok: true; readonly event: TaskExecutionAuditEvent }
  | { readonly ok: false; readonly issues: readonly TaskExecutionWorkerIssue[] }
> {
  const event = createTaskExecutionInvocationDispatchIntentAuditEvent({
    record: input.invocation,
    adapterId: input.workerId,
    operation: "execute_task_attempt",
    policyGateId: input.permissionGateId,
    policyAuthorized: false,
    auditRequired: true,
    occurredAt: new Date().toISOString(),
  });
  if (!event.ok) {
    return { ok: false, issues: [createErrorIssue(event.error)] };
  }
  const append = await appendTaskExecutionAuditEvent({
    projectRoot: input.projectRoot,
    taskId: input.invocation.taskId,
    event: event.value,
    forbiddenValues: [input.invocation.ownership.ownershipToken],
  });
  if (!append.ok) {
    return { ok: false, issues: [createErrorIssue(append.error)] };
  }

  return { ok: true, event: append.value.event };
}

async function deterministicProcessResult(input: {
  readonly projectRoot: string;
  readonly invocation: TaskExecutionInvocationRecord;
  readonly request: TaskExecutionWorkerRequest;
  readonly process:
    | TaskExecutionCodexProcessResult
    | TaskExecutionClaudeCodeProcessResult;
  readonly normalize: (
    result: TaskExecutionCodexProcessResult | TaskExecutionClaudeCodeProcessResult,
  ) => TaskExecutionWorkerResult;
}): Promise<{
  readonly runtime: TaskExecutionLocalWorkerProcessRuntimeResult;
  readonly normalized: TaskExecutionWorkerResult;
}> {
  const entered = input.invocation.lifecycle === "invoking"
    ? { ok: true as const, value: { record: input.invocation } }
    : await updateTaskExecutionInvocation({
        projectRoot: input.projectRoot,
        taskId: input.invocation.taskId,
        invocationId: input.invocation.invocationId,
        ownershipToken: input.invocation.ownership.ownershipToken,
        expectedLifecycle: "reserved",
        expectedRevision: input.invocation.revision,
        intent: { kind: "enter_invocation" },
      });
  if (!entered.ok) {
    const failed = normalizeSyntheticFailure(input.request, entered.error);
    return {
      runtime: fakeRuntime("launch_blocked", null, false, [createErrorIssue(entered.error)]),
      normalized: failed,
    };
  }
  const normalized = input.normalize(input.process);
  const update = await updateTaskExecutionInvocation({
    projectRoot: input.projectRoot,
    taskId: input.invocation.taskId,
    invocationId: input.invocation.invocationId,
    ownershipToken: input.invocation.ownership.ownershipToken,
    expectedLifecycle: "invoking",
    expectedRevision: entered.value.record.revision,
    intent:
      normalized.outcomeStatus === "returned"
        ? {
            kind: "record_returned",
            result: {
              invocationOk: normalized.invocationOk,
              output: normalized.output,
              outputReference: normalized.outputReference,
              diagnosticCode: normalized.diagnosticCode,
              message: normalized.message,
            },
          }
        : normalized.outcomeStatus === "in_progress" ||
            normalized.outcomeStatus === "unavailable"
          ? {
              kind: "mark_outcome_unknown",
              issue: {
                code: "task_execution_two_model_canary_deterministic_outcome_unknown",
                message: "Deterministic canary fixture reported ambiguous worker outcome.",
                severity: "error",
                category: "unknown",
              },
            }
          : {
              kind: "record_failed",
              failure: {
                code:
                  boundedInvocationText(normalized.failure?.code) ??
                  "task_execution_two_model_canary_deterministic_worker_failed",
                category: invocationFailureCategoryFromWorkerResult(normalized),
                retryable: false,
                ...(boundedInvocationText(normalized.failure?.message) ===
                undefined
                  ? {}
                  : {
                      diagnostic: boundedInvocationText(
                        normalized.failure?.message,
                      ),
                    }),
              },
            },
  });

  const record = update.ok ? update.value.record : entered.value.record;
  const processStdinEvidence = input.process as {
    readonly stdinMode?: "pipe";
    readonly stdinBytes?: number;
    readonly stdinWriteCompleted?: boolean;
    readonly stdinClosed?: boolean;
  };
  return {
    runtime: fakeRuntime(
      normalized.outcomeStatus === "returned"
        ? "process_returned"
        : normalized.outcomeStatus === "failed"
          ? "process_failed"
          : "process_outcome_unknown",
      {
        invocationRef: input.process.invocationRef,
        terminationReason:
          input.process.terminationReason === "interrupted"
            ? "unknown"
            : input.process.terminationReason,
        exitCode: input.process.exitCode,
        signal: input.process.signal,
        stdinMode: processStdinEvidence.stdinMode ?? "pipe",
        stdinBytes: processStdinEvidence.stdinBytes ?? 1,
        stdinWriteCompleted:
          processStdinEvidence.stdinWriteCompleted ?? true,
        stdinClosed: processStdinEvidence.stdinClosed ?? true,
        stdout: input.process.stdout,
        stderr: input.process.stderr,
        stdoutBytes: input.process.stdout.length,
        stderrBytes: input.process.stderr.length,
        stdoutTruncated: false,
        stderrTruncated: false,
        timedOut: input.process.timedOut,
        interrupted: input.process.interrupted,
        spawned: false,
        observedAt: input.process.observedAt ?? new Date().toISOString(),
      },
      true,
      update.ok ? normalized.issues : [...normalized.issues, createErrorIssue(update.error)],
      record.lifecycle,
      record.revision,
    ),
    normalized,
  };
}

function fakeRuntime(
  status: TaskExecutionLocalWorkerProcessRuntimeResult["status"],
  processResult: TaskExecutionLocalWorkerProcessEvidence | null,
  consumed: boolean,
  issues: readonly TaskExecutionWorkerIssue[],
  lifecycle: string | null = null,
  revision: number | null = null,
): TaskExecutionLocalWorkerProcessRuntimeResult {
  return {
    ok: status === "process_returned",
    status,
    launchReservationPersisted: consumed,
    oneShotAuthorityConsumed: consumed,
    processSpawned: false,
    actualWorkerProcessesSpawned: 0,
    actualCodexCalls: 0,
    actualClaudeCalls: 0,
    cloudCalls: 0,
    invocationLifecycle: lifecycle,
    invocationRevision: revision,
    processResult,
    reconciliationRequired: status === "process_outcome_unknown",
    postDispatchAuditWritten: false,
    postDispatchAuditIncomplete: false,
    issues,
    safety: {
      processEvidenceOnly: true,
      shellExecuted: false,
      parentEnvironmentInherited: false,
      taskEnvironmentAccepted: false,
      repositoryWritten: false,
      retryAttempted: false,
      blindRelaunchAllowed: false,
      workAccountingModified: false,
      taskCompleted: false,
      verifierRun: false,
      completionGateSatisfied: false,
      rawWorkerOutputAuthoritative: false,
      realCodexInvoked: false,
      realClaudeCodeInvoked: false,
      cloudCalled: false,
    },
  };
}

function normalizeSyntheticFailure(
  request: TaskExecutionWorkerRequest,
  error: AeosError,
): TaskExecutionWorkerResult {
  return {
    ok: false,
    invocationReturned: false,
    invocationOk: false,
    outcomeStatus: "failed",
    workerIdentity: request.workerIdentity,
    taskId: request.taskId,
    sourceTaskRevision: request.sourceTaskRevision,
    attemptId: request.attemptId,
    attemptNumber: request.attemptNumber,
    invocationId: request.invocationId,
    idempotencyKey: request.idempotencyKey,
    workItemId: request.workItemId ?? null,
    batchId: request.batchId ?? null,
    failure: {
      code: error.code,
      category: "unknown",
      message: error.message,
    },
    issues: [createErrorIssue(error)],
    safety: {
      runtimeExecutionEnabled: false,
      realCodexInvoked: false,
      realClaudeCodeInvoked: false,
      cloudCalled: false,
      networkCalled: false,
      filesystemTouched: false,
      repositoryWritten: false,
      subprocessExecuted: false,
      shellExecuted: false,
      modelInvoked: false,
      taskStateModified: false,
      attemptStateModified: false,
      invocationStateModified: false,
      workAccountingModified: false,
      auditWritten: false,
      verifierRun: false,
      workCompleted: false,
      taskCompleted: false,
      verified: false,
      approved: false,
      safeToRetry: false,
      rawWorkerOutputAuthoritative: false,
    },
  };
}

function boundedInvocationText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  if (
    trimmed.length === 0 ||
    trimmed.length > 512 ||
    /(\n\s*at\s+|Error:|stack|token|secret|credential|authorization)/i.test(
      trimmed,
    )
  ) {
    return undefined;
  }

  return trimmed;
}

function invocationFailureCategoryFromWorkerResult(
  result: TaskExecutionWorkerResult,
): TaskExecutionFailureCategory {
  if (
    result.failure?.category === "timeout" ||
    result.failure?.category === "worker_error" ||
    result.failure?.category === "invalid_request" ||
    result.failure?.category === "rejected"
  ) {
    return "execution_failure";
  }

  return "unknown";
}

function knownWorkerOutcome(result: TaskExecutionWorkerResult | null): boolean {
  return (
    result?.outcomeStatus === "returned" ||
    result?.outcomeStatus === "failed" ||
    result?.outcomeStatus === "rejected"
  );
}

function issueCategoryFromWorkerFailure(
  result: TaskExecutionWorkerResult,
): AeosError["category"] {
  if (result.failure?.category === "timeout") {
    return "timeout";
  }

  if (
    result.failure?.category === "invalid_request" ||
    result.failure?.category === "rejected"
  ) {
    return "validation";
  }

  return "unknown";
}

function issueFromWorkerFailure(
  result: TaskExecutionWorkerResult | null,
): readonly TaskExecutionWorkerIssue[] {
  if (result?.outcomeStatus !== "failed" || result.failure === undefined) {
    return [];
  }

  return [
    issue({
      code:
        boundedInvocationText(result.failure.code) ??
        "task_execution_two_model_canary_worker_failed",
      message:
        boundedInvocationText(result.failure.message) ??
        "Worker process returned bounded failed evidence.",
      category: issueCategoryFromWorkerFailure(result),
    }),
  ];
}

async function persistInvocationOutcomeFromWorkerResult(input: {
  readonly projectRoot: string;
  readonly taskId: string;
  readonly invocationId: string;
  readonly workerResult: TaskExecutionWorkerResult | null;
  readonly expectedLifecycle: "invoking" | "outcome_unknown";
  readonly expectedRevision: number;
}): Promise<{
  readonly record: TaskExecutionInvocationRecord | null;
  readonly outcomeKnown: boolean;
  readonly outcomePersisted: boolean;
  readonly reconciliationRequired: boolean;
  readonly issues: readonly TaskExecutionWorkerIssue[];
}> {
  if (input.workerResult === null) {
    return {
      record: null,
      outcomeKnown: false,
      outcomePersisted: false,
      reconciliationRequired: true,
      issues: [
        issue({
          code: "task_execution_two_model_canary_worker_result_missing",
          message:
            "Local worker process evidence did not produce a normalized worker outcome; reconciliation remains required.",
          category: "unknown",
        }),
      ],
    };
  }

  const loaded = await loadTaskExecutionInvocation({
    projectRoot: input.projectRoot,
    taskId: input.taskId,
    invocationId: input.invocationId,
  });
  if (!loaded.ok) {
    return {
      record: null,
      outcomeKnown: knownWorkerOutcome(input.workerResult),
      outcomePersisted: false,
      reconciliationRequired: true,
      issues: [createErrorIssue(loaded.error)],
    };
  }

  if (
    loaded.value.record.lifecycle !== input.expectedLifecycle ||
    loaded.value.record.revision !== input.expectedRevision
  ) {
    return {
      record: loaded.value.record,
      outcomeKnown: knownWorkerOutcome(input.workerResult),
      outcomePersisted: false,
      reconciliationRequired: true,
      issues: [
        issue({
          code:
            "task_execution_two_model_canary_invocation_outcome_context_mismatch",
          message:
            "Normalized worker outcome persistence requires the exact post-launch invocation lifecycle and revision.",
          category: "conflict",
        }),
      ],
    };
  }

  if (
    input.workerResult.outcomeStatus !== "returned" &&
    input.workerResult.outcomeStatus !== "failed" &&
    input.workerResult.outcomeStatus !== "rejected"
  ) {
    if (loaded.value.record.lifecycle === "outcome_unknown") {
      return {
        record: loaded.value.record,
        outcomeKnown: false,
        outcomePersisted: false,
        reconciliationRequired: true,
        issues: input.workerResult.issues,
      };
    }

    const unknown = await updateTaskExecutionInvocation({
      projectRoot: input.projectRoot,
      taskId: input.taskId,
      invocationId: input.invocationId,
      ownershipToken: loaded.value.record.ownership.ownershipToken,
      expectedLifecycle: "invoking",
      expectedRevision: input.expectedRevision,
      intent: {
        kind: "mark_outcome_unknown",
        issue: {
          code: "task_execution_two_model_canary_worker_outcome_ambiguous",
          message:
            "Worker result was not a known returned or failed outcome; reconciliation remains required and relaunch is forbidden.",
          severity: "error",
          category: "unknown",
        },
      },
    });

    return unknown.ok
      ? {
          record: unknown.value.record,
          outcomeKnown: false,
          outcomePersisted: false,
          reconciliationRequired: true,
          issues: input.workerResult.issues,
        }
      : {
          record: loaded.value.record,
          outcomeKnown: false,
          outcomePersisted: false,
          reconciliationRequired: true,
          issues: [createErrorIssue(unknown.error)],
        };
  }

  const observedAt = new Date().toISOString();
  const safeOutputReference = boundedInvocationText(
    input.workerResult.outputReference,
  );
  const safeDiagnosticCode =
    boundedInvocationText(input.workerResult.diagnosticCode) ??
    "task_execution_worker_result_returned";
  const safeReturnedMessage = boundedInvocationText(input.workerResult.message);
  const safeFailureCode =
    boundedInvocationText(input.workerResult.failure?.code) ??
    boundedInvocationText(input.workerResult.issues[0]?.code) ??
    "task_execution_worker_result_failed";
  const safeFailureDiagnostic =
    boundedInvocationText(input.workerResult.failure?.message) ??
    boundedInvocationText(input.workerResult.message) ??
    boundedInvocationText(input.workerResult.issues[0]?.message);
  const update = await updateTaskExecutionInvocation({
    projectRoot: input.projectRoot,
    taskId: input.taskId,
    invocationId: input.invocationId,
    ownershipToken: loaded.value.record.ownership.ownershipToken,
    expectedLifecycle: input.expectedLifecycle,
    expectedRevision: input.expectedRevision,
    intent:
      input.workerResult.outcomeStatus === "returned" &&
        input.workerResult.invocationOk
        ? {
            kind: "record_returned",
            result: {
              invocationOk: true,
              ...(input.workerResult.output === undefined
                ? {}
                : { output: input.workerResult.output }),
              ...(safeOutputReference === undefined
                ? {}
                : { outputReference: safeOutputReference }),
              diagnosticCode: safeDiagnosticCode,
              ...(safeReturnedMessage === undefined
                ? {}
                : { message: safeReturnedMessage }),
              ...(input.workerResult.metadata === undefined
                ? {}
                : { metadata: input.workerResult.metadata }),
              returnedAt: observedAt,
            },
          }
        : {
            kind: "record_failed",
            failure: {
              code: safeFailureCode,
              category: invocationFailureCategoryFromWorkerResult(
                input.workerResult,
              ),
              ...(safeFailureDiagnostic === undefined
                ? {}
                : { diagnostic: safeFailureDiagnostic }),
              retryable: false,
              failedAt: observedAt,
            },
          },
  });

  return update.ok
    ? {
        record: update.value.record,
        outcomeKnown: true,
        outcomePersisted: true,
        reconciliationRequired: false,
        issues: input.workerResult.issues,
      }
    : {
        record: loaded.value.record,
        outcomeKnown: true,
        outcomePersisted: false,
        reconciliationRequired: true,
        issues: [createErrorIssue(update.error), ...input.workerResult.issues],
      };
}

export async function runTaskExecutionTwoModelCanary(input: {
  readonly projectRoot: string;
  readonly taskId: string;
  readonly orchestrationId: string;
  readonly expectedRevision: number;
  readonly expectedPlannerInvocationRevision: number;
  readonly expectedWorkerInvocationRevision: number;
  readonly runner?: TaskExecutionTwoModelCanaryRunner;
}): Promise<TaskExecutionTwoModelCanaryRunResult> {
  const issues: TaskExecutionWorkerIssue[] = [];
  const loaded = await loadTaskExecutionTwoModelCanaryRecord({
    projectRoot: input.projectRoot,
    taskId: input.taskId,
    orchestrationId: input.orchestrationId,
  });
  if (!loaded.ok) {
    return runResult("blocked", null, null, null, null, null, null, 0, 0, [loaded.issue]);
  }
  const record = loaded.record;
  if (record.lifecycle !== "prepared") {
    return runResult("already_consumed", record, null, null, null, null, null, 0, 0, []);
  }

  const stateResult = await loadTaskState({ projectRoot: input.projectRoot, taskId: record.taskId });
  const plannerAttemptResult = await loadTaskExecutionAttempt({
    projectRoot: input.projectRoot,
    taskId: record.taskId,
    attemptId: record.plannerAttemptId,
  });
  const workerAttemptResult = await loadTaskExecutionAttempt({
    projectRoot: input.projectRoot,
    taskId: record.taskId,
    attemptId: record.workerAttemptId,
  });
  const plannerInvocationResult = await loadTaskExecutionInvocation({
    projectRoot: input.projectRoot,
    taskId: record.taskId,
    invocationId: record.plannerInvocationId,
  });
  const workerInvocationResult = await loadTaskExecutionInvocation({
    projectRoot: input.projectRoot,
    taskId: record.taskId,
    invocationId: record.workerInvocationId,
  });
  for (const result of [
    stateResult,
    plannerAttemptResult,
    workerAttemptResult,
    plannerInvocationResult,
    workerInvocationResult,
  ]) {
    if (!result.ok) {
      issues.push(createErrorIssue(result.error));
    }
  }
  if (issues.length > 0 || !stateResult.ok || !plannerAttemptResult.ok || !workerAttemptResult.ok || !plannerInvocationResult.ok || !workerInvocationResult.ok) {
    return runResult("blocked", record, null, null, null, null, null, 0, 0, issues);
  }
  const state = stateResult.value.state;
  const plannerInvocation = plannerInvocationResult.value.record;
  const workerInvocation = workerInvocationResult.value.record;
  if (
    state.revision !== input.expectedRevision ||
    plannerInvocation.revision !== input.expectedPlannerInvocationRevision ||
    workerInvocation.revision !== input.expectedWorkerInvocationRevision ||
    plannerInvocation.lifecycle !== "reserved" ||
    workerInvocation.lifecycle !== "reserved"
  ) {
    return runResult("blocked", record, plannerInvocation, workerInvocation, null, null, null, 0, 0, [
      issue({
        code: "task_execution_two_model_canary_expected_revision_mismatch",
        message: "Two-model canary requires exact current task and invocation revisions with reserved one-shot records.",
        category: "conflict",
      }),
    ]);
  }

  const plannerGate = evaluateProcessPermission({
    invocation: plannerInvocation,
    worker: codexPlannerIdentity,
    policyRequirement: input.runner?.policyRequirement?.({
      phase: "planner",
      invocation: plannerInvocation,
      worker: codexPlannerIdentity,
    }),
  });
  if (!plannerGate.allowed) {
    return runResult("planner_failed", record, plannerInvocation, workerInvocation, null, null, null, 0, 0, plannerGate.issues.map((item) => issue({
      code: item.code,
      message: item.message,
      category: item.category,
    })));
  }
  const plannerRequest = createRequest({
    invocation: plannerInvocation,
    workerIdentity: codexPlannerIdentity,
    boundedInstructions:
      "TASK-0324 fixed planner canary. Return only the JSON Schema-backed AEOS worker result with output.routingProposal.recommendedWorkerFamily=claude_code for the assigned read-only repository reasoning work item. Do not implement code, edit files, run shell, launch workers, or claim completion.",
    contextReferences: ["aeos://task/TASK-0324/operation/read-only-routed-worker-canary"],
    permissionFacts: permissionFacts({ gate: plannerGate }),
  });
  const plannerConfig = createPlannerConfiguration();
  const codexAuth = await (input.runner?.codexAuthPreflight ??
    (() => runTaskExecutionCodexAuthPreflight({ executablePath: trustedCodexExecutablePath })))();
  if (!codexAuth.ok) {
    return runResult(
      "planner_failed",
      record,
      plannerInvocation,
      workerInvocation,
      null,
      null,
      null,
      0,
      0,
      codexAuth.issues,
      {
        plannerAuthChecked: true,
        plannerAuthReady: false,
      },
    );
  }
  const plannerAuthSafety = {
    plannerAuthChecked: true,
    plannerAuthReady: true,
  } as const;
  const codexExecPreflight = await (input.runner?.codexExecContractPreflight ??
    (input.runner?.codexProcess === undefined
      ? () =>
          runTaskExecutionCodexExecContractPreflight({
            executablePath: trustedCodexExecutablePath,
            projectRoot: input.projectRoot,
            configuration: plannerConfig,
          })
      : async () => ({
          ok: true,
          command: {
            executablePath: trustedCodexExecutablePath,
            argv: ["exec", "--help"] as const,
            timeoutMs: 1,
          },
          issues: [],
          checks: {
            executableExists: true,
            execSurfaceSupported: true,
            expectedFlagsSupported: true,
            schemaPathValid: true,
            schemaJsonValid: true,
            cwdGitRepository: true,
            environmentPolicyValid: true,
          },
          safety: {
            modelInvoked: false,
            shellUsed: false,
            fullParentEnvironmentInherited: false,
            rawHelpOutputPersisted: false,
            credentialFilesRead: false,
            secretsPersisted: false,
          },
        })))();
  if (!codexExecPreflight.ok) {
    return runResult(
      "planner_failed",
      record,
      plannerInvocation,
      workerInvocation,
      null,
      null,
      null,
      0,
      0,
      codexExecPreflight.issues,
      plannerAuthSafety,
    );
  }
  const preparedPlanner = prepareTaskExecutionCodexWorkerInvocation({
    configuration: plannerConfig,
    request: plannerRequest,
    invocationRecord: plannerInvocation,
  });
  if (preparedPlanner.issues.some((item) => item.severity === "error")) {
    return runResult(
      "planner_failed",
      record,
      plannerInvocation,
      workerInvocation,
      null,
      null,
      null,
      0,
      0,
      preparedPlanner.issues,
      plannerAuthSafety,
    );
  }
  const plannerAudit = await appendDispatchAudit({
    projectRoot: input.projectRoot,
    invocation: plannerInvocation,
    workerId: codexPlannerIdentity.workerId,
    permissionGateId: plannerGate.policyGateId,
  });
  if (!plannerAudit.ok) {
    return runResult("planner_failed", record, plannerInvocation, workerInvocation, null, null, null, 0, 0, plannerAudit.issues, plannerAuthSafety);
  }
  const enteredPlanner = await updateTaskExecutionInvocation({
    projectRoot: input.projectRoot,
    taskId: plannerInvocation.taskId,
    invocationId: plannerInvocation.invocationId,
    ownershipToken: plannerInvocation.ownership.ownershipToken,
    expectedLifecycle: "reserved",
    expectedRevision: plannerInvocation.revision,
    intent: { kind: "enter_invocation" },
  });
  if (!enteredPlanner.ok) {
    return runResult("planner_failed", record, plannerInvocation, workerInvocation, null, null, null, 0, 0, [createErrorIssue(enteredPlanner.error)], plannerAuthSafety);
  }
  const plannerEnteredSafety = {
    ...plannerAuthSafety,
    plannerInvocationModified: true,
    plannerOneShotConsumed: true,
  } as const;

  let plannerRuntime: TaskExecutionLocalWorkerProcessRuntimeResult;
  let plannerResult: TaskExecutionWorkerResult | null = null;
  let plannerOutcome = {
    outcomeKnown: false,
    outcomePersisted: false,
    reconciliationRequired: false,
    issues: [] as readonly TaskExecutionWorkerIssue[],
  };
  if (input.runner?.codexProcess !== undefined) {
    const process = await input.runner.codexProcess(plannerRequest);
    const deterministic = await deterministicProcessResult({
      projectRoot: input.projectRoot,
      invocation: enteredPlanner.value.record,
      request: plannerRequest,
      process,
      normalize: (value) =>
        normalizeTaskExecutionCodexProcessResult({
          request: plannerRequest,
          processResult: value as TaskExecutionCodexProcessResult,
          stdoutLimitBytes: plannerConfig.stdoutLimitBytes,
          stderrLimitBytes: plannerConfig.stderrLimitBytes,
        }),
    });
    plannerRuntime = deterministic.runtime;
    plannerResult = deterministic.normalized;
    plannerOutcome = {
      outcomeKnown: knownWorkerOutcome(plannerResult),
      outcomePersisted:
        plannerRuntime.invocationLifecycle === "returned" ||
        plannerRuntime.invocationLifecycle === "failed",
      reconciliationRequired: plannerRuntime.reconciliationRequired,
      issues: plannerRuntime.issues,
    };
  } else {
    const plannerProcessGate = authorizeTaskExecutionWorkerProcess({
      configuration: plannerConfig,
      request: plannerRequest,
      invocationRecord: enteredPlanner.value.record,
      preparedInvocation: preparedPlanner.preparedInvocation,
      permissionGateResult: plannerGate,
      preProcessAuditEvent: plannerAudit.event,
      expectedInvocationRevision: enteredPlanner.value.record.revision,
    });
    if (!plannerProcessGate.ok || plannerProcessGate.authority === null) {
      return runResult(
        "planner_failed",
        record,
        plannerInvocation,
        workerInvocation,
        null,
        null,
        null,
        0,
        0,
        plannerProcessGate.issues,
        plannerEnteredSafety,
      );
    }
    plannerRuntime = await executeTaskExecutionLocalWorkerProcess({
      projectRoot: input.projectRoot,
      authority:
        plannerProcessGate.authority as unknown as TaskExecutionLocalWorkerProcessAuthority,
      invocationRecord: enteredPlanner.value.record,
      preProcessAuditEvent: plannerAudit.event,
      executable: {
        authority: "system",
        executableRef: trustedCodexExecutableRef,
        executableKind: "codex_exec",
        executablePath: trustedCodexExecutablePath,
        executionMode: "real_codex_read_only_planner_canary",
      },
      workspace: {
        authority: "system",
        workspaceRef: workspace.workspaceRef,
        projectRef: workspace.projectRef,
        absolutePath: await realpath(input.projectRoot),
        repositoryWriteAllowed: false,
      },
      environment: {
        authority: "system",
        inheritance: "system_codex_read_only_planner_canary",
        variables: [],
      },
      stdin: preparedPlanner.preparedInvocation.processRequest.stdin,
      forbiddenValues: [enteredPlanner.value.record.ownership.ownershipToken],
      outcomePersistence: "caller_normalized",
    });
    plannerResult =
      plannerRuntime.processResult === null
        ? null
        : normalizeTaskExecutionCodexProcessResult({
            request: plannerRequest,
            processResult: plannerRuntime.processResult,
            stdoutLimitBytes: plannerConfig.stdoutLimitBytes,
            stderrLimitBytes: plannerConfig.stderrLimitBytes,
          });
    if (
      plannerRuntime.invocationLifecycle === "outcome_unknown" &&
      plannerRuntime.invocationRevision !== null
    ) {
      const persisted = await persistInvocationOutcomeFromWorkerResult({
        projectRoot: input.projectRoot,
        taskId: record.taskId,
        invocationId: record.plannerInvocationId,
        workerResult: plannerResult,
        expectedLifecycle: "outcome_unknown",
        expectedRevision: plannerRuntime.invocationRevision,
      });
      plannerOutcome = {
        outcomeKnown: persisted.outcomeKnown,
        outcomePersisted: persisted.outcomePersisted,
        reconciliationRequired: persisted.reconciliationRequired,
        issues: persisted.issues,
      };
      plannerRuntime = {
        ...plannerRuntime,
        invocationLifecycle:
          persisted.record?.lifecycle ?? plannerRuntime.invocationLifecycle,
        invocationRevision:
          persisted.record?.revision ?? plannerRuntime.invocationRevision,
        reconciliationRequired: persisted.reconciliationRequired,
        issues: [...plannerRuntime.issues, ...persisted.issues],
      };
    } else {
      plannerOutcome = {
        outcomeKnown: knownWorkerOutcome(plannerResult),
        outcomePersisted: false,
        reconciliationRequired: true,
        issues: plannerRuntime.issues,
      };
    }
  }
  const plannerOutcomeSafety = {
    ...plannerEnteredSafety,
    plannerProcessOutcomeKnown: plannerOutcome.outcomeKnown,
    plannerInvocationOutcomePersisted: plannerOutcome.outcomePersisted,
    plannerReconciliationRequired: plannerOutcome.reconciliationRequired,
    realCodexProcessSpawned: input.runner?.codexProcess === undefined &&
      plannerRuntime.processSpawned,
    realCodexModelCall: input.runner?.codexProcess === undefined &&
      plannerRuntime.processSpawned,
    realCodexPlannerExecuted: input.runner?.codexProcess === undefined &&
      plannerRuntime.processSpawned,
  } as const;
  const realPlannerProcessSpawned =
    input.runner?.codexProcess === undefined && plannerRuntime.processSpawned;
  if (plannerOutcome.outcomeKnown && !plannerOutcome.outcomePersisted) {
    const issues = [...plannerRuntime.issues, ...plannerOutcome.issues];
    const updated = await updateRecord(input.projectRoot, record, "outcome_unknown", null, "not_run", null, issues, {
      realCodexPlannerExecuted: realPlannerProcessSpawned,
    });
    return runResult("planner_outcome_persistence_failed", updated, plannerInvocation, workerInvocation, null, plannerResult, null, 1, 0, issues, plannerOutcomeSafety);
  }
  if (plannerResult === null || plannerResult.outcomeStatus !== "returned") {
    const issues = [
      ...plannerRuntime.issues,
      ...plannerOutcome.issues,
      ...(plannerResult?.issues ?? []),
      ...issueFromWorkerFailure(plannerResult),
    ];
    const lifecycle = plannerOutcome.reconciliationRequired
      ? "outcome_unknown"
      : "planner_failed";
    const updated = await updateRecord(input.projectRoot, record, lifecycle, null, "not_run", null, issues, {
      realCodexPlannerExecuted: realPlannerProcessSpawned,
    });
    return runResult(lifecycle === "outcome_unknown" ? "outcome_unknown" : "planner_failed", updated, plannerInvocation, workerInvocation, null, plannerResult, null, 1, 0, issues, plannerOutcomeSafety);
  }
  const plannerCompletedSafety = {
    ...plannerOutcomeSafety,
  } as const;

  const parsedProposal = routeProposalFromPlannerResult({
    plannerResult,
    expectedTaskId: record.taskId,
    expectedRevision: record.taskRevision,
    expectedWorkItemId: record.workItemId,
    expectedBatchId: record.batchId,
  });
  if (parsedProposal.proposal === null) {
    const updated = await updateRecord(input.projectRoot, record, "route_blocked", null, "blocked", null, parsedProposal.issues, {
      realCodexPlannerExecuted: realPlannerProcessSpawned,
    });
    return runResult("route_blocked", updated, plannerInvocation, workerInvocation, null, plannerResult, null, 1, 0, parsedProposal.issues, plannerCompletedSafety);
  }
  const routeDecision = authorizeTaskExecutionWorkerRoute({
    state,
    proposals: parsedProposal.proposal,
    orchestratorIdentity: codexPlannerIdentity,
    orchestratorCapabilities: plannerCapabilities,
    workerRegistry: [
      {
        identity: claudeWorkerIdentity,
        capabilities: claudeCapabilities,
        eligible: true,
        allowedOperations: ["execute_task_attempt"],
        registrationAuthority: "system",
      },
    ],
    permissionPolicyStatus: {
      authority: "system",
      allowed: true,
      policyContradiction: false,
      permissionContradiction: false,
      capabilityContradiction: false,
      policyRuleRef: "aeos-routing-policy:task-0324-read-only-claude",
    },
    policyRules: [
      {
        ruleRef: "aeos-routing-policy:task-0324-read-only-claude",
        operationKind: "execute_task_attempt",
        allowedWorkerFamilies: ["claude_code"],
        requiredCapabilities: [
          "implementation",
          "repositoryRead",
          "modelReasoning",
          "boundedDiagnostics",
        ],
        allowedPlannerFamilies: ["codex"],
      },
    ],
  });
  if (routeDecision.status !== "authorized" || routeDecision.selectedWorkerFamily !== "claude_code") {
    const routeIssues = routeDecision.issues.map((item) => issue({
      code: item.code,
      message: item.message,
      category: item.category,
    }));
    const updated = await updateRecord(input.projectRoot, record, "route_blocked", routeDecision.decisionId, "blocked", null, routeIssues, {
      realCodexPlannerExecuted: realPlannerProcessSpawned,
    });
    return runResult("route_blocked", updated, plannerInvocation, workerInvocation, routeDecision, plannerResult, null, 1, 0, routeIssues, plannerCompletedSafety);
  }
  const routeCreatedSafety = {
    ...plannerCompletedSafety,
    routeCreated: true,
  } as const;

  const workerGate = evaluateProcessPermission({
    invocation: workerInvocation,
    worker: claudeWorkerIdentity,
    policyRequirement: input.runner?.policyRequirement?.({
      phase: "worker",
      invocation: workerInvocation,
      worker: claudeWorkerIdentity,
    }),
  });
  if (!workerGate.allowed) {
    const gateIssues = workerGate.issues.map((item) => issue({
      code: item.code,
      message: item.message,
      category: item.category,
    }));
    const updated = await updateRecord(input.projectRoot, record, "worker_failed", routeDecision.decisionId, "authorized", "claude_code", gateIssues, {
      realCodexPlannerExecuted: realPlannerProcessSpawned,
    });
    return runResult("worker_failed", updated, plannerInvocation, workerInvocation, routeDecision, plannerResult, null, 1, 0, gateIssues, routeCreatedSafety);
  }
  const workerRequest = createRequest({
    invocation: workerInvocation,
    workerIdentity: claudeWorkerIdentity,
    boundedInstructions:
      "TASK-0324 read-only routed Claude Code canary. Return structured evidence identifying the assigned task/work item and worker family. Do not modify files, run shell commands, use network, route workers, or claim completion authority.",
    contextReferences: ["packages/core/src/task-execution-two-model-canary.ts"],
    permissionFacts: permissionFacts({ gate: workerGate }),
  });
  const claudeConfig = createClaudeConfiguration();
  const preparedWorker = prepareTaskExecutionClaudeCodeWorkerInvocation({
    configuration: claudeConfig,
    request: workerRequest,
    invocationRecord: workerInvocation,
  });
  if (preparedWorker.issues.some((item) => item.severity === "error")) {
    const updated = await updateRecord(input.projectRoot, record, "worker_failed", routeDecision.decisionId, "authorized", "claude_code", preparedWorker.issues, {
      realCodexPlannerExecuted: realPlannerProcessSpawned,
    });
    return runResult("worker_failed", updated, plannerInvocation, workerInvocation, routeDecision, plannerResult, null, 1, 0, preparedWorker.issues, routeCreatedSafety);
  }
  const claudeAuth = await (input.runner?.claudeAuthPreflight ??
    (() => runTaskExecutionClaudeCodeAuthPreflight({ executablePath: trustedClaudeCodeExecutablePath })))();
  if (!claudeAuth.ok) {
    const updated = await updateRecord(input.projectRoot, record, "worker_failed", routeDecision.decisionId, "authorized", "claude_code", claudeAuth.issues, {
      realCodexPlannerExecuted: realPlannerProcessSpawned,
    });
    return runResult("worker_failed", updated, plannerInvocation, workerInvocation, routeDecision, plannerResult, null, 1, 0, claudeAuth.issues, routeCreatedSafety);
  }
  const workerAudit = await appendDispatchAudit({
    projectRoot: input.projectRoot,
    invocation: workerInvocation,
    workerId: claudeWorkerIdentity.workerId,
    permissionGateId: workerGate.policyGateId,
  });
  if (!workerAudit.ok) {
    const updated = await updateRecord(input.projectRoot, record, "worker_failed", routeDecision.decisionId, "authorized", "claude_code", workerAudit.issues, {
      realCodexPlannerExecuted: realPlannerProcessSpawned,
    });
    return runResult("worker_failed", updated, plannerInvocation, workerInvocation, routeDecision, plannerResult, null, 1, 0, workerAudit.issues, routeCreatedSafety);
  }

  let workerRuntime: TaskExecutionLocalWorkerProcessRuntimeResult;
  let workerResult: TaskExecutionWorkerResult | null;
  let workerOutcome = {
    outcomeKnown: false,
    outcomePersisted: false,
    reconciliationRequired: false,
    issues: [] as readonly TaskExecutionWorkerIssue[],
  };
  if (input.runner?.claudeProcess !== undefined) {
    const process = await input.runner.claudeProcess(workerRequest);
    const deterministic = await deterministicProcessResult({
      projectRoot: input.projectRoot,
      invocation: workerInvocation,
      request: workerRequest,
      process,
      normalize: (value) =>
        normalizeTaskExecutionClaudeCodeProcessResult({
          request: workerRequest,
          processResult: value as TaskExecutionClaudeCodeProcessResult,
          stdoutLimitBytes: claudeConfig.stdoutLimitBytes,
          stderrLimitBytes: claudeConfig.stderrLimitBytes,
        }),
    });
    workerRuntime = deterministic.runtime;
    workerResult = deterministic.normalized;
    workerOutcome = {
      outcomeKnown: knownWorkerOutcome(workerResult),
      outcomePersisted:
        workerRuntime.invocationLifecycle === "returned" ||
        workerRuntime.invocationLifecycle === "failed",
      reconciliationRequired: workerRuntime.reconciliationRequired,
      issues: workerRuntime.issues,
    };
  } else {
    const entered = await updateTaskExecutionInvocation({
      projectRoot: input.projectRoot,
      taskId: workerInvocation.taskId,
      invocationId: workerInvocation.invocationId,
      ownershipToken: workerInvocation.ownership.ownershipToken,
      expectedLifecycle: "reserved",
      expectedRevision: workerInvocation.revision,
      intent: { kind: "enter_invocation" },
    });
    if (!entered.ok) {
      const updated = await updateRecord(input.projectRoot, record, "worker_failed", routeDecision.decisionId, "authorized", "claude_code", [createErrorIssue(entered.error)], {
        realCodexPlannerExecuted: realPlannerProcessSpawned,
      });
      return runResult("worker_failed", updated, plannerInvocation, workerInvocation, routeDecision, plannerResult, null, 1, 0, [createErrorIssue(entered.error)], routeCreatedSafety);
    }
    const workerProcessGate = evaluateTaskExecutionClaudeCodeWorkerProcessGate({
      configuration: claudeConfig,
      request: workerRequest,
      invocationRecord: entered.value.record,
      preparedInvocation: preparedWorker.preparedInvocation,
      permissionGateResult: workerGate,
      preProcessAuditEvent: workerAudit.event,
      expectedInvocationRevision: entered.value.record.revision,
    });
    if (!workerProcessGate.ok || workerProcessGate.authority === null) {
      const updated = await updateRecord(input.projectRoot, record, "worker_failed", routeDecision.decisionId, "authorized", "claude_code", workerProcessGate.issues, {
        realCodexPlannerExecuted: realPlannerProcessSpawned,
      });
      return runResult("worker_failed", updated, plannerInvocation, workerInvocation, routeDecision, plannerResult, null, 1, 0, workerProcessGate.issues, {
        ...routeCreatedSafety,
        workerInvocationModified: true,
      });
    }
    workerRuntime = await executeTaskExecutionLocalWorkerProcess({
      projectRoot: input.projectRoot,
      authority: workerProcessGate.authority,
      invocationRecord: entered.value.record,
      preProcessAuditEvent: workerAudit.event,
      executable: {
        authority: "system",
        executableRef: trustedClaudeCodeExecutableRef,
        executableKind: "claude_code",
        executablePath: trustedClaudeCodeExecutablePath,
        executionMode: "real_claude_code_read_only_canary",
      },
      workspace: {
        authority: "system",
        workspaceRef: workspace.workspaceRef,
        projectRef: workspace.projectRef,
        absolutePath: await realpath(input.projectRoot),
        repositoryWriteAllowed: false,
      },
      environment: {
        authority: "system",
        inheritance: "system_claude_code_read_only_canary",
        variables: [],
      },
      stdin: preparedWorker.preparedInvocation.processRequest.stdin,
      forbiddenValues: [entered.value.record.ownership.ownershipToken],
      outcomePersistence: "caller_normalized",
    });
    workerResult =
      workerRuntime.processResult === null
        ? null
        : normalizeTaskExecutionClaudeCodeProcessResult({
            request: workerRequest,
            processResult: workerRuntime.processResult,
            stdoutLimitBytes: claudeConfig.stdoutLimitBytes,
            stderrLimitBytes: claudeConfig.stderrLimitBytes,
          });
    if (
      workerRuntime.invocationLifecycle === "outcome_unknown" &&
      workerRuntime.invocationRevision !== null
    ) {
      const persisted = await persistInvocationOutcomeFromWorkerResult({
        projectRoot: input.projectRoot,
        taskId: record.taskId,
        invocationId: record.workerInvocationId,
        workerResult,
        expectedLifecycle: "outcome_unknown",
        expectedRevision: workerRuntime.invocationRevision,
      });
      workerOutcome = {
        outcomeKnown: persisted.outcomeKnown,
        outcomePersisted: persisted.outcomePersisted,
        reconciliationRequired: persisted.reconciliationRequired,
        issues: persisted.issues,
      };
      workerRuntime = {
        ...workerRuntime,
        invocationLifecycle:
          persisted.record?.lifecycle ?? workerRuntime.invocationLifecycle,
        invocationRevision:
          persisted.record?.revision ?? workerRuntime.invocationRevision,
        reconciliationRequired: persisted.reconciliationRequired,
        issues: [...workerRuntime.issues, ...persisted.issues],
      };
    } else {
      workerOutcome = {
        outcomeKnown: knownWorkerOutcome(workerResult),
        outcomePersisted: false,
        reconciliationRequired: true,
        issues: workerRuntime.issues,
      };
    }
  }
  if (workerOutcome.outcomeKnown && !workerOutcome.outcomePersisted) {
    const issues = [...workerRuntime.issues, ...workerOutcome.issues];
    const finalRecord = await updateRecord(
      input.projectRoot,
      record,
      "outcome_unknown",
      routeDecision.decisionId,
      "authorized",
      "claude_code",
      issues,
      {
        realCodexPlannerExecuted: realPlannerProcessSpawned,
        realClaudeRoutedWorkerExecuted:
          input.runner?.claudeProcess === undefined &&
          workerRuntime.processSpawned,
      },
    );
    return runResult("worker_outcome_persistence_failed", finalRecord, plannerInvocation, workerInvocation, routeDecision, plannerResult, workerResult, 1, 1, issues, {
      ...routeCreatedSafety,
      workerInvocationModified: true,
      realClaudeModelCall: input.runner?.claudeProcess === undefined &&
        workerRuntime.processSpawned,
      realClaudeProcessSpawned: input.runner?.claudeProcess === undefined &&
        workerRuntime.processSpawned,
      realClaudeRoutedWorkerExecuted: input.runner?.claudeProcess === undefined &&
        workerRuntime.processSpawned,
    });
  }

  const finalLifecycle =
    workerResult?.outcomeStatus === "returned"
      ? "worker_returned"
      : workerResult?.outcomeStatus === "failed"
        ? "worker_failed"
        : "outcome_unknown";
  const finalIssues = [...workerRuntime.issues, ...workerOutcome.issues, ...(workerResult?.issues ?? [])];
  const finalRecord = await updateRecord(
    input.projectRoot,
    record,
    finalLifecycle,
    routeDecision.decisionId,
    "authorized",
    "claude_code",
    finalIssues,
    {
      realCodexPlannerExecuted: realPlannerProcessSpawned,
      realClaudeRoutedWorkerExecuted:
        input.runner?.claudeProcess === undefined && workerRuntime.processSpawned,
      realTwoModelCanaryExecuted:
        realPlannerProcessSpawned &&
        input.runner?.claudeProcess === undefined &&
        workerRuntime.processSpawned,
    },
  );
  return runResult(finalLifecycle, finalRecord, plannerInvocation, workerInvocation, routeDecision, plannerResult, workerResult, 1, 1, finalRecord.issues, {
    ...routeCreatedSafety,
    workerInvocationModified: true,
    realClaudeModelCall: input.runner?.claudeProcess === undefined &&
      workerRuntime.processSpawned,
    realClaudeProcessSpawned: input.runner?.claudeProcess === undefined &&
      workerRuntime.processSpawned,
    realClaudeRoutedWorkerExecuted: input.runner?.claudeProcess === undefined &&
      workerRuntime.processSpawned,
  });
}

async function updateRecord(
  projectRoot: string,
  record: TaskExecutionTwoModelCanaryRecord,
  lifecycle: TaskExecutionTwoModelCanaryLifecycle,
  routeDecisionId: string | null,
  routeDecisionStatus: "authorized" | "blocked" | "not_run",
  selectedWorkerFamily: "claude_code" | null,
  issues: readonly TaskExecutionWorkerIssue[],
  executionFlags: {
    readonly realCodexPlannerExecuted?: boolean;
    readonly realClaudeRoutedWorkerExecuted?: boolean;
    readonly realTwoModelCanaryExecuted?: boolean;
  } = {},
): Promise<TaskExecutionTwoModelCanaryRecord> {
  const updated: TaskExecutionTwoModelCanaryRecord = {
    ...record,
    lifecycle,
    routeDecisionId,
    routeDecisionStatus,
    selectedWorkerFamily,
    realCodexPlannerExecuted:
      record.realCodexPlannerExecuted ||
      executionFlags.realCodexPlannerExecuted === true,
    realClaudeRoutedWorkerExecuted:
      record.realClaudeRoutedWorkerExecuted ||
      executionFlags.realClaudeRoutedWorkerExecuted === true,
    realTwoModelCanaryExecuted:
      record.realTwoModelCanaryExecuted ||
      executionFlags.realTwoModelCanaryExecuted === true,
    updatedAt: new Date().toISOString(),
    issues,
  };
  const saved = await saveCanaryRecord({ projectRoot, record: updated });
  return saved.ok ? saved.record : updated;
}

function runResult(
  status: TaskExecutionTwoModelCanaryRunResult["status"],
  orchestration: TaskExecutionTwoModelCanaryRecord | null,
  plannerInvocation: TaskExecutionInvocationRecord | null,
  workerInvocation: TaskExecutionInvocationRecord | null,
  routeDecision: TaskExecutionWorkerRoutingDecision | null,
  plannerResult: TaskExecutionWorkerResult | null,
  workerResult: TaskExecutionWorkerResult | null,
  plannerCalls: 0 | 1,
  workerCalls: 0 | 1,
  issues: readonly TaskExecutionWorkerIssue[],
  safetyOverrides: Partial<TaskExecutionTwoModelCanaryRunResult["safety"]> = {},
): TaskExecutionTwoModelCanaryRunResult {
  const defaultSafety = {
    orchestrationPrepared: orchestration?.lifecycle === "prepared",
    orchestrationConsumed:
      orchestration !== null && orchestration.lifecycle !== "prepared",
    plannerAuthChecked: false,
    plannerAuthReady: false,
    plannerProcessOutcomeKnown: false,
    plannerInvocationOutcomePersisted: false,
    plannerReconciliationRequired: false,
    plannerInvocationModified: false,
    plannerOneShotConsumed: false,
    realCodexModelCall: false,
    realCodexProcessSpawned: false,
    routeCreated: false,
    realClaudeModelCall: false,
    realClaudeProcessSpawned: false,
    workerInvocationModified: false,
    realCodexPlannerExecuted: false,
    realClaudeRoutedWorkerExecuted: false,
    repositoryWriteAllowed: false,
    shellAllowed: false,
    primaryApplyAllowed: false,
    automaticLoopEnabled: false,
    completionAuthority: false,
    verifierRun: false,
    taskCompleted: false,
    workCompleted: false,
    cloudCalls: 0,
  } as const;

  return {
    ok: status === "worker_returned",
    status,
    orchestration,
    plannerInvocation,
    workerInvocation,
    routeDecision,
    plannerResult,
    workerResult,
    plannerCalls,
    workerCalls,
    issues,
    safety: {
      ...defaultSafety,
      ...safetyOverrides,
    },
  };
}

export function createTaskExecutionTwoModelCanaryCodexFixtureResult(input: {
  readonly request: TaskExecutionWorkerRequest;
  readonly proposal?: Partial<TaskExecutionWorkerRoutingProposal> | null;
  readonly terminationReason?: TaskExecutionCodexProcessResult["terminationReason"];
  readonly exitCode?: number | null;
  readonly stdout?: string;
  readonly stderr?: string;
  readonly stdinBytes?: number;
  readonly stdinWriteCompleted?: boolean;
  readonly stdinClosed?: boolean;
}): TaskExecutionCodexProcessResult {
  const proposal = input.proposal === null
    ? null
    : {
        taskId: input.request.taskId,
        sourceTaskRevision: input.request.sourceTaskRevision,
        workItemId: input.request.workItemId ?? TASK_EXECUTION_TWO_MODEL_CANARY_WORK_ITEM_ID,
        batchId: input.request.batchId ?? TASK_EXECUTION_TWO_MODEL_CANARY_BATCH_ID,
        operationKind: "execute_task_attempt",
        recommendedWorkerFamily: "claude_code",
        capabilityRequirements: [
          "implementation",
          "repositoryRead",
          "modelReasoning",
          "boundedDiagnostics",
        ],
        reasonReference:
          "aeos://task/TASK-0324/operation/read-only-routed-worker-canary",
        expectedOperationClass: "implementation",
        ...(input.proposal ?? {}),
      };
  const stdout = input.stdout ?? JSON.stringify({
    aeosCodexWorkerResultVersion: 1,
    status: "returned",
    workerId: input.request.workerIdentity.workerId,
    workerFamily: input.request.workerIdentity.workerFamily,
    runtimeKind: input.request.workerIdentity.runtimeKind,
    invocationId: input.request.invocationId,
    idempotencyKey: input.request.idempotencyKey,
    taskId: input.request.taskId,
    sourceTaskRevision: input.request.sourceTaskRevision,
    attemptId: input.request.attemptId,
    attemptNumber: input.request.attemptNumber,
    workItemId: input.request.workItemId ?? null,
    batchId: input.request.batchId ?? null,
    invocationOk: true,
    output: proposal === null ? {} : { routingProposal: proposal },
    diagnosticCode: "task_0324_codex_planner_routing_proposal",
  });

  return {
    invocationRef: `test-codex-planner:${input.request.invocationId}`,
    terminationReason: input.terminationReason ?? "exited",
    exitCode: input.exitCode ?? 0,
    stdinMode: "pipe",
    stdinBytes: input.stdinBytes ?? 1,
    stdinWriteCompleted: input.stdinWriteCompleted ?? true,
    stdinClosed: input.stdinClosed ?? true,
    timedOut: input.terminationReason === "timeout",
    interrupted: false,
    stderr: input.stderr ?? "",
    stdout,
  };
}

export function createTaskExecutionTwoModelCanaryClaudeFixtureResult(input: {
  readonly request: TaskExecutionWorkerRequest;
  readonly status?: "returned" | "failed" | "in_progress";
  readonly stdout?: string;
}): TaskExecutionClaudeCodeProcessResult {
  const status = input.status ?? "returned";

  return {
    invocationRef: `test-claude-routed-worker:${input.request.invocationId}`,
    terminationReason: "exited",
    exitCode: 0,
    timedOut: false,
    interrupted: false,
    stderr: "",
    stdout: input.stdout ?? JSON.stringify({
      aeosClaudeCodeWorkerResultVersion: 1,
      status,
      workerId: input.request.workerIdentity.workerId,
      workerFamily: input.request.workerIdentity.workerFamily,
      runtimeKind: input.request.workerIdentity.runtimeKind,
      invocationId: input.request.invocationId,
      idempotencyKey: input.request.idempotencyKey,
      taskId: input.request.taskId,
      sourceTaskRevision: input.request.sourceTaskRevision,
      attemptId: input.request.attemptId,
      attemptNumber: input.request.attemptNumber,
      workItemId: input.request.workItemId ?? null,
      batchId: input.request.batchId ?? null,
      invocationOk: status === "returned",
      output: {
        assignedTaskId: input.request.taskId,
        assignedWorkItemId: input.request.workItemId ?? null,
        workerFamily: input.request.workerIdentity.workerFamily,
        allComplete: true,
        taskCompleted: true,
        verified: true,
      },
      diagnosticCode: "task_0324_claude_routed_read_only_worker",
      completed: true,
      verified: true,
      taskCompleted: true,
    }),
  };
}
