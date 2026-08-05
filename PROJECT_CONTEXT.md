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
- Keep project intelligence and template recommendation deterministic,
  evidence-based, local-first, and fallback safe.
- Keep agentic task execution externally verified, coverage-aware, policy-gated,
  auditable, and resumable without trusting model self-reporting.
- Keep the agentic runner deterministic, local-first, auditable, resumable, and
  verifier-gated.

## Recent Completed Tasks

- TASK-0249: Add task contract mapping logic smoke tests.
- TASK-0250: Add task contract mapping safety review.
- TASK-0251: Add task contract mapping documentation.
- TASK-0252: Add task contract mapping final safety review.
- TASK-0253: Wire task plan file mapping to planner design.

## Do Not Load By Default

- Do not load all files in `docs/`.
- Do not load `brain/` unless the task explicitly names files inside it.
- Do not load `templates/` unless the task explicitly names files inside it.
- Do not scan the entire repository unless the task explicitly requires it.

## Next Task

TASK-0254 Implement task plan file planner wiring contracts.

## Current Plans

- docs/AGENTIC_TASK_LIFECYCLE_DESIGN.md
- docs/AGENTIC_COVERAGE_VERIFIER_DESIGN.md
- docs/AGENTIC_RUNNER_ARCHITECTURE.md
- docs/AGENTIC_RUNNER_PLANNING_LOGIC.md
- docs/AGENTIC_RUNNER_PLANNING_USAGE.md
- docs/AGENTIC_RUNNER_EXECUTION_LIFECYCLE.md
- docs/AGENTIC_RUNNER_DRY_RUN_EXECUTION_LOGIC.md
- docs/TASK_PLAN_INPUT_FILE_DESIGN.md
- docs/TASK_PLAN_INPUT_PARSER_USAGE.md
- docs/TASK_CONTRACT_TO_RUNNER_PLANNING_MAPPING.md
- docs/TASK_CONTRACT_MAPPING_USAGE.md
- docs/TASK_PLAN_FILE_TO_PLANNER_WIRING_DESIGN.md
