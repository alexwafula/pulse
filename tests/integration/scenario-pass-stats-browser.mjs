import assert from "node:assert/strict";
import {chromium} from "playwright-core";

const base=process.env.PULSE_URL??"http://127.0.0.1:8180";
const scenarios=["corner","central","exchange","late-siege","calm-midfield","end-to-end"];
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true});
const errors=[];
const count=(events,teamId,clock,predicate)=>events.filter(event=>event.teamId===teamId&&event.timeMs<=clock&&event.timeMs>=clock-20000&&predicate(event)).length;
try{
 for(const scenario of scenarios){
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.on("pageerror",error=>errors.push(error.message));
  await page.goto(`${base}/?scenario=${scenario}&view=three&locale=en-GB`,{waitUntil:"networkidle"});
  await page.waitForFunction(id=>document.querySelector("#scenario")?.value===id&&document.querySelector("#match-lab"),scenario);
  const replay=await(await page.request.get(`${base}/api/replay?scenario=${scenario}`)).json();
  const seek=page.locator("#seek"),shell=page.locator(".pitch-shell");
  if(await page.locator("#play-button").getAttribute("aria-label")==="Pause") await page.locator("#play-button").click();
  for(const value of [0,200,500,800,1000]){
   await seek.evaluate((input,value)=>{input.value=String(value);input.dispatchEvent(new Event("input",{bubbles:true}));},value);
   await page.waitForTimeout(90);
   const clock=Number(await shell.getAttribute("data-time-ms"));
   const rows=await page.locator(".window-team").evaluateAll(nodes=>nodes.map(node=>({teamId:node.dataset.teamId,completed:Number(node.dataset.passCompleted),attempts:Number(node.dataset.passAttempts),text:node.textContent})));
   assert.equal(rows.length,replay.match.teams.length,scenario+" shows one recent-play row per team");
   for(const team of replay.match.teams){
    const row=rows.find(item=>item.teamId===team.id);
    const attempts=count(replay.events,team.id,clock,event=>event.type==="PASS");
    const completed=count(replay.events,team.id,clock,event=>event.type==="PASS"&&event.outcome==="COMPLETE");
    assert.ok(row,scenario+" has recent-play row for "+team.id);
    assert.equal(row.attempts,attempts,scenario+" recent pass attempts at "+clock+" for "+team.id);
    assert.equal(row.completed,completed,scenario+" recent completed passes at "+clock+" for "+team.id);
    assert.ok(row.text.includes(`Completed passes ${completed}/${attempts}`),scenario+" labels completed/attempted ratio");
   }
  }
  const end=Number(replay.match.endMs);
  const allPasses=replay.events.filter(event=>event.type==="PASS"&&event.timeMs<=end);
  const completed=allPasses.filter(event=>event.outcome==="COMPLETE");
  await page.waitForFunction(end=>Number(document.querySelector(".pitch-shell").dataset.timeMs)===end,end);
  assert.equal((await page.locator("#summary-passes").textContent()).trim(),`${completed.length} of ${allPasses.length}`,scenario+" cumulative pass completion through replay end");
  for(const [index,team] of replay.match.teams.entries()){
   const expected=completed.filter(event=>event.teamId===team.id).length;
   const selector=index===0?"#home-pass-share":"#away-pass-share";
   assert.match((await page.locator(selector).textContent()).trim(),new RegExp(`^${expected} completed passes?$`),scenario+" completed passes by team through replay end");
  }
  assert.equal((await page.locator(".share-title").textContent()).trim(),"Completed passes through current clock");
  assert.equal((await page.locator(".rail-sub").filter({hasText:"Completed / attempted through current clock"}).count()),1);
  assert.deepEqual(await page.locator("#window-stats").evaluate(node=>node.getAttribute("aria-label")),"Last 20 seconds");
  await page.close();
 }
 assert.deepEqual(errors,[]);
 console.log("PASS: recent completed/attempted pass stats and cumulative pass totals match replay events in all six scenarios.");
}finally{await browser.close();}
