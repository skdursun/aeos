# TASK-0324 Fresh Canary — Preflight Burn-Risk Audit

Scope: read-only audit of the deterministic failure surface that could burn a
fresh, never-used "real Codex planner -> AEOS route -> real Claude read-only
worker" canary identity. Host, source, and `.aeos` state were inspected only;
nothing was executed or modified.

Host fact checked live: `claude --version` -> `2.1.233 (Claude Code)`, binary at
`$HOME/.local/bin/claude` (verified `ls -la`, resolves via symlink to
`$HOME/.local/share/claude/versions/2.1.233`).
*(Host-layout paths sanitized in prose; exact literals are immaterial to the finding.)*

---

## 1. Executable binding — is "2.1.229" a real version gate?

**Verdict: METADATA_ONLY (safe).**

`packages/core/src/task-execution-two-model-canary.ts:276-280`:
```
const trustedCodexExecutablePath = "/Users/magnero/.local/bin/codex";
const trustedCodexExecutableRef = "system:trusted-local-codex-exec";
const trustedClaudeCodeExecutablePath = "/Users/magnero/.local/bin/claude";
const trustedClaudeCodeExecutableRef =
  "system:trusted-local-claude-code-2.1.229";
```
The identical two constants are re-declared in `apps/cli/src/commands.ts:5620-5622`
(`trustedClaudeCodeExecutablePath`, `trustedClaudeCodeExecutableRef`).

The only place `executableRef` is checked at runtime is
`executableBindingReady()` in
`packages/core/src/task-execution-local-worker-process.ts:1037-1118`, final
return (approx. line 1111-1117):
```
return (
  input.executable.authority === "system" &&
  executionModeReady &&
  input.executable.executableRef === input.authority.executableRef &&
  input.executable.executableKind === input.authority.executableKind &&
  isAbsolute(input.executable.executablePath) &&
  !input.executable.executablePath.includes("\0")
);
```
This is a **string-equality comparison between two occurrences of the same
hardcoded literal** — the `executable.executableRef` passed in by the caller
(`createClaudeConfiguration()` / the write/read canary CLI handlers, all using
`trustedClaudeCodeExecutableRef`) versus the `authority.executableRef` produced
earlier in the same call chain from that same constant. Neither operand is
ever derived from an actual `claude --version` invocation, a package.json
read, or a binary hash. `isAbsolute(...)` and a null-byte check are the only
real checks against the actual path string; the path's *content* is never
compared to a live version.

Confirmed by reading `runTaskExecutionClaudeCodeAuthPreflight`
(`packages/core/src/task-execution-claude-code-auth-preflight.ts:177-234`): it
runs `argv: ["auth", "status"]` against `input.executablePath` and only checks
`loggedIn` from stdout (`parseLoggedIn`) — no version subcommand, no version
string is ever read or compared anywhere in the codex/claude preflight or
binding code (grep of `--version` / `execFile.*version` under
`packages/core/src/task-execution-*` returned zero hits).

**Conclusion:** the live host running Claude Code 2.1.233 against a binding
literal labeled "2.1.229" is **not** a burn risk — the label is decorative
metadata baked into an opaque ref string, never parsed or version-compared.
The historical `task_execution_local_worker_runtime_executable_mismatch`
failures (see prior canary "execfix" family) can only come from a *different*
field going out of sync — most plausibly `executionModeReady`'s argv-shape
checks (exact flags/positions in `input.authority.argv`, e.g. `--tools` /
`Read` / `--permission-mode` / `plan` for Claude, or `--model gpt-5.5` / the
literal `-c model_reasoning_effort="high"` token for Codex) failing to match
what the process-authorization step actually built, or
`input.executable.executableRef !== input.authority.executableRef` diverging
because the *authority* side was built from a stale/different constant
snapshot than the *executable* side (both currently read from the same source
constant, so today they cannot diverge without a code edit — but this is the
structural risk to guard if IMPLEMENTER-A's concurrent edit touches either
constant only in one file).

---

## 2. Ordering of one-shot authority consumption — ranked post-consumption risk

Two consumption points exist per worker (planner and Claude worker each go
through both):

**Consumption A — "reserved -> invoking"** (`enter_invocation` intent),
`packages/core/src/task-execution-invocation-record.ts:930-953` implements the
transition; called for the planner at
`task-execution-two-model-canary.ts:1984-1992` and for the Claude worker at
`task-execution-two-model-canary.ts:2335-2343`.

**Consumption B — "invoking -> outcome_unknown"** (`mark_outcome_unknown`
reservation, immediately before the actual child-process spawn), inside
`executeTaskExecutionLocalWorkerProcess`,
`packages/core/src/task-execution-local-worker-process.ts:1753-1774` (call),
transition rule at `task-execution-invocation-record.ts:~988-1010` (`invoking`
+ `mark_outcome_unknown`).

### Everything that runs AFTER Consumption A (planner), in order, ranked by burn risk:

1. **HIGHEST — `executableBindingReady` / `workspaceBindingReady` /
   `environmentPolicyReady`** inside `executeTaskExecutionLocalWorkerProcess`
   (`task-execution-local-worker-process.ts:1697-1732`), called via
   `authorizeTaskExecutionWorkerProcess` -> `executeTaskExecutionLocalWorkerProcess`
   at `task-execution-two-model-canary.ts:2036-2088`. This is the exact
   family that killed the historical "execfix" canary
   (`task_execution_local_worker_runtime_executable_mismatch`). All three
   checks run *after* Consumption A but *before* Consumption B, so a failure
   here burns the identity without ever spawning a process.
   `workspaceBindingReady` (`task-execution-local-worker-process.ts:1120-1140`)
   additionally does a live `realpath()` call on `input.projectRoot` — a
   symlink/mount change between preparation and run is a real, environment-
   dependent burn vector.
