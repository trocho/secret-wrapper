# Secret Wrapper

Local-first secret adapters for launching MCP servers, coding tools, and scripts.

## Problem it solves

MCP configuration, Compose files, and shell startup scripts often need an API token. This CLI keeps configuration free of the secret itself and retrieves it only when the target command starts.

On first use, a confirmed missing value can be collected in a one-time browser form on `127.0.0.1`, stored with the selected provider, and then used to start the target command. Once values are provisioned, normal launches are non-interactive. The secret is never put in the MCP configuration, shell history, or debug output.

## How it works

```mermaid
sequenceDiagram
    participant Caller as Launch command
    participant Wrapper as Secret Wrapper
    participant Adapter as Provider adapter
    participant Provider as Secret provider
    participant Browser as Local browser form
    participant Child as MCP server or target command

    Caller->>Wrapper: start target command with binds
    Wrapper->>Adapter: retrieve all bound values
    Adapter->>Provider: retrieve values
    alt all values are available
        Provider-->>Adapter: values
        Adapter-->>Wrapper: resolved values
    else a provider confirms a value is missing
        Provider-->>Adapter: unavailable
        Adapter-->>Wrapper: authorization required
        Wrapper->>Browser: open one local form for all binds
        Browser-->>Wrapper: submitted values
        Wrapper->>Adapter: save non-empty values
        Adapter->>Provider: patch selected values
        Provider-->>Adapter: values saved
        Wrapper->>Adapter: retrieve all bound values again
        Adapter->>Provider: retrieve values
        Provider-->>Adapter: values
        Adapter-->>Wrapper: resolved values
    end
    Wrapper->>Child: start with bound environment values
```

## See the authorization flow

The screenshots below are from the real local browser flow using demo names and placeholder values only. No credential is rendered, logged, or stored by the demo.

![Sanitized terminal trace from a Secret Wrapper launch](docs/assets/terminal-flow.svg)

| Missing value: one local form for all binds | Completed: a per-value update result |
| --- | --- |
| ![Secret Wrapper local authorization form](docs/assets/authorization-form.png) | ![Secret Wrapper authorization completion page](docs/assets/authorization-success.png) |

| Provider failure: safe diagnostic and retry |
| --- |
| ![Secret Wrapper authorization error page](docs/assets/authorization-retry.png) |

The form appears only after a provider confirms a value is missing. It states which local process is waiting, never displays existing values, and gives a clear status after submission: created, updated, preserved because another process supplied a value first, or unchanged because the field was blank. If a write fails, the form keeps the user in the local page with a safe diagnostic and a retry path.

Maintainers can add or refresh these assets with the repository's [visual documentation skill](skills/secret-wrapper-visuals/SKILL.md). It includes the safe demo launcher, terminal-trace generator, visual language, and validation steps.

## Candidate build

This is an unpublished candidate for local testing. It cannot be accidentally published to npm.

```sh
npm test
node ./bin/secret-wrapper.mjs --help
```

After publication, the same command will be available through:

```sh
npx @trocho/secret-wrapper run --help
```

## Quick start

Use the same command shape for every provider. This example reads the `password` value from the Bitwarden item named `portainer` and exposes it only to the MCP process as `PORTAINER_API_KEY`.

```sh
secret-wrapper run \
  --provider bitwarden \
  --bind PORTAINER_API_KEY=portainer.password \
  -- /absolute/path/to/portainer-mcp
```

Replace only the provider location and the target command. Never put the secret value into the command or shell history.

## First use and changing values

`run` is the one-command path. It opens one local browser tab only when a provider confirms that a value is missing. A malformed Base64/JSON value, provider login failure, locked store, or other read error stops the command without opening a form. The tab identifies the target process, provider, and selectors; it never displays an existing secret value.

Before `run` writes a submitted value, it checks the provider again. If another process created the value while the form was open, the new value is preserved instead of overwritten. The completion page shows the result for every bind. If saving fails, the same page shows the safe provider diagnostic and allows another submission; submitted values are never echoed back.

```sh
secret-wrapper run \
  --provider macos-keychain \
  --bind PORTAINER_API_KEY=portainer-mcp.api-key \
  --bind PORTAINER_PASSWORD=portainer-mcp.password \
  -- /absolute/path/to/portainer-mcp
```

To add or replace values deliberately, run `authorize` with the same provider, binds, and optional scope. It opens the same local form but does not start a target process; unlike first-use `run`, it intentionally updates an existing selected value.

```sh
secret-wrapper authorize \
  --provider bitwarden \
  --bind PORTAINER_API_KEY=portainer.api-key \
  --bind PORTAINER_PASSWORD=portainer.password
```

Leave a form field blank to preserve its current value. When a selector points inside JSON, Secret Wrapper reads the source value, patches only the selected property or array entry, and writes the transformed source back. Other JSON values remain intact.

## Command model

| Argument | Meaning |
| --- | --- |
| `--provider` | Which secret system to query. |
| `--bind` | Repeatable `ENV_NAME=SELECTOR` pair: the target variable and its provider location. |
| `--scope` | Optional context, such as a vault, project, environment, or path. Repeat when needed. |

