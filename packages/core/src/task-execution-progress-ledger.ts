import type {
  AgenticRequirementId,
  AgenticTaskId,
  AgenticWorkBatchId,
  AgenticWorkItem,
  AgenticWorkItemId,
  AgenticWorkItemState,
} from "./agentic-lifecycle.js";
import type { WorkAccountingEvent } from "./task-execution-work-accounting.js";
import { loadTaskState, type PersistedTaskState } from "./task-state-persistence.js";
import type { AeosError, Result } from "./types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const AEOS_PROGRESS_LEDGER_SCHEMA_VERSION = 1;

/**
 * Requirement bucket used for work items that carry no requirementId.  The
 * ledger never invents a requirement identity — unassigned items are grouped
 * under this explicit, reserved id so that Expected/Accounted/Remaining still
 * sum to the task totals.
 */
export const AEOS_PROGRESS_LEDGER_UNASSIGNED_REQUIREMENT_ID =
  "requirement:unassigned";

/**
 * Work item states that count as *accounted*.  This EXTENDS — it does not
 * mirror — the canonical coverage rule
 * `expected_items == completed_items + explicitly_failed_items +
 * explicitly_skipped_items`, which does not include "verified".  "verified" is
 * added here for forward-compatibility only.  Persisted task state currently
 * rejects the "verified" state outright (verifier authority is not unlocked in
 * this MVP), so verifiedItemCount is always 0 against real persisted state
 * today and the two definitions cannot currently disagree.
 */
const ACCOUNTED_WORK_ITEM_STATES: ReadonlySet<AgenticWorkItemState> = new Set<
  AgenticWorkItemState
