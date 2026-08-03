# Agentic Coverage Verifier Design

## Purpose

Design the AEOS agentic coverage verifier.

The verifier determines whether agentic work is actually complete by checking
inventory, work item states, artifact coverage, verification snapshots, audit
evidence, and explicit completion rules.

This document is design-only. It does not implement verifier code, CLI commands,
agent runner behavior, storage, or package APIs.

## Why Coverage Verification Is Needed

Agentic work can stop early while the model reports success. AEOS needs an
external verifier that proves the requested scope is accounted for before task
state can advance to `completed`.

Coverage verification is needed when work is item-based, artifact-based,
batch-based, discovery-driven, resumable, retryable, or audited. It prevents
cases where a task is marked complete after only part of the inventory ran, a
generated artifact is missing, batch counters disagree with item states, or
audit evidence is absent for completed work.

## Current Agentic Lifecycle Foundation Status

AEOS already has a conservative lifecycle foundation:

- `docs/AGENTIC_TASK_LIFECYCLE_DESIGN.md` defines inventory, work items,
  batches, verification, audit, resume, failure handling, coverage requirements,
  and completion rules.
- `docs/VERIFICATION_STRATEGY.md` defines verification statuses, evidence,
  checks, reports, and required pass/fail/blocked/skipped behavior.
- `docs/AUDIT_LOG_FORMAT.md` defines compact audit events for task, agent, tool,
  policy, file, verification, memory, approval, and error activity.
- `docs/POLICY_PERMISSION_MODEL.md` defines task-scoped permissions and risky
  action boundaries.
- `docs/TASK_CONTRACT.md` defines isolated task inputs, allowed context, file
  boundaries, verification, stop conditions, and handoff output.
- `packages/core/src/agentic-lifecycle.ts` already defines lifecycle types for
  inventory status, work item state, batch counts, coverage rules, artifact
  coverage, verification snapshots, audit references, resume cursors, and
  lifecycle results.
- `packages/core/src/agentic-lifecycle.example.ts` already includes sitemap,
  incomplete coverage, complete item accounting, missing artifact, and resume
  examples.
- `packages/core/src/verification.ts`, `packages/core/src/audit.ts`, and
  `packages/core/src/tasks.ts` define adjacent verification, audit, and task
  contract shapes.

The next step is to add deterministic verifier contracts before implementing
runtime logic.

## Verifier Principles

Model-reported completion is not trusted.

Only AEOS state, coverage counts, verified artifacts, and explicit
failures/skips can prove completion.

The verifier should be:

- deterministic: same persisted state produces the same result;
- local-first: works from local lifecycle state and local evidence;
- auditable: every failure, skip, blocked check, and completion decision can be
  traced to structured evidence;
- conservative: unknown or contradictory state prevents completion;
- scope-bound: verifier decisions are limited to the task contract and known
  lifecycle state;
- side-effect free for MVP: verification reads state and reports results; it
  does not execute agents, mutate packages, or repair work.

## Inputs

Primary inputs:

- task id and task contract
- lifecycle task state
- inventory source, expected item count, discovered item count, and inventory
  status
- work item ids, states, expected artifacts, issues, dependencies, and batch ids
- batch ids, member ids, expected counts, completed counts, failed counts,
  skipped counts, and retryable counts
- coverage summary and coverage rules
- artifact coverage manifest
- verification snapshot and verification report references
- audit event references
- resume cursor
- lifecycle issues

Optional later inputs:

- policy decisions for required approval or denial checks
- persisted audit query results
- artifact manifest checksums
- filesystem existence checks for local artifacts
- previous verifier run history

## Outputs

The verifier should produce a compact result that can be rendered for humans,
returned as JSON, recorded in audit, and used by task status or resume flows.

Core output fields:

- `ok`: `true` only when completion rules are satisfied
- `taskId`
- status such as `satisfied`, `incomplete`, `failed`, `blocked`, or `unknown`
- normalized coverage counts
- missing work item ids
- retryable work item ids
- missing artifact paths
- invalid batch ids
- audit consistency issues
- verification snapshot status
- lifecycle transition recommendation
- concise issues with codes, categories, severity, and retryability

