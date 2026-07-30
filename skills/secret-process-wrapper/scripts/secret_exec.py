#!/usr/bin/env python3
"""Inject one secret from a supported provider into a child process."""

import argparse
import os
import subprocess
import sys


def secret_from_macos_keychain(args):
    if not args.service or not args.account:
        raise ValueError("macos-keychain requires --service and --account")
    return subprocess.check_output(
        ["security", "find-generic-password", "-s", args.service, "-a", args.account, "-w"],
        text=True,
        stderr=subprocess.DEVNULL,
    ).rstrip("\n")


def secret_from_bitwarden(args):
    if not args.item:
        raise ValueError("bitwarden requires --item (an item name or ID)")
    return subprocess.check_output(["bw", "get", "password", args.item], text=True).rstrip("\n")


def secret_from_windows_credential_manager(args):
    if not args.target:
        raise ValueError("windows-credential-manager requires --target")
    target = args.target.replace("'", "''")
    script = (
        f"$c=Get-StoredCredential -Target '{target}'; "
        "if ($null -eq $c) { exit 3 }; "
        "[System.Net.NetworkCredential]::new('', $c.Password).Password"
    )
    return subprocess.check_output(
        ["powershell", "-NoProfile", "-NonInteractive", "-Command", script], text=True
    ).rstrip("\r\n")


def load_secret(args):
    return {
        "macos-keychain": secret_from_macos_keychain,
        "bitwarden": secret_from_bitwarden,
        "windows-credential-manager": secret_from_windows_credential_manager,
    }[args.provider](args)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--provider", required=True, choices=["macos-keychain", "bitwarden", "windows-credential-manager"])
    parser.add_argument("--env", required=True)
    parser.add_argument("--service")
    parser.add_argument("--account")
    parser.add_argument("--item")
    parser.add_argument("--target")
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    if not args.env.isidentifier() or not args.env.isupper():
        parser.error("--env must be an uppercase environment variable name")
    if not args.command or args.command[0] != "--" or len(args.command) == 1:
        parser.error("provide the child command after --")
    try:
        secret = load_secret(args)
    except (OSError, subprocess.CalledProcessError, ValueError) as error:
        print(f"secret provider failed: {error}", file=sys.stderr)
        raise SystemExit(78)
    environment = os.environ.copy()
    environment[args.env] = secret
    os.execvpe(args.command[1], args.command[1:], environment)


if __name__ == "__main__":
    main()
