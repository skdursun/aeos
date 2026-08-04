# Agentic Runner Dry-Run Execution Logic

## Purpose
Document the AEOS agentic runner dry-run execution logic.

Dry-run execution evaluates represented runner plan input and produces an
execution-shaped `AgenticRunnerDryRunResult` without calling model adapters,
tool adapters, audit adapters, policy adapters, verifier logic, or mutating
lifecycle state.

This document describes the current MVP core behavior. It does not describe CLI
commands, storage, adapters, audit writes, verifier runs, or package changes.

## Why Dry-Run Execution Is Needed
Dry-run execution is the preflight bridge between planning and real execution.
Planning says what should exist and which gates are required. Execution performs
work and records observed outcomes. Dry-run gives operators and future CLI
surfaces an execution-shaped preview of what execution would try to do while
preserving the same safety guarantees as planning.

Dry-run execution is needed to:

- validate whether a runner plan is executable enough to attempt later;
- show policy, approval, adapter, audit, verifier, batch, work item, and resume
  implications before side effects;
- expose blocked or invalid plans without starting adapters;
- make audit and verifier requirements visible before runtime;
- produce deterministic JSON for automation;
- prevent model or adapter self-reporting from being mistaken for completion.

## Current Execution Foundation Status
The current foundation is contract-first and conservative:

- `docs/AGENTIC_RUNNER_ARCHITECTURE.md` defines the runner as the coordinator for
  task contracts, policy gates, batches, adapters, audit, resume, and verifier
  handoff.
- `docs/AGENTIC_RUNNER_PLANNING_LOGIC.md` and
  `docs/AGENTIC_RUNNER_PLANNING_USAGE.md` define side-effect-free planning and
  verifier-gated executable plans.
- `docs/AGENTIC_RUNNER_EXECUTION_LIFECYCLE.md` defines the execution lifecycle,
  runtime states, adapter boundaries, audit handoff, verifier handoff, resume,
  failure handling, and completion rules.
- `docs/AGENTIC_TASK_LIFECYCLE_DESIGN.md` defines task, work item, batch,
  coverage, audit, verifier, and resume state concepts.
- `docs/AGENTIC_COVERAGE_VERIFIER_USAGE.md` documents the deterministic coverage
  verifier and its rejection of model self-reporting.
- `docs/POLICY_PERMISSION_MODEL.md`, `docs/AUDIT_LOG_FORMAT.md`,
  `docs/ADAPTER_CONTRACTS.md`, and `docs/VERIFICATION_STRATEGY.md` define
  policy, audit, adapter, and verification boundaries.
- `packages/core/src/agentic-runner-execution.ts` already defines
  `AgenticRunnerExecutionInput`, `AgenticRunnerExecutionResult`, step execution,
  batch execution, work item outcome, adapter call record, policy execution,
  approval execution, audit handoff, verifier handoff, resume update, states,
  issues, and summary contracts.
- `packages/core/src/agentic-runner-dry-run.ts` defines the dry-run preview
  contracts.
- `packages/core/src/agentic-runner-dry-run-logic.ts` implements the
  side-effect-free dry-run preview helper.
- `packages/core/src/agentic-runner-dry-run.example.ts` and
  `packages/core/src/agentic-runner-dry-run-logic.example.ts` provide examples.

There is no task runner CLI runtime yet.

## Dry-Run Responsibilities
Dry-run execution should:

- accept one represented runner plan or planning result reference through
  `AgenticRunnerDryRunInput`;
- validate plan shape and execution prerequisites deterministically;
- evaluate represented policy and approval requirements without enforcement or
  external policy calls;
- create dry-run step execution records;
- create dry-run batch execution records;
- create planned work item outcome previews without completed outcomes;
- create planned adapter call records without invoking adapters;
- create an audit handoff preview without writing audit events;
- create a verifier handoff marked required/not-run when required;
- create a resume update preview from pending and retryable planned work;
- return a JSON-safe `AgenticRunnerDryRunResult`;
- preserve stable ordering for every result array and id list.

## Dry-Run Non-Responsibilities
Dry-run execution must not:

- create a runner plan from scratch;
- repair an invalid plan by guessing missing work;
- call model, agent, tool, MCP tool, audit, policy, or verifier adapters;
- append audit events;
- run coverage verifier logic;
- write lifecycle, task, memory, repository, filesystem, audit, or resume state;
- mark work items completed;
- mark batches completed from planned work;
- produce `completed`, `verified`, or observed terminal completion state;
- approve risky actions;
- broaden task scope;
- implement CLI commands in the current MVP.

## Input Model
MVP dry-run input uses `AgenticRunnerDryRunInput` and requires:

- `taskId`;
- `mode: "dry_run"`;
- `runnerPlan` containing or referencing an `AgenticRunnerPlan`;
- represented `plannedSteps`;
- represented `plannedBatches`;
- represented `plannedWorkItems`;
- options such as `requirePolicy`, `requireApproval`, `requireAudit`,
  `requireVerifier`, `completionGatedByVerifier`, `maxWorkItems`,
  `maxBatchSize`, and `outputMode`;
- optional represented `policyPreview`;
- optional represented `adapterBoundaryPreview`;
- optional represented `adapterCalls`;
- optional represented `auditPreviewInput`;
- optional represented `verifierPreviewInput`;
- optional represented `resumePreviewInput`;
- optional lifecycle reference for preview-only resume derivation.

Inputs must not include raw secrets, provider SDK objects, raw prompts, full
model outputs, raw command logs, broad repository snapshots, or unlisted
context.

## Output Model
Dry-run output uses `AgenticRunnerDryRunResult`:

- `ok`;
- `taskId`;
- `mode: "dry_run"`;
- preview `state`;
- optional plan reference;
- `steps`;
- `batches`;
- `workItems`;
- optional `policy`;
- optional `approval`;
- `adapterCalls`;
- `audit`;
- `verifier`;
- optional `resume`;
- `issues`;
- `summary`.

In dry-run mode, `ok: true` means the dry-run preview was constructed without
blocking validation issues. It does not mean the task is complete, verified, or
safe to mark completed.

## Plan Validation
Dry-run validation should fail closed.

Validation checks:

- `mode` must be `dry_run`;
- `taskId` must be present and match plan references when represented;
- plan reference must be present;
- step ids must be stable, unique, and non-empty;
- step order must be deterministic when order is represented in metadata or
  source plan;
- batch ids must be stable, unique, and non-empty;
- batch `expectedItemCount` must match represented `workItemIds.length` unless
  explicitly marked as representative metadata;
- work item ids must be stable, unique, and non-empty;
- batch work item ids must reference represented work items when item details are
  provided;
- duplicate item membership across batches is invalid unless a future
  reprocessing policy explicitly allows it;
- executable plans must require verifier handoff;
- completion-gated plans must keep `completionGateSatisfied: false` in dry-run;
- expected audit event ids must be deterministic and unique;
- adapter call records must be planned/not-started and non-authoritative.

Invalid plans return `failed` or `blocked` according to contract semantics:
use `blocked` when missing input, approval, policy, or environment evidence can
unblock the plan; use `failed` for contradictory or non-retryable plan shape
defects.

## Dry-Run Flow
```text
AgenticRunnerPlan
   |
   v
Validate plan shape
   |
   v
Evaluate policy/approval requirements without enforcement
   |
   v
Create dry-run step execution records
   |
   v
Create dry-run batch execution records
   |
   v
Create planned adapter call records without calling adapters
   |
   v
Create planned audit handoff without writing events
   |
   v
Create verifier handoff as required/not-run
   |
   v
Create resume update preview
   |
   v
AgenticRunnerDryRunResult
```

## Step Dry-Run Behavior
Dry-run step records mirror execution-shaped steps without claiming execution.

Rules:

- policy preflight steps may be represented as `pending` or `blocked`;
- approval steps may be represented as `blocked` when approval is required;
- batch execution steps remain `pending`, `blocked`, or `retryable` preview
  states;
- audit append steps remain `pending` unless audit requirements are missing or
  blocked;
- verification steps remain `pending` because verifier is not run;
- resume update steps represent a preview only;
- `startedAt` and `completedAt` should be absent unless the input already
  represents prior emitted execution evidence;
- `observedOutcomes` must not include dry-run-created completed outcomes;
- `adapterCallIds` may reference planned adapter call records;
- `auditEventIds` may reference expected or pre-existing emitted events, but
  dry-run must not add newly emitted ids.

