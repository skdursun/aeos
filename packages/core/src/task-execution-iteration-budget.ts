import type { AgenticTaskId } from "./agentic-lifecycle.js";
import { loadTaskState, updateTaskState } from "./task-state-persistence.js";
import type { AeosError, Result } from "./types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const AEOS_ITERATION_BUDGET_SCHEMA_VERSION = 1;

/**
 * The system policy ceiling.  No operator configuration may exceed these
 * values, and nothing in this module raises them.  Unbounded autonomy is
 * explicitly forbidden: there is no "unlimited" sentinel, no null meaning
 * "no cap", and every limit is a finite non-negative integer.
 */
export const AEOS_ITERATION_BUDGET_POLICY_CEILING: IterationBudgetLimits = {
  maxSteps: 25,
  maxWallTimeMs: 30 * 60 * 1000,
  maxPlannerCalls: 25,
  // Every launch costs a step, so the effective cap on any single kind is
  // min(itsLimit, maxSteps).  A per-kind ceiling above maxSteps would be
  // phantom headroom: an operator reading it would believe they had permitted
  // more invocations than maxSteps can ever allow.  All per-kind ceilings are
  // therefore held at or below the step ceiling.
  maxWorkerCalls: 25,
  maxRetries: 5,
};

/**
 * The conservative default applied when an operator configures nothing.
 *
 * These values reproduce the existing one-hop behaviour exactly, so adopting
 * the budget contract cannot silently change what a current run may do.
 *
 * "One hop" in this repository is a planner call FOLLOWED BY a worker call —
 * `TaskExecutionTwoModelCanaryResult` carries `plannerCalls: 0 | 1` and
 * `workerCalls: 0 | 1` as separate counters.  Since every launch costs a step,
 * that is TWO steps, not one.  maxSteps is 2 for exactly that reason: a
 * maxSteps of 1 would refuse the worker call of an existing one-hop run and
 * would be a breaking config requirement disguised as a conservative default.
 *
 * The per-kind caps of 1 are what actually pin the shape to one hop: at most
 * one planner call and at most one worker call, with no retries.
 */
export const AEOS_ITERATION_BUDGET_SYSTEM_DEFAULT: IterationBudgetLimits = {
  maxSteps: 2,
  maxWallTimeMs: 5 * 60 * 1000,
  maxPlannerCalls: 1,
  maxWorkerCalls: 1,
  maxRetries: 0,
};

/**
 * Order in which limits are checked.  Fixed and exported so that a run which
 * exhausts several limits at the same moment always reports the same stop
 * reason — a stop reason that varied with evaluation order would not be
 * durable evidence of anything.
 *
 * Wall time is checked first because it keeps advancing whether or not the
 * run does anything; a wall-time exhausted run is stopped even if it never
 * consumed a step.
 */
export const AEOS_ITERATION_BUDGET_STOP_REASON_PRECEDENCE: readonly IterationStopReason[] =
  [
    "max_wall_time_exhausted",
    "max_steps_exhausted",
    "max_planner_calls_exhausted",
    "max_worker_calls_exhausted",
    "max_retries_exhausted",
  ];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IterationBudgetLimits {
  readonly maxSteps: number;
  readonly maxWallTimeMs: number;
  readonly maxPlannerCalls: number;
  readonly maxWorkerCalls: number;
  readonly maxRetries: number;
}

export interface IterationBudgetConsumption {
  readonly steps: number;
  readonly plannerCalls: number;
  readonly workerCalls: number;
  readonly retries: number;
}

export type IterationStopReason =
  | "max_wall_time_exhausted"
  | "max_steps_exhausted"
  | "max_planner_calls_exhausted"
  | "max_worker_calls_exhausted"
  | "max_retries_exhausted";

/**
 * Who set the limits.  Both values are AEOS-owned: "system_default" means the
 * conservative default was applied, "operator" means a human operator supplied
 * policy-bounded values.  There is deliberately no "planner" or "worker"
 * authority — a model cannot be the source of a limit.
 */
