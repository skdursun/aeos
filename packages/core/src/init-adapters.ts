import type {
  InitRenderedArtifact,
  InitRenderInput,
  InitIssue,
  InitValidationSummary,
  InitVariableMap,
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

export interface ConcreteInitAdapterState {
  projectRoot?: string;
  selectedTemplate?: DiscoveredTemplate;
  builtInRenderedArtifacts?: readonly InitRenderedArtifact[];
  renderedFiles: RenderedInitFile[];
}

export interface RenderedInitFile {
  readonly sourcePath: string;
  readonly targetPath: string;
  readonly content: string;
}

interface ProjectApi {
  readonly detectProjectRoot: (startPath: string) => ProjectRootDetectionResult;
  readonly readProjectMetadata: (projectRoot: string) => ProjectMetadata;
}

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
        readonly message: string;
        readonly startPath: string;
      };
    };

interface ProjectMetadata {
  readonly package: {
    readonly path: string;
    readonly exists: boolean;
  };
  readonly context: {
    readonly path: string;
    readonly exists: boolean;
  };
  readonly agents: {
    readonly path: string;
    readonly exists: boolean;
  };
}

interface TemplateApi {
  readonly discoverTemplates: (rootPath: string) => TemplateDiscoveryResult;
  readonly renderTemplate: (
    content: string,
    variables: InitVariableMap,
  ) => TemplateRenderResult;
  readonly resolveTemplateVariables: (
    content: string,
    variables: InitVariableMap,
  ) => VariableResolveResult;
  readonly selectTemplate: (
    templates: readonly DiscoveredTemplate[],
    request: { readonly templateId: string },
  ) => TemplateSelectionResult;
  readonly validateRenderResult: (
    result: TemplateRenderResult,
  ) => TemplateRenderValidationResult;
  readonly validateTemplateSelection: (
    result: TemplateSelectionResult,
  ) => TemplateSelectionValidationResult;
}

type TemplateDiscoveryResult =
  | {
      readonly ok: true;
      readonly root: string;
      readonly templates: readonly DiscoveredTemplate[];
      readonly issues: readonly TemplateIssue[];
    }
  | {
      readonly ok: false;
      readonly root: string;
      readonly templates: readonly DiscoveredTemplate[];
      readonly issues: readonly TemplateIssue[];
    };

interface DiscoveredTemplate {
  readonly id: string;
  readonly path: string;
  readonly metadataPath: string;
  readonly metadata: unknown;
}

interface TemplateIssue {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
  readonly templateId?: string;
}

type TemplateSelectionResult =
  | {
      readonly ok: true;
      readonly templateId: string;
      readonly template: DiscoveredTemplate;
      readonly metadata: unknown;
      readonly issues: readonly [];
    }
  | {
      readonly ok: false;
      readonly templateId?: string;
      readonly template: undefined;
      readonly metadata: undefined;
      readonly issues: readonly TemplateSelectionIssue[];
    };

interface TemplateSelectionIssue {
  readonly code: string;
  readonly message: string;
  readonly templateId?: string;
}

interface TemplateSelectionValidationResult {
  readonly ok: boolean;
  readonly issues: readonly TemplateSelectionIssue[];
}

type TemplateRenderResult =
  | {
      readonly ok: true;
      readonly content: string;
      readonly missingVariables: readonly [];
    }
  | {
      readonly ok: false;
      readonly content: string;
      readonly missingVariables: readonly string[];
    };

interface VariableResolveResult {
  readonly ok: boolean;
  readonly content: string;
  readonly missingVariables: readonly string[];
}

interface TemplateRenderValidationResult {
  readonly ok: boolean;
  readonly issues: readonly TemplateRenderValidationIssue[];
}

interface TemplateRenderValidationIssue {
  readonly code: string;
  readonly message: string;
  readonly variableName?: string;
}

interface MemoryApi {
  readonly createMemoryStorageTarget: (
    rootPath: string,
  ) => MemoryStorageTarget;
  readonly writeMemoryFile: (
    request: MemoryFileWriteRequest,
  ) => Promise<MemoryFileWriteResult>;
}

interface MemoryStorageTarget {
  readonly rootPath: string;
}

