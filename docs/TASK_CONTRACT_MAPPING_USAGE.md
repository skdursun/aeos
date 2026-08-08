# Task Contract Mapping Usage

## Purpose
Document the implemented MVP behavior for mapping a validated AEOS task contract
into runner planning input data.

The mapper is a pure, deterministic, no-execution, no-write boundary. It turns
already-validated task contract data into either a safe planning input handoff or
an honest unsupported/blocked/invalid result.

## Current MVP Behavior
- Supports `plan` mode only.
- Requires `noExecution: true` and `noWrites: true`.
- Requires a validation handoff that passed.
- Supports a single pending fallback work item when fallback is allowed.
- Supports one deterministic default batch when safe.
- Reports unsupported explicit `workItems` and `batches` because the current
  `AeosTask` contract does not validate those fields.
- Sets `verifierRequired: true` for supported executable mapping.
- Sets `completionGatedByVerifier: true`.
- Starts mapped work items as pending/non-completed.
- Never produces completed state during mapping.

## What The Mapper Does
- Resolves task id and task contract data from provided input.
- Checks mapping preflight safety flags and validation status.
- Creates one fallback work item for the whole task when allowed.
- Creates one default batch for mapped work items when allowed.
- Maps policy requirements from risk metadata as a boundary only.
- Maps model recommendations and operations as adapter references only.
- Maps audit expectations as expected event ids and kinds only.
- Maps verifier requirements with verifier-gated completion.
- Creates a planning input handoff as data/reference only.
- Returns normalized issues and deterministic summary fields.

## What The Mapper Does Not Do
- It does not run `planAgenticRunner()`.
- It does not run runner execution.
- It does not parse task files.
- It does not validate task contracts.
- It does not call model, agent, tool, MCP, policy, audit, verifier, memory,
  project, or template adapters.
- It does not write audit events.
- It does not run verifier logic.
- It does not persist state.
- It does not read or mutate the filesystem.
- It does not trust model or task text claims of completion or approval.

## Input Model
The mapper accepts a `TaskContractMappingInput`:

- `taskId`: optional stable task id, normally matching `task.id`;
- `task`: validated `AeosTask` data;
- `taskContract`: optional data/reference wrapper for the validated task;
- `sourceFile`: optional source path metadata;
- `mode`: currently `plan`;
- `options`: mapper feature flags;
- `validation`: validation handoff with `status: "pass"` and `valid: true`;
- `noExecution: true`;
- `noWrites: true`.

If validation is missing or did not pass, mapping is blocked. If `mode` is not
`plan`, the current MVP reports unsupported mapping.

For mapped output, authoritative downstream planner proof is carried on
`planningInput.runnerPlanningInput` itself:

- `planningInput.runnerPlanningInput.metadata.noExecution === true`;
- `planningInput.runnerPlanningInput.metadata.noWrites === true`;
- `planningInput.runnerPlanningInput.verifierRequirements.verifierRequired === true`;
- `planningInput.runnerPlanningInput.verifierRequirements.completionGatedByVerifier === true`.

Top-level summary and mapper verifier fields are diagnostic consistency data.
They do not authorize planning by themselves.

## Output/Result Shape
The result is a mapping result, not a runner planning result:

```json
{
  "ok": false,
  "taskId": "...",
  "mode": "plan",
  "status": "unsupported|mapped",
  "workItems": [],
  "batches": [],
  "policy": {},
  "adapterBoundary": {},
  "audit": {},
  "verifier": {},
  "resume": {},
  "planningInput": {},
  "issues": [],
  "summary": {
    "noExecution": true,
    "noWrites": true,
    "verifierRequired": true,
    "completionGatedByVerifier": true
  }
}
```

`ok: true` means mapping produced a safe `AgenticRunnerPlanningInput` handoff.
It does not mean planning ran, execution started, audit was emitted, verifier
passed, state was persisted, or the task completed.

## Supported Mapping Path
The supported MVP path is:

1. Caller parses a local task file outside the mapper.
2. Caller validates the task contract outside the mapper.
3. Caller passes validated `AeosTask` data and validation handoff to the mapper.
4. Mapper creates one pending fallback work item for the whole task.
5. Mapper creates one default batch for that work item.
6. Mapper creates policy, adapter boundary, audit expectation, verifier, resume,
   and planning input handoff data.
7. Mapper returns `status: "mapped"` only when no blocking, invalid, or
   unsupported issues remain.

The mapper itself stops at the handoff. It does not invoke runner planning.

