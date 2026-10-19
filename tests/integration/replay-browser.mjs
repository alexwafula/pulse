import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.env.PULSE_URL ?? "http://127.0.0.1:8080";
const executablePath = process.env.CHROME_PATH ?? (process.platform === "linux" ? "/usr/bin/chromium-browser" : "C:/Program Files/Google/Chrome/Application/chrome.exe");
const output = path.join(os.tmpdir(), "pulse-replay-alignment");
fs.mkdirSync(output, {recursive:true});
const browser = await chromium.launch({executablePath, headless:true});
const errors = [];
const seek = (page, value) => page.locator("#seek").evaluate((input, value) => {input.value=String(value); input.dispatchEvent(new Event("input", {bubbles:true}));}, value);
const pause = async page => {if (await page.locator("#play-button").getAttribute("aria-label") === "Pause") await page.locator("#play-button").click();};
const inspect = (page, eventId) => page.evaluate(eventId => document.dispatchEvent(new CustomEvent("pulse:inspect", {detail:{eventId}})), eventId);
const section = (page, value) => page.locator(`.experience-navigation [data-section="${value}"]`).click();
const nextFrames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

async function assertSource(page, replay, event) {
  assert.equal(await page.locator("body").getAttribute("data-section"), "live");
  assert.equal(Number(await page.locator(".pitch-shell").getAttribute("data-time-ms")), event.timeMs);
  assert.equal(await page.locator(".pitch-shell").getAttribute("data-event-id"), event.id);
  assert.equal(await page.locator("#play-button").getAttribute("aria-label"), "Play");
  assert.equal(await page.locator('#event-list button[aria-current="true"]').count(), 1);
  assert.ok((await page.locator('#event-list button[aria-current="true"]').getAttribute("class")).includes("evidence-event"));
  assert.equal(await page.locator('[data-speed="1"]').getAttribute("aria-pressed"), "true");
  assert.ok(await page.locator('[data-speed="4"]').isDisabled());
  const first = replay.tracking.filter(frame => frame.timeMs <= event.timeMs).at(-1);
  const second = replay.tracking.find(frame => frame.timeMs > event.timeMs) ?? first;
  const fraction = second.timeMs > first.timeMs ? (event.timeMs-first.timeMs)/(second.timeMs-first.timeMs) : 0;
  const x = first.ball.x+(second.ball.x-first.ball.x)*fraction;
  const y = first.ball.y+(second.ball.y-first.ball.y)*fraction;
  assert.ok(Math.abs(Number(await page.locator("#ball").getAttribute("cx")) - (32+x/105*986)) < .0001);
  assert.ok(Math.abs(Number(await page.locator("#ball").getAttribute("cy")) - (20+(1-y/68)*640)) < .0001);
  await page.waitForTimeout(150);
  assert.equal(Number(await page.locator(".pitch-shell").getAttribute("data-time-ms")), event.timeMs, "inspection must stay on its exact source until Play");
}

