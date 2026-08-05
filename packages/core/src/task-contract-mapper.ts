import type {
  AgenticRunnerAdapterBoundaryPlan,
  AgenticRunnerAuditExpectationPlan,
  AgenticRunnerPlanningInput,
  AgenticRunnerPlanningMode,
  AgenticRunnerPlanningReference,
  AgenticRunnerPolicyPlan,
  AgenticRunnerResumePlan,
  AgenticRunnerVerifierRequirementPlan,
} from "./agentic-runner-planning.js";
import type { AgenticRunnerAdapterReference } from "./agentic-runner.js";
import type {
  AeosTask,
  AeosTaskId,
  TaskValidationIssue,
} from "./tasks.js";
import type {
  TaskContractAdapterBoundaryMapping,
  TaskContractAuditExpectationMapping,
  TaskContractBatchMapping,
  TaskContractMappingInput,
  TaskContractMappingIssue,
  TaskContractMappingOptions,
  TaskContractMappingResult,
  TaskContractMappingStatus,
  TaskContractMappingSummary,
  TaskContractPlanningInputHandoff,
  TaskContractPolicyMapping,
  TaskContractResumeMapping,
  TaskContractVerifierRequirementMapping,
  TaskContractWorkItemMapping,
} from "./task-contract-mapping.js";

const DEFAULT_COVERAGE_RULE =
  "expected_items == completed_items + explicitly_failed_items + explicitly_skipped_items";

const MAPPER_DENIED_OPERATIONS = [
  "call_adapter",
  "emit_audit_event",
  "execute_runner_plan",
  "mutate_filesystem",
  "persist_task_state",
  "run_agentic_runner",
  "run_verifier",
] as const;

type PlanningWorkItem = NonNullable<
  AgenticRunnerPlanningInput["workItems"]
>[number];
type PlanningBatch = NonNullable<AgenticRunnerPlanningInput["batches"]>[number];

interface ResolvedTaskContract {
  readonly task?: AeosTask;
  readonly taskId?: AeosTaskId;
  readonly sourceReference?: AgenticRunnerPlanningReference;
}

function compareString(left: string, right: string): number {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}

function stableUnique(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort(compareString);
}

function createIssue(
  input: TaskContractMappingInput,
  issue: Omit<TaskContractMappingIssue, "taskId" | "sourceFile">,
  taskId?: AeosTaskId,
): TaskContractMappingIssue {
  return {
    ...issue,
    taskId,
    sourceFile: input.sourceFile,
  };
}

function mapValidationIssue(
  input: TaskContractMappingInput,
  sourceIssue: TaskValidationIssue,
  taskId?: AeosTaskId,
): TaskContractMappingIssue {
  return createIssue(
    input,
    {
      code: sourceIssue.code,
      message: sourceIssue.message,
      severity: sourceIssue.severity,
      category: "validation",
      field: sourceIssue.field,
      sourceIssue,
      retryable: false,
    },
    taskId,
  );
}

function resolveTaskContract(
  input: TaskContractMappingInput,
): ResolvedTaskContract {
  const task =
    input.task ??
    (input.taskContract?.kind === "data" ? input.taskContract.data : undefined);
  const taskId = input.taskId ?? task?.id;
  const sourceReference =
    input.taskContract?.kind === "reference"
      ? input.taskContract.reference
      : input.taskContract?.reference ??
        (taskId !== undefined
          ? {
              id: `task-contract:${taskId}`,
              path: input.sourceFile,
            }
          : undefined);

  return {
    task,
    taskId,
    sourceReference,
  };
}

function withDefaultOptions(
  options: TaskContractMappingOptions | undefined,
): Required<TaskContractMappingOptions> {
  return {
    allowSingleWorkItemFallback: options?.allowSingleWorkItemFallback ?? true,
    requireExplicitWorkItems: options?.requireExplicitWorkItems ?? false,
    requireVerifier: options?.requireVerifier ?? true,
    createDefaultBatch: options?.createDefaultBatch ?? true,
    createAuditExpectations: options?.createAuditExpectations ?? true,
    createPolicyBoundary: options?.createPolicyBoundary ?? true,
    createAdapterBoundary: options?.createAdapterBoundary ?? true,
  };
}

