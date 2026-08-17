# Bounded Orchestration Iteration Contract

TASK-0327 · GitHub Issue #7 · depends on TASK-0326 (requirement/work-item progress ledger)

Source: `packages/core/src/task-execution-iteration-budget.ts`

## Why this exists

Single-hop orchestration is not enough for the product, but an unbounded autonomous loop breaks
the AEOS safety model. This contract is the middle ground: a **system-owned budget** that makes
multi-step orchestration expressible while keeping every run finite and every stop explainable.

**Unbounded autonomy is forbidden by construction.** There is no "unlimited" sentinel, no `null`
meaning "no cap", and no code path that raises a limit. Every limit is a finite non-negative
integer bounded by a policy ceiling.

This task defines the **contract only**. The multi-step runner that consumes it is TASK-0330, and
nothing here loops: each launch is a separate explicit call by the caller.

## The three layers of authority

| Layer | Value | Who can change it |
|---|---|---|
| Policy ceiling | `AEOS_ITERATION_BUDGET_POLICY_CEILING` | Nobody at runtime — a code change |
| Operator limits | Supplied to `createIterationBudget` | A human operator, bounded by the ceiling |
| Consumption | Recorded per launch | Only `recordIterationBudgetLaunch` |

```
maxSteps 25 · maxWallTimeMs 1_800_000 · maxPlannerCalls 25 · maxWorkerCalls 25 · maxRetries 5
```

No per-kind ceiling sits above `maxSteps`. Because every launch costs a step, the effective cap on
any single kind is `min(itsLimit, maxSteps)`; a per-kind ceiling above the step ceiling would be
phantom headroom, letting an operator read the table and believe they had permitted more
invocations than `maxSteps` can ever allow.

Operator values above the ceiling are **refused, never clamped**. Silent clamping would let a
caller request unbounded autonomy and receive a success result — precisely the confusion this
contract exists to prevent.

`limitsAuthority` is either `system_default` or `operator`. There is deliberately no `planner` or
`worker` authority: a model cannot be the source of a limit.

## The conservative default preserves one-hop behaviour

`AEOS_ITERATION_BUDGET_SYSTEM_DEFAULT` is `maxSteps: 2`, `maxPlannerCalls: 1`,
`maxWorkerCalls: 1`, `maxRetries: 0`, `maxWallTimeMs: 300_000`.

`maxSteps` is **2**, not 1, and the reason matters. "One hop" in this repository is a planner call
*followed by* a worker call — `TaskExecutionTwoModelCanaryResult` carries `plannerCalls: 0 | 1` and
`workerCalls: 0 | 1` as separate counters. Since every launch costs a step, one hop is two steps. A
default of `maxSteps: 1` would refuse the worker call of an existing one-hop run: a breaking config
requirement disguised as a conservative default.

What actually pins the shape to one hop is the per-kind caps of 1: at most one planner call, at most
one worker call, no retries. Widening past one hop is an explicit operator decision, still bounded
by the ceiling. The smoke suite asserts that planner-then-worker both succeed under the untouched
default and that a second hop is refused.

Zero is a legal limit and is enforced as "nothing may launch".

## Launch accounting

`IterationLaunchKind` is `planner_call`, `worker_call` or `retry`. **Every launch costs a step**,
plus its own counter:

| Launch | Increments | Checked against |
|---|---|---|
| `planner_call` | `steps`, `plannerCalls` | wall time, `maxSteps`, `maxPlannerCalls` |
| `worker_call` | `steps`, `workerCalls` | wall time, `maxSteps`, `maxWorkerCalls` |
| `retry` | `steps`, `workerCalls`, `retries` | wall time, `maxSteps`, `maxWorkerCalls`, `maxRetries` |

**A retry charges `maxWorkerCalls`, because a retry re-invokes a worker.** If it did not,
`maxWorkerCalls` would not cap worker invocations at all: an operator setting `maxWorkerCalls: 1`
and `maxRetries: 5` would receive six real invocations against a stated cap of one. `maxRetries` is
a sub-cap *on top of* `maxWorkerCalls`, never an escape from it, so a retry is refused when either
limit is reached. The smoke suite spends the worker cap and then asserts the first retry is refused
with `max_worker_calls_exhausted`.

Otherwise a per-kind limit only blocks that kind: an exhausted planner-call limit does not block a
worker call. Wall time and steps apply to every launch.

Elapsed wall time is **derived** from `startedAt` → `evaluatedAt`, never stored as a counter, so
it cannot be understated by a stale value. An `evaluatedAt` earlier than `startedAt` fails closed
(`iteration_budget_evaluation_before_start`): a clock that has run backwards cannot prove a
wall-time limit is still satisfied.

## Deterministic stop reasons

`AEOS_ITERATION_BUDGET_STOP_REASON_PRECEDENCE` is exported and fixed:

1. `max_wall_time_exhausted`
2. `max_steps_exhausted`
3. `max_planner_calls_exhausted`
4. `max_worker_calls_exhausted`
5. `max_retries_exhausted`

