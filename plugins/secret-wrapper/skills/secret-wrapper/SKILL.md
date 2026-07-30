---
name: secret-wrapper
description: Configure the headless Secret Wrapper CLI to launch an MCP server, coding tool, script, or local service with one or more values from a native keychain or supported secret provider. Use when moving a secret out of config or .env, adding a local secret provider to a command, or standardizing secret-backed launchers.
---

# Secret Wrapper

Use `secret-wrapper run` as the common launcher. Every provider uses the same runtime contract: provider, one or more binds, optional scope and decoding, and command.

## Standard

- Keep the secret out of TOML, `.env`, shell history, and chat.
- Use `--bind ENV_NAME=RECORD.FIELD[.JSON_PATH]` for every target variable. The selector identifies the provider record, its value, and optionally a nested JSON value. Escape a literal dot with `\.` and quote the whole bind so the shell preserves the escape.
- Use `--scope NAME=VALUE` only for provider context such as a 1Password vault or Infisical environment.
- Use `--decode-source ENV_NAME=base64` only when the complete value returned by the provider is deliberately Base64-encoded before JSON selection.
- Use `--decode-value ENV_NAME=base64` only when the final value selected for that bind is deliberately Base64-encoded. Both stages may apply to one bind; do not infer encoding.
- Launch the target through the CLI, not directly.

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

Run a non-destructive startup check. Do not print the secret or use a target command that exposes its environment. Missing provider data must fail with exit code 78; do not reset provider credentials or persist the secret outside its provider.

For diagnosis, add `--debug` before `--`. Share only its metadata and lifecycle output; it must not contain a secret value.
