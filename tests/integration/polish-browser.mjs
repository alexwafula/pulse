// Pre-freeze polish checks against a running Go server (PULSE_URL), experience pages and /legacy.
// 1. No header score chip on experience pages; /legacy keeps its "– : –" scoreboard. Header
//    controls keep their x-position (±1 px) across Live, Story, Insights and Recap at 1440 and 390.
// 2. Copy link, Broadcast and the library close button share the Scenarios button's border and background.
// 3. Hero direction, the selected action's outcome, Story event kinds and the Pitch maps direction
//    line never show an all-capitals word; sw-KE and hi-IN show their catalog text.
// 4. The hero headline never ends on a single-word line at 390 in any locale.
// 5. The mobile pass-count card shows its title and is no taller than its content.
// 6. Drawer tabs at 390: at least 13 px text and 44 px tall, one row, nothing clipped.
// 7. The page declares an inline SVG icon, so the browser does not request /favicon.ico.
// 8. The "What changed?" insight tab has no icon, like its siblings.
// 9. The sw-KE camera select is not clipped at 1440 or 390, for every option.
// 10. Story cards are never cut by a nested scroll box.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const base = process.env.PULSE_URL ?? "http://127.0.0.1:8080";
const executablePath = process.env.CHROME_PATH ?? (process.platform === "linux" ? "/usr/bin/chromium-browser" : "C:/Program Files/Google/Chrome/Application/chrome.exe");
const browser = await chromium.launch({ executablePath, headless: true, args: ["--use-angle=swiftshader-webgl", "--enable-unsafe-swiftshader"] });
const viewports = { desktop: { viewport: { width: 1440, height: 900 } }, mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } };
const LOCALES = ["en-GB", "sw-KE", "hi-IN"];
const SECTIONS = ["live", "story", "insights", "recap"];
const CAPITALS = /\b[A-Z]{4,}\b/;
const catalog = JSON.parse(readFileSync(new URL("../../app/web/static/locales.json", import.meta.url), "utf8"));
const t = (locale, key, values = {}) => (catalog[locale][key] ?? catalog["en-GB"][key] ?? key).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? `{${name}}`);
const failures = [];
const errors = [];
const check = (name, fn) => fn().then(() => console.log(`ok ${name}`), error => { failures.push(name); console.error(`FAIL ${name}: ${error.message}`); });
const api = async (path, scenario) => (await fetch(`${base}${path}?scenario=${scenario}`)).json();
const press = (page, selector) => page.locator(selector).first().evaluate(node => node.click());
const seek = (page, value) => page.locator("#seek").evaluate((input, value) => { input.value = String(value); input.dispatchEvent(new Event("input", { bubbles: true })); }, value);
const settled = page => page.waitForFunction(() => {
  const content = document.querySelector(".story-content"), inputs = document.querySelector("#experience-inputs");
  return content && document.querySelector("#experience-content")?.getAttribute("aria-busy") === "false"
    && content.dataset.timeMs === inputs.elements.namedItem("atMs").value && content.dataset.panel === inputs.elements.namedItem("panel").value;
}, null, { timeout: 15000 });
async function pause(page) {
  const locale = await page.evaluate(() => document.body.dataset.locale ?? "en-GB");
  if (await page.locator("#play-button").getAttribute("aria-label") === (catalog[locale]?.Pause ?? "Pause")) await press(page, "#play-button");
}
async function open(context, path, consoleLog) {
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  if (consoleLog) page.on("console", message => consoleLog.push(`${message.type()}: ${message.text()}`));
  await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelector(".pitch-shell")?.dataset.renderer, null, { timeout: 30000 });
  await pause(page);
  return page;
}
const section = async (page, name) => { await press(page, `.experience-navigation [data-section="${name}"]`); await page.waitForFunction(name => document.body.dataset.section === name, name); };
const visibleText = (page, selector) => page.locator(selector).evaluateAll(nodes => nodes.filter(node => node.checkVisibility()).map(node => node.innerText.trim()));

const replay = await api("/api/replay", "late-siege");
const teamName = id => replay.match.teams.find(team => team.id === id).name;
const titleCase = type => type.charAt(0) + type.slice(1).toLowerCase();

