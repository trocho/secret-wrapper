---
name: secret-process-wrapper
description: Create or update a local process wrapper that retrieves an API key or token from macOS Keychain, Bitwarden, or Windows Credential Manager at startup. Use when configuring an MCP server, CLI, script, or local service with a secret, moving a secret out of config or .env, or standardizing secret-backed launchers.
---

# Secret Process Wrapper

Use `scripts/secret_exec.py` as the provider library. It retrieves one secret, injects it only into the child environment, and replaces itself with that child.

## Create a wrapper

```zsh
exec python3 "${CLAUDE_PLUGIN_ROOT}/skills/secret-process-wrapper/scripts/secret_exec.py" \
  --provider macos-keychain \
  --service codex-example-mcp-token --account api-key \
  --env EXAMPLE_API_KEY \
  -- /absolute/path/to/example-mcp "$@"
```

Use `macos-keychain`, `bitwarden` (the `bw` CLI with an unlocked session), or `windows-credential-manager` (the PowerShell CredentialManager module). Keep the secret out of TOML, `.env`, shell history, and chat; verify only with a command that does not print the child environment.
