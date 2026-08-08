# CLI Task Plan Parser Mapper Planner Integration Design

## Purpose
Design how `aeos task plan <task-file>` moves from the existing parser-only CLI
path to a safe parser, mapper, wiring, and dependency-injected planner flow.

This is design-only. It does not implement CLI integration, runner execution,
adapter calls, audit writes, verifier runtime, persistence, package changes, or
project mutation.

## Current Foundation Status
- `parseTaskPlanInputFile()` safely parses one explicit local `.json` task file,
  performs path, format, JSON, and validation checks, and returns deterministic
  parser output.
- `mapTaskContractToRunnerPlanningInput()` maps a validated `AeosTask` to a
  conservative runner planning input only for supported MVP shapes.
- Current supported mapping is a single pending fallback work item and one
  default batch. Explicit `workItems`, `batches`, and unvalidated `resume`
  fields remain unsupported.
- `createTaskPlanFilePlannerWiringResult()` provides pure in-memory wiring gates
  and may call only a supplied planner dependency.
- `planAgenticRunner()` is deterministic and side-effect-free over represented
  planning input.
- No CLI task plan path currently runs the mapper, wiring helper with an
  injected planner, or `planAgenticRunner()`.

## Existing CLI Parser-Only Behavior
Current `aeos task plan` behavior:

- `aeos task plan` without a file prints a safe skeleton and exits non-zero.
- `aeos task plan --json` emits JSON-only skeleton output and exits non-zero.
- `aeos task plan <task-file>` accepts one positional file, calls
  `parseTaskPlanInputFile()`, and validates the task contract.
- Valid parser output is still reported as `Status: parsed` with
  `Mapping: unsupported`, `Real planning: false`, and a non-zero exit.
- Parser errors such as missing file, invalid JSON, unsupported extension,
  unsafe path, and invalid contract fail with deterministic human or JSON output.
- The current CLI intentionally does not import or call runner planning logic for
  the task plan command.

## Target CLI Behavior
Target command:

```text
aeos task plan <task-file>
aeos task plan <task-file> --json
```

Target flow:

```text
aeos task plan <task-file>
   |
   v
parseTaskPlanInputFile(task-file)
   |
   v
mapTaskContractToRunnerPlanningInput(parsed task data)
   |
   v
createTaskPlanFilePlannerWiringResult(...)
   |
   v
dependency-injected planAgenticRunner(mappingResult.planningInput.runnerPlanningInput)
   |
   v
human or JSON output
```

Successful target behavior produces a planner-only task plan. `ok: true` means
planning succeeded. It does not mean execution, verification, audit writing,
persistence, filesystem mutation, or completion occurred.

## Integration Responsibilities
- Parse exactly one explicit local task file through `parseTaskPlanInputFile()`.
- Map only a validated parser task handoff through
  `mapTaskContractToRunnerPlanningInput()`.
- Build a wiring input from parser result, mapping result, command mode, output
  mode, and safety flags.
- Pass `planAgenticRunner` as an explicit dependency to
  `createTaskPlanFilePlannerWiringResult()`.
- Render human or JSON output from the wiring result.
- Convert wiring exit-code contract names into process exit codes.
- Preserve deterministic issue codes, messages, and ordering.
- Preserve no-execution, no-write, verifier-gated, fail-closed behavior.

## Integration Non-Responsibilities
The CLI integration must not:

- implement parser internals;
- implement mapper internals;
- implement planner internals;
- execute task work;
- call model, agent, tool, MCP, policy, audit, verifier, memory, project, or
  template adapters;
- write audit events;
- run verifier logic;
- persist task, lifecycle, audit, plan, or resume state;
- mutate project files;
- mark work items, batches, task state, or work completed;
- run dry-run execution;
- infer inventory by scanning the repository;
- trust task or model text claims of completion, approval, or verification.

## Input Flow
1. Parse argv for `aeos task plan <task-file> [--json]`.
2. Reject missing file, too many positional arguments, and unknown flags before
   planner setup.
3. Build a parser request with:
   - `mode: "plan"`;
   - `expectedFormat: "json"`;
   - `allowAbsolutePath: false`;
   - `allowParentTraversal: false`;
   - `requireJsonObject: true`;
   - `validateContract: true`;
   - parser-local planning handoff disabled or treated as non-authoritative;
   - `noExecution: true`;
   - `noWrites: true`;
   - `trustModelSelfReporting: false`.
4. Call `parseTaskPlanInputFile(task-file request)`.
5. Build mapper input only from `parserResult.validation.task` after validation
   passes.
