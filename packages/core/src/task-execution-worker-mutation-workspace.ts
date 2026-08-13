import type {
  TaskExecutionWorkerFamily,
  TaskExecutionWorkerIdentity,
  TaskExecutionWorkerIssue,
} from "./task-execution-worker.js";
import { AEOS_TASK_EXECUTION_AUDIT_SCHEMA_VERSION } from "./task-execution-audit.js";
import type { AeosError } from "./types.js";

// @ts-ignore Node built-ins are available at runtime; this package does not depend on Node ambient types yet.
import { Buffer } from "node:buffer";
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
  link,
  mkdir,
  mkdtemp,
  open,
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
export const TASK_EXECUTION_REAL_CLAUDE_WRITE_CANARY_READY = true;
export const TASK_EXECUTION_REAL_CLAUDE_WRITE_CANARY_EXECUTED = false;
export const TASK_EXECUTION_CLAUDE_WRITE_CANARY_RELATIVE_PATH =
  "canary/claude-write-canary.txt";
export const TASK_EXECUTION_CLAUDE_WRITE_CANARY_BEFORE_CONTENT =
  "BEFORE_CANARY";
export const TASK_EXECUTION_CLAUDE_WRITE_CANARY_AFTER_CONTENT =
  "AFTER_CANARY";
export const TASK_EXECUTION_MUTATION_EVIDENCE_SCHEMA_VERSION = 1;
export const TASK_EXECUTION_MUTATION_ARTIFACT_SCHEMA_VERSION = 1;
export const TASK_EXECUTION_DURABLE_MUTATION_EVIDENCE_READY = true;
export const TASK_EXECUTION_DURABLE_MUTATION_ARTIFACT_REQUIRED = true;
export const TASK_EXECUTION_DURABLE_MUTATION_ARTIFACT_READY = true;
export const TASK_EXECUTION_PRIMARY_APPLY_INPUT_DURABLE = true;
export const TASK_EXECUTION_HISTORICAL_CLAUDE_WRITE_CANARY_APPLY_ELIGIBLE =
  false;

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

export interface PrepareTaskExecutionClaudeWriteCanaryWorkspaceInput
  extends Omit<
    CreateTaskExecutionIsolatedMutationWorkspaceInput,
    "mutationScope"
  > {
  readonly mutationScope?: never;
}

export interface TaskExecutionClaudeWriteCanaryWorkspacePreparationResult {
  readonly ok: boolean;
  readonly authority: TaskExecutionIsolatedMutationWorkspaceAuthority | null;
  readonly sacrificialFile: typeof TASK_EXECUTION_CLAUDE_WRITE_CANARY_RELATIVE_PATH;
  readonly expectedBeforeContent: typeof TASK_EXECUTION_CLAUDE_WRITE_CANARY_BEFORE_CONTENT;
  readonly expectedAfterContent: typeof TASK_EXECUTION_CLAUDE_WRITE_CANARY_AFTER_CONTENT;
  readonly auditFacts: readonly TaskExecutionMutationAuditFact[];
  readonly issues: readonly TaskExecutionWorkerIssue[];
  readonly ActualCodexModelCalls: 0;
  readonly ActualClaudeModelCalls: 0;
  readonly CloudCalls: 0;
}

export interface TaskExecutionClaudeWriteCanaryEvidenceResult {
  readonly ok: boolean;
  readonly status:
    | "exact_mutation_verified"
    | "exact_mutation_rejected"
    | "baseline_rejected";
  readonly evidence: TaskExecutionMutationEvidence;
  readonly sacrificialFile: typeof TASK_EXECUTION_CLAUDE_WRITE_CANARY_RELATIVE_PATH;
  readonly beforeContentVerified: boolean;
  readonly afterContentVerified: boolean;
  readonly exactResultVerified: boolean;
  readonly workerSelfReportAuthoritative: false;
  readonly primaryWorkspaceModified: false;
  readonly primaryWorkspaceApplyEnabled: false;
  readonly automaticPatchApplyEnabled: false;
  readonly completionAuthorityGranted: false;
  readonly ActualCodexModelCalls: 0;
  readonly ActualClaudeModelCalls: 0;
  readonly CloudCalls: 0;
  readonly issues: readonly TaskExecutionWorkerIssue[];
  readonly safety: {
    readonly scopeSatisfied: boolean;
    readonly shellExecuted: false;
    readonly primaryWorkspaceWritten: false;
    readonly taskCompleted: false;
    readonly verifierRun: false;
    readonly completionGateSatisfied: false;
    readonly workerSelfReportAuthoritative: false;
  };
}

