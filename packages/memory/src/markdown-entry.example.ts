import type { MemoryEntry, MemoryEntryId } from "@aeos/core";

import {
  buildMemoryMarkdownEntry,
  escapeYamlString,
  serializeMemoryBodySections,
  serializeMemoryFrontmatter,
} from "./markdown-entry.js";

const exampleCreatedAt = "2026-07-31T00:00:00.000Z" as NonNullable<
  MemoryEntry["createdAt"]
>;

const exampleEntry: MemoryEntry = {
  id: "memory-example-0001" as MemoryEntryId,
  frontmatter: {
    type: "decision",
    title: "Memory Markdown entry builder example",
    date: exampleCreatedAt,
    sourceTask: "TASK-0058",
    status: "draft",
    tags: ["memory", "markdown", "typecheck"],
  },
  summary: "TypeScript can build deterministic Markdown memory entries.",
  sections: [
    {
      heading: "Context",
      content: "The memory package exposes dependency-free Markdown helpers.",
      order: 1,
    },
    {
      heading: "Decision",
      content: "Use the builder and serializers directly from TypeScript.",
      order: 2,
    },
  ],
  redactionStatus: "not_required",
  createdAt: exampleCreatedAt,
};

export const exampleEscapedYamlString = escapeYamlString(
  "Memory: Markdown entry builder",
);

export const exampleFrontmatter = serializeMemoryFrontmatter(
  exampleEntry.frontmatter,
);

export const exampleBody = serializeMemoryBodySections(exampleEntry.sections);

export const exampleMarkdown = buildMemoryMarkdownEntry(exampleEntry);
