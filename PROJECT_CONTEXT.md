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
- Keep template recommendation read-only, deterministic, and separate from init.
- Keep agentic task execution externally verified, coverage-aware, auditable, and
  resumable without trusting model self-reporting.

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
- TASK-0173: Add smart template selection contract examples.
- TASK-0174: Implement smart template selector.
- TASK-0175: Add smart template selector examples.
- TASK-0176: Add smart template selector smoke tests.
- TASK-0177: Design smart template recommendation CLI.
- TASK-0178: Implement built-in smart template candidates.
- TASK-0179: Add built-in smart template candidate examples.
- TASK-0180: Add built-in smart template candidate smoke tests.
- TASK-0181: Implement aeos template recommend command.
- TASK-0182: Add template recommend JSON safety review.
- TASK-0183: Add template recommend documentation.
- TASK-0184: Add template recommend final smoke review.
- TASK-0185: Define agentic task lifecycle design.

## Do Not Load By Default

- Do not load all files in `docs/`.
- Do not load `brain/` unless the task explicitly names files inside it.
- Do not load `templates/` unless the task explicitly names files inside it.
- Do not scan the entire repository unless the task explicitly requires it.

## Next Task

TASK-0186 Implement agentic task lifecycle contracts.

## Current Plans

- docs/INIT_CLI_IMPLEMENTATION_PLAN.md
- docs/INIT_GENERATION_IMPLEMENTATION_PLAN.md
- docs/INIT_WRITE_MODE_CLI_DESIGN.md
- docs/PROJECT_INTELLIGENCE_LAYER_DESIGN.md
- docs/PROJECT_INTELLIGENCE_DETECTOR_IMPLEMENTATION_PLAN.md
- docs/PROJECT_PROFILE_COMMAND_DESIGN.md
- docs/SMART_INIT_TEMPLATE_SELECTION_DESIGN.md
- docs/AGENTIC_TASK_LIFECYCLE_DESIGN.md
- docs/TEMPLATE_RECOMMEND_COMMAND_DESIGN.md
