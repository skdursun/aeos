import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  rm,
  stat,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { createFilesystemGenerationAdapter } from "../dist/filesystem-generation-writer.js";

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

function issueCodes(result) {
  return result.issues.map((issue) => issue.code);
}

const tempRoot = await mkdtemp(join(tmpdir(), "aeos-core-smoke-"));

try {
  const targetRoot = join(tempRoot, "target");
  const outsideRoot = join(tempRoot, "outside");
  const adapter = createFilesystemGenerationAdapter({ targetRoot });

  const dryRunDirectoryPath = "planned-dir";
  const dryRunDirectory = await adapter.ensureDirectory({
    path: dryRunDirectoryPath,
    dryRun: true,
  });

  assert.equal(
    dryRunDirectory.ok,
    true,
    "dry-run directory ensure should report ok",
  );
  assert.equal(
    dryRunDirectory.status,
    "planned",
    "dry-run directory ensure should be planned",
  );
  assert.equal(
    dryRunDirectory.created,
    false,
    "dry-run directory ensure should not create directories",
  );
  assert.deepEqual(
    issueCodes(dryRunDirectory),
    ["write_skipped"],
    "dry-run directory ensure should report skipped write behavior",
  );
  assert.equal(
    await pathExists(join(targetRoot, dryRunDirectoryPath)),
    false,
    "dry-run directory ensure must not create the directory",
  );

  const dryRunFilePath = "planned/file.txt";
  const dryRunFile = await adapter.writeFile({
    path: dryRunFilePath,
    content: "planned content\n",
    dryRun: true,
    overwrite: false,
  });

  assert.equal(dryRunFile.ok, true, "dry-run file write should report ok");
  assert.equal(
    dryRunFile.status,
    "planned",
    "dry-run file write should be planned",
  );
  assert.equal(
    dryRunFile.written,
    false,
    "dry-run file write should not report a write",
  );
  assert.equal(
    dryRunFile.skipped,
    true,
    "dry-run file write should report skipped behavior",
  );
  assert.deepEqual(
    issueCodes(dryRunFile),
    ["write_skipped"],
    "dry-run file write should report skipped write behavior",
  );
  assert.equal(
    await pathExists(join(targetRoot, dryRunFilePath)),
    false,
    "dry-run file write must not create the file",
  );

  const safeFilePath = "safe/note.txt";
  const safeContent = "safe content\n";
  const safeWrite = await adapter.writeFile({
    path: safeFilePath,
    content: safeContent,
    dryRun: false,
    overwrite: false,
  });

  assert.equal(safeWrite.ok, true, "safe file write should report ok");
  assert.equal(safeWrite.status, "written", "safe file write should write");
  assert.equal(
    safeWrite.written,
    true,
    "safe file write should report a written file",
  );
  assert.equal(
    await readFile(join(targetRoot, safeFilePath), "utf8"),
    safeContent,
    "safe file write should persist the expected content",
  );

  const existingPath = "existing.txt";
  const existingAbsolutePath = join(targetRoot, existingPath);
  await adapter.writeFile({
    path: existingPath,
    content: "original\n",
    dryRun: false,
    overwrite: false,
  });

  const overwriteDisabled = await adapter.writeFile({
    path: existingPath,
    content: "replacement\n",
    dryRun: false,
    overwrite: false,
  });

  assert.equal(
    overwriteDisabled.ok,
    false,
    "overwrite-disabled file write should not report ok",
  );
  assert.equal(
    overwriteDisabled.status,
    "blocked",
    "overwrite-disabled file write should be blocked",
  );
  assert.equal(
    overwriteDisabled.skipped,
    true,
    "overwrite-disabled file write should report skipped behavior",
  );
  assert.deepEqual(
    issueCodes(overwriteDisabled),
    ["overwrite_disabled"],
    "overwrite-disabled file write should report overwrite_disabled",
  );
  assert.equal(
    await readFile(existingAbsolutePath, "utf8"),
    "original\n",
    "overwrite-disabled file write must not overwrite existing content",
  );

  const traversalTarget = "../outside/traversal.md";
  const traversalWrite = await adapter.writeFile({
    path: traversalTarget,
    content: "outside\n",
    dryRun: false,
    overwrite: false,
  });

  assert.equal(
    traversalWrite.ok,
    false,
    "path traversal file write should not report ok",
  );
  assert.equal(
    traversalWrite.status,
    "blocked",
    "path traversal file write should be blocked",
  );
  assert.deepEqual(
    issueCodes(traversalWrite),
    ["target_outside_root"],
    "path traversal file write should report target_outside_root",
  );
  assert.equal(
    await pathExists(join(outsideRoot, "traversal.md")),
    false,
    "path traversal file write must not write outside targetRoot",
  );

  const absoluteOutsidePath = resolve(outsideRoot, "absolute.md");
  const absoluteWrite = await adapter.writeFile({
    path: absoluteOutsidePath,
    content: "absolute outside\n",
    dryRun: false,
    overwrite: false,
  });

  assert.equal(
    absoluteWrite.ok,
    false,
    "absolute target path file write should not report ok",
  );
  assert.equal(
    absoluteWrite.status,
    "blocked",
    "absolute target path file write should be blocked",
  );
  assert.deepEqual(
    issueCodes(absoluteWrite),
    ["target_outside_root"],
    "absolute target path file write should report target_outside_root",
  );
  assert.equal(
    await pathExists(absoluteOutsidePath),
    false,
    "absolute target path file write must not write outside targetRoot",
  );

  console.log("filesystem generation writer smoke tests passed");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
