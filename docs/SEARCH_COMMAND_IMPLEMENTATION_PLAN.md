# AEOS Search Command Implementation Plan

## Purpose
Define the implementation path for the AEOS memory search CLI command:
`aeos search`.

This plan describes how users will search stored memories through the existing
`@aeos/memory` in-memory search capabilities without adding new search
infrastructure.

## Search Command Goal
`aeos search` should return compact, deterministic matches from stored project
memory.

The MVP should prove:
- query text can be parsed from CLI arguments;
- optional memory type filtering can be applied;
- stored memory entries can be loaded into the existing in-memory index;
- title, tag, and type matching produce stable ranked results;
- human-readable output is compact enough for small Codex sessions;
- future JSON output can reuse the same result shape.

## Non-goals
- Do not implement embeddings.
- Do not add a vector database.
- Do not implement semantic search.
- Do not add external search services.
- Do not add dependencies.
- Do not choose permanent search infrastructure.
- Do not scan unrelated repository files.
- Do not change the memory schema.
- Do not modify memory write behavior.

## Current Memory Search Foundation
- `packages/core/src/memory.ts` defines `MemorySearchQuery`,
  `MemorySearchFilter`, and `MemorySearchResult`.
- `packages/memory/src/search-index.ts` provides `MemorySearchIndex`,
  `createMemorySearchIndex`, and `searchMemoryEntries`.
- The current in-memory index scores matches deterministically:
  - title match: 3 points;
  - tag match: 2 points;
  - type match: 1 point.
- The current index supports filters for type, scope, tag, status, source task,
  owner, confidence, expiry, and redaction status.
- The current result includes the entry, score, matched fields, excerpt, and
  rank.
- `packages/memory/src/index.ts` already exports the search index helpers.
- `apps/cli/src/commands.ts` uses small command handlers, plain argv parsing,
  compact output, and dynamic loading of `@aeos/memory`.

## Search UX Design
MVP examples:

```sh
aeos search "query"
aeos search "query" --type decision
aeos search "query" --json
```

Default human output should be compact:

```text
Memory search: pass
Query: query
Results: 2

1. Decision title
Type: decision
Score: 3
Matched: title
Path: .aeos/memory/decision/2026-07-31-decision-title.md
Excerpt: Short summary text.
```

No matches should be stable and non-error:

```text
Memory search: pass
Query: query
Results: 0
```

Usage failures should be stable:

```text
Memory search: fail
Reason: missing query
Usage: aeos search "query"
```

## Query Input
- The first non-flag argument is the search query.
- Quoted multi-word queries are supported by normal shell argv behavior.
- Empty or missing query text fails with exit code `1`.
- MVP does not read query text from stdin.
- MVP does not support interactive prompting.
- MVP does not parse natural language filters.

## Search Filters
MVP filter:
- `--type <type>` filters results to one supported `MemoryType`.

Later filters:
- `--tag <tag>`;
- `--status <status>`;
- `--source-task <id>`;
- `--limit <number>`;
- `--owner <owner>`;
- `--confidence <low|medium|high>`;
- `--include-expired`.

Invalid type filters should fail before loading memory entries.

## Result Format
Human output should include:
- status line;
- query;
- result count;
- rank;
- title;
- type;
- score;
- matched fields;
- path when available;
- excerpt when available.

Results should not print full memory bodies by default.

## JSON Output Future Support
`aeos search "query" --json` is reserved for structured output.

Future JSON should include:
- `ok`;
- `query`;
- `filters`;
- `results`;
- each result's `rank`, `score`, `matchedFields`, `type`, `title`, `path`, and
  `excerpt`;
- `reason` for failures.

The first search implementation may reject `--json` with a stable
not-yet-supported error, or implement JSON output only if explicitly scoped by
that task. The command shape should not require redesign when JSON is added.

## Ranking Strategy
The MVP ranking must use the existing `@aeos/memory` in-memory index.

In scope:
- title matching;
- tag matching;
- type matching;
- existing filter behavior;
- existing deterministic sorting.

Out of scope:
- body-text ranking;
- fuzzy matching;
- semantic expansion;
- embedding similarity;
- vector search;
- external index ranking.

## Validation Strategy
- Validate that the query is present and non-empty.
- Validate `--type` against the existing `MemoryType` list used by the CLI.
- Return usage errors with exit code `1`.
- Treat no matches as successful output with exit code `0`.
- Keep unexpected memory loading or filesystem failures as exit code `2`.
- Verify TypeScript with `pnpm --filter @aeos/cli check`.

## CLI Integration Flow
1. Add `search "query"` and `search "query" --type <type>` to help text.
2. Add a `handleSearch(args)` command handler.
3. Parse `--json`, `--type`, and the first non-flag query argument.
4. Validate query and type filter.
5. Load the memory package through the existing dynamic package loader pattern.
6. Load stored memory entries from the project memory location used by
   `remember`.
