# Agentic Task CLI Surface

## Purpose
Design the AEOS agentic task CLI surface for safe task planning, dry-run
execution preview, status, verification, resume, and later agent run flows.

This document is design-only. It does not implement CLI commands, runner
execution, adapter calls, persistence, audit runtime, verifier runtime, or
autonomous agent orchestration.

## Current Foundation Status
AEOS already has deterministic core contracts and helpers for agentic task
lifecycle state, coverage verification, runner planning, execution lifecycle
contracts, and dry-run previews.

Current foundation:

- `aeos task validate <path>` exists as task contract validation.
- `aeos task plan <task-file>` exists as parser-mapper-planner integration.
- `aeos task run --dry-run <task-file>` exists as a non-executing dry-run
  preview over the existing parser, mapper, planner, and dry-run contracts.
- `aeos task state init <task-file>` exists as the explicit persisted
  task-state initialization command.
- `aeos task state transition --preview <task-id> --intent <intent>
  --expected-revision <number>` exists as a read-only persisted-state transition
  evaluation command.
- `aeos task state transition <task-id> --intent <intent>
  --expected-revision <number>` exists as an explicit revision-guarded
  persisted-state transition apply command for the same closed intents.
- `aeos task status <task-id>` exists as a read-only persisted-state inspection
  command.
- `aeos task resume --preview <task-id>` exists as a read-only resume handoff
  preview.
- Runner planning logic is side-effect-free and creates planning results from
  represented input.
- Dry-run runner logic is side-effect-free and creates execution-shaped previews
  without adapter calls, audit writes, verifier runs, lifecycle mutation, or
  completion.
- Coverage verifier logic is deterministic and rejects incomplete work coverage.
- Policy, audit, and verification documents define required safety boundaries.
- No agentic task CLI runtime exists yet for `verify`, non-preview `resume`, or
  real task execution.
- No command currently performs real agentic runner execution.

## CLI Design Principles
- Keep the CLI a thin operator surface over core contracts.
- Prefer explicit task commands over hidden autonomous modes.
- Require explicit local task input; do not infer from model output.
- Keep MVP deterministic, local-first, and read-only by default.
- Preserve human and JSON output shapes as stable contracts.
- Make partial, blocked, denied, approval-required, and verifier-required states
  visible.
- Keep help text honest about what is implemented.

## Safety Principles
- Critical MVP rule: no command may perform real model or tool execution in the
  first CLI MVP.
- Planning and dry-run previews are allowed; real execution is blocked until an
  execution safety review is complete.
- Model and agent self-reporting are claims only, never completion proof.
- No command may broaden task scope, scan the repository implicitly, read hidden
  context, or write outside explicit task scope.
- Risky actions remain policy-gated and approval-gated.
- Completion remains verifier-gated and audit-aware.

## Command Groups
MVP agentic task command group:

- `aeos task plan`
- `aeos task run --dry-run`
- `aeos task status`
- `aeos task verify`
- `aeos task resume`

Later command groups:

- real task execution: `aeos task run`
- task cancellation: `aeos task cancel`
- future agent runs: `aeos agent run`
- audit inspection: `aeos audit`

## MVP Command Surface
### `aeos task plan`
Reads a local task contract/input, validates it, creates a runner planning
result, and prints a human task plan.

It must not execute work, call model adapters, call agent adapters, call tool
adapters, write audit events, run verifier logic, mutate lifecycle state, create
completed state, or infer missing scope from repository scans.

Verifier requirement must be visible even though the verifier is not run.

### `aeos task plan --json`
Same behavior as `aeos task plan`, but stdout is exactly one JSON object and no
human text. Unknown flags and validation errors must also be JSON-only.

### `aeos task run --dry-run`
Reads a local JSON task file, validates it, maps the task contract to
authoritative runner planning input, runs the dependency-injected planner after
strict safety/verifier gates pass, and creates an execution preview from the
resulting planning result.

