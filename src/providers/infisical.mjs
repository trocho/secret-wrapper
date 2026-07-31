import { ProviderError } from "../provider-error.mjs";
import { SecretValue } from "../secret-value.mjs";
import { rejectUnexpectedScope, scopeValue, selectorOperations, selectorPart, trimNewline } from "./shared.mjs";


export const infisical = {
  scrub: ["INFISICAL_TOKEN"],
  load(binding, runCommand) {
    rejectUnexpectedScope(binding, ["project", "environment", "path"], "infisical");
    const key = selectorPart(binding, 0, "infisical", "a secret key");
    if (binding.selector[1] && binding.selector[1].name !== "value") {
      throw new ProviderError("infisical supports only the value field");
    }
    const consumed = binding.selector[1] ? 2 : 1;
    const operations = selectorOperations(binding.selector, consumed);
    const arguments_ = ["secrets", "get", key, "--plain", "--silent"];
    for (const [option, flag] of [["project", "--projectId"], ["environment", "--env"], ["path", "--path"]]) {
      if (scopeValue(binding, option)) {
        arguments_.push(`${flag}=${scopeValue(binding, option)}`);
      }
    }
    return new SecretValue(trimNewline(runCommand("infisical", arguments_)), operations);
  },
};
