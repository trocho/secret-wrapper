import { spawn } from "node:child_process";
import { buildChildEnvironment, loadSecret, ProviderError, providerNames } from "./providers.mjs";


const usage = `Usage:
  agent-secret-wrapper run --provider PROVIDER --item ITEM [--field FIELD] [--scope NAME=VALUE ...] --env ENV_NAME [--debug] -- COMMAND [ARGS...]

Providers:
  ${providerNames.join(", ")}

Run always has the same shape. Item, field, and scope describe the location inside the selected provider.`;


function parseOptionPairs(arguments_, allowed = []) {
  const options = {};
  for (let index = 0; index < arguments_.length;) {
    const option = arguments_[index];
    const name = option?.slice(2);
    if (option === "--debug") {
      if (!allowed.includes(name) || options.debug) {
        throw new ProviderError(`invalid option: ${option}`);
      }
      options.debug = true;
      index += 1;
      continue;
    }
    const value = arguments_[index + 1];
    if (!option?.startsWith("--") || !value || value.startsWith("--") || !allowed.includes(name)) {
      throw new ProviderError(`invalid option: ${option ?? ""}`.trim());
    }
    if (name === "scope") {
      options.scope ??= [];
      options.scope.push(value);
    } else if (options[name]) {
      throw new ProviderError(`--${name} can be supplied only once`);
    } else {
      options[name] = value;
    }
    index += 2;
  }
  return options;
}


function requireRunOptions(options) {
  if (!options.provider || !options.item || !options.env) {
    throw new ProviderError("--provider, --item, and --env are required");
  }
  if (!/^[A-Z_][A-Z0-9_]*$/.test(options.env)) {
    throw new ProviderError("--env must be an uppercase environment variable name");
  }
}


function scopes(values = []) {
  const scope = {};
  for (const value of values) {
    const separator = value.indexOf("=");
    const name = value.slice(0, separator);
    const scopedValue = value.slice(separator + 1);
    if (separator < 1 || !/^[a-z][a-z0-9-]*$/.test(name) || !scopedValue || Object.hasOwn(scope, name)) {
      throw new ProviderError(`invalid scope: ${value}`);
    }
    scope[name] = scopedValue;
  }
  return scope;
}


export function parseArguments(arguments_) {
  if (arguments_.length === 0 || arguments_[0] === "--help" || arguments_[0] === "-h") {
    return { help: true };
  }
  if (arguments_[0] !== "run") {
    throw new ProviderError("expected the run command");
  }
  const separator = arguments_.indexOf("--");
  if (separator === -1 || separator === arguments_.length - 1) {
    throw new ProviderError("provide the target command after --");
  }
  const options = parseOptionPairs(arguments_.slice(1, separator), ["provider", "item", "field", "scope", "env", "debug"]);
  requireRunOptions(options);
  return { action: "run", options, command: arguments_.slice(separator + 1) };
}


function writeDebug(enabled, message) {
  if (enabled) {
    console.error(`agent-secret-wrapper: debug: ${message}`);
  }
}


export function launch(command, environment, debug = false) {
  return new Promise((resolve) => {
    const child = spawn(command[0], command.slice(1), {
      env: environment,
      shell: false,
      stdio: "inherit",
    });
    child.once("error", () => {
      writeDebug(debug, "target process could not start");
      resolve(127);
    });
    child.once("exit", (code) => {
      writeDebug(debug, `target process exited with code ${code ?? 1}`);
      resolve(code ?? 1);
    });
  });
}


export async function run(arguments_) {
  let parsed;
  try {
    parsed = parseArguments(arguments_);
    if (parsed.help) {
      console.log(usage);
      return 0;
    }
    const binding = {
      item: parsed.options.item,
      ...(parsed.options.field ? { field: parsed.options.field } : {}),
      ...(parsed.options.scope?.length ? { scope: scopes(parsed.options.scope) } : {}),
    };
    const scope = Object.keys(binding.scope ?? {}).sort().join(", ") || "none";
    writeDebug(parsed.options.debug, `provider=${parsed.options.provider}; item=${binding.item}; field=${binding.field ?? "default"}; scope=${scope}`);
    writeDebug(parsed.options.debug, "retrieving one secret");
    const secret = loadSecret(parsed.options.provider, binding);
    writeDebug(parsed.options.debug, "secret retrieved; starting target process");
    const environment = buildChildEnvironment(
      process.env,
      parsed.options.provider,
      parsed.options.env,
      secret,
    );
    return await launch(parsed.command, environment, parsed.options.debug);
  } catch (error) {
    writeDebug(parsed?.options?.debug, "operation failed");
    const message = error instanceof Error ? error.message : "secret provider failed";
    console.error(`agent-secret-wrapper: ${message}`);
    return 78;
  }
}
