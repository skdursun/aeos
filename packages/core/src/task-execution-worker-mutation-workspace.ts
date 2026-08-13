import type {
  TaskExecutionWorkerFamily,
  TaskExecutionWorkerIdentity,
  TaskExecutionWorkerIssue,
} from "./task-execution-worker.js";
import { AEOS_TASK_EXECUTION_AUDIT_SCHEMA_VERSION } from "./task-execution-audit.js";
import type { AeosError } from "./types.js";

// @ts-ignore Node built-ins are available at runtime; this package does not depend on Node ambient types yet.
import { createHash } from "node:crypto";
// @ts-ignore Node built-ins are available at runtime; this package does not depend on Node ambient types yet.
import * as fsPromises from "node:fs/promises";
// @ts-ignore Node built-ins are available at runtime; this package does not depend on Node ambient types yet.
import { tmpdir } from "node:os";
// @ts-ignore Node built-ins are available at runtime; this package does not depend on Node ambient types yet.
import { dirname, isAbsolute, join, relative, sep } from "node:path";

const {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  unlink,
  writeFile,
} = fsPromises;

export const TASK_EXECUTION_MUTATION_WORKSPACE_AUTHORITY_READY = true;
export const TASK_EXECUTION_MUTATION_WORKSPACE_PRIMARY_APPLY_ENABLED = false;
export const TASK_EXECUTION_MUTATION_WORKSPACE_AUTOMATIC_PATCH_APPLY_ENABLED =
  false;
export const TASK_EXECUTION_MUTATION_WORKSPACE_REAL_CODEX_CALLS = 0;
export const TASK_EXECUTION_MUTATION_WORKSPACE_REAL_CLAUDE_CALLS = 0;
export const TASK_EXECUTION_MUTATION_WORKSPACE_CLOUD_CALLS = 0;

export type TaskExecutionMutationOperationKind =
  | "update_existing_file"
  | "create_file";

export type TaskExecutionTestMutationOperationKind =
  | TaskExecutionMutationOperationKind
  | "fixture_direct_write"
  | "fixture_delete"
  | "fixture_symlink";

export type TaskExecutionMutationFileOperation =
  | "created"
  | "updated"
  | "deleted";

export interface TaskExecutionWorkerMutationScope {
  readonly authority: "system";
  readonly scopeId: string;
  readonly allowedPathRefs: readonly string[];
  readonly allowedOperations: readonly TaskExecutionMutationOperationKind[];
  readonly maxChangedFiles: number;
  readonly maxTotalChangedBytes: number;
  readonly protectedPathRefs?: readonly string[];
  readonly repositoryWritePermission: true;
  readonly deleteAllowed: false;
}

export interface TaskExecutionIsolatedMutationWorkspaceAuthority {
  readonly authority: "system";
  readonly strategy: "system_temp_allowed_file_materialization";
  readonly systemCreated: true;
  readonly taskId: string;
  readonly taskRevision: number;
  readonly attemptId: string;
  readonly attemptNumber: number;
  readonly invocationId: string;
  readonly invocationRevision: number;
  readonly idempotencyKey: string;
  readonly workerId: string;
  readonly workerFamily: TaskExecutionWorkerFamily;
  readonly sourceProjectRef: string;
  readonly sourceWorkspaceRef: string;
  readonly sourceWorkspaceRoot: string;
  readonly isolatedWorkspaceRef: string;
  readonly isolatedWorkspaceRoot: string;
  readonly systemWorkspaceRoot: string;
  readonly mutationScope: TaskExecutionWorkerMutationScope;
  readonly oneShotMutationKey: string;
  readonly primaryWorkspaceMutationEnabled: false;
  readonly automaticPatchApplyEnabled: false;
}

export interface TaskExecutionMutationWorkspaceEntry {
  readonly relativePath: string;
  readonly entryKind: "file" | "symlink";
  readonly sizeBytes: number;
  readonly digest: string;
}

export interface TaskExecutionMutationWorkspaceBaseline {
  readonly authority: "system";
  readonly isolatedWorkspaceRef: string;
  readonly capturedAt: string;
  readonly entries: readonly TaskExecutionMutationWorkspaceEntry[];
}

export interface TaskExecutionMutationFileEvidence {
  readonly relativePath: string;
  readonly operation: TaskExecutionMutationFileOperation;
  readonly beforeDigest: string | null;
  readonly afterDigest: string | null;
  readonly beforeBytes: number;
  readonly afterBytes: number;
  readonly changedBytes: number;
  readonly scopeAllowed: boolean;
  readonly protectedPath: boolean;
}

