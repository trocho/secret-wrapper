# MCP host configurations

Every host starts the same local process. Replace only `--provider`, the demo bind, and the final MCP command. Do not add a credential to an `env` block: Secret Wrapper resolves it immediately before the target starts.

```text
secret-wrapper run --provider macos-keychain --bind EXAMPLE_API_TOKEN=example-mcp.api-token -- /absolute/path/to/example-mcp
```

The names and selector below are demonstrative, not a secret. The `secret-wrapper` executable must be on the host's `PATH`.

## Codex CLI

Add a user-level server with the current Codex CLI:

```sh
codex mcp add example-mcp -- \
  secret-wrapper run \
  --provider macos-keychain \
  --bind 'EXAMPLE_API_TOKEN=example-mcp.api-token' \
  -- /absolute/path/to/example-mcp
```

Verify it with:

```sh
codex mcp list
```

## Codex `config.toml`

Add this to global `~/.codex/config.toml`, or to the trusted project's `.codex/config.toml` when the server is specific to that project:

```toml
[mcp_servers.example-mcp]
command = "secret-wrapper"
args = [
  "run",
  "--provider", "macos-keychain",
  "--bind", "EXAMPLE_API_TOKEN=example-mcp.api-token",
  "--",
  "/absolute/path/to/example-mcp",
]
```

The ChatGPT desktop app, Codex CLI, and Codex IDE extension share this Codex configuration. Do not use the optional `env` table for the target credential.

## Codex desktop or IDE extension

Open **Settings → MCP servers → Add server**, choose **STDIO**, set command to `secret-wrapper`, then enter the arguments from the TOML `args` list above in the same order. Save and restart the app or extension. Use `/mcp` in Codex to inspect the connected server.

## Claude Code CLI

Use `--scope user` for a personal cross-project server, `local` for the current machine and project, or `project` to write the shared `.mcp.json` file:

```sh
claude mcp add --scope user example-mcp -- \
  secret-wrapper run \
  --provider macos-keychain \
  --bind 'EXAMPLE_API_TOKEN=example-mcp.api-token' \
  -- /absolute/path/to/example-mcp
```

Verify it with:

```sh
claude mcp get example-mcp
```

## Claude Code `.mcp.json`

Create this file in the project root for a shared project configuration:

```json
{
  "mcpServers": {
    "example-mcp": {
      "command": "secret-wrapper",
      "args": [
        "run",
        "--provider", "macos-keychain",
        "--bind", "EXAMPLE_API_TOKEN=example-mcp.api-token",
        "--",
        "/absolute/path/to/example-mcp"
      ]
    }
  }
}
```

Claude Code can create the same file with `claude mcp add --scope project …`. For a temporary or separate configuration, start Claude Code with `--mcp-config path/to/mcp.json`.

## Other JSON MCP hosts

Cursor, Cline, VS Code MCP extensions, Windsurf, and similar clients usually use the same `mcpServers` command/arguments object. Add this server object to the configuration file that the particular host documents:

```json
{
  "mcpServers": {
    "example-mcp": {
      "command": "secret-wrapper",
      "args": [
        "run",
        "--provider", "macos-keychain",
        "--bind", "EXAMPLE_API_TOKEN=example-mcp.api-token",
        "--",
        "/absolute/path/to/example-mcp"
      ]
    }
  }
}
```

Some hosts use a different outer key or a different settings-file location. Change only that host-specific envelope; preserve `command` and the complete ordered `args` array.
