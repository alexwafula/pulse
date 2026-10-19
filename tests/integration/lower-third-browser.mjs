// Lower third, status badges, transport targets and motion (DIRECTION C2/C3, §3.3; D3b)
// against a running Go server (PULSE_URL) backed by the recorded Python service
// (PULSE_INSIGHT_SOURCE=python-recorded) or the template service.
// 1. The lower third holds the moment and the shot result: one overlay on the pitch.
// 2. Each insight status has its own accessible name, icon and shape; text is unchanged.
// 3. Play, restart and speed buttons are at least 44x44 at desktop and mobile widths.
// 4. Motion rows 1, 2 and 5 animate; under reduced motion only short opacity/colour fades remain.
// 5. The hero headline still equals /api/metrics at start, 88:11 and end of late-siege.
// 6. The Evidence trail's model-values label and tick row use the hero's estimate chip (D4a).
import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "playwright-core";

const base = process.env.PULSE_URL ?? "http://127.0.0.1:8080";
const source = process.env.PULSE_INSIGHT_SOURCE ?? "python-template";
const executablePath = process.env.CHROME_PATH ?? (process.platform === "linux" ? "/usr/bin/chromium-browser" : "C:/Program Files/Google/Chrome/Application/chrome.exe");
const browser = await chromium.launch({ executablePath, headless: true, args: ["--use-angle=swiftshader-webgl", "--enable-unsafe-swiftshader"] });
const viewports = { desktop: { viewport: { width: 1440, height: 900 } }, mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } };
const kit = { vale: "rgb(184, 55, 77)", bastion: "rgb(46, 104, 179)" };
const MODEL_LABEL = "model estimate, uncalibrated";
const failures = [];
const errors = [];
const check = (name, fn) => fn().then(() => console.log(`ok ${name}`), error => { failures.push(name); console.error(`FAIL ${name}: ${error.message}`); });
const api = async (path, scenario) => (await fetch(`${base}${path}?scenario=${scenario}`)).json();
const press = (page, selector) => page.locator(selector).first().evaluate(node => node.click());
const seek = (page, value) => page.locator("#seek").evaluate((input, value) => { input.value = String(value); input.dispatchEvent(new Event("input", { bubbles: true })); }, value);
const catalog = JSON.parse(fs.readFileSync(new URL("../../app/web/static/locales.json", import.meta.url), "utf8"));
async function pause(page) {
  const locale = await page.evaluate(() => document.body.dataset.locale ?? "en-GB");
  if (await page.locator("#play-button").getAttribute("aria-label") === (catalog[locale]?.Pause ?? "Pause")) await press(page, "#play-button");
}
async function open(page, query, view = "svg") {
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${base}/?${query}&view=${view}`, { waitUntil: "networkidle" });
  await page.waitForFunction(view => document.querySelector(".pitch-shell")?.dataset.renderer === view, view, { timeout: 30000 });
  await pause(page);
}
// The seek value whose clock is the first at or after timeMs.
const seekValue = (replay, timeMs) => Math.ceil((timeMs - replay.match.startMs) / (replay.match.endMs - replay.match.startMs) * 1000);

const [siegeReplay, siegeMoments, cornerReplay] = await Promise.all([api("/api/replay", "late-siege"), api("/api/moments", "late-siege"), api("/api/replay", "corner")]);
const pressure = siegeMoments.moments.find(moment => moment.type === "SUSTAINED_PRESSURE");
const AT_8811 = seekValue(siegeReplay, pressure.timeMs);

// Page-side: the overlays drawn over the pitch, and where the shot result lives.
function overlays() {
  const shell = document.querySelector(".pitch-shell");
  const box = node => { const r = node.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height }; };
  const captions = [...shell.querySelectorAll(".lower-third, .moment-banner, .action-result")]
    .filter(node => node.checkVisibility() && ["absolute", "fixed"].includes(getComputedStyle(node).position));
  const bar = document.querySelector(".lower-third");
  const row = node => node && !node.hidden ? { title: node.querySelector("strong")?.textContent, detail: node.querySelector("span")?.textContent, rule: getComputedStyle(node).borderLeftWidth, colour: getComputedStyle(node).borderLeftColor } : null;
  return {
    bars: document.querySelectorAll(".lower-third").length,
    captions: captions.map(node => node.className),
    orphans: [...document.querySelectorAll("#action-result, .action-result, #moment-banner, .moment-banner")].filter(node => !node.closest(".lower-third")).map(node => node.id || node.className),
    insideShell: Boolean(bar && shell.contains(bar)),
    bar: bar && bar.checkVisibility() ? box(bar) : null,
    shell: box(shell),
    title: bar ? parseFloat(getComputedStyle(bar.querySelector("strong")).fontSize) : 0,
    detail: bar ? parseFloat(getComputedStyle(bar.querySelector("span")).fontSize) : 0,
    moment: row(document.querySelector("#moment-banner")),
    result: row(document.querySelector("#action-result")),
    chip: [...(bar?.querySelectorAll(".estimate-chip") ?? [])].filter(node => node.checkVisibility()).map(node => node.textContent),
    // The bar's chip must look like the hero's: same colour, size and weight.
    chipStyle: [...(bar?.querySelectorAll(".estimate-chip") ?? [])].filter(node => node.checkVisibility()).map(node => { const s = getComputedStyle(node); return { color: s.color, fontSize: s.fontSize, fontWeight: s.fontWeight }; })[0] ?? null,
    heroChipStyle: (node => node && { color: getComputedStyle(node).color, fontSize: getComputedStyle(node).fontSize, fontWeight: getComputedStyle(node).fontWeight })(document.querySelector("#hero-index-chip:not([hidden])")),
  };
}

await check("the lower third absorbs the shot result: one overlay at 88:11 and at the corner end, in all renderers", async () => {
  const rows = [];
  const cases = [
    ...["svg", "pixi", "three"].flatMap(view => [["desktop", "late-siege", view, AT_8811], ["desktop", "corner", view, 1000]]),
    ["mobile", "late-siege", "svg", AT_8811], ["mobile", "corner", "svg", 1000],
  ];
  for (const [vpName, scenario, view, at] of cases) {
    const context = await browser.newContext(viewports[vpName]);
    const page = await context.newPage();
    await open(page, `scenario=${scenario}`, view);
    await seek(page, at);
    await page.waitForTimeout(400);
    const shown = await page.evaluate(overlays);
    const where = `${vpName}/${scenario}/${view}@${at}`;
    rows.push({ where, captions: shown.captions.join(" | "), moment: shown.moment?.title, result: shown.result?.title, chip: shown.chip.join(), chipStyle: shown.chipStyle && `${shown.chipStyle.color} ${shown.chipStyle.fontSize} ${shown.chipStyle.fontWeight}`, size: `${shown.title}/${shown.detail}` });
    assert.equal(shown.bars, 1, `${where}: lower-third elements`);
    assert.ok(shown.insideShell, `${where}: the lower third is not on the pitch`);
    assert.deepEqual(shown.orphans, [], `${where}: shot result or moment markup outside the lower third`);
    assert.equal(shown.captions.length, 1, `${where}: ${shown.captions.length} overlays on the pitch: ${shown.captions.join(" | ")}`);
    assert.match(shown.captions[0], /\blower-third\b/, `${where}: the visible overlay is not the lower third`);
    assert.ok(shown.bar.bottom <= shown.shell.bottom && shown.shell.bottom - shown.bar.bottom <= 24, `${where}: the lower third is not at the bottom of the pitch`);
    assert.ok(shown.bar.top > shown.shell.top + shown.shell.height / 2, `${where}: the lower third reaches the top half of the pitch`);
    assert.deepEqual([shown.title, shown.detail], [15, 13], `${where}: lower-third type`);
    if (scenario === "late-siege") {
      assert.equal(shown.moment?.title, "Sustained pressure", `${where}: moment title`);
      assert.ok(shown.moment.detail.endsWith(` / ${MODEL_LABEL}`), `${where}: moment detail "${shown.moment.detail}"`);
      assert.deepEqual(shown.chip, [MODEL_LABEL], `${where}: the estimate chip`);
      assert.ok(shown.heroChipStyle, `${where}: hero chip not shown`);
      assert.deepEqual(shown.chipStyle, shown.heroChipStyle, `${where}: the bar's estimate chip differs from the hero's`);
      assert.deepEqual([shown.moment.rule, shown.moment.colour], ["3px", kit[pressure.teamId]], `${where}: moment rule`);
      assert.equal(shown.result, null, `${where}: no shot at 88:11`);
    } else {
      assert.equal(shown.result?.title, "Shot blocked", `${where}: shot result`);
      assert.match(shown.result.detail, /· Aurora Vale · 27:58$/, `${where}: shot detail`);
      assert.deepEqual([shown.result.rule, shown.result.colour], ["3px", kit.vale], `${where}: shot rule`);
      assert.ok(shown.moment?.title, `${where}: the corner moment shares the bar`);
    }
    await context.close();
  }
  console.table(rows);
});

// #41 chip styling, extended in D4a: the label above a moment's model values in the Evidence
// trail is the same canonical chip as the hero's and the tick row's.
await check("the model-values label and the tick row use the hero's estimate chip", async () => {
  const rows = [];
  for (const [vpName, vp] of Object.entries(viewports)) {
    const page = await browser.newPage(vp);
    await open(page, "scenario=late-siege");
    await seek(page, 1000);
    await press(page, "#tab-control");
    await press(page, '#moment-list [data-moment-type="SUSTAINED_PRESSURE"]');
    await page.waitForFunction(() => document.querySelector("#moment-values-label")?.checkVisibility());
    await pause(page);
    const shown = await page.evaluate(() => {
      const style = node => node && node.checkVisibility() ? (s => ({ text: node.textContent.trim(), color: s.color, fontSize: s.fontSize, fontWeight: s.fontWeight }))(getComputedStyle(node)) : null;
      return {
        values: style(document.querySelector("#moment-values-label .estimate-chip")),
        ticks: style(document.querySelector("#evidence-list summary .estimate-chip")),
        hero: style(document.querySelector("#hero-index-chip:not([hidden])")),
        labelText: document.querySelector("#moment-values-label").textContent.trim(),
      };
    });
    rows.push({ vp: vpName, values: shown.values && `${shown.values.color} ${shown.values.fontSize} ${shown.values.fontWeight}`, ticks: shown.ticks && `${shown.ticks.color} ${shown.ticks.fontSize} ${shown.ticks.fontWeight}`, hero: shown.hero && `${shown.hero.color} ${shown.hero.fontSize} ${shown.hero.fontWeight}` });
    assert.equal(shown.labelText, MODEL_LABEL, `${vpName}: label text`);
    assert.ok(shown.hero, `${vpName}: hero chip not shown`);
    assert.ok(shown.values, `${vpName}: the model-values label is not an estimate chip`);
    assert.equal(shown.values.text, MODEL_LABEL, `${vpName}: model-values chip text`);
    const { text: _v, ...valuesStyle } = shown.values, { text: _h, ...heroStyle } = shown.hero, { text: _t, ...ticksStyle } = shown.ticks ?? {};
    assert.deepEqual(valuesStyle, heroStyle, `${vpName}: the model-values chip differs from the hero's`);
    assert.deepEqual(ticksStyle, heroStyle, `${vpName}: the tick-row chip differs from the hero's`);
    await page.close();
  }
  console.table(rows);
});

