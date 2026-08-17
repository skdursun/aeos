// @ts-expect-error Node built-ins are available at runtime; this package does not depend on Node ambient types yet.
import { createHash, randomUUID } from "node:crypto";
import {
  lstat,
  open,
  readFile,
  readdir,
  rename,
  unlink,
// @ts-expect-error Node built-ins are available at runtime; this package does not depend on Node ambient types yet.
} from "node:fs/promises";
// @ts-expect-error Node built-ins are available at runtime; this package does not depend on Node ambient types yet.
import { join } from "node:path";

import type { AgenticLifecycleIssue, AgenticTaskId } from "./agentic-lifecycle.js";
import type { IterationLaunchKind } from "./task-execution-iteration-budget.js";
import {
  ensureStateStoreRoot,
  isInsideOrEqual,
  validateSafeStoreId,
} from "./task-execution-state-store-paths.js";
import { loadTaskState } from "./task-state-persistence.js";
import type { AeosError, Result } from "./types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const AEOS_ITERATION_STEP_SCHEMA_VERSION = 1;
export const AEOS_ITERATION_STEP_ROOT_RELATIVE_PATH =
  ".aeos/state/iteration-steps";
export const AEOS_ITERATION_STEP_LOCK_ROOT_RELATIVE_PATH =
  ".aeos/state/iteration-step-locks";

const ERROR_PREFIX = "iteration_step";

/**
 * Lifecycles from which a launch has demonstrably already happened.  A step in
 * any of these has crossed the launch boundary and is never re-launched and
 * never reset — the AEOS rule that consumed one-shot authority is not restored.
 */
const POST_LAUNCH_LIFECYCLES: ReadonlySet<IterationStepLifecycle> = new Set<
  IterationStepLifecycle
>(["running", "returned", "failed", "outcome_unknown"]);

const TERMINAL_LIFECYCLES: ReadonlySet<IterationStepLifecycle> = new Set<
  IterationStepLifecycle
