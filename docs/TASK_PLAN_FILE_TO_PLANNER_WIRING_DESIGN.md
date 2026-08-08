# Task Plan File To Planner Wiring Design

## Purpose
Design how future `aeos task plan <task-file>` wiring safely connects task plan
input parsing, task contract mapping, and `planAgenticRunner()`.

This is design-only for CLI integration. The current core MVP implements a pure
in-memory wiring helper with dependency-injected planner behavior only. It does
not implement CLI integration, filesystem parser/mapper execution, direct
planner execution, package changes, persistence, audit runtime, verifier
runtime, adapter calls, or task execution.

## Current Foundation Status
- `aeos task plan <task-file>` currently parses one local JSON task file and
  validates the current AEOS task contract, then exits non-zero because planner
  wiring is not enabled.
- `parseTaskPlanInputFile()` performs local path checks, JSON parsing,
  contract validation handoff, and an MVP mapping handoff boundary.
- `mapTaskContractToRunnerPlanningInput()` can map a validated task contract to
  a safe single-work-item fallback planning input when the shape is supported.
- Explicit `workItems`, `batches`, and unvalidated `resume` fields are
  unsupported by the mapper because the current `AeosTask` contract does not
  validate them.
- `planAgenticRunner()` is deterministic and side-effect-free over represented
  planning input.
- No task plan CLI path currently calls `planAgenticRunner()`.
- The core wiring helper does not import or call `planAgenticRunner()` directly.
  It can call only a supplied in-memory planner dependency after all gates pass.

## Why Wiring Is Needed
The CLI needs a narrow orchestration layer between parser output and runner
planning. Parsing proves path, JSON, and task-contract validity. Mapping proves
whether the validated contract can be represented as runner planning input.
Planning proves that represented work, batches, policy, audit expectations, and
verifier gates are internally coherent enough to print a plan.

Without this wiring, `aeos task plan <task-file>` can only report parsed input.
With unsafe wiring, it could overstate support, skip verifier gates, or imply
execution. The wiring must therefore fail closed at each handoff.

## Future CLI Wiring Responsibilities
- Accept exactly one parser result from `parseTaskPlanInputFile()`.
- Check parser path, parse, and validation handoff status before mapping.
- Call `mapTaskContractToRunnerPlanningInput()` only with validated task data,
  `mode: "plan"`, `noExecution: true`, and `noWrites: true`.
- Check mapping status, planning input availability, no-execution flags,
  no-write flags, verifier requirement, and completion gate before planning.
- Call planner logic only after all gates pass. In the current core MVP this is
  represented by a dependency-injected in-memory planner function, not a direct
  `planAgenticRunner()` import or call.
- Render honest human or JSON output from parser, mapping, and planner results.
- Preserve JSON-only behavior for `--json` success and failure paths.
- Return non-zero for parser failure, validation failure, unsupported mapping,
  unsafe mapping, unavailable planning input, planner non-ok, and unknown flags.

## Wiring Non-Responsibilities
The wiring must not:

- parse files itself beyond calling the parser;
- validate raw task contracts itself beyond checking parser validation handoff;
- implement mapper logic;
- implement runner planning logic;
- execute tasks;
- call model, agent, tool, MCP, policy, audit, verifier, memory, project, or
  template adapters;
- write audit events;
- run verifier logic;
- persist task, lifecycle, audit, plan, or resume state;
- mutate files;
- mark work items completed;
- mark work completed;
- run dry-run execution unless a later explicit command design requests it.

## Input Flow
```text
future aeos task plan <task-file>
   |
   v
parseTaskPlanInputFile()
   |
   v
mapTaskContractToRunnerPlanningInput()
   |
   v
planner dependency after gates pass
   |
   v
Task Plan output
```

Input rules:

- one explicit local task file;
- `.json` only for MVP;
- no remote URLs;
- no directories;
- no globs;
- no implicit repository scan;
- no broad context loading;
- no shell expansion or environment-variable expansion by the CLI;
- no writes to the task file or project files.

