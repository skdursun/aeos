# AEOS — Claude Session Router

This file is mandatory for Claude sessions in AEOS. It is a compact router, not project memory.

## Authority
- GitHub Issues = canonical execution queue.
- Notion AEOS Task Ledger = mandatory lifecycle mirror/cross-check.
- Repository = technical state/evidence.
- AEOS owns completion/policy/permission/retry authority; model output is evidence only.
- No GitHub Issue = no product implementation.

## Minimal read order
1. current GitHub Issue + dependency/acceptance state;
2. matching Notion task row;
3. compact current handoff/status;
4. `docs/ai/TOKEN_EFFICIENCY_V2.md`;
5. only the exact constitution/policy section required by the current task.

Do **not** preload all `docs/ai/*`, the full product-ready roadmap, full Orca `agent-context --json`, every MCP schema, every Superpowers skill, complete Watch Tower state, or historical task evidence.

## Model / topology
- Primary Orchestrator: **Claude Sonnet 4.6**. Do not use `opus[1m]` as the default coordinator.
- Implementers/reviewers: **Claude Sonnet 4.6** unless the user explicitly changes policy.
- Maximum topology remains Primary Orchestrator + 4 subagents (2 implementers + 2 reviewers), but spawn only the workers actually required.
- Primary orchestrator coordinates and normally does not write product code.
- P0/critical authority-boundary changes require fresh independent review; reviewer context is bounded to Issue + diff + tests + required evidence.

The macOS managed/user Claude settings must be migrated to match this policy; no repository session should attempt to work around administrator-managed settings. If local managed settings still force Opus/1M, report `MODEL_POLICY_MIGRATION_REQUIRED` and pause new dispatch until the separate machine migration updates them.

## Context / token discipline
- Durable state is memory; model context is current-task workspace only.
- Normal coordinator loops use deltas, not full GitHub/Notion/Watch Tower snapshots.
- Notion is checked at task start and meaningful/terminal lifecycle transitions, not every orchestration loop.
- Codebase Memory is preferred when discovery is needed, not mandatory rediscovery by coordinator + implementer + reviewer.
- Reuse compact relevant-file/symbol/authority-risk handoffs.
- Load Superpowers/local skills progressively; no automatic brainstorming -> planning -> subagent-development -> branch-finishing chain for routine work.
- Hooks must emit the smallest deterministic safety signal and must not echo large state into context.
- Soft rotate a long-lived coordinator around 80k–120k effective context; hard rotate around 150k or earlier on repetition/drift. Never intentionally grow toward 1M.
- Before rotation persist active Issue/Task, canonical base, branch/worktree, HEAD, tests, review, integration state, blockers, Orca identifiers and next deterministic action.

## Tool routing
Use the cheapest deterministic tool that answers the current need: GitHub/Notion exact task access; Codebase Memory for discovery; `rg` literal; `ast-grep` structural; RTK for noisy output; Context7/Repomix/Scrapling/mise/Knip/Trivy/Gitleaks/Lefthook/Turborepo/Renovate/Maestro only when relevant. Do not preload every MCP/skill or add new tooling without explicit approval.

## AEOS invariants
- Expected=400, Accounted=20 => Remaining=380 even if a model says complete.
- No blind retry; `outcome_unknown` requires reconciliation.
- Consumed one-shot authority is never reset; historical canaries are never replayed.
- No model self-routing/self-approval/self-completion.
- No manual `.aeos` edits; do not commit local `.codex/config.toml`.
- Do not weaken validators to pass tests/canaries.
- No AWS/Bedrock/S3/IAM/Cloudflare/Azure/GCP mainline architecture unless explicitly approved.
- Codex remains GPT-5.5 unless explicitly changed by the user.

## Critical defect precedence
A real P0/release-blocking P1 on concurrency, locking, idempotency, invocation identity, durable state, persistence, revision guards, state machines, completion/accounting authority, retry/recovery, policy/permission, security or audit/provenance stops dependent roadmap progression. Open/reuse the defect Issue, mirror it in Notion, implement/test/review/integrate before dependent closeout. Never downgrade severity to keep moving.

## Canonical integration checkpoint
Default branch is currently `master`; verify remote state at session start. IMPLEMENTED != INTEGRATED. A task is complete only when its final reviewed commit is reachable from the canonical default branch. If previously-completed critical commits are ahead of `origin/master`, emit `INTEGRATION_REQUIRED` and do not dispatch the next critical task.

Minimum bounded preflight when relevant:
`git fetch origin` -> `git rev-list --left-right --count origin/master...HEAD` -> `git log --oneline origin/master..HEAD`.

## Closeout
GitHub Issue -> exact Notion cross-check -> dependency check -> bounded discovery -> implement -> targeted tests -> required independent review -> canonical integration proof -> GitHub complete -> Notion complete -> compact handoff/status delta -> next dependency-ready task.
