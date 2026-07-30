#!/bin/sh
set -eu

readonly marketplace="secret-wrapper"
readonly plugin="secret-wrapper"
readonly workspace="/workspace"

fail() {
  printf '%s\n' "plugin-install-smoke: $*" >&2
  exit 1
}

require_file() {
  test -f "$1" || fail "expected file is missing: $1"
}

require_installed_skill() {
  root="$1"
  skill_path="$(find "$root" -type f -path "*/${plugin}/*/skills/secret-wrapper/SKILL.md" -print -quit)"
  test -n "$skill_path" || fail "installed skill was not found below $root"
  grep -Fq "## Provider recipes" "$skill_path" || fail "installed skill is missing its provider-recipes reference"
  require_file "$(dirname "$skill_path")/references/provider-recipes.md"
}

printf '%s\n' "Verifying Codex plugin installation"
codex plugin marketplace add "$workspace" --json
codex plugin add "${plugin}@${marketplace}" --json
codex plugin list --marketplace "$marketplace" --available --json > "$HOME/codex-plugins.json"
grep -Fq "${plugin}" "$HOME/codex-plugins.json" || fail "Codex did not list the installed plugin"
require_installed_skill "$HOME/.codex"

printf '%s\n' "Verifying Claude Code plugin installation"
claude plugin marketplace add "$workspace/.claude-plugin/marketplace.json"
claude plugin install "${plugin}@${marketplace}" --scope user
claude plugin list > "$HOME/claude-plugins.txt"
grep -Fq "${plugin}" "$HOME/claude-plugins.txt" || fail "Claude Code did not list the installed plugin"
require_installed_skill "$HOME/.claude/plugins/cache"

printf '%s\n' "plugin-install-smoke: passed"
