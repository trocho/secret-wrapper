import { SecretValue } from "../secret-value.mjs";
import { rejectUnexpectedScope, selectorOperations, selectorPart, trimNewline } from "./shared.mjs";


export const windowsCredentialManager = {
  scrub: [],
  load(binding, runCommand) {
    rejectUnexpectedScope(binding, [], "windows-credential-manager");
    const target = selectorPart(binding, 0, "windows-credential-manager", "a target");
    const operations = selectorOperations(binding.selector, 1);
    const escapedTarget = target.replaceAll("'", "''");
    const script = [
      `$c=Get-StoredCredential -Target '${escapedTarget}'`,
      "if ($null -eq $c) { exit 3 }",
      "[System.Net.NetworkCredential]::new('', $c.Password).Password",
    ].join("; ");
    return new SecretValue(trimNewline(runCommand("powershell", [
      "-NoProfile", "-NonInteractive", "-Command", script,
    ])), operations);
  },
};