2. **HIGH — `authorizeTaskExecutionWorkerProcess` / process-gate construction**
   (`task-execution-two-model-canary.ts:2036-2059` for planner,
   `evaluateTaskExecutionClaudeCodeWorkerProcessGate` at
   `task-execution-two-model-canary.ts:2350-2367` for the Claude worker) —
   builds the argv/authority object the binding check above validates; any
   drift between this builder and `executableBindingReady`'s expectations
   (e.g. exact `-c model_reasoning_effort="high"` token, `--sandbox
   read-only`, `--output-schema` flag) fails post-consumption.
3. **MEDIUM — `authorityMatchesRecord` / `auditMatchesLaunchAuthority`**
   (checked inside `executeTaskExecutionLocalWorkerProcess`,
   `task-execution-local-worker-process.ts:1678-1696`) — requires exact
   task/revision/attempt/invocation/idempotency/work-binding and a matching
   pre-process dispatch audit event; any timing/ordering bug here is a burn.
4. **MEDIUM — Consumption B itself** (the `mark_outcome_unknown` reservation
   write, `task-execution-local-worker-process.ts:1753-1774`) — a storage
   write failure here (`reservation.ok === false`) also burns without a
   process ever spawning.
5. **LOWER but historically dominant — the actual child-process spawn/exit**
   (`executeBoundedChildProcess`, invoked at
   `task-execution-local-worker-process.ts:~1776-1783`). This is *not* a
   deterministic preflight failure in the traditional sense (it's the real
   external launch), but it is what killed all four most-recent identities
   (`routefix`, `oneshotfix`, `modelfix`, `evidencefix`) via
   `task_execution_codex_worker_process_nonzero_exit` — see Section 10. It
   sits after both consumption points, so once code-level checks 1-4 pass,
   this is the last and, empirically, the actual failure point.

The same ordering repeats for the Claude worker (Consumption A at
`:2342`, gate at `:2350-2367`, `executeTaskExecutionLocalWorkerProcess` at
`:2368-2394`) but in all four inspected failure records the run never reached
this stage — the planner (Codex) always failed first (see Section 9/10), so
worker-side post-consumption risk is currently untested in practice.

---

## 3. Static pre-consumption preflights (confirmed genuinely pre-Consumption-A)

For the planner, all of the following run strictly before
`task-execution-two-model-canary.ts:1991` (`enter_invocation`):

- `plannerGate` permission/policy gate — `:1866` (built earlier, checked at `1866`).
- `plannerRequest` construction — `:1873-1880`.
- `createPlannerConfiguration()` — `:1881`, defined `:1054-1088` (pure object
  construction, no I/O).
- `codexAuth` = `runTaskExecutionCodexAuthPreflight({ executablePath:
  trustedCodexExecutablePath })` — `:1882-1901` (real `codex login status`-style
  check via a bounded child process, per
  `task-execution-codex-auth-preflight.ts`).
- `codexExecPreflight` = `runTaskExecutionCodexExecContractPreflight(...)` —
  `:1906-1954`, checks `executableExists`, `execSurfaceSupported`,
  `expectedFlagsSupported`, `schemaPathValid`, `schemaJsonValid`,
  `cwdGitRepository`, `environmentPolicyValid` (fields visible in the fixture
  branch at `:1922-1930`).
- `preparedPlanner` = `prepareTaskExecutionCodexWorkerInvocation(...)` — `:1955-1974`.
- `plannerAudit` = `appendDispatchAudit(...)` — `:1975-1983`.

For the Claude worker, the mirrored set runs strictly before
`task-execution-two-model-canary.ts:2342` (`enter_invocation`):

- `workerGate` (checked earlier in the route-decision block).
- `workerRequest` — `:2260-2267`.
- `createClaudeConfiguration()` — `:2268`, defined `:1090-1127`.
- `preparedWorker` = `prepareTaskExecutionClaudeCodeWorkerInvocation(...)` —
  `:2269-2279`.
- `claudeAuth` = `runTaskExecutionClaudeCodeAuthPreflight({ executablePath:
  trustedClaudeCodeExecutablePath })` — `:2280-2287` (real `claude auth
  status` check, `task-execution-claude-code-auth-preflight.ts:177-234`).
- `workerAudit` = `appendDispatchAudit(...)` — `:2288-2299`.

All of the above are confirmed pre-consumption: they read/validate config,
run bounded read-only child-process auth checks, or append audit records —
none of them call `updateTaskExecutionInvocation` with `intent: {kind:
"enter_invocation"}`, so none of them can have already burned the identity by
the time they run.

---

## 4. Schema file existence (codexPlannerSchemaPath)

`codexPlannerSchemaPath` (`task-execution-two-model-canary.ts:281-284`):
```
const codexPlannerSchemaPath = resolve(
  dirname(new URL(import.meta.url).pathname),
  "../schemas/codex-planner-routing-proposal-v1.schema.json",
);
```
Resolves relative to the *module's own directory*, one level up, into a
sibling `schemas/` folder. Both source (`packages/core/src/`) and compiled
output (`packages/core/dist/`) are one level below `packages/core/`, so `../schemas`
resolves to the **same physical location** — `packages/core/schemas/` —
regardless of whether the module runs from `src` or `dist`.

Verified on disk: **only one copy exists**, at
`<project-root>/packages/core/schemas/codex-planner-routing-proposal-v1.schema.json`
(2891 bytes, mtime `Aug 14 09:12`). *(Project-root path sanitized in prose.)* There is no `packages/core/dist/schemas/`
directory (confirmed absent), but none is needed — the relative-resolution
math means the single `packages/core/schemas/` copy is reachable from dist
too.

**Verdict: SAFE, not a burn risk.** No missing-schema failure is possible
under the current directory layout, for either a `src`-run or `dist`-run
invocation.

---

## 5. Build freshness

