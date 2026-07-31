import type {
  AeosError,
  MemoryEntry,
  MemoryValidationResult,
  Result,
} from "@aeos/core";
import { createAeosError, err, ok } from "@aeos/core";
import { buildMemoryMarkdownEntry } from "./markdown-entry.js";
import { validateMemoryEntry } from "./validation.js";

export interface MemoryWriteTarget {
  readonly rootPath: string;
  readonly collectionPath?: string;
}

export interface MemoryWriteRequest {
  readonly entry: MemoryEntry;
  readonly target: MemoryWriteTarget;
  readonly path: string;
  readonly validation: MemoryValidationResult;
}

export interface MemoryWriteSuccess {
  readonly entry: MemoryEntry;
  readonly target: MemoryWriteTarget;
  readonly path: string;
  readonly content: string;
  readonly validation: MemoryValidationResult;
}

export type MemoryWriteResult = Result<MemoryWriteSuccess, AeosError>;
export type MemoryWriteRequestResult = Result<MemoryWriteRequest, AeosError>;

export function createMemoryWriteRequest(
  entry: MemoryEntry,
  target: MemoryWriteTarget,
): MemoryWriteRequestResult {
  const validation = validateMemoryEntry(entry);

  if (!validation.valid) {
    return err(createInvalidMemoryEntryError(validation));
  }

  return ok({
    entry,
    target,
    path: buildMemoryFilePath(target, entry),
    validation,
  });
}

export function createMemoryWriteResult(
  request: MemoryWriteRequest,
): MemoryWriteResult {
  const validation = validateMemoryEntry(request.entry);

  if (!validation.valid) {
    return err(createInvalidMemoryEntryError(validation));
  }

  return ok({
    ...request,
    validation,
    content: prepareMemoryFileContent(request.entry),
  });
}

export function buildMemoryFilePath(
  target: MemoryWriteTarget,
  entry: MemoryEntry,
): string {
  const datePrefix = entry.frontmatter.date.slice(0, 10);
  const typeSegment = slugifyPathSegment(entry.frontmatter.type);
  const titleSegment = slugifyPathSegment(entry.frontmatter.title);
  const idSegment = slugifyPathSegment(entry.id);
  const fileName = `${datePrefix}-${typeSegment}-${titleSegment}-${idSegment}.md`;

  return joinPathSegments(target.rootPath, target.collectionPath, fileName);
}

export function prepareMemoryFileContent(entry: MemoryEntry): string {
  return buildMemoryMarkdownEntry(entry);
}

function createInvalidMemoryEntryError(
  validation: MemoryValidationResult,
): AeosError {
  return createAeosError({
    code: "MEMORY_WRITE_INVALID_ENTRY",
    message: "Cannot prepare a write request for an invalid memory entry.",
    category: "validation",
    retryable: false,
    details: {
      validationStatus: validation.status,
      issueCount: validation.issues.length,
    },
  });
}

function joinPathSegments(
  ...segments: readonly (string | undefined)[]
): string {
  return segments
    .flatMap((segment) => normalizePathSegment(segment))
    .join("/");
}

function normalizePathSegment(segment: string | undefined): readonly string[] {
  if (segment === undefined) {
    return [];
  }

  return segment
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function slugifyPathSegment(value: string): string {
  const slug = value
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug.length > 0 ? slug : "memory";
}
