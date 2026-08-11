# AEOS Audit Log Format

## Purpose
Define the concise audit event format AEOS uses to record important actions,
policy decisions, agent activity, tool calls, verification results, memory
writes, risky operations, and errors.

## Core Principle
Audit logs provide traceability without becoming a copy of prompts, model
outputs, file contents, secrets, or raw tool logs. AEOS records actor, task,
scope, decision, action, result, and safe evidence.

## Audit Log Goals
- Trace work across agents, models, adapters, tools, memory, and verification.
- Record policy decisions, denials, approvals, outcomes, and failures.
- Keep events structured, append-only, small, redacted, portable, and provider-independent.

## What Must Be Logged
- Task start and completion.
- Agent and model invocation boundaries.
- Tool requests and execution outcomes.
- Policy checks, denials, approvals, and approval requests.
- File changes by path and concise summary.
- Verification runs and failed checks.
- Memory writes and rejected memory writes.
- Errors that affect task outcome, policy, tools, adapters, or persistence.
- Risky operations such as destructive actions, Git writes, deployments,
  migrations, dependency changes, shell writes, and secret access attempts.

## What Must Not Be Logged
- Raw secrets, tokens, keys, cookies, credentials, or signing material.
- Full prompts, model responses, file contents, or raw tool output by default.
- Broad environment dumps, private reasoning traces, repository snapshots, or sensitive values inside metadata, errors, summaries, or examples.

## Event Types
```ts
type AuditEventType =
  | "task_started" | "task_completed"
  | "agent_invoked" | "model_invoked"
  | "tool_requested" | "tool_executed"
  | "policy_checked" | "policy_denied"
  | "file_changed"
  | "verification_run" | "verification_failed"
  | "memory_written"
  | "approval_requested" | "approval_granted" | "approval_denied"
  | "error_raised";
```

## Required Fields
- `id`: stable event id.
- `timestamp`: ISO 8601 UTC timestamp.
- `eventType`: supported event type.
- `taskId`: task identifier or `unknown` when no task exists.
- `correlationId`: trace id shared by related events.
- `actor`: normalized actor object.
- `action`: short action name.
- `target`: normalized target object.
- `result`: normalized result object.
- `redactionsApplied`: whether event data was redacted.

## Optional Fields
- `parentEventId`: parent event for nested calls.
- `riskClass`, `permissionLevel`, `approvalState`, `policyDecisionId`.
- `durationMs`, `metadata`, and normalized `errors`.

## Redaction Rules
- Redact secret-like values before persistence.
- Replace unknown sensitive strings with `"[REDACTED]"`.
- Store hashes, ids, paths, scopes, and summaries instead of raw output.
- Set `redactionsApplied: true` whenever content was removed or replaced.
- Record redaction failures as `error_raised` and fail closed for risky events.

## Secret Handling Rules
- Do not read secrets for audit logging.
- Do not store secrets in any audit field.
- Log secret access attempts by intent, scope, decision, and outcome only.
- Approved secret use references the provider or environment adapter, not the
  secret value.
- Memory writes must never include raw secrets.

## Correlation ID Rules
- Every task receives one `correlationId`.
- Child events reuse the task correlation id.
- Nested operations may also set `parentEventId`.
- Retries keep the same `correlationId` and use new event ids.
- Cross-task references use metadata, not a reused correlation id.

## Task ID Rules
- Task-scoped work must include `taskId`.
- System events may use `taskId: "unknown"` only when no task exists.
- Events must not invent task ids.
- Task completion events summarize final state and changed resources.

## Agent ID Rules
- Agent actors use stable ids such as `codex-cli` or `verifier-agent`.
- Human actors use stable local identifiers when available, otherwise `human`.
- Model actors identify the model route or adapter without requiring a provider.
- Tool actors identify the tool adapter, not an uncontrolled subprocess.

## Tool Call Logging
- Log `tool_requested` before execution for state-changing or risky tools.
- Log `tool_executed` with status, duration, affected paths, exit code when
  available, and output summary.
- Shell commands include working directory, intent, scope, and policy reference.
- Do not log raw command output by default.

