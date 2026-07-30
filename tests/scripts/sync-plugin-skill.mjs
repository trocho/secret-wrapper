import { cpSync, existsSync, lstatSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";


const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = resolve(root, "skills/secret-wrapper");
const target = resolve(root, "plugins/secret-wrapper/skills/secret-wrapper");
const check = process.argv.includes("--check");


function entries(path) {
  return readdirSync(path, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = join(path, entry.name);
      if (entry.isDirectory()) {
        return entries(entryPath);
      }
      return [entryPath];
    })
    .sort();
}


function matches(left, right) {
  if (!existsSync(left) || !existsSync(right) || !statSync(left).isDirectory() || !lstatSync(right).isDirectory()) {
    return false;
  }
  const leftFiles = entries(left).map((path) => relative(left, path));
  const rightFiles = entries(right).map((path) => relative(right, path));
  return JSON.stringify(leftFiles) === JSON.stringify(rightFiles)
    && leftFiles.every((path) => readFileSync(join(left, path)).equals(readFileSync(join(right, path))));
}


if (check) {
  if (!matches(source, target)) {
    throw new Error("plugin skill is stale; run npm run sync:plugin-skill");
  }
  console.log("plugin skill is synchronized");
} else {
  const temporaryRoot = mkdtempSync(join(tmpdir(), "secret-wrapper-skill-"));
  const staged = join(temporaryRoot, basename(target));
  try {
    cpSync(source, staged, { recursive: true, dereference: true });
    rmSync(target, { recursive: true, force: true });
    cpSync(staged, target, { recursive: true });
    console.log("plugin skill synchronized");
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}