The verifier may recommend `verified`, `running`, `blocked`, or `failed`, but
only a lifecycle transition layer should mutate task state.

## Item-Based Coverage Verification

Item-based verification compares inventory totals with terminal item accounting.
The required MVP rule is:

```text
expected_items == completed_items + explicitly_failed_items + explicitly_skipped_items
```

For this rule:

- `completed_items` includes work that reached `completed` or `verified` when
  the task contract accepts completed work as terminal.
- `explicitly_failed_items` includes only items in `failed` with a recorded issue
  or reason.
- `explicitly_skipped_items` includes only items in `skipped` with a recorded
  reason.
- `pending`, `in_progress`, `retryable`, and unknown items do not count as
  terminal completion.
- missing item ids or duplicate item ids are coverage failures.

Valid examples:

- all expected items are completed;
- completed plus explicit failed/skipped items equal the expected count;
- retryable items are later resolved or explicitly failed/skipped.

Invalid examples:

- expected 400, completed 20, remaining 380;
- inventory says 400 expected items but only 20 item ids exist;
- item states imply 20 completed while coverage reports 400 completed;
- an item is marked skipped without a reason;
- a retryable item is counted as completed.

## Artifact-Based Coverage Verification

Artifact verification checks that every expected artifact is verified by a
required verification result or artifact coverage entry.

MVP rule:

```text
expected_artifacts == verified_artifacts
```

The verifier should detect:

- expected artifacts missing from verified artifacts;
- artifacts listed as verified but not expected;
- artifact paths attached to work items that are not terminal;
- missing verification evidence for generated artifacts;
- failed or blocked required artifact checks.

Valid example:

- all expected artifacts are verified.

Invalid example:

- expected artifacts 5, verified artifacts 4, missing 1.

Extra artifacts should be reported. They should not satisfy missing expected
artifacts.

## Batch Coverage Verification

Batch verification checks that batch counters agree with work item states and
inventory scope.

The verifier should check:

- each batch references known work item ids;
- each work item belongs to at most one batch unless the lifecycle explicitly
  allows reprocessing;
- sum of batch expected counts does not undercount known expected items;
- each batch `completedCount`, `failedCount`, `skippedCount`, and
  `retryableCount` matches current work item states or is explicitly marked as a
  summarized batch;
- batch completion does not override unfinished item states;
- a completed batch with pending or retryable items is invalid.

Invalid example:

- batch completed count does not match work item states.

Batch issues should be reported as `coverage_failure` or `inventory_failure`
depending on cause.

## Inventory Completeness Verification

Inventory completeness checks that discovered scope has been fully represented
as work before completion is possible.

MVP checks:

- `inventory.status` must be `complete` for completion;
- `expectedItemCount` must be known and non-negative;
- `discoveredItemCount` must not exceed inventoried items without a recorded
  `discoveredButNotInventoriedCount`;
- `discovered_items == inventoried_items` must pass when the
  `inventory_completion` rule is required;
- discovered but not inventoried subtasks prevent `completed`.

Invalid example:

- inventory incomplete but task marked completed.

For discovery-driven work, completion requires recording newly found work before
running item and artifact coverage rules.

## Resume / Retry Verification

Resume verification determines what can continue without asking the model what
remains.

The verifier should:

- identify `pending`, `retryable`, and unverified work items;
- preserve completed or verified items unless retry is explicitly requested;
- ensure retryable items have retryable issues or attempts;
- require non-retryable failures to be explicit terminal failures before
  completion;
- ensure resume cursor ids reference known pending or retryable items;
- report stale resume cursors when remaining ids do not match lifecycle state.

Valid example:

- retryable items resolved or explicitly failed/skipped.

Incomplete work should remain resumable when no hard failure prevents progress.

## Audit Consistency Verification

Audit consistency checks that lifecycle claims are supported by compact audit
evidence.

MVP checks:

- completed tasks require task start, verification, and completion audit
  references when audit is required;
- completed work items require state transition or execution evidence when such
  events are available in the lifecycle;
- failed, skipped, blocked, and retryable outcomes require issue or audit
  reasons;
- verification snapshots should reference verification audit events when audit
  is required;
