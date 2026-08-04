# Agentic Runner Planning Logic

## Purpose
Document the AEOS agentic runner planning logic.

Planning logic converts task contracts, lifecycle inventory, work items, policy
requirements, adapter boundaries, audit expectations, and verifier requirements
into an `AgenticRunnerPlan`.

This document describes the current side-effect-free planning MVP and its safety
constraints. It does not describe CLI commands, runner execution, adapters,
storage, or package changes as implemented behavior.

## Why Runner Planning Is Needed
Agentic execution must be planned before it is run because model output is not
completion proof. AEOS needs an external, deterministic plan that says what work
exists, which batches may run, which steps are allowed, which actions require
policy or human approval, which audit events are expected, and which verifier
handoff is required before completion.

Runner planning prevents a task from becoming a loose instruction to an agent.
The plan makes partial work visible, keeps unprocessed work resumable, and
forces completion through observed state and coverage verification instead of
model self-reporting.

## Current Runner Foundation Status
The current foundation is contract-first and conservative:

- `docs/AGENTIC_RUNNER_ARCHITECTURE.md` defines the runner as the coordinator
  for task contracts, policy gates, batches, adapters, audit, resume, and
  verifier handoff.
- `docs/AGENTIC_TASK_LIFECYCLE_DESIGN.md` defines task states, inventory, work
  item states, batches, coverage, audit, resume, and failure handling.
- `docs/AGENTIC_COVERAGE_VERIFIER_DESIGN.md` and
  `docs/AGENTIC_COVERAGE_VERIFIER_USAGE.md` define deterministic coverage
  verification and reject model-reported completion.
- `docs/TASK_CONTRACT.md`, `docs/POLICY_PERMISSION_MODEL.md`,
  `docs/AUDIT_LOG_FORMAT.md`, `docs/ADAPTER_CONTRACTS.md`, and
  `docs/VERIFICATION_STRATEGY.md` define the boundaries planning must honor.
- `packages/core/src/agentic-runner.ts` already defines `AgenticRunnerPlan`,
  `AgenticRunnerStep`, policy gate, execution boundary, audit handoff, verifier
  handoff, resume state, and runner result contracts.
- `packages/core/src/agentic-runner.example.ts` already shows planned,
  approval-required, incomplete sitemap, verified, resume, and audit-gap
  examples.

The current planning implementation lives in
`packages/core/src/agentic-runner-planning-logic.ts` and is exported from
`packages/core/src/index.ts`.

## Planning Responsibilities
Runner planning should:

- validate planning prerequisites from the task contract and lifecycle input;
- interpret task contract scope, allowed context, file boundaries, verification,
  stop conditions, policy requirements, and handoff expectations;
- create or validate stable work item plans;
- create or validate deterministic batch plans;
- create ordered runner steps;
- attach policy gates before risky or state-changing actions;
- attach adapter execution boundaries without invoking adapters;
- attach expected audit event ids and audit status expectations;
- require coverage verifier handoff for executable plans;
- build deterministic resume state from pending and retryable work;
- produce compact human and JSON plan output;
- fail closed when required state is missing or contradictory.

## Planning Non-Responsibilities
Runner planning must not:

- execute model, agent, tool, verifier, audit, policy, shell, Git, dependency,
  migration, deployment, network, or memory operations;
- mark work items completed from model output;
- mark a task completed;
- read unlisted context or scan broad repository state;
- broaden task scope beyond the task contract;
- approve risky actions;
- create hidden side effects;
- repair lifecycle state by guessing;
- implement CLI commands.

## Inputs
Planning inputs should be serializable and task-scoped:

- `taskId`;
- task contract reference or parsed `AeosTask`;
- lifecycle state, when resuming or re-planning;
- inventory and work item records;
- existing batches, when provided by lifecycle or contract;
- policy grants, approvals, and policy gate result, when already evaluated;
- adapter references and declared capabilities;
- audit references and required audit expectations;
- verifier handoff and verification requirements;
- runner mode such as `plan`, `dry_run`, `execute`, or `resume`;
- options such as output mode, limits, and future batch sizing.

Inputs must exclude raw secrets, provider SDK objects, raw prompts, full model
outputs, broad repository snapshots, and unlisted files.

## Outputs
The primary output is an `AgenticRunnerPlan` plus companion plan result fields:

- ordered runner steps;
- expected work item count;
- expected batch count;
- required approvals;
- required policy checks;
- expected audit events;
- `verifierRequired: true` for executable plans;
- policy planning result;
- execution boundary;
- audit handoff;
- verifier handoff;
- resume state;
- normalized planning issues;
- summary counts.

`ok: true` in planning mode may mean the plan was built successfully. It must
not mean the task is completed.

## Planning Flow
```text
Task contract / lifecycle input
   |
   v
Validate planning prerequisites
   |
   v
Create work item plan
   |
   v
Create batch plan
   |
   v
Create runner steps
   |
   v
Attach policy gates
   |
   v
Attach adapter execution boundaries
   |
   v
Attach audit expectations
   |
   v
Require coverage verifier
   |
   v
AgenticRunnerPlan
```

## Critical Safety Rule
Every executable runner plan must require coverage verification before completion.

An executable plan is any plan that can lead to adapter execution, tool action,
artifact change, state transition, verification run, resume update, or
completion decision. Such plans must set `verifierRequired: true`, include a
verifier step, and block completion unless the verifier handoff is verified.

## Implemented MVP Notes
The implemented MVP planner is a deterministic, side-effect-free helper. It
plans and validates represented state only; it does not execute runner work,
call adapters, append audit events, run the verifier, or mark tasks completed.

Safety hardening treats executable work without represented work items as
invalid. Represented empty batches and explicitly supplied empty batch lists for
executable work are planning issues. Missing batch work item ids and batch
references to missing work items are planning issues. Verifier-gated planning is
required for executable plans, and disabling the verifier or the completion gate
produces planning issues.

## Task Contract Interpretation
The planner interprets the task contract as the authority for scope.

Rules:

- `TASK-ID` becomes the runner `taskId`.
- `CONTEXT TO LOAD` defines approved context references only.
- `DO NOT LOAD` becomes denied read scope.
- `FILES TO MODIFY` defines safe write candidates.
- `FILES NOT TO TOUCH` becomes denied write scope.
- `VERIFY` becomes verifier and smoke test requirements.
- `STOP CONDITION` prevents continuing into later tasks.
- planning-only tasks may create documentation plans, but must not imply runtime
  behavior exists.
- forbidden operations become explicit denied operations in the execution
  boundary.

If a contract omits required planning fields, conflicts with lifecycle state, or
requires unlisted context, the planner returns a blocked plan.

## Inventory And Work Item Planning
Work items are the accountable units of progress.

Rules:

- work items must have stable ids;
- duplicate work item ids are invalid;
- pending work must remain pending until observed completion;
- failed and skipped states must be explicit and include reasons or issues;
- no model output can create completed work without observed result
  representation;
- completed or verified prior work may be preserved on resume;
- retryable work stays retryable until a new observed attempt succeeds or the
  item is explicitly failed or skipped;
- missing expected work item ids create planning issues;
- item order is deterministic and does not depend on model wording.

Stable ids should be derived from explicit inventory keys, declared paths,
declared URLs, record ids, or deterministic indexes within a stable inventory
source.

## Batch Planning
Batches group eligible work item ids into bounded execution units.

Rules:

- batch ids must be deterministic;
- MVP may use existing batches from lifecycle or task contracts;
- configurable max items per batch is later scope;
- each batch `expectedItemCount` must match its `workItemIds.length`;
- duplicate work item ids across batches are invalid unless explicitly allowed
  by a later reprocessing policy;
- completed batch counts must not override unfinished work item states;
- batch ordering is stable across resumes for unchanged lifecycle input;
- retries create new attempts, not rewritten batch history.

For MVP, if batches already exist, planning validates and uses them. If batches
are omitted but work items are explicit, planning may create a deterministic
`batch-all` concept without executing it. If batches are explicitly represented
as an empty list for executable work, planning reports an issue instead of
silently synthesizing executable batches.

## Step Planning
Runner steps should be deterministic and explicit.

Required step types:

- policy preflight step;
- approval step when needed;
- batch execution steps;
- audit append steps;
- verifier step;
- resume cursor update step.

Step rules:

- step ids are stable and derived from task id, step kind, and batch id when
  applicable;
- `order` is unique and ascending;
- execution steps reference work item ids and batch ids;
- audit append steps reference expected audit event ids;
- verifier steps always appear after execution and audit expectation planning;
- resume cursor update steps appear after verifier planning for incomplete or
  resumable work;
