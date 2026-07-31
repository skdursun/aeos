import type {
  MemoryBodySection,
  MemoryEntry,
  MemoryFrontmatter,
} from "@aeos/core";
import { validateMemoryEntry } from "./validation.js";

type YamlScalar = string | number | boolean;
type YamlValue = YamlScalar | readonly string[] | null | undefined;

interface YamlField {
  readonly key: string;
  readonly value: YamlValue;
}

export function buildMemoryMarkdownEntry(input: MemoryEntry): string {
  const validation = validateMemoryEntry(input);

  if (!validation.valid) {
    throw new Error("Cannot build Markdown for an invalid memory entry.");
  }

  const frontmatter = serializeMemoryFrontmatter(input.frontmatter);
  const body = serializeMemoryBodySections(input.sections);

  return `---\n${frontmatter}\n---\n\n${body}\n`;
}

export function serializeMemoryFrontmatter(
  frontmatter: MemoryFrontmatter,
): string {
  const fields: readonly YamlField[] = [
    { key: "type", value: frontmatter.type },
    { key: "title", value: frontmatter.title },
    { key: "date", value: frontmatter.date },
    { key: "source_task", value: frontmatter.sourceTask },
    { key: "status", value: frontmatter.status },
    { key: "tags", value: frontmatter.tags },
    { key: "supersedes", value: frontmatter.supersedes },
    { key: "superseded_by", value: frontmatter.supersededBy },
    { key: "related", value: frontmatter.related },
    { key: "owner", value: frontmatter.owner },
    { key: "scope", value: frontmatter.scope },
    { key: "confidence", value: frontmatter.confidence },
    { key: "expires", value: frontmatter.expires },
  ];

  return fields
    .flatMap((field) => serializeYamlField(field))
    .join("\n");
}

export function serializeMemoryBodySections(
  sections: readonly MemoryBodySection[],
): string {
  return [...sections]
    .sort((left, right) => left.order - right.order)
    .map((section) => {
      const heading = section.heading.trim();
      const content = section.content.trim();

      return `## ${heading}\n\n${content}`;
    })
    .join("\n\n");
}

export function escapeYamlString(value: string): string {
  if (isPlainYamlString(value)) {
    return value;
  }

  return JSON.stringify(value);
}

function isPlainYamlString(value: string): boolean {
  if (value.trim() !== value || value.length === 0) {
    return false;
  }

  if (/^(true|false|null|~)$/i.test(value)) {
    return false;
  }

  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) {
    return false;
  }

  return /^[A-Za-z0-9_./@-][A-Za-z0-9_ ./@-]*$/.test(value);
}

function serializeYamlField(field: YamlField): readonly string[] {
  if (field.value === undefined || field.value === null) {
    return [];
  }

  if (Array.isArray(field.value)) {
    if (field.value.length === 0) {
      return [`${field.key}: []`];
    }

    return [
      `${field.key}:`,
      ...field.value.map((item) => `  - ${escapeYamlString(item)}`),
    ];
  }

  if (typeof field.value === "string") {
    return [`${field.key}: ${escapeYamlString(field.value)}`];
  }

  return [`${field.key}: ${String(field.value)}`];
}
