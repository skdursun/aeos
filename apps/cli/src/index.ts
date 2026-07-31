#!/usr/bin/env node

import { validateAeosTask } from "@aeos/core";
import type { AeosTask, TaskValidationIssue } from "@aeos/core";

declare const process: {
  argv: string[];
  cwd(): string;
  exitCode?: number;
  stdout: {
    write(value: string): void;
  };
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
  context
  status
  task validate <path>
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

function printContext(): void {
  const fs = process.getBuiltinModule("fs");
  const path = process.getBuiltinModule("path");
  const projectContextPath = path.join(process.cwd(), "PROJECT_CONTEXT.md");

  if (!fs.existsSync(projectContextPath)) {
    console.error("Error: PROJECT_CONTEXT.md not found in current directory.");
    process.exitCode = 1;
    return;
  }

  process.stdout.write(fs.readFileSync(projectContextPath, "utf8"));
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatIssue(issue: TaskValidationIssue): string {
  const location = issue.field ?? issue.path;
  return location === undefined
    ? `- ${issue.message}`
    : `- ${location}: ${issue.message}`;
}

function validateTaskFile(filePath: string | undefined): void {
  if (filePath === undefined || filePath.trim().length === 0) {
    console.error("Error: missing task file path.");
    console.error("Usage: aeos task validate <path>");
    process.exitCode = 1;
    return;
  }

  const fs = process.getBuiltinModule("fs");

  if (!fs.existsSync(filePath)) {
    console.error(`Error: task file not found: ${filePath}`);
    process.exitCode = 1;
    return;
  }

  let parsedTask: unknown;

  try {
    parsedTask = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    console.error(`Error: failed to parse JSON task file: ${filePath}`);
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exitCode = 1;
    return;
  }

  if (!isJsonObject(parsedTask)) {
    console.log("Task validation: fail");
    console.log("- Task file must contain a JSON object.");
    process.exitCode = 1;
    return;
  }

  const result = validateAeosTask(parsedTask as unknown as AeosTask);

  if (result.valid) {
    console.log("Task validation: pass");
    return;
  }

  console.log("Task validation: fail");

  for (const issue of result.issues) {
    console.log(formatIssue(issue));
  }

  process.exitCode = 1;
}

switch (command) {
  case "context":
    try {
      printContext();
    } catch (error) {
      console.error("Error: failed to read PROJECT_CONTEXT.md.");
      if (error instanceof Error) {
        console.error(error.message);
      }
      process.exitCode = 1;
    }
    break;

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

  case "task":
    if (process.argv[3] !== "validate") {
      console.error("Error: unknown task command.");
      console.error("Usage: aeos task validate <path>");
      process.exitCode = 1;
      break;
    }

    validateTaskFile(process.argv[4]);
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
