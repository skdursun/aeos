# Task Plan File Planner Wiring Usage

## Purpose
Document the implemented MVP behavior for task plan file planner wiring.

The wiring layer turns already-produced parser and mapping stage data into a
safe planner handoff result shape. It is a pure in-memory orchestration helper,
not CLI integration and not task execution.

## Current MVP Behavior
- The wiring logic is pure and deterministic.
- The wiring logic uses in-memory stage/result data only.
- The wiring logic does not read task files.
- The wiring logic does not run the parser from the filesystem.
- The wiring logic does not run the mapper from the filesystem.
- The wiring logic does not call `planAgenticRunner()` directly.
- Planner execution is possible only through an optional dependency-injected
  in-memory planner function and only after all gates pass.
- Fail-closed gates block unsafe parser, mapping, and planner states.
- Outputs are payload shapes only, not CLI rendering.

## What Wiring Logic Does
- Builds parser, mapping, planner, and safety stages from represented input.
- Normalizes parser, mapping, planner, and safety issues.
- Evaluates parser, validation, mapping, planning-input, no-execution,
  no-write, verifier, and completion gates.
- Calls an optional injected planner only after all gates pass.
- Produces deterministic human and JSON output payload objects.
- Maps final status to stable exit code contract names.
- Keeps side-effect flags explicitly false.

## What Wiring Logic Does Not Do
- It does not run CLI behavior.
- It does not read or write files.
- It does not run the parser from disk.
- It does not run the mapper from disk.
- It does not call `planAgenticRunner()` directly.
- It does not run runner execution.
- It does not call model or tool adapters.
- It does not write audit events.
- It does not run the verifier.
- It does not persist task state.
- It does not mutate the filesystem.
- It does not create completed state.
- It does not trust task or model text claims of completion, approval, or
  verification.

## Input Model
The wiring helper accepts `TaskPlanFilePlannerWiringInput`:

- `taskFile`;
- optional `argv`;
- `json`;
- `mode`: `plan`, `dry_run`, `validate`, or `unknown`;
- optional in-memory `parserRequest`;
- optional in-memory `parserResult`;
- optional mapping options;
- optional in-memory `mappingResult`;
- optional in-memory `plannerInput`;
- optional planner options;
- `noExecution: true`;
- `noWrites: true`.

Current safe planning behavior is for `mode: "plan"` with parser and mapping
results already supplied by the caller.

## Stage Model
The result contains four stages:

- `parse`: parser handoff status and validation compatibility.
- `mapping`: mapping handoff status and planner-input gates.
- `planner`: optional injected planner handoff status.
- `safety`: no-execution, no-write, and side-effect blockers.

## Parser Stage
The parser stage is eligible only when:

- parser result was attempted;
- parser result is ok;
- `pathOk` is true;
- `parseOk` is true;
- validation is compatible;
- no unsafe represented runtime truth claims are present.

The wiring logic does not parse files itself. Missing, failed, or unsafe parser
handoffs fail closed.

## Mapping Stage
The mapping stage is eligible only when:

- mapping result was attempted;
- mapping result is ok;
- mapping status is `mapped`;
- mapping is supported;
- runner planning input is available;
- `noExecution` is proven;
- `noWrites` is proven;
- verifier is required;
- completion is gated by verifier;
- no unsafe represented runtime truth claims are present.

Unsupported mapping is reported as `unsupported_mapping`. Failed, unknown, or
unsafe mapping states fail closed.

## Planner Stage
The planner stage runs only when all parser, validation, mapping, planning, and
safety gates pass and an in-memory planner dependency is supplied.

The dependency-injected planner behavior is gate-protected:

- a supplied planner is called once after successful gates;
- it is not called for parser failure;
- it is not called for validation failure;
- it is not called for unsupported mapping;
- it is not called for missing no-execution or no-write proof;
- it is not called for missing verifier-gated completion;
- an unsafe planner result is discarded and reported as `planner_failed`.

The implementation records `plannerExecuted: false` and
`plannerExecutedHere: false` because this layer represents planner handoff
payloads and safety state, not CLI execution.

## Safety Stage
The safety stage always reports these side-effect flags as false:

- `executionEnabled`;
- `adapterCalls`;
- `auditWrites`;
- `verifierRun`;
- `persistence`;
- `filesystemMutation`;
- `completedStateCreated`.

It also records:

- `parserExecutedHere: false`;
- `mapperExecutedHere: false`;
- `plannerExecutedHere: false`;
- `noExecution: true`;
- `noWrites: true`.

