import type {
  SmartTemplateCandidate,
  SmartTemplateCandidateEvidence,
  SmartTemplateCandidateScore,
  SmartTemplateRecommendation,
  SmartTemplateSelectionFallback,
  SmartTemplateSelectionInput,
  SmartTemplateSelectionIssue,
  SmartTemplateSelectionMode,
  SmartTemplateSelectionProfile,
  SmartTemplateSelectionResult,
  SmartTemplateSelectionSummary,
} from "./smart-selection.js";

export const recommendModeExample: SmartTemplateSelectionMode = "recommend";

export const minimalAgentsFallbackExample: SmartTemplateSelectionFallback =
  "minimal_agents";

export const strongMatchScoreExample: SmartTemplateCandidateScore =
  "strong_match";

export const nextProjectProfileExample: SmartTemplateSelectionProfile = {
  projectRoot: "/workspace/acme-web",
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
    "language:package-json-typescript",
    "framework:next-dependency",
    "package-manager:pnpm-lock",
    "runtime:node-engines",
    "infrastructure:dockerfile",
  ],
  issueCodes: [],
};

export const unknownProjectProfileExample: SmartTemplateSelectionProfile = {
  projectRoot: "/workspace/unknown",
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
  issueCodes: ["no_profile_signal"],
};

export const languageMatchEvidenceExample: SmartTemplateCandidateEvidence = {
  profileEvidenceIds: ["language:package-json-typescript"],
  matchedProfileFields: ["summary.primaryLanguage"],
  matchedTemplateFields: ["supportedLanguages"],
  ruleIds: ["match.language.typescript"],
  confidence: "high",
  reducedByIssueCodes: [],
};

export const frameworkMatchEvidenceExample: SmartTemplateCandidateEvidence = {
  profileEvidenceIds: ["framework:next-dependency"],
  matchedProfileFields: ["summary.primaryFramework"],
  matchedTemplateFields: ["supportedFrameworks"],
  ruleIds: ["match.framework.nextjs"],
  confidence: "high",
  reducedByIssueCodes: [],
};

export const packageManagerMatchEvidenceExample:
  SmartTemplateCandidateEvidence = {
    profileEvidenceIds: ["package-manager:pnpm-lock"],
    matchedProfileFields: ["summary.primaryPackageManager"],
    matchedTemplateFields: ["supportedPackageManagers"],
    ruleIds: ["match.package-manager.pnpm"],
    confidence: "high",
    reducedByIssueCodes: [],
  };

export const runtimeMatchEvidenceExample: SmartTemplateCandidateEvidence = {
  profileEvidenceIds: ["runtime:node-engines"],
  matchedProfileFields: ["summary.primaryRuntime"],
  matchedTemplateFields: ["supportedRuntimes"],
  ruleIds: ["match.runtime.node"],
  confidence: "high",
  reducedByIssueCodes: [],
};

export const infrastructureMatchEvidenceExample:
  SmartTemplateCandidateEvidence = {
    profileEvidenceIds: ["infrastructure:dockerfile"],
    matchedProfileFields: ["summary.hasInfrastructure"],
    matchedTemplateFields: ["supportedInfrastructure"],
    ruleIds: ["match.infrastructure.docker"],
    confidence: "medium",
    reducedByIssueCodes: [],
  };

export const fallbackReasonEvidenceExample: SmartTemplateCandidateEvidence = {
  profileEvidenceIds: [],
  matchedProfileFields: [],
  matchedTemplateFields: [],
  ruleIds: ["fallback.minimal-agents.no-signal"],
  confidence: "low",
  reducedByIssueCodes: ["no_confident_match"],
};

export const wordpressStarterCandidateExample: SmartTemplateCandidate = {
  templateId: "wordpress-starter",
  templateName: "WordPress Starter",
  source: "local",
  type: "project_starter",
  supportedLanguages: ["php", "javascript"],
  supportedFrameworks: ["wordpress"],
  supportedPackageManagers: ["composer", "npm"],
  supportedRuntimes: ["php", "node"],
  supportedInfrastructure: ["docker"],
  score: "partial_match",
  confidence: "medium",
  evidence: {
    profileEvidenceIds: [
      "language:php-files",
      "framework:wp-content",
      "package-manager:composer-json",
      "runtime:php-version",
    ],
    matchedProfileFields: [
      "summary.primaryLanguage",
      "summary.primaryFramework",
      "summary.primaryPackageManager",
      "summary.primaryRuntime",
    ],
    matchedTemplateFields: [
      "supportedLanguages",
      "supportedFrameworks",
      "supportedPackageManagers",
      "supportedRuntimes",
    ],
    ruleIds: [
      "match.language.php",
      "match.framework.wordpress",
      "match.package-manager.composer",
      "match.runtime.php",
    ],
    confidence: "medium",
    reducedByIssueCodes: ["weak_evidence"],
  },
  issues: [
    {
      code: "weak_evidence",
      message: "WordPress evidence is present but package manager evidence is incomplete.",
      severity: "info",
      templateId: "wordpress-starter",
      evidenceIds: ["framework:wp-content"],
    },
  ],
};

