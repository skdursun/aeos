import type {
  AgenticTaskLifecycle,
  AgenticTaskInventory,
  AgenticWorkBatch,
  AgenticWorkBatchId,
  AgenticWorkItem,
  AgenticWorkItemId,
  AgenticWorkItemState,
} from "./agentic-lifecycle.js";
import type {
  AgenticRunnerAdapterReference,
  AgenticRunnerStepState,
} from "./agentic-runner.js";
import type {
  AgenticRunnerAdapterBoundaryPlan,
  AgenticRunnerAuditExpectationPlan,
  AgenticRunnerBatchPlan,
  AgenticRunnerPlanningDataReference,
  AgenticRunnerPlanningInput,
  AgenticRunnerPlanningIssue,
  AgenticRunnerPlanningPrerequisite,
  AgenticRunnerPlanningResult,
  AgenticRunnerPlanningStepKind,
  AgenticRunnerPlanningSummary,
  AgenticRunnerPolicyPlan,
  AgenticRunnerResumePlan,
  AgenticRunnerStepPlan,
  AgenticRunnerVerifierRequirementPlan,
  AgenticRunnerWorkItemPlan,
} from "./agentic-runner-planning.js";
import type { AeosId } from "./types.js";

const DEFAULT_COVERAGE_RULE =
  "expected_items == completed_items + explicitly_failed_items + explicitly_skipped_items";

interface PlanningContext {
  readonly input: AgenticRunnerPlanningInput;
  readonly lifecycle?: AgenticTaskLifecycle;
  readonly inventory?: AgenticTaskInventory;
  readonly workItems: readonly AgenticRunnerWorkItemPlan[];
  readonly batches: readonly AgenticRunnerBatchPlan[];
  readonly policy: readonly AgenticRunnerPolicyPlan[];
  readonly adapterBoundary: AgenticRunnerAdapterBoundaryPlan;
  readonly audit: AgenticRunnerAuditExpectationPlan;
  readonly verifier: AgenticRunnerVerifierRequirementPlan;
  readonly resume?: AgenticRunnerResumePlan;
  readonly approvalRequired: boolean;
  readonly policyBlocked: boolean;
  readonly executable: boolean;
}

export function planAgenticRunner(
  input: AgenticRunnerPlanningInput,
): AgenticRunnerPlanningResult {
  const lifecycle = getReferencedData(input.lifecycle);
  const inventory = getReferencedData(input.inventory) ?? lifecycle?.inventory;
  const workItems = createAgenticRunnerWorkItemPlans(input);
  const batches = createAgenticRunnerBatchPlans(input, workItems);
  const policy = createAgenticRunnerPolicyPlans(input);
  const adapterBoundary = createAgenticRunnerAdapterBoundaryPlan(input, policy);
  const approvalRequired =
    input.options?.requireApproval === true ||
    policy.some((policyPlan) => policyPlan.approvalRequired) ||
    adapterBoundary.approvalRequired;
  const policyBlocked = policy.some(
    (policyPlan) =>
      policyPlan.status === "denied" || policyPlan.status === "blocked",
  );
  const resume = createAgenticRunnerResumePlan(input, workItems);
  const executable =
    isExecutablePlan(input, batches, adapterBoundary, resume) &&
    !policyBlocked &&
    !approvalRequired;
  const verifier = createAgenticRunnerVerifierRequirementPlan(input, executable);
  const audit = createAgenticRunnerAuditExpectationPlan(
    input,
    batches,
    verifier,
    approvalRequired,
    resume,
  );
  const prerequisites = createAgenticRunnerPrerequisites({
    input,
    lifecycle,
    inventory,
    workItems,
    batches,
    policy,
    adapterBoundary,
    audit,
    verifier,
    resume,
    approvalRequired,
    policyBlocked,
    executable,
  });
  const steps = createAgenticRunnerStepPlans({
    input,
    lifecycle,
    inventory,
    workItems,
    batches,
    policy,
    adapterBoundary,
    audit,
    verifier,
    resume,
    approvalRequired,
    policyBlocked,
    executable,
  });
  const issues = collectResultIssues({
    prerequisites,
    workItems,
    batches,
    policy,
    adapterBoundary,
    audit,
    verifier,
    steps,
  });
  const resultWithoutSummary = {
    ok:
      !policyBlocked &&
      !approvalRequired &&
      issues.every(
        (issue) => issue.severity !== "error" && issue.severity !== "critical",
      ),
    taskId: input.taskId,
    mode: input.mode,
    prerequisites,
    workItems,
    batches,
    steps,
    policy,
    adapterBoundary,
    audit,
    verifier,
    resume,
    issues,
  };
  const summary = summarizeAgenticRunnerPlanningResult(resultWithoutSummary);

  return {
    ...resultWithoutSummary,
    summary,
  };
}

