# AEOS Init CLI Implementation Plan

## Purpose
Define the implementation plan for the user-facing `aeos init` CLI command.

This plan connects the existing init pipeline to a simple local command UX. It
does not implement CLI code, run init, generate projects, add dependencies, or
change package source.

## aeos init CLI Goal
`aeos init` should let a user trigger the existing local init pipeline from the
CLI with either guided interactive input or explicit flags.

MVP examples:

```sh
aeos init
aeos init --template project-default
aeos init --json
aeos init --dry-run
```

The command should preserve existing CLI conventions: thin command routing,
compact human output, one-line JSON output, explicit exit codes, and no new CLI
framework.

## Current Foundation Status
- `packages/core/src/init.ts` defines public init request, result, issue,
  generated file, and validation contracts.
- `packages/core/src/init-engine.ts` defines fixed init stage and pipeline
  execution shapes.
- `packages/core/src/init-pipeline.ts` exposes `runInitPipeline`,
  `createDefaultInitPipeline`, and handler creation helpers.
- `@aeos/projects` exposes project root detection and project metadata APIs.
- `@aeos/templates` exposes local template discovery, selection, variable
  resolution, rendering, and render validation APIs.
- `apps/cli/src/commands.ts` currently owns command dispatch, output helpers,
  JSON output calls, and exit-code mapping.
- Init CLI implementation is not present yet.

## Command UX Design
The MVP command shape should be:

```sh
aeos init [--template <template-id>] [--var key=value] [--dry-run] [--json]
```

Defaults:

- target project root is the current working directory;
- template selection is prompted in interactive mode when omitted;
- JSON mode must never prompt;
- dry run validates and reports the planned operation without file writes;
- human output uses compact sections.

Human output sections:

- `Init`
- `Target`
- `Template`
- `Variables`
- `Plan`
- `Generated`
- `Validation`
- `Summary`

## Interactive Flow
`aeos init` should:

1. resolve the current working directory as the target root;
2. discover local templates through the existing init pipeline adapters;
3. show available template IDs in a compact list;
4. prompt for one template when `--template` is omitted;
5. prompt for required variables declared by the selected template;
6. use declared defaults for optional variables;
7. show a confirmation summary before write-capable execution;
8. run the init pipeline only after confirmation;
9. print generated files, warnings, and validation status.

Interactive mode should be line-oriented and dependency-free. If stdin is not a
TTY, the command must fail with a user-correctable error unless enough explicit
flags were supplied.

## Non-interactive Flow
Non-interactive mode is selected when `--json` is present, stdin is not a TTY,
or all required inputs are supplied by flags.

Rules:

- require `--template` unless a later task adds a stable default policy;
- accept repeated `--var key=value`;
- do not prompt;
- return structured usage issues for missing template or variables;
- preserve the existing exit-code pattern.

## Flags Design
MVP flags:

- `--template <template-id>` selects one local template.
- `--var key=value` supplies one variable; may repeat.
- `--dry-run` reports planned work without writing files.
- `--json` emits one JSON line and disables prompts.
- `--help` prints init-specific usage.

Later flags:

- `--path <target-root>` for explicit target roots.
- `--yes` to skip confirmation in human mode.
- `--templates-root <path>` for explicit local template discovery.

Do not add aliases in the MVP.

## Template Selection UX
Template selection must stay local and explicit.

- If `--template project-default` is supplied, pass that ID to the init
  request.
- If interactive mode has no template flag, print discovered local template IDs
  and ask the user to enter one.
- If exactly one local template exists, still show it before confirmation.
- If no templates are discovered, fail with a clear `template_not_found` style
  issue.
- If multiple templates match the same ID, fail instead of guessing.

Excluded from template selection:

- remote execution;
- cloud projects;
- AI generated applications;
- deployment;
- GitHub automation;
- marketplace templates.

## Variable Input UX
Variable input should use simple string values.

- `--var key=value` adds a variable to the request.
- Missing `=` is a usage error.
- Empty required values are rejected.
- Unknown variables are rejected by the pipeline.
- Interactive prompts should show the variable name and default when present.
- JSON output must include variable names only, not secret-like values.

## Dry Run Mode
`aeos init --dry-run` should perform request parsing, project detection,
template selection, variable resolution, rendering, safety checks, and
validation reporting without writing files.

Dry run output should mark generated files as planned or skipped and clearly
state:

```text
Dry Run: yes
Files Written: 0
```

Dry run must not create directories, write memory, write audit records, run
deployment, install dependencies, or trigger Git operations.

## JSON Output Mode
`aeos init --json` should emit exactly one JSON object followed by a newline.

Suggested shape:

