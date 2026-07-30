import { spawnSync } from "node:child_process";


export class ProviderError extends Error {}


function requireOption(options, name, provider) {
  const value = options[name];
  if (!value) {
    throw new ProviderError(`${provider} requires --${name}`);
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


function fromMacosKeychain(options, runCommand) {
  const service = requireOption(options, "service", "macos-keychain");
  const account = requireOption(options, "account", "macos-keychain");
  return trimNewline(runCommand("security", [
    "find-generic-password", "-s", service, "-a", account, "-w",
  ]));
}


function fromLinuxSecretService(options, runCommand) {
  const service = requireOption(options, "service", "linux-secret-service");
  const account = requireOption(options, "account", "linux-secret-service");
  return trimNewline(runCommand("secret-tool", [
    "lookup", "service", service, "account", account,
  ]));
}


function fromWindowsCredentialManager(options, runCommand) {
  const target = requireOption(options, "target", "windows-credential-manager");
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


function fromBitwarden(options, runCommand) {
  const item = requireOption(options, "item", "bitwarden");
  return trimNewline(runCommand("bw", ["get", "password", item]));
}


function fromBws(options, runCommand) {
  const secretId = requireOption(options, "secret-id", "bws");
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


function fromOnePassword(options, runCommand) {
  const reference = requireOption(options, "reference", "1password");
  return trimNewline(runCommand("op", ["read", reference]));
}


function fromInfisical(options, runCommand) {
  const key = requireOption(options, "secret-key", "infisical");
  const arguments_ = ["secrets", "get", key, "--plain", "--silent"];
  for (const [option, flag] of [
    ["project-id", "--projectId"],
    ["environment", "--env"],
    ["path", "--path"],
  ]) {
    if (options[option]) {
      arguments_.push(`${flag}=${options[option]}`);
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


export function loadSecret(provider, options, runCommand = execute) {
  const adapter = PROVIDERS[provider];
  if (!adapter) {
    throw new ProviderError(`unsupported provider: ${provider}`);
  }
  return adapter.load(options, runCommand);
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
