import type { TaskExecutionWorkerIssue } from "./task-execution-worker.js";
import type {
  TaskExecutionIsolatedMutationWorkspaceAuthority,
  TaskExecutionMutationArtifactFile,
  TaskExecutionMutationArtifactRecord,
  TaskExecutionMutationEvidenceRecord,
} from "./task-execution-worker-mutation-workspace.js";
import {
  loadTaskExecutionMutationArtifact,
  loadTaskExecutionMutationEvidence,
  verifyTaskExecutionMutationEvidenceForAuthority,
} from "./task-execution-worker-mutation-workspace.js";
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
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  realpath,
  rename,
  rm,
  unlink,
  writeFile,
} = fsPromises;

export const TASK_EXECUTION_TEST_MUTATION_APPLY_RUNTIME_READY = true;
export const TASK_EXECUTION_REAL_PRIMARY_WORKSPACE_APPLY_ENABLED = false;
export const TASK_EXECUTION_MUTATION_APPLY_AUTOMATIC_PATCH_APPLY_ENABLED =
  false;
export const TASK_EXECUTION_PRIMARY_APPLY_CANARY_READY = false;
export const TASK_EXECUTION_MUTATION_APPLY_SCHEMA_VERSION = 1;
export const TASK_EXECUTION_MUTATION_APPLY_MAX_FILE_BYTES = 1024 * 1024;

export type TaskExecutionMutationApplyLifecycle =
  | "prepared"
  | "applying"
  | "applied"
  | "blocked"
  | "outcome_unknown";

export type TaskExecutionMutationApplyAuditFactKind =
  | "mutation_apply_intent"
  | "mutation_apply_outcome"
  | "mutation_apply_conflict";

export interface TaskExecutionTestPrimaryWorkspaceAuthority {
  readonly authority: "system";
  readonly workspaceKind: "deterministic_test_primary";
  readonly systemCreated: true;
  readonly workspaceRef: string;
  readonly projectRef: string;
  readonly primaryWorkspaceRoot: string;
  readonly realPrimaryApplyEnabled: false;
  readonly automaticPatchApplyEnabled: false;
}

export interface CreateTaskExecutionTestPrimaryWorkspaceInput {
  readonly projectRef: string;
  readonly workspaceRef: string;
  readonly initialFiles?: readonly {
    readonly relativePath: string;
    readonly content: string;
  }[];
}

export interface TaskExecutionTestPrimaryWorkspaceCreationResult {
  readonly ok: boolean;
  readonly authority: TaskExecutionTestPrimaryWorkspaceAuthority | null;
  readonly issues: readonly TaskExecutionWorkerIssue[];
  readonly RealPrimaryWorkspaceApplyEnabled: false;
  readonly AutomaticPatchApply: false;
  readonly ActualCodexModelCalls: 0;
  readonly ActualClaudeModelCalls: 0;
  readonly CloudCalls: 0;
}

export interface TaskExecutionMutationApplyAuthority {
  readonly authority: "system";
  readonly taskId: string;
  readonly taskRevision: number;
  readonly attemptId: string;
  readonly attemptNumber: number;
  readonly invocationId: string;
  readonly invocationRevision: number;
  readonly idempotencyReference: string;
  readonly workerId: string;
  readonly workerFamily: string;
  readonly sourceWorkspaceRef: string;
  readonly isolatedWorkspaceRef: string;
  readonly mutationScopeId: string;
  readonly mutationScopeDigest: string;
  readonly evidenceRef: string;
  readonly evidenceDigest: string;
  readonly artifactRef: string;
  readonly artifactDigest: string;
  readonly primaryWorkspaceRef: string;
  readonly primaryProjectRef: string;
  readonly changedRelativePath: string;
  readonly operation: "created" | "updated";
  readonly beforeDigest: string | null;
  readonly afterDigest: string;
  readonly artifactContentDigest: string;
  readonly artifactBytes: number;
  readonly artifactTotalBytes: number;
  readonly applyId: string;
  readonly applyStorageRef: string;
  readonly primaryWorkspaceApplyEnabled: false;
  readonly realPrimaryWorkspaceApplyEnabled: false;
  readonly automaticPatchApplyEnabled: false;
  readonly completionAuthorityGranted: false;
  readonly verifierRun: false;
  readonly retryAuthorized: false;
}

export interface TaskExecutionMutationApplyAuditFact {
  readonly auditSchemaVersion: typeof AEOS_TASK_EXECUTION_AUDIT_SCHEMA_VERSION;
  readonly factKind: TaskExecutionMutationApplyAuditFactKind;
  readonly taskId: string;
  readonly taskRevision: number;
  readonly attemptId: string;
  readonly invocationId: string;
  readonly invocationRevision: number;
  readonly workerId: string;
  readonly workerFamily: string;
  readonly sourceWorkspaceRef: string;
  readonly primaryWorkspaceRef: string;
  readonly mutationScopeId: string;
  readonly applyId: string;
  readonly evidenceRef: string;
  readonly artifactRef: string;
  readonly resultReference: string;
  readonly fileContentsLogged: false;
  readonly authorizesWorkCompletion: false;
  readonly authorizesVerifier: false;
  readonly authorizesRetry: false;
}

export interface TaskExecutionMutationApplyIntentRecord {
  readonly schemaVersion: typeof TASK_EXECUTION_MUTATION_APPLY_SCHEMA_VERSION;
  readonly recordKind: "task_execution_mutation_apply_intent";
  readonly recordDigest: string;
  readonly createdAt: string;
  readonly lifecycle: "prepared";
  readonly applyId: string;
  readonly authority: TaskExecutionMutationApplyAuthority;
  readonly fileContentsLogged: false;
}

export interface TaskExecutionMutationApplyApplyingRecord {
  readonly schemaVersion: typeof TASK_EXECUTION_MUTATION_APPLY_SCHEMA_VERSION;
  readonly recordKind: "task_execution_mutation_apply_applying";
  readonly recordDigest: string;
  readonly createdAt: string;
  readonly lifecycle: "applying";
  readonly applyId: string;
  readonly authorityDigest: string;
  readonly fileContentsLogged: false;
}

export interface TaskExecutionMutationApplyOutcomeRecord {
  readonly schemaVersion: typeof TASK_EXECUTION_MUTATION_APPLY_SCHEMA_VERSION;
  readonly recordKind: "task_execution_mutation_apply_outcome";
  readonly recordDigest: string;
  readonly createdAt: string;
  readonly lifecycle: "applied" | "blocked" | "outcome_unknown";
  readonly applyId: string;
  readonly authorityDigest: string;
  readonly resultDigest: string | null;
  readonly issueCodes: readonly string[];
  readonly fileContentsLogged: false;
  readonly completionAuthorityGranted: false;
  readonly verifierRun: false;
  readonly retryAuthorized: false;
}

export interface TaskExecutionMutationApplyRecord {
  readonly applyId: string;
  readonly lifecycle: TaskExecutionMutationApplyLifecycle;
  readonly intent: TaskExecutionMutationApplyIntentRecord | null;
  readonly applying: TaskExecutionMutationApplyApplyingRecord | null;
  readonly outcome: TaskExecutionMutationApplyOutcomeRecord | null;
  readonly immutable: true;
}

