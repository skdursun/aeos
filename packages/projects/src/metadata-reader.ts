// @ts-ignore The package does not currently include Node ambient module types.
import { existsSync as nodeExistsSync, readFileSync as nodeReadFileSync } from "node:fs";
// @ts-ignore The package does not currently include Node ambient module types.
import { resolve as nodeResolve } from "node:path";

const existsSync = nodeExistsSync as (path: string) => boolean;
const readFileSync = nodeReadFileSync as (
  path: string,
  encoding: "utf8",
) => string;
const resolve = nodeResolve as (...paths: readonly string[]) => string;

export interface ProjectMetadata {
  readonly projectRoot: string;
  readonly projectName: string | undefined;
  readonly packageName: string | undefined;
  readonly packageVersion: string | undefined;
  readonly hasProjectContext: boolean;
  readonly hasAgents: boolean;
  readonly hasWorkspace: boolean;
  readonly package: PackageMetadata;
  readonly context: ContextMetadata;
  readonly agents: AgentsMetadata;
}

export interface PackageMetadata {
  readonly path: string;
  readonly exists: boolean;
  readonly name: string | undefined;
  readonly version: string | undefined;
}

export interface ContextMetadata {
  readonly path: string;
  readonly exists: boolean;
  readonly projectName: string | undefined;
}

export interface AgentsMetadata {
  readonly path: string;
  readonly exists: boolean;
}

export function readProjectMetadata(projectRoot: string): ProjectMetadata {
  const rootPath = resolve(projectRoot);
  const packageMetadata = readPackageMetadata(rootPath);
  const contextMetadata = readContextMetadata(rootPath);
  const agentsMetadata = readAgentsMetadata(rootPath);

  return {
    projectRoot: rootPath,
    projectName: contextMetadata.projectName,
    packageName: packageMetadata.name,
    packageVersion: packageMetadata.version,
    hasProjectContext: contextMetadata.exists,
    hasAgents: agentsMetadata.exists,
    hasWorkspace: existsSync(resolve(rootPath, "pnpm-workspace.yaml")),
    package: packageMetadata,
    context: contextMetadata,
    agents: agentsMetadata,
  };
}

export function readPackageMetadata(projectRoot: string): PackageMetadata {
  const packagePath = resolve(projectRoot, "package.json");

  if (!existsSync(packagePath)) {
    return {
      path: packagePath,
      exists: false,
      name: undefined,
      version: undefined,
    };
  }

  try {
    const parsedPackage = JSON.parse(readFileSync(packagePath, "utf8")) as unknown;
    const packageObject = isRecord(parsedPackage) ? parsedPackage : {};

    return {
      path: packagePath,
      exists: true,
      name: readStringProperty(packageObject, "name"),
      version: readStringProperty(packageObject, "version"),
    };
  } catch {
    return {
      path: packagePath,
      exists: true,
      name: undefined,
      version: undefined,
    };
  }
}

export function readContextMetadata(projectRoot: string): ContextMetadata {
  const contextPath = resolve(projectRoot, "PROJECT_CONTEXT.md");

  if (!existsSync(contextPath)) {
    return {
      path: contextPath,
      exists: false,
      projectName: undefined,
    };
  }

  try {
    return {
      path: contextPath,
      exists: true,
      projectName: readProjectName(readFileSync(contextPath, "utf8")),
    };
  } catch {
    return {
      path: contextPath,
      exists: true,
      projectName: undefined,
    };
  }
}

export function readAgentsMetadata(projectRoot: string): AgentsMetadata {
  const agentsPath = resolve(projectRoot, "AGENTS.md");

  return {
    path: agentsPath,
    exists: existsSync(agentsPath),
  };
}

function readProjectName(contextContents: string): string | undefined {
  for (const line of contextContents.split(/\r?\n/u)) {
    const match = /^Project:\s*(.+?)\s*$/u.exec(line);

    if (match === null) {
      continue;
    }

    const value = match[1]?.trim();

    return value === "" ? undefined : value;
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStringProperty(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key];

  return typeof value === "string" && value.trim() !== ""
    ? value
    : undefined;
}
