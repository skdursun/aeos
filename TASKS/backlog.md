# Backlog

## CLI Task Plan Parser Mapper Planner Integration Backlog

1. TASK-0264: Implement CLI task plan planner integration contracts. Purpose: add CLI-local contracts for parser, mapper, wiring, planner output, fail-closed statuses, JSON safety wrapper, and process exit-code mapping. Likely files: `apps/cli/src/commands.ts`. Verification: `pnpm --filter @aeos/cli check`. Effort: Medium. Classification: Code.
2. TASK-0265: Add CLI task plan planner output examples. Purpose: add representative success, parser failure, unsupported mapping, blocked safety, missing planner input, and planner non-ok examples without enabling runtime command behavior. Likely files: `apps/cli/src/commands.ts`, `apps/cli/scripts/smoke.mjs`. Verification: `pnpm --filter @aeos/cli check`. Effort: Low. Classification: Code.
3. TASK-0266: Add parser result builder for planner-enabled task plan CLI. Purpose: call `parseTaskPlanInputFile()` with target parser settings and expose a validation-compatible handoff without treating parser-local unsupported mapping as planner-ready. Likely files: `apps/cli/src/commands.ts`. Verification: `pnpm --filter @aeos/cli check`. Effort: Medium. Classification: Code.
4. TASK-0267: Add parser-to-mapper CLI input builder. Purpose: build `TaskContractMappingInput` from parser validation task data with MVP-safe fallback, audit, policy, verifier, no-execution, and no-write options. Likely files: `apps/cli/src/commands.ts`. Verification: `pnpm --filter @aeos/cli check`. Effort: Medium. Classification: Code.
5. TASK-0268: Wire CLI task plan to mapper fail-closed handling. Purpose: call `mapTaskContractToRunnerPlanningInput()` after validation and return deterministic unsupported, invalid, blocked, or mapped output without invoking planner yet. Likely files: `apps/cli/src/commands.ts`, `apps/cli/scripts/smoke.mjs`. Verification: `pnpm --filter @aeos/cli check`. Effort: Medium. Classification: Code.
6. TASK-0269: Wire dependency-injected planner through task plan wiring helper. Purpose: pass `planAgenticRunner` into `createTaskPlanFilePlannerWiringResult()` and ensure planner input can only come from `mappingResult.planningInput.runnerPlanningInput`. Likely files: `apps/cli/src/commands.ts`. Verification: `pnpm --filter @aeos/cli check`. Effort: High. Classification: Code.
7. TASK-0270: Render successful human task plan output. Purpose: print task id, source file, mode, parsed, mapping, planning, counts, policy, approval, verifier, audit, safety flags, and compact issues. Likely files: `apps/cli/src/commands.ts`, `apps/cli/scripts/smoke.mjs`. Verification: `pnpm --filter @aeos/cli check`. Effort: Medium. Classification: Code.
8. TASK-0271: Render successful JSON task plan output. Purpose: emit the target JSON-only success object with parse, mapping, plan, nested safety flags, issues, summary, and `exitCode: "success"`. Likely files: `apps/cli/src/commands.ts`, `apps/cli/scripts/smoke.mjs`. Verification: `pnpm --filter @aeos/cli check`. Effort: Medium. Classification: Code.
9. TASK-0272: Add fail-closed JSON output for parser and validation failures. Purpose: preserve JSON-only deterministic output for missing file, unsafe path, unsupported extension, oversized file, invalid JSON, and invalid task contract. Likely files: `apps/cli/src/commands.ts`, `apps/cli/scripts/smoke.mjs`. Verification: `pnpm --filter @aeos/cli smoke`. Effort: High. Classification: Code.
10. TASK-0273: Add fail-closed mapping and safety smoke coverage. Purpose: cover unsupported explicit work items, unsupported batches, missing runner planning input, missing verifier gate, missing no-execution/no-write proof, and hostile represented metadata. Likely files: `apps/cli/scripts/smoke.mjs`. Verification: `pnpm --filter @aeos/cli smoke`. Effort: High. Classification: Code.
11. TASK-0274: Add planner non-ok and dependency-injection smoke coverage. Purpose: prove planner non-ok fails closed, planner is not called before gates pass, and injected planner receives only mapped runner planning input. Likely files: `apps/cli/scripts/smoke.mjs`. Verification: `pnpm --filter @aeos/cli smoke`. Effort: High. Classification: Code.
12. TASK-0275: Add task plan no-write and no-execution smoke assertions. Purpose: assert success and failure paths do not create files, call adapters, write audit events, run verifier, persist state, create completed state, or mutate the filesystem. Likely files: `apps/cli/scripts/smoke.mjs`. Verification: `pnpm --filter @aeos/cli smoke`. Effort: High. Classification: Code.
13. TASK-0276: Update task plan planner integration usage docs. Purpose: document implemented CLI behavior, supported fallback limits, JSON-only output, fail-closed statuses, and remaining non-goals after code lands. Likely files: `docs/TASK_PLAN_INPUT_PARSER_USAGE.md`, `docs/TASK_CONTRACT_MAPPING_USAGE.md`, `docs/TASK_PLAN_FILE_PLANNER_WIRING_USAGE.md`, `docs/AGENTIC_RUNNER_PLANNING_USAGE.md`. Verification: `git status --short`. Effort: Medium. Classification: Docs.

## Task Plan File To Planner Wiring Backlog

1. TASK-0254: Implement task plan file planner wiring contracts. Purpose: add CLI-local output and guard contracts for parser, mapper, and planner wiring without invoking the planner. Likely files: `apps/cli/src/commands.ts`. Verification: `pnpm --filter @aeos/cli check`. Effort: Medium. Classification: Code.
2. TASK-0255: Add task plan file planner wiring contract examples. Purpose: add success, unsupported mapping, unsafe mapping, and planner non-ok example output shapes for human and JSON rendering. Likely files: `apps/cli/src/commands.ts`, `apps/cli/scripts/smoke.mjs`. Verification: `pnpm --filter @aeos/cli check`. Effort: Low. Classification: Code.
3. TASK-0256: Add parser-to-mapper input builder. Purpose: construct `TaskContractMappingInput` from parser validation handoff while preserving no-execution, no-write, and MVP fallback options. Likely files: `apps/cli/src/commands.ts`. Verification: `pnpm --filter @aeos/cli check`. Effort: Medium. Classification: Code.
4. TASK-0257: Add mapping gate helper for task plan CLI. Purpose: fail closed unless mapping status is `mapped`, planning input exists, no-execution/no-write flags are true, and verifier gates are true. Likely files: `apps/cli/src/commands.ts`. Verification: `pnpm --filter @aeos/cli check`. Effort: Medium. Classification: Code.
5. TASK-0258: Add unsupported mapping JSON renderer. Purpose: emit the stable `unsupported_mapping` JSON shape with `planningEnabled: false` and `executionEnabled: false`. Likely files: `apps/cli/src/commands.ts`, `apps/cli/scripts/smoke.mjs`. Verification: `pnpm --filter @aeos/cli check`. Effort: Medium. Classification: Code.
6. TASK-0259: Wire planner invocation behind gates. Purpose: call `planAgenticRunner()` only after parser and mapping gates pass, with no execution, no writes, no verifier run, no audit writes, and no persistence. Likely files: `apps/cli/src/commands.ts`. Verification: `pnpm --filter @aeos/cli check`. Effort: High. Classification: Code.
7. TASK-0260: Render successful human task plan output. Purpose: print task id, source file, mode, parsed, mapping, counts, policy, approval, verifier, audit, side-effect flags, and issues. Likely files: `apps/cli/src/commands.ts`, `apps/cli/scripts/smoke.mjs`. Verification: `pnpm --filter @aeos/cli check`. Effort: Medium. Classification: Code.
8. TASK-0261: Render successful JSON task plan output. Purpose: emit the stable JSON success shape with parse, mapping, plan, policy, verifier, audit, resume, safety flags, issues, and summary. Likely files: `apps/cli/src/commands.ts`, `apps/cli/scripts/smoke.mjs`. Verification: `pnpm --filter @aeos/cli check`. Effort: Medium. Classification: Code.
9. TASK-0262: Add fail-closed planner non-ok handling. Purpose: return non-zero and JSON-only errors when planner issues or non-ok results block planning output. Likely files: `apps/cli/src/commands.ts`, `apps/cli/scripts/smoke.mjs`. Verification: `pnpm --filter @aeos/cli check`. Effort: Medium. Classification: Code.
10. TASK-0263: Add explicit workItems and batches unsupported smokes. Purpose: prove task files with unvalidated explicit inventory fail closed and do not pretend multi-item planning is supported. Likely files: `apps/cli/scripts/smoke.mjs`. Verification: `pnpm --filter @aeos/cli smoke`. Effort: Medium. Classification: Code.
11. TASK-0264: Add no-write and no-execution smokes for planner wiring. Purpose: assert no temp-dir writes, no adapter calls, no audit writes, no verifier run, no persistence, and no dry-run execution. Likely files: `apps/cli/scripts/smoke.mjs`. Verification: `pnpm --filter @aeos/cli smoke`. Effort: High. Classification: Code.
12. TASK-0265: Add JSON-only smoke coverage for task plan planner wiring. Purpose: prove success, invalid JSON, unsupported extension, unsupported mapping, unsafe mapping, planner non-ok, and unknown flags emit exactly one JSON object. Likely files: `apps/cli/scripts/smoke.mjs`. Verification: `pnpm --filter @aeos/cli smoke`. Effort: High. Classification: Code.
13. TASK-0266: Document implemented task plan planner wiring. Purpose: update usage docs after implementation with supported fallback behavior and unsupported explicit inventory limits. Likely files: `docs/TASK_PLAN_INPUT_PARSER_USAGE.md`, `docs/TASK_CONTRACT_MAPPING_USAGE.md`, `docs/AGENTIC_RUNNER_PLANNING_USAGE.md`. Verification: `git status --short`. Effort: Medium. Classification: Docs.

