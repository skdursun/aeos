import type { ProjectEvidence } from "./intelligence.js";
import type { ProjectIntelligenceScanEntry } from "./intelligence-detector.js";
import type { ProjectIntelligenceSignalDefinition } from "./intelligence-signals.js";

import {
  createProjectEvidenceFromSignalMatch,
  matchProjectIntelligenceSignals,
  matchProjectScanEntrySignals,
} from "./intelligence-signal-matcher.js";

const packageJsonEntry = scanFile("package.json", 1_200);
const tsconfigJsonEntry = scanFile("tsconfig.json", 320);
const srcIndexTsEntry = scanFile("src/index.ts", 640);
const wpConfigPhpEntry = scanFile("wp-config.php", 840);
const wpContentEntry = scanDirectory("wp-content");
const dockerfileEntry = scanFile("Dockerfile", 420);
const githubWorkflowEntry = scanFile(".github/workflows/ci.yml", 760);
const pnpmWorkspaceEntry = scanFile("pnpm-workspace.yaml", 220);

export const signalMatcherExampleScanEntries = [
  packageJsonEntry,
  tsconfigJsonEntry,
  srcIndexTsEntry,
  wpConfigPhpEntry,
  wpContentEntry,
  dockerfileEntry,
  githubWorkflowEntry,
  pnpmWorkspaceEntry,
] as const satisfies readonly ProjectIntelligenceScanEntry[];

const typescriptNodeSignals = [
  signal(
    "example.language.typescript.tsconfig",
    "language",
    "typescript",
    "config",
    "basename",
    "tsconfig.json",
    "high",
    "TypeScript configuration is present.",
  ),
  signal(
    "example.language.typescript.source",
    "language",
    "typescript",
    "file",
    "extension",
    ".ts",
    "low",
    "TypeScript source files are present.",
  ),
  signal(
    "example.language.javascript.package_json",
    "language",
    "javascript",
    "manifest",
    "manifest_name",
    "package.json",
    "high",
    "Node package manifest is present.",
  ),
  signal(
    "example.runtime.node.package_json",
    "runtime",
    "node",
    "manifest",
    "manifest_name",
    "package.json",
    "high",
    "Node runtime manifest is present.",
  ),
] as const satisfies readonly ProjectIntelligenceSignalDefinition[];

const wordpressSignals = [
  signal(
    "example.language.php.wp_config",
    "language",
    "php",
    "file",
    "basename",
    "wp-config.php",
    "high",
    "WordPress PHP configuration is present.",
  ),
  signal(
    "example.runtime.php.extension",
    "runtime",
    "php",
    "file",
    "extension",
    ".php",
    "low",
    "PHP files are present.",
  ),
  signal(
    "example.framework.wordpress.wp_config",
    "framework",
    "wordpress",
    "file",
    "basename",
    "wp-config.php",
    "high",
    "WordPress configuration file is present.",
  ),
  signal(
    "example.framework.wordpress.content_directory",
    "framework",
    "wordpress",
    "directory",
    "directory_name",
    "wp-content",
    "high",
    "WordPress content directory is present.",
  ),
] as const satisfies readonly ProjectIntelligenceSignalDefinition[];

const infrastructureSignals = [
  signal(
    "example.infrastructure.docker.dockerfile",
    "infrastructure",
    "docker",
    "config",
    "basename",
    "Dockerfile",
    "high",
    "Dockerfile is present.",
  ),
  signal(
    "example.infrastructure.github_actions.workflow",
    "infrastructure",
    "github_actions",
    "config",
    "relative_path",
    ".github/workflows/ci.yml",
    "high",
    "A GitHub Actions workflow file is present.",
  ),
  signal(
    "example.monorepo.pnpm.workspace",
    "monorepo",
    "pnpm_workspace",
    "config",
    "basename",
    "pnpm-workspace.yaml",
    "high",
    "pnpm workspace manifest is present.",
  ),
] as const satisfies readonly ProjectIntelligenceSignalDefinition[];

