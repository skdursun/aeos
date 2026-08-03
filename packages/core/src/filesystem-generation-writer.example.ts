import type {
  GenerationAdapterIssue,
  GenerationDirectoryEnsureRequest,
  GenerationDirectoryEnsureResult,
  GenerationFileSystemAdapter,
  GenerationFileWriteRequest,
  GenerationFileWriteResult,
} from "./generation-adapters.js";
import { createFilesystemGenerationAdapter } from "./filesystem-generation-writer.js";

export const safeFilesystemGenerationTargetRoot = ".aeos/generated";

export const safeTargetPathExample = "agents/plans/init.md";

export const traversalTargetPathExample = "../outside-root.md";

export const directoryEnsureRequestExample: GenerationDirectoryEnsureRequest = {
  path: "agents/plans",
  dryRun: true,
};

export const fileWriteRequestExample: GenerationFileWriteRequest = {
  path: safeTargetPathExample,
  parentDirectory: directoryEnsureRequestExample.path,
  content: "# Init Plan\n\nGenerated in dry-run mode.\n",
  dryRun: true,
  overwrite: false,
};

export const overwriteDisabledConflictWriteRequestExample: GenerationFileWriteRequest = {
  path: safeTargetPathExample,
  parentDirectory: directoryEnsureRequestExample.path,
  content: "# Replacement Plan\n",
  dryRun: false,
  overwrite: false,
};

export function createFilesystemGenerationAdapterExample(): GenerationFileSystemAdapter {
  return createFilesystemGenerationAdapter({
    targetRoot: safeFilesystemGenerationTargetRoot,
  });
}

export async function planDirectoryEnsureExample(
  adapter: GenerationFileSystemAdapter = createFilesystemGenerationAdapterExample(),
): Promise<GenerationDirectoryEnsureResult> {
  return adapter.ensureDirectory(directoryEnsureRequestExample);
}

export async function planFileWriteExample(
  adapter: GenerationFileSystemAdapter = createFilesystemGenerationAdapterExample(),
): Promise<GenerationFileWriteResult> {
  return adapter.writeFile(fileWriteRequestExample);
}

export async function rejectTraversalExample(
  adapter: GenerationFileSystemAdapter = createFilesystemGenerationAdapterExample(),
): Promise<GenerationFileWriteResult> {
  return adapter.writeFile({
    path: traversalTargetPathExample,
    content: "This request must be blocked before any write is attempted.\n",
    dryRun: true,
    overwrite: false,
  });
}

export async function blockOverwriteDisabledConflictExample(
  adapter: GenerationFileSystemAdapter,
): Promise<GenerationFileWriteResult> {
  return adapter.writeFile(overwriteDisabledConflictWriteRequestExample);
}

export const dryRunCompatibleAdapterExample: GenerationFileSystemAdapter = {
  getPathInfo(path) {
    const issue = createExampleIssue(
      "target_missing",
      "warning",
      "Example adapter treats paths as missing unless a write scenario overrides it.",
      "path_info",
      path,
    );

    return {
      ok: true,
      pathInfo: {
        path,
        exists: false,
        kind: "missing",
        issues: [issue],
      },
      issues: [issue],
    };
  },
  ensureDirectory(request) {
    return {
      ok: true,
      path: request.path,
      dryRun: request.dryRun,
      status: request.dryRun ? "planned" : "ensured",
      created: !request.dryRun,
      issues: request.dryRun
        ? [
            createExampleIssue(
              "write_skipped",
              "warning",
              "Directory creation is planned only because dry-run is enabled.",
              "ensure_directory",
              request.path,
            ),
          ]
        : [],
    };
  },
  writeFile(request) {
    if (request.path === traversalTargetPathExample) {
      const issue = createExampleIssue(
        "target_outside_root",
        "error",
        "Target path must remain under the target root.",
        "write_file",
        request.path,
      );

      return {
        ok: false,
        path: request.path,
        dryRun: request.dryRun,
        overwrite: false,
        status: "blocked",
        written: false,
        skipped: true,
        issues: [issue],
      };
    }

    if (request === overwriteDisabledConflictWriteRequestExample) {
      const issue = createExampleIssue(
        "overwrite_disabled",
        "error",
        "Existing target is blocked because overwrite is disabled.",
        "write_file",
        request.path,
      );

      return {
        ok: false,
        path: request.path,
        dryRun: request.dryRun,
        overwrite: false,
        status: "blocked",
        written: false,
        skipped: true,
        issues: [issue],
      };
    }

    return {
      ok: true,
      path: request.path,
      dryRun: request.dryRun,
      overwrite: false,
      status: request.dryRun ? "planned" : "written",
      written: !request.dryRun,
      skipped: request.dryRun,
      bytesWritten: request.dryRun ? undefined : request.content.length,
      issues: request.dryRun
        ? [
            createExampleIssue(
              "write_skipped",
              "warning",
              "File write is planned only because dry-run is enabled.",
              "write_file",
              request.path,
            ),
          ]
        : [],
    };
  },
};

export async function dryRunCompatibleAdapterUsageExample(): Promise<{
  readonly directoryEnsure: GenerationDirectoryEnsureResult;
  readonly fileWrite: GenerationFileWriteResult;
  readonly traversalRejection: GenerationFileWriteResult;
  readonly overwriteDisabledConflict: GenerationFileWriteResult;
}> {
  const directoryEnsure = await planDirectoryEnsureExample(
    dryRunCompatibleAdapterExample,
  );
  const fileWrite = await planFileWriteExample(dryRunCompatibleAdapterExample);
  const traversalRejection = await rejectTraversalExample(
    dryRunCompatibleAdapterExample,
  );
  const overwriteDisabledConflict = await blockOverwriteDisabledConflictExample(
    dryRunCompatibleAdapterExample,
  );

  return {
    directoryEnsure,
    fileWrite,
    traversalRejection,
    overwriteDisabledConflict,
  };
}

function createExampleIssue(
  code: GenerationAdapterIssue["code"],
  severity: GenerationAdapterIssue["severity"],
  message: string,
  operation: GenerationAdapterIssue["operation"],
  path: string,
): GenerationAdapterIssue {
  return {
    code,
    severity,
    message,
    operation,
    path,
  };
}
