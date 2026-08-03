# AEOS Init Write Mode Usage

## Purpose
Document the current MVP behavior for `aeos init` dry-run and explicit write
mode.

`aeos init` prepares the minimal AEOS project artifact. Write mode exists so the
CLI can create that artifact only when the operator explicitly requests
filesystem writes.

## Commands
### `aeos init`
Default dry-run mode.

- Writes no files.
- Uses the current working directory as the target root.
- Reports the generated file plan.
- Reports `AGENTS.md` as `planned` when it can be generated.
- Exits `0` when planning succeeds.

### `aeos init --json`
Default dry-run mode with machine-readable output.

- Writes no files.
- Emits exactly one JSON object.
- Uses the current working directory as the target root.
- Exits `0` when planning succeeds.

### `aeos init --write`
Explicit write mode with human output.

- Enables filesystem writes only because `--write` was passed.
- Uses the current working directory as the target root.
- Creates `AGENTS.md` when it does not already exist.
- Does not overwrite an existing `AGENTS.md`.
- Exits nonzero when a conflict blocks writing.

### `aeos init --write --json`
Explicit write mode with machine-readable output.

- Enables filesystem writes only because `--write` was passed.
- Emits exactly one JSON object.
- Uses the current working directory as the target root.
- Creates `AGENTS.md` when it does not already exist.
- Reports conflicts as structured JSON and exits nonzero when writing is
  blocked.

## Current MVP Behavior
The MVP generated file is:

- `AGENTS.md`

The target root is the resolved current working directory. The command does not
select a parent repository root, accept an alternate path, run project commands,
install dependencies, write memory, persist audit records, deploy, or perform
Git operations.

## Dry-Run Behavior
Dry-run is the default. `aeos init` and `aeos init --json` plan generation and
run safety checks without creating directories or files.

Dry-run output may report `AGENTS.md` as `planned`. That status means the file
could be generated; it does not mean the file was written.

## Write Behavior
Write mode requires `--write`. In write mode the CLI asks the init pipeline to
use the filesystem generation adapter for the current working directory.

When the target is safe and `AGENTS.md` does not already exist, the generated
file is written and reported as `created`.

## Overwrite Behavior
Overwrite is disabled in the MVP.

- There is no `--force` flag.
- There is no merge mode.
- There is no backup-and-replace mode.
- An existing `AGENTS.md` is not overwritten.
- A target conflict blocks the write attempt and exits nonzero.

## JSON Output Shape
JSON output is one object followed by a newline.

```json
{
  "ok": true,
  "mode": "write",
  "writeEnabled": true,
  "status": "success",
  "targetRoot": "/path/to/current-directory",
  "generatedFiles": [
    {
      "path": "AGENTS.md",
      "status": "created",
      "summary": "AEOS agent instructions",
      "sourcePath": "default/AGENTS.md"
    }
  ],
  "conflicts": [],
  "errors": [],
  "stages": [
    "project_detection",
    "template_selection",
    "variable_resolution",
    "rendering",
    "file_writing",
    "validation"
  ],
  "artifacts": [
    {
      "path": "AGENTS.md",
      "status": "created",
      "summary": "AEOS agent instructions",
      "sourcePath": "default/AGENTS.md"
    }
  ]
}
```

Field notes:

- `ok` is `true` only when the requested mode completes successfully.
- `mode` is `dry_run` or `write`.
- `writeEnabled` mirrors whether `--write` was requested.
- `status` is `success`, `blocked`, or `failure`.
- `targetRoot` is the resolved current working directory.
- `generatedFiles` contains generated artifact paths and statuses.
- `conflicts` contains blocking filesystem conflicts.
- `errors` contains init or CLI errors.
- `stages` and `artifacts` are included on successful output.

## Human Output Summary
Human output includes:

- `Mode`
- `Write enabled`
- `Target root`
- `Status`
- `Stages`
- `Artifacts`
- `Generated files`
- `Generated files count`
- `Conflicts count`
- `Errors count`
- `Errors` when errors are present

## Exit Code Behavior
- Successful dry-run exits `0`.
- Successful write exits `0`.
- Unknown init options exit nonzero.
- Existing target conflicts exit nonzero.
- Write mode that completes without creating a writable artifact exits nonzero.
- Other init failures exit nonzero.

## Safety Guarantees
- Dry-run mode writes no files.
- Filesystem writes require explicit `--write`.
- Writes are scoped to the resolved current working directory.
- Existing `AGENTS.md` is not overwritten.
- Conflicts block the write attempt.
- JSON mode emits structured output without human progress text.
- The command does not install dependencies, deploy, push to Git, or run
  generated project commands.

## Known MVP Limitations
- Only `AGENTS.md` is generated.
- There is no alternate target-root flag.
- There is no overwrite, force, merge, or backup mode.
- There is no automatic rollback.
- There is no audit persistence.
- There is no memory persistence.
- There are no remote templates or marketplace templates.
- There are no project-specific post-generation hooks.

## Later Scope
- Additional generated project files.
- Explicit target-root selection.
- Designed overwrite or merge modes.
- Backup and rollback behavior.
- Audit and memory persistence.
- Remote or marketplace templates.
- Project-specific validation hooks.
