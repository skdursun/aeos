import type {
  InitGeneratedFile,
  InitRenderInput,
  InitRequest,
  InitResult,
  InitTemplateSelection,
  InitValidationSummary,
  InitVariableMap,
} from "./init.js";

export const exampleInitTemplateSelection: InitTemplateSelection = {
  templateId: "aeos.template.basic",
  templateRoot: "templates/basic",
  templateVersion: "0.1.0",
};

export const exampleInitVariables: InitVariableMap = {
  projectName: "customer-support-agent",
  packageName: "@example/customer-support-agent",
  owner: "platform-team",
};

export const exampleInitRequest: InitRequest = {
  projectRoot: "/workspace/customer-support-agent",
  template: exampleInitTemplateSelection,
  variables: exampleInitVariables,
  requestedAt: "2026-08-01T00:00:00.000Z",
};

export const exampleInitRenderInput: InitRenderInput = {
  projectRoot: exampleInitRequest.projectRoot,
  template: exampleInitRequest.template,
  variables: exampleInitRequest.variables,
  targetPaths: ["package.json", "src/index.ts", "README.md"],
};

export const exampleInitGeneratedFiles: readonly InitGeneratedFile[] = [
  {
    path: "package.json",
    status: "created",
    summary: "Created package manifest from selected template.",
    sourcePath: "package.json.template",
  },
  {
    path: "src/index.ts",
    status: "created",
    summary: "Created project entry point.",
    sourcePath: "src/index.ts.template",
  },
  {
    path: "README.md",
    status: "planned",
    summary: "README generation was planned for a later write step.",
    sourcePath: "README.md.template",
  },
];

export const exampleInitValidationSummary: InitValidationSummary = {
  status: "pass",
  checksRun: ["template-selected", "variables-resolved", "target-paths-planned"],
  passed: ["template-selected", "variables-resolved", "target-paths-planned"],
  warnings: [],
  failed: [],
  skipped: [],
};

export const exampleSuccessfulInitResult: InitResult = {
  ok: true,
  projectRoot: exampleInitRequest.projectRoot,
  template: exampleInitRequest.template,
  variablesUsed: ["projectName", "packageName", "owner"],
  renderInput: exampleInitRenderInput,
  generatedFiles: exampleInitGeneratedFiles,
  validation: exampleInitValidationSummary,
  errors: [],
};

export const exampleFailedInitResult: InitResult = {
  ok: false,
  projectRoot: "/workspace/customer-support-agent",
  template: {
    templateId: "aeos.template.missing",
  },
  variablesUsed: ["projectName"],
  generatedFiles: [
    {
      path: "package.json",
      status: "blocked",
      summary: "Template selection failed before file generation.",
    },
  ],
  validation: {
    status: "fail",
    checksRun: ["template-selected"],
    passed: [],
    warnings: [],
    failed: [
      {
        code: "INIT_TEMPLATE_NOT_FOUND",
        message: "Requested template could not be selected.",
        details: {
          templateId: "aeos.template.missing",
        },
      },
    ],
    skipped: ["variables-resolved", "target-paths-planned"],
  },
  errors: [
    {
      code: "INIT_TEMPLATE_NOT_FOUND",
      message: "Requested template could not be selected.",
      details: {
        templateId: "aeos.template.missing",
      },
    },
  ],
};
