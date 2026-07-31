// @ts-ignore The package does not currently include Node ambient module types.
import { existsSync as nodeExistsSync, lstatSync as nodeLstatSync } from "node:fs";
// @ts-ignore The package does not currently include Node ambient module types.
import { dirname as nodeDirname, parse as nodeParse, resolve as nodeResolve } from "node:path";

interface FileStats {
  isDirectory(): boolean;
}

interface ParsedPath {
  readonly root: string;
}

const existsSync = nodeExistsSync as (path: string) => boolean;
const lstatSync = nodeLstatSync as (path: string) => FileStats;
const dirname = nodeDirname as (path: string) => string;
const parse = nodeParse as (path: string) => ParsedPath;
const resolve = nodeResolve as (...paths: readonly string[]) => string;

export type ProjectRootMarker =
  | "package.json"
  | "pnpm-workspace.yaml"
  | ".git"
  | "AGENTS.md"
  | "PROJECT_CONTEXT.md";

export type ProjectRootDetectionErrorCode =
  | "start_path_not_found"
  | "project_root_not_found";

export interface ProjectRootDetectionError {
  readonly code: ProjectRootDetectionErrorCode;
  readonly message: string;
  readonly startPath: string;
}

export type ProjectRootDetectionResult =
  | {
      readonly ok: true;
      readonly rootPath: string;
      readonly markers: readonly ProjectRootMarker[];
    }
  | {
      readonly ok: false;
      readonly rootPath: undefined;
      readonly markers: readonly ProjectRootMarker[];
      readonly error: ProjectRootDetectionError;
    };

const projectRootMarkers: readonly ProjectRootMarker[] = [
  "package.json",
  "pnpm-workspace.yaml",
  ".git",
  "AGENTS.md",
  "PROJECT_CONTEXT.md",
];

export function detectProjectRoot(startPath: string): ProjectRootDetectionResult {
  const resolvedStartPath = resolve(startPath);
  const startDirectory = getStartDirectory(resolvedStartPath);

  if (startDirectory === undefined) {
    return {
      ok: false,
      rootPath: undefined,
      markers: [],
      error: {
        code: "start_path_not_found",
        message: `Start path does not exist: ${resolvedStartPath}`,
        startPath: resolvedStartPath,
      },
    };
  }

  let currentDirectory = startDirectory;
  const filesystemRoot = parse(currentDirectory).root;

  while (true) {
    const markers = getProjectMarkers(currentDirectory);

    if (markers.length > 0) {
      return {
        ok: true,
        rootPath: currentDirectory,
        markers,
      };
    }

    if (currentDirectory === filesystemRoot) {
      return {
        ok: false,
        rootPath: undefined,
        markers: [],
        error: {
          code: "project_root_not_found",
          message: `Project root not found from: ${resolvedStartPath}`,
          startPath: resolvedStartPath,
        },
      };
    }

    currentDirectory = dirname(currentDirectory);
  }
}

export function findProjectRoot(startPath: string): string | undefined {
  const result = detectProjectRoot(startPath);

  return result.ok ? result.rootPath : undefined;
}

export function hasProjectMarker(path: string): boolean {
  return getProjectMarkers(resolve(path)).length > 0;
}

function getStartDirectory(resolvedStartPath: string): string | undefined {
  try {
    const startPathStats = lstatSync(resolvedStartPath);

    return startPathStats.isDirectory()
      ? resolvedStartPath
      : dirname(resolvedStartPath);
  } catch {
    return undefined;
  }
}

function getProjectMarkers(directoryPath: string): readonly ProjectRootMarker[] {
  return projectRootMarkers.filter((marker) =>
    existsSync(resolve(directoryPath, marker)),
  );
}
