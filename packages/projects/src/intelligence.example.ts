import type {
  ProjectEvidence,
  ProjectFrameworkSignal,
  ProjectInfrastructureSignal,
  ProjectIntelligenceIssue,
  ProjectIntelligenceProfile,
  ProjectLanguageSignal,
  ProjectMonorepoSignal,
  ProjectPackageManagerSignal,
  ProjectRuntimeSignal,
} from "./intelligence.js";

export const typescriptLanguageSignalExample: ProjectLanguageSignal = {
  language: "typescript",
  confidence: "high",
  evidence: ["next-package-json", "next-tsconfig"],
};

export const javascriptLanguageSignalExample: ProjectLanguageSignal = {
  language: "javascript",
  confidence: "medium",
  evidence: ["next-package-json"],
};

export const phpLanguageSignalExample: ProjectLanguageSignal = {
  language: "php",
  confidence: "high",
  evidence: ["wordpress-composer-json", "wordpress-index-php"],
};

export const wordpressFrameworkSignalExample: ProjectFrameworkSignal = {
  framework: "wordpress",
  confidence: "high",
  evidence: ["wordpress-index-php", "wordpress-wp-content"],
};

export const nextjsFrameworkSignalExample: ProjectFrameworkSignal = {
  framework: "nextjs",
  confidence: "high",
  evidence: ["next-package-json", "next-config"],
};

export const pnpmPackageManagerSignalExample: ProjectPackageManagerSignal = {
  packageManager: "pnpm",
  confidence: "high",
  evidence: ["next-pnpm-lock"],
};

export const composerPackageManagerSignalExample: ProjectPackageManagerSignal = {
  packageManager: "composer",
  confidence: "high",
  evidence: ["wordpress-composer-json", "wordpress-composer-lock"],
};

export const nodeRuntimeSignalExample: ProjectRuntimeSignal = {
  runtime: "node",
  versionConstraint: ">=20",
  confidence: "high",
  evidence: ["next-package-json"],
};

export const phpRuntimeSignalExample: ProjectRuntimeSignal = {
  runtime: "php",
  versionConstraint: ">=8.2",
  confidence: "high",
  evidence: ["wordpress-composer-json"],
};

export const dockerInfrastructureSignalExample: ProjectInfrastructureSignal = {
  infrastructure: "docker",
  confidence: "medium",
  evidence: ["next-dockerfile"],
};

export const githubActionsInfrastructureSignalExample: ProjectInfrastructureSignal =
  {
    infrastructure: "github_actions",
    confidence: "medium",
    evidence: ["wordpress-github-actions"],
  };

export const monorepoSignalExample: ProjectMonorepoSignal = {
  isMonorepo: true,
  kind: "pnpm_workspace",
  workspacePaths: ["apps/*", "packages/*"],
  confidence: "high",
  evidence: ["next-pnpm-workspace"],
};

export const singleProjectSignalExample: ProjectMonorepoSignal = {
  isMonorepo: false,
  kind: "unknown",
  workspacePaths: [],
  confidence: "medium",
  evidence: ["wordpress-composer-json"],
};

export const nextProjectEvidenceExamples: readonly ProjectEvidence[] = [
  {
    id: "next-package-json",
    category: "framework",
    source: "manifest",
    path: "package.json",
    signal: "next dependency and node engine",
    reason: "The package manifest declares a Next.js dependency and Node runtime constraint.",
    confidence: "high",
  },
  {
    id: "next-tsconfig",
    category: "language",
    source: "file",
    path: "tsconfig.json",
    signal: "TypeScript configuration",
    reason: "A TypeScript configuration file indicates TypeScript is part of the project.",
    confidence: "high",
  },
  {
    id: "next-config",
    category: "framework",
    source: "file",
    path: "next.config.js",
    signal: "Next.js configuration",
    reason: "A Next.js configuration file supports the Next.js framework signal.",
    confidence: "high",
  },
  {
    id: "next-pnpm-lock",
    category: "package_manager",
    source: "lockfile",
    path: "pnpm-lock.yaml",
    signal: "pnpm lockfile",
    reason: "A pnpm lockfile indicates pnpm is the package manager.",
    confidence: "high",
  },
  {
    id: "next-pnpm-workspace",
    category: "monorepo",
    source: "workspace",
    path: "pnpm-workspace.yaml",
    signal: "pnpm workspace",
    reason: "A pnpm workspace manifest can describe multiple project packages.",
    confidence: "high",
  },
  {
    id: "next-dockerfile",
    category: "infrastructure",
    source: "file",
    path: "Dockerfile",
    signal: "Docker build file",
    reason: "A Dockerfile indicates Docker infrastructure may be available.",
    confidence: "medium",
  },
];

