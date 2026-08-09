import type {
  AgenticAdapterId,
  AgenticExecutionAttemptId,
  AgenticLifecycleIssue,
  AgenticTaskId,
  AgenticWorkBatchId,
  AgenticWorkItem,
  AgenticWorkItemId,
} from "./agentic-lifecycle.js";
import type {
  PersistedTaskState,
  TaskStatePersistenceError,
} from "./task-state-persistence.js";
import { validatePersistedTaskState } from "./task-state-persistence.js";
import type { AeosError, Result } from "./types.js";

export const AEOS_TASK_EXECUTION_ATTEMPT_SCHEMA_VERSION = 1;

export type TaskExecutionAttemptLifecycle =
  | "prepared"
  | "started"
  | "failed"
  | "interrupted"
  | "verification_required";

export type TaskExecutionAttemptEventKind =
  | "attempt_prepared"
  | "attempt_started"
  | "attempt_failed"
  | "attempt_interrupted"
  | "verification_required";

export type TaskExecutionFailureCategory =
  | "scope_failure"
  | "policy_failure"
  | "execution_failure"
  | "verification_failure"
  | "coverage_failure"
  | "artifact_failure"
  | "adapter_failure"
  | "audit_failure"
  | "resume_failure"
  | "unknown";

export interface TaskExecutionFailureClassification {
  readonly code: string;
  readonly category: TaskExecutionFailureCategory;
  readonly retryable: boolean;
  readonly diagnostic?: string;
}

export interface TaskExecutionAdapterReferences {
  readonly modelAdapterId?: AgenticAdapterId;
  readonly toolAdapterId?: AgenticAdapterId;
  readonly adapterCallIds: readonly string[];
}

export interface TaskExecutionPolicyRequirement {
  readonly required: boolean;
  readonly referenceId?: string;
}

export interface TaskExecutionVerifierRequirement {
  readonly required: boolean;
  readonly completionGatedByVerifier: true;
  readonly status: "pending" | "not_required";
  readonly referenceId?: string;
}

export interface TaskExecutionAttemptSafety {
  readonly authority: "system";
  readonly noExecution: boolean;
  readonly executionPerformed: false;
  readonly adapterCalls: false;
  readonly auditWrites: false;
  readonly verifierRun: false;
  readonly completedStateCreated: false;
  readonly verifiedStateCreated: false;
  readonly modelSelfReportTrusted: false;
  readonly completionAuthority: false;
  readonly approvalAuthority: false;
}

export interface TaskExecutionAttemptEvent {
  readonly schemaVersion: typeof AEOS_TASK_EXECUTION_ATTEMPT_SCHEMA_VERSION;
  readonly eventId: string;
  readonly attemptId: AgenticExecutionAttemptId;
  readonly taskId: AgenticTaskId;
  readonly taskStateRevision: number;
  readonly kind: TaskExecutionAttemptEventKind;
  readonly sequence: number;
  readonly occurredAt: string;
  readonly failure?: TaskExecutionFailureClassification;
  readonly retryable?: boolean;
  readonly issues: readonly AgenticLifecycleIssue[];
  readonly authority: "system";
}

export interface TaskExecutionAttempt {
  readonly schemaVersion: typeof AEOS_TASK_EXECUTION_ATTEMPT_SCHEMA_VERSION;
  readonly attemptId: AgenticExecutionAttemptId;
  readonly taskId: AgenticTaskId;
  readonly taskStateRevision: number;
  readonly workItemId?: AgenticWorkItemId;
  readonly batchId?: AgenticWorkBatchId;
  readonly lifecycle: TaskExecutionAttemptLifecycle;
  readonly attemptNumber: number;
  readonly priorAttemptId?: AgenticExecutionAttemptId;
  readonly createdAt: string;
  readonly startedAt?: string;
  readonly finishedAt?: string;
  readonly retryable: boolean;
  readonly failure?: TaskExecutionFailureClassification;
  readonly adapterReferences: TaskExecutionAdapterReferences;
  readonly policyRequirement: TaskExecutionPolicyRequirement;
  readonly verifierRequirement: TaskExecutionVerifierRequirement;
  readonly noExecution: boolean;
  readonly safety: TaskExecutionAttemptSafety;
  readonly issues: readonly AgenticLifecycleIssue[];
  readonly events: readonly TaskExecutionAttemptEvent[];
}

export interface PrepareTaskExecutionAttemptInput {
  readonly state: unknown;
  readonly expectedRevision: number;
  readonly workItemId?: AgenticWorkItemId;
  readonly batchId?: AgenticWorkBatchId;
  readonly attemptNumber?: number;
  readonly priorAttemptId?: AgenticExecutionAttemptId;
  readonly createdAt?: string;
  readonly adapterReferences?: {
    readonly modelAdapterId?: AgenticAdapterId;
    readonly toolAdapterId?: AgenticAdapterId;
  };
  readonly policyRequirement?: TaskExecutionPolicyRequirement;
}

export interface PreparedTaskExecutionAttempt {
  readonly attempt: TaskExecutionAttempt;
  readonly event: TaskExecutionAttemptEvent;
}

export type TaskExecutionAttemptTransitionIntent =
  | {
      readonly kind: "start";
    }
  | {
      readonly kind: "fail";
      readonly failure: TaskExecutionFailureClassification;
    }
  | {
      readonly kind: "interrupt";
      readonly failure?: TaskExecutionFailureClassification;
      readonly retryable: boolean;
    }
  | {
      readonly kind: "require_verification";
    };

