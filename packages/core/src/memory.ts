import type {
  AeosError,
  AeosId,
  ISODateTime,
  JsonObject,
  Result,
  RiskClass,
  VerificationStatus,
} from "./types.js";

export type MemoryEntryId = AeosId;

export type MemoryType =
  | "bug"
  | "decision"
  | "pattern"
  | "incident"
  | "lesson"
  | "prompt"
  | "benchmark"
  | "research"
  | "postmortem";

export type MemoryScope = "active" | "project" | "global" | string;

export type MemorySeverity = "info" | "warning" | "error";

export type MemoryConfidence = "low" | "medium" | "high";

export type MemoryEntryStatus =
  | "draft"
  | "verified"
  | "superseded"
  | "archived";

export type MemoryRedactionStatus =
  | "not_required"
  | "pending"
  | "redacted"
  | "blocked";

export interface MemoryFrontmatter {
  readonly type: MemoryType;
  readonly title: string;
  readonly date: ISODateTime;
  readonly sourceTask: AeosId | "unknown";
  readonly status: MemoryEntryStatus;
  readonly tags: readonly string[];
  readonly supersedes?: string;
  readonly supersededBy?: string;
  readonly related?: readonly string[];
  readonly owner?: string;
  readonly scope?: MemoryScope;
  readonly confidence?: MemoryConfidence;
  readonly expires?: ISODateTime;
  readonly metadata?: JsonObject;
}

export interface MemoryBodySection {
  readonly heading: string;
  readonly content: string;
  readonly order: number;
}

export interface MemoryEntry {
  readonly id: MemoryEntryId;
  readonly path?: string;
  readonly frontmatter: MemoryFrontmatter;
  readonly summary: string;
  readonly sections: readonly MemoryBodySection[];
  readonly redactionStatus: MemoryRedactionStatus;
  readonly createdAt?: ISODateTime;
  readonly updatedAt?: ISODateTime;
  readonly metadata?: JsonObject;
}

export interface MemoryWriteRequest {
  readonly type: MemoryType;
  readonly title: string;
  readonly sourceTask: AeosId | "unknown";
  readonly tags: readonly string[];
  readonly summary: string;
  readonly sections: readonly MemoryBodySection[];
  readonly status?: MemoryEntryStatus;
  readonly scope?: MemoryScope;
  readonly confidence?: MemoryConfidence;
  readonly related?: readonly string[];
  readonly owner?: string;
  readonly metadata?: JsonObject;
}

export interface MemoryWriteSuccess {
  readonly entry: MemoryEntry;
  readonly created: boolean;
  readonly validation: MemoryValidationResult;
}

export type MemoryWriteResult = Result<MemoryWriteSuccess, AeosError>;

export interface MemorySearchFilter {
  readonly types?: readonly MemoryType[];
  readonly scopes?: readonly MemoryScope[];
  readonly tags?: readonly string[];
  readonly statuses?: readonly MemoryEntryStatus[];
  readonly sourceTasks?: readonly AeosId[];
  readonly owners?: readonly string[];
  readonly confidence?: readonly MemoryConfidence[];
  readonly includeExpired?: boolean;
  readonly redactionStatuses?: readonly MemoryRedactionStatus[];
}

export interface MemorySearchQuery {
  readonly query: string;
  readonly filter?: MemorySearchFilter;
  readonly limit?: number;
  readonly tokenBudget?: number;
  readonly requestedAt?: ISODateTime;
  readonly metadata?: JsonObject;
}

export interface MemorySearchResult {
  readonly entry: MemoryEntry;
  readonly score: number;
  readonly matchedFields: readonly string[];
  readonly excerpt?: string;
  readonly rank?: number;
}

export interface MemoryRetrievalContext {
  readonly query: MemorySearchQuery;
  readonly results: readonly MemorySearchResult[];
  readonly selectedEntries: readonly MemoryEntry[];
  readonly tokenBudget?: number;
  readonly estimatedTokens?: number;
  readonly generatedAt: ISODateTime;
  readonly metadata?: JsonObject;
}

export interface MemoryValidationIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: MemorySeverity;
  readonly path?: string;
  readonly field?: string;
  readonly riskClass?: RiskClass;
}

export interface MemoryValidationResult {
  readonly status: VerificationStatus;
  readonly valid: boolean;
  readonly issues: readonly MemoryValidationIssue[];
}
