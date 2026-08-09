# Task State Persistence MVP

## Purpose
The task state persistence MVP provides the first durable AEOS task-state
foundation for future stateful orchestration and resume.

Persisted task state is system state. It records AEOS-owned task, work item,
batch, verifier, completion-gate, resume, issue, revision, and safety metadata.
It does not run tasks, execute adapters, append audit events, run verifiers, or
authorize completion from model text.

## Storage Location
Task state is stored locally as JSON:

```text
.aeos/state/tasks/<task-id>.json
```

The task id is the only filename input. Task-supplied storage paths are not
accepted.

## State Shape
The MVP state includes:

- `schemaVersion: 1`
- `taskId`
- source task reference
- `lifecycleState`
- represented work items and batches
- pending and retryable work item ids
- current and next batch references when present
- safe plan reference or compact plan summary
- verifier requirement and status
- completion gate status
- resume cursor data
- lifecycle issues
- optimistic `revision`
- safety metadata that keeps execution, approval, completion, verification, and
  model self-report trust false

`createInitialTaskState` creates an in-memory `new` state. The explicit CLI
initialization command persists the current safe initialized lifecycle as
`planned` after parser, validation, mapping, strict planner-input safety proof,
dependency-injected planning, and verifier-gate proof all pass.

## Revision Behavior
New state starts at `revision: 1`.

Updates require the caller's expected revision. If the on-disk revision differs,
the update returns `task_state_revision_conflict` and preserves the existing
state. Successful updates increment the revision by one.

Revision-guarded transition writes load and validate the persisted state,
compare the caller's `expectedRevision`, evaluate the closed transition policy
against typed evidence, then save the derived state with the existing revision
guard. A successful persisted transition increments the revision exactly once.
Stale transitions fail with `task_state_revision_conflict` and do not overwrite
bytes.

The CLI transition preview and explicit transition apply both require
`--expected-revision <number>`. The expected revision must be a positive
integer. Missing, zero, negative, decimal, or non-number values fail closed
before evaluation. If the loaded source revision differs from the expected
revision, preview or apply returns `task_state_revision_conflict` and preserves
the state bytes.

## Load And Save
`createInitialTaskState` creates safe in-memory state only.

`saveTaskState` validates state, checks the storage path, checks an existing
revision when replacing, writes a temporary JSON file, fsyncs it, and replaces
the target path. The target filename is deterministic; the temporary filename is
unique.

`loadTaskState` reads and validates the JSON state. Missing state returns
`task_state_not_found`.

## Explicit Initialization CLI
`aeos task state init <task-file>` is the only MVP task command that creates
persisted task state. `--json` emits one deterministic JSON object only.

Initialization derives state from the safe planning chain:

```text
task file -> parser -> validation -> mapper -> runnerPlanningInput
  -> dependency-injected planner -> planned result -> saveTaskState()
```

The command requires actual proof on
`mappingResult.planningInput.runnerPlanningInput.metadata.noExecution === true`
and `metadata.noWrites === true`. It also requires actual verifier proof on
`runnerPlanningInput.verifierRequirements.verifierRequired === true` and
`completionGatedByVerifier === true`. Top-level, summary, task prose, and model
self-report claims cannot authorize persistence.

The persisted initial state is non-terminal:

- `revision: 1`
- `lifecycleState: "planned"`
- planned work items and batches represented from the planner result
- pending and retryable ids derived from represented work item state
- verifier status `required_not_run`
- completion gate unsatisfied
- execution, adapter, audit, verifier-run, approval, completion, verification,
  and self-report trust safety flags false

If state already exists, initialization fails closed with
`task_state_already_exists` and does not overwrite bytes or increment revision.
No `--force` or arbitrary state editing command exists in this MVP.

## Corruption Behavior
Corrupt JSON is not treated as empty or new state. Loading or replacing a corrupt
state file fails closed with `task_state_corrupt_json`.

## Path Safety
Task ids must be simple deterministic ids using letters, numbers, `.`, `_`, and
`-`. Traversal, path separators, unsafe absolute ids, whitespace-wrapped ids, and
path-like ids are rejected.

Writes are constrained to `.aeos/state/tasks`. Existing symlinks or
non-directory paths in that state root are rejected to avoid state-root escape.
The MVP does not claim to provide cross-process locking.

