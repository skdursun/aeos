import type {
  SmartTemplateAvailableTemplate,
  SmartTemplateCandidate,
  SmartTemplateCandidateEvidence,
  SmartTemplateCandidateScore,
  SmartTemplateRecommendation,
  SmartTemplateSelectionConfidence,
  SmartTemplateSelectionFallback,
  SmartTemplateSelectionInput,
  SmartTemplateSelectionIssue,
  SmartTemplateSelectionIssueCode,
  SmartTemplateSelectionMode,
  SmartTemplateSelectionResult,
  SmartTemplateSelectionSummary,
  SmartTemplateSource,
  SmartTemplateType,
} from "./smart-selection.js";

interface SignalMatch {
  readonly profileField: string;
  readonly templateField: string;
  readonly ruleId: string;
  readonly evidenceIds: readonly string[];
  readonly weight: number;
}

const confidenceRank: Record<SmartTemplateSelectionConfidence, number> = {
  unknown: 0,
  low: 1,
  medium: 2,
  high: 3,
};

const scoreRank: Record<SmartTemplateCandidateScore, number> = {
  unknown: 0,
  no_match: 0,
  weak_match: 1,
  partial_match: 2,
  strong_match: 3,
};

const fallbackNames: Record<SmartTemplateSelectionFallback, string> = {
  generic: "Generic AEOS Starter",
  minimal_agents: "Generic AEOS Minimal AGENTS.md",
  none: "No Fallback",
  unknown: "Unknown Fallback",
};

export function selectSmartTemplate(
  input: SmartTemplateSelectionInput,
): SmartTemplateSelectionResult {
  const inputIssues = collectInputIssues(input);
  const candidates = buildCandidates(input);
  const scoredCandidates = candidates
    .map((candidate) => scoreSmartTemplateCandidate(candidate, input))
    .sort(compareCandidates);
  const issues = [
    ...inputIssues,
    ...scoredCandidates.flatMap((candidate) => candidate.issues),
  ];
  const bestCandidate = scoredCandidates[0];
  const shouldFallback = !bestCandidate || !hasMeaningfulEvidence(bestCandidate);
  const selectionIssues = [
    ...issues,
    ...createSelectionIssues(input, candidates.length, bestCandidate),
  ];
  const recommendation = shouldFallback
    ? createSmartTemplateFallbackRecommendation(input, selectionIssues)
    : createRecommendation(bestCandidate, input.fallback);
  const resultIssues = [
    ...selectionIssues,
    ...recommendation.issues.filter(
      (issue) => !selectionIssues.some((existing) => sameIssue(existing, issue)),
    ),
  ];
  const result: SmartTemplateSelectionResult = {
    ok: true,
    mode: input.mode,
    projectRoot: input.projectRoot,
    recommendation,
    candidates: input.options?.includeCandidates === false ? [] : scoredCandidates,
    fallbackUsed: recommendation.fallbackUsed,
    issues: resultIssues,
    summary: summarizeSmartTemplateSelectionResult({
      recommendation,
      candidates: scoredCandidates,
      issues: resultIssues,
      fallback: recommendation.fallback,
    }),
  };

  return result;
}

export function scoreSmartTemplateCandidate(
  candidate: SmartTemplateCandidate,
  input: SmartTemplateSelectionInput,
): SmartTemplateCandidate {
  const matches = collectSignalMatches(candidate, input);
  const weight = matches.reduce((total, match) => total + match.weight, 0);
  const evidence = createEvidence(input, matches);
  const issues = createCandidateIssues(candidate, matches, input.profile.issueCodes);

  return {
    ...candidate,
    score: scoreFromWeight(weight),
    confidence: confidenceFromMatches(matches, input.profile.summary.confidence),
    evidence,
    issues,
  };
}

export function createSmartTemplateFallbackRecommendation(
  input: SmartTemplateSelectionInput,
  issues: readonly SmartTemplateSelectionIssue[] = [],
): SmartTemplateRecommendation {
  const fallbackIssue =
    input.fallback === "none"
      ? createIssue(
          "fallback_required",
          "No smart template matched and fallback mode is none.",
          "error",
        )
      : createIssue(
          "fallback_required",
          `${fallbackNames[input.fallback]} fallback is used because no confident smart template matched.`,
          "info",
        );

  return {
    fallbackUsed: true,
    fallback: input.fallback,
    fallbackReason: fallbackIssue.message,
    confidence: "unknown",
    evidence: {
      profileEvidenceIds: [],
      matchedProfileFields: [],
      matchedTemplateFields: [],
      ruleIds: [`fallback.${input.fallback.replace("_", "-")}`],
      confidence: "unknown",
      reducedByIssueCodes: ["no_confident_match"],
    },
    issues: [...issues, fallbackIssue],
  };
}

