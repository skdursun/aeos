import type { SmartTemplateCandidate } from "./smart-selection.js";

const emptyEvidence: SmartTemplateCandidate["evidence"] = {
  profileEvidenceIds: [],
  matchedProfileFields: [],
  matchedTemplateFields: [],
  ruleIds: [],
  confidence: "unknown",
  reducedByIssueCodes: [],
};

const builtInSmartTemplateCandidates = [
  {
    templateId: "aeos-generic-minimal",
    templateName: "AEOS Generic Minimal",
    source: "unknown",
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
  },
  {
    templateId: "aeos-nextjs-typescript",
    templateName: "AEOS Next.js TypeScript",
    source: "unknown",
    type: "project_starter",
    supportedLanguages: ["javascript", "typescript"],
    supportedFrameworks: ["nextjs", "react"],
    supportedPackageManagers: ["npm", "pnpm", "yarn"],
    supportedRuntimes: ["node"],
    supportedInfrastructure: [],
    score: "unknown",
    confidence: "unknown",
    evidence: emptyEvidence,
    issues: [],
  },
  {
    templateId: "aeos-wordpress-php",
    templateName: "AEOS WordPress PHP",
    source: "unknown",
    type: "project_starter",
    supportedLanguages: ["php"],
    supportedFrameworks: ["wordpress"],
    supportedPackageManagers: ["composer"],
    supportedRuntimes: ["php"],
    supportedInfrastructure: [],
    score: "unknown",
    confidence: "unknown",
    evidence: emptyEvidence,
    issues: [],
  },
  {
    templateId: "aeos-php-composer",
    templateName: "AEOS PHP Composer",
    source: "unknown",
    type: "project_starter",
    supportedLanguages: ["php"],
    supportedFrameworks: [],
    supportedPackageManagers: ["composer"],
    supportedRuntimes: ["php"],
    supportedInfrastructure: [],
    score: "unknown",
    confidence: "unknown",
    evidence: emptyEvidence,
    issues: [],
  },
] satisfies readonly SmartTemplateCandidate[];

export function listBuiltInSmartTemplateCandidates(): readonly SmartTemplateCandidate[] {
  return builtInSmartTemplateCandidates.map(cloneSmartTemplateCandidate);
}

export function getBuiltInSmartTemplateCandidateById(
  templateId: string,
): SmartTemplateCandidate | undefined {
  const candidate = builtInSmartTemplateCandidates.find(
    (item) => item.templateId === templateId,
  );

  return candidate ? cloneSmartTemplateCandidate(candidate) : undefined;
}

function cloneSmartTemplateCandidate(
  candidate: SmartTemplateCandidate,
): SmartTemplateCandidate {
  return {
    ...candidate,
    supportedLanguages: [...candidate.supportedLanguages],
    supportedFrameworks: [...candidate.supportedFrameworks],
    supportedPackageManagers: [...candidate.supportedPackageManagers],
    supportedRuntimes: [...candidate.supportedRuntimes],
    supportedInfrastructure: [...candidate.supportedInfrastructure],
    evidence: {
      ...candidate.evidence,
      profileEvidenceIds: [...candidate.evidence.profileEvidenceIds],
      matchedProfileFields: [...candidate.evidence.matchedProfileFields],
      matchedTemplateFields: [...candidate.evidence.matchedTemplateFields],
      ruleIds: [...candidate.evidence.ruleIds],
      reducedByIssueCodes: [...candidate.evidence.reducedByIssueCodes],
    },
    issues: candidate.issues.map((issue) => ({
      ...issue,
      ...(issue.evidenceIds ? { evidenceIds: [...issue.evidenceIds] } : {}),
    })),
  };
}
