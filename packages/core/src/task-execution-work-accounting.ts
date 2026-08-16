// @ts-expect-error Node built-ins are available at runtime; this package does not depend on Node ambient types yet.
import { createHash } from "node:crypto";

import type {
  AgenticExecutionAttemptId,
  AgenticTaskId,
  AgenticWorkBatchId,
  AgenticWorkItemId,
} from "./agentic-lifecycle.js";
import { appendTaskExecutionAuditEvent } from "./task-execution-audit-persistence.js";
import { createWorkItemCompletedAccountingAuditEvent } from "./task-execution-audit.js";
import { loadTaskExecutionInvocation } from "./task-execution-invocation-persistence.js";
import {
  coreWorkerBindingsMatch,
  type TaskExecutionWorkerResult,
} from "./task-execution-worker.js";
import { loadTaskState, updateTaskState } from "./task-state-persistence.js";
import type { AeosError, Result } from "./types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WorkAccountingEventKind = "work_item_completed";

/**
 * An AEOS-owned accounting event produced after validating durable invocation
 * evidence.  Workers cannot produce this record by self-reporting — only
 * applyWorkAccountingEvent can emit it, and only when the persisted invocation
 * record is in "returned" lifecycle and all bindings are cross-verified.
 */
export interface WorkAccountingEvent {
  readonly kind: WorkAccountingEventKind;
  /** Deterministic id derived from invocationId + workItemId.  Replays produce
   *  the same id, which collides at the audit layer and is rejected. */
  readonly accountingEventId: string;
  /** Id of the durable audit event appended by this accounting operation. */
  readonly auditEventId: string;
  readonly taskId: AgenticTaskId;
  /** The task revision the worker operated against (from worker result). */
  readonly sourceTaskRevision: number;
  /** The task revision after the accounting mutation (revision + 1). */
  readonly taskStateRevision: number;
  readonly attemptId: AgenticExecutionAttemptId;
  readonly attemptNumber: number;
  readonly invocationId: string;
  readonly idempotencyKey: string;
  readonly workItemId: AgenticWorkItemId;
  readonly batchId: AgenticWorkBatchId;
  /** completedCount on the batch after this accounting event. */
  readonly completedCount: number;
  readonly expectedItemCount: number;
  readonly accountedAt: string;
}

export interface ApplyWorkAccountingEventInput {
  readonly projectRoot: string;
  readonly workerResult: TaskExecutionWorkerResult;
  /** The task state revision the caller observed before calling this function.
   *  The mutation will fail with task_state_revision_conflict if the state has
   *  moved on, providing the same optimistic-locking protection as
   *  transitionPersistedTaskState. */
  readonly expectedTaskRevision: number;
  readonly accountedAt?: string;
}

export type WorkAccountingEventError = AeosError;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

function err(
  error: WorkAccountingEventError,
): Result<never, WorkAccountingEventError> {
  return { ok: false, error };
}

function createError(
  code: string,
  message: string,
  category: AeosError["category"],
  details?: Record<string, string | number | boolean | null>,
): WorkAccountingEventError {
  return details === undefined
    ? { code, message, category, retryable: false }
    : { code, message, category, retryable: false, details };
}

function sha256hex(value: string): string {
  return (createHash("sha256") as ReturnType<typeof createHash>)
    .update(value)
    .digest("hex") as string;
}

/**
 * Derive a deterministic accounting event id from the immutable invocation
 * identity.  A replay carrying the same invocationId + workItemId produces the
 * identical id.
 */
