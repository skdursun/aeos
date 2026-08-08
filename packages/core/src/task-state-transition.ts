import type {
  AgenticLifecycleIssue,
  AgenticTaskId,
} from "./agentic-lifecycle.js";
import type {
  AgenticRunnerDryRunReference,
} from "./agentic-runner-dry-run.js";
import type {
  AgenticRunnerPlanningReference,
} from "./agentic-runner-planning.js";
import type { AeosError, Result } from "./types.js";
import {
  loadTaskState,
  saveTaskState,
  validatePersistedTaskState,
  type PersistedTaskLifecycleState,
  type PersistedTaskState,
  type TaskStatePersistenceError,
} from "./task-state-persistence.js";

export type TaskStateTransitionIntent =
  | {
      readonly kind: "mark_dry_run_ready";
    }
  | {
      readonly kind: "require_verification";
    }
  | {
      readonly kind: "mark_blocked";
    };

export type TaskStateTransitionEvidence =
  | TaskStateDryRunReadyEvidence
  | TaskStateVerificationRequiredEvidence
  | TaskStateBlockedEvidence;

export interface TaskStateDryRunReadyEvidence {
  readonly kind: "dry_run";
  readonly dryRunSucceeded: true;
  readonly noExecution: true;
  readonly noWrites: true;
  readonly adapterCalls: false;
  readonly auditWrites: false;
  readonly verifierRun: false;
  readonly persistence: false;
  readonly filesystemMutation: false;
  readonly completedStateCreated: false;
  readonly resultReference?: AgenticRunnerDryRunReference;
}

export interface TaskStateVerificationRequiredEvidence {
  readonly kind: "verification_requirement";
  readonly verifierRequired: true;
  readonly completionGatedByVerifier: true;
  readonly requirementReference?: AgenticRunnerPlanningReference;
}

export interface TaskStateBlockedEvidence {
  readonly kind: "blocked_work";
  readonly issues: readonly AgenticLifecycleIssue[];
}

export interface EvaluateTaskStateTransitionInput {
  readonly state: unknown;
  readonly intent: unknown;
  readonly evidence?: unknown;
  readonly updatedAt?: string;
}

export interface TaskStateTransitionPlan {
  readonly taskId: AgenticTaskId;
  readonly intent: TaskStateTransitionIntent["kind"];
  readonly from: PersistedTaskLifecycleState;
  readonly to: PersistedTaskLifecycleState;
  readonly evidenceKind: TaskStateTransitionEvidence["kind"];
}

export interface TaskStateTransitionUpdate extends TaskStateTransitionPlan {
  readonly state: PersistedTaskState;
}

export interface PersistTaskStateTransitionInput {
  readonly projectRoot: string;
  readonly taskId: AgenticTaskId;
  readonly expectedRevision: number;
  readonly intent: TaskStateTransitionIntent;
  readonly evidence: TaskStateTransitionEvidence;
  readonly updatedAt?: string;
}

export interface PersistedTaskStateTransitionResult
  extends TaskStateTransitionUpdate {
  readonly path: string;
}

export type TaskStateTransitionError =
  | TaskStatePersistenceError
  | AeosError;

const terminalLifecycleStates = new Set<string>([
  "completed",
  "verified",
  "approved",
  "execution_success",
]);

const terminalIntentKinds = new Set<string>([
  "mark_completed",
  "mark_verified",
  "mark_approved",
  "mark_execution_success",
  "completed",
  "verified",
  "approved",
  "execution_success",
]);

const transitionTargets: Readonly<
  Record<TaskStateTransitionIntent["kind"], PersistedTaskLifecycleState>
> = {
  mark_dry_run_ready: "dry_run_ready",
  require_verification: "verification_required",
  mark_blocked: "blocked",
};

const allowedTransitions: Readonly<
  Record<
    PersistedTaskLifecycleState,
    Partial<
      Record<
        TaskStateTransitionIntent["kind"],
        PersistedTaskLifecycleState
      >
    >
  >
> = {
  new: {},
  planned: {
    mark_dry_run_ready: "dry_run_ready",
    require_verification: "verification_required",
    mark_blocked: "blocked",
  },
  dry_run_ready: {
    require_verification: "verification_required",
    mark_blocked: "blocked",
  },
  verification_required: {
    mark_blocked: "blocked",
  },
  blocked: {},
  failed: {},
};

function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

function err(error: TaskStateTransitionError): Result<never, TaskStateTransitionError> {
  return { ok: false, error };
}

function createError(
  code: string,
  message: string,
  category: AeosError["category"],
  details?: Record<string, string | number | boolean | null>,
): TaskStateTransitionError {
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

function intentKindFromUnknown(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (!isRecord(value) || typeof value.kind !== "string") {
    return undefined;
  }

  return value.kind;
}

function hasArbitraryTarget(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.targetLifecycle === "string" ||
    typeof value.targetLifecycleState === "string" ||
    typeof value.lifecycleState === "string" ||
    typeof value.to === "string"
  );
}

