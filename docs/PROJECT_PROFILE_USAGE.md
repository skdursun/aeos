# AEOS Project Profile Usage

## Purpose
`aeos project profile` prints the current local project stack profile produced
by the deterministic Project Intelligence detector.

Use it to inspect repository signals before future AEOS init, template, agent,
or verification workflows consume project intelligence.

## Commands
```sh
aeos project profile
aeos project profile --json
```

## Current MVP Behavior
- Uses the current working directory as the project root.
- Runs local, bounded Project Intelligence detection in `profile` mode.
- Reports only evidence found from local filesystem signals.
- Enables lockfile, infrastructure, and monorepo/workspace signals.
- Disables dependency-name signals and package dependency parsing.
- Does not accept a target-root flag yet.

## Detection Model
Detection is local-first, deterministic, and evidence-based. The command does
not run project tools, package managers, Docker, Terraform, GitHub tooling, or
shell scripts. It does not ask AI to infer missing facts.

Current supported signal categories:

- languages
- frameworks
- package managers
- runtimes
- infrastructure
- monorepo/workspace

Current evidence comes from file, directory, config, and lockfile-style signals
only. Package contents and dependency lists are not parsed in the MVP.

## Current Working Directory Behavior
The MVP profiles `process.cwd()`. Run the command from the repository or folder
you want inspected:

```sh
cd /path/to/project
aeos project profile
```

There is no `--root` or target-root flag yet.

## Human Output Shape
Default output is compact and omits full evidence records:

```text
Project Profile
Root: /absolute/project/root
Languages: typescript, javascript
Frameworks: nextjs
Package managers: pnpm
Runtimes: node
Infrastructure: docker, terraform
Monorepo: yes (pnpm_workspace)
Evidence count: 12
Issue count: 1
Issues:
- info matcher.signal.dependency_name_unsupported
```

Empty categories render as `unknown`. Monorepo output renders as `yes (<kind>)`
when workspace evidence exists and `no` otherwise.

## JSON Output Shape
`aeos project profile --json` writes exactly one JSON object to stdout and no
progress text to stderr on success.

Stable top-level fields:

```json
{
  "ok": true,
  "projectRoot": "...",
  "profile": {},
  "scannedEntries": [],
  "issues": [],
  "summary": {}
}
```

Field meanings:

- `ok`: `true` when a usable profile is produced.
- `projectRoot`: absolute root used for detection.
- `profile`: complete Project Intelligence profile.
- `scannedEntries`: bounded scan entries.
- `issues`: detector issues.
- `summary`: detector summary counts and truncation/timing flags.

Failure JSON keeps a stable failure reason:

```json
{
  "ok": false,
  "projectRoot": "...",
  "profile": null,
  "scannedEntries": [],
  "issues": [],
  "summary": null,
  "reason": "project_profile_failed"
}
```

## Exit Code Behavior
- Exits `0` when a profile is produced.
- Exits `1` for unknown options or detector failures that prevent profile
  output.
- Warning and info issues do not fail the command.
- Error-severity detector issues may appear in output, but the MVP still exits
  `0` when the detector returns a usable profile.

## No-Write Guarantee
The command is read-only. It does not create, update, delete, rename, cache, or
persist files.

## Safety Guarantees
- No package manager commands are run.
- No project scripts are run.
- No Docker, Terraform, cloud, or GitHub commands are run.
- Symlinks are not followed by default.
- Hidden files and directories are skipped by default.
- Output is deterministic and sorted by the detector.
- Evidence records do not include full file contents or secrets.

## Known MVP Limitations
- No package content parsing.
- No dependency parsing.
- No AI guessing.
- No target-root flag yet.
- Evidence comes from file, directory, config, and lockfile-style signals only.
- Hidden config files are generally skipped, including files such as `.nvmrc`.
- Hidden infrastructure directories such as `.github/workflows/` are skipped
  while hidden files are disabled.
- Infrastructure findings indicate local config presence, not validity.
- Monorepo findings are signal-based, not a full workspace graph.
- No verbose human evidence view.
- No category filtering.
- No persisted profile cache.

## Later Scope
- Add a safe target-root flag.
- Add explicit safe handling for selected hidden config paths.
- Add package manifest content parsing.
- Add dependency-name matching after package parsing exists.
- Add verbose evidence output for humans.
- Add category filters.
- Feed profile summaries into init and template selection.
