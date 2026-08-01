export const packageName = "@aeos/templates";

export type {
  DiscoveredTemplate,
  TemplateDiscoveryIssue,
  TemplateDiscoveryIssueCode,
  TemplateDiscoveryOptions,
  TemplateDiscoveryResult,
  TemplateLookupResult,
} from "./discovery.js";

export {
  discoverTemplates,
  findTemplateById,
  listTemplateIds,
  templateMetadataFileName,
} from "./discovery.js";

export type {
  TemplateSelectionIssue,
  TemplateSelectionIssueCode,
  TemplateSelectionRequest,
  TemplateSelectionResult,
  TemplateSelectionValidationResult,
} from "./selection.js";

export {
  selectTemplate,
  validateTemplateSelection,
} from "./selection.js";

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
