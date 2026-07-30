# AEOS Policy and Permission Model

## Purpose
Define how AEOS evaluates proposed actions before agents, adapters, tools, MCP
servers, shell commands, filesystem operations, Git operations, dependency
changes, migrations, deployments, and memory writes are allowed to run. This
model is provider-independent, model-independent, and runtime-independent.

## Core Principle
No actor may perform a risky action until AEOS has classified the action, checked
scope, checked permissions, and returned a policy decision. Risky actions are
denied or approval-gated by default. Narrow, reversible, task-scoped reads and
writes may be allowed when the task contract permits them.

## Permission Levels
```ts
type PermissionLevel =
  | "read_only" | "write_safe" | "shell_limited" | "network_limited"
  | "destructive_requires_approval" | "deployment_requires_approval";
```
- `read_only`: inspect explicitly allowed local context and metadata.
- `write_safe`: create or edit explicitly allowed non-sensitive files.
- `shell_limited`: run bounded local commands with declared intent.
- `network_limited`: use approved network access with no hidden side effects.
- `destructive_requires_approval`: request destructive actions only.
- `deployment_requires_approval`: request deployment actions only.

Permission levels are not implicit. Secret access, Git push, dependency changes,
migrations, and deployments require their own policy decision.

## Action Risk Classes
```ts
type RiskClass =
  | "safe_read" | "safe_write" | "generated_file_write" | "shell_read"
  | "shell_write" | "dependency_change" | "git_write" | "file_delete"
  | "migration" | "deployment" | "secret_access" | "destructive";
```
- `safe_read`: reads explicitly allowed files or local metadata.
- `safe_write`: edits explicitly allowed files in task scope.
- `generated_file_write`: creates requested generated artifacts.
- `shell_read`: runs local inspection commands with no mutation.
- `shell_write`: runs local commands that may modify files.
- `dependency_change`: installs, removes, upgrades, or rewrites dependencies.
- `git_write`: stages, commits, tags, rebases, merges, or pushes Git state.
- `file_delete`: deletes files, directories, artifacts, or caches.
- `migration`: changes data schema, persistent data, or migration state.
- `deployment`: publishes or modifies externally reachable runtime state.
- `secret_access`: reads or uses credentials, tokens, cookies, keys, or secrets.
- `destructive`: can lose data, rewrite history, erase state, or cause broad
  irreversible side effects.

## Default Allow Rules
AEOS may allow an action without user approval only when the risk class is
`safe_read`, `safe_write`, `generated_file_write`, or `shell_read`; the task
contract explicitly permits the scope; the actor has a matching permission level;
the action has no secret, dependency, Git write, migration, deployment,
destructive, or external side effect; and the decision and outcome can be
audited.

## Default Deny Rules
AEOS denies an action by default when it is outside task scope, lacks the required
permission level, uses broad or hidden scope, touches excluded paths, bypasses
policy or audit, asks a tool or MCP server to perform risky work directly,
exposes or stores secrets, or conflicts with repository, task, or security
policy. Denied actions must include a clear reason.

## Approval Required Rules
Explicit approval is required for destructive commands, irreversible filesystem
changes, dependency changes, secret access, broad environment inspection,
deployments, database or data migrations, Git push, force push, history rewrite,
merge, rebase, tag publication, file deletion, file rename outside explicit task
scope, broad shell commands, and network operations with side effects. Approval
is scoped to the proposed action and does not grant blanket future permission.

## Agent Permission Boundaries
Agents may propose actions, classify intent, and execute approved work through
AEOS adapters. Agents must not expand context or file scope without policy
approval, perform risky shell, Git, dependency, migration, deployment, secret, or
memory actions without a policy decision, treat model reasoning as approval,
write memory directly, or hide failed, skipped, denied, or partially completed
operations. Agent output must report changed files, verification evidence,
policy denials, and required follow-up when relevant.

## MCP Tool Permission Boundaries
MCP servers provide capabilities. They are not policy authorities. MCP tools must
declare tools and expected side effects before invocation, receive only scoped
arguments approved by AEOS, run through an AEOS tool adapter, and return
normalized result, error, and audit metadata. MCP tools must not execute risky
actions directly from model output, escalate permissions from server defaults,
access excluded scope, or suppress audit data.

## Shell Command Policy
Shell commands are classified before execution. Bounded inspection commands such
as `pwd`, `git status --short`, targeted `sed`, targeted `rg`, file existence
checks, version checks, and explicitly named safe verification commands may be
allowed by default. Commands that delete, overwrite, move, install, deploy,
migrate, push, rewrite Git history, inspect secrets, mutate external systems, or
have broad unpredictable effects require approval. Command audit must include
intent, working directory, scope, approval state, exit code, and output summary.

