# Repository operating rules

## Everything as code

Treat every repeatable release, documentation, maintenance, validation, and distribution task as versioned code.

- Keep an editable source, a deterministic generator or bounded script, the generated artifact when consumers need it, and a validation check in the same repository change.
- Update behavior, tests, user documentation, agent instructions, and release automation together. Do not leave a manual-only procedure as the canonical path.
- Reuse and extend an existing maintenance script before adding another implementation of the same lifecycle.
- Never hand-edit a generated artifact. Change its source and regenerate it with the committed command.
- Keep public interfaces narrow. `skills/secret-wrapper` is the only user-facing skill distributed through the repository, npm package, Codex plugin, Claude Code plugin, skills.sh, and AgentSkill.
- Keep repository-maintenance tooling outside discoverable `skills/` and plugin directories. Maintenance documentation must not masquerade as an installable user skill.
- Add a regression check whenever a packaging, discovery, rendering, or release problem is fixed.
- Before publishing, run the complete validation, inspect packed contents, verify public skill discovery, and exercise the installed package or plugin in an isolated environment.

## Release channels

Keep these public surfaces aligned for every stable release:

| Channel | Required state |
| --- | --- |
| npm | Public stable `@trocho/secret-wrapper`, Trusted Publishing, provenance, working `npx` command |
| GitHub Release | Matching immutable version tag, changelog, demo, install command, npm and plugin artifacts |
| skills.sh | Only `secret-wrapper`, compatible with Codex and Claude Code, linked from README |
| AgentSkill | Only `secret-wrapper`, imported from the canonical repository skill, linked from README |

Version and test the release pipeline itself. A release is complete only after the registry, GitHub Release, directory listings, badges, and clean `main` state are verified.
