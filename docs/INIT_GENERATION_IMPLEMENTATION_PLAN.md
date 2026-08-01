# AEOS Init Generation Implementation Plan

## Purpose
Define the implementation design for AEOS project generation after init pipeline
rendering.

This plan describes how rendered template output becomes generated project
files safely. It does not implement generation code, write project files, add
dependencies, deploy, automate GitHub, invoke AI code generation, use remote
templates, use marketplace templates, or create cloud resources.

## Generation Goal
Generation turns a validated rendered template result into local project files
under the requested project root.

The generation flow is:

```text
Rendered Template
        |
        v
Generation Plan
        |
        v
Conflict Check
        |
        v
Write Files
        |
        v
Validate Project
```

The MVP must be deterministic, local-only, dependency-free, and conservative:
all target paths are known before writes, conflicts block writes, and existing
files are never overwritten by default.

## Current Init Foundation Status
- `packages/core/src/init.ts` defines init request, result, validation, issue,
  generated file, and generated file status contracts.
- `packages/core/src/init-pipeline.ts` exposes the default init pipeline entry
  point and handler creation helpers.
- `packages/core/src/init-executor.ts` defines fixed stage ordering, result
  aggregation, generated file status collection, and validation summary
  assembly.
- `packages/templates/src/renderer.ts` renders string content and validates
  render result consistency.
- `packages/templates/src/index.ts` exports local template discovery,
  selection, metadata, variable resolution, rendering, and render validation
  APIs.
- The current pipeline already includes a `file_writing` stage name, but safe
  production generation still needs explicit generation contracts and
  implementation.

## Generation Architecture
Generation should live behind narrow contracts owned by `core`, with local
template rendering facts provided by `templates`.

Boundary rules:

- `core` owns generation plan contracts, conflict normalization, write
  orchestration, generated file status reporting, rollback evidence, and final
  validation summary integration.
- `templates` owns rendered content and template-origin facts such as source
  paths, target paths, and unresolved placeholder validation.
- CLI owns dry-run flags, confirmation, human output, JSON output, and exit
  codes.
- Generation must not read unrelated repository context or infer files outside
  the selected local template metadata.

Explicit exclusions:

- remote templates;
- deployment;
- GitHub automation;
- AI generated code;
- marketplace templates;
- cloud generation.

## Rendered Artifact Model
A rendered artifact is the smallest unit that may become one generated file.

Each artifact should carry:

- template source path;
- normalized relative target path;
- rendered text content or future binary content marker;
- content kind, initially `text`;
- summary safe for reporting;
- render validation status;
- template id and optional template version.

The artifact model must not include secrets in summaries, audit-ready facts, or
CLI JSON output.

## File Mapping Strategy
The generation plan maps rendered artifacts to absolute target paths under the
resolved project root.

Rules:

- accept only normalized relative target paths from render output;
- reject absolute target paths;
- reject empty target paths;
- reject `.` and parent traversal;
- reject duplicate target paths after normalization;
- keep source path and target path evidence for every planned file;
- sort planned files by target path for stable output and tests.

## Directory Creation Strategy
Generation may create missing parent directories only after the whole plan
passes safety and conflict checks.

Rules:

- create directories under the resolved project root only;
- create parent directories before writing each file;
- reuse existing directories when they are directories;
- fail if an expected parent directory path is an existing file;
- record created directories as rollback evidence, not as public generated
  files unless a later contract adds directory artifacts.

## Conflict Detection
Conflict detection is a preflight step that runs before any directory or file
write.

Blocking conflicts:

- target file already exists;
- target path resolves outside the project root;
- duplicate target paths in the generation plan;
- parent path exists as a file;
- target path is a directory;
- target path cannot be safely inspected.

Conflicts become structured `InitIssue` values and mark affected generated
files as `blocked`.

## Overwrite Protection
The MVP must not overwrite existing files.

Rules:

- no `force` mode in the MVP;
- no merge mode in the MVP;
- no backup-and-replace mode in the MVP;
- no partial overwrite of existing project metadata;
- existing target conflicts stop generation before writes.

Overwrite behavior is later scope and requires a separate design.

## Dry Run Strategy
Dry run builds the full generation plan and runs all safety checks without
creating directories or writing files.

Dry run should report:

- planned file count;
- planned target paths;
- detected conflicts;
- generated file statuses as `planned` or `blocked`;
- validation status;
- files written as zero.

Dry run must not persist audit records, memory records, Git changes, or
generated project files.

## Rollback Strategy
The MVP rollback strategy is prevention first.

Rules:

- preflight all path safety and conflict checks before writes;
- stop before writes when any blocking issue exists;
- if an unexpected write failure occurs after writing starts, preserve evidence
  of files created, directories created, and the failing target;
- do not automatically delete generated files in the MVP;
- do not create backups in the MVP.

Automatic rollback is later scope because deletion safety needs its own
contract and tests.

## Validation After Generation
Post-generation validation should confirm that the generation evidence matches
the plan.

Checks:

- generation plan existed;
- conflict check passed;
- every created file exists;
- no blocked file was written;
- generated file count matches successful writes;
- all created paths remain under the project root;
- render validation had no unresolved placeholders.

Validation uses `pass`, `warn`, `fail`, or `skipped` and feeds the existing
`InitValidationSummary` result contract.

## Audit Placeholder
Generation should expose audit-ready facts but must not persist audit records
in the MVP.

Audit-ready facts:

- project root;
- template id and version;
- variable names used;
- planned file count;
- created file count;
- blocked file count;
- validation status;
- issue codes.

## CLI Integration
The CLI should remain a thin adapter over the init pipeline.

Rules:

- `aeos init --dry-run` requests generation planning without writes;
- JSON mode reports one structured object and never prompts;
- human mode may show a confirmation summary before write-capable execution;
- CLI output should use generated file status values from core results;
- CLI must not perform file writes outside the pipeline.

## MVP Scope
- Local rendered text artifacts.
- Generation plan contracts.
- Path normalization and project-root containment checks.
- Duplicate target detection.
- Conflict detection against the filesystem.
- Parent directory creation under the target root.
- Safe file writes with no overwrite.
- Dry-run generation planning.
- Write failure reporting.
- Post-generation validation summary.
- Audit-ready facts without persistence.

## Later Scope
- Binary artifacts.
- Executable file mode handling.
- Explicit overwrite modes.
- Merge strategies.
- Backup creation.
- Automatic rollback.
- Project-specific validation hooks.
- Memory persistence.
- Audit persistence.
- Remote templates.
- Deployment.
- GitHub automation.
- AI generated code.
- Marketplace templates.
- Cloud generation.

## First 15 Generation Implementation Tasks

1. TASK-0125: Implement generation contracts.
   Purpose: Define generation plan, artifact, conflict, write result, and
   rollback evidence types.
   Likely files: `packages/core/src/init.ts`,
   `packages/core/src/init-generation.ts`, `packages/core/src/index.ts`.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: Medium.
   Classification: Code.

2. TASK-0126: Add generation contract examples.
   Purpose: Lock expected generation plan and result shapes with examples.
   Likely files: `packages/core/src/init-generation.examples.ts`.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: Low.
   Classification: Code.

3. TASK-0127: Implement target path normalization.
   Purpose: Convert rendered relative target paths into safe normalized plan
   paths.
   Likely files: `packages/core/src/init-generation.ts`.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: Medium.
   Classification: Code.

4. TASK-0128: Add target path safety examples.
   Purpose: Cover absolute paths, empty paths, parent traversal, and duplicate
   normalized paths.
   Likely files: `packages/core/src/init-generation.examples.ts`.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: Low.
   Classification: Code.

