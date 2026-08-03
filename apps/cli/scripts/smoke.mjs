import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(new URL("../dist/index.js", import.meta.url));
const projectRoot = fileURLToPath(new URL("../../..", import.meta.url));

function runCli(args) {
  return runCliFrom(projectRoot, args);
}

function runCliFrom(cwd, args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
  });
}

function fail(message, result) {
  console.error(`Smoke failed: ${message}`);

  if (result) {
    console.error(`exit: ${result.status}`);
    console.error(`stdout: ${result.stdout.trim()}`);
    console.error(`stderr: ${result.stderr.trim()}`);
  }

  process.exit(1);
}

function outputOf(result) {
  return `${result.stdout}${result.stderr}`;
}

function expectExitCode(message, result, expectedStatus) {
  if (result.status !== expectedStatus) {
    fail(message, result);
  }
}

function expectNonzero(message, result) {
  if (result.status === 0) {
    fail(message, result);
  }
}

function expectOutputIncludes(message, result, expectedText) {
  if (!outputOf(result).includes(expectedText)) {
    fail(message, result);
  }
}

function expectOutputExcludes(message, result, unexpectedText) {
  if (outputOf(result).includes(unexpectedText)) {
    fail(message, result);
  }
}

function expectBooleanProperty(message, value, propertyName) {
  if (typeof value[propertyName] !== "boolean") {
    fail(message);
  }
}

function parseJsonStdout(message, result) {
  if (result.stderr.trim().length > 0) {
    fail(`${message}: stderr was not empty`, result);
  }

  try {
    return JSON.parse(result.stdout);
  } catch {
    fail(message, result);
  }
}

function parseJsonOnlyStdout(message, result) {
  const trimmedStdout = result.stdout.trim();

  if (trimmedStdout.length === 0 || trimmedStdout.split("\n").length !== 1) {
    fail(`${message}: stdout was not exactly one JSON line`, result);
  }

  return parseJsonStdout(message, result);
}

function expectEmptyArray(message, value) {
  if (!Array.isArray(value) || value.length !== 0) {
    fail(message);
  }
}

function expectIssueCode(message, issues, code, result) {
  if (
    !Array.isArray(issues) ||
    !issues.some((issue) => issue.code === code)
  ) {
    fail(message, result);
  }
}

function expectInitJsonShape(message, value) {
  if (
    typeof value !== "object" ||
    value === null ||
    typeof value.ok !== "boolean" ||
    !["dry_run", "write"].includes(value.mode) ||
    typeof value.writeEnabled !== "boolean" ||
    !["success", "blocked", "failure"].includes(value.status) ||
    typeof value.targetRoot !== "string" ||
    value.targetRoot.length === 0 ||
    !Array.isArray(value.generatedFiles) ||
    !Array.isArray(value.conflicts) ||
    !Array.isArray(value.errors)
  ) {
    fail(message);
  }

  if (value.ok) {
    if (
      value.status !== "success" ||
      !Array.isArray(value.stages) ||
      !Array.isArray(value.artifacts)
    ) {
      fail(message);
    }
    return;
  }

  if (!["blocked", "failure"].includes(value.status)) {
    fail(message);
  }
}

function expectInitWriteJsonShape(message, value) {
  expectInitJsonShape(message, value);

  if (value.mode !== "write" || value.writeEnabled !== true) {
    fail(message);
  }
}

function listMemoryFiles() {
  const memoryRoot = join(projectRoot, ".aeos", "memory");

  if (!existsSync(memoryRoot)) {
    return [];
  }

  const files = [];
  const pending = [memoryRoot];

  while (pending.length > 0) {
    const currentPath = pending.pop();

    for (const entry of readdirSync(currentPath, { withFileTypes: true })) {
      const entryPath = join(currentPath, entry.name);

      if (entry.isDirectory()) {
        pending.push(entryPath);
      } else if (entry.isFile()) {
        files.push(entryPath);
      }
    }
  }

  return files.sort();
}

function listRelativeFiles(rootPath) {
  if (!existsSync(rootPath)) {
    return [];
  }

  const files = [];
  const pending = [rootPath];

  while (pending.length > 0) {
    const currentPath = pending.pop();

    for (const entry of readdirSync(currentPath, { withFileTypes: true })) {
      const entryPath = join(currentPath, entry.name);

      if (entry.isDirectory()) {
        pending.push(entryPath);
      } else if (entry.isFile()) {
        files.push(entryPath.slice(rootPath.length + 1));
      }
    }
  }

  return files.sort();
}

function expectSameFiles(message, before, after) {
  if (
    before.length !== after.length ||
    after.some((path, index) => path !== before[index])
  ) {
    fail(message);
  }
}

function extractRememberPath(result) {
  const pathLine = result.stdout
    .split("\n")
    .find((line) => line.startsWith("Path: "));

  if (pathLine === undefined) {
    fail('remember output did not include "Path: "', result);
  }

  return pathLine.slice("Path: ".length);
}

function rememberPathToAbsolute(memoryPath) {
  const absolutePath = resolve(projectRoot, memoryPath);
  const memoryRoot = resolve(projectRoot, ".aeos", "memory");

  if (!absolutePath.startsWith(`${memoryRoot}/`)) {
    fail(`remember path was outside .aeos/memory: ${memoryPath}`);
  }

  return absolutePath;
}

function expectProjectValidationCheckShape(message, check) {
  if (
    typeof check.name !== "string" ||
    check.name.length === 0 ||
    !["pass", "warn", "fail"].includes(check.status) ||
    typeof check.message !== "string" ||
    check.message.length === 0
  ) {
    fail(message);
  }
}

const smokeRunId = String(Date.now());
const createdMemoryPaths = new Set();

process.once("exit", () => {
  for (const path of createdMemoryPaths) {
    if (existsSync(path)) {
      unlinkSync(path);
    }
  }
});

const version = runCli(["--version"]);
expectExitCode("--version exited nonzero", version, 0);
expectOutputIncludes('--version output did not include "aeos"', version, "aeos");

const versionCommand = runCli(["version"]);
expectExitCode("version exited nonzero", versionCommand, 0);
expectOutputIncludes('version output did not include "aeos"', versionCommand, "aeos");

const help = runCli(["--help"]);
expectExitCode("--help exited nonzero", help, 0);
expectOutputIncludes('--help output did not include "AEOS CLI"', help, "AEOS CLI");

