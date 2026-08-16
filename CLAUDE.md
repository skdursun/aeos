# AEOS Claude Session Router

This file is mandatory for every Claude Code session opened in this repository.

Do not rely on previous chat history. Reconstruct from durable project state.

## Mandatory read order

Before implementation, read:

1. `PROJECT_CONTEXT.md`
2. `docs/ai/AEOS_AGENT_OPERATING_CONSTITUTION.md`
3. `docs/ai/TOOL_SELECTION_POLICY.md`
4. `docs/ai/DEVELOPER_ACCELERATION_STACK.md`
5. `docs/ai/AEOS_CANONICAL_PROJECT_MEMORY.md`
6. `docs/roadmaps/PRODUCT_READY_TASK_INDEX.md`
7. current `ops/handoffs/*` relevant to the active task
8. current GitHub Issue
9. matching Notion AEOS Task Ledger row with the same Task ID

Then use Codebase Memory MCP FIRST for repository/domain discovery.

## Permanent operating rules

- GitHub Issues are the canonical development execution queue.
- Notion Task Ledger is mandatory cross-check/mirror; update GitHub and Notion together at every task lifecycle transition.
- No GitHub Issue = no product implementation.
- Never ask routine questions.
- Do not stop to give user-facing progress reports. Persist progress/evidence to GitHub + Notion instead.
- If an external dependency is genuinely unavailable, mirror `BLOCKED/WAITING_EXTERNAL` to both ledgers and continue another dependency-ready task without asking the user.
- Do not stop merely because context grows. Use bounded context, subagent rotation, durable checkpoints and session reconstruction.

## Multi-agent topology

Maximum total topology: Primary Orchestrator + 4 subagents.

- IMPLEMENTER-A — standard/default effort
- IMPLEMENTER-B — standard/default effort
- REVIEWER-A — standard/default effort
- REVIEWER-B — standard/default effort

**HARD, NON-OVERRIDABLE RULE:** every subagent runs on **Claude Sonnet 4.6** (`claude-sonnet-4-6`), with no exceptions — including P0/critical reviewer gates. No agent, document, skill or workflow may override this.

Enforced by an admin-tier managed settings file that outranks user/project/local settings — `/Library/Application Support/ClaudeCode/managed-settings.json` (root-owned):

- `env.CLAUDE_CODE_SUBAGENT_MODEL: "claude-sonnet-4-6"` — every subagent, agent team and workflow agent. Highest entry in the subagent-model precedence chain: it outranks both the per-invocation Agent `model` parameter and any agent-definition `model:` frontmatter.
- `env.ANTHROPIC_DEFAULT_SONNET_MODEL: "claude-sonnet-4-6"` — pins what the bare `sonnet` alias resolves to.
- `model: "opus[1m]"` — pins the **Primary Orchestrator**, and beats any `model` set in `~/.claude/settings.json`.

So the enforced split is: orchestrator on `opus[1m]`, all subagents on `claude-sonnet-4-6`. Do not edit or work around the managed file — only the machine administrator can change it. Model and effort are separate axes; the pin fixes the model, not the reasoning effort.

See `docs/ai/AEOS_AGENT_OPERATING_CONSTITUTION.md` → "Model rule" for the recorded conflict between this and the global `~/.claude/CLAUDE.md` model-policy block.

Primary Orchestrator coordinates only and normally does not write product code. It may use higher/adaptive reasoning for architecture, dependency scheduling, safety and conflict resolution.

Implementers use bounded task contexts and non-overlapping write scopes. Reviewers use fresh independent contexts. P0/critical work requires both reviewers to return `REVIEW PASS` before closeout.

## Tool/skill rule

Always apply `docs/ai/TOOL_SELECTION_POLICY.md`.

Core router:

- GitHub task read/update — mandatory
- Notion task read/update — mandatory
- Codebase Memory MCP — first repo/domain discovery
- Superpowers/local skills — relevance check every task, lazy-load relevant skill only
- RTK — high-output command reduction
- `rg` — literal search
- `ast-grep` — structural search/refactor
- Context7 — official docs on demand
- Repomix — bounded packaging/handoff on demand
- Scrapling — web research on demand
- mise — runtime/tool/task reproducibility
- Knip — report-only TS/JS dead-code/dependency analysis
- Trivy — security/SBOM baseline when relevant
- Gitleaks — cheap secret gate when relevant
- Lefthook — only when enabled/proven useful
- Turborepo — only when benchmark-enabled
- Renovate — conservative maintenance only
- Maestro — only when a supported web/mobile user-flow surface makes it applicable

Do not preload every MCP/skill. Do not add a new MCP/skill without explicit user approval.

## AEOS invariants

- AEOS is authority; model/tool/worker output is evidence only.
- Expected=400, Accounted=20 => Remaining=380 even if a model says complete.
- No blind retry.
- `outcome_unknown` requires reconciliation.
- Consumed one-shot authority is never reset.
- Historical canaries are never replayed.
- No model self-routing/self-approval/self-completion.
- No manual `.aeos` edits.
- Do not commit local `.codex/config.toml`.
- Do not weaken validators to pass a test/canary.
- No AWS/Bedrock/S3/IAM/Cloudflare/Azure/GCP mainline architecture unless explicitly approved.
- Codex remains GPT-5.5 unless explicitly changed by the user.

## Current queue rule

Use GitHub dependency order and validate every selected task against Notion before dispatch.

At the time this router was created, TASK-0324 remains the required engineering closeout before TASK-0325. Do not trust this sentence forever; current GitHub + Notion state wins.

## Closeout loop

For each task:

`GITHUB ISSUE → NOTION CROSS-CHECK → DEPENDENCIES → CBM-FIRST DISCOVERY → SKILL ROUTER → TWO IMPLEMENTERS AS SAFE → TARGETED TESTS → TWO FRESH REVIEWERS → FIX/RE-REVIEW → COMMIT/PUSH → GITHUB UPDATE → NOTION UPDATE → NEXT READY TASK`

Never pause for a routine conversational report between tasks.