export interface TaskExecutionMutationEvidence {
  readonly authority: "system";
  readonly baselineCapturedAt: string;
  readonly observedAt: string;
  readonly actualChangedPaths: readonly string[];
  readonly changedFiles: readonly TaskExecutionMutationFileEvidence[];
  readonly totalChangedFiles: number;
  readonly totalChangedBytes: number;
  readonly scopeCompliant: boolean;
  readonly unexpectedMutations: readonly string[];
  readonly protectedPathViolations: readonly string[];
  readonly maxFilesExceeded: boolean;
  readonly maxBytesExceeded: boolean;
  readonly workerDeclaredChangedFiles: readonly string[];
  readonly workerSelfReportAuthoritative: false;
}

export type TaskExecutionMutationAuditFactKind =
  | "mutation_workspace_created"
  | "mutation_authority_granted"
  | "test_worker_mutation_intent"
  | "actual_mutation_evidence";

export interface TaskExecutionMutationAuditFact {
  readonly auditSchemaVersion: typeof AEOS_TASK_EXECUTION_AUDIT_SCHEMA_VERSION;
  readonly factKind: TaskExecutionMutationAuditFactKind;
  readonly taskId: string;
  readonly taskRevision: number;
  readonly attemptId: string;
  readonly invocationId: string;
  readonly invocationRevision: number;
  readonly workerId: string;
  readonly workerFamily: TaskExecutionWorkerFamily;
  readonly isolatedWorkspaceRef: string;
  readonly sourceWorkspaceRef: string;
  readonly mutationScopeId: string;
  readonly resultReference: string;
  readonly fileContentsLogged: false;
  readonly authorizesMutation: false;
  readonly authorizesPrimaryApply: false;
}

export interface TaskExecutionTestMutationOperation {
  readonly kind: TaskExecutionTestMutationOperationKind;
  readonly relativePath: string;
  readonly content?: string;
  readonly symlinkTarget?: string;
}

export interface CreateTaskExecutionIsolatedMutationWorkspaceInput {
  readonly taskId: string;
  readonly taskRevision: number;
  readonly attemptId: string;
  readonly attemptNumber: number;
  readonly invocationId: string;
  readonly invocationRevision: number;
  readonly idempotencyKey: string;
  readonly workerIdentity: TaskExecutionWorkerIdentity;
  readonly sourceProjectRef: string;
  readonly sourceWorkspaceRef: string;
  readonly sourceWorkspaceRoot: string;
  readonly mutationScope: TaskExecutionWorkerMutationScope;
  readonly taskOrModelWorkspacePathClaims?: unknown;
  readonly occurredAt?: string;
}

export interface TaskExecutionMutationWorkspaceCreationResult {
  readonly ok: boolean;
  readonly authority: TaskExecutionIsolatedMutationWorkspaceAuthority | null;
  readonly auditFacts: readonly TaskExecutionMutationAuditFact[];
  readonly issues: readonly TaskExecutionWorkerIssue[];
  readonly ActualCodexModelCalls: 0;
  readonly ActualClaudeModelCalls: 0;
  readonly CloudCalls: 0;
}

export interface ExecuteTaskExecutionIsolatedTestMutationInput {
  readonly authority: TaskExecutionIsolatedMutationWorkspaceAuthority;
  readonly operations: readonly TaskExecutionTestMutationOperation[];
  readonly workerDeclaredChangedFiles?: readonly string[];
  readonly workerCompletionClaims?: unknown;
  readonly occurredAt?: string;
}

export interface TaskExecutionIsolatedTestMutationResult {
  readonly ok: boolean;
  readonly status:
    | "mutation_returned"
    | "mutation_rejected"
    | "launch_blocked";
  readonly baseline: TaskExecutionMutationWorkspaceBaseline | null;
  readonly evidence: TaskExecutionMutationEvidence | null;
  readonly oneShotAuthorityConsumed: boolean;
  readonly testWorkerInvoked: boolean;
  readonly primaryWorkspaceModified: false;
  readonly primaryWorkspaceApplyEnabled: false;
  readonly automaticPatchApplyEnabled: false;
  readonly workerSelfReportAuthoritative: false;
  readonly completionAuthorityGranted: false;
  readonly ActualCodexModelCalls: 0;
  readonly ActualClaudeModelCalls: 0;
  readonly CloudCalls: 0;
  readonly auditFacts: readonly TaskExecutionMutationAuditFact[];
  readonly issues: readonly TaskExecutionWorkerIssue[];
  readonly safety: {
    readonly isolatedWorkspaceWritten: boolean;
    readonly primaryWorkspaceWritten: false;
    readonly shellExecuted: false;
    readonly packageInstallationAllowed: false;
    readonly gitCommitAllowed: false;
    readonly taskCompleted: false;
    readonly verifierRun: false;
    readonly completionGateSatisfied: false;
    readonly realCodexInvoked: false;
    readonly realClaudeCodeInvoked: false;
    readonly cloudCalled: false;
    readonly workerSelfReportAuthoritative: false;
  };
}

export interface TaskExecutionMutationWorkspaceCleanupResult {
  readonly ok: boolean;
  readonly removed: boolean;
  readonly issues: readonly TaskExecutionWorkerIssue[];
}

