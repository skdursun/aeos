import {
  createInitialTaskState,
  createCliTaskPlanPlannerIntegrationResult,
  createFilesystemGenerationAdapter,
  createTaskResumeHandoff,
  loadTaskResumeHandoff,
  loadTaskState,
  mapTaskContractToRunnerPlanningInput,
  parseTaskPlanInputFile,
  planAgenticRunner,
  runAgenticRunnerDryRun,
  runInitPipeline,
  saveTaskState,
  validateAeosTask,
} from "@aeos/core";
import type {
  AgenticRunnerDryRunInput,
  AgenticRunnerDryRunIssue,
  AgenticRunnerDryRunResult,
  AgenticRunnerDryRunState,
  AeosTask,
  CliTaskPlanHumanRenderModel,
  CliTaskPlanJsonRenderModel,
  CliTaskPlanPlannerIntegrationIssue,
  CliTaskPlanPlannerIntegrationResult,
  CliTaskPlanPlannerIntegrationStatus,
  AgenticRunnerPlanningIssue,
  AgenticRunnerPlanningResult,
  InitIssue,
  InitResult,
  InitStage,
  MemoryEntry,
  MemorySearchResult,
  MemoryType,
  MemoryValidationIssue,
  PersistedTaskState,
  TaskContractMappingOptions,
  TaskResumeHandoff,
  TaskContractMappingResult,
  TaskPlanInputResult,
  TaskValidationIssue,
  AeosError,
} from "@aeos/core";
import { handleContext } from "./context.js";
import { getCwd, getFs, setExitCode, writeJsonLine } from "./output.js";
import { handleStatus } from "./status.js";

const versionText = "aeos 0.0.0";

const helpText = `AEOS CLI
Usage:
  aeos <command>
Commands:
  context
  context --compact
  context --json
  status
  status --json
  init
  init --json
  init --write
  init --write --json
  remember --type <type> --title <title>
  remember --type <type> --title <title> --json
  search <query>
  search <query> [--json]
  project status
  project status --json
  project context
  project context --json
  project validate
  project validate --json
  project profile
  project profile --json
  template recommend
  template recommend --json
  task validate <path>
  task validate <path> --json
  task plan (skeleton)
  task plan --json (skeleton)
  task plan <task-file>
  task plan <task-file> --json
  task run --dry-run <task-file>
  task run --dry-run <task-file> --json
  task state init <task-file>
  task state init <task-file> --json
  task status <task-id>
  task status <task-id> --json
  task resume --preview <task-id>
  task resume --preview <task-id> --json
  version
  help`;

const memoryTypes = [
  "bug",
  "decision",
  "pattern",
  "incident",
  "lesson",
  "prompt",
  "benchmark",
  "research",
  "postmortem",
] as const satisfies readonly MemoryType[];

const initStages = [
  "project_detection",
  "template_selection",
  "variable_resolution",
  "rendering",
  "file_writing",
  "validation",
] as const satisfies readonly InitStage[];

type InitJsonOutput = {
  readonly ok: boolean;
  readonly mode: "dry_run" | "write";
  readonly writeEnabled: boolean;
  readonly status: "success" | "blocked" | "failure";
  readonly targetRoot: string;
  readonly generatedFiles: readonly {
    readonly path: string;
    readonly status: string;
    readonly summary: string;
    readonly sourcePath?: string;
  }[];
  readonly conflicts: readonly InitIssue[];
  readonly errors: readonly InitIssue[];
  readonly stages?: readonly InitStage[];
  readonly artifacts?: readonly {
    readonly path: string;
    readonly status: string;
    readonly summary: string;
    readonly sourcePath?: string;
  }[];
};

type TaskValidationJsonStatus = "pass" | "fail";

type TaskValidationJsonReason =
  | "missing_task_file_path"
  | "task_file_not_found"
  | "invalid_json"
  | "validation_failed"
  | null;

type TaskValidationJsonOutput = {
  ok: boolean;
  path: string;
  status: TaskValidationJsonStatus;
  issues: readonly TaskValidationIssue[];
  reason: TaskValidationJsonReason;
};

type TaskPlanSkeletonJsonOutput = {
  readonly ok: false;
  readonly status: "skeleton";
  readonly mode: "plan";
  readonly executionEnabled: false;
  readonly adapterCalls: false;
  readonly auditWrites: false;
  readonly verifierRun: false;
  readonly persistence: false;
  readonly issues: readonly [];
};

type TaskPlanJsonErrorOutput = {
  readonly ok: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
  readonly issues: readonly [];
};

type TaskDryRunJsonErrorOutput = {
  readonly ok: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
  readonly issues: readonly [];
};

type TaskDryRunSafety = {
  readonly executionEnabled: false;
  readonly adapterCalls: false;
  readonly auditWrites: false;
  readonly verifierRun: false;
  readonly persistence: false;
  readonly filesystemMutation: false;
  readonly completedStateCreated: false;
};

type TaskDryRunJsonOutput = {
  readonly ok: boolean;
  readonly status:
    | "dry_run_ready"
    | "dry_run_failed"
    | CliTaskPlanPlannerIntegrationStatus;
  readonly mode: "dry_run";
  readonly taskId?: string;
  readonly sourceFile?: string;
  readonly parse: ReturnType<typeof createSafeCliTaskPlanJsonOutput>["parse"];
  readonly mapping: ReturnType<typeof createSafeCliTaskPlanJsonOutput>["mapping"];
  readonly plan: ReturnType<typeof createSafeCliTaskPlanJsonOutput>["plan"];
  readonly dryRun?: ReturnType<typeof createSafeAgenticDryRunJsonOutput>;
  readonly safety: TaskDryRunSafety;
  readonly issues: readonly (
    | CliTaskPlanPlannerIntegrationIssue
    | AgenticRunnerDryRunIssue
  )[];
  readonly summary: {
    readonly parsed: boolean;
    readonly mapped: boolean;
    readonly planned: boolean;
    readonly dryRunPreviewed: boolean;
    readonly workItemCount: number;
    readonly batchCount: number;
    readonly planStepCount: number;
    readonly previewStepCount: number;
    readonly policyRequired: boolean;
    readonly approvalRequired: boolean;
    readonly verifierRequired: boolean;
    readonly completionGatedByVerifier: boolean;
    readonly issueCount: number;
  } & TaskDryRunSafety & {
      readonly noExecution: true;
      readonly noWrites: true;
    };
};

type TaskStateCliIssue = {
  readonly code: string;
  readonly message: string;
  readonly severity: string;
  readonly category: string;
};

type TaskStatusJsonOutput =
  | {
      readonly ok: true;
      readonly status: "loaded";
      readonly taskId: string;
      readonly revision: number;
      readonly lifecycle: string;
      readonly state: PersistedTaskState;
      readonly summary: {
        readonly workItemCount: number;
        readonly batchCount: number;
        readonly pendingCount: number;
        readonly retryableCount: number;
        readonly currentBatchId: string | null;
        readonly nextBatchId: string | null;
        readonly verifierRequired: boolean;
        readonly completionGatedByVerifier: boolean;
        readonly resumeAvailable: boolean;
        readonly issueCount: number;
      };
      readonly safety: {
        readonly readOnly: true;
        readonly authoritativePersistedState: true;
        readonly executionPerformed: false;
        readonly stateModified: false;
      };
      readonly issues: readonly TaskStateCliIssue[];
    }
  | {
      readonly ok: false;
      readonly status: "failed_to_load";
      readonly taskId: string;
      readonly error: {
        readonly code: string;
        readonly message: string;
        readonly category: string;
      };
      readonly safety: {
        readonly readOnly: true;
        readonly authoritativePersistedState: false;
        readonly executionPerformed: false;
        readonly stateModified: false;
      };
      readonly issues: readonly TaskStateCliIssue[];
    };

type TaskResumePreviewJsonOutput =
  | {
      readonly ok: true;
      readonly status: "resume_preview_ready";
      readonly taskId: string;
      readonly sourceRevision: number;
      readonly lifecycle: string;
      readonly resume: {
        readonly allowed: boolean;
        readonly pendingWorkItemIds: readonly string[];
        readonly retryableWorkItemIds: readonly string[];
        readonly remainingWorkCount: number;
        readonly currentBatchId: string | null;
        readonly nextBatchId: string | null;
        readonly verifierRequired: boolean;
        readonly completionGatedByVerifier: boolean;
        readonly blockedReason: string | null;
      };
      readonly safety: {
        readonly noExecution: true;
        readonly noWrites: true;
        readonly stateModified: false;
      };
      readonly issues: readonly TaskStateCliIssue[];
    }
  | {
      readonly ok: false;
      readonly status:
        | "failed_to_load"
        | "task_resume_execution_not_implemented"
        | "invalid_arguments";
      readonly taskId: string;
      readonly error: {
        readonly code: string;
        readonly message: string;
        readonly category: string;
      };
      readonly safety: {
        readonly noExecution: true;
        readonly noWrites: true;
        readonly stateModified: false;
      };
      readonly issues: readonly TaskStateCliIssue[];
    };

type TaskStateInitSafety = {
  readonly taskExecution: false;
  readonly adapterCalls: false;
  readonly auditWrites: false;
  readonly verifierRun: false;
  readonly completedStateCreated: false;
};

type TaskStateInitJsonOutput =
  | {
      readonly ok: true;
      readonly status: "task_state_initialized";
      readonly taskId: string;
      readonly revision: number;
      readonly lifecycle: string;
      readonly statePath: string;
      readonly pending: number;
      readonly retryable: number;
      readonly verifierRequired: boolean;
      readonly completionGatedByVerifier: boolean;
      readonly completionGateSatisfied: false;
      readonly safety: TaskStateInitSafety;
      readonly issues: readonly TaskStateCliIssue[];
    }
  | {
      readonly ok: false;
      readonly status: "task_state_initialization_failed";
      readonly taskId: string;
      readonly statePath: null;
      readonly error: {
        readonly code: string;
        readonly message: string;
        readonly category: string;
      };
      readonly safety: TaskStateInitSafety;
      readonly issues: readonly TaskStateCliIssue[];
    };

type RememberJsonFailureReason =
  | "missing_title"
  | "missing_type"
  | "invalid_memory_type"
  | "validation_failed"
  | "filesystem_failed";

type RememberJsonOutput =
  | {
      readonly ok: true;
      readonly type: MemoryType;
      readonly title: string;
      readonly path: string;
      readonly persisted: true;
    }
  | {
      readonly ok: false;
      readonly reason: RememberJsonFailureReason;
      readonly persisted: false;
      readonly issues: readonly MemoryValidationIssue[];
    };

type SearchJsonOutput =
  | {
      readonly ok: true;
      readonly query: string;
      readonly count: number;
      readonly results: readonly {
        readonly id: string;
        readonly title: string;
        readonly type: MemoryType;
        readonly tags: readonly string[];
        readonly score: number;
        readonly path?: string;
        readonly excerpt?: string;
      }[];
    }
  | {
      readonly ok: false;
      readonly reason: "missing_query" | "invalid_memory_type";
    };

type ProjectStatusJsonOutput =
  | {
      readonly ok: true;
      readonly root: string;
      readonly packageName: string;
      readonly version: string;
      readonly projectContextPresent: boolean;
      readonly agentsPresent: boolean;
      readonly workspacePresent: boolean;
    }
  | {
      readonly ok: false;
      readonly reason: "project_root_not_found";
    };

type ProjectContextJsonOutput =
  | {
      readonly ok: true;
      readonly root: string;
      readonly project: string;
      readonly contextPresent: boolean;
      readonly agentsPresent: boolean;
      readonly context: string;
    }
  | {
      readonly ok: false;
      readonly reason: "project_root_not_found";
    };

type ProjectValidationStatus = "pass" | "fail" | "warn";

type ProjectValidationCheck = {
  readonly name: string;
  readonly status: ProjectValidationStatus;
  readonly message: string;
};

type ProjectValidationIssue = {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
};

type ProjectValidationResult = {
  readonly status: ProjectValidationStatus;
  readonly root: string | undefined;
  readonly checks: readonly ProjectValidationCheck[];
  readonly issues: readonly ProjectValidationIssue[];
};

type ProjectValidationJsonOutput =
  | {
      readonly ok: true;
      readonly valid: boolean;
      readonly checks: readonly ProjectValidationCheck[];
    }
  | {
      readonly ok: false;
      readonly valid: false;
      readonly reason: "project_root_not_found";
      readonly checks: readonly [];
    };

type ProjectIntelligenceDetectorInput = {
  readonly projectRoot: string;
  readonly mode: "profile" | "inventory" | "validate";
  readonly scope: "root" | "known_paths" | "bounded_workspace";
  readonly options: {
    readonly includeHiddenFiles: boolean;
    readonly followSymlinks: boolean;
    readonly includeLockfiles: boolean;
    readonly includeInfrastructure: boolean;
    readonly includeMonorepoSignals: boolean;
    readonly includeDependencySignals: boolean;
  };
  readonly limits: {
    readonly maxDepth: number;
    readonly maxFiles: number;
    readonly maxFileSizeBytes: number;
    readonly maxEvidenceEntries: number;
    readonly timeoutMs: number;
  };
  readonly ignoreRules: readonly {
    readonly path: string | undefined;
    readonly directory: string | undefined;
    readonly extension: string | undefined;
    readonly pattern: string | undefined;
  }[];
};

type ProjectIntelligenceDetectorIssue = {
  readonly code: string;
  readonly message: string;
  readonly severity: "info" | "warning" | "error";
  readonly path: string | undefined;
};

type ProjectIntelligenceScanEntry = {
  readonly path: string;
  readonly kind: "file" | "directory" | "symlink" | "unknown";
  readonly sizeBytes: number | undefined;
  readonly extension: string | undefined;
  readonly basename: string;
  readonly depth: number;
};

type ProjectIntelligenceProfileSignal<TName extends string, TValue extends string> =
  Readonly<Record<TName, TValue>> & {
    readonly confidence: string;
    readonly evidence: readonly string[];
  };

type ProjectIntelligenceProfile = {
  readonly projectRoot: string;
  readonly languages: readonly ProjectIntelligenceProfileSignal<"language", string>[];
  readonly frameworks: readonly ProjectIntelligenceProfileSignal<"framework", string>[];
  readonly packageManagers: readonly ProjectIntelligenceProfileSignal<"packageManager", string>[];
  readonly runtimes: readonly (ProjectIntelligenceProfileSignal<"runtime", string> & {
    readonly versionConstraint: string | undefined;
  })[];
  readonly infrastructure: readonly ProjectIntelligenceProfileSignal<"infrastructure", string>[];
  readonly monorepo: {
    readonly isMonorepo: boolean;
    readonly kind: string;
    readonly workspacePaths: readonly string[];
    readonly confidence: string;
    readonly evidence: readonly string[];
  };
  readonly evidence: readonly {
    readonly id: string;
    readonly category: string;
    readonly source: string;
    readonly path: string;
    readonly signal: string;
    readonly reason: string;
    readonly confidence: string;
  }[];
  readonly issues: readonly {
    readonly code: string;
    readonly message: string;
    readonly severity: string;
    readonly evidence: readonly string[];
  }[];
  readonly summary: {
    readonly confidence: string;
    readonly primaryLanguage: string;
    readonly primaryFramework: string;
    readonly primaryPackageManager: string;
    readonly primaryRuntime: string;
    readonly hasInfrastructure: boolean;
    readonly isMonorepo: boolean;
  };
};

type ProjectIntelligenceDetectorOrchestratorSummary = {
  readonly mode: "profile" | "inventory" | "validate";
  readonly scope: "root" | "known_paths" | "bounded_workspace";
  readonly scannedEntryCount: number;
  readonly scannedEntries: number;
  readonly evidenceCount: number;
  readonly issueCount: number;
  readonly languageCount: number;
  readonly frameworkCount: number;
  readonly packageManagerCount: number;
  readonly runtimeCount: number;
  readonly infrastructureCount: number;
  readonly truncated: boolean;
  readonly timedOut: boolean;
};

