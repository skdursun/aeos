import type {
  ProjectIntelligenceDetectorInput,
  ProjectIntelligenceDetectorIssue,
  ProjectIntelligenceScanEntry,
  ProjectIntelligenceScanEntryKind,
} from "./intelligence-detector.js";

import {
  createProjectIntelligenceDetectorResult,
  detectProjectIntelligence,
  summarizeProjectIntelligenceDetectorResult,
} from "./intelligence-detector-orchestrator.js";

import type {
  ProjectIntelligenceScanCollectorResult,
} from "./intelligence-scan-collector.js";

import {
  createDefaultProjectIntelligenceDetectorInput,
} from "./intelligence-scan-collector.js";

import {
  matchProjectIntelligenceSignals,
} from "./intelligence-signal-matcher.js";

export const defaultDetectorInputExample =
  createDefaultProjectIntelligenceDetectorInput("/workspace/app");

export const conservativeLocalScanInputExample: ProjectIntelligenceDetectorInput = {
  ...defaultDetectorInputExample,
  mode: "profile",
  scope: "known_paths",
  options: {
    ...defaultDetectorInputExample.options,
    includeHiddenFiles: false,
    followSymlinks: false,
    includeLockfiles: true,
    includeInfrastructure: false,
    includeMonorepoSignals: false,
    includeDependencySignals: false,
  },
  limits: {
    ...defaultDetectorInputExample.limits,
    maxDepth: 4,
    maxFiles: 200,
    maxEvidenceEntries: 50,
  },
};

export const monorepoAwareDetectorInputExample: ProjectIntelligenceDetectorInput = {
  ...defaultDetectorInputExample,
  projectRoot: "/workspace/platform",
  mode: "inventory",
  scope: "bounded_workspace",
  options: {
    ...defaultDetectorInputExample.options,
    includeInfrastructure: true,
    includeMonorepoSignals: true,
  },
  limits: {
    ...defaultDetectorInputExample.limits,
    maxDepth: 8,
    maxFiles: 2_000,
    maxEvidenceEntries: 150,
  },
};

export async function detectWithDefaultProjectIntelligenceInput(
  projectRoot: string,
) {
  return detectProjectIntelligence(
    createDefaultProjectIntelligenceDetectorInput(projectRoot),
  );
}

const typescriptNextJsScanEntries: readonly ProjectIntelligenceScanEntry[] = [
  scanEntry("package.json", "file", 1_200),
  scanEntry("pnpm-lock.yaml", "file", 80_000),
  scanEntry("tsconfig.json", "file", 600),
  scanEntry("next.config.ts", "file", 220),
  scanEntry("app", "directory"),
  scanEntry("app/page.tsx", "file", 2_400),
];

const phpWordPressScanEntries: readonly ProjectIntelligenceScanEntry[] = [
  scanEntry("composer.json", "file", 900),
  scanEntry("composer.lock", "file", 64_000),
  scanEntry("wp-config.php", "file", 3_200),
  scanEntry("wp-content", "directory"),
  scanEntry("wp-content/themes/custom/functions.php", "file", 4_800),
];

const infrastructureHeavyScanEntries: readonly ProjectIntelligenceScanEntry[] = [
  scanEntry("Dockerfile", "file", 500),
  scanEntry("docker-compose.yml", "file", 1_500),
  scanEntry(".github", "directory"),
  scanEntry(".github/workflows", "directory"),
  scanEntry("infra/main.tf", "file", 2_000),
  scanEntry("infra/variables.tf", "file", 900),
  scanEntry("pnpm-workspace.yaml", "file", 300),
  scanEntry("packages", "directory"),
  scanEntry("packages/web", "directory"),
];

const emptyScanEntries: readonly ProjectIntelligenceScanEntry[] = [
  scanEntry("README", "file", 300),
  scanEntry("notes", "directory"),
];

export const typescriptNextJsDetectorResultExample =
  createProjectIntelligenceDetectorResult(
    conservativeLocalScanInputExample,
    collectorResult(typescriptNextJsScanEntries, []),
    matchProjectIntelligenceSignals(typescriptNextJsScanEntries),
  );