7. Build a `MemorySearchQuery`.
8. Call the existing memory search index helpers.
9. Print compact human output.
10. Wire `case "search"` into `main`.

## Memory Package Integration
The CLI should delegate matching and ranking to `@aeos/memory`.

Required integration shape:
- convert stored memory files into `MemoryEntry` values before indexing;
- create an index with `createMemorySearchIndex(entries)`;
- call `searchMemoryEntries(index, query)`;
- avoid reimplementing title, tag, or type scoring in the CLI.

If stored-memory reading is not yet exported by `@aeos/memory`, add the smallest
memory-package reader needed in a later scoped implementation task. Do not add
dependencies.

## MVP Scope
- `aeos search "query"`.
- `aeos search "query" --type decision`.
- Deterministic title, tag, and type matching.
- Existing in-memory index usage.
- Compact human-readable output.
- Stable validation and usage failures.
- Focused CLI and memory package checks.

## Later Scope
- JSON output.
- Tag, status, source task, owner, confidence, and limit filters.
- File validation before indexing.
- Body excerpt generation.
- Search result tests with fixture memories.
- Integration with `aeos context`.
- Semantic search only after deterministic search proves useful.

## First 10 Search Implementation Tasks

### TASK-0073
- Task id: TASK-0073
- Title: Implement aeos search command core flow.
- Purpose: Add `aeos search "query"` routing that loads stored memory entries,
  uses the existing in-memory index, and prints compact ranked results.
- Likely files: `apps/cli/src/commands.ts`, `packages/memory/src/index.ts` if a
  small reader export is required.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0074
- Task id: TASK-0074
- Title: Add search command usage errors.
- Purpose: Return stable errors for missing query, empty query, unsupported
  flags, and invalid type filters.
- Likely files: `apps/cli/src/commands.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Low.
- Classification: Code.

### TASK-0075
- Task id: TASK-0075
- Title: Add memory file reader for search indexing.
- Purpose: Convert stored Markdown memories from the project memory directory
  into `MemoryEntry` values that can be added to `MemorySearchIndex`.
- Likely files: `packages/memory/src/index.ts`, focused memory reader files if
  the package has split modules.
- Verification command: `pnpm --filter @aeos/memory check`.
- Recommended model effort: High.
- Classification: Code.

### TASK-0076
- Task id: TASK-0076
- Title: Add search type filter.
- Purpose: Support `aeos search "query" --type <type>` by passing a
  `MemorySearchFilter.types` value to the existing index.
- Likely files: `apps/cli/src/commands.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Low.
- Classification: Code.

### TASK-0077
- Task id: TASK-0077
- Title: Add deterministic search result formatting.
- Purpose: Print rank, title, type, score, matched fields, path, and excerpt in
  stable human-readable output.
- Likely files: `apps/cli/src/commands.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Low.
- Classification: Code.

### TASK-0078
- Task id: TASK-0078
- Title: Add search no-results behavior.
- Purpose: Ensure zero matches print a successful `Results: 0` response without
  treating the command as a failure.
- Likely files: `apps/cli/src/commands.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Low.
- Classification: Code.

### TASK-0079
- Task id: TASK-0079
- Title: Add search command smoke checks.
- Purpose: Cover successful search, type-filtered search, missing query, and no
  results through the existing CLI verification pattern.
- Likely files: CLI smoke or example files already used by the repository.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0080
- Task id: TASK-0080
- Title: Add search JSON output placeholder.
- Purpose: Reserve `--json` behavior with either a stable unsupported response
  or explicitly scoped structured output.
- Likely files: `apps/cli/src/commands.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Low.
- Classification: Code.

### TASK-0081
- Task id: TASK-0081
- Title: Review search command deterministic behavior.
- Purpose: Check that search ranking uses only title, tag, type, filters, and
  existing in-memory index behavior.
- Likely files: `docs/SEARCH_COMMAND_IMPLEMENTATION_PLAN.md`,
  `TASKS/backlog.md`, review notes if requested.
- Verification command: `git status --short`.
- Recommended model effort: Medium.
- Classification: Docs.

### TASK-0082
- Task id: TASK-0082
- Title: Update search command context handoff.
- Purpose: Keep project context and backlog aligned after the search MVP tasks
  are completed or reprioritized.
- Likely files: `PROJECT_CONTEXT.md`, `TASKS/backlog.md`.
- Verification command: `git status --short`.
- Recommended model effort: Low.
- Classification: Docs.

## Stop Conditions Before Semantic Search
Do not start semantic search until all conditions are met:
- deterministic `aeos search "query"` works against stored local memories;
- `--type` filtering works through `MemorySearchFilter.types`;
- no-results behavior is stable and successful;
- invalid input behavior is stable and documented;
- compact human output is accepted;
- JSON output behavior is either implemented or intentionally deferred;
- memory loading does not scan unrelated repository files;
- implementation still has no embeddings, vector database, semantic search, or
  external search service.
