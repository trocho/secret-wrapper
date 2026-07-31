import { spawnSync } from "node:child_process";
import { bitwarden } from "./providers/bitwarden.mjs";
import { bws } from "./providers/bws.mjs";
import { infisical } from "./providers/infisical.mjs";
import { linuxSecretService } from "./providers/linux-secret-service.mjs";
import { macosKeychain } from "./providers/macos-keychain.mjs";
import { onePassword } from "./providers/onepassword.mjs";
import { windowsCredentialManager } from "./providers/windows-credential-manager.mjs";
import { ProviderCommandError, ProviderError } from "./provider-error.mjs";
export { ProviderError, SecretNotFoundError } from "./provider-error.mjs";


const providers = {
  "macos-keychain": macosKeychain,
  "linux-secret-service": linuxSecretService,
  "windows-credential-manager": windowsCredentialManager,
  bitwarden,
  bws,
  "1password": onePassword,
  infisical,
};


export const providerNames = Object.keys(providers);


function providerFor(name) {
  if (!Object.hasOwn(providers, name)) {
    throw new ProviderError(`unsupported provider: ${name}`);
  }
  const provider = providers[name];
  return provider;
}


export function execute(command, arguments_, { input } = {}) {
  const result = spawnSync(command, arguments_, {
    encoding: "utf8",
    stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    ...(input === undefined ? {} : { input }),
  });
  if (result.error || result.status !== 0) {
    throw new ProviderCommandError(command, result);
  }
  return result.stdout;
}


export function loadSecret(provider, binding, runCommand = execute) {
  return providerFor(provider).load(binding, runCommand);
}


export function saveSecret(provider, binding, value, optionsOrRunCommand = {}, maybeRunCommand = execute) {
  const adapter = providerFor(provider);
  if (!adapter.save) {
    throw new ProviderError(`${provider} does not support browser authorization yet`);
  }
  const [options, runCommand] = typeof optionsOrRunCommand === "function"
    ? [{}, optionsOrRunCommand]
    : [optionsOrRunCommand, maybeRunCommand];
  return adapter.save(binding, value, { ...options, runCommand });
}


export function canSaveSecret(provider) {
  return typeof providerFor(provider).save === "function";
}


export function buildChildEnvironment(parentEnvironment, provider, values) {
  const environment = { ...parentEnvironment };
  for (const key of providerFor(provider).scrub) {
    delete environment[key];
  }
  return Object.assign(environment, values);
}
