// Locale, translation-routing and model-label checks for the homepage.
// Run against a local Go server: PULSE_URL=http://127.0.0.1:8080 node tests/integration/locale-browser.mjs
// The insight-status check also covers the VERIFIED (recorded) path when the
// server runs with -agents-url pointing at the recorded Python service.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const base = process.env.PULSE_URL ?? "http://127.0.0.1:8080";
const executablePath = process.env.CHROME_PATH ?? (process.platform === "linux" ? "/usr/bin/chromium-browser" : "C:/Program Files/Google/Chrome/Application/chrome.exe");
const LOCALES = ["en-GB", "sw-KE", "hi-IN"];
const LABEL = "model estimate, uncalibrated";
const RETIRED = /\bexperimental\b|formation-sensitive|not calibrated|calibrated match probabilit|\bmodel estimates?\b/i;
const catalog = await (await fetch(`${base}/static/locales.json`)).json();
const tr = (locale, key, values = {}) => (catalog[locale]?.[key] ?? catalog["en-GB"][key] ?? key).replace(/\{([a-zA-Z]+)\}/g, (placeholder, name) => String(values[name] ?? placeholder));
const api = async (path, scenario) => (await fetch(`${base}${path}?scenario=${scenario}`)).json();
const seek = (page, value) => page.locator("#seek").evaluate((input, value) => { input.value = String(value); input.dispatchEvent(new Event("input", { bubbles: true })); }, value);
const seekTo = (page, replay, timeMs) => seek(page, Math.ceil((timeMs - replay.match.startMs) / (replay.match.endMs - replay.match.startMs) * 1000));
// Waits for the replay to load (the seek listener exists only then) and pauses it in any locale.
const pause = async page => {
  const pauseLabels = LOCALES.map(locale => tr(locale, "Pause"));
  await page.waitForFunction(() => document.querySelectorAll("#event-list button").length > 0 && !document.querySelector("#seek")?.disabled);
  const loading = LOCALES.flatMap(locale => ["Loading metrics", "Loading moments"].map(key => tr(locale, key)));
  await page.waitForFunction(loading => !loading.includes(document.querySelector("#metrics-state")?.textContent) && !loading.includes(document.querySelector("#moments-state")?.textContent), loading);
  if (pauseLabels.includes(await page.locator("#play-button").getAttribute("aria-label"))) await page.locator("#play-button").click();
  await page.waitForFunction(labels => !labels.includes(document.querySelector("#play-button")?.getAttribute("aria-label")), pauseLabels);
};
const errors = [];
const passed = [];
const failed = [];
// Sections run independently so one failure does not hide the others.
// LOCALE_SECTIONS=2,4 runs only those sections (1-based) while debugging.
const only = process.env.LOCALE_SECTIONS?.split(",").map(Number);
let sectionNumber = 0;
async function section(name, body) {
  if (only && !only.includes(++sectionNumber)) return;
  try { passed.push(`${name}${(await body()) ?? ""}`); }
  catch (error) { failed.push(`${name}: ${error.message.split("\n").slice(0, 60).join("\n")}`); }
}
const browser = await chromium.launch({ executablePath, headless: true });

