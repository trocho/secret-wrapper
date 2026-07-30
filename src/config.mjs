import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";


export class ConfigurationError extends Error {}


export function configurationPath(
  environment = process.env,
  operatingSystem = process.platform,
  home = homedir(),
) {
  if (environment.AGENT_SECRET_WRAPPER_CONFIG) {
    return resolve(environment.AGENT_SECRET_WRAPPER_CONFIG);
  }
  const directory = operatingSystem === "win32"
    ? environment.APPDATA || resolve(home, "AppData", "Roaming")
    : environment.XDG_CONFIG_HOME || resolve(home, ".config");
  return resolve(directory, "agent-secret-wrapper", "providers.json");
}


export function loadConfiguration({
  environment = process.env,
  operatingSystem = process.platform,
  home = homedir(),
  readFile = readFileSync,
} = {}) {
  const path = configurationPath(environment, operatingSystem, home);
  let parsed;
  try {
    parsed = JSON.parse(readFile(path, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { path, providers: {} };
    }
    throw new ConfigurationError(`cannot read provider configuration at ${path}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ConfigurationError(`provider configuration at ${path} must be a JSON object`);
  }
  if (parsed.providers !== undefined && (!parsed.providers || typeof parsed.providers !== "object" || Array.isArray(parsed.providers))) {
    throw new ConfigurationError(`providers at ${path} must be an object`);
  }
  return { path, providers: parsed.providers ?? {} };
}