export interface TransitionTaskExecutionAttemptInput {
  readonly attempt: unknown;
  readonly intent: unknown;
  readonly occurredAt?: string;
}

export interface TaskExecutionAttemptTransition {
  readonly attempt: TaskExecutionAttempt;
  readonly event: TaskExecutionAttemptEvent;
  readonly from: TaskExecutionAttemptLifecycle;
  readonly to: TaskExecutionAttemptLifecycle;
}

export interface ValidateTaskExecutionAttemptForTaskStateInput {
  readonly attempt: unknown;
  readonly state: unknown;
}

export type TaskExecutionAttemptError =
  | TaskStatePersistenceError
  | AeosError;

const executableLifecycleStates = new Set<string>([
  "planned",
  "dry_run_ready",
  "verification_required",
]);

const safeTaskIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

const safeAttemptIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,191}$/;

const allowedAttemptLifecycles = new Set<string>([
  "prepared",
  "started",
  "failed",
  "interrupted",
  "verification_required",
]);

const forbiddenAttemptLifecycles = new Set<string>([
  "succeeded",
  "success",
  "completed",
  "verified",
  "approved",
  "execution_success",
]);

const allowedEventKinds = new Set<string>([
  "attempt_prepared",
  "attempt_started",
  "attempt_failed",
  "attempt_interrupted",
  "verification_required",
]);

const forbiddenEventKinds = new Set<string>([
  "attempt_succeeded",
  "attempt_completed",
  "attempt_verified",
  "work_completed",
  "task_completed",
  "approval_granted",
  "audit_written",
  "verifier_passed",
  "execution_success",
]);

const allowedFailureCategories = new Set<string>([
  "scope_failure",
  "policy_failure",
  "execution_failure",
  "verification_failure",
  "coverage_failure",
  "artifact_failure",
  "adapter_failure",
  "audit_failure",
  "resume_failure",
  "unknown",
]);

function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

function err(
  error: TaskExecutionAttemptError,
): Result<never, TaskExecutionAttemptError> {
  return { ok: false, error };
}