export function createAgenticRunnerPrerequisites(
  contextOrInput: PlanningContext | AgenticRunnerPlanningInput,
): readonly AgenticRunnerPlanningPrerequisite[] {
  const context = isPlanningContext(contextOrInput)
    ? contextOrInput
    : createPrerequisiteContext(contextOrInput);
  const prerequisites: AgenticRunnerPlanningPrerequisite[] = [];
  const taskContractPresent =
    context.input.taskContract !== undefined ||
    context.input.taskMetadata !== undefined;
  const missingExecutableWorkIssues = createMissingExecutableWorkIssues(context);
  const taskContractIssues = taskContractPresent
    ? []
    : [
        createIssue({
          code: "TASK_CONTRACT_MISSING",
          message: "A task contract or task metadata is required for runner planning.",
          severity: "error",
          category: "scope_failure",
          prerequisiteId: "prereq-task-contract",
        }),
      ];

  prerequisites.push({
    id: "prereq-task-contract",
    kind: "task_contract",
    status: taskContractPresent ? "satisfied" : "missing",
    required: true,
    reason: taskContractPresent
      ? undefined
      : "Runner planning must be scoped by an explicit task contract.",
    issues: taskContractIssues,
  });

  if (context.inventory !== undefined) {
    const inventoryIssues =
      context.inventory.status === "incomplete"
        ? [
            createIssue({
              code: "INVENTORY_INCOMPLETE",
              message: "Inventory is represented but marked incomplete.",
              severity: "warning",
              category: "inventory_failure",
              prerequisiteId: "prereq-inventory",
              retryable: true,
            }),
          ]
        : [];
    prerequisites.push({
      id: "prereq-inventory",
      kind: "inventory",
      status: context.inventory.status === "complete" ? "satisfied" : "incomplete",
      required: false,
      issues: inventoryIssues,
    });
  }

  if (
    context.workItems.length > 0 ||
    context.batches.length > 0 ||
    context.input.workItems !== undefined ||
    context.lifecycle?.workItems !== undefined
  ) {
    prerequisites.push({
      id: "prereq-work-items",
      kind: "work_items",
      status:
        context.workItems.length > 0 && missingExecutableWorkIssues.length === 0
          ? "satisfied"
          : "missing",
      required: context.batches.length > 0 || missingExecutableWorkIssues.length > 0,
      reason:
        context.batches.length > 0 && context.workItems.length === 0
          ? "Batch planning references require represented work items."
          : missingExecutableWorkIssues.length > 0
            ? "Executable work planning requires represented work items and non-empty explicit batches."
          : undefined,
      issues:
        context.batches.length > 0 && context.workItems.length === 0
          ? [
              createIssue({
                code: "WORK_ITEMS_MISSING",
                message: "Batches are represented but no work items are available.",
                severity: "error",
                category: "inventory_failure",
                prerequisiteId: "prereq-work-items",
              }),
            ]
          : missingExecutableWorkIssues,
    });
  } else if (missingExecutableWorkIssues.length > 0) {
    prerequisites.push({
      id: "prereq-work-items",
      kind: "work_items",
      status: "missing",
      required: true,
      reason:
        "Executable work planning requires represented work items and non-empty explicit batches.",
      issues: missingExecutableWorkIssues,
    });
  }

  if (context.policy.length > 0 || context.input.options?.requireApproval === true) {
    const blockedPolicy = context.policy.find(
      (policyPlan) =>
        policyPlan.status === "denied" || policyPlan.status === "blocked",
    );
    prerequisites.push({
      id: "prereq-policy",
      kind: "policy",
      status: blockedPolicy === undefined ? "satisfied" : "failed",
      required: true,
      reason:
        blockedPolicy === undefined
          ? undefined
          : "Policy planning denied or blocked the requested operation.",
      issues: blockedPolicy?.issues ?? [],
    });
  }

  if (
    context.adapterBoundary.modelAdapterReferences.length > 0 ||
    context.adapterBoundary.toolAdapterReferences.length > 0 ||
    (context.input.adapterKinds?.length ?? 0) > 0
  ) {
    prerequisites.push({
      id: "prereq-adapters",
      kind: "adapters",
      status: "present",
      required: false,
      issues: context.adapterBoundary.issues,
    });
  }

  if (context.audit.auditRequired || context.audit.expectedAuditEventIds.length > 0) {
    prerequisites.push({
      id: "prereq-audit",
      kind: "audit",
      status: context.audit.issues.some((issue) => issue.severity === "error")
        ? "failed"
        : context.audit.issues.length > 0
          ? "incomplete"
          : "satisfied",
      required: context.audit.auditRequired,
      reason:
        context.audit.issues.length > 0
          ? "Audit expectations contain planning issues."
          : undefined,
      issues: context.audit.issues,
    });
  }

  if (context.verifier.verifierRequired || context.executable) {
    prerequisites.push({
      id: "prereq-verifier",
      kind: "verifier",
      status: context.verifier.issues.some((issue) => issue.severity === "error")
        ? "failed"
        : context.verifier.verifierRequired &&
            context.verifier.completionGatedByVerifier
          ? "satisfied"
          : "incomplete",
      required: context.executable,
      reason:
        context.verifier.issues.length > 0
          ? "Executable runner plans must be verifier-gated."
          : undefined,
      issues: context.verifier.issues,
    });
  }

  if (context.approvalRequired) {
    prerequisites.push({
      id: "prereq-human-approval",
      kind: "approval",
      status: "blocked",
      required: true,
      reason: "Human approval is required before execution planning can proceed.",
      issues: [],
    });
  }

  if (context.resume !== undefined) {
    prerequisites.push({
      id: "prereq-resume-state",
      kind: "work_items",
      status: "present",
      required: true,
      issues: [],
    });
  }

  return prerequisites.sort(compareById);
}