export interface TaskExecutionMutationApplyInput {
  readonly projectRoot: string;
  readonly mutationAuthority: TaskExecutionIsolatedMutationWorkspaceAuthority;
  readonly primaryWorkspaceAuthority: TaskExecutionTestPrimaryWorkspaceAuthority;
  readonly occurredAt?: string;
  readonly taskModelWorkerOrOperatorPathClaims?: unknown;
}

export interface TaskExecutionMutationApplyDecision {
  readonly ok: boolean;
  readonly status: TaskExecutionMutationApplyLifecycle;
  readonly authority: TaskExecutionMutationApplyAuthority | null;
  readonly evidence: TaskExecutionMutationEvidenceRecord | null;
  readonly artifact: TaskExecutionMutationArtifactRecord | null;
  readonly file: TaskExecutionMutationArtifactFile | null;
  readonly currentPrimaryDigest: string | null;
  readonly targetPath: string | null;
  readonly applyRecord: TaskExecutionMutationApplyRecord | null;
  readonly issues: readonly TaskExecutionWorkerIssue[];
  readonly PrimaryWorkspaceApplyEnabled: false;
  readonly RealPrimaryWorkspaceApplyEnabled: false;
  readonly AutomaticPatchApply: false;
  readonly CompletionAuthorityGranted: false;
  readonly VerifierSatisfied: false;
  readonly CompletionGateSatisfied: false;
  readonly ActualCodexModelCalls: 0;
  readonly ActualClaudeModelCalls: 0;
  readonly CloudCalls: 0;
}

export interface TaskExecutionMutationApplyResult
  extends TaskExecutionMutationApplyDecision {
  readonly applied: boolean;
  readonly reservationPersisted: boolean;
  readonly applyingPersisted: boolean;
  readonly afterDigestVerified: boolean;
  readonly auditFacts: readonly TaskExecutionMutationApplyAuditFact[];
}

type TestFaultInjection =
  | "before_reservation"
  | "after_reservation"
  | "before_rename"
  | "after_rename_before_outcome"
  | "outcome_persistence_failed";