`apps/cli/package.json`: `"main": "./dist/index.js"`, `"bin": {"aeos":
"./dist/index.js"}` — the CLI runs from **compiled `dist`, not `tsx`/ts-node**.
Root `package.json` scripts: `"build": "tsc -b --pretty false"` (a TS project
reference build across the workspace), plus per-package
`core:build`/`cli:build` (`pnpm --filter @aeos/core build`, `pnpm --filter
@aeos/cli build`) and combined `cli:verify` (`pnpm cli:check && pnpm cli:build
&& pnpm cli:smoke`).

**A rebuild is required after any edit to `packages/core/src/**` before the
CLI will observe it.** Exact command: `pnpm build` (root `tsc -b`), or
narrower `pnpm core:build && pnpm cli:build`.

Mtime check performed at audit time (this reflects the state *before*
IMPLEMENTER-A's concurrent edits landed; re-check after their build):
- `packages/core/src/task-execution-two-model-canary.ts` — `Aug 14 16:20:02`
- `packages/core/dist/task-execution-two-model-canary.js` — `Aug 14 16:20:11`
  (built *after* that src edit — dist was fresh at audit time)
- `apps/cli/dist/commands.js` — `Aug 14 16:22:56` (also fresh)
- `apps/cli/dist/index.js` — `Jul 31 11:20:31` (stale relative to the others,
  but `index.js` only does `import { main } from "./commands.js"; main(...)`,
  so it doesn't need to change when `commands.ts` changes — not itself a risk)

**Action item for whoever launches the canary:** re-run `pnpm build` (or at
minimum `pnpm core:build && pnpm cli:build`) immediately before launch, since
IMPLEMENTER-A is actively editing `packages/core/src/task-execution-two-model-canary.ts`,
`packages/core/src/index.ts`, and `apps/cli/src/commands.ts` concurrently with
this audit — do not trust the mtimes above once their edits land.

---

## 6. Planner profile (system-owned, non-overridable)

`createPlannerConfiguration()`, `packages/core/src/task-execution-two-model-canary.ts:1054-1088`:
```
function createPlannerConfiguration(): TaskExecutionCodexWorkerConfiguration {
  return {
    authority: "system",
    ...
    model: {
      authority: "system",
      model: "gpt-5.5",
      reasoningEffort: "high",
    },
    ...
    sandboxMode: "read-only",
    approvalPolicy: "never",
    ...
  };
}
```
- Model: `gpt-5.5` — line 1063 (field) / literal at `model: "gpt-5.5"`.
- Reasoning effort: `"high"` — same block.
- Sandbox: `sandboxMode: "read-only"` — within `:1054-1088`.
- `authority: "system"` on the top-level config *and* on the nested `model`
  object — this is the mechanism that makes these fields non-overridable by
  request/caller input; the type `TaskExecutionCodexWorkerConfiguration`
  requires `authority: "system"` to be trusted by the downstream gate/binding
  checks (`executableBindingReady`, Section 1), and `createPlannerConfiguration`
  is a zero-argument function — nothing external can parameterize it.

This is also enforced at runtime: `executableBindingReady`
(`task-execution-local-worker-process.ts:1046-1050`) requires
`codexModelIndex >= 0 && input.authority.argv[codexModelIndex + 1] ===
"gpt-5.5"` and the exact token `'model_reasoning_effort="high"'`, plus
`input.authority.argv.includes("--sandbox")` and
`input.authority.argv.includes("read-only")` — so even if a caller tried to
smuggle a different model/effort/sandbox into argv, the binding check would
reject it as a mismatch rather than silently accept the drift.

---

## 7. Worker profile (Claude Code, read-only)

`createClaudeConfiguration()`, `packages/core/src/task-execution-two-model-canary.ts:1090-1127`:
```
readOnlyCanaryProfile: {
  authority: "system",
  profileId: "claude_code_read_only_canary_v1",
  enabled: true,
  permissionMode: "plan",
  toolSet: ["Read"],
  hostCustomizationIsolation: "safe_mode",
  strictMcpConfig: true,
  sessionPersistence: false,
  repositoryWriteAllowed: false,
  structuredOutput: "json_schema",
},
```
The CLI's own read-only canary handler (`apps/cli/src/commands.ts:6000-6032`,
`handleTaskExecutionClaudeCanary`) builds the same shape independently and
additionally sets `permissionMode: "plan"`, `toolSet: ["Read"]`,
`repositoryWriteAllowed: false`. Contrast with the separate *write*-canary
handler (`apps/cli/src/commands.ts:7031-7065`,
`handleTaskExecutionClaudeWriteCanary`, used only by a different, non-TASK-0324
command) which explicitly sets `repositoryWriteAllowed: false,
primaryWorkspaceMutationAllowed: false, automaticPatchApplyAllowed: false,
shellAllowed: false` even for its own more-permissive `Read,Edit` tool set —
i.e. even the write-canary path never allows a "primary apply."

Runtime enforcement in `executableBindingReady`
(`task-execution-local-worker-process.ts:1063-1080`) for
`real_claude_code_read_only_canary`: requires `--safe-mode`,
`--strict-mcp-config`, `--no-session-persistence`, `--json-schema`,
`--tools` with the next argv token exactly `"Read"`, `--permission-mode` with
the next token exactly `"plan"`, and rejects any argv containing
`dangerously-skip-permissions` or `bypassPermissions` (regex check,
`:1080-1082`).

**Confirmed:** the TASK-0324 worker path is `toolSet: ["Read"]`,
`permissionMode: "plan"`, `repositoryWriteAllowed: false`,
`structuredOutput: "json_schema"`, with no shell/apply/write capability
anywhere in the read-only canary profile or its runtime gate.

---

## 8. Identity minting — minimal diff surface (NOT applied; IMPLEMENTER-A owns edits)

Constants at `packages/core/src/task-execution-two-model-canary.ts:127-134`:
```
TASK_EXECUTION_TWO_MODEL_CANARY_TASK_ID = "TASK-0324-real-two-model-canary"
TASK_EXECUTION_TWO_MODEL_CANARY_WORK_ITEM_ID = "task-0324-read-only-route"
TASK_EXECUTION_TWO_MODEL_CANARY_BATCH_ID = "task-0324-one-hop-batch"
TASK_EXECUTION_TWO_MODEL_CANARY_ORCHESTRATION_ID = "task-0324-codex-to-claude-read-only-canary"
```
These are only *defaults*. `prepareTaskExecutionTwoModelCanary`
(`:746-753`) already accepts overrides:
```
export async function prepareTaskExecutionTwoModelCanary(input: {
  readonly projectRoot: string;
  readonly now?: string;
  readonly taskId?: string;
  readonly orchestrationId?: string;
  readonly workItemId?: string;
  readonly batchId?: string;
}): ...
```
and `defaultCanaryRefs()` (`:286-299`) falls back to the module constants only
when a field is `undefined`. So **no edit to the constants at 127-134 is
required** to mint a fresh identity — passing new `taskId`/`orchestrationId`
(and optionally `workItemId`/`batchId`) through to `prepareTaskExecutionTwoModelCanary`
and `runTaskExecutionTwoModelCanary` is sufficient at the library level.

**Gap found in the CLI wiring** (`apps/cli/src/commands.ts`):
- `parseTaskExecutionOrchestrationCanaryArgs` (`:5197-5251+`) already parses
  `--orchestration-id` (and, per its return type at `:5197-5205`, `taskId`/
  `expectedRevision`/etc.) from argv.
- The **`prepare` action handler ignores them**:
  `handleTaskExecutionOrchestrationCanary`, `:6386-6389`:
  ```
  if (parsedArgs.action === "prepare") {
    const result = await prepareTaskExecutionTwoModelCanary({
      projectRoot: getCwd(),
    });
  ```
  — no `taskId`/`orchestrationId` passed, so `prepare` always mints/loads the
  hardcoded default identity regardless of CLI flags.
- The **`run` action handler does pass them through**, `:6505-6512`:
  ```
  const result = await runTaskExecutionTwoModelCanary({
    projectRoot: getCwd(),
    taskId: parsedArgs.taskId,
    orchestrationId: parsedArgs.orchestrationId,
    ...
  });
  ```

**Minimal diff surface (for IMPLEMENTER-A, not applied here):** in
`handleTaskExecutionOrchestrationCanary`'s `prepare` branch
(`apps/cli/src/commands.ts:6387-6389`), thread `taskId: parsedArgs.taskId,
orchestrationId: parsedArgs.orchestrationId` into the
`prepareTaskExecutionTwoModelCanary(...)` call, mirroring what `run` already
does at `:6507-6508`. `workItemId`/`batchId` overrides are not currently
exposed as CLI flags at all in `parseTaskExecutionOrchestrationCanaryArgs`
(`:5197-5213` only declares `taskId`/`orchestrationId`/the three
`expected*Revision` fields) — if a fully independent `workItemId`/`batchId`
per fresh identity is required (rather than accepting the shared defaults),
the parser needs two more flags added. Given collision is keyed by
`taskId`+`orchestrationId` (Section 9), the `workItemId`/`batchId` defaults
being shared across fresh identities does not appear to create a collision
risk by itself.

No smoke-test hardcoding was found that would collide with a new identity:
`packages/core/scripts/smoke.mjs:19538` contains one reference to
`"TASK-0324-real-two-model-canary-fresh-20260814-oneshotfix"`, but it is a
defensive `assert.notEqual` guarding that the *module's default* constant
never equals that specific burned string — it does not hardcode or reserve
any new identity, so it does not collide with a freshly minted one (e.g. a
`-fresh-20260816...` suffix).

---

## 9. State collision check (read-only)

Listed all five state trees under `.aeos/state/` for any `TASK-0324*` entries.
Nine consumed/failed identities exist across all trees (identical set in each):
`TASK-0324-real-two-model-canary` (base), and eight `-fresh-20260814-*` suffixes:
`01`, `authfix`, `evidencefix`, `execfix`, `modelfix`, `oneshotfix`,
`persistfix`, `routefix` — present under `orchestration-canaries/`,
`invocations/`, `executions/`, `tasks/` (as `<id>.json`), and `audit/`.

A freshly minted identity using **today's date** (e.g. a
`TASK-0324-real-two-model-canary-fresh-20260816...` taskId/orchestrationId,
per the environment's current date of 2026-08-16) has **no existing directory
or file under any of the five trees** — confirmed by directory listing, no
collision.

---

## 10. Nonzero-exit root cause (the four most recent real planner launches)

All four identities requested (`routefix`, `oneshotfix`, `modelfix`,
`evidencefix`) failed at the **planner (Codex) invocation**, never reaching
the Claude worker. Confirmed the Claude-worker invocation record for
`evidencefix` (`invocation-r1-n2-8716dfbf27f804e048978284.json`) is still
`"lifecycle": "reserved"`, `"outcomeCertainty": "not_entered"`, `"issues": []`
— it was never invoked because the planner failed first.

All four planner invocation records carry the same failure code:
`"code": "task_execution_codex_worker_process_nonzero_exit"`,
`"category": "execution_failure"`, `"retryable": false`.

Per-identity diagnostic detail (verbatim `failure.diagnostic` field):

- **routefix** (`invocation-r1-n1-f40e0f4c5ced42dada3e2c65.json`, failed
  `2026-08-14T09:34:01.071Z`):
  > `"Codex process exited nonzero; exit status is not completion authority."`
  (generic message, no captured stderr/exit code)

- **oneshotfix** (`invocation-r1-n1-4107700bdc883ea98df74b00.json`, failed
  `2026-08-14T12:11:15.728Z`):
  > `"Codex process exited nonzero; exit status is not completion authority."`
  (same generic message)

- **modelfix** (`invocation-r1-n1-f1c6d2873e08c513589b2339.json`, failed
  `2026-08-14T13:09:10.774Z`):
  > `"termination=nonzero_exit; exitCode=1"`
  (first identity to capture the actual exit code: **1**)

- **evidencefix** (`invocation-r1-n1-ef05149fb89cd9746b211add.json`, failed
  `2026-08-14T13:46:52.739Z`) — **most complete captured evidence**:
  > `"termination=nonzero_exit; exitCode=1; stdinMode=pipe; stdinBytes=1187; stdinWriteCompleted=true; stdinClosed=true; stderrExcerpt=Reading prompt from stdin... OpenAI Codex v0.146.0 -------- workdir: /Users/magnero/Desktop/pro-performans model: gpt-5.5 provider: openai approval: never sandbox: read-only reasoning effort: high reasoning summaries: none session id: 01a00; stdout=empty"`

**Reading the evidencefix stderr excerpt literally:** stdin was fully written
(1187 bytes) and closed; Codex printed its normal startup banner to stderr
("Reading prompt from stdin... OpenAI Codex v0.146.0 -------- workdir: ...
model: gpt-5.5 provider: openai approval: never sandbox: read-only reasoning
effort: high reasoning summaries: none session id: 01a00"); **stdout was
empty**; and the process exited with **exit code 1**. The captured
`session id: 01a00` looks truncated (real Codex session ids are longer
UUID-like strings) — either the 8192-byte `stderrLimitBytes` cap
(`createPlannerConfiguration`, `task-execution-two-model-canary.ts:1054-1088`,
`stderrLimitBytes: 8192`) or a bounded-excerpt formatter cut the stream before
any actual error message could be captured.

**Strongest hypothesis:** Codex CLI (`v0.146.0`, confirmed from its own
banner) starts up correctly, accepts the model/provider/approval/sandbox
configuration, reads the piped prompt from stdin successfully, but then
**fails during or immediately after model invocation with no output written
to stdout and only its startup banner (no error text) on stderr before the
banner-only excerpt is truncated** — consistent with either (a) an error
raised late enough in the process that the bounded stderr capture window
already closed on the banner text before the real error line arrived, or (b)
`--output-schema` / structured-output contract rejection by this Codex
version that produces no user-facing stdout and only logs the real failure
past what was captured. This cannot be fully resolved from persisted state
alone.

**NEEDS_RUNTIME_PROOF:** the exact failure cause beyond "exit code 1, empty
stdout, banner-only stderr" cannot be determined from the four persisted
diagnostics — the actual error text was never durably captured (only
`routefix`/`oneshotfix` even lack an exit code; only `evidencefix` has a
stderr excerpt, and it cuts off before any error line). To prove the root
cause without burning another canary identity, run, out-of-band and
completely outside AEOS's one-shot authority system (so it cannot consume
anything):
```
echo '<the same bounded planner prompt>' | \
  codex exec --sandbox read-only --approval never \
  -c model_reasoning_effort="high" --model gpt-5.5 \
  --output-schema packages/core/schemas/codex-planner-routing-proposal-v1.schema.json
echo "exit=$?"
```
run manually (not through `runTaskExecutionCodexExecContractPreflight` or the
canary path) with full unbounded stdout/stderr captured to files, to see the
untruncated error text. This is a diagnostic dry run of the *same binary and
flags* outside the one-shot authority machinery — it does not touch `.aeos`
state or consume any invocation, so it is safe to run before spending the
fresh identity, but running it is outside this audit's read-only scope and is
left for IMPLEMENTER-A/the launch owner to execute.

---

## 11. Out-of-band reconstruction of the exact planner invocation (prepared for manual execution)

This section reconstructs, byte-for-byte where verifiable, the exact `codex
exec` invocation AEOS builds for the TASK-0324 planner, so it can be
reproduced manually — completely outside AEOS's one-shot authority machinery
— with unbounded stderr capture. **No AEOS CLI command was run to build
this; no `.aeos` state was created or modified.** The reconstruction uses the
already-persisted, already-burned `evidencefix` identity's real recorded
field values (invocation id, attempt id, idempotency key, work item/batch
ids) purely as byte-accurate inputs — reusing already-consumed identity
metadata consumes nothing further.

### 11.1 argv

`buildCodexArgv()`, `packages/core/src/task-execution-codex-worker.ts:815-833`:
```
function buildCodexArgv(
  configuration: TaskExecutionCodexWorkerConfiguration,
): readonly string[] {
  const argv = [
    "exec",
    "--model",
    configuration.model.model,
    "-c",
    `model_reasoning_effort="${configuration.model.reasoningEffort}"`,
    "--sandbox",
    configuration.sandboxMode,
  ];
  if (configuration.structuredResultSchemaPath !== undefined) {
    argv.push("--output-schema", configuration.structuredResultSchemaPath);
  }
  return argv;
}
```
With `createPlannerConfiguration()`'s values (model `gpt-5.5`, reasoningEffort
`high`, sandboxMode `read-only`, `structuredResultSchemaPath` =
`codexPlannerSchemaPath`), the exact argv is:
```
exec --model gpt-5.5 -c model_reasoning_effort="high" --sandbox read-only \
  --output-schema <project-root>/packages/core/schemas/codex-planner-routing-proposal-v1.schema.json
```

