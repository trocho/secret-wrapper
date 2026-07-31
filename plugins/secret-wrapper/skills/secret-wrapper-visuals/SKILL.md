---
name: secret-wrapper-visuals
description: Create or refresh safe, consistent visual documentation for Secret Wrapper. Use when adding README screenshots, terminal traces, authorization-flow imagery, or other product visuals under docs/assets.
---

# Secret Wrapper Visuals

Make a visual explain one user-visible moment: launch, missing-value authorization, completed save, or a recoverable failure. Keep every artifact demonstrably safe to publish.

## Workflow

1. Read [references/authorization-visuals.md](references/authorization-visuals.md).
2. Use `tests/scripts/authorization-demo.mjs` for browser captures. It exercises the production local-form code with demo-only names.
3. Generate a terminal visual with `scripts/render-terminal-trace.mjs`; do not hand-edit the SVG.
4. Capture the form, success, or failure state with the browser-control skill at the documented baseline viewport. Capture page content, not browser chrome or a local URL.
5. Put final assets in `docs/assets/`, reference them next to the relevant README explanation, and use descriptive alt text.
6. Run the visual checks and the repository validation before committing.

## Safety boundary

- Use demo process names and placeholder values only. Never render or commit a credential, API response, browser token, private hostname, local path, real record locator, or scope.
- Do not use a visually invented authorization flow: the screenshot must come from the current `src/setup.mjs` form through the demo launcher.
- Keep the browser surface dark, local, and focused on a single state. Preserve the established navy, mint, and monospace visual language described in the reference.
- Do not put secret-related configuration in task compactions or handoffs; link to the local configuration file when necessary.

## Resources

- `scripts/render-terminal-trace.mjs` creates the sanitized SVG trace.
- `scripts/check-authorization-assets.mjs` enforces the shared screenshot dimensions.
- `references/authorization-visuals.md` contains capture states, visual tokens, and validation commands.