const safeRefPattern = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,191}$/;
const protectedPathRefs = [
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

function pathMatchesProtected(pathRef: string): boolean {
  return protectedPathRefs.some(
    (protectedRef) =>
      pathRef === protectedRef || pathRef.startsWith(`${protectedRef}/`),
  );
}

function isInsideOrEqual(parent: string, child: string): boolean {
  const diff = relative(parent, child);
  return diff === "" || (!diff.startsWith("..") && !isAbsolute(diff));
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

function withoutDigest<T extends { readonly recordDigest: string }>(
  value: T,
): Omit<T, "recordDigest"> {
  const { recordDigest: _recordDigest, ...rest } = value;

  return rest;
}

async function safeRealpath(path: string): Promise<string | null> {
  try {
    return await realpath(path);
  } catch {
    return null;
  }
}

async function fsyncDirectory(path: string): Promise<void> {
  const handle = await open(path, "r").catch(() => null);
  if (handle === null) {
    return;
  }

  try {
    await handle.sync().catch(() => undefined);
  } finally {
    await handle.close();
  }
}

async function currentFileDigest(
  path: string,
): Promise<
  | { readonly kind: "missing"; readonly digest: null }
  | { readonly kind: "file"; readonly digest: string }
  | { readonly kind: "unsafe"; readonly digest: null }
> {
  const stats = await lstat(path).catch(() => null);
  if (stats === null) {
    return { kind: "missing", digest: null };
  }

  if (!stats.isFile() || stats.isSymbolicLink()) {
    return { kind: "unsafe", digest: null };
  }

  return { kind: "file", digest: digestContent(await readFile(path)) };
}

async function writeImmutableJson(input: {
  readonly path: string;
  readonly root: string;
  readonly value: unknown;
}): Promise<readonly TaskExecutionWorkerIssue[]> {
  const existing = await lstat(input.path).catch(() => null);
  if (existing !== null) {
    return storageIssue({
      code: "task_execution_mutation_apply_record_immutable",
      message:
        "Mutation apply records are immutable and cannot be overwritten.",
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
    await rename(tempPath, input.path);
    await fsyncDirectory(input.root);
  } catch {
    await unlink(tempPath).catch(() => undefined);
    return storageIssue({
      code: "task_execution_mutation_apply_record_write_failed",
      message:
        "Mutation apply record persistence failed before authority could proceed.",
      category: "unknown",
    });
  }

  return [];
}

async function ensureApplyStorage(input: {
  readonly projectRoot: string;
  readonly taskId: string;
  readonly applyId: string;
  readonly create: boolean;
}): Promise<
  | {
      readonly ok: true;
      readonly root: string;
      readonly applyRoot: string;
      readonly intentPath: string;
      readonly applyingPath: string;
      readonly outcomePath: string;
    }
  | { readonly ok: false; readonly issues: readonly TaskExecutionWorkerIssue[] }
> {
  if (!isSafeRef(input.taskId) || !isSafeRef(input.applyId)) {
    return {
      ok: false,
      issues: storageIssue({
        code: "task_execution_mutation_apply_storage_identity_invalid",
        message: "Mutation apply storage requires safe task and apply ids.",
      }),
    };
  }

  const projectRoot = await safeRealpath(input.projectRoot);
  if (projectRoot === null) {
    return {
      ok: false,
      issues: storageIssue({
        code: "task_execution_mutation_apply_project_root_missing",
        message: "Mutation apply storage requires an existing AEOS state root.",
        category: "not_found",
      }),
    };
  }

  const taskRoot = join(
    projectRoot,
    ".aeos",
    "state",
    "mutation-applies",
    input.taskId,
  );
  const applyRoot = join(taskRoot, input.applyId);

  if (input.create) {
    await mkdir(applyRoot, { recursive: true });
  }

  const applyRootReal = await safeRealpath(applyRoot);
  if (
    applyRootReal === null ||
    !isInsideOrEqual(projectRoot, applyRootReal) ||
    !isInsideOrEqual(applyRootReal, join(applyRootReal, "intent.json"))
  ) {
    return {
      ok: false,
      issues: storageIssue({
        code: "task_execution_mutation_apply_storage_path_unsafe",
        message:
          "Mutation apply storage path must stay inside system-owned AEOS state.",
        category: "permission",
      }),
    };
  }

  return {
    ok: true,
    root: applyRootReal,
    applyRoot: applyRootReal,
    intentPath: join(applyRootReal, "intent.json"),
    applyingPath: join(applyRootReal, "applying.json"),
    outcomePath: join(applyRootReal, "outcome.json"),
  };
}

function applyStorageRef(input: { readonly taskId: string; readonly applyId: string }): string {
  return `mutation-apply:${input.taskId}:${input.applyId}`;
}

function deriveApplyId(input: {
  readonly evidence: TaskExecutionMutationEvidenceRecord;
  readonly artifact: TaskExecutionMutationArtifactRecord;
  readonly file: TaskExecutionMutationArtifactFile;
  readonly primary: TaskExecutionTestPrimaryWorkspaceAuthority;
}): string {
  return `apply:${digestJson({
    taskId: input.evidence.taskId,
    taskRevision: input.evidence.taskRevision,
    attemptId: input.evidence.attemptId,
    attemptNumber: input.evidence.attemptNumber,
    invocationId: input.evidence.invocationId,
    invocationRevision: input.evidence.invocationRevision,
    idempotencyReference: input.evidence.idempotencyReference,
    workerId: input.evidence.workerId,
    workerFamily: input.evidence.workerFamily,
    sourceWorkspaceRef: input.evidence.sourceWorkspaceRef,
    isolatedWorkspaceRef: input.evidence.isolatedWorkspaceRef,
    mutationScopeId: input.evidence.mutationScopeId,
    mutationScopeDigest: input.evidence.mutationScopeDigest,
    evidenceRef: input.evidence.evidenceRef,
    evidenceDigest: input.evidence.evidenceDigest,
    artifactRef: input.artifact.artifactRef,
    artifactDigest: input.artifact.artifactDigest,
    primaryWorkspaceRef: input.primary.workspaceRef,
    primaryProjectRef: input.primary.projectRef,
    changedRelativePath: input.file.relativePath,
    operation: input.file.operation,
    beforeDigest: input.file.beforeDigest,
    afterDigest: input.file.afterDigest,
    artifactContentDigest: digestContent(input.file.afterContent),
    artifactBytes: input.file.afterBytes,
  }).slice(0, 48)}`;
}

function buildApplyAuthority(input: {
  readonly evidence: TaskExecutionMutationEvidenceRecord;
  readonly artifact: TaskExecutionMutationArtifactRecord;
  readonly file: TaskExecutionMutationArtifactFile;
  readonly primary: TaskExecutionTestPrimaryWorkspaceAuthority;
}): TaskExecutionMutationApplyAuthority {
  const applyId = deriveApplyId(input);

  return {
    authority: "system",
    taskId: input.evidence.taskId,
    taskRevision: input.evidence.taskRevision,
    attemptId: input.evidence.attemptId,
    attemptNumber: input.evidence.attemptNumber,
    invocationId: input.evidence.invocationId,
    invocationRevision: input.evidence.invocationRevision,
    idempotencyReference: input.evidence.idempotencyReference,
    workerId: input.evidence.workerId,
    workerFamily: input.evidence.workerFamily,
    sourceWorkspaceRef: input.evidence.sourceWorkspaceRef,
    isolatedWorkspaceRef: input.evidence.isolatedWorkspaceRef,
    mutationScopeId: input.evidence.mutationScopeId,
    mutationScopeDigest: input.evidence.mutationScopeDigest,
    evidenceRef: input.evidence.evidenceRef,
    evidenceDigest: input.evidence.evidenceDigest,
    artifactRef: input.artifact.artifactRef,
    artifactDigest: input.artifact.artifactDigest,
    primaryWorkspaceRef: input.primary.workspaceRef,
    primaryProjectRef: input.primary.projectRef,
    changedRelativePath: input.file.relativePath,
    operation: input.file.operation,
    beforeDigest: input.file.beforeDigest,
    afterDigest: input.file.afterDigest,
    artifactContentDigest: digestContent(input.file.afterContent),
    artifactBytes: input.file.afterBytes,
    artifactTotalBytes: input.artifact.totalBytes,
    applyId,
    applyStorageRef: applyStorageRef({
      taskId: input.evidence.taskId,
      applyId,
    }),
    primaryWorkspaceApplyEnabled: false,
    realPrimaryWorkspaceApplyEnabled: false,
    automaticPatchApplyEnabled: false,
    completionAuthorityGranted: false,
    verifierRun: false,
    retryAuthorized: false,
  };
}

function applyAuditFact(input: {
  readonly authority: TaskExecutionMutationApplyAuthority;
  readonly factKind: TaskExecutionMutationApplyAuditFactKind;
  readonly resultReference: string;
}): TaskExecutionMutationApplyAuditFact {
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
    sourceWorkspaceRef: input.authority.sourceWorkspaceRef,
    primaryWorkspaceRef: input.authority.primaryWorkspaceRef,
    mutationScopeId: input.authority.mutationScopeId,
    applyId: input.authority.applyId,
    evidenceRef: input.authority.evidenceRef,
    artifactRef: input.authority.artifactRef,
    resultReference: input.resultReference,
    fileContentsLogged: false,
    authorizesWorkCompletion: false,
    authorizesVerifier: false,
    authorizesRetry: false,
  };
}

function makeIntentRecord(input: {
  readonly authority: TaskExecutionMutationApplyAuthority;
  readonly occurredAt: string;
}): TaskExecutionMutationApplyIntentRecord {
  const withoutRecordDigest: Omit<
    TaskExecutionMutationApplyIntentRecord,
    "recordDigest"
  > = {
    schemaVersion: TASK_EXECUTION_MUTATION_APPLY_SCHEMA_VERSION,
    recordKind: "task_execution_mutation_apply_intent",
    createdAt: input.occurredAt,
    lifecycle: "prepared",
    applyId: input.authority.applyId,
    authority: input.authority,
    fileContentsLogged: false,
  };

  return {
    ...withoutRecordDigest,
    recordDigest: digestJson(withoutRecordDigest),
  };
}

function makeApplyingRecord(input: {
  readonly authority: TaskExecutionMutationApplyAuthority;
  readonly occurredAt: string;
}): TaskExecutionMutationApplyApplyingRecord {
  const withoutRecordDigest: Omit<
    TaskExecutionMutationApplyApplyingRecord,
    "recordDigest"
  > = {
    schemaVersion: TASK_EXECUTION_MUTATION_APPLY_SCHEMA_VERSION,
    recordKind: "task_execution_mutation_apply_applying",
    createdAt: input.occurredAt,
    lifecycle: "applying",
    applyId: input.authority.applyId,
    authorityDigest: digestJson(input.authority),
    fileContentsLogged: false,
  };

  return {
    ...withoutRecordDigest,
    recordDigest: digestJson(withoutRecordDigest),
  };
}

function makeOutcomeRecord(input: {
  readonly authority: TaskExecutionMutationApplyAuthority;
  readonly lifecycle: "applied" | "blocked" | "outcome_unknown";
  readonly resultDigest: string | null;
  readonly issueCodes: readonly string[];
  readonly occurredAt: string;
}): TaskExecutionMutationApplyOutcomeRecord {
  const withoutRecordDigest: Omit<
    TaskExecutionMutationApplyOutcomeRecord,
    "recordDigest"
  > = {
    schemaVersion: TASK_EXECUTION_MUTATION_APPLY_SCHEMA_VERSION,
    recordKind: "task_execution_mutation_apply_outcome",
    createdAt: input.occurredAt,
    lifecycle: input.lifecycle,
    applyId: input.authority.applyId,
    authorityDigest: digestJson(input.authority),
    resultDigest: input.resultDigest,
    issueCodes: input.issueCodes,
    fileContentsLogged: false,
    completionAuthorityGranted: false,
    verifierRun: false,
    retryAuthorized: false,
  };

  return {
    ...withoutRecordDigest,
    recordDigest: digestJson(withoutRecordDigest),
  };
}

function isIntentRecord(
  value: unknown,
): value is TaskExecutionMutationApplyIntentRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as TaskExecutionMutationApplyIntentRecord;

  return (
    record.schemaVersion === TASK_EXECUTION_MUTATION_APPLY_SCHEMA_VERSION &&
    record.recordKind === "task_execution_mutation_apply_intent" &&
    record.lifecycle === "prepared" &&
    isSafeRef(record.applyId) &&
    typeof record.authority === "object" &&
    record.authority !== null &&
    record.authority.applyId === record.applyId &&
    record.fileContentsLogged === false &&
    record.recordDigest === digestJson(withoutDigest(record))
  );
}

function isApplyingRecord(
  value: unknown,
): value is TaskExecutionMutationApplyApplyingRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as TaskExecutionMutationApplyApplyingRecord;

  return (
    record.schemaVersion === TASK_EXECUTION_MUTATION_APPLY_SCHEMA_VERSION &&
    record.recordKind === "task_execution_mutation_apply_applying" &&
    record.lifecycle === "applying" &&
    isSafeRef(record.applyId) &&
    typeof record.authorityDigest === "string" &&
    record.fileContentsLogged === false &&
    record.recordDigest === digestJson(withoutDigest(record))
  );
}

function isOutcomeRecord(
  value: unknown,
): value is TaskExecutionMutationApplyOutcomeRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as TaskExecutionMutationApplyOutcomeRecord;

  return (
    record.schemaVersion === TASK_EXECUTION_MUTATION_APPLY_SCHEMA_VERSION &&
    record.recordKind === "task_execution_mutation_apply_outcome" &&
    (record.lifecycle === "applied" ||
      record.lifecycle === "blocked" ||
      record.lifecycle === "outcome_unknown") &&
    isSafeRef(record.applyId) &&
    typeof record.authorityDigest === "string" &&
    (record.resultDigest === null || typeof record.resultDigest === "string") &&
    Array.isArray(record.issueCodes) &&
    record.issueCodes.every((code) => typeof code === "string") &&
    record.fileContentsLogged === false &&
    record.completionAuthorityGranted === false &&
    record.verifierRun === false &&
    record.retryAuthorized === false &&
    record.recordDigest === digestJson(withoutDigest(record))
  );
}