## Completion And Verifier Safety
The persistence APIs do not authorize `completed`, `verified`, `approved`, or
`execution_success` lifecycle states. They also reject completed or verified work
item states and completed batch counts in this MVP.

Verifier metadata must remain completion-gated. `verified` verifier status,
satisfied completion gates, and safety metadata that claims execution,
approval, completion, or verification are rejected.

## No Model Self-Report Trust
Model/task prose is never parsed as completion evidence. Text such as
"completed", "approved", "verified", or "all complete" may be stored only as an
untrusted source reference or metadata; it cannot create authoritative completed
or verified persisted state.

The invariant remains:

```text
400 expected items
20 accounted for
model says "all complete"
```

This must not produce authoritative persisted completion.

## System-Owned Transitions
Task-state transitions are system-owned. The transition API accepts a closed
intent, not an arbitrary target lifecycle string. Task prose, model output,
top-level metadata claims, and arbitrary CLI JSON cannot choose authoritative
lifecycle, completion, approval, execution-success, or verification state.

The current MVP transition intents are:

- `mark_dry_run_ready`
- `require_verification`
- `mark_blocked`

Same-state transitions are rejected deterministically instead of silently
rewriting state. Unknown intents fail closed. Retryability remains represented
at work-item and retryable-id level; there is no persisted lifecycle state named
`retryable`.

The current allowlist is:

- `planned -> mark_dry_run_ready -> dry_run_ready`
- `planned -> require_verification -> verification_required`
- `planned -> mark_blocked -> blocked`
- `dry_run_ready -> require_verification -> verification_required`
- `dry_run_ready -> mark_blocked -> blocked`
- `verification_required -> mark_blocked -> blocked`

Initialization already owns the persisted `planned` state. The transition API
does not expose a redundant `mark_planned` intent.

Terminal transition intents are explicitly forbidden:

- `mark_completed`
- `mark_verified`
- `mark_approved`
- `mark_execution_success`

There is no operator override or `allowTerminal` shortcut.

## Typed Evidence
Each transition intent requires only the evidence needed for that transition.

`mark_dry_run_ready` requires authoritative dry-run evidence proving the dry-run
succeeded and that execution, writes, adapter calls, audit writes, verifier run,
persistence, filesystem mutation, and completed-state creation were all absent.
The CLI `aeos task run --dry-run` remains no-write and is not wired to persist
this transition.

`require_verification` requires authoritative verifier-requirement evidence with
`verifierRequired: true` and `completionGatedByVerifier: true`. It does not run
the verifier and does not mark anything verified.

`mark_blocked` requires authoritative blocking issue evidence. It may append the
system issue and move the completion gate to blocked, but it does not complete,
verify, approve, execute, retry, or mutate arbitrary work state.

Before any transition policy is evaluated, the persisted state must validate.
Corrupt JSON, unsafe task ids, invalid lifecycle values, inconsistent work item
ids, duplicate pending or retryable ids, pending/retryable conflicts, unknown
batch references, non-resumable next-batch references, completed/verified work
items, completed batch counts, forged completion gates, and forbidden safety
metadata all fail closed.

Pure transition evaluation and pure state transition functions do not mutate
caller-owned input objects. Repeated evaluation with the same input is
deterministic. Only `transitionPersistedTaskState` performs a controlled
write.

## TASK-0279 Safety Review
TASK-0279 reviewed the TASK-0278 persistence boundary for path confinement,
state-root symlink behavior, corrupt JSON, schema validation, revision
protection, atomic-ish writes, stale updates, and forged completion claims.

The review kept persisted state as the only authoritative task state. Unsupported
terminal proof remains rejected: completed or verified lifecycle states,
approval, execution success, completed or verified work items, completed batch
counts, verified verifier status, and satisfied completion gates all fail closed.

Pending and retryable ids now must be authoritative references to represented
work items. Duplicate pending or retryable ids, unknown ids, pending ids that do
not reference pending work items, retryable ids that do not reference retryable
work items, inconsistent batch references, and non-resumable next-batch
references are rejected.

## Resume Handoff Foundation
`createTaskResumeHandoff` derives read-only resume handoff data from a validated
persisted task state. `loadTaskResumeHandoff` loads the persisted state and then
derives the same handoff without saving, mutating, creating cursors, incrementing
revision, marking attempts, or changing work/batch state.

