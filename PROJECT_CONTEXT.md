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
- TASK-0210: Add agentic runner planning safety review.
- TASK-0211: Add agentic runner planning documentation.
- TASK-0212: Add agentic runner planning final safety review.
- TASK-0213: Design agentic runner execution lifecycle.
- TASK-0214: Implement agentic runner execution contracts.
- TASK-0215: Add agentic runner execution contract examples.
- TASK-0216: Add agentic runner execution contract smoke tests.
- TASK-0217: Design agentic runner dry-run execution logic.
- TASK-0218: Implement agentic runner dry-run execution contracts.
- TASK-0219: Add agentic runner dry-run contract examples.
- TASK-0220: Add agentic runner dry-run contract smoke tests.
- TASK-0221: Implement agentic runner dry-run execution logic.
- TASK-0222: Add agentic runner dry-run logic examples.
- TASK-0223: Add agentic runner dry-run logic smoke tests.
- TASK-0224: Add agentic runner dry-run safety review.
- TASK-0225: Add agentic runner dry-run documentation.
- TASK-0226: Add agentic runner dry-run final safety review.
- TASK-0227: Design agentic task CLI surface.
- TASK-0228: Implement agentic task CLI contract/output design.
- TASK-0229: Implement aeos task plan command skeleton.
- TASK-0230: Add task plan skeleton JSON safety review.
- TASK-0231: Implement task plan input contract file parsing design.
- TASK-0232: Implement task plan input file parser contracts.
- TASK-0233: Add task plan input parser contract examples.
- TASK-0234: Add task plan input parser contract smoke tests.
- TASK-0235: Implement task plan input parser logic.

## Do Not Load By Default

- Do not load all files in `docs/`.
- Do not load `brain/` unless the task explicitly names files inside it.
- Do not load `templates/` unless the task explicitly names files inside it.
- Do not scan the entire repository unless the task explicitly requires it.

## Next Task

TASK-0236 Add task plan input parser logic examples.

## Current Plans

- docs/AGENTIC_TASK_LIFECYCLE_DESIGN.md
- docs/AGENTIC_COVERAGE_VERIFIER_DESIGN.md
- docs/AGENTIC_RUNNER_ARCHITECTURE.md
- docs/AGENTIC_RUNNER_PLANNING_LOGIC.md
- docs/AGENTIC_RUNNER_PLANNING_USAGE.md
- docs/AGENTIC_RUNNER_EXECUTION_LIFECYCLE.md
- docs/AGENTIC_RUNNER_DRY_RUN_EXECUTION_LOGIC.md
- docs/TASK_PLAN_INPUT_FILE_DESIGN.md
