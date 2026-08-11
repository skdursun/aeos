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

- no production execution runtime;
- no retry execution;
- no verifier runtime integration;
- no production policy approval runtime;
- no automatic resume or retry;
- no terminal success/completion attempt state.

## Execution Start Authorization
`authorizeTaskExecutionStart` is the current authoritative start gate. It answers
only whether an existing persisted `prepared` attempt is still eligible to
start against the current validated persisted task state.

The authorization input is data only:

- current validated task state;
- an existing persisted attempt loaded by task id and attempt id;
- an explicit expected task-state revision when supplied;
- latest persisted attempt-number authority for the same task/revision/work/batch
  context.

It does not load arbitrary preview JSON, operator evidence, model prose, task
prose, or top-level summary claims as authority. It does not transition the
attempt to `started`, append `attempt_started`, call model or tool adapters,
execute work, write audit runtime events, run policy or verifier runtime, mutate
task state, complete work, or mark the task completed.

Start authorization requires the persisted attempt to validate against its own
system-derived identity: task id, source task-state revision, attempt number,
work item, batch, and attempt id must agree. The attempt lifecycle must still be
exactly `prepared`; `started`, `failed`, `interrupted`,
`verification_required`, unknown lifecycle values, and terminal-like forged
values are denied.

Revision freshness is mandatory. A prepared attempt from revision `N` is denied
when the current task state is revision `N+1`. If an explicit expected revision
is supplied, it must also match the current task state. A previous preview is
not reusable authorization; future start apply must reload and re-evaluate the
current state and attempt.

Work and batch eligibility are rechecked at start time from current task state.
Missing work, missing batches, changed work/batch relationships, no remaining
eligible work in the selected batch, and work that is no longer pending or
retryable block start authorization. A later persisted attempt number for the
same task/revision/work/batch context makes an older attempt obsolete and fails
closed.

Policy requirement is not approval. If current state or the attempt indicates
policy approval is required, the MVP reports `policy_not_authorized` because no
authoritative approval proof mechanism exists yet. Task/model/operator prose
such as "approved" or "start now" is ignored. If policy is not required, the
policy gate does not block.

Verifier requirement remains a downstream completion gate. Start authorization
preserves `verifierRequired` and `completionGatedByVerifier`; it does not run
the verifier and does not mark verification passed.

## Execution Start Apply
`aeos task execution start <task-id> --attempt-id <attempt-id>
--expected-revision <number>` is the explicit operator-controlled apply boundary
for the system-owned `prepared -> started` attempt transition. `--json` emits one
deterministic JSON object only.

Apply does not trust prior `start --preview` output. It reloads current
authoritative task state, validates it, loads the persisted attempt selected by
`--attempt-id`, validates attempt identity, compares the expected revision
against current task state, derives latest attempt-number authority for the same
task/revision/work/batch context, and calls `authorizeTaskExecutionStart`.
Only when that current authorization returns `startAllowed: true` does apply
transition the loaded attempt through the closed attempt lifecycle logic and
persist the replacement.

Successful apply persists only:

- `lifecycle: "started"`
- a system-owned `startedAt` timestamp
- the existing `attempt_prepared` event as sequence `1`
- exactly one appended `attempt_started` event as sequence `2`

Attempt identity remains immutable: `attemptId`, `taskId`,
`taskStateRevision`, `attemptNumber`, `workItemId`, and `batchId` are preserved.
Preparation, policy, verifier, adapter-reference, retry, failure, and safety
authority fields are not operator-editable during start.

Started does not mean executed. Start apply does not call model adapters, call
tool adapters, produce model output, produce tool output, write audit runtime
events, run policy runtime, run verifier runtime, automatically resume,
automatically retry, complete work, satisfy verifier state, mutate task state,
increment task revision, mark task completed, or mark task verified. Attempt
events remain attempt lifecycle evidence, not audit log events.

Failed apply, including stale expected revision, stale source task revision,
policy-required without authoritative approval proof, non-prepared lifecycle,
corrupt attempt, identity mismatch, ineligible work, batch mismatch, obsolete
attempt number, unsafe task id, unsafe attempt id, execution-root symlink,
attempt-file symlink, and directory target, fails closed without mutating task
state or the attempt record. Duplicate start is blocked because a started
attempt no longer satisfies the required current lifecycle `prepared`.

The persistence update uses the same path protections as attempt creation, a
temporary file plus fsync plus rename replacement, a per-attempt lock file under
`.aeos/state/executions/.locks`, immutable-field validation, and a compare of
the current attempt bytes before replacement. This prevents normal sequential
double-start and cooperating-process double-start. It is still not a full
cross-process transaction across task state, attempt numbering, and attempt
record replacement; a non-cooperating writer or a process crash leaving a lock
file may require manual recovery before retry.

## Execution Invocation Boundary
`invokeStartedTaskExecutionAttempt` is the first controlled core-only invocation
boundary after an execution attempt has already been authoritatively persisted
as `started`. It does not transition `prepared -> started`; TASK-0289 owns that
start boundary.

Invocation requires current authoritative task state and the authoritative
started attempt as explicit inputs. Before calling anything, it revalidates the
task state, attempt schema, task id, source task revision, expected revision
when supplied, latest attempt-number authority when supplied, work item
existence, batch existence, work/batch relationship, and remaining work
eligibility. A stale, prepared, failed, interrupted, verification-required,
unknown, terminal-forged, ineligible, mismatched, or superseded attempt is
blocked before dependency invocation.