## Output Flow
The CLI output combines four layers:

- parser summary: source file, path check, parse status, validation handoff;
- mapping summary: mapping status, counts, safety flags, verifier gates;
- planner summary: work items, batches, steps, policy, audit, verifier, resume,
  issues;
- command safety summary: execution and all side effects remain false.

Human mode may use compact labels. JSON mode must emit exactly one JSON object
and no surrounding text.

## Parser Integration
The CLI should call `parseTaskPlanInputFile()` with:

- `mode: "plan"`;
- `expectedFormat: "json"`;
- `allowAbsolutePath: false`;
- `allowParentTraversal: false`;
- `requireJsonObject: true`;
- `validateContract: true`;
- mapping handoff disabled or treated only as parser-local compatibility until
  core mapper wiring replaces it;
- `noExecution: true`;
- `noWrites: true`;
- `trustModelSelfReporting: false`.

The parser result must be considered eligible for mapping only when:

- `summary.pathOk === true`;
- `summary.parseOk === true`;
- `validation.status === "pass"`;
- `validation.task` is available.

Any parser issue in path, format, parse, or validation phases blocks planning.

## Validation Handoff
Validation handoff is the boundary between parsed JSON and typed task contract
mapping. The CLI may proceed only when the handoff clearly represents a current
AEOS task contract that passed validation.

For MVP, if parser mapping handoff remains `unsupported` but parser validation
passed and the CLI directly invokes the core mapper with the parser's validated
task, that is compatible only when documented as a transitional handoff. The
CLI must not treat parser `mapping.status: "unsupported"` as planning-ready by
itself.

## Mapping Integration
The CLI should call `mapTaskContractToRunnerPlanningInput()` after parser
validation passes.

Required mapper input:

- `task`: parser validation task;
- `taskId`: parser validation task id or task id;
- `sourceFile`: parser source file;
- `mode: "plan"`;
- `validation.status: "pass"`;
- `validation.valid: true`;
- `validation.result`: parser validation result when available;
- `validation.issues`: parser validation issues;
- `options.allowSingleWorkItemFallback: true` for the MVP fallback path;
- `options.requireExplicitWorkItems: false` unless a later typed contract adds
  explicit work item support;
- `options.requireVerifier: true`;
- `options.createDefaultBatch: true`;
- `options.createAuditExpectations: true`;
- `options.createPolicyBoundary: true`;
- `options.createAdapterBoundary: true`;
- `noExecution: true`;
- `noWrites: true`.

The CLI must not pretend explicit `workItems` or `batches` are supported.
Contracts containing those unvalidated fields must produce unsupported mapping
output and a non-zero exit.

## Planner Handoff
The current core wiring helper may call only a dependency-injected in-memory
planner function, and future CLI wiring may call planner logic only when all
gates pass:

- parser result `summary.pathOk` is true;
- parser result `summary.parseOk` is true;
- validation handoff is compatible or clearly allowed for MVP;
- mapping result `status` is `mapped`;
- mapping result `planningInput.runnerPlanningInput` is available;
- mapping result `summary.noExecution` is true;
- mapping result `summary.noWrites` is true;
- mapping result `summary.verifierRequired` is true;
- mapping result `summary.completionGatedByVerifier` is true.

If any gate fails, the helper and future CLI must fail closed and must not call
planner logic.

## Planner Output Handling
Planner logic may produce planning output only. It must not execute the task.

After planner return:

- `ok: true` means the plan was produced and has no blocking planner issues.
- `ok: false` means planner issues or gates block the command.
- The CLI must preserve planner issues rather than hiding them.
- The CLI must not rewrite planner output to imply execution, verification,
  persistence, audit writes, or completion.
- Planner non-ok results exit non-zero.

## Human Output Shape
Successful human output:

```text
Task Plan

Task id: <task-id>
Source file: <task-file>
Mode: plan
Parsed: true
Mapping: mapped
Work items: <count>
Batches: <count>
Steps: <count>
Policy: <allowed|blocked|requires_approval|not_evaluated|unknown>
Approval required: <true|false>
Verifier required: true
Completion gated by verifier: true
Audit expected: <true|false>
Real execution: false
Adapter calls: false
Audit writes: false
Verifier run: false
Persistence: false
Issues: <count>
```

If issues are present, print a compact issue list after the count. The output
must be honest when the plan is a generic one-work-item fallback.

## JSON Output Shape
Successful JSON output:

```json
{
  "ok": true,
  "taskId": "...",
  "mode": "plan",
  "sourceFile": "...",
  "parse": {},
  "mapping": {},
  "plan": {},
  "policy": {},
  "verifier": {},
  "audit": {},
  "resume": {},
  "executionEnabled": false,
  "adapterCalls": false,
  "auditWrites": false,
  "verifierRun": false,
  "persistence": false,
  "issues": [],
  "summary": {}
}
```

Fail-closed JSON output for unsupported mapping:

```json
{
  "ok": false,
  "status": "unsupported_mapping",
  "mode": "plan",
  "sourceFile": "...",
  "parse": {},
  "mapping": {},
  "planningEnabled": false,
  "executionEnabled": false,
  "issues": [],
  "summary": {}
}
```

JSON output must not include raw prompts, full model outputs, raw command logs,
secrets, broad file contents, private reasoning traces, provider SDK objects, or
hidden tool arguments.

## Error Behavior
Expected error cases:

- missing file;
- invalid JSON;
- invalid contract;
- unsupported mapping;
- mapping lacks verifier requirement;
- mapping lacks `noExecution` or `noWrites`;
- planning input unavailable;
- `planAgenticRunner()` issue or non-ok result;
- unknown flags.

Human mode errors should be compact and deterministic. JSON mode errors must be
JSON-only. Expected input errors must not print stack traces.

## Exit Code Behavior
- Successful plan: `0`.
- Parser failure: non-zero.
- Validation failure: non-zero.
- Unsupported mapping: non-zero.
- Planner non-ok: non-zero.
- Unknown flags: non-zero.
- JSON mode errors: JSON-only plus non-zero.

## No-Execution Guarantees
`aeos task plan <task-file>` may run planning logic but must not execute the
task.

It must not:

- call model/tool adapters;
- call agent or MCP adapters;
- write audit events;
- run verifier;
- persist task state;
- mutate files;
- mark work completed;
- mark work items completed;
- run dry-run execution unless explicitly requested later.

## No-Write Guarantees
The MVP command remains read-only except for normal process stdout/stderr:

- no source writes;
- no generated files;
- no audit writes;
- no lifecycle writes;
- no resume cursor writes;
- no memory writes;
- no package writes;
- no Git writes;
- no deployment writes;
- no persistence writes.

Smoke tests must assert no new files are created in a temp directory during
success and failure paths.

## Safety Boundaries
- Fail closed unless every handoff gate is satisfied.
- Treat parser, mapper, and planner issues as authoritative blockers for their
  phase.
- Treat model or task prose completion claims as non-authoritative.
- Keep approval, policy, audit, verifier, and adapter state represented only.
- Do not broaden scope from task text, source file location, or repository
  contents.
- Do not infer inventory by scanning the repository.
- Do not persist plan output until a separate write-enabled design exists.
- Do not mark completion without verifier evidence in later execution work.

## MVP Scope
- CLI orchestration contract for parser to mapper to planner.
- Human and JSON output contracts for successful planner-only output.
- Fail-closed unsupported mapping output.
- Gating rules before `planAgenticRunner()`.
- Single-work-item fallback honesty.
- No-execution and no-write assertions.
- JSON-only assertions.
- Smoke requirements for parser, mapping, planner, and safety boundaries.