- blocked plans may include only preflight, approval, audit, verifier, and
  resume steps as applicable.

## Policy Gate Planning
Policy gates are planned before risky actions and before any state-changing
adapter boundary.

Rules:

- policy gate required before risky actions;
- `deny` produces a blocked plan with denied operations recorded;
- `requires_approval` produces a `waiting_for_approval` plan;
- `allow` produces an executable plan only within the approved scope;
- approval does not broaden the task contract;
- denied actions must not have execution steps marked runnable;
- policy audit expectations are added before action steps.

Risky actions include shell writes, dependency changes, Git writes, file deletes,
renames, migrations, deployments, secret access, broad reads, network side
effects, and tool or MCP calls with side effects.

## Adapter Boundary Planning
Adapters are references in the plan, not executions.

Rules:

- model adapter references are proposed execution workers;
- model adapters may propose outputs but cannot mark work complete;
- tool adapter references perform controlled actions only through allowed
  operations;
- tool actions require declared intent, scope, and expected side effects;
- denied operations must be explicit;
- human approval may be required before tool actions;
- verifier adapters or verifier logic receive evidence and return verification
  status, but the planner only schedules the handoff;
- audit adapters append planned events during execution, not during planning.

The execution boundary should include allowed operations, denied operations,
permission mode, human approval requirement, approval state, and policy decision
ids.

## Audit Expectation Planning
Planning defines expected audit events without claiming they have been emitted.

Expected audit events:

- task planned;
- policy checked;
- batch started;
- batch completed or batch failed;
- verifier completed;
- resume cursor updated.

Rules:

- expected event ids are deterministic;
- emitted audit ids are recorded only from observed append results;
- missing required audit ids keep audit status `planned`, `partial`, or
  `missing`;
- audit append failure blocks completion when audit is required;
- audit events use concise summaries and never raw prompts, full model output,
  secrets, broad logs, or file contents.

## Verifier Requirement Planning
Coverage verification is the completion gate.

Rules:

- verifier required flag must be true for executable plans;
- runner cannot complete without verifier handoff verified;
- coverage verifier receives inventory, work items, batches, artifacts, audit
  refs, lifecycle result, and verification snapshots;
- verifier issues become runner issues without being hidden;
- incomplete verifier status keeps the plan resumable when work remains;
- failed or blocked verifier status prevents completion.

Planning should create the verifier handoff shape, required checks, expected
audit event ids, and verifier step. It must not simulate verifier success.

## Resume Planning
Resume planning is state-driven.

Rules:

- pending item ids are selected from lifecycle state, not model memory;
- retryable item ids are selected only when marked retryable with issues or
  attempts;
- verified work is not rerun by default;
- completed, failed, and skipped terminal items are not counted twice;
- stale cursors are planning or verifier issues;
- the next batch id is deterministic from remaining eligible item ids;
- resume cursor updates are planned as explicit steps and audit events.

If only partial work is complete, the plan remains incomplete but resumable.

## Human Approval Planning
Human approval planning represents waiting states without running actions.

Rules:

- approval is scoped to a specific proposed action and permission scope;
- missing approval produces `waiting_for_approval`;
- denied approval produces a blocked plan with the denied operation recorded;
- approved actions still require policy, audit, adapter, and verifier boundaries;
- model confidence or agent handoff text is never approval.

## Failure And Blocked Planning
The planner should prefer explicit blocked states when a human decision,
permission, input, audit sink, or environment support could unblock the task.

Failure and blocked categories:

- `scope_failure` for contract boundary conflicts;
- `policy_failure` for denied or approval-missing actions;
- `inventory_failure` for invalid inventory or duplicate item ids;
- `coverage_failure` for incomplete or contradictory coverage;
- `adapter_failure` for unavailable or unsupported adapters;
- `audit_failure` for missing required audit evidence expectations;
- `verification_failure` for missing or invalid verifier requirements;
- `resume_failure` for stale or contradictory resume cursors.

The planner must not hide denied, skipped, failed, retryable, or partial
outcomes.

## Deterministic Ordering Rules
Planning output should be stable for the same input.

Rules:

- sort work item ids by stable inventory order, then id;
- sort batch ids by first item order, then batch id;
- sort policy gates by step order, then action id;
- sort audit expectations by step order, event type, then event id;
- sort issues by severity, category, code, then affected id;
- assign step order after all prerequisite insertions are known;
- do not use wall-clock time for ids;
- use timestamps only in observed state fields when execution later records
  events.

