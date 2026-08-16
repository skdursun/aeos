# AEOS Product-Ready Task Index

This is the durable index for the product-ready program after TASK-0324.

Canonical detailed task contracts live in GitHub Issues. The human-readable structured mirror lives in the Notion AEOS Task Ledger. The phase-level product definition lives in `docs/roadmaps/PRODUCT_READY_ROADMAP.md`.

## Source-of-truth rules

- Development queue: GitHub Issues.
- Runtime completion/accounting/verifier authority: AEOS durable state, never GitHub status or model claims.
- Human-readable roadmap/task ledger: Notion.
- Product-ready implementation starts only after TASK-0324 closes durably.
- Do not skip a dependency just because a later issue exists.

## Notion

- AEOS Task Ledger: `https://app.notion.com/p/aa4677bdccc6459c834af79555cda4b0`
- Roadmap overview: `https://app.notion.com/p/3bedd39799a981979eb7e14fc404027e`

## GitHub task map

### Phase A — Orchestration & Accounting
- TASK-0325 → Issue #5 — Worker result → work accounting bridge
- TASK-0326 → Issue #6 — Requirement/task progress ledger
- TASK-0327 → Issue #7 — Bounded orchestration iteration contract
- TASK-0328 → Issue #8 — Durable iteration state and step identity
- TASK-0329 → Issue #9 — Planner next-step proposal contract
- TASK-0330 → Issue #10 — Controlled multi-step orchestration runner

### Phase B — Verifier / Completion / Retry / Recovery
- TASK-0331 → Issue #11 — Worker evidence → verifier input bridge
- TASK-0332 → Issue #12 — Requirement-level verifier aggregation
- TASK-0333 → Issue #13 — Task completion gate authority
- TASK-0334 → Issue #14 — Retry eligibility classifier
- TASK-0335 → Issue #15 — Recovery/resume orchestration state machine
- TASK-0336 → Issue #16 — End-to-end controlled task closeout canary

### Phase C — Mutation / Apply / Rollback
- TASK-0337 → Issue #17 — General durable mutation bundle contract
- TASK-0338 → Issue #18 — Multi-file mutation scope and artifact verification
- TASK-0339 → Issue #19 — Primary apply plan and preflight
- TASK-0340 → Issue #20 — Atomic multi-file apply transaction
- TASK-0341 → Issue #21 — Rollback journal and compensating restore
- TASK-0342 → Issue #22 — Crash-safe apply/recovery end-to-end canary

### Phase D — Policy / Security / Audit
- TASK-0343 → Issue #23 — Repository threat model and trust-boundary review
- TASK-0344 → Issue #24 — Versioned policy configuration schema
- TASK-0345 → Issue #25 — Role/permission profiles and least privilege
- TASK-0346 → Issue #26 — Operator approval UX and expiry/revocation
- TASK-0347 → Issue #27 — Secret/privacy-safe execution and evidence hardening
- TASK-0348 → Issue #28 — Tamper-evident audit/provenance chain

### Phase E — Adapters / Plugins / Tools
- TASK-0349 → Issue #29 — Worker capability registry and health model
- TASK-0350 → Issue #30 — Adapter manifest and compatibility contract
- TASK-0351 → Issue #31 — Model/provider profile configuration
- TASK-0352 → Issue #32 — Plugin/tool discovery and lifecycle
- TASK-0353 → Issue #33 — MCP tool adapter with policy/audit gates
- TASK-0354 → Issue #34 — Adapter conformance and disable/rollback suite

### Phase F — Context / Memory / Project Intelligence
- TASK-0355 → Issue #35 — Context budget and selection policy
- TASK-0356 → Issue #36 — Canonical memory provenance/expiry model
- TASK-0357 → Issue #37 — Memory retrieval ranking and conflict handling
- TASK-0358 → Issue #38 — Project snapshot and change-intelligence cache
- TASK-0359 → Issue #39 — Task brief/context compiler
- TASK-0360 → Issue #40 — Cross-agent handoff package generator

