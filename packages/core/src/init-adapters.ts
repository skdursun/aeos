import type {
  InitIssue,
  InitValidationSummary,
} from "./init.js";
import type {
  InitArtifactSummary,
  InitExecutionContext,
  InitStage,
  InitStageHandler,
  InitStageResult,
  InitStageResultStatus,
} from "./init-engine.js";

export type InitAdapterResult = InitStageResult | Promise<InitStageResult>;

export interface ProjectInitAdapter {
  readonly runProjectDetection: (
    context: InitExecutionContext,
  ) => InitAdapterResult;
}

export interface TemplateInitAdapter {
  readonly runTemplateSelection: (
    context: InitExecutionContext,
  ) => InitAdapterResult;
  readonly runVariableResolution?: (
    context: InitExecutionContext,
  ) => InitAdapterResult;
}

export interface RenderInitAdapter {
  readonly runRendering: (context: InitExecutionContext) => InitAdapterResult;
}

export interface WriteInitAdapter {
  readonly runFileWriting: (context: InitExecutionContext) => InitAdapterResult;
}

export interface ValidationInitAdapter {
  readonly runValidation: (context: InitExecutionContext) => InitAdapterResult;
}

export interface InitAdapterSet {
  readonly project?: ProjectInitAdapter;
  readonly template?: TemplateInitAdapter;
  readonly render?: RenderInitAdapter;
  readonly write?: WriteInitAdapter;
  readonly validation?: ValidationInitAdapter;
}

export type InitAdapterStageHandlers = Readonly<
  Partial<Record<InitStage, InitStageHandler>>
>;

export interface CreateInitStageResultInput {
  readonly stage: InitStage;
  readonly status: InitStageResultStatus;
  readonly issues?: readonly InitIssue[];
  readonly artifacts?: readonly InitArtifactSummary[];
  readonly startedAt?: string;
  readonly completedAt?: string;
}

export function createInitStageHandlers(
  adapters: InitAdapterSet,
): InitAdapterStageHandlers {
  return removeUndefinedHandlers({
    project_detection: adapters.project?.runProjectDetection,
    template_selection: adapters.template?.runTemplateSelection,
    variable_resolution: adapters.template?.runVariableResolution,
    rendering: adapters.render?.runRendering,
    file_writing: adapters.write?.runFileWriting,
    validation: adapters.validation?.runValidation,
  });
}

export function createInitStageResult(
  input: CreateInitStageResultInput,
): InitStageResult {
  return {
    stage: input.stage,
    status: input.status,
    issues: input.issues ?? [],
    artifacts: sortArtifacts(input.artifacts ?? []),
    startedAt: input.startedAt,
    completedAt: input.completedAt,
  };
}

export function createSuccessfulInitStageResult(
  stage: InitStage,
  artifacts: readonly InitArtifactSummary[] = [],
  issues: readonly InitIssue[] = [],
): InitStageResult {
  return createInitStageResult({
    stage,
    status: "success",
    issues: sortIssues(issues),
    artifacts,
  });
}

export function createFailedInitStageResult(
  stage: InitStage,
  issues: readonly InitIssue[],
  artifacts: readonly InitArtifactSummary[] = [],
): InitStageResult {
  return createInitStageResult({
    stage,
    status: "failure",
    issues: sortIssues(issues),
    artifacts,
  });
}

export function createSkippedInitStageResult(
  stage: InitStage,
  issues: readonly InitIssue[] = [],
): InitStageResult {
  return createInitStageResult({
    stage,
    status: "skipped",
    issues: sortIssues(issues),
  });
}

export function createValidationInitStageResult(
  validation: InitValidationSummary,
  artifacts: readonly InitArtifactSummary[] = [],
): InitStageResult {
  return createInitStageResult({
    stage: "validation",
    status: validation.failed.length > 0 ? "failure" : "success",
    issues: sortIssues([...validation.warnings, ...validation.failed]),
    artifacts,
  });
}

export function createInitIssue(input: InitIssue): InitIssue {
  const details =
    input.details === undefined ? undefined : sortStringRecord(input.details);

  return details === undefined
    ? {
        code: input.code,
        message: input.message,
        path: input.path,
      }
    : {
        code: input.code,
        message: input.message,
        path: input.path,
        details,
      };
}

export function createInitArtifactSummary(
  input: InitArtifactSummary,
): InitArtifactSummary {
  return {
    path: input.path,
    summary: input.summary,
    sourcePath: input.sourcePath,
    stage: input.stage,
  };
}

export function sortInitIssues(
  issues: readonly InitIssue[],
): readonly InitIssue[] {
  return sortIssues(issues);
}

export function sortInitArtifacts(
  artifacts: readonly InitArtifactSummary[],
): readonly InitArtifactSummary[] {
  return sortArtifacts(artifacts);
}

function removeUndefinedHandlers(
  handlers: Readonly<Partial<Record<InitStage, InitStageHandler | undefined>>>,
): InitAdapterStageHandlers {
  const definedHandlers: Partial<Record<InitStage, InitStageHandler>> = {};
  const stages: readonly InitStage[] = [
    "project_detection",
    "template_selection",
    "variable_resolution",
    "rendering",
    "file_writing",
    "validation",
  ];

  for (const stage of stages) {
    const handler = handlers[stage];

    if (handler !== undefined) {
      definedHandlers[stage] = handler;
    }
  }

  return definedHandlers;
}

function sortIssues(issues: readonly InitIssue[]): readonly InitIssue[] {
  return issues.map(createInitIssue).sort(compareIssues);
}

function sortArtifacts(
  artifacts: readonly InitArtifactSummary[],
): readonly InitArtifactSummary[] {
  return artifacts.map(createInitArtifactSummary).sort(compareArtifacts);
}

function compareIssues(left: InitIssue, right: InitIssue): number {
  const pathOrder = (left.path ?? "").localeCompare(right.path ?? "");

  if (pathOrder !== 0) {
    return pathOrder;
  }

  const codeOrder = left.code.localeCompare(right.code);

  if (codeOrder !== 0) {
    return codeOrder;
  }

  return left.message.localeCompare(right.message);
}

function compareArtifacts(
  left: InitArtifactSummary,
  right: InitArtifactSummary,
): number {
  const stageOrder = (left.stage ?? "").localeCompare(right.stage ?? "");

  if (stageOrder !== 0) {
    return stageOrder;
  }

  const pathOrder = left.path.localeCompare(right.path);

  if (pathOrder !== 0) {
    return pathOrder;
  }

  return left.summary.localeCompare(right.summary);
}

function sortStringRecord(
  record: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) => left.localeCompare(right)),
  );
}