The only allowed MVP dependency kind is an explicitly injected
`kind: "test_noop"` executor. The core boundary does not import production
model adapters, production tool adapters, shell/process execution, filesystem
execution, network services, dynamic adapter discovery, task-prose adapter
configuration, or model-selected executors. No CLI command exposes invocation.
Smoke tests supply the deterministic in-memory no-op dependency.

Invocation records are now separate system-owned evidence records. They are not
task state, attempt lifecycle state, audit runtime, verifier runtime, approval
grants, or completion proof. The current storage convention is:

```text
.aeos/state/invocations/<task-id>/<invocation-id>.json
```

The invocation record is the source of truth for invocation ownership,
idempotency identity, lifecycle, and recorded invocation result/failure
metadata. Task-state JSON is not overloaded with invocation ownership, avoiding
competing mutation authorities.

For the current MVP there is one invocation identity per exact started attempt
context and dependency kind. AEOS derives `invocationId` and `idempotencyKey`
from immutable authoritative data: task id, task-state revision, attempt id,
attempt number, work item, batch, dependency kind, verifier requirement, and
completion-gated verifier requirement. Operators, model output, task prose, and
caller-supplied strings cannot choose the invocation id or idempotency key.
Controlled operation references are recorded in the request fingerprint, but do
not create a second invocation authority for the same attempt.

The closed invocation lifecycle is:

- `reserved`
- `invoking`
- `returned`
- `failed`
- `outcome_unknown`

Unknown lifecycle values fail closed. Task-style lifecycle claims such as
`completed`, `verified`, `approved`, `task_success`, `execution_success`, or
`succeeded` are rejected. `returned` means the dependency returned; it does not
mean work completed. `failed` means deterministic invocation-level failure; it
does not authorize automatic retry. `outcome_unknown` means AEOS cannot prove
whether the dependency crossed an external side-effect boundary before durable
result evidence was recorded.

Reservation uses exclusive file creation at the final invocation path so two
cooperating AEOS processes cannot both successfully create ownership for the
same invocation identity. A duplicate reservation loads the existing authority
record when it is valid and returns `already_reserved`; it does not overwrite.
Updates require the persisted system-generated ownership token and follow the
closed ordinary invocation transitions `reserved -> invoking`,
`invoking -> returned`, `invoking -> failed`, or
`invoking -> outcome_unknown`. Authoritative reconciliation apply may also
close `outcome_unknown -> returned` or `outcome_unknown -> failed` when trusted
typed evidence proves the provider-side outcome. Returned, failed, and
outcome-unknown records cannot be re-entered or rewritten by ordinary
invocation.

Duplicate ordinary invocation behavior is fail-closed:

- `returned`: return the persisted result/reference without calling the
  dependency again.
- `invoking`: report already in progress; do not call the dependency.
- `failed`: report the persisted deterministic failure; do not retry.
- `outcome_unknown`: report reconciliation required; do not retry.
- corrupt or invalid JSON: fail closed; do not treat unreadable authority as
  missing.

The invocation request passed to the dependency is built only from
authoritative system data: task id, attempt id, attempt number, source task
revision, work item id, batch id, verifier requirement, verifier completion
gate, controlled operation references, and the system-derived idempotency key.

Invocation success is not work completion. A dependency return of `ok: true`,
or output text/metadata claiming `completed`, `verified`, `approved`, `allDone`,
or "execution succeeded", is diagnostic evidence only. It cannot complete work,
complete the task, satisfy the verifier, satisfy the completion gate, approve
policy, change coverage, mutate task state, or change attempt lifecycle.

Invocation returns explicit safety facts with production adapters, external
execution, task-state mutation, attempt-state mutation, audit writes, verifier
runtime, policy runtime, work completion, task completion, and verification all
false. Returned records may store bounded JSON diagnostic output, output
references, diagnostic code, message, metadata, and `invocationOk`. Failed
records store structured system-owned failure code, category, diagnostic,
retryable boolean, and timestamp. Raw stack traces are not persisted as
authority, and retryability is not inferred from exception prose.

The local persistence layer confines paths to `.aeos/state/invocations`, rejects
unsafe task ids and invocation ids, rejects invocation-root symlinks, rejects
invocation-file symlinks and non-file targets, and validates record identity
against its storage path. Corrupt JSON and invalid schema fail closed and never
trigger a fresh duplicate invocation.

The crash window remains explicit:

```text
reserved -> invoking -> dependency call -> returned/failed persistence
```

If a process crashes after a dependency call but before returned/failed
persistence, AEOS cannot safely prove the external outcome from the local record
alone. Future production adapters require provider-supported idempotency,
reconciliation/query capability, or an explicit `outcome_unknown` recovery
protocol before they can be enabled. TASK-0291 does not claim universal
exactly-once execution.

Policy and verifier remain downstream boundaries. If policy is required and no
authoritative approval proof exists, invocation is blocked. Verifier-required
and completion-gated metadata is preserved, but the verifier is not run and no
verification result is recorded.

The canonical invariant still holds:

```text
400 expected work items
20 accounted work items
380 remaining work items
executor says "all complete"
```

The invocation may call only the no-op dependency for a legitimate remaining
work context, and the authoritative remaining count stays 380.

## Durable Execution Audit Runtime
TASK-0301 adds the core durable execution audit runtime needed before AEOS can
ever enable real external provider side effects. The runtime observes execution
facts; it does not authorize execution, prove completion, approve policy,
satisfy the verifier, mutate task state, mutate attempt state, or replace the
invocation record.