export function summarizeSmartTemplateSelectionResult(input: {
  readonly recommendation: SmartTemplateRecommendation;
  readonly candidates: readonly SmartTemplateCandidate[];
  readonly issues: readonly SmartTemplateSelectionIssue[];
  readonly fallback: SmartTemplateSelectionFallback;
}): SmartTemplateSelectionSummary {
  const evidenceCount = input.candidates.reduce(
    (total, candidate) => total + candidate.evidence.ruleIds.length,
    input.recommendation.evidence.ruleIds.length,
  );

  return {
    candidateCount: input.candidates.length,
    issueCount: input.issues.length,
    selectedTemplateId: input.recommendation.selectedCandidate?.templateId,
    fallback: input.fallback,
    confidence: input.recommendation.confidence,
    evidenceCount,
    fallbackUsed: input.recommendation.fallbackUsed,
  } as SmartTemplateSelectionSummary & {
    readonly evidenceCount: number;
    readonly fallbackUsed: boolean;
  };
}

function buildCandidates(
  input: SmartTemplateSelectionInput,
): readonly SmartTemplateCandidate[] {
  if (input.candidates && input.candidates.length > 0) {
    return input.candidates.map(normalizeCandidate);
  }

  return (input.templates ?? []).map(candidateFromTemplate);
}

function candidateFromTemplate(
  template: SmartTemplateAvailableTemplate,
): SmartTemplateCandidate {
  return {
    templateId: template.id,
    templateName: template.name,
    source: template.source ?? "unknown",
    type: template.type ?? "unknown",
    supportedLanguages: normalizeList(template.supportedLanguages),
    supportedFrameworks: normalizeList(template.supportedFrameworks),
    supportedPackageManagers: normalizeList(template.supportedPackageManagers),
    supportedRuntimes: normalizeList(template.supportedRuntimes),
    supportedInfrastructure: normalizeList(template.supportedInfrastructure),
    score: "unknown",
    confidence: "unknown",
    evidence: emptyEvidence("unknown"),
    issues: [],
  };
}

function normalizeCandidate(candidate: SmartTemplateCandidate): SmartTemplateCandidate {
  return {
    ...candidate,
    source: normalizeSource(candidate.source),
    type: normalizeType(candidate.type),
    supportedLanguages: normalizeList(candidate.supportedLanguages),
    supportedFrameworks: normalizeList(candidate.supportedFrameworks),
    supportedPackageManagers: normalizeList(candidate.supportedPackageManagers),
    supportedRuntimes: normalizeList(candidate.supportedRuntimes),
    supportedInfrastructure: normalizeList(candidate.supportedInfrastructure),
  };
}

function collectSignalMatches(
  candidate: SmartTemplateCandidate,
  input: SmartTemplateSelectionInput,
): readonly SignalMatch[] {
  const summary = input.profile.summary;
  const matches: SignalMatch[] = [];

  addValueMatch(matches, {
    value: summary.primaryFramework,
    supportedValues: candidate.supportedFrameworks,
    profileField: "summary.primaryFramework",
    templateField: "supportedFrameworks",
    evidencePrefix: "framework",
    ruleCategory: "framework",
    weight: 4,
    input,
  });
  addValueMatch(matches, {
    value: summary.primaryRuntime,
    supportedValues: candidate.supportedRuntimes,
    profileField: "summary.primaryRuntime",
    templateField: "supportedRuntimes",
    evidencePrefix: "runtime",
    ruleCategory: "runtime",
    weight: 2,
    input,
  });
  addValueMatch(matches, {
    value: summary.primaryLanguage,
    supportedValues: candidate.supportedLanguages,
    profileField: "summary.primaryLanguage",
    templateField: "supportedLanguages",
    evidencePrefix: "language",
    ruleCategory: "language",
    weight: 2,
    input,
  });
  addValueMatch(matches, {
    value: summary.primaryPackageManager,
    supportedValues: candidate.supportedPackageManagers,
    profileField: "summary.primaryPackageManager",
    templateField: "supportedPackageManagers",
    evidencePrefix: "package-manager",
    ruleCategory: "package-manager",
    weight: 1,
    input,
  });

  if (
    summary.hasInfrastructure &&
    candidate.supportedInfrastructure.length > 0 &&
    hasEvidenceWithPrefix(input.profile.evidenceIds, "infrastructure")
  ) {
    const infrastructure = candidate.supportedInfrastructure[0] ?? "unknown";
    matches.push({
      profileField: "summary.hasInfrastructure",
      templateField: "supportedInfrastructure",
      ruleId: `match.infrastructure.${infrastructure}`,
      evidenceIds: evidenceIdsForPrefix(input.profile.evidenceIds, "infrastructure"),
      weight: 1,
    });
  }

  return matches;
}