function terminalTargetFromUnknown(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return typeof value === "string" && terminalLifecycleStates.has(value)
      ? value
      : undefined;
  }

  for (const key of [
    "targetLifecycle",
    "targetLifecycleState",
    "lifecycleState",
    "to",
  ] as const) {
    const target = value[key];

    if (typeof target === "string" && terminalLifecycleStates.has(target)) {
      return target;
    }
  }

  return undefined;
}

function parseTransitionIntent(
  value: unknown,
): Result<TaskStateTransitionIntent, TaskStateTransitionError> {
  const terminalTarget = terminalTargetFromUnknown(value);

  if (terminalTarget !== undefined) {
    return err(
      createError(
        "task_state_transition_terminal_forbidden",
        "Task state transitions cannot authorize completed, verified, approved, or execution-success lifecycle states.",
        "validation",
        { lifecycleState: terminalTarget },
      ),
    );
  }

  const kind = intentKindFromUnknown(value);

  if (kind !== undefined && terminalIntentKinds.has(kind)) {
    return err(
      createError(
        "task_state_transition_terminal_forbidden",
        "Task state transitions cannot authorize completed, verified, approved, or execution-success lifecycle states.",
        "validation",
        { intent: kind },
      ),
    );
  }

  if (hasArbitraryTarget(value)) {
    return err(
      createError(
        "task_state_transition_arbitrary_target_forbidden",
        "Task state transitions require a closed system intent and cannot accept arbitrary target lifecycle state.",
        "validation",
      ),
    );
  }

  if (kind === "mark_dry_run_ready") {
    return ok({ kind });
  }

  if (kind === "require_verification") {
    return ok({ kind });
  }

  if (kind === "mark_blocked") {
    return ok({ kind });
  }

  return err(
    createError(
      "task_state_transition_unknown_intent",
      "Task state transition intent is unknown or unsupported.",
      "validation",
      { intent: kind ?? null },
    ),
  );
}

function isDryRunReadyEvidence(
  evidence: unknown,
): evidence is TaskStateDryRunReadyEvidence {
  return (
    isRecord(evidence) &&
    evidence.kind === "dry_run" &&
    evidence.dryRunSucceeded === true &&
    evidence.noExecution === true &&
    evidence.noWrites === true &&
    evidence.adapterCalls === false &&
    evidence.auditWrites === false &&
    evidence.verifierRun === false &&
    evidence.persistence === false &&
    evidence.filesystemMutation === false &&
    evidence.completedStateCreated === false
  );
}

function isVerificationRequiredEvidence(
  evidence: unknown,
): evidence is TaskStateVerificationRequiredEvidence {
  return (
    isRecord(evidence) &&
    evidence.kind === "verification_requirement" &&
    evidence.verifierRequired === true &&
    evidence.completionGatedByVerifier === true
  );
}

function isBlockedEvidence(
  evidence: unknown,
): evidence is TaskStateBlockedEvidence {
  return (
    isRecord(evidence) &&
    evidence.kind === "blocked_work" &&
    Array.isArray(evidence.issues) &&
    evidence.issues.length > 0 &&
    evidence.issues.every((issue) =>
      isRecord(issue) &&
      typeof issue.code === "string" &&
      issue.code.length > 0 &&
      typeof issue.message === "string" &&
      issue.message.length > 0 &&
      (issue.severity === "error" || issue.severity === "critical") &&
      typeof issue.category === "string"
    )
  );
}

function validateEvidenceForIntent(
  intent: TaskStateTransitionIntent,
  evidence: unknown,
): Result<TaskStateTransitionEvidence, TaskStateTransitionError> {
  if (intent.kind === "mark_dry_run_ready") {
    if (isDryRunReadyEvidence(evidence)) {
      return ok(evidence);
    }

    return err(
      createError(
        "task_state_transition_dry_run_evidence_invalid",
        "Dry-run-ready transition requires authoritative no-execution, no-write dry-run evidence.",
        "validation",
      ),
    );
  }

  if (intent.kind === "require_verification") {
    if (isVerificationRequiredEvidence(evidence)) {
      return ok(evidence);
    }

    return err(
      createError(
        "task_state_transition_verification_evidence_invalid",
        "Verification-required transition requires authoritative verifier-gate evidence.",
        "validation",
      ),
    );
  }

  if (isBlockedEvidence(evidence)) {
    return ok(evidence);
  }

  return err(
    createError(
      "task_state_transition_blocked_evidence_invalid",
      "Blocked transition requires authoritative blocking issue evidence.",
      "validation",
    ),
  );
}

