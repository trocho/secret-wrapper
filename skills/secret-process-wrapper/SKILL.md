---
name: secret-process-wrapper
description: Create or update a local process wrapper that retrieves an API key or token from macOS Keychain, Bitwarden, or Windows Credential Manager at startup. Use when configuring an MCP server, CLI, script, or local service with a secret, moving a secret out of config or .env, or standardizing secret-backed launchers.
---

# Secret Process Wrapper

Use `scripts/secret_exec.py` as the provider library. It retrieves one secret, injects it only into the child environment, and replaces itself with that child.

## Standard

- Name macOS Keychain services `codex-<server>-mcp-token` for MCP tokens.
- Use a stable, non-secret account name such as `api-key`; retain a provider-required identity only when necessary.
- Keep a tiny caller-specific wrapper in `<workspace>/.codex/bin/` and the secret out of TOML, `.env`, shell history, and chat.
- Point the caller at the wrapper, never the protected binary directly.

## Create a wrapper

```zsh
exec python3 /path/to/secret_exec.py \
  --provider macos-keychain \
  --service codex-example-mcp-token --account api-key \
  --env EXAMPLE_API_KEY \
  -- /absolute/path/to/example-mcp "$@"
```

Supported providers are `macos-keychain`, `bitwarden` (the `bw` CLI with an unlocked session), and `windows-credential-manager` (the PowerShell CredentialManager module).

## Verify

Run a non-destructive startup check. Do not print the secret or use a child command that exposes its environment. Missing provider data must fail with exit code 78; do not reset provider passwords or persist the secret outside its provider.