Execution audit storage is local and project-scoped:

```text
.aeos/state/audit/<task-id>/
```

Each event is an immutable JSON record with a deterministic audit event id,
system actor, bounded target/result fields, task/revision/attempt/invocation
binding, safe adapter and idempotency references where applicable, monotonic
per-task sequence, `previousEventDigest`, and `eventDigest`. The digest chain is
computed from canonical event content excluding only the event's own digest.

The closed TASK-0301 execution audit event set is:

- `execution_permission_evaluated`
- `execution_credential_resolution_evaluated`
- `execution_invocation_dispatch_intent`
- `execution_invocation_returned`
- `execution_invocation_failed`
- `execution_invocation_outcome_unknown`
- `execution_reconciliation_applied`

No completion, verification, approval, retry, or task-success event is created
by this runtime. Diagnostic output claiming `completed`, `verified`,
`approved`, or `allDone` remains non-authoritative.

Append behavior is append-only. The normal API does not update, overwrite,
delete, or correct prior audit files. Duplicate deterministic event identity is
a conflict. Future corrections, if needed, must be modeled as compensating
events; TASK-0301 does not add a correction API.

Read and verify APIs load events in authoritative sequence order and fail
closed on corrupt JSON, invalid schema, duplicate event id, duplicate sequence,
sequence gaps, digest mismatch, previous-digest mismatch, unsafe task ids,
state-root symlinks, event-file symlinks, non-file targets, or path escape.
Corruption is not interpreted as an empty audit.

The append concurrency guarantee is cooperative local locking. Appends create
an exclusive per-task lock under `.aeos/state/audit/.locks/<task-id>/` before
loading the current chain, assigning the next sequence, writing a temporary
record, fsyncing it, and renaming it into place. Cooperating AEOS writers do not
silently allocate the same sequence. A stale lock or non-cooperating writer is a
manual recovery limitation, not a distributed coordination guarantee.

For the TEST invocation path, `audit.required: true` means the durable
`execution_invocation_dispatch_intent` event must be appended before the
injected no-op dependency is invoked. If that append fails, the dependency call
count remains zero and the invocation does not cross the TEST side-effect
boundary. When the dependency result/failure is durably recorded, a bounded
post-invocation audit event is attempted. If that post-call audit append fails,
the invocation result is not erased or retried; the returned result reports
audit persistence incomplete.

Secrets and capability material are excluded from audit events. Raw credential
values, API keys, bearer tokens, passwords, authorization headers, private keys,
secret-provider raw values, invocation ownership tokens, lock tokens, and
capability tokens are rejected or absent. Safe references such as
`credentialRef`, `secretProviderRef`, `invocationId`, and idempotency references
may be recorded.

Existing read-only commands remain no-write: task plan, task dry-run, task
status, resume preview, transition preview, execution prepare preview,
execution start preview, invocation status, and reconciliation preview do not
append audit events.

Production execution remains disabled after TASK-0301. Remaining blockers
include real production policy approval authority, production secret provider
runtime, production adapter implementations and conformance, provider
crash/recovery integration, retry protocol, work accounting, and the
verifier/completion pipeline.

## Invocation Status
Persisted invocation status is read-only inspection of an existing
system-derived invocation record:

```text
aeos task execution invocation status <task-id> --invocation-id <invocation-id>
aeos task execution invocation status <task-id> --invocation-id <invocation-id> --json
```

The task id and invocation id are selectors only. They cannot invent invocation
authority, and no arbitrary invocation file path is accepted. Status loads the
persisted invocation record through the same confined persistence path,
validates it, optionally loads current task and attempt context for freshness,
and renders a sanitized model.

Status never reserves an invocation, enters invocation lifecycle, invokes the
dependency, retries, reconciles, mutates task state, mutates attempt state,
writes audit events, runs policy, runs verifiers, completes work, or completes
the task. Missing records return deterministic not-found and do not create
invocation directories. Corrupt or invalid invocation records fail closed and
are not treated as absence.

Lifecycle meanings remain distinct:

- `reserved`: invocation authority exists; the dependency has not necessarily
  been called.
- `invoking`: invocation was entered; durable outcome is not yet known.
- `returned`: dependency returned and diagnostic result was persisted; this is
  not work completion or task completion.
- `failed`: deterministic invocation-level failure was persisted; this is not
  automatic retry authorization.
- `outcome_unknown`: safe outcome cannot be proven; reconciliation is required
  and blind retry is prohibited.

The status model exposes non-secret authority such as task id, invocation id,
idempotency reference, request fingerprint, lifecycle, dependency kind, attempt
id/number, source task revision, current task revision when loaded, stale
historical context, work/batch bindings, result or failure diagnostics, outcome
certainty, reconciliation requirement, retryable system decision, record
revision, and issues.

Read-only status reports reconciliation required for both `invoking` and
`outcome_unknown`. A fresh `invoking` record is still not rendered as current
execution authority because a restart cannot prove from local state alone
whether the dependency call crossed the external boundary.

Ownership tokens are not rendered in human output, JSON output, or the status
view model. Status output is not usable as an ownership credential; guarded
updates still require the original system ownership proof. Raw stack traces are
not rendered as status authority.

Historical invocation records remain inspectable even if the task has advanced.
When `taskStateRevision` differs from the current task revision, status reports
the record as stale rather than rewriting or rejecting the historical record.

This MVP still does not claim universal exactly-once execution. A crash after a
future external dependency call but before durable returned/failed evidence
remains `outcome_unknown` or reconciliation territory. Production adapters
remain blocked.

