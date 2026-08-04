import type {
  AgenticRunnerDryRunAdapterCallKind,
  AgenticRunnerDryRunAdapterCallPreview,
  AgenticRunnerDryRunAuditEventId,
  AgenticRunnerDryRunAuditPreview,
  AgenticRunnerDryRunAuditStatus,
  AgenticRunnerDryRunBatchId,
  AgenticRunnerDryRunBatchPreview,
  AgenticRunnerDryRunCoverageStatus,
  AgenticRunnerDryRunDataReference,
  AgenticRunnerDryRunInput,
  AgenticRunnerDryRunIssue,
  AgenticRunnerDryRunIssueSeverity,
  AgenticRunnerDryRunJsonObject,
  AgenticRunnerDryRunReference,
  AgenticRunnerDryRunResult,
  AgenticRunnerDryRunResumePreview,
  AgenticRunnerDryRunState,
  AgenticRunnerDryRunStepId,
  AgenticRunnerDryRunStepPreview,
  AgenticRunnerDryRunSummary,
  AgenticRunnerDryRunVerifierPreview,
  AgenticRunnerDryRunVerifierStatus,
  AgenticRunnerDryRunWorkItemId,
  AgenticRunnerDryRunWorkItemPreview,
} from "./agentic-runner-dry-run.js";

type DryRunIssueInput = Omit<AgenticRunnerDryRunIssue, "severity" | "category"> & {
  readonly severity?: AgenticRunnerDryRunIssue["severity"];
  readonly category?: AgenticRunnerDryRunIssue["category"];
};

interface DryRunContext {
  readonly input: AgenticRunnerDryRunInput;
  readonly inputIssues: readonly AgenticRunnerDryRunIssue[];
  readonly approvalRequired: boolean;
  readonly policyBlocked: boolean;
  readonly failedShape: boolean;
}

const ISSUE_SEVERITY_RANK: Record<AgenticRunnerDryRunIssueSeverity, number> = {
  critical: 0,
  error: 1,
  warning: 2,
  info: 3,
};

const FORBIDDEN_COMPLETION_PREVIEW_STATES = new Set<string>([
  "completed",
  "verified",
]);

export function runAgenticRunnerDryRun(
  input: AgenticRunnerDryRunInput,
): AgenticRunnerDryRunResult {
  const inputIssues = createAgenticDryRunInputIssues(input);
  const approvalRequired = hasApprovalRequired(input);
  const policyBlocked = hasPolicyBlocked(input);
  const failedShape = inputIssues.some(isFailedShapeIssue);
  const context: DryRunContext = {
    input,
    inputIssues,
    approvalRequired,
    policyBlocked,
    failedShape,
  };
  const steps = createAgenticDryRunStepPreviews(context);
  const batches = createAgenticDryRunBatchPreviews(context);
  const workItems = createAgenticDryRunWorkItemPreviews(context);
  const adapterCalls = createAgenticDryRunAdapterCallPreviews(context);
  const audit = createAgenticDryRunAuditPreview(context, steps, adapterCalls);
  const verifier = createAgenticDryRunVerifierPreview(context);
  const resume = createAgenticDryRunResumePreview(context, steps, batches, workItems);
  const issues = sortIssues([
    ...inputIssues,
    ...steps.flatMap((step) => step.issues),
    ...batches.flatMap((batch) => batch.issues),
    ...workItems.flatMap((workItem) => workItem.issues),
    ...adapterCalls.flatMap((adapterCall) => adapterCall.issues),
    ...audit.issues,
    ...verifier.issues,
    ...(resume?.issues ?? []),
  ]);
  const resultWithoutSummary = {
    ok: issues.every(
      (issue) => issue.severity !== "error" && issue.severity !== "critical",
    ),
    taskId: input.taskId,
    mode: "dry_run" as const,
    state: determineDryRunState(context, issues, verifier),
    plan: input.runnerPlan,
    planningResult: input.planningResult,
    lifecycle: input.lifecycle,
    steps,
    batches,
    workItems,
    adapterCalls,
    audit,
    verifier,
    resume,
    issues,
  };

  return {
    ...resultWithoutSummary,
    summary: summarizeAgenticRunnerDryRunResult(resultWithoutSummary),
  };
}

