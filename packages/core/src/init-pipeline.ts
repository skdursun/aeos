import type {
  GenerationArtifact,
  GenerationRenderedArtifact,
  GenerationResult,
  GenerationWriteMode,
} from "./generation.js";
import type {
  GenerationAdapterIssue,
  GenerationFileSystemAdapter,
  GenerationFileWriteResult,
} from "./generation-adapters.js";
import type {
  GenerationExistingTargetInfo,
  GenerationTargetInspectionFailure,
} from "./generation-engine.js";
import { executeGenerationPlan, summarizeGenerationResult } from "./generation-engine.js";
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
  readonly fileSystemAdapter?: GenerationFileSystemAdapter;
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

async function runGenerationBackedFileWriting(
  context: InitExecutionContext,
  options: InitGenerationPipelineOptions,
  state: InitGenerationPipelineState,
): Promise<InitStageResult> {
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

  const existingTargets =
    options.fileSystemAdapter === undefined
      ? options.existingTargets
      : mergeExistingTargetInfo(
          options.existingTargets,
          await inspectGenerationTargets(
            options.fileSystemAdapter,
            converted.artifacts,
          ),
        );

  const generationResult = executeGenerationPlan(
    {
      targetRoot: context.plan.targetRoot,
      artifacts: converted.artifacts,
      writeMode: getGenerationWriteMode(options),
      overwrite: false,
    },
    {
      existingTargets,
    },
  );

  state.generationResult = generationResult;

  if (
    options.fileSystemAdapter !== undefined &&
    generationResult.ok &&
    generationResult.writeMode === "write"
  ) {
    state.generationResult = await writeGenerationArtifacts(
      options.fileSystemAdapter,
      generationResult,
      converted.artifacts,
    );
  }

  const activeGenerationResult = state.generationResult;
  const artifacts = activeGenerationResult.artifacts.map((artifact) =>
    createGenerationArtifactSummary(artifact),
  );

  return activeGenerationResult.ok
    ? createSuccessfulInitStageResult(
        "file_writing",
        artifacts,
        activeGenerationResult.errors,
      )
    : createFailedInitStageResult(
        "file_writing",
        activeGenerationResult.errors,
        artifacts,
      );
}

