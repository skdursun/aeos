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
- Capture implementation plans before code changes.
- Define Template MVP before `aeos init`.
- Keep template work local, deterministic, dependency-free, and side-effect
  free until generation is explicitly implemented.
- Define `aeos init` before implementing init workflow code.

## Relevant Docs For Current Phase

- `AGENTS.md`
- `docs/PROJECT_MVP_IMPLEMENTATION_PLAN.md`
- `docs/PROJECT_COMMAND_IMPLEMENTATION_PLAN.md`
- `docs/PROJECT_CONTEXT_COMMAND_IMPLEMENTATION_PLAN.md`
- `docs/PROJECT_VALIDATE_IMPLEMENTATION_PLAN.md`
- `docs/TEMPLATE_MVP_IMPLEMENTATION_PLAN.md`
- `docs/TEMPLATE_DISCOVERY_IMPLEMENTATION_PLAN.md`
- `docs/TEMPLATE_RENDERING_IMPLEMENTATION_PLAN.md`
- `docs/INIT_IMPLEMENTATION_PLAN.md`
- `TASKS/backlog.md`

## Recent Completed Tasks

- TASK-0067: Implement remember command core flow.
- TASK-0068: Add remember command JSON output.
- TASK-0069: Implement memory persistence design.
- TASK-0070: Integrate remember command persistence.
- TASK-0071: Add remember persistence smoke review.
- TASK-0072: Implement aeos search command plan.
- TASK-0073: Implement aeos search command core flow.
- TASK-0074: Add search command JSON output.
- TASK-0075: Perform Memory MVP review.
- TASK-0076: Define Project MVP implementation plan.
- TASK-0077: Implement project package root detector.
- TASK-0078: Add project root detector typecheck examples.
- TASK-0079: Implement project metadata reader.
- TASK-0080: Add project metadata reader examples.
- TASK-0081: Implement project status command plan.
- TASK-0082: Implement project status command core flow.
- TASK-0083: Add project status JSON output.
- TASK-0084: Define project context command plan.
- TASK-0085: Implement project context command.
- TASK-0086: Add project context JSON output.
- TASK-0087: Define project validate command plan.
- TASK-0088: Implement project validate command.
- TASK-0089: Add project validate JSON output.
- TASK-0090: Perform Project MVP Review.
- TASK-0091: Define Template MVP implementation plan.
- TASK-0092: Implement template package metadata reader.
- TASK-0093: Add template metadata reader examples.
- TASK-0094: Define template discovery implementation plan.
- TASK-0095: Implement template discovery engine.
- TASK-0096: Add template discovery examples.
- TASK-0097: Implement template selection design.
- TASK-0098: Add template selection examples.
- TASK-0099: Define template rendering implementation plan.
- TASK-0100: Implement template variable resolver.
- TASK-0101: Add variable resolver examples.
- TASK-0102: Implement template rendering core flow.
- TASK-0103: Add renderer examples.
- TASK-0104: Perform template rendering review.
- TASK-0105: Define aeos init implementation plan.
- TASK-0106: Implement init workflow contracts.
- TASK-0107: Add init workflow contract examples.

## Do Not Load By Default

- Do not load all files in `docs/`.
- Do not load `brain/` unless the task explicitly names files inside it.
- Do not load `templates/` unless the task explicitly names files inside it.
- Do not scan the entire repository unless the task explicitly requires it.

## Next Task

TASK-0108 Define init execution engine plan.