export function createAgenticDryRunStepPreviews(
  inputOrContext: AgenticRunnerDryRunInput | DryRunContext,
): readonly AgenticRunnerDryRunStepPreview[] {
  const context = asDryRunContext(inputOrContext);
  const stepIdCounts = countBy(context.input.plannedSteps.map((step) => step.stepId));
  const adapterCallIds = new Set(
    context.input.adapterCalls?.map((adapterCall) => adapterCall.callId) ?? [],
  );

  return context.input.plannedSteps
    .map((step, index) => {
      const issues = sortIssues([
        ...step.issues,
        ...createStepIdentityIssues(step, stepIdCounts.get(step.stepId) ?? 0, index),
        ...createForbiddenPreviewStateIssues(
          step.previewState,
          "DRY_RUN_STEP_COMPLETION_STATE_FORBIDDEN",
          `Step '${step.stepId}' cannot preview completed or verified execution during dry-run.`,
          {
            category: "dry_run_safety",
            stepId: step.stepId,
          },
        ),
        ...step.plannedAdapterCallIds
          .filter((adapterCallId) => !adapterCallIds.has(adapterCallId))
          .map((adapterCallId) =>
            createIssue({
              code: "STEP_REFERENCES_MISSING_ADAPTER_CALL",
              message: `Step '${step.stepId}' references missing adapter call '${adapterCallId}'.`,
              severity: "error",
              category: "adapter_failure",
              stepId: step.stepId,
              adapterCallId,
              retryable: true,
            }),
          ),
      ]);
      const previewState = blockedPreviewState(context, step.previewState);

      return {
        ...step,
        previewState,
        wouldRun:
          step.wouldRun &&
          previewState === "preview_ready" &&
          !hasErrorsOrCriticalIssues(issues),
        approvalRequired: step.approvalRequired ?? context.approvalRequired,
        plannedAdapterCallIds: stableUnique(step.plannedAdapterCallIds),
        expectedAuditEventIds: stableUnique(step.expectedAuditEventIds),
        issues,
      };
    })
    .sort(compareStepPreview);
}

export function createAgenticDryRunBatchPreviews(
  inputOrContext: AgenticRunnerDryRunInput | DryRunContext,
): readonly AgenticRunnerDryRunBatchPreview[] {
  const context = asDryRunContext(inputOrContext);
  const batchIdCounts = countBy(
    context.input.plannedBatches.map((batch) => batch.batchId),
  );
  const workItemIds = new Set(
    context.input.plannedWorkItems.map((workItem) => workItem.workItemId),
  );
  const assignedWorkItemIds = new Map<
    AgenticRunnerDryRunWorkItemId,
    AgenticRunnerDryRunBatchId
  >();

  return context.input.plannedBatches
    .map((batch, index) => {
      const uniqueWorkItemIds = stableUnique(batch.workItemIds);
      const localCounts = countBy(batch.workItemIds);
      const membershipIssues = uniqueWorkItemIds.flatMap((workItemId) => {
        const issues: AgenticRunnerDryRunIssue[] = [];
        if (workItemId.length === 0) {
          issues.push(
            createIssue({
              code: "BATCH_WORK_ITEM_ID_MISSING",
              message: `Batch '${batch.batchId}' contains a missing work item id.`,
              severity: "error",
              category: "inventory_failure",
              batchId: batch.batchId,
            }),
          );
        }
        if ((localCounts.get(workItemId) ?? 0) > 1) {
          issues.push(
            createIssue({
              code: "DUPLICATE_WORK_ITEM_IN_BATCH",
              message: `Work item '${workItemId}' is duplicated inside batch '${batch.batchId}'.`,
              severity: "error",
              category: "inventory_failure",
              batchId: batch.batchId,
              workItemId,
            }),
          );
        }
        if (!workItemIds.has(workItemId)) {
          issues.push(
            createIssue({
              code: "BATCH_REFERENCES_MISSING_WORK_ITEM",
              message: `Batch '${batch.batchId}' references missing work item '${workItemId}'.`,
              severity: "error",
              category: "inventory_failure",
              batchId: batch.batchId,
              workItemId,
              retryable: true,
            }),
          );
        }
        const priorBatchId = assignedWorkItemIds.get(workItemId);
        if (priorBatchId !== undefined) {
          issues.push(
            createIssue({
              code: "WORK_ITEM_IN_MULTIPLE_BATCHES",
              message: `Work item '${workItemId}' appears in both '${priorBatchId}' and '${batch.batchId}'.`,
              severity: "error",
              category: "inventory_failure",
              batchId: batch.batchId,
              workItemId,
            }),
          );
        } else {
          assignedWorkItemIds.set(workItemId, batch.batchId);
        }
        return issues;
      });
      const issues = sortIssues([
        ...batch.issues,
        ...createBatchIdentityIssues(batch, batchIdCounts.get(batch.batchId) ?? 0, index),
        ...createBatchAccountingIssues(batch),
        ...createForbiddenPreviewStateIssues(
          batch.previewState,
          "DRY_RUN_BATCH_COMPLETION_STATE_FORBIDDEN",
          `Batch '${batch.batchId}' cannot preview completed or verified execution during dry-run.`,
          {
            category: "dry_run_safety",
            batchId: batch.batchId,
          },
        ),
        ...membershipIssues,
      ]);
      const previewState = blockedPreviewState(context, batch.previewState);

      return {
        ...batch,
        workItemIds: uniqueWorkItemIds,
        previewState,
        wouldRun:
          batch.wouldRun &&
          previewState === "preview_ready" &&
          !hasErrorsOrCriticalIssues(issues),
        issues,
      };
    })
    .sort(compareBatchPreview);
}

