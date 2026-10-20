// Drawer information architecture and passing network (D4b-2) against a running Go server (PULSE_URL).
// 1. Drawer passing network, every scenario x both teams, mid replay and end, desktop and mobile:
//    no label overlaps another label or any node circle, labels stay inside the SVG, and the nodes
//    are exactly the players with a completed pass sent or received by the snapshot cutoff (the
//    Insights pitch-map rule). Labels render at 12px or more. A team with no such player shows
//    one D4b-1 state line and no graph.
// 2. On experience pages the tabs are Timeline, Passing, Control, Routes, Evidence; arrow keys wrap;
//    no tab click or arrow key changes body[data-section] or ?section=, on Live or in Insights.
// 3. The insight card's Evidence button opens the D4a trail: Evidence tab, Live, trail under the pitch.
// 4. Every Recap entry (sidebar, Story chip, #sequence-recap, demo complete) opens the sidebar Recap
//    section, whose Download still saves the recap. /legacy keeps its Recap tab and pane.
// 5. .analytics-links is gone; the [data-analysis-pane] chips and the Story Recap chip remain.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.env.PULSE_URL ?? "http://127.0.0.1:8080";
const executablePath = process.env.CHROME_PATH ?? (process.platform === "linux" ? "/usr/bin/chromium-browser" : "C:/Program Files/Google/Chrome/Application/chrome.exe");
const browser = await chromium.launch({ executablePath, headless: true, args: ["--use-angle=swiftshader-webgl", "--enable-unsafe-swiftshader"] });
const viewports = { desktop: { viewport: { width: 1440, height: 900 } }, mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } };
const scenarios = ["corner", "central", "exchange", "late-siege", "calm-midfield"];
const EXPERIENCE_TABS = ["timeline", "passing", "control", "routes", "evidence"];
const LEGACY_TABS = ["timeline", "passing", "control", "routes", "recap", "evidence"];
const failures = [];
const errors = [];
const check = (name, fn) => fn().then(() => console.log(`ok ${name}`), error => { failures.push(name); console.error(`FAIL ${name}: ${error.message}`); });
const api = async (path, scenario) => (await fetch(`${base}${path}?scenario=${scenario}`)).json();
const press = (page, selector) => page.locator(selector).first().evaluate(node => node.click());
const seek = (page, value) => page.locator("#seek").evaluate((input, value) => { input.value = String(value); input.dispatchEvent(new Event("input", { bubbles: true })); }, value);
const pause = async page => { if (await page.locator("#play-button").getAttribute("aria-label") === "Pause") await press(page, "#play-button"); };
const where = async page => ({ section: await page.evaluate(() => document.body.dataset.section), query: new URL(page.url()).searchParams.get("section") });
const tabs = page => page.locator('[role="tablist"] .drawer-tab').evaluateAll(nodes => nodes.map(node => node.dataset.tab));
const selected = page => page.locator('.drawer-tab[aria-selected="true"]').evaluateAll(nodes => nodes.map(node => node.dataset.tab));
async function open(page, path, query) {
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${base}${path}?${query}&view=svg`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelector(".pitch-shell")?.dataset.renderer === "svg", null, { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await pause(page);
}

// Page-side: geometry of the visible drawer passing network.
function networkLayout() {
  const hit = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
  const snapshot = document.querySelector(".passing-snapshot:not([hidden])");
  return { cutoff: Number(snapshot.dataset.cutoff), teams: [...snapshot.querySelectorAll(".passing-team")].map(team => {
    const svg = team.querySelector("svg.passing-graph");
    // A team without nodes shows only a C7 state line (D4b-1), naming the team.
    const empty = [...team.querySelectorAll(".state-line .state-text")].filter(node => !node.dataset.i18n.startsWith("state.idlePlayer")).map(node => ({ key: node.dataset.i18n, team: node.dataset.i18nArgTeam ?? node.dataset.i18nArgName }));
    if (!svg) return { empty, ids: [], problems: [], svg: false, tables: team.querySelectorAll("table").length };
    const box = svg.getBoundingClientRect();
    // Circle boxes include half the computed stroke, scaled like the SVG.
    const scale = box.width / svg.viewBox.baseVal.width;
    const nodes = [...svg.querySelectorAll(".passing-node")].map(g => {
      const circle = g.querySelector("circle"), half = parseFloat(getComputedStyle(circle).strokeWidth) / 2 * scale, c = circle.getBoundingClientRect();
      return { id: g.dataset.playerId, label: g.querySelector(".node-name").textContent, l: g.querySelector(".node-name").getBoundingClientRect(),
        c: { left: c.left - half, right: c.right + half, top: c.top - half, bottom: c.bottom + half } };
    });
    const problems = [];
    for (const a of nodes) {
      if (a.l.left < box.left - 0.5 || a.l.right > box.right + 0.5 || a.l.top < box.top - 0.5 || a.l.bottom > box.bottom + 0.5) problems.push(`${a.label} outside the SVG`);
      for (const b of nodes) {
        if (hit(a.l, b.c)) problems.push(`${a.label} label over circle ${b.label}`);
        if (a !== b && a.id < b.id && hit(a.l, b.l)) problems.push(`${a.label} label over label ${b.label}`);
      }
    }
    // The rendered label size: its font size times the SVG's scale.
    const labelPx = +(parseFloat(getComputedStyle(svg.querySelector(".node-name")).fontSize) * scale).toFixed(2);
    return { empty, ids: nodes.map(node => node.id).sort(), problems, svg: true, labelPx, width: Math.round(box.width), height: Math.round(box.height) };
  }) };
}

await check("drawer passing network: no label overlaps a label or a circle, and only players with completed passes are nodes", async () => {
  const rows = [];
  for (const scenario of scenarios) {
    const replay = await api("/api/replay", scenario);
    for (const [vpName, vp] of Object.entries(viewports)) {
      const context = await browser.newContext(vp);
      const page = await context.newPage();
      await open(page, "/", `scenario=${scenario}`);
      for (const at of [500, 1000]) {
        await seek(page, at);
        await press(page, "#tab-passing");
        const shown = await page.evaluate(networkLayout);
        for (const [index, team] of shown.teams.entries()) {
          const { id: teamId, name: teamName } = replay.match.teams[index];
          team.name = teamName;
          const involved = new Set(replay.events.filter(event => event.timeMs <= shown.cutoff && event.teamId === teamId && event.type === "PASS" && event.outcome === "COMPLETE").flatMap(event => [event.actorId, event.recipientId]));
          const expected = [...involved].sort();
          const label = `${scenario} ${vpName} seek ${at} ${team.name}`;
          rows.push({ scenario, vp: vpName, at, team: team.name, nodes: team.ids.length, size: team.svg ? `${team.width}x${team.height}` : "empty", labelPx: team.labelPx ?? "", problems: team.problems.length });
          assert.deepEqual(team.ids, expected, `${label}: nodes`);
          assert.deepEqual(team.problems, [], `${label}: overlaps`);
          // The graph grows taller rather than wider, so labels are never scaled below 12px.
          if (team.svg) assert.ok(team.labelPx >= 12, `${label}: labels render at ${team.labelPx}px`);
          if (expected.length === 0) {
            assert.equal(team.svg, false, `${label}: an empty team draws a graph`);
            assert.equal(team.empty.length, 1, `${label}: empty state lines ${JSON.stringify(team.empty)}`);
            assert.ok(["state.noneInSequence", "state.teamNoPassesYet"].includes(team.empty[0].key) && team.empty[0].team === teamName, `${label}: empty state ${JSON.stringify(team.empty)}`);
            assert.equal(team.tables, 0, `${label}: an empty team draws a table`);
          } else assert.deepEqual(team.empty, [], `${label}: empty state shown with nodes`);
          // Same players as the Insights pitch-map network at this clock.
          const panel = await (await fetch(`${base}/experience/panel?scenario=${scenario}&panel=analytics&map=network&teamId=${teamId}&atMs=${shown.cutoff}`)).text();
          const insights = [...panel.matchAll(/class="network-node" data-player-id="([^"]+)"/g)].map(match => match[1]).sort();
          assert.deepEqual(team.ids, insights, `${label}: drawer and Insights network players differ`);
        }
      }
      await context.close();
    }
  }
  console.table(rows);
});

await check("experience tabs: order, wrapping arrow keys, and no tab changes the section", async () => {
  for (const path of ["/", "/experience"]) {
    const page = await browser.newPage(viewports.desktop);
    await open(page, path, "scenario=late-siege");
    await seek(page, 1000);
    assert.deepEqual(await tabs(page), EXPERIENCE_TABS, `${path}: tab order`);
    assert.equal(await page.locator("#tab-recap, #pane-recap, #recap-panel").count(), 0, `${path}: drawer Recap still rendered`);
    for (const origin of ["live", "insights"]) {
      if (origin === "insights") {
        await press(page, '.experience-navigation [data-section="insights"]');
        await press(page, '#map-controls [data-analysis-pane="passing"]');
        await page.locator(".drawer-tabs").waitFor();
      }
      const before = await where(page);
      assert.equal(before.section, origin, `${path}: start section`);
      for (const tab of EXPERIENCE_TABS) {
        await page.locator(`#tab-${tab}`).click();
        assert.deepEqual(await selected(page), [tab], `${path} ${origin}: click ${tab}`);
        assert.ok(await page.locator(`#pane-${tab}`).evaluate(node => node.classList.contains("active")), `${path} ${origin}: ${tab} pane`);
        assert.deepEqual(await where(page), before, `${path} ${origin}: clicking ${tab} changed the section`);
      }
      for (const [from, key, to] of [["evidence", "ArrowRight", "timeline"], ["timeline", "ArrowLeft", "evidence"], ["control", "ArrowRight", "routes"], ["routes", "Home", "timeline"], ["timeline", "End", "evidence"]]) {
        await page.locator(`#tab-${from}`).click();
        await page.locator(`#tab-${from}`).press(key);
        assert.deepEqual(await selected(page), [to], `${path} ${origin}: ${from} + ${key}`);
        assert.equal(await page.evaluate(() => document.activeElement?.id), `tab-${to}`, `${path} ${origin}: focus after ${from} + ${key}`);
        assert.deepEqual(await where(page), before, `${path} ${origin}: ${from} + ${key} changed the section`);
      }
    }
    await page.close();
  }
});