>(["returned", "failed"]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IterationStepLifecycle =
  /** Claimed and durable, but nothing has been launched yet. */
  | "prepared"
  /** The launch boundary has been crossed; the outcome is not yet known. */
  | "running"
  | "returned"
  | "failed"
  /** Launched, outcome genuinely unknown.  Requires reconciliation. */
  | "outcome_unknown";

export type IterationStepOutcomeCertainty =
  | "not_launched"
  | "launched_pending"
  | "known"
  | "unknown";

/**
 * The parent orchestration this step belongs to.  All four fields are
 * AEOS-owned; a step is meaningless without them, and a mismatch on any of
 * them fails closed rather than being reconciled.
 */
export interface IterationStepParentBinding {
  readonly taskId: AgenticTaskId;
  readonly taskStateRevision: number;
  /** Iteration budget id from TASK-0327 — the orchestration run identity. */
  readonly budgetId: string;
  readonly stepNumber: number;
}

export interface IterationStepOwnership {
  readonly authority: "system";
  readonly ownerId: string;
  readonly ownershipToken: string;
  readonly claimedAt: string;
}

export interface IterationStepResultRecord {
  readonly stepOk: boolean;
  readonly returnedAt: string;
  readonly resultReference?: string;
}

export interface IterationStepFailureRecord {
  readonly code: string;
  readonly retryable: boolean;
  readonly failedAt: string;
  readonly diagnostic?: string;
}

export interface IterationStepSafety {
  readonly authority: "system";
  readonly lifecycleAuthority: "system";
  readonly modelSelfReportTrusted: false;
  readonly workCompleted: false;
  readonly taskCompleted: false;
  readonly verified: false;
  readonly approved: false;
}

export interface IterationStepRecord {
  readonly schemaVersion: typeof AEOS_ITERATION_STEP_SCHEMA_VERSION;
  /** Deterministic id derived from the parent binding and launch kind. */
  readonly stepId: string;
  /** Hash of the same inputs, retained as tamper-evident provenance. */
  readonly stepFingerprint: string;
  readonly parent: IterationStepParentBinding;
  readonly launchKind: IterationLaunchKind;
  readonly lifecycle: IterationStepLifecycle;
  readonly ownership: IterationStepOwnership;
  /**
   * True once the step has left "prepared".  Kept as an explicit field rather
   * than being inferred from the lifecycle so that a corrupted record claiming
   * "prepared" after a real launch is detectable instead of silently relaunchable.
   */
  readonly launchBoundaryCrossed: boolean;
  readonly outcomeCertainty: IterationStepOutcomeCertainty;
  readonly result?: IterationStepResultRecord;
  readonly failure?: IterationStepFailureRecord;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly launchedAt?: string;
  readonly outcomeUnknownAt?: string;
  readonly safety: IterationStepSafety;
  readonly issues: readonly AgenticLifecycleIssue[];
}

export interface DeriveIterationStepIdentityInput {
  readonly parent: IterationStepParentBinding;
  readonly launchKind: IterationLaunchKind;
}

export interface IterationStepIdentity {
  readonly stepId: string;
  readonly stepFingerprint: string;
}

export interface CreatePreparedIterationStepRecordInput
  extends DeriveIterationStepIdentityInput {
  readonly claimedAt?: string;
  readonly ownerId?: string;
  readonly ownershipToken?: string;
}

export type IterationStepTransitionIntent =
  | { readonly kind: "launch_step"; readonly occurredAt?: string }
  | {
      readonly kind: "record_returned";
      readonly result: Omit<IterationStepResultRecord, "returnedAt"> &
        Partial<Pick<IterationStepResultRecord, "returnedAt">>;
    }
  | {
      readonly kind: "record_failed";
      readonly failure: Omit<IterationStepFailureRecord, "failedAt"> &
        Partial<Pick<IterationStepFailureRecord, "failedAt">>;
    }
  | {
      readonly kind: "mark_outcome_unknown";
      readonly occurredAt?: string;
      readonly issue?: AgenticLifecycleIssue;
    };

export type IterationStepError = AeosError;

export interface ClaimIterationStepInput
  extends CreatePreparedIterationStepRecordInput {
  readonly projectRoot: string;
}

export type ClaimIterationStepStatus = "claimed" | "already_claimed";

export interface ClaimIterationStepResult {
  readonly status: ClaimIterationStepStatus;
  readonly record: IterationStepRecord;
  readonly path: string;
}

export interface LoadIterationStepInput {
  readonly projectRoot: string;
  readonly taskId: AgenticTaskId;
  readonly stepId: string;
}

export interface IterationStepPersistenceResult {
  readonly record: IterationStepRecord;
  readonly path: string;
}

export interface UpdateIterationStepInput {
  readonly projectRoot: string;
  readonly taskId: AgenticTaskId;
  readonly stepId: string;
  readonly expectedRevision: number;
  readonly intent: IterationStepTransitionIntent;
}

export interface ListIterationStepsInput {
  readonly projectRoot: string;
  readonly taskId: AgenticTaskId;
}

export type IterationResumeAction =
  /** No steps claimed yet for this task. */
  | "no_steps"
  /** Crash before launch: the step may safely be launched. */
  | "resume_prepared_step"
  /** Crash after launch: must NOT relaunch; the outcome must be reconciled. */
  | "reconcile_launched_step"
  /** Outcome genuinely unknown: blocked pending reconciliation. */
  | "reconcile_outcome_unknown"
  /** Every claimed step reached a known outcome. */
  | "all_steps_settled";

/**
 * Restricts a resume decision to one orchestration run.  Steps claimed against
 * a superseded task revision or a previous budget are orphans: they are real,
 * durable, and must never be launched by the current run.
 */
export interface IterationRunScope {
  readonly taskStateRevision: number;
  readonly budgetId: string;
}

export interface IterationResumeState {
  readonly action: IterationResumeAction;
  /** The step the action refers to, if any. */
  readonly stepId: string | null;
  readonly stepNumber: number | null;
  readonly lifecycle: IterationStepLifecycle | null;
  /** True only for "resume_prepared_step".  Everything else forbids a launch. */
  readonly launchPermitted: boolean;
  readonly blockedReason: string | null;
  /** Steps in scope for this run. */
  readonly stepCount: number;
  readonly settledStepCount: number;
  /**
   * Steps present on disk but belonging to a superseded run.  Reported rather
   * than dropped silently, so an operator can see them.  They never influence
   * the action and are never launchable.
   */
  readonly orphanedStepCount: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function compareIterationSteps(
  left: IterationStepRecord,
  right: IterationStepRecord,
): number {
  if (left.parent.stepNumber !== right.parent.stepNumber) {
    return left.parent.stepNumber - right.parent.stepNumber;
  }

  return left.stepId < right.stepId ? -1 : left.stepId > right.stepId ? 1 : 0;
}

function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

function err(error: IterationStepError): Result<never, IterationStepError> {
  return { ok: false, error };
}

function createError(
  code: string,
  message: string,
  category: AeosError["category"],
  details?: Record<string, string | number | boolean | null>,
): IterationStepError {
  return details === undefined
    ? { code, message, category, retryable: false }
    : { code, message, category, retryable: false, details };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sha256hex(value: string): string {
  return (createHash("sha256") as ReturnType<typeof createHash>)
    .update(value)
    .digest("hex") as string;
}

function isBoundedCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function jsonContent(record: IterationStepRecord): string {
  return `${JSON.stringify(record, null, 2)}\n`;
}

function safetyBlock(): IterationStepSafety {
  return {
    authority: "system",
    lifecycleAuthority: "system",
    modelSelfReportTrusted: false,
    workCompleted: false,
    taskCompleted: false,
    verified: false,
    approved: false,
  };
}

function certaintyFor(
  lifecycle: IterationStepLifecycle,
): IterationStepOutcomeCertainty {
  switch (lifecycle) {
    case "prepared":
      return "not_launched";
    case "running":
      return "launched_pending";
    case "returned":
    case "failed":
      return "known";
    case "outcome_unknown":
      return "unknown";
  }
}

// ---------------------------------------------------------------------------
// Public API — identity
// ---------------------------------------------------------------------------

/**
 * Derive a step's identity deterministically from its parent binding and
 * launch kind.
 *
 * Determinism is the whole idempotency mechanism: a crash-and-replay of the
 * same orchestration intent produces the same stepId, therefore the same file
 * path, therefore an exactly-once create that the second attempt loses.  A
 * random id would silently create a second step for the same intent, which is
 * precisely the duplicate execution this task exists to prevent.
 */
export function deriveIterationStepIdentity(
  input: DeriveIterationStepIdentityInput,
): Result<IterationStepIdentity, IterationStepError> {
  const parentResult = validateParentBinding(input.parent);

  if (!parentResult.ok) {
    return parentResult;
  }

  if (
    input.launchKind !== "planner_call" &&
    input.launchKind !== "worker_call" &&
    input.launchKind !== "retry"
  ) {
    return err(
      createError(
        "iteration_step_invalid_launch_kind",
        "Iteration step launch kind must be planner_call, worker_call or retry.",
        "validation",
      ),
    );
  }

  const parent = parentResult.value;
  const fingerprint = sha256hex(
    [
      "aeos-iteration-step-v1",
      parent.taskId,
      String(parent.taskStateRevision),
      parent.budgetId,
      String(parent.stepNumber),
      input.launchKind,
    ].join(" "),
  );

  return ok({
    stepId: `step-${fingerprint.slice(0, 32)}`,
    stepFingerprint: fingerprint,
  });
}

function validateParentBinding(
  value: unknown,
): Result<IterationStepParentBinding, IterationStepError> {
  if (!isRecord(value)) {
    return err(
      createError(
        "iteration_step_invalid_parent_binding",
        "Iteration step parent binding must be an object.",
        "validation",
      ),
    );
  }

  // Both taskId and budgetId are validated against the safe-id pattern, for the
  // same reason: the identity digest joins its inputs with a space, so either one
  // containing the delimiter would make the digest ambiguous across different
  // bindings.  The claim path would refuse an unsafe taskId later at the storage
  // boundary, but checking it here means no ambiguous digest is ever derived at
  // all, including by callers that never reach storage.
  const taskIdResult = validateSafeStoreId({
    value: value.taskId,
    field: "taskId",
    errorPrefix: ERROR_PREFIX,
  });

  if (!taskIdResult.ok) {
    return err(
      createError(
        "iteration_step_invalid_parent_binding",
        "Iteration step parent binding requires a taskId that is a safe identifier.",
        "validation",
      ),
    );
  }

  // Validated against the safe-id pattern, not merely as a non-empty string:
  // the identity digest joins its inputs with a space, so a budgetId containing
  // the delimiter would make the digest ambiguous across different bindings.
  // taskId is already space-free by the same pattern.
  const budgetIdResult = validateSafeStoreId({
    value: value.budgetId,
    field: "budgetId",
    errorPrefix: ERROR_PREFIX,
  });

  if (!budgetIdResult.ok) {
    return err(
      createError(
        "iteration_step_invalid_parent_binding",
        "Iteration step parent binding requires a budgetId that is a safe identifier.",
        "validation",
      ),
    );
  }

  if (
    !isBoundedCount(value.taskStateRevision) ||
    !isBoundedCount(value.stepNumber)
  ) {
    return err(
      createError(
        "iteration_step_invalid_parent_binding",
        "Iteration step parent revision and step number must be non-negative safe integers.",
        "validation",
      ),
    );
  }

  return ok(value as unknown as IterationStepParentBinding);
}

// ---------------------------------------------------------------------------
// Public API — record construction and validation
// ---------------------------------------------------------------------------

export function createPreparedIterationStepRecord(
  input: CreatePreparedIterationStepRecordInput,
): Result<IterationStepRecord, IterationStepError> {
  const identityResult = deriveIterationStepIdentity(input);

  if (!identityResult.ok) {
    return identityResult;
  }

  const claimedAt = input.claimedAt ?? new Date().toISOString();

  return validateIterationStepRecord({
    schemaVersion: AEOS_ITERATION_STEP_SCHEMA_VERSION,
    stepId: identityResult.value.stepId,
    stepFingerprint: identityResult.value.stepFingerprint,
    parent: input.parent,
    launchKind: input.launchKind,
    lifecycle: "prepared",
    ownership: {
      authority: "system",
      ownerId: input.ownerId ?? "aeos-system",
      ownershipToken: input.ownershipToken ?? (randomUUID() as string),
      claimedAt,
    },
    launchBoundaryCrossed: false,
    outcomeCertainty: "not_launched",
    revision: 1,
    createdAt: claimedAt,
    updatedAt: claimedAt,
    safety: safetyBlock(),
    issues: [],
  });
}

/**
 * Validate a step record.  Beyond structural checks this enforces the two
 * cross-field invariants that make the launch boundary meaningful:
 *
 *  - a record past "prepared" must have launchBoundaryCrossed true;
 *  - a "prepared" record must have it false.
 *
 * Without both, a corrupted record could present as "prepared" after a real
 * launch and be relaunched — the exact duplicate execution this task prevents.
 */
export function validateIterationStepRecord(
  value: unknown,
): Result<IterationStepRecord, IterationStepError> {
  if (!isRecord(value)) {
    return err(
      createError(
        "iteration_step_invalid_record",
        "Iteration step record must be an object.",
        "validation",
      ),
    );
  }

  if (value.schemaVersion !== AEOS_ITERATION_STEP_SCHEMA_VERSION) {
    return err(
      createError(
        "iteration_step_unsupported_schema_version",
        "Iteration step record schema version is not supported.",
        "validation",
      ),
    );
  }

  const parentResult = validateParentBinding(value.parent);

  if (!parentResult.ok) {
    return parentResult;
  }

  const identityResult = deriveIterationStepIdentity({
    parent: parentResult.value,
    launchKind: value.launchKind as IterationLaunchKind,
  });

  if (!identityResult.ok) {
    return identityResult;
  }

  // The id and fingerprint are derived, never supplied.  A record whose stored
  // id does not match its own binding has been tampered with or hand-edited.
  if (
    value.stepId !== identityResult.value.stepId ||
    value.stepFingerprint !== identityResult.value.stepFingerprint
  ) {
    return err(
      createError(
        "iteration_step_identity_mismatch",
        "Iteration step id and fingerprint must match the identity derived from the parent binding.",
        "validation",
        {
          storedStepId: typeof value.stepId === "string" ? value.stepId : null,
          derivedStepId: identityResult.value.stepId,
        },
      ),
    );
  }

  const lifecycle = value.lifecycle;

  if (
    lifecycle !== "prepared" &&
    lifecycle !== "running" &&
    lifecycle !== "returned" &&
    lifecycle !== "failed" &&
    lifecycle !== "outcome_unknown"
  ) {
    return err(
      createError(
        "iteration_step_invalid_lifecycle",
        "Iteration step lifecycle is not a recognised state.",
        "validation",
        { lifecycle: typeof lifecycle === "string" ? lifecycle : null },
      ),
    );
  }

  if (typeof value.launchBoundaryCrossed !== "boolean") {
    return err(
      createError(
        "iteration_step_invalid_launch_boundary",
        "Iteration step launch boundary flag must be a boolean.",
        "validation",
      ),
    );
  }

  const shouldHaveCrossed = POST_LAUNCH_LIFECYCLES.has(lifecycle);

  if (value.launchBoundaryCrossed !== shouldHaveCrossed) {
    return err(
      createError(
        "iteration_step_launch_boundary_inconsistent",
        "Iteration step launch boundary flag does not agree with its lifecycle.",
        "validation",
        {
          lifecycle,
          launchBoundaryCrossed: value.launchBoundaryCrossed,
        },
      ),
    );
  }

  // Completes the cross-field table: launchedAt is the timestamp of the boundary
  // crossing, so it must be present exactly when the boundary has been crossed.
  if (shouldHaveCrossed && typeof value.launchedAt !== "string") {
    return err(
      createError(
        "iteration_step_launch_timestamp_inconsistent",
        "A launched iteration step must carry the timestamp of its launch.",
        "validation",
        { lifecycle },
      ),
    );
  }

  if (!shouldHaveCrossed && value.launchedAt !== undefined) {
    return err(
      createError(
        "iteration_step_launch_timestamp_inconsistent",
        "An iteration step that has not been launched cannot carry a launch timestamp.",
        "validation",
        { lifecycle },
      ),
    );
  }

  if (value.outcomeCertainty !== certaintyFor(lifecycle)) {
    return err(
      createError(
        "iteration_step_outcome_certainty_inconsistent",
        "Iteration step outcome certainty does not agree with its lifecycle.",
        "validation",
        { lifecycle },
      ),
    );
  }

  if (!isRecord(value.ownership) || value.ownership.authority !== "system") {
    return err(
      createError(
        "iteration_step_invalid_ownership",
        "Iteration step ownership must be system authority.",
        "validation",
      ),
    );
  }

  if (
    typeof value.ownership.ownerId !== "string" ||
    value.ownership.ownerId.length === 0 ||
    typeof value.ownership.ownershipToken !== "string" ||
    value.ownership.ownershipToken.length === 0 ||
    typeof value.ownership.claimedAt !== "string"
  ) {
    return err(
      createError(
        "iteration_step_invalid_ownership",
        "Iteration step ownership requires an owner id, token and claim timestamp.",
        "validation",
      ),
    );
  }

  if (typeof value.revision !== "number" || !Number.isSafeInteger(value.revision) || value.revision < 1) {
    return err(
      createError(
        "iteration_step_invalid_revision",
        "Iteration step revision must be a positive safe integer.",
        "validation",
      ),
    );
  }

  if (lifecycle === "returned") {
    if (!isRecord(value.result) || typeof value.result.stepOk !== "boolean") {
      return err(
        createError(
          "iteration_step_missing_result",
          "A returned iteration step must carry a result record.",
          "validation",
        ),
      );
    }
  } else if (value.result !== undefined) {
    return err(
      createError(
        "iteration_step_unexpected_result",
        "Only a returned iteration step may carry a result record.",
        "validation",
        { lifecycle },
      ),
    );
  }

  if (lifecycle === "failed") {
    if (
      !isRecord(value.failure) ||
      typeof value.failure.code !== "string" ||
      typeof value.failure.retryable !== "boolean"
    ) {
      return err(
        createError(
          "iteration_step_missing_failure",
          "A failed iteration step must carry a failure record.",
          "validation",
        ),
      );
    }
  } else if (value.failure !== undefined) {
    return err(
      createError(
        "iteration_step_unexpected_failure",
        "Only a failed iteration step may carry a failure record.",
        "validation",
        { lifecycle },
      ),
    );
  }

  // The settle transitions set outcomeUnknownAt to undefined, which JSON.stringify
  // drops.  Relying on that alone would let a hand-edited settled record keep a
  // stale ambiguity marker, so the invariant is enforced rather than assumed.
  if (lifecycle !== "outcome_unknown" && value.outcomeUnknownAt !== undefined) {
    return err(
      createError(
        "iteration_step_stale_ambiguity_marker",
        "Only an outcome_unknown iteration step may carry an outcome-unknown timestamp.",
        "validation",
        { lifecycle },
      ),
    );
  }

  if (lifecycle === "outcome_unknown" && typeof value.outcomeUnknownAt !== "string") {
    return err(
      createError(
        "iteration_step_stale_ambiguity_marker",
        "An outcome_unknown iteration step must carry an outcome-unknown timestamp.",
        "validation",
      ),
    );
  }

  if (!isRecord(value.safety) || value.safety.lifecycleAuthority !== "system") {
    return err(
      createError(
        "iteration_step_invalid_safety",
        "Iteration step lifecycle authority must be system.",
        "validation",
      ),
    );
  }

  for (const forbidden of [
    "workCompleted",
    "taskCompleted",
    "verified",
    "approved",
    "modelSelfReportTrusted",
  ] as const) {
    if (value.safety[forbidden] !== false) {
      return err(
        createError(
          "iteration_step_invalid_safety",
          "Iteration step safety markers must all remain false.",
          "validation",
          { marker: forbidden },
        ),
      );
    }
  }

  if (!Array.isArray(value.issues)) {
    return err(
      createError(
        "iteration_step_invalid_issues",
        "Iteration step issues must be an array.",
        "validation",
      ),
    );
  }

  return ok(value as unknown as IterationStepRecord);
}

// ---------------------------------------------------------------------------
// Public API — lifecycle transitions
// ---------------------------------------------------------------------------

/**
 * Apply a lifecycle intent to a step record.
 *
 * Authority boundary:
 *  - Only the transitions enumerated here exist.  There is no path back to
 *    "prepared" from any lifecycle, and no path that clears
 *    launchBoundaryCrossed once set.
 *  - "launch_step" is refused for any record that has already crossed the
 *    boundary, including one sitting in "outcome_unknown".  An ambiguous
 *    outcome is reconciled, never replayed.
 *  - Nothing a worker or model reports can drive a transition; the caller
 *    supplies an intent, and AEOS decides whether that intent is legal from
 *    the current lifecycle.
 */
export function transitionIterationStepRecord(input: {
  readonly record: unknown;
  readonly intent: IterationStepTransitionIntent;
}): Result<IterationStepRecord, IterationStepError> {
  const recordResult = validateIterationStepRecord(input.record);

  if (!recordResult.ok) {
    return recordResult;
  }

  const record = recordResult.value;
  const intent = input.intent;

  if (intent.kind === "launch_step") {
    if (record.launchBoundaryCrossed || record.lifecycle !== "prepared") {
      return err(
        createError(
          "iteration_step_launch_boundary_already_crossed",
          "An iteration step that has already been launched is never relaunched or reset.",
          "conflict",
          { stepId: record.stepId, lifecycle: record.lifecycle },
        ),
      );
    }

    const occurredAt = intent.occurredAt ?? new Date().toISOString();

    return validateIterationStepRecord({
      ...record,
      lifecycle: "running",
      launchBoundaryCrossed: true,
      outcomeCertainty: "launched_pending",
      launchedAt: occurredAt,
      revision: record.revision + 1,
      updatedAt: occurredAt,
    });
  }

  if (intent.kind === "record_returned") {
    if (record.lifecycle !== "running" && record.lifecycle !== "outcome_unknown") {
      return err(
        createError(
          "iteration_step_transition_not_allowed",
          "An iteration step outcome can only be recorded for a launched step.",
          "validation",
          { stepId: record.stepId, lifecycle: record.lifecycle, intent: intent.kind },
        ),
      );
    }

    const returnedAt = intent.result.returnedAt ?? new Date().toISOString();

    return validateIterationStepRecord({
      ...record,
      lifecycle: "returned",
      result: { ...intent.result, returnedAt },
      outcomeCertainty: "known",
      outcomeUnknownAt: undefined,
      revision: record.revision + 1,
      updatedAt: returnedAt,
    });
  }

  if (intent.kind === "record_failed") {
    if (record.lifecycle !== "running" && record.lifecycle !== "outcome_unknown") {
      return err(
        createError(
          "iteration_step_transition_not_allowed",
          "An iteration step failure can only be recorded for a launched step.",
          "validation",
          { stepId: record.stepId, lifecycle: record.lifecycle, intent: intent.kind },
        ),
      );
    }

    const failedAt = intent.failure.failedAt ?? new Date().toISOString();

    return validateIterationStepRecord({
      ...record,
      lifecycle: "failed",
      failure: { ...intent.failure, failedAt },
      outcomeCertainty: "known",
      outcomeUnknownAt: undefined,
      revision: record.revision + 1,
      updatedAt: failedAt,
    });
  }

  if (intent.kind === "mark_outcome_unknown") {
    // Only a launched-but-unsettled step can become ambiguous.  A prepared step
    // never launched, so its outcome is known to be "nothing happened"; a
    // settled step already has a durable outcome that must not be erased.
    if (record.lifecycle !== "running") {
      return err(
        createError(
          "iteration_step_transition_not_allowed",
          "Only a running iteration step can be marked outcome_unknown.",
          "validation",
          { stepId: record.stepId, lifecycle: record.lifecycle, intent: intent.kind },
        ),
      );
    }

    const occurredAt = intent.occurredAt ?? new Date().toISOString();

    return validateIterationStepRecord({
      ...record,
      lifecycle: "outcome_unknown",
      outcomeCertainty: "unknown",
      outcomeUnknownAt: occurredAt,
      issues:
        intent.issue === undefined
          ? record.issues
          : [...record.issues, intent.issue],
      revision: record.revision + 1,
      updatedAt: occurredAt,
    });
  }

  return err(
    createError(
      "iteration_step_transition_not_allowed",
      "Iteration step transition intent is not recognised.",
      "validation",
    ),
  );
}

// ---------------------------------------------------------------------------
// Public API — durable claim
// ---------------------------------------------------------------------------

async function readExistingStep(
  path: string,
  expectedTaskId?: AgenticTaskId,
  expectedStepId?: string,
): Promise<Result<IterationStepRecord | undefined, IterationStepError>> {
  // Check the entry BEFORE reading it.  `readdir` yields names only, so a
  // directory named "<something>.json" would make readFile throw EISDIR — an
  // uncaught throw that would wedge listIterationSteps and, through it, every
  // claim for the task.  A symlink would be followed silently, letting a record
  // outside this directory be read as if it belonged here.
  let stats: Awaited<ReturnType<typeof lstat>>;

  try {
    stats = await lstat(path);
  } catch (error) {
    if (
      isRecord(error) &&
      typeof error.code === "string" &&
      error.code === "ENOENT"
    ) {
      return ok(undefined);
    }

    throw error;
  }

  if (stats.isSymbolicLink() || !stats.isFile()) {
    return err(
      createError(
        "iteration_step_unsafe_target",
        "Persisted iteration step record path is not a safe regular file.",
        "permission",
        { path },
      ),
    );
  }

  let raw: string;

  try {
    raw = (await readFile(path, "utf8")) as string;
  } catch (error) {
    if (
      isRecord(error) &&
      typeof error.code === "string" &&
      error.code === "ENOENT"
    ) {
      return ok(undefined);
    }

    throw error;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return err(
      createError(
        "iteration_step_corrupt_record",
        "Persisted iteration step record is not valid JSON.",
        "validation",
        { path },
      ),
    );
  }

  const recordResult = validateIterationStepRecord(parsed);

  if (!recordResult.ok) {
    return recordResult;
  }

  // The file name IS the identity: a record is only itself if it lives at the
  // path its own derived stepId dictates.  This closes the paths lstat cannot —
  // a hard link to another record in the same directory, or any renamed copy —
  // either of which would otherwise be adopted as a second entry for an
  // identity that already exists, and could block the claim gate with a
  // duplicate `running` step.
  if (
    expectedStepId !== undefined &&
    recordResult.value.stepId !== expectedStepId
  ) {
    return err(
      createError(
        "iteration_step_path_identity_mismatch",
        "Persisted iteration step record does not live at the path its own identity dictates.",
        "validation",
        { expectedStepId, recordStepId: recordResult.value.stepId },
      ),
    );
  }

  // Structural validity proves the record is self-consistent, not that it
  // belongs here.  A valid record for another task placed in this task's
  // directory would otherwise be adopted — and if it were `running`, the claim
  // gate would block this task's run indefinitely on a foreign step.
  if (
    expectedTaskId !== undefined &&
    recordResult.value.parent.taskId !== expectedTaskId
  ) {
    return err(
      createError(
        "iteration_step_foreign_record",
        "Persisted iteration step record belongs to a different task than the directory it was read from.",
        "validation",
        {
          expectedTaskId,
          recordTaskId: recordResult.value.parent.taskId,
        },
      ),
    );
  }

  return recordResult;
}

/**
 * Claim a step exactly once.
 *
 * The claim is an `open(path, "wx")` create, so the filesystem — not a
 * read-then-write in application code — decides the winner.  Two concurrent
 * claimers for the same identity produce exactly one "claimed" and one
 * "already_claimed"; there is no window in which both believe they own it.
 *
 * Before claiming, the parent binding is verified against durable state: the
 * task must exist, its revision must match the binding, and it must carry an
 * iteration budget whose id matches.  A stale or foreign parent fails closed
 * rather than producing an orphan step.
 */
export async function claimIterationStep(
  input: ClaimIterationStepInput,
): Promise<Result<ClaimIterationStepResult, IterationStepError>> {
  const recordResult = createPreparedIterationStepRecord(input);

  if (!recordResult.ok) {
    return recordResult;
  }

  const record = recordResult.value;

  const parentCheck = await verifyParentBindingAgainstState({
    projectRoot: input.projectRoot,
    parent: record.parent,
  });

  if (!parentCheck.ok) {
    return parentCheck;
  }

  const gateResult = await refuseClaimWhileRunIsBlocked({
    projectRoot: input.projectRoot,
    parent: record.parent,
    claimingStepId: record.stepId,
  });

  if (!gateResult.ok) {
    return gateResult;
  }

  // ensureStateStoreRoot validates the taskId segment but not the record id, so
  // the derived stepId is checked explicitly here.  (It is machine-derived from
  // a SHA-256 digest, so this is a guard against a future caller-supplied id
  // rather than against anything reachable today.)
  const stepIdResult = validateSafeStoreId({
    value: record.stepId,
    field: "stepId",
    errorPrefix: ERROR_PREFIX,
  });

  if (!stepIdResult.ok) {
    return stepIdResult;
  }

  const rootResult = await ensureStateStoreRoot({
    projectRoot: input.projectRoot,
    rootRelativePath: AEOS_ITERATION_STEP_ROOT_RELATIVE_PATH,
    taskId: record.parent.taskId,
    create: true,
    errorPrefix: ERROR_PREFIX,
  });

  if (!rootResult.ok) {
    return rootResult;
  }

  const targetPath = join(rootResult.value, `${record.stepId}.json`);
  let fileHandle: Awaited<ReturnType<typeof open>> | undefined;

  try {
    fileHandle = await open(targetPath, "wx");
    await fileHandle.writeFile(jsonContent(record), "utf8");
    await fileHandle.sync();
    await fileHandle.close();
    fileHandle = undefined;

    return ok({ status: "claimed", record, path: targetPath });
  } catch (error) {
    if (fileHandle !== undefined) {
      await fileHandle.close().catch(() => undefined);
    }

    if (
      !isRecord(error) ||
      typeof error.code !== "string" ||
      error.code !== "EEXIST"
    ) {
      throw error;
    }

    const stats = await lstat(targetPath).catch(() => undefined);

    if (stats?.isSymbolicLink() === true || stats?.isFile() !== true) {
      return err(
        createError(
          "iteration_step_unsafe_target",
          "Persisted iteration step target is not a safe file path.",
          "permission",
        ),
      );
    }

    const existingResult = await readExistingStep(
      targetPath,
      record.parent.taskId,
      record.stepId,
    );

    if (!existingResult.ok) {
      return existingResult;
    }

    if (existingResult.value === undefined) {
      return err(
        createError(
          "iteration_step_claim_conflict",
          "Iteration step claim collided with an unreadable authority record.",
          "conflict",
        ),
      );
    }

    // No separate authority-collision check is needed here, and one would be
    // dead code.  readExistingStep already required the stored record to live at
    // the path its own stepId dictates, and validateIterationStepRecord already
    // re-derived that stepId from the record's own parent binding and launch
    // kind.  So a record found at this path necessarily carries a binding that
    // hashes to this stepId; for its binding to differ from the requested one
    // while the digest matched would require a SHA-256 collision.
    return ok({
      status: "already_claimed",
      record: existingResult.value,
      path: targetPath,
    });
  }
}

/**
 * Refuse a NEW step claim while the current run has an unsettled step.
 *
 * Exactly-once launch per step identity is not by itself enough to honour the
 * AEOS rules that `outcome_unknown` requires reconciliation and that there is no
 * blind retry.  A `retry` launch kind hashes to a different stepId, so without
 * this gate a caller could claim a fresh retry step while the step it is
 * retrying sits unreconciled in `outcome_unknown` — a blind retry that never
 * touches the launch boundary of the original.  The same hole would let step
 * N+1 be claimed while step N is still `running`.
 *
 * Retry ELIGIBILITY classification is TASK-0334 and is deliberately not decided
 * here.  What is enforced here is narrower and squarely in scope: an ambiguous
 * or in-flight run does not accept new work until it is reconciled.
 *
 * The step being claimed is excluded, so a replay of an already-claimed step
 * still receives `already_claimed` from the exactly-once path rather than this
 * refusal.
 */
async function refuseClaimWhileRunIsBlocked(input: {
  readonly projectRoot: string;
  readonly parent: IterationStepParentBinding;
  readonly claimingStepId: string;
}): Promise<Result<void, IterationStepError>> {
  const stepsResult = await listIterationSteps({
    projectRoot: input.projectRoot,
    taskId: input.parent.taskId,
  });

  if (!stepsResult.ok) {
    return stepsResult;
  }

  const blocking = [...stepsResult.value]
    .filter(
      (step) =>
        step.stepId !== input.claimingStepId &&
        step.parent.taskStateRevision === input.parent.taskStateRevision &&
        step.parent.budgetId === input.parent.budgetId &&
        (step.lifecycle === "running" || step.lifecycle === "outcome_unknown"),
    )
    .sort(compareIterationSteps)[0];

  if (blocking === undefined) {
    return ok(undefined);
  }

  return err(
    createError(
      "iteration_step_run_blocked_by_unsettled_step",
      "A new iteration step cannot be claimed while the run has an unsettled step awaiting reconciliation.",
      "conflict",
      {
        blockingStepId: blocking.stepId,
        blockingStepNumber: blocking.parent.stepNumber,
        blockingLifecycle: blocking.lifecycle,
      },
    ),
  );
}

async function verifyParentBindingAgainstState(input: {
  readonly projectRoot: string;
  readonly parent: IterationStepParentBinding;
}): Promise<Result<void, IterationStepError>> {
  const stateResult = await loadTaskState({
    projectRoot: input.projectRoot,
    taskId: input.parent.taskId,
  });

  if (!stateResult.ok) {
    return stateResult;
  }

  const state = stateResult.value.state;

  if (state.revision !== input.parent.taskStateRevision) {
    return err(
      createError(
        "iteration_step_parent_revision_stale",
        "Iteration step parent revision does not match the current durable task state revision.",
        "conflict",
        {
          boundRevision: input.parent.taskStateRevision,
          actualRevision: state.revision,
        },
      ),
    );
  }

  if (state.iterationBudget === undefined) {
    return err(
      createError(
        "iteration_step_parent_budget_missing",
        "Iteration step parent task carries no iteration budget to bind against.",
        "validation",
        { taskId: input.parent.taskId },
      ),
    );
  }

  if (state.iterationBudget.budgetId !== input.parent.budgetId) {
    return err(
      createError(
        "iteration_step_parent_budget_mismatch",
        "Iteration step parent budget id does not match the durable iteration budget.",
        "validation",
        {
          boundBudgetId: input.parent.budgetId,
          actualBudgetId: state.iterationBudget.budgetId,
        },
      ),
    );
  }

  return ok(undefined);
}

// ---------------------------------------------------------------------------
// Public API — durable read and update
// ---------------------------------------------------------------------------

export async function loadIterationStep(
  input: LoadIterationStepInput,
): Promise<Result<IterationStepPersistenceResult, IterationStepError>> {
  const rootResult = await ensureStateStoreRoot({
    projectRoot: input.projectRoot,
    rootRelativePath: AEOS_ITERATION_STEP_ROOT_RELATIVE_PATH,
    taskId: input.taskId,
    create: false,
    errorPrefix: ERROR_PREFIX,
  });

  if (!rootResult.ok) {
    return rootResult;
  }

  const targetPath = join(rootResult.value, `${input.stepId}.json`);
  const existingResult = await readExistingStep(
    targetPath,
    input.taskId,
    input.stepId,
  );

  if (!existingResult.ok) {
    return existingResult;
  }

  if (existingResult.value === undefined) {
    return err(
      createError(
        "iteration_step_not_found",
        "Persisted iteration step record was not found.",
        "not_found",
        { stepId: input.stepId },
      ),
    );
  }

  return ok({ record: existingResult.value, path: targetPath });
}

/**
 * Durably apply a lifecycle intent under an optimistic-locking revision guard.
 *
 * The immutable identity — stepId, fingerprint, parent binding, launch kind,
 * ownership, createdAt — is re-verified after the transition.  A transition
 * that changed any of them would be a rewritten step rather than an advanced
 * one, and is refused.
 */
export async function updateIterationStep(
  input: UpdateIterationStepInput,
): Promise<Result<IterationStepPersistenceResult, IterationStepError>> {
  // An exclusive lock is taken BEFORE the read, mirroring
  // updateTaskExecutionInvocation.  The revision guard alone is not sufficient:
  // two concurrent callers can both read revision N, both pass the guard, and
  // both return ok for the same launch transition.  Last-writer-wins rename
  // leaves the file consistent, but each caller would believe it owns the
  // launch and could dispatch the underlying worker — a duplicate launch, which
  // is precisely what this module exists to prevent.
  const lockRootResult = await ensureStateStoreRoot({
    projectRoot: input.projectRoot,
    rootRelativePath: AEOS_ITERATION_STEP_LOCK_ROOT_RELATIVE_PATH,
    taskId: input.taskId,
    create: true,
    errorPrefix: ERROR_PREFIX,
  });

  if (!lockRootResult.ok) {
    return lockRootResult;
  }

  const stepIdResult = validateSafeStoreId({
    value: input.stepId,
    field: "stepId",
    errorPrefix: ERROR_PREFIX,
  });

  if (!stepIdResult.ok) {
    return stepIdResult;
  }

  const lockPath = join(lockRootResult.value, `${stepIdResult.value}.lock`);

  if (!isInsideOrEqual(lockRootResult.value, lockPath)) {
    return err(
      createError(
        "iteration_step_lock_path_outside_root",
        "Iteration step lock path escaped the AEOS iteration step lock root.",
        "permission",
      ),
    );
  }

  let lockHandle: Awaited<ReturnType<typeof open>> | undefined;
  // Only the caller that CREATED the lock may remove it.  An unconditional
  // unlink in the finally would have the losing caller delete the winner's lock
  // while the winner is still mid-update, letting a third caller acquire it and
  // run the read-transition-rename cycle concurrently with the winner.  Both
  // would return ok and both would believe they own the launch — the lock would
  // actively cause the duplicate launch it exists to prevent.
  let lockCreatedByThisCaller = false;

  try {
    try {
      lockHandle = await open(lockPath, "wx");
      await lockHandle.writeFile(
        `${JSON.stringify({
          taskId: input.taskId,
          stepId: input.stepId,
          createdAt: new Date().toISOString(),
        })}\n`,
        "utf8",
      );
      await lockHandle.sync();
      await lockHandle.close();
      lockHandle = undefined;
      lockCreatedByThisCaller = true;
    } catch (error) {
      if (
        isRecord(error) &&
        typeof error.code === "string" &&
        error.code === "EEXIST"
      ) {
        const lockStats = await lstat(lockPath).catch(() => undefined);

        if (lockStats?.isSymbolicLink() === true) {
          return err(
            createError(
              "iteration_step_unsafe_lock_target",
              "Iteration step update lock target is unsafe.",
              "permission",
            ),
          );
        }

        return err(
          createError(
            "iteration_step_update_locked",
            "Persisted iteration step is already locked for update.",
            "conflict",
            { taskId: input.taskId, stepId: input.stepId },
          ),
        );
      }

      throw error;
    }

    return await applyIterationStepUpdateUnderLock(input);
  } finally {
    if (lockHandle !== undefined) {
      await lockHandle.close().catch(() => undefined);
    }

    if (lockCreatedByThisCaller) {
      await unlink(lockPath).catch(() => undefined);
    }
  }
}

async function applyIterationStepUpdateUnderLock(
  input: UpdateIterationStepInput,
): Promise<Result<IterationStepPersistenceResult, IterationStepError>> {
  const currentResult = await loadIterationStep({
    projectRoot: input.projectRoot,
    taskId: input.taskId,
    stepId: input.stepId,
  });

  if (!currentResult.ok) {
    return currentResult;
  }

  const current = currentResult.value.record;

  if (current.revision !== input.expectedRevision) {
    return err(
      createError(
        "iteration_step_revision_conflict",
        "Persisted iteration step revision did not match the expected revision.",
        "conflict",
        {
          expectedRevision: input.expectedRevision,
          actualRevision: current.revision,
        },
      ),
    );
  }

  const transitioned = transitionIterationStepRecord({
    record: current,
    intent: input.intent,
  });

  if (!transitioned.ok) {
    return transitioned;
  }

  const updated = transitioned.value;

  if (
    updated.stepId !== current.stepId ||
    updated.stepFingerprint !== current.stepFingerprint ||
    updated.launchKind !== current.launchKind ||
    updated.createdAt !== current.createdAt ||
    JSON.stringify(updated.parent) !== JSON.stringify(current.parent) ||
    JSON.stringify(updated.ownership) !== JSON.stringify(current.ownership)
  ) {
    return err(
      createError(
        "iteration_step_immutable_identity_changed",
        "Iteration step immutable identity cannot change across a transition.",
        "validation",
        { stepId: current.stepId },
      ),
    );
  }

  const tempPath = `${currentResult.value.path}.${randomUUID() as string}.tmp`;
  let fileHandle: Awaited<ReturnType<typeof open>> | undefined;

  try {
    fileHandle = await open(tempPath, "wx");
    await fileHandle.writeFile(jsonContent(updated), "utf8");
    await fileHandle.sync();
    await fileHandle.close();
    fileHandle = undefined;

    await rename(tempPath, currentResult.value.path);
  } catch (error) {
    if (fileHandle !== undefined) {
      await fileHandle.close().catch(() => undefined);
    }

    await unlink(tempPath).catch(() => undefined);
    throw error;
  }

  return ok({ record: updated, path: currentResult.value.path });
}

export async function listIterationSteps(
  input: ListIterationStepsInput,
): Promise<Result<readonly IterationStepRecord[], IterationStepError>> {
  const rootResult = await ensureStateStoreRoot({
    projectRoot: input.projectRoot,
    rootRelativePath: AEOS_ITERATION_STEP_ROOT_RELATIVE_PATH,
    taskId: input.taskId,
    create: false,
    errorPrefix: ERROR_PREFIX,
  });

  if (!rootResult.ok) {
    // A task with no step directory has no steps; that is not an error.
    if (rootResult.error.code === `${ERROR_PREFIX}_not_found`) {
      return ok([]);
    }

    return rootResult;
  }

  const entries = (await readdir(rootResult.value)) as string[];
  const records: IterationStepRecord[] = [];

  for (const entry of [...entries].sort()) {
    if (!entry.endsWith(".json")) {
      continue;
    }

    const recordResult = await readExistingStep(
      join(rootResult.value, entry),
      input.taskId,
      entry.slice(0, -".json".length),
    );

    if (!recordResult.ok) {
      return recordResult;
    }

    if (recordResult.value !== undefined) {
      records.push(recordResult.value);
    }
  }

  // Deterministic order: step number, then stepId to break ties between two
  // launch kinds sharing a number.
  return ok(records.sort(compareIterationSteps));
}

// ---------------------------------------------------------------------------
// Public API — resume derivation
// ---------------------------------------------------------------------------

/**
 * Derive the deterministic resume decision for a task's claimed steps.
 *
 * The two crash boundaries this exists to separate:
 *
 *  - crash BEFORE launch — the step is durable in "prepared" and nothing ran.
 *    Launching it is safe, and it is the ONLY case where `launchPermitted` is
 *    true.
 *  - crash AFTER launch — the step is in "running".  Something may have run.
 *    Relaunching would duplicate it, so resume must reconcile the outcome
 *    instead.  `launchPermitted` is false.
 *
 * An `outcome_unknown` step is blocked pending reconciliation; it is never
 * replayed and never blindly retried.  Unsettled steps are considered in
 * step-number order so the decision does not depend on directory enumeration.
 */
export function deriveIterationStepResumeState(
  steps: readonly IterationStepRecord[],
  scope?: IterationRunScope,
): IterationResumeState {
  // Scope first.  A step claimed against a superseded task revision or a
  // previous budget is an orphan of an abandoned run: still durable, still
  // possibly "prepared", and absolutely not launchable by the current run.
  // Without this filter a stale orphan with a low stepNumber would be selected
  // ahead of the live step and reported launchPermitted, which would launch work
  // bound to a parent context that no longer exists.
  const inScope =
    scope === undefined
      ? steps
      : steps.filter(
          (step) =>
            step.parent.taskStateRevision === scope.taskStateRevision &&
            step.parent.budgetId === scope.budgetId,
        );

  const settledStepCount = inScope.filter((step) =>
    TERMINAL_LIFECYCLES.has(step.lifecycle),
  ).length;

  const base = {
    stepCount: inScope.length,
    settledStepCount,
    orphanedStepCount: steps.length - inScope.length,
  };

  if (inScope.length === 0) {
    return {
      action: "no_steps",
      stepId: null,
      stepNumber: null,
      lifecycle: null,
      launchPermitted: false,
      blockedReason: null,
      ...base,
    };
  }

  const ordered = [...inScope].sort(compareIterationSteps);

  // Ambiguity outranks everything: an unreconciled unknown outcome blocks the
  // run regardless of what other steps are waiting.
  const unknown = ordered.find((step) => step.lifecycle === "outcome_unknown");

  if (unknown !== undefined) {
    return {
      action: "reconcile_outcome_unknown",
      stepId: unknown.stepId,
      stepNumber: unknown.parent.stepNumber,
      lifecycle: unknown.lifecycle,
      launchPermitted: false,
      blockedReason:
        "An iteration step has an unknown outcome and must be reconciled before the run continues.",
      ...base,
    };
  }

  const running = ordered.find((step) => step.lifecycle === "running");

  if (running !== undefined) {
    return {
      action: "reconcile_launched_step",
      stepId: running.stepId,
      stepNumber: running.parent.stepNumber,
      lifecycle: running.lifecycle,
      launchPermitted: false,
      blockedReason:
        "An iteration step crossed the launch boundary without a recorded outcome; it must be reconciled, never relaunched.",
      ...base,
    };
  }

  const prepared = ordered.find((step) => step.lifecycle === "prepared");

  if (prepared !== undefined) {
    return {
      action: "resume_prepared_step",
      stepId: prepared.stepId,
      stepNumber: prepared.parent.stepNumber,
      lifecycle: prepared.lifecycle,
      launchPermitted: true,
      blockedReason: null,
      ...base,
    };
  }

  return {
    action: "all_steps_settled",
    stepId: null,
    stepNumber: null,
    lifecycle: null,
    launchPermitted: false,
    blockedReason: null,
    ...base,
  };
}

/**
 * Read the durable steps for a task and derive its resume state, scoped to the
 * task's CURRENT orchestration run.
 *
 * The scope is read from durable state rather than supplied by the caller, so a
 * caller cannot widen it to pick up an orphan from a superseded run.  Two calls
 * against unchanged durable state return the same decision.
 */
export async function loadIterationStepResumeState(input: {
  readonly projectRoot: string;
  readonly taskId: AgenticTaskId;
}): Promise<Result<IterationResumeState, IterationStepError>> {
  const stateResult = await loadTaskState({
    projectRoot: input.projectRoot,
    taskId: input.taskId,
  });

  if (!stateResult.ok) {
    return stateResult;
  }

  const state = stateResult.value.state;

  if (state.iterationBudget === undefined) {
    return err(
      createError(
        "iteration_step_parent_budget_missing",
        "Iteration step resume state requires a durable iteration budget on the parent task.",
        "validation",
        { taskId: input.taskId },
      ),
    );
  }

  const stepsResult = await listIterationSteps(input);

  if (!stepsResult.ok) {
    return stepsResult;
  }

  return ok(
    deriveIterationStepResumeState(stepsResult.value, {
      taskStateRevision: state.revision,
      budgetId: state.iterationBudget.budgetId,
    }),
  );
}
