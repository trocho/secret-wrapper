#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";


const maintenanceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");


function readOutput(argv) {
  if (argv.length !== 2 || argv[0] !== "--output" || !argv[1]) {
    throw new Error("usage: render-operation-flow.mjs --output PATH");
  }
  return resolve(argv[1]);
}


const output = readOutput(process.argv.slice(2));
execFileSync("npx", [
  "--yes",
  "@mermaid-js/mermaid-cli@11.16.0",
  "--input", resolve(maintenanceRoot, "operation-flow.mmd"),
  "--output", output,
  "--configFile", resolve(maintenanceRoot, "mermaid-config.json"),
  "--cssFile", resolve(maintenanceRoot, "mermaid.css"),
  "--backgroundColor", "#0a101a",
  "--width", "1200",
  "--height", "860",
], { stdio: "inherit" });

console.log(`wrote ${output} from Mermaid source`);
