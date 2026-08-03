# Project Intelligence Detector Implementation Plan

## Purpose
Define the implementation design for deterministic Project Intelligence
detection.

This is a design-only plan. It does not implement detection logic, add package
dependencies, change CLI behavior, or alter source files.

## Detector Goals
- Detect local project stack facts from deterministic filesystem evidence.
- Preserve the existing read-only, side-effect-free Project Intelligence
  foundation.
- Produce compact `ProjectIntelligenceProfile` data for CLI, init, template,
  and agent workflows.
- Keep every finding explainable through evidence IDs and project-relative
  paths.
- Avoid AI-based guessing, broad repository scans, and implicit confidence.

## Current Intelligence Foundation Status
Existing `@aeos/projects` intelligence work provides:

- `ProjectIntelligenceProfile` and related signal, evidence, issue, confidence,
  and summary contracts in `packages/projects/src/intelligence.ts`.
- Example profiles and evidence records in
  `packages/projects/src/intelligence.example.ts`.
- Project root detection in `packages/projects/src/root-detector.ts`.
- Metadata readers for `package.json`, `PROJECT_CONTEXT.md`, `AGENTS.md`, and
  `pnpm-workspace.yaml` in `packages/projects/src/metadata-reader.ts`.
- Public exports from `packages/projects/src/index.ts`.

The detector implementation should extend these contracts without changing the
contracts unless a future task explicitly allows it.

## Detector Architecture
The detector should be a small composition pipeline:

1. Normalize the input project root.
2. Build a bounded filesystem signal inventory from exact path checks and
   approved shallow directory reads.
3. Convert raw filesystem facts into normalized evidence records.
4. Run category detectors over the evidence inventory.
5. Normalize confidence and ambiguity issues.
6. Build a stable, sorted `ProjectIntelligenceProfile`.

Suggested future module layout:

- `packages/projects/src/intelligence-detector.ts`: public detector entrypoint
  and result orchestration.
- `packages/projects/src/intelligence-signals.ts`: deterministic signal
  definitions, evidence helpers, ignore rules, and bounded path inventory rules.
- `packages/projects/src/intelligence-profile-builder.ts`: profile assembly,
  sorting, summary selection, confidence normalization, and ambiguity handling.
- `packages/projects/src/intelligence-detector.example.ts`: focused detector
  examples and fixture-style inputs.

## Input/Output Model
The first detector input should be explicit and small:

- `projectRoot`: absolute or relative start root to inspect.
- optional `includeEvidence`: defaults to compact evidence, with full evidence
  reserved for JSON or verbose flows.
- optional `maxEntriesPerDirectory`: bounded shallow reads only.
- optional `maxManifestBytes`: file size guard for manifest reads.

The detector output should be a `ProjectIntelligenceProfile`.

Errors that prevent inspection should become `ProjectIntelligenceIssue` records
where possible. A hard failure should be reserved for invalid input that cannot
be normalized into a project root.

## Filesystem Boundary
The detector may inspect only the supplied project root and project-relative
paths below it.

Allowed MVP reads:

- exact root-level files and directories;
- known framework and infrastructure config paths;
- bounded directory entries for `.github/workflows/`;
- bounded conventional source path samples only when explicitly defined by the
  signal table.

The detector must not:

- recurse through the full repository;
- open ignored directories;
- inspect unrelated Markdown files;
- execute project commands;
- read remote metadata;
- write files.

## Evidence-First Detection Strategy
Detection should start with evidence records, not conclusions.

Each evidence record should include:

- category;
- source;
- project-relative path;
- matched signal;
- reason;
- confidence.

Findings should reference evidence IDs. A detector may produce no finding when
evidence is missing. It must not infer a language, framework, runtime, package
manager, infrastructure tool, or workspace solely from a neighboring category.

## Detection Signals

### Languages
- TypeScript: `tsconfig.json`, `tsconfig.base.json`, `.ts` or `.tsx` files, or
  `typescript` dependency in `package.json`.
- JavaScript: `package.json`, `.js` or `.jsx` files.
- PHP: `composer.json`, `.php` files, or `wp-config.php`.
- Python: `pyproject.toml`, `requirements.txt`, or `.py` files.
- Go: `go.mod` or `.go` files.
- Rust: `Cargo.toml` or `.rs` files.

### Frameworks
- WordPress: `wp-config.php`, `wp-content/`, or WordPress Composer packages.
- Next.js: `next.config.*`, `next` dependency, or `app/` or `pages/` paired
  with Node package evidence.
- React: `react` dependency or Vite config paired with React dependency.
- Laravel: `artisan` or Composer `laravel/framework` dependency.
- FastAPI: `fastapi` dependency or common app files paired with Python package
  evidence.

### Package Managers
- pnpm: `pnpm-lock.yaml`.
- npm: `package-lock.json`.
- yarn: `yarn.lock`.
- composer: `composer.lock` or `composer.json`.
- uv: `uv.lock`.
- pip: `requirements.txt`.
- Go modules: `go.mod`.
- cargo: `Cargo.lock` or `Cargo.toml`.

