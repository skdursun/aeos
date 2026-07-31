import { validateMemoryFrontmatter } from "@aeos/core";
import type { MemoryEntry, MemoryValidationResult } from "@aeos/core";

export function validateMemoryEntry(
  entry: MemoryEntry,
): MemoryValidationResult {
  return validateMemoryFrontmatter(entry.frontmatter);
}

export function canBuildMarkdownEntry(entry: MemoryEntry): boolean {
  return validateMemoryEntry(entry).valid;
}

export function canIndexMemoryEntry(entry: MemoryEntry): boolean {
  return validateMemoryEntry(entry).valid;
}
