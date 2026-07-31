// @ts-expect-error Node runtime APIs are intentionally isolated to this file.
import { readdir, readFile } from "node:fs/promises";
// @ts-expect-error Node runtime APIs are intentionally isolated to this file.
import { basename, join } from "node:path";
import type {
  MemoryBodySection,
  MemoryEntry,
  MemoryEntryStatus,
  MemoryFrontmatter,
  MemoryType,
} from "@aeos/core";
import { validateMemoryEntry } from "./validation.js";

const MEMORY_TYPES = [
  "bug",
  "decision",
  "pattern",
  "incident",
  "lesson",
  "prompt",
  "benchmark",
  "research",
  "postmortem",
] as const satisfies readonly MemoryType[];

const MEMORY_ENTRY_STATUSES = [
  "draft",
  "verified",
  "superseded",
  "archived",
] as const satisfies readonly MemoryEntryStatus[];

type FrontmatterValue = string | readonly string[];
type DirectoryEntry = {
  readonly name: string;
  readonly isFile: () => boolean;
};

export async function loadMemoryEntriesFromStorage(
  rootPath: string,
): Promise<readonly MemoryEntry[]> {
  const entries: MemoryEntry[] = [];

  for (const type of MEMORY_TYPES) {
    const directoryPath = join(rootPath, type);
    const fileNames = await readMarkdownFileNames(directoryPath);

    for (const fileName of fileNames) {
      const filePath = join(directoryPath, fileName);
      const content = await readMemoryFileContent(filePath);

      if (content === undefined) {
        continue;
      }

      const entry = parseMemoryMarkdownEntry(content, filePath);

      if (entry !== undefined && entry.frontmatter.type === type) {
        entries.push(entry);
      }
    }
  }

  return entries.sort((left, right) =>
    (left.path ?? left.id).localeCompare(right.path ?? right.id, "en-US"),
  );
}

export function parseMemoryMarkdownEntry(
  content: string,
  path: string,
): MemoryEntry | undefined {
  const parsed = parseFrontmatter(content);

  if (parsed === undefined) {
    return undefined;
  }

  const frontmatter = buildFrontmatter(parsed.frontmatter);

  if (frontmatter === undefined) {
    return undefined;
  }

  const body = parseMemoryBody(parsed.body, frontmatter.title);
  const entry: MemoryEntry = {
    id: basename(path, ".md"),
    path,
    frontmatter,
    summary: body.summary,
    sections: body.sections,
    redactionStatus: "not_required",
    createdAt: frontmatter.date,
    updatedAt: frontmatter.date,
  };

  return validateMemoryEntry(entry).valid ? entry : undefined;
}

async function readMarkdownFileNames(
  directoryPath: string,
): Promise<readonly string[]> {
  try {
    const entries = (await readdir(directoryPath, {
      withFileTypes: true,
    })) as readonly DirectoryEntry[];

    return entries
      .filter((entry: DirectoryEntry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry: DirectoryEntry) => entry.name)
      .sort((left: string, right: string) => left.localeCompare(right, "en-US"));
  } catch {
    return [];
  }
}

async function readMemoryFileContent(
  filePath: string,
): Promise<string | undefined> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return undefined;
  }
}

function parseFrontmatter(
  content: string,
): { readonly frontmatter: ReadonlyMap<string, FrontmatterValue>; readonly body: string } | undefined {
  const lines = content.split(/\r?\n/);

  if (lines[0] !== "---") {
    return undefined;
  }

  const closingIndex = lines.indexOf("---", 1);

  if (closingIndex === -1) {
    return undefined;
  }

  return {
    frontmatter: parseYamlFields(lines.slice(1, closingIndex)),
    body: lines.slice(closingIndex + 1).join("\n"),
  };
}

function parseYamlFields(
  lines: readonly string[],
): ReadonlyMap<string, FrontmatterValue> {
  const fields = new Map<string, FrontmatterValue>();
  let activeArrayKey: string | undefined;

  for (const line of lines) {
    if (activeArrayKey !== undefined && line.startsWith("  - ")) {
      fields.set(activeArrayKey, [
        ...asStringArray(fields.get(activeArrayKey)),
        parseYamlScalar(line.slice(4)),
      ]);
      continue;
    }

    activeArrayKey = undefined;
    const separatorIndex = line.indexOf(":");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();

    if (rawValue.length === 0) {
      fields.set(key, []);
      activeArrayKey = key;
      continue;
    }

    if (rawValue === "[]") {
      fields.set(key, []);
      continue;
    }

    fields.set(key, parseYamlScalar(rawValue));
  }

  return fields;
}

