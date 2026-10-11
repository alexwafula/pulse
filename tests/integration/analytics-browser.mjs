import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";

const url = process.env.PULSE_URL ?? "http://127.0.0.1:8080";
const defaultChrome = process.platform === "linux" ? "/usr/bin/chromium-browser" : "C:/Program Files/Google/Chrome/Application/chrome.exe";
const executablePath = process.env.CHROME_PATH ?? defaultChrome;
const browser = await chromium.launch({ executablePath, headless: true });
const matchTime = ms => `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
const seek = (page, value) => page.locator("#seek").evaluate((input, value) => { input.value = String(value); input.dispatchEvent(new Event("input", { bubbles: true })); }, value);
const pause = async page => {
  if (await page.locator("#play-button").getAttribute("aria-label") === "Pause") await page.locator("#play-button").click();
};
const data = async (page, endpoint, scenario) => (await page.request.get(`${url}${endpoint}${endpoint.includes("?") ? "&" : "?"}scenario=${scenario}`)).json();
const errors = [];
const newPage = async viewport => {
  const page = await browser.newPage({ viewport });
  page.on("pageerror", error => errors.push(error.message));
  return page;
};

function summaryAt(replay, clock) {
  const events = replay.events.filter(event => event.timeMs <= clock);
  const passes = events.filter(event => event.type === "PASS");
  return { actions: events.length, attempts: passes.length, passes: passes.filter(event => event.outcome === "COMPLETE") };
}

try {
  for (const scenario of ["corner", "central", "exchange", "late-siege", "calm-midfield"]) {
    const page = await newPage({ width: 1440, height: 900 });
    await page.goto(`${url}/?scenario=${scenario}&view=svg`, { waitUntil: "networkidle" });
    await pause(page);
    const replay = await data(page, "/api/replay", scenario);
    assert.deepEqual(await page.locator(".team-name-text").allTextContents(), replay.match.teams.map(team => team.name));
    for (let i = 0; i < 2; i++) {
      const team = replay.match.teams[i];
      assert.equal((await page.locator(".team-sub").nth(i).textContent()).trim(), `${team.name} • Attacking ${team.attackingDirection}`);
      assert.equal(await page.locator(".crest-svg text").nth(i).textContent(), team.name[0]);
    }
    assert.equal(await page.getByLabel("Score unavailable", { exact: true }).count(), 1);
    assert.equal(await page.locator("#start-label").textContent(), matchTime(replay.match.startMs));
    assert.equal(await page.locator("#end-label").textContent(), matchTime(replay.match.endMs));
    for (const value of [0, 450, 1000, 0]) {
      await seek(page, value);
      const clock = replay.match.startMs + value / 1000 * (replay.match.endMs - replay.match.startMs);
      const summary = summaryAt(replay, clock);
      assert.equal(await page.locator("#summary-actions").textContent(), `${summary.actions} of ${replay.events.length}`);
      assert.equal(await page.locator("#summary-passes").textContent(), `${summary.passes.length} of ${summary.attempts}`);
      for (const [index, side] of [[0, "home"], [1, "away"]]) {
        const count = summary.passes.filter(event => event.teamId === replay.match.teams[index].id).length;
        assert.equal(await page.locator(`#${side}-pass-share`).textContent(), `${count} completed ${count === 1 ? "pass" : "passes"}`);
      }
    }
    if (["corner", "central", "exchange"].includes(scenario)) {
      assert.ok(await page.locator("#control-toggle").isDisabled());
      assert.equal(await page.locator("#metrics-label").textContent(), "Tracking metrics unavailable");
      assert.equal(await page.locator("#metric-entropy").textContent(), "N/A");
    }
    await page.close();
  }

  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    for (const mode of ["svg", "three", "pixi"]) {
      const page = await newPage(viewport);
      await page.goto(`${url}/?scenario=late-siege&view=${mode}`, { waitUntil: "networkidle" });
      await page.waitForFunction(view => document.querySelector(".pitch-shell")?.getAttribute("data-renderer") === view, mode);
      await pause(page);
      const replay = await data(page, "/api/replay", "late-siege");
      const metrics = await data(page, "/api/metrics?grid=1", "late-siege");
      const feed = await data(page, "/api/moments", "late-siege");
      assert.equal(await page.locator("#player-layer g").count(), 22);
      assert.ok(await page.locator("#control-toggle").isChecked());
      await page.getByRole("tab", { name: "Control", exact: true }).click();
      for (const value of [0, 450, 1000, 0, 450]) {
        await seek(page, value);
        const clock = replay.match.startMs + value / 1000 * (replay.match.endMs - replay.match.startMs);
        const tick = metrics.ticks.filter(item => item.timeMs <= clock).at(-1);
        assert.equal(await page.locator("#metrics-clock").getAttribute("data-time-ms"), String(tick.timeMs));
        assert.equal(await page.locator("#metric-entropy").textContent(), tick.entropy.toFixed(4));
        assert.equal(await page.locator("#metric-pressing").textContent(), tick.pressing === null ? "N/A" : tick.pressing.toFixed(4));
        for (const [index, side] of [[0, "home"], [1, "away"]]) assert.equal(await page.locator(`#metric-${side}-third`).textContent(), tick.teams[replay.match.teams[index].id].finalThird.toFixed(4));
        assert.equal(await page.locator("#moment-count").textContent(), String(feed.moments.filter(moment => moment.timeMs <= clock).length));
        assert.equal(await page.locator("#pane-control").isVisible(), true, "seeking must preserve the selected tab");
      }
      assert.equal(await page.locator("#control-layer rect").count(), metrics.gridLayout.cols * metrics.gridLayout.rows);
      const firstY = Number(await page.locator("#control-layer rect").first().getAttribute("y"));
      assert.ok(Math.abs(firstY - (20 + (1 - 1 / metrics.gridLayout.rows) * 640)) < 1e-6, "control grid must use bottom-left coordinates");
      if (mode !== "svg") {
        const canvas = page.locator("#canvas-host canvas");
        const withControl = await canvas.evaluate(canvas => canvas.toDataURL());
        await page.locator("#control-toggle").uncheck();
        await page.waitForTimeout(150);
        assert.notEqual(await canvas.evaluate(canvas => canvas.toDataURL()), withControl, `${mode} control overlay must change actual pixels`);
        await page.locator("#control-toggle").check();
        await page.waitForTimeout(150);
      } else {
        await page.locator("#control-toggle").uncheck();
        assert.equal(await page.locator("#control-layer").isVisible(), false);
        await page.locator("#control-toggle").check();
        assert.equal(await page.locator("#control-layer").isVisible(), true);
      }
      await seek(page, 1000);
      const swing = feed.moments.find(moment => moment.type === "CONTROL_SWING");
      await page.locator(`[data-moment-type="CONTROL_SWING"][data-moment-time="${swing.timeMs}"]`).click();
      assert.equal(await page.locator("#evidence-kind").textContent(), "Metric ticks");
      assert.equal(await page.locator("[data-source-event]").count(), 0, "context events must never be cited as tick evidence");
      assert.deepEqual(await page.locator("[data-source-tick]").evaluateAll(nodes => nodes.map(node => Number(node.dataset.sourceTick))), swing.tickTimesMs);
      assert.equal(await page.locator('[data-speed="4"]').isDisabled(), true);
      await page.waitForFunction(() => document.querySelector("#play-button")?.getAttribute("aria-label") === "Replay evidence", null, { timeout: 10000 });
      assert.equal(await page.locator("#match-clock").textContent(), matchTime(swing.windowEndMs));
      const size = viewport.width > 800 ? "desktop" : "mobile";
      await page.screenshot({ path: path.join(os.tmpdir(), `pulse-analytics-${mode}-${size}.png`), fullPage: true });
      await page.getByRole("button", { name: "Return to match", exact: true }).click();
      assert.equal(await page.locator("#match-clock").textContent(), matchTime(replay.match.endMs));
      await page.getByRole("tab", { name: "Control", exact: true }).click();
      const setPiece = feed.moments.find(moment => moment.type === "SET_PIECE_SHOT");
      await page.locator('[data-moment-type="SET_PIECE_SHOT"]').click();
      assert.equal(await page.locator("#evidence-kind").textContent(), "Source events");
      assert.deepEqual(await page.locator("[data-source-event]").evaluateAll(nodes => nodes.map(node => node.dataset.sourceEvent)), setPiece.reasons);
      assert.equal(await page.locator("[data-source-tick]").count(), 0);
      assert.equal((await page.locator("#evidence-list").textContent()).includes("blocked by"), false);
      await page.waitForFunction(() => document.querySelector("#play-button")?.getAttribute("aria-label") === "Replay evidence", null, { timeout: 10000 });
      await page.getByRole("button", { name: "Return to match", exact: true }).click();
      await page.getByRole("tab", { name: "Control", exact: true }).click();
      await page.getByRole("tab", { name: "Control", exact: true }).press("ArrowRight");
      assert.equal(await page.getByRole("tab", { name: "Routes", exact: true }).getAttribute("aria-selected"), "true");
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no horizontal page overflow");
      await page.close();
    }
  }

  for (const failure of ["http", "grid", "cross-match"]) {
    const page = await newPage({ width: 390, height: 844 });
    await page.route("**/api/metrics?*", async route => {
      if (failure === "http") return route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
      const response = await route.fetch();
      const body = await response.json();
      if (failure === "grid") body.ticks[0].grid = [];
      else body.matchId = "another-match";
      await route.fulfill({ response, json: body });
    });
    await page.goto(`${url}/?scenario=late-siege&view=svg`, { waitUntil: "networkidle" });
    assert.equal(await page.locator("#metrics-label").textContent(), "Metrics unavailable");
    assert.ok(await page.locator("#control-toggle").isDisabled());
    await pause(page); await seek(page, 1000);
    assert.equal(await page.locator("#summary-actions").textContent(), "27 of 27");
    assert.equal(await page.locator("#player-layer g").count(), 22);
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log("Replay statistics/team labels, unsupported/error states, clock-synced metrics, all three control overlays, event/tick evidence clips, rewind, keyboard tabs and desktop/mobile layout checked.");
} finally {
  await browser.close();
}
