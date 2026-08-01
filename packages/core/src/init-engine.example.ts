import type {
  InitArtifactSummary,
  InitExecutionContext,
  InitExecutionPlan,
  InitPipelineResult,
  InitStage,
  InitStageResult,
} from "./init-engine.js";

export const orderedInitStages: readonly InitStage[] = [
  "project_detection",
  "template_selection",
  "variable_resolution",
  "rendering",
  "file_writing",
  "validation",
];

export const exampleExecutionPlan: InitExecutionPlan = {
  stages: orderedInitStages,
  targetRoot: "/workspace/example",
  templateId: "aeos.basic",
  variableNames: ["projectName"],
  requestedAt: "2026-01-01T00:00:00.000Z",
};

export const exampleExecutionContext: InitExecutionContext = {
  request: {
    projectRoot: "/workspace/example",
    template: {
      templateId: "aeos.basic",
      templateVersion: "0.1.0",
    },
    variables: {
      projectName: "example",
    },
    requestedAt: "2026-01-01T00:00:00.000Z",
  },
  plan: exampleExecutionPlan,
  completedStages: [],
  generatedFiles: [],
};

export const exampleArtifactSummary: InitArtifactSummary = {
  path: "AGENTS.md",
  summary: "Project operating instructions rendered from the selected template.",
  sourcePath: "templates/aeos.basic/AGENTS.md",
  stage: "rendering",
};

export const successfulStageResult: InitStageResult = {
  stage: "rendering",
  status: "success",
  issues: [],
  artifacts: [exampleArtifactSummary],
  startedAt: "2026-01-01T00:00:01.000Z",
  completedAt: "2026-01-01T00:00:02.000Z",
};

export const failedStageResult: InitStageResult = {
  stage: "validation",
  status: "failure",
  issues: [
    {
      code: "missing-required-file",
      message: "Expected project instruction file was not produced.",
      path: "AGENTS.md",
    },
  ],
  artifacts: [],
  startedAt: "2026-01-01T00:00:03.000Z",
  completedAt: "2026-01-01T00:00:04.000Z",
};

export const pipelineResult: InitPipelineResult = {
  ok: false,
  request: exampleExecutionContext.request,
  plan: exampleExecutionPlan,
  stages: [successfulStageResult, failedStageResult],
  generatedFiles: [
    {
      path: "AGENTS.md",
      status: "planned",
      summary: "Project operating instructions rendered from the selected template.",
      sourcePath: "templates/aeos.basic/AGENTS.md",
    },
  ],
  validation: {
    status: "fail",
    checksRun: ["required-files"],
    passed: [],
    warnings: [],
    failed: failedStageResult.issues,
    skipped: [],
  },
  errors: failedStageResult.issues,
};