await check("the insight card's Evidence button opens the D4a trail on the Evidence tab in Live", async () => {
  const cue = (await (await fetch(`${base}/api/insights?scenario=corner&persona=CASUAL&locale=en-GB`)).json()).cues[0];
  for (const [vpName, vp] of Object.entries(viewports)) {
    const context = await browser.newContext(vp);
    const page = await context.newPage();
    await open(page, "/", "scenario=corner");
    await press(page, '.experience-navigation [data-section="insights"]');
    await seek(page, 1000);
    await page.waitForFunction(() => document.querySelector("#insight-evidence")?.hidden === false, null, { timeout: 15000 });
    await press(page, "#evidence-button");
    await page.waitForFunction(() => !document.querySelector("#evidence-return")?.hidden);
    assert.deepEqual(await where(page), { section: "live", query: null }, `${vpName}: section`);
    assert.deepEqual(await selected(page), ["evidence"], `${vpName}: tab`);
    assert.ok(await page.locator("#pane-evidence").evaluate(node => node.classList.contains("active")), `${vpName}: Evidence pane`);
    assert.ok(await page.locator("#evidence-list").evaluate(node => Boolean(node.closest("#clip-trail-slot")) && node.checkVisibility()), `${vpName}: trail not under the pitch`);
    assert.ok(await page.locator("#evidence-moved").isVisible(), `${vpName}: Evidence pane note hidden`);
    assert.deepEqual(await page.locator("#evidence-list [data-source-event]").evaluateAll(nodes => nodes.map(node => node.dataset.sourceEvent)), cue.eventIds, `${vpName}: trail events`);
    await press(page, "#evidence-return");
    assert.ok(await page.locator("#evidence-list").evaluate(node => Boolean(node.closest("#pane-evidence"))), `${vpName}: trail did not return to the Evidence pane`);
    assert.deepEqual(await selected(page), ["evidence"], `${vpName}: tab after return`);
    await context.close();
  }
});

