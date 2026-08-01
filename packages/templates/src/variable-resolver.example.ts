import {
  findMissingVariables,
  resolveTemplateVariables,
} from "./variable-resolver.js";

export const successfulVariableReplacementExample = resolveTemplateVariables(
  "Project {{projectName}} uses {{templateName}}.",
  {
    projectName: "AEOS",
    templateName: "typescript-package",
  },
);

export const successfulVariableReplacementExpected = {
  ok: true,
  content: "Project AEOS uses typescript-package.",
  missingVariables: [],
} as const;

export const successfulVariableReplacementMatchesExpectation =
  successfulVariableReplacementExample.ok ===
    successfulVariableReplacementExpected.ok &&
  successfulVariableReplacementExample.content ===
    successfulVariableReplacementExpected.content &&
  successfulVariableReplacementExample.missingVariables.length ===
    successfulVariableReplacementExpected.missingVariables.length;

export const repeatedVariableReplacementExample = resolveTemplateVariables(
  "{{name}} creates {{name}} artifacts.",
  {
    name: "AEOS",
  },
);

export const repeatedVariableReplacementExpected = {
  ok: true,
  content: "AEOS creates AEOS artifacts.",
  missingVariables: [],
} as const;

export const repeatedVariableReplacementMatchesExpectation =
  repeatedVariableReplacementExample.ok ===
    repeatedVariableReplacementExpected.ok &&
  repeatedVariableReplacementExample.content ===
    repeatedVariableReplacementExpected.content &&
  repeatedVariableReplacementExample.missingVariables.length ===
    repeatedVariableReplacementExpected.missingVariables.length;

export const missingVariableDetectionExample = findMissingVariables(
  "Render {{projectName}} with {{missingName}} and {{missingName}}.",
  {
    projectName: "AEOS",
  },
);

export const missingVariableDetectionExpected = ["missingName"] as const;

export const missingVariableDetectionMatchesExpectation =
  missingVariableDetectionExample.length ===
    missingVariableDetectionExpected.length &&
  missingVariableDetectionExample[0] === missingVariableDetectionExpected[0];

export const emptyVariableHandlingExample = resolveTemplateVariables(
  "Description: {{description}}",
  {
    description: "",
  },
);

export const emptyVariableHandlingExpected = {
  ok: true,
  content: "Description: ",
  missingVariables: [],
} as const;

export const emptyVariableHandlingMatchesExpectation =
  emptyVariableHandlingExample.ok === emptyVariableHandlingExpected.ok &&
  emptyVariableHandlingExample.content === emptyVariableHandlingExpected.content &&
  emptyVariableHandlingExample.missingVariables.length ===
    emptyVariableHandlingExpected.missingVariables.length;
