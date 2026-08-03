# AEOS Project Profile Command Design

## Purpose
Expose the deterministic Project Intelligence profile through the AEOS CLI.

The MVP command is:

```sh
aeos project profile
aeos project profile --json
```

The command should help operators and future AEOS workflows inspect the current
repository stack without running project tools, parsing dependency contents, or
asking a model to infer missing facts.

## Current Project Intelligence Status
`@aeos/projects` already provides the first local Project Intelligence
foundation:

- serializable profile contracts in `packages/projects/src/intelligence.ts`;
- detector input, scan entry, issue, and result contracts in
  `packages/projects/src/intelligence-detector.ts`;
- bounded scan collection with default limits and ignore rules in
  `packages/projects/src/intelligence-scan-collector.ts`;
- deterministic signal definitions and matching;
- profile building, summary counts, and detector orchestration;
- public exports from `packages/projects/src/index.ts`.

Current limitations are intentional. Dependency-name signals are defined but not
matched yet, package content parsing is not implemented, and detection remains
evidence-based only.

## Command Behavior
`aeos project profile` should:

1. Use `process.cwd()` as the project root for the MVP.
2. Build the default Project Intelligence detector input for that root.
3. Override detector defaults only as needed for profile output.
4. Run the detector through `@aeos/projects`.
5. Render compact human output by default.
6. Render exactly one JSON object for `--json`.

The command must not accept a target-root flag in the MVP. Unknown flags should
produce a usage error and nonzero exit.

## Human Output Shape
Human output should be compact and stable:

```text
Project Profile
Root: /absolute/project/root
Languages: typescript, javascript
Frameworks: unknown
Package managers: pnpm
Runtimes: node
Infrastructure: docker, github_actions
Monorepo: yes (pnpm_workspace)
Evidence count: 12
Issue count: 1
```

Rendering rules:

- show `unknown` for empty language, framework, package manager, runtime, or
  infrastructure lists;
- show `yes (<kind>)` for monorepos and `no` when no workspace evidence exists;
- use lowercase stable enum values from the profile;
- do not print full evidence records in human output;
- print issues only as compact warnings when issue count is nonzero.

## JSON Output Shape
`aeos project profile --json` should write one JSON line to stdout and no
progress text to stderr.

Stable top-level fields:

```json
{
  "ok": true,
  "projectRoot": "/absolute/project/root",
  "profile": {},
  "scannedEntries": [],
  "issues": [],
  "summary": {}
}
```

Field rules:

- `ok`: `true` when the detector completes and a profile is emitted.
- `projectRoot`: absolute root used for scanning.
- `profile`: complete `ProjectIntelligenceProfile`.
- `scannedEntries`: detector scan entries, sorted by path.
- `issues`: detector issues, sorted deterministically.
- `summary`: detector summary including scanned entry count, evidence count,
  issue count, and truncation status.

Failure JSON should also be one line and use a stable reason:

```json
{
  "ok": false,
  "projectRoot": "/absolute/or/requested/root",
  "profile": null,
  "scannedEntries": [],
  "issues": [],
  "summary": null,
  "reason": "project_profile_failed"
}
```

## Exit Code Behavior
- Exit `0` when a profile is produced, even when warnings or info issues are
  present.
- Exit `1` for invalid command usage, unknown flags, invalid project root input,
  or detector failures that prevent a profile from being built.
- Detector warning and info issues do not make the command fail.
- Error-severity detector issues should be reported, but the MVP should still
  exit `0` when the detector returns a usable profile.

## Default Scan Options
MVP command defaults:

- `projectRoot`: current working directory.
- `mode`: `profile`.
- `scope`: `bounded_workspace`.
- `includeHiddenFiles`: `false`.
- `followSymlinks`: `false`.
- `includeLockfiles`: `true`.
- `includeInfrastructure`: `true`.
- `includeMonorepoSignals`: `true`.
- `includeDependencySignals`: `false`.
- use existing detector limits unless a later task changes the package default.

The command should remain deterministic, local, read-only, and side-effect free.

## Ignore Rules Behavior
Use the package default ignore rules:

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

Ignore rules apply before bounded source or infrastructure sampling. Glob-style
ignore patterns are not MVP behavior and should be reported as unsupported only
if supplied internally by future code.

## Hidden File Behavior
Hidden files and directories are skipped by default because the current scanner
uses `includeHiddenFiles: false`.

Known consequence: root-level hidden runtime files such as `.nvmrc` may not
appear in MVP results until a later task adds explicit safe handling for selected
hidden config files. The CLI must not overstate hidden-file coverage.

## Infrastructure Signal Behavior
The profile command should enable infrastructure signals so operators can see
Docker, Docker Compose, GitHub Actions, and Terraform evidence already supported
by the signal table.

The command must not run Docker, Terraform, GitHub tooling, package managers, or
cloud commands. Infrastructure output means local config evidence exists, not
that the infrastructure is valid or deployable.

## Monorepo Signal Behavior
The profile command should enable monorepo signals so workspace evidence appears
in human and JSON output.

MVP monorepo reporting is evidence-based and limited to existing scan behavior
and signal definitions. It should not recursively prove package graph structure
or parse workspace package contents.

## Error And Issue Reporting
Issues should stay machine-readable in JSON and compact in human output.

Human issue output:

```text
Issues:
- info matcher.signal.dependency_name_unsupported
- warning collector.file.too_large: path/to/file
```

Rules:

- include issue severity and code;
- include path when present;
- do not include file contents;
- do not duplicate profile issues and detector issues in human output;
- keep dependency parsing unsupported messages visible in JSON, but avoid
  implying dependency parsing exists.

## Performance And Safety Rules
- Do not write files.
- Do not install dependencies.
- Do not execute project scripts.
- Do not run package managers.
- Do not run Git, Docker, Terraform, Composer, Cargo, Go, Python, Node project
  commands, or shell scripts.
- Do not follow symlinks by default.
- Keep output sorted and deterministic.
- Keep scanning bounded by existing package limits.
- Do not parse package dependency contents in the CLI.
- Do not add AI-based guessing or confidence.

## Known MVP Limitations
- No `--root` or target-root flag.
- No dependency parsing.
- No package content parsing.
- No manifest field parsing from the CLI.
- Hidden config files are generally skipped.
- Monorepo reporting is signal-based, not a full workspace graph.
- Infrastructure reporting is presence-based, not validation.
- No verbose evidence flag.
- No filtering by category.
- No persisted profile cache.

## Later Scope
- Add `--root <path>` after root safety behavior is designed.
- Add explicit safe hidden config checks for files such as `.nvmrc`.
- Add package manifest content parsing in `@aeos/projects`.
- Add dependency-name matching only after package parsing is implemented.
- Add `--verbose` evidence output for humans.
- Add category filters.
- Integrate project profile summaries into `aeos init` and template selection.
- Add richer ambiguity reporting for conflicting package manager and framework
  evidence.

## Smoke Test Requirements
Future implementation should update `apps/cli/scripts/smoke.mjs` to verify:

- `aeos project profile` exits `0` in this repository.
- Human output includes `Project Profile`.
- Human output includes `Root:`.
- Human output includes `Languages:`.
- Human output includes `Frameworks:`.
- Human output includes `Package managers:`.
- Human output includes `Runtimes:`.
- Human output includes `Infrastructure:`.
- Human output includes `Monorepo:`.
- Human output includes `Evidence count:`.
- Human output includes `Issue count:`.
- `aeos project profile --json` exits `0`.
- JSON output is exactly one parseable JSON line.
- JSON output has stable fields: `ok`, `projectRoot`, `profile`,
  `scannedEntries`, `issues`, and `summary`.
- JSON `ok` is `true`.
- JSON `projectRoot` is a non-empty string.
- JSON `scannedEntries` and `issues` are arrays.
- JSON `summary.evidenceCount` and `summary.issueCount` are numbers.
- Unknown profile flags exit nonzero and report usage.

## Implementation Sequence

### TASK-0167
- Task ID: TASK-0167
- Title: Implement aeos project profile command.
- Purpose: Add CLI routing for `aeos project profile` and `--json` using the
  existing `@aeos/projects` detector orchestration.
- Likely files: `apps/cli/src/commands.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0168
- Task ID: TASK-0168
- Title: Add project profile help text.
- Purpose: Include `aeos project profile` and `aeos project profile --json` in
  CLI help and unsupported project subcommand output.
- Likely files: `apps/cli/src/commands.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Low.
- Classification: Code.

### TASK-0169
- Task ID: TASK-0169
- Title: Add project profile JSON shape tests.
- Purpose: Extend CLI smoke checks to require one-line stable JSON output for
  `aeos project profile --json`.
- Likely files: `apps/cli/scripts/smoke.mjs`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0170
- Task ID: TASK-0170
- Title: Add project profile human smoke tests.
- Purpose: Extend CLI smoke checks for compact human output fields and no
  overpromised dependency parsing.
- Likely files: `apps/cli/scripts/smoke.mjs`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0171
- Task ID: TASK-0171
- Title: Review profile command scan defaults.
- Purpose: Confirm CLI detector options match this design and stay conservative
  after implementation.
- Likely files: `docs/PROJECT_PROFILE_COMMAND_DESIGN.md`,
  `apps/cli/src/commands.ts`.
- Verification command: `git status --short`.
- Recommended model effort: Low.
- Classification: Docs/code.

### TASK-0172
- Task ID: TASK-0172
- Title: Add project profile issue rendering polish.
- Purpose: Keep human issue output compact with severity, code, and optional
  path while preserving JSON details.
- Likely files: `apps/cli/src/commands.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Low.
- Classification: Code.

### TASK-0173
- Task ID: TASK-0173
- Title: Add project profile invalid flag handling.
- Purpose: Ensure unknown profile flags produce stable human and JSON failures
  without running the detector.
- Likely files: `apps/cli/src/commands.ts`,
  `apps/cli/scripts/smoke.mjs`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0174
- Task ID: TASK-0174
- Title: Review project profile MVP behavior.
- Purpose: Perform a docs/code review of the shipped profile command against
  this design and record any follow-up scope.
- Likely files: `docs/PROJECT_PROFILE_COMMAND_DESIGN.md`,
  `TASKS/backlog.md`, `PROJECT_CONTEXT.md`.
- Verification command: `git status --short`.
- Recommended model effort: Medium.
- Classification: Docs.

### TASK-0175
- Task ID: TASK-0175
- Title: Design explicit hidden config handling.
- Purpose: Define how selected hidden config files can be inspected without
  enabling broad hidden file scanning.
- Likely files: `docs/PROJECT_PROFILE_COMMAND_DESIGN.md`.
- Verification command: `git status --short`.
- Recommended model effort: Medium.
- Classification: Docs.
