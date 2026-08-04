import assert from "node:assert/strict";
import test from "node:test";

import {
  collectPromotionMeasurement,
  parseMeasurementArguments,
} from "../maintenance/promotion/measure.mjs";


test("promotion measurement arguments accept only the scheduled checkpoints", () => {
  assert.deepEqual(parseMeasurementArguments([
    "--day", "7",
    "--external-testers", "3",
    "--actionable-feedback", "2",
  ]), { day: 7, externalTesters: 3, actionableFeedback: 2 });
  assert.throws(() => parseMeasurementArguments([
    "--day", "8",
    "--external-testers", "0",
    "--actionable-feedback", "0",
  ]), /day must be 7 or 14/);
  assert.throws(() => parseMeasurementArguments([
    "--day", "7",
    "--external-testers", "0",
    "--unexpected", "0",
  ]), /usage: measure\.mjs/);
});


test("promotion measurement produces one deterministic sanitized record", async () => {
  const fetchImplementation = async (url) => {
    if (url.includes("api.github.com")) {
      return Response.json({ stargazers_count: 11, forks_count: 4 });
    }
    if (url.includes("api.npmjs.org")) {
      return Response.json({ downloads: 23 });
    }
    return new Response('<script type="application/ld+json">{"userInteractionCount":5}</script>');
  };

  assert.deepEqual(await collectPromotionMeasurement({
    fetchImplementation,
    capturedAt: "2026-08-11T12:00:00.000Z",
    day: 7,
    externalTesters: 3,
    actionableFeedback: 2,
  }), {
    schemaVersion: 1,
    day: 7,
    capturedAt: "2026-08-11T12:00:00.000Z",
    publicSignals: {
      githubStars: 11,
      githubForks: 4,
      npmDownloadsLastWeek: 23,
      skillsShInstalls: 5,
    },
    humanSignals: {
      externalTesters: 3,
      actionableFeedback: 2,
    },
    exclusions: [
      "CI, maintainer, and verification installs are not treated as user adoption.",
    ],
  });
});
