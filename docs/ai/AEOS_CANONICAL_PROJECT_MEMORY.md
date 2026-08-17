# AEOS Canonical Project Memory

> Purpose: durable, human-readable project memory for any future agent or developer.
>
> This file exists so a fresh Claude, Codex, ChatGPT session, or another agent can understand **what AEOS is, why it exists, what has already been built, which mistakes were fixed, what remains open, and which invariants must never be silently changed** without relying on prior chat history.
>
> Source priority when facts conflict: **Git / source / tests / durable AEOS state > GitHub Issues > PROJECT_CONTEXT.md > this memory > Notion explanatory wiki > conversation history**.

---

## 1. Project identity

**Project name:** Pro Performans  
**Product name:** AEOS — AI Engineering Operating System

AEOS is being built as a **model-agnostic, modular AI Engineering OS** for coordinating AI-assisted software engineering across models, agents, tools, memory, verification, repositories, Git/GitHub, MCP servers, local execution, project templates, policy/audit boundaries, and future providers.

The original repository goal states that models and tools should be replaceable through adapter boundaries rather than being hard-wired into the orchestration core.

### Core product problem

Modern coding agents are strong at local implementation but weak as project authority over long-running work. Typical failure modes AEOS is designed to prevent:

- context loss across long projects and agent restarts;
- a model claiming work is complete when requirements are only partially accounted for;
- duplicated work after ambiguous failures;
- unsafe retries after process/provider uncertainty;
- model output being treated as permission, policy, routing, verification, or completion authority;
- accidental writes outside declared file/task scope;
- lack of durable evidence after terminal/session loss;
- tool/provider lock-in;
- inability for another agent to continue without the previous conversation.

### Intended end-state

The canonical architecture target is:

```text
Project brief
    ↓
AEOS requirements / task graph
    ↓
AEOS orchestration authority
    ↓
Planner / orchestrator adapter (Codex is current target)
    ↓
AEOS validates route / permissions / policy / lifecycle
    ↓
Worker adapter (Claude Code is current primary worker target)
    ↓
AEOS durable evidence / accounting / verifier / completion gate
```

AEOS is the authority. Models are replaceable participants.

---

## 2. Non-negotiable authority invariants

### AEOS owns authoritative state

AEOS owns or must own:

- task identity and lifecycle;
- requirement/work accounting;
- invocation identity and revision;
- idempotency / duplicate suppression;
- policy and permission facts;
- audit state;
- routing authorization;
- retry authorization;
- verifier state;
- completion state.

A model or worker may propose, report, or produce evidence, but cannot grant itself authority.

### Canonical completion invariant

Example:

```text
Expected = 400
Accounted = 20
Remaining = 380
```

Even if a model reports “everything is complete”:

```text
TaskComplete = false
VerifierSatisfied = false
CompletionGateSatisfied = false
```

This principle has been intentionally preserved through worker, routing, invocation, mutation, and orchestration work.

### Failure semantics

- No blind retry after ambiguous launch/provider state.
- `outcome_unknown` is a real terminal safety condition until reconciled.
- A consumed invocation is historical authority and is not reset for convenience.
- Historical failed canaries are evidence, not reusable execution slots.
- Strict validators are not weakened merely to make a canary pass; fix the producer.

### Critical defect precedence

A real P0 or release-blocking P1 defect on an AEOS critical authority boundary — concurrency,
locking, idempotency, invocation identity, durable state, persistence, revision guards, state
machines, completion authority, accounting authority, retry/recovery, policy/permission, security,
audit/provenance — outranks dependent roadmap work.

Such a defect is never silently deferred as out-of-scope. It gets its own GitHub Issue, a durable
blocker/dependency link to the source task, and matching state in both ledgers. Dependent tasks do
not close until it is implemented, tested, independently reviewed and integrated. Severity is
lowered only on evidence, never to keep moving. Non-blocking P2/P3 findings are filed and do not
stop the roadmap.

This became policy after TASK-0328 review surfaced a duplicate-dispatch hole in
`updateTaskExecutionInvocation`: the caller that lost the lock race deleted the winner's lock file,
admitting a third caller into the same critical section. The existing tests could not see it,
because the atomic rename left the file structurally consistent.

### IMPLEMENTED is not INTEGRATED

Two distinct durable states:

- `IMPLEMENTED_AWAITING_INTEGRATION` — acceptance criteria met, tests pass, independent review
  passed, commit pushed, but the commit is not reachable from the canonical default branch.