try {
  // Every scenario, including 1 ms event times between 5 Hz tracking samples.
  const sources = await browser.newPage({viewport:{width:1440,height:1000}});
  sources.on("pageerror", error => errors.push(error.message));
  for (const scenario of ["corner", "central", "exchange", "late-siege", "calm-midfield"]) {
    await sources.goto(`${base}/?scenario=${scenario}&view=svg`, {waitUntil:"networkidle"});
    await pause(sources); await seek(sources, 1000);
    const replay = await (await sources.request.get(`${base}/api/replay?scenario=${scenario}`)).json();
    for (const event of [replay.events.at(-1), replay.events[0], ...replay.events.filter(event => event.timeMs%200 !== 0).slice(0,3)]) {
      await section(sources, "insights");
      await inspect(sources, event.id);
      await assertSource(sources, replay, event);
    }
    const before = await sources.locator(".pitch-shell").getAttribute("data-time-ms");
    await inspect(sources, "not-a-real-event");
    assert.equal(await sources.locator(".pitch-shell").getAttribute("data-time-ms"), before, "unknown evidence cannot seek an unrelated event");
    await seek(sources, 1000);
    assert.equal(await sources.locator("#playback-heading").textContent(), "Sequence complete");
    assert.ok(await sources.locator("#sequence-actions").isVisible());
    await sources.locator("#sequence-recap").click();
    assert.equal(await sources.locator("body").getAttribute("data-section"), "recap");
    await sources.locator('.story-content[data-panel="recap"]').waitFor();
    await section(sources, "live");
    await sources.locator("#sequence-scenarios").click();
    assert.ok(await sources.locator("#scenario-dialog").isVisible());
    await sources.locator("#scenario-library-close").click();
    await sources.locator("#sequence-restart").click();
    assert.equal(await sources.locator("body").getAttribute("data-section"), "live");
    assert.equal(await sources.locator("#play-button").getAttribute("aria-label"), "Pause");
    await pause(sources);
    assert.equal(await sources.locator("#playback-status").isVisible(), false);
    console.log(`ok ${scenario}: exact source timestamps/positions and scenario completion`);
  }
  // Actual delegated Story/pass/fact-check clicks, not just the public event API.
  await sources.goto(`${base}/?scenario=corner&view=svg`, {waitUntil:"networkidle"});
  await pause(sources); await seek(sources,1000);
  const corner = await (await sources.request.get(`${base}/api/replay?scenario=corner`)).json();
  await section(sources,"story");
  const source = sources.locator('[data-inspect-event]').first();
  await source.waitFor();
  const sourceId = await source.getAttribute('data-inspect-event');
  await source.click();
  await assertSource(sources,corner,corner.events.find(event=>event.id===sourceId));
  await seek(sources,1000);
  await sources.locator('.drawer-tab[data-tab="passing"]').click();
  await sources.locator('.passing-snapshot:not([hidden]) [data-pass-evidence]').first().click();
  await assertSource(sources,corner,corner.events[0]);
  await seek(sources,1000);
  await sources.locator('#fact-check > summary').click();
  await sources.locator('#fact-check [data-fact-source]').first().click();
  await assertSource(sources,corner,corner.events.find(event=>event.id==="evt-06"));
  await seek(sources,1000);
  const factBounds = await sources.locator("#insight-window").textContent();
  await sources.locator("#evidence-button").click();
  await sources.waitForFunction(() => document.querySelector("#playback-status")?.dataset.state === "clip-complete", null, {timeout:15000});
  assert.equal(await sources.locator("#match-clock").textContent(), "28:00");
  assert.equal(await sources.locator("#insight-window").textContent(), factBounds);
  assert.match(await sources.locator("#playback-detail").textContent(), /Recorded movement continues to 28:00/);
  await sources.screenshot({path:path.join(output,"corner-complete.png"),fullPage:true});
  await seek(sources,0);
  await sources.locator('[data-speed="4"]').click();
  const timing = await sources.evaluate(async () => {
    const next = () => new Promise(resolve=>requestAnimationFrame(resolve));
    document.querySelector('#play-button').click();
    await next(); await next();
    const before = Number(document.querySelector('.pitch-shell').dataset.timeMs), start=performance.now();
    while(performance.now()-start<650) { /* Reproduce a slow visible frame. */ }
    await next(); await next();
    const advanced=Number(document.querySelector('.pitch-shell').dataset.timeMs)-before, elapsed=performance.now()-start;
    document.querySelector('#play-button').click();
    return {advanced,elapsed};
  });
  assert.ok(Math.abs(timing.advanced-timing.elapsed*4)<250, `visible replay must not discard stalled-frame time: ${JSON.stringify(timing)}`);
  console.log('ok delegated Story/pass/fact evidence, recorded shot postroll and measured slow-frame clock');
  await sources.close();

  for (const width of [1440,390,320]) {
    for (const view of ["three", "pixi", "svg"]) {
      const page = await browser.newPage({viewport:{width,height:1000}});
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(`${base}/?scenario=late-siege&view=${view}`, {waitUntil:"networkidle"});
      await pause(page); await seek(page,1000);
      const replay = await (await page.request.get(`${base}/api/replay?scenario=late-siege`)).json();
      if (view !== "svg") await page.locator("#canvas-host canvas").evaluate(canvas=>canvas.dataset.identity="same-pitch");
      await section(page,"insights");
      const shot = replay.events.at(-1);
      await inspect(page,shot.id);
      await assertSource(page,replay,shot);
      await nextFrames(page);
      let before;
      if (view !== "svg") {
        const canvas=page.locator("#canvas-host canvas");
        assert.equal(await canvas.getAttribute("data-identity"), "same-pitch", "navigation must preserve the renderer");
        const pixels = await canvas.evaluate(canvas => {
          const gl=canvas.getContext("webgl2") ?? canvas.getContext("webgl");
          const data=new Uint8Array(canvas.width*canvas.height*4);
          gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,data);
          let grass=0; for(let i=0;i<data.length;i+=4) if(data[i+1]>60 && data[i+1]>data[i]*1.15 && data[i+1]>data[i+2]*1.15) grass++;
          return grass;
        });
        assert.ok(pixels>1000, `${view} remounted scene must draw real pitch pixels immediately`);
        before=await canvas.evaluate(canvas=>canvas.toDataURL());
      }
      await page.locator("#play-button").click();
      await page.waitForFunction(() => document.querySelector("#playback-status")?.dataset.state === "clip-complete", null, {timeout:10000});
      assert.ok(Number(await page.locator(".pitch-shell").getAttribute("data-time-ms")) < replay.match.endMs-10000, "single action replay must not idle until match end");
      if(view!=="svg") assert.notEqual(await page.locator("#canvas-host canvas").evaluate(canvas=>canvas.toDataURL()),before, "shot replay must visibly move");
      await page.locator("#play-button").click(); await pause(page);
      assert.ok(Number(await page.locator(".pitch-shell").getAttribute("data-time-ms")) < shot.timeMs+1500, "replaying a completed clip resets its time anchor");
      await page.locator("#evidence-return").click();
      assert.equal(Number(await page.locator(".pitch-shell").getAttribute("data-time-ms")),replay.match.endMs);
      await seek(page,700);
      assert.equal(await page.locator("#playback-heading").textContent(),"All actions recorded");
      assert.match(await page.locator("#playback-detail").textContent(),/Tracking continues/);
      await page.locator("#playback-status").scrollIntoViewIfNeeded();
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.screenshot({path:path.join(output,`tail-${view}-${width}.png`),fullPage:true});
      await seek(page,1000);
      await page.locator("#playback-status").scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(output,`complete-${view}-${width}.png`),fullPage:true});
      console.log(`ok ${view} ${width}px: rendered shot replay, return and tail/completion states`);
      await page.close();
    }
  }
  assert.deepEqual(errors,[]);
  console.log(`PASS exact source times/positions in all five scenarios, Story/pass/fact evidence, complete shot postroll, replay/return, visible mounted scenes and explicit endings across SVG/Three/Pixi desktop/mobile. Screenshots: ${output}`);
} finally {await browser.close();}
