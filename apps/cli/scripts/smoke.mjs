import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

const version = runCli(["--version"]);
expectExitCode("--version exited nonzero", version, 0);
expectOutputIncludes('--version output did not include "aeos"', version, "aeos");

const help = runCli(["--help"]);
expectExitCode("--help exited nonzero", help, 0);
expectOutputIncludes('--help output did not include "AEOS CLI"', help, "AEOS CLI");

const status = runCli(["status"]);
expectExitCode("status exited nonzero", status, 0);
expectOutputIncludes('status output did not include "AEOS Status"', status, "AEOS Status");
expectOutputIncludes('status output did not include "Project Root"', status, "Project Root");

const context = runCli(["context"]);
expectExitCode("context exited nonzero", context, 0);
expectOutputIncludes('context output did not include "Project:"', context, "Project:");
if (!outputOf(context).includes("AEOS") && !outputOf(context).includes("Pro Performans")) {
  fail('context output did not include "AEOS" or "Pro Performans"', context);
}

const unknown = runCli(["unknown-command"]);
expectNonzero("unknown command exited zero", unknown);

const smokeDir = mkdtempSync(join(tmpdir(), "aeos-cli-smoke-"));

try {
  const validTaskPath = join(smokeDir, "valid-task.json");
  const invalidTaskPath = join(smokeDir, "invalid-task.json");
  const invalidJsonPath = join(smokeDir, "invalid-json.json");
  const missingTaskPath = join(smokeDir, "missing-task.json");

  writeFileSync(
    validTaskPath,
    JSON.stringify(
      {
        id: "TASK-SMOKE-VALID",
        title: "Smoke valid task",
        purpose: "Verify CLI task validation pass output.",
        context: {
          load: [
            {
              path: "PROJECT_CONTEXT.md",
              required: true,
            },
          ],
          doNotLoad: [],
        },
        stopCondition: {
          description: "Stop after smoke validation completes.",
          stopAfterCompletion: true,
        },
        fileBoundary: {
          filesToModify: [],
          filesNotToTouch: [],
          allowGeneratedFiles: false,
          requireStopOnBoundaryConflict: true,
        },
      },
      null,
      2,
    ),
  );

  writeFileSync(
    invalidTaskPath,
    JSON.stringify(
      {
        id: "",
        title: "",
        purpose: "",
        context: {
          load: [],
          doNotLoad: [],
        },
        stopCondition: {
          description: "",
          stopAfterCompletion: true,
        },
      },
      null,
      2,
    ),
  );

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

  const validTask = runCli(["task", "validate", validTaskPath]);
  expectExitCode("valid task validation exited nonzero", validTask, 0);
  expectOutputIncludes(
    'valid task output did not include "Task validation: pass"',
    validTask,
    "Task validation: pass",
  );

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
} finally {
  rmSync(smokeDir, { recursive: true, force: true });
}

console.log("AEOS CLI smoke passed.");
