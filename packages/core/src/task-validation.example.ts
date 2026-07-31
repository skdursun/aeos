import {
  findFileBoundaryConflicts,
  hasContextToLoad,
  hasRequiredTaskIdentity,
  hasStopCondition,
  validateAeosTask,
} from "./task-validation.js";
import type { AeosTask } from "./tasks.js";

export const validMinimalTask: AeosTask = {
  id: "TASK-EXAMPLE-VALID",
  title: "Validate task helpers",
  purpose: "Show task validation helpers compile with a minimal task.",
  status: "pending",
  executionMode: "verification",
  context: {
    load: [
      {
        path: "packages/core/src/task-validation.ts",
        required: true,
      },
    ],
    doNotLoad: [],
  },
  fileBoundary: {
    filesToModify: ["packages/core/src/task-validation.example.ts"],
    filesNotToTouch: ["packages/core/src/task-validation.ts"],
    allowGeneratedFiles: false,
    requireStopOnBoundaryConflict: true,
  },
  allowedOperations: ["read_context", "create_file", "run_verification"],
  forbiddenOperations: [
    "read_unlisted_context",
    "modify_unlisted_file",
    "install_dependency",
  ],
  steps: [
    {
      order: 1,
      instruction: "Create a dependency-free typecheck example.",
      required: true,
    },
  ],
  verification: [
    {
      command: "pnpm --filter @aeos/core check",
      level: "static_check",
      required: true,
      scope: ["packages/core"],
      expectedEvidence: ["TypeScript check passes."],
    },
  ],
  stopCondition: {
    description: "Stop after typecheck verification completes.",
    stopAfterCompletion: true,
  },
};

export const invalidConflictingTask: AeosTask = {
  ...validMinimalTask,
  id: "",
  title: "",
  purpose: "",
  context: {
    load: [],
    doNotLoad: [],
  },
  fileBoundary: {
    filesToModify: ["packages/core/src/task-validation.ts"],
    filesNotToTouch: ["packages/core/src/task-validation.ts"],
    allowGeneratedFiles: false,
    requireStopOnBoundaryConflict: true,
  },
  stopCondition: {
    description: "",
    stopAfterCompletion: true,
  },
};

export const validTaskValidation = validateAeosTask(validMinimalTask);
export const validTaskHasIdentity =
  hasRequiredTaskIdentity(validMinimalTask);
export const validTaskHasContext = hasContextToLoad(validMinimalTask);
export const validTaskHasStopCondition =
  hasStopCondition(validMinimalTask);

export const invalidTaskValidation =
  validateAeosTask(invalidConflictingTask);
export const invalidTaskFileBoundaryConflicts =
  findFileBoundaryConflicts(invalidConflictingTask);
