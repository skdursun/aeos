import assert from "node:assert/strict";
import { mkdtemp, rm, symlink, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  collectProjectScanEntries,
  createDefaultProjectIntelligenceDetectorInput,
  listProjectIntelligenceSignalDefinitions,
  matchProjectIntelligenceSignals,
} from "../dist/index.js";

const createdRoots = [];
const skipped = [];
const defaultSignalDefinitions = listProjectIntelligenceSignalDefinitions();

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

function scanEntry(path, kind = "file") {
  const normalizedPath = path.replaceAll("\\", "/").replace(/^\.\/+/, "");
  const basename = normalizedPath.split("/").filter(Boolean).at(-1) ?? normalizedPath;
  const extensionStartIndex = basename.lastIndexOf(".");

  return {
    path: normalizedPath,
    kind,
    sizeBytes: undefined,
    extension: extensionStartIndex > 0 ? basename.slice(extensionStartIndex) : undefined,
    basename,
    depth: normalizedPath.split("/").filter(Boolean).length - 1,
  };
}

function signalIds(result) {
  return result.evidence.map((evidence) => evidence.signal);
}

function evidenceKeys(result) {
  return result.evidence.map((evidence) => `${evidence.path}:${evidence.signal}`);
}

function hasSignalDefinition(signalId) {
  return defaultSignalDefinitions.some((definition) => definition.id === signalId);
}

function assertEvidenceSignals(result, expectedSignalIds) {
  const ids = signalIds(result);

  for (const expectedSignalId of expectedSignalIds) {
    assert.ok(ids.includes(expectedSignalId), `Expected evidence for ${expectedSignalId}.`);
  }
}

