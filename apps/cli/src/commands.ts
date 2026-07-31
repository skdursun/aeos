import { validateAeosTask } from "@aeos/core";
import type {
  AeosTask,
  MemoryEntry,
  MemoryType,
  MemoryValidationIssue,
  TaskValidationIssue,
} from "@aeos/core";

import { handleContext } from "./context.js";
import { getFs, setExitCode, writeJsonLine } from "./output.js";
import { handleStatus } from "./status.js";

const versionText = "aeos 0.0.0";

const helpText = `AEOS CLI
Usage:
  aeos <command>
Commands:
  context
  context --compact
  context --json
  status
  status --json
  remember --type <type> --title <title>
  remember --type <type> --title <title> --json
  task validate <path>
  task validate <path> --json
  version
  help`;

const memoryTypes = [
  "bug",
  "decision",
  "pattern",
  "incident",
  "lesson",
  "prompt",
  "benchmark",
  "research",
  "postmortem",
] as const satisfies readonly MemoryType[];

type TaskValidationJsonStatus = "pass" | "fail";

type TaskValidationJsonReason =
  | "missing_task_file_path"
  | "task_file_not_found"
  | "invalid_json"
  | "validation_failed"
  | null;

type TaskValidationJsonOutput = {
  ok: boolean;
  path: string;
  status: TaskValidationJsonStatus;
  issues: readonly TaskValidationIssue[];
  reason: TaskValidationJsonReason;
};

type RememberJsonFailureReason =
  | "missing_title"
  | "missing_type"
  | "invalid_memory_type"
  | "validation_failed";

type RememberJsonOutput =
  | {
      readonly ok: true;
      readonly type: MemoryType;
      readonly title: string;
      readonly tags: readonly string[];
      readonly markdownPrepared: true;
      readonly persisted: false;
    }
  | {
      readonly ok: false;
      readonly reason: RememberJsonFailureReason;
      readonly issues: readonly MemoryValidationIssue[];
    };

type MemoryWriteRequestSuccess = {
  readonly entry: MemoryEntry;
  readonly path: string;
};

type MemoryWriteResultSuccess = {
  readonly content: string;
  readonly path: string;
};

type MemoryPackage = {
  readonly buildMemoryMarkdownEntry: (entry: MemoryEntry) => string;
  readonly createMemoryWriteRequest: (
    entry: MemoryEntry,
    target: {
      readonly rootPath: string;
      readonly collectionPath?: string;
    },
  ) => { readonly ok: true; readonly value: MemoryWriteRequestSuccess } | { readonly ok: false };
  readonly createMemoryWriteResult: (
    request: MemoryWriteRequestSuccess,
  ) => { readonly ok: true; readonly value: MemoryWriteResultSuccess } | { readonly ok: false };
  readonly validateMemoryEntry: (entry: MemoryEntry) => {
    readonly valid: boolean;
    readonly issues: readonly MemoryValidationIssue[];
  };
};