export type IterationBudgetLimitsAuthority = "system_default" | "operator";

export type IterationLaunchKind = "planner_call" | "worker_call" | "retry";

export interface PersistedIterationBudget {
  readonly schemaVersion: typeof AEOS_ITERATION_BUDGET_SCHEMA_VERSION;
  readonly budgetId: string;
  readonly limits: IterationBudgetLimits;
  readonly limitsAuthority: IterationBudgetLimitsAuthority;
  readonly consumption: IterationBudgetConsumption;
  readonly startedAt: string;
  /** Durable, operator-visible reason the run stopped; null while running. */
  readonly stopReason: IterationStopReason | null;
  readonly stoppedAt: string | null;
}

export interface IterationBudgetRemaining {
  readonly steps: number;
  readonly wallTimeMs: number;
  readonly plannerCalls: number;
  readonly workerCalls: number;
  readonly retries: number;
}

interface IterationBudgetDecisionBase {
  readonly nextLaunch: IterationLaunchKind;
  readonly remaining: IterationBudgetRemaining;
  readonly elapsedMs: number;
  readonly evaluatedAt: string;
  readonly safety: IterationBudgetAuthorityMarkers;
}

/**
 * Discriminated on `allowed` so the type system enforces what the runtime
 * already guarantees: a refusal always carries a stop reason.  A caller that
 * branches on `!decision.allowed` gets a non-null `stopReason` without a null
 * check, and cannot forget one.
 */
export type IterationBudgetDecision =
  | (IterationBudgetDecisionBase & {
      readonly allowed: true;
      readonly stopReason: null;
    })
  | (IterationBudgetDecisionBase & {
      readonly allowed: false;
      readonly stopReason: IterationStopReason;
    });

export interface IterationBudgetAuthorityMarkers {
  readonly authority: "system";
  readonly modelProposedLimitsAccepted: false;
  readonly unboundedAutonomyPermitted: false;
}

export type IterationBudgetError = AeosError;

export interface CreateIterationBudgetInput {
  readonly budgetId: string;
  readonly startedAt: string;
  /**
   * Operator-supplied limits.  Every field is optional; omitted fields take
   * the conservative system default.  Supplying any field marks the budget
   * "operator" authority.  Values are policy-bounded, never clamped silently.
   */
  readonly operatorLimits?: Partial<IterationBudgetLimits>;
}

export interface EvaluateIterationBudgetInput {
  readonly budget: PersistedIterationBudget;
  readonly nextLaunch: IterationLaunchKind;
  readonly evaluatedAt: string;
}

export interface RefuseIterationBudgetProposalInput {
  readonly budget: PersistedIterationBudget;
  /** Whatever the model asked for.  Never read — only its origin matters. */
  readonly proposedLimits: Partial<IterationBudgetLimits>;
  readonly proposedBy: "planner" | "worker" | "model";
}

export interface RecordIterationBudgetLaunchInput {
  readonly projectRoot: string;
  readonly taskId: AgenticTaskId;
  readonly expectedTaskRevision: number;
  readonly nextLaunch: IterationLaunchKind;
  readonly occurredAt: string;
}

