# AEOS Template MVP Implementation Plan

## Purpose
Define the Template MVP implementation sequence for AEOS.

This plan covers how AEOS will discover, describe, validate, and render local
project templates before implementing `aeos init`.

## Template MVP Goal
Provide a local, deterministic `@aeos/templates` foundation that can discover
available templates, read template metadata, validate declared variables, plan
file rendering, and expose validation hooks for future CLI and project flows.

MVP template capabilities:

- template discovery;
- template metadata;
- variable substitution;
- file rendering plan;
- validation hooks.

## Non-goals
- Do not implement `aeos init`.
- Do not create actual template files in this task.
- Do not modify `templates/`.
- Do not modify `packages/templates` source in this planning task.
- Do not add dependencies.
- Do not choose a template engine yet.
- Do not implement remote template registry.
- Do not implement marketplace.
- Do not implement GitHub template sync.
- Do not implement AI-generated templates.
- Do not implement cloud storage.
- Do not implement deployment automation.

## Current AEOS Foundation Status
- `@aeos/projects` exposes root detection and metadata reader helpers.
- Project commands for status, root, context, and validate exist as the local
  foundation for future `aeos init`.
- `@aeos/templates` currently exposes only `packageName` from
  `packages/templates/src/index.ts`.
- `@aeos/templates` has TypeScript build and check scripts.
- `docs/PROJECT_TEMPLATE_SPEC.md` defines the target template structure,
  metadata fields, selection rules, rendering rules, and verification rules.

## Template Package Responsibilities
`@aeos/templates` should own reusable template behavior:

- discover local template candidates from an explicitly supplied templates root;
- read template metadata from a declared metadata file;
- validate required and optional metadata fields;
- validate caller-supplied variables before rendering;
- produce deterministic render plans without writing files;
- render file content only within declared template scope;
- expose validation hook descriptions for future verification integration;
- return serializable success and failure results for CLI rendering.

`apps/cli` should stay thin in later tasks:

- parse future template and init arguments;
- call public `@aeos/templates` helpers;
- call `@aeos/projects` for project root facts;
- format compact text or future JSON output;
- preserve stable exit codes.

## Template Metadata Strategy
The MVP should represent template metadata as a small typed record aligned with
`docs/PROJECT_TEMPLATE_SPEC.md`.

Required MVP fields:

- `id`
- `name`
- `description`
- `version`
- `category`
- `required_variables`
- `optional_variables`
- `files_created`
- `verification_profile`
- `risk_level`

Metadata reading should be implemented behind a narrow package API. The MVP may
start from JSON-compatible plain objects or simple parsed text fixtures in
package examples, but it must not choose the final template engine or require a
new parser dependency during the first implementation tasks.

## Template Discovery Flow
1. Accept an explicit templates root path.
2. Read only direct child template directories.
3. Treat a child directory as a template candidate only when it contains the
   declared metadata file.
4. Read metadata for candidates through the metadata reader.
5. Return discovered templates sorted by `id`.
6. Report malformed templates as validation issues without throwing away valid
   templates.
7. Do not scan unrelated repository directories.
8. Do not call network services.

## Template Selection Flow
1. Prefer an explicit template ID supplied by the caller.
2. If a category or runtime filter is later supplied, filter metadata records
   before selection.
3. Return a stable `template_not_found` result when an explicit ID is missing.
4. Return a stable `ambiguous_template_selection` result if automatic selection
   cannot choose one local template.
5. Defer interactive prompting to future CLI tasks.
6. Keep `project-default` and `generic` as the initial MVP template targets.

## Variable System Design
Variables must be declared before rendering.

MVP variable behavior:

- support lowercase snake_case variable names;
- distinguish required and optional variables;
- validate that all required variables are provided;
- reject unknown variables by default unless a future option allows them;
- reject empty required values unless metadata later declares them nullable;
- return structured issues such as `missing_required_variable`,
  `unknown_variable`, and `invalid_variable_name`;
- avoid storing secrets or model/provider assumptions in variable records.

Variable substitution should be defined as a package-level operation over string
content and a validated variable map. The placeholder syntax is intentionally
deferred until the implementation task that defines the renderer contract.

## Rendering Strategy
Rendering should be deterministic and side-effect free until a separate file
generation step applies a render plan.

MVP renderer responsibilities:

- accept validated template metadata, file entries, and variables;
- substitute declared variables in renderable content;
- produce a render plan with target relative paths and rendered content;
- report unresolved placeholders as validation issues;
- keep all rendered paths within declared `files_created`;
- avoid choosing a third-party template engine.

## File Generation Strategy
File writes must be separated from render planning.

MVP file generation behavior:

- accept a render plan and explicit target root;
- refuse absolute output paths;
- refuse path traversal outside the target root;
- refuse undeclared files;
- report existing target files as overwrite issues;
- write only declared files after the caller has handled overwrite policy;
- return created path summaries suitable for CLI and audit output.

## Verification Integration
Templates should expose verification-ready data before a full verification
runner exists.

MVP validation hooks:

- metadata validation;
- variable validation;
- render plan validation;
- declared file existence checks after generation;
- scope checks confirming no undeclared files were generated.

The package should return validation results that future `@aeos/verification`
or CLI flows can consume without changing the template core contract.

## Project Integration
Template flows should consume project facts from `@aeos/projects` rather than
duplicating project root logic.

Future project integration should:

- resolve or confirm the target root before generation;
- detect existing `PROJECT_CONTEXT.md`, `AGENTS.md`, `TASKS/`, and `docs/`
  state;
