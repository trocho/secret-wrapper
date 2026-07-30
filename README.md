# Agent Secret Wrapper

Run an MCP server, CLI, or local service with one secret fetched at startup and passed only to its child process.

## Install the skill

Install for Codex and Claude Code with [skills.sh](https://skills.sh/):

```sh
npx skills add git@github.com:trocho/agent-secret-wrapper.git --skill secret-process-wrapper --agent codex claude-code --global
```

The repository is private for now, so the installer needs SSH access to `trocho/agent-secret-wrapper`.

## Install the Claude Code plugin

```text
/plugin marketplace add git@github.com:trocho/agent-secret-wrapper.git
/plugin install secret-process-wrapper@patryk-agent-tools
```

## Providers

- `macos-keychain`: macOS `security` generic password item.
- `bitwarden`: `bw get password <item>`; the caller must provide an unlocked Bitwarden session.
- `windows-credential-manager`: PowerShell CredentialManager module and `Get-StoredCredential`.

The runner never writes secrets to disk or stdout. It keeps the fetched value only in the child process environment.

## Development

```sh
python3 -m unittest discover -s tests -v
python3 scripts/validate.py
```

Release tags such as `v0.1.0` run the release workflow, validate the repository, and attach the Claude Code plugin ZIP to the GitHub Release. Once the repository becomes public, skills.sh can index the same GitHub source; submission to Anthropic's community directory remains a separate, manual review step.
