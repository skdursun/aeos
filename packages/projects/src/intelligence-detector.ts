import type { ProjectIntelligenceProfile } from "./intelligence.js";

export type ProjectIntelligenceDetectorMode =
  | "profile"
  | "inventory"
  | "validate";

export type ProjectIntelligenceDetectorScope =
  | "root"
  | "known_paths"
  | "bounded_workspace";

export type ProjectIntelligenceScanEntryKind =
  | "file"
  | "directory"
  | "symlink"
  | "unknown";

export interface ProjectIntelligenceDetectorInput {
  readonly projectRoot: string;
  readonly mode: ProjectIntelligenceDetectorMode;
  readonly scope: ProjectIntelligenceDetectorScope;
  readonly options: ProjectIntelligenceDetectorOptions;
  readonly limits: ProjectIntelligenceDetectorLimits;
  readonly ignoreRules: readonly ProjectIntelligenceIgnoreRule[];
}

export interface ProjectIntelligenceDetectorOptions {
  readonly includeHiddenFiles: boolean;
  readonly followSymlinks: boolean;
  readonly includeLockfiles: boolean;
  readonly includeInfrastructure: boolean;
  readonly includeMonorepoSignals: boolean;
  readonly includeDependencySignals: boolean;
}

export interface ProjectIntelligenceDetectorLimits {
  readonly maxDepth: number;
  readonly maxFiles: number;
  readonly maxFileSizeBytes: number;
  readonly maxEvidenceEntries: number;
  readonly timeoutMs: number;
}

export interface ProjectIntelligenceIgnoreRule {
  readonly path: string | undefined;
  readonly directory: string | undefined;
  readonly extension: string | undefined;
  readonly pattern: string | undefined;
}

export interface ProjectIntelligenceScanEntry {
  readonly path: string;
  readonly kind: ProjectIntelligenceScanEntryKind;
  readonly sizeBytes: number | undefined;
  readonly extension: string | undefined;
  readonly basename: string;
  readonly depth: number;
}

export interface ProjectIntelligenceDetectorIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: "info" | "warning" | "error";
  readonly path: string | undefined;
}

export interface ProjectIntelligenceDetectorResult {
  readonly profile: ProjectIntelligenceProfile;
  readonly scannedEntries: readonly ProjectIntelligenceScanEntry[];
  readonly issues: readonly ProjectIntelligenceDetectorIssue[];
  readonly summary: {
    readonly mode: ProjectIntelligenceDetectorMode;
    readonly scope: ProjectIntelligenceDetectorScope;
    readonly scannedEntryCount: number;
    readonly issueCount: number;
    readonly truncated: boolean;
    readonly timedOut: boolean;
  };
}