### 11.2 cwd

`workspace.absolutePath: await realpath(input.projectRoot)`
(`task-execution-two-model-canary.ts`, planner `executeTaskExecutionLocalWorkerProcess`
call). For this repo: `<project-root>` *(project-root path sanitized in prose; the
exact literal appears in quoted captured output below where it is primary evidence)*
(also the exact `workdir:` value already seen in the persisted `evidencefix` stderr
excerpt — confirms this reconstruction matches the real prior run).

### 11.3 Bounded environment

Chain: `environment: { inheritance: "system_codex_read_only_planner_canary",
variables: [] }` is passed to `executeBoundedChildProcess`
(`task-execution-local-worker-process.ts:1400-1584`), which calls
`spawn(executablePath, argv, { cwd, env: environmentFromPolicy(environment), ... })`
(`:1454-1460`). `environmentFromPolicy()` (`:1168-1212`) starts from the
(empty) `variables` array, then — for this inheritance mode — copies through
`approvedCodexEnvironmentRefs()` (`:382-388`), which is
`codexReadOnlyPlannerCanaryInheritedEnvNames` (`:353-362`):
```
["HOME", "USER", "LOGNAME", "TMPDIR", "PATH", "LANG", "LC_ALL", "LC_CTYPE"]
```
plus `"CODEX_HOME"` if-and-only-if `process.env.CODEX_HOME !== undefined` in
the AEOS process that launches the child. Each candidate value is passed
through `safeEnvValue()` (`:390-400`), which drops it if
`undefined`/empty-string/`>4096` chars/contains a null byte.

