# AEOS Init Pipeline Integration Plan

## Purpose
Define the integration plan for connecting AEOS init pipeline stages to the
existing project, template, memory, and core capabilities.

This plan does not implement adapters or production init behavior. It defines
the package boundaries, stage data flow, validation flow, and first integration
tasks needed before an `aeos init` command can be exposed.

## Integration Goal
Integrate the side-effect-free init pipeline contracts with package-owned
capabilities through narrow adapters.

The integration should let `core` orchestrate the fixed init stages while
delegating domain behavior to the owning packages:

- `projects` provides project root and metadata facts.
- `templates` provides local template discovery, selection, variable
  resolution, rendering, and render validation facts.
- `memory` remains a future persistence boundary and only receives
  memory-ready summaries later.
- `core` owns orchestration, issue normalization, stage ordering, artifact
  aggregation, validation summary assembly, and public result shaping.

Dependency direction remains:

`core -> projects -> templates -> memory`

## Current Foundation Status
- `packages/core/src/init.ts` defines init request, template selection,
  variable map, generated file, validation, issue, and result contracts.
- `packages/core/src/init-engine.ts` defines init stages, execution plan, stage
  result, artifact summary, execution context, stage handler, and pipeline
  result contracts.
- `packages/core/src/init-executor.ts` implements fixed-stage orchestration,
  handler invocation, stage skipping after blocking failures, generated-file
  aggregation, validation summary assembly, and public init result shaping.
- `packages/projects/src/index.ts` exports project root detection and metadata
  reader APIs.
- `packages/templates/src/index.ts` exports local template discovery, explicit
  selection, variable resolution, rendering, and render validation APIs.
- `packages/memory/src/index.ts` exports memory validation, indexing, writer,
  and storage helpers, but init integration must not write memory entries in
  the MVP.

## Component Mapping

### Project -> Init Stages
Project APIs map only to `project_detection`.

- Use `detectProjectRoot` to prove the requested root or nearest project root.
- Use `readProjectMetadata` to collect concise metadata facts when detection
  succeeds.
- Convert project detection and metadata issues into `InitIssue` values.
- Emit project root, marker, and metadata summaries as init artifacts.

### Template -> Init Stages
Template APIs map to `template_selection`, `variable_resolution`, and
`rendering`.

- Use `discoverTemplates` and `selectTemplate` for explicit local selection.
- Use `resolveTemplateVariables` and missing-variable helpers for deterministic
  variable resolution.
- Use `renderTemplate` and `validateRenderResult` to build and validate planned
  generated-file artifacts without writing files.
- Convert template discovery, selection, variable, render, and validation
  issues into `InitIssue` values.

### Memory -> Init Stages
Memory APIs do not map to mutating MVP init stages.

- The integration may shape memory-ready facts after validation.
- The MVP must not call memory write or storage helpers.
- Future memory persistence must remain behind explicit memory policy and a
  separate task.

### Core Executor -> Orchestration
Core executor owns the orchestration surface.

- Keep the fixed stage order in `defaultInitPipelineStages`.
- Keep stage handlers replaceable through the existing handler map.
- Keep adapter implementation separate from generic executor mechanics.
- Aggregate errors, generated files, validation, and public result fields in
  core-owned result shapes.

## Adapter Boundaries
Adapters should be narrow functions that translate between package return
types and init stage results.

Adapter responsibilities:

- call exactly the package API needed for the stage;
- normalize expected failures into `InitIssue`;
- emit concise, non-secret artifacts;
- preserve only stage facts required by later stages;
- avoid broad repository reads or unrelated package behavior.

Adapter non-responsibilities:

- CLI parsing or output formatting;
- filesystem generation in the integration MVP;
- template registry or marketplace behavior;
- remote execution;
- AI agent orchestration;
- audit or memory persistence.

## Dependency Direction
Allowed dependency direction:

`core -> projects -> templates -> memory`

Integration must not introduce reverse dependencies from package source back
into `core` orchestration internals. Projects, templates, and memory packages
remain package-owned domain modules. Core adapts their public exports.

## Stage Input/Output Flow
1. `InitRequest` enters `executeInitPipeline`.
2. `createInitPipeline` derives the fixed stage plan, target root, template id,
   sorted variable names, and requested timestamp.
3. `project_detection` receives the request and emits project facts.
4. `template_selection` receives prior project facts and emits selected
   template facts.
5. `variable_resolution` receives selected template facts and emits resolved
   variable names and stage-private values for rendering.
6. `rendering` receives resolved variables and emits planned generated-file
   artifacts.