const helpCommand = runCli(["help"]);
expectExitCode("help exited nonzero", helpCommand, 0);
expectOutputIncludes('help output did not include "AEOS CLI"', helpCommand, "AEOS CLI");
expectOutputIncludes('help output did not include "search <query>"', helpCommand, "search <query>");
expectOutputIncludes(
  'help output did not include "search <query> [--json]"',
  helpCommand,
  "search <query> [--json]",
);
expectOutputIncludes(
  'help output did not include "project status --json"',
  helpCommand,
  "project status --json",
);
expectOutputIncludes(
  'help output did not include "project context"',
  helpCommand,
  "project context",
);
expectOutputIncludes(
  'help output did not include "project context --json"',
  helpCommand,
  "project context --json",
);
expectOutputIncludes(
  'help output did not include "project validate"',
  helpCommand,
  "project validate",
);
expectOutputIncludes(
  'help output did not include "project validate --json"',
  helpCommand,
  "project validate --json",
);
expectOutputIncludes(
  'help output did not include "init"',
  helpCommand,
  "init",
);
expectOutputIncludes(
  'help output did not include "init --json"',
  helpCommand,
  "init --json",
);
expectOutputIncludes(
  'help output did not include "init --write"',
  helpCommand,
  "init --write",
);
expectOutputIncludes(
  'help output did not include "init --write --json"',
  helpCommand,
  "init --write --json",
);
for (const unsupportedInitHelpText of [
  "--force",
  "--target-root",
  "rollback",
  "template",
  "project intelligence",
]) {
  expectOutputExcludes(
    `help output overpromised unsupported init behavior: ${unsupportedInitHelpText}`,
    helpCommand,
    unsupportedInitHelpText,
  );
}

const init = runCli(["init"]);
expectExitCode("init exited nonzero", init, 0);
expectOutputIncludes('init output did not include "AEOS Init"', init, "AEOS Init");
expectOutputIncludes('init output did not include dry-run mode', init, "dry_run");
expectOutputIncludes(
  'init output did not include disabled write state',
  init,
  "Write enabled:",
);
expectOutputIncludes(
  'init output did not include "false" write state',
  init,
  "false",
);
expectOutputIncludes('init output did not include target root', init, "Target root:");
expectOutputIncludes('init output did not include "Status:"', init, "Status:");
expectOutputIncludes(
  'init output did not include success status',
  init,
  "success",
);
expectOutputIncludes('init output did not include "Stages:"', init, "Stages:");
for (const stage of [
  "project_detection",
  "template_selection",
  "variable_resolution",
  "rendering",
  "file_writing",
  "validation",
]) {
  expectOutputIncludes(`init output did not include stage ${stage}`, init, `- ${stage}`);
}
expectOutputIncludes('init output did not include "Artifacts:"', init, "Artifacts:");
expectOutputIncludes(
  'init output did not include planned AGENTS.md',
  init,
  "planned AGENTS.md",
);
expectOutputExcludes(
  'init output implied AGENTS.md was written in dry-run mode',
  init,
  "created AGENTS.md",
);

const initJson = runCli(["init", "--json"]);
expectExitCode("init --json exited nonzero", initJson, 0);
const parsedInitJson = parseJsonOnlyStdout(
  "init --json output was not valid JSON",
  initJson,
);
expectInitJsonShape("init --json output shape was invalid", parsedInitJson);
if (
  parsedInitJson.ok !== true ||
  parsedInitJson.mode !== "dry_run" ||
  parsedInitJson.writeEnabled !== false ||
  parsedInitJson.status !== "success" ||
  parsedInitJson.generatedFiles.length !== 1 ||
  parsedInitJson.generatedFiles[0]?.path !== "AGENTS.md" ||
  parsedInitJson.generatedFiles[0]?.status !== "planned"
) {
  fail("init --json output did not match expected dry-run plan", initJson);
}

const initWrite = runCli(["init", "--write"]);
expectNonzero("init --write exited zero despite existing AGENTS.md", initWrite);
expectOutputIncludes(
  'init --write output did not include "write"',
  initWrite,
  "write",
);
expectOutputIncludes(
  'init --write output did not include enabled write state',
  initWrite,
  "Write enabled:",
);
expectOutputIncludes(
  'init --write output did not include "true" write state',
  initWrite,
  "true",
);
expectOutputIncludes(
  'init --write output did not include target root',
  initWrite,
  "Target root:",
);
expectOutputIncludes('init --write output did not include status', initWrite, "Status:");
expectOutputIncludes(
  'init --write output did not include generated files count',
  initWrite,
  "Generated files count:",
);
expectOutputIncludes(
  'init --write output did not include conflicts count',
  initWrite,
  "Conflicts count:",
);
expectOutputIncludes(
  'init --write output did not include errors count',
  initWrite,
  "Errors count:",
);
expectOutputIncludes(
  'init --write output did not report blocked AGENTS.md',
  initWrite,
  "blocked AGENTS.md",
);

const initWriteJson = runCli(["init", "--write", "--json"]);
expectNonzero(
  "init --write --json exited zero despite existing AGENTS.md",
  initWriteJson,
);
const parsedInitWriteJson = parseJsonOnlyStdout(
  "init --write --json output was not valid JSON only",
  initWriteJson,
);
expectInitWriteJsonShape(
  "init --write --json output shape was invalid",
  parsedInitWriteJson,
);
if (
  parsedInitWriteJson.ok !== false ||
  parsedInitWriteJson.status !== "blocked" ||
  !parsedInitWriteJson.generatedFiles.some((file) => file.path === "AGENTS.md") ||
  parsedInitWriteJson.conflicts.length === 0
) {
  fail(
    "init --write --json did not report existing AGENTS.md conflict",
    initWriteJson,
  );
}
expectIssueCode(
  "init --write --json did not report overwrite-disabled conflict",
  parsedInitWriteJson.conflicts,
  "generation_target_exists",
  initWriteJson,
);

const initUnknownJson = runCli(["init", "--unknown", "--json"]);
expectNonzero("init unknown option --json exited zero", initUnknownJson);
const parsedInitUnknownJson = parseJsonStdout(
  "init unknown option --json output was not valid JSON",
  initUnknownJson,
);
if (
  parsedInitUnknownJson.ok !== false ||
  parsedInitUnknownJson.mode !== "dry_run" ||
  parsedInitUnknownJson.writeEnabled !== false ||
  parsedInitUnknownJson.status !== "failure" ||
  !Array.isArray(parsedInitUnknownJson.errors) ||
  parsedInitUnknownJson.errors[0]?.code !== "init_unknown_option"
) {
  fail("init unknown option --json output did not match expected failure", initUnknownJson);
}