export function createAgenticDryRunWorkItemPreviews(
  inputOrContext: AgenticRunnerDryRunInput | DryRunContext,
): readonly AgenticRunnerDryRunWorkItemPreview[] {
  const context = asDryRunContext(inputOrContext);
  const workItemIdCounts = countBy(
    context.input.plannedWorkItems.map((workItem) => workItem.workItemId),
  );

  return context.input.plannedWorkItems
    .map((workItem, index) => {
      const issues = sortIssues([
        ...workItem.issues,
        ...createWorkItemIdentityIssues(
          workItem,
          workItemIdCounts.get(workItem.workItemId) ?? 0,
          index,
        ),
        ...createForbiddenPreviewStateIssues(
          workItem.previewState,
          "DRY_RUN_WORK_ITEM_COMPLETION_STATE_FORBIDDEN",
          `Work item '${workItem.workItemId}' cannot preview completed or verified work during dry-run.`,
          {
            category: "dry_run_safety",
            workItemId: workItem.workItemId,
          },
        ),
      ]);
      const previewState = blockedPreviewState(context, workItem.previewState);

      return {
        ...workItem,
        previewState,
        expectedArtifactIds:
          workItem.expectedArtifactIds === undefined
            ? undefined
            : stableUnique(workItem.expectedArtifactIds),
        wouldProcess:
          workItem.wouldProcess &&
          previewState === "preview_ready" &&
          !hasErrorsOrCriticalIssues(issues),
        issues,
      };
    })
    .sort(compareWorkItemPreview);
}

export function createAgenticDryRunAdapterCallPreviews(
  inputOrContext: AgenticRunnerDryRunInput | DryRunContext,
): readonly AgenticRunnerDryRunAdapterCallPreview[] {
  const context = asDryRunContext(inputOrContext);
  const adapterCallIdCounts = countBy(
    context.input.adapterCalls?.map((adapterCall) => adapterCall.callId) ?? [],
  );

  return (context.input.adapterCalls ?? [])
    .map((adapterCall, index) => {
      const issues = sortIssues([
        ...adapterCall.issues,
        ...createAdapterCallIdentityIssues(
          adapterCall,
          adapterCallIdCounts.get(adapterCall.callId) ?? 0,
          index,
        ),
        ...(adapterCall.wouldCall
          ? [
              createIssue({
                code: "DRY_RUN_ADAPTER_WOULD_CALL",
                message: `Adapter call '${adapterCall.callId}' cannot call an adapter during dry-run.`,
                severity: "error",
                category: "dry_run_safety",
                adapterCallId: adapterCall.callId,
                adapterId: adapterCall.adapterId,
              }),
            ]
          : []),
      ]);

      return {
        ...adapterCall,
        kind: normalizeAdapterKind(adapterCall.kind),
        wouldCall: false,
        approvalRequired:
          adapterCall.approvalRequired || context.approvalRequired,
        outputReference: adapterCall.outputReference ?? null,
        issues,
        observationOnly: true as const,
        completionAuthority: false as const,
      };
    })
    .sort(compareAdapterCallPreview);
}

export function createAgenticDryRunAuditPreview(
  inputOrContext: AgenticRunnerDryRunInput | DryRunContext,
  steps = createAgenticDryRunStepPreviews(inputOrContext),
  adapterCalls = createAgenticDryRunAdapterCallPreviews(inputOrContext),
): AgenticRunnerDryRunAuditPreview {
  const context = asDryRunContext(inputOrContext);
  const inputData = getReferencedData(context.input.auditPreviewInput);
  const expectedAuditEventIds = stableUnique([
    ...stringArrayFromRecord(inputData, "expectedAuditEventIds"),
    ...steps.flatMap((step) => step.expectedAuditEventIds),
  ]);
  const emittedAuditEventIds = stableUnique(
    stringArrayFromRecord(inputData, "emittedAuditEventIds"),
  );
  const explicitlyMissingAuditEventIds = stableUnique(
    stringArrayFromRecord(inputData, "missingAuditEventIds"),
  );
  const missingAuditEventIds =
    explicitlyMissingAuditEventIds.length > 0
      ? explicitlyMissingAuditEventIds
      : expectedAuditEventIds.filter(
          (auditEventId) => !emittedAuditEventIds.includes(auditEventId),
        );
  const wouldWriteAudit = booleanFromRecord(inputData, "wouldWriteAudit");
  const inputStatus = auditStatusFromValue(inputData?.auditStatus);
  const auditStatus =
    inputStatus ??
    inferAuditStatus(
      context.input.options?.requireAudit === true,
      expectedAuditEventIds,
      emittedAuditEventIds,
      missingAuditEventIds,
    );
  const issues = sortIssues([
    ...issuesFromRecord(inputData),
    ...adapterCalls.flatMap((adapterCall) =>
      adapterCall.issues.filter((issue) => issue.category === "audit_failure"),
    ),
    ...(wouldWriteAudit
      ? [
          createIssue({
            code: "DRY_RUN_AUDIT_WOULD_WRITE",
            message: "Dry-run audit preview cannot write audit events.",
            severity: "error",
            category: "dry_run_safety",
            retryable: true,
          }),
        ]
      : []),
  ]);

  return {
    expectedAuditEventIds,
    emittedAuditEventIds,
    missingAuditEventIds,
    wouldWriteAudit: false,
    auditStatus,
    auditReference:
      referenceFromRecord(inputData, "auditReference") ??
      context.input.auditPreviewInput?.reference,
    issues,
    metadata: objectFromRecord(inputData, "metadata"),
  };
}

