# AEOS Project Validate Implementation Plan

## Purpose
Define the implementation plan for `aeos project validate`.

The command provides a lightweight local project health check using existing
`@aeos/projects` root detection and metadata capabilities.

## Project Validate Goal
`aeos project validate` should answer whether the current working directory is
inside a minimally consistent AEOS project.

MVP command:

```sh
aeos project validate
```

Future command:

```sh
aeos project validate --json
```

The command must be deterministic, side-effect free, and local-only.

## Non-goals
- Dependency vulnerability scanning.
- Source code analysis.
- CI checks.
- Deployment checks.
- GitHub checks.
- Security auditing.
- Adding dependencies.
- Choosing or adding a validation framework.
- Creating missing project files.
- Modifying `@aeos/projects` before a dedicated implementation task requires it.

## Current Project Foundation Status
- `packages/projects/src/root-detector.ts` exposes `detectProjectRoot`,
  `findProjectRoot`, and marker detection.
- Root markers currently include `package.json`, `pnpm-workspace.yaml`, `.git`,
  `AGENTS.md`, and `PROJECT_CONTEXT.md`.
- `packages/projects/src/metadata-reader.ts` exposes readable facts for package
  metadata, `PROJECT_CONTEXT.md`, `AGENTS.md`, and workspace presence.
- `packages/projects/src/index.ts` exports the current root and metadata helpers.
- `apps/cli/src/commands.ts` already routes `aeos project status` and
  `aeos project context`.
- `aeos project validate` routing does not exist yet.

## Validation Data Sources
- `detectProjectRoot(process.cwd())`.
- `readProjectMetadata(rootPath)`.
- `ProjectMetadata.package`.
- `ProjectMetadata.context`.
- `ProjectMetadata.agents`.
- `ProjectMetadata.hasWorkspace`.
- Root detection marker list returned by `detectProjectRoot`.

## Validation Rules
MVP required checks:

1. Project root exists.
2. Package metadata is readable when `package.json` exists.
3. `PROJECT_CONTEXT.md` is present.
4. `AGENTS.md` is present.
5. Workspace marker is present.
6. Basic project consistency passes.

Basic project consistency means the detected root and metadata root refer to the
same path, and the presence booleans agree with their nested metadata objects.

MVP should treat missing `PROJECT_CONTEXT.md`, missing `AGENTS.md`, missing
workspace marker, and unreadable package metadata as validation failures. A
missing project root is also a validation failure and should not attempt
metadata reading.

## Validation Result Format
Internal result shape should be simple enough to keep inside the CLI for the
first implementation:

```ts
type ProjectValidationStatus = "pass" | "fail";

type ProjectValidationIssue = {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
};
```

Recommended issue codes:

- `project_root_not_found`
- `package_metadata_unreadable`
- `missing_project_context`
- `missing_agents`
- `missing_workspace_marker`
- `project_metadata_inconsistent`

## Human Output Design
Human output should be compact and stable:

```text
Project Validation
Status: pass
Root: /path/to/project
Checks:
- project_root: pass
- package_metadata: pass
- project_context: pass
- agents: pass
- workspace: pass
- consistency: pass
```

Failure output should include one issue per line:

```text
Project Validation
Status: fail
Root: /path/to/project
Checks:
- project_root: pass
- package_metadata: fail
- project_context: pass
- agents: pass
- workspace: fail
- consistency: pass
Issues:
- package_metadata_unreadable: package.json exists but name/version could not be read
- missing_workspace_marker: pnpm-workspace.yaml is missing
```

The command should exit `0` when all checks pass and `1` when any validation
check fails.

## JSON Future Output
`aeos project validate --json` is deferred until the human command is stable.

Future JSON should be one line and use stable fields:

```json
{"ok":true,"status":"pass","root":"/path/to/project","checks":[],"issues":[]}
```

Failure JSON should use machine-readable issue codes and avoid stack traces.

## Error Handling
- Unknown project subcommands should continue to use compact CLI usage errors.
- Root detection failure should render `project_root_not_found` or
  `start_path_not_found` and exit `1`.
- Metadata read failures should become validation issues, not uncaught errors.
- Human output should avoid implementation details and stack traces.
- `--json` should remain unsupported until its dedicated task.

## Verification Integration Placeholder
Future verification integration may allow a broader `aeos verify` command to
call project validation as one check. This plan does not define that interface.

## Audit Integration Placeholder
Future audit integration may record validation runs and outcomes. The MVP must
not write audit files or emit audit events.

## MVP Scope
- Add `aeos project validate` route in `apps/cli/src/commands.ts`.
- Use existing `@aeos/projects` helpers.
- Render compact human pass/fail output.
- Return exit code `1` for validation failures.
- Do not add package APIs unless needed by a dedicated task.
- Do not implement `--json` in the MVP command task.

