#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";


const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const skillPath = resolve(root, "skills/secret-wrapper/SKILL.md");
const markerPattern = /^Source fingerprint: `sha256:[0-9a-f]{64}`\.\s*$/m;


export function fingerprintedSkill(source) {
  const content = source.replace(markerPattern, "").trimEnd();
  const hash = createHash("sha256").update(`${content}\n`).digest("hex");
  return `${content}\n\nSource fingerprint: \`sha256:${hash}\`.\n`;
}


function main(arguments_) {
  const source = readFileSync(skillPath, "utf8");
  const generated = fingerprintedSkill(source);
  if (arguments_.includes("--check")) {
    if (source !== generated) {
      throw new Error("skill source fingerprint is stale; run npm run skill:fingerprint");
    }
    console.log("skill source fingerprint is current");
  } else {
    writeFileSync(skillPath, generated);
    console.log("skill source fingerprint updated");
  }
}


if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