type ProjectIntelligenceDetectorOrchestratorResult = {
  readonly profile: ProjectIntelligenceProfile;
  readonly scannedEntries: readonly ProjectIntelligenceScanEntry[];
  readonly issues: readonly ProjectIntelligenceDetectorIssue[];
  readonly summary: ProjectIntelligenceDetectorOrchestratorSummary;
};

type ProjectProfileJsonOutput =
  | {
      readonly ok: true;
      readonly projectRoot: string;
      readonly profile: ProjectIntelligenceProfile;
      readonly scannedEntries: readonly ProjectIntelligenceScanEntry[];
      readonly issues: readonly ProjectIntelligenceDetectorIssue[];
      readonly summary: ProjectIntelligenceDetectorOrchestratorSummary;
    }
  | {
      readonly ok: false;
      readonly projectRoot: string;
      readonly profile: null;
      readonly scannedEntries: readonly [];
      readonly issues: readonly [];
      readonly summary: null;
      readonly reason: "project_profile_failed";
    };

type SmartTemplateSelectionConfidence =
  | "high"
  | "medium"
  | "low"
  | "unknown";

type SmartTemplateSelectionFallback =
  | "generic"
  | "none"
  | "minimal_agents"
  | "unknown";

type SmartTemplateCandidateEvidence = {
  readonly profileEvidenceIds: readonly string[];
  readonly matchedProfileFields: readonly string[];
  readonly matchedTemplateFields: readonly string[];
  readonly ruleIds: readonly string[];
  readonly confidence: SmartTemplateSelectionConfidence;
  readonly reducedByIssueCodes: readonly string[];
};

type SmartTemplateSelectionIssue = {
  readonly code: string;
  readonly message: string;
  readonly severity: "info" | "warning" | "error";
  readonly templateId?: string;
  readonly evidenceIds?: readonly string[];
};

type SmartTemplateCandidate = {
  readonly templateId: string;
  readonly templateName: string;
  readonly source: string;
  readonly type: string;
  readonly supportedLanguages: readonly string[];
  readonly supportedFrameworks: readonly string[];
  readonly supportedPackageManagers: readonly string[];
  readonly supportedRuntimes: readonly string[];
  readonly supportedInfrastructure: readonly string[];
  readonly score: string;
  readonly confidence: SmartTemplateSelectionConfidence;
  readonly evidence: SmartTemplateCandidateEvidence;
  readonly issues: readonly SmartTemplateSelectionIssue[];
};

type SmartTemplateRecommendation = {
  readonly selectedCandidate?: SmartTemplateCandidate;
  readonly fallbackUsed: boolean;
  readonly fallback: SmartTemplateSelectionFallback;
  readonly fallbackReason?: string;
  readonly confidence: SmartTemplateSelectionConfidence;
  readonly evidence: SmartTemplateCandidateEvidence;
  readonly issues: readonly SmartTemplateSelectionIssue[];
};

type SmartTemplateSelectionProfile = {
  readonly projectRoot: string;
  readonly summary: {
    readonly confidence: SmartTemplateSelectionConfidence;
    readonly primaryLanguage: string;
    readonly primaryFramework: string;
    readonly primaryPackageManager: string;
    readonly primaryRuntime: string;
    readonly hasInfrastructure: boolean;
    readonly isMonorepo: boolean;
  };
  readonly evidenceIds: readonly string[];
  readonly issueCodes: readonly string[];
};

type SmartTemplateSelectionResult = {
  readonly ok: boolean;
  readonly mode: "recommend" | "init" | "unknown";
  readonly projectRoot: string;
  readonly recommendation: SmartTemplateRecommendation;
  readonly candidates: readonly SmartTemplateCandidate[];
  readonly fallbackUsed: boolean;
  readonly issues: readonly SmartTemplateSelectionIssue[];
  readonly summary: {
    readonly candidateCount: number;
    readonly issueCount: number;
    readonly selectedTemplateId?: string;
    readonly fallback: SmartTemplateSelectionFallback;
    readonly confidence: SmartTemplateSelectionConfidence;
    readonly evidenceCount?: number;
    readonly fallbackUsed?: boolean;
  };
};

type TemplatesPackage = {
  readonly listBuiltInSmartTemplateCandidates: () => readonly SmartTemplateCandidate[];
  readonly selectSmartTemplate: (input: {
    readonly projectRoot: string;
    readonly profile: SmartTemplateSelectionProfile;
    readonly candidates: readonly SmartTemplateCandidate[];
    readonly mode: "recommend";
    readonly fallback: "minimal_agents";
    readonly options: {
      readonly includeCandidates: true;
      readonly includeEvidence: true;
    };
  }) => SmartTemplateSelectionResult;
};

type TemplateRecommendJsonOutput =
  | {
      readonly ok: true;
      readonly projectRoot: string;
      readonly mode: "recommend";
      readonly recommendation: SmartTemplateRecommendation;
      readonly candidates: readonly SmartTemplateCandidate[];
      readonly fallbackUsed: boolean;
      readonly issues: readonly SmartTemplateSelectionIssue[];
      readonly summary: {
        readonly candidateCount: number;
        readonly evidenceCount: number;
        readonly issueCount: number;
        readonly selectedTemplateId: string | null;
        readonly fallback: SmartTemplateSelectionFallback;
        readonly fallbackUsed: boolean;
        readonly confidence: SmartTemplateSelectionConfidence;
      };
    }
  | {
      readonly ok: false;
      readonly projectRoot: string;
      readonly mode: "recommend";
      readonly recommendation: null;
      readonly candidates: readonly [];
      readonly fallbackUsed: true;
      readonly issues: readonly [];
      readonly summary: null;
      readonly reason: "template_recommend_failed";
    };

const projectValidationJsonCheckNames = new Set([
  "project_root",
  "package_metadata",
  "project_context",
  "agents_file",
  "workspace_marker",
]);

type MemoryWriteRequestSuccess = {
  readonly entry: MemoryEntry;
  readonly path: string;
};

type MemoryWriteResultSuccess = {
  readonly content: string;
  readonly path: string;
};

type MemoryStorageTarget = {
  readonly rootPath: string;
  readonly collectionPath?: string;
};

type ProjectMetadata = {
  readonly projectRoot: string;
  readonly projectName: string | undefined;
  readonly packageName: string | undefined;
  readonly packageVersion: string | undefined;
  readonly hasProjectContext: boolean;
  readonly hasAgents: boolean;
  readonly hasWorkspace: boolean;
  readonly package: {
    readonly path: string;
    readonly exists: boolean;
    readonly name: string | undefined;
    readonly version: string | undefined;
  };
  readonly context: {
    readonly path: string;
    readonly exists: boolean;
    readonly projectName: string | undefined;
  };
  readonly agents: {
    readonly path: string;
    readonly exists: boolean;
  };
};

type ProjectRootDetectionResult =
  | {
      readonly ok: true;
      readonly rootPath: string;
      readonly markers: readonly string[];
    }
  | {
      readonly ok: false;
      readonly rootPath: undefined;
      readonly markers: readonly string[];
      readonly error: {
        readonly code: string;
        readonly startPath: string;
      };
    };

type ProjectsPackage = {
  readonly detectProjectRoot: (startPath: string) => ProjectRootDetectionResult;
  readonly readProjectMetadata: (projectRoot: string) => ProjectMetadata;
  readonly createDefaultProjectIntelligenceDetectorInput: (
    projectRoot: string,
  ) => ProjectIntelligenceDetectorInput;
  readonly detectProjectIntelligence: (
    input: ProjectIntelligenceDetectorInput,
  ) => Promise<ProjectIntelligenceDetectorOrchestratorResult>;
};

type MemoryPackage = {
  readonly buildMemoryMarkdownEntry: (entry: MemoryEntry) => string;
  readonly createMemorySearchIndex: (
    entries?: readonly MemoryEntry[],
  ) => unknown;
  readonly createMemoryStorageTarget: (
    rootPath: string,
    collectionPath?: string,
  ) => MemoryStorageTarget;
  readonly createMemoryWriteRequest: (
    entry: MemoryEntry,
    target: {
      readonly rootPath: string;
      readonly collectionPath?: string;
    },
  ) => { readonly ok: true; readonly value: MemoryWriteRequestSuccess } | { readonly ok: false };
  readonly createMemoryWriteResult: (
    request: MemoryWriteRequestSuccess,
  ) => { readonly ok: true; readonly value: MemoryWriteResultSuccess } | { readonly ok: false };
  readonly loadMemoryEntriesFromStorage: (
    rootPath: string,
  ) => Promise<readonly MemoryEntry[]>;
  readonly searchMemoryEntries: (
    index: unknown,
    query: {
      readonly query: string;
      readonly filter?: {
        readonly types?: readonly MemoryType[];
        readonly tags?: readonly string[];
      };
    },
  ) => readonly MemorySearchResult[];
  readonly validateMemoryEntry: (entry: MemoryEntry) => {
    readonly valid: boolean;
    readonly issues: readonly MemoryValidationIssue[];
  };
  readonly writeMemoryFile: (request: {
    readonly target: MemoryStorageTarget;
    readonly path: string;
    readonly content: string;
    readonly createParentDirectory?: boolean;
  }) => Promise<
    | { readonly ok: true; readonly value: { readonly path: string } }
    | {
        readonly ok: false;
        readonly error: { readonly code: string; readonly message: string };
      }
  >;
};

async function loadMemoryPackage(): Promise<MemoryPackage> {
  // @ts-expect-error @aeos/cli loads the existing memory package artifact without metadata changes.
  return import("../../../packages/memory/dist/index.js") as Promise<MemoryPackage>;
}

async function loadProjectsPackage(): Promise<ProjectsPackage> {
  // @ts-ignore @aeos/cli loads the existing projects package artifact without metadata changes.
  return import("../../../packages/projects/dist/index.js") as Promise<ProjectsPackage>;
}