await check("every Recap entry opens the sidebar Recap section, and its Download saves the recap", async () => {
  const recapShown = async (page, label) => {
    await page.waitForFunction(() => document.body.dataset.section === "recap", null, { timeout: 45000 });
    await page.waitForSelector('.story-content[data-panel="recap"] li');
    assert.deepEqual(await where(page), { section: "recap", query: "recap" }, `${label}: section`);
  };
  // Chromium saves the download into a known directory (CDP Browser.setDownloadBehavior) and the test
  // reads the file. The directory sits under $HOME, not os.tmpdir(): a snap-packaged Chromium has a
  // private /tmp, so files it writes there are not visible to Node (PULSE_DOWNLOAD_DIR overrides).
  const downloads = fs.mkdtempSync(path.join(process.env.PULSE_DOWNLOAD_DIR ?? os.homedir(), "pulse-d4b-download-"));
  const context = await browser.newContext(viewports.desktop);
  const page = await context.newPage();
  const { targetInfo } = await (await context.newCDPSession(page)).send("Target.getTargetInfo");
  const cdp = await browser.newBrowserCDPSession();
  await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloads, eventsEnabled: true, browserContextId: targetInfo.browserContextId });
  await open(page, "/", "scenario=corner");
  await seek(page, 1000);
  await press(page, '.experience-navigation [data-section="recap"]');
  await recapShown(page, "sidebar");
  const finished = new Promise(resolve => cdp.on("Browser.downloadProgress", event => { if (event.state !== "inProgress") resolve(event); }));
  await press(page, "[data-download-recap]");
  const progress = await finished;
  assert.equal(progress.state, "completed", `download ${progress.state}`);
  assert.equal(path.basename(progress.filePath), "pulse-sequence-recap.txt");
  const text = fs.readFileSync(progress.filePath, "utf8");
  fs.rmSync(downloads, { recursive: true, force: true });
  const lines = await page.locator('.story-content[data-panel="recap"] li p').allTextContents();
  assert.ok(lines.length > 0 && lines.every(line => text.includes(line)), "download does not carry the Recap section's lines");

  await press(page, '.experience-navigation [data-section="story"]');
  await page.locator("[data-open-recap]").waitFor();
  await press(page, "[data-open-recap]");
  await recapShown(page, "Story chip");

  await press(page, '.experience-navigation [data-section="live"]');
  await press(page, "#sequence-recap");
  await recapShown(page, "#sequence-recap");

  await page.goto(`${base}/?view=svg`, { waitUntil: "networkidle" });
  await press(page, "#scenario-library-open");
  await page.waitForSelector('[data-scenario-id="corner"] [data-guided-demo]');
  await press(page, '[data-scenario-id="corner"] [data-guided-demo]');
  await page.waitForFunction(() => document.querySelector("#run-demo-button")?.getAttribute("aria-pressed") === "true");
  await recapShown(page, "demo complete");
  assert.equal((await selected(page)).length, 1, "demo complete: the drawer has no selected tab");
  await context.close();
});

