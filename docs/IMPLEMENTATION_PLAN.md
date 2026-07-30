# AEOS Implementation Plan

## Purpose
Define the initial coding roadmap for AEOS v0 by turning the Phase 0 planning
documents into small, isolated implementation tasks suitable for fresh Codex CLI
sessions.

This plan does not choose a runtime, create source packages, or implement code.
It defines the order of work and the first small tasks needed to begin safely.

## Implementation Principles
- Keep every task small enough for one fresh Codex CLI session.
- Load only explicit context files for each task.
- Modify only files named by the task contract.
- Build package boundaries before behavior.
- Prefer contracts, validation, and fixtures before orchestration.
- Keep CLI commands thin and delegate durable behavior to packages.
- Require policy checks before risky actions.
- Require verification evidence before marking tasks complete.
- Keep audit records compact, redacted, and provider-independent.
- Avoid provider, model, runtime, and package-manager assumptions until decided.

## MVP Definition
AEOS v0 should prove a local, task-scoped engineering operating loop:

- A repository can be initialized or inspected as an AEOS project.
- A task contract can declare context, writable files, verification, and stop
  conditions.
- AEOS can prepare a minimal context bundle for a task.
- AEOS can validate changed files against task scope.
- AEOS can classify proposed actions with policy decisions.
- AEOS can run or record verification checks.
- AEOS can emit compact handoff and audit records.
- AEOS can store structured Markdown memory only after verification and policy
  checks.
- AEOS can expose an MVP CLI surface without provider-specific assumptions.
- AEOS can register fake/local adapters against stable contracts.

## Non-goals For v0
- No autonomous multi-agent orchestration.
- No production deployment or hosted service.
- No dependency installation during generated project initialization.
- No provider-specific model SDK integration required for MVP.
- No broad repository scanning by default.
- No raw conversation memory storage.
- No Git push, release, migration, or destructive workflow automation.
- No template families beyond default and generic MVP templates.
- No MCP execution beyond contract and later integration placeholders.

## Recommended Runtime Decision Placeholder
Runtime and package manager remain undecided.

TASK-0013 should decide:
- runtime language and minimum version;
- package manager;
- monorepo/workspace mechanism;
- test runner;
- formatter and static checker;
- CLI packaging approach.

No implementation task should create `apps/`, `packages/`, `package.json`, lock
files, or source code until TASK-0013 is complete.

## Phase 1: Repository and Package Scaffold
Create the runtime-specific repository scaffold after TASK-0013. Add only the
minimal `apps/cli` and MVP `packages/` directories from
`docs/PACKAGE_ARCHITECTURE.md`. Include public entrypoints, placeholder
README/API notes if useful, and static configuration chosen by TASK-0013.

Primary outcome: empty but valid package boundaries.

## Phase 2: Core Types and Contracts
Implement shared AEOS-owned types for adapter results, policy decisions,
verification reports, task metadata, audit events, and package public APIs.
Start with serializable shapes and fake implementations. Do not add external
provider types.

Primary outcome: stable contracts that packages can import through public
entrypoints.

## Phase 3: Project Context and Task System
Implement project discovery, `PROJECT_CONTEXT.md` parsing, task contract parsing,
context bundle generation, allowed-file validation, and compact task handoff
formatting.

Primary outcome: AEOS can inspect a project and prepare a scoped task session.

## Phase 4: Memory File System
Implement structured Markdown/YAML memory read and write boundaries for local
files. Validate entry shape, source evidence, task scope, redaction status, and
verification state before writes.

Primary outcome: local memory can be queried and written through policy-aware
contracts.

## Phase 5: Policy and Audit Foundations
Implement risk classification, allow/deny/approval-required decisions, and
append-only audit event writing for local actions. Cover shell, filesystem, Git,
dependency, deployment, secret, memory, MCP, and destructive risk classes.

Primary outcome: risky actions are classified before execution and decisions
produce audit-ready evidence.

## Phase 6: Verification Foundations
Implement verification plan and report types, scoped existence and format checks,
changed-file checks, skipped/blocked reporting, and policy-sensitive verification
summaries.

Primary outcome: AEOS can prove whether a docs, scaffold, or early code task met
its declared verification requirements.

## Phase 7: CLI MVP
Implement the MVP commands from `docs/CLI_COMMAND_MAP.md` as thin wrappers:
`aeos init`, `aeos status`, `aeos context`, `aeos task new`, `aeos task run`,
`aeos task done`, `aeos plan`, `aeos review`, `aeos remember`, `aeos search`,
`aeos verify`, `aeos agent list`, `aeos tool list`, `aeos policy check`, and
`aeos audit`.

Primary outcome: operators can run the local AEOS loop from the command line.