async function loadTemplatesPackage(): Promise<TemplatesPackage> {
  // @ts-ignore @aeos/cli loads the existing templates package artifact without metadata changes.
  return import("../../../packages/templates/dist/index.js") as Promise<TemplatesPackage>;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatIssue(issue: TaskValidationIssue): string {
  const location = issue.field ?? issue.path;
  return location === undefined
    ? `- ${issue.message}`
    : `- ${location}: ${issue.message}`;
}

function formatMemoryIssue(issue: MemoryValidationIssue): string {
  const location = issue.field ?? issue.path;
  return location === undefined
    ? `- ${issue.message}`
    : `- ${location}: ${issue.message}`;
}

function printTaskValidationFailure(reason?: string): void {
  console.log("Task validation: fail");

  if (reason !== undefined) {
    console.log(`Reason: ${reason}`);
  }
}

function writeTaskValidationJson(
  value: TaskValidationJsonOutput,
): void {
  writeJsonLine(value);
}

function writeTaskPlanSkeletonJson(
  value:
    | TaskPlanSkeletonJsonOutput
    | TaskPlanJsonErrorOutput
    | ReturnType<typeof createSafeCliTaskPlanJsonOutput>,
): void {
  writeJsonLine(value);
}

function writeTaskDryRunJson(
  value: TaskDryRunJsonOutput | TaskDryRunJsonErrorOutput,
): void {
  writeJsonLine(value);
}

function writeTaskStatusJson(value: TaskStatusJsonOutput): void {
  writeJsonLine(value);
}

function writeTaskResumePreviewJson(value: TaskResumePreviewJsonOutput): void {
  writeJsonLine(value);
}

function writeTaskStateInitJson(value: TaskStateInitJsonOutput): void {
  writeJsonLine(value);
}

function writeRememberJson(value: RememberJsonOutput): void {
  writeJsonLine(value);
}

function writeSearchJson(value: SearchJsonOutput): void {
  writeJsonLine(value);
}

function writeInitJson(value: InitJsonOutput): void {
  writeJsonLine(value);
}

function writeProjectStatusJson(value: ProjectStatusJsonOutput): void {
  writeJsonLine(value);
}

function writeProjectContextJson(value: ProjectContextJsonOutput): void {
  writeJsonLine(value);
}

function writeProjectValidationJson(value: ProjectValidationJsonOutput): void {
  writeJsonLine(value);
}

function writeProjectProfileJson(value: ProjectProfileJsonOutput): void {
  writeJsonLine(value);
}

function writeTemplateRecommendJson(value: TemplateRecommendJsonOutput): void {
  writeJsonLine(value);
}

function getProjectValidationJsonChecks(
  checks: readonly ProjectValidationCheck[],
): readonly ProjectValidationCheck[] {
  return checks.filter((check) => projectValidationJsonCheckNames.has(check.name));
}

function validateTaskFile(filePath: string | undefined, json: boolean): void {
  if (filePath === undefined || filePath.trim().length === 0) {
    if (json) {
      writeTaskValidationJson({
        ok: false,
        path: "",
        status: "fail",
        issues: [],
        reason: "missing_task_file_path",
      });
      setExitCode(1);
      return;
    }

    printTaskValidationFailure("missing task file path");
    console.log("Usage: aeos task validate <path>");
    setExitCode(1);
    return;
  }

  const fs = getFs();

  if (!fs.existsSync(filePath)) {
    if (json) {
      writeTaskValidationJson({
        ok: false,
        path: filePath,
        status: "fail",
        issues: [],
        reason: "task_file_not_found",
      });
      setExitCode(1);
      return;
    }

    printTaskValidationFailure("task file not found");
    console.log(`Path: ${filePath}`);
    setExitCode(1);
    return;
  }

  let parsedTask: unknown;

  try {
    parsedTask = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    if (json) {
      writeTaskValidationJson({
        ok: false,
        path: filePath,
        status: "fail",
        issues: [],
        reason: "invalid_json",
      });
      setExitCode(1);
      return;
    }

    printTaskValidationFailure("invalid JSON");
    setExitCode(1);
    return;
  }

  if (!isJsonObject(parsedTask)) {
    const issues: readonly TaskValidationIssue[] = [
      {
        code: "task_json_object_required",
        message: "Task file must contain a JSON object.",
        severity: "error",
      },
    ];

    if (json) {
      writeTaskValidationJson({
        ok: false,
        path: filePath,
        status: "fail",
        issues,
        reason: "validation_failed",
      });
      setExitCode(1);
      return;
    }

    printTaskValidationFailure();
    console.log(formatIssue(issues[0]));
    setExitCode(1);
    return;
  }

  const result = validateAeosTask(parsedTask as unknown as AeosTask);

  if (result.valid) {
    if (json) {
      writeTaskValidationJson({
        ok: true,
        path: filePath,
        status: "pass",
        issues: [],
        reason: null,
      });
      return;
    }

    console.log("Task validation: pass");
    return;
  }

  if (json) {
    writeTaskValidationJson({
      ok: false,
      path: filePath,
      status: "fail",
      issues: result.issues,
      reason: "validation_failed",
    });
    setExitCode(1);
    return;
  }

  printTaskValidationFailure();

  for (const issue of result.issues) {
    console.log(formatIssue(issue));
  }

  setExitCode(1);
}

function createTaskPlanSkeletonOutput(): TaskPlanSkeletonJsonOutput {
  return {
    ok: false,
    status: "skeleton",
    mode: "plan",
    executionEnabled: false,
    adapterCalls: false,
    auditWrites: false,
    verifierRun: false,
    persistence: false,
    issues: [],
  };
}

function printTaskPlanSkeleton(output: TaskPlanSkeletonJsonOutput): void {
  console.log("Task Plan");
  console.log("");
  console.log(`Status: ${output.status}`);
  console.log(`Mode: ${output.mode}`);
  console.log(`Real execution: ${String(output.executionEnabled)}`);
  console.log(`Adapter calls: ${String(output.adapterCalls)}`);
  console.log(`Audit writes: ${String(output.auditWrites)}`);
  console.log(`Verifier run: ${String(output.verifierRun)}`);
  console.log(`Persistence: ${String(output.persistence)}`);
  console.log("");
  console.log(
    "Reason: task contract input support is not implemented yet; this command is a safe skeleton only.",
  );
}

function createTaskPlanInputRequest(
  inputPath: string,
  mode: "plan" | "dry_run" = "plan",
): Parameters<typeof parseTaskPlanInputFile>[0] {
  return {
    inputPath,
    currentWorkingDirectory: getCwd(),
    mode,
    expectedFormat: "json",
    options: {
      allowAbsolutePath: false,
      allowParentTraversal: false,
      requireJsonObject: true,
      validateContract: true,
      createPlanningHandoff: false,
      noExecution: true,
      noWrites: true,
      trustModelSelfReporting: false,
    },
    noExecution: true,
    noWrites: true,
  };
}

function createTaskPlanMappingOptions(): Required<TaskContractMappingOptions> {
  return {
    allowSingleWorkItemFallback: true,
    requireExplicitWorkItems: false,
    requireVerifier: true,
    createDefaultBatch: true,
    createAuditExpectations: true,
    createPolicyBoundary: true,
    createAdapterBoundary: true,
  };
}

function createTaskPlanMappingResult(
  parserResult: TaskPlanInputResult,
  mappingOptions: TaskContractMappingOptions,
): TaskContractMappingResult | undefined {
  if (
    parserResult.summary.pathOk !== true ||
    parserResult.summary.parseOk !== true ||
    parserResult.validation.status !== "pass" ||
    parserResult.validation.result?.valid !== true ||
    parserResult.validation.task === undefined
  ) {
    return undefined;
  }

  return mapTaskContractToRunnerPlanningInput({
    task: parserResult.validation.task,
    taskId: parserResult.validation.taskId,
    sourceFile: parserResult.sourceFile,
    mode: "plan",
    validation: {
      status: "pass",
      valid: true,
      result: parserResult.validation.result,
      issues: parserResult.validation.issues,
    },
    options: mappingOptions,
    noExecution: true,
    noWrites: true,
  });
}

function createTaskPlanIntegrationResult(input: {
  readonly taskFile: string;
  readonly json: boolean;
  readonly argv: readonly string[];
  readonly mode?: "plan" | "dry_run";
  readonly command?: readonly string[];
  readonly parserRequest: Parameters<typeof parseTaskPlanInputFile>[0];
  readonly parserResult: TaskPlanInputResult;
}): CliTaskPlanPlannerIntegrationResult {
  const mappingOptions = createTaskPlanMappingOptions();
  const mappingResult = createTaskPlanMappingResult(
    input.parserResult,
    mappingOptions,
  );

  return createCliTaskPlanPlannerIntegrationResult(
    {
      argv: input.argv,
      command: input.command ?? ["task", "plan"],
      taskFile: input.taskFile,
      json: input.json,
      mode: input.mode ?? "plan",
      parserRequest: input.parserRequest,
      parserResult: input.parserResult,
      parserResultReference: {
        id: `parser-result:${input.parserResult.validation.taskId ?? "unknown"}`,
        path: input.parserResult.sourceFile,
      },
      mappingOptions,
      mappingResult,
      mappingResultReference:
        mappingResult === undefined
          ? undefined
          : {
              id: `mapping-result:${mappingResult.taskId ?? "unknown"}`,
              path: mappingResult.sourceFile,
            },
      wiringResultReference: {
        id: `cli-task-plan-wiring:${input.parserResult.validation.taskId ?? "unknown"}`,
        path: input.parserResult.sourceFile,
      },
      plannerDependencyReference: {
        id: "planner:planAgenticRunner",
      },
      noExecution: true,
      noWrites: true,
    },
    {
      planner: planAgenticRunner,
      planningResultReference: {
        id: `runner-planning-result:${input.parserResult.validation.taskId ?? "unknown"}`,
        path: input.parserResult.sourceFile,
      },
    },
  );
}

function createSafeCliTaskPlanJsonOutput(
  output: CliTaskPlanJsonRenderModel,
) {
  return {
    ok: output.ok,
    status: output.status,
    exitCode: output.exitCode,
    taskId: output.taskId,
    mode: output.mode,
    sourceFile: output.sourceFile,
    parse: {
      attempted: output.parse.attempted,
      ok: output.parse.ok,
      sourceFile: output.parse.sourceFile,
      pathOk: output.parse.pathOk,
      parseOk: output.parse.parseOk,
      validationStatus: output.parse.validationStatus,
      validationCompatible: output.parse.validationCompatible,
      parserResultReference: output.parse.parserResultReference,
      parsedTaskReference: output.parse.parsedTaskReference,
      issues: output.parse.issues,
    },
    mapping: {
      attempted: output.mapping.attempted,
      ok: output.mapping.ok,
      status: output.mapping.status,
      mappingResultReference: output.mapping.mappingResultReference,
      runnerPlanningInputReference: output.mapping.runnerPlanningInputReference,
      runnerPlanningInputAvailable:
        output.mapping.runnerPlanningInputAvailable,
      noExecution: output.mapping.noExecution,
      noWrites: output.mapping.noWrites,
      verifierRequired: output.mapping.verifierRequired,
      completionGatedByVerifier: output.mapping.completionGatedByVerifier,
      issues: output.mapping.issues,
    },
    wiring: {
      attempted: output.wiring.attempted,
      ok: output.wiring.ok,
      status: output.wiring.status,
      wiringResultReference: output.wiring.wiringResultReference,
      plannerDependencyInjected: output.wiring.plannerDependencyInjected,
      plannerInvocationAllowed: output.wiring.plannerInvocationAllowed,
      dependencyInjectedPlannerOnly:
        output.wiring.dependencyInjectedPlannerOnly,
      topLevelPlannerInputBypassAllowed:
        output.wiring.topLevelPlannerInputBypassAllowed,
      issues: output.wiring.issues,
    },
    plan: {
      attempted: output.plan.attempted,
      ok: output.plan.ok,
      status: output.plan.status,
      plannerDependencyReference: output.plan.plannerDependencyReference,
      planningResultReference: output.plan.planningResultReference,
      planStepCount: output.plan.planStepCount,
      issues: output.plan.issues,
    },
    safety: output.safety,
    issues: output.issues,
    summary: output.summary,
  };
}

const taskDryRunSafety: TaskDryRunSafety = {
  executionEnabled: false,
  adapterCalls: false,
  auditWrites: false,
  verifierRun: false,
  persistence: false,
  filesystemMutation: false,
  completedStateCreated: false,
};

const dryRunIssueCategories = new Set<string>([
  "scope_failure",
  "policy_failure",
  "execution_failure",
  "verification_failure",
  "coverage_failure",
  "artifact_failure",
  "adapter_failure",
  "audit_failure",
  "inventory_failure",
  "resume_failure",
  "approval_failure",
  "dry_run_safety",
  "unknown",
]);

function mapPlanningIssueToDryRunIssue(
  issue: AgenticRunnerPlanningIssue,
): AgenticRunnerDryRunIssue {
  return {
    code: issue.code,
    message: issue.message,
    severity: issue.severity,
    category: dryRunIssueCategories.has(issue.category)
      ? issue.category as AgenticRunnerDryRunIssue["category"]
      : "unknown",
    stepId: issue.stepId,
    batchId: issue.batchId,
    workItemId: issue.workItemId,
    auditEventIds: issue.auditEventIds,
    retryable: issue.retryable,
    createdAt: issue.createdAt,
    metadata: issue.metadata,
  };
}

function mapStepStateToDryRunPreviewState(
  state: string,
): AgenticRunnerDryRunState {
  if (state === "blocked") {
    return "blocked";
  }

  if (state === "failed") {
    return "failed";
  }

  if (state === "skipped") {
    return "blocked";
  }

  if (state === "completed" || state === "verified") {
    return state as unknown as AgenticRunnerDryRunState;
  }

  return "preview_ready";
}

function createDryRunInputFromPlan(input: {
  readonly taskFile: string;
  readonly json: boolean;
  readonly integrationResult: CliTaskPlanPlannerIntegrationResult;
}): AgenticRunnerDryRunInput | undefined {
  const planningResult = input.integrationResult.planner.planningResult;

  if (
    planningResult === undefined ||
    input.integrationResult.status !== "planned"
  ) {
    return undefined;
  }

  const approvalRequired =
    planningResult.summary.approvalRequired ||
    input.integrationResult.summary.verifierRequired === false;
  const adapterReferences = [
    ...planningResult.adapterBoundary.modelAdapterReferences,
    ...planningResult.adapterBoundary.toolAdapterReferences,
  ];

  return {
    taskId: planningResult.taskId,
    mode: "dry_run",
    planningResult: {
      kind: "reference",
      reference:
        input.integrationResult.planner.planningResultReference ?? {
          id: `runner-planning-result:${planningResult.taskId}`,
          path: input.taskFile,
        },
    },
    plannedSteps: planningResult.steps.map((step) => {
      const previewState = mapStepStateToDryRunPreviewState(step.state);

      return {
        stepId: step.id,
        stepKind: step.kind,
        previewState,
        wouldRun: previewState === "preview_ready",
        blockedReason:
          previewState === "blocked"
            ? "Planning represented this step as blocked."
            : undefined,
        approvalRequired,
        plannedAdapterCallIds:
          step.requiredAdapterReferenceId === undefined
            ? []
            : [`adapter-call:reference:${step.requiredAdapterReferenceId}`],
        expectedAuditEventIds: step.expectedAuditEventIds,
        verifierRequired: step.verifierRequired,
        issues: step.issues.map(mapPlanningIssueToDryRunIssue),
        metadata: {
          sourcePlannerStepState: step.state,
        },
      };
    }),
    plannedBatches: planningResult.batches.map((batch) => ({
      batchId: batch.id,
      workItemIds: batch.workItemIds,
      expectedItemCount: batch.expectedItemCount,
      previewState: batch.issues.length > 0 ? "blocked" : "preview_ready",
      wouldRun: batch.issues.length === 0 && !approvalRequired,
      issues: batch.issues.map(mapPlanningIssueToDryRunIssue),
      metadata: {
        deterministicOrder: batch.deterministicOrder,
      },
    })),
    plannedWorkItems: planningResult.workItems.map((workItem) => {
      const previewState = mapStepStateToDryRunPreviewState(
        workItem.initialState,
      );

      return {
        workItemId: workItem.id,
        batchId: workItem.batchId,
        previewState,
        wouldProcess: previewState === "preview_ready" && !approvalRequired,
        expectedArtifactIds: workItem.expectedArtifactIds,
        issues: workItem.issues.map(mapPlanningIssueToDryRunIssue),
        metadata: {
          sourcePlannerInitialState: workItem.initialState,
        },
      };
    }),
    adapterCalls: adapterReferences.map((adapterReference) => ({
      callId: `adapter-call:reference:${adapterReference.adapterId}`,
      kind: adapterReference.kind === "model" ? "model" : "tool",
      adapterId: adapterReference.adapterId,
      operation: "planned_reference",
      wouldCall: false,
      approvalRequired,
      inputReference: {
        id: `adapter-input:${adapterReference.adapterId}`,
      },
      outputReference: null,
      issues: [],
      observationOnly: true,
      completionAuthority: false,
      metadata: {
        sourceAdapterStatus: adapterReference.status,
      },
    })),
    policyPreview: {
      kind: "data",
      data: {
        status: planningResult.policy[0]?.status ?? "not_evaluated",
        approvalRequired,
        required: planningResult.policy.length > 0,
      },
      reference: {
        id: `policy-preview:${planningResult.taskId}`,
      },
    },
    auditPreviewInput: {
      kind: "data",
      data: {
        expectedAuditEventIds: planningResult.audit.expectedAuditEventIds,
        emittedAuditEventIds: [],
        wouldWriteAudit: false,
        auditStatus: "pending",
      },
      reference: {
        id: `audit-preview:${planningResult.taskId}`,
      },
    },
    verifierPreviewInput: {
      kind: "data",
      data: {
        verifierRequired: planningResult.verifier.verifierRequired,
        completionGatedByVerifier:
          planningResult.verifier.completionGatedByVerifier,
        wouldRunVerifier: false,
        verifierStatus: planningResult.verifier.verifierRequired
          ? "required_not_run"
          : "not_required",
        coverageStatus: planningResult.verifier.verifierRequired
          ? "incomplete"
          : "unknown",
      },
      reference: {
        id: `verifier-preview:${planningResult.taskId}`,
      },
    },
    resumePreviewInput: {
      kind: "data",
      data: {
        pendingWorkItemIds:
          planningResult.resume?.pendingWorkItemIds ??
          planningResult.workItems.map((workItem) => workItem.id),
        retryableWorkItemIds: planningResult.resume?.retryableWorkItemIds ?? [],
        wouldUpdateResume: false,
      },
      reference: {
        id: `resume-preview:${planningResult.taskId}`,
      },
    },
    options: {
      requirePolicy: planningResult.policy.length > 0,
      requireApproval: approvalRequired,
      requireAudit: planningResult.audit.auditRequired,
      requireVerifier: planningResult.verifier.verifierRequired,
      completionGatedByVerifier:
        planningResult.verifier.completionGatedByVerifier,
      outputMode: input.json ? "json" : "human",
      metadata: {
        noExecution: true,
        noWrites: true,
      },
    },
    metadata: {
      sourceFile: input.taskFile,
      noExecution: true,
      noWrites: true,
      executionEnabled: false,
      adapterCalls: false,
      auditWrites: false,
      verifierRun: false,
      persistence: false,
      filesystemMutation: false,
      completedStateCreated: false,
    },
  };
}

function createSafeAgenticDryRunJsonOutput(
  result: AgenticRunnerDryRunResult,
) {
  return {
    ok: result.ok,
    state: result.state,
    steps: result.steps.map((step) => ({
      stepId: step.stepId,
      stepKind: step.stepKind,
      previewState: step.previewState,
      wouldRun: step.wouldRun,
      approvalRequired: step.approvalRequired,
      plannedAdapterCallIds: step.plannedAdapterCallIds,
      expectedAuditEventIds: step.expectedAuditEventIds,
      verifierRequired: step.verifierRequired,
      issueCount: step.issues.length,
    })),
    batches: result.batches.map((batch) => ({
      batchId: batch.batchId,
      workItemIds: batch.workItemIds,
      expectedItemCount: batch.expectedItemCount,
      previewState: batch.previewState,
      wouldRun: batch.wouldRun,
      issueCount: batch.issues.length,
    })),
    workItems: result.workItems.map((workItem) => ({
      workItemId: workItem.workItemId,
      batchId: workItem.batchId,
      previewState: workItem.previewState,
      wouldProcess: workItem.wouldProcess,
      issueCount: workItem.issues.length,
    })),
    adapterCalls: result.adapterCalls.map((adapterCall) => ({
      callId: adapterCall.callId,
      kind: adapterCall.kind,
      adapterId: adapterCall.adapterId,
      operation: adapterCall.operation,
      wouldCall: adapterCall.wouldCall,
      approvalRequired: adapterCall.approvalRequired,
      observationOnly: adapterCall.observationOnly,
      completionAuthority: adapterCall.completionAuthority,
      issueCount: adapterCall.issues.length,
    })),
    audit: {
      expectedAuditEventIds: result.audit.expectedAuditEventIds,
      emittedAuditEventIds: result.audit.emittedAuditEventIds,
      missingAuditEventIds: result.audit.missingAuditEventIds,
      wouldWriteAudit: result.audit.wouldWriteAudit,
      auditStatus: result.audit.auditStatus,
      issueCount: result.audit.issues.length,
    },
    verifier: {
      verifierRequired: result.verifier.verifierRequired,
      wouldRunVerifier: result.verifier.wouldRunVerifier,
      verifierStatus: result.verifier.verifierStatus,
      coverageStatus: result.verifier.coverageStatus,
      completionGatedByVerifier: result.verifier.completionGatedByVerifier,
      completionGateSatisfied: result.verifier.completionGateSatisfied,
      issueCount: result.verifier.issues.length,
    },
    resume:
      result.resume === undefined
        ? undefined
        : {
            wouldUpdateResume: result.resume.wouldUpdateResume,
            nextStepId: result.resume.nextStepId,
            nextBatchId: result.resume.nextBatchId,
            pendingWorkItemIds: result.resume.pendingWorkItemIds,
            retryableWorkItemIds: result.resume.retryableWorkItemIds,
            issueCount: result.resume.issues.length,
          },
    issues: result.issues,
    summary: result.summary,
  };
}

function createTaskDryRunJsonOutput(input: {
  readonly integrationResult: CliTaskPlanPlannerIntegrationResult;
  readonly safePlanOutput: ReturnType<typeof createSafeCliTaskPlanJsonOutput>;
  readonly dryRunResult?: AgenticRunnerDryRunResult;
}): TaskDryRunJsonOutput {
  const safeDryRun =
    input.dryRunResult === undefined
      ? undefined
      : createSafeAgenticDryRunJsonOutput(input.dryRunResult);
  const dryRunOk = input.dryRunResult?.ok === true;
  const issues = [
    ...input.integrationResult.issues,
    ...(input.dryRunResult?.issues ?? []),
  ];

  return {
    ok: input.integrationResult.ok && dryRunOk,
    status:
      input.integrationResult.status === "planned"
        ? dryRunOk
          ? "dry_run_ready"
          : "dry_run_failed"
        : input.integrationResult.status,
    mode: "dry_run",
    taskId: input.integrationResult.taskId,
    sourceFile: input.integrationResult.sourceFile,
    parse: input.safePlanOutput.parse,
    mapping: input.safePlanOutput.mapping,
    plan: input.safePlanOutput.plan,
    dryRun: safeDryRun,
    safety: taskDryRunSafety,
    issues,
    summary: {
      parsed: input.integrationResult.summary.parsed,
      mapped: input.integrationResult.summary.mapped,
      planned: input.integrationResult.summary.planned,
      dryRunPreviewed: input.dryRunResult !== undefined,
      workItemCount: input.integrationResult.summary.workItemCount,
      batchCount: input.integrationResult.summary.batchCount,
      planStepCount: input.integrationResult.summary.planStepCount,
      previewStepCount: input.dryRunResult?.summary.plannedSteps ?? 0,
      policyRequired:
        (input.integrationResult.planner.planningResult?.policy.length ?? 0) > 0,
      approvalRequired:
        input.integrationResult.planner.planningResult?.summary
          .approvalRequired ?? false,
      verifierRequired: input.integrationResult.summary.verifierRequired,
      completionGatedByVerifier:
        input.integrationResult.summary.completionGatedByVerifier,
      issueCount: issues.length,
      noExecution: true,
      noWrites: true,
      ...taskDryRunSafety,
    },
  };
}

function printTaskDryRunOutput(input: {
  readonly integrationResult: CliTaskPlanPlannerIntegrationResult;
  readonly dryRunResult?: AgenticRunnerDryRunResult;
}): void {
  const output = input.integrationResult.humanOutput;
  const dryRun = input.dryRunResult;

  console.log("Task Dry Run");
  console.log(`Task id: ${input.integrationResult.taskId ?? ""}`);
  console.log(`Source file: ${input.integrationResult.sourceFile ?? ""}`);
  console.log(`Parsed: ${String(input.integrationResult.summary.parsed)}`);
  console.log(`Mapping: ${input.integrationResult.mapping.status}`);
  console.log(`Planning: ${input.integrationResult.planner.status}`);
  console.log(
    `Dry run: ${dryRun === undefined ? "not_attempted" : dryRun.state}`,
  );
  console.log(`Work items: ${input.integrationResult.summary.workItemCount}`);
  console.log(`Batches: ${input.integrationResult.summary.batchCount}`);
  console.log(`Preview steps: ${dryRun?.summary.plannedSteps ?? 0}`);
  console.log(`Policy required: ${String(output?.policyRequired ?? false)}`);
  console.log(`Approval required: ${String(output?.approvalRequired ?? false)}`);
  console.log(
    `Verifier required: ${String(input.integrationResult.summary.verifierRequired)}`,
  );
  console.log(
    `Completion gated by verifier: ${String(
      input.integrationResult.summary.completionGatedByVerifier,
    )}`,
  );
  console.log(`Real execution: ${String(taskDryRunSafety.executionEnabled)}`);
  console.log(`Adapter calls: ${String(taskDryRunSafety.adapterCalls)}`);
  console.log(`Audit writes: ${String(taskDryRunSafety.auditWrites)}`);
  console.log(`Verifier run: ${String(taskDryRunSafety.verifierRun)}`);
  console.log(`Persistence: ${String(taskDryRunSafety.persistence)}`);
  console.log(
    `Filesystem mutation: ${String(taskDryRunSafety.filesystemMutation)}`,
  );
  console.log(
    `Completed state created: ${String(
      taskDryRunSafety.completedStateCreated,
    )}`,
  );
  console.log(
    `Issues: ${
      input.integrationResult.issues.length + (dryRun?.issues.length ?? 0)
    }`,
  );

  for (const issue of input.integrationResult.issues) {
    console.log(formatCliTaskPlanIssue(issue));
  }

  for (const issue of dryRun?.issues ?? []) {
    console.log(`- ${issue.code}: ${issue.message}`);
  }
}

function formatCliTaskPlanIssue(
  issue: CliTaskPlanPlannerIntegrationIssue,
): string {
  const field = issue.field === undefined ? "" : ` ${issue.field}`;
  return `- ${issue.code}${field}: ${issue.message}`;
}

function printTaskPlanIntegrationOutput(
  output: CliTaskPlanHumanRenderModel,
): void {
  console.log("Task Plan");
  console.log(`Task id: ${output.taskId ?? ""}`);
  console.log(`Source file: ${output.sourceFile ?? ""}`);
  console.log(`Mode: ${output.mode}`);
  console.log(`Parsed: ${String(output.parsed)}`);
  console.log(`Mapping: ${output.mapping}`);
  console.log(`Planning: ${output.planning}`);
  console.log(`Work items: ${output.workItems}`);
  console.log(`Batches: ${output.batches}`);
  console.log(`Steps: ${output.steps}`);
  console.log(`Policy required: ${String(output.policyRequired)}`);
  console.log(`Approval required: ${String(output.approvalRequired)}`);
  console.log(`Verifier required: ${String(output.verifierRequired)}`);
  console.log(
    `Completion gated by verifier: ${String(output.completionGatedByVerifier)}`,
  );
  console.log(`Audit expected: ${String(output.auditExpected)}`);
  console.log(`Real execution: ${String(output.realExecution)}`);
  console.log(`Adapter calls: ${String(output.adapterCalls)}`);
  console.log(`Audit writes: ${String(output.auditWrites)}`);
  console.log(`Verifier run: ${String(output.verifierRun)}`);
  console.log(`Persistence: ${String(output.persistence)}`);
  console.log(`Filesystem mutation: ${String(output.filesystemMutation)}`);
  console.log(
    `Completed state created: ${String(output.completedStateCreated)}`,
  );
  console.log(`Issues: ${output.issues.length}`);

  for (const issue of output.issues) {
    console.log(formatCliTaskPlanIssue(issue));
  }
}

function taskPlanStatusToProcessExitCode(
  status: CliTaskPlanPlannerIntegrationStatus,
): 0 | 1 {
  return status === "planned" ? 0 : 1;
}

function createTaskStateCliIssue(input: {
  readonly code: string;
  readonly message: string;
  readonly severity?: string;
  readonly category?: string;
}): TaskStateCliIssue {
  return {
    code: input.code,
    message: input.message,
    severity: input.severity ?? "error",
    category: input.category ?? "validation",
  };
}

function createTaskStateCliIssueFromError(error: AeosError): TaskStateCliIssue {
  return createTaskStateCliIssue({
    code: error.code,
    message: error.message,
    category: error.category,
  });
}

function createTaskStateCliError(input: {
  readonly code: string;
  readonly message: string;
  readonly category?: AeosError["category"];
}): AeosError {
  return {
    code: input.code,
    message: input.message,
    category: input.category ?? "validation",
    retryable: false,
  };
}

const taskStateInitSafety: TaskStateInitSafety = {
  taskExecution: false,
  adapterCalls: false,
  auditWrites: false,
  verifierRun: false,
  completedStateCreated: false,
};

function persistedPathForDisplay(path: string): string {
  const cwd = getCwd().replace(/\/+$/, "");

  if (path === cwd) {
    return ".";
  }

  if (path.startsWith(`${cwd}/`)) {
    return path.slice(cwd.length + 1);
  }

  return path;
}

function mapCliTaskPlanIssueToTaskStateIssue(
  issue: CliTaskPlanPlannerIntegrationIssue,
): TaskStateCliIssue {
  return createTaskStateCliIssue({
    code: issue.code,
    message: issue.message,
    severity: issue.severity,
    category: issue.phase,
  });
}

function getPersistedStateIssues(
  state: PersistedTaskState,
): readonly TaskStateCliIssue[] {
  return state.issues.map((issue) =>
    createTaskStateCliIssue({
      code: issue.code,
      message: issue.message,
      severity: issue.severity,
      category: issue.category,
    }),
  );
}

function formatTaskSource(state: PersistedTaskState): string {
  const source = state.sourceTask;

  if (source.path !== undefined && source.id !== undefined) {
    return `${source.kind} ${source.id} (${source.path})`;
  }

  if (source.path !== undefined) {
    return `${source.kind} ${source.path}`;
  }

  if (source.id !== undefined) {
    return `${source.kind} ${source.id}`;
  }

  return source.kind;
}

function createTaskStateInitializationFailure(input: {
  readonly taskId?: string;
  readonly error: AeosError;
  readonly issues?: readonly TaskStateCliIssue[];
}): Extract<TaskStateInitJsonOutput, { readonly ok: false }> {
  const errorIssue = createTaskStateCliIssueFromError(input.error);
  const issues = input.issues ?? [errorIssue];

  return {
    ok: false,
    status: "task_state_initialization_failed",
    taskId: input.taskId ?? "",
    statePath: null,
    error: {
      code: input.error.code,
      message: input.error.message,
      category: input.error.category,
    },
    safety: taskStateInitSafety,
    issues: issues.some((issue) => issue.code === input.error.code)
      ? issues
      : [errorIssue, ...issues],
  };
}

function createTaskStateAlreadyExistsError(): AeosError {
  return createTaskStateCliError({
    code: "task_state_already_exists",
    message: "Persisted task state already exists and was not overwritten.",
    category: "conflict",
  });
}

function createTaskStateInitProofIssues(input: {
  readonly integrationResult: CliTaskPlanPlannerIntegrationResult;
  readonly mappingResult?: TaskContractMappingResult;
  readonly planningResult?: AgenticRunnerPlanningResult;
}): readonly TaskStateCliIssue[] {
  const issues: TaskStateCliIssue[] =
    input.integrationResult.issues.map(mapCliTaskPlanIssueToTaskStateIssue);
  const runnerPlanningInput =
    input.mappingResult?.planningInput.runnerPlanningInput;
  const metadata = runnerPlanningInput?.metadata;
  const verifierRequirements = runnerPlanningInput?.verifierRequirements;

  if (
    input.integrationResult.status !== "planned" ||
    input.planningResult === undefined ||
    input.planningResult.ok !== true
  ) {
    issues.push(
      createTaskStateCliIssue({
        code: "task_state_initialization_planning_not_ready",
        message:
          "Task state initialization requires a successful planned runner result.",
        category: "planner",
      }),
    );
  }

  if (metadata?.noExecution !== true) {
    issues.push(
      createTaskStateCliIssue({
        code: "task_state_initialization_no_execution_not_proven",
        message:
          "Task state initialization requires noExecution proof on the mapped runnerPlanningInput metadata.",
        severity: "critical",
        category: "safety",
      }),
    );
  }

  if (metadata?.noWrites !== true) {
    issues.push(
      createTaskStateCliIssue({
        code: "task_state_initialization_no_writes_not_proven",
        message:
          "Task state initialization requires noWrites proof on the mapped runnerPlanningInput metadata.",
        severity: "critical",
        category: "safety",
      }),
    );
  }

  if (verifierRequirements?.verifierRequired !== true) {
    issues.push(
      createTaskStateCliIssue({
        code: "task_state_initialization_verifier_not_required",
        message:
          "Task state initialization requires verifierRequired proof on the mapped runnerPlanningInput verifier requirements.",
        severity: "critical",
        category: "safety",
      }),
    );
  }

  if (verifierRequirements?.completionGatedByVerifier !== true) {
    issues.push(
      createTaskStateCliIssue({
        code: "task_state_initialization_completion_not_verifier_gated",
        message:
          "Task state initialization requires completionGatedByVerifier proof on the mapped runnerPlanningInput verifier requirements.",
        severity: "critical",
        category: "safety",
      }),
    );
  }

  return issues;
}

function selectTaskStateInitPrimaryIssue(
  issues: readonly TaskStateCliIssue[],
): TaskStateCliIssue | undefined {
  return (
    issues.find(
      (issue) =>
        !issue.code.startsWith("cli_task_plan_") &&
        !issue.code.startsWith("task_state_initialization_"),
    ) ?? issues[0]
  );
}

function mapPlanningIssuesToLifecycleIssues(
  issues: readonly AgenticRunnerPlanningIssue[],
): PersistedTaskState["issues"] {
  return issues.map((issue) => ({
    code: issue.code,
    message: issue.message,
    severity: issue.severity,
    category: issue.category,
    workItemId: issue.workItemId,
    batchId: issue.batchId,
    retryable: issue.retryable,
    createdAt: issue.createdAt,
    metadata: issue.metadata,
  }));
}

function createPlannedInitialTaskState(input: {
  readonly taskFile: string;
  readonly taskId: string;
  readonly planningResult: AgenticRunnerPlanningResult;
  readonly planningResultReference?: PersistedTaskState["plan"]["reference"];
}): PersistedTaskState {
  const createdAt = new Date().toISOString();
  const baseState = createInitialTaskState({
    taskId: input.taskId,
    sourceTaskId: input.taskId,
    sourceTaskPath: input.taskFile,
    verifierRequired: true,
    createdAt,
  });
  const workItems: PersistedTaskState["workItems"] =
    input.planningResult.workItems.map((workItem) => ({
      id: workItem.id,
      source: workItem.sourceId,
      state: workItem.initialState,
      batchId: workItem.batchId,
      expectedArtifacts: workItem.expectedArtifactIds,
      issues: mapPlanningIssuesToLifecycleIssues(workItem.issues),
    }));
  const workItemsById = new Map(workItems.map((workItem) => [workItem.id, workItem]));
  const batches: PersistedTaskState["batches"] =
    input.planningResult.batches.map((batch) => {
      const batchWorkItems = batch.workItemIds
        .map((workItemId) => workItemsById.get(workItemId))
        .filter((workItem): workItem is PersistedTaskState["workItems"][number] =>
          workItem !== undefined,
        );

      return {
        id: batch.id,
        workItemIds: batch.workItemIds,
        expectedItemCount: batch.expectedItemCount,
        completedCount: 0,
        failedCount: batchWorkItems.filter((workItem) => workItem.state === "failed")
          .length,
        skippedCount: batchWorkItems.filter((workItem) => workItem.state === "skipped")
          .length,
        retryableCount: batchWorkItems.filter(
          (workItem) => workItem.state === "retryable",
        ).length,
        issues: mapPlanningIssuesToLifecycleIssues(batch.issues),
      };
    });
  const pendingWorkItemIds = workItems
    .filter((workItem) => workItem.state === "pending")
    .map((workItem) => workItem.id);
  const retryableWorkItemIds = workItems
    .filter((workItem) => workItem.state === "retryable")
    .map((workItem) => workItem.id);
  const remainingIds = new Set([...pendingWorkItemIds, ...retryableWorkItemIds]);
  const nextBatchId =
    input.planningResult.resume?.nextBatchId ??
    batches.find((batch) =>
      batch.workItemIds.some((workItemId) => remainingIds.has(workItemId)),
    )?.id;

  return {
    ...baseState,
    lifecycleState: "planned",
    workItems,
    batches,
    pendingWorkItemIds,
    retryableWorkItemIds,
    nextBatchId,
    plan: {
      status: "planned",
      reference: input.planningResultReference,
      summary: {
        workItemCount: input.planningResult.summary.workItemCount,
        batchCount: input.planningResult.summary.batchCount,
        stepCount: input.planningResult.summary.stepCount,
        verifierRequired: input.planningResult.summary.verifierRequired,
        approvalRequired: input.planningResult.summary.approvalRequired,
        issueCount: input.planningResult.summary.issueCount,
      },
    },
    verifier: {
      required: true,
      status: "required_not_run",
      completionGatedByVerifier: true,
      resultReference: input.planningResultReference,
    },
    completionGate: {
      status: "verification_required",
      satisfied: false,
      completed: false,
      verified: false,
      authority: "system",
      evidenceReferences: [],
    },
    issues: mapPlanningIssuesToLifecycleIssues(input.planningResult.issues),
    updatedAt: createdAt,
  };
}

function createTaskStateInitSuccessJsonOutput(input: {
  readonly state: PersistedTaskState;
  readonly statePath: string;
}): Extract<TaskStateInitJsonOutput, { readonly ok: true }> {
  return {
    ok: true,
    status: "task_state_initialized",
    taskId: input.state.taskId,
    revision: input.state.revision,
    lifecycle: input.state.lifecycleState,
    statePath: persistedPathForDisplay(input.statePath),
    pending: input.state.pendingWorkItemIds.length,
    retryable: input.state.retryableWorkItemIds.length,
    verifierRequired: input.state.verifier.required,
    completionGatedByVerifier: input.state.verifier.completionGatedByVerifier,
    completionGateSatisfied: input.state.completionGate.satisfied,
    safety: taskStateInitSafety,
    issues: [],
  };
}

function printTaskStateInitOutput(output: Extract<TaskStateInitJsonOutput, { ok: true }>): void {
  console.log("Task State Initialized");
  console.log("");
  console.log(`Task id: ${output.taskId}`);
  console.log(`Revision: ${output.revision}`);
  console.log(`Lifecycle: ${output.lifecycle}`);
  console.log(`State: ${output.statePath}`);
  console.log(`Pending: ${output.pending}`);
  console.log(`Retryable: ${output.retryable}`);
  console.log(`Verifier required: ${String(output.verifierRequired)}`);
  console.log(
    `Completion gated by verifier: ${String(output.completionGatedByVerifier)}`,
  );
  console.log("");
  console.log(`Task execution: ${String(output.safety.taskExecution)}`);
  console.log(`Adapter calls: ${String(output.safety.adapterCalls)}`);
  console.log(`Audit writes: ${String(output.safety.auditWrites)}`);
  console.log(`Verifier run: ${String(output.safety.verifierRun)}`);
  console.log(
    `Completed state created: ${String(output.safety.completedStateCreated)}`,
  );
  console.log("");
  console.log(`Issues: ${output.issues.length}`);
}

function printTaskStateInitError(output: Extract<TaskStateInitJsonOutput, { ok: false }>): void {
  console.error("Task State Initialization");
  console.error("Status: failed");
  console.error(`Task id: ${output.taskId}`);
  console.error(`Error: ${output.error.code}`);
  console.error(`Message: ${output.error.message}`);
  console.error("");
  console.error(`Task execution: ${String(output.safety.taskExecution)}`);
  console.error(`Adapter calls: ${String(output.safety.adapterCalls)}`);
  console.error(`Audit writes: ${String(output.safety.auditWrites)}`);
  console.error(`Verifier run: ${String(output.safety.verifierRun)}`);
  console.error(
    `Completed state created: ${String(output.safety.completedStateCreated)}`,
  );
  console.error("");
  console.error(`Issues: ${output.issues.length}`);

  for (const issue of output.issues) {
    console.error(`- ${issue.code}: ${issue.message}`);
  }
}

function createTaskStatusJsonOutput(
  state: PersistedTaskState,
): TaskStatusJsonOutput {
  const resume = createTaskResumeHandoff(state);

  return {
    ok: true,
    status: "loaded",
    taskId: state.taskId,
    revision: state.revision,
    lifecycle: state.lifecycleState,
    state,
    summary: {
      workItemCount: state.workItems.length,
      batchCount: state.batches.length,
      pendingCount: state.pendingWorkItemIds.length,
      retryableCount: state.retryableWorkItemIds.length,
      currentBatchId: state.currentBatchId ?? null,
      nextBatchId: state.nextBatchId ?? null,
      verifierRequired: state.verifier.required,
      completionGatedByVerifier: state.verifier.completionGatedByVerifier,
      resumeAvailable: resume.resumeAllowed,
      issueCount: state.issues.length + resume.issues.length,
    },
    safety: {
      readOnly: true,
      authoritativePersistedState: true,
      executionPerformed: false,
      stateModified: false,
    },
    issues: [...getPersistedStateIssues(state), ...resume.issues.map((issue) =>
      createTaskStateCliIssue({
        code: issue.code,
        message: issue.message,
        severity: issue.severity,
        category: issue.category,
      }),
    )],
  };
}

function createTaskStatusErrorJsonOutput(
  taskId: string,
  error: AeosError,
): TaskStatusJsonOutput {
  return {
    ok: false,
    status: "failed_to_load",
    taskId,
    error: {
      code: error.code,
      message: error.message,
      category: error.category,
    },
    safety: {
      readOnly: true,
      authoritativePersistedState: false,
      executionPerformed: false,
      stateModified: false,
    },
    issues: [createTaskStateCliIssueFromError(error)],
  };
}

function printTaskStatusOutput(state: PersistedTaskState): void {
  const output = createTaskStatusJsonOutput(state);
  const resumeAvailable = createTaskResumeHandoff(state).resumeAllowed;

  console.log("Task Status");
  console.log(`Task id: ${state.taskId}`);
  console.log(`Revision: ${state.revision}`);
  console.log(`Lifecycle: ${state.lifecycleState}`);
  console.log(`Source: ${formatTaskSource(state)}`);
  console.log(`Work items: ${state.workItems.length}`);
  console.log(`Batches: ${state.batches.length}`);
  console.log(`Pending: ${state.pendingWorkItemIds.length}`);
  console.log(`Retryable: ${state.retryableWorkItemIds.length}`);
  console.log(`Current batch: ${state.currentBatchId ?? "none"}`);
  console.log(`Next batch: ${state.nextBatchId ?? "none"}`);
  console.log(`Verifier required: ${String(state.verifier.required)}`);
  console.log(
    `Completion gated by verifier: ${String(
      state.verifier.completionGatedByVerifier,
    )}`,
  );
  console.log(`Resume available: ${String(resumeAvailable)}`);
  console.log(`Issues: ${output.issues.length}`);

  for (const issue of output.issues) {
    console.log(`- ${issue.code}: ${issue.message}`);
  }

  console.log("");
  console.log("Safety:");
  console.log("Authoritative persisted state: true");
  console.log("Execution performed: false");
  console.log("State modified: false");
}

function printTaskStatusError(taskId: string, error: AeosError): void {
  console.error("Task Status");
  console.error(`Task id: ${taskId}`);
  console.error("Status: failed_to_load");
  console.error(`Error: ${error.code}`);
  console.error(`Message: ${error.message}`);
  console.error("Safety:");
  console.error("Authoritative persisted state: false");
  console.error("Execution performed: false");
  console.error("State modified: false");
}

function createTaskResumePreviewJsonOutput(
  handoff: TaskResumeHandoff,
): TaskResumePreviewJsonOutput {
  return {
    ok: true,
    status: "resume_preview_ready",
    taskId: handoff.taskId,
    sourceRevision: handoff.sourceRevision,
    lifecycle: handoff.lifecycleState,
    resume: {
      allowed: handoff.resumeAllowed,
      pendingWorkItemIds: handoff.pendingWorkItemIds,
      retryableWorkItemIds: handoff.retryableWorkItemIds,
      remainingWorkCount: handoff.remainingWorkItemCount,
      currentBatchId: handoff.currentBatchId ?? null,
      nextBatchId: handoff.nextBatchId ?? null,
      verifierRequired: handoff.verifierRequired,
      completionGatedByVerifier: handoff.completionGatedByVerifier,
      blockedReason: handoff.blockedReason ?? null,
    },
    safety: {
      noExecution: true,
      noWrites: true,
      stateModified: false,
    },
    issues: handoff.issues.map((issue) =>
      createTaskStateCliIssue({
        code: issue.code,
        message: issue.message,
        severity: issue.severity,
        category: issue.category,
      }),
    ),
  };
}

function createTaskResumePreviewErrorJsonOutput(
  taskId: string,
  error: AeosError,
  status: Extract<
    TaskResumePreviewJsonOutput,
    { readonly ok: false }
  >["status"] = "failed_to_load",
): TaskResumePreviewJsonOutput {
  return {
    ok: false,
    status,
    taskId,
    error: {
      code: error.code,
      message: error.message,
      category: error.category,
    },
    safety: {
      noExecution: true,
      noWrites: true,
      stateModified: false,
    },
    issues: [createTaskStateCliIssueFromError(error)],
  };
}

function printTaskResumePreviewOutput(handoff: TaskResumeHandoff): void {
  console.log("Task Resume Preview");
  console.log(`Task id: ${handoff.taskId}`);
  console.log(`Source revision: ${handoff.sourceRevision}`);
  console.log(`Lifecycle: ${handoff.lifecycleState}`);
  console.log(`Resume allowed: ${String(handoff.resumeAllowed)}`);
  console.log(`Pending: ${handoff.pendingWorkItemIds.length}`);
  console.log(`Retryable: ${handoff.retryableWorkItemIds.length}`);
  console.log(`Remaining work: ${handoff.remainingWorkItemCount}`);
  console.log(`Current batch: ${handoff.currentBatchId ?? "none"}`);
  console.log(`Next batch: ${handoff.nextBatchId ?? "none"}`);
  console.log(`Verifier required: ${String(handoff.verifierRequired)}`);
  console.log(
    `Completion gated by verifier: ${String(
      handoff.completionGatedByVerifier,
    )}`,
  );
  console.log(`No execution: ${String(handoff.noExecution)}`);
  console.log(`No writes: ${String(handoff.noWrites)}`);
  console.log(`Blocked reason: ${handoff.blockedReason ?? "none"}`);
  console.log(`Issues: ${handoff.issues.length}`);

  for (const issue of handoff.issues) {
    console.log(`- ${issue.code}: ${issue.message}`);
  }
}

function printTaskResumePreviewError(taskId: string, error: AeosError): void {
  console.error("Task Resume Preview");
  console.error(`Task id: ${taskId}`);
  console.error("Status: failed_to_load");
  console.error(`Error: ${error.code}`);
  console.error(`Message: ${error.message}`);
  console.error("No execution: true");
  console.error("No writes: true");
}

async function handleTaskStatus(args: readonly string[]): Promise<void> {
  const json = args.includes("--json");
  const positionalArgs = args.filter((arg) => !arg.startsWith("--"));
  const unknownArgs = args.filter((arg) => arg !== "--json" && arg.startsWith("--"));

  if (unknownArgs.length > 0 || positionalArgs.length > 1) {
    const error = createTaskStateCliError({
      code: "task_status_unknown_option",
      message: "Unknown task status option.",
    });

    if (json) {
      writeTaskStatusJson(createTaskStatusErrorJsonOutput(positionalArgs[0] ?? "", error));
      setExitCode(1);
      return;
    }

    console.error("Error: unknown task status option.");
    console.error("Usage: aeos task status <task-id> [--json]");
    setExitCode(1);
    return;
  }

  const taskId = positionalArgs[0];

  if (taskId === undefined || taskId.trim().length === 0) {
    const error = createTaskStateCliError({
      code: "task_status_task_id_required",
      message: "Task status requires a task id.",
    });

    if (json) {
      writeTaskStatusJson(createTaskStatusErrorJsonOutput("", error));
      setExitCode(1);
      return;
    }

    console.error("Task Status");
    console.error("Error: task id is required.");
    console.error("Usage: aeos task status <task-id> [--json]");
    setExitCode(1);
    return;
  }

  const loadResult = await loadTaskState({
    projectRoot: getCwd(),
    taskId,
  });

  if (!loadResult.ok) {
    if (json) {
      writeTaskStatusJson(createTaskStatusErrorJsonOutput(taskId, loadResult.error));
    } else {
      printTaskStatusError(taskId, loadResult.error);
    }

    setExitCode(1);
    return;
  }

  if (json) {
    writeTaskStatusJson(createTaskStatusJsonOutput(loadResult.value.state));
  } else {
    printTaskStatusOutput(loadResult.value.state);
  }
}

async function handleTaskResume(args: readonly string[]): Promise<void> {
  const json = args.includes("--json");
  const preview = args.includes("--preview");
  const positionalArgs = args.filter((arg) => !arg.startsWith("--"));
  const unknownArgs = args.filter(
    (arg) => arg !== "--json" && arg !== "--preview" && arg.startsWith("--"),
  );

  if (unknownArgs.length > 0 || positionalArgs.length > 1) {
    const error = createTaskStateCliError({
      code: "task_resume_unknown_option",
      message: "Unknown task resume option.",
    });

    if (json) {
      writeTaskResumePreviewJson(
        createTaskResumePreviewErrorJsonOutput(
          positionalArgs[0] ?? "",
          error,
          "invalid_arguments",
        ),
      );
      setExitCode(1);
      return;
    }

    console.error("Error: unknown task resume option.");
    console.error("Usage: aeos task resume --preview <task-id> [--json]");
    setExitCode(1);
    return;
  }

  const taskId = positionalArgs[0];

  if (taskId === undefined || taskId.trim().length === 0) {
    const error = createTaskStateCliError({
      code: "task_resume_task_id_required",
      message: "Task resume preview requires a task id.",
    });

    if (json) {
      writeTaskResumePreviewJson(
        createTaskResumePreviewErrorJsonOutput("", error, "invalid_arguments"),
      );
      setExitCode(1);
      return;
    }

    console.error("Task Resume Preview");
    console.error("Error: task id is required.");
    console.error("Usage: aeos task resume --preview <task-id> [--json]");
    setExitCode(1);
    return;
  }

  if (!preview) {
    const error = createTaskStateCliError({
      code: "task_resume_execution_not_implemented",
      message:
        "Task resume execution is not implemented; use --preview for a read-only persisted-state preview.",
    });

    if (json) {
      writeTaskResumePreviewJson(
        createTaskResumePreviewErrorJsonOutput(
          taskId,
          error,
          "task_resume_execution_not_implemented",
        ),
      );
      setExitCode(1);
      return;
    }

    console.error("Task Resume");
    console.error("Error: task_resume_execution_not_implemented");
    console.error(error.message);
    setExitCode(1);
    return;
  }

  const handoffResult = await loadTaskResumeHandoff({
    projectRoot: getCwd(),
    taskId,
  });

  if (!handoffResult.ok) {
    if (json) {
      writeTaskResumePreviewJson(
        createTaskResumePreviewErrorJsonOutput(taskId, handoffResult.error),
      );
    } else {
      printTaskResumePreviewError(taskId, handoffResult.error);
    }

    setExitCode(1);
    return;
  }

  if (json) {
    writeTaskResumePreviewJson(
      createTaskResumePreviewJsonOutput(handoffResult.value.handoff),
    );
  } else {
    printTaskResumePreviewOutput(handoffResult.value.handoff);
  }
}

async function handleTaskState(args: readonly string[]): Promise<void> {
  const subcommand = args[0];
  const initArgs = args.slice(1);
  const json = initArgs.includes("--json");

  if (subcommand !== "init") {
    const error = createTaskStateCliError({
      code: "task_state_unknown_command",
      message: "Unknown task state command.",
    });
    const output = createTaskStateInitializationFailure({ error });

    if (json) {
      writeTaskStateInitJson(output);
      setExitCode(1);
      return;
    }

    console.error("Error: unknown task state command.");
    console.error("Usage: aeos task state init <task-file> [--json]");
    setExitCode(1);
    return;
  }

  const positionalArgs = initArgs.filter((arg) => !arg.startsWith("--"));
  const unknownArgs = initArgs.filter((arg) => arg !== "--json" && arg.startsWith("--"));

  if (unknownArgs.length > 0 || positionalArgs.length > 1) {
    const error = createTaskStateCliError({
      code: "task_state_init_unknown_option",
      message: "Unknown task state init option.",
    });
    const output = createTaskStateInitializationFailure({
      taskId: "",
      error,
    });

    if (json) {
      writeTaskStateInitJson(output);
      setExitCode(1);
      return;
    }

    printTaskStateInitError(output);
    console.error("Usage: aeos task state init <task-file> [--json]");
    setExitCode(1);
    return;
  }

  const taskFile = positionalArgs[0];

  if (taskFile === undefined || taskFile.trim().length === 0) {
    const error = createTaskStateCliError({
      code: "task_state_init_task_file_required",
      message: "Task state initialization requires a task file path.",
    });
    const output = createTaskStateInitializationFailure({
      taskId: "",
      error,
    });

    if (json) {
      writeTaskStateInitJson(output);
      setExitCode(1);
      return;
    }

    printTaskStateInitError(output);
    console.error("Usage: aeos task state init <task-file> [--json]");
    setExitCode(1);
    return;
  }

  try {
    const parserRequest = createTaskPlanInputRequest(taskFile);
    const parserResult = await parseTaskPlanInputFile(parserRequest);
    const integrationResult = createTaskPlanIntegrationResult({
      taskFile,
      json,
      argv: ["task", "state", "init", ...initArgs],
      command: ["task", "state", "init"],
      parserRequest,
      parserResult,
    });
    const mappingResult = integrationResult.mapping.mappingResult;
    const planningResult = integrationResult.planner.planningResult;
    const proofIssues = createTaskStateInitProofIssues({
      integrationResult,
      mappingResult,
      planningResult,
    });
    const taskId =
      integrationResult.taskId ??
      mappingResult?.taskId ??
      parserResult.validation.taskId ??
      "";

    if (proofIssues.length > 0 || planningResult === undefined) {
      const primaryIssue = selectTaskStateInitPrimaryIssue(proofIssues);
      const error = createTaskStateCliError({
        code: primaryIssue?.code ?? "task_state_initialization_blocked",
        message:
          primaryIssue?.message ??
          "Task state initialization was blocked before persistence.",
        category: "validation",
      });
      const output = createTaskStateInitializationFailure({
        taskId,
        error,
        issues: proofIssues,
      });

      if (json) {
        writeTaskStateInitJson(output);
      } else {
        printTaskStateInitError(output);
      }

      setExitCode(1);
      return;
    }

    const existingStateResult = await loadTaskState({
      projectRoot: getCwd(),
      taskId,
    });

    if (existingStateResult.ok) {
      const error = createTaskStateAlreadyExistsError();
      const output = createTaskStateInitializationFailure({
        taskId,
        error,
      });

      if (json) {
        writeTaskStateInitJson(output);
      } else {
        printTaskStateInitError(output);
      }

      setExitCode(1);
      return;
    }

    if (existingStateResult.error.code !== "task_state_not_found") {
      const output = createTaskStateInitializationFailure({
        taskId,
        error: existingStateResult.error,
      });

      if (json) {
        writeTaskStateInitJson(output);
      } else {
        printTaskStateInitError(output);
      }

      setExitCode(1);
      return;
    }

    const state = createPlannedInitialTaskState({
      taskFile,
      taskId,
      planningResult,
      planningResultReference: integrationResult.planner.planningResultReference,
    });
    const saveResult = await saveTaskState({
      projectRoot: getCwd(),
      state,
    });

    if (!saveResult.ok) {
      const mappedError =
        saveResult.error.code === "task_state_revision_required"
          ? createTaskStateAlreadyExistsError()
          : saveResult.error;
      const output = createTaskStateInitializationFailure({
        taskId,
        error: mappedError,
      });

      if (json) {
        writeTaskStateInitJson(output);
      } else {
        printTaskStateInitError(output);
      }

      setExitCode(1);
      return;
    }

    const output = createTaskStateInitSuccessJsonOutput({
      state: saveResult.value.state,
      statePath: saveResult.value.path,
    });

    if (json) {
      writeTaskStateInitJson(output);
    } else {
      printTaskStateInitOutput(output);
    }
  } catch {
    const error = createTaskStateCliError({
      code: "task_state_initialization_failed",
      message: "Task state initialization failed.",
      category: "unknown",
    });
    const output = createTaskStateInitializationFailure({ error });

    if (json) {
      writeTaskStateInitJson(output);
      setExitCode(1);
      return;
    }

    printTaskStateInitError(output);
    setExitCode(1);
  }
}

function printVersion(): void {
  console.log(versionText);
}

function printHelp(): void {
  console.log(helpText);
}

function printRememberFailure(reason?: string): void {
  console.log("Memory: fail");

  if (reason !== undefined) {
    console.log(`Reason: ${reason}`);
  }
}

function isMemoryType(value: string): value is MemoryType {
  return (memoryTypes as readonly string[]).includes(value);
}

function printSearchFailure(reason?: string): void {
  console.log("Search Results");

  if (reason !== undefined) {
    console.log(`Reason: ${reason}`);
  }
}

function formatPresence(present: boolean): "present" | "missing" {
  return present ? "present" : "missing";
}

function formatValidationStatus(status: ProjectValidationStatus): string {
  return status.toUpperCase();
}

function formatSignalList<TSignal>(
  signals: readonly TSignal[],
  getValue: (signal: TSignal) => string,
): string {
  const values = [...new Set(signals.map(getValue))]
    .sort((left, right) => left.localeCompare(right));

  return values.length === 0 ? "unknown" : values.join(", ");
}

function formatProjectProfileIssue(
  issue: ProjectIntelligenceDetectorIssue,
): string {
  const path = issue.path === undefined ? "" : `: ${issue.path}`;

  return `- ${issue.severity} ${issue.code}${path}`;
}

function printProjectProfileResult(
  result: ProjectIntelligenceDetectorOrchestratorResult,
): void {
  const profile = result.profile;
  const monorepo = profile.monorepo.isMonorepo
    ? `yes (${profile.monorepo.kind})`
    : "no";

  console.log("Project Profile");
  console.log(`Root: ${profile.projectRoot}`);
  console.log(
    `Languages: ${formatSignalList(profile.languages, (signal) => signal.language)}`,
  );
  console.log(
    `Frameworks: ${formatSignalList(profile.frameworks, (signal) => signal.framework)}`,
  );
  console.log(
    `Package managers: ${formatSignalList(
      profile.packageManagers,
      (signal) => signal.packageManager,
    )}`,
  );
  console.log(
    `Runtimes: ${formatSignalList(profile.runtimes, (signal) => signal.runtime)}`,
  );
  console.log(
    `Infrastructure: ${formatSignalList(
      profile.infrastructure,
      (signal) => signal.infrastructure,
    )}`,
  );
  console.log(`Monorepo: ${monorepo}`);
  console.log(`Evidence count: ${result.summary.evidenceCount}`);
  console.log(`Issue count: ${result.summary.issueCount}`);

  if (result.issues.length === 0) {
    return;
  }

  console.log("Issues:");
  for (const issue of result.issues) {
    console.log(formatProjectProfileIssue(issue));
  }
}

function toSmartSelectionConfidence(
  value: string,
): SmartTemplateSelectionConfidence {
  return value === "high" ||
    value === "medium" ||
    value === "low" ||
    value === "unknown"
    ? value
    : "unknown";
}

function createTemplateRecommendProfile(
  profile: ProjectIntelligenceProfile,
): SmartTemplateSelectionProfile {
  return {
    projectRoot: profile.projectRoot,
    summary: {
      confidence: toSmartSelectionConfidence(profile.summary.confidence),
      primaryLanguage: profile.summary.primaryLanguage,
      primaryFramework: profile.summary.primaryFramework,
      primaryPackageManager: profile.summary.primaryPackageManager,
      primaryRuntime: profile.summary.primaryRuntime,
      hasInfrastructure: profile.summary.hasInfrastructure,
      isMonorepo: profile.summary.isMonorepo,
    },
    evidenceIds: profile.evidence.map((item) => item.id),
    issueCodes: profile.issues.map((issue) => issue.code),
  };
}

function createTemplateRecommendJsonOutput(
  result: SmartTemplateSelectionResult,
): TemplateRecommendJsonOutput {
  const evidenceCount =
    result.summary.evidenceCount ??
    result.candidates.reduce(
      (total, candidate) => total + candidate.evidence.ruleIds.length,
      result.recommendation.evidence.ruleIds.length,
    );

  return {
    ok: true,
    projectRoot: result.projectRoot,
    mode: "recommend",
    recommendation: result.recommendation,
    candidates: result.candidates,
    fallbackUsed: result.fallbackUsed,
    issues: result.issues,
    summary: {
      candidateCount: result.summary.candidateCount,
      evidenceCount,
      issueCount: result.summary.issueCount,
      selectedTemplateId: result.summary.selectedTemplateId ?? null,
      fallback: result.summary.fallback,
      fallbackUsed: result.fallbackUsed,
      confidence: result.summary.confidence,
    },
  };
}

function getTemplateRecommendReasonLines(
  result: SmartTemplateSelectionResult,
): readonly string[] {
  const lines = [
    ...result.recommendation.evidence.ruleIds,
    ...result.recommendation.evidence.reducedByIssueCodes,
    ...result.recommendation.issues.map((issue) => issue.code),
  ];

  return [...new Set(lines)].filter((line) => line.trim().length > 0).slice(0, 6);
}

function printTemplateRecommendResult(result: SmartTemplateSelectionResult): void {
  const selected = result.recommendation.fallbackUsed
    ? `fallback ${result.recommendation.fallback}`
    : result.recommendation.selectedCandidate?.templateId ?? "unknown";
  const evidenceCount =
    result.summary.evidenceCount ??
    result.candidates.reduce(
      (total, candidate) => total + candidate.evidence.ruleIds.length,
      result.recommendation.evidence.ruleIds.length,
    );

  console.log("Template Recommendation");
  console.log(`Project root: ${result.projectRoot}`);
  console.log(`Selected template: ${selected}`);
  console.log(`Confidence: ${result.recommendation.confidence}`);
  console.log(`Fallback used: ${String(result.recommendation.fallbackUsed)}`);
  console.log(`Candidate count: ${result.candidates.length}`);
  console.log(`Evidence count: ${evidenceCount}`);
  console.log(`Issue count: ${result.issues.length}`);

  const reasons = getTemplateRecommendReasonLines(result);

  if (reasons.length > 0) {
    console.log("Reasons:");
    for (const reason of reasons) {
      console.log(`- ${reason}`);
    }
  }

  if (result.issues.length > 0) {
    console.log("Issues:");
    for (const issue of result.issues.slice(0, 6)) {
      console.log(`- ${issue.severity} ${issue.code}`);
    }
  }
}

async function handleTemplateRecommend(args: readonly string[]): Promise<void> {
  const json = args.includes("--json");
  const unknownArgs = args.filter((arg) => arg !== "--json");
  const projectRoot = getCwd();

  if (unknownArgs.length > 0) {
    if (json) {
      writeTemplateRecommendJson({
        ok: false,
        projectRoot,
        mode: "recommend",
        recommendation: null,
        candidates: [],
        fallbackUsed: true,
        issues: [],
        summary: null,
        reason: "template_recommend_failed",
      });
      setExitCode(1);
      return;
    }

    console.error("Error: unknown template recommend option.");
    console.error("Usage: aeos template recommend [--json]");
    setExitCode(1);
    return;
  }

  try {
    const projects = await loadProjectsPackage();
    const templates = await loadTemplatesPackage();
    const detectorResult = await projects.detectProjectIntelligence(
      createProjectProfileDetectorInput(projects, projectRoot),
    );
    const selectionResult = templates.selectSmartTemplate({
      projectRoot: detectorResult.profile.projectRoot,
      profile: createTemplateRecommendProfile(detectorResult.profile),
      candidates: templates.listBuiltInSmartTemplateCandidates(),
      mode: "recommend",
      fallback: "minimal_agents",
      options: {
        includeCandidates: true,
        includeEvidence: true,
      },
    });

    if (json) {
      writeTemplateRecommendJson(createTemplateRecommendJsonOutput(selectionResult));
      return;
    }

    printTemplateRecommendResult(selectionResult);
  } catch {
    if (json) {
      writeTemplateRecommendJson({
        ok: false,
        projectRoot,
        mode: "recommend",
        recommendation: null,
        candidates: [],
        fallbackUsed: true,
        issues: [],
        summary: null,
        reason: "template_recommend_failed",
      });
      setExitCode(1);
      return;
    }

    console.error("Template Recommendation");
    console.error("Error: template recommendation failed.");
    setExitCode(1);
  }
}

type InitCliMode = "dry_run" | "write";

type InitCliStatus = "success" | "blocked" | "failure";

type InitOutputContext = {
  readonly mode: InitCliMode;
  readonly writeEnabled: boolean;
};

function getInitConflicts(result: InitResult): readonly InitIssue[] {
  return result.errors.filter((issue) => isInitConflictIssue(issue));
}

function isInitConflictIssue(issue: InitIssue): boolean {
  return (
    issue.code.includes("conflict") ||
    issue.code.includes("target_exists") ||
    issue.code.includes("overwrite_disabled") ||
    issue.code.includes("target_is_directory") ||
    issue.code.includes("parent_is_file") ||
    issue.code.includes("target_outside_root") ||
    issue.code.includes("duplicate_target") ||
    issue.code.includes("inspection_failed")
  );
}

function formatInitStatus(
  result: InitResult,
  conflicts: readonly InitIssue[],
): InitCliStatus {
  if (result.ok) {
    return "success";
  }

  return conflicts.length > 0 ? "blocked" : "failure";
}

function printInitResult(result: InitResult, output: InitOutputContext): void {
  const conflicts = getInitConflicts(result);
  const status = formatInitStatus(result, conflicts);

  console.log("AEOS Init");
  console.log("");
  console.log("Mode:");
  console.log(output.mode);
  console.log("");
  console.log("Write enabled:");
  console.log(String(output.writeEnabled));
  console.log("");
  console.log("Target root:");
  console.log(result.projectRoot);
  console.log("");
  console.log("Status:");
  console.log(status);
  console.log("");
  console.log("Stages:");

  for (const stage of initStages) {
    console.log(`- ${stage}`);
  }

  console.log("");
  console.log("Artifacts:");
  console.log(String(result.generatedFiles.length));
  console.log("");
  console.log("Generated files:");

  if (result.generatedFiles.length === 0) {
    console.log("0");
  } else {
    for (const file of result.generatedFiles) {
      console.log(`- ${file.status} ${file.path}`);
    }
  }

  console.log("");
  console.log("Generated files count:");
  console.log(String(result.generatedFiles.length));
  console.log("");
  console.log("Conflicts count:");
  console.log(String(conflicts.length));
  console.log("");
  console.log("Errors count:");
  console.log(String(result.errors.length));

  if (result.errors.length > 0) {
    console.log("");
    console.log("Errors:");

    for (const error of result.errors) {
      const path = error.path === undefined ? "" : ` (${error.path})`;
      console.log(`- ${error.code}: ${error.message}${path}`);
    }
  }
}

function createInitJsonOutput(
  result: InitResult,
  output: InitOutputContext,
): InitJsonOutput {
  const generatedFiles = result.generatedFiles.map((file) => ({
    path: file.path,
    status: file.status,
    summary: file.summary,
    sourcePath: file.sourcePath,
  }));
  const conflicts = getInitConflicts(result);
  const status = formatInitStatus(result, conflicts);

  if (!result.ok) {
    return {
      ok: false,
      mode: output.mode,
      writeEnabled: output.writeEnabled,
      status,
      targetRoot: result.projectRoot,
      generatedFiles,
      conflicts,
      errors: result.errors,
    };
  }

  return {
    ok: true,
    mode: output.mode,
    writeEnabled: output.writeEnabled,
    status,
    targetRoot: result.projectRoot,
    generatedFiles,
    conflicts,
    errors: result.errors,
    stages: initStages,
    artifacts: generatedFiles,
  };
}

function requireInitWriteArtifacts(
  result: InitResult,
  output: InitOutputContext,
): InitResult {
  if (!output.writeEnabled || !result.ok) {
    return result;
  }

  if (result.generatedFiles.some((file) => file.status === "created")) {
    return result;
  }

  const noCreatedFilesIssue: InitIssue =
    result.generatedFiles.length === 0
      ? {
          code: "init_no_writable_artifacts",
          message: "No writable init artifacts are available yet.",
        }
      : {
          code: "init_write_no_created_files",
          message: "Write mode completed without creating generated files.",
        };
  const hasNoCreatedFilesIssue = result.errors.some(
    (issue) => issue.code === noCreatedFilesIssue.code,
  );

  return {
    ...result,
    ok: false,
    errors: hasNoCreatedFilesIssue
      ? result.errors
      : [...result.errors, noCreatedFilesIssue],
  };
}

async function handleInit(args: readonly string[]): Promise<void> {
  const json = args.includes("--json");
  const writeRequested = args.includes("--write");
  const unknownArgs = args.filter((arg) => arg !== "--json" && arg !== "--write");

  if (unknownArgs.length > 0) {
    if (json) {
      writeInitJson({
        ok: false,
        mode: writeRequested ? "write" : "dry_run",
        writeEnabled: writeRequested,
        status: "failure",
        targetRoot: getCwd(),
        generatedFiles: [],
        conflicts: [],
        errors: [
          {
            code: "init_unknown_option",
            message: "Unknown init option.",
          },
        ],
      });
      setExitCode(1);
      return;
    }

    console.error("Error: unknown init option.");
    console.error("Usage: aeos init [--json] [--write]");
    setExitCode(1);
    return;
  }

  const targetRoot = getCwd();
  const output: InitOutputContext = {
    mode: writeRequested ? "write" : "dry_run",
    writeEnabled: writeRequested,
  };

  const result = requireInitWriteArtifacts(await runInitPipeline({
    projectRoot: targetRoot,
    template: {
      templateId: "default",
    },
    variables: {},
  }, undefined, {
    generation: writeRequested
      ? {
          writeMode: "write",
          fileSystemAdapter: createFilesystemGenerationAdapter({ targetRoot }),
        }
      : undefined,
  }), output);

  if (json) {
    writeInitJson(createInitJsonOutput(result, output));
  } else {
    printInitResult(result, output);
  }

  if (!result.ok) {
    setExitCode(1);
  }
}

function buildProjectValidationResult(
  rootResult: ProjectRootDetectionResult,
  metadata: ProjectMetadata | undefined,
): ProjectValidationResult {
  const checks: ProjectValidationCheck[] = [];
  const issues: ProjectValidationIssue[] = [];

  if (!rootResult.ok) {
    checks.push({
      name: "project_root",
      status: "fail",
      message: "Project root could not be detected.",
    });
    issues.push({
      code: rootResult.error.code,
      message: "Project root could not be detected.",
      path: rootResult.error.startPath,
    });

    return {
      status: "fail",
      root: undefined,
      checks,
      issues,
    };
  }

  checks.push({
    name: "project_root",
    status: "pass",
    message: "Project root detected.",
  });

  if (metadata === undefined) {
    checks.push({
      name: "package_metadata",
      status: "fail",
      message: "Project metadata could not be read.",
    });
    issues.push({
      code: "package_metadata_unreadable",
      message: "Project metadata could not be read.",
      path: rootResult.rootPath,
    });

    return {
      status: "fail",
      root: rootResult.rootPath,
      checks,
      issues,
    };
  }

  if (!metadata.package.exists) {
    checks.push({
      name: "package_metadata",
      status: "warn",
      message: "package.json is missing.",
    });
    issues.push({
      code: "package_metadata_missing",
      message: "package.json is missing.",
      path: metadata.package.path,
    });
  } else if (
    metadata.package.name === undefined
  ) {
    checks.push({
      name: "package_metadata",
      status: "fail",
      message: "package.json exists but package name could not be read.",
    });
    issues.push({
      code: "package_metadata_unreadable",
      message: "package.json exists but package name could not be read.",
      path: metadata.package.path,
    });
  } else {
    checks.push({
      name: "package_metadata",
      status: "pass",
      message: "package.json metadata is readable.",
    });
  }

  checks.push({
    name: "project_context",
    status: metadata.hasProjectContext ? "pass" : "fail",
    message: metadata.hasProjectContext
      ? "PROJECT_CONTEXT.md is present."
      : "PROJECT_CONTEXT.md is missing.",
  });
  if (!metadata.hasProjectContext) {
    issues.push({
      code: "missing_project_context",
      message: "PROJECT_CONTEXT.md is missing.",
      path: metadata.context.path,
    });
  }

  checks.push({
    name: "agents_file",
    status: metadata.hasAgents ? "pass" : "fail",
    message: metadata.hasAgents ? "AGENTS.md is present." : "AGENTS.md is missing.",
  });
  if (!metadata.hasAgents) {
    issues.push({
      code: "missing_agents",
      message: "AGENTS.md is missing.",
      path: metadata.agents.path,
    });
  }

  checks.push({
    name: "workspace_marker",
    status: metadata.hasWorkspace ? "pass" : "fail",
    message: metadata.hasWorkspace
      ? "pnpm-workspace.yaml is present."
      : "pnpm-workspace.yaml is missing.",
  });
  if (!metadata.hasWorkspace) {
    issues.push({
      code: "missing_workspace_marker",
      message: "pnpm-workspace.yaml is missing.",
    });
  }

  const consistent =
    metadata.projectRoot === rootResult.rootPath &&
    metadata.hasProjectContext === metadata.context.exists &&
    metadata.hasAgents === metadata.agents.exists;

  checks.push({
    name: "consistency",
    status: consistent ? "pass" : "fail",
    message: consistent
      ? "Project metadata is internally consistent."
      : "Detected root and metadata presence flags are inconsistent.",
  });
  if (!consistent) {
    issues.push({
      code: "project_metadata_inconsistent",
      message: "Detected root and metadata presence flags are inconsistent.",
      path: metadata.projectRoot,
    });
  }

  const hasFailure = checks.some((check) => check.status === "fail");
  const hasWarning = checks.some((check) => check.status === "warn");

  return {
    status: hasFailure ? "fail" : hasWarning ? "warn" : "pass",
    root: metadata.projectRoot,
    checks,
    issues,
  };
}

function printProjectValidationResult(result: ProjectValidationResult): void {
  console.log("Project Validation");
  console.log("");
  console.log(`Status: ${formatValidationStatus(result.status)}`);
  console.log(`Root: ${result.root ?? "unknown"}`);
  console.log("");
  console.log("Checks:");

  for (const check of result.checks) {
    console.log(`${formatValidationStatus(check.status)} ${check.name}`);
  }

  if (result.issues.length === 0) {
    console.log("");
    console.log("Summary: all checks passed");
    return;
  }

  console.log("");
  console.log("Issues:");
  for (const issue of result.issues) {
    const path = issue.path === undefined ? "" : ` (${issue.path})`;
    console.log(`${formatValidationStatus(issue.code === "package_metadata_missing" ? "warn" : "fail")} ${issue.code}: ${issue.message}${path}`);
  }

  console.log("");
  console.log(
    `Summary: ${result.issues.length} issue${result.issues.length === 1 ? "" : "s"} found`,
  );
}

async function handleProjectStatus(args: readonly string[]): Promise<void> {
  const json = args.includes("--json");
  const projects = await loadProjectsPackage();
  const rootResult = projects.detectProjectRoot(getCwd());

  if (!rootResult.ok) {
    if (json) {
      writeProjectStatusJson({
        ok: false,
        reason: "project_root_not_found",
      });
      setExitCode(1);
      return;
    }

    console.error("Project Status");
    console.error(`Error: ${rootResult.error.code}`);
    console.error(`Path: ${rootResult.error.startPath}`);
    setExitCode(1);
    return;
  }

  const metadata = projects.readProjectMetadata(rootResult.rootPath);

  if (json) {
    writeProjectStatusJson({
      ok: true,
      root: metadata.projectRoot,
      packageName: metadata.packageName ?? "",
      version: metadata.packageVersion ?? "",
      projectContextPresent: metadata.hasProjectContext,
      agentsPresent: metadata.hasAgents,
      workspacePresent: metadata.hasWorkspace,
    });
    return;
  }

  console.log("Project Status");
  console.log("");
  console.log("Root:");
  console.log(metadata.projectRoot);
  console.log("");
  console.log("Package:");
  console.log(metadata.packageName ?? "unknown");
  console.log("");
  console.log("Version:");
  console.log(metadata.packageVersion ?? "unknown");
  console.log("");
  console.log("Project Context:");
  console.log(formatPresence(metadata.hasProjectContext));
  console.log("");
  console.log("Agents:");
  console.log(formatPresence(metadata.hasAgents));
  console.log("");
  console.log("Workspace:");
  console.log(formatPresence(metadata.hasWorkspace));
}

async function handleProjectContext(args: readonly string[]): Promise<void> {
  const json = args.includes("--json");
  const projects = await loadProjectsPackage();
  const rootResult = projects.detectProjectRoot(getCwd());

  if (!rootResult.ok) {
    if (json) {
      writeProjectContextJson({
        ok: false,
        reason: "project_root_not_found",
      });
      setExitCode(1);
      return;
    }

    console.error("Project Context");
    console.error(`Error: ${rootResult.error.code}`);
    console.error(`Path: ${rootResult.error.startPath}`);
    setExitCode(1);
    return;
  }

  const metadata = projects.readProjectMetadata(rootResult.rootPath);
  const projectName =
    metadata.projectName ?? metadata.packageName ?? "unknown";

  if (json) {
    const fs = getFs();
    const context = metadata.hasProjectContext
      ? fs.readFileSync(metadata.context.path, "utf8")
      : "";

    writeProjectContextJson({
      ok: true,
      root: metadata.projectRoot,
      project: projectName,
      contextPresent: metadata.hasProjectContext,
      agentsPresent: metadata.hasAgents,
      context,
    });
    return;
  }

  console.log("Project Context");
  console.log("");
  console.log("Root:");
  console.log(metadata.projectRoot);
  console.log("");
  console.log("Project:");
  console.log(projectName);
  console.log("");
  console.log("Context:");
  console.log(formatPresence(metadata.hasProjectContext));
  console.log("");
  console.log("Agents:");
  console.log(formatPresence(metadata.hasAgents));
  console.log("");
  console.log("Current Context:");
  console.log(
    metadata.hasProjectContext
      ? `Project context for ${projectName}.`
      : "missing",
  );
}

async function handleProjectValidate(args: readonly string[]): Promise<void> {
  const json = args.includes("--json");
  const unknownArgs = args.filter((arg) => arg !== "--json");

  if (unknownArgs.length > 0) {
    if (json) {
      writeProjectValidationJson({
        ok: false,
        valid: false,
        reason: "project_root_not_found",
        checks: [],
      });
      setExitCode(1);
      return;
    }

    console.error("Error: unknown project validate option.");
    console.error("Usage: aeos project validate [--json]");
    setExitCode(1);
    return;
  }

  const projects = await loadProjectsPackage();
  const rootResult = projects.detectProjectRoot(getCwd());

  if (!rootResult.ok && json) {
    writeProjectValidationJson({
      ok: false,
      valid: false,
      reason: "project_root_not_found",
      checks: [],
    });
    setExitCode(1);
    return;
  }

  const metadata = rootResult.ok
    ? projects.readProjectMetadata(rootResult.rootPath)
    : undefined;
  const result = buildProjectValidationResult(rootResult, metadata);

  if (json) {
    writeProjectValidationJson({
      ok: true,
      valid: result.status !== "fail",
      checks: getProjectValidationJsonChecks(result.checks),
    });

    if (result.status === "fail") {
      setExitCode(1);
    }

    return;
  }

  printProjectValidationResult(result);

  if (result.status === "fail") {
    setExitCode(1);
  }
}

function createProjectProfileDetectorInput(
  projects: ProjectsPackage,
  projectRoot: string,
): ProjectIntelligenceDetectorInput {
  const input = projects.createDefaultProjectIntelligenceDetectorInput(projectRoot);

  return {
    ...input,
    mode: "profile",
    scope: "bounded_workspace",
    options: {
      ...input.options,
      includeHiddenFiles: false,
      followSymlinks: false,
      includeLockfiles: true,
      includeInfrastructure: true,
      includeMonorepoSignals: true,
      includeDependencySignals: false,
    },
  };
}

async function handleProjectProfile(args: readonly string[]): Promise<void> {
  const json = args.includes("--json");
  const unknownArgs = args.filter((arg) => arg !== "--json");
  const projectRoot = getCwd();

  if (unknownArgs.length > 0) {
    if (json) {
      writeProjectProfileJson({
        ok: false,
        projectRoot,
        profile: null,
        scannedEntries: [],
        issues: [],
        summary: null,
        reason: "project_profile_failed",
      });
      setExitCode(1);
      return;
    }

    console.error("Error: unknown project profile option.");
    console.error("Usage: aeos project profile [--json]");
    setExitCode(1);
    return;
  }

  try {
    const projects = await loadProjectsPackage();
    const result = await projects.detectProjectIntelligence(
      createProjectProfileDetectorInput(projects, projectRoot),
    );

    if (json) {
      writeProjectProfileJson({
        ok: true,
        projectRoot: result.profile.projectRoot,
        profile: result.profile,
        scannedEntries: result.scannedEntries,
        issues: result.issues,
        summary: result.summary,
      });
      return;
    }

    printProjectProfileResult(result);
  } catch {
    if (json) {
      writeProjectProfileJson({
        ok: false,
        projectRoot,
        profile: null,
        scannedEntries: [],
        issues: [],
        summary: null,
        reason: "project_profile_failed",
      });
      setExitCode(1);
      return;
    }

    console.error("Project Profile");
    console.error("Error: project profile detection failed.");
    setExitCode(1);
  }
}

function readFlagValue(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);

  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}