5. TASK-0129: Build generation plan from rendered artifacts.
   Purpose: Transform rendered template artifacts into stable sorted generation
   plan entries.
   Likely files: `packages/core/src/init-generation.ts`,
   `packages/core/src/init-adapters.ts`.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: High.
   Classification: Code.

6. TASK-0130: Add generation plan builder examples.
   Purpose: Verify source path preservation, target sorting, and generated file
   summaries.
   Likely files: `packages/core/src/init-generation.examples.ts`.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: Medium.
   Classification: Code.

7. TASK-0131: Implement generation conflict checker.
   Purpose: Detect existing files, directory targets, file parent blockers, and
   unsafe inspection failures before writes.
   Likely files: `packages/core/src/init-generation.ts`,
   `packages/core/src/init-adapters.ts`.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: High.
   Classification: Code.

8. TASK-0132: Add conflict checker examples.
   Purpose: Cover existing file, directory target, parent file, and no-conflict
   cases.
   Likely files: `packages/core/src/init-generation.examples.ts`.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: Medium.
   Classification: Code.

9. TASK-0133: Implement dry-run generation result.
   Purpose: Return planned and blocked generated file statuses without
   filesystem writes.
   Likely files: `packages/core/src/init-generation.ts`,
   `packages/core/src/init-adapters.ts`.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: Medium.
   Classification: Code.

10. TASK-0134: Add dry-run generation examples.
    Purpose: Prove dry run creates no directories or files and reports planned
    output.
    Likely files: `packages/core/src/init-generation.examples.ts`.
    Verification command: `pnpm --filter @aeos/core check`.
    Recommended model effort: Medium.
    Classification: Code.

11. TASK-0135: Implement safe directory creation.
    Purpose: Create missing parent directories under the project root after all
    preflight checks pass.
    Likely files: `packages/core/src/init-generation.ts`,
    `packages/core/src/init-adapters.ts`.
    Verification command: `pnpm --filter @aeos/core check`.
    Recommended model effort: Medium.
    Classification: Code.

12. TASK-0136: Implement safe file writes.
    Purpose: Write planned files without overwrite and report created file
    evidence.
    Likely files: `packages/core/src/init-generation.ts`,
    `packages/core/src/init-adapters.ts`.
    Verification command: `pnpm --filter @aeos/core check`.
    Recommended model effort: High.
    Classification: Code.

13. TASK-0137: Add write failure reporting.
    Purpose: Preserve created path evidence and failing target issues when an
    unexpected write failure happens.
    Likely files: `packages/core/src/init-generation.ts`,
    `packages/core/src/init-generation.examples.ts`.
    Verification command: `pnpm --filter @aeos/core check`.
    Recommended model effort: Medium.
    Classification: Code.

14. TASK-0138: Integrate generation with file writing stage.
    Purpose: Connect generation planning, conflict checking, dry run, and safe
    writes to the existing `file_writing` stage.
    Likely files: `packages/core/src/init-adapters.ts`,
    `packages/core/src/init-executor.ts`.
    Verification command: `pnpm --filter @aeos/core check`.
    Recommended model effort: High.
    Classification: Code.

15. TASK-0139: Review generation MVP behavior.
    Purpose: Confirm production stop conditions, exclusions, validation output,
    and CLI integration assumptions before enabling write-capable init.
    Likely files: `docs/INIT_GENERATION_IMPLEMENTATION_PLAN.md`,
    `PROJECT_CONTEXT.md`.
    Verification command: `git status --short`.
    Recommended model effort: Medium.
    Classification: Docs.

## Stop Conditions Before Production Generation
- Generation contracts are missing or unstable.
- Rendered artifacts do not expose safe relative target paths.
- Any target path escapes the project root.
- Duplicate normalized target paths exist.
- Any target conflict exists.
- Dry run cannot prove zero writes.
- Write failures do not preserve created-path evidence.
- Post-generation validation cannot confirm created file existence.
- CLI confirmation and JSON reporting are inconsistent with core results.
- Any excluded scope is required to complete generation.