const initSafetyRoot = mkdtempSync(join(tmpdir(), "aeos-cli-init-safety-"));
const initSafetyParentRoot = mkdtempSync(
  join(tmpdir(), "aeos-cli-init-safety-parent-"),
);
const initSafetyChildRoot = join(initSafetyParentRoot, "cwd");
const initOutsideRoot = mkdtempSync(join(tmpdir(), "aeos-cli-init-outside-"));

try {
  mkdirSync(initSafetyChildRoot);

  const outsideSentinelPath = join(initOutsideRoot, "sentinel.txt");
  writeFileSync(outsideSentinelPath, "outside sentinel\n");

  const filesBeforeInit = listRelativeFiles(initSafetyRoot);
  const parentFilesBeforeInit = listRelativeFiles(initSafetyParentRoot);
  const isolatedInit = runCliFrom(initSafetyRoot, ["init"]);
  expectExitCode("isolated init exited nonzero", isolatedInit, 0);
  expectOutputIncludes(
    'isolated init output did not include "AEOS Init"',
    isolatedInit,
    "AEOS Init",
  );
  expectSameFiles(
    "isolated init changed files in dry-run mode",
    filesBeforeInit,
    listRelativeFiles(initSafetyRoot),
  );
  expectSameFiles(
    "isolated init changed files in parent directory in dry-run mode",
    parentFilesBeforeInit,
    listRelativeFiles(initSafetyParentRoot),
  );
  if (existsSync(join(initSafetyRoot, "AGENTS.md"))) {
    fail("isolated init created AGENTS.md in dry-run mode", isolatedInit);
  }

  const isolatedInitJson = runCliFrom(initSafetyRoot, ["init", "--json"]);
  expectExitCode("isolated init --json exited nonzero", isolatedInitJson, 0);
  const parsedIsolatedInitJson = parseJsonOnlyStdout(
    "isolated init --json output was not valid JSON",
    isolatedInitJson,
  );
  expectInitJsonShape(
    "isolated init --json output shape was invalid",
    parsedIsolatedInitJson,
  );
  if (
    parsedIsolatedInitJson.mode !== "dry_run" ||
    parsedIsolatedInitJson.writeEnabled !== false ||
    !parsedIsolatedInitJson.generatedFiles.some(
      (file) => file.path === "AGENTS.md" && file.status === "planned",
    )
  ) {
    fail("isolated init --json did not report planned AGENTS.md", isolatedInitJson);
  }
  expectSameFiles(
    "isolated init --json changed files in dry-run mode",
    filesBeforeInit,
    listRelativeFiles(initSafetyRoot),
  );
  if (existsSync(join(initSafetyRoot, "AGENTS.md"))) {
    fail("isolated init --json created AGENTS.md in dry-run mode", isolatedInitJson);
  }

  const isolatedInitWrite = runCliFrom(initSafetyChildRoot, ["init", "--write"]);
  expectExitCode("isolated init --write exited nonzero", isolatedInitWrite, 0);
  expectOutputIncludes(
    'isolated init --write output did not include "Write enabled:"',
    isolatedInitWrite,
    "Write enabled:",
  );
  expectOutputIncludes(
    'isolated init --write output did not include true write state',
    isolatedInitWrite,
    "true",
  );
  expectOutputIncludes(
    "isolated init --write output did not report created AGENTS.md",
    isolatedInitWrite,
    "created AGENTS.md",
  );

  const createdAgentsPath = join(initSafetyChildRoot, "AGENTS.md");
  if (!existsSync(createdAgentsPath)) {
    fail("isolated init --write did not create AGENTS.md", isolatedInitWrite);
  }
  if (!readFileSync(createdAgentsPath, "utf8").includes("AEOS")) {
    fail("isolated init --write AGENTS.md did not include AEOS marker", isolatedInitWrite);
  }

  const isolatedWriteFiles = listRelativeFiles(initSafetyChildRoot);
  if (
    isolatedWriteFiles.length !== 1 ||
    isolatedWriteFiles[0] !== "AGENTS.md"
  ) {
    fail("isolated init --write created unexpected files", isolatedInitWrite);
  }
  for (const path of isolatedWriteFiles) {
    if (path.startsWith("..") || path.length === 0) {
      fail(`isolated init --write reported an unsafe relative path: ${path}`, isolatedInitWrite);
    }
  }
  const isolatedWriteParentFiles = listRelativeFiles(initSafetyParentRoot);
  if (
    isolatedWriteParentFiles.length !== 1 ||
    isolatedWriteParentFiles[0] !== "cwd/AGENTS.md"
  ) {
    fail("isolated init --write created a file outside cwd", isolatedInitWrite);
  }
  if (readFileSync(outsideSentinelPath, "utf8") !== "outside sentinel\n") {
    fail("isolated init --write changed an outside sentinel file", isolatedInitWrite);
  }

  const initWriteJsonParentRoot = mkdtempSync(
    join(tmpdir(), "aeos-cli-init-write-json-parent-"),
  );
  const initWriteJsonRoot = join(initWriteJsonParentRoot, "cwd");
  mkdirSync(initWriteJsonRoot);
  const isolatedInitWriteJson = runCliFrom(initWriteJsonRoot, [
    "init",
    "--write",
    "--json",
  ]);
  expectExitCode("isolated init --write --json exited nonzero", isolatedInitWriteJson, 0);
  const parsedIsolatedInitWriteJson = parseJsonOnlyStdout(
    "isolated init --write --json output was not valid JSON only",
    isolatedInitWriteJson,
  );
  expectInitWriteJsonShape(
    "isolated init --write --json output shape was invalid",
    parsedIsolatedInitWriteJson,
  );
  if (parsedIsolatedInitWriteJson.targetRoot !== realpathSync(initWriteJsonRoot)) {
    fail("isolated init --write --json targetRoot did not match cwd", isolatedInitWriteJson);
  }

  if (
    parsedIsolatedInitWriteJson.ok !== true ||
    parsedIsolatedInitWriteJson.mode !== "write" ||
    parsedIsolatedInitWriteJson.writeEnabled !== true ||
    parsedIsolatedInitWriteJson.generatedFiles.length !== 1 ||
    parsedIsolatedInitWriteJson.generatedFiles[0]?.path !== "AGENTS.md" ||
    parsedIsolatedInitWriteJson.generatedFiles[0]?.status !== "created"
  ) {
    fail(
      "isolated init --write --json did not report created AGENTS.md",
      isolatedInitWriteJson,
    );
  }
  expectEmptyArray(
    "isolated init --write --json conflicts was not empty",
    parsedIsolatedInitWriteJson.conflicts,
  );
  expectEmptyArray(
    "isolated init --write --json errors was not empty",
    parsedIsolatedInitWriteJson.errors,
  );

  const initWriteJsonFiles = listRelativeFiles(initWriteJsonRoot);
  if (
    initWriteJsonFiles.length !== 1 ||
    initWriteJsonFiles[0] !== "AGENTS.md"
  ) {
    fail("isolated init --write --json created unexpected files", isolatedInitWriteJson);
  }
  const initWriteJsonParentFiles = listRelativeFiles(initWriteJsonParentRoot);
  if (
    initWriteJsonParentFiles.length !== 1 ||
    initWriteJsonParentFiles[0] !== "cwd/AGENTS.md"
  ) {
    fail("isolated init --write --json created a file outside cwd", isolatedInitWriteJson);
  }

  const conflictRoot = mkdtempSync(join(tmpdir(), "aeos-cli-init-conflict-"));
  const conflictPath = join(conflictRoot, "AGENTS.md");

  writeFileSync(conflictPath, "existing content\n");
  const conflictResult = runCliFrom(conflictRoot, ["init", "--write"]);
  expectNonzero("isolated init --write conflict exited zero", conflictResult);
  if (readFileSync(conflictPath, "utf8") !== "existing content\n") {
    fail("isolated init --write overwrote an existing file", conflictResult);
  }
  expectOutputIncludes(
    "isolated init --write conflict did not report blocked AGENTS.md",
    conflictResult,
    "blocked AGENTS.md",
  );
  expectOutputIncludes(
    "isolated init --write conflict did not report conflict count",
    conflictResult,
    "Conflicts count:",
  );
  const conflictJsonResult = runCliFrom(conflictRoot, [
    "init",
    "--write",
    "--json",
  ]);
  expectNonzero("isolated init --write --json conflict exited zero", conflictJsonResult);
  const parsedConflictJson = parseJsonOnlyStdout(
    "isolated init --write --json conflict output was not valid JSON only",
    conflictJsonResult,
  );
  expectInitWriteJsonShape(
    "isolated init --write --json conflict output shape was invalid",
    parsedConflictJson,
  );
  if (
    parsedConflictJson.ok !== false ||
    parsedConflictJson.status !== "blocked" ||
    parsedConflictJson.generatedFiles.length !== 1 ||
    parsedConflictJson.generatedFiles[0]?.path !== "AGENTS.md" ||
    parsedConflictJson.generatedFiles[0]?.status !== "blocked" ||
    parsedConflictJson.conflicts.length === 0
  ) {
    fail(
      "isolated init --write --json conflict did not report blocked AGENTS.md",
      conflictJsonResult,
    );
  }
  expectIssueCode(
    "isolated init --write --json conflict did not report overwrite-disabled conflict",
    parsedConflictJson.conflicts,
    "generation_target_exists",
    conflictJsonResult,
  );
  if (readFileSync(conflictPath, "utf8") !== "existing content\n") {
    fail("isolated init --write --json overwrote an existing file", conflictJsonResult);
  }
  const conflictFiles = listRelativeFiles(conflictRoot);
  if (conflictFiles.length !== 1 || conflictFiles[0] !== "AGENTS.md") {
    fail("isolated init --write --json conflict created unexpected files", conflictJsonResult);
  }
  rmSync(conflictRoot, { recursive: true, force: true });

  rmSync(initWriteJsonParentRoot, { recursive: true, force: true });
} finally {
  rmSync(initSafetyRoot, { recursive: true, force: true });
  rmSync(initSafetyParentRoot, { recursive: true, force: true });
  rmSync(initOutsideRoot, { recursive: true, force: true });
}