### Phase G — Observability / Watch Tower
- TASK-0361 → Issue #41 — Structured runtime event model
- TASK-0362 → Issue #42 — Metrics and health aggregation
- TASK-0363 → Issue #43 — Trace/correlation identity across task→worker
- TASK-0364 → Issue #44 — Diagnostic support bundle
- TASK-0365 → Issue #45 — Watch Tower project/task health model
- TASK-0366 → Issue #46 — Watch Tower agent/tool health model

### Phase H — CLI / TUI / Operator UX
- TASK-0367 → Issue #47 — CLI command surface consistency and exit-code contract
- TASK-0368 → Issue #48 — Machine-readable JSON schema/versioning
- TASK-0369 → Issue #49 — Interactive operator intervention commands
- TASK-0370 → Issue #50 — TUI architecture and navigation shell
- TASK-0371 → Issue #51 — TUI task/agent/Watch-Tower dashboards
- TASK-0372 → Issue #52 — TUI approval/recovery/log workflows

### Phase I — GitHub / CI / Release Engineering
- TASK-0373 → Issue #53 — GitHub Issue ↔ AEOS task synchronization
- TASK-0374 → Issue #54 — Branch/worktree ownership and concurrency rules
- TASK-0375 → Issue #55 — PR/review/merge-gate automation
- TASK-0376 → Issue #56 — CI matrix and deterministic quality gates
- TASK-0377 → Issue #57 — Security/SBOM/dependency release gates
- TASK-0378 → Issue #58 — Release/version/changelog automation

### Phase J — Packaging / Cross-platform / Upgrade
- TASK-0379 → Issue #59 — Distribution and packaging architecture
- TASK-0380 → Issue #60 — macOS installer/bootstrap/doctor
- TASK-0381 → Issue #61 — Linux installer/bootstrap/doctor
- TASK-0382 → Issue #62 — Windows installer/bootstrap/doctor
- TASK-0383 → Issue #63 — Versioned config/data migrations with rollback
- TASK-0384 → Issue #64 — Upgrade/uninstall/cleanup lifecycle

### Phase K — Backup / Privacy / Performance / Resilience
- TASK-0385 → Issue #65 — Backup/export contract and tooling
- TASK-0386 → Issue #66 — Restore/disaster-recovery drill
- TASK-0387 → Issue #67 — Data retention/privacy/redaction controls
- TASK-0388 → Issue #68 — Performance benchmark baseline
- TASK-0389 → Issue #69 — Context/token/cost budget enforcement
- TASK-0390 → Issue #70 — Fault-injection, stress and long-run soak suite

### Phase L — Docs / Dogfood / Beta / RC / GA
- TASK-0391 → Issue #71 — Documentation information architecture
- TASK-0392 → Issue #72 — Quickstart/tutorial/examples/troubleshooting
- TASK-0393 → Issue #73 — Operator/admin runbooks and support diagnostics
- TASK-0394 → Issue #74 — Dogfood and alpha exit gate
- TASK-0395 → Issue #75 — Beta and release-candidate exit gates
- TASK-0396 → Issue #76 — GA / v1.0 product-ready final gate

## Coverage

- Planned product-ready tasks: 72
- First planned task: TASK-0325
- Final pre-v1.0 gate: TASK-0396
- GitHub Issue range: #5–#76
- Notion rows: 72, all mapped to GitHub Issues and marked planned

## Dependency-ready entry point

Before TASK-0325, complete GitHub Issue #1 / TASK-0324. After TASK-0324 durable closeout, the default next dependency-ready task is TASK-0325 / Issue #5.

## Release gates

- TASK-0394: Dogfood / Alpha gate
- TASK-0395: Beta / Release Candidate gate
- TASK-0396: GA / v1.0 final product-ready gate

GA is evidence-based. A model, worker, GitHub closed state, or human optimistic statement alone cannot authorize product readiness.