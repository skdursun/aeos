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

const version = runCli(["--version"]);
if (version.status !== 0) {
  fail("--version exited nonzero", version);
}
if (!version.stdout.includes("aeos")) {
  fail('--version output did not include "aeos"', version);
}

const help = runCli(["--help"]);
if (help.status !== 0) {
  fail("--help exited nonzero", help);
}
if (!help.stdout.includes("AEOS CLI")) {
  fail('--help output did not include "AEOS CLI"', help);
}

const status = runCli(["status"]);
if (status.status !== 0) {
  fail("status exited nonzero", status);
}
if (!status.stdout.includes("AEOS Status")) {
  fail('status output did not include "AEOS Status"', status);
}
if (!status.stdout.includes("Project Root")) {
  fail('status output did not include "Project Root"', status);
}

const context = runCli(["context"]);
if (context.status !== 0) {
  fail("context exited nonzero", context);
}
if (!context.stdout.includes("Project:")) {
  fail('context output did not include "Project:"', context);
}
if (!context.stdout.includes("AEOS") && !context.stdout.includes("Pro Performans")) {
  fail('context output did not include "AEOS" or "Pro Performans"', context);
}

const unknown = runCli(["unknown-command"]);
if (unknown.status === 0) {
  fail("unknown command exited zero", unknown);
}

const smokeDir = mkdtempSync(join(tmpdir(), "aeos-cli-smoke-"));

try {
  const validTaskPath = join(smokeDir, "valid-task.json");
  const invalidTaskPath = join(smokeDir, "invalid-task.json");

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

  const validTask = runCli(["task", "validate", validTaskPath]);
  if (validTask.status !== 0) {
    fail("valid task validation exited nonzero", validTask);
  }
  if (!validTask.stdout.includes("Task validation: pass")) {
    fail('valid task output did not include "Task validation: pass"', validTask);
  }

  const invalidTask = runCli(["task", "validate", invalidTaskPath]);
  if (invalidTask.status === 0) {
    fail("invalid task validation exited zero", invalidTask);
  }
  if (!invalidTask.stdout.includes("Task validation: fail")) {
    fail('invalid task output did not include "Task validation: fail"', invalidTask);
  }
} finally {
  rmSync(smokeDir, { recursive: true, force: true });
}

console.log("AEOS CLI smoke passed.");
