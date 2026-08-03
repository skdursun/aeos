// @ts-expect-error This package does not expose Node built-in types yet.
import { lstat, readdir, realpath, stat } from "node:fs/promises";
// @ts-expect-error This package does not expose Node built-in types yet.
import path from "node:path";

import type {
  ProjectIntelligenceDetectorInput,
  ProjectIntelligenceDetectorIssue,
  ProjectIntelligenceDetectorLimits,
  ProjectIntelligenceDetectorOptions,
  ProjectIntelligenceIgnoreRule,
  ProjectIntelligenceScanEntry,
  ProjectIntelligenceScanEntryKind,
} from "./intelligence-detector.js";

export interface ProjectIntelligenceScanCollectorResult {
  readonly entries: readonly ProjectIntelligenceScanEntry[];
  readonly issues: readonly ProjectIntelligenceDetectorIssue[];
  readonly summary: {
    readonly scannedEntries: number;
    readonly skippedEntries: number;
    readonly issueCount: number;
    readonly reachedLimits: readonly string[];
  };
}

interface CollectorState {
  readonly projectRoot: string;
  readonly rootRealPath: string;
  readonly input: ProjectIntelligenceDetectorInput;
  readonly entries: ProjectIntelligenceScanEntry[];
  readonly issues: ProjectIntelligenceDetectorIssue[];
  readonly reachedLimits: Set<string>;
  readonly visitedDirectoryRealPaths: Set<string>;
  skippedEntries: number;
  scannedFiles: number;
}

interface FileSystemStats {
  readonly size: number;
  isDirectory(): boolean;
  isFile(): boolean;
  isSymbolicLink(): boolean;
}

const DEFAULT_OPTIONS: ProjectIntelligenceDetectorOptions = {
  includeHiddenFiles: false,
  followSymlinks: false,
  includeLockfiles: true,
  includeInfrastructure: false,
  includeMonorepoSignals: false,
  includeDependencySignals: false,
};

const DEFAULT_LIMITS: ProjectIntelligenceDetectorLimits = {
  maxDepth: 6,
  maxFiles: 1_000,
  maxFileSizeBytes: 1_000_000,
  maxEvidenceEntries: 100,
  timeoutMs: 5_000,
};

const DEFAULT_IGNORE_RULES: readonly ProjectIntelligenceIgnoreRule[] = [
  createIgnoreRule({ directory: ".git" }),
  createIgnoreRule({ directory: "node_modules" }),
  createIgnoreRule({ directory: "vendor" }),
  createIgnoreRule({ directory: ".next" }),
  createIgnoreRule({ directory: "dist" }),
  createIgnoreRule({ directory: "build" }),
  createIgnoreRule({ directory: "coverage" }),
  createIgnoreRule({ directory: ".turbo" }),
  createIgnoreRule({ directory: ".cache" }),
  createIgnoreRule({ directory: ".venv" }),
  createIgnoreRule({ directory: "venv" }),
];

const LOCKFILE_BASENAMES = new Set([
  "pnpm-lock.yaml",
  "package-lock.json",
  "yarn.lock",
  "composer.lock",
  "uv.lock",
  "Cargo.lock",
]);

const INFRASTRUCTURE_BASENAMES = new Set(["Dockerfile", ".github"]);
const INFRASTRUCTURE_EXTENSIONS = new Set([".tf"]);
const MONOREPO_BASENAMES = new Set(["packages", "pnpm-workspace.yaml", "go.work"]);
const DEPENDENCY_SIGNAL_BASENAMES = new Set([
  "package.json",
  "composer.json",
  "pyproject.toml",
  "requirements.txt",
  "go.mod",
  "Cargo.toml",
]);

export function createDefaultProjectIntelligenceDetectorInput(
  projectRoot: string,
): ProjectIntelligenceDetectorInput {
  return {
    projectRoot,
    mode: "inventory",
    scope: "bounded_workspace",
    options: DEFAULT_OPTIONS,
    limits: DEFAULT_LIMITS,
    ignoreRules: DEFAULT_IGNORE_RULES,
  };
}

