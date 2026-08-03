// @ts-expect-error Node built-ins are available at runtime; this package does not depend on Node ambient types yet.
import { lstat as nodeLstat, mkdir as nodeMkdir, writeFile as nodeWriteFile } from "node:fs/promises";
// @ts-expect-error Node built-ins are available at runtime; this package does not depend on Node ambient types yet.
import * as nodePath from "node:path";

import type {
  GenerationAdapterIssue,
  GenerationDirectoryEnsureRequest,
  GenerationDirectoryEnsureResult,
  GenerationFileReadResult,
  GenerationFileSystemAdapter,
  GenerationFileWriteRequest,
  GenerationFileWriteResult,
  GenerationPathInfo,
  GenerationPathKind,
} from "./generation-adapters.js";

interface FileStats {
  readonly size: number;
  readonly mtime: Date;
  readonly isDirectory: () => boolean;
  readonly isFile: () => boolean;
  readonly isSymbolicLink: () => boolean;
}

const lstat: (path: string) => Promise<FileStats> = nodeLstat;
const mkdir: (path: string, options: { readonly recursive: true }) => Promise<void> =
  nodeMkdir;
const writeFile: (
  path: string,
  content: string,
  options: { readonly flag: "wx" },
) => Promise<void> = nodeWriteFile;
const dirname: (path: string) => string = nodePath.dirname;
const isAbsolute: (path: string) => boolean = nodePath.isAbsolute;
const relative: (from: string, to: string) => string = nodePath.relative;
const resolve: (...paths: readonly string[]) => string = nodePath.resolve;
const sep: string = nodePath.sep;
const textEncoder = new TextEncoder();

export interface FilesystemGenerationAdapterOptions {
  readonly targetRoot: string;
}

interface SafePathResult {
  readonly requestedPath: string;
  readonly absolutePath: string;
  readonly relativePath: string;
  readonly issue?: GenerationAdapterIssue;
}

interface ParentInspectionResult {
  readonly ok: boolean;
  readonly issue?: GenerationAdapterIssue;
}

export function createFilesystemGenerationAdapter(
  options: FilesystemGenerationAdapterOptions,
): GenerationFileSystemAdapter {
  const targetRoot = resolve(options.targetRoot);

  return {
    getPathInfo(path) {
      return getPathInfoForTarget(targetRoot, path);
    },
    ensureDirectory(request) {
      return ensureDirectoryForTarget(targetRoot, request);
    },
    writeFile(request) {
      return writeFileForTarget(targetRoot, request);
    },
  };
}

async function getPathInfoForTarget(
  targetRoot: string,
  path: string,
): Promise<GenerationFileReadResult> {
  const safePath = resolveSafeTargetPath(targetRoot, path, "path_info");

  if (safePath.issue !== undefined) {
    const pathInfo = createPathInfo(path, false, "unknown", [safePath.issue]);

    return {
      ok: false,
      pathInfo,
      issues: pathInfo.issues,
    };
  }

  const pathInfo = await inspectSafePath(safePath);

  return {
    ok: pathInfo.issues.every((issue) => issue.severity !== "error"),
    pathInfo,
    issues: pathInfo.issues,
  };
}