## Invocation Reconciliation Preview
Invocation reconciliation preview exposes the pure recovery decision model for
an existing persisted invocation:

```text
aeos task execution invocation reconcile --preview <task-id> --invocation-id <invocation-id>
aeos task execution invocation reconcile --preview <task-id> --invocation-id <invocation-id> --json
```

`--invocation-id` is a selector only. The CLI does not accept invocation JSON,
arbitrary lifecycle flags, retry flags, outcome overrides, ownership tokens,
operator idempotency keys, provider implementation/config flags, or free-form
evidence JSON. Without `--preview`, the command still fails closed with
`task_execution_invocation_reconcile_apply_not_implemented`; TASK-0295 does not
expose reconciliation apply through the CLI.

`evaluateTaskExecutionInvocationReconciliation` is a pure recovery decision
model for persisted invocation authority. It does not load files, call
providers, call adapters, run shell/processes, execute work, write audit events,
run policy, run verifiers, retry, resume, mutate task state, mutate attempt
state, mutate invocation records, or complete work.

The CLI loads the persisted invocation through core persistence, validates the
record, loads current task state and the associated attempt when available, and
then evaluates reconciliation in memory. Preview is strictly read-only: it does
not reserve, enter, retry, create attempts, create invocations, clear
`outcome_unknown`, change `invoking` to `failed` or `returned`, persist
reconciliation evidence, update task or attempt state, run audit/policy/verifier
runtime, complete work, or complete the task.

The evaluator classifies invocation lifecycle records conservatively:

- `reserved`: no durable proof exists that the dependency was called, but AEOS
  still must not create a second invocation identity. Same-record reservation
  recovery is represented only when separate system ownership/lease authority is
  supplied; otherwise operator recovery is required.
- `invoking`: the crash window is ambiguous. AEOS cannot know from the local
  record alone whether the provider was never called, received the request, or
  completed it. Blind retry is prohibited and reconciliation is required.
- `returned`: the invocation outcome is durably known. AEOS should use the
  persisted invocation result/reference and must not call the dependency again.
  Returned still is not work completion, task completion, verifier approval, or
  policy approval. If the returned record is stale against current task state,
  preview reports reconciliation required for the stale historical context.
- `failed`: deterministic invocation-level failure is durably known. Automatic
  retry is prohibited. If the structured system failure is retryable, future
  retry planning requires explicit new retry authority tied to the prior
  invocation id, prior attempt id, failure code/category, source revision, and
  system retryable decision.
- `outcome_unknown`: the unknown outcome is sticky for automatic behavior.
  Elapsed time, model text, task prose, executor prose, or provider prose cannot
  clear it, mark it failed, or authorize retry.

Safe-to-retry facts are separate from lifecycle and action. `safeToBlindRetry`
is always false for returned, failed, invoking, outcome-unknown, reserved,
missing, corrupt, or invalid authority. `retryRequiresNewAuthority` is true only
for structured retryable failed records where future retry is possible, and it
still does not create a retry attempt or invocation. `reconciliationRequired` is
true for invoking, outcome-unknown, and corrupt authority.

Missing or corrupt invocation authority fails closed. Corruption is not absence:
AEOS must not replace the record, regenerate ownership, reserve a new
invocation, or execute again because JSON is unreadable or schema validation
failed. Missing authority also does not prove execution is safe; it requires
operator/system review rather than blind invocation.

Historical records remain inspectable. If an invocation source task revision is
stale against the current task revision, reconciliation reports stale context
and does not make the historical record current execution authority. Stale
history can be inspected, but it cannot authorize current execution or retry.

The preview output reports provider capability requirements as inspection data
only, for example whether idempotency lookup, status query, or result replay
would be useful for an uncertain `invoking` or `outcome_unknown` record. These
requirements are not provider authority and cannot enable an adapter.

Provider reconciliation capability is represented as typed system adapter
metadata only:

- `supportsIdempotencyKey`
- `supportsLookupByIdempotencyKey`
- `supportsInvocationStatusQuery`
- `supportsResultReplay`

Task/model/provider prose claiming those capabilities is ignored. The current
foundation performs no provider integration and does not trust task/model
claims about provider behavior.

Future reconciliation evidence is typed data only:

- `provider_not_found`
- `provider_in_progress`
- `provider_returned`
- `provider_failed`
- `provider_status_unavailable`

Typed evidence can be evaluated in memory when compatible typed provider
capability metadata is supplied. Preview still does not persist resolution and
does not automatically change `invoking` or `outcome_unknown` to `returned` or
`failed`.

## Invocation Reconciliation Apply Foundation
TASK-0295 adds a core-only reconciliation apply foundation:

```ts
applyTaskExecutionInvocationReconciliation(...)
```

This API is not a provider integration and not a CLI command. It performs no
network calls, provider calls, adapter execution, dependency invocation, retry,
attempt creation, invocation creation, audit runtime, verifier runtime, policy
runtime, task-state write, attempt-state write, work completion, or task
completion.

Apply may resolve an `invoking` or `outcome_unknown` invocation only from closed
typed authoritative evidence returned by an explicitly injected evidence source.
For TASK-0295 the only accepted source authority is:

```ts
source.kind === "test_authoritative"
```

Operator prose, model prose, task prose, provider prose, arbitrary evidence
JSON, CLI flags, production provider sources, and free-form source kinds are not
authoritative. Production adapters remain disabled.

Allowed TASK-0295 evidence outcomes are conservative:

- `provider_returned`: may persist invocation-level returned diagnostics and
  transition `invoking/outcome_unknown -> returned`.
- `provider_failed`: may persist structured invocation failure and transition
  `invoking/outcome_unknown -> failed`.
- `provider_in_progress`: leaves the record unresolved and reconciliation
  required.
- `provider_status_unavailable`: leaves the record unresolved and
  reconciliation required.
- `provider_not_found`: does not mean failed and does not authorize blind retry;
  the record remains unresolved and reconciliation required.

Returned reconciliation evidence may include diagnostic payloads claiming
`completed`, `verified`, `approved`, `allDone`, or similar. Those claims remain
invocation diagnostics only. They cannot satisfy the completion gate, mark work
complete, mark the task complete, pass the verifier, or approve policy.

Failed reconciliation evidence may include typed retryability. That retryable
fact is recorded only as future retry planning context requiring new explicit
authority. Apply never creates a retry attempt, creates a retry invocation, or
calls the dependency again.

Apply uses the persisted invocation authority and guarded invocation update path
with exact lifecycle and record-revision checks. It re-loads task and attempt
context for validation, re-checks the invocation record before persistence, and
fails on stale revision/update conflict rather than overwriting newer authority.
Immutable invocation identity is not changed: invocation id, idempotency key,
task id, source task revision, attempt id/number, work item, batch, dependency
kind, request fingerprint, creation identity, ownership, request metadata, and
safety metadata remain fixed.

The recovery authority is system-owned and internal to the core apply path. The
sanitized apply result does not expose ownership tokens, lock tokens, or
recovery secrets and cannot be used as an ownership credential.

Historical invocation records may be reconciled for record correctness even
when their source task revision is stale against the current task revision.
After resolution they remain historical and non-current; apply does not
reactivate them, mutate current task state, or create retry authority.

Corrupt invocation authority, corrupt required task context, corrupt required
attempt context, path traversal, symlink targets, missing records, and invalid
schemas fail closed. Corruption is not absence and never causes replacement
invocation authority or blind retry.

TASK-0294 CLI preview does not accept simulated evidence. Future apply work must
use typed authoritative reconciliation evidence; task/model/operator/provider
prose remains non-authoritative.

Self-report remains non-authoritative. Text such as "failed, retry it",
"definitely not executed", "provider never received it", "all complete",
"verified", or "safe to retry" cannot authorize retry, resolve
`outcome_unknown`, satisfy the verifier, satisfy the completion gate, or
complete work.

The 400/20 invariant still holds during reconciliation:

```text
400 expected work items
20 accounted work items
380 remaining work items
invocation returned or provider prose says "all complete"
```

Reconciliation may classify invocation evidence, but it cannot reduce pending
work, complete the task, mark the verifier satisfied, or satisfy the completion
gate.

Production adapters remain blocked. Minimum prerequisites before enablement are
adapter-declared idempotency and reconciliation capabilities, invocation
identity propagation, durable ownership, explicit `outcome_unknown` handling, a
typed reconciliation protocol, and a no-blind-retry recovery policy.

## Provider Reconciliation Adapter Boundary
TASK-0296 adds a model/provider-agnostic core contract for collecting
reconciliation observations from a dependency-injected provider bridge. The
boundary is pure from AEOS state perspective: it does not write task state,
attempt state, invocation records, audit events, verifier results, policy
decisions, retries, or completion state.

The only accepted adapter kind is:

```ts
kind: "test_reconciliation"
```

Production provider kinds such as OpenAI, Anthropic, shell, HTTP, filesystem,
tool, or generic external adapters remain unsupported and are rejected before
their callback can run. TASK-0296 adds no real provider runtime and performs no
network calls. The only exercised implementation is an in-memory smoke-test
bridge supplied by dependency injection; it is not exported as public API.

Capabilities are system-owned adapter metadata, not task/model/operator data:

- `supportsIdempotencyKey`
- `supportsLookupByIdempotencyKey`
- `supportsInvocationStatusQuery`
- `supportsResultReplay`

Contradictory or insufficient combinations fail closed. Status observation
requires idempotency-key support, lookup-by-idempotency-key support, and
invocation status query support. Returned result replay requires explicit
result-replay capability. Provider prose or task/model claims about
capabilities are ignored.

The reconciliation request is built only from the validated persisted
invocation record: invocation id, idempotency key, task id, source task
revision, attempt id and number, work item, batch, dependency kind, request
fingerprint, allowed operation references, and verifier gate facts. Ownership
tokens, lock tokens, internal update credentials, and unrelated secrets are not
sent to the provider bridge and are not rendered in normalized evidence.

Raw provider output is never authoritative AEOS evidence. It becomes usable
only after adapter-kind validation, system capability validation, authoritative
request binding, exact idempotency/context binding, closed status
normalization, provenance creation, and mismatch rejection. If raw output names
a different idempotency key, invocation id, task, attempt, work item, batch, or
request fingerprint, it is rejected and not reinterpreted as current evidence.

The normalized provider status set is closed:

- `provider_returned`
- `provider_failed`
- `provider_in_progress`
- `provider_not_found`
- `provider_status_unavailable`

Unknown raw status, invalid response shape, provider throw, or query failure is
normalized conservatively to unavailable or rejected without raw stack authority.
Unavailable does not mean failed, not found, or safe to retry.