## Phase 8: Template MVP
Implement `project-default` and `generic` template metadata, deterministic
rendering, required variable validation, overwrite policy checks, existence
verification, and audit records.

Primary outcome: `aeos init` can safely create or validate minimal AEOS project
scaffolds without installing dependencies.

## Phase 9: Adapter MVP
Implement fake/local adapters for models, agents, tools, memory, projects,
verifier, policy, and audit. Use capability declarations and normalized results
to validate routing without external providers.

Primary outcome: core orchestration can run against adapter contracts without
provider-specific code.

## Phase 10: MCP and External Agent Integration Later
After the MVP loop is verified locally, add MCP tool discovery, MCP tool
invocation through policy gates, external agent adapters, model provider
adapters, richer memory backends, and cross-agent review workflows.

Primary outcome: external systems integrate through AEOS adapters, policy,
verification, and audit rather than direct tool access.

## Risk Register
- Runtime decision drift: choosing a runtime too late may force rework. Mitigate
  with TASK-0013 before coding.
- Package boundary erosion: CLI or adapters may absorb core behavior. Mitigate
  with package-level public API tests.
- Over-broad context loading: task execution may become expensive and unsafe.
  Mitigate with explicit context bundle checks.
- Policy bypass: tools or adapters may execute risky actions directly. Mitigate
  with pre-execution policy tests and audit assertions.
- Memory quality risk: unverified or verbose memory may pollute future context.
  Mitigate with schema, evidence, redaction, and verification gates.
- Verification gaps: tasks may be marked complete with weak evidence. Mitigate
  with required verification reports and skipped/block reasons.
- Template overwrite risk: initialization may modify existing projects
  unexpectedly. Mitigate with declared files and overwrite approval checks.
- Provider lock-in: early adapters may leak SDK types. Mitigate with fake/local
  adapters first and AEOS-owned public types.

## Verification Strategy
Early implementation tasks should use the verification levels from
`docs/VERIFICATION_STRATEGY.md`:

- Documentation and planning: `existence_check`, `format_check`, `static_check`.
- Scaffolds: `existence_check`, `format_check`, `static_check`.
- Core contracts: `static_check`, then `unit_test`.
- Policy, verifier, memory, and adapters: `unit_test` plus `security_check`
  where risk classification or scoped writes are involved.
- CLI commands: `static_check`, `unit_test`, and targeted `smoke_test`.

Each task must report changed files, checks run, skipped checks, problems, and
the next suggested task.

## Suggested First 20 Implementation Tasks

### TASK-0013
- Title: Decide AEOS runtime and package manager.
- Purpose: Choose the implementation runtime, package manager, workspace
  mechanism, test runner, formatter, and CLI packaging approach.
- Files likely to modify: `docs/DECISIONS.md`, `PROJECT_CONTEXT.md`,
  `TASKS/backlog.md`.
- Verification level: `format_check`.
- Recommended model effort: High.
- Creates code or docs only: Docs only.

### TASK-0014
- Title: Create runtime scaffold plan.
- Purpose: Convert the runtime decision into exact scaffold files and commands
  for the next coding task without creating source files yet.
- Files likely to modify: `docs/IMPLEMENTATION_PLAN.md`, `TASKS/backlog.md`,
  `PROJECT_CONTEXT.md`.
- Verification level: `static_check`.
- Recommended model effort: Medium.
- Creates code or docs only: Docs only.

### TASK-0015
- Title: Create minimal repository scaffold.
- Purpose: Add the chosen runtime workspace files and empty MVP package/app
  boundaries.
- Files likely to modify: runtime config files, `apps/cli/`, MVP
  `packages/*/`, `PROJECT_CONTEXT.md`.
- Verification level: `existence_check`.
- Recommended model effort: Medium.
- Creates code or docs only: Code.

### TASK-0016
- Title: Add base static verification command.
- Purpose: Add the minimal formatter/static-check command chosen by TASK-0013.
- Files likely to modify: runtime config files, root scripts/config,
  `PROJECT_CONTEXT.md`.
- Verification level: `static_check`.
- Recommended model effort: Medium.
- Creates code or docs only: Code.

### TASK-0017
- Title: Define shared adapter result types.
- Purpose: Implement serializable common adapter result, error, capability, and
  context types.
- Files likely to modify: `packages/core/`, package public entrypoints, tests.
- Verification level: `unit_test`.
- Recommended model effort: Medium.
- Creates code or docs only: Code.

### TASK-0018
- Title: Define policy decision types.
- Purpose: Implement risk class, permission level, proposed action, policy
  decision, and audit event types.
- Files likely to modify: `packages/policies/`, package public entrypoints,
  tests.
- Verification level: `unit_test`.
- Recommended model effort: Medium.
- Creates code or docs only: Code.

