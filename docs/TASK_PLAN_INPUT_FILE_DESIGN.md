# Task Plan Input File Design

## Purpose
Define how future `aeos task plan` support will accept one explicit local task
contract file, parse it, validate it, and hand it off to side-effect-free runner
planning.

This is design-only. It does not implement CLI parsing, file loading, runner
mapping, task execution, audit writing, verifier execution, persistence, or
project mutation.

## Future Command Shape
```text
aeos task plan <task-file>
aeos task plan <task-file> --json
```

The command requires exactly one task file path. `--json` changes output format
only; it must not change parsing, validation, planning, safety, or exit-code
behavior.

## Current Skeleton Status
The current CLI exposes `aeos task plan` and `aeos task plan --json` as a safe
skeleton only.

Current skeleton behavior:

- exits non-zero;
- accepts no positional task file yet;
- rejects a positional file as an unknown option;
- does not parse task files;
- does not call `validateAeosTask()`;
- does not call `planAgenticRunner()`;
- does not execute work;
- does not call model, agent, tool, policy, audit, verifier, or MCP adapters;
- does not write audit events;
- does not persist lifecycle, resume, or task state.

## Input File Requirements
MVP input is one explicit local file path supplied by the operator.

Rules:

- local file path only;
- no remote URLs;
- no glob input;
- no directory input;
- no shell expansion assumptions;
- no implicit repo scan;
- no fallback to default task files;
- no prompt-based task discovery;
- no reading unrelated context;
- max file size limit before reading, for example a small deterministic byte
  cap selected during implementation;
- parse errors are non-zero;
- validation errors are non-zero.

The CLI should treat the argument as a literal path string already received from
the process argv. It should not invoke a shell, expand wildcards, resolve
environment variables, or infer missing paths.

## Supported File Format For MVP
Prefer JSON task contract files for the first implementation.

MVP supported extension:

- `.json`

MVP unsupported examples:

- `.md`;
- `.yaml`;
- `.yml`;
- `.jsonl`;
- extensionless files;
- directories;
- URLs.

The JSON root must be an object. The object is expected to represent the current
`AeosTask` contract shape from `packages/core/src/tasks.ts`, not the prose task
contract format in `docs/TASK_CONTRACT.md`.

Markdown task contracts can be later scope. They require a separate structured
parser and should not be guessed from headings during the JSON MVP.

## Path Safety Behavior
Path handling should be deterministic and local-first.

MVP behavior:

- resolve the input path relative to the current working directory;
- reject absolute local paths by default;
- allow absolute local paths only when explicitly configured and when the
  resolved real path is accepted by the same local safety checks;
- require the file to exist;
- require the path to resolve to a regular file;
- reject directories;
- reject missing files;
- reject unsupported extensions on the operator-supplied input path before
  parsing;
- reject paths that escape the current working directory through `..` traversal
  or symlink resolution unless a later design explicitly allows safe absolute
  local paths outside the current working directory;
- do not follow unsafe traversal outside current working directory;
- do not write to the task file;
- do not modify project files.

Implementation should prefer comparing canonical resolved paths with the
canonical current working directory. A path is in scope only when the task file
real path is the current working directory itself as a file impossibility, or is
strictly inside the current working directory with a path separator boundary.

## Task Contract Validation Behavior
Validation flow:

1. Resolve and safety-check the path.
2. Enforce supported extension and file size limit.
3. Read the file as UTF-8 text.
4. Parse JSON.
5. Require the parsed JSON root to be an object.
6. Validate with existing AEOS task contract rules when available.
7. Stop with non-zero output on validation failure.
8. Map the valid task contract to runner planning input only after validation.

The current reusable validator is `validateAeosTask()` from
`packages/core/src/task-validation.ts`. It validates the current `AeosTask`
schema enough to require:

- task id;
- title;
- purpose;
- at least one `context.load` entry;
- stop condition description;
- no exact path overlap between `filesToModify` and `filesNotToTouch`.

The existing validator does not fully prove runtime safety, path scope, runner
compatibility, work inventory completeness, policy correctness, audit readiness,
or verifier evidence. Those remain separate planning or later runtime checks.

If the parsed task contract is not yet compatible with runner planning input,
the CLI must return a non-zero unsupported mapping error rather than guessing.
An explicit adapter/mapping step from `AeosTask` to
`AgenticRunnerPlanningInput` is future implementation work.

## Error Behavior
Human mode errors must be compact, deterministic, and non-zero.

Human errors should include:

- command name or phase;
- source file when known;
- stable reason;
- issue count when validation or mapping issues exist;
- no stack traces for expected user input errors.

