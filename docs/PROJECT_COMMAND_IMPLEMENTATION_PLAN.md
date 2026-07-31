# AEOS Project Command Implementation Plan

## Purpose
Define the implementation plan for AEOS project CLI commands.

This plan describes how `apps/cli` should expose the existing and near-term
`@aeos/projects` capabilities without implementing command code in this task.

## Project CLI Goal
Provide a compact local CLI surface for inspecting the current AEOS project:

- `aeos project status`
- `aeos project root`
- `aeos project context`
- `aeos project validate`

The commands must be deterministic, side-effect free, and backed by
`@aeos/projects` helpers rather than duplicating project logic in the CLI.

## Non-goals
- Project generation.
- Template rendering.
- GitHub integration.
- Remote project registry.
- MCP project management.
- `aeos init`.
- Choosing or adding a CLI framework.
- Adding dependencies.
- Creating `.aeos/` implicitly.
- Modifying project package behavior during this planning task.

## Current Project Foundation Status
- `packages/projects/src/root-detector.ts` exposes project root detection,
  root lookup, and marker checks.
- Root detection currently treats any configured marker as sufficient:
  `package.json`, `pnpm-workspace.yaml`, `.git`, `AGENTS.md`, or
  `PROJECT_CONTEXT.md`.
- `packages/projects/src/metadata-reader.ts` reads package metadata, project
  context presence and project name, AGENTS presence, and workspace presence.
- `packages/projects/src/index.ts` exports the current project root and metadata
  helpers.
- `apps/cli/src/commands.ts` is the command dispatcher and already contains
  patterns for text output, JSON output, usage errors, and exit codes.
- No `aeos project ...` command routing exists yet.

## Project Command Architecture
`@aeos/projects` owns project facts and validation shape.

`apps/cli` owns argument routing, command-specific rendering, JSON output, and
exit codes. It should call package helpers through a narrow import and avoid
reading project files directly except through package APIs.

Recommended flow:

1. Parse `aeos project <subcommand>` in `apps/cli/src/commands.ts`.
2. Call a project command handler with the remaining args.
3. Resolve the project root from `process.cwd()`.
4. Read metadata through `@aeos/projects`.
5. Render compact human output.
6. Set non-zero exit codes only for command errors or failed validation.

## Project Root Flow
`aeos project root` should:

1. Start from the current working directory.
2. Call `detectProjectRoot(process.cwd())` or an equivalent public helper.
3. Print the absolute root path on success.
4. Print a compact not-found failure on failure.
5. Exit `0` on success and `1` when no project root is found.

The command must not scan subdirectories, create files, run Git, or infer remote
state.

## Project Metadata Flow
Project metadata should be read only after a root is resolved.

The MVP metadata display should include:

- project root;
- project name from `PROJECT_CONTEXT.md` when available;
- package name and version when available;
- `PROJECT_CONTEXT.md` presence;
- `AGENTS.md` presence;
- workspace marker presence.

Missing optional values should render as `unknown` or `missing`, not as
exceptions.

## Project Status Command Design
`aeos project status` is the default human summary for the current project.

Suggested output fields:

- `Project: <name-or-unknown>`
- `Root: <absolute-path>`
- `Package: <name-or-unknown>@<version-or-unknown>`
- `Context: present|missing`
- `Agents: present|missing`
- `Workspace: present|missing`
- `Status: pass|warn|fail`

MVP status should fail only when project root detection fails. It may report
warnings for missing expected metadata.

## Project Context Command Design
`aeos project context` should print concise project context metadata. The first
MVP can use the currently available project name and file path, then later tasks
can expand it to product, phase, priorities, relevant docs, completed tasks, and
next task after package readers expose those fields.

Suggested initial output:

- `Project Context`
- `Path: <PROJECT_CONTEXT.md path>`
- `Project: <name-or-unknown>`
- `Status: present|missing`

The command should exit `1` if no project root is found. Missing
`PROJECT_CONTEXT.md` under a detected root should be a validation-style warning
unless the package contract later defines it as fatal.

## Project Validation Command Design
`aeos project validate` should return pass/fail validation output using project
package facts.

Initial checks:

- project root can be detected;
- `PROJECT_CONTEXT.md` is present;
- `AGENTS.md` is present;
- package metadata is readable when `package.json` exists;
- workspace marker is reported, not required.

The command should print one issue per line and set exit code `1` when required
checks fail.

## JSON Output Future Support
Future JSON commands:

- `aeos project status --json`
- `aeos project context --json`

JSON output should be one line, serializable, and stable. It should include
`ok`, `reason`, `rootPath`, metadata fields, and issues where applicable.

