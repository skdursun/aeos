#!/usr/bin/env node

declare const process: {
  argv: string[];
};

import { main } from "./commands.js";

main(process.argv);