export interface RecordIterationBudgetLaunchResult {
  readonly budget: PersistedIterationBudget;
  readonly decision: IterationBudgetDecision;
  readonly taskStateRevision: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const LIMIT_FIELDS: readonly (keyof IterationBudgetLimits)[] = [
  "maxSteps",
  "maxWallTimeMs",
  "maxPlannerCalls",
  "maxWorkerCalls",
  "maxRetries",
];

const AUTHORITY_MARKERS: IterationBudgetAuthorityMarkers = {
  authority: "system",
  modelProposedLimitsAccepted: false,
  unboundedAutonomyPermitted: false,
};

function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

function err(error: IterationBudgetError): Result<never, IterationBudgetError> {
  return { ok: false, error };
}

function createError(
  code: string,
  message: string,
  category: AeosError["category"],
  details?: Record<string, string | number | boolean | null>,
): IterationBudgetError {
  return details === undefined
    ? { code, message, category, retryable: false }
    : { code, message, category, retryable: false, details };
}

function isBoundedCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

// Takes `unknown` deliberately: call sites validate values read back from
// durable state, so the typeof guard has to be a real runtime check rather
// than a branch the compiler has already proved unreachable.
function parseTimestamp(
  value: unknown,
  field: string,
): Result<number, IterationBudgetError> {
  if (typeof value !== "string") {
    return err(
      createError(
        "iteration_budget_invalid_timestamp",
        "Iteration budget timestamps must be parseable ISO-8601 strings.",
        "validation",
        { field },
      ),
    );
  }

  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    return err(
      createError(
        "iteration_budget_invalid_timestamp",
        "Iteration budget timestamps must be parseable ISO-8601 strings.",
        "validation",
        { field },
      ),
    );
  }

  return ok(parsed);
}

// ---------------------------------------------------------------------------
// Public API — limit resolution
// ---------------------------------------------------------------------------

/**
 * Resolve operator-supplied limits against the system policy ceiling.
 *
 * Authority boundary:
 *  - Values above the ceiling are REFUSED, never clamped.  Silent clamping
 *    would let a caller request unbounded autonomy and receive a success
 *    result, which is exactly the confusion this contract exists to prevent.
 *  - Zero is a legal limit and is enforced as "nothing may launch".
 *  - There is no sentinel for "unlimited".  A missing field takes the
 *    conservative default; it never means "uncapped".
 */
export function resolveIterationBudgetLimits(
  operatorLimits?: Partial<IterationBudgetLimits>,
): Result<
  {
    readonly limits: IterationBudgetLimits;
    readonly authority: IterationBudgetLimitsAuthority;
  },
  IterationBudgetError
> {
  if (operatorLimits === undefined) {
    return ok({
      limits: { ...AEOS_ITERATION_BUDGET_SYSTEM_DEFAULT },
      authority: "system_default",
    });
  }

  const resolved: Record<string, number> = {
    ...AEOS_ITERATION_BUDGET_SYSTEM_DEFAULT,
  };
  let operatorSuppliedAny = false;

  for (const field of LIMIT_FIELDS) {
    const supplied = operatorLimits[field];

    if (supplied === undefined) {
      continue;
    }

    operatorSuppliedAny = true;

    if (!isBoundedCount(supplied)) {
      return err(
        createError(
          "iteration_budget_invalid_limit",
          "Iteration budget limits must be non-negative safe integers.",
          "validation",
          { field },
        ),
      );
    }

    const ceiling = AEOS_ITERATION_BUDGET_POLICY_CEILING[field];

    if (supplied > ceiling) {
      return err(
        createError(
          "iteration_budget_limit_exceeds_policy_ceiling",
          "Iteration budget limits cannot exceed the system policy ceiling.",
          "policy",
          { field, requested: supplied, ceiling },
        ),
      );
    }

    resolved[field] = supplied;
  }

  return ok({
    limits: resolved as unknown as IterationBudgetLimits,
    authority: operatorSuppliedAny ? "operator" : "system_default",
  });
}

/**
 * Create a durable iteration budget with zero consumption.
 */
export function createIterationBudget(
  input: CreateIterationBudgetInput,
): Result<PersistedIterationBudget, IterationBudgetError> {
  if (typeof input.budgetId !== "string" || input.budgetId.length === 0) {
    return err(
      createError(
        "iteration_budget_id_required",
        "Iteration budget id must be a non-empty string.",
        "validation",
      ),
    );
  }

  const startedAtResult = parseTimestamp(input.startedAt, "startedAt");

  if (!startedAtResult.ok) {
    return startedAtResult;
  }

  const limitsResult = resolveIterationBudgetLimits(input.operatorLimits);

  if (!limitsResult.ok) {
    return limitsResult;
  }

  return ok({
    schemaVersion: AEOS_ITERATION_BUDGET_SCHEMA_VERSION,
    budgetId: input.budgetId,
    limits: limitsResult.value.limits,
    limitsAuthority: limitsResult.value.authority,
    consumption: { steps: 0, plannerCalls: 0, workerCalls: 0, retries: 0 },
    startedAt: input.startedAt,
    stopReason: null,
    stoppedAt: null,
  });
}

