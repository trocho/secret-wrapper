import { spawnSync } from "node:child_process";


export class ProviderError extends Error {}


function requireBinding(binding, name, provider) {
  const value = binding[name];
  if (!value) {
    throw new ProviderError(`${provider} requires ${name} in its local configuration`);
  }
  return value;
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
  const service = requireBinding(binding, "service", "macos-keychain");
  const account = requireBinding(binding, "account", "macos-keychain");
  return trimNewline(runCommand("security", [
    "find-generic-password", "-s", service, "-a", account, "-w",
  ]));
}


function fromLinuxSecretService(binding, runCommand) {
  const service = requireBinding(binding, "service", "linux-secret-service");
  const account = requireBinding(binding, "account", "linux-secret-service");
  return trimNewline(runCommand("secret-tool", [
    "lookup", "service", service, "account", account,
  ]));
}


function fromWindowsCredentialManager(binding, runCommand) {
  const target = requireBinding(binding, "target", "windows-credential-manager");
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
  const item = requireBinding(binding, "item", "bitwarden");
  return trimNewline(runCommand("bw", ["get", "password", item]));
}


function fromBws(binding, runCommand) {
  const secretId = requireBinding(binding, "secretId", "bws");
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
  const reference = requireBinding(binding, "reference", "1password");
  return trimNewline(runCommand("op", ["read", reference]));
}


function fromInfisical(binding, runCommand) {
  const key = requireBinding(binding, "secretKey", "infisical");
  const arguments_ = ["secrets", "get", key, "--plain", "--silent"];
  for (const [option, flag] of [
    ["projectId", "--projectId"],
    ["environment", "--env"],
    ["path", "--path"],
  ]) {
    if (binding[option]) {
      arguments_.push(`${flag}=${binding[option]}`);
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


export function defaultBinding(provider, name) {
  switch (provider) {
    case "macos-keychain":
    case "linux-secret-service":
      return { service: "agent-secret-wrapper", account: name };
    case "windows-credential-manager":
      return { target: `agent-secret-wrapper/${name}` };
    case "bitwarden":
      return { item: name };
    case "1password":
      return { reference: `op://agent-secret-wrapper/${name}/password` };
    case "infisical":
      return { secretKey: name };
    case "bws":
      return null;
    default:
      throw new ProviderError(`unsupported provider: ${provider}`);
  }
}


export function resolveBinding(provider, name, providers) {
  const binding = providers?.[provider]?.[name] ?? defaultBinding(provider, name);
  if (!binding || typeof binding !== "object" || Array.isArray(binding)) {
    throw new ProviderError(`configure ${provider} for ${name} before running it`);
  }
  return binding;
}


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