## Filesystem Policy
Filesystem reads and writes must respect the task contract. Reading explicitly
listed context files, editing explicitly listed files to modify, and creating
explicitly requested generated files in approved paths may be allowed by default.
Reading excluded paths, scanning broad directories, writing outside workspace or
allowed paths, deleting files, renaming files outside explicit task scope, or
touching source files during documentation-only tasks is denied or approval-gated.

## Git Policy
Reading Git status, diffs, and metadata needed to report local changes may be
allowed by default. `git add`, commit, merge, rebase, tag, push, force push,
checkout that discards work, reset, stash operations that hide work, and history
rewrites require approval. Git operations must preserve unrelated user changes
and report affected files.

## Dependency Policy
Dependency changes include installing packages, removing packages, upgrading
packages, changing package managers, or editing dependency manifests and
lockfiles. Dependency changes require explicit task scope and approval when
policy requires it. Agents must not add dependencies for convenience.

## Migration Policy
Migrations include database migrations, data backfills, schema changes,
persistent store changes, and irreversible data transforms. Migrations require
approval, target environment, expected impact, rollback or backup notes when
possible, and verification steps.

## Deployment Policy
Deployments include publishing code, changing hosted configuration, modifying
production-like environments, releasing packages, or exposing public endpoints.
Deployments require approval, target environment, expected change, rollback notes
when possible, and audit output. AEOS must never deploy from implicit agent
intent.

## Secret Handling Policy
Secrets include tokens, keys, cookies, credentials, private config, signing
material, and sensitive environment values. AEOS must avoid reading secrets
unless approved, redact secret-like values in logs and handoffs, never store
secrets in memory, never commit secrets, and pass secrets only through approved
provider or environment adapters.

## Memory Write Policy
Memory writes must be structured, scoped, and policy-gated. Allowed memory writes
require declared entry type, source evidence or task output reference,
verification state, redaction of secrets, and approval state when the entry
contains sensitive or durable project knowledge. Agents and MCP tools must not
write memory directly. They may propose memory writes for AEOS to validate and
persist through a memory adapter.

## Audit Log Requirements
AEOS must record significant policy decisions and action outcomes. Audit events
should include actor, adapter, task id, proposed action, risk class, requested
scope, affected resources, permission level, approval state, decision, reason,
timestamp, outcome, exit code when relevant, output summary, and redaction
status. Audit logs should be append-only from the perspective of policy
consumers.

## Policy Decision Format
```ts
interface ProposedAction {
  id: string;
  taskId: string;
  actor: string;
  adapterId?: string;
  action: string;
  intent: string;
  riskClass: RiskClass;
  requestedPermission: PermissionLevel;
  scope: string[];
  expectedSideEffects: string[];
  approvalState: "not_required" | "required" | "approved" | "denied";
  metadata?: Record<string, unknown>;
}

interface PolicyDecision {
  actionId: string;
  decision: "allow" | "deny" | "requires_approval";
  riskClass: RiskClass;
  permissionLevel: PermissionLevel;
  reason: string;
  approvalScope?: string[];
  constraints?: string[];
  auditRequired: boolean;
  timestamp: string;
}

interface AuditEvent {
  id: string;
  taskId: string;
  actor: string;
  adapterId?: string;
  actionId: string;
  action: string;
  riskClass: RiskClass;
  scope: string[];
  decision: PolicyDecision["decision"];
  approvalState: ProposedAction["approvalState"];
  outcome: "not_run" | "ok" | "partial" | "blocked" | "failed";
  summary: string;
  redactionsApplied: boolean;
  timestamp: string;
}
```

## Example Policy Decisions
- Read `PROJECT_CONTEXT.md`: `safe_read`, `allow`, because the file is listed as
  task context.
- Edit a listed documentation file: `safe_write`, `allow`, because the file is
  in modify scope and has no external side effects.
- Install a package: `dependency_change`, `requires_approval` or `deny`, because
  dependency changes need explicit scope and approval.
- Invoke an MCP publishing tool: `deployment`, `requires_approval`, because MCP
  tools cannot deploy directly without AEOS approval.
- Inspect all environment variables: `secret_access`, `deny`, because broad
  environment inspection may expose secrets.

## MVP Policy Set
The MVP policy set should support task-scoped read and write checks, risk
classification for all required risk classes, approval gating for destructive,
dependency, Git write, migration, deployment, and secret access actions, MCP tool
gating through the tool adapter, shell command allow/deny/approval decisions,
structured memory write validation, and audit events for decisions and
significant outcomes.

## Later Policy Set
Later versions may add organization policy profiles, per-repository trust
settings, time-limited approval grants, dry-run comparison for high-risk actions,
policy simulation, external audit sinks, policy tests, and environment-aware
deployment and migration rules.

## Non-goals
- Define a concrete runtime implementation.
- Choose a model provider, agent runtime, MCP server, or memory backend.
- Replace the existing security policy.
- Grant agents authority to approve their own risky actions.
- Allow MCP tools to bypass AEOS policy checks.
- Define package source code or application behavior.
