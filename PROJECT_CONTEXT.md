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
- TASK-0137: Add init pipeline filesystem writer smoke tests.
- TASK-0138: Design aeos init explicit write mode CLI flag.
- TASK-0139: Implement aeos init --write flag skeleton.
- TASK-0140: Wire aeos init --write to filesystem adapter.
- TASK-0141: Add init write mode safety and artifact availability review.
- TASK-0142: Provide minimal writable init artifact fixture.
- TASK-0143: Add init write mode safety review.
- TASK-0144: Add init write mode documentation.
- TASK-0145: Add init write mode final smoke review.
- TASK-0146: Define Project Intelligence Layer design.
- TASK-0147: Implement project intelligence contracts.
- TASK-0148: Add project intelligence contract examples.
- TASK-0149: Implement project intelligence detector design.
- TASK-0150: Implement intelligence detector input contracts.
- TASK-0151: Add intelligence detector input examples.
- TASK-0152: Implement deterministic project scan entry collector.
- TASK-0153: Add project scan collector examples.
- TASK-0154: Add project scan collector smoke tests.
- TASK-0155: Implement intelligence signal definitions.
- TASK-0156: Add intelligence signal definition examples.

## Do Not Load By Default

- Do not load all files in `docs/`.
- Do not load `brain/` unless the task explicitly names files inside it.
- Do not load `templates/` unless the task explicitly names files inside it.
- Do not scan the entire repository unless the task explicitly requires it.

## Next Task

TASK-0157 Implement intelligence signal matcher.

## Current Plans

- docs/INIT_CLI_IMPLEMENTATION_PLAN.md
- docs/INIT_GENERATION_IMPLEMENTATION_PLAN.md
- docs/INIT_WRITE_MODE_CLI_DESIGN.md
- docs/PROJECT_INTELLIGENCE_LAYER_DESIGN.md
- docs/PROJECT_INTELLIGENCE_DETECTOR_IMPLEMENTATION_PLAN.md