## Task Contract To Runner Planning Mapping Backlog

1. TASK-0244: Implement task contract mapping contracts. Purpose: add mapping result, issue, status, options, and summary contracts without mapping logic. Likely files: `packages/core/src/task-contract-runner-planning-mapping.ts`. Verification: `pnpm --filter @aeos/core check`. Effort: Medium. Classification: Code.
2. TASK-0245: Add task contract mapping contract examples. Purpose: provide mapped, unsupported, blocked, verifier-required, and no-execution example objects. Likely files: `packages/core/src/task-contract-runner-planning-mapping.example.ts`. Verification: `pnpm --filter @aeos/core check`. Effort: Low. Classification: Code.
3. TASK-0246: Add mapping preflight helper. Purpose: block mapping unless validation passed, task id exists, target mode is supported, and no execution/write options are true. Likely files: `packages/core/src/task-contract-runner-planning-mapping-logic.ts`. Verification: `pnpm --filter @aeos/core check`. Effort: Medium. Classification: Code.
4. TASK-0247: Add single work item fallback mapper. Purpose: map a validated generic `AeosTask` into one pending whole-task work item when the task shape does not require inventory. Likely files: `packages/core/src/task-contract-runner-planning-mapping-logic.ts`. Verification: `pnpm --filter @aeos/core check`. Effort: Medium. Classification: Code.
5. TASK-0248: Add deterministic fallback batch mapper. Purpose: map fallback work items into one deterministic batch and reject empty or duplicate item references. Likely files: `packages/core/src/task-contract-runner-planning-mapping-logic.ts`. Verification: `pnpm --filter @aeos/core check`. Effort: Medium. Classification: Code.
6. TASK-0249: Add policy and operation boundary mapper. Purpose: map `riskProfile`, allowed operations, forbidden operations, context scope, and file boundaries into policy and adapter boundary planning input. Likely files: `packages/core/src/task-contract-runner-planning-mapping-logic.ts`. Verification: `pnpm --filter @aeos/core check`. Effort: High. Classification: Code.
7. TASK-0250: Add audit and verifier requirement mapper. Purpose: create expected audit event ids and verifier-gated requirements without emitting audit events or running verifier logic. Likely files: `packages/core/src/task-contract-runner-planning-mapping-logic.ts`. Verification: `pnpm --filter @aeos/core check`. Effort: Medium. Classification: Code.
8. TASK-0251: Add unsupported metadata and adapter reference guards. Purpose: fail closed for untyped metadata work items, batches, resume data, unsupported adapter references, and unsupported mapping targets. Likely files: `packages/core/src/task-contract-runner-planning-mapping-logic.ts`. Verification: `pnpm --filter @aeos/core check`. Effort: Medium. Classification: Code.
9. TASK-0252: Add mapping smoke tests. Purpose: cover valid fallback mapping, unsupported task shape, duplicate items, empty executable work, verifier requirements, and no-execution/no-write assertions. Likely files: `packages/core/src/task-contract-runner-planning-mapping-logic.test.ts`. Verification: `pnpm --filter @aeos/core check`. Effort: High. Classification: Code.
10. TASK-0253: Wire parser mapping handoff to core mapper. Purpose: replace parser `unsupported` mapping handoff with safe mapper output while keeping `runnerPlanningExecuted: false`. Likely files: `packages/core/src/task-plan-input-parser.ts`. Verification: `pnpm --filter @aeos/core check`. Effort: Medium. Classification: Code.
11. TASK-0254: Wire `aeos task plan <task-file>` to safe mapping. Purpose: map validated parser output, then call `planAgenticRunner()` only when mapping is safe and still preserve no execution and no writes. Likely files: `apps/cli/src/commands.ts`, `apps/cli/scripts/smoke.mjs`. Verification: `pnpm --filter @aeos/cli check`. Effort: High. Classification: Code.
12. TASK-0255: Add CLI JSON-only mapping smoke tests. Purpose: prove valid, invalid, blocked, and unsupported mapping paths emit exactly one JSON object in JSON mode. Likely files: `apps/cli/scripts/smoke.mjs`. Verification: `pnpm --filter @aeos/cli smoke`. Effort: High. Classification: Code.
13. TASK-0256: Document implemented mapping behavior. Purpose: update usage docs with implemented mapping support and current limitations after code exists. Likely files: `docs/TASK_CONTRACT_TO_RUNNER_PLANNING_MAPPING.md`, `docs/TASK_PLAN_INPUT_PARSER_USAGE.md`. Verification: `git status --short`. Effort: Medium. Classification: Docs.

## Task Plan Input File Backlog

1. TASK-0232: Implement task plan input file parser contracts. Purpose: define CLI-local parser result, parser error, and JSON error code contracts for task plan file input without reading files yet. Likely files: `apps/cli/src/commands.ts`. Verification: `pnpm --filter @aeos/cli check`. Effort: Medium. Classification: Code.
2. TASK-0233: Add task plan argv contract for required file input. Purpose: parse `aeos task plan <task-file> [--json]`, require exactly one positional file, and keep unknown flag errors JSON-only in JSON mode. Likely files: `apps/cli/src/commands.ts`, `apps/cli/scripts/smoke.mjs`. Verification: `pnpm --filter @aeos/cli check`. Effort: Medium. Classification: Code.
3. TASK-0234: Add task plan local path safety checks. Purpose: resolve the input path relative to cwd, reject missing files, directories, unsupported extensions, unsafe traversal, and oversized files. Likely files: `apps/cli/src/commands.ts`, `apps/cli/scripts/smoke.mjs`. Verification: `pnpm --filter @aeos/cli check`. Effort: High. Classification: Code.
4. TASK-0235: Add task plan JSON parse behavior. Purpose: read the checked `.json` file, parse JSON, require an object root, and return stable human and JSON errors. Likely files: `apps/cli/src/commands.ts`, `apps/cli/scripts/smoke.mjs`. Verification: `pnpm --filter @aeos/cli check`. Effort: Medium. Classification: Code.
5. TASK-0236: Reuse AEOS task contract validation for plan input. Purpose: call `validateAeosTask()` after parsing and return non-zero invalid contract output with structured issues. Likely files: `apps/cli/src/commands.ts`, `apps/cli/scripts/smoke.mjs`. Verification: `pnpm --filter @aeos/cli check`. Effort: Medium. Classification: Code.
6. TASK-0237: Add task-to-runner mapping unsupported guard. Purpose: fail closed with `task_plan_mapping_unsupported` until a safe `AeosTask` to `AgenticRunnerPlanningInput` adapter is implemented. Likely files: `apps/cli/src/commands.ts`, `apps/cli/scripts/smoke.mjs`. Verification: `pnpm --filter @aeos/cli check`. Effort: Medium. Classification: Code.
7. TASK-0238: Design task-to-runner planning adapter. Purpose: document the conservative mapping from validated `AeosTask` to represented runner planning input. Likely files: `docs/TASK_PLAN_RUNNER_MAPPING_DESIGN.md`, `TASKS/backlog.md`, `PROJECT_CONTEXT.md`. Verification: `git status --short`. Effort: Medium. Classification: Docs.
8. TASK-0239: Implement minimal task-to-runner planning adapter. Purpose: map validated task identity and contract metadata to `AgenticRunnerPlanningInput` without inventing work items or batches. Likely files: `apps/cli/src/commands.ts`, `apps/cli/scripts/smoke.mjs`. Verification: `pnpm --filter @aeos/cli check`. Effort: High. Classification: Code.
9. TASK-0240: Wire task plan to `planAgenticRunner()`. Purpose: call the side-effect-free planner only after validation and safe mapping, preserving no-execution and no-write guarantees. Likely files: `apps/cli/src/commands.ts`, `apps/cli/scripts/smoke.mjs`. Verification: `pnpm --filter @aeos/cli check`. Effort: High. Classification: Code.
10. TASK-0241: Render final task plan human and JSON output. Purpose: emit the stable Task Plan human fields and JSON top-level shape from the planning result. Likely files: `apps/cli/src/commands.ts`, `apps/cli/scripts/smoke.mjs`. Verification: `pnpm --filter @aeos/cli check`. Effort: Medium. Classification: Code.
11. TASK-0242: Add task plan input file smoke suite. Purpose: cover missing file, invalid JSON, valid no-execution, no-write, JSON-only, and help honesty requirements. Likely files: `apps/cli/scripts/smoke.mjs`. Verification: `pnpm --filter @aeos/cli smoke`. Effort: High. Classification: Code.
12. TASK-0243: Review task plan input file safety. Purpose: confirm parser, validator, mapping, planner call, output, and smoke tests remain deterministic, local-only, read-only, and planner-only. Likely files: `docs/TASK_PLAN_INPUT_FILE_DESIGN.md`, `TASKS/backlog.md`. Verification: `git status --short`. Effort: Medium. Classification: Docs.