async function loadJson(path: string): Promise<unknown | null> {
  const stats = await lstat(path).catch(() => null);
  if (stats === null) {
    return null;
  }
  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw new Error("unsafe_apply_record");
  }

  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

export async function loadTaskExecutionMutationApplyRecord(input: {
  readonly projectRoot: string;
  readonly taskId: string;
  readonly applyId: string;
}): Promise<{
  readonly ok: boolean;
  readonly record: TaskExecutionMutationApplyRecord | null;
  readonly issues: readonly TaskExecutionWorkerIssue[];
}> {
  const storage = await ensureApplyStorage({ ...input, create: false });
  if (!storage.ok) {
    return { ok: false, record: null, issues: storage.issues };
  }

  try {
    const intentValue = await loadJson(storage.intentPath);
    const applyingValue = await loadJson(storage.applyingPath);
    const outcomeValue = await loadJson(storage.outcomePath);
    const intent = intentValue === null ? null : isIntentRecord(intentValue) ? intentValue : null;
    const applying =
      applyingValue === null
        ? null
        : isApplyingRecord(applyingValue)
          ? applyingValue
          : null;
    const outcome =
      outcomeValue === null
        ? null
        : isOutcomeRecord(outcomeValue)
          ? outcomeValue
          : null;

    if (
      (intentValue !== null && intent === null) ||
      (applyingValue !== null && applying === null) ||
      (outcomeValue !== null && outcome === null) ||
      intent === null
    ) {
      return {
        ok: false,
        record: null,
        issues: storageIssue({
          code: "task_execution_mutation_apply_record_corrupt",
          message:
            "Mutation apply record failed schema, digest, or immutable lifecycle verification.",
          category: "validation",
        }),
      };
    }

    const authorityDigest = digestJson(intent.authority);
    if (
      (applying !== null && applying.authorityDigest !== authorityDigest) ||
      (outcome !== null && outcome.authorityDigest !== authorityDigest) ||
      input.applyId !== intent.applyId
    ) {
      return {
        ok: false,
        record: null,
        issues: storageIssue({
          code: "task_execution_mutation_apply_record_authority_mismatch",
          message:
            "Mutation apply lifecycle records must bind to the exact immutable intent authority.",
          category: "conflict",
        }),
      };
    }

    return {
      ok: true,
      record: {
        applyId: intent.applyId,
        lifecycle:
          outcome?.lifecycle ?? (applying === null ? "prepared" : "applying"),
        intent,
        applying,
        outcome,
        immutable: true,
      },
      issues: [],
    };
  } catch {
    return {
      ok: false,
      record: null,
      issues: storageIssue({
        code: "task_execution_mutation_apply_record_corrupt",
        message: "Mutation apply record could not be parsed safely.",
        category: "validation",
      }),
    };
  }
}

async function validatePrimaryWorkspaceAuthority(
  primary: TaskExecutionTestPrimaryWorkspaceAuthority,
): Promise<readonly TaskExecutionWorkerIssue[]> {
  const issues: TaskExecutionWorkerIssue[] = [];
  const tempRoot = await realpath(tmpdir());
  const primaryRoot = await safeRealpath(primary.primaryWorkspaceRoot);

  if (
    primary.authority !== "system" ||
    primary.workspaceKind !== "deterministic_test_primary" ||
    primary.systemCreated !== true ||
    !isSafeRef(primary.workspaceRef) ||
    !isSafeRef(primary.projectRef) ||
    primary.realPrimaryApplyEnabled !== false ||
    primary.automaticPatchApplyEnabled !== false ||
    primaryRoot === null ||
    !isInsideOrEqual(tempRoot, primaryRoot) ||
    !primaryRoot.includes(`${sep}aeos-test-primary-apply-`)
  ) {
    issues.push(
      issue({
        code: "task_execution_mutation_apply_primary_workspace_unauthorized",
        message:
          "Primary apply authority can execute only against AEOS-created deterministic TEST primary workspaces.",
        category: "permission",
      }),
    );
  }

  return issues;
}

async function validateTargetPath(input: {
  readonly primary: TaskExecutionTestPrimaryWorkspaceAuthority;
  readonly file: TaskExecutionMutationArtifactFile;
}): Promise<
  | {
      readonly ok: true;
      readonly root: string;
      readonly targetPath: string;
      readonly currentDigest: string | null;
    }
  | {
      readonly ok: false;
      readonly targetPath: string | null;
      readonly currentDigest: string | null;
      readonly issues: readonly TaskExecutionWorkerIssue[];
    }
