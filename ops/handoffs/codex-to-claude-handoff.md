# AEOS Codex → Claude Handoff

## Authority mode

AEOS remains authoritative.

Claude Code is TEMPORARY PRIMARY EXECUTION ORCHESTRATOR because Codex quota is close to exhaustion. This is not a permanent architecture change.

Long-term target remains:

AEOS authority → Codex planner/orchestrator → AEOS route validation → Claude/future worker → AEOS evidence/verifier/completion.

## Source of truth

Read in this order:
1. Git repository / commit history
2. GitHub active Issue
3. `PROJECT_CONTEXT.md`
4. `docs/ai/AEOS_CANONICAL_PROJECT_MEMORY.md`
5. `ops/handoffs/codex-to-claude-handoff.md`
6. `AGENTS.md`
7. `docs/ai/DEVELOPER_ACCELERATION_STACK.md`
8. relevant task/evidence files
9. CBM targeted repository intelligence

Previous chat/thread history is not required authority.

`docs/ai/AEOS_CANONICAL_PROJECT_MEMORY.md` is the durable explanation of the project purpose, scope, architectural invariants, early planning, main task/milestone history, worker-runtime evolution, TASK-0324 incident/fix history, Developer Working Kit policy, GitHub migration state, and current next action. Claude MUST read it before implementation.

## Repository checkpoint

- Repository: `skdursun/aeos`
- Branch: `master`
- Migration checkpoint commit: `63d5c5900c3b78db1f57cb52e742e70a72d01bc3`
- Local-only runtime state: `.aeos/` excluded from Git
- Local Codex project config: `.codex/config.toml` intentionally not included in migration checkpoint

## Current active issue

GitHub Issue #1 — `[TASK-0324] Real Codex planner → AEOS route → real Claude read-only one-hop closeout`

## Current lifecycle

TASK-0324 remains IN PROGRESS.

Historical/consumed TASK-0324 canaries must never be replayed.

Latest normal-host diagnostics showed:
- Codex auth/config/runtime healthy
- provider HTTP reachability healthy
- WebSocket reachability healthy
- GPT-5.5 visible
- previous provider reachability failure classified as transient

## Next safe action

Prepare ONE completely fresh TASK-0324 orchestration canary through normal AEOS APIs.

Before execution, read back and prove:
- orchestration prepared=true
- orchestration consumed=false
- planner reserved / revision 1
- planner one-shot consumed=false
- worker reserved / revision 1
- worker one-shot consumed=false
- route absent
- planner outcome absent
- worker outcome absent
- reconciliationRequired=false

Only then execute exactly once.

## Completed mainline milestones

The compact list below is only an index. The detailed history is in `docs/ai/AEOS_CANONICAL_PROJECT_MEMORY.md`.

- planning/bootstrap contracts
- CLI MVP
- Memory/Project/Template MVP
- init pipeline
- project intelligence/profile
- template recommend
- agentic task lifecycle
- coverage verifier
- persisted task state
- revision guards
- invocation identity/idempotency
- duplicate suppression
- outcome_unknown and reconciliation
- permission/policy gates
- durable approval/audit boundaries
- provider-neutral dispatch/recovery
- TASK-0312 generic worker runtime
- TASK-0313 Codex worker adapter boundary
- TASK-0314 local process readiness gate
- TASK-0315 Claude worker adapter boundary
- TASK-0316 shared real local process runtime
- TASK-0317 real Claude read-only canary
- TASK-0318 isolated mutation workspace
- TASK-0319 real Claude isolated write + durable mutation evidence
- TASK-0320 TEST primary apply authority
- TASK-0321 controlled real primary apply canary
- TASK-0322 worker routing authority
- TASK-0323 route → worker orchestration lifecycle
- TASK-0324 active real two-model milestone

## TASK-0324 fixes already completed

Detailed root cause and lesson history is in the canonical project memory. Do not regress:

- Claude host auth false-negative fix
- invocation ordering/reporting fix
- Codex host auth preflight
- planner outcome persistence diagnostic fix
- policy requirement metadata fix
- real planner → route handoff investigation
- bounded host environment / PATH
- unsupported Codex exec flag removal
- orchestration one-shot launch-boundary fix
- planner profile `gpt-5.5 / high`
- exit=1 durable diagnostic pipeline
- stderr head/tail/terminal diagnostic improvement
- transient provider/network incident classification

## Model rules

Codex when available:
- routine docs/contracts/examples/smoke → GPT-5.5 Medium
- critical architecture/security/runner/policy/audit/filesystem/adapter → GPT-5.5 High

Do not move Codex to GPT-5.6 without explicit user approval.

Claude during temporary-primary mode may use the best trusted available Claude model appropriate to the task, while preserving implementer/reviewer separation for critical work.

## AEOS invariants

AEOS is authority. Worker/model claims are evidence only.

Example:
- Expected=400
- Accounted=20
- Remaining=380

Even if a model says all complete:
- TaskComplete=false
- Verifier=false
- Completion=false

No blind retry. No consumed invocation replay. No model self-authorization. No silent routing fallback. No automatic completion. No cloud-provider-specific mainline infrastructure.

## Working Kit

- Repo discovery: CBM first
- Literal search: `rg`
- Structural search/refactor: `ast-grep`
- Official docs: Context7 on-demand
- Bounded packaging: Repomix on-demand
- Heavy CLI output: RTK / bounded summaries
- Web research: Scrapling on-demand
- Workflow skills: Superpowers progressive disclosure
- Security: Trivy/Gitleaks when appropriate

## Claude role separation

Primary Orchestrator Claude:
- compact long-lived context
- task/dependency selection
- dispatch
- state
- review/merge gate

Implementer Claude:
- fresh bounded context per task

Reviewer Claude:
- fresh independent context for critical work

Same critical context must not implement and approve itself.

## Other control issues

- Issue #2 — historical TASK-0001 → TASK-03xx reconstruction
- Issue #3 — complete product-ready roadmap
- Issue #4 — GitHub source-of-truth + Claude handoff completion

Historical reconstruction must not invent missing task meanings. The full task ledger is being reconstructed from source/Git evidence; backlog text alone is not final execution authority.

## Files to read first

1. `AGENTS.md`
2. `PROJECT_CONTEXT.md`
3. `docs/ai/AEOS_CANONICAL_PROJECT_MEMORY.md`
4. `docs/ai/DEVELOPER_ACCELERATION_STACK.md`
5. `ops/handoffs/codex-to-claude-handoff.md`
6. GitHub Issue #1
7. GitHub Issue #4

Then use CBM-first targeted discovery.

## Blockers

No currently proven persistent network/provider blocker.

## Next ready task

Complete TASK-0324 through a NEW fresh canary. Do not advance to TASK-0325 until durable closeout is complete.