async function loadMemoryPackage(): Promise<MemoryPackage> {
  // @ts-expect-error @aeos/cli loads the existing memory package artifact without metadata changes.
  return import("../../../packages/memory/dist/index.js") as Promise<MemoryPackage>;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatIssue(issue: TaskValidationIssue): string {
  const location = issue.field ?? issue.path;
  return location === undefined
    ? `- ${issue.message}`
    : `- ${location}: ${issue.message}`;
}

function formatMemoryIssue(issue: MemoryValidationIssue): string {
  const location = issue.field ?? issue.path;
  return location === undefined
    ? `- ${issue.message}`
    : `- ${location}: ${issue.message}`;
}

function printTaskValidationFailure(reason?: string): void {
  console.log("Task validation: fail");

  if (reason !== undefined) {
    console.log(`Reason: ${reason}`);
  }
}

function writeTaskValidationJson(
  value: TaskValidationJsonOutput,
): void {
  writeJsonLine(value);
}

function writeRememberJson(value: RememberJsonOutput): void {
  writeJsonLine(value);
}

function validateTaskFile(filePath: string | undefined, json: boolean): void {
  if (filePath === undefined || filePath.trim().length === 0) {
    if (json) {
      writeTaskValidationJson({
        ok: false,
        path: "",
        status: "fail",
        issues: [],
        reason: "missing_task_file_path",
      });
      setExitCode(1);
      return;
    }

    printTaskValidationFailure("missing task file path");
    console.log("Usage: aeos task validate <path>");
    setExitCode(1);
    return;
  }

  const fs = getFs();

  if (!fs.existsSync(filePath)) {
    if (json) {
      writeTaskValidationJson({
        ok: false,
        path: filePath,
        status: "fail",
        issues: [],
        reason: "task_file_not_found",
      });
      setExitCode(1);
      return;
    }

    printTaskValidationFailure("task file not found");
    console.log(`Path: ${filePath}`);
    setExitCode(1);
    return;
  }

  let parsedTask: unknown;

  try {
    parsedTask = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    if (json) {
      writeTaskValidationJson({
        ok: false,
        path: filePath,
        status: "fail",
        issues: [],
        reason: "invalid_json",
      });
      setExitCode(1);
      return;
    }

    printTaskValidationFailure("invalid JSON");
    setExitCode(1);
    return;
  }

  if (!isJsonObject(parsedTask)) {
    const issues: readonly TaskValidationIssue[] = [
      {
        code: "task_json_object_required",
        message: "Task file must contain a JSON object.",
        severity: "error",
      },
    ];

    if (json) {
      writeTaskValidationJson({
        ok: false,
        path: filePath,
        status: "fail",
        issues,
        reason: "validation_failed",
      });
      setExitCode(1);
      return;
    }

    printTaskValidationFailure();
    console.log(formatIssue(issues[0]));
    setExitCode(1);
    return;
  }

  const result = validateAeosTask(parsedTask as unknown as AeosTask);

  if (result.valid) {
    if (json) {
      writeTaskValidationJson({
        ok: true,
        path: filePath,
        status: "pass",
        issues: [],
        reason: null,
      });
      return;
    }

    console.log("Task validation: pass");
    return;
  }

  if (json) {
    writeTaskValidationJson({
      ok: false,
      path: filePath,
      status: "fail",
      issues: result.issues,
      reason: "validation_failed",
    });
    setExitCode(1);
    return;
  }

  printTaskValidationFailure();

  for (const issue of result.issues) {
    console.log(formatIssue(issue));
  }

  setExitCode(1);
}

function printVersion(): void {
  console.log(versionText);
}

function printHelp(): void {
  console.log(helpText);
}

function printRememberFailure(reason?: string): void {
  console.log("Memory: fail");

  if (reason !== undefined) {
    console.log(`Reason: ${reason}`);
  }
}

function isMemoryType(value: string): value is MemoryType {
  return (memoryTypes as readonly string[]).includes(value);
}

function readFlagValue(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);

  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}

function readRepeatedFlagValues(args: readonly string[], flag: string): readonly string[] {
  const values: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === flag && args[index + 1] !== undefined) {
      values.push(args[index + 1]);
    }
  }

  return values;
}

function createRememberEntry(input: {
  readonly type: MemoryType;
  readonly title: string;
  readonly tags: readonly string[];
}): MemoryEntry {
  const now = new Date().toISOString();
  const title = input.title.trim();
  const tags = input.tags
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

  return {
    id: createMemoryId(input.type, title, tags),
    frontmatter: {
      type: input.type,
      title,
      date: now,
      sourceTask: "unknown",
      status: "draft",
      tags,
    },
    summary: title,
    sections: [
      {
        heading: "Details",
        content: title,
        order: 1,
      },
    ],
    redactionStatus: "not_required",
    createdAt: now,
    updatedAt: now,
  };
}

function createMemoryId(
  type: MemoryType,
  title: string,
  tags: readonly string[],
): string {
  const seed = [type, title, ...tags].join("|");
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(31, hash) + seed.charCodeAt(index);
    hash |= 0;
  }

  const slug = title
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const hashSegment = (hash >>> 0).toString(36);

  return `${type}-${slug.length > 0 ? slug : "memory"}-${hashSegment}`;
}

