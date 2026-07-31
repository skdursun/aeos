type FsBuiltin = {
  existsSync(path: string): boolean;
  readFileSync(path: string, encoding: "utf8"): string;
};

type PathBuiltin = {
  join(...paths: string[]): string;
};

declare const process: {
  cwd(): string;
  exitCode?: number;
  stdout: {
    write(value: string): void;
  };
  getBuiltinModule(id: "fs"): FsBuiltin;
  getBuiltinModule(id: "path"): PathBuiltin;
};

export function getCwd(): string {
  return process.cwd();
}

export function setExitCode(exitCode: number): void {
  process.exitCode = exitCode;
}

export function getFs(): FsBuiltin {
  return process.getBuiltinModule("fs");
}

export function getPath(): PathBuiltin {
  return process.getBuiltinModule("path");
}

export function writeStdout(value: string): void {
  process.stdout.write(value);
}

export function writeJsonLine(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}
