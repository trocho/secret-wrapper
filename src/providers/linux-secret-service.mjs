import { SecretNotFoundError } from "../provider-error.mjs";
import { SecretValue } from "../secret-value.mjs";
import { rejectUnexpectedScope, selectorOperations, selectorPart, trimNewline } from "./shared.mjs";


function isMissingSecret(error) {
  return error?.status === 1 && !error.stderr?.trim();
}


function secretParts(binding) {
  rejectUnexpectedScope(binding, [], "linux-secret-service");
  return {
    service: selectorPart(binding, 0, "linux-secret-service", "a service and account"),
    account: selectorPart(binding, 1, "linux-secret-service", "a service and account"),
    operations: selectorOperations(binding.selector, 2),
  };
}


export const linuxSecretService = {
  scrub: [],
  load(binding, runCommand) {
    const { service, account, operations } = secretParts(binding);
    try {
      return new SecretValue(trimNewline(runCommand("secret-tool", [
        "lookup", "service", service, "account", account,
      ])), operations);
    } catch (error) {
      if (isMissingSecret(error)) {
        throw new SecretNotFoundError("Linux Secret Service does not contain the requested value");
      }
      throw error;
    }
  },
  save(binding, value, { ifMissing = false, runCommand } = {}) {
    const { service, account, operations } = secretParts(binding);
    let source;
    try {
      source = this.load(binding, runCommand).source;
    } catch (error) {
      if (!(error instanceof SecretNotFoundError)) {
        throw error;
      }
    }
    if (ifMissing && source !== undefined) {
      return { status: "preserved" };
    }
    const storedValue = new SecretValue(source, operations).with(value).source;
    runCommand("secret-tool", [
      "store", `--label=${service}`, "service", service, "account", account,
    ], { input: storedValue });
    return { status: source === undefined ? "created" : "updated" };
  },
};