- COMPLETE/Tamamlandı — the final reviewed commit **is** reachable from the canonical default
  branch, proven by `git merge-base --is-ancestor <SHA> origin/<default>` exiting 0.

Passing tests on a task branch does not complete a task. Neither does a review pass, a push, or a
closed issue. An issue closed without canonical integration evidence is a wrong durable state.

### Canonical integration checkpoint

The canonical/default branch is verified from the remote each session, never assumed from a
document. After a critical/P0 authority task receives final REVIEW PASS, the integration checkpoint
runs before the next critical task is dispatched.

Critical completed work must not accumulate indefinitely off the canonical branch. Long-lived task
branches must not become permanent shadow-mains, and if commits for tasks already declared complete
sit ahead of the canonical branch, next-task dispatch is blocked until they are integrated
(`INTEGRATION_REQUIRED`).

The rule exists because TASK-0324 through TASK-0327 were each individually closed out correctly —
issues closed, Notion rows set to Tamamlandı — while all seven of their commits lived only on
`task/0324-fresh-canary`, ahead of `origin/master` and reachable from nothing canonical. Each
closeout looked right; the aggregate was a shadow-main that no rule then forbade.

**Current recovery chain (snapshot of state, not a permanent queue):**

```text
GitHub #77  →  TASK-0328 / Issue #8  →  canonical integration checkpoint  →  TASK-0329
```

The two rules above are permanent. That chain is the recovery state at the time this section was
written; current GitHub + Notion state always wins over it.

### Provider / cloud boundary

AEOS mainline remains model-agnostic and cloud-provider-independent.

Do not add AWS / Bedrock / S3 / IAM / Cloudflare / Azure / GCP as a required mainline dependency unless the user explicitly approves that product direction.

A historical AWS/Bedrock direction was explored and then deliberately removed from the required mainline. Provider-neutral dispatch, idempotency, recovery, replay safety, and generic adapter contracts were retained.

---

## 3. Development operating model

### Original development style

The project began with very small isolated Codex tasks. `AGENTS.md` still reflects the original compact rule set: read project context first, do not broad-load docs, do not modify unrelated files, avoid destructive work, stop after the assigned task, and return compact handoff.

### Current operating model

Development has matured to a durable multi-agent workflow:

1. Git repository + GitHub Issues are the development source of truth.
2. `PROJECT_CONTEXT.md` carries current repo/task state.
3. `docs/ai/AEOS_CANONICAL_PROJECT_MEMORY.md` carries cross-agent historical memory.
4. `ops/handoffs/*` carries current operational handoff state.
5. `.aeos/` is runtime authority/state and is intentionally excluded from Git.
6. Codebase Memory MCP is the first repository-intelligence layer.
7. Models use targeted source reads after graph/search narrowing.

### Temporary Claude-primary mode

Because Codex quota can become constrained, development continuity may temporarily use:

```text
AEOS authority
    ↓
Claude Code temporary primary execution orchestrator
    ↓
Fresh/bounded Claude implementer(s)
    ↓
Fresh independent Claude reviewer for critical work
    ↓
Tests / GitHub / durable evidence
```

This is **not** a permanent architecture change. When Codex capacity returns, the target returns to Codex planner/orchestrator + AEOS route authority + Claude worker.

For P0 / architecture / security / permission / policy / audit / filesystem / runner / adapter boundaries, implementer and reviewer contexts must be separated.

---

## 4. Developer Working Kit / acceleration rules

AEOS follows the Developer Working Kit and AEOS Developer Acceleration Stack.

### Repository understanding

Priority:

1. **Codebase Memory MCP first** — persistent repo/domain intelligence.
2. `rg` for literal/string search.
3. `ast-grep` for structural search/refactor.
4. direct exact source reads only after narrowing.
5. broad repository scan only with a proven reason.

Do not add a second always-on generic repo-memory MCP.

### Context/output discipline

- CLI-first where practical.
- MCP/tool schemas are not preloaded “just in case”.
- Progressive disclosure / lazy-load skills.
- Heavy test/git/scanner output should be bounded/summarized, not pasted raw into model context.
- RTK/head/tail/structured JSON summaries for high-volume CLI output.

### Tool roles

- **Codebase Memory MCP:** primary repository semantic memory/discovery.
- **Superpowers:** workflow/methodology skill layer; on-demand/progressive disclosure.
- **Context7:** official library/API docs on-demand.
- **Repomix:** bounded repo snapshot/package for handoff when needed.
- **Scrapling:** web research/extraction on-demand.
- **ast-grep:** structural search and reviewed codemod.
- **mise:** runtime/tool/task reproducibility where useful.
- **Trivy:** vulnerability/misconfiguration/SBOM/security baseline.
- **Gitleaks:** quick secret gate where useful.
- **Knip:** TS/JS unused dependency/export report-first analysis.
- **Turborepo:** only if benchmark proves meaningful value; do not redesign the repo just to use it.