export const nextReactTypescriptStarterCandidateExample:
  SmartTemplateCandidate = {
    templateId: "next-react-typescript-starter",
    templateName: "Next.js React TypeScript Starter",
    source: "local",
    type: "project_starter",
    supportedLanguages: ["typescript", "javascript"],
    supportedFrameworks: ["nextjs", "react"],
    supportedPackageManagers: ["pnpm", "npm", "yarn"],
    supportedRuntimes: ["node"],
    supportedInfrastructure: ["docker", "github_actions"],
    score: "strong_match",
    confidence: "high",
    evidence: {
      profileEvidenceIds: [
        "language:package-json-typescript",
        "framework:next-dependency",
        "package-manager:pnpm-lock",
        "runtime:node-engines",
        "infrastructure:dockerfile",
      ],
      matchedProfileFields: [
        "summary.primaryLanguage",
        "summary.primaryFramework",
        "summary.primaryPackageManager",
        "summary.primaryRuntime",
        "summary.hasInfrastructure",
      ],
      matchedTemplateFields: [
        "supportedLanguages",
        "supportedFrameworks",
        "supportedPackageManagers",
        "supportedRuntimes",
        "supportedInfrastructure",
      ],
      ruleIds: [
        "match.language.typescript",
        "match.framework.nextjs",
        "match.package-manager.pnpm",
        "match.runtime.node",
        "match.infrastructure.docker",
      ],
      confidence: "high",
      reducedByIssueCodes: [],
    },
    issues: [],
  };

export const laravelComposerStarterCandidateExample: SmartTemplateCandidate = {
  templateId: "laravel-composer-starter",
  templateName: "Laravel Composer Starter",
  source: "local",
  type: "project_starter",
  supportedLanguages: ["php"],
  supportedFrameworks: ["laravel"],
  supportedPackageManagers: ["composer"],
  supportedRuntimes: ["php"],
  supportedInfrastructure: ["docker"],
  score: "weak_match",
  confidence: "low",
  evidence: {
    profileEvidenceIds: ["language:php-files", "package-manager:composer-json"],
    matchedProfileFields: [
      "summary.primaryLanguage",
      "summary.primaryPackageManager",
    ],
    matchedTemplateFields: ["supportedLanguages", "supportedPackageManagers"],
    ruleIds: ["match.language.php", "match.package-manager.composer"],
    confidence: "low",
    reducedByIssueCodes: ["no_confident_match"],
  },
  issues: [
    {
      code: "no_confident_match",
      message: "Laravel framework evidence is absent.",
      severity: "info",
      templateId: "laravel-composer-starter",
      evidenceIds: ["language:php-files", "package-manager:composer-json"],
    },
  ],
};

export const genericMinimalAgentsFallbackCandidateExample:
  SmartTemplateCandidate = {
    templateId: "generic-minimal-agents",
    templateName: "Generic AEOS Minimal AGENTS.md",
    source: "local",
    type: "generic",
    supportedLanguages: [],
    supportedFrameworks: [],
    supportedPackageManagers: [],
    supportedRuntimes: [],
    supportedInfrastructure: [],
    score: "unknown",
    confidence: "low",
    evidence: fallbackReasonEvidenceExample,
    issues: [
      {
        code: "fallback_required",
        message: "Generic minimal AGENTS.md fallback is used when no profile signal is available.",
        severity: "info",
        templateId: "generic-minimal-agents",
      },
    ],
  };

export const smartTemplateSelectionInputExample: SmartTemplateSelectionInput = {
  projectRoot: "/workspace/acme-web",
  profile: nextProjectProfileExample,
  templates: [
    {
      id: "next-react-typescript-starter",
      name: "Next.js React TypeScript Starter",
      source: "local",
      type: "project_starter",
      supportedLanguages: ["typescript", "javascript"],
      supportedFrameworks: ["nextjs", "react"],
      supportedPackageManagers: ["pnpm", "npm", "yarn"],
      supportedRuntimes: ["node"],
      supportedInfrastructure: ["docker", "github_actions"],
    },
    {
      id: "generic-minimal-agents",
      name: "Generic AEOS Minimal AGENTS.md",
      source: "local",
      type: "generic",
    },
  ],
  candidates: [
    nextReactTypescriptStarterCandidateExample,
    genericMinimalAgentsFallbackCandidateExample,
  ],
  mode: "recommend",
  fallback: "minimal_agents",
  options: {
    includeCandidates: true,
    includeEvidence: true,
  },
};

