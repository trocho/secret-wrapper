# Promotion kit

This directory is the canonical source for Secret Wrapper's public positioning, launch copy, and repository metadata. Keep claims tied to released behavior and never include credential values, provider exports, real selectors, or private infrastructure details.

## Positioning

**One line:** Stop putting MCP tokens in config files. Secret Wrapper launches local tools with credentials resolved at runtime from native keychains and secret managers through one provider-neutral CLI.

**Audience:** Developers running local MCP servers, coding agents, scripts, or services that currently receive credentials from JSON, TOML, `.env`, or shell startup files.

**Proof points:**

- one `run` contract across macOS Keychain, Linux Secret Service, Windows Credential Manager, Bitwarden, Bitwarden Secrets Manager, 1Password, and Infisical;
- multiple values and explicit JSON/Base64 transformations;
- local first-use authorization for writable providers;
- npm Trusted Publishing with SLSA provenance;
- installable skills and plugins for Codex and Claude Code.

## Demo storyboard

Use the sanitized assets already committed under `docs/assets/`. Do not record a real provider, record locator, username, or credential.

1. **Problem — 5 seconds:** show an MCP configuration containing only the `secret-wrapper run` command and placeholder selector.
2. **Launch — 7 seconds:** run the sanitized command and show the terminal lifecycle trace.
3. **Authorize — 12 seconds:** show the local form with demo field names and blank password inputs.
4. **Result — 8 seconds:** submit placeholders, show per-value success, then show the target process start.
5. **CTA — 5 seconds:** show `npx --yes @trocho/secret-wrapper --help` and the repository URL.

Target length: 30–45 seconds. Crop to one 1200×900 frame, keep browser and terminal margins consistent, and verify that no credential value appears in any frame or metadata.

## Channel copy

### X

MCP credentials do not belong in JSON, TOML, `.env`, or shell history.

Secret Wrapper resolves them at process launch from native keychains and secret managers, then exposes them only to the target process.

Open source: https://github.com/trocho/secret-wrapper

### LinkedIn

Local MCP servers often begin with an API token copied into JSON, TOML, or `.env`. That is convenient until configurations are shared, logged, backed up, or committed.

I built Secret Wrapper to keep the configuration declarative while resolving credentials only when the target process starts. It uses one CLI contract across native keychains, Bitwarden, 1Password, Infisical, and other supported providers, with installable guidance for Codex and Claude Code.

Repository and demo: https://github.com/trocho/secret-wrapper

### Reddit r/mcp

**Title:** I built a provider-neutral CLI that keeps MCP secrets out of config files

Many local MCP configurations still contain API keys directly or point at a plaintext `.env` file. I wanted the host configuration to contain only a non-secret locator while the credential stayed in a native keychain or existing secret manager.

Secret Wrapper launches the MCP process, resolves one or more values at runtime, and injects them only into that child process. The CLI remains the same across providers, supports JSON/Base64 selection, and can open a local first-use form when a supported provider confirms a value is missing.

It is MIT licensed and available through npm, Codex/Claude plugins, and agent-skill directories. I would especially value feedback on provider ergonomics and threat-model gaps.

https://github.com/trocho/secret-wrapper

### DEV article

**Title:** How to keep MCP credentials out of JSON, TOML, and `.env`

Outline: show the plaintext-configuration problem, define the launcher boundary, run the Bitwarden and native-keychain examples, explain the child-process environment, walk through first-use authorization, and finish with limitations and the security model.

### Show HN

**Title:** Show HN: Secret Wrapper – keep MCP credentials out of JSON, TOML and .env

Use the Reddit body as the starting description, add why the project was built, and remain available to answer questions. Do not ask anyone to upvote or comment.

## Directory submission

The appropriate MCP ecosystem listing is `punkpeye/awesome-mcp-devtools` under **Utilities → Development Tools**. Secret Wrapper is not an MCP server and must not be submitted to the official MCP Registry or server-only lists.

Use this entry, alphabetically between `taskade/mcp` and `type-mcp/mcp-anything`:

```markdown
- [trocho/secret-wrapper](https://github.com/trocho/secret-wrapper) - Local-first CLI that resolves secrets from native keychains and secret managers at process launch, keeping credentials out of MCP configuration, `.env` files, and shell history.
```

PR title: `Add Secret Wrapper to Development Tools`.

## Launch checklist

- `npm run promotion:apply` synchronizes GitHub About metadata, topics, Discussions, and private vulnerability reporting.
- `npm run promotion:check` verifies the live GitHub settings against `github-metadata.json`.
- `node maintenance/release/verify-publication.mjs` verifies npm, provenance, GitHub Release, the exact skills.sh source fingerprint and audit freshness, and AgentSkill's public inventory.
- AgentSkill stale-entry cleanup is tracked in [agentskill-sh/ags#15](https://github.com/agentskill-sh/ags/issues/15); its submitted request body is preserved in `directory-requests/agentskill-stale-entry.md`.
- The current skills.sh Snyk warning and its explicit trust boundary are recorded in `directory-requests/skills-sh-audit-status.md`; the original stale-snapshot report was [corrected publicly](https://github.com/vercel-labs/skills/issues/707#issuecomment-5181364870) after a real installation refreshed the audit.
- Use the versioned evidence and request bodies in `directory-requests/` when a directory needs maintainer intervention; record the resulting public issue URL here after submission.
- Publish the directory PR only after the repository checks pass.
- Present social copy for human review before posting it.
- At days 7 and 14, generate a sanitized measurement record with `npm run promotion:measure -- --day 7 --external-testers 0 --actionable-feedback 0` (change the day and aggregate human counts as needed). Save the JSON output under `maintenance/promotion/measurements/`; its contract is `measurement-schema.json`. CI, maintainer, and verification installs are excluded from user adoption.
