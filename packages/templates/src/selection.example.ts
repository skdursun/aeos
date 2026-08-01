import type { DiscoveredTemplate } from "./discovery.js";
import {
  selectTemplate,
  validateTemplateSelection,
} from "./selection.js";

const exampleTemplate: DiscoveredTemplate = {
  id: "aeos-basic",
  name: "AEOS Basic",
  path: "/templates/aeos-basic",
  metadataPath: "/templates/aeos-basic/template.json",
  metadata: {
    id: "aeos-basic",
    name: "AEOS Basic",
    description: "Minimal AEOS project template.",
    version: "1.0.0",
    variables: [
      {
        name: "projectName",
        description: "Project display name.",
        required: true,
      },
    ],
    requiredFiles: ["AGENTS.md", "PROJECT_CONTEXT.md"],
    optionalFiles: [],
  },
};

const exampleTemplates: readonly DiscoveredTemplate[] = [exampleTemplate];

export const successfulTemplateSelection = selectTemplate(exampleTemplates, {
  templateId: "aeos-basic",
});

export const templateNotFoundSelection = selectTemplate(exampleTemplates, {
  templateId: "missing-template",
});

export const successfulTemplateSelectionValidation =
  validateTemplateSelection(successfulTemplateSelection);

export const templateNotFoundSelectionValidation =
  validateTemplateSelection(templateNotFoundSelection);
