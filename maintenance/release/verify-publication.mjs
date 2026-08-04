#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  readMetadata,
  repositoryMetadataProblems,
} from "../promotion/github-metadata.mjs";
import { fingerprintedSkill } from "../promotion/scripts/update-skill-fingerprint.mjs";


const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const defaultManifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const defaultGithubMetadata = readMetadata();
const defaultCanonicalSkill = readFileSync(resolve(root, "skills/secret-wrapper/SKILL.md"), "utf8");
const requestTimeoutMs = 15_000;
const verificationAttempts = 4;


export async function response(fetchImplementation, url, options = {}, timeoutMs = requestTimeoutMs) {
  const {
    headers = {},
    signal: callerSignal,
    ...requestOptions
  } = options;
  const timeoutController = new AbortController();
  const timeout = setTimeout(
    () => timeoutController.abort(new Error(`request timed out after ${timeoutMs}ms`)),
    timeoutMs,
  );
  const signal = callerSignal
    ? AbortSignal.any([callerSignal, timeoutController.signal])
    : timeoutController.signal;
  let result;
  try {
    result = await fetchImplementation(url, {
      ...requestOptions,
      headers: {
        "user-agent": "secret-wrapper-publication-verifier",
        ...headers,
      },
      signal,
    });
  } catch (error) {
    throw new Error(`${url} failed: ${error.message}`, { cause: error });
  } finally {
    clearTimeout(timeout);
  }
  if (!result.ok) {
    throw new Error(`${url} returned ${result.status}`);
  }
  return result;
}


function uniqueProfileSkills(profile, owner) {
  const escapedOwner = owner.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...profile.matchAll(new RegExp(`href="/@${escapedOwner}/([a-z0-9-]+)"`, "g"))]
    .map(([, slug]) => slug)
    .filter((slug, index, all) => all.indexOf(slug) === index)
    .sort();
}


export function assertPublication(snapshot, manifest = defaultManifest, githubMetadata = defaultGithubMetadata) {
  const version = manifest.version;
  const [githubOwner] = githubMetadata.repository.split("/");
  const publicSkill = "secret-wrapper";

  if (snapshot.registry.version !== version) {
    throw new Error(`npm latest is ${snapshot.registry.version}; expected ${version}`);
  }
  if (snapshot.registry.dist?.attestations?.provenance?.predicateType !== "https://slsa.dev/provenance/v1") {
    throw new Error(`npm ${version} is missing SLSA provenance`);
  }

  const repositoryProblems = repositoryMetadataProblems(githubMetadata, snapshot.repository);
  if (repositoryProblems.length > 0) {
    throw new Error(`GitHub metadata differs from its manifest:\n- ${repositoryProblems.join("\n- ")}`);
  }
  for (const required of [
    `npx --yes ${manifest.name}@${version} --help`,
    "## Demo",
    "Full Changelog",
  ]) {
    if (!snapshot.release.body?.includes(required)) {
      throw new Error(`GitHub Release v${version} is missing ${JSON.stringify(required)}`);
    }
  }
  for (const asset of ["secret-wrapper-plugin.zip", `trocho-secret-wrapper-${version}.tgz`]) {
    if (!snapshot.release.assets?.some(({ name }) => name === asset)) {
      throw new Error(`GitHub Release v${version} is missing ${asset}`);
    }
  }

  if (/\binvalid\b/i.test(snapshot.skillsBadge)) {
    throw new Error("skills.sh badge reports invalid");
  }
  if (fingerprintedSkill(defaultCanonicalSkill) !== defaultCanonicalSkill) {
    throw new Error("canonical SKILL.md has a stale source fingerprint");
  }
  const sourceFingerprint = defaultCanonicalSkill.match(/Source fingerprint: `sha256:[0-9a-f]{64}`\./)?.[0];
  if (!sourceFingerprint || !snapshot.skillsPage.includes(sourceFingerprint)) {
    throw new Error("skills.sh does not expose the exact canonical skill fingerprint");
  }
  const audit = snapshot.skillsAudit.audits?.find(({ provider }) => provider === githubMetadata.skillsSh.auditProvider);
  const latestSkillChange = snapshot.skillCommits[0]?.commit?.committer?.date;
  const auditTime = Date.parse(audit?.auditedAt);
  const latestSkillChangeTime = Date.parse(latestSkillChange);
  if (!Number.isFinite(auditTime) || !Number.isFinite(latestSkillChangeTime) || auditTime < latestSkillChangeTime) {
    throw new Error(`${githubMetadata.skillsSh.auditProvider} audit does not cover the latest SKILL.md change`);
  }

  const publicSkills = uniqueProfileSkills(snapshot.agentSkillProfile, githubOwner);
  if (JSON.stringify(publicSkills) !== JSON.stringify([publicSkill])) {
    throw new Error(`AgentSkill exposes ${publicSkills.join(", ") || "no skills"}; expected only ${publicSkill}`);
  }
}


export async function fetchPublicationSnapshot(fetchImplementation, manifest = defaultManifest, githubMetadata = defaultGithubMetadata) {
  const version = manifest.version;
  const encodedPackage = encodeURIComponent(manifest.name);
  const [githubOwner] = githubMetadata.repository.split("/");
  const publicSkill = "secret-wrapper";
  const skillPath = "skills/secret-wrapper/SKILL.md";
  const json = (url, options) => response(fetchImplementation, url, options).then((result) => result.json());
  const text = (url, options) => response(fetchImplementation, url, options).then((result) => result.text());

  const [
    registry,
    release,
    repository,
    skillsBadge,
    agentSkillProfile,
    skillsPage,
    skillsAudit,
    skillCommits,
  ] = await Promise.all([
    json(`https://registry.npmjs.org/${encodedPackage}/latest`),
    json(`https://api.github.com/repos/${githubMetadata.repository}/releases/tags/v${version}`, {
      headers: { accept: "application/vnd.github+json" },
    }),
    json(`https://api.github.com/repos/${githubMetadata.repository}`, {
      headers: { accept: "application/vnd.github+json" },
    }),
    text(`https://skills.sh/b/${githubMetadata.repository}`),
    text(`https://agentskill.sh/@${githubOwner}`),
    text(`https://skills.sh/${githubMetadata.repository}/${publicSkill}`),
    json(`https://skills.sh/api/v1/skills/audit/${githubMetadata.repository}/${publicSkill}`),
    json(`https://api.github.com/repos/${githubMetadata.repository}/commits?path=${encodeURIComponent(skillPath)}&per_page=1`, {
      headers: { accept: "application/vnd.github+json" },
    }),
    response(fetchImplementation, `https://agentskill.sh/@${githubOwner}/${publicSkill}`),
  ]);

  return {
    registry,
    release,
    repository,
    skillsBadge,
    agentSkillProfile,
    skillsPage,
    skillsAudit,
    skillCommits,
  };
}


export async function verifyPublication({
  fetchImplementation = fetch,
  manifest = defaultManifest,
  githubMetadata = defaultGithubMetadata,
  attempts = verificationAttempts,
  wait = (milliseconds) => new Promise((resolve_) => setTimeout(resolve_, milliseconds)),
} = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const snapshot = await fetchPublicationSnapshot(fetchImplementation, manifest, githubMetadata);
      assertPublication(snapshot, manifest, githubMetadata);
      console.log(`publication verified: ${manifest.name}@${manifest.version}`);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await wait(500 * (2 ** (attempt - 1)));
      }
    }
  }
  throw lastError;
}


if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await verifyPublication();
}
