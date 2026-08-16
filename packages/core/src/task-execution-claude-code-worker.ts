import type { TaskExecutionAuditEvent } from "./task-execution-audit.js";
import type {
  TaskExecutionInvocationRecord,
} from "./task-execution-invocation-record.js";
import {
  validateTaskExecutionInvocationRecord,
} from "./task-execution-invocation-record.js";
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
} from "./task-execution-worker.js";
import type {
  TaskExecutionLocalWorkerProcessAuthority,
  TaskExecutionLocalWorkerProcessDecision,
  TaskExecutionLocalWorkerProcessReadiness,
} from "./task-execution-local-worker-process.js";
import {
  evaluateTaskExecutionLocalWorkerProcessGate,
  TASK_EXECUTION_LOCAL_WORKER_EXTERNAL_PROCESS_ALLOWED,
  TASK_EXECUTION_LOCAL_WORKER_PROCESS_CONTRACT_READY,
} from "./task-execution-local-worker-process.js";
import type { AeosError, JsonObject, JsonValue } from "./types.js";

export const TASK_EXECUTION_CLAUDE_CODE_WORKER_REAL_EXECUTION_ENABLED = false;
export const TASK_EXECUTION_CLAUDE_CODE_WORKER_EXTERNAL_PROCESS_ALLOWED =
  TASK_EXECUTION_LOCAL_WORKER_EXTERNAL_PROCESS_ALLOWED;
export const TASK_EXECUTION_CLAUDE_CODE_PROCESS_CONTRACT_READY =
  TASK_EXECUTION_LOCAL_WORKER_PROCESS_CONTRACT_READY;
export const TASK_EXECUTION_CLAUDE_CODE_PROCESS_BOUNDARY =
  "AUTHORIZED_LOCAL_CLAUDE_CODE_PROCESS";
export const TASK_EXECUTION_CLAUDE_CODE_READ_ONLY_CANARY_PROFILE_READY = true;
export const TASK_EXECUTION_CLAUDE_CODE_READ_ONLY_CANARY_EXECUTED = false;
export const TASK_EXECUTION_CLAUDE_CODE_WRITE_CANARY_PROFILE_READY = true;
export const TASK_EXECUTION_CLAUDE_CODE_WRITE_CANARY_EXECUTED = false;

export type TaskExecutionClaudeCodeProcessTerminationReason =
  | "exited"
  | "nonzero_exit"
  | "timeout"
  | "interrupted"
  | "signal"
  | "spawn_failure"
  | "output_limit_exceeded"
  | "unknown";

export type TaskExecutionClaudeCodeWorkerIdentity =
  TaskExecutionWorkerIdentity & {
    readonly workerFamily: "claude_code";
    readonly runtimeKind: "test_worker";
  };

export interface TaskExecutionClaudeCodeExecutableAuthority {
  readonly authority: "system";
  readonly executableRef: string;
  readonly executableKind: "claude_code";
}

export interface TaskExecutionClaudeCodeProcessPermission {
  readonly authority: "system";
  readonly permissionId: string;
  readonly requiredPermission: Extract<TaskExecutionPermissionKind, "process">;
  readonly processExecutionAllowed: boolean;
}

export interface TaskExecutionClaudeCodeWorkspaceAuthority
  extends TaskExecutionWorkerWorkspaceReference {
  readonly workingDirectoryRef: string;
}

export interface TaskExecutionClaudeCodeWorkerConfiguration {
  readonly authority: "system";
  readonly identity: TaskExecutionClaudeCodeWorkerIdentity;
  readonly executable: TaskExecutionClaudeCodeExecutableAuthority;
  readonly workspace: TaskExecutionClaudeCodeWorkspaceAuthority;
  readonly processPermission: TaskExecutionClaudeCodeProcessPermission;
  readonly futureProcessCapability: boolean;
  readonly timeoutMs: number;
  readonly stdoutLimitBytes: number;
  readonly stderrLimitBytes: number;
  readonly structuredResultContractRef?: string;
  readonly readOnlyCanaryProfile?: TaskExecutionClaudeCodeReadOnlyCanaryProfile;
  readonly writeCanaryProfile?: TaskExecutionClaudeCodeWriteCanaryProfile;
}

export interface TaskExecutionClaudeCodeReadOnlyCanaryProfile {
  readonly authority: "system";
  readonly profileId: "claude_code_read_only_canary_v1";
  readonly enabled: true;
  readonly permissionMode: "plan";
  readonly toolSet: readonly ["Read"];
  readonly hostCustomizationIsolation: "safe_mode";
  readonly strictMcpConfig: true;
  readonly sessionPersistence: false;
  readonly repositoryWriteAllowed: false;
  readonly structuredOutput: "json_schema";
}

export interface TaskExecutionClaudeCodeWriteCanaryProfile {
  readonly authority: "system";
  readonly profileId: "claude_code_write_canary_v1";
  readonly enabled: true;
  readonly permissionMode: "acceptEdits";
  readonly toolSet: readonly ["Read", "Edit"];
  readonly hostCustomizationIsolation: "safe_mode";
  readonly strictMcpConfig: true;
  readonly sessionPersistence: false;
  readonly repositoryWriteAllowed: false;
  readonly primaryWorkspaceMutationAllowed: false;
  readonly automaticPatchApplyAllowed: false;
  readonly shellAllowed: false;
  readonly structuredOutput: "json_schema";
  readonly allowedMutationPath: "canary/claude-write-canary.txt";
}

export interface TaskExecutionClaudeCodeProcessRequest {
  readonly executable: TaskExecutionClaudeCodeExecutableAuthority;
  readonly argv: readonly string[];
  readonly workingDirectory: TaskExecutionClaudeCodeWorkspaceAuthority;
  readonly stdin: string;
  readonly timeoutMs: number;
  readonly stdoutLimitBytes: number;
  readonly stderrLimitBytes: number;
  readonly environment: {
    readonly authority: "system";
    readonly inheritance?:
      | "none"
      | "system_claude_code_read_only_canary"
      | "system_claude_code_write_canary";
    readonly variables: readonly [];
  };
}