function buildFrontmatter(
  fields: ReadonlyMap<string, FrontmatterValue>,
): MemoryFrontmatter | undefined {
  const type = fields.get("type");
  const title = fields.get("title");
  const date = fields.get("date");
  const sourceTask = fields.get("source_task");
  const status = fields.get("status");
  const tags = fields.get("tags");

  if (
    !isMemoryType(type) ||
    typeof title !== "string" ||
    typeof date !== "string" ||
    typeof sourceTask !== "string" ||
    !isMemoryEntryStatus(status) ||
    !Array.isArray(tags)
  ) {
    return undefined;
  }

  return {
    type,
    title,
    date,
    sourceTask,
    status,
    tags,
    supersedes: getOptionalString(fields, "supersedes"),
    supersededBy: getOptionalString(fields, "superseded_by"),
    related: getOptionalStringArray(fields, "related"),
    owner: getOptionalString(fields, "owner"),
    scope: getOptionalString(fields, "scope"),
    confidence: getOptionalConfidence(fields),
    expires: getOptionalString(fields, "expires"),
  };
}

function parseMemoryBody(
  body: string,
  title: string,
): { readonly summary: string; readonly sections: readonly MemoryBodySection[] } {
  const lines = body.split(/\r?\n/);
  const firstContentLine = lines.findIndex((line) => line.trim().length > 0);
  const bodyLines =
    firstContentLine !== -1 && lines[firstContentLine].startsWith("# ")
      ? lines.slice(firstContentLine + 1)
      : lines;
  const firstSectionIndex = bodyLines.findIndex((line) => line.startsWith("## "));
  const summaryLines =
    firstSectionIndex === -1 ? bodyLines : bodyLines.slice(0, firstSectionIndex);
  const summary = summaryLines.join("\n").trim() || title;
  const sectionLines =
    firstSectionIndex === -1 ? [] : bodyLines.slice(firstSectionIndex);
  const sections = parseBodySections(sectionLines);

  return {
    summary,
    sections:
      sections.length > 0
        ? sections
        : [{ heading: "Details", content: summary, order: 1 }],
  };
}

function parseBodySections(lines: readonly string[]): readonly MemoryBodySection[] {
  const sections: MemoryBodySection[] = [];
  let heading: string | undefined;
  let contentLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (heading !== undefined) {
        sections.push(createBodySection(heading, contentLines, sections.length + 1));
      }

      heading = line.slice(3).trim();
      contentLines = [];
      continue;
    }

    contentLines.push(line);
  }

  if (heading !== undefined) {
    sections.push(createBodySection(heading, contentLines, sections.length + 1));
  }

  return sections.filter((section) => section.content.length > 0);
}

function createBodySection(
  heading: string,
  contentLines: readonly string[],
  order: number,
): MemoryBodySection {
  return {
    heading,
    content: contentLines.join("\n").trim(),
    order,
  };
}

function parseYamlScalar(value: string): string {
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      const parsed = JSON.parse(value) as unknown;

      return typeof parsed === "string" ? parsed : value;
    } catch {
      return value;
    }
  }

  return value;
}

function asStringArray(value: FrontmatterValue | undefined): readonly string[] {
  return Array.isArray(value) ? value : [];
}

function getOptionalString(
  fields: ReadonlyMap<string, FrontmatterValue>,
  key: string,
): string | undefined {
  const value = fields.get(key);

  return typeof value === "string" ? value : undefined;
}

function getOptionalStringArray(
  fields: ReadonlyMap<string, FrontmatterValue>,
  key: string,
): readonly string[] | undefined {
  const value = fields.get(key);

  return Array.isArray(value) ? value : undefined;
}

function getOptionalConfidence(
  fields: ReadonlyMap<string, FrontmatterValue>,
): "low" | "medium" | "high" | undefined {
  const value = fields.get("confidence");

  return value === "low" || value === "medium" || value === "high"
    ? value
    : undefined;
}

function isMemoryType(value: unknown): value is MemoryType {
  return (
    typeof value === "string" &&
    (MEMORY_TYPES as readonly string[]).includes(value)
  );
}

function isMemoryEntryStatus(value: unknown): value is MemoryEntryStatus {
  return (
    typeof value === "string" &&
    (MEMORY_ENTRY_STATUSES as readonly string[]).includes(value)
  );
}