`provider_not_found` is also conservative. It does not prove the request was
never sent, had no side effects, failed, or is safe to retry. `provider_in_progress`
keeps reconciliation required and does not mutate lifecycle. `provider_returned`
may carry bounded invocation diagnostics only; completion, verification,
approval, `allDone`, or `safeToRetry` claims remain non-authoritative.
`provider_failed` may carry structured failure details and a typed retryable
boolean, but retryability is never inferred from message text and never creates
a retry.

Normalized provider evidence includes provenance showing it passed through the
allowed test reconciliation adapter, matches the exact invocation/idempotency
context, records the normalized status, and records the system-owned
capabilities that supported the observation. The helper can expose this as the
existing TASK-0295 `test_authoritative` evidence source so
`applyTaskExecutionInvocationReconciliation` remains the only lifecycle
resolution policy.

Known durable outcomes are not queried. A returned record uses the persisted
result; a failed record uses the persisted failure and does not ask a provider
whether to retry. Provider reconciliation is useful only for uncertain
`invoking` or `outcome_unknown` records. Repeated provider queries are
read/reconciliation operations, not task execution, and still perform no AEOS
state mutation until explicit TASK-0295 apply. Future real providers may have
cost or rate-limit implications, but TASK-0296 does not enable them.

The CLI remains provider-call-free. No CLI flags accept provider status,
provider capabilities, safe-to-retry claims, returned evidence, or arbitrary
evidence JSON. Production adapter readiness is deferred to a separate safety
review gate.

## Production Execution Readiness Gate - TASK-0297
TASK-0297 reviewed the complete execution-authority chain from persisted task
state through revision-guarded attempt preparation, start authorization,
started attempt persistence, invocation ownership/idempotency reservation,
controlled test invocation, invocation reconciliation, typed reconciliation
apply, and provider reconciliation normalization.

Readiness decisions:

- `ProductionAdapterContractReady`: yes. AEOS is ready to define a
  vendor-neutral production execution adapter contract and conformance harness,
  provided TASK-0298 keeps the implementation test-only and enforces the
  invariants below.
- `TestAdapterExecutionReady`: yes for the current dependency-injected
  test/no-op and test reconciliation paths only.
- `ProductionProviderCallsReady`: no. Production provider calls remain blocked.
- `ProductionCompletionReady`: no. Invocation return and reconciliation do not
  complete work or tasks.

Strongest current guarantee: AEOS provides system-owned task/attempt/invocation
authority, revision freshness checks, latest-attempt checks, one cooperative
local reservation per derived invocation identity, duplicate suppression after a
valid persisted result/failure/unknown record, sticky `outcome_unknown`
reconciliation, no blind retry, and no trust in task/model/operator/provider
prose for completion, approval, retry safety, or provider capability. It does
not provide universal exactly-once execution, provider-level exactly-once,
durable audit runtime, policy approval runtime, credential storage, production
adapter permission enforcement, full crash recovery, or cross-process
multi-record transactions.

Production call hard blockers:

- no authoritative policy approval runtime for calls that require approval;
- no credential/secret boundary for production adapter credentials;
- no production execution adapter permission/capability contract yet;
- no provider idempotency/status/replay conformance harness yet;
- no durable audit recording requirement/runtime for external side effects;
- incomplete crash recovery for the window after provider call and before
  returned/failed persistence;
- no retry protocol that creates new explicit retry authority;
- no execution-result to work-accounting, coverage, verifier, completion-gate,
  and task-completion pipeline;
- no full cross-process lock/lease/transaction model for production execution.

Required TASK-0298 boundary: design and implement the vendor-neutral production
execution adapter contract and conformance harness with a test implementation
only. The contract must make adapter identity, system-owned capabilities,
permission scope, idempotency propagation, provider invocation references,
status lookup, result replay, cancellation/query support, normalized response,
bounded failure classification, and secret redaction explicit. Task, model,
operator, or provider prose must not be able to claim capabilities, policy
approval, retry safety, completion, verification, credential values, or allowed
tools/filesystem/network scope.

Minimum initial production provider profile, before any later enablement:
idempotency key propagation, deterministic provider invocation reference,
lookup by idempotency key, status query, result replay or equivalent durable
outcome retrieval, bounded normalized errors, no raw secret exposure, explicit
system-owned capability declaration, and a no-blind-retry reconciliation path
are required. Cancellation is recommended where the provider supports
long-running work.

## Execution Adapter Contract - TASK-0298
TASK-0298 adds a vendor-neutral execution adapter contract in core without
enabling production execution. The public boundary is
`TaskExecutionAdapter` and related request, capability, permission, credential
reference, raw response, normalized result, failure, and conformance result
types.

The only executable adapter kind in this task is:

```ts
kind: "test_execution"
```

No OpenAI, Anthropic, shell, filesystem, tool, HTTP, or production-provider
adapter kind is callable through this contract. The deterministic implementation
used for coverage exists only inside core smoke code and is not exported.

Adapter identity is system-owned. The identity includes adapter id, adapter
kind, implementation version, capability version, and
`identityAuthority: "system"`. Task prose, model output, operator text, or raw
provider output cannot choose authoritative adapter identity, invocation id, or
idempotency key.

Capabilities are explicit system/provider metadata:

- `supportsIdempotencyKey`
- `supportsLookupByIdempotencyKey`
- `supportsInvocationStatusQuery`
- `supportsResultReplay`
- `providesDeterministicProviderInvocationReference`
- `supportsBoundedErrors`
- `supportsCancellation`
- `supportsStreaming`
- `supportsToolCalls`
- `supportsExternalSideEffects`