export interface TaskExecutionClaudeCodePreparedInvocation {
  readonly taskId: string;
  readonly sourceTaskRevision: number;
  readonly attemptId: string;
  readonly attemptNumber: number;
  readonly invocationId: string;
  readonly idempotencyKey: string;
  readonly workItemId: string | null;
  readonly batchId: string | null;
  readonly workerIdentity: TaskExecutionClaudeCodeWorkerIdentity;
  readonly processRequest: TaskExecutionClaudeCodeProcessRequest;
  readonly exactWorkerSelected: boolean;
  readonly invocationAuthorityBound: boolean;
  readonly workspaceAuthorityBound: boolean;
  readonly futureProcessCapabilityDeclared: boolean;
  readonly processPermissionAllowed: boolean;
  readonly permissionFactsAllowed: boolean;
  readonly runnable: boolean;
  readonly realExecutionEnabled: false;
  readonly readOnlyCanaryProfileReady: boolean;
  readonly writeCanaryProfileReady: boolean;
}

export interface TaskExecutionClaudeCodeProcessResult {
  readonly invocationRef: string;
  readonly terminationReason: TaskExecutionClaudeCodeProcessTerminationReason;
  readonly exitCode: number | null;
  readonly signal?: string;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
  readonly interrupted: boolean;
  readonly observedAt?: string;
}

export interface TaskExecutionClaudeCodeWorkerAdapter
  extends TaskExecutionWorkerAdapter {
  readonly claudeCodeAdapterKind: "task_execution_claude_code_worker_adapter";
  readonly identity: TaskExecutionClaudeCodeWorkerIdentity;
  readonly capabilities: TaskExecutionWorkerCapabilities;
  readonly configuration: TaskExecutionClaudeCodeWorkerConfiguration;
  readonly processCallCount: () => number;
  readonly actualChildProcessCount: () => 0;
  readonly actualCodexCallCount: () => 0;
  readonly actualClaudeCodeCallCount: () => 0;
  readonly cloudCallCount: () => 0;
}

export interface TaskExecutionClaudeCodeWorkerConformanceInput
  extends Omit<TaskExecutionWorkerConformanceInput, "worker"> {
  readonly worker: unknown;
  readonly configuration: TaskExecutionClaudeCodeWorkerConfiguration;
  readonly taskOrModelProcessClaims?: unknown;
}

export interface TaskExecutionClaudeCodeWorkerConformanceResult {
  readonly ok: boolean;
  readonly claudeCodeWorkerConformant: boolean;
  readonly preparedInvocation: TaskExecutionClaudeCodePreparedInvocation;
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

export interface TaskExecutionClaudeCodeWorkerProcessGateInput {
  readonly configuration: TaskExecutionClaudeCodeWorkerConfiguration;
  readonly request: TaskExecutionWorkerRequest;
  readonly invocationRecord: unknown;
  readonly preparedInvocation: TaskExecutionClaudeCodePreparedInvocation;
  readonly permissionGateResult?: TaskExecutionPermissionGateResult;
  readonly preProcessAuditEvent?: TaskExecutionAuditEvent;
  readonly expectedInvocationRevision?: number;
  readonly taskOrModelProcessClaims?: unknown;
  readonly taskOrModelEnvironmentClaims?: unknown;
}

export interface TaskExecutionClaudeCodeWorkerProcessAuthority
  extends TaskExecutionLocalWorkerProcessAuthority {
  readonly boundary: typeof TASK_EXECUTION_CLAUDE_CODE_PROCESS_BOUNDARY;
  readonly workerFamily: "claude_code";
  readonly executableKind: "claude_code";
}

export interface TaskExecutionClaudeCodeWorkerProcessGateResult {
  readonly ok: boolean;
  readonly decision: TaskExecutionLocalWorkerProcessDecision;
  readonly readiness: TaskExecutionLocalWorkerProcessReadiness;
  readonly authority: TaskExecutionClaudeCodeWorkerProcessAuthority | null;
  readonly issues: readonly TaskExecutionWorkerIssue[];
  readonly ClaudeCodeProcessContractReady: boolean;
  readonly RealClaudeCodeExecutionEnabled: false;
  readonly ExternalProcessAllowed: false;
  readonly ActualCodexCalls: 0;
  readonly ActualClaudeCalls: 0;
  readonly ActualWorkerProcessesSpawned: 0;
  readonly CloudCalls: 0;
}

const safeReferencePattern = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,255}$/;
const claudeCodeReadOnlyCanarySchema = JSON.stringify({
  type: "object",
  additionalProperties: false,
  properties: {
    aeosClaudeCodeWorkerResultVersion: { const: 1 },
    status: { enum: ["returned", "failed", "in_progress", "unavailable"] },
    workerId: { type: "string" },
    workerFamily: { const: "claude_code" },
    runtimeKind: { const: "test_worker" },
    invocationId: { type: "string" },
    idempotencyKey: { type: "string" },
    taskId: { type: "string" },
    sourceTaskRevision: { type: "number" },
    attemptId: { type: "string" },
    attemptNumber: { type: "number" },
    workItemId: { type: ["string", "null"] },
    batchId: { type: ["string", "null"] },
    invocationOk: { type: "boolean" },
    output: {
      type: "object",
      additionalProperties: false,
      properties: {
        workerFamily: { const: "claude_code" },
        observedTaskId: { type: "string" },
        observedOperation: { const: "execute_task_attempt" },
        summary: { type: "string" },
        evidence: {
          type: "array",
          items: { type: "string" },
          maxItems: 4,
        },
      },
      required: [
        "workerFamily",
        "observedTaskId",
        "observedOperation",
        "summary",
        "evidence",
      ],
    },
    diagnosticCode: { type: "string" },
    message: { type: "string" },
    metadata: {
      type: "object",
      additionalProperties: true,
    },
  },
  required: [
    "aeosClaudeCodeWorkerResultVersion",
    "status",
    "workerId",
    "workerFamily",
    "runtimeKind",
    "invocationId",
    "idempotencyKey",
    "taskId",
    "sourceTaskRevision",
    "attemptId",
    "attemptNumber",
    "workItemId",
    "batchId",
    "invocationOk",
    "output",
    "diagnosticCode",
  ],
});
const claudeCodeWriteCanarySchema = JSON.stringify({
  type: "object",
  additionalProperties: false,
  properties: {
    aeosClaudeCodeWorkerResultVersion: { const: 1 },
    status: { enum: ["returned", "failed", "in_progress", "unavailable"] },
    workerId: { type: "string" },
    workerFamily: { const: "claude_code" },
    runtimeKind: { const: "test_worker" },
    invocationId: { type: "string" },
    idempotencyKey: { type: "string" },
    taskId: { type: "string" },
    sourceTaskRevision: { type: "number" },
    attemptId: { type: "string" },
    attemptNumber: { type: "number" },
    workItemId: { type: ["string", "null"] },
    batchId: { type: ["string", "null"] },
    invocationOk: { type: "boolean" },
    output: {
      type: "object",
      additionalProperties: false,
      properties: {
        workerFamily: { const: "claude_code" },
        observedTaskId: { type: "string" },
        observedOperation: { const: "execute_task_attempt" },
        summary: { type: "string" },
        success: { type: "boolean" },
        changedFiles: {
          type: "array",
          items: { const: "canary/claude-write-canary.txt" },
          maxItems: 1,
        },
        shellExecuted: { const: false },
      },
      required: [
        "workerFamily",
        "observedTaskId",
        "observedOperation",
        "summary",
        "success",
        "changedFiles",
        "shellExecuted",
      ],
    },
    diagnosticCode: { type: "string" },
    message: { type: "string" },
    metadata: {
      type: "object",
      additionalProperties: true,
    },
  },
  required: [
    "aeosClaudeCodeWorkerResultVersion",
    "status",
    "workerId",
    "workerFamily",
    "runtimeKind",
    "invocationId",
    "idempotencyKey",
    "taskId",
    "sourceTaskRevision",
    "attemptId",
    "attemptNumber",
    "workItemId",
    "batchId",
    "invocationOk",
    "output",
    "diagnosticCode",
  ],
});
const dangerousClaudeArgs = new Set([
  "--dangerously-skip-permissions",
  "bypassPermissions",
  "--permission-mode=bypassPermissions",
]);
const forbiddenArgPrefixes = [
  "--add-dir",
  "--cwd",
  "--mcp-config",
  "--model",
  "--provider",
  "--api-key",
  "--credential",
  "--env",
];
const claudeAuthorityOutputKeys = new Set([
  "ignoreaeosstate",
  "policyauthorized",
]);

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