`--bind` deliberately rejects process-control names such as `PATH`, `NODE_OPTIONS`, and dynamic-loader variables. Use it for credentials and target settings, not for changing how the target executable starts.

The canonical form is:

```sh
secret-wrapper run \
  --provider PROVIDER \
  --bind ENV_NAME=SELECTOR [--bind ENV_NAME=SELECTOR ...] \
  [--scope NAME=VALUE ...] [--debug] \
  -- TARGET [ARGS...]
```

To change values without launching a target:

```sh
secret-wrapper authorize \
  --provider PROVIDER \
  --bind ENV_NAME=SELECTOR [--bind ENV_NAME=SELECTOR ...] \
  [--scope NAME=VALUE ...] [--debug]
```

## Compatible tools and installation

Secret Wrapper is device-neutral: the launcher is a normal local process, so it works with any MCP client that can start a stdio command. The integrations below merely teach an agent the standard command shape; they do not receive or retain the secret.

The CLI is still a GitHub-release candidate, not an npm publication. Install the current candidate once on the machine that launches the MCP server:

```sh
git clone https://github.com/trocho/secret-wrapper.git
cd secret-wrapper
npm link
secret-wrapper --help
```

After npm publication this becomes `npm install --global @trocho/secret-wrapper`.

| Tool or surface | Best integration | Install once | Use afterward |
| --- | --- | --- | --- |
| Codex desktop or CLI | Native Codex plugin | `codex plugin marketplace add trocho/secret-wrapper`<br>`codex plugin add secret-wrapper@secret-wrapper` | Ask Codex to configure or run a secret-backed launcher. |
| Claude Code | Native Claude Code plugin | `claude plugin marketplace add trocho/secret-wrapper`<br>`claude plugin install secret-wrapper@secret-wrapper` | Ask Claude Code to configure or run a secret-backed launcher. |
| Codex and Claude Code | Portable skill via skills.sh | `npx skills add https://github.com/trocho/secret-wrapper.git --skill secret-wrapper --agent codex claude-code --global` | The same skill is available even when plugin installation is not preferred. |
| Cursor, Cline, VS Code, Windsurf, or another MCP host | Native wrapper command | Install the CLI, then configure the host to start `secret-wrapper run … -- YOUR_MCP_COMMAND`. | The host sees only the target command; Secret Wrapper fetches values immediately before it starts. |
| Shell scripts, Compose helpers, local services | Native wrapper command | Install the CLI and replace the direct process launch with `secret-wrapper run`. | Use the exact same `--provider`, `--bind`, and optional `--scope` contract as an MCP server. |

### Codex plugin

```sh
codex plugin marketplace add trocho/secret-wrapper
codex plugin add secret-wrapper@secret-wrapper
```

### Claude Code plugin

```sh
claude plugin marketplace add trocho/secret-wrapper
claude plugin install secret-wrapper@secret-wrapper
```

### Portable skill

