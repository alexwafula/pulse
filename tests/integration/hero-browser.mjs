// Hero and first impression (DIRECTION C1 / D3a) against a running Go server (PULSE_URL):
// 1. Team colours are server-rendered: identical before any script runs, at DOMContentLoaded and
//    after the first htmx swap, in SVG, PixiJS and Three.js; renderer kits match the swatches.
// 2. The hero headline is the API's indexDelta in the API's team order, at three seek points.
// 3. Switching renderer while paused keeps team colours and draws no frames once switched.
import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "playwright-core";

const base = process.env.PULSE_URL ?? "http://127.0.0.1:8080";
const executablePath = process.env.CHROME_PATH ?? (process.platform === "linux" ? "/usr/bin/chromium-browser" : "C:/Program Files/Google/Chrome/Application/chrome.exe");
const browser = await chromium.launch({ executablePath, headless: true, args: ["--use-angle=swiftshader-webgl", "--enable-unsafe-swiftshader"] });
const views = ["svg", "pixi", "three"];
const viewports = { desktop: { viewport: { width: 1440, height: 900 } }, mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } };
const kit = { vale: "rgb(184, 55, 77)", bastion: "rgb(46, 104, 179)" };
const failures = [];
const errors = [];
const check = (name, fn) => fn().then(() => console.log(`ok ${name}`), error => { failures.push(name); console.error(`FAIL ${name}: ${error.message}`); });
const api = async (path, scenario) => (await fetch(`${base}${path}?scenario=${scenario}`)).json();
const rgb = hex => `rgb(${[1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`;
const press = (page, selector) => page.locator(selector).first().evaluate(node => node.click());
const seek = (page, value) => page.locator("#seek").evaluate((input, value) => { input.value = String(value); input.dispatchEvent(new Event("input", { bubbles: true })); }, value);
// The play button's label is translated, so compare it with the page locale's "Pause".
const catalog = JSON.parse(fs.readFileSync(new URL("../../app/web/static/locales.json", import.meta.url), "utf8"));
async function pause(page) {
  const locale = await page.evaluate(() => document.body.dataset.locale ?? "en-GB");
  if (await page.locator("#play-button").getAttribute("aria-label") === (catalog[locale]?.Pause ?? "Pause")) await press(page, "#play-button");
}

// Page-side: each team's swatch colour and mini-score initial colour, keyed by team id.
function teamColours() {
  const out = {};
  for (const strip of document.querySelectorAll(".team-name[data-team-id]")) {
    const swatch = strip.querySelector(".team-swatch");
    out[strip.dataset.teamId] = swatch ? getComputedStyle(swatch).backgroundColor : "missing";
  }
  const initials = document.querySelectorAll(".experience-mini-score > span");
  if (initials.length >= 3) out["mini:home"] = getComputedStyle(initials[0]).color, out["mini:away"] = getComputedStyle(initials[2]).color;
  return out;
}
// Init script: snapshot at DOMContentLoaded and at the first htmx swap.
function recordColours(source) {
  const snapshot = new Function(`return (${source})()`);
  document.addEventListener("DOMContentLoaded", () => { window.__coloursAtDCL = snapshot(); }, { once: true });
  document.addEventListener("htmx:afterSwap", () => { window.__coloursAtSwap ??= snapshot(); });
}
async function kitColours(page, view, teamIds) {
  if (view === "svg") return page.evaluate(ids => Object.fromEntries(ids.map(id => {
    const title = [...document.querySelectorAll("#player-layer title")].find(node => node.textContent.endsWith(`, ${document.querySelector(`.team-name[data-team-id="${id}"] .team-name-text`).textContent}`));
    return [id, title && getComputedStyle(title.parentElement.querySelector("circle")).fill];
  })), teamIds);
  const pairs = await page.locator("#canvas-host canvas").first().evaluate(node => node.dataset.teamColours ?? "");
  return Object.fromEntries(pairs.split(" ").filter(Boolean).map(entry => { const [id, hex] = entry.split(":"); return [id, rgb(hex)]; }));
}

