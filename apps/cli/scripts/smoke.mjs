import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
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
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: projectRoot,
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

function expectEmptyArray(message, value) {
  if (!Array.isArray(value) || value.length !== 0) {
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
