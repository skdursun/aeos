# Agentic Task CLI Output Contract

## Purpose
Define stable human and JSON output contracts for the planned AEOS agentic task
commands before command implementation begins.

This document is design-only. It does not implement CLI commands, model/tool
execution, persistence, audit runtime, verifier runtime, resume runtime, or
production orchestration.

## Critical MVP Rule
No first MVP task command may perform real model, agent, tool, MCP, adapter, or
autonomous execution.

The first CLI MVP may expose only:

- planning output;
- dry-run preview output;
- verifier-shaped placeholder output;
- status unavailable placeholders;
- resume unavailable placeholders or later dry-run resume previews.

Real `aeos task run` remains unsupported until an execution safety review
approves policy, approval, audit, verifier, persistence, and resume behavior.

## JSON-Only Rules
- JSON mode stdout must contain exactly one JSON object.
- JSON mode stdout must not include human labels, banners, warnings, progress
  text, stack traces, or text before or after JSON.
- JSON mode errors must also be JSON-only.
- JSON output must be deterministic and safe to serialize.
- JSON output must not include raw prompts, full model output, private reasoning,
  secrets, broad file contents, raw command logs, provider SDK objects, or hidden
  tool arguments.

## Error JSON Shape
All JSON-mode command errors use this base shape:

```json
{
  "ok": false,
  "error": {
    "code": "...",
    "message": "..."
  },
  "issues": []
}
```

Error `code` values should be stable snake_case strings. `issues` should use
the relevant task, planning, dry-run, or verifier issue shape when structured
issues exist.

## Exit Code Rules
- Successful plan and dry-run preview: `0`.
- Invalid input or invalid task contract: non-zero.
- Unsupported command mode: non-zero.
- Blocked policy: non-zero when it prevents the requested command from
  producing the requested safe output; otherwise return an explicit blocked
  result according to the command contract.
- Approval-required execution path: non-zero for unsupported execution; plan and
  dry-run output may still be produced when they honestly show approval is
  required.
- JSON-mode errors: non-zero with JSON-only stdout.
- Placeholder unavailable status, verify, or resume responses: non-zero unless
  the implemented command explicitly treats an informational unavailable query
  as success.

## Help Honesty
Help text must not overpromise:

- real execution;
- autonomous agent runs;
- model, agent, tool, MCP, or adapter execution;
- audit runtime writes;
- task persistence;
- production orchestration;
- resume from persisted state before persistence exists;
- verifier success before verifier evidence loading exists.

Help may advertise only planned commands as planned or unavailable until they
are implemented.

## `aeos task plan`
### Purpose
Read an explicit local task input, validate it, and print a deterministic runner
planning summary.

### MVP Behavior
- Produces a side-effect-free task plan from represented input.
- Shows work items, batches, steps, policy, approval, verifier, audit, resume,
  and issues.
- Does not execute work, call adapters, write audit events, persist state, run
  the verifier, or mark completion.

### Human Output Shape
```text
Task Plan
Task id: <task-id>
Mode: plan
Work items: <count>
Batches: <count>
Steps: <count>
Policy: <allowed|blocked|requires_approval|not_evaluated|unknown>
Approval required: <true|false>
Verifier required: <true|false>
Audit expected: <true|false>
Issues: <count>
```

### JSON Output Shape
`aeos task plan --json` emits:

```json
{
  "ok": true,
  "taskId": "...",
  "mode": "plan",
  "plan": {},
  "policy": {},
  "verifier": {},
  "audit": {},
  "resume": {},
  "issues": [],
  "summary": {}
}
```

`plan` should contain stable planning fields such as prerequisites, work items,
batches, and steps. `ok: true` means the plan was created without blocking
planning errors. It does not imply execution, verification, persistence, or
completion.

### Exit Code Behavior
- `0` when a plan is produced without blocking errors.
- Non-zero for invalid task input, unsupported flags, blocked planning policy,
  or invalid represented planning data.
- JSON errors must use the error JSON shape.

### Safety Guarantees
- Read-only.
- No adapter calls.
- No audit writes.
- No verifier run.
- No lifecycle mutation.
- No completion claim.
- No repository scanning beyond explicit input.

### Known MVP Limitations
- Planning depends on represented task data.
- Policy is represented, not evaluated by the CLI.
- Audit is expected, not written.
- Verifier is required or not required, not run.
- Resume is planned only from provided state.