Dry-run must not mark a step `completed` or `verified`. Runtime or hostile
preview claims using those states are normalized to failed preview records and
reported as deterministic dry-run safety issues.

## Batch Dry-Run Behavior
Batch dry-run records preview batch execution without observed completion.

Rules:

- each represented batch creates one deterministic batch execution record;
- `workItemIds` are sorted by plan order or stable lexical order;
- `expectedItemCount` is preserved from the plan;
- `observedCompletedCount` is `0` for new dry-run preview records;
- `observedFailedCount`, `observedSkippedCount`, and
  `observedRetryableCount` are `0` unless represented prior lifecycle evidence is
  being previewed;
- batch state is usually `pending`;
- approval-required batches are `blocked`;
- policy-denied batches are `blocked`;
- invalid batch accounting creates issues and maps to `blocked` or `failed`;
- dry-run must not claim observed completion.

Expected counts may be represented. Pending and retryable previews may be
represented. Completed or verified batch preview states are rejected and cannot
inflate runnable batch counts.

## Work Item Dry-Run Outcome Representation
Dry-run work item outcomes are previews, not observed outcomes.

Rules:

- represented pending work remains `pending`;
- represented retryable work remains `retryable`;
- represented in-progress interrupted work should preview as `retryable` or
  `pending` based on existing resume policy, not completed;
- dry-run-created outcomes cannot be `completed` or `verified`;
- completed or verified work item preview states are rejected and cannot inflate
  processable work item counts;
- failed or skipped states may be carried forward only when input already
  represents them with explicit reasons or issues;
- output artifact ids should be absent unless already represented input evidence
  exists;
- adapter records cannot prove item completion;
- completed count remains `0` for new dry-run-created outcome previews.

Work item outcomes should preserve item identity and deterministic order so a
later execute or resume command can compare the dry-run preview with actual
execution.

## Policy Dry-Run Behavior
Dry-run policy behavior is simulation over represented policy state.

Rules:

- dry-run does not call a policy adapter;
- represented `allowed` decisions preview executable steps but do not enforce
  them;
- represented `needs_approval` decisions set the runner state to
  `waiting_for_approval`;
- represented `denied` decisions set the runner state to `blocked` unless the
  denial is a non-retryable plan defect that maps to `failed`;
- missing required policy evidence creates a `blocked` issue;
- policy audit event ids may be expected but must not be written;
- approval never broadens task scope in dry-run.

Dry-run may produce policy records with `status: "checked"` only when the input
already contains represented checked policy evidence. Otherwise the preview
should use `not_checked` or equivalent metadata.

## Approval Dry-Run Behavior
Approval dry-run behavior previews approval gates only.

Rules:

- approval-required plans return `waiting_for_approval`;
- approval status should be `pending` or `requested` when approval is required;
- approval-denied input returns `blocked` or `cancelled` according to the
  represented contract;
- no approval request is emitted to a real approval surface;
- no approval audit event is written;
- no adapter call may be considered allowed by dry-run-created approval
  records.

Human approval remains scoped evidence. Dry-run can report the required scope,
constraints, and missing approval reference, but it cannot grant approval.

## Adapter Dry-Run Behavior
Dry-run may create planned adapter call records.

Rules:

- dry-run must not call model adapters;
- dry-run must not call agent adapters;
- dry-run must not call tool adapters;
- dry-run must not call MCP tool adapters;
- planned call status must be `not_started`, `blocked`, or `unknown`;
- status must not imply a completed call;
- `startedAt` and `completedAt` should be absent for dry-run-created records;
- `outputReference` should be absent or null-equivalent unless an explicit
  dry-run placeholder is represented in metadata;
- `observedOutcomeReference` should be absent for new dry-run previews;
- `observationOnly` must remain `true`;
- `completionAuthority` must remain `false`;
- an adapter record cannot prove task completion.

Model, agent, and tool adapters remain boundaries. Dry-run only records what
would be invoked later after policy and approval gates are satisfied.

## Audit Dry-Run Handoff
Dry-run audit handoff previews audit obligations without writing events.

Rules:

- expected audit event ids may be represented;
- emitted audit event ids must remain empty unless input already represented
  emitted events from prior execution;
- missing audit event ids can be previewed;
- no audit adapter is called;
- no audit write occurs;
- `auditStatus` should be `pending`, `missing`, `partial`, or `not_required`;
- `auditStatus: "complete"` is only valid when input already represented all
  emitted events and dry-run is not claiming to have emitted them;