export const phpWordPressDetectorResultExample =
  createProjectIntelligenceDetectorResult(
    {
      ...conservativeLocalScanInputExample,
      projectRoot: "/workspace/wordpress-site",
    },
    collectorResult(phpWordPressScanEntries, []),
    matchProjectIntelligenceSignals(phpWordPressScanEntries),
  );

export const infrastructureHeavyDetectorResultExample =
  createProjectIntelligenceDetectorResult(
    monorepoAwareDetectorInputExample,
    collectorResult(infrastructureHeavyScanEntries, [
      {
        code: "collector.file.too_large",
        message: "File was skipped because it exceeds the configured file size limit.",
        severity: "warning",
        path: "infra/generated-plan.json",
      },
    ]),
    matchProjectIntelligenceSignals(infrastructureHeavyScanEntries),
  );

export const emptyNoSignalDetectorResultExample =
  createProjectIntelligenceDetectorResult(
    {
      ...conservativeLocalScanInputExample,
      projectRoot: "/workspace/empty",
    },
    collectorResult(emptyScanEntries, []),
    matchProjectIntelligenceSignals(emptyScanEntries),
  );

export const detectorResultShapeExample = {
  profile: typescriptNextJsDetectorResultExample.profile,
  scannedEntries: typescriptNextJsDetectorResultExample.scannedEntries,
  issues: typescriptNextJsDetectorResultExample.issues,
  summary: typescriptNextJsDetectorResultExample.summary,
};

export const profileSummaryUsageExample =
  typescriptNextJsDetectorResultExample.profile.summary;

export const issuePreservationExample = {
  detectorIssues: infrastructureHeavyDetectorResultExample.issues,
  profileIssues: infrastructureHeavyDetectorResultExample.profile.issues,
  issueCount: infrastructureHeavyDetectorResultExample.summary.issueCount,
};

export const deterministicResultExpectationExample = {
  primaryLanguage:
    typescriptNextJsDetectorResultExample.profile.summary.primaryLanguage,
  primaryFramework:
    typescriptNextJsDetectorResultExample.profile.summary.primaryFramework,
  primaryRuntime:
    typescriptNextJsDetectorResultExample.profile.summary.primaryRuntime,
  scannedEntryCount: typescriptNextJsDetectorResultExample.summary.scannedEntryCount,
  evidenceSignals: typescriptNextJsDetectorResultExample.profile.evidence.map(
    (evidence) => evidence.signal,
  ),
} as const;

export const explicitSummaryUsageExample =
  summarizeProjectIntelligenceDetectorResult(
    monorepoAwareDetectorInputExample,
    infrastructureHeavyDetectorResultExample.profile,
    collectorResult(infrastructureHeavyScanEntries, []),
    infrastructureHeavyDetectorResultExample.issues,
  );

function collectorResult(
  entries: readonly ProjectIntelligenceScanEntry[],
  issues: readonly ProjectIntelligenceDetectorIssue[],
): ProjectIntelligenceScanCollectorResult {
  return {
    entries,
    issues,
    summary: {
      scannedEntries: entries.length,
      skippedEntries: 0,
      issueCount: issues.length,
      reachedLimits: [],
    },
  };
}

function scanEntry(
  path: string,
  kind: ProjectIntelligenceScanEntryKind,
  sizeBytes?: number,
): ProjectIntelligenceScanEntry {
  const basename = getBasename(path);

  return {
    path,
    kind,
    sizeBytes,
    extension: getExtension(basename),
    basename,
    depth: getDepth(path),
  };
}

function getBasename(path: string): string {
  const normalizedPath = path.replaceAll("\\", "/").replace(/\/+$/, "");
  const separatorIndex = normalizedPath.lastIndexOf("/");

  if (separatorIndex === -1) {
    return normalizedPath;
  }

  return normalizedPath.slice(separatorIndex + 1);
}

function getExtension(basename: string): string | undefined {
  const extensionStartIndex = basename.lastIndexOf(".");

  if (extensionStartIndex <= 0) {
    return undefined;
  }

  return basename.slice(extensionStartIndex);
}

function getDepth(path: string): number {
  const normalizedPath = path.replaceAll("\\", "/").replace(/^\.\/+/, "");

  if (normalizedPath === "") {
    return 0;
  }

  return normalizedPath.split("/").length - 1;
}
