# AEOS Init Implementation Plan

## Purpose
Define the implementation plan for the future `aeos init` workflow.

This plan connects the existing project detection, template discovery,
template selection, variable rendering, validation, memory context, audit-ready
summaries, and CLI patterns into a local project initialization flow.

## aeos init Goal
`aeos init` should initialize a project from a selected local template using
explicit caller input.

MVP input:

- project location;
- selected template;
- variables.

MVP process:

1. detect project;
2. select template;
3. resolve variables;
4. render output;
5. validate result.

MVP output:

- generated project structure;
- validation report.

## Current Foundation Status
- `@aeos/projects` provides project root detection and project metadata reading.
- `aeos project status`, `aeos project context`, and `aeos project validate`
  already define compact CLI output and JSON patterns.
- `@aeos/templates` provides local template discovery from an explicit root.
- `@aeos/templates` provides explicit template selection by template ID.
- `@aeos/templates` currently renders string content with variable
  substitution and render validation.
- `@aeos/memory` exposes local memory write and search helpers under
  `.aeos/memory`.
- `apps/cli/src/commands.ts` is the current command dispatcher and should stay
  thin.
- File generation from full render plans is not implemented yet.
- Init workflow contracts are not implemented yet.

## Init Architecture
Keep init as orchestration, not ownership of every subsystem.

- `@aeos/projects` owns project location detection and project metadata facts.
- `@aeos/templates` owns template discovery, selection, variable resolution,
  rendering, path safety, conflict checks, and file generation helpers.
- `@aeos/memory` owns any future local memory context writes.
- `apps/cli` owns argument parsing, human output, JSON output, and exit codes.
- Future audit integration should consume init summaries but should not be
  required for the MVP.

The orchestration boundary must preserve this sequence:

`project -> template -> rendering -> validation`

## Project Detection Flow
1. Accept an explicit project location or default to the current working
   directory.
2. Resolve the location to an absolute target root.
3. Detect existing project markers through `@aeos/projects`.
4. Report existing `PROJECT_CONTEXT.md`, `AGENTS.md`, `TASKS/`, `docs/`,
   `.aeos/`, `package.json`, and workspace marker state.
5. Treat missing files as facts or validation issues, not automatic writes.
6. Do not scan unrelated subdirectories.
7. Do not create `.aeos/` during detection.

## Template Selection Flow
1. Accept an explicit local templates root.
2. Discover direct child templates through `@aeos/templates`.
3. Require an explicit template ID for the MVP.
4. Select exactly one template with `selectTemplate`.
5. Return stable issues for missing, duplicate, or ambiguous template matches.
6. Keep `project-default` and `generic` as initial template targets.
7. Do not implement automatic category-based selection in the MVP.

## Variable Resolution Flow
1. Accept variables as plain string key/value pairs from the CLI layer.
2. Validate variables against selected template metadata.
3. Require every declared required variable.
4. Apply metadata defaults for optional variables when available.
5. Reject unknown variables by default.
6. Reject empty required values.
7. Return structured issues instead of throwing for expected validation
   failures.
8. Do not prompt interactively in the MVP.

## Rendering Flow
1. Read only files declared by selected template metadata.
2. Map source files to target-relative output paths.
3. Render text content using the resolved variables.
4. Build a deterministic render plan.
5. Validate every target path before any write.
6. Report unresolved placeholders, duplicate targets, path traversal, absolute
   paths, and undeclared files as issues.
7. Do not write files during render plan creation.

## File Generation Strategy
File generation must apply a validated render plan under an explicit target
root.

- Write only declared files from the render plan.
- Derive parent directories from file targets.
- Create parent directories only during generation.
- Refuse absolute target paths.
- Refuse path traversal outside the target root.
- Refuse undeclared target files.
- Validate the full plan before writing any file.
- Return created file and directory summaries for CLI output and audit-ready
  reporting.

## Conflict Handling
MVP conflict behavior is conservative.

