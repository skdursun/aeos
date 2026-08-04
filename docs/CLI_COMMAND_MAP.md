# AEOS CLI Command Map

## Purpose
Define the planned AEOS CLI command surface before implementation begins.

The CLI gives operators a predictable interface for project setup, task
execution, context loading, memory, verification, policy checks, agents, and tool
adapters.

## CLI Design Principles
- Keep commands model-independent and adapter-friendly.
- Prefer explicit commands over hidden automation.
- Keep task scope small, isolated, and auditable.
- Load context lazily from known project files.
- Require verification before marking work complete.
- Require policy checks before risky or external actions.
- Produce compact handoff output by default.
- Avoid provider-specific names in core commands.

## Command Groups
- Project: initialize, inspect, and prepare AEOS projects.
- Task: create, run, and complete micro-tasks.
- Memory: write and search structured engineering memory.
- Planning: create plans and reviews before implementation.
- Verification: run checks against task expectations.
- Agent: inspect available agent adapters.
- Tool / MCP: inspect available tool adapters.
- Policy: evaluate safety and approval requirements.
- Audit: inspect action history and evidence.

## Project Commands
### `aeos init`
- Purpose: Create or validate the minimal AEOS project structure.
- Example usage: `aeos init`, `aeos init --json`, `aeos init --write`,
  `aeos init --write --json`
- Expected behavior: Defaults to dry-run planning with no filesystem writes.
  `--write` explicitly enables writing the current MVP artifact, `AGENTS.md`,
  under the current working directory. Existing `AGENTS.md` files are not
  overwritten; conflicts block the command and exit nonzero.
- Phase: MVP.

### `aeos status`
- Purpose: Show the current project, phase, task, and verification state.
- Example usage: `aeos status`
- Expected behavior: Reads project context and task metadata, then prints a
  concise status report without modifying files.
- Phase: MVP.

### `aeos project profile`
- Purpose: Print the deterministic local Project Intelligence profile for the
  current working directory.
- Example usage: `aeos project profile`, `aeos project profile --json`
- Expected behavior: Runs read-only, bounded, evidence-based detection for
  languages, frameworks, package managers, runtimes, infrastructure, and
  monorepo/workspace signals. Human output is compact; `--json` emits one stable
  JSON object with `ok`, `projectRoot`, `profile`, `scannedEntries`, `issues`,
  and `summary`. The MVP does not parse package contents or dependencies, does
  not use AI guessing, and has no target-root flag.
- Phase: MVP.

### `aeos template recommend`
- Purpose: Recommend a deterministic MVP smart template candidate for the
  current working directory without writing files.
- Example usage: `aeos template recommend`,
  `aeos template recommend --json`
- Expected behavior: Runs read-only Project Intelligence detection, scores only
  the built-in allow-list candidates, and prints a compact recommendation or
  fallback. `--json` emits one stable JSON object with `ok`, `projectRoot`,
  `mode`, `recommendation`, `candidates`, `fallbackUsed`, `issues`, and
  `summary`. The MVP does not run init, create templates, use a production
  catalog, fetch remote templates, query a marketplace, parse package contents
  or dependencies, use AI guessing, or accept a target-root flag.
- Phase: MVP.

### `aeos context`
- Purpose: Build the minimal context bundle for a task or session.
- Example usage: `aeos context --task TASK-0005`
- Expected behavior: Lists exact files to load, exclusions, writable files,
  verification steps, and stop condition.
- Phase: MVP.

## Task Commands
### Planned Agentic Task Commands
These commands are planned for the agentic task CLI surface but are not
implemented until actual CLI task work is added. The first MVP command set must
not perform real model, agent, tool, MCP, adapter, audit, verifier, persistence,
or autonomous execution.

- `aeos task plan`: planned; will print a deterministic task plan only.
- `aeos task plan --json`: planned; will emit JSON-only task plan output.
- `aeos task run --dry-run`: planned; will print execution-shaped preview
  output only.
- `aeos task run --dry-run --json`: planned; will emit JSON-only dry-run
  preview output only.
- `aeos task status`: planned; may report unavailable until task persistence
  exists.
- `aeos task status --json`: planned; may emit JSON-only unavailable status
  until task persistence exists.
- `aeos task verify`: planned; may report unavailable until persisted state or
  explicit coverage evidence loading exists.
- `aeos task verify --json`: planned; may emit JSON-only verifier placeholder
  output until evidence loading exists.
- `aeos task resume`: planned; must not resume real execution in the first MVP.
- `aeos task resume --dry-run`: planned; may later preview resume from explicit
  persisted or provided state only.
- `aeos task resume --json`: planned; may emit JSON-only unavailable output
  until persistence and resume safety exist.

See `docs/AGENTIC_TASK_CLI_OUTPUT_CONTRACT.md` for the stable human and JSON
output contracts.

### `aeos task new`
- Purpose: Create a new micro-task from the task contract template.
- Example usage: `aeos task new "Define package architecture"`
- Expected behavior: Generates a task draft with purpose, context, writable
  files, verification, and stop condition.
- Phase: MVP.

