import { validateAeosTask } from "@aeos/core";
import type {
  AeosTask,
  MemoryEntry,
  MemorySearchResult,
  MemoryType,
  MemoryValidationIssue,
  TaskValidationIssue,
} from "@aeos/core";

import { handleContext } from "./context.js";
import { getCwd, getFs, setExitCode, writeJsonLine } from "./output.js";
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
  search <query>
  search <query> [--json]
  project status
  project status --json
  project context
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
  | "validation_failed"
  | "filesystem_failed";

type RememberJsonOutput =
  | {
      readonly ok: true;
      readonly type: MemoryType;
      readonly title: string;
      readonly path: string;
      readonly persisted: true;
    }
  | {
      readonly ok: false;
      readonly reason: RememberJsonFailureReason;
      readonly persisted: false;
      readonly issues: readonly MemoryValidationIssue[];
    };

type SearchJsonOutput =
  | {
      readonly ok: true;
      readonly query: string;
      readonly count: number;
      readonly results: readonly {
        readonly id: string;
        readonly title: string;
        readonly type: MemoryType;
        readonly tags: readonly string[];
        readonly score: number;
        readonly path?: string;
        readonly excerpt?: string;
      }[];
    }
  | {
      readonly ok: false;
      readonly reason: "missing_query" | "invalid_memory_type";
    };

type ProjectStatusJsonOutput =
  | {
      readonly ok: true;
      readonly root: string;
      readonly packageName: string;
      readonly version: string;
      readonly projectContextPresent: boolean;
      readonly agentsPresent: boolean;
      readonly workspacePresent: boolean;
    }
  | {
      readonly ok: false;
      readonly reason: "project_root_not_found";
    };

type MemoryWriteRequestSuccess = {
  readonly entry: MemoryEntry;
  readonly path: string;
};

type MemoryWriteResultSuccess = {
  readonly content: string;
  readonly path: string;
};

type MemoryStorageTarget = {
  readonly rootPath: string;
  readonly collectionPath?: string;
};

type ProjectMetadata = {
  readonly projectRoot: string;
  readonly projectName: string | undefined;
  readonly packageName: string | undefined;
  readonly packageVersion: string | undefined;
  readonly hasProjectContext: boolean;
  readonly hasAgents: boolean;
  readonly hasWorkspace: boolean;
  readonly context: {
    readonly path: string;
    readonly exists: boolean;
    readonly projectName: string | undefined;
  };
};

type ProjectRootDetectionResult =
  | {
      readonly ok: true;
      readonly rootPath: string;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: string;
        readonly startPath: string;
      };
    };

type ProjectsPackage = {
  readonly detectProjectRoot: (startPath: string) => ProjectRootDetectionResult;
  readonly readProjectMetadata: (projectRoot: string) => ProjectMetadata;
};

type MemoryPackage = {
  readonly buildMemoryMarkdownEntry: (entry: MemoryEntry) => string;
  readonly createMemorySearchIndex: (
    entries?: readonly MemoryEntry[],
  ) => unknown;
  readonly createMemoryStorageTarget: (
    rootPath: string,
    collectionPath?: string,
  ) => MemoryStorageTarget;
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
  readonly loadMemoryEntriesFromStorage: (
    rootPath: string,
  ) => Promise<readonly MemoryEntry[]>;
  readonly searchMemoryEntries: (
    index: unknown,
    query: {
      readonly query: string;
      readonly filter?: {
        readonly types?: readonly MemoryType[];
        readonly tags?: readonly string[];
      };
    },
  ) => readonly MemorySearchResult[];
  readonly validateMemoryEntry: (entry: MemoryEntry) => {
    readonly valid: boolean;
    readonly issues: readonly MemoryValidationIssue[];
  };
  readonly writeMemoryFile: (request: {
    readonly target: MemoryStorageTarget;
    readonly path: string;
    readonly content: string;
    readonly createParentDirectory?: boolean;
  }) => Promise<
    | { readonly ok: true; readonly value: { readonly path: string } }
    | {
        readonly ok: false;
        readonly error: { readonly code: string; readonly message: string };
      }
  >;
};

async function loadMemoryPackage(): Promise<MemoryPackage> {
  // @ts-expect-error @aeos/cli loads the existing memory package artifact without metadata changes.
  return import("../../../packages/memory/dist/index.js") as Promise<MemoryPackage>;
}