- Existing target files produce `target_file_exists` issues.
- Existing directories may be reused only as parent directories.
- Overwrite is refused by default.
- Partial writes should be avoided by checking all conflicts before generation.
- Force, merge, backup, and interactive overwrite policies are later scope.

## Validation After Init
After generation, init should return a validation report containing:

- project detection status;
- template discovery and selection status;
- variable resolution status;
- render plan validation status;
- conflict check status;
- generated file existence checks;
- undeclared file generation checks;
- final `pass`, `warn`, or `fail` status.

The MVP may run package-level validation helpers only. It should not introduce a
new verification runner.

## Memory Context Integration
Init should prepare memory context facts without requiring memory persistence in
the first automation task.

MVP behavior:

- include the selected template ID, target root, generated file list, and
  validation summary in the init result;
- expose enough data for a future `remember`-style entry;
- avoid writing `.aeos/memory` unless a later explicit task adds that policy.

Later behavior may write a concise initialization memory entry after generation
succeeds and user-visible policy allows it.

## Audit Integration
Init results should be audit-ready before audit persistence exists.

Audit-ready fields:

- action: `init`;
- target root;
- template ID;
- variables used by name only;
- files planned;
- files generated;
- conflicts;
- validation status;
- timestamp supplied by caller or CLI.

The MVP must not write audit records until a dedicated audit package or command
task defines durable audit behavior.

## CLI UX Design
Initial human command shape:

`aeos init --path <project-location> --template <template-id> --var key=value`

MVP CLI behavior:

- require explicit template ID;
- accept repeated `--var key=value` values;
- default path to current working directory only after contracts exist;
- print compact preflight and result sections;
- set exit code `0` on successful generation and validation pass or warn;
- set exit code `1` for user-correctable input, detection, selection,
  variable, conflict, or validation failures;
- set exit code `2` for unexpected filesystem or internal failures.

Suggested human output sections:

- `Init`
- `Target`
- `Template`
- `Variables`
- `Generated`
- `Validation`
- `Summary`

Do not choose a new CLI framework.

## JSON Future Support
Future JSON output should be one line and stable:

`aeos init --path <project-location> --template <template-id> --var key=value --json`

Suggested JSON fields:

- `ok`;
- `reason`;
- `targetRoot`;
- `templateId`;
- `variables`;
- `plannedFiles`;
- `generatedFiles`;
- `validation`;
- `issues`.

JSON support should follow the existing CLI pattern after the human MVP works.

## MVP Scope
- Define init workflow contracts.
- Add side-effect-free init preflight orchestration.
- Connect project detection to template selection.
- Connect selected template metadata to variable resolution.
- Build render plan integration.
- Add target conflict integration.
- Add safe file generation orchestration after preflight passes.
- Add post-generation validation summary.
- Add compact human CLI output.
- Keep all behavior local, deterministic, and dependency-free.

## Later Scope
- Interactive prompting.
- Automatic template selection.
- Category or runtime filters.
- Overwrite policies.
- Dry-run command mode.
- JSON output.
- Memory persistence.
- Audit persistence.
- Full verification runner integration.
- Rich template conditions.
- Binary file policy.
- Empty directory generation.

## Explicit Exclusions
- Remote templates.
- Marketplace.
- Cloud execution.
- AI generated projects.
- Deployment.
- GitHub automation.
- Dependency installation.
- CLI framework changes.

## First 15 Init Implementation Tasks

### TASK-0106
- Task ID: TASK-0106
- Title: Implement init workflow contracts.
- Purpose: Define typed init request, result, issue, and summary contracts
  without executing generation.
- Likely files: `packages/templates/src/index.ts`, `packages/templates/src/init-workflow.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0107
- Task ID: TASK-0107
- Title: Add init request validation.
- Purpose: Validate target path, template ID, templates root, and variable map
  shape before any project or template work.
- Likely files: `packages/templates/src/init-workflow.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0108
- Task ID: TASK-0108
- Title: Add init project detection adapter.
- Purpose: Accept project detection facts from `@aeos/projects` without
  duplicating root detection inside the template package.
