# AEOS Package Architecture

## Purpose
Define the planned `apps/` and `packages/` boundaries for the future AEOS monorepo before implementation begins.

This document describes ownership, dependency direction, public API expectations, and MVP versus later package scope.

## Architecture Principles
- Keep AEOS model-independent through adapters and interface boundaries.
- Keep orchestration logic separate from CLI presentation and command parsing.
- Keep provider-specific, tool-specific, and repository-specific behavior outside core policy and orchestration decisions.
- Keep memory, verification, templates, and project workflows modular enough to evolve independently.
- Prefer small packages with clear public APIs over broad shared utility modules.
- Treat package boundaries as contracts, not just folders.
- Do not introduce runtime, framework, package manager, or dependency choices in this planning document.

## Planned Monorepo Layout
```text
apps/
  cli/

packages/
  core/
  agents/
  models/
  tools/
  memory/
  projects/
  verifier/
  policies/
  templates/
```

`apps/` contains user-facing entrypoints.

`packages/` contains reusable AEOS modules with explicit public APIs.

## apps/ Boundary
Apps are thin operator-facing entrypoints.

Apps may parse commands, load task inputs, render output, and call package APIs.

Apps must not own orchestration rules, model routing rules, memory schemas, policy logic, or verification logic.

Apps must not be imported by packages.

## packages/ Boundary
Packages own durable AEOS behavior.

Packages expose public APIs through explicit entrypoints.

Packages must avoid importing app code.

Packages must keep provider-specific behavior behind adapter-facing contracts.

Packages must avoid broad shared state and hidden cross-package side effects.

## Package List
- `apps/cli`
- `packages/core`
- `packages/agents`
- `packages/models`
- `packages/tools`
- `packages/memory`
- `packages/projects`
- `packages/verifier`
- `packages/policies`
- `packages/templates`

## Package Responsibilities
### apps/cli
- Responsibility: operator command interface, task intake, session setup, status display, and compact handoff output.
- May depend on: `packages/core`, `packages/projects`, `packages/policies`, `packages/verifier`, and package public APIs needed to run commands.
- Must not depend on: package internals, provider SDK internals, or application/source implementation files outside AEOS boundaries.
- Phase: MVP.

### packages/core
- Responsibility: orchestration flow, task lifecycle coordination, context loading contracts, routing decisions, and module interfaces.
- May depend on: `packages/policies`, interface types from `packages/models`, `packages/agents`, `packages/tools`, `packages/memory`, `packages/projects`, `packages/verifier`, and `packages/templates`.
- Must not depend on: `apps/cli`, concrete provider adapters, concrete tool adapters, or presentation output.
- Phase: MVP.

### packages/agents
- Responsibility: agent runtime contracts, agent capability metadata, agent execution normalization, and agent adapter registration.
- May depend on: `packages/policies`, interface types from `packages/models`, `packages/tools`, and `packages/verifier`.
- Must not depend on: `apps/cli`, concrete CLI commands, memory storage internals, or project template internals.
- Phase: MVP.

### packages/models
- Responsibility: model routing contracts, model capability descriptions, provider adapter interfaces, and normalized model request and response shapes.
- May depend on: `packages/policies` for approval and safety checks.
- Must not depend on: `apps/cli`, `packages/agents`, `packages/tools`, `packages/memory`, or concrete provider implementations in core APIs.
- Phase: MVP.

### packages/tools
- Responsibility: tool adapter contracts, MCP/local tool execution wrappers, command intent metadata, output capture, and audit-friendly tool results.
- May depend on: `packages/policies` for approval gates and `packages/verifier` interfaces for optional result checks.
- Must not depend on: `apps/cli`, model provider internals, memory storage internals, or project-specific command implementations.
- Phase: MVP.

### packages/memory
- Responsibility: structured memory schemas, retrieval contracts, memory write rules, and storage adapter boundaries.
- May depend on: `packages/policies` for write gates and `packages/verifier` for verification-before-write contracts.
- Must not depend on: `apps/cli`, concrete model providers, agent runtimes, or tool execution internals.
- Phase: MVP.

