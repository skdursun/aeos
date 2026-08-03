import type {
  ProjectIntelligenceDetectorInput,
  ProjectIntelligenceDetectorIssue,
  ProjectIntelligenceDetectorLimits,
  ProjectIntelligenceDetectorMode,
  ProjectIntelligenceDetectorOptions,
  ProjectIntelligenceDetectorResult,
  ProjectIntelligenceDetectorScope,
  ProjectIntelligenceIgnoreRule,
  ProjectIntelligenceScanEntry,
  ProjectIntelligenceScanEntryKind,
} from "./intelligence-detector.js";

export const detectorExampleMode: ProjectIntelligenceDetectorMode = "profile";

export const detectorExampleScope: ProjectIntelligenceDetectorScope =
  "bounded_workspace";

export const detectorExampleScanEntryKind: ProjectIntelligenceScanEntryKind =
  "file";

export const conservativeDetectorOptions: ProjectIntelligenceDetectorOptions = {
  includeHiddenFiles: false,
  followSymlinks: false,
  includeLockfiles: true,
  includeInfrastructure: false,
  includeMonorepoSignals: false,
  includeDependencySignals: false,
};

export const monorepoDetectorOptions: ProjectIntelligenceDetectorOptions = {
  includeHiddenFiles: true,
  followSymlinks: false,
  includeLockfiles: true,
  includeInfrastructure: true,
  includeMonorepoSignals: true,
  includeDependencySignals: true,
};

export const conservativeDetectorLimits: ProjectIntelligenceDetectorLimits = {
  maxDepth: 6,
  maxFiles: 1_000,
  maxFileSizeBytes: 1_000_000,
  maxEvidenceEntries: 100,
  timeoutMs: 5_000,
};

export const monorepoDetectorLimits: ProjectIntelligenceDetectorLimits = {
  maxDepth: 4,
  maxFiles: 300,
  maxFileSizeBytes: 500_000,
  maxEvidenceEntries: 50,
  timeoutMs: 2_000,
};

export const defaultIgnoreRules: readonly ProjectIntelligenceIgnoreRule[] = [
  {
    path: undefined,
    directory: "node_modules",
    extension: undefined,
    pattern: undefined,
  },
  {
    path: undefined,
    directory: "dist",
    extension: undefined,
    pattern: undefined,
  },
  {
    path: undefined,
    directory: undefined,
    extension: ".log",
    pattern: undefined,
  },
];

export const conservativeLocalScanInput: ProjectIntelligenceDetectorInput = {
  projectRoot: "/workspace/app",
  mode: "profile",
  scope: "root",
  options: conservativeDetectorOptions,
  limits: conservativeDetectorLimits,
  ignoreRules: defaultIgnoreRules,
};

export const monorepoAwareScanInput: ProjectIntelligenceDetectorInput = {
  projectRoot: "/workspace/monorepo",
  mode: "inventory",
  scope: "bounded_workspace",
  options: monorepoDetectorOptions,
  limits: monorepoDetectorLimits,
  ignoreRules: [
    ...defaultIgnoreRules,
    {
      path: "coverage",
      directory: undefined,
      extension: undefined,
      pattern: undefined,
    },
  ],
};

export const scanEntryExamples: readonly ProjectIntelligenceScanEntry[] = [
  {
    path: "package.json",
    kind: "file",
    sizeBytes: 1_240,
    extension: ".json",
    basename: "package.json",
    depth: 0,
  },
  {
    path: "tsconfig.json",
    kind: "file",
    sizeBytes: 320,
    extension: ".json",
    basename: "tsconfig.json",
    depth: 0,
  },
  {
    path: "composer.json",
    kind: "file",
    sizeBytes: 740,
    extension: ".json",
    basename: "composer.json",
    depth: 0,
  },
  {
    path: "Dockerfile",
    kind: "file",
    sizeBytes: 460,
    extension: undefined,
    basename: "Dockerfile",
    depth: 0,
  },
  {
    path: ".github/workflows/ci.yml",
    kind: "file",
    sizeBytes: 980,
    extension: ".yml",
    basename: "ci.yml",
    depth: 3,
  },
  {
    path: "packages",
    kind: "directory",
    sizeBytes: undefined,
    extension: undefined,
    basename: "packages",
    depth: 0,
  },
];

