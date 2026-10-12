import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright-core";

const require = createRequire(import.meta.url);
const { PNG } = require(path.join(path.dirname(require.resolve("playwright-core/package.json")), "lib/utilsBundle.js"));
const base = process.env.PULSE_URL ?? "http://127.0.0.1:8080";
const executablePath = process.env.CHROME_PATH ?? (process.platform === "linux" ? "/usr/bin/chromium-browser" : "C:/Program Files/Google/Chrome/Application/chrome.exe");
const output = process.env.PULSE_SCREENSHOTS ?? path.join(os.tmpdir(), "pulse-experience-preview");
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });
const errors = [];
const seek = async (page, value) => page.locator("#seek").evaluate((input, value) => { input.value = String(value); input.dispatchEvent(new Event("input", { bubbles: true })); }, value);
const pause = async page => { if (await page.locator("#play-button").getAttribute("aria-label") === "Pause") await page.locator("#play-button").click(); };
const section = async (page, name) => page.locator(`.experience-navigation [data-section="${name}"]`).click();
const panelAt = async (page, at) => page.waitForFunction(at => document.querySelector(".story-content")?.getAttribute("data-time-ms") === String(at) && document.querySelector(".story-content")?.getAttribute("data-panel") === document.querySelector('#experience-inputs [name="panel"]')?.value, at);
const clock = ms => `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

async function pixels(canvas, label) {
  const buffer = await canvas.screenshot();
  const decoded = PNG.sync.read(buffer);
  const colors = new Set();
  let green = 0;
  for (let index = 0; index < decoded.data.length; index += 64) {
    const [r, g, b] = decoded.data.subarray(index, index + 3);
    colors.add(`${r},${g},${b}`);
    if (g > r * 1.15 && g > b * 1.1) green++;
  }
  assert.ok(colors.size > 15 && green > 100, `${label} must render the pitch, not a blank canvas`);
  return buffer;
}

try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    const remote = [];
    await page.route("**/*", route => {
      const address = new URL(route.request().url());
      if (["data:", "blob:"].includes(address.protocol) || address.origin === new URL(base).origin) return route.continue();
      remote.push(address.href); return route.abort();
    });
    const replay = await (await page.request.get(`${base}/api/replay?scenario=late-siege`)).json();
    for (const mode of ["three", "pixi", "svg"]) {
      await page.goto(`${base}/experience?scenario=late-siege&view=${mode}`, { waitUntil: "networkidle" });
      await page.waitForFunction(mode => document.querySelector(".pitch-shell")?.dataset.renderer === mode, mode);
      await pause(page);
      await seek(page, 0);
      assert.equal(await page.locator("#player-layer g").count(), 22);
      assert.deepEqual(await page.locator(".team-name-text").allTextContents(), replay.match.teams.map(team => team.name));
      assert.ok(await page.getByLabel("Score unavailable", { exact: true }).isVisible());
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "page must fit the viewport");
      assert.equal(await page.evaluate(() => innerWidth), mobile ? 390 : 1440);
      if (mode !== "svg") {
        await page.locator("#canvas-host canvas").evaluate(canvas => { canvas.dataset.identity = "persistent"; });
        const before = await pixels(page.locator("#canvas-host canvas"), `${mobile}-${mode}`);
        await seek(page, 450);
        await page.waitForTimeout(200);
        const after = await pixels(page.locator("#canvas-host canvas"), `${mobile}-${mode} moved`);
        assert.notDeepEqual(after, before, "replay positions must change canvas pixels");
        if (mode === "three") {
          const captures = [];
          for (const camera of ["broadcast", "tactical", "follow"]) {
            await page.locator("#camera-mode").selectOption(camera);
            await page.waitForTimeout(300);
            captures.push(await pixels(page.locator("#canvas-host canvas"), `${mobile}-${camera}`));
            await page.evaluate(() => scrollTo(0, 0));
            await page.screenshot({ path: path.join(output, `${mobile ? "mobile" : "desktop"}-${camera}.png`), fullPage: true });
          }
          assert.notDeepEqual(captures[0], captures[1], "camera presets must change framing");
          assert.notDeepEqual(captures[1], captures[2]);
          await page.locator("#camera-mode").selectOption("broadcast");
        }
      }
      await section(page, "story");
      for (const value of [0, 450, 1000, 0]) {
        await seek(page, value);
        const at = Math.floor(replay.match.startMs + value / 1000 * (replay.match.endMs - replay.match.startMs));
        await panelAt(page, at);
        const events = replay.events.filter(event => event.timeMs <= at);
        assert.deepEqual(await page.locator("[data-story-event]").evaluateAll(items => items.map(item => item.dataset.storyEvent)), events.slice(-5).map(event => event.id));
        assert.equal(await page.locator(".story-summary dd").first().textContent(), String(events.length));
      }
      if (mode !== "svg") assert.equal(await page.locator("#canvas-host canvas").getAttribute("data-identity"), "persistent", "HTMX must not replace the pitch");
      await seek(page, 450);
      await panelAt(page, Math.floor(replay.match.startMs + .45 * (replay.match.endMs - replay.match.startMs)));
      const id = await page.locator("[data-inspect-event]").first().getAttribute("data-inspect-event");
      await page.locator("[data-inspect-event]").first().click();
      assert.equal(await page.locator("#match-clock").textContent(), clock(replay.events.find(event => event.id === id).timeMs));
      assert.equal(await page.locator("#play-button").getAttribute("aria-label"), "Play");
      await section(page, "insights");
      assert.ok(await page.locator("#pane-control").isVisible());
      await page.getByRole("tab", { name: "Passing", exact: true }).click();
      assert.ok(await page.locator("#pane-passing").isVisible());
      await seek(page, 0);
      await section(page, "recap");
      await panelAt(page, replay.match.startMs);
      assert.match(await page.locator(".story-content").textContent(), /available at the end/);
      await seek(page, 1000);
      await panelAt(page, replay.match.endMs);
      assert.ok(await page.locator("[data-download-recap]").isVisible());
      const downloading = page.waitForEvent("download");
      await page.locator("[data-download-recap]").click();
      assert.equal((await downloading).suggestedFilename(), "pulse-sequence-recap.txt");
      await page.screenshot({ path: path.join(output, `${mobile ? "mobile" : "desktop"}-${mode}-recap.png`), fullPage: true });
    }
    // HTMX failures retain the last HTML, offer retry and leave playback working.
    await section(page, "story");
    await panelAt(page, replay.match.endMs);
    const retained = await page.locator(".story-content").innerHTML();
    await page.route("**/experience/panel?**", route => route.fulfill({ status: 503, body: "Unavailable" }));
    await seek(page, 0);
    await page.waitForFunction(() => document.querySelector("#panel-retry")?.hidden === false);
    assert.equal(await page.locator(".story-content").innerHTML(), retained);
    await page.unroute("**/experience/panel?**");
    await page.locator("#panel-retry").click();
    await panelAt(page, replay.match.startMs);
    await page.locator("#play-button").click();
    await page.waitForFunction(start => document.querySelector(".story-content")?.getAttribute("data-time-ms") !== String(start), replay.match.startMs);
    await pause(page);
    assert.deepEqual(remote, [], "preview must use only local assets and APIs");
    await context.close();
  }
  const cuePage = await browser.newPage();
  cuePage.on("pageerror", error => errors.push(error.message));
  await cuePage.goto(`${base}/experience?scenario=corner&view=svg`, { waitUntil: "networkidle" });
  await pause(cuePage); await seek(cuePage, 1000);
  await cuePage.waitForFunction(() => document.querySelector("#insight-status")?.textContent === "Template");
  await cuePage.locator("#evidence-button").click();
  assert.ok(await cuePage.locator("#evidence-return").isVisible());
  await cuePage.locator("#evidence-return").click();
  const analyst = await (await cuePage.request.get(`${base}/api/insights?scenario=corner&persona=ANALYST`)).json();
  await cuePage.getByRole("button", { name: "Analyst", exact: true }).click();
  await cuePage.waitForFunction(text => document.querySelector("#insight-text")?.textContent === text, analyst.cues[0].text);
  assert.deepEqual(errors, []);
  console.log(`Experience browser checks passed: desktop/mobile, all renderers, cameras, HTMX, evidence, replay-clock panels and failure recovery. Screenshots: ${output}`);
} finally { await browser.close(); }