7. `file_writing` remains placeholder-only for this integration MVP and should
   not perform filesystem generation.
8. `validation` summarizes stage status, skipped stages, warnings, failures,
   and artifact evidence.
9. The executor returns `InitPipelineResult`; `createInitResult` shapes the
   public init result.

## Error Propagation
Expected package failures become structured `InitIssue` values on the relevant
stage result.

Rules:

- blocking failures mark the stage as `failure`;
- later stages are skipped until `validation`;
- warning-level package issues may be attached to successful stage results;
- unexpected thrown errors are caught by the executor and returned as
  `init_stage_unexpected_error`;
- public `errors` are collected from failed stages only.

## Artifact Flow
Artifacts should use `InitArtifactSummary`.

Allowed artifacts:

- detected project root and project marker summaries;
- concise project metadata summaries;
- selected template root, metadata path, id, and version summaries;
- resolved variable names only;
- planned render target paths and source paths;
- validation evidence summaries.

Artifacts must not include full rendered file content, secret values, broad
filesystem listings, or unrelated project context.

## Validation Flow
Validation should report the integration state without performing CLI behavior
or persistence.

Validation checks:

- project detection completed or failed;
- template selection completed or failed;
- variable resolution completed or failed;
- rendering completed or failed;
- file writing skipped in this integration MVP;
- audit facts are available but not persisted;
- memory facts are available but not persisted;
- generated-file artifacts are planned only.

Validation status uses the existing `pass`, `warn`, `fail`, and `skipped`
vocabulary.

## Audit Placeholder
The integration should expose audit-ready facts, but must not write audit
records.

Audit-ready facts:

- action: `init`;
- requested timestamp;
- target root;
- template id;
- variable names only;
- planned target paths;
- validation status;
- warnings and failures.

Durable audit persistence is later scope.

## CLI Placeholder
CLI init implementation is explicitly excluded.

Future CLI work may parse arguments, resolve caller roots, call the integrated
pipeline, format human output, emit JSON output, and map results to exit codes.
None of that belongs in this integration MVP.

## MVP Scope
- Add adapter contracts or helper shapes needed to connect public package APIs
  to init stage handlers.
- Implement project detection, template selection, variable resolution, and
  rendering adapters in later code tasks.
- Keep file writing as a skipped or blocked placeholder until filesystem
  generation is explicitly planned.
- Keep audit and memory as non-persistent summaries.
- Preserve deterministic stage ordering and package boundaries.
- Keep generated artifacts as planned summaries only.

Explicit MVP exclusions:

- CLI init implementation;
- filesystem generation;
- template registry;
- remote execution;
- AI agent orchestration.

## Later Scope
- Actual filesystem generation and conflict policy.
- CLI `aeos init` command.
- JSON and human CLI output.
- Template registry or marketplace lookup.
- Remote template execution.
- AI-assisted project or template orchestration.
- Audit persistence.
- Memory persistence.
- Rollback, backup, overwrite, merge, and force modes.

## First 15 Integration Tasks

1. TASK-0115: Implement init adapters.
   - Purpose: Add the adapter module that wires package-owned APIs into
     init stage handlers without changing executor mechanics.
   - Likely files: `packages/core/src/init-engine.ts`,
     `packages/core/src/init-executor.ts`.
   - Verification command: `pnpm --filter @aeos/core check`.
   - Recommended model effort: High.
   - Classification: Code.
2. TASK-0116: Add init adapter examples.
   - Purpose: Cover adapter success, expected package failures, issue
     normalization, and artifact summaries.
   - Likely files: `packages/core/src/init-executor.examples.ts`.
   - Verification command: `pnpm --filter @aeos/core check`.
   - Recommended model effort: Medium.
   - Classification: Code.
3. TASK-0117: Implement project detection integration adapter.
   - Purpose: Adapt project root detection and metadata reads into the
     `project_detection` stage.
   - Likely files: `packages/core/src/init-executor.ts`.
   - Verification command: `pnpm --filter @aeos/core check`.
   - Recommended model effort: Medium.
   - Classification: Code.
4. TASK-0118: Add project detection integration examples.
   - Purpose: Verify detected roots, missing roots, metadata read failures,
     and project artifact summaries.
   - Likely files: `packages/core/src/init-executor.examples.ts`.
   - Verification command: `pnpm --filter @aeos/core check`.
   - Recommended model effort: Low.
   - Classification: Code.
5. TASK-0119: Implement template selection integration adapter.
   - Purpose: Adapt local template discovery and explicit selection into the
     `template_selection` stage.
   - Likely files: `packages/core/src/init-executor.ts`.
   - Verification command: `pnpm --filter @aeos/core check`.
   - Recommended model effort: Medium.
   - Classification: Code.
