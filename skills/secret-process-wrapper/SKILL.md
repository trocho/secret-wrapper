---
name: secret-process-wrapper
description: Configure the headless Agent Secret Wrapper CLI to launch an MCP server, coding tool, script, or local service with one secret from a native keychain or supported secret provider. Use when moving a secret out of config or .env, adding a local secret provider to a command, or standardizing secret-backed launchers.
---

# Secret Process Wrapper

Use `agent-secret-wrapper run` as the common launcher. Every provider uses the same runtime contract: provider, selector, optional scope and decoding, target environment-variable name, and command.

## Standard

- Keep the secret out of TOML, `.env`, shell history, and chat.
- Use `--selector RECORD.FIELD[.JSON_PATH]` to identify the provider record, its value, and optionally a nested JSON value. Escape a literal dot with `\.` and quote that selector so the shell preserves the escape.
- Use `--scope NAME=VALUE` only for provider context such as a 1Password vault or Infisical environment.
- Use `--decode base64` only when the selected text is deliberately Base64-encoded; do not infer encoding.
- Use `--env` only for the target environment-variable name.
- Launch the target through the CLI, not directly.

## Create a wrapper

```zsh
agent-secret-wrapper run \
  --provider macos-keychain --selector example-mcp.api-key \
  --env EXAMPLE_API_KEY \
  -- /absolute/path/to/example-mcp "$@"
```

Supported providers are `macos-keychain`, `linux-secret-service`, `windows-credential-manager`, `bitwarden`, `bws`, `1password`, and `infisical`. Keep `run` provider-neutral; do not pass a secret value or a provider-specific flag.

## Verify

Run a non-destructive startup check. Do not print the secret or use a target command that exposes its environment. Missing provider data must fail with exit code 78; do not reset provider credentials or persist the secret outside its provider.

For diagnosis, add `--debug` before `--`. Share only its metadata and lifecycle output; it must not contain a secret value.