await check("/legacy keeps its Recap tab, pane and end-of-replay fallback", async () => {
  const page = await browser.newPage(viewports.desktop);
  await open(page, "/legacy", "scenario=corner");
  assert.deepEqual(await tabs(page), LEGACY_TABS);
  await seek(page, 1000);
  assert.deepEqual(await selected(page), ["recap"], "the replay end selects Recap");
  await page.locator("#tab-timeline").click();
  await page.locator("#tab-recap").click();
  assert.deepEqual(await selected(page), ["recap"]);
  assert.ok(await page.locator("#pane-recap").evaluate(node => node.classList.contains("active")));
  assert.ok(await page.locator("#recap-panel").isVisible());
  await page.locator("#tab-timeline").click();
  await press(page, "#sequence-recap");
  assert.deepEqual(await selected(page), ["recap"], "#sequence-recap selects the Recap tab");
  assert.equal(await page.locator("#recap-panel").isVisible(), true);
  await page.close();
});

await check(".analytics-links is gone; the analysis chips and the Story Recap chip remain", async () => {
  const page = await browser.newPage(viewports.desktop);
  await open(page, "/", "scenario=late-siege");
  await seek(page, 1000);
  await press(page, '.experience-navigation [data-section="insights"]');
  for (const view of ["charts", "maps"]) {
    await press(page, `#map-controls [data-insight-view="${view}"]`);
    await page.waitForFunction(view => document.body.dataset.insightView === view && document.querySelector(".experience-lanes"), view);
    assert.equal(await page.locator(".analytics-links").count(), 0, `${view}: .analytics-links rendered`);
  }
  assert.deepEqual(await page.locator("#map-controls [data-analysis-pane]").evaluateAll(nodes => nodes.map(node => node.dataset.analysisPane)), ["control", "passing", "routes"]);
  assert.equal(await page.locator("[data-open-recap]").count(), 1);
  await page.close();
});

await browser.close();
if (errors.length) { console.error("page errors:", errors); failures.push("page errors"); }
if (failures.length) { console.error(`${failures.length} D4b-2 check(s) failed`); process.exit(1); }
console.log("Drawer IA browser checks passed.");
