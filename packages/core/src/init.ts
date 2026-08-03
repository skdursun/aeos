export type InitVariableMap = Readonly<Record<string, string>>;

export type InitWorkflowStatus = "pass" | "warn" | "fail" | "skipped";

export type InitGeneratedFileStatus =
  | "planned"
  | "created"
  | "skipped"
  | "blocked";

export interface InitIssue {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
  readonly details?: Readonly<Record<string, string>>;
}

export interface InitTemplateSelection {
  readonly templateId: string;
  readonly templateRoot?: string;
  readonly templateVersion?: string;
}

export interface InitRequest {
  readonly projectRoot: string;
  readonly template: InitTemplateSelection;
  readonly variables: InitVariableMap;
  readonly requestedAt?: string;
}

export interface InitRenderInput {
  readonly projectRoot: string;
  readonly template: InitTemplateSelection;
  readonly variables: InitVariableMap;
  readonly targetPaths: readonly string[];
}

export interface InitRenderedArtifact {
  readonly targetPath: string;
  readonly content: string;
  readonly kind: "text";
  readonly summary: string;
  readonly sourcePath?: string;
  readonly templateId?: string;
  readonly templateVersion?: string;
}

export interface InitGeneratedFile {
  readonly path: string;
  readonly status: InitGeneratedFileStatus;
  readonly summary: string;
  readonly sourcePath?: string;
}

export interface InitValidationSummary {
  readonly status: InitWorkflowStatus;
  readonly checksRun: readonly string[];
  readonly passed: readonly string[];
  readonly warnings: readonly InitIssue[];
  readonly failed: readonly InitIssue[];
  readonly skipped: readonly string[];
}

export interface InitResult {
  readonly ok: boolean;
  readonly projectRoot: string;
  readonly template: InitTemplateSelection;
  readonly variablesUsed: readonly string[];
  readonly renderInput?: InitRenderInput;
  readonly generatedFiles: readonly InitGeneratedFile[];
  readonly validation: InitValidationSummary;
  readonly errors: readonly InitIssue[];
}
