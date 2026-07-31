import type { MemoryEntry, MemorySearchResult } from "@aeos/core";
import {
  type MemorySearchIndex,
  addMemoryEntry,
  clearMemoryIndex,
  createMemorySearchIndex,
  getMemoryCount,
  removeMemoryEntry,
  searchMemoryEntries,
} from "./search-index.js";

export interface MemorySearchIndexExampleResult {
  readonly index: MemorySearchIndex;
  readonly titleResults: readonly MemorySearchResult[];
  readonly tagResults: readonly MemorySearchResult[];
  readonly typeResults: readonly MemorySearchResult[];
  readonly removed: boolean;
  readonly countAfterRemove: number;
  readonly countAfterClear: number;
}

export function createMemorySearchIndexExample(): MemorySearchIndexExampleResult {
  const index = createMemorySearchIndex();

  const decisionEntry: MemoryEntry = {
    id: "memory-search-decision",
    frontmatter: {
      type: "decision",
      title: "Use in-memory search index",
      date: "2026-07-31T00:00:00.000Z",
      sourceTask: "TASK-0060",
      status: "verified",
      tags: ["memory", "search"],
      scope: "project",
      confidence: "high",
    },
    summary: "The memory package exposes a dependency-free in-memory index.",
    sections: [
      {
        heading: "Decision",
        content: "Use a small in-memory index for title, tag, and type lookup.",
        order: 1,
      },
    ],
    redactionStatus: "not_required",
  };

  const patternEntry: MemoryEntry = {
    id: "memory-search-pattern",
    frontmatter: {
      type: "pattern",
      title: "Search examples stay dependency-free",
      date: "2026-07-31T00:00:00.000Z",
      sourceTask: "TASK-0060",
      status: "verified",
      tags: ["examples", "typecheck"],
      scope: "project",
      confidence: "high",
    },
    summary: "Typecheck examples should avoid test frameworks and runtime IO.",
    sections: [
      {
        heading: "Pattern",
        content: "Use exported functions directly in minimal TypeScript examples.",
        order: 1,
      },
    ],
    redactionStatus: "not_required",
  };

  addMemoryEntry(index, decisionEntry);
  addMemoryEntry(index, patternEntry);

  const titleResults = searchMemoryEntries(index, {
    query: "in-memory search index",
  });

  const tagResults = searchMemoryEntries(index, {
    query: "typecheck",
    filter: {
      tags: ["typecheck"],
    },
  });

  const typeResults = searchMemoryEntries(index, {
    query: "decision",
    filter: {
      types: ["decision"],
    },
  });

  const removed = removeMemoryEntry(index, patternEntry.id);
  const countAfterRemove = getMemoryCount(index);

  clearMemoryIndex(index);

  return {
    index,
    titleResults,
    tagResults,
    typeResults,
    removed,
    countAfterRemove,
    countAfterClear: getMemoryCount(index),
  };
}