The handoff carries the task id, source persisted revision, lifecycle state,
pending ids, retryable ids, current/next batch ids when represented, remaining
work count, verifier requirement, verifier completion gate, resume eligibility,
blocked issues, and explicit `noExecution: true` / `noWrites: true` flags.

Resume is allowed only for validated resumable persisted states with
authoritative pending or retryable work. Invalid state, corrupt state, forged
completion/verification, unknown lifecycle state, inconsistent work references,
and zero remaining work without verifiable completion proof block the handoff.

## Execution Attempt Foundation
Execution attempts are separate system-owned evidence records. They are not task
state, audit runtime, verifier runtime, adapter runtime, approval grants, or
completion proof.

The current storage convention is:

```text
.aeos/state/executions/<task-id>/<attempt-id>.json
```

Task state remains authoritative for task lifecycle, work item state, verifier
gate, completion gate, and revision. Attempt records are authoritative only for
the attempt lifecycle evidence they contain. This avoids overloading task-state
JSON and keeps attempts independently inspectable without creating two sources
of truth for task completion.

`prepareTaskExecutionAttempt` is pure and system-owned. It validates persisted
task state, requires the expected task-state revision, checks that the task
lifecycle is executable or resumable, binds the attempt to known pending or
retryable work and/or a known batch, derives a deterministic safe attempt id,
creates an `attempt_prepared` event, and returns a `prepared` attempt. It does
not call adapters, execute work, write audit, run verifiers, mutate task state,
mark work attempted, or mark anything completed.

Attempt identity fields are immutable after creation:

- `attemptId`
- `taskId`
- `taskStateRevision`
- `workItemId`
- `batchId`
- `attemptNumber`

The closed attempt lifecycle is:

- `prepared`
- `started`
- `failed`
- `interrupted`
- `verification_required`

Unknown lifecycle values fail closed. `succeeded`, `completed`, `verified`,
`approved`, and execution-success states are explicitly rejected. The current
transition API can represent only system events for start, failure,
interruption, and verification-required. It cannot authorize success,
completion, verification pass, approval granted, audit written, or task
completion.

Attempt events are state-machine evidence, not the audit log. Current event
kinds are:

- `attempt_prepared`
- `attempt_started`
- `attempt_failed`
- `attempt_interrupted`
- `verification_required`

Events carry the attempt id, task id, source task-state revision, sequence,
timestamp, system authority marker, structured issues, and structured failure
classification where applicable. Event order is enforced: an attempt must start
with `attempt_prepared`; duplicate starts and impossible orderings fail closed.

Work and batch bindings are resolved only from validated persisted task state.
Unknown work items or batches are rejected. Work/batch mismatches are rejected.
Normal preparation requires pending or retryable work. Completed or verified
work remains rejected by persisted task-state validation and therefore cannot
receive a normal MVP execution attempt.

Failure and retry evidence is structured. Failure records include code,
category, retryable boolean, and optional diagnostic text. Raw stack traces are
not accepted as authoritative failure data. Retry eligibility comes from the
system-owned structured failure classification, not model prose such as
"retryable" or "all complete".

Attempt persistence is immutable for a given attempt id. Existing attempt
records are not overwritten. Attempt paths are confined under
`.aeos/state/executions`, task ids and attempt ids must be safe path segments,
corrupt JSON fails closed, and symlink/non-directory state-root or symlink target
escapes are rejected. The write strategy mirrors task-state persistence:
temporary file, fsync, and rename.

Attempt-number authority comes from the attempt persistence layer, not CLI input
or model output. For a given task id, source task-state revision, work item, and
batch binding, AEOS inspects only
`.aeos/state/executions/<task-id>`, validates every authoritative attempt record,
requires filename/record identity agreement, rejects corrupt or unsafe records,
and chooses the smallest missing positive integer. Existing numbers in that
context are never reused, gaps are filled deterministically, and directory
iteration order cannot change the result. Operators cannot pass arbitrary
attempt ids or attempt numbers.

The stale-attempt invariant is explicit: an attempt prepared from task revision
`N` is not execution-authoritative for a current task state at revision `N+1`.
`validateTaskExecutionAttemptForTaskState` rejects that mismatch for future
execution-preparation flows.

Attempt success is not task completion. The intended future flow remains:

```text
execution attempt evidence
  -> coverage/accounting
  -> verifier
  -> completion gate
  -> authoritative task-state transition
```