- audit event ids must not be empty placeholders for completed work.

Invalid example:

- audit events missing for completed work.

Audit absence should be `blocked` when the sink is unavailable and
`audit_failure` when required evidence is missing or contradictory.

## Failure Handling

Verifier failures should be typed with existing lifecycle issue categories:

- `coverage_failure`: item counts, artifact counts, or completion rules fail.
- `artifact_failure`: expected artifacts are missing or invalid.
- `inventory_failure`: discovered work is not fully inventoried.
- `verification_failure`: verification snapshots or reports fail.
- `audit_failure`: required audit evidence is missing or inconsistent.
- `resume_failure`: resume cursor is stale, missing, or contradictory.
- `policy_failure`: completion depends on denied or missing policy approval.
- `unknown`: state is insufficient to determine a safe result.

The verifier should prefer `incomplete` for work that can continue and `blocked`
for missing approvals, missing input, unavailable audit sinks, or unavailable
verification evidence. It should use `failed` when required completion rules
cannot pass without changing the task state or artifacts.

## Incomplete Coverage Handling

Incomplete coverage is not a successful completion state.

When coverage is incomplete, the verifier should:

- return `ok: false`;
- set status to `incomplete` unless a harder failure or blocker applies;
- list missing or remaining item ids when known;
- list missing artifacts when known;
- preserve pending and retryable work for resume;
- prevent lifecycle state from becoming `completed`;
- include concise issues that explain the failed completion rule.

Incomplete does not mean the task failed permanently. It means AEOS does not yet
have enough terminal work accounting to complete the task.

## Explicit Skipped / Failed Item Handling

Skipped and failed items can count toward item accounting only when explicit.

An explicit skipped item should include:

- item id;
- state `skipped`;
- skip reason or issue;
- whether the skip is allowed by task scope;
- audit reference when audit is required.

An explicit failed item should include:

- item id;
- state `failed`;
- failure issue;
- retryability status;
- audit or verification reference when required.

Skipped or failed items without reasons are invalid for completion accounting.
Retryable items are not explicit failures until they are changed to `failed`
with a reason.

## JSON Output Concept

Future JSON output should be stable, compact, and deterministic:

```json
{
  "ok": false,
  "taskId": "...",
  "status": "incomplete",
  "coverage": {},
  "missingItems": [],
  "missingArtifacts": [],
  "issues": []
}
```

Expanded MVP JSON may include:

- `inventoryStatus`
- `verificationStatus`
- `auditStatus`
- `resume`
- `invalidBatches`
- `transition`
- `generatedAt`

The JSON shape should not include raw prompts, full model output, raw command
logs, secrets, or broad file contents.

## CLI Integration

Future CLI surface:

```text
aeos task verify
aeos task verify --json
aeos task status
aeos task resume
```

Do not implement these commands as part of this design.

Expected CLI behavior:

- `aeos task verify` renders a compact human verifier report.
- `aeos task verify --json` renders the structured verifier result.
- `aeos task status` includes verifier-derived lifecycle status and remaining
  work summary.
- `aeos task resume` uses verifier output and resume cursor state to select
  pending or retryable work.

CLI code should call core contracts and verifier helpers. CLI code should not
own completion logic.

## Agent Runner Integration

The agent runner should treat agent output as a claim, not completion proof.

Expected integration:

- runner records execution attempts and work item state transitions;
- runner records artifact claims and changed artifact paths;
- runner records verification snapshots after required checks;
- runner calls the coverage verifier after a batch or task claim;
- runner blocks `completed` transition when verifier returns `ok: false`;
- runner preserves resume cursor state for remaining pending and retryable work.

The runner must not ask the model to decide whether all inventory is complete.
It may ask the model to continue work selected by AEOS state.

## Policy Boundary

The verifier is not a policy authority.

It may require evidence that policy decisions exist for risky or gated work, but
it must not approve actions, execute denied actions, deploy, install
dependencies, mutate Git, read secrets, or expand task scope.

MVP verifier behavior should be read-only against lifecycle state. Any future
filesystem artifact existence check must remain task-scoped and audit-aware.

## MVP Scope

MVP should include:

- core verifier result contracts;
- deterministic item accounting;
- deterministic artifact accounting from provided artifact coverage;
- inventory completeness checks;
- batch count consistency checks;
- resume cursor consistency checks;
- verification snapshot consistency checks;
- audit reference presence checks;
- invalid completion detection;
- compact issue generation;
- examples for valid completion, incomplete sitemap, missing artifact, failed or
  skipped items, and stale resume cursor;
- smoke tests over pure local data.

## Later Scope

Later versions may add:

- filesystem-backed artifact existence checks;
- audit sink querying;
- policy decision querying;
- historical verifier run comparison;
- signed or hash-linked audit chains;
- large inventory pagination;
- partial manual approval workflows;
- cross-repository work item coverage;
- adapter-specific evidence normalization;
- richer resume planning;
- organization-specific completion rules.

## Non-Goals

- Implement verifier runtime code in this design task.
- Implement CLI commands.
- Add dependencies.
- Modify package files.
- Deploy or publish anything.
- Trust model self-reporting as completion proof.
- Replace task, policy, audit, verification, or lifecycle contracts.
- Prove quality beyond declared task scope.
- Overpromise autonomous execution without external state and evidence.

## Completion Examples

Valid completion examples:

- all items completed;
- items completed plus explicit failed/skipped items equal expected count;
- all expected artifacts verified;
- retryable items resolved or explicitly failed/skipped.

Invalid completion examples:

- expected 400, completed 20, remaining 380;
- expected artifacts 5, verified artifacts 4, missing 1;
- inventory incomplete but task marked completed;
- batch completed count does not match work item states;
- audit events missing for completed work.

## Sitemap Example

A sitemap crawler task starts with a root sitemap that has 400 sub-sitemaps.
Inventory records `expectedItemCount: 400` and creates or references work items
for the known sitemap scope.

An agent processes 20 sub-sitemaps and reports completion.

The verifier checks:

```text
expected_items == completed_items + explicitly_failed_items + explicitly_skipped_items
400 == 20 + 0 + 0
```

The rule fails. The verifier returns failed or incomplete with `ok: false`.
The remaining 380 items stay `pending` or `retryable`, the resume cursor points
to the next pending batch, and lifecycle state cannot become `completed`.

The correct next action is resume or retry, not completion.

## Smoke Test Requirements

Smoke tests for the MVP verifier should use deterministic local fixtures and
must not execute agents or CLI commands beyond the package check command.

Required smoke scenarios:

- complete item accounting passes;
- completed plus explicit failed/skipped item accounting passes;
- expected 400 and completed 20 returns incomplete;
- missing artifact returns failed;
- inventory incomplete blocks completion;
- batch count mismatch returns a coverage issue;
- missing audit evidence prevents completed state when audit is required;
- retryable items keep task resumable and incomplete;
- stale resume cursor returns a resume issue;
- JSON output remains stable for a representative failed result.

## Implementation Sequence

1. TASK-0190: Implement agentic coverage verifier contracts.
   Purpose: Add core result, input, rule, issue, and status contracts for the
   coverage verifier.
   Likely files: `packages/core/src/agentic-coverage-verifier.ts`,
   `packages/core/src/index.ts`.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: Medium.
   Classification: Code.

2. TASK-0191: Add agentic coverage verifier contract examples.
   Purpose: Provide deterministic examples for satisfied, incomplete, failed,
   blocked, and resumable verifier results.
   Likely files: `packages/core/src/agentic-coverage-verifier.example.ts`.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: Low.
   Classification: Code.

3. TASK-0192: Implement item coverage accounting helper.
   Purpose: Calculate expected, completed, failed, skipped, pending, retryable,
   and verified item counts from lifecycle work items.
   Likely files: `packages/core/src/agentic-coverage-verifier.ts`.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: Medium.
   Classification: Code.

4. TASK-0193: Add item coverage accounting examples.
   Purpose: Cover all-complete, failed/skipped terminal accounting, incomplete,
   duplicate id, and retryable item scenarios.
   Likely files: `packages/core/src/agentic-coverage-verifier.example.ts`.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: Low.
   Classification: Code.

