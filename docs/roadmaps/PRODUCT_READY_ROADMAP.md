# AEOS Product-Ready Roadmap

Status: planned after TASK-0324 closeout.

Purpose: define the complete development program from the current real two-model orchestration milestone to a product that can be installed, used, observed, upgraded, recovered, documented, and supported by a real user or team.

## Non-negotiable invariants

- AEOS remains the authority for task lifecycle, routing, policy, permission, audit, accounting, verifier, retry and completion.
- Model/worker output is evidence only.
- No blind retry after ambiguous execution state.
- Historical consumed invocations are never reset for convenience.
- Core stays model/provider agnostic.
- No AWS/Bedrock/S3/IAM/Cloudflare/Azure/GCP mainline dependency unless explicitly approved.
- Critical architecture/security/policy/audit/filesystem/runner/adapter changes require independent review.
- Repository discovery follows Developer Working Kit: CBM first, targeted rg/ast-grep, bounded output, progressive disclosure.

## Definition of Product Ready

AEOS is product-ready only when a new user or team can:

1. install it on a supported clean machine;
2. initialize or attach it to a project;
3. configure trusted model/worker adapters without changing core architecture;
4. run bounded task orchestration with durable accounting, verifier and completion gates;
5. observe task, worker, policy, audit and health state;
6. recover safely after crash, timeout, provider failure or partial apply;
7. approve/reject risky operations explicitly;
8. update, migrate, roll back and uninstall safely;
9. export/restore important state;
10. operate it from documented CLI/TUI workflows;
11. pass security, performance, resilience, cross-platform and release gates;
12. receive support using deterministic diagnostics and documented runbooks.

## Phase A — Orchestration & Accounting (TASK-0325–0330)

- TASK-0325 Worker result → work accounting bridge
- TASK-0326 Requirement/task progress ledger
- TASK-0327 Bounded orchestration iteration contract
- TASK-0328 Durable iteration state and step identity
- TASK-0329 Planner next-step proposal contract
- TASK-0330 Controlled multi-step orchestration runner

Exit: AEOS can execute bounded planner→route→worker iterations while updating authoritative work accounting without trusting worker completion claims.

## Phase B — Verifier, Completion, Retry & Recovery (TASK-0331–0336)

- TASK-0331 Worker evidence → verifier input bridge
- TASK-0332 Requirement-level verifier aggregation
- TASK-0333 Task completion gate authority
- TASK-0334 Retry eligibility classifier
- TASK-0335 Recovery/resume orchestration state machine
- TASK-0336 End-to-end controlled task closeout canary

Exit: a task closes only through AEOS-owned accounting + verifier + completion authority; failures resume/retry only when evidence permits.

## Phase C — Mutation, Apply & Rollback (TASK-0337–0342)

- TASK-0337 General durable mutation bundle contract
- TASK-0338 Multi-file mutation scope and artifact verification
- TASK-0339 Primary apply plan and preflight
- TASK-0340 Atomic multi-file apply transaction
- TASK-0341 Rollback journal and compensating restore
- TASK-0342 Crash-safe apply/recovery end-to-end canary

Exit: bounded worker changes can be verified, applied, recovered and rolled back without direct uncontrolled repository writes.

## Phase D — Policy, Security & Audit (TASK-0343–0348)

- TASK-0343 Repository threat model and trust-boundary review
- TASK-0344 Versioned policy configuration schema
- TASK-0345 Role/permission profiles and least privilege
- TASK-0346 Operator approval UX and expiry/revocation
- TASK-0347 Secret/privacy-safe execution and evidence hardening
- TASK-0348 Tamper-evident audit/provenance chain

Exit: security posture, permission model and evidence provenance are explicit, versioned, testable and supportable.

## Phase E — Adapters, Plugins & Tools (TASK-0349–0354)

- TASK-0349 Worker capability registry and health model
- TASK-0350 Adapter manifest and compatibility contract
- TASK-0351 Model/provider profile configuration
- TASK-0352 Plugin/tool discovery and lifecycle
- TASK-0353 MCP tool adapter with policy/audit gates
- TASK-0354 Adapter conformance and disable/rollback suite

Exit: models/tools/providers are replaceable through stable manifests, capability contracts, health checks and conformance gates.

## Phase F — Context, Memory & Project Intelligence (TASK-0355–0360)