## Later Scope
- Typed explicit `workItems` in the task contract.
- Typed explicit `batches` in the task contract.
- Typed resume input and persisted resume state.
- Plan persistence behind an explicit write-enabled design.
- Policy adapter evaluation.
- Audit runtime writes during execution, not planning.
- Verifier runtime handoff during verify or execution, not planning.
- Dry-run execution command wiring.
- Real execution after a separate execution safety review.

## Non-Goals
- Implement CLI integration in this task.
- Implement mapper integration in this task.
- Run `planAgenticRunner()` in this task.
- Execute tasks.
- Add package dependencies.
- Modify package files.
- Modify app files.
- Persist task state.
- Support explicit `workItems` or `batches` before typed validation exists.
- Support Markdown, YAML, TOML, remote URLs, or implicit task discovery.

## Known Limitation
If the current mapper supports only the single-work-item fallback and explicit
`workItems` or `batches` are unsupported, CLI output must be honest.

The CLI may produce a generic one-work-item plan for supported minimal task
contracts only when this is documented and smoke-tested. It must not pretend
explicit `workItems` or `batches` are supported, and it must return
`unsupported_mapping` for contracts that rely on those fields.

## Implemented MVP Notes
- Wiring logic is implemented as pure deterministic in-memory logic.
- Direct `planAgenticRunner()` import/call is not used by the wiring logic.
- Planner dependency injection is gate-protected and optional.
- Fail-closed gates now block unsafe represented metadata from TASK-0260
  hostile metadata hardening.
- Hostile side-effect or completed-state claims are deterministic blockers.
- Top-level represented `plannerInput` cannot bypass a missing
  `mappingResult.planningInput.runnerPlanningInput` handoff.
- No CLI integration exists yet.
- No filesystem IO is performed by the wiring logic.
- No runner execution is performed.

## Smoke Test Requirements
A. A valid minimal task file plans successfully if the single-work-item fallback
mapping is supported.

B. An unsupported explicit `workItems` file fails closed.

C. Invalid JSON fails JSON-only.

D. Unsupported extension fails JSON-only.

E. Mapping without verifier requirement fails closed if representable.

F. A no-write assertion in a temp dir proves no files are created, deleted, or
modified.

G. A no-execution assertion proves:

- no adapter calls;
- no audit writes;
- no verifier run;
- no persistence.

H. JSON-only assertions cover success and failures.

## Implementation Sequence
Do not start these tasks from this design task.

1. TASK-0254: Implement task plan file planner wiring contracts.
   Purpose: add CLI-local output and guard contracts for parser, mapper, and
   planner wiring without invoking the planner.
   Likely files: `apps/cli/src/commands.ts`.
   Verification command: `pnpm --filter @aeos/cli check`.
   Recommended model effort: Medium.
   Classification: Code.

2. TASK-0255: Add task plan file planner wiring contract examples.
   Purpose: add success, unsupported mapping, unsafe mapping, and planner non-ok
   example output shapes for human and JSON rendering.
   Likely files: `apps/cli/src/commands.ts`, `apps/cli/scripts/smoke.mjs`.
   Verification command: `pnpm --filter @aeos/cli check`.
   Recommended model effort: Low.
   Classification: Code.

3. TASK-0256: Add parser-to-mapper input builder.
   Purpose: construct `TaskContractMappingInput` from parser validation handoff
   while preserving `noExecution: true`, `noWrites: true`, and MVP fallback
   options.
   Likely files: `apps/cli/src/commands.ts`.
   Verification command: `pnpm --filter @aeos/cli check`.
   Recommended model effort: Medium.
   Classification: Code.

4. TASK-0257: Add mapping gate helper for task plan CLI.
   Purpose: fail closed unless mapping status is `mapped`, planning input exists,
   no-execution/no-write flags are true, and verifier gates are true.
   Likely files: `apps/cli/src/commands.ts`.
   Verification command: `pnpm --filter @aeos/cli check`.
   Recommended model effort: Medium.
   Classification: Code.

