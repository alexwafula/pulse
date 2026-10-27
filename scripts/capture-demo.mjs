// Capture real local UI with English captions. Never run against live model mode.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.env.PULSE_URL ?? "http://127.0.0.1:8080";
const agents = process.env.PULSE_AGENT_URL ?? "http://127.0.0.1:8090";
for (const address of [base, agents]) {
  const url = new URL(address);
  assert.equal(url.protocol, "http:");
  assert.equal(url.hostname, "127.0.0.1", "Record only the local reviewed setup");
  assert.ok(!url.username && !url.password && !url.search && !url.hash);
}
assert.equal((await (await fetch(`${agents}/healthz`)).json()).mode, "recorded");
const feed = await fetch(`${base}/api/insights?scenario=corner&persona=CASUAL&locale=en-GB`);
assert.equal(feed.headers.get("X-Pulse-Insight-Source"), "python-recorded");
assert.equal((await feed.json()).cues[0].verification.status, "VERIFIED");
const output = path.resolve("docs/media/demo-draft");
await fs.mkdir(output, {recursive:true});
const executablePath = process.env.CHROME_PATH ?? (process.platform === "linux" ? "/usr/bin/chromium-browser" : "C:/Program Files/Google/Chrome/Application/chrome.exe");
const browser = await chromium.launch({executablePath, headless:true});
const context = await browser.newContext({viewport:{width:1440,height:1000}, deviceScaleFactor:1,
  recordVideo:{dir:output,size:{width:1440,height:1000}}});
