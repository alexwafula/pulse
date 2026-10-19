// Which insight the Live panel shows when the corner and open-play patterns overlap (ADR 0031),
// against a running Go server (PULSE_URL) backed by the recorded Python service
// (PULSE_INSIGHT_SOURCE=python-recorded) or the template service.
// 1. corner, central and exchange keep main's corner cue: same text, evidence, window and status.
// 2. late-siege: nothing at 88:40, the corner Template at 88:44, the open-play insight from 88:46.
//    The panel shows the latest cue whose window has started, so the handoff happens once, forward.
// Set PULSE_EVIDENCE_DIR to save a screenshot per case.
import assert from "node:assert/strict";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.env.PULSE_URL ?? "http://127.0.0.1:8080";
const source = process.env.PULSE_INSIGHT_SOURCE ?? "python-template";
const shots = process.env.PULSE_EVIDENCE_DIR;
const executablePath = process.env.CHROME_PATH ?? (process.platform === "linux" ? "/usr/bin/chromium-browser" : "C:/Program Files/Google/Chrome/Application/chrome.exe");
const browser = await chromium.launch({ executablePath, headless: true, args: ["--use-angle=swiftshader-webgl", "--enable-unsafe-swiftshader"] });
const viewports = { desktop: { viewport: { width: 1440, height: 900 } }, mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } };
const recorded = source === "python-recorded";
const CORNER = "The corner produced 1 shot.";
const OPEN_PLAY = "1 completed pass came before the first shot in this open-play window.";
const failures = [];
const errors = [];
const check = (name, fn) => fn().then(() => console.log(`ok ${name}`), error => { failures.push(name); console.error(`FAIL ${name}: ${error.message}`); });
const api = async (route, scenario) => (await fetch(`${base}${route}?scenario=${scenario}&locale=en-GB&persona=CASUAL`)).json();
const seekValue = (replay, timeMs) => Math.round((timeMs - replay.match.startMs) / (replay.match.endMs - replay.match.startMs) * 1000);
const at = (minutes, seconds) => (minutes * 60 + seconds) * 1000;

async function open(page, scenario) {
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${base}/?scenario=${scenario}&view=svg`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelector(".pitch-shell")?.dataset.renderer === "svg", null, { timeout: 30000 });
  if (await page.locator("#play-button").getAttribute("aria-label") === "Pause") await page.locator("#play-button").evaluate(node => node.click());
}
async function shown(page, replay, timeMs) {
  await page.locator("#seek").evaluate((input, value) => { input.value = String(value); input.dispatchEvent(new Event("input", { bubbles: true })); }, seekValue(replay, timeMs));
  await page.waitForTimeout(150);
  return page.evaluate(() => ({ text: document.querySelector("#insight-text")?.textContent?.trim(), badge: document.querySelector("#insight-status")?.textContent?.trim() }));
}

// Main's corner cue for each authored scenario: only `corner` has a recording.
const mainCorner = {
  corner: { status: recorded ? "VERIFIED" : "FALLBACK_TEMPLATE", badge: recorded ? "Verified (recorded)" : "Template" },
  central: { status: "FALLBACK_TEMPLATE", badge: "Template" },
  exchange: { status: "FALLBACK_TEMPLATE", badge: "Template" },
};

await check("corner, central and exchange keep main's corner cue and badge at the corner end", async () => {
  for (const [scenario, expected] of Object.entries(mainCorner)) {
    const feed = await api("/api/insights", scenario);
    const cues = Array.isArray(feed) ? feed : feed.cues;
    const corner = cues.filter(cue => cue.eventIds.includes("evt-06"));
    assert.equal(corner.length, 1, `${scenario}: one corner cue`);
    assert.deepEqual({ text: corner[0].text, eventIds: corner[0].eventIds, startMs: corner[0].startMs, endMs: corner[0].endMs, replay: [corner[0].replayStartMs, corner[0].replayEndMs], status: corner[0].verification.status },
      { text: CORNER, eventIds: ["evt-06", "evt-07"], startMs: 1678000, endMs: 1680000, replay: [1672000, 1678000], status: expected.status }, scenario);
    // central's open-play cue (27:36 to the end) starts before the corner cue, so the corner, as the
    // latest started, is shown from 27:58; no cue starts inside the corner cue's window.
    assert.ok(cues.every(cue => cue === corner[0] || cue.startMs < corner[0].startMs || cue.startMs > corner[0].endMs), `${scenario}: no cue starts inside the corner cue`);
    assert.equal(cues.indexOf(corner[0]), cues.length - 1, `${scenario}: the corner cue is last in the feed`);
    const replay = await api("/api/replay", scenario);
    for (const vpName of ["desktop", "mobile"]) {
      const context = await browser.newContext(viewports[vpName]);
      const page = await context.newPage();
      await open(page, scenario);
      assert.deepEqual(await shown(page, replay, replay.match.endMs), { text: CORNER, badge: expected.badge }, `${scenario} ${vpName} end`);
      if (shots) await page.screenshot({ path: path.join(shots, `${scenario}-end-${vpName}.png`) });
      await context.close();
    }
  }
});

await check("late-siege shows nothing at 88:40, the corner at 88:44 and the open-play insight at 88:46 and the end", async () => {
  const replay = await api("/api/replay", "late-siege");
  const cases = [
    ["88-40", at(88, 40), { text: "Awaiting next moment", badge: "Waiting" }],
    ["88-44", at(88, 44), { text: CORNER, badge: "Template" }],
    ["88-46", at(88, 46), { text: OPEN_PLAY, badge: recorded ? "Verified (recorded)" : "Template" }],
    ["end", replay.match.endMs, { text: OPEN_PLAY, badge: recorded ? "Verified (recorded)" : "Template" }],
  ];
  for (const vpName of ["desktop", "mobile"]) {
    const context = await browser.newContext(viewports[vpName]);
    const page = await context.newPage();
    await open(page, "late-siege");
    for (const [label, timeMs, expected] of cases) {
      assert.deepEqual(await shown(page, replay, timeMs), expected, `${vpName} ${label}`);
      if (shots) await page.screenshot({ path: path.join(shots, `late-siege-${label}-${vpName}.png`) });
    }
    // Scrubbing back restores the corner: the choice depends only on the clock.
    assert.deepEqual(await shown(page, replay, at(88, 44)), cases[1][2], `${vpName} back to 88:44`);
    await context.close();
  }
});

await browser.close();
assert.deepEqual(errors, [], "page errors");
if (failures.length) { console.error(`${failures.length} failed`); process.exit(1); }
console.log("insight selection checks passed");
