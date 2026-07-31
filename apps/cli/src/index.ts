#!/usr/bin/env node

declare const process: {
  argv: string[];
  exitCode?: number;
};

const versionText = "aeos 0.0.0";

const helpText = `AEOS CLI
Usage:
  aeos <command>
Commands:
  version
  help`;

const command = process.argv[2] ?? "help";

switch (command) {
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