### Infrastructure
- Docker: `Dockerfile`.
- Docker Compose: `docker-compose.*`.
- GitHub Actions: `.github/workflows/`.
- Terraform: root-level or bounded infrastructure `.tf` files.

## Confidence Strategy
Use deterministic confidence bands:

- `high`: direct manifest, lockfile, framework config, or explicit workspace
  file evidence.
- `medium`: dependency evidence or multiple conventional supporting files.
- `low`: extension-only evidence or weak layout evidence.
- `unknown`: no usable evidence.

Evidence must drive confidence. Numeric scores and model confidence are out of
scope for MVP.

## Detector Ordering
Recommended order:

1. Root and exact path inventory.
2. Manifest and lockfile evidence.
3. Package manager detection.
4. Runtime detection.
5. Language detection.
6. Framework detection.
7. Infrastructure detection.
8. Monorepo/workspace detection.
9. Confidence and ambiguity normalization.
10. Profile building.

Package manager and manifest evidence should be available before framework and
runtime detection so those detectors can avoid weak inference.

## Performance Rules
- Prefer exact `existsSync` path checks over globs.
- Read only known manifests.
- Parse only fields required for detection.
- Bound shallow directory entry reads.
- Bound file size reads.
- Sort output deterministically.
- Do not run package managers, Docker, Terraform, Go, Cargo, Composer, Python,
  Node, or shell scripts.

## Token-Efficiency Rules
- Return compact summaries by default.
- Keep evidence reasons short and non-secret.
- Include detailed evidence only in JSON or explicit verbose flows.
- Avoid reading source file contents for extension-based signals.
- Avoid loading documentation files as detector evidence.

## Ignore Rules
Default ignored paths:

- `.git/`
- `node_modules/`
- `vendor/`
- `.next/`
- `dist/`
- `build/`
- `coverage/`
- `.turbo/`
- `.cache/`
- `.venv/`
- `venv/`

Ignore rules must apply before any bounded source or infrastructure sampling.

## Error Handling
- Missing optional files produce no evidence.
- Unreadable manifests produce warning issues with path evidence when possible.
- Invalid JSON or malformed manifests should not crash detection.
- Oversized manifests should be skipped with a warning issue.
- Invalid project root input may return a hard error from the detector entrypoint
  if no profile can be built.

## Ambiguity Handling
Ambiguity should be reported as issues, not hidden.

Examples:

- multiple JavaScript package manager lockfiles;
- both WordPress and Laravel strong evidence;
- both npm workspaces and pnpm workspace evidence;
- framework layout evidence without dependency or config support.

Specific framework evidence outranks generic language evidence. Next.js and
React may both be reported when both have evidence, with Next.js treated as the
more specific primary framework.

## Monorepo/Workspace Handling
Workspace detection should use explicit workspace evidence first:

- `pnpm-workspace.yaml`;
- `workspaces` in `package.json`;
- `Cargo.toml` workspace members;
- `go.work`.

Bounded package layout evidence such as `packages/` may support monorepo
classification only when the task scope explicitly permits that directory.

## CLI Integration
Future CLI integration should add:

- `aeos project profile`;
- `aeos project profile --json`.

Human output should remain compact: root, primary languages, frameworks,
package managers, runtimes, infrastructure, monorepo status, and ambiguity
warnings.

JSON output should emit one profile object and no progress text.

## Init/Template Integration
`aeos init` and template selection may consume the profile after the detector is
stable.

Rules:

- explicit user template selection wins over detection;
- ambiguous detection should prevent risky automatic template selection;
- profile facts may fill safe template defaults;
- the detector must not render templates or write files.

## Agentic Workflow Integration
Agent workflows may use the profile to:

- choose likely verification commands;
- avoid unavailable toolchains;
- reduce context loading;
- report stack facts in handoffs;
- treat low-confidence signals as hints only.

Agents should cite evidence-backed findings and ask for clarification when
ambiguity affects an action.

## MVP Scope
- Implement detector input contracts.
- Implement exact path and bounded directory signal inventory.
- Implement language, framework, package manager, runtime, infrastructure, and
  monorepo detection for the listed signals.
- Implement confidence and ambiguity normalization.
- Build stable `ProjectIntelligenceProfile` output.
- Add examples and focused verification.

## Later Scope
- Configurable scan depth.
- Repository-specific ignore configuration.
- Richer manifest and lockfile parsers.
- Cross-package workspace profiling.
- Verification command recommendation.
- Template ranking explanations.
- Audit-ready profile summaries.
- Policy overlays.

## Non-Goals
- AI-based stack guessing.
- Full source analysis.
- Dependency vulnerability scanning.
- Running project commands.
- Installing packages.
- Adding dependencies.
- CLI changes in the first detector tasks.
- Template rendering.
- Filesystem writes.
- Deployment.

## First Implementation Tasks

### TASK-0150
- Task ID: TASK-0150
- Title: Implement intelligence detector input contracts.
- Purpose: Define detector request, options, filesystem boundary, and result
  contracts without implementing detection logic.
