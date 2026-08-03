import assert from "node:assert/strict";

import {
  getBuiltInSmartTemplateCandidateById,
  listBuiltInSmartTemplateCandidates,
  scoreSmartTemplateCandidate,
  selectSmartTemplate,
} from "../dist/index.js";

function profile(overrides = {}) {
  return {
    projectRoot: "/workspace/project",
    summary: {
      confidence: "high",
      primaryLanguage: "unknown",
      primaryFramework: "unknown",
      primaryPackageManager: "unknown",
      primaryRuntime: "unknown",
      hasInfrastructure: false,
      isMonorepo: false,
      ...overrides.summary,
    },
    evidenceIds: overrides.evidenceIds ?? [],
    issueCodes: overrides.issueCodes ?? [],
  };
}

function candidate(templateId, overrides = {}) {
  return {
    templateId,
    templateName: overrides.templateName ?? templateId,
    source: overrides.source ?? "local",
    type: overrides.type ?? "project_starter",
    supportedLanguages: overrides.supportedLanguages ?? [],
    supportedFrameworks: overrides.supportedFrameworks ?? [],
    supportedPackageManagers: overrides.supportedPackageManagers ?? [],
    supportedRuntimes: overrides.supportedRuntimes ?? [],
    supportedInfrastructure: overrides.supportedInfrastructure ?? [],
    score: "unknown",
    confidence: "unknown",
    evidence: {
      profileEvidenceIds: [],
      matchedProfileFields: [],
      matchedTemplateFields: [],
      ruleIds: [],
      confidence: "unknown",
      reducedByIssueCodes: [],
    },
    issues: [],
  };
}

function select({ profile: projectProfile, candidates, fallback = "generic" }) {
  return selectSmartTemplate({
    projectRoot: projectProfile.projectRoot,
    profile: projectProfile,
    candidates,
    mode: "recommend",
    fallback,
    options: {
      includeCandidates: true,
      includeEvidence: true,
    },
  });
}

function evidenceRules(result) {
  return result.recommendation.evidence.ruleIds;
}

const nextCandidate = candidate("nextjs-react-typescript", {
  templateName: "Next.js React TypeScript",
  supportedLanguages: ["typescript", "javascript"],
  supportedFrameworks: ["nextjs", "react"],
  supportedPackageManagers: ["pnpm", "npm"],
  supportedRuntimes: ["node"],
});

const wordpressCandidate = candidate("wordpress-php", {
  templateName: "WordPress PHP",
  supportedLanguages: ["php"],
  supportedFrameworks: ["wordpress"],
  supportedPackageManagers: ["composer"],
  supportedRuntimes: ["php"],
});

const genericCandidate = candidate("generic-aeos", {
  templateName: "Generic AEOS Starter",
  type: "generic",
});

{
  const result = select({
    profile: profile({
      summary: {
        confidence: "high",
        primaryLanguage: "typescript",
        primaryFramework: "nextjs",
        primaryPackageManager: "pnpm",
        primaryRuntime: "node",
      },
      evidenceIds: [
        "language:typescript:tsconfig",
        "framework:nextjs:dependency",
        "package-manager:pnpm:lockfile",
        "runtime:node:package",
      ],
    }),
    candidates: [wordpressCandidate, genericCandidate, nextCandidate],
  });

  assert.equal(result.recommendation.selectedCandidate?.templateId, "nextjs-react-typescript");
  assert.equal(result.fallbackUsed, false);
  assert.ok(evidenceRules(result).length > 0);
  assert.equal(result.summary.selectedTemplateId, "nextjs-react-typescript");
}

{
  const result = select({
    profile: profile({
      summary: {
        confidence: "high",
        primaryLanguage: "php",
        primaryFramework: "wordpress",
        primaryPackageManager: "composer",
        primaryRuntime: "php",
      },
      evidenceIds: [
        "language:php:composer",
        "framework:wordpress:files",
        "package-manager:composer:lockfile",
        "runtime:php:composer",
      ],
    }),
    candidates: [nextCandidate, wordpressCandidate, genericCandidate],
  });

  assert.equal(result.recommendation.selectedCandidate?.templateId, "wordpress-php");
  assert.equal(result.fallbackUsed, false);
  assert.ok(evidenceRules(result).includes("match.language.php"));
  assert.ok(evidenceRules(result).includes("match.framework.wordpress"));
  assert.ok(evidenceRules(result).includes("match.package-manager.composer"));
}

{
  const result = select({
    profile: profile(),
    candidates: [nextCandidate, wordpressCandidate, genericCandidate],
    fallback: "minimal_agents",
  });

  assert.equal(result.recommendation.selectedCandidate, undefined);
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.recommendation.fallback, "minimal_agents");
  assert.equal(result.summary.fallback, "minimal_agents");
  assert.equal(result.summary.selectedTemplateId, undefined);
  assert.equal(result.recommendation.confidence, "unknown");
  assert.ok(result.issues.some((issue) => issue.code === "no_confident_match"));
}