## Unsupported Mapping Behavior
Unsupported or unsafe shapes fail closed with issues and no fake success.

Current unsupported cases include:

- explicit `workItems` on `AeosTask`;
- explicit `batches` on `AeosTask`;
- unsupported modes such as `dry_run`;
- resume data embedded in the task contract;
- any mapping that would require IO, adapter calls, persistence, repository
  scanning, or model/task text interpretation.

Unsupported results set `ok: false`, use an unsupported status where applicable,
and omit `runnerPlanningInput`.

Static contract-shape examples may show future explicit work item or batch
objects for type illustration. They are not implemented mapper support. Current
runtime mapper behavior is defined by `mapTaskContractToRunnerPlanningInput()`,
which rejects unvalidated explicit `workItems`, `batches`, and `resume` fields.

## Single Work Item Fallback Behavior
When `allowSingleWorkItemFallback` is true and explicit work items are not
required, the mapper may represent a validated task as one whole-task work item:

- work item id: `work-item:<task-id>:default`;
- source task id: task id;
- source reference: task contract reference when available;
- initial state: `pending`;
- derived from: `single_work_item_fallback`.

This is an accounting fallback. It does not prove any step has run or completed.

## Work Item Mapping
Mapped work items become runner planning work items with:

- stable id;
- source reference;
- `state: "pending"`;
- expected artifacts from `fileBoundary.filesToModify`;
- task title, purpose, and execution mode metadata.

The mapper never emits `completed` work item state.

## Batch Mapping
When `createDefaultBatch` is true and mapped work items exist, the mapper creates
one deterministic default batch:

- batch id: `batch:<task-id>:default`;
- `workItemIds`: mapped work item ids;
- `expectedItemCount`: work item id count;
- `derivedDefaultBatch: true`.

Mapped work items without a batch produce an issue. Explicit batch shapes remain
unsupported until the task contract validates them.

## Policy Mapping
Policy mapping is a requirement boundary:

- policy gate id: `policy-gate:<task-id>:task-contract`;
- `required: true`;
- `approvalRequired`: true only when represented by `riskProfile`;
- status: `requires_approval` or `not_evaluated`;
- decision reference: not evaluated.

The mapper does not evaluate or enforce policy. Approval does not broaden task
scope.

## Adapter Boundary Mapping
Adapter boundary mapping is reference-only:

- model recommendation may become a model adapter reference with status
  `not_run`;
- tool adapter references are empty in the current MVP;
- allowed operations are copied from the task;
- denied operations include task forbidden operations plus mapper safety denies;
- approval required follows represented risk metadata.

No adapter is called.

## Audit Expectation Mapping
Audit mapping records expected audit events only:

- policy preflight planned;
- default batch planned;
- verifier handoff planned;
- resume update planned only when represented resume data exists.

The mapper does not emit audit events or inspect audit sinks.

## Verifier Requirement Mapping
Executable mapping always represents:

- `verifierRequired: true`;
- `completionGatedByVerifier: true`;
- expected coverage rule:
  `expected_items == completed_items + explicitly_failed_items + explicitly_skipped_items`.

Disabling verifier requirements creates an issue. The mapper does not run the
verifier.

## Resume Mapping
Current `AeosTask` has no first-class validated resume field. Normal MVP resume
mapping is empty:

- no resume cursor;
- no pending resume ids;
- no retryable resume ids;
- no next batch id.

If unvalidated `resume` data is present on the task object, the mapper reports
it as unsupported and does not persist or trust it.

## Planning Input Handoff
For mapped results, `planningInput` contains:

- `runnerPlanningInput`;
- a stable `runnerPlanningInputReference`;
- `runnerPlanningInputData`;
- `runnerPlanningExecuted: false`;
- `taskPersistenceWritten: false`.

The handoff is data/reference only. The mapper does not run planner execution.

## Issue Reporting
Issues include stable code, message, severity, category, task/source references,
and optional field-specific metadata. Common issue categories include input,
validation, work items, batches, policy, adapters, audit, verifier, resume,
planning input, safety, and unsupported.

Errors fail closed. Unsupported mapping is reported honestly instead of creating
fake work items, batches, approval, completion, or persistence state.

## Summary Fields
The summary exposes:

- `workItemCount`
- `batchCount`
- `policyRequired`
- `approvalRequired`
- `adapterReferenceCount`
- `expectedAuditEventCount`
- `verifierRequired`
- `completionGatedByVerifier`
- `mappingSupported`
- `noExecution`
- `noWrites`
- `issueCount`