// ---------------------------------------------------------------------------
// Public API — validation
// ---------------------------------------------------------------------------

/**
 * Validate a budget read back from durable state.  A corrupted or hand-edited
 * budget is refused rather than repaired: a budget that cannot be trusted must
 * not authorise a launch.
 */
export function validatePersistedIterationBudget(
  value: unknown,
): Result<PersistedIterationBudget, IterationBudgetError> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return err(
      createError(
        "iteration_budget_invalid_record",
        "Persisted iteration budget must be an object.",
        "validation",
      ),
    );
  }

  const record = value as Record<string, unknown>;

  if (record.schemaVersion !== AEOS_ITERATION_BUDGET_SCHEMA_VERSION) {
    return err(
      createError(
        "iteration_budget_unsupported_schema_version",
        "Persisted iteration budget schema version is not supported.",
        "validation",
        {
          expected: AEOS_ITERATION_BUDGET_SCHEMA_VERSION,
          actual:
            typeof record.schemaVersion === "number"
              ? record.schemaVersion
              : null,
        },
      ),
    );
  }

  if (typeof record.budgetId !== "string" || record.budgetId.length === 0) {
    return err(
      createError(
        "iteration_budget_id_required",
        "Persisted iteration budget id must be a non-empty string.",
        "validation",
      ),
    );
  }

  if (
    record.limitsAuthority !== "system_default" &&
    record.limitsAuthority !== "operator"
  ) {
    return err(
      createError(
        "iteration_budget_invalid_limits_authority",
        "Persisted iteration budget limits authority must be system_default or operator.",
        "validation",
      ),
    );
  }

  const limits = record.limits;

  if (typeof limits !== "object" || limits === null || Array.isArray(limits)) {
    return err(
      createError(
        "iteration_budget_invalid_limits",
        "Persisted iteration budget limits must be an object.",
        "validation",
      ),
    );
  }

  const limitsRecord = limits as Record<string, unknown>;

  for (const field of LIMIT_FIELDS) {
    const limit = limitsRecord[field];

    if (!isBoundedCount(limit)) {
      return err(
        createError(
          "iteration_budget_invalid_limit",
          "Persisted iteration budget limits must be non-negative safe integers.",
          "validation",
          { field },
        ),
      );
    }

    // A persisted budget above the ceiling means the ceiling was lowered after
    // the budget was written, or the file was edited by hand.  Either way it
    // must not authorise anything.
    if (limit > AEOS_ITERATION_BUDGET_POLICY_CEILING[field]) {
      return err(
        createError(
          "iteration_budget_limit_exceeds_policy_ceiling",
          "Persisted iteration budget limits cannot exceed the system policy ceiling.",
          "policy",
          {
            field,
            persisted: limit,
            ceiling: AEOS_ITERATION_BUDGET_POLICY_CEILING[field],
          },
        ),
      );
    }
  }

  const consumption = record.consumption;

  if (
    typeof consumption !== "object" ||
    consumption === null ||
    Array.isArray(consumption)
  ) {
    return err(
      createError(
        "iteration_budget_invalid_consumption",
        "Persisted iteration budget consumption must be an object.",
        "validation",
      ),
    );
  }

  const consumptionRecord = consumption as Record<string, unknown>;

  for (const field of ["steps", "plannerCalls", "workerCalls", "retries"] as const) {
    if (!isBoundedCount(consumptionRecord[field])) {
      return err(
        createError(
          "iteration_budget_invalid_consumption",
          "Persisted iteration budget consumption counters must be non-negative safe integers.",
          "validation",
          { field },
        ),
      );
    }
  }

  // Overconsumption is corruption, not exhaustion.  The recording path always
  // evaluates before it increments, so consumption can never legitimately pass
  // its own limit.  Without this check, a hand-built or deserialised budget
  // handed straight to evaluateIterationBudget would be classified merely
  // "exhausted" and its corruption would go unreported — the durable path
  // catches it, but the pure path is reachable on its own.
  for (const [consumed, limit] of [
    ["steps", "maxSteps"],
    ["plannerCalls", "maxPlannerCalls"],
    ["workerCalls", "maxWorkerCalls"],
    ["retries", "maxRetries"],
  ] as const) {
    if (
      (consumptionRecord[consumed] as number) >
      (limitsRecord[limit] as number)
    ) {
      return err(
        createError(
          "iteration_budget_overconsumed",
          "Iteration budget consumption cannot exceed its own limit.",
          "validation",
          {
            counter: consumed,
            consumed: consumptionRecord[consumed] as number,
            limit: limitsRecord[limit] as number,
          },
        ),
      );
    }
  }

  const startedAtResult = parseTimestamp(record.startedAt, "startedAt");

  if (!startedAtResult.ok) {
    return startedAtResult;
  }

  if (
    record.stopReason !== null &&
    !AEOS_ITERATION_BUDGET_STOP_REASON_PRECEDENCE.includes(
      record.stopReason as IterationStopReason,
    )
  ) {
    return err(
      createError(
        "iteration_budget_invalid_stop_reason",
        "Persisted iteration budget stop reason is not a recognised reason.",
        "validation",
      ),
    );
  }

  // `undefined !== null` is true in JavaScript, so an object that simply omits
  // the key would otherwise be rejected as a running budget carrying a stop
  // timestamp.  Both absent forms mean "not stopped".
  if (
    record.stopReason === null &&
    record.stoppedAt !== null &&
    record.stoppedAt !== undefined
  ) {
    return err(
      createError(
        "iteration_budget_inconsistent_stop_state",
        "Persisted iteration budget cannot carry a stop timestamp without a stop reason.",
        "validation",
      ),
    );
  }

  if (record.stopReason !== null) {
    if (typeof record.stoppedAt !== "string") {
      return err(
        createError(
          "iteration_budget_inconsistent_stop_state",
          "Persisted iteration budget cannot carry a stop reason without a stop timestamp.",
          "validation",
        ),
      );
    }

    // A stop reason is only operator-usable evidence if its timestamp is real.
    // An unparseable stoppedAt would be emitted verbatim by both projections.
    const stoppedAtResult = parseTimestamp(record.stoppedAt, "stoppedAt");

    if (!stoppedAtResult.ok) {
      return stoppedAtResult;
    }
  }

  return ok(record as unknown as PersistedIterationBudget);
}

