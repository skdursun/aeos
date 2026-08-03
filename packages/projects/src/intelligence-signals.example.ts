import type {
  ProjectIntelligenceSignalCategory,
  ProjectIntelligenceSignalDefinition,
  ProjectIntelligenceSignalMatchKind,
  ProjectIntelligenceSignalSource,
} from "./intelligence-signals.js";

import {
  getProjectIntelligenceSignalsByCategory,
  listProjectIntelligenceSignalDefinitions,
} from "./intelligence-signals.js";

export const exampleProjectIntelligenceSignalDefinition =
  {
    id: "example.language.typescript.tsconfig",
    category: "language",
    target: "typescript",
    source: "config",
    matchKind: "basename",
    pattern: "tsconfig.json",
    confidence: "high",
    reason: "TypeScript project configuration is present.",
  } satisfies ProjectIntelligenceSignalDefinition;

export const exampleProjectIntelligenceSignalCategories =
  [
    "language",
    "framework",
    "package_manager",
    "runtime",
    "infrastructure",
    "monorepo",
  ] as const satisfies readonly ProjectIntelligenceSignalCategory[];

export const exampleProjectIntelligenceSignalSources =
  [
    "file",
    "directory",
    "manifest",
    "lockfile",
    "dependency",
    "config",
  ] as const satisfies readonly ProjectIntelligenceSignalSource[];

export const exampleProjectIntelligenceSignalMatchKinds =
  [
    "basename",
    "extension",
    "relative_path",
    "dependency_name",
    "manifest_name",
    "directory_name",
  ] as const satisfies readonly ProjectIntelligenceSignalMatchKind[];

export const exampleProjectIntelligenceSignalDefinitions =
  [
    exampleProjectIntelligenceSignalDefinition,
    {
      id: "example.language.typescript.extension",
      category: "language",
      target: "typescript",
      source: "file",
      matchKind: "extension",
      pattern: ".ts",
      confidence: "low",
      reason: "TypeScript source files are present.",
    },
    {
      id: "example.language.php.composer",
      category: "language",
      target: "php",
      source: "manifest",
      matchKind: "manifest_name",
      pattern: "composer.json",
      confidence: "high",
      reason: "Composer manifest is present.",
    },
    {
      id: "example.framework.wordpress.config",
      category: "framework",
      target: "wordpress",
      source: "file",
      matchKind: "basename",
      pattern: "wp-config.php",
      confidence: "high",
      reason: "WordPress configuration file is present.",
    },
    {
      id: "example.framework.nextjs.dependency",
      category: "framework",
      target: "nextjs",
      source: "dependency",
      matchKind: "dependency_name",
      pattern: "next",
      confidence: "medium",
      reason: "Next.js package dependency is declared.",
    },
    {
      id: "example.package_manager.pnpm.lockfile",
      category: "package_manager",
      target: "pnpm",
      source: "lockfile",
      matchKind: "basename",
      pattern: "pnpm-lock.yaml",
      confidence: "high",
      reason: "pnpm lockfile is present.",
    },
    {
      id: "example.package_manager.composer.lockfile",
      category: "package_manager",
      target: "composer",
      source: "lockfile",
      matchKind: "basename",
      pattern: "composer.lock",
      confidence: "high",
      reason: "Composer lockfile is present.",
    },
    {
      id: "example.runtime.node.manifest",
      category: "runtime",
      target: "node",
      source: "manifest",
      matchKind: "manifest_name",
      pattern: "package.json",
      confidence: "high",
      reason: "Node package manifest is present.",
    },
    {
      id: "example.infrastructure.docker.config",
      category: "infrastructure",
      target: "docker",
      source: "config",
      matchKind: "basename",
      pattern: "Dockerfile",
      confidence: "high",
      reason: "Dockerfile is present.",
    },
    {
      id: "example.infrastructure.github_actions.workflows",
      category: "infrastructure",
      target: "github_actions",
      source: "directory",
      matchKind: "relative_path",
      pattern: ".github/workflows",
      confidence: "high",
      reason: "GitHub Actions workflows directory is present.",
    },
    {
      id: "example.monorepo.pnpm.workspace",
      category: "monorepo",
      target: "pnpm_workspace",
      source: "config",
      matchKind: "basename",
      pattern: "pnpm-workspace.yaml",
      confidence: "high",
      reason: "pnpm workspace manifest is present.",
    },
    {
      id: "example.monorepo.packages.directory",
      category: "monorepo",
      target: "packages_directory",
      source: "directory",
      matchKind: "directory_name",
      pattern: "packages",
      confidence: "low",
      reason: "Conventional packages directory is present.",
    },
  ] as const satisfies readonly ProjectIntelligenceSignalDefinition[];

export const exampleAllProjectIntelligenceSignalDefinitions =
  listProjectIntelligenceSignalDefinitions();

export const exampleLanguageProjectIntelligenceSignals =
  getProjectIntelligenceSignalsByCategory("language");

export const exampleFrameworkProjectIntelligenceSignals =
  getProjectIntelligenceSignalsByCategory("framework");

export const examplePackageManagerProjectIntelligenceSignals =
  getProjectIntelligenceSignalsByCategory("package_manager");

export const exampleInfrastructureProjectIntelligenceSignals =
  getProjectIntelligenceSignalsByCategory("infrastructure");

export function exampleGetSignalsForCategory(
  category: ProjectIntelligenceSignalCategory,
): readonly ProjectIntelligenceSignalDefinition[] {
  return getProjectIntelligenceSignalsByCategory(category);
}
