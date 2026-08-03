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
- Keep generation planning dependency-free and side-effect free until file writes
  are explicitly implemented.

## Recent Completed Tasks

- TASK-0121: Define aeos init CLI implementation plan.
- TASK-0122: Implement aeos init command.
- TASK-0123: Complete init command JSON and safety review.
- TASK-0124: Define init generation design.
- TASK-0125: Implement generation contracts.
- TASK-0126: Add generation contract examples.
- TASK-0127: Implement generation engine design.
- TASK-0128: Add generation engine examples.
- TASK-0129: Integrate generation engine into init pipeline.
- TASK-0130: Add init pipeline generation smoke examples.
- TASK-0131: Implement filesystem generation adapter design.
- TASK-0132: Add filesystem generation adapter examples.
- TASK-0133: Implement safe filesystem generation writer.
- TASK-0134: Add safe filesystem generation writer examples.
- TASK-0135: Add filesystem generation writer smoke tests.
- TASK-0136: Integrate filesystem writer into init pipeline safe mode.

## Do Not Load By Default

- Do not load all files in `docs/`.
- Do not load `brain/` unless the task explicitly names files inside it.
- Do not load `templates/` unless the task explicitly names files inside it.
- Do not scan the entire repository unless the task explicitly requires it.

## Next Task

TASK-0137 Add init pipeline filesystem writer smoke tests.

## Current Plans

- docs/INIT_CLI_IMPLEMENTATION_PLAN.md
- docs/INIT_GENERATION_IMPLEMENTATION_PLAN.md