> {
  const normalized = normalizeRelativePath(input.file.relativePath);
  if (
    normalized === null ||
    normalized !== input.file.relativePath ||
    pathMatchesProtected(normalized)
  ) {
    return {
      ok: false,
      targetPath: null,
      currentDigest: null,
      issues: [
        issue({
          code:
            normalized === null
              ? "task_execution_mutation_apply_path_invalid"
              : "task_execution_mutation_apply_protected_path",
          message:
            "Mutation apply target must be a normalized non-protected relative file path.",
          category: "permission",
        }),
      ],
    };
  }

  const root = await safeRealpath(input.primary.primaryWorkspaceRoot);
  if (root === null) {
    return {
      ok: false,
      targetPath: null,
      currentDigest: null,
      issues: storageIssue({
        code: "task_execution_mutation_apply_primary_workspace_missing",
        message: "TEST primary workspace root must exist before apply.",
        category: "not_found",
      }),
    };
  }

  const targetPath = join(root, normalized);
  const parent = dirname(targetPath);
  const parentReal = await safeRealpath(parent);
  if (parentReal === null || !isInsideOrEqual(root, parentReal)) {
    return {
      ok: false,
      targetPath,
      currentDigest: null,
      issues: storageIssue({
        code: "task_execution_mutation_apply_parent_escape",
        message:
          "Mutation apply rejects missing parents, parent symlinks, and parent canonicalization escapes.",
        category: "permission",
      }),
    };
  }

  const targetReal = await safeRealpath(targetPath);
  if (targetReal !== null && !isInsideOrEqual(root, targetReal)) {
    return {
      ok: false,
      targetPath,
      currentDigest: null,
      issues: storageIssue({
        code: "task_execution_mutation_apply_target_escape",
        message:
          "Mutation apply target canonicalization must remain inside the TEST primary workspace.",
        category: "permission",
      }),
    };
  }

  const current = await currentFileDigest(targetPath);
  if (current.kind === "unsafe") {
    return {
      ok: false,
      targetPath,
      currentDigest: null,
      issues: storageIssue({
        code: "task_execution_mutation_apply_target_unsafe",
        message:
          "Mutation apply target must be missing for create or an existing regular file for update.",
        category: "permission",
      }),
    };
  }

  if (input.file.operation === "updated") {
    if (current.kind !== "file") {
      return {
        ok: false,
        targetPath,
        currentDigest: current.digest,
        issues: storageIssue({
          code: "task_execution_mutation_apply_update_target_missing",
          message:
            "Existing-file update apply requires a current regular primary target.",
          category: "not_found",
        }),
      };
    }

    if (current.digest !== input.file.beforeDigest) {
      return {
        ok: false,
        targetPath,
        currentDigest: current.digest,
        issues: storageIssue({
          code: "task_execution_mutation_apply_stale_baseline",
          message:
            "Primary target digest no longer matches the isolated mutation beforeDigest; apply is a stale baseline conflict.",
          category: "conflict",
        }),
      };
    }
  }

  if (input.file.operation === "created" && current.kind !== "missing") {
    return {
      ok: false,
      targetPath,
      currentDigest: current.digest,
      issues: storageIssue({
        code: "task_execution_mutation_apply_create_target_exists",
        message: "Create-file apply requires the primary target to remain absent.",
        category: "conflict",
      }),
    };
  }

  return {
    ok: true,
    root,
    targetPath,
    currentDigest: current.digest,
  };
}

function validateArtifactBinding(input: {
  readonly evidence: TaskExecutionMutationEvidenceRecord;
  readonly artifact: TaskExecutionMutationArtifactRecord;
}): readonly TaskExecutionWorkerIssue[] {
  const issues: TaskExecutionWorkerIssue[] = [];

  if (input.evidence.artifactRef !== input.artifact.artifactRef) {
    issues.push(
      issue({
        code: "task_execution_mutation_apply_artifact_evidence_mismatch",
        message:
          "Mutation apply requires exact evidence to artifact digest and reference binding.",
        category: "conflict",
      }),
    );
  }

  if (
    input.evidence.totalChangedFiles !== 1 ||
    input.artifact.files.length !== 1
  ) {
    issues.push(
      issue({
        code: "task_execution_mutation_apply_single_file_required",
        message:
          "Mutation apply supports exactly one durable mutation artifact file.",
        category: "permission",
      }),
    );
  }

  const changed = input.evidence.changedFiles[0];
  const file = input.artifact.files[0];
  if (changed === undefined || file === undefined) {
    return issues;
  }

  if (
    changed.relativePath !== file.relativePath ||
    changed.operation !== file.operation ||
    changed.beforeDigest !== file.beforeDigest ||
    changed.afterDigest !== file.afterDigest ||
    changed.beforeBytes !== file.beforeBytes ||
    changed.afterBytes !== file.afterBytes ||
    file.afterDigest !== digestContent(file.afterContent) ||
    file.afterBytes !== Buffer.byteLength(file.afterContent, "utf8") ||
    input.artifact.totalBytes !== file.afterBytes ||
    input.artifact.totalBytes > input.artifact.maxTotalBytes ||
    input.artifact.totalBytes > TASK_EXECUTION_MUTATION_APPLY_MAX_FILE_BYTES
  ) {
    issues.push(
      issue({
        code: "task_execution_mutation_apply_artifact_file_mismatch",
        message:
          "Mutation apply requires artifact file path, operation, bytes, and digests to match durable evidence exactly.",
        category: "validation",
      }),
    );
  }

  if (file.operation !== "updated" && file.operation !== "created") {
    issues.push(
      issue({
        code: "task_execution_mutation_apply_operation_rejected",
        message:
          "Mutation apply supports only update of an existing regular file or create of one regular file.",
        category: "permission",
      }),
    );
  }

  return issues;
}

async function persistOutcome(input: {
  readonly projectRoot: string;
  readonly authority: TaskExecutionMutationApplyAuthority;
  readonly lifecycle: "applied" | "blocked" | "outcome_unknown";
  readonly resultDigest: string | null;
  readonly issues: readonly TaskExecutionWorkerIssue[];
  readonly occurredAt: string;
}): Promise<readonly TaskExecutionWorkerIssue[]> {
  const storage = await ensureApplyStorage({
    projectRoot: input.projectRoot,
    taskId: input.authority.taskId,
    applyId: input.authority.applyId,
    create: true,
  });
  if (!storage.ok) {
    return storage.issues;
  }

  const existing = await lstat(storage.outcomePath).catch(() => null);
  if (existing !== null) {
    return [];
  }

  return writeImmutableJson({
    path: storage.outcomePath,
    root: storage.root,
    value: makeOutcomeRecord({
      authority: input.authority,
      lifecycle: input.lifecycle,
      resultDigest: input.resultDigest,
      issueCodes: input.issues.map((item) => item.code),
      occurredAt: input.occurredAt,
    }),
  });
}

