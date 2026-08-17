# Durable Iteration State and Step Identity

TASK-0328 · GitHub Issue #8 · depends on TASK-0327 (bounded orchestration iteration contract)

Source: `packages/core/src/task-execution-iteration-step.ts`

## Why this exists

TASK-0327 makes a run finite. That is not enough: if a crash or a duplicate dispatch can cause the
*same step* to run twice, a bounded loop is still unsafe. This task gives every orchestration step a
durable identity, a parent binding, a revision, and an exactly-once claim, so that the answer to
"did this step already run?" is a fact on disk rather than an inference.

The single property everything else serves: **a step is launched at most once, and a step that has
crossed the launch boundary is never relaunched and never reset.**

## Determinism is the mechanism

`stepId` is derived by SHA-256 over `(taskId, taskStateRevision, budgetId, stepNumber, launchKind)`,
never generated randomly and never supplied by a caller.

That is the whole idempotency mechanism. The same orchestration intent produces the same `stepId`,
therefore the same file path, therefore an exactly-once create that the second attempt loses. A
random id would silently create a *second* step for the same intent — exactly the duplicate
execution this task exists to prevent.

Every identity-bearing field changes the id, and the smoke suite asserts that for all five
individually. `validateIterationStepRecord` re-derives the id from the record's own binding and
refuses any record whose stored id or fingerprint disagrees, so a hand-edited step is detected
rather than trusted.

## Lifecycle

```
prepared ──launch_step──▶ running ──record_returned──▶ returned
                             │     ──record_failed────▶ failed
                             └──mark_outcome_unknown──▶ outcome_unknown
                                                            │
                                       record_returned ─────┤
                                       record_failed   ─────┘
```

There is **no** transition back to `prepared`, and none that clears `launchBoundaryCrossed`.
`launch_step` is refused for any record that has already crossed the boundary — including one
sitting in `outcome_unknown`. An ambiguous outcome is reconciled, never replayed.

`outcomeCertainty` (`not_launched` / `launched_pending` / `known` / `unknown`) is derived from the
lifecycle and cross-checked on validation, so the two cannot drift apart. `launchedAt` must be present
exactly when the launch boundary has been crossed. `outcomeUnknownAt` is likewise enforced to be present exactly when the lifecycle is `outcome_unknown`: the settle
transitions set it to `undefined`, which `JSON.stringify` drops, but relying on that alone would let
a hand-edited settled record keep a stale ambiguity marker.

### Why `launchBoundaryCrossed` is stored rather than inferred

It is redundant with the lifecycle by construction — and that redundancy is the point. Validation
enforces both directions: a record past `prepared` must have it `true`, and a `prepared` record must
have it `false`. Without both checks, a corrupted or hand-edited record could present as `prepared`
after a real launch and be relaunched. With them, the contradiction is detectable
(`iteration_step_launch_boundary_inconsistent`).

## Parent binding

A step is meaningless without its parent, so `claimIterationStep` verifies the binding against
durable state *before* claiming:

- the task must exist and load;
- `taskStateRevision` must equal the current durable revision → else
  `iteration_step_parent_revision_stale`;
- the task must carry an iteration budget → else `iteration_step_parent_budget_missing`;
- `budgetId` must match that budget → else `iteration_step_parent_budget_mismatch`.

This makes the binding a real check rather than a nominal field, and it is what ties a step to a
specific TASK-0327 orchestration run rather than to a task in general.

## Exactly-once claim

The claim is an `open(path, "wx")` create. **The filesystem decides the winner, not a
read-then-write in application code** — so there is no window in which two claimers both believe
they own the step. On `EEXIST`:

- the caller receives `already_claimed` with the *existing* record, so the original owner and claim
  timestamp survive.

There is deliberately no separate authority-collision check on that path, because it would be dead
code: the read already required the stored record to live at the path its own `stepId` dictates, and
validation already re-derived that `stepId` from the record's own parent binding and launch kind. A
record found at this path therefore carries a binding that hashes to this `stepId`; for its binding to
differ from the requested one while the digest matched would require a SHA-256 collision.

The smoke suite runs eight concurrent claimers for one identity and asserts exactly one `claimed`,
seven `already_claimed`, one agreed `stepId`, and one durable ownership token.

## The two crash boundaries

