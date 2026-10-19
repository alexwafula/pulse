import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { build } from "esbuild";

const compiled = await build({entryPoints:["app/web/src/playback.ts"], bundle:true, platform:"node", format:"esm", write:false});
const {actionPlaybackRange, advancePlayback, evidencePlaybackRange, trackingFrameIndex} = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`);
const corner = JSON.parse(readFileSync("data/samples/first-sequence.json", "utf8"));
const siege = JSON.parse(readFileSync("data/scenarios/late-siege.json", "utf8"));

test("exact event seeks bracket the recorded tracking, including off-grid actions and rewind", () => {
  for (const replay of [corner, siege]) {
    for (const at of [replay.match.endMs, ...replay.events.map(event => event.timeMs).reverse(), replay.match.startMs]) {
      const index = trackingFrameIndex(replay.tracking, at);
      assert.ok(replay.tracking[index].timeMs <= at);
      assert.ok(index === replay.tracking.length - 1 || replay.tracking[index + 1].timeMs > at);
    }
    for (const event of replay.events) {
      const range = actionPlaybackRange(replay, event);
      const next = replay.events.find(candidate => candidate.timeMs > event.timeMs);
      assert.equal(range.startMs, event.timeMs);
      assert.ok(range.endMs >= event.timeMs && range.endMs <= replay.match.endMs);
      if (next) assert.ok(range.endMs < next.timeMs, "an action clip must not include the next action");
    }
  }
});

test("corner postroll finishes the recorded blocked shot without editing cue/fact bounds", () => {
  const factWindow = {startMs:1672000, endMs:1678000};
  const before = JSON.stringify(corner);
  assert.deepEqual(evidencePlaybackRange(corner, factWindow, ["evt-06", "evt-07"]), {startMs:1672000, endMs:1680000});
  assert.deepEqual(factWindow, {startMs:1672000, endMs:1678000});
  assert.equal(JSON.stringify(corner), before);
  const {x,y} = corner.tracking.at(-1).ball;
  assert.notDeepEqual({x,y}, corner.events.at(-1).to, "a blocked shot is not forced to its nominal destination");
});

test("generated final action ends before the tracking-only tail, with no invented motion", () => {
  const last = siege.events.at(-1);
  const range = actionPlaybackRange(siege, last);
  assert.ok(range.endMs > last.timeMs && range.endMs < siege.match.endMs - 10000);
  const index = trackingFrameIndex(siege.tracking, range.endMs);
  for (const frame of siege.tracking.slice(index)) assert.deepEqual(frame.ball, siege.tracking.at(-1).ball);
});

test("clock follows actual visible elapsed time, does not drop slow frames and respects every clip bound", () => {
  assert.equal(advancePlayback(10000, 800, 4, 20000), 13200);
  assert.equal(advancePlayback(10000, 800, 1, 20000), 10800);
  assert.equal(advancePlayback(10000, 800, 10, 15000), 15000);
  assert.equal(advancePlayback(10000, -1, 4, 20000), 10000);
  assert.equal(advancePlayback(10000, 2000, 1, 10999), 10999, "exclusive comparison endpoints stay exact");
});

test("new replay translations retain clock placeholders in every supported locale", () => {
  const catalog = JSON.parse(readFileSync("app/web/static/locales.json", "utf8"));
  for (const key of ["playback.window", "playback.postroll", "playback.trackingTail"]) {
    const tokens = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
    for (const locale of ["sw-KE", "hi-IN"]) assert.deepEqual(tokens(catalog[locale][key]), tokens(catalog["en-GB"][key]));
  }
});
