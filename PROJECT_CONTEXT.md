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
- Keep `aeos init` filesystem writes behind explicit CLI intent.
- Keep project intelligence deterministic, evidence-based, and local-first.
- Keep smart init/template selection deterministic, local-first, and fallback
  safe.

## Recent Completed Tasks

- TASK-0146 through TASK-0165: Defined and implemented deterministic Project
  Intelligence contracts, scan collection, signals, matching, profile building,
  detector orchestration, examples, and smoke tests.
- TASK-0166: Design aeos project profile command.
- TASK-0167: Implement aeos project profile command.
- TASK-0168: Add project profile JSON safety review.
- TASK-0169: Add project profile documentation.
- TASK-0170: Add project profile final smoke review.
- TASK-0171: Design smart init/template selection.
- TASK-0172: Implement smart template selection contracts.

## Do Not Load By Default

- Do not load all files in `docs/`.
- Do not load `brain/` unless the task explicitly names files inside it.
- Do not load `templates/` unless the task explicitly names files inside it.
- Do not scan the entire repository unless the task explicitly requires it.

## Next Task

TASK-0173 Add smart template selection contract examples.

## Current Plans

- docs/INIT_CLI_IMPLEMENTATION_PLAN.md
- docs/INIT_GENERATION_IMPLEMENTATION_PLAN.md
- docs/INIT_WRITE_MODE_CLI_DESIGN.md
- docs/PROJECT_INTELLIGENCE_LAYER_DESIGN.md
- docs/PROJECT_INTELLIGENCE_DETECTOR_IMPLEMENTATION_PLAN.md
- docs/PROJECT_PROFILE_COMMAND_DESIGN.md
- docs/SMART_INIT_TEMPLATE_SELECTION_DESIGN.md
