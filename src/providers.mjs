import { spawnSync } from "node:child_process";


export class ProviderError extends Error {}


function requireBinding(binding, name, provider) {
  const value = binding[name];
  if (!value) {
    throw new ProviderError(`${provider} requires ${name} in its local configuration`);
  }
  return value;
}


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
  const service = requireBinding(binding, "item", "macos-keychain");
  const account = requireBinding(binding, "field", "macos-keychain");
  return trimNewline(runCommand("security", [
    "find-generic-password", "-s", service, "-a", account, "-w",
  ]));
}


function fromLinuxSecretService(binding, runCommand) {
  rejectUnexpectedScope(binding, [], "linux-secret-service");
  const service = requireBinding(binding, "item", "linux-secret-service");
  const account = requireBinding(binding, "field", "linux-secret-service");
  return trimNewline(runCommand("secret-tool", [
    "lookup", "service", service, "account", account,
  ]));
}


function fromWindowsCredentialManager(binding, runCommand) {
  rejectUnexpectedScope(binding, [], "windows-credential-manager");
  if (binding.field) {
    throw new ProviderError("windows-credential-manager has no selectable field");
  }
  const target = requireBinding(binding, "item", "windows-credential-manager");
  const escapedTarget = target.replaceAll("'", "''");
  const script = [
    `$c=Get-StoredCredential -Target '${escapedTarget}'`,
    "if ($null -eq $c) { exit 3 }",
    "[System.Net.NetworkCredential]::new('', $c.Password).Password",
  ].join("; ");
  return trimNewline(runCommand("powershell", [
    "-NoProfile", "-NonInteractive", "-Command", script,
  ]));
}


function fromBitwarden(binding, runCommand) {
  rejectUnexpectedScope(binding, [], "bitwarden");
  const item = requireBinding(binding, "item", "bitwarden");
  const field = binding.field ?? "password";
  if (["password", "username", "uri", "totp"].includes(field)) {
    return trimNewline(runCommand("bw", ["get", field, item]));
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
  return value;
}


function fromBws(binding, runCommand) {
  rejectUnexpectedScope(binding, [], "bws");
  const secretId = requireBinding(binding, "item", "bws");
  if (binding.field && binding.field !== "value") {
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
  return payload.value;
}


function fromOnePassword(binding, runCommand) {
  rejectUnexpectedScope(binding, ["vault"], "1password");
  const vault = scopeValue(binding, "vault");
  const item = requireBinding(binding, "item", "1password");
  const field = binding.field ?? "password";
  if (!vault) {
    throw new ProviderError("1password requires scope vault in its binding");
  }
  const reference = `op://${vault}/${item}/${field}`;
  return trimNewline(runCommand("op", ["read", reference]));
}


function fromInfisical(binding, runCommand) {
  rejectUnexpectedScope(binding, ["project", "environment", "path"], "infisical");
  const key = requireBinding(binding, "item", "infisical");
  if (binding.field && binding.field !== "value") {
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
  return trimNewline(runCommand("infisical", arguments_));
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