function hasUnvalidatedField(task: AeosTask, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(task, field);
}

function validateMappingPreflight(
  input: TaskContractMappingInput,
  resolved: ResolvedTaskContract,
): readonly TaskContractMappingIssue[] {
  const issues: TaskContractMappingIssue[] = [];
  const validation = input.validation;

  if (input.noExecution !== true) {
    issues.push(
      createIssue(
        input,
        {
          code: "task_contract_mapping_execution_not_disabled",
          message: "Task contract mapping requires noExecution to be true.",
          severity: "critical",
          category: "safety",
          retryable: false,
        },
        resolved.taskId,
      ),
    );
  }

  if (input.noWrites !== true) {
    issues.push(
      createIssue(
        input,
        {
          code: "task_contract_mapping_writes_not_disabled",
          message: "Task contract mapping requires noWrites to be true.",
          severity: "critical",
          category: "safety",
          retryable: false,
        },
        resolved.taskId,
      ),
    );
  }

  if (validation === undefined) {
    issues.push(
      createIssue(
        input,
        {
          code: "task_contract_validation_handoff_missing",
          message:
            "Task contract mapping is blocked until a validation handoff is provided.",
          severity: "error",
          category: "validation",
          field: "validation",
          retryable: true,
        },
        resolved.taskId,
      ),
    );
  } else if (
    validation.valid !== true ||
    validation.status !== "pass" ||
    validation.result?.valid === false
  ) {
    issues.push(
      createIssue(
        input,
        {
          code: "task_contract_validation_not_passed",
          message:
            "Task contract mapping is blocked until task validation passes.",
          severity: "error",
          category: "validation",
          field: "validation",
          retryable: true,
        },
        resolved.taskId,
      ),
    );
    issues.push(
      ...validation.issues.map((issue) =>
        mapValidationIssue(input, issue, resolved.taskId),
      ),
    );
  }

  if (resolved.taskId === undefined || resolved.taskId.trim().length === 0) {
    issues.push(
      createIssue(
        input,
        {
          code: "task_contract_task_id_missing",
          message: "Task contract mapping requires a stable task id.",
          severity: "error",
          category: "input",
          field: "taskId",
          retryable: true,
        },
        resolved.taskId,
      ),
    );
  }

  if (resolved.task === undefined) {
    issues.push(
      createIssue(
        input,
        {
          code: "task_contract_data_missing",
          message:
            "Task contract mapping requires validated task contract data, not only a reference.",
          severity: "error",
          category: "input",
          field: "task",
          retryable: true,
        },
        resolved.taskId,
      ),
    );
  }

  if (input.mode !== "plan") {
    issues.push(
      createIssue(
        input,
        {
          code: "task_contract_mapping_mode_unsupported",
          message: "Task contract mapping currently supports plan mode only.",
          severity: "error",
          category: "unsupported",
          field: "mode",
          retryable: false,
        },
        resolved.taskId,
      ),
    );
  }

  return sortMappingIssues(issues);
}

function createUnsupportedFieldIssues(
  input: TaskContractMappingInput,
  task: AeosTask,
  taskId: AeosTaskId,
): readonly TaskContractMappingIssue[] {
  const issues: TaskContractMappingIssue[] = [];

  if (hasUnvalidatedField(task, "workItems")) {
    issues.push(
      createIssue(
        input,
        {
          code: "task_contract_explicit_work_items_unsupported",
          message:
            "Explicit work items are not part of the current validated AEOS task contract.",
          severity: "error",
          category: "unsupported",
          field: "workItems",
          retryable: false,
        },
        taskId,
      ),
    );
  }

  if (hasUnvalidatedField(task, "batches")) {
    issues.push(
      createIssue(
        input,
        {
          code: "task_contract_explicit_batches_unsupported",
          message:
            "Explicit batches are not part of the current validated AEOS task contract.",
          severity: "error",
          category: "unsupported",
          field: "batches",
          retryable: false,
        },
        taskId,
      ),
    );
  }

  return sortMappingIssues(issues);
}

