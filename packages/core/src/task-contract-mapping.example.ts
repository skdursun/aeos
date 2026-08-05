import type {
  TaskContractAdapterBoundaryMapping,
  TaskContractAuditExpectationMapping,
  TaskContractBatchMapping,
  TaskContractMappingInput,
  TaskContractMappingIssue,
  TaskContractMappingMode,
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
import type { AeosTask } from "./tasks.js";

export const taskContractMappingExampleMode: TaskContractMappingMode = "plan";

export const taskContractMappingExampleStatus: TaskContractMappingStatus =
  "mapped";

export const taskContractMappingExampleOptions: TaskContractMappingOptions = {
  allowSingleWorkItemFallback: true,
  requireExplicitWorkItems: false,
  requireVerifier: true,
  createDefaultBatch: true,
  createAuditExpectations: true,
  createPolicyBoundary: true,
  createAdapterBoundary: true,
};

export const minimalTaskContractMappingInput: TaskContractMappingInput = {
  taskId: "TASK-0245",
  sourceFile: "TASKS/TASK-0245.json",
  mode: "plan",
  options: {
    requireVerifier: true,
  },
  noExecution: true,
  noWrites: true,
};

export const mappingUnsupportedIssue: TaskContractMappingIssue = {
  code: "mapping_mode_unsupported",
  message: "The task contract cannot be mapped to runner planning input.",
  severity: "error",
  category: "unsupported",
  taskId: "TASK-UNSUPPORTED",
  sourceFile: "TASKS/TASK-UNSUPPORTED.json",
  retryable: false,
};

export const validationIssueExample: TaskContractMappingIssue = {
  code: "task_contract_invalid",
  message: "The task contract validation handoff reports an invalid task.",
  severity: "error",
  category: "validation",
  taskId: "TASK-INVALID",
  sourceIssue: {
    code: "task_title_required",
    message: "Task title is required.",
    severity: "error",
    field: "title",
  },
  field: "validation.result",
};

export const singleWorkItemFallbackMapping: TaskContractWorkItemMapping = {
  sourceTaskId: "TASK-0245",
  workItemId: "work-item:TASK-0245:default",
  sourceReference: {
    id: "task-contract:TASK-0245",
    path: "TASKS/TASK-0245.json",
  },
  initialState: "pending",
  derivedFrom: "single_work_item_fallback",
  issues: [],
};

export const singleWorkItemDefaultBatchMapping: TaskContractBatchMapping = {
  batchId: "batch:TASK-0245:default",
  workItemIds: [singleWorkItemFallbackMapping.workItemId],
  expectedItemCount: 1,
  derivedDefaultBatch: true,
  issues: [],
};

export const explicitWorkItemMappings: readonly TaskContractWorkItemMapping[] = [
  {
    sourceTaskId: "TASK-0245",
    workItemId: "work-item:TASK-0245:001-load-contracts",
    sourceReference: {
      id: "task-contract:TASK-0245:step-001",
      path: "packages/core/src/task-contract-mapping.ts",
    },
    initialState: "pending",
    derivedFrom: "explicit_work_item",
    issues: [],
  },
  {
    sourceTaskId: "TASK-0245",
    workItemId: "work-item:TASK-0245:002-add-examples",
    sourceReference: {
      id: "task-contract:TASK-0245:step-002",
      path: "packages/core/src/task-contract-mapping.example.ts",
    },
    initialState: "pending",
    derivedFrom: "explicit_work_item",
    issues: [],
  },
];

export const explicitWorkItemBatchMapping: TaskContractBatchMapping = {
  batchId: "batch:TASK-0245:explicit",
  workItemIds: [
    "work-item:TASK-0245:001-load-contracts",
    "work-item:TASK-0245:002-add-examples",
  ],
  expectedItemCount: 2,
  derivedDefaultBatch: false,
  issues: [],
};

export const policyMappingExample: TaskContractPolicyMapping = {
  policyGateId: "policy-gate:TASK-0245:no-writes",
  required: true,
  approvalRequired: false,
  status: "not_evaluated",
  decisionReference: "policy-decision:TASK-0245:not-evaluated",
  issues: [],
};

export const adapterBoundaryMappingExample: TaskContractAdapterBoundaryMapping =
  {
    modelAdapterReferences: [
      {
        adapterId: "model-adapter:planning:reference",
        kind: "model",
      },
    ],
    toolAdapterReferences: [
      {
        adapterId: "tool-adapter:filesystem:read-only-reference",
        kind: "tool",
      },
    ],
    allowedOperations: ["read_context", "run_verification"],
    deniedOperations: [
      "write_filesystem",
      "execute_runner_plan",
      "emit_audit_event",
      "call_adapter",
    ],
    approvalRequired: false,
    issues: [],
  };

export const auditExpectationMappingExample: TaskContractAuditExpectationMapping =
  {
    expectedAuditEventIds: [
      "audit-event:TASK-0245:mapping-created",
      "audit-event:TASK-0245:verification-recorded",
    ],
    requiredEventKinds: ["mapping.created", "verification.recorded"],
    auditRequired: true,
    issues: [],
  };

export const verifierRequirementMappingExample: TaskContractVerifierRequirementMapping =
  {
    verifierRequired: true,
    completionGatedByVerifier: true,
    expectedCoverageRule: "compile_checked_task_contract_mapping_examples",
    issues: [],
  };

export const resumeMappingExample: TaskContractResumeMapping = {
  resumeCursorReference: {
    id: "resume-cursor:TASK-0245:example",
    path: "memory/resume/TASK-0245.json",
  },
  pendingWorkItemIds: ["work-item:TASK-0245:002-add-examples"],
  retryableWorkItemIds: ["work-item:TASK-0245:001-load-contracts"],
  nextBatchId: "batch:TASK-0245:explicit",
  issues: [],
};

export const planningInputHandoffExample: TaskContractPlanningInputHandoff = {
  handoffRequested: true,
  handoffStatus: "mapped",
  runnerPlanningInputReference: {
    id: "runner-planning-input:TASK-0245",
    path: "TASKS/TASK-0245.runner-planning-input.json",
  },
  runnerPlanningInputData: {
    kind: "data",
    data: {
      taskId: "TASK-0245",
      taskContract: {
        kind: "reference",
        reference: {
          id: "task-contract:TASK-0245",
          path: "TASKS/TASK-0245.json",
        },
      },
      mode: "plan",
      options: {
        requireVerifier: true,
        requireAudit: true,
        requireApproval: false,
      },
      policyRequirements: [
        {
          policyGateId: policyMappingExample.policyGateId,
          status: "not_evaluated",
          decisionReference: policyMappingExample.decisionReference,
          approvalRequired: policyMappingExample.approvalRequired,
          reasons: ["Example policy boundary only; no enforcement implied."],
          issues: [],
        },
      ],
      adapterReferences: [
        ...adapterBoundaryMappingExample.modelAdapterReferences,
        ...adapterBoundaryMappingExample.toolAdapterReferences,
      ],
      auditRequirements: {
        expectedAuditEventIds:
          auditExpectationMappingExample.expectedAuditEventIds,
        requiredEventKinds: auditExpectationMappingExample.requiredEventKinds,
        auditRequired: auditExpectationMappingExample.auditRequired,
        issues: [],
      },
      verifierRequirements: {
        verifierRequired: verifierRequirementMappingExample.verifierRequired,
        expectedCoverageRule:
          verifierRequirementMappingExample.expectedCoverageRule,
        completionGatedByVerifier:
          verifierRequirementMappingExample.completionGatedByVerifier,
        issues: [],
      },
      resumeData: {
        pendingWorkItemIds: resumeMappingExample.pendingWorkItemIds,
        retryableWorkItemIds: resumeMappingExample.retryableWorkItemIds,
        nextBatchId: resumeMappingExample.nextBatchId,
        updatedAt: "2026-08-05T00:00:00.000Z",
      },
      metadata: {
        noExecution: true,
        noWrites: true,
        planAgenticRunnerExecuted: false,
        taskPersistenceWritten: false,
        auditEventsEmitted: false,
        verifierExecuted: false,
        adapterCallsMade: false,
      },
    },
    reference: {
      id: "runner-planning-input:TASK-0245:data",
    },
  },
  runnerPlanningExecuted: false,
  taskPersistenceWritten: false,
  issues: [],
};

export const mappingSummaryExample: TaskContractMappingSummary = {
  workItemCount: 2,
  batchCount: 1,
  policyRequired: true,
  approvalRequired: false,
  adapterReferenceCount: 2,
  expectedAuditEventCount: 2,
  verifierRequired: true,
  completionGatedByVerifier: true,
  mappingSupported: true,
  noExecution: true,
  noWrites: true,
  issueCount: 0,
};

export const validMinimalTaskMappingResult: TaskContractMappingResult = {
  ok: true,
  taskId: "TASK-0245",
  mode: "plan",
  status: "mapped",
  sourceFile: minimalTaskContractMappingInput.sourceFile,
  workItems: [],
  batches: [],
  verifier: verifierRequirementMappingExample,
  planningInput: {
    handoffRequested: true,
    handoffStatus: "mapped",
    runnerPlanningExecuted: false,
    taskPersistenceWritten: false,
    issues: [],
  },
  issues: [],
  summary: {
    workItemCount: 0,
    batchCount: 0,
    policyRequired: false,
    approvalRequired: false,
    adapterReferenceCount: 0,
    expectedAuditEventCount: 0,
    verifierRequired: true,
    completionGatedByVerifier: true,
    mappingSupported: true,
    noExecution: true,
    noWrites: true,
    issueCount: 0,
  },
};

export const singleWorkItemFallbackMappingResult: TaskContractMappingResult = {
  ok: true,
  taskId: "TASK-0245",
  mode: "plan",
  status: "mapped",
  sourceFile: "TASKS/TASK-0245.json",
  workItems: [singleWorkItemFallbackMapping],
  batches: [singleWorkItemDefaultBatchMapping],
  verifier: verifierRequirementMappingExample,
  planningInput: {
    handoffRequested: true,
    handoffStatus: "mapped",
    runnerPlanningExecuted: false,
    taskPersistenceWritten: false,
    issues: [],
  },
  issues: [],
  summary: {
    ...mappingSummaryExample,
    workItemCount: 1,
    batchCount: 1,
    policyRequired: false,
    approvalRequired: false,
    adapterReferenceCount: 0,
    expectedAuditEventCount: 0,
  },
};

export const explicitWorkItemMappingResult: TaskContractMappingResult = {
  ok: true,
  taskId: "TASK-0245",
  mode: "plan",
  status: "mapped",
  sourceFile: "TASKS/TASK-0245.json",
  workItems: explicitWorkItemMappings,
  batches: [explicitWorkItemBatchMapping],
  verifier: verifierRequirementMappingExample,
  planningInput: planningInputHandoffExample,
  issues: [],
  summary: mappingSummaryExample,
};

export const unsupportedMappingResult: TaskContractMappingResult = {
  ok: false,
  taskId: "TASK-UNSUPPORTED",
  mode: "unknown",
  status: "unsupported",
  sourceFile: "TASKS/TASK-UNSUPPORTED.json",
  workItems: [],
  batches: [],
  planningInput: {
    handoffRequested: true,
    handoffStatus: "unsupported",
    runnerPlanningExecuted: false,
    taskPersistenceWritten: false,
    unsupportedReason: "Unsupported task contract shape.",
    issues: [mappingUnsupportedIssue],
  },
  issues: [mappingUnsupportedIssue],
  summary: {
    workItemCount: 0,
    batchCount: 0,
    policyRequired: false,
    approvalRequired: false,
    adapterReferenceCount: 0,
    expectedAuditEventCount: 0,
    verifierRequired: false,
    completionGatedByVerifier: false,
    mappingSupported: false,
    noExecution: true,
    noWrites: true,
    issueCount: 1,
  },
};

export const invalidTaskContractMappingInput: TaskContractMappingInput = {
  taskId: "TASK-INVALID",
  sourceFile: "TASKS/TASK-INVALID.json",
  mode: "validate",
  validation: {
    status: "fail",
    valid: false,
    reference: {
      id: "task-validation:TASK-INVALID",
      path: "TASKS/TASK-INVALID.validation.json",
    },
    issues: [
      {
        code: "task_title_required",
        message: "Task title is required.",
        severity: "error",
        field: "title",
      },
    ],
  },
  noExecution: true,
  noWrites: true,
};

export const invalidTaskContractMappingResult: TaskContractMappingResult = {
  ok: false,
  taskId: "TASK-INVALID",
  mode: "validate",
  status: "invalid",
  sourceFile: invalidTaskContractMappingInput.sourceFile,
  workItems: [],
  batches: [],
  planningInput: {
    handoffRequested: false,
    handoffStatus: "invalid",
    runnerPlanningExecuted: false,
    taskPersistenceWritten: false,
    issues: [validationIssueExample],
  },
  issues: [validationIssueExample],
  summary: {
    workItemCount: 0,
    batchCount: 0,
    policyRequired: false,
    approvalRequired: false,
    adapterReferenceCount: 0,
    expectedAuditEventCount: 0,
    verifierRequired: false,
    completionGatedByVerifier: false,
    mappingSupported: false,
    noExecution: true,
    noWrites: true,
    issueCount: 1,
  },
};

export const fullMappingResultShapeExample: TaskContractMappingResult = {
  ok: true,
  taskId: "TASK-0245",
  mode: "plan",
  status: "mapped",
  sourceFile: "TASKS/TASK-0245.json",
  workItems: explicitWorkItemMappings,
  batches: [explicitWorkItemBatchMapping],
  policy: policyMappingExample,
  adapterBoundary: adapterBoundaryMappingExample,
  audit: auditExpectationMappingExample,
  verifier: verifierRequirementMappingExample,
  resume: resumeMappingExample,
  planningInput: planningInputHandoffExample,
  issues: [],
  summary: mappingSummaryExample,
};

export const taskContractMappingExamples: readonly TaskContractMappingResult[] =
  [
    validMinimalTaskMappingResult,
    singleWorkItemFallbackMappingResult,
    explicitWorkItemMappingResult,
    unsupportedMappingResult,
    invalidTaskContractMappingResult,
    fullMappingResultShapeExample,
  ];

export const taskContractMappingInputWithTaskData: TaskContractMappingInput = {
  taskId: "TASK-0245",
  task: {
    id: "TASK-0245",
    title: "Add task contract mapping contract examples",
    purpose:
      "Add compile-checked TypeScript examples for task contract mapping.",
    status: "pending",
    executionMode: "planning",
    context: {
      load: [
        {
          path: "packages/core/src/task-contract-mapping.ts",
          required: true,
        },
      ],
      doNotLoad: [],
    },
    fileBoundary: {
      filesToModify: ["packages/core/src/task-contract-mapping.example.ts"],
      filesNotToTouch: ["packages/core/src/task-contract-mapping.ts"],
      allowGeneratedFiles: true,
      requireStopOnBoundaryConflict: true,
    },
    allowedOperations: ["read_context", "run_verification"],
    forbiddenOperations: [
      "modify_unlisted_file",
      "install_dependency",
      "deploy",
      "push_git",
      "continue_next_task",
    ],
    steps: [
      {
        order: 1,
        instruction: "Create compile-checked mapping contract examples.",
        required: true,
      },
    ],
    verification: [
      {
        command: "pnpm --filter @aeos/core check",
        level: "static_check",
        required: true,
        scope: ["packages/core/src/task-contract-mapping.example.ts"],
        expectedEvidence: ["TypeScript compiles without mapper execution."],
      },
    ],
    stopCondition: {
      description: "Stop after TASK-0245 examples and context update.",
      stopAfterCompletion: true,
    },
  } satisfies AeosTask,
  taskContract: {
    kind: "reference",
    reference: {
      id: "task-contract:TASK-0245",
      path: "TASKS/TASK-0245.json",
    },
  },
  sourceFile: "TASKS/TASK-0245.json",
  mode: "plan",
  options: taskContractMappingExampleOptions,
  noExecution: true,
  noWrites: true,
};
