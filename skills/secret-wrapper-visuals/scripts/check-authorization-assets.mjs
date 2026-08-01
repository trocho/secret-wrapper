#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";


const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const expectedPngs = [
  "authorization-form.png",
  "authorization-success.png",
  "authorization-retry.png",
];
const expectedSize = { width: 1200, height: 900 };


function pngSize(path) {
  const bytes = readFileSync(path);
  if (bytes.length < 24 || bytes.toString("ascii", 1, 4) !== "PNG") {
    throw new Error(`${path} is not a PNG`);
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}


for (const file of expectedPngs) {
  const path = resolve(root, "docs/assets", file);
  const size = pngSize(path);
  if (size.width !== expectedSize.width || size.height !== expectedSize.height) {
    throw new Error(`${file} must be ${expectedSize.width}x${expectedSize.height}, got ${size.width}x${size.height}`);
  }
}

const trace = readFileSync(resolve(root, "docs/assets/terminal-flow.svg"), "utf8");
if (!trace.includes('width="1200"') || !trace.includes("sanitized terminal trace")) {
  throw new Error("terminal-flow.svg must be the generated sanitized trace");
}

const operationFlow = readFileSync(resolve(root, "docs/assets/operation-flow.svg"), "utf8");
if (!operationFlow.includes('width="1200"') || !operationFlow.includes("provider-neutral launch sequence")) {
  throw new Error("operation-flow.svg must be the generated provider-neutral sequence");
}

console.log("visual assets are standardized");