6. TASK-0120: Add template selection integration examples.
   - Purpose: Verify missing templates root, duplicate template ids, template
     not found, and selected template artifacts.
   - Likely files: `packages/core/src/init-executor.examples.ts`.
   - Verification command: `pnpm --filter @aeos/core check`.
   - Recommended model effort: Low.
   - Classification: Code.
7. TASK-0121: Implement variable resolution integration adapter.
   - Purpose: Adapt template variable metadata and caller variables into the
     `variable_resolution` stage.
   - Likely files: `packages/core/src/init-executor.ts`.
   - Verification command: `pnpm --filter @aeos/core check`.
   - Recommended model effort: Medium.
   - Classification: Code.
8. TASK-0122: Add variable resolution integration examples.
   - Purpose: Verify required variables, defaults, unknown variables, empty
     values, and variable-name-only artifacts.
   - Likely files: `packages/core/src/init-executor.examples.ts`.
   - Verification command: `pnpm --filter @aeos/core check`.
   - Recommended model effort: Low.
   - Classification: Code.
9. TASK-0123: Implement rendering integration adapter.
   - Purpose: Adapt template rendering and render validation into a
     side-effect-free `rendering` stage.
   - Likely files: `packages/core/src/init-executor.ts`.
   - Verification command: `pnpm --filter @aeos/core check`.
   - Recommended model effort: High.
   - Classification: Code.
10. TASK-0124: Add rendering integration examples.
    - Purpose: Verify render success, unresolved placeholders, unsafe paths,
      duplicate targets, and planned generated-file artifacts.
    - Likely files: `packages/core/src/init-executor.examples.ts`.
    - Verification command: `pnpm --filter @aeos/core check`.
    - Recommended model effort: Medium.
    - Classification: Code.
11. TASK-0125: Add file writing placeholder integration.
    - Purpose: Make `file_writing` explicitly skipped or blocked for this MVP
      so no filesystem generation occurs.
    - Likely files: `packages/core/src/init-executor.ts`.
    - Verification command: `pnpm --filter @aeos/core check`.
    - Recommended model effort: Low.
    - Classification: Code.
12. TASK-0126: Add audit-ready summary integration.
    - Purpose: Produce audit-ready facts from request, stage artifacts, issues,
      and validation without writing audit records.
    - Likely files: `packages/core/src/init-engine.ts`,
      `packages/core/src/init-executor.ts`.
    - Verification command: `pnpm --filter @aeos/core check`.
    - Recommended model effort: Medium.
    - Classification: Code.
13. TASK-0127: Add memory-ready summary integration.
    - Purpose: Produce memory-ready facts from selected template, target root,
      planned files, and validation without calling memory persistence helpers.
    - Likely files: `packages/core/src/init-engine.ts`,
      `packages/core/src/init-executor.ts`.
    - Verification command: `pnpm --filter @aeos/core check`.
    - Recommended model effort: Medium.
    - Classification: Code.
14. TASK-0128: Review integration boundary behavior.
    - Purpose: Review dependency direction, adapter boundaries, excluded
      behavior, and stage artifact safety before CLI planning.
    - Likely files: `docs/INIT_PIPELINE_INTEGRATION_PLAN.md`,
      `TASKS/backlog.md`, `PROJECT_CONTEXT.md`.
    - Verification command: `git status --short`.
    - Recommended model effort: Medium.
    - Classification: Docs.
15. TASK-0129: Define filesystem generation follow-up plan.
    - Purpose: Plan conflict policy, write safety, rollback evidence, and
      validation before enabling real generation.
    - Likely files: `docs/INIT_PIPELINE_FILESYSTEM_PLAN.md`,
      `TASKS/backlog.md`, `PROJECT_CONTEXT.md`.
    - Verification command: `git status --short`.
    - Recommended model effort: Medium.
    - Classification: Docs.

## Stop Conditions Before aeos init command
- Do not implement CLI init until project, template, variable, and rendering
  adapters return structured stage results.
- Do not enable filesystem generation until a dedicated file writing plan and
  conflict policy are complete.
- Do not add template registry behavior until local explicit template selection
  is stable.
- Do not add remote execution.
- Do not add AI agent orchestration.
- Do not persist audit records.
- Do not persist memory records.
- Do not expose `aeos init` as production behavior until examples cover
  success, blocking failures, skipped file writing, validation summary, and
  audit-ready and memory-ready summaries.
