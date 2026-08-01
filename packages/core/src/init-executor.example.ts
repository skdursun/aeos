import {
  createInitPipeline,
  createInitResult,
  defaultInitPipelineStages,
  executeInitPipeline,
  executeInitStage,
  type InitPipelineStageHandlers,
} from "./init-executor.js";

type ExampleInitRequest = Parameters<typeof createInitPipeline>[0];
type ExampleInitPlan = ReturnType<typeof createInitPipeline>;
type ExampleExecutionContext = Parameters<typeof executeInitStage>[0];

const exampleRequest: ExampleInitRequest = {
  projectRoot: "/workspace/example",
  template: {
    templateId: "minimal-typescript",
  },
  variables: {
    name: "example",
    runtime: "node",
  },
  requestedAt: "2026-08-01T00:00:00.000Z",
};

export function createPipelineExample(): ExampleInitPlan {
  return createInitPipeline(exampleRequest, {
    requestedAt: "2026-08-01T00:00:00.000Z",
  });
}

export function orderedStagesExample(): readonly string[] {
  return defaultInitPipelineStages;
}

export async function successfulStageExecutionExample() {
  const plan = createPipelineExample();
  const context: ExampleExecutionContext = {
    request: exampleRequest,
    plan,
    completedStages: [],
    generatedFiles: [],
  };

  return executeInitStage(context, "project_detection", () => ({
    stage: "project_detection",
    status: "success",
    issues: [],
    artifacts: [
      {
        path: ".",
        summary: "Project root detected.",
      },
    ],
  }));
}

export async function failedStageExecutionExample() {
  const plan = createPipelineExample();
  const context: ExampleExecutionContext = {
    request: exampleRequest,
    plan,
    completedStages: [],
    generatedFiles: [],
  };

  return executeInitStage(context, "template_selection", () => ({
    stage: "template_selection",
    status: "failure",
    issues: [
      {
        code: "example_template_missing",
        message: "Template is not available in this example.",
      },
    ],
    artifacts: [],
  }));
}

export async function pipelineResultHandlingExample() {
  const handlers: InitPipelineStageHandlers = {
    project_detection: () => ({
      stage: "project_detection",
      status: "success",
      issues: [],
      artifacts: [],
    }),
    template_selection: () => ({
      stage: "template_selection",
      status: "success",
      issues: [],
      artifacts: [],
    }),
    variable_resolution: (context) => ({
      stage: "variable_resolution",
      status: context.plan.variableNames.includes("name") ? "success" : "failure",
      issues: context.plan.variableNames.includes("name")
        ? []
        : [
            {
              code: "example_missing_name",
              message: "The name variable is required.",
            },
          ],
      artifacts: [],
    }),
    validation: () => ({
      stage: "validation",
      status: "success",
      issues: [],
      artifacts: [],
    }),
  };

  const pipelineResult = await executeInitPipeline(exampleRequest, handlers, {
    stages: [
      "project_detection",
      "template_selection",
      "variable_resolution",
      "validation",
    ],
  });

  return createInitResult(pipelineResult);
}

export async function artifactAggregationExample() {
  const handlers: InitPipelineStageHandlers = {
    rendering: () => ({
      stage: "rendering",
      status: "success",
      issues: [],
      artifacts: [
        {
          path: "AGENTS.md",
          summary: "Planned agent instructions.",
          sourcePath: "templates/minimal-typescript/AGENTS.md",
        },
      ],
    }),
    file_writing: () => ({
      stage: "file_writing",
      status: "success",
      issues: [],
      artifacts: [
        {
          path: "AGENTS.md",
          summary: "Created agent instructions.",
          sourcePath: "templates/minimal-typescript/AGENTS.md",
        },
      ],
    }),
    validation: () => ({
      stage: "validation",
      status: "success",
      issues: [],
      artifacts: [],
    }),
  };

  const result = await executeInitPipeline(exampleRequest, handlers, {
    stages: ["rendering", "file_writing", "validation"],
  });

  return result.generatedFiles;
}
