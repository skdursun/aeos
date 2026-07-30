# Decision Log

## ADR-0001: Markdown + Git as Source of Truth

Status: Accepted

Decision: Use Markdown files tracked in Git as the initial source of truth for project context, architecture, tasks, memory, and decisions.

Rationale: Markdown is transparent, reviewable, portable, and easy for AI agents and humans to inspect.

## ADR-0002: Stateless Codex Task Execution

Status: Accepted

Decision: Treat each Codex CLI session as stateless and assign one tiny isolated task per session.

Rationale: Stateless execution reduces context drift, unintended edits, and hidden assumptions.

## ADR-0003: Adapter-Based Model Independence

Status: Accepted

Decision: Isolate model and agent providers behind adapters.

Rationale: AEOS must support ChatGPT, Codex, Claude Code, MCP tools, and future models without coupling core logic to one provider.

## ADR-0004: Lazy Context Loading

Status: Accepted

Decision: Load only files explicitly required by the current task.

Rationale: Lazy context loading saves tokens, reduces confusion, and lowers the risk of unrelated changes.

## ADR-0005: Verification Before Memory Write

Status: Accepted

Decision: Do not write long-term memory until the relevant work has been verified.

Rationale: Memory should preserve confirmed engineering knowledge, not unverified intermediate conversation.

## ADR-0006: Use TypeScript on Node.js LTS with pnpm workspaces

Status: Accepted

Decision: Implement AEOS v0 in TypeScript on Node.js LTS, targeting Node 24 LTS, with pnpm as the package manager and pnpm workspaces as the monorepo mechanism.

Rationale: TypeScript supports explicit AEOS-owned contracts, Node.js LTS supports local CLI and tooling workflows, and pnpm workspaces fit the planned `apps/` and `packages/` package architecture.
