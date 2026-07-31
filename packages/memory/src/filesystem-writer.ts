// @ts-expect-error Node runtime APIs are intentionally isolated to this file.
import { constants } from "node:fs";
// @ts-expect-error Node runtime APIs are intentionally isolated to this file.
import { access, mkdir, writeFile } from "node:fs/promises";
// @ts-expect-error Node runtime APIs are intentionally isolated to this file.
import { dirname, isAbsolute, relative, resolve } from "node:path";
import type { AeosError, JsonObject, Result } from "@aeos/core";
import { createAeosError, err, ok } from "@aeos/core";

export interface MemoryStorageTarget {
  readonly rootPath: string;
  readonly collectionPath?: string;
}

export interface MemoryFileWriteRequest {
  readonly target: MemoryStorageTarget;
  readonly path: string;
  readonly content: string;
  readonly createParentDirectory?: boolean;
}

export interface MemoryFileWriteSuccess {
  readonly path: string;
  readonly created: true;
  readonly bytesWritten: number;
}

export type MemoryFileWriteResult = Result<MemoryFileWriteSuccess, AeosError>;
export type MemoryFilePathResult = Result<string, AeosError>;

export function createMemoryStorageTarget(
  rootPath: string,
  collectionPath?: string,
): MemoryStorageTarget {
  if (collectionPath === undefined) {
    return { rootPath };
  }

  return { rootPath, collectionPath };
}

export function resolveMemoryFilePath(
  target: MemoryStorageTarget,
  path: string,
): MemoryFilePathResult {
  const targetValidation = validateStorageTarget(target);

  if (targetValidation !== undefined) {
    return err(targetValidation);
  }

  if (path.trim().length === 0) {
    return err(
      createMemoryFileWriteError(
        "MEMORY_FILE_PATH_EMPTY",
        "Memory file path is required.",
      ),
    );
  }

  const rootPath = resolve(target.rootPath);
  const basePath =
    target.collectionPath === undefined
      ? rootPath
      : resolve(rootPath, target.collectionPath);
  const resolvedPath = isAbsolute(path) ? resolve(path) : resolve(basePath, path);

  if (!isPathWithin(rootPath, resolvedPath)) {
    return err(
      createMemoryFileWriteError(
        "MEMORY_FILE_PATH_OUTSIDE_TARGET",
        "Memory file path must resolve inside the memory storage target.",
        {
          rootPath,
          path: resolvedPath,
        },
      ),
    );
  }

  return ok(resolvedPath);
}

export async function writeMemoryFile(
  request: MemoryFileWriteRequest,
): Promise<MemoryFileWriteResult> {
  const pathResult = resolveMemoryFilePath(request.target, request.path);

  if (!pathResult.ok) {
    return pathResult;
  }

  if (request.content.length === 0) {
    return err(
      createMemoryFileWriteError(
        "MEMORY_FILE_CONTENT_EMPTY",
        "Memory file content is required.",
      ),
    );
  }

  const resolvedPath = pathResult.value;
  const parentPath = dirname(resolvedPath);
  const parentReady = await ensureWritableParentDirectory(
    parentPath,
    request.createParentDirectory === true,
  );

  if (!parentReady.ok) {
    return parentReady;
  }

  try {
    await writeFile(resolvedPath, request.content, {
      encoding: "utf8",
      flag: "wx",
    });

    return ok({
      path: resolvedPath,
      created: true,
      bytesWritten: countUtf8Bytes(request.content),
    });
  } catch (cause) {
    if (hasNodeErrorCode(cause, "EEXIST")) {
      return err(
        createMemoryFileWriteError(
          "MEMORY_FILE_ALREADY_EXISTS",
          "Memory file already exists and will not be overwritten.",
          { path: resolvedPath },
        ),
      );
    }

    return err(
      createMemoryFileWriteError(
        "MEMORY_FILE_WRITE_FAILED",
        "Memory file could not be written.",
        {
          path: resolvedPath,
          cause: getErrorMessage(cause),
        },
      ),
    );
  }
}

async function ensureWritableParentDirectory(
  parentPath: string,
  createParentDirectory: boolean,
): Promise<Result<true, AeosError>> {
  if (createParentDirectory) {
    try {
      await mkdir(parentPath, { recursive: true });
    } catch (cause) {
      return err(
        createMemoryFileWriteError(
          "MEMORY_FILE_PARENT_CREATE_FAILED",
          "Memory file parent directory could not be created.",
          {
            path: parentPath,
            cause: getErrorMessage(cause),
          },
        ),
      );
    }
  }

  try {
    await access(parentPath, constants.W_OK);
    return ok(true);
  } catch (cause) {
    return err(
      createMemoryFileWriteError(
        "MEMORY_FILE_PARENT_NOT_WRITABLE",
        "Memory file parent directory must exist and be writable.",
        {
          path: parentPath,
          cause: getErrorMessage(cause),
        },
      ),
    );
  }
}

function validateStorageTarget(
  target: MemoryStorageTarget,
): AeosError | undefined {
  if (target.rootPath.trim().length === 0) {
    return createMemoryFileWriteError(
      "MEMORY_STORAGE_TARGET_EMPTY",
      "Memory storage target root path is required.",
    );
  }

  if (
    target.collectionPath !== undefined &&
    target.collectionPath.trim().length === 0
  ) {
    return createMemoryFileWriteError(
      "MEMORY_STORAGE_COLLECTION_EMPTY",
      "Memory storage target collection path must not be empty when provided.",
    );
  }

  return undefined;
}

function isPathWithin(rootPath: string, path: string): boolean {
  const relativePath = relative(rootPath, path);

  return (
    relativePath.length === 0 ||
    (!relativePath.startsWith("..") && !isAbsolute(relativePath))
  );
}

function createMemoryFileWriteError(
  code: string,
  message: string,
  details?: JsonObject,
): AeosError {
  return createAeosError({
    code,
    message,
    retryable: false,
    details,
  });
}

function hasNodeErrorCode(cause: unknown, code: string): boolean {
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    cause.code === code
  );
}

function getErrorMessage(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message;
  }

  return String(cause);
}

function countUtf8Bytes(value: string): number {
  let bytes = 0;

  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.codePointAt(index);

    if (codePoint === undefined) {
      continue;
    }

    if (codePoint > 0xffff) {
      index += 1;
    }

    if (codePoint <= 0x7f) {
      bytes += 1;
    } else if (codePoint <= 0x7ff) {
      bytes += 2;
    } else if (codePoint <= 0xffff) {
      bytes += 3;
    } else {
      bytes += 4;
    }
  }

  return bytes;
}