export function createTaskContractWorkItemMappings(
  input: TaskContractMappingInput,
): readonly TaskContractWorkItemMapping[] {
  const options = withDefaultOptions(input.options);
  const { task, taskId, sourceReference } = resolveTaskContract(input);

  if (task === undefined || taskId === undefined || taskId.trim().length === 0) {
    return [];
  }

  if (
    options.requireExplicitWorkItems ||
    hasUnvalidatedField(task, "workItems") ||
    !options.allowSingleWorkItemFallback
  ) {
    return [];
  }

  return [
    {
      sourceTaskId: taskId,
      workItemId: `work-item:${taskId}:default`,
      sourceReference,
      initialState: "pending",
      derivedFrom: "single_work_item_fallback",
      issues: [],
    },
  ];
}

export function createTaskContractBatchMappings(
  input: TaskContractMappingInput,
  workItems: readonly TaskContractWorkItemMapping[] =
    createTaskContractWorkItemMappings(input),
): readonly TaskContractBatchMapping[] {
  const options = withDefaultOptions(input.options);
  const { task, taskId } = resolveTaskContract(input);
  const workItemIds = stableUnique(
    workItems.map((workItem) => workItem.workItemId),
  );

  if (
    task === undefined ||
    taskId === undefined ||
    taskId.trim().length === 0 ||
    hasUnvalidatedField(task, "batches") ||
    !options.createDefaultBatch ||
    workItemIds.length === 0
  ) {
    return [];
  }

  return [
    {
      batchId: `batch:${taskId}:default`,
      workItemIds,
      expectedItemCount: workItemIds.length,
      derivedDefaultBatch: true,
      issues: [],
    },
  ];
}

export function createTaskContractPolicyMapping(
  input: TaskContractMappingInput,
): TaskContractPolicyMapping | undefined {
  const options = withDefaultOptions(input.options);
  const { task, taskId } = resolveTaskContract(input);

  if (
    !options.createPolicyBoundary ||
    task === undefined ||
    taskId === undefined ||
    taskId.trim().length === 0
  ) {
    return undefined;
  }

  const approvalRequired = task.riskProfile?.requiresApproval === true;

  return {
    policyGateId: `policy-gate:${taskId}:task-contract`,
    required: true,
    approvalRequired,
    status: approvalRequired ? "requires_approval" : "not_evaluated",
    decisionReference: `policy-decision:${taskId}:not-evaluated`,
    issues: [],
  };
}

export function createTaskContractAdapterBoundaryMapping(
  input: TaskContractMappingInput,
): TaskContractAdapterBoundaryMapping | undefined {
  const options = withDefaultOptions(input.options);
  const { task, taskId } = resolveTaskContract(input);

  if (
    !options.createAdapterBoundary ||
    task === undefined ||
    taskId === undefined ||
    taskId.trim().length === 0
  ) {
    return undefined;
  }

  const modelAdapterReferences: readonly AgenticRunnerAdapterReference[] =
    task.modelRecommendation === undefined
      ? []
      : [
          {
            adapterId: `model-adapter:${taskId}:recommendation`,
            kind: "model",
            capabilityNames: stableUnique(
              task.modelRecommendation.requiredCapabilities,
            ),
            status: "not_run",
          },
        ];

  return {
    modelAdapterReferences,
    toolAdapterReferences: [],
    allowedOperations: stableUnique(task.allowedOperations),
    deniedOperations: stableUnique([
      ...task.forbiddenOperations,
      ...MAPPER_DENIED_OPERATIONS,
    ]),
    approvalRequired: task.riskProfile?.requiresApproval === true,
    issues: [],
  };
}

