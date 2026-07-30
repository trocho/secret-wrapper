import assert from "node:assert/strict";
import test from "node:test";
import { parseArguments } from "../src/cli.mjs";
import { buildChildEnvironment, loadSecret, ProviderError } from "../src/providers.mjs";


test("macOS Keychain binding selects an item and field", () => {
  const calls = [];
  const secret = loadSecret("macos-keychain", { item: "example-mcp", field: "api-key" }, (command, arguments_) => {
    calls.push([command, arguments_]);
    return "token\n";
  });
  assert.equal(secret, "token");
  assert.deepEqual(calls, [["security", ["find-generic-password", "-s", "example-mcp", "-a", "api-key", "-w"]]]);
});


test("Linux Secret Service binding selects an item and field", () => {
  const secret = loadSecret("linux-secret-service", { item: "example-mcp", field: "api-key" }, (command, arguments_) => {
    assert.equal(command, "secret-tool");
    assert.deepEqual(arguments_, ["lookup", "service", "example-mcp", "account", "api-key"]);
    return "token\n";
  });
  assert.equal(secret, "token");
});


test("Windows Credential Manager binding selects one item", () => {
  loadSecret("windows-credential-manager", { item: "a'b" }, (command, arguments_) => {
    assert.equal(command, "powershell");
    assert.match(arguments_.at(-1), /a''b/);
    return "token\r\n";
  });
});


test("Bitwarden binding selects a built-in field", () => {
  const secret = loadSecret("bitwarden", { item: "portainer", field: "password" }, (command, arguments_) => {
    assert.equal(command, "bw");
    assert.deepEqual(arguments_, ["get", "password", "portainer"]);
    return "token\n";
  });
  assert.equal(secret, "token");
});


test("Bitwarden binding selects a custom field", () => {
  const secret = loadSecret("bitwarden", { item: "portainer", field: "api-key" }, (command, arguments_) => {
    assert.equal(command, "bw");
    assert.deepEqual(arguments_, ["get", "item", "portainer"]);
    return JSON.stringify({ fields: [{ name: "api-key", value: "token" }] });
  });
  assert.equal(secret, "token");
});


test("BWS binding reads exactly one secret item", () => {
  const secret = loadSecret("bws", { item: "secret-id", field: "value" }, (command, arguments_) => {
    assert.equal(command, "bws");
    assert.deepEqual(arguments_, ["secret", "get", "secret-id", "--output", "json"]);
    return '{"value":"token"}';
  });
  assert.equal(secret, "token");
});


test("1Password binding combines vault, item, and field", () => {
  const secret = loadSecret("1password", {
    item: "portainer",
    field: "api-key",
    scope: { vault: "Development" },
  }, (command, arguments_) => {
    assert.equal(command, "op");
    assert.deepEqual(arguments_, ["read", "op://Development/portainer/api-key"]);
    return "token\n";
  });
  assert.equal(secret, "token");
});


test("Infisical binding combines an item with scope", () => {
  const secret = loadSecret("infisical", {
    item: "API_TOKEN",
    scope: { project: "project", environment: "prod", path: "/mcp" },
  }, (command, arguments_) => {
    assert.equal(command, "infisical");
    assert.deepEqual(arguments_, [
      "secrets", "get", "API_TOKEN", "--plain", "--silent",
      "--projectId=project", "--env=prod", "--path=/mcp",
    ]);
    return "token\n";
  });
  assert.equal(secret, "token");
});


test("provider authentication is not inherited by the target process", () => {
  const environment = buildChildEnvironment(
    { BWS_ACCESS_TOKEN: "machine-token", PATH: "/bin" },
    "bws",
    "API_TOKEN",
    "secret",
  );
  assert.equal(environment.API_TOKEN, "secret");
  assert.equal(environment.BWS_ACCESS_TOKEN, undefined);
  assert.equal(environment.PATH, "/bin");
});


test("run has one provider-neutral contract", () => {
  assert.deepEqual(parseArguments([
    "run", "--provider", "bws", "--item", "secret-id", "--field", "value",
    "--env", "API_TOKEN", "--", "tool", "arg",
  ]), {
    action: "run",
    options: { provider: "bws", item: "secret-id", field: "value", env: "API_TOKEN" },
    command: ["tool", "arg"],
  });
  assert.throws(() => parseArguments([
    "run", "--provider", "bws", "--env", "API_TOKEN", "--", "tool",
  ]), /--provider, --item, and --env/);
  assert.deepEqual(parseArguments([
    "run", "--provider", "infisical", "--item", "API_TOKEN", "--scope", "project=project",
    "--scope", "environment=prod", "--env", "API_TOKEN", "--", "tool",
  ]).options.scope, ["project=project", "environment=prod"]);
  assert.throws(() => loadSecret("bws", { item: "secret-id", field: "password" }), ProviderError);
  assert.throws(() => loadSecret("1password", {
    item: "portainer", scope: { project: "unexpected" },
  }), /does not support scope/);
});