## JSON Plan Concept
Future JSON planning output should be stable and compact:

```json
{
  "ok": true,
  "taskId": "...",
  "mode": "plan",
  "plan": {},
  "policy": {},
  "executionBoundary": {},
  "audit": {},
  "verifier": {},
  "resume": {},
  "issues": [],
  "summary": {}
}
```

In `plan` mode, `ok: true` means the plan is internally valid and ready for the
next allowed step. It does not mean agentic work is complete.

## CLI Integration Concept
Future CLI surface:

```text
aeos task plan
aeos task plan --json
aeos task run --dry-run
aeos task status
```

Do not implement these commands in this task.

Expected CLI behavior:

- `aeos task plan` renders a compact human planning summary;
- `aeos task plan --json` emits the JSON plan concept;
- `aeos task run --dry-run` builds the same plan and reports what would run;
- `aeos task status` reports lifecycle, coverage, audit, and resume state from
  persisted evidence.

CLI code should call core planner contracts and helpers. CLI code should not own
policy, audit, adapter, or verifier logic.

## Sitemap Example
A sitemap task discovers 400 sub-sitemaps.

Planning result:

- 400 sub-sitemaps become 400 work items;
- each work item id is stable, such as `sitemap:0001` through `sitemap:0400`;
- batches are deterministic, such as `batch:sitemap:001`,
  `batch:sitemap:002`, and onward;
- expected batch counts match the ids in each batch;
- policy preflight is planned before reads or tool calls;
- adapter execution boundaries list allowed read or crawl operations and denied
  write, deploy, dependency, and Git operations;
- audit expectations include task planned, policy checked, batch started, batch
  completed or failed, verifier completed, and resume cursor updated;
- verifier is required.

If only 20 sub-sitemaps are processed, the plan remains resumable and
incomplete after verifier review:

```text
expected_items == completed_items + explicitly_failed_items + explicitly_skipped_items
400 == 20 + 0 + 0
```

The equality fails. The remaining 380 work items stay pending or retryable, the
resume cursor points to the next eligible batch, and there is no completed state
without verifier success.

## MVP Scope
MVP planning scope:

- planning contract types and examples;
- prerequisite validation from explicit task and lifecycle input;
- stable work item validation;
- deterministic use of existing batches;
- runner step ordering;
- policy gate mapping to planned, blocked, and waiting states;
- adapter boundary planning without execution;
- audit expectation planning;
- verifier-required planning;
- deterministic resume state planning;
- JSON and human plan shape concepts;
- smoke tests over pure local data.

MVP remains deterministic, auditable, resumable, verifier-gated, and local-first.

## Later Scope
Later scope may include:

- configurable max items per batch;
- explicit reprocessing policies for duplicate item membership;
- richer adapter routing and capability matching;
- durable planner storage;
- policy simulation;
- audit sink query integration;
- verifier run history;
- large inventory pagination;
- UI status rendering;
- queueing and scheduling;
- cross-repository plan graphs.

## Non-Goals
- Implement runner execution.
- Implement CLI commands.
- Add package dependencies.
- Deploy or push.
- Trust model self-reporting.
- Support unbounded autonomous execution.
- Replace task, lifecycle, policy, audit, adapter, or verifier contracts.

## Smoke Test Requirements
Current smoke tests should prove:

- planning rejects duplicate work item ids;
- planning rejects duplicate work item ids across batches unless later policy
  allows it;
- executable planning rejects zero represented work items;
- executable planning rejects explicitly empty batch lists;
- pending work remains pending until observed completion;
- failed and skipped work without explicit reasons cannot count as terminal;
- model completion claims do not create completed work;
- batch expected count must match work item ids;
- policy denial produces a blocked plan and no executable adapter step;
- approval-required action produces `waiting_for_approval`;
- executable plans always set `verifierRequired: true`;
- runner cannot complete without verifier handoff verified;
- sitemap case with 20 of 400 processed remains incomplete and resumable;
- audit expectations include task planned, policy checked, batch started, batch
  completed or failed, verifier completed, and resume cursor updated;
- JSON output contains stable top-level fields.

## Current Review Status
The planning MVP now includes contracts, examples, deterministic planning logic,
smoke coverage, and usage documentation. The current review scope is safety and
alignment only; runner execution lifecycle design remains later work.
