import type {
  InitGeneratedFile,
  InitIssue,
  InitResult,
  InitValidationSummary,
} from "./init.js";
import type {
  InitArtifactSummary,
  InitExecutionContext,
  InitExecutionPlan,
  InitPipelineResult,
  InitStage,
  InitStageHandler,
  InitStageResult,
} from "./init-engine.js";

export const defaultInitPipelineStages: readonly InitStage[] = [
  "project_detection",
  "template_selection",
  "variable_resolution",
  "rendering",
  "file_writing",
  "validation",
];

export type InitPipelineStageHandlers = Readonly<
  Partial<Record<InitStage, InitStageHandler>>
>;

export interface InitPipelineOptions {
  readonly stages?: readonly InitStage[];
  readonly requestedAt?: string;
}

export function createInitPipeline(
  request: InitExecutionContext["request"],
  options: InitPipelineOptions = {},
): InitExecutionPlan {
  return {
    stages: options.stages ?? defaultInitPipelineStages,
    targetRoot: request.projectRoot,
    templateId: request.template.templateId,
    variableNames: Object.keys(request.variables).sort((left, right) =>
      left.localeCompare(right),
    ),
    requestedAt: options.requestedAt ?? request.requestedAt,
  };
}

export async function executeInitStage(
  context: InitExecutionContext,
  stage: InitStage,
  handler: InitStageHandler | undefined,
): Promise<InitStageResult> {
  if (handler === undefined) {
    return createSkippedStageResult(stage);
  }

  try {
    const result = await handler(context);

    if (result.stage !== stage) {
      return createFailedStageResult(stage, {
        code: "init_stage_mismatch",
        message: `Init stage handler returned result for ${result.stage} while executing ${stage}.`,
      });
    }

    return result;
  } catch (error) {
    return createFailedStageResult(stage, {
      code: "init_stage_unexpected_error",
      message: getErrorMessage(error),
    });
  }
}

export async function executeInitPipeline(
  request: InitExecutionContext["request"],
  handlers: InitPipelineStageHandlers = {},
  options: InitPipelineOptions = {},
): Promise<InitPipelineResult> {
  const plan = createInitPipeline(request, options);
  const stages: InitStageResult[] = [];
  let shouldSkipUntilValidation = false;

  for (const stage of plan.stages) {
    const result =
      shouldSkipUntilValidation && stage !== "validation"
        ? createSkippedStageResult(stage)
        : await executeInitStage(
            createExecutionContext(request, plan, stages),
            stage,
            handlers[stage],
          );

    stages.push(result);

    if (result.status === "failure" && stage !== "validation") {
      shouldSkipUntilValidation = true;
    }
  }

  const generatedFiles = collectGeneratedFiles(stages);
  const validation = createValidationSummary(stages);
  const errors = collectErrors(stages);

  return {
    ok: errors.length === 0,
    request,
    plan,
    stages,
    generatedFiles,
    validation,
    errors,
  };
}

export function createInitResult(
  pipelineResult: InitPipelineResult,
): InitResult {
  return {
    ok: pipelineResult.ok,
    projectRoot: pipelineResult.plan.targetRoot,
    template: pipelineResult.request.template,
    variablesUsed: pipelineResult.plan.variableNames,
    generatedFiles: pipelineResult.generatedFiles,
    validation: pipelineResult.validation,
    errors: pipelineResult.errors,
  };
}

function createExecutionContext(
  request: InitExecutionContext["request"],
  plan: InitExecutionPlan,
  completedStages: readonly InitStageResult[],
): InitExecutionContext {
  return {
    request,
    plan,
    completedStages,
    generatedFiles: collectGeneratedFiles(completedStages),
    validation: createValidationSummary(completedStages),
  };
}

function createSkippedStageResult(stage: InitStage): InitStageResult {
  return {
    stage,
    status: "skipped",
    issues: [],
    artifacts: [],
  };
}

function createFailedStageResult(
  stage: InitStage,
  issue: InitIssue,
): InitStageResult {
  return {
    stage,
    status: "failure",
    issues: [issue],
    artifacts: [],
  };
}

function collectErrors(
  stages: readonly InitStageResult[],
): readonly InitIssue[] {
  return stages.flatMap((stage) =>
    stage.status === "failure" ? stage.issues : [],
  );
}

function createValidationSummary(
  stages: readonly InitStageResult[],
): InitValidationSummary {
  const warnings = stages.flatMap((stage) =>
    stage.status === "success" ? stage.issues : [],
  );
  const failed = collectErrors(stages);
  const checksRun = stages
    .filter((stage) => stage.status !== "skipped")
    .map((stage) => stage.stage);
  const passed = stages
    .filter((stage) => stage.status === "success" && stage.issues.length === 0)
    .map((stage) => stage.stage);
  const skipped = stages
    .filter((stage) => stage.status === "skipped")
    .map((stage) => stage.stage);

  return {
    status: getValidationStatus(failed, warnings, stages),
    checksRun,
    passed,
    warnings,
    failed,
    skipped,
  };
}

function getValidationStatus(
  failed: readonly InitIssue[],
  warnings: readonly InitIssue[],
  stages: readonly InitStageResult[],
): InitValidationSummary["status"] {
  if (failed.length > 0) {
    return "fail";
  }

  if (warnings.length > 0) {
    return "warn";
  }

  return stages.length === 0 || stages.every((stage) => stage.status === "skipped")
    ? "skipped"
    : "pass";
}

function collectGeneratedFiles(
  stages: readonly InitStageResult[],
): readonly InitGeneratedFile[] {
  const generatedFiles = new Map<string, InitGeneratedFile>();

  for (const stage of stages) {
    for (const artifact of stage.artifacts) {
      const generatedFile = createGeneratedFile(stage, artifact);

      if (generatedFile !== undefined) {
        generatedFiles.set(generatedFile.path, generatedFile);
      }
    }
  }

  return [...generatedFiles.values()].sort((left, right) =>
    left.path.localeCompare(right.path),
  );
}

function createGeneratedFile(
  stage: InitStageResult,
  artifact: InitArtifactSummary,
): InitGeneratedFile | undefined {
  const artifactStage = artifact.stage ?? stage.stage;

  if (artifactStage !== "rendering" && artifactStage !== "file_writing") {
    return undefined;
  }

  const generatedFile = {
    path: artifact.path,
    status: getGeneratedFileStatus(stage),
    summary: artifact.summary,
  };

  return artifact.sourcePath === undefined
    ? generatedFile
    : {
        ...generatedFile,
        sourcePath: artifact.sourcePath,
      };
}

function getGeneratedFileStatus(
  stage: InitStageResult,
): InitGeneratedFile["status"] {
  if (stage.stage === "rendering") {
    return stage.status === "failure" ? "blocked" : "planned";
  }

  if (stage.stage === "file_writing") {
    return stage.status === "success" ? "created" : "blocked";
  }

  return "planned";
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Init stage failed with an unexpected error.";
}