const status = runCli(["status"]);
expectExitCode("status exited nonzero", status, 0);
expectOutputIncludes('status output did not include "AEOS Status"', status, "AEOS Status");
expectOutputIncludes('status output did not include "Project Root"', status, "Project Root");

const projectStatus = runCli(["project", "status"]);
expectExitCode("project status exited nonzero", projectStatus, 0);
expectOutputIncludes(
  'project status output did not include "Project Status"',
  projectStatus,
  "Project Status",
);
expectOutputIncludes(
  'project status output did not include "Root"',
  projectStatus,
  "Root",
);

const projectStatusJson = runCli(["project", "status", "--json"]);
expectExitCode("project status --json exited nonzero", projectStatusJson, 0);
const parsedProjectStatusJson = parseJsonStdout(
  "project status --json output was not valid JSON",
  projectStatusJson,
);
if (
  parsedProjectStatusJson.ok !== true ||
  typeof parsedProjectStatusJson.root !== "string" ||
  parsedProjectStatusJson.root.length === 0 ||
  !existsSync(parsedProjectStatusJson.root) ||
  typeof parsedProjectStatusJson.packageName !== "string"
) {
  fail(
    "project status --json output did not match expected success",
    projectStatusJson,
  );
}
expectBooleanProperty(
  "project status --json projectContextPresent was not boolean",
  parsedProjectStatusJson,
  "projectContextPresent",
);
expectBooleanProperty(
  "project status --json agentsPresent was not boolean",
  parsedProjectStatusJson,
  "agentsPresent",
);
expectBooleanProperty(
  "project status --json workspacePresent was not boolean",
  parsedProjectStatusJson,
  "workspacePresent",
);

const projectContext = runCli(["project", "context"]);
expectExitCode("project context exited nonzero", projectContext, 0);
expectOutputIncludes(
  'project context output did not include "Project Context"',
  projectContext,
  "Project Context",
);
expectOutputIncludes(
  'project context output did not include "Root"',
  projectContext,
  "Root",
);

const projectContextJson = runCli(["project", "context", "--json"]);
expectExitCode("project context --json exited nonzero", projectContextJson, 0);
const parsedProjectContextJson = parseJsonStdout(
  "project context --json output was not valid JSON",
  projectContextJson,
);
if (
  parsedProjectContextJson.ok !== true ||
  typeof parsedProjectContextJson.root !== "string" ||
  parsedProjectContextJson.root.length === 0 ||
  !existsSync(parsedProjectContextJson.root) ||
  typeof parsedProjectContextJson.context !== "string"
) {
  fail(
    "project context --json output did not match expected success",
    projectContextJson,
  );
}
expectBooleanProperty(
  "project context --json contextPresent was not boolean",
  parsedProjectContextJson,
  "contextPresent",
);
expectBooleanProperty(
  "project context --json agentsPresent was not boolean",
  parsedProjectContextJson,
  "agentsPresent",
);