It must not call model/tool adapters, write audit events, run verifier logic,
mutate lifecycle state, persist resume state, or mark the task completed.

Current MVP limitations:

- JSON task files only.
- No persistence and no audit writes.
- No real task execution without `--dry-run`.
- Explicit `workItems` and `batches` remain unsupported and fail closed.
- Planning must prove `metadata.noExecution === true`,
  `metadata.noWrites === true`, `verifierRequired === true`, and
  `completionGatedByVerifier === true` on the mapper-produced
  `runnerPlanningInput`; top-level or prose claims are not authority.

### `aeos task run --dry-run --json`
Same behavior as `aeos task run --dry-run`, but stdout is exactly one JSON
object and no human text. Adapter calls must be represented as not executed.

### `aeos task state init`
Creates authoritative persisted task state only when the operator explicitly
requests it:

```text
aeos task state init <task-file>
```

This command uses the same safe parser, validation, mapper, strict
runner-planning-input safety gates, and dependency-injected planner chain as
task planning. It then persists a non-terminal `planned` state at revision `1`
through the core task-state persistence API.

It must not execute work, call adapters, write audit events, run verifiers,
create completed state, mutate the source task file, or write outside
`.aeos/state/tasks/<task-id>.json`.

Existing task state is not overwritten. Repeated initialization fails closed
with `task_state_already_exists`; no `--force` mode exists in this MVP.

Task prose or model-like claims such as completed, approved, verified, all done,
or execution succeeded are not completion proof and cannot initialize a terminal
state. Completion remains verifier-gated and unsatisfied.

### `aeos task state init --json`
Same initialization behavior as human mode, but stdout is exactly one JSON
object. Failures are JSON-only with deterministic issue codes and no raw runtime
stack traces.

### `aeos task state transition --preview`
Loads authoritative persisted task state by task id and evaluates a closed
system-owned lifecycle transition without writing:

```text
aeos task state transition --preview <task-id> --intent <intent> --expected-revision <number>
```

The command reports the source revision, current lifecycle, intent, target
lifecycle, whether the transition is allowed, required/accepted evidence,
blocking issues, and explicit read-only safety markers.

It must not save state, increment revision, mutate lifecycle state, execute
work, call adapters, write audit events, run verifiers, persist resume data, or
create completed, verified, approval, or verification state.

Supported intents are closed and system-owned:

- `mark_dry_run_ready`
- `require_verification`
- `mark_blocked`

No arbitrary target state is accepted. Flags or values such as `--to`,
`--target`, `--state`, `completed`, `verified`, `approved`,
`execution_success`, `mark_completed`, or `mark_verified` fail closed. No
operator override or `--force` exists.

`--expected-revision` is required and must be a positive integer. Stale
expected revisions fail with `task_state_revision_conflict`; malformed,
negative, zero, decimal, or non-number revisions fail before evaluation.

Preview does not accept arbitrary JSON evidence. Evidence must be typed and
system-derived from authoritative persisted state. If required evidence is not
available, the preview completes with `transitionAllowed: false` and reports the
core transition issue instead of inventing evidence. Task prose and model
self-report text remain non-authoritative.

### `aeos task state transition --preview --json`
Same preview behavior as human mode, but stdout is exactly one JSON object.
A supported intent with insufficient evidence is a successful preview object
with `transitionAllowed: false`. Malformed commands, unsafe task ids, missing or
corrupt state, forged terminal state, and revision conflicts exit non-zero with
deterministic JSON errors.

### `aeos task state transition`
Applies one closed, system-owned persisted task-state transition:

```text
aeos task state transition <task-id> --intent <intent> --expected-revision <number>
```

`--expected-revision` is mandatory for writes and must be a positive integer.
Apply never silently uses the latest revision and has no `--force` mode.

Preview is not authorization. Apply reloads authoritative persisted state,
validates it, compares the expected revision, derives typed system evidence from
that current state, evaluates the same closed transition policy as preview, and
then writes through the core revision-guarded transition API. A successful apply
increments the revision exactly once and returns the previous revision/lifecycle
and new revision/lifecycle.

