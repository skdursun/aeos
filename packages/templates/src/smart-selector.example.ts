import type {
  SmartTemplateCandidate,
  SmartTemplateCandidateEvidence,
  SmartTemplateSelectionInput,
  SmartTemplateSelectionProfile,
  SmartTemplateSelectionResult,
  SmartTemplateSelectionSummary,
} from "./smart-selection.js";

import {
  createSmartTemplateFallbackRecommendation,
  scoreSmartTemplateCandidate,
  selectSmartTemplate,
  summarizeSmartTemplateSelectionResult,
} from "./smart-selector.js";

const emptyEvidence: SmartTemplateCandidateEvidence = {
  profileEvidenceIds: [],
  matchedProfileFields: [],
  matchedTemplateFields: [],
  ruleIds: [],
  confidence: "unknown",
  reducedByIssueCodes: [],
};

function starterCandidate(
  candidate: Omit<
    SmartTemplateCandidate,
    "source" | "type" | "score" | "confidence" | "evidence" | "issues"
  >,
): SmartTemplateCandidate {
  return {
    ...candidate,
    source: "local",
    type: "project_starter",
    score: "unknown",
    confidence: "unknown",
    evidence: emptyEvidence,
    issues: [],
  };
}

export const wordpressStarterCandidate = starterCandidate({
  templateId: "starter-wordpress",
  templateName: "WordPress Starter",
  supportedLanguages: ["php"],
  supportedFrameworks: ["wordpress"],
  supportedPackageManagers: ["composer"],
  supportedRuntimes: ["php"],
  supportedInfrastructure: ["docker"],
});

export const nextjsReactTypescriptStarterCandidate = starterCandidate({
  templateId: "starter-nextjs-react-typescript",
  templateName: "Next.js React TypeScript Starter",
  supportedLanguages: ["typescript"],
  supportedFrameworks: ["nextjs", "react"],
  supportedPackageManagers: ["pnpm", "npm"],
  supportedRuntimes: ["node"],
  supportedInfrastructure: ["docker", "github_actions"],
});

export const laravelComposerStarterCandidate = starterCandidate({
  templateId: "starter-laravel-composer",
  templateName: "Laravel Composer Starter",
  supportedLanguages: ["php"],
  supportedFrameworks: ["laravel"],
  supportedPackageManagers: ["composer"],
  supportedRuntimes: ["php"],
  supportedInfrastructure: ["docker"],
});

export const genericMinimalAgentsFallbackCandidate: SmartTemplateCandidate = {
  templateId: "generic-aeos-minimal-agents",
  templateName: "Generic AEOS Minimal AGENTS.md",
  source: "local",
  type: "generic",
  supportedLanguages: [],
  supportedFrameworks: [],
  supportedPackageManagers: [],
  supportedRuntimes: [],
  supportedInfrastructure: [],
  score: "unknown",
  confidence: "unknown",
  evidence: emptyEvidence,
  issues: [],
};

export const exampleCandidates = [
  wordpressStarterCandidate,
  nextjsReactTypescriptStarterCandidate,
  laravelComposerStarterCandidate,
  genericMinimalAgentsFallbackCandidate,
] as const satisfies readonly SmartTemplateCandidate[];

export const typescriptNextjsProfile: SmartTemplateSelectionProfile = {
  projectRoot: "/examples/nextjs-app",
  summary: {
    confidence: "high",
    primaryLanguage: "typescript",
    primaryFramework: "nextjs",
    primaryPackageManager: "pnpm",
    primaryRuntime: "node",
    hasInfrastructure: true,
    isMonorepo: false,
  },
  evidenceIds: [
    "framework:nextjs:package-json",
    "infrastructure:docker:compose",
    "language:typescript:tsconfig",
    "package-manager:pnpm:lockfile",
    "runtime:node:package-json",
  ],
  issueCodes: [],
};

export const phpWordpressProfile: SmartTemplateSelectionProfile = {
  projectRoot: "/examples/wordpress-site",
  summary: {
    confidence: "high",
    primaryLanguage: "php",
    primaryFramework: "wordpress",
    primaryPackageManager: "composer",
    primaryRuntime: "php",
    hasInfrastructure: false,
    isMonorepo: false,
  },
  evidenceIds: [
    "framework:wordpress:wp-content",
    "language:php:composer-json",
    "package-manager:composer:composer-lock",
    "runtime:php:composer-json",
  ],
  issueCodes: [],
};

export const unknownNoSignalProfile: SmartTemplateSelectionProfile = {
  projectRoot: "/examples/unknown",
  summary: {
    confidence: "unknown",
    primaryLanguage: "unknown",
    primaryFramework: "unknown",
    primaryPackageManager: "unknown",
    primaryRuntime: "unknown",
    hasInfrastructure: false,
    isMonorepo: false,
  },
  evidenceIds: [],
  issueCodes: ["no_project_signals"],
};