export function createAgenticRunnerWorkItemPlans(
  input: AgenticRunnerPlanningInput,
): readonly AgenticRunnerWorkItemPlan[] {
  const lifecycle = getReferencedData(input.lifecycle);
  const sourceWorkItems = input.workItems ?? lifecycle?.workItems ?? [];
  const idCounts = countBy(sourceWorkItems.map((item) => item.id));

  return sourceWorkItems
    .map((item, index) => {
      const issues = [
        ...convertLifecycleIssues(item.issues ?? [], item.id),
        ...createWorkItemIdentityIssues(item, idCounts.get(item.id) ?? 0, index),
        ...createWorkItemStateIssues(item),
      ];
      return {
        id: item.id,
        sourceId: item.source,
        sourcePath: sourcePathFromSource(item.source),
        sourceUrl: sourceUrlFromSource(item.source),
        initialState: item.state,
        batchId: item.batchId,
        expectedArtifactIds: stableUnique(item.expectedArtifacts ?? []),
        issues: sortIssues(issues),
      };
    })
    .sort(compareById);
}

export function createAgenticRunnerBatchPlans(
  input: AgenticRunnerPlanningInput,
  workItemPlans = createAgenticRunnerWorkItemPlans(input),
): readonly AgenticRunnerBatchPlan[] {
  const lifecycle = getReferencedData(input.lifecycle);
  const sourceBatches = input.batches ?? lifecycle?.batches ?? [];
  const batchesExplicitlyRepresented =
    input.batches !== undefined || lifecycle?.batches !== undefined;
  const workItemIds = new Set(workItemPlans.map((item) => item.id));

  if (
    sourceBatches.length === 0 &&
    workItemPlans.length > 0 &&
    !batchesExplicitlyRepresented
  ) {
    const generatedWorkItemIds = stableUnique(workItemPlans.map((item) => item.id));
    return [
      {
        id: "batch-all",
        workItemIds: generatedWorkItemIds,
        expectedItemCount: generatedWorkItemIds.length,
        deterministicOrder: generatedWorkItemIds,
        issues: [],
        metadata: {
          generated: true,
        },
      },
    ];
  }

  const batchIdCounts = countBy(sourceBatches.map((batch) => batch.id));
  const assignedWorkItemIds = new Map<AgenticWorkItemId, AgenticWorkBatchId>();

  return sourceBatches
    .map((batch, index) => {
      const sortedWorkItemIds = [...batch.workItemIds].sort(compareString);
      const issues: AgenticRunnerPlanningIssue[] = [];

      if (batch.id.length === 0) {
        issues.push(
          createIssue({
            code: "BATCH_ID_MISSING",
            message: `Batch at deterministic index ${index} is missing a stable id.`,
            severity: "error",
            category: "inventory_failure",
          }),
        );
      }

      if ((batchIdCounts.get(batch.id) ?? 0) > 1) {
        issues.push(
          createIssue({
            code: "DUPLICATE_BATCH_ID",
            message: `Batch id '${batch.id}' is duplicated.`,
            severity: "error",
            category: "inventory_failure",
            batchId: batch.id,
          }),
        );
      }

      if (batch.expectedItemCount !== batch.workItemIds.length) {
        issues.push(
          createIssue({
            code: "BATCH_EXPECTED_COUNT_MISMATCH",
            message: `Batch '${batch.id}' expected count does not match represented work item ids.`,
            severity: "error",
            category: "inventory_failure",
            batchId: batch.id,
          }),
        );
      }

      if (batch.workItemIds.length === 0) {
        issues.push(
          createIssue({
            code: "BATCH_WORK_ITEMS_EMPTY",
            message: `Batch '${batch.id}' has no represented work item ids.`,
            severity: "error",
            category: "inventory_failure",
            batchId: batch.id,
          }),
        );
      }

      const localCounts = countBy(batch.workItemIds);
      for (const workItemId of stableUnique(batch.workItemIds)) {
        if (workItemId.length === 0) {
          issues.push(
            createIssue({
              code: "BATCH_WORK_ITEM_ID_MISSING",
              message: `Batch '${batch.id}' contains a missing work item id.`,
              severity: "error",
              category: "inventory_failure",
              batchId: batch.id,
            }),
          );
        }

        if ((localCounts.get(workItemId) ?? 0) > 1) {
          issues.push(
            createIssue({
              code: "DUPLICATE_WORK_ITEM_IN_BATCH",
              message: `Work item '${workItemId}' is duplicated inside batch '${batch.id}'.`,
              severity: "error",
              category: "inventory_failure",
              workItemId,
              batchId: batch.id,
            }),
          );
        }

        if (!workItemIds.has(workItemId)) {
          issues.push(
            createIssue({
              code: "BATCH_REFERENCES_MISSING_WORK_ITEM",
              message: `Batch '${batch.id}' references missing work item '${workItemId}'.`,
              severity: "error",
              category: "inventory_failure",
              workItemId,
              batchId: batch.id,
            }),
          );
        }

        const priorBatchId = assignedWorkItemIds.get(workItemId);
        if (priorBatchId !== undefined) {
          issues.push(
            createIssue({
              code: "WORK_ITEM_IN_MULTIPLE_BATCHES",
              message: `Work item '${workItemId}' appears in both '${priorBatchId}' and '${batch.id}'.`,
              severity: "error",
              category: "inventory_failure",
              workItemId,
              batchId: batch.id,
            }),
          );
        } else {
          assignedWorkItemIds.set(workItemId, batch.id);
        }
      }

      return {
        id: batch.id,
        workItemIds: sortedWorkItemIds,
        expectedItemCount: batch.expectedItemCount,
        deterministicOrder: stableUnique(batch.workItemIds),
        issues: sortIssues(issues),
      };
    })
    .sort(compareById);
}