export function createTaskContractAuditExpectationMapping(
  input: TaskContractMappingInput,
  batches: readonly TaskContractBatchMapping[] =
    createTaskContractBatchMappings(input),
  resume: TaskContractResumeMapping = createTaskContractResumeMapping(input),
): TaskContractAuditExpectationMapping | undefined {
  const options = withDefaultOptions(input.options);
  const { taskId } = resolveTaskContract(input);

  if (
    !options.createAuditExpectations ||
    taskId === undefined ||
    taskId.trim().length === 0
  ) {
    return undefined;
  }

  const hasResumeData =
    resume.pendingWorkItemIds.length > 0 ||
    resume.retryableWorkItemIds.length > 0 ||
    resume.nextBatchId !== undefined ||
    resume.resumeCursorReference !== undefined;
  const batchEventIds = batches.map(
    (batch) => `audit-batch:${batch.batchId}:planned`,
  );
  const resumeEventIds = hasResumeData
    ? [`audit-resume-update:${taskId}:planned`]
    : [];
  const resumeKinds = hasResumeData ? ["resume.update.planned"] : [];

  return {
    expectedAuditEventIds: stableUnique([
      `audit-policy-preflight:${taskId}:planned`,
      ...batchEventIds,
      `audit-verifier-handoff:${taskId}:planned`,
      ...resumeEventIds,
    ]),
    requiredEventKinds: stableUnique([
      "batch.execution.planned",
      "policy.preflight.planned",
      "verification.handoff.planned",
      ...resumeKinds,
    ]),
    auditRequired: true,
    issues: [],
  };
}

export function createTaskContractVerifierRequirementMapping(
  input: TaskContractMappingInput,
): TaskContractVerifierRequirementMapping {
  const options = withDefaultOptions(input.options);
  const issues =
    options.requireVerifier === false
      ? [
          createIssue(input, {
            code: "task_contract_verifier_requirement_disabled",
            message:
              "Executable task contract mapping cannot disable verifier requirements.",
            severity: "error",
            category: "verifier",
            field: "options.requireVerifier",
            retryable: true,
          }),
        ]
      : [];

  return {
    verifierRequired: true,
    completionGatedByVerifier: true,
    expectedCoverageRule: DEFAULT_COVERAGE_RULE,
    issues,
  };
}

export function createTaskContractResumeMapping(
  input: TaskContractMappingInput,
): TaskContractResumeMapping {
  const { task } = resolveTaskContract(input);

  if (task !== undefined && hasUnvalidatedField(task, "resume")) {
    return {
      pendingWorkItemIds: [],
      retryableWorkItemIds: [],
      issues: [
        createIssue(input, {
          code: "task_contract_resume_unsupported",
          message:
            "Resume data is not part of the current validated AEOS task contract.",
          severity: "error",
          category: "resume",
          field: "resume",
          retryable: false,
        }),
      ],
    };
  }

  return {
    pendingWorkItemIds: [],
    retryableWorkItemIds: [],
    issues: [],
  };
}

export function summarizeTaskContractMappingResult(
  result: Omit<TaskContractMappingResult, "summary">,
): TaskContractMappingSummary {
  const policyRequired = result.policy?.required === true;
  const approvalRequired =
    result.policy?.approvalRequired === true ||
    result.adapterBoundary?.approvalRequired === true;

  return {
    workItemCount: result.workItems.length,
    batchCount: result.batches.length,
    policyRequired,
    approvalRequired,
    adapterReferenceCount:
      (result.adapterBoundary?.modelAdapterReferences.length ?? 0) +
      (result.adapterBoundary?.toolAdapterReferences.length ?? 0),
    expectedAuditEventCount: result.audit?.expectedAuditEventIds.length ?? 0,
    verifierRequired: result.verifier?.verifierRequired === true,
    completionGatedByVerifier:
      result.verifier?.completionGatedByVerifier === true,
    mappingSupported: result.status === "mapped",
    noExecution: true,
    noWrites: true,
    issueCount: result.issues.length,
  };
}

