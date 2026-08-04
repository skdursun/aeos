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
- allow absolute local paths only if the resolved real path is accepted by the
  same local safety checks;
- require the file to exist;
- require the path to resolve to a regular file;
- reject directories;
- reject missing files;
- reject unsupported extensions before parsing;
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

## MVP Scope
MVP includes:

- parse exactly one local `.json` task contract file;
- reject missing files, directories, unsupported extensions, invalid JSON, and
  invalid contracts;
- reuse `validateAeosTask()` for existing task contract validation;
- emit human and JSON-only errors;
- preserve current no-execution and no-write guarantees;
- call runner planning only after an explicit safe mapping exists;
- fail closed when mapping is unsupported;
- add smoke tests for parser contract, JSON-only behavior, no-execution, and
  no-write behavior.

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

## Implementation Sequence
1. TASK-0232: Implement task plan input file parser contracts.
   Purpose: define CLI-local types and error codes for task plan file parsing
   without reading files yet.
   Likely files: `apps/cli/src/commands.ts`.
   Verification command: `pnpm --filter @aeos/cli check`.
   Recommended model effort: Medium.
   Classification: Code.

2. TASK-0233: Add task plan argv contract for required file input.
   Purpose: parse `aeos task plan <task-file> [--json]`, require exactly one
   positional file, and keep unknown flag errors JSON-only in JSON mode.
   Likely files: `apps/cli/src/commands.ts`, `apps/cli/scripts/smoke.mjs`.
   Verification command: `pnpm --filter @aeos/cli check`.
   Recommended model effort: Medium.
   Classification: Code.

3. TASK-0234: Add task plan local path safety checks.
   Purpose: resolve the input relative to cwd, reject missing files,
   directories, unsupported extensions, unsafe traversal, and oversized files.
   Likely files: `apps/cli/src/commands.ts`, `apps/cli/scripts/smoke.mjs`.
   Verification command: `pnpm --filter @aeos/cli check`.
   Recommended model effort: High.
   Classification: Code.

4. TASK-0235: Add task plan JSON parse behavior.
   Purpose: read the checked `.json` file, parse JSON, require an object root,
   and return stable human and JSON errors.
   Likely files: `apps/cli/src/commands.ts`, `apps/cli/scripts/smoke.mjs`.
   Verification command: `pnpm --filter @aeos/cli check`.
   Recommended model effort: Medium.
   Classification: Code.

5. TASK-0236: Reuse AEOS task contract validation for plan input.
   Purpose: call `validateAeosTask()` after parsing and return non-zero invalid
   contract output with structured issues.
   Likely files: `apps/cli/src/commands.ts`, `apps/cli/scripts/smoke.mjs`.
   Verification command: `pnpm --filter @aeos/cli check`.
   Recommended model effort: Medium.
   Classification: Code.

6. TASK-0237: Add task-to-runner mapping unsupported guard.
   Purpose: fail closed with `task_plan_mapping_unsupported` until a safe
   `AeosTask` to `AgenticRunnerPlanningInput` adapter is implemented.
   Likely files: `apps/cli/src/commands.ts`, `apps/cli/scripts/smoke.mjs`.
   Verification command: `pnpm --filter @aeos/cli check`.
   Recommended model effort: Medium.
   Classification: Code.

7. TASK-0238: Design task-to-runner planning adapter.
   Purpose: document the conservative mapping from validated `AeosTask` to
   represented runner planning input.
   Likely files: `docs/TASK_PLAN_RUNNER_MAPPING_DESIGN.md`,
   `TASKS/backlog.md`, `PROJECT_CONTEXT.md`.
   Verification command: `git status --short`.
   Recommended model effort: Medium.
   Classification: Docs.

8. TASK-0239: Implement minimal task-to-runner planning adapter.
   Purpose: map validated task identity and contract metadata to
   `AgenticRunnerPlanningInput` without inventing work items or batches.
   Likely files: `apps/cli/src/commands.ts`, `apps/cli/scripts/smoke.mjs`.
   Verification command: `pnpm --filter @aeos/cli check`.
   Recommended model effort: High.
   Classification: Code.

9. TASK-0240: Wire task plan to `planAgenticRunner()`.
   Purpose: call the side-effect-free planner only after validation and safe
   mapping, preserving no-execution and no-write guarantees.
   Likely files: `apps/cli/src/commands.ts`, `apps/cli/scripts/smoke.mjs`.
   Verification command: `pnpm --filter @aeos/cli check`.
   Recommended model effort: High.
   Classification: Code.

10. TASK-0241: Render final task plan human and JSON output.
    Purpose: emit the stable Task Plan human fields and JSON top-level shape
    from the planning result.
    Likely files: `apps/cli/src/commands.ts`, `apps/cli/scripts/smoke.mjs`.
    Verification command: `pnpm --filter @aeos/cli check`.
    Recommended model effort: Medium.
    Classification: Code.

11. TASK-0242: Add task plan input file smoke suite.
    Purpose: cover missing file, invalid JSON, valid no-execution, no-write,
    JSON-only, and help honesty requirements.
    Likely files: `apps/cli/scripts/smoke.mjs`.
    Verification command: `pnpm --filter @aeos/cli smoke`.
    Recommended model effort: High.
    Classification: Code.

12. TASK-0243: Review task plan input file safety.
    Purpose: confirm parser, validator, mapping, planner call, output, and smoke
    tests remain deterministic, local-only, read-only, and planner-only.
    Likely files: `docs/TASK_PLAN_INPUT_FILE_DESIGN.md`,
    `TASKS/backlog.md`.
    Verification command: `git status --short`.
    Recommended model effort: Medium.
    Classification: Docs.