## Agentic Task CLI Backlog

1. TASK-0228: Implement agentic task CLI contract/output design. Purpose: add CLI-local output contracts and render helpers for plan, dry-run, unavailable, and JSON error shapes. Likely files: `apps/cli/src/commands.ts`, `apps/cli/src/output.ts`. Verification: `pnpm --filter @aeos/cli check`. Effort: Medium. Classification: Code.
2. TASK-0229: Add agentic task CLI help guardrails. Purpose: update CLI help so MVP commands are listed only with no-execution language and unsupported runtime behavior is not promised. Likely files: `apps/cli/src/commands.ts`, `apps/cli/scripts/smoke.mjs`. Verification: `pnpm --filter @aeos/cli check`. Effort: Low. Classification: Code.
3. TASK-0230: Add agentic task plan command parser shell. Purpose: parse `aeos task plan [path] [--json]`, reject unknown flags, and keep output JSON-only in JSON mode. Likely files: `apps/cli/src/commands.ts`. Verification: `pnpm --filter @aeos/cli check`. Effort: Medium. Classification: Code.
4. TASK-0231: Add local task contract input loader for plan. Purpose: load one explicit local task contract path without remote sources, arbitrary shell execution, or implicit repository scans. Likely files: `apps/cli/src/commands.ts`. Verification: `pnpm --filter @aeos/cli check`. Effort: Medium. Classification: Code.
5. TASK-0232: Wire task plan to core planning helper. Purpose: convert validated task input into represented planning input and call the side-effect-free runner planner. Likely files: `apps/cli/src/commands.ts`, `packages/core/src/agentic-runner-planning.ts`. Verification: `pnpm --filter @aeos/cli check`. Effort: High. Classification: Code.
6. TASK-0233: Render human task plan output. Purpose: print Task Plan, task id, mode, work items, batches, policy, approval required, verifier required, audit expected, and issues. Likely files: `apps/cli/src/commands.ts`, `apps/cli/src/output.ts`. Verification: `pnpm --filter @aeos/cli check`. Effort: Medium. Classification: Code.
7. TASK-0234: Render JSON task plan output. Purpose: emit stable JSON-only plan output with `ok`, `taskId`, `mode`, `plan`, `policy`, `verifier`, `audit`, `resume`, `issues`, and `summary`. Likely files: `apps/cli/src/commands.ts`, `apps/cli/src/output.ts`. Verification: `pnpm --filter @aeos/cli check`. Effort: Medium. Classification: Code.
8. TASK-0235: Add task dry-run command parser shell. Purpose: parse `aeos task run [path] --dry-run [--json]` and reject real `aeos task run` in MVP. Likely files: `apps/cli/src/commands.ts`. Verification: `pnpm --filter @aeos/cli check`. Effort: Medium. Classification: Code.
9. TASK-0236: Convert planning output to dry-run preview input. Purpose: map planner steps, batches, work items, audit expectations, verifier requirements, policy, and resume fields to dry-run input. Likely files: `apps/cli/src/commands.ts`, `packages/core/src/agentic-runner-dry-run.ts`. Verification: `pnpm --filter @aeos/cli check`. Effort: High. Classification: Code.
10. TASK-0237: Wire dry-run command to core dry-run helper. Purpose: call the side-effect-free dry-run helper and preserve no adapter, no audit, no verifier, and no lifecycle mutation guarantees. Likely files: `apps/cli/src/commands.ts`. Verification: `pnpm --filter @aeos/cli check`. Effort: High. Classification: Code.
11. TASK-0238: Render human dry-run output. Purpose: print Task Dry Run, state, planned steps, planned batches, planned work items, adapter calls not executed, audit writes false, verifier run false, completed false, and issues. Likely files: `apps/cli/src/commands.ts`, `apps/cli/src/output.ts`. Verification: `pnpm --filter @aeos/cli check`. Effort: Medium. Classification: Code.
12. TASK-0239: Render JSON dry-run output. Purpose: emit stable JSON-only dry-run output with `ok`, `taskId`, `mode`, `state`, `steps`, `batches`, `workItems`, `adapterCalls`, `audit`, `verifier`, `resume`, `issues`, and `summary`. Likely files: `apps/cli/src/commands.ts`, `apps/cli/src/output.ts`. Verification: `pnpm --filter @aeos/cli check`. Effort: Medium. Classification: Code.
13. TASK-0240: Add unavailable status command behavior. Purpose: implement `aeos task status [--json]` as explicit unavailable or not-implemented output until persisted state exists. Likely files: `apps/cli/src/commands.ts`, `apps/cli/src/output.ts`. Verification: `pnpm --filter @aeos/cli check`. Effort: Low. Classification: Code.
14. TASK-0241: Add unavailable verify command behavior. Purpose: implement `aeos task verify [--json]` as explicit unavailable output until evidence loading and verifier CLI wiring exist. Likely files: `apps/cli/src/commands.ts`, `apps/cli/src/output.ts`. Verification: `pnpm --filter @aeos/cli check`. Effort: Low. Classification: Code.
15. TASK-0242: Add resume dry-run/unavailable behavior. Purpose: implement `aeos task resume`, `aeos task resume --dry-run`, and `aeos task resume --json` as dry-run-first or unavailable output without duplicate completion or cursor writes. Likely files: `apps/cli/src/commands.ts`, `apps/cli/src/output.ts`. Verification: `pnpm --filter @aeos/cli check`. Effort: Medium. Classification: Code.
16. TASK-0243: Add agentic task CLI smoke tests. Purpose: prove JSON-only output, no-write behavior, no adapter calls, no audit writes, verifier not run, completed false, unavailable persistence, unknown flag handling, and help guardrails. Likely files: `apps/cli/scripts/smoke.mjs`. Verification: `pnpm --filter @aeos/cli smoke`. Effort: High. Classification: Code.
17. TASK-0244: Review agentic task CLI MVP safety. Purpose: confirm the implemented MVP remains deterministic, local-first, read-only by default, dry-run first, policy-aware, audit-visible, and verifier-gated. Likely files: `docs/AGENTIC_TASK_CLI_SURFACE.md`, `TASKS/backlog.md`. Verification: `git status --short`. Effort: Medium. Classification: Docs.

## Agentic Runner Dry-Run Execution Backlog

