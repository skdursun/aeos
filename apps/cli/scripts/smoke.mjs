import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

const status = runCli(["status"]);
expectExitCode("status exited nonzero", status, 0);
expectOutputIncludes('status output did not include "AEOS Status"', status, "AEOS Status");
expectOutputIncludes('status output did not include "Project Root"', status, "Project Root");

const statusJson = runCli(["status", "--json"]);
expectExitCode("status --json exited nonzero", statusJson, 0);

let parsedStatus;

try {
  parsedStatus = JSON.parse(statusJson.stdout);
} catch {
  fail("status --json output was not valid JSON", statusJson);
}

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

let parsedContext;

try {
  parsedContext = JSON.parse(contextJson.stdout);
} catch {
  fail("context --json output was not valid JSON", contextJson);
}

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
  rmSync(smokeDir, { recursive: true, force: true });
}

console.log("AEOS CLI smoke passed.");
