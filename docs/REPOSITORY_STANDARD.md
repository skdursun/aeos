# Repository Standard

## Purpose

This repository standard keeps AEOS work small, explicit, reviewable, and safe for AI-assisted engineering.

## Repository Principles

- Markdown and Git are the initial source of truth.
- Tasks are scoped as micro-tasks.
- Context loading is lazy and explicit.
- Verification is required before completion.
- Unrelated files are not modified.
- Dependencies are not added without request.

## Root Files

- `README.md`: project overview.
- `PROJECT_CONTEXT.md`: current project context and priorities.
- `AGENTS.md`: operating rules for Codex and agents.

## docs/ Directory

Contains durable architecture, policy, roadmap, and design documents. Do not load every file by default.

## TASKS/ Directory

Contains task templates, backlog items, active task definitions, and completed task markers.

## brain/ Directory

Contains structured memory entries grouped by type. Do not open by default.

## templates/ Directory

Contains reusable project or workflow templates. Do not open by default.

## Future apps/ Directory

Reserved for future application implementations. Do not create until explicitly requested.

## Future packages/ Directory

Reserved for future shared packages. Do not create until explicitly requested.

## File Naming Rules

- Use clear lowercase names for directories.
- Use uppercase names only for established root docs such as `README.md`, `AGENTS.md`, and `PROJECT_CONTEXT.md`.
- Use hyphenated filenames for task and template files.
- Prefer descriptive Markdown filenames.

## Markdown Rules

- Keep docs concise and structured.
- Use headings for durable sections.
- Avoid raw conversation dumps.
- Prefer decision logs for architectural choices.
- Keep examples short and reusable.

## Context Loading Rules

- Read `PROJECT_CONTEXT.md` first.
- Read `AGENTS.md` for agent rules.
- Load only files explicitly named in the task.
- Do not scan the whole repository unless the task requires it.

## Codex CLI Session Rules

- One session per micro-task.
- Modify only listed files.
- Verify before handoff.
- Do not deploy.
- Do not push to Git.
- Stop after the task.

## What Not To Do

- Do not initialize frameworks without a task.
- Do not install dependencies without a task.
- Do not rename files without a task.
- Do not delete files without approval.
- Do not write application code during planning-only tasks.
- Do not broaden scope during a session.
