# AEOS Init Write Mode CLI Design

## Purpose
Define the CLI design for enabling filesystem-backed `aeos init` generation
behind explicit, safe user intent.

This is a design-only document. It does not implement CLI write mode, core
write behavior, package changes, deployment, Git automation, rollback, audit
persistence, overwrite behavior, or new dependencies.

## Design Goal
`aeos init` remains safe by default. The CLI may prepare and report a generation
plan without writing files, and it may write generated files only when the user
passes an explicit write flag.

MVP command shape:

```sh
aeos init [--json] [--write]
```

The proposed write flag is:

```sh
--write
```

## Default Behavior
`aeos init` remains dry-run/no-write.

Rules:

- default mode is `dry_run`;
- no directories are created;
- no files are written;
- no memory records are written;
- no audit records are persisted;
- no generated project commands are run;
- no dependencies are installed;
- no Git operations are performed.

## Write Mode Behavior
`aeos init --write` selects write-capable mode.

Rules:

- write mode requires the explicit `--write` flag;
- CLI passes generation intent to the init pipeline as `write`;
- CLI must use the filesystem generation adapter only for write-capable mode;
- all planning, path safety checks, and conflict checks run before writes;
- any blocking safety issue stops before file writes;
- generated files are created only under the resolved target root;
- existing files are never overwritten.

## Overwrite Policy
Overwrite remains disabled in the MVP.

Rules:

- no overwrite flag in the MVP;
- no `--force` flag in the MVP;
- no merge behavior in the MVP;
- no backup-and-replace behavior in the MVP;
- target file conflicts block the whole write attempt before writes begin.

Overwrite requires a separate design and task sequence.

## Target Root Behavior
The target root is the resolved current working directory.

Rules:

- `aeos init` uses the process current working directory as `targetRoot`;
- `aeos init --write` writes only under that resolved `targetRoot`;
- there is no `--path` or alternate target-root flag in this MVP;
- path containment must be enforced by core generation and the filesystem
  adapter;
- generated output reports the resolved target root.

## Current Directory Behavior
The command runs against the current directory exactly as invoked.

Rules:

- the CLI must not search for a different write destination;
- the CLI must not silently switch to a parent repository root for generation;
- if project detection reports a different root than the current working
  directory, the CLI should report the mismatch as a safety stop until a later
  target-root design exists;
- JSON output must include the same target root used by the pipeline.

## Confirmation Behavior
Human write mode requires confirmation.

Rules:

- `aeos init --write` in human mode must show a preflight summary before
  writing;
- confirmation summary includes mode, target root, planned files, conflicts,
  errors, and validation status when available;
- the accepted confirmation is an exact `yes`;
- any other answer cancels without writing and exits nonzero;
- dry-run mode does not prompt;
- JSON mode does not prompt.

No `--yes` flag is included in the MVP.

## Non-Interactive Behavior
Non-interactive mode must be conservative.

Rules:

- `--json` is non-interactive and must never prompt;
- stdin without a TTY must not prompt;
- `aeos init --write` without a TTY and without `--json` fails before writes;
- `aeos init --write --json` may run without confirmation only after all
  required inputs are explicit and all safety checks pass;
- missing template or variable inputs remain user-correctable failures.

## JSON Output Behavior
`--json` emits exactly one JSON object followed by a newline.

Rules:

- no human sections;
- no progress text;
- no confirmation questions;
- no secret-like variable values;
- conflicts and errors are structured arrays;
- generated files include path, status, summary, and optional source path.

## Output Shape
Human output must include:

- `Mode`;
- `Status`;
- `Target Root`;
- `Generated Files`;
- `Conflicts`;
- `Errors`.

JSON output must include:

```json
{
  "ok": true,
  "mode": "dry_run",
  "status": "success",
  "targetRoot": "/path/to/project",
  "generatedFiles": [
    {
      "path": "PROJECT_CONTEXT.md",
      "status": "planned",
      "summary": "Project context file",
      "sourcePath": "template/PROJECT_CONTEXT.md"
    }
  ],
  "conflicts": [],
  "errors": []
}
```

Field rules:

- `ok` is `true` only when the requested mode completed successfully;
- `mode` is `dry_run` or `write`;
- `status` is `success`, `blocked`, `cancelled`, or `failure`;
- `targetRoot` is the resolved generation root;
- `generatedFiles` mirrors core generated file status values;
- `conflicts` contains blocking target conflicts when available;
- `errors` contains structured init or CLI issues.

## Command Examples
### `aeos init`
Dry-run mode. Plans generation and reports files as planned or blocked. Writes
zero files.

Expected human shape:

```text
AEOS Init

Mode:
dry_run

Status:
success

Target Root:
/path/to/project

Generated Files:
- planned PROJECT_CONTEXT.md

Conflicts:
0

Errors:
0
```

### `aeos init --json`
Dry-run JSON mode. Emits one JSON object and writes zero files.

Expected JSON shape:

```json
{"ok":true,"mode":"dry_run","status":"success","targetRoot":"/path/to/project","generatedFiles":[],"conflicts":[],"errors":[]}
```

### `aeos init --write`
Human write mode. Runs preflight, asks for confirmation, and writes only after
the user enters `yes`.

Expected pre-confirmation shape:

```text
AEOS Init

Mode:
write

Status:
ready

Target Root:
/path/to/project

Generated Files:
- planned PROJECT_CONTEXT.md

Conflicts:
0

Errors:
0

Write generated files? Type yes to continue:
```

Expected completion shape:

```text
AEOS Init

Mode:
write

Status:
success

Target Root:
/path/to/project

Generated Files:
- created PROJECT_CONTEXT.md

Conflicts:
0

Errors:
0
```

### `aeos init --write --json`
Non-interactive write mode. Emits one JSON object, never prompts, and writes
only if inputs and preflight checks are complete and safe.

Expected JSON shape:

```json
{"ok":true,"mode":"write","status":"success","targetRoot":"/path/to/project","generatedFiles":[{"path":"PROJECT_CONTEXT.md","status":"created","summary":"Project context file"}],"conflicts":[],"errors":[]}
```

## Exit Code Behavior
Exit codes:

- `0`: requested mode completed successfully;
- `1`: user-correctable failure, blocked write, cancelled confirmation, usage
  error, missing input, conflict, or validation failure;
- `2`: unexpected internal or filesystem failure.

Dry-run conflicts should exit `1` when they make the planned init invalid.
Write-mode conflicts must exit `1` and write zero files.

## Error And Conflict Reporting
Human output:

- show each conflict as `- <code>: <message> (<path>)`;
- show each error as `- <code>: <message> (<path>)`;
- omit path parentheses when no path exists;
- keep messages compact and user-correctable.

JSON output:

- `conflicts` is always an array;
- `errors` is always an array;
- each issue includes `code`, `message`, optional `path`, and optional
  `details`;
- conflict paths must be target-root relative where possible;
- no rendered file content is included.

## Smoke Test Requirements
Smoke coverage should prove safety before convenience.

Required smoke checks:

- `aeos init` exits with the current dry-run behavior and does not change files;
- `aeos init --json` emits one valid JSON object and does not change files;
- `aeos init --write` in a non-interactive smoke run fails before writes;
- `aeos init --write --json` preserves JSON-only output;
- unknown init options still fail with structured errors;
- conflicts block `--write` before any file is written;
- isolated temp-root checks compare file listings before and after dry-run;
- write-mode success checks use a temp root and verify created files are exactly
  the planned files.

## Rollback Non-Goal
Automatic rollback is not part of the MVP.

Rules:

- prevent partial writes through complete preflight;
- if an unexpected write failure occurs, report created files and failing path;
- do not automatically delete generated files;
- do not create backups;
- do not overwrite or merge.

Rollback requires a separate deletion safety contract.

## Audit Placeholder
The MVP may expose audit-ready facts but must not persist audit records.

Audit-ready facts:

- mode;
- target root;
- template ID and optional version;
- planned file count;
- created file count;
- blocked file count;
- conflict count;
- error codes;
- validation status.

Audit persistence is later scope.

## Safety Stop Conditions
Write mode must stop before writes when any of these conditions is present:

- unknown option;
- missing required non-interactive input;
- stdin is non-interactive for human `--write`;
- confirmation answer is not exactly `yes`;
- target root cannot be resolved;
- current directory and detected project root do not match;
- target path resolves outside target root;
- duplicate target path;
- target file exists;
- target path is a directory;
- parent path is a file;
- path inspection fails;
- symbolic link is encountered in a target or parent path;
- render validation fails;
- generated file plan is unavailable;
- overwrite would be required;
- filesystem adapter reports an error before writes.

## Implementation Sequence
1. TASK-0139: Implement aeos init --write flag skeleton.
   Purpose: Accept `--write` as a parsed init option without enabling writes.
   Likely files: `apps/cli/src/commands.ts`,
   `apps/cli/scripts/smoke.mjs`.
   Verification: `pnpm --filter @aeos/cli check`; CLI smoke confirms
   `--write` is recognized but remains blocked or dry-run-only.
   Recommended model effort: Low.

2. TASK-0140: Add init mode output contract.
   Purpose: Include `mode` in human and JSON init output while preserving
   dry-run default behavior.
   Likely files: `apps/cli/src/commands.ts`,
   `apps/cli/scripts/smoke.mjs`.
   Verification: `pnpm --filter @aeos/cli check`; smoke validates `mode`.
   Recommended model effort: Low.

3. TASK-0141: Add target root output contract.
   Purpose: Report the resolved target root consistently in human and JSON
   output.
   Likely files: `apps/cli/src/commands.ts`,
   `apps/cli/scripts/smoke.mjs`.
   Verification: `pnpm --filter @aeos/cli check`; smoke validates target root
   shape.
   Recommended model effort: Low.

4. TASK-0142: Add init conflict output shape.
   Purpose: Add structured conflict arrays to JSON output and compact conflict
   lines to human output without changing core behavior.
   Likely files: `apps/cli/src/commands.ts`,
   `apps/cli/scripts/smoke.mjs`.
   Verification: `pnpm --filter @aeos/cli check`; smoke validates conflicts are
   arrays.
   Recommended model effort: Medium.

5. TASK-0143: Wire write mode to pipeline options behind a safety block.
   Purpose: Route explicit write intent through CLI mode plumbing while keeping
   actual filesystem writes disabled until confirmation and adapter wiring are
   implemented.
   Likely files: `apps/cli/src/commands.ts`.
   Verification: `pnpm --filter @aeos/cli check`; `git status --short`.
   Recommended model effort: Medium.

6. TASK-0144: Add human write confirmation gate.
   Purpose: Require exact `yes` confirmation before write-capable execution in
   TTY human mode.
   Likely files: `apps/cli/src/commands.ts`,
   `apps/cli/scripts/smoke.mjs`.
   Verification: `pnpm --filter @aeos/cli check`; smoke validates
   non-interactive `--write` fails before writes.
   Recommended model effort: Medium.

7. TASK-0145: Add filesystem adapter construction for init write mode.
   Purpose: Create the filesystem generation adapter only after explicit write
   intent passes CLI safety gates.
   Likely files: `apps/cli/src/commands.ts`.
   Verification: `pnpm --filter @aeos/cli check`; targeted CLI smoke in a temp
   root.
   Recommended model effort: High.

8. TASK-0146: Add write-mode conflict smoke tests.
   Purpose: Prove existing target files block writes and leave temp-root file
   listings unchanged.
   Likely files: `apps/cli/scripts/smoke.mjs`.
   Verification: `pnpm --filter @aeos/cli check`; CLI smoke.
   Recommended model effort: Medium.

9. TASK-0147: Add write-mode success smoke tests.
   Purpose: Verify `aeos init --write --json` creates only planned files in an
   isolated temp root when preflight is clean.
   Likely files: `apps/cli/scripts/smoke.mjs`.
   Verification: `pnpm --filter @aeos/cli check`; CLI smoke.
   Recommended model effort: High.

10. TASK-0148: Review init write mode MVP behavior.
    Purpose: Review safety, output, exit codes, and smoke coverage before any
    overwrite or rollback design begins.
    Likely files: `docs/INIT_WRITE_MODE_CLI_DESIGN.md`,
    `TASKS/backlog.md`, `PROJECT_CONTEXT.md`.
    Verification: `git status --short`.
    Recommended model effort: Medium.
