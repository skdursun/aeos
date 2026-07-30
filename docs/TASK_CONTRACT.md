# AEOS Task Contract

## Purpose

The AEOS task contract defines how ChatGPT hands off one small, isolated unit of repository work to a fresh Codex CLI session.

It optimizes for minimum context, explicit file boundaries, safe execution, easy verification, and compact handoff reports.

## Core Rule: One Task = One Fresh Codex CLI Session

Each task starts in a fresh Codex CLI session.

The session must:

- Load only the listed context files.
- Modify only the listed files.
- Run only the listed verification.
- Stop after the task is complete.
- Return the required handoff report.

Do not continue into the next task in the same session unless the task explicitly allows it.

## Task Contract Fields

Every task should be copy-paste ready and include clear boundaries for context, files, steps, verification, and stopping.

## Required Fields

- `TASK-ID`: Stable task identifier.
- `TITLE`: Short task name.
- `PURPOSE`: Why the task exists.
- `CONTEXT TO LOAD`: Exact files Codex may read.
- `DO NOT LOAD`: Files, folders, or patterns Codex must avoid.
- `FILES TO MODIFY`: Exact files Codex may create or edit.
- `FILES NOT TO TOUCH`: Files, folders, or patterns Codex must not edit.
- `STEPS`: Ordered work instructions.
- `VERIFY`: Required checks before completion.
- `STOP CONDITION`: Exact point where Codex must stop.
- `FINAL RESPONSE`: Required handoff report format.

## Optional Fields

- `ASSUMPTIONS`: Known constraints Codex should preserve.
- `ALLOWED OPERATIONS`: Commands or actions allowed for this task.
- `FORBIDDEN OPERATIONS`: Extra task-specific bans.
- `ESCALATION`: When Codex must stop and ask.
- `OUT OF SCOPE`: Work that belongs in another task.

## Context Loading Rules

- Read `PROJECT_CONTEXT.md` first.
- Read `AGENTS.md` when listed.
- Load only files named in `CONTEXT TO LOAD`.
- Do not read all Markdown files.
- Do not scan the full repository unless explicitly required.
- Do not open `brain/` or `templates/` unless exact files are listed.
- Do not use unrelated docs to fill gaps.

## File Boundary Rules

- Create or edit only files listed under `FILES TO MODIFY`.
- Do not modify files listed under `FILES NOT TO TOUCH`.
- Do not rename, move, delete, or reformat unrelated files.
- If a required change needs an unlisted file, stop and report the blocker.
- Treat generated files as modifications unless explicitly allowed.

## Allowed Operations

Allowed operations should be narrow and task-specific.

Common allowed operations:

- Read listed context files.
- Create or edit listed files.
- Run verification commands listed in `VERIFY`.
- Run `git status --short` when requested.

## Forbidden Operations

Unless explicitly requested, Codex must not:

- Install dependencies.
- Initialize frameworks.
- Implement application code during planning tasks.
- Deploy.
- Push to Git.
- Run destructive commands.
- Delete files.
- Rename files.
- Modify unrelated files.
- Open excluded folders or docs.
- Continue into the next task.

## Verification Rules

Verification must be explicit and proportional to the task.

- Documentation-only tasks should verify file existence, relevant content, and `git status --short`.
- Code tasks should include targeted tests, linting, type checks, or build checks when available.
- Do not invent broad verification that requires extra context or dependencies.
- If a verification step cannot run, report why.

## Stop Conditions

Codex must stop when:

- The requested files are created or updated.
- Listed verification is complete or clearly blocked.
- The handoff report is ready.

Codex must not start another task, broaden scope, or perform cleanup outside the listed files.

## Handoff Report Format

Use this compact format:

```text
Task ID:
Status:
Workspace Path:
Files Created:
Files Modified:
Summary:
Verification Run:
Verification Result:
Problems:
Next Suggested Task:
Context Update Snippet:
```

## Context Update Snippet Rules

The snippet should be short enough to paste into `PROJECT_CONTEXT.md` or the next task.

It should include:

- Completed task ID and result.
- New or updated relevant docs.
- Recommended next task.
- Any blocker or follow-up that affects the next session.

Do not include raw command logs, long summaries, or unrelated details.

## Bad Task Examples

Bad tasks are broad, ambiguous, or unsafe:

- "Read the repo and improve the architecture."
- "Implement the whole memory system."
- "Update docs as needed."
- "Fix all lint errors."
- "Install whatever dependencies are useful."

## Good Task Examples

Good tasks are small, explicit, and verifiable:

- "Create `docs/TASK_CONTRACT.md` using only the listed context files."
- "Update `TASKS/task-template.md` to include the final handoff fields."
- "Add a memory entry schema to `docs/MEMORY_SCHEMA.md`; do not implement code."
- "Modify only `src/router.ts` and run `npm test -- router`."

## Escalation Rules

Codex must stop and report when:

- Required context is missing.
- The task requires an unlisted file.
- The requested change conflicts with repository rules.
- Verification fails for reasons unrelated to the requested change.
- A risky operation is needed, such as dependency changes, deletion, deployment, migration, or Git push.

## When To Start A New Session

Start a new session when:

- Moving to the next task ID.
- The task scope changes.
- New files need to be loaded beyond the contract.
- The work changes from planning to implementation.
- Verification reveals a separate follow-up task.

## When Same Session Is Allowed

The same session may continue only when:

- The work remains within the same task ID.
- No new unlisted files are needed.
- The same file boundaries still apply.
- The task explicitly asks for iteration after verification.
