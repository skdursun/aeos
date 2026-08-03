# AEOS Template Recommend Usage

## Purpose
`aeos template recommend` reports which deterministic MVP starter candidate
AEOS recommends for the current project.

Use it to inspect template selection signals before any future init integration.
The command is documentation and inspection only: it does not run init, render
templates, create templates, or write files.

## Commands
```sh
aeos template recommend
aeos template recommend --json
```

## Current MVP Behavior
- Uses the current working directory as the project root.
- Runs local, bounded Project Intelligence detection in `profile` mode.
- Adapts the profile summary, evidence IDs, and issue codes into smart template
  selection input.
- Scores a static built-in MVP candidate allow-list.
- Returns a recommendation when evidence is strong enough.
- Falls back to `minimal_agents` when there is no confident match.
- Accepts only `--json`; unknown flags exit nonzero.

## Read-Only Guarantee
The command is read-only. It does not create, update, delete, rename, cache, or
persist files.

It does not run `aeos init`, create `AGENTS.md`, render template files, create
template directories, or modify package files.

## Local-First Behavior
Recommendation is deterministic, evidence-based, and local-first. The command
does not fetch remote templates, query a marketplace, run AI selection, run
package managers, execute project scripts, or call external services.

## Current Working Directory Behavior
The MVP evaluates `process.cwd()`. Run it from the repository or folder you want
inspected:

```sh
cd /path/to/project
aeos template recommend
```

There is no `--root` or target-root flag yet.

## Project Intelligence Usage
The command consumes normalized Project Intelligence facts only:

- primary language
- primary framework
- primary package manager
- primary runtime
- infrastructure and monorepo summary flags
- evidence IDs
- issue codes

Project Intelligence remains conservative in this flow: no package content
parsing, no dependency parsing, and no AI guessing.

## Built-In Smart Candidate Usage
The MVP uses a static candidate allow-list while no production template catalog
exists:

- `aeos-generic-minimal`
- `aeos-nextjs-typescript`
- `aeos-wordpress-php`
- `aeos-php-composer`

These candidates are deterministic selection inputs. They are not remote
templates, marketplace entries, discovered filesystem templates, or a production
template catalog.

## Human Output Shape
Default output is compact:

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
```

Fallback keeps the same shape and prints `Selected template: fallback
minimal_agents`.

## JSON Output Shape
`aeos template recommend --json` writes exactly one JSON object to stdout on
success:

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

Stable `summary` fields are:

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

When fallback is used, `ok` remains `true`, `fallbackUsed` is `true`, and
`summary.selectedTemplateId` is `null`.

## Exit Code Behavior
- Exits `0` when recommendation evaluation completes, including fallback.
- Exits `1` for invalid command usage or unknown flags.
- Exits `1` for hard detector or selector failures that prevent recommendation
  or fallback evaluation.
- Warning and info issues do not fail the command.

## Recommendation Confidence
Confidence is reported as the selector confidence band:

- `high`: strong framework-centered match.
- `medium`: coherent framework or language/runtime/package-manager match.
- `low`: broad weak evidence only.
- `unknown`: no usable evidence or fallback.

Low and unknown confidence should not be treated as a production-ready automatic
template choice.

## Fallback Behavior
Fallback is a valid result, not an error. The MVP uses `minimal_agents` when the
profile has no usable signals, only weak evidence, ambiguity, or no confident
candidate match.

Fallback does not call init and does not write files.

## Candidate Allow-List Behavior
Only the four built-in MVP candidate IDs listed above are valid recommendation
candidates. Output should not invent candidate IDs or imply that candidate
content exists in a production catalog.

## Safety Guarantees
- No filesystem writes.
- No init execution.
- No template creation.
- No template rendering.
- No filesystem template scanning.
- No remote templates.
- No marketplace.
- No AI guessing.
- No package content parsing.
- No dependency parsing.
- No package manager or project script execution.
- No source file execution.

## Known MVP Limitations
- No filesystem writes.
- Does not run init.
- Does not create templates.
- No production template catalog yet.
- No remote templates.
- No marketplace.
- No AI guessing.
- No package content parsing.
- No dependency parsing.
- No target-root flag yet.
- No verbose evidence mode.
- No user-selected candidate override.

## Later Scope
- Add a real local template catalog after its contract is designed.
- Add safe target-root support.
- Add verbose evidence output.
- Add candidate filtering or explicit candidate override.
- Add package manifest content parsing after Project Intelligence supports it.
- Add dependency-name matching only after package parsing exists.
- Integrate recommendation into a future smart init flow without changing write
  safety rules.
