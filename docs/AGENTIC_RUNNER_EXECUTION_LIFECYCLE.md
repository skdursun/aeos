# Agentic Runner Execution Lifecycle

## Purpose
Define the AEOS agentic runner execution lifecycle.

This lifecycle describes how a verified `AgenticRunnerPlan` moves through safe
execution, policy gates, human approval, adapter calls, audit handoff, work item
state transitions, resume and retry updates, and coverage verification.

This is a design-only document. It does not implement runner execution, adapter
runtime behavior, storage, or CLI commands.

## Why Execution Lifecycle Is Needed
Agentic work can look complete when a model or agent reports "done" even though
only part of the expected work ran. AEOS needs an execution lifecycle that keeps
completion outside model self-reporting.

The execution lifecycle is needed to:

- reject unsafe or non-ok runner plans before any execution starts;
- guarantee policy gates are evaluated before actions run;
- preserve human approval as a scoped gate, not a broad permission grant;
- record observed work item and batch outcomes from runner-owned evidence;
- append audit events before final completion;
- hand observed state to the verifier before any completed state;
- keep incomplete, failed, blocked, cancelled, and retryable work resumable.

## Current Foundation Status
AEOS already has the design and contract foundations for this lifecycle:

- `docs/AGENTIC_RUNNER_ARCHITECTURE.md` defines the runner as the coordinator for
  task contracts, policy, batches, adapters, audit, resume, and verification.
- `docs/AGENTIC_RUNNER_PLANNING_LOGIC.md` and
  `docs/AGENTIC_RUNNER_PLANNING_USAGE.md` define side-effect-free planning and
  the requirement that executable plans are verifier-gated.
- `docs/AGENTIC_TASK_LIFECYCLE_DESIGN.md` defines task states, work item states,
  batches, coverage, verification, audit, resume, retry, and completion rules.
- `docs/AGENTIC_COVERAGE_VERIFIER_USAGE.md` documents the current deterministic
  coverage verifier behavior and its rejection of model self-reporting.
- `docs/POLICY_PERMISSION_MODEL.md`, `docs/AUDIT_LOG_FORMAT.md`,
  `docs/ADAPTER_CONTRACTS.md`, `docs/VERIFICATION_STRATEGY.md`, and
  `docs/TASK_CONTRACT.md` define policy, audit, adapter, verification, and task
  boundaries.
- `packages/core/src/agentic-runner.ts` defines runner plan/result, policy gate,
  execution boundary, audit handoff, verifier handoff, and resume state
  contracts.
- `packages/core/src/agentic-lifecycle.ts` defines lifecycle, inventory, work
  item, batch, coverage, attempt, verification, audit, and resume types.
- `packages/core/src/agentic-coverage-verifier.ts` and
  `packages/core/src/agentic-coverage-verifier-logic.ts` define the current
  side-effect-free coverage verifier.

There is not yet a runner execution implementation or task CLI runtime.

## Execution Responsibilities
The execution lifecycle should:

- accept a planned `AgenticRunnerPlan` and represented lifecycle inputs;
- validate that the plan is safe, executable, and completion-gated;
- run policy preflight before any model or tool adapter call;
- request human approval when policy returns `requires_approval`;
- execute only eligible batch steps after policy and approval gates pass;
- set work items to `in_progress` before adapter execution;
- record observed adapter outcomes for each expected work item id;
- map adapter statuses to work item, batch, attempt, and runner states;
- append audit events for policy, approval, batch, work item, adapter,
  verifier, resume, and terminal transitions;
- run verifier handoff after observed outcomes and audit handoff are recorded;
- update resume cursor from runner-owned work item states;
- return compact human and JSON results.

## Execution Non-Responsibilities
The execution lifecycle must not:

- create a runner plan from scratch;
- execute a plan that planning marked unsafe, blocked, denied, or non-ok;
- trust model or agent output as final completion proof;
- allow model, agent, or tool adapters to mark the task completed;
- perform provider-specific model routing in core execution;
- execute shell, MCP, network, Git, dependency, migration, deployment, memory, or
  secret actions directly outside adapter and policy boundaries;
- broaden task scope, read unlisted context, or write excluded files;
- rewrite prior attempts when retrying;
- implement CLI commands in this design task.

## Execution Input Model
MVP execution input should be serializable and task-scoped:

- `taskId`;
- `mode`: `execute`, `dry_run`, `resume`, or `verify`;
- `plan`: a validated `AgenticRunnerPlan`;
- task contract reference or parsed task metadata;
- lifecycle, inventory, work items, batches, coverage, attempts, audit, and
  resume state when available;
- policy gate inputs, policy decisions, approvals, grants, and denied scopes;
- adapter references and declared capabilities;
- verifier requirements and coverage verifier options;
- audit sink reference and correlation id;
- execution limits such as max batch size, max attempts, timeout, and output
  mode.

Inputs must not include raw secrets, broad repository snapshots, full prompts,
provider SDK objects, hidden tool permissions, or unlisted context.

## Execution Output Model
Execution output should be derived from observed state:

- `ok`;
- `taskId`;
- final runner state;
- execution mode;
- plan reference or compact plan summary;
- executed step summaries;
- work item state map and counts;
- batch result summaries;
- policy decisions and approvals;
- audit handoff;
- verifier handoff;
- resume cursor;
- normalized issues;
- compact summary.

`ok: true` is valid only when state is `completed`, verifier status is
`verified`, required audit evidence is present, and no pending or retryable
required work remains.

## Execution Lifecycle States
The execution lifecycle should use current contract values where they already
exist and define additional conceptual phases for future contract work.

- `not_started`: execution has not begun; maps to a future pre-run phase and may
  be represented today as `planned`.
- `preflight`: plan and policy preflight are being evaluated; maps to pending
  policy steps in current runner planning contracts.
- `waiting_for_approval`: policy requires scoped human approval before work can
  run; exists in current runner state contracts.
- `running`: at least one approved batch or adapter attempt is running; exists in
  current runner and lifecycle contracts.
- `partially_completed`: some observed work completed but required work remains;
  maps to current `incomplete` runner result behavior.
- `retryable`: execution stopped with retryable items; maps to work item and step
  retryable states and may produce an `incomplete` or future `retryable` runner
  result.
- `blocked`: execution cannot continue without input, approval, policy change, or
  environment support; exists in current contracts.
- `failed`: a non-retryable execution, adapter, policy, audit, or verification
  failure prevents progress; exists in current contracts.
- `verification_required`: observed execution is finished enough to verify, but
  verifier handoff has not completed.
- `verified`: verifier accepted the observed lifecycle evidence; exists in
  current contracts.
- `completed`: verifier passed, audit evidence exists, and no required work
  remains; exists in current contracts.
- `cancelled`: a human or policy decision stopped execution before completion;
  exists in current contracts.

For JSON results, the current `AgenticRunnerState` also includes `incomplete`.
The execution lifecycle should return `incomplete` when observed work is
accounted for but coverage is not complete and more work can continue.

## Execution Flow
```text
AgenticRunnerPlan
   |
   v
Validate plan is safe/executable
   |
   v
Policy preflight
   |
   v
Human approval if required
   |
   v
Execute batch step
   |
   v
Record observed work item outcomes
   |
   v
Append audit handoff
   |
   v
Run verifier handoff
   |
   v
Update resume cursor
   |
   v
completed / incomplete / failed / blocked / retryable
```

## Step Execution Lifecycle
Each executable step follows a bounded lifecycle:

1. Validate step exists in the plan and is not already terminal.
2. Confirm dependencies are completed, verified, skipped, or explicitly not
   required.