### Tool freshness policy

Developer Working Kit policy distinguishes:

- core AI CLI/apps: stability/soak policy;
- third-party MCP/skills: freshness gate based on meaningful recent maintenance;
- new MCP/skill is not automatically added without approval.

---

## 5. Model policy

### Codex

Standing AEOS development policy at handoff time:

- **GPT-5.5 Medium:** routine docs/contracts/examples/smoke.
- **GPT-5.5 High:** critical logic, architecture, safety/security, cross-repo audit, CLI/filesystem/runner/policy/audit/adapter boundaries.
- Do not move AEOS development to GPT-5.6 without explicit user approval.
- Do not lower effort when error risk is high merely to save tokens.

### Claude

Claude Code is the current primary implementation worker and temporary primary orchestrator when Codex quota requires continuity.

Critical work requires independent reviewer separation.

---

## 6. Codebase Memory MCP integration

AEOS repository was integrated with `DeusData/codebase-memory-mcp` as the default repo-intelligence layer.

Known integration principles:

- project graph is for discovery/context optimization;
- Git/source remains implementation truth;
- AEOS runtime state remains execution authority;
- CBM is not project/task/decision authority;
- do not use CBM `manage_adr` as an implicit architecture decision writer;
- broad file-system scans are not default.

The intended mental model is:

```text
AGENTS.md          = compact standing execution rules
PROJECT_CONTEXT.md = current task / project state
CBM                = repository graph / discovery / context reduction
Git + source       = implementation truth
AEOS state         = runtime authority
GitHub Issues      = durable development task queue
```

---

## 7. Early planning and bootstrap history

The repository started with planning artifacts before code.

Confirmed early artifacts included:

- `PROJECT_CONTEXT.md`
- `README.md`
- `docs/`
- `TASKS/`
- `brain/*` memory templates
- project template placeholders
- task contract
- memory schema
- package architecture
- adapter contracts
- policy/permission model
- audit log format
- project template spec
- implementation plan
- runtime decision

### Confirmed early task records

The following early task IDs are present in the prior project record and/or implementation plan:

- **TASK-0003** — memory schema.
- **TASK-0004** — memory templates.
- **TASK-0005** — CLI command map.
- **TASK-0006** — package architecture.
- **TASK-0007** — adapter contracts.
- **TASK-0008** — policy / permission model.
- **TASK-0009** — audit log format.
- **TASK-0011** — project template specification.
- **TASK-0012** — implementation plan / initial backlog.
- **TASK-0013** — runtime/package-manager decision.

TASK-0010 and the exact final meaning of TASK-0001/TASK-0002 must be reconstructed from Git evidence before assigning a definitive title. Do not invent them.

### Runtime decision

The selected runtime direction became TypeScript / Node with pnpm workspace-based development. The project later standardized around Node LTS + pnpm workspace conventions.

---

## 8. Initial implementation plan: TASK-0013 → TASK-0032

The initial implementation plan explicitly defined the following sequence. These entries describe the original planned intent; later source/commit evidence remains authoritative for final completion mapping.

- **TASK-0013** — decide runtime and package manager.
- **TASK-0014** — create runtime scaffold plan.
- **TASK-0015** — create minimal repository scaffold.
- **TASK-0016** — add base static verification command.
- **TASK-0017** — define shared adapter result types.
- **TASK-0018** — define policy decision types.
- **TASK-0019** — define verification report types.
- **TASK-0020** — define task contract parser.
- **TASK-0021** — implement project context reader.
- **TASK-0022** — implement scoped context bundle builder.
- **TASK-0023** — implement file scope validator.
- **TASK-0024** — implement basic policy classifier.
- **TASK-0025** — implement local audit event writer.
- **TASK-0026** — implement verification existence checks.
- **TASK-0027** — implement documentation format checks.
- **TASK-0028** — implement memory entry validation.
- **TASK-0029** — implement local memory read/write adapter.
- **TASK-0030** — implement CLI status command.
- **TASK-0031** — implement CLI context command.
- **TASK-0032** — implement CLI verify command.

The initial v0 non-goals intentionally excluded autonomous multi-agent orchestration, production deployment, broad scanning, raw conversation memory, destructive automation, and provider-specific SDK dependence.

---

