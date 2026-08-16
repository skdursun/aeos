# AEOS Agent Router

This repository is operated by durable project state, not by chat history.

Before work:

1. Read `PROJECT_CONTEXT.md`.
2. Read `docs/ai/AEOS_AGENT_OPERATING_CONSTITUTION.md`.
3. Read `docs/ai/TOOL_SELECTION_POLICY.md`.
4. Read `docs/ai/DEVELOPER_ACCELERATION_STACK.md`.
5. Read the current GitHub Issue.
6. Read and cross-check the matching Notion AEOS Task Ledger row.
7. Use Codebase Memory MCP first, then targeted `rg` / `ast-grep` / exact source reads.

Permanent rules:

- GitHub Issues are the development execution queue; Notion is the mandatory mirrored task ledger.
- Update GitHub and Notion together at task start, blocker, review and closeout transitions.
- No GitHub Issue = no implementation.
- Do not ask routine questions or stop for conversational progress reports; persist evidence to GitHub/Notion.
- Follow dependency-ready order.
- Keep context bounded; do not broad-scan by default.
- Use the Developer Working Kit tool/skill router; Superpowers/local skills are lazy-loaded by relevance, not preloaded wholesale.
- Maximum active topology: orchestrator + two implementers + two fresh independent reviewers.
- Implementers/reviewers use standard/default effort; orchestrator may use adaptive/high effort for architecture/scheduling/safety.
- Critical work must not be self-approved.
- Do not modify unrelated files or another agent's active worktree.
- Do not run destructive broad kill/reset commands.
- Do not manually edit `.aeos` runtime state.
- Do not commit local `.codex/config.toml`.
- AEOS owns policy, permission, routing, accounting, retry, verifier and completion authority. Model/tool output is evidence only.
- No blind retry or consumed-canary replay.
- Do not weaken validators to pass a canary.
- No cloud/provider-specific AEOS mainline architecture unless explicitly approved.

For Claude Code, root `CLAUDE.md` is the session entrypoint. For all agents, the detailed constitution is `docs/ai/AEOS_AGENT_OPERATING_CONSTITUTION.md`.