const safeRefPattern = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,191}$/;
const consumedMutationKeys = new Set<string>();

const defaultProtectedPathRefs = [
  ".git",
  ".aeos",
  ".codex",
  "AGENTS.md",
  "PROJECT_CONTEXT.md",
] as const;

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

function isSafeRef(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value === value.trim() &&
    safeRefPattern.test(value) &&
    value !== "." &&
    value !== ".." &&
    !value.includes("../") &&
    !value.includes("..\\") &&
    !value.startsWith("/") &&
    !/^[A-Za-z]:[\\/]/.test(value)
  );
}

function isPositiveInteger(value: unknown, max: number): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= max
  );
}

function normalizeRelativePath(value: string): string | null {
  if (
    value.length === 0 ||
    value.length > 512 ||
    isAbsolute(value) ||
    value.includes("\\") ||
    value.includes("\0") ||
    /^[A-Za-z]:[\\/]/.test(value)
  ) {
    return null;
  }

  const parts = value.split("/");

  if (
    parts.length === 0 ||
    parts.some((part) => part.length === 0 || part === "." || part === "..")
  ) {
    return null;
  }

  return parts.join("/");
}

function protectedPathRefs(
  scope: TaskExecutionWorkerMutationScope,
): readonly string[] {
  return [...defaultProtectedPathRefs, ...(scope.protectedPathRefs ?? [])];
}

function pathMatchesProtected(
  pathRef: string,
  scope: TaskExecutionWorkerMutationScope,
): boolean {
  return protectedPathRefs(scope).some(
    (protectedRef) =>
      pathRef === protectedRef || pathRef.startsWith(`${protectedRef}/`),
  );
}

function isPathAllowedByScope(
  pathRef: string,
  scope: TaskExecutionWorkerMutationScope,
): boolean {
  return scope.allowedPathRefs.includes(pathRef);
}

function validateMutationScope(
  scope: TaskExecutionWorkerMutationScope,
): readonly TaskExecutionWorkerIssue[] {
  const issues: TaskExecutionWorkerIssue[] = [];

  if (
    scope.authority !== "system" ||
    !isSafeRef(scope.scopeId) ||
    scope.repositoryWritePermission !== true ||
    scope.deleteAllowed !== false ||
    !Array.isArray(scope.allowedPathRefs) ||
    scope.allowedPathRefs.length === 0 ||
    !Array.isArray(scope.allowedOperations) ||
    scope.allowedOperations.length === 0 ||
    !isPositiveInteger(scope.maxChangedFiles, 100) ||
    !isPositiveInteger(scope.maxTotalChangedBytes, 1024 * 1024)
  ) {
    issues.push(
      issue({
        code: "task_execution_mutation_scope_invalid",
        message:
          "Mutation scope must be system-owned, explicit, bounded, write-authorized, and non-empty.",
        category: "permission",
      }),
    );
  }

  for (const pathRef of scope.allowedPathRefs ?? []) {
    const normalized = normalizeRelativePath(pathRef);

    if (normalized === null || normalized !== pathRef) {
      issues.push(
        issue({
          code: "task_execution_mutation_scope_path_invalid",
          message:
            "Mutation scope allowed paths must be normalized relative file paths without traversal or absolute authority.",
          category: "permission",
        }),
      );
      continue;
    }

    if (pathMatchesProtected(pathRef, scope)) {
      issues.push(
        issue({
          code: "task_execution_mutation_scope_protected_path",
          message:
            "Mutation scope cannot authorize protected repository, runtime, tooling, or project-instruction paths.",
          category: "permission",
        }),
      );
    }
  }

  for (const operation of scope.allowedOperations ?? []) {
    if (operation !== "update_existing_file" && operation !== "create_file") {
      issues.push(
        issue({
          code: "task_execution_mutation_scope_operation_invalid",
          message:
            "Mutation scope supports only bounded existing-file updates and optional file creation.",
          category: "permission",
        }),
      );
    }
  }

  return issues;
}

function isInsideOrEqual(parent: string, child: string): boolean {
  const diff = relative(parent, child);
  return diff === "" || (!diff.startsWith("..") && !isAbsolute(diff));
}

function stableWorkspaceRef(input: CreateTaskExecutionIsolatedMutationWorkspaceInput): string {
  return [
    "mutation",
    input.taskId,
    `r${input.taskRevision}`,
    input.attemptId,
    input.invocationId,
    `ir${input.invocationRevision}`,
    input.workerIdentity.workerId,
  ]
    .map((part) => part.replace(/[^A-Za-z0-9._:-]/g, "_"))
    .join(":")
    .slice(0, 255);
}

