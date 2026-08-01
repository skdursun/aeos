# AEOS Init Pipeline Implementation Plan

## Purpose
Define the implementation plan for the AEOS init execution pipeline.

This plan describes how the init engine will orchestrate existing Project,
Template, Memory, and Core capabilities without implementing pipeline code.

## Pipeline Goal
The init pipeline should execute a deterministic local `aeos init` flow from an
explicit request to a structured result.

The MVP pipeline accepts:

- a target project root;
- an explicit template id;
- caller-supplied variables;
- an optional local templates root.

The MVP pipeline returns:

- ordered stage results;
- generated artifact summaries;
- validation status;
- structured errors;
- audit-ready and memory-ready summaries without persistence.

## Current Foundation Status
- `packages/core/src/init.ts` defines the init request, render input, generated
  file, validation, issue, and result contracts.
- `packages/core/src/init-engine.ts` defines pipeline stages, execution plan,
  stage result, artifact summary, execution context, stage handler, and pipeline
  result contracts.
- `@aeos/projects` exposes project root detection and project metadata readers.
- `@aeos/templates` exposes template discovery, explicit selection, variable
  substitution, rendering, and render result validation helpers.
- `@aeos/memory` exposes memory storage helpers, but init must not write memory
  entries in the MVP.
- The missing foundation is the executor that orders stages, adapts package
  results into init issues, applies validated writes, and reports the final
  `InitPipelineResult` or `InitResult`.

## Pipeline Architecture
The pipeline lives in `core` as orchestration over package-owned behavior.

Boundary rules:

- `core` owns init contracts, execution ordering, issue normalization, result
  aggregation, and validation summary assembly.
- `projects` owns project root detection and project metadata facts.
- `templates` owns local template discovery, selection, variable substitution,
  render validation, and template-owned safety helpers.
- `memory` owns future memory persistence and indexing helpers.
- CLI owns argument parsing, human output, JSON output, and exit codes.

Dependency direction remains:

`core -> projects -> templates -> memory`

The pipeline must use narrow adapters around package APIs. It must not scan
unrelated repository context, add dependencies, deploy, invoke agents, or write
audit or memory records in the MVP.

## Stage Ordering
The MVP stage order is fixed:

1. `project_detection`
2. `template_selection`
3. `variable_resolution`
4. `rendering`
5. `file_writing`
6. `validation`

Each stage receives the accumulated `InitExecutionContext` and returns an
`InitStageResult`. A stage may add artifacts and issues, but must not mutate
package-owned data structures in place.

## Stage Responsibilities

### project_detection
Purpose: prove the target project root and collect project facts.

Responsibilities:

- resolve the requested target root;
- call `detectProjectRoot` from `@aeos/projects`;
- read project metadata with `readProjectMetadata` when detection succeeds;
- record marker and metadata facts as artifacts;
- convert expected project failures into `InitIssue` values.

Non-responsibilities:

- creating project files;
- modifying `PROJECT_CONTEXT.md` or `AGENTS.md`;
- creating `.aeos/`;
- scanning unrelated directories.

### template_selection
Purpose: select exactly one local template from an explicit template id.

Responsibilities:

- discover local templates through `discoverTemplates`;
- select the requested template through `selectTemplate`;
- normalize discovery and selection issues into init issues;
- preserve selected template path, metadata, id, and version for later stages.

Non-responsibilities:

- automatic template matching;
- remote template lookup;
- marketplace behavior;
- AI-assisted selection.

### variable_resolution
Purpose: produce a complete variable map before rendering.

Responsibilities:

- compare caller variables against selected template metadata;
- require all declared required variables;
- apply optional defaults when declared by template metadata;
- reject unknown variables by default;
- reject empty required values;
- expose sorted variable names for result reporting.

Non-responsibilities:

- interactive prompting;
- secret lookup;
- memory lookup;
- model-based variable inference.

### rendering
Purpose: build a side-effect-free render plan.

Responsibilities:

- read only files declared by the selected template metadata;
- render text content with the resolved variable map;
- call template rendering validation helpers;
- validate unresolved placeholders;
- validate duplicate target paths and unsafe target paths before writing;
- produce planned generated-file artifacts.

Non-responsibilities:

- creating directories;
- writing files;
- overwriting existing targets.

### file_writing
Purpose: apply a validated render plan under the target root.

Responsibilities:

- precheck all planned target files for conflicts;
- reuse existing parent directories when safe;
- create missing parent directories under the target root;
- write only declared planned files;
- record generated file summaries and created paths;
- fail before writes when blocking issues exist.

Non-responsibilities:

- overwrite, force, merge, or backup modes;
- deleting created files as implicit rollback;
- writing outside the target root.

### validation
Purpose: summarize pipeline correctness and generation evidence.

Responsibilities:

- report checks for project detection, template selection, variable
  resolution, rendering, path safety, conflicts, file writing, and generated
  file existence;