const missingContextProjectRoot = mkdtempSync(
  join(tmpdir(), "aeos-cli-project-context-"),
);

try {
  writeFileSync(
    join(missingContextProjectRoot, "package.json"),
    '{"name":"smoke-missing-context"}\n',
  );

  const missingProjectContext = runCliFrom(missingContextProjectRoot, [
    "project",
    "context",
  ]);
  expectExitCode(
    "project context with missing PROJECT_CONTEXT.md exited nonzero",
    missingProjectContext,
    0,
  );
  expectOutputIncludes(
    'missing project context output did not include "Project Context"',
    missingProjectContext,
    "Project Context",
  );
  expectOutputIncludes(
    'missing project context output did not include "Context:"',
    missingProjectContext,
    "Context:",
  );
  expectOutputIncludes(
    'missing project context output did not include "missing"',
    missingProjectContext,
    "missing",
  );

  const missingProjectContextJson = runCliFrom(missingContextProjectRoot, [
    "project",
    "context",
    "--json",
  ]);
  expectExitCode(
    "project context --json with missing PROJECT_CONTEXT.md exited nonzero",
    missingProjectContextJson,
    0,
  );
  const parsedMissingProjectContextJson = parseJsonStdout(
    "project context --json with missing PROJECT_CONTEXT.md output was not valid JSON",
    missingProjectContextJson,
  );
  if (
    parsedMissingProjectContextJson.ok !== true ||
    parsedMissingProjectContextJson.contextPresent !== false ||
    typeof parsedMissingProjectContextJson.context !== "string" ||
    parsedMissingProjectContextJson.context !== ""
  ) {
    fail(
      "project context --json with missing PROJECT_CONTEXT.md output did not match expected success",
      missingProjectContextJson,
    );
  }
expectBooleanProperty(
  "project context --json with missing PROJECT_CONTEXT.md agentsPresent was not boolean",
  parsedMissingProjectContextJson,
  "agentsPresent",
);
} finally {
  rmSync(missingContextProjectRoot, { recursive: true, force: true });
}

const projectValidate = runCli(["project", "validate"]);
expectExitCode("project validate exited nonzero", projectValidate, 0);
expectOutputIncludes(
  'project validate output did not include "Project Validation"',
  projectValidate,
  "Project Validation",
);
expectOutputIncludes(
  'project validate output did not include project root validation result',
  projectValidate,
  "PASS project_root",
);

const projectValidateJson = runCli(["project", "validate", "--json"]);
expectExitCode("project validate --json exited nonzero", projectValidateJson, 0);
const parsedProjectValidateJson = parseJsonStdout(
  "project validate --json output was not valid JSON",
  projectValidateJson,
);
if (
  typeof parsedProjectValidateJson.ok !== "boolean" ||
  typeof parsedProjectValidateJson.valid !== "boolean" ||
  parsedProjectValidateJson.ok !== true ||
  parsedProjectValidateJson.valid !== true ||
  !Array.isArray(parsedProjectValidateJson.checks)
) {
  fail(
    "project validate --json output did not match expected success",
    projectValidateJson,
  );
}
const requiredProjectValidationChecks = [
  "project_root",
  "package_metadata",
  "project_context",
  "agents_file",
  "workspace_marker",
];
for (const checkName of requiredProjectValidationChecks) {
  const check = parsedProjectValidateJson.checks.find(
    (value) => value.name === checkName,
  );

  if (check === undefined) {
    fail(`project validate --json missing check: ${checkName}`, projectValidateJson);
  }

  expectProjectValidationCheckShape(
    `project validate --json check was malformed: ${checkName}`,
    check,
  );
}
for (const check of parsedProjectValidateJson.checks) {
  expectProjectValidationCheckShape(
    `project validate --json check was malformed: ${check.name}`,
    check,
  );
}

const missingOptionalMetadataRoot = mkdtempSync(
  join(tmpdir(), "aeos-cli-project-validate-"),
);

try {
  writeFileSync(
    join(missingOptionalMetadataRoot, "PROJECT_CONTEXT.md"),
    "# Project Context\n\nProject: Smoke\n",
  );
  writeFileSync(join(missingOptionalMetadataRoot, "AGENTS.md"), "# Agents\n");
  writeFileSync(join(missingOptionalMetadataRoot, "pnpm-workspace.yaml"), "packages: []\n");

  const missingOptionalMetadata = runCliFrom(missingOptionalMetadataRoot, [
    "project",
    "validate",
  ]);
  expectExitCode(
    "project validate with missing optional metadata exited nonzero",
    missingOptionalMetadata,
    0,
  );
  expectOutputIncludes(
    'project validate with missing optional metadata did not include "Project Validation"',
    missingOptionalMetadata,
    "Project Validation",
  );
  expectOutputIncludes(
    'project validate with missing optional metadata did not include package metadata warning',
    missingOptionalMetadata,
    "WARN package_metadata",
  );

  const missingOptionalMetadataJson = runCliFrom(missingOptionalMetadataRoot, [
    "project",
    "validate",
    "--json",
  ]);
  expectExitCode(
    "project validate --json with missing optional metadata exited nonzero",
    missingOptionalMetadataJson,
    0,
  );
  const parsedMissingOptionalMetadataJson = parseJsonStdout(
    "project validate --json with missing optional metadata output was not valid JSON",
    missingOptionalMetadataJson,
  );
  if (
    parsedMissingOptionalMetadataJson.ok !== true ||
    parsedMissingOptionalMetadataJson.valid !== true ||
    !Array.isArray(parsedMissingOptionalMetadataJson.checks)
  ) {
    fail(
      "project validate --json with missing optional metadata output did not match expected warning success",
      missingOptionalMetadataJson,
    );
  }
  const packageMetadataCheck = parsedMissingOptionalMetadataJson.checks.find(
    (check) => check.name === "package_metadata",
  );
  if (
    packageMetadataCheck === undefined ||
    packageMetadataCheck.status !== "warn"
  ) {
    fail(
      "project validate --json with missing optional metadata did not include package metadata warning",
      missingOptionalMetadataJson,
    );
  }
} finally {
  rmSync(missingOptionalMetadataRoot, { recursive: true, force: true });
}

const missingProjectRoot = mkdtempSync(
  join(tmpdir(), "aeos-cli-project-validate-missing-root-"),
);

