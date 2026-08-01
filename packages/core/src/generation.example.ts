import type {
  GenerationArtifact,
  GenerationConflict,
  GenerationRenderedArtifact,
  GenerationRequest,
  GenerationResult,
  GenerationSummary,
} from "./generation.js";

export const exampleRenderedArtifact: GenerationRenderedArtifact = {
  targetPath: "AGENTS.md",
  content: "# Project Agents\n",
  kind: "text",
  summary: "Create project agent instructions.",
  sourcePath: "templates/AGENTS.md",
  templateId: "project-agents",
  templateVersion: "1.0.0",
};

export const exampleDryRunRequest: GenerationRequest = {
  targetRoot: "/workspace/example",
  artifacts: [exampleRenderedArtifact],
  writeMode: "dry_run",
  overwrite: false,
};

export const exampleGeneratedArtifact: GenerationArtifact = {
  targetPath: "AGENTS.md",
  status: "generated",
  kind: "text",
  summary: "Create project agent instructions.",
  sourcePath: "templates/AGENTS.md",
  templateId: "project-agents",
  templateVersion: "1.0.0",
};

export const exampleConflict: GenerationConflict = {
  code: "target_exists",
  targetPath: "AGENTS.md",
  message: "Target already exists and overwrite is disabled.",
  sourcePath: "templates/AGENTS.md",
  details: {
    existingPath: "/workspace/example/AGENTS.md",
  },
};

export const exampleSuccessfulSummary: GenerationSummary = {
  targetRoot: "/workspace/example",
  writeMode: "dry_run",
  overwrite: false,
  plannedArtifacts: 1,
  generatedArtifacts: 1,
  blockedArtifacts: 0,
  failedArtifacts: 0,
  conflictCount: 0,
  errorCount: 0,
};

export const exampleSuccessfulResult: GenerationResult = {
  ok: true,
  targetRoot: "/workspace/example",
  writeMode: "dry_run",
  overwrite: false,
  artifacts: [exampleGeneratedArtifact],
  conflicts: [],
  errors: [],
  summary: exampleSuccessfulSummary,
};

export const exampleFailedArtifact: GenerationArtifact = {
  targetPath: "AGENTS.md",
  status: "blocked",
  kind: "text",
  summary: "Create project agent instructions.",
  sourcePath: "templates/AGENTS.md",
  templateId: "project-agents",
  templateVersion: "1.0.0",
};

export const exampleFailedSummary: GenerationSummary = {
  targetRoot: "/workspace/example",
  writeMode: "dry_run",
  overwrite: false,
  plannedArtifacts: 1,
  generatedArtifacts: 0,
  blockedArtifacts: 1,
  failedArtifacts: 0,
  conflictCount: 1,
  errorCount: 0,
};

export const exampleFailedResult: GenerationResult = {
  ok: false,
  targetRoot: "/workspace/example",
  writeMode: "dry_run",
  overwrite: false,
  artifacts: [exampleFailedArtifact],
  conflicts: [exampleConflict],
  errors: [],
  summary: exampleFailedSummary,
};