1. TASK-0218: Implement agentic runner dry-run execution contracts. Purpose: add any missing dry-run-specific contract aliases, issue codes, and result examples while preserving existing execution contracts. Likely files: `packages/core/src/agentic-runner-execution.ts`, `packages/core/src/agentic-runner-execution.example.ts`. Verification: `pnpm --filter @aeos/core check`. Effort: Medium. Classification: Code.
2. TASK-0219: Add dry-run plan shape validator. Purpose: reject missing plan, duplicate ids, invalid batch references, and impossible verifier/audit gates. Likely files: `packages/core/src/agentic-runner-execution-logic.ts`. Verification: `pnpm --filter @aeos/core check`. Effort: Medium. Classification: Code.
3. TASK-0220: Add dry-run policy preview mapper. Purpose: map represented policy states to dry-run allowed, blocked, denied, and approval-required previews without policy adapter calls. Likely files: `packages/core/src/agentic-runner-execution-logic.ts`, `packages/core/src/policy.ts`. Verification: `pnpm --filter @aeos/core check`. Effort: Medium. Classification: Code.
4. TASK-0221: Add dry-run approval preview mapper. Purpose: represent approval required, pending, requested, denied, expired, and revoked states without approval side effects. Likely files: `packages/core/src/agentic-runner-execution-logic.ts`. Verification: `pnpm --filter @aeos/core check`. Effort: Medium. Classification: Code.
5. TASK-0222: Add dry-run step execution record builder. Purpose: convert planned steps into pending, blocked, retryable, or verification-required execution records without completed states. Likely files: `packages/core/src/agentic-runner-execution-logic.ts`. Verification: `pnpm --filter @aeos/core check`. Effort: Medium. Classification: Code.
6. TASK-0223: Add dry-run batch execution record builder. Purpose: convert planned batches into deterministic batch records with expected counts and no observed completion claims. Likely files: `packages/core/src/agentic-runner-execution-logic.ts`. Verification: `pnpm --filter @aeos/core check`. Effort: Medium. Classification: Code.
7. TASK-0224: Add dry-run work item outcome preview builder. Purpose: represent pending and retryable work item previews while forbidding dry-run-created completed or verified outcomes. Likely files: `packages/core/src/agentic-runner-execution-logic.ts`. Verification: `pnpm --filter @aeos/core check`. Effort: Medium. Classification: Code.
8. TASK-0225: Add dry-run adapter call planner. Purpose: create planned not-started model/tool adapter call records without invoking adapters and without output references that imply completion. Likely files: `packages/core/src/agentic-runner-execution-logic.ts`, `packages/core/src/adapters.ts`. Verification: `pnpm --filter @aeos/core check`. Effort: Medium. Classification: Code.
9. TASK-0226: Add dry-run audit handoff preview builder. Purpose: compute expected, emitted, and missing audit ids without audit writes. Likely files: `packages/core/src/agentic-runner-execution-logic.ts`, `packages/core/src/audit.ts`. Verification: `pnpm --filter @aeos/core check`. Effort: Medium. Classification: Code.
10. TASK-0227: Add dry-run verifier handoff preview builder. Purpose: mark verifier required, pending/not-run, coverage unknown or incomplete, and completion gate unsatisfied without running verifier logic. Likely files: `packages/core/src/agentic-runner-execution-logic.ts`, `packages/core/src/agentic-coverage-verifier.ts`. Verification: `pnpm --filter @aeos/core check`. Effort: Medium. Classification: Code.
11. TASK-0228: Add dry-run resume preview builder. Purpose: derive next step, next batch, pending ids, and retryable ids from represented plan/lifecycle state without persisting cursor updates. Likely files: `packages/core/src/agentic-runner-execution-logic.ts`. Verification: `pnpm --filter @aeos/core check`. Effort: Medium. Classification: Code.
12. TASK-0229: Add dry-run execution result builder. Purpose: assemble the deterministic `AgenticRunnerExecutionResult`, state, issues, and summary from all dry-run preview records. Likely files: `packages/core/src/agentic-runner-execution-logic.ts`. Verification: `pnpm --filter @aeos/core check`. Effort: High. Classification: Code.
13. TASK-0230: Add dry-run execution examples. Purpose: document safe executable, approval-required, policy-blocked, invalid-plan, and sitemap dry-run results. Likely files: `packages/core/src/agentic-runner-execution.example.ts`. Verification: `pnpm --filter @aeos/core check`. Effort: Low. Classification: Code.
14. TASK-0231: Add dry-run smoke tests. Purpose: test no adapter calls, no audit writes, verifier not run, no completed work items, no completed state, deterministic ordering, and sitemap 400-item behavior. Likely files: `packages/core/src/agentic-runner-execution-logic.test.ts`. Verification: `pnpm --filter @aeos/core check`. Effort: High. Classification: Code.
15. TASK-0232: Document dry-run CLI behavior. Purpose: define future operator behavior for `aeos task run --dry-run`, `aeos task run --dry-run --json`, `aeos agent run --dry-run`, and `aeos task plan` without implementing commands. Likely files: `docs/AGENTIC_TASK_RUNNER_CLI.md`. Verification: `git status --short`. Effort: Medium. Classification: Docs.

## Agentic Runner Execution Backlog

1. TASK-0214: Implement agentic runner execution contracts. Purpose: add execution input, result, state, step result, batch result, observed outcome, and JSON-safe contract types. Likely files: `packages/core/src/agentic-runner.ts`. Verification: `pnpm --filter @aeos/core check`. Effort: Medium. Classification: Code.
2. TASK-0215: Add execution contract examples. Purpose: document safe, partial, blocked, retryable, verifier-incomplete, and completed result examples. Likely files: `packages/core/src/agentic-runner.example.ts`. Verification: `pnpm --filter @aeos/core check`. Effort: Low. Classification: Code.
3. TASK-0216: Implement execution plan validator. Purpose: reject unsafe, non-ok, non-executable, missing-verifier, and missing-audit plans before execution. Likely files: `packages/core/src/agentic-runner-execution-logic.ts`. Verification: `pnpm --filter @aeos/core check`. Effort: Medium. Classification: Code.
4. TASK-0217: Implement execution state transition helper. Purpose: normalize allowed runner state transitions through preflight, approval, running, verification, incomplete, retryable, failed, blocked, cancelled, and completed states. Likely files: `packages/core/src/agentic-runner-execution-logic.ts`. Verification: `pnpm --filter @aeos/core check`. Effort: Medium. Classification: Code.
5. TASK-0218: Implement work item transition validator. Purpose: enforce allowed work item transitions and require reasons for failed, skipped, and retryable states. Likely files: `packages/core/src/agentic-runner-execution-logic.ts`, `packages/core/src/agentic-lifecycle.ts`. Verification: `pnpm --filter @aeos/core check`. Effort: Medium. Classification: Code.
6. TASK-0219: Implement batch execution accounting helper. Purpose: derive batch counts from observed work item states and reject duplicate completion counts. Likely files: `packages/core/src/agentic-runner-execution-logic.ts`. Verification: `pnpm --filter @aeos/core check`. Effort: Medium. Classification: Code.
7. TASK-0220: Implement policy preflight execution mapper. Purpose: map policy adapter decisions to allowed, denied, approval-required, blocked, and failed runner states without running actions. Likely files: `packages/core/src/agentic-runner-execution-logic.ts`, `packages/core/src/policy.ts`. Verification: `pnpm --filter @aeos/core check`. Effort: Medium. Classification: Code.
8. TASK-0221: Implement human approval execution state mapper. Purpose: record approval requested, granted, denied, expired, and revoked states for runner execution. Likely files: `packages/core/src/agentic-runner-execution-logic.ts`, `packages/core/src/policy.ts`. Verification: `pnpm --filter @aeos/core check`. Effort: Medium. Classification: Code.
9. TASK-0222: Implement model adapter result mapper. Purpose: convert model output, refusal, timeout, partial, unsupported, and failed statuses into non-authoritative observed claims and issues. Likely files: `packages/core/src/agentic-runner-execution-logic.ts`, `packages/core/src/adapters.ts`. Verification: `pnpm --filter @aeos/core check`. Effort: Medium. Classification: Code.
10. TASK-0223: Implement tool adapter result mapper. Purpose: convert allowed tool outcomes, side effects, exit codes, and errors into observed item and attempt results. Likely files: `packages/core/src/agentic-runner-execution-logic.ts`, `packages/core/src/adapters.ts`. Verification: `pnpm --filter @aeos/core check`. Effort: High. Classification: Code.
11. TASK-0224: Implement audit event lifecycle builder. Purpose: produce compact runner, policy, approval, batch, work item, verifier, resume, and terminal event drafts. Likely files: `packages/core/src/agentic-runner-execution-logic.ts`, `packages/core/src/audit.ts`. Verification: `pnpm --filter @aeos/core check`. Effort: Medium. Classification: Code.
12. TASK-0225: Implement audit handoff validator. Purpose: require expected audit events before verified or completed runner states. Likely files: `packages/core/src/agentic-runner-execution-logic.ts`. Verification: `pnpm --filter @aeos/core check`. Effort: Medium. Classification: Code.
13. TASK-0226: Implement verifier handoff mapper. Purpose: call or map coverage verifier results into runner states without overriding incomplete results. Likely files: `packages/core/src/agentic-runner-execution-logic.ts`, `packages/core/src/agentic-coverage-verifier-logic.ts`. Verification: `pnpm --filter @aeos/core check`. Effort: High. Classification: Code.
14. TASK-0227: Implement deterministic resume cursor builder for execution. Purpose: derive pending and retryable work ids from observed lifecycle state after partial, failed, blocked, cancelled, or verifier-incomplete execution. Likely files: `packages/core/src/agentic-runner-execution-logic.ts`. Verification: `pnpm --filter @aeos/core check`. Effort: Medium. Classification: Code.
15. TASK-0228: Add execution JSON renderer. Purpose: render compact JSON output with plan, executed steps, work items, batches, policy, audit, verifier, resume, issues, and summary. Likely files: `packages/core/src/agentic-runner-execution-logic.ts` or a renderer module. Verification: `pnpm --filter @aeos/core check`. Effort: Medium. Classification: Code.
16. TASK-0229: Add execution smoke tests. Purpose: cover unsafe plan rejection, policy denial, approval wait, partial batch resume, model self-report rejection, audit gap, verifier incomplete, duplicate completion, and cancellation. Likely files: `packages/core/src/agentic-runner-execution-logic.test.ts`. Verification: `pnpm --filter @aeos/core check`. Effort: High. Classification: Code.
17. TASK-0230: Document task runner CLI behavior. Purpose: define future operator behavior for `aeos task run`, `status`, `resume`, `cancel`, and `verify` without implementing commands. Likely files: `docs/AGENTIC_TASK_RUNNER_CLI.md`. Verification: `git status --short`. Effort: Medium. Classification: Docs.