export function createAgenticDryRunVerifierPreview(
  inputOrContext: AgenticRunnerDryRunInput | DryRunContext,
): AgenticRunnerDryRunVerifierPreview {
  const context = asDryRunContext(inputOrContext);
  const inputData = getReferencedData(context.input.verifierPreviewInput);
  const verifierRequired =
    (booleanFromRecord(inputData, "verifierRequired") ??
      context.input.options?.requireVerifier === true) ||
    context.input.options?.completionGatedByVerifier === true ||
    context.input.plannedSteps.some((step) => step.verifierRequired);
  const completionGatedByVerifier =
    (booleanFromRecord(inputData, "completionGatedByVerifier") ??
      context.input.options?.completionGatedByVerifier === true) ||
    verifierRequired;
  const wouldRunVerifier = booleanFromRecord(inputData, "wouldRunVerifier");
  const inputStatus = verifierStatusFromValue(inputData?.verifierStatus);
  const verifierStatus =
    verifierRequired && inputStatus !== "not_required"
      ? inputStatus ?? (context.policyBlocked ? "blocked" : "required_not_run")
      : "not_required";
  const coverageStatus =
    coverageStatusFromValue(inputData?.coverageStatus) ??
    (context.policyBlocked ? "blocked" : verifierRequired ? "incomplete" : "unknown");
  const issues = sortIssues([
    ...issuesFromRecord(inputData),
    ...(wouldRunVerifier
      ? [
          createIssue({
            code: "DRY_RUN_VERIFIER_WOULD_RUN",
            message: "Dry-run verifier preview cannot run verifier logic.",
            severity: "error",
            category: "dry_run_safety",
            retryable: true,
          }),
        ]
      : []),
    ...(inputStatus === "unknown" && inputData?.verifierStatus === "verified"
      ? [
          createIssue({
            code: "DRY_RUN_VERIFIER_VERIFIED_FORBIDDEN",
            message: "Dry-run verifier preview cannot mark verification as verified.",
            severity: "error",
            category: "dry_run_safety",
          }),
        ]
      : []),
    ...(verifierRequired && !completionGatedByVerifier
      ? [
          createIssue({
            code: "VERIFIER_COMPLETION_GATE_FALSE",
            message: "Dry-run executable previews must keep completion gated by verifier.",
            severity: "error",
            category: "verification_failure",
            retryable: true,
          }),
        ]
      : []),
  ]);

  return {
    verifierRequired,
    wouldRunVerifier: false,
    verifierStatus:
      verifierStatus === "unknown" && verifierRequired
        ? "required_not_run"
        : verifierStatus,
    coverageStatus,
    verifierResultReference:
      referenceFromRecord(inputData, "verifierResultReference") ?? null,
    completionGatedByVerifier,
    completionGateSatisfied: false,
    issues,
    metadata: objectFromRecord(inputData, "metadata"),
  };
}

export function createAgenticDryRunResumePreview(
  inputOrContext: AgenticRunnerDryRunInput | DryRunContext,
  steps = createAgenticDryRunStepPreviews(inputOrContext),
  batches = createAgenticDryRunBatchPreviews(inputOrContext),
  workItems = createAgenticDryRunWorkItemPreviews(inputOrContext),
): AgenticRunnerDryRunResumePreview | undefined {
  const context = asDryRunContext(inputOrContext);
  const inputData = getReferencedData(context.input.resumePreviewInput);
  const pendingFromInput = stringArrayFromRecord(inputData, "pendingWorkItemIds");
  const retryableFromInput = stringArrayFromRecord(inputData, "retryableWorkItemIds");
  const pendingWorkItemIds = stableUnique(
    pendingFromInput.length > 0
      ? pendingFromInput
      : workItems
          .filter(
            (workItem) =>
              workItem.previewState !== "blocked" &&
              workItem.previewState !== "failed",
          )
          .map((workItem) => workItem.workItemId),
  );
  const retryableWorkItemIds = stableUnique(retryableFromInput);
  const wouldUpdateResume = booleanFromRecord(inputData, "wouldUpdateResume");
  const issues = sortIssues([
    ...issuesFromRecord(inputData),
    ...(wouldUpdateResume
      ? [
          createIssue({
            code: "DRY_RUN_RESUME_WOULD_UPDATE",
            message: "Dry-run resume preview cannot mutate resume state.",
            severity: "error",
            category: "dry_run_safety",
            retryable: true,
          }),
        ]
      : []),
  ]);

  if (
    context.input.resumePreviewInput === undefined &&
    pendingWorkItemIds.length === 0 &&
    retryableWorkItemIds.length === 0 &&
    steps.length === 0 &&
    batches.length === 0
  ) {
    return undefined;
  }

  return {
    wouldUpdateResume: false,
    nextStepId:
      stringFromRecord(inputData, "nextStepId") ??
      steps.find((step) => step.previewState === "preview_ready")?.stepId ??
      steps[0]?.stepId,
    nextBatchId:
      stringFromRecord(inputData, "nextBatchId") ??
      batches.find((batch) => batch.previewState === "preview_ready")?.batchId ??
      batches[0]?.batchId,
    pendingWorkItemIds,
    retryableWorkItemIds,
    updatedAt: stringFromRecord(inputData, "updatedAt"),
    issues,
    metadata: objectFromRecord(inputData, "metadata"),
  };
}