6. Call `mapTaskContractToRunnerPlanningInput()` with MVP-safe options.
7. Call `createTaskPlanFilePlannerWiringResult()` with parser result, mapping
   result, `noExecution: true`, `noWrites: true`, and injected planner
   dependency.

## Output Flow
The CLI renders one combined command result from:

- parser stage: path, parse, and validation status;
- mapping stage: mapping status, work item and batch counts, verifier gates,
  audit expectation, planning input availability, and safety flags;
- planner stage: work items, batches, steps, policy, approval, audit, verifier,
  resume, issues, and summary;
- command safety stage: all real side-effect flags remain false.

Human mode prints concise text. JSON mode prints exactly one JSON object.

## Parser Integration
Parser integration must:

- call `parseTaskPlanInputFile()` once for the supplied task file;
- reject path traversal, absolute paths by default, remote URL-like input,
  missing files, directories, unsupported extensions, oversized files, invalid
  JSON, non-object JSON, and invalid task contracts;
- avoid raw `JSON.parse` error leakage;
- avoid dumping task file contents;
- require `summary.pathOk === true`;
- require `summary.parseOk === true`;
- require parser result `ok === true` for the parser/validation configuration
  used by this target integration;
- require `validation.status === "pass"` and `validation.task` to exist;
- preserve parser issues in output.

If the parser is still configured with its parser-local unsupported mapping
handoff, the CLI must not treat that parser-local `mapping.status:
"unsupported"` as planner-ready. The CLI should either disable parser-local
mapping for this command or explicitly ignore it as a transitional parser-local
handoff while requiring validation compatibility and the separate core mapper
result.

## Mapping Integration
Mapping integration must call `mapTaskContractToRunnerPlanningInput()` with:

- `task`: parser validation task;
- `taskId`: parser validation task id or task id;
- `sourceFile`: parser source file;
- `mode: "plan"`;
- `validation.status: "pass"`;
- `validation.valid: true`;
- `validation.result`: parser validation result when available;
- `validation.issues`: parser validation issues;
- `options.allowSingleWorkItemFallback: true`;
- `options.requireExplicitWorkItems: false`;
- `options.requireVerifier: true`;
- `options.createDefaultBatch: true`;
- `options.createAuditExpectations: true`;
- `options.createPolicyBoundary: true`;
- `options.createAdapterBoundary: true`;
- `noExecution: true`;
- `noWrites: true`.

The CLI must fail closed for unsupported explicit `workItems`, unsupported
explicit `batches`, unsupported resume data, missing validation handoff, missing
task id, unsupported modes, disabled verifier requirements, disabled no-write
proof, disabled no-execution proof, or unsafe represented metadata.

## Planner Wiring Integration
Planner wiring integration must use `createTaskPlanFilePlannerWiringResult()`
as the only CLI boundary that can invoke planning.

The CLI should pass:

- task file path;
- `json` mode;
- `mode: "plan"`;
- parser request and parser result;
- mapping options and mapping result;
- `noExecution: true`;
- `noWrites: true`.

The CLI must not use top-level represented `plannerInput` as a bypass. A
top-level `plannerInput` may be present only for diagnostics or future contract
compatibility and must not substitute for
`mappingResult.planningInput.runnerPlanningInput`.

## Dependency-Injected Planner Integration
The CLI must pass `planAgenticRunner` explicitly as a dependency into wiring
logic:

```text
createTaskPlanFilePlannerWiringResult(wiringInput, {
  planner: planAgenticRunner
})
```

The injected planner must receive exactly:

```text
mappingResult.planningInput.runnerPlanningInput
```

The CLI must not:

- call `planAgenticRunner()` directly outside wiring logic;
- call planner logic before gates pass;
- synthesize a separate planner input from CLI-local data;
- let raw parser data, top-level `plannerInput`, task prose, or model text
  bypass the mapping result handoff.

## Human Output Behavior
When `--json` is not used, success output should be concise and stable:

```text
Task Plan

Task id: <task-id>
Source file: <task-file>
Mode: plan
Parsed: true
Mapping: mapped
Planning: planned
Work items: <count>
Batches: <count>
Steps: <count>
Policy required: <true|false>
Approval required: <true|false>
Verifier required: true
Completion gated by verifier: true
Audit expected: <true|false>
Real execution: false
Adapter calls: false
Audit writes: false
Verifier run: false
Persistence: false
Filesystem mutation: false
Completed state created: false
Issues: <count>
```

If issues exist, print a compact issue list with deterministic code and message.
Human output must not dump raw task file content, stack traces, raw engine parse
errors, prompts, model output, secrets, or hidden tool arguments.

