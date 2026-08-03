# AEOS Smart Init Template Selection Design

## Purpose
Design how AEOS can use Project Intelligence profiles to recommend or select
init templates.

This is a design-only document. It does not implement smart selection, add CLI
commands, change template metadata, create templates, or change init behavior.

## Current Foundation Status
AEOS already has the conservative pieces needed to design this layer:

- `@aeos/projects` exposes deterministic Project Intelligence profile
  contracts and detector orchestration.
- `aeos project profile` can print a bounded local stack profile for the
  current working directory.
- `@aeos/templates` can read local template metadata, discover direct child
  local templates from an explicit root, and select by explicit template ID.
- `aeos init` currently supports dry-run planning and explicit `--write` mode
  for the minimal `AGENTS.md` artifact.

Current limits remain intentional: no dependency parsing, no package content
parsing, no remote templates, no marketplace, and no AI-based guessing.

## Why Smart Selection Is Needed
The current init flow can create a generic AEOS starter artifact, but future
project setup should become more useful when the local stack is already known.

Smart selection should let AEOS recommend a better local starter candidate, for
example a WordPress-oriented starter for a WordPress project, while preserving
the existing safety posture. The goal is a deterministic recommendation, not an
opaque automatic decision.

## Input Flow
```text
Current working directory
        |
        v
Project Intelligence detector
        |
        v
Stack profile
        |
        v
Template candidate scoring
        |
        v
Recommended template / fallback
```

## Inputs
MVP inputs:

- current working directory as the project root;
- `ProjectIntelligenceProfile` from `@aeos/projects`;
- local discovered templates from an explicit templates root supplied by the
  caller or init pipeline;
- template metadata currently available from `@aeos/templates`;
- command mode flags such as future `--smart`, `--json`, and `--write`;
- optional explicit template ID, when a future command supports combining
  explicit selection with smart behavior.

The MVP must not inspect package contents, dependency lists, remote catalogs, or
template source files during recommendation.

## Outputs
Smart selection should produce a serializable recommendation result:

- selected mode: `smart`;
- project root;
- compact profile summary;
- recommended template when one confident candidate exists;
- ordered local candidates with deterministic reasons;
- fallback status;
- structured issues for ambiguity, weak evidence, or unavailable templates.

The result should be usable by CLI human output, CLI JSON output, and init
pipeline integration without changing the scoring rules.

## Project Intelligence Profile Usage
The selector should consume only normalized profile facts:

- `summary.primaryFramework`;
- `summary.primaryLanguage`;
- `summary.primaryRuntime`;
- `summary.primaryPackageManager`;
- `summary.confidence`;
- category signal confidence values;
- evidence IDs referenced by the winning or competing signals;
- profile issues that indicate ambiguity.

Profile usage rules:

- framework evidence outranks language-only evidence;
- high-confidence framework signals may produce a direct recommendation;
- medium-confidence signals may recommend only when there is one clear local
  matching template;
- low or unknown confidence should fall back;
- Project Intelligence issues should lower selection confidence when they
  affect the same category used for scoring.

## Template Metadata Usage
The MVP should use existing local template metadata first:

- template `id`;
- template `name`;
- template `description`;
- template `version`;
- declared files and variables only for reporting readiness, not scoring file
  contents.

Because current metadata does not yet declare stack tags, the first smart
selection implementation should add a small contract for selection metadata
before scoring. The likely future fields are local, static, and deterministic:

- supported frameworks;
- supported languages;
- supported runtimes;
- supported package managers;
- template role such as `project_starter`;
- optional generic fallback marker.

No production catalog is promised by this design. Local template availability
must determine whether a mapping can be recommended.

## Selection Confidence
Selection confidence should use explainable bands:

- `high`: one local template strongly matches a high-confidence primary
  framework or runtime/framework pair.
- `medium`: one local template matches a medium-confidence framework or a
  coherent language/runtime/package-manager combination.
- `low`: only broad language or runtime evidence matches.
- `unknown`: no usable profile signal or no matching local template exists.

Only `high` and selected `medium` results should be eligible for automatic
recommendation in MVP smart mode. `low` and `unknown` results must fall back.

## Evidence Model
Every recommendation should explain why it happened without exposing file
contents.

Candidate evidence should include:

- profile evidence IDs used by the score;
- matched profile fields;
- matched template metadata fields;
- deterministic rule IDs such as `framework.wordpress`;
- confidence band;
- issue codes that reduced confidence.

Evidence must not include secrets, full manifest contents, source snippets,
environment values, or generated content.

## Conflict/Ambiguity Handling
Ambiguity should block automatic recommendation and produce issues.

Examples:

- multiple local templates tie for the top confident score;
- WordPress and Laravel both have strong profile evidence;
- multiple JavaScript package managers create an unclear Node template target;
- profile confidence is medium but template metadata is too generic;
- the best local template has duplicate IDs or invalid metadata issues.

Explicit template selection should win over smart recommendation when a future
CLI flow supports both. Smart mode may still report the profile and candidates,
but it must not override the operator's explicit template ID.

## Fallback Behavior
Fallback is a valid outcome, not an error.

MVP fallback rules:

- unknown or no-signal profile falls back to generic AEOS starter behavior;
- no confident local template match falls back to current minimal `AGENTS.md`
  behavior;
- ambiguity falls back unless the operator explicitly chooses a template;
- discovery failures fall back only when init can still safely plan the minimal
  artifact;
- write mode still requires explicit `--write`.

## CLI Behavior
Future CLI surface:

```sh
aeos init --smart
aeos init --smart --json
aeos init --smart --write
aeos template recommend
aeos template recommend --json
```

These commands are not implemented by this design.

Expected behavior:

- `aeos init --smart` runs detection, scores local candidates, and prints the
  planned recommendation or fallback without writing files.
- `aeos init --smart --write` may write only after the normal init write safety
  checks pass.
- `aeos template recommend` reports a recommendation only; it does not render or
  write files.
- `--json` emits one JSON object and no progress text.
- unknown flags should remain usage errors when the command is implemented.

## Init Integration Behavior
Smart selection should integrate before template rendering and file generation:

1. Resolve the current working directory.
2. Run Project Intelligence detection.
3. Discover local templates from the configured local templates root.
4. Score candidates using profile and metadata facts.
5. Select a recommendation only when confidence clears the MVP threshold.
6. Fall back to current minimal init behavior when no confident match exists.
7. Continue through existing dry-run or explicit write mode.

Smart selection must not change the no-overwrite rule, conflict checks, target
root handling, or dry-run default.

## JSON Output Behavior
Conceptual success shape:

```json
{
  "ok": true,
  "mode": "smart",
  "projectRoot": "...",
  "profileSummary": {},
  "recommendation": {},
  "candidates": [],
  "fallbackUsed": false,
  "issues": []
}
```

Field rules:

- `ok` is `true` when smart evaluation completes, even if fallback is used.
- `mode` is `smart`.
- `projectRoot` is the resolved current working directory.
- `profileSummary` is compact and should not duplicate full evidence unless
  later verbose JSON is designed.
- `recommendation` is empty or `null` when fallback is used.
- `candidates` are sorted by score, template ID, and deterministic tie-breakers.
- `fallbackUsed` tells automation whether generic behavior was used.
- `issues` includes ambiguity, weak evidence, template discovery, and scoring
  issues.

Failure JSON should be reserved for command usage errors or hard failures that
prevent any recommendation or fallback evaluation.

## Safety Boundaries
MVP smart selection must preserve these boundaries:

- deterministic local-first selection;
- no AI guessing;
- no remote templates;
- no marketplace;
- no package content parsing;
- no dependency parsing;
- no template source file parsing during recommendation;
- no project command execution;
- no package manager execution;
- no Git, Docker, Terraform, Composer, Cargo, Go, Python, Node, or shell command
  execution;
- no auto-write without explicit `--write`;
- no overwrite of existing files;
- no deployment;
- no Git push.

## MVP Scope
MVP smart selection includes:

- selection contract types;
- deterministic candidate scoring rules;
- conservative confidence thresholds;
- local discovered template input;
- Project Intelligence profile summary input;
- structured issues and evidence references;
- generic fallback behavior;
- JSON output contract for future CLI use;
- smoke test requirements.

Supported MVP mapping examples:

- WordPress profile -> WordPress-oriented project starter template candidate.
- Next.js/React profile -> TypeScript/Node project starter template candidate.
- PHP/Laravel profile -> PHP/composer project starter template candidate.
- unknown/no-signal profile -> generic AEOS starter behavior.

These examples define mapping behavior, not a promise that the local template
catalog already contains those templates.

## Later Scope
Later work may add:

- richer template metadata tags;
- category and runtime filters;
- operator override flags;
- interactive confirmation for ambiguous recommendations;
- verbose evidence output;
- explicit target-root support after root safety design;
- organization-local template catalogs;
- remote registry after a separate safety and trust design;
- marketplace after registry and policy work;
- dependency-name matching after package parsing is implemented;
- richer project-specific validation hooks.

## Non-Goals
- Implementing smart selection in this task.
- Adding or changing CLI commands in this task.
- Creating WordPress, Next.js, Laravel, or PHP templates in this task.
- Reading or modifying `templates/`.
- Adding dependencies.
- Parsing package dependency contents.
- Inferring stack facts with AI.
- Choosing remote or marketplace templates.
- Changing current `aeos init` write behavior.