export async function collectProjectScanEntries(
  input: ProjectIntelligenceDetectorInput,
): Promise<ProjectIntelligenceScanCollectorResult> {
  const projectRoot = path.resolve(input.projectRoot);
  const rootRealPath = await resolveRealPath(projectRoot);
  const state: CollectorState = {
    projectRoot,
    rootRealPath,
    input,
    entries: [],
    issues: [],
    reachedLimits: new Set(),
    visitedDirectoryRealPaths: new Set(),
    skippedEntries: 0,
    scannedFiles: 0,
  };

  recordUnsupportedIgnoreRules(state);
  recordTimeoutLimit(state);

  await collectDirectoryEntries(state, projectRoot, 0);

  const entries = state.entries
    .map((entry) => normalizeProjectScanEntry(entry))
    .sort(compareScanEntries);
  const reachedLimits = [...state.reachedLimits].sort();

  return {
    entries,
    issues: state.issues.sort(compareIssues),
    summary: {
      scannedEntries: entries.length,
      skippedEntries: state.skippedEntries,
      issueCount: state.issues.length,
      reachedLimits,
    },
  };
}

export function normalizeProjectScanEntry(
  entry: ProjectIntelligenceScanEntry,
): ProjectIntelligenceScanEntry {
  const normalizedPath = normalizeRelativePath(entry.path);
  const basename = path.posix.basename(normalizedPath);
  const extension = path.posix.extname(basename) || undefined;

  return {
    path: normalizedPath,
    kind: entry.kind,
    sizeBytes: entry.sizeBytes,
    extension,
    basename,
    depth: getEntryDepth(normalizedPath),
  };
}

async function collectDirectoryEntries(
  state: CollectorState,
  directoryPath: string,
  depth: number,
): Promise<void> {
  if (depth > state.input.limits.maxDepth || hasReachedFileLimit(state)) {
    if (depth > state.input.limits.maxDepth) {
      state.reachedLimits.add("maxDepth");
    }
    return;
  }

  const directoryRealPath = await resolveDirectoryRealPath(state, directoryPath);

  if (directoryRealPath === undefined) {
    return;
  }

  if (state.visitedDirectoryRealPaths.has(directoryRealPath)) {
    return;
  }

  state.visitedDirectoryRealPaths.add(directoryRealPath);

  let childBasenames: string[];

  try {
    childBasenames = await readdir(directoryPath);
  } catch {
    addIssue(
      state,
      "collector.directory.unreadable",
      "Directory could not be read during project scan collection.",
      "warning",
      toProjectRelativePath(state, directoryPath),
    );
    return;
  }

  childBasenames.sort();

  for (const basename of childBasenames) {
    if (hasReachedFileLimit(state)) {
      state.reachedLimits.add("maxFiles");
      return;
    }

    const absolutePath = path.join(directoryPath, basename);
    const relativePath = toProjectRelativePath(state, absolutePath);

    if (
      relativePath === undefined ||
      shouldSkipPath(state, relativePath, basename)
    ) {
      state.skippedEntries += 1;
      continue;
    }

    await collectPathEntry(state, absolutePath, relativePath, depth);
  }
}