export function createAgenticRunnerStepPlans(
  contextOrInput: PlanningContext | AgenticRunnerPlanningInput,
): readonly AgenticRunnerStepPlan[] {
  const context = isPlanningContext(contextOrInput)
    ? contextOrInput
    : createStepContext(contextOrInput);
  const steps: AgenticRunnerStepPlan[] = [];
  const policyGateId = context.policy[0]?.policyGateId;
  const policyIssues = context.policy.flatMap((policyPlan) => policyPlan.issues);
  const policyState: AgenticRunnerStepState = context.policyBlocked
    ? "blocked"
    : "pending";

  steps.push({
    id: "step-policy-preflight",
    kind: "policy_preflight",
    state: policyState,
    dependsOn: [],
    requiredPolicyGateId: policyGateId,
    expectedAuditEventIds: auditIdsForStep(
      context.audit,
      "policy_preflight",
      undefined,
    ),
    verifierRequired: false,
    issues: sortIssues(policyIssues),
  });

  let previousStepId = "step-policy-preflight";

  if (context.approvalRequired) {
    steps.push({
      id: "step-request-approval",
      kind: "approval",
      state: "pending",
      dependsOn: [previousStepId],
      requiredPolicyGateId: policyGateId,
      expectedAuditEventIds: auditIdsForStep(context.audit, "approval", undefined),
      verifierRequired: false,
      issues: [],
    });
    previousStepId = "step-request-approval";
  }

  if (!context.policyBlocked && !context.approvalRequired) {
    for (const batch of context.batches) {
      steps.push({
        id: `step-${batch.id}`,
        kind: "batch_execution",
        state: "pending",
        dependsOn: [previousStepId],
        requiredAdapterReferenceId:
          context.adapterBoundary.toolAdapterReferences[0]?.adapterId ??
          context.adapterBoundary.modelAdapterReferences[0]?.adapterId,
        expectedAuditEventIds: auditIdsForStep(context.audit, "batch_execution", batch.id),
        verifierRequired: false,
        issues: batch.issues,
        metadata: {
          expectedItemCount: batch.expectedItemCount,
          workItemIds: batch.workItemIds,
        },
      });
      previousStepId = `step-${batch.id}`;
    }
  }

  if (context.audit.auditRequired) {
    steps.push({
      id: "step-audit-append",
      kind: "audit_append",
      state: context.policyBlocked ? "blocked" : "pending",
      dependsOn: previousStepId === "" ? [] : [previousStepId],
      expectedAuditEventIds: context.audit.expectedAuditEventIds,
      verifierRequired: false,
      issues: context.audit.issues,
    });
    previousStepId = "step-audit-append";
  }

  if (context.verifier.verifierRequired && !context.policyBlocked && !context.approvalRequired) {
    steps.push({
      id: "step-verifier-handoff",
      kind: "verification",
      state: "pending",
      dependsOn: [previousStepId],
      expectedAuditEventIds: auditIdsForStep(
        context.audit,
        "verification",
        undefined,
      ),
      verifierRequired: true,
      issues: context.verifier.issues,
    });
    previousStepId = "step-verifier-handoff";
  }

  if (context.resume !== undefined) {
    steps.push({
      id: "step-resume-update",
      kind: "resume_update",
      state: context.policyBlocked ? "blocked" : "pending",
      dependsOn: [previousStepId],
      expectedAuditEventIds: auditIdsForStep(context.audit, "resume_update", undefined),
      verifierRequired: false,
      issues: [],
    });
  }

  return steps.map((step, index) => ({
    ...step,
    metadata: {
      ...step.metadata,
      order: index + 1,
    },
  }));
}

export function createAgenticRunnerVerifierRequirementPlan(
  input: AgenticRunnerPlanningInput,
  executable = createDefaultExecutableState(input),
): AgenticRunnerVerifierRequirementPlan {
  const provided = input.verifierRequirements;
  const shouldRequireVerifier =
    input.options?.requireVerifier === true ||
    provided?.verifierRequired === true ||
    executable;
  const shouldGateCompletion =
    provided?.completionGatedByVerifier === true ||
    (executable && shouldRequireVerifier);
  const issues = [...(provided?.issues ?? [])];

  if (executable && provided === undefined) {
    issues.push(
      createIssue({
        code: "VERIFIER_REQUIREMENT_MISSING",
        message: "Executable runner plans must include verifier requirements.",
        severity: "error",
        category: "verification_failure",
        retryable: true,
      }),
    );
  }

  if (executable && provided?.verifierRequired === false) {
    issues.push(
      createIssue({
        code: "VERIFIER_REQUIREMENT_FALSE",
        message: "Executable runner plans cannot disable verifier requirements.",
        severity: "error",
        category: "verification_failure",
        retryable: true,
      }),
    );
  }

  if (executable && provided?.completionGatedByVerifier === false) {
    issues.push(
      createIssue({
        code: "VERIFIER_COMPLETION_GATE_FALSE",
        message: "Executable runner plans must gate completion on verifier handoff.",
        severity: "error",
        category: "verification_failure",
        retryable: true,
      }),
    );
  }

  return {
    verifierRequired: shouldRequireVerifier,
    verifierId: provided?.verifierId,
    expectedCoverageRule:
      provided?.expectedCoverageRule ??
      (shouldRequireVerifier ? DEFAULT_COVERAGE_RULE : undefined),
    completionGatedByVerifier: shouldGateCompletion,
    issues: sortIssues(issues),
    metadata: provided?.metadata,
  };
}

