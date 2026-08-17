import type {
  TaskExecutionInvocationRecord,
} from "./task-execution-invocation-record.js";
import {
  validateTaskExecutionInvocationRecord,
} from "./task-execution-invocation-record.js";
import type { TaskExecutionAuditEvent } from "./task-execution-audit.js";
import type {
  TaskExecutionPermissionGateResult,
  TaskExecutionPermissionKind,
} from "./task-execution-permission-gate.js";
import type {
  TaskExecutionWorkerAdapter,
  TaskExecutionWorkerCapabilities,
  TaskExecutionWorkerConformanceInput,
  TaskExecutionWorkerConformanceResult,
  TaskExecutionWorkerIdentity,
  TaskExecutionWorkerIssue,
  TaskExecutionWorkerRawResult,
  TaskExecutionWorkerRequest,
  TaskExecutionWorkerResult,
  TaskExecutionWorkerWorkspaceReference,
} from "./task-execution-worker.js";
import {
  coreWorkerBindingsMatch,
  evaluateTaskExecutionWorkerConformance,
  normalizeTaskExecutionWorkerResult,
  TASK_EXECUTION_WORKER_RUNTIME_EXECUTION_ENABLED,
} from "./task-execution-worker.js";
import type {
  TaskExecutionLocalWorkerProcessAuthority,
  TaskExecutionLocalWorkerProcessReadiness,
  TaskExecutionLocalWorkerRuntimeEnvironmentInheritance,
} from "./task-execution-local-worker-process.js";
import {
  evaluateTaskExecutionLocalWorkerProcessGate,
} from "./task-execution-local-worker-process.js";
import type { AeosError, JsonObject, JsonValue } from "./types.js";

// @ts-expect-error Node built-ins are available at runtime; this package does not depend on Node ambient types yet.
import { spawn } from "node:child_process";
// @ts-expect-error Node built-ins are available at runtime; this package does not depend on Node ambient types yet.
import { readFile, realpath, stat } from "node:fs/promises";
// @ts-expect-error Node built-ins are available at runtime; this package does not depend on Node ambient types yet.
import { relative } from "node:path";
// @ts-expect-error Node built-ins are available at runtime; this package does not depend on Node ambient types yet.
import process from "node:process";

export const TASK_EXECUTION_CODEX_WORKER_REAL_EXECUTION_ENABLED = false;
export const TASK_EXECUTION_CODEX_WORKER_EXTERNAL_PROCESS_ALLOWED = false;
export const TASK_EXECUTION_CODEX_PROCESS_CONTRACT_READY = true;
export const TASK_EXECUTION_CODEX_PROCESS_BOUNDARY =
  "AUTHORIZED_LOCAL_CODEX_PROCESS";

export type TaskExecutionCodexReasoningEffort =
  | "minimal"
  | "low"
  | "medium"
  | "high";

export type TaskExecutionCodexSandboxMode = "read-only" | "workspace-write";

export type TaskExecutionCodexApprovalPolicy = "never" | "on-request";
type TaskExecutionCodexEnvironmentInheritance = Extract<
  TaskExecutionLocalWorkerRuntimeEnvironmentInheritance,
  "none" | "system_codex_read_only_planner_canary"
>;

export type TaskExecutionCodexProcessTerminationReason =
  | "exited"
  | "nonzero_exit"
  | "timeout"
  | "interrupted"
  | "signal"
  | "spawn_failure"
  | "output_limit_exceeded"
  | "unknown";

export type TaskExecutionCodexWorkerIdentity = TaskExecutionWorkerIdentity & {
  readonly workerFamily: "codex";
  readonly runtimeKind: "test_worker";
};

export interface TaskExecutionCodexExecutableAuthority {
  readonly authority: "system";
  readonly executableRef: string;
  readonly executableKind: "codex_exec";
}

export interface TaskExecutionCodexModelConfiguration {
  readonly authority: "system";
  readonly model: string;
  readonly reasoningEffort: TaskExecutionCodexReasoningEffort;
}

export interface TaskExecutionCodexProcessPermission {
  readonly authority: "system";
  readonly permissionId: string;
  readonly requiredPermission: Extract<TaskExecutionPermissionKind, "process">;
  readonly processExecutionAllowed: boolean;
}

export interface TaskExecutionCodexWorkspaceAuthority
  extends TaskExecutionWorkerWorkspaceReference {
  readonly workingDirectoryRef: string;
}

export interface TaskExecutionCodexWorkerConfiguration {
  readonly authority: "system";
  readonly identity: TaskExecutionCodexWorkerIdentity;
  readonly executable: TaskExecutionCodexExecutableAuthority;
  readonly model: TaskExecutionCodexModelConfiguration;
  readonly workspace: TaskExecutionCodexWorkspaceAuthority;
  readonly processPermission: TaskExecutionCodexProcessPermission;
  readonly futureProcessCapability: boolean;
  readonly sandboxMode: TaskExecutionCodexSandboxMode;
  readonly approvalPolicy: TaskExecutionCodexApprovalPolicy;
  readonly timeoutMs: number;
  readonly stdoutLimitBytes: number;
  readonly stderrLimitBytes: number;
  readonly structuredResultContractRef?: string;
  readonly structuredResultSchemaPath?: string;
  readonly environmentInheritance?: Extract<
    TaskExecutionCodexEnvironmentInheritance,
    "none" | "system_codex_read_only_planner_canary"
  >;
}

export interface TaskExecutionCodexProcessRequest {
  readonly executable: TaskExecutionCodexExecutableAuthority;
  readonly argv: readonly string[];
  readonly workingDirectory: TaskExecutionCodexWorkspaceAuthority;
  readonly stdin: string;
  readonly timeoutMs: number;
  readonly stdoutLimitBytes: number;
  readonly stderrLimitBytes: number;
  readonly environment: {
    readonly authority: "system";
    readonly inheritance?: TaskExecutionCodexEnvironmentInheritance;
    readonly variables: readonly [];
  };
}

export interface TaskExecutionCodexPreparedInvocation {
  readonly taskId: string;
  readonly sourceTaskRevision: number;
  readonly attemptId: string;
  readonly attemptNumber: number;
  readonly invocationId: string;
  readonly idempotencyKey: string;
  readonly workItemId: string | null;
  readonly batchId: string | null;
  readonly workerIdentity: TaskExecutionCodexWorkerIdentity;
  readonly processRequest: TaskExecutionCodexProcessRequest;
  readonly exactWorkerSelected: boolean;
  readonly invocationAuthorityBound: boolean;
  readonly workspaceAuthorityBound: boolean;
  readonly futureProcessCapabilityDeclared: boolean;
  readonly processPermissionAllowed: boolean;
  readonly permissionFactsAllowed: boolean;
  readonly runnable: boolean;
  readonly realExecutionEnabled: false;
}

export interface TaskExecutionCodexProcessResult {
  readonly invocationRef: string;
  readonly terminationReason: TaskExecutionCodexProcessTerminationReason;
  readonly exitCode: number | null;
  readonly signal?: string;
  readonly stdinMode?: "pipe";
  readonly stdinBytes?: number;
  readonly stdinWriteCompleted?: boolean;
  readonly stdinClosed?: boolean;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
  readonly interrupted: boolean;
  readonly observedAt?: string;
}

export interface TaskExecutionCodexExecContractPreflightCommand {
  readonly executablePath: string;
  readonly argv: readonly ["exec", "--help"];
  readonly timeoutMs: number;
}

export interface TaskExecutionCodexExecContractPreflightEvidence {
  readonly exitCode: number | null;
  readonly signal?: string;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
  readonly spawned: boolean;
}

export interface TaskExecutionCodexExecContractPreflightResult {
  readonly ok: boolean;
  readonly command: TaskExecutionCodexExecContractPreflightCommand;
  readonly issues: readonly TaskExecutionWorkerIssue[];
  readonly checks: {
    readonly executableExists: boolean;
    readonly execSurfaceSupported: boolean;
    readonly expectedFlagsSupported: boolean;
    readonly schemaPathValid: boolean;
    readonly schemaJsonValid: boolean;
    readonly cwdGitRepository: boolean;
    readonly environmentPolicyValid: boolean;
  };
  readonly safety: {
    readonly modelInvoked: false;
    readonly shellUsed: false;
    readonly fullParentEnvironmentInherited: false;
    readonly rawHelpOutputPersisted: false;
    readonly credentialFilesRead: false;
    readonly secretsPersisted: false;
  };
}

export interface RunTaskExecutionCodexExecContractPreflightInput {
  readonly executablePath: string;
  readonly projectRoot: string;
  readonly configuration: TaskExecutionCodexWorkerConfiguration;
  readonly timeoutMs?: number;
  readonly runHelp?: (
    command: TaskExecutionCodexExecContractPreflightCommand,
  ) => Promise<TaskExecutionCodexExecContractPreflightEvidence>;
  readonly runGitCheck?: (projectRoot: string) => Promise<boolean>;
}

export interface TaskExecutionCodexWorkerAdapter
  extends TaskExecutionWorkerAdapter {
  readonly codexAdapterKind: "task_execution_codex_worker_adapter";
  readonly identity: TaskExecutionCodexWorkerIdentity;
  readonly capabilities: TaskExecutionWorkerCapabilities;
  readonly configuration: TaskExecutionCodexWorkerConfiguration;
  readonly processCallCount: () => number;
  readonly actualChildProcessCount: () => 0;
  readonly actualCodexCallCount: () => 0;
  readonly actualClaudeCodeCallCount: () => 0;
  readonly cloudCallCount: () => 0;
}