function getGenerationWriteMode(
  options: InitGenerationPipelineOptions,
): GenerationWriteMode {
  return options.fileSystemAdapter === undefined
    ? "dry_run"
    : options.writeMode ?? "dry_run";
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

async function inspectGenerationTargets(
  adapter: GenerationFileSystemAdapter,
  artifacts: readonly GenerationRenderedArtifact[],
): Promise<GenerationExistingTargetInfo> {
  const files = new Set<string>();
  const directories = new Set<string>();
  const inspectionFailures: GenerationTargetInspectionFailure[] = [];

  for (const artifact of artifacts) {
    const inspectedPaths = [
      artifact.targetPath,
      ...collectParentPaths(artifact.targetPath),
    ];

    for (const targetPath of inspectedPaths) {
      const result = await adapter.getPathInfo(targetPath);
      const pathInfo = result.pathInfo;

      if (!result.ok || pathInfo.kind === "unknown") {
        inspectionFailures.push({
          targetPath: artifact.targetPath,
          message: issueMessages(result.issues),
        });
        continue;
      }

      if (pathInfo.kind === "file") {
        files.add(pathInfo.path);
      }

      if (pathInfo.kind === "directory") {
        directories.add(pathInfo.path);
      }
    }
  }

  return {
    files: [...files].sort(compareStrings),
    directories: [...directories].sort(compareStrings),
    inspectionFailures: inspectionFailures.sort((left, right) =>
      compareStrings(left.targetPath, right.targetPath),
    ),
  };
}

function collectParentPaths(targetPath: string): readonly string[] {
  const segments = targetPath
    .replaceAll("\\", "/")
    .split("/")
    .filter((segment) => segment.length > 0 && segment !== ".");
  const parentPaths: string[] = [];

  for (let index = 1; index < segments.length; index += 1) {
    parentPaths.push(segments.slice(0, index).join("/"));
  }

  return parentPaths;
}

function mergeExistingTargetInfo(
  left: GenerationExistingTargetInfo | undefined,
  right: GenerationExistingTargetInfo,
): GenerationExistingTargetInfo {
  return {
    files: mergeSortedStrings(left?.files, right.files),
    directories: mergeSortedStrings(left?.directories, right.directories),
    inspectionFailures: [
      ...(left?.inspectionFailures ?? []),
      ...(right.inspectionFailures ?? []),
    ].sort((leftFailure, rightFailure) =>
      compareStrings(leftFailure.targetPath, rightFailure.targetPath),
    ),
  };
}

function mergeSortedStrings(
  left: readonly string[] = [],
  right: readonly string[] = [],
): readonly string[] {
  return [...new Set([...left, ...right])].sort(compareStrings);
}

async function writeGenerationArtifacts(
  adapter: GenerationFileSystemAdapter,
  generationResult: GenerationResult,
  renderedArtifacts: readonly GenerationRenderedArtifact[],
): Promise<GenerationResult> {
  const renderedByTarget = new Map(
    renderedArtifacts.map((artifact) => [artifact.targetPath, artifact]),
  );
  const writtenArtifacts: GenerationArtifact[] = [];
  const writeIssues: InitIssue[] = [];

  for (const artifact of generationResult.artifacts) {
    const renderedArtifact = renderedByTarget.get(artifact.targetPath);

    if (renderedArtifact === undefined) {
      writtenArtifacts.push({
        ...artifact,
        status: "failed",
      });
      writeIssues.push({
        code: "init_generation_rendered_artifact_missing",
        message: "Generation artifact cannot be written without rendered content.",
        path: artifact.targetPath,
      });
      continue;
    }

    const writeResult = await adapter.writeFile({
      path: artifact.targetPath,
      content: renderedArtifact.content,
      dryRun: false,
      overwrite: false,
      parentDirectory: getParentPath(artifact.targetPath),
    });

    writtenArtifacts.push({
      ...artifact,
      targetPath: writeResult.path,
      status: mapWriteStatus(writeResult),
    });
    writeIssues.push(...writeResult.issues.map(adapterIssueToInitIssue));
  }

  const errors = [
    ...generationResult.errors,
    ...writeIssues.filter((issue) => issue.details?.severity !== "warning"),
  ];
  const artifacts = writtenArtifacts.sort((left, right) =>
    compareStrings(left.targetPath, right.targetPath),
  );

  return {
    ...generationResult,
    ok: errors.length === 0 && artifacts.every((artifact) => artifact.status === "generated"),
    artifacts,
    errors,
    summary: summarizeGenerationResult({
      targetRoot: generationResult.targetRoot,
      writeMode: generationResult.writeMode,
      overwrite: generationResult.overwrite,
      artifacts,
      conflicts: generationResult.conflicts,
      errors,
    }),
  };
}

function getParentPath(targetPath: string): string | undefined {
  const segments = targetPath
    .replaceAll("\\", "/")
    .split("/")
    .filter((segment) => segment.length > 0 && segment !== ".");

  return segments.length <= 1 ? undefined : segments.slice(0, -1).join("/");
}

function mapWriteStatus(
  result: GenerationFileWriteResult,
): GenerationArtifact["status"] {
  if (result.status === "written") {
    return "generated";
  }

  if (result.status === "failed") {
    return "failed";
  }

  if (result.status === "blocked") {
    return "blocked";
  }

  return "planned";
}

function adapterIssueToInitIssue(issue: GenerationAdapterIssue): InitIssue {
  return {
    code: `generation_${issue.code}`,
    message: issue.message,
    path: issue.path,
    details: {
      operation: issue.operation,
      severity: issue.severity,
      ...(issue.details ?? {}),
    },
  };
}

function issueMessages(issues: readonly GenerationAdapterIssue[]): string {
  return issues.length === 0
    ? "Target path could not be inspected safely."
    : issues.map((issue) => issue.message).join(" ");
}

function compareStrings(left: string, right: string): number {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}
