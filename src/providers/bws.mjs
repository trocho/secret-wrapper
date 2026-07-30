import { ProviderError } from "../provider-error.mjs";
import { rejectUnexpectedScope, selected, selectorOperations, selectorPart } from "./shared.mjs";


export const bws = {
  scrub: ["BWS_ACCESS_TOKEN"],
  load(binding, runCommand) {
    rejectUnexpectedScope(binding, [], "bws");
    const secretId = selectorPart(binding, 0, "bws", "a secret ID");
    if (binding.selector[1] && binding.selector[1].name !== "value") {
      throw new ProviderError("bws supports only the value field");
    }
    const consumed = binding.selector[1] ? 2 : 1;
    const operations = selectorOperations(binding.selector, consumed);
    let payload;
    try {
      payload = JSON.parse(runCommand("bws", ["secret", "get", secretId, "--output", "json"]));
    } catch {
      throw new ProviderError("bws did not return a usable secret value");
    }
    if (typeof payload?.value !== "string") {
      throw new ProviderError("bws did not return a usable secret value");
    }
    return selected(payload.value, operations);
  },
};
