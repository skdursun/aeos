export const packageName = "@aeos/projects";

export type {
  ProjectConfidence,
  ProjectEvidence,
  ProjectEvidenceSource,
  ProjectFramework,
  ProjectFrameworkSignal,
  ProjectInfrastructure,
  ProjectInfrastructureSignal,
  ProjectIntelligenceCategory,
  ProjectIntelligenceIssue,
  ProjectIntelligenceIssueSeverity,
  ProjectIntelligenceProfile,
  ProjectIntelligenceSummary,
  ProjectLanguage,
  ProjectLanguageSignal,
  ProjectMonorepoKind,
  ProjectMonorepoSignal,
  ProjectPackageManager,
  ProjectPackageManagerSignal,
  ProjectRuntime,
  ProjectRuntimeSignal,
} from "./intelligence.js";

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
