# AEOS Template Discovery Implementation Plan

## Purpose
Define how AEOS will locate, validate, list, and select local templates before
rendering and `aeos init` are implemented.

This plan narrows the Template MVP discovery slice so fresh Codex sessions can
implement it without loading unrelated repository context or changing rendering
behavior.

## Template Discovery Goal
Provide deterministic local template discovery in `@aeos/templates`.

Discovery must:

- accept an explicit local templates root;
- inspect direct child directories only;
- locate template metadata files;
- read metadata through the existing metadata reader;
- return valid templates sorted by template ID;
- preserve structured issues for invalid candidates;
- select one template by explicit ID.

## Non-goals
- Do not implement rendering.
- Do not implement file generation.
- Do not implement `aeos init`.
- Do not add CLI commands in this discovery slice.
- Do not add dependencies.
- Do not scan the whole repository.
- Do not read or modify template contents beyond metadata lookup.
- Do not implement a remote registry.
- Do not implement marketplace behavior.
- Do not implement GitHub sync.
- Do not implement cloud templates.
- Do not implement AI generation.

## Current Template Foundation Status
- `@aeos/templates` exports `readTemplateMetadata` and
  `validateTemplateMetadataShape`.
- Template metadata currently includes `id`, `name`, `description`, `version`,
  `variables`, `requiredFiles`, and `optionalFiles`.
- Metadata reading already returns structured success and failure results.
- Metadata files are JSON and are read from an explicit path.
- `@aeos/projects` exposes project root and metadata helpers for later
  integration.
- No discovery engine, listing helper, or selection helper exists yet.

## Discovery Sources
MVP discovery supports only local directories supplied by the caller.

Supported source:

- explicit local templates root path.

Excluded sources:

- remote registry;
- marketplace;
- GitHub sync;
- cloud templates;
- AI-generated templates;
- implicit global template locations.

The discovery engine must not choose storage locations. Callers are responsible
for passing the root path.

## Local Template Structure
Each local template candidate is a direct child directory under the supplied
templates root.

Expected MVP shape:

```text
templates-root/
  template-id/
    template.json
```

Rules:

- only direct child directories are candidates;
- files directly inside the root are ignored;
- nested directories are not recursively discovered;
- a candidate becomes readable only when its metadata file exists;
- template file contents are not read during discovery.

The metadata filename should be a package-level constant so later tasks can
change it in one place if the template spec evolves.

## Metadata Lookup Flow
1. Resolve the caller-provided templates root.
2. Read direct entries under that root.
3. Keep directory entries as template candidates.
4. Build each candidate metadata path with the package metadata filename.
5. Call `readTemplateMetadata(metadataPath)` for each candidate.
6. Add valid metadata records to the discovered template list.
7. Add invalid or unreadable candidates to the issue list.
8. Sort valid templates by `metadata.id`.
9. Sort issues by candidate path for deterministic output.
10. Return one serializable discovery result.

Discovery should continue after per-candidate metadata failures so one malformed
template does not hide other valid local templates.

## Template Filtering
MVP filtering is intentionally small.

Supported:

- list all valid local templates;
- select a template by exact `id`.

Deferred:

- category filtering;
- runtime filtering;
- version range filtering;
- risk-level filtering;
- text search;
- tags;
- interactive prompts.

The discovery result should expose enough metadata for future filters without
changing the basic list shape.

## Template Selection Strategy
Selection is explicit in the MVP.

Rules:

- caller supplies a template ID;
- discovery runs against the explicit templates root;
- selection compares the requested ID to discovered metadata IDs;
- exactly one matching template returns a selected template result;
- no match returns `template_not_found`;
- duplicate IDs return `duplicate_template_id`;
- automatic selection is deferred.

Selection must not prompt, infer from project files, or choose a default
template.

## Template Version Handling
MVP version handling is descriptive only.

Rules:

- read and return the metadata `version` string;
- do not parse semantic versions;
- do not compare version ranges;
- do not choose the newest version;
- treat duplicate template IDs as an error even if versions differ.

Later registry work may introduce version constraints and remote version
resolution.

## Discovery Result Format
Use compact serializable result types.

Suggested shape:

```ts
type TemplateDiscoveryResult =
  | {
      ok: true;
      root: string;
      templates: readonly DiscoveredTemplate[];
      issues: readonly TemplateDiscoveryIssue[];
    }
  | {
      ok: false;
      root: string;
      templates: readonly DiscoveredTemplate[];
      issues: readonly TemplateDiscoveryIssue[];
    };

interface DiscoveredTemplate {
  readonly id: string;
  readonly path: string;
  readonly metadataPath: string;
  readonly metadata: TemplateMetadata;
}
```

`ok` should be `true` when root discovery succeeds, even if some candidates have
issues. It should be `false` only when the root itself cannot be read or the
result has a global failure.