function assertEvidenceSignalIfSupported(result, signalId) {
  if (hasSignalDefinition(signalId)) {
    assertEvidenceSignals(result, [signalId]);
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

function smokeSignalMatcherTypescriptNodeEvidence() {
  const result = matchProjectIntelligenceSignals([
    scanEntry("package.json"),
    scanEntry("tsconfig.json"),
    scanEntry("src/index.ts"),
    scanEntry("pnpm-lock.yaml"),
  ]);

  assertEvidenceSignals(result, [
    "language.typescript.tsconfig",
    "language.typescript.ts",
  ]);
  assertEvidenceSignalIfSupported(result, "language.javascript.package_json");
  assertEvidenceSignalIfSupported(result, "runtime.node.package_json");
  assertEvidenceSignalIfSupported(result, "package_manager.pnpm.lockfile");
  assert.equal(result.summary.scannedEntries, 4);
  assert.equal(result.summary.evidenceCount, result.evidence.length);
}

function smokeSignalMatcherPhpWordpressEvidence() {
  const result = matchProjectIntelligenceSignals([
    scanEntry("composer.json"),
    scanEntry("wp-config.php"),
    scanEntry("wp-content", "directory"),
    scanEntry("index.php"),
  ]);

  assertEvidenceSignals(result, [
    "language.php.composer_json",
    "language.php.php",
    "language.php.wp_config",
    "framework.wordpress.wp_config",
    "framework.wordpress.wp_content",
    "runtime.php.composer_json",
    "runtime.php.php",
  ]);
  assertEvidenceSignalIfSupported(result, "package_manager.composer.manifest");
}

function smokeSignalMatcherInfrastructureEvidence() {
  const result = matchProjectIntelligenceSignals([
    scanEntry("Dockerfile"),
    scanEntry("docker-compose.yml"),
    scanEntry(".github/workflows", "directory"),
    scanEntry(".github/workflows/ci.yml"),
    scanEntry("main.tf"),
  ]);

  assertEvidenceSignals(result, [
    "infrastructure.docker.dockerfile",
    "infrastructure.docker.compose_yml",
    "infrastructure.github_actions.workflows",
    "infrastructure.terraform.tf",
    "infrastructure.terraform.main_tf",
  ]);
}

function smokeSignalMatcherDuplicateSuppression() {
  const result = matchProjectIntelligenceSignals([
    scanEntry("tsconfig.json"),
    scanEntry("./tsconfig.json"),
    scanEntry("src/index.ts"),
    scanEntry("src/index.ts"),
  ]);
  const keys = evidenceKeys(result);
  const uniqueKeys = new Set(keys);

  assert.equal(keys.length, uniqueKeys.size, "Evidence must not duplicate path + signal pairs.");
  assert.equal(
    result.evidence.filter((evidence) => evidence.signal === "language.typescript.tsconfig")
      .length,
    1,
  );
  assert.equal(
    result.evidence.filter((evidence) => evidence.signal === "language.typescript.ts")
      .length,
    1,
  );
}

function smokeSignalMatcherDeterministicOrdering() {
  const result = matchProjectIntelligenceSignals([
    scanEntry("src/z.ts"),
    scanEntry("package.json"),
    scanEntry("main.tf"),
    scanEntry("Dockerfile"),
    scanEntry("src/a.ts"),
  ]);
  const keys = evidenceKeys(result);
  const sortedKeys = [...keys].sort((left, right) => {
    const [leftPath, leftSignal] = left.split(":");
    const [rightPath, rightSignal] = right.split(":");
    const pathComparison = leftPath.localeCompare(rightPath);

    if (pathComparison !== 0) {
      return pathComparison;
    }

    return leftSignal.localeCompare(rightSignal);
  });

  assert.deepEqual(keys, sortedKeys, "Evidence must be sorted by path and signal.");
}

function smokeSignalMatcherUnsupportedDependencyName() {
  const dependencySignalDefinitions = [
    {
      id: "framework.example.dependency",
      category: "framework",
      target: "react",
      source: "dependency",
      matchKind: "dependency_name",
      pattern: "react",
      confidence: "medium",
      reason: "Example dependency signal for smoke coverage.",
    },
  ];

  const result = matchProjectIntelligenceSignals(
    [scanEntry("package.json")],
    dependencySignalDefinitions,
  );

  assert.deepEqual(result.evidence, []);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].code, "matcher.signal.dependency_name_unsupported");
  assert.equal(result.summary.issueCount, 1);
}

function smokeSignalMatcherCustomDefinitionFiltering() {
  const customSignalDefinitions = [
    {
      id: "language.custom.typescript_config",
      category: "language",
      target: "typescript",
      source: "config",
      matchKind: "basename",
      pattern: "tsconfig.json",
      confidence: "high",
      reason: "Custom TypeScript config signal.",
    },
    {
      id: "infrastructure.custom.dockerfile",
      category: "infrastructure",
      target: "docker",
      source: "config",
      matchKind: "basename",
      pattern: "Dockerfile",
      confidence: "high",
      reason: "Custom Dockerfile signal.",
    },
  ];

  const result = matchProjectIntelligenceSignals(
    [
      scanEntry("package.json"),
      scanEntry("tsconfig.json"),
      scanEntry("Dockerfile"),
      scanEntry("src/index.ts"),
    ],
    customSignalDefinitions,
  );

  assert.deepEqual(signalIds(result), [
    "infrastructure.custom.dockerfile",
    "language.custom.typescript_config",
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
  smokeSignalMatcherTypescriptNodeEvidence();
  smokeSignalMatcherPhpWordpressEvidence();
  smokeSignalMatcherInfrastructureEvidence();
  smokeSignalMatcherDuplicateSuppression();
  smokeSignalMatcherDeterministicOrdering();
  smokeSignalMatcherUnsupportedDependencyName();
  smokeSignalMatcherCustomDefinitionFiltering();

  if (skipped.length > 0) {
    console.log(`smoke: ok (${skipped.join("; ")})`);
  } else {
    console.log("smoke: ok");
  }
} finally {
  await cleanup();
}
