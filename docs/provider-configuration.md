# Provider configuration

The runtime command is always:

```sh
agent-secret-wrapper run --provider PROVIDER --env SECRET_NAME -- TARGET [ARGS...]
```

`SECRET_NAME` is a logical name. The wrapper uses it directly where a provider has a predictable naming convention. For a different name, vault, project, or native-store location, add a non-secret binding once to the local configuration file.

The default file is `~/.config/agent-secret-wrapper/providers.json` on macOS and Linux, or `%APPDATA%\\agent-secret-wrapper\\providers.json` on Windows. Set `AGENT_SECRET_WRAPPER_CONFIG` to use a different local file.

```json
{
  "providers": {
    "macos-keychain": {
      "PORTAINER_API_KEY": {
        "service": "codex-portainer-mcp-token",
        "account": "portainer-api-key"
      }
    },
    "linux-secret-service": {
      "PORTAINER_API_KEY": {
        "service": "agent-secret-wrapper",
        "account": "PORTAINER_API_KEY"
      }
    },
    "windows-credential-manager": {
      "PORTAINER_API_KEY": {
        "target": "agent-secret-wrapper/PORTAINER_API_KEY"
      }
    },
    "bitwarden": {
      "PORTAINER_API_KEY": {
        "item": "PORTAINER_API_KEY"
      }
    },
    "bws": {
      "PORTAINER_API_KEY": {
        "secretId": "SECRET_ID"
      }
    },
    "1password": {
      "PORTAINER_API_KEY": {
        "reference": "op://Development/portainer/api-key"
      }
    },
    "infisical": {
      "PORTAINER_API_KEY": {
        "secretKey": "PORTAINER_API_KEY",
        "projectId": "PROJECT_ID",
        "environment": "dev",
        "path": "/"
      }
    }
  }
}
```

This file contains only provider locations and context. Do not put a secret value, access token, or password in it.

## Defaults

Without a binding, macOS Keychain and Linux Secret Service use service `agent-secret-wrapper` and account `SECRET_NAME`; Windows uses target `agent-secret-wrapper/SECRET_NAME`; Bitwarden uses an item named `SECRET_NAME`; 1Password uses `op://agent-secret-wrapper/SECRET_NAME/password`; and Infisical uses secret key `SECRET_NAME` with its current CLI context. BWS always needs a binding because its CLI reads a secret by opaque ID.