- missing required audit handoff prevents `completed`;
- dry-run summary `auditEventsEmitted` should be `0` for new dry-run-created
  records.

Dry-run may show expected ids such as policy preflight, approval request, batch
execution, verifier handoff, resume update, and terminal event ids as planned
audit obligations.

## Verifier Dry-Run Handoff
Dry-run verifier handoff previews verifier requirements without running the
verifier.

Rules:

- verifier required is `true` when the plan requires it;
- verifier status must not be `verified` because verifier is not executed;
- `completionGateSatisfied` must be `false`;
- completion cannot be true in dry-run;
- `coverageStatus` should be `unknown`, `incomplete`, `blocked`, or `failed`
  according to represented input;
- dry-run may report final state `verification_required`;
- verifier result reference should be absent unless input already represented a
  prior verifier result;
- verifier audit event ids should remain empty unless input already represented
  emitted events.

Verifier handoff is required before completion, but dry-run stops at the
required/not-run boundary.

## Resume Dry-Run Behavior
Dry-run resume behavior previews where execution would continue.

Rules:

- resume preview is derived from represented pending and retryable work item ids;
- pending ids and retryable ids are sorted deterministically;
- `nextBatchId` points to the first eligible pending or retryable batch;
- `nextStepId` points to the first eligible step after policy and approval
  preview gates;
- `updatedAt` is input-derived only when represented;
- dry-run must not persist the resume cursor;
- dry-run must not rewrite existing resume state.

Resume preview is informational. It cannot prove progress and cannot mark work
completed.

## Failure/Blocked Dry-Run Behavior
Dry-run should classify issues before any side effect is possible.

Use `blocked` when:

- human approval is required;
- policy evidence is missing;
- policy requires approval;
- policy denies a scope that may be changed by human decision or task scope;
- required plan input is absent but can be supplied;
- verifier or audit handoff is required but cannot be previewed.

Use `failed` when:

- plan shape is contradictory;
- required ids are duplicated or empty;
- batch accounting is impossible;
- executable plan disables verifier-gated completion;
- adapter call records claim completed calls in a new dry-run preview;
- dry-run-created records would imply completed or verified state.

Use `verification_required` when:

- plan shape is valid;
- policy and approval preview do not block later execution;
- work remains planned or pending;
- verifier is required and not run;
- no dry-run safety rule is violated.

Dry-run never returns `completed`.

## Deterministic Ordering Rules
Dry-run ordering must be stable for identical input:

- sort issue records by severity rank, category, code, step id, batch id, work
  item id, adapter call id, then message;
- preserve explicit plan step order when represented, otherwise sort by step id;
- sort batches by batch id unless the plan provides an explicit order;
- sort work item ids by batch deterministic order, then id;
- sort adapter calls by step order, adapter kind, adapter id, operation, call id;
- sort audit event ids lexically after preserving explicit expected-event plan
  order when available;
- de-duplicate id lists without changing first-seen deterministic order;
- derive summaries from result arrays, not separately supplied claims.

No ordering may depend on model text, object insertion from non-deterministic
sources, filesystem scans, network responses, or current repository state.

## JSON Dry-Run Result Concept
The JSON result should be compact, deterministic, and safe to serialize:

```json
{
  "ok": true,
  "taskId": "...",
  "mode": "dry_run",
  "state": "verification_required",
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

The result must not contain raw prompts, full model outputs, raw command logs,
secrets, broad file contents, provider SDK objects, or hidden tool arguments.

## CLI Integration Concept
Future CLI surface:

- `aeos task run --dry-run`;
- `aeos task run --dry-run --json`;
- `aeos agent run --dry-run`;
- `aeos task plan`.

Do not implement commands in this task. CLI commands should be thin operators
over core contracts and dry-run logic. They should not own policy decisions,
adapter semantics, audit writes, verifier authority, or completion rules.

## MVP Scope
MVP dry-run execution should support:

- validating represented `AgenticRunnerDryRunInput` in `dry_run` mode;
- validating represented runner plan or planning result references;
- converting planned steps into dry-run step execution records;
- converting planned batches into dry-run batch execution records;
- converting represented work items into non-completed preview outcomes;
- building planned adapter call records without adapter calls;
- building audit handoff preview without writes;
- building verifier handoff required/not-run preview;
- building resume update preview;
- producing deterministic summary counts and issues;
- rendering compact JSON-compatible results;
- smoke tests for side-effect-free safety.

## Later Scope
Later work may add:

- deeper comparison between plan output and dry-run execution preview;
- policy simulation profiles that do not call policy adapters;
- adapter capability simulation metadata;
- richer approval preview surfaces;
- JSON schema export for dry-run results;
- CLI diff between `aeos task plan` and `aeos task run --dry-run`;
- persisted dry-run reports as explicit generated artifacts when requested;
- external audit preview streams that are separate from emitted audit logs;
- organization policy simulation.

## Non-goals
- Implement runtime execution.
- Implement CLI commands.
- Implement concrete adapters.
- Write audit events.
- Run verifier logic.
- Mutate lifecycle, task, memory, filesystem, Git, dependency, deployment, or
  external state.
- Trust autonomous model self-reporting.
- Promise fully autonomous execution for arbitrary tasks.

## Safety Boundaries
Critical safety rules:

- dry-run must not call model adapters;
- dry-run must not call agent adapters;
- dry-run must not call tool adapters;
- dry-run must not write audit events;
- dry-run must not run verifier;
- dry-run must not mutate lifecycle state;
- dry-run must not mark work items completed;
- dry-run must not produce completed state;
- dry-run can only report planned, blocked, waiting, retryable, incomplete, or
  verification-required preview states.

Dry-run state behavior:

- safe executable plan: state should represent `preflight`, `not_started`, or
  `verification_required` preview according to the execution contracts;
- approval required: `waiting_for_approval`;
- blocked policy: `blocked`;
- invalid plan: `failed` or `blocked` according to contract semantics;
- verifier required: verifier handoff required but not executed;
- completed state: forbidden for dry-run-created results.

## Implemented MVP Notes
The current MVP dry-run logic is implemented as a side-effect-free core helper.
It builds preview records from represented input and returns deterministic
summary counts and issues without executing the runner.

Safety hardening rules now enforced by implementation:

- adapter, audit, verifier, and resume side effects are forced false;
- dry-run never produces real completed state;
- adapter previews remain observation-only and are not completion authority;
- verifier preview remains required/not-run and is not verification execution;
- hostile or runtime-sourced `completed` or `verified` step, batch, and work
  item preview state claims are rejected or normalized;
- forbidden terminal preview states produce deterministic dry-run safety issues;
- summary counts do not treat rejected terminal previews as runnable or
  processable work.

## Sitemap Example
A sitemap task has 400 work items.

Dry-run result:

- dry-run creates planned step records for policy, batch execution, audit,
  verifier, and resume as applicable;
- dry-run creates planned batch records with expected counts;
- no sitemap URL is processed;
- no model adapter is called;
- no tool adapter is called;
- no audit event is written;
- no verifier is run;
- work item outcomes remain `pending` or represented retryable previews;
- completed count remains `0`;
- verifier required is `true`;
- verifier status is `pending` or equivalent required/not-run status;
- completion gate is not satisfied;
- final dry-run state is `verification_required`, `preflight`,
  `waiting_for_approval`, or `blocked` depending on gates, never `completed`.

For a safe executable sitemap plan with no approval or policy blocker, the
preferred preview state is `verification_required` because execution-shaped
records can be built but the verifier is required and not run.

## Smoke Coverage
Current smoke coverage checks:

- dry-run results use `mode: "dry_run"`;
- missing, invalid, blocked, or denied input creates issues and never completes;
- dry-run never calls model or tool adapters;
- dry-run never writes audit events;
- emitted audit events are empty or input-derived only;
- verifier remains required/not-run and the completion gate remains unsatisfied;
- resume preview never mutates resume state;
- sitemap dry-run represents 400 planned work items and zero completed work;
- adapter previews are observation-only and non-authoritative;
- repeated dry-run calls with the same input return equivalent results;
- completed and verified preview claims for steps, batches, and work items are
  rejected, normalized to failed previews, and excluded from runnable or
  processable summary counts.

## Next Scope
Future work may design CLI surfaces for dry-run previews, but CLI commands,
runtime execution, adapters, audit runtime, verifier execution, filesystem IO,
and autonomous execution remain outside the current MVP.