## JSON Output Behavior
When `--json` is used, success output must be exactly one valid JSON object:

```json
{
  "ok": true,
  "status": "planned",
  "exitCode": "success",
  "taskId": "...",
  "mode": "plan",
  "sourceFile": "...",
  "parse": {},
  "mapping": {},
  "plan": {},
  "safety": {
    "executionEnabled": false,
    "adapterCalls": false,
    "auditWrites": false,
    "verifierRun": false,
    "persistence": false,
    "filesystemMutation": false,
    "completedStateCreated": false
  },
  "issues": [],
  "summary": {}
}
```

Fail-closed JSON output must be exactly one valid JSON object:

```json
{
  "ok": false,
  "status": "unsupported_mapping|parser_failed|validation_failed|mapping_failed|planner_failed|blocked",
  "exitCode": "...",
  "mode": "plan",
  "sourceFile": "...",
  "parse": {},
  "mapping": {},
  "plan": {},
  "safety": {
    "executionEnabled": false,
    "adapterCalls": false,
    "auditWrites": false,
    "verifierRun": false,
    "persistence": false,
    "filesystemMutation": false,
    "completedStateCreated": false
  },
  "issues": [],
  "summary": {}
}
```

JSON output must avoid raw prompts, full model outputs, broad file contents, raw
command logs, provider SDK objects, hidden tool arguments, stack traces, secrets,
and private reasoning traces.

## Implemented MVP Notes
The implemented MVP integration helper layer is pure and deterministic over
in-memory data and explicit dependencies.

- No CLI command changes have been made yet.
- No output rendering to stdout or stderr has been wired yet.
- No filesystem IO is performed by the integration logic.
- A direct `planAgenticRunner()` call is not used.
- Planner dependency injection is gate-protected.
- TASK-0269-FIX requires strict `noExecution` and `noWrites` proof on
  `mappingResult.planningInput.runnerPlanningInput.metadata`.
- TASK-0270 requires strict verifier proof on the actual
  `mappingResult.planningInput.runnerPlanningInput.verifierRequirements`.
- Top-level `plannerInput` cannot bypass
  `mappingResult.planningInput.runnerPlanningInput`.
- Unsafe represented metadata remains fail-closed, including claims of
  execution, adapter calls, audit writes, verifier run, persistence, filesystem
  mutation, completed state, approval, verification, or completion.

## Error Behavior
Expected error cases:

- missing file;
- path traversal or unsafe path;
- unsupported extension;
- file too large;
- invalid JSON;
- invalid task contract;
- parser result not ok;
- unsupported mapping;
- mapping ok but missing `runnerPlanningInput`;
- missing verifier gate;
- missing `noExecution` or `noWrites`;
- unsafe represented metadata;
- planner non-ok;
- unknown flags.

Human errors must be concise and deterministic. JSON errors must be JSON-only.
Expected errors must not print stack traces, raw parser exceptions, raw invalid
input, raw planner internals, or task text as proof.

## Exit Code Behavior
Use existing wiring status and exit-code contract names:

- `planned` -> process exit `0`, `exitCode: "success"`;
- `parser_failed` -> non-zero, `exitCode: "parser_failure"`;
- `validation_failed` -> non-zero, `exitCode: "validation_failure"`;
- `unsupported_mapping` -> non-zero, `exitCode: "unsupported_mapping"`;
- `mapping_failed` -> non-zero, `exitCode: "mapping_failure"`;
- `planner_failed` -> non-zero, `exitCode: "planner_failure"`;
- `blocked` -> non-zero, `exitCode: "blocked"`;
- `failed` or `unknown` -> non-zero, `exitCode: "unknown_failure"`.

Unknown flags are non-zero. JSON-mode errors still emit exactly one JSON object.

## Safety Boundaries
`aeos task plan <task-file>` may run parser, mapper, wiring logic, and planner
logic only.

It must not:

- run task execution;
- call model/tool adapters;
- call agent, MCP, policy, audit, verifier, memory, project, or template
  adapters;
- write audit events;
- run verifier;
- persist task state;
- mutate project files;
- mark work completed;
- run dry-run execution unless a later explicit command does so;
- trust task or model text claims of completion, approval, or verification.

## Fail-Closed Gates
Planner can be invoked only when all are true:

- parser pathOk true;
- parser parseOk true;
- parse result ok true;
- validation compatible or MVP-compatible according to current parser/mapping
  contracts;
