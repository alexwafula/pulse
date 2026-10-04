import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";

const url = process.env.PULSE_URL ?? "http://127.0.0.1:8080";
const executablePath = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = await chromium.launch({ executablePath, headless: true });

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await desktop.goto(url, { waitUntil: "networkidle" });
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
  await desktop.screenshot({ path: path.join(os.tmpdir(), "pulse-pitch-desktop.png"), fullPage: true });

  await desktop.locator("#seek").evaluate((input) => {
    input.value = "1000";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  assert.equal(await desktop.locator("#match-clock").textContent(), "28:00");
  assert.match(await desktop.locator("#detail-title").textContent(), /Shot/);
  await desktop.getByRole("button", { name: "Restart" }).click();
  assert.match(await desktop.locator("#match-clock").textContent(), /27:0[0-1]/);

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

  console.log("Browser pitch checked: movement, controls, desktop and mobile layout.");
} finally {
  await browser.close();
}