function createDefaultExecutableState(input: AgenticRunnerPlanningInput): boolean {
  const workItems = createAgenticRunnerWorkItemPlans(input);
  const batches = createAgenticRunnerBatchPlans(input, workItems);
  const policy = createAgenticRunnerPolicyPlans(input);
  const adapterBoundary = createAgenticRunnerAdapterBoundaryPlan(input, policy);
  const approvalRequired =
    input.options?.requireApproval === true ||
    policy.some((policyPlan) => policyPlan.approvalRequired) ||
    adapterBoundary.approvalRequired;
  const policyBlocked = policy.some(
    (policyPlan) =>
      policyPlan.status === "denied" || policyPlan.status === "blocked",
  );
  const resume = createAgenticRunnerResumePlan(input, workItems);

  return (
    isExecutablePlan(input, batches, adapterBoundary, resume) &&
    !policyBlocked &&
    !approvalRequired
  );
}

export function summarizeAgenticRunnerPlanningResult(
  result: Omit<AgenticRunnerPlanningResult, "summary">,
): AgenticRunnerPlanningSummary {
  return {
    prerequisiteCount: result.prerequisites.length,
    workItemCount: result.workItems.length,
    batchCount: result.batches.length,
    stepCount: result.steps.length,
    policyGateCount: result.policy.length,
    adapterReferenceCount:
      result.adapterBoundary.modelAdapterReferences.length +
      result.adapterBoundary.toolAdapterReferences.length,
    expectedAuditEventCount: result.audit.expectedAuditEventIds.length,
    verifierRequired: result.verifier.verifierRequired,
    approvalRequired:
      result.adapterBoundary.approvalRequired ||
      result.policy.some((policyPlan) => policyPlan.approvalRequired),
    issueCount: result.issues.length,
  };
}

function createPrerequisiteContext(
  input: AgenticRunnerPlanningInput,
): PlanningContext {
  const lifecycle = getReferencedData(input.lifecycle);
  const inventory = getReferencedData(input.inventory) ?? lifecycle?.inventory;
  const workItems = createAgenticRunnerWorkItemPlans(input);
  const batches = createAgenticRunnerBatchPlans(input, workItems);
  const policy = createAgenticRunnerPolicyPlans(input);
  const adapterBoundary = createAgenticRunnerAdapterBoundaryPlan(input, policy);
  const approvalRequired =
    input.options?.requireApproval === true ||
    policy.some((policyPlan) => policyPlan.approvalRequired) ||
    adapterBoundary.approvalRequired;
  const policyBlocked = policy.some(
    (policyPlan) =>
      policyPlan.status === "denied" || policyPlan.status === "blocked",
  );
  const resume = createAgenticRunnerResumePlan(input, workItems);
  const executable =
    isExecutablePlan(input, batches, adapterBoundary, resume) &&
    !policyBlocked &&
    !approvalRequired;
  const verifier = createAgenticRunnerVerifierRequirementPlan(input, executable);
  const audit = createAgenticRunnerAuditExpectationPlan(
    input,
    batches,
    verifier,
    approvalRequired,
    resume,
  );

  return {
    input,
    lifecycle,
    inventory,
    workItems,
    batches,
    policy,
    adapterBoundary,
    audit,
    verifier,
    resume,
    approvalRequired,
    policyBlocked,
    executable,
  };
}

function createStepContext(input: AgenticRunnerPlanningInput): PlanningContext {
  return createPrerequisiteContext(input);
}

function createAgenticRunnerPolicyPlans(
  input: AgenticRunnerPlanningInput,
): readonly AgenticRunnerPolicyPlan[] {
  const policyPlans = [...(input.policyRequirements ?? [])];

  if (
    input.options?.requireApproval === true &&
    !policyPlans.some((policyPlan) => policyPlan.approvalRequired)
  ) {
    policyPlans.push({
      policyGateId: "policy-human-approval",
      status: "requires_approval",
      approvalRequired: true,
      approvalState: "required",
      reasons: ["Human approval is required by runner planning options."],
      issues: [],
    });
  }

  return policyPlans
    .map((policyPlan) => ({
      ...policyPlan,
      reasons: stableUnique(policyPlan.reasons),
      issues: sortIssues(policyPlan.issues),
    }))
    .sort(comparePolicyPlan);
}

