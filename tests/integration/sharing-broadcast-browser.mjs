import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {chromium} from "playwright-core";

const base=process.env.PULSE_URL ?? "http://127.0.0.1:8080";
const output=path.join(os.tmpdir(),"pulse-sharing-broadcast");fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH ?? (process.platform==="linux"?"/usr/bin/google-chrome":"C:/Program Files/Google/Chrome/Application/chrome.exe"),headless:true});
const errors=[];
const pause=async page=>{const state=await page.locator('.pitch-shell').getAttribute('data-playback-state');if(state==='playing') await page.locator('#play-button').click();};
const seek=(page,value)=>page.locator('#seek').evaluate((input,value)=>{input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));},value);
const inspect=(page,eventId)=>page.evaluate(eventId=>document.dispatchEvent(new CustomEvent('pulse:inspect',{detail:{eventId}})),eventId);
const nextFrames=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
async function makePage(width=1440,height=1000,clipboard=true) {
  const page=await browser.newPage({viewport:{width,height}});
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(clipboard=>{Object.defineProperty(navigator,'clipboard',{value:{writeText:async value=>{if(!clipboard) throw new Error('denied');window.__copied=value;}}});},clipboard);
  return page;
}
async function copy(page) {
  await page.locator(await page.locator('body').getAttribute('data-broadcast')==='true'?'#broadcast-copy':'#share-button').click();
  await page.waitForFunction(()=>Boolean(window.__copied));
  return page.evaluate(()=>window.__copied);
}
async function restored(page,url,at,view,locale='en-GB',persona='CASUAL') {
  await page.goto(url,{waitUntil:'networkidle'});
  await page.waitForFunction(({at,view})=>document.querySelector('.pitch-shell')?.dataset.timeMs===String(at) && document.querySelector('.pitch-shell')?.dataset.renderer===view,{at,view});
  assert.equal(await page.locator('#shared-position-error').isVisible(),false);
  assert.notEqual(await page.locator('.pitch-shell').getAttribute('data-playback-state'),'playing');
  assert.equal(await page.locator('body').getAttribute('data-locale'),locale);
  assert.equal(await page.locator('body').getAttribute('data-persona'),persona);
  await page.waitForTimeout(150);
  assert.equal(Number(await page.locator('.pitch-shell').getAttribute('data-time-ms')),at,'shared link must remain paused at its exact timestamp');
}