export const noCandidateIssueExample: SmartTemplateSelectionIssue = {
  code: "no_available_templates",
  message: "No available templates were provided for smart selection.",
  severity: "error",
};

export const highConfidenceNextRecommendationExample:
  SmartTemplateRecommendation = {
    selectedCandidate: nextReactTypescriptStarterCandidateExample,
    fallbackUsed: false,
    fallback: "none",
    confidence: "high",
    evidence: nextReactTypescriptStarterCandidateExample.evidence,
    issues: [],
  };

export const mediumConfidenceWordpressRecommendationExample:
  SmartTemplateRecommendation = {
    selectedCandidate: wordpressStarterCandidateExample,
    fallbackUsed: false,
    fallback: "none",
    confidence: "medium",
    evidence: wordpressStarterCandidateExample.evidence,
    issues: wordpressStarterCandidateExample.issues,
  };

export const genericFallbackRecommendationExample:
  SmartTemplateRecommendation = {
    selectedCandidate: genericMinimalAgentsFallbackCandidateExample,
    fallbackUsed: true,
    fallback: "minimal_agents",
    fallbackReason: "No language, framework, package manager, runtime, or infrastructure signal was available.",
    confidence: "low",
    evidence: fallbackReasonEvidenceExample,
    issues: genericMinimalAgentsFallbackCandidateExample.issues,
  };

export const noCandidateRecommendationExample: SmartTemplateRecommendation = {
  fallbackUsed: false,
  fallback: "none",
  fallbackReason: "No candidates were available to evaluate.",
  confidence: "unknown",
  evidence: {
    profileEvidenceIds: [],
    matchedProfileFields: [],
    matchedTemplateFields: [],
    ruleIds: [],
    confidence: "unknown",
    reducedByIssueCodes: ["no_available_templates"],
  },
  issues: [noCandidateIssueExample],
};

export const highConfidenceNextSummaryExample:
  SmartTemplateSelectionSummary = {
    candidateCount: 4,
    issueCount: 0,
    selectedTemplateId: "next-react-typescript-starter",
    fallback: "none",
    confidence: "high",
  };

export const highConfidenceNextResultExample: SmartTemplateSelectionResult = {
  ok: true,
  mode: "recommend",
  projectRoot: "/workspace/acme-web",
  recommendation: highConfidenceNextRecommendationExample,
  candidates: [
    nextReactTypescriptStarterCandidateExample,
    wordpressStarterCandidateExample,
    laravelComposerStarterCandidateExample,
    genericMinimalAgentsFallbackCandidateExample,
  ],
  fallbackUsed: false,
  issues: [],
  summary: highConfidenceNextSummaryExample,
};

export const mediumConfidenceWordpressResultExample:
  SmartTemplateSelectionResult = {
    ok: true,
    mode: "recommend",
    projectRoot: "/workspace/cms-site",
    recommendation: mediumConfidenceWordpressRecommendationExample,
    candidates: [
      wordpressStarterCandidateExample,
      laravelComposerStarterCandidateExample,
      genericMinimalAgentsFallbackCandidateExample,
    ],
    fallbackUsed: false,
    issues: wordpressStarterCandidateExample.issues,
    summary: {
      candidateCount: 3,
      issueCount: 1,
      selectedTemplateId: "wordpress-starter",
      fallback: "none",
      confidence: "medium",
    },
  };

export const genericFallbackResultExample: SmartTemplateSelectionResult = {
  ok: true,
  mode: "recommend",
  projectRoot: "/workspace/unknown",
  recommendation: genericFallbackRecommendationExample,
  candidates: [genericMinimalAgentsFallbackCandidateExample],
  fallbackUsed: true,
  issues: genericMinimalAgentsFallbackCandidateExample.issues,
  summary: {
    candidateCount: 1,
    issueCount: 1,
    selectedTemplateId: "generic-minimal-agents",
    fallback: "minimal_agents",
    confidence: "low",
  },
};

export const noCandidateResultExample: SmartTemplateSelectionResult = {
  ok: false,
  mode: "recommend",
  projectRoot: "/workspace/empty",
  recommendation: noCandidateRecommendationExample,
  candidates: [],
  fallbackUsed: false,
  issues: [noCandidateIssueExample],
  summary: {
    candidateCount: 0,
    issueCount: 1,
    fallback: "none",
    confidence: "unknown",
  },
};

