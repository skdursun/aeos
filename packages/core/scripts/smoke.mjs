import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile as writeNodeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { createFilesystemGenerationAdapter } from "../dist/filesystem-generation-writer.js";
import { runInitPipeline } from "../dist/init-pipeline.js";

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

function resultIssueCodes(result) {
  return result.errors.map((issue) => issue.code);
}

function createInitRequest(projectRoot) {
  return {
    projectRoot,
    template: {
      templateId: "smoke-template",
      templateVersion: "0.0.0-smoke",
    },
    variables: {
      projectName: "Smoke Project",
    },
    requestedAt: "2026-08-03T00:00:00.000Z",
  };
}

function createRenderedArtifact(targetPath, content) {
  return {
    path: targetPath,
    summary: `Render ${targetPath}.`,
    stage: "rendering",
    renderedArtifact: {
      targetPath,
      content,
      kind: "text",
      summary: `Render ${targetPath}.`,
      sourcePath: "smoke-template/AGENTS.md",
      templateId: "smoke-template",
      templateVersion: "0.0.0-smoke",
    },
  };
}

function createRenderOnlyAdapters(artifacts) {
  return {
    render: {
      runRendering() {
        return {
          stage: "rendering",
          status: "success",
          issues: [],
          artifacts,
        };
      },
    },
  };
}

async function runRenderedInitPipeline(targetRoot, artifacts, generation) {
  return runInitPipeline(
    createInitRequest(targetRoot),
    createRenderOnlyAdapters(artifacts),
    {
      stages: ["rendering", "file_writing"],
      generation,
    },
  );
}

function generatedFileFor(result, path) {
  return result.generatedFiles.find((file) => file.path === path);
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

  const defaultPipelineRoot = join(tempRoot, "init-default-pipeline");
  const defaultPipelineContent = "# Default Pipeline\n";
  const defaultPipelineResult = await runRenderedInitPipeline(
    defaultPipelineRoot,
    [createRenderedArtifact("AGENTS.md", defaultPipelineContent)],
  );

  assert.equal(
    defaultPipelineResult.ok,
    true,
    "default init pipeline generation should report ok",
  );
  assert.deepEqual(
    resultIssueCodes(defaultPipelineResult),
    [],
    "default init pipeline generation should not report errors",
  );
  assert.equal(
    await pathExists(join(defaultPipelineRoot, "AGENTS.md")),
    false,
    "default init pipeline generation must not write files",
  );
  assert.deepEqual(
    defaultPipelineResult.generatedFiles,
    [
      {
        path: "AGENTS.md",
        status: "planned",
        summary: "Render AGENTS.md.",
        sourcePath: "smoke-template/AGENTS.md",
      },
    ],
    "default init pipeline generation should report planned files",
  );

  const writePipelineRoot = join(tempRoot, "init-write-pipeline");
  const writePipelineContent = "# Written Pipeline\n";
  const writePipelineResult = await runRenderedInitPipeline(
    writePipelineRoot,
    [createRenderedArtifact("AGENTS.md", writePipelineContent)],
    {
      fileSystemAdapter: createFilesystemGenerationAdapter({
        targetRoot: writePipelineRoot,
      }),
      writeMode: "write",
    },
  );

  assert.equal(
    writePipelineResult.ok,
    true,
    "explicit filesystem-backed init pipeline generation should report ok",
  );
  assert.equal(
    await readFile(join(writePipelineRoot, "AGENTS.md"), "utf8"),
    writePipelineContent,
    "explicit filesystem-backed init pipeline generation should write rendered content",
  );
  assert.deepEqual(
    generatedFileFor(writePipelineResult, "AGENTS.md"),
    {
      path: "AGENTS.md",
      status: "created",
      summary: "Render AGENTS.md.",
      sourcePath: "smoke-template/AGENTS.md",
    },
    "explicit filesystem-backed init pipeline generation should report created files",
  );

  const conflictPipelineRoot = join(tempRoot, "init-conflict-pipeline");
  const conflictPath = join(conflictPipelineRoot, "AGENTS.md");
  const existingContent = "# Existing\n";
  await mkdir(conflictPipelineRoot, { recursive: true });
  await writeNodeFile(conflictPath, existingContent);

  const conflictPipelineResult = await runRenderedInitPipeline(
    conflictPipelineRoot,
    [createRenderedArtifact("AGENTS.md", "# Replacement\n")],
    {
      fileSystemAdapter: createFilesystemGenerationAdapter({
        targetRoot: conflictPipelineRoot,
      }),
      writeMode: "write",
    },
  );

  assert.equal(
    conflictPipelineResult.ok,
    false,
    "overwrite-disabled init pipeline generation should fail on conflict",
  );
  assert.equal(
    await readFile(conflictPath, "utf8"),
    existingContent,
    "overwrite-disabled init pipeline generation must not replace existing content",
  );
  assert.deepEqual(
    resultIssueCodes(conflictPipelineResult),
    ["generation_target_exists"],
    "overwrite-disabled init pipeline generation should report target_exists",
  );
  assert.equal(
    generatedFileFor(conflictPipelineResult, "AGENTS.md")?.status,
    "blocked",
    "overwrite-disabled init pipeline generation should report blocked file status",
  );

  const traversalPipelineRoot = join(tempRoot, "init-traversal-pipeline");
  const outsidePipelinePath = join(tempRoot, "outside.md");
  const traversalPipelineResult = await runRenderedInitPipeline(
    traversalPipelineRoot,
    [createRenderedArtifact("../outside.md", "# Outside\n")],
    {
      fileSystemAdapter: createFilesystemGenerationAdapter({
        targetRoot: traversalPipelineRoot,
      }),
      writeMode: "write",
    },
  );

  assert.equal(
    traversalPipelineResult.ok,
    false,
    "path traversal init pipeline generation should fail",
  );
  assert.equal(
    await pathExists(outsidePipelinePath),
    false,
    "path traversal init pipeline generation must not write outside targetRoot",
  );
  assert.ok(
    resultIssueCodes(traversalPipelineResult).includes(
      "generation_target_outside_root",
    ),
    "path traversal init pipeline generation should report target_outside_root",
  );
  assert.equal(
    generatedFileFor(traversalPipelineResult, "../outside.md")?.status,
    "blocked",
    "path traversal init pipeline generation should report blocked file status",
  );

  console.log("filesystem generation writer smoke tests passed");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