function createAgenticRunnerAdapterBoundaryPlan(
  input: AgenticRunnerPlanningInput,
  policy = createAgenticRunnerPolicyPlans(input),
): AgenticRunnerAdapterBoundaryPlan {
  const adapterReferences = [...(input.adapterReferences ?? [])].sort(
    compareAdapterReference,
  );
  const modelAdapterReferences = adapterReferences.filter(
    (adapter) => adapter.kind === "model",
  );
  const toolAdapterReferences = adapterReferences.filter(
    (adapter) => adapter.kind === "tool" || adapter.kind === "mcp_tool",
  );
  const task =
    input.taskMetadata ??
    (input.taskContract?.kind === "metadata" ? input.taskContract.task : undefined);
  const allowedOperations = stableUnique([
    ...(task?.allowedOperations ?? []),
    ...stringArrayFromRecord(input.metadata, "allowedOperations"),
    ...policy.flatMap((policyPlan) =>
      stringArrayFromRecord(policyPlan.metadata, "allowedOperations"),
    ),
    ...adapterReferences.flatMap((adapter) =>
      stringArrayFromRecord(adapter.metadata, "allowedOperations"),
    ),
  ]);
  const deniedOperations = stableUnique([
    ...(task?.forbiddenOperations ?? []),
    ...stringArrayFromRecord(input.metadata, "deniedOperations"),
    ...policy.flatMap((policyPlan) =>
      stringArrayFromRecord(policyPlan.metadata, "deniedOperations"),
    ),
    ...adapterReferences.flatMap((adapter) =>
      stringArrayFromRecord(adapter.metadata, "deniedOperations"),
    ),
    ...policy
      .filter(
        (policyPlan) =>
          policyPlan.status === "denied" || policyPlan.status === "blocked",
      )
      .map((policyPlan) => `policy.denied:${policyPlan.policyGateId}`),
  ]);
  const approvalRequired =
    input.options?.requireApproval === true ||
    policy.some((policyPlan) => policyPlan.approvalRequired) ||
    adapterReferences.some(
      (adapter) => adapter.status === "blocked" || adapter.status === "partial",
    );
  const issues = [
    ...policy.flatMap((policyPlan) => policyPlan.issues),
    ...adapterReferences.flatMap((adapter) =>
      adapter.status === "failed"
        ? [
            createIssue({
              code: "ADAPTER_REFERENCE_FAILED",
              message: `Adapter reference '${adapter.adapterId}' is represented as failed.`,
              severity: "error",
              category: "adapter_failure",
              adapterReferenceId: adapter.adapterId,
              retryable: true,
            }),
          ]
        : [],
    ),
  ];

  return {
    modelAdapterReferences,
    toolAdapterReferences,
    allowedOperations,
    deniedOperations,
    approvalRequired,
    issues: sortIssues(issues),
  };
}

function createAgenticRunnerAuditExpectationPlan(
  input: AgenticRunnerPlanningInput,
  batches: readonly AgenticRunnerBatchPlan[],
  verifier: AgenticRunnerVerifierRequirementPlan,
  approvalRequired: boolean,
  resume?: AgenticRunnerResumePlan,
): AgenticRunnerAuditExpectationPlan {
  const provided = input.auditRequirements;
  const auditRequired =
    input.options?.requireAudit === true ||
    provided?.auditRequired === true ||
    batches.length > 0 ||
    verifier.verifierRequired ||
    approvalRequired ||
    resume !== undefined;
  const generatedEventIds = createExpectedAuditEventIds(
    batches,
    verifier.verifierRequired,
    approvalRequired,
    resume !== undefined,
  );
  const expectedAuditEventIds = stableUnique([
    ...(provided?.expectedAuditEventIds ?? []),
    ...(provided === undefined && auditRequired ? generatedEventIds : []),
  ]);
  const requiredEventKinds = stableUnique([
    ...(provided?.requiredEventKinds ?? []),
    ...(provided === undefined && auditRequired
      ? createRequiredAuditEventKinds(
          batches.length > 0,
          verifier.verifierRequired,
          approvalRequired,
          resume !== undefined,
        )
      : []),
  ]);
  const missingAuditEventIds = stableUnique(provided?.missingAuditEventIds ?? []);
  const issues = [
    ...(provided?.issues ?? []),
    ...missingAuditEventIds.map((auditEventId) =>
      createIssue({
        code: "AUDIT_EXPECTATION_MISSING_EVENT_ID",
        message: `Expected audit event '${auditEventId}' is represented as missing.`,
        severity: "error",
        category: "audit_failure",
        auditEventIds: [auditEventId],
        retryable: true,
      }),
    ),
  ];

  if (auditRequired && expectedAuditEventIds.length === 0) {
    issues.push(
      createIssue({
        code: "AUDIT_EXPECTATION_IDS_MISSING",
        message: "Audit is required but no expected audit event ids are represented.",
        severity: "error",
        category: "audit_failure",
        retryable: true,
      }),
    );
  }

  return {
    expectedAuditEventIds,
    requiredEventKinds,
    missingAuditEventIds:
      missingAuditEventIds.length > 0 ? missingAuditEventIds : undefined,
    auditRequired,
    issues: sortIssues(issues),
    metadata: provided?.metadata,
  };
}

