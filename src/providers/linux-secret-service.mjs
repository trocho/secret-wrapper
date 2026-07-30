import { rejectUnexpectedScope, selected, selectorOperations, selectorPart, trimNewline } from "./shared.mjs";


export const linuxSecretService = {
  scrub: [],
  load(binding, runCommand) {
    rejectUnexpectedScope(binding, [], "linux-secret-service");
    const service = selectorPart(binding, 0, "linux-secret-service", "a service and account");
    const account = selectorPart(binding, 1, "linux-secret-service", "a service and account");
    const operations = selectorOperations(binding.selector, 2);
    return selected(trimNewline(runCommand("secret-tool", [
      "lookup", "service", service, "account", account,
    ])), operations);
  },
};