- Likely files: `packages/projects/src/intelligence-detector.ts`,
  `packages/projects/src/index.ts`.
- Verification command: `pnpm --filter @aeos/projects check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0151
- Task ID: TASK-0151
- Title: Add intelligence detector contract examples.
- Purpose: Add example detector requests and empty detector results for future
  implementation alignment.
- Likely files: `packages/projects/src/intelligence-detector.example.ts`.
- Verification command: `pnpm --filter @aeos/projects check`.
- Recommended model effort: Low.
- Classification: Code.

### TASK-0152
- Task ID: TASK-0152
- Title: Implement evidence helper contracts.
- Purpose: Add stable helper shapes for root-relative evidence IDs, evidence
  source mapping, and issue creation.
- Likely files: `packages/projects/src/intelligence-signals.ts`,
  `packages/projects/src/index.ts`.
- Verification command: `pnpm --filter @aeos/projects check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0153
- Task ID: TASK-0153
- Title: Implement bounded filesystem inventory.
- Purpose: Add exact path checks, manifest read guards, and bounded shallow
  directory entry reads.
- Likely files: `packages/projects/src/intelligence-signals.ts`.
- Verification command: `pnpm --filter @aeos/projects check`.
- Recommended model effort: High.
- Classification: Code.

### TASK-0154
- Task ID: TASK-0154
- Title: Implement package manager signals.
- Purpose: Detect pnpm, npm, yarn, composer, uv, pip, Go modules, and cargo from
  lockfiles and manifests.
- Likely files: `packages/projects/src/intelligence-signals.ts`.
- Verification command: `pnpm --filter @aeos/projects check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0155
- Task ID: TASK-0155
- Title: Implement runtime signals.
- Purpose: Detect Node.js, PHP, Python, Go, and Rust runtime evidence from
  explicit runtime files and package metadata.
- Likely files: `packages/projects/src/intelligence-signals.ts`.
- Verification command: `pnpm --filter @aeos/projects check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0156
- Task ID: TASK-0156
- Title: Implement language signals.
- Purpose: Detect TypeScript, JavaScript, PHP, Python, Go, and Rust from
  manifests and bounded extension evidence.
- Likely files: `packages/projects/src/intelligence-signals.ts`.
- Verification command: `pnpm --filter @aeos/projects check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0157
- Task ID: TASK-0157
- Title: Implement framework signals.
- Purpose: Detect WordPress, Next.js, React, Laravel, and FastAPI from config,
  dependency, and bounded conventional file evidence.
- Likely files: `packages/projects/src/intelligence-signals.ts`.
- Verification command: `pnpm --filter @aeos/projects check`.
- Recommended model effort: High.
- Classification: Code.

### TASK-0158
- Task ID: TASK-0158
- Title: Implement infrastructure signals.
- Purpose: Detect Docker, Docker Compose, GitHub Actions, and Terraform from
  known local configuration paths.
- Likely files: `packages/projects/src/intelligence-signals.ts`.
- Verification command: `pnpm --filter @aeos/projects check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0159
- Task ID: TASK-0159
- Title: Implement monorepo signals.
- Purpose: Detect pnpm, npm, yarn, Cargo, and Go workspace evidence without
  broad repository scanning.
- Likely files: `packages/projects/src/intelligence-signals.ts`.
- Verification command: `pnpm --filter @aeos/projects check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0160
- Task ID: TASK-0160
- Title: Implement confidence and ambiguity normalization.
- Purpose: Convert evidence into high, medium, low, or unknown confidence and
  produce deterministic ambiguity issues.
- Likely files: `packages/projects/src/intelligence-profile-builder.ts`.
- Verification command: `pnpm --filter @aeos/projects check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0161
- Task ID: TASK-0161
- Title: Implement intelligence profile builder.
- Purpose: Compose detector signals into one stable, sorted
  `ProjectIntelligenceProfile`.
- Likely files: `packages/projects/src/intelligence-profile-builder.ts`,
  `packages/projects/src/intelligence-detector.ts`,
  `packages/projects/src/index.ts`.
- Verification command: `pnpm --filter @aeos/projects check`.
- Recommended model effort: High.
- Classification: Code.

### TASK-0162
- Task ID: TASK-0162
- Title: Add detector stack examples.
- Purpose: Add examples for Next.js, React, WordPress, Laravel, FastAPI, Go,
  Rust, Docker, GitHub Actions, Terraform, and package manager ambiguity.
- Likely files: `packages/projects/src/intelligence-detector.example.ts`.
- Verification command: `pnpm --filter @aeos/projects check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0163
- Task ID: TASK-0163
- Title: Define project profile CLI integration.
- Purpose: Design human and JSON output for `aeos project profile` before
  routing the detector into the CLI.
- Likely files: `docs/PROJECT_INTELLIGENCE_DETECTOR_IMPLEMENTATION_PLAN.md`.
- Verification command: `git status --short`.
- Recommended model effort: Low.
- Classification: Docs.
