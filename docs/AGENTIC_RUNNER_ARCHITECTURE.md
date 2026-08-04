# Agentic Runner Architecture

## Purpose
Design the AEOS agentic runner architecture for deterministic task lifecycle
execution.

The runner coordinates task contracts, policy gates, work item planning, batch
execution, model and tool adapter calls, audit events, resume/retry state, and
coverage verification. This document is design-only. It does not implement
runner code, storage, adapters, or CLI commands.

## Why Agentic Runner Is Needed
Agentic work can appear complete when only the model says it is complete. AEOS
needs a runner that records actual observed state outside the model: which work
items exist, which batches ran, which adapter calls returned, which actions were
allowed or denied, which audit events were appended, and whether coverage
verification passed.

The runner exists to make agentic execution local-first, auditable, resumable,
policy-gated, and verifier-gated. It must not overpromise autonomous execution.
The MVP should execute only bounded local task lifecycle steps with explicit
scope and deterministic completion rules.

## Current Foundation Status
AEOS already has the foundations needed to design the runner:

- `docs/TASK_CONTRACT.md` defines task scope, allowed context, file boundaries,
  verification, stop conditions, and handoff shape.
- `docs/AGENTIC_TASK_LIFECYCLE_DESIGN.md` defines lifecycle states, inventory,
  work items, batches, verification, audit, resume, and failure handling.
- `docs/AGENTIC_COVERAGE_VERIFIER_DESIGN.md` and
  `docs/AGENTIC_COVERAGE_VERIFIER_USAGE.md` define deterministic coverage
  verification and the rule that model self-reporting is not completion proof.
- `docs/POLICY_PERMISSION_MODEL.md` defines pre-execution and per-action policy
  decisions.
- `docs/AUDIT_LOG_FORMAT.md` defines compact append-only audit events.
- `docs/VERIFICATION_STRATEGY.md` defines pass, fail, blocked, and skipped
  verification behavior.
- `docs/ADAPTER_CONTRACTS.md` defines model, agent, tool, policy, verifier, and
  audit adapter boundaries.
- `packages/core/src/agentic-lifecycle.ts` defines lifecycle result, inventory,
  work item, batch, coverage, audit, verification, and resume cursor types.
- `packages/core/src/agentic-coverage-verifier.ts` and
  `packages/core/src/agentic-coverage-verifier-logic.ts` define and implement
  side-effect-free coverage verification.

There is no runner yet. There is no agentic task CLI runtime yet.

## Runner Responsibilities
The runner is the lifecycle coordinator. It should:

- load and validate one task contract;
- run policy preflight before execution;
- plan inventory and stable work item ids;
- group eligible work items into bounded batches;
- request per-batch policy decisions;
- invoke approved model, agent, or tool adapters through AEOS-owned contracts;
- record actual observed adapter outcomes;
- append lifecycle, policy, adapter, batch, work item, verifier, and cursor audit
  events;
- update work item, batch, attempt, coverage, and resume state;
- call the coverage verifier before any verified or completed transition;
- classify failures as blocked, retryable, failed, or incomplete;
- emit compact human and JSON results.

## Runner Non-Responsibilities
The runner must not:

- decide task completion from model text;
- perform provider-specific model routing inside core orchestration;
- execute shell, MCP, network, Git, dependency, migration, deployment, or secret
  actions directly;
- bypass policy gates for convenience;
- mutate memory directly;
- broaden task scope or load unlisted context;
- repair failed work by inventing unstated scope;
- hide partial, denied, blocked, or retryable outcomes;
- implement concrete CLI commands in this design phase.

## Runner Lifecycle Flow
```text
Task contract
   |
   v
Policy preflight
   |
   v
Inventory / work item planning
   |
   v
Batch creation
   |
   v
Adapter execution
   |
   v
Audit event append
   |
   v
Coverage verification
   |
   v
Resume / retry / completed / failed
```

The runner may loop through batch creation, adapter execution, audit append, and
coverage verification until there is no eligible work, a policy or approval gate
blocks progress, a non-retryable failure occurs, or coverage verification allows
completion.

## Input Model
The MVP runner input should be serializable and task-scoped:

- `taskId`;
- parsed task contract;
- workspace path;
- approved loaded context references;
- allowed and denied file/resource scopes;
- verification requirements;
- policy grants and approval state;
- selected adapter ids or adapter routing hints;
- optional existing lifecycle state for resume;
- optional batch size or work item limits;
- output mode such as human or JSON.

Inputs must not include raw secrets, broad repository snapshots, unlisted files,
or provider-specific SDK objects.

## Output Model
The runner output should be compact and derived from observed state:

- `ok`;
- `taskId`;
- task state;
- inventory and coverage summary;
- batch summaries;
- work item state counts;
- verification and coverage verifier result references;
- resume cursor;
- audit references;
- normalized issues;
- final human handoff summary when requested.

`ok: true` is allowed only when the task reaches `completed` through verifier
success and required audit evidence exists.

## Work Item Orchestration
Work items are the runner's unit of accountable progress.

The runner should:

- create stable ids from deterministic inventory inputs;
- preserve item identity across batches, retries, and resumes;
- keep item state separate from task state;
- transition items through `pending`, `in_progress`, `completed`, `failed`,
  `skipped`, `retryable`, or `verified`;
- require explicit issues or reasons for `failed`, `skipped`, and `retryable`;
- avoid counting duplicate ids twice;
- leave unstarted work as `pending`;
- leave interrupted retryable work as `retryable`;
- avoid rerunning verified work unless explicitly requested.

## Batch Orchestration
Batches group work items into bounded execution units. Batch size should be
chosen from deterministic limits such as item count, context budget, policy
scope, tool budget, timeout, and adapter capability.

The runner should:

- build batches only from eligible pending or retryable work;
- record batch membership by work item id;
- preserve expected item counts;
- record started, completed, failed, retryable, and skipped counts from work item
  state, not from model claims;
- prevent a completed batch from overriding unfinished work item states;
- create a new execution attempt for each adapter call;
- make retries new attempts, not rewrites of old attempts.

## Adapter Execution Boundary
Adapters execute or propose bounded work. The runner owns orchestration and
observed state.

- Model adapters may produce proposed results, structured plans, summaries, or
  candidate outputs.
- Agent adapters may run scoped task instructions and return handoff claims.
- Tool adapters may perform controlled actions only after policy allows them.
- Policy adapters classify and gate proposed actions.
- Audit adapters append events.
- Verifier adapters or verifier logic check evidence.

Adapters return normalized `ok`, `partial`, `blocked`, `unsupported`, `timeout`,
or `failed` style outcomes. The runner records those outcomes and maps them to
attempt, batch, item, coverage, and task state.

## Model Adapter Boundary
Model adapters are proposal engines, not completion authorities.

They may:

- generate structured plans or item-level proposed outputs;
- summarize context within approved scope;
- classify input when the classification has no side effects;
- return usage, refusal, timeout, and safety status.

They must not:

- mark work complete;
- mutate files, memory, Git, dependencies, deployments, or external systems;
- approve risky actions;
- expand task scope;
- decide verifier status.

## Tool Adapter Boundary
Tool adapters are controlled action boundaries.

They may:

- perform a declared action with scoped arguments;
- report affected paths or resources;
- return exit codes, concise output summaries, side effects, and normalized
  errors;
- support dry-run when available.

They must not:

- run before policy evaluation;
- hide side effects;
- access excluded paths or secrets without approval;
- execute broad escape-hatch commands from model text;
- treat tool success as task completion.

## Policy Gate Integration
Policy gates run at two levels:

- preflight before execution;
- per-batch and per-action before adapter calls that may read, write, execute, or
  affect state.

Policy decisions may be `allow`, `deny`, or `requires_approval`. Denied actions
do not run. Approval-required actions become blocked until a scoped human
approval is recorded. Approval does not broaden the task contract; it only
allows the approved action within the approved scope.

## Permission Boundary
Permissions are task-scoped and adapter-scoped. The runner should pass only the
minimum allowed context, file paths, tool arguments, and permission state needed
for the current batch.

The runner must block or deny:

- unlisted context reads;
- writes outside `FILES TO MODIFY` or approved generated artifact scope;
- deletes, renames, dependency changes, Git writes, migrations, deployments,
  network side effects, and secret access without explicit approval;
- attempts by models, agents, or tools to self-approve risky actions.

## Audit Event Integration
The runner emits lifecycle and execution audit events through the audit adapter.
Events should be compact, redacted, append-only, and correlation-id linked.

Required event classes include:

- task lifecycle events: started, blocked, failed, verified, completed,
  cancelled;
- policy events: preflight checked, per-batch checked, denied, approval requested,
  approval granted, approval denied;
- adapter events: model invoked, agent invoked, tool requested, tool executed;
- batch events: batch started, completed, failed, retryable;
- work item events: state changed, item failed, item skipped, item retryable;
- verifier events: verification run, verification failed, coverage result;
- resume events: cursor created, cursor updated, resume started, resume blocked.

Audit append failure is a task-blocking failure when audit is required for the
action or completion decision.