function digestContent(content: string | Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

function mutationAuditFact(input: {
  readonly authority: TaskExecutionIsolatedMutationWorkspaceAuthority;
  readonly factKind: TaskExecutionMutationAuditFactKind;
  readonly resultReference: string;
}): TaskExecutionMutationAuditFact {
  return {
    auditSchemaVersion: AEOS_TASK_EXECUTION_AUDIT_SCHEMA_VERSION,
    factKind: input.factKind,
    taskId: input.authority.taskId,
    taskRevision: input.authority.taskRevision,
    attemptId: input.authority.attemptId,
    invocationId: input.authority.invocationId,
    invocationRevision: input.authority.invocationRevision,
    workerId: input.authority.workerId,
    workerFamily: input.authority.workerFamily,
    isolatedWorkspaceRef: input.authority.isolatedWorkspaceRef,
    sourceWorkspaceRef: input.authority.sourceWorkspaceRef,
    mutationScopeId: input.authority.mutationScope.scopeId,
    resultReference: input.resultReference,
    fileContentsLogged: false,
    authorizesMutation: false,
    authorizesPrimaryApply: false,
  };
}

async function safeRealpath(path: string): Promise<string | null> {
  try {
    return await realpath(path);
  } catch {
    return null;
  }
}

async function copyAllowedSourceFiles(input: {
  readonly sourceRoot: string;
  readonly isolatedRoot: string;
  readonly scope: TaskExecutionWorkerMutationScope;
}): Promise<readonly TaskExecutionWorkerIssue[]> {
  const issues: TaskExecutionWorkerIssue[] = [];

  for (const pathRef of input.scope.allowedPathRefs) {
    const sourcePath = join(input.sourceRoot, pathRef);
    const sourceStats = await lstat(sourcePath).catch(() => null);

    if (sourceStats === null) {
      continue;
    }

    if (!sourceStats.isFile() || sourceStats.isSymbolicLink()) {
      issues.push(
        issue({
          code: "task_execution_mutation_source_path_unsafe",
          message:
            "Allowed source paths must be regular files when materialized into an isolated mutation workspace.",
          category: "permission",
        }),
      );
      continue;
    }

    const sourceReal = await safeRealpath(sourcePath);

    if (sourceReal === null || !isInsideOrEqual(input.sourceRoot, sourceReal)) {
      issues.push(
        issue({
          code: "task_execution_mutation_source_path_escape",
          message:
            "Allowed source path canonicalization escaped the source workspace.",
          category: "permission",
        }),
      );
      continue;
    }

    const targetPath = join(input.isolatedRoot, pathRef);
    await mkdir(dirname(targetPath), { recursive: true });
    await copyFile(sourcePath, targetPath);
  }

  return issues;
}

async function listWorkspaceEntries(
  root: string,
  current = root,
): Promise<TaskExecutionMutationWorkspaceEntry[]> {
  const entries: TaskExecutionMutationWorkspaceEntry[] = [];
  const dirents = await readdir(current, { withFileTypes: true });

  for (const dirent of dirents) {
    const absolutePath = join(current, dirent.name);
    const relativePath = relative(root, absolutePath).split(sep).join("/");

    if (dirent.isDirectory()) {
      entries.push(...(await listWorkspaceEntries(root, absolutePath)));
      continue;
    }

    if (dirent.isSymbolicLink()) {
      const stats = await lstat(absolutePath);
      entries.push({
        relativePath,
        entryKind: "symlink",
        sizeBytes: stats.size,
        digest: `symlink:${stats.size}`,
      });
      continue;
    }

    if (dirent.isFile()) {
      const content = await readFile(absolutePath);
      entries.push({
        relativePath,
        entryKind: "file",
        sizeBytes: content.byteLength,
        digest: digestContent(content),
      });
    }
  }

  return entries.sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath),
  );
}

export async function captureTaskExecutionMutationWorkspaceBaseline(input: {
  readonly authority: TaskExecutionIsolatedMutationWorkspaceAuthority;
  readonly occurredAt?: string;
}): Promise<TaskExecutionMutationWorkspaceBaseline> {
  return {
    authority: "system",
    isolatedWorkspaceRef: input.authority.isolatedWorkspaceRef,
    capturedAt: input.occurredAt ?? new Date().toISOString(),
    entries: await listWorkspaceEntries(input.authority.isolatedWorkspaceRoot),
  };
}

