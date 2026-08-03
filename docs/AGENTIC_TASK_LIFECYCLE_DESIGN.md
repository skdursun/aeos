# Agentic Task Lifecycle Design

## Purpose
Define the AEOS agentic task lifecycle for planning, inventorying, chunking,
executing, verifying, auditing, and resuming agentic work.

This is a design document only. It does not define runtime code, package APIs,
or implemented CLI behavior.

## Why Agentic Lifecycle Is Needed
Agentic work can fail quietly when the model reports success before all required
work is done. AEOS needs an external lifecycle that tracks expected scope,
discovered work, artifacts, state transitions, verification evidence, policy
decisions, and audit events independently from model self-reporting.

The lifecycle exists to make long or multi-part work local-first, auditable,
resumable, deterministic, and safe to stop between sessions.

## Current AEOS Foundation Status
AEOS already has planning documents for task contracts, policy and permission
checks, audit log format, verification strategy, adapter boundaries, project
profile usage, template recommendation usage, and CLI command mapping.

Current foundations are documentation-heavy and intentionally conservative:

- Task contracts define isolated work with explicit context, files, verification,
  and stop conditions.
- Policy rules gate risky filesystem, shell, Git, dependency, deployment,
  migration, network, and secret actions.
- Verification rules require evidence before completion.
- Audit rules require compact, redacted event records.
- Adapter contracts keep models, agents, tools, memory, policy, verification,
  and audit boundaries provider-independent.
- Existing project profile and template recommendation commands are local-first,
  deterministic, read-only, and do not rely on AI guessing.

## Core Principle
Model output is not trusted as completion proof.

AEOS treats agent output as a claim that must be checked against task contracts,
inventoried work, expected artifacts, coverage requirements, policy decisions,
verification results, and audit evidence. A model may say "done", but AEOS only
marks work complete when coverage, artifacts, and state prove that completion
rules were satisfied.

## Lifecycle Overview
```text
User task
   |
   v
Task contract
   |
   v
Inventory
   |
   v
Work items
   |
   v
Batches
   |
   v
Agent execution
   |
   v
Verifier
   |
   v
Audit log
   |
   v
Completed / failed / resumable
```

## Task States
- `draft`: task is being described and is not ready for execution.
- `planned`: task contract, scope, verification, and initial work plan exist.
- `approved`: required human approvals are present for the planned scope.
- `running`: one or more work items are being executed.
- `blocked`: execution cannot continue without missing input, permission,
  approval, environment support, or scope clarification.
- `failed`: required work or verification failed and is not currently retryable.
- `verified`: required verification passed, but final completion bookkeeping may
  still be pending.
- `completed`: completion rules passed, audit evidence exists, and no required
  work remains.
- `cancelled`: a human or policy decision stopped the task before completion.

Allowed state transitions should be explicit. For example, `completed` should
only follow `verified`; `running` should only follow `approved` unless the task
has no approval gates; and `blocked`, `failed`, or `cancelled` should preserve
enough state for audit review.

## Work Item States
- `pending`: item is known and has not started.
- `in_progress`: item is assigned or executing.
- `completed`: execution finished and produced a claim or artifact.
- `failed`: execution failed and is not currently retryable.
- `skipped`: item was explicitly skipped with a reason.
- `retryable`: item failed or was interrupted but may be retried.
- `verified`: item passed required verification.

Work item state is separate from task state. A task can be `running` while some
items are `verified`, others are `pending`, and others are `retryable`.

## Planning Stage
The planning stage converts the user request into a task contract.

Required outputs:

- stable task id
- purpose
- allowed context
- forbidden context
- files or resources allowed to change
- files or resources excluded from change
- expected artifacts or item count when known
- verification requirements
- policy gates
- stop condition
- final handoff shape

Planning must not execute product behavior or mutate source unless the task is
explicitly a planning artifact write. Broad repository scans are not allowed by
default.

## Inventory Stage
The inventory stage enumerates the work that must be completed before execution
is considered eligible for completion.

Inventory may include files, URLs, records, generated artifacts, tests, review
targets, migration steps, or other subtasks. For crawling or discovery-driven
jobs, inventory is not optional: newly discovered subtasks must be recorded
before AEOS can calculate coverage.

Inventory output should include:

- expected item ids
- source of discovery
- dependency or ordering hints
- required verification per item
- retry policy hints
- explicit unknowns or blockers

## Chunking Stage
The chunking stage groups work items into small, bounded batches. A batch should
fit the configured agent, context window, tool budget, policy permissions, and
verification strategy.

