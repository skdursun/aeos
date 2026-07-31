import type {
  AeosError,
  AeosErrorCategory,
  JsonObject,
  Result,
} from "./types.js";

export interface CreateAeosErrorInput {
  readonly code: string;
  readonly message: string;
  readonly category?: AeosErrorCategory;
  readonly retryable?: boolean;
  readonly details?: JsonObject;
}

export function ok<T>(value: T): Result<T, never> {
  return {
    ok: true,
    value,
  };
}

export function err<E extends AeosError>(error: E): Result<never, E> {
  return {
    ok: false,
    error,
  };
}

export function isOk<T, E>(result: Result<T, E>): boolean {
  return result.ok;
}

export function isErr<T, E>(result: Result<T, E>): boolean {
  return !result.ok;
}

export function createAeosError(input: CreateAeosErrorInput): AeosError {
  const error: AeosError = {
    code: input.code,
    message: input.message,
    category: input.category ?? "unknown",
    retryable: input.retryable ?? false,
  };

  if (input.details === undefined) {
    return error;
  }

  return {
    ...error,
    details: input.details,
  };
}