- mapping result ok true;
- mapping status mapped;
- `mappingResult.planningInput.runnerPlanningInput` exists;
- mapping noExecution true;
- mapping noWrites true;
- verifierRequired true;
- completionGatedByVerifier true;
- safety side-effect flags false:
  - executionEnabled false;
  - adapterCalls false;
  - auditWrites false;
  - verifierRun false;
  - persistence false;
  - filesystemMutation false;
  - completedStateCreated false.

Otherwise fail closed and do not call planner logic.

## No-Write Guarantees
Except for normal stdout/stderr process output, the command is read-only:

- no task file writes;
- no generated files;
- no audit writes;
- no lifecycle writes;
- no resume cursor writes;
- no memory writes;
- no package writes;
- no Git writes;
- no deployment writes;
- no persistence writes;
- no project file mutation.

Smoke tests must include temp-directory assertions for success and failure
paths.

## No-Execution Guarantees
The command produces a plan only:

- no task execution;
- no runner execution;
- no dry-run execution;
- no model, agent, tool, MCP, policy, audit, verifier, memory, project, or
  template adapter calls;
- no verifier run;
- no audit emission;
- no completion state;
- no approval state granted by task text.

Planner steps such as `batch_execution`, `audit_append`, and `verification` are
planned steps only, not executed steps.

## MVP Limitations
- JSON task files only.
- Local files only.
- Single-work-item fallback only for supported minimal task contracts.
- Explicit work items and batches are not supported until typed validation
  exists.
- Policy is represented, not evaluated.
- Adapter boundaries are represented, not called.
- Audit events are expected, not written.
- Verifier is required, not run.
- No persistence.
- No dry-run execution.
- No real execution.

## Later Scope
- Typed explicit work item inventory in task files.
- Typed explicit batch declarations.
- Typed resume input from persisted lifecycle state.
- Markdown, YAML, or TOML task file support after separate parser design.
- Optional plan persistence behind an explicit write-enabled design.
- Policy adapter evaluation.
- Audit runtime writes during later execution, not planning.
- Verifier runtime handoff in `aeos task verify` or later execution.
- `aeos task run --dry-run` integration.
- Real `aeos task run` after a separate execution safety review.

## Non-Goals
- Implement CLI integration in this task.
- Modify apps or packages in this task.
- Add dependencies.
- Change package files.
- Deploy.
- Push to Git.
- Support remote task sources.
- Support implicit task discovery.
- Support repository inventory inference.
- Trust model self-reporting.
- Mark work completed.

## Smoke Test Requirements
Future smoke coverage must prove:

A. A valid minimal task file produces a planned result if current mapper/planner
supports it.

B. Unsupported explicit `workItems` or `batches` fail closed.

C. Missing file fails JSON-only in `--json` mode.

D. Invalid JSON fails JSON-only.

E. Unsupported extension fails JSON-only.

F. Path traversal fails JSON-only.

G. Mapping without `runnerPlanningInput` fails closed.

H. Mapping without verifier gate fails closed if representable.

I. Hostile represented metadata fails closed if representable.

J. Planner non-ok fails closed.

K. Success human output includes safety flags.

L. Success JSON output is JSON-only.

M. Failure JSON output is JSON-only.

N. No-write assertion in a temp dir proves no files are created, deleted, or
modified.

O. No-execution assertion proves:

- no adapter calls;
- no audit writes;
- no verifier run;
- no persistence;
- no completed state;
- no filesystem mutation.

## Implementation Sequence
Do not start these tasks from this design task.

1. TASK-0264: Implement CLI task plan planner integration contracts.
   Purpose: add CLI-local contracts for parser, mapper, wiring, planner output,
   fail-closed statuses, JSON safety wrapper, and process exit-code mapping.
   Likely files: `apps/cli/src/commands.ts`.
   Verification command: `pnpm --filter @aeos/cli check`.
   Recommended model effort: Medium.
   Classification: Code.

2. TASK-0265: Add CLI task plan planner output examples.
   Purpose: add representative success, parser failure, unsupported mapping,
   blocked safety, missing planner input, and planner non-ok examples without
   enabling runtime command behavior.
   Likely files: `apps/cli/src/commands.ts`, `apps/cli/scripts/smoke.mjs`.
   Verification command: `pnpm --filter @aeos/cli check`.
   Recommended model effort: Low.
   Classification: Code.

3. TASK-0266: Add parser result builder for planner-enabled task plan CLI.
   Purpose: call `parseTaskPlanInputFile()` with the target parser settings and
   expose a validation-compatible handoff without treating parser-local
   unsupported mapping as planner-ready.
   Likely files: `apps/cli/src/commands.ts`.
   Verification command: `pnpm --filter @aeos/cli check`.
   Recommended model effort: Medium.
   Classification: Code.