```json
{
  "ok": true,
  "reason": null,
  "projectRoot": "/path/to/project",
  "template": {
    "templateId": "project-default"
  },
  "variablesUsed": ["projectName"],
  "dryRun": false,
  "generatedFiles": [],
  "validation": {
    "status": "pass"
  },
  "errors": []
}
```

JSON mode must not print human sections, progress prompts, or confirmation
questions.

## Error Handling
Expected failures should map to user-correctable messages and exit code `1`.

Examples:

- unknown init option;
- missing flag value;
- malformed `--var`;
- missing template in non-interactive mode;
- template not found;
- missing required variables;
- unsafe target path;
- target file conflict;
- validation failure.

Unexpected filesystem or internal failures should map to exit code `2` with a
compact error message or JSON reason.

## Safety Rules
- Do not run remote execution.
- Do not create cloud projects.
- Do not generate applications with AI.
- Do not deploy.
- Do not automate GitHub.
- Do not use marketplace templates.
- Do not install dependencies.
- Do not write outside the resolved target root.
- Do not overwrite existing files by default.
- Do not write memory or audit records in the CLI MVP.
- Do not run generated project commands.

## Confirmation Strategy
Human write-capable mode should ask for confirmation after preflight and before
file writes.

The confirmation summary should include:

- target root;
- template ID;
- variable names used;
- dry-run state;
- planned files count;
- conflict count;
- validation status.

`--dry-run` and `--json` must not ask for confirmation. A later `--yes` flag may
skip confirmation once the command behavior is stable.

## Rollback Strategy
The CLI should rely on the pipeline and template package to preflight all
blocking conditions before writes.

MVP rollback policy:

- avoid partial writes through full preflight;
- report any files created before an unexpected write failure;
- do not automatically delete generated files;
- do not create backups;
- do not overwrite or merge.

Automatic rollback is later scope and requires a dedicated safety design.

## Verification Reporting
Human output should summarize:

- whether init succeeded;
- target root;
- selected template;
- generated or planned file count;
- validation status;
- warning and failure codes.

JSON output should expose the `InitResult` fields plus CLI-only metadata such as
`dryRun` and normalized `reason`.

Exit codes:

- `0`: success, including validation `pass` or `warn`;
- `1`: user-correctable failure;
- `2`: unexpected filesystem or internal failure.

## MVP Scope
- Add `init` routing to the existing command dispatcher.
- Add init-specific help text.
- Parse `--template`, `--var`, `--dry-run`, and `--json`.
- Add local interactive prompts without dependencies.
- Build an `InitRequest` for `runInitPipeline`.
- Support non-interactive failure behavior.
- Support dry-run reporting without writes.
- Support one-line JSON output.
- Print compact human output.
- Map result status to exit codes.

## Later Scope
- `--path <target-root>`.
- `--templates-root <path>`.
- `--yes`.
- richer prompt validation;
- automatic template recommendations;
- overwrite, merge, backup, and rollback policies;
- memory persistence;
- audit persistence;
- generated project verification runners;
- remote templates;
- marketplace templates.

## First 15 CLI Init Implementation Tasks

1. TASK-0122: Implement aeos init command routing.
   - Task ID: TASK-0122
   - Title: Implement aeos init command routing.
   - Purpose: Add `init` to the CLI dispatcher and route to a placeholder
     handler without running the pipeline yet.
   - Likely files: `apps/cli/src/commands.ts`.
   - Verification command: `pnpm --filter @aeos/cli check`.
   - Recommended model effort: Low.
   - Classification: Code.
2. TASK-0123: Add init help text.
   - Task ID: TASK-0123
   - Title: Add init help text.
   - Purpose: Add top-level and init-specific usage for `aeos init`.
   - Likely files: `apps/cli/src/commands.ts`.
   - Verification command: `pnpm --filter @aeos/cli check`.
   - Recommended model effort: Low.
   - Classification: Code.
3. TASK-0124: Parse init boolean flags.
   - Task ID: TASK-0124
   - Title: Parse init boolean flags.
   - Purpose: Parse `--json` and `--dry-run` with unknown-option handling.
   - Likely files: `apps/cli/src/commands.ts`.
   - Verification command: `pnpm --filter @aeos/cli check`.
   - Recommended model effort: Low.
   - Classification: Code.
4. TASK-0125: Parse init template flag.
   - Task ID: TASK-0125
   - Title: Parse init template flag.
   - Purpose: Parse `--template <template-id>` and report missing values.
   - Likely files: `apps/cli/src/commands.ts`.
   - Verification command: `pnpm --filter @aeos/cli check`.
   - Recommended model effort: Low.
   - Classification: Code.
5. TASK-0126: Parse init variable flags.
   - Task ID: TASK-0126
   - Title: Parse init variable flags.
   - Purpose: Parse repeated `--var key=value` inputs into a string map.
   - Likely files: `apps/cli/src/commands.ts`.
   - Verification command: `pnpm --filter @aeos/cli check`.
   - Recommended model effort: Medium.
   - Classification: Code.