3. Confirm required policy decisions are allowed or approved.
4. Confirm required audit event ids are known.
5. Mark the step `running`.
6. Start an execution attempt when an adapter call is needed.
7. Record observed adapter output, errors, timeout, refusal, denial, or partial
   result.
8. Update referenced work items from observed outcomes only.
9. Update batch counters from work item states, not adapter summaries.
10. Append audit events for step and item outcomes.
11. Mark the step `completed`, `failed`, `blocked`, `skipped`, `retryable`, or
    `verified` according to deterministic rules.

Step completion never implies task completion by itself.

## Batch Execution Lifecycle
Batches are the execution unit for work items.

Rules:

- A batch starts only after policy and approval conditions pass.
- Batch expected item ids must be known before execution.
- The runner must know `expectedItemCount` and `workItemIds` for the batch.
- Each item outcome must be observed as completed, failed, skipped, retryable, or
  still pending/in progress.
- Batch counts are derived from item states.
- Partial batch completion creates a retry or resume state.
- Duplicate item completion must not double-count.
- A completed batch cannot override unfinished item states.
- Retries create new attempts; prior attempts remain audit evidence.

## Work Item State Transitions
Work item state is separate from task state. Allowed MVP transitions:

- `pending -> in_progress`;
- `in_progress -> completed`;
- `in_progress -> failed`;
- `failed -> retryable` when the failure is explicitly retryable;
- `retryable -> in_progress` for a new attempt;
- `in_progress -> skipped` only when the skip is explicit and reasoned;
- `completed -> verified` when item-level or task-level verification accepts the
  item.

Guardrails:

- `completed` cannot return to `pending` without an explicit reset or retry
  policy.
- `verified` should not rerun unless explicitly requested by a reset or
  reprocessing policy.
- `failed`, `skipped`, and `retryable` require explicit issues or reasons.
- `pending`, `in_progress`, and `retryable` prevent final `completed` state.
- Duplicate work item ids are execution blockers.

## Policy Gate Execution
Policy gates run before execution and before any risky or state-changing adapter
call.

Execution policy rules:

- execution cannot bypass the policy gate;
- denied actions must not run;
- approval-required actions must not run before scoped approval is granted;
- approval applies only to the requested action and scope;
- approval does not broaden the task contract;
- policy decisions must be audit-recorded before the evaluated action runs;
- policy failure maps to `blocked` when human input or approval can unblock it,
  otherwise `failed`.

## Human Approval Handling
When policy returns `requires_approval`, the runner moves to
`waiting_for_approval`.

Approval lifecycle:

- append `approval_requested`;
- pause execution before the adapter call;
- record the requested action, risk class, permission level, scope, constraints,
  and expiration when applicable;
- resume only when `approval_granted` is present for the same scope;
- append `approval_denied` and mark `blocked` or `cancelled` when approval is
  denied;
- reject adapter or model attempts to self-approve.

Human approval is scoped evidence. It is not a durable blanket permission.

## Adapter Execution Boundary
Adapters are boundaries for proposed or performed work. The runner owns
orchestration and state.

Shared adapter rules:

- adapters receive only the context, scope, policy, audit, and timeout needed for
  the current step;
- adapters return normalized `ok`, `partial`, `blocked`, `unsupported`, or
  `failed` outcomes;
- adapter success is evidence for an attempt, not task completion;
- adapter errors are normalized into runner issues;
- adapter calls are correlated with audit event ids and attempt ids;
- unsupported behavior must not be silently approximated.

## Model Adapter Call Lifecycle
Model adapters may:

- propose output;
- summarize approved context;
- classify input when classification has no side effects;
- return structured candidate data, refusal status, safety status, and usage.

Model adapters cannot:

- be completion authority;
- mutate files, memory, Git, dependencies, deployments, or external systems;
- approve risky operations;
- expand task scope;
- override verifier results.

Lifecycle:

1. Validate model capability and requested response format.
2. Confirm policy allows the model call scope.
3. Append model invocation audit boundary when required.
4. Invoke the model adapter.
5. Normalize refusal, timeout, partial, unsupported, failed, or ok status.
6. Treat model output as a claim or candidate result.
7. Record only runner-observed item outcomes.

## Tool Adapter Call Lifecycle
Tool adapters may perform allowed operations only.

Tool adapter rules:

- denied operations must not run;
- risky operations require scoped approval;
- observed tool outcomes must be recorded;
- side effects must be summarized;
- affected paths or resources must be reported when available;
- tool success must not self-mark the task completed.

Lifecycle:

1. Build a proposed action with intent, risk class, permission level, scope, and
   expected side effects.
2. Evaluate policy before execution.
3. Request approval when policy requires it.
4. Append `tool_requested` or conceptual `work_item_started` evidence before
   execution when required.
5. Invoke the tool adapter only when allowed.
6. Normalize exit code, output summary, side effects, timeout, blocked, or failed
   status.
7. Update item and batch states from observed outcomes.
8. Append tool and work item outcome audit events.

## Audit Handoff Lifecycle
Audit handoff is required before final completion.

Expected conceptual runner events:

- `runner_started`;
- `policy_checked`;
- `approval_requested`;
- `approval_granted`;
- `approval_denied`;
- `batch_started`;
- `work_item_started`;
- `work_item_completed`;
- `work_item_failed`;
- `work_item_skipped`;
- `batch_completed`;
- `batch_failed`;
- `verifier_started`;
- `verifier_completed`;
- `resume_cursor_updated`;
- `runner_completed`;
- `runner_failed`;
- `runner_blocked`.

These names are execution-lifecycle concepts. Implementation may map them to the
current `AuditEventType` values, such as `task_started`, `policy_checked`,
`approval_requested`, `tool_executed`, `verification_run`, `verification_failed`,
`task_completed`, and `error_raised`, while preserving the same semantics in
metadata.

Audit lifecycle rules:

- append `runner_started` before execution leaves `not_started`;
- append `policy_checked` before any gated action runs;
- append approval events before approval-dependent execution resumes or stops;
- append batch and work item events as outcomes are observed;
- append `verifier_started` and `verifier_completed` around verifier handoff;
- append `resume_cursor_updated` before returning resumable results;
- append terminal runner event before returning final output;
- missing required audit evidence prevents `completed`.

## Verifier Handoff Lifecycle
Verifier handoff runs after observed outcomes are recorded.

Rules:

- verifier receives lifecycle, work item, batch, artifact, audit, inventory, and
  coverage state;
- verifier runs after audit handoff has enough event references for the executed
  work;
- verifier result decides `completed` versus `incomplete`, `failed`, or
  `blocked`;
- runner cannot override a verifier `incomplete` result;
- verifier success is required before `verified` and `completed`;
- verifier failure maps to runner failure or retryable/incomplete state based on
  issue retryability.

## Resume / Retry Lifecycle
Resume and retry use persisted lifecycle evidence. They do not ask a model what
remains.

Resume rules:

- reload task contract and existing lifecycle state;
- identify pending, retryable, in-progress interrupted, failed, and unverified
  items from runner-owned state;
- rebuild or select eligible batches from remaining item ids;
- preserve prior completed and verified item ids;
- preserve prior attempts and audit correlation id;
- avoid rerunning verified work unless explicit reset policy permits it;
- update `nextStepId`, `nextBatchId`, pending ids, retryable ids, and timestamp.

Retry rules:

- retry only items marked `retryable` or explicitly selected by retry policy;
- create new attempts rather than modifying old attempts;
- carry forward previous issues as historical evidence;
- keep failures non-retryable unless a policy, input, or environment change
  makes them retryable.

## Failure Handling
Failures must be typed and explicit:

- `scope_failure`: plan or action exceeds task scope;
- `policy_failure`: action is denied or required approval is absent;
- `execution_failure`: adapter or step fails a work item;
- `verification_failure`: required verification fails;
- `coverage_failure`: expected item, batch, inventory, or artifact accounting is
  incomplete;
- `artifact_failure`: expected artifacts are missing or invalid;
- `adapter_failure`: adapter returns failed, unsupported, timeout, or invalid
  output;
- `audit_failure`: required events cannot be appended or verified;
- `resume_failure`: cursor cannot be constructed from known state.

Prefer `blocked` when a human decision, approval, missing input, or environment
repair can unblock execution. Use `failed` for non-retryable defects. Use
`incomplete` or conceptual `retryable` when remaining work can continue.

## Cancellation Handling
Cancellation can be requested by a human or policy decision.

Rules:

- stop starting new adapter calls immediately;
- allow already-completed observed outcomes to remain recorded;
- mark currently running items `retryable` when safe to retry, otherwise
  `failed` or `blocked` with a reason;
- append cancellation-related audit evidence;
- update resume cursor for remaining work when cancellation is resumable;
- final state is `cancelled`, not `completed`.

## Deterministic Completion Rules
Critical safety rules:

- execution cannot start from an unsafe or non-ok plan;
- execution cannot bypass policy gate;
- tool and model adapters cannot self-mark task completed;
- runner records observed outcomes only;
- verifier success is required before completed state;
- audit handoff must record execution events before final completion;
- retryable or pending items prevent completed state.

Completion requires all of the following:

- plan validation passed;
- policy and approval gates are satisfied;
- all required batch item outcomes are terminal;
- duplicate completion did not double-count any item id;
- coverage verifier returns `verified`;
- required audit events are present;
- no required pending, in-progress, or retryable work remains;
- no critical runner issue remains.

## JSON Execution Result Concept
The execution result should be compact, deterministic, and safe to serialize:

```json
{
  "ok": false,
  "taskId": "...",
  "state": "incomplete",
  "mode": "execute",
  "plan": {},
  "executedSteps": [],
  "workItems": {},
  "batches": [],
  "policy": {},
  "audit": {},
  "verifier": {},
  "resume": {},
  "issues": [],
  "summary": {}
}
```

The result must not contain raw prompts, full model outputs, raw command logs,
secrets, broad file contents, or provider SDK objects.

## CLI Integration Concept
Future CLI surface:

- `aeos task run`;
- `aeos task run --dry-run`;
- `aeos task run --json`;
- `aeos task status`;
- `aeos task resume`;
- `aeos task cancel`;
- `aeos task verify`.

CLI commands should be thin operators over core contracts and runner logic. They
should not own policy decisions, adapter execution semantics, coverage
verification rules, or completion authority.

## Sitemap Example
A sitemap task has 400 work items. A batch executes 20 items. The model says the
job is done.

Execution result:

- expected work items: 400;
- observed completed work items: 20;
- pending work items: 380;
- duplicate completions: ignored for counts;
- verifier result: `incomplete`;
- resume cursor: remaining 380 item ids;
- final runner state: `incomplete` or conceptual `retryable`, not `completed`.

The runner records only the 20 observed completions. The model claim is retained
as a claim or summary, not completion proof.

## MVP Scope
MVP execution should support:

- validating a provided runner plan;
- enforcing policy preflight and approval waiting states;
- executing represented batch steps through adapter boundaries;
- recording observed work item and batch outcomes;
- appending required audit handoff events;
- handing lifecycle evidence to the coverage verifier;
- producing completed, incomplete, failed, blocked, retryable, or cancelled
  outcomes;
- creating deterministic resume state;
- rendering JSON and compact human results.

## Later Scope
Later work may add:

- durable task state storage;
- richer adapter registries and capability routing;
- configurable batch sizing;
- timeout and budget policy profiles;
- external audit sinks;
- UI or service surfaces for approval;
- remote tool execution;
- signed audit chains;
- organization policy profiles;
- richer CLI ergonomics and status views.