function evaluateAllowedTransition(
  state: PersistedTaskState,
  intent: TaskStateTransitionIntent,
): Result<PersistedTaskLifecycleState, TaskStateTransitionError> {
  const expectedTarget = transitionTargets[intent.kind];
  const target = allowedTransitions[state.lifecycleState][intent.kind];

  if (state.lifecycleState === expectedTarget) {
    return err(
      createError(
        "task_state_transition_same_state_forbidden",
        "Task state transition is already at the intent target lifecycle state.",
        "validation",
        {
          lifecycleState: state.lifecycleState,
          intent: intent.kind,
        },
      ),
    );
  }

  if (target === undefined) {
    return err(
      createError(
        "task_state_transition_not_allowed",
        "Task state transition is not allowed from the current lifecycle state.",
        "validation",
        {
          from: state.lifecycleState,
          intent: intent.kind,
          target: expectedTarget,
        },
      ),
    );
  }

  return ok(target);
}

export function evaluateTaskStateTransition(
  input: EvaluateTaskStateTransitionInput,
): Result<TaskStateTransitionPlan, TaskStateTransitionError> {
  const stateResult = validatePersistedTaskState(input.state);

  if (!stateResult.ok) {
    return stateResult;
  }

  const intentResult = parseTransitionIntent(input.intent);

  if (!intentResult.ok) {
    return intentResult;
  }

  const evidenceResult = validateEvidenceForIntent(
    intentResult.value,
    input.evidence,
  );

  if (!evidenceResult.ok) {
    return evidenceResult;
  }

  const targetResult = evaluateAllowedTransition(
    stateResult.value,
    intentResult.value,
  );

  if (!targetResult.ok) {
    return targetResult;
  }

  return ok({
    taskId: stateResult.value.taskId,
    intent: intentResult.value.kind,
    from: stateResult.value.lifecycleState,
    to: targetResult.value,
    evidenceKind: evidenceResult.value.kind,
  });
}

export function transitionTaskState(
  input: EvaluateTaskStateTransitionInput,
): Result<TaskStateTransitionUpdate, TaskStateTransitionError> {
  const evaluationResult = evaluateTaskStateTransition(input);

  if (!evaluationResult.ok) {
    return evaluationResult;
  }

  const stateResult = validatePersistedTaskState(input.state);

  if (!stateResult.ok) {
    return stateResult;
  }

  const evidence = input.evidence;
  const baseState = stateResult.value;
  const updatedAt = input.updatedAt ?? baseState.updatedAt;
  const stateWithLifecycle: PersistedTaskState = {
    ...baseState,
    lifecycleState: evaluationResult.value.to,
    verifier:
      evaluationResult.value.intent === "require_verification" &&
      isVerificationRequiredEvidence(evidence)
        ? {
            ...baseState.verifier,
            required: true,
            status: "required_not_run",
            completionGatedByVerifier: true,
            resultReference: evidence.requirementReference,
          }
        : baseState.verifier,
    completionGate:
      evaluationResult.value.intent === "require_verification"
        ? {
            ...baseState.completionGate,
            status: "verification_required",
            satisfied: false,
            completed: false,
            verified: false,
            authority: "system",
          }
        : evaluationResult.value.intent === "mark_blocked"
          ? {
              ...baseState.completionGate,
              status: "blocked",
              satisfied: false,
              completed: false,
              verified: false,
              authority: "system",
            }
          : baseState.completionGate,
    issues:
      evaluationResult.value.intent === "mark_blocked" && isBlockedEvidence(evidence)
        ? [...baseState.issues, ...evidence.issues]
        : baseState.issues,
    updatedAt,
  };

  const updatedStateResult = validatePersistedTaskState(stateWithLifecycle);

  if (!updatedStateResult.ok) {
    return updatedStateResult;
  }

  return ok({
    ...evaluationResult.value,
    state: updatedStateResult.value,
  });
}

export async function transitionPersistedTaskState(
  input: PersistTaskStateTransitionInput,
): Promise<Result<PersistedTaskStateTransitionResult, TaskStateTransitionError>> {
  const currentResult = await loadTaskState({
    projectRoot: input.projectRoot,
    taskId: input.taskId,
  });

  if (!currentResult.ok) {
    return currentResult;
  }

  const currentState = currentResult.value.state;

  if (currentState.revision !== input.expectedRevision) {
    return err(
      createError(
        "task_state_revision_conflict",
        "Persisted task state revision did not match the expected revision.",
        "conflict",
        {
          expectedRevision: input.expectedRevision,
          actualRevision: currentState.revision,
        },
      ),
    );
  }

  const transitionResult = transitionTaskState({
    state: currentState,
    intent: input.intent,
    evidence: input.evidence,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  });

  if (!transitionResult.ok) {
    return transitionResult;
  }

  const nextState: PersistedTaskState = {
    ...transitionResult.value.state,
    revision: currentState.revision + 1,
  };

  const saveResult = await saveTaskState({
    projectRoot: input.projectRoot,
    state: nextState,
    expectedRevision: currentState.revision,
  });

  if (!saveResult.ok) {
    return saveResult;
  }

  return ok({
    ...transitionResult.value,
    state: saveResult.value.state,
    path: saveResult.value.path,
  });
}
