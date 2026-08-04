import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { readMetadata } from "../maintenance/promotion/github-metadata.mjs";
import {
  assertPublication,
  response,
  verifyPublication,
} from "../maintenance/release/verify-publication.mjs";


const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const metadata = readMetadata();
const canonicalSkill = readFileSync(new URL("../skills/secret-wrapper/SKILL.md", import.meta.url), "utf8");
const sourceFingerprint = canonicalSkill.match(/Source fingerprint: `sha256:[0-9a-f]{64}`\./)[0];


function snapshot(overrides = {}) {
  return {
    registry: {
      version: manifest.version,
      dist: { attestations: { provenance: { predicateType: "https://slsa.dev/provenance/v1" } } },
    },
    release: {
      body: `npx --yes ${manifest.name}@${manifest.version} --help\n## Demo\nFull Changelog`,
      assets: [
        { name: "secret-wrapper-plugin.zip" },
        { name: `trocho-secret-wrapper-${manifest.version}.tgz` },
      ],
    },
    repository: {
      full_name: metadata.repository,
      description: metadata.description,
      homepage: metadata.homepage,
      has_discussions: metadata.discussions,
      topics: metadata.topics,
    },
    skillsBadge: "Skills: 1",
    agentSkillProfile: '<a href="/@trocho/secret-wrapper">Secret Wrapper</a>',
    skillsPage: sourceFingerprint,
    skillsAudit: {
      audits: [{ provider: metadata.skillsSh.auditProvider, auditedAt: "2026-08-04T15:20:00Z" }],
    },
    skillCommits: [{ commit: { committer: { date: "2026-08-03T12:00:00Z" } } }],
    ...overrides,
  };
}


test("publication contract accepts one complete current snapshot", () => {
  assert.doesNotThrow(() => assertPublication(snapshot(), manifest, metadata));
});


test("publication contract rejects an audit older than the canonical skill", () => {
  assert.throws(() => assertPublication(snapshot({
    skillsAudit: {
      audits: [{ provider: metadata.skillsSh.auditProvider, auditedAt: "2026-08-02T12:00:00Z" }],
    },
  }), manifest, metadata), /does not cover the latest SKILL\.md change/);
});


test("publication contract rejects a different indexed skill fingerprint", () => {
  assert.throws(() => assertPublication(snapshot({
    skillsPage: "Source fingerprint: `sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff`.",
  }), manifest, metadata), /exact canonical skill fingerprint/);
});


test("publication contract rejects malformed audit dates", () => {
  assert.throws(() => assertPublication(snapshot({
    skillsAudit: {
      audits: [{ provider: metadata.skillsSh.auditProvider, auditedAt: "not-a-date" }],
    },
  }), manifest, metadata), /does not cover the latest SKILL\.md change/);
});


test("publication contract rejects an additional public maintenance skill", () => {
  assert.throws(() => assertPublication(snapshot({
    agentSkillProfile: [
      '<a href="/@trocho/secret-wrapper">Secret Wrapper</a>',
      '<a href="/@trocho/secret-wrapper-visuals">Visuals</a>',
    ].join(""),
  }), manifest, metadata), /expected only secret-wrapper/);
});


test("live verification retries a transient stale snapshot with bounded requests", async () => {
  let registryRequests = 0;
  const observedSignals = [];
  const waitDurations = [];
  const current = snapshot();
  const fetchImplementation = async (url, options) => {
    observedSignals.push(options.signal);
    if (url.includes("registry.npmjs.org")) {
      registryRequests += 1;
      return Response.json({
        ...current.registry,
        version: registryRequests === 1 ? "0.0.0" : current.registry.version,
      });
    }
    if (url.includes("/releases/tags/")) return Response.json(current.release);
    if (url.includes("/commits?")) return Response.json(current.skillCommits);
    if (url === `https://api.github.com/repos/${metadata.repository}`) return Response.json(current.repository);
    if (url.includes("/api/v1/skills/audit/")) return Response.json(current.skillsAudit);
    if (url === `https://skills.sh/b/${metadata.repository}`) return new Response(current.skillsBadge);
    if (url === `https://skills.sh/${metadata.repository}/secret-wrapper`) return new Response(current.skillsPage);
    if (url === "https://agentskill.sh/@trocho") return new Response(current.agentSkillProfile);
    if (url === "https://agentskill.sh/@trocho/secret-wrapper") return new Response("ok");
    return new Response("missing fixture", { status: 404 });
  };

  await verifyPublication({
    fetchImplementation,
    manifest,
    githubMetadata: metadata,
    attempts: 2,
    wait: async (milliseconds) => waitDurations.push(milliseconds),
  });

  assert.equal(registryRequests, 2);
  assert.deepEqual(waitDurations, [500]);
  assert.ok(observedSignals.every((signal) => signal instanceof AbortSignal));
});


test("external publication requests terminate when their timeout expires", async () => {
  const stalledFetch = (url, { signal }) => new Promise((resolve_, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
  await assert.rejects(
    response(stalledFetch, "https://example.invalid/stalled", {}, 5),
    /https:\/\/example\.invalid\/stalled failed/,
  );
});