## Non-goals
- Implement execution code in this task.
- Implement CLI commands.
- Implement concrete model, agent, tool, policy, audit, or verifier adapters.
- Add package dependencies.
- Deploy or publish anything.
- Trust autonomous model self-reporting as completion proof.
- Guarantee fully autonomous execution for arbitrary tasks.

## Safety Boundaries
Execution must remain deterministic, auditable, resumable, policy-aware, and
verifier-gated.

Boundaries:

- task contract is the scope authority;
- policy is the execution authority for risky actions;
- human approval is scoped and explicit;
- adapters are proposal or action boundaries, not completion authorities;
- audit records are required evidence, not optional logging;
- verifier is completion authority for coverage status;
- pending, retryable, missing, denied, blocked, or unaudited work prevents final
  completion.

## Smoke Test Requirements
Future implementation should include smoke tests for:

- unsafe or non-ok plan is rejected before execution;
- policy preflight denial prevents adapter calls;
- approval-required plan enters `waiting_for_approval`;
- approval denial prevents execution;
- allowed batch execution records expected item ids;
- partial batch completion creates resume state;
- duplicate item completion does not double-count;
- model "done" claim does not complete the task;
- tool denied operation is not run;
- audit events are required before terminal completion;
- verifier `incomplete` prevents `completed`;
- pending and retryable items prevent `completed`;
- cancellation stops new work and records resumable state;
- JSON execution result includes plan, work item, batch, policy, audit, verifier,
  resume, issues, and summary sections.

## Implementation Sequence
1. TASK-0214: Implement agentic runner execution contracts. Purpose: add
   execution input, result, state, step result, batch result, observed outcome,
   and JSON-safe contract types. Likely files: `packages/core/src/agentic-runner.ts`.
   Verification command: `pnpm --filter @aeos/core check`. Effort: Medium.
   Classification: Code.
2. TASK-0215: Add execution contract examples. Purpose: document safe, partial,
   blocked, retryable, verifier-incomplete, and completed result examples.
   Likely files: `packages/core/src/agentic-runner.example.ts`.
   Verification command: `pnpm --filter @aeos/core check`. Effort: Low.
   Classification: Code.
3. TASK-0216: Implement execution plan validator. Purpose: reject unsafe,
   non-ok, non-executable, missing-verifier, and missing-audit plans before
   execution. Likely files: `packages/core/src/agentic-runner-execution-logic.ts`.
   Verification command: `pnpm --filter @aeos/core check`. Effort: Medium.
   Classification: Code.
4. TASK-0217: Implement execution state transition helper. Purpose: normalize
   allowed runner state transitions including preflight, approval, running,
   verification, incomplete, retryable, failed, blocked, cancelled, and
   completed. Likely files: `packages/core/src/agentic-runner-execution-logic.ts`.
   Verification command: `pnpm --filter @aeos/core check`. Effort: Medium.
   Classification: Code.
5. TASK-0218: Implement work item transition validator. Purpose: enforce allowed
   work item transitions and require reasons for failed, skipped, and retryable
   states. Likely files: `packages/core/src/agentic-runner-execution-logic.ts`,
   `packages/core/src/agentic-lifecycle.ts`. Verification command:
   `pnpm --filter @aeos/core check`. Effort: Medium. Classification: Code.
6. TASK-0219: Implement batch execution accounting helper. Purpose: derive batch
   counts from observed work item states and reject duplicate completion counts.
   Likely files: `packages/core/src/agentic-runner-execution-logic.ts`.
   Verification command: `pnpm --filter @aeos/core check`. Effort: Medium.
   Classification: Code.
7. TASK-0220: Implement policy preflight execution mapper. Purpose: map policy
   adapter decisions to allowed, denied, approval-required, blocked, and failed
   runner states without running actions. Likely files:
   `packages/core/src/agentic-runner-execution-logic.ts`, `packages/core/src/policy.ts`.
   Verification command: `pnpm --filter @aeos/core check`. Effort: Medium.
   Classification: Code.
