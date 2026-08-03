import type {
  ProjectIntelligenceDetectorInput,
  ProjectIntelligenceDetectorIssue,
  ProjectIntelligenceIgnoreRule,
  ProjectIntelligenceScanEntry,
} from "./intelligence-detector.js";
import type { ProjectIntelligenceScanCollectorResult } from "./intelligence-scan-collector.js";
import {
  collectProjectScanEntries,
  createDefaultProjectIntelligenceDetectorInput,
  normalizeProjectScanEntry,
} from "./intelligence-scan-collector.js";

const exampleProjectRoot = "/workspace/example-project";

export const defaultScanCollectorInput =
  createDefaultProjectIntelligenceDetectorInput(exampleProjectRoot);

export const conservativeScanInput: ProjectIntelligenceDetectorInput = {
  ...defaultScanCollectorInput,
  mode: "inventory",
  scope: "known_paths",
  options: {
    ...defaultScanCollectorInput.options,
    includeHiddenFiles: false,
    includeInfrastructure: false,
    includeMonorepoSignals: false,
    includeDependencySignals: false,
  },
  limits: {
    ...defaultScanCollectorInput.limits,
    maxDepth: 3,
    maxFiles: 25,
  },
};

export const monorepoAwareScanInput: ProjectIntelligenceDetectorInput = {
  ...defaultScanCollectorInput,
  mode: "profile",
  scope: "bounded_workspace",
  options: {
    ...defaultScanCollectorInput.options,
    includeHiddenFiles: true,
    includeInfrastructure: true,
    includeMonorepoSignals: true,
    includeDependencySignals: true,
  },
  limits: {
    ...defaultScanCollectorInput.limits,
    maxDepth: 8,
    maxFiles: 250,
  },
};

export const scanCollectorIgnoreRules: readonly ProjectIntelligenceIgnoreRule[] =
  [
    {
      path: "src/generated.ts",
      directory: undefined,
      extension: undefined,
      pattern: undefined,
    },
    {
      path: undefined,
      directory: "vendor",
      extension: undefined,
      pattern: undefined,
    },
    {
      path: undefined,
      directory: undefined,
      extension: ".map",
      pattern: undefined,
    },
  ];

export const scanCollectorIgnoredInput: ProjectIntelligenceDetectorInput = {
  ...monorepoAwareScanInput,
  ignoreRules: scanCollectorIgnoreRules,
};

const rawExampleScanEntries: readonly ProjectIntelligenceScanEntry[] = [
  {
    path: "src/index.ts",
    kind: "file",
    sizeBytes: 320,
    extension: undefined,
    basename: "index.ts",
    depth: 0,
  },
  {
    path: "package.json",
    kind: "file",
    sizeBytes: 880,
    extension: undefined,
    basename: "package.json",
    depth: 0,
  },
  {
    path: ".github/workflows/ci.yml",
    kind: "file",
    sizeBytes: 640,
    extension: undefined,
    basename: "ci.yml",
    depth: 0,
  },
  {
    path: "src/",
    kind: "directory",
    sizeBytes: undefined,
    extension: undefined,
    basename: "src",
    depth: 0,
  },
  {
    path: "Dockerfile",
    kind: "file",
    sizeBytes: 420,
    extension: undefined,
    basename: "Dockerfile",
    depth: 0,
  },
  {
    path: "tsconfig.json",
    kind: "file",
    sizeBytes: 260,
    extension: undefined,
    basename: "tsconfig.json",
    depth: 0,
  },
  {
    path: "composer.json",
    kind: "file",
    sizeBytes: 520,
    extension: undefined,
    basename: "composer.json",
    depth: 0,
  },
];

export const normalizedExampleScanEntries: readonly ProjectIntelligenceScanEntry[] =
  rawExampleScanEntries
    .map((entry) => normalizeProjectScanEntry(entry))
    .sort((left, right) => left.path.localeCompare(right.path));

export const deterministicScanEntryOrderingExpectation: readonly string[] = [
  ".github/workflows/ci.yml",
  "Dockerfile",
  "composer.json",
  "package.json",
  "src",
  "src/index.ts",
  "tsconfig.json",
];

export const scanEntrySummaryExample: ProjectIntelligenceScanCollectorResult["summary"] =
  {
    scannedEntries: normalizedExampleScanEntries.length,
    skippedEntries: 3,
    issueCount: 2,
    reachedLimits: ["maxFileSizeBytes", "timeoutMs_recorded"],
  };

export const skippedAndIssueRepresentationExample: readonly ProjectIntelligenceDetectorIssue[] =
  [
    {
      code: "collector.file.too_large",
      message:
        "File was skipped because it exceeds the configured file size limit.",
      severity: "warning",
      path: "fixtures/large.json",
    },
    {
      code: "collector.ignore_rule.pattern_unsupported",
      message:
        'Ignore pattern "**/*.tmp" was not applied because glob matching is not implemented.',
      severity: "info",
      path: undefined,
    },
  ];

export function normalizeProjectScanEntryExample(): ProjectIntelligenceScanEntry {
  return normalizeProjectScanEntry({
    path: "src/index.ts",
    kind: "file",
    sizeBytes: 320,
    extension: undefined,
    basename: "index.ts",
    depth: 0,
  });
}

export async function collectConservativeProjectScanEntries(
  projectRoot: string,
): Promise<ProjectIntelligenceScanCollectorResult> {
  return collectProjectScanEntries({
    ...conservativeScanInput,
    projectRoot,
  });
}

export async function collectMonorepoAwareProjectScanEntries(
  projectRoot: string,
): Promise<ProjectIntelligenceScanCollectorResult> {
  return collectProjectScanEntries({
    ...monorepoAwareScanInput,
    projectRoot,
  });
}
