# Requirement / Work-Item Progress Ledger

TASK-0326 · GitHub Issue #6 · depends on TASK-0325 (worker result → work accounting bridge)

Source: `packages/core/src/task-execution-progress-ledger.ts`

## What the ledger is

The progress ledger answers one operator question authoritatively: **for this task, and for
each requirement inside it, how much work was expected, how much is accounted, and how much
remains?**

It is a **derived projection of durable AEOS-owned task state**, not a second stored copy of
the numbers. Nothing about the ledger is written to disk. `buildTaskProgressLedger` reads a
`PersistedTaskState` snapshot; `loadTaskProgressLedger` reads that snapshot from
`.aeos/state/tasks` first.

That single design decision is what makes most of the acceptance criteria structural rather
than defensive:

| Requirement | Why it holds |
|---|---|
| Accounted never wrongly exceeds Expected | Both are derived from the same work-item set; Accounted is the size of a subset of Expected |
| Duplicate evidence is not counted twice | Accounted is the **size of a set of accounted work items**, never a sum over an event stream |
| The ledger reads identically after a restart | There is no ledger file to drift; the same durable state always yields the same numbers |
| A stale ledger is never mutated | There is nothing to mutate; staleness is refused at projection time |
| Model claims cannot move the ledger | No worker- or model-supplied field is read at any point |

### What "durable" and "revision-guarded" mean here

"Durable" refers to the **source of truth** being durable task state, not to past projections
being independently retrievable. `.aeos/state/tasks` holds only the current snapshot, so a
ledger emitted at revision R is not reconstructible once the task moves past R. The
`taskStateRevision` stamp makes the current projection auditable against the current state and
lets evidence from a newer revision be detected and refused — it does not create a snapshot
log. A retrievable history of past projections would need an external snapshot store and is
not part of this task.

## Counting semantics

**Expected** — the number of represented work items, at the task level and per requirement.

**Accounted** — work items in a terminal accounted state: `completed`, `verified`, `failed`,
`skipped`. This **extends** the canonical coverage rule
`expected_items == completed_items + explicitly_failed_items + explicitly_skipped_items`, which
does not include `verified`; `verified` is counted here for forward-compatibility only.
Persisted task state currently rejects `verified` outright (verifier authority is not unlocked
in this MVP), so `verifiedItemCount` is always `0` against real persisted state today and the
two definitions cannot currently disagree.

**Remaining** — always computed as `Expected - Accounted`. It is never stored, never supplied
by a caller, and never persisted. `Expected=400, Accounted=20 → Remaining=380` is asserted
with those literal numbers in the smoke suite, at both task and requirement level.

`pending`, `in_progress` and `retryable` items are **not** accounted. A retryable item counts
as remaining work, which is the fail-closed reading.

`accountedRatio` is `null` when Expected is `0`. There is no division by zero.

## Requirement identity

`AgenticWorkItem` gained an optional `requirementId` (`AgenticRequirementId`). It is an
**additive optional field**: state written before it existed still validates, and state written
with it stays readable by the previous validator, so `AEOS_TASK_STATE_SCHEMA_VERSION` is
unchanged at `1`. A future breaking change to this field must be versioned.

When present it must be a non-empty string — `validateWorkItems` fails closed with
`task_state_invalid_work_item_requirement` otherwise, because a malformed id would silently
reroute the item into the unassigned bucket and quietly misreport a requirement's Remaining.

`buildTaskProgressLedger` repeats the same refusal as
`progress_ledger_invalid_requirement_id`, so a caller handing it synthetic state that never
passed through persistence gets a closed error rather than a quietly misrouted item.

Work items without a `requirementId` — and only those — are grouped under the reserved bucket
`AEOS_PROGRESS_LEDGER_UNASSIGNED_REQUIREMENT_ID` (`"requirement:unassigned"`) and flagged
`unassigned: true`. The ledger never invents a requirement identity, and requirement Expected
counts always sum to the task Expected count.

## Requirement status