await check("1. no score chip on experience pages; /legacy keeps its scoreboard", async () => {
  for (const vp of Object.values(viewports)) {
    const context = await browser.newContext(vp);
    const page = await open(context, "/?scenario=late-siege&view=svg");
    for (const name of SECTIONS) { await section(page, name); assert.equal(await page.locator(".experience-mini-score").count(), 0, `${name}: score chip present`); }
    const legacy = await open(context, "/legacy?scenario=late-siege&view=svg");
    assert.equal((await legacy.locator(".scoreboard .score-unavailable").textContent()).trim(), "– : –");
    await context.close();
  }
});

await check("1. header controls keep their x-position across sections at 1440 and 390", async () => {
  for (const [name, vp] of Object.entries(viewports)) {
    const context = await browser.newContext(vp);
    const page = await open(context, "/?scenario=late-siege&view=svg");
    const positions = {};
    for (const target of SECTIONS) {
      await section(page, target);
      positions[target] = await page.evaluate(() => Object.fromEntries(["#scenario-library-open", "#share-button", "#broadcast-toggle", ".audience-controls", ".language-control", ".header-badge"]
        .map(selector => [selector, document.querySelector(selector)]).filter(([, node]) => node?.checkVisibility()).map(([selector, node]) => [selector, Math.round(node.getBoundingClientRect().x)])));
    }
    for (const target of SECTIONS) for (const [selector, x] of Object.entries(positions.live)) {
      assert.ok(Math.abs(positions[target][selector] - x) <= 1, `${name} ${selector}: live x=${x}, ${target} x=${positions[target][selector]}`);
    }
    await context.close();
  }
});

await check("2. header icon buttons share the Scenarios button's border and background", async () => {
  const props = ["borderTopWidth", "borderTopStyle", "borderTopColor", "borderRightWidth", "borderRightStyle", "borderRightColor", "borderBottomWidth", "borderBottomStyle", "borderBottomColor", "borderLeftWidth", "borderLeftStyle", "borderLeftColor", "backgroundColor"];
  for (const [name, vp] of Object.entries(viewports)) {
    const context = await browser.newContext(vp);
    const page = await open(context, "/?scenario=late-siege&view=svg");
    const style = selector => page.locator(selector).evaluate((node, props) => Object.fromEntries(props.map(prop => [prop, getComputedStyle(node)[prop]])), props);
    const reference = await style("#scenario-library-open");
    assert.deepEqual(await style("#share-button"), reference, `${name} Copy link`);
    assert.deepEqual(await style("#broadcast-toggle"), reference, `${name} Broadcast`);
    await press(page, "#scenario-library-open");
    await page.waitForFunction(() => document.querySelector("#scenario-dialog")?.open);
    assert.deepEqual(await style("#scenario-library-close"), reference, `${name} library close`);
    await context.close();
  }
});

await check("3. direction, outcome, Story kinds and Pitch maps direction: no capitals, catalog text per locale", async () => {
  const context = await browser.newContext(viewports.desktop);
  for (const locale of LOCALES) {
    const page = await open(context, `/?scenario=late-siege&view=svg&locale=${locale}`);
    const direction = team => t(locale, "team.direction", { team: team.name, direction: t(locale, team.attackingDirection) });
    const subs = await visibleText(page, ".match-hero .team-sub");
    assert.deepEqual(subs, replay.match.teams.map(direction), `${locale} hero direction`);
    for (const text of subs) assert.doesNotMatch(text, CAPITALS, `${locale} hero direction: ${text}`);
    // The selected action's team and outcome, on Live and with broadcast mode on.
    const event = replay.events.find(event => event.type === "SHOT");
    await seek(page, Math.ceil((event.timeMs - replay.match.startMs) / (replay.match.endMs - replay.match.startMs) * 1000));
    await page.waitForFunction(() => document.querySelector("#detail-description")?.textContent.includes("·"));
    const outcome = (await page.locator("#detail-description").innerText()).trim();
    assert.equal(outcome, `${teamName(event.teamId)} · ${t(locale, event.outcome.toLowerCase())}`, `${locale} outcome`);
    await press(page, "#broadcast-toggle");
    await page.waitForFunction(() => document.body.dataset.broadcast === "true");
    for (const text of await visibleText(page, "body[data-broadcast=true] #broadcast-caption, #detail-description")) assert.doesNotMatch(text, CAPITALS, `${locale} broadcast: ${text}`);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.body.dataset.broadcast !== "true");
    // Story at the end: every kind, then the Pitch maps direction line in each mode.
    await seek(page, 1000); await section(page, "story");
    await press(page, '[data-story-mode="catchup"]'); await settled(page);
    const kinds = await page.locator(".story-log li[data-story-event]").evaluateAll(items => items.map(item => [item.dataset.storyEvent, item.querySelector(".story-meta span").innerText.trim()]));
    assert.ok(kinds.length > 5, `${locale}: story rows`);
    for (const [id, text] of kinds) {
      const source = replay.events.find(event => event.id === id);
      assert.equal(text, `${t(locale, titleCase(source.type))} · ${teamName(source.teamId)}`, `${locale} story kind ${id}`);
      assert.doesNotMatch(text, CAPITALS, `${locale} story kind ${id}`);
    }
    await section(page, "insights");
    await press(page, '#map-controls [data-insight-view="maps"]'); await settled(page);
    for (const mode of ["network", "occupancy", "shots"]) {
      await press(page, `[data-map-mode="${mode}"]`); await settled(page);
      const teamId = await page.locator(".experience-map").getAttribute("data-analytics-team");
      const team = replay.match.teams.find(team => team.id === teamId);
      const line = (await page.locator(".experience-map .section-heading .story-source").innerText()).trim();
      assert.equal(line, direction(team), `${locale} ${mode} direction`);
      assert.doesNotMatch(line, CAPITALS, `${locale} ${mode} direction`);
    }
    await page.close();
  }
  // /legacy keeps its original direction text.
  const legacy = await open(context, "/legacy?scenario=late-siege&view=svg&locale=en-GB");
  assert.deepEqual(await visibleText(legacy, ".team-sub"), replay.match.teams.map(team => `${team.name} • Attacking ${team.attackingDirection}`));
  await context.close();
});

