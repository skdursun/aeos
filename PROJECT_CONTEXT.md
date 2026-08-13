# Project Context

Project: Pro Performans

Product: AEOS - AI Engineering Operating System

Current Phase: Phase 0 - Planning and Project Operating System

## Goal

Design and build AEOS as a modular, extensible, model-independent AI
Engineering OS for orchestrating AI agents, tools, memory, verification,
repositories, and project workflows.

## Current Working Rule

Every Codex thread/session is stateless and must receive a tiny isolated task
with explicit files to load, files to modify, verification steps, and a stop
condition.

## Current Priorities

- Keep context loading small and intentional.
- Keep project intelligence and template recommendation deterministic,
  evidence-based, local-first, and fallback safe.
- Keep agentic task execution externally verified, coverage-aware, policy-gated,
  auditable, and resumable without trusting model self-reporting.
- Keep the agentic runner deterministic, local-first, auditable, resumable, and
  verifier-gated.
- Keep AEOS model-agnostic and cloud-provider-independent. AEOS owns task
  authority, state, policy, audit, invocation, accounting, verifier, and
  completion; worker/provider output remains evidence only.

## Recent Completed Tasks

- TASK-0249: Add task contract mapping logic smoke tests.
- TASK-0250: Add task contract mapping safety review.
- TASK-0251: Add task contract mapping documentation.
- TASK-0252: Add task contract mapping final safety review.
- TASK-0253: Wire task plan file mapping to planner design.
- TASK-0254: Implement task plan file planner wiring contracts.
- TASK-0255: Add task plan file planner wiring contract examples.
- TASK-0256: Add task plan file planner wiring contract smoke tests.
- TASK-0257: Implement task plan file planner wiring logic.
- TASK-0258: Add task plan file planner wiring logic examples.
- TASK-0259: Add task plan file planner wiring logic smoke tests.
- TASK-0260: Add task plan file planner wiring safety review.
- TASK-0261: Add task plan file planner wiring documentation.
- TASK-0262: Add task plan file planner wiring final safety review.
- TASK-0263: Design CLI task plan parser-mapper-planner integration.
- TASK-0264: Implement CLI task plan planner integration contracts.
- TASK-0265: Add CLI task plan planner integration contract examples.
- TASK-0266: Add CLI task plan planner integration contract smoke tests.
- TASK-0267: Implement CLI task plan planner integration logic.
- TASK-0268: Add CLI task plan planner integration logic examples.
- TASK-0269: Add CLI task plan planner integration logic smoke tests.
- TASK-0270: Add CLI task plan planner integration safety review.
- TASK-0271: Add CLI task plan planner integration documentation.
- TASK-0272: Add CLI task plan planner integration final safety review.
- TASK-0273: Implement CLI task plan command planner integration.
- TASK-0274: Fix AEOS global audit integration findings for task plan.
- TASK-0275: Post-audit task plan regression review.
- TASK-0276: Design CLI task dry-run integration.
- TASK-0277: CLI task dry-run targeted regression and safety review.
- TASK-0278: Design and implement task state persistence MVP foundation.
- TASK-0279: Task state persistence targeted safety/regression review and resume
  handoff foundation.
- TASK-0280: Implement read-only task status and resume preview CLI.
- TASK-0281: Design and implement explicit task-state initialization/persistence
  CLI.
- TASK-0282: Design and implement revision-guarded task-state transition/update
  foundation.
- TASK-0283: Design and implement read-only task-state transition preview CLI.
- TASK-0284: Design and implement explicit revision-guarded transition apply
  CLI.
- TASK-0285: Design authoritative execution-attempt/event state foundation.
- TASK-0286: Execution-attempt targeted safety review and read-only
  execution-preparation CLI preview.
- TASK-0287: Design and implement explicit execution-attempt
  persistence/preparation apply CLI.
- TASK-0288: Execution-attempt persistence targeted safety review and
  execution-start authorization foundation.
- TASK-0289: Design and implement explicit prepared-to-started execution-attempt
  transition apply without adapter execution.
- TASK-0290: Design and implement controlled execution invocation boundary with
  dependency-injected test/no-op executor only.
- TASK-0291: Design and implement persisted execution invocation/idempotency
  record foundation.
- TASK-0292: Invocation persistence targeted safety review and read-only
  invocation status CLI.
- TASK-0293: Design and implement invocation reconciliation/recovery foundation
  for invoking/outcome_unknown records.
- TASK-0294: Implement read-only invocation reconciliation preview CLI and
  provider capability inspection model.
- TASK-0295: Design and implement explicit typed invocation reconciliation
  apply foundation without provider calls or retry.