function deriveAccountingEventId(
  invocationId: string,
  workItemId: string,
): string {
  return `acct-wic-${sha256hex(`work_item_completed:${invocationId}:${workItemId}`).slice(0, 32)}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert a normalized worker result plus durable invocation evidence into an
 * AEOS-owned accounting event that increments completedCount on the batch.
 *
 * Authority boundary:
 *  - Worker-supplied fields (output, message, metadata, diagnosticCode, failure,
 *    issues) are never consulted.  Only AEOS-owned binding fields are used.
 *  - A worker claiming ok=true is necessary but not sufficient.  The persisted
 *    invocation record must be in "returned" lifecycle and all bindings must
 *    cross-verify between the worker result and the durable record.
 *  - Duplicate evidence is suppressed at the work-item eligibility gate (step 6):
 *    a completed work item rejects further accounting before any write runs.
 *    The audit layer provides a secondary defence against concurrent replays.
 *  - Stale task revisions are rejected via updateTaskState's revision guard,
 *    matching the protection in transitionPersistedTaskState.
 */
export async function applyWorkAccountingEvent(
  input: ApplyWorkAccountingEventInput,
): Promise<Result<WorkAccountingEvent, WorkAccountingEventError>> {
  const { workerResult, projectRoot, expectedTaskRevision } = input;
  const accountedAt = input.accountedAt ?? new Date().toISOString();

  // --- Step 1: Extract AEOS-owned binding fields from the worker result.
  // Worker-supplied authority fields (output, message, metadata, etc.) are
  // deliberately never read here.
  const {
    taskId,
    sourceTaskRevision,
    attemptId,
    attemptNumber,
    invocationId,
    idempotencyKey,
    workItemId,
    batchId,
    ok: workerOk,
  } = workerResult;

  if (workItemId === null) {
    return err(
      createError(
        "work_accounting_work_item_required",
        "Work accounting requires a bound work item. Worker result carries no workItemId.",
        "validation",
      ),
    );
  }

  if (batchId === null) {
    return err(
      createError(
        "work_accounting_batch_required",
        "Work accounting requires a bound batch. Worker result carries no batchId.",
        "validation",
      ),
    );
  }

  // Worker ok=true is a necessary condition — an unsuccessful invocation
  // cannot account for a completed work item — but it is never sufficient on
  // its own.  Durable evidence is validated below.
  if (!workerOk) {
    return err(
      createError(
        "work_accounting_worker_not_ok",
        "Work accounting requires a successful worker result (ok === true).",
        "validation",
        { workItemId, batchId },
      ),
    );
  }

  // --- Step 2: Load and validate durable invocation evidence.
  const invocationResult = await loadTaskExecutionInvocation({
    projectRoot,
    taskId,
    invocationId,
  });

  if (!invocationResult.ok) {
    return invocationResult;
  }

  const record = invocationResult.value.record;

  // --- Step 3: Cross-verify AEOS-owned bindings between worker result and
  // durable record.  The worker cannot forge these — they originate from
  // AEOS-controlled invocation reservation on both sides.
  //
  // Core fields (invocationId, idempotencyKey, taskId, attemptId,
  // attemptNumber) are verified via coreWorkerBindingsMatch — the single
  // shared authority for these comparisons.  workItemId and batchId are
  // verified in their own blocks below to provide granular error codes;
  // that difference from the worker-side structuredBindingsMatch is
  // intentional and explicit.
  if (!coreWorkerBindingsMatch(record, { taskId, invocationId, idempotencyKey, attemptId, attemptNumber })) {
    return err(
      createError(
        "work_accounting_invocation_identity_mismatch",
        "Worker result AEOS binding fields do not match the durable invocation evidence.",
        "validation",
        { taskId, invocationId },
      ),
    );
  }

  if (record.workItemId !== workItemId) {
    return err(
      createError(
        "work_accounting_work_item_binding_mismatch",
        "Worker result workItemId does not match the durable invocation evidence.",
        "validation",
        {
          claimedWorkItemId: workItemId,
          evidenceWorkItemId: record.workItemId ?? null,
        },
      ),
    );
  }

  if (record.batchId !== batchId) {
    return err(
      createError(
        "work_accounting_batch_binding_mismatch",
        "Worker result batchId does not match the durable invocation evidence.",
        "validation",
        {
          claimedBatchId: batchId,
          evidenceBatchId: record.batchId ?? null,
        },
      ),
    );
  }

  // --- Step 4: Verify the invocation actually returned (durable structural
  // evidence).  invocationOk in the worker result is NOT accounting authority —
  // only lifecycle "returned" in the persisted record constitutes durable
  // evidence of a completed invocation.
  if (record.lifecycle !== "returned") {
    return err(
      createError(
        "work_accounting_invocation_not_returned",
        "Work accounting requires a durable invocation record in returned lifecycle.",
        "validation",
        { lifecycle: record.lifecycle, invocationId },
      ),
    );
  }

  // --- Step 5: Load task state and verify it matches the expected revision.
  // This is the same optimistic-locking check as transitionPersistedTaskState /
  // updateTaskState — callers must read current state before calling.
  const stateResult = await loadTaskState({ projectRoot, taskId });

  if (!stateResult.ok) {
    return stateResult;
  }

  const state = stateResult.value.state;

  if (state.revision !== expectedTaskRevision) {
    return err(
      createError(
        "task_state_revision_conflict",
        "Persisted task state revision did not match the expected revision.",
        "conflict",
        {
          expectedRevision: expectedTaskRevision,
          actualRevision: state.revision,
        },
      ),
    );
  }

  // --- Step 6: Verify work item membership and eligibility in current task state.
  const workItem = state.workItems.find((item) => item.id === workItemId);

  if (workItem === undefined) {
    return err(
      createError(
        "work_accounting_work_item_not_in_state",
        "Work item from durable invocation evidence is not present in current task state.",
        "validation",
        { workItemId },
      ),
    );
  }

  const batch = state.batches.find((b) => b.id === batchId);

  if (batch === undefined) {
    return err(
      createError(
        "work_accounting_batch_not_in_state",
        "Batch from durable invocation evidence is not present in current task state.",
        "validation",
        { batchId },
      ),
    );
  }

  if (!batch.workItemIds.includes(workItemId)) {
    return err(
      createError(
        "work_accounting_work_item_batch_mismatch",
        "Work item is not a member of the batch named in durable invocation evidence.",
        "validation",
        { workItemId, batchId },
      ),
    );
  }

  if (workItem.state !== "pending" && workItem.state !== "in_progress") {
    return err(
      createError(
        "work_accounting_work_item_not_accountable",
        "Work item is not in a state eligible for completion accounting (must be pending or in_progress).",
        "validation",
        { workItemId, workItemState: workItem.state },
      ),
    );
  }

  // --- Step 7: Derive deterministic accounting event id for idempotency.
  const accountingEventId = deriveAccountingEventId(invocationId, workItemId);

  // --- Step 8: Build the audit event draft.
  // The auditEventId is derived from stable identity fields (invocationId,
  // workItemId, taskStateRevision, etc.).  After the F1 fix occurredAt is NOT
  // included in the hash, so any replay of the same invocation produces the
  // same auditEventId.
  const auditDraftResult = createWorkItemCompletedAccountingAuditEvent({
    taskId,
    taskStateRevision: record.taskStateRevision,
    attemptId,
    attemptNumber,
    invocationId,
    workItemId,
    batchId,
    occurredAt: accountedAt,
  });

  if (!auditDraftResult.ok) {
    return auditDraftResult;
  }

  // --- Step 9: Mutate task state — mark work item completed, update pending
  // list, increment completedCount on the batch.
  //
  // State mutation is performed BEFORE the audit append (F4 ordering fix).
  //
  // Failure analysis:
  //
  //   (failure A)  State mutation fails (revision conflict) → no audit written.
  //                The caller can re-read the current state revision and retry.
  //                This is the primary recoverable case that motivated moving
  //                state mutation before audit append.
  //
  //   (failure B)  State mutation succeeds → audit append fails (transient I/O).
  //                The work item is correctly marked completed; the functional
  //                state is consistent.  The audit record is missing.  The
  //                audit event id is deterministic, so the audit can be
  //                retroactively appended externally.  A retry by the caller
  //                would fail at step 6 (work_accounting_work_item_not_accountable)
  //                since the item is already completed.  This is an audit-gap
  //                scenario (not a double-count risk) and is documented rather
  //                than auto-recovered here.
  //
  //   (failure C)  Caller re-invokes after a prior fully-successful call.
  //                Step 6 rejects the duplicate at the work-item state check
  //                (work_accounting_work_item_not_accountable) before any
  //                write is attempted.
  //
  // updateTaskState is used rather than transitionPersistedTaskState because
  // work-item accounting is NOT a task lifecycle transition.
  // transitionPersistedTaskState drives the task-level state machine (pending →
  // in_progress → complete, etc.) and does not define a "mark work item
  // completed" transition.  updateTaskState provides the identical
  // revision-conflict guard (reads current state, asserts revision ===
  // expectedRevision, saves at revision + 1) without routing through the wrong
  // lifecycle layer.
  const updateResult = await updateTaskState({
    projectRoot,
    taskId,
    expectedRevision: expectedTaskRevision,
    updatedAt: accountedAt,
    update(currentState) {
      return {
        ...currentState,
        workItems: currentState.workItems.map((item) =>
          item.id === workItemId
            ? { ...item, state: "completed" as const }
            : item,
        ),
        pendingWorkItemIds: currentState.pendingWorkItemIds.filter(
          (id) => id !== workItemId,
        ),
        batches: currentState.batches.map((b) =>
          b.id === batchId
            ? { ...b, completedCount: b.completedCount + 1 }
            : b,
        ),
      };
    },
  });

  if (!updateResult.ok) {
    return updateResult;
  }

  const updatedBatch = updateResult.value.state.batches.find(
    (b) => b.id === batchId,
  )!;

  // --- Step 10: Append the audit event (after state mutation succeeds).
  const auditAppendResult = await appendTaskExecutionAuditEvent({
    projectRoot,
    taskId,
    event: auditDraftResult.value,
  });

  if (!auditAppendResult.ok) {
    return auditAppendResult;
  }

  const auditEventId = auditAppendResult.value.event.auditEventId;

  return ok({
    kind: "work_item_completed",
    accountingEventId,
    auditEventId,
    taskId,
    sourceTaskRevision,
    taskStateRevision: updateResult.value.state.revision,
    attemptId,
    attemptNumber,
    invocationId,
    idempotencyKey,
    workItemId,
    batchId,
    completedCount: updatedBatch.completedCount,
    expectedItemCount: updatedBatch.expectedItemCount,
    accountedAt,
  });
}