export interface TaskExecutionCodexWorkerConformanceInput
  extends Omit<TaskExecutionWorkerConformanceInput, "worker"> {
  readonly worker: unknown;
  readonly configuration: TaskExecutionCodexWorkerConfiguration;
  readonly taskOrModelProcessClaims?: unknown;
}

export interface TaskExecutionCodexWorkerConformanceResult {
  readonly ok: boolean;
  readonly codexWorkerConformant: boolean;
  readonly preparedInvocation: TaskExecutionCodexPreparedInvocation;
  readonly workerConformance: TaskExecutionWorkerConformanceResult | null;
  readonly normalizedResult: TaskExecutionWorkerResult | null;
  readonly issues: readonly TaskExecutionWorkerIssue[];
  readonly processCallCount: number;
  readonly actualChildProcessCount: 0;
  readonly actualCodexCallCount: 0;
  readonly actualClaudeCodeCallCount: 0;
  readonly cloudCallCount: 0;
  readonly realExecutionEnabled: false;
}

export type TaskExecutionWorkerProcessDecision =
  | "authorized"
  | "blocked";

export interface TaskExecutionWorkerProcessReadiness {
  readonly taskAuthorityReady: boolean;
  readonly attemptAuthorityReady: boolean;
  readonly invocationAuthorityReady: boolean;
  readonly workerAuthorityReady: boolean;
  readonly executableAuthorityReady: boolean;
  readonly workspaceAuthorityReady: boolean;
  readonly argvReady: boolean;
  readonly environmentReady: boolean;
  readonly outputLimitsReady: boolean;
  readonly timeoutReady: boolean;
  readonly permissionReady: boolean;
  readonly auditReady: boolean;
  readonly duplicateExecutionSafetyReady: boolean;
  readonly processContractReady: boolean;
  readonly realCodexExecutionEnabled: false;
  readonly externalProcessAllowed: false;
  readonly actualCodexCalls: 0;
  readonly actualClaudeCalls: 0;
  readonly actualWorkerProcessesSpawned: 0;
  readonly cloudCalls: 0;
}

export interface TaskExecutionWorkerProcessAuthority {
  readonly boundary: typeof TASK_EXECUTION_CODEX_PROCESS_BOUNDARY;
  readonly taskId: string;
  readonly taskRevision: number;
  readonly attemptId: string;
  readonly attemptNumber: number;
  readonly invocationId: string;
  readonly invocationRevision: number;
  readonly invocationLifecycle: "invoking";
  readonly idempotencyKey: string;
  readonly workItemId: string | null;
  readonly batchId: string | null;
  readonly workerId: string;
  readonly workerFamily: "codex";
  readonly workspaceRef: string;
  readonly projectRef: string;
  readonly executableRef: string;
  readonly executableKind: "codex_exec";
  readonly argv: readonly string[];
  readonly requiredPermissions: readonly Extract<TaskExecutionPermissionKind, "process">[];
  readonly permissionGateId: string;
  readonly preProcessAuditEventId: string;
  readonly preProcessAuditSequence: number;
  readonly stdoutLimitBytes: number;
  readonly stderrLimitBytes: number;
  readonly timeoutMs: number;
  readonly environment: {
    readonly authority: "system";
    readonly inheritance: TaskExecutionCodexEnvironmentInheritance;
    readonly approvedVariableRefs: readonly string[];
  };
  readonly realCodexExecutionEnabled: false;
  readonly externalProcessAllowed: false;
}

export interface TaskExecutionWorkerProcessGateInput {
  readonly configuration: TaskExecutionCodexWorkerConfiguration;
  readonly request: TaskExecutionWorkerRequest;
  readonly invocationRecord: unknown;
  readonly preparedInvocation: TaskExecutionCodexPreparedInvocation;
  readonly permissionGateResult?: TaskExecutionPermissionGateResult;
  readonly preProcessAuditEvent?: TaskExecutionAuditEvent;
  readonly expectedInvocationRevision?: number;
  readonly taskOrModelProcessClaims?: unknown;
  readonly taskOrModelEnvironmentClaims?: unknown;
}

export interface TaskExecutionWorkerProcessGateResult {
  readonly ok: boolean;
  readonly decision: TaskExecutionWorkerProcessDecision;
  readonly readiness: TaskExecutionWorkerProcessReadiness;
  readonly authority: TaskExecutionWorkerProcessAuthority | null;
  readonly issues: readonly TaskExecutionWorkerIssue[];
  readonly CodexProcessContractReady: boolean;
  readonly RealCodexExecutionEnabled: false;
  readonly ExternalProcessAllowed: false;
  readonly ActualCodexCalls: 0;
  readonly ActualClaudeCalls: 0;
  readonly ActualWorkerProcessesSpawned: 0;
  readonly CloudCalls: 0;
}

const safeReferencePattern = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,255}$/;
const safeModelPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const dangerousCodexArgs = new Set([
  "--dangerously-bypass-approvals-and-sandbox",
  "danger-full-access",
  "--danger-full-access",
]);
const forbiddenArgPrefixes = [
  "--config",
  "-c",
  "--mcp",
  "--mcp-config",
  "--provider",
  "--api-key",
  "--credential",
  "--env",
];
const codexAuthorityOutputKeys = new Set(["policyauthorized"]);
const supportedReasoningEfforts = new Set([
  "minimal",
  "low",
  "medium",
  "high",
]);
const codexReasoningEffortConfigPattern =
  /^model_reasoning_effort="(?:minimal|low|medium|high)"$/;

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

const codexPlannerEnvironmentRefs = [
  "HOME",
  "USER",
  "LOGNAME",
  "TMPDIR",
  "PATH",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
] as const;

function safeEnvValue(value: string | undefined): string | undefined {
  if (value === undefined || value.length === 0 || value.length > 4096) {
    return undefined;
  }

  if (value.includes("\0")) {
    return undefined;
  }

  return value;
}

function boundedCodexHostEnvironment(): Record<string, string> {
  const source = (process as { env?: Record<string, string | undefined> }).env ??
    {};
  const env: Record<string, string> = {};
  const refs = [
    ...codexPlannerEnvironmentRefs,
    ...(source.CODEX_HOME === undefined ? [] : ["CODEX_HOME"]),
  ];

  for (const name of refs) {
    const value = safeEnvValue(source[name]);

    if (value !== undefined) {
      env[name] = value;
    }
  }

  return env;
}

async function runCodexExecHelpCommand(
  command: TaskExecutionCodexExecContractPreflightCommand,
): Promise<TaskExecutionCodexExecContractPreflightEvidence> {
  return await new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    const child = spawn(command.executablePath, command.argv, {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      env: boundedCodexHostEnvironment(),
    });
    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill("SIGTERM");
      resolve({
        exitCode: null,
        signal: "SIGTERM",
        stdout,
        stderr,
        timedOut: true,
        spawned: true,
      });
    }, command.timeoutMs);

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      stdout += chunk.slice(0, 8192);
    });
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk.slice(0, 8192);
    });
    child.on("error", () => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve({
        exitCode: null,
        stdout,
        stderr,
        timedOut: false,
        spawned: false,
      });
    });
    child.on("close", (exitCode: number | null, signal: string | null) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve({
        exitCode,
        ...(signal === null ? {} : { signal }),
        stdout,
        stderr,
        timedOut: false,
        spawned: true,
      });
    });
  });
}

async function runGitRepositoryCheck(projectRoot: string): Promise<boolean> {
  return await new Promise((resolve) => {
    let stdout = "";
    let settled = false;
    const child = spawn("git", ["-C", projectRoot, "rev-parse", "--is-inside-work-tree"], {
      shell: false,
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
      env: boundedCodexHostEnvironment(),
    });
    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill("SIGTERM");
      resolve(false);
    }, 5000);

    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      stdout += chunk.slice(0, 128);
    });
    child.on("error", () => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(false);
    });
    child.on("close", (exitCode: number | null) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(exitCode === 0 && stdout.trim() === "true");
    });
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown, depth = 0): value is JsonValue {
  if (depth > 8) {
    return false;
  }

  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.every((item) => isJsonValue(item, depth + 1));
  }

  if (isRecord(value)) {
    return Object.values(value).every((item) => isJsonValue(item, depth + 1));
  }

  return false;
}

function isJsonObject(value: unknown): value is JsonObject {
  return isRecord(value) && isJsonValue(value);
}

function canonicalKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function sanitizeCodexJsonValue(value: unknown, depth = 0): JsonValue | undefined {
  if (depth > 8) {
    return undefined;
  }

  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (Array.isArray(value)) {
    const items: JsonValue[] = [];

    for (const item of value) {
      const sanitized = sanitizeCodexJsonValue(item, depth + 1);

      if (sanitized !== undefined) {
        items.push(sanitized);
      }
    }

    return items;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  const sanitized: Record<string, JsonValue> = {};

  for (const [key, item] of Object.entries(value)) {
    if (codexAuthorityOutputKeys.has(canonicalKey(key))) {
      continue;
    }

    const sanitizedItem = sanitizeCodexJsonValue(item, depth + 1);

    if (sanitizedItem !== undefined) {
      sanitized[key] = sanitizedItem;
    }
  }

  return sanitized;
}

function isSafeReference(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value === value.trim() &&
    safeReferencePattern.test(value) &&
    value !== "." &&
    value !== ".." &&
    !value.includes("../") &&
    !value.includes("..\\") &&
    !value.startsWith("/") &&
    !/^[A-Za-z]:[\\/]/.test(value)
  );
}