function sanitizeClaudeJsonValue(
  value: unknown,
  depth = 0,
): JsonValue | undefined {
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
      const sanitized = sanitizeClaudeJsonValue(item, depth + 1);

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
    if (claudeAuthorityOutputKeys.has(canonicalKey(key))) {
      continue;
    }

    const sanitizedItem = sanitizeClaudeJsonValue(item, depth + 1);

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

function isPositiveInteger(value: unknown, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= max;
}

function isClaudeCodeIdentity(
  identity: TaskExecutionWorkerIdentity,
): identity is TaskExecutionClaudeCodeWorkerIdentity {
  return (
    identity.workerFamily === "claude_code" &&
    identity.runtimeKind === "test_worker" &&
    identity.identityAuthority === "system" &&
    identity.selectionAuthority === "system"
  );
}

function validateConfiguration(
  configuration: TaskExecutionClaudeCodeWorkerConfiguration,
): readonly TaskExecutionWorkerIssue[] {
  const issues: TaskExecutionWorkerIssue[] = [];

  if (
    configuration.authority !== "system" ||
    !isClaudeCodeIdentity(configuration.identity) ||
    configuration.executable.authority !== "system" ||
    configuration.executable.executableKind !== "claude_code" ||
    !isSafeReference(configuration.executable.executableRef) ||
    configuration.processPermission.authority !== "system" ||
    configuration.processPermission.requiredPermission !== "process" ||
    !isSafeReference(configuration.processPermission.permissionId) ||
    typeof configuration.processPermission.processExecutionAllowed !==
      "boolean" ||
    typeof configuration.futureProcessCapability !== "boolean" ||
    !isPositiveInteger(configuration.timeoutMs, 600000) ||
    !isPositiveInteger(configuration.stdoutLimitBytes, 65536) ||
    !isPositiveInteger(configuration.stderrLimitBytes, 32768) ||
    (configuration.structuredResultContractRef !== undefined &&
      !isSafeReference(configuration.structuredResultContractRef)) ||
    (configuration.readOnlyCanaryProfile !== undefined &&
      !readOnlyCanaryProfileReady(configuration.readOnlyCanaryProfile)) ||
    (configuration.writeCanaryProfile !== undefined &&
      !writeCanaryProfileReady(configuration.writeCanaryProfile)) ||
    (configuration.readOnlyCanaryProfile !== undefined &&
      configuration.writeCanaryProfile !== undefined)
  ) {
    issues.push(
      issue({
        code: "task_execution_claude_code_worker_configuration_invalid",
        message:
          "Claude Code worker configuration must be bounded, system-owned, and TEST-only.",
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
        configuration.writeCanaryProfile !== undefined
          ? item === "canary/claude-write-canary.txt"
          : isSafeReference(item),
      ))
  ) {
    issues.push(
      issue({
        code: "task_execution_claude_code_worker_workspace_authority_invalid",
        message:
          "Claude Code process cwd must come from bounded system workspace authority.",
        category: "permission",
      }),
    );
  }

  return issues;
}

function readOnlyCanaryProfileReady(
  profile: TaskExecutionClaudeCodeReadOnlyCanaryProfile,
): boolean {
  return (
    profile.authority === "system" &&
    profile.profileId === "claude_code_read_only_canary_v1" &&
    profile.enabled === true &&
    profile.permissionMode === "plan" &&
    Array.isArray(profile.toolSet) &&
    profile.toolSet.length === 1 &&
    profile.toolSet[0] === "Read" &&
    profile.hostCustomizationIsolation === "safe_mode" &&
    profile.strictMcpConfig === true &&
    profile.sessionPersistence === false &&
    profile.repositoryWriteAllowed === false &&
    profile.structuredOutput === "json_schema"
  );
}

function writeCanaryProfileReady(
  profile: TaskExecutionClaudeCodeWriteCanaryProfile,
): boolean {
  return (
    profile.authority === "system" &&
    profile.profileId === "claude_code_write_canary_v1" &&
    profile.enabled === true &&
    profile.permissionMode === "acceptEdits" &&
    Array.isArray(profile.toolSet) &&
    profile.toolSet.length === 2 &&
    profile.toolSet[0] === "Read" &&
    profile.toolSet[1] === "Edit" &&
    profile.hostCustomizationIsolation === "safe_mode" &&
    profile.strictMcpConfig === true &&
    profile.sessionPersistence === false &&
    profile.repositoryWriteAllowed === false &&
    profile.primaryWorkspaceMutationAllowed === false &&
    profile.automaticPatchApplyAllowed === false &&
    profile.shellAllowed === false &&
    profile.structuredOutput === "json_schema" &&
    profile.allowedMutationPath === "canary/claude-write-canary.txt"
  );
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
      code:
        "task_execution_claude_code_worker_task_model_process_claims_rejected",
      message:
        "Task or model Claude Code process claims are rejected; executable, argv, cwd, permissions, MCP, and credentials are system-owned.",
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
        code: "task_execution_claude_code_worker_shell_command_rejected",
        message:
          "Claude Code worker process preparation rejects shell strings and interactive command automation.",
        category: "permission",
      }),
    );
  }

  for (const dangerous of dangerousClaudeArgs) {
    if (serialized.includes(dangerous)) {
      issues.push(
        issue({
          code:
            "task_execution_claude_code_worker_dangerous_flag_rejected",
          message:
            "Claude Code worker process preparation rejects permission bypass flags.",
          category: "permission",
        }),
      );
      break;
    }
  }

  if (
    /credential|api[-_]?key|token|provider|mcp|permission[-_]?mode|bypass|add[-_]?dir|cwd|env/i.test(
      serialized,
    )
  ) {
    issues.push(
      issue({
        code:
          "task_execution_claude_code_worker_authority_override_rejected",
        message:
          "Claude Code worker process preparation rejects credential, provider, MCP, workspace, environment, and authority overrides.",
        category: "permission",
      }),
    );
  }

  return issues;
}