Chunking must preserve item identity. AEOS should be able to resume from the
last known item state without trusting the agent to remember prior progress.

## Execution Stage
The execution stage invokes agent adapters or tool adapters against approved
batches.

Execution must:

- provide only approved context and scope
- pass policy and audit context to adapters
- record item state transitions
- capture changed artifacts and concise output summaries
- normalize partial, blocked, unsupported, timeout, and failed outcomes
- avoid direct memory writes by agents
- avoid treating the agent handoff as final acceptance

## Verification Stage
The verification stage compares actual outcomes against the task contract,
inventory, work item states, expected artifacts, and policy/audit evidence.

Verification may include existence checks, format checks, static checks, unit
tests, smoke tests, security checks, coverage checks, artifact checks, and manual
approval checks. Required checks must pass or be explicitly skipped by scope.
Failed or blocked required checks prevent completion.

## Audit Stage
The audit stage records compact evidence for important actions and decisions.
Audit logs should be append-only JSON Lines by default and must not store raw
secrets, full prompts, full model outputs, broad tool logs, or raw file contents.

Required audit evidence includes task start and completion, agent invocation
boundaries, policy decisions, tool outcomes, work item state changes, file or
artifact changes, verification runs, failures, approvals, denials, and retry
decisions.

## Resume / Retry Stage
Resume uses persisted task state, work item state, batch state, verification
state, and audit evidence. It does not ask the model what remains.

On resume, AEOS should:

- reload the task contract
- reload inventory and work item state
- identify `pending`, `retryable`, `failed`, and unverified items
- rebuild batches only for remaining eligible work
- preserve prior audit correlation
- avoid rerunning verified items unless explicitly requested
- report what was resumed and why

Retries require explicit retryability. Non-retryable failures remain failed until
the task contract, policy approval, input, or environment changes.

## Failure Handling
Failures must be typed and explicit:

- `scope_failure`: requested work exceeds the task contract.
- `policy_failure`: policy denies or approval is missing.
- `execution_failure`: an agent or tool fails a work item.
- `verification_failure`: output does not satisfy required checks.
- `coverage_failure`: not all expected work is accounted for.
- `artifact_failure`: expected artifacts are missing or invalid.
- `adapter_failure`: adapter returns failed, unsupported, timeout, or invalid
  output.
- `audit_failure`: required evidence cannot be recorded.

AEOS should prefer `blocked` over `failed` when a human decision or missing
input can unblock the task without changing implementation.

## Coverage Requirements
Coverage is the external accounting of work. It is calculated from inventory,
work item states, expected artifacts, and verifier results.

Coverage must track:

- expected item count
- completed item count
- verified item count
- explicitly failed item count
- explicitly skipped item count
- pending item count
- retryable item count
- expected artifact count
- verified artifact count
- discovered but not inventoried subtasks

## Completion Rules
AEOS may mark a task `completed` only when all required completion rules pass,
required verification is `pass` or explicitly `skipped`, policy gates have valid
decisions, and audit evidence exists.

Examples:

Item-based jobs:

```text
expected_items == completed_items + explicitly_failed_items + explicitly_skipped_items
```

File-generation jobs:

```text
expected_artifacts must match verified_artifacts
```

Crawling jobs:

```text
discovered_urls/subtasks must be inventoried before completion
```

Completion is invalid when work is merely unmentioned. Pending, unknown, or
uninventoried work prevents successful completion.

## Sitemap Coverage Example
A root sitemap contains 400 sub-sitemaps. An agent processes only 20 and reports
success.

AEOS must mark the task incomplete because coverage is 20/400. The remaining
380 sub-sitemaps stay `pending` or `retryable`, depending on whether they were
never attempted or were interrupted. The verifier reports the coverage gap, and
the task state becomes `blocked`, `failed`, or `running` with resumable work
remaining based on the configured retry policy.

## Policy Gates
Policy gates run before risky or state-changing actions.

Gates apply to:

- broad context loading
- filesystem writes
- shell commands
- dependency changes
- Git writes
- migrations
- deployments
- network side effects
- secret access
- memory writes
- MCP or tool adapter calls with side effects

Denied actions do not run. Approval-required actions wait for scoped human
approval and must not be treated as approved because a model asked for them.

## Permission Boundaries
Permissions are task-scoped and action-scoped. Agents receive only the context,
files, tools, and approvals needed for the current batch.

Default safe permissions may allow explicit local reads, explicit safe writes,
and bounded shell reads. Destructive actions, dependency changes, deployments,
migrations, Git pushes, secret access, broad filesystem operations, and external
side effects require explicit policy decisions and usually human approval.