Apply accepts only:

- `mark_dry_run_ready`
- `require_verification`
- `mark_blocked`

It accepts no arbitrary targets such as `--to`, `--target`, or `--state`, and
it accepts no arbitrary `--evidence-json`, proof text, model prose, or operator
free-form evidence. `mark_dry_run_ready` remains blocked until authoritative
persisted dry-run evidence exists; the current dry-run command remains read-only
and does not create that evidence. Terminal-style intents such as `completed`,
`verified`, `approved`, `execution_success`, `mark_completed`, and
`mark_verified` fail closed.

Transition apply does not execute task work, call adapters, write audit events,
run verifiers, persist external resume cursors, create completion, or create
verification. Failed or blocked apply preserves bytes, revision, lifecycle, and
reliable mtime.

### `aeos task state transition --json`
Same apply behavior as human mode, but stdout is exactly one JSON object.
Failures are JSON-only with deterministic issue codes and no raw runtime stack
traces.

### `aeos task status`
Loads authoritative persisted task state by task id from the project-local state
store:

```text
.aeos/state/tasks/<task-id>.json
```

It shows task id, source revision, lifecycle, source reference, work item and
batch counts, pending and retryable counts, current and next batch references,
verifier requirement, completion gate, resume availability, issues, and explicit
read-only safety markers.

It must not create state, save state, increment revision, persist a cursor,
execute work, retry work, call adapters, write audit events, run verifiers,
mutate files, or create completed state. Missing, corrupt, invalid, forged, and
unsafe path/symlink state fails closed.

### `aeos task status --json`
Same status behavior as human mode, but stdout is exactly one JSON object.
Errors are JSON-only with deterministic codes and no raw runtime stack traces.

### `aeos task verify`
Future verifier command that uses the coverage verifier against structured
lifecycle evidence. Model self-reporting is not accepted as verification.

MVP may report unavailable until verifier CLI wiring and persistence/evidence
loading exist.

### `aeos task verify --json`
Same verifier behavior as human mode, with JSON-only output.

### `aeos task resume`
Non-preview resume execution is not implemented. `aeos task resume <task-id>`
fails closed with `task_resume_execution_not_implemented` and performs no
execution or writes.

### `aeos task resume --preview`
Loads authoritative persisted task state by task id and derives a read-only
resume handoff. It shows source revision, lifecycle, resume eligibility,
pending and retryable work, remaining work count, current and next batch
references, verifier gate, blocked reason, issues, and no-execution/no-write
safety markers.

The preview may succeed with `resumeAllowed: false` when the persisted state is
valid but not structurally resumable. Invalid or corrupt state exits non-zero.
The command does not execute work, call adapters, write audit events, run
verifiers, mutate lifecycle state, increment revision, save state, or persist a
resume cursor.

### `aeos task resume --preview --json`
Same preview behavior as human mode, but stdout is exactly one JSON object.
Errors are JSON-only with deterministic codes and no raw runtime stack traces.

## Later Command Surface
Later commands require a separate safety review and implementation plan:

- `aeos task run`
- `aeos task run --json`
- `aeos task cancel`
- `aeos agent run`
- `aeos agent run --dry-run`
- `aeos audit`
- `aeos audit --json`

Real `aeos task run` and `aeos agent run` must remain unavailable until policy,
approval, audit, verifier, adapter, persistence, and resume behavior are
implemented and reviewed.

`aeos task run <task-file>` without `--dry-run` fails closed with real execution
reported as unavailable.

## Human Output Principles
Human output should be compact, stable, and explicit about non-execution.

Task plan output should include:

```text
Task Plan
Task id: sitemap-audit
Mode: plan
Work items: 400
Batches: 4
Policy: allowed|blocked|requires_approval|not_evaluated
Approval required: false
Verifier required: true
Audit expected: true
Issues: 0
```

