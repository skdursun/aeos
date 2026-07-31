# AEOS Project MVP Implementation Plan

## Purpose
Define the Project MVP implementation sequence for AEOS.

This plan covers how AEOS detects, inspects, initializes, and manages
project-level metadata before deeper template, verification, and agent
orchestration workflows.

## Project MVP Goal
Provide a local, deterministic `@aeos/projects` foundation and CLI surface that
can identify an AEOS project root, read concise project context, validate
project metadata expectations, and report project status without scanning the
whole repository.

MVP project commands:

- `aeos project status`
- `aeos project root`
- `aeos project context`
- `aeos project validate`

## Non-goals
- Do not implement full template rendering.
- Do not implement GitHub integration.
- Do not implement MCP integration.
- Do not implement external agent orchestration.
- Do not implement vector memory.
- Do not implement a remote project registry.
- Do not choose a project storage backend.
- Do not add dependencies.
- Do not create `.aeos/` during this planning work.
- Do not expand project commands beyond the MVP set until stop conditions pass.

## Current AEOS Foundation Status
- `apps/cli` already supports root-level `status`, `context`, `task validate`,
  `remember`, `search`, `version`, and `help` commands.
- `apps/cli/src/commands.ts` is the current command dispatcher.
- `@aeos/projects` currently exposes only `packageName` from
  `packages/projects/src/index.ts`.
- `@aeos/projects` has TypeScript build and check scripts.
- Existing CLI memory flows may use `.aeos/memory`, but Project MVP must not
  create or depend on hidden project state before the directory strategy is
  explicitly implemented.

## Project Package Responsibilities
`@aeos/projects` should own reusable project behavior:

- resolve the current project root from a starting directory;
- detect required root files such as `PROJECT_CONTEXT.md` and `AGENTS.md`;
- read concise project context fields used by status and handoff flows;
- validate project metadata presence and shape;
- describe `.aeos/` expectations without creating storage implicitly;
- return serializable success and failure results for CLI rendering.

`apps/cli` should stay thin:

- parse `aeos project ...` arguments;
- call public `@aeos/projects` helpers;
- format compact text or future JSON output;
- set stable exit codes.

## Project Detection Flow
1. Start from the current working directory unless a future flag supplies a
   start path.
2. Walk upward toward the filesystem root.
3. Treat a directory as an AEOS project candidate when `PROJECT_CONTEXT.md` is
   present.
4. Check for `AGENTS.md` as an expected operating-rules companion file.
5. Report missing expected files as validation issues, not as automatic writes.
6. Stop at the first valid candidate and do not scan unrelated subdirectories.

## Project Root Resolution
Root resolution should be deterministic and side-effect free.

- Input: starting directory.
- Output on success: absolute project root path and detected marker files.
- Output on failure: structured reason such as `project_root_not_found`.
- No writes, template rendering, dependency installs, Git operations, or
  external calls.

## Project Metadata Strategy
Project MVP metadata should initially come from existing root documents:

- `PROJECT_CONTEXT.md` for current project name, product, phase, priorities,
  relevant docs, completed tasks, and next task.
- `AGENTS.md` for local agent operating rules.
- `.aeos/` as a future structured metadata directory, described but not required
  for the first detector.

The MVP should not pick a durable storage backend. It should expose small typed
records that can later be backed by Markdown, JSON, YAML, or another local
format after a separate decision.

## PROJECT_CONTEXT.md Integration
`@aeos/projects` should provide a narrow reader for the current context fields
needed by CLI output:

- project;
- product;
- current phase;
- current priorities;
- relevant docs;
- recent completed tasks;
- next task.

The reader should tolerate missing optional sections and preserve concise
failure messages for malformed or missing required fields. It must not encourage
loading all docs or scanning the repository.

## AGENTS.md Integration
Project validation should check whether `AGENTS.md` exists at the resolved root.

MVP behavior should only report whether the file is present and may include a
short status label. It should not parse every instruction into a policy engine
yet and should not rewrite the file.

## .aeos/ Directory Strategy
Project MVP should treat `.aeos/` as reserved local AEOS state.

For this phase:

- `aeos project status` may report whether `.aeos/` exists.
- `aeos project validate` may warn when `.aeos/` is absent if future state is
  expected.
- No command should create `.aeos/` until an explicit init/storage task.
- No hidden metadata schema is chosen in this plan.

## aeos status Integration
The existing `aeos status` command can remain root-level while Project MVP adds
project-specific commands.

After project package helpers exist, a later CLI task may make `aeos status`
include a compact project summary by delegating to `@aeos/projects`. That change
must preserve existing output expectations or update smoke checks in the same
task.

## aeos init Future Flow
Future `aeos init` should:

1. Resolve or confirm the target root.
2. Detect existing `PROJECT_CONTEXT.md`, `AGENTS.md`, `TASKS/`, `docs/`, and
   `.aeos/` state.
3. Select `project-default` or `generic` only when template work exists.
4. Preview declared files and validation checks.
5. Require approval before overwrites or risky actions.
6. Create only declared files.
7. Run template verification.
8. Return a compact handoff report.

This flow is a placeholder. It must not be implemented before Project MVP and
Template MVP stop conditions are met.

## Template Integration Placeholder
Project MVP should expose project detection and validation outputs that future
template rendering can consume.

Template integration is limited to metadata shape alignment. Full template
rendering, overwrite policy, variable prompting, and generated file writes are
out of scope here.

