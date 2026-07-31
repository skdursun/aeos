import type { MemoryEntry, MemoryValidationResult } from "@aeos/core";
import { buildMemoryMarkdownEntry } from "./markdown-entry.js";
import {
  addMemoryEntry,
  createMemorySearchIndex,
  getMemoryCount,
  searchMemoryEntries,
} from "./search-index.js";
import {
  canBuildMarkdownEntry,
  canIndexMemoryEntry,
  validateMemoryEntry,
} from "./validation.js";

export interface MemoryValidationExampleResult {
  readonly validValidation: MemoryValidationResult;
  readonly validMarkdown: string | undefined;
  readonly validIndexCount: number;
  readonly validSearchResultCount: number;
  readonly invalidValidation: MemoryValidationResult;
  readonly invalidMarkdown: string | undefined;
  readonly invalidIndexCount: number;
  readonly invalidSearchResultCount: number;
}

export const validMemoryEntry: MemoryEntry = {
  id: "memory-validation-example",
  frontmatter: {
    type: "decision",
    title: "Validate memory before publishing",
    date: "2026-07-31T00:00:00.000Z",
    sourceTask: "TASK-0062",
    status: "verified",
    tags: ["memory", "validation"],
    scope: "project",
    confidence: "high",
  },
  summary: "Memory entries are validated before Markdown generation or indexing.",
  sections: [
    {
      heading: "Decision",
      content: "Only valid memory entries are serialized and indexed.",
      order: 1,
    },
  ],
  redactionStatus: "not_required",
};

const invalidFrontmatter = {
  type: "unsupported",
  title: "",
  date: "2026-07-31T00:00:00.000Z",
  sourceTask: "TASK-0062",
  status: "verified",
  tags: ["memory", 62],
  password: "must-not-be-indexed",
};

export const invalidMemoryEntry: MemoryEntry = {
  id: "invalid-memory-validation-example",
  frontmatter: invalidFrontmatter as MemoryEntry["frontmatter"],
  summary: "This invalid entry must not be serialized or indexed.",
  sections: [
    {
      heading: "Invalid",
      content: "This content is intentionally unreachable from Markdown output.",
      order: 1,
    },
  ],
  redactionStatus: "not_required",
};

export function runMemoryValidationExample(): MemoryValidationExampleResult {
  const validValidation = validateMemoryEntry(validMemoryEntry);
  const validMarkdown =
    validValidation.valid && canBuildMarkdownEntry(validMemoryEntry)
      ? buildMemoryMarkdownEntry(validMemoryEntry)
      : undefined;

  const validIndex = createMemorySearchIndex();

  if (canIndexMemoryEntry(validMemoryEntry)) {
    addMemoryEntry(validIndex, validMemoryEntry);
  }

  const validSearchResults = searchMemoryEntries(validIndex, {
    query: "validation",
    limit: 1,
  });

  const invalidValidation = validateMemoryEntry(invalidMemoryEntry);
  const invalidMarkdown =
    invalidValidation.valid && canBuildMarkdownEntry(invalidMemoryEntry)
      ? buildMemoryMarkdownEntry(invalidMemoryEntry)
      : undefined;

  const invalidIndex = createMemorySearchIndex();

  if (canIndexMemoryEntry(invalidMemoryEntry)) {
    addMemoryEntry(invalidIndex, invalidMemoryEntry);
  }

  const invalidSearchResults = searchMemoryEntries(invalidIndex, {
    query: "invalid",
    limit: 1,
  });

  return {
    validValidation,
    validMarkdown,
    validIndexCount: getMemoryCount(validIndex),
    validSearchResultCount: validSearchResults.length,
    invalidValidation,
    invalidMarkdown,
    invalidIndexCount: getMemoryCount(invalidIndex),
    invalidSearchResultCount: invalidSearchResults.length,
  };
}
