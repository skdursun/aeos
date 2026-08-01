import {
  createDefaultInitPipeline,
  createInitPipelineHandlers,
  runInitPipeline,
  type InitPipelineHandlers,
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

export const defaultPipelineExample =
  createDefaultInitPipeline(exampleRequest);

export const injectedHandlerExample: InitPipelineHandlers =
  createInitPipelineHandlers({
    project: {
      runProjectDetection: () => ({
        stage: "project_detection",
        status: "success",
        issues: [],
        artifacts: [],
      }),
    },
    template: {
      runTemplateSelection: () => ({
        stage: "template_selection",
        status: "success",
        issues: [],
        artifacts: [],
      }),
      runVariableResolution: () => ({
        stage: "variable_resolution",
        status: "success",
        issues: [],
        artifacts: [],
      }),
    },
    render: {
      runRendering: () => ({
        stage: "rendering",
        status: "success",
        issues: [],
        artifacts: [
          {
            path: "AGENTS.md",
            summary: "Plan AGENTS.md from selected template.",
            sourcePath: "AGENTS.md.template",
          },
        ],
      }),
    },
    write: {
      runFileWriting: () => ({
        stage: "file_writing",
        status: "success",
        issues: [],
        artifacts: [
          {
            path: "AGENTS.md",
            summary: "Create AGENTS.md from rendered template.",
            sourcePath: "AGENTS.md.template",
          },
        ],
      }),
    },
    validation: {
      runValidation: () => ({
        stage: "validation",
        status: "success",
        issues: [],
        artifacts: [],
      }),
    },
  });

export async function successfulPipelineExecutionExample() {
  const result = await runInitPipeline(exampleRequest, {
    project: {
      runProjectDetection: () => ({
        stage: "project_detection",
        status: "success",
        issues: [],
        artifacts: [],
      }),
    },
    template: {
      runTemplateSelection: () => ({
        stage: "template_selection",
        status: "success",
        issues: [],
        artifacts: [],
      }),
      runVariableResolution: () => ({
        stage: "variable_resolution",
        status: "success",
        issues: [],
        artifacts: [],
      }),
    },
    render: {
      runRendering: () => ({
        stage: "rendering",
        status: "success",
        issues: [],
        artifacts: [
          {
            path: "AGENTS.md",
            summary: "Plan AGENTS.md from selected template.",
            sourcePath: "AGENTS.md.template",
          },
        ],
      }),
    },
    write: {
      runFileWriting: () => ({
        stage: "file_writing",
        status: "success",
        issues: [],
        artifacts: [
          {
            path: "AGENTS.md",
            summary: "Create AGENTS.md from rendered template.",
            sourcePath: "AGENTS.md.template",
          },
        ],
      }),
    },
    validation: {
      runValidation: () => ({
        stage: "validation",
        status: "success",
        issues: [],
        artifacts: [],
      }),
    },
  });

  return {
    ok: result.ok,
    status: result.validation.status,
    variablesUsed: result.variablesUsed,
  };
}

export async function failedStageExecutionExample() {
  const result = await runInitPipeline(exampleRequest, {
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
        status: context.validation?.failed.length === 0 ? "success" : "failure",
        issues: context.validation?.failed ?? [],
        artifacts: [],
      }),
    },
  });

  return {
    ok: result.ok,
    errors: result.errors,
    skippedStages: result.validation.skipped,
  };
}

export async function initResultHandlingExample() {
  const result = await runInitPipeline(exampleRequest);

  if (!result.ok) {
    return {
      status: result.validation.status,
      errors: result.errors.map((issue) => issue.code),
    };
  }

  return {
    status: result.validation.status,
    generatedPaths: result.generatedFiles.map((file) => file.path),
  };
}

export async function artifactAggregationExample() {
  const result = await runInitPipeline(exampleRequest, {
    render: {
      runRendering: () => ({
        stage: "rendering",
        status: "success",
        issues: [],
        artifacts: [
          {
            path: "README.md",
            summary: "Plan README.md.",
            sourcePath: "README.md.template",
          },
        ],
      }),
    },
    write: {
      runFileWriting: () => ({
        stage: "file_writing",
        status: "success",
        issues: [],
        artifacts: [
          {
            path: "README.md",
            summary: "Create README.md.",
            sourcePath: "README.md.template",
          },
          {
            path: "AGENTS.md",
            summary: "Create AGENTS.md.",
            sourcePath: "AGENTS.md.template",
          },
        ],
      }),
    },
  });

  return result.generatedFiles.map((file) => ({
    path: file.path,
    status: file.status,
    sourcePath: file.sourcePath,
  }));
}
