# Agentic Runner Dry-Run Usage

## Purpose
Document the current AEOS agentic runner dry-run behavior after dry-run
contracts, logic, examples, smoke tests, and safety hardening.

Dry-run previews execution-shaped runner output from represented planning input.
It is a deterministic preflight helper only. It is not real runner execution.

## Current MVP Behavior
The MVP dry-run helper accepts structured `AgenticRunnerDryRunInput` and returns
an `AgenticRunnerDryRunResult`.

Current behavior includes:

- deterministic preview records for steps, batches, work items, adapter calls,
  audit, verifier, and resume;
- validation for missing task or plan references, duplicate ids, invalid batch
  membership, batch count mismatches, and size limits;
- approval and policy blocked preview states from represented input;
- adapter call previews that are observation-only and never completion
  authority;
- audit previews without emitted audit writes;
- verifier previews that remain required/not-run when verification is required;
- resume previews without cursor persistence;
- deterministic issues and summary counts;
- fail-closed rejection of terminal preview completion claims.

## What Dry-Run Does
Dry-run:

- previews what later execution would try to run;
- shows which steps, batches, and work items appear runnable or processable;
- shows adapter calls that would exist later after gates pass;
- shows expected, emitted-from-input, and missing audit event ids;
- shows whether verifier handoff is required;
- shows where resume would continue;
- reports safety, shape, policy, audit, verifier, adapter, inventory, and resume
  issues before side effects.

## What Dry-Run Does Not Do
Dry-run does not:

- call model adapters;
- call tool adapters;
- write audit events;
- run verifier logic;
- mutate lifecycle state;
- mutate resume state;
- mark work items completed;
- produce real completed state;
- perform filesystem IO;
- run CLI task execution;
- enforce policy;
- perform autonomous execution.

## Input Model
The input is serializable and task-scoped:

- `taskId`;
- `mode: "dry_run"`;
- `runnerPlan` or `planningResult`;
- `lifecycle` reference when available;
- `options` such as `requirePolicy`, `requireApproval`, `requireAudit`,
  `requireVerifier`, `completionGatedByVerifier`, `maxWorkItems`,
  `maxBatchSize`, and `outputMode`;
- `plannedSteps`;
- `plannedBatches`;
- `plannedWorkItems`;
- optional `policyPreview`;
- optional `adapterBoundaryPreview`;
- optional `adapterCalls`;
- optional `auditPreviewInput`;
- optional `verifierPreviewInput`;
- optional `resumePreviewInput`;
- optional metadata.

Inputs must not include raw secrets, provider SDK objects, raw prompts, full
model outputs, broad repository snapshots, or unlisted context.

## Output Result Shape
The MVP result is compact and JSON-safe:

```json
{
  "ok": true,
  "taskId": "...",
  "mode": "dry_run",
  "state": "preview_ready",
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

`ok: true` means the preview was constructed without error or critical issues.
It does not mean the task is completed, verified, or safe to close.

## Step Preview Behavior
Step previews preserve stable step ids, step kinds, planned adapter call ids,
expected audit event ids, verifier requirements, and issues.

Rules:

- runnable steps have `wouldRun: true` only when their preview state is
  `preview_ready`;
- approval-required input maps steps to `waiting_for_approval`;
- policy-blocked input maps steps to `blocked`;
- `not_started`, `preflight`, and `unknown` are normalized to `preview_ready`
  when no gate blocks the preview;
- `completed` and `verified` claims are rejected as dry-run safety issues.

## Batch Preview Behavior
Batch previews preserve batch ids, deterministic work item ids, expected item
counts, preview state, and issues.

Rules:

- runnable batches have `wouldRun: true` only when their preview state is
  `preview_ready`;
- duplicate batch ids fail closed;
- empty or duplicate work item ids are issues;
- references to missing work items are issues;
- expected item count mismatches are issues;
- terminal completion preview states are rejected.

## Work Item Preview Behavior
Work item previews preserve work item ids, optional batch ids, expected artifact
ids, preview state, and issues.

Rules:

- processable work items have `wouldProcess: true` only when their preview state
  is `preview_ready`;
- dry-run does not mark work items completed or verified;
- duplicate or missing work item ids fail closed;
- terminal completion preview states are rejected;
- rejected terminal preview claims do not increase processable counts.

## Adapter Preview Behavior
Adapter call previews represent future model or tool boundaries only.

Rules:

- `wouldCall` is always forced to `false`;
- `observationOnly` is always `true`;
- `completionAuthority` is always `false`;
- model and tool adapter previews are not completion authority;
- adapter preview output references are absent or preview-only;
- any input claim that an adapter would call during dry-run creates a
  deterministic dry-run safety issue.

## Audit Preview Behavior
Audit preview computes audit obligations from represented input and step
expectations.

Rules:

- `wouldWriteAudit` is always `false`;
- dry-run does not append audit events;
- expected audit event ids may be listed;
- emitted audit event ids are only represented input evidence;
- missing audit event ids are previewed deterministically;
- audit status may be `not_required`, `missing`, `partial`,
  `complete_from_input`, `failed`, or `unknown`.

## Verifier Preview Behavior
Verifier preview shows whether verification would be required later.

Rules:

- `wouldRunVerifier` is always `false`;
- `completionGateSatisfied` is always `false`;
- verifier-required previews use `required_not_run`, `blocked`, `failed`, or
  `unknown`, never real verified status;
- verifier preview is not verification execution;
- `verifierRequired: true` is inferred from required verifier options,
  completion gating, or verifier-required steps.

## Resume Preview Behavior
Resume preview derives where later execution would continue.

Rules:

- `wouldUpdateResume` is always `false`;
- pending work items are derived from non-blocked and non-failed work previews
  unless input supplies explicit pending ids;
- retryable work item ids come from represented input;
- next step and batch default to the first preview-ready record, then the first
  represented record;
- dry-run does not persist resume cursor changes.

## Issue Reporting
Issues include code, message, severity, category, optional references, and
retryability. Important MVP issue codes include:

- `DRY_RUN_MODE_INVALID`;
- `RUNNER_PLAN_MISSING`;
- `DUPLICATE_STEP_ID`;
- `DUPLICATE_BATCH_ID`;
- `BATCH_EXPECTED_COUNT_MISMATCH`;
- `BATCH_REFERENCES_MISSING_WORK_ITEM`;
- `WORK_ITEM_IN_MULTIPLE_BATCHES`;
- `DUPLICATE_WORK_ITEM_ID`;
- `DRY_RUN_ADAPTER_WOULD_CALL`;
- `DRY_RUN_AUDIT_WOULD_WRITE`;
- `DRY_RUN_VERIFIER_WOULD_RUN`;
- `DRY_RUN_STEP_COMPLETION_STATE_FORBIDDEN`;
- `DRY_RUN_BATCH_COMPLETION_STATE_FORBIDDEN`;
- `DRY_RUN_WORK_ITEM_COMPLETION_STATE_FORBIDDEN`.

Error or critical issues make `ok: false`. Non-retryable shape and dry-run
safety issues produce a failed dry-run result.

## Summary Counts
Summary fields are derived from result arrays, not from caller claims:

- `plannedSteps`;
- `runnableSteps`;
- `blockedSteps`;
- `plannedBatches`;
- `runnableBatches`;
- `plannedWorkItems`;
- `processableWorkItems`;
- `plannedAdapterCalls`;
- `wouldCallAdapters`;
- `expectedAuditEvents`;
- `wouldWriteAudit`;
- `verifierRequired`;
- `wouldRunVerifier`;
- `issueCount`.

Rejected terminal preview states produce deterministic issues and do not inflate
runnable or processable counts.

## Safety Guarantees
Critical safety rules:

- dry-run does not call model adapters;
- dry-run does not call tool adapters;
- dry-run does not write audit events;
- dry-run does not run verifier;
- dry-run does not mutate lifecycle state;
- dry-run does not mutate resume state;
- dry-run does not mark work items completed;
- dry-run does not produce real completed state;
- adapter previews are not completion authority;
- verifier preview is not verification execution.

## Fail-Closed Preview Hardening
Hostile or runtime-sourced claims that a dry-run preview is already completed or
verified are rejected or sanitized.

Rules:

- terminal step, batch, and work item preview states cannot pass through as real
  completion;
- forbidden terminal preview states create deterministic dry-run safety issues;
- such issues contribute to failed dry-run output;
- rejected terminal preview states do not inflate runnable step, runnable batch,
  or processable work item counts;
- dry-run never converts adapter, verifier, audit, resume, or lifecycle preview
  data into real completion authority.

## Sitemap Dry-Run Example
A sitemap task plans 400 work items under task id `sitemap-audit`.

Expected preview behavior:

- `taskId: "sitemap-audit"`;
- `plannedWorkItems: 400`;
- completed work item count remains `0`;
- batches are previewed only;
- no sitemap URL is processed;
- no adapter call runs;
- `verifierRequired: true`;
- `wouldRunVerifier: false`;
- final dry-run state is not `completed`.

Conceptual output:

```json
{
  "ok": true,
  "taskId": "sitemap-audit",
  "mode": "dry_run",
  "state": "verification_required",
  "workItems": [{ "workItemId": "sitemap-page-001" }],
  "summary": {
    "plannedWorkItems": 400,
    "processableWorkItems": 400,
    "wouldCallAdapters": 0,
    "wouldWriteAudit": false,
    "verifierRequired": true,
    "wouldRunVerifier": false
  }
}
```

The preview may show processable work. It does not show completed work.

## MVP Limitations
- No real runner execution yet.
- No CLI `task run --dry-run` command yet.
- No adapter calls.
- No audit runtime.
- No verifier execution.
- No policy enforcement.
- No filesystem IO.
- No autonomous execution.

## Later Scope
Later work may add:

- CLI surfaces for dry-run previews;
- JSON schema export for dry-run results;
- richer policy simulation from represented policy profiles;
- adapter capability simulation;
- persisted dry-run report artifacts when explicitly requested;
- comparison between planning output, dry-run preview, and later execution;
- real runner execution gated by policy, audit, verifier, and resume rules.