Expected non-zero human errors:

- missing task file;
- directory instead of file;
- unsupported extension;
- file outside allowed path scope;
- file too large;
- invalid JSON;
- invalid task contract;
- unsupported task-to-runner mapping;
- unknown option.

## JSON Error Behavior
JSON mode must emit exactly one JSON object on stdout for both success and
errors. It must not print human text, banners, warnings, progress, or stack
traces to stdout or stderr for expected input errors.

Base error shape:

```json
{
  "ok": false,
  "error": {
    "code": "...",
    "message": "..."
  },
  "issues": []
}
```

Required MVP error JSON shapes:

Missing file:

```json
{
  "ok": false,
  "error": {
    "code": "task_plan_file_missing",
    "message": "Task plan input file does not exist."
  },
  "sourceFile": "missing-task.json",
  "issues": []
}
```

Directory instead of file:

```json
{
  "ok": false,
  "error": {
    "code": "task_plan_directory_input",
    "message": "Task plan input path must be a regular file."
  },
  "sourceFile": "tasks",
  "issues": []
}
```

Unsupported extension:

```json
{
  "ok": false,
  "error": {
    "code": "task_plan_unsupported_extension",
    "message": "Task plan input file must be a .json file."
  },
  "sourceFile": "task.md",
  "issues": []
}
```

Invalid JSON:

```json
{
  "ok": false,
  "error": {
    "code": "task_plan_invalid_json",
    "message": "Task plan input file contains invalid JSON."
  },
  "sourceFile": "task.json",
  "issues": []
}
```

Invalid task contract:

```json
{
  "ok": false,
  "error": {
    "code": "task_plan_invalid_task_contract",
    "message": "Task plan input file is not a valid AEOS task contract."
  },
  "sourceFile": "task.json",
  "issues": []
}
```

Unsupported task-to-runner mapping:

```json
{
  "ok": false,
  "error": {
    "code": "task_plan_mapping_unsupported",
    "message": "Validated task contract cannot yet be mapped to runner planning input."
  },
  "sourceFile": "task.json",
  "issues": []
}
```

## Human Output Behavior
Successful human output should use this stable shape:

```text
Task Plan

Task id: <task-id>
Mode: plan
Source file: <task-file>
Valid contract: true
Work items: <count>
Batches: <count>
Steps: <count>
Policy: <allowed|blocked|requires_approval|not_evaluated|unknown>
Verifier required: <true|false>
Audit expected: <true|false>
Issues: <count>
```

Human output must not imply real execution, autonomous progress, emitted audit
events, verifier success, persisted state, resume cursor writes, or completed
work.

## JSON Output Concept
Successful JSON mode should emit exactly one object:

```json
{
  "ok": true,
  "taskId": "...",
  "mode": "plan",
  "sourceFile": "...",
  "contract": {},
  "plan": {},
  "policy": {},
  "verifier": {},
  "audit": {},
  "resume": {},
  "issues": [],
  "summary": {}
}
```

`ok: true` means a task plan was produced. It does not mean execution,
verification, persistence, audit writing, or completion occurred.

The JSON payload must avoid raw prompts, full model outputs, secrets, broad file
contents, stack traces, provider SDK objects, hidden tool arguments, and private
reasoning traces.

## Planning Handoff Behavior
The planned data flow is:

```text
Task file
   |
   v
Parse
   |
   v
Validate task contract
   |
   v
Map to runner planning input
   |
   v
planAgenticRunner()
   |
   v
Task Plan output
```

The handoff to `planAgenticRunner()` must pass represented data only. It must
not let the planner inspect the filesystem or infer missing work from the
repository.

## Runner Planning Integration Concept
`planAgenticRunner()` currently accepts `AgenticRunnerPlanningInput` and returns
`AgenticRunnerPlanningResult`.

Integration should:

- set `mode` to `plan`;
- set `taskId` from the validated task contract id;
- attach the task contract as metadata or task contract planning input;
- map represented work items and batches only if the task contract or later
  explicit planning input includes them;
- set planner options such as `requireVerifier` and `requireAudit` according to
  explicit contract or CLI defaults;
- preserve policy, adapter, audit, verifier, and resume data as represented
  input, not runtime evaluation;
- return `task_plan_mapping_unsupported` when required planning input cannot be
  represented safely.

The current `AeosTask` contract is enough to scope a task but may not contain
runner work items, batches, policy plans, adapter references, audit
requirements, verifier requirements, or resume data. The adapter from `AeosTask`
to `AgenticRunnerPlanningInput` should therefore be explicit and conservative.

