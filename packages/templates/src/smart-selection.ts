export type SmartTemplateSelectionConfidence =
  | "high"
  | "medium"
  | "low"
  | "unknown";

export type SmartTemplateSelectionMode =
  | "recommend"
  | "init"
  | "unknown";

export type SmartTemplateSelectionFallback =
  | "generic"
  | "none"
  | "minimal_agents"
  | "unknown";

export type SmartTemplateCandidateScore =
  | "strong_match"
  | "partial_match"
  | "weak_match"
  | "no_match"
  | "unknown";

export type SmartTemplateSelectionIssueSeverity =
  | "info"
  | "warning"
  | "error";

export type SmartTemplateSelectionIssueCode =
  | "ambiguous_candidates"
  | "duplicate_template_id"
  | "fallback_required"
  | "invalid_candidate"
  | "invalid_input"
  | "no_available_templates"
  | "no_confident_match"
  | "profile_issue"
  | "template_issue"
  | "weak_evidence"
  | "unknown";

export type SmartTemplateSource =
  | "local"
  | "unknown";

export type SmartTemplateType =
  | "project_starter"
  | "generic"
  | "unknown";

export interface SmartTemplateSelectionProfileSummary {
  readonly confidence: SmartTemplateSelectionConfidence;
  readonly primaryLanguage: string;
  readonly primaryFramework: string;
  readonly primaryPackageManager: string;
  readonly primaryRuntime: string;
  readonly hasInfrastructure: boolean;
  readonly isMonorepo: boolean;
}

export interface SmartTemplateSelectionProfile {
  readonly projectRoot: string;
  readonly summary: SmartTemplateSelectionProfileSummary;
  readonly evidenceIds: readonly string[];
  readonly issueCodes: readonly string[];
}

export interface SmartTemplateAvailableTemplate {
  readonly id: string;
  readonly name: string;
  readonly source?: SmartTemplateSource;
  readonly type?: SmartTemplateType;
  readonly supportedLanguages?: readonly string[];
  readonly supportedFrameworks?: readonly string[];
  readonly supportedPackageManagers?: readonly string[];
  readonly supportedRuntimes?: readonly string[];
  readonly supportedInfrastructure?: readonly string[];
}

export interface SmartTemplateSelectionOptions {
  readonly explicitTemplateId?: string;
  readonly includeCandidates?: boolean;
  readonly includeEvidence?: boolean;
}

export interface SmartTemplateSelectionInput {
  readonly projectRoot: string;
  readonly profile: SmartTemplateSelectionProfile;
  readonly templates?: readonly SmartTemplateAvailableTemplate[];
  readonly candidates?: readonly SmartTemplateCandidate[];
  readonly mode: SmartTemplateSelectionMode;
  readonly fallback: SmartTemplateSelectionFallback;
  readonly options?: SmartTemplateSelectionOptions;
}

export interface SmartTemplateCandidateEvidence {
  readonly profileEvidenceIds: readonly string[];
  readonly matchedProfileFields: readonly string[];
  readonly matchedTemplateFields: readonly string[];
  readonly ruleIds: readonly string[];
  readonly confidence: SmartTemplateSelectionConfidence;
  readonly reducedByIssueCodes: readonly string[];
}

export interface SmartTemplateSelectionIssue {
  readonly code: SmartTemplateSelectionIssueCode;
  readonly message: string;
  readonly severity: SmartTemplateSelectionIssueSeverity;
  readonly templateId?: string;
  readonly evidenceIds?: readonly string[];
}

export interface SmartTemplateCandidate {
  readonly templateId: string;
  readonly templateName: string;
  readonly source: SmartTemplateSource;
  readonly type: SmartTemplateType;
  readonly supportedLanguages: readonly string[];
  readonly supportedFrameworks: readonly string[];
  readonly supportedPackageManagers: readonly string[];
  readonly supportedRuntimes: readonly string[];
  readonly supportedInfrastructure: readonly string[];
  readonly score: SmartTemplateCandidateScore;
  readonly confidence: SmartTemplateSelectionConfidence;
  readonly evidence: SmartTemplateCandidateEvidence;
  readonly issues: readonly SmartTemplateSelectionIssue[];
}

export interface SmartTemplateRecommendation {
  readonly selectedCandidate?: SmartTemplateCandidate;
  readonly fallbackUsed: boolean;
  readonly fallback: SmartTemplateSelectionFallback;
  readonly fallbackReason?: string;
  readonly confidence: SmartTemplateSelectionConfidence;
  readonly evidence: SmartTemplateCandidateEvidence;
  readonly issues: readonly SmartTemplateSelectionIssue[];
}

export interface SmartTemplateSelectionSummary {
  readonly candidateCount: number;
  readonly issueCount: number;
  readonly selectedTemplateId?: string;
  readonly fallback: SmartTemplateSelectionFallback;
  readonly confidence: SmartTemplateSelectionConfidence;
}

export interface SmartTemplateSelectionResult {
  readonly ok: boolean;
  readonly mode: SmartTemplateSelectionMode;
  readonly projectRoot: string;
  readonly recommendation: SmartTemplateRecommendation;
  readonly candidates: readonly SmartTemplateCandidate[];
  readonly fallbackUsed: boolean;
  readonly issues: readonly SmartTemplateSelectionIssue[];
  readonly summary: SmartTemplateSelectionSummary;
}