interface MemoryFileWriteRequest {
  readonly target: MemoryStorageTarget;
  readonly path: string;
  readonly content: string;
  readonly createParentDirectory?: boolean;
}

type MemoryFileWriteResult =
  | {
      readonly ok: true;
      readonly value: {
        readonly path: string;
        readonly bytesWritten: number;
      };
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: string;
        readonly message: string;
        readonly details?: Readonly<Record<string, unknown>>;
      };
    };

interface TemplateFileMapping {
  readonly sourcePath: string;
  readonly targetPath: string;
}

interface FilesystemApi {
  readonly readFile: (
    path: string,
    encoding: "utf8",
  ) => Promise<string>;
}

interface PathApi {
  readonly isAbsolute: (path: string) => boolean;
  readonly relative: (from: string, to: string) => string;
  readonly resolve: (...paths: readonly string[]) => string;
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

export function createDefaultInitAdapters(): InitAdapterSet {
  const state: ConcreteInitAdapterState = {
    renderedFiles: [],
  };

  return {
    project: createProjectInitAdapter(state),
    template: createTemplateInitAdapter(state),
    render: createRenderInitAdapter(state),
    write: createWriteInitAdapter(state),
    validation: createValidationInitAdapter(state),
  };
}

export function createProjectInitAdapter(
  state: ConcreteInitAdapterState = { renderedFiles: [] },
): ProjectInitAdapter {
  return {
    async runProjectDetection(context) {
      const projectApi = await loadProjectApi();
      const detection = projectApi.detectProjectRoot(context.request.projectRoot);

      if (!detection.ok) {
        state.projectRoot = context.request.projectRoot;

        return createSuccessfulInitStageResult("project_detection", [
          createInitArtifactSummary({
            path: context.request.projectRoot,
            summary: "Using requested directory as init target root.",
          }),
        ]);
      }

      const metadata = projectApi.readProjectMetadata(detection.rootPath);
      state.projectRoot = detection.rootPath;

      return createSuccessfulInitStageResult("project_detection", [
        createInitArtifactSummary({
          path: detection.rootPath,
          summary: `Detected project root with markers: ${detection.markers.join(", ")}`,
        }),
        createInitArtifactSummary({
          path: metadata.package.path,
          summary: metadata.package.exists
            ? "Read package metadata."
            : "Package metadata not found.",
        }),
        createInitArtifactSummary({
          path: metadata.context.path,
          summary: metadata.context.exists
            ? "Read project context metadata."
            : "Project context metadata not found.",
        }),
        createInitArtifactSummary({
          path: metadata.agents.path,
          summary: metadata.agents.exists
            ? "Read agents metadata."
            : "Agents metadata not found.",
        }),
      ]);
    },
  };
}

export function createTemplateInitAdapter(
  state: ConcreteInitAdapterState = { renderedFiles: [] },
): TemplateInitAdapter {
  return {
    async runTemplateSelection(context) {
      const templateApi = await loadTemplateApi();
      const templateRoot = context.request.template.templateRoot;

      if (templateRoot === undefined || templateRoot.trim().length === 0) {
        if (context.request.template.templateId === "default") {
          state.builtInRenderedArtifacts = [createBuiltInAgentsArtifact()];

          return createSuccessfulInitStageResult("template_selection", [
            createInitArtifactSummary({
              path: "builtin:aeos-init/default",
              summary: "Selected built-in AEOS init fixture.",
            }),
          ]);
        }

        return createFailedInitStageResult("template_selection", [
          createInitIssue({
            code: "init_template_root_missing",
            message: "Init template selection requires a template root.",
          }),
        ]);
      }

      const discovery = templateApi.discoverTemplates(templateRoot);
      const discoveryIssues = discovery.issues.map(convertTemplateIssue);

      if (!discovery.ok) {
        return createFailedInitStageResult(
          "template_selection",
          discoveryIssues,
        );
      }

      const selection = templateApi.selectTemplate(discovery.templates, {
        templateId: context.request.template.templateId,
      });
      const selectionValidation =
        templateApi.validateTemplateSelection(selection);

      if (!selection.ok || !selectionValidation.ok) {
        return createFailedInitStageResult("template_selection", [
          ...discoveryIssues,
          ...convertTemplateSelectionIssues(selection),
          ...selectionValidation.issues.map((issue) =>
            createInitIssue({
              code: issue.code,
              message: issue.message,
              details:
                issue.templateId === undefined
                  ? undefined
                  : { templateId: issue.templateId },
            }),
          ),
        ]);
      }

      state.selectedTemplate = selection.template;

      return createSuccessfulInitStageResult(
        "template_selection",
        [
          createInitArtifactSummary({
            path: selection.template.path,
            summary: `Selected template ${selection.template.id}.`,
          }),
          createInitArtifactSummary({
            path: selection.template.metadataPath,
            summary: "Read selected template metadata.",
          }),
        ],
        discoveryIssues,
      );
    },

    async runVariableResolution(context) {
      const templateApi = await loadTemplateApi();

      if (state.builtInRenderedArtifacts !== undefined) {
        return createSuccessfulInitStageResult("variable_resolution", [
          createInitArtifactSummary({
            path: "builtin:aeos-init/default",
            summary: "Resolved built-in init variables.",
          }),
        ]);
      }

      if (state.selectedTemplate === undefined) {
        return createSkippedInitStageResult("variable_resolution", [
          createInitIssue({
            code: "init_template_not_selected",
            message: "Variable resolution requires a selected template.",
          }),
        ]);
      }

      const variableManifest = JSON.stringify(state.selectedTemplate.metadata);
      const resolution = templateApi.resolveTemplateVariables(
        variableManifest,
        context.request.variables,
      );
      const missingVariables = findRequiredMissingVariables(
        state.selectedTemplate.metadata,
        context.request.variables,
      );
      const issues = [...resolution.missingVariables, ...missingVariables]
        .filter((variableName, index, variables) =>
          variables.indexOf(variableName) === index,
        )
        .map((variableName) =>
          createInitIssue({
            code: "init_variable_missing",
            message: `Init variable is required but was not provided: ${variableName}`,
            details: { variableName },
          }),
        );

      return issues.length === 0
        ? createSuccessfulInitStageResult("variable_resolution", [
            createInitArtifactSummary({
              path: state.selectedTemplate.metadataPath,
              summary: "Resolved template variables.",
            }),
          ])
        : createFailedInitStageResult("variable_resolution", issues);
    },
  };
}

export function createRenderInitAdapter(
  state: ConcreteInitAdapterState = { renderedFiles: [] },
): RenderInitAdapter {
  return {
    async runRendering(context) {
      const templateApi = await loadTemplateApi();

      if (state.builtInRenderedArtifacts !== undefined) {
        state.renderedFiles = state.builtInRenderedArtifacts.map((artifact) => ({
          sourcePath: artifact.sourcePath ?? artifact.targetPath,
          targetPath: artifact.targetPath,
          content: artifact.content,
        }));

        return createSuccessfulInitStageResult(
          "rendering",
          state.builtInRenderedArtifacts.map((artifact) =>
            createInitArtifactSummary({
              path: artifact.targetPath,
              sourcePath: artifact.sourcePath,
              summary: artifact.summary,
              stage: "rendering",
              renderedArtifact: artifact,
            }),
          ),
        );
      }

      if (state.selectedTemplate === undefined) {
        return createSkippedInitStageResult("rendering", [
          createInitIssue({
            code: "init_template_not_selected",
            message: "Rendering requires a selected template.",
          }),
        ]);
      }

      const mappings = getTemplateFileMappings(state.selectedTemplate);

      if (mappings.length === 0) {
        return createSuccessfulInitStageResult("rendering", []);
      }

      const fs = getFilesystemApi();
      const path = getPathApi();
      const renderedFiles: RenderedInitFile[] = [];
      const issues: InitIssue[] = [];

      for (const mapping of mappings) {
        const sourcePath = path.resolve(
          state.selectedTemplate.path,
          mapping.sourcePath,
        );

        if (!isPathWithin(state.selectedTemplate.path, sourcePath, path)) {
          issues.push(
            createInitIssue({
              code: "init_template_source_outside_root",
              message: "Template source file must resolve inside the template root.",
              path: sourcePath,
            }),
          );
          continue;
        }

        try {
          const content = await fs.readFile(sourcePath, "utf8");
          const renderResult = templateApi.renderTemplate(
            content,
            context.request.variables,
          );
          const validation = templateApi.validateRenderResult(renderResult);

          if (!renderResult.ok || !validation.ok) {
            issues.push(
              ...renderResult.missingVariables.map((variableName) =>
                createInitIssue({
                  code: "init_render_missing_variable",
                  message: `Template render is missing variable: ${variableName}`,
                  path: sourcePath,
                  details: { variableName },
                }),
              ),
              ...validation.issues.map((issue) =>
                createInitIssue({
                  code: issue.code,
                  message: issue.message,
                  path: sourcePath,
                  details:
                    issue.variableName === undefined
                      ? undefined
                      : { variableName: issue.variableName },
                }),
              ),
            );
            continue;
          }

          renderedFiles.push({
            sourcePath,
            targetPath: mapping.targetPath,
            content: renderResult.content,
          });
        } catch (error) {
          issues.push(
            createInitIssue({
              code: "init_template_source_read_failed",
              message: getErrorMessage(error),
              path: sourcePath,
            }),
          );
        }
      }

      state.renderedFiles = renderedFiles;

      if (issues.length > 0) {
        return createFailedInitStageResult("rendering", issues);
      }

      return createSuccessfulInitStageResult(
        "rendering",
        renderedFiles.map((file) =>
          createInitArtifactSummary({
            path: file.targetPath,
            sourcePath: file.sourcePath,
            summary: "Rendered template file.",
            stage: "rendering",
            renderedArtifact: {
              targetPath: file.targetPath,
              content: file.content,
              kind: "text",
              summary: "Rendered template file.",
              sourcePath: file.sourcePath,
              templateId: state.selectedTemplate?.id,
            },
          }),
        ),
      );
    },
  };
}

export function createWriteInitAdapter(
  state: ConcreteInitAdapterState = { renderedFiles: [] },
): WriteInitAdapter {
  return {
    async runFileWriting(context) {
      const memoryApi = await loadMemoryApi();
      const projectRoot = state.projectRoot ?? context.request.projectRoot;
      const target = memoryApi.createMemoryStorageTarget(projectRoot);
      const artifacts: InitArtifactSummary[] = [];
      const issues: InitIssue[] = [];

      for (const file of state.renderedFiles) {
        const result = await memoryApi.writeMemoryFile({
          target,
          path: file.targetPath,
          content: file.content,
          createParentDirectory: true,
        });

        if (result.ok) {
          artifacts.push(
            createInitArtifactSummary({
              path: result.value.path,
              sourcePath: file.sourcePath,
              summary: `Created file (${String(result.value.bytesWritten)} bytes).`,
              stage: "file_writing",
            }),
          );
        } else {
          issues.push(
            createInitIssue({
              code: result.error.code,
              message: result.error.message,
              path: file.targetPath,
              details: stringifyRecord(result.error.details),
            }),
          );
        }
      }

      return issues.length === 0
        ? createSuccessfulInitStageResult("file_writing", artifacts)
        : createFailedInitStageResult("file_writing", issues, artifacts);
    },
  };
}

export function createValidationInitAdapter(
  state: ConcreteInitAdapterState = { renderedFiles: [] },
): ValidationInitAdapter {
  return {
    runValidation(context) {
      const failed = context.completedStages.flatMap((stage) =>
        stage.status === "failure" ? stage.issues : [],
      );
      const warnings = context.completedStages.flatMap((stage) =>
        stage.status === "success" ? stage.issues : [],
      );
      const checksRun = [
        ...context.completedStages
          .filter((stage) => stage.status !== "skipped")
          .map((stage) => stage.stage),
        "project_validation",
      ];
      const skipped = context.completedStages
        .filter((stage) => stage.status === "skipped")
        .map((stage) => stage.stage);
      const validation: InitValidationSummary = {
        status: failed.length > 0 ? "fail" : warnings.length > 0 ? "warn" : "pass",
        checksRun,
        passed:
          failed.length === 0
            ? ["project_validation"]
            : [],
        warnings,
        failed,
        skipped,
      };

      return createValidationInitStageResult(validation, [
        createInitArtifactSummary({
          path: state.projectRoot ?? context.request.projectRoot,
          summary: "Project validation placeholder completed.",
        }),
      ]);
    },
  };
}

export function createInitRenderInput(
  context: InitExecutionContext,
  targetPaths: readonly string[],
): InitRenderInput {
  return {
    projectRoot: context.request.projectRoot,
    template: context.request.template,
    variables: context.request.variables,
    targetPaths,
  };
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

function convertTemplateIssue(issue: {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
  readonly templateId?: string;
}): InitIssue {
  return createInitIssue({
    code: issue.code,
    message: issue.message,
    path: issue.path,
    details:
      issue.templateId === undefined ? undefined : { templateId: issue.templateId },
  });
}

async function loadProjectApi(): Promise<ProjectApi> {
  const module = await loadPackageModule("@aeos/projects");

  return {
    detectProjectRoot: readFunction(
      module,
      "detectProjectRoot",
    ) as ProjectApi["detectProjectRoot"],
    readProjectMetadata: readFunction(
      module,
      "readProjectMetadata",
    ) as ProjectApi["readProjectMetadata"],
  };
}

async function loadTemplateApi(): Promise<TemplateApi> {
  const module = await loadPackageModule("@aeos/templates");

  return {
    discoverTemplates: readFunction(
      module,
      "discoverTemplates",
    ) as TemplateApi["discoverTemplates"],
    renderTemplate: readFunction(
      module,
      "renderTemplate",
    ) as TemplateApi["renderTemplate"],
    resolveTemplateVariables: readFunction(
      module,
      "resolveTemplateVariables",
    ) as TemplateApi["resolveTemplateVariables"],
    selectTemplate: readFunction(
      module,
      "selectTemplate",
    ) as TemplateApi["selectTemplate"],
    validateRenderResult: readFunction(
      module,
      "validateRenderResult",
    ) as TemplateApi["validateRenderResult"],
    validateTemplateSelection: readFunction(
      module,
      "validateTemplateSelection",
    ) as TemplateApi["validateTemplateSelection"],
  };
}

async function loadMemoryApi(): Promise<MemoryApi> {
  const module = await loadPackageModule("@aeos/memory");

  return {
    createMemoryStorageTarget: readFunction(
      module,
      "createMemoryStorageTarget",
    ) as MemoryApi["createMemoryStorageTarget"],
    writeMemoryFile: readFunction(
      module,
      "writeMemoryFile",
    ) as MemoryApi["writeMemoryFile"],
  };
}

async function loadPackageModule(
  packageName: string,
): Promise<Readonly<Record<string, unknown>>> {
  const loadedModule = await importPackageModule(packageName);

  if (!isRecord(loadedModule)) {
    throw new Error(`Package module did not load an object: ${packageName}`);
  }

  return loadedModule;
}

async function importPackageModule(packageName: string): Promise<unknown> {
  try {
    return await import(packageName);
  } catch (error) {
    const fallbackPath = getLocalPackageFallbackPath(packageName);

    if (fallbackPath === undefined) {
      throw error;
    }

    return import(fallbackPath);
  }
}

function getLocalPackageFallbackPath(packageName: string): string | undefined {
  if (packageName === "@aeos/projects") {
    return "../../projects/dist/index.js";
  }

  if (packageName === "@aeos/templates") {
    return "../../templates/dist/index.js";
  }

  if (packageName === "@aeos/memory") {
    return "../../memory/dist/index.js";
  }

  return undefined;
}

function readFunction(
  module: Readonly<Record<string, unknown>>,
  exportName: string,
): (...args: readonly unknown[]) => unknown {
  const value = module[exportName];

  if (typeof value !== "function") {
    throw new Error(`Package export is unavailable: ${exportName}`);
  }

  return value as (...args: readonly unknown[]) => unknown;
}

function convertTemplateSelectionIssues(
  selection: TemplateSelectionResult,
): readonly InitIssue[] {
  return selection.issues.map((issue) =>
    createInitIssue({
      code: issue.code,
      message: issue.message,
      details:
        issue.templateId === undefined ? undefined : { templateId: issue.templateId },
    }),
  );
}

function findRequiredMissingVariables(
  metadata: unknown,
  variables: InitVariableMap,
): readonly string[] {
  if (!isRecord(metadata)) {
    return [];
  }

  const declaredVariables = metadata.variables;

  if (!Array.isArray(declaredVariables)) {
    return [];
  }

  return declaredVariables
    .flatMap((variable) => readTemplateVariableName(variable))
    .filter(
      (variableName) =>
        !Object.prototype.hasOwnProperty.call(variables, variableName),
    )
    .sort((left, right) => left.localeCompare(right));
}

function readTemplateVariableName(variable: unknown): readonly string[] {
  if (typeof variable === "string" && variable.length > 0) {
    return [variable];
  }

  if (!isRecord(variable)) {
    return [];
  }

  const name = variable.name;

  return typeof name === "string" && name.length > 0 ? [name] : [];
}

function getTemplateFileMappings(
  template: DiscoveredTemplate,
): readonly TemplateFileMapping[] {
  const metadata = template.metadata;

  if (!isRecord(metadata)) {
    return [];
  }

  const files = metadata.files;

  if (!Array.isArray(files)) {
    return [];
  }

  return files.flatMap(readTemplateFileMapping).sort(compareTemplateFileMappings);
}

function readTemplateFileMapping(file: unknown): readonly TemplateFileMapping[] {
  if (typeof file === "string" && file.length > 0) {
    return [
      {
        sourcePath: file,
        targetPath: file,
      },
    ];
  }

  if (!isRecord(file)) {
    return [];
  }

  const sourcePath = readFirstStringProperty(file, [
    "sourcePath",
    "source",
    "path",
  ]);
  const targetPath = readFirstStringProperty(file, [
    "targetPath",
    "target",
    "destination",
    "path",
  ]);

  return sourcePath === undefined || targetPath === undefined
    ? []
    : [{ sourcePath, targetPath }];
}

function readFirstStringProperty(
  record: Readonly<Record<string, unknown>>,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

function compareTemplateFileMappings(
  left: TemplateFileMapping,
  right: TemplateFileMapping,
): number {
  const targetOrder = left.targetPath.localeCompare(right.targetPath);

  return targetOrder === 0
    ? left.sourcePath.localeCompare(right.sourcePath)
    : targetOrder;
}

function getFilesystemApi(): FilesystemApi {
  const fsModule = getBuiltinModule("node:fs/promises");

  if (!isRecord(fsModule) || typeof fsModule.readFile !== "function") {
    throw new Error("Node filesystem API is unavailable.");
  }

  return {
    readFile: fsModule.readFile as FilesystemApi["readFile"],
  };
}

function getPathApi(): PathApi {
  const pathModule = getBuiltinModule("node:path");

  if (
    !isRecord(pathModule) ||
    typeof pathModule.isAbsolute !== "function" ||
    typeof pathModule.relative !== "function" ||
    typeof pathModule.resolve !== "function"
  ) {
    throw new Error("Node path API is unavailable.");
  }

  return {
    isAbsolute: pathModule.isAbsolute as PathApi["isAbsolute"],
    relative: pathModule.relative as PathApi["relative"],
    resolve: pathModule.resolve as PathApi["resolve"],
  };
}

function getBuiltinModule(moduleName: string): unknown {
  const processValue = (globalThis as Record<string, unknown>).process;

  if (!isRecord(processValue)) {
    throw new Error("Node process API is unavailable.");
  }

  const getBuiltinModuleValue = processValue.getBuiltinModule;

  if (typeof getBuiltinModuleValue !== "function") {
    throw new Error("Node builtin module loader is unavailable.");
  }

  return getBuiltinModuleValue(moduleName);
}

function isPathWithin(rootPath: string, path: string, pathApi: PathApi): boolean {
  const relativePath = pathApi.relative(rootPath, path);

  return (
    relativePath.length === 0 ||
    (!relativePath.startsWith("..") && !pathApi.isAbsolute(relativePath))
  );
}

function stringifyRecord(
  record: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, string>> | undefined {
  if (record === undefined) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, String(value)]),
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Init adapter failed with an unexpected error.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
    renderedArtifact: input.renderedArtifact,
  };
}

function createBuiltInAgentsArtifact(): InitRenderedArtifact {
  return {
    targetPath: "AGENTS.md",
    content: [
      "# AEOS Agent Instructions",
      "",
      "This file was generated by AEOS init.",
      "Keep project-specific agent guidance here.",
      "",
    ].join("\n"),
    kind: "text",
    summary: "Create AEOS project agent instructions.",
    sourcePath: "builtin:aeos-init/AGENTS.md",
    templateId: "default",
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
