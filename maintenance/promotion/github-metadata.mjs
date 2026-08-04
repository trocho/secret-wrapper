#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";


const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const metadataPath = resolve(root, "maintenance/promotion/github-metadata.json");


export function githubEditArguments(metadata) {
  return [
    "repo", "edit", metadata.repository,
    "--description", metadata.description,
    "--homepage", metadata.homepage,
    `--enable-discussions=${metadata.discussions}`,
  ];
}


export function githubTopicsArguments(metadata) {
  return [
    "api", "--method", "PUT",
    `repos/${metadata.repository}/topics`,
    ...metadata.topics.flatMap((topic) => ["--field", `names[]=${topic}`]),
  ];
}


export function repositoryMetadataProblems(metadata, repository) {
  const problems = [];
  if (repository.full_name !== metadata.repository) {
    problems.push(`repository is ${repository.full_name}; expected ${metadata.repository}`);
  }
  if (repository.description !== metadata.description) {
    problems.push(`description is ${repository.description}; expected ${metadata.description}`);
  }
  if (repository.homepage !== metadata.homepage) {
    problems.push(`homepage is ${repository.homepage}; expected ${metadata.homepage}`);
  }
  if (repository.has_discussions !== metadata.discussions) {
    problems.push(`discussions are ${repository.has_discussions ? "enabled" : "disabled"}; expected ${metadata.discussions ? "enabled" : "disabled"}`);
  }
  const actualTopics = [...(repository.topics ?? [])].sort();
  const expectedTopics = [...metadata.topics].sort();
  if (JSON.stringify(actualTopics) !== JSON.stringify(expectedTopics)) {
    problems.push(`topics are ${actualTopics.join(", ") || "empty"}; expected ${expectedTopics.join(", ") || "empty"}`);
  }
  return problems;
}


export function metadataProblems(metadata, { repository, vulnerabilityReporting }) {
  const problems = repositoryMetadataProblems(metadata, repository);
  if (vulnerabilityReporting.enabled !== metadata.privateVulnerabilityReporting) {
    problems.push(`private vulnerability reporting is ${vulnerabilityReporting.enabled ? "enabled" : "disabled"}; expected ${metadata.privateVulnerabilityReporting ? "enabled" : "disabled"}`);
  }
  return problems;
}


export function readMetadata() {
  return JSON.parse(readFileSync(metadataPath, "utf8"));
}


export function applyMetadata(metadata, run = execFileSync) {
  run("gh", githubEditArguments(metadata), { stdio: "inherit" });
  run("gh", githubTopicsArguments(metadata), { stdio: "inherit" });
  run("gh", [
    "api", "--method", metadata.privateVulnerabilityReporting ? "PUT" : "DELETE",
    `repos/${metadata.repository}/private-vulnerability-reporting`,
  ], { stdio: "inherit" });
}


export function checkMetadata(metadata, run = execFileSync) {
  const repository = JSON.parse(run("gh", [
    "api", `repos/${metadata.repository}`,
  ], { encoding: "utf8" }));
  const vulnerabilityReporting = JSON.parse(run("gh", [
    "api", `repos/${metadata.repository}/private-vulnerability-reporting`,
  ], { encoding: "utf8" }));
  const problems = metadataProblems(metadata, { repository, vulnerabilityReporting });
  if (problems.length > 0) {
    throw new Error(`GitHub metadata differs from its manifest:\n- ${problems.join("\n- ")}`);
  }
  console.log(`GitHub metadata is synchronized for ${metadata.repository}`);
}


export function synchronizeMetadata(metadata, run = execFileSync) {
  applyMetadata(metadata, run);
  checkMetadata(metadata, run);
}


function main(arguments_) {
  const metadata = readMetadata();
  if (arguments_.length !== 1 || !["--apply", "--check"].includes(arguments_[0])) {
    throw new Error("usage: github-metadata.mjs --apply|--check");
  }
  if (arguments_[0] === "--apply") {
    synchronizeMetadata(metadata);
    return;
  }
  checkMetadata(metadata);
}


if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
