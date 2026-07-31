export const packageName = "@aeos/projects";

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