- Likely files: `packages/templates/src/init-workflow.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0109
- Task ID: TASK-0109
- Title: Add init template selection adapter.
- Purpose: Connect discovered templates and explicit template ID selection into
  the init preflight result.
- Likely files: `packages/templates/src/init-workflow.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0110
- Task ID: TASK-0110
- Title: Add init variable resolution step.
- Purpose: Resolve caller variables against selected template metadata and map
  variable issues into init issues.
- Likely files: `packages/templates/src/init-workflow.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0111
- Task ID: TASK-0111
- Title: Add init render planning step.
- Purpose: Produce an init render plan summary from selected template files and
  resolved variables without writing files.
- Likely files: `packages/templates/src/init-workflow.ts`, `packages/templates/src/renderer.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0112
- Task ID: TASK-0112
- Title: Add init path safety validation.
- Purpose: Validate planned output paths are relative, declared, unique, and
  inside the target root.
- Likely files: `packages/templates/src/init-workflow.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0113
- Task ID: TASK-0113
- Title: Add init conflict detection.
- Purpose: Detect existing target files and return deterministic conflict
  issues before generation.
- Likely files: `packages/templates/src/init-workflow.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0114
- Task ID: TASK-0114
- Title: Add init safe generation step.
- Purpose: Apply a validated render plan under the target root only when there
  are no blocking issues.
- Likely files: `packages/templates/src/init-workflow.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: High.
- Classification: Code.

### TASK-0115
- Task ID: TASK-0115
- Title: Add init post-generation validation.
- Purpose: Confirm generated files exist and no undeclared files were reported
  as generated.
- Likely files: `packages/templates/src/init-workflow.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0116
- Task ID: TASK-0116
- Title: Add init audit-ready summary.
- Purpose: Return action, target root, template ID, variable names, file
  summaries, conflicts, and validation status without writing audit records.
- Likely files: `packages/templates/src/init-workflow.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Low.
- Classification: Code.

### TASK-0117
- Task ID: TASK-0117
- Title: Add init memory-ready summary.
- Purpose: Return concise initialization facts that a later task can persist
  through `@aeos/memory`.
- Likely files: `packages/templates/src/init-workflow.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Low.
- Classification: Code.

### TASK-0118
- Task ID: TASK-0118
- Title: Add aeos init CLI routing.
- Purpose: Add command dispatch and usage handling for `aeos init` without
  changing the CLI framework.
- Likely files: `apps/cli/src/commands.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0119
- Task ID: TASK-0119
- Title: Add aeos init human output.
- Purpose: Render compact target, template, generated file, validation, and
  summary sections for successful and failed init runs.
- Likely files: `apps/cli/src/commands.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0120
- Task ID: TASK-0120
- Title: Review init MVP behavior.
- Purpose: Review command behavior, stop conditions, exclusions, and handoff
  output before JSON, memory persistence, or audit persistence work begins.
- Likely files: `docs/INIT_IMPLEMENTATION_PLAN.md`, `TASKS/backlog.md`, `PROJECT_CONTEXT.md`.
- Verification command: `git status --short`.
- Recommended model effort: Medium.
- Classification: Docs.

## Stop Conditions Before Full Automation
Do not proceed beyond the local MVP until all are true:

- project detection returns stable facts for target roots;
- local template discovery and explicit selection are stable;
- variables are resolved with structured issues;
- render plans are deterministic and side-effect free;
- path safety validation rejects unsafe targets;
- conflicts are reported before any writes;
- generation writes only declared files;
- post-generation validation reports pass, warn, or fail;
- CLI human output is compact and deterministic;
- JSON output has a separate contract task;
- memory persistence has a separate policy task;
- audit persistence has a separate policy task;
- overwrite policy has a separate approval task;
- remote, marketplace, cloud, AI generation, deployment, and GitHub automation
  remain excluded.