try {
  const missingProjectRootJson = runCliFrom(missingProjectRoot, [
    "project",
    "validate",
    "--json",
  ]);
  expectNonzero("project validate --json missing root exited zero", missingProjectRootJson);
  const parsedMissingProjectRootJson = parseJsonStdout(
    "project validate --json missing root output was not valid JSON",
    missingProjectRootJson,
  );
  if (
    parsedMissingProjectRootJson.ok !== false ||
    parsedMissingProjectRootJson.valid !== false ||
    parsedMissingProjectRootJson.reason !== "project_root_not_found" ||
    !Array.isArray(parsedMissingProjectRootJson.checks) ||
    parsedMissingProjectRootJson.checks.length !== 0
  ) {
    fail(
      "project validate --json missing root output did not match expected failure",
      missingProjectRootJson,
    );
  }
} finally {
  rmSync(missingProjectRoot, { recursive: true, force: true });
}

const statusJson = runCli(["status", "--json"]);
expectExitCode("status --json exited nonzero", statusJson, 0);
const parsedStatus = parseJsonStdout(
  "status --json output was not valid JSON",
  statusJson,
);

if (
  typeof parsedStatus.projectRoot !== "string" ||
  parsedStatus.projectRoot.length === 0 ||
  !existsSync(parsedStatus.projectRoot)
) {
  fail("status --json projectRoot did not exist", statusJson);
}

expectBooleanProperty(
  "status --json workspacePresent was not boolean",
  parsedStatus,
  "workspacePresent",
);
expectBooleanProperty(
  "status --json projectContextPresent was not boolean",
  parsedStatus,
  "projectContextPresent",
);
expectBooleanProperty(
  "status --json agentsFilePresent was not boolean",
  parsedStatus,
  "agentsFilePresent",
);
expectBooleanProperty(
  "status --json gitRepositoryPresent was not boolean",
  parsedStatus,
  "gitRepositoryPresent",
);

const context = runCli(["context"]);
expectExitCode("context exited nonzero", context, 0);
expectOutputIncludes('context output did not include "Project:"', context, "Project:");
if (!outputOf(context).includes("AEOS") && !outputOf(context).includes("Pro Performans")) {
  fail('context output did not include "AEOS" or "Pro Performans"', context);
}

const compactContext = runCli(["context", "--compact"]);
expectExitCode("context --compact exited nonzero", compactContext, 0);
if (
  !outputOf(compactContext).includes("Project") &&
  !outputOf(compactContext).includes("Pro Performans")
) {
  fail(
    'context --compact output did not include "Project" or "Pro Performans"',
    compactContext,
  );
}
expectOutputIncludes(
  'context --compact output did not include "Next Task"',
  compactContext,
  "Next Task",
);
if (outputOf(compactContext).length >= outputOf(context).length) {
  fail("context --compact output was not shorter than full context output", compactContext);
}

const contextJson = runCli(["context", "--json"]);
expectExitCode("context --json exited nonzero", contextJson, 0);
const parsedContext = parseJsonStdout(
  "context --json output was not valid JSON",
  contextJson,
);

if (parsedContext.projectContextPresent !== true) {
  fail("context --json projectContextPresent was not true", contextJson);
}

if (
  typeof parsedContext.content !== "string" ||
  !parsedContext.content.includes("Project")
) {
  fail('context --json content did not include "Project"', contextJson);
}

if (
  typeof parsedContext.compact !== "string" ||
  !parsedContext.compact.includes("Next Task")
) {
  fail('context --json compact did not include "Next Task"', contextJson);
}

if (typeof parsedContext.lineCount !== "number" || parsedContext.lineCount <= 0) {
  fail("context --json lineCount was not a positive number", contextJson);
}

const unknown = runCli(["unknown-command"]);
expectNonzero("unknown command exited zero", unknown);

const searchNoMatches = runCli([
  "search",
  `smoke-no-search-match-${smokeRunId}`,
]);
expectExitCode("search no-match command exited nonzero", searchNoMatches, 0);
if (
  searchNoMatches.stdout !==
  `Search Results\nQuery: smoke-no-search-match-${smokeRunId}\nMatches: 0\n`
) {
  fail("search no-match output was not stable", searchNoMatches);
}

const searchJson = runCli(["search", "decision", "--json"]);
expectExitCode("search --json exited nonzero", searchJson, 0);
const parsedSearchJson = parseJsonStdout(
  "search --json output was not valid JSON",
  searchJson,
);
if (
  parsedSearchJson.ok !== true ||
  parsedSearchJson.query !== "decision" ||
  typeof parsedSearchJson.count !== "number" ||
  !Array.isArray(parsedSearchJson.results)
) {
  fail("search --json output did not match expected success", searchJson);
}

const searchMissingQueryJson = runCli(["search", "--json"]);
expectNonzero("search missing query --json exited zero", searchMissingQueryJson);
const parsedSearchMissingQueryJson = parseJsonStdout(
  "search missing query --json output was not valid JSON",
  searchMissingQueryJson,
);
if (
  parsedSearchMissingQueryJson.ok !== false ||
  parsedSearchMissingQueryJson.reason !== "missing_query"
) {
  fail(
    "search missing query --json output did not match expected failure",
    searchMissingQueryJson,
  );
}

const searchNoMatchesJson = runCli([
  "search",
  `smoke-json-no-search-match-${smokeRunId}`,
  "--json",
]);
expectExitCode("search no-match --json command exited nonzero", searchNoMatchesJson, 0);
const parsedSearchNoMatchesJson = parseJsonStdout(
  "search no-match --json output was not valid JSON",
  searchNoMatchesJson,
);
if (
  parsedSearchNoMatchesJson.ok !== true ||
  parsedSearchNoMatchesJson.query !== `smoke-json-no-search-match-${smokeRunId}` ||
  parsedSearchNoMatchesJson.count !== 0
) {
  fail(
    "search no-match --json output did not match expected success",
    searchNoMatchesJson,
  );
}
expectEmptyArray(
  "search no-match --json results was not empty",
  parsedSearchNoMatchesJson.results,
);

const searchNoMatchesWithFilters = runCli([
  "search",
  `smoke-filtered-no-search-match-${smokeRunId}`,
  "--type",
  "decision",
  "--tag",
  "architecture",
]);
expectExitCode(
  "search no-match command with filters exited nonzero",
  searchNoMatchesWithFilters,
  0,
);
if (
  searchNoMatchesWithFilters.stdout !==
  `Search Results\nQuery: smoke-filtered-no-search-match-${smokeRunId}\nMatches: 0\n`
) {
  fail("search filtered no-match output was not stable", searchNoMatchesWithFilters);
}

