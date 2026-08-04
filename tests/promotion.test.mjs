import assert from "node:assert/strict";
import test from "node:test";

import {
  applyMetadata,
  githubEditArguments,
  githubTopicsArguments,
  metadataProblems,
  readMetadata,
  repositoryMetadataProblems,
  synchronizeMetadata,
} from "../maintenance/promotion/github-metadata.mjs";


const metadata = readMetadata();


test("GitHub metadata is translated into one deterministic edit command", () => {
  assert.deepEqual(githubEditArguments(metadata), [
    "repo", "edit", "trocho/secret-wrapper",
    "--description", metadata.description,
    "--homepage", metadata.homepage,
    "--enable-discussions=true",
  ]);
  assert.deepEqual(githubTopicsArguments(metadata), [
    "api", "--method", "PUT",
    `repos/${metadata.repository}/topics`,
    ...metadata.topics.flatMap((topic) => ["--field", `names[]=${topic}`]),
  ]);
});


test("GitHub metadata verification reports stale public state", () => {
  assert.deepEqual(metadataProblems(metadata, { repository: {
    full_name: "trocho/secret-wrapper",
    description: metadata.description,
    homepage: "https://github.com/trocho/agent-secret-wrapper#readme",
    has_discussions: false,
    topics: metadata.topics.slice(0, -1),
  }, vulnerabilityReporting: { enabled: false } }), [
    "homepage is https://github.com/trocho/agent-secret-wrapper#readme; expected https://github.com/trocho/secret-wrapper#readme",
    "discussions are disabled; expected enabled",
    `topics are ${metadata.topics.slice(0, -1).sort().join(", ")}; expected ${[...metadata.topics].sort().join(", ")}`,
    "private vulnerability reporting is disabled; expected enabled",
  ]);
});


test("GitHub metadata verification accepts the declared public state", () => {
  assert.deepEqual(metadataProblems(metadata, { repository: {
    full_name: metadata.repository,
    description: metadata.description,
    homepage: metadata.homepage,
    has_discussions: true,
    topics: [...metadata.topics].reverse(),
  }, vulnerabilityReporting: { enabled: true } }), []);
});


test("GitHub metadata verification rejects stale extras and false booleans", () => {
  assert.deepEqual(repositoryMetadataProblems({ ...metadata, discussions: false }, {
    full_name: metadata.repository,
    description: metadata.description,
    homepage: metadata.homepage,
    has_discussions: true,
    topics: [...metadata.topics, "stale-topic"],
  }), [
    "discussions are enabled; expected disabled",
    `topics are ${[...metadata.topics, "stale-topic"].sort().join(", ")}; expected ${[...metadata.topics].sort().join(", ")}`,
  ]);
});


test("GitHub metadata synchronization applies every declared setting before checking it", () => {
  const calls = [];
  const run = (command, arguments_, options) => {
    calls.push([command, arguments_, options]);
    if (arguments_[0] !== "api" || options.encoding !== "utf8") {
      return undefined;
    }
    return JSON.stringify(arguments_[1].endsWith("private-vulnerability-reporting")
      ? { enabled: true }
      : {
          full_name: metadata.repository,
          description: metadata.description,
          homepage: metadata.homepage,
          has_discussions: metadata.discussions,
          topics: metadata.topics,
        });
  };

  synchronizeMetadata(metadata, run);

  assert.equal(calls.length, 5);
  assert.deepEqual(calls.slice(0, 3).map(([, arguments_]) => arguments_), [
    githubEditArguments(metadata),
    githubTopicsArguments(metadata),
    ["api", "--method", "PUT", `repos/${metadata.repository}/private-vulnerability-reporting`],
  ]);
});


test("GitHub metadata synchronization can disable private vulnerability reporting", () => {
  const calls = [];
  applyMetadata({ ...metadata, privateVulnerabilityReporting: false }, (command, arguments_, options) => {
    calls.push([command, arguments_, options]);
  });
  assert.deepEqual(calls[2][1], [
    "api", "--method", "DELETE", `repos/${metadata.repository}/private-vulnerability-reporting`,
  ]);
});
