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

- TASK-0198: Add agentic coverage verifier final safety review.
- TASK-0199: Design agentic runner architecture.
- TASK-0200: Implement agentic runner contracts.
- TASK-0201: Add agentic runner contract examples.
- TASK-0202: Add agentic runner contract smoke tests.
- TASK-0203: Design agentic runner planning logic.
- TASK-0204: Implement agentic runner planning contracts.
- TASK-0205: Add agentic runner planning contract examples.
- TASK-0206: Add agentic runner planning contract smoke tests.
- TASK-0207: Implement agentic runner planning logic.
- TASK-0208: Add agentic runner planning logic examples.
- TASK-0209: Add agentic runner planning logic smoke tests.

## Do Not Load By Default

- Do not load all files in `docs/`.
- Do not load `brain/` unless the task explicitly names files inside it.
- Do not load `templates/` unless the task explicitly names files inside it.
- Do not scan the entire repository unless the task explicitly requires it.

## Next Task

TASK-0210 Add agentic runner planning safety review.

## Current Plans

- docs/AGENTIC_TASK_LIFECYCLE_DESIGN.md
- docs/AGENTIC_COVERAGE_VERIFIER_DESIGN.md
- docs/AGENTIC_RUNNER_ARCHITECTURE.md
- docs/AGENTIC_RUNNER_PLANNING_LOGIC.md
