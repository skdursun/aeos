export const packageName = "@aeos/projects";

export type {
  AgentsMetadata,
  ContextMetadata,
  PackageMetadata,
  ProjectMetadata,
} from "./metadata-reader.js";

export {
  readAgentsMetadata,
  readContextMetadata,
  readPackageMetadata,
  readProjectMetadata,
} from "./metadata-reader.js";

export type {
  ProjectRootDetectionError,
  ProjectRootDetectionErrorCode,
  ProjectRootDetectionResult,
  ProjectRootMarker,
} from "./root-detector.js";

export {
  detectProjectRoot,
  findProjectRoot,
  hasProjectMarker,
} from "./root-detector.js";
