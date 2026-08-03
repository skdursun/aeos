// @ts-expect-error This package does not expose Node built-in types yet.
import path from "node:path";

import type {
  ProjectIntelligenceIssue,
  ProjectIntelligenceProfile,
} from "./intelligence.js";

import type {
  ProjectIntelligenceDetectorInput,
  ProjectIntelligenceDetectorIssue,
  ProjectIntelligenceDetectorMode,
  ProjectIntelligenceDetectorResult,
  ProjectIntelligenceDetectorScope,
} from "./intelligence-detector.js";

import {
  countProjectIntelligenceProfile,
  buildProjectIntelligenceProfile,
} from "./intelligence-profile-builder.js";

import type {
  ProjectIntelligenceScanCollectorResult,
} from "./intelligence-scan-collector.js";

import {
  collectProjectScanEntries,
} from "./intelligence-scan-collector.js";

import type {
  ProjectIntelligenceSignalMatcherResult,
} from "./intelligence-signal-matcher.js";

import {
  matchProjectIntelligenceSignals,
} from "./intelligence-signal-matcher.js";

export interface ProjectIntelligenceDetectorOrchestratorSummary {
  readonly mode: ProjectIntelligenceDetectorMode;
  readonly scope: ProjectIntelligenceDetectorScope;
  readonly scannedEntryCount: number;
  readonly scannedEntries: number;
  readonly evidenceCount: number;
  readonly issueCount: number;
  readonly languageCount: number;
  readonly frameworkCount: number;
  readonly packageManagerCount: number;
  readonly runtimeCount: number;
  readonly infrastructureCount: number;
  readonly truncated: boolean;
  readonly timedOut: boolean;
}

export interface ProjectIntelligenceDetectorOrchestratorResult
  extends Omit<ProjectIntelligenceDetectorResult, "summary"> {
  readonly summary: ProjectIntelligenceDetectorOrchestratorSummary;
}

export async function detectProjectIntelligence(
  input: ProjectIntelligenceDetectorInput,
): Promise<ProjectIntelligenceDetectorOrchestratorResult> {
  const collectorResult = await collectProjectScanEntries(input);
  const matcherResult = matchProjectIntelligenceSignals(collectorResult.entries);

  return createProjectIntelligenceDetectorResult(
    input,
    collectorResult,
    matcherResult,
  );
}

export function createProjectIntelligenceDetectorResult(
  input: ProjectIntelligenceDetectorInput,
  collectorResult: ProjectIntelligenceScanCollectorResult,
  matcherResult: ProjectIntelligenceSignalMatcherResult,
): ProjectIntelligenceDetectorOrchestratorResult {
  const issues = sortDetectorIssues([
    ...collectorResult.issues,
    ...matcherResult.issues,
  ]);
  const profile = buildProjectIntelligenceProfile({
    projectRoot: path.resolve(input.projectRoot),
    evidence: matcherResult.evidence,
    issues: issues.map(toProjectIntelligenceIssue),
  });

  return {
    profile,
    scannedEntries: collectorResult.entries,
    issues,
    summary: summarizeProjectIntelligenceDetectorResult(
      input,
      profile,
      collectorResult,
      issues,
    ),
  };
}

export function summarizeProjectIntelligenceDetectorResult(
  input: ProjectIntelligenceDetectorInput,
  profile: ProjectIntelligenceProfile,
  collectorResult: ProjectIntelligenceScanCollectorResult,
  issues: readonly ProjectIntelligenceDetectorIssue[],
): ProjectIntelligenceDetectorOrchestratorSummary {
  const counts = countProjectIntelligenceProfile(profile);
  const reachedLimits = new Set(collectorResult.summary.reachedLimits);

  return {
    mode: input.mode,
    scope: input.scope,
    scannedEntryCount: collectorResult.entries.length,
    scannedEntries: collectorResult.entries.length,
    evidenceCount: counts.evidenceCount,
    issueCount: issues.length,
    languageCount: counts.languageCount,
    frameworkCount: counts.frameworkCount,
    packageManagerCount: counts.packageManagerCount,
    runtimeCount: counts.runtimeCount,
    infrastructureCount: counts.infrastructureCount,
    truncated: collectorResult.summary.reachedLimits.some(
      (limit) => limit !== "timeoutMs_recorded",
    ),
    timedOut: reachedLimits.has("timeoutMs"),
  };
}

function toProjectIntelligenceIssue(
  issue: ProjectIntelligenceDetectorIssue,
): ProjectIntelligenceIssue {
  return {
    code: issue.code,
    message: issue.path === undefined
      ? issue.message
      : `${issue.message} Path: ${issue.path}`,
    severity: issue.severity,
    evidence: [],
  };
}

function sortDetectorIssues(
  issues: readonly ProjectIntelligenceDetectorIssue[],
): readonly ProjectIntelligenceDetectorIssue[] {
  return [...issues].sort(compareDetectorIssues);
}

function compareDetectorIssues(
  left: ProjectIntelligenceDetectorIssue,
  right: ProjectIntelligenceDetectorIssue,
): number {
  const codeComparison = left.code.localeCompare(right.code);

  if (codeComparison !== 0) {
    return codeComparison;
  }

  const pathComparison = (left.path ?? "").localeCompare(right.path ?? "");

  if (pathComparison !== 0) {
    return pathComparison;
  }

  const severityComparison = left.severity.localeCompare(right.severity);

  if (severityComparison !== 0) {
    return severityComparison;
  }

  return left.message.localeCompare(right.message);
}
