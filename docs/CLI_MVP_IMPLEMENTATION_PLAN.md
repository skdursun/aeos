# AEOS CLI MVP Implementation Plan

## Purpose
Define the first practical CLI implementation sequence for AEOS after the core
foundation review.

This plan narrows the broad CLI map into a small MVP command set, keeps the CLI
thin, and splits the work into fresh Codex CLI tasks with explicit verification.

## CLI MVP Goal
Provide a local, dependency-free `aeos` command that can report project status,
show task context guidance, validate task-shaped input through `@aeos/core`, and
print version/help output.

The MVP should prove command parsing, concise terminal output, core helper use,
and smoke-testable behavior before adding a CLI framework or wider commands.

## Non-goals
- Do not implement task execution, agent orchestration, memory writes, audit
  persistence, project initialization, or verification runners.
- Do not add provider, model, MCP, or external tool integration.
- Do not choose or install a CLI framework.
- Do not add dependencies.
- Do not move durable behavior into `apps/cli`.
- Do not expand beyond the MVP commands until stop conditions are satisfied.

## Current Core Foundation Status
- `packages/core/src/index.ts` exports shared types and helper modules through
  the public `@aeos/core` entrypoint.
- Available core foundations include result helpers, task validation helpers,
  memory validation helpers, policy decision helpers, audit event helpers, and
  verification report helpers.
- `apps/cli` currently exposes only a placeholder package constant.
- The CLI package already has TypeScript build/check scripts and should remain
  dependency-free for the first CLI tasks.

## CLI Design Principles
- Use plain Node.js `process.argv` for initial command parsing.
- Keep commands deterministic and local.
- Keep CLI code responsible for parsing, dispatch, output formatting, and exit
  codes only.
- Delegate validation and normalized result behavior to `@aeos/core`.
- Keep output compact and stable enough for smoke tests.
- Prefer explicit subcommands over hidden automation.
- Treat missing files, invalid commands, and validation failures as structured
  command errors.
- Avoid broad repository scanning.

## MVP Command Set
- `aeos status`
- `aeos context`
- `aeos task validate`
- `aeos version` or `aeos --version`
- `aeos help` or `aeos --help`

## Command Implementation Order
1. `aeos version` and `aeos --version`
2. `aeos help` and `aeos --help`
3. Unknown command and exit-code handling
4. `aeos status`
5. `aeos context`
6. `aeos task validate`

## How CLI Uses @aeos/core
- Import only from the public `@aeos/core` entrypoint.
- Use core result helpers for command success and failure normalization.
- Use task validation helpers for `aeos task validate`.
- Use core exported task, policy, audit, and verification types only as public
  contracts where command output needs stable shapes.
- Keep file reading and terminal rendering in `apps/cli`; keep reusable
  validation and result semantics in `@aeos/core`.
- If a needed helper is missing, create a small core task before expanding CLI
  behavior instead of implementing reusable domain logic inside the CLI.

## Error Handling Approach
- Return exit code `0` for successful commands.
- Return exit code `1` for command usage errors, missing required arguments, or
  validation failures.
- Return exit code `2` for unexpected internal errors.
- Print normal command output to stdout.
- Print errors to stderr with a compact `Error: <message>` format.
- Keep error messages stable and specific for smoke tests.

## Verification Approach
- Run package-level TypeScript checks for CLI changes.
- Use direct Node smoke commands against the built CLI output.
- Verify each command's stdout, stderr, and exit code.
- Keep smoke checks local and deterministic.
- Do not run repository-wide tests unless the task explicitly asks for them.

## No-Dependency Rule For First CLI Tasks
The first CLI implementation tasks must not add runtime or dev dependencies.

The CLI should use:
- Node.js `process.argv` for argument parsing.
- Existing TypeScript configuration.
- Existing package scripts.
- Public `@aeos/core` exports only.

## Future CLI Dependency Decision Placeholder
A later decision may choose a CLI framework after the MVP proves the command
shape.

That decision should compare dependency cost, TypeScript ESM support, help text
generation, subcommand ergonomics, testability, and packaging impact. Until that
decision is recorded, CLI framework work is out of scope.

