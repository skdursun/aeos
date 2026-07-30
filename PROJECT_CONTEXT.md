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

## Do Not Load By Default

- Do not load all files in `docs/`.
- Do not load `brain/` unless the task explicitly names files inside it.
- Do not load `templates/` unless the task explicitly names files inside it.
- Do not scan the entire repository unless the task explicitly requires it.

## Next Task

TASK-0009 Define AEOS audit log format.