Model self-report remains non-authoritative. The canonical case still fails
closed:

```text
400 expected work items
20 accounted work items
model says "all complete"
```

An attempt record may be prepared for remaining authoritative work, but it cannot
mark the remaining 380 items complete, satisfy the verifier, satisfy the
completion gate, or create completed task state.

Current limitations:

- no real execution runtime;
- execution-attempt CLI can persist `prepared` attempts only;
- no retry execution;
- no audit runtime integration;
- no verifier runtime integration;
- no policy runtime integration;
- no automatic resume or retry;
- no execution start command;
- no terminal success/completion attempt state.

## Execution Preparation Preview
`aeos task execution prepare --preview <task-id> --expected-revision <number>`
loads authoritative persisted task state, validates it, checks the explicit
expected revision, resolves work or batch selectors against that state, prepares
an in-memory `prepared` attempt through `prepareTaskExecutionAttempt`, and
renders the result.

Optional selectors are:

```text
--work-item <work-item-id>
--batch <batch-id>
```

Selectors are lookup keys only. They cannot define new work or batches.
Unknown work, unknown batches, mismatches, completed or verified work, invalid
references, unsafe task ids, corrupt state, and stale revisions fail closed.
If no selector is supplied, the CLI uses the persisted authoritative
`nextBatchId` when present; otherwise it requires explicit selection.

`--expected-revision` is required and must be a positive integer. Missing,
zero, negative, decimal, or non-number values fail before preparation. If the
loaded state revision differs, preview returns `task_state_revision_conflict`.
A previous preview is not execution authorization.

Attempt identity is system-derived from task id, source revision, attempt
number, work item, and batch. The CLI does not accept `--attempt-id`,
`--attempt-number`, retry flags, failure classification flags, lifecycle flags,
or `--force`. Preview derives the next safe attempt number from authoritative
persisted attempts using the same persistence-layer authority API as apply. If
attempt `1` already exists for the same source/work/batch context, preview shows
the next deterministic candidate instead of reusing or overwriting the existing
identity.

Preview may contain an in-memory `attempt_prepared` event because the pure
preparation API naturally creates it. It does not persist events and does not
fabricate `attempt_started`, failure, verification, audit, success, completion,
approval, or verifier-pass events.

Prepared does not mean started. The preview does not persist an attempt, mark
an attempt started, execute work, call model or tool adapters, write audit
events, run policy or verifier runtime, mutate task state, increment revision,
complete work, satisfy the verifier, or create task completion.

## Execution Preparation Apply
`aeos task execution prepare <task-id> --expected-revision <number>` is the
explicit operator-controlled create boundary for a durable prepared execution
attempt. `--json` emits one deterministic JSON object only.

Apply does not trust prior preview output. It reloads authoritative task state,
validates it, compares the positive integer expected revision, resolves
work/batch selectors from the current persisted state, derives the next safe
attempt number from persisted attempts, prepares through the core pure
preparation API, and saves through immutable attempt persistence.

Successful apply persists only:

- `lifecycle: "prepared"`
- one initial `attempt_prepared` event
- system-derived attempt id
- task id, source revision, work item, batch, and attempt-number bindings

It does not start execution, call model/tool adapters, write audit runtime
events, run policy or verifier runtime, transition to failure/interruption, mark
work completed, mutate task state, increment task revision, satisfy verifier
state, or mark task completion. The CLI checks task-state bytes before and after
successful apply and reports success only when task state is unchanged.

Attempt creation is immutable. If the exact derived attempt identity already
exists at save time, apply fails closed with the persistence conflict and never
overwrites. There is no `--force`, no arbitrary attempt id, no arbitrary attempt
number, no arbitrary lifecycle, no retry/failure injection, and no
`aeos task execution start` command.

## Read-Only CLI Inspection
`aeos task status <task-id>` reads the authoritative persisted state from:

```text
.aeos/state/tasks/<task-id>.json
```

It prints the source revision, lifecycle, work and batch counts, pending and
retryable counts, current/next batch references, verifier gate, resume
availability, issues, and explicit safety markers. `--json` emits one
deterministic JSON object only.

`aeos task resume --preview <task-id>` loads the same persisted state and
derives a read-only resume handoff. It exposes the source revision, resume
eligibility, pending and retryable ids, remaining work count, batch references,
verifier gate, blocked reason, issues, and explicit no-execution/no-write
markers. `--json` emits one deterministic JSON object only.