export const wordpressProjectEvidenceExamples: readonly ProjectEvidence[] = [
  {
    id: "wordpress-composer-json",
    category: "package_manager",
    source: "manifest",
    path: "composer.json",
    signal: "Composer manifest with PHP constraint",
    reason: "The Composer manifest identifies PHP package management and runtime constraints.",
    confidence: "high",
  },
  {
    id: "wordpress-composer-lock",
    category: "package_manager",
    source: "lockfile",
    path: "composer.lock",
    signal: "Composer lockfile",
    reason: "A Composer lockfile confirms Composer dependency resolution.",
    confidence: "high",
  },
  {
    id: "wordpress-index-php",
    category: "framework",
    source: "file",
    path: "public/index.php",
    signal: "WordPress PHP entrypoint",
    reason: "A PHP entrypoint can support both PHP language and WordPress framework signals.",
    confidence: "high",
  },
  {
    id: "wordpress-wp-content",
    category: "framework",
    source: "directory",
    path: "wp-content",
    signal: "WordPress content directory",
    reason: "A wp-content directory is a strong WordPress project signal.",
    confidence: "high",
  },
  {
    id: "wordpress-github-actions",
    category: "infrastructure",
    source: "directory",
    path: ".github/workflows",
    signal: "GitHub Actions workflows directory",
    reason: "A workflows directory indicates GitHub Actions infrastructure may be present.",
    confidence: "medium",
  },
];

export const projectIntelligenceIssueExample: ProjectIntelligenceIssue = {
  code: "mixed-language-signal",
  message: "JavaScript was detected as a secondary language in a TypeScript project.",
  severity: "info",
  evidence: ["next-package-json"],
};

export const typescriptNextjsProjectProfileExample: ProjectIntelligenceProfile = {
  projectRoot: "/workspace/examples/next-app",
  languages: [
    typescriptLanguageSignalExample,
    javascriptLanguageSignalExample,
  ],
  frameworks: [nextjsFrameworkSignalExample],
  packageManagers: [pnpmPackageManagerSignalExample],
  runtimes: [nodeRuntimeSignalExample],
  infrastructure: [dockerInfrastructureSignalExample],
  monorepo: monorepoSignalExample,
  evidence: nextProjectEvidenceExamples,
  issues: [projectIntelligenceIssueExample],
  summary: {
    confidence: "high",
    primaryLanguage: "typescript",
    primaryFramework: "nextjs",
    primaryPackageManager: "pnpm",
    primaryRuntime: "node",
    hasInfrastructure: true,
    isMonorepo: true,
  },
};

export const phpWordpressProjectProfileExample: ProjectIntelligenceProfile = {
  projectRoot: "/workspace/examples/wordpress-site",
  languages: [phpLanguageSignalExample],
  frameworks: [wordpressFrameworkSignalExample],
  packageManagers: [composerPackageManagerSignalExample],
  runtimes: [phpRuntimeSignalExample],
  infrastructure: [githubActionsInfrastructureSignalExample],
  monorepo: singleProjectSignalExample,
  evidence: wordpressProjectEvidenceExamples,
  issues: [],
  summary: {
    confidence: "high",
    primaryLanguage: "php",
    primaryFramework: "wordpress",
    primaryPackageManager: "composer",
    primaryRuntime: "php",
    hasInfrastructure: true,
    isMonorepo: false,
  },
};

export const projectIntelligenceProfileExamples: readonly ProjectIntelligenceProfile[] =
  [
    typescriptNextjsProjectProfileExample,
    phpWordpressProjectProfileExample,
  ];
