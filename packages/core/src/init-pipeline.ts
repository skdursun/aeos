import type {
  GenerationArtifact,
  GenerationRenderedArtifact,
  GenerationResult,
  GenerationWriteMode,
} from "./generation.js";
import type { GenerationExistingTargetInfo } from "./generation-engine.js";
import { executeGenerationPlan } from "./generation-engine.js";
import type {
  InitGeneratedFile,
  InitIssue,
  InitRenderedArtifact,
  InitRequest,
  InitResult,
} from "./init.js";
import type { InitAdapterSet } from "./init-adapters.js";
import {
  createDefaultInitAdapters,
  createFailedInitStageResult,
  createInitStageHandlers,
  createSuccessfulInitStageResult,
  type InitAdapterStageHandlers,
} from "./init-adapters.js";
import {
  createInitPipeline,
  createInitResult,
  defaultInitPipelineStages,
  executeInitPipeline,
  type InitPipelineOptions,
} from "./init-executor.js";
import type {
  InitArtifactSummary,
  InitExecutionContext,
  InitExecutionPlan,
  InitStageResult,
} from "./init-engine.js";

export type InitPipelineHandlers = InitAdapterStageHandlers;

export interface InitGenerationPipelineOptions {
  readonly writeMode?: GenerationWriteMode;
  readonly existingTargets?: GenerationExistingTargetInfo;
}

export interface RunInitPipelineOptions extends InitPipelineOptions {
  readonly generation?: InitGenerationPipelineOptions;
}

interface InitGenerationPipelineState {
  generationResult?: GenerationResult;
  renderInput?: InitResult["renderInput"];
}

export function createInitPipelineHandlers(
  adapters: InitAdapterSet,
): InitPipelineHandlers {
  return createInitStageHandlers(adapters);
}

export function createGenerationBackedInitPipelineHandlers(
  adapters: InitAdapterSet,
  options: InitGenerationPipelineOptions = {},
  state: InitGenerationPipelineState = {},
): InitPipelineHandlers {
  const handlers = createInitStageHandlers(adapters);

  return {
    ...handlers,
    file_writing: (context) =>
      runGenerationBackedFileWriting(context, options, state),
  };
}

export function createDefaultInitPipeline(
  request: InitRequest,
  options: InitPipelineOptions = {},
): InitExecutionPlan {
  return createInitPipeline(request, {
    ...options,
    stages: options.stages ?? defaultInitPipelineStages,
  });
}

export async function runInitPipeline(
  request: InitRequest,
  adapters: InitAdapterSet = createDefaultInitAdapters(),
  options: RunInitPipelineOptions = {},
): Promise<InitResult> {
  const generationState: InitGenerationPipelineState = {};
  const handlers = createGenerationBackedInitPipelineHandlers(
    adapters,
    options.generation,
    generationState,
  );
  const pipelineResult = await executeInitPipeline(request, handlers, {
    ...options,
    stages: options.stages ?? defaultInitPipelineStages,
  });

  return applyGenerationResult(createInitResult(pipelineResult), generationState);
}

function runGenerationBackedFileWriting(
  context: InitExecutionContext,
  options: InitGenerationPipelineOptions,
  state: InitGenerationPipelineState,
): InitStageResult {
  const renderingArtifacts = getRenderingArtifacts(context);
  const converted = convertInitArtifactsToGenerationRenderedArtifacts(
    renderingArtifacts,
    context,
  );

  state.renderInput = {
    projectRoot: context.plan.targetRoot,
    template: context.request.template,
    variables: context.request.variables,
    targetPaths: renderingArtifacts.map((artifact) => artifact.path),
  };

  if (converted.issues.length > 0) {
    return createFailedInitStageResult("file_writing", converted.issues);
  }

  const generationResult = executeGenerationPlan(
    {
      targetRoot: context.plan.targetRoot,
      artifacts: converted.artifacts,
      writeMode: options.writeMode ?? "dry_run",
      overwrite: false,
    },
    {
      existingTargets: options.existingTargets,
    },
  );

  state.generationResult = generationResult;

  const artifacts = generationResult.artifacts.map((artifact) =>
    createGenerationArtifactSummary(artifact),
  );

  return generationResult.ok
    ? createSuccessfulInitStageResult(
        "file_writing",
        artifacts,
        generationResult.errors,
      )
    : createFailedInitStageResult(
        "file_writing",
        generationResult.errors,
        artifacts,
      );
}

function getRenderingArtifacts(
  context: InitExecutionContext,
): readonly InitArtifactSummary[] {
  return context.completedStages.flatMap((stage) =>
    stage.stage === "rendering" && stage.status === "success"
      ? stage.artifacts
      : [],
  );
}

function convertInitArtifactsToGenerationRenderedArtifacts(
  artifacts: readonly InitArtifactSummary[],
  context: InitExecutionContext,
): {
  readonly artifacts: readonly GenerationRenderedArtifact[];
  readonly issues: readonly InitIssue[];
} {
  const generationArtifacts: GenerationRenderedArtifact[] = [];
  const issues: InitIssue[] = [];

  for (const artifact of artifacts) {
    const renderedArtifact = artifact.renderedArtifact;

    if (renderedArtifact === undefined) {
      issues.push({
        code: "init_generation_rendered_artifact_missing",
        message:
          "Rendering artifact cannot be passed to generation without rendered content.",
        path: artifact.path,
      });
      continue;
    }

    generationArtifacts.push(
      toGenerationRenderedArtifact(renderedArtifact, context),
    );
  }

  return {
    artifacts: generationArtifacts.sort(compareGenerationRenderedArtifacts),
    issues,
  };
}

function toGenerationRenderedArtifact(
  artifact: InitRenderedArtifact,
  context: InitExecutionContext,
): GenerationRenderedArtifact {
  return {
    targetPath: artifact.targetPath,
    content: artifact.content,
    kind: artifact.kind,
    summary: artifact.summary,
    sourcePath: artifact.sourcePath,
    templateId: artifact.templateId ?? context.request.template.templateId,
    templateVersion:
      artifact.templateVersion ?? context.request.template.templateVersion,
  };
}

function createGenerationArtifactSummary(
  artifact: GenerationArtifact,
): InitArtifactSummary {
  return {
    path: artifact.targetPath,
    sourcePath: artifact.sourcePath,
    summary: artifact.summary,
    stage: "file_writing",
  };
}

function applyGenerationResult(
  result: InitResult,
  state: InitGenerationPipelineState,
): InitResult {
  const generatedFiles =
    state.generationResult === undefined
      ? result.generatedFiles
      : state.generationResult.artifacts.map(toInitGeneratedFile);

  return {
    ...result,
    renderInput: state.renderInput,
    generatedFiles,
  };
}

function toInitGeneratedFile(
  artifact: GenerationArtifact,
): InitGeneratedFile {
  const generatedFile = {
    path: artifact.targetPath,
    status: mapGenerationStatus(artifact.status),
    summary: artifact.summary,
  };

  return artifact.sourcePath === undefined
    ? generatedFile
    : {
        ...generatedFile,
        sourcePath: artifact.sourcePath,
      };
}

function mapGenerationStatus(
  status: GenerationArtifact["status"],
): InitGeneratedFile["status"] {
  if (status === "generated") {
    return "created";
  }

  if (status === "blocked" || status === "failed") {
    return "blocked";
  }

  return "planned";
}

function compareGenerationRenderedArtifacts(
  left: GenerationRenderedArtifact,
  right: GenerationRenderedArtifact,
): number {
  return left.targetPath.localeCompare(right.targetPath);
}
