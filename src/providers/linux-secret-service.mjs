import { rejectUnexpectedScope, selected, selectorOperations, selectorPart, trimNewline } from "./shared.mjs";
import { SecretValue } from "../secret-value.mjs";


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
  save(binding, value, runCommand) {
    rejectUnexpectedScope(binding, [], "linux-secret-service");
    const service = selectorPart(binding, 0, "linux-secret-service", "a service and account");
    const account = selectorPart(binding, 1, "linux-secret-service", "a service and account");
    const operations = selectorOperations(binding.selector, 2);
    let source;
    try {
      source = this.load(binding, runCommand).value;
    } catch {
      source = undefined;
    }
    const storedValue = new SecretValue(source, operations).with(value).source;
    runCommand("secret-tool", [
      "store", `--label=${service}`, "service", service, "account", account,
    ], { input: storedValue });
  },
};
