import { ProviderError } from "../provider-error.mjs";
import { rejectUnexpectedScope, selected, selectorOperations, selectorPart, trimNewline } from "./shared.mjs";
import { SecretValue } from "../secret-value.mjs";


function itemPayload(item, runCommand) {
  try {
    return JSON.parse(runCommand("bw", ["get", "item", item]));
  } catch {
    throw new ProviderError("bitwarden did not return the requested item");
  }
}


function canCreateItem(item, runCommand) {
  let items;
  try {
    items = JSON.parse(runCommand("bw", ["list", "items", "--search", item]));
  } catch {
    throw new ProviderError("bitwarden could not check whether the requested item exists");
  }
  return Array.isArray(items) && !items.some((candidate) => candidate.name === item);
}


function fieldValue(payload, field) {
  if (field === "password") {
    return payload.login?.password;
  }
  if (field === "username") {
    return payload.login?.username;
  }
  if (field === "totp") {
    return payload.login?.totp;
  }
  if (field === "uri") {
    return payload.login?.uris?.[0]?.uri;
  }
  if (field.startsWith("login.")) {
    return payload.login?.[field.slice("login.".length)];
  }
  return payload.fields?.find((entry) => entry.name === field)?.value;
}


function setFieldValue(payload, field, value) {
  payload.login ??= {};
  if (field === "password" || field === "username" || field === "totp") {
    payload.login[field] = value;
    return;
  }
  if (field === "uri") {
    payload.login.uris ??= [{}];
    payload.login.uris[0] ??= {};
    payload.login.uris[0].uri = value;
    return;
  }
  if (field.startsWith("login.")) {
    payload.login[field.slice("login.".length)] = value;
    return;
  }
  payload.fields ??= [];
  const entry = payload.fields.find((candidate) => candidate.name === field);
  if (entry) {
    entry.value = value;
  } else {
    payload.fields.push({ name: field, value, type: 0 });
  }
}


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
    const payload = itemPayload(item, runCommand);
    const value = fieldValue(payload, field);
    if (typeof value !== "string") {
      throw new ProviderError("bitwarden did not return the requested item field");
    }
    return selected(value, operations);
  },
  save(binding, value, runCommand) {
    rejectUnexpectedScope(binding, [], "bitwarden");
    const item = selectorPart(binding, 0, "bitwarden", "an item");
    const field = binding.selector[1]?.name ?? "password";
    const consumed = binding.selector[1] ? 2 : 1;
    const operations = selectorOperations(binding.selector, consumed);
    let payload;
    let create = false;
    try {
      payload = itemPayload(item, runCommand);
    } catch {
      if (!canCreateItem(item, runCommand)) {
        throw new ProviderError("bitwarden could not open the requested item");
      }
      payload = { type: 1, name: item, login: { uris: [] }, fields: [] };
      create = true;
    }
    setFieldValue(payload, field, new SecretValue(fieldValue(payload, field), operations).with(value).source);
    const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
    runCommand("bw", create ? ["create", "item"] : ["edit", "item", payload.id], { input: encoded });
  },
};
