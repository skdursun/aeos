# Task Contract To Runner Planning Mapping

## Purpose
Define how a parsed and validated AEOS task contract can be mapped into
`AgenticRunnerPlanningInput` for `aeos task plan`.

This is design-only. It does not implement mapping logic, CLI behavior, runner
planning execution, task persistence, audit runtime, verifier execution,
model/tool adapters, or filesystem IO.

## Current Foundation Status
The current foundation is intentionally conservative:

- `AeosTask` exists in `packages/core/src/tasks.ts`.
- `validateAeosTask()` checks task identity, required context, stop condition,
  and exact file boundary conflicts.
- The task plan input parser can parse one local JSON file and optionally
  validate the current `AeosTask` shape.
- Parser mapping handoff is currently `unsupported` after validation.
- `AgenticRunnerPlanningInput` and `planAgenticRunner()` already exist.
- Runner planning is side-effect-free and validates represented work items,
  batches, policy, adapters, audit expectations, verifier requirements, and
  resume data.

The current `AeosTask` contract does not include first-class `workItems`,
`batches`, lifecycle inventory, adapter references, audit references, or resume
cursors. Those facts limit the MVP mapping surface.

## Why Mapping Is Needed
`aeos task plan <task-file>` needs a boundary between validated task input and
runner planning. The parser should not guess runner state, and the planner
should receive represented planning input rather than raw CLI text.

The mapping layer makes this boundary explicit:

- task contract validation proves only the current task contract shape;
- mapping proves whether that validated task can be represented for runner
  planning;
- runner planning validates represented planning state without executing work.

## Mapping Responsibilities
The mapper should:

- accept only a validated `AeosTask`;
- require a stable task id;
- set runner planning `mode` to `plan`;
- attach task metadata as the task contract authority;
- derive supported work items deterministically;
- derive supported batches deterministically;
- map allowed and forbidden operations as adapter boundary references;
- map risk and approval metadata into policy requirements where available;
- represent audit expectations without emitting events;
- require verifier-gated completion for executable plans;
- represent resume metadata only as preview data when available;
- return explicit issues for unsupported shapes;
- preserve `noExecution: true` and `noWrites: true` in its result concept.

## Mapping Non-Responsibilities
The mapper must not:

- parse files;
- validate raw task contracts;
- run `planAgenticRunner()`;
- execute the task;
- call model, agent, tool, MCP, policy, audit, verifier, memory, project, or
  template adapters;
- write audit events;
- run verifier logic;
- persist task, lifecycle, audit, or resume state;
- read or mutate the filesystem;
- mark work items completed;
- mark the task completed;
- infer inventory by scanning the repository;
- trust model self-reporting.

## Input Model
MVP input is a validated `AeosTask` plus mapping options:

- `task`: the validated current `AeosTask`;
- `sourceFile`: optional parser source reference;
- `mode`: `plan` only for `aeos task plan`;
- `outputMode`: human, JSON, or summary metadata only;
- `noExecution: true`;
- `noWrites: true`;
- `trustModelSelfReporting: false`.

The mapper must receive validation status from the parser or caller. If
validation did not pass, mapping is blocked.

## Output Model
MVP output is a mapping result, not a planning result:

- `ok`;
- `taskId`;
- `mappingStatus`: `mapped`, `unsupported`, or `blocked`;
- optional `planningInput`;
- normalized issues;
- summary counts and safety flags.

`planningInput`, when present, is an `AgenticRunnerPlanningInput`. `ok: true`
means only that mapping succeeded. It does not mean runner planning ran,
execution occurred, verifier passed, audit was written, or completion happened.

## Supported MVP Task Contract Fields
The mapper may use these current `AeosTask` fields:

- `id`: maps to `AgenticRunnerPlanningInput.taskId`.
- `title` and `purpose`: become task metadata and fallback work item metadata.
- `status`: recorded as task metadata only.
- `executionMode`: influences conservative policy metadata and fallback work
  item metadata.
- `context.load`: recorded as allowed read context metadata.
- `context.doNotLoad`: recorded as denied read metadata.
- `fileBoundary.filesToModify`: recorded as allowed write candidate metadata.
- `fileBoundary.filesNotToTouch`: recorded as denied write metadata.
- `allowedOperations`: maps to allowed operation references.
- `forbiddenOperations`: maps to denied operation references.
- `steps`: may be summarized as task instructions metadata; they are not runner
  step execution proof.
