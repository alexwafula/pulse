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
// A model's Verifier record must never read as that model having verified the claim: Go's recomputation decides.
async function assertAdvisoryRoles(reference, label) {
  assert.ok((await reference.textContent()).includes("Role outputs are advisory. Go recomputes every fact and decides publication."), `${label}: advisory note`);
  const verifier = reference.locator("dl").filter({hasText:"Verifier"});
  assert.equal(await verifier.count(),1,`${label}: one Verifier record`);
  const terms = await verifier.locator("dt").allTextContents();
  assert.ok(terms.includes("Advisory verdict") && !terms.includes("Output"),`${label}: Verifier record terms ${terms}`);
}
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
    await assertAdvisoryRoles(reference,"corner reference run");
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
    await page.locator("#agent-inspector > summary").click();
    const captured = page.locator(".inspection-reference");
    await captured.locator("summary").click();
    assert.ok((await captured.textContent()).includes("Original capture for this recorded output."));
    await assertAdvisoryRoles(captured,"late-siege captured run");
    const replay = await (await page.request.get(`${base}/api/replay?scenario=late-siege`)).json();
    await page.locator('.experience-navigation [data-section="insights"]').click();
    await page.locator('[data-insight-view="comparison"]').click();
    await page.locator('select[name="teamId"]').evaluate((select,id)=>{select.value=id;select.dispatchEvent(new Event("change",{bubbles:true}));}, replay.match.teams.find(team=>team.id==="vale").id);
    await page.locator('.comparison[data-available="true"]').waitFor();
    // At the end the 10 s windows hold no vale action (its last is at +45.3 s): one line,
    // not 0 -> 0 rows over two empty pitches (ADR 0031). 20 s windows hold actions.
    await page.locator('.comparison[data-comparison-team="vale"] [data-i18n="state.windowNone"]').waitFor();
    assert.equal(await page.locator(".comparison-window, .comparison-stat").count(), 0);
    const windowSelect = page.locator('select[name="windowMs"]');
    await windowSelect.evaluate(select=>{select.value="20000";select.dispatchEvent(new Event("change",{bubbles:true}));});
    await page.waitForFunction(() => document.querySelectorAll('.comparison-window').length === 2);
    const windows = await page.locator(".comparison-window").evaluateAll(items => items.map(item => ({start:Number(item.dataset.startMs),end:Number(item.dataset.endMs),ids:[...item.querySelectorAll("[data-comparison-event]")].map(e => e.dataset.comparisonEvent)})));
    assert.equal(windows.length,2);
    assert.equal(windows[0].end-windows[0].start,20000); assert.equal(windows[1].end-windows[1].start,20000);
    assert.equal(windows[0].end,windows[1].start); assert.equal(windows[1].end,replay.match.endMs);
    assert.equal(new Set(windows.flatMap(w => w.ids)).size, windows.flatMap(w => w.ids).length);
    const team = await page.locator('.comparison').getAttribute('data-comparison-team');
    const stats = await page.locator('.comparison-stat').evaluateAll(rows => rows.map(r => ({name:r.dataset.metric,before:Number(r.dataset.before),after:Number(r.dataset.after)})));
    for (let i=0;i<2;i++) {
      const events = replay.events.filter(e => e.teamId===team && e.timeMs>=windows[i].start && (i===0?e.timeMs<windows[i].end:e.timeMs<=windows[i].end));
      assert.equal(stats.find(r=>r.name==="Completed passes")[i===0?"before":"after"],events.filter(e=>e.type==="PASS"&&e.outcome==="COMPLETE").length);
      assert.equal(stats.find(r=>r.name==="Shot attempts")[i===0?"before":"after"],events.filter(e=>e.type==="SHOT").length);
    }
    assert.ok((await windowSelect.getAttribute('class')).includes('select2-hidden-accessible'));
    await windowSelect.evaluate(select=>{select.value="20000";select.dispatchEvent(new Event("change",{bubbles:true}));});
    await page.waitForFunction(() => {const w=document.querySelector('.comparison-window');return w && Number(w.dataset.endMs)-Number(w.dataset.startMs)===20000;});
    assert.ok(await page.locator('.comparison-window svg').first().isVisible());
    await page.screenshot({path:path.join(output,`comparison-${width}.png`),fullPage:true});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1),`horizontal overflow at ${width}`);
    if (width===1440) {
      // Mid-sequence (+40 s), where both 10 s windows hold vale actions.
      await seek(page,500);
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
