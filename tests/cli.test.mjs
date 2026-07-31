import assert from "node:assert/strict";
import test from "node:test";
import { createRunner, parseArguments, parseBindings, resolveBindingSecret } from "../src/cli.mjs";
import { buildChildEnvironment, execute, loadSecret, ProviderError, saveSecret, SecretNotFoundError } from "../src/providers.mjs";
import { parseSelector } from "../src/selector.mjs";
import { SecretValue } from "../src/secret-value.mjs";
import { authorizeBindings, collectBrowserValues } from "../src/setup.mjs";


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
  assert.equal(new SecretValue(password, operations).read(), "portainer-password");
  assert.equal(new SecretValue('{"token":"cG9ydGFpbmVyLXRva2Vu"}', [
    { type: "transform", name: "json" },
    { type: "property", name: "token" },
    { type: "transform", name: "base64" },
  ]).read(), "portainer-token");
  assert.equal(new SecretValue('"cG9ydGFpbmVyLXRva2Vu"', [
    { type: "transform", name: "json" },
    { type: "transform", name: "base64" },
  ]).read(), "portainer-token");
  assert.throws(() => new SecretValue('{"api":"value"}', [{ type: "property", name: "api" }]).read(), /requires \[json\]/);
  assert.throws(() => new SecretValue("not-json", [{ type: "transform", name: "json" }]).read(), /not valid JSON/);
  assert.throws(() => new SecretValue('{"api":{}}', [{ type: "transform", name: "json" }, { type: "property", name: "api" }]).read(), /must resolve/);
});


test("SecretValue reads and patches a JSON leaf without losing sibling values", () => {
  const encoded = Buffer.from(JSON.stringify({ api: { token: "old", endpoint: "https://api.example" }, enabled: true })).toString("base64");
  const operations = [
    { type: "transform", name: "base64" },
    { type: "transform", name: "json" },
    { type: "property", name: "api" },
    { type: "property", name: "token" },
  ];
  const value = new SecretValue(encoded, operations);
  assert.equal(value.read(), "old");
  assert.equal(
    value.with("new").source,
    Buffer.from(JSON.stringify({ api: { token: "new", endpoint: "https://api.example" }, enabled: true })).toString("base64"),
  );
  assert.equal(
    new SecretValue(undefined, operations).with("new").source,
    Buffer.from('{"api":{"token":"new"}}').toString("base64"),
  );
  const arrayValue = new SecretValue('{"tokens":["b2xk"]}', [
    { type: "transform", name: "json" },
    { type: "property", name: "tokens" },
    { type: "property", name: "0" },
    { type: "transform", name: "base64" },
  ]);
  assert.equal(arrayValue.read(), "old");
  assert.equal(arrayValue.with("new").source, '{"tokens":["bmV3"]}');
});


test("SecretValue creates the requested JSON structure when a provider confirms no source exists", () => {
  const source = new SecretValue(undefined, [
    { type: "transform", name: "json" },
    { type: "property", name: "api" },
    { type: "property", name: "token" },
  ]).with("new").source;
  assert.equal(source, '{"api":{"token":"new"}}');
});


test("browser authorization collects every bind from a local English form", async () => {
  let resolveOpened;
  const opened = new Promise((resolve) => {
    resolveOpened = resolve;
  });
  const bindings = [
    { name: "API_TOKEN", selector: parseSelector("portainer.api-key") },
    { name: "PASSWORD", selector: parseSelector("portainer.password") },
  ];
  const valuesPromise = collectBrowserValues(bindings, { provider: "macOS Keychain", processName: "portainer-mcp" }, {
    open: async (url) => resolveOpened(url),
  });
  const url = await opened;
  const form = await fetch(url).then((response) => response.text());
  assert.match(form, /portainer-mcp/);
  assert.match(form, /needs the values below/i);
  assert.match(form, /macOS Keychain/);
  assert.match(form, /API_TOKEN/);
  await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "bind-0=api-token&bind-1=password",
  });
  assert.deepEqual(await valuesPromise, { API_TOKEN: "api-token", PASSWORD: "password" });
});


