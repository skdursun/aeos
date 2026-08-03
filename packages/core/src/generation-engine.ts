import type {
  GenerationArtifact,
  GenerationArtifactKind,
  GenerationArtifactStatus,
  GenerationConflict,
  GenerationConflictCode,
  GenerationRenderedArtifact,
  GenerationRequest,
  GenerationResult,
  GenerationSummary,
} from "./generation.js";
import type { InitIssue } from "./init.js";

export interface GenerationExistingTargetInfo {
  readonly files?: readonly string[];
  readonly directories?: readonly string[];
  readonly inspectionFailures?: readonly GenerationTargetInspectionFailure[];
}

export interface GenerationTargetInspectionFailure {
  readonly targetPath: string;
  readonly message: string;
}

export interface GenerationPlanOptions {
  readonly existingTargets?: GenerationExistingTargetInfo;
}

export interface GenerationPlanArtifact {
  readonly targetPath: string;
  readonly content: string;
  readonly kind: GenerationArtifactKind;
  readonly summary: string;
  readonly sourcePath?: string;
  readonly templateId?: string;
  readonly templateVersion?: string;
}

export interface GenerationPlan {
  readonly targetRoot: string;
  readonly writeMode: GenerationRequest["writeMode"];
  readonly overwrite: false;
  readonly artifacts: readonly GenerationPlanArtifact[];
  readonly conflicts: readonly GenerationConflict[];
}

interface NormalizedTargetPathResult {
  readonly targetPath: string;
  readonly conflict?: GenerationConflict;
}

export function createGenerationPlan(
  request: GenerationRequest,
  options: GenerationPlanOptions = {},
): GenerationPlan {
  const normalizedArtifacts: GenerationPlanArtifact[] = [];
  const pathConflicts: GenerationConflict[] = [];

  for (const artifact of request.artifacts) {
    const normalized = normalizeArtifactTargetPath(artifact);

    if (normalized.conflict !== undefined) {
      pathConflicts.push(normalized.conflict);
    }

    normalizedArtifacts.push({
      targetPath: normalized.targetPath,
      content: artifact.content,
      kind: artifact.kind,
      summary: artifact.summary,
      sourcePath: artifact.sourcePath,
      templateId: artifact.templateId,
      templateVersion: artifact.templateVersion,
    });
  }

  const sortedArtifacts = [...normalizedArtifacts].sort(comparePlanArtifacts);
  const conflicts = [
    ...pathConflicts.sort(compareConflicts),
    ...detectGenerationConflictsFromArtifacts(
      sortedArtifacts,
      options.existingTargets,
    ),
  ].sort(compareConflicts);

  return {
    targetRoot: request.targetRoot,
    writeMode: request.writeMode,
    overwrite: request.overwrite,
    artifacts: sortedArtifacts,
    conflicts,
  };
}

export function detectGenerationConflicts(
  plan: GenerationPlan,
  existingTargets?: GenerationExistingTargetInfo,
): readonly GenerationConflict[] {
  return [...detectGenerationConflictsFromArtifacts(
    plan.artifacts,
    existingTargets,
  )].sort(compareConflicts);
}

export function executeGenerationPlan(
  request: GenerationRequest,
  options: GenerationPlanOptions = {},
): GenerationResult {
  const plan = createGenerationPlan(request, options);
  const blockedTargets = new Set(plan.conflicts.map((conflict) => conflict.targetPath));
  const artifacts = plan.artifacts.map((artifact): GenerationArtifact => {
    const status: GenerationArtifactStatus = blockedTargets.has(artifact.targetPath)
      ? "blocked"
      : "planned";

    return toResultArtifact(artifact, status);
  });
  const errors = plan.conflicts.map(conflictToInitIssue);
  const summary = summarizeGenerationResult({
    targetRoot: plan.targetRoot,
    writeMode: plan.writeMode,
    overwrite: plan.overwrite,
    artifacts,
    conflicts: plan.conflicts,
    errors,
  });

  return {
    ok: plan.conflicts.length === 0 && errors.length === 0,
    targetRoot: plan.targetRoot,
    writeMode: plan.writeMode,
    overwrite: plan.overwrite,
    artifacts,
    conflicts: plan.conflicts,
    errors,
    summary,
  };
}

export function summarizeGenerationResult(input: {
  readonly targetRoot: string;
  readonly writeMode: GenerationRequest["writeMode"];
  readonly overwrite: false;
  readonly artifacts: readonly GenerationArtifact[];
  readonly conflicts: readonly GenerationConflict[];
  readonly errors: readonly InitIssue[];
}): GenerationSummary {
  return {
    targetRoot: input.targetRoot,
    writeMode: input.writeMode,
    overwrite: input.overwrite,
    plannedArtifacts: countArtifactsByStatus(input.artifacts, "planned"),
    generatedArtifacts: countArtifactsByStatus(input.artifacts, "generated"),
    blockedArtifacts: countArtifactsByStatus(input.artifacts, "blocked"),
    failedArtifacts: countArtifactsByStatus(input.artifacts, "failed"),
    conflictCount: input.conflicts.length,
    errorCount: input.errors.length,
  };
}

function normalizeArtifactTargetPath(
  artifact: GenerationRenderedArtifact,
): NormalizedTargetPathResult {
  const rawTargetPath = artifact.targetPath.trim();
  const targetPath = normalizeRelativePath(rawTargetPath);

  if (
    rawTargetPath.length === 0 ||
    targetPath.length === 0 ||
    targetPath === "." ||
    isAbsolutePath(rawTargetPath) ||
    hasParentTraversal(targetPath)
  ) {
    return {
      targetPath: rawTargetPath,
      conflict: createConflict(
        "target_outside_root",
        rawTargetPath,
        "Generation artifact target path must be a safe relative path under the project root.",
        artifact.sourcePath,
      ),
    };
  }

  return { targetPath };
}