## Policy Decision Logging
- Log every policy check for risky, denied, approval-gated, or state-changing
  actions.
- Use `policy_checked` for allow or approval-required decisions.
- Use `policy_denied` for denied actions.
- Include risk class, requested permission, approval state, scope, decision,
  reason, and constraints.
- Policy logs must be created before the evaluated action runs.

## Verification Result Logging
- Log each verification run as `verification_run`.
- Log failed checks as `verification_failed`.
- Include verifier id, checked scope, status, duration, exit code when available,
  and concise evidence.
- Skipped verification is metadata with a reason.

## Memory Write Logging
- Log successful memory persistence as `memory_written`.
- Include memory entry id, entry type, scope, source task, verification state,
  and redaction state.
- Do not log full memory content when it is large or sensitive.
- Rejected memory writes are `policy_denied` or `error_raised` by cause.

## Error Logging
- Log errors that block work, fail verification, deny policy, or prevent
  persistence.
- Include normalized error code, category, retryability, adapter, and summary.
- Do not store raw stack traces by default when they may include local secrets,
  prompts, or file contents.

## Storage Format
- Store audit events as append-only JSON Lines (`.jsonl`) by default.
- Each line contains exactly one `AuditEvent`.
- Events are immutable from the perspective of policy consumers.
- Corrections are new events that reference the prior event id.
- Audit sinks may be files, databases, or external systems if they preserve the
  same event shape and redaction guarantees.

The TASK-0301 execution audit runtime uses the same audit principles with a
bounded execution-specific event envelope stored as immutable per-event JSON
records under:

```text
.aeos/state/audit/<task-id>/
```

Each execution audit record includes system actor/target/result fields, safe
task/attempt/invocation binding, a monotonic per-task `sequence`,
`previousEventDigest`, and `eventDigest`. The digest is computed from canonical
event content excluding only `eventDigest`.

Execution audit storage is append-only through the runtime API. Existing event
files are not overwritten or rewritten. Duplicate deterministic event identity
is a conflict. Read and verify APIs load events in sequence order and fail
closed on corrupt JSON, invalid schema, duplicate sequence, sequence gaps,
digest mismatch, unsafe symlinks, or path escape.

The local concurrency guarantee is cooperative only: appends use a per-task
exclusive lock file under `.aeos/state/audit/.locks/<task-id>/`. Cooperating
AEOS writers do not silently allocate the same sequence. A stale lock or a
non-cooperating writer still requires operator recovery; this is not a
distributed lock manager.

TASK-0301 execution event kinds are a closed set for the current execution
authority boundary:

```ts
type TaskExecutionAuditEventKind =
  | "execution_permission_evaluated"
  | "execution_credential_resolution_evaluated"
  | "execution_invocation_dispatch_intent"
  | "execution_invocation_returned"
  | "execution_invocation_failed"
  | "execution_invocation_outcome_unknown"
  | "execution_reconciliation_applied";
```

`execution_invocation_dispatch_intent` records only that AEOS is about to cross
the TEST execution side-effect boundary. It is not proof that the provider was
called, not permission authorization, and not completion proof. Returned,
failed, and outcome-unknown audit events record bounded references to the
invocation authority; the invocation record remains the source of truth for the
invocation result.

For `auditRequired: true`, a durable pre-dispatch audit write must succeed
before the TEST dependency may be invoked. A pre-dispatch audit failure blocks
the invocation. If the dependency has already returned and the post-invocation
audit append fails, AEOS reports explicit audit incompleteness and does not
erase the invocation result or call the dependency again.

