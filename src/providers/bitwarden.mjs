import { ProviderError } from "../provider-error.mjs";
import { rejectUnexpectedScope, selected, selectorOperations, selectorPart, trimNewline } from "./shared.mjs";


export const bitwarden = {
  scrub: ["BW_SESSION", "BW_CLIENTID", "BW_CLIENTSECRET", "BW_PASSWORD"],
  load(binding, runCommand) {
    rejectUnexpectedScope(binding, [], "bitwarden");
    const item = selectorPart(binding, 0, "bitwarden", "an item");
    const field = binding.selector[1]?.name ?? "password";
    const consumed = binding.selector[1] ? 2 : 1;
    const operations = selectorOperations(binding.selector, consumed);
    if (["password", "username", "uri", "totp"].includes(field)) {
      return selected(trimNewline(runCommand("bw", ["get", field, item])), operations);
    }
    let payload;
    try {
      payload = JSON.parse(runCommand("bw", ["get", "item", item]));
    } catch {
      throw new ProviderError("bitwarden did not return the requested item field");
    }
    const value = field.startsWith("login.")
      ? payload.login?.[field.slice("login.".length)]
      : payload.fields?.find((entry) => entry.name === field)?.value;
    if (typeof value !== "string") {
      throw new ProviderError("bitwarden did not return the requested item field");
    }
    return selected(value, operations);
  },
};
