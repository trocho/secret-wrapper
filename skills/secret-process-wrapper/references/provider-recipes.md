# Provider recipes

Each recipe starts a target command with one secret. Replace the uppercase placeholders and the target path; never replace them with a secret value. Install and authenticate the selected provider's own CLI first; this wrapper selects and passes a secret but does not log in to the provider.

To trace a recipe, add `--debug` before `--`. It logs the selected location and lifecycle stages but never the secret value or provider authentication.

## macOS Keychain

The selector is `SERVICE.ACCOUNT`. For a JSON value, append its property path.

```sh
agent-secret-wrapper run \
  --provider macos-keychain \
  --selector portainer-mcp.api-key \
  --env PORTAINER_API_KEY \
  -- /absolute/path/to/portainer-mcp
```

## Linux Secret Service

The selector is `SERVICE.ACCOUNT`. For a JSON value, append its property path.

```sh
agent-secret-wrapper run \
  --provider linux-secret-service \
  --selector portainer-mcp.api-key \
  --env PORTAINER_API_KEY \
  -- /absolute/path/to/portainer-mcp
```

## Windows Credential Manager

The selector is the Credential Manager target. Append a JSON path only when its password value is JSON.

```powershell
agent-secret-wrapper run `
  --provider windows-credential-manager `
  --selector portainer-mcp-api-key `
  --env PORTAINER_API_KEY `
  -- C:\tools\portainer-mcp.exe
```

## Bitwarden

The selector is `ITEM.FIELD`. `FIELD` can be `password`, `username`, `totp`, `uri`, a custom-field label, or an escaped login property such as `'portainer.login\.username'`. Append a JSON path after the field.

```sh
agent-secret-wrapper run \
  --provider bitwarden \
  --selector portainer.password \
  --env PORTAINER_API_KEY \
  -- /absolute/path/to/portainer-mcp
```

## Bitwarden Secrets Manager

The selector is `SECRET_ID` or `SECRET_ID.value`. Append a JSON path after `value` when the secret value is JSON.

```sh
agent-secret-wrapper run \
  --provider bws \
  --selector SECRET_ID.value \
  --env PORTAINER_API_KEY \
  -- /absolute/path/to/portainer-mcp
```

## 1Password

`--scope vault=...` selects the vault. The selector is `ITEM.FIELD`; append a JSON path after the field.

```sh
agent-secret-wrapper run \
  --provider 1password \
  --scope vault=Development \
  --selector portainer.api-key \
  --env PORTAINER_API_KEY \
  -- /absolute/path/to/portainer-mcp
```

## Infisical

The selector is `SECRET_KEY` or `SECRET_KEY.value`. Use scopes only when the current Infisical context is insufficient; append a JSON path after `value` when needed.

```sh
agent-secret-wrapper run \
  --provider infisical \
  --selector PORTAINER_API_KEY.value \
  --scope project=PROJECT_ID \
  --scope environment=dev \
  --scope path=/ \
  --env PORTAINER_API_KEY \
  -- /absolute/path/to/portainer-mcp
```

## JSON and Base64 values

For a secret field that contains JSON, add each property after a dot. This selects `token` from the JSON stored in Bitwarden's custom `config` field:

```sh
agent-secret-wrapper run \
  --provider bitwarden --selector portainer.config.api.token \
  --env PORTAINER_API_KEY \
  -- /absolute/path/to/portainer-mcp
```

For a Base64-encoded text value, add `--decode base64`. Decoding is always explicit; the wrapper does not infer it from the value.

```sh
agent-secret-wrapper run \
  --provider bitwarden --selector portainer.encoded-api-key \
  --decode base64 --env PORTAINER_API_KEY \
  -- /absolute/path/to/portainer-mcp
```

Escape a literal dot in a provider record, field, or JSON property with `\.` and quote the selector so the shell preserves it. For example, `--selector 'com\.example\.portainer.api-key'` selects the `api-key` account from the macOS Keychain service `com.example.portainer`.