- `verification`: maps to verifier requirement metadata.
- `stopCondition`: recorded as task scope metadata.
- `riskProfile`: maps to policy requirement metadata when present.
- `modelRecommendation`: maps only as model adapter preference metadata, not as
  an adapter call.
- `metadata`: used only for explicitly recognized, non-executing preview fields
  in later implementations.

## Unsupported Fields
These are unsupported in the current task contract or unsupported for MVP
mapping:

- first-class `workItems` on `AeosTask`;
- first-class `batches` on `AeosTask`;
- lifecycle inventory;
- persisted lifecycle state;
- persisted audit references;
- persisted resume cursors;
- executable adapter instances;
- raw prompts;
- full model outputs;
- broad repository snapshots;
- implicit task discovery;
- Markdown-derived structured work inventory;
- metadata-defined work items unless a later typed contract validates them.

If input depends on unsupported fields to produce a faithful plan, mapping must
return `unsupported` rather than guessing.

## Validation Prerequisites
Mapping can begin only after:

- the input JSON root was parsed as an object;
- the value matched the current `AeosTask` shape;
- `validateAeosTask()` returned `valid: true`;
- `task.id` is non-empty;
- required task context is present;
- required stop condition is present;
- exact `filesToModify` and `filesNotToTouch` conflicts are absent;
- parser path and format checks passed when invoked from the CLI.

Validation does not prove runner compatibility. Mapping still has to fail
closed for unsupported task shapes.

## Mapping Flow
```text
Parsed task contract
   |
   v
Validated task contract
   |
   v
Mapping preflight
   |
   v
Work item derivation
   |
   v
Batch derivation
   |
   v
Policy/adapters/audit/verifier requirements
   |
   v
AgenticRunnerPlanningInput
   |
   v
planAgenticRunner()
```

The final `planAgenticRunner()` step belongs to CLI or caller orchestration after
safe mapping. It is not performed by the mapper.

## Work Item Mapping
Work items are the accountable units of runner progress.

MVP options:

- Option A, explicit `workItems`: unsupported today because `AeosTask` does not
  define a first-class `workItems` field and validation does not validate one.
- Option B, single work item fallback: supported only for a validated generic
  task contract that can honestly be represented as one whole-task unit.
- Option C, inventory-derived work items: later scope, because it requires typed
  inventory input and must not scan the repository.

MVP single-item fallback:

- work item id: `work-item:${task.id}`;
- state: `pending`;
- title: task title;
- source: `task:${task.id}`;
- expected artifacts: stable file paths from `fileBoundary.filesToModify`;
- issues: empty unless the mapper detects unsupported shape.

The fallback is a mapping limitation. It cannot represent multi-item crawls,
large inventories, per-file subtasks, generated batch plans, partial prior work,
or retryable item state. If the task contract or recognized metadata implies
multiple accountable items but does not provide typed validated work items,
mapping must return `unsupported`.

## Batch Mapping
MVP batch mapping is deterministic and conservative:

- default batch id: `batch:${task.id}:001`;
- default batch contains the single fallback work item;
- batch item ids must reference mapped work items;
- `expectedItemCount` must equal `workItemIds.length`;
- no empty executable batch is allowed;
- duplicate work item ids are invalid;
- missing batch references are invalid;
- duplicate membership across batches is invalid;
- explicitly empty batch lists are invalid for executable mapping.

Because current `AeosTask` has no first-class batches, any explicit batch support
must wait for a typed contract extension or a separate validated lifecycle input.

## Step Mapping
MVP mapping should produce planning input that causes runner planning to include:

- `policy_preflight`;
- `batch_execution`;
- `verification`;
- `resume_update` only if resume preview data exists.

An `approval` step should appear only when mapped policy or adapter boundary
data explicitly requires approval. Mapping must not create approval from model
confidence or human-looking text in task instructions.

Task contract `steps` are source instructions. They do not directly become
completed runner steps.

## Policy Mapping
Policy mapping uses task contract metadata where available:

- `riskProfile.riskClass`;
- `riskProfile.permissionLevel`;
- `riskProfile.requiresApproval`;
- `riskProfile.rationale`;
- `allowedOperations`;
- `forbiddenOperations`;
- file and context boundaries.

If policy metadata is unavailable, the mapper should create a conservative
`not_evaluated` or approval-aware policy requirement rather than an allow claim.

Rules:

- denied or blocked policy must prevent an executable plan;
- approval required must be explicit;
- approval does not broaden task scope;
- unsupported policy modes produce mapping issues;
- risky operations without explicit support should be denied or
  approval-required, not silently allowed.

## Adapter Boundary Mapping
Adapter mapping is reference-only:

- `modelRecommendation` may become metadata about preferred capabilities;
- no concrete model adapter call is made;
- no tool or MCP adapter call is made;
- allowed operations are copied as allowed operation references;
- forbidden operations are copied as denied operation references;
- denied operations remain explicit;
- approval required is explicit where risk metadata requires it.

Unsupported adapter references, unavailable adapter kinds, and metadata that
requires real adapter inspection are mapping issues.

## Audit Expectation Mapping
Mapping should represent expected audit behavior only.

Expected MVP event ids should be deterministic, for example:

- `audit-policy-preflight-planned`;
- `audit-batch:<task-id>:001-planned`;
- `audit-verifier-handoff-planned`;
- `audit-resume-update-planned` when resume preview data exists.

Expected event kinds should include:

- `policy.preflight.planned`;
- `batch.execution.planned`;
- `verification.handoff.planned`;
- `resume.update.planned` when needed.

The mapper must not emit events. Missing audit events are future verifier or
runtime concerns unless the mapping input explicitly represents missing required
event ids.

## Verifier Requirement Mapping
Every mapped executable plan must require verifier handoff:

- `verifierRequired: true`;
- `completionGatedByVerifier: true`;
- expected coverage rule:
  `expected_items == completed_items + explicitly_failed_items + explicitly_skipped_items`.

The mapper must not run the verifier, simulate verifier success, or produce
completed state. Planning can represent verification requirements only.

## Resume Mapping
MVP does not persist resume state.

If future task input includes typed resume metadata, mapping may copy it only as
preview/input data:

- resume cursor reference;
- next step id;
- next batch id;
- pending work item ids;
- retryable work item ids;
- update timestamp from represented input.

Current `AeosTask` has no first-class resume field, so resume mapping is
unsupported unless a later typed contract adds one. Metadata resume hints must
not be trusted as persisted state.

## Issue/Error Mapping
Mapping must return normalized issues for:

- invalid task contract;
- unsupported task shape;
- missing task id;
- duplicate work item ids;
- empty work item set for executable mapping;
- empty batch list;
- missing batch item reference;
- unsupported adapter reference;
- unsupported policy mode;
- unsupported mapping target;
- unsupported metadata-derived inventory;
- verifier requirement disabled;
- completion gate disabled;
- policy denied or blocked;
- approval required without explicit approval state;
- any requested mapping behavior that would require IO or execution.

Errors should fail closed. Mapping issues should be deterministic and should not
include raw prompts, full model output, secrets, broad file contents, or raw
command logs.

## No-Execution Guarantees
Mapping must not execute the task.

It must not:

- call model/tool adapters;
- write audit events;
- run verifier;
- persist task state;
- mutate files;
- mark work items completed.

It also must not call policy adapters, run shell commands, inspect Git state,
query MCP servers, deploy, migrate, install dependencies, or infer status from
model output.

## No-Write Guarantees
The mapper must be pure over provided data:

- no source writes;
- no generated files;
- no audit writes;
- no lifecycle writes;
- no resume cursor writes;
- no memory writes;
- no package writes;
- no Git writes;
- no deployment writes;
- no filesystem reads or writes.

Any later CLI file reading is parser responsibility before mapping, not mapper
responsibility.

## JSON Output Concept
The mapping result JSON concept is:

```json
{
  "ok": false,
  "taskId": "...",
  "mappingStatus": "unsupported",
  "planningInput": {},
  "issues": [],
  "summary": {
    "workItemCount": 0,
    "batchCount": 0,
    "verifierRequired": true,
    "noExecution": true,
    "noWrites": true
  }
}
```