## 9. Product evolution before the worker-runtime phase

The project progressed from scaffolding into a functioning local engineering OS foundation.

Major product milestones before TASK-0312 included:

- CLI MVP;
- Memory MVP;
- Project MVP;
- Template MVP;
- init pipeline;
- deterministic project profile/intelligence;
- deterministic template recommendation;
- agentic task lifecycle;
- agentic coverage verifier;
- runner/planner boundaries;
- task validation / plan / dry-run;
- persisted task state;
- read-only task status / resume preview;
- revision-guarded state transitions;
- execution attempt prepare/start;
- invocation identity and idempotency;
- duplicate suppression;
- `outcome_unknown` and reconciliation;
- provider reconciliation contracts;
- vendor-neutral execution adapter contract;
- permission/policy gate;
- durable operator policy approval proof;
- credential reference/resolution boundaries;
- durable execution audit;
- production dispatch authority;
- provider-neutral recovery/conformance;
- preservation of incomplete accounting even after worker/model success claims.

### Agentic lifecycle checkpoint

**TASK-0185 / TASK-0186** represent the remembered checkpoint after Template Recommend MVP where the project moved into the agentic task lifecycle line. If lifecycle reliability regresses badly, this is a known decision checkpoint for architectural reassessment.

---

## 10. Task-plan / mapping / persistence line

`TASKS/backlog.md`, Git history, and `PROJECT_CONTEXT.md` contain extensive planning and execution history through the 02xx range.

Important caution: the backlog contains historical plans and some IDs were repurposed or superseded by later executed task naming. **Do not treat backlog text alone as final completion authority.** Reconstruction Issue #2 exists to resolve final ID → implementation evidence mapping.

`PROJECT_CONTEXT.md` currently provides authoritative “recent completed” summaries for **TASK-0249 through TASK-0323**.

### Confirmed recent completed task summaries from current project context

- **TASK-0249** — task contract mapping logic smoke tests.
- **TASK-0250** — task contract mapping safety review.
- **TASK-0251** — task contract mapping documentation.
- **TASK-0252** — task contract mapping final safety review.
- **TASK-0253** — task plan file mapping to planner design/wiring.
- **TASK-0254** — task plan file planner wiring contracts.
- **TASK-0255** — task plan file planner wiring examples.
- **TASK-0256** — task plan file planner wiring smoke tests.
- **TASK-0257** — task plan file planner wiring logic.
- **TASK-0258** — task plan file planner wiring logic examples.
- **TASK-0259** — task plan file planner wiring logic smoke tests.
- **TASK-0260** — task plan file planner wiring safety review.
- **TASK-0261** — task plan file planner wiring documentation.
- **TASK-0262** — task plan file planner wiring final safety review.
- **TASK-0263** — CLI task plan parser/mapper/planner integration design.
- **TASK-0264** — CLI task plan planner integration contracts.
- **TASK-0265** — CLI task plan planner integration examples.
- **TASK-0266** — CLI task plan planner integration smoke tests.
- **TASK-0267** — CLI task plan planner integration logic.
- **TASK-0268** — CLI task plan planner integration logic examples.
- **TASK-0269** — CLI task plan planner integration logic smoke tests.
- **TASK-0270** — CLI task plan planner integration safety review.
- **TASK-0271** — CLI task plan planner integration documentation.
- **TASK-0272** — CLI task plan planner integration final safety review.
- **TASK-0273** — CLI task plan command planner integration.
- **TASK-0274** — fix repo/global audit findings for task plan integration.
- **TASK-0275** — post-audit task-plan regression review.
- **TASK-0276** — CLI task dry-run integration design/implementation line.
- **TASK-0277** — task dry-run targeted regression/safety review.
- **TASK-0278** — task-state persistence MVP foundation.
- **TASK-0279** — task-state persistence safety/regression + resume-handoff foundation.
- **TASK-0280** — read-only task status and resume-preview CLI.
- **TASK-0281** — explicit task-state initialization/persistence CLI.
- **TASK-0282** — revision-guarded task-state transition/update foundation.
- **TASK-0283** — read-only task-state transition preview CLI.
- **TASK-0284** — explicit revision-guarded transition apply CLI.
- **TASK-0285** — authoritative execution-attempt/event state foundation.
- **TASK-0286** — execution-attempt safety review + read-only preparation preview.
- **TASK-0287** — explicit execution-attempt persistence/preparation apply CLI.
- **TASK-0288** — execution-attempt persistence safety review + execution-start authorization.
- **TASK-0289** — prepared → started execution-attempt transition apply without adapter execution.
- **TASK-0290** — controlled execution invocation boundary with injected TEST/no-op executor.
- **TASK-0291** — persisted invocation/idempotency record foundation.
- **TASK-0292** — invocation persistence safety review + read-only status CLI.
- **TASK-0293** — invocation reconciliation/recovery foundation for invoking/outcome_unknown.
- **TASK-0294** — read-only reconciliation preview CLI + provider capability inspection model.
- **TASK-0295** — typed reconciliation apply foundation without provider calls/retry.
- **TASK-0296** — provider reconciliation adapter contract + TEST evidence bridge.
- **TASK-0297** — reconciliation bridge safety review + production adapter readiness gate.
- **TASK-0298** — vendor-neutral production execution adapter contract + TEST conformance harness.
- **TASK-0299** — adapter permission/policy execution gate foundation.
- **TASK-0300** — credential reference resolution boundary with TEST secret provider.
- **TASK-0301** — durable execution audit runtime foundation.
- **TASK-0302** — durable production policy approval proof runtime foundation.
- **TASK-0303** — production-call blocker readiness review after policy/credential/audit foundations.
- **TASK-0304** — production credential provider boundary while production execution remains disabled.
- **TASK-0305** — first production execution adapter vertical slice with real calls disabled.
- **TASK-0306** — provider idempotency/status/result-replay crash conformance harness with TEST transport.
- **TASK-0307** — controlled production dispatch authority/gate with real provider execution disabled.
- **TASK-0308** — one-shot operator dispatch CLI boundary; real calls still controlled.
- **TASK-0309** — provider-specific recovery conformance review; exposed inability to prove safe create replay for OpenAI Responses after certain crash windows.
- **TASK-0310** — recovery strategy decision; provider-specific direction superseded by provider/model-agnostic mainline.
- **TASK-0311** — provider recovery safety regression; provider-specific fixture replaced by provider-neutral deterministic fixture.