const remember = runCli([
  "remember",
  "--type",
  "decision",
  "--title",
  `Smoke human persistence ${smokeRunId}`,
  "--tag",
  "architecture",
]);
expectExitCode("remember exited nonzero", remember, 0);
expectOutputIncludes(
  'remember output did not include "Memory: prepared"',
  remember,
  "Memory: prepared",
);
expectOutputIncludes(
  'remember output did not include "Path: .aeos/memory/decision/"',
  remember,
  "Path: .aeos/memory/decision/",
);
const rememberPath = extractRememberPath(remember);
const rememberAbsolutePath = rememberPathToAbsolute(rememberPath);
createdMemoryPaths.add(rememberAbsolutePath);
if (!existsSync(rememberAbsolutePath)) {
  fail("valid remember did not create memory file", remember);
}

const searchPersisted = runCli([
  "search",
  `Smoke human persistence ${smokeRunId}`,
]);
expectExitCode("search persisted memory exited nonzero", searchPersisted, 0);
expectOutputIncludes(
  "search persisted memory did not include remembered title",
  searchPersisted,
  `Smoke human persistence ${smokeRunId}`,
);
expectOutputIncludes(
  "search persisted memory did not include remembered path",
  searchPersisted,
  rememberPath,
);

const rememberJson = runCli([
  "remember",
  "--type",
  "decision",
  "--title",
  `Smoke JSON persistence ${smokeRunId}`,
  "--json",
]);
expectExitCode("remember --json exited nonzero", rememberJson, 0);
const parsedRemember = parseJsonStdout(
  "remember --json output was not valid JSON",
  rememberJson,
);
if (
  parsedRemember.ok !== true ||
  parsedRemember.type !== "decision" ||
  parsedRemember.title !== `Smoke JSON persistence ${smokeRunId}` ||
  typeof parsedRemember.path !== "string" ||
  parsedRemember.path.length === 0 ||
  parsedRemember.persisted !== true
) {
  fail("remember --json output did not match expected success", rememberJson);
}
const rememberJsonAbsolutePath = rememberPathToAbsolute(parsedRemember.path);
createdMemoryPaths.add(rememberJsonAbsolutePath);
if (!existsSync(rememberJsonAbsolutePath)) {
  fail("remember --json returned path did not exist", rememberJson);
}

const searchPersistedJson = runCli([
  "search",
  `Smoke JSON persistence ${smokeRunId}`,
  "--json",
]);
expectExitCode("search persisted memory --json exited nonzero", searchPersistedJson, 0);
const parsedSearchPersistedJson = parseJsonStdout(
  "search persisted memory --json output was not valid JSON",
  searchPersistedJson,
);
if (
  parsedSearchPersistedJson.ok !== true ||
  parsedSearchPersistedJson.count !== 1 ||
  parsedSearchPersistedJson.results[0]?.title !==
    `Smoke JSON persistence ${smokeRunId}` ||
  parsedSearchPersistedJson.results[0]?.path !== parsedRemember.path
) {
  fail(
    "search persisted memory --json output did not match expected result",
    searchPersistedJson,
  );
}

const duplicateTitle = `Smoke duplicate persistence ${smokeRunId}`;
const rememberDuplicateFirst = runCli([
  "remember",
  "--type",
  "decision",
  "--title",
  duplicateTitle,
  "--tag",
  "duplicate",
  "--json",
]);
expectExitCode("first duplicate remember --json exited nonzero", rememberDuplicateFirst, 0);
const parsedDuplicateFirst = parseJsonStdout(
  "first duplicate remember --json output was not valid JSON",
  rememberDuplicateFirst,
);
if (
  parsedDuplicateFirst.ok !== true ||
  parsedDuplicateFirst.persisted !== true ||
  typeof parsedDuplicateFirst.path !== "string" ||
  parsedDuplicateFirst.path.length === 0
) {
  fail(
    "first duplicate remember --json output did not match expected success",
    rememberDuplicateFirst,
  );
}
const duplicateAbsolutePath = rememberPathToAbsolute(parsedDuplicateFirst.path);
createdMemoryPaths.add(duplicateAbsolutePath);
if (!existsSync(duplicateAbsolutePath)) {
  fail("first duplicate remember --json returned path did not exist", rememberDuplicateFirst);
}

const rememberDuplicateSecond = runCli([
  "remember",
  "--type",
  "decision",
  "--title",
  duplicateTitle,
  "--tag",
  "duplicate",
  "--json",
]);
expectNonzero("second duplicate remember --json exited zero", rememberDuplicateSecond);
const parsedDuplicateSecond = parseJsonStdout(
  "second duplicate remember --json output was not valid JSON",
  rememberDuplicateSecond,
);
if (
  parsedDuplicateSecond.ok !== false ||
  parsedDuplicateSecond.reason !== "filesystem_failed" ||
  parsedDuplicateSecond.persisted !== false
) {
  fail(
    "second duplicate remember --json output did not match expected failure",
    rememberDuplicateSecond,
  );
}
expectEmptyArray(
  "second duplicate remember --json issues was not empty",
  parsedDuplicateSecond.issues,
);
if (!existsSync(duplicateAbsolutePath)) {
  fail("second duplicate remember removed the original memory file", rememberDuplicateSecond);
}

const memoryFilesBeforeInvalidRemember = listMemoryFiles();
const rememberMissingTitle = runCli(["remember", "--type", "decision"]);
expectNonzero("remember without title exited zero", rememberMissingTitle);
expectOutputIncludes(
  'remember without title output did not include "Memory: fail"',
  rememberMissingTitle,
  "Memory: fail",
);
const memoryFilesAfterInvalidRemember = listMemoryFiles();
if (
  memoryFilesAfterInvalidRemember.length !== memoryFilesBeforeInvalidRemember.length ||
  memoryFilesAfterInvalidRemember.some(
    (path, index) => path !== memoryFilesBeforeInvalidRemember[index],
  )
) {
  fail("invalid remember created a memory file", rememberMissingTitle);
}

const rememberInvalidType = runCli([
  "remember",
  "--type",
  "unknown",
  "--title",
  "Invalid type",
]);
expectNonzero("remember with invalid type exited zero", rememberInvalidType);
expectOutputIncludes(
  'remember invalid type output did not include "Memory: fail"',
  rememberInvalidType,
  "Memory: fail",
);