export interface TaskExecutionMutationEvidenceRecordChangedFile {
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

export interface TaskExecutionMutationEvidenceRecord {
  readonly schemaVersion: typeof TASK_EXECUTION_MUTATION_EVIDENCE_SCHEMA_VERSION;
  readonly recordKind: "task_execution_mutation_evidence";
  readonly evidenceRef: string;
  readonly evidenceDigest: string;
  readonly createdAt: string;
  readonly taskId: string;
  readonly taskRevision: number;
  readonly attemptId: string;
  readonly attemptNumber: number;
  readonly invocationId: string;
  readonly invocationRevision: number;
  readonly invocationLifecycle: "returned" | "failed" | "outcome_unknown";
  readonly mutationAuthorityInvocationRevision: number;
  readonly idempotencyReference: string;
  readonly workerId: string;
  readonly workerFamily: TaskExecutionWorkerFamily;
  readonly sourceWorkspaceRef: string;
  readonly isolatedWorkspaceRef: string;
  readonly mutationScopeId: string;
  readonly mutationScopeDigest: string;
  readonly baselineCapturedAt: string;
  readonly baselineDigest: string;
  readonly actualChangedPaths: readonly string[];
  readonly changedFiles: readonly TaskExecutionMutationEvidenceRecordChangedFile[];
  readonly totalChangedFiles: number;
  readonly totalChangedBytes: number;
  readonly scopeCompliant: boolean;
  readonly unexpectedMutations: readonly string[];
  readonly protectedPathViolations: readonly string[];
  readonly maxFilesExceeded: boolean;
  readonly maxBytesExceeded: boolean;
  readonly exactResultVerified: boolean;
  readonly verificationStatus: "verified" | "rejected";
  readonly verificationIssueCodes: readonly string[];
  readonly workerDeclaredChangedFiles: readonly string[];
  readonly workerSelfReportAuthoritative: false;
  readonly primaryWorkspaceApplyEnabled: false;
  readonly automaticPatchApplyEnabled: false;
  readonly completionAuthorityGranted: false;
  readonly verifierRun: false;
  readonly retryAuthorized: false;
  readonly artifactRef: string | null;
  readonly artifactDigest: string | null;
  readonly fileContentsLogged: false;
}

export interface TaskExecutionMutationArtifactFile {
  readonly relativePath: string;
  readonly operation: Extract<TaskExecutionMutationFileOperation, "created" | "updated">;
  readonly encoding: "utf8";
  readonly beforeDigest: string | null;
  readonly afterDigest: string;
  readonly beforeBytes: number;
  readonly afterBytes: number;
  readonly afterContent: string;
}

export interface TaskExecutionMutationArtifactRecord {
  readonly schemaVersion: typeof TASK_EXECUTION_MUTATION_ARTIFACT_SCHEMA_VERSION;
  readonly recordKind: "task_execution_mutation_artifact";
  readonly artifactRef: string;
  readonly artifactDigest: string;
  readonly createdAt: string;
  readonly taskId: string;
  readonly taskRevision: number;
  readonly attemptId: string;
  readonly invocationId: string;
  readonly invocationRevision: number;
  readonly evidenceRef: string;
  readonly evidenceDigest: string;
  readonly mutationScopeId: string;
  readonly mutationScopeDigest: string;
  readonly isolatedWorkspaceRef: string;
  readonly maxTotalBytes: number;
  readonly totalBytes: number;
  readonly files: readonly TaskExecutionMutationArtifactFile[];
  readonly primaryApplyPerformed: false;
}

export interface PersistTaskExecutionMutationEvidenceInput {
  readonly projectRoot: string;
  readonly authority: TaskExecutionIsolatedMutationWorkspaceAuthority;
  readonly baseline: TaskExecutionMutationWorkspaceBaseline;
  readonly evaluation: TaskExecutionClaudeWriteCanaryEvidenceResult;
  readonly invocationRevision: number;
  readonly invocationLifecycle: "returned" | "failed" | "outcome_unknown";
  readonly occurredAt?: string;
  readonly persistArtifact: boolean;
  readonly forbiddenValues?: readonly string[];
}

export interface TaskExecutionMutationEvidencePersistenceResult {
  readonly ok: boolean;
  readonly status:
    | "persisted_and_verified"
    | "evidence_rejected"
    | "persistence_failed"
    | "artifact_failed";
  readonly evidenceRecord: TaskExecutionMutationEvidenceRecord | null;
  readonly artifactRecord: TaskExecutionMutationArtifactRecord | null;
  readonly evidencePath: string | null;
  readonly artifactPath: string | null;
  readonly readBackVerified: boolean;
  readonly artifactReadBackVerified: boolean;
  readonly primaryApplyInputDurable: boolean;
  readonly immutable: boolean;
  readonly issues: readonly TaskExecutionWorkerIssue[];
  readonly ActualCodexModelCalls: 0;
  readonly ActualClaudeModelCalls: 0;
  readonly CloudCalls: 0;
}

export interface LoadTaskExecutionMutationEvidenceInput {
  readonly projectRoot: string;
  readonly taskId: string;
  readonly invocationId: string;
}

export interface VerifyTaskExecutionMutationEvidenceForAuthorityInput {
  readonly projectRoot: string;
  readonly authority: TaskExecutionIsolatedMutationWorkspaceAuthority;
}

export interface TaskExecutionMutationEvidenceLoadResult {
  readonly ok: boolean;
  readonly record: TaskExecutionMutationEvidenceRecord | null;
  readonly path: string | null;
  readonly verified: boolean;
  readonly issues: readonly TaskExecutionWorkerIssue[];
}

export interface TaskExecutionMutationArtifactLoadResult {
  readonly ok: boolean;
  readonly record: TaskExecutionMutationArtifactRecord | null;
  readonly path: string | null;
  readonly verified: boolean;
  readonly issues: readonly TaskExecutionWorkerIssue[];
}

export interface TaskExecutionMutationEvidenceAuthorityVerificationResult {
  readonly ok: boolean;
  readonly evidence: TaskExecutionMutationEvidenceLoadResult;
  readonly artifact: TaskExecutionMutationArtifactLoadResult | null;
  readonly authorityBound: boolean;
  readonly artifactBound: boolean;
  readonly primaryApplyInputDurable: boolean;
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

function jsonContent(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function digestJson(value: unknown): string {
  return digestContent(jsonContent(value));
}

function withoutEvidenceDigest(
  value: TaskExecutionMutationEvidenceRecord,
): Omit<TaskExecutionMutationEvidenceRecord, "evidenceDigest"> {
  const { evidenceDigest: _evidenceDigest, ...rest } = value;

  return rest;
}

function withoutArtifactDigest(
  value: TaskExecutionMutationArtifactRecord,
): Omit<TaskExecutionMutationArtifactRecord, "artifactDigest"> {
  const { artifactDigest: _artifactDigest, ...rest } = value;

  return rest;
}

function noForbiddenValues(input: {
  readonly value: unknown;
  readonly forbiddenValues?: readonly string[];
}): boolean {
  const serialized = jsonContent(input.value);

  if (/ownershipToken|Authorization|Bearer|PASSWORD|SECRET|TOKEN/i.test(serialized)) {
    return false;
  }

  return (input.forbiddenValues ?? []).every(
    (forbidden) => forbidden.length === 0 || !serialized.includes(forbidden),
  );
}

function storageIssue(input: {
  readonly code: string;
  readonly message: string;
  readonly category?: AeosError["category"];
}): readonly TaskExecutionWorkerIssue[] {
  return [
    issue({
      code: input.code,
      message: input.message,
      category: input.category ?? "validation",
    }),
  ];
}

function mutationEvidenceRef(input: {
  readonly taskId: string;
  readonly invocationId: string;
}): string {
  return `mutation-evidence:${input.taskId}:${input.invocationId}`;
}

function mutationArtifactRef(input: {
  readonly taskId: string;
  readonly invocationId: string;
}): string {
  return `mutation-artifact:${input.taskId}:${input.invocationId}`;
}

async function ensureSafeStoragePath(input: {
  readonly projectRoot: string;
  readonly rootName: "mutation-evidence" | "mutation-artifacts";
  readonly taskId: string;
  readonly invocationId: string;
  readonly create: boolean;
}): Promise<
  | { readonly ok: true; readonly root: string; readonly path: string }
  | { readonly ok: false; readonly issues: readonly TaskExecutionWorkerIssue[] }
> {
  if (!isSafeRef(input.taskId) || !isSafeRef(input.invocationId)) {
    return {
      ok: false,
      issues: storageIssue({
        code: "task_execution_mutation_evidence_storage_identity_invalid",
        message:
          "Mutation evidence storage requires safe task and invocation identifiers.",
        category: "validation",
      }),
    };
  }

  const projectRoot = await safeRealpath(input.projectRoot);
  if (projectRoot === null) {
    return {
      ok: false,
      issues: storageIssue({
        code: "task_execution_mutation_evidence_project_root_missing",
        message:
          "Mutation evidence storage requires an existing project root.",
        category: "not_found",
      }),
    };
  }

  const stateRoot = join(projectRoot, ".aeos", "state", input.rootName);
  const taskRoot = join(stateRoot, input.taskId);
  const targetPath = join(taskRoot, `${input.invocationId}.json`);

  if (input.create) {
    await mkdir(taskRoot, { recursive: true });
  }

  const taskRootReal = await safeRealpath(taskRoot);
  if (
    taskRootReal === null ||
    !isInsideOrEqual(projectRoot, taskRootReal) ||
    !isInsideOrEqual(taskRootReal, targetPath)
  ) {
    return {
      ok: false,
      issues: storageIssue({
        code: "task_execution_mutation_evidence_storage_path_unsafe",
        message:
          "Mutation evidence storage path must stay inside the system-owned AEOS state root.",
        category: "permission",
      }),
    };
  }

  const existing = await lstat(targetPath).catch(() => null);
  if (existing?.isSymbolicLink() === true) {
    return {
      ok: false,
      issues: storageIssue({
        code: "task_execution_mutation_evidence_storage_symlink_rejected",
        message:
          "Mutation evidence storage refuses symlink targets.",
        category: "permission",
      }),
    };
  }

  return { ok: true, root: taskRootReal, path: targetPath };
}

async function writeImmutableJson(input: {
  readonly path: string;
  readonly root: string;
  readonly value: unknown;
}): Promise<readonly TaskExecutionWorkerIssue[]> {
  const existing = await lstat(input.path).catch(() => null);
  if (existing !== null) {
    return storageIssue({
      code: "task_execution_mutation_evidence_immutable_record_exists",
      message:
        "Mutation evidence and artifacts are immutable; existing invocation-bound records cannot be overwritten.",
      category: "conflict",
    });
  }

  const tempPath = join(
    input.root,
    `.tmp-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
  );
  const tempHandle = await open(tempPath, "wx");
  try {
    await tempHandle.writeFile(jsonContent(input.value), "utf8");
    await tempHandle.sync();
  } finally {
    await tempHandle.close();
  }

  try {
    await link(tempPath, input.path);
  } catch {
    await unlink(tempPath).catch(() => undefined);
    return storageIssue({
      code: "task_execution_mutation_evidence_immutable_record_exists",
      message:
        "Mutation evidence and artifacts are immutable; conflicting evidence for the same invocation was blocked.",
      category: "conflict",
    });
  }

  await unlink(tempPath).catch(() => undefined);
  return [];
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

export async function prepareTaskExecutionClaudeWriteCanaryMutationWorkspace(
  input: PrepareTaskExecutionClaudeWriteCanaryWorkspaceInput,
): Promise<TaskExecutionClaudeWriteCanaryWorkspacePreparationResult> {
  const creation = await createTaskExecutionIsolatedMutationWorkspace({
    ...input,
    mutationScope: {
      authority: "system",
      scopeId: "claude-write-canary-v1",
      allowedPathRefs: [TASK_EXECUTION_CLAUDE_WRITE_CANARY_RELATIVE_PATH],
      allowedOperations: ["update_existing_file"],
      maxChangedFiles: 1,
      maxTotalChangedBytes: 64,
      repositoryWritePermission: true,
      deleteAllowed: false,
    },
  });

  if (!creation.ok || creation.authority === null) {
    return {
      ok: false,
      authority: null,
      sacrificialFile: TASK_EXECUTION_CLAUDE_WRITE_CANARY_RELATIVE_PATH,
      expectedBeforeContent: TASK_EXECUTION_CLAUDE_WRITE_CANARY_BEFORE_CONTENT,
      expectedAfterContent: TASK_EXECUTION_CLAUDE_WRITE_CANARY_AFTER_CONTENT,
      auditFacts: creation.auditFacts,
      issues: creation.issues,
      ActualCodexModelCalls: 0,
      ActualClaudeModelCalls: 0,
      CloudCalls: 0,
    };
  }

  const authorityIssues = await validateAuthorityRoot(creation.authority);
  if (authorityIssues.some((item) => item.severity === "error")) {
    await rm(creation.authority.systemWorkspaceRoot, {
      recursive: true,
      force: true,
    }).catch(() => undefined);
    return {
      ok: false,
      authority: null,
      sacrificialFile: TASK_EXECUTION_CLAUDE_WRITE_CANARY_RELATIVE_PATH,
      expectedBeforeContent: TASK_EXECUTION_CLAUDE_WRITE_CANARY_BEFORE_CONTENT,
      expectedAfterContent: TASK_EXECUTION_CLAUDE_WRITE_CANARY_AFTER_CONTENT,
      auditFacts: creation.auditFacts,
      issues: authorityIssues,
      ActualCodexModelCalls: 0,
      ActualClaudeModelCalls: 0,
      CloudCalls: 0,
    };
  }

  const canaryPath = join(
    creation.authority.isolatedWorkspaceRoot,
    TASK_EXECUTION_CLAUDE_WRITE_CANARY_RELATIVE_PATH,
  );
  await mkdir(dirname(canaryPath), { recursive: true });
  await writeFile(
    canaryPath,
    TASK_EXECUTION_CLAUDE_WRITE_CANARY_BEFORE_CONTENT,
    "utf8",
  );

  return {
    ok: true,
    authority: creation.authority,
    sacrificialFile: TASK_EXECUTION_CLAUDE_WRITE_CANARY_RELATIVE_PATH,
    expectedBeforeContent: TASK_EXECUTION_CLAUDE_WRITE_CANARY_BEFORE_CONTENT,
    expectedAfterContent: TASK_EXECUTION_CLAUDE_WRITE_CANARY_AFTER_CONTENT,
    auditFacts: creation.auditFacts,
    issues: creation.issues,
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

export async function evaluateTaskExecutionClaudeWriteCanaryMutationEvidence(input: {
  readonly authority: TaskExecutionIsolatedMutationWorkspaceAuthority;
  readonly baseline: TaskExecutionMutationWorkspaceBaseline;
  readonly workerDeclaredChangedFiles?: readonly string[];
  readonly workerCompletionClaims?: unknown;
  readonly occurredAt?: string;
}): Promise<TaskExecutionClaudeWriteCanaryEvidenceResult> {
  const issues: TaskExecutionWorkerIssue[] = [
    ...(await validateAuthorityRoot(input.authority)),
  ];
  const expectedBeforeDigest = digestContent(
    TASK_EXECUTION_CLAUDE_WRITE_CANARY_BEFORE_CONTENT,
  );
  const expectedAfterDigest = digestContent(
    TASK_EXECUTION_CLAUDE_WRITE_CANARY_AFTER_CONTENT,
  );
  const baselineCanaryEntry = input.baseline.entries.find(
    (entry) =>
      entry.relativePath === TASK_EXECUTION_CLAUDE_WRITE_CANARY_RELATIVE_PATH,
  );
  const beforeContentVerified =
    input.baseline.entries.length === 1 &&
    baselineCanaryEntry?.entryKind === "file" &&
    baselineCanaryEntry.sizeBytes ===
      TASK_EXECUTION_CLAUDE_WRITE_CANARY_BEFORE_CONTENT.length &&
    baselineCanaryEntry.digest === expectedBeforeDigest;

  if (!beforeContentVerified) {
    issues.push(
      issue({
        code: "task_execution_claude_write_canary_baseline_invalid",
        message:
          "Claude write canary baseline must contain exactly the sacrificial file with BEFORE_CANARY content before launch.",
        category: "validation",
      }),
    );
  }

  if (input.workerCompletionClaims !== undefined) {
    issues.push(
      issue({
        code: "task_execution_claude_write_canary_worker_completion_claim_ignored",
        message:
          "Claude write canary completion, verification, retry, and task-done claims remain diagnostic only.",
        severity: "warning",
        category: "validation",
      }),
    );
  }

  const evidence = await deriveTaskExecutionMutationEvidence({
    authority: input.authority,
    baseline: input.baseline,
    occurredAt: input.occurredAt,
    workerDeclaredChangedFiles: input.workerDeclaredChangedFiles,
  });
  const canaryPath = join(
    input.authority.isolatedWorkspaceRoot,
    TASK_EXECUTION_CLAUDE_WRITE_CANARY_RELATIVE_PATH,
  );
  const finalStats = await lstat(canaryPath).catch(() => null);
  const finalContent =
    finalStats?.isFile() === true && !finalStats.isSymbolicLink()
      ? await readFile(canaryPath, "utf8")
      : null;
  const canaryChange = evidence.changedFiles[0];
  const afterContentVerified =
    finalContent === TASK_EXECUTION_CLAUDE_WRITE_CANARY_AFTER_CONTENT &&
    canaryChange?.afterDigest === expectedAfterDigest;
  const exactResultVerified =
    beforeContentVerified &&
    afterContentVerified &&
    evidence.scopeCompliant &&
    evidence.totalChangedFiles === 1 &&
    evidence.totalChangedBytes <= input.authority.mutationScope.maxTotalChangedBytes &&
    canaryChange?.relativePath ===
      TASK_EXECUTION_CLAUDE_WRITE_CANARY_RELATIVE_PATH &&
    canaryChange.operation === "updated" &&
    canaryChange.beforeDigest === expectedBeforeDigest &&
    canaryChange.afterDigest === expectedAfterDigest;

  if (!afterContentVerified) {
    issues.push(
      issue({
        code: "task_execution_claude_write_canary_after_content_invalid",
        message:
          "Claude write canary final content must be exactly AFTER_CANARY with no extra content.",
        category: "validation",
      }),
    );
  }

  if (!evidence.scopeCompliant || evidence.totalChangedFiles !== 1) {
    issues.push(
      issue({
        code: "task_execution_claude_write_canary_scope_violation",
        message:
          "Claude write canary requires exactly one scoped filesystem update and fails closed on any extra, missing, protected, deleted, or oversized mutation.",
        category: "permission",
      }),
    );
  }

  return {
    ok: exactResultVerified && issues.every((item) => item.severity !== "error"),
    status: beforeContentVerified
      ? exactResultVerified
        ? "exact_mutation_verified"
        : "exact_mutation_rejected"
      : "baseline_rejected",
    evidence,
    sacrificialFile: TASK_EXECUTION_CLAUDE_WRITE_CANARY_RELATIVE_PATH,
    beforeContentVerified,
    afterContentVerified,
    exactResultVerified,
    workerSelfReportAuthoritative: false,
    primaryWorkspaceModified: false,
    primaryWorkspaceApplyEnabled: false,
    automaticPatchApplyEnabled: false,
    completionAuthorityGranted: false,
    ActualCodexModelCalls: 0,
    ActualClaudeModelCalls: 0,
    CloudCalls: 0,
    issues,
    safety: {
      scopeSatisfied: evidence.scopeCompliant && evidence.totalChangedFiles === 1,
      shellExecuted: false,
      primaryWorkspaceWritten: false,
      taskCompleted: false,
      verifierRun: false,
      completionGateSatisfied: false,
      workerSelfReportAuthoritative: false,
    },
  };
}

function mutationEvidenceRecordDigest(
  record: Omit<TaskExecutionMutationEvidenceRecord, "evidenceDigest">,
): string {
  return digestJson(record);
}

function mutationArtifactRecordDigest(
  record: Omit<TaskExecutionMutationArtifactRecord, "artifactDigest">,
): string {
  return digestJson(record);
}

function buildMutationEvidenceRecord(input: {
  readonly authority: TaskExecutionIsolatedMutationWorkspaceAuthority;
  readonly baseline: TaskExecutionMutationWorkspaceBaseline;
  readonly evaluation: TaskExecutionClaudeWriteCanaryEvidenceResult;
  readonly invocationRevision: number;
  readonly invocationLifecycle: "returned" | "failed" | "outcome_unknown";
  readonly artifactRef: string | null;
  readonly artifactDigest: string | null;
  readonly occurredAt: string;
}): TaskExecutionMutationEvidenceRecord {
  const recordWithoutDigest: Omit<
    TaskExecutionMutationEvidenceRecord,
    "evidenceDigest"
  > = {
    schemaVersion: TASK_EXECUTION_MUTATION_EVIDENCE_SCHEMA_VERSION,
    recordKind: "task_execution_mutation_evidence",
    evidenceRef: mutationEvidenceRef(input.authority),
    createdAt: input.occurredAt,
    taskId: input.authority.taskId,
    taskRevision: input.authority.taskRevision,
    attemptId: input.authority.attemptId,
    attemptNumber: input.authority.attemptNumber,
    invocationId: input.authority.invocationId,
    invocationRevision: input.invocationRevision,
    invocationLifecycle: input.invocationLifecycle,
    mutationAuthorityInvocationRevision: input.authority.invocationRevision,
    idempotencyReference: input.authority.idempotencyKey,
    workerId: input.authority.workerId,
    workerFamily: input.authority.workerFamily,
    sourceWorkspaceRef: input.authority.sourceWorkspaceRef,
    isolatedWorkspaceRef: input.authority.isolatedWorkspaceRef,
    mutationScopeId: input.authority.mutationScope.scopeId,
    mutationScopeDigest: digestJson(input.authority.mutationScope),
    baselineCapturedAt: input.baseline.capturedAt,
    baselineDigest: digestJson(input.baseline.entries),
    actualChangedPaths: input.evaluation.evidence.actualChangedPaths,
    changedFiles: input.evaluation.evidence.changedFiles,
    totalChangedFiles: input.evaluation.evidence.totalChangedFiles,
    totalChangedBytes: input.evaluation.evidence.totalChangedBytes,
    scopeCompliant: input.evaluation.evidence.scopeCompliant,
    unexpectedMutations: input.evaluation.evidence.unexpectedMutations,
    protectedPathViolations: input.evaluation.evidence.protectedPathViolations,
    maxFilesExceeded: input.evaluation.evidence.maxFilesExceeded,
    maxBytesExceeded: input.evaluation.evidence.maxBytesExceeded,
    exactResultVerified: input.evaluation.exactResultVerified,
    verificationStatus: input.evaluation.ok ? "verified" : "rejected",
    verificationIssueCodes: input.evaluation.issues.map((item) => item.code),
    workerDeclaredChangedFiles:
      input.evaluation.evidence.workerDeclaredChangedFiles,
    workerSelfReportAuthoritative: false,
    primaryWorkspaceApplyEnabled: false,
    automaticPatchApplyEnabled: false,
    completionAuthorityGranted: false,
    verifierRun: false,
    retryAuthorized: false,
    artifactRef: input.artifactRef,
    artifactDigest: input.artifactDigest,
    fileContentsLogged: false,
  };

  return {
    ...recordWithoutDigest,
    evidenceDigest: mutationEvidenceRecordDigest(recordWithoutDigest),
  };
}

async function buildMutationArtifactRecord(input: {
  readonly authority: TaskExecutionIsolatedMutationWorkspaceAuthority;
  readonly evidenceRecord: TaskExecutionMutationEvidenceRecord;
  readonly invocationRevision: number;
  readonly occurredAt: string;
  readonly forbiddenValues?: readonly string[];
}): Promise<
  | { readonly ok: true; readonly record: TaskExecutionMutationArtifactRecord }
  | { readonly ok: false; readonly issues: readonly TaskExecutionWorkerIssue[] }
> {
  const files: TaskExecutionMutationArtifactFile[] = [];

  for (const changed of input.evidenceRecord.changedFiles) {
    const normalized = normalizeRelativePath(changed.relativePath);
    if (
      normalized === null ||
      normalized !== changed.relativePath ||
      !changed.scopeAllowed ||
      changed.operation === "deleted" ||
      changed.protectedPath
    ) {
      return {
        ok: false,
        issues: storageIssue({
          code: "task_execution_mutation_artifact_scope_invalid",
          message:
            "Mutation artifact can only capture scoped created or updated regular files.",
          category: "permission",
        }),
      };
    }

    const absolutePath = join(
      input.authority.isolatedWorkspaceRoot,
      changed.relativePath,
    );
    const stats = await lstat(absolutePath).catch(() => null);
    const rootReal = await safeRealpath(input.authority.isolatedWorkspaceRoot);
    const fileReal = await safeRealpath(absolutePath);
    if (
      stats === null ||
      !stats.isFile() ||
      stats.isSymbolicLink() ||
      rootReal === null ||
      fileReal === null ||
      !isInsideOrEqual(rootReal, fileReal)
    ) {
      return {
        ok: false,
        issues: storageIssue({
          code: "task_execution_mutation_artifact_file_unsafe",
          message:
            "Mutation artifact capture rejects missing, symlink, non-file, or escaping paths.",
          category: "permission",
        }),
      };
    }

    const afterContent = await readFile(absolutePath, "utf8");
    const afterBytes = Buffer.byteLength(afterContent, "utf8");
    const afterDigest = digestContent(afterContent);

    if (
      afterBytes !== changed.afterBytes ||
      afterDigest !== changed.afterDigest ||
      afterBytes > input.authority.mutationScope.maxTotalChangedBytes
    ) {
      return {
        ok: false,
        issues: storageIssue({
          code: "task_execution_mutation_artifact_digest_mismatch",
          message:
            "Mutation artifact content must match independently derived after digest and byte evidence.",
          category: "validation",
        }),
      };
    }

    files.push({
      relativePath: changed.relativePath,
      operation: changed.operation,
      encoding: "utf8",
      beforeDigest: changed.beforeDigest,
      afterDigest,
      beforeBytes: changed.beforeBytes,
      afterBytes,
      afterContent,
    });
  }

  const totalBytes = files.reduce((sum, file) => sum + file.afterBytes, 0);
  if (
    files.length !== input.evidenceRecord.totalChangedFiles ||
    totalBytes !== input.evidenceRecord.totalChangedBytes ||
    totalBytes > input.authority.mutationScope.maxTotalChangedBytes
  ) {
    return {
      ok: false,
      issues: storageIssue({
        code: "task_execution_mutation_artifact_size_unbounded",
        message:
          "Mutation artifact must stay within the system-owned mutation byte and file bounds.",
        category: "permission",
      }),
    };
  }

  const recordWithoutDigest: Omit<
    TaskExecutionMutationArtifactRecord,
    "artifactDigest"
  > = {
    schemaVersion: TASK_EXECUTION_MUTATION_ARTIFACT_SCHEMA_VERSION,
    recordKind: "task_execution_mutation_artifact",
    artifactRef: mutationArtifactRef(input.authority),
    createdAt: input.occurredAt,
    taskId: input.authority.taskId,
    taskRevision: input.authority.taskRevision,
    attemptId: input.authority.attemptId,
    invocationId: input.authority.invocationId,
    invocationRevision: input.invocationRevision,
    evidenceRef: input.evidenceRecord.evidenceRef,
    evidenceDigest: input.evidenceRecord.evidenceDigest,
    mutationScopeId: input.authority.mutationScope.scopeId,
    mutationScopeDigest: digestJson(input.authority.mutationScope),
    isolatedWorkspaceRef: input.authority.isolatedWorkspaceRef,
    maxTotalBytes: input.authority.mutationScope.maxTotalChangedBytes,
    totalBytes,
    files,
    primaryApplyPerformed: false,
  };
  const record = {
    ...recordWithoutDigest,
    artifactDigest: mutationArtifactRecordDigest(recordWithoutDigest),
  };

  if (
    !noForbiddenValues({
      value: record,
      forbiddenValues: input.forbiddenValues,
    })
  ) {
    return {
      ok: false,
      issues: storageIssue({
        code: "task_execution_mutation_artifact_secret_rejected",
        message:
          "Mutation artifact persistence rejects ownership tokens and secret-shaped values.",
        category: "permission",
      }),
    };
  }

  return { ok: true, record };
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isEvidenceRecord(value: unknown): value is TaskExecutionMutationEvidenceRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as TaskExecutionMutationEvidenceRecord;
  return (
    record.schemaVersion === TASK_EXECUTION_MUTATION_EVIDENCE_SCHEMA_VERSION &&
    record.recordKind === "task_execution_mutation_evidence" &&
    isSafeRef(record.taskId) &&
    isSafeRef(record.attemptId) &&
    isSafeRef(record.invocationId) &&
    isPositiveInteger(record.taskRevision, 999999999) &&
    isPositiveInteger(record.attemptNumber, 999999999) &&
    isPositiveInteger(record.invocationRevision, 999999999) &&
    isPositiveInteger(record.mutationAuthorityInvocationRevision, 999999999) &&
    typeof record.evidenceRef === "string" &&
    typeof record.evidenceDigest === "string" &&
    typeof record.idempotencyReference === "string" &&
    typeof record.workerId === "string" &&
    (record.workerFamily === "codex" ||
      record.workerFamily === "claude_code" ||
      record.workerFamily === "generic") &&
    typeof record.sourceWorkspaceRef === "string" &&
    typeof record.isolatedWorkspaceRef === "string" &&
    typeof record.mutationScopeId === "string" &&
    typeof record.mutationScopeDigest === "string" &&
    typeof record.baselineCapturedAt === "string" &&
    typeof record.baselineDigest === "string" &&
    isStringArray(record.actualChangedPaths) &&
    Array.isArray(record.changedFiles) &&
    typeof record.totalChangedFiles === "number" &&
    typeof record.totalChangedBytes === "number" &&
    typeof record.scopeCompliant === "boolean" &&
    isStringArray(record.unexpectedMutations) &&
    isStringArray(record.protectedPathViolations) &&
    typeof record.maxFilesExceeded === "boolean" &&
    typeof record.maxBytesExceeded === "boolean" &&
    typeof record.exactResultVerified === "boolean" &&
    (record.verificationStatus === "verified" ||
      record.verificationStatus === "rejected") &&
    isStringArray(record.verificationIssueCodes) &&
    isStringArray(record.workerDeclaredChangedFiles) &&
    record.workerSelfReportAuthoritative === false &&
    record.primaryWorkspaceApplyEnabled === false &&
    record.automaticPatchApplyEnabled === false &&
    record.completionAuthorityGranted === false &&
    record.verifierRun === false &&
    record.retryAuthorized === false &&
    (record.artifactRef === null || typeof record.artifactRef === "string") &&
    (record.artifactDigest === null || typeof record.artifactDigest === "string") &&
    record.fileContentsLogged === false &&
    record.evidenceDigest ===
      mutationEvidenceRecordDigest(withoutEvidenceDigest(record))
  );
}

function isArtifactRecord(value: unknown): value is TaskExecutionMutationArtifactRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as TaskExecutionMutationArtifactRecord;
  const filesValid =
    Array.isArray(record.files) &&
    record.files.every(
      (file) =>
        normalizeRelativePath(file.relativePath) === file.relativePath &&
        (file.operation === "created" || file.operation === "updated") &&
        file.encoding === "utf8" &&
        typeof file.afterContent === "string" &&
        digestContent(file.afterContent) === file.afterDigest &&
        Buffer.byteLength(file.afterContent, "utf8") === file.afterBytes,
    );
  const totalBytes = Array.isArray(record.files)
    ? record.files.reduce((sum, file) => sum + file.afterBytes, 0)
    : -1;

  return (
    record.schemaVersion === TASK_EXECUTION_MUTATION_ARTIFACT_SCHEMA_VERSION &&
    record.recordKind === "task_execution_mutation_artifact" &&
    isSafeRef(record.taskId) &&
    isSafeRef(record.attemptId) &&
    isSafeRef(record.invocationId) &&
    isPositiveInteger(record.taskRevision, 999999999) &&
    isPositiveInteger(record.invocationRevision, 999999999) &&
    typeof record.artifactRef === "string" &&
    typeof record.artifactDigest === "string" &&
    typeof record.evidenceRef === "string" &&
    typeof record.evidenceDigest === "string" &&
    typeof record.mutationScopeId === "string" &&
    typeof record.mutationScopeDigest === "string" &&
    typeof record.isolatedWorkspaceRef === "string" &&
    isPositiveInteger(record.maxTotalBytes, 1024 * 1024) &&
    totalBytes === record.totalBytes &&
    record.totalBytes <= record.maxTotalBytes &&
    filesValid &&
    record.primaryApplyPerformed === false &&
    record.artifactDigest ===
      mutationArtifactRecordDigest(withoutArtifactDigest(record))
  );
}

export async function loadTaskExecutionMutationEvidence(
  input: LoadTaskExecutionMutationEvidenceInput,
): Promise<TaskExecutionMutationEvidenceLoadResult> {
  const storage = await ensureSafeStoragePath({
    ...input,
    rootName: "mutation-evidence",
    create: false,
  });
  if (!storage.ok) {
    return {
      ok: false,
      record: null,
      path: null,
      verified: false,
      issues: storage.issues,
    };
  }

  const stats = await lstat(storage.path).catch(() => null);
  if (stats === null || !stats.isFile() || stats.isSymbolicLink()) {
    return {
      ok: false,
      record: null,
      path: storage.path,
      verified: false,
      issues: storageIssue({
        code: "task_execution_mutation_evidence_record_missing",
        message:
          "Mutation evidence record is missing or not a regular file.",
        category: "not_found",
      }),
    };
  }

  try {
    const parsed = JSON.parse(await readFile(storage.path, "utf8")) as unknown;
    if (!isEvidenceRecord(parsed)) {
      return {
        ok: false,
        record: null,
        path: storage.path,
        verified: false,
        issues: storageIssue({
          code: "task_execution_mutation_evidence_record_corrupt",
          message:
            "Mutation evidence record failed schema and digest verification.",
          category: "validation",
        }),
      };
    }

    if (
      parsed.taskId !== input.taskId ||
      parsed.invocationId !== input.invocationId ||
      parsed.evidenceRef !== mutationEvidenceRef(input)
    ) {
      return {
        ok: false,
        record: null,
        path: storage.path,
        verified: false,
        issues: storageIssue({
          code: "task_execution_mutation_evidence_identity_mismatch",
          message:
            "Mutation evidence record identity must match the requested task and invocation.",
          category: "conflict",
        }),
      };
    }

    return {
      ok: true,
      record: parsed,
      path: storage.path,
      verified: true,
      issues: [],
    };
  } catch {
    return {
      ok: false,
      record: null,
      path: storage.path,
      verified: false,
      issues: storageIssue({
        code: "task_execution_mutation_evidence_record_corrupt",
        message:
          "Mutation evidence record could not be parsed.",
        category: "validation",
      }),
    };
  }
}

export async function loadTaskExecutionMutationArtifact(
  input: LoadTaskExecutionMutationEvidenceInput,
): Promise<TaskExecutionMutationArtifactLoadResult> {
  const storage = await ensureSafeStoragePath({
    ...input,
    rootName: "mutation-artifacts",
    create: false,
  });
  if (!storage.ok) {
    return {
      ok: false,
      record: null,
      path: null,
      verified: false,
      issues: storage.issues,
    };
  }

  const stats = await lstat(storage.path).catch(() => null);
  if (stats === null || !stats.isFile() || stats.isSymbolicLink()) {
    return {
      ok: false,
      record: null,
      path: storage.path,
      verified: false,
      issues: storageIssue({
        code: "task_execution_mutation_artifact_record_missing",
        message:
          "Mutation artifact record is missing or not a regular file.",
        category: "not_found",
      }),
    };
  }

  try {
    const parsed = JSON.parse(await readFile(storage.path, "utf8")) as unknown;
    if (!isArtifactRecord(parsed)) {
      return {
        ok: false,
        record: null,
        path: storage.path,
        verified: false,
        issues: storageIssue({
          code: "task_execution_mutation_artifact_record_corrupt",
          message:
            "Mutation artifact record failed schema, digest, and content verification.",
          category: "validation",
        }),
      };
    }

    if (
      parsed.taskId !== input.taskId ||
      parsed.invocationId !== input.invocationId ||
      parsed.artifactRef !== mutationArtifactRef(input)
    ) {
      return {
        ok: false,
        record: null,
        path: storage.path,
        verified: false,
        issues: storageIssue({
          code: "task_execution_mutation_artifact_identity_mismatch",
          message:
            "Mutation artifact record identity must match the requested task and invocation.",
          category: "conflict",
        }),
      };
    }

    return {
      ok: true,
      record: parsed,
      path: storage.path,
      verified: true,
      issues: [],
    };
  } catch {
    return {
      ok: false,
      record: null,
      path: storage.path,
      verified: false,
      issues: storageIssue({
        code: "task_execution_mutation_artifact_record_corrupt",
        message:
          "Mutation artifact record could not be parsed.",
        category: "validation",
      }),
    };
  }
}

export async function persistTaskExecutionMutationEvidence(
  input: PersistTaskExecutionMutationEvidenceInput,
): Promise<TaskExecutionMutationEvidencePersistenceResult> {
  const issues: TaskExecutionWorkerIssue[] = [
    ...(await validateAuthorityRoot(input.authority)),
  ];
  const now = input.occurredAt ?? new Date().toISOString();
  const evidenceStorage = await ensureSafeStoragePath({
    projectRoot: input.projectRoot,
    rootName: "mutation-evidence",
    taskId: input.authority.taskId,
    invocationId: input.authority.invocationId,
    create: true,
  });
  if (!evidenceStorage.ok) {
    return {
      ok: false,
      status: "persistence_failed",
      evidenceRecord: null,
      artifactRecord: null,
      evidencePath: null,
      artifactPath: null,
      readBackVerified: false,
      artifactReadBackVerified: false,
      primaryApplyInputDurable: false,
      immutable: true,
      issues: [...issues, ...evidenceStorage.issues],
      ActualCodexModelCalls: 0,
      ActualClaudeModelCalls: 0,
      CloudCalls: 0,
    };
  }

  const artifactRef =
    input.persistArtifact && input.evaluation.ok
      ? mutationArtifactRef(input.authority)
      : null;
  const evidenceRecord = buildMutationEvidenceRecord({
    authority: input.authority,
    baseline: input.baseline,
    evaluation: input.evaluation,
    invocationRevision: input.invocationRevision,
    invocationLifecycle: input.invocationLifecycle,
    artifactRef,
    artifactDigest: null,
    occurredAt: now,
  });
  let artifactRecord: TaskExecutionMutationArtifactRecord | null = null;
  let artifactPath: string | null = null;

  if (input.persistArtifact && input.evaluation.ok) {
    const artifactBuild = await buildMutationArtifactRecord({
      authority: input.authority,
      evidenceRecord,
      invocationRevision: input.invocationRevision,
      occurredAt: now,
      forbiddenValues: input.forbiddenValues,
    });

    if (!artifactBuild.ok) {
      return {
        ok: false,
        status: "artifact_failed",
        evidenceRecord: null,
        artifactRecord: null,
        evidencePath: evidenceStorage.path,
        artifactPath: null,
        readBackVerified: false,
        artifactReadBackVerified: false,
        primaryApplyInputDurable: false,
        immutable: true,
        issues: [...issues, ...artifactBuild.issues],
        ActualCodexModelCalls: 0,
        ActualClaudeModelCalls: 0,
        CloudCalls: 0,
      };
    }

    const artifactStorage = await ensureSafeStoragePath({
      projectRoot: input.projectRoot,
      rootName: "mutation-artifacts",
      taskId: input.authority.taskId,
      invocationId: input.authority.invocationId,
      create: true,
    });
    if (!artifactStorage.ok) {
      return {
        ok: false,
        status: "artifact_failed",
        evidenceRecord: null,
        artifactRecord: null,
        evidencePath: evidenceStorage.path,
        artifactPath: null,
        readBackVerified: false,
        artifactReadBackVerified: false,
        primaryApplyInputDurable: false,
        immutable: true,
        issues: [...issues, ...artifactStorage.issues],
        ActualCodexModelCalls: 0,
        ActualClaudeModelCalls: 0,
        CloudCalls: 0,
      };
    }

    const artifactWriteIssues = await writeImmutableJson({
      path: artifactStorage.path,
      root: artifactStorage.root,
      value: artifactBuild.record,
    });
    if (artifactWriteIssues.some((item) => item.severity === "error")) {
      return {
        ok: false,
        status: "artifact_failed",
        evidenceRecord: null,
        artifactRecord: null,
        evidencePath: evidenceStorage.path,
        artifactPath: artifactStorage.path,
        readBackVerified: false,
        artifactReadBackVerified: false,
        primaryApplyInputDurable: false,
        immutable: true,
        issues: [...issues, ...artifactWriteIssues],
        ActualCodexModelCalls: 0,
        ActualClaudeModelCalls: 0,
        CloudCalls: 0,
      };
    }

    artifactRecord = artifactBuild.record;
    artifactPath = artifactStorage.path;
  }

  if (
    !noForbiddenValues({
      value: evidenceRecord,
      forbiddenValues: input.forbiddenValues,
    })
  ) {
    return {
      ok: false,
      status: "persistence_failed",
      evidenceRecord: null,
      artifactRecord: null,
      evidencePath: evidenceStorage.path,
      artifactPath,
      readBackVerified: false,
      artifactReadBackVerified: false,
      primaryApplyInputDurable: false,
      immutable: true,
      issues: [
        ...issues,
        ...storageIssue({
          code: "task_execution_mutation_evidence_secret_rejected",
          message:
            "Mutation evidence persistence rejects ownership tokens and secret-shaped values.",
          category: "permission",
        }),
      ],
      ActualCodexModelCalls: 0,
      ActualClaudeModelCalls: 0,
      CloudCalls: 0,
    };
  }

  const evidenceWriteIssues = await writeImmutableJson({
    path: evidenceStorage.path,
    root: evidenceStorage.root,
    value: evidenceRecord,
  });
  if (evidenceWriteIssues.some((item) => item.severity === "error")) {
    return {
      ok: false,
      status: "persistence_failed",
      evidenceRecord: null,
      artifactRecord,
      evidencePath: evidenceStorage.path,
      artifactPath,
      readBackVerified: false,
      artifactReadBackVerified: false,
      primaryApplyInputDurable: false,
      immutable: true,
      issues: [...issues, ...evidenceWriteIssues],
      ActualCodexModelCalls: 0,
      ActualClaudeModelCalls: 0,
      CloudCalls: 0,
    };
  }

  const loadedEvidence = await loadTaskExecutionMutationEvidence({
    projectRoot: input.projectRoot,
    taskId: input.authority.taskId,
    invocationId: input.authority.invocationId,
  });
  const loadedArtifact =
    artifactRecord === null
      ? null
      : await loadTaskExecutionMutationArtifact({
          projectRoot: input.projectRoot,
          taskId: input.authority.taskId,
          invocationId: input.authority.invocationId,
        });
  const artifactVerified =
    artifactRecord === null
      ? !input.evaluation.ok
      : loadedArtifact?.ok === true &&
        loadedArtifact.record?.artifactDigest === artifactRecord.artifactDigest;
  const readBackVerified =
    loadedEvidence.ok &&
    loadedEvidence.record?.evidenceDigest === evidenceRecord.evidenceDigest;
  const primaryApplyInputDurable =
    input.evaluation.ok &&
    readBackVerified &&
    artifactRecord !== null &&
    artifactVerified;
  const ok = readBackVerified && artifactVerified && input.evaluation.ok;

  return {
    ok,
    status: ok
      ? "persisted_and_verified"
      : input.evaluation.ok
        ? "persistence_failed"
        : "evidence_rejected",
    evidenceRecord,
    artifactRecord,
    evidencePath: evidenceStorage.path,
    artifactPath,
    readBackVerified,
    artifactReadBackVerified: artifactVerified,
    primaryApplyInputDurable,
    immutable: true,
    issues: [
      ...issues,
      ...loadedEvidence.issues,
      ...(loadedArtifact?.issues ?? []),
    ],
    ActualCodexModelCalls: 0,
    ActualClaudeModelCalls: 0,
    CloudCalls: 0,
  };
}

export async function verifyTaskExecutionMutationEvidenceForAuthority(
  input: VerifyTaskExecutionMutationEvidenceForAuthorityInput,
): Promise<TaskExecutionMutationEvidenceAuthorityVerificationResult> {
  const evidence = await loadTaskExecutionMutationEvidence({
    projectRoot: input.projectRoot,
    taskId: input.authority.taskId,
    invocationId: input.authority.invocationId,
  });
  const issues: TaskExecutionWorkerIssue[] = [...evidence.issues];
  const expectedMutationScopeDigest = digestJson(input.authority.mutationScope);
  const record = evidence.record;
  const authorityBound =
    evidence.ok &&
    record !== null &&
    record.taskId === input.authority.taskId &&
    record.taskRevision === input.authority.taskRevision &&
    record.attemptId === input.authority.attemptId &&
    record.attemptNumber === input.authority.attemptNumber &&
    record.invocationId === input.authority.invocationId &&
    record.mutationAuthorityInvocationRevision ===
      input.authority.invocationRevision &&
    record.idempotencyReference === input.authority.idempotencyKey &&
    record.workerId === input.authority.workerId &&
    record.workerFamily === input.authority.workerFamily &&
    record.sourceWorkspaceRef === input.authority.sourceWorkspaceRef &&
    record.isolatedWorkspaceRef === input.authority.isolatedWorkspaceRef &&
    record.mutationScopeId === input.authority.mutationScope.scopeId &&
    record.mutationScopeDigest === expectedMutationScopeDigest;

  if (record !== null && !authorityBound) {
    issues.push(
      issue({
        code: "task_execution_mutation_evidence_authority_mismatch",
        message:
          "Mutation evidence record does not bind to the supplied invocation authority.",
        category: "conflict",
      }),
    );
  }

  const artifact =
    record?.artifactRef === null || record === null
      ? null
      : await loadTaskExecutionMutationArtifact({
          projectRoot: input.projectRoot,
          taskId: input.authority.taskId,
          invocationId: input.authority.invocationId,
        });

  if (artifact !== null) {
    issues.push(...artifact.issues);
  }

  const artifactRecord = artifact?.record ?? null;
  const artifactBound =
    record !== null &&
    artifact !== null &&
    artifact.ok &&
    artifactRecord !== null &&
    artifactRecord.artifactRef === record.artifactRef &&
    artifactRecord.evidenceRef === record.evidenceRef &&
    artifactRecord.evidenceDigest === record.evidenceDigest &&
    artifactRecord.taskId === record.taskId &&
    artifactRecord.taskRevision === record.taskRevision &&
    artifactRecord.attemptId === record.attemptId &&
    artifactRecord.invocationId === record.invocationId &&
    artifactRecord.invocationRevision === record.invocationRevision &&
    artifactRecord.mutationScopeId === record.mutationScopeId &&
    artifactRecord.mutationScopeDigest === record.mutationScopeDigest &&
    artifactRecord.isolatedWorkspaceRef === record.isolatedWorkspaceRef &&
    artifactRecord.primaryApplyPerformed === false;

  if (record?.artifactRef !== null && record !== null && !artifactBound) {
    issues.push(
      issue({
        code: "task_execution_mutation_artifact_authority_mismatch",
        message:
          "Mutation artifact record does not bind to the durable evidence and invocation authority.",
        category: "conflict",
      }),
    );
  }

  const primaryApplyInputDurable =
    authorityBound &&
    artifactBound &&
    record !== null &&
    record.scopeCompliant &&
    record.exactResultVerified &&
    record.verificationStatus === "verified" &&
    record.primaryWorkspaceApplyEnabled === false &&
    record.automaticPatchApplyEnabled === false &&
    record.completionAuthorityGranted === false &&
    record.verifierRun === false &&
    record.retryAuthorized === false;

  return {
    ok:
      primaryApplyInputDurable &&
      issues.every((item) => item.severity !== "error"),
    evidence,
    artifact,
    authorityBound,
    artifactBound,
    primaryApplyInputDurable,
    issues,
  };
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