function isSafeModel(value: unknown): value is string {
  return typeof value === "string" && safeModelPattern.test(value);
}

function isSafeAbsolutePath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    value.startsWith("/") &&
    !value.includes("\0") &&
    !value.includes("/../") &&
    !value.endsWith("/..")
  );
}

function isPositiveInteger(value: unknown, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= max;
}

function isCodexIdentity(
  identity: TaskExecutionWorkerIdentity,
): identity is TaskExecutionCodexWorkerIdentity {
  return (
    identity.workerFamily === "codex" &&
    identity.runtimeKind === "test_worker" &&
    identity.identityAuthority === "system" &&
    identity.selectionAuthority === "system"
  );
}

function validateConfiguration(
  configuration: TaskExecutionCodexWorkerConfiguration,
): readonly TaskExecutionWorkerIssue[] {
  const issues: TaskExecutionWorkerIssue[] = [];

  if (
    configuration.authority !== "system" ||
    !isCodexIdentity(configuration.identity) ||
    configuration.executable.authority !== "system" ||
    configuration.executable.executableKind !== "codex_exec" ||
    !isSafeReference(configuration.executable.executableRef) ||
    configuration.model.authority !== "system" ||
    !isSafeModel(configuration.model.model) ||
    !supportedReasoningEfforts.has(configuration.model.reasoningEffort) ||
    configuration.processPermission.authority !== "system" ||
    configuration.processPermission.requiredPermission !== "process" ||
    !isSafeReference(configuration.processPermission.permissionId) ||
    typeof configuration.processPermission.processExecutionAllowed !==
      "boolean" ||
    typeof configuration.futureProcessCapability !== "boolean" ||
    !["read-only", "workspace-write"].includes(configuration.sandboxMode) ||
    !["never", "on-request"].includes(configuration.approvalPolicy) ||
    !isPositiveInteger(configuration.timeoutMs, 600000) ||
    !isPositiveInteger(configuration.stdoutLimitBytes, 65536) ||
    !isPositiveInteger(configuration.stderrLimitBytes, 32768) ||
    (configuration.structuredResultContractRef !== undefined &&
      !isSafeReference(configuration.structuredResultContractRef)) ||
    (configuration.structuredResultSchemaPath !== undefined &&
      !isSafeAbsolutePath(configuration.structuredResultSchemaPath)) ||
    (configuration.environmentInheritance !== undefined &&
      configuration.environmentInheritance !== "none" &&
      configuration.environmentInheritance !==
        "system_codex_read_only_planner_canary")
  ) {
    issues.push(
      issue({
        code: "task_execution_codex_worker_configuration_invalid",
        message:
          "Codex worker configuration must be bounded, system-owned, and TEST-only.",
      }),
    );
  }

  if (
    configuration.workspace.authority !== "system" ||
    configuration.workspace.repositoryWriteAllowed !== false ||
    !isSafeReference(configuration.workspace.workspaceRef) ||
    !isSafeReference(configuration.workspace.projectRef) ||
    !isSafeReference(configuration.workspace.workingDirectoryRef) ||
    (configuration.workspace.repositoryRef !== undefined &&
      !isSafeReference(configuration.workspace.repositoryRef)) ||
    (configuration.workspace.allowedPathRefs !== undefined &&
      !configuration.workspace.allowedPathRefs.every((item) =>
        isSafeReference(item),
      ))
  ) {
    issues.push(
      issue({
        code: "task_execution_codex_worker_workspace_authority_invalid",
        message:
          "Codex process cwd must come from bounded system workspace authority.",
        category: "permission",
      }),
    );
  }

  return issues;
}

function taskOrModelClaimIssues(
  claims: unknown,
): readonly TaskExecutionWorkerIssue[] {
  if (claims === undefined) {
    return [];
  }

  const serialized = JSON.stringify(claims);
  const issues: TaskExecutionWorkerIssue[] = [
    issue({
      code: "task_execution_codex_worker_task_model_process_claims_rejected",
      message:
        "Task or model Codex process claims are rejected; executable, argv, cwd, model, and permissions are system-owned.",
      category: "permission",
    }),
  ];

  if (
    /(^|[^A-Za-z0-9_])(?:\/bin\/sh|bash|zsh|sh)\s+-c/i.test(serialized) ||
    /(?:^|[^A-Za-z0-9_])(?:command|shell|stringCommand)(?:[^A-Za-z0-9_]|$)/i.test(
      serialized,
    )
  ) {
    issues.push(
      issue({
        code: "task_execution_codex_worker_shell_command_rejected",
        message:
          "Codex worker process preparation rejects shell strings and interactive command automation.",
        category: "permission",
      }),
    );
  }

  for (const dangerous of dangerousCodexArgs) {
    if (serialized.includes(dangerous)) {
      issues.push(
        issue({
          code: "task_execution_codex_worker_dangerous_flag_rejected",
          message:
            "Codex worker process preparation rejects sandbox bypass and full-access flags.",
          category: "permission",
        }),
      );
      break;
    }
  }

  if (/credential|api[-_]?key|token|provider|mcp|danger-full-access/i.test(serialized)) {
    issues.push(
      issue({
        code: "task_execution_codex_worker_authority_override_rejected",
        message:
          "Codex worker process preparation rejects credential, provider, MCP, and authority overrides.",
        category: "permission",
      }),
    );
  }

  return issues;
}

function buildCodexArgv(
  configuration: TaskExecutionCodexWorkerConfiguration,
): readonly string[] {
  const argv = [
    "exec",
    "--model",
    configuration.model.model,
    "-c",
    `model_reasoning_effort="${configuration.model.reasoningEffort}"`,
    "--sandbox",
    configuration.sandboxMode,
  ];

  if (configuration.structuredResultSchemaPath !== undefined) {
    argv.push("--output-schema", configuration.structuredResultSchemaPath);
  }

  return argv;
}

function argvContractIssues(input: {
  readonly argv: readonly string[];
  readonly helpText: string;
}): readonly TaskExecutionWorkerIssue[] {
  const issues: TaskExecutionWorkerIssue[] = [];
  const supportedFlags = new Set([
    "-c",
    "--model",
    "--sandbox",
    "--output-schema",
    "--json",
    "--output-last-message",
    "--ephemeral",
    "--ignore-user-config",
  ]);
  const flagsWithValues = new Set([
    "--model",
    "-c",
    "--sandbox",
    "--output-schema",
    "--output-last-message",
  ]);

  if (input.argv[0] !== "exec") {
    issues.push(
      issue({
        code: "task_execution_codex_exec_contract_surface_invalid",
        message: "Codex planner preflight requires the codex exec surface.",
      }),
    );
  }

  for (let index = 1; index < input.argv.length; index += 1) {
    const arg = input.argv[index];

    if (!arg.startsWith("--") && arg !== "-c") {
      continue;
    }

    if (
      !supportedFlags.has(arg) ||
      (arg === "-c"
        ? !input.helpText.includes("-c, --config")
        : !input.helpText.includes(arg))
    ) {
      issues.push(
        issue({
          code: "task_execution_codex_exec_contract_flag_unsupported",
          message: "Codex planner preflight found an unsupported exec flag.",
        }),
      );
      continue;
    }

    if (flagsWithValues.has(arg)) {
      const value = input.argv[index + 1];

      if (value === undefined || value.startsWith("--")) {
        issues.push(
          issue({
            code: "task_execution_codex_exec_contract_flag_value_missing",
            message:
              "Codex planner preflight requires all valued exec flags to have system-owned values.",
          }),
        );
      }

      if (arg === "-c" && !codexReasoningEffortConfigPattern.test(value ?? "")) {
        issues.push(
          issue({
            code: "task_execution_codex_exec_contract_reasoning_config_invalid",
            message:
              "Codex planner preflight only permits the system-owned model_reasoning_effort config override.",
            category: "permission",
          }),
        );
      }

      index += 1;
    }
  }

  if (input.argv.includes("--json")) {
    issues.push(
      issue({
        code: "task_execution_codex_exec_contract_jsonl_mode_rejected",
        message:
          "TASK-0324 planner output parsing expects one final JSON object, not codex exec JSONL events.",
      }),
    );
  }

  if (
    input.argv.includes("--reasoning-effort") ||
    input.argv.includes("--ask-for-approval") ||
    input.argv.includes("--config") ||
    !input.argv.includes("--sandbox") ||
    input.argv[input.argv.indexOf("--sandbox") + 1] !== "read-only" ||
    !input.argv.includes("--output-schema")
  ) {
    issues.push(
      issue({
        code: "task_execution_codex_exec_contract_required_flag_missing",
        message:
          "Codex planner preflight requires read-only sandbox and output-schema flags.",
      }),
    );
  }

  return issues;
}

function task0324CodexPlannerProfileIssues(
  configuration: TaskExecutionCodexWorkerConfiguration,
): readonly TaskExecutionWorkerIssue[] {
  if (
    configuration.environmentInheritance !==
      "system_codex_read_only_planner_canary"
  ) {
    return [];
  }

  if (
    configuration.model.authority === "system" &&
    configuration.model.model === "gpt-5.5" &&
    configuration.model.reasoningEffort === "high"
  ) {
    return [];
  }

  return [
    issue({
      code: "task_execution_codex_exec_contract_model_profile_invalid",
      message:
        "TASK-0324 Codex planner profile must use system-owned gpt-5.5 with high reasoning.",
      category: "permission",
    }),
  ];
}

