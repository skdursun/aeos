import {
  getCwd,
  getFs,
  getPath,
  setExitCode,
  writeJsonLine,
  writeStdout,
} from "./output.js";

export function readProjectContext(cwd: string): string | null {
  const fs = getFs();
  const path = getPath();
  const projectContextPath = path.join(cwd, "PROJECT_CONTEXT.md");

  if (!fs.existsSync(projectContextPath)) {
    return null;
  }

  return fs.readFileSync(projectContextPath, "utf8");
}

function printContext(): void {
  const projectContext = readProjectContext(getCwd());

  if (projectContext === null) {
    console.error("Error: PROJECT_CONTEXT.md not found in current directory.");
    setExitCode(1);
    return;
  }

  writeStdout(projectContext);
}

export function createCompactContext(content: string): string {
  const lines = content.split(/\r?\n/);
  const output: string[] = [];
  const sectionNames = new Set(["Goal", "Next Task"]);
  let activeSection: string | undefined;

  for (const line of lines) {
    const trimmed = line.trim();

    if (
      trimmed.startsWith("Project:") ||
      trimmed.startsWith("Product:") ||
      trimmed.startsWith("Current Phase:")
    ) {
      output.push(trimmed);
      activeSection = undefined;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      const sectionName = trimmed.slice(3).trim();
      activeSection = sectionNames.has(sectionName) ? sectionName : undefined;

      if (activeSection !== undefined) {
        output.push(trimmed);
      }

      continue;
    }

    if (activeSection !== undefined && trimmed.length > 0) {
      output.push(trimmed);
    }
  }

  return output.slice(0, 40).join("\n");
}

function printCompactContext(): void {
  const projectContext = readProjectContext(getCwd());

  if (projectContext === null) {
    console.error("Error: PROJECT_CONTEXT.md not found in current directory.");
    setExitCode(1);
    return;
  }

  const compactContext = createCompactContext(projectContext);
  writeStdout(`${compactContext}\n`);
}

function countLines(content: string): number {
  return content.length === 0 ? 0 : content.split(/\r\n|\n|\r/).length;
}

function printContextJson(): void {
  const path = getPath();
  const projectContextPath = path.join(getCwd(), "PROJECT_CONTEXT.md");
  const content = readProjectContext(getCwd());
  const projectContextPresent = content !== null;

  if (!projectContextPresent) {
    writeJsonLine({
      projectContextPath,
      projectContextPresent,
      content: "",
      compact: "",
      lineCount: 0,
    });
    setExitCode(1);
    return;
  }

  writeJsonLine({
    projectContextPath,
    projectContextPresent,
    content,
    compact: createCompactContext(content),
    lineCount: countLines(content),
  });
}

export function handleContext(args: readonly string[]): void {
  try {
    if (args[0] === "--compact") {
      printCompactContext();
    } else if (args[0] === "--json") {
      printContextJson();
    } else {
      printContext();
    }
  } catch (error) {
    console.error("Error: failed to read PROJECT_CONTEXT.md.");
    if (error instanceof Error) {
      console.error(error.message);
    }
    setExitCode(1);
  }
}