### packages/projects
- Responsibility: repository standards, task contract handling, project metadata, workspace conventions, and file-scope validation.
- May depend on: `packages/policies`, `packages/templates`, and `packages/verifier`.
- Must not depend on: `apps/cli`, concrete model providers, agent runtimes, or memory storage internals.
- Phase: MVP.

### packages/verifier
- Responsibility: verification contracts, check orchestration, result normalization, and completion criteria.
- May depend on: `packages/policies` and interface types from `packages/tools` for check execution.
- Must not depend on: `apps/cli`, model providers, agent runtimes, or concrete repository workflows.
- Phase: MVP.

### packages/policies
- Responsibility: safety policies, approval rules, risk classification, allowed operation checks, and audit metadata contracts.
- May depend on: no other AEOS package by default.
- Must not depend on: `apps/cli`, providers, adapters, tools, memory, projects, verifier, or templates.
- Phase: MVP.

### packages/templates
- Responsibility: task, memory, project, and workflow template contracts plus template rendering boundaries.
- May depend on: `packages/policies` for template use restrictions.
- Must not depend on: `apps/cli`, models, agents, tools, memory storage internals, or verifier implementations.
- Phase: later.

## Dependency Direction Rules
- `apps/cli` may depend on package public APIs.
- Packages must not depend on `apps/cli`.
- `packages/core` coordinates packages through interfaces and public APIs.
- Leaf packages should depend only on lower-level contracts they actually need.
- `packages/policies` is the lowest-level shared package and should have no AEOS package dependencies.
- Interfaces must not depend on adapters.
- Adapters may depend on interfaces.
- Provider-specific adapters must not leak provider types into core public APIs.
- Tool adapters may call external tools only through policy-checked execution paths.
- Memory writes must flow through verification and policy checks.
- Verification may request tool execution through interfaces, not concrete tool internals.

## Public API Rules

- Each package exposes a small documented public API.
- Internal modules remain private to the owning package.
- Cross-package imports use public entrypoints only.
- Public APIs use AEOS-owned request, response, error, and metadata shapes.
- Public APIs should be stable enough for adapters to target.
- Breaking API changes require an architecture or decision document update.

## Configuration Rules

- Configuration is passed explicitly into package entrypoints.
- Packages must not read global process state unless their public API defines that behavior.
- Provider credentials, secrets, and external service settings belong behind adapters.
- Policy configuration must be available before risky actions are planned or executed.
- Runtime-specific configuration is deferred until implementation planning.

## Testing Boundaries

- Package tests should focus on package-owned behavior and public API contracts.
- Core tests should verify orchestration flow with fake adapters.
- Adapter tests should verify normalization, error handling, and policy integration.
- CLI tests should verify command parsing and handoff output, not core internals.
- Policy tests should cover allowed, blocked, and approval-required operations.

## Verification Boundaries

- Verification rules live in `packages/verifier`.
- Policy approval rules live in `packages/policies`.
- Tool execution needed for verification flows through `packages/tools` interfaces.
- Completion checks compare task scope, changed files, and requested verification steps.
- Verification results must be serializable for handoff and audit records.

## Adapter Boundaries

- Model adapters implement `packages/models` contracts.
- Agent adapters implement `packages/agents` contracts.
- Tool adapters implement `packages/tools` contracts.
- Memory adapters implement `packages/memory` contracts.
- Repository and project adapters implement `packages/projects` contracts.
- Verification adapters implement `packages/verifier` contracts.
- Template adapters implement `packages/templates` contracts.

## MVP Package Set

- `apps/cli`
- `packages/core`
- `packages/agents`
- `packages/models`
- `packages/tools`
- `packages/memory`
- `packages/projects`
- `packages/verifier`
- `packages/policies`

MVP packages should support task intake, scoped context loading, routing contracts, policy checks, verification checks, memory boundaries, and compact handoff reporting.

## Later Package Set

- `packages/templates`

Later packages may expand template rendering, reusable workflow templates, richer adapter families, advanced retrieval, and broader automation once MVP boundaries are validated.

## Non-goals

- Do not create `apps/` or `packages/` directories as part of this task.
- Do not implement package code.
- Do not choose a runtime, framework, package manager, or build system.
- Do not add dependencies.
- Do not define provider-specific SDK behavior.
- Do not define full autonomous multi-agent execution.
- Do not bypass policy, verification, or human approval boundaries.