---

## 11. Worker-runtime and real execution phase: TASK-0312 → TASK-0323

### TASK-0312 — Generic worker runtime

Created a generic worker adapter boundary for `generic`, `codex`, and `claude_code` families.

Key principles:

- worker identity/selection system-owned;
- capabilities explicit but not equivalent to permission;
- worker output is evidence only;
- deterministic TEST workers only at this stage;
- 400/20 incomplete accounting preserved.

### TASK-0313 — Codex worker adapter boundary

Added concrete TEST-only Codex adapter boundary designed around noninteractive `codex exec` rather than terminal UI automation.

System-owned executable/workspace/model/effort, argv-based execution surface, dangerous overrides rejected.

No real Codex call yet.

### TASK-0314 — Controlled local-process readiness gate

Introduced fail-closed readiness/authorization binding exact task/revision/attempt/invocation/idempotency/work/batch/worker/executable/workspace.

No child process executed yet.

### TASK-0315 — Claude Code adapter boundary

Added Claude-specific adapter using the same shared process-authority model as Codex.

No real Claude process yet.

### TASK-0316 — Shared real local process runtime

Implemented the shared process execution boundary using benign local test processes.

Key behaviors:

- durable launch authority consumed before spawn;
- `invoking → outcome_unknown` protection before uncertain launch window;
- duplicate/stale/outcome_unknown relaunch blocks;
- `spawn(..., { shell:false })`;
- exact executable and canonical cwd;
- bounded environment rather than full parent environment;
- bounded stdout/stderr;
- timeout / termination handling;
- known vs unknown process outcomes;
- persistence failure after launch requires reconciliation, not replay.

### TASK-0317 — First real Claude read-only canary

Detected host Claude Code executable and built a controlled read-only canary profile.

Important real result: **first AEOS-controlled real Claude Code read-only worker call succeeded**.

Safety remained closed:

- repository writes disabled;
- shell disabled;
- work/task completion false;
- verifier false;
- completion authority false.

#### TASK-0317 auth false-negative incident

Codex development sandbox initially reported Claude logged out because macOS Keychain visibility differed from the host terminal.

Fix: host runtime performs Claude auth preflight. Sandbox auth is not host credential authority.

#### TASK-0317 ordering/reporting incident

An early canary failed workspace authority validation but invocation state had already moved too far and reporting claimed it had not changed.

Fix: static workspace/profile/auth checks moved before irreversible invocation transition, and reporting was corrected.

Historical bad invocation remains historical and reconciliation-required; it was not silently reset.

### TASK-0318 — Isolated mutation workspace

Added system-created temporary isolated workspace for write-capable workers.

Scope controls:

- explicit allowed paths;
- create/update limits;
- deletion disabled;
- protected `.git`, `.aeos`, `.codex`, `AGENTS.md`, `PROJECT_CONTEXT.md`;
- traversal/absolute/symlink escape blocked;
- AEOS captures before/after evidence; worker self-report is not authority;
- primary repo apply remains closed.

Known commit: `7e9111a feat(worker): add isolated mutation workspace authority`.

### TASK-0319 — First real Claude isolated write + durable mutation evidence

Real Claude mutated only the controlled canary file in the isolated workspace.

A critical durability gap was then found: mutation evidence initially existed only in terminal output.

Fix added durable state under `.aeos/state/mutation-evidence/...` plus bounded artifact, read-back verification, exact invocation binding, and apply eligibility rules.

Historical non-durable invocation was not retrofitted as apply-eligible.

### TASK-0320 — TEST primary apply authority

Built durable single-file TEST primary-apply authority.

Important semantics:

- durable evidence/artifact loaded from AEOS state, not caller claims;
- stale baseline check;
- protected path checks;
- durable apply reservation before mutation;
- atomic write/rename flow;
- after-digest verification;
- replay-safe lifecycle;
- crash recovery only when current target digest proves a unique safe state;
- no blind reapply on ambiguity.

### TASK-0321 — First real controlled primary apply canary

Executed one sacrificial real primary-workspace create-file canary.

Result proved exact bytes/digest/evidence binding and one-shot replay protection.

General primary apply and automatic patch apply remained disabled.

Known commit: `3e20f69 feat(worker): add controlled primary apply canary boundary`.

### TASK-0322 — Worker routing authority

Created deterministic routing authority where planner/model output is **proposal only** and AEOS creates the authoritative route.

Hostile proposal fields such as completion/verification/retry/permission/policy/invoke/cwd/executable/revision override do not become authority.

Claude self-routing blocked. Unknown/stale/conflicting workers blocked.

### TASK-0323 — Route → worker invocation orchestration lifecycle

Connected an authorized route to started attempt + exact durable invocation/idempotency + concrete TEST worker adapter + normalized persisted outcome.

Covered returned / failed / timeout / malformed / outcome_unknown and duplicate suppression.

Still no real model/process/apply loop.

Known commit: `a61ac82 feat(core): add worker orchestration lifecycle`.

---

## 12. TASK-0324 — Real Codex planner → AEOS route → real Claude read-only worker

TASK-0324 is the current active milestone and GitHub Issue #1.

Goal: prove one real, bounded, durable, fail-closed hop:

```text
Real Codex planner
    ↓
Schema-backed routing proposal
    ↓
AEOS route authorization
    ↓
Real Claude read-only worker
    ↓
Durable worker outcome
```

No automatic loop, primary apply, verifier satisfaction, or task completion is granted by this milestone.

Initial implementation commit: `9d26794 feat(core): add two-model orchestration canary`.

### TASK-0324 fix / incident history

The milestone intentionally exposed integration defects one by one; each was fixed without relaxing AEOS authority.

#### 1. Codex auth false-negative

Sandbox-derived auth state was unreliable for host execution.

Fix: trusted host `codex login status`; exit 0 means authenticated. Full parent env is not inherited.

#### 2. Planner outcome persistence failure

A real Codex planner launch crossed the launch boundary, but produced failure diagnostics rejected by strict invocation persistence.

Historical invocation became `outcome_unknown` / reconciliation-required and was never replayed.

Fix: normalize producer diagnostics to the existing strict contract; do not weaken persistence validator.

#### 3. Invalid policy requirement metadata

TASK-0324 generated a composite `policyGateId` longer than the strict safe-id bound.

Failure occurred before model call/state consumption.

Fix: deterministic bounded system-owned policy metadata, phase-specific binding, explicit `required=false` semantics.

Important rule: “policy proof not required” does **not** mean “policy metadata absent.”

#### 4. Planner route handoff investigation

A real planner process returned nonzero before structured proposal generation, so no route was attempted. A reporting bug also swallowed useful planner failure issues.

Fix: preserve bounded failure issues and continue fail-closed.

#### 5. Codex host environment mismatch

Auth preflight and actual `codex exec` did not initially receive equivalent bounded host runtime context.

Fix: bounded host environment including usable system-owned `PATH`; still no full `process.env` inheritance.

#### 6. Unsupported `codex exec` flags

Historical argv still used unsupported flags such as old reasoning/approval CLI forms.

Fix: static no-model contract preflight against installed `codex exec --help`; unsupported flags removed.

