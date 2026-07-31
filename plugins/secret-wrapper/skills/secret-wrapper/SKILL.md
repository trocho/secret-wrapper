---
name: secret-wrapper
description: Configure the headless Secret Wrapper CLI to launch an MCP server, coding tool, script, or local service with one or more values from a native keychain or supported secret provider. Use when moving a secret out of config or .env, adding a local secret provider to a command, or standardizing secret-backed launchers.
---

# Secret Wrapper

Use `secret-wrapper run` as the common launcher. Every provider uses the same runtime contract: provider, one or more binds, optional scope, and command. When a supported local provider has no value yet, `run` opens a one-time local browser form, saves the submitted values, and then starts the command.

## Standard

- Keep the secret out of TOML, `.env`, shell history, and chat.
- Use `--bind 'ENV_NAME=RECORD.FIELD[TRANSFORMS][.JSON_PROPERTY[TRANSFORMS]...]'` for every target variable. `[base64]` decodes text and `[json]` parses JSON text; transforms run from left to right and `[json]` is required before a JSON property. Escape literal `.`, `\`, `[` and `]` as `\.`, `\\`, `\[` and `\]` and quote the whole bind so the shell preserves the escape. Bitwarden and 1Password may omit `FIELD` only for their default `password`; prefer the explicit field in shared configuration.
- Use `--scope NAME=VALUE` only for provider context such as a 1Password vault or Infisical environment.
- Do not bind `PATH`, `NODE_OPTIONS`, or dynamic-loader variables; the launcher rejects process-control names.
- Launch the target through the CLI, not directly.
- For a deliberate first setup or change, use `secret-wrapper authorize` with the same provider, binds, and scope. The form is in English, runs on `127.0.0.1`, shows no existing values, and blank inputs preserve existing values. It supports writing to macOS Keychain, Linux Secret Service, and Bitwarden; other adapters remain read-only.

## Create a wrapper

```zsh
secret-wrapper run \
  --provider macos-keychain --bind EXAMPLE_API_KEY=example-mcp.api-key \
  -- /absolute/path/to/example-mcp "$@"
```

Supported providers are `macos-keychain`, `linux-secret-service`, `windows-credential-manager`, `bitwarden`, `bws`, `1password`, and `infisical`. Keep `run` provider-neutral; do not pass a secret value or a provider-specific flag. Repeat `--bind` when the target needs multiple values; all are retrieved before it starts.

## Provider recipes

When configuring a specific provider, read [references/provider-recipes.md](references/provider-recipes.md) and use its matching copy-ready command. Do not load it for a provider-neutral launcher change.

## Verify

Run a non-destructive startup check. Do not print the secret or use a target command that exposes its environment. On supported providers, a missing value opens the local authorization form; otherwise it fails with exit code 78. Do not reset provider credentials or persist the secret outside its provider.

For diagnosis, add `--debug` before `--`. Share only its metadata and lifecycle output; it must not contain a secret value. See [references/provider-recipes.md](references/provider-recipes.md) for transform-order examples.