async function collectPathEntry(
  state: CollectorState,
  absolutePath: string,
  relativePath: string,
  depth: number,
): Promise<void> {
  let filesystemStats: FileSystemStats;

  try {
    filesystemStats = await lstat(absolutePath);
  } catch {
    addIssue(
      state,
      "collector.path.unreadable",
      "Path metadata could not be read during project scan collection.",
      "warning",
      relativePath,
    );
    state.skippedEntries += 1;
    return;
  }

  let kind: ProjectIntelligenceScanEntryKind = "unknown";
  let sizeBytes: number | undefined;
  let shouldTraverse = false;

  if (filesystemStats.isSymbolicLink()) {
    kind = "symlink";

    if (state.input.options.followSymlinks) {
      const target = await resolveSymlinkTarget(state, absolutePath, relativePath);

      if (target === undefined) {
        state.skippedEntries += 1;
      } else {
        kind = target.kind;
        sizeBytes = target.sizeBytes;
        shouldTraverse = target.kind === "directory";
      }
    }
  } else if (filesystemStats.isDirectory()) {
    kind = "directory";
    shouldTraverse = true;
  } else if (filesystemStats.isFile()) {
    kind = "file";
    sizeBytes = filesystemStats.size;
  }

  if (
    kind === "file" &&
    sizeBytes !== undefined &&
    sizeBytes > state.input.limits.maxFileSizeBytes
  ) {
    state.skippedEntries += 1;
    state.reachedLimits.add("maxFileSizeBytes");
    addIssue(
      state,
      "collector.file.too_large",
      "File was skipped because it exceeds the configured file size limit.",
      "warning",
      relativePath,
    );
    return;
  }

  state.entries.push(
    normalizeProjectScanEntry({
      path: relativePath,
      kind,
      sizeBytes,
      extension: undefined,
      basename: path.posix.basename(relativePath),
      depth,
    }),
  );

  if (kind === "file") {
    state.scannedFiles += 1;
  }

  if (shouldTraverse) {
    await collectDirectoryEntries(state, absolutePath, depth + 1);
  }
}

async function resolveSymlinkTarget(
  state: CollectorState,
  absolutePath: string,
  relativePath: string,
): Promise<
  | { readonly kind: "file" | "directory"; readonly sizeBytes: number | undefined }
  | undefined
> {
  let targetRealPath: string;

  try {
    targetRealPath = await realpath(absolutePath);
  } catch {
    addIssue(
      state,
      "collector.symlink.unreadable",
      "Symlink target could not be resolved during project scan collection.",
      "warning",
      relativePath,
    );
    return undefined;
  }

  if (!isPathInsideRoot(targetRealPath, state.rootRealPath)) {
    addIssue(
      state,
      "collector.symlink.outside_root",
      "Symlink target was skipped because it resolves outside the project root.",
      "warning",
      relativePath,
    );
    return undefined;
  }

  try {
    const targetStats = await stat(absolutePath);

    if (targetStats.isDirectory()) {
      return { kind: "directory", sizeBytes: undefined };
    }

    if (targetStats.isFile()) {
      return { kind: "file", sizeBytes: targetStats.size };
    }
  } catch {
    addIssue(
      state,
      "collector.symlink.target_unreadable",
      "Symlink target metadata could not be read during project scan collection.",
      "warning",
      relativePath,
    );
  }

  return undefined;
}

function shouldSkipPath(
  state: CollectorState,
  relativePath: string,
  basename: string,
): boolean {
  const normalizedPath = normalizeRelativePath(relativePath);
  const extension = path.posix.extname(basename) || undefined;

  if (!state.input.options.includeHiddenFiles && basename.startsWith(".")) {
    return true;
  }

  if (!state.input.options.includeLockfiles && LOCKFILE_BASENAMES.has(basename)) {
    return true;
  }

  if (
    !state.input.options.includeInfrastructure &&
    isInfrastructurePath(normalizedPath, basename, extension)
  ) {
    return true;
  }

  if (
    !state.input.options.includeMonorepoSignals &&
    MONOREPO_BASENAMES.has(basename)
  ) {
    return true;
  }

  if (
    !state.input.options.includeDependencySignals &&
    DEPENDENCY_SIGNAL_BASENAMES.has(basename)
  ) {
    return true;
  }

  return state.input.ignoreRules.some((rule) =>
    matchesSimpleIgnoreRule(rule, normalizedPath, basename, extension),
  );
}

function isInfrastructurePath(
  relativePath: string,
  basename: string,
  extension: string | undefined,
): boolean {
  return (
    INFRASTRUCTURE_BASENAMES.has(basename) ||
    basename.startsWith("docker-compose.") ||
    relativePath.startsWith(".github/workflows/") ||
    (extension !== undefined && INFRASTRUCTURE_EXTENSIONS.has(extension))
  );
}

