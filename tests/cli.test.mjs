import assert from "node:assert/strict";
import test from "node:test";
import { parseArguments, parseBindings, resolveBindingSecret, run } from "../src/cli.mjs";
import { buildChildEnvironment, loadSecret, ProviderError } from "../src/providers.mjs";
import { decodeSecret, evaluateSelector, parseSelector } from "../src/selector.mjs";


test("a selector keeps names separate from ordered transforms", () => {
  assert.deepEqual(parseSelector("portainer.config[base64][json].api.key[base64]"), [
    { name: "portainer", transforms: [] },
    { name: "config", transforms: ["base64", "json"] },
    { name: "api", transforms: [] },
    { name: "key", transforms: ["base64"] },
  ]);
  assert.deepEqual(parseSelector("com\\.example\\[prod\\].api-key"), [
    { name: "com.example[prod]", transforms: [] },
    { name: "api-key", transforms: [] },
  ]);
  assert.deepEqual(parseSelector("entry\\\\name\\].value"), [
    { name: "entry\\name]", transforms: [] },
    { name: "value", transforms: [] },
  ]);
  assert.throws(() => parseSelector("portainer..api-key"), /cannot be empty/);
  assert.throws(() => parseSelector("portainer[rot13]"), /unsupported selector transform/);
  assert.throws(() => parseSelector("portainer[json"), /unterminated/);
  assert.throws(() => parseSelector("portainer[json]suffix"), /must end a segment/);
  assert.throws(() => parseSelector("portainer\\x"), /may contain only/);
});


test("selector operations are explicit, ordered, and scalar", () => {
  const password = Buffer.from(JSON.stringify({ key: Buffer.from("portainer-password").toString("base64") })).toString("base64");
  const operations = [
    { type: "transform", name: "base64" },
    { type: "transform", name: "json" },
    { type: "property", name: "key" },
    { type: "transform", name: "base64" },
  ];
  assert.equal(evaluateSelector(password, operations), "portainer-password");
  assert.equal(evaluateSelector('{"token":"cG9ydGFpbmVyLXRva2Vu"}', [
    { type: "transform", name: "json" },
    { type: "property", name: "token" },
    { type: "transform", name: "base64" },
  ]), "portainer-token");
  assert.equal(evaluateSelector('"cG9ydGFpbmVyLXRva2Vu"', [
    { type: "transform", name: "json" },
    { type: "transform", name: "base64" },
  ]), "portainer-token");
  assert.throws(() => evaluateSelector('{"api":"value"}', [{ type: "property", name: "api" }]), /requires \[json\]/);
  assert.throws(() => evaluateSelector("not-json", [{ type: "transform", name: "json" }]), /not valid JSON/);
  assert.throws(() => evaluateSelector('{"api":{}}', [{ type: "transform", name: "json" }, { type: "property", name: "api" }]), /must resolve/);
});


test("macOS Keychain selector selects a service and account", () => {
  const calls = [];
  const selected = loadSecret("macos-keychain", {
    selector: parseSelector("example-mcp.api-key[base64]"),
  }, (command, arguments_) => {
    calls.push([command, arguments_]);
    return "dG9rZW4=\n";
  });
  assert.deepEqual(selected, { value: "dG9rZW4=", operations: [{ type: "transform", name: "base64" }] });
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
  assert.deepEqual(selected, { value: "token", operations: [] });
});


test("Windows Credential Manager selector evaluates explicit JSON paths", () => {
  const selected = loadSecret("windows-credential-manager", {
    selector: parseSelector("portainer[json].secret.token"),
  }, (command, arguments_) => {
    assert.equal(command, "powershell");
    assert.match(arguments_.at(-1), /portainer/);
    return '{"secret":{"token":"value"}}\r\n';
  });
  assert.equal(resolveBindingSecret(selected), "value");
});


test("Bitwarden selector selects a built-in or custom field", () => {
  const builtin = loadSecret("bitwarden", {
    selector: parseSelector("portainer.password[base64]"),
  }, (command, arguments_) => {
    assert.equal(command, "bw");
    assert.deepEqual(arguments_, ["get", "password", "portainer"]);
    return "dG9rZW4=\n";
  });
  assert.equal(resolveBindingSecret(builtin), "token");

  const custom = loadSecret("bitwarden", {
    selector: parseSelector("portainer.config[json].api.token"),
  }, (command, arguments_) => {
    assert.equal(command, "bw");
    assert.deepEqual(arguments_, ["get", "item", "portainer"]);
    return JSON.stringify({ fields: [{ name: "config", value: '{"api":{"token":"value"}}' }] });
  });
  assert.equal(resolveBindingSecret(custom), "value");
});


test("BWS selector reads one secret and accepts its value segment", () => {
  const selected = loadSecret("bws", {
    selector: parseSelector("secret-id.value[base64]"),
  }, (command, arguments_) => {
    assert.equal(command, "bws");
    assert.deepEqual(arguments_, ["secret", "get", "secret-id", "--output", "json"]);
    return '{"value":"dG9rZW4="}';
  });
  assert.equal(resolveBindingSecret(selected), "token");
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
  assert.deepEqual(selected, { value: "token", operations: [] });
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
  assert.deepEqual(selected, { value: "token", operations: [] });
});