function createAgenticRunnerResumePlan(
  input: AgenticRunnerPlanningInput,
  workItemPlans: readonly AgenticRunnerWorkItemPlan[],
): AgenticRunnerResumePlan | undefined {
  if (input.resumeData !== undefined) {
    return {
      ...input.resumeData,
      pendingWorkItemIds: stableUnique(input.resumeData.pendingWorkItemIds),
      retryableWorkItemIds: stableUnique(input.resumeData.retryableWorkItemIds),
    };
  }

  const lifecycle = getReferencedData(input.lifecycle);
  if (lifecycle?.resume === undefined) {
    return undefined;
  }

  const nextBatchId = lifecycle.resume.nextPendingBatchId;
  return {
    resumeCursorReference: {
      id: `resume-${input.taskId}`,
    },
    nextStepId:
      nextBatchId === undefined ? "step-verifier-handoff" : `step-${nextBatchId}`,
    nextBatchId,
    pendingWorkItemIds: stableUnique([
      ...lifecycle.resume.remainingWorkItemIds,
      ...workItemPlans
        .filter((item) => item.initialState === "pending")
        .map((item) => item.id),
    ]),
    retryableWorkItemIds: stableUnique([
      ...lifecycle.resume.retryableWorkItemIds,
      ...workItemPlans
        .filter((item) => item.initialState === "retryable")
        .map((item) => item.id),
    ]),
    updatedAt: lifecycle.resume.updatedAt,
  };
}

function isExecutablePlan(
  input: AgenticRunnerPlanningInput,
  batches: readonly AgenticRunnerBatchPlan[],
  adapterBoundary: AgenticRunnerAdapterBoundaryPlan,
  resume?: AgenticRunnerResumePlan,
): boolean {
  return (
    input.mode === "dry_run" ||
    input.mode === "resume" ||
    input.mode === "verify" ||
    batches.length > 0 ||
    adapterBoundary.modelAdapterReferences.length > 0 ||
    adapterBoundary.toolAdapterReferences.length > 0 ||
    resume !== undefined
  );
}

function createExpectedAuditEventIds(
  batches: readonly AgenticRunnerBatchPlan[],
  verifierRequired: boolean,
  approvalRequired: boolean,
  resumeRequired: boolean,
): readonly string[] {
  return stableUnique([
    "audit-policy-preflight-planned",
    ...(approvalRequired ? ["audit-approval-request-planned"] : []),
    ...batches.map((batch) => `audit-${batch.id}-planned`),
    ...(verifierRequired ? ["audit-verifier-handoff-planned"] : []),
    ...(resumeRequired ? ["audit-resume-update-planned"] : []),
  ]);
}

function createRequiredAuditEventKinds(
  hasBatches: boolean,
  verifierRequired: boolean,
  approvalRequired: boolean,
  resumeRequired: boolean,
): readonly string[] {
  return stableUnique([
    "policy.preflight.planned",
    ...(approvalRequired ? ["approval.request.planned"] : []),
    ...(hasBatches ? ["batch.execution.planned"] : []),
    ...(verifierRequired ? ["verification.handoff.planned"] : []),
    ...(resumeRequired ? ["resume.update.planned"] : []),
  ]);
}

function auditIdsForStep(
  audit: AgenticRunnerAuditExpectationPlan,
  kind: AgenticRunnerPlanningStepKind,
  batchId: AgenticWorkBatchId | undefined,
): readonly string[] {
  const expected = audit.expectedAuditEventIds;
  if (expected.length === 0) {
    return [];
  }

  if (batchId !== undefined) {
    return expected.filter((auditEventId) => auditEventId.includes(batchId));
  }

  const markers =
    kind === "policy_preflight"
      ? ["policy", "preflight"]
      : kind === "approval"
        ? ["approval"]
        : kind === "verification"
          ? ["verifier", "verification"]
          : kind === "resume_update"
            ? ["resume"]
            : [];

  if (markers.length === 0) {
    return [];
  }

  return expected.filter((auditEventId) =>
    markers.some((marker) => auditEventId.includes(marker)),
  );
}

function collectResultIssues(parts: {
  readonly prerequisites: readonly AgenticRunnerPlanningPrerequisite[];
  readonly workItems: readonly AgenticRunnerWorkItemPlan[];
  readonly batches: readonly AgenticRunnerBatchPlan[];
  readonly policy: readonly AgenticRunnerPolicyPlan[];
  readonly adapterBoundary: AgenticRunnerAdapterBoundaryPlan;
  readonly audit: AgenticRunnerAuditExpectationPlan;
  readonly verifier: AgenticRunnerVerifierRequirementPlan;
  readonly steps: readonly AgenticRunnerStepPlan[];
}): readonly AgenticRunnerPlanningIssue[] {
  return sortIssues([
    ...parts.prerequisites.flatMap((prerequisite) => prerequisite.issues),
    ...parts.workItems.flatMap((workItem) => workItem.issues),
    ...parts.batches.flatMap((batch) => batch.issues),
    ...parts.policy.flatMap((policyPlan) => policyPlan.issues),
    ...parts.adapterBoundary.issues,
    ...parts.audit.issues,
    ...parts.verifier.issues,
    ...parts.steps.flatMap((step) => step.issues),
  ]);
}

function createWorkItemIdentityIssues(
  item: AgenticWorkItem,
  idCount: number,
  index: number,
): readonly AgenticRunnerPlanningIssue[] {
  const issues: AgenticRunnerPlanningIssue[] = [];
  if (item.id.length === 0) {
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
        message: `Work item id '${item.id}' is duplicated.`,
        severity: "error",
        category: "inventory_failure",
        workItemId: item.id,
      }),
    );
  }

  return issues;
}

