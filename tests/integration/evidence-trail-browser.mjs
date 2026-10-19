// Evidence trail, event timeline and motion row 3 (DIRECTION C4, C6, §3.3 row 3; D4a)
// against a running Go server (PULSE_URL).
// 1. Source events come first, in API order; metric ticks sit behind one keyboard-operable
//    disclosure whose label count and range come from the API's tickTimesMs.
// 2. While an evidence clip plays on Live (a moment's, or the insight's next to its Fact check),
//    the trail sits under the pitch and the pitch stays in view.
// 3. Trail and timeline text reach 4.5:1; timeline team dots reach 3:1.
// 4. Each timeline dot wears the server-rendered kit of its event's team id.
// 5. The range marker grows over 320 ms and the active row tints over 120 ms; under reduced
//    motion the marker is full width on its first frame and only short colour fades remain.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const base = process.env.PULSE_URL ?? "http://127.0.0.1:8080";
const executablePath = process.env.CHROME_PATH ?? (process.platform === "linux" ? "/usr/bin/chromium-browser" : "C:/Program Files/Google/Chrome/Application/chrome.exe");
const browser = await chromium.launch({ executablePath, headless: true, args: ["--use-angle=swiftshader-webgl", "--enable-unsafe-swiftshader"] });
const viewports = { desktop: { viewport: { width: 1440, height: 900 } }, mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } };
const kit = { a: "rgb(184, 55, 77)", b: "rgb(46, 104, 179)" };
const MODEL_LABEL = "model estimate, uncalibrated";
const failures = [];
const errors = [];
const check = (name, fn) => fn().then(() => console.log(`ok ${name}`), error => { failures.push(name); console.error(`FAIL ${name}: ${error.message}`); });
const api = async (path, scenario) => (await fetch(`${base}${path}?scenario=${scenario}`)).json();
const press = (page, selector) => page.locator(selector).first().evaluate(node => node.click());
const seek = (page, value) => page.locator("#seek").evaluate((input, value) => { input.value = String(value); input.dispatchEvent(new Event("input", { bubbles: true })); }, value);
const clock = ms => { const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
const pause = async page => { if (await page.locator("#play-button").getAttribute("aria-label") === "Pause") await press(page, "#play-button"); };
async function open(page, query, view = "svg") {
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${base}/?${query}&view=${view}`, { waitUntil: "networkidle" });
  await page.waitForFunction(view => document.querySelector(".pitch-shell")?.dataset.renderer === view, view, { timeout: 30000 });
  await page.waitForFunction(() => !["Loading moments", ""].includes(document.querySelector("#moments-state")?.textContent ?? "") || document.querySelectorAll("#moment-list button").length > 0);
  await pause(page);
}
// Starts a moment's evidence clip the way a viewer does: Control tab, then the moment.
async function playMoment(page, moment) {
  await seek(page, 1000);
  await press(page, "#tab-control");
  await press(page, `#moment-list [data-moment-type="${moment.type}"][data-moment-time="${moment.timeMs}"]`);
  await page.waitForFunction(() => !document.querySelector("#evidence-return")?.hidden);
}

const [siegeReplay, siegeMoments] = await Promise.all([api("/api/replay", "late-siege"), api("/api/moments", "late-siege")]);
const pressure = siegeMoments.moments.find(moment => moment.type === "SUSTAINED_PRESSURE");
const swing = siegeMoments.moments.find(moment => moment.type === "CONTROL_SWING");
const tickLabel = ticks => ticks.length === 1 ? `1 metric tick ${clock(ticks[0])}` : `${ticks.length} metric ticks ${clock(ticks[0])}\u2013${clock(ticks.at(-1))}`;

// Page-side: the trail as rows, in document order.
function trail() {
  const list = document.querySelector("#evidence-list");
  const rows = [...list.children].map(row => {
    const event = row.querySelector(":scope > [data-source-event]");
    const disclosure = row.querySelector(":scope > details, :scope [aria-expanded]");
    return event ? { kind: "event", id: event.dataset.sourceEvent } : disclosure ? { kind: "ticks" } : { kind: "other", html: row.outerHTML.slice(0, 80) };
  });
  const disclosures = [...list.querySelectorAll("details, [aria-expanded]")];
  const details = list.querySelector("details");
  const summary = details?.querySelector("summary");
  const ticks = [...list.querySelectorAll("[data-source-tick]")];
  return {
    rows,
    disclosures: disclosures.length,
    open: details ? details.open : null,
    label: summary?.querySelector(".evidence-ticks-label")?.textContent ?? null,
    chip: summary ? [...summary.querySelectorAll(".estimate-chip")].map(node => node.textContent) : [],
    ticks: ticks.map(node => Number(node.dataset.sourceTick)),
    visibleTicks: ticks.filter(node => node.checkVisibility()).length,
  };
}

await check("source events first and in order; metric ticks behind one disclosure labelled from the API", async () => {
  for (const [vpName, vp] of Object.entries(viewports)) {
    const page = await browser.newPage(vp);
    await open(page, "scenario=late-siege");
    await playMoment(page, pressure);
    const shown = await page.evaluate(trail);
    const where = `${vpName}/pressure`;
    assert.deepEqual(shown.rows.slice(0, 3), ["evt-03", "evt-04", "evt-05"].map(id => ({ kind: "event", id })), `${where}: first rows ${JSON.stringify(shown.rows)}`);
    assert.deepEqual(pressure.reasons, ["evt-03", "evt-04", "evt-05"], "fixture: pressure reasons");
    assert.deepEqual(shown.rows.map(row => row.kind), ["event", "event", "event", "ticks"], `${where}: row kinds`);
    assert.equal(shown.disclosures, 1, `${where}: tick disclosures`);
    assert.equal(shown.open, false, `${where}: the disclosure is not collapsed by default`);
    assert.deepEqual(shown.ticks, pressure.tickTimesMs, `${where}: [data-source-tick] nodes`);
    assert.equal(shown.ticks.length, 6, `${where}: [data-source-tick] count`);
    assert.equal(shown.visibleTicks, 0, `${where}: tick rows show while collapsed`);
    assert.equal(shown.label, tickLabel(pressure.tickTimesMs), `${where}: collapsed label`);
    assert.equal(shown.label, "6 metric ticks 88:09\u201388:11", `${where}: collapsed label text`);
    assert.deepEqual(shown.chip, [MODEL_LABEL], `${where}: estimate chip`);
    await press(page, "#evidence-list summary");
    const expanded = await page.evaluate(trail);
    assert.equal(expanded.open, true, `${where}: the disclosure does not open`);
    assert.equal(expanded.visibleTicks, 6, `${where}: expanded tick rows`);
    await page.close();
  }
  // Tick-only evidence (CONTROL_SWING) never cites events, and a single tick reads in the singular.
  const page = await browser.newPage(viewports.desktop);
  await page.route("**/api/moments?**", async route => {
    const body = await (await route.fetch()).json();
    const target = body.moments.find(moment => moment.type === "CONTROL_SWING" && moment.timeMs !== swing.timeMs);
    target.tickTimesMs = target.tickTimesMs.slice(-1);
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
  });
  await open(page, "scenario=late-siege");
  await playMoment(page, swing);
  const two = await page.evaluate(trail);
  assert.deepEqual(two.rows.map(row => row.kind), ["ticks"], "swing: rows");
  assert.equal(two.label, tickLabel(swing.tickTimesMs), "swing: label");
  assert.equal(two.ticks.length, swing.tickTimesMs.length, "swing: tick nodes");
  const single = siegeMoments.moments.find(moment => moment.type === "CONTROL_SWING" && moment.timeMs !== swing.timeMs);
  await press(page, "#evidence-return");
  await playMoment(page, single);
  const one = await page.evaluate(trail);
  assert.equal(one.label, `1 metric tick ${clock(single.tickTimesMs.at(-1))}`, "single tick: singular label");
  assert.equal(one.ticks.length, 1, "single tick: tick nodes");
  await page.close();
});

await check("the tick disclosure toggles with Enter and Space", async () => {
  const page = await browser.newPage(viewports.desktop);
  await open(page, "scenario=late-siege");
  await playMoment(page, pressure);
  const summary = page.locator("#evidence-list summary");
  await summary.focus();
  assert.equal(await summary.evaluate(node => node === document.activeElement), true, "summary is not focusable");
  const state = () => page.evaluate(() => ({ open: document.querySelector("#evidence-list details").open, visible: [...document.querySelectorAll("[data-source-tick]")].filter(node => node.checkVisibility()).length }));
  await page.keyboard.press("Enter");
  assert.deepEqual(await state(), { open: true, visible: 6 }, "Enter");
  await page.keyboard.press("Space");
  assert.deepEqual(await state(), { open: false, visible: 0 }, "Space");
  await page.keyboard.press("Space");
  assert.deepEqual(await state(), { open: true, visible: 6 }, "Space again");
  await page.close();
});

// Starts the corner insight's Evidence clip (next to its Fact check), the judge-path trigger of §3.3 row 3.
async function playInsight(page) {
  await seek(page, 1000);
  await page.waitForFunction(() => document.querySelector("#insight-evidence")?.hidden === false, null, { timeout: 15000 });
  await press(page, "#evidence-button");
  await page.waitForFunction(() => !document.querySelector("#evidence-return")?.hidden);
}
const insightCue = (await (await fetch(`${base}/api/insights?scenario=corner&persona=CASUAL&locale=en-GB`)).json()).cues[0];
const clips = [
  { name: "pressure moment", scenario: "late-siege", start: page => playMoment(page, pressure), events: pressure.reasons },
  { name: "corner insight", scenario: "corner", start: playInsight, events: insightCue.eventIds },
];

await check("while an evidence clip (moment or insight) plays the trail sits under the pitch and the pitch stays in view", async () => {
  const rows = [];
  for (const clip of clips) for (const [vpName, vp] of Object.entries(viewports)) {
    const page = await browser.newPage(vp);
    await open(page, `scenario=${clip.scenario}`);
    await clip.start(page);
    await page.waitForFunction(() => document.querySelector("#play-button")?.getAttribute("aria-label") === "Pause");
    await page.waitForTimeout(600);
    const shown = await page.evaluate(() => {
      const shell = document.querySelector(".pitch-shell").getBoundingClientRect();
      const list = document.querySelector("#evidence-list");
      const box = document.querySelector("#evidence-trail").getBoundingClientRect();
      const firstRow = list.querySelector("li").getBoundingClientRect();
      const visible = Math.max(0, Math.min(shell.bottom, innerHeight) - Math.max(shell.top, 0)) * Math.max(0, Math.min(shell.right, innerWidth) - Math.max(shell.left, 0));
      return {
        playing: document.querySelector("#play-button").getAttribute("aria-label"),
        ratio: +(visible / (shell.width * shell.height)).toFixed(3),
        underPitch: Boolean(list.closest(".pitch-column")) && list.checkVisibility(),
        gap: Math.round(box.top - shell.bottom),
        trailTop: Math.round(box.top),
        firstRowTop: Math.round(firstRow.top),
        innerHeight,
        events: [...list.querySelectorAll("[data-source-event]")].map(node => node.dataset.sourceEvent),
      };
    });
    const where = `${clip.name} ${vpName}`;
    rows.push({ clip: clip.name, vp: vpName, ...shown, events: shown.events.join(" ") });
    assert.deepEqual(shown.events, clip.events, `${where}: trail events`);
    assert.equal(shown.playing, "Pause", `${where}: the clip is not playing`);
    assert.ok(shown.ratio >= 0.5, `${where}: pitch visible ratio ${shown.ratio}`);
    assert.ok(shown.underPitch, `${where}: the trail is not in the pitch column`);
    assert.ok(shown.gap >= 0 && shown.gap <= 360, `${where}: the trail starts ${shown.gap}px below the pitch`);
    assert.ok(shown.firstRowTop < shown.innerHeight, `${where}: the first trail row starts below the fold (${shown.firstRowTop}px)`);
    await press(page, "#evidence-return");
    assert.equal(await page.evaluate(() => Boolean(document.querySelector("#evidence-list").closest("#pane-evidence"))), true, `${where}: the trail does not return to the drawer`);
    await page.close();
  }
  console.table(rows);
});

// Page-side: WCAG ratio of each matching node against its composited background.
function measure({ selectors, property }) {
  const parse = value => { const parts = value.match(/rgba?\(([^)]+)\)/)[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 }; };
  const linear = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
  const luminance = c => .2126 * linear(c.r) + .7152 * linear(c.g) + .0722 * linear(c.b);
  const over = (top, bottom) => ({ r: top.r * top.a + bottom.r * (1 - top.a), g: top.g * top.a + bottom.g * (1 - top.a), b: top.b * top.a + bottom.b * (1 - top.a), a: 1 });
  const background = node => { const stack = []; for (let el = node; el; el = el.parentElement) { const c = parse(getComputedStyle(el).backgroundColor); if (c.a > 0) { stack.push(c); if (c.a >= 1) break; } } return stack.reverse().reduce((bg, c) => over(c, bg), { r: 255, g: 255, b: 255, a: 1 }); };
  return selectors.flatMap(selector => [...document.querySelectorAll(selector)].filter(node => node.checkVisibility()).map(node => {
    // A dot is measured against what is behind it, not its own fill.
    const bg = property === "color" ? background(node) : background(node.parentElement);
    const fg = parse(getComputedStyle(node)[property]);
    const a = luminance(fg.a < 1 ? over(fg, bg) : fg), b = luminance(bg);
    return { selector, text: node.textContent.trim().slice(0, 28), fg: getComputedStyle(node)[property], bg: `rgb(${[bg.r, bg.g, bg.b].map(Math.round).join(", ")})`, ratio: +((Math.max(a, b) + .05) / (Math.min(a, b) + .05)).toFixed(2) };
  }));
}

