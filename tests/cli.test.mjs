import assert from "node:assert/strict";
import test from "node:test";
import { parseArguments, parseBindings, resolveBindingSecret } from "../src/cli.mjs";
import { buildChildEnvironment, loadSecret, ProviderError } from "../src/providers.mjs";
import { decodeSecret, parseSelector, selectJsonPath } from "../src/selector.mjs";


test("a selector separates locator, field, and nested JSON path", () => {
  assert.deepEqual(parseSelector("portainer.api-key.connection.token"), [
    "portainer", "api-key", "connection", "token",
  ]);
  assert.deepEqual(parseSelector("com\\.example\\.portainer.api-key"), [
    "com.example.portainer", "api-key",
  ]);
  assert.deepEqual(parseSelector("portainer.login\\.username"), ["portainer", "login.username"]);
  assert.throws(() => parseSelector("portainer..api-key"), /cannot be empty/);
  assert.throws(() => parseSelector("portainer\\x"), /may contain only/);
});


test("macOS Keychain selector selects a service and account", () => {
  const calls = [];
  const selected = loadSecret("macos-keychain", {
    selector: parseSelector("example-mcp.api-key"),
  }, (command, arguments_) => {
    calls.push([command, arguments_]);
    return "token\n";
  });
  assert.deepEqual(selected, { value: "token", path: [] });
  assert.deepEqual(calls, [["security", ["find-generic-password", "-s", "example-mcp", "-a", "api-key", "-w"]]]);
});


test("Linux Secret Service selector selects a service and account", () => {
  const selected = loadSecret("linux-secret-service", {
    selector: parseSelector("example-mcp.api-key"),
  }, (command, arguments_) => {
    assert.equal(command, "secret-tool");
    assert.deepEqual(arguments_, ["lookup", "service", "example-mcp", "account", "api-key"]);
    return "token\n";
  });
  assert.deepEqual(selected, { value: "token", path: [] });
});


test("Windows Credential Manager selector selects one target and can traverse JSON", () => {
  const selected = loadSecret("windows-credential-manager", {
    selector: parseSelector("portainer.secret.token"),
  }, (command, arguments_) => {
    assert.equal(command, "powershell");
    assert.match(arguments_.at(-1), /portainer/);
    return '{"secret":{"token":"value"}}\r\n';
  });
  assert.equal(selectJsonPath(selected.value, selected.path), "value");
});


test("Bitwarden selector selects a built-in or custom field", () => {
  const builtin = loadSecret("bitwarden", {
    selector: parseSelector("portainer.password"),
  }, (command, arguments_) => {
    assert.equal(command, "bw");
    assert.deepEqual(arguments_, ["get", "password", "portainer"]);
    return "token\n";
  });
  assert.deepEqual(builtin, { value: "token", path: [] });

  const custom = loadSecret("bitwarden", {
    selector: parseSelector("portainer.config.api.token"),
  }, (command, arguments_) => {
    assert.equal(command, "bw");
    assert.deepEqual(arguments_, ["get", "item", "portainer"]);
    return JSON.stringify({ fields: [{ name: "config", value: '{"api":{"token":"value"}}' }] });
  });
  assert.equal(selectJsonPath(custom.value, custom.path), "value");
});


test("BWS selector reads one secret and accepts its value segment", () => {
  const selected = loadSecret("bws", {
    selector: parseSelector("secret-id.value"),
  }, (command, arguments_) => {
    assert.equal(command, "bws");
    assert.deepEqual(arguments_, ["secret", "get", "secret-id", "--output", "json"]);
    return '{"value":"token"}';
  });
  assert.deepEqual(selected, { value: "token", path: [] });
});


test("1Password selector combines vault, item, and field", () => {
  const selected = loadSecret("1password", {
    selector: parseSelector("portainer.api-key"),
    scope: { vault: "Development" },
  }, (command, arguments_) => {
    assert.equal(command, "op");
    assert.deepEqual(arguments_, ["read", "op://Development/portainer/api-key"]);
    return "token\n";
  });
  assert.deepEqual(selected, { value: "token", path: [] });
});


test("Infisical selector combines a key with scope", () => {
  const selected = loadSecret("infisical", {
    selector: parseSelector("API_TOKEN.value"),
    scope: { project: "project", environment: "prod", path: "/mcp" },
  }, (command, arguments_) => {
    assert.equal(command, "infisical");
    assert.deepEqual(arguments_, [
      "secrets", "get", "API_TOKEN", "--plain", "--silent",
      "--projectId=project", "--env=prod", "--path=/mcp",
    ]);
    return "token\n";
  });
  assert.deepEqual(selected, { value: "token", path: [] });
});