5. TASK-0194: Implement artifact coverage accounting helper.
   Purpose: Compare expected and verified artifact sets and report missing or
   extra artifacts without reading the filesystem.
   Likely files: `packages/core/src/agentic-coverage-verifier.ts`.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: Medium.
   Classification: Code.

6. TASK-0195: Add artifact coverage examples.
   Purpose: Cover all artifacts verified, missing artifact, extra artifact, and
   artifact attached to unfinished work item scenarios.
   Likely files: `packages/core/src/agentic-coverage-verifier.example.ts`.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: Low.
   Classification: Code.

7. TASK-0196: Implement inventory completeness checks.
   Purpose: Validate complete inventory status, discovered versus inventoried
   counts, and discovered-but-not-inventoried handling.
   Likely files: `packages/core/src/agentic-coverage-verifier.ts`.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: Medium.
   Classification: Code.

8. TASK-0197: Implement batch consistency checks.
   Purpose: Detect unknown item references, duplicate batch membership, and
   batch count mismatches against work item states.
   Likely files: `packages/core/src/agentic-coverage-verifier.ts`.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: Medium.
   Classification: Code.

9. TASK-0198: Implement resume cursor consistency checks.
   Purpose: Validate remaining and retryable resume ids against current work
   item states and report stale cursors.
   Likely files: `packages/core/src/agentic-coverage-verifier.ts`.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: Medium.
   Classification: Code.

10. TASK-0199: Implement verification snapshot consistency checks.
    Purpose: Ensure completion decisions respect verification status, coverage
    status, required issues, and checked timestamps.
    Likely files: `packages/core/src/agentic-coverage-verifier.ts`.
    Verification command: `pnpm --filter @aeos/core check`.
    Recommended model effort: Medium.
    Classification: Code.

11. TASK-0200: Implement audit reference presence checks.
    Purpose: Require audit references for completed work when audit is required
    and report missing or empty audit evidence.
    Likely files: `packages/core/src/agentic-coverage-verifier.ts`.
    Verification command: `pnpm --filter @aeos/core check`.
    Recommended model effort: Medium.
    Classification: Code.

12. TASK-0201: Implement verifier result builder.
    Purpose: Combine item, artifact, inventory, batch, resume, verification, and
    audit findings into one deterministic result.
    Likely files: `packages/core/src/agentic-coverage-verifier.ts`.
    Verification command: `pnpm --filter @aeos/core check`.
    Recommended model effort: High.
    Classification: Code.

13. TASK-0202: Add verifier smoke tests.
    Purpose: Verify complete, incomplete sitemap, missing artifact, inventory
    incomplete, batch mismatch, audit missing, and stale resume scenarios.
    Likely files: `packages/core/src/agentic-coverage-verifier.test.ts`.
    Verification command: `pnpm --filter @aeos/core check`.
    Recommended model effort: Medium.
    Classification: Code.

14. TASK-0203: Design agentic task CLI verifier behavior.
    Purpose: Specify human and JSON output behavior for `aeos task verify`,
    `aeos task status`, and `aeos task resume` without implementing commands.
    Likely files: `docs/AGENTIC_TASK_CLI_VERIFIER_DESIGN.md`,
    `TASKS/backlog.md`, `PROJECT_CONTEXT.md`.
    Verification command: `git status --short`.
    Recommended model effort: Medium.
    Classification: Docs.

15. TASK-0204: Implement verifier JSON renderer.
    Purpose: Convert core verifier results to stable JSON suitable for future
    CLI output.
    Likely files: `packages/core/src/agentic-coverage-verifier.ts`.
    Verification command: `pnpm --filter @aeos/core check`.
    Recommended model effort: Medium.
    Classification: Code.

16. TASK-0205: Review agentic coverage verifier MVP.
    Purpose: Confirm verifier contracts, examples, tests, and documentation are
    deterministic, auditable, local-first, and do not trust model self-reporting.
    Likely files: `docs/AGENTIC_COVERAGE_VERIFIER_DESIGN.md`,
    `TASKS/backlog.md`, `PROJECT_CONTEXT.md`.
    Verification command: `git status --short`.
    Recommended model effort: Medium.
    Classification: Docs.
