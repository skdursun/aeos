# AEOS Init Engine Implementation Plan

## Purpose
Define the implementation plan for the AEOS init execution engine.

This plan turns the existing `aeos init` workflow direction into a modular
engine that orchestrates project detection, template selection, variable
resolution, rendering, writing, validation, and result reporting.

## Init Engine Goal
The init engine accepts explicit caller input, performs deterministic local
initialization work, and returns an `InitResult`.

Input:

- project root;
- template id;
- variables.

Process:

1. detect;
2. select;
3. resolve;
4. render;
5. write;
6. validate.

Output:

- `InitResult`.

## Current Foundation Status
- `packages/core/src/init.ts` defines initial init request, issue, generated
  file, validation, and result contracts.
- `packages/core/src/types.ts` defines shared AEOS result, error, audit,
  verification, and handoff types.
- `@aeos/projects` exposes project root detection and project metadata readers.
- `@aeos/templates` exposes local template discovery, explicit selection,
  variable substitution, and render result validation.
- `@aeos/memory` exposes memory entry and storage helpers, but init must not
  persist memory in the MVP.
- Full render plans, target file writing, rollback, and init engine
  orchestration are not implemented yet.

## Execution Architecture
The engine lives at the orchestration boundary and does not absorb package
ownership.

- `core` owns stable init contracts and shared result shapes.
- `projects` owns project root detection and project metadata facts.
- `templates` owns local template discovery, selection, variable resolution,
  rendering, path validation, conflict checks, and safe generation helpers.
- `memory` owns future memory persistence helpers.
- CLI code owns argument parsing, output formatting, and exit codes.

Dependency direction must remain:

`core -> projects -> templates -> memory`

The engine should compose package APIs through narrow inputs and outputs. It
must not scan broad repository context, infer hidden state, install
dependencies, invoke agents, deploy, or automate GitHub.

## Input Contract
The MVP input contract should extend the current init request without changing
the CLI framework.

Required fields:

- `projectRoot`: caller-provided or CLI-resolved absolute target root.
- `templateId`: explicit local template id.
- `variables`: plain string key/value map.

Optional fields:

- `templatesRoot`: explicit local templates root.
- `requestedAt`: caller-supplied timestamp for reporting.
- `dryRun`: later scope only unless a dedicated task adds it.

The engine must reject missing project root, missing template id, malformed
variables, unknown variables, and empty required variable values with
structured init issues.

## Project Detection Stage
Project detection should be a read-only stage.

Responsibilities:

- resolve the requested project root;
- call `detectProjectRoot` or a focused adapter from `@aeos/projects`;
- read project metadata when a root is found;
- report markers and metadata as facts;
- convert expected detection failures into init issues.

Non-responsibilities:

- creating project files;
- creating `.aeos/`;
- scanning unrelated subdirectories;
- mutating `PROJECT_CONTEXT.md` or `AGENTS.md`.

## Template Selection Stage
Template selection should require an explicit local template id in the MVP.

Responsibilities:

- discover templates from the local templates root;
- select exactly one template with `selectTemplate`;
- surface discovery and selection issues in init issue format;
- preserve selected template metadata for variable and render stages.

The MVP excludes automatic category matching, remote templates, marketplace
lookup, and AI-generated template selection.

## Variable Resolution Stage
Variable resolution should produce a complete deterministic variable map before
rendering.

Responsibilities:

- compare caller variables with selected template metadata;
- require all required variables;
- apply declared optional defaults when available;
- reject unknown variables by default;
- reject empty required values;
- return variable names used in the final `InitResult`.

The MVP must not prompt interactively.

## Rendering Stage
Rendering should be side-effect free.

Responsibilities:

- read only files declared by selected template metadata;
- render text content with resolved variables;
- create a deterministic render plan;
- validate unresolved placeholders;
- validate duplicate targets and unsafe paths before writing.

Rendering must not create directories or files.

## File Writing Stage
File writing should apply only a validated render plan.

Responsibilities:

- precheck all target paths for conflicts;
- create required parent directories under the target root;
- write only declared planned files;
- record generated file summaries;
- fail before writes when blocking issues exist.

Default conflict policy:

- existing target files block generation;
- existing parent directories may be reused;
- overwrite, merge, backup, and force modes are later scope.

## Validation Stage
Validation should summarize engine correctness after preflight and generation.

Checks:

- project detection status;
- template discovery and selection status;
- variable resolution status;
- render plan status;
- path safety status;
- conflict status;
- generated file existence status;
- undeclared generation status.

The final status should be `pass`, `warn`, `fail`, or `skipped` using the
existing init validation vocabulary.

