import type { GenerationRequest, GenerationResult } from "./generation.js";
import {
  createGenerationPlan,
  detectGenerationConflicts,
  executeGenerationPlan,
  summarizeGenerationResult,
} from "./generation-engine.js";

export const dryRunGenerationRequest: GenerationRequest = {
  targetRoot: "/workspace/example-aeos-project",
  writeMode: "dry_run",
  overwrite: false,
  artifacts: [
    {
      targetPath: "AGENTS.md",
      content: "# Agent Instructions\n",
      kind: "text",
      summary: "Create agent instructions.",
      sourcePath: "templates/AGENTS.md",
      templateId: "agent-instructions",
      templateVersion: "1.0.0",
    },
    {
      targetPath: "PROJECT_CONTEXT.md",
      content: "# Project Context\n",
      kind: "text",
      summary: "Create project context.",
      sourcePath: "templates/PROJECT_CONTEXT.md",
      templateId: "project-context",
      templateVersion: "1.0.0",
    },
  ],
};

export const dryRunGenerationPlan = createGenerationPlan(dryRunGenerationRequest);

export const dryRunGenerationConflicts =
  detectGenerationConflicts(dryRunGenerationPlan);

export const successfulGenerationResult =
  executeGenerationPlan(dryRunGenerationRequest);

export const successfulGenerationSummary = summarizeGenerationResult({
  targetRoot: successfulGenerationResult.targetRoot,
  writeMode: successfulGenerationResult.writeMode,
  overwrite: successfulGenerationResult.overwrite,
  artifacts: successfulGenerationResult.artifacts,
  conflicts: successfulGenerationResult.conflicts,
  errors: successfulGenerationResult.errors,
});

export const safeModeGenerationRequest: GenerationRequest = {
  targetRoot: "/workspace/example-aeos-project",
  writeMode: "write",
  overwrite: false,
  artifacts: [
    {
      targetPath: "AGENTS.md",
      content: "# Agent Instructions\n",
      kind: "text",
      summary: "Create agent instructions without overwriting existing files.",
      sourcePath: "templates/AGENTS.md",
    },
  ],
};

export const safeModeGenerationResult = executeGenerationPlan(
  safeModeGenerationRequest,
  {
    existingTargets: {
      files: ["AGENTS.md"],
    },
  },
);

export const duplicateTargetGenerationRequest: GenerationRequest = {
  targetRoot: "/workspace/example-aeos-project",
  writeMode: "dry_run",
  overwrite: false,
  artifacts: [
    {
      targetPath: "PROJECT_CONTEXT.md",
      content: "# Project Context\n",
      kind: "text",
      summary: "Create project context.",
      sourcePath: "templates/PROJECT_CONTEXT.md",
    },
    {
      targetPath: "./PROJECT_CONTEXT.md",
      content: "# Updated Project Context\n",
      kind: "text",
      summary: "Create alternate project context.",
      sourcePath: "templates/PROJECT_CONTEXT.alt.md",
    },
  ],
};

export const duplicateTargetGenerationPlan = createGenerationPlan(
  duplicateTargetGenerationRequest,
);

export const duplicateTargetConflicts = detectGenerationConflicts(
  duplicateTargetGenerationPlan,
);

export const duplicateTargetGenerationResult = executeGenerationPlan(
  duplicateTargetGenerationRequest,
);

export const failedGenerationResult: GenerationResult = {
  ok: false,
  targetRoot: "/workspace/example-aeos-project",
  writeMode: "write",
  overwrite: false,
  artifacts: [
    {
      targetPath: "PROJECT_CONTEXT.md",
      status: "failed",
      kind: "text",
      summary: "Create project context.",
      sourcePath: "templates/PROJECT_CONTEXT.md",
    },
  ],
  conflicts: [],
  errors: [
    {
      code: "generation_write_failed",
      message: "Example write failure reported by a future writer.",
      path: "PROJECT_CONTEXT.md",
    },
  ],
  summary: summarizeGenerationResult({
    targetRoot: "/workspace/example-aeos-project",
    writeMode: "write",
    overwrite: false,
    artifacts: [
      {
        targetPath: "PROJECT_CONTEXT.md",
        status: "failed",
        kind: "text",
        summary: "Create project context.",
        sourcePath: "templates/PROJECT_CONTEXT.md",
      },
    ],
    conflicts: [],
    errors: [
      {
        code: "generation_write_failed",
        message: "Example write failure reported by a future writer.",
        path: "PROJECT_CONTEXT.md",
      },
    ],
  }),
};