export function mapTaskContractToRunnerPlanningInput(
  input: TaskContractMappingInput,
): TaskContractMappingResult {
  const resolved = resolveTaskContract(input);
  const options = withDefaultOptions(input.options);
  const preflightIssues = validateMappingPreflight(input, resolved);
  const unsupportedFieldIssues =
    resolved.task !== undefined && resolved.taskId !== undefined
      ? createUnsupportedFieldIssues(input, resolved.task, resolved.taskId)
      : [];
  const requireExplicitIssue =
    options.requireExplicitWorkItems &&
    resolved.taskId !== undefined &&
    resolved.taskId.trim().length > 0
      ? [
          createIssue(
            input,
            {
              code: "task_contract_explicit_work_items_required",
              message:
                "Explicit work items are required, but the current AEOS task contract does not validate first-class work items.",
              severity: "error",
              category: "work_items",
              field: "options.requireExplicitWorkItems",
              retryable: false,
            },
            resolved.taskId,
          ),
        ]
      : [];
  const workItems = createTaskContractWorkItemMappings(input);
  const duplicateWorkItemIssues = createDuplicateWorkItemIssues(input, workItems);
  const missingWorkItemIssues =
    workItems.length === 0 &&
    preflightIssues.length === 0 &&
    unsupportedFieldIssues.length === 0 &&
    requireExplicitIssue.length === 0
      ? [
          createIssue(
            input,
            {
              code: "task_contract_work_items_missing",
              message:
                "No executable work items could be mapped from the task contract.",
              severity: "error",
              category: "work_items",
              retryable: false,
            },
            resolved.taskId,
          ),
        ]
      : [];
  const batches = createTaskContractBatchMappings(input, workItems);
  const batchIssues = createBatchMappingIssues(input, workItems, batches);
  const policy = createTaskContractPolicyMapping(input);
  const adapterBoundary = createTaskContractAdapterBoundaryMapping(input);
  const verifier = createTaskContractVerifierRequirementMapping(input);
  const resume = createTaskContractResumeMapping(input);
  const audit = createTaskContractAuditExpectationMapping(input, batches, resume);
  const issues = sortMappingIssues([
    ...preflightIssues,
    ...unsupportedFieldIssues,
    ...requireExplicitIssue,
    ...workItems.flatMap((workItem) => workItem.issues),
    ...duplicateWorkItemIssues,
    ...missingWorkItemIssues,
    ...batches.flatMap((batch) => batch.issues),
    ...batchIssues,
    ...(policy?.issues ?? []),
    ...(adapterBoundary?.issues ?? []),
    ...(audit?.issues ?? []),
    ...verifier.issues,
    ...resume.issues,
  ]);
  const status = determineMappingStatus(issues, workItems, batches);
  const planningInput =
    status === "mapped" &&
    resolved.task !== undefined &&
    resolved.taskId !== undefined &&
    resolved.sourceReference !== undefined
      ? createPlanningInputHandoff(
          input,
          {
            task: resolved.task,
            taskId: resolved.taskId,
            sourceReference: resolved.sourceReference,
          },
          workItems,
          batches,
          policy,
          adapterBoundary,
          audit,
          verifier,
          resume,
        )
      : createBlockedPlanningInputHandoff(status, issues);
  const resultWithoutSummary: Omit<TaskContractMappingResult, "summary"> = {
    ok: status === "mapped",
    taskId: resolved.taskId,
    mode: input.mode,
    status,
    sourceFile: input.sourceFile,
    workItems,
    batches,
    policy,
    adapterBoundary,
    audit,
    verifier,
    resume,
    planningInput,
    issues,
  };

  return {
    ...resultWithoutSummary,
    summary: summarizeTaskContractMappingResult(resultWithoutSummary),
  };
}

function createDuplicateWorkItemIssues(
  input: TaskContractMappingInput,
  workItems: readonly TaskContractWorkItemMapping[],
): readonly TaskContractMappingIssue[] {
  const counts = new Map<string, number>();

  for (const workItem of workItems) {
    counts.set(
      workItem.workItemId,
      (counts.get(workItem.workItemId) ?? 0) + 1,
    );
  }

  return sortMappingIssues(
    [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([workItemId]) =>
        createIssue(input, {
          code: "task_contract_duplicate_work_item_id",
          message: `Work item id '${workItemId}' is duplicated.`,
          severity: "error",
          category: "work_items",
          workItemId,
          retryable: false,
        }),
      ),
  );
}

