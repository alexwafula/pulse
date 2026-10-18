import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.env.PULSE_URL ?? "http://127.0.0.1:8080";
const executablePath = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const output = path.join(os.tmpdir(), "pulse-demo-readiness");
fs.mkdirSync(output, {recursive:true});
const browser = await chromium.launch({executablePath, headless:true});
const errors = [];
const pause = async page => { if (await page.locator("#play-button").getAttribute("aria-label") === "Pause") await page.locator("#play-button").click(); };
const seek = async (page, value) => page.locator("#seek").evaluate((input, value) => { input.value=String(value); input.dispatchEvent(new Event("input", {bubbles:true})); }, value);
const section = (page, name) => page.locator(`.experience-navigation [data-section="${name}"]`).click();
const nextFrames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const json = async (page, route) => (await page.request.get(`${base}${route}`)).json();

async function settledMap(page, mode, teamId, at) {
  await page.waitForFunction(({mode, teamId, at}) => {
    const content=document.querySelector("#experience-content"), story=content?.querySelector(".story-content");
    const canvas=content?.querySelector('.map-art canvas[data-ready="true"]');
    return content?.getAttribute("aria-busy")!=="true" && story?.dataset.mapMode===mode
      && story.dataset.timeMs===String(at) && content.querySelector(".pitch-map")?.dataset.mapTeam===teamId && canvas && !canvas.hidden;
  }, {mode,teamId,at});
  await nextFrames(page);
  assert.equal(await page.locator(".map-art canvas").count(),1);
  assert.equal(await page.locator(".map-art .graphic-tooltip").count(),1);
}

async function shotPixels(page, shots) {
  const visible = await page.locator('.map-art canvas[data-ready="true"]').evaluate((canvas, shots) => {
    const ctx=canvas.getContext("2d");
    return shots.map(shot => {
      const x=Math.floor((shot.from.x+2)/109*canvas.width), y=Math.floor((68-shot.from.y+2)/72*canvas.height);
      return [...ctx.getImageData(x,y,1,1).data];
    });
  }, shots);
  assert.equal(visible.length,shots.length);
  for (const [r,g,b,a] of visible) assert.ok(r>200 && g>130 && b<90 && a>0, `source shot must paint a visible yellow point: ${r},${g},${b},${a}`);
}

