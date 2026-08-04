# Agentic Coverage Verifier Usage

## Purpose
Document the current AEOS agentic coverage verifier behavior after contract
implementation, logic implementation, smoke tests, and safety hardening.

The verifier decides whether agentic work is externally accounted for. It does
not trust lifecycle state, model output, or agent self-reporting as completion
proof.

## Core Principle
Lifecycle or model self-reporting is not completion proof.

Verification is driven by coverage, inventory, work item proof, artifact proof,
batch accounting, and audit consistency. A task can only be verified when the
provided lifecycle evidence satisfies required completion rules.

## Current MVP Behavior
The MVP verifier is a deterministic, side-effect-free core helper. It accepts
provided lifecycle, inventory, work item, batch, coverage, verification snapshot,
and audit reference data, then returns a compact result.

Current behavior includes:

- item completion accounting;
- artifact coverage accounting from provided artifact data;
- batch counter consistency checks;
- inventory completeness checks;
- optional audit consistency checks;
- deterministic issue generation and status aggregation;
- smoke-tested rejection of incomplete coverage and self-reported completion.

## What It Proves
The verifier can prove that the provided task state is eligible for verified
status when:

- expected item accounting is complete;
- no pending or retryable items remain;
- expected artifacts are verified;
- batch counters agree with referenced work item states;
- inventory is complete when required;
- required audit event ids are present when audit consistency is required;
- no verifier issues remain.

## What It Does Not Prove Yet
The MVP does not prove runtime execution, filesystem existence, external audit
sink contents, CLI behavior, autonomous progress, or policy approval by itself.
It verifies only the structured evidence passed to it.

## Item Coverage Rule
The required item accounting rule is:

```text
expected_items == completed_items + explicitly_failed_items + explicitly_skipped_items
```

`completed` and `verified` work item states count as completed work. Failed and
skipped items count only when they are explicit terminal states in the provided
coverage or work item proof.

Pending, in-progress, and retryable items do not count as terminal accounting.
Any pending or retryable items prevent verified status.

## Partial Work Item Proof Hardening
Coverage counts alone are not enough when work item ids are represented.

If verifier input includes work item ids, the provided work item proof must cover
the expected inventory count. Partial proof cannot verify. For example, an input
with `expectedItemCount: 400`, only 20 work item ids, and coverage claiming 400
completed items is rejected with a work item inventory mismatch.

## Sitemap Example
A sitemap job expects 400 sub-sitemap items. An agent processes 20 and reports
completion.

```json
{
  "expected": 400,
  "completed": 20,
  "pending": 380,
  "status": "incomplete",
  "ok": false,
  "reason": "20/400 cannot be accepted as completed"
}
```

The verifier rejects completion because:

```text
400 != 20 + 0 + 0
```

The remaining 380 items stay pending or retryable for resume.

## Artifact Coverage
Artifact coverage compares expected artifacts with verified artifacts.

Tracked fields:

- expected artifacts;
- verified artifacts;
- missing artifacts;
- extra artifacts.

Missing artifacts prevent verified status. Extra artifacts are reported and do
not satisfy missing expected artifacts. By default, extra artifacts are issues
unless explicitly allowed by verifier options.

## Batch Coverage
Batch coverage checks each batch independently.

Tracked fields:

- expected batch item count;
- completed count;
- failed count;
- skipped count;
- retryable count.

When work item ids are available, batch counters must match referenced work item
states. Unknown batch items, duplicate batch membership, counter mismatches,
over-accounting, under-accounting, and referenced pending or retryable items
produce issues. Pending or retryable batch items use `batch_unfinished_items`
and prevent verified status.

## Inventory Coverage
Inventory coverage compares expected and discovered item counts.

Tracked fields:

- inventory source;
- expected item count;
- discovered item count;
- inventory complete or incomplete.

When inventory completion is required, incomplete inventory prevents verified
status. Expected/discovered mismatches and discovered-but-not-inventoried counts
also produce inventory issues.

## Audit Consistency
Audit consistency is optional unless `requireAuditConsistency` is enabled.

When required, audit consistency compares expected audit event ids from the
verification snapshot and coverage issues with observed audit event ids from
audit references. Missing required audit event ids produce audit issues and
prevent verified status.

When audit consistency is not required, missing audit expectations are treated
as optional/unknown and do not block verification.

## Status Meanings
- `verified`: all required checks passed and no issues remain.
- `incomplete`: work can continue, but coverage, inventory, artifacts, or
  accounting are not complete.
- `failed`: a non-retryable, hard, or required consistency failure prevents
  verification.
- `blocked`: reserved for required evidence or approvals that cannot currently
  be evaluated.
- `unknown`: the verifier cannot determine a safe status from the provided
  evidence.

## Result Shape Concept
The verifier result is intentionally compact and deterministic:

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

The result does not include raw prompts, full model outputs, raw command logs,
secrets, or broad file contents.

## MVP Limitations
- No runner yet.
- No CLI `aeos task verify` command yet.
- No audit runtime yet.
- No model/tool adapter execution yet.
- No filesystem IO.
- No autonomous execution.

## Later Scope
Later work may add:

- `aeos task verify`;
- `aeos task status`;
- `aeos task resume`;
- agent runner integration;
- audit runtime integration;
- policy gate integration.
