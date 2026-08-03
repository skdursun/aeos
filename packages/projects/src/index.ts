export const packageName = "@aeos/projects";

export type {
  ProjectIntelligenceScanCollectorResult,
} from "./intelligence-scan-collector.js";

export {
  collectProjectScanEntries,
  createDefaultProjectIntelligenceDetectorInput,
  normalizeProjectScanEntry,
} from "./intelligence-scan-collector.js";

export type {
  ProjectIntelligenceSignalCategory,
  ProjectIntelligenceSignalDefinition,
  ProjectIntelligenceSignalMatchKind,
  ProjectIntelligenceSignalSource,
  ProjectIntelligenceSignalTarget,
} from "./intelligence-signals.js";

export {
  getProjectIntelligenceSignalsByCategory,
  listProjectIntelligenceSignalDefinitions,
  PROJECT_INTELLIGENCE_SIGNAL_DEFINITIONS,
} from "./intelligence-signals.js";

export type {
  ProjectIntelligenceSignalMatch,
  ProjectIntelligenceSignalMatcherResult,
} from "./intelligence-signal-matcher.js";

export {
  createProjectEvidenceFromSignalMatch,
  matchProjectIntelligenceSignals,
  matchProjectScanEntrySignals,
} from "./intelligence-signal-matcher.js";

export type {
  ProjectEvidenceBySignal,
  ProjectIntelligenceProfileBuilderInput,
  ProjectIntelligenceProfileCounts,
} from "./intelligence-profile-builder.js";

export {
  buildProjectIntelligenceProfile,
  countProjectIntelligenceProfile,
  groupProjectEvidenceBySignal,
  summarizeProjectIntelligenceProfile,
} from "./intelligence-profile-builder.js";

export type {
  ProjectIntelligenceDetectorOrchestratorResult,
  ProjectIntelligenceDetectorOrchestratorSummary,
} from "./intelligence-detector-orchestrator.js";

export {
  createProjectIntelligenceDetectorResult,
  detectProjectIntelligence,
  summarizeProjectIntelligenceDetectorResult,
} from "./intelligence-detector-orchestrator.js";

export type {
  ProjectIntelligenceDetectorInput,
  ProjectIntelligenceDetectorIssue,
  ProjectIntelligenceDetectorLimits,
  ProjectIntelligenceDetectorMode,
  ProjectIntelligenceDetectorOptions,
  ProjectIntelligenceDetectorResult,
  ProjectIntelligenceDetectorScope,
  ProjectIntelligenceIgnoreRule,
  ProjectIntelligenceScanEntry,
  ProjectIntelligenceScanEntryKind,
} from "./intelligence-detector.js";

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
