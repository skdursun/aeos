export const packageName = "@aeos/templates";

export type {
  TemplateMetadata,
  TemplateMetadataReadError,
  TemplateMetadataReadErrorCode,
  TemplateMetadataReadResult,
  TemplateMetadataShapeValidationResult,
  TemplateVariableMetadata,
} from "./metadata-reader.js";

export {
  readTemplateMetadata,
  validateTemplateMetadataShape,
} from "./metadata-reader.js";
