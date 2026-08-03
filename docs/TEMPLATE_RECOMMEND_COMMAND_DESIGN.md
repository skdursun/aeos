# AEOS Template Recommend Command Design

## Purpose
Design the read-only CLI command that exposes smart template recommendation
without writing files and without changing `aeos init` behavior.

The MVP commands are:

```sh
aeos template recommend
aeos template recommend --json
```

The command helps operators inspect which deterministic local starter template
AEOS would recommend for the current project. It does not create templates,
render templates, write files, or integrate with init.

## Current Foundation Status
AEOS already has the local foundation needed for a conservative recommendation
command:

- `@aeos/projects` exposes deterministic Project Intelligence contracts and the
  detector orchestrator.
- `aeos project profile` already profiles the current working directory with
  bounded local scan behavior.
- `@aeos/templates` exposes smart selection contracts and a deterministic smart
  selector.
- The smart selector can score candidates, return evidence, report issues, and
  normalize fallback behavior.
- The CLI already has command routing, human output helpers, JSON line output,
  exit code handling, and smoke test coverage patterns.

Current limits remain intentional: no package content parsing, no dependency
parsing, no remote templates, no marketplace, no production template catalog
claim, and no AI-based guessing.

## Command Behavior
`aeos template recommend` should:

1. Use `process.cwd()` as `projectRoot`.
2. Build the default Project Intelligence detector input for that root.
3. Run the Project Intelligence detector in `profile` mode.
4. Adapt the profile summary, evidence IDs, and profile issue codes into the
   smart selector input shape.
5. Provide deterministic MVP template candidates from a minimal built-in list.
6. Run the smart selector in `recommend` mode.
7. Print compact human output by default.
8. Print exactly one JSON object for `--json`.

The command must reject unknown flags with a usage error and nonzero exit. The
MVP accepts no `--root`, `--template-root`, verbose, catalog, remote, or
marketplace flags.

## Human Output Shape
Default output should be compact and stable:

```text
Template Recommendation
Project root: /absolute/project/root
Selected template: aeos-nextjs-typescript
Confidence: high
Fallback used: false
Candidate count: 4
Evidence count: 3
Issue count: 0
Reasons:
- match.framework.nextjs
- match.language.typescript
- match.runtime.node
```

Fallback output should keep the same shape:

```text
Template Recommendation
Project root: /absolute/project/root
Selected template: fallback minimal_agents
Confidence: unknown
Fallback used: true
Candidate count: 4
Evidence count: 1
Issue count: 2
Reasons:
- fallback.minimal-agents
- no_confident_match
```

Rendering rules:

- use `Template Recommendation` as the heading;
- print the resolved project root;
- print the selected candidate template ID when present;
- print `fallback <fallback>` when fallback is used;
- print the recommendation confidence;
- print fallback status as `true` or `false`;
- print candidate, evidence, and issue counts;
- include short deterministic reason/evidence lines;
- do not print full file contents, dependency contents, template contents, or
  environment values.

## JSON Output Shape
`aeos template recommend --json` should write exactly one JSON object to stdout
and no progress text to stderr on success.

Stable top-level fields:

```json
{
  "ok": true,
  "projectRoot": "...",
  "mode": "recommend",
  "recommendation": {},
  "candidates": [],
  "fallbackUsed": false,
  "issues": [],
  "summary": {}
}
```

Field rules:

- `ok`: `true` when recommendation evaluation completes, even when fallback is
  used.
- `projectRoot`: absolute root used for detection.
- `mode`: always `recommend` for this command.
- `recommendation`: the smart selector recommendation object.
- `candidates`: scored MVP candidates sorted deterministically.
- `fallbackUsed`: mirrors `recommendation.fallbackUsed`.
- `issues`: detector-adapted and selector issues that affected the result.
- `summary`: compact counts and selected/fallback status.

Suggested `summary` fields:

```json
{
  "candidateCount": 4,
  "evidenceCount": 3,
  "issueCount": 0,
  "selectedTemplateId": "aeos-nextjs-typescript",
  "fallback": "minimal_agents",
  "fallbackUsed": false,
  "confidence": "high"
}
```

Failure JSON should be reserved for usage errors or hard detector/selector
failures that prevent any recommendation or fallback evaluation:

```json
{
  "ok": false,
  "projectRoot": "...",
  "mode": "recommend",
  "recommendation": null,
  "candidates": [],
  "fallbackUsed": true,
  "issues": [],
  "summary": null,
  "reason": "template_recommend_failed"
}
```

## Exit Code Behavior
- Exit `0` when recommendation evaluation completes, including fallback.
- Exit `1` for invalid command usage or unknown flags.
- Exit `1` for detector or selector hard failures that prevent fallback
  evaluation.