- classify validation as `pass`, `warn`, `fail`, or `skipped`;
- include skipped checks when earlier stages block execution;
- produce the final validation summary used by result reporting.

Non-responsibilities:

- formatting CLI output;
- writing audit records;
- writing memory records.

## Stage Error Handling
Expected user-correctable failures should become structured `InitIssue` values.

Expected failures include:

- missing or invalid project root;
- project root not found;
- missing templates root;
- unreadable templates root;
- missing template id;
- template not found;
- duplicate or ambiguous template id;
- missing required variables;
- unknown variables;
- empty required variable values;
- unresolved placeholders;
- unsafe target paths;
- duplicate target paths;
- target file conflicts;
- write failures;
- post-write validation failures.

Unexpected filesystem or internal errors may occur inside adapters, but the
pipeline entrypoint should catch them and return a failed result with an
internal init issue.

## Partial Failure Strategy
The MVP should prevent partial writes through preflight checks.

Rules:

- stages after a failed blocking stage are skipped until `validation`;
- rendering must complete and pass safety checks before `file_writing`;
- `file_writing` must conflict-check all targets before creating or writing;
- if a write fails after generation starts, the result must preserve evidence
  of created files and failed targets;
- automatic rollback is later scope and must be designed separately.

## Artifact Tracking
Each stage should report artifacts through `InitArtifactSummary`.

Tracked artifacts should include:

- detected project root and markers;
- project metadata summary;
- selected template metadata path;
- selected template root;
- resolved variable names only;
- render plan source and target paths;
- generated files;
- validation summary evidence.

Artifact tracking must not include secret values or full rendered content.

## Result Reporting
The executor should aggregate stage results into `InitPipelineResult`.

The public init result should include:

- `ok`;
- project root;
- selected template;
- variable names used;
- render input or render plan summary;
- generated files;
- validation summary;
- errors.

CLI output should be a later adapter over this result and should not be mixed
into the pipeline executor.

## Audit Integration Placeholder
The MVP should expose audit-ready facts but must not persist audit records.

Audit-ready facts:

- action: `init`;
- requested timestamp;
- target root;
- template id;
- variable names only;
- planned target paths;
- generated target paths;
- conflicts;
- validation status.

Durable audit writing requires a later explicit task.

## Memory Integration Placeholder
The MVP should expose memory-ready facts but must not write memory entries.

Memory-ready facts:

- target root;
- selected template id;
- generated file paths;
- validation status;
- major warnings or failures.

Future memory persistence must use `@aeos/memory` helpers and explicit policy.

## CLI Integration Placeholder
CLI integration is later scope for this plan.

The CLI should eventually:

- parse `aeos init` arguments;
- resolve the caller's project root and templates root;
- call the pipeline executor;
- render human output;
- render JSON output when requested;
- map result status to exit codes.

The executor should remain independent from CLI formatting and process exits.

## MVP Scope
- Build a fixed ordered executor for the six stages.
- Require explicit template id and explicit variables.
- Use local templates only.
- Run deterministic preflight before file writing.
- Block target file conflicts by default.
- Return structured stage results and validation.
- Track generated artifact summaries.
- Expose audit-ready and memory-ready summaries without persistence.

## Later Scope
- Dry-run mode.
- Force, overwrite, merge, and backup policies.
- Automatic rollback.
- Interactive variable prompting.
- Memory-backed variable suggestions.
- Audit persistence.
- CLI command integration.
- JSON output integration.
- Remote template registries.
- Template category matching.
- Project bootstrap when no root exists.

## First 15 Pipeline Implementation Tasks

1. TASK-0112: Implement init pipeline executor.
   - Purpose: Add the fixed-stage executor that builds an execution plan,
     invokes stage handlers in order, skips blocked stages, and returns an
     `InitPipelineResult`.
   - Likely files: `packages/core/src/init-engine.ts`.
   - Verification command: `pnpm --filter @aeos/core check`.
   - Recommended model effort: High.
   - Classification: Code.
2. TASK-0113: Add init pipeline executor examples.
   - Purpose: Cover successful ordering, stage skipping, error aggregation, and
     generated file aggregation with focused examples.
   - Likely files: `packages/core/src/init-engine.examples.ts`.
   - Verification command: `pnpm --filter @aeos/core check`.
   - Recommended model effort: Medium.
   - Classification: Code.
3. TASK-0114: Implement init request preflight validation.
   - Purpose: Validate project root, template id, template selection shape, and
     variable map shape before stage execution.
   - Likely files: `packages/core/src/init.ts`, `packages/core/src/init-engine.ts`.
   - Verification command: `pnpm --filter @aeos/core check`.
   - Recommended model effort: Medium.
   - Classification: Code.
