export type ProjectConfidence = "high" | "medium" | "low" | "unknown";

export type ProjectLanguage =
  | "typescript"
  | "javascript"
  | "php"
  | "python"
  | "go"
  | "rust"
  | "unknown";

export type ProjectFramework =
  | "wordpress"
  | "nextjs"
  | "react"
  | "laravel"
  | "fastapi"
  | "unknown";

export type ProjectPackageManager =
  | "pnpm"
  | "npm"
  | "yarn"
  | "composer"
  | "pip"
  | "uv"
  | "gomod"
  | "cargo"
  | "unknown";

export type ProjectRuntime =
  | "node"
  | "php"
  | "python"
  | "go"
  | "rust"
  | "unknown";

export type ProjectInfrastructure =
  | "docker"
  | "github_actions"
  | "terraform"
  | "unknown";

export type ProjectIntelligenceCategory =
  | "language"
  | "framework"
  | "package_manager"
  | "runtime"
  | "infrastructure"
  | "monorepo";

export type ProjectEvidenceSource =
  | "file"
  | "directory"
  | "manifest"
  | "dependency"
  | "lockfile"
  | "workspace"
  | "unknown";

export type ProjectIntelligenceIssueSeverity =
  | "info"
  | "warning"
  | "error";

export type ProjectMonorepoKind =
  | "pnpm_workspace"
  | "npm_workspaces"
  | "yarn_workspaces"
  | "cargo_workspace"
  | "go_workspace"
  | "packages_directory"
  | "unknown";

export interface ProjectEvidence {
  readonly id: string;
  readonly category: ProjectIntelligenceCategory;
  readonly source: ProjectEvidenceSource;
  readonly path: string;
  readonly signal: string;
  readonly reason: string;
  readonly confidence: ProjectConfidence;
}

export interface ProjectLanguageSignal {
  readonly language: ProjectLanguage;
  readonly confidence: ProjectConfidence;
  readonly evidence: readonly string[];
}

export interface ProjectFrameworkSignal {
  readonly framework: ProjectFramework;
  readonly confidence: ProjectConfidence;
  readonly evidence: readonly string[];
}

export interface ProjectPackageManagerSignal {
  readonly packageManager: ProjectPackageManager;
  readonly confidence: ProjectConfidence;
  readonly evidence: readonly string[];
}

export interface ProjectRuntimeSignal {
  readonly runtime: ProjectRuntime;
  readonly versionConstraint: string | undefined;
  readonly confidence: ProjectConfidence;
  readonly evidence: readonly string[];
}

export interface ProjectInfrastructureSignal {
  readonly infrastructure: ProjectInfrastructure;
  readonly confidence: ProjectConfidence;
  readonly evidence: readonly string[];
}

export interface ProjectMonorepoSignal {
  readonly isMonorepo: boolean;
  readonly kind: ProjectMonorepoKind;
  readonly workspacePaths: readonly string[];
  readonly confidence: ProjectConfidence;
  readonly evidence: readonly string[];
}

export interface ProjectIntelligenceIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: ProjectIntelligenceIssueSeverity;
  readonly evidence: readonly string[];
}

export interface ProjectIntelligenceSummary {
  readonly confidence: ProjectConfidence;
  readonly primaryLanguage: ProjectLanguage;
  readonly primaryFramework: ProjectFramework;
  readonly primaryPackageManager: ProjectPackageManager;
  readonly primaryRuntime: ProjectRuntime;
  readonly hasInfrastructure: boolean;
  readonly isMonorepo: boolean;
}

export interface ProjectIntelligenceProfile {
  readonly projectRoot: string;
  readonly languages: readonly ProjectLanguageSignal[];
  readonly frameworks: readonly ProjectFrameworkSignal[];
  readonly packageManagers: readonly ProjectPackageManagerSignal[];
  readonly runtimes: readonly ProjectRuntimeSignal[];
  readonly infrastructure: readonly ProjectInfrastructureSignal[];
  readonly monorepo: ProjectMonorepoSignal;
  readonly evidence: readonly ProjectEvidence[];
  readonly issues: readonly ProjectIntelligenceIssue[];
  readonly summary: ProjectIntelligenceSummary;
}