{
  const result = select({
    profile: profile(),
    candidates: [],
  });

  assert.equal(result.ok, true);
  assert.equal(result.fallbackUsed, true);
  assert.ok(result.issues.length > 0);
  assert.ok(result.issues.some((issue) => issue.code === "no_available_templates"));
  assert.equal(result.summary.issueCount, result.issues.length);
}

{
  const tiedProfile = profile({
    summary: {
      confidence: "high",
      primaryLanguage: "typescript",
      primaryFramework: "react",
      primaryPackageManager: "pnpm",
      primaryRuntime: "node",
    },
    evidenceIds: [
      "language:typescript:tsconfig",
      "framework:react:dependency",
      "package-manager:pnpm:lockfile",
      "runtime:node:package",
    ],
  });
  const alpha = candidate("alpha-template", {
    supportedLanguages: ["typescript"],
    supportedFrameworks: ["react"],
    supportedPackageManagers: ["pnpm"],
    supportedRuntimes: ["node"],
  });
  const beta = candidate("beta-template", {
    supportedLanguages: ["typescript"],
    supportedFrameworks: ["react"],
    supportedPackageManagers: ["pnpm"],
    supportedRuntimes: ["node"],
  });

  const first = select({ profile: tiedProfile, candidates: [beta, alpha] });
  const second = select({ profile: tiedProfile, candidates: [alpha, beta] });

  assert.equal(first.recommendation.selectedCandidate?.templateId, "alpha-template");
  assert.equal(second.recommendation.selectedCandidate?.templateId, "alpha-template");
}

{
  const highProfile = profile({
    summary: {
      confidence: "high",
      primaryLanguage: "typescript",
      primaryFramework: "nextjs",
      primaryPackageManager: "pnpm",
      primaryRuntime: "node",
    },
    evidenceIds: [
      "language:typescript:tsconfig",
      "framework:nextjs:dependency",
      "package-manager:pnpm:lockfile",
      "runtime:node:package",
    ],
  });
  const lowProfile = profile({
    summary: {
      confidence: "low",
      primaryLanguage: "typescript",
      primaryFramework: "unknown",
      primaryPackageManager: "unknown",
      primaryRuntime: "unknown",
    },
    evidenceIds: ["language:typescript:tsconfig"],
  });

  const high = scoreSmartTemplateCandidate(nextCandidate, {
    projectRoot: highProfile.projectRoot,
    profile: highProfile,
    candidates: [nextCandidate],
    mode: "recommend",
    fallback: "generic",
  });
  const low = scoreSmartTemplateCandidate(nextCandidate, {
    projectRoot: lowProfile.projectRoot,
    profile: lowProfile,
    candidates: [nextCandidate],
    mode: "recommend",
    fallback: "generic",
  });

  assert.equal(high.confidence, "high");
  assert.equal(low.confidence, "low");
}

{
  const customOnly = candidate("custom-only-next", {
    supportedLanguages: ["typescript"],
    supportedFrameworks: ["nextjs"],
    supportedPackageManagers: ["pnpm"],
    supportedRuntimes: ["node"],
  });
  const result = select({
    profile: profile({
      summary: {
        confidence: "high",
        primaryLanguage: "typescript",
        primaryFramework: "nextjs",
        primaryPackageManager: "pnpm",
        primaryRuntime: "node",
      },
      evidenceIds: [
        "language:typescript:tsconfig",
        "framework:nextjs:dependency",
        "package-manager:pnpm:lockfile",
        "runtime:node:package",
      ],
    }),
    candidates: [customOnly],
  });

  assert.deepEqual(
    result.candidates.map((item) => item.templateId),
    ["custom-only-next"],
  );
  assert.equal(result.recommendation.selectedCandidate?.templateId, "custom-only-next");
}

{
  const first = listBuiltInSmartTemplateCandidates();
  const second = listBuiltInSmartTemplateCandidates();
  const expectedTemplateIds = [
    "aeos-generic-minimal",
    "aeos-nextjs-typescript",
    "aeos-wordpress-php",
    "aeos-php-composer",
  ];

  assert.deepEqual(
    first.map((item) => item.templateId),
    expectedTemplateIds,
    "built-in smart template candidates must stay deterministically ordered",
  );
  assert.deepEqual(second, first, "repeated built-in candidate listing must be stable");
}

{
  assert.doesNotThrow(() => getBuiltInSmartTemplateCandidateById("aeos-nextjs-typescript"));
  assert.doesNotThrow(() => getBuiltInSmartTemplateCandidateById("aeos-wordpress-php"));
  assert.equal(
    getBuiltInSmartTemplateCandidateById("aeos-nextjs-typescript")?.templateId,
    "aeos-nextjs-typescript",
  );
  assert.equal(
    getBuiltInSmartTemplateCandidateById("aeos-wordpress-php")?.templateId,
    "aeos-wordpress-php",
  );
  assert.equal(getBuiltInSmartTemplateCandidateById("missing-template"), undefined);
}

