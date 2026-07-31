import {
  createVerificationReport,
  createVerificationResult,
  hasBlockingVerificationResult,
  isVerificationBlocked,
  isVerificationFailed,
  isVerificationPassed,
  isVerificationSkipped,
  summarizeVerificationResults,
} from "./verification-report.js";
import type {
  VerificationReport,
  VerificationResult,
} from "./verification.js";

const passingVerificationResult: VerificationResult = createVerificationResult({
  checkId: "typecheck:pass",
  level: "static_check",
  status: "pass",
  summary: "TypeScript accepted the passing verification example.",
  evidence: [
    {
      kind: "summary",
      summary: "Passing verification helpers are importable.",
    },
  ],
});

const failingVerificationResult: VerificationResult = createVerificationResult({
  checkId: "typecheck:fail",
  level: "static_check",
  status: "fail",
  summary: "TypeScript accepted the failing verification example.",
  failure: {
    code: "TYPECHECK_EXAMPLE_FAILURE",
    message: "Example failure details remain typed.",
    severity: "error",
  },
});

const blockedVerificationResult: VerificationResult = createVerificationResult({
  checkId: "typecheck:blocked",
  level: "static_check",
  status: "blocked",
  summary: "TypeScript accepted the blocked verification example.",
  blockedReason: {
    code: "TYPECHECK_EXAMPLE_BLOCKED",
    message: "Example blocked details remain typed.",
    category: "missing_input",
  },
});

const verificationResults = [
  passingVerificationResult,
  failingVerificationResult,
  blockedVerificationResult,
] as const satisfies readonly VerificationResult[];

const verificationSummary = summarizeVerificationResults(verificationResults);

const verificationReport: VerificationReport = createVerificationReport({
  id: "verification-report:typecheck-example",
  taskId: "TASK-0035",
  checkedScope: {
    taskId: "TASK-0035",
    targets: [
      {
        type: "package",
        name: "@aeos/core",
        path: "packages/core",
      },
    ],
  },
  results: verificationResults,
  evidenceSummary: "Verification report helpers compile without dependencies.",
  generatedAt: "2026-07-31T00:00:00.000Z",
});

const predicateExamples = {
  passed: isVerificationPassed(passingVerificationResult.status),
  failed: isVerificationFailed(failingVerificationResult.status),
  blocked: isVerificationBlocked(blockedVerificationResult.status),
  skipped: isVerificationSkipped("skipped"),
  hasBlockingResult: hasBlockingVerificationResult(verificationResults),
} as const;

export const verificationReportTypecheckExamples = {
  passingVerificationResult,
  failingVerificationResult,
  blockedVerificationResult,
  verificationReport,
  verificationSummary,
  predicateExamples,
} as const;