// ---------------------------------------------------------------------------
// Public API — evaluation
// ---------------------------------------------------------------------------

function remainingFor(
  budget: PersistedIterationBudget,
  elapsedMs: number,
): IterationBudgetRemaining {
  const { limits, consumption } = budget;

  return {
    steps: Math.max(0, limits.maxSteps - consumption.steps),
    wallTimeMs: Math.max(0, limits.maxWallTimeMs - elapsedMs),
    plannerCalls: Math.max(0, limits.maxPlannerCalls - consumption.plannerCalls),
    workerCalls: Math.max(0, limits.maxWorkerCalls - consumption.workerCalls),
    retries: Math.max(0, limits.maxRetries - consumption.retries),
  };
}

/**
 * Decide whether one more launch of `nextLaunch` is permitted.
 *
 * Authority boundary:
 *  - The only inputs are the durable budget and the clock.  Nothing a planner
 *    or worker returns is consulted, so no model output can widen a budget or
 *    suppress a stop reason.
 *  - An already-stopped budget stays stopped.  A consumed stop is never reset,
 *    matching the AEOS rule that consumed one-shot authority is not restored.
 *  - Limits are checked in the fixed precedence order above, so simultaneous
 *    exhaustion always yields the same durable stop reason.
 *  - Every launch costs a step.  A launch kind additionally costs its own
 *    counter: planner_call -> plannerCalls, worker_call -> workerCalls,
 *    retry -> workerCalls AND retries.
 *
 *    A retry counts against maxWorkerCalls because a retry re-invokes a
 *    worker.  If it did not, maxWorkerCalls would not cap worker invocations
 *    at all: an operator setting maxWorkerCalls=1 and maxRetries=5 would get
 *    six real invocations against a stated cap of one.  maxRetries is a
 *    sub-cap on top of maxWorkerCalls, never an escape from it.  A retry is
 *    therefore refused when EITHER limit is reached.
 */