async function ensureDirectoryForTarget(
  targetRoot: string,
  request: GenerationDirectoryEnsureRequest,
): Promise<GenerationDirectoryEnsureResult> {
  const safePath = resolveSafeTargetPath(
    targetRoot,
    request.path,
    "ensure_directory",
    true,
  );

  if (safePath.issue !== undefined) {
    return {
      ok: false,
      path: request.path,
      dryRun: request.dryRun,
      status: "blocked",
      created: false,
      issues: [safePath.issue],
    };
  }

  const existing = await inspectSafePath(safePath);
  if (existing.kind === "directory") {
    return {
      ok: true,
      path: safePath.relativePath,
      dryRun: request.dryRun,
      status: request.dryRun ? "planned" : "skipped",
      created: false,
      issues: request.dryRun
        ? [
            createIssue(
              "write_skipped",
              "warning",
              "Directory creation skipped because dry-run is enabled.",
              "ensure_directory",
              safePath.relativePath,
            ),
          ]
        : [],
    };
  }

  if (existing.kind === "file") {
    const issue = createIssue(
      "parent_is_file",
      "error",
      "Directory path is an existing file.",
      "ensure_directory",
      safePath.relativePath,
    );

    return {
      ok: false,
      path: safePath.relativePath,
      dryRun: request.dryRun,
      status: "blocked",
      created: false,
      issues: [issue],
    };
  }

  if (existing.kind === "unknown") {
    return {
      ok: false,
      path: safePath.relativePath,
      dryRun: request.dryRun,
      status: "failed",
      created: false,
      issues: existing.issues,
    };
  }

  const parentInspection = await inspectParentDirectories(targetRoot, safePath);
  if (!parentInspection.ok) {
    return {
      ok: false,
      path: safePath.relativePath,
      dryRun: request.dryRun,
      status: "blocked",
      created: false,
      issues: parentInspection.issue === undefined ? [] : [parentInspection.issue],
    };
  }

  if (request.dryRun) {
    return {
      ok: true,
      path: safePath.relativePath,
      dryRun: true,
      status: "planned",
      created: false,
      issues: [
        createIssue(
          "write_skipped",
          "warning",
          "Directory creation skipped because dry-run is enabled.",
          "ensure_directory",
          safePath.relativePath,
        ),
      ],
    };
  }

  try {
    await mkdir(safePath.absolutePath, { recursive: true });

    return {
      ok: true,
      path: safePath.relativePath,
      dryRun: false,
      status: "ensured",
      created: true,
      issues: [],
    };
  } catch (error) {
    const issue = createIssue(
      "directory_ensure_failed",
      "error",
      "Directory could not be created safely.",
      "ensure_directory",
      safePath.relativePath,
      { error: errorToMessage(error) },
    );

    return {
      ok: false,
      path: safePath.relativePath,
      dryRun: false,
      status: "failed",
      created: false,
      issues: [issue],
    };
  }
}

async function writeFileForTarget(
  targetRoot: string,
  request: GenerationFileWriteRequest,
): Promise<GenerationFileWriteResult> {
  const safePath = resolveSafeTargetPath(targetRoot, request.path, "write_file");

  if (safePath.issue !== undefined) {
    return createWriteResult(request, request.path, "blocked", false, true, [
      safePath.issue,
    ]);
  }

  const targetInfo = await inspectSafePath(safePath);
  if (targetInfo.kind === "file") {
    const issue = createIssue(
      "overwrite_disabled",
      "error",
      "Target file already exists and overwrite is disabled.",
      "write_file",
      safePath.relativePath,
    );

    return createWriteResult(request, safePath.relativePath, "blocked", false, true, [
      issue,
    ]);
  }

  if (targetInfo.kind === "directory") {
    const issue = createIssue(
      "target_is_directory",
      "error",
      "Target path is an existing directory.",
      "write_file",
      safePath.relativePath,
    );

    return createWriteResult(request, safePath.relativePath, "blocked", false, true, [
      issue,
    ]);
  }

  if (targetInfo.kind === "unknown") {
    return createWriteResult(
      request,
      safePath.relativePath,
      "failed",
      false,
      false,
      targetInfo.issues,
    );
  }

  const parentPath = request.parentDirectory ?? dirname(safePath.relativePath);
  const parentEnsure = await ensureDirectoryForTarget(targetRoot, {
    path: parentPath,
    dryRun: request.dryRun,
  });

  if (!parentEnsure.ok) {
    return createWriteResult(
      request,
      safePath.relativePath,
      parentEnsure.status === "failed" ? "failed" : "blocked",
      false,
      parentEnsure.status !== "failed",
      parentEnsure.issues,
    );
  }

  if (request.dryRun) {
    return createWriteResult(
      request,
      safePath.relativePath,
      "planned",
      false,
      true,
      [
        createIssue(
          "write_skipped",
          "warning",
          "File write skipped because dry-run is enabled.",
          "write_file",
          safePath.relativePath,
        ),
      ],
    );
  }

  try {
    await writeFile(safePath.absolutePath, request.content, { flag: "wx" });

    return {
      ok: true,
      path: safePath.relativePath,
      dryRun: false,
      overwrite: false,
      status: "written",
      written: true,
      skipped: false,
      bytesWritten: textEncoder.encode(request.content).byteLength,
      issues: [],
    };
  } catch (error) {
    const issue = createIssue(
      "file_write_failed",
      "error",
      "File could not be written safely.",
      "write_file",
      safePath.relativePath,
      { error: errorToMessage(error) },
    );

    return createWriteResult(request, safePath.relativePath, "failed", false, false, [
      issue,
    ]);
  }
}

