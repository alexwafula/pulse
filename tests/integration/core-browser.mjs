import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const url = process.env.PULSE_URL ?? "http://127.0.0.1:8083";
const defaultChrome = process.platform === "linux" ? "/usr/bin/chromium-browser" : "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? defaultChrome, headless: true });
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    for (const failure of ["http", "schema"]) {
      const recovery = await browser.newPage({ viewport });
      const errors = [];
      recovery.on("pageerror", error => errors.push(error.message));
      let attempts = 0;
      await recovery.route("**/api/replay?*", async route => {
        attempts++;
        if (attempts > 2) return route.continue();
        await route.fulfill({
          status: failure === "http" ? 503 : 200,
          contentType: "application/json",
          body: JSON.stringify({ schemaVersion: "unsupported", tracking: [] }),
        });
      });
      await recovery.goto(`${url}/legacy?view=svg`, { waitUntil: "networkidle" });
      for (const expectedAttempts of [1, 2]) {
        await recovery.locator("#pitch-error").waitFor({ state: "visible" });
        assert.equal(attempts, expectedAttempts);
        assert.equal(await recovery.locator("#play-button").isDisabled(), true);
        assert.equal(await recovery.locator("#restart-button").isDisabled(), true);
        assert.equal(await recovery.locator("#seek").isDisabled(), true);
        const reloaded = recovery.waitForEvent("load");
        await recovery.locator("#pitch-retry").click();
        await reloaded;
        await recovery.waitForFunction(() => document.querySelector("#pitch-error")?.hidden === false
          || document.querySelector("#play-button")?.title === "Pause");
      }
      await recovery.waitForFunction(() => document.querySelector("#play-button")?.title === "Pause");
      assert.equal(attempts, 3);
      assert.equal(await recovery.locator("#pitch-error").isVisible(), false);
      assert.equal(await recovery.locator("#pitch-loading").isVisible(), false);
      assert.equal(await recovery.locator("#play-button").isDisabled(), false);
      assert.equal(await recovery.locator("#restart-button").isDisabled(), false);
      assert.equal(await recovery.locator("#seek").isDisabled(), false);
      assert.equal(await recovery.locator("#event-list button").count(), 7);
      assert.equal(await recovery.locator("#player-layer g").count(), 8);
      await recovery.getByRole("button", { name: "Pause", exact: true }).click();
      const paused = await recovery.locator("#match-clock").textContent();
      await recovery.waitForTimeout(200);
      assert.equal(await recovery.locator("#match-clock").textContent(), paused);
      await recovery.getByRole("button", { name: "Play", exact: true }).click();
      await recovery.waitForFunction(previous => document.querySelector("#match-clock")?.textContent !== previous, paused);
      assert.deepEqual(errors, []);
      await recovery.close();
    }
    const page = await browser.newPage({ viewport, acceptDownloads: true });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${url}/legacy?scenario=central`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    const seek = async value => page.locator("#seek").evaluate((input, value) => { input.value = value; input.dispatchEvent(new Event("input", { bubbles: true })); }, value);
    await seek("667");
    assert.equal(await page.locator('.attack-snapshot:not([hidden]) .attack-stats dd').nth(0).textContent(), "1");
    assert.equal(await page.locator('.attack-snapshot:not([hidden]) .attack-stats dd').nth(1).textContent(), "1");
    assert.equal(await page.locator('.attack-snapshot:not([hidden]) .attack-stats dd').nth(2).textContent(), "1 of 1");
    assert.equal(await page.locator("#recap-panel").isVisible(), false);
    await seek("0");
    assert.equal(await page.locator('.attack-snapshot:not([hidden]) .attack-stats dd').nth(0).textContent(), "0");
    assert.equal(await page.locator('.attack-snapshot:not([hidden]) .attack-stats dd').nth(1).textContent(), "0");
    await seek("1000");
    assert.equal(await page.locator("#recap-panel").isVisible(), true);
    assert.match(await page.locator("#recap-panel").textContent(), /2 shot attempt/);
    await page.getByRole("button", { name: "Analyst", exact: true }).click();
    await page.waitForFunction(() => document.querySelector("#insight-text")?.textContent === "Set-piece sequence: 1 shot following the corner.");
    await page.getByRole("button", { name: "Casual", exact: true }).click();
    await page.waitForFunction(() => document.querySelector("#insight-text")?.textContent === "The corner produced 1 shot.");
    const download = page.waitForEvent("download");
    await page.locator("#download-recap").click();
    assert.equal((await download).suggestedFilename(), "pulse-sequence-recap.txt");
    await page.locator('[data-recap-evidence="evt-04"]').first().click();
    assert.equal(await page.locator("#match-clock").textContent(), "27:36");
    assert.equal(await page.locator("#recap-panel").isVisible(), false);
    assert.equal(await page.locator('#locale option[value="sw-KE"]').isDisabled(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.locator("#scenario").selectOption("exchange");
    await page.waitForURL(/scenario=exchange/);
    await page.waitForFunction(() => document.querySelector("#play-button")?.title === "Pause");
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await seek("1000");
    assert.equal(await page.locator('.passing-snapshot:not([hidden]) .passing-links button').count(), 3);
    await page.locator("#run-demo-button").click();
    await page.waitForFunction(() => document.querySelector("#run-demo-button")?.getAttribute("aria-pressed") === "false", null, { timeout: 45000 });
    assert.equal(await page.locator("#match-clock").textContent(), "28:00");
    assert.equal(await page.locator("#recap-panel").isVisible(), true);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log("Repeated HTTP/schema failures and retry recovery, scenarios, attack metrics/cutoff, persona switch, recap/evidence/download, automated demo and responsive layout checked.");
} finally { await browser.close(); }
