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
- TASK-0254: Implement task plan file planner wiring contracts.
- TASK-0255: Add task plan file planner wiring contract examples.
- TASK-0256: Add task plan file planner wiring contract smoke tests.
- TASK-0257: Implement task plan file planner wiring logic.
- TASK-0258: Add task plan file planner wiring logic examples.
- TASK-0259: Add task plan file planner wiring logic smoke tests.
- TASK-0260: Add task plan file planner wiring safety review.
- TASK-0261: Add task plan file planner wiring documentation.
- TASK-0262: Add task plan file planner wiring final safety review.
- TASK-0263: Design CLI task plan parser-mapper-planner integration.
- TASK-0264: Implement CLI task plan planner integration contracts.
- TASK-0265: Add CLI task plan planner integration contract examples.
- TASK-0266: Add CLI task plan planner integration contract smoke tests.
- TASK-0267: Implement CLI task plan planner integration logic.
- TASK-0268: Add CLI task plan planner integration logic examples.
- TASK-0269: Add CLI task plan planner integration logic smoke tests.
- TASK-0270: Add CLI task plan planner integration safety review.
- TASK-0271: Add CLI task plan planner integration documentation.
- TASK-0272: Add CLI task plan planner integration final safety review.
- TASK-0273: Implement CLI task plan command planner integration.

## Do Not Load By Default

- Do not load all files in `docs/`.
- Do not load `brain/` unless the task explicitly names files inside it.
- Do not load `templates/` unless the task explicitly names files inside it.
- Do not scan the entire repository unless the task explicitly requires it.

## Next Task

TASK-0274 Add CLI task plan command planner integration safety review.

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
- docs/CLI_TASK_PLAN_PARSER_MAPPER_PLANNER_INTEGRATION_DESIGN.md