async function evaluateInternal(
  input: TaskExecutionMutationApplyInput,
): Promise<TaskExecutionMutationApplyDecision> {
  const issues: TaskExecutionWorkerIssue[] = [];

  if (input.taskModelWorkerOrOperatorPathClaims !== undefined) {
    issues.push(
      issue({
        code: "task_execution_mutation_apply_path_claim_rejected",
        message:
          "Task, model, worker, and operator path claims cannot select a primary apply root or target.",
        category: "permission",
      }),
    );
  }

  issues.push(
    ...(await validatePrimaryWorkspaceAuthority(input.primaryWorkspaceAuthority)),
  );

  const verification = await verifyTaskExecutionMutationEvidenceForAuthority({
    projectRoot: input.projectRoot,
    authority: input.mutationAuthority,
  });
  issues.push(...verification.issues);

  const evidence = verification.evidence.record;
  const artifact = verification.artifact?.record ?? null;
  if (!verification.ok || evidence === null || artifact === null) {
    return baseDecision({
      ok: false,
      status: "blocked",
      authority: null,
      evidence,
      artifact,
      file: null,
      currentPrimaryDigest: null,
      targetPath: null,
      applyRecord: null,
      issues,
    });
  }

  issues.push(...validateArtifactBinding({ evidence, artifact }));
  const file = artifact.files[0] ?? null;
  if (file === null || issues.some((item) => item.severity === "error")) {
    return baseDecision({
      ok: false,
      status: "blocked",
      authority: null,
      evidence,
      artifact,
      file,
      currentPrimaryDigest: null,
      targetPath: null,
      applyRecord: null,
      issues,
    });
  }

  const authority = buildApplyAuthority({
    evidence,
    artifact,
    file,
    primary: input.primaryWorkspaceAuthority,
  });
  const target = await validateTargetPath({
    primary: input.primaryWorkspaceAuthority,
    file,
  });
  if (!target.ok) {
    issues.push(...target.issues);
  }

  const loaded = await loadTaskExecutionMutationApplyRecord({
    projectRoot: input.projectRoot,
    taskId: authority.taskId,
    applyId: authority.applyId,
  });
  const applyRecord =
    loaded.ok && loaded.record !== null ? loaded.record : null;
  if (!loaded.ok && loaded.issues[0]?.code !== "task_execution_mutation_apply_storage_path_unsafe") {
    const missingRoot = await safeRealpath(
      join(
        await realpath(input.projectRoot).catch(() => input.projectRoot),
        ".aeos",
        "state",
        "mutation-applies",
        authority.taskId,
        authority.applyId,
      ),
    );
    if (missingRoot !== null) {
      issues.push(...loaded.issues);
    }
  }

  if (applyRecord?.intent !== null && applyRecord !== null) {
    if (digestJson(applyRecord.intent.authority) !== digestJson(authority)) {
      issues.push(
        issue({
          code: "task_execution_mutation_apply_replay_authority_mismatch",
          message:
            "Existing one-shot apply reservation does not match the currently verified authority.",
          category: "conflict",
        }),
      );
    }
  }

  if (applyRecord?.lifecycle === "applied") {
    return baseDecision({
      ok: true,
      status: "applied",
      authority,
      evidence,
      artifact,
      file,
      currentPrimaryDigest: target.currentDigest,
      targetPath: target.targetPath,
      applyRecord,
      issues,
    });
  }

  if (
    applyRecord?.lifecycle === "applying" ||
    applyRecord?.lifecycle === "outcome_unknown"
  ) {
    return baseDecision({
      ok: false,
      status: applyRecord.lifecycle,
      authority,
      evidence,
      artifact,
      file,
      currentPrimaryDigest: target.currentDigest,
      targetPath: target.targetPath,
      applyRecord,
      issues,
    });
  }

  return baseDecision({
    ok: target.ok && issues.every((item) => item.severity !== "error"),
    status: target.ok && issues.every((item) => item.severity !== "error")
      ? "prepared"
      : "blocked",
    authority,
    evidence,
    artifact,
    file,
    currentPrimaryDigest: target.currentDigest,
    targetPath: target.targetPath,
    applyRecord,
    issues,
  });
}

function baseDecision(input: {
  readonly ok: boolean;
  readonly status: TaskExecutionMutationApplyLifecycle;
  readonly authority: TaskExecutionMutationApplyAuthority | null;
  readonly evidence: TaskExecutionMutationEvidenceRecord | null;
  readonly artifact: TaskExecutionMutationArtifactRecord | null;
  readonly file: TaskExecutionMutationArtifactFile | null;
  readonly currentPrimaryDigest: string | null;
  readonly targetPath: string | null;
  readonly applyRecord: TaskExecutionMutationApplyRecord | null;
  readonly issues: readonly TaskExecutionWorkerIssue[];
}): TaskExecutionMutationApplyDecision {
  return {
    ...input,
    PrimaryWorkspaceApplyEnabled: false,
    RealPrimaryWorkspaceApplyEnabled: false,
    AutomaticPatchApply: false,
    CompletionAuthorityGranted: false,
    VerifierSatisfied: false,
    CompletionGateSatisfied: false,
    ActualCodexModelCalls: 0,
    ActualClaudeModelCalls: 0,
    CloudCalls: 0,
  };
}

function baseResult(input: {
  readonly decision: TaskExecutionMutationApplyDecision;
  readonly applied: boolean;
  readonly reservationPersisted: boolean;
  readonly applyingPersisted: boolean;
  readonly afterDigestVerified: boolean;
  readonly auditFacts?: readonly TaskExecutionMutationApplyAuditFact[];
}): TaskExecutionMutationApplyResult {
  return {
    ...input.decision,
    applied: input.applied,
    reservationPersisted: input.reservationPersisted,
    applyingPersisted: input.applyingPersisted,
    afterDigestVerified: input.afterDigestVerified,
    auditFacts: input.auditFacts ?? [],
  };
}

export async function createTaskExecutionTestPrimaryWorkspace(
  input: CreateTaskExecutionTestPrimaryWorkspaceInput,
): Promise<TaskExecutionTestPrimaryWorkspaceCreationResult> {
  const issues: TaskExecutionWorkerIssue[] = [];

  if (!isSafeRef(input.projectRef) || !isSafeRef(input.workspaceRef)) {
    issues.push(
      issue({
        code: "task_execution_test_primary_workspace_identity_invalid",
        message:
          "TEST primary workspace requires safe system-owned project and workspace refs.",
        category: "validation",
      }),
    );
  }

  for (const file of input.initialFiles ?? []) {
    const normalized = normalizeRelativePath(file.relativePath);
    if (
      normalized === null ||
      normalized !== file.relativePath ||
      pathMatchesProtected(normalized)
    ) {
      issues.push(
        issue({
          code: "task_execution_test_primary_workspace_path_invalid",
          message:
            "TEST primary workspace fixture files must be normalized non-protected relative paths.",
          category: "permission",
        }),
      );
    }
  }

  if (issues.some((item) => item.severity === "error")) {
    return {
      ok: false,
      authority: null,
      issues,
      RealPrimaryWorkspaceApplyEnabled: false,
      AutomaticPatchApply: false,
      ActualCodexModelCalls: 0,
      ActualClaudeModelCalls: 0,
      CloudCalls: 0,
    };
  }

  const root = await mkdtemp(join(tmpdir(), "aeos-test-primary-apply-"));
  for (const file of input.initialFiles ?? []) {
    const target = join(root, file.relativePath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content, "utf8");
  }

  return {
    ok: true,
    authority: {
      authority: "system",
      workspaceKind: "deterministic_test_primary",
      systemCreated: true,
      workspaceRef: input.workspaceRef,
      projectRef: input.projectRef,
      primaryWorkspaceRoot: await realpath(root),
      realPrimaryApplyEnabled: false,
      automaticPatchApplyEnabled: false,
    },
    issues,
    RealPrimaryWorkspaceApplyEnabled: false,
    AutomaticPatchApply: false,
    ActualCodexModelCalls: 0,
    ActualClaudeModelCalls: 0,
    CloudCalls: 0,
  };
}

