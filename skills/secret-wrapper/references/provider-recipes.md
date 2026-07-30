# Provider recipes

Each recipe starts a target command with a bind. A bind is `ENV_NAME=SELECTOR`: the variable delivered to the target and its provider location. Repeat `--bind` for additional values. Replace the uppercase placeholders and the target path; never replace them with a secret value. Install and authenticate the selected provider's own CLI first; this wrapper selects and passes values but does not log in to the provider.

To trace a recipe, add `--debug` before `--`. It logs the selected location and lifecycle stages but never the secret value or provider authentication.

## macOS Keychain

The selector is `SERVICE.ACCOUNT`. For a JSON value, append its property path.

```sh
secret-wrapper run \
  --provider macos-keychain \
  --bind PORTAINER_API_KEY=portainer-mcp.api-key \
  -- /absolute/path/to/portainer-mcp
```

## Linux Secret Service

The selector is `SERVICE.ACCOUNT`. For a JSON value, append its property path.

```sh
secret-wrapper run \
  --provider linux-secret-service \
  --bind PORTAINER_API_KEY=portainer-mcp.api-key \
  -- /absolute/path/to/portainer-mcp
```

## Windows Credential Manager

The selector is the Credential Manager target. Append a JSON path only when its password value is JSON.

```powershell
secret-wrapper run `
  --provider windows-credential-manager `
  --bind PORTAINER_API_KEY=portainer-mcp-api-key `
  -- C:\tools\portainer-mcp.exe
```

## Bitwarden

The selector is `ITEM.FIELD`. `FIELD` can be `password`, `username`, `totp`, `uri`, a custom-field label, or an escaped login property such as `'portainer.login\.username'`. Append a JSON path after the field.

```sh
secret-wrapper run \
  --provider bitwarden \
  --bind PORTAINER_API_KEY=portainer.password \
  -- /absolute/path/to/portainer-mcp
```

## Bitwarden Secrets Manager

The selector is `SECRET_ID` or `SECRET_ID.value`. Append a JSON path after `value` when the secret value is JSON.

```sh
secret-wrapper run \
  --provider bws \
  --bind PORTAINER_API_KEY=SECRET_ID.value \
  -- /absolute/path/to/portainer-mcp
```

## 1Password

`--scope vault=...` selects the vault. The selector is `ITEM.FIELD`; append a JSON path after the field.

```sh
secret-wrapper run \
  --provider 1password \
  --scope vault=Development \
  --bind PORTAINER_API_KEY=portainer.api-key \
  -- /absolute/path/to/portainer-mcp
```

## Infisical

The selector is `SECRET_KEY` or `SECRET_KEY.value`. Use scopes only when the current Infisical context is insufficient; append a JSON path after `value` when needed.

```sh
secret-wrapper run \
  --provider infisical \
  --bind PORTAINER_API_KEY=PORTAINER_API_KEY.value \
  --scope project=PROJECT_ID \
  --scope environment=dev \
  --scope path=/ \
  -- /absolute/path/to/portainer-mcp
```

## JSON and Base64 values

For a secret field that contains JSON, add each property after a dot. This selects `token` from the JSON stored in Bitwarden's custom `config` field:

```sh
secret-wrapper run \
  --provider bitwarden --bind PORTAINER_API_KEY=portainer.config.api.token \
  -- /absolute/path/to/portainer-mcp
```

For a Base64-encoded final text value, add `--decode ENV_NAME=base64`. To decode a complete provider value before its JSON path is traversed, add `--decode-record ENV_NAME=base64`. Both stages can apply to the same bind; decoding is always explicit.

```sh
secret-wrapper run \
  --provider bitwarden --bind PORTAINER_API_KEY=portainer.encoded-api-key \
  --decode PORTAINER_API_KEY=base64 \
  -- /absolute/path/to/portainer-mcp
```

For a record that is Base64-encoded JSON and a Base64-encoded nested password, use both stages:

```sh
secret-wrapper run \
  --provider bitwarden \
  --bind PORTAINER_PASSWORD=portainer.config.credentials.password \
  --decode-record PORTAINER_PASSWORD=base64 \
  --decode PORTAINER_PASSWORD=base64 \
  -- /absolute/path/to/portainer-mcp
```

Escape a literal dot in a provider record, field, or JSON property with `\.` and quote the bind so the shell preserves it. For example, `--bind 'PORTAINER_API_KEY=com\.example\.portainer.api-key'` selects the `api-key` account from the macOS Keychain service `com.example.portainer`.