## Result Reporting Stage
The engine must return `InitResult` without formatting CLI text.

Result fields should include:

- `ok`;
- project root;
- selected template;
- variable names used;
- render input or render plan summary;
- generated files;
- validation summary;
- errors.

CLI output and JSON output are separate integrations over this result.

## Error Handling
Expected user-correctable failures should become structured init issues.

Expected failures include:

- missing project root;
- project root detection failure;
- missing templates root;
- missing template id;
- template not found;
- duplicate template id;
- missing required variables;
- unknown variables;
- unresolved placeholders;
- unsafe target paths;
- target file conflicts;
- post-write validation failures.

Unexpected filesystem or internal failures may throw only at package-private
boundaries, then must be converted by the engine entrypoint into a failed
`InitResult`.

## Rollback Strategy
The MVP should avoid partial writes by validating before generation.

Rollback policy:

- preflight all blocking conditions before writes;
- track every directory and file created during generation;
- if a write fails after generation starts, return a failed result with created
  file evidence;
- do not delete files automatically in the first MVP unless a dedicated
  rollback task defines exact safety rules.

Automatic rollback, backups, and overwrite recovery are later scope.

## Audit Integration
Init results should be audit-ready but must not write audit records in the MVP.

Audit-ready data:

- action: `init`;
- target root;
- template id;
- variable names only;
- planned file paths;
- generated file paths;
- conflicts;
- validation status;
- requested timestamp.

Durable audit persistence requires a later explicit task.

## Memory Integration
Init should expose memory-ready facts without writing memory entries.

Memory-ready data:

- selected template id;
- target root;
- generated files;
- validation summary;
- major warnings or failures.

Writing `.aeos/memory` is later scope and must use `@aeos/memory` policy and
storage helpers when added.

## CLI Integration
The CLI should remain thin.

Initial command shape:

`aeos init --path <project-root> --template <template-id> --var key=value`

CLI responsibilities:

- parse arguments using the existing command dispatcher style;
- build the init engine request;
- call the engine;
- render compact human output;
- map engine status to exit codes.

Do not choose or add a CLI framework in this plan.

## MVP Scope
- Engine request validation.
- Read-only project detection adapter.
- Local template discovery and explicit selection.
- Variable resolution against template metadata.
- Side-effect-free render plan creation.
- Path safety and conflict validation.
- Safe file writing from a validated plan.
- Post-generation validation summary.
- `InitResult` reporting.
- Audit-ready and memory-ready summaries without persistence.
- Thin CLI integration after engine behavior is stable.

## Later Scope
- Remote templates.
- Cloud execution.
- AI generated code.
- Deployment.
- GitHub automation.
- Multi-agent execution.
- Interactive prompting.
- Automatic template selection.
- Overwrite, merge, backup, or force policies.
- Automatic rollback deletion.
- JSON CLI output.
- Memory persistence.
- Audit persistence.
- Full verification runner integration.
- Binary file policy.
- Empty directory generation.

## Explicit Exclusions
- Remote templates.
- Cloud execution.
- AI generated code.
- Deployment.
- GitHub automation.
- Multi-agent execution.

## First 15 Implementation Tasks

### TASK-0109
- Task ID: TASK-0109
- Title: Implement init execution engine contracts.
- Purpose: Define engine-specific request, stage, issue mapping, render plan,
  write summary, and result contracts without executing generation.
- Likely files: `packages/core/src/init.ts`, `packages/core/src/types.ts`.
- Verification command: `pnpm --filter @aeos/core check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0110
- Task ID: TASK-0110
- Title: Add init engine request validation.
- Purpose: Validate project root, template id, templates root, variables, and
  supported options before package orchestration begins.
- Likely files: `packages/core/src/init.ts`.
- Verification command: `pnpm --filter @aeos/core check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0111
- Task ID: TASK-0111
- Title: Add init project detection stage.
- Purpose: Connect the engine to `@aeos/projects` root detection and metadata
  facts without duplicating project logic.
- Likely files: `packages/core/src/init.ts`, `packages/projects/src/index.ts`.
- Verification command: `pnpm --filter @aeos/core check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0112
- Task ID: TASK-0112
- Title: Add init template discovery stage.
- Purpose: Discover local templates from an explicit templates root and map
  discovery issues into init issues.
- Likely files: `packages/core/src/init.ts`, `packages/templates/src/index.ts`.
- Verification command: `pnpm --filter @aeos/core check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0113
- Task ID: TASK-0113
- Title: Add init template selection stage.
- Purpose: Select exactly one local template by explicit template id and carry
  selected metadata forward.
