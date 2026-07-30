import { spawn } from "node:child_process";
import { buildChildEnvironment, loadSecret, ProviderError, providerNames } from "./providers.mjs";
import { evaluateSelector, parseSelector, selectorText } from "./selector.mjs";


const usage = `Usage:
  secret-wrapper run --provider PROVIDER --bind ENV_NAME=SELECTOR [--bind ENV_NAME=SELECTOR ...] [--scope NAME=VALUE ...] [--debug] -- COMMAND [ARGS...]

Providers:
  ${providerNames.join(", ")}

Selectors support ordered [base64] and [json] transforms; [json] is required before a JSON property.
Run always has the same shape. Each bind names a target environment variable and the selector that supplies it. See README for provider recipes.`;


const processControlVariables = new Set([
  "PATH", "NODE_OPTIONS", "LD_PRELOAD", "LD_LIBRARY_PATH",
  "DYLD_INSERT_LIBRARIES", "DYLD_LIBRARY_PATH", "PYTHONPATH", "RUBYOPT",
]);


function parseOptionPairs(arguments_, allowed = [], repeatable = []) {
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
    if (repeatable.includes(name)) {
      options[name] ??= [];
      options[name].push(value);
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
  if (!options.provider || !options.bind?.length) {
    throw new ProviderError("--provider and at least one --bind are required");
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


function parseRunArguments(arguments_) {
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
  const options = parseOptionPairs(
    arguments_.slice(1, separator),
    ["provider", "bind", "scope", "debug"],
    ["bind", "scope"],
  );
  requireRunOptions(options);
  return {
    action: "run",
    options,
    bindings: parseBindings(options),
    command: arguments_.slice(separator + 1),
  };
}


export function parseArguments(arguments_) {
  const parsed = parseRunArguments(arguments_);
  if (parsed.help) {
    return parsed;
  }
  const { bindings: _bindings, ...result } = parsed;
  return result;
}


function writeDebug(enabled, message) {
  if (enabled) {
    console.error(`secret-wrapper: debug: ${message}`);
  }
}


function namedValue(value, option) {
  const separator = value.indexOf("=");
  const name = value.slice(0, separator);
  const selectedValue = value.slice(separator + 1);
  if (separator < 1 || !/^[A-Z_][A-Z0-9_]*$/.test(name) || !selectedValue
    || (option === "--bind" && processControlVariables.has(name))) {
    throw new ProviderError(`invalid ${option}: ${value}`);
  }
  return [name, selectedValue];
}


export function parseBindings(options) {
  const bindings = {};
  for (const value of options.bind ?? []) {
    const [name, selector] = namedValue(value, "--bind");
    if (Object.hasOwn(bindings, name)) {
      throw new ProviderError(`invalid --bind: ${value}`);
    }
    bindings[name] = { name, selector: parseSelector(selector) };
  }
  return Object.values(bindings);
}


export function resolveBindingSecret(selected) {
  return evaluateSelector(selected.value, selected.operations);
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


export async function run(arguments_, dependencies = {}) {
  const {
    load = loadSecret,
    buildEnvironment = buildChildEnvironment,
    launchProcess = launch,
    parentEnvironment = process.env,
  } = dependencies;
  let parsed;
  try {
    parsed = parseRunArguments(arguments_);
    if (parsed.help) {
      console.log(usage);
      return 0;
    }
    const scope = parsed.options.scope?.length ? scopes(parsed.options.scope) : undefined;
    const bindings = parsed.bindings.map((binding) => ({
      ...binding,
      ...(scope ? { scope } : {}),
    }));
    if (parsed.options.debug) {
      const scopeNames = Object.keys(scope ?? {}).sort().join(", ") || "none";
      const bindingSummary = bindings.map((binding) => `${binding.name}=${selectorText(binding.selector)}`).join(", ");
      writeDebug(true, `provider=${parsed.options.provider}; binds=${bindingSummary}; scope=${scopeNames}`);
    }
    writeDebug(parsed.options.debug, `retrieving ${bindings.length} secret value${bindings.length === 1 ? "" : "s"}`);
    const values = {};
    for (const binding of bindings) {
      values[binding.name] = resolveBindingSecret(load(parsed.options.provider, binding));
    }
    writeDebug(parsed.options.debug, "secret values retrieved; starting target process");
    const environment = buildEnvironment(
      parentEnvironment,
      parsed.options.provider,
      values,
    );
    return await launchProcess(parsed.command, environment, parsed.options.debug);
  } catch (error) {
    writeDebug(parsed?.options?.debug, "operation failed");
    const message = error instanceof Error ? error.message : "secret provider failed";
    console.error(`secret-wrapper: ${message}`);
    return 78;
  }
}