Dry-run output should include:

```text
Task Dry Run
Task id: sitemap-audit
State: verification_required
Planned steps: 7
Planned batches: 4
Planned work items: 400
Adapter calls: not executed
Audit writes: false
Verifier run: false
Completed: false
Issues: 0
```

Human output must not imply real execution, autonomous progress, emitted audit
events, verifier success, persisted status, or completed state unless those are
actually implemented and evidenced.

## JSON Output Principles
JSON mode must emit only JSON on stdout. No banners, warnings, stack traces,
progress text, or mixed human output may appear.

JSON must be deterministic, compact, and safe to serialize. It must not contain
raw prompts, full model outputs, raw command logs, secrets, broad file contents,
private reasoning traces, provider SDK objects, or hidden tool arguments.

Task plan JSON concept:

```json
{
  "ok": true,
  "taskId": "...",
  "mode": "plan",
  "plan": {},
  "policy": {},
  "verifier": {},
  "audit": {},
  "resume": {},
  "issues": [],
  "summary": {}
}
```

Dry-run JSON concept:

```json
{
  "ok": true,
  "taskId": "...",
  "mode": "dry_run",
  "state": "...",
  "steps": [],
  "batches": [],
  "workItems": [],
  "adapterCalls": [],
  "audit": {},
  "verifier": {},
  "resume": {},
  "issues": [],
  "summary": {}
}
```

## Exit Code Principles
- Successful plan or dry-run preview: `0`.
- Invalid task contract/input: non-zero.
- Unknown command or flag: non-zero.
- Blocked policy: non-zero when it prevents the requested command from
  producing an executable preview; otherwise `ok: false` with explicit blocked
  state according to the command design.
- Approval required: non-zero when execution would be blocked; human output must
  say approval is required.
- JSON mode must still emit JSON-only output for errors, unknown flags, invalid
  input, blocked policy, and unavailable persistence/runtime features.

## State Persistence Expectations
MVP planning and dry-run commands do not write state by default.

The explicit initialization write boundary is:

```text
aeos task state init <task-file>
```

Persisted task state stores task contract reference, planning summary, lifecycle
state, work item state, batch state, verifier gate, completion gate, issues,
revision, and resume metadata. Status and resume preview commands read this
persisted evidence rather than model output or terminal history.

`verify` and non-preview `resume` remain honest about unavailable runtime
behavior.

## No-Write / Default Behavior
The first MVP is read-only by default:

- no source writes;
- no lifecycle writes;
- no audit writes;
- no resume cursor writes;
- no memory writes;
- no package or dependency changes;
- no Git writes;
- no deployments;
- no network side effects.

Any future write mode must be explicit, scoped, policy-checked, approval-aware,
audited, and tested separately.

## Policy / Approval Behavior
Plan and dry-run commands represent policy and approval requirements from input.
They do not call a policy adapter or grant approval.

Denied or blocked policy must prevent runnable execution steps. Approval-required
actions must show the required action and scope and stop before adapter calls.
Approval does not broaden the task contract.

## Audit Behavior
Plan and dry-run commands may show expected audit event ids and required event
kinds, but they must not append audit events.

Audit status in MVP output is planned, missing, partial from input, or
not-required. It is never evidence of emitted runtime audit events unless the
input already contains explicit persisted evidence.

## Verifier Behavior
Planning must make verifier requirements visible for executable plans. Dry-run
must show the verifier as required but not run.

`aeos task verify` is later runtime wiring over the coverage verifier. It must
verify structured evidence and must reject model self-reporting as completion
proof.

## Resume / Retry Behavior
Resume is state-driven:

- use persisted lifecycle state and resume cursor;
- derive remaining work from pending and retryable work item ids;
- do not ask the model what remains;
- do not count duplicate completions;
- do not rerun verified items by default;
- create dry-run resume preview before real resume execution;
- keep non-retryable failures failed until scope, input, policy, or environment
  changes.