await check("trail and timeline text reach 4.5:1 and team dots 3:1 (computed colours)", async () => {
  const rows = [];
  for (const [vpName, vp] of Object.entries(viewports)) {
    const page = await browser.newPage(vp);
    await open(page, "scenario=late-siege");
    await seek(page, 400); // a timeline row is current, so the accent tint is measured too
    await press(page, "#tab-timeline");
    const text = [".event-list .event-time", ".event-list .event-copy > span", ".event-list .event-copy > strong"];
    rows.push(...(await page.evaluate(measure, { selectors: text, property: "color" })).map(row => ({ vp: vpName, min: 4.5, ...row })));
    rows.push(...(await page.evaluate(measure, { selectors: [".event-list .event-team-dot"], property: "backgroundColor" })).map(row => ({ vp: vpName, min: 3, ...row })));
    await playMoment(page, pressure);
    await press(page, "#evidence-list summary");
    await pause(page);
    const trailText = ["#evidence-list .source-event-button span", "#evidence-list summary span", "#evidence-state", "#evidence-kind"];
    rows.push(...(await page.evaluate(measure, { selectors: trailText, property: "color" })).map(row => ({ vp: vpName, min: 4.5, ...row })));
    await page.close();
  }
  const unique = [...new Map(rows.map(row => [`${row.vp} ${row.selector} ${row.fg} ${row.bg}`, row])).values()];
  console.table(unique);
  for (const selector of [".event-list .event-copy > span", ".event-list .event-team-dot", "#evidence-list .source-event-button span", "#evidence-list summary span"]) {
    assert.ok(unique.some(row => row.selector === selector), `${selector} was not measured`);
  }
  assert.ok(unique.some(row => row.selector === ".event-list .event-copy > span" && row.fg !== row.bg), "timeline descriptions measured");
  assert.deepEqual(unique.filter(row => row.ratio < row.min).map(row => `${row.vp} ${row.selector} "${row.text}" ${row.ratio} < ${row.min}`), []);
  // C6: 13px description in --c-ink-muted.
  const page = await browser.newPage(viewports.desktop);
  await open(page, "scenario=late-siege");
  const style = await page.evaluate(() => { const span = document.querySelector(".event-list .event-copy > span"); const probe = document.createElement("span"); probe.style.color = "var(--c-ink-muted)"; document.querySelector(".event-list").append(probe); const muted = getComputedStyle(probe).color; probe.remove(); return { size: getComputedStyle(span).fontSize, color: getComputedStyle(span).color, muted, tnum: getComputedStyle(document.querySelector(".event-list .event-time")).fontVariantNumeric }; });
  await page.close();
  assert.deepEqual([style.size, style.color], ["13px", style.muted], "timeline description type");
  assert.match(style.tnum, /tabular-nums/, "timeline time column is not tabular");
});

