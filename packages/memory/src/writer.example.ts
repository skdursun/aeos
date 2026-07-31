import type { MemoryEntry } from "@aeos/core";
import {
  buildMemoryFilePath,
  createMemoryWriteRequest,
  createMemoryWriteResult,
  prepareMemoryFileContent,
} from "./writer.js";
import type { MemoryWriteRequest, MemoryWriteTarget } from "./writer.js";
import { validateMemoryEntry } from "./validation.js";

const validEntry: MemoryEntry = {
  id: "memory-writer-example",
  frontmatter: {
    type: "decision",
    title: "Use deterministic memory writer examples",
    date: "2026-07-31T00:00:00.000Z",
    sourceTask: "TASK-0064",
    status: "verified",
    tags: ["memory", "writer", "typecheck"],
    scope: "project",
    confidence: "high",
  },
  summary: "Memory writer helpers can be composed without filesystem access.",
  sections: [
    {
      heading: "Decision",
      content: "Use deterministic examples to typecheck writer helper flow.",
      order: 1,
    },
  ],
  redactionStatus: "not_required",
};

const writeTarget: MemoryWriteTarget = {
  rootPath: "brain",
  collectionPath: "decisions",
};

export const validEntryValidation = validateMemoryEntry(validEntry);

export const writeRequestResult = createMemoryWriteRequest(
  validEntry,
  writeTarget,
);

export const deterministicMemoryPath = buildMemoryFilePath(
  writeTarget,
  validEntry,
);

export const preparedMarkdownContent = prepareMemoryFileContent(validEntry);

export const validMemoryWriteRequest: MemoryWriteRequest = {
  entry: validEntry,
  target: writeTarget,
  path: deterministicMemoryPath,
  validation: validEntryValidation,
};

export const successfulWriteResult = createMemoryWriteResult(
  validMemoryWriteRequest,
);

const invalidEntry: MemoryEntry = {
  ...validEntry,
  frontmatter: {
    ...validEntry.frontmatter,
    title: "",
  },
};

export const failedWriteRequestResult = createMemoryWriteRequest(
  invalidEntry,
  writeTarget,
);