export async function evaluateTaskExecutionMutationApply(
  input: TaskExecutionMutationApplyInput,
): Promise<TaskExecutionMutationApplyDecision> {
  return evaluateInternal(input);
}

export async function prepareTaskExecutionMutationApply(
  input: TaskExecutionMutationApplyInput,
): Promise<TaskExecutionMutationApplyResult> {
  const decision = await evaluateInternal(input);
  if (decision.authority === null || decision.status !== "prepared") {
    return baseResult({
      decision,
      applied: false,
      reservationPersisted: false,
      applyingPersisted: false,
      afterDigestVerified: false,
      auditFacts:
        decision.authority === null
          ? []
          : [
              applyAuditFact({
                authority: decision.authority,
                factKind: "mutation_apply_conflict",
                resultReference: decision.status,
              }),
            ],
    });
  }

  const storage = await ensureApplyStorage({
    projectRoot: input.projectRoot,
    taskId: decision.authority.taskId,
    applyId: decision.authority.applyId,
    create: true,
  });
  if (!storage.ok) {
    return baseResult({
      decision: {
        ...decision,
        ok: false,
        status: "blocked",
        issues: [...decision.issues, ...storage.issues],
      },
      applied: false,
      reservationPersisted: false,
      applyingPersisted: false,
      afterDigestVerified: false,
    });
  }

  const intentIssues = await writeImmutableJson({
    path: storage.intentPath,
    root: storage.root,
    value: makeIntentRecord({
      authority: decision.authority,
      occurredAt: input.occurredAt ?? new Date().toISOString(),
    }),
  });

  if (intentIssues.some((item) => item.severity === "error")) {
    const loaded = await loadTaskExecutionMutationApplyRecord({
      projectRoot: input.projectRoot,
      taskId: decision.authority.taskId,
      applyId: decision.authority.applyId,
    });
    return baseResult({
      decision: {
        ...decision,
        ok: loaded.ok,
        applyRecord: loaded.record,
        issues: [...decision.issues, ...intentIssues, ...loaded.issues],
      },
      applied: false,
      reservationPersisted: loaded.ok,
      applyingPersisted: false,
      afterDigestVerified: false,
    });
  }

  const loaded = await loadTaskExecutionMutationApplyRecord({
    projectRoot: input.projectRoot,
    taskId: decision.authority.taskId,
    applyId: decision.authority.applyId,
  });

  return baseResult({
    decision: {
      ...decision,
      applyRecord: loaded.record,
      issues: [...decision.issues, ...loaded.issues],
    },
    applied: false,
    reservationPersisted: loaded.ok,
    applyingPersisted: false,
    afterDigestVerified: false,
    auditFacts: [
      applyAuditFact({
        authority: decision.authority,
        factKind: "mutation_apply_intent",
        resultReference: decision.authority.applyStorageRef,
      }),
    ],
  });
}