await check("each timeline dot wears the server-rendered kit of its team id (late-siege and corner)", async () => {
  const rows = [];
  for (const scenario of ["late-siege", "corner"]) {
    const replay = await api("/api/replay", scenario);
    const page = await browser.newPage(viewports.desktop);
    await open(page, `scenario=${scenario}`);
    const shown = await page.evaluate(() => ({
      kits: Object.fromEntries([...document.querySelectorAll(".match-hero .team-name[data-team-id]")].map(node => [node.dataset.teamId, node.dataset.teamKit])),
      dots: [...document.querySelectorAll("#event-list li")].map(row => { const dot = row.querySelector(".event-team-dot"); return dot && { team: dot.dataset.teamId, colour: getComputedStyle(dot).backgroundColor }; }),
      positional: [...document.styleSheets].flatMap(sheet => { try { return [...sheet.cssRules].map(rule => rule.cssText); } catch { return []; } }).filter(text => text.includes("event-team-dot") && /team-home|team-away|nth-child/.test(text)),
    }));
    assert.deepEqual(shown.kits, { vale: "a", bastion: "b" }, `${scenario}: server kits`);
    assert.equal(shown.dots.length, replay.events.length, `${scenario}: timeline rows`);
    replay.events.forEach((event, i) => {
      assert.ok(shown.dots[i], `${scenario}: ${event.id} has no team dot`);
      assert.equal(shown.dots[i].team, event.teamId, `${scenario}: ${event.id} dot team`);
      assert.equal(shown.dots[i].colour, kit[shown.kits[event.teamId]], `${scenario}: ${event.id} dot colour`);
    });
    assert.deepEqual(shown.positional, [], `${scenario}: dots use positional team tokens`);
    rows.push({ scenario, first: replay.match.teams[0].id, rows: shown.dots.length, colours: [...new Set(shown.dots.map(dot => `${dot.team}=${dot.colour}`))].join(" ") });
    await page.close();
  }
  console.table(rows);
});

