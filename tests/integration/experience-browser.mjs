import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright-core";

const require = createRequire(import.meta.url);
const { PNG } = require(path.join(path.dirname(require.resolve("playwright-core/package.json")), "lib/utilsBundle.js"));
const base = process.env.PULSE_URL ?? "http://127.0.0.1:8080";
const source = process.env.PULSE_INSIGHT_SOURCE ?? "python-template";
assert.ok(["python-template", "python-recorded"].includes(source), "Use a template or recorded service; this suite must not generate paid workflows.");
const cornerStatus = source === "python-recorded" ? "Verified (recorded)" : "Template";
const executablePath = process.env.CHROME_PATH ?? (process.platform === "linux" ? "/usr/bin/chromium-browser" : "C:/Program Files/Google/Chrome/Application/chrome.exe");
const output = process.env.PULSE_SCREENSHOTS ?? path.join(os.tmpdir(), "pulse-experience-preview");
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });
const errors = [];
const seek = async (page, value) => page.locator("#seek").evaluate((input, value) => { input.value = String(value); input.dispatchEvent(new Event("input", { bubbles: true })); }, value);
const pause = async page => { if (await page.locator("#play-button").getAttribute("aria-label") === "Pause") await page.locator("#play-button").click(); };
const section = async (page, name) => page.locator(`.experience-navigation [data-section="${name}"]`).click();
const panelAt = async (page, at) => page.waitForFunction(at => document.querySelector(".story-content")?.getAttribute("data-time-ms") === String(at) && document.querySelector(".story-content")?.getAttribute("data-panel") === document.querySelector('#experience-inputs [name="panel"]')?.value, at);
const clock = ms => `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
async function select2(page, selector, value) {
  const name=await page.locator(`${selector} option[value="${value}"]`).textContent();
  await page.locator(`${selector} + .select2-container .select2-selection`).click();
  await page.getByRole("option",{name,exact:true}).click();
}

async function storyAndMaps(page, replay, mobile) {
  await section(page, "story");
  await seek(page, 450);
  const at = Math.floor(replay.match.startMs + .45 * (replay.match.endMs - replay.match.startMs));
  await panelAt(page, at);
  const elapsed = replay.events.filter(event => event.timeMs <= at);
  const ids = () => page.locator("[data-story-event]").evaluateAll(items => items.map(item => item.dataset.storyEvent));
  await page.getByRole("button", { name: "Catch up", exact: true }).click();
  await page.waitForFunction(() => document.querySelector(".story-content")?.dataset.storyMode === "catchup");
  assert.deepEqual(await ids(), elapsed.map(event => event.id));
  await page.getByRole("button", { name: "Highlights", exact: true }).click();
  await page.waitForFunction(() => document.querySelector(".story-content")?.dataset.storyMode === "highlights");
  assert.deepEqual(await ids(), elapsed.filter(event => ["SHOT", "CORNER", "CROSS"].includes(event.type)).map(event => event.id));
  await page.getByRole("button", { name: "Player focus", exact: true }).click();
  const player = replay.match.players.find(player => player.id === elapsed.at(-1).actorId);
  await select2(page, 'select[name="playerId"]', player.id);
  await page.waitForFunction(name => document.querySelector(".story-content h3")?.textContent === name, player.name);
  const involved = elapsed.filter(event => event.actorId === player.id || event.recipientId === player.id);
  assert.deepEqual(await ids(), involved.map(event => event.id));
  assert.equal(await page.locator(".player-story-summary dd").first().textContent(), String(involved.length));
  await page.getByRole("button", { name: "Analyst", exact: true }).click();
  await page.waitForFunction(() => document.querySelector(".story-content")?.dataset.persona === "ANALYST");
  assert.equal(await page.locator(".story-details").count(), involved.length);
  await page.screenshot({ path: path.join(output, `${mobile ? "mobile" : "desktop"}-player-story.png`), fullPage: true });
  await page.getByRole("button", { name: "Casual", exact: true }).click();
  await page.waitForFunction(() => document.querySelector(".story-content")?.dataset.persona === "CASUAL");
  assert.equal(await page.locator(".story-details").count(), 0);
  await page.getByRole("button", { name: "Live story", exact: true }).click();
  await section(page, "insights");
  await panelAt(page, at);
  assert.equal(await page.locator("#workspace-title").textContent(), "Insights");
  await page.locator('[data-graphic="chart"][data-ready="true"]').first().waitFor({state:"visible"});
  const chartPixels = PNG.sync.read(await page.locator('[data-graphic="chart"]').first().screenshot());
  let chartColor = 0;
  for (let index = 0; index < chartPixels.data.length; index += 16) {
    const [r,g,b] = chartPixels.data.subarray(index,index+3);
    if ((r > 150 && g < 130 && b < 160) || (b > 140 && b > r*1.2 && b > g*1.1)) chartColor++;
  }
  assert.ok(chartColor > 30, "chart canvas must visibly render source-backed team paths");
  await page.screenshot({ path: path.join(output, `${mobile ? "mobile" : "desktop"}-prototype-graphs.png`), fullPage: true });
  for (const [name, predicate] of [["Completed passes", event => event.type === "PASS" && event.outcome === "COMPLETE"], ["Shot attempts", event => event.type === "SHOT"]]) {
    const figure = page.locator(`[data-chart="${name}"]`);
    for (const [index, team] of replay.match.teams.entries()) assert.equal(Number(await figure.getAttribute(index === 0 ? "data-home" : "data-away")), elapsed.filter(event => event.teamId === team.id && predicate(event)).length);
  }
  await page.getByRole("button", { name: "Pitch maps", exact: true }).click();
  await page.waitForFunction(() => document.body.dataset.insightView === "maps");
  await page.locator('[data-graphic="map"][data-ready="true"]').waitFor({state:"visible"});
  for (const team of replay.match.teams) {
    await select2(page, 'select[name="teamId"]', team.id);
    await page.waitForFunction(teamId => document.querySelector(".pitch-map")?.getAttribute("data-map-team") === teamId, team.id);
    const count = replay.match.players.filter(player => player.teamId === team.id).length;
    assert.equal(Number(await page.locator("[data-total-player-seconds]").getAttribute("data-total-player-seconds")), Number((count * (at - replay.match.startMs) / 1000).toFixed(1)));
    assert.ok(await page.locator(".heat-cells rect").count() > 0);
  }
  const mapPixels = PNG.sync.read(await page.locator('[data-graphic="map"]').screenshot());
  let warmCells = 0;
  for (let index = 0; index < mapPixels.data.length; index += 16) {
    const [r, g, b] = mapPixels.data.subarray(index, index + 3);
    if (r > 150 && g > 130 && b < g * .8) warmCells++;
  }
  assert.ok(warmCells > 30, "heatmap cells must visibly render over the pitch");
  const heatTarget = await page.locator(".heat-cells rect").first().evaluate(cell => ({
    x: Number(cell.getAttribute("x")) + 2.5, y: Number(cell.getAttribute("y")) + 2,
    key: cell.dataset.mapKey, text: cell.querySelector("title").textContent
  }));
  const tapMap = async target => {
    await page.locator('[data-graphic="map"]').evaluate(canvas => canvas.scrollIntoView({block:"center"}));
    const bounds = await page.locator('[data-graphic="map"]').boundingBox();
    const x = bounds.x + (target.x + 2) / 109 * bounds.width, y = bounds.y + (target.y + 2) / 72 * bounds.height;
    if (mobile) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
  };
  await tapMap(heatTarget);
  assert.equal(await page.locator("#map-selection").inputValue(), heatTarget.key);
  assert.equal(await page.locator("#map-detail").textContent(), heatTarget.text);
  assert.equal(await page.locator(".map-inspector-evidence button").count(), 0, "occupancy must not invent event evidence");
  await page.locator("#map-selection + .select2-container .select2-selection").click();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  assert.notEqual(await page.locator("#map-selection").inputValue(), "", "heat cells must be keyboard selectable");
  await page.screenshot({ path: path.join(output, `${mobile ? "mobile" : "desktop"}-charts-heatmap.png`), fullPage: true });
  await page.getByRole("button", { name: "Pass network", exact: true }).click();
  await page.waitForFunction(() => document.querySelector(".story-content")?.dataset.mapMode === "network");
  assert.ok(await page.locator(".network-node").count() > 0);
  assert.ok(await page.locator(".network-evidence [data-inspect-event]").count() > 0);
  const nodeTarget = await page.locator(".network-node").first().evaluate(node => ({
    x: Number(node.dataset.x), y: Number(node.dataset.y), key: node.dataset.mapKey,
    id: node.dataset.playerId, text: node.querySelector("title").textContent
  }));
  await tapMap(nodeTarget);
  assert.equal(await page.locator("#map-selection").inputValue(), nodeTarget.key);
  assert.equal(await page.locator("#map-detail").textContent(), nodeTarget.text);
  const playerEvidence = elapsed.filter(event => event.teamId === replay.match.teams[1].id && event.type === "PASS" && event.outcome === "COMPLETE" && (event.actorId === nodeTarget.id || event.recipientId === nodeTarget.id));
  assert.deepEqual(await page.locator(".map-inspector-evidence [data-inspect-event]").evaluateAll(items => items.map(item => item.dataset.inspectEvent)), playerEvidence.map(event => event.id));
  await page.locator("#map-selection + .select2-container .select2-selection").click();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  assert.notEqual(await page.locator("#map-detail").textContent(), "", "network inspection must be keyboard accessible");
  await page.screenshot({ path: path.join(output, `${mobile ? "mobile" : "desktop"}-pitch-network.png`), fullPage: true });
  await page.getByRole("button", { name: "Heatmap", exact: true }).click();
  await page.waitForFunction(() => document.querySelector(".story-content")?.dataset.mapMode === "occupancy");
  await seek(page, 0); await panelAt(page, replay.match.startMs);
  assert.equal(await page.locator(".heat-cells rect").count(), 0);
  assert.equal(await page.locator("[data-total-player-seconds]").getAttribute("data-total-player-seconds"), "0.0");
  await seek(page, 1000); await panelAt(page, replay.match.endMs);
  await page.getByRole("button", { name: "Shots", exact: true }).click();
  await page.waitForFunction(() => document.querySelector(".story-content")?.dataset.mapMode === "shots");
  const team = replay.match.teams.find(team => replay.events.some(event => event.type === "SHOT" && event.teamId === team.id));
  await select2(page, 'select[name="teamId"]', team.id);
  await page.waitForFunction(teamId => document.querySelector(".pitch-map")?.getAttribute("data-map-team") === teamId, team.id);
  const shots = replay.events.filter(event => event.type === "SHOT" && event.teamId === team.id);
  assert.deepEqual(await page.locator("[data-shot-event]").evaluateAll(items => items.map(item => item.dataset.shotEvent)), shots.map(event => event.id));
  for (const event of shots) {
    const point = page.locator(`[data-shot-event="${event.id}"]`);
    assert.equal(Number(await point.getAttribute("cx")), event.from.x);
    assert.equal(Number(await point.getAttribute("cy")), 68-event.from.y);
  }
  await page.screenshot({ path: path.join(output, `${mobile ? "mobile" : "desktop"}-shot-map.png`), fullPage: true });
  await tapMap({x: shots[0].from.x, y: 68-shots[0].from.y});
  await page.waitForFunction(expected => document.body.dataset.section === "live" && document.querySelector("#match-clock")?.textContent === expected, clock(shots[0].timeMs));
  assert.equal(await page.locator("#match-clock").textContent(),clock(shots[0].timeMs),"click or tap on a source shot must open its evidence");
  await section(page,"insights");
  await page.getByRole("button",{name:"Pitch maps",exact:true}).click();
  await page.waitForFunction(() => document.querySelector(".story-content")?.dataset.mapMode === "shots");
  await page.locator(".shot-evidence [data-inspect-event]").first().click();
  assert.equal(await page.locator("#match-clock").textContent(), clock(shots[0].timeMs));
  assert.equal(await page.locator("#play-button").getAttribute("aria-label"), "Play");
  await section(page, "insights");
  // The map's Passing network link is gone (D4b-2); the Passing detail chip opens the same pane.
  await page.getByRole("button", { name: "Passing detail", exact: true }).click();
  assert.ok(await page.locator("#pane-passing").isVisible());
  await page.getByRole("button", { name: "Charts & maps", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("#experience-panel")?.hidden === false);
  await page.getByRole("button", { name: "Pitch maps", exact: true }).click();
  await page.getByRole("button", { name: "Heatmap", exact: true }).click();
  await page.waitForFunction(() => document.querySelector(".story-content")?.dataset.mapMode === "occupancy");
  assert.equal(await page.locator("#canvas-host canvas").getAttribute("data-identity"), "persistent", "Story modes, charts and maps must preserve the pitch");
  await page.locator("#watch-toggle").click();
  await pixels(page.locator("#canvas-host canvas"), `${mobile}-mini-player`);
  await page.locator("#watch-expand").click();
  assert.equal(await page.locator("#canvas-host canvas").getAttribute("data-identity"), "persistent", "mini-player must reuse the original renderer");
  await pixels(page.locator("#canvas-host canvas"), `${mobile}-returned-live`);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "charts and maps must fit mobile and desktop");
}

async function pixels(canvas, label) {
  const buffer = await canvas.screenshot();
  const decoded = PNG.sync.read(buffer);
  const colors = new Set();
  let green = 0;
  for (let index = 0; index < decoded.data.length; index += 64) {
    const [r, g, b] = decoded.data.subarray(index, index + 3);
    colors.add(`${r},${g},${b}`);
    if (g > r * 1.15 && g > b * 1.1) green++;
  }
  assert.ok(colors.size > 15 && green > 100, `${label} must render the pitch, not a blank canvas`);
  return buffer;
}

try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    const remote = [];
    await page.route("**/*", route => {
      const address = new URL(route.request().url());
      if (["data:", "blob:"].includes(address.protocol) || address.origin === new URL(base).origin) return route.continue();
      remote.push(address.href); return route.abort();
    });
    const replay = await (await page.request.get(`${base}/api/replay?scenario=late-siege`)).json();
    for (const mode of ["three", "pixi", "svg"]) {
      await page.goto(`${base}/experience?scenario=late-siege&view=${mode}`, { waitUntil: "networkidle" });
      await page.waitForFunction(mode => document.querySelector(".pitch-shell")?.dataset.renderer === mode, mode);
      await pause(page);
      await seek(page, 0);
      assert.equal(await page.locator("#player-layer g").count(), 22);
      assert.deepEqual(await page.locator(".team-name-text").allTextContents(), replay.match.teams.map(team => team.name));
      assert.ok(await page.getByLabel("Score unavailable", { exact: true }).isVisible());
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "page must fit the viewport");
      assert.equal(await page.evaluate(() => innerWidth), mobile ? 390 : 1440);
      if (mobile) {
        assert.ok(await page.locator(".header-inner .brand-text").isVisible());
        assert.equal(await page.locator(".header-inner .brand-text").evaluate(element => getComputedStyle(element).color), "rgb(28, 40, 56)", "mobile brand must contrast with the light canvas");
      }
      if (mode !== "svg") {
        assert.equal(await page.locator("#canvas-host canvas").getAttribute("data-presentation"), "stadium", "the experience must load the ported on-field presentation");
        assert.equal(await page.locator("#control-toggle").isChecked(), false, "the natural turf is visible until control is requested");
        await page.locator("#canvas-host canvas").evaluate(canvas => { canvas.dataset.identity = "persistent"; });
        const before = await pixels(page.locator("#canvas-host canvas"), `${mobile}-${mode}`);
        await seek(page, 450);
        await page.waitForTimeout(200);
        const after = await pixels(page.locator("#canvas-host canvas"), `${mobile}-${mode} moved`);
        assert.notDeepEqual(after, before, "replay positions must change canvas pixels");
        await page.locator("#play-button").click();
        await page.waitForTimeout(700);
        await pause(page);
        assert.notDeepEqual(await pixels(page.locator("#canvas-host canvas"), `${mobile}-${mode} playing`), after, "the on-field presentation must animate during play");
        await seek(page,450);
        await page.waitForTimeout(250);
        const paused = await page.locator("#canvas-host canvas").evaluate(canvas => canvas.toDataURL());
        await page.waitForTimeout(250);
        assert.equal(await page.locator("#canvas-host canvas").evaluate(canvas => canvas.toDataURL()),paused,"players and ball must freeze with the replay clock");
        await seek(page,0); await seek(page,450);
        await page.waitForTimeout(250);
        assert.equal(await page.locator("#canvas-host canvas").evaluate(canvas => canvas.toDataURL()),paused,"rewind must reproduce the same poses and ball position");
        await page.locator("#control-toggle").check();
        await page.waitForTimeout(150);
        assert.notEqual(await page.locator("#canvas-host canvas").evaluate(canvas => canvas.toDataURL()),paused,"model overlay must still render over the new pitch");
        await page.locator("#control-toggle").uncheck();
        if (mode === "three") {
          assert.ok(await page.locator(".stadium-player-tag").isVisible());
          const current = replay.events.filter(event => event.timeMs <= replay.match.startMs + .45 * (replay.match.endMs-replay.match.startMs)).at(-1);
          assert.equal(await page.locator(".stadium-player-tag").getAttribute("data-player-id"),current.actorId,"tag must identify the source event actor, not an invented possessor");
          const captures = [];
          for (const camera of ["broadcast", "tactical", "follow"]) {
            await select2(page, "#camera-mode", camera);
            await page.waitForTimeout(300);
            captures.push(await pixels(page.locator("#canvas-host canvas"), `${mobile}-${camera}`));
            await page.evaluate(() => scrollTo(0, 0));
            await page.screenshot({ path: path.join(output, `${mobile ? "mobile" : "desktop"}-${camera}.png`), fullPage: true });
          }
          assert.notDeepEqual(captures[0], captures[1], "camera presets must change framing");
          assert.notDeepEqual(captures[1], captures[2]);
          await select2(page, "#camera-mode", "broadcast");
        }
      }
      await section(page, "story");
      for (const value of [0, 450, 1000, 0]) {
        await seek(page, value);
        const at = Math.floor(replay.match.startMs + value / 1000 * (replay.match.endMs - replay.match.startMs));
        await panelAt(page, at);
        const events = replay.events.filter(event => event.timeMs <= at);
        assert.deepEqual(await page.locator("[data-story-event]").evaluateAll(items => items.map(item => item.dataset.storyEvent)), events.slice(-5).map(event => event.id));
        assert.equal(await page.locator(".story-summary dd").first().textContent(), String(events.length));
      }
      if (mode !== "svg") assert.equal(await page.locator("#canvas-host canvas").getAttribute("data-identity"), "persistent", "HTMX must not replace the pitch");
      await seek(page, 450);
      await panelAt(page, Math.floor(replay.match.startMs + .45 * (replay.match.endMs - replay.match.startMs)));
      const id = await page.locator("[data-inspect-event]").first().getAttribute("data-inspect-event");
      await page.locator("[data-inspect-event]").first().click();
      assert.equal(await page.locator("#match-clock").textContent(), clock(replay.events.find(event => event.id === id).timeMs));
      assert.equal(await page.locator("#play-button").getAttribute("aria-label"), "Play");
      await section(page, "insights");
      await page.getByRole("button", { name: "Model & moments", exact: true }).click();
      assert.ok(await page.locator("#pane-control").isVisible());
      await page.getByRole("tab", { name: "Passing", exact: true }).click();
      assert.ok(await page.locator("#pane-passing").isVisible());
      await seek(page, 0);
      await section(page, "recap");
      await panelAt(page, replay.match.startMs);
      assert.match(await page.locator(".story-content").textContent(), /available at the end/);
      await seek(page, 1000);
      await panelAt(page, replay.match.endMs);
      assert.ok(await page.locator("[data-download-recap]").isVisible());
      const downloading = page.waitForEvent("download");
      await page.locator("[data-download-recap]").click();
      assert.equal((await downloading).suggestedFilename(), "pulse-sequence-recap.txt");
      await page.screenshot({ path: path.join(output, `${mobile ? "mobile" : "desktop"}-${mode}-recap.png`), fullPage: true });
      if (mode === "three") await storyAndMaps(page, replay, mobile);
    }
    // HTMX failures retain the last HTML, offer retry and leave playback working.
    await section(page, "story");
    await panelAt(page, replay.match.endMs);
    const retained = await page.locator(".story-content").innerHTML();
    await page.route("**/experience/panel?**", route => route.fulfill({ status: 503, body: "Unavailable" }));
    await seek(page, 0);
    await page.waitForFunction(() => document.querySelector("#panel-retry")?.hidden === false);
    assert.equal(await page.locator(".story-content").innerHTML(), retained);
    await page.unroute("**/experience/panel?**");
    await page.locator("#panel-retry").click();
    await panelAt(page, replay.match.startMs);
    await page.locator("#play-button").click();
    await page.waitForFunction(start => document.querySelector(".story-content")?.getAttribute("data-time-ms") !== String(start), replay.match.startMs);
    await pause(page);
    assert.deepEqual(remote, [], "preview must use only local assets and APIs");
    await context.close();
  }
  const cuePage = await browser.newPage();
  cuePage.on("pageerror", error => errors.push(error.message));
  await cuePage.goto(`${base}/experience?scenario=corner&view=svg`, { waitUntil: "networkidle" });
  await pause(cuePage); await seek(cuePage, 1000);
  await cuePage.waitForFunction(expected => document.querySelector("#insight-status")?.textContent === expected, cornerStatus);
  await cuePage.locator("#evidence-button").click();
  assert.ok(await cuePage.locator("#evidence-return").isVisible());
  await cuePage.locator("#evidence-return").click();
  const analyst = await (await cuePage.request.get(`${base}/api/insights?scenario=corner&persona=ANALYST`)).json();
  await cuePage.getByRole("button", { name: "Analyst", exact: true }).click();
  await cuePage.waitForFunction(text => document.querySelector("#insight-text")?.textContent === text, analyst.cues[0].text);
  const verifiedFeed = structuredClone(analyst);
  verifiedFeed.cues[0].text = "The corner-to-shot window contains 1 shot.";
  verifiedFeed.cues[0].verification.status = "VERIFIED";
  await cuePage.route("**/api/agent-inspection?**", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({version:"pulse-inspection-v1", feed:verifiedFeed, inspections:[]}) }));
  await cuePage.reload({waitUntil:"networkidle"});
  await pause(cuePage); await seek(cuePage,1000);
  await cuePage.waitForFunction(() => document.querySelector("#insight-status")?.textContent === "Verified");
  assert.equal(await cuePage.locator("#insight-text").textContent(), verifiedFeed.cues[0].text, "browser must label verified cues from the supplied status, not as templates");
  assert.deepEqual(errors, []);
  const fallback = await browser.newPage({ viewport: {width: 390, height: 844} });
  fallback.on("pageerror",error => errors.push(error.message));
  await fallback.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type,...args) { return type === "2d" ? null : getContext.call(this,type,...args); };
  });
  await fallback.goto(`${base}/experience?scenario=late-siege&view=svg&section=insights`, {waitUntil: "networkidle"});
  await pause(fallback); await seek(fallback,1000);
  const recorded = await (await fallback.request.get(`${base}/api/replay?scenario=late-siege`)).json();
  await panelAt(fallback,recorded.match.endMs);
  assert.equal(await fallback.locator("#workspace-title").textContent(),"Insights","section links must work on a fresh load");
  assert.equal(await fallback.locator(".experience-graphic").count(),0);
  assert.ok(await fallback.locator(".experience-chart svg").first().isVisible(),"failed canvas must retain the Go-rendered chart");
  await fallback.getByRole("button",{name:"Pitch maps",exact:true}).click();
  assert.ok(await fallback.locator(".pitch-map").isVisible(),"failed canvas must retain the Go-rendered map");
  assert.ok(await fallback.locator(".smoothed-note").isHidden(),"fallback grid must not claim smoothing");
  await fallback.locator("#map-selection + .select2-container .select2-selection").click();
  await fallback.locator('.select2-results__option[aria-selected]').nth(1).click();
  assert.notEqual(await fallback.locator("#map-detail").textContent(), "", "inspection must work without Canvas 2D");
  await fallback.screenshot({path:path.join(output,"mobile-prototype-svg-fallback.png"),fullPage:true});
  await fallback.close();
  assert.deepEqual(errors,[]);
  console.log(`Experience browser checks passed: desktop/mobile, all renderers, cameras, Story views, charts/heatmaps, HTMX, evidence, replay-clock panels and failure recovery. Screenshots: ${output}`);
} finally { await browser.close(); }
