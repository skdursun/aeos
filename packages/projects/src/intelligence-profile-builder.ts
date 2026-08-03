import type {
  ProjectConfidence,
  ProjectEvidence,
  ProjectFramework,
  ProjectFrameworkSignal,
  ProjectInfrastructure,
  ProjectInfrastructureSignal,
  ProjectIntelligenceIssue,
  ProjectIntelligenceProfile,
  ProjectIntelligenceSummary,
  ProjectLanguage,
  ProjectLanguageSignal,
  ProjectMonorepoKind,
  ProjectMonorepoSignal,
  ProjectPackageManager,
  ProjectPackageManagerSignal,
  ProjectRuntime,
  ProjectRuntimeSignal,
} from "./intelligence.js";

export interface ProjectIntelligenceProfileBuilderInput {
  readonly projectRoot: string;
  readonly evidence: readonly ProjectEvidence[];
  readonly issues?: readonly ProjectIntelligenceIssue[];
}

export interface ProjectIntelligenceProfileCounts {
  readonly languageCount: number;
  readonly frameworkCount: number;
  readonly packageManagerCount: number;
  readonly runtimeCount: number;
  readonly infrastructureCount: number;
  readonly evidenceCount: number;
  readonly issueCount: number;
}

export type ProjectEvidenceBySignal = Readonly<Record<string, readonly ProjectEvidence[]>>;

type CategoryTarget =
  | ProjectLanguage
  | ProjectFramework
  | ProjectPackageManager
  | ProjectRuntime
  | ProjectInfrastructure
  | ProjectMonorepoKind;

interface SignalBucket<TTarget extends CategoryTarget> {
  readonly target: TTarget;
  readonly confidence: ProjectConfidence;
  readonly evidence: readonly string[];
  readonly paths: readonly string[];
}

const confidenceRank: Readonly<Record<ProjectConfidence, number>> = {
  unknown: 0,
  low: 1,
  medium: 2,
  high: 3,
};

export function buildProjectIntelligenceProfile(
  input: ProjectIntelligenceProfileBuilderInput,
): ProjectIntelligenceProfile {
  const issues = input.issues ?? [];
  const languages = buildSignals(
    input.evidence,
    "language",
    isProjectLanguage,
    (bucket): ProjectLanguageSignal => ({
      language: bucket.target,
      confidence: bucket.confidence,
      evidence: bucket.evidence,
    }),
  );
  const frameworks = buildSignals(
    input.evidence,
    "framework",
    isProjectFramework,
    (bucket): ProjectFrameworkSignal => ({
      framework: bucket.target,
      confidence: bucket.confidence,
      evidence: bucket.evidence,
    }),
  );
  const packageManagers = buildSignals(
    input.evidence,
    "package_manager",
    isProjectPackageManager,
    (bucket): ProjectPackageManagerSignal => ({
      packageManager: bucket.target,
      confidence: bucket.confidence,
      evidence: bucket.evidence,
    }),
  );
  const runtimes = buildSignals(
    input.evidence,
    "runtime",
    isProjectRuntime,
    (bucket): ProjectRuntimeSignal => ({
      runtime: bucket.target,
      versionConstraint: undefined,
      confidence: bucket.confidence,
      evidence: bucket.evidence,
    }),
  );
  const infrastructure = buildSignals(
    input.evidence,
    "infrastructure",
    isProjectInfrastructure,
    (bucket): ProjectInfrastructureSignal => ({
      infrastructure: bucket.target,
      confidence: bucket.confidence,
      evidence: bucket.evidence,
    }),
  );
  const monorepo = buildMonorepoSignal(input.evidence);

  const profileWithoutSummary = {
    projectRoot: input.projectRoot,
    languages,
    frameworks,
    packageManagers,
    runtimes,
    infrastructure,
    monorepo,
    evidence: input.evidence,
    issues,
  };

  return {
    ...profileWithoutSummary,
    summary: summarizeProjectIntelligenceProfile(profileWithoutSummary),
  };
}

export function summarizeProjectIntelligenceProfile(
  profile: Omit<ProjectIntelligenceProfile, "summary">,
): ProjectIntelligenceSummary {
  return {
    confidence: strongestConfidence([
      ...profile.languages.map((signal) => signal.confidence),
      ...profile.frameworks.map((signal) => signal.confidence),
      ...profile.packageManagers.map((signal) => signal.confidence),
      ...profile.runtimes.map((signal) => signal.confidence),
      ...profile.infrastructure.map((signal) => signal.confidence),
      profile.monorepo.confidence,
    ]),
    primaryLanguage: selectPrimary(
      profile.languages,
      (signal) => signal.language,
      (signal) => signal.confidence,
      "unknown",
    ),
    primaryFramework: selectPrimary(
      profile.frameworks,
      (signal) => signal.framework,
      (signal) => signal.confidence,
      "unknown",
    ),
    primaryPackageManager: selectPrimary(
      profile.packageManagers,
      (signal) => signal.packageManager,
      (signal) => signal.confidence,
      "unknown",
    ),
    primaryRuntime: selectPrimary(
      profile.runtimes,
      (signal) => signal.runtime,
      (signal) => signal.confidence,
      "unknown",
    ),
    hasInfrastructure: profile.infrastructure.length > 0,
    isMonorepo: profile.monorepo.isMonorepo,
  };
}

export function countProjectIntelligenceProfile(
  profile: ProjectIntelligenceProfile,
): ProjectIntelligenceProfileCounts {
  return {
    languageCount: profile.languages.length,
    frameworkCount: profile.frameworks.length,
    packageManagerCount: profile.packageManagers.length,
    runtimeCount: profile.runtimes.length,
    infrastructureCount: profile.infrastructure.length,
    evidenceCount: profile.evidence.length,
    issueCount: profile.issues.length,
  };
}

