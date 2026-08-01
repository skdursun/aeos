import type {
  InitGeneratedFile,
  InitIssue,
  InitRenderInput,
  InitRequest,
  InitValidationSummary,
} from "./init.js";

export type InitStage =
  | "project_detection"
  | "template_selection"
  | "variable_resolution"
  | "rendering"
  | "file_writing"
  | "validation";

export type InitStageResultStatus = "success" | "failure" | "skipped";

export interface InitArtifactSummary {
  readonly path: string;
  readonly summary: string;
  readonly sourcePath?: string;
  readonly stage?: InitStage;
}

export interface InitStageResult {
  readonly stage: InitStage;
  readonly status: InitStageResultStatus;
  readonly issues: readonly InitIssue[];
  readonly artifacts: readonly InitArtifactSummary[];
  readonly startedAt?: string;
  readonly completedAt?: string;
}

export interface InitExecutionContext {
  readonly request: InitRequest;
  readonly plan: InitExecutionPlan;
  readonly completedStages: readonly InitStageResult[];
  readonly generatedFiles: readonly InitGeneratedFile[];
  readonly renderInput?: InitRenderInput;
  readonly validation?: InitValidationSummary;
}

export type InitStageHandler = (
  context: InitExecutionContext,
) => InitStageResult | Promise<InitStageResult>;

export interface InitPipelineResult {
  readonly ok: boolean;
  readonly request: InitRequest;
  readonly plan: InitExecutionPlan;
  readonly stages: readonly InitStageResult[];
  readonly generatedFiles: readonly InitGeneratedFile[];
  readonly validation: InitValidationSummary;
  readonly errors: readonly InitIssue[];
}

export interface InitExecutionPlan {
  readonly stages: readonly InitStage[];
  readonly targetRoot: string;
  readonly templateId: string;
  readonly variableNames: readonly string[];
  readonly requestedAt?: string;
}
