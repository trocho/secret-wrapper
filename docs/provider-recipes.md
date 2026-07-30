# Provider recipes

Each recipe starts a target command with one secret. Replace the uppercase placeholders and the target path; never replace them with a secret value. Install and authenticate the selected provider's own CLI first; this wrapper selects and passes a secret but does not log in to the provider.

To trace a recipe, add `--debug` before `--`. It logs the selected location and lifecycle stages but never the secret value or provider authentication.

## macOS Keychain

`--item` is the Keychain service and `--field` is the account.

```sh
agent-secret-wrapper run \
  --provider macos-keychain \
  --item portainer-mcp --field api-key \
  --env PORTAINER_API_KEY \
  -- /absolute/path/to/portainer-mcp
```

## Linux Secret Service

`--item` is the Secret Service `service` attribute and `--field` is the `account` attribute.

```sh
agent-secret-wrapper run \
  --provider linux-secret-service \
  --item portainer-mcp --field api-key \
  --env PORTAINER_API_KEY \
  -- /absolute/path/to/portainer-mcp
```

## Windows Credential Manager

`--item` is the Credential Manager target. It has one password value, so omit `--field`.

```powershell
agent-secret-wrapper run `
  --provider windows-credential-manager `
  --item portainer-mcp-api-key `
  --env PORTAINER_API_KEY `
  -- C:\tools\portainer-mcp.exe
```

## Bitwarden

`--item` selects a Bitwarden vault item. Use `password`, `username`, `totp`, `uri`, or a custom-field label as `--field`.

```sh
agent-secret-wrapper run \
  --provider bitwarden \
  --item portainer --field password \
  --env PORTAINER_API_KEY \
  -- /absolute/path/to/portainer-mcp
```

## Bitwarden Secrets Manager

`--item` is the Bitwarden Secrets Manager secret ID. It exposes one `value` field.

```sh
agent-secret-wrapper run \
  --provider bws \
  --item SECRET_ID \
  --env PORTAINER_API_KEY \
  -- /absolute/path/to/portainer-mcp
```

## 1Password

`--scope vault=...` selects the vault; `--item` and `--field` select the item value.

```sh
agent-secret-wrapper run \
  --provider 1password \
  --scope vault=Development \
  --item portainer --field api-key \
  --env PORTAINER_API_KEY \
  -- /absolute/path/to/portainer-mcp
```

## Infisical

`--item` is the secret key. Use scopes only when the current Infisical context is insufficient.

```sh
agent-secret-wrapper run \
  --provider infisical \
  --item PORTAINER_API_KEY \
  --scope project=PROJECT_ID \
  --scope environment=dev \
  --scope path=/ \
  --env PORTAINER_API_KEY \
  -- /absolute/path/to/portainer-mcp
```