function readRepeatedFlagValues(args: readonly string[], flag: string): readonly string[] {
  const values: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === flag && args[index + 1] !== undefined) {
      values.push(args[index + 1]);
    }
  }

  return values;
}

function readSearchQuery(args: readonly string[]): string | undefined {
  const flagsWithValues = new Set(["--type", "--tag"]);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (flagsWithValues.has(arg)) {
      index += 1;
      continue;
    }

    if (!arg.startsWith("--")) {
      return arg;
    }
  }

  return undefined;
}

function createRememberEntry(input: {
  readonly type: MemoryType;
  readonly title: string;
  readonly tags: readonly string[];
}): MemoryEntry {
  const now = new Date().toISOString();
  const title = input.title.trim();
  const tags = input.tags
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

  return {
    id: createMemoryId(input.type, title, tags),
    frontmatter: {
      type: input.type,
      title,
      date: now,
      sourceTask: "unknown",
      status: "draft",
      tags,
    },
    summary: title,
    sections: [
      {
        heading: "Details",
        content: title,
        order: 1,
      },
    ],
    redactionStatus: "not_required",
    createdAt: now,
    updatedAt: now,
  };
}

function createMemoryId(
  type: MemoryType,
  title: string,
  tags: readonly string[],
): string {
  const seed = [type, title, ...tags].join("|");
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(31, hash) + seed.charCodeAt(index);
    hash |= 0;
  }

  const slug = title
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const hashSegment = (hash >>> 0).toString(36);

  return `${type}-${slug.length > 0 ? slug : "memory"}-${hashSegment}`;
}