test("browser authorization saves before confirming and reports guarded updates", async () => {
  let resolveOpened;
  const opened = new Promise((resolve) => {
    resolveOpened = resolve;
  });
  const bindings = [{ name: "API_TOKEN", selector: parseSelector("portainer.api-key") }];
  const authorization = authorizeBindings("macos-keychain", bindings, {
    collectValues: (requestedBindings, context, options) => collectBrowserValues(requestedBindings, context, {
      ...options,
      open: async (url) => resolveOpened(url),
    }),
    save: async (provider, binding, value, options) => {
      assert.equal(provider, "macos-keychain");
      assert.equal(binding.name, "API_TOKEN");
      assert.equal(value, "new-token");
      assert.equal(options.ifMissing, true);
      return { status: "preserved" };
    },
    ifMissing: true,
  });
  const url = await opened;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "bind-0=new-token",
  });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Authorization complete/);
  assert.equal((await authorization)[0].status, "preserved (a value was added while this form was open)");
});


test("browser authorization renders a provider error without exposing submitted values", async () => {
  let resolveOpened;
  const opened = new Promise((resolve) => {
    resolveOpened = resolve;
  });
  const bindings = [{ name: "API_TOKEN", selector: parseSelector("portainer.api-key") }];
  const authorization = authorizeBindings("macos-keychain", bindings, {
    collectValues: (requestedBindings, context, options) => collectBrowserValues(requestedBindings, context, {
      ...options,
      open: async (url) => resolveOpened(url),
    }),
    save: () => {
      throw new ProviderError("Keychain is locked");
    },
  });
  const authorizationResult = authorization.then(
    () => new Error("authorization unexpectedly completed"),
    (error) => error,
  );
  const url = await opened;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "bind-0=never-display-this",
  });
  const document = await response.text();
  assert.equal(response.status, 500);
  assert.match(document, /Keychain is locked/);
  assert.doesNotMatch(document, /never-display-this/);
  await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "cancel=1",
  });
  assert.match((await authorizationResult).message, /authorization was cancelled/);
});


test("browser authorization does not open a form for read-only providers", async () => {
  await assert.rejects(
    authorizeBindings("bws", [{ name: "API_TOKEN", selector: parseSelector("secret") }], {
      collectValues: async () => {
        throw new Error("must not collect");
      },
    }),
    /does not support browser authorization yet/,
  );
});


test("provider writes send secret input through stdin", () => {
  const received = execute(process.execPath, ["-e", "process.stdin.on('data', (value) => process.stdout.write(value))"], {
    input: "secret-through-stdin",
  });
  assert.equal(received, "secret-through-stdin");
});


test("macOS Keychain selector selects a service and account", () => {
  const calls = [];
  const selected = loadSecret("macos-keychain", {
    selector: parseSelector("example-mcp.api-key[base64]"),
  }, (command, arguments_) => {
    calls.push([command, arguments_]);
    return "dG9rZW4=\n";
  });
  assert.equal(selected.read(), "token");
  assert.deepEqual(calls, [["security", ["find-generic-password", "-s", "example-mcp", "-a", "api-key", "-w"]]]);
});


test("only a confirmed missing native record becomes SecretNotFoundError", () => {
  const binding = { selector: parseSelector("example-mcp.api-key") };
  assert.throws(() => loadSecret("macos-keychain", binding, () => {
    const error = new ProviderError("security failed");
    error.status = 44;
    error.stderr = "The specified item could not be found in the keychain.";
    throw error;
  }), SecretNotFoundError);
  assert.throws(() => loadSecret("macos-keychain", binding, () => {
    const error = new ProviderError("Keychain is locked");
    error.status = 36;
    error.stderr = "User interaction is not allowed.";
    throw error;
  }), /Keychain is locked/);
});


test("Linux Secret Service selector selects a service and account", () => {
  const selected = loadSecret("linux-secret-service", {
    selector: parseSelector("example-mcp.api-key"),
  }, (command, arguments_) => {
    assert.equal(command, "secret-tool");
    assert.deepEqual(arguments_, ["lookup", "service", "example-mcp", "account", "api-key"]);
    return "token\n";
  });
  assert.equal(selected.read(), "token");
});