## No-Execution Guarantees
Even with a valid task file, `aeos task plan` must not execute anything.

It must not:

- call model adapters;
- call agent adapters;
- call tool adapters;
- call MCP adapters;
- call policy adapters;
- call audit adapters;
- call verifier adapters;
- write audit events;
- run verifier logic;
- persist task state;
- persist lifecycle state;
- persist resume cursors;
- mutate files;
- mark work items completed;
- mark batches completed;
- mark the task completed.

## No-Write Guarantees
`aeos task plan <task-file>` is read-only.

It must not:

- write to the task file;
- modify project files;
- create generated files;
- create lifecycle state;
- create audit logs;
- create memory entries;
- create resume cursor files;
- write package files;
- write Git state;
- run commands that mutate the workspace.

Future write-enabled behavior, if any, requires a separate command, explicit
flag, safety review, and implementation task.

## Implemented MVP Notes
The current parser implementation is a read-only local JSON parser. It accepts
explicit `.json` files, rejects unsupported extensions, enforces a maximum file
size before parsing, and returns deterministic issue/result fields.

Safety hardening now includes:

- invalid JSON returns the deterministic parser message `Invalid JSON.`;
- parent traversal and paths outside the working directory are denied by
  default;
- absolute paths are denied by default unless explicitly allowed by options;
- unsupported task-to-runner mapping is explicit;
- `noExecution` and `noWrites` remain true in summaries;
- `runnerPlanningExecuted` remains false;
- the parser does not run `planAgenticRunner()`.

## Current Parser MVP Scope
The implemented parser MVP includes:

- parse exactly one local `.json` task contract file;
- reject missing files, directories, unsupported extensions, invalid JSON, and
  invalid contracts;
- reuse `validateAeosTask()` for existing task contract validation;
- return structured parser issues and summaries;
- preserve current no-execution and no-write guarantees;
- avoid runner planning execution until an explicit safe mapping exists;
- fail closed when mapping is unsupported;
- add smoke tests for parser contract, path safety, JSON behavior,
  deterministic issues, no-execution, and no-write behavior.

## Later Scope
Later work may include:

- Markdown task contract parsing;
- YAML task contract parsing;
- explicit absolute-path policy outside current working directory;
- richer schema validation;
- task contract versioning;
- explicit work item inventory in task files;
- explicit batch declarations in task files;
- policy requirement declarations;
- adapter reference declarations;
- audit and verifier requirement declarations;
- resume state input from persisted state;
- persisted planning results behind an explicit write flag;
- real task execution after a separate execution safety review.

## Non-Goals
This design does not include:

- CLI implementation;
- parser code;
- package changes;
- dependency changes;
- broad repository scanning;
- remote task loading;
- shell expansion;
- autonomous execution;
- model or tool adapter execution;
- audit runtime writes;
- verifier execution;
- lifecycle persistence;
- resume cursor persistence;
- marking tasks or work items completed.

## Smoke Test Requirements
Future smoke coverage must include:

A. Missing file human and JSON error:

- `aeos task plan missing.json` exits non-zero with compact human error.
- `aeos task plan missing.json --json` exits non-zero with exactly one JSON
  object and `task_plan_file_missing`.

B. Invalid JSON human and JSON error:

- invalid `.json` input exits non-zero in human mode with no stack trace.
- invalid `.json --json` exits non-zero with exactly one JSON object and
  `task_plan_invalid_json`.

C. Valid minimal task contract remains no-execution:

- valid minimal JSON task contract does not call model, agent, tool, audit,
  verifier, or runner execution adapters.
- output does not claim completion.

D. No-write assertion in temp dir:

- running plan against temp input leaves the temp directory file list unchanged.
- task file content remains byte-identical.

E. JSON-only assertion:

- success and error JSON mode stdout is exactly one JSON object.
- stderr is empty for expected JSON-mode input errors.

F. Help honesty:

- help advertises `aeos task plan <task-file>` only when input parsing is
  implemented.
- help does not promise execution, autonomous agents, audit writes, verifier
  runs, persistence, or completion.

## Current Follow-Up Sequence
1. TASK-0240: Final parser safety review.
   Purpose: confirm parser, validation handoff, unsupported mapping, smoke
   tests, and docs are deterministic, local-only, read-only, and no-execution.

2. TASK-0241: Implement `aeos task plan` file argument skeleton.
   Purpose: begin CLI argument wiring without planner execution, persistence,
   audit runtime, verifier runtime, adapters, or task execution.

Later tasks may add explicit task-to-runner mapping and a reviewed
`planAgenticRunner()` call. Those are not implemented by the parser MVP.