async function handleRemember(args: readonly string[]): Promise<void> {
  const json = args.includes("--json");
  const typeInput = readFlagValue(args, "--type");
  const titleInput = readFlagValue(args, "--title");
  const tags = readRepeatedFlagValues(args, "--tag");

  if (typeInput === undefined || typeInput.trim().length === 0) {
    if (json) {
      writeRememberJson({
        ok: false,
        reason: "missing_type",
        persisted: false,
        issues: [],
      });
      setExitCode(1);
      return;
    }

    printRememberFailure("missing memory type");
    console.log("Usage: aeos remember --type <type> --title <title>");
    setExitCode(1);
    return;
  }

  if (!isMemoryType(typeInput)) {
    if (json) {
      writeRememberJson({
        ok: false,
        reason: "invalid_memory_type",
        persisted: false,
        issues: [],
      });
      setExitCode(1);
      return;
    }

    printRememberFailure("invalid memory type");
    console.log(`Type: ${typeInput}`);
    setExitCode(1);
    return;
  }

  if (titleInput === undefined || titleInput.trim().length === 0) {
    if (json) {
      writeRememberJson({
        ok: false,
        reason: "missing_title",
        persisted: false,
        issues: [],
      });
      setExitCode(1);
      return;
    }

    printRememberFailure("missing memory title");
    console.log("Usage: aeos remember --type <type> --title <title>");
    setExitCode(1);
    return;
  }

  const entry = createRememberEntry({
    type: typeInput,
    title: titleInput,
    tags,
  });
  const memory = await loadMemoryPackage();
  const validation = memory.validateMemoryEntry(entry);

  if (!validation.valid) {
    if (json) {
      writeRememberJson({
        ok: false,
        reason: "validation_failed",
        persisted: false,
        issues: validation.issues,
      });
      setExitCode(1);
      return;
    }

    printRememberFailure();

    for (const issue of validation.issues) {
      console.log(formatMemoryIssue(issue));
    }

    setExitCode(1);
    return;
  }

  const content = memory.buildMemoryMarkdownEntry(entry);
  const writeRequest = memory.createMemoryWriteRequest(entry, {
    rootPath: ".aeos/memory",
    collectionPath: entry.frontmatter.type,
  });

  if (!writeRequest.ok) {
    if (json) {
      writeRememberJson({
        ok: false,
        reason: "validation_failed",
        persisted: false,
        issues: [],
      });
      setExitCode(2);
      return;
    }

    console.error("Error: failed to prepare memory write request.");
    setExitCode(2);
    return;
  }

  const writeResult = memory.createMemoryWriteResult(writeRequest.value);

  if (!writeResult.ok) {
    if (json) {
      writeRememberJson({
        ok: false,
        reason: "validation_failed",
        persisted: false,
        issues: [],
      });
      setExitCode(2);
      return;
    }

    console.error("Error: failed to prepare memory write result.");
    setExitCode(2);
    return;
  }

  if (writeResult.value.content !== content) {
    if (json) {
      writeRememberJson({
        ok: false,
        reason: "validation_failed",
        persisted: false,
        issues: [],
      });
      setExitCode(2);
      return;
    }

    console.error("Error: memory content preparation mismatch.");
    setExitCode(2);
    return;
  }

  const fileWriteResult = await memory.writeMemoryFile({
    target: memory.createMemoryStorageTarget(".aeos/memory"),
    path: writeResult.value.path.slice(".aeos/memory/".length),
    content: writeResult.value.content,
    createParentDirectory: true,
  });

  if (!fileWriteResult.ok) {
    if (json) {
      writeRememberJson({
        ok: false,
        reason: "filesystem_failed",
        persisted: false,
        issues: [],
      });
      setExitCode(2);
      return;
    }

    console.error(
      `Error: ${fileWriteResult.error.message} (${fileWriteResult.error.code})`,
    );
    setExitCode(2);
    return;
  }

  if (json) {
    writeRememberJson({
      ok: true,
      type: entry.frontmatter.type,
      title: entry.frontmatter.title,
      path: writeResult.value.path,
      persisted: true,
    });
    return;
  }

  console.log("Memory: prepared");
  console.log(`Type: ${entry.frontmatter.type}`);
  console.log(`Title: ${entry.frontmatter.title}`);
  console.log(`Path: ${writeResult.value.path}`);
  console.log(`Status: ${entry.frontmatter.status}`);
}