const unsupportedDependencyNameSignals = [
  signal(
    "example.framework.nextjs.dependency",
    "framework",
    "nextjs",
    "dependency",
    "dependency_name",
    "next",
    "medium",
    "Next.js package dependency is declared.",
  ),
] as const satisfies readonly ProjectIntelligenceSignalDefinition[];

export const srcIndexSignalMatches = matchProjectScanEntrySignals(
  srcIndexTsEntry,
  typescriptNodeSignals,
);

export const srcIndexEvidenceFromSignalMatch =
  createProjectEvidenceFromSignalMatch({
    scanEntry: srcIndexTsEntry,
    signal: typescriptNodeSignals[1],
  });

export const typescriptNodeEvidenceResult = matchProjectIntelligenceSignals(
  [srcIndexTsEntry, packageJsonEntry, tsconfigJsonEntry],
  typescriptNodeSignals,
);

export const phpWordpressEvidenceResult = matchProjectIntelligenceSignals(
  [wpContentEntry, wpConfigPhpEntry],
  wordpressSignals,
);

export const infrastructureEvidenceResult = matchProjectIntelligenceSignals(
  [pnpmWorkspaceEntry, githubWorkflowEntry, dockerfileEntry],
  infrastructureSignals,
);

export const unsupportedDependencyNameSignalIssueResult =
  matchProjectIntelligenceSignals(
    [packageJsonEntry],
    unsupportedDependencyNameSignals,
  );

export const duplicateSuppressionResult = matchProjectIntelligenceSignals(
  [packageJsonEntry, packageJsonEntry],
  typescriptNodeSignals,
);

export const expectedDuplicateSuppressionEvidenceIds = [
  "evidence:package.json:example.language.javascript.package_json",
  "evidence:package.json:example.runtime.node.package_json",
] as const;

export const expectedDeterministicInfrastructureEvidenceIds = [
  "evidence:.github/workflows/ci.yml:example.infrastructure.github_actions.workflow",
  "evidence:Dockerfile:example.infrastructure.docker.dockerfile",
  "evidence:pnpm-workspace.yaml:example.monorepo.pnpm.workspace",
] as const;

export function toEvidenceIds(
  evidence: readonly ProjectEvidence[],
): readonly string[] {
  return evidence.map((entry) => entry.id);
}

function scanFile(
  path: string,
  sizeBytes: number,
): ProjectIntelligenceScanEntry {
  const basename = getBasename(path);

  return {
    path,
    kind: "file",
    sizeBytes,
    extension: getExtension(basename),
    basename,
    depth: getDepth(path),
  };
}

function scanDirectory(path: string): ProjectIntelligenceScanEntry {
  return {
    path,
    kind: "directory",
    sizeBytes: undefined,
    extension: undefined,
    basename: getBasename(path),
    depth: getDepth(path),
  };
}

function signal(
  id: ProjectIntelligenceSignalDefinition["id"],
  category: ProjectIntelligenceSignalDefinition["category"],
  target: ProjectIntelligenceSignalDefinition["target"],
  source: ProjectIntelligenceSignalDefinition["source"],
  matchKind: ProjectIntelligenceSignalDefinition["matchKind"],
  pattern: ProjectIntelligenceSignalDefinition["pattern"],
  confidence: ProjectIntelligenceSignalDefinition["confidence"],
  reason: ProjectIntelligenceSignalDefinition["reason"],
): ProjectIntelligenceSignalDefinition {
  return {
    id,
    category,
    target,
    source,
    matchKind,
    pattern,
    confidence,
    reason,
  };
}

function getBasename(path: string): string {
  const separatorIndex = path.lastIndexOf("/");

  if (separatorIndex === -1) {
    return path;
  }

  return path.slice(separatorIndex + 1);
}

function getExtension(basename: string): string | undefined {
  const extensionStartIndex = basename.lastIndexOf(".");

  if (extensionStartIndex <= 0) {
    return undefined;
  }

  return basename.slice(extensionStartIndex);
}

function getDepth(path: string): number {
  if (path.length === 0) {
    return 0;
  }

  return path.split("/").length - 1;
}