Status and resume preview preserve the persisted revision and file contents.
They do not create task state, save task state, increment revision, persist a
resume cursor, write audit events, run verifiers, call adapters, execute work,
retry work, or create completed state.

Missing state, corrupt JSON, invalid schema, malformed revision, unsafe task
ids, state-root symlinks, state-file symlinks, non-file state targets, forged
completion/verification, and invalid pending/retryable/batch references fail
closed. JSON errors expose deterministic codes and messages without raw runtime
errors.

`aeos task resume <task-id>` without `--preview` remains unavailable and fails
closed with `task_resume_execution_not_implemented`.

## Plan And Dry-Run
`aeos task plan` remains read-only.

`aeos task run --dry-run` remains read-only and does not persist task state,
resume state, audit state, verifier state, or completion state.

Automatic plan/dry-run state persistence remains out of scope. The explicit
write boundary is `aeos task state init <task-file>` only.

The transition API is a core foundation for later orchestration wiring. It does
not add `aeos task state set`, `task state patch`, `task complete`, or
`task verify`. The CLI exposes read-only preview and explicit revision-guarded
apply for the same closed transition policy.

Read-only preview:

```text
aeos task state transition --preview <task-id> --intent <intent> --expected-revision <number>
```

`--json` emits one deterministic JSON object only. Preview loads and validates
the authoritative persisted state, compares the expected revision, derives only
safe system evidence already available from persisted state, evaluates the core
closed transition policy, and reports the target lifecycle, accepted evidence,
blocking issues, and safety flags. A supported intent with insufficient
evidence is a successful preview with `transitionAllowed: false`; malformed
commands, unsafe state, corrupt state, and revision conflicts exit non-zero.

Preview is strictly read-only. It does not save state, increment revision,
mutate lifecycle, execute work, call adapters, write audit events, run
verifiers, persist resume data, create completion, create verification, or
create approval. State file bytes, revision, lifecycle, and mtime are preserved.

Explicit apply:

```text
aeos task state transition <task-id> --intent <intent> --expected-revision <number>
```

`--json` emits one deterministic JSON object only. Apply does not trust a prior
preview as authorization. It reloads the current authoritative persisted state,
validates it, compares the expected revision, derives typed system evidence
from that current state, evaluates the same closed transition policy as preview,
then persists through the revision-guarded core transition API. A successful
apply writes exactly one authoritative task-state update, increments revision
exactly once, and preserves unrelated valid authoritative state.

Stale apply fails with `task_state_revision_conflict` and does not change bytes,
revision, lifecycle, or reliable mtime. Blocked apply, including insufficient
evidence, unknown or terminal intent, corrupt state, invalid references, unsafe
task id, state-root symlink, state-file symlink, and unsafe target type, also
fails closed without an authoritative write. There is no `--force`.

The CLI accepts only the closed system-owned intents:

- `mark_dry_run_ready`
- `require_verification`
- `mark_blocked`

It accepts no arbitrary target lifecycle such as `--to`, `--target`, `--state`,
or user-provided evidence JSON/prose. `mark_dry_run_ready` is not authorized
unless authoritative persisted dry-run evidence already exists; the current
read-only dry-run command is not wired to create that evidence. `require_verification`
may use persisted verifier-gate evidence. `mark_blocked` requires authoritative
persisted blocking issues. Terminal-style intents such as `completed`,
`verified`, `approved`, `execution_success`, `mark_completed`, and
`mark_verified` fail closed. Transition apply does not execute task work, call
adapters, write audit events, run verifiers, persist external resume cursors,
create actual completion, or create actual verification.

## MVP Limitations
The MVP does not implement real task execution, adapter runtime, audit runtime,
verifier runtime, automatic resume, retries, concurrency, locks, approvals, or
arbitrary state update commands.

Atomic replacement uses dependency-free local temp-file write plus rename. This
is the safest MVP approach here, but it is not a full cross-platform transaction
or multi-writer locking mechanism.

The MVP does not implement automatic resume, retry execution, real task
execution, verifier execution, audit runtime, or cross-process locking. A later
executor must compare the handoff source revision against the then-current
persisted revision before acting.

## Later Scope
Future work should add revision-guarded, system-owned state transitions only
after authoritative execution, audit, and verifier evidence exist. Arbitrary
operator state mutation remains out of scope.