## Agentic Runner Planning Backlog

1. TASK-0204: Implement agentic runner planning contracts. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
2. TASK-0205: Add agentic runner planning examples. Code. Effort: Low. Verification: `pnpm --filter @aeos/core check`.
3. TASK-0206: Implement planning prerequisite validator. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
4. TASK-0207: Implement work item planning validator. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
5. TASK-0208: Implement deterministic batch plan builder. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
6. TASK-0209: Implement runner step plan builder. Code. Effort: High. Verification: `pnpm --filter @aeos/core check`.
7. TASK-0210: Implement policy gate planning mapper. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
8. TASK-0211: Implement adapter boundary planner. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
9. TASK-0212: Implement audit expectation planner. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
10. TASK-0213: Implement verifier requirement planner. Code. Effort: High. Verification: `pnpm --filter @aeos/core check`.
11. TASK-0214: Implement resume planning helper. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
12. TASK-0215: Add planning JSON renderer. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
13. TASK-0216: Add runner planning smoke tests. Code. Effort: High. Verification: `pnpm --filter @aeos/core check`.
14. TASK-0217: Design task planning CLI behavior. Docs. Effort: Medium. Verification: `git status --short`.

## Agentic Runner Backlog

1. TASK-0200: Implement agentic runner contracts. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
2. TASK-0201: Add agentic runner contract examples. Code. Effort: Low. Verification: `pnpm --filter @aeos/core check`.
3. TASK-0202: Implement runner input validation helper. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
4. TASK-0203: Add policy preflight planner. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
5. TASK-0204: Implement work item inventory planner. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
6. TASK-0205: Implement batch planner. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
7. TASK-0206: Implement adapter execution result mapper. Code. Effort: High. Verification: `pnpm --filter @aeos/core check`.
8. TASK-0207: Add per-batch policy gate helper. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
9. TASK-0208: Implement runner audit event builder. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
10. TASK-0209: Integrate coverage verifier with runner result builder. Code. Effort: High. Verification: `pnpm --filter @aeos/core check`.
11. TASK-0210: Implement deterministic resume cursor builder. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
12. TASK-0211: Add runner JSON result renderer. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
13. TASK-0212: Add runner incomplete coverage smoke examples. Code. Effort: Low. Verification: `pnpm --filter @aeos/core check`.
14. TASK-0213: Add runner smoke tests. Code. Effort: High. Verification: `pnpm --filter @aeos/core check`.
15. TASK-0214: Design agentic task CLI runner behavior. Docs. Effort: Medium. Verification: `git status --short`.
16. TASK-0215: Implement `aeos task run` command shell. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
17. TASK-0216: Implement `aeos task status` command. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
18. TASK-0217: Implement `aeos task resume` command shell. Code. Effort: High. Verification: `pnpm --filter @aeos/cli check`.
19. TASK-0218: Implement `aeos task verify` command. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
20. TASK-0219: Review agentic runner MVP safety. Docs. Effort: Medium. Verification: `git status --short`.

## Agentic Coverage Verifier Backlog

1. TASK-0190: Implement agentic coverage verifier contracts. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
2. TASK-0191: Add agentic coverage verifier contract examples. Code. Effort: Low. Verification: `pnpm --filter @aeos/core check`.
3. TASK-0192: Implement item coverage accounting helper. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
4. TASK-0193: Add item coverage accounting examples. Code. Effort: Low. Verification: `pnpm --filter @aeos/core check`.
5. TASK-0194: Implement artifact coverage accounting helper. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
6. TASK-0195: Add artifact coverage examples. Code. Effort: Low. Verification: `pnpm --filter @aeos/core check`.
7. TASK-0196: Implement inventory completeness checks. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
8. TASK-0197: Implement batch consistency checks. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
9. TASK-0198: Implement resume cursor consistency checks. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
10. TASK-0199: Implement verification snapshot consistency checks. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
11. TASK-0200: Implement audit reference presence checks. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
12. TASK-0201: Implement verifier result builder. Code. Effort: High. Verification: `pnpm --filter @aeos/core check`.
13. TASK-0202: Add verifier smoke tests. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
14. TASK-0203: Design agentic task CLI verifier behavior. Docs. Effort: Medium. Verification: `git status --short`.
15. TASK-0204: Implement verifier JSON renderer. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
16. TASK-0205: Review agentic coverage verifier MVP. Docs. Effort: Medium. Verification: `git status --short`.

## Agentic Task Lifecycle Backlog

1. TASK-0186: Implement agentic task lifecycle contracts. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
2. TASK-0187: Add lifecycle contract examples. Code. Effort: Low. Verification: `pnpm --filter @aeos/core check`.
3. TASK-0188: Implement task state transition validator. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
4. TASK-0189: Implement work item state transition validator. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
5. TASK-0190: Implement lifecycle issue shapes. Code. Effort: Low. Verification: `pnpm --filter @aeos/core check`.
6. TASK-0191: Implement lifecycle JSON result builder. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
7. TASK-0192: Implement basic inventory contract. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
8. TASK-0193: Add inventory examples. Code. Effort: Low. Verification: `pnpm --filter @aeos/core check`.
9. TASK-0194: Implement batch planning contract. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
10. TASK-0195: Implement coverage summary calculator. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
11. TASK-0196: Add item completion rule checks. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
12. TASK-0197: Add artifact completion rule checks. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
13. TASK-0198: Add crawl inventory completion rule checks. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
14. TASK-0199: Implement lifecycle verifier summary adapter boundary. Code. Effort: High. Verification: `pnpm --filter @aeos/core check`.
15. TASK-0200: Implement lifecycle audit reference contract. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
16. TASK-0201: Add lifecycle resume selector. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
17. TASK-0202: Design lifecycle CLI command behavior. Docs. Effort: Medium. Verification: `git status --short`.
18. TASK-0203: Add lifecycle smoke review. Docs. Effort: Medium. Verification: `git status --short`.

## Initial Implementation Backlog

1. TASK-0013: Decide AEOS runtime and package manager. Docs only. Effort: High. Verification: `format_check`.
2. TASK-0014: Create runtime scaffold plan. Docs only. Effort: Medium. Verification: `static_check`.
3. TASK-0015: Create minimal repository scaffold. Code. Effort: Medium. Verification: `existence_check`.
4. TASK-0016: Add base static verification command. Code. Effort: Medium. Verification: `static_check`.
5. TASK-0017: Define shared adapter result types. Code. Effort: Medium. Verification: `unit_test`.
6. TASK-0018: Define policy decision types. Code. Effort: Medium. Verification: `unit_test`.
7. TASK-0019: Define verification report types. Code. Effort: Medium. Verification: `unit_test`.
8. TASK-0020: Define task contract parser. Code. Effort: High. Verification: `unit_test`.
9. TASK-0021: Implement project context reader. Code. Effort: Medium. Verification: `unit_test`.
10. TASK-0022: Implement scoped context bundle builder. Code. Effort: High. Verification: `unit_test`.
11. TASK-0023: Implement file scope validator. Code. Effort: Medium. Verification: `unit_test`.
12. TASK-0024: Implement basic policy classifier. Code. Effort: High. Verification: `security_check`.
13. TASK-0025: Implement local audit event writer. Code. Effort: Medium. Verification: `unit_test`.
14. TASK-0026: Implement verification existence checks. Code. Effort: Medium. Verification: `unit_test`.
15. TASK-0027: Implement documentation format checks. Code. Effort: Medium. Verification: `unit_test`.
16. TASK-0028: Implement memory entry validation. Code. Effort: High. Verification: `security_check`.
17. TASK-0029: Implement local memory read and write adapter. Code. Effort: High. Verification: `unit_test`.
18. TASK-0030: Implement CLI status command. Code. Effort: Medium. Verification: `smoke_test`.
19. TASK-0031: Implement CLI context command. Code. Effort: High. Verification: `smoke_test`.
20. TASK-0032: Implement CLI verify command. Code. Effort: High. Verification: `smoke_test`.

