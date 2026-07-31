import { ProviderError } from "../provider-error.mjs";
import { SecretValue } from "../secret-value.mjs";
import { rejectUnexpectedScope, scopeValue, selectorOperations, selectorPart, trimNewline } from "./shared.mjs";


export const onePassword = {
  scrub: ["OP_SERVICE_ACCOUNT_TOKEN"],
  load(binding, runCommand) {
    rejectUnexpectedScope(binding, ["vault"], "1password");
    const vault = scopeValue(binding, "vault");
    const item = selectorPart(binding, 0, "1password", "an item");
    const field = binding.selector[1]?.name ?? "password";
    const consumed = binding.selector[1] ? 2 : 1;
    const operations = selectorOperations(binding.selector, consumed);
    if (!vault) {
      throw new ProviderError("1password requires scope vault in its binding");
    }
    return new SecretValue(trimNewline(runCommand("op", ["read", `op://${vault}/${item}/${field}`])), operations);
  },
};
