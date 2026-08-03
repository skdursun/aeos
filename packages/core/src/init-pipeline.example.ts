import type { InitResult } from "./init.js";
import type { InitExecutionContext, InitStageResult } from "./init-engine.js";
import type { InitAdapterSet } from "./init-adapters.js";
import {
  createDefaultInitPipeline,
  createGenerationBackedInitPipelineHandlers,
  createInitPipelineHandlers,
  runInitPipeline,
} from "./init-pipeline.js";

const exampleRequest = {
  projectRoot: "/workspace/example",
  template: {
    templateId: "aeos-basic",
    templateRoot: "/templates/aeos-basic",
    templateVersion: "0.1.0",
  },
  variables: {
    name: "example-project",
    owner: "platform",
  },
  requestedAt: "2026-01-01T00:00:00.000Z",
} satisfies Parameters<typeof createDefaultInitPipeline>[0];

export const defaultPipelineExample = createDefaultInitPipeline(exampleRequest);

export const adapterBackedHandlersExample =
  createInitPipelineHandlers(createSuccessfulExampleAdapters());

export const generationBackedHandlersExample =
  createGenerationBackedInitPipelineHandlers(createSuccessfulExampleAdapters());

export async function successfulStageFlowExample(): Promise<{
  readonly ok: boolean;
  readonly status: InitResult["validation"]["status"];
  readonly completedStages: readonly string[];
  readonly generatedArtifacts: readonly GeneratedArtifactSummary[];
}> {
  const result = await runInitPipeline(
    exampleRequest,
    createSuccessfulExampleAdapters(),
  );

  return {
    ok: result.ok,
    status: result.validation.status,
    completedStages: result.validation.checksRun,
    generatedArtifacts: summarizeGeneratedArtifacts(result),
  };
}

export async function failedStageFlowExample(): Promise<{
  readonly ok: boolean;
  readonly status: InitResult["validation"]["status"];
  readonly errorCodes: readonly string[];
  readonly skippedStages: readonly string[];
}> {
  const result = await runInitPipeline(
    exampleRequest,
    createFailedExampleAdapters(),
  );

  return {
    ok: result.ok,
    status: result.validation.status,
    errorCodes: result.errors.map((issue) => issue.code),
    skippedStages: result.validation.skipped,
  };
}

export async function generationBackedFileWritingExample(): Promise<{
  readonly ok: boolean;
  readonly generatedArtifacts: readonly GeneratedArtifactSummary[];
}> {
  const result = await runInitPipeline(
    exampleRequest,
    createSuccessfulExampleAdapters(),
    {
      generation: {
        writeMode: "dry_run",
      },
    },
  );

  return {
    ok: result.ok,
    generatedArtifacts: summarizeGeneratedArtifacts(result),
  };
}

export async function generationBackedConflictExample(): Promise<{
  readonly ok: boolean;
  readonly errorCodes: readonly string[];
  readonly generatedArtifacts: readonly GeneratedArtifactSummary[];
}> {
  const result = await runInitPipeline(
    exampleRequest,
    createSuccessfulExampleAdapters(),
    {
      generation: {
        writeMode: "dry_run",
        existingTargets: {
          files: ["AGENTS.md"],
        },
      },
    },
  );

  return {
    ok: result.ok,
    errorCodes: result.errors.map((issue) => issue.code),
    generatedArtifacts: summarizeGeneratedArtifacts(result),
  };
}

export function handleInitResultExample(result: InitResult):
  | {
      readonly kind: "success";
      readonly generatedArtifacts: readonly GeneratedArtifactSummary[];
    }
  | {
      readonly kind: "failure";
      readonly status: InitResult["validation"]["status"];
      readonly errors: readonly string[];
    } {
  if (!result.ok) {
    return {
      kind: "failure",
      status: result.validation.status,
      errors: result.errors.map((issue) => issue.message),
    };
  }

  return {
    kind: "success",
    generatedArtifacts: summarizeGeneratedArtifacts(result),
  };
}