- Warning and info issues do not fail the command.
- Error-severity issues may be reported with exit `0` when a usable fallback or
  recommendation result is still produced.

## Default Scan/Profile Behavior
MVP defaults should match `aeos project profile` unless a later design changes
them:

- `projectRoot`: current working directory.
- `mode`: `profile`.
- `scope`: `bounded_workspace`.
- `includeHiddenFiles`: `false`.
- `followSymlinks`: `false`.
- `includeLockfiles`: `true`.
- `includeInfrastructure`: `true`.
- `includeMonorepoSignals`: `true`.
- `includeDependencySignals`: `false`.
- use existing detector limits and ignore rules.

The command must not run package managers, project scripts, Docker, Terraform,
Composer, Node, PHP, GitHub tooling, cloud commands, or shell scripts.

## Candidate Source Behavior
MVP candidate source is a minimal built-in list used only as deterministic local
recommendation input while no real template catalog exists.

Allowed MVP candidates:

- `aeos-generic-minimal`
- `aeos-nextjs-typescript`
- `aeos-wordpress-php`
- `aeos-php-composer`

Candidate rules:

- built-in candidates are static definitions in code, not discovered templates;
- they must not be described as a production template catalog;
- they must not imply that matching package content exists;
- they must not fetch remote templates;
- they must not query a marketplace;
- they must not scan the filesystem for templates in this task;
- they should be represented as smart selector candidates or available
  templates with deterministic selection metadata.

Suggested candidate metadata:

```text
aeos-generic-minimal: generic fallback candidate
aeos-nextjs-typescript: framework nextjs, language typescript, runtime node
aeos-wordpress-php: framework wordpress, language php, runtime php
aeos-php-composer: language php, runtime php, package manager composer
```

## Fallback Behavior
Fallback is a valid result, not an error.

MVP fallback rules:

- use `minimal_agents` fallback when no confident smart template matches;
- use fallback when the profile is unknown or has no usable signals;
- use fallback when only weak language/runtime evidence matches;
- use fallback when ambiguity or candidate validation issues block a clear
  recommendation;
- report fallback reason in both human and JSON output;
- do not call `aeos init` and do not plan or write `AGENTS.md`.

## Evidence Reporting
Evidence should explain why a recommendation happened without exposing project
or template contents.

Human output should include short reason lines from:

- selector rule IDs such as `match.framework.nextjs`;
- fallback rule IDs such as `fallback.minimal-agents`;
- issue codes that affected the result;
- compact matched field names when useful.

JSON output should include the selector evidence object:

- `profileEvidenceIds`;
- `matchedProfileFields`;
- `matchedTemplateFields`;
- `ruleIds`;
- `confidence`;
- `reducedByIssueCodes`.

Evidence must not include secrets, full manifests, source snippets, dependency
lists, environment variables, rendered content, or package contents.

## Confidence Reporting
The command should report the smart selector confidence band:

- `high`: strong framework-centered match.
- `medium`: coherent framework or language/runtime/package-manager match.
- `low`: broad weak evidence only.
- `unknown`: no usable evidence or fallback.

MVP human output prints only the final recommendation confidence. JSON includes
candidate-level confidence and recommendation-level confidence.

## Issue Reporting
Human issue reporting should remain compact:

```text
Issues:
- warning profile_issue
- info no_confident_match
```

JSON should preserve structured selector issues with stable fields:

- `code`;
- `message`;
- `severity`;
- `templateId`, when present;
- `evidenceIds`, when present.

Project Intelligence issues should be adapted into selector-readable profile
issue codes and included when they reduce confidence or explain fallback.

## Safety Guarantees
- No filesystem writes.
- No init integration.
- No template creation.
- No template rendering.
- No template discovery behavior changes.
- No filesystem template scanning.
- No package content parsing.
- No dependency parsing.
- No AI guessing.
- No remote templates.
- No marketplace.
- No dependency changes.
- No source file execution.
- No hidden file expansion beyond existing detector defaults.

## Known MVP Limitations
- Uses only the current working directory.
- No `--root` flag.
- No real template catalog.
- Built-in candidates may name starter concepts before full template content
  exists.
- No remote or marketplace candidates.
- No filesystem template scanning.
- No package content or dependency parsing.
- No verbose evidence mode.
- No user-selected candidate override.
- No integration with `aeos init`.
- Ambiguity handling is limited to current selector behavior unless a later task
  expands it.

## Later Scope
- Add a real local template catalog after its contract is designed.
- Add safe filesystem template discovery for recommendation after discovery
  semantics are revisited.
- Add `--root <path>` after root safety behavior is designed.
- Add verbose evidence output.
- Add candidate filtering.
- Add richer ambiguity reporting and tie handling.
- Add package manifest content parsing in Project Intelligence.
- Add dependency-name matching only after package parsing exists.
- Integrate smart recommendation into `aeos init --smart` after this command is
  stable.