// The SVG renderer keeps headless runs fast; the drawer under test is the same for every renderer.
const svg = path => `${path}${path.includes("?") ? "&" : "?"}view=svg`;
async function openPage(path, viewport = { width: 1440, height: 900 }) {
  const page = await browser.newPage({ viewport });
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${base}${svg(path)}`, { waitUntil: "networkidle" });
  return page;
}

try {
  // 1. The selectable locales, the bundled catalog and supportedLocale() share one three-locale allowlist.
  await section('locale allowlist', async () => {
    const page = await openPage("/");
    assert.deepEqual(await page.locator("#locale option").evaluateAll(options => options.map(option => option.value)), LOCALES);
    assert.deepEqual(Object.keys(catalog).sort(), [...LOCALES].sort());
    await page.close();
  });

  // 2. Stored and URL locale preferences on a fresh "/".
  await section('locale storage and URL precedence', async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const firstLoad = async (stored, query = "") => {
      const page = await context.newPage();
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(`${base}/healthz`);
      await page.evaluate(value => { localStorage.clear(); if (value !== null) localStorage.setItem("pulse:locale", value); }, stored);
      const requested = [];
      const insightsRequest = page.waitForRequest(request => new URL(request.url()).pathname === "/api/insights", { timeout: 30000 });
      page.on("request", request => {
        const url = new URL(request.url());
        if (url.searchParams.has("locale") && (url.pathname === "/api/insights" || url.pathname === "/experience/panel")) requested.push(`${url.pathname}=${url.searchParams.get("locale")}`);
      });
      await page.goto(`${base}/${query}`, { waitUntil: "networkidle" });
      await insightsRequest;
      await page.waitForLoadState("networkidle");
      const result = {
        requested: [...new Set(requested.map(entry => entry.split("=")[1]))],
        insights: requested.some(entry => entry.startsWith("/api/insights=")),
        stored: await page.evaluate(() => localStorage.getItem("pulse:locale")),
        selected: await page.locator("#locale").inputValue(),
        body: await page.locator("body").getAttribute("data-locale"),
      };
      await page.close();
      return result;
    };
    const cases = [
      { stored: "fr-FR", expected: "en-GB" }, { stored: "garbage", expected: "en-GB" }, { stored: "", expected: "en-GB" },
      { stored: "en", expected: "en-GB" }, { stored: "sw", expected: "en-GB" }, { stored: "EN-gb", expected: "en-GB" },
      { stored: "<img src=x>", expected: "en-GB" }, { stored: null, expected: "en-GB" },
      { stored: "en-GB", expected: "en-GB" }, { stored: "sw-KE", expected: "sw-KE" }, { stored: "hi-IN", expected: "hi-IN" },
      { stored: "sw-KE", query: "?locale=hi-IN", expected: "hi-IN" },
      { stored: "hi-IN", query: "?locale=sw-KE", expected: "sw-KE" },
      { stored: "hi-IN", query: "?locale=en-GB", expected: "en-GB" },
      { stored: "fr-FR", query: "?locale=sw-KE", expected: "sw-KE" },
      { stored: "hi-IN", query: "?locale=fr-FR", expected: "hi-IN" },
      { stored: null, query: "?locale=fr-FR", expected: "en-GB" },
    ];
    for (const { stored, query, expected } of cases) {
      const result = await firstLoad(stored, query);
      const name = `stored=${JSON.stringify(stored)} query=${query ?? ""}`;
      assert.ok(result.insights, `${name}: no /api/insights request`);
      assert.deepEqual(result.requested, [expected], `${name}: requested ${result.requested}`);
      assert.equal(result.selected, expected, `${name}: selected`);
      assert.equal(result.body, expected, `${name}: body locale`);
      assert.equal(result.stored, expected, `${name}: stored value`);
    }
    await context.close();
    return ` (${cases.length} cases)`;
  });

  // 3. Visible text in hi-IN: every Latin-script string must come out of the catalog.
  await section('hi-IN visible text routed through i18n', async () => {
    const toPattern = value => new RegExp(`^${value.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\{[a-zA-Z]+\}/g, "(.+?)")}$`, "s");
    const keys = Object.keys(catalog["hi-IN"]);
    const hindi = keys.map(key => toPattern(catalog["hi-IN"][key]));
    const english = keys.map(key => toPattern(catalog["en-GB"][key] ?? key)); // English text of the keys hi-IN defines
    // Fictional team/player names, the product name and renderer names stay in Latin script in every locale.
    const namesOf = replay => ["Pulse", "Three.js", "PixiJS", "SVG", ...replay.match.teams.map(team => team.name), ...replay.match.players.map(player => player.name)]
      .flatMap(name => [name, name.toUpperCase()]).sort((a, b) => b.length - a.length);
    const latin = (text, names) => {
      let rest = text;
      for (const name of names) rest = rest.split(name).join(" ");
      return /[A-Za-z]{2,}/.test(rest.replace(/\bevt-[\w.:-]+/g, " "));
    };
    // A catalog value matches only if every placeholder is filled with a name/number or with catalog text,
    // so all-placeholder formats such as "{count} {noun}" cannot vouch for arbitrary English.
    const fromCatalog = (text, names, patterns = hindi, depth = 0) => patterns.some(pattern => {
      const match = pattern.exec(text);
      return match !== null && match.slice(1).every(part => !latin(part, names) || (depth < 2 && fromCatalog(part.trim(), names, patterns, depth + 1)));
    });
    // The 30 visible strings listed by the 2026-10-16 locale review (item 3), minus the pitch stamp
    // (already routed; only the team name is Latin) and the two retired model labels (removed).
    const reviewed = ["2nd Half", "Seek match replay", "Tactical Intelligence Drawer", "88:39–88:41 · 2 events", "Download",
      "Aurora Vale recorded 2 shot attempts in this sequence.", "The shot was blocked.", "The shot was unsuccessful.",
      "0 completed passes", "10 completed passes", "1 pass", "Sent", "Received", "No completed passes yet",
      "Control field", "Entropy", "Pressing estimate", "Ball carrier", "Bastion City final third", "Aurora Vale final third",
      "Control vs Chaos", "Detected moments", "Sustained pressure", "Control swing", "Set-piece shot", "Attacking routes", "Entry to shot"];
    const cornerNames = namesOf(await api("/api/replay", "corner"));
    for (const text of reviewed) assert.ok(fromCatalog(text, cornerNames, english), `"${text}" has no hi-IN catalog key`);
    for (const patterns of [hindi, english]) assert.ok(!fromCatalog("Hardcoded English words", cornerNames, patterns), "the catalog matcher accepts arbitrary English");
    const leaks = new Map();
    const scan = async (page, names, where) => {
      const texts = await page.evaluate(() => {
        const out = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const node = walker.currentNode, element = node.parentElement, text = node.data.replace(/\s+/g, " ").trim();
          if (!text || !element || element.closest("script,style,title,select,.select2-container,[data-no-translate]")) continue;
          if (!element.checkVisibility({ visibilityProperty: true })) continue;
          out.push({ text, element: element.id ? `#${element.id}` : `${element.tagName.toLowerCase()}.${element.className}` });
        }
        return out;
      });
      for (const { text, element } of texts) if (latin(text, names) && !fromCatalog(text, names) && !leaks.has(text)) leaks.set(text, `${where}:${element}`);
    };
    for (const scenario of ["corner", "late-siege"]) {
      // An unsupported-tracking reason is raw /api/metrics data, like metric values (tracked in docs/I18N-BACKLOG.md).
      const reason = (await api("/api/metrics", scenario)).reason;
      const names = [...(reason ? [reason] : []), ...namesOf(await api("/api/replay", scenario))];
      const page = await openPage(`/?scenario=${scenario}&locale=hi-IN`);
      await pause(page);
      for (const at of [500, 1000]) {
        await seek(page, at);
        for (const tab of ["timeline", "passing", "control", "routes", "recap", "evidence"]) {
          await page.locator(`#tab-${tab}`).click();
          await scan(page, names, `${scenario}:${tab}`);
        }
      }
      for (const type of ["CONTROL_SWING", "SET_PIECE_SHOT"]) {
        const moment = page.locator(`#moment-list button[data-moment-type="${type}"]`).first();
        if (!await moment.count()) continue;
        await seek(page, 1000); // a previous moment clip rewinds the clock and hides later moments
        await page.locator("#tab-control").click();
        await moment.click();
        await page.locator("#evidence-list li").first().waitFor();
        await scan(page, names, `${scenario}:evidence:${type}`);
        await pause(page);
      }
      await page.close();
    }
    const found = [...leaks].map(([text, where]) => `${text} (${where})`);
    assert.deepEqual(found, [], `hardcoded visible strings in hi-IN:\n${found.join("\n")}`);
    return ` (${reviewed.length} reviewed strings)`;
  });

  // 4. Control vs Chaos headline is the API's indexDelta for the home team; N/A when missing.
  await section('Control vs Chaos headline = API indexDelta, N/A when missing', async () => {
    const scenario = "late-siege";
    const [replay, metrics] = await Promise.all([api("/api/replay", scenario), (await fetch(`${base}/api/metrics?scenario=${scenario}`)).json()]);
    const home = replay.match.teams[0].id, away = replay.match.teams[1].id;
    const page = await openPage(`/?scenario=${scenario}`);
    await pause(page);
    await seekTo(page, replay, 5332000);
    await page.locator("#tab-control").click();
    const tickTime = Number(await page.locator("#metrics-clock").getAttribute("data-time-ms"));
    const tick = metrics.ticks.find(item => item.timeMs === tickTime);
    assert.ok(tick, `no metric tick at ${tickTime}`);
    assert.equal(tick.teams[home].indexDelta, -0.5537, "fixture drifted: expected late-siege home indexDelta -0.5537");
    const headline = page.locator("#metric-index-delta");
    assert.equal(await headline.textContent(), "-0.5537");
    assert.equal(await page.locator(".metric-headline dt").evaluate(element => element.firstChild?.textContent?.trim()), "Index difference");
    const section = await page.locator(".control-index").innerText();
    for (const value of [tick.teams[home].index, tick.teams[away].index]) assert.ok(!section.includes(value.toFixed(4)), `absolute index ${value} shown in the headline section`);
    await page.close();

    const missing = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    missing.on("pageerror", error => errors.push(error.message));
    await missing.route("**/api/metrics?*", async route => {
      const body = await (await route.fetch()).json();
      for (const item of body.ticks) for (const team of Object.values(item.teams)) delete team.indexDelta;
      await route.fulfill({ json: body });
    });
    await missing.goto(`${base}${svg(`/?scenario=${scenario}`)}`, { waitUntil: "networkidle" });
    await pause(missing);
    await seekTo(missing, replay, 5332000);
    await missing.locator("#tab-control").click();
    assert.equal(await missing.locator("#metric-entropy").textContent(), tick.entropy.toFixed(4), "metrics must still render without indexDelta");
    assert.equal(await missing.locator("#metric-index-delta").textContent(), "N/A");
    await missing.close();
  });

  // 5. Canonical model label next to model values in Control and the Evidence trail, in every locale.
  await section('canonical model label in Control, Evidence trail and banner', async () => {
    for (const locale of LOCALES) {
      const replay = await api("/api/replay", "late-siege");
      const label = tr(locale, LABEL);
      const page = await openPage(`/?scenario=late-siege&locale=${locale}`);
      await pause(page);
      await seekTo(page, replay, 5332000);
      await page.locator("#tab-control").click();
      assert.equal((await page.locator("#pane-control h4 .model-label").textContent()).trim(), label);
      await page.locator('#moment-list button[data-moment-type="CONTROL_SWING"]').first().click();
      await page.locator("#moment-values div").first().waitFor();
      assert.equal(await page.locator("#moment-values-label").isVisible(), true, `${locale}: evidence model label hidden`);
      assert.equal((await page.locator("#moment-values-label").textContent()).trim(), label);
      assert.equal(await page.locator("#moment-values-label + #moment-values").count(), 1, "label must sit next to #moment-values");
      const terms = await page.locator("#moment-values dt").allTextContents();
      assert.deepEqual(terms, ["Index difference before", "Index difference after", "Change"].map(key => tr(locale, key)), `${locale}: evidence value terms`);
      assert.ok((await page.locator("#moment-banner-detail").textContent()).endsWith(` / ${label}`), `${locale}: moment banner label`);
      for (const pane of ["control", "evidence"]) {
        await page.locator(`#tab-${pane}`).click();
        const text = await page.locator(".right-drawer").innerText();
        assert.ok(!RETIRED.test(text.split(LABEL).join("")), `${locale} ${pane}: retired model label wording`);
      }
      await page.close();
    }
    {
      const page = await openPage("/?scenario=corner");
      await pause(page);
      await seek(page, 1000);
      await page.locator("#tab-control").click();
      await page.locator('#moment-list button[data-moment-type="SET_PIECE_SHOT"]').first().click();
      await page.locator("#evidence-list li").first().waitFor();
      assert.equal(await page.locator("#moment-values div").count(), 0);
      assert.equal(await page.locator("#moment-values-label").isVisible(), false, "label shown without model values");
      await page.close();
    }
  });

  // 6. Translated insights are never shown as Verified (corner + Casual).
  await section('sw-KE/hi-IN insight status never Verified', async () => {
    const verifiedWords = new Set(LOCALES.flatMap(locale => ["Verified", "Verified (recorded)"].map(key => tr(locale, key))));
    const replay = await api("/api/replay", "corner");
    const source = (await fetch(`${base}/api/insights?scenario=corner&persona=CASUAL&locale=en-GB`)).headers.get("x-pulse-insight-source");
    for (const locale of LOCALES) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      page.on("pageerror", error => errors.push(error.message));
      await page.addInitScript(() => {
        window.__statuses = [];
        new MutationObserver(() => {
          const status = document.querySelector("#insight-status")?.textContent;
          if (status && status !== window.__statuses.at(-1)) window.__statuses.push(status);
        }).observe(document, { subtree: true, childList: true, characterData: true });
      });
      await page.goto(`${base}${svg(`/?scenario=corner&persona=CASUAL&locale=${locale}`)}`, { waitUntil: "networkidle" });
      await pause(page);
      const feed = await (await fetch(`${base}/api/insights?scenario=corner&persona=CASUAL&locale=${locale}`)).json();
      assert.equal(feed.cues.length, 1);
      await seekTo(page, replay, feed.cues[0].startMs);
      await page.waitForFunction(() => document.querySelector("#insight-evidence")?.hidden === false);
      const statuses = await page.evaluate(() => window.__statuses);
      if (locale === "en-GB") {
        if (source === "python-recorded") assert.equal(await page.locator("#insight-status").textContent(), "Verified (recorded)", "positive control");
      } else {
        assert.notEqual(feed.cues[0].verification.status, "VERIFIED");
        assert.equal(await page.locator("#insight-status").textContent(), tr(locale, "Template"));
        assert.deepEqual(statuses.filter(status => verifiedWords.has(status)), [], `${locale} showed a Verified status`);
      }
      await page.close();
    }
    return ` (en-GB source: ${source})`;
  });

  for (const name of passed) console.log(`PASS ${name}`);
  for (const failure of failed) console.log(`FAIL ${failure}`);
  if (errors.length) console.log(`FAIL page errors: ${errors.join(" | ")}`);
  console.log(`${passed.length} passed, ${failed.length + (errors.length ? 1 : 0)} failed`);
  process.exitCode = failed.length || errors.length ? 1 : 0;
} finally {
  await browser.close();
}
