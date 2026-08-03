import {
  createFilesystemGenerationAdapter,
  runInitPipeline,
  validateAeosTask,
} from "@aeos/core";
import type {
  AeosTask,
  InitIssue,
  InitResult,
  InitStage,
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
  init
  init --json
  init --write
  init --write --json
  remember --type <type> --title <title>
  remember --type <type> --title <title> --json
  search <query>
  search <query> [--json]
  project status
  project status --json
  project context
  project context --json
  project validate
  project validate --json
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

const initStages = [
  "project_detection",
  "template_selection",
  "variable_resolution",
  "rendering",
  "file_writing",
  "validation",
] as const satisfies readonly InitStage[];

type InitJsonOutput = {
  readonly ok: boolean;
  readonly mode: "dry_run" | "write";
  readonly writeEnabled: boolean;
  readonly status: "success" | "blocked" | "failure";
  readonly targetRoot: string;
  readonly generatedFiles: readonly {
    readonly path: string;
    readonly status: string;
    readonly summary: string;
    readonly sourcePath?: string;
  }[];
  readonly conflicts: readonly InitIssue[];
  readonly errors: readonly InitIssue[];
  readonly stages?: readonly InitStage[];
  readonly artifacts?: readonly {
    readonly path: string;
    readonly status: string;
    readonly summary: string;
    readonly sourcePath?: string;
  }[];
};

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

type ProjectContextJsonOutput =
  | {
      readonly ok: true;
      readonly root: string;
      readonly project: string;
      readonly contextPresent: boolean;
      readonly agentsPresent: boolean;
      readonly context: string;
    }
  | {
      readonly ok: false;
      readonly reason: "project_root_not_found";
    };

type ProjectValidationStatus = "pass" | "fail" | "warn";

type ProjectValidationCheck = {
  readonly name: string;
  readonly status: ProjectValidationStatus;
  readonly message: string;
};

type ProjectValidationIssue = {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
};

type ProjectValidationResult = {
  readonly status: ProjectValidationStatus;
  readonly root: string | undefined;
  readonly checks: readonly ProjectValidationCheck[];
  readonly issues: readonly ProjectValidationIssue[];
};

type ProjectValidationJsonOutput =
  | {
      readonly ok: true;
      readonly valid: boolean;
      readonly checks: readonly ProjectValidationCheck[];
    }
  | {
      readonly ok: false;
      readonly valid: false;
      readonly reason: "project_root_not_found";
      readonly checks: readonly [];
    };

const projectValidationJsonCheckNames = new Set([
  "project_root",
  "package_metadata",
  "project_context",
  "agents_file",
  "workspace_marker",
]);

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
  readonly package: {
    readonly path: string;
    readonly exists: boolean;
    readonly name: string | undefined;
    readonly version: string | undefined;
  };
  readonly context: {
    readonly path: string;
    readonly exists: boolean;
    readonly projectName: string | undefined;
  };
  readonly agents: {
    readonly path: string;
    readonly exists: boolean;
  };
};

