# Project Context

Project: Pro Performans

Product: AEOS - AI Engineering Operating System

Current Phase: Phase 0 - Planning and Project Operating System

## Goal

Design and build AEOS as a modular, extensible, model-independent AI
Engineering OS for orchestrating AI agents, tools, memory, verification,
repositories, and project workflows.

## Current Working Rule

Every Codex thread/session is stateless and must receive a tiny isolated task
with explicit files to load, files to modify, verification steps, and a stop
condition.

## Current Priorities

- Keep context loading small and intentional.
- Keep init orchestration dependency-free and side-effect free until generation
  is explicitly implemented.

## Recent Completed Tasks

- TASK-0109: Implement init execution engine contracts.
- TASK-0110: Add init execution engine contract examples.
- TASK-0111: Define init execution pipeline plan.
- TASK-0112: Implement init pipeline executor.
- TASK-0113: Add init executor examples.
- TASK-0114: Implement init pipeline integration plan.
- TASK-0115: Implement init adapters.

## Current Planning Docs

- `docs/INIT_PIPELINE_INTEGRATION_PLAN.md`

## Do Not Load By Default

- Do not load all files in `docs/`.
- Do not load `brain/` unless the task explicitly names files inside it.
- Do not load `templates/` unless the task explicitly names files inside it.
- Do not scan the entire repository unless the task explicitly requires it.

## Next Task

TASK-0116 Add init adapter examples.
