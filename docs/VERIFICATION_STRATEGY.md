# AEOS Verification Strategy

## Purpose
Define how AEOS verifies documentation, scaffolds, code, generated files, CLI
behavior, adapters, memory writes, tools, and policy-sensitive operations before
work is marked complete.
## Core Principle
AEOS must verify required outputs before completion. Required verification must
either pass, fail with evidence, be blocked with a reason, or be explicitly
skipped by task scope.
Memory is successful only after task output and proposed memory entry pass
verification, redaction, policy, and audit checks.
## Verification Goals
Confirm requested outputs exist and match task scope; excluded files were not
touched; generated files match expected structure; code, CLI, adapters, and
tools satisfy declared contracts; risky operations are policy-checked before
execution; outcomes are auditable; and evidence is compact enough for handoff.
## Verification Levels
```ts
type VerificationLevel =
  | "none"
  | "existence_check"
  | "format_check"
  | "static_check"
  | "unit_test"
  | "integration_test"
  | "smoke_test"
  | "security_check"
  | "manual_approval_required";
```

- `none`: no automated check is required; record the reason.
- `existence_check`: required files, directories, outputs, or records exist.
- `format_check`: structured content follows the expected schema or template.
- `static_check`: local validation without executing product behavior.
- `unit_test`: isolated behavior is tested with controlled inputs.
- `integration_test`: multiple AEOS boundaries are tested together.
- `smoke_test`: minimal end-to-end behavior is checked.
- `security_check`: policy, permission, secret, and redaction rules are checked.
- `manual_approval_required`: execution is blocked until scoped human approval.

## Documentation Verification
Documentation tasks should verify only the requested documents and loaded
context. Checks should confirm the target document exists, required sections are
present, terminology matches loaded context, excluded files were not modified,
and the document does not claim implementation that does not exist.

Typical levels: `existence_check`, `format_check`, `static_check`.

## Scaffold Verification
Scaffold tasks create planned files, templates, config, or generated artifacts
without implementing runtime behavior. Checks should confirm requested paths
exist, unexpected directories or packages were not created, generated files
match the requested shape, and placeholders are explicit.

Typical levels: `existence_check`, `format_check`, `static_check`.

## Code Verification
Code tasks require verification proportional to risk and package boundary.
Checks should confirm modified files are in scope, package public API boundaries
are respected, static validation passes when available, relevant tests pass when
available, and skipped or failed tests are reported with impact.

Shared orchestration, policy, memory, tool, adapter, or verifier code requires
stronger evidence than isolated presentation changes.

## CLI Verification
CLI verification confirms operator-facing commands parse inputs, call package
APIs, and return compact handoff output. Checks should confirm command inputs map
to declared operations, output includes status and verification result, CLI code
does not own core orchestration or policy behavior, and risky operations are
policy-checked and audit-logged before execution.

Future CLI work commonly needs `static_check`, `unit_test`, and `smoke_test`.

## Adapter Verification
Adapter verification confirms external behavior is normalized behind AEOS
interfaces. Checks should confirm AEOS-owned input and output shapes, no provider
or tool-specific type leakage into core APIs, normalized errors, declared side
effects, and policy decisions before risky adapter actions.

Adapter changes may require `unit_test`, `integration_test`, and
`security_check`.

## Tool / MCP Verification
Tool and MCP verification confirms capabilities run only through AEOS tool
adapters and policy gates. Checks should confirm tool intent, scope, expected
side effects, pre-execution policy decisions, normalized result status, affected
resources, exit code when available, concise output summary, and that denied
tools do not run.

Raw secrets, broad logs, hidden side effects, and uncontrolled MCP execution are
verification failures.

## Memory Verification
Memory verification happens before memory persistence is marked successful.
Checks should confirm entry type, source evidence, project or task scope,
redaction of secrets, policy allowance, and audit records for successful or
rejected writes.

A proposed memory write can be `blocked` even when the task output passed.

## Policy Verification
Policy verification confirms risky operations are classified and gated before
execution. Checks should confirm proposed actions include risk class, permission
level, scope, intent, expected side effects, approval state, and reason.

Denied actions must not run. Approval-required actions must not run until
approved for the specific scope. Agents, adapters, and MCP tools cannot approve
their own risky actions.

## Audit Verification
Audit verification confirms significant decisions and outcomes are recorded in a
small, redacted, provider-independent format. Checks should confirm policy
decisions are logged before action execution, verification runs and failures are
logged, memory writes and rejected writes are logged, tool outcomes are logged
when relevant, and evidence uses safe summaries instead of raw secrets, prompts,
file contents, or full tool output.