6. TASK-0127: Add init JSON error output.
   - Task ID: TASK-0127
   - Title: Add init JSON error output.
   - Purpose: Emit one-line JSON for usage and input failures.
   - Likely files: `apps/cli/src/commands.ts`.
   - Verification command: `pnpm --filter @aeos/cli check`.
   - Recommended model effort: Low.
   - Classification: Code.
7. TASK-0128: Add init human error output.
   - Task ID: TASK-0128
   - Title: Add init human error output.
   - Purpose: Print compact human errors and usage for invalid init input.
   - Likely files: `apps/cli/src/commands.ts`.
   - Verification command: `pnpm --filter @aeos/cli check`.
   - Recommended model effort: Low.
   - Classification: Code.
8. TASK-0129: Load core init pipeline from CLI.
   - Task ID: TASK-0129
   - Title: Load core init pipeline from CLI.
   - Purpose: Add a dynamic loader for the built core init pipeline exports.
   - Likely files: `apps/cli/src/commands.ts`.
   - Verification command: `pnpm --filter @aeos/cli check`.
   - Recommended model effort: Medium.
   - Classification: Code.
9. TASK-0130: Build init request from CLI input.
   - Task ID: TASK-0130
   - Title: Build init request from CLI input.
   - Purpose: Convert parsed CLI input into an `InitRequest` using the current
     working directory as project root.
   - Likely files: `apps/cli/src/commands.ts`.
   - Verification command: `pnpm --filter @aeos/cli check`.
   - Recommended model effort: Medium.
   - Classification: Code.
10. TASK-0131: Implement non-interactive init execution.
    - Task ID: TASK-0131
    - Title: Implement non-interactive init execution.
    - Purpose: Run `runInitPipeline` when required flags are present and no
      prompting is needed.
    - Likely files: `apps/cli/src/commands.ts`.
    - Verification command: `pnpm --filter @aeos/cli check`.
    - Recommended model effort: Medium.
    - Classification: Code.
11. TASK-0132: Add init human result output.
    - Task ID: TASK-0132
    - Title: Add init human result output.
    - Purpose: Print compact `Init`, `Target`, `Template`, `Generated`,
      `Validation`, and `Summary` sections.
    - Likely files: `apps/cli/src/commands.ts`.
    - Verification command: `pnpm --filter @aeos/cli check`.
    - Recommended model effort: Medium.
    - Classification: Code.
12. TASK-0133: Add init JSON success output.
    - Task ID: TASK-0133
    - Title: Add init JSON success output.
    - Purpose: Emit stable one-line JSON for successful init results.
    - Likely files: `apps/cli/src/commands.ts`.
    - Verification command: `pnpm --filter @aeos/cli check`.
    - Recommended model effort: Medium.
    - Classification: Code.
13. TASK-0134: Implement init dry-run CLI behavior.
    - Task ID: TASK-0134
    - Title: Implement init dry-run CLI behavior.
    - Purpose: Wire `--dry-run` into the request or pipeline options and ensure
      no files are written.
    - Likely files: `apps/cli/src/commands.ts`,
      `packages/core/src/init.ts`, `packages/core/src/init-pipeline.ts`.
    - Verification command: `pnpm --filter @aeos/cli check`.
    - Recommended model effort: High.
    - Classification: Code.
14. TASK-0135: Add init interactive prompts.
    - Task ID: TASK-0135
    - Title: Add init interactive prompts.
    - Purpose: Prompt for missing template and required variables in TTY human
      mode without adding dependencies.
    - Likely files: `apps/cli/src/commands.ts`.
    - Verification command: `pnpm --filter @aeos/cli check`.
    - Recommended model effort: High.
    - Classification: Code.
15. TASK-0136: Review init CLI MVP behavior.
    - Task ID: TASK-0136
    - Title: Review init CLI MVP behavior.
    - Purpose: Verify command examples, JSON shape, dry-run behavior, exit
      codes, and safety exclusions.
    - Likely files: `docs/INIT_CLI_IMPLEMENTATION_PLAN.md`,
      `apps/cli/src/commands.ts`.
    - Verification command: `git status --short`.
    - Recommended model effort: Medium.
    - Classification: Code/docs.

## Stop Conditions Before Production Init
- `aeos init --dry-run` proves no files are written.
- `aeos init --json` emits exactly one JSON line.
- Missing template and missing variables fail without prompting in JSON mode.
- Existing target file conflicts block generation by default.
- Path traversal and absolute template targets are rejected.
- Interactive mode confirms before write-capable execution.
- No memory, audit, deployment, dependency install, GitHub, cloud, remote, or
  marketplace behavior is triggered.
- CLI check passes.
