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

## Critical Defect Precedence — HARD RULE

If implementation, independent review, soak, audit or integration finds a real **P0 or
release-blocking P1 defect on an AEOS critical authority boundary**, roadmap progress STOPS.

Critical authority boundary means: concurrency, locking, idempotency, invocation identity,
durable state, persistence, revision guards, state machines, completion authority, accounting
authority, retry/recovery, policy/permission, security, audit/provenance.

- A defect found this way is never left silently because it is "out of scope" while you move on
  to the next dependency-ready feature.
- Open or reuse a dedicated GitHub Issue for it, and durably record the blocker/dependency
  relationship to the source task. GitHub and Notion must show the same state.
- No dependent roadmap task gets closeout until the critical defect is IMPLEMENTED + TESTED +
  INDEPENDENTLY REVIEWED + INTEGRATED.
- A model or worker calling the problem small does not bypass this gate.
- Non-blocking P2/P3 findings may be filed as issues and do not automatically stop the roadmap.
- Lowering a severity requires evidence. Downgrading severity in order to keep moving is
  forbidden.

Authoritative detail: `docs/ai/AEOS_AGENT_OPERATING_CONSTITUTION.md` → "Critical Defect
Precedence".

## Canonical Integration Checkpoint — HARD RULE

The canonical/default branch is currently `master`; verify it from the remote at session start
rather than trusting this sentence.

- **IMPLEMENTED and INTEGRATED are different states.** Passing tests on a task branch does not
  complete a task.
- A task is COMPLETE/Tamamlandı only when its final reviewed commit is reachable from the
  canonical default branch.
- After a critical/P0 authority task gets final REVIEW PASS, perform the canonical integration
  checkpoint **before** dispatching the next critical roadmap task.
- Multiple closed critical tasks must not accumulate silently on a long-lived task branch. No
  branch — `task/0324-fresh-canary` explicitly included — becomes a permanent shadow-main.
- If completed critical task commits sit ahead of `origin/master`, NEXT TASK DISPATCH IS
  FORBIDDEN. Integrate first.
- Start each new critical task from a clean bounded branch/worktree cut from the current
  canonical default branch, and retire the old task branch after merge.

Minimum preflight at the start of every task:

```
git fetch origin
git rev-list --left-right --count origin/master...HEAD
git log --oneline origin/master..HEAD
```

If HEAD carries task commits previously declared COMPLETE that have not reached master, emit
`INTEGRATION_REQUIRED` and do not dispatch a new critical task.

## Current queue rule

Use GitHub dependency order and validate every selected task against Notion before dispatch.

The rules above are permanent. The following is a **snapshot of the current recovery chain**, not
a hardcoded queue — current GitHub + Notion state always wins:

`GitHub #77 → TASK-0328 / Issue #8 → canonical integration checkpoint → TASK-0329`

## Closeout loop

For each task:

`GITHUB ISSUE → NOTION CROSS-CHECK → DEPENDENCY CHECK → CBM-FIRST DISCOVERY → SKILL ROUTER → IMPLEMENT → TARGETED TESTS → FULL RELEVANT TESTS → TWO FRESH INDEPENDENT REVIEWERS → FIX/RE-REVIEW → COMMIT → PUSH → CANONICAL INTEGRATION CHECKPOINT → VERIFY COMMIT REACHABLE FROM DEFAULT BRANCH → GITHUB COMPLETE → NOTION TAMAMLANDI → NEXT TASK`

None of these alone means COMPLETE:

- "commit/push done" is not COMPLETE.
- "review pass received" is not COMPLETE.
- "issue closed" without canonical integration evidence is a wrong state.

Canonical reachability must be proven, not assumed:

```
git merge-base --is-ancestor <FINAL_TASK_SHA> origin/master
```

Do not mark a task canonically COMPLETE until that exits 0. A task whose implementation is
finished and reviewed but not yet integrated is recorded as `IMPLEMENTED_AWAITING_INTEGRATION`
in the GitHub issue/handoff and in the matching Notion row.

Never pause for a routine conversational report between tasks.
