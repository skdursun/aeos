# AEOS Memory MVP Implementation Plan

## Purpose
Define the practical implementation path for AEOS Memory MVP using structured
Markdown files and basic local search before any vector database, embedding, or
external memory integration work.

## Memory MVP Goal
AEOS should be able to write, validate, and search durable project memory stored
as Markdown files with YAML frontmatter under `brain/`.

The MVP should prove:
- memory entries can be built from structured input;
- memory entries follow the existing schema and template conventions;
- memory writes are scoped, redacted, validated, and deterministic;
- memory search works through local files and keyword scoring;
- CLI commands expose the write, search, and validation flows.

## Non-goals
- Do not choose a vector database.
- Do not implement embeddings.
- Do not implement MCP memory integration.
- Do not store raw conversations.
- Do not add external memory services.
- Do not create autonomous memory writes without explicit command input.
- Do not change the memory schema unless a later task explicitly scopes it.
- Do not modify existing `brain/` entries or templates as part of MVP plumbing.

## Current Memory Foundation Status
- `docs/MEMORY_DESIGN.md` defines project memory as Markdown with YAML
  frontmatter stored in `brain/`.
- `docs/MEMORY_SCHEMA.md` defines allowed memory types, required frontmatter,
  naming rules, body rules, tagging rules, and validation expectations.
- `packages/core/src/memory.ts` defines shared memory types for entries, write
  requests, search queries, search results, and validation results.
- `packages/core/src/memory-validation.ts` has an early frontmatter validator,
  including supported memory types and secret-like key detection.
- `packages/memory/src/index.ts` is still only a package marker and has no
  memory behavior.
- Templates currently exist for `bug`, `decision`, `pattern`, and `lesson`
  entries.

## Memory Design Principles
- Keep memory human-readable and Git-diffable.
- Preserve stateless Codex operation by retrieving only relevant entries.
- Prefer explicit structured input over inferred memory writes.
- Validate before writing.
- Redact or block secret-like content before persistence.
- Keep the CLI thin and delegate behavior to `@aeos/memory` and core helpers.
- Use deterministic filenames and output so fresh Codex sessions can verify
  small changes.
- Treat vector memory as a later optimization, not an MVP dependency.

## File-Based Memory Scope
The MVP storage backend is the local repository filesystem.

In scope:
- read memory files from `brain/<type>/`;
- write memory files to the directory matching the memory `type`;
- create deterministic filenames using `YYYY-MM-DD-type-short-slug.md`;
- search `.md` files under known memory type directories only;
- ignore unrelated repository files;
- return path, title, type, tags, status, excerpt, and score.

Out of scope:
- indexing daemons;
- caches requiring invalidation;
- background sync;
- remote storage;
- global user memory;
- migration from file memory to another backend.

## Markdown + YAML Frontmatter Scope
MVP entries should contain:
- required schema frontmatter fields from `docs/MEMORY_SCHEMA.md`;
- optional fields only when provided by the caller;
- a Markdown H1 matching the title;
- a concise summary paragraph;
- typed body sections supplied by the write request.

The builder should normalize field names to the documented file format, such as
`source_task`, `superseded_by`, lowercase `type`, and lowercase tags. It should
not infer facts that were not supplied by the caller.

## Memory Write Flow
1. Receive a `MemoryWriteRequest` from CLI or future caller.
2. Normalize title, tags, date, source task, type, status, and sections.
3. Generate a stable slug and destination path under `brain/<type>/`.
4. Scan frontmatter, summary, sections, and metadata for blocked secret-like
   keys or content.
5. Build Markdown with YAML frontmatter and body sections.
6. Validate the generated entry before file write.
7. Refuse to overwrite an existing file unless a later task adds explicit
   overwrite policy.
8. Write the file atomically enough for a local CLI MVP.
9. Return entry path, validation result, and created status.

## Memory Search Flow
1. Receive query, optional filters, and optional limit.
2. List only known `brain/<type>/` directories.
3. Parse frontmatter and body from Markdown memory files.
4. Skip files that fail validation unless a later debug flag includes them.
5. Score exact and partial matches across title, tags, type, source task, first
   paragraph, headings, and body text.
6. Apply filters for type, tag, status, source task, owner, confidence, and
   redaction status where available.
7. Return compact results sorted by score, then date, then path.
8. Include short excerpts only; do not dump entire entries by default.

## Memory Validation Flow
Validation should run in layers:
- path validation: file is under `brain/` and filename matches schema rules;
- frontmatter validation: required fields, allowed values, tag count, casing,
  and date format;
- body validation: H1 exists, summary exists, `Use When` exists;
- safety validation: no secret-like keys, obvious credentials, or raw transcript
  markers;
- scope validation: memory type directory matches frontmatter `type`.

The existing core validator can be tightened in a separate task, then reused by
the memory package and CLI command.

## Redaction and Secret Rules
- Block memory writes containing obvious secret-like frontmatter keys.
- Block memory writes containing token, password, private key, API key, or
  credential markers in body text.
- Do not silently persist redacted secrets in MVP unless a later task defines a
  reviewed redaction policy.
- Return structured validation issues using memory validation issue codes.
- Prefer false positives over accidental secret persistence.

## Audit/Verification Integration Placeholder
The Memory MVP should leave clear integration points for later audit and
verification packages:
- every write result should be serializable into an audit event later;
- every validation result should be usable as verification evidence later;
- CLI output should identify validation failures and created paths;
- no audit log writer is required in this MVP plan.

## CLI Integration Plan
CLI commands should be thin wrappers around package functions.

