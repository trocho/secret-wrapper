import { rejectUnexpectedScope, selected, selectorOperations, selectorPart, trimNewline } from "./shared.mjs";


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
};