function evidenceFromBaselines(input: {
  readonly authority: TaskExecutionIsolatedMutationWorkspaceAuthority;
  readonly baseline: TaskExecutionMutationWorkspaceBaseline;
  readonly after: TaskExecutionMutationWorkspaceBaseline;
  readonly workerDeclaredChangedFiles: readonly string[];
}): TaskExecutionMutationEvidence {
  const beforeByPath = new Map(
    input.baseline.entries.map((entry) => [entry.relativePath, entry]),
  );
  const afterByPath = new Map(
    input.after.entries.map((entry) => [entry.relativePath, entry]),
  );
  const paths = new Set([...beforeByPath.keys(), ...afterByPath.keys()]);
  const changedFiles: TaskExecutionMutationFileEvidence[] = [];

  for (const pathRef of [...paths].sort()) {
    const before = beforeByPath.get(pathRef);
    const after = afterByPath.get(pathRef);

    if (
      before !== undefined &&
      after !== undefined &&
      before.digest === after.digest &&
      before.sizeBytes === after.sizeBytes &&
      before.entryKind === after.entryKind
    ) {
      continue;
    }

    const operation =
      before === undefined
        ? "created"
        : after === undefined
          ? "deleted"
          : "updated";
    const protectedPath = pathMatchesProtected(
      pathRef,
      input.authority.mutationScope,
    );
    const scopeAllowed =
      !protectedPath &&
      operation !== "deleted" &&
      isPathAllowedByScope(pathRef, input.authority.mutationScope);
    const beforeBytes = before?.sizeBytes ?? 0;
    const afterBytes = after?.sizeBytes ?? 0;

    changedFiles.push({
      relativePath: pathRef,
      operation,
      beforeDigest: before?.digest ?? null,
      afterDigest: after?.digest ?? null,
      beforeBytes,
      afterBytes,
      changedBytes: operation === "deleted" ? beforeBytes : afterBytes,
      scopeAllowed,
      protectedPath,
    });
  }

  const actualChangedPaths = changedFiles.map((entry) => entry.relativePath);
  const totalChangedBytes = changedFiles.reduce(
    (sum, entry) => sum + entry.changedBytes,
    0,
  );
  const unexpectedMutations = changedFiles
    .filter((entry) => !entry.scopeAllowed)
    .map((entry) => entry.relativePath);
  const protectedPathViolations = changedFiles
    .filter((entry) => entry.protectedPath)
    .map((entry) => entry.relativePath);
  const maxFilesExceeded =
    changedFiles.length > input.authority.mutationScope.maxChangedFiles;
  const maxBytesExceeded =
    totalChangedBytes > input.authority.mutationScope.maxTotalChangedBytes;

  return {
    authority: "system",
    baselineCapturedAt: input.baseline.capturedAt,
    observedAt: input.after.capturedAt,
    actualChangedPaths,
    changedFiles,
    totalChangedFiles: changedFiles.length,
    totalChangedBytes,
    scopeCompliant:
      unexpectedMutations.length === 0 &&
      protectedPathViolations.length === 0 &&
      !maxFilesExceeded &&
      !maxBytesExceeded,
    unexpectedMutations,
    protectedPathViolations,
    maxFilesExceeded,
    maxBytesExceeded,
    workerDeclaredChangedFiles: [...input.workerDeclaredChangedFiles],
    workerSelfReportAuthoritative: false,
  };
}

async function validateAuthorityRoot(
  authority: TaskExecutionIsolatedMutationWorkspaceAuthority,
): Promise<readonly TaskExecutionWorkerIssue[]> {
  const issues: TaskExecutionWorkerIssue[] = [
    ...validateMutationScope(authority.mutationScope),
  ];
  const tempRoot = await realpath(tmpdir());
  const systemRoot = await safeRealpath(authority.systemWorkspaceRoot);
  const isolatedRoot = await safeRealpath(authority.isolatedWorkspaceRoot);
  const sourceRoot = await safeRealpath(authority.sourceWorkspaceRoot);

  if (
    authority.authority !== "system" ||
    authority.systemCreated !== true ||
    authority.strategy !== "system_temp_allowed_file_materialization" ||
    authority.primaryWorkspaceMutationEnabled !== false ||
    authority.automaticPatchApplyEnabled !== false ||
    systemRoot === null ||
    isolatedRoot === null ||
    sourceRoot === null ||
    !isInsideOrEqual(tempRoot, systemRoot) ||
    !isInsideOrEqual(systemRoot, isolatedRoot) ||
    isInsideOrEqual(sourceRoot, isolatedRoot) ||
    isInsideOrEqual(isolatedRoot, sourceRoot)
  ) {
    issues.push(
      issue({
        code: "task_execution_mutation_workspace_authority_invalid",
        message:
          "Mutation workspace authority must bind an AEOS-created temp workspace that is separate from the source workspace and cannot substitute the primary repository root.",
        category: "permission",
      }),
    );
  }

  if (
    authority.oneShotMutationKey !==
    [
      authority.taskId,
      authority.taskRevision,
      authority.attemptId,
      authority.invocationId,
      authority.invocationRevision,
      authority.workerId,
      authority.isolatedWorkspaceRef,
    ].join(":")
  ) {
    issues.push(
      issue({
        code: "task_execution_mutation_workspace_one_shot_key_invalid",
        message:
          "Mutation workspace authority must bind a deterministic one-shot mutation key.",
        category: "conflict",
      }),
    );
  }

  return issues;
}

