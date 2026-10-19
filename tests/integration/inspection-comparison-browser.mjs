import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.env.PULSE_URL ?? "http://127.0.0.1:8080";
const browser = await chromium.launch({executablePath:process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true});
const output = path.join(os.tmpdir(),"pulse-inspection-comparison"); fs.mkdirSync(output,{recursive:true});
const errors = [];
async function seek(page,value) {
  await page.locator("#seek").evaluate((input,v) => { input.value=String(v); input.dispatchEvent(new Event("input",{bubbles:true})); },value);
}
async function pause(page) { if (await page.locator("#play-button").getAttribute("aria-label") === "Pause") await page.locator("#play-button").click(); }
try {
  for (const width of [1440,390,320]) {
    const context = await browser.newContext({viewport:{width,height:1000}});
    const page = await context.newPage(); page.on("pageerror",e => errors.push(e.message));
    let deliveries = 0;
    page.on("request",r => {if (new URL(r.url()).pathname === "/api/agent-inspection") deliveries++;});
    await page.goto(`${base}/?scenario=corner&view=three`,{waitUntil:"networkidle"}); await pause(page); await seek(page,1000);
    await page.locator("#agent-inspector").waitFor({state:"visible"});
    const before = deliveries;
    await page.locator("#agent-inspector > summary").click();
    assert.equal(await page.locator(".inspection-steps > li").count(),5);
    assert.ok((await page.locator("#agent-inspector-content").textContent()).includes("not model-generation latency"));
    const reference = page.locator(".inspection-reference");
    await reference.locator("summary").click();
    assert.equal(await reference.locator("dl").count(),3);
    assert.ok((await reference.textContent()).includes("not the original recording"));
    await page.locator(".inspection-safety > summary").click();
    await page.getByRole("button",{name:"Show test result",exact:true}).click();
    assert.equal(await page.locator(".inspection-safety-result").textContent(),"Rejected by Go gate. Safe template passed.");
    assert.ok(!(await page.locator("#insight-text").textContent()).includes("2 shots"));
    assert.equal(deliveries,before,"opening Inspector/safety test must not request another delivery");
    await page.screenshot({path:path.join(output,`inspector-${width}.png`),fullPage:true});
    await page.locator('#agent-inspector [data-fact-source]').first().click();
    assert.equal(await page.locator('body').getAttribute('data-section'),'live');
    assert.equal(await page.locator('#agent-inspector').isVisible(),false);
    await seek(page,0);
    assert.equal(await page.locator("#agent-inspector").isVisible(),false,"rewind hides future insight inspection");
    await page.goto(`${base}/?scenario=late-siege&view=three`,{waitUntil:"networkidle"}); await pause(page); await seek(page,1000);
    const replay = await (await page.request.get(`${base}/api/replay?scenario=late-siege`)).json();
    await page.locator('.experience-navigation [data-section="insights"]').click();
    await page.locator('[data-insight-view="comparison"]').click();
    await page.locator('select[name="teamId"]').evaluate((select,id)=>{select.value=id;select.dispatchEvent(new Event("change",{bubbles:true}));}, replay.match.teams.find(team=>team.id==="vale").id);
    await page.locator('.comparison[data-available="true"]').waitFor();
    const windows = await page.locator(".comparison-window").evaluateAll(items => items.map(item => ({start:Number(item.dataset.startMs),end:Number(item.dataset.endMs),ids:[...item.querySelectorAll("[data-comparison-event]")].map(e => e.dataset.comparisonEvent)})));
    assert.equal(windows.length,2);
    assert.equal(windows[0].end-windows[0].start,10000); assert.equal(windows[1].end-windows[1].start,10000);
    assert.equal(windows[0].end,windows[1].start); assert.equal(windows[1].end,replay.match.endMs);
    assert.equal(new Set(windows.flatMap(w => w.ids)).size, windows.flatMap(w => w.ids).length);
    const team = await page.locator('.comparison').getAttribute('data-comparison-team');
    const stats = await page.locator('.comparison-stat').evaluateAll(rows => rows.map(r => ({name:r.dataset.metric,before:Number(r.dataset.before),after:Number(r.dataset.after)})));
    for (let i=0;i<2;i++) {
      const events = replay.events.filter(e => e.teamId===team && e.timeMs>=windows[i].start && (i===0?e.timeMs<windows[i].end:e.timeMs<=windows[i].end));
      assert.equal(stats.find(r=>r.name==="Completed passes")[i===0?"before":"after"],events.filter(e=>e.type==="PASS"&&e.outcome==="COMPLETE").length);
      assert.equal(stats.find(r=>r.name==="Shot attempts")[i===0?"before":"after"],events.filter(e=>e.type==="SHOT").length);
    }
    const windowSelect = page.locator('select[name="windowMs"]');
    assert.ok((await windowSelect.getAttribute('class')).includes('select2-hidden-accessible'));
    await windowSelect.evaluate(select=>{select.value="20000";select.dispatchEvent(new Event("change",{bubbles:true}));});
    await page.waitForFunction(() => {const w=document.querySelector('.comparison-window');return w && Number(w.dataset.endMs)-Number(w.dataset.startMs)===20000;});
    assert.ok(await page.locator('.comparison-window svg').first().isVisible());
    await page.screenshot({path:path.join(output,`comparison-${width}.png`),fullPage:true});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1),`horizontal overflow at ${width}`);
    if (width===1440) {
      await windowSelect.evaluate(select=>{select.value="10000";select.dispatchEvent(new Event("change",{bubbles:true}));});
      await page.waitForFunction(() => {const w=document.querySelector('.comparison-window');return w && Number(w.dataset.endMs)-Number(w.dataset.startMs)===10000;});
      const end = Number(await page.locator('[data-compare-end]').first().getAttribute('data-compare-end'));
      await page.locator('[data-compare-start]').first().click();
      assert.equal(await page.locator('body').getAttribute('data-section'),'live');
      assert.ok(await page.locator('#evidence-return').isVisible());
      await page.waitForFunction(() => document.querySelector('#play-button').getAttribute('aria-label')==='Replay evidence',{},{timeout:20000});
      assert.equal(Number(await page.locator('#experience-inputs [name="atMs"]').inputValue()),end,'window replay must stop at its exclusive evidence boundary');
      await page.locator('#evidence-return').click();
      await page.locator('.experience-navigation [data-section="insights"]').click();
      await page.locator('[data-analysis-pane="control"]').first().click();
      await page.locator('.compare-moment:visible').first().click();
      await page.locator('.comparison').waitFor();
      assert.equal(await page.locator('body').getAttribute('data-insight-view'),'comparison');
    }
    await seek(page,0);
    await page.locator('.comparison[data-available="false"]').waitFor();
    assert.equal(await page.locator('[data-inspect-event]').count(),0);
    await context.close();
  }
  assert.deepEqual(errors,[]);
  console.log(`PASS Inspector, bound reference run, isolated safety test, equal-window metrics, replay, moment comparison, Select2 and 1440/390/320px layouts. Screenshots: ${output}`);
} finally { await browser.close(); }