When `mappingStatus` is `mapped`, `planningInput` may contain the safe
`AgenticRunnerPlanningInput`. When `mappingStatus` is `unsupported` or
`blocked`, `planningInput` should be omitted or empty and issues must explain
why.

JSON mode must remain JSON-only after CLI integration.

## CLI Integration Concept
Future command flow:

```text
aeos task plan <task-file>
```

Flow:

1. Parse one explicit local task file.
2. Validate the task contract.
3. Map the validated contract to `AgenticRunnerPlanningInput`.
4. Run `planAgenticRunner()` only after mapping is safe.
5. Render human output or JSON-only output.

This command still performs no execution. It must not call adapters, write
audit, run verifier logic, persist state, mutate files, or mark completion.

## MVP Mapping Strategy
For the first implementation, prefer a conservative mapping from a validated
task contract into:

- task id;
- `mode: "plan"`;
- task contract metadata;
- one fallback pending work item when the task can safely be represented as one
  whole-task unit;
- one deterministic batch for that item;
- policy requirements from `riskProfile` and operation boundaries where
  available;
- adapter boundary references only;
- audit expectations only;
- `verifierRequired: true`;
- `completionGatedByVerifier: true`;
- no adapter calls;
- no audit writes;
- no execution state;
- no completed work item state.

If the contract needs explicit inventory, explicit work item accounting, real
adapter discovery, persistence, or filesystem inspection to plan honestly, MVP
mapping returns `unsupported`.

## Implemented MVP Notes
The implemented mapper is a pure, deterministic, no-execution, no-write helper.
It can map a validated task contract in `plan` mode to a single pending fallback
work item and one default batch when fallback is allowed and the shape is safe.

Explicit `workItems` and `batches` remain unsupported because the current
`AeosTask` contract does not validate those fields. The mapper reports those
cases honestly instead of inventing support or producing fake success.
Any explicit work item or batch examples in contract-level fixtures are
illustrative typed shapes for later scope, not current runtime mapper support.

The mapper does not run `planAgenticRunner()`, runner execution, adapters,
audit writes, verifier logic, persistence, or filesystem mutation. Model or task
text claims of completion or approval are not trusted, and verifier-gated
completion remains required for supported executable mapping.

## MVP Scope
MVP scope:

- mapping result contract;
- pure mapping helper design;
- validation-pass preflight;
- single whole-task work item fallback;
- single deterministic batch fallback;
- policy metadata mapping;
- adapter boundary metadata mapping;
- audit expectation mapping;
- verifier requirement mapping;
- fail-closed unsupported mapping issues;
- smoke tests over local in-memory data.

## Later Scope
Later scope may include:

- typed task-contract `workItems`;
- typed task-contract `batches`;
- inventory-derived work items from explicit inventory files;
- lifecycle-driven resume mapping;
- persisted audit reference mapping;
- richer policy profile mapping;
- adapter capability routing;
- batch sizing options;
- dry-run mapping;
- verifier evidence loading;
- persisted plan storage.

## Non-Goals
- Implement mapping code in this task.
- Implement CLI behavior in this task.
- Run `planAgenticRunner()` in this task.
- Implement runner execution.
- Implement adapter calls.
- Implement audit runtime.
- Implement verifier runtime.
- Implement persistence.
- Add dependencies.
- Modify package files.
- Scan the repository.
- Trust model self-reporting.

## Smoke Test Requirements
Future smoke tests should prove:

- valid minimal task contract maps to planning input or explicit unsupported
  mapping;
- invalid or unsupported task shape fails closed;
- duplicate work items fail;
- empty work items fail for executable plan;
- mapped executable plans set verifier required true;
- mapped executable plans set completion gated by verifier true;
- mapping performs no adapter calls;
- mapping performs no audit writes;
- mapping performs no verifier run;
- mapping performs no task persistence;
- mapping performs no filesystem writes;
- JSON-only output remains one JSON object after CLI integration.

## Implementation Sequence
Do not start these tasks from this design task.

1. TASK-0244: Implement task contract mapping contracts.
   Purpose: add mapping result, issue, status, options, and summary contracts
   without mapping logic.
   Likely files: `packages/core/src/task-contract-runner-planning-mapping.ts`.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: Medium.
   Classification: Code.

