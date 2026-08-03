import type {
  SmartTemplateCandidate,
  SmartTemplateSelectionInput,
  SmartTemplateSelectionProfile,
  SmartTemplateSelectionResult,
} from "./smart-selection.js";
import {
  getBuiltInSmartTemplateCandidateById,
  listBuiltInSmartTemplateCandidates,
} from "./built-in-smart-candidates.js";
import { selectSmartTemplate } from "./smart-selector.js";

export type BuiltInSmartTemplateCandidateId =
  | "aeos-generic-minimal"
  | "aeos-nextjs-typescript"
  | "aeos-wordpress-php"
  | "aeos-php-composer";

export interface BuiltInSmartTemplateCandidateListExample {
  readonly candidateIds: readonly BuiltInSmartTemplateCandidateId[];
  readonly candidateCount: number;
}

export interface BuiltInSmartTemplateCandidateMappingExample {
  readonly templateId: BuiltInSmartTemplateCandidateId;
  readonly supportedLanguages: readonly string[];
  readonly supportedFrameworks: readonly string[];
  readonly supportedPackageManagers: readonly string[];
  readonly supportedRuntimes: readonly string[];
  readonly fallbackBehavior?: "minimal";
}

export interface BuiltInSmartTemplateSelectionExample {
  readonly selectedTemplateId: BuiltInSmartTemplateCandidateId | undefined;
  readonly fallbackUsed: boolean;
  readonly fallback: SmartTemplateSelectionInput["fallback"];
  readonly confidence: SmartTemplateSelectionResult["summary"]["confidence"];
  readonly issueCodes: readonly string[];
}

export const builtInSmartTemplateCandidateListExample: BuiltInSmartTemplateCandidateListExample = {
  candidateIds: [
    "aeos-generic-minimal",
    "aeos-nextjs-typescript",
    "aeos-wordpress-php",
    "aeos-php-composer",
  ],
  candidateCount: 4,
};

export const nextJsTypeScriptCandidateMappingExample: BuiltInSmartTemplateCandidateMappingExample = {
  templateId: "aeos-nextjs-typescript",
  supportedLanguages: ["javascript", "typescript"],
  supportedFrameworks: ["nextjs", "react"],
  supportedPackageManagers: ["npm", "pnpm", "yarn"],
  supportedRuntimes: ["node"],
};

export const wordpressPhpCandidateMappingExample: BuiltInSmartTemplateCandidateMappingExample = {
  templateId: "aeos-wordpress-php",
  supportedLanguages: ["php"],
  supportedFrameworks: ["wordpress"],
  supportedPackageManagers: ["composer"],
  supportedRuntimes: ["php"],
};

export const phpComposerCandidateMappingExample: BuiltInSmartTemplateCandidateMappingExample = {
  templateId: "aeos-php-composer",
  supportedLanguages: ["php"],
  supportedFrameworks: [],
  supportedPackageManagers: ["composer"],
  supportedRuntimes: ["php"],
};

export const genericMinimalCandidateMappingExample: BuiltInSmartTemplateCandidateMappingExample = {
  templateId: "aeos-generic-minimal",
  supportedLanguages: [],
  supportedFrameworks: [],
  supportedPackageManagers: [],
  supportedRuntimes: [],
  fallbackBehavior: "minimal",
};

export function listBuiltInCandidatesExample(): readonly SmartTemplateCandidate[] {
  return listBuiltInSmartTemplateCandidates();
}

export function deterministicCandidateListingExample(): boolean {
  const firstList = listBuiltInSmartTemplateCandidates();
  const secondList = listBuiltInSmartTemplateCandidates();

  return sameStringList(
    firstList.map((candidate) => candidate.templateId),
    secondList.map((candidate) => candidate.templateId),
  );
}

export function candidateLookupSuccessExample():
  | SmartTemplateCandidate
  | undefined {
  return getBuiltInSmartTemplateCandidateById("aeos-nextjs-typescript");
}

export function candidateLookupMissingExample():
  | SmartTemplateCandidate
  | undefined {
  return getBuiltInSmartTemplateCandidateById("missing-template");
}

export function nextJsProfileSelectionExample(): BuiltInSmartTemplateSelectionExample {
  return summarizeSelectionResult(
    selectSmartTemplate(createSelectionInput(nextJsTypeScriptProfileExample)),
  );
}

export function wordpressProfileSelectionExample(): BuiltInSmartTemplateSelectionExample {
  return summarizeSelectionResult(
    selectSmartTemplate(createSelectionInput(wordpressPhpProfileExample)),
  );
}

export function unknownProfileFallbackSelectionExample(): BuiltInSmartTemplateSelectionExample {
  return summarizeSelectionResult(
    selectSmartTemplate(createSelectionInput(unknownNoSignalProfileExample)),
  );
}

export const nextJsTypeScriptProfileExample: SmartTemplateSelectionProfile = {
  projectRoot: "/example/nextjs",
  summary: {
    confidence: "high",
    primaryLanguage: "typescript",
    primaryFramework: "nextjs",
    primaryPackageManager: "pnpm",
    primaryRuntime: "node",
    hasInfrastructure: false,
    isMonorepo: false,
  },
  evidenceIds: [
    "language:typescript:tsconfig",
    "framework:nextjs:package-json",
    "framework:react:package-json",
    "package-manager:pnpm:lockfile",
    "runtime:node:package-json",
  ],
  issueCodes: [],
};

export const wordpressPhpProfileExample: SmartTemplateSelectionProfile = {
  projectRoot: "/example/wordpress",
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
    "language:php:composer-json",
    "framework:wordpress:wp-config",
    "package-manager:composer:composer-json",
    "runtime:php:composer-json",
  ],
  issueCodes: [],
};

export const phpComposerProfileExample: SmartTemplateSelectionProfile = {
  projectRoot: "/example/php-composer",
  summary: {
    confidence: "medium",
    primaryLanguage: "php",
    primaryFramework: "unknown",
    primaryPackageManager: "composer",
    primaryRuntime: "php",
    hasInfrastructure: false,
    isMonorepo: false,
  },
  evidenceIds: [
    "language:php:composer-json",
    "package-manager:composer:composer-json",
    "runtime:php:composer-json",
  ],
  issueCodes: [],
};

export const unknownNoSignalProfileExample: SmartTemplateSelectionProfile = {
  projectRoot: "/example/unknown",
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
  issueCodes: [],
};

function createSelectionInput(
  profile: SmartTemplateSelectionProfile,
): SmartTemplateSelectionInput {
  return {
    projectRoot: profile.projectRoot,
    profile,
    candidates: listBuiltInSmartTemplateCandidates(),
    mode: "recommend",
    fallback: "minimal_agents",
    options: {
      includeCandidates: true,
      includeEvidence: true,
    },
  };
}

function summarizeSelectionResult(
  result: SmartTemplateSelectionResult,
): BuiltInSmartTemplateSelectionExample {
  return {
    selectedTemplateId: toBuiltInTemplateId(
      result.summary.selectedTemplateId,
    ),
    fallbackUsed: result.fallbackUsed,
    fallback: result.summary.fallback,
    confidence: result.summary.confidence,
    issueCodes: result.issues.map((issue) => issue.code).sort(),
  };
}

function toBuiltInTemplateId(
  templateId: string | undefined,
): BuiltInSmartTemplateCandidateId | undefined {
  if (
    templateId === "aeos-generic-minimal" ||
    templateId === "aeos-nextjs-typescript" ||
    templateId === "aeos-wordpress-php" ||
    templateId === "aeos-php-composer"
  ) {
    return templateId;
  }

  return undefined;
}

function sameStringList(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}