## Smoke Test Requirements
Future smoke tests should verify:

- `aeos init --smart` exits `0` in dry-run mode.
- `aeos init --smart` writes no files.
- `aeos init --smart --json` emits one parseable JSON object.
- JSON includes `ok`, `mode`, `projectRoot`, `profileSummary`,
  `recommendation`, `candidates`, `fallbackUsed`, and `issues`.
- unknown/no-signal input uses fallback.
- ambiguous top candidates use fallback and report an issue.
- explicit `--write` remains required before any file write.
- `aeos template recommend` never writes files.
- candidate ordering is deterministic.
- recommendation evidence references profile evidence IDs and rule IDs.

## Implementation Sequence
### TASK-0172
- Task ID: TASK-0172
- Title: Implement smart template selection contracts.
- Purpose: Define serializable request, candidate, recommendation, issue,
  evidence, confidence, and result types without scoring behavior.
- Likely files: `packages/templates/src/smart-selection.ts`,
  `packages/templates/src/index.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0173
- Task ID: TASK-0173
- Title: Add smart selection contract examples.
- Purpose: Lock the intended JSON-safe result shapes for recommendation and
  fallback outcomes.
- Likely files: `packages/templates/src/smart-selection.examples.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Low.
- Classification: Code.

### TASK-0174
- Task ID: TASK-0174
- Title: Extend template metadata with selection tags.
- Purpose: Add optional local metadata fields for supported languages,
  frameworks, runtimes, package managers, and template role.
- Likely files: `packages/templates/src/metadata-reader.ts`,
  `packages/templates/src/index.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0175
- Task ID: TASK-0175
- Title: Add metadata validation examples for selection tags.
- Purpose: Verify valid and invalid selection metadata without requiring any
  production template catalog.
- Likely files: `packages/templates/src/metadata-reader.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Low.
- Classification: Code.

### TASK-0176
- Task ID: TASK-0176
- Title: Implement profile summary adapter for smart selection.
- Purpose: Convert `ProjectIntelligenceProfile` into the compact facts used by
  template scoring.
- Likely files: `packages/templates/src/smart-selection.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0177
- Task ID: TASK-0177
- Title: Implement deterministic candidate scoring.
- Purpose: Score local templates from profile summary and metadata tags using
  documented rule IDs and confidence bands.
- Likely files: `packages/templates/src/smart-selection.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: High.
- Classification: Code.

### TASK-0178
- Task ID: TASK-0178
- Title: Add smart scoring examples.
- Purpose: Cover WordPress, Next.js/React, Laravel/PHP, generic, no-signal, and
  no-template-match scenarios.
- Likely files: `packages/templates/src/smart-selection.examples.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0179
- Task ID: TASK-0179
- Title: Implement ambiguity and fallback normalization.
- Purpose: Convert ties, weak evidence, profile issues, duplicate template IDs,
  and missing local templates into deterministic fallback results.
- Likely files: `packages/templates/src/smart-selection.ts`.
- Verification command: `pnpm --filter @aeos/templates check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0180
- Task ID: TASK-0180
- Title: Integrate smart selection into init planning.
- Purpose: Add a smart selection adapter before rendering while preserving
  dry-run default and explicit `--write` behavior.
- Likely files: `packages/core/src/init.ts`,
  `packages/core/src/init-pipeline.ts`,
  `packages/core/src/init-adapters.ts`.
- Verification command: `pnpm --filter @aeos/core check`.
- Recommended model effort: High.
- Classification: Code.

### TASK-0181
- Task ID: TASK-0181
- Title: Add init smart selection examples.
- Purpose: Verify recommendation, fallback, ambiguity, and no-write planning
  results at the init pipeline boundary.
- Likely files: `packages/core/src/init-pipeline.examples.ts`,
  `packages/core/src/init-adapters.examples.ts`.
- Verification command: `pnpm --filter @aeos/core check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0182
- Task ID: TASK-0182
- Title: Add aeos init --smart CLI routing.
- Purpose: Parse `--smart` for init and pass smart mode into the init pipeline
  without changing write semantics.
- Likely files: `apps/cli/src/commands.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0183
- Task ID: TASK-0183
- Title: Add template recommend CLI command.
- Purpose: Implement read-only `aeos template recommend` and
  `aeos template recommend --json` over the smart recommendation API.
- Likely files: `apps/cli/src/commands.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: High.
- Classification: Code.

### TASK-0184
- Task ID: TASK-0184
- Title: Add smart selection smoke tests.
- Purpose: Verify CLI dry-run, JSON shape, fallback behavior, ambiguity
  handling, and no-write guarantees.
- Likely files: `apps/cli/scripts/smoke.mjs`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Medium.
- Classification: Code.
