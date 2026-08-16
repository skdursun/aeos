# Claude Temporary-Primary Start Protocol

You are taking over AEOS / Pro Performans as the TEMPORARY PRIMARY EXECUTION ORCHESTRATOR because Codex quota is nearly exhausted.

Do not ask routine questions.

FIRST ACTION IS READ-ONLY HANDOFF ACCEPTANCE.

You MUST reconstruct project state from durable repository/GitHub artifacts. Do not rely on previous chat history.

Read, in this exact order:
1. `AGENTS.md`
2. `PROJECT_CONTEXT.md`
3. `docs/ai/AEOS_CANONICAL_PROJECT_MEMORY.md`
4. `docs/ai/DEVELOPER_ACCELERATION_STACK.md`
5. `ops/handoffs/codex-to-claude-handoff.md`
6. GitHub Issue #1 in `skdursun/aeos`
7. GitHub Issue #4 for source-of-truth/handoff state

Also know that:
- GitHub Issue #2 owns TASK-0001 → TASK-03xx historical reconstruction.
- GitHub Issue #3 owns the complete product-ready roadmap.
- Historical reconstruction and roadmap work may proceed as control/documentation work, but must not manually mutate TASK-0324 runtime authority.

Then use Codebase Memory MCP FIRST for repository/domain discovery.

Do not broad-scan the repository.
Do not manually edit `.aeos` runtime state.
Do not modify local `.codex/config.toml`.
Do not replay any historical consumed TASK-0324 invocation/canary.
Do not change AEOS authority, model-agnostic architecture, provider boundaries, permission/policy/audit contracts, or completion semantics.
Do not add AWS/Bedrock/S3/IAM/Cloudflare/Azure/GCP mainline infrastructure.
Do not invent missing historical task meanings; use Issue #2 evidence classifications instead.

You may coordinate development, implement, test, review, use isolated branches/worktrees, update GitHub state, and maintain canonical handoff artifacts.

For critical work:
- use fresh implementer context
- use separate fresh reviewer context
- reviewer result must be `REVIEW PASS`, `CHANGES_REQUIRED`, or `BLOCKED`

Before implementation return exactly:

HANDOFF LOADED:
REPO:
MAIN/BASE SHA:
HEAD SHA:
BRANCH/WORKTREE:
DIRTY STATE:
CURRENT TASK:
CURRENT LIFECYCLE:
NEXT READY TASK:
BLOCKERS:
WAITING_EXTERNAL:
TOOLING STATUS:
AEOS INVARIANTS LOADED:
CANONICAL PROJECT MEMORY LOADED:
HISTORICAL RECONSTRUCTION ISSUE:
PRODUCT-READY ROADMAP ISSUE:
FILES READ:
FIRST ACTION:

Current target is TASK-0324 / GitHub Issue #1.

The first implementation action after acceptance is to prepare, through normal AEOS APIs, ONE completely fresh TASK-0324 two-model canary, read back its pristine state, and only then execute it exactly once.

Do not advance beyond TASK-0324 until durable closeout proves the full real Codex → AEOS route → real Claude one-hop.

The project history, previously solved incidents, architecture decisions, Working Kit rules, model rules, cloud/provider restrictions, GitHub migration state, and current next action are already durably written in `docs/ai/AEOS_CANONICAL_PROJECT_MEMORY.md`. Treat that file as required handoff context, while Git/source/tests/durable AEOS state remain higher authority if a conflict is discovered.
