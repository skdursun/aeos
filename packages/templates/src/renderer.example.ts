import {
  renderTemplate,
  validateRenderResult,
} from "./renderer.js";

const successfulRender = renderTemplate("Hello {{name}}.", {
  name: "AEOS",
});
const successfulRenderValidation = validateRenderResult(successfulRender);

const missingVariableRender = renderTemplate("Hello {{name}}.", {});
const missingVariableRenderValidation =
  validateRenderResult(missingVariableRender);

const repeatedVariableRender = renderTemplate(
  "{{project}} uses {{project}} templates.",
  {
    project: "AEOS",
  },
);
const repeatedVariableRenderValidation =
  validateRenderResult(repeatedVariableRender);

const emptyVariableRender = renderTemplate("Owner: {{owner}}.", {
  owner: "",
});
const emptyVariableRenderValidation = validateRenderResult(emptyVariableRender);

export const rendererExamples = {
  successfulRender,
  successfulRenderValidation,
  missingVariableRender,
  missingVariableRenderValidation,
  repeatedVariableRender,
  repeatedVariableRenderValidation,
  emptyVariableRender,
  emptyVariableRenderValidation,
} as const;
