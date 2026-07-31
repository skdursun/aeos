import { createAeosError, err, isErr, isOk, ok } from "./result.js";
import type { AeosError, Result } from "./types.js";

const successfulResult: Result<string, AeosError> = ok("ready");

const exampleError: AeosError = createAeosError({
  code: "AEOS_EXAMPLE_ERROR",
  message: "Example error for Result helper typechecking.",
  category: "validation",
  retryable: false,
  details: {
    field: "name",
  },
});

const errorResult: Result<string, AeosError> = err(exampleError);

export const resultHelperExamples = {
  successfulResult,
  errorResult,
  successfulResultIsOk: isOk(successfulResult),
  errorResultIsErr: isErr(errorResult),
  exampleError,
} as const;
