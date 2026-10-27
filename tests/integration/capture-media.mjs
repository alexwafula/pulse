import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const output = path.join(root, "docs", "media");
await mkdir(output, { recursive: true });
const url = process.env.PULSE_URL ?? "http://127.0.0.1:8080";
const defaultChrome = process.platform === "linux" ? "/usr/bin/chromium-browser" : "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? defaultChrome, headless: true });

const pause = async page => {
  if (await page.locator("#play-button").getAttribute("aria-label") === "Pause") {
    await page.locator("#play-button").click();
  }
};
const seek = async (page, value) => page.locator("#seek").evaluate((input, value) => {
  input.value = String(value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}, value);
const section = async (page, name) => page.locator(`.experience-navigation [data-section="${name}"]`).click();

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });

  // 1. End-to-End 11v11 Live 3D Broadcast camera + Read the Game (Shot Lens & Player Spotlight)
  await page.goto(`${url}/?scenario=end-to-end&view=three&locale=en-GB&persona=CASUAL`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelector(".pitch-shell")?.getAttribute("data-renderer") === "three" && document.querySelectorAll("#event-list button").length > 0);
  await pause(page);
  const e2eReplay = await (await page.request.get(`${url}/api/replay?scenario=end-to-end`)).json();
  const shotIndex = e2eReplay.events.findIndex(event => event.type === "SHOT");
  const firstShot = e2eReplay.events[shotIndex];
  await page.locator("#event-list button").nth(shotIndex).click();
  await page.locator("#shot-lens:not([hidden])").waitFor({ state: "visible" });
  await page.locator("#spotlight-toggle").check();
  await page.locator("#spotlight-player").selectOption(firstShot.actorId, { force: true });
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(output, "pulse-experience-live.png") });
  await page.locator("#match-lab").scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(output, "pulse-shot-lens-spotlight.png") });

  // 2. Corner Chance: Verified (recorded) insight + Fact Check + Agent Inspector + Safety Test
  await page.goto(`${url}/?scenario=corner&view=three&locale=en-GB&persona=CASUAL`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelector(".pitch-shell")?.getAttribute("data-renderer") === "three");
  await pause(page);
  await seek(page, "1000");
  await page.waitForFunction(() => document.querySelector("#insight-status")?.getAttribute("aria-label") === "Verified (recorded)");
  await page.locator("#fact-check summary").click();
  await page.locator("#agent-inspector > summary").click();
  await page.locator(".inspection-reference summary").click();
  await page.locator(".inspection-safety > summary").click();
  await page.getByRole("button", { name: "Show test result", exact: true }).click();
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(output, "pulse-overview.png") });
  await page.locator(".inspection-safety-result").evaluate(el => el.scrollIntoView({ block: "end" }));
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(output, "pulse-inspector.png") });

  // 3. Evidence Trail under the 3D pitch + Broadcast Mode fullscreen
  await page.locator("#evidence-button").click();
  await pause(page);
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(output, "pulse-evidence.png") });
  await page.locator("#evidence-return").click();
  await seek(page, "1000");
  await page.locator("#broadcast-toggle").click();
  await page.waitForFunction(() => document.body.dataset.broadcast === "true");
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(output, "pulse-broadcast.png") });
  await page.locator("#broadcast-exit").click();

  // 4. Late Siege (11v11): Insights (Match Graphs, Occupancy Heatmap, and What Changed? 20s comparison)
  await page.goto(`${url}/?scenario=late-siege&view=three&locale=en-GB&persona=CASUAL`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelector(".pitch-shell")?.getAttribute("data-renderer") === "three");
  await pause(page);
  await seek(page, "1000");
  await section(page, "insights");
  await page.locator('[data-graphic="chart"][data-ready="true"]').first().waitFor({ state: "visible" });
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(output, "pulse-experience-graphs.png") });

  await page.getByRole("button", { name: "Pitch maps", exact: true }).click();
  await page.locator('[data-graphic="map"][data-ready="true"]').waitFor({ state: "visible" });
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(output, "pulse-experience-heatmap.png") });

  await seek(page, "575");
  await page.locator('[data-insight-view="comparison"]').click();
  await page.locator('select[name="windowMs"]').evaluate(node => {
    node.value = "20000";
    node.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(() => document.querySelectorAll(".comparison-window").length === 2);
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(output, "pulse-what-changed.png") });

  // 5. Drawer Passing Network, Attacking Routes, and Deterministic Recap
  await seek(page, "1000");
  await section(page, "live");
  await page.locator('.drawer-tab[data-tab="passing"]').click();
  await page.locator(".passing-panel").screenshot({ path: path.join(output, "pulse-analytics.png") });
  await page.locator('.drawer-tab[data-tab="routes"]').click();
  await page.locator(".attack-panel").screenshot({ path: path.join(output, "pulse-tactics.png") });
  await section(page, "recap");
  await page.locator('.story-content[data-panel="recap"] li').first().waitFor();
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(output, "pulse-recap.png") });

  // 6. Mobile Passing Map (390x844)
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await mobile.goto(`${url}/?scenario=late-siege&view=three&locale=en-GB&persona=CASUAL`, { waitUntil: "networkidle" });
  await pause(mobile);
  await seek(mobile, "1000");
  await section(mobile, "insights");
  await mobile.getByRole("button", { name: "Pitch maps", exact: true }).click();
  await mobile.locator('[data-map-mode="network"]').click();
  await mobile.locator('[data-graphic="map"][data-ready="true"]').waitFor({ state: "visible" });
  await mobile.waitForTimeout(250);
  await mobile.screenshot({ path: path.join(output, "pulse-experience-mobile-network.png") });
  await mobile.close();

  console.log(`Captured 11 application screenshots in ${output}`);
} finally {
  await browser.close();
}
