import type {
  ProjectEvidence,
  ProjectIntelligenceIssue,
  ProjectIntelligenceProfile,
} from "./intelligence.js";

import {
  buildProjectIntelligenceProfile,
  countProjectIntelligenceProfile,
  groupProjectEvidenceBySignal,
  summarizeProjectIntelligenceProfile,
} from "./intelligence-profile-builder.js";

const projectRoot = "/workspace/example";

const unsupportedDependencyIssue: ProjectIntelligenceIssue = {
  code: "matcher.signal.dependency_name_unsupported",
  message: "Dependency evidence was supplied directly by this example.",
  severity: "info",
  evidence: ["evidence:package.json:framework.nextjs.dependency"],
};

export const typescriptNextjsEvidence: readonly ProjectEvidence[] = [
  evidence("app/page.tsx", "language", "file", "language.typescript.tsx", "low"),
  evidence("package.json", "language", "manifest", "language.javascript.package_json", "high"),
  evidence("package.json", "runtime", "manifest", "runtime.node.package_json", "high"),
  evidence("next.config.ts", "framework", "file", "framework.nextjs.config_ts", "high"),
  evidence("package.json", "framework", "dependency", "framework.nextjs.dependency", "medium"),
  evidence("package.json", "framework", "dependency", "framework.react.dependency", "medium"),
  evidence("pnpm-lock.yaml", "package_manager", "lockfile", "package_manager.pnpm.lockfile", "high"),
  evidence("pnpm-workspace.yaml", "monorepo", "workspace", "monorepo.pnpm_workspace", "high"),
  evidence("packages/web/package.json", "monorepo", "workspace", "monorepo.pnpm_workspace", "medium"),
  evidence("tsconfig.json", "language", "file", "language.typescript.tsconfig", "high"),
];

export const typescriptNextjsProfile = buildProjectIntelligenceProfile({
  projectRoot,
  evidence: typescriptNextjsEvidence,
  issues: [unsupportedDependencyIssue],
});

export const typescriptNextjsSummary =
  summarizeProjectIntelligenceProfile(stripSummary(typescriptNextjsProfile));

export const typescriptNextjsCounts =
  countProjectIntelligenceProfile(typescriptNextjsProfile);

export const typescriptNextjsEvidenceBySignal =
  groupProjectEvidenceBySignal(typescriptNextjsEvidence);

export const typescriptNextjsExampleChecks = {
  evidenceGrouping:
    typescriptNextjsEvidenceBySignal["monorepo.pnpm_workspace"]?.length === 2,
  confidenceAggregation:
    typescriptNextjsProfile.languages.find((signal) => signal.language === "typescript")
      ?.confidence === "high",
  deduplication:
    typescriptNextjsProfile.monorepo.evidence.length === 2,
  deterministicOrdering:
    typescriptNextjsProfile.frameworks.map((signal) => signal.framework).join(",") ===
    "nextjs,react",
  summaryCounts:
    typescriptNextjsCounts.evidenceCount === typescriptNextjsEvidence.length &&
    typescriptNextjsCounts.issueCount === 1,
  issuePreservation:
    typescriptNextjsProfile.issues[0]?.code === unsupportedDependencyIssue.code,
} as const;

export const phpWordPressEvidence: readonly ProjectEvidence[] = [
  evidence("wp-content", "framework", "directory", "framework.wordpress.wp_content", "high"),
  evidence("composer.lock", "package_manager", "lockfile", "package_manager.composer.lockfile", "high"),
  evidence("composer.json", "language", "manifest", "language.php.composer_json", "high"),
  evidence("composer.json", "runtime", "manifest", "runtime.php.composer_json", "high"),
  evidence("wp-config.php", "framework", "file", "framework.wordpress.wp_config", "high"),
  evidence("wp-config.php", "language", "file", "language.php.wp_config", "high"),
  evidence("index.php", "runtime", "file", "runtime.php.php", "low"),
  evidence("composer.json", "framework", "dependency", "framework.wordpress.composer_dependency", "medium"),
];

export const phpWordPressProfile = buildProjectIntelligenceProfile({
  projectRoot,
  evidence: phpWordPressEvidence,
});

export const phpWordPressExampleChecks = {
  primaryLanguage: phpWordPressProfile.summary.primaryLanguage === "php",
  primaryFramework: phpWordPressProfile.summary.primaryFramework === "wordpress",
  primaryPackageManager:
    phpWordPressProfile.summary.primaryPackageManager === "composer",
  primaryRuntime: phpWordPressProfile.summary.primaryRuntime === "php",
  groupedComposerEvidence:
    groupProjectEvidenceBySignal(phpWordPressEvidence)[
      "package_manager.composer.lockfile"
    ]?.[0]?.path === "composer.lock",
} as const;