## Later Scope
- `aeos project validate --json`.
- Shared project validation helper in `@aeos/projects`.
- Richer issue severities.
- Verification command integration.
- Audit event integration.
- Policy-aware validation.
- Optional checks for `.aeos/` once project initialization is defined.

## First 10 Implementation Tasks

### TASK-0088
- Task ID: TASK-0088
- Title: Implement project validate command.
- Purpose: Add `aeos project validate` routing and compact human validation
  output using existing `@aeos/projects` helpers.
- Likely files: `apps/cli/src/commands.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0089
- Task ID: TASK-0089
- Title: Add project validate usage handling.
- Purpose: Ensure unsupported flags and unknown project subcommands show stable
  usage text that includes `aeos project validate`.
- Likely files: `apps/cli/src/commands.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Low.
- Classification: Code.

### TASK-0090
- Task ID: TASK-0090
- Title: Add project validate smoke notes.
- Purpose: Document manual smoke commands and expected pass/fail behavior for
  the human validate command.
- Likely files: `docs/PROJECT_VALIDATE_IMPLEMENTATION_PLAN.md`.
- Verification command: `git status --short`.
- Recommended model effort: Low.
- Classification: Docs.

### TASK-0091
- Task ID: TASK-0091
- Title: Review project validate human output.
- Purpose: Confirm output labels, issue codes, and exit-code behavior are stable
  before adding machine-readable output.
- Likely files: `docs/PROJECT_VALIDATE_IMPLEMENTATION_PLAN.md`,
  `TASKS/backlog.md`, `PROJECT_CONTEXT.md`.
- Verification command: `git status --short`.
- Recommended model effort: Low.
- Classification: Docs.

### TASK-0092
- Task ID: TASK-0092
- Title: Define project validate JSON contract.
- Purpose: Freeze the `aeos project validate --json` response shape after human
  output is implemented and reviewed.
- Likely files: `docs/PROJECT_VALIDATE_IMPLEMENTATION_PLAN.md`,
  `TASKS/backlog.md`, `PROJECT_CONTEXT.md`.
- Verification command: `git status --short`.
- Recommended model effort: Low.
- Classification: Docs.

### TASK-0093
- Task ID: TASK-0093
- Title: Implement project validate JSON output.
- Purpose: Add one-line JSON output for `aeos project validate --json` using
  the reviewed validation result shape.
- Likely files: `apps/cli/src/commands.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0094
- Task ID: TASK-0094
- Title: Extract project validation builder.
- Purpose: Move repeated validation check assembly into a small helper while
  preserving CLI behavior.
- Likely files: `apps/cli/src/commands.ts`.
- Verification command: `pnpm --filter @aeos/cli check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0095
- Task ID: TASK-0095
- Title: Plan project validation package API.
- Purpose: Decide whether validation result construction should move into
  `@aeos/projects` after CLI behavior stabilizes.
- Likely files: `docs/PROJECT_VALIDATE_IMPLEMENTATION_PLAN.md`,
  `TASKS/backlog.md`, `PROJECT_CONTEXT.md`.
- Verification command: `git status --short`.
- Recommended model effort: Low.
- Classification: Docs.

### TASK-0096
- Task ID: TASK-0096
- Title: Implement project validation package API.
- Purpose: Add a reusable validation helper in `@aeos/projects` only if the
  package API plan approves it.
- Likely files: `packages/projects/src/index.ts`,
  `packages/projects/src/metadata-reader.ts`,
  `packages/projects/src/root-detector.ts`.
- Verification command: `pnpm --filter @aeos/projects check`.
- Recommended model effort: Medium.
- Classification: Code.

### TASK-0097
- Task ID: TASK-0097
- Title: Review project validate MVP behavior.
- Purpose: Confirm human and JSON validation behavior before project audit or
  verification integration work starts.
- Likely files: `docs/PROJECT_VALIDATE_IMPLEMENTATION_PLAN.md`,
  `TASKS/backlog.md`, `PROJECT_CONTEXT.md`.
- Verification command: `git status --short`.
- Recommended model effort: Medium.
- Classification: Docs.

## Stop Conditions Before Full Project Audit
- `aeos project validate` works in human mode.
- `aeos project validate --json` has a reviewed contract or is explicitly
  deferred.
- Validation issue codes are stable.
- Root detection failures produce stable output and exit code `1`.
- Missing `PROJECT_CONTEXT.md`, `AGENTS.md`, and workspace markers are reported
  without creating files.
- No dependency vulnerability scanning has been added.
- No source code analysis has been added.
- No CI, deployment, GitHub, or security audit checks have been added.
- No audit files or events are written.
