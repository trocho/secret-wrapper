import { ProviderError } from "../provider-error.mjs";


export function scopeValue(binding, name) {
  return binding.scope?.[name];
}


export function rejectUnexpectedScope(binding, allowed, provider) {
  for (const name of Object.keys(binding.scope ?? {})) {
    if (!allowed.includes(name)) {
      throw new ProviderError(`${provider} does not support scope ${name}`);
    }
  }
}


export function trimNewline(value) {
  return value.replace(/\r?\n$/, "");
}


export function selectorPart(binding, index, provider, name) {
  const segment = binding.selector?.[index];
  if (!segment) {
    throw new ProviderError(`${provider} selector requires ${name}`);
  }
  return segment.name;
}


export function selectorOperations(selector, consumed) {
  const sourceSegment = selector[consumed - 1];
  if (selector.slice(0, consumed - 1).some((segment) => segment.transforms.length > 0)) {
    throw new ProviderError("a selector annotation cannot appear before a required provider locator");
  }
  const operations = [];
  const appendTransforms = (segment) => operations.push(...segment.transforms.map((name) => ({ type: "transform", name })));
  appendTransforms(sourceSegment);
  for (const segment of selector.slice(consumed)) {
    operations.push({ type: "property", name: segment.name });
    appendTransforms(segment);
  }
  return operations;
}