export const infrastructureHeavyEvidence: readonly ProjectEvidence[] = [
  evidence("infra/variables.tf", "infrastructure", "file", "infrastructure.terraform.variables_tf", "medium"),
  evidence("Dockerfile", "infrastructure", "file", "infrastructure.docker.dockerfile", "high"),
  evidence(".github/workflows", "infrastructure", "directory", "infrastructure.github_actions.workflows", "high"),
  evidence("infra/main.tf", "infrastructure", "file", "infrastructure.terraform.main_tf", "high"),
  evidence("docker-compose.yml", "infrastructure", "file", "infrastructure.docker.compose_yml", "high"),
  evidence("package.json", "language", "manifest", "language.javascript.package_json", "high"),
  evidence("package.json", "runtime", "manifest", "runtime.node.package_json", "high"),
  evidence("pnpm-lock.yaml", "package_manager", "lockfile", "package_manager.pnpm.lockfile", "high"),
];

export const infrastructureHeavyProfile = buildProjectIntelligenceProfile({
  projectRoot,
  evidence: infrastructureHeavyEvidence,
});

export const infrastructureHeavyExampleChecks = {
  hasInfrastructure: infrastructureHeavyProfile.summary.hasInfrastructure,
  infrastructureCount:
    countProjectIntelligenceProfile(infrastructureHeavyProfile).infrastructureCount ===
    3,
  deterministicInfrastructureOrdering:
    infrastructureHeavyProfile.infrastructure
      .map((signal) => signal.infrastructure)
      .join(",") === "docker,github_actions,terraform",
  terraformConfidence:
    infrastructureHeavyProfile.infrastructure.find(
      (signal) => signal.infrastructure === "terraform",
    )?.confidence === "high",
} as const;

export const mixedConfidenceEvidence: readonly ProjectEvidence[] = [
  evidence("src/index.ts", "language", "file", "language.typescript.ts", "low"),
  evidence("tsconfig.json", "language", "file", "language.typescript.tsconfig", "high"),
  evidence("src/legacy.js", "language", "file", "language.javascript.js", "low"),
  evidence("package.json", "language", "manifest", "language.javascript.package_json", "high"),
  evidence("package.json", "runtime", "manifest", "runtime.node.package_json", "high"),
  evidence("package.json", "runtime", "manifest", "runtime.node.package_json", "high"),
  evidence("vite.config.ts", "framework", "file", "framework.react.vite_config_ts", "medium"),
  evidence("package.json", "framework", "dependency", "framework.react.dependency", "medium"),
  evidence("pnpm-lock.yaml", "package_manager", "lockfile", "package_manager.pnpm.lockfile", "high"),
];

export const mixedConfidenceProfile = buildProjectIntelligenceProfile({
  projectRoot,
  evidence: mixedConfidenceEvidence,
});

export const mixedConfidenceExampleChecks = {
  strongestConfidenceWins:
    mixedConfidenceProfile.languages.find((signal) => signal.language === "typescript")
      ?.confidence === "high",
  deterministicPrimaryTieBreak:
    mixedConfidenceProfile.summary.primaryLanguage === "javascript",
  duplicateEvidenceIdsCollapsed:
    mixedConfidenceProfile.runtimes.find((signal) => signal.runtime === "node")
      ?.evidence.length === 1,
  groupedDuplicateSignalEvidence:
    groupProjectEvidenceBySignal(mixedConfidenceEvidence)["runtime.node.package_json"]
      ?.length === 2,
} as const;

export const profileBuilderExamples: readonly ProjectIntelligenceProfile[] = [
  typescriptNextjsProfile,
  phpWordPressProfile,
  infrastructureHeavyProfile,
  mixedConfidenceProfile,
];

function evidence(
  path: string,
  category: ProjectEvidence["category"],
  source: ProjectEvidence["source"],
  signal: string,
  confidence: ProjectEvidence["confidence"],
): ProjectEvidence {
  return {
    id: `evidence:${path}:${signal}`,
    category,
    source,
    path,
    signal,
    reason: `Example evidence for ${signal}.`,
    confidence,
  };
}

function stripSummary(
  profile: ProjectIntelligenceProfile,
): Omit<ProjectIntelligenceProfile, "summary"> {
  return {
    projectRoot: profile.projectRoot,
    languages: profile.languages,
    frameworks: profile.frameworks,
    packageManagers: profile.packageManagers,
    runtimes: profile.runtimes,
    infrastructure: profile.infrastructure,
    monorepo: profile.monorepo,
    evidence: profile.evidence,
    issues: profile.issues,
  };
}
