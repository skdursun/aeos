import { getCwd, getFs, getPath, setExitCode, writeJsonLine } from "./output.js";

function formatPresence(isPresent: boolean): "present" | "missing" {
  return isPresent ? "present" : "missing";
}

function formatYesNo(value: boolean): "yes" | "no" {
  return value ? "yes" : "no";
}

function getPackageName(packageJsonPath: string): string {
  const fs = getFs();

  if (!fs.existsSync(packageJsonPath)) {
    return "unknown";
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
      name?: unknown;
    };

    return typeof packageJson.name === "string" && packageJson.name.length > 0
      ? packageJson.name
      : "unknown";
  } catch {
    return "unknown";
  }
}

type StatusSnapshot = {
  projectRoot: string;
  packageName: string;
  workspacePresent: boolean;
  projectContextPresent: boolean;
  agentsFilePresent: boolean;
  gitRepositoryPresent: boolean;
};

export function createStatus(cwd: string): StatusSnapshot {
  const fs = getFs();
  const path = getPath();
  const projectRoot = cwd;

  const packageJsonPath = path.join(projectRoot, "package.json");
  const workspacePath = path.join(projectRoot, "pnpm-workspace.yaml");
  const projectContextPath = path.join(projectRoot, "PROJECT_CONTEXT.md");
  const agentsPath = path.join(projectRoot, "AGENTS.md");
  const gitPath = path.join(projectRoot, ".git");

  return {
    projectRoot,
    packageName: getPackageName(packageJsonPath),
    workspacePresent: fs.existsSync(workspacePath),
    projectContextPresent: fs.existsSync(projectContextPath),
    agentsFilePresent: fs.existsSync(agentsPath),
    gitRepositoryPresent: fs.existsSync(gitPath),
  };
}

function printStatus(status: StatusSnapshot = createStatus(getCwd())): void {
  console.log(`AEOS Status
Project Root: ${status.projectRoot}
Package: ${status.packageName}
Workspace: ${formatYesNo(status.workspacePresent)}
Project Context: ${formatPresence(status.projectContextPresent)}
Agents File: ${formatPresence(status.agentsFilePresent)}
Git Repository: ${formatYesNo(status.gitRepositoryPresent)}`);
}

function printStatusJson(status: StatusSnapshot = createStatus(getCwd())): void {
  writeJsonLine(status);
}

export function handleStatus(args: readonly string[]): void {
  try {
    if (args[0] === "--json") {
      printStatusJson();
    } else {
      printStatus();
    }
  } catch (error) {
    console.error("Error: failed to inspect project status.");
    if (error instanceof Error) {
      console.error(error.message);
    }
    setExitCode(1);
  }
}