4. TASK-0115: Implement project detection stage adapter.
   - Purpose: Adapt `detectProjectRoot` and `readProjectMetadata` results into
     pipeline stage results and artifacts.
   - Likely files: `packages/core/src/init-engine.ts`.
   - Verification command: `pnpm --filter @aeos/core check`.
   - Recommended model effort: Medium.
   - Classification: Code.
5. TASK-0116: Add project detection stage examples.
   - Purpose: Verify detected roots, missing starts, project-root failures, and
     metadata artifact summaries.
   - Likely files: `packages/core/src/init-engine.examples.ts`.
   - Verification command: `pnpm --filter @aeos/core check`.
   - Recommended model effort: Low.
   - Classification: Code.
6. TASK-0117: Implement template selection stage adapter.
   - Purpose: Adapt template discovery and explicit selection into stage
     results while preserving selected template facts for later stages.
   - Likely files: `packages/core/src/init-engine.ts`.
   - Verification command: `pnpm --filter @aeos/core check`.
   - Recommended model effort: Medium.
   - Classification: Code.
7. TASK-0118: Add template selection stage examples.
   - Purpose: Verify missing templates root, template not found, ambiguous
     selection, and successful selection artifacts.
   - Likely files: `packages/core/src/init-engine.examples.ts`.
   - Verification command: `pnpm --filter @aeos/core check`.
   - Recommended model effort: Low.
   - Classification: Code.
8. TASK-0119: Implement variable resolution stage adapter.
   - Purpose: Resolve declared template variables, enforce required values,
     apply defaults, reject unknown variables, and report variable names only.
   - Likely files: `packages/core/src/init-engine.ts`.
   - Verification command: `pnpm --filter @aeos/core check`.
   - Recommended model effort: Medium.
   - Classification: Code.
9. TASK-0120: Add variable resolution stage examples.
   - Purpose: Verify required variables, defaults, unknown variables, empty
     required values, and deterministic variable-name reporting.
   - Likely files: `packages/core/src/init-engine.examples.ts`.
   - Verification command: `pnpm --filter @aeos/core check`.
   - Recommended model effort: Low.
   - Classification: Code.
10. TASK-0121: Implement render plan stage.
    - Purpose: Read declared template files, render content, validate unresolved
      placeholders, and produce planned generated-file artifacts without writes.
    - Likely files: `packages/core/src/init-engine.ts`.
    - Verification command: `pnpm --filter @aeos/core check`.
    - Recommended model effort: High.
    - Classification: Code.
11. TASK-0122: Add render plan stage examples.
    - Purpose: Verify render success, missing placeholders, duplicate targets,
      unsafe target paths, and planned artifact summaries.
    - Likely files: `packages/core/src/init-engine.examples.ts`.
    - Verification command: `pnpm --filter @aeos/core check`.
    - Recommended model effort: Medium.
    - Classification: Code.
12. TASK-0123: Implement file writing stage.
    - Purpose: Precheck conflicts, create safe parent directories, write planned
      files, and report created or blocked generated files.
    - Likely files: `packages/core/src/init-engine.ts`.
    - Verification command: `pnpm --filter @aeos/core check`.
    - Recommended model effort: High.
    - Classification: Code.
13. TASK-0124: Add file writing stage examples.
    - Purpose: Verify conflict blocking, safe directory creation, successful
      writes, and write failure evidence.
    - Likely files: `packages/core/src/init-engine.examples.ts`.
    - Verification command: `pnpm --filter @aeos/core check`.
    - Recommended model effort: Medium.
    - Classification: Code.
14. TASK-0125: Implement init validation summary builder.
    - Purpose: Aggregate stage checks, skipped checks, warnings, failures, and
      generated-file evidence into the final validation summary.
    - Likely files: `packages/core/src/init-engine.ts`, `packages/core/src/init.ts`.
    - Verification command: `pnpm --filter @aeos/core check`.
    - Recommended model effort: Medium.
    - Classification: Code.
15. TASK-0126: Review init pipeline MVP behavior.
    - Purpose: Review stage boundaries, result shape, failure handling,
      artifact tracking, and remaining gaps before CLI integration.
    - Likely files: `docs/INIT_PIPELINE_IMPLEMENTATION_PLAN.md`,
      `TASKS/backlog.md`, `PROJECT_CONTEXT.md`.
    - Verification command: `git status --short`.
    - Recommended model effort: Medium.
    - Classification: Docs.

## Stop Conditions Before Full Init
- Do not start CLI integration until the pipeline executor returns structured
  results for all six stages.
- Do not add audit persistence until audit-ready facts are reviewed.
- Do not add memory persistence until memory-ready facts and policy are
  reviewed.
- Do not add force, overwrite, merge, backup, or rollback behavior until file
  writing conflict behavior is stable.
- Do not implement project bootstrap until root detection failure behavior is
  explicitly planned.
- Do not expose `aeos init` as production behavior until examples cover
  success, blocking failures, partial write evidence, and validation summary
  reporting.
