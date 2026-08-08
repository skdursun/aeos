# Task Plan Input Parser Usage

## Purpose
Document the implemented MVP behavior for the AEOS task plan input parser.

The parser reads one explicit local JSON task-plan input file, performs path,
format, parse, optional validation, and optional mapping-handoff checks, then
returns a structured result. It is a parser and handoff boundary only.

## Current MVP Behavior
- Local files only.
- `.json` files are accepted.
- Unsupported extensions are rejected.
- Missing files are rejected.
- Directory input is rejected.
- Parent traversal is denied by default.
- Files outside the working directory are denied by default.
- Absolute paths are denied by default unless options explicitly allow them.
- A maximum file size is supported before reading file contents.
- Invalid JSON is rejected with the deterministic parse message
  `Invalid JSON.`
- Non-object JSON is rejected when `requireJsonObject` is enabled.

## What The Parser Does
- Resolves the requested path relative to `currentWorkingDirectory`.
- Checks the real file path stays inside the real working directory.
- Checks that the path exists and is a regular file.
- Checks file size against `maxFileSizeBytes` when provided.
- Reads supported JSON files as UTF-8 text.
- Parses JSON deterministically.
- Optionally requires the parsed JSON root to be an object.
- Optionally hands parsed values to AEOS task validation.
- Optionally creates a mapping handoff result.
- Returns structured `pathCheck`, `parse`, `validation`, `mapping`, `issues`,
  and `summary` fields.

## What The Parser Does Not Do
- It does not create files.
- It does not modify files.
- It does not delete files.
- It does not create directories.
- It does not run runner planning.
- It does not run `planAgenticRunner()`.
- It does not run task execution.
- It does not call model, agent, tool, MCP, policy, audit, verifier, or runner
  adapters.
- It does not write audit events.
- It does not run verifier logic.
- It does not persist task state, lifecycle state, or resume cursors.
- It does not trust model self-reporting.

## Input Request Shape
The parser accepts a `TaskPlanInputFileRequest` conceptually shaped as:

```json
{
  "inputPath": "tasks/task.json",
  "currentWorkingDirectory": "/workspace/project",
  "mode": "plan",
  "expectedFormat": "json",
  "maxFileSizeBytes": 64000,
  "options": {
    "allowAbsolutePath": false,
    "allowParentTraversal": false,
    "maxFileSizeBytes": 64000,
    "requireJsonObject": true,
    "validateContract": true,
    "createPlanningHandoff": true,
    "noExecution": true,
    "noWrites": true,
    "trustModelSelfReporting": false
  },
  "noExecution": true,
  "noWrites": true
}
```

Supported modes are represented as `plan`, `dry_run`, `validate`, or
`unknown`. The parser preserves the mode but does not execute mode-specific
runtime behavior.

## Supported File Format
MVP supported format:

- `.json`

Unsupported examples:

- `.md`
- `.yaml`
- `.yml`
- `.toml`
- `.jsonl`
- extensionless files
- directories
- remote URL-like input

The parser rejects unsupported extensions on the operator-supplied input path
before parsing content. A symlink target with a `.json` extension does not make
an unsupported input path such as `.txt`, `.md`, `.yaml`, or `.toml`
acceptable.

## Path Safety Behavior
Default path policy is fail-closed:

- empty input is rejected;
- URL-like input is rejected;
- absolute input is rejected unless `allowAbsolutePath` is true;
- `..` traversal is rejected unless `allowParentTraversal` is true;
- real paths must stay inside `currentWorkingDirectory`;
- missing paths are rejected;
- directories and non-regular files are rejected.

When absolute paths or parent traversal are explicitly allowed, the real path
still has to pass the working-directory boundary check.

## JSON Parse Behavior
JSON parsing uses `JSON.parse`. Expected input errors do not expose stack
traces. Invalid JSON returns:

- parse `ok: false`;
- format `json`;
- parse error message `Invalid JSON.`;
- issue code `task_plan_input_invalid_json`.

When `requireJsonObject` is true, arrays, strings, numbers, booleans, and null
are rejected with issue code `task_plan_input_json_root_not_object`.

## File Size Behavior
The default maximum file size is `64000` bytes. Requests may provide
`maxFileSizeBytes` through the request or options. Oversized files are rejected
before file content parsing with issue code `task_plan_input_file_too_large`.

