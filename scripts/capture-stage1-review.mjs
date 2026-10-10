import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const output = path.join(root, "docs", "media");
await mkdir(output, { recursive: true });
const url = process.env.PULSE_URL ?? "http://127.0.0.1:8080";
const defaultChrome = process.platform === "linux" ? "/usr/bin/chromium-browser" : "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? defaultChrome, headless: true });

try {
  // 1. Desktop 1440x900
  console.log("Capturing 1440x900 desktop...");
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await desktop.goto(`${url}/`, { waitUntil: "networkidle" });
  await desktop.waitForFunction(() => document.querySelector(".pitch-shell")?.getAttribute("data-renderer") === "three");
  await desktop.waitForTimeout(1000);
  await desktop.screenshot({ path: path.join(output, "pulse-stage1-1440x900.png") });
  await desktop.close();

  // 2. Tablet 1024x768
  console.log("Capturing 1024x768 tablet...");
  const tablet = await browser.newPage({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 });
  await tablet.goto(`${url}/`, { waitUntil: "networkidle" });
  await tablet.waitForFunction(() => document.querySelector(".pitch-shell")?.getAttribute("data-renderer") === "three");
  await tablet.waitForTimeout(1000);
  await tablet.screenshot({ path: path.join(output, "pulse-stage1-1024x768.png") });
  await tablet.close();

  // 3. Mobile 390x844
  console.log("Capturing 390x844 mobile...");
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await mobile.goto(`${url}/`, { waitUntil: "networkidle" });
  await mobile.waitForFunction(() => document.querySelector(".pitch-shell")?.getAttribute("data-renderer") === "three");
  await mobile.waitForTimeout(1000);
  await mobile.screenshot({ path: path.join(output, "pulse-stage1-390x844.png") });
  await mobile.close();

  // 4. Kitchen sink /design at 1440x900
  console.log("Capturing /design kitchen sink...");
  const design = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await design.goto(`${url}/design`, { waitUntil: "networkidle" });
  await design.waitForTimeout(500);
  await design.screenshot({ path: path.join(output, "pulse-stage1-design.png"), fullPage: true });
  await design.close();

  console.log("All Stage 1 review screenshots captured successfully!");
} finally {
  await browser.close();
}
