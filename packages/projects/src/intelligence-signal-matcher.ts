import type {
  ProjectEvidence,
  ProjectEvidenceSource,
} from "./intelligence.js";

import type {
  ProjectIntelligenceDetectorIssue,
  ProjectIntelligenceScanEntry,
} from "./intelligence-detector.js";

import type {
  ProjectIntelligenceSignalDefinition,
  ProjectIntelligenceSignalSource,
} from "./intelligence-signals.js";

import { PROJECT_INTELLIGENCE_SIGNAL_DEFINITIONS } from "./intelligence-signals.js";

export interface ProjectIntelligenceSignalMatch {
  readonly scanEntry: ProjectIntelligenceScanEntry;
  readonly signal: ProjectIntelligenceSignalDefinition;
}

export interface ProjectIntelligenceSignalMatcherResult {
  readonly evidence: readonly ProjectEvidence[];
  readonly issues: readonly ProjectIntelligenceDetectorIssue[];
  readonly summary: {
    readonly scannedEntries: number;
    readonly matchedSignals: number;
    readonly evidenceCount: number;
    readonly issueCount: number;
  };
}

export function matchProjectIntelligenceSignals(
  scanEntries: readonly ProjectIntelligenceScanEntry[],
  signalDefinitions: readonly ProjectIntelligenceSignalDefinition[] =
    PROJECT_INTELLIGENCE_SIGNAL_DEFINITIONS,
): ProjectIntelligenceSignalMatcherResult {
  const matches: ProjectIntelligenceSignalMatch[] = [];
  const seenMatches = new Set<string>();

  for (const scanEntry of scanEntries) {
    const entryMatches = matchProjectScanEntrySignals(
      scanEntry,
      signalDefinitions,
    );

    for (const match of entryMatches) {
      const matchKey = createSignalMatchKey(match);

      if (seenMatches.has(matchKey)) {
        continue;
      }

      seenMatches.add(matchKey);
      matches.push(match);
    }
  }

  const evidence = matches
    .map((match) => createProjectEvidenceFromSignalMatch(match))
    .sort(compareEvidence);
  const issues = createUnsupportedSignalIssues(signalDefinitions);

  return {
    evidence,
    issues,
    summary: {
      scannedEntries: scanEntries.length,
      matchedSignals: matches.length,
      evidenceCount: evidence.length,
      issueCount: issues.length,
    },
  };
}

export function matchProjectScanEntrySignals(
  scanEntry: ProjectIntelligenceScanEntry,
  signalDefinitions: readonly ProjectIntelligenceSignalDefinition[] =
    PROJECT_INTELLIGENCE_SIGNAL_DEFINITIONS,
): readonly ProjectIntelligenceSignalMatch[] {
  const normalizedEntry = normalizeScanEntry(scanEntry);
  const matches: ProjectIntelligenceSignalMatch[] = [];

  for (const signal of signalDefinitions) {
    if (matchesSignal(normalizedEntry, signal)) {
      matches.push({
        scanEntry: normalizedEntry,
        signal,
      });
    }
  }

  return matches.sort(compareSignalMatches);
}

export function createProjectEvidenceFromSignalMatch(
  match: ProjectIntelligenceSignalMatch,
): ProjectEvidence {
  return {
    id: createProjectEvidenceId(match),
    category: match.signal.category,
    source: toProjectEvidenceSource(match.signal.source),
    path: match.scanEntry.path,
    signal: match.signal.id,
    reason: match.signal.reason,
    confidence: match.signal.confidence,
  };
}

function matchesSignal(
  scanEntry: ProjectIntelligenceScanEntry,
  signal: ProjectIntelligenceSignalDefinition,
): boolean {
  switch (signal.matchKind) {
    case "basename":
      return scanEntry.basename === signal.pattern;
    case "extension":
      return scanEntry.extension === signal.pattern;
    case "relative_path":
      return normalizeRelativePath(scanEntry.path) ===
        normalizeRelativePath(signal.pattern);
    case "manifest_name":
      return matchesManifestName(scanEntry, signal.pattern);
    case "directory_name":
      return scanEntry.kind === "directory" &&
        scanEntry.basename === signal.pattern;
    case "dependency_name":
      return false;
  }
}

