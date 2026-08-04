import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";


const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const temporaryDirectory = mkdtempSync(join(tmpdir(), "secret-wrapper-package-"));
const installDirectory = join(temporaryDirectory, "install");

try {
  const tarballName = execFileSync("npm", [
    "pack",
    "--silent",
    "--pack-destination",
    temporaryDirectory,
  ], {
    cwd: root,
    encoding: "utf8",
  }).trim();

  execFileSync("npm", [
    "install",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    "--prefix",
    installDirectory,
    join(temporaryDirectory, tarballName),
  ], {
    stdio: "inherit",
  });

  execFileSync(join(installDirectory, "node_modules/.bin/secret-wrapper"), ["--help"], {
    stdio: "ignore",
  });
  const packageDirectory = join(installDirectory, "node_modules/@trocho/secret-wrapper");
  for (const required of [
    "bin/secret-wrapper.mjs",
    "src/cli.mjs",
    "skills/secret-wrapper/SKILL.md",
    "docs/assets/operation-flow.svg",
  ]) {
    if (!existsSync(join(packageDirectory, required))) {
      throw new Error(`packed package is missing ${required}`);
    }
  }
  for (const internal of ["docs/plans", "maintenance", "tests"]) {
    if (existsSync(join(packageDirectory, internal))) {
      throw new Error(`packed package contains internal path ${internal}`);
    }
  }
  console.log("packed CLI is installable");
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
