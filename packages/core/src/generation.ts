import type { InitIssue } from "./init.js";

export type GenerationWriteMode = "dry_run" | "write";

export type GenerationArtifactKind = "text";

export type GenerationArtifactStatus =
  | "planned"
  | "generated"
  | "blocked"
  | "failed";

export type GenerationConflictCode =
  | "target_exists"
  | "target_outside_root"
  | "duplicate_target"
  | "parent_is_file"
  | "target_is_directory"
  | "target_inspection_failed"
  | "overwrite_disabled";

export interface GenerationRenderedArtifact {
  readonly targetPath: string;
  readonly content: string;
  readonly kind: GenerationArtifactKind;
  readonly summary: string;
  readonly sourcePath?: string;
  readonly templateId?: string;
  readonly templateVersion?: string;
}

export interface GenerationRequest {
  readonly targetRoot: string;
  readonly artifacts: readonly GenerationRenderedArtifact[];
  readonly writeMode: GenerationWriteMode;
  readonly overwrite: false;
}

export interface GenerationArtifact {
  readonly targetPath: string;
  readonly status: GenerationArtifactStatus;
  readonly kind: GenerationArtifactKind;
  readonly summary: string;
  readonly sourcePath?: string;
  readonly templateId?: string;
  readonly templateVersion?: string;
}

export interface GenerationConflict {
  readonly code: GenerationConflictCode;
  readonly targetPath: string;
  readonly message: string;
  readonly sourcePath?: string;
  readonly details?: Readonly<Record<string, string>>;
}

export interface GenerationSummary {
  readonly targetRoot: string;
  readonly writeMode: GenerationWriteMode;
  readonly overwrite: false;
  readonly plannedArtifacts: number;
  readonly generatedArtifacts: number;
  readonly blockedArtifacts: number;
  readonly failedArtifacts: number;
  readonly conflictCount: number;
  readonly errorCount: number;
}

export interface GenerationResult {
  readonly ok: boolean;
  readonly targetRoot: string;
  readonly writeMode: GenerationWriteMode;
  readonly overwrite: false;
  readonly artifacts: readonly GenerationArtifact[];
  readonly conflicts: readonly GenerationConflict[];
  readonly errors: readonly InitIssue[];
  readonly summary: GenerationSummary;
}