export function summarizeAgenticRunnerDryRunResult(
  result: Omit<AgenticRunnerDryRunResult, "summary">,
): AgenticRunnerDryRunSummary {
  return {
    plannedSteps: result.steps.length,
    runnableSteps: result.steps.filter((step) => step.wouldRun).length,
    blockedSteps: result.steps.filter((step) => step.previewState === "blocked")
      .length,
    plannedBatches: result.batches.length,
    runnableBatches: result.batches.filter((batch) => batch.wouldRun).length,
    plannedWorkItems: result.workItems.length,
    processableWorkItems: result.workItems.filter((workItem) => workItem.wouldProcess)
      .length,
    plannedAdapterCalls: result.adapterCalls.length,
    wouldCallAdapters: result.adapterCalls.filter((adapterCall) => adapterCall.wouldCall)
      .length,
    expectedAuditEvents: result.audit.expectedAuditEventIds.length,
    wouldWriteAudit: false,
    verifierRequired: result.verifier.verifierRequired,
    wouldRunVerifier: false,
    issueCount: result.issues.length,
  };
}

function createAgenticDryRunInputIssues(
  input: AgenticRunnerDryRunInput,
): readonly AgenticRunnerDryRunIssue[] {
  const issues: AgenticRunnerDryRunIssue[] = [];

  if (input.mode !== "dry_run") {
    issues.push(
      createIssue({
        code: "DRY_RUN_MODE_INVALID",
        message: "Agentic runner dry-run input must use mode 'dry_run'.",
        severity: "error",
        category: "dry_run_safety",
      }),
    );
  }

  if (input.taskId.length === 0) {
    issues.push(
      createIssue({
        code: "TASK_ID_MISSING",
        message: "Agentic runner dry-run input requires a non-empty task id.",
        severity: "error",
        category: "scope_failure",
      }),
    );
  }

  if (input.runnerPlan === undefined && input.planningResult === undefined) {
    issues.push(
      createIssue({
        code: "RUNNER_PLAN_MISSING",
        message: "Dry-run execution requires a runner plan or planning result reference.",
        severity: "error",
        category: "scope_failure",
        retryable: true,
      }),
    );
  }

  if (
    input.options?.maxWorkItems !== undefined &&
    input.plannedWorkItems.length > input.options.maxWorkItems
  ) {
    issues.push(
      createIssue({
        code: "MAX_WORK_ITEMS_EXCEEDED",
        message: "Planned work item count exceeds the dry-run maxWorkItems option.",
        severity: "error",
        category: "inventory_failure",
        retryable: true,
      }),
    );
  }

  if (
    input.options?.maxBatchSize !== undefined &&
    input.plannedBatches.some(
      (batch) => batch.expectedItemCount > (input.options?.maxBatchSize ?? 0),
    )
  ) {
    issues.push(
      createIssue({
        code: "MAX_BATCH_SIZE_EXCEEDED",
        message: "At least one planned batch exceeds the dry-run maxBatchSize option.",
        severity: "error",
        category: "inventory_failure",
        retryable: true,
      }),
    );
  }

  return sortIssues(issues);
}

function createStepIdentityIssues(
  step: AgenticRunnerDryRunStepPreview,
  idCount: number,
  index: number,
): readonly AgenticRunnerDryRunIssue[] {
  const issues: AgenticRunnerDryRunIssue[] = [];
  if (step.stepId.length === 0) {
    issues.push(
      createIssue({
        code: "STEP_ID_MISSING",
        message: `Step at deterministic index ${index} is missing a stable id.`,
        severity: "error",
        category: "execution_failure",
      }),
    );
  }
  if (idCount > 1) {
    issues.push(
      createIssue({
        code: "DUPLICATE_STEP_ID",
        message: `Step id '${step.stepId}' is duplicated.`,
        severity: "error",
        category: "execution_failure",
        stepId: step.stepId,
      }),
    );
  }
  return issues;
}

function createBatchIdentityIssues(
  batch: AgenticRunnerDryRunBatchPreview,
  idCount: number,
  index: number,
): readonly AgenticRunnerDryRunIssue[] {
  const issues: AgenticRunnerDryRunIssue[] = [];
  if (batch.batchId.length === 0) {
    issues.push(
      createIssue({
        code: "BATCH_ID_MISSING",
        message: `Batch at deterministic index ${index} is missing a stable id.`,
        severity: "error",
        category: "inventory_failure",
      }),
    );
  }
  if (idCount > 1) {
    issues.push(
      createIssue({
        code: "DUPLICATE_BATCH_ID",
        message: `Batch id '${batch.batchId}' is duplicated.`,
        severity: "error",
        category: "inventory_failure",
        batchId: batch.batchId,
      }),
    );
  }
  return issues;
}