await check("4. hero headline: no single-word last line at 390 in any locale", async () => {
  const context = await browser.newContext(viewports.mobile);
  for (const locale of LOCALES) {
    const page = await open(context, `/?scenario=late-siege&view=svg&locale=${locale}`);
    for (const at of [0, 400, 1000]) {
      await seek(page, at);
      await page.waitForTimeout(150);
      const lines = await page.locator("#hero-index-headline").evaluate(node => {
        const text = node.firstChild, rows = new Map();
        for (const match of text.data.matchAll(/\S+/g)) {
          const range = document.createRange(); range.setStart(text, match.index); range.setEnd(text, match.index + match[0].length);
          const top = Math.round(range.getClientRects()[0].top);
          rows.set(top, [...(rows.get(top) ?? []), match[0]]);
        }
        return [...rows.values()];
      });
      if (lines.length > 1) assert.ok(lines.at(-1).length > 1, `${locale} at ${at}: last line "${lines.at(-1).join(" ")}"`);
    }
    await page.close();
  }
  await context.close();
});

await check("5. mobile pass-count card shows its title and fits its content", async () => {
  const context = await browser.newContext(viewports.mobile);
  for (const locale of LOCALES) {
    const page = await open(context, `/?scenario=late-siege&view=svg&locale=${locale}`);
    const card = await page.locator(".rail-share").evaluate(node => {
      const title = node.querySelector(".share-title"), labels = node.querySelector(".share-labels"), style = getComputedStyle(node);
      return { titleVisible: title.checkVisibility() && title.getBoundingClientRect().height > 0, title: title.innerText.trim(), card: node.getBoundingClientRect().height,
        content: labels.getBoundingClientRect().height + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth) };
    });
    assert.ok(card.titleVisible, `${locale}: title hidden`);
    assert.equal(card.title, t(locale, "Completed passes (replay window)"));
    assert.ok(card.card <= card.content + 1, `${locale}: card ${card.card}px for ${card.content}px of content`);
    await page.close();
  }
  await context.close();
});

