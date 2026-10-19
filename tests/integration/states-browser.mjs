// Default focus and C7 states (D4b-1) against a running Go server (PULSE_URL).
// 1. Every scenario opens on the team that played the sequence (vale) and its most
//    involved player, in the page and in every panel request built from it.
// 2. At the start, a mid tick and the end, the default view never shows "0 of 0",
//    "0 entries / 0 shots" or "N/A", at 1440 and 390 px.
// 3. Replays with sparse tracking name the tracking gap on Live and in the Control
//    pane; the raw API reason stays in <details>. Full 5 Hz replays show no such line.
// 4. Zero tables, lanes, maps and windows collapse into one line; the drawer Recap pane
//    is never empty before the end.
// 5. Loading and error states use the shared partial: own icon, text as the name.
// 6. /legacy is unchanged: no state lines.
// 7. Every line the scripts draw equals the Go partial's rendering of the same case
//    (app/testdata/states/state-lines.json) after the browser's HTML serialization.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const base = process.env.PULSE_URL ?? "http://127.0.0.1:8080";
const executablePath = process.env.CHROME_PATH ?? (process.platform === "linux" ? "/usr/bin/chromium-browser" : "C:/Program Files/Google/Chrome/Application/chrome.exe");
const browser = await chromium.launch({ executablePath, headless: true, args: ["--use-angle=swiftshader-webgl", "--enable-unsafe-swiftshader"] });
const viewports = { desktop: { viewport: { width: 1440, height: 900 } }, mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } };
const SCENARIOS = ["corner", "central", "exchange", "late-siege", "calm-midfield"];
const SPARSE = ["corner", "central", "exchange"];
const FORBIDDEN = ["0 of 0", "0 entries / 0 shots", "N/A"];
const golden = Object.fromEntries(JSON.parse(readFileSync(new URL("../../app/testdata/states/state-lines.json", import.meta.url), "utf8")).lines.map(line => [line.Name, line.HTML]));
const failures = [];
const errors = [];
const check = (name, fn) => fn().then(() => console.log(`ok ${name}`), error => { failures.push(name); console.error(`FAIL ${name}: ${error.message}`); });
const api = async (path, scenario) => (await fetch(`${base}${path}?scenario=${scenario}`)).json();
const press = (page, selector) => page.locator(selector).first().evaluate(node => node.click());
const seek = (page, value) => page.locator("#seek").evaluate((input, value) => { input.value = String(value); input.dispatchEvent(new Event("input", { bubbles: true })); }, value);
const clock = ms => `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
// The panel answered for the current clock and the selected panel kind.
const settled = page => page.waitForFunction(() => {
  const content = document.querySelector(".story-content"), inputs = document.querySelector("#experience-inputs");
  return content && document.querySelector("#experience-content")?.getAttribute("aria-busy") === "false"
    && content.dataset.timeMs === inputs.elements.namedItem("atMs").value && content.dataset.panel === inputs.elements.namedItem("panel").value;
});
async function open(context, path) {
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelector(".pitch-shell")?.dataset.renderer === "svg", null, { timeout: 30000 });
  if (await page.locator("#play-button").getAttribute("aria-label") === "Pause") await press(page, "#play-button");
  return page;
}
const section = async (page, name) => { await press(page, `.experience-navigation [data-section="${name}"]`); if (name !== "live") await settled(page); };
// Visible text only: innerText skips display:none, so hidden panes and values do not count.
const visibleText = page => page.evaluate(() => document.body.innerText);

// The same rule as domain.DefaultFocus, from the public replay: most passes, carries and
// shots wins (ties keep API order); then the team's most involved player (roster order).
function expectedFocus(replay) {
  const actions = new Map(), involvements = new Map();
  const add = (map, id) => map.set(id, (map.get(id) ?? 0) + 1);
  for (const event of replay.events) {
    if (!["PASS", "CARRY", "SHOT"].includes(event.type)) continue;
    add(actions, event.teamId); add(involvements, event.actorId);
    if (event.type === "PASS" && event.outcome === "COMPLETE" && event.recipientId) add(involvements, event.recipientId);
  }
  let team = replay.match.teams[0].id;
  for (const candidate of replay.match.teams.slice(1)) if ((actions.get(candidate.id) ?? 0) > (actions.get(team) ?? 0)) team = candidate.id;
  let player = "", best = -1;
  for (const candidate of replay.match.players) if (candidate.teamId === team && (involvements.get(candidate.id) ?? 0) > best) { player = candidate.id; best = involvements.get(candidate.id) ?? 0; }
  return { team, player, involvements: best };
}

try {
  const data = {};
  for (const scenario of SCENARIOS) {
    const [replay, metrics] = await Promise.all([api("/api/replay", scenario), api("/api/metrics", scenario)]);
    data[scenario] = { replay, metrics, focus: expectedFocus(replay) };
  }

  await check("every scenario defaults to vale and its most involved player", async () => {
    for (const scenario of SCENARIOS) {
      const { focus } = data[scenario];
      assert.equal(focus.team, "vale", `${scenario}: rule picks ${focus.team}`);
      assert.ok(focus.involvements > 0, `${scenario}: default player has no involvements`);
      const html = await (await fetch(`${base}/?scenario=${scenario}`)).text();
      assert.match(html, /<option value="vale" selected>/, `${scenario}: team select`);
      assert.ok(html.includes(`<option value="${focus.player}" selected>`), `${scenario}: player select ${focus.player}`);
      // A panel request without teamId/playerId uses the same focus as the page.
      const end = data[scenario].replay.match.endMs;
      const analytics = await (await fetch(`${base}/experience/panel?scenario=${scenario}&panel=analytics&atMs=${end}`)).text();
      assert.ok(analytics.includes('data-analytics-team="vale"'), `${scenario}: analytics default team`);
      const comparison = await (await fetch(`${base}/experience/panel?scenario=${scenario}&panel=comparison&atMs=${end}`)).text();
      assert.ok(comparison.includes('data-comparison-team="vale"'), `${scenario}: comparison default team`);
      const name = data[scenario].replay.match.players.find(player => player.id === focus.player).name;
      const story = await (await fetch(`${base}/experience/panel?scenario=${scenario}&panel=story&mode=player&atMs=${end}`)).text();
      assert.ok(story.includes(`<h3>${name}</h3>`), `${scenario}: story player default ${name}`);
    }
  });

  for (const [size, options] of Object.entries(viewports)) {
    await check(`${size}: default views show no zero placeholders at start, mid and end`, async () => {
      const context = await browser.newContext(options);
      for (const scenario of SCENARIOS) {
        const page = await open(context, `/?scenario=${scenario}&view=svg`);
        assert.equal(await page.locator('select[name="teamId"]').inputValue(), "vale", `${scenario}: team select`);
        assert.equal(await page.locator('select[name="playerId"]').inputValue(), data[scenario].focus.player, `${scenario}: player select`);
        for (const at of [0, 500, 1000]) {
          await seek(page, at);
          await page.waitForTimeout(150);
          const text = await visibleText(page);
          for (const phrase of FORBIDDEN) assert.ok(!text.includes(phrase), `${scenario} @${at}: "${phrase}" is visible`);
        }
        await page.close();
      }
      await context.close();
    });
  }

  await check("sparse tracking names the gap on Live and in the Control pane", async () => {
    const context = await browser.newContext(viewports.desktop);
    for (const scenario of SCENARIOS) {
      const { metrics, replay } = data[scenario];
      const page = await open(context, `/?scenario=${scenario}&view=svg`);
      await page.waitForFunction(() => !["Loading metrics", ""].includes(document.querySelector("#metrics-label")?.textContent ?? ""));
      const label = await page.locator("#metrics-label").textContent();
      if (SPARSE.includes(scenario)) {
        const [, ms, at] = /^frame gap of (\d+) ms at (\d+);/.exec(metrics.reason);
        const line = `Control metrics unavailable: tracking has a gap of ${(Number(ms) / 1000).toFixed(1)} s at ${clock(Number(at))}`;
        assert.equal(label, line, `${scenario}: Live label`);
        assert.ok(await page.locator("#metrics-label").isVisible(), `${scenario}: Live label visible`);
        assert.equal(await page.locator("#metrics-label").getAttribute("data-i18n"), "state.trackingGap", `${scenario}: Live label re-renders per locale`);
        await press(page, '.drawer-tab[data-tab="control"]');
        const state = page.locator('#metrics-state .state-line[data-state="no-tracking"]');
        assert.equal(await state.locator(".state-text").textContent(), line);
        assert.equal(await state.locator(".state-icon").getAttribute("data-icon"), "triangle-alert");
        assert.ok(!(await state.locator(".state-text").textContent()).includes("frame gap"), "the visible line must not be the raw reason");
        assert.equal(await state.locator("details code").textContent(), metrics.reason, `${scenario}: raw reason in details`);
        assert.equal(await state.locator("details").getAttribute("open"), null, "raw reason starts collapsed");
        assert.equal(await page.locator("#pane-control .metric-values:visible").count(), 0, `${scenario}: N/A metric rows hidden`);
        assert.ok(replay.tracking.length < 50, `${scenario}: fixture is sparse`);
      } else {
        assert.equal(label, metrics.label, `${scenario}: supported tracking keeps the model label`);
        assert.equal(await page.locator('.state-line[data-state="no-tracking"]').count(), 0, `${scenario}: no tracking-gap line`);
      }
      await page.close();
    }
    await context.close();
  });

  await check("zero teams, players, lanes and windows collapse into one line", async () => {
    const context = await browser.newContext(viewports.desktop);
    const page = await open(context, "/?scenario=late-siege&view=svg");
    const bastion = data["late-siege"].replay.match.teams.find(team => team.id === "bastion").name;
    // Drawer Passing and Routes: bastion has no pass, carry or shot in the sequence.
    for (const [tab, snapshot] of [["passing", ".passing-snapshot"], ["routes", ".attack-snapshot"]]) {
      await press(page, `.drawer-tab[data-tab="${tab}"]`);
      for (const at of [0, 500, 1000]) {
        await seek(page, at); await page.waitForTimeout(100);
        const active = page.locator(`${snapshot}:not([hidden])`);
        const lines = await active.locator('[data-i18n="state.noneInSequence"]').allTextContents();
        assert.deepEqual(lines, [`${bastion} has no passes, carries or shots in this sequence`], `${tab} @${at}: one bastion line`);
        assert.equal(await active.locator("meter[value='0'][max='1']").count(), 0, `${tab} @${at}: no 0-of-0 lane meters`);
      }
    }
    // Passing table: only players with a pass; the rest share one line.
    await press(page, '.drawer-tab[data-tab="passing"]');
    await seek(page, 1000); await page.waitForTimeout(100);
    const rows = await page.locator(".passing-snapshot:not([hidden]) .passing-table tbody tr").evaluateAll(rows => rows.map(row => [...row.cells].map(cell => cell.textContent)));
    assert.ok(rows.length > 0 && rows.every(([, sent, received]) => sent !== "0" || received !== "0"), "zero rows must collapse");
    const idle = await page.locator('.passing-snapshot:not([hidden]) [data-i18n^="state.idlePlayer"]').textContent();
    assert.equal(idle, `${11 - rows.length} players with no passes`);
    // Recap before the end: experience pages have no drawer Recap pane (D4b-2), so the
    // sidebar Recap section shows its state, with height, then the recap at the end.
    await seek(page, 500); await page.waitForTimeout(100);
    await section(page, "recap"); await settled(page);
    const pending = page.locator('.story-content[data-panel="recap"] [data-i18n="Recap available at the end of the sequence."]');
    assert.equal(await pending.textContent(), "Recap available at the end of the sequence.");
    assert.ok(await pending.isVisible(), "the Recap section must show its state");
    assert.ok((await page.locator('.story-content[data-panel="recap"]').boundingBox()).height > 0, "the Recap section must not be 0 px high");
    await seek(page, 1000); await settled(page);
    assert.equal(await pending.count(), 0);
    assert.ok(await page.locator('.story-content[data-panel="recap"] .story-log li').first().isVisible());
    // Insights comparison at the end: the 10 s windows hold no vale action (last at +45.3 s).
    await section(page, "insights");
    await press(page, '[data-insight-view="comparison"]'); await settled(page);
    assert.equal(await page.locator(".comparison-stat").count(), 0, "no 0 -> 0 rows");
    assert.equal(await page.locator(".comparison-window").count(), 0, "no empty pitches");
    assert.equal(await page.locator('.comparison [data-i18n="state.windowNone"]').textContent(), "Aurora Vale: no completed passes, carries or shots from 89:00 to 89:20");
    // A window pair with actions shows only rows that changed, plus one zero line.
    await page.locator('select[name="windowMs"]').evaluate(select => { select.value = "30000"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    await page.waitForFunction(() => document.querySelectorAll(".comparison-window").length === 2);
    const stats = await page.locator(".comparison-stat").evaluateAll(rows => rows.map(row => [Number(row.dataset.before), Number(row.dataset.after)]));
    assert.ok(stats.length > 0 && stats.every(([before, after]) => before || after), "only non-zero rows");
    if (stats.length < 6) assert.match(await page.locator('.comparison [data-i18n^="state.zeroRow"]').textContent(), new RegExp(`^${6 - stats.length} metrics? with none in either window$`));
    // Bastion in Insights: one line for maps and lanes, and the comparison.
    await page.locator('select[name="teamId"]').evaluate(select => { select.value = "bastion"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    await page.waitForFunction(() => document.querySelector(".comparison")?.dataset.comparisonTeam === "bastion");
    assert.equal(await page.locator(".comparison .state-text").textContent(), `${bastion} has no passes, carries or shots in this sequence`);
    await press(page, '[data-insight-view="maps"]'); await settled(page);
    // Its tracking heatmap is real data and stays; its event maps and lanes are one line.
    assert.ok(await page.locator(".heat-cells rect").count() > 0, "bastion keeps its tracking heatmap");
    assert.equal(await page.locator(".experience-lanes .state-text").textContent(), `${bastion} has no passes, carries or shots in this sequence`);
    assert.equal(await page.locator(".experience-lanes progress").count(), 0, "no zero lane meters");
    for (const mode of ["network", "shots"]) {
      await press(page, `[data-map-mode="${mode}"]`);
      await page.waitForFunction(mode => document.querySelector(".story-content")?.dataset.mapMode === mode, mode);
      await settled(page);
      assert.equal(await page.locator(".experience-map .state-text").textContent(), `${bastion} has no passes, carries or shots in this sequence`, `${mode}: one line`);
      assert.equal(await page.locator(".map-art").count(), 0, `${mode}: no empty pitch`);
    }
    await page.close();
    // Story player focus at the start: one line instead of 0 / 0 rows.
    const story = await open(context, "/?scenario=late-siege&view=svg&section=story");
    await press(story, '[data-story-mode="player"]'); await settled(story);
    assert.equal(await story.locator(".player-story-summary").count(), 0);
    assert.match(await story.locator('.story-content [data-i18n="state.playerNoneYet"]').textContent(), /^Dax: no passes, carries or shots yet$/);
    await story.close();
    await context.close();
  });

  await check("loading and error states use the partial with their own icons", async () => {
    const context = await browser.newContext(viewports.desktop);
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    let release;
    const held = new Promise(resolve => { release = resolve; });
    await page.route("**/api/metrics?*", async route => { await held; await route.fulfill({ status: 503, contentType: "application/json", body: "{}" }); });
    await page.goto(`${base}/?scenario=late-siege&view=svg`, { waitUntil: "domcontentloaded" });
    const loading = page.locator('#metrics-state .state-line[data-state="loading"]');
    assert.equal(await loading.locator(".state-text").textContent(), "Loading metrics");
    // The host is the persistent live region; the line itself has no role.
    assert.equal(await page.locator("#metrics-state").getAttribute("role"), "status");
    assert.equal(await loading.getAttribute("role"), null);
    assert.equal(await loading.locator(".state-icon").getAttribute("data-icon"), "loader-circle");
    assert.equal(await loading.locator(".state-icon").getAttribute("aria-hidden"), "true");
    release();
    const failed = page.locator('#metrics-state .state-line[data-state="error"]');
    await failed.waitFor({ state: "attached" });
    assert.equal(await failed.locator(".state-text").textContent(), "Metrics unavailable");
    assert.equal(await failed.locator(".state-icon").getAttribute("data-icon"), "circle-alert");
    // A failed panel request keeps the last view and says so with the error state.
    await page.waitForFunction(() => document.querySelector(".pitch-shell")?.dataset.renderer === "svg", null, { timeout: 30000 });
    if (await page.locator("#play-button").getAttribute("aria-label") === "Pause") await press(page, "#play-button");
    await page.route("**/experience/panel?*", route => route.fulfill({ status: 503, body: "unavailable" }));
    await press(page, '.experience-navigation [data-section="story"]');
    const panelError = page.locator('#panel-status .state-line[data-state="error"]');
    await panelError.waitFor({ state: "attached" });
    assert.equal(await panelError.locator(".state-text").textContent(), "Update unavailable. Last loaded view retained.");
    assert.equal(await panelError.getAttribute("role"), null, "the line has no role");
    assert.equal(await page.locator("#panel-status").getAttribute("role"), "status", "the status host is the live region");
    assert.ok(await page.locator("#panel-retry").isVisible());
    await page.close();
    await context.close();
  });

  await check("state lines re-render from their catalog keys", async () => {
    const context = await browser.newContext(viewports.desktop);
    const page = await open(context, "/?scenario=late-siege&view=svg&locale=sw-KE");
    await page.waitForFunction(() => document.body.dataset.locale === "sw-KE");
    // "No passes yet" has a NEEDS TRANSLATION draft (the English text); the key still routes.
    assert.equal(await page.locator('#summary-passes-state [data-i18n="No passes yet"]').count(), 1);
    await press(page, '.drawer-tab[data-tab="control"]');
    await page.waitForFunction(() => document.querySelectorAll("#moments-state [data-i18n], #moment-list li:not([hidden])").length > 0);
    await page.close();
    await context.close();
  });

  await check("script-drawn state lines equal the Go partial", async () => {
    const context = await browser.newContext(viewports.desktop);
    // The page serializes both sides, so self-closing SVG children compare equally.
    const same = async (page, selector, name) => {
      const [got, want] = await page.locator(selector).first().evaluate((node, html) => {
        const template = document.createElement("template");
        template.innerHTML = html;
        return [node.outerHTML, template.content.firstElementChild.outerHTML];
      }, golden[name]);
      assert.equal(got, want, `${name}: script line differs from the Go partial`);
    };
    const lineIn = host => `${host} > .state-line`;
    let page = await open(context, "/?scenario=corner&view=svg");
    await page.locator(lineIn("#metrics-state") + '[data-state="no-tracking"]').waitFor({ state: "attached" });
    await same(page, lineIn("#metrics-state"), "tracking-gap");
    await page.close();
    page = await open(context, "/?scenario=late-siege&view=svg");
    await page.waitForFunction(() => document.querySelector("#moments-state [data-i18n]")?.dataset.i18n === "No moments yet");
    await same(page, lineIn("#moments-state"), "moments-yet");
    await page.close();
    page = await open(context, "/?scenario=calm-midfield&view=svg");
    await page.waitForFunction(() => document.querySelector("#moments-state [data-i18n]")?.dataset.i18n === "No moments detected");
    await same(page, lineIn("#moments-state"), "moments-none");
    await page.close();
    page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/api/metrics?*", route => route.fulfill({ status: 503, contentType: "application/json", body: "{}" }));
    await page.route("**/api/moments?*", route => route.fulfill({ status: 503, contentType: "application/json", body: "{}" }));
    await page.goto(`${base}/?scenario=late-siege&view=svg`, { waitUntil: "networkidle" });
    await page.locator(lineIn("#metrics-state") + '[data-state="error"]').waitFor({ state: "attached" });
    await same(page, lineIn("#metrics-state"), "metrics-error");
    await page.locator(lineIn("#moments-state") + '[data-state="error"]').waitFor({ state: "attached" });
    await same(page, lineIn("#moments-state"), "moments-error");
    await page.waitForFunction(() => document.querySelector(".pitch-shell")?.dataset.renderer === "svg", null, { timeout: 30000 });
    if (await page.locator("#play-button").getAttribute("aria-label") === "Pause") await press(page, "#play-button");
    let release;
    const held = new Promise(resolve => { release = resolve; });
    await page.route("**/experience/panel?*", async route => { await held; await route.fulfill({ status: 503, body: "unavailable" }); });
    await press(page, '.experience-navigation [data-section="story"]');
    await page.locator(lineIn("#panel-status") + '[data-state="loading"]').waitFor({ state: "attached" });
    await same(page, lineIn("#panel-status"), "panel-loading");
    release();
    await page.locator(lineIn("#panel-status") + '[data-state="error"]').waitFor({ state: "attached" });
    await same(page, lineIn("#panel-status"), "panel-error");
    await page.close();
    await context.close();
  });

  // PR #44 interactions: share links, broadcast and insight selection with the default focus and states.
  await check("shared links, broadcast and insight selection keep the default focus and states", async () => {
    const context = await browser.newContext(viewports.desktop);
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: base });
    // A link shared from Insights at the start restores Insights on vale with collapsed charts.
    let page = await open(context, "/?scenario=late-siege&view=svg");
    await section(page, "insights");
    await press(page, "#share-button");
    const link = await page.locator("#share-link-value").inputValue().catch(() => "");
    const shared = link || await page.evaluate(() => navigator.clipboard.readText());
    assert.match(shared, /[?&]share=1/, "share link");
    assert.match(shared, /[?&]section=insights/, "share link keeps the section");
    await page.close();
    page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(shared, { waitUntil: "networkidle" });
    await settled(page);
    assert.equal(await page.locator("body").getAttribute("data-section"), "insights");
    assert.equal(await page.locator('select[name="teamId"]').inputValue(), "vale");
    assert.equal(await page.locator(".experience-map").getAttribute("data-analytics-team"), "vale");
    assert.equal(await page.locator('.story-content [data-i18n="No passes, shots or box entries yet"]').count(), 1);
    await page.close();
    // Broadcast on a sparse-tracking replay: the gap line stays the Live label; no errors.
    page = await open(context, "/?scenario=corner&view=svg");
    await page.waitForFunction(() => document.querySelector("#metrics-label")?.dataset.i18n === "state.trackingGap");
    await press(page, "#broadcast-toggle");
    await page.waitForFunction(() => document.body.dataset.broadcast === "true");
    await seek(page, 1000); await page.waitForTimeout(200);
    assert.equal(await page.locator("#metrics-label").getAttribute("data-i18n"), "state.trackingGap");
    assert.equal(await page.locator('[data-i18n="Recap available at the end of the sequence."]').evaluateAll(nodes => nodes.filter(node => node.checkVisibility()).length), 0, "recap state hides at the end");
    await press(page, "#broadcast-exit");
    await page.waitForFunction(() => document.body.dataset.broadcast !== "true");
    await page.close();
    // Insight selection at 88:46 on late-siege (open-play insight): moment and rail states stay consistent.
    page = await open(context, "/?scenario=late-siege&view=svg");
    const { replay } = data["late-siege"];
    await seek(page, Math.ceil((replay.match.startMs + 46000 - replay.match.startMs) / (replay.match.endMs - replay.match.startMs) * 1000));
    await page.waitForTimeout(300);
    assert.equal(await page.locator("#summary-passes").isVisible(), true, "passes exist by 88:46");
    assert.equal(await page.locator("#summary-passes-state").isVisible(), false);
    assert.equal(await page.locator("#moments-state .state-line").count(), 0, "visible moments clear the empty state");
    assert.ok(Number(await page.locator("#moment-count").textContent()) > 0);
    await page.close();
    await context.close();
  });

  await check("/legacy keeps its original text and has no state lines", async () => {
    const context = await browser.newContext(viewports.desktop);
    const page = await open(context, "/legacy?scenario=late-siege&view=svg");
    assert.equal(await page.locator(".state-line").count(), 0);
    assert.equal(await page.locator("#summary-passes").textContent(), "0 of 0");
    await page.close();
    await context.close();
  });

  assert.deepEqual(errors, []);
} catch (error) {
  failures.push("setup"); console.error(error);
} finally {
  await browser.close();
}
if (failures.length) { console.error(`${failures.length} failed: ${failures.join(", ")}`); process.exit(1); }
console.log("states browser checks passed");