## TypeScript-like Pseudo-interfaces
```ts
interface AuditEvent {
  id: string;
  timestamp: string;
  eventType: AuditEventType;
  taskId: string;
  correlationId: string;
  parentEventId?: string;
  actor: AuditActor;
  action: string;
  target: AuditTarget;
  result: AuditResult;
  adapterId?: string;
  riskClass?: string;
  permissionLevel?: string;
  approvalState?: "not_required" | "required" | "approved" | "denied";
  policyDecisionId?: string;
  durationMs?: number;
  metadata?: AuditMetadata;
  redactionsApplied: boolean;
}

interface AuditActor {
  id: string;
  type: "human" | "agent" | "model" | "tool" | "system";
  adapterId?: string;
}

interface AuditTarget {
  type: "task" | "file" | "tool" | "policy" | "verification" | "memory" | "model" | "system";
  id?: string;
  path?: string;
  scope?: string[];
}

interface AuditMetadata {
  summary?: string;
  command?: string;
  workingDirectory?: string;
  affectedPaths?: string[];
  outputSummary?: string;
  reason?: string;
  constraints?: string[];
  entryType?: string;
  verificationState?: "unverified" | "verified" | "failed" | "skipped";
  usage?: Record<string, number>;
  tags?: string[];
}

interface AuditResult {
  status: "ok" | "partial" | "blocked" | "denied" | "failed" | "not_run";
  decision?: "allow" | "deny" | "requires_approval";
  exitCode?: number;
  errorCode?: string;
  retryable?: boolean;
}
```

## Example Audit Events
Successful Codex task:
```json
{"id":"evt_0001","timestamp":"2026-07-30T09:10:00Z","eventType":"task_completed","taskId":"TASK-0009","correlationId":"corr_task_0009","actor":{"id":"codex-cli","type":"agent"},"action":"complete_task","target":{"type":"task","id":"TASK-0009"},"result":{"status":"ok"},"metadata":{"summary":"Created audit log format document and updated project context.","affectedPaths":["docs/AUDIT_LOG_FORMAT.md","PROJECT_CONTEXT.md"]},"redactionsApplied":false}
```

Denied shell command:
```json
{"id":"evt_0002","timestamp":"2026-07-30T09:11:00Z","eventType":"policy_denied","taskId":"TASK-0009","correlationId":"corr_task_0009","actor":{"id":"codex-cli","type":"agent"},"action":"run_shell_command","target":{"type":"tool","id":"shell","scope":["workspace"]},"riskClass":"destructive","permissionLevel":"destructive_requires_approval","approvalState":"denied","result":{"status":"denied","decision":"deny"},"metadata":{"command":"rm -rf docs","workingDirectory":"/workspace/project","reason":"Destructive command outside task scope."},"redactionsApplied":false}
```

Memory write:
```json
{"id":"evt_0003","timestamp":"2026-07-30T09:12:00Z","eventType":"memory_written","taskId":"TASK-0009","correlationId":"corr_task_0009","actor":{"id":"memory-adapter","type":"system","adapterId":"memory.markdown"},"action":"write_memory_entry","target":{"type":"memory","id":"mem_0142"},"result":{"status":"ok"},"metadata":{"entryType":"project_decision","summary":"AEOS audit logs use compact append-only JSON Lines events.","verificationState":"verified","tags":["audit","policy"]},"redactionsApplied":true}
```

Verification failure:
```json
{"id":"evt_0004","timestamp":"2026-07-30T09:13:00Z","eventType":"verification_failed","taskId":"TASK-0009","correlationId":"corr_task_0009","actor":{"id":"verifier","type":"system","adapterId":"verifier.local"},"action":"verify_required_sections","target":{"type":"verification","scope":["docs/AUDIT_LOG_FORMAT.md"]},"result":{"status":"failed","exitCode":1,"errorCode":"missing_required_section"},"metadata":{"summary":"Required section 'Secret Handling Rules' was not found.","affectedPaths":["docs/AUDIT_LOG_FORMAT.md"]},"redactionsApplied":false}
```

## MVP Audit Set
Log task start/completion, tool request/execution, policy check/denial, file
change, verification run/failure, memory write, approval request/grant/denial,
and raised errors.

## Later Audit Set
Later versions may add model usage accounting, external sinks, retention
policies, signed event chains, sampling, cross-repository correlation, and
dry-run audit streams.

## Non-goals
- Replace the policy and permission model.
- Store full conversations, prompts, model outputs, tool logs, file contents,
  secrets, or sensitive environment values.
- Define organization-specific retention, legal hold, or compliance policy.
- Enable production execution, production adapters, production credentials,
  verifier completion, automatic retry, or task completion.