async function handleSearch(args: readonly string[]): Promise<void> {
  const json = args.includes("--json");
  const queryInput = readSearchQuery(args);
  const typeInput = readFlagValue(args, "--type");
  const tags = readRepeatedFlagValues(args, "--tag")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

  if (queryInput === undefined || queryInput.trim().length === 0) {
    if (json) {
      writeSearchJson({
        ok: false,
        reason: "missing_query",
      });
      setExitCode(1);
      return;
    }

    printSearchFailure("missing query");
    console.log('Usage: aeos search "query"');
    setExitCode(1);
    return;
  }

  if (typeInput !== undefined && !isMemoryType(typeInput)) {
    if (json) {
      writeSearchJson({
        ok: false,
        reason: "invalid_memory_type",
      });
      setExitCode(1);
      return;
    }

    printSearchFailure("invalid memory type");
    console.log(`Type: ${typeInput}`);
    setExitCode(1);
    return;
  }

  const memory = await loadMemoryPackage();
  const entries = await memory.loadMemoryEntriesFromStorage(".aeos/memory");
  const index = memory.createMemorySearchIndex(entries);
  const filter =
    typeInput === undefined && tags.length === 0
      ? undefined
      : {
          ...(typeInput === undefined ? {} : { types: [typeInput] }),
          ...(tags.length === 0 ? {} : { tags }),
        };
  const results = memory.searchMemoryEntries(index, {
    query: queryInput.trim(),
    filter,
  });

  if (json) {
    writeSearchJson({
      ok: true,
      query: queryInput.trim(),
      count: results.length,
      results: results.map((result) => ({
        id: result.entry.id,
        title: result.entry.frontmatter.title,
        type: result.entry.frontmatter.type,
        tags: result.entry.frontmatter.tags,
        score: result.score,
        path: result.entry.path,
        excerpt: result.excerpt,
      })),
    });
    return;
  }

  console.log("Search Results");
  console.log(`Query: ${queryInput.trim()}`);
  console.log(`Matches: ${results.length}`);

  if (results.length === 0) {
    return;
  }

  console.log("");

  for (const result of results) {
    console.log(
      `${result.rank ?? 0}. ${result.entry.frontmatter.title}`,
    );
    console.log(`Type: ${result.entry.frontmatter.type}`);

    if (result.entry.frontmatter.tags.length > 0) {
      console.log(`Tags: ${result.entry.frontmatter.tags.join(", ")}`);
    }

    if (result.entry.path !== undefined) {
      console.log(`Path: ${result.entry.path}`);
    }

    if (result.excerpt !== undefined) {
      console.log(`Excerpt: ${result.excerpt}`);
    }
  }
}