## Coverage Verifier Integration
Coverage verification is the completion gate.

The runner provides the verifier with lifecycle state, inventory, work items,
batches, coverage, verification snapshots, and audit references. The verifier
returns `verified`, `incomplete`, `failed`, `blocked`, or `unknown`.

Critical safety rule: the runner must never mark a task completed based only on
model output. Completion requires coverage verifier success.

The runner may transition to:

- `completed` only when verifier `ok` is true, required verification passed or
  was explicitly skipped by scope, policy gates are satisfied, and audit evidence
  exists;
- `incomplete` or `running` when remaining work is pending or retryable;
- `blocked` when approval, input, policy, audit, or environment prevents
  progress;
- `failed` when non-retryable execution or verification failure prevents
  completion.

## Resume / Retry Behavior
Resume and retry are state-driven, not model-memory-driven.

Rules:

- failed work items may become retryable only with a retryable issue or policy;
- pending work remains pending until execution starts;
- retry cursor must be deterministic from known pending and retryable item ids;
- runner can resume from cursor without asking the model what remains;
- verified items are not rerun by default;
- completed, failed, and skipped terminal items are not counted twice;
- each retry creates a new attempt id;
- duplicate completion should not be counted;
- stale cursors are verifier issues and must be rebuilt from lifecycle state.

The cursor should contain the next eligible batch id when known, remaining work
item ids, retryable work item ids, and the timestamp/state version used to build
it.

## Failure Handling
Failures should be typed and mapped to explicit state:

- `scope_failure`: blocked or failed when requested work exceeds contract;
- `policy_failure`: blocked for approval-needed, failed or blocked for denial;
- `execution_failure`: retryable, blocked, or failed based on adapter result;
- `verification_failure`: failed or incomplete based on required check status;
- `coverage_failure`: incomplete when work remains, failed when state is invalid
  and not retryable;
- `artifact_failure`: incomplete or failed when expected artifacts are missing or
  invalid;
- `adapter_failure`: retryable on timeout/transient errors, failed on
  unsupported/non-retryable errors;
- `audit_failure`: blocked or failed when required evidence cannot be appended;
- `resume_failure`: blocked when cursor is invalid until rebuilt from state.

## Human Approval Points
Human approval is required before risky actions such as:

- destructive commands;
- file deletion or broad rename;
- dependency changes;
- Git writes, push, force push, rebase, merge, or tag publication;
- migrations;
- deployments;
- secret access;
- network operations with side effects;
- broad filesystem or environment inspection.

Human approval should be explicit, scoped, auditable, and revocable. The runner
must not interpret model confidence or agent handoff text as approval.

## Deterministic Completion Rules
Completion requires all applicable rules to pass:

```text
expected_items == completed_items + explicitly_failed_items + explicitly_skipped_items
expected_artifacts == verified_artifacts
discovered_items == inventoried_items
```

Additional MVP completion rules:

- no pending or retryable required work remains;
- inventory is complete when required;
- batch counters match work item states;
- required verification status is `pass` or explicitly `skipped`;
- required audit references are present;
- policy gates are satisfied;
- no critical or unresolved required issues remain.

The runner records actual observed outcomes. The verifier determines completion
from observed state.

## JSON Output Concept
Future JSON output should be stable and compact:

```json
{
  "ok": false,
  "taskId": "...",
  "state": "blocked|running|incomplete|failed|completed",
  "coverage": {},
  "batches": [],
  "workItems": {},
  "verification": {},
  "resume": {},
  "audit": {},
  "issues": []
}
```

The JSON result should not include raw prompts, full model outputs, raw command
logs, secrets, broad file contents, or private reasoning traces.

## CLI Integration Concept
Future CLI surface:

- `aeos task run`;
- `aeos task run --json`;
- `aeos task status`;
- `aeos task resume`;
- `aeos task verify`;
- `aeos agent run`.

These commands are concepts only. This design does not implement them.

CLI behavior should route through core runner contracts, print concise human
output by default, emit the JSON concept for `--json`, and avoid owning policy,
audit, adapter, or verifier logic inside the CLI layer.

## Sitemap Failure Example
A discovery-driven sitemap task discovers 400 sub-sitemaps. A model processes 20
items and claims the task is done.

The runner records:

- expected items: 400;
- completed work item ids: 20;
- pending or retryable work item ids: 380;
- batch outcome for the processed 20;
- model completion claim as a claim only;
- audit events for the batch, adapter call, and state changes.

The verifier returns incomplete because:

```text
400 != 20 + 0 + 0
```

The runner keeps the remaining 380 work items pending or retryable. The task
state cannot become `completed`.

