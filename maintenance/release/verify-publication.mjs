#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";


const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const version = manifest.version;
const encodedPackage = encodeURIComponent(manifest.name);


async function response(url, options = {}) {
  const result = await fetch(url, {
    headers: { "user-agent": "secret-wrapper-publication-verifier" },
    ...options,
  });
  if (!result.ok) {
    throw new Error(`${url} returned ${result.status}`);
  }
  return result;
}


const registry = await (await response(`https://registry.npmjs.org/${encodedPackage}`)).json();
if (registry["dist-tags"]?.latest !== version) {
  throw new Error(`npm latest is ${registry["dist-tags"]?.latest}; expected ${version}`);
}
const published = registry.versions?.[version];
if (published?.dist?.attestations?.provenance?.predicateType !== "https://slsa.dev/provenance/v1") {
  throw new Error(`npm ${version} is missing SLSA provenance`);
}

const release = await (await response(`https://api.github.com/repos/trocho/secret-wrapper/releases/tags/v${version}`, {
  headers: {
    accept: "application/vnd.github+json",
    "user-agent": "secret-wrapper-publication-verifier",
  },
})).json();
for (const required of [
  `npx --yes ${manifest.name}@${version} --help`,
  "## Demo",
  "Full Changelog",
]) {
  if (!release.body?.includes(required)) {
    throw new Error(`GitHub Release v${version} is missing ${JSON.stringify(required)}`);
  }
}
for (const asset of ["secret-wrapper-plugin.zip", `trocho-secret-wrapper-${version}.tgz`]) {
  if (!release.assets?.some(({ name }) => name === asset)) {
    throw new Error(`GitHub Release v${version} is missing ${asset}`);
  }
}

await response("https://skills.sh/trocho/secret-wrapper/secret-wrapper");
await response("https://agentskill.sh/@trocho/secret-wrapper");

const profile = await (await response("https://agentskill.sh/@trocho")).text();
const publicSkills = [...profile.matchAll(/href="\/@trocho\/([a-z0-9-]+)"/g)]
  .map(([, slug]) => slug)
  .filter((slug, index, all) => all.indexOf(slug) === index)
  .sort();
if (JSON.stringify(publicSkills) !== JSON.stringify(["secret-wrapper"])) {
  throw new Error(`AgentSkill exposes ${publicSkills.join(", ") || "no skills"}; expected only secret-wrapper`);
}

console.log(`publication verified: ${manifest.name}@${version}`);
