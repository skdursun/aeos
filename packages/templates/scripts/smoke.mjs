import assert from "node:assert/strict";

import {
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

console.log("smart template selector smoke passed");