// Page-side: what a viewer and a screen reader get from one status badge.
function badge(selector) {
  const node = document.querySelector(selector);
  if (!node) return null;
  const style = getComputedStyle(node);
  const icon = node.querySelector("svg.status-icon");
  const opaque = element => { for (let n = element; n; n = n.parentElement) { const bg = getComputedStyle(n).backgroundColor; if (bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") return bg; } return getComputedStyle(document.body).backgroundColor; };
  const channel = value => { const c = value / 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; };
  const lum = rgb => { const [r, g, b] = rgb.match(/[\d.]+/g).map(Number); return .2126 * channel(r) + .7152 * channel(g) + .0722 * channel(b); };
  const [fg, bg] = [lum(style.color), lum(opaque(node))];
  return {
    text: node.textContent,
    status: node.dataset.status ?? null,
    icon: icon && icon.checkVisibility() ? icon.dataset.icon ?? "unnamed" : null,
    pill: parseFloat(style.borderTopLeftRadius) >= 9 && (style.backgroundColor !== "rgba(0, 0, 0, 0)" || parseFloat(style.borderTopWidth) > 0),
    fill: style.backgroundColor, border: `${style.borderTopWidth} ${style.borderTopStyle}`, colour: style.color,
    title: node.getAttribute("title"),
    ratio: +((Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05)).toFixed(2),
  };
}
async function accessible(page, selector) {
  const cdp = await page.context().newCDPSession(page);
  const { root } = await cdp.send("DOM.getDocument", { depth: 0 });
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
  if (!nodeId) { await cdp.detach(); return { role: "missing", name: "", description: "" }; }
  const { nodes } = await cdp.send("Accessibility.getPartialAXTree", { nodeId, fetchRelatives: false });
  await cdp.detach();
  const node = nodes.find(item => !item.ignored) ?? nodes[0];
  return { role: node.role?.value ?? "", name: node.name?.value ?? "", description: node.description?.value ?? "" };
}

await check("each insight status has a distinct accessible name, icon and shape; text unchanged; contrast 4.5:1", async () => {
  const states = [];
  const capture = async (page, label, selector, expected) => {
    const shown = await page.evaluate(badge, selector);
    states.push({ label, selector, expected, ...shown, ...(await accessible(page, selector)) });
  };
  const verifiedFeed = async () => {
    const feed = await (await fetch(`${base}/api/insights?scenario=corner&persona=CASUAL&locale=en-GB`)).json();
    for (const cue of feed.cues) cue.verification = { ...cue.verification, status: "VERIFIED" };
    return {version:"pulse-inspection-v1",feed,inspections:[]};
  };
  const scenes = [
    { label: "waiting", query: "scenario=corner", at: 0, expected: "Waiting" },
    { label: "verified-recorded", query: "scenario=corner", at: 1000, expected: source === "python-recorded" ? "Verified (recorded)" : "Template" },
    { label: "template", query: "scenario=corner&persona=ANALYST", at: 1000, expected: "Template" },
    { label: "verified", query: "scenario=corner", at: 1000, expected: "Verified", route: async () => ({ contentType: "application/json", body: JSON.stringify(await verifiedFeed()) }) },
    { label: "no-moment", query: "scenario=corner", at: 1000, expected: "No moment", route: async () => ({ contentType: "application/json", body: JSON.stringify({version:"pulse-inspection-v1",feed:{schemaVersion:"2.0.0",cues:[]},inspections:[]}) }) },
    { label: "unavailable", query: "scenario=corner", at: 1000, expected: "Unavailable", route: async () => ({ status: 503, body: "Unavailable" }) },
  ];
  for (const scene of scenes) {
    const page = await browser.newPage(viewports.desktop);
    if (scene.route) await page.route("**/api/agent-inspection?**", async route => route.fulfill(await scene.route()));
    await open(page, scene.query);
    await seek(page, scene.at);
    await page.waitForFunction(text => document.querySelector("#insight-status")?.textContent === text, scene.expected, { timeout: 15000 });
    await page.waitForTimeout(700);
    await capture(page, scene.label, "#insight-status", scene.expected);
    await page.close();
  }
  const page = await browser.newPage(viewports.desktop);
  await open(page, "scenario=late-siege");
  await seek(page, AT_8811);
  await page.waitForFunction(() => document.querySelector("#pressure-insight")?.checkVisibility());
  await page.waitForTimeout(400);
  await capture(page, "pressure-template", "#pressure-status", "Template");
  const panelStatus = await page.locator("#pressure-insight").getAttribute("data-status");
  const errorOnSurface = await page.evaluate(() => {
    const style = getComputedStyle(document.querySelector(".insight-panel"));
    const hex = name => style.getPropertyValue(name).trim();
    const channel = v => { const c = parseInt(v, 16) / 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; };
    const lum = h => .2126 * channel(h.slice(1, 3)) + .7152 * channel(h.slice(3, 5)) + .0722 * channel(h.slice(5, 7));
    const [a, b] = [lum(hex("--c-error")), lum(hex("--c-surface"))];
    return { error: hex("--c-error"), surface: hex("--c-surface"), ratio: +((Math.max(a, b) + .05) / (Math.min(a, b) + .05)).toFixed(2) };
  });
  await page.close();
  console.table(states.map(({ label, text, status, icon, pill, fill, border, colour, role, name, description, ratio }) => ({ label, text, status, icon, pill, fill, border, colour, role, name, description, ratio })));
  console.log("error on surface", errorOnSurface);

  const by = Object.fromEntries(states.map(state => [state.label, state]));
  for (const state of states) {
    assert.equal(state.text, state.expected, `${state.label}: visible text`);
    assert.ok(state.ratio >= 4.5, `${state.label}: contrast ${state.ratio}`);
    assert.equal(state.name, state.expected, `${state.label}: accessible name "${state.name}"`);
  }
  assert.equal(panelStatus, "template", "#pressure-insight data-status");
  assert.ok(errorOnSurface.ratio >= 4.5, `error on surface ${errorOnSurface.ratio}`);
  // Accessible names differ for every status the insight badge can show.
  const insight = states.filter(state => state.selector === "#insight-status");
  assert.equal(new Set(insight.map(state => state.name)).size, new Set(insight.map(state => state.expected)).size, `accessible names repeat: ${insight.map(state => state.name)}`);
  // Variants: icon AND colour differ, never colour alone; the quiet states are plain text.
  const variants = { verified: "check", template: "file-text", unavailable: "circle-alert" };
  if (source === "python-recorded") assert.equal(by["verified-recorded"].status, "verified");
  for (const [label, status] of [["verified", "verified"], ["template", "template"], ["pressure-template", "template"], ["unavailable", "unavailable"], ["waiting", "waiting"], ["no-moment", "none"]]) {
    assert.equal(by[label].status, status, `${label}: data-status`);
    assert.equal(by[label].icon, variants[status] ?? null, `${label}: icon`);
  }
  assert.ok(by.verified.pill && by.template.pill, "Verified and Template are pills");
  assert.notEqual(by.verified.fill, "rgba(0, 0, 0, 0)", "Verified has a tint");
  assert.equal(by.template.fill, "rgba(0, 0, 0, 0)", "Template is an outline");
  assert.equal(by.template.border, "1px solid", "Template is an outline");
  for (const label of ["waiting", "no-moment", "unavailable"]) assert.equal(by[label].pill, false, `${label}: no pill`);
  assert.notEqual(by.verified.colour, by.template.colour, "Verified and Template share a colour");
  assert.notEqual(by.unavailable.colour, by.waiting.colour, "Unavailable and Waiting share a colour");
  // Tooltip: the exact wording on the recorded Verified badge only; it names no model.
  if (source === "python-recorded") {
    assert.equal(by["verified-recorded"].title, "content-checked recording");
    assert.equal(by["verified-recorded"].description, "content-checked recording");
  }
  for (const state of states) if (state.title) assert.doesNotMatch(state.title, /model|gpt|foundry|openai|azure|llm/i, `${state.label}: tooltip names a model`);
  for (const label of ["waiting", "template", "no-moment", "unavailable", "pressure-template"]) assert.equal(by[label].title, null, `${label}: tooltip`);
});

await check("play, restart and speed buttons are at least 44x44; the hero does not shift", async () => {
  const rows = [];
  for (const [vpName, vp] of Object.entries(viewports)) {
    const context = await browser.newContext(vp);
    await context.addInitScript(() => {
      // Vertical moves or resizes inside the hero. Text in the hero moves a few px sideways
      // when the web fonts swap in (also on main); that is not a transport-driven shift.
      window.__heroShifts = [];
      new PerformanceObserver(list => { for (const entry of list.getEntries()) for (const item of entry.sources ?? []) {
        const [a, b] = [item.previousRect, item.currentRect];
        if (item.node?.closest?.(".match-hero") && (a.y !== b.y || a.height !== b.height)) window.__heroShifts.push({ node: item.node.className, from: [a.y, a.height], to: [b.y, b.height] });
      } }).observe({ type: "layout-shift", buffered: true });
    });
    const page = await context.newPage();
    await open(page, "scenario=late-siege");
    await page.waitForTimeout(300);
    const targets = await page.evaluate(() => [...document.querySelectorAll(".pitch-column #play-button, .pitch-column #restart-button, .pitch-column [data-speed]")]
      .map(node => { const r = node.getBoundingClientRect(); return { name: node.getAttribute("aria-label") ?? node.textContent.trim(), width: +r.width.toFixed(1), height: +r.height.toFixed(1) }; }));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    const heroShifts = await page.evaluate(() => window.__heroShifts);
    rows.push(...targets.map(target => ({ vp: vpName, ...target })));
    assert.equal(targets.length, 5, `${vpName}: transport buttons found`);
    for (const target of targets) assert.ok(target.width >= 44 && target.height >= 44, `${vpName}: "${target.name}" is ${target.width}x${target.height}`);
    assert.equal(overflow, 0, `${vpName}: horizontal overflow`);
    assert.deepEqual(heroShifts, [], `${vpName}: the hero shifted`);
    await context.close();
  }
  console.table(rows);
});

// Init script: record every animation and transition that runs, with its target and keyframes.
function recordMotion() {
  window.__motion = [];
  const seen = new WeakSet();
  const name = node => node instanceof Element ? `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ""}${[...node.classList].map(c => `.${c}`).join("")}` : String(node);
  const sample = () => {
    for (const animation of document.getAnimations()) {
      if (seen.has(animation)) continue;
      seen.add(animation);
      const effect = animation.effect, timing = effect?.getComputedTiming();
      const target = effect?.target;
      const properties = animation.transitionProperty ? [animation.transitionProperty]
        : [...new Set((effect?.getKeyframes() ?? []).flatMap(frame => Object.keys(frame).filter(key => !["offset", "computedOffset", "easing", "composite"].includes(key))))];
      window.__motion.push({ kind: animation.constructor.name, name: animation.animationName ?? "", target: name(target), row: target?.closest?.(".lower-third") ? "lower-third" : target?.closest?.(".status-badge") ? "badge" : target?.closest?.("#hero-index-headline") ? "headline" : "", properties: properties.join(","), duration: Number(timing?.duration) || 0, delay: Number(timing?.delay) || 0, at: Math.round(performance.now()) });
    }
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
}
// A metrics feed whose indexDelta changes sign half way (test-only, derived from the real feed).
async function flippedMetrics() {
  // The page asks for the control grid too; the routed feed must match that request.
  const metrics = await (await fetch(`${base}/api/metrics?scenario=late-siege&grid=1`)).json();
  const [first, second] = metrics.teams;
  metrics.ticks.forEach((tick, i) => { if (i >= metrics.ticks.length / 2) { tick.teams[first].indexDelta *= -1; tick.teams[second].indexDelta *= -1; } });
  return metrics;
}
const MOTION = /transform|translate|scale|rotate|width|height|top|left|bottom|right|inset|margin|padding|stroke-dash|strokeDash/i;
const FADE = /^(opacity|color|background-color|backgroundColor|border-color|borderColor|fill|stroke|outline-color)(,(opacity|color|background-color|backgroundColor|border-color|borderColor|fill|stroke))*$/;

async function runMotion(reduced) {
  const context = await browser.newContext({ ...viewports.desktop, reducedMotion: reduced ? "reduce" : "no-preference" });
  await context.addInitScript(recordMotion);
  const flipped = await flippedMetrics();
  const page = await context.newPage();
  await page.route("**/api/metrics?**", route => route.fulfill({ contentType: "application/json", body: JSON.stringify(flipped) }));
  const finals = {};
  // Row 1: the lower third enters at 88:11 and leaves after its moment window.
  await open(page, "scenario=late-siege");
  await seek(page, AT_8811);
  // Time the 150 ms from the bar appearing (the motion's start), not from the seek input.
  await page.waitForFunction(() => document.querySelector(".lower-third")?.checkVisibility(), null, { polling: "raf" });
  await page.waitForTimeout(150);
  // Let the entry finish, so the exit is a fresh transition rather than a shortened reversal.
  if (!reduced) await page.waitForTimeout(250);
  finals.entered = await page.evaluate(() => { const bar = document.querySelector(".lower-third"); return bar && { visible: bar.checkVisibility(), opacity: getComputedStyle(bar).opacity, translate: getComputedStyle(bar).translate, transform: getComputedStyle(bar).transform, running: bar.getAnimations({ subtree: true }).filter(a => a.playState === "running").length }; });
  await seek(page, 400);
  await page.waitForFunction(() => document.querySelector(".lower-third")?.dataset.state === "leaving" || document.querySelector(".lower-third")?.hidden, null, { polling: "raf" });
  await page.waitForTimeout(reduced ? 150 : 400);
  finals.left = await page.evaluate(() => { const bar = document.querySelector(".lower-third"); return bar && { visible: bar.checkVisibility(), running: bar.getAnimations({ subtree: true }).filter(a => a.playState === "running").length }; });
  // Row 5: the headline sign flips across the middle of the routed feed.
  await seek(page, 300);
  await page.waitForTimeout(200);
  await seek(page, 700);
  await page.waitForTimeout(250);
  finals.headline = await page.evaluate(() => document.querySelector("#hero-index-headline")?.getAnimations().filter(a => a.playState === "running").length);
  const siege = await page.evaluate(() => window.__motion);
  await page.close();
  // Row 2: the insight badge settles from Waiting to its status.
  const corner = await context.newPage();
  await open(corner, "scenario=corner");
  await seek(corner, 0);
  await corner.waitForFunction(() => document.querySelector("#insight-status")?.textContent === "Waiting");
  await seek(corner, 1000);
  await corner.waitForFunction(() => document.querySelector("#insight-status")?.textContent !== "Waiting");
  await corner.waitForTimeout(150);
  finals.badge = await corner.evaluate(() => {
    const node = document.querySelector("#insight-status"), path = node.querySelector("svg.status-icon path");
    return { opacity: getComputedStyle(node).opacity, dashoffset: path ? getComputedStyle(path).strokeDashoffset : null, running: node.getAnimations({ subtree: true }).filter(a => a.playState === "running").length };
  });
  const settle = await corner.evaluate(() => window.__motion);
  await context.close();
  return { motion: [...siege, ...settle], finals };
}

await check("reduced motion: motion rows only fade opacity or colour for at most 120 ms and settle within 150 ms", async () => {
  const { motion, finals } = await runMotion(true);
  const rows = motion.filter(item => item.row);
  console.table(rows);
  console.log("page-wide animations under reduced motion:", motion.length, "final states:", JSON.stringify(finals));
  assert.ok(finals.entered?.visible, "the lower third is not shown at 88:11");
  assert.equal(finals.entered.opacity, "1", "the lower third is not at full opacity within 150 ms");
  assert.ok(["none", "0px"].includes(finals.entered.translate) && finals.entered.transform === "none", `the lower third moved: ${finals.entered.translate} ${finals.entered.transform}`);
  assert.equal(finals.entered.running, 0, "lower-third animations still running after 150 ms");
  assert.equal(finals.left?.visible, false, "the lower third did not leave within 150 ms");
  assert.equal(finals.headline, 0, "headline animation under reduced motion");
  assert.equal(finals.badge.opacity, "1", "badge not at full opacity");
  assert.equal(finals.badge.running, 0, "badge animations still running after 150 ms");
  if (finals.badge.dashoffset !== null) assert.ok(["0", "0px"].includes(finals.badge.dashoffset), `check icon not fully drawn: ${finals.badge.dashoffset}`);
  for (const item of rows) {
    assert.doesNotMatch(item.properties, MOTION, `${item.row} ${item.target} animates ${item.properties}`);
    assert.match(item.properties, FADE, `${item.row} ${item.target} animates ${item.properties}`);
    assert.ok(item.duration + item.delay <= 120, `${item.row} ${item.target} runs ${item.delay}+${item.duration} ms`);
  }
  assert.equal(rows.filter(item => item.row === "headline").length, 0, "the headline tints under reduced motion");
  assert.equal(rows.filter(item => item.row === "badge").length, 0, "the badge animates under reduced motion (expected an instant swap)");
});

await check("without reduced motion rows 1, 2 and 5 animate as DIRECTION §3.3 specifies", async () => {
  const { motion, finals } = await runMotion(false);
  const rows = motion.filter(item => item.row);
  console.table(rows);
  const has = (row, test, what) => assert.ok(rows.some(item => item.row === row && test(item)), `${row}: no ${what}`);
  has("lower-third", item => /translate|transform/.test(item.properties) && item.duration === 200, "200 ms rise");
  has("lower-third", item => item.properties === "opacity" && item.duration === 200, "200 ms fade in");
  has("lower-third", item => item.properties === "opacity" && item.duration === 160, "160 ms fade out");
  has("badge", item => item.properties.includes("opacity") && item.duration === 200, "200 ms cross-fade");
  has("badge", item => /stroke-dashoffset|strokeDashoffset/.test(item.properties) && item.duration === 320 && item.delay === 200, "320 ms check draw after the fade");
  has("headline", item => /background-?color/i.test(item.properties) && item.duration === 200, "200 ms tint on the sign flip");
  assert.ok(rows.every(item => !/width|height|top|left|bottom|right/i.test(item.properties)), "a motion row animates layout");
  assert.equal(finals.entered?.visible, true, "the lower third is not shown at 88:11");
});

// Expected hero text from the API alone (as hero-browser.mjs derives it).
const MINUS = "\u2212";
function expectedHero(metrics, replay, tick) {
  const name = id => replay.match.teams.find(team => team.id === id).name;
  const [first, second] = metrics.teams, delta = tick.teams[first].indexDelta;
  const hundredths = Math.floor((Math.round(Math.abs(delta) * 1e4) + 50) / 100);
  const [whole, fraction = ""] = String(Math.abs(delta)).split(".");
  const exact = `${whole}.${fraction.padEnd(4, "0")}`;
  return {
    headline: hundredths === 0 ? "Neither team's control index is higher" : `${name(delta < 0 ? second : first)}'s control index is ${(hundredths / 100).toFixed(2)} higher`,
    signed: delta > 0 ? `+${exact}` : delta < 0 ? `${MINUS}${exact}` : exact,
  };
}

await check("hero headline and signed value equal /api/metrics at start, 88:11 and end of late-siege", async () => {
  const metrics = await api("/api/metrics", "late-siege");
  const page = await browser.newPage(viewports.desktop);
  await open(page, "scenario=late-siege");
  const rows = [];
  for (const [label, at] of [["start", 0], ["88:11", AT_8811], ["end", 1000]]) {
    await seek(page, at);
    await page.waitForTimeout(200);
    const shown = await page.evaluate(() => ({ clock: document.querySelector("#match-clock").textContent, headline: document.querySelector("#hero-index-headline").textContent.trim(), signed: document.querySelector("#hero-index-delta").textContent.trim(), tickTime: Number(document.querySelector("#metrics-clock")?.dataset.timeMs) }));
    const tick = metrics.ticks.find(item => item.timeMs === shown.tickTime);
    assert.ok(tick, `${label}: no API tick at ${shown.tickTime}`);
    assert.deepEqual({ headline: shown.headline, signed: shown.signed }, expectedHero(metrics, siegeReplay, tick), label);
    rows.push({ label, ...shown });
  }
  assert.equal(rows[0].signed, `${MINUS}0.4499`);
  assert.equal(rows[0].headline, "Aurora Vale's control index is 0.45 higher");
  assert.equal(rows[1].clock, "88:11");
  await page.close();
  console.table(rows);
});

await browser.close();
if (errors.length) { console.error("page errors:", errors); failures.push("page errors"); }
if (failures.length) { console.error(`${failures.length} D3b check(s) failed`); process.exit(1); }
console.log("Lower third browser checks passed.");