const page = await context.newPage();
const video = page.video();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const started = Date.now();
const scenes = [];
let success = false;
try {
  // The caption band belongs to the video, not to the application.
  await page.goto(`${base}/healthz`);
  await page.setContent(`<!doctype html><html lang="en"><head><title>Pulse demo draft</title><style>
    *{box-sizing:border-box}body{margin:0;background:#fff;font-family:Arial,sans-serif}
    iframe{width:1440px;height:908px;border:0;display:block}
    footer{height:92px;padding:16px 28px;background:#172b35;color:#fff;display:grid;gap:6px}
    strong{font-size:19px;line-height:24px;font-weight:600}small{font-size:13px;color:#d0e2e9}
    </style></head><body><iframe title="Actual Pulse application"></iframe><footer>
    <strong id="caption">Pulse: football insights you can inspect.</strong>
    <small>Local demo draft | Fictional replay | Recorded / template output | No fresh model calls</small>
    </footer></body></html>`);
  const app = () => page.frames().find(frame => frame.parentFrame());
  const caption = async (text, holdMs = 5500) => {
    await page.locator("#caption").textContent();
    await page.locator("#caption").evaluate((node, text) => {node.textContent=text;}, text);
    scenes.push({atMs:Date.now()-started, text});
    // These holds are intentional reading time in the video, not test waits.
    await page.waitForTimeout(holdMs);
  };
  const pause = async () => {if(await app().locator("#play-button").getAttribute("aria-label")==="Pause") await app().locator("#play-button").click();};
  const seek = async value => app().locator("#seek").evaluate((node,value)=>{node.value=String(value);node.dispatchEvent(new Event("input",{bubbles:true}));},value);
  const section = async name => app().locator(`.experience-navigation [data-section="${name}"]`).click();
  const open = async scenario => {
    await page.locator("iframe").evaluate((frame,src)=>{frame.src=src;}, `${base}/?scenario=${scenario}&view=three&locale=en-GB&persona=CASUAL`);
    await app().waitForURL(url=>url.pathname==="/" && url.searchParams.get("scenario")===scenario);
    await page.waitForFunction(() => document.querySelector("iframe")?.contentDocument?.querySelector("#canvas-host canvas"));
    await app().waitForFunction(()=>document.querySelector(".pitch-shell")?.dataset.renderer==="three" && document.querySelectorAll("#event-list button").length>0);
  };
  await open("end-to-end");
  await caption("Pulse turns synthetic 11v11 football replays into explainable, verifiable match stories.", 5500);
  await pause();
  const e2eReplay = await (await fetch(`${base}/api/replay?scenario=end-to-end`)).json();
  const shotIndex = e2eReplay.events.findIndex(event => event.type === "SHOT");
  const firstShot = e2eReplay.events[shotIndex];
  await app().locator("#event-list button").nth(shotIndex).click();
  await app().locator("#shot-lens:not([hidden])").waitFor({state:"visible"});
  await app().locator("#spotlight-toggle").check();
  await app().locator("#spotlight-player").selectOption(firstShot.actorId, {force:true});
  await app().locator("#match-lab").scrollIntoViewIfNeeded();
  await caption("Read the game: Go calculates Shot Lens geometry and an 8-second Player Spotlight trail.", 5500);
  await open("late-siege");
  await pause(); await seek(1000);
  await app().waitForFunction(()=>document.querySelector("#insight-status")?.getAttribute("aria-label")==="Verified (recorded)");
  await app().locator("#agent-inspector > summary").click();
  await app().locator(".inspection-reference summary").click();
  await app().locator("#agent-inspector").scrollIntoViewIfNeeded();
  await caption("Late siege: a checked open-play pass-count insight with captured 3-role Foundry provenance.", 5500);
  await app().locator('.drawer-tab[data-tab="control"]').click();
  await app().locator('[data-moment-type="SUSTAINED_PRESSURE"]').first().click();
  await pause();
  await app().locator("#pressure-insight").waitFor({state:"visible"});
  await caption("Go detects sustained pressure from source events and ticks—explicitly labelled as a template.", 5500);
  await app().getByRole("button",{name:"Analyst",exact:true}).click();
  await app().locator("#pressure-heading").scrollIntoViewIfNeeded();
  await caption("Analyst exposes the action count, model estimate and source window. Tracking is uncalibrated.", 5000);
  await app().locator("#evidence-return").click();
  await section("insights");
  await app().locator('[data-graphic="chart"][data-ready="true"]').first().waitFor({state:"visible"});
  await caption("Charts use Go-calculated replay data. Rewinding also rewinds the statistics.", 5000);
  await app().getByRole("button",{name:"Pitch maps",exact:true}).click();
  await app().locator('[data-graphic="map"][data-ready="true"]').waitFor({state:"visible"});
  await app().locator(".map-art").scrollIntoViewIfNeeded();
  await caption("Heatmaps show recorded player-time, not touches, possession or measured pressure.", 5000);
  await app().locator('[data-insight-view="comparison"]').click();
  await app().locator('select[name="windowMs"]').evaluate(node=>{node.value="20000";node.dispatchEvent(new Event("change",{bubbles:true}));});
  await app().waitForFunction(()=>document.querySelectorAll(".comparison-window").length===2);
  await app().locator(".comparison").scrollIntoViewIfNeeded();
  await caption("What changed? compares adjacent 20-second source-event windows with pitch diagrams.", 5500);
  await section("live");
  await app().getByRole("button",{name:"Casual",exact:true}).click();
  await open("corner"); await pause(); await seek(1000);
  await app().waitForFunction(()=>document.querySelector("#insight-status")?.getAttribute("aria-label")==="Verified (recorded)");
  await caption("The corner insight is a checked recording. The public demo makes no fresh model calls.", 5000);
  await app().locator("#fact-check summary").click();
  await app().locator("#agent-inspector > summary").click();
  await app().locator(".inspection-safety > summary").click();
  await app().getByRole("button",{name:"Show test result",exact:true}).click();
  await app().locator(".inspection-safety").scrollIntoViewIfNeeded();
  await caption("Fact check and Safety test: the Go cue gate rejects an injected bad claim and falls back safely.", 5500);
  await app().locator("#evidence-button").click();
  await app().locator(".pitch-shell").scrollIntoViewIfNeeded();
  await caption("Evidence replays the recorded corner and shot on the same match clock.", 5000);
  await app().locator("#evidence-return").click();
  await app().locator("#broadcast-toggle").click();
  await app().waitForFunction(()=>document.body.dataset.broadcast==="true");
  await caption("Broadcast mode expands the pitch with match-timed, provenance-labelled captions.", 5000);
  await app().locator("#broadcast-exit").click();
  await app().getByRole("button",{name:"Analyst",exact:true}).click();
  await app().waitForFunction(()=>document.querySelector("#insight-status")?.getAttribute("aria-label")==="Template");
  await app().locator(".insight-panel").scrollIntoViewIfNeeded();
  await caption("Casual and Analyst adapt the wording, not the facts. Analyst uses a deterministic template.", 5000);
  await app().locator("#locale").evaluate(node=>{node.value="sw-KE";node.dispatchEvent(new Event("change",{bubbles:true}));});
  await app().waitForFunction(()=>document.body.dataset.locale==="sw-KE");
  await caption("Kiswahili and Hindi interface and template options use deterministic source facts.", 5000);
  await app().locator("#locale").evaluate(node=>{node.value="en-GB";node.dispatchEvent(new Event("change",{bubbles:true}));});
  await section("recap");
  await app().locator('[data-download-recap]').waitFor({state:"visible"});
  await caption("A deterministic recap keeps event evidence and downloads as text. No invented match result.", 5000);
  await caption("Go + Python agents + HTMX + TypeScript. Azure Container Apps hosting and Microsoft Foundry.", 5500);
  assert.deepEqual(errors,[]);
  assert.ok(Date.now()-started<115000,"Recording took too long; rerun on an idle machine");
  success=true;
} finally {
  await context.close();
  if (success) {
    const destination=path.join(output,"pulse-demo.webm");
    await video.saveAs(destination);
    const raw=await video.path();
    if(raw!==destination) await fs.unlink(raw);
    await fs.writeFile(path.join(output,"capture.json"),JSON.stringify({
      status:"READY_FOR_HUMAN_SIGNOFF",capturedAt:new Date().toISOString(),
      elapsedMs:Date.now()-started,localSource:base,agentMode:"recorded",scenes,
      limits:["No fresh model calls in recorded mode","Original Oct 13 corner provider provenance reproduced via Oct 19 reference run; Oct 19 open-play capture retains original provider IDs"]
    },null,2)+"\n");
    console.log(`Recorded actual local UI: ${destination}`);
  }
  await browser.close();
}
