#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { response } from "../release/verify-publication.mjs";
import { readMetadata } from "./github-metadata.mjs";


function nonNegativeInteger(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || String(parsed) !== value) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return parsed;
}


export function parseMeasurementArguments(arguments_) {
  const values = {};
  const allowed = new Set(["day", "external-testers", "actionable-feedback"]);
  for (let index = 0; index < arguments_.length; index += 2) {
    const name = arguments_[index];
    const value = arguments_[index + 1];
    const key = name?.slice(2);
    if (!name?.startsWith("--") || value === undefined || !allowed.has(key) || values[key] !== undefined) {
      throw new Error("usage: measure.mjs --day 7|14 --external-testers N --actionable-feedback N");
    }
    values[key] = value;
  }
  const day = nonNegativeInteger(values.day, "day");
  if (![7, 14].includes(day)) {
    throw new Error("day must be 7 or 14");
  }
  return {
    day,
    externalTesters: nonNegativeInteger(values["external-testers"], "external-testers"),
    actionableFeedback: nonNegativeInteger(values["actionable-feedback"], "actionable-feedback"),
  };
}


export async function collectPromotionMeasurement({
  fetchImplementation = fetch,
  capturedAt = new Date().toISOString(),
  day,
  externalTesters,
  actionableFeedback,
  metadata = readMetadata(),
} = {}) {
  const packageName = encodeURIComponent("@trocho/secret-wrapper");
  const [repository, downloads, skillsPage] = await Promise.all([
    response(fetchImplementation, `https://api.github.com/repos/${metadata.repository}`).then((result) => result.json()),
    response(fetchImplementation, `https://api.npmjs.org/downloads/point/last-week/${packageName}`).then((result) => result.json()),
    response(fetchImplementation, `https://skills.sh/${metadata.repository}/secret-wrapper`).then((result) => result.text()),
  ]);
  const installs = skillsPage.match(/"userInteractionCount":(\d+)/)?.[1];
  if (installs === undefined) {
    throw new Error("skills.sh install count is unavailable");
  }
  return {
    schemaVersion: 1,
    day,
    capturedAt,
    publicSignals: {
      githubStars: repository.stargazers_count,
      githubForks: repository.forks_count,
      npmDownloadsLastWeek: downloads.downloads,
      skillsShInstalls: Number.parseInt(installs, 10),
    },
    humanSignals: {
      externalTesters,
      actionableFeedback,
    },
    exclusions: [
      "CI, maintainer, and verification installs are not treated as user adoption.",
    ],
  };
}


if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseMeasurementArguments(process.argv.slice(2));
  console.log(JSON.stringify(await collectPromotionMeasurement(options), null, 2));
}
