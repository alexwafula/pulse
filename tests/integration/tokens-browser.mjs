// Design-token checks for the match experience (D2a): team colour follows the
// team, not its list position; the audited text pairs reach WCAG AA; Inter is
// not fetched on /; /legacy renders the same pixels as a baseline capture.
// Needs a running Go server (PULSE_URL). Set PULSE_LEGACY_BASELINE to a
// directory of /legacy PNGs captured from main to compare; otherwise they are
// written to the output directory.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright-core";

const base = process.env.PULSE_URL ?? "http://127.0.0.1:8080";
const executablePath = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const require = createRequire(import.meta.url);
const { PNG } = require(path.join(path.dirname(require.resolve("playwright-core/package.json")), "lib/utilsBundle.js"));
const output = process.env.PULSE_TOKENS_OUT ?? path.join(os.tmpdir(), "pulse-tokens");
fs.mkdirSync(output, {recursive:true});
const views = ["svg","pixi","three"];
const viewports = {desktop:{viewport:{width:1440,height:900}}, mobile:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}};
const browser = await chromium.launch({executablePath,headless:true,args:["--use-angle=swiftshader-webgl","--enable-unsafe-swiftshader"]});
const failures = [];
const check = (name, fn) => fn().then(() => console.log(`ok ${name}`), error => { failures.push(name); console.error(`FAIL ${name}: ${error.message.split("\n")[0]}`); });
const seek = (page, value) => page.locator("#seek").evaluate((input, value) => { input.value = String(value); input.dispatchEvent(new Event("input",{bubbles:true})); }, value);
async function open(context, url, view) {
  const page = await context.newPage();
  await page.goto(`${base}${url}`, {waitUntil:"networkidle"});
  await page.waitForFunction(view => document.querySelector(".pitch-shell")?.dataset.renderer === view, view, {timeout:20000});
  if (await page.locator("#play-button").getAttribute("aria-label") === "Pause") await page.locator("#play-button").click();
  return page;
}
// DOM clicks: the replay keeps re-rendering, so Playwright's stability wait can time out.
const press = (page, selector) => page.locator(selector).first().evaluate(node => node.click());
const rgb = hex => `rgb(${[1,3,5].map(i => parseInt(hex.slice(i,i+2),16)).join(", ")})`;

// Aurora Vale is teams[1] in late-siege and teams[0] in corner.
await check("Aurora Vale keeps one colour across scenarios and renderers", async () => {
  const seen = [];
  const context = await browser.newContext(viewports.desktop);
  for (const scenario of ["late-siege","corner"]) for (const view of views) {
    const page = await open(context, `/?scenario=${scenario}&view=${view}`, view);
    const aurora = (await (await fetch(`${base}/api/replay?scenario=${scenario}`)).json()).match.teams.find(team => team.name === "Aurora Vale").id;
    const swatch = await page.locator(".team-name", {has:page.locator(".team-name-text", {hasText:"Aurora Vale"})}).locator(".team-swatch").evaluate(node => getComputedStyle(node).backgroundColor);
    const kit = view === "svg"
      ? await page.evaluate(() => { const title = [...document.querySelectorAll("#player-layer title")].find(node => node.textContent.endsWith(", Aurora Vale")); return title && getComputedStyle(title.parentElement.querySelector("circle")).fill; })
      : await page.locator("#canvas-host canvas").evaluate((node, id) => (node.dataset.teamColours ?? "").split(" ").find(entry => entry.startsWith(`${id}:`))?.slice(id.length + 1), aurora);
    seen.push({scenario, view, swatch, kit: kit?.startsWith("#") ? rgb(kit) : kit});
    await page.close();
  }
  await context.close();
  console.table(seen);
  assert.equal(new Set(seen.map(row => row.swatch)).size, 1, "Aurora Vale's swatch colour must not depend on the scenario");
  for (const row of seen) assert.equal(row.kit, row.swatch, `${row.scenario}/${row.view}: renderer kit must match the swatch`);
});

// The eight pairs that failed in DIRECTION section 2, measured on an opaque background.
const pairs = ["#home-pass-share","#away-pass-share","#home-pass-share-mobile","#away-pass-share-mobile",".experience-navigation button:not([aria-current]) span",".fixture-label",".team-sub",".half-label","#start-label","#evidence-state",".source-event-button span",".event-list button[aria-current=true] .event-time","#build-label"];
function measure(selectors) {
  const parse = value => { const parts = value.match(/rgba?\(([^)]+)\)/)[1].split(/[ ,/]+/).filter(Boolean).map(Number); return {r:parts[0],g:parts[1],b:parts[2],a:parts.length > 3 ? parts[3] : 1}; };
  const linear = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
  const luminance = c => .2126 * linear(c.r) + .7152 * linear(c.g) + .0722 * linear(c.b);
  const over = (top, bottom) => ({r:top.r*top.a+bottom.r*(1-top.a), g:top.g*top.a+bottom.g*(1-top.a), b:top.b*top.a+bottom.b*(1-top.a), a:1});
  const background = node => { const stack = []; for (let el = node; el; el = el.parentElement) { const c = parse(getComputedStyle(el).backgroundColor); if (c.a > 0) { stack.push(c); if (c.a >= 1) break; } } return stack.reverse().reduce((bg, c) => over(c, bg), {r:255,g:255,b:255,a:1}); };
  const visible = node => { const box = node.getBoundingClientRect(); return box.width > 0 && box.height > 0 && !node.closest("[hidden]") && getComputedStyle(node).visibility !== "hidden"; };
  return selectors.flatMap(selector => [...document.querySelectorAll(selector)].filter(visible).map(node => {
    const bg = background(node), fg = parse(getComputedStyle(node).color), a = luminance(fg.a < 1 ? over(fg, bg) : fg), b = luminance(bg);
    return {selector, text:node.textContent.trim().slice(0,28), fg:getComputedStyle(node).color, bg:`rgb(${[bg.r,bg.g,bg.b].map(Math.round).join(", ")})`, ratio:+((Math.max(a,b)+.05)/(Math.min(a,b)+.05)).toFixed(2)};
  }));
}
await check("audited text pairs reach 4.5:1", async () => {
  const rows = [];
  for (const [size, options] of Object.entries(viewports)) {
    const context = await browser.newContext(options);
    const page = await open(context, "/?scenario=late-siege&view=svg", "svg");
    await seek(page, 400); // mid-replay, so a timeline row is current
    rows.push(...(await page.evaluate(measure, pairs)).map(row => ({size, ...row})));
    await press(page, "#tab-control");
    await press(page, '[data-moment-type="SUSTAINED_PRESSURE"]');
    await page.waitForSelector(".source-event-button");
    rows.push(...(await page.evaluate(measure, pairs)).map(row => ({size, ...row})));
    await context.close();
  }
  const unique = [...new Map(rows.map(row => [`${row.size} ${row.selector} ${row.fg} ${row.bg}`, row])).values()];
  console.table(unique);
  for (const selector of pairs.filter(s => !s.includes("mobile"))) assert.ok(unique.some(row => row.selector === selector), `${selector} was not measured`);
  const failing = unique.filter(row => row.ratio < 4.5);
  assert.deepEqual(failing.map(row => `${row.size} ${row.selector} ${row.ratio}`), []);
});