test("annotations on a required provider locator fail before retrieval", () => {
  for (const [provider, selector] of [
    ["macos-keychain", "service[base64].account"],
    ["linux-secret-service", "service[json].account"],
    ["1password", "item[base64].password"],
  ]) {
    let called = false;
    assert.throws(() => loadSecret(provider, { selector: parseSelector(selector), scope: provider === "1password" ? { vault: "main" } : undefined }, () => {
      called = true;
      return "token";
    }), /annotation/);
    assert.equal(called, false);
  }
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


test("the provider factory rejects prototype-like provider names", () => {
  for (const provider of ["toString", "constructor", "__proto__"]) {
    assert.throws(() => loadSecret(provider, { selector: parseSelector("secret") }), /unsupported provider/);
  }
});


test("run has one provider-neutral bind contract without decoding flags", () => {
  assert.deepEqual(parseArguments([
    "run", "--provider", "bws", "--bind", "API_TOKEN=secret-id.value[base64]",
    "--bind", "USERNAME=secret-id.value[json].user", "--", "tool", "arg",
  ]), {
    action: "run",
    options: {
      provider: "bws",
      bind: ["API_TOKEN=secret-id.value[base64]", "USERNAME=secret-id.value[json].user"],
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
    "run", "--provider", "bws", "--bind", "API_TOKEN=secret-id", "--decode-value", "API_TOKEN=base64", "--", "tool",
  ]), /invalid option/);
  assert.throws(() => parseArguments([
    "run", "--provider", "bws", "--bind", "API_TOKEN=secret-id", "--bind", "API_TOKEN=other", "--", "tool",
  ]), /invalid --bind/);
  assert.throws(() => parseArguments([
    "run", "--provider", "bws", "--bind", "PATH=secret-id", "--", "tool",
  ]), /invalid --bind/);
  assert.throws(() => loadSecret("bws", { selector: parseSelector("secret-id.password") }), ProviderError);
  assert.throws(() => loadSecret("1password", {
    selector: parseSelector("portainer"), scope: { project: "unexpected" },
  }), /does not support scope/);
});


test("a bind can compose source and leaf decodes around JSON traversal", () => {
  const password = Buffer.from(JSON.stringify({ key: Buffer.from("portainer-password").toString("base64") })).toString("base64");
  const encodedRecord = Buffer.from(JSON.stringify({
    config: { api: "plain-api-token", credentials: { password } },
  })).toString("base64");
  const bindings = parseBindings({
    bind: [
      "PORTAINER_API_KEY=portainer[base64][json].config.api",
      "PORTAINER_PASSWORD=portainer[base64][json].config.credentials.password[base64][json].key[base64]",
    ],
  });
  const select = (binding) => loadSecret("windows-credential-manager", { selector: binding.selector }, () => encodedRecord);
  assert.equal(resolveBindingSecret(
    select(bindings[0]),
  ), "plain-api-token");
  assert.equal(resolveBindingSecret(
    select(bindings[1]),
  ), "portainer-password");
});


test("optional provider value segments keep their default with transforms", () => {
  const cases = [
    ["bitwarden", "portainer[base64]", undefined, "bw", ["get", "password", "portainer"], "dG9rZW4=\n"],
    ["bws", "secret-id[base64]", undefined, "bws", ["secret", "get", "secret-id", "--output", "json"], '{"value":"dG9rZW4="}'],
    ["1password", "portainer[base64]", { vault: "main" }, "op", ["read", "op://main/portainer/password"], "dG9rZW4=\n"],
    ["infisical", "API_TOKEN[base64]", undefined, "infisical", ["secrets", "get", "API_TOKEN", "--plain", "--silent"], "dG9rZW4=\n"],
  ];
  for (const [provider, selector, scope, command, arguments_, output] of cases) {
    const selected = loadSecret(provider, { selector: parseSelector(selector), scope }, (actualCommand, actualArguments) => {
      assert.equal(actualCommand, command);
      assert.deepEqual(actualArguments, arguments_);
      return output;
    });
    assert.equal(resolveBindingSecret(selected), "token");
  }
});


test("run injects every transformed value and never launches after a resolution failure", async () => {
  const encoded = Buffer.from(JSON.stringify({ token: "api-token" })).toString("base64");
  const launched = [];
  const output = [];
  const previousError = console.error;
  console.error = (message) => output.push(message);
  try {
    const success = await run([
      "run", "--provider", "bws",
      "--bind", "API_TOKEN=secret[base64][json].token",
      "--bind", "PASSWORD=password[base64]", "--debug", "--", "target",
    ], {
      parentEnvironment: { BWS_ACCESS_TOKEN: "provider-auth", PATH: "/bin" },
      load: (_provider, binding) => binding.name === "API_TOKEN"
        ? { value: encoded, operations: [{ type: "transform", name: "base64" }, { type: "transform", name: "json" }, { type: "property", name: "token" }] }
        : { value: "aHVudGVyMg==", operations: [{ type: "transform", name: "base64" }] },
      launchProcess: async (_command, environment) => {
        launched.push(environment);
        return 0;
      },
    });
    assert.equal(success, 0);
    assert.deepEqual(launched, [{ PATH: "/bin", API_TOKEN: "api-token", PASSWORD: "hunter2" }]);
    assert.equal(output.join("\n").includes("api-token"), false);
    assert.equal(output.join("\n").includes("hunter2"), false);

    const failed = await run([
      "run", "--provider", "bws", "--bind", "API_TOKEN=secret[base64]", "--", "target",
    ], {
      load: () => ({ value: "not-base64", operations: [{ type: "transform", name: "base64" }] }),
      launchProcess: async () => {
        throw new Error("target must not start");
      },
    });
    assert.equal(failed, 78);

    const rejected = await run([
      "run", "--provider", "bws", "--bind", "NODE_OPTIONS=secret", "--", "target",
    ], {
      launchProcess: async () => {
        throw new Error("target must not start");
      },
    });
    assert.equal(rejected, 78);
  } finally {
    console.error = previousError;
  }
});