async function loadProjectsPackage(): Promise<ProjectsPackage> {
  // @ts-ignore @aeos/cli loads the existing projects package artifact without metadata changes.
  return import("../../../packages/projects/dist/index.js") as Promise<ProjectsPackage>;
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

function writeSearchJson(value: SearchJsonOutput): void {
  writeJsonLine(value);
}

function writeProjectStatusJson(value: ProjectStatusJsonOutput): void {
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

function printSearchFailure(reason?: string): void {
  console.log("Search Results");

  if (reason !== undefined) {
    console.log(`Reason: ${reason}`);
  }
}

function formatPresence(present: boolean): "present" | "missing" {
  return present ? "present" : "missing";
}

async function handleProjectStatus(args: readonly string[]): Promise<void> {
  const json = args.includes("--json");
  const projects = await loadProjectsPackage();
  const rootResult = projects.detectProjectRoot(getCwd());

  if (!rootResult.ok) {
    if (json) {
      writeProjectStatusJson({
        ok: false,
        reason: "project_root_not_found",
      });
      setExitCode(1);
      return;
    }

    console.error("Project Status");
    console.error(`Error: ${rootResult.error.code}`);
    console.error(`Path: ${rootResult.error.startPath}`);
    setExitCode(1);
    return;
  }

  const metadata = projects.readProjectMetadata(rootResult.rootPath);

  if (json) {
    writeProjectStatusJson({
      ok: true,
      root: metadata.projectRoot,
      packageName: metadata.packageName ?? "",
      version: metadata.packageVersion ?? "",
      projectContextPresent: metadata.hasProjectContext,
      agentsPresent: metadata.hasAgents,
      workspacePresent: metadata.hasWorkspace,
    });
    return;
  }

  console.log("Project Status");
  console.log("");
  console.log("Root:");
  console.log(metadata.projectRoot);
  console.log("");
  console.log("Package:");
  console.log(metadata.packageName ?? "unknown");
  console.log("");
  console.log("Version:");
  console.log(metadata.packageVersion ?? "unknown");
  console.log("");
  console.log("Project Context:");
  console.log(formatPresence(metadata.hasProjectContext));
  console.log("");
  console.log("Agents:");
  console.log(formatPresence(metadata.hasAgents));
  console.log("");
  console.log("Workspace:");
  console.log(formatPresence(metadata.hasWorkspace));
}

async function handleProjectContext(): Promise<void> {
  const projects = await loadProjectsPackage();
  const rootResult = projects.detectProjectRoot(getCwd());

  if (!rootResult.ok) {
    console.error("Project Context");
    console.error(`Error: ${rootResult.error.code}`);
    console.error(`Path: ${rootResult.error.startPath}`);
    setExitCode(1);
    return;
  }

  const metadata = projects.readProjectMetadata(rootResult.rootPath);
  const projectName =
    metadata.projectName ?? metadata.packageName ?? "unknown";

  console.log("Project Context");
  console.log("");
  console.log("Root:");
  console.log(metadata.projectRoot);
  console.log("");
  console.log("Project:");
  console.log(projectName);
  console.log("");
  console.log("Context:");
  console.log(formatPresence(metadata.hasProjectContext));
  console.log("");
  console.log("Agents:");
  console.log(formatPresence(metadata.hasAgents));
  console.log("");
  console.log("Current Context:");
  console.log(
    metadata.hasProjectContext
      ? `Project context for ${projectName}.`
      : "missing",
  );
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

function readSearchQuery(args: readonly string[]): string | undefined {
  const flagsWithValues = new Set(["--type", "--tag"]);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (flagsWithValues.has(arg)) {
      index += 1;
      continue;
    }

    if (!arg.startsWith("--")) {
      return arg;
    }
  }

  return undefined;
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
        persisted: false,
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
        persisted: false,
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
        persisted: false,
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
        persisted: false,
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
    rootPath: ".aeos/memory",
    collectionPath: entry.frontmatter.type,
  });

  if (!writeRequest.ok) {
    if (json) {
      writeRememberJson({
        ok: false,
        reason: "validation_failed",
        persisted: false,
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
        persisted: false,
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
        persisted: false,
        issues: [],
      });
      setExitCode(2);
      return;
    }

    console.error("Error: memory content preparation mismatch.");
    setExitCode(2);
    return;
  }

  const fileWriteResult = await memory.writeMemoryFile({
    target: memory.createMemoryStorageTarget(".aeos/memory"),
    path: writeResult.value.path.slice(".aeos/memory/".length),
    content: writeResult.value.content,
    createParentDirectory: true,
  });

  if (!fileWriteResult.ok) {
    if (json) {
      writeRememberJson({
        ok: false,
        reason: "filesystem_failed",
        persisted: false,
        issues: [],
      });
      setExitCode(2);
      return;
    }

    console.error(
      `Error: ${fileWriteResult.error.message} (${fileWriteResult.error.code})`,
    );
    setExitCode(2);
    return;
  }

  if (json) {
    writeRememberJson({
      ok: true,
      type: entry.frontmatter.type,
      title: entry.frontmatter.title,
      path: writeResult.value.path,
      persisted: true,
    });
    return;
  }

  console.log("Memory: prepared");
  console.log(`Type: ${entry.frontmatter.type}`);
  console.log(`Title: ${entry.frontmatter.title}`);
  console.log(`Path: ${writeResult.value.path}`);
  console.log(`Status: ${entry.frontmatter.status}`);
}