function createBatchMappingIssues(
  input: TaskContractMappingInput,
  workItems: readonly TaskContractWorkItemMapping[],
  batches: readonly TaskContractBatchMapping[],
): readonly TaskContractMappingIssue[] {
  const workItemIds = new Set(workItems.map((workItem) => workItem.workItemId));
  const issues: TaskContractMappingIssue[] = [];

  if (workItems.length > 0 && batches.length === 0) {
    issues.push(
      createIssue(input, {
        code: "task_contract_batches_missing",
        message: "Mapped work items require at least one non-empty batch.",
        severity: "error",
        category: "batches",
        retryable: false,
      }),
    );
  }

  for (const batch of batches) {
    if (batch.workItemIds.length === 0) {
      issues.push(
        createIssue(input, {
          code: "task_contract_batch_empty",
          message: `Batch '${batch.batchId}' does not contain work item ids.`,
          severity: "error",
          category: "batches",
          batchId: batch.batchId,
          retryable: false,
        }),
      );
    }

    if (batch.expectedItemCount !== batch.workItemIds.length) {
      issues.push(
        createIssue(input, {
          code: "task_contract_batch_expected_count_mismatch",
          message: `Batch '${batch.batchId}' expected item count does not match its work item id count.`,
          severity: "error",
          category: "batches",
          batchId: batch.batchId,
          retryable: false,
        }),
      );
    }

    for (const workItemId of stableUnique(batch.workItemIds)) {
      if (!workItemIds.has(workItemId)) {
        issues.push(
          createIssue(input, {
            code: "task_contract_batch_missing_work_item_reference",
            message: `Batch '${batch.batchId}' references missing work item '${workItemId}'.`,
            severity: "error",
            category: "batches",
            batchId: batch.batchId,
            workItemId,
            retryable: false,
          }),
        );
      }
    }
  }

  return sortMappingIssues(issues);
}

function determineMappingStatus(
  issues: readonly TaskContractMappingIssue[],
  workItems: readonly TaskContractWorkItemMapping[],
  batches: readonly TaskContractBatchMapping[],
): TaskContractMappingStatus {
  if (
    issues.some(
      (issue) =>
        issue.code === "task_contract_validation_handoff_missing" ||
        issue.code === "task_contract_validation_not_passed",
    )
  ) {
    return "blocked";
  }

  if (issues.some((issue) => issue.category === "unsupported")) {
    return "unsupported";
  }

  if (
    issues.some(
      (issue) => issue.severity === "error" || issue.severity === "critical",
    )
  ) {
    return "invalid";
  }

  if (workItems.length === 0 || batches.length === 0) {
    return "unsupported";
  }

  return "mapped";
}

function createPlanningInputHandoff(
  input: TaskContractMappingInput,
  resolved: Required<ResolvedTaskContract>,
  workItems: readonly TaskContractWorkItemMapping[],
  batches: readonly TaskContractBatchMapping[],
  policy: TaskContractPolicyMapping | undefined,
  adapterBoundary: TaskContractAdapterBoundaryMapping | undefined,
  audit: TaskContractAuditExpectationMapping | undefined,
  verifier: TaskContractVerifierRequirementMapping,
  resume: TaskContractResumeMapping,
): TaskContractPlanningInputHandoff {
  const runnerPlanningInput = createAgenticRunnerPlanningInput(
    input,
    resolved,
    workItems,
    batches,
    policy,
    adapterBoundary,
    audit,
    verifier,
    resume,
  );
  const runnerPlanningInputReference = {
    id: `runner-planning-input:${resolved.taskId}`,
  };

  return {
    handoffRequested: true,
    handoffStatus: "mapped",
    runnerPlanningInput,
    runnerPlanningInputReference,
    runnerPlanningInputData: {
      kind: "data",
      data: runnerPlanningInput,
      reference: runnerPlanningInputReference,
    },
    runnerPlanningExecuted: false,
    taskPersistenceWritten: false,
    issues: [],
  };
}