export function evaluateIterationBudget(
  input: EvaluateIterationBudgetInput,
): Result<IterationBudgetDecision, IterationBudgetError> {
  const budgetResult = validatePersistedIterationBudget(input.budget);

  if (!budgetResult.ok) {
    return budgetResult;
  }

  const budget = budgetResult.value;

  if (
    input.nextLaunch !== "planner_call" &&
    input.nextLaunch !== "worker_call" &&
    input.nextLaunch !== "retry"
  ) {
    return err(
      createError(
        "iteration_budget_invalid_launch_kind",
        "Iteration budget launch kind must be planner_call, worker_call or retry.",
        "validation",
      ),
    );
  }

  const startedAtResult = parseTimestamp(budget.startedAt, "startedAt");

  if (!startedAtResult.ok) {
    return startedAtResult;
  }

  const evaluatedAtResult = parseTimestamp(input.evaluatedAt, "evaluatedAt");

  if (!evaluatedAtResult.ok) {
    return evaluatedAtResult;
  }

  // A clock that has moved backwards relative to the budget start cannot be
  // used to prove a wall-time limit is still satisfied.
  if (evaluatedAtResult.value < startedAtResult.value) {
    return err(
      createError(
        "iteration_budget_evaluation_before_start",
        "Iteration budget cannot be evaluated at a time before it started.",
        "validation",
        { startedAt: budget.startedAt, evaluatedAt: input.evaluatedAt },
      ),
    );
  }

  const elapsedMs = evaluatedAtResult.value - startedAtResult.value;
  const remaining = remainingFor(budget, elapsedMs);

  // An already-stopped budget stays stopped, whatever the counters say.
  if (budget.stopReason !== null) {
    return ok({
      allowed: false,
      stopReason: budget.stopReason,
      nextLaunch: input.nextLaunch,
      remaining,
      elapsedMs,
      evaluatedAt: input.evaluatedAt,
      safety: AUTHORITY_MARKERS,
    });
  }

  const exhausted: Record<IterationStopReason, boolean> = {
    max_wall_time_exhausted: elapsedMs >= budget.limits.maxWallTimeMs,
    max_steps_exhausted: budget.consumption.steps >= budget.limits.maxSteps,
    max_planner_calls_exhausted:
      input.nextLaunch === "planner_call" &&
      budget.consumption.plannerCalls >= budget.limits.maxPlannerCalls,
    // A retry re-invokes a worker, so it is checked against maxWorkerCalls too.
    max_worker_calls_exhausted:
      (input.nextLaunch === "worker_call" || input.nextLaunch === "retry") &&
      budget.consumption.workerCalls >= budget.limits.maxWorkerCalls,
    max_retries_exhausted:
      input.nextLaunch === "retry" &&
      budget.consumption.retries >= budget.limits.maxRetries,
  };

  for (const reason of AEOS_ITERATION_BUDGET_STOP_REASON_PRECEDENCE) {
    if (exhausted[reason]) {
      return ok({
        allowed: false,
        stopReason: reason,
        nextLaunch: input.nextLaunch,
        remaining,
        elapsedMs,
        evaluatedAt: input.evaluatedAt,
        safety: AUTHORITY_MARKERS,
      });
    }
  }

  return ok({
    allowed: true,
    stopReason: null,
    nextLaunch: input.nextLaunch,
    remaining,
    elapsedMs,
    evaluatedAt: input.evaluatedAt,
    safety: AUTHORITY_MARKERS,
  });
}

