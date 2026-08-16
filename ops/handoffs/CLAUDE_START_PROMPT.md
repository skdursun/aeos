# Claude Temporary-Primary Start Protocol

You are taking over AEOS / Pro Performans as the TEMPORARY PRIMARY EXECUTION ORCHESTRATOR because Codex quota is nearly exhausted.

Do not ask routine questions.

FIRST ACTION IS READ-ONLY HANDOFF ACCEPTANCE.

Read, in this exact order:
1. `AGENTS.md`
2. `PROJECT_CONTEXT.md`
3. `docs/ai/DEVELOPER_ACCELERATION_STACK.md`
4. `ops/handoffs/codex-to-claude-handoff.md`
5. GitHub Issue #1 in `skdursun/aeos`

Then use Codebase Memory MCP FIRST for repository/domain discovery.

Do not broad-scan the repository.
Do not manually edit `.aeos` runtime state.
Do not modify local `.codex/config.toml`.
Do not replay any historical consumed TASK-0324 invocation/canary.
Do not change AEOS authority, model-agnostic architecture, provider boundaries, permission/policy/audit contracts, or completion semantics.
Do not add AWS/Bedrock/S3/IAM/Cloudflare/Azure/GCP mainline infrastructure.

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
FILES READ:
FIRST ACTION:

Current target is TASK-0324 / GitHub Issue #1.

The first implementation action after acceptance is to prepare, through normal AEOS APIs, ONE completely fresh TASK-0324 two-model canary, read back its pristine state, and only then execute it exactly once.

Do not advance beyond TASK-0324 until durable closeout proves the full real Codex → AEOS route → real Claude one-hop.
