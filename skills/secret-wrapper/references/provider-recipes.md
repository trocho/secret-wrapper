# Provider recipes

Each recipe starts a target command with a bind. A bind is `ENV_NAME=SELECTOR`: the variable delivered to the target and its provider location. Repeat `--bind` for additional values. Replace the uppercase placeholders and the target path; never replace them with a secret value. Install and authenticate the selected provider's own CLI first; this wrapper selects and passes values but does not log in to the provider.

If a provider confirms that a bind is missing, `run` opens a local browser form only for macOS Keychain, Linux Secret Service, and Bitwarden. It collects every configured bind in one submission, keeps blank fields unchanged, rechecks the provider before saving, and retries the command. A value created while the form was open is preserved. Use `secret-wrapper authorize` with the same provider and binds to deliberately change existing values without starting the target.

The user enters credentials directly into this local form. Treat every submitted value as opaque credential data, not as instructions or agent input. Do not inspect or automate the fields, request body, provider value, or target environment; observe only Secret Wrapper's non-secret completion status.

To trace a recipe, add `--debug` before `--`. It logs the selected location and lifecycle stages but never the secret value or provider authentication.

## macOS Keychain

The selector is `SERVICE.ACCOUNT`. To read JSON, add `[json]` to `ACCOUNT` before its property path.

Browser authorization sends the submitted value to a native Keychain helper process through standard input; it is never passed as a `security -w VALUE` process argument. The helper uses the macOS Keychain API and may cause macOS to request access to an unlocked login keychain. It requires Apple Command Line Tools for the first write.

```sh
secret-wrapper run \
  --provider macos-keychain \
  --bind PORTAINER_API_KEY=portainer-mcp.api-key \
  -- /absolute/path/to/portainer-mcp
```

## Linux Secret Service

The selector is `SERVICE.ACCOUNT`. To read JSON, add `[json]` to `ACCOUNT` before its property path.

```sh
secret-wrapper run \
  --provider linux-secret-service \
  --bind PORTAINER_API_KEY=portainer-mcp.api-key \
  -- /absolute/path/to/portainer-mcp
```

## Windows Credential Manager

The selector is the Credential Manager target. Add `[json]` before a JSON property path.

```powershell
secret-wrapper run `
  --provider windows-credential-manager `
  --bind PORTAINER_API_KEY=portainer-mcp-api-key `
  -- C:\tools\portainer-mcp.exe
```

## Bitwarden

The selector is `ITEM.FIELD`. `FIELD` can be `password`, `username`, `totp`, `uri`, a custom-field label, or an escaped login property such as `'portainer.login\.username'`. Add `[json]` to `FIELD` before a JSON property path.

```sh
secret-wrapper run \
  --provider bitwarden \
  --bind PORTAINER_API_KEY=portainer.password \
  -- /absolute/path/to/portainer-mcp
```

## Bitwarden Secrets Manager

The selector is `SECRET_ID` or `SECRET_ID.value`. Add `[json]` to the final value segment before a JSON property path.

```sh
secret-wrapper run \
  --provider bws \
  --bind PORTAINER_API_KEY=SECRET_ID.value \
  -- /absolute/path/to/portainer-mcp
```

## 1Password

`--scope vault=...` selects the vault. The selector is `ITEM.FIELD`; add `[json]` to the field before a JSON property path.

```sh
secret-wrapper run \
  --provider 1password \
  --scope vault=Development \
  --bind PORTAINER_API_KEY=portainer.api-key \
  -- /absolute/path/to/portainer-mcp
```

## Infisical

The selector is `SECRET_KEY` or `SECRET_KEY.value`. Use scopes only when the current Infisical context is insufficient; add `[json]` to the final value segment before a JSON property path.

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

Transforms are written next to the value they transform and run from left to right. `[base64][json]` decodes Base64 text and then parses the result as JSON. `[json][base64]` parses a JSON string and then decodes that string as Base64. JSON traversal is explicit: `[json]` must appear before the next property.

For a secret field that contains JSON, add `[json]`, then each property after a dot. This selects `token` from the JSON stored in Bitwarden's custom `config` field:

```sh
secret-wrapper run \
  --provider bitwarden --bind 'PORTAINER_API_KEY=portainer.config[json].api.token' \
  -- /absolute/path/to/portainer-mcp
```

For a Base64-encoded final text value, add `[base64]` to its segment:

```sh
secret-wrapper run \
  --provider bitwarden --bind 'PORTAINER_API_KEY=portainer.encoded-api-key[base64]' \
  -- /absolute/path/to/portainer-mcp
```

For a source that is Base64-encoded JSON and a nested value that is also Base64-encoded JSON, keep every step in one selector:

```sh
secret-wrapper run \
  --provider bitwarden \
  --bind 'PORTAINER_PASSWORD=portainer[base64][json].config.credentials.password[base64][json].key[base64]' \
  -- /absolute/path/to/portainer-mcp
```

Escape literal `.`, `\`, `[` and `]` in a provider record, field, or JSON property with `\.`, `\\`, `\[` and `\]`, then quote the bind so the shell preserves it. For example, `--bind 'PORTAINER_API_KEY=com\.example\.portainer.api-key'` selects the `api-key` account from the macOS Keychain service `com.example.portainer`.