async function scopedWrite(input: {
  readonly authority: TaskExecutionIsolatedMutationWorkspaceAuthority;
  readonly operation: TaskExecutionTestMutationOperation;
}): Promise<readonly TaskExecutionWorkerIssue[]> {
  const { authority, operation } = input;
  const normalized = normalizeRelativePath(operation.relativePath);
  const issues: TaskExecutionWorkerIssue[] = [];

  if (normalized === null || normalized !== operation.relativePath) {
    return [
      issue({
        code: "task_execution_mutation_operation_path_invalid",
        message:
          "Mutation operation path must be a normalized relative path and cannot use traversal or absolute authority.",
        category: "permission",
      }),
    ];
  }

  const targetPath = join(authority.isolatedWorkspaceRoot, normalized);
  const targetParent = dirname(targetPath);
  await mkdir(targetParent, { recursive: true });
  const parentReal = await safeRealpath(targetParent);
  const rootReal = await safeRealpath(authority.isolatedWorkspaceRoot);

  if (
    parentReal === null ||
    rootReal === null ||
    !isInsideOrEqual(rootReal, parentReal)
  ) {
    return [
      issue({
        code: "task_execution_mutation_operation_parent_escape",
        message:
          "Mutation operation parent directory canonicalization escaped the isolated workspace.",
        category: "permission",
      }),
    ];
  }

  const stats = await lstat(targetPath).catch(() => null);

  if (stats?.isSymbolicLink() === true) {
    return [
      issue({
        code: "task_execution_mutation_operation_symlink_rejected",
        message:
          "Mutation operation rejects symlink targets to prevent isolated workspace escape.",
        category: "permission",
      }),
    ];
  }

  if (operation.kind === "fixture_direct_write") {
    await writeFile(targetPath, operation.content ?? "", "utf8");
    return [];
  }

  if (operation.kind === "fixture_delete") {
    await unlink(targetPath).catch(() => undefined);
    return [];
  }

  if (operation.kind === "fixture_symlink") {
    await symlink(operation.symlinkTarget ?? "../outside", targetPath);
    return [];
  }

  if (pathMatchesProtected(normalized, authority.mutationScope)) {
    issues.push(
      issue({
        code: "task_execution_mutation_operation_protected_path",
        message:
          "Mutation operation cannot write protected repository, runtime, tooling, or project-instruction paths.",
        category: "permission",
      }),
    );
  }

  if (!isPathAllowedByScope(normalized, authority.mutationScope)) {
    issues.push(
      issue({
        code: "task_execution_mutation_operation_scope_violation",
        message:
          "Mutation operation path is outside the system-owned mutation scope.",
        category: "permission",
      }),
    );
  }

  if (
    operation.kind === "update_existing_file" &&
    !authority.mutationScope.allowedOperations.includes("update_existing_file")
  ) {
    issues.push(
      issue({
        code: "task_execution_mutation_update_not_authorized",
        message: "Mutation scope does not authorize existing-file updates.",
        category: "permission",
      }),
    );
  }

  if (
    operation.kind === "create_file" &&
    !authority.mutationScope.allowedOperations.includes("create_file")
  ) {
    issues.push(
      issue({
        code: "task_execution_mutation_create_not_authorized",
        message: "Mutation scope does not authorize new-file creation.",
        category: "permission",
      }),
    );
  }

  if (
    operation.kind === "update_existing_file" &&
    (stats === null || !stats.isFile())
  ) {
    issues.push(
      issue({
        code: "task_execution_mutation_update_target_missing",
        message:
          "Existing-file mutation requires a regular file already materialized in the isolated workspace.",
        category: "validation",
      }),
    );
  }

  if (operation.kind === "create_file" && stats !== null) {
    issues.push(
      issue({
        code: "task_execution_mutation_create_target_exists",
        message: "Create-file mutation cannot replace an existing path.",
        category: "validation",
      }),
    );
  }

  if (issues.length > 0) {
    return issues;
  }

  await writeFile(targetPath, operation.content ?? "", "utf8");
  return [];
}