## CLI MVP Backlog

1. TASK-0038: Implement minimal CLI entrypoint and version command. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
2. TASK-0039: Add CLI help output. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
3. TASK-0040: Add CLI command dispatcher. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
4. TASK-0041: Add CLI error and exit-code handling. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
5. TASK-0042: Add CLI smoke check script notes. Docs. Effort: Low. Verification: `test -f docs/CLI_MVP_IMPLEMENTATION_PLAN.md`.
6. TASK-0043: Implement status command skeleton. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
7. TASK-0044: Wire status command to project context file. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
8. TASK-0045: Implement context command skeleton. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
9. TASK-0046: Add context task flag parsing. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
10. TASK-0047: Implement task validate command shell. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
11. TASK-0048: Bind task validate to core helpers. Code. Effort: High. Verification: `pnpm --filter @aeos/cli check`.
12. TASK-0049: Review CLI MVP command consistency. Docs. Effort: Medium. Verification: `git status --short`.

## Project MVP Backlog

1. TASK-0077: Implement project package root detector. Code. Effort: Medium. Verification: `pnpm --filter @aeos/projects check`.
2. TASK-0078: Add project root detector edge cases. Code. Effort: Low. Verification: `pnpm --filter @aeos/projects check`.
3. TASK-0079: Add project context field reader. Code. Effort: Medium. Verification: `pnpm --filter @aeos/projects check`.
4. TASK-0080: Add project context validation issues. Code. Effort: Medium. Verification: `pnpm --filter @aeos/projects check`.
5. TASK-0081: Add project AGENTS presence check. Code. Effort: Low. Verification: `pnpm --filter @aeos/projects check`.
6. TASK-0082: Add project .aeos status check. Code. Effort: Low. Verification: `pnpm --filter @aeos/projects check`.
7. TASK-0083: Add project status summary helper. Code. Effort: Medium. Verification: `pnpm --filter @aeos/projects check`.
8. TASK-0084: Add CLI project command dispatcher. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
9. TASK-0085: Implement aeos project root command. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
10. TASK-0086: Implement aeos project context command. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
11. TASK-0087: Implement aeos project validate command. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
12. TASK-0088: Review Project MVP command behavior. Docs. Effort: Medium. Verification: `git status --short`.

## Project Command MVP Backlog

1. TASK-0082: Implement project status command core flow. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
2. TASK-0083: Add project root command. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
3. TASK-0084: Add project context command. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
4. TASK-0085: Add project validate command. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
5. TASK-0086: Add project command help text. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
6. TASK-0087: Extract project command render helpers. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
7. TASK-0088: Add project command smoke notes. Docs. Effort: Low. Verification: `git status --short`.
8. TASK-0089: Add project status JSON plan checkpoint. Docs. Effort: Low. Verification: `git status --short`.
9. TASK-0090: Implement project status JSON output. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
10. TASK-0091: Implement project context JSON output. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.

## Project Context MVP Backlog

1. TASK-0085: Implement project context command. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
2. TASK-0086: Add project context usage errors. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
3. TASK-0087: Add project context smoke notes. Docs. Effort: Low. Verification: `git status --short`.
4. TASK-0088: Review project context human output. Docs. Effort: Low. Verification: `git status --short`.
5. TASK-0089: Define project context JSON contract. Docs. Effort: Low. Verification: `git status --short`.
6. TASK-0090: Implement project context JSON output. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
7. TASK-0091: Add project context JSON error output. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
8. TASK-0092: Add project context metadata field plan. Docs. Effort: Medium. Verification: `git status --short`.
9. TASK-0093: Extend project context metadata reader. Code. Effort: Medium. Verification: `pnpm --filter @aeos/projects check`.
10. TASK-0094: Render expanded project context fields. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.

## Project Validate MVP Backlog

1. TASK-0088: Implement project validate command. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
2. TASK-0089: Add project validate usage handling. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
3. TASK-0090: Add project validate smoke notes. Docs. Effort: Low. Verification: `git status --short`.
4. TASK-0091: Review project validate human output. Docs. Effort: Low. Verification: `git status --short`.
5. TASK-0092: Define project validate JSON contract. Docs. Effort: Low. Verification: `git status --short`.
6. TASK-0093: Implement project validate JSON output. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
7. TASK-0094: Extract project validation builder. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
8. TASK-0095: Plan project validation package API. Docs. Effort: Low. Verification: `git status --short`.
9. TASK-0096: Implement project validation package API. Code. Effort: Medium. Verification: `pnpm --filter @aeos/projects check`.
10. TASK-0097: Review project validate MVP behavior. Docs. Effort: Medium. Verification: `git status --short`.

## Template MVP Backlog

1. TASK-0092: Implement template package metadata reader. Code. Effort: Medium. Verification: `pnpm --filter @aeos/templates check`.
2. TASK-0093: Add template metadata validation issues. Code. Effort: Medium. Verification: `pnpm --filter @aeos/templates check`.
3. TASK-0094: Implement local template discovery. Code. Effort: Medium. Verification: `pnpm --filter @aeos/templates check`.
4. TASK-0095: Implement template selection by ID. Code. Effort: Low. Verification: `pnpm --filter @aeos/templates check`.
5. TASK-0096: Implement template variable validation. Code. Effort: Medium. Verification: `pnpm --filter @aeos/templates check`.
6. TASK-0097: Define template placeholder rendering contract. Docs. Effort: Low. Verification: `git status --short`.
7. TASK-0098: Implement template content substitution. Code. Effort: Medium. Verification: `pnpm --filter @aeos/templates check`.
8. TASK-0099: Implement template render plan builder. Code. Effort: Medium. Verification: `pnpm --filter @aeos/templates check`.
9. TASK-0100: Add render path safety validation. Code. Effort: Medium. Verification: `pnpm --filter @aeos/templates check`.
10. TASK-0101: Implement safe template file generation. Code. Effort: High. Verification: `pnpm --filter @aeos/templates check`.
11. TASK-0102: Add template verification hook results. Code. Effort: Medium. Verification: `pnpm --filter @aeos/templates check`.
12. TASK-0103: Review Template MVP package behavior. Docs. Effort: Medium. Verification: `git status --short`.

## Template Discovery MVP Backlog

1. TASK-0095: Implement template discovery engine. Code. Effort: Low. Verification: `pnpm --filter @aeos/templates check`.
2. TASK-0096: Add template metadata filename constant. Code. Effort: Low. Verification: `pnpm --filter @aeos/templates check`.
3. TASK-0097: Implement templates root entry reader. Code. Effort: Medium. Verification: `pnpm --filter @aeos/templates check`.
4. TASK-0098: Filter direct child template directories. Code. Effort: Low. Verification: `pnpm --filter @aeos/templates check`.
5. TASK-0099: Build template candidate metadata paths. Code. Effort: Low. Verification: `pnpm --filter @aeos/templates check`.
6. TASK-0100: Read candidate metadata during discovery. Code. Effort: Medium. Verification: `pnpm --filter @aeos/templates check`.
7. TASK-0101: Sort discovered templates and discovery issues. Code. Effort: Low. Verification: `pnpm --filter @aeos/templates check`.
8. TASK-0102: Detect duplicate template IDs. Code. Effort: Medium. Verification: `pnpm --filter @aeos/templates check`.
9. TASK-0103: Implement template selection by ID. Code. Effort: Medium. Verification: `pnpm --filter @aeos/templates check`.
10. TASK-0104: Add template discovery examples. Code. Effort: Medium. Verification: `pnpm --filter @aeos/templates check`.

## Template Rendering MVP Backlog

1. TASK-0100: Implement template variable resolver. Code. Effort: Medium. Verification: `pnpm --filter @aeos/templates check`.
2. TASK-0101: Add variable resolver examples. Code. Effort: Low. Verification: `pnpm --filter @aeos/templates check`.
3. TASK-0102: Define template source file reader. Code. Effort: Medium. Verification: `pnpm --filter @aeos/templates check`.
4. TASK-0103: Validate template source paths. Code. Effort: Medium. Verification: `pnpm --filter @aeos/templates check`.
5. TASK-0104: Define placeholder substitution contract. Code/docs. Effort: Low. Verification: `pnpm --filter @aeos/templates check`.
6. TASK-0105: Implement template content substitution. Code. Effort: Medium. Verification: `pnpm --filter @aeos/templates check`.
7. TASK-0106: Build template file mapping helper. Code. Effort: Medium. Verification: `pnpm --filter @aeos/templates check`.
8. TASK-0107: Implement render plan builder. Code. Effort: Medium. Verification: `pnpm --filter @aeos/templates check`.
9. TASK-0108: Add render plan validation. Code. Effort: Medium. Verification: `pnpm --filter @aeos/templates check`.
10. TASK-0109: Implement target conflict checker. Code. Effort: Medium. Verification: `pnpm --filter @aeos/templates check`.
11. TASK-0110: Implement safe file generation. Code. Effort: High. Verification: `pnpm --filter @aeos/templates check`.
12. TASK-0111: Add rendering verification summary. Code. Effort: Medium. Verification: `pnpm --filter @aeos/templates check`.

