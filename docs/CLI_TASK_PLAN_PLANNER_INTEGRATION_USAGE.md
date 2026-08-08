# CLI Task Plan Planner Integration Usage

## Purpose
Document the implemented MVP behavior for CLI task plan planner integration.

This layer models how parser, mapper, wiring, and planner handoff data combine
for a future `aeos task plan <task-file>` command. It is a pure helper layer,
not CLI command wiring, output printing, filesystem parsing, execution, or
persistence.

## Current MVP Behavior
- The integration logic is pure and deterministic.
- It operates on in-memory data and explicit dependencies.
- It does not modify CLI commands.
- It does not render or print output.
- It does not read or write files.
- It does not call `planAgenticRunner()` directly.
- Planner execution is possible only through dependency-injected planner
  behavior after all gates pass.
- Output models are render payloads only.
- JSON-only behavior is represented as a payload/model, not printed here.

## What The Integration Logic Does
- Builds parser, mapping, wiring, planner, safety, human render, JSON render,
  JSON-only, issue, exit-code, and summary models.
- Normalizes parser, mapping, planner, wiring, and safety issues.
- Evaluates fail-closed gates before planner invocation.
- Allows a supplied fake or real planner dependency only when every parser,
  mapping, wiring, no-execution, no-write, verifier, and safety gate passes.
- Maps final statuses to stable exit-code contract names.

## What The Integration Logic Does Not Do
- It does not implement or change CLI commands.
- It does not parse argv beyond represented command data.
- It does not render to stdout or stderr.
- It does not read task files or write files.
- It does not call the parser or mapper from the filesystem.
- It does not import or directly call `planAgenticRunner()`.
- It does not run task execution, model/tool adapters, audit writes, verifier
  runtime, persistence, filesystem mutation, or completed-state creation.
- It does not trust task/model text claims of completion, approval, or
  verification.

## Input Model
The integration input is represented in-memory data:

- `taskFile`, `argv`, `command`, `json`, and `mode`;
- optional parser request and parser result;
- optional mapping options and mapping result;
- optional references for parser, mapping, wiring, and planner dependency;
- `noExecution: true`;
- `noWrites: true`.

Top-level input is not execution authority. It cannot authorize planning without
a valid mapping-produced runner planning input.

## Parser Integration Stage
Parser stage succeeds only when:

- parser result was attempted;
- parser result `ok` is true;
- `summary.pathOk` is true;
- `summary.parseOk` is true;
- validation status is `pass`;
- validation produced a compatible task contract;
- represented parser data contains no unsafe runtime truth claims.

Parser failure, missing parser result, path failure, parse failure, validation
failure, validation incompatibility, unsafe metadata, parser claims of runner
planning execution, parser claims of persistence, or parser trust in model
self-reporting fail closed.

## Mapping Integration Stage
Mapping stage succeeds only when:

- mapping result was attempted;
- mapping result `ok` is true;
- mapping status is `mapped`;
- `mappingResult.planningInput.runnerPlanningInput` exists;
- no-execution and no-write proof are strictly true on the actual runner
  planning input metadata;
- verifier proof is strictly true on the actual runner planning input verifier
  requirements;
- represented mapping data contains no unsafe runtime truth claims.

Unsupported mapping returns `unsupported_mapping`. Missing or unsafe runner
planning input returns a blocked or mapping-failure model. Summary claims are
additional consistency checks, not substitutes for the runner planning input.

## Wiring Integration Stage
Wiring stage represents whether dependency-injected planner invocation is
allowed. It records:

- `plannerDependencyInjected`;
- `plannerInvocationAllowed`;
- `dependencyInjectedPlannerOnly: true`;
- `topLevelPlannerInputBypassAllowed: false`.

Wiring is blocked if prior gates fail or if a planner dependency is missing
when all other safety gates have passed. A missing planner dependency maps to
`wiring_failed` / `wiring_failure`.

## Planner Integration Stage
Planner stage is attempted only after all gates pass and a planner dependency is
supplied. The dependency receives exactly:

```text
mappingResult.planningInput.runnerPlanningInput
```

The integration does not synthesize planner input from parser data, top-level
`plannerInput`, task prose, model output, or CLI-local metadata. A failed or
unsafe planner result is reported as `planner_failed`.

## Safety Integration Stage
The safety model keeps all side-effect flags false:

- `executionEnabled`;
- `adapterCalls`;
- `auditWrites`;
- `verifierRun`;
- `persistence`;
- `filesystemMutation`;
- `completedStateCreated`.

It also records `noExecution: true`, `noWrites: true`,
`dependencyInjectedPlannerOnly: true`, and
`topLevelPlannerInputBypassAllowed: false`.

## Human Render Model
The human render model is a payload only. It includes task id, source file, mode,
parsed status, mapping status, planning status, work item count, batch count,
step count, policy and approval flags, verifier flags, audit expectation,
side-effect flags, and issues. This layer does not print it.

## JSON Render Model
The JSON render model is a payload only:

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
  "wiring": {},
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

## JSON-Only Behavior
When JSON is requested, the JSON-only behavior model records:

- `suppressHumanOutput: true`;
- `validJsonOnly: true`;
- `noProsePrefix: true`;
- `noProseSuffix: true`;
- `noStackTraces: true`;
- `noRawEngineErrors: true`;
- `deterministicIssues: true`.

This layer creates JSON render models only. It does not print JSON.