**Live host values checked** (via `node -e 'console.log(process.env...)'`,
which reflects the real `undefined` vs `""` distinction that `safeEnvValue`
cares about — names only, per redaction instructions):
- `HOME`, `USER`, `LOGNAME`, `TMPDIR`, `PATH`, `LANG` — all set, non-empty →
  **included**.
- `LC_ALL`, `LC_CTYPE`, `CODEX_HOME` — `undefined` in `process.env` on this
  host → **excluded** (not empty strings; genuinely unset).

So the exact bounded env AEOS would pass to the real planner spawn on this
host is exactly **6 variables**: `HOME`, `USER`, `LOGNAME`, `TMPDIR`, `PATH`,
`LANG` (values as currently set in the shell; no `LC_*`, no `CODEX_HOME`, and
critically **no `OPENAI_API_KEY` or any Codex auth/token env var** — Codex
auth is expected to come from `~/.codex/auth.json` under the inherited
`HOME`, not from an env var).

### 11.4 stdin (byte-reconstructed)

`prepareTaskExecutionCodexWorkerInvocation()` sets
`stdin = buildInstructionPayload(input.request)`
(`task-execution-codex-worker.ts:1429`, function at `:1291-1314`) — a single
`JSON.stringify(...)` line, **not** the schema file contents (the schema is
only ever passed via the `--output-schema <path>` argv flag, never inlined
into stdin). Reconstructed using the real, already-persisted field values
from the burned `evidencefix` identity
(`.aeos/state/invocations/TASK-0324-real-two-model-canary-fresh-20260814-evidencefix/invocation-r1-n1-ef05149fb89cd9746b211add.json`,
read-only) and the literal `boundedInstructions`/`contextReferences` strings
from `createRequest()`'s planner call site
(`task-execution-two-model-canary.ts`, `plannerRequest = createRequest({...})`):