>(["completed", "verified", "failed", "skipped"]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProgressLedgerRequirementStatus =
  /** Nothing accounted yet and no work item has left "pending". */
  | "not_started"
  /** Some work has started or been accounted, but Remaining > 0. */
  | "in_progress"
  /** Remaining == 0 and every accounted item completed or verified. */
  | "accounted_complete"
  /** Remaining == 0 but at least one item is failed or skipped. */
  | "accounted_with_exceptions";

export type ProgressLedgerEventDisposition =
  /** Evidence matched an accounted work item and was counted once. */
  | "counted"
  /** A replay of an already-counted accounting event identity. */
  | "duplicate_suppressed";

export interface ProgressLedgerWorkItemEntry {
  readonly workItemId: AgenticWorkItemId;
  readonly requirementId: AgenticRequirementId;
  readonly batchId: AgenticWorkBatchId | null;
  readonly state: AgenticWorkItemState;
  /** True when `state` is one of the accounted terminal states. */
  readonly accounted: boolean;
}

export interface ProgressLedgerRequirementEntry {
  readonly requirementId: AgenticRequirementId;
  /** True when this entry is the reserved unassigned bucket. */
  readonly unassigned: boolean;
  readonly expectedItemCount: number;
  readonly accountedItemCount: number;
  /** Always `expectedItemCount - accountedItemCount`; never stored separately. */
  readonly remainingItemCount: number;
  readonly completedItemCount: number;
  readonly verifiedItemCount: number;
  readonly failedItemCount: number;
  readonly skippedItemCount: number;
  readonly pendingItemCount: number;
  readonly inProgressItemCount: number;
  readonly retryableItemCount: number;
  readonly status: ProgressLedgerRequirementStatus;
  readonly workItemIds: readonly AgenticWorkItemId[];
}

export interface ProgressLedgerEventReconciliationEntry {
  readonly accountingEventId: string;
  readonly workItemId: AgenticWorkItemId;
  readonly requirementId: AgenticRequirementId;
  readonly eventTaskStateRevision: number;
  readonly disposition: ProgressLedgerEventDisposition;
}

export interface ProgressLedgerEvidenceSummary {
  readonly suppliedEventCount: number;
  readonly countedEventCount: number;
  readonly duplicateSuppressedCount: number;
  readonly entries: readonly ProgressLedgerEventReconciliationEntry[];
}

/**
 * Authority markers.  The ledger is a read-only projection: it never writes
 * task state, never satisfies a completion gate, and never reads any
 * model/worker-supplied field.
 */
export interface ProgressLedgerAuthority {
  readonly authority: "system";
  readonly derivedFromDurableState: true;
  readonly mutatesTaskState: false;
  readonly modelClaimsAccepted: false;
  readonly grantsCompletionAuthority: false;
}

export interface TaskProgressLedger {
  readonly schemaVersion: typeof AEOS_PROGRESS_LEDGER_SCHEMA_VERSION;
  readonly taskId: AgenticTaskId;
  /** Revision of the persisted task state this projection was derived from. */
  readonly taskStateRevision: number;
  readonly expectedItemCount: number;
  readonly accountedItemCount: number;
  readonly remainingItemCount: number;
  /**
   * accountedItemCount / expectedItemCount, or null when expectedItemCount is
   * 0.  Never a division by zero.
   */
  readonly accountedRatio: number | null;
  readonly requirements: readonly ProgressLedgerRequirementEntry[];
  readonly workItems: readonly ProgressLedgerWorkItemEntry[];
  readonly evidence: ProgressLedgerEvidenceSummary;
  readonly safety: ProgressLedgerAuthority;
  readonly projectedAt: string;
}

export type TaskProgressLedgerError = AeosError;

export interface BuildTaskProgressLedgerInput {
  readonly state: PersistedTaskState;
  /**
   * Optional accounting evidence to reconcile against the state snapshot.
   * Events never contribute to the counters — counters are derived from work
   * item states alone, so duplicate evidence is structurally impossible to
   * double-count.  Reconciliation exists so an operator can see that N events
   * produced K accounted items and why the difference exists.
   */
  readonly accountingEvents?: readonly WorkAccountingEvent[];
  readonly projectedAt?: string;
}

export interface LoadTaskProgressLedgerInput {
  readonly projectRoot: string;
  readonly taskId: AgenticTaskId;
  readonly accountingEvents?: readonly WorkAccountingEvent[];
  readonly projectedAt?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

function err(
  error: TaskProgressLedgerError,
): Result<never, TaskProgressLedgerError> {
  return { ok: false, error };
}

function createError(
  code: string,
  message: string,
  category: AeosError["category"],
  details?: Record<string, string | number | boolean | null>,
): TaskProgressLedgerError {
  return details === undefined
    ? { code, message, category, retryable: false }
    : { code, message, category, retryable: false, details };
}

/**
 * Resolve the requirement an item counts towards.
 *
 * Only an *absent* requirementId falls back to the unassigned bucket.  A
 * present-but-malformed one is refused rather than silently rerouted, because
 * a misrouted item quietly misreports two requirements' Remaining at once.
 * `validateWorkItems` already rejects it at the persistence boundary; this
 * closes the same hole for callers that hand `buildTaskProgressLedger` a
 * synthetic state directly.
 */
function requirementIdOf(
  item: AgenticWorkItem,
): Result<AgenticRequirementId, TaskProgressLedgerError> {
  const requirementId = item.requirementId;

  if (requirementId === undefined) {
    return ok(AEOS_PROGRESS_LEDGER_UNASSIGNED_REQUIREMENT_ID);
  }

  if (typeof requirementId !== "string" || requirementId.length === 0) {
    return err(
      createError(
        "progress_ledger_invalid_requirement_id",
        "Progress ledger work item requirement ids must be non-empty strings when present.",
        "validation",
        { workItemId: item.id },
      ),
    );
  }

  return ok(requirementId);
}

interface RequirementTally {
  readonly requirementId: AgenticRequirementId;
  workItemIds: AgenticWorkItemId[];
  completed: number;
  verified: number;
  failed: number;
  skipped: number;
  pending: number;
  inProgress: number;
  retryable: number;
}

function createTally(requirementId: AgenticRequirementId): RequirementTally {
  return {
    requirementId,
    workItemIds: [],
    completed: 0,
    verified: 0,
    failed: 0,
    skipped: 0,
    pending: 0,
    inProgress: 0,
    retryable: 0,
  };
}

function tallyState(tally: RequirementTally, state: AgenticWorkItemState): void {
  switch (state) {
    case "completed":
      tally.completed += 1;
      return;
    case "verified":
      tally.verified += 1;
      return;
    case "failed":
      tally.failed += 1;
      return;
    case "skipped":
      tally.skipped += 1;
      return;
    case "pending":
      tally.pending += 1;
      return;
    case "in_progress":
      tally.inProgress += 1;
      return;
    case "retryable":
      tally.retryable += 1;
      return;
  }
}

function requirementStatus(
  accounted: number,
  remaining: number,
  started: number,
  exceptions: number,
): ProgressLedgerRequirementStatus {
  if (remaining === 0) {
    return exceptions > 0 ? "accounted_with_exceptions" : "accounted_complete";
  }

  return accounted === 0 && started === 0 ? "not_started" : "in_progress";
}

/**
 * Guard a counter against non-integer, negative and unsafe-range values.  A
 * ledger that cannot be arithmetically trusted is not emitted at all — the
 * projection fails closed rather than reporting a wrong Remaining.
 *
 * Two kinds of value are checked, and only one of them is reachable today:
 *
 *  - `state.revision` comes straight from the caller's state snapshot and is
 *    never re-derived here, so a corrupted snapshot really can carry a
 *    negative, fractional or unsafe-range revision.  This is the live path.
 *  - The derived Expected/Accounted/Remaining triple cannot currently violate
 *    the guard.  Every work item contributes to exactly one tally bucket, so
 *    Accounted is always a subset count of Expected and Remaining is always
 *    >= 0.  The check is retained as a single explicit invariant backstop
 *    against a future refactor that breaks that property, not as a defence
 *    against any input reachable today.  There is deliberately no separate
 *    "accounted exceeds expected" error code: a code no input can produce
 *    would be dead surface for callers keying on it.
 */
function assertSafeCount(
  label: string,
  value: number,
  scope: string,
): TaskProgressLedgerError | null {
  if (!Number.isSafeInteger(value) || value < 0) {
    return createError(
      "progress_ledger_unsafe_count",
      "Progress ledger counters must be non-negative safe integers.",
      "validation",
      { counter: label, scope, value: Number.isFinite(value) ? value : null },
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Derive an AEOS-owned requirement/work-item progress ledger from a persisted
 * task state snapshot.
 *
 * Authority boundary:
 *  - Every counter is derived from AEOS-owned persisted work item states.  No
 *    worker/model-supplied field is read, and no counter is stored
 *    independently, so a model claim cannot move the ledger.
 *  - Remaining is always computed as Expected - Accounted.  It is never
 *    persisted or supplied by a caller.
 *  - Duplicate evidence cannot be counted twice: Accounted is the size of a set
 *    of work items in accounted states, not a sum over an event stream.
 *  - Stale evidence fails closed.  An accounting event that is ahead of the
 *    state snapshot, or that names a work item the snapshot does not show as
 *    accounted, means the snapshot is stale — the ledger errors instead of
 *    projecting a number it cannot justify.
 *  - The ledger performs no writes and grants no completion authority.
 */
export function buildTaskProgressLedger(
  input: BuildTaskProgressLedgerInput,
): Result<TaskProgressLedger, TaskProgressLedgerError> {
  const { state } = input;
  const projectedAt = input.projectedAt ?? new Date().toISOString();
  const accountingEvents = input.accountingEvents ?? [];

  const revisionIssue = assertSafeCount("taskStateRevision", state.revision, "task");

  if (revisionIssue !== null) {
    return err(revisionIssue);
  }

  // --- Step 1: Tally work items per requirement.
  const tallies = new Map<AgenticRequirementId, RequirementTally>();
  const workItemEntries: ProgressLedgerWorkItemEntry[] = [];
  const requirementByWorkItemId = new Map<
    AgenticWorkItemId,
    AgenticRequirementId
  >();
  const accountedWorkItemIds = new Set<AgenticWorkItemId>();

  for (const item of state.workItems) {
    const requirementIdResult = requirementIdOf(item);

    if (!requirementIdResult.ok) {
      return requirementIdResult;
    }

    const requirementId = requirementIdResult.value;
    let tally = tallies.get(requirementId);

    if (tally === undefined) {
      tally = createTally(requirementId);
      tallies.set(requirementId, tally);
    }

    tally.workItemIds.push(item.id);
    tallyState(tally, item.state);

    const accounted = ACCOUNTED_WORK_ITEM_STATES.has(item.state);

    if (accounted) {
      accountedWorkItemIds.add(item.id);
    }

    requirementByWorkItemId.set(item.id, requirementId);
    workItemEntries.push({
      workItemId: item.id,
      requirementId,
      batchId: item.batchId ?? null,
      state: item.state,
      accounted,
    });
  }

  // --- Step 2: Project requirement entries with fail-closed arithmetic.
  const requirements: ProgressLedgerRequirementEntry[] = [];

  for (const tally of [...tallies.values()].sort((left, right) =>
    left.requirementId < right.requirementId
      ? -1
      : left.requirementId > right.requirementId
        ? 1
        : 0,
  )) {
    const expectedItemCount = tally.workItemIds.length;
    const accountedItemCount =
      tally.completed + tally.verified + tally.failed + tally.skipped;
    const remainingItemCount = expectedItemCount - accountedItemCount;

    for (const [label, value] of [
      ["expectedItemCount", expectedItemCount],
      ["accountedItemCount", accountedItemCount],
      ["remainingItemCount", remainingItemCount],
    ] as const) {
      const issue = assertSafeCount(label, value, tally.requirementId);

      if (issue !== null) {
        return err(issue);
      }
    }

    requirements.push({
      requirementId: tally.requirementId,
      unassigned:
        tally.requirementId === AEOS_PROGRESS_LEDGER_UNASSIGNED_REQUIREMENT_ID,
      expectedItemCount,
      accountedItemCount,
      remainingItemCount,
      completedItemCount: tally.completed,
      verifiedItemCount: tally.verified,
      failedItemCount: tally.failed,
      skippedItemCount: tally.skipped,
      pendingItemCount: tally.pending,
      inProgressItemCount: tally.inProgress,
      retryableItemCount: tally.retryable,
      status: requirementStatus(
        accountedItemCount,
        remainingItemCount,
        tally.inProgress + tally.retryable,
        tally.failed + tally.skipped,
      ),
      workItemIds: [...tally.workItemIds].sort(),
    });
  }

  // --- Step 3: Task-level rollup.  Expected is the represented work item
  // count; Accounted is the size of the accounted set; Remaining is derived.
  const expectedItemCount = state.workItems.length;
  const accountedItemCount = accountedWorkItemIds.size;
  const remainingItemCount = expectedItemCount - accountedItemCount;

  for (const [label, value] of [
    ["expectedItemCount", expectedItemCount],
    ["accountedItemCount", accountedItemCount],
    ["remainingItemCount", remainingItemCount],
  ] as const) {
    const issue = assertSafeCount(label, value, "task");

    if (issue !== null) {
      return err(issue);
    }
  }

  // --- Step 4: Reconcile supplied accounting evidence against the snapshot.
  const seenAccountingEventIds = new Set<string>();
  const entries: ProgressLedgerEventReconciliationEntry[] = [];
  let countedEventCount = 0;
  let duplicateSuppressedCount = 0;

  for (const event of accountingEvents) {
    if (event.taskId !== state.taskId) {
      return err(
        createError(
          "progress_ledger_event_task_mismatch",
          "Accounting evidence is bound to a different task than the ledger state.",
          "validation",
          { ledgerTaskId: state.taskId, eventTaskId: event.taskId },
        ),
      );
    }

    const requirementId = requirementByWorkItemId.get(event.workItemId);

    if (requirementId === undefined) {
      return err(
        createError(
          "progress_ledger_event_work_item_unknown",
          "Accounting evidence names a work item that is not represented in the ledger state.",
          "validation",
          { workItemId: event.workItemId },
        ),
      );
    }

    // Evidence produced against a revision the snapshot has not reached means
    // the snapshot is stale, not that the evidence is wrong.
    if (event.taskStateRevision > state.revision) {
      return err(
        createError(
          "progress_ledger_state_stale_for_evidence",
          "Progress ledger state snapshot is older than the supplied accounting evidence.",
          "conflict",
          {
            stateRevision: state.revision,
            eventTaskStateRevision: event.taskStateRevision,
            workItemId: event.workItemId,
          },
        ),
      );
    }

    if (!accountedWorkItemIds.has(event.workItemId)) {
      return err(
        createError(
          "progress_ledger_evidence_not_reflected_in_state",
          "Accounting evidence names a work item the state snapshot does not show as accounted.",
          "conflict",
          {
            workItemId: event.workItemId,
            stateRevision: state.revision,
            eventTaskStateRevision: event.taskStateRevision,
          },
        ),
      );
    }

    const duplicate = seenAccountingEventIds.has(event.accountingEventId);

    if (duplicate) {
      duplicateSuppressedCount += 1;
    } else {
      seenAccountingEventIds.add(event.accountingEventId);
      countedEventCount += 1;
    }

    entries.push({
      accountingEventId: event.accountingEventId,
      workItemId: event.workItemId,
      requirementId,
      eventTaskStateRevision: event.taskStateRevision,
      disposition: duplicate ? "duplicate_suppressed" : "counted",
    });
  }

  // Distinct evidence can never outnumber the accounted work items it explains.
  if (countedEventCount > accountedItemCount) {
    return err(
      createError(
        "progress_ledger_evidence_exceeds_accounted",
        "Distinct accounting evidence cannot exceed the accounted work item count.",
        "validation",
        { countedEventCount, accountedItemCount },
      ),
    );
  }

  return ok({
    schemaVersion: AEOS_PROGRESS_LEDGER_SCHEMA_VERSION,
    taskId: state.taskId,
    taskStateRevision: state.revision,
    expectedItemCount,
    accountedItemCount,
    remainingItemCount,
    accountedRatio:
      expectedItemCount === 0 ? null : accountedItemCount / expectedItemCount,
    requirements,
    workItems: [...workItemEntries].sort((left, right) =>
      left.workItemId < right.workItemId
        ? -1
        : left.workItemId > right.workItemId
          ? 1
          : 0,
    ),
    evidence: {
      suppliedEventCount: accountingEvents.length,
      countedEventCount,
      duplicateSuppressedCount,
      // Sorted by (accountingEventId, disposition) so the projection does not
      // inherit the caller's enumeration order.  Evidence read back from a
      // directory scan or cursor can legitimately arrive in a different order
      // between processes, and byte-identical read-back must not depend on
      // caller discipline.  "counted" sorts before "duplicate_suppressed", so
      // the tie between a replay and its original is broken deterministically
      // without relying on sort stability.
      entries: [...entries].sort((left, right) => {
        if (left.accountingEventId !== right.accountingEventId) {
          return left.accountingEventId < right.accountingEventId ? -1 : 1;
        }

        if (left.disposition === right.disposition) {
          return 0;
        }

        return left.disposition === "counted" ? -1 : 1;
      }),
    },
    safety: {
      authority: "system",
      derivedFromDurableState: true,
      mutatesTaskState: false,
      modelClaimsAccepted: false,
      grantsCompletionAuthority: false,
    },
    projectedAt,
  });
}

/**
 * Load durable task state and project the progress ledger from it.  Two calls
 * against unchanged durable state produce identical counters, which is what
 * makes the ledger survive a restart without storing a second copy of the
 * numbers.
 */
export async function loadTaskProgressLedger(
  input: LoadTaskProgressLedgerInput,
): Promise<Result<TaskProgressLedger, TaskProgressLedgerError>> {
  const stateResult = await loadTaskState({
    projectRoot: input.projectRoot,
    taskId: input.taskId,
  });

  if (!stateResult.ok) {
    return stateResult;
  }

  const buildInput: BuildTaskProgressLedgerInput = {
    state: stateResult.value.state,
    ...(input.accountingEvents === undefined
      ? {}
      : { accountingEvents: input.accountingEvents }),
    ...(input.projectedAt === undefined
      ? {}
      : { projectedAt: input.projectedAt }),
  };

  return buildTaskProgressLedger(buildInput);
}

/**
 * Stable JSON projection.  Key order and array order are fixed so that the
 * same ledger always serialises byte-identically.
 */
export function toTaskProgressLedgerJson(
  ledger: TaskProgressLedger,
): Record<string, unknown> {
  return {
    schemaVersion: ledger.schemaVersion,
    taskId: ledger.taskId,
    taskStateRevision: ledger.taskStateRevision,
    expected: ledger.expectedItemCount,
    accounted: ledger.accountedItemCount,
    remaining: ledger.remainingItemCount,
    accountedRatio: ledger.accountedRatio,
    requirements: ledger.requirements.map((requirement) => ({
      requirementId: requirement.requirementId,
      unassigned: requirement.unassigned,
      status: requirement.status,
      expected: requirement.expectedItemCount,
      accounted: requirement.accountedItemCount,
      remaining: requirement.remainingItemCount,
      completed: requirement.completedItemCount,
      verified: requirement.verifiedItemCount,
      failed: requirement.failedItemCount,
      skipped: requirement.skippedItemCount,
      pending: requirement.pendingItemCount,
      inProgress: requirement.inProgressItemCount,
      retryable: requirement.retryableItemCount,
      workItemIds: [...requirement.workItemIds],
    })),
    workItems: ledger.workItems.map((item) => ({
      workItemId: item.workItemId,
      requirementId: item.requirementId,
      batchId: item.batchId,
      state: item.state,
      accounted: item.accounted,
    })),
    evidence: {
      supplied: ledger.evidence.suppliedEventCount,
      counted: ledger.evidence.countedEventCount,
      duplicateSuppressed: ledger.evidence.duplicateSuppressedCount,
      entries: ledger.evidence.entries.map((entry) => ({
        accountingEventId: entry.accountingEventId,
        workItemId: entry.workItemId,
        requirementId: entry.requirementId,
        eventTaskStateRevision: entry.eventTaskStateRevision,
        disposition: entry.disposition,
      })),
    },
    safety: {
      authority: ledger.safety.authority,
      derivedFromDurableState: ledger.safety.derivedFromDurableState,
      mutatesTaskState: ledger.safety.mutatesTaskState,
      modelClaimsAccepted: ledger.safety.modelClaimsAccepted,
      grantsCompletionAuthority: ledger.safety.grantsCompletionAuthority,
    },
    projectedAt: ledger.projectedAt,
  };
}

/**
 * Human-readable operator projection.  Reports the same numbers as the JSON
 * projection from the same ledger object — the two never diverge because both
 * read the already-derived ledger rather than recomputing.
 */
export function renderTaskProgressLedgerText(
  ledger: TaskProgressLedger,
): string {
  const lines: string[] = [
    `AEOS progress ledger — task ${ledger.taskId} (state revision ${ledger.taskStateRevision})`,
    `Expected=${ledger.expectedItemCount} Accounted=${ledger.accountedItemCount} Remaining=${ledger.remainingItemCount}`,
    "",
    "Requirements:",
  ];

  if (ledger.requirements.length === 0) {
    lines.push("  (no represented work items)");
  }

  for (const requirement of ledger.requirements) {
    lines.push(
      `  ${requirement.requirementId} [${requirement.status}] ` +
        `expected=${requirement.expectedItemCount} ` +
        `accounted=${requirement.accountedItemCount} ` +
        `remaining=${requirement.remainingItemCount} ` +
        `(completed=${requirement.completedItemCount} ` +
        `verified=${requirement.verifiedItemCount} ` +
        `failed=${requirement.failedItemCount} ` +
        `skipped=${requirement.skippedItemCount} ` +
        `pending=${requirement.pendingItemCount} ` +
        `in_progress=${requirement.inProgressItemCount} ` +
        `retryable=${requirement.retryableItemCount})`,
    );
  }

  lines.push(
    "",
    `Evidence: supplied=${ledger.evidence.suppliedEventCount} ` +
      `counted=${ledger.evidence.countedEventCount} ` +
      `duplicate_suppressed=${ledger.evidence.duplicateSuppressedCount}`,
    "Authority: system (projection only — no state mutation, no completion authority)",
  );

  return lines.join("\n");
}
