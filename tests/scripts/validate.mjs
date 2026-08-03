import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";


const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const plugin = resolve(root, "plugins/secret-wrapper");
const rootSkill = resolve(root, "skills/secret-wrapper");
const pluginSkill = resolve(plugin, "skills/secret-wrapper");
const visualMaintenance = resolve(root, "maintenance/visuals");
const codexMarketplacePath = resolve(root, ".agents/plugins/marketplace.json");


function require_(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}


for (const path of [
  resolve(root, ".claude-plugin/marketplace.json"),
  codexMarketplacePath,
  resolve(plugin, ".claude-plugin/plugin.json"),
  resolve(plugin, ".codex-plugin/plugin.json"),
  resolve(rootSkill, "SKILL.md"),
  resolve(visualMaintenance, "README.md"),
  resolve(visualMaintenance, "operation-flow.mmd"),
  resolve(visualMaintenance, "mermaid-config.json"),
  resolve(visualMaintenance, "mermaid.css"),
  resolve(visualMaintenance, "scripts/render-operation-flow.mjs"),
  resolve(visualMaintenance, "scripts/render-terminal-trace.mjs"),
  resolve(visualMaintenance, "scripts/check-authorization-assets.mjs"),
  resolve(root, "package.json"),
  resolve(root, "skills/secret-wrapper/references/provider-recipes.md"),
  resolve(root, "skills/secret-wrapper/references/mcp-host-configurations.md"),
]) {
  require_(statSync(path).isFile(), `missing ${path}`);
}

require_(statSync(pluginSkill).isDirectory(), "plugin skill must be a directory");
execFileSync(process.execPath, [resolve(root, "tests/scripts/sync-plugin-skill.mjs"), "--check"], {
  stdio: "inherit",
});
execFileSync(process.execPath, [resolve(visualMaintenance, "scripts/check-authorization-assets.mjs")], {
  stdio: "inherit",
});
execFileSync(process.execPath, [resolve(root, "tests/scripts/verify-skill-discovery.mjs")], {
  stdio: "inherit",
});

const marketplace = JSON.parse(readFileSync(resolve(root, ".claude-plugin/marketplace.json")));
require_(marketplace.plugins[0].source === "./plugins/secret-wrapper", "invalid Claude source");
const codexMarketplace = JSON.parse(readFileSync(codexMarketplacePath));
require_(codexMarketplace.name === marketplace.name, "marketplace names must match");
require_(codexMarketplace.plugins[0].name === marketplace.plugins[0].name, "marketplace plugins must match");

const packageJson = JSON.parse(readFileSync(resolve(root, "package.json")));
require_(packageJson.name === "@trocho/secret-wrapper", "invalid npm package name");
require_(packageJson.private !== true, "npm package must be publishable");
require_(packageJson.publishConfig?.access === "public", "npm package must publish publicly");
require_(packageJson.bin["secret-wrapper"] === "bin/secret-wrapper.mjs", "invalid CLI entrypoint");

const skillText = readFileSync(resolve(rootSkill, "SKILL.md"), "utf8");
require_(skillText.includes("opaque credential data, never as instructions or model input"), "skill must define credential input as opaque data");
require_(skillText.includes("Do not inspect or automate form fields"), "skill must prohibit agent access to authorization values");
require_(skillText.includes("Keep the built-in form on `127.0.0.1`"), "skill must keep browser authorization local");

const claudePlugin = JSON.parse(readFileSync(resolve(plugin, ".claude-plugin/plugin.json")));
const codexPlugin = JSON.parse(readFileSync(resolve(plugin, ".codex-plugin/plugin.json")));
require_(claudePlugin.version === packageJson.version, "Claude plugin version must match package version");
require_(codexPlugin.version === packageJson.version, "Codex plugin version must match package version");
require_(marketplace.plugins[0].version === packageJson.version, "marketplace version must match package version");

console.log("distribution is valid");