function createBatchAccountingIssues(
  batch: AgenticRunnerDryRunBatchPreview,
): readonly AgenticRunnerDryRunIssue[] {
  if (batch.expectedItemCount === batch.workItemIds.length) {
    return [];
  }
  return [
    createIssue({
      code: "BATCH_EXPECTED_COUNT_MISMATCH",
      message: `Batch '${batch.batchId}' expected count does not match represented work item ids.`,
      severity: "error",
      category: "inventory_failure",
      batchId: batch.batchId,
    }),
  ];
}

function createWorkItemIdentityIssues(
  workItem: AgenticRunnerDryRunWorkItemPreview,
  idCount: number,
  index: number,
): readonly AgenticRunnerDryRunIssue[] {
  const issues: AgenticRunnerDryRunIssue[] = [];
  if (workItem.workItemId.length === 0) {
    issues.push(
      createIssue({
        code: "WORK_ITEM_ID_MISSING",
        message: `Work item at deterministic index ${index} is missing a stable id.`,
        severity: "error",
        category: "inventory_failure",
      }),
    );
  }
  if (idCount > 1) {
    issues.push(
      createIssue({
        code: "DUPLICATE_WORK_ITEM_ID",
        message: `Work item id '${workItem.workItemId}' is duplicated.`,
        severity: "error",
        category: "inventory_failure",
        workItemId: workItem.workItemId,
      }),
    );
  }
  return issues;
}

function createAdapterCallIdentityIssues(
  adapterCall: AgenticRunnerDryRunAdapterCallPreview,
  idCount: number,
  index: number,
): readonly AgenticRunnerDryRunIssue[] {
  const issues: AgenticRunnerDryRunIssue[] = [];
  if (adapterCall.callId.length === 0) {
    issues.push(
      createIssue({
        code: "ADAPTER_CALL_ID_MISSING",
        message: `Adapter call at deterministic index ${index} is missing a stable id.`,
        severity: "error",
        category: "adapter_failure",
      }),
    );
  }
  if (idCount > 1) {
    issues.push(
      createIssue({
        code: "DUPLICATE_ADAPTER_CALL_ID",
        message: `Adapter call id '${adapterCall.callId}' is duplicated.`,
        severity: "error",
        category: "adapter_failure",
        adapterCallId: adapterCall.callId,
      }),
    );
  }
  return issues;
}

function hasApprovalRequired(input: AgenticRunnerDryRunInput): boolean {
  const policyData = getReferencedData(input.policyPreview);
  const boundaryData = getReferencedData(input.adapterBoundaryPreview);
  return (
    input.options?.requireApproval === true ||
    input.plannedSteps.some((step) => step.approvalRequired === true) ||
    (input.adapterCalls ?? []).some((adapterCall) => adapterCall.approvalRequired) ||
    booleanFromRecord(policyData, "approvalRequired") === true ||
    booleanFromRecord(boundaryData, "approvalRequired") === true ||
    stringFromRecord(policyData, "status") === "requires_approval"
  );
}

function hasPolicyBlocked(input: AgenticRunnerDryRunInput): boolean {
  const policyData = getReferencedData(input.policyPreview);
  const boundaryData = getReferencedData(input.adapterBoundaryPreview);
  return (
    stringFromRecord(policyData, "status") === "denied" ||
    stringFromRecord(policyData, "status") === "blocked" ||
    stringFromRecord(policyData, "decision") === "denied" ||
    stringArrayFromRecord(boundaryData, "deniedOperations").length > 0 ||
    input.plannedSteps.some((step) => step.previewState === "blocked") ||
    input.plannedBatches.some((batch) => batch.previewState === "blocked") ||
    input.plannedWorkItems.some((workItem) => workItem.previewState === "blocked") ||
    (input.adapterCalls ?? []).some((adapterCall) => adapterCall.deniedReason !== undefined)
  );
}

function determineDryRunState(
  context: DryRunContext,
  issues: readonly AgenticRunnerDryRunIssue[],
  verifier: AgenticRunnerDryRunVerifierPreview,
): AgenticRunnerDryRunState {
  if (issues.some(isFailedShapeIssue)) {
    return "failed";
  }
  if (context.approvalRequired) {
    return "waiting_for_approval";
  }
  if (
    context.policyBlocked ||
    issues.some(
      (issue) =>
        (issue.severity === "error" || issue.severity === "critical") &&
        issue.retryable === true,
    )
  ) {
    return "blocked";
  }
  if (verifier.verifierRequired) {
    return "verification_required";
  }
  return "preview_ready";
}

