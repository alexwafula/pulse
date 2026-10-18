import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { build } from "esbuild";

const compiled = await build({entryPoints:["app/web/src/moment-narration.ts"], bundle:true, platform:"node", format:"esm", write:false});
const { pressureNarration } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`);
const replay = JSON.parse(readFileSync("data/scenarios/late-siege.json", "utf8"));
const golden = JSON.parse(readFileSync("app/testdata/metrics/late-siege.golden.json", "utf8"));
const pressure = golden.moments.find(moment => moment.type === "SUSTAINED_PRESSURE");

test("pressure template preserves Go facts, both evidence types and the available replay window", () => {
  const result = pressureNarration(pressure, replay, "CASUAL");
  assert.ok(result);
  assert.equal(result.key, "pressure.casual");
  assert.equal(result.count, pressure.values.actions);
  assert.equal(result.control, pressure.values.finalThird);
  assert.equal(result.team, replay.match.teams.find(team => team.id === pressure.teamId).name);
  assert.deepEqual(result.eventIds, pressure.reasons);
  assert.deepEqual(result.tickTimesMs, pressure.tickTimesMs);
  assert.equal(result.startMs, Math.max(replay.match.startMs, pressure.windowStartMs));
  assert.equal(result.endMs, pressure.windowEndMs);
  assert.equal(pressureNarration(pressure, replay, "ANALYST").key, "pressure.analyst");
  assert.equal(pressureNarration(pressure, replay, "CASUAL").key, "pressure.casual");
  result.eventIds.pop();
  assert.equal(pressure.reasons.length, pressure.values.actions, "presentation must not mutate Go evidence");
});

test("pressure template rejects unsupported or inconsistent evidence without model verification", () => {
  const mutations = [
    moment => { moment.reasons[0] = "invented"; },
    moment => { moment.reasons[0] = moment.reasons[1]; },
    moment => { moment.values.actions++; },
    moment => { moment.values.finalThird = 1.1; },
    moment => { moment.teamId = "unknown"; },
    moment => { moment.tickTimesMs = []; },
    moment => { moment.tickTimesMs[0] = replay.match.startMs - 1; },
    moment => { moment.windowEndMs++; },
    moment => { moment.windowStartMs = moment.timeMs + 1; },
    moment => { moment.evidenceKind = "tick"; },
    moment => { moment.type = "CONTROL_SWING"; },
  ];
  for (const mutate of mutations) {
    const invalid = structuredClone(pressure);
    mutate(invalid);
    assert.equal(pressureNarration(invalid, replay, "CASUAL"), undefined);
  }
  const otherTeam = structuredClone(replay);
  otherTeam.events.find(event => event.id === pressure.reasons[0]).teamId = "other";
  assert.equal(pressureNarration(pressure, otherTeam, "CASUAL"), undefined);
});

test("all locale pressure drafts preserve interpolation placeholders", () => {
  const catalog = JSON.parse(readFileSync("app/web/static/locales.json", "utf8"));
  const tokens = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  for (const key of ["pressure.casual", "pressure.analyst"]) {
    for (const locale of ["sw-KE", "hi-IN"]) assert.deepEqual(tokens(catalog[locale][key]), tokens(catalog["en-GB"][key]));
  }
});