export function groupProjectEvidenceBySignal(
  evidence: readonly ProjectEvidence[],
): ProjectEvidenceBySignal {
  const grouped = new Map<string, ProjectEvidence[]>();

  for (const item of evidence) {
    const existing = grouped.get(item.signal);

    if (existing === undefined) {
      grouped.set(item.signal, [item]);
      continue;
    }

    existing.push(item);
  }

  return Object.fromEntries(
    [...grouped.entries()]
      .sort(([leftSignal], [rightSignal]) => leftSignal.localeCompare(rightSignal))
      .map(([signal, items]) => [signal, [...items].sort(compareEvidence)]),
  );
}

function buildSignals<TTarget extends CategoryTarget, TSignal>(
  evidence: readonly ProjectEvidence[],
  category: ProjectEvidence["category"],
  isTarget: (target: string) => target is TTarget,
  createSignal: (bucket: SignalBucket<TTarget>) => TSignal,
): readonly TSignal[] {
  const buckets = new Map<TTarget, ProjectEvidence[]>();

  for (const item of evidence) {
    if (item.category !== category) {
      continue;
    }

    const target = getSignalTarget(item.signal);

    if (!isTarget(target)) {
      continue;
    }

    const existing = buckets.get(target);

    if (existing === undefined) {
      buckets.set(target, [item]);
      continue;
    }

    existing.push(item);
  }

  return [...buckets.entries()]
    .sort(([leftTarget], [rightTarget]) => leftTarget.localeCompare(rightTarget))
    .map(([target, items]) =>
      createSignal({
        target,
        confidence: strongestConfidence(items.map((item) => item.confidence)),
        evidence: uniqueSorted(items.map((item) => item.id)),
        paths: uniqueSorted(items.map((item) => item.path)),
      }),
    );
}

function buildMonorepoSignal(
  evidence: readonly ProjectEvidence[],
): ProjectMonorepoSignal {
  const monorepoSignals = buildSignals(
    evidence,
    "monorepo",
    isProjectMonorepoKind,
    (bucket): ProjectMonorepoSignal => ({
      isMonorepo: true,
      kind: bucket.target,
      workspacePaths: bucket.paths,
      confidence: bucket.confidence,
      evidence: bucket.evidence,
    }),
  );

  if (monorepoSignals.length === 0) {
    return {
      isMonorepo: false,
      kind: "unknown",
      workspacePaths: [],
      confidence: "unknown",
      evidence: [],
    };
  }

  return [...monorepoSignals].sort(compareMonorepoSignals)[0]!;
}

function getSignalTarget(signal: string): string {
  const [, target] = signal.split(".");

  return target ?? "unknown";
}

function strongestConfidence(
  confidences: readonly ProjectConfidence[],
): ProjectConfidence {
  let strongest: ProjectConfidence = "unknown";

  for (const confidence of confidences) {
    if (confidenceRank[confidence] > confidenceRank[strongest]) {
      strongest = confidence;
    }
  }

  return strongest;
}

function selectPrimary<TSignal, TTarget extends string>(
  signals: readonly TSignal[],
  getTarget: (signal: TSignal) => TTarget,
  getConfidence: (signal: TSignal) => ProjectConfidence,
  fallback: TTarget,
): TTarget {
  const [primary] = [...signals].sort((left, right) => {
    const confidenceComparison =
      confidenceRank[getConfidence(right)] - confidenceRank[getConfidence(left)];

    if (confidenceComparison !== 0) {
      return confidenceComparison;
    }

    return getTarget(left).localeCompare(getTarget(right));
  });

  return primary === undefined ? fallback : getTarget(primary);
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function compareMonorepoSignals(
  left: ProjectMonorepoSignal,
  right: ProjectMonorepoSignal,
): number {
  const confidenceComparison =
    confidenceRank[right.confidence] - confidenceRank[left.confidence];

  if (confidenceComparison !== 0) {
    return confidenceComparison;
  }

  return left.kind.localeCompare(right.kind);
}

function compareEvidence(left: ProjectEvidence, right: ProjectEvidence): number {
  const pathComparison = left.path.localeCompare(right.path);

  if (pathComparison !== 0) {
    return pathComparison;
  }

  const signalComparison = left.signal.localeCompare(right.signal);

  if (signalComparison !== 0) {
    return signalComparison;
  }

  return left.id.localeCompare(right.id);
}

function isProjectLanguage(target: string): target is ProjectLanguage {
  return [
    "typescript",
    "javascript",
    "php",
    "python",
    "go",
    "rust",
    "unknown",
  ].includes(target);
}

function isProjectFramework(target: string): target is ProjectFramework {
  return [
    "wordpress",
    "nextjs",
    "react",
    "laravel",
    "fastapi",
    "unknown",
  ].includes(target);
}

function isProjectPackageManager(
  target: string,
): target is ProjectPackageManager {
  return [
    "pnpm",
    "npm",
    "yarn",
    "composer",
    "pip",
    "uv",
    "gomod",
    "cargo",
    "unknown",
  ].includes(target);
}

function isProjectRuntime(target: string): target is ProjectRuntime {
  return ["node", "php", "python", "go", "rust", "unknown"].includes(target);
}

function isProjectInfrastructure(
  target: string,
): target is ProjectInfrastructure {
  return ["docker", "github_actions", "terraform", "unknown"].includes(target);
}

function isProjectMonorepoKind(target: string): target is ProjectMonorepoKind {
  return [
    "pnpm_workspace",
    "npm_workspaces",
    "yarn_workspaces",
    "cargo_workspace",
    "go_workspace",
    "packages_directory",
    "unknown",
  ].includes(target);
}