`issueCount` mirrors the top-level issues array length.

## Examples

### Minimal Fallback Mapping
```json
{
  "ok": true,
  "taskId": "TASK-0248",
  "mode": "plan",
  "status": "mapped",
  "workItems": [
    {
      "workItemId": "work-item:TASK-0248:default",
      "initialState": "pending",
      "derivedFrom": "single_work_item_fallback"
    }
  ],
  "batches": [
    {
      "batchId": "batch:TASK-0248:default",
      "workItemIds": ["work-item:TASK-0248:default"],
      "expectedItemCount": 1,
      "derivedDefaultBatch": true
    }
  ],
  "verifier": {
    "verifierRequired": true,
    "completionGatedByVerifier": true
  },
  "planningInput": {
    "runnerPlanningExecuted": false,
    "taskPersistenceWritten": false,
    "runnerPlanningInput": {
      "metadata": {
        "noExecution": true,
        "noWrites": true
      },
      "verifierRequirements": {
        "verifierRequired": true,
        "completionGatedByVerifier": true
      }
    }
  },
  "summary": {
    "noExecution": true,
    "noWrites": true,
    "verifierRequired": true,
    "completionGatedByVerifier": true
  }
}
```

### Unsupported Explicit Work Item Mapping
```json
{
  "ok": false,
  "taskId": "TASK-0248-EXPLICIT",
  "mode": "plan",
  "status": "unsupported",
  "workItems": [],
  "planningInput": {
    "runnerPlanningExecuted": false,
    "taskPersistenceWritten": false,
    "unsupportedReason": "Task contract mapping did not produce a safe runner planning input."
  },
  "issues": [
    {
      "code": "task_contract_explicit_work_items_unsupported",
      "category": "unsupported",
      "severity": "error",
      "field": "workItems"
    }
  ]
}
```

### Policy/Approval Mapping
```json
{
  "policy": {
    "policyGateId": "policy-gate:TASK-0248:task-contract",
    "required": true,
    "approvalRequired": true,
    "status": "requires_approval"
  },
  "summary": {
    "policyRequired": true,
    "approvalRequired": true
  }
}
```

This represents policy and approval requirements only. It does not enforce
policy or grant approval.

### Adapter Boundary Mapping
```json
{
  "adapterBoundary": {
    "modelAdapterReferences": [
      {
        "adapterId": "model-adapter:TASK-0248:recommendation",
        "kind": "model",
        "status": "not_run"
      }
    ],
    "toolAdapterReferences": [],
    "allowedOperations": ["read_context"],
    "deniedOperations": ["call_adapter", "run_verifier"]
  }
}
```

Adapter references are metadata only. No adapter call is made.

### Audit Expectation Mapping
```json
{
  "audit": {
    "expectedAuditEventIds": [
      "audit-policy-preflight:TASK-0248:planned",
      "audit-batch:batch:TASK-0248:default:planned",
      "audit-verifier-handoff:TASK-0248:planned"
    ],
    "requiredEventKinds": [
      "batch.execution.planned",
      "policy.preflight.planned",
      "verification.handoff.planned"
    ],
    "auditRequired": true
  }
}
```

These are expected events only. No events are emitted.

### Planning Input Handoff
```json
{
  "planningInput": {
    "handoffRequested": true,
    "handoffStatus": "mapped",
    "runnerPlanningInputReference": {
      "id": "runner-planning-input:TASK-0248"
    },
    "runnerPlanningExecuted": false,
    "taskPersistenceWritten": false
  }
}
```

The handoff is data/reference only. `planAgenticRunner()` has not run.

## Safety Guarantees
- Pure and deterministic over provided input.
- No execution.
- No writes.
- No filesystem mutation.
- No adapter calls.
- No audit emission.
- No verifier run.
- No persistence.
- No completed state from mapping.
- No trust in model/task text completion or approval claims.

## MVP Limitations
- `plan` mode only.
- Single work item fallback only.
- Default batch only.
- Explicit work item and batch task fields are unsupported.
- Resume task fields are unsupported.
- Policy is represented, not evaluated.
- Adapter boundaries are represented, not called.
- Audit events are expected, not emitted.
- Planning input handoff is created, but runner planning is not executed by the
  mapper.
- CLI task planning may consume this mapper handoff through separate
  fail-closed integration logic.

## Later Scope
Later work may add typed task-contract work items, typed batches, typed resume
state, lifecycle-derived resume handoff, richer policy profiles, adapter
capability routing, persisted planning state, CLI orchestration, and verifier
evidence loading.
