import { lstatSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";


const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const plugin = resolve(root, "plugins/secret-process-wrapper");
const rootSkill = resolve(root, "skills/secret-process-wrapper");
const pluginSkill = resolve(plugin, "skills/secret-process-wrapper");


function require_(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}


for (const path of [
  resolve(root, ".claude-plugin/marketplace.json"),
  resolve(plugin, ".claude-plugin/plugin.json"),
  resolve(plugin, ".codex-plugin/plugin.json"),
  resolve(rootSkill, "SKILL.md"),
  resolve(root, "package.json"),
  resolve(root, "docs/provider-recipes.md"),
]) {
  require_(statSync(path).isFile(), `missing ${path}`);
}

require_(lstatSync(pluginSkill).isSymbolicLink(), "plugin skill must be a symlink");
require_(realpathSync(pluginSkill) === realpathSync(rootSkill), "plugin skill must point at the root skill");
require_(statSync(pluginSkill).isDirectory(), "plugin skill symlink must resolve to a directory");

const marketplace = JSON.parse(readFileSync(resolve(root, ".claude-plugin/marketplace.json")));
require_(marketplace.plugins[0].source === "./plugins/secret-process-wrapper", "invalid Claude source");

const packageJson = JSON.parse(readFileSync(resolve(root, "package.json")));
require_(packageJson.name === "@trocho/agent-secret-wrapper", "invalid npm package name");
require_(packageJson.private === true, "candidate must not publish to npm");
require_(packageJson.bin["agent-secret-wrapper"] === "./bin/agent-secret-wrapper.mjs", "invalid CLI entrypoint");

console.log("distribution is valid");
