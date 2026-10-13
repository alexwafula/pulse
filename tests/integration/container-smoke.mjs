import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";

const base = new URL(process.env.PULSE_URL ?? "http://127.0.0.1:8080");
assert.ok(["http:", "https:"].includes(base.protocol));
assert.ok(!base.username && !base.password && !base.search && !base.hash);

async function get(path) {
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(60000) });
  assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
  return response;
}

let healthy = false;
for (let attempt = 0; attempt < 30; attempt++) {
  try {
    await get("/healthz");
    healthy = true;
    break;
  } catch (error) {
    if (attempt === 29) throw error;
    await sleep(1000);
  }
}
assert.ok(healthy);
await get("/experience?scenario=corner&view=three");
await get("/static/three-renderer.js");
await get("/static/pixi-renderer.js");

for (const scenario of ["corner", "central", "exchange", "late-siege", "calm-midfield"]) {
  const replay = await (await get(`/api/replay?scenario=${scenario}`)).json();
  assert.equal(replay.schemaVersion, "2.0.0");
  assert.equal(replay.match.teams.length, 2);
  assert.ok(replay.match.players.length > 0 && replay.tracking.length > 0);
  console.log(`PASS ${scenario}: ${replay.events.length} events, ${replay.tracking.length} frames`);
}

for (const scenario of ["late-siege", "calm-midfield"]) {
  const metrics = await (await get(`/api/metrics?scenario=${scenario}`)).json();
  assert.ok(metrics.ticks.length > 0);
}

const packs = await (await get("/api/fact-packs?scenario=corner")).json();
assert.equal(packs.length, 1);
const fact = packs[0].facts[0];
assert.equal(fact.metric, "set_piece_shots");
assert.equal(fact.value, 1);

for (const persona of ["CASUAL", "ANALYST"]) {
  const response = await get(`/api/insights?scenario=corner&persona=${persona}&locale=en-GB`);
  assert.equal(response.headers.get("X-Pulse-Insight-Source"), persona === "CASUAL" ? "python-recorded" : "python-template");
  const feed = await response.json();
  assert.equal(feed.cues.length, 1);
  const cue = feed.cues[0];
  assert.equal(cue.verification.status, persona === "CASUAL" ? "VERIFIED" : "FALLBACK_TEMPLATE");
  assert.deepEqual(cue.eventIds, fact.eventIds);
  assert.deepEqual(cue.factIds, [fact.id]);
  assert.equal(cue.replayStartMs, packs[0].windowStartMs);
  assert.equal(cue.replayEndMs, packs[0].windowEndMs);
}
console.log("PASS Go -> Python recorded insight, analyst template, complete source evidence and all packaged scenarios");
