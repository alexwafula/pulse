import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright-core";

const base = process.env.PULSE_URL ?? "http://127.0.0.1:8080";
const executablePath = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const require = createRequire(import.meta.url);
const { PNG } = require(path.join(path.dirname(require.resolve("playwright-core/package.json")), "lib/utilsBundle.js"));
const output = path.join(os.tmpdir(), "pulse-homepage-release");
fs.mkdirSync(output, {recursive:true});
const browser = await chromium.launch({executablePath,headless:true});
const errors = [];
try {
  for (const mobile of [false,true]) {
    const context = await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile});
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    const home = await page.goto(`${base}/`, {waitUntil:"networkidle"});
    assert.equal(await page.locator("body").getAttribute("class"), "experience");
    const version = await (await fetch(`${base}/version`)).json();
    assert.match(version.shortSha, /^([0-9a-f]{7}|unknown)$/);
    assert.equal(home.headers()["x-pulse-build"], version.shortSha);
    const build = page.locator("#build-label");
    assert.ok(await build.isVisible(), "build label must be visible");
    assert.ok(parseFloat(await build.evaluate(element => getComputedStyle(element).fontSize)) <= 12, "build label must stay small");
    for (const locale of ["en-GB","sw-KE","hi-IN","en-GB"]) {
      await page.evaluate(code => { const select = document.querySelector("#locale"); select.value = code; select.dispatchEvent(new Event("change",{bubbles:true})); }, locale);
      assert.equal(await page.locator("body").getAttribute("data-locale"), locale);
      assert.equal(await build.textContent(), `build ${version.shortSha}`);
    }
    assert.equal(await page.locator("#scenario").inputValue(), "late-siege");
    assert.equal(await page.locator("#player-layer g").count(), 22);
    assert.equal(await page.locator(".dashboard-link").textContent(), "Legacy");
    assert.ok((await page.locator(".dashboard-link").getAttribute("href")).startsWith("/legacy?"));
    await page.waitForSelector("#canvas-host canvas");
    const pixels = PNG.sync.read(await page.locator("#canvas-host canvas").screenshot());
    let turf=0;
    for (let i=0;i<pixels.data.length;i+=16) {
      const [r,g,b]=pixels.data.subarray(i,i+3);
      if (g>r*1.2&&g>b*1.2&&g>35) turf++;
    }
    assert.ok(turf>100,"Homepage stadium must render");
    await page.screenshot({path:path.join(output,`${mobile?"mobile":"desktop"}.png`),fullPage:true});
    await page.locator("#scenario-library-open").click();
    await page.locator('[data-scenario-id="corner"] a:not([data-guided-demo])').click();
    await page.waitForURL(url => url.pathname === "/" && url.searchParams.get("scenario") === "corner");
    assert.equal(await page.locator("body").getAttribute("class"),"experience");
    for (const section of ["story","insights","recap","live"]) {
      await page.locator(`.experience-navigation [data-section="${section}"]`).click();
      assert.equal(new URL(page.url()).pathname,"/");
      assert.equal(await page.locator("body").getAttribute("data-section"),section);
    }
    await page.goto(`${base}/legacy?scenario=corner&view=svg`,{waitUntil:"networkidle"});
    assert.equal(await page.locator(".experience-navigation").count(),0);
    await page.goto(`${base}/experience?scenario=corner&view=svg`,{waitUntil:"networkidle"});
    assert.equal(await page.locator(".experience-navigation").count(),1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth>innerWidth),false);
    await context.close();
  }
  assert.deepEqual(errors,[]);
  console.log(`PASS desired homepage, full 22-player scenario, desktop/mobile stadium, navigation, legacy isolation and alias. Screenshots: ${output}`);
} finally {await browser.close();}