export async function createTaskExecutionIsolatedMutationWorkspace(
  input: CreateTaskExecutionIsolatedMutationWorkspaceInput,
): Promise<TaskExecutionMutationWorkspaceCreationResult> {
  const issues: TaskExecutionWorkerIssue[] = [
    ...validateMutationScope(input.mutationScope),
  ];

  if (input.taskOrModelWorkspacePathClaims !== undefined) {
    issues.push(
      issue({
        code: "task_execution_mutation_workspace_task_path_claim_rejected",
        message:
          "Task, model, or worker path claims cannot choose an isolated mutation workspace path.",
        category: "permission",
      }),
    );
  }

  if (
    !isSafeRef(input.taskId) ||
    !isPositiveInteger(input.taskRevision, 999999999) ||
    !isSafeRef(input.attemptId) ||
    !isPositiveInteger(input.attemptNumber, 999999999) ||
    !isSafeRef(input.invocationId) ||
    !isPositiveInteger(input.invocationRevision, 999999999) ||
    typeof input.idempotencyKey !== "string" ||
    input.idempotencyKey.length === 0 ||
    !isSafeRef(input.sourceProjectRef) ||
    !isSafeRef(input.sourceWorkspaceRef) ||
    input.workerIdentity.identityAuthority !== "system" ||
    input.workerIdentity.selectionAuthority !== "system"
  ) {
    issues.push(
      issue({
        code: "task_execution_mutation_workspace_identity_invalid",
        message:
          "Mutation workspace identity must bind system-owned task, invocation, worker, source project, and source workspace facts.",
        category: "validation",
      }),
    );
  }

  const sourceRoot = await safeRealpath(input.sourceWorkspaceRoot);

  if (sourceRoot === null) {
    issues.push(
      issue({
        code: "task_execution_mutation_source_workspace_missing",
        message:
          "Mutation workspace creation requires an existing authoritative source workspace.",
        category: "not_found",
      }),
    );
  }

  if (issues.some((item) => item.severity === "error")) {
    return {
      ok: false,
      authority: null,
      auditFacts: [],
      issues,
      ActualCodexModelCalls: 0,
      ActualClaudeModelCalls: 0,
      CloudCalls: 0,
    };
  }

  const systemWorkspaceRoot = await mkdtemp(
    join(tmpdir(), "aeos-worker-mutation-"),
  );
  const isolatedWorkspaceRef = stableWorkspaceRef(input);
  const isolatedWorkspaceRoot = join(systemWorkspaceRoot, "workspace");
  await mkdir(isolatedWorkspaceRoot, { recursive: true });
  const copyIssues = await copyAllowedSourceFiles({
    sourceRoot: sourceRoot as string,
    isolatedRoot: isolatedWorkspaceRoot,
    scope: input.mutationScope,
  });

  if (copyIssues.some((item) => item.severity === "error")) {
    await rm(systemWorkspaceRoot, { recursive: true, force: true }).catch(
      () => undefined,
    );
    return {
      ok: false,
      authority: null,
      auditFacts: [],
      issues: [...issues, ...copyIssues],
      ActualCodexModelCalls: 0,
      ActualClaudeModelCalls: 0,
      CloudCalls: 0,
    };
  }

  const oneShotMutationKey = [
    input.taskId,
    input.taskRevision,
    input.attemptId,
    input.invocationId,
    input.invocationRevision,
    input.workerIdentity.workerId,
    isolatedWorkspaceRef,
  ].join(":");

  const authority: TaskExecutionIsolatedMutationWorkspaceAuthority = {
    authority: "system",
    strategy: "system_temp_allowed_file_materialization",
    systemCreated: true,
    taskId: input.taskId,
    taskRevision: input.taskRevision,
    attemptId: input.attemptId,
    attemptNumber: input.attemptNumber,
    invocationId: input.invocationId,
    invocationRevision: input.invocationRevision,
    idempotencyKey: input.idempotencyKey,
    workerId: input.workerIdentity.workerId,
    workerFamily: input.workerIdentity.workerFamily,
    sourceProjectRef: input.sourceProjectRef,
    sourceWorkspaceRef: input.sourceWorkspaceRef,
    sourceWorkspaceRoot: sourceRoot as string,
    isolatedWorkspaceRef,
    isolatedWorkspaceRoot,
    systemWorkspaceRoot,
    mutationScope: input.mutationScope,
    oneShotMutationKey,
    primaryWorkspaceMutationEnabled: false,
    automaticPatchApplyEnabled: false,
  };

  return {
    ok: true,
    authority,
    auditFacts: [
      mutationAuditFact({
        authority,
        factKind: "mutation_workspace_created",
        resultReference: isolatedWorkspaceRef,
      }),
      mutationAuditFact({
        authority,
        factKind: "mutation_authority_granted",
        resultReference: input.mutationScope.scopeId,
      }),
    ],
    issues,
    ActualCodexModelCalls: 0,
    ActualClaudeModelCalls: 0,
    CloudCalls: 0,
  };
}

export async function deriveTaskExecutionMutationEvidence(input: {
  readonly authority: TaskExecutionIsolatedMutationWorkspaceAuthority;
  readonly baseline: TaskExecutionMutationWorkspaceBaseline;
  readonly occurredAt?: string;
  readonly workerDeclaredChangedFiles?: readonly string[];
}): Promise<TaskExecutionMutationEvidence> {
  const after = await captureTaskExecutionMutationWorkspaceBaseline({
    authority: input.authority,
    occurredAt: input.occurredAt,
  });

  return evidenceFromBaselines({
    authority: input.authority,
    baseline: input.baseline,
    after,
    workerDeclaredChangedFiles: input.workerDeclaredChangedFiles ?? [],
  });
}

