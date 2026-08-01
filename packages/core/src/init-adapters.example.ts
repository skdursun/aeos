import type {
  InitAdapterSet,
  ProjectInitAdapter,
  RenderInitAdapter,
  TemplateInitAdapter,
  ValidationInitAdapter,
  WriteInitAdapter,
} from "./init-adapters.js";
import {
  createFailedInitStageResult,
  createInitStageHandlers,
  createSuccessfulInitStageResult,
  createValidationInitStageResult,
} from "./init-adapters.js";

export const projectAdapterExample: ProjectInitAdapter = {
  runProjectDetection: () =>
    createSuccessfulInitStageResult("project_detection", [
      {
        path: "package.json",
        summary: "Detected a package manifest.",
        stage: "project_detection",
      },
    ]),
};

export const templateAdapterExample: TemplateInitAdapter = {
  runTemplateSelection: () =>
    createSuccessfulInitStageResult("template_selection", [
      {
        path: "templates/basic",
        summary: "Selected the basic template.",
        stage: "template_selection",
      },
    ]),
  runVariableResolution: (context) =>
    createSuccessfulInitStageResult(
      "variable_resolution",
      [],
      context.plan.variableNames.length === 0
        ? [
            {
              code: "init_no_variables",
              message: "No template variables were provided.",
            },
          ]
        : [],
    ),
};

export const renderAdapterExample: RenderInitAdapter = {
  runRendering: () =>
    createSuccessfulInitStageResult("rendering", [
      {
        path: "README.md",
        sourcePath: "templates/basic/README.md",
        summary: "Planned README rendering.",
        stage: "rendering",
      },
    ]),
};

export const writeAdapterExample: WriteInitAdapter = {
  runFileWriting: (context) =>
    createSuccessfulInitStageResult(
      "file_writing",
      context.generatedFiles.map((file) => ({
        path: file.path,
        sourcePath: file.sourcePath,
        summary: file.summary,
        stage: "file_writing",
      })),
    ),
};

export const validationAdapterExample: ValidationInitAdapter = {
  runValidation: () =>
    createValidationInitStageResult({
      status: "pass",
      checksRun: ["validation"],
      passed: ["validation"],
      warnings: [],
      failed: [],
      skipped: [],
    }),
};

export const initAdapterSetExample: InitAdapterSet = {
  project: projectAdapterExample,
  template: templateAdapterExample,
  render: renderAdapterExample,
  write: writeAdapterExample,
  validation: validationAdapterExample,
};

export const initStageHandlersExample =
  createInitStageHandlers(initAdapterSetExample);

export const successfulInitAdapterResultExample =
  createSuccessfulInitStageResult("rendering", [
    {
      path: "README.md",
      sourcePath: "templates/basic/README.md",
      summary: "Rendered README content.",
      stage: "rendering",
    },
  ]);

export const failedInitAdapterResultExample = createFailedInitStageResult(
  "validation",
  [
    {
      code: "init_validation_failed",
      message: "Required init validation did not pass.",
      path: "README.md",
      details: {
        check: "required_file",
      },
    },
  ],
);