async function inspectSafePath(safePath: SafePathResult): Promise<GenerationPathInfo> {
  try {
    const stats = await lstat(safePath.absolutePath);

    if (stats.isSymbolicLink()) {
      return createPathInfo(safePath.relativePath, true, "unknown", [
        createIssue(
          "path_inspection_failed",
          "error",
          "Path is a symbolic link and cannot be used safely.",
          "path_info",
          safePath.relativePath,
        ),
      ]);
    }

    if (stats.isFile()) {
      return {
        path: safePath.relativePath,
        exists: true,
        kind: "file",
        parentPath: safeParentPath(safePath.relativePath),
        sizeBytes: stats.size,
        modifiedAt: stats.mtime.toISOString(),
        issues: [
          createIssue(
            "target_is_file",
            "warning",
            "Path is an existing file.",
            "path_info",
            safePath.relativePath,
          ),
        ],
      };
    }

    if (stats.isDirectory()) {
      return {
        path: safePath.relativePath,
        exists: true,
        kind: "directory",
        parentPath: safeParentPath(safePath.relativePath),
        modifiedAt: stats.mtime.toISOString(),
        issues: [
          createIssue(
            "target_is_directory",
            "warning",
            "Path is an existing directory.",
            "path_info",
            safePath.relativePath,
          ),
        ],
      };
    }

    return createPathInfo(safePath.relativePath, true, "unknown", [
      createIssue(
        "path_inspection_failed",
        "error",
        "Path exists but is not a regular file or directory.",
        "path_info",
        safePath.relativePath,
      ),
    ]);
  } catch (error) {
    if (isNodeErrorCode(error, "ENOENT")) {
      return createPathInfo(safePath.relativePath, false, "missing", [
        createIssue(
          "target_missing",
          "warning",
          "Path does not exist.",
          "path_info",
          safePath.relativePath,
        ),
      ]);
    }

    return createPathInfo(safePath.relativePath, false, "unknown", [
      createIssue(
        "path_inspection_failed",
        "error",
        "Path could not be inspected safely.",
        "path_info",
        safePath.relativePath,
        { error: errorToMessage(error) },
      ),
    ]);
  }
}

async function inspectParentDirectories(
  targetRoot: string,
  safePath: SafePathResult,
): Promise<ParentInspectionResult> {
  const segments = safePath.relativePath.split("/").filter(Boolean);
  const parentSegments = segments.slice(0, -1);
  let pathToInspect = targetRoot;

  for (const segment of parentSegments) {
    pathToInspect = resolve(pathToInspect, segment);

    try {
      const stats = await lstat(pathToInspect);
      const relativePath = toRootRelativePath(targetRoot, pathToInspect);

      if (stats.isSymbolicLink()) {
        return {
          ok: false,
          issue: createIssue(
            "path_inspection_failed",
            "error",
            "Parent path is a symbolic link and cannot be used safely.",
            "ensure_directory",
            relativePath,
          ),
        };
      }

      if (!stats.isDirectory()) {
        return {
          ok: false,
          issue: createIssue(
            "parent_is_file",
            "error",
            "A parent path is an existing file.",
            "ensure_directory",
            relativePath,
          ),
        };
      }
    } catch (error) {
      if (!isNodeErrorCode(error, "ENOENT")) {
        return {
          ok: false,
          issue: createIssue(
            "path_inspection_failed",
            "error",
            "Parent path could not be inspected safely.",
            "ensure_directory",
            segment,
            { error: errorToMessage(error) },
          ),
        };
      }
    }
  }

  return { ok: true };
}

