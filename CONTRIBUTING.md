# Contributing

Contributions are welcome for provider adapters, selector behavior, MCP-host recipes, tests, documentation, and packaging.

## Safety first

Never include a real credential, provider export, authentication response, environment dump, record locator, scope, username, hostname, or private infrastructure detail in an issue, test fixture, screenshot, commit, or pull request. Use obvious placeholders and share security reports through the private process in [SECURITY.md](SECURITY.md).

## Development

Use Node.js 22 or newer.

```sh
npm test
npm run validate
npm run test:package-install
npm run pack:check
```

Run `npm run test:plugin-install` when changing plugin manifests, skill packaging, or installation behavior.

Provider adapters live in `src/providers/` behind the common provider contract. A provider change should include focused tests, a provider recipe, and any CLI or authorization documentation affected by the behavior. Do not add provider-specific flags to the common `run` interface.

The canonical public skill is `skills/secret-wrapper`. After changing it, run `npm run sync:plugin-skill`; validation rejects a stale plugin copy. Maintenance tools belong under `maintenance/`, outside every discoverable skill directory.

Visual assets are generated from the sources and commands documented in `maintenance/visuals/README.md`. Change the source and regenerate the consumer asset instead of editing generated SVG or PNG output by hand.

## Pull requests

Keep changes focused. Explain the user-facing outcome, security implications, validation performed, and rollback path when relevant. Use sanitized output only. Before submitting, confirm that the packed npm contents contain the public CLI, skill, and assets without internal plans or local artifacts.