/**
 * The model-proposal boundary, expressed as code rather than prose.
 *
 * A planner or worker may emit anything it likes; this function always
 * refuses.  It exists so that the refusal is a call site with a durable error
 * code that a test can assert, instead of an absence of code that a future
 * change could quietly fill in.  `proposedLimits` is never read.
 */
export function refuseIterationBudgetProposal(
  input: RefuseIterationBudgetProposalInput,
): Result<never, IterationBudgetError> {
  return err(
    createError(
      "iteration_budget_model_proposal_refused",
      "Iteration budget limits are system/operator authority; planner and worker output cannot change them.",
      "policy",
      {
        proposedBy: input.proposedBy,
        budgetId: input.budget.budgetId,
        limitsAuthority: input.budget.limitsAuthority,
      },
    ),
  );
}

// ---------------------------------------------------------------------------
// Public API — durable recording
// ---------------------------------------------------------------------------

/**
 * Evaluate and, if permitted, durably record one launch against the budget
 * stored on the task state.
 *
 * The budget lives inside the persisted task state rather than in a parallel
 * store, so it inherits that layer's optimistic-locking revision guard,
 * atomic write and restart read-back rather than reimplementing them.
 *
 * When the decision refuses, NOTHING is written: a refused launch consumes no
 * budget, and the durable stop reason is recorded exactly once, on the
 * transition from running to stopped.
 */
export async function recordIterationBudgetLaunch(
  input: RecordIterationBudgetLaunchInput,
): Promise<Result<RecordIterationBudgetLaunchResult, IterationBudgetError>> {
  const stateResult = await loadTaskState({
    projectRoot: input.projectRoot,
    taskId: input.taskId,
  });

  if (!stateResult.ok) {
    return stateResult;
  }

  const state = stateResult.value.state;

  if (state.revision !== input.expectedTaskRevision) {
    return err(
      createError(
        "task_state_revision_conflict",
        "Persisted task state revision did not match the expected revision.",
        "conflict",
        {
          expectedRevision: input.expectedTaskRevision,
          actualRevision: state.revision,
        },
      ),
    );
  }

  if (state.iterationBudget === undefined) {
    return err(
      createError(
        "iteration_budget_not_present",
        "Task state carries no iteration budget; a launch cannot be recorded against it.",
        "validation",
        { taskId: input.taskId },
      ),
    );
  }

  const decisionResult = evaluateIterationBudget({
    budget: state.iterationBudget,
    nextLaunch: input.nextLaunch,
    evaluatedAt: input.occurredAt,
  });

  if (!decisionResult.ok) {
    return decisionResult;
  }

  const decision = decisionResult.value;
  const current = state.iterationBudget;

  if (!decision.allowed) {
    // Record the stop reason durably on the first refusal only.  A budget that
    // is already stopped is left byte-identical — a consumed stop is never
    // re-stamped with a later timestamp.
    if (current.stopReason !== null) {
      return ok({
        budget: current,
        decision,
        taskStateRevision: state.revision,
      });
    }

    const stoppedBudget: PersistedIterationBudget = {
      ...current,
      stopReason: decision.stopReason,
      stoppedAt: input.occurredAt,
    };

    const stopUpdate = await updateTaskState({
      projectRoot: input.projectRoot,
      taskId: input.taskId,
      expectedRevision: input.expectedTaskRevision,
      updatedAt: input.occurredAt,
      update(currentState) {
        return { ...currentState, iterationBudget: stoppedBudget };
      },
    });

    if (!stopUpdate.ok) {
      return stopUpdate;
    }

    return ok({
      budget: stoppedBudget,
      decision,
      taskStateRevision: stopUpdate.value.state.revision,
    });
  }

  const consumedBudget: PersistedIterationBudget = {
    ...current,
    consumption: {
      steps: current.consumption.steps + 1,
      plannerCalls:
        current.consumption.plannerCalls +
        (input.nextLaunch === "planner_call" ? 1 : 0),
      // A retry is a worker invocation as well as a retry, so it charges both
      // counters.  maxRetries is a sub-cap on top of maxWorkerCalls.
      workerCalls:
        current.consumption.workerCalls +
        (input.nextLaunch === "worker_call" || input.nextLaunch === "retry"
          ? 1
          : 0),
      retries:
        current.consumption.retries + (input.nextLaunch === "retry" ? 1 : 0),
    },
  };

  const updateResult = await updateTaskState({
    projectRoot: input.projectRoot,
    taskId: input.taskId,
    expectedRevision: input.expectedTaskRevision,
    updatedAt: input.occurredAt,
    update(currentState) {
      return { ...currentState, iterationBudget: consumedBudget };
    },
  });

  if (!updateResult.ok) {
    return updateResult;
  }

  return ok({
    budget: consumedBudget,
    decision,
    taskStateRevision: updateResult.value.state.revision,
  });
}

