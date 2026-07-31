import type {
  MemoryEntry,
  MemoryEntryId,
  MemorySearchQuery,
  MemorySearchResult,
} from "@aeos/core";

const TITLE_MATCH_SCORE = 3;
const TAG_MATCH_SCORE = 2;
const TYPE_MATCH_SCORE = 1;

export class MemorySearchIndex {
  private readonly entries = new Map<MemoryEntryId, MemoryEntry>();

  public addMemoryEntry(entry: MemoryEntry): void {
    this.entries.set(entry.id, entry);
  }

  public removeMemoryEntry(id: MemoryEntryId): boolean {
    return this.entries.delete(id);
  }

  public searchMemoryEntries(query: MemorySearchQuery): readonly MemorySearchResult[] {
    const normalizedQuery = normalizeSearchText(query.query);
    const limit = normalizeLimit(query.limit);

    const results = [...this.entries.values()]
      .filter((entry) => matchesFilters(entry, query))
      .flatMap((entry) => {
        const result = buildSearchResult(entry, normalizedQuery);

        return result === undefined ? [] : [result];
      })
      .sort(compareSearchResults)
      .slice(0, limit)
      .map((result, index) => ({
        ...result,
        rank: index + 1,
      }));

    return results;
  }

  public clearMemoryIndex(): void {
    this.entries.clear();
  }

  public getMemoryCount(): number {
    return this.entries.size;
  }
}

export function createMemorySearchIndex(
  entries: readonly MemoryEntry[] = [],
): MemorySearchIndex {
  const index = new MemorySearchIndex();

  for (const entry of entries) {
    index.addMemoryEntry(entry);
  }

  return index;
}

export function addMemoryEntry(
  index: MemorySearchIndex,
  entry: MemoryEntry,
): void {
  index.addMemoryEntry(entry);
}

export function removeMemoryEntry(
  index: MemorySearchIndex,
  id: MemoryEntryId,
): boolean {
  return index.removeMemoryEntry(id);
}

export function searchMemoryEntries(
  index: MemorySearchIndex,
  query: MemorySearchQuery,
): readonly MemorySearchResult[] {
  return index.searchMemoryEntries(query);
}

export function clearMemoryIndex(index: MemorySearchIndex): void {
  index.clearMemoryIndex();
}

export function getMemoryCount(index: MemorySearchIndex): number {
  return index.getMemoryCount();
}

function buildSearchResult(
  entry: MemoryEntry,
  normalizedQuery: string,
): MemorySearchResult | undefined {
  const matchedFields: string[] = [];
  let score = 0;

  if (matchesSearchText(entry.frontmatter.title, normalizedQuery)) {
    matchedFields.push("title");
    score += TITLE_MATCH_SCORE;
  }

  if (
    entry.frontmatter.tags.some((tag) =>
      matchesSearchText(tag, normalizedQuery),
    )
  ) {
    matchedFields.push("tags");
    score += TAG_MATCH_SCORE;
  }

  if (matchesSearchText(entry.frontmatter.type, normalizedQuery)) {
    matchedFields.push("type");
    score += TYPE_MATCH_SCORE;
  }

  if (score === 0) {
    return undefined;
  }

  return {
    entry,
    score,
    matchedFields,
    excerpt: entry.summary,
  };
}

function matchesFilters(
  entry: MemoryEntry,
  query: MemorySearchQuery,
): boolean {
  const filter = query.filter;

  if (filter === undefined) {
    return true;
  }

  if (
    filter.types !== undefined &&
    !filter.types.includes(entry.frontmatter.type)
  ) {
    return false;
  }

  if (
    filter.scopes !== undefined &&
    !valueMatchesOptionalFilter(entry.frontmatter.scope, filter.scopes)
  ) {
    return false;
  }

  if (
    filter.tags !== undefined &&
    !filter.tags.every((tag) => entry.frontmatter.tags.includes(tag))
  ) {
    return false;
  }

  if (
    filter.statuses !== undefined &&
    !filter.statuses.includes(entry.frontmatter.status)
  ) {
    return false;
  }

  if (
    filter.sourceTasks !== undefined &&
    !filter.sourceTasks.includes(entry.frontmatter.sourceTask)
  ) {
    return false;
  }

  if (
    filter.owners !== undefined &&
    !valueMatchesOptionalFilter(entry.frontmatter.owner, filter.owners)
  ) {
    return false;
  }

  if (
    filter.confidence !== undefined &&
    !valueMatchesOptionalFilter(
      entry.frontmatter.confidence,
      filter.confidence,
    )
  ) {
    return false;
  }

  if (
    filter.redactionStatuses !== undefined &&
    !filter.redactionStatuses.includes(entry.redactionStatus)
  ) {
    return false;
  }

  if (
    filter.includeExpired !== true &&
    entry.frontmatter.expires !== undefined &&
    query.requestedAt !== undefined &&
    entry.frontmatter.expires < query.requestedAt
  ) {
    return false;
  }

  return true;
}

function valueMatchesOptionalFilter<T>(
  value: T | undefined,
  filterValues: readonly T[],
): boolean {
  return value !== undefined && filterValues.includes(value);
}

function matchesSearchText(value: string, normalizedQuery: string): boolean {
  if (normalizedQuery.length === 0) {
    return true;
  }

  return normalizeSearchText(value).includes(normalizedQuery);
}

function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit) || limit < 0) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.floor(limit);
}

function compareSearchResults(
  left: MemorySearchResult,
  right: MemorySearchResult,
): number {
  const scoreComparison = right.score - left.score;

  if (scoreComparison !== 0) {
    return scoreComparison;
  }

  const titleComparison = left.entry.frontmatter.title.localeCompare(
    right.entry.frontmatter.title,
    "en-US",
  );

  if (titleComparison !== 0) {
    return titleComparison;
  }

  return left.entry.id.localeCompare(right.entry.id, "en-US");
}
