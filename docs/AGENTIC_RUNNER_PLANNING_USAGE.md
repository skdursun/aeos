# Agentic Runner Planning Usage

## Purpose
Document the current AEOS agentic runner planning behavior after planning
contracts, planning logic, examples, smoke tests, and safety hardening.

Runner planning turns explicit task, lifecycle, work item, batch, policy,
adapter, audit, verifier, and resume input into a deterministic planning result.
It is an accounting and coordination plan only. It is not runner execution.

## Current MVP Behavior
The MVP planner is a deterministic, side-effect-free core helper. It accepts
provided structured input and returns a compact `AgenticRunnerPlanningResult`.

Current behavior includes:

- prerequisite validation for task contracts, inventory, work items, policy,
  adapters, audit, verifier, approval, and resume state;
- stable work item planning and duplicate id detection;
- deterministic batch planning from represented work items and batches;
- batch issue detection for empty batches, missing item ids, missing referenced
  work items, count mismatches, and duplicate membership;
- ordered runner step planning;
- approval-required and policy-denied planning states;
- adapter boundary planning without adapter calls;
- audit expectation planning without audit writes;
- verifier-required planning for executable plans;
- resume planning from represented pending and retryable work;
- deterministic summary counts and issue lists.

## What Runner Planning Does
Runner planning:

- represents what work exists;
- represents which batches would be eligible after gates pass;
- represents policy, approval, adapter, audit, verifier, and resume boundaries;
- reports planning issues before execution can be considered safe;
- keeps completion verifier-gated;
- makes partial and resumable work visible.

## What Runner Planning Does Not Do Yet
Runner planning does not:

- execute work;
- call model adapters, agent adapters, tool adapters, policy adapters, audit
  adapters, or verifier adapters;
- write audit events;
- run the coverage verifier;
- inspect the filesystem;
- run CLI commands;
- approve actions;
- mark tasks completed;
- trust model or agent self-reporting as completion proof.

## Planning Inputs
Planning input is serializable and task-scoped:

- `taskId`;
- `mode`: `plan`, `dry_run`, `resume`, `verify`, or `unknown`;
- task contract reference or task metadata;
- lifecycle and inventory data references;
- represented work items;
- represented batches;
- planning options such as `requireAudit`, `requireVerifier`,
  `requireApproval`, `maxWorkItems`, and `maxBatchSize`;
- policy requirements;
- adapter references;
- audit requirements;
- verifier requirements;
- resume data;
- task-scoped metadata.

Inputs must not include raw secrets, broad repository snapshots, full prompts,
full model outputs, provider SDK objects, or unlisted context.

## Planning Outputs
The MVP result shape is stable and compact:

```json
{
  "ok": true,
  "taskId": "...",
  "mode": "plan",
  "prerequisites": [],
  "workItems": [],
  "batches": [],
  "steps": [],
  "policy": {},
  "adapterBoundary": {},
  "audit": {},
  "verifier": {},
  "resume": {},
  "issues": [],
  "summary": {}
}
```

In the implemented TypeScript contract, `policy` is an array of policy plans and
`resume` is optional. In planning mode, `ok: true` means the plan is internally
valid for the next allowed stage. It does not mean the task is completed.

## Prerequisites
Prerequisites make required planning evidence explicit:

- task contract or task metadata is required;
- executable work requires represented work items;
- batches require represented work item references;
- approval-required plans expose a blocked approval prerequisite;
- denied or blocked policy creates failed policy prerequisites;
- executable plans require verifier-gated completion planning.

## Work Item Planning
Work item planning converts represented work items into stable work item plans.

Rules:

- each item must have a stable id;
- duplicate work item ids are planning issues;
- `failed`, `skipped`, and `retryable` items require explicit issues or reasons;
- item state is represented input, not completion proof;
- pending and retryable items remain visible for resume.

## Batch Planning
Batch planning groups represented work item ids into deterministic batch plans.

Rules:

- batch ids must be stable;
- batch order is deterministic;
- `expectedItemCount` must match `workItemIds.length`;
- empty batches are planning issues;
- missing batch work item ids are planning issues;
- references to missing work items are planning issues;
- duplicate work item membership across batches is a planning issue unless a
  future reprocessing policy explicitly allows it.

If work items are provided without batches, the MVP planner may create a
deterministic `batch-all` plan. It still does not execute that batch.

## Step Planning
Step planning creates ordered pending or blocked runner steps.

Planned step kinds include:

- `policy_preflight`;
- `approval`;
- `batch_execution`;
- `audit_append`;
- `verification`;
- `resume_update`.

Steps are never marked completed by planning. Batch execution steps are omitted
while approval is required or policy is blocked.

## Policy Planning
Policy planning represents already-provided policy requirements.

- `allowed` can permit executable planning only within represented scope.
- `requires_approval` creates an approval step and blocks execution progress.
- `denied` or `blocked` creates planning issues and denied operations.

The planner does not evaluate policy by itself and does not treat approval as a
scope expansion.

## Adapter Boundary Planning
Adapter boundary planning records adapter references, allowed operations, denied
operations, and approval requirements.

The planner does not call model or tool adapters. Model and agent adapters remain
proposal boundaries, not completion authorities. Tool and MCP adapters remain
controlled action boundaries that require policy and approval gates before later
execution can run.

## Audit Expectation Planning
Audit expectation planning records event ids and event kinds that later runtime
execution should append.

