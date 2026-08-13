import type { AeosError } from "./types.js";
import type { TaskExecutionWorkerIssue } from "./task-execution-worker.js";

// @ts-expect-error Node built-ins are available at runtime; this package does not depend on Node ambient types yet.
import { spawn } from "node:child_process";

export const TASK_EXECUTION_CLAUDE_CODE_AUTH_PREFLIGHT_READY = true;

export type TaskExecutionClaudeCodeAuthPreflightStatus =
  | "authenticated"
  | "unauthenticated"
  | "auth_check_unavailable";

export interface TaskExecutionClaudeCodeAuthPreflightCommand {
  readonly executablePath: string;
  readonly argv: readonly ["auth", "status"];
  readonly timeoutMs: number;
}

export interface TaskExecutionClaudeCodeAuthPreflightEvidence {
  readonly exitCode: number | null;
  readonly signal?: string;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
  readonly spawned: boolean;
}

export interface TaskExecutionClaudeCodeAuthPreflightResult {
  readonly ok: boolean;
  readonly status: TaskExecutionClaudeCodeAuthPreflightStatus;
  readonly authCheckAvailable: boolean;
  readonly authenticated: boolean;
  readonly command: TaskExecutionClaudeCodeAuthPreflightCommand;
  readonly issues: readonly TaskExecutionWorkerIssue[];
  readonly safety: {
    readonly modelInvoked: false;
    readonly shellUsed: false;
    readonly arbitraryArgsAccepted: false;
    readonly secretsPersisted: false;
    readonly rawAuthOutputPersisted: false;
  };
}

export interface RunTaskExecutionClaudeCodeAuthPreflightInput {
  readonly executablePath: string;
  readonly timeoutMs?: number;
  readonly run?: (
    command: TaskExecutionClaudeCodeAuthPreflightCommand,
  ) => Promise<TaskExecutionClaudeCodeAuthPreflightEvidence>;
}

function issue(input: {
  readonly code: string;
  readonly message: string;
  readonly category?: AeosError["category"];
}): TaskExecutionWorkerIssue {
  return {
    code: input.code,
    message: input.message,
    severity: "error",
    category: input.category ?? "validation",
  };
}

function safeResult(input: {
  readonly command: TaskExecutionClaudeCodeAuthPreflightCommand;
  readonly status: TaskExecutionClaudeCodeAuthPreflightStatus;
  readonly authCheckAvailable: boolean;
  readonly authenticated: boolean;
  readonly issues: readonly TaskExecutionWorkerIssue[];
}): TaskExecutionClaudeCodeAuthPreflightResult {
  return {
    ok: input.authCheckAvailable && input.authenticated,
    status: input.status,
    authCheckAvailable: input.authCheckAvailable,
    authenticated: input.authenticated,
    command: input.command,
    issues: input.issues,
    safety: {
      modelInvoked: false,
      shellUsed: false,
      arbitraryArgsAccepted: false,
      secretsPersisted: false,
      rawAuthOutputPersisted: false,
    },
  };
}

function parseLoggedIn(stdout: string): boolean | null {
  try {
    const parsed = JSON.parse(stdout) as unknown;

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "loggedIn" in parsed &&
      typeof (parsed as { readonly loggedIn?: unknown }).loggedIn === "boolean"
    ) {
      return (parsed as { readonly loggedIn: boolean }).loggedIn;
    }
  } catch {
    return null;
  }

  return null;
}

async function runBoundedAuthStatusCommand(
  command: TaskExecutionClaudeCodeAuthPreflightCommand,
): Promise<TaskExecutionClaudeCodeAuthPreflightEvidence> {
  return await new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    const child = spawn(command.executablePath, command.argv, {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
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

export async function runTaskExecutionClaudeCodeAuthPreflight(
  input: RunTaskExecutionClaudeCodeAuthPreflightInput,
): Promise<TaskExecutionClaudeCodeAuthPreflightResult> {
  const command: TaskExecutionClaudeCodeAuthPreflightCommand = {
    executablePath: input.executablePath,
    argv: ["auth", "status"],
    timeoutMs: input.timeoutMs ?? 10000,
  };
  const evidence = await (input.run ?? runBoundedAuthStatusCommand)(command);
  const loggedIn = parseLoggedIn(evidence.stdout);

  if (!evidence.spawned || evidence.timedOut) {
    return safeResult({
      command,
      status: "auth_check_unavailable",
      authCheckAvailable: false,
      authenticated: false,
      issues: [
        issue({
          code: evidence.timedOut
            ? "task_execution_claude_code_auth_preflight_timeout"
            : "task_execution_claude_code_auth_preflight_unavailable",
          message:
            "Claude Code host-runtime authentication preflight could not complete before launch authority consumption.",
          category: "permission",
        }),
      ],
    });
  }

  if (loggedIn === true) {
    return safeResult({
      command,
      status: "authenticated",
      authCheckAvailable: true,
      authenticated: true,
      issues: [],
    });
  }

  return safeResult({
    command,
    status: loggedIn === false ? "unauthenticated" : "auth_check_unavailable",
    authCheckAvailable: loggedIn !== null,
    authenticated: false,
    issues: [
      issue({
        code:
          loggedIn === false
            ? "task_execution_claude_code_auth_preflight_not_authenticated"
            : "task_execution_claude_code_auth_preflight_invalid_result",
        message:
          "Claude Code host-runtime authentication preflight did not prove loggedIn=true before launch authority consumption.",
        category: "permission",
      }),
    ],
  });
}
