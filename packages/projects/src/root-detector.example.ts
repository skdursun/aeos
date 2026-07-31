import {
  detectProjectRoot,
  findProjectRoot,
  hasProjectMarker,
} from "./root-detector.js";

type ProjectRootExample =
  | {
      readonly status: "found";
      readonly rootPath: string;
      readonly markers: readonly string[];
    }
  | {
      readonly status: "missing";
      readonly code: "start_path_not_found" | "project_root_not_found";
      readonly message: string;
      readonly startPath: string;
    };

export function samplePathLookup(startPath: string): string | undefined {
  return findProjectRoot(startPath);
}

export function sampleMarkerDetection(directoryPath: string): boolean {
  return hasProjectMarker(directoryPath);
}

export function sampleSuccessfulDetection(startPath: string): ProjectRootExample {
  const result = detectProjectRoot(startPath);

  if (!result.ok) {
    return {
      status: "missing",
      code: result.error.code,
      message: result.error.message,
      startPath: result.error.startPath,
    };
  }

  return {
    status: "found",
    rootPath: result.rootPath,
    markers: result.markers,
  };
}

export function sampleFailedDetection(startPath: string): ProjectRootExample {
  const result = detectProjectRoot(startPath);

  if (result.ok) {
    return {
      status: "found",
      rootPath: result.rootPath,
      markers: result.markers,
    };
  }

  return {
    status: "missing",
    code: result.error.code,
    message: result.error.message,
    startPath: result.error.startPath,
  };
}
