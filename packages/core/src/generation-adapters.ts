export type GenerationAdapterOperation =
  | "path_info"
  | "ensure_directory"
  | "write_file";

export type GenerationAdapterIssueSeverity = "warning" | "error";

export type GenerationAdapterIssueCode =
  | "target_exists"
  | "target_missing"
  | "target_is_directory"
  | "target_is_file"
  | "target_outside_root"
  | "parent_missing"
  | "parent_is_file"
  | "overwrite_disabled"
  | "write_skipped"
  | "path_inspection_failed"
  | "directory_ensure_failed"
  | "file_write_failed";

export type GenerationPathKind =
  | "file"
  | "directory"
  | "missing"
  | "unknown";

export type GenerationFileWriteStatus =
  | "planned"
  | "written"
  | "skipped"
  | "blocked"
  | "failed";

export type GenerationDirectoryEnsureStatus =
  | "planned"
  | "ensured"
  | "skipped"
  | "blocked"
  | "failed";

export interface GenerationAdapterIssue {
  readonly code: GenerationAdapterIssueCode;
  readonly severity: GenerationAdapterIssueSeverity;
  readonly message: string;
  readonly operation: GenerationAdapterOperation;
  readonly path?: string;
  readonly details?: Readonly<Record<string, string>>;
}

export interface GenerationPathInfo {
  readonly path: string;
  readonly exists: boolean;
  readonly kind: GenerationPathKind;
  readonly parentPath?: string;
  readonly sizeBytes?: number;
  readonly modifiedAt?: string;
  readonly issues: readonly GenerationAdapterIssue[];
}

export interface GenerationFileReadResult {
  readonly ok: boolean;
  readonly pathInfo: GenerationPathInfo;
  readonly issues: readonly GenerationAdapterIssue[];
}

export interface GenerationDirectoryEnsureRequest {
  readonly path: string;
  readonly dryRun: boolean;
}

export interface GenerationDirectoryEnsureResult {
  readonly ok: boolean;
  readonly path: string;
  readonly dryRun: boolean;
  readonly status: GenerationDirectoryEnsureStatus;
  readonly created: boolean;
  readonly issues: readonly GenerationAdapterIssue[];
}

export interface GenerationFileWriteRequest {
  readonly path: string;
  readonly content: string;
  readonly dryRun: boolean;
  readonly overwrite: false;
  readonly parentDirectory?: string;
}

export interface GenerationFileWriteResult {
  readonly ok: boolean;
  readonly path: string;
  readonly dryRun: boolean;
  readonly overwrite: false;
  readonly status: GenerationFileWriteStatus;
  readonly written: boolean;
  readonly skipped: boolean;
  readonly bytesWritten?: number;
  readonly issues: readonly GenerationAdapterIssue[];
}

export interface GenerationFileSystemAdapter {
  readonly getPathInfo: (
    path: string,
  ) => GenerationFileReadResult | Promise<GenerationFileReadResult>;
  readonly ensureDirectory: (
    request: GenerationDirectoryEnsureRequest,
  ) =>
    | GenerationDirectoryEnsureResult
    | Promise<GenerationDirectoryEnsureResult>;
  readonly writeFile: (
    request: GenerationFileWriteRequest,
  ) => GenerationFileWriteResult | Promise<GenerationFileWriteResult>;
}
