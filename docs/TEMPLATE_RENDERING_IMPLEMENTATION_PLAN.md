# AEOS Template Rendering Implementation Plan

## Purpose
Define the implementation plan for AEOS template rendering before `aeos init`
is implemented.

This plan describes how a selected local template becomes a generated project
file structure through deterministic package helpers.

## Template Rendering Goal
Template rendering should transform:

- selected template metadata;
- resolved variables;
- source files from the selected local template;

into:

- a generated project structure under an explicit target root.

Rendering must be local, deterministic, dependency-free, and testable through
`@aeos/templates` package checks.

## Non-goals
- Do not implement `aeos init`.
- Do not choose a template engine yet.
- Do not add dependencies.
- Do not modify existing template directories in planning tasks.
- Do not implement remote templates.
- Do not implement marketplace behavior.
- Do not implement cloud rendering.
- Do not implement AI generated files.
- Do not implement deployment automation.
- Do not implement GitHub sync.
- Do not implement interactive prompting.
- Do not write files during render plan creation.

## Current Template Foundation Status
- `@aeos/templates` exports metadata reading, local discovery, and explicit
  selection helpers.
- Template metadata currently includes `id`, `name`, `description`, `version`,
  `variables`, `requiredFiles`, and `optionalFiles`.
- Discovery reads direct child template directories from an explicit root and
  uses `template.json` metadata.
- Selection requires an explicit template ID and returns selected metadata.
- `@aeos/projects` exposes project root and project metadata helpers for later
  target-root integration.
- No variable resolver, source file reader, render plan builder, safe writer, or
  rendering verification hook exists yet.

## Rendering Pipeline
1. Accept a selected template result from `selectTemplate`.
2. Accept caller-provided variables as plain string values.
3. Resolve variables against template metadata defaults and requirements.
4. Read declared source files from the selected template path.
5. Map each declared source file to a target relative project path.
6. Substitute resolved variables in renderable text files.
7. Produce a render plan containing target paths, rendered content, and issues.
8. Validate that every planned target is declared, relative, and inside target
   scope.
9. Apply the render plan in a later file generation step only after conflict
   policy is satisfied.
10. Return serializable results for future CLI output and verification.

## Selected Template Input
Rendering starts from an already selected local template.

Required input:

- `DiscoveredTemplate` from the selection result;
- selected `TemplateMetadata`;
- explicit template path;
- explicit variables object;
- explicit target root for generation planning or writing;
- declared source file list from metadata.

The renderer must not discover templates, infer defaults from the repository,
prompt users, or select a template on its own.

## Variable Resolution Strategy
Variable resolution should be a narrow package helper before content rendering.

Rules:

- accept metadata variable declarations and caller variables;
- support only string variable values in the MVP;
- require lowercase snake_case variable names;
- require every metadata variable marked `required`;
- use metadata `defaultValue` for optional variables when present;
- reject unknown variables by default;
- reject empty required values;
- return structured issues instead of throwing for expected validation failures.

Expected MVP issue codes:

- `missing_required_variable`;
- `unknown_variable`;
- `invalid_variable_name`;
- `empty_required_variable`;
- `invalid_variable_value`.

The resolver should return a normalized variable map for later substitution.

## File Mapping Strategy
File mapping converts declared template source paths to target project-relative
paths.

Rules:

- only metadata-declared `requiredFiles` and `optionalFiles` are eligible;
- source paths must be relative;
- target paths must be relative;
- path traversal is rejected;
- absolute paths are rejected;
- duplicate target paths are rejected;
- undeclared files are rejected;
- mapping must be deterministic and sorted for stable output.

The MVP can use source-relative paths as target-relative paths. More advanced
rename or conditional mapping is later scope.

## Directory Generation Strategy
Directory generation is derived from planned file targets.

Rules:

- do not store directories as independent render outputs in the MVP;
- derive parent directories from target relative file paths;
- create parent directories only during the file generation step;
- ensure every directory remains inside the explicit target root;
- return created directory summaries for future CLI/audit output.

Empty directory generation is later scope.

## Conflict Handling
Rendering and generation must make conflicts visible and deterministic.

MVP behavior:

- render plan creation records intended target paths without writing;
- file generation checks whether target files already exist;
- existing target files produce `target_file_exists` issues;
- overwriting is refused by default;
- overwrite policy is not implemented until a later explicit task;
- partial writes should be avoided by validating the full plan before writing.

## Safety Rules
- Never render files outside the selected template path.
- Never generate files outside the explicit target root.
- Refuse absolute source and target paths.
- Refuse path traversal segments.
- Refuse undeclared source files.
- Refuse duplicate target files.
- Do not call network services.
- Do not run deployment commands.
- Do not sync with GitHub.
- Do not generate content with AI.
- Do not mutate package or repository files during render plan creation.

## Verification Integration
Rendering helpers should return verification-ready facts.

MVP verification hooks:

- variable resolution result;
- source file read result;
- render plan validation result;
- target path safety result;
- conflict check result;
- generated file summary after writing.

Future CLI and project verification can consume these facts without changing the
core rendering contract.

## Project Integration
Project integration should stay outside the renderer core.

Future integration should:

- use `@aeos/projects` to resolve or confirm the target root;
- pass the explicit target root into rendering/generation helpers;
- detect existing project files before generation;
- keep project context updates short and explicit;
- avoid creating `.aeos/` storage until init policy is defined.

The renderer must not duplicate project root detection logic.

## CLI Integration Placeholder
CLI integration is deferred until package rendering helpers are stable.

Later CLI work may add:

- template render dry-run output;
- template conflict reporting;
- `aeos init` preflight output;
- generated file summaries;
- JSON output for automation.

No CLI task should begin before variable resolution, source file reading, render
plan creation, path safety, conflict checking, and generation verification are
implemented.

## MVP Scope
- Resolve template variables.
- Read declared local template source files.
- Map declared files to target relative paths.
- Substitute resolved variables in text content.
- Build a deterministic render plan.
- Validate render plan safety.
- Detect existing target conflicts.
- Generate declared files under an explicit target root.
- Return structured issues and summaries.

## Later Scope
- `aeos init`.
- Interactive prompts.
- Conditional files.
- File renaming rules.
- Binary file handling policy.
- Empty directory support.
- Overwrite approval policy.
- Template dry-run CLI.
- Full verification runner integration.
- Remote templates.
- Marketplace.
- Cloud rendering.
- AI generated files.
- Deployment automation.
- GitHub sync.

## First 12 Rendering Implementation Tasks

### TASK-0100
- Task ID: TASK-0100
- Title: Implement template variable resolver.
- Purpose: Resolve caller variables against template metadata declarations and
  return a normalized variable map with structured issues.
- Likely files: `packages/templates/src/index.ts`,
  `packages/templates/src/variable-resolver.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0101
- Task ID: TASK-0101
- Title: Add variable resolver examples.
- Purpose: Cover required variables, optional defaults, unknown variables, empty
  required values, and invalid variable names.
- Likely files: `packages/templates/src/variable-resolver.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Low.
- Classification: Code.

### TASK-0102
- Task ID: TASK-0102
- Title: Define template source file reader.
- Purpose: Add a helper that reads only declared required and optional source
  files from a selected template path.
- Likely files: `packages/templates/src/index.ts`,
  `packages/templates/src/source-files.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0103
- Task ID: TASK-0103
- Title: Validate template source paths.
- Purpose: Reject absolute paths, traversal paths, duplicate declarations, and
  undeclared source file requests before rendering.
- Likely files: `packages/templates/src/source-files.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0104
- Task ID: TASK-0104
- Title: Define placeholder substitution contract.
- Purpose: Document and expose the minimal placeholder syntax contract without
  choosing a third-party template engine.
- Likely files: `docs/TEMPLATE_RENDERING_IMPLEMENTATION_PLAN.md`,
  `packages/templates/src/index.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Low.
- Classification: Code/docs.

### TASK-0105
- Task ID: TASK-0105
- Title: Implement template content substitution.
- Purpose: Replace declared placeholders using resolved variables and report
  unresolved placeholders as structured issues.
- Likely files: `packages/templates/src/index.ts`,
  `packages/templates/src/content-renderer.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0106
- Task ID: TASK-0106
- Title: Build template file mapping helper.
- Purpose: Map declared source files to deterministic target-relative project
  paths.
- Likely files: `packages/templates/src/index.ts`,
  `packages/templates/src/file-mapping.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0107
- Task ID: TASK-0107
- Title: Implement render plan builder.
- Purpose: Combine selected template metadata, resolved variables, source files,
  file mappings, and rendered content into a serializable render plan.
- Likely files: `packages/templates/src/index.ts`,
  `packages/templates/src/render-plan.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0108
- Task ID: TASK-0108
- Title: Add render plan validation.
- Purpose: Validate render plan paths, duplicate targets, undeclared files, and
  unresolved rendering issues before file generation.
- Likely files: `packages/templates/src/render-plan.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0109
- Task ID: TASK-0109
- Title: Implement target conflict checker.
- Purpose: Check planned output paths against an explicit target root and report
  existing files without writing anything.
- Likely files: `packages/templates/src/index.ts`,
  `packages/templates/src/conflicts.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0110
- Task ID: TASK-0110
- Title: Implement safe file generation.
- Purpose: Write only validated render plan files under an explicit target root,
  creating parent directories as needed.
- Likely files: `packages/templates/src/index.ts`,
  `packages/templates/src/file-generator.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: High.
- Classification: Code.

### TASK-0111
- Task ID: TASK-0111
- Title: Add rendering verification summary.
- Purpose: Return verification-ready summaries for variables, planned files,
  conflicts, generated files, and safety checks.
- Likely files: `packages/templates/src/index.ts`,
  `packages/templates/src/render-verification.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Medium.
- Classification: Code.

## Stop Conditions Before aeos init
- Variable resolver is implemented and exported.
- Declared source file reading is implemented.
- Placeholder substitution contract is explicit.
- Render plan builder is implemented.
- Render plan validation rejects unsafe paths and duplicate targets.
- Conflict checking reports existing files without writing.
- File generation writes only validated declared files under an explicit target
  root.
- Rendering verification summaries exist.
- `pnpm --filter @aeos/templates check` passes for the rendering package slice.
- No remote template, marketplace, cloud, AI, deployment, or GitHub sync behavior
  has been added.