- Likely files: `packages/core/src/init.ts`, `packages/templates/src/selection.ts`.
- Verification command: `pnpm --filter @aeos/core check`.
- Recommended model effort: Low.
- Classification: Code.

### TASK-0114
- Task ID: TASK-0114
- Title: Add init variable resolution stage.
- Purpose: Resolve caller variables against template metadata, including
  required, defaulted, unknown, and empty-value cases.
- Likely files: `packages/core/src/init.ts`, `packages/templates/src/variable-resolver.ts`.
- Verification command: `pnpm --filter @aeos/core check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0115
- Task ID: TASK-0115
- Title: Define init render plan structure.
- Purpose: Represent declared source files, rendered content, target-relative
  paths, and render issues without writing files.
- Likely files: `packages/core/src/init.ts`, `packages/templates/src/renderer.ts`.
- Verification command: `pnpm --filter @aeos/core check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0116
- Task ID: TASK-0116
- Title: Implement init render planning.
- Purpose: Build a deterministic render plan from the selected local template
  and resolved variables.
- Likely files: `packages/core/src/init.ts`, `packages/templates/src/renderer.ts`.
- Verification command: `pnpm --filter @aeos/core check`.
- Recommended model effort: High.
- Classification: Code.

### TASK-0117
- Task ID: TASK-0117
- Title: Add init path safety checks.
- Purpose: Reject absolute paths, path traversal, duplicate targets, and
  undeclared render targets before writing.
- Likely files: `packages/core/src/init.ts`, `packages/templates/src/renderer.ts`.
- Verification command: `pnpm --filter @aeos/core check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0118
- Task ID: TASK-0118
- Title: Add init conflict preflight.
- Purpose: Detect existing target files and reusable parent directories before
  any generation starts.
- Likely files: `packages/core/src/init.ts`, `packages/templates/src/renderer.ts`.
- Verification command: `pnpm --filter @aeos/core check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0119
- Task ID: TASK-0119
- Title: Implement init file writing stage.
- Purpose: Write only validated planned files under the target root and report
  created files and directories.
- Likely files: `packages/core/src/init.ts`, `packages/templates/src/renderer.ts`.
- Verification command: `pnpm --filter @aeos/core check`.
- Recommended model effort: High.
- Classification: Code.

### TASK-0120
- Task ID: TASK-0120
- Title: Add init write failure reporting.
- Purpose: Convert partial write failures into failed `InitResult` values with
  created-file evidence and no automatic deletion.
- Likely files: `packages/core/src/init.ts`.
- Verification command: `pnpm --filter @aeos/core check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0121
- Task ID: TASK-0121
- Title: Add init post-generation validation.
- Purpose: Confirm generated files exist, undeclared files were not reported,
  and final validation status is deterministic.
- Likely files: `packages/core/src/init.ts`.
- Verification command: `pnpm --filter @aeos/core check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0122
- Task ID: TASK-0122
- Title: Add init audit and memory summaries.
- Purpose: Include audit-ready and memory-ready summary data in the engine
  result without persisting audit or memory records.
- Likely files: `packages/core/src/init.ts`, `packages/memory/src/index.ts`.
- Verification command: `pnpm --filter @aeos/core check`.
- Recommended model effort: Low.
- Classification: Code.

### TASK-0123
- Task ID: TASK-0123
- Title: Review init engine MVP behavior.
- Purpose: Review engine contracts, stage ordering, exclusions, rollback
  posture, and production stop conditions before CLI integration work.
- Likely files: `docs/INIT_ENGINE_IMPLEMENTATION_PLAN.md`, `TASKS/backlog.md`,
  `PROJECT_CONTEXT.md`.
- Verification command: `git status --short`.
- Recommended model effort: Medium.
- Classification: Docs.

## Stop Conditions Before Production Init
Do not treat init as production-ready until all are true:

- request validation is complete and covered by examples;
- project detection returns stable facts without writes;
- local template discovery and explicit selection are deterministic;
- variables resolve with structured issues;
- render planning is side-effect free;
- path safety blocks unsafe targets before writes;
- conflicts are detected before writes;
- generation writes only declared files;
- write failures return created-file evidence;
- post-generation validation reports `pass`, `warn`, `fail`, or `skipped`;
- audit and memory data are exposed but not persisted without policy tasks;
- CLI integration has a separate implementation task;
- remote templates remain excluded;
- cloud execution remains excluded;
- AI generated code remains excluded;
- deployment remains excluded;
- GitHub automation remains excluded;
- multi-agent execution remains excluded.
