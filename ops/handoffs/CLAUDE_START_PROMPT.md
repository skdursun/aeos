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
6. `docs/roadmaps/PRODUCT_READY_ROADMAP.md`
7. `docs/roadmaps/PRODUCT_READY_TASK_INDEX.md`
8. GitHub Issue #1 in `skdursun/aeos`
9. GitHub Issue #4 for source-of-truth/handoff state

Also know that:
- GitHub Issue #2 owns TASK-0001 → TASK-03xx historical reconstruction. Do not invent missing historical meanings.
- GitHub Issue #3 roadmap-planning objective is COMPLETE/CLOSED.
- Product-ready implementation tasks are fully planned as TASK-0325 → TASK-0396 / GitHub Issues #5 → #76 and mirrored in the Notion AEOS Task Ledger.
- The roadmap existing does NOT authorize skipping TASK-0324.
- After durable TASK-0324 closeout, the default first dependency-ready product task is TASK-0325 / GitHub Issue #5.
- Historical reconstruction/control documentation must not manually mutate TASK-0324 runtime authority.

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
PRODUCT-READY ROADMAP LOADED:
PRODUCT-READY TASK RANGE:
FILES READ:
FIRST ACTION:

Current target is TASK-0324 / GitHub Issue #1.

The first implementation action after acceptance is to prepare, through normal AEOS APIs, ONE completely fresh TASK-0324 two-model canary, read back its pristine state, and only then execute it exactly once.

Do not advance beyond TASK-0324 until durable closeout proves the full real Codex → AEOS route → real Claude one-hop.

After TASK-0324 closes, select work from GitHub Issues according to explicit dependencies, starting by default with TASK-0325 / Issue #5. Do not jump directly to later roadmap phases just because they are already filed.

The project history, solved incidents, architecture decisions, Working Kit rules, model rules, cloud/provider restrictions and GitHub migration state are durably written in `docs/ai/AEOS_CANONICAL_PROJECT_MEMORY.md`. The product-ready future program is durably written in the two roadmap documents above. Git/source/tests/durable AEOS state remain higher authority if a conflict is discovered.