export const detectorIssueExample: ProjectIntelligenceDetectorIssue = {
  code: "detector.limit.scanned_entries_truncated",
  message: "Scan entry collection stopped after reaching the configured file limit.",
  severity: "warning",
  path: undefined,
};

export const emptyDetectorResult: ProjectIntelligenceDetectorResult = {
  profile: {
    projectRoot: "/workspace/empty",
    languages: [],
    frameworks: [],
    packageManagers: [],
    runtimes: [],
    infrastructure: [],
    monorepo: {
      isMonorepo: false,
      kind: "unknown",
      workspacePaths: [],
      confidence: "unknown",
      evidence: [],
    },
    evidence: [],
    issues: [],
    summary: {
      confidence: "unknown",
      primaryLanguage: "unknown",
      primaryFramework: "unknown",
      primaryPackageManager: "unknown",
      primaryRuntime: "unknown",
      hasInfrastructure: false,
      isMonorepo: false,
    },
  },
  scannedEntries: [],
  issues: [],
  summary: {
    mode: "profile",
    scope: "root",
    scannedEntryCount: 0,
    issueCount: 0,
    truncated: false,
    timedOut: false,
  },
};

export const partialProfileDetectorResult: ProjectIntelligenceDetectorResult = {
  profile: {
    projectRoot: "/workspace/monorepo",
    languages: [
      {
        language: "typescript",
        confidence: "high",
        evidence: ["evidence.package_json.typescript_dependency"],
      },
    ],
    frameworks: [
      {
        framework: "nextjs",
        confidence: "medium",
        evidence: ["evidence.package_json.next_dependency"],
      },
    ],
    packageManagers: [
      {
        packageManager: "pnpm",
        confidence: "high",
        evidence: ["evidence.package_json.package_manager"],
      },
      {
        packageManager: "composer",
        confidence: "low",
        evidence: ["evidence.composer_json.present"],
      },
    ],
    runtimes: [
      {
        runtime: "node",
        versionConstraint: ">=20",
        confidence: "medium",
        evidence: ["evidence.package_json.engines_node"],
      },
    ],
    infrastructure: [
      {
        infrastructure: "docker",
        confidence: "medium",
        evidence: ["evidence.dockerfile.present"],
      },
      {
        infrastructure: "github_actions",
        confidence: "medium",
        evidence: ["evidence.github_actions.ci_workflow"],
      },
    ],
    monorepo: {
      isMonorepo: true,
      kind: "packages_directory",
      workspacePaths: ["packages/*"],
      confidence: "medium",
      evidence: ["evidence.packages_directory.present"],
    },
    evidence: [
      {
        id: "evidence.package_json.typescript_dependency",
        category: "language",
        source: "dependency",
        path: "package.json",
        signal: "typescript",
        reason: "The package manifest includes a TypeScript dependency.",
        confidence: "high",
      },
      {
        id: "evidence.dockerfile.present",
        category: "infrastructure",
        source: "file",
        path: "Dockerfile",
        signal: "dockerfile",
        reason: "A Dockerfile is present at the project root.",
        confidence: "medium",
      },
      {
        id: "evidence.packages_directory.present",
        category: "monorepo",
        source: "directory",
        path: "packages",
        signal: "packages_directory",
        reason: "A packages directory is present at the project root.",
        confidence: "medium",
      },
    ],
    issues: [
      {
        code: "intelligence.partial_profile",
        message: "Only a partial project profile is available from supplied entries.",
        severity: "info",
        evidence: ["evidence.package_json.typescript_dependency"],
      },
    ],
    summary: {
      confidence: "medium",
      primaryLanguage: "typescript",
      primaryFramework: "nextjs",
      primaryPackageManager: "pnpm",
      primaryRuntime: "node",
      hasInfrastructure: true,
      isMonorepo: true,
    },
  },
  scannedEntries: scanEntryExamples,
  issues: [detectorIssueExample],
  summary: {
    mode: "inventory",
    scope: "bounded_workspace",
    scannedEntryCount: scanEntryExamples.length,
    issueCount: 1,
    truncated: true,
    timedOut: false,
  },
};