## MVP Scope
MVP runner scope:

- core runner contracts;
- deterministic task input validation;
- lifecycle result builder;
- local inventory and work item planning from explicit input;
- bounded batch planner;
- adapter request/result normalization boundary;
- policy preflight and per-batch decision plumbing;
- audit event planning and append result references;
- coverage verifier integration;
- deterministic resume cursor builder;
- JSON result renderer;
- examples and smoke tests.

MVP remains local-first and does not promise continuous autonomous execution.

## Later Scope
Later scope may include:

- richer adapter routing;
- multi-agent coordination;
- durable task state storage;
- external audit sinks;
- remote tool execution with stricter policy;
- richer retry budgets and backoff;
- partial artifact checksums;
- policy simulation;
- UI status views;
- queueing and scheduling;
- cross-repository task orchestration.

## Non-Goals
- Implement runner code in this task.
- Add CLI commands in this task.
- Add package dependencies.
- Deploy or push anything.
- Trust model self-reporting.
- Support unconstrained autonomous execution.
- Replace policy, audit, adapter, task, or verifier contracts.
- Make external network or hosted execution mandatory.

## Safety Boundaries
The runner should fail closed when scope, policy, audit, verification, or
coverage state is missing or contradictory.

Safety rules:

- model output is always a claim;
- actual observed adapter outcomes are the source of execution truth;
- tool side effects must be policy-checked and audited;
- verifier success is required for completion;
- denied actions do not run;
- approval-required actions block until approval exists;
- no raw secrets, full prompts, full model outputs, or broad logs are persisted;
- unlisted files and excluded paths stay out of scope.

## Smoke Test Requirements
Runner implementation tasks should include smoke tests that prove:

- incomplete item coverage cannot complete;
- model "done" output cannot complete without verifier success;
- sitemap case with 20 of 400 processed remains incomplete;
- pending and retryable items produce a deterministic resume cursor;
- duplicate completed item ids are not double-counted;
- per-batch policy denial prevents adapter execution;
- approval-required risky action blocks before execution;
- audit append failure blocks completion when audit is required;
- batch counters must match work item states;
- JSON output contains stable top-level fields.

## Implementation Sequence
The following small tasks should follow this design. Do not start them from this
task.

1. TASK-0200: Implement agentic runner contracts.
   Purpose: Define TypeScript input, output, state, batch, execution, and issue
   contracts for the runner.
   Likely files: `packages/core/src/agentic-runner.ts`,
   `packages/core/src/index.ts`.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: Medium.
   Classification: Code.

2. TASK-0201: Add agentic runner contract examples.
   Purpose: Demonstrate runner request, incomplete run, completed run, blocked
   policy run, and resume result shapes.
   Likely files: `packages/core/src/agentic-runner.example.ts`.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: Low.
   Classification: Code.

3. TASK-0202: Implement runner input validation helper.
   Purpose: Validate task id, task contract scope, loaded context, file
   boundaries, and required verifier settings before execution.
   Likely files: `packages/core/src/agentic-runner-logic.ts`,
   `packages/core/src/agentic-runner.ts`.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: Medium.
   Classification: Code.

4. TASK-0203: Add policy preflight planner.
   Purpose: Convert runner input into deterministic proposed actions and
   preflight policy decisions.
   Likely files: `packages/core/src/agentic-runner-logic.ts`,
   `packages/core/src/policy.ts`.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: Medium.
   Classification: Code.

5. TASK-0204: Implement work item inventory planner.
   Purpose: Build stable work item ids and inventory summaries from explicit
   runner input.
   Likely files: `packages/core/src/agentic-runner-logic.ts`,
   `packages/core/src/agentic-lifecycle.ts`.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: Medium.
   Classification: Code.

6. TASK-0205: Implement batch planner.
   Purpose: Group pending and retryable work items into deterministic bounded
   batches.
   Likely files: `packages/core/src/agentic-runner-logic.ts`.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: Medium.
   Classification: Code.

7. TASK-0206: Implement adapter execution result mapper.
   Purpose: Map normalized model, agent, and tool adapter results into attempt,
   batch, work item, and issue state.
   Likely files: `packages/core/src/agentic-runner-logic.ts`,
   `packages/core/src/adapters.ts`.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: High.
   Classification: Code.

8. TASK-0207: Add per-batch policy gate helper.
   Purpose: Ensure every batch or risky adapter action receives allow, deny, or
   approval-required policy state before execution.
   Likely files: `packages/core/src/agentic-runner-logic.ts`,
   `packages/core/src/policy.ts`.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: Medium.
   Classification: Code.