await check("Inter is not requested on /", async () => {
  const context = await browser.newContext(viewports.desktop);
  const page = await context.newPage();
  const fonts = [];
  page.on("request", request => { if (request.resourceType() === "font") fonts.push(new URL(request.url()).pathname); });
  await page.goto(`${base}/?view=svg`, {waitUntil:"networkidle"});
  await page.evaluate(() => document.fonts.ready);
  assert.deepEqual(fonts.filter(name => name.includes("Inter")), [], `fonts on /: ${fonts.join(", ")}`);
  await context.close();
});

await check("/legacy renders the baseline pixels", async () => {
  for (const view of views) {
    const legacy = await open(await browser.newContext(viewports.desktop), `/legacy?scenario=corner&view=${view}`, view);
    await legacy.evaluate(() => document.fonts.ready);
    await legacy.waitForTimeout(1500);
    // Autoplay can start after open() paused it; pause again, then seek, so the frame depends only on the seek.
    if (await legacy.locator("#play-button").getAttribute("aria-label") === "Pause") await press(legacy, "#play-button");
    await seek(legacy, 400);
    await legacy.waitForTimeout(500);
    assert.equal(await legacy.locator("#play-button").getAttribute("aria-label"), "Play", `/legacy ${view} must be paused`);
    // SVG drop-shadow filters rasterise slightly differently run to run, even on main; compare without them.
    await legacy.addStyleTag({content:"svg *, svg { filter: none !important; }"});
    await legacy.waitForTimeout(200);
    const shot = await legacy.screenshot({animations:"disabled", caret:"hide", mask:[legacy.locator("#build-label")]});
    fs.writeFileSync(path.join(output, `legacy-${view}.png`), shot);
    await legacy.context().close();
    const baseline = process.env.PULSE_LEGACY_BASELINE && path.join(process.env.PULSE_LEGACY_BASELINE, `legacy-${view}.png`);
    if (!baseline) continue;
    const [a, b] = [PNG.sync.read(fs.readFileSync(baseline)), PNG.sync.read(shot)];
    assert.equal(`${a.width}x${a.height}`, `${b.width}x${b.height}`, `/legacy ${view} size changed`);
    let differ = 0;
    for (let i = 0; i < a.data.length; i += 4) if (a.data[i] !== b.data[i] || a.data[i+1] !== b.data[i+1] || a.data[i+2] !== b.data[i+2]) differ++;
    assert.equal(differ, 0, `/legacy ${view}: ${differ} pixels differ from the baseline`);
  }
});

await check("reduced motion never requests smooth scrolling", async () => {
  const context = await browser.newContext({...viewports.desktop, reducedMotion:"reduce"});
  await context.addInitScript(() => { const original = Element.prototype.scrollIntoView; window.scrollCalls = []; Element.prototype.scrollIntoView = function (options) { window.scrollCalls.push(typeof options === "object" ? options.behavior ?? "auto" : "auto"); return original.call(this, options); }; });
  const page = await open(context, "/?scenario=late-siege&view=svg", "svg");
  await seek(page, 1000);
  for (const selector of ["#tab-passing","[data-pass-evidence]"]) await press(page, selector);
  // "/" has no drawer Recap tab (D4b-2); its Recap evidence lives in the sidebar Recap section.
  await seek(page, 1000);
  await press(page, '.experience-navigation [data-section="recap"]');
  await page.waitForSelector('.story-content[data-panel="recap"] [data-inspect-event]');
  await press(page, '.story-content[data-panel="recap"] [data-inspect-event]');
  const calls = await page.evaluate(() => window.scrollCalls);
  assert.ok(calls.length > 0, "selecting evidence must scroll the pitch into view");
  assert.ok(!calls.includes("smooth"), `scrollIntoView behaviours: ${calls.join(", ")}`);
  await context.close();
});

await browser.close();
if (failures.length) { console.error(`${failures.length} failed: ${failures.join("; ")}`); process.exit(1); }
console.log("tokens browser checks passed");