Capability does not grant permission. Permissions are a separate
system-authorized contract covering policy requirement/authorization, external
side-effect permission, network, filesystem, process/shell, tool-call, and
model-invocation permission. For TASK-0298 test execution all real external
permissions remain false, and adapters cannot self-authorize policy. Policy
required is not policy authorized.

The credential boundary accepts safe references only: credential ref, optional
secret-provider ref, credential scope, system authority, and an explicit
`rawCredentialMaterialPresent: false`. Raw credential fields such as API keys,
tokens, secrets, passwords, and authorization headers are not normal invocation
fields and are stripped from normalized adapter output.

Invocation requests are built from authoritative AEOS invocation context:
invocation id, persisted idempotency key, task id, source task revision,
attempt id and number, optional work item and batch, operation kind, system
adapter identity, safe input/reference, credential reference, permission
requirements, and trace reference. The adapter receives no task-state mutation
functions, persistence capabilities, audit writers, verifier runtime, policy
runtime, shell, filesystem execution, or provider SDK runtime.

Idempotency propagation is explicit. The request carries the persisted AEOS
idempotency key unchanged. The conformance harness verifies the test adapter
receives that exact key and rejects raw responses that echo a different
idempotency key or a different invocation/task/attempt binding.

Raw adapter output is normalized to bounded invocation facts only. Normalized
results may report invocation returned/failed/in-progress/unavailable,
provider invocation reference, output/reference, diagnostic code/message,
metadata, failure classification, reconciliation capabilities, and issues.
They cannot grant work completion, task completion, verifier pass, approval,
policy authorization, retry safety, completion-gate satisfaction, audit writes,
or task-state mutation.

Failure categories are closed for this contract:

- `unavailable`
- `timeout`
- `rejected`
- `invalid_request`
- `provider_error`
- `unknown`

Raw stack traces are not normalized as authoritative diagnostics, and
retryability is not inferred from prose.

The execution adapter capability model reuses the TASK-0296 reconciliation
semantics for idempotency-key support, lookup by idempotency key, invocation
status query, and result replay. This keeps future recovery requirements
consistent across execution and provider reconciliation boundaries.

`evaluateTaskExecutionAdapterConformance` is a deterministic, dependency-free
conformance harness. It validates adapter identity, test-only kind, capability
shape, production-capability profile, permissions, credential references,
idempotency propagation, invocation binding, result normalization, hostile
output stripping, secret stripping, bounded error normalization, reconciliation
capability alignment, and no mutation of supplied state snapshots. The harness
does not enable production calls.

Conformance distinguishes:

- `testExecutionConformant`: true only for safe `test_execution` behavior.
- `productionContractConformant`: true only when the minimum production
  contract profile is represented.
- `productionExecutionEnabled`: always false in TASK-0298.

A test adapter may pass test conformance while failing the production profile.
Even a production-contract-conformant object remains non-executable for real
provider calls.

The hostile output regression includes raw claims such as `completed`,
`verified`, `approved`, `allDone`, `safeToRetry`, `taskCompleted`, and
`policyAuthorized`. Normalization strips those authority fields and reports
them as ignored diagnostics only. Secret-like fields such as `apiKey`, `token`,
`secret`, `password`, and authorization headers are stripped from normalized
results.

The 400/20 invariant remains unchanged:

```text
400 expected work items
20 accounted work items
380 remaining work items
adapter returns completed/verified/allDone
```

Execution adapter normalization and conformance do not create completion
authority, verifier authority, approval authority, retry authority, or task
state mutation.

Production execution remains disabled because the remaining hard blockers from
TASK-0297 still stand: production policy runtime/proof, credential runtime,
durable audit runtime, crash/recovery provider integration, retry protocol, and
execution-result to work-accounting, coverage, verifier, completion-gate, and
task-completion pipeline.

## Execution Permission And Policy Gate - TASK-0299
TASK-0299 adds the core execution permission/policy gate foundation without
enabling production execution. The public boundary is
`evaluateTaskExecutionPermissionGate(...)` plus typed gate input, result,
permission requirement, policy requirement, policy proof, decision, issue, and
safety contracts.

The gate is pure and read-only. It does not invoke adapters, call providers,
resolve credentials, write audit events, run policy runtime, run verifiers,
mutate task state, mutate attempt state, mutate invocation records, complete
work, or complete tasks. Its result explicitly keeps adapter invocation,
production execution, task/attempt/invocation mutation, audit write, verifier
run, work completion, and task completion false.

Capability remains distinct from permission. Capabilities come only from the
system-owned adapter definition. Task prose, model output, operator text, and
adapter output cannot grant network, filesystem, process, shell, model
invocation, tool-call, or external-side-effect capability. If a required
capability is absent, the gate blocks before any adapter invocation.

Permission remains distinct from capability. The gate evaluates the closed
execution permission set for model invocation, tool call, network, filesystem,
process, shell, and external side effects. A capable adapter is still denied
when the corresponding system-owned permission is not granted. For the current
TEST adapter all real side-effect permissions remain false; a safe in-memory
test operation may be authorized only when it does not require those
permissions.

Policy required is not policy authorized. The policy requirement is built from
authoritative system/invocation/adapter metadata, not from task prose. If
authoritative policy says `policyRequired: false`, lack of approval proof alone
does not block the TEST gate. This does not enable production provider calls:
credential, audit, production adapter activation, verifier, retry, and
completion boundaries remain separate.

When policy is required, missing proof fails closed. The only accepted
TASK-0299 proof source is the TEST-only system source:

```ts
source.kind === "test_policy_authority"
source.authority === "system"
```

Operator prose, task prose, model output, adapter output, arbitrary CLI flags,
free-form text, and production approval services are not accepted as policy
authorization proof. The TEST policy authority exists only in smoke coverage
and is not exported as public API.

Policy authorization proof is bound to the exact invocation context: task id,
task revision, attempt id, invocation id, adapter id, operation kind, required
permission set, and policy gate id. A proof for another invocation, adapter,
task revision, operation, or permission set is rejected. Unknown proof
decisions, missing proof decisions, denied proof, approval-required proof,
expired proof, and invalid proof sources all fail closed.

Adapter self-authorization remains forbidden. Adapter metadata or output
claiming `permissionGranted`, `policyAuthorized`, `approved`, network/shell
allowance, completion, verification, or similar authority cannot authorize the
gate. Task or model prose such as "approved", "admin approved", "network
permitted", "safe to run", or "policy passed" is ignored.

The credential boundary remains a reference boundary only. The gate may
represent whether a credential reference is required and present, but it does
not resolve secrets, inspect API keys, render raw credentials, or pass raw
credential material. TASK-0300 adds TEST-only credential reference resolution
after this gate; production credential runtime remains unavailable.

Audit and verifier remain downstream. Passing the permission gate does not mean
an audit event was written, a verifier was run, work was completed, or the task
completion gate was satisfied. Authorization is not completion.

Conformance and authorization are separate. A production-contract-conformant
adapter may still be denied by the permission/policy gate. A capability may be
supported while permission is absent, and the gate denies that case. Production
execution remains globally disabled by
`TASK_EXECUTION_ADAPTER_PRODUCTION_EXECUTION_ENABLED === false`.

Smoke coverage exercises valid no-policy TEST authorization, valid TEST policy
proof, missing/denied/mismatched/stale/unknown/missing-decision proof failures,
missing capability, capability-true/permission-false denial, adapter
self-authorization rejection, task/model prose rejection, no credential
rendering, no audit write, no verifier run, no state mutation, deterministic
re-evaluation, blocked-gate no-invocation, allowed-gate TEST-only invocation,
and the existing 400/20 incomplete-work invariant.

## Credential Resolution Boundary - TASK-0300
TASK-0300 adds a core credential-resolution boundary without enabling
production execution. Credential references remain distinct from resolved
secret values. A credential reference may identify a logical credential id,
optional provider reference, and scope under `credentialAuthority: "system"`;
it is not raw credential material and cannot contain API keys, tokens, secrets,
passwords, authorization headers, bearer values, refresh tokens, or private
keys.

Resolution ordering is closed:

```text
adapter conformance
  -> permission/policy gate
  -> credential resolution only if gate allowed
  -> TEST adapter invocation
```

If the permission or policy gate blocks, the secret provider is not called.
Credential existence does not grant permission, and permission authorization
does not guarantee credential availability. Missing, denied, thrown, expired,
invalid, production-kind, or scope-mismatched credentials block adapter
invocation.

The only runtime-resolvable provider kind is:

```ts
kind: "test_secret_provider"
```

The TEST provider is dependency-injected in smoke coverage only and is not
exported. No environment variables, Keychain, Vault, cloud secret manager,
filesystem secret file, network provider, production SDK, or generic external
provider is read or called. Provider identity is system-owned; task prose,
model output, operator text, CLI flags, or adapter output cannot choose runtime
provider code or supply raw credential authority.

`resolveTaskExecutionCredential(...)` builds the resolution request from the
current authoritative invocation context: task id, task revision, attempt id,
invocation id, adapter id and kind, operation, credential reference, credential
scope, policy gate id, and permission/policy authorization result. Task/model
or operator text such as `apiKey=...`, `use token ...`, or `credential
approved` is ignored and cannot become resolved credential authority.

Resolved credentials are ephemeral execution input only. The runtime object may
carry a fake TEST value for the adapter call scope, but the public resolution
result is sanitized metadata: resolved flag, credential reference id, provider
id, scope, expiry, resolution reference, gate binding, issues, and safety
facts. The raw value is intentionally not persisted, rendered, logged, added to
task state, attached to attempt or invocation records, included in audit/status
models, or copied into normalized adapter output. JavaScript memory cannot
guarantee secure zeroization; TASK-0300 limits lifetime and serialization
instead of claiming memory erasure.

Adapter echo protection is explicit for the resolved value. If a TEST adapter
attempts to echo the exact ephemeral credential in output, metadata, message,
diagnostics, or failure data, normalization rejects the response and records a
sanitized issue without the secret. Existing secret-like output keys remain
stripped as before.

Credential scope is bound to the system-required adapter operation scope. A
credential for another adapter or operation does not authorize the current
operation, and the TEST provider cannot expand the scope returned by the
system-owned credential reference. Expired resolved credentials are not used.
Near-expiry refresh is outside this MVP.

No raw secret CLI exists. Existing status and invocation inspection commands
render persisted invocation metadata only and do not expose fake resolved
secrets. It remains acceptable for safe credential reference identifiers to
exist in request metadata where the current contracts already allow references;
raw values never enter persisted invocation records or status output.

Production execution remains disabled:

```ts
TASK_EXECUTION_ADAPTER_PRODUCTION_EXECUTION_ENABLED === false
```

Real credential providers, durable audit runtime, verifier runtime, production
policy approval runtime, retry/resume execution, task completion, and
production adapters remain missing.

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
operator-supplied approval proof.

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