This is what `deriveIterationStepResumeState` exists to separate.

| Crash point | Durable lifecycle | Resume action | Launch permitted |
|---|---|---|---|
| Before launch | `prepared` | `resume_prepared_step` | **yes** |
| After launch, no outcome | `running` | `reconcile_launched_step` | no |
| After launch, outcome ambiguous | `outcome_unknown` | `reconcile_outcome_unknown` | no |
| All steps settled | `returned` / `failed` | `all_steps_settled` | no |
| Nothing claimed in scope | — | `no_steps` | no |

The table describes the pure `deriveIterationStepResumeState`. The durable wrapper
`loadIterationStepResumeState` adds one outcome the table cannot express: a task carrying **no
iteration budget** has no run to scope against, so it fails closed with
`iteration_step_parent_budget_missing` rather than returning `no_steps`.

`launchPermitted` is `true` for exactly one action. Crash-before-launch is the only case where
nothing can have run, so it is the only case where re-entering the launch is safe. Crash-after-launch
may have run, so resume must reconcile the outcome instead — relaunching would duplicate it.

Ambiguity outranks everything: an unreconciled `outcome_unknown` step blocks the run regardless of
what other steps are waiting, and carries an operator-visible `blockedReason`. There is no blind
reset and no blind retry.

Unsettled steps are considered in `stepNumber` order (ties broken by `stepId`), so the decision does
not depend on directory enumeration order. The smoke suite derives the resume state from a reversed
list and asserts an identical result.

### Resume is scoped to the current run

A step claimed against a superseded `taskStateRevision` or a previous `budgetId` is an **orphan** of
an abandoned run: still durable, possibly still `prepared`, and absolutely not launchable by the
current run. `loadIterationStepResumeState` reads the scope from durable state — not from the caller,
so a caller cannot widen it — and filters to steps matching the current revision and budget id.
Orphans are reported as `orphanedStepCount` rather than dropped silently, so an operator can see them.

Without the filter, an orphan would be selected ahead of the live step, launching work bound to a
parent context that no longer exists — and if the orphan were `prepared`, it would be reported
`launchPermitted: true`.

The smoke suite leaves its orphan in `running` rather than `prepared`, which makes the **claim gate's**
scope filter load-bearing: without it, a superseded run holding a running step would block every
future run's claims for good — a livelock, not merely stale data. So the suite asserts that the same
records derived **unscoped** yield `reconcile_launched_step`, while the scoped read yields `no_steps`
with `orphanedStepCount: 1`, and that the new run can still claim and resume its own step.

A record is also required to live at the path its own derived `stepId` dictates
(`iteration_step_path_identity_mismatch`). That closes what `lstat` cannot: a hard link to another
record in the same directory, or any renamed copy, would otherwise be adopted as a second entry for
an identity that already exists.

A task carrying no iteration budget has no orchestration run to resume against, so
`loadIterationStepResumeState` fails closed (`iteration_step_parent_budget_missing`) rather than
inventing an unscoped answer.

## No new work while the run is unsettled

Exactly-once launch *per step identity* is not by itself enough to honour the AEOS rules that
`outcome_unknown` requires reconciliation and that there is no blind retry.

A `retry` launch kind hashes to a **different** `stepId`, so it is a new step rather than a relaunch.
Without a gate, a caller could claim a fresh retry step while the step being retried sat unreconciled
in `outcome_unknown` — a blind retry that never touches the original's launch boundary. The same hole
would let step N+1 be claimed while step N was still `running`.

So `claimIterationStep` refuses a **new** claim while any in-scope step is `running` or
`outcome_unknown` (`iteration_step_run_blocked_by_unsettled_step`). The step being claimed is
excluded, so a replay of an already-claimed step still receives `already_claimed` from the
exactly-once path rather than this refusal.

Retry *eligibility classification* is TASK-0334 and is deliberately not decided here. What is
enforced here is narrower and squarely in scope: an ambiguous or in-flight run does not accept new
work until it is reconciled. Once reconciled, a retry step is claimable — and the smoke suite asserts
it is a distinct identity starting before its own launch boundary, never a relaunch.

### The gate is not atomic with the claim

`refuseClaimWhileRunIsBlocked` scans, then `open(path, "wx")` claims. Between the two, another caller
could transition an existing step from `prepared` to `running`, so two concurrent claimers for
different step numbers can both pass the gate and each win their own distinct claim.

