import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";


const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const expectedSkills = ["secret-wrapper"];


function skillNames(path) {
  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(resolve(path, entry.name, "SKILL.md")))
    .map((entry) => entry.name)
    .sort();
}


function requireSame(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} exposes ${actual.join(", ") || "no skills"}; expected ${expected.join(", ")}`);
  }
}


requireSame(skillNames(resolve(root, "skills")), expectedSkills, "repository");
requireSame(skillNames(resolve(root, "plugins/secret-wrapper/skills")), expectedSkills, "plugin");

const maintenance = resolve(root, "maintenance/visuals");
if (!statSync(maintenance).isDirectory() || existsSync(resolve(maintenance, "SKILL.md"))) {
  throw new Error("visual maintenance must remain a non-discoverable repository toolkit");
}

console.log("public skill discovery exposes only secret-wrapper");