await check("team colours are identical before scripts, at DOMContentLoaded and after the first htmx swap, in all renderers", async () => {
  const rows = [];
  for (const [vpName, vp] of Object.entries(viewports)) {
    const context = await browser.newContext(vp);
    await context.addInitScript(recordColours, teamColours.toString());
    for (const scenario of ["late-siege", "corner"]) for (const view of views) {
      const page = await context.newPage();
      page.on("pageerror", error => errors.push(error.message));
      // Hold every script until the server-rendered page and its stylesheets are in place.
      const held = [];
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      await page.route(/\/static\/.*\.js$/, async route => { held.push(route.request().url()); await gate; await route.continue(); });
      await page.goto(`${base}/?scenario=${scenario}&view=${view}`, { waitUntil: "commit" });
      await page.waitForFunction(() => document.readyState !== "loading" && [...document.querySelectorAll('link[rel="stylesheet"]')].every(link => link.sheet));
      const beforeScripts = await page.evaluate(teamColours);
      release();
      await page.waitForFunction(view => document.querySelector(".pitch-shell")?.dataset.renderer === view, view, { timeout: 30000 });
      await pause(page);
      await press(page, '.experience-navigation [data-section="story"]');
      await page.waitForFunction(() => window.__coloursAtSwap, null, { timeout: 15000 });
      const atDCL = await page.evaluate(() => window.__coloursAtDCL);
      const atSwap = await page.evaluate(() => window.__coloursAtSwap);
      await press(page, '.experience-navigation [data-section="live"]');
      const hydrated = await page.evaluate(teamColours);
      const ids = Object.keys(beforeScripts).filter(id => !id.startsWith("mini:"));
      const kits = await kitColours(page, view, ids);
      rows.push({ vp: vpName, scenario, view, held: held.length, bastion: beforeScripts.bastion, vale: beforeScripts.vale });
      assert.ok(held.length > 0, "no script was held; the pre-script snapshot is meaningless");
      assert.deepEqual(ids.sort(), ["bastion", "vale"], `${scenario}: team strips`);
      for (const id of ids) assert.equal(beforeScripts[id], kit[id], `${vpName}/${scenario}/${view}: ${id} before scripts`);
      assert.deepEqual(atDCL, beforeScripts, `${vpName}/${scenario}/${view}: colours changed by DOMContentLoaded`);
      assert.deepEqual(atSwap, beforeScripts, `${vpName}/${scenario}/${view}: colours changed by the first htmx swap`);
      assert.deepEqual(hydrated, beforeScripts, `${vpName}/${scenario}/${view}: colours changed after hydration`);
      for (const id of ids) assert.equal(kits[id], kit[id], `${vpName}/${scenario}/${view}: ${id} renderer kit`);
      await page.close();
    }
    await context.close();
  }
  console.table(rows);
});

// Expected hero text from the API alone, derived here rather than imported: teams[0]'s
// indexDelta, a 2-dp magnitude (halves away from zero) naming whichever team is higher,
// the exact value with U+2212, and the label in API order.
const MINUS = "\u2212";
function headlineText(locale, hundredths, team) {
  const key = hundredths === 0 ? "index.level" : "index.higher";
  return catalog[locale][key].replace("{team}", team).replace("{value}", (hundredths / 100).toFixed(2));
}
function expectedHero(metrics, replay, tick, locale = "en-GB") {
  const name = id => replay.match.teams.find(team => team.id === id).name;
  const [first, second] = metrics.teams, delta = tick.teams[first].indexDelta;
  const hundredths = Math.floor((Math.round(Math.abs(delta) * 1e4) + 50) / 100);
  let exact = String(Math.abs(delta));
  const [whole, fraction = ""] = exact.split(".");
  exact = `${whole}.${fraction.padEnd(4, "0")}`;
  return {
    headline: headlineText(locale, hundredths, name(delta < 0 ? second : first)),
    signed: delta > 0 ? `+${exact}` : delta < 0 ? `${MINUS}${exact}` : exact,
    label: `${name(first)} − ${name(second)}`,
  };
}
// Team named higher, sign and "first − second" label must agree.
function assertAgreement(shown, where, locale = "en-GB") {
  const [first, second] = shown.label.split(" − ");
  assert.ok(first && second, `${where}: missing API-order team label`);
  assert.ok(!shown.signed.includes("-"), `${where}: U+002D in ${shown.signed}`);
  const delta = Number(shown.signed.replace(MINUS, "-"));
  assert.ok(Number.isFinite(delta), `${where}: invalid signed value`);
  const hundredths = Math.floor((Math.round(Math.abs(delta) * 1e4) + 50) / 100);
  const team = delta < 0 ? second : first;
  assert.equal(shown.headline, headlineText(locale, hundredths, team), `${where}: "${shown.headline}" disagrees with ${shown.signed} under "${shown.label}"`);
}
const hero = page => page.evaluate(() => ({
  headline: document.querySelector("#hero-index-headline")?.textContent.trim(),
  signed: document.querySelector("#hero-index-delta")?.textContent.trim(),
  label: document.querySelector("#hero-index-teams")?.hidden ? "" : document.querySelector("#hero-index-teams")?.textContent.trim(),
  chip: document.querySelector("#hero-index-chip")?.hidden ? "" : document.querySelector("#hero-index-chip")?.textContent.trim(),
  tickTime: Number(document.querySelector("#metrics-clock")?.dataset.timeMs),
  text: document.querySelector(".match-hero")?.innerText ?? "",
}));