function createWorkItemStateIssues(
  item: AgenticWorkItem,
): readonly AgenticRunnerPlanningIssue[] {
  if (
    (item.state === "failed" ||
      item.state === "skipped" ||
      item.state === "retryable") &&
    (item.issues?.length ?? 0) === 0
  ) {
    return [
      createIssue({
        code: "WORK_ITEM_STATE_REASON_MISSING",
        message: `Work item '${item.id}' is '${item.state}' but has no explicit issue or reason.`,
        severity: "error",
        category: "execution_failure",
        workItemId: item.id,
        retryable: item.state === "retryable",
      }),
    ];
  }

  return [];
}

function createMissingExecutableWorkIssues(
  context: PlanningContext,
): readonly AgenticRunnerPlanningIssue[] {
  const batchesExplicitlyRepresented =
    context.input.batches !== undefined || context.lifecycle?.batches !== undefined;
  const hasWorkExecutionIntent =
    context.input.mode === "dry_run" ||
    context.input.mode === "resume" ||
    context.input.workItems?.length === 0 ||
    context.input.batches?.length === 0 ||
    context.batches.length > 0 ||
    context.adapterBoundary.modelAdapterReferences.length > 0 ||
    context.adapterBoundary.toolAdapterReferences.length > 0 ||
    context.adapterBoundary.allowedOperations.includes("batch.execute") ||
    context.adapterBoundary.allowedOperations.includes("batch.resume");

  if (
    !hasWorkExecutionIntent ||
    context.policyBlocked ||
    context.approvalRequired ||
    context.resume !== undefined
  ) {
    return [];
  }

  if (batchesExplicitlyRepresented && context.batches.length === 0) {
    return [
      createIssue({
        code: "EXECUTABLE_BATCHES_EMPTY",
        message:
          "Executable work planning requires non-empty represented batches when batches are explicitly provided.",
        severity: "error",
        category: "inventory_failure",
        prerequisiteId: "prereq-work-items",
        retryable: true,
      }),
    ];
  }

  if (context.workItems.length > 0) {
    return [];
  }

  return [
    createIssue({
      code: "EXECUTABLE_WORK_ITEMS_MISSING",
      message:
        "Executable work planning requires represented work items and must not imply execution for empty work.",
      severity: "error",
      category: "inventory_failure",
      prerequisiteId: "prereq-work-items",
      retryable: true,
    }),
  ];
}

function convertLifecycleIssues(
  issues: readonly {
    readonly code: string;
    readonly message: string;
    readonly severity: AgenticRunnerPlanningIssue["severity"];
    readonly category: AgenticRunnerPlanningIssue["category"];
    readonly workItemId?: AgenticWorkItemId;
    readonly batchId?: AgenticWorkBatchId;
    readonly auditEventIds?: readonly string[];
    readonly retryable?: boolean;
    readonly createdAt?: string;
  }[],
  fallbackWorkItemId?: AgenticWorkItemId,
): readonly AgenticRunnerPlanningIssue[] {
  return issues.map((issue) => ({
    code: issue.code,
    message: issue.message,
    severity: issue.severity,
    category: issue.category,
    workItemId: issue.workItemId ?? fallbackWorkItemId,
    batchId: issue.batchId,
    auditEventIds: issue.auditEventIds,
    retryable: issue.retryable,
    createdAt: issue.createdAt,
  }));
}

function createIssue(
  issue: AgenticRunnerPlanningIssue,
): AgenticRunnerPlanningIssue {
  return issue;
}

function getReferencedData<TData>(
  reference: AgenticRunnerPlanningDataReference<TData> | undefined,
): TData | undefined {
  return reference?.kind === "data" ? reference.data : undefined;
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

function sourceUrlFromSource(source: string | undefined): string | undefined {
  return source?.startsWith("http://") || source?.startsWith("https://")
    ? source
    : undefined;
}

function sourcePathFromSource(source: string | undefined): string | undefined {
  if (source === undefined || sourceUrlFromSource(source) !== undefined) {
    return undefined;
  }
  return source.includes("/") || source.includes(".") ? source : undefined;
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

function compareById<TValue extends { readonly id: string }>(
  left: TValue,
  right: TValue,
): number {
  return compareString(left.id, right.id);
}

function comparePolicyPlan(
  left: AgenticRunnerPolicyPlan,
  right: AgenticRunnerPolicyPlan,
): number {
  return compareString(left.policyGateId, right.policyGateId);
}

function compareAdapterReference(
  left: AgenticRunnerAdapterReference,
  right: AgenticRunnerAdapterReference,
): number {
  return compareString(left.adapterId, right.adapterId);
}

function compareString(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortIssues(
  issues: readonly AgenticRunnerPlanningIssue[],
): readonly AgenticRunnerPlanningIssue[] {
  const sorted = [...issues].sort((left, right) => {
    const leftKey = issueSortKey(left);
    const rightKey = issueSortKey(right);
    return compareString(leftKey, rightKey);
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

function issueSortKey(issue: AgenticRunnerPlanningIssue): string {
  return [
    issue.severity,
    issue.category,
    issue.code,
    issue.prerequisiteId ?? "",
    issue.workItemId ?? "",
    issue.batchId ?? "",
    issue.stepId ?? "",
    issue.policyGateId ?? "",
    issue.adapterReferenceId ?? "",
    issue.message,
  ].join("|");
}

function isPlanningContext(value: unknown): value is PlanningContext {
  return (
    typeof value === "object" &&
    value !== null &&
    "input" in value &&
    "adapterBoundary" in value &&
    "verifier" in value
  );
}

void DEFAULT_COVERAGE_RULE;
