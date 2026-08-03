import type {
  GenerationAdapterIssue,
  GenerationDirectoryEnsureRequest,
  GenerationDirectoryEnsureResult,
  GenerationFileReadResult,
  GenerationFileSystemAdapter,
  GenerationFileWriteRequest,
  GenerationFileWriteResult,
  GenerationPathInfo,
} from "./generation-adapters.js";

export const missingPathInfoExample: GenerationPathInfo = {
  path: "/workspace/.aeos/project.json",
  exists: false,
  kind: "missing",
  parentPath: "/workspace/.aeos",
  issues: [],
};

export const existingFilePathInfoExample: GenerationPathInfo = {
  path: "/workspace/README.md",
  exists: true,
  kind: "file",
  parentPath: "/workspace",
  sizeBytes: 128,
  modifiedAt: "2026-08-03T00:00:00.000Z",
  issues: [],
};

export const ensureDirectoryRequestExample: GenerationDirectoryEnsureRequest = {
  path: "/workspace/.aeos",
  dryRun: false,
};

export const ensureDirectorySuccessExample: GenerationDirectoryEnsureResult = {
  ok: true,
  path: "/workspace/.aeos",
  dryRun: false,
  status: "ensured",
  created: true,
  issues: [],
};

export const fileWriteRequestExample: GenerationFileWriteRequest = {
  path: "/workspace/.aeos/project.json",
  parentDirectory: "/workspace/.aeos",
  content: '{\n  "name": "example"\n}\n',
  dryRun: false,
  overwrite: false,
};

export const fileWriteWrittenExample: GenerationFileWriteResult = {
  ok: true,
  path: "/workspace/.aeos/project.json",
  dryRun: false,
  overwrite: false,
  status: "written",
  written: true,
  skipped: false,
  bytesWritten: 24,
  issues: [],
};

export const fileWriteSkippedExample: GenerationFileWriteResult = {
  ok: true,
  path: "/workspace/.aeos/project.json",
  dryRun: true,
  overwrite: false,
  status: "planned",
  written: false,
  skipped: true,
  issues: [
    {
      code: "write_skipped",
      severity: "warning",
      operation: "write_file",
      path: "/workspace/.aeos/project.json",
      message: "Dry run planned the file write without writing content.",
      details: {
        reason: "dry_run",
      },
    },
  ],
};

export const overwriteDisabledConflictExample: GenerationAdapterIssue = {
  code: "overwrite_disabled",
  severity: "error",
  operation: "write_file",
  path: "/workspace/README.md",
  message: "The target file already exists and overwrite is disabled.",
  details: {
    existingKind: "file",
    overwrite: "false",
  },
};

export const fileWriteConflictExample: GenerationFileWriteResult = {
  ok: false,
  path: "/workspace/README.md",
  dryRun: false,
  overwrite: false,
  status: "blocked",
  written: false,
  skipped: false,
  issues: [overwriteDisabledConflictExample],
};

export const inspectMissingPathExample = (): GenerationFileReadResult => ({
  ok: true,
  pathInfo: missingPathInfoExample,
  issues: [],
});

export const inspectExistingFileExample = (): GenerationFileReadResult => ({
  ok: true,
  pathInfo: existingFilePathInfoExample,
  issues: [],
});

export const planDirectoryEnsureExample = (
  request: GenerationDirectoryEnsureRequest,
): GenerationDirectoryEnsureResult => ({
  ok: true,
  path: request.path,
  dryRun: request.dryRun,
  status: request.dryRun ? "planned" : "ensured",
  created: !request.dryRun,
  issues: [],
});

export const planFileWriteExample = (
  request: GenerationFileWriteRequest,
): GenerationFileWriteResult => {
  if (request.path === existingFilePathInfoExample.path) {
    return {
      ok: false,
      path: request.path,
      dryRun: request.dryRun,
      overwrite: request.overwrite,
      status: "blocked",
      written: false,
      skipped: false,
      issues: [overwriteDisabledConflictExample],
    };
  }

  if (request.dryRun) {
    return {
      ok: true,
      path: request.path,
      dryRun: request.dryRun,
      overwrite: request.overwrite,
      status: "planned",
      written: false,
      skipped: true,
      issues: fileWriteSkippedExample.issues,
    };
  }

  return {
    ok: true,
    path: request.path,
    dryRun: request.dryRun,
    overwrite: request.overwrite,
    status: "written",
    written: true,
    skipped: false,
    bytesWritten: request.content.length,
    issues: [],
  };
};

export const exampleGenerationFileSystemAdapter: GenerationFileSystemAdapter = {
  getPathInfo: (path) => {
    const pathInfo =
      path === existingFilePathInfoExample.path
        ? existingFilePathInfoExample
        : {
            ...missingPathInfoExample,
            path,
          };

    return {
      ok: true,
      pathInfo,
      issues: pathInfo.issues,
    };
  },
  ensureDirectory: planDirectoryEnsureExample,
  writeFile: planFileWriteExample,
};
