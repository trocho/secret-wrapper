import { spawn } from "node:child_process";
import { loadConfiguration } from "./config.mjs";
import { buildChildEnvironment, loadSecret, ProviderError, providerNames, resolveBinding } from "./providers.mjs";


const usage = `Usage:
  agent-secret-wrapper run --provider PROVIDER --env ENV_NAME -- COMMAND [ARGS...]

Providers:
  ${providerNames.join(", ")}`;


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
  const options = {};
  for (let index = 1; index < separator; index += 2) {
    const option = arguments_[index];
    const value = arguments_[index + 1];
    if (!option?.startsWith("--") || !value || value.startsWith("--")) {
      throw new ProviderError(`invalid option: ${option ?? ""}`.trim());
    }
    options[option.slice(2)] = value;
  }
  if (!options.provider || !options.env) {
    throw new ProviderError("--provider and --env are required");
  }
  if (!/^[A-Z_][A-Z0-9_]*$/.test(options.env)) {
    throw new ProviderError("--env must be an uppercase environment variable name");
  }
  for (const option of Object.keys(options)) {
    if (!["provider", "env"].includes(option)) {
      throw new ProviderError(`run does not accept --${option}; configure the provider once instead`);
    }
  }
  return { options, command: arguments_.slice(separator + 1) };
}


export function launch(command, environment) {
  return new Promise((resolve) => {
    const child = spawn(command[0], command.slice(1), {
      env: environment,
      shell: false,
      stdio: "inherit",
    });
    child.once("error", () => resolve(127));
    child.once("exit", (code) => resolve(code ?? 1));
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
    const configuration = loadConfiguration();
    const binding = resolveBinding(parsed.options.provider, parsed.options.env, configuration.providers);
    const secret = loadSecret(parsed.options.provider, binding);
    const environment = buildChildEnvironment(
      process.env,
      parsed.options.provider,
      parsed.options.env,
      secret,
    );
    return await launch(parsed.command, environment);
  } catch (error) {
    const message = error instanceof Error ? error.message : "secret provider failed";
    console.error(`agent-secret-wrapper: ${message}`);
    return 78;
  }
}