async function handleSearch(args: readonly string[]): Promise<void> {
  const json = args.includes("--json");
  const queryInput = readSearchQuery(args);
  const typeInput = readFlagValue(args, "--type");
  const tags = readRepeatedFlagValues(args, "--tag")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

  if (queryInput === undefined || queryInput.trim().length === 0) {
    if (json) {
      writeSearchJson({
        ok: false,
        reason: "missing_query",
      });
      setExitCode(1);
      return;
    }

    printSearchFailure("missing query");
    console.log('Usage: aeos search "query"');
    setExitCode(1);
    return;
  }

  if (typeInput !== undefined && !isMemoryType(typeInput)) {
    if (json) {
      writeSearchJson({
        ok: false,
        reason: "invalid_memory_type",
      });
      setExitCode(1);
      return;
    }

    printSearchFailure("invalid memory type");
    console.log(`Type: ${typeInput}`);
    setExitCode(1);
    return;
  }

  const memory = await loadMemoryPackage();
  const entries = await memory.loadMemoryEntriesFromStorage(".aeos/memory");
  const index = memory.createMemorySearchIndex(entries);
  const filter =
    typeInput === undefined && tags.length === 0
      ? undefined
      : {
          ...(typeInput === undefined ? {} : { types: [typeInput] }),
          ...(tags.length === 0 ? {} : { tags }),
        };
  const results = memory.searchMemoryEntries(index, {
    query: queryInput.trim(),
    filter,
  });

  if (json) {
    writeSearchJson({
      ok: true,
      query: queryInput.trim(),
      count: results.length,
      results: results.map((result) => ({
        id: result.entry.id,
        title: result.entry.frontmatter.title,
        type: result.entry.frontmatter.type,
        tags: result.entry.frontmatter.tags,
        score: result.score,
        path: result.entry.path,
        excerpt: result.excerpt,
      })),
    });
    return;
  }

  console.log("Search Results");
  console.log(`Query: ${queryInput.trim()}`);
  console.log(`Matches: ${results.length}`);

  if (results.length === 0) {
    return;
  }

  console.log("");

  for (const result of results) {
    console.log(
      `${result.rank ?? 0}. ${result.entry.frontmatter.title}`,
    );
    console.log(`Type: ${result.entry.frontmatter.type}`);

    if (result.entry.frontmatter.tags.length > 0) {
      console.log(`Tags: ${result.entry.frontmatter.tags.join(", ")}`);
    }

    if (result.entry.path !== undefined) {
      console.log(`Path: ${result.entry.path}`);
    }

    if (result.excerpt !== undefined) {
      console.log(`Excerpt: ${result.excerpt}`);
    }
  }
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

async function handleProject(args: readonly string[]): Promise<void> {
  if (args[0] === "status") {
    await handleProjectStatus(args.slice(1));
    return;
  }

  if (args[0] === "context") {
    await handleProjectContext();
    return;
  }

  console.error("Error: unknown project command.");
  console.error("Usage: aeos project status");
  console.error("Usage: aeos project context");
  setExitCode(1);
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

    case "search":
      void handleSearch(args);
      break;

    case "project":
      void handleProject(args);
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
