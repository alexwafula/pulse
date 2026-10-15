import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.env.PULSE_URL ?? "http://127.0.0.1:8080";
const executablePath = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const output = path.join(os.tmpdir(), "pulse-controls-review");
fs.mkdirSync(output, {recursive:true});
const browser = await chromium.launch({executablePath, headless:true});
const errors = [];
async function choose(page, selector, text) {
  await page.locator(`${selector} + .select2-container .select2-selection`).click();
  await page.locator(".select2-results__option").filter({hasText:new RegExp(`^${text}$`)}).click();
  await page.waitForFunction(() => !document.querySelector(".select2-dropdown"));
}
async function seek(page, value) {
  await page.locator("#seek").evaluate((input,value) => {input.value=String(value);input.dispatchEvent(new Event("input",{bubbles:true}));},value);
}
async function bounds(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth>innerWidth),false,"No horizontal overflow");
  const boxes = await page.locator(".header-inner > .select2-container, .scenario-library-button, .audience-controls, .language-control, .demo-button").evaluateAll(elements => elements.filter(element=>element.getBoundingClientRect().width>0).map(element => {
    const r=element.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};
  }));
  for (let i=0;i<boxes.length;i++) for(let j=i+1;j<boxes.length;j++) {
    const a=boxes[i],b=boxes[j];
    assert.ok(!(Math.min(a.right,b.right)-Math.max(a.x,b.x)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1),"Header controls must not overlap");
  }
}
async function uniqueControls(page) {
  await page.waitForFunction(() => [...document.querySelectorAll('select:not([hidden])')].every(select=>select.getAttribute("aria-hidden")==="true"&&select.nextElementSibling?.matches(".select2-container")));
  await page.waitForTimeout(80);
  const controls = await page.locator("select:not([hidden])").evaluateAll(elements => elements.map(select => ({
    id:select.id || select.name, display:getComputedStyle(select).display, hidden:select.getAttribute("aria-hidden"),
    widgets:[...select.parentElement.children].filter(element=>element.matches(".select2-container")).length,
    siblings:[...select.parentElement.children].filter(element=>element.matches("select:not([hidden])")).length,
    enhanced:select.nextElementSibling?.matches(".select2-container"),
    label:select.nextElementSibling?.querySelector('[role="combobox"]')?.getAttribute("aria-label"),
  })));
  for (const control of controls) {
    assert.equal(control.display,"none",`Native ${control.id} must not be visible alongside Select2`);
    assert.equal(control.hidden,"true");
    assert.equal(control.enhanced,true);
    assert.ok(control.label?.length>0&&control.label.length<80,`Concise field label for ${control.id}, not the option list`);
    assert.equal(control.widgets,control.siblings,`Exactly one widget per select in ${control.id}`);
  }
}
try {
  for (const width of [1440,768,390,320]) {
    const context = await browser.newContext({viewport:{width,height:900},isMobile:width<600,hasTouch:width<600});
    const page = await context.newPage();
    page.on("pageerror",error=>errors.push(error.message));
    await page.goto(`${base}/?scenario=corner&view=svg`,{waitUntil:"networkidle"});
    await page.waitForSelector("#locale + .select2-container");
    await uniqueControls(page);
    await page.locator("#play-button").click();
    await seek(page,1000);
    for (const [name,code,heading] of [["Kiswahili","sw-KE","Moja kwa moja"],["Hindi","hi-IN","लाइव"],["English","en-GB","Live"]]) {
      await choose(page,"#locale",name);
      assert.equal(await page.locator("body").getAttribute("data-locale"),code);
      assert.equal(await page.locator("#workspace-title").textContent(),heading);
      await page.waitForFunction(() => document.querySelector("#insight-text")?.textContent?.includes("1"));
      const feed = await (await page.request.get(`${base}/api/insights?scenario=corner&persona=CASUAL&locale=${code}`)).json();
      assert.equal(await page.locator("#insight-text").textContent(),feed.cues[0].text);
      await bounds(page);
      await page.locator('button[data-persona="ANALYST"]').click();
      assert.equal(await page.locator("#match-clock").textContent(),"28:00","Audience change preserves the clock");
      await page.locator('.experience-navigation [data-section="story"]').click();
      await page.waitForFunction(code => {
        const panel=document.querySelector(".story-content");return panel?.getAttribute("data-persona")==="ANALYST"&&panel?.getAttribute("data-locale")===code;
      },code);
      assert.ok(await page.locator(".story-details").count()>0,"Analyst shows phase/coordinate evidence");
      await page.locator('button[data-persona="CASUAL"]').click();
      await page.waitForFunction(()=>document.querySelector(".story-content")?.getAttribute("data-persona")==="CASUAL");
      assert.equal(await page.locator(".story-details").count(),0);
      await page.locator('.experience-navigation [data-section="live"]').click();
    }
    await choose(page,"#locale","Hindi");
    await page.locator('button[data-persona="ANALYST"]').click();
    await page.reload({waitUntil:"networkidle"});
    assert.equal(await page.locator("#locale").inputValue(),"hi-IN");
    assert.equal(await page.locator('button[data-persona="ANALYST"]').getAttribute("aria-pressed"),"true");
    await page.locator("#locale + .select2-container .select2-selection").click();
    const menu = await page.locator(".select2-dropdown").boundingBox();
    assert.ok(menu.x>=0&&menu.x+menu.width<=width+1,"Menu fits viewport");
    await page.locator(".select2-search__field").fill("Hindi");
    assert.equal(await page.locator('.select2-results__option[aria-selected]').count(),1,"Search follows translated options");
    await page.keyboard.press("Escape");
    await bounds(page);
    await page.locator("#scenario-library-open").click();
    await page.waitForSelector(".scenario-tile");
    await page.locator("#scenario-search").fill("केंद्र");
    assert.equal(await page.locator(".scenario-tile:visible").count(),1,"Scenario search uses translated titles");
    await page.keyboard.press("Escape");
    await page.screenshot({path:path.join(output,`hindi-${width}.png`),fullPage:true});
    await context.close();
  }
  const page = await browser.newPage();
  page.on("pageerror",error=>errors.push(error.message));
  await page.goto(`${base}/?scenario=late-siege&view=svg&section=insights`,{waitUntil:"networkidle"});
  await seek(page,450);
  await page.locator('[data-insight-view="maps"]').click();
  await page.waitForSelector("#map-selection + .select2-container");
  await uniqueControls(page);
  await page.locator("#map-selection + .select2-container .select2-selection").click();
  await page.waitForTimeout(1800);
  assert.equal(await page.locator(".select2-dropdown").count(),1,"Replay updates do not destroy an open menu");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".select2-dropdown").count(),0);
  for (const mode of ["network","shots","occupancy","network","occupancy"]) {
    await page.locator(`[data-map-mode="${mode}"]`).click();
    await page.waitForFunction(mode => document.querySelector(".story-content")?.getAttribute("data-map-mode") === mode, mode);
    await uniqueControls(page);
    await page.locator("#map-selection + .select2-container .select2-selection").click();
    await page.keyboard.press("Escape");
  }
  if (await page.locator("#play-button").getAttribute("aria-label") !== "Pause") await page.locator("#play-button").click();
  await page.locator('button[data-persona="ANALYST"]').click();
  assert.equal(await page.locator("#play-button").getAttribute("aria-label"),"Pause","Persona switch does not pause live replay");
  await page.close();
  assert.deepEqual(errors,[]);
  console.log(`PASS Select2, translated search, English/Kiswahili/Hindi templates, both personas, persistence, open-menu stability and non-overlapping controls at 320/390/768/1440px. Screenshots: ${output}`);
} finally {await browser.close();}
