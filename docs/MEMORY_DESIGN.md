# Memory Design

## Memory Layers

### Active Memory

Short-lived context for the current task or session. It is not automatically stored.

### Project Memory

Durable knowledge for Pro Performans and AEOS. Stored in `brain/` as structured Markdown entries.

### Global Engineering Memory

Reusable engineering patterns, lessons, prompts, and research that may apply across projects. This layer is optional and must be filtered before use.

## Format

Memory entries use Markdown with YAML frontmatter.

```markdown
---
type: decision
title: Example Decision
date: 2026-07-30
source_task: TASK-ID
status: verified
tags:
  - architecture
---

# Example Decision

Decision summary.

## Context

Why this matters.

## Use When

When to retrieve this memory.
```

## Memory Types

- bug
- decision
- pattern
- incident
- lesson
- prompt
- benchmark
- research
- postmortem

## Retrieval Flow

```text
Task intent
  |
  v
Create retrieval query
  |
  v
Search active memory
  |
  v
Search project memory
  |
  v
Optionally search global engineering memory
  |
  v
Rank and load only relevant entries
```

## Rules

- Do not dump raw conversations into memory.
- Do not store secrets, tokens, credentials, or private environment values.
- Do not write memory from unverified claims.
- Prefer short entries with clear retrieval tags.
- Include source task IDs when possible.
- Update or supersede conflicting memory instead of duplicating it.

## Example Memory Entry

```markdown
---
type: pattern
title: One Codex Session Per Micro Task
date: 2026-07-30
source_task: BOOTSTRAP-CLI-0001
status: verified
tags:
  - codex
  - workflow
  - context
---

# One Codex Session Per Micro Task

Codex sessions should receive one small task with explicit files to load, files to modify, verification steps, and a stop condition.

## Use When

Use this pattern when preparing future AEOS repository work.
```