async function handleTask(args: readonly string[]): Promise<void> {
  if (args[0] === "state") {
    await handleTaskState(args.slice(1));
    return;
  }

  if (args[0] === "status") {
    await handleTaskStatus(args.slice(1));
    return;
  }

  if (args[0] === "resume") {
    await handleTaskResume(args.slice(1));
    return;
  }

  if (args[0] === "run") {
    const runArgs = args.slice(1);
    const json = runArgs.includes("--json");
    const dryRun = runArgs.includes("--dry-run");
    const positionalArgs = runArgs.filter((arg) => !arg.startsWith("--"));
    const unknownArgs = runArgs.filter(
      (arg) => arg !== "--json" && arg !== "--dry-run" && arg.startsWith("--"),
    );

    if (unknownArgs.length > 0 || positionalArgs.length > 1) {
      if (json) {
        writeTaskDryRunJson({
          ok: false,
          error: {
            code: "task_run_unknown_option",
            message: "Unknown task run option.",
          },
          issues: [],
        });
        setExitCode(1);
        return;
      }

      console.error("Error: unknown task run option.");
      console.error("Usage: aeos task run --dry-run <task-file> [--json]");
      setExitCode(1);
      return;
    }

    if (!dryRun) {
      if (json) {
        writeTaskDryRunJson({
          ok: false,
          error: {
            code: "task_run_real_execution_not_implemented",
            message:
              "Real task execution is not implemented; use --dry-run for a non-executing preview.",
          },
          issues: [],
        });
        setExitCode(1);
        return;
      }

      console.error("Task Run");
      console.error(
        "Error: real task execution is not implemented; use --dry-run for a non-executing preview.",
      );
      setExitCode(1);
      return;
    }

    const taskFile = positionalArgs[0];

    if (taskFile === undefined || taskFile.trim().length === 0) {
      if (json) {
        writeTaskDryRunJson({
          ok: false,
          error: {
            code: "task_run_task_file_required",
            message: "Task run dry-run requires a task file path.",
          },
          issues: [],
        });
        setExitCode(1);
        return;
      }

      console.error("Task Dry Run");
      console.error("Error: task file path is required.");
      console.error("Usage: aeos task run --dry-run <task-file> [--json]");
      setExitCode(1);
      return;
    }

    try {
      const parserRequest = createTaskPlanInputRequest(taskFile, "dry_run");
      const parserResult = await parseTaskPlanInputFile(parserRequest);
      const integrationResult = createTaskPlanIntegrationResult({
        taskFile,
        json,
        argv: ["task", "run", ...runArgs],
        command: ["task", "run"],
        mode: "dry_run",
        parserRequest,
        parserResult,
      });
      const dryRunInput = createDryRunInputFromPlan({
        taskFile,
        json,
        integrationResult,
      });
      const dryRunResult =
        dryRunInput === undefined
          ? undefined
          : runAgenticRunnerDryRun(dryRunInput);

      if (json) {
        const jsonOutput =
          integrationResult.jsonOutput ??
          createCliTaskPlanPlannerIntegrationResult(
            {
              taskFile,
              json: true,
              mode: "dry_run",
              parserRequest,
              parserResult,
              noExecution: true,
              noWrites: true,
            },
          ).jsonOutput!;

        writeTaskDryRunJson(
          createTaskDryRunJsonOutput({
            integrationResult,
            safePlanOutput: createSafeCliTaskPlanJsonOutput(jsonOutput),
            dryRunResult,
          }),
        );
      } else {
        printTaskDryRunOutput({
          integrationResult,
          dryRunResult,
        });
      }

      setExitCode(
        integrationResult.status === "planned" && dryRunResult?.ok === true
          ? 0
          : 1,
      );
      return;
    } catch {
      if (json) {
        writeTaskDryRunJson({
          ok: false,
          error: {
            code: "task_dry_run_integration_failed",
            message: "Task dry-run integration failed.",
          },
          issues: [],
        });
        setExitCode(1);
        return;
      }

      console.error("Task Dry Run");
      console.error("Error: Task dry-run integration failed.");
      setExitCode(1);
      return;
    }
  }

  if (args[0] === "plan") {
    const planArgs = args.slice(1);
    const json = planArgs.includes("--json");
    const positionalArgs = planArgs.filter((arg) => !arg.startsWith("--"));
    const unknownArgs = planArgs.filter(
      (arg) => arg !== "--json" && arg.startsWith("--"),
    );
    const output = createTaskPlanSkeletonOutput();

    if (unknownArgs.length > 0 || positionalArgs.length > 1) {
      if (json) {
        writeTaskPlanSkeletonJson({
          ok: false,
          error: {
            code: "task_plan_unknown_option",
            message: "Unknown task plan option.",
          },
          issues: [],
        });
        setExitCode(1);
        return;
      }

      console.error("Error: unknown task plan option.");
      console.error("Usage: aeos task plan [<task-file>] [--json]");
      setExitCode(1);
      return;
    }

    const taskFile = positionalArgs[0];

    if (taskFile !== undefined) {
      try {
        const parserRequest = createTaskPlanInputRequest(taskFile);
        const parserResult = await parseTaskPlanInputFile(parserRequest);
        const integrationResult = createTaskPlanIntegrationResult({
          taskFile,
          json,
          argv: ["task", "plan", ...planArgs],
          parserRequest,
          parserResult,
        });

        if (json) {
          writeTaskPlanSkeletonJson(
            createSafeCliTaskPlanJsonOutput(
              integrationResult.jsonOutput ??
                createCliTaskPlanPlannerIntegrationResult(
                  {
                    taskFile,
                    json: true,
                    mode: "plan",
                    parserRequest,
                    parserResult,
                    noExecution: true,
                    noWrites: true,
                  },
                ).jsonOutput!,
            ),
          );
        } else {
          printTaskPlanIntegrationOutput(
            integrationResult.humanOutput ??
              createCliTaskPlanPlannerIntegrationResult(
                {
                  taskFile,
                  json: false,
                  mode: "plan",
                  parserRequest,
                  parserResult,
                  noExecution: true,
                  noWrites: true,
                },
              ).humanOutput!,
          );
        }

        setExitCode(taskPlanStatusToProcessExitCode(integrationResult.status));
        return;
      } catch {
        if (json) {
          writeTaskPlanSkeletonJson({
            ok: false,
            error: {
              code: "task_plan_integration_failed",
              message: "Task plan integration failed.",
            },
            issues: [],
          });
          setExitCode(1);
          return;
        }

        console.error("Task Plan");
        console.error("Error: Task plan integration failed.");
        setExitCode(1);
        return;
      }
    }

    if (json) {
      writeTaskPlanSkeletonJson(output);
    } else {
      printTaskPlanSkeleton(output);
    }

    setExitCode(1);
    return;
  }

  if (args[0] !== "validate") {
    console.error("Error: unknown task command.");
    console.error("Usage: aeos task validate <path>");
    console.error("Usage: aeos task plan [<task-file>] [--json]");
    console.error("Usage: aeos task run --dry-run <task-file> [--json]");
    console.error("Usage: aeos task state init <task-file> [--json]");
    console.error("Usage: aeos task status <task-id> [--json]");
    console.error("Usage: aeos task resume --preview <task-id> [--json]");
    setExitCode(1);
    return;
  }

  const validateArgs = args.slice(1);
  const json = validateArgs.includes("--json");
  const filePath = validateArgs.find((arg) => arg !== "--json");

  validateTaskFile(filePath, json);
}