## Error Handling
Discovery should return structured issues, not throw for expected local
filesystem conditions.

MVP issue codes:

- `templates_root_missing`;
- `templates_root_not_directory`;
- `templates_root_read_failed`;
- `template_metadata_missing`;
- `template_metadata_read_failed`;
- `template_metadata_parse_failed`;
- `template_metadata_invalid_shape`;
- `duplicate_template_id`;
- `template_not_found`.

Each issue should include:

- code;
- message;
- path when applicable;
- template ID when applicable.

Unexpected programming errors may still throw, but normal missing files,
malformed JSON, invalid metadata, and missing IDs should be result values.

## Verification Strategy
Primary verification:

- `pnpm --filter @aeos/templates check`

Implementation examples should cover:

- missing root;
- empty root;
- files ignored at root level;
- direct child without metadata;
- malformed metadata;
- invalid metadata shape;
- multiple valid templates sorted by ID;
- duplicate template IDs;
- selection by existing ID;
- selection by missing ID.

Docs-only planning tasks verify with:

- `git status --short`

## MVP Scope
Support:

- local template directories;
- metadata lookup;
- template listing;
- template selection by ID.

Exclude:

- remote registry;
- marketplace;
- GitHub sync;
- cloud templates;
- AI generation;
- rendering;
- file generation;
- CLI commands.

## Later Scope
- Category and runtime filters.
- Version range selection.
- Template search.
- Template detail CLI output.
- `aeos templates list`.
- `aeos templates show <id>`.
- `aeos init`.
- Organization-local template catalogs.
- Remote template registries.
- Marketplace integration.
- GitHub template sync.
- Cloud template storage.
- AI-generated template creation.

## First 10 Template Discovery Implementation Tasks

### TASK-0095
- Task ID: TASK-0095
- Title: Implement template discovery engine.
- Purpose: Define the public discovery API and serializable discovery,
  discovered template, and issue result shapes without reading candidate
  metadata yet.
- Likely files: `packages/templates/src/index.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Low.
- Classification: Code.

### TASK-0096
- Task ID: TASK-0096
- Title: Add template metadata filename constant.
- Purpose: Centralize the MVP metadata filename used by discovery and future
  examples.
- Likely files: `packages/templates/src/index.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Low.
- Classification: Code.

### TASK-0097
- Task ID: TASK-0097
- Title: Implement templates root entry reader.
- Purpose: Read direct entries from an explicit templates root and return
  structured root-level issues.
- Likely files: `packages/templates/src/index.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0098
- Task ID: TASK-0098
- Title: Filter direct child template directories.
- Purpose: Treat only direct child directories as template candidates and ignore
  root-level files.
- Likely files: `packages/templates/src/index.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Low.
- Classification: Code.

### TASK-0099
- Task ID: TASK-0099
- Title: Build template candidate metadata paths.
- Purpose: Map each candidate directory to the package metadata filename without
  reading template contents.
- Likely files: `packages/templates/src/index.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Low.
- Classification: Code.

### TASK-0100
- Task ID: TASK-0100
- Title: Read candidate metadata during discovery.
- Purpose: Call the existing metadata reader for each candidate and collect
  valid discovered templates plus metadata issues.
- Likely files: `packages/templates/src/index.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0101
- Task ID: TASK-0101
- Title: Sort discovered templates and discovery issues.
- Purpose: Make discovery output deterministic by sorting templates by ID and
  issues by path.
- Likely files: `packages/templates/src/index.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Low.
- Classification: Code.

### TASK-0102
- Task ID: TASK-0102
- Title: Detect duplicate template IDs.
- Purpose: Report duplicate local template IDs as structured discovery issues
  before selection.
- Likely files: `packages/templates/src/index.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0103
- Task ID: TASK-0103
- Title: Implement template selection by ID.
- Purpose: Select one discovered template by exact ID and return stable
  `template_not_found` or duplicate-ID failures.
- Likely files: `packages/templates/src/index.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0104
- Task ID: TASK-0104
- Title: Add template discovery examples.
- Purpose: Add small typecheck examples for empty roots, valid templates,
  invalid metadata, duplicates, and ID selection.
- Likely files: `packages/templates/src/index.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Medium.
- Classification: Code.

## Stop Conditions Before Rendering
- Local discovery accepts only an explicit templates root.
- Discovery reads only direct child directories.
- Metadata lookup uses the existing metadata reader.
- Template listing returns deterministic sorted results.
- Invalid candidates are reported without hiding valid templates.
- Duplicate template IDs are reported.
- Template selection by exact ID is implemented.
- Missing template IDs return stable `template_not_found` results.
- Discovery behavior is verified by `pnpm --filter @aeos/templates check`.
- No rendering, file generation, `aeos init`, remote storage, marketplace,
  GitHub sync, cloud templates, or AI generation has been added.