function buildClaudeCodeArgv(
  configuration: TaskExecutionClaudeCodeWorkerConfiguration,
): readonly string[] {
  if (configuration.readOnlyCanaryProfile !== undefined) {
    return [
      "--safe-mode",
      "--strict-mcp-config",
      "--disable-slash-commands",
      "--no-chrome",
      "--no-session-persistence",
      "--permission-mode",
      "plan",
      "--tools",
      "Read",
      "--disallowedTools",
      "Bash,Edit,Write,NotebookEdit,WebFetch,WebSearch,mcp__*",
      "--print",
      "--output-format",
      "json",
      "--json-schema",
      claudeCodeReadOnlyCanarySchema,
    ];
  }

  if (configuration.writeCanaryProfile !== undefined) {
    return [
      "--safe-mode",
      "--strict-mcp-config",
      "--disable-slash-commands",
      "--no-chrome",
      "--no-session-persistence",
      "--permission-mode",
      "acceptEdits",
      "--tools",
      "Read,Edit",
      "--disallowedTools",
      "Bash,Write,NotebookEdit,WebFetch,WebSearch,mcp__*",
      "--print",
      "--output-format",
      "json",
      "--json-schema",
      claudeCodeWriteCanarySchema,
    ];
  }

  return ["--print", "--output-format", "json"];
}