### TASK-0019
- Title: Define verification report types.
- Purpose: Implement verification plan, check, run, result, and report types.
- Files likely to modify: `packages/verifier/`, package public entrypoints,
  tests.
- Verification level: `unit_test`.
- Recommended model effort: Medium.
- Creates code or docs only: Code.

### TASK-0020
- Title: Define task contract parser.
- Purpose: Parse task metadata needed for context files, writable files,
  verification steps, and stop conditions.
- Files likely to modify: `packages/projects/`, tests, fixtures.
- Verification level: `unit_test`.
- Recommended model effort: High.
- Creates code or docs only: Code.

### TASK-0021
- Title: Implement project context reader.
- Purpose: Read concise project context fields required by `aeos status` and
  task context preparation.
- Files likely to modify: `packages/projects/`, tests, fixtures.
- Verification level: `unit_test`.
- Recommended model effort: Medium.
- Creates code or docs only: Code.

### TASK-0022
- Title: Implement scoped context bundle builder.
- Purpose: Build a minimal context bundle from a task contract without broad
  repository scanning.
- Files likely to modify: `packages/projects/`, `packages/core/`, tests.
- Verification level: `unit_test`.
- Recommended model effort: High.
- Creates code or docs only: Code.

### TASK-0023
- Title: Implement file scope validator.
- Purpose: Validate changed or requested files against allowed and excluded task
  scope.
- Files likely to modify: `packages/projects/`, tests.
- Verification level: `unit_test`.
- Recommended model effort: Medium.
- Creates code or docs only: Code.

### TASK-0024
- Title: Implement basic policy classifier.
- Purpose: Classify proposed actions into risk classes and return allow, deny,
  or approval-required decisions.
- Files likely to modify: `packages/policies/`, tests.
- Verification level: `security_check`.
- Recommended model effort: High.
- Creates code or docs only: Code.

### TASK-0025
- Title: Implement local audit event writer.
- Purpose: Append compact JSONL audit events for policy decisions and
  verification outcomes.
- Files likely to modify: `packages/core/` or `packages/policies/`, tests,
  local audit fixtures.
- Verification level: `unit_test`.
- Recommended model effort: Medium.
- Creates code or docs only: Code.

### TASK-0026
- Title: Implement verification existence checks.
- Purpose: Check required files or directories exist and report normalized
  verification results.
- Files likely to modify: `packages/verifier/`, tests.
- Verification level: `unit_test`.
- Recommended model effort: Medium.
- Creates code or docs only: Code.

### TASK-0027
- Title: Implement documentation format checks.
- Purpose: Check required Markdown sections for docs-only and scaffold tasks.
- Files likely to modify: `packages/verifier/`, tests, fixtures.
- Verification level: `unit_test`.
- Recommended model effort: Medium.
- Creates code or docs only: Code.

### TASK-0028
- Title: Implement memory entry validation.
- Purpose: Validate structured memory drafts for required fields, evidence,
  redaction status, and verification state.
- Files likely to modify: `packages/memory/`, tests, fixtures.
- Verification level: `security_check`.
- Recommended model effort: High.
- Creates code or docs only: Code.

### TASK-0029
- Title: Implement local memory read and write adapter.
- Purpose: Read and write approved local Markdown memory entries through the
  memory adapter contract.
- Files likely to modify: `packages/memory/`, tests, fixtures.
- Verification level: `unit_test`.
- Recommended model effort: High.
- Creates code or docs only: Code.

### TASK-0030
- Title: Implement CLI status command.
- Purpose: Add `aeos status` as the first thin CLI command using project context
  APIs.
- Files likely to modify: `apps/cli/`, `packages/projects/`, CLI tests.
- Verification level: `smoke_test`.
- Recommended model effort: Medium.
- Creates code or docs only: Code.

### TASK-0031
- Title: Implement CLI context command.
- Purpose: Add `aeos context --task <id>` using the scoped context bundle
  builder.
- Files likely to modify: `apps/cli/`, `packages/core/`,
  `packages/projects/`, CLI tests.
- Verification level: `smoke_test`.
- Recommended model effort: High.
- Creates code or docs only: Code.

### TASK-0032
- Title: Implement CLI verify command.
- Purpose: Add `aeos verify <task-id>` using verifier APIs and compact report
  output.
- Files likely to modify: `apps/cli/`, `packages/verifier/`, CLI tests.
- Verification level: `smoke_test`.
- Recommended model effort: High.
- Creates code or docs only: Code.

## Stop Conditions Before Coding
- TASK-0013 is complete and documented.
- Runtime, package manager, test runner, formatter, and CLI packaging are chosen.
- The first scaffold task names exact files and directories to create.
- No source package is created before runtime decisions are recorded.
- Verification commands for scaffold and code tasks are known.
- Policy expectations for dependency changes and generated files are explicit.