### Smoke Test Expectations
- Human output includes all required labels listed above.
- JSON output parses as one object with the exact top-level keys.
- Plan output for a 400-item sitemap task reports 400 work items.
- Verifier-required plans show `Verifier required: true`.
- Output does not imply completion.

## `aeos task run --dry-run`
### Purpose
Print an execution-shaped preview for a task without performing execution.

### MVP Behavior
- Builds a dry-run preview from represented plan or planning result input.
- Shows planned steps, batches, work items, adapter boundaries, audit preview,
  verifier preview, resume preview, issues, and summary.
- Forces execution side effects off.

### Human Output Shape
```text
Task Dry Run
Task id: <task-id>
State: <preview_ready|verification_required|waiting_for_approval|blocked|failed|unknown>
Planned steps: <count>
Planned batches: <count>
Planned work items: <count>
Adapter calls: not executed
Audit writes: false
Verifier run: false
Completed: false
Issues: <count>
```

### JSON Output Shape
`aeos task run --dry-run --json` emits:

```json
{
  "ok": true,
  "taskId": "...",
  "mode": "dry_run",
  "state": "...",
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

Adapter call previews must show non-execution, for example `wouldCall: false`,
`observationOnly: true`, and `completionAuthority: false`.

### Exit Code Behavior
- `0` when a dry-run preview is produced without blocking errors.
- Non-zero for invalid input, invalid planning data, unsupported flags, blocked
  policy that prevents preview construction, or any forbidden dry-run completion
  claim.
- JSON errors must use the error JSON shape.

### Safety Guarantees
- No model/tool/agent adapter calls.
- No audit writes.
- No verifier run.
- No lifecycle mutation.
- No resume cursor write.
- No completed state.

### Known MVP Limitations
- Preview is not execution.
- Policy and adapter results are represented, not evaluated or called.
- Verifier result is not produced.
- Resume state is preview-only.

### Smoke Test Expectations
- Human output includes every required dry-run label.
- JSON output parses as one object with the exact top-level keys.
- A 400-item sitemap dry-run reports 400 planned work items and completed `0`
  in summary or equivalent fields.
- Adapter calls are not executed.
- Audit writes are `false`.
- Verifier run is `false`.
- Completed is `false`.

## `aeos task status`
### Purpose
Report persisted task state when task persistence exists.

### MVP Behavior
The first CLI MVP may report unavailable because task persistence is not
implemented. It must not infer state from model output, terminal history, recent
CLI text, unstored files, or repository scans.

### Human Output Shape
```text
Task Status
Status: unavailable
Reason: task persistence is not implemented yet
Issues: 0
```

### JSON Output Shape
`aeos task status --json` emits the MVP unavailable shape:

```json
{
  "ok": false,
  "status": "unavailable",
  "reason": "task persistence is not implemented yet",
  "issues": []
}
```

### Exit Code Behavior
- Non-zero while persistence is unavailable.
- Future successful persisted status queries may return `0`.
- JSON errors must be JSON-only.

### Safety Guarantees
- Read-only.
- Does not invent status.
- Does not treat model self-reporting as state.
- Does not create persistence.

### Known MVP Limitations
- No task state store.
- No persisted lifecycle, audit, verifier, or resume cursor lookup.

### Smoke Test Expectations
- Human mode reports unavailable honestly.
- JSON mode emits exactly the unavailable object shape.
- Command exits non-zero while unavailable.

## `aeos task verify`
### Purpose
Verify task completion from structured coverage evidence.

### MVP Behavior
For the first CLI MVP, verifier command output may be placeholder-only when no
persisted task state or explicit coverage evidence loader exists. It must not
verify from model output or completion claims.

### Human Output Shape
```text
Task Verify
Status: unavailable
Reason: persisted task state and coverage evidence loading are not implemented yet
Verifier run: false
Issues: 0
```

### JSON Output Shape
`aeos task verify --json` emits either the later verifier result shape when
explicit evidence is loaded, or the MVP placeholder:

```json
{
  "ok": false,
  "status": "unavailable",
  "reason": "persisted task state and coverage evidence loading are not implemented yet",
  "verifier": {
    "wouldRunVerifier": false
  },
  "issues": []
}
```

Later verifier-shaped successful output should remain aligned with:

```json
{
  "ok": false,
  "taskId": "...",
  "status": "incomplete",
  "itemCoverage": {},
  "artifactCoverage": {},
  "batchCoverage": [],
  "inventoryCoverage": {},
  "auditConsistency": {},
  "issues": [],
  "summary": {}
}
```

### Exit Code Behavior
- Non-zero while verifier CLI evidence loading is unavailable.
- Future verifier results return `0` only when verification succeeds.
- Incomplete, failed, blocked, invalid, or unavailable verification returns
  non-zero.

### Safety Guarantees
- Does not trust model or agent self-reporting.
- Does not infer completion from dry-run output.
- Does not write audit or lifecycle state.
- Does not mark tasks complete.

### Known MVP Limitations
- No persisted evidence loading.
- No verifier CLI wiring for explicit coverage data in the first task CLI MVP.
- No external audit sink verification.

### Smoke Test Expectations
- Placeholder human output says verifier was not run.
- Placeholder JSON is JSON-only and `ok: false`.
- No output claims verified completion without structured evidence.

## `aeos task resume`
### Purpose
Continue or preview continuation from persisted task lifecycle state.

### MVP Behavior
The first CLI MVP must not resume real execution. Non-dry-run resume is
unavailable until persistence and execution safety are implemented.

### Human Output Shape
```text
Task Resume
Status: unavailable
Reason: task persistence and real execution resume are not implemented yet
Adapter calls: not executed
Audit writes: false
Verifier run: false
Completed: false
Issues: 0
```

### JSON Output Shape
`aeos task resume --json` emits:

```json
{
  "ok": false,
  "status": "unavailable",
  "reason": "task persistence and real execution resume are not implemented yet",
  "resume": {},
  "issues": []
}
```

### Exit Code Behavior
- Non-zero while non-dry-run resume is unavailable.
- JSON errors must use JSON-only output.

### Safety Guarantees
- No model/tool/agent adapter calls.
- No audit writes.
- No verifier run.
- No lifecycle mutation.
- No resume cursor write.
- No completed state.

### Known MVP Limitations
- No persisted cursor.
- No persisted lifecycle state.
- No real resume execution.

### Smoke Test Expectations
- Human output reports unavailable.
- JSON output is JSON-only and `ok: false`.
- Command does not imply any resumed work occurred.

## `aeos task resume --dry-run`
### Purpose
Preview where a future resume operation would continue.

### MVP Behavior
May be unavailable until persisted task state exists. Later, it may produce a
dry-run resume preview from explicit persisted or provided state only.

### Human Output Shape
```text
Task Resume Dry Run
Task id: <task-id>
Status: <preview_ready|unavailable|blocked|failed|unknown>
Next step: <step-id|none|unknown>
Next batch: <batch-id|none|unknown>
Pending work items: <count>
Retryable work items: <count>
Adapter calls: not executed
Audit writes: false
Verifier run: false
Completed: false
Issues: <count>
```

### JSON Output Shape
Until resume preview input exists, `aeos task resume --dry-run --json` may emit:

```json
{
  "ok": false,
  "status": "unavailable",
  "reason": "task persistence is not implemented yet",
  "resume": {},
  "issues": []
}
```

Later preview output should reuse the dry-run top-level shape with
`mode: "dry_run"` and a populated `resume` object.

### Exit Code Behavior
- Non-zero while persistence is unavailable.
- Future successful dry-run resume previews may return `0`.
- Invalid or blocked preview input returns non-zero.

### Safety Guarantees
- Preview-only.
- No adapter calls.
- No audit writes.
- No verifier run.
- No lifecycle mutation.
- No resume cursor write.
- No completion claim.

### Known MVP Limitations
- Depends on future persisted task evidence or explicit resume input.
- Does not decide completion.
- Does not execute pending or retryable work.

### Smoke Test Expectations
- Placeholder output is honest when persistence is unavailable.
- Future preview output reports pending and retryable counts.
- Output states adapter calls are not executed and completed is false.

## Sitemap Examples
### Task Plan
```text
Task Plan
Task id: sitemap-audit
Mode: plan
Work items: 400
Batches: 4
Steps: 7
Policy: allowed
Approval required: false
Verifier required: true
Audit expected: true
Issues: 0
```

This example does not imply completed work.

### Dry Run
```text
Task Dry Run
Task id: sitemap-audit
State: verification_required
Planned steps: 7
Planned batches: 4
Planned work items: 400
Adapter calls: not executed
Audit writes: false
Verifier run: false
Completed: false
Issues: 0
```

Equivalent summary fields should represent:

```json
{
  "plannedWorkItems": 400,
  "completedWorkItems": 0,
  "wouldCallAdapters": 0,
  "wouldWriteAudit": false,
  "wouldRunVerifier": false,
  "completed": false
}
```
