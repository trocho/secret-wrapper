import { ProviderError } from "./provider-error.mjs";
import { decodeSecret, evaluateSelector } from "./selector.mjs";


function isIndex(name) {
  return /^(0|[1-9][0-9]*)$/.test(name);
}


function containerFor(next) {
  return next?.type === "property" && isIndex(next.name) ? [] : {};
}


function decodeJson(value) {
  if (typeof value !== "string") {
    throw new ProviderError("[json] requires a text value");
  }
  try {
    return JSON.parse(value);
  } catch {
    throw new ProviderError("selected secret value is not valid JSON");
  }
}


function encode(value, name) {
  if (name === "json") {
    return JSON.stringify(value);
  }
  if (name === "base64") {
    if (typeof value !== "string") {
      throw new ProviderError("[base64] requires a text value");
    }
    return Buffer.from(value, "utf8").toString("base64");
  }
  throw new ProviderError(`unsupported selector transform: ${name}`);
}


export class SecretValue {
  constructor(source, operations = []) {
    this.source = source;
    this.operations = operations;
  }

  read() {
    return evaluateSelector(this.source, this.operations);
  }

  with(value) {
    let selected = this.source;
    let absent = selected === undefined;
    const frames = [];
    for (let index = 0; index < this.operations.length; index += 1) {
      const operation = this.operations[index];
      if (operation.type === "transform") {
        frames.push(operation);
        if (absent) {
          selected = operation.name === "json" ? containerFor(this.operations[index + 1]) : undefined;
          absent = selected === undefined;
        } else if (operation.name === "json") {
          selected = decodeJson(selected);
        } else {
          selected = decodeSecret(selected, operation.name);
        }
        continue;
      }
      if (operation.type !== "property") {
        throw new ProviderError("unsupported selector operation");
      }
      if (selected === undefined && absent) {
        if (frames.at(-1)?.type !== "property") {
          throw new ProviderError(`JSON property ${operation.name} requires [json]`);
        }
        selected = containerFor(operation);
        absent = false;
      }
      if (selected === null || typeof selected !== "object" || Array.isArray(selected) && !isIndex(operation.name)) {
        throw new ProviderError(`JSON value does not contain ${operation.name}`);
      }
      const parent = selected;
      if (!Object.hasOwn(parent, operation.name)) {
        parent[operation.name] = undefined;
      }
      frames.push({ ...operation, parent });
      selected = parent[operation.name];
      absent = selected === undefined;
    }
    selected = value;
    for (const frame of frames.reverse()) {
      if (frame.type === "property") {
        frame.parent[frame.name] = selected;
        selected = frame.parent;
      } else {
        selected = encode(selected, frame.name);
      }
    }
    return new SecretValue(selected, this.operations);
  }
}
