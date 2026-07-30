---
name: secret-process-wrapper
description: Configure the headless Agent Secret Wrapper CLI to launch an MCP server, coding tool, script, or local service with one secret from a native keychain or supported secret provider. Use when moving a secret out of config or .env, adding a local secret provider to a command, or standardizing secret-backed launchers.
---

# Secret Process Wrapper

Use `agent-secret-wrapper run` as the common launcher. It accepts one target environment-variable name, a provider, and the command to start.

## Standard

- Keep the secret out of TOML, `.env`, shell history, and chat.
- Use a stable, non-secret provider reference.
- Launch the target through the CLI, not directly.

## Create a wrapper

```zsh
agent-secret-wrapper run \
  --provider macos-keychain \
  --service codex-example-mcp-token --account api-key \
  --env EXAMPLE_API_KEY \
  -- /absolute/path/to/example-mcp "$@"
```

Supported providers are `macos-keychain`, `linux-secret-service`, `windows-credential-manager`, `bitwarden`, `bws`, `1password`, and `infisical`.

## Verify

Run a non-destructive startup check. Do not print the secret or use a target command that exposes its environment. Missing provider data must fail with exit code 78; do not reset provider credentials or persist the secret outside its provider.