Install for Codex and Claude Code with [skills.sh](https://skills.sh/):

```sh
npx skills add https://github.com/trocho/secret-wrapper.git --skill secret-wrapper --agent codex claude-code --global
```

The repository is public, so the installer can download the skill directly from GitHub.

The skill tells Codex and Claude Code to use this consistent, secret-safe command pattern instead of inventing provider-specific launch scripts or placing secrets in configuration. It also instructs them not to repeat values, binds, record locators, or scopes in compacted handoffs.

## Why install the skill?

The Secret Wrapper skill teaches Codex and Claude Code how to configure secret-backed commands consistently and safely. It helps the agent select the correct provider syntax, create MCP host configuration, use multiple bindings, and diagnose startup problems without placing secret values in configuration, chat, or logs.

The skill is guidance for the coding agent; it does not read or store secrets itself. The local Secret Wrapper CLI retrieves values from the selected provider only when it launches the target process.

## Use the skill

After installing the plugin or portable skill, describe the command or MCP server you want to protect. Codex or Claude Code will apply the skill automatically when the request involves Secret Wrapper, an MCP credential, or moving a secret out of configuration.

For example:

> Configure the Portainer MCP server through Secret Wrapper. Use macOS Keychain, bind `PORTAINER_API_KEY` to `portainer-mcp.api-key`, and add the server to my Codex `config.toml`.

> Move the credentials used by this MCP server out of `.mcp.json` and configure Secret Wrapper with Bitwarden.

> Diagnose this Secret Wrapper launcher with debug logging without displaying any credential values.

The agent will:

1. choose the matching provider recipe;
2. create the `secret-wrapper run` command;
3. add the command to the appropriate MCP host configuration;
4. keep credential values out of persistent configuration;
5. verify startup without printing the retrieved values.

You can explicitly request the skill when needed:

> Use the Secret Wrapper skill to configure this MCP server securely.

## Configure an MCP host

The host always starts `secret-wrapper`; the wrapper retrieves values only for the child MCP process. Do not add a credential to the host's `env` block. Copy-ready configurations for Codex CLI and desktop, project or global `config.toml`, Claude Code CLI, `.mcp.json`, and hosts that use the common JSON command/arguments schema are in [MCP host configurations](skills/secret-wrapper/references/mcp-host-configurations.md).

## Selectors and providers

A selector is the right side of a bind: `ENV_NAME=SELECTOR`. It identifies one value without a separate item/field vocabulary. Its first segment is the provider's record locator; the second is the value within that record where the provider has one. Transform annotations are attached directly to the value they transform: `[base64]` decodes text and `[json]` parses JSON text. Escape literal `.`, `\`, `[` and `]` as `\.`, `\\`, `\[` and `\]`, and quote the whole bind so the shell preserves the escape.

| Provider | Value for `--provider` | Browser authorization | Selector structure | Example |
| --- | --- | --- | --- | --- |
| macOS Keychain | `macos-keychain` | Yes | `SERVICE.ACCOUNT[TRANSFORMS][.JSON_PROPERTY[TRANSFORMS]...]` | `portainer-mcp.api-key[base64]` |
| Linux Secret Service | `linux-secret-service` | Yes | `SERVICE.ACCOUNT[TRANSFORMS][.JSON_PROPERTY[TRANSFORMS]...]` | `portainer-mcp.api-key[base64]` |
| Windows Credential Manager | `windows-credential-manager` | Not yet | `TARGET[TRANSFORMS][.JSON_PROPERTY[TRANSFORMS]...]` | `portainer-mcp-api-key[json].token` |
| Bitwarden | `bitwarden` | Yes | `ITEM.FIELD[TRANSFORMS][.JSON_PROPERTY[TRANSFORMS]...]` | `portainer.password[base64]` |
| Bitwarden Secrets Manager | `bws` | Not yet | `SECRET_ID[.value][TRANSFORMS][.JSON_PROPERTY[TRANSFORMS]...]` | `SECRET_ID.value[base64]` |
| 1Password | `1password` | Not yet | `ITEM.FIELD[TRANSFORMS][.JSON_PROPERTY[TRANSFORMS]...]`; add `--scope vault=VAULT` | `portainer.api-key[base64]` |
| Infisical | `infisical` | Not yet | `SECRET_KEY[.value][TRANSFORMS][.JSON_PROPERTY[TRANSFORMS]...]` | `PORTAINER_API_KEY.value[base64]` |

`[json]` is required before JSON properties. For example, `portainer.config[json].api.token` selects the `config` field of the `portainer` item, parses it as JSON, then passes its `api.token` value to the target process. JSON properties may also name array indexes, such as `credentials.0.token`. The final selection must be text, a number, or a boolean.

Bitwarden and 1Password may omit `FIELD`; it then means their default `password` field, so `portainer[base64]` is valid. Prefer the explicit `portainer.password[base64]` form in shared configuration. An annotation cannot appear before another required provider locator, so `service[base64].account` is invalid.

Use as many binds as the target needs. Every bind is resolved before the target starts, so a failed lookup does not start it with a partial environment:

```sh
secret-wrapper run \
  --provider bitwarden \
  --bind PORTAINER_API_KEY=portainer.api-key \
  --bind PORTAINER_PASSWORD=portainer.password \
  -- /absolute/path/to/portainer-mcp
```

Transforms run from left to right. `[base64][json]` means “decode the text, then parse the decoded text as JSON”; `[json][base64]` means “parse a JSON string, then decode that string as Base64.” Use the order that matches the stored value. This command accepts a Base64-encoded JSON source whose nested `password` is another Base64-encoded JSON value with a Base64 `key`.

```sh
secret-wrapper run \
  --provider bitwarden \
  --bind 'PORTAINER_API_KEY=portainer.config[base64][json].api' \
  --bind 'PORTAINER_PASSWORD=portainer.config[base64][json].credentials.password[base64][json].key[base64]' \
  -- /absolute/path/to/portainer-mcp
```

The wrapper never guesses encoding and rejects malformed Base64, invalid JSON, impossible transform order, or JSON traversal without `[json]`.

For a locator with literal dots or brackets, use single quotes so the shell passes the selector unchanged:

```sh
--bind 'PORTAINER_API_KEY=com\.example\.portainer.api-key'
```

The same escaping applies to a Bitwarden login property: `--bind 'PORTAINER_USER=portainer.login\.username'`.

See the skill's [provider recipes](skills/secret-wrapper/references/provider-recipes.md) for a copy-ready command for every provider.

## Debugging

Add `--debug` before `--` to see the provider, bind names and selectors, transform order, scope, retrieval stage, and target-process exit code on standard error.

```sh
secret-wrapper run \
  --provider bitwarden --bind PORTAINER_API_KEY=portainer.password \
  --debug \
  -- /absolute/path/to/portainer-mcp
```

Debug output never includes the secret value, provider authentication, command arguments, or provider response. Browser authorization shows a safe provider diagnostic after a failed save; retrieval failures that occur before a form opens are reported on standard error instead.

## Development

```sh
npm test
npm run validate
npm run pack:check
```

Release tags build candidate artifacts for GitHub Releases. npm publication is intentionally not configured until dogfooding is complete.
