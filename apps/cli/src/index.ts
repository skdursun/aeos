#!/usr/bin/env node

declare const process: {
  argv: string[];
  cwd(): string;
  exitCode?: number;
  getBuiltinModule(id: "fs"): {
    existsSync(path: string): boolean;
    readFileSync(path: string, encoding: "utf8"): string;
  };
  getBuiltinModule(id: "path"): {
    join(...paths: string[]): string;
  };
};

const versionText = "aeos 0.0.0";

const helpText = `AEOS CLI
Usage:
  aeos <command>
Commands:
  status
  version
  help`;

const command = process.argv[2] ?? "help";

function formatPresence(isPresent: boolean): "present" | "missing" {
  return isPresent ? "present" : "missing";
}

function formatYesNo(value: boolean): "yes" | "no" {
  return value ? "yes" : "no";
}

function getPackageName(packageJsonPath: string): string {
  const fs = process.getBuiltinModule("fs");

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

function printStatus(): void {
  const fs = process.getBuiltinModule("fs");
  const path = process.getBuiltinModule("path");
  const projectRoot = process.cwd();

  const packageJsonPath = path.join(projectRoot, "package.json");
  const workspacePath = path.join(projectRoot, "pnpm-workspace.yaml");
  const projectContextPath = path.join(projectRoot, "PROJECT_CONTEXT.md");
  const agentsPath = path.join(projectRoot, "AGENTS.md");
  const gitPath = path.join(projectRoot, ".git");

  console.log(`AEOS Status
Project Root: ${projectRoot}
Package: ${getPackageName(packageJsonPath)}
Workspace: ${formatYesNo(fs.existsSync(workspacePath))}
Project Context: ${formatPresence(fs.existsSync(projectContextPath))}
Agents File: ${formatPresence(fs.existsSync(agentsPath))}
Git Repository: ${formatYesNo(fs.existsSync(gitPath))}`);
}

switch (command) {
  case "status":
    try {
      printStatus();
    } catch (error) {
      console.error("Error: failed to inspect project status.");
      if (error instanceof Error) {
        console.error(error.message);
      }
      process.exitCode = 1;
    }
    break;

  case "--version":
  case "version":
    console.log(versionText);
    break;

  case "--help":
  case "help":
    console.log(helpText);
    break;

  default:
    console.error(`Error: unknown command '${command}'`);
    console.error("Run 'aeos help' for usage.");
    process.exitCode = 1;
    break;
}