test("JSON selection returns scalar values only", () => {
  assert.equal(selectJsonPath('{"api":{"enabled":true,"port":443}}', ["api", "enabled"]), "true");
  assert.equal(selectJsonPath('{"api":{"enabled":true,"port":443}}', ["api", "port"]), "443");
  assert.throws(() => selectJsonPath("not-json", ["api"]), /not valid JSON/);
  assert.throws(() => selectJsonPath('{"api":{}}', ["api", "token"]), /does not contain token/);
  assert.throws(() => selectJsonPath('{"api":{}}', ["api"]), /must resolve/);
});


test("base64 decoding is explicit and rejects malformed or binary values", () => {
  assert.equal(decodeSecret("cG9ydGFpbmVyLXRva2Vu", "base64"), "portainer-token");
  assert.equal(decodeSecret("token", undefined), "token");
  assert.throws(() => decodeSecret("not base64!", "base64"), /not valid base64/);
  assert.throws(() => decodeSecret("/w==", "base64"), /not valid UTF-8/);
  assert.throws(() => decodeSecret("dG9rZW4=", "rot13"), /unsupported decoding/);
});


test("provider authentication is not inherited by the target process", () => {
  const environment = buildChildEnvironment(
    { BWS_ACCESS_TOKEN: "machine-token", PATH: "/bin" },
    "bws",
    { API_TOKEN: "secret", USERNAME: "operator" },
  );
  assert.equal(environment.API_TOKEN, "secret");
  assert.equal(environment.USERNAME, "operator");
  assert.equal(environment.BWS_ACCESS_TOKEN, undefined);
  assert.equal(environment.PATH, "/bin");
});


test("run has one provider-neutral bind contract", () => {
  assert.deepEqual(parseArguments([
    "run", "--provider", "bws", "--bind", "API_TOKEN=secret-id.value",
    "--bind", "USERNAME=secret-id.value.user", "--decode-record", "API_TOKEN=base64",
    "--decode", "API_TOKEN=base64", "--", "tool", "arg",
  ]), {
    action: "run",
    options: {
      provider: "bws",
      bind: ["API_TOKEN=secret-id.value", "USERNAME=secret-id.value.user"],
      "decode-record": ["API_TOKEN=base64"],
      decode: ["API_TOKEN=base64"],
    },
    command: ["tool", "arg"],
  });
  assert.throws(() => parseArguments([
    "run", "--provider", "bws", "--", "tool",
  ]), /--provider and at least one --bind/);
  assert.deepEqual(parseArguments([
    "run", "--provider", "infisical", "--bind", "API_TOKEN=API_TOKEN.value", "--scope", "project=project",
    "--scope", "environment=prod", "--", "tool",
  ]).options.scope, ["project=project", "environment=prod"]);
  assert.equal(parseArguments([
    "run", "--provider", "bws", "--bind", "API_TOKEN=secret-id", "--debug", "--", "tool",
  ]).options.debug, true);
  assert.throws(() => parseArguments([
    "run", "--provider", "bws", "--bind", "API_TOKEN=secret-id", "--decode", "OTHER=base64", "--", "tool",
  ]), /invalid --decode/);
  assert.throws(() => parseArguments([
    "run", "--provider", "bws", "--bind", "API_TOKEN=secret-id", "--bind", "API_TOKEN=other", "--", "tool",
  ]), /invalid --bind/);
  assert.throws(() => loadSecret("bws", { selector: parseSelector("secret-id.password") }), ProviderError);
  assert.throws(() => loadSecret("1password", {
    selector: parseSelector("portainer"), scope: { project: "unexpected" },
  }), /does not support scope/);
});


test("a bind can decode its record before JSON selection and its leaf afterward", () => {
  const password = Buffer.from("portainer-password").toString("base64");
  const encodedRecord = Buffer.from(JSON.stringify({
    config: { api: "plain-api-token", credentials: { password } },
  })).toString("base64");
  const bindings = parseBindings({
    bind: [
      "PORTAINER_API_KEY=portainer.config.api",
      "PORTAINER_PASSWORD=portainer.config.credentials.password",
    ],
    "decode-record": ["PORTAINER_API_KEY=base64", "PORTAINER_PASSWORD=base64"],
    decode: ["PORTAINER_PASSWORD=base64"],
  });
  assert.equal(resolveBindingSecret(
    { value: encodedRecord, path: ["config", "api"] },
    bindings[0],
  ), "plain-api-token");
  assert.equal(resolveBindingSecret(
    { value: encodedRecord, path: ["config", "credentials", "password"] },
    bindings[1],
  ), "portainer-password");
});