## Exit Code Mapping
Exact current status-to-exit-code contract names:

- `planned` -> `success`
- `parser_failed` -> `parser_failure`
- `validation_failed` -> `validation_failure`
- `unsupported_mapping` -> `unsupported_mapping`
- `mapping_failed` -> `mapping_failure`
- `wiring_failed` -> `wiring_failure`
- `planner_failed` -> `planner_failure`
- `blocked` -> `blocked`
- `failed` -> `unknown_failure`
- `unknown` -> `unknown_failure`

## Fail-Closed Gates
Planner invocation is blocked when any of these conditions is represented:

- parser attempted false;
- parser ok false;
- `pathOk` false;
- `parseOk` false;
- validation failed or incompatible;
- mapping attempted false;
- mapping ok false;
- mapping unsupported, failed, or unknown;
- `runnerPlanningInputAvailable` false;
- `mappingResult.planningInput.runnerPlanningInput` absent;
- `noExecution` or `noWrites` not strictly true on actual runner planning input
  metadata;
- `verifierRequired` or `completionGatedByVerifier` not strictly true on actual
  runner planning input verifier proof;
- wiring failed;
- planner dependency missing when required;
- `executionEnabled` true;
- `adapterCalls` true;
- `auditWrites` true;
- `verifierRun` true;
- `persistence` true;
- `filesystemMutation` true;
- `completedStateCreated` true.

## Dependency-Injected Planner Behavior
A fake or real planner dependency may be invoked only after all of these pass:

- parser ok;
- `pathOk` true;
- `parseOk` true;
- validation compatible;
- mapping ok;
- mapping status supported and `mapped`;
- `mappingResult.planningInput.runnerPlanningInput` exists;
- strict `noExecution` and `noWrites` proof on runner planning input metadata;
- strict `verifierRequired` and `completionGatedByVerifier` proof on runner
  planning input verifier requirements;
- wiring ok;
- planner dependency injected;
- all side-effect flags false.

No direct `planAgenticRunner()` call is used by this layer.

## noExecution/noWrites Proof Rules
Planner invocation requires:

- `mappingResult.planningInput.runnerPlanningInput.metadata.noExecution === true`
- `mappingResult.planningInput.runnerPlanningInput.metadata.noWrites === true`

TASK-0269-FIX made this strict. The integration fails closed for:

- missing noExecution;
- false noExecution;
- absent noExecution;
- non-true noExecution;
- missing noWrites;
- false noWrites;
- absent noWrites;
- non-true noWrites;
- noExecution/noWrites only present outside
  `mappingResult.planningInput.runnerPlanningInput.metadata`;
- contradictory top-level noExecution/noWrites claims.

The mapping summary must also be consistent, but summary or top-level claims do
not replace proof on the actual runner planning input metadata.

## Verifier Proof Rules
Planner invocation requires verifier proof from the actual
`mappingResult.planningInput.runnerPlanningInput.verifierRequirements`, not only
mapping or summary claims.

TASK-0270 made this strict. The integration fails closed for:

- missing verifierRequired proof;
- verifierRequired false;
- non-true verifierRequired;
- missing completionGatedByVerifier proof;
- completionGatedByVerifier false;
- non-true completionGatedByVerifier;
- contradictory runner verifier metadata;
- verifier proof only present in top-level or mapping summary claims.

## Top-Level plannerInput Bypass Prevention
Top-level `plannerInput` or planner references cannot authorize planner
invocation.

Required behavior:

- `mappingResult.planningInput.runnerPlanningInput` must exist;
- `runnerPlanningInputAvailable` alone is not enough if actual
  `runnerPlanningInput` is absent;
- safe-looking top-level metadata cannot bypass missing mapping runner planning
  input;
- `topLevelPlannerInputBypassAllowed` remains false.

## Unsafe Represented Metadata Handling
Unsafe represented input, stage, or output claims fail closed when they claim:

- `executionEnabled` true;
- `adapterCalls` true;
- `auditWrites` true;
- `verifierRun` true;
- `persistence` true;
- `filesystemMutation` true;
- `completedStateCreated` true;
- completed;
- approved;
- verified;
- all done.

Task/model self-report claims are not trusted and do not create completion,
approval, verifier evidence, persistence, or authorization.

## Summary Fields
The summary includes:

- `parsed`;
- `mapped`;
- `wired`;
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
- `runnerPlanningInputAvailable`;
- `plannerDependencyInjected`;
- `plannerInvocationAllowed`.

## Safety Guarantees
The integration logic does not:

- modify CLI commands;
- render output to stdout/stderr;
- read or write files;
- mutate filesystem;
- directly call `planAgenticRunner()`;
- run runner execution;
- call model/tool adapters;
- write audit events;
- run verifier;
- persist task state;
- create completed state;
- trust task/model text claims of completion, approval, or verification.

## MVP Limitations
- No CLI command changes yet.
- No output printing yet.
- No filesystem parser execution here.
- No filesystem mapper execution here.
- No direct production planner import or direct call.
- No persistence.
- No audit runtime.
- No verifier runtime.
- No runner execution.
- No completed state.

## Later CLI Integration Scope
Later CLI work may connect the command boundary to parser, mapper, wiring,
dependency-injected `planAgenticRunner`, human rendering, JSON rendering, and
process exit codes. That later work must preserve the same fail-closed gates and
must not add execution, writes, persistence, verifier runtime, or completion
claims without a separate safety-reviewed task.