5. TASK-0258: Add unsupported mapping JSON renderer.
   Purpose: emit the stable `unsupported_mapping` JSON shape with
   `planningEnabled: false` and `executionEnabled: false`.
   Likely files: `apps/cli/src/commands.ts`, `apps/cli/scripts/smoke.mjs`.
   Verification command: `pnpm --filter @aeos/cli check`.
   Recommended model effort: Medium.
   Classification: Code.

6. TASK-0259: Wire planner invocation behind gates.
   Purpose: call `planAgenticRunner()` only after parser and mapping gates pass,
   with no execution, no writes, no verifier run, no audit writes, and no
   persistence.
   Likely files: `apps/cli/src/commands.ts`.
   Verification command: `pnpm --filter @aeos/cli check`.
   Recommended model effort: High.
   Classification: Code.

7. TASK-0260: Render successful human task plan output.
   Purpose: print task id, source file, mode, parsed, mapping, counts, policy,
   approval, verifier, audit, side-effect flags, and issues.
   Likely files: `apps/cli/src/commands.ts`, `apps/cli/scripts/smoke.mjs`.
   Verification command: `pnpm --filter @aeos/cli check`.
   Recommended model effort: Medium.
   Classification: Code.

8. TASK-0261: Render successful JSON task plan output.
   Purpose: emit the stable JSON success shape with parse, mapping, plan,
   policy, verifier, audit, resume, safety flags, issues, and summary.
   Likely files: `apps/cli/src/commands.ts`, `apps/cli/scripts/smoke.mjs`.
   Verification command: `pnpm --filter @aeos/cli check`.
   Recommended model effort: Medium.
   Classification: Code.

9. TASK-0262: Add fail-closed planner non-ok handling.
   Purpose: return non-zero and JSON-only errors when planner issues or non-ok
   results block planning output.
   Likely files: `apps/cli/src/commands.ts`, `apps/cli/scripts/smoke.mjs`.
   Verification command: `pnpm --filter @aeos/cli check`.
   Recommended model effort: Medium.
   Classification: Code.

10. TASK-0263: Add explicit workItems and batches unsupported smokes.
    Purpose: prove task files with unvalidated explicit inventory fail closed
    and do not pretend multi-item planning is supported.
    Likely files: `apps/cli/scripts/smoke.mjs`.
    Verification command: `pnpm --filter @aeos/cli smoke`.
    Recommended model effort: Medium.
    Classification: Code.

11. TASK-0264: Add no-write and no-execution smokes for planner wiring.
    Purpose: assert no temp-dir writes, no adapter calls, no audit writes, no
    verifier run, no persistence, and no dry-run execution.
    Likely files: `apps/cli/scripts/smoke.mjs`.
    Verification command: `pnpm --filter @aeos/cli smoke`.
    Recommended model effort: High.
    Classification: Code.

12. TASK-0265: Add JSON-only smoke coverage for task plan planner wiring.
    Purpose: prove success, invalid JSON, unsupported extension, unsupported
    mapping, unsafe mapping, planner non-ok, and unknown flags emit exactly one
    JSON object.
    Likely files: `apps/cli/scripts/smoke.mjs`.
    Verification command: `pnpm --filter @aeos/cli smoke`.
    Recommended model effort: High.
    Classification: Code.

13. TASK-0266: Document implemented task plan planner wiring.
    Purpose: update usage docs after implementation with exact supported
    fallback behavior and remaining unsupported explicit inventory limits.
    Likely files: `docs/TASK_PLAN_INPUT_PARSER_USAGE.md`,
    `docs/TASK_CONTRACT_MAPPING_USAGE.md`,
    `docs/AGENTIC_RUNNER_PLANNING_USAGE.md`.
    Verification command: `git status --short`.
    Recommended model effort: Medium.
    Classification: Docs.
