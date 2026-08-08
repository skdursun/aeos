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

The current persisted lifecycle starts at `new`, then may move to `planned`,
then `dry_run_ready` or `verification_required` where future integration has
system evidence. Existing lifecycle contracts use `draft`; the persistence MVP
uses `new` for the initial durable record.

## Revision Behavior
New state starts at `revision: 1`.

Updates require the caller's expected revision. If the on-disk revision differs,
the update returns `task_state_revision_conflict` and preserves the existing
state. Successful updates increment the revision by one.

## Load And Save
`createInitialTaskState` creates safe in-memory state only.

`saveTaskState` validates state, checks the storage path, checks an existing
revision when replacing, writes a temporary JSON file, fsyncs it, and replaces
the target path. The target filename is deterministic; the temporary filename is
unique.

`loadTaskState` reads and validates the JSON state. Missing state returns
`task_state_not_found`.

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

Automatic state initialization, state update CLI commands, and plan/dry-run
state persistence remain later scope.

## MVP Limitations
The MVP does not implement real task execution, adapter runtime, audit runtime,
verifier runtime, automatic resume, retries, concurrency, locks, approvals, or
CLI persistence commands.

Atomic replacement uses dependency-free local temp-file write plus rename. This
is the safest MVP approach here, but it is not a full cross-platform transaction
or multi-writer locking mechanism.

TASK-0279 does not implement automatic resume, retry execution, task status CLI,
resume preview CLI, real task execution, verifier execution, audit runtime, or
cross-process locking. A later executor must compare the handoff source revision
against the then-current persisted revision before acting.

## Later Scope
Future work should review the persistence safety boundary, then wire explicit
command integration and resume handoff only after authoritative execution,
audit, and verifier evidence exist.
