# AEOS Project Intelligence Layer Design

## Purpose
Define the AEOS Project Intelligence Layer.

The layer detects local project stack signals and produces a compact stack
profile that future project, init, template, and agent workflows can consume.
It is design-only for this task. No TypeScript contracts or implementation are
defined here.

## Why Project Intelligence Is Needed
AEOS needs a deterministic way to understand what kind of repository it is
operating in before it selects templates, proposes commands, plans agent work,
or validates project setup.

The intelligence layer should answer:

- which languages are present;
- which frameworks are likely in use;
- which package managers and runtimes are expected;
- which infrastructure tools are configured;
- whether the project is a monorepo or workspace;
- which evidence supports each conclusion;
- how confident AEOS is in each finding.

This prevents later flows from relying on broad scans, model guesses, or
hard-coded assumptions.

## Current Project MVP Status
The current Project MVP is local, deterministic, read-only, and side-effect
free.

Existing `@aeos/projects` capabilities include:

- project root detection from local markers;
- metadata reading for `package.json`, `PROJECT_CONTEXT.md`, `AGENTS.md`, and
  `pnpm-workspace.yaml`;
- CLI-facing project status, context, root, and validation foundations.

The intelligence layer should extend this foundation without changing its
safety posture. It should inspect only bounded local files and return
serializable facts.

## Detection Scope
MVP detection should inspect only root-level or known configuration files and a
small bounded set of conventional manifest files.

Initial signal categories:

- languages;
- frameworks;
- package managers;
- runtimes;
- infrastructure;
- monorepo/workspace structure.

The layer should avoid deep source traversal in the MVP. Any later recursive
inspection must have explicit ignore rules, file-count limits, byte limits, and
clear evidence output.

## Language Detection
Language detection should prefer deterministic manifest and extension evidence.

MVP examples:

- TypeScript: `tsconfig.json`, `tsconfig.base.json`, `.ts` or `.tsx` files in a
  bounded source path, TypeScript dependency in package metadata.
- JavaScript: `package.json`, `.js`, `.jsx`, `.mjs`, or `.cjs` files in a
  bounded source path.
- PHP: `composer.json`, `index.php`, `wp-config.php`, `.php` files in bounded
  conventional paths.
- Python: `pyproject.toml`, `requirements.txt`, `uv.lock`, `Pipfile`,
  `.python-version`, `.py` files in bounded conventional paths.
- Go: `go.mod`, `go.sum`, `.go` files in bounded conventional paths.
- Rust: `Cargo.toml`, `Cargo.lock`, `.rs` files in bounded conventional paths.

Manifest evidence should score higher than extension-only evidence.

## Framework Detection
Framework detection should be evidence-based and should not infer a framework
from language alone.

MVP examples:

- WordPress: `wp-config.php`, `wp-content/`, `wp-includes/`, or WordPress
  package references in Composer metadata.
- Next.js: `next.config.js`, `next.config.mjs`, `next.config.ts`, or `next`
  dependency in `package.json`.
- React: `react` dependency in `package.json`, JSX/TSX evidence, or common
  React build tooling. React should not override Next.js; it may be a supporting
  framework when evidence exists.
- Laravel: `artisan`, `composer.json` containing `laravel/framework`, or
  conventional Laravel directories such as `app/`, `routes/`, and `bootstrap/`
  when paired with Composer evidence.
- FastAPI: `fastapi` dependency in `pyproject.toml`, `requirements.txt`, or
  lock metadata.

Framework findings should include evidence paths and the specific matched
signal.

## Package Manager Detection
Package manager detection should use lockfiles and manifest files.

MVP examples:

- pnpm: `pnpm-lock.yaml`, `pnpm-workspace.yaml`, or `packageManager` beginning
  with `pnpm@` in `package.json`.
- npm: `package-lock.json` or `packageManager` beginning with `npm@`.
- yarn: `yarn.lock` or `packageManager` beginning with `yarn@`.
- composer: `composer.json` or `composer.lock`.
- pip/uv: `requirements.txt`, `pyproject.toml`, `uv.lock`, or `Pipfile`.
- go modules: `go.mod` and optionally `go.sum`.
- cargo: `Cargo.toml` and optionally `Cargo.lock`.

Lockfiles should generally score higher than manifests because they describe
the selected package manager more directly.

## Runtime Detection
Runtime detection should derive from explicit runtime files and package manager
metadata.

MVP examples:

- Node.js: `package.json`, `.nvmrc`, `.node-version`, `engines.node`, or
  JavaScript/TypeScript package manager evidence.
- PHP: `composer.json`, `.php-version`, `wp-config.php`, or PHP framework
  evidence.
- Python: `.python-version`, `pyproject.toml`, `runtime.txt`, or Python package
  manager evidence.
- Go: `go.mod`.
- Rust: `Cargo.toml` or `rust-toolchain.toml`.

Runtime findings should stay separate from language findings because a
repository may contain generated code, tooling code, or multiple runtimes.

## Infrastructure Detection
Infrastructure detection should inspect only known local configuration paths in
the MVP.

MVP examples:

- Docker: `Dockerfile`, `docker-compose.yml`, `docker-compose.yaml`, or
  `.dockerignore`.
- GitHub Actions: `.github/workflows/*.yml` or `.github/workflows/*.yaml`, with
  bounded directory entry reads only.
- Terraform: `.tf` files in bounded conventional infrastructure paths or
  root-level Terraform files such as `main.tf`, `variables.tf`, and
  `providers.tf`.

The layer should report infrastructure presence without running the tools,
validating cloud credentials, or inspecting remote state.

## Monorepo/Workspace Detection
Workspace detection should look for explicit workspace manifests and bounded
package layout evidence.

MVP examples:

- `pnpm-workspace.yaml`;
- npm or yarn workspaces declared in `package.json`;
- Cargo workspace members in `Cargo.toml`;
- Go workspace file `go.work`;
- multiple direct child package manifests under conventional folders such as
  `packages/` only when the directory is explicitly in scope for the command.

The MVP should not recursively scan every directory to prove monorepo status.

## Stack Profile Model
The stack profile should be JSON-serializable and stable for CLI output.

Conceptual output:

```json
{
  "languages": [],
  "frameworks": [],
  "packageManagers": [],
  "runtimes": [],
  "infrastructure": [],
  "monorepo": {},
  "confidence": {},
  "evidence": []
}
```

Recommended conceptual fields:

- `languages`: detected language records with name, confidence, and evidence
  references.
- `frameworks`: detected framework records with name, confidence, and evidence
  references.
- `packageManagers`: detected package manager records with name, confidence,
  and evidence references.
- `runtimes`: detected runtime records with name, version constraint when
  available, confidence, and evidence references.
- `infrastructure`: detected infrastructure records with name, confidence, and
  evidence references.
- `monorepo`: workspace status, workspace kind, confidence, and evidence
  references.
- `confidence`: top-level summary scores by category.
- `evidence`: normalized evidence records.

This task does not define TypeScript contracts. TASK-0147 should freeze the
first implementation contract.

## Confidence Scoring
Confidence should be simple, deterministic, and explainable.

Recommended scoring bands:

- `high`: direct manifest, lockfile, or framework config evidence.
- `medium`: multiple supporting conventional files or dependency evidence.
- `low`: extension-only or weak layout evidence.

MVP scoring should avoid opaque numeric model confidence. Numeric scores can be
added later only if deterministic scoring rules are documented.

## Evidence Model
Every detection should point back to evidence.

Conceptual evidence fields:

- `id`: stable local evidence identifier.
- `category`: language, framework, package manager, runtime, infrastructure, or
  monorepo.
- `kind`: file_exists, manifest_field, dependency, lockfile, directory_exists,
  or bounded_glob_match.
- `path`: project-relative path when possible.
- `detail`: short non-secret matched signal.
- `weight`: high, medium, or low.

Evidence should never include full file contents, secrets, environment values,
or large snippets.

## Conflict And Ambiguity Handling
Conflicts are expected in polyglot repositories.

Rules:

- Multiple languages may be valid.
- Multiple package managers may be reported when evidence exists.
- Lockfile conflicts should be surfaced as ambiguity, not silently resolved.
- Framework-specific evidence should outrank generic framework evidence.
- Next.js and React can both be reported, with Next.js as the more specific web
  framework when both are present.
- WordPress and Laravel should not both be inferred from PHP alone.
- A missing manifest should produce no finding rather than a guessed finding.

Ambiguous results should include the competing evidence so CLI and agent flows
can ask for clarification or choose conservative defaults.

## Ignore Rules
The MVP should skip high-noise and high-cost paths.

Default ignored paths:

- `.git/`;
- `node_modules/`;
- `vendor/`;
- `.next/`;
- `dist/`;
- `build/`;
- `coverage/`;
- `.turbo/`;
- `.cache/`;
- virtual environments such as `.venv/` and `venv/`;
- generated lock or cache directories not needed for manifest detection.

