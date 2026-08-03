import assert from "node:assert/strict";
import { mkdtemp, rm, symlink, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  collectProjectScanEntries,
  createDefaultProjectIntelligenceDetectorInput,
} from "../dist/index.js";

const createdRoots = [];
const skipped = [];

function inputFor(projectRoot, overrides = {}) {
  const defaults = createDefaultProjectIntelligenceDetectorInput(projectRoot);

  return {
    ...defaults,
    ...overrides,
    options: {
      ...defaults.options,
      ...(overrides.options ?? {}),
    },
    limits: {
      ...defaults.limits,
      ...(overrides.limits ?? {}),
    },
    ignoreRules: overrides.ignoreRules ?? defaults.ignoreRules,
  };
}

async function createTempProject(name) {
  const root = await mkdtemp(path.join(os.tmpdir(), `aeos-projects-${name}-`));
  createdRoots.push(root);
  return root;
}

async function writeProjectFile(projectRoot, relativePath, contents = "") {
  const absolutePath = path.join(projectRoot, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, contents);
}

function pathsFrom(result) {
  return result.entries.map((entry) => entry.path);
}

function assertIncludesAll(paths, expectedPaths) {
  for (const expectedPath of expectedPaths) {
    assert.ok(paths.includes(expectedPath), `Expected ${expectedPath} to be included.`);
  }
}

function assertExcludesAll(paths, expectedPaths) {
  for (const expectedPath of expectedPaths) {
    assert.ok(!paths.includes(expectedPath), `Expected ${expectedPath} to be excluded.`);
  }
}

async function smokeBasicDeterministicScan() {
  const root = await createTempProject("basic");

  await writeProjectFile(root, "package.json", "not json, and should not be parsed");
  await writeProjectFile(root, "tsconfig.json", "{}");
  await writeProjectFile(root, "src/index.ts", "export const index = true;");
  await writeProjectFile(root, "src/app.ts", "export const app = true;");

  const result = await collectProjectScanEntries(
    inputFor(root, {
      options: {
        includeDependencySignals: true,
      },
    }),
  );
  const paths = pathsFrom(result);
  const sortedPaths = [...paths].sort((left, right) => left.localeCompare(right));

  assertIncludesAll(paths, [
    "package.json",
    "src",
    "src/app.ts",
    "src/index.ts",
    "tsconfig.json",
  ]);
  assert.deepEqual(paths, sortedPaths, "Scan entries must be sorted by path.");
  assert.equal(
    result.entries.some((entry) => Object.hasOwn(entry, "content")),
    false,
    "Scan entries must not expose file content.",
  );
}

async function smokeHiddenFileHandling() {
  const root = await createTempProject("hidden");

  await writeProjectFile(root, ".env", "SECRET=value");
  await writeProjectFile(root, ".github/workflows/ci.yml", "name: ci");

  const hiddenExcluded = await collectProjectScanEntries(
    inputFor(root, {
      options: {
        includeHiddenFiles: false,
        includeInfrastructure: true,
      },
    }),
  );

  assertExcludesAll(pathsFrom(hiddenExcluded), [".env", ".github/workflows/ci.yml"]);

  const hiddenIncluded = await collectProjectScanEntries(
    inputFor(root, {
      options: {
        includeHiddenFiles: true,
        includeInfrastructure: true,
      },
    }),
  );

  assertIncludesAll(pathsFrom(hiddenIncluded), [
    ".github",
    ".github/workflows",
    ".github/workflows/ci.yml",
    ".env",
  ]);
}

async function smokeIgnoreRules() {
  const root = await createTempProject("ignore");

  await writeProjectFile(root, "node_modules/pkg/index.js", "module.exports = {};");
  await writeProjectFile(root, "debug.log", "ignored");
  await writeProjectFile(root, "src/ignored.ts", "ignored");
  await writeProjectFile(root, "src/included.ts", "included");

  const result = await collectProjectScanEntries(
    inputFor(root, {
      ignoreRules: [
        { path: undefined, directory: "node_modules", extension: undefined, pattern: undefined },
        { path: undefined, directory: undefined, extension: ".log", pattern: undefined },
        { path: "src/ignored.ts", directory: undefined, extension: undefined, pattern: undefined },
      ],
    }),
  );
  const paths = pathsFrom(result);

  assertIncludesAll(paths, ["src", "src/included.ts"]);
  assertExcludesAll(paths, [
    "node_modules",
    "node_modules/pkg/index.js",
    "debug.log",
    "src/ignored.ts",
  ]);
}

async function smokeLimits() {
  const root = await createTempProject("limits");

  await writeProjectFile(root, "a.txt", "a");
  await writeProjectFile(root, "b.txt", "b");
  await writeProjectFile(root, "z/deep/file.txt", "deep");

  const result = await collectProjectScanEntries(
    inputFor(root, {
      limits: {
        maxDepth: 0,
        maxFiles: 1,
      },
    }),
  );

  assert.ok(result.entries.length <= 2, "Collector should stop within configured limits.");
  assert.ok(
    result.summary.reachedLimits.includes("maxFiles") ||
      result.summary.reachedLimits.includes("maxDepth"),
    "Collector should report at least one reached limit.",
  );
}

async function smokeSymlinkSafety() {
  const root = await createTempProject("symlink");

  await writeProjectFile(root, "target/inside.txt", "inside");

  try {
    await symlink(path.join(root, "target"), path.join(root, "linked-target"), "dir");
  } catch (error) {
    skipped.push(`symlink creation skipped: ${error.code ?? "unknown"}`);
    return;
  }

  const result = await collectProjectScanEntries(
    inputFor(root, {
      options: {
        followSymlinks: false,
      },
    }),
  );
  const paths = pathsFrom(result);

  assertIncludesAll(paths, ["linked-target"]);
  assert.equal(
    result.entries.find((entry) => entry.path === "linked-target")?.kind,
    "symlink",
  );
  assertExcludesAll(paths, ["linked-target/inside.txt"]);
}

async function smokeOptionBasedFiltering() {
  const root = await createTempProject("options");

  await writeProjectFile(root, "package.json", "{}");
  await writeProjectFile(root, "pnpm-lock.yaml", "lockfile");
  await writeProjectFile(root, "Dockerfile", "FROM scratch");
  await writeProjectFile(root, ".github/workflows/ci.yml", "name: ci");
  await writeProjectFile(root, "src/index.ts", "export {};");

  const result = await collectProjectScanEntries(
    inputFor(root, {
      options: {
        includeHiddenFiles: true,
        includeLockfiles: false,
        includeInfrastructure: false,
        includeDependencySignals: false,
      },
    }),
  );
  const paths = pathsFrom(result);

  assertIncludesAll(paths, ["src", "src/index.ts"]);
  assertExcludesAll(paths, [
    "pnpm-lock.yaml",
    "Dockerfile",
    ".github",
    ".github/workflows/ci.yml",
    "package.json",
  ]);
}

async function cleanup() {
  for (const root of createdRoots.reverse()) {
    await rm(root, { recursive: true, force: true });
  }
}

try {
  await smokeBasicDeterministicScan();
  await smokeHiddenFileHandling();
  await smokeIgnoreRules();
  await smokeLimits();
  await smokeSymlinkSafety();
  await smokeOptionBasedFiltering();

  if (skipped.length > 0) {
    console.log(`smoke: ok (${skipped.join("; ")})`);
  } else {
    console.log("smoke: ok");
  }
} finally {
  await cleanup();
}