## Init MVP Backlog

1. TASK-0106: Implement init workflow contracts. Code. Effort: Medium. Verification: `pnpm --filter @aeos/templates check`.
2. TASK-0107: Add init request validation. Code. Effort: Medium. Verification: `pnpm --filter @aeos/templates check`.
3. TASK-0108: Add init project detection adapter. Code. Effort: Medium. Verification: `pnpm --filter @aeos/templates check`.
4. TASK-0109: Add init template selection adapter. Code. Effort: Medium. Verification: `pnpm --filter @aeos/templates check`.
5. TASK-0110: Add init variable resolution step. Code. Effort: Medium. Verification: `pnpm --filter @aeos/templates check`.
6. TASK-0111: Add init render planning step. Code. Effort: Medium. Verification: `pnpm --filter @aeos/templates check`.
7. TASK-0112: Add init path safety validation. Code. Effort: Medium. Verification: `pnpm --filter @aeos/templates check`.
8. TASK-0113: Add init conflict detection. Code. Effort: Medium. Verification: `pnpm --filter @aeos/templates check`.
9. TASK-0114: Add init safe generation step. Code. Effort: High. Verification: `pnpm --filter @aeos/templates check`.
10. TASK-0115: Add init post-generation validation. Code. Effort: Medium. Verification: `pnpm --filter @aeos/templates check`.
11. TASK-0116: Add init audit-ready summary. Code. Effort: Low. Verification: `pnpm --filter @aeos/templates check`.
12. TASK-0117: Add init memory-ready summary. Code. Effort: Low. Verification: `pnpm --filter @aeos/templates check`.
13. TASK-0118: Add aeos init CLI routing. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
14. TASK-0119: Add aeos init human output. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
15. TASK-0120: Review init MVP behavior. Docs. Effort: Medium. Verification: `git status --short`.

## Init Engine MVP Backlog

1. TASK-0109: Implement init execution engine contracts. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
2. TASK-0110: Add init engine request validation. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
3. TASK-0111: Add init project detection stage. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
4. TASK-0112: Add init template discovery stage. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
5. TASK-0113: Add init template selection stage. Code. Effort: Low. Verification: `pnpm --filter @aeos/core check`.
6. TASK-0114: Add init variable resolution stage. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
7. TASK-0115: Define init render plan structure. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
8. TASK-0116: Implement init render planning. Code. Effort: High. Verification: `pnpm --filter @aeos/core check`.
9. TASK-0117: Add init path safety checks. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
10. TASK-0118: Add init conflict preflight. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
11. TASK-0119: Implement init file writing stage. Code. Effort: High. Verification: `pnpm --filter @aeos/core check`.
12. TASK-0120: Add init write failure reporting. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
13. TASK-0121: Add init post-generation validation. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
14. TASK-0122: Add init audit and memory summaries. Code. Effort: Low. Verification: `pnpm --filter @aeos/core check`.
15. TASK-0123: Review init engine MVP behavior. Docs. Effort: Medium. Verification: `git status --short`.

## Init Pipeline MVP Backlog

1. TASK-0112: Implement init pipeline executor. Code. Effort: High. Verification: `pnpm --filter @aeos/core check`.
2. TASK-0113: Add init pipeline executor examples. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
3. TASK-0114: Implement init request preflight validation. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
4. TASK-0115: Implement project detection stage adapter. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
5. TASK-0116: Add project detection stage examples. Code. Effort: Low. Verification: `pnpm --filter @aeos/core check`.
6. TASK-0117: Implement template selection stage adapter. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
7. TASK-0118: Add template selection stage examples. Code. Effort: Low. Verification: `pnpm --filter @aeos/core check`.
8. TASK-0119: Implement variable resolution stage adapter. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
9. TASK-0120: Add variable resolution stage examples. Code. Effort: Low. Verification: `pnpm --filter @aeos/core check`.
10. TASK-0121: Implement render plan stage. Code. Effort: High. Verification: `pnpm --filter @aeos/core check`.
11. TASK-0122: Add render plan stage examples. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
12. TASK-0123: Implement file writing stage. Code. Effort: High. Verification: `pnpm --filter @aeos/core check`.
13. TASK-0124: Add file writing stage examples. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
14. TASK-0125: Implement init validation summary builder. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
15. TASK-0126: Review init pipeline MVP behavior. Docs. Effort: Medium. Verification: `git status --short`.

## Init Pipeline Integration MVP Backlog

1. TASK-0115: Implement init adapters. Code. Effort: High. Verification: `pnpm --filter @aeos/core check`.
2. TASK-0116: Add init adapter examples. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
3. TASK-0117: Implement project detection integration adapter. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
4. TASK-0118: Add project detection integration examples. Code. Effort: Low. Verification: `pnpm --filter @aeos/core check`.
5. TASK-0119: Implement template selection integration adapter. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
6. TASK-0120: Add template selection integration examples. Code. Effort: Low. Verification: `pnpm --filter @aeos/core check`.
7. TASK-0121: Implement variable resolution integration adapter. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
8. TASK-0122: Add variable resolution integration examples. Code. Effort: Low. Verification: `pnpm --filter @aeos/core check`.
9. TASK-0123: Implement rendering integration adapter. Code. Effort: High. Verification: `pnpm --filter @aeos/core check`.
10. TASK-0124: Add rendering integration examples. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
11. TASK-0125: Add file writing placeholder integration. Code. Effort: Low. Verification: `pnpm --filter @aeos/core check`.
12. TASK-0126: Add audit-ready summary integration. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
13. TASK-0127: Add memory-ready summary integration. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
14. TASK-0128: Review integration boundary behavior. Docs. Effort: Medium. Verification: `git status --short`.
15. TASK-0129: Define filesystem generation follow-up plan. Docs. Effort: Medium. Verification: `git status --short`.

## Init CLI MVP Backlog

1. TASK-0122: Implement aeos init command routing. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
2. TASK-0123: Add init help text. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
3. TASK-0124: Parse init boolean flags. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
4. TASK-0125: Parse init template flag. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
5. TASK-0126: Parse init variable flags. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
6. TASK-0127: Add init JSON error output. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
7. TASK-0128: Add init human error output. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
8. TASK-0129: Load core init pipeline from CLI. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
9. TASK-0130: Build init request from CLI input. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
10. TASK-0131: Implement non-interactive init execution. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
11. TASK-0132: Add init human result output. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
12. TASK-0133: Add init JSON success output. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
13. TASK-0134: Implement init dry-run CLI behavior. Code. Effort: High. Verification: `pnpm --filter @aeos/cli check`.
14. TASK-0135: Add init interactive prompts. Code. Effort: High. Verification: `pnpm --filter @aeos/cli check`.
15. TASK-0136: Review init CLI MVP behavior. Code/docs. Effort: Medium. Verification: `git status --short`.

## Init Generation MVP Backlog

1. TASK-0125: Implement generation contracts. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
2. TASK-0126: Add generation contract examples. Code. Effort: Low. Verification: `pnpm --filter @aeos/core check`.
3. TASK-0127: Implement target path normalization. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
4. TASK-0128: Add target path safety examples. Code. Effort: Low. Verification: `pnpm --filter @aeos/core check`.
5. TASK-0129: Build generation plan from rendered artifacts. Code. Effort: High. Verification: `pnpm --filter @aeos/core check`.
6. TASK-0130: Add generation plan builder examples. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
7. TASK-0131: Implement generation conflict checker. Code. Effort: High. Verification: `pnpm --filter @aeos/core check`.
8. TASK-0132: Add conflict checker examples. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
9. TASK-0133: Implement dry-run generation result. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
10. TASK-0134: Add dry-run generation examples. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
11. TASK-0135: Implement safe directory creation. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
12. TASK-0136: Implement safe file writes. Code. Effort: High. Verification: `pnpm --filter @aeos/core check`.
13. TASK-0137: Add write failure reporting. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
14. TASK-0138: Integrate generation with file writing stage. Code. Effort: High. Verification: `pnpm --filter @aeos/core check`.
15. TASK-0139: Review generation MVP behavior. Docs. Effort: Medium. Verification: `git status --short`.