- pass target root and project metadata into template planning;
- keep generated context concise;
- avoid creating `.aeos/` until init/storage policy is explicit.

## CLI Integration Placeholder
CLI work is deferred until package helpers are stable.

Later CLI tasks may add:

- `aeos templates list`;
- `aeos templates show <id>`;
- dry-run output for template render plans;
- `aeos init` using `project-default` or `generic`.

No CLI task should run before package metadata, discovery, variable validation,
render planning, file generation, and verification hook stop conditions pass.

## MVP Scope
- Define template metadata types.
- Implement template metadata reader.
- Implement local template discovery from an explicit root.
- Implement template selection by ID.
- Implement variable validation.
- Define the placeholder substitution contract.
- Implement deterministic render plan creation.
- Implement safe file generation from a render plan.
- Add validation hook result shapes.
- Keep all behavior local, deterministic, dependency-free, and testable with
  TypeScript checks.

## Later Scope
- `aeos init`.
- Interactive variable prompting.
- Template dry-run CLI.
- Template JSON CLI output.
- Rich metadata schemas.
- Policy-gated overwrite approval.
- Audit event writing.
- Full verification runner integration.
- Framework templates such as `nextjs`, `node-api`, and `python`.
- Organization-local template registries.
- Remote template registry.
- Marketplace.
- GitHub template sync.
- AI-generated templates.
- Cloud storage.
- Deployment automation.

## First 12 Template Implementation Tasks

### TASK-0092
- Task ID: TASK-0092
- Title: Implement template package metadata reader.
- Purpose: Add typed metadata reading and validation for one local template
  metadata object without scanning directories.
- Likely files: `packages/templates/src/index.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0093
- Task ID: TASK-0093
- Title: Add template metadata validation issues.
- Purpose: Return structured issues for missing required metadata fields,
  invalid IDs, empty file declarations, and unsupported risk labels.
- Likely files: `packages/templates/src/index.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0094
- Task ID: TASK-0094
- Title: Implement local template discovery.
- Purpose: Discover direct child template candidates from an explicit templates
  root and return sorted valid metadata plus issues.
- Likely files: `packages/templates/src/index.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0095
- Task ID: TASK-0095
- Title: Implement template selection by ID.
- Purpose: Select one discovered template by explicit ID with stable
  `template_not_found` errors.
- Likely files: `packages/templates/src/index.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Low.
- Classification: Code.

### TASK-0096
- Task ID: TASK-0096
- Title: Implement template variable validation.
- Purpose: Validate required, optional, unknown, empty, and invalid variable
  names before rendering.
- Likely files: `packages/templates/src/index.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0097
- Task ID: TASK-0097
- Title: Define template placeholder rendering contract.
- Purpose: Document the minimal placeholder syntax and unresolved-placeholder
  behavior without choosing an external template engine.
- Likely files: `docs/TEMPLATE_MVP_IMPLEMENTATION_PLAN.md`,
  `TASKS/backlog.md`, `PROJECT_CONTEXT.md`.
- Verification command: `git status --short`.
- Recommended model effort: Low.
- Classification: Docs.

### TASK-0098
- Task ID: TASK-0098
- Title: Implement template content substitution.
- Purpose: Render string content using validated variables and report unresolved
  placeholders deterministically.
- Likely files: `packages/templates/src/index.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0099
- Task ID: TASK-0099
- Title: Implement template render plan builder.
- Purpose: Produce a side-effect-free render plan containing declared target
  paths and rendered content.
- Likely files: `packages/templates/src/index.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0100
- Task ID: TASK-0100
- Title: Add render path safety validation.
- Purpose: Reject absolute paths, traversal paths, duplicate targets, and files
  outside metadata `files_created`.
- Likely files: `packages/templates/src/index.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0101
- Task ID: TASK-0101
- Title: Implement safe template file generation.
- Purpose: Apply a validated render plan to an explicit target root while
  refusing undeclared files and unapproved overwrites.
- Likely files: `packages/templates/src/index.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: High.
- Classification: Code.

### TASK-0102
- Task ID: TASK-0102
- Title: Add template verification hook results.
- Purpose: Expose metadata, variable, render plan, file existence, and scope
  validation results in a compact serializable shape.
- Likely files: `packages/templates/src/index.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0103
- Task ID: TASK-0103
- Title: Review Template MVP package behavior.
- Purpose: Review template metadata, discovery, variable validation, rendering,
  generation, and verification hooks before starting `aeos init`.
- Likely files: `docs/TEMPLATE_MVP_IMPLEMENTATION_PLAN.md`,
  `TASKS/backlog.md`, `PROJECT_CONTEXT.md`.
- Verification command: `git status --short`.
- Recommended model effort: Medium.
- Classification: Docs.

## Stop Conditions Before aeos init
- `@aeos/templates` can read and validate template metadata.
- `@aeos/templates` can discover local templates from an explicit root.
- Template selection by explicit ID is deterministic.
- Required and optional variables are validated before rendering.
- Placeholder substitution behavior is documented and implemented.
- Render plans are side-effect free.
- File generation writes only declared files inside the target root.
- Existing files are not overwritten without an explicit caller decision.
- Validation hook results cover metadata, variables, rendering, file existence,
  and generated-file scope.
- Project integration consumes `@aeos/projects` root facts.
- No remote template registry, marketplace, GitHub template sync, AI-generated
  templates, cloud storage, or deployment automation has been added.