function argvIssues(argv: readonly string[]): readonly TaskExecutionWorkerIssue[] {
  const issues: TaskExecutionWorkerIssue[] = [];

  if (argv.length > 24 || !argv.every((arg) => arg.length > 0 && arg.length <= 4096)) {
    issues.push(
      issue({
        code: "task_execution_claude_code_worker_argv_unbounded",
        message: "Claude Code process argv must remain bounded.",
      }),
    );
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (
      dangerousClaudeArgs.has(arg) ||
      arg.includes("bypassPermissions") ||
      arg.includes("dangerously-skip-permissions")
    ) {
      issues.push(
        issue({
          code:
            "task_execution_claude_code_worker_dangerous_flag_rejected",
          message:
            "Claude Code process argv cannot include permission bypass flags.",
          category: "permission",
        }),
      );
    }

    if (
      (arg === "--permission-mode" &&
        argv[index + 1] !== "plan" &&
        argv[index + 1] !== "acceptEdits") ||
      (arg.startsWith("--permission-mode=") &&
        arg !== "--permission-mode=plan" &&
        arg !== "--permission-mode=acceptEdits")
    ) {
      issues.push(
        issue({
          code:
            "task_execution_claude_code_worker_permission_mode_rejected",
          message:
            "Claude Code process argv can only use the system-owned canary permission modes.",
          category: "permission",
        }),
      );
    }

    if (
      forbiddenArgPrefixes.some(
        (prefix) => arg === prefix || arg.startsWith(`${prefix}=`),
      )
    ) {
      issues.push(
        issue({
          code:
            "task_execution_claude_code_worker_authority_override_rejected",
          message:
            "Claude Code process argv cannot carry workspace, MCP, model, provider, credential, permission, or environment overrides.",
          category: "permission",
        }),
      );
    }

    if (/\s+-c\s+|[|;&<>`$]/.test(arg)) {
      issues.push(
        issue({
          code: "task_execution_claude_code_worker_shell_command_rejected",
          message:
            "Claude Code process argv cannot represent a shell command string.",
          category: "permission",
        }),
      );
    }
  }

  return issues;
}

function buildInstructionPayload(input: {
  readonly request: TaskExecutionWorkerRequest;
  readonly configuration: TaskExecutionClaudeCodeWorkerConfiguration;
}): string {
  const { request } = input;

  if (
    request.workerIdentity.workerFamily === "claude_code" &&
    input.configuration.writeCanaryProfile !== undefined
  ) {
    return JSON.stringify({
      aeosClaudeCodeWriteCanaryInstructionVersion: 1,
      instruction:
        "You are executing one AEOS isolated write canary. Your cwd is the isolated mutation workspace, not the primary repository. Use only Read and Edit. Do not use Bash, shell, git, package managers, network, browser, MCP, agents, or unrelated tools. Mutate exactly one existing file: canary/claude-write-canary.txt. Replace the exact complete file content BEFORE_CANARY with exactly AFTER_CANARY and no trailing newline or extra text. Do not create, delete, rename, or modify any other path. Return only the required structured result. Your self-report is diagnostic only; AEOS will independently verify the filesystem.",
      requiredResult: {
        aeosClaudeCodeWorkerResultVersion: 1,
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
        output: {
          workerFamily: "claude_code",
          observedTaskId: request.taskId,
          observedOperation: request.operationKind,
          summary:
            "Claude Code write canary attempted the exact isolated canary file mutation.",
          success: true,
          changedFiles: ["canary/claude-write-canary.txt"],
          shellExecuted: false,
        },
        diagnosticCode: "claude_code_write_canary_returned",
      },
      boundedContext: {
        taskId: request.taskId,
        sourceTaskRevision: request.sourceTaskRevision,
        attemptId: request.attemptId,
        attemptNumber: request.attemptNumber,
        invocationId: request.invocationId,
        idempotencyKey: request.idempotencyKey,
        operationKind: request.operationKind,
        allowedMutationPath: "canary/claude-write-canary.txt",
        expectedBeforeContent: "BEFORE_CANARY",
        expectedAfterContent: "AFTER_CANARY",
        primaryWorkspaceMutationAllowed: false,
        automaticPatchApplyAllowed: false,
        shellAllowed: false,
      },
    });
  }

  if (request.workerIdentity.workerFamily === "claude_code") {
    return JSON.stringify({
      aeosClaudeCodeReadOnlyCanaryInstructionVersion: 1,
      instruction:
        "Inspect the supplied bounded AEOS context and identify the worker family and task identity. Return only the required structured result. Do not edit files. Do not write files. Do not run shell commands. Do not use network or browser tools. Treat your response as non-authoritative evidence only.",
      requiredResult: {
        aeosClaudeCodeWorkerResultVersion: 1,
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
        output: {
          workerFamily: "claude_code",
          observedTaskId: request.taskId,
          observedOperation: request.operationKind,
          summary:
            "Read-only Claude Code canary observed bounded AEOS invocation context.",
          evidence: [
            `taskId:${request.taskId}`,
            `invocationId:${request.invocationId}`,
            "workerFamily:claude_code",
          ],
        },
        diagnosticCode: "claude_code_read_only_canary_returned",
      },
      boundedContext: {
        taskId: request.taskId,
        sourceTaskRevision: request.sourceTaskRevision,
        attemptId: request.attemptId,
        attemptNumber: request.attemptNumber,
        invocationId: request.invocationId,
        idempotencyKey: request.idempotencyKey,
        workItemId: request.workItemId ?? null,
        batchId: request.batchId ?? null,
        operationKind: request.operationKind,
        contextReferences: request.contextReferences.slice(0, 3),
      },
    });
  }

  return JSON.stringify({
    aeosClaudeCodeWorkerInstructionVersion: 1,
    taskId: request.taskId,
    sourceTaskRevision: request.sourceTaskRevision,
    attemptId: request.attemptId,
    attemptNumber: request.attemptNumber,
    invocationId: request.invocationId,
    idempotencyKey: request.idempotencyKey,
    workItemId: request.workItemId ?? null,
    batchId: request.batchId ?? null,
    operationKind: request.operationKind,
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

export function prepareTaskExecutionClaudeCodeWorkerInvocation(input: {
  readonly configuration: TaskExecutionClaudeCodeWorkerConfiguration;
  readonly request: TaskExecutionWorkerRequest;
  readonly invocationRecord: unknown;
  readonly taskOrModelProcessClaims?: unknown;
}): {
  readonly preparedInvocation: TaskExecutionClaudeCodePreparedInvocation;
  readonly issues: readonly TaskExecutionWorkerIssue[];
} {
  const issues: TaskExecutionWorkerIssue[] = [
    ...validateConfiguration(input.configuration),
    ...taskOrModelClaimIssues(input.taskOrModelProcessClaims),
  ];
  const argv = buildClaudeCodeArgv(input.configuration);
  issues.push(...argvIssues(argv));
  const readOnlyCanaryProfileReadyValue =
    input.configuration.readOnlyCanaryProfile === undefined
      ? false
      : readOnlyCanaryProfileReady(input.configuration.readOnlyCanaryProfile);
  const writeCanaryProfileReadyValue =
    input.configuration.writeCanaryProfile === undefined
      ? false
      : writeCanaryProfileReady(input.configuration.writeCanaryProfile);

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
        code:
          "task_execution_claude_code_worker_invocation_authority_mismatch",
        message:
          "Prepared Claude Code invocation must bind the exact AEOS task, revision, attempt, invocation, idempotency, work item, and batch.",
        category: "conflict",
      }),
    );
  }

  const exactWorkerSelected =
    input.request.workerIdentity.workerId === input.configuration.identity.workerId &&
    input.request.workerIdentity.workerFamily === "claude_code" &&
    input.configuration.identity.workerFamily === "claude_code" &&
    input.request.workerIdentity.runtimeKind === "test_worker";

  if (!exactWorkerSelected) {
    issues.push(
      issue({
        code: "task_execution_claude_code_worker_selection_mismatch",
        message:
          "Claude Code adapter requires exact system-selected Claude Code worker identity.",
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
        code: "task_execution_claude_code_worker_workspace_mismatch",
        message:
          "Claude Code process working directory must match system-owned worker workspace authority.",
        category: "permission",
      }),
    );
  }

  if (!input.configuration.futureProcessCapability) {
    issues.push(
      issue({
        code: "task_execution_claude_code_worker_process_capability_missing",
        message:
          "Future Claude Code process execution requires a system-declared process execution capability.",
        category: "permission",
      }),
    );
  }

  if (!input.configuration.processPermission.processExecutionAllowed) {
    issues.push(
      issue({
        code: "task_execution_claude_code_worker_process_permission_denied",
        message:
          "Prepared Claude Code process requests do not grant permission to run without an explicit process permission.",
        category: "permission",
      }),
    );
  }

  const stdin = buildInstructionPayload({
    request: input.request,
    configuration: input.configuration,
  });

  if (stdin.length > 8192) {
    issues.push(
      issue({
        code: "task_execution_claude_code_worker_instruction_payload_unbounded",
        message: "Claude Code worker instruction payload must remain bounded.",
      }),
    );
  }

  const processRequest: TaskExecutionClaudeCodeProcessRequest = {
    executable: input.configuration.executable,
    argv,
    workingDirectory: input.configuration.workspace,
    stdin,
    timeoutMs: input.configuration.timeoutMs,
    stdoutLimitBytes: input.configuration.stdoutLimitBytes,
    stderrLimitBytes: input.configuration.stderrLimitBytes,
    environment: {
      authority: "system",
      inheritance: readOnlyCanaryProfileReadyValue
        ? "system_claude_code_read_only_canary"
        : writeCanaryProfileReadyValue
          ? "system_claude_code_write_canary"
          : "none",
      variables: [],
    },
  };
  const preparedInvocation: TaskExecutionClaudeCodePreparedInvocation = {
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
      TASK_EXECUTION_CLAUDE_CODE_WORKER_REAL_EXECUTION_ENABLED &&
      issues.every((item) => item.severity !== "error") &&
      exactWorkerSelected &&
      invocationAuthorityBound &&
      workspaceAuthorityBound &&
      input.configuration.futureProcessCapability &&
      input.configuration.processPermission.processExecutionAllowed &&
      input.request.permissionFacts.allowed,
    realExecutionEnabled: TASK_EXECUTION_CLAUDE_CODE_WORKER_REAL_EXECUTION_ENABLED,
    readOnlyCanaryProfileReady: readOnlyCanaryProfileReadyValue,
    writeCanaryProfileReady: writeCanaryProfileReadyValue,
  };

  return {
    preparedInvocation,
    issues,
  };
}

function boundedDiagnostic(value: string, limit: number): string | undefined {
  const trimmed = value.trim();

  if (trimmed.length === 0 || trimmed.length > limit || /(\n\s*at\s+|stack)/i.test(trimmed)) {
    return undefined;
  }

  return trimmed;
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
    message: input.message,
    diagnostic: input.diagnostic,
  };
}

function unavailableFailure(input: {
  readonly request: TaskExecutionWorkerRequest;
  readonly code: string;
  readonly category: TaskExecutionWorkerRawResult["failureCategory"];
  readonly message: string;
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
  // are checked here as Claude Code boundary extensions.
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
    input.value.aeosClaudeCodeWorkerResultVersion !== 1 ||
    !structuredBindingsMatch({ request: input.request, value: input.value })
  ) {
    return {
      rawResult: rawFailure({
        request: input.request,
        code: "task_execution_claude_code_worker_structured_result_invalid",
        category: "invalid_request",
        message:
          "Claude Code process output was not a closed structured result bound to the AEOS invocation.",
      }),
      issues: [
        issue({
          code: "task_execution_claude_code_worker_structured_result_invalid",
          message:
            "Malformed or mismatched Claude Code structured output failed closed.",
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
        code: "task_execution_claude_code_worker_structured_output_oversized",
        category: "invalid_request",
        message:
          "Claude Code structured output exceeded the bounded output limit.",
      }),
      issues: [
        issue({
          code: "task_execution_claude_code_worker_structured_output_oversized",
          message: "Oversized Claude Code structured output was rejected.",
        }),
      ],
    };
  }

  const status = input.value.status;
  const output = sanitizeClaudeJsonValue(input.value.output);
  const metadata = sanitizeClaudeJsonValue(input.value.metadata);

  if (
    status !== "returned" &&
    status !== "failed" &&
    status !== "in_progress" &&
    status !== "unavailable"
  ) {
    return {
      rawResult: rawFailure({
        request: input.request,
        code: "task_execution_claude_code_worker_structured_status_invalid",
        category: "invalid_request",
        message: "Claude Code structured output contained an invalid status.",
      }),
      issues: [
        issue({
          code: "task_execution_claude_code_worker_structured_status_invalid",
          message: "Invalid Claude Code structured status failed closed.",
        }),
      ],
    };
  }

  if (output !== undefined && !isJsonValue(output)) {
    issues.push(
      issue({
        code: "task_execution_claude_code_worker_structured_output_invalid",
        message: "Non-JSON Claude Code output was dropped from worker evidence.",
        severity: "warning",
      }),
    );
  }

  if (metadata !== undefined && !isJsonObject(metadata)) {
    issues.push(
      issue({
        code: "task_execution_claude_code_worker_structured_metadata_invalid",
        message:
          "Non-object Claude Code metadata was dropped from worker evidence.",
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

function extractClaudeCodeStructuredResult(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  if (value.aeosClaudeCodeWorkerResultVersion === 1) {
    return value;
  }

  if (
    value.type === "result" &&
    value.subtype === "success" &&
    value.structured_output !== undefined
  ) {
    return value.structured_output;
  }

  if (
    value.type === "result" &&
    value.subtype === "success" &&
    isRecord(value.result) &&
    value.result.structured_output !== undefined
  ) {
    return value.result.structured_output;
  }

  if (typeof value.result === "string") {
    try {
      return JSON.parse(value.result) as unknown;
    } catch {
      return value;
    }
  }

  if (isRecord(value.result)) {
    return value.result;
  }

  return value;
}

export function normalizeTaskExecutionClaudeCodeProcessRawResult(input: {
  readonly request: TaskExecutionWorkerRequest;
  readonly processResult: TaskExecutionClaudeCodeProcessResult;
  readonly stdoutLimitBytes?: number;
  readonly stderrLimitBytes?: number;
}): {
  readonly rawResult: TaskExecutionWorkerRawResult;
  readonly issues: readonly TaskExecutionWorkerIssue[];
} {
  const stdoutLimitBytes = input.stdoutLimitBytes ?? 8192;
  const stderrLimitBytes = input.stderrLimitBytes ?? 2048;
  const diagnostic = boundedDiagnostic(input.processResult.stderr, stderrLimitBytes);

  if (input.processResult.timedOut || input.processResult.terminationReason === "timeout") {
    return {
      rawResult: unavailableFailure({
        request: input.request,
        code: "task_execution_claude_code_worker_process_timeout",
        category: "timeout",
        message:
          "Claude Code process timed out; this is evidence only and does not authorize completion or retry.",
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
            ? "task_execution_claude_code_worker_process_spawn_failed"
            : input.processResult.terminationReason === "unknown"
              ? "task_execution_claude_code_worker_process_outcome_unknown"
              : "task_execution_claude_code_worker_process_interrupted",
        category: "unknown",
        message:
          "Claude Code process was interrupted; this is evidence only and does not complete work.",
      }),
      issues: [],
    };
  }

  if (input.processResult.stdout.length > stdoutLimitBytes) {
    return {
      rawResult: rawFailure({
        request: input.request,
        code: "task_execution_claude_code_worker_stdout_oversized",
        category: "invalid_request",
        message:
          "Claude Code process stdout exceeded the configured bounded limit.",
        diagnostic,
      }),
      issues: [
        issue({
          code: "task_execution_claude_code_worker_stdout_oversized",
          message: "Oversized Claude Code stdout was rejected.",
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
        code: "task_execution_claude_code_worker_stderr_oversized",
        category: "invalid_request",
        message:
          "Claude Code process stderr exceeded the configured bounded limit.",
        diagnostic,
      }),
      issues: [
        issue({
          code: "task_execution_claude_code_worker_stderr_oversized",
          message: "Oversized Claude Code stderr was rejected.",
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
        code: "task_execution_claude_code_worker_process_nonzero_exit",
        category: "worker_error",
        message:
          "Claude Code process exited nonzero; exit status is not completion authority.",
        diagnostic,
      }),
      issues: [],
    };
  }

  try {
    return structuredResultToRaw({
      request: input.request,
      value: extractClaudeCodeStructuredResult(
        JSON.parse(input.processResult.stdout) as unknown,
      ),
      stdoutLimitBytes,
    });
  } catch {
    return {
      rawResult: rawFailure({
        request: input.request,
        code: "task_execution_claude_code_worker_structured_result_malformed",
        category: "invalid_request",
        message:
          "Claude Code process stdout was not valid structured JSON and failed closed.",
        diagnostic,
      }),
      issues: [
        issue({
          code: "task_execution_claude_code_worker_structured_result_malformed",
          message: "Malformed Claude Code structured output failed closed.",
        }),
      ],
    };
  }
}

export function normalizeTaskExecutionClaudeCodeProcessResult(input: {
  readonly request: TaskExecutionWorkerRequest;
  readonly processResult: TaskExecutionClaudeCodeProcessResult;
  readonly stdoutLimitBytes?: number;
  readonly stderrLimitBytes?: number;
}): TaskExecutionWorkerResult {
  const normalizedRaw = normalizeTaskExecutionClaudeCodeProcessRawResult(input);
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
): TaskExecutionClaudeCodeProcessResult {
  return {
    invocationRef: `test-claude-code-process:${request.invocationId}`,
    terminationReason: "exited",
    exitCode: 0,
    timedOut: false,
    interrupted: false,
    stderr: "",
    stdout: JSON.stringify({
      aeosClaudeCodeWorkerResultVersion: 1,
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
      outputReference: "artifact:claude-code-worker-output",
      patchArtifactReference: "artifact:claude-code-worker-patch",
      changedFileManifestReference: "artifact:claude-code-worker-changed-files",
      testSummaryReference: "artifact:claude-code-worker-tests",
      diagnosticCode: "claude_code_worker_test_process_returned",
    }),
  };
}

export function createTaskExecutionClaudeCodeWorkerAdapter(input: {
  readonly configuration: TaskExecutionClaudeCodeWorkerConfiguration;
  readonly deterministicProcessResult?: TaskExecutionClaudeCodeProcessResult;
}): TaskExecutionClaudeCodeWorkerAdapter {
  let processCalls = 0;

  return {
    claudeCodeAdapterKind: "task_execution_claude_code_worker_adapter",
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
      const normalizedRaw = normalizeTaskExecutionClaudeCodeProcessRawResult({
        request,
        processResult:
          input.deterministicProcessResult ?? successfulProcessResult(request),
        stdoutLimitBytes: input.configuration.stdoutLimitBytes,
        stderrLimitBytes: input.configuration.stderrLimitBytes,
      });

      return normalizedRaw.rawResult;
    },
  };
}

function claudeCodeAdapterFromUnknown(
  worker: unknown,
): TaskExecutionClaudeCodeWorkerAdapter | undefined {
  if (!isRecord(worker)) {
    return undefined;
  }

  if (
    worker.claudeCodeAdapterKind !==
      "task_execution_claude_code_worker_adapter" ||
    typeof worker.processCallCount !== "function" ||
    typeof worker.actualChildProcessCount !== "function" ||
    typeof worker.actualCodexCallCount !== "function" ||
    typeof worker.actualClaudeCodeCallCount !== "function" ||
    typeof worker.cloudCallCount !== "function"
  ) {
    return undefined;
  }

  return worker as unknown as TaskExecutionClaudeCodeWorkerAdapter;
}

export function evaluateTaskExecutionClaudeCodeWorkerProcessGate(
  input: TaskExecutionClaudeCodeWorkerProcessGateInput,
): TaskExecutionClaudeCodeWorkerProcessGateResult {
  const localGate = evaluateTaskExecutionLocalWorkerProcessGate({
    processBoundary: TASK_EXECUTION_CLAUDE_CODE_PROCESS_BOUNDARY,
    expectedWorkerFamily: "claude_code",
    expectedExecutableKind: "claude_code",
    workerFamilyLabel: "Claude Code",
    workerMismatchCode:
      "task_execution_worker_process_gate_worker_not_claude_code",
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
  const authority: TaskExecutionClaudeCodeWorkerProcessAuthority | null =
    localGate.authority === null
      ? null
      : {
          ...localGate.authority,
          boundary: TASK_EXECUTION_CLAUDE_CODE_PROCESS_BOUNDARY,
          workerFamily: "claude_code",
          executableKind: "claude_code",
        };

  return {
    ok: authority !== null,
    decision: authority === null ? "blocked" : localGate.decision,
    readiness: localGate.readiness,
    authority,
    issues: localGate.issues,
    ClaudeCodeProcessContractReady: localGate.ProcessContractReady,
    RealClaudeCodeExecutionEnabled:
      TASK_EXECUTION_CLAUDE_CODE_WORKER_REAL_EXECUTION_ENABLED,
    ExternalProcessAllowed:
      TASK_EXECUTION_CLAUDE_CODE_WORKER_EXTERNAL_PROCESS_ALLOWED,
    ActualCodexCalls: 0,
    ActualClaudeCalls: 0,
    ActualWorkerProcessesSpawned: 0,
    CloudCalls: 0,
  };
}

export function authorizeTaskExecutionClaudeCodeWorkerProcess(
  input: TaskExecutionClaudeCodeWorkerProcessGateInput,
): TaskExecutionClaudeCodeWorkerProcessGateResult {
  return evaluateTaskExecutionClaudeCodeWorkerProcessGate(input);
}

export async function evaluateTaskExecutionClaudeCodeWorkerConformance(
  input: TaskExecutionClaudeCodeWorkerConformanceInput,
): Promise<TaskExecutionClaudeCodeWorkerConformanceResult> {
  const adapter = claudeCodeAdapterFromUnknown(input.worker);
  const prepared = prepareTaskExecutionClaudeCodeWorkerInvocation({
    configuration: input.configuration,
    request: input.request,
    invocationRecord: input.invocationRecord,
    taskOrModelProcessClaims: input.taskOrModelProcessClaims,
  });
  const preflightIssues = [...prepared.issues];

  if (adapter === undefined) {
    preflightIssues.push(
      issue({
        code: "task_execution_claude_code_worker_adapter_invalid",
        message:
          "Claude Code worker must be the concrete local Claude Code adapter boundary.",
      }),
    );
  }

  if (
    adapter !== undefined &&
    adapter.identity.workerId !== input.configuration.identity.workerId
  ) {
    preflightIssues.push(
      issue({
        code: "task_execution_claude_code_worker_adapter_configuration_mismatch",
        message:
          "Claude Code adapter identity must match the supplied configuration.",
        category: "conflict",
      }),
    );
  }

  if (preflightIssues.some((item) => item.severity === "error")) {
    return {
      ok: false,
      claudeCodeWorkerConformant: false,
      preparedInvocation: prepared.preparedInvocation,
      workerConformance: null,
      normalizedResult: null,
      issues: preflightIssues,
      processCallCount: adapter?.processCallCount() ?? 0,
      actualChildProcessCount: 0,
      actualCodexCallCount: 0,
      actualClaudeCodeCallCount: 0,
      cloudCallCount: 0,
      realExecutionEnabled:
        TASK_EXECUTION_CLAUDE_CODE_WORKER_REAL_EXECUTION_ENABLED,
    };
  }

  if (adapter === undefined) {
    return {
      ok: false,
      claudeCodeWorkerConformant: false,
      preparedInvocation: prepared.preparedInvocation,
      workerConformance: null,
      normalizedResult: null,
      issues: preflightIssues,
      processCallCount: 0,
      actualChildProcessCount: 0,
      actualCodexCallCount: 0,
      actualClaudeCodeCallCount: 0,
      cloudCallCount: 0,
      realExecutionEnabled:
        TASK_EXECUTION_CLAUDE_CODE_WORKER_REAL_EXECUTION_ENABLED,
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
  const claudeCodeWorkerConformant =
    workerConformance.testWorkerConformant &&
    workerConformance.workerIdentity?.workerFamily === "claude_code" &&
    workerConformance.workerInvoked &&
    adapter.actualChildProcessCount() === 0 &&
    adapter.actualCodexCallCount() === 0 &&
    adapter.actualClaudeCodeCallCount() === 0 &&
    adapter.cloudCallCount() === 0;

  return {
    ok:
      claudeCodeWorkerConformant &&
      issues.every((item) => item.severity !== "error"),
    claudeCodeWorkerConformant,
    preparedInvocation: prepared.preparedInvocation,
    workerConformance,
    normalizedResult: workerConformance.normalizedResult,
    issues,
    processCallCount: adapter.processCallCount(),
    actualChildProcessCount: adapter.actualChildProcessCount(),
    actualCodexCallCount: adapter.actualCodexCallCount(),
    actualClaudeCodeCallCount: adapter.actualClaudeCodeCallCount(),
    cloudCallCount: adapter.cloudCallCount(),
    realExecutionEnabled:
      TASK_EXECUTION_CLAUDE_CODE_WORKER_REAL_EXECUTION_ENABLED,
  };
}