## Init Write Mode CLI Backlog

1. TASK-0139: Implement aeos init --write flag skeleton. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
2. TASK-0140: Add init mode output contract. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
3. TASK-0141: Add target root output contract. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
4. TASK-0142: Add init conflict output shape. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
5. TASK-0143: Wire write mode to pipeline options behind a safety block. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
6. TASK-0144: Add human write confirmation gate. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
7. TASK-0145: Add filesystem adapter construction for init write mode. Code. Effort: High. Verification: `pnpm --filter @aeos/cli check`.
8. TASK-0146: Add write-mode conflict smoke tests. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
9. TASK-0147: Add write-mode success smoke tests. Code. Effort: High. Verification: `pnpm --filter @aeos/cli check`.
10. TASK-0148: Review init write mode MVP behavior. Docs. Effort: Medium. Verification: `git status --short`.

## Project Intelligence Detector Backlog

1. TASK-0150: Implement intelligence detector input contracts. Code. Effort: Medium. Verification: `pnpm --filter @aeos/projects check`.
2. TASK-0151: Add intelligence detector contract examples. Code. Effort: Low. Verification: `pnpm --filter @aeos/projects check`.
3. TASK-0152: Implement evidence helper contracts. Code. Effort: Medium. Verification: `pnpm --filter @aeos/projects check`.
4. TASK-0153: Implement bounded filesystem inventory. Code. Effort: High. Verification: `pnpm --filter @aeos/projects check`.
5. TASK-0154: Implement package manager signals. Code. Effort: Medium. Verification: `pnpm --filter @aeos/projects check`.
6. TASK-0155: Implement runtime signals. Code. Effort: Medium. Verification: `pnpm --filter @aeos/projects check`.
7. TASK-0156: Implement language signals. Code. Effort: Medium. Verification: `pnpm --filter @aeos/projects check`.
8. TASK-0157: Implement framework signals. Code. Effort: High. Verification: `pnpm --filter @aeos/projects check`.
9. TASK-0158: Implement infrastructure signals. Code. Effort: Medium. Verification: `pnpm --filter @aeos/projects check`.
10. TASK-0159: Implement monorepo signals. Code. Effort: Medium. Verification: `pnpm --filter @aeos/projects check`.
11. TASK-0160: Implement confidence and ambiguity normalization. Code. Effort: Medium. Verification: `pnpm --filter @aeos/projects check`.
12. TASK-0161: Implement intelligence profile builder. Code. Effort: High. Verification: `pnpm --filter @aeos/projects check`.
13. TASK-0162: Add detector stack examples. Code. Effort: Medium. Verification: `pnpm --filter @aeos/projects check`.
14. TASK-0163: Define project profile CLI integration. Docs. Effort: Low. Verification: `git status --short`.

## Project Profile CLI Backlog

1. TASK-0167: Implement aeos project profile command. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
2. TASK-0168: Add project profile help text. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
3. TASK-0169: Add project profile JSON shape tests. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
4. TASK-0170: Add project profile human smoke tests. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
5. TASK-0171: Review profile command scan defaults. Docs/code. Effort: Low. Verification: `git status --short`.
6. TASK-0172: Add project profile issue rendering polish. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
7. TASK-0173: Add project profile invalid flag handling. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
8. TASK-0174: Review project profile MVP behavior. Docs. Effort: Medium. Verification: `git status --short`.
9. TASK-0175: Design explicit hidden config handling. Docs. Effort: Medium. Verification: `git status --short`.

## Smart Init Template Selection Backlog

1. TASK-0172: Implement smart template selection contracts. Code. Effort: Medium. Verification: `pnpm --filter @aeos/templates check`.
2. TASK-0173: Add smart selection contract examples. Code. Effort: Low. Verification: `pnpm --filter @aeos/templates check`.
3. TASK-0174: Extend template metadata with selection tags. Code. Effort: Medium. Verification: `pnpm --filter @aeos/templates check`.
4. TASK-0175: Add metadata validation examples for selection tags. Code. Effort: Low. Verification: `pnpm --filter @aeos/templates check`.
5. TASK-0176: Implement profile summary adapter for smart selection. Code. Effort: Medium. Verification: `pnpm --filter @aeos/templates check`.
6. TASK-0177: Implement deterministic candidate scoring. Code. Effort: High. Verification: `pnpm --filter @aeos/templates check`.
7. TASK-0178: Add smart scoring examples. Code. Effort: Medium. Verification: `pnpm --filter @aeos/templates check`.
8. TASK-0179: Implement ambiguity and fallback normalization. Code. Effort: Medium. Verification: `pnpm --filter @aeos/templates check`.
9. TASK-0180: Integrate smart selection into init planning. Code. Effort: High. Verification: `pnpm --filter @aeos/core check`.
10. TASK-0181: Add init smart selection examples. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
11. TASK-0182: Add aeos init --smart CLI routing. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
12. TASK-0183: Add template recommend CLI command. Code. Effort: High. Verification: `pnpm --filter @aeos/cli check`.
13. TASK-0184: Add smart selection smoke tests. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.

## Template Recommend CLI Backlog

1. TASK-0178: Implement built-in smart template candidates. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
2. TASK-0179: Add project profile adapter for template recommendation. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
3. TASK-0180: Add template recommend command routing. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
4. TASK-0181: Wire Project Intelligence to smart selector. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
5. TASK-0182: Add template recommend human output. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
6. TASK-0183: Add template recommend JSON output. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
7. TASK-0184: Add template recommend usage and failure handling. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
8. TASK-0185: Add template recommend smoke tests. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
9. TASK-0186: Review template recommend MVP behavior. Docs. Effort: Medium. Verification: `git status --short`.

## Memory MVP Backlog

1. TASK-0057: Implement memory package Markdown entry builder. Code. Effort: Medium. Verification: `pnpm --filter @aeos/memory check`.
2. TASK-0058: Add memory filename and slug helpers. Code. Effort: Low. Verification: `pnpm --filter @aeos/memory check`.
3. TASK-0059: Tighten core memory frontmatter validation. Code. Effort: Medium. Verification: `pnpm --filter @aeos/core check`.
4. TASK-0060: Implement memory Markdown parser. Code. Effort: Medium. Verification: `pnpm --filter @aeos/memory check`.
5. TASK-0061: Implement memory file validation. Code. Effort: High. Verification: `pnpm --filter @aeos/memory check`.
6. TASK-0062: Add memory secret-content blocking. Code. Effort: Medium. Verification: `pnpm --filter @aeos/memory check`.
7. TASK-0063: Implement local memory writer. Code. Effort: High. Verification: `pnpm --filter @aeos/memory check`.
8. TASK-0064: Implement file-based memory search. Code. Effort: High. Verification: `pnpm --filter @aeos/memory check`.
9. TASK-0065: Add memory validate CLI command. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
10. TASK-0066: Add memory search CLI command. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
11. TASK-0067: Add remember CLI command. Code. Effort: High. Verification: `pnpm --filter @aeos/cli check`.
12. TASK-0068: Review Memory MVP command behavior. Docs. Effort: Medium. Verification: `git status --short`.

## Remember Command MVP Backlog

1. TASK-0067: Implement remember command core flow. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
2. TASK-0068: Add remember command usage errors. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
3. TASK-0069: Add remember command interactive input. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
4. TASK-0070: Add remember input normalization helper. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
5. TASK-0071: Add remember validation output. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
6. TASK-0072: Add remember prepared artifact output. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
7. TASK-0073: Add remember source task and tag flags. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
8. TASK-0074: Add remember JSON output placeholder. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
9. TASK-0075: Add remember smoke verification. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
10. TASK-0076: Review remember command MVP behavior. Docs. Effort: Medium. Verification: `git status --short`.

## Search Command MVP Backlog

1. TASK-0073: Implement aeos search command core flow. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
2. TASK-0074: Add search command usage errors. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
3. TASK-0075: Add memory file reader for search indexing. Code. Effort: High. Verification: `pnpm --filter @aeos/memory check`.
4. TASK-0076: Add search type filter. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
5. TASK-0077: Add deterministic search result formatting. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
6. TASK-0078: Add search no-results behavior. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
7. TASK-0079: Add search command smoke checks. Code. Effort: Medium. Verification: `pnpm --filter @aeos/cli check`.
8. TASK-0080: Add search JSON output placeholder. Code. Effort: Low. Verification: `pnpm --filter @aeos/cli check`.
9. TASK-0081: Review search command deterministic behavior. Docs. Effort: Medium. Verification: `git status --short`.
10. TASK-0082: Update search command context handoff. Docs. Effort: Low. Verification: `git status --short`.
