import type { AeosError } from "./types.js";
import type { TaskExecutionWorkerIssue } from "./task-execution-worker.js";

// @ts-expect-error Node built-ins are available at runtime; this package does not depend on Node ambient types yet.
import { spawn } from "node:child_process";

export const TASK_EXECUTION_CODEX_AUTH_PREFLIGHT_READY = true;

export type TaskExecutionCodexAuthPreflightStatus =
  | "authenticated"
  | "unauthenticated"
  | "auth_check_unavailable";

export interface TaskExecutionCodexAuthPreflightCommand {
  readonly executablePath: string;
  readonly argv: readonly ["login", "status"];
  readonly timeoutMs: number;
}

export interface TaskExecutionCodexAuthPreflightEvidence {
  readonly exitCode: number | null;
  readonly signal?: string;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
  readonly spawned: boolean;
}

export interface TaskExecutionCodexAuthPreflightResult {
  readonly ok: boolean;
  readonly status: TaskExecutionCodexAuthPreflightStatus;
  readonly authCheckAvailable: boolean;
  readonly authenticated: boolean;
  readonly command: TaskExecutionCodexAuthPreflightCommand;
  readonly issues: readonly TaskExecutionWorkerIssue[];
  readonly safety: {
    readonly modelInvoked: false;
    readonly shellUsed: false;
    readonly arbitraryArgsAccepted: false;
    readonly secretsPersisted: false;
    readonly rawAuthOutputPersisted: false;
  };
}

export interface RunTaskExecutionCodexAuthPreflightInput {
  readonly executablePath: string;
  readonly timeoutMs?: number;
  readonly run?: (
    command: TaskExecutionCodexAuthPreflightCommand,
  ) => Promise<TaskExecutionCodexAuthPreflightEvidence>;
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
  readonly command: TaskExecutionCodexAuthPreflightCommand;
  readonly status: TaskExecutionCodexAuthPreflightStatus;
  readonly authCheckAvailable: boolean;
  readonly authenticated: boolean;
  readonly issues: readonly TaskExecutionWorkerIssue[];
}): TaskExecutionCodexAuthPreflightResult {
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

function parseAuthenticated(stdout: string, exitCode: number | null): boolean | null {
  const normalized = stdout.toLowerCase();

  if (exitCode !== 0) {
    return false;
  }

  if (normalized.includes("logged in") || normalized.includes("authenticated")) {
    return true;
  }

  if (
    normalized.includes("not logged in") ||
    normalized.includes("logged out") ||
    normalized.includes("unauthenticated")
  ) {
    return false;
  }

  return null;
}

async function runBoundedAuthStatusCommand(
  command: TaskExecutionCodexAuthPreflightCommand,
): Promise<TaskExecutionCodexAuthPreflightEvidence> {
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

export async function runTaskExecutionCodexAuthPreflight(
  input: RunTaskExecutionCodexAuthPreflightInput,
): Promise<TaskExecutionCodexAuthPreflightResult> {
  const command: TaskExecutionCodexAuthPreflightCommand = {
    executablePath: input.executablePath,
    argv: ["login", "status"],
    timeoutMs: input.timeoutMs ?? 10000,
  };
  const evidence = await (input.run ?? runBoundedAuthStatusCommand)(command);
  const authenticated = parseAuthenticated(evidence.stdout, evidence.exitCode);

  if (!evidence.spawned || evidence.timedOut || authenticated === null) {
    return safeResult({
      command,
      status: "auth_check_unavailable",
      authCheckAvailable: false,
      authenticated: false,
      issues: [
        issue({
          code: evidence.timedOut
            ? "task_execution_codex_auth_preflight_timeout"
            : "task_execution_codex_auth_preflight_unavailable",
          message:
            "Codex host-runtime authentication preflight could not prove authenticated status before launch authority consumption.",
          category: "permission",
        }),
      ],
    });
  }

  if (authenticated) {
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
    status: "unauthenticated",
    authCheckAvailable: true,
    authenticated: false,
    issues: [
      issue({
        code: "task_execution_codex_auth_preflight_not_authenticated",
        message:
          "Codex host-runtime authentication preflight did not prove an authenticated local login before launch authority consumption.",
        category: "permission",
      }),
    ],
  });
}
