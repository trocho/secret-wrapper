# Authorization visuals

## States to document

Use one artifact per state:

| State | Source | File |
| --- | --- | --- |
| CLI begins and waits for authorization | `render-terminal-trace.mjs` | `docs/assets/terminal-flow.svg` |
| One local form for all missing values | `node tests/scripts/authorization-demo.mjs` | `docs/assets/authorization-form.png` |
| Values saved or concurrently preserved | Submit harmless placeholders in the demo | `docs/assets/authorization-success.png` |
| Provider rejects a save; user can retry | `node tests/scripts/authorization-demo.mjs --failure` | `docs/assets/authorization-retry.png` |

## Browser capture

Use the browser-control skill with a 1200 × 900 viewport. Start the demo in a terminal, let it open the local form, then capture only its page content. Submit placeholder text only; no browser URL, token, private host, process argument, credential, or real selector may appear in a final asset.

Every browser PNG must be an actual PNG and exactly 1200 × 900. Do not crop, stretch, or pad a final image after capture. Prefer a visible viewport screenshot for a form or error state; a full-page screenshot is appropriate only when it does not create blank or clipped content. Inspect every output before adding it to `docs/assets/`.

## Visual language

- Dark navy background: `#0a101a`; card: `#111b2a` / `#172438`.
- Mint accent: `#77e3ba`; quiet text: `#9aa9bc`; use a visible red only for an error.
- Use the form's serif display headline and monospace body. Do not add stock imagery, logos, gradients unrelated to the local UI, or fake browser chrome.
- Keep one primary message per image. Use the terminal trace for sequence and the browser captures for interaction and outcome.

## Terminal trace

Generate the committed trace instead of editing SVG markup:

```sh
node skills/secret-wrapper-visuals/scripts/render-terminal-trace.mjs \
  --output docs/assets/terminal-flow.svg
```

Pass repeated `--line` options only for concise demo-only content. The generator rejects common token shapes and long lines, but inspect the text yourself before committing.

## Validation

```sh
node skills/secret-wrapper-visuals/scripts/check-authorization-assets.mjs
npm test
npm run validate
git diff --check
```

Keep image alt text descriptive and put it beside the paragraph it supports in `README.md`.
