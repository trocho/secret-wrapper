import { ProviderError } from "./provider-error.mjs";


const transforms = new Set(["base64", "json"]);


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