- TASK-0296: Design provider reconciliation adapter contract and test-only
  provider evidence bridge.
- TASK-0297: Provider reconciliation bridge targeted safety review and
  production adapter readiness gate.
- TASK-0298: Design and implement vendor-neutral production execution adapter
  contract and conformance harness with TEST implementation only.
- TASK-0299: Design and implement adapter permission/policy execution gate
  foundation with TEST-only enforcement.
- TASK-0300: Design and implement credential reference resolution boundary with
  TEST secret provider only.
- TASK-0301: Design and implement durable execution audit runtime foundation.
- TASK-0302: Design and implement durable production policy approval proof
  runtime foundation.
- TASK-0303: Production-call blocker readiness review after policy, credential,
  and audit foundations.
- TASK-0304: Production credential provider boundary with production execution
  still disabled.
- TASK-0305: First production execution adapter vertical slice with all real
  calls disabled.
- TASK-0306: Production provider idempotency/status/result-replay crash
  conformance harness with TEST transport only.
- TASK-0307: Controlled production dispatch authority/gate with real provider
  execution still disabled.
- TASK-0308: First controlled production provider integration and one-shot
  operator dispatch CLI boundary with no automated real calls.
- TASK-0309: Provider-specific recovery conformance review for OpenAI Responses
  API; first controlled real-call readiness remains blocked because official
  documentation did not prove idempotent create or lookup by AEOS idempotency key
  after a crash before local provider-reference persistence.
- TASK-0310: Provider recovery strategy decision. Historical provider-specific
  direction was superseded; active AEOS mainline remains provider/model
  agnostic and must not require any cloud provider.
- TASK-0311: Provider recovery conformance safety regression. Historical
  provider-specific fixture was replaced by a deterministic provider-neutral
  fixture. The generic rule remains: known idempotency-key lookup becoming
  unavailable is not `not_found` and is not safe retry authorization.
- TASK-0312: Model-agnostic worker execution adapter runtime foundation. Added
  the generic TEST-only worker boundary for future Codex, Claude Code, and
  generic workers. AEOS remains authoritative for worker selection, invocation
  binding, permission facts, task state, work accounting, verification, retry,
  audit, and completion; worker output is bounded evidence only.
- TASK-0313: First concrete local Codex worker adapter boundary. Added a
  Codex-family adapter on top of the generic TASK-0312 worker runtime with a
  bounded future `codex exec` argv process request, system-owned executable,
  workspace, model, sandbox, approval, timeout, and process permission
  authority, deterministic TEST process normalization only, and real Codex,
  Claude Code, child-process, cloud, retry, verifier, and completion execution
  disabled.
- TASK-0314: Controlled real-local Codex worker execution readiness gate. Added
  the closed local worker process authority for prepared Codex invocations,
  binding task revision, attempt, invocation, idempotency, worker, workspace,
  executable, argv, permission, output limits, timeout, and audit intent while
  keeping real Codex, Claude Code, child-process, cloud, retry, verifier, and
  completion execution disabled.
- TASK-0315: Claude Code worker adapter boundary using the existing generic
  worker runtime and shared local-process authority. Added Claude Code as a
  concrete model-agnostic local worker adapter sibling to Codex with
  system-owned identity, trusted executable reference, argv-only prepared
  invocation, workspace and permission binding, bounded structured result
  normalization, hostile-output stripping, Codex/Claude parity coverage, and
  real Codex, Claude Code, child-process, cloud, retry, verifier, completion,
  and work accounting execution disabled.
- TASK-0316: Shared controlled local worker process runtime. Added one shared
  bounded local-process runtime beneath the Codex and Claude Code adapter
  process gates, durable one-shot launch consumption through invocation
  persistence, conservative workspace/environment/output/timeout handling, and
  deterministic benign child-process smoke coverage while keeping real Codex,
  real Claude Code, cloud, retry, verifier, completion, and work accounting
  authority disabled.
- TASK-0317: First explicitly controlled real local Claude Code worker canary
  boundary. Implemented the read-only Claude Code canary profile and AEOS
  operator command boundary on the existing Claude adapter and shared local
  process runtime, with safe-mode host customization isolation, restricted
  read-only tool posture, JSON Schema structured output, system-owned
  executable/workspace/environment authority, audit-before-launch ordering, and
  durable one-shot launch consumption. The first real AEOS-controlled read-only
  Claude Code canary executed successfully and returned bounded evidence through
  the controlled worker process boundary. Repository writes remained disabled,
  shell execution remained disabled, and worker output remained evidence only
  with no verifier, completion, work-accounting, or task-completion authority.