## Dry-Run Behavior
Dry-run previews later execution without side effects.

Dry-run must report:

- planned steps, batches, and work items;
- planned adapter calls as not executed;
- `audit.wouldWriteAudit: false`;
- `verifier.wouldRunVerifier: false`;
- `completionGateSatisfied: false`;
- `Completed: false`;
- pending or verification-required state, unless blocked or failed by explicit
  input issues.

Dry-run must never return `completed`.

## Input Strategy
MVP should accept a local task contract file path later, for example:

```text
aeos task plan <path>
aeos task run <path> --dry-run
```

Input constraints:

- no remote task source in MVP;
- no arbitrary shell execution from task input;
- no implicit repo scan;
- no hidden autonomous mode;
- no broad unlisted context loading;
- no model-generated task scope expansion.

## Help Behavior
Help must list only implemented or explicitly unavailable commands.

Help must not overpromise:

- real execution;
- autonomous agent runs;
- model, agent, tool, or MCP adapter calls;
- audit runtime writes;
- verifier CLI behavior if not implemented;
- persistence if not implemented;
- production orchestration;
- remote task sources;
- arbitrary shell execution.

Unimplemented commands should be absent from help or marked as unavailable with
clear non-execution language.

## MVP Scope
- Design and implement command parsing for the MVP surface.
- Render safe human and JSON output for plan and dry-run.
- Wire plan and dry-run to existing side-effect-free core helpers.
- Render read-only persisted-state status and resume preview output.
- Return explicit unavailable results for verify and non-preview resume until
  evidence loading and execution runtime exist.
- Add smoke tests for no-write behavior, JSON-only output, unknown flags, and
  no overpromised help text.

## Later Scope
- Real `aeos task run` after execution safety review.
- Persistent state store and status loading.
- Runtime policy adapter evaluation.
- Runtime audit event append.
- Runtime coverage verifier command.
- Resume from persisted cursor.
- Cancellation.
- Agent run and agent dry-run flows.
- Audit inspection and JSON audit output.
- Richer schemas and report artifacts.

## Non-Goals
- Implement CLI commands in this design task.
- Implement runner execution in this design task.
- Add package dependencies.
- Modify package files.
- Deploy, push, migrate, or write Git state.
- Trust model self-reporting.
- Support hidden autonomous execution.
- Support remote task sources in MVP.

## Sitemap Example
Command sequence:

```text
aeos task plan sitemap-audit
```

Expected human summary:

```text
Task Plan
Task id: sitemap-audit
Mode: plan
Work items: 400
Batches: 4
Policy: allowed
Approval required: false
Verifier required: true
Audit expected: true
Issues: 0
```

Dry-run:

```text
aeos task run sitemap-audit --dry-run
```

Expected dry-run summary:

```text
Task Dry Run
Task id: sitemap-audit
State: verification_required
Planned steps: 7
Planned batches: 4
Planned work items: 400
Adapter calls: not executed
Audit writes: false
Verifier run: false
Completed: false
Issues: 0
```

If only 20 of 400 items are later processed, verifier accounting remains:

```text
400 != 20 + 0 + 0
```

The remaining 380 work items stay pending or retryable. Completion remains
false until structured evidence passes the verifier.

## Smoke Test Requirements
Future CLI smoke tests should prove:

- `aeos task plan` prints `Task Plan`.
- `aeos task plan --json` emits exactly one JSON object.
- invalid task contract exits non-zero.
- unknown flags exit non-zero.
- unknown flags in JSON mode emit JSON-only errors.
- `aeos task plan` does not call adapters.
- `aeos task plan` does not write audit events.
- `aeos task plan` shows verifier required for executable plans.
- `aeos task run --dry-run` prints `Task Dry Run`.
- `aeos task run --dry-run --json` emits exactly one JSON object.
- dry-run reports adapter calls not executed.
- dry-run reports audit writes false.
- dry-run reports verifier run false.
- dry-run reports completed false.
- dry-run creates no lifecycle or resume persistence.
- `aeos task state init <task-file> --json` creates revision-1 planned state.
- repeated state init fails closed without overwriting.
- invalid, unsupported, traversal, and symlink init failures create no state.
- self-report text cannot create completed, approved, verified, or execution
  success state.