export const infrastructureHeavyProfile: SmartTemplateSelectionProfile = {
  projectRoot: "/examples/platform",
  summary: {
    confidence: "medium",
    primaryLanguage: "typescript",
    primaryFramework: "unknown",
    primaryPackageManager: "pnpm",
    primaryRuntime: "node",
    hasInfrastructure: true,
    isMonorepo: true,
  },
  evidenceIds: [
    "infrastructure:docker:compose",
    "infrastructure:github_actions:workflow",
    "language:typescript:tsconfig",
    "package-manager:pnpm:workspace",
    "runtime:node:package-json",
  ],
  issueCodes: ["ambiguous_framework"],
};

const nextjsSelectionInput: SmartTemplateSelectionInput = {
  projectRoot: typescriptNextjsProfile.projectRoot,
  profile: typescriptNextjsProfile,
  candidates: exampleCandidates,
  mode: "recommend",
  fallback: "minimal_agents",
  options: {
    includeCandidates: true,
    includeEvidence: true,
  },
};

export const highConfidenceNextjsCandidateScore = scoreSmartTemplateCandidate(
  nextjsReactTypescriptStarterCandidate,
  nextjsSelectionInput,
);

export const highConfidenceNextjsSelection =
  selectSmartTemplate(nextjsSelectionInput);

export const highConfidenceNextjsSelectionSummary: SmartTemplateSelectionSummary =
  summarizeSmartTemplateSelectionResult({
    recommendation: highConfidenceNextjsSelection.recommendation,
    candidates: highConfidenceNextjsSelection.candidates,
    issues: highConfidenceNextjsSelection.issues,
    fallback: highConfidenceNextjsSelection.recommendation.fallback,
  });

export const wordpressSelection = selectSmartTemplate({
  projectRoot: phpWordpressProfile.projectRoot,
  profile: phpWordpressProfile,
  candidates: exampleCandidates,
  mode: "recommend",
  fallback: "minimal_agents",
});

export const genericFallbackRecommendation =
  createSmartTemplateFallbackRecommendation({
    projectRoot: unknownNoSignalProfile.projectRoot,
    profile: unknownNoSignalProfile,
    candidates: exampleCandidates,
    mode: "recommend",
    fallback: "minimal_agents",
  });

export const genericFallbackSelection = selectSmartTemplate({
  projectRoot: unknownNoSignalProfile.projectRoot,
  profile: unknownNoSignalProfile,
  candidates: exampleCandidates,
  mode: "recommend",
  fallback: "minimal_agents",
});

export const noCandidateIssueResult: SmartTemplateSelectionResult =
  selectSmartTemplate({
    projectRoot: unknownNoSignalProfile.projectRoot,
    profile: unknownNoSignalProfile,
    candidates: [],
    mode: "recommend",
    fallback: "none",
  });

export const infrastructureCandidateScore = scoreSmartTemplateCandidate(
  nextjsReactTypescriptStarterCandidate,
  {
    projectRoot: infrastructureHeavyProfile.projectRoot,
    profile: infrastructureHeavyProfile,
    candidates: [nextjsReactTypescriptStarterCandidate],
    mode: "recommend",
    fallback: "generic",
  },
);

const tieBreakAlphaCandidate = starterCandidate({
  templateId: "starter-alpha-nextjs",
  templateName: "Alpha Next.js Starter",
  supportedLanguages: ["typescript"],
  supportedFrameworks: ["nextjs"],
  supportedPackageManagers: ["pnpm"],
  supportedRuntimes: ["node"],
  supportedInfrastructure: [],
});

const tieBreakZetaCandidate = starterCandidate({
  templateId: "starter-zeta-nextjs",
  templateName: "Zeta Next.js Starter",
  supportedLanguages: ["typescript"],
  supportedFrameworks: ["nextjs"],
  supportedPackageManagers: ["pnpm"],
  supportedRuntimes: ["node"],
  supportedInfrastructure: [],
});

export const deterministicTieBreakResult = selectSmartTemplate({
  projectRoot: typescriptNextjsProfile.projectRoot,
  profile: typescriptNextjsProfile,
  candidates: [tieBreakZetaCandidate, tieBreakAlphaCandidate],
  mode: "recommend",
  fallback: "generic",
});

export const languageMatchEvidence =
  highConfidenceNextjsCandidateScore.evidence.ruleIds.includes(
    "match.language.typescript",
  );

export const frameworkMatchEvidence =
  highConfidenceNextjsCandidateScore.evidence.ruleIds.includes(
    "match.framework.nextjs",
  );

export const packageManagerMatchEvidence =
  highConfidenceNextjsCandidateScore.evidence.ruleIds.includes(
    "match.package-manager.pnpm",
  );

export const runtimeMatchEvidence =
  highConfidenceNextjsCandidateScore.evidence.ruleIds.includes("match.runtime.node");

export const infrastructureMatchEvidence =
  highConfidenceNextjsCandidateScore.evidence.ruleIds.includes(
    "match.infrastructure.docker",
  );

export const fallbackReasonEvidence =
  genericFallbackRecommendation.evidence.ruleIds.includes(
    "fallback.minimal-agents",
  );