2. TASK-0245: Add task contract mapping contract examples.
   Purpose: provide mapped, unsupported, blocked, verifier-required, and
   no-execution example objects.
   Likely files: `packages/core/src/task-contract-runner-planning-mapping.example.ts`.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: Low.
   Classification: Code.

3. TASK-0246: Add mapping preflight helper.
   Purpose: block mapping unless validation passed, task id exists, target mode
   is supported, and no execution/write options are true.
   Likely files: `packages/core/src/task-contract-runner-planning-mapping-logic.ts`.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: Medium.
   Classification: Code.

4. TASK-0247: Add single work item fallback mapper.
   Purpose: map a validated generic `AeosTask` into one pending whole-task work
   item when the task shape does not require inventory.
   Likely files: `packages/core/src/task-contract-runner-planning-mapping-logic.ts`.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: Medium.
   Classification: Code.

5. TASK-0248: Add deterministic fallback batch mapper.
   Purpose: map fallback work items into one deterministic batch and reject
   empty or duplicate item references.
   Likely files: `packages/core/src/task-contract-runner-planning-mapping-logic.ts`.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: Medium.
   Classification: Code.

6. TASK-0249: Add policy and operation boundary mapper.
   Purpose: map `riskProfile`, allowed operations, forbidden operations, context
   scope, and file boundaries into policy and adapter boundary planning input.
   Likely files: `packages/core/src/task-contract-runner-planning-mapping-logic.ts`.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: High.
   Classification: Code.

7. TASK-0250: Add audit and verifier requirement mapper.
   Purpose: create expected audit event ids and verifier-gated requirements
   without emitting audit events or running verifier logic.
   Likely files: `packages/core/src/task-contract-runner-planning-mapping-logic.ts`.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: Medium.
   Classification: Code.

8. TASK-0251: Add unsupported metadata and adapter reference guards.
   Purpose: fail closed for untyped metadata work items, batches, resume data,
   unsupported adapter references, and unsupported mapping targets.
   Likely files: `packages/core/src/task-contract-runner-planning-mapping-logic.ts`.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: Medium.
   Classification: Code.

9. TASK-0252: Add mapping smoke tests.
   Purpose: cover valid fallback mapping, unsupported task shape, duplicate
   items, empty executable work, verifier requirements, and no-execution/no-write
   assertions.
   Likely files: `packages/core/src/task-contract-runner-planning-mapping-logic.test.ts`.
   Verification command: `pnpm --filter @aeos/core check`.
   Recommended model effort: High.
   Classification: Code.

10. TASK-0253: Wire parser mapping handoff to core mapper.
    Purpose: replace parser `unsupported` mapping handoff with safe mapper
    output while keeping `runnerPlanningExecuted: false`.
    Likely files: `packages/core/src/task-plan-input-parser.ts`.
    Verification command: `pnpm --filter @aeos/core check`.
    Recommended model effort: Medium.
    Classification: Code.

11. TASK-0254: Wire `aeos task plan <task-file>` to safe mapping.
    Purpose: map validated parser output, then call `planAgenticRunner()` only
    when mapping is safe and still preserve no execution and no writes.
    Likely files: `apps/cli/src/commands.ts`, `apps/cli/scripts/smoke.mjs`.
    Verification command: `pnpm --filter @aeos/cli check`.
    Recommended model effort: High.
    Classification: Code.

12. TASK-0255: Add CLI JSON-only mapping smoke tests.
    Purpose: prove valid, invalid, blocked, and unsupported mapping paths emit
    exactly one JSON object in JSON mode.
    Likely files: `apps/cli/scripts/smoke.mjs`.
    Verification command: `pnpm --filter @aeos/cli smoke`.
    Recommended model effort: High.
    Classification: Code.

13. TASK-0256: Document implemented mapping behavior.
    Purpose: update usage docs with the implemented mapping support and current
    limitations after code exists.
    Likely files: `docs/TASK_CONTRACT_TO_RUNNER_PLANNING_MAPPING.md`,
    `docs/TASK_PLAN_INPUT_PARSER_USAGE.md`.
    Verification command: `git status --short`.
    Recommended model effort: Medium.
    Classification: Docs.