// Init script: record animations/transitions and the marker's width on every frame.
function recordMotion() {
  window.__motion = [];
  window.__marker = [];
  const seen = new WeakSet();
  const name = node => node instanceof Element ? `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ""}${[...node.classList].map(c => `.${c}`).join("")}` : String(node);
  const sample = () => {
    for (const animation of document.getAnimations()) {
      if (seen.has(animation)) continue;
      seen.add(animation);
      const effect = animation.effect, timing = effect?.getComputedTiming(), target = effect?.target;
      const properties = animation.transitionProperty ? [animation.transitionProperty]
        : [...new Set((effect?.getKeyframes() ?? []).flatMap(frame => Object.keys(frame).filter(key => !["offset", "computedOffset", "easing", "composite"].includes(key))))];
      window.__motion.push({ kind: animation.constructor.name, target: name(target), row: target?.id === "evidence-range-marker" ? "marker" : target?.closest?.("#evidence-list") ? "trail" : "", properties: properties.join(","), duration: Number(timing?.duration) || 0, delay: Number(timing?.delay) || 0,
        // A CSS animation carries its timing function on the keyframes, a transition on the effect.
        easing: animation.animationName ? effect.getKeyframes()[0]?.easing ?? "" : effect?.getTiming().easing ?? "" });
    }
    const marker = document.querySelector("#evidence-range-marker");
    if (marker && marker.checkVisibility()) window.__marker.push({ width: +marker.getBoundingClientRect().width.toFixed(2), range: marker.title });
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
}
const MOTION = /transform|translate|scale|rotate|width|height|top|left|bottom|right|inset|margin|padding/i;
const FADE = /^(opacity|color|background-color|backgroundColor|border-color|borderColor|box-shadow|boxShadow)(,(opacity|color|background-color|backgroundColor|border-color|borderColor|box-shadow|boxShadow))*$/;

async function runMotion(reduced) {
  const context = await browser.newContext({ ...viewports.desktop, reducedMotion: reduced ? "reduce" : "no-preference" });
  await context.addInitScript(recordMotion);
  const page = await context.newPage();
  await open(page, "scenario=late-siege");
  await page.evaluate(() => { window.__marker = []; });
  await playMoment(page, pressure);
  // evt-03 is about 12 s into the 15 s clip at 1x; wait until a row has tinted.
  await page.waitForFunction(() => document.querySelector("#evidence-list [data-active]"), null, { timeout: 20000 });
  await page.waitForTimeout(200);
  // Only frames showing the clip's range: before the clip the marker may show an active cue's range.
  const range = await page.locator("#evidence-range-marker").getAttribute("title");
  const result = await page.evaluate(range => ({ motion: window.__motion, marker: window.__marker.filter(frame => frame.range === range), active: [...document.querySelectorAll("#evidence-list [data-active]")].map(node => node.dataset.sourceEvent ?? node.tagName.toLowerCase()), finalWidth: +document.querySelector("#evidence-range-marker").getBoundingClientRect().width.toFixed(2) }), range);
  await context.close();
  return result;
}

await check("without reduced motion the marker grows over 320 ms and the active row tints over 120 ms", async () => {
  const { motion, marker, active, finalWidth } = await runMotion(false);
  const rows = motion.filter(item => item.row);
  console.table(rows);
  assert.ok(active.length > 0, "no active trail row");
  assert.ok(rows.some(item => item.row === "marker" && /width/.test(item.properties) && item.duration === 320 && /cubic-bezier\(0\.4, 0, 0\.2, 1\)/.test(item.easing)), "marker: no 320 ms --ease-in-out width growth");
  assert.ok(rows.some(item => item.row === "trail" && /background-?color/i.test(item.properties) && item.duration === 120), "trail: no 120 ms tint transition");
  assert.ok(marker.length > 2 && marker[0].width < finalWidth * 0.5, `marker did not start narrow: first ${marker[0]?.width}px of ${finalWidth}px`);
});

await check("reduced motion: the marker is full width on its first frame; only colour fades of at most 120 ms", async () => {
  const { motion, marker, active, finalWidth } = await runMotion(true);
  const rows = motion.filter(item => item.row);
  console.table(rows);
  assert.ok(active.length > 0, "no active trail row (the tint must stay)");
  assert.ok(marker.length > 0, "the marker was never visible");
  assert.ok(Math.abs(marker[0].width - finalWidth) < 0.5, `marker first frame ${marker[0].width}px, final ${finalWidth}px`);
  for (const item of rows) {
    assert.doesNotMatch(item.properties, MOTION, `${item.row} ${item.target} animates ${item.properties}`);
    assert.match(item.properties, FADE, `${item.row} ${item.target} animates ${item.properties}`);
    assert.ok(item.duration + item.delay <= 120, `${item.row} ${item.target} runs ${item.delay}+${item.duration} ms`);
  }
  assert.equal(rows.filter(item => item.row === "marker").length, 0, "the marker animates under reduced motion");
});

await browser.close();
if (errors.length) { console.error("page errors:", errors); failures.push("page errors"); }
if (failures.length) { console.error(`${failures.length} D4a check(s) failed`); process.exit(1); }
console.log("Evidence trail browser checks passed.");