## Verification Integration Placeholder
Project MVP should return validation issues in a shape that can later feed AEOS
verification reports.

The MVP does not implement the verification runner. It only provides project
checks that can be smoke-tested through TypeScript and CLI command output.

## Audit Integration Placeholder
Project MVP should avoid audit persistence until the audit package owns durable
event writing.

Future project commands may emit audit-ready summaries containing action,
project root, files inspected, warnings, and final status. They must not write
audit records until the audit integration task is explicit.

## MVP Scope
- Implement project root detection in `@aeos/projects`.
- Implement project context reading in `@aeos/projects`.
- Implement project validation in `@aeos/projects`.
- Add CLI routing for `aeos project ...`.
- Add compact text output for project status, root, context, and validate.
- Keep all project behavior local, deterministic, dependency-free, and
  side-effect free.

## Later Scope
- `aeos init`
- `aeos project scan`
- `aeos project update-context`
- `aeos project template`
- Template rendering after Template MVP begins.
- Policy-gated overwrites.
- Verification runner integration.
- Audit persistence.
- MCP or external agent integration.
- Remote or organization-level project registry.

## First 12 Project Implementation Tasks

### TASK-0077
- Task ID: TASK-0077
- Title: Implement project package root detector.
- Purpose: Add a side-effect-free helper that resolves an AEOS project root from
  a starting directory using `PROJECT_CONTEXT.md` as the marker.
- Likely files: `packages/projects/src/index.ts`.
- Verification command: `pnpm --filter @aeos/projects check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0078
- Task ID: TASK-0078
- Title: Add project root detector edge cases.
- Purpose: Cover missing start directory, root-not-found, and nested directory
  behavior with deterministic result values.
- Likely files: `packages/projects/src/index.ts`.
- Verification command: `pnpm --filter @aeos/projects check`.
- Recommended model effort: Low.
- Classification: Code.

### TASK-0079
- Task ID: TASK-0079
- Title: Add project context field reader.
- Purpose: Read concise fields from `PROJECT_CONTEXT.md` for project, product,
  phase, priorities, relevant docs, completed tasks, and next task.
- Likely files: `packages/projects/src/index.ts`.
- Verification command: `pnpm --filter @aeos/projects check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0080
- Task ID: TASK-0080
- Title: Add project context validation issues.
- Purpose: Return structured validation issues for missing or malformed project
  context fields without rewriting context files.
- Likely files: `packages/projects/src/index.ts`.
- Verification command: `pnpm --filter @aeos/projects check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0081
- Task ID: TASK-0081
- Title: Add project AGENTS presence check.
- Purpose: Report whether `AGENTS.md` exists at the detected root as an expected
  local operating-rules file.
- Likely files: `packages/projects/src/index.ts`.
- Verification command: `pnpm --filter @aeos/projects check`.
- Recommended model effort: Low.
- Classification: Code.

### TASK-0082
- Task ID: TASK-0082
- Title: Add project .aeos status check.
- Purpose: Report `.aeos/` presence or absence without creating it or choosing a
  storage schema.
- Likely files: `packages/projects/src/index.ts`.
- Verification command: `pnpm --filter @aeos/projects check`.
- Recommended model effort: Low.
- Classification: Code.

### TASK-0083
- Task ID: TASK-0083
- Title: Add project status summary helper.
- Purpose: Combine root, context, AGENTS, and `.aeos/` checks into one compact
  serializable project status result.
- Likely files: `packages/projects/src/index.ts`.
- Verification command: `pnpm --filter @aeos/projects check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0084
- Task ID: TASK-0084
- Title: Add CLI project command dispatcher.
- Purpose: Route `aeos project status`, `root`, `context`, and `validate`
  without changing root-level command behavior.
- Likely files: `apps/cli/src/commands.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0085
- Task ID: TASK-0085
- Title: Implement aeos project root command.
- Purpose: Print the resolved project root or a stable not-found error.
- Likely files: `apps/cli/src/commands.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Low.
- Classification: Code.

### TASK-0086
- Task ID: TASK-0086
- Title: Implement aeos project context command.
- Purpose: Print concise `PROJECT_CONTEXT.md` fields through
  `@aeos/projects` without loading unrelated files.
- Likely files: `apps/cli/src/commands.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0087
- Task ID: TASK-0087
- Title: Implement aeos project validate command.
- Purpose: Print pass/fail project validation output with structured issue
  labels for missing root files or context fields.
- Likely files: `apps/cli/src/commands.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0088
- Task ID: TASK-0088
- Title: Review Project MVP command behavior.
- Purpose: Review project package and CLI command output, stop conditions, and
  backlog context before starting Template MVP work.
- Likely files: `docs/PROJECT_MVP_IMPLEMENTATION_PLAN.md`,
  `TASKS/backlog.md`, `PROJECT_CONTEXT.md`.
- Verification command: `git status --short`.
- Recommended model effort: Medium.
- Classification: Docs.

## Stop Conditions Before Template MVP
- `@aeos/projects` can resolve the project root without side effects.
- `@aeos/projects` can read concise `PROJECT_CONTEXT.md` fields.
- `@aeos/projects` can report `AGENTS.md` and `.aeos/` status.
- `aeos project status`, `root`, `context`, and `validate` are implemented and
  checked.
- CLI output is compact and stable.
- No project command creates `.aeos/` implicitly.
- No storage backend has been chosen.
- No full template rendering, GitHub integration, MCP integration, external
  agent orchestration, vector memory, or remote registry has been added.
