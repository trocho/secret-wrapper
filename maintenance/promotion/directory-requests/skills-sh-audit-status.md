# skills.sh audit status

The public skill page contains the current authorization security boundary. A real isolated installation refreshed the Snyk audit on 2026-08-04.

Snyk still reports W011 as a low-confidence warning (`0.10`) because the optional local authorization form accepts user-entered credential data. Secret Wrapper treats that submission as opaque data, never as instructions or model input. The form stays on `127.0.0.1`, agents must not inspect or automate it, and values are passed only to the selected provider and target process.

Do not weaken the authorization boundary to optimize a directory badge. The publication verifier checks the exact generated source fingerprint on skills.sh and that the Snyk audit is newer than the latest canonical `SKILL.md` change.

The earlier stale-audit report was [corrected in vercel-labs/skills#707](https://github.com/vercel-labs/skills/issues/707#issuecomment-5181364870) after the directory refreshed.
