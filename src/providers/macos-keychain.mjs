import { rejectUnexpectedScope, selected, selectorOperations, selectorPart, trimNewline } from "./shared.mjs";
import { SecretValue } from "../secret-value.mjs";


export const macosKeychain = {
  scrub: [],
  load(binding, runCommand) {
    rejectUnexpectedScope(binding, [], "macos-keychain");
    const service = selectorPart(binding, 0, "macos-keychain", "a service and account");
    const account = selectorPart(binding, 1, "macos-keychain", "a service and account");
    const operations = selectorOperations(binding.selector, 2);
    return selected(trimNewline(runCommand("security", [
      "find-generic-password", "-s", service, "-a", account, "-w",
    ])), operations);
  },
  save(binding, value, runCommand) {
    rejectUnexpectedScope(binding, [], "macos-keychain");
    const service = selectorPart(binding, 0, "macos-keychain", "a service and account");
    const account = selectorPart(binding, 1, "macos-keychain", "a service and account");
    const operations = selectorOperations(binding.selector, 2);
    let source;
    try {
      source = this.load(binding, runCommand).value;
    } catch {
      source = undefined;
    }
    const storedValue = new SecretValue(source, operations).with(value).source;
    runCommand("security", [
      "add-generic-password", "-U", "-s", service, "-a", account, "-w", storedValue,
    ]);
  },
};