test("native providers save a patched source value", () => {
  const binding = { selector: parseSelector("example-mcp.config[json].api.token") };
  const calls = [];
  saveSecret("macos-keychain", binding, "new", { write: (service, account, input) => {
    calls.push(["keychain-writer", [service, account], { input }]);
  } }, (command, arguments_) => {
    calls.push([command, arguments_]);
    return command === "security" && arguments_[0] === "find-generic-password"
      ? '{"api":{"token":"old","region":"eu"}}\n'
      : "";
  });
  assert.deepEqual(calls.at(-1), ["keychain-writer", ["example-mcp", "config"], { input: '{"api":{"token":"new","region":"eu"}}' }]);

  saveSecret("linux-secret-service", binding, "new", (command, arguments_, options) => {
    calls.push([command, arguments_, options]);
    if (command === "secret-tool" && arguments_[0] === "lookup") {
      throw new SecretNotFoundError("missing");
    }
    return "";
  });
  assert.deepEqual(calls.at(-1), ["secret-tool", [
    "store", "--label=example-mcp", "service", "example-mcp", "account", "config",
  ], { input: '{"api":{"token":"new"}}' }]);
});


test("guarded save preserves a native value created while authorization was open", () => {
  let wrote = false;
  const outcome = saveSecret("macos-keychain", { selector: parseSelector("example-mcp.api-key") }, "new", {
    ifMissing: true,
    write: () => {
      wrote = true;
    },
  }, () => "concurrently-created\n");
  assert.deepEqual(outcome, { status: "preserved" });
  assert.equal(wrote, false);
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


test("Bitwarden saves an existing item or creates a missing item through stdin", () => {
  const binding = { selector: parseSelector("portainer.config[json].api.token") };
  const existingCalls = [];
  saveSecret("bitwarden", binding, "new", (command, arguments_, options) => {
    existingCalls.push([command, arguments_, options]);
    if (arguments_[0] === "get") {
      return JSON.stringify({ id: "item-id", name: "portainer", fields: [{ name: "config", value: '{"api":{"token":"old","region":"eu"}}' }] });
    }
    return "";
  });
  const edited = JSON.parse(Buffer.from(existingCalls.at(-1)[2].input, "base64").toString("utf8"));
  assert.deepEqual(existingCalls.at(-1).slice(0, 2), ["bw", ["edit", "item", "item-id"]]);
  assert.equal(edited.fields[0].value, '{"api":{"token":"new","region":"eu"}}');

  const createdCalls = [];
  saveSecret("bitwarden", { selector: parseSelector("new-item.password") }, "new", (command, arguments_, options) => {
    createdCalls.push([command, arguments_, options]);
    if (arguments_[0] === "get") {
      throw new SecretNotFoundError("missing");
    }
    if (arguments_[0] === "list") {
      return "[]";
    }
    return "";
  });
  const created = JSON.parse(Buffer.from(createdCalls.at(-1)[2].input, "base64").toString("utf8"));
  assert.deepEqual(createdCalls.at(-1).slice(0, 2), ["bw", ["create", "item"]]);
  assert.equal(created.name, "new-item");
  assert.equal(created.login.password, "new");
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
  assert.equal(selected.read(), "token");
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
  assert.equal(selected.read(), "token");
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


test("SecretValue decodes base64 explicitly and rejects malformed or binary values", () => {
  const base64 = (value, name = "base64") => new SecretValue(value, [{ type: "transform", name }]).read();
  assert.equal(base64("cG9ydGFpbmVyLXRva2Vu"), "portainer-token");
  assert.equal(new SecretValue("token").read(), "token");
  assert.throws(() => base64("not base64!"), /not valid base64/);
  assert.throws(() => base64("/w=="), /not valid UTF-8/);
  assert.throws(() => base64("dG9rZW4=", "rot13"), /unsupported selector transform/);
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
  assert.deepEqual(parseArguments([
    "authorize", "--provider", "macos-keychain", "--bind", "API_TOKEN=example.api-key",
  ]), {
    action: "authorize",
    options: { provider: "macos-keychain", bind: ["API_TOKEN=example.api-key"] },
  });
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
    const success = await createRunner({
      parentEnvironment: { BWS_ACCESS_TOKEN: "provider-auth", PATH: "/bin" },
      load: (_provider, binding) => binding.name === "API_TOKEN"
        ? new SecretValue(encoded, [{ type: "transform", name: "base64" }, { type: "transform", name: "json" }, { type: "property", name: "token" }])
        : new SecretValue("aHVudGVyMg==", [{ type: "transform", name: "base64" }]),
      launchProcess: async (_command, environment) => {
        launched.push(environment);
        return 0;
      },
    })([
      "run", "--provider", "bws",
      "--bind", "API_TOKEN=secret[base64][json].token",
      "--bind", "PASSWORD=password[base64]", "--debug", "--", "target",
    ]);
    assert.equal(success, 0);
    assert.deepEqual(launched, [{ PATH: "/bin", API_TOKEN: "api-token", PASSWORD: "hunter2" }]);
    assert.equal(output.join("\n").includes("api-token"), false);
    assert.equal(output.join("\n").includes("hunter2"), false);

    let authorizationAttempts = 0;
    const failed = await createRunner({
      load: () => new SecretValue("not-base64", [{ type: "transform", name: "base64" }]),
      authorize: async () => {
        authorizationAttempts += 1;
        throw new Error("authorization must not open for malformed base64");
      },
      launchProcess: async () => {
        throw new Error("target must not start");
      },
    })([
      "run", "--provider", "bws", "--bind", "API_TOKEN=secret[base64]", "--", "target",
    ]);
    assert.equal(failed, 78);
    assert.equal(authorizationAttempts, 0);

    const rejected = await createRunner({
      launchProcess: async () => {
        throw new Error("target must not start");
      },
    })([
      "run", "--provider", "bws", "--bind", "NODE_OPTIONS=secret", "--", "target",
    ]);
    assert.equal(rejected, 78);
  } finally {
    console.error = previousError;
  }
});


test("run authorizes every bind once, then retries before launching", async () => {
  let authorized = false;
  let launched = false;
  const result = await createRunner({
    load: (_provider, binding) => {
      if (!authorized) {
        throw new SecretNotFoundError("missing");
      }
      return new SecretValue(`${binding.name.toLowerCase()}-value`);
    },
    authorize: async (provider, bindings, context) => {
      assert.equal(provider, "macos-keychain");
      assert.deepEqual(bindings.map((binding) => binding.name), ["API_TOKEN", "PASSWORD"]);
      assert.equal(context.processName, "target");
      assert.equal(context.ifMissing, true);
      authorized = true;
    },
    launchProcess: async (_command, environment) => {
      launched = true;
      assert.equal(environment.API_TOKEN, "api_token-value");
      assert.equal(environment.PASSWORD, "password-value");
      return 0;
    },
  })([
    "run", "--provider", "macos-keychain", "--bind", "API_TOKEN=example.api", "--bind", "PASSWORD=example.password", "--", "target",
  ]);
  assert.equal(result, 0);
  assert.equal(authorized, true);
  assert.equal(launched, true);
});


test("authorize opens the setup flow without launching a target", async () => {
  let launched = false;
  const result = await createRunner({
    authorize: async (provider, bindings, context) => {
      assert.equal(provider, "macos-keychain");
      assert.deepEqual(bindings.map((binding) => binding.name), ["API_TOKEN"]);
      assert.equal(context.processName, "A local process");
      assert.equal(context.ifMissing, false);
    },
    launchProcess: async () => {
      launched = true;
      return 0;
    },
  })([
    "authorize", "--provider", "macos-keychain", "--bind", "API_TOKEN=example.api",
  ]);
  assert.equal(result, 0);
  assert.equal(launched, false);
});