async function atomicApplyFile(input: {
  readonly targetPath: string;
  readonly file: TaskExecutionMutationArtifactFile;
}): Promise<void> {
  const targetParent = dirname(input.targetPath);
  const tempPath = join(
    targetParent,
    `.aeos-apply-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`,
  );
  const handle = await open(tempPath, "wx");
  try {
    await handle.writeFile(input.file.afterContent, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }

  await rename(tempPath, input.targetPath);
  await fsyncDirectory(targetParent);
}

async function executePrepared(
  input: TaskExecutionMutationApplyInput,
  fault?: TestFaultInjection,
): Promise<TaskExecutionMutationApplyResult> {
  if (fault === "before_reservation") {
    const decision = await evaluateInternal(input);
    return baseResult({
      decision: {
        ...decision,
        ok: false,
        status: "blocked",
        issues: [
          ...decision.issues,
          issue({
            code: "task_execution_mutation_apply_test_fault_before_reservation",
            message:
              "Deterministic TEST fault stopped before durable reservation.",
            category: "unknown",
          }),
        ],
      },
      applied: false,
      reservationPersisted: false,
      applyingPersisted: false,
      afterDigestVerified: false,
    });
  }

  const prepared = await prepareTaskExecutionMutationApply(input);
  const authority = prepared.authority;
  if (
    authority === null ||
    prepared.file === null ||
    prepared.targetPath === null ||
    prepared.status !== "prepared"
  ) {
    return prepared;
  }

  if (fault === "after_reservation") {
    return baseResult({
      decision: {
        ...prepared,
        ok: false,
        status: "outcome_unknown",
        issues: [
          ...prepared.issues,
          issue({
            code: "task_execution_mutation_apply_test_fault_after_reservation",
            message:
              "Deterministic TEST fault stopped after reservation and before applying.",
            category: "unknown",
          }),
        ],
      },
      applied: false,
      reservationPersisted: true,
      applyingPersisted: false,
      afterDigestVerified: false,
      auditFacts: prepared.auditFacts,
    });
  }

  const storage = await ensureApplyStorage({
    projectRoot: input.projectRoot,
    taskId: authority.taskId,
    applyId: authority.applyId,
    create: true,
  });
  if (!storage.ok) {
    return baseResult({
      decision: {
        ...prepared,
        ok: false,
        status: "blocked",
        issues: [...prepared.issues, ...storage.issues],
      },
      applied: false,
      reservationPersisted: true,
      applyingPersisted: false,
      afterDigestVerified: false,
      auditFacts: prepared.auditFacts,
    });
  }

  const applyingIssues = await writeImmutableJson({
    path: storage.applyingPath,
    root: storage.root,
    value: makeApplyingRecord({
      authority,
      occurredAt: input.occurredAt ?? new Date().toISOString(),
    }),
  });
  if (applyingIssues.some((item) => item.severity === "error")) {
    return baseResult({
      decision: {
        ...prepared,
        ok: false,
        status: "outcome_unknown",
        issues: [...prepared.issues, ...applyingIssues],
      },
      applied: false,
      reservationPersisted: true,
      applyingPersisted: false,
      afterDigestVerified: false,
      auditFacts: prepared.auditFacts,
    });
  }

  if (fault === "before_rename") {
    return baseResult({
      decision: {
        ...prepared,
        ok: false,
        status: "outcome_unknown",
        issues: [
          ...prepared.issues,
          issue({
            code: "task_execution_mutation_apply_test_fault_before_rename",
            message:
              "Deterministic TEST fault stopped after applying record and before atomic rename.",
            category: "unknown",
          }),
        ],
      },
      applied: false,
      reservationPersisted: true,
      applyingPersisted: true,
      afterDigestVerified: false,
      auditFacts: prepared.auditFacts,
    });
  }

  await atomicApplyFile({
    targetPath: prepared.targetPath,
    file: prepared.file,
  });

  if (fault === "after_rename_before_outcome") {
    return baseResult({
      decision: {
        ...prepared,
        ok: false,
        status: "outcome_unknown",
        issues: [
          ...prepared.issues,
          issue({
            code:
              "task_execution_mutation_apply_test_fault_after_rename_before_outcome",
            message:
              "Deterministic TEST fault stopped after atomic rename and before outcome persistence.",
            category: "unknown",
          }),
        ],
      },
      applied: false,
      reservationPersisted: true,
      applyingPersisted: true,
      afterDigestVerified: false,
      auditFacts: prepared.auditFacts,
    });
  }

  const after = await currentFileDigest(prepared.targetPath);
  const afterDigestVerified =
    after.kind === "file" && after.digest === authority.afterDigest;
  const outcomeIssues = afterDigestVerified
    ? prepared.issues
    : [
        ...prepared.issues,
        issue({
          code: "task_execution_mutation_apply_after_digest_mismatch",
          message:
            "Primary target afterDigest did not match the durable mutation artifact after atomic apply.",
          category: "conflict",
        }),
      ];

  if (fault === "outcome_persistence_failed") {
    return baseResult({
      decision: {
        ...prepared,
        ok: false,
        status: "outcome_unknown",
        currentPrimaryDigest: after.digest,
        issues: [
          ...outcomeIssues,
          issue({
            code:
              "task_execution_mutation_apply_test_fault_outcome_persistence_failed",
            message:
              "Deterministic TEST fault stopped outcome persistence after afterDigest verification.",
            category: "unknown",
          }),
        ],
      },
      applied: false,
      reservationPersisted: true,
      applyingPersisted: true,
      afterDigestVerified,
      auditFacts: prepared.auditFacts,
    });
  }

  const lifecycle = afterDigestVerified ? "applied" : "outcome_unknown";
  const persistedOutcomeIssues = await persistOutcome({
    projectRoot: input.projectRoot,
    authority,
    lifecycle,
    resultDigest: after.digest,
    issues: outcomeIssues,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
  });
  const loaded = await loadTaskExecutionMutationApplyRecord({
    projectRoot: input.projectRoot,
    taskId: authority.taskId,
    applyId: authority.applyId,
  });

  return baseResult({
    decision: {
      ...prepared,
      ok:
        lifecycle === "applied" &&
        persistedOutcomeIssues.every((item) => item.severity !== "error"),
      status: lifecycle,
      currentPrimaryDigest: after.digest,
      applyRecord: loaded.record,
      issues: [...outcomeIssues, ...persistedOutcomeIssues, ...loaded.issues],
    },
    applied: lifecycle === "applied",
    reservationPersisted: true,
    applyingPersisted: true,
    afterDigestVerified,
    auditFacts: [
      ...prepared.auditFacts,
      applyAuditFact({
        authority,
        factKind:
          lifecycle === "applied"
            ? "mutation_apply_outcome"
            : "mutation_apply_conflict",
        resultReference: lifecycle,
      }),
    ],
  });
}

export async function executeTaskExecutionTestMutationApply(
  input: TaskExecutionMutationApplyInput,
): Promise<TaskExecutionMutationApplyResult> {
  const decision = await evaluateInternal(input);
  const authority = decision.authority;
  if (
    authority !== null &&
    (decision.status === "applying" || decision.status === "outcome_unknown") &&
    decision.targetPath !== null
  ) {
    const current = await currentFileDigest(decision.targetPath);
    const recoveredAfter =
      current.kind === "file" && current.digest === authority.afterDigest;
    const beforeUnchanged =
      current.digest === authority.beforeDigest ||
      (current.kind === "missing" && authority.beforeDigest === null);
    const recoveryIssues = recoveredAfter
      ? decision.issues
      : [
          ...decision.issues,
          issue({
            code: beforeUnchanged
              ? "task_execution_mutation_apply_replay_retry_blocked"
              : "task_execution_mutation_apply_unexpected_target_digest",
            message:
              "Existing ambiguous apply lifecycle must not blindly rewrite; recovery is allowed only when target already equals afterDigest.",
            category: "conflict",
          }),
        ];
    const lifecycle = recoveredAfter ? "applied" : "outcome_unknown";
    const outcomeIssues = await persistOutcome({
      projectRoot: input.projectRoot,
      authority,
      lifecycle,
      resultDigest: current.digest,
      issues: recoveryIssues,
      occurredAt: input.occurredAt ?? new Date().toISOString(),
    });
    const loaded = await loadTaskExecutionMutationApplyRecord({
      projectRoot: input.projectRoot,
      taskId: authority.taskId,
      applyId: authority.applyId,
    });
    return baseResult({
      decision: {
        ...decision,
        ok: recoveredAfter,
        status: lifecycle,
        currentPrimaryDigest: current.digest,
        applyRecord: loaded.record,
        issues: [...recoveryIssues, ...outcomeIssues, ...loaded.issues],
      },
      applied: false,
      reservationPersisted: decision.applyRecord?.intent !== null,
      applyingPersisted: decision.applyRecord?.applying !== null,
      afterDigestVerified: recoveredAfter,
      auditFacts:
        authority === null
          ? []
          : [
              applyAuditFact({
                authority,
                factKind: recoveredAfter
                  ? "mutation_apply_outcome"
                  : "mutation_apply_conflict",
                resultReference: lifecycle,
              }),
            ],
    });
  }

  if (decision.status === "applied") {
    return baseResult({
      decision,
      applied: false,
      reservationPersisted: true,
      applyingPersisted: decision.applyRecord?.applying !== null,
      afterDigestVerified: decision.currentPrimaryDigest === authority?.afterDigest,
      auditFacts:
        authority === null
          ? []
          : [
              applyAuditFact({
                authority,
                factKind: "mutation_apply_outcome",
                resultReference: "applied_replay",
              }),
            ],
    });
  }

  return executePrepared(input);
}

export async function executeTaskExecutionTestMutationApplyFaultInjectionSmokeOnly(
  input: TaskExecutionMutationApplyInput,
  fault: TestFaultInjection,
): Promise<TaskExecutionMutationApplyResult> {
  return executePrepared(input, fault);
}

export async function cleanupTaskExecutionTestPrimaryWorkspace(
  authority: TaskExecutionTestPrimaryWorkspaceAuthority,
): Promise<{ readonly ok: boolean; readonly removed: boolean; readonly issues: readonly TaskExecutionWorkerIssue[] }> {
  const issues = await validatePrimaryWorkspaceAuthority(authority);
  if (issues.some((item) => item.severity === "error")) {
    return { ok: false, removed: false, issues };
  }

  await rm(authority.primaryWorkspaceRoot, { recursive: true, force: true });
  return { ok: true, removed: true, issues };
}