function matchesSimpleIgnoreRule(
  rule: ProjectIntelligenceIgnoreRule,
  relativePath: string,
  basename: string,
  extension: string | undefined,
): boolean {
  return (
    rule.path === relativePath ||
    rule.directory === basename ||
    (extension !== undefined && rule.extension === extension)
  );
}

function recordUnsupportedIgnoreRules(state: CollectorState): void {
  const unsupportedRules = state.input.ignoreRules.filter(
    (rule) => rule.pattern !== undefined,
  );

  for (const rule of unsupportedRules) {
    addIssue(
      state,
      "collector.ignore_rule.pattern_unsupported",
      `Ignore pattern "${rule.pattern}" was not applied because glob matching is not implemented.`,
      "info",
      undefined,
    );
  }
}

function recordTimeoutLimit(state: CollectorState): void {
  if (state.input.limits.timeoutMs > 0) {
    state.reachedLimits.add("timeoutMs_recorded");
  }
}

function hasReachedFileLimit(state: CollectorState): boolean {
  return state.scannedFiles >= state.input.limits.maxFiles;
}

function addIssue(
  state: CollectorState,
  code: string,
  message: string,
  severity: ProjectIntelligenceDetectorIssue["severity"],
  issuePath: string | undefined,
): void {
  state.issues.push({
    code,
    message,
    severity,
    path: issuePath,
  });
}

function createIgnoreRule(
  rule: Partial<ProjectIntelligenceIgnoreRule>,
): ProjectIntelligenceIgnoreRule {
  return {
    path: rule.path,
    directory: rule.directory,
    extension: rule.extension,
    pattern: rule.pattern,
  };
}

async function resolveRealPath(projectRoot: string): Promise<string> {
  return realpath(projectRoot);
}

async function resolveDirectoryRealPath(
  state: CollectorState,
  directoryPath: string,
): Promise<string | undefined> {
  let directoryRealPath: string;

  try {
    directoryRealPath = await realpath(directoryPath);
  } catch {
    addIssue(
      state,
      "collector.directory.realpath_unreadable",
      "Directory real path could not be resolved during project scan collection.",
      "warning",
      toProjectRelativePath(state, directoryPath),
    );
    return undefined;
  }

  if (!isPathInsideRoot(directoryRealPath, state.rootRealPath)) {
    addIssue(
      state,
      "collector.directory.outside_root",
      "Directory was skipped because it resolves outside the project root.",
      "warning",
      toProjectRelativePath(state, directoryPath),
    );
    return undefined;
  }

  return directoryRealPath;
}

function toProjectRelativePath(
  state: CollectorState,
  absolutePath: string,
): string | undefined {
  const resolvedPath = path.resolve(absolutePath);

  if (!isPathInsideRoot(resolvedPath, state.projectRoot)) {
    return undefined;
  }

  const relativePath = path.relative(state.projectRoot, resolvedPath);

  if (relativePath === "") {
    return "";
  }

  return normalizeRelativePath(relativePath);
}

function isPathInsideRoot(candidatePath: string, rootPath: string): boolean {
  const relativePath = path.relative(rootPath, candidatePath);

  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
  );
}

function normalizeRelativePath(relativePath: string): string {
  return relativePath.split(path.sep).join(path.posix.sep);
}

function getEntryDepth(relativePath: string): number {
  if (relativePath === "") {
    return 0;
  }

  return relativePath.split("/").length - 1;
}

function compareScanEntries(
  left: ProjectIntelligenceScanEntry,
  right: ProjectIntelligenceScanEntry,
): number {
  return left.path.localeCompare(right.path);
}

function compareIssues(
  left: ProjectIntelligenceDetectorIssue,
  right: ProjectIntelligenceDetectorIssue,
): number {
  const codeComparison = left.code.localeCompare(right.code);

  if (codeComparison !== 0) {
    return codeComparison;
  }

  return (left.path ?? "").localeCompare(right.path ?? "");
}
