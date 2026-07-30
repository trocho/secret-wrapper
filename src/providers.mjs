import { spawnSync } from "node:child_process";


export class ProviderError extends Error {}


function scopeValue(binding, name) {
  return binding.scope?.[name];
}


function rejectUnexpectedScope(binding, allowed, provider) {
  for (const name of Object.keys(binding.scope ?? {})) {
    if (!allowed.includes(name)) {
      throw new ProviderError(`${provider} does not support scope ${name}`);
    }
  }
}


function trimNewline(value) {
  return value.replace(/\r?\n$/, "");
}


function selectorPart(binding, index, provider, name) {
  const value = binding.selector?.[index];
  if (!value) {
    throw new ProviderError(`${provider} selector requires ${name}`);
  }
  return value;
}


function selection(value, selector, consumed) {
  return { value, path: selector.slice(consumed) };
}


export function execute(command, arguments_) {
  const result = spawnSync(command, arguments_, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error || result.status !== 0) {
    throw new ProviderError(`${command} could not retrieve the requested secret`);
  }
  return result.stdout;
}


function fromMacosKeychain(binding, runCommand) {
  rejectUnexpectedScope(binding, [], "macos-keychain");
  const service = selectorPart(binding, 0, "macos-keychain", "a service and account");
  const account = selectorPart(binding, 1, "macos-keychain", "a service and account");
  return selection(trimNewline(runCommand("security", [
    "find-generic-password", "-s", service, "-a", account, "-w",
  ])), binding.selector, 2);
}


function fromLinuxSecretService(binding, runCommand) {
  rejectUnexpectedScope(binding, [], "linux-secret-service");
  const service = selectorPart(binding, 0, "linux-secret-service", "a service and account");
  const account = selectorPart(binding, 1, "linux-secret-service", "a service and account");
  return selection(trimNewline(runCommand("secret-tool", [
    "lookup", "service", service, "account", account,
  ])), binding.selector, 2);
}


function fromWindowsCredentialManager(binding, runCommand) {
  rejectUnexpectedScope(binding, [], "windows-credential-manager");
  const target = selectorPart(binding, 0, "windows-credential-manager", "a target");
  const escapedTarget = target.replaceAll("'", "''");
  const script = [
    `$c=Get-StoredCredential -Target '${escapedTarget}'`,
    "if ($null -eq $c) { exit 3 }",
    "[System.Net.NetworkCredential]::new('', $c.Password).Password",
  ].join("; ");
  return selection(trimNewline(runCommand("powershell", [
    "-NoProfile", "-NonInteractive", "-Command", script,
  ])), binding.selector, 1);
}


function fromBitwarden(binding, runCommand) {
  rejectUnexpectedScope(binding, [], "bitwarden");
  const item = selectorPart(binding, 0, "bitwarden", "an item");
  const field = binding.selector[1] ?? "password";
  const consumed = binding.selector[1] ? 2 : 1;
  if (["password", "username", "uri", "totp"].includes(field)) {
    return selection(trimNewline(runCommand("bw", ["get", field, item])), binding.selector, consumed);
  }
  let payload;
  try {
    payload = JSON.parse(runCommand("bw", ["get", "item", item]));
  } catch {
    throw new ProviderError("bitwarden did not return the requested item field");
  }
  const value = field.startsWith("login.")
    ? payload.login?.[field.slice("login.".length)]
    : payload.fields?.find((entry) => entry.name === field)?.value;
  if (typeof value !== "string") {
    throw new ProviderError("bitwarden did not return the requested item field");
  }
  return selection(value, binding.selector, consumed);
}


function fromBws(binding, runCommand) {
  rejectUnexpectedScope(binding, [], "bws");
  const secretId = selectorPart(binding, 0, "bws", "a secret ID");
  if (binding.selector[1] && binding.selector[1] !== "value") {
    throw new ProviderError("bws supports only the value field");
  }
  let payload;
  try {
    payload = JSON.parse(runCommand("bws", [
      "secret", "get", secretId, "--output", "json",
    ]));
  } catch {
    throw new ProviderError("bws did not return a usable secret value");
  }
  if (typeof payload?.value !== "string") {
    throw new ProviderError("bws did not return a usable secret value");
  }
  return selection(payload.value, binding.selector, binding.selector[1] ? 2 : 1);
}


function fromOnePassword(binding, runCommand) {
  rejectUnexpectedScope(binding, ["vault"], "1password");
  const vault = scopeValue(binding, "vault");
  const item = selectorPart(binding, 0, "1password", "an item");
  const field = binding.selector[1] ?? "password";
  const consumed = binding.selector[1] ? 2 : 1;
  if (!vault) {
    throw new ProviderError("1password requires scope vault in its binding");
  }
  const reference = `op://${vault}/${item}/${field}`;
  return selection(trimNewline(runCommand("op", ["read", reference])), binding.selector, consumed);
}


function fromInfisical(binding, runCommand) {
  rejectUnexpectedScope(binding, ["project", "environment", "path"], "infisical");
  const key = selectorPart(binding, 0, "infisical", "a secret key");
  if (binding.selector[1] && binding.selector[1] !== "value") {
    throw new ProviderError("infisical supports only the value field");
  }
  const arguments_ = ["secrets", "get", key, "--plain", "--silent"];
  for (const [option, flag] of [
    ["project", "--projectId"],
    ["environment", "--env"],
    ["path", "--path"],
  ]) {
    if (scopeValue(binding, option)) {
      arguments_.push(`${flag}=${scopeValue(binding, option)}`);
    }
  }
  return selection(trimNewline(runCommand("infisical", arguments_)), binding.selector, binding.selector[1] ? 2 : 1);
}


const PROVIDERS = {
  "macos-keychain": { load: fromMacosKeychain, scrub: [] },
  "linux-secret-service": { load: fromLinuxSecretService, scrub: [] },
  "windows-credential-manager": { load: fromWindowsCredentialManager, scrub: [] },
  bitwarden: {
    load: fromBitwarden,
    scrub: ["BW_SESSION", "BW_CLIENTID", "BW_CLIENTSECRET", "BW_PASSWORD"],
  },
  bws: { load: fromBws, scrub: ["BWS_ACCESS_TOKEN"] },
  "1password": { load: fromOnePassword, scrub: ["OP_SERVICE_ACCOUNT_TOKEN"] },
  infisical: { load: fromInfisical, scrub: ["INFISICAL_TOKEN"] },
};


export const providerNames = Object.keys(PROVIDERS);


export function loadSecret(provider, binding, runCommand = execute) {
  const adapter = PROVIDERS[provider];
  if (!adapter) {
    throw new ProviderError(`unsupported provider: ${provider}`);
  }
  return adapter.load(binding, runCommand);
}


export function buildChildEnvironment(parentEnvironment, provider, name, secret) {
  const adapter = PROVIDERS[provider];
  if (!adapter) {
    throw new ProviderError(`unsupported provider: ${provider}`);
  }
  const environment = { ...parentEnvironment };
  for (const key of adapter.scrub) {
    delete environment[key];
  }
  environment[name] = secret;
  return environment;
}