function isFailedShapeIssue(issue: AgenticRunnerDryRunIssue): boolean {
  if (!isErrorOrCriticalIssue(issue)) {
    return false;
  }
  if (issue.retryable === true) {
    return false;
  }
  return (
    issue.category === "dry_run_safety" ||
    issue.code === "TASK_ID_MISSING" ||
    issue.code === "DRY_RUN_MODE_INVALID" ||
    issue.code === "STEP_ID_MISSING" ||
    issue.code === "DUPLICATE_STEP_ID" ||
    issue.code === "BATCH_ID_MISSING" ||
    issue.code === "DUPLICATE_BATCH_ID" ||
    issue.code === "BATCH_EXPECTED_COUNT_MISMATCH" ||
    issue.code === "BATCH_WORK_ITEM_ID_MISSING" ||
    issue.code === "DUPLICATE_WORK_ITEM_IN_BATCH" ||
    issue.code === "WORK_ITEM_IN_MULTIPLE_BATCHES" ||
    issue.code === "WORK_ITEM_ID_MISSING" ||
    issue.code === "DUPLICATE_WORK_ITEM_ID" ||
    issue.code === "ADAPTER_CALL_ID_MISSING" ||
    issue.code === "DUPLICATE_ADAPTER_CALL_ID" ||
    issue.code === "VERIFIER_COMPLETION_GATE_FALSE"
  );
}

function hasErrorsOrCriticalIssues(
  issues: readonly AgenticRunnerDryRunIssue[],
): boolean {
  return issues.some(isErrorOrCriticalIssue);
}

function isErrorOrCriticalIssue(issue: AgenticRunnerDryRunIssue): boolean {
  return issue.severity === "error" || issue.severity === "critical";
}

function blockedPreviewState(
  context: DryRunContext,
  fallback: AgenticRunnerDryRunState,
): AgenticRunnerDryRunState {
  if (FORBIDDEN_COMPLETION_PREVIEW_STATES.has(String(fallback))) {
    return "failed";
  }
  if (context.failedShape) {
    return "failed";
  }
  if (context.approvalRequired) {
    return "waiting_for_approval";
  }
  if (context.policyBlocked) {
    return "blocked";
  }
  return fallback === "unknown" || fallback === "not_started" || fallback === "preflight"
    ? "preview_ready"
    : fallback;
}

function createForbiddenPreviewStateIssues(
  previewState: AgenticRunnerDryRunState,
  code: string,
  message: string,
  issue: Pick<
    AgenticRunnerDryRunIssue,
    "category" | "stepId" | "batchId" | "workItemId"
  >,
): readonly AgenticRunnerDryRunIssue[] {
  if (!FORBIDDEN_COMPLETION_PREVIEW_STATES.has(String(previewState))) {
    return [];
  }

  return [
    createIssue({
      code,
      message,
      severity: "error",
      category: issue.category,
      stepId: issue.stepId,
      batchId: issue.batchId,
      workItemId: issue.workItemId,
    }),
  ];
}

function inferAuditStatus(
  auditRequired: boolean,
  expectedAuditEventIds: readonly string[],
  emittedAuditEventIds: readonly string[],
  missingAuditEventIds: readonly string[],
): AgenticRunnerDryRunAuditStatus {
  if (!auditRequired && expectedAuditEventIds.length === 0) {
    return "not_required";
  }
  if (expectedAuditEventIds.length === 0) {
    return "missing";
  }
  if (emittedAuditEventIds.length > 0 && missingAuditEventIds.length === 0) {
    return "complete_from_input";
  }
  if (emittedAuditEventIds.length > 0) {
    return "partial";
  }
  return "missing";
}

function normalizeAdapterKind(
  kind: AgenticRunnerDryRunAdapterCallKind,
): AgenticRunnerDryRunAdapterCallKind {
  return kind === "model" || kind === "tool" ? kind : "unknown";
}

function asDryRunContext(
  inputOrContext: AgenticRunnerDryRunInput | DryRunContext,
): DryRunContext {
  if ("input" in inputOrContext) {
    return inputOrContext;
  }
  const inputIssues = createAgenticDryRunInputIssues(inputOrContext);
  const approvalRequired = hasApprovalRequired(inputOrContext);
  const policyBlocked = hasPolicyBlocked(inputOrContext);
  return {
    input: inputOrContext,
    inputIssues,
    approvalRequired,
    policyBlocked,
    failedShape: inputIssues.some(isFailedShapeIssue),
  };
}

function getReferencedData(
  reference: AgenticRunnerDryRunDataReference | undefined,
): AgenticRunnerDryRunJsonObject | undefined {
  return reference?.kind === "data" ? reference.data : undefined;
}

function createIssue(issue: DryRunIssueInput): AgenticRunnerDryRunIssue {
  return {
    ...issue,
    severity: issue.severity ?? "error",
    category: issue.category ?? "unknown",
  };
}

function stableUnique<TValue extends string>(
  values: readonly TValue[],
): readonly TValue[] {
  return [...new Set(values)].sort(compareString);
}