interface GeneratedArtifactSummary {
  readonly path: string;
  readonly status: InitResult["generatedFiles"][number]["status"];
  readonly summary: string;
  readonly sourcePath?: string;
}

function createSuccessfulExampleAdapters(): InitAdapterSet {
  return {
    project: {
      runProjectDetection: () =>
        createStageResult("project_detection", [
          {
            path: exampleRequest.projectRoot,
            summary: "Detected example project root.",
          },
        ]),
    },
    template: {
      runTemplateSelection: () =>
        createStageResult("template_selection", [
          {
            path: "/templates/aeos-basic",
            summary: "Selected aeos-basic template.",
          },
        ]),
      runVariableResolution: (context) =>
        createStageResult("variable_resolution", [
          {
            path: context.request.template.templateId,
            summary: `Resolved ${context.plan.variableNames.length.toString()} variables.`,
          },
        ]),
    },
    render: {
      runRendering: () =>
        createStageResult("rendering", [
          {
            path: "AGENTS.md",
            summary: "Planned AGENTS.md from selected template.",
            sourcePath: "AGENTS.md.template",
            renderedArtifact: {
              targetPath: "AGENTS.md",
              content: "# Agent Instructions\n",
              kind: "text",
              summary: "Create AGENTS.md from selected template.",
              sourcePath: "AGENTS.md.template",
              templateId: exampleRequest.template.templateId,
              templateVersion: exampleRequest.template.templateVersion,
            },
          },
          {
            path: "PROJECT_CONTEXT.md",
            summary: "Planned PROJECT_CONTEXT.md from selected template.",
            sourcePath: "PROJECT_CONTEXT.md.template",
            renderedArtifact: {
              targetPath: "PROJECT_CONTEXT.md",
              content: "# Project Context\n",
              kind: "text",
              summary: "Create PROJECT_CONTEXT.md from selected template.",
              sourcePath: "PROJECT_CONTEXT.md.template",
              templateId: exampleRequest.template.templateId,
              templateVersion: exampleRequest.template.templateVersion,
            },
          },
        ]),
    },
    write: {
      runFileWriting: (context) =>
        createStageResult("file_writing", [
          ...context.generatedFiles.map((file) => ({
            path: file.path,
            summary: `Created ${file.path}.`,
            sourcePath: file.sourcePath,
          })),
        ]),
    },
    validation: {
      runValidation: (context) =>
        createStageResult("validation", [
          {
            path: context.plan.targetRoot,
            summary: `Validated ${context.generatedFiles.length.toString()} generated files.`,
          },
        ]),
    },
  };
}

function createFailedExampleAdapters(): InitAdapterSet {
  return {
    project: {
      runProjectDetection: () => ({
        stage: "project_detection",
        status: "failure",
        issues: [
          {
            code: "project_root_missing",
            message: "Project root could not be detected.",
            path: exampleRequest.projectRoot,
          },
        ],
        artifacts: [],
      }),
    },
    validation: {
      runValidation: (context) => ({
        stage: "validation",
        status: "failure",
        issues: context.validation?.failed ?? [],
        artifacts: [
          {
            path: context.plan.targetRoot,
            summary: "Validation received the failed stage context.",
          },
        ],
      }),
    },
  };
}

function createStageResult(
  stage: InitStageResult["stage"],
  artifacts: InitStageResult["artifacts"],
): InitStageResult {
  return {
    stage,
    status: "success",
    issues: [],
    artifacts,
  };
}

function summarizeGeneratedArtifacts(
  result: InitResult,
): readonly GeneratedArtifactSummary[] {
  return result.generatedFiles.map((file) => ({
    path: file.path,
    status: file.status,
    summary: file.summary,
    sourcePath: file.sourcePath,
  }));
}

export function adapterBackedContextExample(
  context: InitExecutionContext,
): InitStageResult {
  return createStageResult("validation", [
    {
      path: context.plan.targetRoot,
      summary: `Context has ${context.completedStages.length.toString()} completed stages.`,
    },
  ]);
}