function detectGenerationConflictsFromArtifacts(
  artifacts: readonly GenerationPlanArtifact[],
  existingTargets: GenerationExistingTargetInfo = {},
): readonly GenerationConflict[] {
  const conflicts: GenerationConflict[] = [];
  const artifactsByTarget = groupArtifactsByTarget(artifacts);

  for (const [targetPath, targetArtifacts] of artifactsByTarget) {
    if (targetArtifacts.length > 1) {
      for (const artifact of targetArtifacts) {
        conflicts.push(
          createConflict(
            "duplicate_target",
            targetPath,
            "Multiple generation artifacts target the same path.",
            artifact.sourcePath,
            { duplicateCount: String(targetArtifacts.length) },
          ),
        );
      }
    }
  }

  const existingFiles = normalizeExistingTargetSet(existingTargets.files);
  for (const artifact of artifacts) {
    if (existingFiles.has(artifact.targetPath)) {
      conflicts.push(
        createConflict(
          "target_exists",
          artifact.targetPath,
          "Target file already exists and overwrite is disabled.",
          artifact.sourcePath,
        ),
      );
    }
  }

  const existingDirectories = normalizeExistingTargetSet(existingTargets.directories);
  for (const artifact of artifacts) {
    if (existingDirectories.has(artifact.targetPath)) {
      conflicts.push(
        createConflict(
          "target_is_directory",
          artifact.targetPath,
          "Target path is an existing directory.",
          artifact.sourcePath,
        ),
      );
    }

    const parentPath = findExistingParentPath(
      artifact.targetPath,
      existingFiles,
    );

    if (parentPath !== undefined) {
      conflicts.push(
        createConflict(
          "parent_is_file",
          artifact.targetPath,
          "A parent path is an existing file.",
          artifact.sourcePath,
          { parentPath },
        ),
      );
    }
  }

  for (const failure of existingTargets.inspectionFailures ?? []) {
    const targetPath = normalizeRelativePath(failure.targetPath);

    conflicts.push(
      createConflict(
        "target_inspection_failed",
        targetPath,
        failure.message,
        undefined,
      ),
    );
  }

  return conflicts.sort(compareConflicts);
}

function normalizeRelativePath(path: string): string {
  return path
    .replaceAll("\\", "/")
    .split("/")
    .filter((segment) => segment.length > 0 && segment !== ".")
    .join("/");
}

function isAbsolutePath(path: string): boolean {
  return path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path);
}

function hasParentTraversal(path: string): boolean {
  return path.split("/").some((segment) => segment === "..");
}

function groupArtifactsByTarget(
  artifacts: readonly GenerationPlanArtifact[],
): ReadonlyMap<string, readonly GenerationPlanArtifact[]> {
  const grouped = new Map<string, GenerationPlanArtifact[]>();

  for (const artifact of artifacts) {
    const existing = grouped.get(artifact.targetPath);

    if (existing === undefined) {
      grouped.set(artifact.targetPath, [artifact]);
    } else {
      existing.push(artifact);
    }
  }

  return grouped;
}

function normalizeExistingTargetSet(paths: readonly string[] = []): ReadonlySet<string> {
  return new Set(paths.map(normalizeRelativePath));
}

function findExistingParentPath(
  targetPath: string,
  existingFiles: ReadonlySet<string>,
): string | undefined {
  const segments = targetPath.split("/");

  for (let index = 1; index < segments.length; index += 1) {
    const parentPath = segments.slice(0, index).join("/");

    if (existingFiles.has(parentPath)) {
      return parentPath;
    }
  }

  return undefined;
}

function createConflict(
  code: GenerationConflictCode,
  targetPath: string,
  message: string,
  sourcePath?: string,
  details?: Readonly<Record<string, string>>,
): GenerationConflict {
  return {
    code,
    targetPath,
    message,
    sourcePath,
    details,
  };
}

function toResultArtifact(
  artifact: GenerationPlanArtifact,
  status: GenerationArtifactStatus,
): GenerationArtifact {
  return {
    targetPath: artifact.targetPath,
    status,
    kind: artifact.kind,
    summary: artifact.summary,
    sourcePath: artifact.sourcePath,
    templateId: artifact.templateId,
    templateVersion: artifact.templateVersion,
  };
}

function conflictToInitIssue(conflict: GenerationConflict): InitIssue {
  return {
    code: `generation_${conflict.code}`,
    message: conflict.message,
    path: conflict.targetPath,
    details: conflict.details,
  };
}

function countArtifactsByStatus(
  artifacts: readonly GenerationArtifact[],
  status: GenerationArtifactStatus,
): number {
  return artifacts.filter((artifact) => artifact.status === status).length;
}

function comparePlanArtifacts(
  left: GenerationPlanArtifact,
  right: GenerationPlanArtifact,
): number {
  return compareStrings(left.targetPath, right.targetPath);
}

function compareConflicts(
  left: GenerationConflict,
  right: GenerationConflict,
): number {
  return (
    compareStrings(left.targetPath, right.targetPath) ||
    compareStrings(left.code, right.code) ||
    compareStrings(left.sourcePath ?? "", right.sourcePath ?? "")
  );
}

function compareStrings(left: string, right: string): number {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}
