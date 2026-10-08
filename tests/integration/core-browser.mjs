import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const url = process.env.PULSE_URL ?? "http://127.0.0.1:8083";
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport, acceptDownloads: true });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${url}/?scenario=central`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    const seek = async value => page.locator("#seek").evaluate((input, value) => { input.value = value; input.dispatchEvent(new Event("input", { bubbles: true })); }, value);
    await seek("667");
    assert.equal(await page.locator('.attack-snapshot:not([hidden]) .attack-stats dd').nth(0).textContent(), "1");
    assert.equal(await page.locator('.attack-snapshot:not([hidden]) .attack-stats dd').nth(1).textContent(), "1");
    assert.equal(await page.locator('.attack-snapshot:not([hidden]) .attack-stats dd').nth(2).textContent(), "100%");
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
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log("Scenarios, attack metrics/cutoff, persona switch, recap/evidence/download and responsive layout checked.");
} finally { await browser.close(); }
