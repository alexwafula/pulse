// Manual check of an already-capped, warmed Foundry service; never part of offline CI.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright-core";

const base = process.env.PULSE_URL;
const source = process.env.PULSE_INSIGHT_SOURCE ?? "python-verified";
assert.ok(["python-verified", "python-recorded"].includes(source));
const status = source === "python-recorded" ? "Verified (recorded)" : "Verified";
assert.ok(base, "Set PULSE_URL to the explicitly approved, capped Foundry demo.");
assert.equal(process.env.PULSE_CACHED_FOUNDRY, "1", "Warm and cap the service first; this check requests insights.");
const executablePath = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const require = createRequire(import.meta.url);
const { PNG } = require(path.join(path.dirname(require.resolve("playwright-core/package.json")), "lib/utilsBundle.js"));
const output = path.join(os.tmpdir(), "pulse-foundry-preview");
fs.mkdirSync(output, {recursive:true});
const browser = await chromium.launch({executablePath,headless:true});
const errors = [];
try {
  for (const mobile of [false,true]) {
    const context = await browser.newContext({viewport: mobile ? {width:390,height:844} : {width:1440,height:900},isMobile:mobile,hasTouch:mobile});
    const page = await context.newPage();
    page.on("pageerror",error => errors.push(error.message));
    const response = await page.request.get(`${base}/api/insights?scenario=corner&persona=CASUAL`);
    assert.equal(response.headers()["x-pulse-insight-source"], source);
    const cue = (await response.json()).cues[0];
    assert.equal(cue.verification.status,"VERIFIED");
    assert.deepEqual(cue.eventIds,["evt-06","evt-07"]);
    await page.goto(`${base}/experience?scenario=corner&view=three`,{waitUntil:"networkidle"});
    if (await page.locator("#play-button").getAttribute("aria-label") === "Pause") await page.locator("#play-button").click();
    await page.locator("#seek").evaluate(input => {input.value="1000";input.dispatchEvent(new Event("input",{bubbles:true}));});
    await page.waitForFunction(expected => document.querySelector("#insight-status")?.textContent === expected,status,{timeout:15000});
    assert.equal(await page.locator("#insight-text").textContent(),cue.text);
    await page.waitForSelector("#canvas-host canvas");
    const pixels = PNG.sync.read(await page.locator("#canvas-host canvas").screenshot());
    let turf = 0;
    for (let i=0;i<pixels.data.length;i+=16) {
      const [r,g,b]=pixels.data.subarray(i,i+3);
      if (g>r*1.2 && g>b*1.2 && g>35) turf++;
    }
    assert.ok(turf>100,"Foundry preview must still show the rendered pitch");
    await page.screenshot({path:path.join(output,`${mobile?"mobile":"desktop"}-foundry-verified.png`),fullPage:true});
    await page.locator("#evidence-button").click();
    assert.ok(await page.locator("#evidence-return").isVisible());
    await page.locator("#evidence-return").click();
    assert.equal(await page.locator("#insight-status").textContent(), status);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth>innerWidth),false);
    await context.close();
  }
  assert.deepEqual(errors,[]);
  console.log(`PASS capped Foundry browser: desktop/mobile Verified status, source evidence replay, nonblank Three.js pitch. Screenshots: ${output}`);
} finally {await browser.close();}
