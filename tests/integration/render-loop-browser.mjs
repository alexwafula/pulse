import assert from "node:assert/strict";
import { chromium } from "playwright-core";

// Counts animation frames in which a WebGL renderer issued draw calls. Hooking the
// context keeps the measurement independent of the app's own render loop.
const base = process.env.PULSE_URL ?? "http://127.0.0.1:8080";
const executablePath = process.env.CHROME_PATH ?? (process.platform === "linux" ? "/usr/bin/chromium-browser" : "C:/Program Files/Google/Chrome/Application/chrome.exe");
const browser = await chromium.launch({ executablePath, headless: true });
const errors = [];
const results = [];

function countDrawFrames() {
  window.__drawFrames = 0;
  let drew = false;
  for (const context of [WebGLRenderingContext, WebGL2RenderingContext]) {
    for (const name of ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced"]) {
      const original = context.prototype[name];
      if (original) context.prototype[name] = function (...args) { drew = true; return original.apply(this, args); };
    }
  }
  const tick = () => { if (drew) window.__drawFrames++; drew = false; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}
const frames = page => page.evaluate(() => window.__drawFrames);
const clockMs = async page => {
  const [minutes, seconds] = (await page.locator("#match-clock").textContent()).split(":").map(Number);
  return (minutes * 60 + seconds) * 1000;
};
const settle = page => page.waitForTimeout(1000);
async function framesOver(page, ms) {
  const start = await frames(page);
  await page.waitForTimeout(ms);
  return await frames(page) - start;
}

try {
  for (const view of ["three", "pixi"]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    await context.addInitScript(countDrawFrames);
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${base}/experience?scenario=late-siege&view=${view}`, { waitUntil: "networkidle" });
    await page.waitForFunction(view => document.querySelector(".pitch-shell")?.dataset.renderer === view, view);
    if (await page.locator("#play-button").getAttribute("aria-label") === "Pause") await page.locator("#play-button").click();
    await settle(page);
    const paused = await framesOver(page, 3000);

    await page.locator('[data-speed="4"]').click();
    const before = await clockMs(page);
    await page.locator("#play-button").click();
    const playing = await framesOver(page, 1500);
    const advanced = await clockMs(page) - before;
    await page.locator("#play-button").click();

    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.locator("#play-button").click();
    const hidden = await framesOver(page, 1500);
    await page.evaluate(() => {
      delete document.hidden; delete document.visibilityState;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const resumed = await framesOver(page, 1000);
    await page.locator("#play-button").click();

    results.push({ view, paused, playing, advanced, hidden, resumed });
    console.log(`${view}: paused 3 s = ${paused} draw frames; playing 4x 1.5 s = ${playing} frames, seek +${advanced}; hidden 1.5 s = ${hidden}; visible again 1 s = ${resumed}`);
    await context.close();
  }
  for (const { view, paused, playing, advanced, hidden, resumed } of results) {
    assert.ok(paused <= 2, `${view}: a paused pitch must not redraw every frame (${paused} draws in 3 s)`);
    // Software GL can take ~0.4 s per stadium frame, so require drawing, not a frame rate.
    assert.ok(playing >= 1 && advanced > 0, `${view}: playback at 4x must keep drawing and advance the clock`);
    assert.equal(hidden, 0, `${view}: a hidden tab must not draw`);
    assert.ok(resumed > 0, `${view}: playback must resume drawing when the tab is visible again`);
  }
  assert.deepEqual(errors, []);
  console.log("Render loop browser checks passed: paused, playing and hidden tabs for three and pixi.");
} finally {
  await browser.close();
}
