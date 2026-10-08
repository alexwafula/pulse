import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";

const url = process.env.PULSE_URL ?? "http://127.0.0.1:8080";
const executablePath = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = await chromium.launch({ executablePath, headless: true });

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];
  desktop.on("pageerror", (error) => pageErrors.push(error.message));
  await desktop.goto(url, { waitUntil: "networkidle" });
  const replay = await (await desktop.request.get(`${url}/api/replay`)).json();
  assert.equal(replay.schemaVersion, "2.0.0");
  assert.equal(replay.events[0].type, "PASS");
  assert.equal(replay.match.pitch.widthM, 68);
  assert.equal(await desktop.locator("#event-list button").count(), 7);
  assert.equal(await desktop.locator("#player-layer g").count(), 8);

  const ballBefore = await desktop.locator("#ball").getAttribute("cx");
  await desktop.waitForTimeout(650);
  const ballAfter = await desktop.locator("#ball").getAttribute("cx");
  assert.notEqual(ballAfter, ballBefore, "ball should move during playback");

  await desktop.getByRole("button", { name: "Pause" }).click();
  const pausedClock = await desktop.locator("#match-clock").textContent();
  await desktop.waitForTimeout(450);
  assert.equal(await desktop.locator("#match-clock").textContent(), pausedClock);

  await desktop.locator("#seek").evaluate((input) => {
    input.value = "450";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  assert.equal(await desktop.locator("#match-clock").textContent(), "27:27");
  const pass = replay.events.find((event) => event.timeMs === 1647000);
  const expectedY = 20 + (1 - pass.from.y / 68) * 640;
  const renderedY = Number(await desktop.locator("#event-path").getAttribute("y1"));
  assert.ok(Math.abs(renderedY - expectedY) < 0.01, "bottom-left coordinates must be inverted for SVG");
  await desktop.screenshot({ path: path.join(os.tmpdir(), "pulse-pitch-desktop.png"), fullPage: true });

  await desktop.locator("#seek").evaluate((input) => {
    input.value = "1000";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  assert.equal(await desktop.locator("#match-clock").textContent(), "28:00");
  assert.match(await desktop.locator("#detail-title").textContent(), /Shot/);
  assert.equal(await desktop.locator("#action-result").isVisible(), true);
  assert.equal(await desktop.locator("#result-title").textContent(), "Shot blocked");
  await desktop.waitForFunction(() => document.querySelector("#insight-text")?.textContent === "The corner produced 1 shot.");
  assert.equal(await desktop.locator("#insight-status").textContent(), "Template");
  await desktop.screenshot({ path: path.join(os.tmpdir(), "pulse-insight-desktop.png"), fullPage: true });
  await desktop.getByRole("button", { name: "Evidence", exact: true }).click();
  assert.match(await desktop.locator("#match-clock").textContent(), /27:5[2-3]/);
  assert.equal(await desktop.locator(".event-list .evidence-event").count(), 2);
  assert.equal(await desktop.locator('[data-speed="1"]').getAttribute("aria-pressed"), "true");
  assert.equal(await desktop.locator('[data-speed="4"]').isDisabled(), true);
  await desktop.waitForFunction(() => document.querySelector("#match-clock")?.textContent === "27:58", null, { timeout: 10000 });
  assert.equal(await desktop.getByRole("button", { name: "Replay evidence", exact: true }).count(), 1);
  await desktop.getByRole("button", { name: "Return to match", exact: true }).click();
  assert.equal(await desktop.locator("#match-clock").textContent(), "28:00");
  assert.equal(await desktop.locator(".event-list .evidence-event").count(), 0);
  assert.equal(await desktop.locator('[data-speed="4"]').isDisabled(), false);
  await desktop.getByRole("button", { name: "Restart" }).click();
  assert.match(await desktop.locator("#match-clock").textContent(), /27:0[0-1]/);
  assert.equal(await desktop.locator("#insight-text").textContent(), "Awaiting next moment");
  assert.equal(await desktop.locator("#action-result").isVisible(), false);

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await mobile.goto(url, { waitUntil: "networkidle" });
  await mobile.getByRole("button", { name: "Pause" }).click();
  await mobile.locator("#seek").evaluate((input) => {
    input.value = "450";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  assert.equal(await mobile.locator("#event-list button").count(), 7);
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "mobile has horizontal overflow");
  await mobile.screenshot({ path: path.join(os.tmpdir(), "pulse-pitch-mobile.png"), fullPage: true });
  await mobile.locator("#seek").evaluate((input) => { input.value = "1000"; input.dispatchEvent(new Event("input", { bubbles: true })); });
  await mobile.waitForFunction(() => document.querySelector("#insight-text")?.textContent === "The corner produced 1 shot.");
  await mobile.screenshot({ path: path.join(os.tmpdir(), "pulse-insight-mobile.png"), fullPage: true });
  assert.deepEqual(pageErrors, [], "desktop must have no runtime errors");

  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    for (const mode of ["three", "pixi"]) {
      const page = await browser.newPage({ viewport });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${url}/?view=${mode}`, { waitUntil: "networkidle" });
      await page.waitForFunction((view) => document.querySelector(".pitch-shell")?.getAttribute("data-renderer") === view, mode);
      const canvas = page.locator("#canvas-host canvas");
      assert.equal(await canvas.count(), 1);
      const before = await canvas.evaluate((element) => element.toDataURL());
      await page.waitForTimeout(650);
      assert.notEqual(await canvas.evaluate((element) => element.toDataURL()), before, `${mode} canvas must animate`);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await page.locator("#seek").evaluate((input) => { input.value = "450"; input.dispatchEvent(new Event("input", { bubbles: true })); });
      await page.waitForTimeout(200);
      const pixels = await canvas.evaluate((element) => {
        const gl = element.getContext("webgl2") ?? element.getContext("webgl");
        if (!gl) throw new Error("No WebGL context");
        const data = new Uint8Array(element.width * element.height * 4);
        gl.readPixels(0, 0, element.width, element.height, gl.RGBA, gl.UNSIGNED_BYTE, data);
        let grass = 0, home = 0, away = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          if (g > 60 && g > r * 1.15 && g > b * 1.15) grass++;
          if (r > 170 && r > g * 1.2 && r > b * 1.2) home++;
          if (g > 130 && b > 140 && b > r * 1.15) away++;
        }
        return { grass, home, away, total: element.width * element.height };
      });
      assert.ok(pixels.grass > pixels.total * .15, `${mode} must show a nonblank pitch`);
      assert.ok(pixels.home > 15 && pixels.away > 15, `${mode} must show both teams`);
      if (mode === "three") {
        const bounds = await canvas.boundingBox();
        const prior = await canvas.evaluate((element) => element.toDataURL());
        await page.mouse.move(bounds.x + bounds.width * .5, bounds.y + bounds.height * .5);
        await page.mouse.down();
        await page.mouse.move(bounds.x + bounds.width * .6, bounds.y + bounds.height * .55, { steps: 8 });
        await page.mouse.up();
        await page.waitForTimeout(250);
        assert.notEqual(await canvas.evaluate((element) => element.toDataURL()), prior, "camera drag must change the view");
        await page.getByRole("button", { name: "Reset camera" }).click();
        await page.waitForTimeout(200);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const size = viewport.width > 800 ? "desktop" : "mobile";
      await page.screenshot({ path: path.join(os.tmpdir(), `pulse-${mode}-${size}.png`), fullPage: true });
      await page.getByRole("button", { name: "SVG", exact: true }).click();
      await page.waitForFunction(() => document.querySelector(".pitch-shell")?.getAttribute("data-renderer") === "svg");
      assert.equal(await canvas.count(), 0, "switching views must release the canvas");
      assert.deepEqual(errors, []);
      await page.close();
    }
  }

  const fallback = await browser.newPage();
  await fallback.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      if (kind === "webgl" || kind === "webgl2" || kind === "experimental-webgl") return null;
      return original.call(this, kind, ...args);
    };
  });
  await fallback.goto(`${url}/?view=three`, { waitUntil: "networkidle" });
  await fallback.waitForFunction(() => document.querySelector(".pitch-shell")?.getAttribute("data-renderer") === "svg");
  assert.equal(await fallback.locator("#pitch").isVisible(), true);
  assert.match(await fallback.locator("#renderer-status").textContent(), /SVG view is active/);
  await fallback.getByRole("button", { name: "Pause", exact: true }).click();
  await fallback.close();

  console.log("Insight timing, evidence replay/return/restart, SVG, Three.js, PixiJS, canvas pixels, camera controls, WebGL fallback and desktop/mobile layout checked.");
} finally {
  await browser.close();
}