#### 7. Shared runtime stale approval binding

After command-surface cleanup, a lower shared runtime layer still expected the removed approval argument and consumed authority before rejecting launch.

Fix: prepared vs consumed semantics and launch-boundary contract aligned. First valid operator run must not appear already-consumed merely because preparation exists.

#### 8. Stale planner model profile

Real TASK-0324 planner profile was still `gpt-5-codex / minimal` while AEOS development policy expected `gpt-5.5 / high`.

Fix: TASK-0324 system-owned planner profile now uses `gpt-5.5` and `high` reasoning through a supported configuration override. Task/model output cannot override it.

#### 9. Exit=1 diagnostics were not durable enough

A real Codex process exited 1, but only generic termination data survived.

Fix: durable bounded process diagnostics including exit/termination/stdin facts and sanitized stderr evidence.

#### 10. Stderr head-only truncation

Later diagnostics proved stdin write/close, workdir, model, provider, sandbox, and reasoning profile were correct, but stderr excerpt preserved only Codex startup banner; causal tail could be lost.

Fix: bounded secret-safe `stderrHead + stderrTail + stderrTerminal` strategy with deterministic long-stderr regression.

#### 11. Temporary provider reachability failure

A diagnostic run temporarily reported Codex provider HTTP reachability failure while model catalog still exposed GPT-5.5.

Subsequent normal-host diagnostics contradicted it:

- `codex doctor --json` overall status OK;
- provider HTTP reachability OK;
- WebSocket handshake OK;
- ChatGPT backend reachable;
- both IPv4 and IPv6 curl paths reached backend and received HTTP responses;
- DNS resolved both IPv4/IPv6.

Current classification: **transient provider/network failure, not a persistent AEOS defect**.

Do not add IPv4 forcing, DNS hacks, proxy logic, provider changes, or networking workarounds without new evidence.

### Current TASK-0324 next action

All prior canaries are historical and must not be reused.

Prepare one completely fresh canary through normal AEOS APIs, then read back and prove:

- orchestration prepared = true;
- orchestration consumed = false;
- planner reserved / revision 1;
- planner one-shot unconsumed;
- worker reserved / revision 1;
- worker one-shot unconsumed;
- route absent;
- planner outcome absent;
- worker outcome absent;
- reconciliationRequired = false.

Only then execute exactly once.

TASK-0324 completes only after durable closeout proves:

- real Codex planner returned once;
- schema-valid proposal;
- AEOS-authorized route;
- selected worker `claude_code`;
- real Claude read-only worker returned once;
- exact planner/route/worker binding read back;
- replay blocked;
- reconciliation false;
- repository write false;
- shell false;
- primary apply false;
- automatic loop false;
- completion authority false.

---

## 13. GitHub migration and source-of-truth transition

AEOS was migrated from local-only development to private GitHub repository:

**Repository:** `skdursun/aeos`  
**Default branch:** `master`

Migration checkpoint:

- `63d5c5900c3b78db1f57cb52e742e70a72d01bc3` — checkpoint before GitHub / Claude handoff.

The migration intentionally excluded:

- `.aeos/` runtime state;
- local `.codex/config.toml` modifications.

The GitHub connector later added durable handoff/tooling files and the local clone fast-forwarded to remote.

Current canonical control Issues:

- **#1** — TASK-0324 real two-model one-hop closeout.
- **#2** — TASK-0001 → TASK-03xx historical reconstruction.
- **#3** — complete product-ready roadmap.
- **#4** — GitHub source-of-truth + Claude temporary-primary handoff.

Conversation history is no longer required for basic project continuation.

---

## 14. Historical task reconstruction rule

The user requires the full task history from TASK-0001 through current 03xx to be recorded in Notion and GitHub without skipping IDs.

However, **unknown task meanings must never be hallucinated.**

Each historical task ID must eventually be classified as one of:

- VERIFIED;
- PARTIAL_EVIDENCE;
- RECONSTRUCTION_PENDING;
- NOT_USED / SUPERSEDED, if evidence proves it.

Evidence order:

1. task-specific source/docs;
2. `PROJECT_CONTEXT.md` completed-task record;
3. Git commit history and diff;
4. `TASKS/backlog.md` as historical planning evidence;
5. smoke/verify/test marker evidence;
6. Notion explanatory history as secondary context.

Important: `TASKS/backlog.md` includes overlapping/superseded plans. It is not by itself final execution truth.

GitHub Issue #2 owns this reconstruction program.

---

## 15. Future product-ready program