- status reads persisted state only and fails closed when state is absent.
- verify reports unavailable until evidence loading exists.
- resume preview reads persisted state only, preserves revision, writes no
  cursor, and does not duplicate completion.
- help does not overpromise real execution, autonomous agent runs, audit runtime,
  verifier runtime, persistence, remote sources, or production orchestration.

## Implementation Sequence
Do not start these tasks from this design task.

1. TASK-0228: Implement agentic task CLI contract/output design.
   Purpose: add CLI-local output contracts and render helpers for plan,
   dry-run, unavailable, and JSON error shapes.
   Likely files: `apps/cli/src/commands.ts`, `apps/cli/src/output.ts`.
   Verification command: `pnpm --filter @aeos/cli check`.
   Recommended model effort: Medium.
   Classification: Code.

2. TASK-0229: Add agentic task CLI help guardrails.
   Purpose: update CLI help so MVP commands are listed only with no-execution
   language and unsupported runtime behavior is not promised.
   Likely files: `apps/cli/src/commands.ts`, `apps/cli/scripts/smoke.mjs`.
   Verification command: `pnpm --filter @aeos/cli check`.
   Recommended model effort: Low.
   Classification: Code.

3. TASK-0230: Add agentic task plan command parser shell.
   Purpose: parse `aeos task plan [path] [--json]`, reject unknown flags, and
   keep output JSON-only in JSON mode.
   Likely files: `apps/cli/src/commands.ts`.
   Verification command: `pnpm --filter @aeos/cli check`.
   Recommended model effort: Medium.
   Classification: Code.

4. TASK-0231: Add local task contract input loader for plan.
   Purpose: load one explicit local task contract path without remote sources,
   arbitrary shell execution, or implicit repository scans.
   Likely files: `apps/cli/src/commands.ts`.
   Verification command: `pnpm --filter @aeos/cli check`.
   Recommended model effort: Medium.
   Classification: Code.

5. TASK-0232: Wire task plan to core planning helper.
   Purpose: convert validated task input into represented planning input and
   call the side-effect-free runner planner.
   Likely files: `apps/cli/src/commands.ts`, `packages/core/src/agentic-runner-planning.ts`.
   Verification command: `pnpm --filter @aeos/cli check`.
   Recommended model effort: High.
   Classification: Code.

6. TASK-0233: Render human task plan output.
   Purpose: print Task Plan, task id, mode, work items, batches, policy,
   approval required, verifier required, audit expected, and issues.
   Likely files: `apps/cli/src/commands.ts`, `apps/cli/src/output.ts`.
   Verification command: `pnpm --filter @aeos/cli check`.
   Recommended model effort: Medium.
   Classification: Code.

7. TASK-0234: Render JSON task plan output.
   Purpose: emit stable JSON-only plan output with `ok`, `taskId`, `mode`,
   `plan`, `policy`, `verifier`, `audit`, `resume`, `issues`, and `summary`.
   Likely files: `apps/cli/src/commands.ts`, `apps/cli/src/output.ts`.
   Verification command: `pnpm --filter @aeos/cli check`.
   Recommended model effort: Medium.
   Classification: Code.

8. TASK-0235: Add task dry-run command parser shell.
   Purpose: parse `aeos task run [path] --dry-run [--json]` and reject real
   `aeos task run` in MVP.
   Likely files: `apps/cli/src/commands.ts`.
   Verification command: `pnpm --filter @aeos/cli check`.
   Recommended model effort: Medium.
   Classification: Code.

