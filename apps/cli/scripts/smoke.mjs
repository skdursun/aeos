import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(new URL("../dist/index.js", import.meta.url));

function runCli(args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
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

const unknown = runCli(["unknown-command"]);
if (unknown.status === 0) {
  fail("unknown command exited zero", unknown);
}

console.log("AEOS CLI smoke passed.");