Ignore rules must apply before any bounded source or infrastructure file
sampling.

## Performance And Token-Efficiency Rules
The layer should be cheap enough to run before CLI and agent workflows.

Rules:

- Prefer exact path checks over recursive scans.
- Read manifests only when their path is known.
- Parse only the fields needed for detection.
- Bound directory entry reads.
- Bound file size reads.
- Return compact summaries by default.
- Include detailed evidence only in JSON or explicit verbose flows.
- Do not load all Markdown files.
- Do not inspect application source trees unless a later command explicitly
  expands scope.

## CLI Integration
Future commands may expose the profile directly:

```sh
aeos project profile
aeos project profile --json
```

Human output should be compact:

- project root;
- primary languages;
- detected frameworks;
- package managers;
- runtimes;
- infrastructure;
- monorepo status;
- warnings for ambiguity.

JSON output should emit one profile object and no extra progress text.

## Init And Template Integration
`aeos init` can use the stack profile for smart template selection.

Future behavior:

- choose `project-default`, `generic`, or a more specific local template based
  on deterministic evidence;
- prefer explicit user template selection over automatic selection;
- avoid writing files unless init write mode is explicitly enabled;
- surface ambiguous detection before selecting a risky template;
- pass stack profile facts into template variable defaults when safe.

The intelligence layer should not render templates or write files itself.

## Agentic Workflow Integration
Agents can use the stack profile during task planning.

Use cases:

- propose verification commands based on package manager evidence;
- choose likely source areas after framework detection;
- avoid suggesting unavailable toolchains;
- summarize project stack in handoff reports;
- reduce context loading by reading only relevant files for the detected stack.

Agent workflows should treat low-confidence findings as hints, not facts.

## MVP Scope
MVP scope:

- define stack profile contracts in a follow-up task;
- inspect root-level and known config files only;
- detect the listed languages, frameworks, package managers, runtimes,
  infrastructure, and workspace signals;
- return deterministic confidence and evidence;
- add package-level profile builder in `@aeos/projects`;
- add `aeos project profile` and `aeos project profile --json` after package
  behavior is stable.

## Later Scope
Later scope:

- configurable scan depth;
- framework-specific detector modules;
- richer dependency parsing;
- repository-specific ignore configuration;
- cross-package workspace profiling;
- verification command recommendation;
- template ranking with explanations;
- audit-ready profile summaries;
- remote or organization policy overlays.

## Non-Goals
Non-goals:

- AI-based stack guessing.
- Full source code analysis.
- Dependency vulnerability scanning.
- Running package manager commands.
- Installing dependencies.
- Validating cloud resources.
- Reading remote repository metadata.
- Modifying project files.
- Selecting or rendering templates in the detector.
- Adding dependencies for the first MVP implementation.

## Safety Boundaries
The Project Intelligence Layer must be read-only.

It must not:

- create files or directories;
- overwrite files;
- install packages;
- deploy;
- push to Git;
- run project scripts;
- execute Docker, Terraform, Composer, npm, pnpm, yarn, pip, uv, Go, or Cargo;
- persist memory or audit records before explicit integration tasks.

All findings must be derived from local deterministic evidence.

## Implementation Sequence

### TASK-0147
- Task ID: TASK-0147
- Title: Implement project intelligence contracts.
- Purpose: Define the stack profile, finding, confidence, evidence, ambiguity,
  and detector result contracts without implementing detection logic.
- Likely files: `packages/projects/src/index.ts`,
  `packages/projects/src/intelligence.ts`.
- Verification command: `pnpm --filter @aeos/projects check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0148
- Task ID: TASK-0148
- Title: Add project intelligence contract examples.
- Purpose: Add focused examples for empty, JavaScript, PHP, and polyglot stack
  profiles.
- Likely files: `packages/projects/src/intelligence.examples.ts`.
- Verification command: `pnpm --filter @aeos/projects check`.
- Recommended model effort: Low.
- Classification: Code.

### TASK-0149
- Task ID: TASK-0149
- Title: Implement manifest evidence helpers.
- Purpose: Add small helpers for root-relative path evidence, file existence
  evidence, manifest field evidence, and stable evidence IDs.
- Likely files: `packages/projects/src/intelligence.ts`.
- Verification command: `pnpm --filter @aeos/projects check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0150
- Task ID: TASK-0150
- Title: Implement package manager detection.
- Purpose: Detect pnpm, npm, yarn, composer, pip/uv, go modules, and cargo from
  lockfiles and manifests.