9. TASK-0236: Convert planning output to dry-run preview input.
   Purpose: map planner steps, batches, work items, audit expectations,
   verifier requirements, policy, and resume fields to dry-run input.
   Likely files: `apps/cli/src/commands.ts`, `packages/core/src/agentic-runner-dry-run.ts`.
   Verification command: `pnpm --filter @aeos/cli check`.
   Recommended model effort: High.
   Classification: Code.

10. TASK-0237: Wire dry-run command to core dry-run helper.
    Purpose: call the side-effect-free dry-run helper and preserve no adapter,
    no audit, no verifier, and no lifecycle mutation guarantees.
    Likely files: `apps/cli/src/commands.ts`.
    Verification command: `pnpm --filter @aeos/cli check`.
    Recommended model effort: High.
    Classification: Code.

11. TASK-0238: Render human dry-run output.
    Purpose: print Task Dry Run, state, planned steps, planned batches, planned
    work items, adapter calls not executed, audit writes false, verifier run
    false, completed false, and issues.
    Likely files: `apps/cli/src/commands.ts`, `apps/cli/src/output.ts`.
    Verification command: `pnpm --filter @aeos/cli check`.
    Recommended model effort: Medium.
    Classification: Code.

12. TASK-0239: Render JSON dry-run output.
    Purpose: emit stable JSON-only dry-run output with `ok`, `taskId`, `mode`,
    `state`, `steps`, `batches`, `workItems`, `adapterCalls`, `audit`,
    `verifier`, `resume`, `issues`, and `summary`.
    Likely files: `apps/cli/src/commands.ts`, `apps/cli/src/output.ts`.
    Verification command: `pnpm --filter @aeos/cli check`.
    Recommended model effort: Medium.
    Classification: Code.

13. TASK-0240: Add unavailable status command behavior.
    Historical purpose: implement `aeos task status [--json]` as explicit
    unavailable or not-implemented output until persisted state exists.
    Current status: superseded by TASK-0280 read-only
    `aeos task status <task-id>`.
    Likely files: `apps/cli/src/commands.ts`, `apps/cli/src/output.ts`.
    Verification command: `pnpm --filter @aeos/cli check`.
    Recommended model effort: Low.
    Classification: Code.

14. TASK-0241: Add unavailable verify command behavior.
    Purpose: implement `aeos task verify [--json]` as explicit unavailable
    output until evidence loading and verifier CLI wiring exist.
    Likely files: `apps/cli/src/commands.ts`, `apps/cli/src/output.ts`.
    Verification command: `pnpm --filter @aeos/cli check`.
    Recommended model effort: Low.
    Classification: Code.

15. TASK-0242: Add resume dry-run/unavailable behavior.
    Historical purpose: implement `aeos task resume`, resume dry-run, and JSON
    unavailable output without duplicate completion or cursor writes.
    Current status: superseded by TASK-0280 read-only
    `aeos task resume --preview <task-id>`; non-preview resume still fails
    closed.
    Likely files: `apps/cli/src/commands.ts`, `apps/cli/src/output.ts`.
    Verification command: `pnpm --filter @aeos/cli check`.
    Recommended model effort: Medium.
    Classification: Code.

16. TASK-0243: Add agentic task CLI smoke tests.
    Purpose: prove JSON-only output, no-write behavior, no adapter calls, no
    audit writes, verifier not run, completed false, read-only persistence,
    unknown flag handling, and help guardrails.
    Likely files: `apps/cli/scripts/smoke.mjs`.
    Verification command: `pnpm --filter @aeos/cli smoke`.
    Recommended model effort: High.
    Classification: Code.

17. TASK-0244: Review agentic task CLI MVP safety.
    Purpose: confirm the implemented MVP remains deterministic, local-first,
    read-only by default, dry-run first, policy-aware, audit-visible, and
    verifier-gated.
    Likely files: `docs/AGENTIC_TASK_CLI_SURFACE.md`, `TASKS/backlog.md`.
    Verification command: `git status --short`.
    Recommended model effort: Medium.
    Classification: Docs.
