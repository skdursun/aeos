# Memory Schema

## Purpose
Define how AEOS memory entries are written, stored, searched, and reused.
Entries are durable Markdown records for knowledge that should survive stateless
Codex sessions. They must be concise, verified, searchable, and cheap to inject.

## Storage Location
Project memory entries live under `brain/`. Group by type when directories
exist, such as:
```text
brain/bugs/ brain/decisions/ brain/patterns/ brain/incidents/
brain/lessons/ brain/prompts/ brain/benchmarks/ brain/research/
brain/postmortems/
```
Do not store memory outside `brain/`.

## Memory Types
Use exactly one `type`:
- `bug`: verified defect, cause, fix, or prevention note.
- `decision`: durable project, architecture, process, or product choice.
- `pattern`: reusable implementation, workflow, or design pattern.
- `incident`: notable failure event and handling.
- `lesson`: concise takeaway from completed work.
- `prompt`: reusable prompt or prompt structure.
- `benchmark`: measured comparison, result, or performance note.
- `research`: sourced findings for future work.
- `postmortem`: review after an incident or failed task.
Choose the type that best matches future search intent.

## Required Frontmatter Fields
Every entry must start with YAML frontmatter:
```yaml
---
type: decision
title: Short Human-Readable Title
date: 2026-07-30
source_task: TASK-0003
status: verified
tags:
  - memory
  - schema
---
```
Required fields:
- `type`: one allowed memory type.
- `title`: short plain-language title.
- `date`: ISO date, `YYYY-MM-DD`.
- `source_task`: originating task ID, or `unknown` only when unavailable.
- `status`: `draft`, `verified`, `superseded`, or `archived`.
- `tags`: 2 to 6 lowercase retrieval tags.
Use `verified` only for completed work, inspected files, cited sources, or
explicit project decisions.

## Optional Frontmatter Fields
Use optional fields only when they improve retrieval or safe reuse:
```yaml
supersedes: 2026-07-28-decision-old-memory-rule.md
superseded_by: 2026-07-30-decision-new-memory-rule.md
related:
  - docs/MEMORY_DESIGN.md
owner: aeos
scope: project
confidence: high
expires: 2026-12-31
```
- `supersedes`: older memory replaced by this entry.
- `superseded_by`: newer memory replacing this entry.
- `related`: connected docs, files, or memory entries.
- `owner`: responsible project area, team, or subsystem.
- `scope`: `project`, `global`, or a subsystem name.
- `confidence`: `low`, `medium`, or `high`.
- `expires`: ISO review date.

## Body Format
Use this default body:
```markdown
# Short Human-Readable Title
One to three sentences stating the reusable point.

## Context
Why this memory exists.

## Use When
When a future agent should retrieve it.

## Reuse Guidance
How to apply it without loading excess context.
```
Keep sections short. Do not include raw transcripts, long logs, large code
blocks, or exhaustive task history.

## Naming Rules
Use `YYYY-MM-DD-type-short-slug.md`.
Examples:
```text
2026-07-30-decision-memory-schema.md
2026-07-30-pattern-small-context-tasks.md
2026-07-30-bug-stale-retrieval-tags.md
```
Rules: lowercase letters, numbers, and hyphens only; include date, type, and a
short slug; keep names stable; do not rename unless explicitly requested.

## Tagging Rules
Tags are retrieval hooks. Use 2 to 6 lowercase, short, specific terms likely to
appear in future task language. Prefer domain, subsystem, tool, behavior, or
failure-mode terms.
Avoid `misc`, `important`, `general`, `notes`, and `update`.
Prefer terms like `memory`, `retrieval`, `codex`, `task-contract`,
`repository`, and `verification`.

## Search Optimization Rules
Each entry should answer:
- What is this about?
- When should it be used?
- What should the agent do with it?
Rules: put strong keywords in `title`, `tags`, and the first paragraph; include
`AEOS` when relevant; include file paths only when central to reuse; include
source task IDs; state constraints explicitly; mention alternate search terms
when useful. Do not rely on hidden conversation context.

## Token Efficiency Rules
Memory should reduce context load.
Rules: keep most entries under 500 words; prefer one durable entry over
near-duplicates; summarize decisions instead of debate history; store only
reusable facts, constraints, and guidance; link related docs instead of copying
them; mark outdated entries as `superseded`.

## Do Not Store Rules
Never store secrets, tokens, credentials, private environment values, raw user
conversations, unverified claims, sensitive personal data, temporary scratch
notes, unsummarized logs, drifting code snippets, or restricted source material.
Create memory only when the information is likely to be reused.

## Example: Bug Entry
```markdown
---
type: bug
title: Retrieval Miss Caused By Vague Memory Tags
date: 2026-07-30
source_task: TASK-0003
status: verified
tags:
  - memory
  - retrieval
  - tags
---

# Retrieval Miss Caused By Vague Memory Tags
Vague tags such as `notes` or `general` make memory entries harder to find.
## Context
AEOS memory depends on low-token search before context injection.
## Use When
Use when reviewing memory entries.
## Reuse Guidance
Replace vague tags with domain, subsystem, behavior, or failure-mode terms.
```

## Example: Decision Entry
```markdown
---
type: decision
title: Project Memory Uses Markdown With YAML Frontmatter
date: 2026-07-30
source_task: TASK-0003
status: verified
tags:
  - memory
  - markdown
  - frontmatter
---

# Project Memory Uses Markdown With YAML Frontmatter
AEOS project memory entries are Markdown files with YAML frontmatter stored
under `brain/`.
## Context
This keeps memory readable, searchable, and cheap to inject.
## Use When
Use when creating templates, validators, or retrieval flows.
## Reuse Guidance
Preserve required frontmatter and keep body text concise.
```

## Example: Pattern Entry
```markdown
---
type: pattern
title: Write Memory For Future Retrieval
date: 2026-07-30
source_task: TASK-0003
status: verified
tags:
  - memory
  - retrieval
  - context
---

# Write Memory For Future Retrieval
Memory entries should be written around future search intent.
## Context
Agents search memory before loading context.
## Use When
Use when writing or reviewing any AEOS memory entry.
## Reuse Guidance
Start with the conclusion and make `Use When` explicit.
```

## Validation Checklist
- File is under `brain/` and filename follows
  `YYYY-MM-DD-type-short-slug.md`.
- Frontmatter is valid YAML with allowed `type`, ISO `date`, present
  `source_task`, accurate `status`, and specific lowercase tags.
- First paragraph states the reusable point.
- `Use When` explains retrieval intent.
- No secrets, private values, or raw conversation transcripts are included.
- Conflicting memory is superseded instead of duplicated.
- Entry is short enough for low-token context injection.
