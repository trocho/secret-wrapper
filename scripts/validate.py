#!/usr/bin/env python3
import filecmp
import json
from pathlib import Path
import sys


ROOT = Path(__file__).parents[1]
PLUGIN = ROOT / "plugins/secret-process-wrapper"


def require(condition, message):
    if not condition:
        raise SystemExit(message)


for path in [
    ROOT / ".claude-plugin/marketplace.json",
    PLUGIN / ".claude-plugin/plugin.json",
    PLUGIN / ".codex-plugin/plugin.json",
    ROOT / "skills/secret-process-wrapper/SKILL.md",
]:
    require(path.is_file(), f"missing {path.relative_to(ROOT)}")

marketplace = json.loads((ROOT / ".claude-plugin/marketplace.json").read_text())
require(marketplace["plugins"][0]["source"] == "./plugins/secret-process-wrapper", "invalid Claude source")
require(filecmp.cmp(
    ROOT / "skills/secret-process-wrapper/scripts/secret_exec.py",
    PLUGIN / "skills/secret-process-wrapper/scripts/secret_exec.py",
    shallow=False,
), "skill and plugin runner differ")
print("distribution is valid")