function addValueMatch(
  matches: SignalMatch[],
  options: {
    readonly value: string;
    readonly supportedValues: readonly string[];
    readonly profileField: string;
    readonly templateField: string;
    readonly evidencePrefix: string;
    readonly ruleCategory: string;
    readonly weight: number;
    readonly input: SmartTemplateSelectionInput;
  },
): void {
  const value = normalizeValue(options.value);

  if (value === "unknown" || !options.supportedValues.includes(value)) {
    return;
  }

  matches.push({
    profileField: options.profileField,
    templateField: options.templateField,
    ruleId: `match.${options.ruleCategory}.${value}`,
    evidenceIds: evidenceIdsForPrefix(
      options.input.profile.evidenceIds,
      options.evidencePrefix,
    ),
    weight: options.weight,
  });
}

function createEvidence(
  input: SmartTemplateSelectionInput,
  matches: readonly SignalMatch[],
): SmartTemplateCandidateEvidence {
  const reducedByIssueCodes = [...input.profile.issueCodes].sort();

  return {
    profileEvidenceIds: uniqueSorted(matches.flatMap((match) => match.evidenceIds)),
    matchedProfileFields: uniqueSorted(matches.map((match) => match.profileField)),
    matchedTemplateFields: uniqueSorted(matches.map((match) => match.templateField)),
    ruleIds: matches.map((match) => match.ruleId).sort(),
    confidence: confidenceFromMatches(matches, input.profile.summary.confidence),
    reducedByIssueCodes,
  };
}

function confidenceFromMatches(
  matches: readonly SignalMatch[],
  profileConfidence: SmartTemplateSelectionConfidence,
): SmartTemplateSelectionConfidence {
  if (matches.length === 0 || profileConfidence === "unknown") {
    return "unknown";
  }

  const hasFramework = matches.some(
    (match) => match.profileField === "summary.primaryFramework",
  );
  const weight = matches.reduce((total, match) => total + match.weight, 0);
  const baseConfidence =
    hasFramework && weight >= 6
      ? "high"
      : hasFramework || weight >= 4
        ? "medium"
        : "low";

  return lowerConfidence(baseConfidence, profileConfidence);
}

function scoreFromWeight(weight: number): SmartTemplateCandidateScore {
  if (weight >= 6) {
    return "strong_match";
  }

  if (weight >= 3) {
    return "partial_match";
  }

  if (weight > 0) {
    return "weak_match";
  }

  return "no_match";
}

function createCandidateIssues(
  candidate: SmartTemplateCandidate,
  matches: readonly SignalMatch[],
  profileIssueCodes: readonly string[],
): readonly SmartTemplateSelectionIssue[] {
  const issues: SmartTemplateSelectionIssue[] = [];

  if (candidate.templateId.trim() === "" || candidate.templateName.trim() === "") {
    issues.push(
      createIssue(
        "invalid_candidate",
        "Template candidate must include a template id and name.",
        "error",
        candidate.templateId,
      ),
    );
  }

  if (matches.length === 0) {
    issues.push(
      createIssue(
        "no_confident_match",
        "Template candidate does not match any project profile signal.",
        "info",
        candidate.templateId,
      ),
    );
  } else if (!matches.some((match) => match.profileField === "summary.primaryFramework")) {
    issues.push(
      createIssue(
        "weak_evidence",
        "Template candidate matched only broad non-framework project signals.",
        "info",
        candidate.templateId,
        uniqueSorted(matches.flatMap((match) => match.evidenceIds)),
      ),
    );
  }

  if (profileIssueCodes.length > 0 && matches.length > 0) {
    issues.push(
      createIssue(
        "profile_issue",
        "Project profile issues reduced smart template selection confidence.",
        "warning",
        candidate.templateId,
        uniqueSorted(matches.flatMap((match) => match.evidenceIds)),
      ),
    );
  }

  return issues;
}

function collectInputIssues(
  input: SmartTemplateSelectionInput,
): readonly SmartTemplateSelectionIssue[] {
  const issues: SmartTemplateSelectionIssue[] = [];
  const candidates = buildCandidates(input);
  const duplicateTemplateIds = findDuplicateTemplateIds(candidates);

  if (candidates.length === 0) {
    issues.push(
      createIssue(
        "no_available_templates",
        "No available templates were provided for smart selection.",
        "error",
      ),
    );
  }

  if (input.mode === "unknown") {
    issues.push(
      createIssue("unknown", "Smart template selection mode is unknown.", "warning"),
    );
  }

  if (input.fallback === "unknown") {
    issues.push(
      createIssue("unknown", "Smart template selection fallback is unknown.", "warning"),
    );
  }

  for (const templateId of duplicateTemplateIds) {
    issues.push(
      createIssue(
        "duplicate_template_id",
        `Duplicate smart template candidate id: ${templateId}.`,
        "error",
        templateId,
      ),
    );
  }

  return issues;
}

