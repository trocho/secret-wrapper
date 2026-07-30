import assert from "node:assert/strict";
import test from "node:test";
import { parseArguments } from "../src/cli.mjs";
import { buildChildEnvironment, loadSecret, ProviderError } from "../src/providers.mjs";


test("macOS Keychain adapter requests service and account", () => {
  const calls = [];
  const secret = loadSecret("macos-keychain", { service: "service", account: "account" }, (command, arguments_) => {
    calls.push([command, arguments_]);
    return "token\n";
  });
  assert.equal(secret, "token");
  assert.deepEqual(calls, [["security", ["find-generic-password", "-s", "service", "-a", "account", "-w"]]]);
});


test("Linux Secret Service adapter requests service and account", () => {
  const secret = loadSecret("linux-secret-service", { service: "service", account: "account" }, (command, arguments_) => {
    assert.equal(command, "secret-tool");
    assert.deepEqual(arguments_, ["lookup", "service", "service", "account", "account"]);
    return "token\n";
  });
  assert.equal(secret, "token");
});


test("Windows Credential Manager target is escaped", () => {
  loadSecret("windows-credential-manager", { target: "a'b" }, (command, arguments_) => {
    assert.equal(command, "powershell");
    assert.match(arguments_.at(-1), /a''b/);
    return "token\r\n";
  });
});


test("Bitwarden Password Manager adapter reads one item", () => {
  const secret = loadSecret("bitwarden", { item: "item-id" }, (command, arguments_) => {
    assert.equal(command, "bw");
    assert.deepEqual(arguments_, ["get", "password", "item-id"]);
    return "token\n";
  });
  assert.equal(secret, "token");
});


test("Bitwarden Secrets Manager adapter reads the value field", () => {
  const secret = loadSecret("bws", { "secret-id": "secret-id" }, (command, arguments_) => {
    assert.equal(command, "bws");
    assert.deepEqual(arguments_, ["secret", "get", "secret-id", "--output", "json"]);
    return '{"value":"token"}';
  });
  assert.equal(secret, "token");
});


test("1Password adapter reads a secret reference", () => {
  const secret = loadSecret("1password", { reference: "op://vault/item/field" }, (command, arguments_) => {
    assert.equal(command, "op");
    assert.deepEqual(arguments_, ["read", "op://vault/item/field"]);
    return "token\n";
  });
  assert.equal(secret, "token");
});


test("Infisical adapter requests one named secret", () => {
  const secret = loadSecret("infisical", {
    "secret-key": "API_TOKEN",
    "project-id": "project",
    environment: "prod",
    path: "/mcp",
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


test("the CLI requires a provider, environment variable, and target command", () => {
  assert.throws(() => parseArguments(["run", "--provider", "bws"]), ProviderError);
  assert.throws(() => parseArguments([
    "run", "--provider", "bws", "--env", "lowercase", "--", "tool",
  ]), /uppercase/);
  assert.deepEqual(parseArguments([
    "run", "--provider", "bws", "--env", "API_TOKEN", "--secret-id", "id", "--", "tool", "arg",
  ]), {
    options: { provider: "bws", env: "API_TOKEN", "secret-id": "id" },
    command: ["tool", "arg"],
  });
});