function resolveSafeTargetPath(
  targetRoot: string,
  requestedPath: string,
  operation: GenerationAdapterIssue["operation"],
  allowRoot = false,
): SafePathResult {
  const normalizedRequest = normalizeTargetPath(requestedPath);

  if (
    (!allowRoot && normalizedRequest.length === 0) ||
    isAbsolute(requestedPath) ||
    hasParentTraversal(normalizedRequest)
  ) {
    const issue = createIssue(
      "target_outside_root",
      "error",
      "Target path must be a safe relative path under the target root.",
      operation,
      requestedPath,
    );

    return {
      requestedPath,
      absolutePath: targetRoot,
      relativePath: normalizedRequest,
      issue,
    };
  }

  const absolutePath = resolve(targetRoot, normalizedRequest);
  const rootRelativePath = relative(targetRoot, absolutePath);

  if (
    (!allowRoot && rootRelativePath.length === 0) ||
    isOutsideRelativePath(rootRelativePath) ||
    isAbsolute(rootRelativePath)
  ) {
    const issue = createIssue(
      "target_outside_root",
      "error",
      "Target path resolves outside the target root.",
      operation,
      requestedPath,
    );

    return {
      requestedPath,
      absolutePath,
      relativePath: normalizedRequest,
      issue,
    };
  }

  return {
    requestedPath,
    absolutePath,
    relativePath: rootRelativePath.length === 0
      ? "."
      : normalizeTargetPath(rootRelativePath),
  };
}

function createPathInfo(
  path: string,
  exists: boolean,
  kind: GenerationPathKind,
  issues: readonly GenerationAdapterIssue[],
): GenerationPathInfo {
  return {
    path,
    exists,
    kind,
    parentPath: safeParentPath(path),
    issues,
  };
}

function createWriteResult(
  request: GenerationFileWriteRequest,
  path: string,
  status: GenerationFileWriteResult["status"],
  written: boolean,
  skipped: boolean,
  issues: readonly GenerationAdapterIssue[],
): GenerationFileWriteResult {
  return {
    ok: status === "planned" || status === "written" || status === "skipped",
    path,
    dryRun: request.dryRun,
    overwrite: false,
    status,
    written,
    skipped,
    issues,
  };
}

function createIssue(
  code: GenerationAdapterIssue["code"],
  severity: GenerationAdapterIssue["severity"],
  message: string,
  operation: GenerationAdapterIssue["operation"],
  path?: string,
  details?: Readonly<Record<string, string>>,
): GenerationAdapterIssue {
  return {
    code,
    severity,
    message,
    operation,
    path,
    details,
  };
}

function normalizeTargetPath(path: string): string {
  return path
    .trim()
    .replaceAll("\\", "/")
    .split("/")
    .filter((segment) => segment.length > 0 && segment !== ".")
    .join("/");
}

function hasParentTraversal(path: string): boolean {
  return path.split("/").some((segment) => segment === "..");
}

function isOutsideRelativePath(path: string): boolean {
  return path === ".." || path.startsWith(`..${sep}`);
}

function safeParentPath(path: string): string | undefined {
  const parentPath = dirname(path).replaceAll(sep, "/");

  return parentPath === "." ? undefined : parentPath;
}

function toRootRelativePath(rootPath: string, path: string): string {
  return normalizeTargetPath(relative(rootPath, path));
}

function isNodeErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === code
  );
}

function errorToMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