```json
{"aeosCodexWorkerInstructionVersion":1,"taskId":"TASK-0324-real-two-model-canary-fresh-20260814-evidencefix","sourceTaskRevision":1,"attemptId":"attempt-TASK-0324-real-two-model-canary-fresh-20260814-evidencefix-r1-n1-160w148","attemptNumber":1,"invocationId":"invocation-r1-n1-ef05149fb89cd9746b211add","idempotencyKey":"aeos-invocation-v1-855ad499ef176ea2ce29cfb23fad34ce62600f4cc5d1318d71929733016a5cf6","workItemId":"task-0324-read-only-route-fresh-20260814-evidencefix","batchId":"task-0324-one-hop-batch-fresh-20260814-evidencefix","operationKind":"execute_task_attempt","workItem":"task-0324-read-only-route-fresh-20260814-evidencefix","constraints":"TASK-0324 fixed planner canary. Return only the JSON Schema-backed AEOS worker result with output.routingProposal.recommendedWorkerFamily=claude_code for the assigned read-only repository reasoning work item. Do not implement code, edit files, run shell, launch workers, or claim completion.","contextReferences":["aeos://task/TASK-0324/operation/read-only-routed-worker-canary"],"expectedEvidence":["structured-result","bounded-diagnostics","changed-file-manifest-reference","patch-artifact-reference","test-summary-reference"]}
```

**Verified byte-exact**: `Buffer.byteLength(this string, "utf8") === 1187`,
which is *exactly* the `stdinBytes=1187` recorded in the persisted
`evidencefix` diagnostic (Section 10) — confirming this reconstruction
matches the real bytes AEOS actually piped to Codex in that run. Saved to
`ops/evidence/TASK-0324/repro-stdin.json` (1187 bytes, verified with `wc -c`).

### 11.5 Prepared repro script (not yet executed — see below)

`ops/evidence/TASK-0324/repro-codex-planner.sh` was written (executable),
encoding the exact argv/cwd/stdin above and taking a `bounded` or
`inherited` mode argument to run the two comparison launches described in
the task brief, writing `repro-bounded-stdout.txt` /
`repro-bounded-stderr.txt` (or the `inherited` equivalents) under
`ops/evidence/TASK-0324/`.

**Execution status (first attempt): BLOCKED.** Invoking `codex exec` directly
from this session's shell was denied by the Claude Code auto-mode permission
classifier ("Blocked by classifier") on the first attempted run in this
session. No process was spawned and no exit code was observed on that
attempt. The coordinator ran the same prepared script from their own session
(not blocked there) and got a **decisive result** — see Section 10 addendum
below.

### 11.6 Decisive result (root cause resolved) and fix verification

