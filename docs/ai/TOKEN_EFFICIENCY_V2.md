# AEOS Token Efficiency v2

Status: canonical operating policy for Claude/Orca context efficiency.

## Principle
Durable state is memory. Model context is only the current task.

## Startup
- `CLAUDE.md` must remain a compact router.
- Do not preload all AEOS constitutions, roadmap indexes, MCP schemas, Superpowers skills or full Orca `agent-context --json`.
- Read only the current GitHub Issue, the matching Notion task row, a compact handoff/status snapshot, and the exact policy section required by the task.
- Use progressive disclosure for `docs/ai/*`.

## Coordinator
- Use GitHub dependency deltas and compact durable status; do not poll the full issue set/Notion ledger/Watch Tower every cycle.
- Notion is mandatory mirror/cross-check at task start and terminal lifecycle transitions, not continuous execution memory.
- Keep orchestration receipts and worker output bounded.

## Repository intelligence
Codebase Memory MCP remains preferred for discovery, but repeated rediscovery is forbidden. Coordinator may hand off relevant files/symbols/risks. Implementer or reviewer queries again only when the handoff is insufficient/stale.

## Skills/tools
Load only the relevant skill/tool. Do not automatically chain brainstorming -> planning -> subagent development -> branch finishing for routine work. High-output tools must use bounded output/RTK where appropriate.

## Rotation
Do not intentionally grow primary orchestration toward a 1M context. Soft rotate around 80k–120k effective context and hard rotate around 150k or earlier on drift/repetition. Persist active issue/task, canonical base, branch/worktree, HEAD, tests, review, integration state, blockers and next deterministic action.

## Worker context
Workers receive only role, task/acceptance, authority constraints, dependencies, relevant files/symbols, write/forbidden surfaces, targeted tests and output contract. Never pass the entire product-ready roadmap or coordinator transcript.

## Completion
GitHub state -> exact Notion row -> canonical integration evidence -> compact handoff/status delta -> worker release/reuse -> next dependency-ready task.

AEOS authority/completion/policy invariants remain unchanged; token efficiency must never weaken safety or evidence gates.
