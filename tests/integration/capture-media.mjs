import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const output = path.join(root, "docs", "media");
await mkdir(output, { recursive: true });
const url = process.env.PULSE_URL ?? "http://127.0.0.1:8083";
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await page.goto(`${url}/?scenario=central`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelector('.pitch-shell')?.getAttribute('data-renderer') === 'three');
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const seek = async value => page.locator("#seek").evaluate((input, value) => { input.value = value; input.dispatchEvent(new Event("input", { bubbles: true })); }, value);
  await seek("1000");
  await page.getByRole("button", { name: "Analyst", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("#insight-text")?.textContent === "Set-piece sequence: 1 shot following the corner.");
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: path.join(output, "pulse-overview.png") });
  await page.locator(".passing-panel").screenshot({ path: path.join(output, "pulse-analytics.png") });
  await page.locator(".attack-panel").screenshot({ path: path.join(output, "pulse-tactics.png") });
  await page.locator("#recap-panel").screenshot({ path: path.join(output, "pulse-recap.png") });
  await page.locator("#evidence-button").click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: path.join(output, "pulse-evidence.png") });
  console.log(`Captured five actual application screenshots in ${output}`);
} finally { await browser.close(); }
