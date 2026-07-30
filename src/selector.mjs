import { ProviderError } from "./providers.mjs";


export function parseSelector(selector) {
  const segments = [];
  let segment = "";
  let escaped = false;

  for (const character of selector) {
    if (escaped) {
      if (character !== "." && character !== "\\") {
        throw new ProviderError("a selector escape may contain only a literal dot or backslash");
      }
      segment += character;
      escaped = false;
    } else if (character === "\\") {
      escaped = true;
    } else if (character === ".") {
      if (!segment) {
        throw new ProviderError("selector segments cannot be empty");
      }
      segments.push(segment);
      segment = "";
    } else {
      segment += character;
    }
  }

  if (escaped) {
    throw new ProviderError("selector cannot end with an escape");
  }
  if (!segment) {
    throw new ProviderError("selector segments cannot be empty");
  }
  segments.push(segment);
  return segments;
}


export function selectJsonPath(value, path) {
  if (path.length === 0) {
    return value;
  }

  let selected;
  try {
    selected = JSON.parse(value);
  } catch {
    throw new ProviderError("the selected secret value is not valid JSON");
  }

  for (const segment of path) {
    if (selected === null || typeof selected !== "object" || !Object.hasOwn(selected, segment)) {
      throw new ProviderError(`JSON path does not contain ${segment}`);
    }
    selected = selected[segment];
  }

  if (typeof selected === "string") {
    return selected;
  }
  if (typeof selected === "number" || typeof selected === "boolean") {
    return String(selected);
  }
  throw new ProviderError("JSON path must resolve to a string, number, or boolean");
}


export function decodeSecret(value, encoding) {
  if (!encoding) {
    return value;
  }
  if (encoding !== "base64") {
    throw new ProviderError(`unsupported decoding: ${encoding}`);
  }

  const normalized = value.replaceAll(/\s/g, "");
  if (!normalized || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(normalized)) {
    throw new ProviderError("selected secret value is not valid base64");
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.from(normalized, "base64"));
  } catch {
    throw new ProviderError("base64 secret value is not valid UTF-8 text");
  }
}