## Validation Handoff Behavior
Validation is controlled by `options.validateContract`.

When validation is not requested:

- `validation.requested` is false;
- `validation.status` is `not_requested`;
- no validation success is implied.

When validation is requested:

- the parser first checks that the parsed value has the current AEOS task
  contract shape;
- incompatible shapes fail with
  `task_plan_input_contract_shape_invalid`;
- compatible shapes are passed to existing AEOS task validation;
- validation status and issues are copied from the validator result.

Task validation and parser structural checks share the same plan-capable task
contract shape. The parser must not invent validation success.

## Mapping Handoff Behavior
Mapping is controlled by `options.createPlanningHandoff`.

When mapping is not requested:

- `mapping.requested` is false;
- `mapping.status` is `not_requested`.

When mapping is requested before validation passes:

- `mapping.status` is `blocked`;
- issue code is `task_plan_input_mapping_blocked`.

When validation passes:

- mapping remains explicitly unsupported in the MVP;
- `mapping.status` is `unsupported`;
- issue code is `task_plan_input_mapping_unsupported`;
- `unsupportedReason` explains that AEOS task contracts cannot yet be safely
  mapped to runner planning input;
- `runnerPlanningExecuted` remains false.

The parser does not run the mapper or `planAgenticRunner()`. The CLI task plan
command performs parser-to-mapper-to-planner orchestration separately after
parser validation succeeds.

## Result Shape
The result exposes stable top-level fields:

```json
{
  "ok": false,
  "mode": "plan",
  "sourceFile": "...",
  "pathCheck": {},
  "parse": {},
  "validation": {},
  "mapping": {},
  "issues": [],
  "summary": {
    "noExecution": true,
    "noWrites": true
  }
}
```

`ok` is true only when path and parse succeeded, requested validation succeeded,
and requested mapping succeeded. Parser-local mapping remains unsupported, so
requesting parser-local mapping makes the parser result fail closed after
validation. CLI task planning disables that parser-local mapping request and
uses the core mapper/planner integration after parser validation.

## Error And Issue Behavior
Expected parser errors are represented as deterministic issues with a stable
code, message, severity, phase, and optional path or metadata.

Examples:

- Missing file: `task_plan_input_file_missing`.
- Directory input: `task_plan_input_path_is_directory`.
- Outside working directory: `task_plan_input_outside_working_directory`.
- Parent traversal: `task_plan_input_parent_traversal_disallowed`.
- Absolute path denied: `task_plan_input_absolute_path_disallowed`.
- Unsupported extension: `task_plan_input_unsupported_format`.
- File too large: `task_plan_input_file_too_large`.
- Invalid JSON: `task_plan_input_invalid_json`.
- Non-object JSON: `task_plan_input_json_root_not_object`.
- Invalid task contract: `task_plan_input_contract_shape_invalid`.
- Unsupported mapping: `task_plan_input_mapping_unsupported`.

## Summary Fields
The summary includes:

- `hasSourceFile`
- `pathOk`
- `parseOk`
- `validationRequested`
- `validationOk`
- `mappingRequested`
- `mappingOk`
- `issueCount`
- `noExecution`
- `noWrites`
- `runnerPlanningExecuted`
- `taskPersistenceWritten`
- `trustsModelSelfReporting`

`issueCount` mirrors the result issue array length. `noExecution` and
`noWrites` remain true for all parser results.

## Safety Guarantees
- Read-only parser behavior.
- No file creation, modification, deletion, or directory creation.
- No task execution.
- No runner planning execution inside the parser.
- No adapter calls.
- No audit writes.
- No verifier run.
- No task, lifecycle, or resume persistence.
- No repository scan beyond the explicit input file and required path checks.
- No model self-reporting trust.

## MVP Limitations
- JSON only.
- Local files only.
- No Markdown, YAML, or TOML task parsing.
- No parser-local task-to-runner planning adapter.
- No parser-local runner planning result.
- No persisted parser output.
- No remote task loading.
- No schema version negotiation.

## Later Scope
Later tasks may add:

- Markdown, YAML, or TOML parsers;
- richer task schema validation;
- explicit task-contract versioning;
- optional persistence behind an explicit write-enabled design;
- real execution only after a separate execution safety review.