The planner may generate expected event ids for policy preflight, approval,
batch execution, verifier handoff, and resume update. It does not append audit
events or prove external audit sink state. Missing required audit event ids are
planning issues.

## Verifier Requirement Planning
Executable plans must be verifier-gated.

Rules:

- executable plans require `verifierRequired: true`;
- completion must be gated by verifier handoff;
- disabling verifier requirements for executable plans is a planning issue;
- planning creates verifier requirements and a verifier step but does not run
  verification;
- model or agent self-reporting cannot satisfy verifier requirements.

## Resume Planning
Resume planning represents where work should continue from provided state.

Resume data includes:

- `nextStepId`;
- `nextBatchId`;
- `pendingWorkItemIds`;
- `retryableWorkItemIds`;
- `updatedAt`;
- optional resume cursor reference.

Pending and retryable ids are de-duplicated and deterministically ordered. Resume
planning does not ask a model what remains.

## Issue Reporting
Issues are normalized with a code, message, severity, category, and optional
references such as prerequisite id, work item id, batch id, policy gate id,
adapter reference id, audit event ids, retryability, and metadata.

Examples of important planning issue codes:

- `EXECUTABLE_WORK_ITEMS_MISSING`;
- `BATCH_WORK_ITEMS_EMPTY`;
- `BATCH_WORK_ITEM_ID_MISSING`;
- `BATCH_REFERENCES_MISSING_WORK_ITEM`;
- `DUPLICATE_WORK_ITEM_ID`;
- `WORK_ITEM_IN_MULTIPLE_BATCHES`;
- `VERIFIER_REQUIREMENT_FALSE`;
- `VERIFIER_COMPLETION_GATE_FALSE`;
- `AUDIT_EXPECTATION_MISSING_EVENT_ID`.

## Summary Counts
The summary mirrors represented result arrays and gates:

- prerequisite count;
- work item count;
- batch count;
- step count;
- policy gate count;
- adapter reference count;
- expected audit event count;
- verifier required flag;
- approval required flag;
- top-level issue count.

## Safety Guarantees
The MVP planner guarantees:

- planning does not execute work;
- planning does not call model or tool adapters;
- planning does not write audit events;
- planning does not run verifier logic or verifier adapters;
- planning does not trust model self-reporting;
- executable plans must be verifier-gated;
- executable work requires represented work items;
- empty batches and missing batch item references are planning issues;
- no completed state is implied by planning alone;
- no filesystem IO is performed by the planner.

## Sitemap Planning Example
Task: `sitemap-audit`.

Input represents 400 discovered sub-sitemaps as 400 work items. Deterministic
batches group the items, for example four batches of 100:

```json
{
  "taskId": "sitemap-audit",
  "mode": "plan",
  "workItems": 400,
  "batches": ["batch-001", "batch-002", "batch-003", "batch-004"],
  "policy": [{ "status": "allowed" }],
  "verifier": {
    "verifierRequired": true,
    "completionGatedByVerifier": true
  },
  "metadata": { "executionPerformed": false }
}
```

The plan includes a policy preflight step, one batch execution step per batch,
an audit append step, and a verifier handoff step. Audit expectations include
policy preflight, batch execution, verifier handoff, and any resume update.

Planning does not imply completed state. If only 20 of 400 sub-sitemaps are
later processed, completion still fails verifier accounting:

```text
400 != 20 + 0 + 0
```

The remaining 380 items stay pending or retryable for resume.

## Approval-Gated Example
When policy or an adapter boundary requires approval, the plan represents the
approval gate:

```json
{
  "taskId": "approval-gated-plan",
  "policy": [{ "status": "requires_approval", "approvalRequired": true }],
  "adapterBoundary": { "approvalRequired": true },
  "steps": [{ "kind": "approval", "state": "pending" }],
  "ok": false
}
```

Execution cannot proceed until scoped approval exists. Batch execution steps are
not made runnable while approval is missing.

## Blocked Policy Example
When policy denies an operation, the denied operation and issue are represented:

```json
{
  "taskId": "blocked-policy-plan",
  "policy": [{ "status": "denied" }],
  "adapterBoundary": { "deniedOperations": ["filesystem.write"] },
  "issues": [{ "code": "POLICY_DENIED_OPERATION" }],
  "ok": false
}
```

Executable completion is not implied. Denied operations do not become runnable
batch execution steps.

## Resume Example
Resume planning preserves the next cursor and remaining work:

```json
{
  "taskId": "sitemap-audit",
  "mode": "resume",
  "resume": {
    "nextStepId": "step-batch-003",
    "nextBatchId": "batch-003",
    "pendingWorkItemIds": ["sitemap-url-201", "sitemap-url-202"],
    "retryableWorkItemIds": ["sitemap-url-118"],
    "updatedAt": "2026-08-04T10:15:00.000Z"
  }
}
```

The plan may include a resume update step and audit expectations, but it still
does not execute the resumed work.

## MVP Limitations
- No runner execution yet.
- No CLI task plan command yet.
- No audit runtime yet.
- No policy enforcement yet.
- No model or tool adapter calls yet.
- No autonomous execution.
- No filesystem IO.

## Later Scope
Later work may add:

- CLI planning and status commands;
- durable runner state;
- policy adapter evaluation;
- audit runtime integration;
- verifier runtime handoff;
- adapter execution through gated runner stages;
- configurable batching and retry policies;
- large inventory pagination;
- UI or dashboard rendering.