- TASK-0355 Context budget and selection policy
- TASK-0356 Canonical memory provenance/expiry model
- TASK-0357 Memory retrieval ranking and conflict handling
- TASK-0358 Project snapshot and change-intelligence cache
- TASK-0359 Task brief/context compiler
- TASK-0360 Cross-agent handoff package generator

Exit: long-running work remains resumable and context-efficient without storing raw chat as authority.

## Phase G — Observability & Watch Tower (TASK-0361–0366)

- TASK-0361 Structured runtime event model
- TASK-0362 Metrics and health aggregation
- TASK-0363 Trace/correlation identity across task→worker
- TASK-0364 Diagnostic support bundle
- TASK-0365 Watch Tower project/task health model
- TASK-0366 Watch Tower agent/tool health model

Exit: operators can answer what is running, why it is blocked, which agent/tool is unhealthy, and which evidence supports current state.

## Phase H — CLI, TUI & Operator UX (TASK-0367–0372)

- TASK-0367 CLI command surface consistency and exit-code contract
- TASK-0368 Machine-readable JSON schema/versioning
- TASK-0369 Interactive operator intervention commands
- TASK-0370 TUI architecture and navigation shell
- TASK-0371 TUI task/agent/Watch-Tower dashboards
- TASK-0372 TUI approval/recovery/log workflows

Exit: common operations are usable without source knowledge, with both automation-friendly CLI and human-friendly terminal UI.

## Phase I — GitHub, CI & Release Engineering (TASK-0373–0378)

- TASK-0373 GitHub Issue ↔ AEOS task synchronization
- TASK-0374 Branch/worktree ownership and concurrency rules
- TASK-0375 PR/review/merge-gate automation
- TASK-0376 CI matrix and deterministic quality gates
- TASK-0377 Security/SBOM/dependency release gates
- TASK-0378 Release/version/changelog automation

Exit: development and release flow is reproducible, reviewable and traceable from task through release artifact.

## Phase J — Packaging, Cross-platform & Upgrade (TASK-0379–0384)

- TASK-0379 Distribution and packaging architecture
- TASK-0380 macOS installer/bootstrap/doctor
- TASK-0381 Linux installer/bootstrap/doctor
- TASK-0382 Windows installer/bootstrap/doctor
- TASK-0383 Versioned config/data migrations with rollback
- TASK-0384 Upgrade/uninstall/cleanup lifecycle

Exit: AEOS can be installed, diagnosed, upgraded, rolled back and removed on supported platforms without manual repo surgery.

## Phase K — Backup, Privacy, Performance & Resilience (TASK-0385–0390)

- TASK-0385 Backup/export contract and tooling
- TASK-0386 Restore/disaster-recovery drill
- TASK-0387 Data retention/privacy/redaction controls
- TASK-0388 Performance benchmark baseline
- TASK-0389 Context/token/cost budget enforcement
- TASK-0390 Fault-injection, stress and long-run soak suite

Exit: AEOS has measurable performance/cost bounds, safe data lifecycle and proven recovery under failure/long-run conditions.

## Phase L — Docs, Dogfood, Beta, RC & GA (TASK-0391–0396)

- TASK-0391 Documentation information architecture
- TASK-0392 Quickstart/tutorial/examples/troubleshooting
- TASK-0393 Operator/admin runbooks and support diagnostics
- TASK-0394 Dogfood and alpha exit gate
- TASK-0395 Beta and release-candidate exit gates
- TASK-0396 GA / v1.0 product-ready final gate

Exit: public/internal users can adopt and support AEOS; release candidate satisfies documented security, reliability, usability, compatibility and recovery criteria; v1.0 is explicitly authorized by the final gate.

## Dependency rule

TASK-0324 must close before product-ready execution begins. Tasks may be parallelized only when their dependencies and authority boundaries are explicit. The numerical order is the default dependency-ready order, not permission to skip prerequisite evidence.

## Issue/Notion parity

Every task in this roadmap must have:

- the same Task ID in GitHub and Notion;
- problem and goal;
- scope and out-of-scope;
- dependencies;
- risk class;
- implementation boundary;
- tests;
- acceptance criteria;
- required evidence;
- rollback/failure behavior;
- security/authority impact;
- documentation impact;
- next dependency-ready relation.

GitHub Issues are the canonical development queue. Notion is the human-readable task ledger and product roadmap view.