8. TASK-0221: Implement human approval execution state mapper. Purpose: record
   approval requested, granted, denied, expired, and revoked states for runner
   execution. Likely files: `packages/core/src/agentic-runner-execution-logic.ts`,
   `packages/core/src/policy.ts`. Verification command:
   `pnpm --filter @aeos/core check`. Effort: Medium. Classification: Code.
9. TASK-0222: Implement model adapter result mapper. Purpose: convert model
   output, refusal, timeout, partial, unsupported, and failed statuses into
   non-authoritative observed claims and issues. Likely files:
   `packages/core/src/agentic-runner-execution-logic.ts`,
   `packages/core/src/adapters.ts`. Verification command:
   `pnpm --filter @aeos/core check`. Effort: Medium. Classification: Code.
10. TASK-0223: Implement tool adapter result mapper. Purpose: convert allowed
    tool outcomes, side effects, exit codes, and errors into observed item and
    attempt results. Likely files: `packages/core/src/agentic-runner-execution-logic.ts`,
    `packages/core/src/adapters.ts`. Verification command:
    `pnpm --filter @aeos/core check`. Effort: High. Classification: Code.
11. TASK-0224: Implement audit event lifecycle builder. Purpose: produce compact
    runner, policy, approval, batch, work item, verifier, resume, and terminal
    event drafts. Likely files: `packages/core/src/agentic-runner-execution-logic.ts`,
    `packages/core/src/audit.ts`. Verification command:
    `pnpm --filter @aeos/core check`. Effort: Medium. Classification: Code.
12. TASK-0225: Implement audit handoff validator. Purpose: require expected
    audit events before verified or completed runner states. Likely files:
    `packages/core/src/agentic-runner-execution-logic.ts`.
    Verification command: `pnpm --filter @aeos/core check`. Effort: Medium.
    Classification: Code.
13. TASK-0226: Implement verifier handoff mapper. Purpose: call or map coverage
    verifier results into runner states without overriding incomplete results.
    Likely files: `packages/core/src/agentic-runner-execution-logic.ts`,
    `packages/core/src/agentic-coverage-verifier-logic.ts`. Verification command:
    `pnpm --filter @aeos/core check`. Effort: High. Classification: Code.
14. TASK-0227: Implement deterministic resume cursor builder for execution.
    Purpose: derive pending and retryable work ids from observed lifecycle state
    after partial, failed, blocked, cancelled, or verifier-incomplete execution.
    Likely files: `packages/core/src/agentic-runner-execution-logic.ts`.
    Verification command: `pnpm --filter @aeos/core check`. Effort: Medium.
    Classification: Code.
15. TASK-0228: Add execution JSON renderer. Purpose: render compact JSON output
    with plan, executed steps, work items, batches, policy, audit, verifier,
    resume, issues, and summary. Likely files:
    `packages/core/src/agentic-runner-execution-logic.ts` or a renderer module.
    Verification command: `pnpm --filter @aeos/core check`. Effort: Medium.
    Classification: Code.
16. TASK-0229: Add execution smoke tests. Purpose: cover unsafe plan rejection,
    policy denial, approval wait, partial batch resume, model self-report
    rejection, audit gap, verifier incomplete, duplicate completion, and
    cancellation. Likely files: `packages/core/src/agentic-runner-execution-logic.test.ts`.
    Verification command: `pnpm --filter @aeos/core check`. Effort: High.
    Classification: Code.
17. TASK-0230: Document task runner CLI behavior. Purpose: define future
    operator behavior for `aeos task run`, `status`, `resume`, `cancel`, and
    `verify` without implementing commands. Likely files: `docs/AGENTIC_TASK_RUNNER_CLI.md`.
    Verification command: `git status --short`. Effort: Medium.
    Classification: Docs.