GitHub Issue #3 owns the roadmap from the current milestone to a product that can reasonably be called ready for real use / distribution / sale.

The roadmap must not artificially minimize task count. Required capability areas include at least:

- bounded multi-step orchestration;
- authoritative work accounting / requirement progress;
- verifier / completion gates;
- safe mutation / primary apply / rollback;
- retry / idempotency / reconciliation;
- policy / permissions / approvals;
- audit / evidence / provenance;
- model/provider/worker adapters;
- capability registry;
- memory / project intelligence / templates;
- CLI UX and stable machine-readable output;
- TUI/operator control plane;
- Watch Tower / agent health / project health;
- logs / metrics / traces / diagnostics;
- context/token/cost budgets;
- performance benchmarking;
- security hardening;
- secrets/privacy/data handling;
- SBOM/supply chain;
- Git/GitHub/worktree workflow;
- CI/CD/release gates;
- packaging / installer;
- update / rollback / migration;
- uninstall / cleanup;
- macOS / Linux / Windows support;
- backup / restore / disaster recovery;
- configuration schema/versioning;
- plugin/skill/tool adapter lifecycle;
- Developer Working Kit integration;
- documentation/tutorials/examples/troubleshooting;
- dogfood / alpha / beta / RC / GA;
- support diagnostics / issue templates;
- changelog / compatibility policy.

Product-ready definition:

> A new user/team can install AEOS on a clean machine, connect a project, select/replace workers, safely orchestrate tasks, observe what happened, recover after failures without losing authority, update/rollback the system, and operate it from durable documentation rather than hidden chat history.

---

## 16. Current repository / handoff state

At the time this memory was created:

- private GitHub repo exists and is authoritative for development history;
- local `master` tracks `origin/master`;
- `.aeos/` remains local runtime state and is ignored by Git;
- local `.codex/config.toml` may remain intentionally dirty/local;
- TASK-0324 is the active engineering milestone;
- historical reconstruction and product-ready roadmap run as separate control programs;
- Claude temporary-primary mode is permitted because Codex quota is constrained;
- current host Codex diagnostics do not show a persistent network/provider blocker.

---

## 17. Fresh agent mandatory read order

Before implementation, a replacement agent should read:

1. `AGENTS.md`
2. `PROJECT_CONTEXT.md`
3. `docs/ai/AEOS_CANONICAL_PROJECT_MEMORY.md`
4. `docs/ai/DEVELOPER_ACCELERATION_STACK.md`
5. `ops/handoffs/codex-to-claude-handoff.md`
6. `ops/handoffs/CLAUDE_START_PROMPT.md` if Claude is taking over
7. active GitHub Issue
8. then use CBM-first targeted code discovery

A fresh agent must not assume previous chat memory.

---

## 18. What a replacement agent must never silently do

- mark a task complete from model self-report;
- reset consumed invocations to make a test easier;
- blindly retry an unknown outcome;
- manually rewrite `.aeos` state;
- treat planner proposal as route authority;
- treat worker claim as verifier/completion authority;
- add cloud-provider-specific mainline infrastructure without explicit approval;
- change the Codex standing model policy without explicit approval;
- broad-scan the repository by default;
- preload all MCP/skills into context;
- let the same critical Claude context both implement and independently approve its own work;
- invent historical task meanings when source evidence is missing.

---

## 19. Known important commits

These commits are useful reconstruction anchors:

- `7e9111a` — isolated mutation workspace authority (TASK-0318).
- `3e20f69` — controlled primary apply canary boundary (TASK-0321).
- `a61ac82` — worker orchestration lifecycle (TASK-0323).
- `9d26794` — two-model orchestration canary initial implementation (TASK-0324).
- `63d5c59` — GitHub / Claude handoff migration checkpoint.
- later GitHub handoff/tooling commits add `docs/ai/DEVELOPER_ACCELERATION_STACK.md` and `ops/handoffs/*`.

Git history remains the final authority for exact commit SHA/title mapping.

---

## 20. Current next safe action

**Do not start a different product task.**

The next engineering action remains:

1. read GitHub Issue #1;
2. prepare one fresh TASK-0324 canary through normal AEOS APIs;
3. read back pristine authority;
4. execute exactly once only if pristine;
5. durable closeout;
6. only after TASK-0324 completion select the next dependency-ready issue.

In parallel, non-product-control work may continue on:

- Issue #2 — historical task reconstruction;
- Issue #3 — full product-ready roadmap;
- Issue #4 — handoff/source-of-truth operational completion.

These control programs must not mutate TASK-0324 runtime authority by hand.
