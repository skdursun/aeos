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

The CLI transition preview requires `--expected-revision <number>` even though
it is read-only. The expected revision must be a positive integer. Missing,
zero, negative, decimal, or non-number values fail closed before evaluation.
If the loaded source revision differs from the expected revision, preview
returns `task_state_revision_conflict` and preserves the state bytes.

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

Both commands preserve the persisted revision and file contents. They do not
create task state, save task state, increment revision, persist a resume cursor,
write audit events, run verifiers, call adapters, execute work, retry work, or
create completed state.

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
`task verify`. The only transition CLI surface in this MVP is the read-only
preview:

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

The CLI accepts only the closed system-owned intents:

- `mark_dry_run_ready`
- `require_verification`
- `mark_blocked`

It accepts no arbitrary target lifecycle such as `--to`, `--target`, `--state`,
or user-provided evidence JSON. `mark_dry_run_ready` is not authorized unless
authoritative dry-run evidence already exists. `require_verification` may use
persisted verifier-gate evidence. `mark_blocked` requires authoritative
persisted blocking issues. Terminal-style intents such as `completed`,
`verified`, `approved`, `execution_success`, `mark_completed`, and
`mark_verified` fail closed. There is no `--force`.

`aeos task state transition <task-id> ...` without `--preview` fails closed with
`task_state_transition_apply_not_implemented`. Persisted transition apply is
reserved for a later explicit revision-guarded task.

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