function createError(
  code: string,
  message: string,
  category: AeosError["category"],
  details?: Record<string, string | number | boolean | null>,
): TaskExecutionAttemptError {
  if (details === undefined) {
    return {
      code,
      message,
      category,
      retryable: false,
    };
  }

  return {
    code,
    message,
    category,
    retryable: false,
    details,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isSafePathSegment(value: string, pattern: RegExp): boolean {
  return (
    value === value.trim() &&
    value !== "." &&
    value !== ".." &&
    !value.includes("/") &&
    !value.includes("\\") &&
    pattern.test(value)
  );
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(36).padStart(7, "0");
}

function createAttemptId(input: {
  readonly taskId: AgenticTaskId;
  readonly taskStateRevision: number;
  readonly attemptNumber: number;
  readonly workItemId?: AgenticWorkItemId;
  readonly batchId?: AgenticWorkBatchId;
}): AgenticExecutionAttemptId {
  const discriminator = JSON.stringify({
    taskId: input.taskId,
    taskStateRevision: input.taskStateRevision,
    attemptNumber: input.attemptNumber,
    workItemId: input.workItemId ?? null,
    batchId: input.batchId ?? null,
  });

  return `attempt-${input.taskId}-r${input.taskStateRevision}-n${input.attemptNumber}-${stableHash(discriminator)}`;
}

function createEventId(
  attemptId: AgenticExecutionAttemptId,
  sequence: number,
  kind: TaskExecutionAttemptEventKind,
): string {
  return `event-${attemptId}-s${sequence}-${kind}`;
}

function createAttemptSafety(noExecution: boolean): TaskExecutionAttemptSafety {
  return {
    authority: "system",
    noExecution,
    executionPerformed: false,
    adapterCalls: false,
    auditWrites: false,
    verifierRun: false,
    completedStateCreated: false,
    verifiedStateCreated: false,
    modelSelfReportTrusted: false,
    completionAuthority: false,
    approvalAuthority: false,
  };
}

function issue(
  code: string,
  message: string,
  category: AgenticLifecycleIssue["category"],
  workItemId?: AgenticWorkItemId,
  batchId?: AgenticWorkBatchId,
  attemptId?: AgenticExecutionAttemptId,
): AgenticLifecycleIssue {
  return {
    code,
    message,
    severity: "error",
    category,
    workItemId,
    batchId,
    attemptId,
  };
}

function validateExpectedRevision(
  value: unknown,
): Result<number, TaskExecutionAttemptError> {
  if (!isPositiveInteger(value)) {
    return err(
      createError(
        "task_execution_attempt_expected_revision_invalid",
        "Task execution attempt preparation requires a positive expected revision.",
        "validation",
      ),
    );
  }

  return ok(value);
}

function representedWorkItem(
  state: PersistedTaskState,
  workItemId: AgenticWorkItemId,
): AgenticWorkItem | undefined {
  return state.workItems.find((workItem) => workItem.id === workItemId);
}

function eligibleWorkItemIdsForState(
  state: PersistedTaskState,
): ReadonlySet<AgenticWorkItemId> {
  return new Set([...state.pendingWorkItemIds, ...state.retryableWorkItemIds]);
}

function validateWorkBatchTarget(input: {
  readonly state: PersistedTaskState;
  readonly workItemId?: AgenticWorkItemId;
  readonly batchId?: AgenticWorkBatchId;
}): Result<
  {
    readonly workItemId?: AgenticWorkItemId;
    readonly batchId?: AgenticWorkBatchId;
  },
  TaskExecutionAttemptError
> {
  const eligibleIds = eligibleWorkItemIdsForState(input.state);

  if (input.workItemId !== undefined) {
    const workItem = representedWorkItem(input.state, input.workItemId);

    if (workItem === undefined) {
      return err(
        createError(
          "task_execution_attempt_unknown_work_item",
          "Task execution attempt work item must reference authoritative persisted task state.",
          "validation",
          { workItemId: input.workItemId },
        ),
      );
    }

    if (!eligibleIds.has(input.workItemId)) {
      return err(
        createError(
          "task_execution_attempt_work_item_not_executable",
          "Task execution attempt work item must be pending or retryable.",
          "validation",
          { workItemId: input.workItemId, state: workItem.state },
        ),
      );
    }

    if (
      input.batchId !== undefined &&
      (workItem.batchId !== input.batchId ||
        !input.state.batches.some(
          (batch) =>
            batch.id === input.batchId &&
            batch.workItemIds.includes(input.workItemId!),
        ))
    ) {
      return err(
        createError(
          "task_execution_attempt_work_batch_mismatch",
          "Task execution attempt work item and batch references must agree with persisted task state.",
          "validation",
          { workItemId: input.workItemId, batchId: input.batchId },
        ),
      );
    }

    return ok({
      workItemId: input.workItemId,
      batchId: input.batchId ?? workItem.batchId,
    });
  }

  if (input.batchId !== undefined) {
    const batch = input.state.batches.find((item) => item.id === input.batchId);

    if (batch === undefined) {
      return err(
        createError(
          "task_execution_attempt_unknown_batch",
          "Task execution attempt batch must reference authoritative persisted task state.",
          "validation",
          { batchId: input.batchId },
        ),
      );
    }

    if (!batch.workItemIds.some((workItemId) => eligibleIds.has(workItemId))) {
      return err(
        createError(
          "task_execution_attempt_batch_not_executable",
          "Task execution attempt batch must contain pending or retryable work.",
          "validation",
          { batchId: input.batchId },
        ),
      );
    }

    return ok({ batchId: input.batchId });
  }

  if (eligibleIds.size === 0) {
    return err(
      createError(
        "task_execution_attempt_no_executable_work",
        "Task execution attempt preparation requires pending or retryable work.",
        "validation",
      ),
    );
  }

  return ok({
    batchId: input.state.nextBatchId,
  });
}

function verifierRequirementFromState(
  state: PersistedTaskState,
): TaskExecutionVerifierRequirement {
  return {
    required: state.verifier.required,
    completionGatedByVerifier: true,
    status: state.verifier.required ? "pending" : "not_required",
    referenceId: state.verifier.resultReference?.id ?? state.plan.reference?.id,
  };
}

function createAttemptPreparedEvent(input: {
  readonly attemptId: AgenticExecutionAttemptId;
  readonly taskId: AgenticTaskId;
  readonly taskStateRevision: number;
  readonly occurredAt: string;
  readonly issues: readonly AgenticLifecycleIssue[];
}): TaskExecutionAttemptEvent {
  return {
    schemaVersion: AEOS_TASK_EXECUTION_ATTEMPT_SCHEMA_VERSION,
    eventId: createEventId(input.attemptId, 1, "attempt_prepared"),
    attemptId: input.attemptId,
    taskId: input.taskId,
    taskStateRevision: input.taskStateRevision,
    kind: "attempt_prepared",
    sequence: 1,
    occurredAt: input.occurredAt,
    issues: input.issues,
    authority: "system",
  };
}

export function prepareTaskExecutionAttempt(
  input: PrepareTaskExecutionAttemptInput,
): Result<PreparedTaskExecutionAttempt, TaskExecutionAttemptError> {
  const stateResult = validatePersistedTaskState(input.state);

  if (!stateResult.ok) {
    return stateResult;
  }

  const expectedRevisionResult = validateExpectedRevision(input.expectedRevision);

  if (!expectedRevisionResult.ok) {
    return expectedRevisionResult;
  }

  const state = stateResult.value;

  if (state.revision !== expectedRevisionResult.value) {
    return err(
      createError(
        "task_execution_attempt_stale_task_revision",
        "Task execution attempt source revision does not match current task state revision.",
        "conflict",
        {
          expectedRevision: expectedRevisionResult.value,
          actualRevision: state.revision,
        },
      ),
    );
  }

  if (!executableLifecycleStates.has(state.lifecycleState)) {
    return err(
      createError(
        "task_execution_attempt_lifecycle_not_executable",
        "Task execution attempt cannot be prepared from this task lifecycle.",
        "validation",
        { lifecycleState: state.lifecycleState },
      ),
    );
  }

  const targetResult = validateWorkBatchTarget({
    state,
    workItemId: input.workItemId,
    batchId: input.batchId,
  });

  if (!targetResult.ok) {
    return targetResult;
  }

  const attemptNumber = input.attemptNumber ?? 1;

  if (!isPositiveInteger(attemptNumber)) {
    return err(
      createError(
        "task_execution_attempt_number_invalid",
        "Task execution attempt number must be a positive integer.",
        "validation",
      ),
    );
  }

  const createdAt = input.createdAt ?? new Date().toISOString();
  const attemptId = createAttemptId({
    taskId: state.taskId,
    taskStateRevision: state.revision,
    attemptNumber,
    workItemId: targetResult.value.workItemId,
    batchId: targetResult.value.batchId,
  });
  const issues: AgenticLifecycleIssue[] = [];
  const preparedEvent = createAttemptPreparedEvent({
    attemptId,
    taskId: state.taskId,
    taskStateRevision: state.revision,
    occurredAt: createdAt,
    issues,
  });
  const attempt: TaskExecutionAttempt = {
    schemaVersion: AEOS_TASK_EXECUTION_ATTEMPT_SCHEMA_VERSION,
    attemptId,
    taskId: state.taskId,
    taskStateRevision: state.revision,
    workItemId: targetResult.value.workItemId,
    batchId: targetResult.value.batchId,
    lifecycle: "prepared",
    attemptNumber,
    priorAttemptId: input.priorAttemptId,
    createdAt,
    retryable: false,
    adapterReferences: {
      modelAdapterId: input.adapterReferences?.modelAdapterId,
      toolAdapterId: input.adapterReferences?.toolAdapterId,
      adapterCallIds: [],
    },
    policyRequirement: input.policyRequirement ?? { required: false },
    verifierRequirement: verifierRequirementFromState(state),
    noExecution: true,
    safety: createAttemptSafety(true),
    issues,
    events: [preparedEvent],
  };
  const validationResult = validateTaskExecutionAttempt(attempt);

  if (!validationResult.ok) {
    return validationResult;
  }

  return ok({
    attempt: validationResult.value,
    event: preparedEvent,
  });
}

function validateFailure(
  value: unknown,
): Result<TaskExecutionFailureClassification, TaskExecutionAttemptError> {
  if (
    !isRecord(value) ||
    typeof value.code !== "string" ||
    value.code.length === 0 ||
    typeof value.category !== "string" ||
    !allowedFailureCategories.has(value.category) ||
    typeof value.retryable !== "boolean"
  ) {
    return err(
      createError(
        "task_execution_attempt_invalid_failure",
        "Task execution attempt failure classification must be structured and system-owned.",
        "validation",
      ),
    );
  }

  if (
    typeof value.diagnostic === "string" &&
    /(\n\s*at\s+|Error:|stack)/i.test(value.diagnostic)
  ) {
    return err(
      createError(
        "task_execution_attempt_failure_stack_forbidden",
        "Task execution attempt failure diagnostics cannot persist raw stack traces as authority.",
        "validation",
      ),
    );
  }

  return ok(value as unknown as TaskExecutionFailureClassification);
}

function validateEvent(
  value: unknown,
  attempt: Record<string, unknown>,
  expectedSequence: number,
): Result<TaskExecutionAttemptEvent, TaskExecutionAttemptError> {
  if (!isRecord(value)) {
    return err(
      createError(
        "task_execution_attempt_event_invalid_shape",
        "Task execution attempt event must be a JSON object.",
        "validation",
      ),
    );
  }

  if (value.schemaVersion !== AEOS_TASK_EXECUTION_ATTEMPT_SCHEMA_VERSION) {
    return err(
      createError(
        "task_execution_attempt_event_schema_version_unsupported",
        "Task execution attempt event schema version is unsupported.",
        "validation",
      ),
    );
  }

  if (typeof value.kind !== "string") {
    return err(
      createError(
        "task_execution_attempt_event_kind_required",
        "Task execution attempt event kind is required.",
        "validation",
      ),
    );
  }

  if (forbiddenEventKinds.has(value.kind)) {
    return err(
      createError(
        "task_execution_attempt_event_terminal_forbidden",
        "Task execution attempt events cannot authorize success, completion, verification, approval, audit writes, or verifier passes.",
        "validation",
        { eventKind: value.kind },
      ),
    );
  }

  if (!allowedEventKinds.has(value.kind)) {
    return err(
      createError(
        "task_execution_attempt_event_kind_unknown",
        "Task execution attempt event kind is unknown.",
        "validation",
        { eventKind: value.kind },
      ),
    );
  }

  if (
    typeof value.eventId !== "string" ||
    value.eventId !== createEventId(
      String(attempt.attemptId),
      expectedSequence,
      value.kind as TaskExecutionAttemptEventKind,
    ) ||
    value.attemptId !== attempt.attemptId ||
    value.taskId !== attempt.taskId ||
    value.taskStateRevision !== attempt.taskStateRevision ||
    value.sequence !== expectedSequence ||
    typeof value.occurredAt !== "string" ||
    value.occurredAt.length === 0 ||
    value.authority !== "system" ||
    !Array.isArray(value.issues)
  ) {
    return err(
      createError(
        "task_execution_attempt_event_invalid_authority",
        "Task execution attempt event identity, ordering, or authority is invalid.",
        "validation",
      ),
    );
  }

  if (value.failure !== undefined) {
    const failureResult = validateFailure(value.failure);

    if (!failureResult.ok) {
      return failureResult;
    }
  }

  if (value.retryable !== undefined && typeof value.retryable !== "boolean") {
    return err(
      createError(
        "task_execution_attempt_event_retryable_invalid",
        "Task execution attempt event retryable decision must be boolean.",
        "validation",
      ),
    );
  }

  return ok(value as unknown as TaskExecutionAttemptEvent);
}

function validateEvents(
  value: unknown,
  attempt: Record<string, unknown>,
): Result<readonly TaskExecutionAttemptEvent[], TaskExecutionAttemptError> {
  if (!Array.isArray(value) || value.length === 0) {
    return err(
      createError(
        "task_execution_attempt_events_required",
        "Task execution attempt requires at least one system event.",
        "validation",
      ),
    );
  }

  const seenEventIds = new Set<string>();
  let lifecycle: TaskExecutionAttemptLifecycle | undefined;

  for (let index = 0; index < value.length; index += 1) {
    const eventResult = validateEvent(value[index], attempt, index + 1);

    if (!eventResult.ok) {
      return eventResult;
    }

    const event = eventResult.value;

    if (seenEventIds.has(event.eventId)) {
      return err(
        createError(
          "task_execution_attempt_duplicate_event",
          "Task execution attempt events must not duplicate event identity.",
          "validation",
          { eventId: event.eventId },
        ),
      );
    }

    seenEventIds.add(event.eventId);

    if (index === 0 && event.kind !== "attempt_prepared") {
      return err(
        createError(
          "task_execution_attempt_event_order_invalid",
          "Task execution attempt events must start with attempt_prepared.",
          "validation",
          { eventKind: event.kind },
        ),
      );
    }

    if (index > 0 && event.kind === "attempt_prepared") {
      return err(
        createError(
          "task_execution_attempt_duplicate_prepared_event",
          "Task execution attempt may contain only one attempt_prepared event.",
          "validation",
        ),
      );
    }

    const transitionResult = nextLifecycleFromEvent(lifecycle, event.kind);

    if (!transitionResult.ok) {
      return transitionResult;
    }

    lifecycle = transitionResult.value;
  }

  if (lifecycle !== attempt.lifecycle) {
    return err(
      createError(
        "task_execution_attempt_lifecycle_event_mismatch",
        "Task execution attempt lifecycle must match ordered system events.",
        "validation",
        { lifecycle: String(attempt.lifecycle) },
      ),
    );
  }

  return ok(value as unknown as readonly TaskExecutionAttemptEvent[]);
}

function nextLifecycleFromEvent(
  current: TaskExecutionAttemptLifecycle | undefined,
  eventKind: TaskExecutionAttemptEventKind,
): Result<TaskExecutionAttemptLifecycle, TaskExecutionAttemptError> {
  if (current === undefined) {
    return eventKind === "attempt_prepared"
      ? ok("prepared")
      : err(
          createError(
            "task_execution_attempt_event_order_invalid",
            "Task execution attempt events must start with attempt_prepared.",
            "validation",
            { eventKind },
          ),
        );
  }

  if (current === "prepared" && eventKind === "attempt_started") {
    return ok("started");
  }

  if (current === "started" && eventKind === "attempt_failed") {
    return ok("failed");
  }

  if (current === "started" && eventKind === "attempt_interrupted") {
    return ok("interrupted");
  }

  if (current === "started" && eventKind === "verification_required") {
    return ok("verification_required");
  }

  return err(
    createError(
      "task_execution_attempt_event_order_invalid",
      "Task execution attempt event order is not valid for the closed lifecycle.",
      "validation",
      { eventKind, lifecycle: current },
    ),
  );
}

export function validateTaskExecutionAttempt(
  value: unknown,
): Result<TaskExecutionAttempt, TaskExecutionAttemptError> {
  if (!isRecord(value)) {
    return err(
      createError(
        "task_execution_attempt_invalid_shape",
        "Task execution attempt must be a JSON object.",
        "validation",
      ),
    );
  }

  if (value.schemaVersion !== AEOS_TASK_EXECUTION_ATTEMPT_SCHEMA_VERSION) {
    return err(
      createError(
        "task_execution_attempt_schema_version_unsupported",
        "Task execution attempt schema version is unsupported.",
        "validation",
      ),
    );
  }

  if (typeof value.lifecycle !== "string") {
    return err(
      createError(
        "task_execution_attempt_lifecycle_required",
        "Task execution attempt lifecycle is required.",
        "validation",
      ),
    );
  }

  if (forbiddenAttemptLifecycles.has(value.lifecycle)) {
    return err(
      createError(
        "task_execution_attempt_terminal_lifecycle_forbidden",
        "Task execution attempt cannot authorize success, completion, verification, or approval lifecycle states.",
        "validation",
        { lifecycle: value.lifecycle },
      ),
    );
  }

  if (!allowedAttemptLifecycles.has(value.lifecycle)) {
    return err(
      createError(
        "task_execution_attempt_lifecycle_unknown",
        "Task execution attempt lifecycle is unknown.",
        "validation",
        { lifecycle: value.lifecycle },
      ),
    );
  }

  if (
    typeof value.attemptId !== "string" ||
    value.attemptId.length === 0 ||
    typeof value.taskId !== "string" ||
    value.taskId.length === 0 ||
    !isPositiveInteger(value.taskStateRevision) ||
    !isPositiveInteger(value.attemptNumber) ||
    typeof value.createdAt !== "string" ||
    value.createdAt.length === 0 ||
    typeof value.retryable !== "boolean" ||
    typeof value.noExecution !== "boolean" ||
    !isRecord(value.adapterReferences) ||
    !isStringArray(value.adapterReferences.adapterCallIds) ||
    !isRecord(value.policyRequirement) ||
    typeof value.policyRequirement.required !== "boolean" ||
    !isRecord(value.verifierRequirement) ||
    typeof value.verifierRequirement.required !== "boolean" ||
    value.verifierRequirement.completionGatedByVerifier !== true ||
    !["pending", "not_required"].includes(
      String(value.verifierRequirement.status),
    ) ||
    !Array.isArray(value.issues) ||
    !isRecord(value.safety)
  ) {
    return err(
      createError(
        "task_execution_attempt_required_fields_invalid",
        "Task execution attempt required authority fields are invalid.",
        "validation",
      ),
    );
  }

  if (
    !isSafePathSegment(value.taskId, safeTaskIdPattern) ||
    !isSafePathSegment(value.attemptId, safeAttemptIdPattern)
  ) {
    return err(
      createError(
        "task_execution_attempt_unsafe_identity",
        "Task execution attempt identity fields must be safe system-owned path segments.",
        "validation",
      ),
    );
  }

  if (
    (value.workItemId !== undefined &&
      (typeof value.workItemId !== "string" || value.workItemId.length === 0)) ||
    (value.batchId !== undefined &&
      (typeof value.batchId !== "string" || value.batchId.length === 0)) ||
    (value.priorAttemptId !== undefined &&
      (typeof value.priorAttemptId !== "string" ||
        !isSafePathSegment(value.priorAttemptId, safeAttemptIdPattern)))
  ) {
    return err(
      createError(
        "task_execution_attempt_identity_reference_invalid",
        "Task execution attempt identity reference fields are invalid.",
        "validation",
      ),
    );
  }

  const expectedAttemptId = createAttemptId({
    taskId: value.taskId,
    taskStateRevision: value.taskStateRevision,
    attemptNumber: value.attemptNumber,
    workItemId: value.workItemId,
    batchId: value.batchId,
  });

  if (value.attemptId !== expectedAttemptId) {
    return err(
      createError(
        "task_execution_attempt_identity_not_system_generated",
        "Task execution attempt id must match the deterministic system-generated identity.",
        "validation",
      ),
    );
  }

  if (
    value.startedAt !== undefined &&
    (typeof value.startedAt !== "string" || value.startedAt.length === 0)
  ) {
    return err(
      createError(
        "task_execution_attempt_started_at_invalid",
        "Task execution attempt startedAt must be set only by a system start event.",
        "validation",
      ),
    );
  }

  if (
    value.finishedAt !== undefined &&
    (typeof value.finishedAt !== "string" || value.finishedAt.length === 0)
  ) {
    return err(
      createError(
        "task_execution_attempt_finished_at_invalid",
        "Task execution attempt finishedAt must be set only by a system terminal event.",
        "validation",
      ),
    );
  }

  if (
    value.safety.authority !== "system" ||
    typeof value.safety.noExecution !== "boolean" ||
    value.safety.executionPerformed !== false ||
    value.safety.adapterCalls !== false ||
    value.safety.auditWrites !== false ||
    value.safety.verifierRun !== false ||
    value.safety.completedStateCreated !== false ||
    value.safety.verifiedStateCreated !== false ||
    value.safety.modelSelfReportTrusted !== false ||
    value.safety.completionAuthority !== false ||
    value.safety.approvalAuthority !== false
  ) {
    return err(
      createError(
        "task_execution_attempt_forbidden_safety_metadata",
        "Task execution attempt safety metadata cannot claim execution side effects or completion authority.",
        "validation",
      ),
    );
  }

  if (
    value.lifecycle === "prepared" &&
    (value.startedAt !== undefined ||
      value.finishedAt !== undefined ||
      value.retryable !== false ||
      value.failure !== undefined ||
      value.noExecution !== true ||
      value.safety.noExecution !== true)
  ) {
    return err(
      createError(
        "task_execution_attempt_prepared_authority_invalid",
        "Prepared task execution attempts cannot claim start, finish, failure, retry, or execution.",
        "validation",
      ),
    );
  }

  if (value.failure !== undefined) {
    const failureResult = validateFailure(value.failure);

    if (!failureResult.ok) {
      return failureResult;
    }

    if (value.retryable !== failureResult.value.retryable) {
      return err(
        createError(
          "task_execution_attempt_retryable_mismatch",
          "Task execution attempt retryability must come from structured failure classification.",
          "validation",
        ),
      );
    }
  }

  if (
    (value.lifecycle === "started" ||
      value.lifecycle === "failed" ||
      value.lifecycle === "interrupted" ||
      value.lifecycle === "verification_required") &&
    value.startedAt === undefined
  ) {
    return err(
      createError(
        "task_execution_attempt_started_at_required",
        "Started or later task execution attempts require a system-owned startedAt timestamp.",
        "validation",
      ),
    );
  }

  if (
    (value.lifecycle === "failed" ||
      value.lifecycle === "interrupted" ||
      value.lifecycle === "verification_required") &&
    value.finishedAt === undefined
  ) {
    return err(
      createError(
        "task_execution_attempt_finished_at_required",
        "Terminal or verification-required task execution attempts require a system-owned finishedAt timestamp.",
        "validation",
      ),
    );
  }

  if (
    (value.lifecycle === "failed" || value.lifecycle === "interrupted") &&
    value.failure === undefined
  ) {
    return err(
      createError(
        "task_execution_attempt_failure_required",
        "Failed or interrupted task execution attempts require structured failure classification.",
        "validation",
      ),
    );
  }

  const eventResult = validateEvents(value.events, value);

  if (!eventResult.ok) {
    return eventResult;
  }

  return ok(value as unknown as TaskExecutionAttempt);
}

function intentKindFromUnknown(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (!isRecord(value) || typeof value.kind !== "string") {
    return undefined;
  }

  return value.kind;
}

function hasTerminalIntent(value: unknown): string | undefined {
  const terminalValues = new Set([
    "succeed",
    "success",
    "complete",
    "completed",
    "verify",
    "verified",
    "approve",
    "approval_granted",
    "audit_written",
    "verifier_passed",
    "execution_success",
  ]);
  const kind = intentKindFromUnknown(value);

  if (kind !== undefined && terminalValues.has(kind)) {
    return kind;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  for (const key of ["to", "target", "targetLifecycle", "lifecycle"] as const) {
    const target = value[key];

    if (typeof target === "string" && terminalValues.has(target)) {
      return target;
    }
  }

  return undefined;
}

function parseTransitionIntent(
  value: unknown,
): Result<TaskExecutionAttemptTransitionIntent, TaskExecutionAttemptError> {
  const terminalIntent = hasTerminalIntent(value);

  if (terminalIntent !== undefined) {
    return err(
      createError(
        "task_execution_attempt_terminal_transition_forbidden",
        "Task execution attempt transitions cannot authorize success, completion, verification, approval, audit writes, or verifier passes.",
        "validation",
        { intent: terminalIntent },
      ),
    );
  }

  if (!isRecord(value) || typeof value.kind !== "string") {
    return err(
      createError(
        "task_execution_attempt_transition_unknown",
        "Task execution attempt transition intent is unknown or unsupported.",
        "validation",
      ),
    );
  }

  if (
    typeof value.to === "string" ||
    typeof value.target === "string" ||
    typeof value.targetLifecycle === "string" ||
    typeof value.lifecycle === "string"
  ) {
    return err(
      createError(
        "task_execution_attempt_arbitrary_target_forbidden",
        "Task execution attempt transitions require a closed system intent and cannot accept arbitrary lifecycle targets.",
        "validation",
      ),
    );
  }

  if (value.kind === "start") {
    return ok({ kind: "start" });
  }

  if (value.kind === "fail") {
    const failureResult = validateFailure(value.failure);

    if (!failureResult.ok) {
      return failureResult;
    }

    return ok({ kind: "fail", failure: failureResult.value });
  }

  if (value.kind === "interrupt") {
    if (typeof value.retryable !== "boolean") {
      return err(
        createError(
          "task_execution_attempt_interrupt_retryable_required",
          "Interrupted task execution attempts require a system-owned retryable decision.",
          "validation",
        ),
      );
    }

    if (value.failure !== undefined) {
      const failureResult = validateFailure(value.failure);

      if (!failureResult.ok) {
        return failureResult;
      }

      if (failureResult.value.retryable !== value.retryable) {
        return err(
          createError(
            "task_execution_attempt_retryable_mismatch",
            "Task execution attempt retryability must come from structured failure classification.",
            "validation",
          ),
        );
      }

      return ok({
        kind: "interrupt",
        retryable: value.retryable,
        failure: failureResult.value,
      });
    }

    return ok({ kind: "interrupt", retryable: value.retryable });
  }

  if (value.kind === "require_verification") {
    return ok({ kind: "require_verification" });
  }

  return err(
    createError(
      "task_execution_attempt_transition_unknown",
      "Task execution attempt transition intent is unknown or unsupported.",
      "validation",
      { intent: value.kind },
    ),
  );
}

function eventKindForIntent(
  intent: TaskExecutionAttemptTransitionIntent,
): TaskExecutionAttemptEventKind {
  if (intent.kind === "start") {
    return "attempt_started";
  }

  if (intent.kind === "fail") {
    return "attempt_failed";
  }

  if (intent.kind === "interrupt") {
    return "attempt_interrupted";
  }

  return "verification_required";
}

function lifecycleForIntent(
  intent: TaskExecutionAttemptTransitionIntent,
): TaskExecutionAttemptLifecycle {
  if (intent.kind === "start") {
    return "started";
  }

  if (intent.kind === "fail") {
    return "failed";
  }

  if (intent.kind === "interrupt") {
    return "interrupted";
  }

  return "verification_required";
}

function validateAllowedRuntimeTransition(
  attempt: TaskExecutionAttempt,
  intent: TaskExecutionAttemptTransitionIntent,
): Result<void, TaskExecutionAttemptError> {
  if (attempt.lifecycle === "prepared" && intent.kind === "start") {
    return ok(undefined);
  }

  if (
    attempt.lifecycle === "started" &&
    (intent.kind === "fail" ||
      intent.kind === "interrupt" ||
      intent.kind === "require_verification")
  ) {
    return ok(undefined);
  }

  return err(
    createError(
      "task_execution_attempt_transition_not_allowed",
      "Task execution attempt transition is not allowed from the current lifecycle.",
      "validation",
      { lifecycle: attempt.lifecycle, intent: intent.kind },
    ),
  );
}

export function transitionTaskExecutionAttempt(
  input: TransitionTaskExecutionAttemptInput,
): Result<TaskExecutionAttemptTransition, TaskExecutionAttemptError> {
  const attemptResult = validateTaskExecutionAttempt(input.attempt);

  if (!attemptResult.ok) {
    return attemptResult;
  }

  const intentResult = parseTransitionIntent(input.intent);

  if (!intentResult.ok) {
    return intentResult;
  }

  const attempt = attemptResult.value;
  const allowedResult = validateAllowedRuntimeTransition(attempt, intentResult.value);

  if (!allowedResult.ok) {
    return allowedResult;
  }

  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const eventKind = eventKindForIntent(intentResult.value);
  const sequence = attempt.events.length + 1;
  const event: TaskExecutionAttemptEvent = {
    schemaVersion: AEOS_TASK_EXECUTION_ATTEMPT_SCHEMA_VERSION,
    eventId: createEventId(attempt.attemptId, sequence, eventKind),
    attemptId: attempt.attemptId,
    taskId: attempt.taskId,
    taskStateRevision: attempt.taskStateRevision,
    kind: eventKind,
    sequence,
    occurredAt,
    failure:
      intentResult.value.kind === "fail" ||
      intentResult.value.kind === "interrupt"
        ? intentResult.value.failure
        : undefined,
    retryable:
      intentResult.value.kind === "fail"
        ? intentResult.value.failure.retryable
        : intentResult.value.kind === "interrupt"
          ? intentResult.value.retryable
          : undefined,
    issues:
      intentResult.value.kind === "fail" ||
      intentResult.value.kind === "interrupt"
        ? [
            issue(
              intentResult.value.failure?.code ??
                "task_execution_attempt_interrupted",
              intentResult.value.failure?.diagnostic ??
                "Task execution attempt stopped with system-owned failure classification.",
              intentResult.value.failure?.category ?? "execution_failure",
              attempt.workItemId,
              attempt.batchId,
              attempt.attemptId,
            ),
          ]
        : [],
    authority: "system",
  };
  const nextLifecycle = lifecycleForIntent(intentResult.value);
  const nextAttempt: TaskExecutionAttempt = {
    ...attempt,
    lifecycle: nextLifecycle,
    startedAt:
      intentResult.value.kind === "start" ? occurredAt : attempt.startedAt,
    finishedAt:
      nextLifecycle === "failed" ||
      nextLifecycle === "interrupted" ||
      nextLifecycle === "verification_required"
        ? occurredAt
        : attempt.finishedAt,
    retryable:
      intentResult.value.kind === "fail"
        ? intentResult.value.failure.retryable
        : intentResult.value.kind === "interrupt"
          ? intentResult.value.retryable
          : attempt.retryable,
    failure:
      intentResult.value.kind === "fail" ||
      intentResult.value.kind === "interrupt"
        ? intentResult.value.failure
        : attempt.failure,
    noExecution:
      intentResult.value.kind === "start" ? false : attempt.noExecution,
    safety:
      intentResult.value.kind === "start"
        ? createAttemptSafety(false)
        : attempt.safety,
    issues: [...attempt.issues, ...event.issues],
    events: [...attempt.events, event],
  };
  const validationResult = validateTaskExecutionAttempt(nextAttempt);

  if (!validationResult.ok) {
    return validationResult;
  }

  return ok({
    attempt: validationResult.value,
    event,
    from: attempt.lifecycle,
    to: validationResult.value.lifecycle,
  });
}

export function validateTaskExecutionAttemptForTaskState(
  input: ValidateTaskExecutionAttemptForTaskStateInput,
): Result<TaskExecutionAttempt, TaskExecutionAttemptError> {
  const attemptResult = validateTaskExecutionAttempt(input.attempt);

  if (!attemptResult.ok) {
    return attemptResult;
  }

  const stateResult = validatePersistedTaskState(input.state);

  if (!stateResult.ok) {
    return stateResult;
  }

  const attempt = attemptResult.value;
  const state = stateResult.value;

  if (attempt.taskId !== state.taskId) {
    return err(
      createError(
        "task_execution_attempt_task_id_mismatch",
        "Task execution attempt task id does not match persisted task state.",
        "validation",
      ),
    );
  }

  if (attempt.taskStateRevision !== state.revision) {
    return err(
      createError(
        "task_execution_attempt_stale_task_revision",
        "Task execution attempt source revision does not match current task state revision.",
        "conflict",
        {
          expectedRevision: attempt.taskStateRevision,
          actualRevision: state.revision,
        },
      ),
    );
  }

  const targetResult = validateWorkBatchTarget({
    state,
    workItemId: attempt.workItemId,
    batchId: attempt.batchId,
  });

  if (!targetResult.ok) {
    return targetResult;
  }

  if (
    targetResult.value.workItemId !== attempt.workItemId ||
    targetResult.value.batchId !== attempt.batchId
  ) {
    return err(
      createError(
        "task_execution_attempt_binding_mismatch",
        "Task execution attempt work or batch binding does not match persisted task state.",
        "validation",
      ),
    );
  }

  return ok(attempt);
}
