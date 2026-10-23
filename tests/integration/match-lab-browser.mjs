import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import {chromium} from "playwright-core";
const base=process.env.PULSE_URL??"http://127.0.0.1:8180";
const output=path.join(os.tmpdir(),"pulse-match-lab-review");await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true});
const errors=[];
try {
 for(const width of [1440,390]) for(const view of ["svg","three","pixi"]) {
  const page=await browser.newPage({viewport:{width,height:width===1440?1000:844}});page.on("pageerror",e=>errors.push(e.message));
  await page.goto(`${base}/?scenario=end-to-end&view=${view}`,{waitUntil:"networkidle"});
  await page.waitForFunction(()=>document.querySelector("#scenario").value==="end-to-end"&&document.querySelector("#event-list button"));
  if(await page.locator('#play-button').getAttribute('aria-label')==="Pause") await page.locator('#play-button').click();
  assert.equal(await page.locator('[data-speed="1"]').getAttribute('aria-pressed'),"true");
  assert.equal(await page.locator('#shot-lens').isVisible(),false,"no future shot revealed");
  await page.locator('#scenario-brief summary').click();assert.match(await page.locator('#scenario-brief').textContent(),/Both sides/);
  await page.locator('#scenario-brief summary').click();
  const replay=await(await page.request.get(`${base}/api/replay?scenario=end-to-end`)).json();
  await page.locator('#seek').evaluate(input=>{input.value='0';input.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.ok((await page.locator('#current-action').textContent()).includes(replay.match.teams.find(team=>team.id===replay.events[0].teamId).name),"opening action names the actual first attacking team");
  const index=replay.events.findIndex(e=>e.type==="SHOT"),shot=replay.events[index];
  await page.locator('#event-list button').nth(index).click();
  await page.waitForSelector('#shot-lens:not([hidden])');
  const expected=Math.hypot(shot.from.x,shot.from.y-34).toFixed(1)+' m';
  assert.equal(await page.locator('#shot-distance').textContent(),expected,"Bastion attacks the left goal");
  assert.equal(await page.locator('#shot-diagram').getAttribute('data-event-id'),shot.id);
  await page.locator('#spotlight-toggle').check();
  await page.locator('#spotlight-player').selectOption(shot.actorId,{force:true});
  await page.waitForFunction(id=>document.querySelector('#spotlight-name').textContent.includes(id),replay.match.players.find(p=>p.id===shot.actorId).name);
  assert.ok(await page.locator('#spotlight-events button').count()>0);
  assert.ok((await page.locator('.spotlight-trace').getAttribute('points')).split(' ').length>2);
  assert.ok(!(await page.locator('#window-stats').textContent()).includes('lab.'));
  await page.locator(".pitch-shell").scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(output,`shot-${view}-${width}.png`),fullPage:true});
  await page.locator('#shot-toggle').uncheck();assert.equal(await page.locator('#shot-lens').isVisible(),false);
  await page.locator('#shot-toggle').check();
  await page.locator('#seek').evaluate(input=>{input.value='0';input.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal(await page.locator('#shot-lens').isVisible(),false);assert.equal(await page.locator('#spotlight-events button').count(),0,"rewind removes future evidence");
  await page.locator('#scenario-library-open').click();await page.waitForSelector('.scenario-tile');
  assert.equal(await page.locator('.scenario-tile').count(),6);
  assert.match(await page.locator('[data-scenario-id="end-to-end"]').textContent(),/Watch for/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,"horizontal overflow");
  await page.screenshot({path:path.join(output,`briefings-${view}-${width}.png`),fullPage:true});
  await page.close();
 }
 assert.deepEqual(errors,[]);console.log(`PASS: scenario briefings, both goal directions, shot lens, Spotlight, rewind, 3 renderers and desktop/mobile. Screenshots: ${output}`);
}finally{await browser.close();}