| Status | Meaning |
|---|---|
| `not_started` | Nothing accounted and nothing in progress or retryable |
| `in_progress` | Remaining > 0 with work started or accounted |
| `accounted_complete` | Remaining == 0, every accounted item completed or verified |
| `accounted_with_exceptions` | Remaining == 0, but at least one item failed or skipped |

`accounted_complete` is an **accounting** statement, not a completion decision. The ledger sets
`safety.grantsCompletionAuthority: false` and touches neither `completionGate` nor the verifier.
Task completion authority remains out of scope until TASK-0333.

## Evidence reconciliation

`buildTaskProgressLedger` optionally accepts `WorkAccountingEvent`s from TASK-0325. **Events
never contribute to the counters.** Reconciliation exists only so an operator can see why N
events produced K accounted items:

- `counted` — first occurrence of an `accountingEventId`
- `duplicate_suppressed` — a replay of an already-seen `accountingEventId`

Everything else fails closed and returns no ledger at all, on the principle that a projection
that cannot justify its numbers must not report them:

| Error code | Condition |
|---|---|
| `progress_ledger_state_stale_for_evidence` | An event's `taskStateRevision` is ahead of the snapshot — the snapshot is stale |
| `progress_ledger_evidence_not_reflected_in_state` | Evidence names a work item the snapshot does not show as accounted |
| `progress_ledger_event_task_mismatch` | Evidence is bound to a different task |
| `progress_ledger_event_work_item_unknown` | Evidence names an unrepresented work item |
| `progress_ledger_evidence_exceeds_accounted` | Distinct evidence outnumbers the accounted work items it must explain |
| `progress_ledger_unsafe_count` | A counter is not a non-negative safe integer |

There is deliberately **no** `accounted exceeds expected` error code. Every work item
contributes to exactly one tally bucket, so Accounted is always a subset count of Expected and
Remaining is always `>= 0`; no input can produce the violation. A dedicated code that nothing
can emit would be dead surface for callers keying on it. The single `progress_ledger_unsafe_count`
backstop covers the arithmetic invariant, and it is genuinely reachable through
`state.revision` — the one counter the ledger does not re-derive — which a corrupted snapshot
can carry as negative, fractional or out of safe range.

The stale case is the load-bearing one and is exercised naturally: a snapshot is read before
an accounting call, the call produces an event at a higher revision, and projecting the newer
evidence onto the older snapshot is refused. The same stale snapshot still projects **on its
own** — it is refused only where evidence proves the staleness, and it is never mutated or
repaired.

The remaining codes are corruption defences. No AEOS-authorised path can produce them, so the
smoke suite drives them with deliberately damaged inputs and labels them as such.

## Projections

Both projections read the already-derived ledger object rather than recomputing, so they
cannot disagree with each other.

- `toTaskProgressLedgerJson(ledger)` — stable key and array ordering, so the same ledger always
  serialises byte-identically. This is what makes durable read-back comparable. Requirements
  sort by `requirementId`, work items by `workItemId`, and evidence entries by
  `(accountingEventId, disposition)` — the last of these so that the projection does not
  inherit the caller's enumeration order, which for evidence read from a directory scan or
  cursor is not guaranteed to be stable between processes.
- `renderTaskProgressLedgerText(ledger)` — operator-readable, leading with
  `Expected=… Accounted=… Remaining=…` and one line per requirement.

## Authority boundary

Every ledger carries an explicit `safety` block: `authority: "system"`,
`derivedFromDurableState: true`, `mutatesTaskState: false`, `modelClaimsAccepted: false`,
`grantsCompletionAuthority: false`.

The ledger performs no writes, runs no verifier, dispatches no worker, and starts no loop.
A worker asserting success on an invocation that never returned is refused by
`applyWorkAccountingEvent`, and the ledger reads identically before and after that claim.

## Out of scope

Verifier aggregation (TASK-0332), task completion authority (TASK-0333), retry eligibility
(TASK-0334) and the bounded orchestration iteration contract (TASK-0327) are untouched. No CLI
command surface was added; the CLI-facing status projection belongs to the CLI surface tasks
and consumes the two projection functions above.