## Model / Tool Adapter Boundaries
Model adapters generate or transform structured outputs. They do not mutate
repositories, execute tools, write memory, or approve risky actions.

Agent adapters run scoped tasks and return normalized claims, changed resources,
and errors. They do not decide final acceptance.

Tool and MCP adapters execute approved capabilities with declared intent,
scope, side effects, normalized result status, and audit metadata. Tools are not
policy authorities.

Verifier adapters determine whether work satisfies declared requirements. Audit
adapters record evidence. Memory adapters write only verified, policy-allowed,
redacted entries.

## Human Approval Points
Human approval may be required:

- before transitioning from `planned` to `approved`
- before destructive or irreversible actions
- before dependency changes
- before deployments, migrations, or Git pushes
- before secret access
- before broad context or filesystem access
- before accepting manual-only verification
- before cancelling or explicitly skipping required work

Approval is scoped and auditable. It does not grant general autonomous authority.

## CLI Command Surface
Future lifecycle commands:

```sh
aeos task plan
aeos task run
aeos task status
aeos task verify
aeos task resume
aeos agent run
aeos audit
aeos audit --json
```

These commands are future design targets only. This document does not implement
them.

## JSON Output Shape
Future JSON output should be a single object with stable top-level fields:

```json
{
  "ok": true,
  "taskId": "...",
  "state": "...",
  "coverage": {},
  "workItems": {},
  "verification": {},
  "audit": {},
  "issues": []
}
```

Failures should keep the same shape where possible, set `ok` to `false`, report
the task state, and include normalized issues with codes and retryability.

## MVP Scope
MVP lifecycle scope:

- local task contracts
- local state files or records
- deterministic inventory for explicitly declared work
- work item and task state transitions
- local batch planning
- agent adapter execution boundary
- policy prechecks for risky actions
- verifier coverage and artifact checks
- append-only local audit events
- resume from persisted state
- compact human and JSON status output concepts

The MVP should stay local-first and should not overpromise full autonomy.

## Later Scope
Later versions may add richer multi-agent scheduling, external queues, signed
audit chains, remote execution, organization policy profiles, advanced crawler
inventory, cross-repository work graphs, external audit sinks, cost budgets,
timeout budgets, richer retry strategies, and UI status dashboards.

## Non-Goals
- Implement lifecycle code in this task.
- Implement CLI commands in this task.
- Add package dependencies.
- Replace Git, CI, testing, or human review.
- Let agents approve their own risky actions.
- Treat model self-reporting as completion evidence.
- Store raw conversations, secrets, prompts, model outputs, or broad tool logs
  as durable proof.
- Provide unbounded autonomous execution.

## Safety Boundaries
AEOS must fail closed when scope, policy, audit, or verification evidence is
missing. It must preserve unrelated user changes, avoid hidden side effects,
redact sensitive values, and make partial completion visible.

Skipped work must be explicit and reasoned. Failed work must stay visible.
Uninventoried discovered work must prevent completion until inventoried and
accounted for.

## Smoke Test Requirements
Future implementation smoke tests should verify:

- a lifecycle design document exists
- task contracts produce planned task state
- work items can move through pending, in_progress, completed, and verified
- failed and retryable items prevent false completion
- coverage verifier rejects partial item completion
- file artifact verifier rejects missing expected artifacts
- crawling verifier rejects discovered but uninventoried subtasks
- policy-denied actions do not run
- audit events are recorded for task, policy, execution, and verification
- resume selects only pending or retryable work
- JSON output contains `ok`, `taskId`, `state`, `coverage`, `workItems`,
  `verification`, `audit`, and `issues`

## Implementation Sequence
1. TASK-0186: Implement agentic task lifecycle contracts.
   Purpose: Add core lifecycle types for task state, work item state, coverage,
   verification summary, audit references, and issues.
   Likely files: packages/core lifecycle contract files and focused examples.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: Medium.
   Classification: Code.
2. TASK-0187: Add lifecycle contract examples.
   Purpose: Provide deterministic example fixtures for task, work item,
   coverage, and JSON result shapes.
   Likely files: packages/core lifecycle examples.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: Low.
   Classification: Code.
3. TASK-0188: Implement task state transition validator.
   Purpose: Reject invalid task state transitions and preserve blocked, failed,
   cancelled, verified, and completed semantics.
   Likely files: packages/core lifecycle state helpers.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: Medium.
   Classification: Code.