## Smoke Test Requirements
`apps/cli/scripts/smoke.mjs` should eventually verify:

- `aeos template recommend` exits `0` in this repository.
- Human output includes `Template Recommendation`.
- Human output includes `Project root:`.
- Human output includes `Selected template:`.
- Human output includes `Confidence:`.
- Human output includes `Fallback used:`.
- Human output includes `Candidate count:`.
- Human output includes `Evidence count:`.
- Human output includes `Issue count:`.
- Human output includes at least one short reason or issue line.
- Human output does not claim production catalog, remote templates, marketplace,
  package parsing, dependency parsing, AI guessing, or init integration.
- `aeos template recommend --json` exits `0`.
- JSON output is exactly one parseable JSON line.
- JSON output has stable fields: `ok`, `projectRoot`, `mode`,
  `recommendation`, `candidates`, `fallbackUsed`, `issues`, and `summary`.
- JSON `ok` is `true`.
- JSON `mode` is `recommend`.
- JSON `candidates` is an array.
- JSON `fallbackUsed` is a boolean.
- JSON `issues` is an array.
- JSON `summary.candidateCount` is a number.
- Unknown flags fail nonzero and report usage.

## Implementation Sequence
1. TASK-0178: Implement built-in smart template candidates.
   Purpose: Add deterministic MVP candidate definitions for the recommend
   command without template discovery or filesystem scanning.
   Likely files: `apps/cli/src/commands.ts` or a small CLI-local helper.
   Verification command: `pnpm --filter @aeos/cli check`.
   Recommended model effort: Low.
   Docs/code classification: Code.

2. TASK-0179: Add project profile adapter for template recommendation.
   Purpose: Convert Project Intelligence profile summary, evidence IDs, and
   issue codes into `SmartTemplateSelectionProfile`.
   Likely files: `apps/cli/src/commands.ts`.
   Verification command: `pnpm --filter @aeos/cli check`.
   Recommended model effort: Medium.
   Docs/code classification: Code.

3. TASK-0180: Add template recommend command routing.
   Purpose: Route `aeos template recommend` and reject unsupported template
   subcommands or unknown flags.
   Likely files: `apps/cli/src/commands.ts`.
   Verification command: `pnpm --filter @aeos/cli check`.
   Recommended model effort: Medium.
   Docs/code classification: Code.

4. TASK-0181: Wire Project Intelligence to smart selector.
   Purpose: Run the detector for `process.cwd()`, pass MVP candidates to the
   smart selector, and return a recommendation result without writes.
   Likely files: `apps/cli/src/commands.ts`.
   Verification command: `pnpm --filter @aeos/cli check`.
   Recommended model effort: Medium.
   Docs/code classification: Code.

5. TASK-0182: Add template recommend human output.
   Purpose: Render the compact human output shape with selected template,
   fallback status, confidence, counts, and short reason lines.
   Likely files: `apps/cli/src/commands.ts`.
   Verification command: `pnpm --filter @aeos/cli check`.
   Recommended model effort: Medium.
   Docs/code classification: Code.

6. TASK-0183: Add template recommend JSON output.
   Purpose: Emit exactly one stable JSON object for `--json` with the designed
   fields and no progress text.
   Likely files: `apps/cli/src/commands.ts`.
   Verification command: `pnpm --filter @aeos/cli check`.
   Recommended model effort: Medium.
   Docs/code classification: Code.

7. TASK-0184: Add template recommend usage and failure handling.
   Purpose: Normalize unknown flag behavior, hard failure JSON, and exit codes.
   Likely files: `apps/cli/src/commands.ts`.
   Verification command: `pnpm --filter @aeos/cli check`.
   Recommended model effort: Medium.
   Docs/code classification: Code.

8. TASK-0185: Add template recommend smoke tests.
   Purpose: Verify human output, JSON shape, no-write behavior, and conservative
   unsupported-feature wording.
   Likely files: `apps/cli/scripts/smoke.mjs`.
   Verification command: `pnpm --filter @aeos/cli check`.
   Recommended model effort: Medium.
   Docs/code classification: Code.

9. TASK-0186: Review template recommend MVP behavior.
   Purpose: Confirm the implemented command matches this design and does not
   overpromise catalog, AI, parsing, discovery, init, or write behavior.
   Likely files: `docs/TEMPLATE_RECOMMEND_COMMAND_DESIGN.md`,
   `docs/CLI_COMMAND_MAP.md`, `README.md`, `TASKS/backlog.md`,
   `PROJECT_CONTEXT.md`.
   Verification command: `git status --short`.
   Recommended model effort: Medium.
   Docs/code classification: Docs.
