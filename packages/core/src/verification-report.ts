import type {
  VerificationCheckId,
  VerificationLevel,
  VerificationReport,
  VerificationResult,
} from "./verification.js";
import type {
  FileChangeSummary,
  ISODateTime,
  JsonObject,
  VerificationStatus,
  VerificationSummary,
} from "./types.js";
import type {
  VerificationAuditReference,
  VerificationBlockedReason,
  VerificationEvidence,
  VerificationFailure,
  VerificationMemoryWriteStatus,
  VerificationPlanId,
  VerificationRunId,
  VerificationScope,
  VerificationSkipReason,
} from "./verification.js";
import type { AuditEventId } from "./audit.js";
import type { PolicyDecisionId } from "./policy.js";
import type { AeosTaskId } from "./tasks.js";

export interface CreateVerificationResultInput {
  readonly checkId: VerificationCheckId;
  readonly runId?: VerificationRunId;
  readonly level: VerificationLevel;
  readonly status: VerificationStatus;
  readonly summary: string;
  readonly evidence?: readonly VerificationEvidence[];
  readonly affectedPaths?: readonly string[];
  readonly exitCode?: number;
  readonly errorCode?: string;
  readonly failure?: VerificationFailure;
  readonly blockedReason?: VerificationBlockedReason;
  readonly skipReason?: VerificationSkipReason;
  readonly policyDecisionId?: PolicyDecisionId;
  readonly auditEventId?: AuditEventId;
  readonly metadata?: JsonObject;
}

export interface CreateVerificationReportInput {
  readonly id: string;
  readonly taskId: AeosTaskId;
  readonly planId?: VerificationPlanId;
  readonly runId?: VerificationRunId;
  readonly status?: VerificationStatus;
  readonly checkedScope: VerificationScope;
  readonly results: readonly VerificationResult[];
  readonly evidenceSummary: string;
  readonly policySummary?: string;
  readonly auditSummary?: string;
  readonly memoryWriteStatus?: VerificationMemoryWriteStatus;
  readonly fileChanges?: readonly FileChangeSummary[];
  readonly summary?: VerificationSummary;
  readonly auditReferences?: readonly VerificationAuditReference[];
  readonly generatedAt: ISODateTime;
  readonly metadata?: JsonObject;
}

export function createVerificationResult(
  input: CreateVerificationResultInput,
): VerificationResult {
  return {
    ...input,
  };
}

export function createVerificationReport(
  input: CreateVerificationReportInput,
): VerificationReport {
  const summary = input.summary ?? summarizeVerificationResults(input.results);

  return {
    id: input.id,
    taskId: input.taskId,
    planId: input.planId,
    runId: input.runId,
    status: input.status ?? summary.status,
    checkedScope: input.checkedScope,
    results: input.results,
    passed: summary.passed,
    failed: summary.failed,
    blocked: summary.blocked,
    skipped: summary.skipped,
    evidenceSummary: input.evidenceSummary,
    policySummary: input.policySummary,
    auditSummary: input.auditSummary,
    memoryWriteStatus: input.memoryWriteStatus,
    fileChanges: input.fileChanges,
    summary,
    auditReferences: input.auditReferences,
    generatedAt: input.generatedAt,
    metadata: input.metadata,
  };
}

export function isVerificationPassed(status: VerificationStatus): boolean {
  return status === "pass";
}

export function isVerificationFailed(status: VerificationStatus): boolean {
  return status === "fail";
}

export function isVerificationBlocked(status: VerificationStatus): boolean {
  return status === "blocked";
}

export function isVerificationSkipped(status: VerificationStatus): boolean {
  return status === "skipped";
}

export function hasBlockingVerificationResult(
  results: readonly VerificationResult[],
): boolean {
  return results.some((result) => isVerificationBlocked(result.status));
}

export function summarizeVerificationResults(
  results: readonly VerificationResult[],
): VerificationSummary {
  const passed: VerificationCheckId[] = [];
  const failed: VerificationCheckId[] = [];
  const blocked: VerificationCheckId[] = [];
  const skipped: VerificationCheckId[] = [];
  const evidence: string[] = [];

  for (const result of results) {
    if (isVerificationPassed(result.status)) {
      passed.push(result.checkId);
    }

    if (isVerificationFailed(result.status)) {
      failed.push(result.checkId);
    }

    if (isVerificationBlocked(result.status)) {
      blocked.push(result.checkId);
    }

    if (isVerificationSkipped(result.status)) {
      skipped.push(result.checkId);
    }

    if (result.evidence !== undefined) {
      for (const item of result.evidence) {
        evidence.push(item.summary);
      }
    }
  }

  return {
    status: getSummaryStatus(results, failed, blocked, skipped),
    checksRun: results.map((result) => result.checkId),
    passed,
    failed,
    blocked,
    skipped,
    evidence,
  };
}

function getSummaryStatus(
  results: readonly VerificationResult[],
  failed: readonly VerificationCheckId[],
  blocked: readonly VerificationCheckId[],
  skipped: readonly VerificationCheckId[],
): VerificationStatus {
  if (blocked.length > 0) {
    return "blocked";
  }

  if (failed.length > 0) {
    return "fail";
  }

  if (results.length === 0 || skipped.length === results.length) {
    return "skipped";
  }

  return "pass";
}