function countBy(values: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function stringArrayFromRecord(
  record: Readonly<Record<string, unknown>> | undefined,
  key: string,
): readonly string[] {
  const value = record?.[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

function stringFromRecord(
  record: Readonly<Record<string, unknown>> | undefined,
  key: string,
): string | undefined {
  const value = record?.[key];
  return typeof value === "string" ? value : undefined;
}

function booleanFromRecord(
  record: Readonly<Record<string, unknown>> | undefined,
  key: string,
): boolean | undefined {
  const value = record?.[key];
  return typeof value === "boolean" ? value : undefined;
}

function objectFromRecord(
  record: Readonly<Record<string, unknown>> | undefined,
  key: string,
): AgenticRunnerDryRunJsonObject | undefined {
  const value = record?.[key];
  return isJsonObject(value) ? value : undefined;
}

function referenceFromRecord(
  record: Readonly<Record<string, unknown>> | undefined,
  key: string,
): AgenticRunnerDryRunReference | undefined {
  const value = record?.[key];
  if (!isJsonObject(value) || typeof value.id !== "string") {
    return undefined;
  }
  return {
    id: value.id,
    path: typeof value.path === "string" ? value.path : undefined,
    url: typeof value.url === "string" ? value.url : undefined,
    version: typeof value.version === "string" ? value.version : undefined,
    metadata: objectFromRecord(value, "metadata"),
  };
}

function issuesFromRecord(
  record: Readonly<Record<string, unknown>> | undefined,
): readonly AgenticRunnerDryRunIssue[] {
  const issues = record?.issues;
  if (!Array.isArray(issues)) {
    return [];
  }
  return issues.filter(isDryRunIssue).map(createIssue);
}

function auditStatusFromValue(
  value: unknown,
): AgenticRunnerDryRunAuditStatus | undefined {
  return value === "not_required" ||
    value === "pending" ||
    value === "partial" ||
    value === "complete_from_input" ||
    value === "missing" ||
    value === "failed" ||
    value === "unknown"
    ? value
    : undefined;
}

function verifierStatusFromValue(
  value: unknown,
): AgenticRunnerDryRunVerifierStatus | undefined {
  return value === "not_required" ||
    value === "required_not_run" ||
    value === "blocked" ||
    value === "failed" ||
    value === "unknown"
    ? value
    : undefined;
}

function coverageStatusFromValue(
  value: unknown,
): AgenticRunnerDryRunCoverageStatus | undefined {
  return value === "incomplete" ||
    value === "failed" ||
    value === "blocked" ||
    value === "unknown"
    ? value
    : undefined;
}

function isDryRunIssue(value: unknown): value is AgenticRunnerDryRunIssue {
  return (
    isJsonObject(value) &&
    typeof value.code === "string" &&
    typeof value.message === "string"
  );
}

function isJsonObject(value: unknown): value is AgenticRunnerDryRunJsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compareStepPreview(
  left: AgenticRunnerDryRunStepPreview,
  right: AgenticRunnerDryRunStepPreview,
): number {
  return compareNumber(orderFromMetadata(left.metadata), orderFromMetadata(right.metadata)) ||
    compareString(left.stepId, right.stepId);
}

function compareBatchPreview(
  left: AgenticRunnerDryRunBatchPreview,
  right: AgenticRunnerDryRunBatchPreview,
): number {
  return compareString(left.batchId, right.batchId);
}

function compareWorkItemPreview(
  left: AgenticRunnerDryRunWorkItemPreview,
  right: AgenticRunnerDryRunWorkItemPreview,
): number {
  return (
    compareString(left.batchId ?? "", right.batchId ?? "") ||
    compareString(left.workItemId, right.workItemId)
  );
}

function compareAdapterCallPreview(
  left: AgenticRunnerDryRunAdapterCallPreview,
  right: AgenticRunnerDryRunAdapterCallPreview,
): number {
  return (
    compareString(left.kind, right.kind) ||
    compareString(left.adapterId, right.adapterId) ||
    compareString(left.operation, right.operation) ||
    compareString(left.callId, right.callId)
  );
}

function sortIssues(
  issues: readonly AgenticRunnerDryRunIssue[],
): readonly AgenticRunnerDryRunIssue[] {
  const sorted = [...issues].sort((left, right) => {
    return (
      compareNumber(
        ISSUE_SEVERITY_RANK[left.severity],
        ISSUE_SEVERITY_RANK[right.severity],
      ) ||
      compareString(left.category, right.category) ||
      compareString(left.code, right.code) ||
      compareString(left.stepId ?? "", right.stepId ?? "") ||
      compareString(left.batchId ?? "", right.batchId ?? "") ||
      compareString(left.workItemId ?? "", right.workItemId ?? "") ||
      compareString(left.adapterCallId ?? "", right.adapterCallId ?? "") ||
      compareString(left.adapterId ?? "", right.adapterId ?? "") ||
      compareString(left.message, right.message)
    );
  });
  const seen = new Set<string>();
  return sorted.filter((issue) => {
    const key = issueSortKey(issue);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function issueSortKey(issue: AgenticRunnerDryRunIssue): string {
  return [
    issue.severity,
    issue.category,
    issue.code,
    issue.stepId ?? "",
    issue.batchId ?? "",
    issue.workItemId ?? "",
    issue.adapterCallId ?? "",
    issue.adapterId ?? "",
    issue.message,
  ].join("|");
}

function orderFromMetadata(metadata: AgenticRunnerDryRunJsonObject | undefined): number {
  const order = metadata?.order;
  return typeof order === "number" && Number.isFinite(order)
    ? order
    : Number.MAX_SAFE_INTEGER;
}

function compareString(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareNumber(left: number, right: number): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