try {
  for (const [width, height, dpr] of [[1440,900,1],[390,844,2],[320,740,2]]) {
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr,isMobile:width<600,hasTouch:width<600});
    const page=await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${base}/?scenario=late-siege&view=three`,{waitUntil:"networkidle"});
    await pause(page);
    await page.locator("#canvas-host canvas").evaluate(canvas => {canvas.dataset.identity="readiness-pitch";});
    const replay=await json(page,"/api/replay?scenario=late-siege");
    const feed=await json(page,"/api/moments?scenario=late-siege");
    const moment=feed.moments.find(moment => moment.type==="SUSTAINED_PRESSURE");
    assert.ok(moment);
    for (const origin of ["live","insights"]) {
      await page.getByRole("button",{name:"Casual",exact:true}).click();
      await seek(page,1000);
      await section(page,origin);
      if (origin==="insights") await page.getByRole("button",{name:"Model & moments",exact:true}).click();
      else await page.locator('.drawer-tab[data-tab="control"]').click();
      await page.locator('[data-moment-type="SUSTAINED_PRESSURE"]').first().click();
      await page.waitForFunction(() => document.body.dataset.section==="live" && document.querySelector("#pane-evidence")?.classList.contains("active"));
      await pause(page);
      assert.equal(new URL(page.url()).searchParams.get("section"),null);
      assert.ok(await page.locator("#pressure-insight").isVisible());
      assert.match(await page.locator("#pressure-text").textContent(),new RegExp(`${moment.values.actions} final-third actions`));
      assert.equal(await page.locator("#pressure-insight").getAttribute("data-source"),"deterministic-moment-template");
      assert.ok((await page.locator("#pressure-insight").textContent()).includes("Not model-verified"));
      assert.equal(await page.locator("#evidence-kind").textContent(),"Source events & metric ticks");
      assert.deepEqual(await page.locator("#evidence-list [data-source-event]").evaluateAll(nodes=>nodes.map(node=>node.dataset.sourceEvent)),moment.reasons);
      assert.deepEqual(await page.locator("#evidence-list [data-source-tick]").evaluateAll(nodes=>nodes.map(node=>Number(node.dataset.sourceTick))),moment.tickTimesMs);
      await page.getByRole("button",{name:"Analyst",exact:true}).click();
      assert.ok((await page.locator("#pressure-text").textContent()).includes(String(moment.values.finalThird)));
      assert.ok(await page.locator("#pressure-insight").isVisible(),"persona changes preserve the selected moment");
      await page.locator("#pressure-evidence").click(); await pause(page);
      assert.equal(await page.locator("body").getAttribute("data-section"),"live");
      await page.screenshot({path:path.join(output,`pressure-${width}-${origin}.png`),fullPage:true});
      await page.locator("#evidence-return").click();
      assert.equal(await page.locator("#pressure-insight").isVisible(),false,"pressure template expires outside its moment window");
    }

    await seek(page,1000);
    await section(page,"insights");
    await page.getByRole("button",{name:"Pitch maps",exact:true}).click();
    await page.getByRole("button",{name:"Shots",exact:true}).click();
    const team=replay.match.teams.find(team=>replay.events.some(event=>event.type==="SHOT" && event.teamId===team.id));
    await page.locator('select[name="teamId"]').evaluate((select,id)=>{select.value=id;select.dispatchEvent(new Event("change",{bubbles:true}));},team.id);
    await settledMap(page,"shots",team.id,replay.match.endMs);
    const shots=replay.events.filter(event=>event.type==="SHOT" && event.teamId===team.id);
    assert.deepEqual(await page.locator("[data-shot-event]").evaluateAll(points=>points.map(point=>point.dataset.shotEvent)),shots.map(shot=>shot.id));
    await shotPixels(page,shots);
    for (const resized of [width+8,width,width+20,width]) {
      await page.setViewportSize({width:resized,height});
      await settledMap(page,"shots",team.id,replay.match.endMs);
      await shotPixels(page,shots);
    }
    const fallback=await page.locator(".map-art canvas").evaluate(canvas=>{
      canvas.dispatchEvent(new Event("contextlost",{cancelable:true}));
      return {hidden:canvas.hidden,sourceVisible:getComputedStyle(canvas.parentElement.querySelector("svg")).visibility!=="hidden"};
    });
    assert.deepEqual(fallback,{hidden:true,sourceVisible:true});
    await page.locator(".map-art canvas").dispatchEvent("contextrestored");
    await settledMap(page,"shots",team.id,replay.match.endMs);
    await shotPixels(page,shots);
    await page.screenshot({path:path.join(output,`shots-${width}.png`),fullPage:true});
    const canvas=page.locator(".map-art canvas");
    await canvas.scrollIntoViewIfNeeded();
    const bounds=await canvas.boundingBox(), shot=shots[0];
    const x=bounds.x+(shot.from.x+2)/109*bounds.width,y=bounds.y+(68-shot.from.y+2)/72*bounds.height;
    if(width<600) await page.touchscreen.tap(x,y); else await page.mouse.click(x,y);
    await page.waitForFunction(({at,start,end})=>document.body.dataset.section==="live" && document.querySelector("#seek")?.value===String(Math.round((at-start)/(end-start)*1000)),{at:shot.timeMs,start:replay.match.startMs,end:replay.match.endMs});
    assert.equal(await page.locator("#canvas-host canvas").getAttribute("data-identity"),"readiness-pitch");
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await context.close();
  }
  assert.deepEqual(errors,[]);
  console.log(`PASS pressure templates/evidence, moment navigation and shot pixels across resize, context recovery and desktop/mobile. Screenshots: ${output}`);
} finally {await browser.close();}