async function schemaContractIssues(input: {
  readonly projectRoot: string;
  readonly schemaPath?: string;
}): Promise<readonly TaskExecutionWorkerIssue[]> {
  const issues: TaskExecutionWorkerIssue[] = [];

  if (input.schemaPath === undefined || !isSafeAbsolutePath(input.schemaPath)) {
    return [
      issue({
        code: "task_execution_codex_exec_contract_schema_missing",
        message:
          "Codex planner preflight requires a system-owned absolute output schema path.",
      }),
    ];
  }

  try {
    const [rootPath, schemaPath] = await Promise.all([
      realpath(input.projectRoot),
      realpath(input.schemaPath),
    ]);
    const relativeSchemaPath = relative(rootPath, schemaPath);

    if (
      relativeSchemaPath.startsWith("..") ||
      relativeSchemaPath === "" ||
      relativeSchemaPath.startsWith("/") ||
      relativeSchemaPath.includes("\0")
    ) {
      issues.push(
        issue({
          code: "task_execution_codex_exec_contract_schema_outside_project",
          message:
            "Codex planner preflight requires the output schema to live inside the trusted project.",
          category: "permission",
        }),
      );
    }

    const schemaStat = await stat(schemaPath);

    if (!schemaStat.isFile()) {
      issues.push(
        issue({
          code: "task_execution_codex_exec_contract_schema_not_file",
          message: "Codex planner output schema path must resolve to a file.",
        }),
      );
    }

    const schema = JSON.parse(await readFile(schemaPath, "utf8")) as unknown;
    const schemaProperties =
      isRecord(schema) && isRecord(schema.properties)
        ? schema.properties
        : undefined;
    const outputSchema = schemaProperties !== undefined
      ? schemaProperties.output
      : undefined;
    const outputProperties =
      isRecord(outputSchema) && isRecord(outputSchema.properties)
        ? outputSchema.properties
        : undefined;
    const routingProposalSchema = isRecord(outputSchema)
      ? outputProperties?.routingProposal
      : undefined;
    const routingProposalRequired =
      isRecord(routingProposalSchema) &&
      Array.isArray(routingProposalSchema.required)
        ? routingProposalSchema.required
        : [];
    const routingProposalProperties = isRecord(routingProposalSchema)
      ? routingProposalSchema.properties
      : undefined;

    if (
      !isRecord(schema) ||
      schema.additionalProperties !== false ||
      !Array.isArray(schema.required) ||
      !schema.required.includes("output") ||
      !isRecord(outputSchema) ||
      outputSchema.additionalProperties !== false ||
      !Array.isArray(outputSchema.required) ||
      !outputSchema.required.includes("routingProposal") ||
      !isRecord(routingProposalSchema) ||
      routingProposalSchema.additionalProperties !== false ||
      ![
        "taskId",
        "sourceTaskRevision",
        "workItemId",
        "operationKind",
        "recommendedWorkerFamily",
        "capabilityRequirements",
        "reasonReference",
        "expectedOperationClass",
      ].every((field) => routingProposalRequired.includes(field)) ||
      !isRecord(routingProposalProperties) ||
      !isRecord(routingProposalProperties.recommendedWorkerFamily) ||
      routingProposalProperties.recommendedWorkerFamily.const !== "claude_code" ||
      !isRecord(routingProposalProperties.operationKind) ||
      routingProposalProperties.operationKind.const !== "execute_task_attempt" ||
      !isRecord(routingProposalProperties.expectedOperationClass) ||
      routingProposalProperties.expectedOperationClass.const !== "implementation"
    ) {
      issues.push(
        issue({
          code: "task_execution_codex_exec_contract_schema_invalid",
          message:
            "Codex planner output schema must be a closed AEOS worker-result contract.",
        }),
      );
    }
  } catch {
    issues.push(
      issue({
        code: "task_execution_codex_exec_contract_schema_invalid",
        message:
          "Codex planner preflight could not read and parse the output schema.",
      }),
    );
  }

  return issues;
}

export async function runTaskExecutionCodexExecContractPreflight(
  input: RunTaskExecutionCodexExecContractPreflightInput,
): Promise<TaskExecutionCodexExecContractPreflightResult> {
  const command: TaskExecutionCodexExecContractPreflightCommand = {
    executablePath: input.executablePath,
    argv: ["exec", "--help"],
    timeoutMs: input.timeoutMs ?? 10000,
  };
  const argv = buildCodexArgv(input.configuration);
  const issues: TaskExecutionWorkerIssue[] = [
    ...validateConfiguration(input.configuration),
    ...task0324CodexPlannerProfileIssues(input.configuration),
  ];
  let executableExists = false;
  let execSurfaceSupported = false;
  let cwdGitRepository = false;

  try {
    const executableRealPath = await realpath(input.executablePath);
    executableExists = (await stat(executableRealPath)).isFile();
  } catch {
    executableExists = false;
  }

  if (!executableExists) {
    issues.push(
      issue({
        code: "task_execution_codex_exec_contract_executable_missing",
        message:
          "Codex planner preflight requires the trusted executable to exist before launch authority is consumed.",
        category: "permission",
      }),
    );
  }

  const help = await (input.runHelp ?? runCodexExecHelpCommand)(command);
  execSurfaceSupported =
    help.spawned &&
    !help.timedOut &&
    help.exitCode === 0 &&
    help.stdout.includes("Usage: codex exec");

  if (!execSurfaceSupported) {
    issues.push(
      issue({
        code: "task_execution_codex_exec_contract_help_unavailable",
        message:
          "Codex planner preflight could not verify codex exec support without invoking a model.",
        category: "permission",
      }),
    );
  }

  const flagIssues = argvContractIssues({
    argv,
    helpText: help.stdout,
  });
  issues.push(...flagIssues);
  issues.push(
    ...(await schemaContractIssues({
      projectRoot: input.projectRoot,
      schemaPath: input.configuration.structuredResultSchemaPath,
    })),
  );
  cwdGitRepository = await (input.runGitCheck ?? runGitRepositoryCheck)(
    input.projectRoot,
  );

  if (!cwdGitRepository) {
    issues.push(
      issue({
        code: "task_execution_codex_exec_contract_cwd_not_git_repository",
        message:
          "Codex planner preflight requires the authoritative cwd to be a Git repository.",
        category: "permission",
      }),
    );
  }

  if (
    input.configuration.environmentInheritance !==
      "system_codex_read_only_planner_canary" ||
    safeEnvValue(
      (process as { env?: Record<string, string | undefined> }).env?.PATH,
    ) === undefined
  ) {
    issues.push(
      issue({
        code: "task_execution_codex_exec_contract_environment_invalid",
        message:
          "Codex planner preflight requires bounded host context including PATH for Codex startup and Git discovery.",
        category: "permission",
      }),
    );
  }

  const schemaIssues = issues.filter((item) =>
    item.code.startsWith("task_execution_codex_exec_contract_schema"),
  );
  const environmentIssues = issues.filter((item) =>
    item.code === "task_execution_codex_exec_contract_environment_invalid",
  );

  return {
    ok: !issues.some((item) => item.severity === "error"),
    command,
    issues,
    checks: {
      executableExists,
      execSurfaceSupported,
      expectedFlagsSupported: flagIssues.length === 0,
      schemaPathValid:
        schemaIssues.every(
          (item) =>
            item.code !== "task_execution_codex_exec_contract_schema_missing" &&
            item.code !==
              "task_execution_codex_exec_contract_schema_outside_project" &&
            item.code !== "task_execution_codex_exec_contract_schema_not_file",
        ) && schemaIssues.length === 0,
      schemaJsonValid: schemaIssues.length === 0,
      cwdGitRepository,
      environmentPolicyValid: environmentIssues.length === 0,
    },
    safety: {
      modelInvoked: false,
      shellUsed: false,
      fullParentEnvironmentInherited: false,
      rawHelpOutputPersisted: false,
      credentialFilesRead: false,
      secretsPersisted: false,
    },
  };
}