The CLI should:
- parse flags and stdin or argument text;
- call `@aeos/memory` functions;
- print compact human-readable output by default;
- preserve future JSON output compatibility without requiring it in the first
  memory command;
- avoid broad repository scanning;
- return non-zero exit codes for invalid memory, blocked writes, and no readable
  project memory root when the command requires it.

## MVP Memory Commands
- `aeos remember`
  Create a draft memory entry from provided text using a default type chosen by
  the command contract.
- `aeos remember --type <type>`
  Create a memory entry with an explicit schema-supported memory type.
- `aeos search <query>`
  Search local Markdown memory files with basic keyword ranking.
- `aeos memory validate <path>`
  Validate one memory Markdown file and report schema, path, body, and safety
  issues.

## First 12 Memory Implementation Tasks

### TASK-0057
- Title: Implement memory package Markdown entry builder.
- Purpose: Build Markdown text and deterministic paths from a
  `MemoryWriteRequest` without writing files.
- Likely files to modify: `packages/memory/src/index.ts`, memory package test or
  example files if the repo pattern supports them.
- Verification command: `pnpm --filter @aeos/memory check`.
- Recommended model effort: Medium.
- Type: Code.

### TASK-0058
- Title: Add memory filename and slug helpers.
- Purpose: Normalize dates, types, and titles into schema-compliant memory file
  names.
- Likely files to modify: `packages/memory/src/index.ts`, focused memory helper
  tests or examples.
- Verification command: `pnpm --filter @aeos/memory check`.
- Recommended model effort: Low.
- Type: Code.

### TASK-0059
- Title: Tighten core memory frontmatter validation.
- Purpose: Align `validateMemoryFrontmatter` with required schema fields,
  allowed statuses, tag count, date shape, and optional field types.
- Likely files to modify: `packages/core/src/memory-validation.ts`, related core
  typecheck examples if present.
- Verification command: `pnpm --filter @aeos/core check`.
- Recommended model effort: Medium.
- Type: Code.

### TASK-0060
- Title: Implement memory Markdown parser.
- Purpose: Parse YAML frontmatter and Markdown body from one memory file without
  adding dependencies.
- Likely files to modify: `packages/memory/src/index.ts`, focused parser tests
  or examples.
- Verification command: `pnpm --filter @aeos/memory check`.
- Recommended model effort: Medium.
- Type: Code.

### TASK-0061
- Title: Implement memory file validation.
- Purpose: Validate path, filename, frontmatter, body sections, and type
  directory alignment for one Markdown memory file.
- Likely files to modify: `packages/memory/src/index.ts`, focused validation
  tests or examples.
- Verification command: `pnpm --filter @aeos/memory check`.
- Recommended model effort: High.
- Type: Code.

### TASK-0062
- Title: Add memory secret-content blocking.
- Purpose: Detect obvious credentials, token markers, private key markers, and
  raw transcript markers before write or validation success.
- Likely files to modify: `packages/memory/src/index.ts`,
  `packages/core/src/memory-validation.ts` if shared issue codes are needed.
- Verification command: `pnpm --filter @aeos/memory check`.
- Recommended model effort: Medium.
- Type: Code.

### TASK-0063
- Title: Implement local memory writer.
- Purpose: Write validated Markdown memory entries under `brain/<type>/` while
  refusing accidental overwrites.
- Likely files to modify: `packages/memory/src/index.ts`, focused writer tests
  or examples.
- Verification command: `pnpm --filter @aeos/memory check`.
- Recommended model effort: High.
- Type: Code.

### TASK-0064
- Title: Implement file-based memory search.
- Purpose: Search known `brain/<type>/` directories with keyword scoring and
  compact excerpts.
- Likely files to modify: `packages/memory/src/index.ts`, focused search tests
  or examples.
- Verification command: `pnpm --filter @aeos/memory check`.
- Recommended model effort: High.
- Type: Code.

### TASK-0065
- Title: Add memory validate CLI command.
- Purpose: Expose `aeos memory validate <path>` as a thin CLI wrapper over
  memory validation.
- Likely files to modify: CLI command files only, plus package exports if needed.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Medium.
- Type: Code.

### TASK-0066
- Title: Add memory search CLI command.
- Purpose: Expose `aeos search <query>` with compact ranked local memory
  results.
- Likely files to modify: CLI command files only, plus package exports if needed.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Medium.
- Type: Code.

### TASK-0067
- Title: Add remember CLI command.
- Purpose: Expose `aeos remember` and `aeos remember --type <type>` for explicit
  Markdown memory creation.
- Likely files to modify: CLI command files only, plus package exports if needed.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: High.
- Type: Code.

### TASK-0068
- Title: Review Memory MVP command behavior.
- Purpose: Review write, search, validate, redaction, and CLI behavior for
  consistency before considering richer memory backends.
- Likely files to modify: `docs/MEMORY_MVP_IMPLEMENTATION_PLAN.md`,
  `TASKS/backlog.md`, `PROJECT_CONTEXT.md` if review updates are needed.
- Verification command: `git status --short`.
- Recommended model effort: Medium.
- Type: Docs.

## Stop Conditions Before Vector Memory
Do not start vector memory work until all conditions are true:
- `aeos remember` can write valid Markdown memory under `brain/`;
- `aeos remember --type <type>` supports schema-approved types;
- `aeos search <query>` returns useful local file results without broad repo
  scans;
- `aeos memory validate <path>` catches schema, body, path, and secret issues;
- memory writes refuse accidental overwrite by default;
- core and memory package checks pass;
- CLI smoke coverage exists for the MVP command set;
- a review task confirms the file-based design is too limited for a concrete
  use case.

Only after those checks should AEOS evaluate embeddings, indexes, MCP memory, or
external stores.