### `aeos task run`
- Purpose: Start execution of a specific task through the configured agent.
- Example usage: `aeos task run TASK-0005`
- Expected behavior: Prepares context, selects the agent adapter, enforces
  policy gates, and captures handoff output.
- Phase: MVP.

### `aeos task done`
- Purpose: Mark a task complete after verification succeeds.
- Example usage: `aeos task done TASK-0005`
- Expected behavior: Confirms required files and verification results, updates
  task state, and emits a compact handoff summary.
- Phase: MVP.

## Memory Commands
### `aeos remember`
- Purpose: Write a verified memory entry.
- Example usage: `aeos remember --type decision --from TASK-0005`
- Expected behavior: Creates structured memory only after validation and
  verification evidence are present.
- Phase: MVP.

### `aeos search`
- Purpose: Search project context, tasks, docs, and approved memory sources.
- Example usage: `aeos search "policy gates"`
- Expected behavior: Searches only allowed sources for the current task scope
  and returns references, not broad raw dumps.
- Phase: MVP.

## Planning Commands
### `aeos plan`
- Purpose: Produce a concise implementation or architecture plan.
- Example usage: `aeos plan TASK-0006`
- Expected behavior: Reads the task contract, identifies required context, and
  writes or prints a scoped plan without implementing code.
- Phase: MVP.

### `aeos review`
- Purpose: Review a plan, diff, or task output for risks and gaps.
- Example usage: `aeos review --task TASK-0005`
- Expected behavior: Reports findings first, prioritizing correctness,
  verification gaps, policy violations, and unclear scope.
- Phase: MVP.

## Verification Commands
### `aeos verify`
- Purpose: Run the verification steps declared by a task.
- Example usage: `aeos verify TASK-0005`
- Expected behavior: Executes only allowed checks, records output, and reports
  pass, fail, skipped, or blocked status.
- Phase: MVP.

## Agent Commands
### `aeos agent list`
- Purpose: List configured agent adapters.
- Example usage: `aeos agent list`
- Expected behavior: Shows available agents, capabilities, routing labels, and
  enabled state.
- Phase: MVP.

## Tool / MCP Commands
### `aeos tool list`
- Purpose: List configured tool and MCP adapters.
- Example usage: `aeos tool list`
- Expected behavior: Shows tool names, scopes, approval requirements, and
  availability in the current environment.
- Phase: MVP.

## Policy Commands
### `aeos policy check`
- Purpose: Evaluate a proposed action against AEOS policy rules.
- Example usage: `aeos policy check --action "git push"`
- Expected behavior: Returns allow, deny, or approval-required with the reason
  and related policy source.
- Phase: MVP.

## Audit Commands
### `aeos audit`
- Purpose: Show recorded actions, checks, decisions, and handoff evidence.
- Example usage: `aeos audit --task TASK-0005`
- Expected behavior: Prints a concise audit trail for the selected task or
  project scope.
- Phase: MVP.

## Example Workflows
### New Planning Task
1. `aeos task new "Define package architecture"`
2. `aeos context --task TASK-0006`
3. `aeos plan TASK-0006`
4. `aeos review --task TASK-0006`

### Execute A Scoped Task
1. `aeos status`
2. `aeos context --task TASK-0005`
3. `aeos task run TASK-0005`
4. `aeos verify TASK-0005`
5. `aeos task done TASK-0005`

### Memory After Verification
1. `aeos verify TASK-0005`
2. `aeos remember --type decision --from TASK-0005`
3. `aeos audit --task TASK-0005`

### Tool Safety Check
1. `aeos tool list`
2. `aeos policy check --action "install dependency"`
3. `aeos audit --latest`

## MVP Commands
- `aeos init`
- `aeos project profile`
- `aeos template recommend`
- `aeos status`
- `aeos context`
- `aeos task new`
- `aeos task run`
- `aeos task done`
- `aeos plan`
- `aeos review`
- `aeos remember`
- `aeos search`
- `aeos verify`
- `aeos agent list`
- `aeos tool list`
- `aeos policy check`
- `aeos audit`

## Non-MVP Commands
- `aeos model list`: list model adapters and routing metadata.
- `aeos model route`: explain model routing for a task.
- `aeos task split`: split a large request into micro-tasks.
- `aeos task queue`: manage queued tasks.
- `aeos memory validate`: validate all memory entries.
- `aeos index rebuild`: rebuild future search or vector indexes.
- `aeos tool run`: execute a named tool through policy gates.
- `aeos policy explain`: explain policy sources for a decision.
- `aeos audit export`: export audit trails for external review.
- `aeos config doctor`: validate local AEOS configuration.

## Naming Rules
- Use the `aeos` root command for all operator actions.
- Use nouns for command groups: `task`, `agent`, `tool`, `policy`.
- Use verbs for actions: `new`, `run`, `done`, `list`, `check`.
- Keep command names short and provider-neutral.
- Prefer flags for filters and scope, not new command names.
- Avoid model, vendor, IDE, or host-specific names in core commands.
- Require explicit task IDs when a command changes task state.
- Default output should be concise text; structured output can be added later
  with flags such as `--json`.