9. TASK-0208: Implement runner audit event builder.
   Purpose: Build compact lifecycle, batch, work item, policy, adapter,
   verifier, and resume audit events.
   Likely files: `packages/core/src/agentic-runner-audit.ts`,
   `packages/core/src/audit.ts`.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: Medium.
   Classification: Code.

10. TASK-0209: Integrate coverage verifier with runner result builder.
    Purpose: Call the existing coverage verifier and map verifier status to
    running, incomplete, blocked, failed, verified, or completed task state.
    Likely files: `packages/core/src/agentic-runner-logic.ts`,
    `packages/core/src/agentic-coverage-verifier.ts`.
    Verification command: `pnpm --filter @aeos/core check`.
    Recommended model effort: High.
    Classification: Code.

11. TASK-0210: Implement deterministic resume cursor builder.
    Purpose: Select remaining pending and retryable work ids without trusting
    model memory.
    Likely files: `packages/core/src/agentic-runner-logic.ts`,
    `packages/core/src/agentic-lifecycle.ts`.
    Verification command: `pnpm --filter @aeos/core check`.
    Recommended model effort: Medium.
    Classification: Code.

12. TASK-0211: Add runner JSON result renderer.
    Purpose: Emit stable compact JSON with `ok`, `taskId`, `state`, `coverage`,
    `batches`, `workItems`, `verification`, `resume`, `audit`, and `issues`.
    Likely files: `packages/core/src/agentic-runner-json.ts`.
    Verification command: `pnpm --filter @aeos/core check`.
    Recommended model effort: Medium.
    Classification: Code.

13. TASK-0212: Add runner incomplete coverage smoke examples.
    Purpose: Prove 20 of 400 processed items cannot complete even when model
    output claims done.
    Likely files: `packages/core/src/agentic-runner.example.ts`.
    Verification command: `pnpm --filter @aeos/core check`.
    Recommended model effort: Low.
    Classification: Code.

14. TASK-0213: Add runner smoke tests.
    Purpose: Test policy block, pending resume, retryable resume, duplicate item,
    audit-required failure, and verifier-gated completion cases.
    Likely files: `packages/core/src/agentic-runner.test.ts`.
    Verification command: `pnpm --filter @aeos/core check`.
    Recommended model effort: High.
    Classification: Code.

15. TASK-0214: Design agentic task CLI runner behavior.
    Purpose: Define CLI behavior for `aeos task run`, `aeos task status`,
    `aeos task resume`, and `aeos task verify` before implementation.
    Likely files: `docs/AGENTIC_TASK_CLI_RUNNER_DESIGN.md`,
    `TASKS/backlog.md`, `PROJECT_CONTEXT.md`.
    Verification command: `git status --short`.
    Recommended model effort: Medium.
    Classification: Docs.

16. TASK-0215: Implement `aeos task run` command shell.
    Purpose: Add CLI parsing and routing shell without autonomous adapter
    execution beyond core runner contracts.
    Likely files: `packages/cli/src/*`, `packages/core/src/*`.
    Verification command: `pnpm --filter @aeos/cli check`.
    Recommended model effort: Medium.
    Classification: Code.

17. TASK-0216: Implement `aeos task status` command.
    Purpose: Render persisted or provided lifecycle state and verifier summary.
    Likely files: `packages/cli/src/*`, `packages/core/src/*`.
    Verification command: `pnpm --filter @aeos/cli check`.
    Recommended model effort: Medium.
    Classification: Code.

18. TASK-0217: Implement `aeos task resume` command shell.
    Purpose: Route deterministic resume cursor state through the runner without
    rerunning verified items.
    Likely files: `packages/cli/src/*`, `packages/core/src/*`.
    Verification command: `pnpm --filter @aeos/cli check`.
    Recommended model effort: High.
    Classification: Code.

19. TASK-0218: Implement `aeos task verify` command.
    Purpose: Expose coverage verifier checks from CLI with stable human and JSON
    output.
    Likely files: `packages/cli/src/*`, `packages/core/src/*`.
    Verification command: `pnpm --filter @aeos/cli check`.
    Recommended model effort: Medium.
    Classification: Code.

20. TASK-0219: Review agentic runner MVP safety.
    Purpose: Confirm runner docs, contracts, examples, tests, policy gates,
    audit references, and verifier-gated completion behavior are consistent.
    Likely files: `docs/AGENTIC_RUNNER_ARCHITECTURE.md`,
    `docs/AGENTIC_TASK_CLI_RUNNER_DESIGN.md`, `PROJECT_CONTEXT.md`.
    Verification command: `git status --short`.
    Recommended model effort: Medium.
    Classification: Docs.