A run that exhausts several limits in the same instant always reports the same reason. A stop
reason that varied with evaluation order would not be durable evidence of anything. Wall time
comes first because it keeps advancing whether or not the run does anything — a wall-time
exhausted run is stopped even if it never consumed a step.

## Durability

The budget lives **inside the persisted task state** (`PersistedTaskState.iterationBudget`) rather
than in a parallel store, so it inherits that layer's optimistic-locking revision guard, atomic
write and restart read-back instead of reimplementing them. The field is additive and optional:
state written before it existed still validates, state written with it stays readable by the
previous validator, and `AEOS_TASK_STATE_SCHEMA_VERSION` is unchanged at `1`. A breaking change to
this field must be versioned.

`recordIterationBudgetLaunch` evaluates before it increments. Consequences:

- **A refused launch consumes nothing.** No step, no call, no retry.
- **The stop reason is written exactly once**, on the transition from running to stopped. An
  already-stopped budget is returned byte-identical — a consumed stop is never re-stamped with a
  later timestamp, matching the AEOS rule that consumed one-shot authority is never reset.
- **Budget exhausted means no new launch.** The decision is `allowed: false` before any worker or
  planner is reached.

## Validation split: shape vs policy

Two validators, deliberately separated:

- `validatePersistedTaskState` validates the budget's **shape** — object structure, non-negative
  safe integers, consumption never exceeding its own limit, and stop reason plus a *parseable*
  timestamp present together. It uses a safe-integer check rather than the file's looser
  `isNonNegativeInteger`, because the overconsumption comparison is only meaningful if both
  operands are exact, and diverging from the budget module would leave one validator calling a
  value valid while the other calls it invalid.
- `validatePersistedIterationBudget` validates **policy** — schema version, recognised stop
  reason, limits within the *current* policy ceiling, and consumption not exceeding its own limit.
  It runs at the point where the budget would authorise a launch.

Overconsumption is checked in **both** validators, not just the persistence one. Consumption can
never legitimately pass its own limit, since the recording path always evaluates before it
increments, so a budget where it has is corrupt rather than merely exhausted. `evaluateIterationBudget`
is reachable without going through durable state — with a hand-built or deserialised budget — so the
corruption check has to live on that path too, or corruption would be silently reclassified as
exhaustion.

Why not validate policy at load time: lowering the ceiling must not make an existing task state
unloadable. It must make the budget unable to authorise anything. Refusing to load would strand
the task and hide its durable stop reason from the operator — the opposite of what an operator
needs when a ceiling has just been tightened. So an over-ceiling budget loads, is visible, and
authorises nothing.

## The model-proposal boundary

`refuseIterationBudgetProposal` always refuses, for `planner`, `worker` and `model` alike, and
never reads `proposedLimits`. It exists so the refusal is a call site with a durable error code
(`iteration_budget_model_proposal_refused`) that a test can assert, rather than an absence of code
that a future change could quietly fill in.

On its own, asserting that this function had no side effect proves little — it is pure and has no
write path. So the smoke suite also asserts the load-bearing property: after a refused widening,
the operator's ORIGINAL limits still bind on the durable enforcement path, and the persisted limits
are unchanged.

## Error codes

| Code | Condition |
|---|---|
| `iteration_budget_limit_exceeds_policy_ceiling` | Operator or persisted limit above the ceiling |
| `iteration_budget_invalid_limit` | Limit is not a non-negative safe integer |
| `iteration_budget_overconsumed` | Consumption exceeds its own limit (corruption, not exhaustion) |
| `iteration_budget_model_proposal_refused` | A planner/worker/model tried to change limits |
| `iteration_budget_evaluation_before_start` | `evaluatedAt` precedes `startedAt` |
| `iteration_budget_not_present` | A launch was recorded against a task with no budget |
| `iteration_budget_invalid_stop_reason` | Unrecognised stop reason in durable state |
| `iteration_budget_inconsistent_stop_state` | Stop reason and timestamp not present together |
| `iteration_budget_unsupported_schema_version` | Budget schema version is not 1 |
| `iteration_budget_invalid_timestamp` | Unparseable ISO-8601 timestamp |
| `task_state_invalid_iteration_budget` | Shape violation at the persistence boundary |
| `task_state_iteration_budget_overconsumed` | Consumption exceeds its own limit (corruption) |
| `task_state_revision_conflict` | Stale task revision at recording time |

## Operator projections

- `toIterationBudgetJson(budget)` — stable key order; includes the current `policyCeiling` so an
  operator can see the headroom, not just the configured value.
- `renderIterationBudgetText(budget)` — `steps=1/1 planner_calls=0/1 …` plus
  `status: stopped (max_steps_exhausted) at <timestamp>`.

## Out of scope

The multi-step runner (TASK-0330), durable iteration state and step identity (TASK-0328), planner
next-step proposals (TASK-0329), retry eligibility classification (TASK-0334), verifier and task
completion authority. Consuming budget does not satisfy a completion gate; the smoke suite asserts
that a fully-consumed budget leaves `completionGate.satisfied` false.
