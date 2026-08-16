# AEOS Tool and Skill Selection Policy

This is the permanent tool router for AEOS agent sessions. Root `CLAUDE.md` and `AGENTS.md` point here so fresh sessions inherit the same behavior.

## Always-required control surfaces

These are not all preloaded into context, but their role is mandatory on every task.

### GitHub

Role: canonical development issue queue, branch/PR/commit evidence and dependency coordination.

Every task starts from a GitHub Issue. No issue means no product implementation. GitHub issue closure is not AEOS runtime completion authority.

### Notion

Role: mandatory human-readable AEOS Task Ledger mirror and cross-check.

Every GitHub Task ID must be looked up in Notion before implementation. GitHub and Notion are updated together at planned/in-progress/blocked/complete transitions. Drift is reconciled from Git/source/tests/evidence; never guessed.

### Codebase Memory MCP — DIRECT / FIRST

Role: primary persistent repository/domain discovery layer.

Use first for every new issue/domain before broad file reads. Follow with targeted `rg`, `ast-grep`, and exact source reads. Do not add a second generic always-on repo-memory MCP.

### RTK — DIRECT FOR HIGH-OUTPUT COMMANDS

Role: output/context reduction for git/test/build/scanner/log commands.

Prefer bounded head/tail/JSON/summary output. Raw high-volume output becomes an artifact; the orchestrator reads a bounded summary.

### Superpowers / local Skills — MANDATORY ROUTER, LAZY CONTENT

Role: workflow/methodology discipline.

At every task start, check which installed skill category is relevant. Load only relevant full skill content. Typical required categories include planning, systematic debugging, TDD, verification-before-completion, worktree isolation, parallel-agent dispatch and code review.

Do not preload the full skill set.

## Direct CLI tools by need

### `rg`

Use for literal/string/symbol search after CBM narrowing.

### `ast-grep` / `sg`

Use for structural TypeScript/JavaScript search, boundary analysis and reviewed codemods. For rewrites: search → inspect matches → isolated branch/worktree → rewrite → diff → targeted tests.

### `mise`

Use for runtime/tool/task reproducibility and documented task aliases when present. It must reproduce existing AEOS runtime decisions rather than redefine architecture.

## On-demand tools

### Context7

Use only for official package/API/library documentation when source or local types are insufficient. Do not use as generic web search or preload its schema.

### Repomix

Use only for bounded repository packaging, handoff snapshots or narrowly scoped external review context. Never package the whole private repo by default.

### Scrapling

Use only when current external web research/extraction is genuinely required. Keep extracted material bounded and preserve source provenance.

### Knip

TypeScript/JavaScript unused file/dependency/export analysis. Report-only first. Never auto-delete; cleanup needs its own task/review.

### Trivy

Use for vulnerability, misconfiguration, secret and SBOM baseline at security/release gates and when the task touches dependency/supply-chain/security surfaces. It supplements, never replaces, AEOS policy/verifier tests.

### Gitleaks

Use as cheap staged/pre-commit secret gate when enabled/available, especially before push/PR. Avoid duplicate heavy full scans when Trivy CI coverage is sufficient.

### Lefthook

Use only when already enabled or when a dedicated tooling task proves it keeps hooks fast. Do not add heavy full-repo checks to pre-commit.

### Turborepo

Use only if already enabled by benchmark evidence. Never redesign package architecture merely to use Turbo.

### Renovate

Use only for conservative dependency maintenance: grouped/limited updates, security priority, manual major/provider/model review. It never auto-upgrades model/provider architecture authority.

### Maestro

Not default for current CLI-first AEOS. Use only if a supported web/mobile user-flow surface exists and the task specifically requires deterministic UI E2E.

## Freshness and installation

Current approved baseline is the Developer Working Kit. New MCP/skill installation requires explicit user approval.

For installation/replacement decisions:

- core AI CLI/apps follow the Working Kit stability/soak policy;
- third-party MCP/skills follow the Working Kit freshness gate;
- stale/unavailable tools are marked degraded/rejected rather than silently replaced by an unapproved alternative.

Tool absence does not justify weakening product gates. Use the documented fallback or mark the affected task blocked and continue another dependency-ready task.

## Multi-agent use

Maximum subagents: four.

- IMPLEMENTER-A — standard/default effort.
- IMPLEMENTER-B — standard/default effort.
- REVIEWER-A — standard/default effort.
- REVIEWER-B — standard/default effort.

The orchestrator may use adaptive/high reasoning for scheduling, safety and architecture, but does not normally implement product code.

Use parallel workers only with dependency-safe and non-overlapping write scopes. Reviewers always receive fresh independent context.

## Output discipline

Never flood the orchestrator with raw scanner/test/log output. Persist raw output where useful and return only:

- command/status;
- bounded relevant excerpt;
- failure code/reason;
- artifact/evidence path;
- exact next action.

## Authority boundary

Every tool, MCP and skill is capability/evidence only. None may grant itself or a model:

- permission;
- policy approval;
- routing authority;
- retry authority;
- accounting credit;
- verifier satisfaction;
- task completion.