No safety property is violated when that happens: each step still has exactly-once launch, and
`loadIterationStepResumeState` sees the `running` step and returns `reconcile_launched_step`, refusing
a launch. The gate is a claim-time convenience that keeps the durable state tidy; the *enforcement* of
"never launch while unsettled" lives in the resume derivation and the launch boundary, both of which
are checked at launch time. Making claim-time gating atomic would need a per-run lock rather than a
per-step one, which is only warranted if AEOS ever runs concurrent orchestrators for one task — not
the current deployment model.

## Durability

Steps live in `.aeos/state/iteration-steps/<taskId>/<stepId>.json` — a separate per-task store,
following the invocation-record precedent, because steps are many-per-task while the TASK-0327
budget is a single object that rightly lives inside the task state.

`updateIterationStep` takes an **exclusive lock** at
`.aeos/state/iteration-step-locks/<taskId>/<stepId>.lock` before it reads, mirroring
`updateTaskExecutionInvocation`. The revision guard alone is not sufficient: two concurrent callers
can both read revision N, both pass the guard, and both return `ok` for the same `launch_step`
transition. Last-writer-wins rename leaves the file consistent, but each caller would believe it owns
the launch and could dispatch the underlying worker — a duplicate launch. The lock is what makes
exactly one of them win (`iteration_step_update_locked`).

**Only the caller that created the lock removes it.** An unconditional unlink in the `finally` would
have the *losing* caller delete the winner's lock while the winner was still mid-update, letting a
third caller acquire it and run the read-transition-rename cycle concurrently with the winner — the
lock would actively cause the duplicate launch it exists to prevent. A `lockCreatedByThisCaller` flag
gates the release, and the smoke suite plants a lock owned by "another process", asserts the update is
refused, and asserts **the planted lock still exists afterwards**.

### Crash semantics of the lock (accepted limitation)

The `finally` release covers graceful failures — thrown exceptions and returned errors. It does **not**
cover a process killed between lock creation and release (SIGKILL, OOM, power loss). In that case the
lock file remains and every later `updateIterationStep` for that step returns
`iteration_step_update_locked` indefinitely.

The consequence is a wedge, not a correctness violation: the step stays `running`,
`loadIterationStepResumeState` correctly reports `reconcile_launched_step` and refuses a relaunch, but
the reconciliation path is itself blocked. **Recovery requires an operator to delete
`.aeos/state/iteration-step-locks/<taskId>/<stepId>.lock`**, after which reconciliation proceeds
normally; the step's own lifecycle is untouched by the stale lock, so nothing is lost.

Automatic stale-lock recovery needs a liveness or age policy and belongs with the recovery/resume
state machine (TASK-0335). It is deliberately not invented here — a TTL guessed in this task could
break a legitimately slow update, which would be worse than a wedge an operator can see and clear.
This limitation is shared with `updateTaskExecutionInvocation`.

Under the lock, the transition is applied with an optimistic-locking revision guard
(`iteration_step_revision_conflict`), written to a temp file and renamed, and the immutable identity
is re-verified afterwards: `stepId`, fingerprint, parent binding, launch kind, ownership and
`createdAt`. A transition that changed any of them would be a rewritten step rather than an advanced
one, and is refused (`iteration_step_immutable_identity_changed`).

A refused transition writes nothing — the smoke suite asserts that a refused relaunch leaves both
the revision and the original `launchedAt` untouched.

## The store directory is hostile until proven otherwise

`listIterationSteps` feeds `refuseClaimWhileRunIsBlocked`, so anything that can wedge or poison the
directory read also wedges or poisons every claim for that task. Three entries are therefore refused
rather than trusted:

- **A directory named `<something>.json`.** `readdir` yields names only, so `readFile` would throw
  `EISDIR` — an uncaught throw, not a Result. Every entry is `lstat`-ed first and anything that is not
  a regular file fails closed with `iteration_step_unsafe_target`.
- **A symlinked record.** `ensureStateStoreRoot` proves the per-task *directory* is not a symlink; it
  says nothing about entries inside it, and `readFile` follows links silently. Symlinked entries are
  refused by the same `lstat`.
