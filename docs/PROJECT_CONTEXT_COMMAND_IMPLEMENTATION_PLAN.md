# AEOS Project Context Command Implementation Plan

## Purpose
Define the implementation plan for `aeos project context`.

This command exposes project-level context information from local
`@aeos/projects` metadata capabilities. It is a read-only CLI command and must
not modify project files.

## Project Context Command Goal
`aeos project context` should give a compact human-readable summary of the
current project's context metadata.

The MVP command should answer:

- where the project root is;
- where `PROJECT_CONTEXT.md` is expected;
- whether `PROJECT_CONTEXT.md` exists;
- what project name can be read from it;
- which adjacent local project metadata is available.

Future JSON output should expose the same facts as stable machine-readable
fields.

## Difference Between aeos context and aeos project context
`aeos context` is the global AEOS operating-context command. It should describe
the current AEOS agent/session context and task-facing instructions.

`aeos project context` is the project metadata command. It should describe the
local repository's project context using `@aeos/projects` facts.

The commands must remain separate. `aeos project context` must not become a
general context bundle builder, task context loader, memory search command, or
template renderer.

## Current Project Foundation Status
- `packages/projects/src/root-detector.ts` can detect a project root from the
  current working path using known markers.
- `packages/projects/src/metadata-reader.ts` can read package metadata,
  `PROJECT_CONTEXT.md` presence and project name, `AGENTS.md` presence, and
  workspace marker presence.
- `packages/projects/src/index.ts` exports the root detector and metadata
  reader APIs.
- `apps/cli/src/commands.ts` already routes `aeos project status` and
  `aeos project status --json`.
- The CLI currently imports the built `@aeos/projects` artifact dynamically.
- No `aeos project context` handler exists in the current CLI source.

## Context Data Sources
MVP data sources are limited to existing `@aeos/projects` metadata:

- detected project root;
- `PROJECT_CONTEXT.md` path;
- `PROJECT_CONTEXT.md` existence;
- project name parsed from the `Project:` line;
- package name and package version;
- `AGENTS.md` presence;
- workspace marker presence.

Excluded data sources:

- project modification state;
- project initialization state;
- rendered templates;
- remote project state;
- GitHub integration;
- MCP integration.

## Project Metadata Flow
1. CLI receives `aeos project context`.
2. CLI resolves the start path from `getCwd()`.
3. CLI calls `detectProjectRoot(startPath)`.
4. If root detection fails, CLI prints a compact error and exits `1`.
5. CLI calls `readProjectMetadata(rootPath)`.
6. CLI renders context metadata from the returned object.
7. CLI exits `0` when the root is found, even if `PROJECT_CONTEXT.md` is
   missing, unless a later package contract makes that fatal.

The CLI should not parse `PROJECT_CONTEXT.md` directly in the MVP.

## Output Design
Output must be deterministic, compact, and easy to scan.

Fields should use `unknown` for missing optional string values and
`present|missing` for boolean file facts.

Do not include task context, memory entries, remote status, Git state, generated
templates, or inferred workflow state.

## Human Output Design
MVP command:

```text
Project Context

Root:
<absolute-project-root>

Path:
<absolute-project-context-path>

Project:
<project-name-or-unknown>

Status:
present|missing

Agents:
present|missing

Workspace:
present|missing
```

Root detection failure:

```text
Project Context
Error: project_root_not_found
Path: <start-path>
```

## JSON Future Output
Future command:

```text
aeos project context --json
```

Proposed success shape:

```json
{"ok":true,"rootPath":"","contextPath":"","projectName":"","projectContextPresent":true,"agentsPresent":true,"workspacePresent":true}
```

Proposed failure shape:

```json
{"ok":false,"reason":"project_root_not_found","startPath":""}
```

JSON output should be one line and should not be implemented until the human
command is stable.

## Error Handling
Use stable reason strings:

- `project_root_not_found`
- `start_path_not_found`
- `metadata_read_failed`
- `unsupported_project_command`

Missing `PROJECT_CONTEXT.md` under a detected root should render as `missing`
for the MVP. It should not create the file, initialize the project, or fail
unless a later validation command defines that behavior.

## Verification Strategy
Use the narrowest checks for each implementation task:

- CLI implementation: `pnpm --filter @aeos/cli check`
- Project package changes, only if explicitly assigned later:
  `pnpm --filter @aeos/projects check`
- Docs-only planning changes: `git status --short` plus targeted file checks

Smoke checks after implementation should cover:

- `aeos project context`
- `aeos project context --json` only after JSON support is assigned
- root-not-found behavior from a directory without project markers

## MVP Scope
- Add `aeos project context` routing.
- Use existing `@aeos/projects` metadata helpers.
- Render compact human output.
- Preserve separation from global `aeos context`.
- Keep command read-only and side-effect free.

## Later Scope
- Add `aeos project context --json`.
- Expand context metadata after package readers expose additional
  `PROJECT_CONTEXT.md` fields.
- Add explicit project context validation issues.
- Share small local render helpers across project commands if duplication grows.
- Integrate with broader project validation only after separate plans.

## First 10 Implementation Tasks

### TASK-0085
- Task ID: TASK-0085
- Title: Implement project context command.
- Purpose: Add `aeos project context` routing and compact human output using
  existing `@aeos/projects` metadata.
- Likely files: `apps/cli/src/commands.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0086
- Task ID: TASK-0086
- Title: Add project context usage errors.
- Purpose: Handle unsupported flags and extra arguments for
  `aeos project context` without changing other project commands.
- Likely files: `apps/cli/src/commands.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Low.
- Classification: Code.

### TASK-0087
- Task ID: TASK-0087
- Title: Add project context smoke notes.
- Purpose: Document expected human output and root-not-found smoke commands.
- Likely files: `docs/PROJECT_CONTEXT_COMMAND_IMPLEMENTATION_PLAN.md`.
- Verification command: `git status --short`.
- Recommended model effort: Low.
- Classification: Docs.

### TASK-0088
- Task ID: TASK-0088
- Title: Review project context human output.
- Purpose: Verify the command remains compact, deterministic, and separate
  from global `aeos context`.
- Likely files: `docs/PROJECT_CONTEXT_COMMAND_IMPLEMENTATION_PLAN.md`,
  `TASKS/backlog.md`, `PROJECT_CONTEXT.md`.
- Verification command: `git status --short`.
- Recommended model effort: Low.
- Classification: Docs.

### TASK-0089
- Task ID: TASK-0089
- Title: Define project context JSON contract.
- Purpose: Freeze the one-line JSON success and failure shapes before
  implementation.
- Likely files: `docs/PROJECT_CONTEXT_COMMAND_IMPLEMENTATION_PLAN.md`,
  `TASKS/backlog.md`, `PROJECT_CONTEXT.md`.
- Verification command: `git status --short`.
- Recommended model effort: Low.
- Classification: Docs.

### TASK-0090
- Task ID: TASK-0090
- Title: Implement project context JSON output.
- Purpose: Add `aeos project context --json` using stable fields from
  `@aeos/projects`.
- Likely files: `apps/cli/src/commands.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0091
- Task ID: TASK-0091
- Title: Add project context JSON error output.
- Purpose: Ensure root detection failures return stable machine-readable JSON
  reasons and exit code `1`.
- Likely files: `apps/cli/src/commands.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Low.
- Classification: Code.

### TASK-0092
- Task ID: TASK-0092
- Title: Add project context metadata field plan.
- Purpose: Define later package-reader fields for product, phase, priorities,
  relevant docs, completed tasks, and next task.
- Likely files: `docs/PROJECT_CONTEXT_COMMAND_IMPLEMENTATION_PLAN.md`,
  `TASKS/backlog.md`, `PROJECT_CONTEXT.md`.
- Verification command: `git status --short`.
- Recommended model effort: Medium.
- Classification: Docs.

### TASK-0093
- Task ID: TASK-0093
- Title: Extend project context metadata reader.
- Purpose: Add typed `PROJECT_CONTEXT.md` field extraction in
  `@aeos/projects` after the field plan is approved.
- Likely files: `packages/projects/src/metadata-reader.ts`,
  `packages/projects/src/index.ts`.
- Verification command: `pnpm --filter @aeos/projects check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0094
- Task ID: TASK-0094
- Title: Render expanded project context fields.
- Purpose: Display approved expanded context fields in human and JSON project
  context output.
- Likely files: `apps/cli/src/commands.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Medium.
- Classification: Code.

## Stop Conditions Before Project Update Commands
- `aeos project context` works in human mode.
- `aeos project context --json` has a stable contract and implementation.
- Project context output stays separate from global `aeos context`.
- Missing `PROJECT_CONTEXT.md` is reported without creating or modifying files.
- No project modification command has been added.
- No project initialization command has been added.
- No template rendering has been added.
- No remote project state has been added.
- No GitHub integration has been added.
- No MCP integration has been added.