type ProjectRootDetectionResult =
  | {
      readonly ok: true;
      readonly rootPath: string;
      readonly markers: readonly string[];
    }
  | {
      readonly ok: false;
      readonly rootPath: undefined;
      readonly markers: readonly string[];
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

function writeInitJson(value: InitJsonOutput): void {
  writeJsonLine(value);
}

function writeProjectStatusJson(value: ProjectStatusJsonOutput): void {
  writeJsonLine(value);
}

function writeProjectContextJson(value: ProjectContextJsonOutput): void {
  writeJsonLine(value);
}

function writeProjectValidationJson(value: ProjectValidationJsonOutput): void {
  writeJsonLine(value);
}

function getProjectValidationJsonChecks(
  checks: readonly ProjectValidationCheck[],
): readonly ProjectValidationCheck[] {
  return checks.filter((check) => projectValidationJsonCheckNames.has(check.name));
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

function formatValidationStatus(status: ProjectValidationStatus): string {
  return status.toUpperCase();
}

type InitCliMode = "dry_run" | "write";

type InitCliStatus = "success" | "blocked" | "failure";

type InitOutputContext = {
  readonly mode: InitCliMode;
  readonly writeEnabled: boolean;
};

function getInitConflicts(result: InitResult): readonly InitIssue[] {
  return result.errors.filter((issue) => isInitConflictIssue(issue));
}

function isInitConflictIssue(issue: InitIssue): boolean {
  return (
    issue.code.includes("conflict") ||
    issue.code.includes("target_exists") ||
    issue.code.includes("overwrite_disabled") ||
    issue.code.includes("target_is_directory") ||
    issue.code.includes("parent_is_file") ||
    issue.code.includes("target_outside_root") ||
    issue.code.includes("duplicate_target") ||
    issue.code.includes("inspection_failed")
  );
}

function formatInitStatus(
  result: InitResult,
  conflicts: readonly InitIssue[],
): InitCliStatus {
  if (result.ok) {
    return "success";
  }

  return conflicts.length > 0 ? "blocked" : "failure";
}

function printInitResult(result: InitResult, output: InitOutputContext): void {
  const conflicts = getInitConflicts(result);
  const status = formatInitStatus(result, conflicts);

  console.log("AEOS Init");
  console.log("");
  console.log("Mode:");
  console.log(output.mode);
  console.log("");
  console.log("Write enabled:");
  console.log(String(output.writeEnabled));
  console.log("");
  console.log("Target root:");
  console.log(result.projectRoot);
  console.log("");
  console.log("Status:");
  console.log(status);
  console.log("");
  console.log("Stages:");

  for (const stage of initStages) {
    console.log(`- ${stage}`);
  }

  console.log("");
  console.log("Artifacts:");
  console.log(String(result.generatedFiles.length));
  console.log("");
  console.log("Generated files:");

  if (result.generatedFiles.length === 0) {
    console.log("0");
  } else {
    for (const file of result.generatedFiles) {
      console.log(`- ${file.status} ${file.path}`);
    }
  }

  console.log("");
  console.log("Generated files count:");
  console.log(String(result.generatedFiles.length));
  console.log("");
  console.log("Conflicts count:");
  console.log(String(conflicts.length));
  console.log("");
  console.log("Errors count:");
  console.log(String(result.errors.length));

  if (result.errors.length > 0) {
    console.log("");
    console.log("Errors:");

    for (const error of result.errors) {
      const path = error.path === undefined ? "" : ` (${error.path})`;
      console.log(`- ${error.code}: ${error.message}${path}`);
    }
  }
}

function createInitJsonOutput(
  result: InitResult,
  output: InitOutputContext,
): InitJsonOutput {
  const generatedFiles = result.generatedFiles.map((file) => ({
    path: file.path,
    status: file.status,
    summary: file.summary,
    sourcePath: file.sourcePath,
  }));
  const conflicts = getInitConflicts(result);
  const status = formatInitStatus(result, conflicts);

  if (!result.ok) {
    return {
      ok: false,
      mode: output.mode,
      writeEnabled: output.writeEnabled,
      status,
      targetRoot: result.projectRoot,
      generatedFiles,
      conflicts,
      errors: result.errors,
    };
  }

  return {
    ok: true,
    mode: output.mode,
    writeEnabled: output.writeEnabled,
    status,
    targetRoot: result.projectRoot,
    generatedFiles,
    conflicts,
    errors: result.errors,
    stages: initStages,
    artifacts: generatedFiles,
  };
}

function requireInitWriteArtifacts(
  result: InitResult,
  output: InitOutputContext,
): InitResult {
  if (!output.writeEnabled || !result.ok) {
    return result;
  }

  if (result.generatedFiles.some((file) => file.status === "created")) {
    return result;
  }

  const noCreatedFilesIssue: InitIssue =
    result.generatedFiles.length === 0
      ? {
          code: "init_no_writable_artifacts",
          message: "No writable init artifacts are available yet.",
        }
      : {
          code: "init_write_no_created_files",
          message: "Write mode completed without creating generated files.",
        };
  const hasNoCreatedFilesIssue = result.errors.some(
    (issue) => issue.code === noCreatedFilesIssue.code,
  );

  return {
    ...result,
    ok: false,
    errors: hasNoCreatedFilesIssue
      ? result.errors
      : [...result.errors, noCreatedFilesIssue],
  };
}

async function handleInit(args: readonly string[]): Promise<void> {
  const json = args.includes("--json");
  const writeRequested = args.includes("--write");
  const unknownArgs = args.filter((arg) => arg !== "--json" && arg !== "--write");

  if (unknownArgs.length > 0) {
    if (json) {
      writeInitJson({
        ok: false,
        mode: writeRequested ? "write" : "dry_run",
        writeEnabled: writeRequested,
        status: "failure",
        targetRoot: getCwd(),
        generatedFiles: [],
        conflicts: [],
        errors: [
          {
            code: "init_unknown_option",
            message: "Unknown init option.",
          },
        ],
      });
      setExitCode(1);
      return;
    }

    console.error("Error: unknown init option.");
    console.error("Usage: aeos init [--json] [--write]");
    setExitCode(1);
    return;
  }

  const targetRoot = getCwd();
  const output: InitOutputContext = {
    mode: writeRequested ? "write" : "dry_run",
    writeEnabled: writeRequested,
  };

  const result = requireInitWriteArtifacts(await runInitPipeline({
    projectRoot: targetRoot,
    template: {
      templateId: "default",
    },
    variables: {},
  }, undefined, {
    generation: writeRequested
      ? {
          writeMode: "write",
          fileSystemAdapter: createFilesystemGenerationAdapter({ targetRoot }),
        }
      : undefined,
  }), output);

  if (json) {
    writeInitJson(createInitJsonOutput(result, output));
  } else {
    printInitResult(result, output);
  }

  if (!result.ok) {
    setExitCode(1);
  }
}

function buildProjectValidationResult(
  rootResult: ProjectRootDetectionResult,
  metadata: ProjectMetadata | undefined,
): ProjectValidationResult {
  const checks: ProjectValidationCheck[] = [];
  const issues: ProjectValidationIssue[] = [];

  if (!rootResult.ok) {
    checks.push({
      name: "project_root",
      status: "fail",
      message: "Project root could not be detected.",
    });
    issues.push({
      code: rootResult.error.code,
      message: "Project root could not be detected.",
      path: rootResult.error.startPath,
    });

    return {
      status: "fail",
      root: undefined,
      checks,
      issues,
    };
  }

  checks.push({
    name: "project_root",
    status: "pass",
    message: "Project root detected.",
  });

  if (metadata === undefined) {
    checks.push({
      name: "package_metadata",
      status: "fail",
      message: "Project metadata could not be read.",
    });
    issues.push({
      code: "package_metadata_unreadable",
      message: "Project metadata could not be read.",
      path: rootResult.rootPath,
    });

    return {
      status: "fail",
      root: rootResult.rootPath,
      checks,
      issues,
    };
  }

  if (!metadata.package.exists) {
    checks.push({
      name: "package_metadata",
      status: "warn",
      message: "package.json is missing.",
    });
    issues.push({
      code: "package_metadata_missing",
      message: "package.json is missing.",
      path: metadata.package.path,
    });
  } else if (
    metadata.package.name === undefined
  ) {
    checks.push({
      name: "package_metadata",
      status: "fail",
      message: "package.json exists but package name could not be read.",
    });
    issues.push({
      code: "package_metadata_unreadable",
      message: "package.json exists but package name could not be read.",
      path: metadata.package.path,
    });
  } else {
    checks.push({
      name: "package_metadata",
      status: "pass",
      message: "package.json metadata is readable.",
    });
  }

  checks.push({
    name: "project_context",
    status: metadata.hasProjectContext ? "pass" : "fail",
    message: metadata.hasProjectContext
      ? "PROJECT_CONTEXT.md is present."
      : "PROJECT_CONTEXT.md is missing.",
  });
  if (!metadata.hasProjectContext) {
    issues.push({
      code: "missing_project_context",
      message: "PROJECT_CONTEXT.md is missing.",
      path: metadata.context.path,
    });
  }

  checks.push({
    name: "agents_file",
    status: metadata.hasAgents ? "pass" : "fail",
    message: metadata.hasAgents ? "AGENTS.md is present." : "AGENTS.md is missing.",
  });
  if (!metadata.hasAgents) {
    issues.push({
      code: "missing_agents",
      message: "AGENTS.md is missing.",
      path: metadata.agents.path,
    });
  }

  checks.push({
    name: "workspace_marker",
    status: metadata.hasWorkspace ? "pass" : "fail",
    message: metadata.hasWorkspace
      ? "pnpm-workspace.yaml is present."
      : "pnpm-workspace.yaml is missing.",
  });
  if (!metadata.hasWorkspace) {
    issues.push({
      code: "missing_workspace_marker",
      message: "pnpm-workspace.yaml is missing.",
    });
  }

  const consistent =
    metadata.projectRoot === rootResult.rootPath &&
    metadata.hasProjectContext === metadata.context.exists &&
    metadata.hasAgents === metadata.agents.exists;

  checks.push({
    name: "consistency",
    status: consistent ? "pass" : "fail",
    message: consistent
      ? "Project metadata is internally consistent."
      : "Detected root and metadata presence flags are inconsistent.",
  });
  if (!consistent) {
    issues.push({
      code: "project_metadata_inconsistent",
      message: "Detected root and metadata presence flags are inconsistent.",
      path: metadata.projectRoot,
    });
  }

  const hasFailure = checks.some((check) => check.status === "fail");
  const hasWarning = checks.some((check) => check.status === "warn");

  return {
    status: hasFailure ? "fail" : hasWarning ? "warn" : "pass",
    root: metadata.projectRoot,
    checks,
    issues,
  };
}

function printProjectValidationResult(result: ProjectValidationResult): void {
  console.log("Project Validation");
  console.log("");
  console.log(`Status: ${formatValidationStatus(result.status)}`);
  console.log(`Root: ${result.root ?? "unknown"}`);
  console.log("");
  console.log("Checks:");

  for (const check of result.checks) {
    console.log(`${formatValidationStatus(check.status)} ${check.name}`);
  }

  if (result.issues.length === 0) {
    console.log("");
    console.log("Summary: all checks passed");
    return;
  }

  console.log("");
  console.log("Issues:");
  for (const issue of result.issues) {
    const path = issue.path === undefined ? "" : ` (${issue.path})`;
    console.log(`${formatValidationStatus(issue.code === "package_metadata_missing" ? "warn" : "fail")} ${issue.code}: ${issue.message}${path}`);
  }

  console.log("");
  console.log(
    `Summary: ${result.issues.length} issue${result.issues.length === 1 ? "" : "s"} found`,
  );
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

async function handleProjectContext(args: readonly string[]): Promise<void> {
  const json = args.includes("--json");
  const projects = await loadProjectsPackage();
  const rootResult = projects.detectProjectRoot(getCwd());

  if (!rootResult.ok) {
    if (json) {
      writeProjectContextJson({
        ok: false,
        reason: "project_root_not_found",
      });
      setExitCode(1);
      return;
    }

    console.error("Project Context");
    console.error(`Error: ${rootResult.error.code}`);
    console.error(`Path: ${rootResult.error.startPath}`);
    setExitCode(1);
    return;
  }

  const metadata = projects.readProjectMetadata(rootResult.rootPath);
  const projectName =
    metadata.projectName ?? metadata.packageName ?? "unknown";

  if (json) {
    const fs = getFs();
    const context = metadata.hasProjectContext
      ? fs.readFileSync(metadata.context.path, "utf8")
      : "";

    writeProjectContextJson({
      ok: true,
      root: metadata.projectRoot,
      project: projectName,
      contextPresent: metadata.hasProjectContext,
      agentsPresent: metadata.hasAgents,
      context,
    });
    return;
  }

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

async function handleProjectValidate(args: readonly string[]): Promise<void> {
  const json = args.includes("--json");
  const unknownArgs = args.filter((arg) => arg !== "--json");

  if (unknownArgs.length > 0) {
    if (json) {
      writeProjectValidationJson({
        ok: false,
        valid: false,
        reason: "project_root_not_found",
        checks: [],
      });
      setExitCode(1);
      return;
    }

    console.error("Error: unknown project validate option.");
    console.error("Usage: aeos project validate [--json]");
    setExitCode(1);
    return;
  }

  const projects = await loadProjectsPackage();
  const rootResult = projects.detectProjectRoot(getCwd());

  if (!rootResult.ok && json) {
    writeProjectValidationJson({
      ok: false,
      valid: false,
      reason: "project_root_not_found",
      checks: [],
    });
    setExitCode(1);
    return;
  }

  const metadata = rootResult.ok
    ? projects.readProjectMetadata(rootResult.rootPath)
    : undefined;
  const result = buildProjectValidationResult(rootResult, metadata);

  if (json) {
    writeProjectValidationJson({
      ok: true,
      valid: result.status !== "fail",
      checks: getProjectValidationJsonChecks(result.checks),
    });

    if (result.status === "fail") {
      setExitCode(1);
    }

    return;
  }

  printProjectValidationResult(result);

  if (result.status === "fail") {
    setExitCode(1);
  }
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
    await handleProjectContext(args.slice(1));
    return;
  }

  if (args[0] === "validate") {
    await handleProjectValidate(args.slice(1));
    return;
  }

  console.error("Error: unknown project command.");
  console.error("Usage: aeos project status");
  console.error("Usage: aeos project context");
  console.error("Usage: aeos project validate");
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

    case "init":
      void handleInit(args);
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