4. TASK-0267: Add parser-to-mapper CLI input builder.
   Purpose: build `TaskContractMappingInput` from parser validation task data
   with MVP-safe fallback, audit, policy, verifier, no-execution, and no-write
   options.
   Likely files: `apps/cli/src/commands.ts`.
   Verification command: `pnpm --filter @aeos/cli check`.
   Recommended model effort: Medium.
   Classification: Code.

5. TASK-0268: Wire CLI task plan to mapper fail-closed handling.
   Purpose: call `mapTaskContractToRunnerPlanningInput()` after validation and
   return deterministic unsupported, invalid, blocked, or mapped output without
   invoking planner yet.
   Likely files: `apps/cli/src/commands.ts`, `apps/cli/scripts/smoke.mjs`.
   Verification command: `pnpm --filter @aeos/cli check`.
   Recommended model effort: Medium.
   Classification: Code.

6. TASK-0269: Wire dependency-injected planner through task plan wiring helper.
   Purpose: pass `planAgenticRunner` into
   `createTaskPlanFilePlannerWiringResult()` and ensure planner input can only
   come from `mappingResult.planningInput.runnerPlanningInput`.
   Likely files: `apps/cli/src/commands.ts`.
   Verification command: `pnpm --filter @aeos/cli check`.
   Recommended model effort: High.
   Classification: Code.

7. TASK-0270: Render successful human task plan output.
   Purpose: print task id, source file, mode, parsed, mapping, planning, counts,
   policy, approval, verifier, audit, safety flags, and compact issues.
   Likely files: `apps/cli/src/commands.ts`, `apps/cli/scripts/smoke.mjs`.
   Verification command: `pnpm --filter @aeos/cli check`.
   Recommended model effort: Medium.
   Classification: Code.

8. TASK-0271: Render successful JSON task plan output.
   Purpose: emit the target JSON-only success object with parse, mapping, plan,
   nested safety flags, issues, summary, and `exitCode: "success"`.
   Likely files: `apps/cli/src/commands.ts`, `apps/cli/scripts/smoke.mjs`.
   Verification command: `pnpm --filter @aeos/cli check`.
   Recommended model effort: Medium.
   Classification: Code.

9. TASK-0272: Add fail-closed JSON output for parser and validation failures.
   Purpose: preserve JSON-only deterministic output for missing file, unsafe
   path, unsupported extension, oversized file, invalid JSON, and invalid task
   contract.
   Likely files: `apps/cli/src/commands.ts`, `apps/cli/scripts/smoke.mjs`.
   Verification command: `pnpm --filter @aeos/cli smoke`.
   Recommended model effort: High.
   Classification: Code.

10. TASK-0273: Add fail-closed mapping and safety smoke coverage.
    Purpose: cover unsupported explicit work items, unsupported batches, missing
    runner planning input, missing verifier gate, missing no-execution/no-write
    proof, and hostile represented metadata.
    Likely files: `apps/cli/scripts/smoke.mjs`.
    Verification command: `pnpm --filter @aeos/cli smoke`.
    Recommended model effort: High.
    Classification: Code.

11. TASK-0274: Add planner non-ok and dependency-injection smoke coverage.
    Purpose: prove planner non-ok fails closed, planner is not called before
    gates pass, and injected planner receives only mapped runner planning input.
    Likely files: `apps/cli/scripts/smoke.mjs`.
    Verification command: `pnpm --filter @aeos/cli smoke`.
    Recommended model effort: High.
    Classification: Code.

12. TASK-0275: Add task plan no-write and no-execution smoke assertions.
    Purpose: assert success and failure paths do not create files, call
    adapters, write audit events, run verifier, persist state, create completed
    state, or mutate the filesystem.
    Likely files: `apps/cli/scripts/smoke.mjs`.
    Verification command: `pnpm --filter @aeos/cli smoke`.
    Recommended model effort: High.
    Classification: Code.

13. TASK-0276: Update task plan planner integration usage docs.
    Purpose: document implemented CLI behavior, supported fallback limits,
    JSON-only output, fail-closed statuses, and remaining non-goals after code
    lands.
    Likely files: `docs/TASK_PLAN_INPUT_PARSER_USAGE.md`,
    `docs/TASK_CONTRACT_MAPPING_USAGE.md`,
    `docs/TASK_PLAN_FILE_PLANNER_WIRING_USAGE.md`,
    `docs/AGENTIC_RUNNER_PLANNING_USAGE.md`.
    Verification command: `git status --short`.
    Recommended model effort: Medium.
    Classification: Docs.