- **A structurally valid record belonging to a different task.** `validateIterationStepRecord` proves a
  record is self-consistent, not that it belongs here. Every read is checked against the task whose
  directory it came from (`iteration_step_foreign_record`). Without it, a foreign `running` step
  planted in this directory would block the task's run indefinitely — the run-scope filter compares
  revision and budget id, not task id, so it would not catch it.

**Both** `taskId` and `budgetId` are validated against the safe-identifier pattern rather than merely
as non-empty strings, because the identity digest joins its inputs with a space: either one containing
the delimiter would make the digest ambiguous across different bindings. The claim path would refuse an
unsafe `taskId` later at the storage boundary, but validating it at derivation means no ambiguous
digest is ever produced at all, including by callers that never reach storage.

## Freshness probe

`findIdentityCollision` in the two-model canary now also probes `.aeos/state/iteration-steps` and
`.aeos/state/iteration-step-locks`. The AEOS rule that historical canaries are never replayed has to
cover every per-task state root, not only the ones that existed when the probe was written; a canary
taskId that already owns steps or step locks is not fresh.

## Shared path-safety helper

`packages/core/src/task-execution-state-store-paths.ts` is new. Five modules already carried private
copies of the same per-task path-safety logic (`task-state-persistence`,
`task-execution-invocation-persistence`, `task-execution-attempt-persistence`,
`task-execution-audit-persistence`, `task-execution-policy-approval-persistence`); a sixth copy is
not defensible, so this store uses a shared helper with caller-namespaced error codes.

**The five existing stores are deliberately not migrated.** That is a mechanical refactor across five
proven P0 persistence paths and belongs in its own change; folding it into a task about step
idempotency would put working durable-state code at risk for no benefit to this task.

## Error codes

| Code | Condition |
|---|---|
| `iteration_step_identity_mismatch` | Stored id/fingerprint disagrees with the record's own binding |
| `iteration_step_launch_boundary_already_crossed` | A relaunch or reset was attempted |
| `iteration_step_launch_boundary_inconsistent` | Boundary flag contradicts the lifecycle |
| `iteration_step_outcome_certainty_inconsistent` | Certainty contradicts the lifecycle |
| `iteration_step_launch_timestamp_inconsistent` | `launchedAt` contradicts the launch boundary |
| `iteration_step_path_identity_mismatch` | A record is not at the path its own `stepId` dictates |
| `iteration_step_transition_not_allowed` | Intent is illegal from the current lifecycle |
| `iteration_step_claim_conflict` | Claim collided with an unreadable authority record |
| `iteration_step_parent_revision_stale` | Bound revision is not the current durable revision |
| `iteration_step_parent_budget_missing` / `_mismatch` | No parent orchestration run to bind to |
| `iteration_step_revision_conflict` | Stale step revision at update time |
| `iteration_step_update_locked` | Another caller holds the step's update lock |
| `iteration_step_run_blocked_by_unsettled_step` | A new claim was attempted while the run is unsettled |
| `iteration_step_stale_ambiguity_marker` | `outcomeUnknownAt` disagrees with the lifecycle |
| `iteration_step_immutable_identity_changed` | A transition altered immutable identity |
| `iteration_step_invalid_safety` | A safety/completion marker was forged |
| `iteration_step_corrupt_record` | Persisted record is not valid JSON |
| `iteration_step_unsafe_target` | A record path is a directory, symlink or other non-file |
| `iteration_step_foreign_record` | A record belongs to a different task than its directory |

## Authority

`safety.lifecycleAuthority` is `"system"`, and `workCompleted`, `taskCompleted`, `verified`,
`approved` and `modelSelfReportTrusted` must all remain `false` — validation refuses a record where
any has been flipped. Nothing a worker or model reports drives a transition: the caller supplies an
intent and AEOS decides whether that intent is legal from the current lifecycle.

A `retryable: true` failure records a fact; it authorises nothing. Retry eligibility is TASK-0334,
and no step may be relaunched regardless of how its failure was classified — the smoke suite asserts
this explicitly.

## Out of scope

Planner decision logic (TASK-0329), the multi-step runner (TASK-0330), verifier and task completion
(TASK-0332/0333), retry eligibility (TASK-0334), the recovery/resume state machine that will consume
this resume state (TASK-0335). Step progress satisfies no completion gate; the smoke suite asserts
`completionGate.satisfied` is still false after steps settle.