function createBlockedPlanningInputHandoff(
  status: TaskContractMappingStatus,
  issues: readonly TaskContractMappingIssue[],
): TaskContractPlanningInputHandoff {
  return {
    handoffRequested: true,
    handoffStatus: status,
    runnerPlanningExecuted: false,
    taskPersistenceWritten: false,
    unsupportedReason:
      status === "mapped"
        ? undefined
        : "Task contract mapping did not produce a safe runner planning input.",
    issues,
  };
}

function createAgenticRunnerPlanningInput(
  input: TaskContractMappingInput,
  resolved: Required<ResolvedTaskContract>,
  workItems: readonly TaskContractWorkItemMapping[],
  batches: readonly TaskContractBatchMapping[],
  policy: TaskContractPolicyMapping | undefined,
  adapterBoundary: TaskContractAdapterBoundaryMapping | undefined,
  audit: TaskContractAuditExpectationMapping | undefined,
  verifier: TaskContractVerifierRequirementMapping,
  resume: TaskContractResumeMapping,
): AgenticRunnerPlanningInput {
  const runnerWorkItems: readonly PlanningWorkItem[] = workItems.map(
    (workItem) => ({
      id: workItem.workItemId,
      source: workItem.sourceReference?.id ?? `task:${resolved.taskId}`,
      state: workItem.initialState,
      expectedArtifacts: stableUnique(resolved.task.fileBoundary.filesToModify),
      issues: [],
      metadata: {
        sourceTaskId: workItem.sourceTaskId,
        derivedFrom: workItem.derivedFrom,
        title: resolved.task.title,
        purpose: resolved.task.purpose,
        executionMode: resolved.task.executionMode,
      },
    }),
  );
  const runnerBatches: readonly PlanningBatch[] = batches.map((batch) => ({
    id: batch.batchId,
    workItemIds: batch.workItemIds,
    expectedItemCount: batch.expectedItemCount,
    completedCount: 0,
    failedCount: 0,
    skippedCount: 0,
    retryableCount: 0,
    issues: [],
    metadata: {
      derivedDefaultBatch: batch.derivedDefaultBatch,
    },
  }));
  const policyRequirements =
    policy === undefined
      ? undefined
      : [createAgenticRunnerPolicyPlan(policy, resolved.task)];
  const adapterReferences =
    adapterBoundary === undefined
      ? undefined
      : [
          ...adapterBoundary.modelAdapterReferences,
          ...adapterBoundary.toolAdapterReferences,
        ];
  const resumeData =
    resume.pendingWorkItemIds.length > 0 ||
    resume.retryableWorkItemIds.length > 0 ||
    resume.nextBatchId !== undefined ||
    resume.resumeCursorReference !== undefined
      ? createAgenticRunnerResumePlan(resume)
      : undefined;

  return {
    taskId: resolved.taskId,
    taskContract: {
      kind: "metadata",
      task: resolved.task,
      reference: resolved.sourceReference,
    },
    taskMetadata: resolved.task,
    workItems: runnerWorkItems,
    batches: runnerBatches,
    mode: mapPlanningMode(input.mode),
    options: {
      requireVerifier: verifier.verifierRequired,
      requireAudit: audit?.auditRequired ?? false,
      requireApproval:
        policy?.approvalRequired === true ||
        adapterBoundary?.approvalRequired === true,
      metadata: {
        noExecution: true,
        noWrites: true,
      },
    },
    policyRequirements,
    adapterReferences,
    auditRequirements:
      audit === undefined
        ? undefined
        : createAgenticRunnerAuditExpectationPlan(audit),
    verifierRequirements: createAgenticRunnerVerifierRequirementPlan(verifier),
    resumeData,
    metadata: {
      allowedOperations: adapterBoundary?.allowedOperations ?? [],
      deniedOperations: adapterBoundary?.deniedOperations ?? [],
      contextLoadPaths: resolved.task.context.load.map((rule) => rule.path),
      contextDoNotLoadPaths: resolved.task.context.doNotLoad.map(
        (rule) => rule.path,
      ),
      filesToModify: resolved.task.fileBoundary.filesToModify,
      filesNotToTouch: resolved.task.fileBoundary.filesNotToTouch,
      stopCondition: resolved.task.stopCondition.description,
      taskSteps: resolved.task.steps.map((step) => ({
        order: step.order,
        instruction: step.instruction,
        required: step.required,
        expectedOutcome: step.expectedOutcome,
      })),
      verificationCommands: resolved.task.verification
        .map((requirement) => requirement.command)
        .filter((command): command is string => command !== undefined),
      planAgenticRunnerExecuted: false,
      runnerExecutionStarted: false,
      adapterCallsMade: false,
      auditEventsEmitted: false,
      verifierExecuted: false,
      taskPersistenceWritten: false,
      mappingNoCompletedState: true,
    },
  };
}

