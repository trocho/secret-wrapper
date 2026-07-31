import { existsSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SecretNotFoundError } from "../provider-error.mjs";
import { SecretValue } from "../secret-value.mjs";
import { rejectUnexpectedScope, selectorOperations, selectorPart, trimNewline } from "./shared.mjs";


const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const writerSource = join(moduleDirectory, "macos-keychain-writer.m");
const writerDirectory = join(tmpdir(), "secret-wrapper");
const writerPath = join(writerDirectory, `macos-keychain-writer-${createHash("sha256").update(readFileSync(writerSource)).digest("hex").slice(0, 12)}`);


function isMissingKeychainItem(error) {
  return error?.status === 44 || /could not be found|item not found/i.test(error?.stderr ?? "");
}


function wasCreatedConcurrently(error) {
  return error?.status === 3 && !error?.stderr?.trim();
}


function compileKeychainWriter() {
  try {
    mkdirSync(writerDirectory, { recursive: true, mode: 0o700 });
    const temporaryPath = `${writerPath}-${process.pid}`;
    const compilation = spawnSync("xcrun", ["clang", "-fobjc-arc", "-framework", "Foundation", "-framework", "Security", writerSource, "-o", temporaryPath], {
      encoding: "utf8",
      stdio: "pipe",
    });
    if (compilation.error || compilation.status !== 0) {
      throw new Error((compilation.stderr || compilation.error?.message || "unknown compiler error").trim());
    }
    renameSync(temporaryPath, writerPath);
    return writerPath;
  } catch (error) {
    throw new Error(`macOS Keychain browser authorization requires Apple Command Line Tools: ${error.message}`);
  }
}


function writerCommand() {
  return existsSync(writerPath) ? writerPath : compileKeychainWriter();
}


function keychainParts(binding) {
  rejectUnexpectedScope(binding, [], "macos-keychain");
  return {
    service: selectorPart(binding, 0, "macos-keychain", "a service and account"),
    account: selectorPart(binding, 1, "macos-keychain", "a service and account"),
    operations: selectorOperations(binding.selector, 2),
  };
}


export const macosKeychain = {
  scrub: [],
  load(binding, runCommand) {
    const { service, account, operations } = keychainParts(binding);
    try {
      return new SecretValue(trimNewline(runCommand("security", [
        "find-generic-password", "-s", service, "-a", account, "-w",
      ])), operations);
    } catch (error) {
      if (isMissingKeychainItem(error)) {
        throw new SecretNotFoundError("macOS Keychain does not contain the requested value");
      }
      throw error;
    }
  },
  save(binding, value, { ifMissing = false, runCommand, write = undefined } = {}) {
    const { service, account, operations } = keychainParts(binding);
    let source;
    try {
      source = this.load(binding, runCommand).source;
    } catch (error) {
      if (!(error instanceof SecretNotFoundError)) {
        throw error;
      }
    }
    if (ifMissing && source !== undefined) {
      return { status: "preserved" };
    }
    const storedValue = new SecretValue(source, operations).with(value).source;
    const writeValue = write ?? ((serviceName, accountName, input, writeIfMissing) => runCommand(
      writerCommand(),
      [serviceName, accountName, ...(writeIfMissing ? ["--if-missing"] : [])],
      { input },
    ));
    try {
      writeValue(service, account, storedValue, ifMissing);
    } catch (error) {
      if (ifMissing && wasCreatedConcurrently(error)) {
        return { status: "preserved" };
      }
      throw error;
    }
    return { status: source === undefined ? "created" : "updated" };
  },
};