The coordinator ran `ops/evidence/TASK-0324/repro-codex-planner.sh bounded`
(bounded env, this section's byte-exact reconstruction) against the
*original* schema. Result: **exit 1, stdout 0 bytes**, full stderr showing
Codex started cleanly, read all 1187 stdin bytes, authenticated against the
provider, then received (quoted verbatim, emitted twice — initial attempt
plus one retry):
```
ERROR: {
  "type": "error",
  "error": {
    "type": "invalid_request_error",
    "code": "invalid_json_schema",
    "message": "Invalid schema for response_format 'codex_output_schema': In context=('properties', 'aeosCodexWorkerResultVersion'), schema must have a 'type' key.",
    "param": "text.format.schema"
  },
  "status": 400
}
```
This is a **provider-side 400 rejection of the wire schema itself** —
decisive proof that auth/DNS/TLS/HTTP/the bounded 6-var env
(Section 11.3) were all healthy, and that Section 2/Section 10's prior
`task_execution_codex_worker_process_nonzero_exit` failures across
`routefix`/`oneshotfix`/`modelfix`/`evidencefix` were caused by
`packages/core/schemas/codex-planner-routing-proposal-v1.schema.json` being
valid JSON Schema 2020-12 but **not a valid OpenAI structured-output
(strict) schema**. Root cause identified; this is NOT the executable
binding (Section 1), NOT the bounded environment (Section 11.3), NOT AEOS's
spawn mechanics (Section 2) — it is the schema file handed to the provider
via `--output-schema`.

**Schema defects identified** (all four categories the provider/strict-mode
rejects):
1. every `const`-only property had no sibling `"type"` — the exact
   rejection quoted above, for `aeosCodexWorkerResultVersion` (and
   equally `status`, `workerFamily`, `runtimeKind`, `invocationOk`,
   `operationKind`, `recommendedWorkerFamily`, `reasonReference`,
   `expectedOperationClass`, `diagnosticCode`);
2. `capabilityRequirements.items` used a bare `enum` with no `type`;
3. strict structured outputs require every key in `properties` to also
   appear in `required` (`proposalId`, `batchId` under `routingProposal`,
   and top-level `outputReference`/`message` were optional);
4. `minimum` / `minItems` / `maxItems` / `uniqueItems` are unsupported
   keywords in strict mode.

**Fix applied** (write scope: `packages/core/schemas/codex-planner-routing-proposal-v1.schema.json`
only): rewrote the schema to add explicit `"type"` alongside every `const`,
gave `capabilityRequirements.items` an explicit `{"type":"string","enum":[...]}`,
moved every previously-optional property into `required` while making
genuinely-optional fields nullable (`{"type":["string","null"]}` for
`workItemId`/`batchId`/`outputReference`/`message`/`routingProposal.proposalId`/
`routingProposal.batchId`), removed only `minimum`/`minItems`/`maxItems`/
`uniqueItems`, and kept `additionalProperties:false` at every object level
(top level, `output`, `output.routingProposal`).

**Verified empirically** (this session; classifier did not block this
second attempt): re-ran
`sh ops/evidence/TASK-0324/repro-codex-planner.sh bounded` against the fixed
schema. Result: **`BOUNDED_EXIT=0`**. No `invalid_json_schema` error, no
error of any kind. Stderr shows the identical clean startup banner (`OpenAI
Codex v0.146.0`, `workdir: /Users/magnero/Desktop/pro-performans`, `model:
gpt-5.5`, `provider: openai`, `approval: never`, `sandbox: read-only`,
`reasoning effort: high`) followed by a normal `codex` turn and `hook: Stop
Completed` / `tokens used 16,018` — i.e. a full clean run, not a truncated
one. Stdout (1318 bytes) contains a complete, schema-valid JSON result:
```json
{"aeosCodexWorkerResultVersion":1,"status":"returned","workerId":"codex","workerFamily":"codex","runtimeKind":"test_worker","invocationId":"invocation-r1-n1-ef05149fb89cd9746b211add","idempotencyKey":"aeos-invocation-v1-855ad499ef176ea2ce29cfb23fad34ce62600f4cc5d1318d71929733016a5cf6","taskId":"TASK-0324-real-two-model-canary-fresh-20260814-evidencefix","sourceTaskRevision":1,"attemptId":"attempt-TASK-0324-real-two-model-canary-fresh-20260814-evidencefix-r1-n1-160w148","attemptNumber":1,"workItemId":"task-0324-read-only-route-fresh-20260814-evidencefix","batchId":"task-0324-one-hop-batch-fresh-20260814-evidencefix","invocationOk":true,"output":{"routingProposal":{"proposalId":null,"taskId":"TASK-0324-real-two-model-canary-fresh-20260814-evidencefix","sourceTaskRevision":1,"workItemId":"task-0324-read-only-route-fresh-20260814-evidencefix","batchId":"task-0324-one-hop-batch-fresh-20260814-evidencefix","operationKind":"execute_task_attempt","recommendedWorkerFamily":"claude_code","capabilityRequirements":["implementation","repositoryRead","modelReasoning","boundedDiagnostics"],"reasonReference":"aeos://task/TASK-0324/operation/read-only-routed-worker-canary","expectedOperationClass":"implementation"}},"outputReference":null,"diagnosticCode":"task_0324_codex_planner_routing_proposal","message":null}
```
Saved to `ops/evidence/TASK-0324/repro-fixed-stdout.txt` (1318 bytes) and
`ops/evidence/TASK-0324/repro-fixed-stderr.txt`. Note: stderr also contains
one unrelated benign line (`ERROR rmcp::transport::worker: worker quit with
fatal: Transport channel closed, when AuthRequired(...
mcp.cloudflare.com...)`) from an ambient MCP server configured in this
Codex profile trying and failing an OAuth handshake — this did not affect
the exit code (0) or the structured result and is unrelated to the
TASK-0324 schema defect.

**Success criterion met**: the `invalid_json_schema` 400 is gone; the
provider accepted the fixed schema and returned a fully valid,
schema-conformant routing proposal.

### 11.7 Constraints removed from the wire schema and their AEOS-code-side status (Part 2 analysis)

`routeProposalFromPlannerResult()` (`packages/core/src/task-execution-two-model-canary.ts:1480-1592`,
current line numbers as of this read — this file is under concurrent edit
by IMPLEMENTER-A, re-verify line numbers before patching) and the shared
`mismatchIssues()` (`packages/core/src/task-execution-worker.ts:982-1027`,
called from `normalizeTaskExecutionWorkerResult`,
`packages/core/src/task-execution-worker.ts:1076-1237`) together perform
AEOS's own independent re-validation of the planner's returned proposal —
**AEOS does not rely solely on the provider having enforced the schema.**
`mismatchIssues` requires exact equality (when the field is present) between
the raw result and the authoritative request for: `workerId`, `workerFamily`,
`runtimeKind`, `invocationId`, `idempotencyKey`, `taskId`,
`sourceTaskRevision`, `attemptId`, `attemptNumber`, `workItemId`, `batchId`.
`routeProposalFromPlannerResult` separately requires exact equality for the
nested `routingProposal.{taskId, sourceTaskRevision, workItemId, batchId,
operationKind, recommendedWorkerFamily, expectedOperationClass}` and
membership-checks every `capabilityRequirements` element against a 4-value
allowlist (`task-execution-two-model-canary.ts:1540-1550`).

Per-constraint status for exactly the four keyword categories removed from
the wire schema:

1. **`"minimum": 1` on top-level `sourceTaskRevision`** — already fully
   enforced, no gap. `mismatchIssues` (`task-execution-worker.ts:982-1027`)
   requires *exact equality* to `input.request.sourceTaskRevision`, a
   real AEOS-computed revision that is always ≥1 by construction — strictly
   stronger than a bare `minimum:1`. **No patch needed.**

2. **`"minimum": 1` on top-level `attemptNumber`** — same `mismatchIssues`
   exact-equality check against `input.request.attemptNumber`. **No patch
   needed.**

3. **`"minimum": 1` on `routingProposal.sourceTaskRevision`** — enforced by
   `routeProposalFromPlannerResult`'s
   `proposalValue.sourceTaskRevision !== input.expectedRevision` check
   (`task-execution-two-model-canary.ts:1542`), again exact equality to a
   real AEOS-owned value ≥1. **No patch needed.**

4. **`"minItems": 1` on `capabilityRequirements`** (non-empty array) — **GAP,
   not enforced.** The current check
   (`task-execution-two-model-canary.ts:1548-1549`):
   ```
   !Array.isArray(capabilityRequirements) ||
   !capabilityRequirements.every((item) => allowedCapabilities.has(item))
   ```
   is vacuously true for an **empty array** — `[].every(...)` is `true` in
   JavaScript, so `!true` is `false`, so an empty
   `capabilityRequirements: []` would currently be *accepted* as a valid
   proposal. **Patch needed**, in `routeProposalFromPlannerResult`
   (`task-execution-two-model-canary.ts`, same conjunction, ~line
   1548-1549 as of this read): add
   `capabilityRequirements.length === 0` to the OR-chain that triggers
   rejection, e.g.:
   ```
   !Array.isArray(capabilityRequirements) ||
   capabilityRequirements.length === 0 ||
   !capabilityRequirements.every((item) => allowedCapabilities.has(item))
   ```

5. **`"uniqueItems": true` on `capabilityRequirements`** — **GAP, not
   enforced.** `.every(...)` does not detect duplicates; e.g.
   `["implementation","implementation"]` currently passes. **Patch needed**,
   same location, add a duplicate check to the OR-chain, e.g.:
   ```
   new Set(capabilityRequirements).size !== capabilityRequirements.length
   ```

6. **`"maxItems": 8` on `capabilityRequirements`** — **GAP as written, but
   becomes moot once #5 is patched.** Only 4 distinct capability strings
   are allowed (`allowedCapabilities`, `task-execution-two-model-canary.ts:1534-1539`),
   so once duplicates are rejected (#5), the maximum possible array length
   is naturally capped at 4 (< 8) — no array could pass both the allowlist
   membership check and a uniqueness check while exceeding 4 elements.
   Recommend adding an explicit length guard anyway for defense-in-depth /
   future-proofing (in case `allowedCapabilities` grows past 8 later),
   e.g. `capabilityRequirements.length > 8` added to the same OR-chain, but
   this is not an active gap once #5 lands.

**Pre-existing gap noticed but outside this task's removed-constraint list**
(flagged for awareness, not requested by this task): `invocationOk` is
schema-`const:true`, but `routeProposalFromPlannerResult` only gates on
`plannerResult.outcomeStatus !== "returned"` — it never separately checks
`plannerResult.invocationOk === true`
(`task-execution-two-model-canary.ts:1498`). In
`normalizeTaskExecutionWorkerResult`
(`packages/core/src/task-execution-worker.ts:1160-1177`), a raw result with
`status:"returned"` and `invocationOk:false` normalizes to
`outcomeStatus:"returned", invocationOk:false` (only a *missing/wrong-typed*
`invocationOk` is rejected, not `false` specifically) — so a provider
response with `invocationOk:false` would currently still be routed. This is
unrelated to the four keywords removed today (const:true always had a type
in code's expectations regardless of the wire-schema fix) and predates this
audit; noting it for the standing "no validator weakened" rule to be
triaged separately, not blocking the fresh canary on the schema fix alone.

**Summary for the launch owner:** before spending the fresh canary,
apply the two real patches (`capabilityRequirements` non-empty check and
uniqueness check, item 4 and 5 above) in
`routeProposalFromPlannerResult` — coordinate with IMPLEMENTER-A since this
function lives in the file they are concurrently editing. The schema fix
alone (Section 11.6) is sufficient to clear the `invalid_json_schema` 400;
the two code patches close the specific guarantees that were only ever
enforced by the now-loosened wire schema.