try {
  const page=await makePage();
  await page.goto(`${base}/?scenario=late-siege&view=svg&persona=ANALYST&locale=sw-KE`,{waitUntil:'networkidle'});
  await pause(page);
  const replay=await (await page.request.get(`${base}/api/replay?scenario=late-siege`)).json(),shot=replay.events.at(-1);
  await inspect(page,shot.id);
  const shared=await copy(page);
  assert.equal(new URL(shared).searchParams.get('event'),shot.id);
  const other=await makePage(390,844);
  await other.addInitScript(()=>{localStorage.setItem('pulse:locale','hi-IN');localStorage.setItem('pulse:persona','CASUAL');});
  await restored(other,shared,shot.timeMs,'svg','sw-KE','ANALYST');
  await other.reload({waitUntil:'networkidle'});
  assert.equal(await other.locator('#shared-position-error').isVisible(),false,'default audience URL rewriting must not break reload');
  console.log('ok exact event link, language/persona precedence and reload');

  await page.goto(`${base}/?scenario=late-siege&view=svg&locale=en-GB&persona=CASUAL`,{waitUntil:'networkidle'});await pause(page);await seek(page,1000);
  const envelope=await (await page.request.get(`${base}/api/agent-inspection?scenario=late-siege`)).json();
  const open=envelope.inspections.find(item=>item.factPack.facts[0].metric==='open_play_passes_before_shot');
  assert.equal(open.source,'python-recorded');assert.equal(open.reference.kind,'captured-agent-run');assert.equal(open.gatePassed,true);
  assert.equal(open.response.verification.status,'VERIFIED');assert.equal(open.reference.observations.length,3);
  assert.equal(await page.locator('#insight-status').getAttribute('aria-label'),'Verified (recorded)');
  await page.locator('#agent-inspector > summary').click();
  assert.ok((await page.locator('#agent-inspector-content').textContent()).includes('Captured output'));
  assert.ok(!(await page.locator('#agent-inspector-content').textContent()).includes('original model execution trace is unavailable'));
  await page.locator('#evidence-button').click();await pause(page);
  const clipAt=Number(await page.locator('.pitch-shell').getAttribute('data-time-ms'));
  const cueURL=await copy(page);
  await restored(other,cueURL,Math.floor(clipAt),'svg');
  assert.equal(await other.locator('#evidence-return').isVisible(),true);
  // D4a: a shared clip shows the trail under the pitch, like the clicked clip it came from.
  const trailUnderPitch=target=>target.locator('#clip-trail-slot:not([hidden]) #evidence-trail').count();
  assert.equal(await trailUnderPitch(page),1,'clicked insight clip puts the trail under the pitch');
  assert.equal(await trailUnderPitch(other),1,'shared insight clip puts the trail under the pitch');
  assert.equal(await page.locator('#tab-evidence').getAttribute('aria-selected'),'true','clicked insight selects Evidence');
  assert.equal(await other.locator('#tab-evidence').getAttribute('aria-selected'),'true','shared insight selects the same Evidence tab');
  assert.equal(new URL(cueURL).searchParams.get('cue'),open.cueId);
  console.log('ok second recorded agent pattern, actual trace and cue replay link');

  await seek(page,1000);await page.locator('.drawer-tab[data-tab="control"]').click();
  await page.locator('[data-moment-type="SUSTAINED_PRESSURE"]').first().click();await pause(page);
  const momentAt=Math.floor(Number(await page.locator('.pitch-shell').getAttribute('data-time-ms')));
  const momentURL=await copy(page);
  await restored(other,momentURL,momentAt,'svg');
  assert.equal(await other.locator('#evidence-kind').textContent(),'Source events & metric ticks');
  assert.equal(await trailUnderPitch(page),1,'clicked moment clip puts the trail under the pitch');
  assert.equal(await trailUnderPitch(other),1,'shared moment clip puts the trail under the pitch');
  assert.ok(await other.locator('#pane-evidence').isVisible());
  await seek(page,1000);
  await page.evaluate(({start,end})=>document.dispatchEvent(new CustomEvent('pulse:replay-window',{detail:{startMs:start,endMs:end}})),{start:replay.match.endMs-10000,end:replay.match.endMs-1});
  await pause(page);
  const comparisonAt=Math.floor(Number(await page.locator('.pitch-shell').getAttribute('data-time-ms')));
  const comparisonURL=await copy(page);
  await restored(other,comparisonURL,comparisonAt,'svg');
  assert.equal(await other.locator('#evidence-return').isVisible(),true);
  console.log('ok moment/tick selection and exact comparison clip sharing');

  for(const mutation of [['replayKey','outdated'],['event','unknown'],['cue','unknown-cue']]) {
    const url=new URL(mutation[0]==='cue'?cueURL:shared);url.searchParams.set(...mutation);
    await other.goto(url.href,{waitUntil:'networkidle'});
    await other.locator('#shared-position-error').waitFor({state:'visible'});
    assert.equal(Number(await other.locator('.pitch-shell').getAttribute('data-time-ms')),replay.match.startMs);
    assert.notEqual(await other.locator('.pitch-shell').getAttribute('data-playback-state'),'playing');
  }
  await other.close();await page.close();

  for(const [width,height] of [[1440,900],[390,844],[320,740],[844,390]]) {
    for(const view of width===844?['three']:['three','pixi','svg']) {
      const page=await makePage(width,height);
      await page.goto(`${base}/?scenario=late-siege&view=${view}`,{waitUntil:'networkidle'});await pause(page);await inspect(page,shot.id);
      if(view!=='svg') await page.locator('#canvas-host canvas').evaluate(canvas=>canvas.dataset.identity='same-renderer');
      await page.locator('#broadcast-toggle').click();
      await page.waitForFunction(()=>document.body.dataset.broadcast==='true');await nextFrames(page);
      assert.equal(await page.locator('#broadcast-caption').isVisible(),true);
      assert.equal(await page.locator('#broadcast-status').getAttribute('aria-label'),'Verified (recorded)');
      assert.equal(await page.locator('#broadcast-text').textContent(),open.response.draft.text);
      const bounds=await page.evaluate(()=>{
        const shell=document.querySelector('.pitch-shell').getBoundingClientRect(),caption=document.querySelector('#broadcast-caption').getBoundingClientRect(),transport=document.querySelector('.transport').getBoundingClientRect(),hud=document.querySelector('.broadcast-hud').getBoundingClientRect();
        return {width:innerWidth,height:innerHeight,shell:{x:shell.x,y:shell.y,w:shell.width,h:shell.height},caption:{top:caption.top,bottom:caption.bottom,right:caption.right},transportTop:transport.top,hudBottom:hud.bottom};
      });
      assert.ok(Math.abs(bounds.shell.w-bounds.width)<=1 && Math.abs(bounds.shell.h-bounds.height)<=1,JSON.stringify(bounds));
      assert.ok(bounds.caption.bottom<=bounds.transportTop-4 && bounds.caption.top>=bounds.hudBottom,`broadcast overlays overlap: ${JSON.stringify(bounds)}`);
      assert.ok(bounds.caption.right<=bounds.width);
      if(view!=='svg') {
        const canvas=page.locator('#canvas-host canvas');assert.equal(await canvas.getAttribute('data-identity'),'same-renderer');
        const pixels=await canvas.evaluate(canvas=>{const gl=canvas.getContext('webgl2')??canvas.getContext('webgl'),data=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,data);let grass=0;for(let i=0;i<data.length;i+=4)if(data[i+1]>60&&data[i+1]>data[i]*1.15&&data[i+1]>data[i+2]*1.15)grass++;return grass;});
        assert.ok(pixels>1000,'fullscreen pitch must render real canvas pixels');
      }
      await page.screenshot({path:path.join(output,`broadcast-${view}-${width}.png`)});
      const broadcastURL=await copy(page);assert.equal(new URL(broadcastURL).searchParams.get('broadcast'),'1');
      if(width===1440) {
        const before=Number(await page.locator('.pitch-shell').getAttribute('data-time-ms'));
        await page.locator('#play-button').click();await page.waitForTimeout(600);await pause(page);
        assert.ok(Number(await page.locator('.pitch-shell').getAttribute('data-time-ms'))>before+200,'broadcast must advance the same replay clock');
        await seek(page,750);
        assert.equal(await page.locator('#broadcast-caption').isVisible(),false,'explanation must expire on the match clock');
        await seek(page,0);assert.equal(await page.locator('#broadcast-caption').isVisible(),false,'rewind must hide future explanations');
        await seek(page,1000);assert.equal(await page.locator('#broadcast-text').textContent(),'Sequence complete');
      }
      await page.locator('#broadcast-exit').click();
      assert.equal(await page.locator('body').getAttribute('data-broadcast'),null);
      assert.equal(await page.locator('.experience-nav').getAttribute('inert'),null);
      await seek(page,1000);await inspect(page,shot.id);await page.locator('#broadcast-toggle').click();
      await page.keyboard.press('Escape');
      await page.waitForFunction(()=>document.body.dataset.broadcast!=='true');
      if(width===1440 && view==='svg') {
        const newPage=await makePage();await restored(newPage,broadcastURL,shot.timeMs,'svg');
        assert.equal(await newPage.locator('body').getAttribute('data-broadcast'),'true');
        await newPage.locator('#fullscreen-button').click();
        await newPage.keyboard.press('Escape');
        await newPage.waitForFunction(()=>document.body.dataset.broadcast!=='true');
        await newPage.locator('#broadcast-toggle').click();
        await newPage.locator('#broadcast-exit').click();await newPage.close();
      }
      console.log(`ok broadcast ${view} ${width}x${height}: same pitch, timed verified overlay, controls and exit`);
      await page.close();
    }
  }
  const fallback=await makePage(390,844,false);
  await fallback.goto(`${base}/?scenario=corner&view=svg`,{waitUntil:'networkidle'});await pause(fallback);
  await fallback.locator('#share-button').click();
  await fallback.locator('#share-link-dialog').waitFor({state:'visible'});
  assert.equal(new URL(await fallback.locator('#share-link-value').inputValue()).searchParams.get('scenario'),'corner');
  await fallback.close();
  const insecure=await makePage();
  await insecure.addInitScript(()=>{Object.defineProperty(globalThis,'crypto',{value:{},configurable:true});});
  await insecure.goto(`${base}/?scenario=corner&view=svg`,{waitUntil:'networkidle'});
  assert.ok(await insecure.locator('#share-button').isDisabled());
  assert.equal(await insecure.locator('#pitch-error').isVisible(),false,'missing WebCrypto must not break ordinary replay');
  await pause(insecure);await insecure.close();
  assert.deepEqual(errors,[]);
  console.log(`PASS recorded pattern, exact event/cue/moment/window links, stale-link rejection, clipboard fallback and broadcast renderers across desktop/mobile/landscape. Screenshots: ${output}`);
} finally {await browser.close();}