## Pre-Execution Checks
Before work begins, AEOS should verify task id, task scope, allowed context
files, modifiable files, excluded paths, planned policy classifications, planned
verification checks, and audit correlation id.

If required pre-execution checks fail, the task is `blocked`.

## Post-Execution Checks
Before completion, AEOS should verify requested files were created or modified,
unrelated files were not modified by AEOS, required checks passed or have
recorded skip/block reasons, policy-sensitive actions have policy and audit
evidence, memory writes passed verification before being marked successful, and
the final handoff includes status, changed files, verification result, problems,
and next suggested task.

## Pass / Fail / Blocked States
```ts
type VerificationStatus = "pass" | "fail" | "blocked" | "skipped";
```

- `pass`: required checks succeeded.
- `fail`: a check ran and found a defect.
- `blocked`: a required check could not run due to scope, approval, dependency,
  environment, or missing input.
- `skipped`: a check was not required or was excluded by task scope.

A task may complete only when required checks pass or are explicitly skipped by
scope. Failed or blocked required checks prevent successful completion.

## Verification Report Format
A verification report should include task id, checked scope, checks run, status
for each check, evidence summary, failed or blocked reason, policy decisions and
approval state when relevant, audit references when available, memory write
status when relevant, and final verification result.

## Verification Result Interfaces
```ts
interface VerificationPlan {
  id: string; taskId: string; scope: string[];
  requiredChecks: VerificationCheck[]; optionalChecks?: VerificationCheck[];
  policyRequired: boolean; auditRequired: boolean;
}

interface VerificationCheck {
  id: string; name: string; level: VerificationLevel; target: string[];
  required: boolean; expectedEvidence: string[];
  blockedByApproval?: boolean;
}

interface VerificationRun {
  id: string; planId: string; taskId: string; actor: string;
  startedAt: string; completedAt?: string;
  results: VerificationResult[];
  auditEventIds?: string[];
}

interface VerificationResult {
  checkId: string; level: VerificationLevel; status: VerificationStatus;
  summary: string; evidence?: string[]; affectedPaths?: string[];
  exitCode?: number; errorCode?: string;
  policyDecisionId?: string; auditEventId?: string;
}

interface VerificationReport {
  taskId: string; status: VerificationStatus; checkedScope: string[];
  passed: string[]; failed: string[]; blocked: string[]; skipped: string[];
  evidenceSummary: string; policySummary?: string; auditSummary?: string;
  memoryWriteStatus?: "not_applicable" | "verified" | "failed" | "blocked";
}
```

## Examples
Documentation-only task:
```ts
{ taskId: "TASK-DOCS", checks: ["existence_check", "format_check", "static_check"],
  result: "pass", evidence: ["target exists", "sections present", "no excluded edits"] }
```

Memory template task:
```ts
{ taskId: "TASK-MEMORY-TEMPLATE", checks: ["existence_check", "format_check", "security_check"],
  result: "pass", memoryWriteStatus: "verified", evidence: ["template exists", "no secrets"] }
```

Future CLI command task:
```ts
{ taskId: "TASK-CLI", checks: ["static_check", "unit_test", "smoke_test"], result: "blocked",
  evidence: ["CLI contract reviewed"], blocked: ["CLI runtime does not exist yet"] }
```

Denied risky operation:
```ts
{ taskId: "TASK-RISKY", checks: ["security_check", "manual_approval_required"], result: "blocked",
  policyDecision: "deny", evidence: ["destructive action outside scope", "audit recorded", "not run"] }
```

Failed test run:
```ts
{ taskId: "TASK-CODE", checks: ["unit_test"], result: "fail",
  evidence: ["targeted test exited nonzero"], failed: ["adapter normalization mismatch"] }
```

## MVP Verification Set
The MVP should support task and file scope checks, documentation and scaffold
existence checks, required section and format checks, policy checks for risky
actions, tool result normalization checks, memory verification-before-write,
audit records for verification runs and failures, and compact handoff reports.

## Later Verification Set
Later versions may add richer package test orchestration, adapter contract test
suites, policy simulation, dry-run verification, external audit sink checks,
cross-repository verification, performance checks, reliability checks, and
organization-specific verification profiles.

## Non-goals
- Implement verifier package source code.
- Choose a test runner, runtime, framework, or package manager.
- Define concrete CLI commands that do not exist yet.
- Replace policy, audit, task, adapter, or memory contracts.
- Store raw prompts, model outputs, secrets, file contents, or full tool logs as verification evidence.
- Mark memory successful before verification and policy checks pass.