function matchesManifestName(
  scanEntry: ProjectIntelligenceScanEntry,
  pattern: string,
): boolean {
  if (pattern.includes("#")) {
    return false;
  }

  const normalizedPattern = normalizeRelativePath(pattern);

  return scanEntry.basename === pattern ||
    normalizeRelativePath(scanEntry.path) === normalizedPattern;
}

function createUnsupportedSignalIssues(
  signalDefinitions: readonly ProjectIntelligenceSignalDefinition[],
): readonly ProjectIntelligenceDetectorIssue[] {
  const issues = new Map<string, ProjectIntelligenceDetectorIssue>();

  for (const signal of signalDefinitions) {
    if (signal.matchKind !== "dependency_name") {
      continue;
    }

    issues.set(signal.id, {
      code: "matcher.signal.dependency_name_unsupported",
      message: `Signal "${signal.id}" was skipped because dependency parsing is not implemented.`,
      severity: "info",
      path: undefined,
    });
  }

  return [...issues.values()].sort(compareIssues);
}

function normalizeScanEntry(
  scanEntry: ProjectIntelligenceScanEntry,
): ProjectIntelligenceScanEntry {
  const normalizedPath = normalizeRelativePath(scanEntry.path);
  const basename = getBasename(normalizedPath);
  const extension = scanEntry.extension ?? getExtension(basename);

  return {
    path: normalizedPath,
    kind: scanEntry.kind,
    sizeBytes: scanEntry.sizeBytes,
    extension,
    basename,
    depth: scanEntry.depth,
  };
}

function normalizeRelativePath(relativePath: string): string {
  return relativePath.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function getBasename(relativePath: string): string {
  const pathWithoutTrailingSlash = relativePath.replace(/\/+$/, "");
  const separatorIndex = pathWithoutTrailingSlash.lastIndexOf("/");

  if (separatorIndex === -1) {
    return pathWithoutTrailingSlash;
  }

  return pathWithoutTrailingSlash.slice(separatorIndex + 1);
}

function getExtension(basename: string): string | undefined {
  const extensionStartIndex = basename.lastIndexOf(".");

  if (extensionStartIndex <= 0) {
    return undefined;
  }

  return basename.slice(extensionStartIndex);
}

function createProjectEvidenceId(
  match: ProjectIntelligenceSignalMatch,
): string {
  return `evidence:${match.scanEntry.path}:${match.signal.id}`;
}

function createSignalMatchKey(match: ProjectIntelligenceSignalMatch): string {
  return `${match.scanEntry.path}\u0000${match.signal.id}`;
}

function toProjectEvidenceSource(
  source: ProjectIntelligenceSignalSource,
): ProjectEvidenceSource {
  switch (source) {
    case "file":
    case "directory":
    case "manifest":
    case "lockfile":
    case "dependency":
      return source;
    case "config":
      return "file";
  }
}

function compareSignalMatches(
  left: ProjectIntelligenceSignalMatch,
  right: ProjectIntelligenceSignalMatch,
): number {
  return compareEvidence(
    createProjectEvidenceFromSignalMatch(left),
    createProjectEvidenceFromSignalMatch(right),
  );
}

function compareEvidence(
  left: ProjectEvidence,
  right: ProjectEvidence,
): number {
  const pathComparison = left.path.localeCompare(right.path);

  if (pathComparison !== 0) {
    return pathComparison;
  }

  const signalComparison = left.signal.localeCompare(right.signal);

  if (signalComparison !== 0) {
    return signalComparison;
  }

  const categoryComparison = left.category.localeCompare(right.category);

  if (categoryComparison !== 0) {
    return categoryComparison;
  }

  return left.id.localeCompare(right.id);
}

function compareIssues(
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

  return left.message.localeCompare(right.message);
}