export async function executeTaskExecutionIsolatedTestMutation(
  input: ExecuteTaskExecutionIsolatedTestMutationInput,
): Promise<TaskExecutionIsolatedTestMutationResult> {
  const issues: TaskExecutionWorkerIssue[] = [
    ...(await validateAuthorityRoot(input.authority)),
  ];

  if (consumedMutationKeys.has(input.authority.oneShotMutationKey)) {
    issues.push(
      issue({
        code: "task_execution_mutation_one_shot_already_consumed",
        message:
          "Mutation authority has already been consumed; AEOS will not blindly relaunch an ambiguous or repeated worker mutation.",
        category: "conflict",
      }),
    );
  }

  if (issues.some((item) => item.severity === "error")) {
    return {
      ok: false,
      status: "launch_blocked",
      baseline: null,
      evidence: null,
      oneShotAuthorityConsumed: false,
      testWorkerInvoked: false,
      primaryWorkspaceModified: false,
      primaryWorkspaceApplyEnabled: false,
      automaticPatchApplyEnabled: false,
      workerSelfReportAuthoritative: false,
      completionAuthorityGranted: false,
      ActualCodexModelCalls: 0,
      ActualClaudeModelCalls: 0,
      CloudCalls: 0,
      auditFacts: [],
      issues,
      safety: {
        isolatedWorkspaceWritten: false,
        primaryWorkspaceWritten: false,
        shellExecuted: false,
        packageInstallationAllowed: false,
        gitCommitAllowed: false,
        taskCompleted: false,
        verifierRun: false,
        completionGateSatisfied: false,
        realCodexInvoked: false,
        realClaudeCodeInvoked: false,
        cloudCalled: false,
        workerSelfReportAuthoritative: false,
      },
    };
  }

  consumedMutationKeys.add(input.authority.oneShotMutationKey);
  const baseline = await captureTaskExecutionMutationWorkspaceBaseline({
    authority: input.authority,
    occurredAt: input.occurredAt,
  });
  const operationIssues: TaskExecutionWorkerIssue[] = [];

  for (const operation of input.operations) {
    operationIssues.push(
      ...(await scopedWrite({
        authority: input.authority,
        operation,
      })),
    );

    if (operationIssues.some((item) => item.severity === "error")) {
      break;
    }
  }

  if (input.workerCompletionClaims !== undefined) {
    operationIssues.push(
      issue({
        code: "task_execution_mutation_worker_completion_claim_ignored",
        message:
          "Worker completion, verification, approval, and task-done claims remain diagnostic only and grant no AEOS completion authority.",
        severity: "warning",
        category: "validation",
      }),
    );
  }

  const evidence = await deriveTaskExecutionMutationEvidence({
    authority: input.authority,
    baseline,
    occurredAt: input.occurredAt,
    workerDeclaredChangedFiles: input.workerDeclaredChangedFiles,
  });
  const evidenceIssues = evidence.scopeCompliant
    ? []
    : [
        issue({
          code: "task_execution_mutation_evidence_scope_violation",
          message:
            "Actual filesystem mutation evidence violated the system-owned mutation scope; no primary workspace apply is authorized.",
          category: "permission",
        }),
      ];
  const allIssues = [...issues, ...operationIssues, ...evidenceIssues];
  const ok = allIssues.every((item) => item.severity !== "error");

  return {
    ok,
    status: ok ? "mutation_returned" : "mutation_rejected",
    baseline,
    evidence,
    oneShotAuthorityConsumed: true,
    testWorkerInvoked: true,
    primaryWorkspaceModified: false,
    primaryWorkspaceApplyEnabled: false,
    automaticPatchApplyEnabled: false,
    workerSelfReportAuthoritative: false,
    completionAuthorityGranted: false,
    ActualCodexModelCalls: 0,
    ActualClaudeModelCalls: 0,
    CloudCalls: 0,
    auditFacts: [
      mutationAuditFact({
        authority: input.authority,
        factKind: "test_worker_mutation_intent",
        resultReference: input.authority.oneShotMutationKey,
      }),
      mutationAuditFact({
        authority: input.authority,
        factKind: "actual_mutation_evidence",
        resultReference: `${input.authority.isolatedWorkspaceRef}:changed:${evidence.totalChangedFiles}`,
      }),
    ],
    issues: allIssues,
    safety: {
      isolatedWorkspaceWritten: evidence.totalChangedFiles > 0,
      primaryWorkspaceWritten: false,
      shellExecuted: false,
      packageInstallationAllowed: false,
      gitCommitAllowed: false,
      taskCompleted: false,
      verifierRun: false,
      completionGateSatisfied: false,
      realCodexInvoked: false,
      realClaudeCodeInvoked: false,
      cloudCalled: false,
      workerSelfReportAuthoritative: false,
    },
  };
}

export async function cleanupTaskExecutionIsolatedMutationWorkspace(
  authority: TaskExecutionIsolatedMutationWorkspaceAuthority,
): Promise<TaskExecutionMutationWorkspaceCleanupResult> {
  const issues = await validateAuthorityRoot(authority);

  if (issues.some((item) => item.severity === "error")) {
    return {
      ok: false,
      removed: false,
      issues,
    };
  }

  await rm(authority.systemWorkspaceRoot, { recursive: true, force: true });

  return {
    ok: true,
    removed: true,
    issues: [],
  };
}