{
  const builtInCandidates = listBuiltInSmartTemplateCandidates();
  const result = select({
    profile: profile({
      summary: {
        confidence: "high",
        primaryLanguage: "typescript",
        primaryFramework: "nextjs",
        primaryPackageManager: "pnpm",
        primaryRuntime: "node",
      },
      evidenceIds: [
        "language:typescript:tsconfig",
        "framework:nextjs:dependency",
        "package-manager:pnpm:lockfile",
        "runtime:node:package",
      ],
    }),
    candidates: builtInCandidates,
  });

  assert.equal(result.recommendation.selectedCandidate?.templateId, "aeos-nextjs-typescript");
  assert.equal(result.fallbackUsed, false);
  assert.ok(result.recommendation.evidence.ruleIds.length > 0);
}

{
  const builtInCandidates = listBuiltInSmartTemplateCandidates();
  const result = select({
    profile: profile({
      summary: {
        confidence: "high",
        primaryLanguage: "php",
        primaryFramework: "wordpress",
        primaryPackageManager: "composer",
        primaryRuntime: "php",
      },
      evidenceIds: [
        "language:php:composer",
        "framework:wordpress:files",
        "package-manager:composer:lockfile",
        "runtime:php:composer",
      ],
    }),
    candidates: builtInCandidates,
  });

  assert.equal(result.recommendation.selectedCandidate?.templateId, "aeos-wordpress-php");
  assert.equal(result.fallbackUsed, false);
  assert.ok(result.recommendation.evidence.ruleIds.length > 0);
}

{
  const builtInCandidates = listBuiltInSmartTemplateCandidates();
  const result = select({
    profile: profile({
      summary: {
        confidence: "high",
        primaryLanguage: "php",
        primaryFramework: "unknown",
        primaryPackageManager: "composer",
        primaryRuntime: "php",
      },
      evidenceIds: [
        "language:php:composer",
        "package-manager:composer:lockfile",
        "runtime:php:composer",
      ],
    }),
    candidates: builtInCandidates,
  });

  assert.equal(
    result.recommendation.selectedCandidate?.templateId,
    "aeos-php-composer",
    "PHP/composer without WordPress evidence should deterministically prefer the more specific non-WordPress candidate",
  );
  assert.equal(result.fallbackUsed, false);
}

{
  const builtInCandidates = listBuiltInSmartTemplateCandidates();
  const result = select({
    profile: profile({
      summary: {
        confidence: "unknown",
      },
    }),
    candidates: builtInCandidates,
  });

  assert.equal(result.recommendation.selectedCandidate, undefined);
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.recommendation.fallback, "generic");
  assert.equal(result.recommendation.confidence, "unknown");
  assert.ok(result.recommendation.evidence.ruleIds.includes("fallback.generic"));
  assert.ok(result.issues.some((issue) => issue.code === "no_confident_match"));
}

{
  const builtInCandidates = listBuiltInSmartTemplateCandidates();
  const expectedTemplateIds = builtInCandidates.map((item) => item.templateId).sort();
  const result = select({
    profile: profile({
      summary: {
        confidence: "high",
        primaryLanguage: "typescript",
        primaryFramework: "nextjs",
        primaryPackageManager: "pnpm",
        primaryRuntime: "node",
      },
      evidenceIds: [
        "language:typescript:tsconfig",
        "framework:nextjs:dependency",
        "package-manager:pnpm:lockfile",
        "runtime:node:package",
      ],
    }),
    candidates: builtInCandidates,
  });

  assert.deepEqual(
    result.candidates.map((item) => item.templateId).sort(),
    expectedTemplateIds,
    "selector must only return supplied built-in smart template candidates",
  );
  assert.ok(
    result.candidates.every((item) => expectedTemplateIds.includes(item.templateId)),
    "selector result must not include invented catalog candidates",
  );
}

{
  const first = listBuiltInSmartTemplateCandidates();

  first[0].templateId = "mutated-local-copy";
  first[1].supportedLanguages.push("mutated-language");
  first[2].evidence.ruleIds.push("mutated-rule");
  first[3].issues.push({
    code: "unknown",
    message: "mutated issue",
    severity: "info",
  });

  const later = listBuiltInSmartTemplateCandidates();

  assert.deepEqual(
    later.map((item) => item.templateId),
    [
      "aeos-generic-minimal",
      "aeos-nextjs-typescript",
      "aeos-wordpress-php",
      "aeos-php-composer",
    ],
    "mutating a listed candidate must not affect later built-in candidate lists",
  );
  assert.equal(later[1].supportedLanguages.includes("mutated-language"), false);
  assert.equal(later[2].evidence.ruleIds.includes("mutated-rule"), false);
  assert.equal(later[3].issues.some((issue) => issue.message === "mutated issue"), false);
}

console.log("smart template selector smoke passed");
