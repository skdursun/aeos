import {
  readTemplateMetadata,
  validateTemplateMetadataShape,
} from "./metadata-reader.js";

import type {
  TemplateMetadata,
  TemplateMetadataReadResult,
  TemplateMetadataShapeValidationResult,
} from "./metadata-reader.js";

const validTemplateMetadataInput = {
  id: "starter-node",
  name: "Starter Node",
  description: "A minimal Node.js starter template.",
  version: "1.0.0",
  variables: [
    {
      name: "projectName",
      description: "Generated project name.",
      required: true,
    },
    {
      name: "packageManager",
      required: false,
      defaultValue: "pnpm",
    },
  ],
  requiredFiles: ["package.json", "src/index.ts"],
  optionalFiles: ["README.md"],
} satisfies TemplateMetadata;

const invalidTemplateMetadataInput: unknown = {
  id: "broken-template",
  name: "Broken Template",
  description: "A malformed template metadata example.",
  version: "1.0.0",
  variables: "projectName",
  requiredFiles: ["package.json"],
  optionalFiles: [],
};

export function validateKnownTemplateMetadata(): TemplateMetadata {
  const result = validateTemplateMetadataShape(validTemplateMetadataInput);

  if (!result.ok) {
    throw new Error(result.error?.message ?? "Expected valid template metadata.");
  }

  return result.metadata;
}

export function validateUnknownTemplateMetadata():
  | TemplateMetadata
  | TemplateMetadataShapeValidationResult["error"] {
  const result = validateTemplateMetadataShape(invalidTemplateMetadataInput);

  if (!result.ok) {
    return result.error;
  }

  return result.metadata;
}

export function readOptionalTemplateMetadata(
  metadataPath: string,
): TemplateMetadata | undefined {
  const result = readTemplateMetadata(metadataPath);

  if (result.ok) {
    return result.metadata;
  }

  if (result.error.code === "template_metadata_missing") {
    return undefined;
  }

  return result.metadata;
}

export function summarizeTemplateMetadataRead(
  result: TemplateMetadataReadResult,
): string {
  if (result.ok) {
    return result.metadata.id;
  }

  return result.error.code;
}
