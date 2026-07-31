# Project Context

Project: Pro Performans

Product: AEOS - AI Engineering Operating System

Current Phase: Phase 0 - Planning and Project Operating System

## Goal

Design and build AEOS as a modular, extensible, model-independent AI Engineering OS for orchestrating AI agents, tools, memory, verification, repositories, and project workflows.

## Current Working Rule

Every Codex thread/session is stateless and must receive a tiny isolated task with explicit files to load, files to modify, verification steps, and a stop condition.

## Current Priorities

- Establish repository standards.
- Define AEOS architecture and boundaries.
- Create task templates for repeatable Codex CLI work.
- Capture decisions in Markdown before implementation.
- Keep context loading small and intentional.

## Relevant Docs For Current Phase

- `AGENTS.md`
- `README.md`
- `docs/AEOS_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- `docs/DECISIONS.md`
- `docs/REPOSITORY_STANDARD.md`
- `docs/PACKAGE_ARCHITECTURE.md`
- `docs/TASK_CONTRACT.md`
- `docs/MEMORY_DESIGN.md`
- `docs/MEMORY_SCHEMA.md`
- `docs/CLI_COMMAND_MAP.md`
- `docs/ADAPTER_CONTRACTS.md`
- `docs/POLICY_PERMISSION_MODEL.md`
- `docs/AUDIT_LOG_FORMAT.md`
- `docs/VERIFICATION_STRATEGY.md`
- `docs/PROJECT_TEMPLATE_SPEC.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/RUNTIME_DECISION.md`
- `docs/CLI_MVP_IMPLEMENTATION_PLAN.md`
- `TASKS/task-template.md`
- `TASKS/backlog.md`

## Completed Tasks

- TASK-0002: Define the AEOS task contract format.
- TASK-0003: Define AEOS memory entry schema.
- TASK-0004: Create initial AEOS memory templates.
- TASK-0005: Define AEOS CLI command map.
- TASK-0006: Define AEOS package architecture.
- TASK-0007: Define AEOS adapter interface contracts.
- TASK-0008: Define AEOS policy and permission model.
- TASK-0009: Define AEOS audit log format.
- TASK-0010: Define AEOS verification strategy.
- TASK-0011: Define AEOS project template specification.
- TASK-0012: Define AEOS initial implementation plan.
- TASK-0013: Decide AEOS runtime and package manager.
- TASK-0014: Create AEOS TypeScript monorepo scaffold.
- TASK-0015: Add TypeScript dependency and verify monorepo typecheck.
- TASK-0016: Define core shared TypeScript types.
- TASK-0017: Define AEOS adapter TypeScript interfaces.
- TASK-0018: Define AEOS core task TypeScript contracts.
- TASK-0019: Define AEOS core memory TypeScript contracts.
- TASK-0020: Define AEOS core policy TypeScript contracts.
- TASK-0021: Define AEOS core audit TypeScript contracts.
- TASK-0022: Define AEOS core verification TypeScript contracts.
- TASK-0023: Review and normalize core type exports.
- TASK-0024: Define core result and error helpers.
- TASK-0025: Add minimal core result helper typecheck examples.
- TASK-0026: Define minimal core task validation helpers.
- TASK-0027: Add task validation typecheck examples.
- TASK-0028: Define minimal memory frontmatter validation helpers.
- TASK-0029: Add memory validation typecheck examples.
- TASK-0030: Define minimal policy decision helpers.
- TASK-0031: Add policy decision typecheck examples.
- TASK-0032: Define minimal audit event helpers.
- TASK-0033: Add audit event typecheck examples.
- TASK-0034: Define minimal verification report helpers.
- TASK-0035: Add verification report typecheck examples.
- TASK-0036: Perform Core Foundation Review.
- TASK-0037: Define CLI MVP implementation plan.
- TASK-0038: Implement minimal CLI entrypoint and version command.
- TASK-0039: Add CLI smoke script.
- TASK-0040: Implement aeos status command.
- TASK-0041: Implement aeos context command.
- TASK-0042: Implement aeos task validate command.

## Do Not Load By Default

- Do not load all files in `docs/`.
- Do not load `brain/` unless the task explicitly names files inside it.
- Do not load `templates/` unless the task explicitly names files inside it.
- Do not scan the entire repository unless the task explicitly requires it.

## Next Task

TASK-0043 Implement aeos task validate error polish.