function createSelectionIssues(
  input: SmartTemplateSelectionInput,
  candidateCount: number,
  bestCandidate: SmartTemplateCandidate | undefined,
): readonly SmartTemplateSelectionIssue[] {
  const issues: SmartTemplateSelectionIssue[] = [];

  if (candidateCount === 0) {
    return issues;
  }

  if (!bestCandidate || !hasMeaningfulEvidence(bestCandidate)) {
    issues.push(
      createIssue(
        "no_confident_match",
        "No smart template candidate matched project profile signals.",
        "warning",
      ),
    );
  }

  if (input.fallback === "none" && (!bestCandidate || !hasMeaningfulEvidence(bestCandidate))) {
    issues.push(
      createIssue(
        "fallback_required",
        "No smart template candidate matched and fallback mode is none.",
        "error",
      ),
    );
  }

  return issues;
}

function createRecommendation(
  selectedCandidate: SmartTemplateCandidate,
  fallback: SmartTemplateSelectionFallback,
): SmartTemplateRecommendation {
  return {
    selectedCandidate,
    fallbackUsed: false,
    fallback,
    confidence: selectedCandidate.confidence,
    evidence: selectedCandidate.evidence,
    issues: selectedCandidate.issues,
  };
}

function compareCandidates(
  left: SmartTemplateCandidate,
  right: SmartTemplateCandidate,
): number {
  const leftEvidenceCount = left.evidence.ruleIds.length;
  const rightEvidenceCount = right.evidence.ruleIds.length;

  return (
    scoreRank[right.score] - scoreRank[left.score] ||
    confidenceRank[right.confidence] - confidenceRank[left.confidence] ||
    rightEvidenceCount - leftEvidenceCount ||
    left.templateId.localeCompare(right.templateId)
  );
}

function hasMeaningfulEvidence(candidate: SmartTemplateCandidate): boolean {
  return (
    candidate.score !== "no_match" &&
    candidate.score !== "unknown" &&
    candidate.evidence.ruleIds.length > 0
  );
}

function lowerConfidence(
  candidateConfidence: SmartTemplateSelectionConfidence,
  profileConfidence: SmartTemplateSelectionConfidence,
): SmartTemplateSelectionConfidence {
  return confidenceRank[candidateConfidence] <= confidenceRank[profileConfidence]
    ? candidateConfidence
    : profileConfidence;
}

function normalizeSource(source: SmartTemplateSource): SmartTemplateSource {
  return source === "local" ? "local" : "unknown";
}

function normalizeType(type: SmartTemplateType): SmartTemplateType {
  return type === "project_starter" || type === "generic" ? type : "unknown";
}

function normalizeList(values: readonly string[] | undefined): readonly string[] {
  return uniqueSorted((values ?? []).map(normalizeValue).filter(Boolean));
}

function normalizeValue(value: string): string {
  return value.trim().toLowerCase();
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort();
}

function evidenceIdsForPrefix(
  evidenceIds: readonly string[],
  prefix: string,
): readonly string[] {
  return evidenceIds.filter((id) => id.startsWith(`${prefix}:`)).sort();
}

function hasEvidenceWithPrefix(
  evidenceIds: readonly string[],
  prefix: string,
): boolean {
  return evidenceIds.some((id) => id.startsWith(`${prefix}:`));
}

function findDuplicateTemplateIds(
  candidates: readonly SmartTemplateCandidate[],
): readonly string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const candidate of candidates) {
    if (seen.has(candidate.templateId)) {
      duplicates.add(candidate.templateId);
    }

    seen.add(candidate.templateId);
  }

  return [...duplicates].sort();
}

function sameIssue(
  left: SmartTemplateSelectionIssue,
  right: SmartTemplateSelectionIssue,
): boolean {
  return left.code === right.code && left.message === right.message;
}

function emptyEvidence(
  confidence: SmartTemplateSelectionConfidence,
): SmartTemplateCandidateEvidence {
  return {
    profileEvidenceIds: [],
    matchedProfileFields: [],
    matchedTemplateFields: [],
    ruleIds: [],
    confidence,
    reducedByIssueCodes: [],
  };
}

function createIssue(
  code: SmartTemplateSelectionIssueCode,
  message: string,
  severity: SmartTemplateSelectionIssue["severity"],
  templateId?: string,
  evidenceIds?: readonly string[],
): SmartTemplateSelectionIssue {
  return {
    code,
    message,
    severity,
    ...(templateId ? { templateId } : {}),
    ...(evidenceIds && evidenceIds.length > 0
      ? { evidenceIds: uniqueSorted(evidenceIds) }
      : {}),
  };
}