function createAgenticRunnerPolicyPlan(
  policy: TaskContractPolicyMapping,
  task: AeosTask,
): AgenticRunnerPolicyPlan {
  return {
    policyGateId: policy.policyGateId,
    status: policy.status ?? "not_evaluated",
    decisionReference: policy.decisionReference,
    approvalRequired: policy.approvalRequired,
    approvalState: policy.approvalRequired ? "required" : "not_required",
    reasons: stableUnique([
      "Task contract mapping creates a policy boundary only; policy is not evaluated.",
      ...(task.riskProfile?.rationale === undefined
        ? []
        : [task.riskProfile.rationale]),
    ]),
    issues: [],
    metadata: {
      required: policy.required,
      riskClass: task.riskProfile?.riskClass,
      permissionLevel: task.riskProfile?.permissionLevel,
      sensitiveScopes: task.riskProfile?.sensitiveScopes ?? [],
      allowedOperations: task.allowedOperations,
      deniedOperations: task.forbiddenOperations,
      noPolicyAdapterCalled: true,
    },
  };
}

function createAgenticRunnerAuditExpectationPlan(
  audit: TaskContractAuditExpectationMapping,
): AgenticRunnerAuditExpectationPlan {
  return {
    expectedAuditEventIds: audit.expectedAuditEventIds,
    requiredEventKinds: audit.requiredEventKinds,
    auditRequired: audit.auditRequired,
    issues: [],
    metadata: {
      expectationOnly: true,
      auditEventsEmitted: false,
    },
  };
}

function createAgenticRunnerVerifierRequirementPlan(
  verifier: TaskContractVerifierRequirementMapping,
): AgenticRunnerVerifierRequirementPlan {
  return {
    verifierRequired: verifier.verifierRequired,
    expectedCoverageRule: verifier.expectedCoverageRule,
    completionGatedByVerifier: verifier.completionGatedByVerifier,
    issues: [],
    metadata: {
      verifierExecuted: false,
      completionProofFromModelSelfReport: false,
    },
  };
}

function createAgenticRunnerResumePlan(
  resume: TaskContractResumeMapping,
): AgenticRunnerResumePlan {
  return {
    resumeCursorReference: resume.resumeCursorReference,
    nextBatchId: resume.nextBatchId,
    pendingWorkItemIds: stableUnique(resume.pendingWorkItemIds),
    retryableWorkItemIds: stableUnique(resume.retryableWorkItemIds),
    updatedAt: "1970-01-01T00:00:00.000Z",
    metadata: {
      persisted: false,
    },
  };
}

function mapPlanningMode(
  mode: TaskContractMappingInput["mode"],
): AgenticRunnerPlanningMode {
  return mode === "plan" ? "plan" : "unknown";
}

function sortMappingIssues(
  issues: readonly TaskContractMappingIssue[],
): readonly TaskContractMappingIssue[] {
  return [...issues].sort((left, right) => {
    const codeOrder = compareString(left.code, right.code);

    if (codeOrder !== 0) {
      return codeOrder;
    }

    return compareString(left.message, right.message);
  });
}