- Likely files: `packages/projects/src/intelligence.ts`.
- Verification command: `pnpm --filter @aeos/projects check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0151
- Task ID: TASK-0151
- Title: Implement language detection.
- Purpose: Detect TypeScript, JavaScript, PHP, Python, Go, and Rust from
  manifests and bounded conventional file evidence.
- Likely files: `packages/projects/src/intelligence.ts`.
- Verification command: `pnpm --filter @aeos/projects check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0152
- Task ID: TASK-0152
- Title: Implement runtime detection.
- Purpose: Detect Node.js, PHP, Python, Go, and Rust runtime signals from
  explicit runtime files and manifest metadata.
- Likely files: `packages/projects/src/intelligence.ts`.
- Verification command: `pnpm --filter @aeos/projects check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0153
- Task ID: TASK-0153
- Title: Implement framework detection.
- Purpose: Detect WordPress, Next.js, React, Laravel, and FastAPI from
  framework configs, manifests, dependencies, and bounded conventional paths.
- Likely files: `packages/projects/src/intelligence.ts`.
- Verification command: `pnpm --filter @aeos/projects check`.
- Recommended model effort: High.
- Classification: Code.

### TASK-0154
- Task ID: TASK-0154
- Title: Implement infrastructure detection.
- Purpose: Detect Docker, GitHub Actions, and Terraform from known local config
  files with bounded directory reads.
- Likely files: `packages/projects/src/intelligence.ts`.
- Verification command: `pnpm --filter @aeos/projects check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0155
- Task ID: TASK-0155
- Title: Implement monorepo detection.
- Purpose: Detect pnpm, npm, yarn, Cargo, and Go workspace signals without broad
  repository scanning.
- Likely files: `packages/projects/src/intelligence.ts`.
- Verification command: `pnpm --filter @aeos/projects check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0156
- Task ID: TASK-0156
- Title: Add confidence and ambiguity normalization.
- Purpose: Normalize detector findings into high, medium, and low confidence
  bands and surface package manager or framework ambiguity.
- Likely files: `packages/projects/src/intelligence.ts`.
- Verification command: `pnpm --filter @aeos/projects check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0157
- Task ID: TASK-0157
- Title: Add stack profile builder.
- Purpose: Compose all detector outputs into one sorted, serializable stack
  profile with compact evidence references.
- Likely files: `packages/projects/src/intelligence.ts`,
  `packages/projects/src/index.ts`.
- Verification command: `pnpm --filter @aeos/projects check`.
- Recommended model effort: High.
- Classification: Code.

### TASK-0158
- Task ID: TASK-0158
- Title: Add stack profile examples.
- Purpose: Add examples covering Next.js, WordPress, Laravel, FastAPI, Go, Rust,
  Docker, GitHub Actions, Terraform, and ambiguous package managers.
- Likely files: `packages/projects/src/intelligence.examples.ts`.
- Verification command: `pnpm --filter @aeos/projects check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0159
- Task ID: TASK-0159
- Title: Define project profile CLI output.
- Purpose: Freeze human and JSON output for `aeos project profile` before
  adding CLI routing.
- Likely files: `docs/PROJECT_INTELLIGENCE_LAYER_DESIGN.md`,
  `TASKS/backlog.md`, `PROJECT_CONTEXT.md`.
- Verification command: `git status --short`.
- Recommended model effort: Low.
- Classification: Docs.

### TASK-0160
- Task ID: TASK-0160
- Title: Implement aeos project profile command.
- Purpose: Add compact human output for the stack profile using the project
  package profile builder.
- Likely files: `apps/cli/src/commands.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0161
- Task ID: TASK-0161
- Title: Implement aeos project profile JSON output.
- Purpose: Add one-line JSON output for `aeos project profile --json`.
- Likely files: `apps/cli/src/commands.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0162
- Task ID: TASK-0162
- Title: Review project intelligence MVP behavior.
- Purpose: Confirm the profile command remains deterministic, local-first,
  read-only, token-efficient, and evidence-based.
- Likely files: `docs/PROJECT_INTELLIGENCE_LAYER_DESIGN.md`,
  `TASKS/backlog.md`, `PROJECT_CONTEXT.md`.
- Verification command: `git status --short`.
- Recommended model effort: Medium.
- Classification: Docs.