await check("6. drawer tabs at 390: ≥13 px, ≥44 px tall, one row, nothing clipped", async () => {
  const context = await browser.newContext(viewports.mobile);
  for (const locale of LOCALES) {
    const page = await open(context, `/?scenario=late-siege&view=svg&locale=${locale}`);
    const row = await page.locator(".drawer-tabs").evaluate(bar => ({ overflow: bar.scrollWidth - bar.clientWidth, page: document.documentElement.scrollWidth - innerWidth,
      tabs: [...bar.querySelectorAll(".drawer-tab")].filter(tab => tab.checkVisibility()).map(tab => { const box = tab.getBoundingClientRect(); return { text: tab.innerText.trim(), size: parseFloat(getComputedStyle(tab).fontSize), height: box.height, top: Math.round(box.top), clipped: tab.scrollWidth - tab.clientWidth }; }) }));
    assert.equal(row.tabs.length, 5, `${locale}: tab count`);
    assert.ok(row.overflow <= 0 && row.page <= 0, `${locale}: overflow ${row.overflow}/${row.page}`);
    assert.equal(new Set(row.tabs.map(tab => tab.top)).size, 1, `${locale}: tabs wrap`);
    for (const tab of row.tabs) {
      assert.ok(tab.size >= 13, `${locale} ${tab.text}: ${tab.size}px`);
      assert.ok(tab.height >= 44, `${locale} ${tab.text}: ${tab.height}px tall`);
      assert.ok(tab.clipped <= 0, `${locale} ${tab.text}: clipped by ${tab.clipped}px`);
    }
    await page.close();
  }
  await context.close();
});

await check("7. inline SVG icon; /favicon.ico is never requested", async () => {
  for (const path of ["/?scenario=late-siege&view=svg", "/legacy?scenario=late-siege&view=svg"]) {
    const isolated = await chromium.launch({ executablePath, headless: true });
    const log = [];
    const page = await open(await isolated.newContext(viewports.desktop), path, log);
    assert.match(await page.locator('link[rel="icon"]').getAttribute("href"), /^data:image\/svg\+xml,/, path);
    await page.waitForTimeout(500);
    assert.deepEqual(log.filter(line => /404|favicon/i.test(line)), [], path);
    await isolated.close();
  }
});

await check("8. the What changed? tab has no icon", async () => {
  const context = await browser.newContext(viewports.desktop);
  const page = await open(context, "/?scenario=late-siege&view=svg");
  await section(page, "insights");
  const tabs = await page.locator("#map-controls .insight-views button").evaluateAll(buttons => buttons.map(button => ({ text: button.innerText.trim(), icon: button.querySelectorAll("svg, i").length })));
  assert.deepEqual(tabs.filter(tab => tab.icon), [], JSON.stringify(tabs));
  assert.ok(tabs.some(tab => tab.text === "What changed?"));
  await context.close();
});

await check("9. sw-KE camera select is not clipped at 1440 or 390", async () => {
  for (const [name, vp] of Object.entries(viewports)) {
    const context = await browser.newContext(vp);
    const page = await open(context, "/?scenario=late-siege&view=three&locale=sw-KE");
    await page.waitForFunction(() => !document.querySelector("#camera-options")?.hidden);
    for (const value of ["broadcast", "tactical", "follow"]) {
      await page.locator("#camera-mode").evaluate((select, value) => { select.value = value; select.dispatchEvent(new Event("change", { bubbles: true })); }, value);
      const shown = await page.locator("#select2-camera-mode-container").evaluate(node => ({ text: node.innerText.trim(), clipped: node.scrollWidth - node.clientWidth, page: document.documentElement.scrollWidth - innerWidth }));
      assert.ok(shown.clipped <= 0, `${name} ${value} "${shown.text}" clipped by ${shown.clipped}px`);
      assert.ok(shown.page <= 0, `${name}: page overflow ${shown.page}px`);
    }
    await context.close();
  }
});

await check("10. Story cards are never cut by a nested scroll box", async () => {
  for (const [name, vp] of Object.entries(viewports)) {
    const context = await browser.newContext(vp);
    const page = await open(context, "/?scenario=late-siege&view=svg&locale=sw-KE");
    await seek(page, 1000); await section(page, "story");
    for (const mode of ["live", "catchup", "highlights", "player"]) {
      await press(page, `[data-story-mode="${mode}"]`); await settled(page);
      const log = await page.locator(".story-log").evaluate(node => ({ hidden: node.scrollHeight - node.clientHeight, rows: node.querySelectorAll("li").length }));
      assert.ok(log.hidden <= 1, `${name} ${mode}: ${log.hidden}px of ${log.rows} rows hidden in a scroll box`);
    }
    await context.close();
  }
});

await browser.close();
if (errors.length) { failures.push("page errors"); console.error(errors); }
if (failures.length) { console.error(`FAIL ${failures.length}: ${failures.join("; ")}`); process.exit(1); }
console.log("PASS polish: header, buttons, casing, headline, pass card, tabs, icon, comparison tab, camera select, story list");