function argvIssues(argv: readonly string[]): readonly TaskExecutionWorkerIssue[] {
  const issues: TaskExecutionWorkerIssue[] = [];

  if (argv.length > 16 || !argv.every((arg) => arg.length > 0 && arg.length <= 160)) {
    issues.push(
      issue({
        code: "task_execution_codex_worker_argv_unbounded",
        message: "Codex process argv must remain bounded.",
      }),
    );
  }

  for (const [index, arg] of argv.entries()) {
    if (dangerousCodexArgs.has(arg) || arg.includes("danger-full-access")) {
      issues.push(
        issue({
          code: "task_execution_codex_worker_dangerous_flag_rejected",
          message:
            "Codex process argv cannot include sandbox bypass or full-access flags.",
          category: "permission",
        }),
      );
    }

    if (
      forbiddenArgPrefixes.some(
        (prefix) =>
          (arg === prefix || arg.startsWith(`${prefix}=`)) &&
          !(
            arg === "-c" &&
            codexReasoningEffortConfigPattern.test(argv[index + 1] ?? "")
          ),
      )
    ) {
      issues.push(
        issue({
          code: "task_execution_codex_worker_authority_override_rejected",
          message:
            "Codex process argv cannot carry config, MCP, provider, credential, or environment overrides.",
          category: "permission",
        }),
      );
    }

    if (/\s+-c\s+|[|;&<>`$]/.test(arg)) {
      issues.push(
        issue({
          code: "task_execution_codex_worker_shell_command_rejected",
          message: "Codex process argv cannot represent a shell command string.",
          category: "permission",
        }),
      );
    }
  }

  return issues;
}

function buildInstructionPayload(request: TaskExecutionWorkerRequest): string {
  return JSON.stringify({
    aeosCodexWorkerInstructionVersion: 1,
    taskId: request.taskId,
    sourceTaskRevision: request.sourceTaskRevision,
    attemptId: request.attemptId,
    attemptNumber: request.attemptNumber,
    invocationId: request.invocationId,
    idempotencyKey: request.idempotencyKey,
    workItemId: request.workItemId ?? null,
    batchId: request.batchId ?? null,
    operationKind: request.operationKind,
    workItem: request.workItemId ?? null,
    constraints: request.boundedInstructions,
    contextReferences: request.contextReferences,
    expectedEvidence: [
      "structured-result",
      "bounded-diagnostics",
      "changed-file-manifest-reference",
      "patch-artifact-reference",
      "test-summary-reference",
    ],
  });
}

function invocationRecordMatchesRequest(input: {
  readonly request: TaskExecutionWorkerRequest;
  readonly record: TaskExecutionInvocationRecord;
}): boolean {
  const { request, record } = input;

  return (
    record.taskId === request.taskId &&
    record.taskStateRevision === request.sourceTaskRevision &&
    record.attemptId === request.attemptId &&
    record.attemptNumber === request.attemptNumber &&
    record.invocationId === request.invocationId &&
    record.idempotencyKey === request.idempotencyKey &&
    (record.workItemId ?? null) === (request.workItemId ?? null) &&
    (record.batchId ?? null) === (request.batchId ?? null) &&
    (record.lifecycle === "reserved" || record.lifecycle === "invoking")
  );
}

export function prepareTaskExecutionCodexWorkerInvocation(input: {
  readonly configuration: TaskExecutionCodexWorkerConfiguration;
  readonly request: TaskExecutionWorkerRequest;
  readonly invocationRecord: unknown;
  readonly taskOrModelProcessClaims?: unknown;
}): {
  readonly preparedInvocation: TaskExecutionCodexPreparedInvocation;
  readonly issues: readonly TaskExecutionWorkerIssue[];
} {
  const issues: TaskExecutionWorkerIssue[] = [
    ...validateConfiguration(input.configuration),
    ...taskOrModelClaimIssues(input.taskOrModelProcessClaims),
  ];
  const argv = buildCodexArgv(input.configuration);
  issues.push(...argvIssues(argv));

  const invocationValidation = validateTaskExecutionInvocationRecord(
    input.invocationRecord,
  );
  const invocationAuthorityBound =
    invocationValidation.ok &&
    invocationRecordMatchesRequest({
      request: input.request,
      record: invocationValidation.value,
    });

  if (!invocationAuthorityBound) {
    issues.push(
      issue({
        code: "task_execution_codex_worker_invocation_authority_mismatch",
        message:
          "Prepared Codex invocation must bind the exact AEOS task, revision, attempt, invocation, idempotency, work item, and batch.",
        category: "conflict",
      }),
    );
  }

  const exactWorkerSelected =
    input.request.workerIdentity.workerId === input.configuration.identity.workerId &&
    input.request.workerIdentity.workerFamily === "codex" &&
    input.configuration.identity.workerFamily === "codex" &&
    input.request.workerIdentity.runtimeKind === "test_worker";

  if (!exactWorkerSelected) {
    issues.push(
      issue({
        code: "task_execution_codex_worker_selection_mismatch",
        message:
          "Codex adapter requires exact system-selected Codex worker identity.",
        category: "permission",
      }),
    );
  }

  const workspaceAuthorityBound =
    input.request.workspace.authority === "system" &&
    input.request.workspace.workspaceRef === input.configuration.workspace.workspaceRef &&
    input.request.workspace.projectRef === input.configuration.workspace.projectRef &&
    input.configuration.workspace.workingDirectoryRef ===
      input.request.workspace.workspaceRef;

  if (!workspaceAuthorityBound) {
    issues.push(
      issue({
        code: "task_execution_codex_worker_workspace_mismatch",
        message:
          "Codex process working directory must match system-owned worker workspace authority.",
        category: "permission",
      }),
    );
  }

  if (!input.configuration.futureProcessCapability) {
    issues.push(
      issue({
        code: "task_execution_codex_worker_process_capability_missing",
        message:
          "Future Codex process execution requires a system-declared process execution capability.",
        category: "permission",
      }),
    );
  }

  if (!input.configuration.processPermission.processExecutionAllowed) {
    issues.push(
      issue({
        code: "task_execution_codex_worker_process_permission_denied",
        message:
          "Prepared Codex process requests do not grant permission to run without an explicit process permission.",
        category: "permission",
      }),
    );
  }

  const stdin = buildInstructionPayload(input.request);

  if (stdin.length > 8192) {
    issues.push(
      issue({
        code: "task_execution_codex_worker_instruction_payload_unbounded",
        message: "Codex worker instruction payload must remain bounded.",
      }),
    );
  }

  const processRequest: TaskExecutionCodexProcessRequest = {
    executable: input.configuration.executable,
    argv,
    workingDirectory: input.configuration.workspace,
    stdin,
    timeoutMs: input.configuration.timeoutMs,
    stdoutLimitBytes: input.configuration.stdoutLimitBytes,
    stderrLimitBytes: input.configuration.stderrLimitBytes,
    environment: {
      authority: "system",
      inheritance: input.configuration.environmentInheritance ?? "none",
      variables: [],
    },
  };
  const preparedInvocation: TaskExecutionCodexPreparedInvocation = {
    taskId: input.request.taskId,
    sourceTaskRevision: input.request.sourceTaskRevision,
    attemptId: input.request.attemptId,
    attemptNumber: input.request.attemptNumber,
    invocationId: input.request.invocationId,
    idempotencyKey: input.request.idempotencyKey,
    workItemId: input.request.workItemId ?? null,
    batchId: input.request.batchId ?? null,
    workerIdentity: input.configuration.identity,
    processRequest,
    exactWorkerSelected,
    invocationAuthorityBound,
    workspaceAuthorityBound,
    futureProcessCapabilityDeclared: input.configuration.futureProcessCapability,
    processPermissionAllowed:
      input.configuration.processPermission.processExecutionAllowed,
    permissionFactsAllowed: input.request.permissionFacts.allowed,
    runnable:
      TASK_EXECUTION_CODEX_WORKER_REAL_EXECUTION_ENABLED &&
      issues.every((item) => item.severity !== "error") &&
      exactWorkerSelected &&
      invocationAuthorityBound &&
      workspaceAuthorityBound &&
      input.configuration.futureProcessCapability &&
      input.configuration.processPermission.processExecutionAllowed &&
      input.request.permissionFacts.allowed,
    realExecutionEnabled: TASK_EXECUTION_CODEX_WORKER_REAL_EXECUTION_ENABLED,
  };

  return {
    preparedInvocation,
    issues,
  };
}

function taskOrModelEnvironmentClaimIssues(
  claims: unknown,
): readonly TaskExecutionWorkerIssue[] {
  if (claims === undefined) {
    return [];
  }

  return [
    issue({
      code: "task_execution_worker_process_gate_task_model_env_override_rejected",
      message:
        "Task or model environment claims are rejected; future Codex process environment inheritance is system-owned.",
      category: "permission",
    }),
  ];
}

function sameOptionalId(left: string | null | undefined, right: string | null | undefined): boolean {
  return (left ?? null) === (right ?? null);
}

function codexPreparedInvocationMatchesAuthority(input: {
  readonly prepared: TaskExecutionCodexPreparedInvocation;
  readonly request: TaskExecutionWorkerRequest;
  readonly record: TaskExecutionInvocationRecord;
  readonly configuration: TaskExecutionCodexWorkerConfiguration;
}): boolean {
  const { prepared, request, record, configuration } = input;

  return (
    prepared.taskId === request.taskId &&
    prepared.taskId === record.taskId &&
    prepared.sourceTaskRevision === request.sourceTaskRevision &&
    prepared.sourceTaskRevision === record.taskStateRevision &&
    prepared.attemptId === request.attemptId &&
    prepared.attemptId === record.attemptId &&
    prepared.attemptNumber === request.attemptNumber &&
    prepared.attemptNumber === record.attemptNumber &&
    prepared.invocationId === request.invocationId &&
    prepared.invocationId === record.invocationId &&
    prepared.idempotencyKey === request.idempotencyKey &&
    prepared.idempotencyKey === record.idempotencyKey &&
    sameOptionalId(prepared.workItemId, request.workItemId) &&
    sameOptionalId(prepared.workItemId, record.workItemId) &&
    sameOptionalId(prepared.batchId, request.batchId) &&
    sameOptionalId(prepared.batchId, record.batchId) &&
    prepared.workerIdentity.workerId === configuration.identity.workerId &&
    prepared.workerIdentity.workerId === request.workerIdentity.workerId &&
    prepared.workerIdentity.workerFamily === "codex" &&
    request.workerIdentity.workerFamily === "codex"
  );
}

function codexProcessRequestMatchesConfiguration(input: {
  readonly prepared: TaskExecutionCodexPreparedInvocation;
  readonly configuration: TaskExecutionCodexWorkerConfiguration;
}): boolean {
  const request = input.prepared.processRequest;
  const configuration = input.configuration;

  return (
    request.executable.authority === "system" &&
    request.executable.executableKind === "codex_exec" &&
    request.executable.executableRef === configuration.executable.executableRef &&
    request.workingDirectory.authority === "system" &&
    request.workingDirectory.workspaceRef === configuration.workspace.workspaceRef &&
    request.workingDirectory.projectRef === configuration.workspace.projectRef &&
    request.workingDirectory.workingDirectoryRef ===
      configuration.workspace.workingDirectoryRef &&
    request.timeoutMs === configuration.timeoutMs &&
    request.stdoutLimitBytes === configuration.stdoutLimitBytes &&
    request.stderrLimitBytes === configuration.stderrLimitBytes
  );
}

function auditEventMatchesCodexProcessAuthority(input: {
  readonly event?: TaskExecutionAuditEvent;
  readonly prepared: TaskExecutionCodexPreparedInvocation;
  readonly gate?: TaskExecutionPermissionGateResult;
}): boolean {
  const { event, prepared, gate } = input;

  return (
    event !== undefined &&
    gate !== undefined &&
    event.eventKind === "execution_invocation_dispatch_intent" &&
    isPositiveInteger(event.sequence, 999999999) &&
    typeof event.eventDigest === "string" &&
    event.eventDigest.length > 0 &&
    event.result.status === "ok" &&
    event.taskId === prepared.taskId &&
    event.taskStateRevision === prepared.sourceTaskRevision &&
    event.attemptId === prepared.attemptId &&
    event.invocationId === prepared.invocationId &&
    event.binding.taskId === prepared.taskId &&
    event.binding.taskStateRevision === prepared.sourceTaskRevision &&
    event.binding.attemptId === prepared.attemptId &&
    event.binding.attemptNumber === prepared.attemptNumber &&
    event.binding.invocationId === prepared.invocationId &&
    sameOptionalId(event.binding.workItemId, prepared.workItemId) &&
    sameOptionalId(event.binding.batchId, prepared.batchId) &&
    event.adapter?.adapterId === prepared.workerIdentity.workerId &&
    event.adapter?.operation === "execute_task_attempt" &&
    event.adapter?.idempotencyReference === prepared.idempotencyKey &&
    event.policy?.policyGateId === gate.policyGateId &&
    event.policy?.auditRequired === true
  );
}

function processGateDecision(
  issues: readonly TaskExecutionWorkerIssue[],
): TaskExecutionWorkerProcessDecision {
  return issues.some((item) => item.severity === "error")
    ? "blocked"
    : "authorized";
}

export function evaluateTaskExecutionWorkerProcessGate(
  input: TaskExecutionWorkerProcessGateInput,
): TaskExecutionWorkerProcessGateResult {
  const localGate = evaluateTaskExecutionLocalWorkerProcessGate({
    processBoundary: TASK_EXECUTION_CODEX_PROCESS_BOUNDARY,
    expectedWorkerFamily: "codex",
    expectedExecutableKind: "codex_exec",
    workerFamilyLabel: "Codex",
    workerMismatchCode: "task_execution_worker_process_gate_worker_not_codex",
    configuration: input.configuration,
    request: input.request,
    invocationRecord: input.invocationRecord,
    preparedInvocation: input.preparedInvocation,
    permissionGateResult: input.permissionGateResult,
    preProcessAuditEvent: input.preProcessAuditEvent,
    expectedInvocationRevision: input.expectedInvocationRevision,
    additionalIssues: [
      ...validateConfiguration(input.configuration),
      ...taskOrModelClaimIssues(input.taskOrModelProcessClaims),
    ],
    argvIssues: argvIssues(input.preparedInvocation.processRequest.argv),
    taskOrModelEnvironmentClaims: input.taskOrModelEnvironmentClaims,
  });
  const readiness: TaskExecutionWorkerProcessReadiness = {
    ...(localGate.readiness as TaskExecutionLocalWorkerProcessReadiness),
    realCodexExecutionEnabled: TASK_EXECUTION_CODEX_WORKER_REAL_EXECUTION_ENABLED,
    externalProcessAllowed: TASK_EXECUTION_CODEX_WORKER_EXTERNAL_PROCESS_ALLOWED,
  };
  const localAuthority =
    localGate.authority as TaskExecutionLocalWorkerProcessAuthority | null;
  const codexEnvironment: {
    readonly authority: "system";
    readonly inheritance: TaskExecutionCodexEnvironmentInheritance;
    readonly approvedVariableRefs: readonly string[];
  } | null =
    localAuthority?.environment.inheritance === "none" ||
    localAuthority?.environment.inheritance ===
      "system_codex_read_only_planner_canary"
      ? {
          authority: localAuthority.environment.authority,
          inheritance: localAuthority.environment.inheritance,
          approvedVariableRefs: localAuthority.environment.approvedVariableRefs,
        }
      : null;
  const authority: TaskExecutionWorkerProcessAuthority | null =
    localAuthority === null || codexEnvironment === null
      ? null
      : {
          ...localAuthority,
          boundary: TASK_EXECUTION_CODEX_PROCESS_BOUNDARY,
          workerFamily: "codex",
          executableKind: "codex_exec",
          environment: codexEnvironment,
          realCodexExecutionEnabled:
            TASK_EXECUTION_CODEX_WORKER_REAL_EXECUTION_ENABLED,
          externalProcessAllowed:
            TASK_EXECUTION_CODEX_WORKER_EXTERNAL_PROCESS_ALLOWED,
        };

  return {
    ok: authority !== null,
    decision: authority === null ? "blocked" : localGate.decision,
    readiness,
    authority,
    issues: localGate.issues,
    CodexProcessContractReady: localGate.ProcessContractReady,
    RealCodexExecutionEnabled: TASK_EXECUTION_CODEX_WORKER_REAL_EXECUTION_ENABLED,
    ExternalProcessAllowed: TASK_EXECUTION_CODEX_WORKER_EXTERNAL_PROCESS_ALLOWED,
    ActualCodexCalls: 0,
    ActualClaudeCalls: 0,
    ActualWorkerProcessesSpawned: 0,
    CloudCalls: 0,
  };

}

export function authorizeTaskExecutionWorkerProcess(
  input: TaskExecutionWorkerProcessGateInput,
): TaskExecutionWorkerProcessGateResult {
  return evaluateTaskExecutionWorkerProcessGate(input);
}

function truncateDiagnostic(value: string, limit: number): string {
  let current = "";

  for (const char of value) {
    const next = `${current}${char}`;

    if (next.length > limit) {
      return current;
    }

    current = next;
  }

  return current;
}

function tailDiagnostic(value: string, limit: number): string {
  let current = "";

  for (let index = value.length - 1; index >= 0; index -= 1) {
    const next = `${value[index]}${current}`;

    if (next.length > limit) {
      return current;
    }

    current = next;
  }

  return current;
}

function sanitizeDiagnosticStream(value: string): string {
  return value
    .replace(/\u001b\[[0-9;]*[A-Za-z]/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 &&
        !/(^at\s+|\s+at\s+|stack)/i.test(line) &&
        !/(token|secret|credential|authorization|api[-_]?key|password|cookie|session)/i.test(
          line,
        ),
    )
    .map((line) =>
      line
        .replace(/\bError:/g, "error")
        .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[redacted]"),
    )
    .join(" ");
}

function streamDiagnostic(input: {
  readonly label: "stdout" | "stderr";
  readonly value: string;
  readonly headLimit: number;
  readonly tailLimit: number;
}): string {
  const sanitized = sanitizeDiagnosticStream(input.value);

  if (input.value.trim().length === 0) {
    return `${input.label}=empty`;
  }

  if (sanitized.length === 0) {
    return `${input.label}=redacted`;
  }

  const head = truncateDiagnostic(sanitized, input.headLimit).trim();
  const tail = tailDiagnostic(sanitized, input.tailLimit).trim();
  const terminal = tailDiagnostic(sanitized, 96).trim();

  return [
    `${input.label}Head=${head}`,
    `${input.label}Tail=${tail}`,
    `${input.label}Terminal=${terminal}`,
  ].join("; ");
}

function boundedDiagnostic(
  processResult: TaskExecutionCodexProcessResult,
  stderrLimitBytes: number,
): string {
  return truncateDiagnostic(
    [
      `termination=${processResult.terminationReason}`,
      `exitCode=${processResult.exitCode ?? "null"}`,
      processResult.signal === undefined ? undefined : `signal=${processResult.signal}`,
      processResult.stdinMode === undefined
        ? undefined
        : `stdinMode=${processResult.stdinMode}`,
      processResult.stdinBytes === undefined
        ? undefined
        : `stdinBytes=${processResult.stdinBytes}`,
      processResult.stdinWriteCompleted === undefined
        ? undefined
        : `stdinWriteCompleted=${processResult.stdinWriteCompleted}`,
      processResult.stdinClosed === undefined
        ? undefined
        : `stdinClosed=${processResult.stdinClosed}`,
      streamDiagnostic({
        label: "stderr",
        value: processResult.stderr,
        headLimit: Math.min(stderrLimitBytes, 96),
        tailLimit: Math.min(stderrLimitBytes, 192),
      }),
      streamDiagnostic({
        label: "stdout",
        value: processResult.stdout,
        headLimit: 64,
        tailLimit: 96,
      }),
    ]
      .filter((item): item is string => item !== undefined)
      .join("; "),
    512,
  );
}

function rawFailure(input: {
  readonly request: TaskExecutionWorkerRequest;
  readonly code: string;
  readonly category: TaskExecutionWorkerRawResult["failureCategory"];
  readonly message: string;
  readonly diagnostic?: string;
}): TaskExecutionWorkerRawResult {
  return {
    status: "failed",
    workerId: input.request.workerIdentity.workerId,
    workerFamily: input.request.workerIdentity.workerFamily,
    runtimeKind: input.request.workerIdentity.runtimeKind,
    invocationId: input.request.invocationId,
    idempotencyKey: input.request.idempotencyKey,
    taskId: input.request.taskId,
    sourceTaskRevision: input.request.sourceTaskRevision,
    attemptId: input.request.attemptId,
    attemptNumber: input.request.attemptNumber,
    workItemId: input.request.workItemId,
    batchId: input.request.batchId,
    failureCode: input.code,
    failureCategory: input.category,
    message: input.diagnostic ?? input.message,
    diagnostic: input.diagnostic,
  };
}

function unavailableFailure(input: {
  readonly request: TaskExecutionWorkerRequest;
  readonly code: string;
  readonly category: TaskExecutionWorkerRawResult["failureCategory"];
  readonly message: string;
  readonly diagnostic?: string;
}): TaskExecutionWorkerRawResult {
  return {
    ...rawFailure(input),
    status: "unavailable",
  };
}

function structuredBindingsMatch(input: {
  readonly request: TaskExecutionWorkerRequest;
  readonly value: Record<string, unknown>;
}): boolean {
  const { request, value } = input;

  // Core binding fields (invocationId, idempotencyKey, taskId, attemptId,
  // attemptNumber) are checked via the single shared validator.  Worker-
  // specific fields (worker identity, sourceTaskRevision, workItemId, batchId)
  // are checked here as Codex-boundary extensions.
  return (
    value.workerId === request.workerIdentity.workerId &&
    value.workerFamily === request.workerIdentity.workerFamily &&
    value.runtimeKind === request.workerIdentity.runtimeKind &&
    value.sourceTaskRevision === request.sourceTaskRevision &&
    (value.workItemId ?? null) === (request.workItemId ?? null) &&
    (value.batchId ?? null) === (request.batchId ?? null) &&
    coreWorkerBindingsMatch(
      {
        invocationId: value.invocationId as string,
        idempotencyKey: value.idempotencyKey as string,
        taskId: value.taskId as string,
        attemptId: value.attemptId as string,
        attemptNumber: value.attemptNumber as number,
      },
      request,
    )
  );
}

function structuredResultToRaw(input: {
  readonly request: TaskExecutionWorkerRequest;
  readonly value: unknown;
  readonly stdoutLimitBytes: number;
}): {
  readonly rawResult: TaskExecutionWorkerRawResult;
  readonly issues: readonly TaskExecutionWorkerIssue[];
} {
  const issues: TaskExecutionWorkerIssue[] = [];

  if (
    !isRecord(input.value) ||
    input.value.aeosCodexWorkerResultVersion !== 1 ||
    !structuredBindingsMatch({ request: input.request, value: input.value })
  ) {
    return {
      rawResult: rawFailure({
        request: input.request,
        code: "task_execution_codex_worker_structured_result_invalid",
        category: "invalid_request",
        message:
          "Codex process output was not a closed structured result bound to the AEOS invocation.",
      }),
      issues: [
        issue({
          code: "task_execution_codex_worker_structured_result_invalid",
          message:
            "Malformed or mismatched Codex structured output failed closed.",
        }),
      ],
    };
  }

  if (
    input.value.output !== undefined &&
    JSON.stringify(input.value.output).length > input.stdoutLimitBytes
  ) {
    return {
      rawResult: rawFailure({
        request: input.request,
        code: "task_execution_codex_worker_structured_output_oversized",
        category: "invalid_request",
        message: "Codex structured output exceeded the bounded output limit.",
      }),
      issues: [
        issue({
          code: "task_execution_codex_worker_structured_output_oversized",
          message: "Oversized Codex structured output was rejected.",
        }),
      ],
    };
  }

  const status = input.value.status;
  const output = sanitizeCodexJsonValue(input.value.output);
  const metadata = sanitizeCodexJsonValue(input.value.metadata);

  if (
    status !== "returned" &&
    status !== "failed" &&
    status !== "in_progress" &&
    status !== "unavailable"
  ) {
    return {
      rawResult: rawFailure({
        request: input.request,
        code: "task_execution_codex_worker_structured_status_invalid",
        category: "invalid_request",
        message: "Codex structured output contained an invalid status.",
      }),
      issues: [
        issue({
          code: "task_execution_codex_worker_structured_status_invalid",
          message: "Invalid Codex structured status failed closed.",
        }),
      ],
    };
  }

  if (output !== undefined && !isJsonValue(output)) {
    issues.push(
      issue({
        code: "task_execution_codex_worker_structured_output_invalid",
        message: "Non-JSON Codex output was dropped from worker evidence.",
        severity: "warning",
      }),
    );
  }

  if (metadata !== undefined && !isJsonObject(metadata)) {
    issues.push(
      issue({
        code: "task_execution_codex_worker_structured_metadata_invalid",
        message: "Non-object Codex metadata was dropped from worker evidence.",
        severity: "warning",
      }),
    );
  }

  return {
    rawResult: {
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
      workItemId: input.request.workItemId,
      batchId: input.request.batchId,
      invocationOk:
        typeof input.value.invocationOk === "boolean"
          ? input.value.invocationOk
          : undefined,
      output: isJsonValue(output) ? output : undefined,
      outputReference:
        typeof input.value.outputReference === "string"
          ? input.value.outputReference
          : undefined,
      patchArtifactReference:
        typeof input.value.patchArtifactReference === "string"
          ? input.value.patchArtifactReference
          : undefined,
      changedFileManifestReference:
        typeof input.value.changedFileManifestReference === "string"
          ? input.value.changedFileManifestReference
          : undefined,
      testSummaryReference:
        typeof input.value.testSummaryReference === "string"
          ? input.value.testSummaryReference
          : undefined,
      diagnosticCode:
        typeof input.value.diagnosticCode === "string"
          ? input.value.diagnosticCode
          : undefined,
      message:
        typeof input.value.message === "string" ? input.value.message : undefined,
      metadata: isJsonObject(metadata) ? metadata : undefined,
      failure: isRecord(input.value.failure)
        ? (input.value.failure as unknown as TaskExecutionWorkerRawResult["failure"])
        : undefined,
      failureCode:
        typeof input.value.failureCode === "string"
          ? input.value.failureCode
          : undefined,
      failureCategory:
        typeof input.value.failureCategory === "string"
          ? (input.value.failureCategory as TaskExecutionWorkerRawResult["failureCategory"])
          : undefined,
      diagnostic:
        typeof input.value.diagnostic === "string"
          ? input.value.diagnostic
          : undefined,
    },
    issues,
  };
}

export function normalizeTaskExecutionCodexProcessRawResult(input: {
  readonly request: TaskExecutionWorkerRequest;
  readonly processResult: TaskExecutionCodexProcessResult;
  readonly stdoutLimitBytes?: number;
  readonly stderrLimitBytes?: number;
}): {
  readonly rawResult: TaskExecutionWorkerRawResult;
  readonly issues: readonly TaskExecutionWorkerIssue[];
} {
  const stdoutLimitBytes = input.stdoutLimitBytes ?? 8192;
  const stderrLimitBytes = input.stderrLimitBytes ?? 2048;
  const diagnostic = boundedDiagnostic(input.processResult, stderrLimitBytes);

  if (input.processResult.timedOut || input.processResult.terminationReason === "timeout") {
    return {
      rawResult: unavailableFailure({
        request: input.request,
        code: "task_execution_codex_worker_process_timeout",
        category: "timeout",
        message:
          "Codex process timed out; this is evidence only and does not authorize completion or retry.",
        diagnostic,
      }),
      issues: [],
    };
  }

  if (
    input.processResult.interrupted ||
    input.processResult.terminationReason === "interrupted" ||
    input.processResult.terminationReason === "signal" ||
    input.processResult.terminationReason === "spawn_failure" ||
    input.processResult.terminationReason === "unknown"
  ) {
    return {
      rawResult: unavailableFailure({
        request: input.request,
        code:
          input.processResult.terminationReason === "spawn_failure"
            ? "task_execution_codex_worker_process_spawn_failed"
            : input.processResult.terminationReason === "unknown"
              ? "task_execution_codex_worker_process_outcome_unknown"
              : "task_execution_codex_worker_process_interrupted",
        category: "unknown",
        message:
          "Codex process was interrupted; this is evidence only and does not complete work.",
        diagnostic,
      }),
      issues: [],
    };
  }

  if (input.processResult.stdout.length > stdoutLimitBytes) {
    return {
      rawResult: rawFailure({
        request: input.request,
        code: "task_execution_codex_worker_stdout_oversized",
        category: "invalid_request",
        message: "Codex process stdout exceeded the configured bounded limit.",
        diagnostic,
      }),
      issues: [
        issue({
          code: "task_execution_codex_worker_stdout_oversized",
          message: "Oversized Codex stdout was rejected.",
        }),
      ],
    };
  }

  if (
    input.processResult.stderr.length > stderrLimitBytes ||
    input.processResult.terminationReason === "output_limit_exceeded"
  ) {
    return {
      rawResult: rawFailure({
        request: input.request,
        code: "task_execution_codex_worker_stderr_oversized",
        category: "invalid_request",
        message: "Codex process stderr exceeded the configured bounded limit.",
        diagnostic,
      }),
      issues: [
        issue({
          code: "task_execution_codex_worker_stderr_oversized",
          message: "Oversized Codex stderr was rejected.",
        }),
      ],
    };
  }

  if (
    input.processResult.exitCode !== 0 ||
    input.processResult.terminationReason === "nonzero_exit"
  ) {
    return {
      rawResult: rawFailure({
        request: input.request,
        code: "task_execution_codex_worker_process_nonzero_exit",
        category: "worker_error",
        message:
          "Codex process exited nonzero; exit status is not completion authority.",
        diagnostic,
      }),
      issues: [],
    };
  }

  try {
    return structuredResultToRaw({
      request: input.request,
      value: JSON.parse(input.processResult.stdout) as unknown,
      stdoutLimitBytes,
    });
  } catch {
    return {
      rawResult: rawFailure({
        request: input.request,
        code: "task_execution_codex_worker_structured_result_malformed",
        category: "invalid_request",
        message:
          "Codex process stdout was not valid structured JSON and failed closed.",
        diagnostic,
      }),
      issues: [
        issue({
          code: "task_execution_codex_worker_structured_result_malformed",
          message: "Malformed Codex structured output failed closed.",
        }),
      ],
    };
  }
}

export function normalizeTaskExecutionCodexProcessResult(input: {
  readonly request: TaskExecutionWorkerRequest;
  readonly processResult: TaskExecutionCodexProcessResult;
  readonly stdoutLimitBytes?: number;
  readonly stderrLimitBytes?: number;
}): TaskExecutionWorkerResult {
  const normalizedRaw = normalizeTaskExecutionCodexProcessRawResult(input);
  const normalized = normalizeTaskExecutionWorkerResult({
    request: input.request,
    rawResult: normalizedRaw.rawResult,
  });

  return {
    ...normalized,
    issues: [...normalized.issues, ...normalizedRaw.issues],
  };
}

function successfulProcessResult(
  request: TaskExecutionWorkerRequest,
): TaskExecutionCodexProcessResult {
  return {
    invocationRef: `test-codex-process:${request.invocationId}`,
    terminationReason: "exited",
    exitCode: 0,
    timedOut: false,
    interrupted: false,
    stderr: "",
    stdout: JSON.stringify({
      aeosCodexWorkerResultVersion: 1,
      status: "returned",
      workerId: request.workerIdentity.workerId,
      workerFamily: request.workerIdentity.workerFamily,
      runtimeKind: request.workerIdentity.runtimeKind,
      invocationId: request.invocationId,
      idempotencyKey: request.idempotencyKey,
      taskId: request.taskId,
      sourceTaskRevision: request.sourceTaskRevision,
      attemptId: request.attemptId,
      attemptNumber: request.attemptNumber,
      workItemId: request.workItemId ?? null,
      batchId: request.batchId ?? null,
      invocationOk: true,
      outputReference: "artifact:codex-worker-output",
      patchArtifactReference: "artifact:codex-worker-patch",
      changedFileManifestReference: "artifact:codex-worker-changed-files",
      testSummaryReference: "artifact:codex-worker-tests",
      diagnosticCode: "codex_worker_test_process_returned",
    }),
  };
}

export function createTaskExecutionCodexWorkerAdapter(input: {
  readonly configuration: TaskExecutionCodexWorkerConfiguration;
  readonly deterministicProcessResult?: TaskExecutionCodexProcessResult;
}): TaskExecutionCodexWorkerAdapter {
  let processCalls = 0;

  return {
    codexAdapterKind: "task_execution_codex_worker_adapter",
    identity: input.configuration.identity,
    capabilities: {
      roles: ["implementation"],
      repositoryRead: true,
      repositoryWrite: false,
      processExecution: false,
      shellExecution: false,
      toolExecution: false,
      modelReasoning: true,
      patchGeneration: true,
      testExecution: true,
      boundedDiagnostics: true,
      deterministicTestResult: true,
    },
    configuration: input.configuration,
    processCallCount: () => processCalls,
    actualChildProcessCount: () => 0,
    actualCodexCallCount: () => 0,
    actualClaudeCodeCallCount: () => 0,
    cloudCallCount: () => 0,
    run: (request) => {
      processCalls += 1;
      const normalizedRaw = normalizeTaskExecutionCodexProcessRawResult({
        request,
        processResult:
          input.deterministicProcessResult ?? successfulProcessResult(request),
        stdoutLimitBytes: input.configuration.stdoutLimitBytes,
        stderrLimitBytes: input.configuration.stderrLimitBytes,
      });

      if (normalizedRaw.issues.some((item) => item.severity === "error")) {
        return normalizedRaw.rawResult;
      }

      return normalizedRaw.rawResult;
    },
  };
}

function codexAdapterFromUnknown(
  worker: unknown,
): TaskExecutionCodexWorkerAdapter | undefined {
  if (!isRecord(worker)) {
    return undefined;
  }

  if (
    worker.codexAdapterKind !== "task_execution_codex_worker_adapter" ||
    typeof worker.processCallCount !== "function" ||
    typeof worker.actualChildProcessCount !== "function" ||
    typeof worker.actualCodexCallCount !== "function" ||
    typeof worker.actualClaudeCodeCallCount !== "function" ||
    typeof worker.cloudCallCount !== "function"
  ) {
    return undefined;
  }

  return worker as unknown as TaskExecutionCodexWorkerAdapter;
}

export async function evaluateTaskExecutionCodexWorkerConformance(
  input: TaskExecutionCodexWorkerConformanceInput,
): Promise<TaskExecutionCodexWorkerConformanceResult> {
  const adapter = codexAdapterFromUnknown(input.worker);
  const prepared = prepareTaskExecutionCodexWorkerInvocation({
    configuration: input.configuration,
    request: input.request,
    invocationRecord: input.invocationRecord,
    taskOrModelProcessClaims: input.taskOrModelProcessClaims,
  });
  const preflightIssues = [...prepared.issues];

  if (adapter === undefined) {
    preflightIssues.push(
      issue({
        code: "task_execution_codex_worker_adapter_invalid",
        message:
          "Codex worker must be the concrete local Codex adapter boundary.",
      }),
    );
  }

  if (adapter !== undefined && adapter.identity.workerId !== input.configuration.identity.workerId) {
    preflightIssues.push(
      issue({
        code: "task_execution_codex_worker_adapter_configuration_mismatch",
        message: "Codex adapter identity must match the supplied configuration.",
        category: "conflict",
      }),
    );
  }

  if (preflightIssues.some((item) => item.severity === "error")) {
    return {
      ok: false,
      codexWorkerConformant: false,
      preparedInvocation: prepared.preparedInvocation,
      workerConformance: null,
      normalizedResult: null,
      issues: preflightIssues,
      processCallCount: adapter?.processCallCount() ?? 0,
      actualChildProcessCount: 0,
      actualCodexCallCount: 0,
      actualClaudeCodeCallCount: 0,
      cloudCallCount: 0,
      realExecutionEnabled: TASK_EXECUTION_CODEX_WORKER_REAL_EXECUTION_ENABLED,
    };
  }

  if (adapter === undefined) {
    return {
      ok: false,
      codexWorkerConformant: false,
      preparedInvocation: prepared.preparedInvocation,
      workerConformance: null,
      normalizedResult: null,
      issues: preflightIssues,
      processCallCount: 0,
      actualChildProcessCount: 0,
      actualCodexCallCount: 0,
      actualClaudeCodeCallCount: 0,
      cloudCallCount: 0,
      realExecutionEnabled: TASK_EXECUTION_CODEX_WORKER_REAL_EXECUTION_ENABLED,
    };
  }

  const workerConformance = await evaluateTaskExecutionWorkerConformance({
    worker: adapter,
    request: input.request,
    invocationRecord: input.invocationRecord,
    permissionGateResult: input.permissionGateResult,
    expectedIdempotencyKey: input.expectedIdempotencyKey,
    taskOrModelWorkerSelectionClaims: input.taskOrModelWorkerSelectionClaims,
    taskOrModelCapabilityClaims: input.taskOrModelCapabilityClaims,
    stateSnapshotBefore: input.stateSnapshotBefore,
    stateSnapshotAfter: input.stateSnapshotAfter,
    attemptSnapshotBefore: input.attemptSnapshotBefore,
    attemptSnapshotAfter: input.attemptSnapshotAfter,
    invocationSnapshotBefore: input.invocationSnapshotBefore,
    invocationSnapshotAfter: input.invocationSnapshotAfter,
    workAccountingSnapshotBefore: input.workAccountingSnapshotBefore,
    workAccountingSnapshotAfter: input.workAccountingSnapshotAfter,
  });
  const issues = [...preflightIssues, ...workerConformance.issues];
  const codexWorkerConformant =
    workerConformance.testWorkerConformant &&
    workerConformance.workerIdentity?.workerFamily === "codex" &&
    workerConformance.workerInvoked &&
    adapter.actualChildProcessCount() === 0 &&
    adapter.actualCodexCallCount() === 0 &&
    adapter.actualClaudeCodeCallCount() === 0 &&
    adapter.cloudCallCount() === 0;

  return {
    ok: codexWorkerConformant && issues.every((item) => item.severity !== "error"),
    codexWorkerConformant,
    preparedInvocation: prepared.preparedInvocation,
    workerConformance,
    normalizedResult: workerConformance.normalizedResult,
    issues,
    processCallCount: adapter.processCallCount(),
    actualChildProcessCount: adapter.actualChildProcessCount(),
    actualCodexCallCount: adapter.actualCodexCallCount(),
    actualClaudeCodeCallCount: adapter.actualClaudeCodeCallCount(),
    cloudCallCount: adapter.cloudCallCount(),
    realExecutionEnabled: TASK_EXECUTION_CODEX_WORKER_REAL_EXECUTION_ENABLED,
  };
}