// ---------------------------------------------------------------------------
// Public API — projections
// ---------------------------------------------------------------------------

export function toIterationBudgetJson(
  budget: PersistedIterationBudget,
): Record<string, unknown> {
  return {
    schemaVersion: budget.schemaVersion,
    budgetId: budget.budgetId,
    limitsAuthority: budget.limitsAuthority,
    limits: {
      maxSteps: budget.limits.maxSteps,
      maxWallTimeMs: budget.limits.maxWallTimeMs,
      maxPlannerCalls: budget.limits.maxPlannerCalls,
      maxWorkerCalls: budget.limits.maxWorkerCalls,
      maxRetries: budget.limits.maxRetries,
    },
    consumption: {
      steps: budget.consumption.steps,
      plannerCalls: budget.consumption.plannerCalls,
      workerCalls: budget.consumption.workerCalls,
      retries: budget.consumption.retries,
    },
    startedAt: budget.startedAt,
    stopReason: budget.stopReason,
    stoppedAt: budget.stoppedAt,
    policyCeiling: {
      maxSteps: AEOS_ITERATION_BUDGET_POLICY_CEILING.maxSteps,
      maxWallTimeMs: AEOS_ITERATION_BUDGET_POLICY_CEILING.maxWallTimeMs,
      maxPlannerCalls: AEOS_ITERATION_BUDGET_POLICY_CEILING.maxPlannerCalls,
      maxWorkerCalls: AEOS_ITERATION_BUDGET_POLICY_CEILING.maxWorkerCalls,
      maxRetries: AEOS_ITERATION_BUDGET_POLICY_CEILING.maxRetries,
    },
  };
}

export function renderIterationBudgetText(
  budget: PersistedIterationBudget,
): string {
  const { limits, consumption } = budget;

  return [
    `AEOS iteration budget ${budget.budgetId} (limits set by ${budget.limitsAuthority})`,
    `  steps=${consumption.steps}/${limits.maxSteps} ` +
      `planner_calls=${consumption.plannerCalls}/${limits.maxPlannerCalls} ` +
      `worker_calls=${consumption.workerCalls}/${limits.maxWorkerCalls} ` +
      `retries=${consumption.retries}/${limits.maxRetries}`,
    `  max_wall_time_ms=${limits.maxWallTimeMs} started_at=${budget.startedAt}`,
    budget.stopReason === null
      ? "  status: running"
      : `  status: stopped (${budget.stopReason}) at ${budget.stoppedAt}`,
    "  Authority: system/operator only — planner and worker output cannot raise these limits.",
  ].join("\n");
}