async function handleProject(args: readonly string[]): Promise<void> {
  if (args[0] === "status") {
    await handleProjectStatus(args.slice(1));
    return;
  }

  if (args[0] === "context") {
    await handleProjectContext(args.slice(1));
    return;
  }

  if (args[0] === "validate") {
    await handleProjectValidate(args.slice(1));
    return;
  }

  if (args[0] === "profile") {
    await handleProjectProfile(args.slice(1));
    return;
  }

  console.error("Error: unknown project command.");
  console.error("Usage: aeos project status");
  console.error("Usage: aeos project context");
  console.error("Usage: aeos project validate");
  console.error("Usage: aeos project profile");
  setExitCode(1);
}

async function handleTemplate(args: readonly string[]): Promise<void> {
  if (args[0] === "recommend") {
    await handleTemplateRecommend(args.slice(1));
    return;
  }

  console.error("Error: unknown template command.");
  console.error("Usage: aeos template recommend");
  console.error("Usage: aeos template recommend --json");
  setExitCode(1);
}

function handleUnknownCommand(command: string): void {
  console.error(`Error: unknown command '${command}'`);
  console.error("Run 'aeos help' for usage.");
  setExitCode(1);
}

export function main(argv: readonly string[]): void {
  const command = argv[2] ?? "help";
  const args = argv.slice(3);

  switch (command) {
    case "context":
      handleContext(args);
      break;

    case "status":
      handleStatus(args);
      break;

    case "init":
      void handleInit(args);
      break;

    case "remember":
      void handleRemember(args);
      break;

    case "search":
      void handleSearch(args);
      break;

    case "project":
      void handleProject(args);
      break;

    case "template":
      void handleTemplate(args);
      break;

    case "task":
      void handleTask(args);
      break;

    case "--version":
    case "version":
      printVersion();
      break;

    case "--help":
    case "help":
      printHelp();
      break;

    default:
      handleUnknownCommand(command);
      break;
  }
}