await check("hero headline equals /api/metrics at three seek points; corner has no number", async () => {
  const rows = [];
  for (const scenario of ["late-siege", "calm-midfield", "corner"]) {
    const [metrics, replay] = await Promise.all([api("/api/metrics", scenario), api("/api/replay", scenario)]);
    const page = await browser.newPage(viewports.desktop);
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${base}/?scenario=${scenario}&view=svg`, { waitUntil: "networkidle" });
    await pause(page);
    for (const at of [0, 500, 1000]) {
      await seek(page, at);
      await page.waitForTimeout(150);
      const shown = await hero(page);
      assert.doesNotMatch(shown.text, /–\s*:\s*–|winning|ahead|likely|%/i, `${scenario}@${at}: hero shows a score, share or prediction: ${shown.text}`);
      if (metrics.trackingMetrics !== "supported") {
        assert.deepEqual({ headline: shown.headline, signed: shown.signed, label: shown.label, chip: shown.chip }, { headline: "Tracking metrics unavailable", signed: "N/A", label: "", chip: "" });
        rows.push({ scenario, at, ...shown, text: undefined });
        continue;
      }
      const tick = metrics.ticks.find(item => item.timeMs === shown.tickTime);
      assert.ok(tick, `${scenario}@${at}: no API tick at ${shown.tickTime}`);
      assert.deepEqual({ headline: shown.headline, signed: shown.signed, label: shown.label }, expectedHero(metrics, replay, tick), `${scenario}@${at}`);
      assertAgreement(shown, `${scenario}@${at}`);
      assert.equal(shown.chip, "model estimate, uncalibrated");
      assert.equal(await page.locator("#metric-index-delta").textContent(), tick.teams[metrics.teams[0]].indexDelta.toFixed(4), "hero and Control pane read the same tick");
      rows.push({ scenario, at, ...shown, text: undefined });
    }
    if (scenario === "calm-midfield") {
      const end = await hero(page);
      assert.equal(end.signed, `${MINUS}0.4287`);
      assert.equal(end.label, "Bastion City − Aurora Vale");
    }
    await page.close();
  }
  console.table(rows);
});

// Item 3 (PR #38): the server paints the headline number; scripts are not needed for it.
await check("the headline number is server-rendered: present before scripts, unchanged by hydration, no layout shift", async () => {
  const rows = [];
  for (const [vpName, vp] of Object.entries(viewports)) for (const scenario of ["late-siege", "calm-midfield", "corner"]) for (const locale of ["en-GB", "sw-KE", "hi-IN"]) {
    const [metrics, replay] = await Promise.all([api("/api/metrics", scenario), api("/api/replay", scenario)]);
    const context = await browser.newContext(vp);
    await context.addInitScript(() => {
      window.__shifts = 0;
      new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__shifts += entry.value; }).observe({ type: "layout-shift", buffered: true });
    });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    let held = 0;
    await page.route(/\/static\/.*\.js$/, async route => { held++; await gate; await route.continue(); });
    await page.goto(`${base}/?scenario=${scenario}&view=svg&locale=${locale}`, { waitUntil: "commit" });
    await page.waitForFunction(() => document.readyState !== "loading" && [...document.querySelectorAll('link[rel="stylesheet"]')].every(link => link.sheet));
    await page.evaluate(() => document.fonts.ready);
    const box = () => page.locator(".match-hero").evaluate(node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
    const before = { ...(await hero(page)), box: await box() };
    release();
    await page.waitForFunction(() => document.querySelector(".pitch-shell")?.dataset.renderer === "svg", null, { timeout: 30000 });
    await pause(page);
    await seek(page, 0);
    await page.waitForFunction(() => document.querySelector("#metrics-label")?.textContent !== "Loading metrics");
    await page.waitForTimeout(300);
    const after = { ...(await hero(page)), box: await box() };
    const shifts = await page.evaluate(() => window.__shifts);
    const where = `${vpName}/${scenario}/${locale}`;
    rows.push({ where, held, before: before.headline, signed: before.signed, heroBox: `${before.box.width}x${before.box.height}`, heroMoved: JSON.stringify(after.box) !== JSON.stringify(before.box), pageCLS: +shifts.toFixed(4) });
    assert.ok(held > 0, `${where}: no script was held`);
    if (metrics.trackingMetrics === "supported") {
      const start = [...metrics.ticks].reverse().find(tick => tick.timeMs <= replay.match.startMs);
      const expected = expectedHero(metrics, replay, start, locale);
      assert.match(before.headline, /\d\.\d\d/, `${where}: no number before scripts`);
      assert.equal(before.signed, expected.signed, `${where}: signed value before scripts`);
      assert.equal(before.label, expected.label, `${where}: label before scripts`);
      assert.equal(before.headline, expected.headline, `${where}: translated headline before scripts`);
      assert.ok(before.chip, `${where}: chip before scripts`);
      assertAgreement(before, where, locale);
    } else {
      assert.equal(before.signed, "N/A", `${where}: corner shows a number`);
      assert.equal(before.label, "", `${where}: corner shows a label`);
    }
    for (const field of ["headline", "signed", "label", "chip"]) assert.equal(after[field], before[field], `${where}: hydration changed the ${field}`);
    assert.deepEqual(after.box, before.box, `${where}: the hero moved or resized on hydration`);
    await context.close();
  }
  console.table(rows);
});

await check("the scenario name is visible on Live in the hero", async () => {
  for (const [vpName, vp] of Object.entries(viewports)) for (const scenario of ["late-siege", "corner"]) {
    const page = await browser.newPage(vp);
    await page.goto(`${base}/?scenario=${scenario}&view=svg`, { waitUntil: "networkidle" });
    const label = page.locator(".match-hero .fixture-label");
    assert.ok(await label.isVisible(), `${vpName}/${scenario}: scenario name hidden on Live`);
    const shown = (await label.textContent()).trim();
    assert.ok(shown, `${vpName}/${scenario}: empty scenario name`);
    assert.equal(shown, (await page.locator(".experience-screen-heading .fixture-label").textContent()).trim(), "the hero names the scenario the server rendered");
    assert.ok(await page.getByLabel("Score unavailable", { exact: true }).isVisible(), `${vpName}/${scenario}: score label`);
    assert.equal((await page.locator(".match-hero .score-unavailable").textContent()).trim(), "Score unavailable");
    await page.close();
  }
});

await check("the headline is the largest number above the fold; mobile pitch starts within 360px; header targets are 44px", async () => {
  const rows = [];
  for (const [vpName, vp] of Object.entries(viewports)) {
    const page = await browser.newPage(vp);
    await page.goto(`${base}/?scenario=late-siege&view=svg`, { waitUntil: "networkidle" });
    await pause(page);
    await seek(page, 1000);
    const layout = await page.evaluate(() => {
      const numbers = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const element = walker.currentNode.parentElement;
        if (!/\d/.test(walker.currentNode.data) || !element?.checkVisibility({ visibilityProperty: true }) || element.closest("svg,#pitch,.pitch-shell")) continue;
        const box = element.getBoundingClientRect();
        if (box.top < innerHeight && box.bottom > 0) numbers.push({ id: element.id || element.className, size: parseFloat(getComputedStyle(element).fontSize) });
      }
      const targets = [...document.querySelectorAll(".app-header button, .app-header .select2-selection, .app-header a")].filter(node => node.checkVisibility()).map(node => ({ name: node.textContent.trim() || node.getAttribute("aria-label"), height: Math.round(node.getBoundingClientRect().height) }));
      return { numbers, pitchTop: Math.round(document.querySelector(".pitch-shell").getBoundingClientRect().top + scrollY), targets };
    });
    const largest = layout.numbers.reduce((max, item) => item.size > max.size ? item : max);
    const headline = layout.numbers.find(item => item.id === "hero-index-headline");
    rows.push({ vp: vpName, pitchTop: layout.pitchTop, headline: headline?.size, largestOther: Math.max(...layout.numbers.filter(item => item !== headline).map(item => item.size)), smallestTarget: Math.min(...layout.targets.map(item => item.height)) });
    assert.ok(headline, `${vpName}: headline not above the fold`);
    assert.equal(largest.size, headline.size, `${vpName}: ${largest.id} (${largest.size}px) is larger than the headline (${headline.size}px)`);
    assert.ok(layout.numbers.filter(item => item !== headline).every(item => item.size < headline.size), `${vpName}: another number matches the headline size`);
    if (vpName === "mobile") {
      assert.ok(layout.pitchTop <= 360, `mobile pitch top is ${layout.pitchTop}px`);
      for (const target of layout.targets) assert.ok(target.height >= 44, `mobile header target "${target.name}" is ${target.height}px tall`);
    }
    await page.close();
  }
  console.table(rows);
});

// Counts animation frames in which a WebGL context issued draw calls.
function countDrawFrames() {
  window.__drawFrames = 0;
  let drew = false;
  for (const context of [WebGLRenderingContext, WebGL2RenderingContext]) {
    for (const name of ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced"]) {
      const original = context.prototype[name];
      if (original) context.prototype[name] = function (...args) { drew = true; return original.apply(this, args); };
    }
  }
  const tick = () => { if (drew) window.__drawFrames++; drew = false; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}

await check("switching renderer while paused keeps team colours and draws 0 frames once switched", async () => {
  const rows = [];
  const context = await browser.newContext(viewports.desktop);
  await context.addInitScript(countDrawFrames);
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${base}/?scenario=late-siege&view=three`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelector(".pitch-shell")?.dataset.renderer === "three", null, { timeout: 30000 });
  await pause(page);
  await seek(page, 500);
  const clock = await page.locator("#match-clock").textContent();
  const swatches = await page.evaluate(teamColours);
  const frames = () => page.evaluate(() => window.__drawFrames);
  for (const view of ["pixi", "svg", "three", "pixi", "three"]) {
    await press(page, `.view-controls [data-view="${view}"]`);
    await page.waitForFunction(view => document.querySelector(".pitch-shell")?.dataset.renderer === view && ![...document.querySelectorAll(".view-controls button")].some(button => button.disabled), view, { timeout: 30000 });
    // The switch itself paints the new renderer once; wait for that to finish, then require silence.
    let quiet = 0, last = await frames();
    for (let waited = 0; quiet < 3 && waited < 40; waited++) { await page.waitForTimeout(250); const now = await frames(); quiet = now === last ? quiet + 1 : 0; last = now; }
    const start = await frames();
    await page.waitForTimeout(2000);
    const drawn = await frames() - start;
    const kits = await kitColours(page, view, ["bastion", "vale"]);
    rows.push({ view, drawnWhilePaused: drawn, bastion: kits.bastion, vale: kits.vale, clock: await page.locator("#match-clock").textContent() });
    assert.equal(drawn, 0, `${view}: ${drawn} frames drawn in 2 s while paused`);
    assert.equal(await page.locator("#play-button").getAttribute("aria-label"), "Play", `${view}: the switch resumed playback`);
    assert.equal(await page.locator("#match-clock").textContent(), clock, `${view}: the clock moved while paused`);
    assert.deepEqual(await page.evaluate(teamColours), swatches, `${view}: swatch colours changed`);
    for (const id of ["bastion", "vale"]) assert.equal(kits[id], kit[id], `${view}: ${id} kit`);
  }
  await context.close();
  console.table(rows);
});

await browser.close();
if (errors.length) { console.error("page errors:", errors); failures.push("page errors"); }
if (failures.length) { console.error(`${failures.length} hero check(s) failed`); process.exit(1); }
console.log("Hero browser checks passed.");
