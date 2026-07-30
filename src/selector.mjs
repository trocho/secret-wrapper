import { ProviderError } from "./providers.mjs";


const transforms = new Set(["base64", "json"]);


function scalar(value) {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  throw new ProviderError("selector must resolve to a string, number, or boolean");
}


export function parseSelector(selector) {
  const segments = [];
  let name = "";
  let segmentTransforms = [];
  let escaped = false;
  let annotationEnded = false;

  const pushSegment = () => {
    if (!name) {
      throw new ProviderError("selector segments cannot be empty");
    }
    segments.push({ name, transforms: segmentTransforms });
    name = "";
    segmentTransforms = [];
    annotationEnded = false;
  };

  for (let index = 0; index < selector.length; index += 1) {
    const character = selector[index];
    if (escaped) {
      if (!".\\[]".includes(character)) {
        throw new ProviderError("a selector escape may contain only a literal dot, backslash, or bracket");
      }
      if (annotationEnded) {
        throw new ProviderError("a selector annotation must end a segment");
      }
      name += character;
      escaped = false;
    } else if (character === "\\") {
      escaped = true;
    } else if (character === ".") {
      pushSegment();
    } else if (character === "[") {
      if (!name) {
        throw new ProviderError("a selector annotation requires a segment name");
      }
      const end = selector.indexOf("]", index + 1);
      if (end === -1) {
        throw new ProviderError("selector annotation is unterminated");
      }
      const transform = selector.slice(index + 1, end);
      if (!transforms.has(transform)) {
        throw new ProviderError(`unsupported selector transform: ${transform || "empty"}`);
      }
      segmentTransforms.push(transform);
      annotationEnded = true;
      index = end;
    } else if (character === "]") {
      throw new ProviderError("a literal closing bracket must be escaped");
    } else {
      if (annotationEnded) {
        throw new ProviderError("a selector annotation must end a segment");
      }
      name += character;
    }
  }

  if (escaped) {
    throw new ProviderError("selector cannot end with an escape");
  }
  pushSegment();
  return segments;
}


export function selectorText(selector) {
  return selector.map((segment) => `${segment.name}${segment.transforms.map((transform) => `[${transform}]`).join("")}`).join(".");
}


export function evaluateSelector(value, operations) {
  let selected = value;
  for (const operation of operations) {
    if (operation.type === "property") {
      if (selected === null || typeof selected !== "object") {
        throw new ProviderError(`JSON property ${operation.name} requires [json]`);
      }
      if (!Object.hasOwn(selected, operation.name)) {
        throw new ProviderError(`JSON value does not contain ${operation.name}`);
      }
      selected = selected[operation.name];
    } else if (operation.type === "transform" && operation.name === "base64") {
      if (typeof selected !== "string") {
        throw new ProviderError("[base64] requires a text value");
      }
      selected = decodeSecret(selected, "base64");
    } else if (operation.type === "transform" && operation.name === "json") {
      if (typeof selected !== "string") {
        throw new ProviderError("[json] requires a text value");
      }
      try {
        selected = JSON.parse(selected);
      } catch {
        throw new ProviderError("selected secret value is not valid JSON");
      }
    } else {
      throw new ProviderError(`unsupported selector transform: ${operation.name}`);
    }
  }
  return scalar(selected);
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