Do not add JSON support before the human commands are implemented and checked.

## Error Handling
Use stable, compact reasons:

- `project_root_not_found`
- `start_path_not_found`
- `missing_project_context`
- `missing_agents`
- `metadata_read_failed`
- `unsupported_project_command`

Human output should explain the reason and show the relevant path when useful.
JSON output should use machine-readable reason strings.

## Verification Strategy
Each implementation task should run the narrowest relevant check:

- package-only changes: `pnpm --filter @aeos/projects check`;
- CLI-only changes: `pnpm --filter @aeos/cli check`;
- docs-only changes: `git status --short` plus requested file existence checks.

No task should deploy, push to Git, install dependencies, or run destructive
commands.

## MVP Scope
- Add CLI routing for `aeos project ...`.
- Implement human output for `status`, `root`, `context`, and `validate`.
- Keep package logic inside `@aeos/projects`.
- Keep CLI rendering compact and deterministic.
- Preserve existing root-level commands.
- Keep project commands side-effect free.

## Later Scope
- `aeos project status --json`.
- `aeos project context --json`.
- Expanded context field parsing.
- Richer validation issue objects.
- Integration with root-level `aeos status`.
- `aeos init` after stop conditions pass.
- Template, verification, audit, and policy integrations after their own plans.

## First 10 Project CLI Implementation Tasks

### TASK-0082
- Task ID: TASK-0082
- Title: Implement project status command core flow.
- Purpose: Add `aeos project status` routing and compact human output using
  current `@aeos/projects` root and metadata helpers.
- Likely files: `apps/cli/src/commands.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0083
- Task ID: TASK-0083
- Title: Add project root command.
- Purpose: Implement `aeos project root` with resolved root output and stable
  not-found handling.
- Likely files: `apps/cli/src/commands.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Low.
- Classification: Code.

### TASK-0084
- Task ID: TASK-0084
- Title: Add project context command.
- Purpose: Implement `aeos project context` with concise context path, project
  name, and presence output.
- Likely files: `apps/cli/src/commands.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0085
- Task ID: TASK-0085
- Title: Add project validate command.
- Purpose: Implement `aeos project validate` with pass/fail output for root,
  context, AGENTS, package metadata, and workspace facts.
- Likely files: `apps/cli/src/commands.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0086
- Task ID: TASK-0086
- Title: Add project command help text.
- Purpose: Update CLI help and unsupported subcommand output for the project
  command group.
- Likely files: `apps/cli/src/commands.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Low.
- Classification: Code.

### TASK-0087
- Task ID: TASK-0087
- Title: Extract project command render helpers.
- Purpose: Keep project command output consistent by extracting small local
  render helpers without changing package APIs.
- Likely files: `apps/cli/src/commands.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0088
- Task ID: TASK-0088
- Title: Add project command smoke notes.
- Purpose: Document manual smoke commands and expected high-level behavior for
  the four human project commands.
- Likely files: `docs/PROJECT_COMMAND_IMPLEMENTATION_PLAN.md`.
- Verification command: `git status --short`.
- Recommended model effort: Low.
- Classification: Docs.

### TASK-0089
- Task ID: TASK-0089
- Title: Add project status JSON plan checkpoint.
- Purpose: Review human status output and define the exact JSON shape before
  implementing `aeos project status --json`.
- Likely files: `docs/PROJECT_COMMAND_IMPLEMENTATION_PLAN.md`,
  `TASKS/backlog.md`, `PROJECT_CONTEXT.md`.
- Verification command: `git status --short`.
- Recommended model effort: Low.
- Classification: Docs.

### TASK-0090
- Task ID: TASK-0090
- Title: Implement project status JSON output.
- Purpose: Add one-line JSON output for `aeos project status --json` after the
  human status command is stable.
- Likely files: `apps/cli/src/commands.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0091
- Task ID: TASK-0091
- Title: Implement project context JSON output.
- Purpose: Add one-line JSON output for `aeos project context --json` after the
  human context command is stable.
- Likely files: `apps/cli/src/commands.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Medium.
- Classification: Code.

## Stop Conditions Before aeos init
- `aeos project status`, `root`, `context`, and `validate` work in human mode.
- Project command output is compact and stable.
- Project root detection failures return stable errors and exit codes.
- Project validation reports missing context and AGENTS files without writing
  them.
- JSON shapes for `status --json` and `context --json` are implemented or
  explicitly deferred with a follow-up task.
- No command creates `.aeos/` implicitly.
- No project generation has been added.
- No template rendering has been added.
- No GitHub integration has been added.
- No remote project registry has been added.
- No MCP project management has been added.