- TASK-0318: Isolated write-capable local worker workspace authority.
  Implemented a generic Codex/Claude-compatible mutation workspace boundary
  using system-created temporary isolated workspaces, bounded mutation scope,
  protected path rejection, symlink/traversal/absolute-path blocking,
  pre/post filesystem evidence, one-shot test mutation consumption, and
  deterministic TEST-only writes. Worker self-reported changed files and
  completion claims remain non-authoritative, shell/package/git authority
  remains disabled, primary workspace apply remains closed, and TASK-0318 made
  zero real Claude, Codex, or cloud calls.
- TASK-0319: First controlled real Claude Code isolated WRITE canary with
  durable mutation evidence. The fresh real canary mutated only
  `canary/claude-write-canary.txt`, AEOS persisted and read-back verified
  invocation-bound mutation evidence plus a bounded mutation artifact,
  PrimaryApplyInputDurable is true for the fresh invocation, the primary
  repository remained untouched, shell execution and primary apply remained
  disabled, and worker evidence remains non-authoritative for verifier,
  completion, retry, approval, and task-completion authority.
- TASK-0320: Verified durable mutation-artifact to primary-workspace single-file
  apply authority using deterministic TEST repositories only. AEOS now verifies
  durable evidence/artifact authority from persisted state, enforces exact
  one-file update/create scope, protected-path and symlink/traversal rejection,
  stale baseline conflicts, durable one-shot apply reservation, atomic TEST
  primary mutation, afterDigest verification, immutable lifecycle outcomes,
  replay/crash recovery semantics, bounded audit facts, and no completion,
  verifier, retry, worker, cloud, automatic patch, or real primary apply
  authority.

## Do Not Load By Default

- Do not load all files in `docs/`.
- Do not load `brain/` unless the task explicitly names files inside it.
- Do not load `templates/` unless the task explicitly names files inside it.
- Do not scan the entire repository unless the task explicitly requires it.

## Next Task

TASK-0321: Execute exactly one operator-controlled REAL primary-workspace apply
canary using the prepared sacrificial system-owned file/artifact, then review
the durable result and Git status delta. Do not route, complete, or clean up
before that review.

## Current Direction

AEOS remains model-agnostic and cloud-provider-independent. Cloud-specific
provider work is de-scoped from the required mainline. The next product work
returns to the Codex-orchestrator plus Claude Code worker orchestration
architecture through provider-neutral adapter foundations, without implementing
real Codex or Claude Code worker execution yet.

TASK-0320 is complete: deterministic TEST-only isolated mutation apply authority
is behaviorally proven for one durable artifact to one TEST primary file, with
stale baseline, protected path, symlink/traversal, replay, crash-window, and
afterDigest verification coverage. Real primary-repository apply, automatic
patch apply, verifier/completion authority, retry authority, model invocation,
worker invocation, and cloud calls remain closed. TASK-0321 is ready to design
the first controlled REAL primary-workspace canary against a sacrificial
system-owned file/artifact only.

TASK-0321 implementation is ready but not fully complete: AEOS now has a
dedicated real primary apply canary boundary for one system-owned sacrificial
create artifact, with general real primary apply and automatic patch apply
still disabled. The durable TASK-0321 canary evidence/artifact/apply intent is
prepared in AEOS state, but the real primary canary has not been executed or
reviewed. Next action is to execute exactly one operator-controlled real primary
apply canary and inspect the durable result plus Git status delta before any
cleanup or routing.

## Current Plans

- docs/AGENTIC_TASK_LIFECYCLE_DESIGN.md
- docs/AGENTIC_COVERAGE_VERIFIER_DESIGN.md
- docs/AGENTIC_RUNNER_ARCHITECTURE.md
- docs/AGENTIC_RUNNER_PLANNING_LOGIC.md
- docs/AGENTIC_RUNNER_PLANNING_USAGE.md
- docs/AGENTIC_RUNNER_EXECUTION_LIFECYCLE.md
- docs/AGENTIC_RUNNER_DRY_RUN_EXECUTION_LOGIC.md
- docs/TASK_STATE_PERSISTENCE_MVP.md
- docs/TASK_PLAN_INPUT_FILE_DESIGN.md
- docs/TASK_PLAN_INPUT_PARSER_USAGE.md
- docs/TASK_CONTRACT_TO_RUNNER_PLANNING_MAPPING.md
- docs/TASK_CONTRACT_MAPPING_USAGE.md
- docs/TASK_PLAN_FILE_TO_PLANNER_WIRING_DESIGN.md
- docs/CLI_TASK_PLAN_PARSER_MAPPER_PLANNER_INTEGRATION_DESIGN.md
