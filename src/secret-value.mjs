import { ProviderError } from "./provider-error.mjs";


function isIndex(name) {
  return /^(0|[1-9][0-9]*)$/.test(name);
}


function containerFor(next) {
  return next?.type === "property" && isIndex(next.name) ? [] : {};
}


export class SecretValue {
  constructor(source, operations = []) {
    this.source = source;
    this.operations = operations;
  }

  read() {
    let selected = this.source;
    for (const operation of this.operations) {
      if (operation.type === "property") {
        if (selected === null || typeof selected !== "object") {
          throw new ProviderError(`JSON property ${operation.name} requires [json]`);
        }
        if (!Object.hasOwn(selected, operation.name)) {
          throw new ProviderError(`JSON value does not contain ${operation.name}`);
        }
        selected = selected[operation.name];
      } else if (operation.type === "transform") {
        selected = this.#decode(selected, operation.name);
      } else {
        throw new ProviderError(`unsupported selector transform: ${operation.name}`);
      }
    }
    return this.#scalar(selected);
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
        } else {
          selected = this.#decode(selected, operation.name);
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
        selected = this.#encode(selected, frame.name);
      }
    }
    return new SecretValue(selected, this.operations);
  }

  #decode(value, name) {
    if (typeof value !== "string") {
      throw new ProviderError(`[${name}] requires a text value`);
    }
    if (name === "json") {
      try {
        return JSON.parse(value);
      } catch {
        throw new ProviderError("selected secret value is not valid JSON");
      }
    }
    if (name === "base64") {
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
    throw new ProviderError(`unsupported selector transform: ${name}`);
  }

  #encode(value, name) {
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

  #scalar(value) {
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    throw new ProviderError("selector must resolve to a string, number, or boolean");
  }
}