const rememberInvalidTypeJson = runCli([
  "remember",
  "--type",
  "unknown",
  "--title",
  "Invalid type",
  "--json",
]);
expectNonzero("remember invalid type --json exited zero", rememberInvalidTypeJson);
const parsedRememberInvalidType = parseJsonStdout(
  "remember invalid type --json output was not valid JSON",
  rememberInvalidTypeJson,
);
if (
  parsedRememberInvalidType.ok !== false ||
  parsedRememberInvalidType.reason !== "invalid_memory_type"
) {
  fail(
    "remember invalid type --json output did not match expected failure",
    rememberInvalidTypeJson,
  );
}
expectEmptyArray(
  "remember invalid type --json issues was not empty",
  parsedRememberInvalidType.issues,
);

const validTaskPath = fileURLToPath(
  new URL("../fixtures/tasks/valid-task.json", import.meta.url),
);
const invalidTaskPath = fileURLToPath(
  new URL("../fixtures/tasks/invalid-task.json", import.meta.url),
);
const smokeDir = mkdtempSync(join(tmpdir(), "aeos-cli-smoke-"));

try {
  const invalidJsonPath = join(smokeDir, "invalid-json.json");
  const missingTaskPath = join(smokeDir, "missing-task.json");

  writeFileSync(invalidJsonPath, "{ invalid json");

  const missingPath = runCli(["task", "validate"]);
  expectNonzero("missing path validation exited zero", missingPath);
  expectOutputIncludes(
    'missing path output did not include "Task validation: fail"',
    missingPath,
    "Task validation: fail",
  );
  expectOutputIncludes(
    'missing path output did not include "Reason: missing task file path"',
    missingPath,
    "Reason: missing task file path",
  );
  expectOutputIncludes(
    'missing path output did not include task validate usage',
    missingPath,
    "Usage: aeos task validate <path>",
  );

  const missingPathJson = runCli(["task", "validate", "--json"]);
  expectNonzero("missing path --json validation exited zero", missingPathJson);
  const parsedMissingPath = parseJsonStdout(
    "missing path --json output was not valid JSON",
    missingPathJson,
  );
  if (
    parsedMissingPath.ok !== false ||
    parsedMissingPath.path !== "" ||
    parsedMissingPath.status !== "fail" ||
    parsedMissingPath.reason !== "missing_task_file_path"
  ) {
    fail("missing path --json output did not match expected failure", missingPathJson);
  }

  const missingFile = runCli(["task", "validate", missingTaskPath]);
  expectNonzero("missing file validation exited zero", missingFile);
  expectOutputIncludes(
    'missing file output did not include "Task validation: fail"',
    missingFile,
    "Task validation: fail",
  );
  expectOutputIncludes(
    'missing file output did not include "Reason: task file not found"',
    missingFile,
    "Reason: task file not found",
  );
  expectOutputIncludes(
    "missing file output did not include provided path",
    missingFile,
    missingTaskPath,
  );

  const missingFileJson = runCli(["task", "validate", missingTaskPath, "--json"]);
  expectNonzero("missing file --json validation exited zero", missingFileJson);
  const parsedMissingFile = parseJsonStdout(
    "missing file --json output was not valid JSON",
    missingFileJson,
  );
  if (
    parsedMissingFile.ok !== false ||
    parsedMissingFile.path !== missingTaskPath ||
    parsedMissingFile.status !== "fail" ||
    parsedMissingFile.reason !== "task_file_not_found"
  ) {
    fail("missing file --json output did not match expected failure", missingFileJson);
  }

  const invalidJson = runCli(["task", "validate", invalidJsonPath]);
  expectNonzero("invalid JSON validation exited zero", invalidJson);
  expectOutputIncludes(
    'invalid JSON output did not include "Task validation: fail"',
    invalidJson,
    "Task validation: fail",
  );
  expectOutputIncludes(
    'invalid JSON output did not include "Reason: invalid JSON"',
    invalidJson,
    "Reason: invalid JSON",
  );

  const invalidJsonJson = runCli(["task", "validate", invalidJsonPath, "--json"]);
  expectNonzero("invalid JSON --json validation exited zero", invalidJsonJson);
  const parsedInvalidJson = parseJsonStdout(
    "invalid JSON --json output was not valid JSON",
    invalidJsonJson,
  );
  if (
    parsedInvalidJson.ok !== false ||
    parsedInvalidJson.path !== invalidJsonPath ||
    parsedInvalidJson.status !== "fail" ||
    parsedInvalidJson.reason !== "invalid_json"
  ) {
    fail("invalid JSON --json output did not match expected failure", invalidJsonJson);
  }

  const validTask = runCli(["task", "validate", validTaskPath]);
  expectExitCode("valid task validation exited nonzero", validTask, 0);
  expectOutputIncludes(
    'valid task output did not include "Task validation: pass"',
    validTask,
    "Task validation: pass",
  );

  const validTaskJson = runCli(["task", "validate", validTaskPath, "--json"]);
  expectExitCode("valid task --json validation exited nonzero", validTaskJson, 0);
  const parsedValidTask = parseJsonStdout(
    "valid task --json output was not valid JSON",
    validTaskJson,
  );
  if (
    parsedValidTask.ok !== true ||
    parsedValidTask.path !== validTaskPath ||
    parsedValidTask.status !== "pass" ||
    parsedValidTask.reason !== null
  ) {
    fail("valid task --json output did not match expected pass", validTaskJson);
  }
  expectEmptyArray("valid task --json issues was not empty", parsedValidTask.issues);

  const invalidTask = runCli(["task", "validate", invalidTaskPath]);
  expectNonzero("invalid task validation exited zero", invalidTask);
  expectOutputIncludes(
    'invalid task output did not include "Task validation: fail"',
    invalidTask,
    "Task validation: fail",
  );
  expectOutputIncludes(
    'invalid task output did not include concise issue summary',
    invalidTask,
    "- id: Task id is required.",
  );

  const invalidTaskJson = runCli(["task", "validate", invalidTaskPath, "--json"]);
  expectNonzero("invalid task --json validation exited zero", invalidTaskJson);
  const parsedInvalidTask = parseJsonStdout(
    "invalid task --json output was not valid JSON",
    invalidTaskJson,
  );
  if (
    parsedInvalidTask.ok !== false ||
    parsedInvalidTask.path !== invalidTaskPath ||
    parsedInvalidTask.status !== "fail" ||
    parsedInvalidTask.reason !== "validation_failed" ||
    !Array.isArray(parsedInvalidTask.issues) ||
    parsedInvalidTask.issues.length === 0
  ) {
    fail("invalid task --json output did not match expected failure", invalidTaskJson);
  }
} finally {
  for (const path of createdMemoryPaths) {
    if (existsSync(path)) {
      unlinkSync(path);
    }
  }

  rmSync(smokeDir, { recursive: true, force: true });
}

console.log("AEOS CLI smoke passed.");