async function handleRemember(args: readonly string[]): Promise<void> {
  const json = args.includes("--json");
  const typeInput = readFlagValue(args, "--type");
  const titleInput = readFlagValue(args, "--title");
  const tags = readRepeatedFlagValues(args, "--tag");

  if (typeInput === undefined || typeInput.trim().length === 0) {
    if (json) {
      writeRememberJson({
        ok: false,
        reason: "missing_type",
        issues: [],
      });
      setExitCode(1);
      return;
    }

    printRememberFailure("missing memory type");
    console.log("Usage: aeos remember --type <type> --title <title>");
    setExitCode(1);
    return;
  }

  if (!isMemoryType(typeInput)) {
    if (json) {
      writeRememberJson({
        ok: false,
        reason: "invalid_memory_type",
        issues: [],
      });
      setExitCode(1);
      return;
    }

    printRememberFailure("invalid memory type");
    console.log(`Type: ${typeInput}`);
    setExitCode(1);
    return;
  }

  if (titleInput === undefined || titleInput.trim().length === 0) {
    if (json) {
      writeRememberJson({
        ok: false,
        reason: "missing_title",
        issues: [],
      });
      setExitCode(1);
      return;
    }

    printRememberFailure("missing memory title");
    console.log("Usage: aeos remember --type <type> --title <title>");
    setExitCode(1);
    return;
  }

  const entry = createRememberEntry({
    type: typeInput,
    title: titleInput,
    tags,
  });
  const memory = await loadMemoryPackage();
  const validation = memory.validateMemoryEntry(entry);

  if (!validation.valid) {
    if (json) {
      writeRememberJson({
        ok: false,
        reason: "validation_failed",
        issues: validation.issues,
      });
      setExitCode(1);
      return;
    }

    printRememberFailure();

    for (const issue of validation.issues) {
      console.log(formatMemoryIssue(issue));
    }

    setExitCode(1);
    return;
  }

  const content = memory.buildMemoryMarkdownEntry(entry);
  const writeRequest = memory.createMemoryWriteRequest(entry, {
    rootPath: "brain",
    collectionPath: entry.frontmatter.type,
  });

  if (!writeRequest.ok) {
    if (json) {
      writeRememberJson({
        ok: false,
        reason: "validation_failed",
        issues: [],
      });
      setExitCode(2);
      return;
    }

    console.error("Error: failed to prepare memory write request.");
    setExitCode(2);
    return;
  }

  const writeResult = memory.createMemoryWriteResult(writeRequest.value);

  if (!writeResult.ok) {
    if (json) {
      writeRememberJson({
        ok: false,
        reason: "validation_failed",
        issues: [],
      });
      setExitCode(2);
      return;
    }

    console.error("Error: failed to prepare memory write result.");
    setExitCode(2);
    return;
  }

  if (writeResult.value.content !== content) {
    if (json) {
      writeRememberJson({
        ok: false,
        reason: "validation_failed",
        issues: [],
      });
      setExitCode(2);
      return;
    }

    console.error("Error: memory content preparation mismatch.");
    setExitCode(2);
    return;
  }

  if (json) {
    writeRememberJson({
      ok: true,
      type: entry.frontmatter.type,
      title: entry.frontmatter.title,
      tags: entry.frontmatter.tags,
      markdownPrepared: true,
      persisted: false,
    });
    return;
  }

  console.log("Memory: prepared");
  console.log(`Type: ${entry.frontmatter.type}`);
  console.log(`Title: ${entry.frontmatter.title}`);
  console.log(`Path: ${writeResult.value.path}`);
  console.log(`Status: ${entry.frontmatter.status}`);
}

function handleTask(args: readonly string[]): void {
  if (args[0] !== "validate") {
    console.error("Error: unknown task command.");
    console.error("Usage: aeos task validate <path>");
    setExitCode(1);
    return;
  }

  const validateArgs = args.slice(1);
  const json = validateArgs.includes("--json");
  const filePath = validateArgs.find((arg) => arg !== "--json");

  validateTaskFile(filePath, json);
}

function handleUnknownCommand(command: string): void {
  console.error(`Error: unknown command '${command}'`);
  console.error("Run 'aeos help' for usage.");
  setExitCode(1);
}

export function main(argv: readonly string[]): void {
  const command = argv[2] ?? "help";
  const args = argv.slice(3);

  switch (command) {
    case "context":
      handleContext(args);
      break;

    case "status":
      handleStatus(args);
      break;

    case "remember":
      void handleRemember(args);
      break;

    case "task":
      handleTask(args);
      break;

    case "--version":
    case "version":
      printVersion();
      break;

    case "--help":
    case "help":
      printHelp();
      break;

    default:
      handleUnknownCommand(command);
      break;
  }
}
