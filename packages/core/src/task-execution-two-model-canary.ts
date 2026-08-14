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
import type { TaskExecutionAttempt } from "./task-execution-attempt.js";
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
  TaskExecutionInvocationRecord,
} from "./task-execution-invocation-record.js";
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
import {
  deriveTaskExecutionPolicyGateId,
} from "./task-execution-policy-approval.js";
import type {
  TaskExecutionAdapterCapabilities,
  TaskExecutionAdapterIdentity,
  TaskExecutionAdapterPermissions,
} from "./task-execution-adapter.js";
import {
  authorizeTaskExecutionWorkerProcess,
  normalizeTaskExecutionCodexProcessResult,
  prepareTaskExecutionCodexWorkerInvocation,
} from "./task-execution-codex-worker.js";
import type {
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
  readonly realCodexPlannerExecuted: false;
  readonly realClaudeRoutedWorkerExecuted: false;
  readonly realTwoModelCanaryExecuted: false;
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

export interface TaskExecutionTwoModelCanaryRunResult {
  readonly ok: boolean;
  readonly status:
    | "worker_returned"
    | "planner_failed"
    | "route_blocked"
    | "worker_failed"
    | "outcome_unknown"
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
  readonly claudeAuthPreflight?: () => Promise<TaskExecutionClaudeCodeAuthPreflightResult>;
  readonly codexProcess?: (
    request: TaskExecutionWorkerRequest,
  ) => Promise<TaskExecutionCodexProcessResult>;
  readonly claudeProcess?: (
    request: TaskExecutionWorkerRequest,
  ) => Promise<TaskExecutionClaudeCodeProcessResult>;
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

function createCanaryTaskState(now: string): PersistedTaskState {
  const state = createInitialTaskState({
    taskId: TASK_EXECUTION_TWO_MODEL_CANARY_TASK_ID,
    sourceTaskId: "TASK-0324",
    verifierRequired: true,
    createdAt: now,
  });
  const pendingIds = [
    TASK_EXECUTION_TWO_MODEL_CANARY_WORK_ITEM_ID,
    ...Array.from({ length: 379 }, (_item, index) =>
      `task-0324-pending-${String(index + 2).padStart(3, "0")}`,
    ),
  ];
  const accountedIds = Array.from({ length: 20 }, (_item, index) =>
    `task-0324-accounted-${String(index + 1).padStart(3, "0")}`,
  );
  const workItems = [
    {
      id: TASK_EXECUTION_TWO_MODEL_CANARY_WORK_ITEM_ID,
      state: "pending" as const,
      title: "TASK-0324 read-only routed two-model canary",
      source: "aeos://task/TASK-0324",
      batchId: TASK_EXECUTION_TWO_MODEL_CANARY_BATCH_ID,
      expectedArtifacts: ["artifact:task-0324-route-evidence"],
      updatedAt: now,
    },
    ...pendingIds.slice(1).map((id) => ({
      id,
      state: "pending" as const,
      batchId: TASK_EXECUTION_TWO_MODEL_CANARY_BATCH_ID,
      updatedAt: now,
    })),
    ...accountedIds.map((id) => ({
      id,
      state: "skipped" as const,
      batchId: TASK_EXECUTION_TWO_MODEL_CANARY_BATCH_ID,
      updatedAt: now,
    })),
  ];

  return {
    ...state,
    lifecycleState: "planned",
    workItems,
    batches: [
      {
        id: TASK_EXECUTION_TWO_MODEL_CANARY_BATCH_ID,
        workItemIds: [...pendingIds, ...accountedIds],
        expectedItemCount: 400,
        completedCount: 0,
        failedCount: 0,
        skippedCount: 20,
        retryableCount: 0,
      },
    ],
    pendingWorkItemIds: pendingIds,
    currentBatchId: TASK_EXECUTION_TWO_MODEL_CANARY_BATCH_ID,
    nextBatchId: TASK_EXECUTION_TWO_MODEL_CANARY_BATCH_ID,
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
    workItemId: TASK_EXECUTION_TWO_MODEL_CANARY_WORK_ITEM_ID,
    batchId: TASK_EXECUTION_TWO_MODEL_CANARY_BATCH_ID,
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
}): Promise<TaskExecutionTwoModelCanaryPrepareResult> {
  const now = input.now ?? new Date().toISOString();
  const existing = await loadTaskExecutionTwoModelCanaryRecord({
    projectRoot: input.projectRoot,
    taskId: TASK_EXECUTION_TWO_MODEL_CANARY_TASK_ID,
    orchestrationId: TASK_EXECUTION_TWO_MODEL_CANARY_ORCHESTRATION_ID,
  });
  if (existing.ok) {
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

  const state = createCanaryTaskState(now);
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
    orchestrationId: TASK_EXECUTION_TWO_MODEL_CANARY_ORCHESTRATION_ID,
    taskId: savedState.value.state.taskId,
    taskRevision: savedState.value.state.revision,
    workItemId: TASK_EXECUTION_TWO_MODEL_CANARY_WORK_ITEM_ID,
    batchId: TASK_EXECUTION_TWO_MODEL_CANARY_BATCH_ID,
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

function evaluateProcessPermission(input: {
  readonly invocation: TaskExecutionInvocationRecord;
  readonly worker: TaskExecutionWorkerIdentity;
}) {
  const adapterIdentity = createAdapterIdentity(input.worker);
  const policyGateId = deriveTaskExecutionPolicyGateId({
    taskId: input.invocation.taskId,
    taskStateRevision: input.invocation.taskStateRevision,
    attemptId: input.invocation.attemptId,
    invocationId: input.invocation.invocationId,
  });

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
    policyRequirement: {
      required: false,
      policyGateId: policyGateId.ok
        ? policyGateId.value
        : "policy-gate:task-0324-invalid",
      authority: "system",
    },
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
      model: "gpt-5-codex",
      reasoningEffort: "minimal",
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

  const forbidden = [
    "invokeNow",
    "completed",
    "verified",
    "safeToRetry",
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
  if (
    proposalValue.taskId !== input.expectedTaskId ||
    proposalValue.sourceTaskRevision !== input.expectedRevision ||
    proposalValue.workItemId !== input.expectedWorkItemId ||
    (proposalValue.batchId ?? input.expectedBatchId) !== input.expectedBatchId ||
    proposalValue.operationKind !== "execute_task_attempt" ||
    proposalValue.recommendedWorkerFamily !== "claude_code" ||
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
                  normalized.failure?.code ??
                  "task_execution_two_model_canary_deterministic_worker_failed",
                category: "execution_failure",
                retryable: false,
                diagnostic: normalized.failure?.message,
              },
            },
  });

  const record = update.ok ? update.value.record : entered.value.record;
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
      "TASK-0324 fixed planner canary. Return only a structured routing proposal recommending claude_code for the supplied read-only repository reasoning work item. Do not implement code, edit files, run shell, launch workers, or claim completion.",
    contextReferences: ["aeos://task/TASK-0324/operation/read-only-routed-worker-canary"],
    permissionFacts: permissionFacts({ gate: plannerGate }),
  });
  const plannerConfig = createPlannerConfiguration();
  const codexAuth = await (input.runner?.codexAuthPreflight ??
    (() => runTaskExecutionCodexAuthPreflight({ executablePath: trustedCodexExecutablePath })))();
  if (!codexAuth.ok) {
    return runResult("planner_failed", record, plannerInvocation, workerInvocation, null, null, null, 0, 0, codexAuth.issues);
  }
  const plannerAudit = await appendDispatchAudit({
    projectRoot: input.projectRoot,
    invocation: plannerInvocation,
    workerId: codexPlannerIdentity.workerId,
    permissionGateId: plannerGate.policyGateId,
  });
  if (!plannerAudit.ok) {
    return runResult("planner_failed", record, plannerInvocation, workerInvocation, null, null, null, 0, 0, plannerAudit.issues);
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
    return runResult("planner_failed", record, plannerInvocation, workerInvocation, null, null, null, 0, 0, [createErrorIssue(enteredPlanner.error)]);
  }
  const preparedPlanner = prepareTaskExecutionCodexWorkerInvocation({
    configuration: plannerConfig,
    request: plannerRequest,
    invocationRecord: enteredPlanner.value.record,
  });
  if (preparedPlanner.issues.some((item) => item.severity === "error")) {
    return runResult("planner_failed", record, plannerInvocation, workerInvocation, null, null, null, 0, 0, preparedPlanner.issues);
  }

  let plannerRuntime: TaskExecutionLocalWorkerProcessRuntimeResult;
  let plannerResult: TaskExecutionWorkerResult | null = null;
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
      return runResult("planner_failed", record, plannerInvocation, workerInvocation, null, null, null, 0, 0, plannerProcessGate.issues);
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
        inheritance: "none",
        variables: [],
      },
      stdin: preparedPlanner.preparedInvocation.processRequest.stdin,
      forbiddenValues: [enteredPlanner.value.record.ownership.ownershipToken],
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
  }
  if (plannerResult === null || plannerResult.outcomeStatus !== "returned") {
    const updated = await updateRecord(input.projectRoot, record, "planner_failed", null, "not_run", null, plannerRuntime.issues);
    return runResult("planner_failed", updated, plannerInvocation, workerInvocation, null, plannerResult, null, 1, 0, plannerRuntime.issues);
  }

  const parsedProposal = routeProposalFromPlannerResult({
    plannerResult,
    expectedTaskId: record.taskId,
    expectedRevision: record.taskRevision,
    expectedWorkItemId: record.workItemId,
    expectedBatchId: record.batchId,
  });
  if (parsedProposal.proposal === null) {
    const updated = await updateRecord(input.projectRoot, record, "route_blocked", null, "blocked", null, parsedProposal.issues);
    return runResult("route_blocked", updated, plannerInvocation, workerInvocation, null, plannerResult, null, 1, 0, parsedProposal.issues);
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
    const updated = await updateRecord(input.projectRoot, record, "route_blocked", routeDecision.decisionId, "blocked", null, routeIssues);
    return runResult("route_blocked", updated, plannerInvocation, workerInvocation, routeDecision, plannerResult, null, 1, 0, routeIssues);
  }

  const workerGate = evaluateProcessPermission({
    invocation: workerInvocation,
    worker: claudeWorkerIdentity,
  });
  if (!workerGate.allowed) {
    const gateIssues = workerGate.issues.map((item) => issue({
      code: item.code,
      message: item.message,
      category: item.category,
    }));
    const updated = await updateRecord(input.projectRoot, record, "worker_failed", routeDecision.decisionId, "authorized", "claude_code", gateIssues);
    return runResult("worker_failed", updated, plannerInvocation, workerInvocation, routeDecision, plannerResult, null, 1, 0, gateIssues);
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
    const updated = await updateRecord(input.projectRoot, record, "worker_failed", routeDecision.decisionId, "authorized", "claude_code", preparedWorker.issues);
    return runResult("worker_failed", updated, plannerInvocation, workerInvocation, routeDecision, plannerResult, null, 1, 0, preparedWorker.issues);
  }
  const claudeAuth = await (input.runner?.claudeAuthPreflight ??
    (() => runTaskExecutionClaudeCodeAuthPreflight({ executablePath: trustedClaudeCodeExecutablePath })))();
  if (!claudeAuth.ok) {
    const updated = await updateRecord(input.projectRoot, record, "worker_failed", routeDecision.decisionId, "authorized", "claude_code", claudeAuth.issues);
    return runResult("worker_failed", updated, plannerInvocation, workerInvocation, routeDecision, plannerResult, null, 1, 0, claudeAuth.issues);
  }
  const workerAudit = await appendDispatchAudit({
    projectRoot: input.projectRoot,
    invocation: workerInvocation,
    workerId: claudeWorkerIdentity.workerId,
    permissionGateId: workerGate.policyGateId,
  });
  if (!workerAudit.ok) {
    const updated = await updateRecord(input.projectRoot, record, "worker_failed", routeDecision.decisionId, "authorized", "claude_code", workerAudit.issues);
    return runResult("worker_failed", updated, plannerInvocation, workerInvocation, routeDecision, plannerResult, null, 1, 0, workerAudit.issues);
  }

  let workerRuntime: TaskExecutionLocalWorkerProcessRuntimeResult;
  let workerResult: TaskExecutionWorkerResult | null;
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
      const updated = await updateRecord(input.projectRoot, record, "worker_failed", routeDecision.decisionId, "authorized", "claude_code", [createErrorIssue(entered.error)]);
      return runResult("worker_failed", updated, plannerInvocation, workerInvocation, routeDecision, plannerResult, null, 1, 0, [createErrorIssue(entered.error)]);
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
      const updated = await updateRecord(input.projectRoot, record, "worker_failed", routeDecision.decisionId, "authorized", "claude_code", workerProcessGate.issues);
      return runResult("worker_failed", updated, plannerInvocation, workerInvocation, routeDecision, plannerResult, null, 1, 0, workerProcessGate.issues);
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
  }

  const finalLifecycle =
    workerResult?.outcomeStatus === "returned"
      ? "worker_returned"
      : workerResult?.outcomeStatus === "failed"
        ? "worker_failed"
        : "outcome_unknown";
  const finalRecord = await updateRecord(
    input.projectRoot,
    record,
    finalLifecycle,
    routeDecision.decisionId,
    "authorized",
    "claude_code",
    [...workerRuntime.issues, ...(workerResult?.issues ?? [])],
  );
  return runResult(finalLifecycle, finalRecord, plannerInvocation, workerInvocation, routeDecision, plannerResult, workerResult, 1, 1, finalRecord.issues);
}

async function updateRecord(
  projectRoot: string,
  record: TaskExecutionTwoModelCanaryRecord,
  lifecycle: TaskExecutionTwoModelCanaryLifecycle,
  routeDecisionId: string | null,
  routeDecisionStatus: "authorized" | "blocked" | "not_run",
  selectedWorkerFamily: "claude_code" | null,
  issues: readonly TaskExecutionWorkerIssue[],
): Promise<TaskExecutionTwoModelCanaryRecord> {
  const updated: TaskExecutionTwoModelCanaryRecord = {
    ...record,
    lifecycle,
    routeDecisionId,
    routeDecisionStatus,
    selectedWorkerFamily,
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
): TaskExecutionTwoModelCanaryRunResult {
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
    },
  };
}

export function createTaskExecutionTwoModelCanaryCodexFixtureResult(input: {
  readonly request: TaskExecutionWorkerRequest;
  readonly proposal?: Partial<TaskExecutionWorkerRoutingProposal> | null;
  readonly terminationReason?: TaskExecutionCodexProcessResult["terminationReason"];
  readonly exitCode?: number | null;
  readonly stdout?: string;
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
    timedOut: input.terminationReason === "timeout",
    interrupted: false,
    stderr: "",
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