## Human Output Payload
`createTaskPlanFileHumanOutput()` returns a payload with:

- title;
- task id;
- source file;
- mode;
- parsed;
- mapping status;
- planning status;
- work item, batch, and step counts;
- policy;
- approval required;
- verifier required;
- completion gated by verifier;
- audit expected;
- real execution false;
- adapter calls false;
- audit writes false;
- verifier run false;
- persistence false;
- issues.

This is a data shape for rendering. It is not CLI output.

## JSON Output Payload
`createTaskPlanFileJsonOutput()` returns one object shaped like:

```json
{
  "ok": false,
  "status": "blocked",
  "exitCode": "blocked",
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

In the current TypeScript contract, safety fields are represented at top level
on the JSON payload and in `summary`; the full `safety` stage remains available
on the wiring result.

## Exit Code Mapping
Exact current status-to-exit-code contract names:

- `planned` -> `success`
- `parser_failed` -> `parser_failure`
- `validation_failed` -> `validation_failure`
- `unsupported_mapping` -> `unsupported_mapping`
- `mapping_failed` -> `mapping_failure`
- `planner_failed` -> `planner_failure`
- `blocked` -> `blocked`
- `failed` -> `unknown_failure`
- `unknown` -> `unknown_failure`

## Fail-Closed Gates
Planner handoff is blocked when any of these conditions is represented:

- parse attempted false;
- parse ok false;
- `pathOk` false;
- `parseOk` false;
- validation incompatible or failed;
- mapping attempted false;
- mapping ok false;
- mapping unsupported, failed, or unknown;
- `planningInputAvailable` false;
- `noExecution` false;
- `noWrites` false;
- `verifierRequired` false;
- `completionGatedByVerifier` false;
- `executionEnabled` true;
- `adapterCalls` true;
- `auditWrites` true;
- `verifierRun` true;
- `persistence` true;
- `filesystemMutation` true;
- `completedStateCreated` true.

## Successful Planning Handoff Requirements
Successful planning handoff requires:

- parser ok;
- `pathOk` true;
- `parseOk` true;
- validation compatible;
- mapping ok;
- supported mapping;
- planning input available;
- `noExecution` true;
- `noWrites` true;
- `verifierRequired` true;
- `completionGatedByVerifier` true;
- side-effect flags false;
- injected planner success if supplied.

## Summary Fields
The summary exposes:

- `parsed`;
- `mapped`;
- `planned`;
- `workItemCount`;
- `batchCount`;
- `planStepCount`;
- `issueCount`;
- `json`;
- `noExecution`;
- `noWrites`;
- `executionEnabled`;
- `adapterCalls`;
- `auditWrites`;
- `verifierRun`;
- `persistence`;
- `filesystemMutation`;
- `completedStateCreated`;
- `verifierRequired`;
- `completionGatedByVerifier`;
- `mappingSupported`;
- `planningInputAvailable`.

## Safety Guarantees
The MVP guarantees no real execution or writes. It does not:

- run CLI behavior;
- read or write files;
- run parser from disk;
- run mapper from disk;
- call `planAgenticRunner()` directly;
- run runner execution;
- call model/tool adapters;
- write audit events;
- run verifier;
- persist task state;
- mutate filesystem;
- create completed state;
- trust task/model text claims of completion, approval, or verification.

## Hostile/Self-Report Metadata Handling
TASK-0260 hardening made unsafe represented runtime truth claims deterministic
blockers.

Represented metadata claiming `verifierRun`, `filesystemMutation`,
`completedStateCreated`, or similar unsafe side effects fails closed. Parser,
mapping, planner input, and planner output payloads cannot claim completed state
to bypass gates.

Model/task text claims such as completed, approved, verified, or all done are
not trusted. Text claims do not create completion, approval, verifier evidence,
or completed state.

## MVP Limitations
- No CLI integration yet.
- No filesystem parser integration in this wiring layer.
- No filesystem mapper integration in this wiring layer.
- No direct `planAgenticRunner()` import or call.
- No persistence.
- No audit runtime.
- No verifier runtime.
- No runner execution.
- No completed state.
- Output helpers return payload shapes only.

## Later Scope
- CLI command integration that calls parser and mapper from explicit files.
- Direct production planner wiring only after a separate safety review.
- Rendered human and JSON CLI output.
- Optional plan persistence behind explicit write-enabled design.
- Verifier runtime handoff in verify or execution flows.
- Real execution only after separate execution safety review.