## First 12 CLI Implementation Tasks

### TASK-0038
- Title: Implement minimal CLI entrypoint and version command.
- Purpose: Replace the placeholder CLI export with a plain `process.argv`
  entrypoint that supports `aeos version` and `aeos --version`.
- Likely files to modify: `apps/cli/src/index.ts`, `apps/cli/package.json` if a
  bin field is explicitly needed.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Medium.
- Type: Code.

### TASK-0039
- Title: Add CLI help output.
- Purpose: Add `aeos help` and `aeos --help` with compact MVP command usage.
- Likely files to modify: `apps/cli/src/index.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Low.
- Type: Code.

### TASK-0040
- Title: Add CLI command dispatcher.
- Purpose: Split plain argv parsing into a small dispatcher that can route root,
  one-level, and two-level MVP commands.
- Likely files to modify: `apps/cli/src/index.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Medium.
- Type: Code.

### TASK-0041
- Title: Add CLI error and exit-code handling.
- Purpose: Normalize usage errors, unknown commands, validation failures, and
  unexpected errors into stable stderr output and exit codes.
- Likely files to modify: `apps/cli/src/index.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Medium.
- Type: Code.

### TASK-0042
- Title: Add CLI smoke check script notes.
- Purpose: Document the exact local commands future tasks should use to smoke
  test CLI stdout, stderr, and exit codes without adding dependencies.
- Likely files to modify: `docs/CLI_MVP_IMPLEMENTATION_PLAN.md`,
  `TASKS/backlog.md`.
- Verification command: `test -f docs/CLI_MVP_IMPLEMENTATION_PLAN.md`.
- Recommended model effort: Low.
- Type: Docs.

### TASK-0043
- Title: Implement status command skeleton.
- Purpose: Add `aeos status` with static local project output before richer
  project context parsing.
- Likely files to modify: `apps/cli/src/index.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Medium.
- Type: Code.

### TASK-0044
- Title: Wire status command to project context file.
- Purpose: Read `PROJECT_CONTEXT.md` when present and print project, phase, and
  next task fields using local parsing.
- Likely files to modify: `apps/cli/src/index.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Medium.
- Type: Code.

### TASK-0045
- Title: Implement context command skeleton.
- Purpose: Add `aeos context` with compact guidance about required task context
  and no repository-wide scanning.
- Likely files to modify: `apps/cli/src/index.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Medium.
- Type: Code.

### TASK-0046
- Title: Add context task flag parsing.
- Purpose: Support `aeos context --task <task-id>` and validate missing or
  malformed task IDs with stable usage errors.
- Likely files to modify: `apps/cli/src/index.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Medium.
- Type: Code.

### TASK-0047
- Title: Implement task validate command shell.
- Purpose: Add `aeos task validate` command routing with required argument and
  help behavior before binding core validation.
- Likely files to modify: `apps/cli/src/index.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Medium.
- Type: Code.

### TASK-0048
- Title: Bind task validate to core helpers.
- Purpose: Use public `@aeos/core` task validation helpers to validate a task
  contract file and print compact pass/fail output.
- Likely files to modify: `apps/cli/src/index.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: High.
- Type: Code.

### TASK-0049
- Title: Review CLI MVP command consistency.
- Purpose: Review MVP command output, errors, exit codes, and core import
  boundaries before expanding the CLI.
- Likely files to modify: `docs/CLI_MVP_IMPLEMENTATION_PLAN.md`,
  `TASKS/backlog.md`, `PROJECT_CONTEXT.md`.
- Verification command: `git status --short`.
- Recommended model effort: Medium.
- Type: Docs.

## Stop Conditions Before Expanding CLI
- The five MVP commands work through plain `process.argv`.
- CLI checks and smoke commands are documented and passing.
- Command output and exit codes are stable.
- `apps/cli` imports reusable behavior only through public `@aeos/core` exports.
- No CLI framework or new dependency has been added.
- Any need for broader project parsing, task contract parsing, or richer context
  generation has been split into separate core/package tasks.