4. TASK-0189: Implement work item state transition validator.
   Purpose: Validate pending, in_progress, completed, failed, skipped,
   retryable, and verified item transitions.
   Likely files: packages/core lifecycle work item helpers.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: Medium.
   Classification: Code.
5. TASK-0190: Implement lifecycle issue shapes.
   Purpose: Normalize scope, policy, execution, verification, coverage,
   artifact, adapter, and audit failures.
   Likely files: packages/core lifecycle issue files.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: Low.
   Classification: Code.
6. TASK-0191: Implement lifecycle JSON result builder.
   Purpose: Produce stable lifecycle JSON with ok, taskId, state, coverage,
   workItems, verification, audit, and issues.
   Likely files: packages/core lifecycle result builder.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: Medium.
   Classification: Code.
7. TASK-0192: Implement basic inventory contract.
   Purpose: Represent expected items, discovered items, inventory source,
   dependencies, and unknowns without crawling implementation.
   Likely files: packages/core or packages/projects inventory contracts.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: Medium.
   Classification: Code.
8. TASK-0193: Add inventory examples.
   Purpose: Add examples for item-based, file-generation, and sitemap-style
   inventory.
   Likely files: packages/core or packages/projects inventory examples.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: Low.
   Classification: Code.
9. TASK-0194: Implement batch planning contract.
   Purpose: Group work items into bounded batches while preserving item ids and
   retry metadata.
   Likely files: packages/core lifecycle batch planner contracts.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: Medium.
   Classification: Code.
10. TASK-0195: Implement coverage summary calculator.
    Purpose: Calculate expected, completed, verified, failed, skipped, pending,
    retryable, and artifact coverage counts.
    Likely files: packages/core lifecycle coverage helpers.
    Verification command: `pnpm --filter @aeos/core check`.
    Recommended model effort: Medium.
    Classification: Code.
11. TASK-0196: Add item completion rule checks.
    Purpose: Enforce item-based completion accounting with explicit failed and
    skipped items.
    Likely files: packages/core lifecycle completion helpers.
    Verification command: `pnpm --filter @aeos/core check`.
    Recommended model effort: Medium.
    Classification: Code.
12. TASK-0197: Add artifact completion rule checks.
    Purpose: Require expected artifacts to match verified artifacts before
    file-generation tasks complete.
    Likely files: packages/core lifecycle artifact completion helpers.
    Verification command: `pnpm --filter @aeos/core check`.
    Recommended model effort: Medium.
    Classification: Code.
13. TASK-0198: Add crawl inventory completion rule checks.
    Purpose: Prevent completion when discovered URLs or subtasks are not
    inventoried.
    Likely files: packages/core lifecycle crawl coverage helpers.
    Verification command: `pnpm --filter @aeos/core check`.
    Recommended model effort: Medium.
    Classification: Code.
14. TASK-0199: Implement lifecycle verifier summary adapter boundary.
    Purpose: Connect lifecycle completion checks to verifier result shapes
    without implementing a full verifier runtime.
    Likely files: packages/core and packages/verifier contracts.
    Verification command: `pnpm --filter @aeos/core check`.
    Recommended model effort: High.
    Classification: Code.
15. TASK-0200: Implement lifecycle audit reference contract.
    Purpose: Link task, work item, policy, execution, retry, and verification
    events to audit event ids.
    Likely files: packages/core lifecycle audit contract files.
    Verification command: `pnpm --filter @aeos/core check`.
    Recommended model effort: Medium.
    Classification: Code.
16. TASK-0201: Add lifecycle resume selector.
    Purpose: Select pending and retryable work for resume while excluding
    verified work.
    Likely files: packages/core lifecycle resume helpers.
    Verification command: `pnpm --filter @aeos/core check`.
    Recommended model effort: Medium.
    Classification: Code.
17. TASK-0202: Design lifecycle CLI command behavior.
    Purpose: Document human and JSON behavior for `aeos task plan`, `run`,
    `status`, `verify`, `resume`, `agent run`, and audit JSON output before CLI
    implementation.
    Likely files: docs/AGENTIC_TASK_LIFECYCLE_CLI_DESIGN.md and
    docs/CLI_COMMAND_MAP.md.
    Verification command: `git status --short`.
    Recommended model effort: Medium.
    Classification: Docs.
18. TASK-0203: Add lifecycle smoke review.
    Purpose: Review the lifecycle contracts, examples, and docs for false
    completion risks and missing verification coverage.
    Likely files: docs/AGENTIC_TASK_LIFECYCLE_DESIGN.md and TASKS/backlog.md.
    Verification command: `git status --short`.
    Recommended model effort: Medium.
    Classification: Docs.
