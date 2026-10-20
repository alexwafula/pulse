import { createElement, ListVideo, ArrowLeftRight } from "lucide";
import { locale, t } from "./i18n";
import type { Replay, Cue } from "./pitch";
import type { ControlField } from "./renderers/types";
import { pressureNarration } from "./moment-narration";
import { indexHeadline } from "./index-headline";
import { teamKit } from "./team-colour";
import { clearState, renderState, trackingState } from "./state-line";

// indexDelta is the API's own team-minus-opponent index difference; null when the API omits it.
type TeamTick = { finalThird: number; indexDelta: number | null };
type Tick = { timeMs: number; entropy: number; pressing: number | null; carrier: { playerId: string; teamId: string } | null; teams: Record<string, TeamTick>; grid: number[] };
// teams is the API's own order: each tick's indexDelta for teams[0] is its index minus teams[1]'s.
type Metrics = { label: string; reason: string; supported: boolean; teams: [string, string]; cols: number; rows: number; teamId: string; ticks: Tick[] };
export type Moment = {
  type: "SET_PIECE_SHOT" | "SUSTAINED_PRESSURE" | "CONTROL_SWING";
  teamId: string; timeMs: number; windowStartMs: number; windowEndMs: number;
  evidenceKind: "event" | "tick"; reasons: string[]; tickTimesMs: number[]; values: Record<string, number>;
};
type Hooks = { repaint: () => void; playMoment: (moment: Moment) => void; inspectTime: (timeMs: number, eventId?: string) => void; matchTime: (timeMs: number) => string; eventSentence: (event: Replay["events"][number]) => string };

function element<T extends HTMLElement | SVGElement = HTMLElement>(selector: string): T {
  const result = document.querySelector<T>(selector);
  if (!result) throw new Error(`Missing analytics element: ${selector}`);
  return result;
}
function object(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function unit(value: unknown): value is number { return finite(value) && value >= 0 && value <= 1; }
function time(value: unknown): value is number { return finite(value) && Number.isSafeInteger(value); }
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every(item => typeof item === "string"); }

function decodeMetrics(raw: unknown, replay: Replay, scenario: string): Metrics {
  if (!object(raw) || raw.model !== "time-to-reach-control-v1" || raw.matchId !== replay.match.id || raw.scenario !== scenario || typeof raw.label !== "string" || !Array.isArray(raw.ticks) || !["supported", "unsupported"].includes(String(raw.trackingMetrics))) throw new Error("Invalid metrics response");
  const supported = raw.trackingMetrics === "supported";
  const order = raw.teams;
  if (!strings(order) || order.length !== 2 || order[0] === order[1] || !order.every(id => replay.match.teams.some(team => team.id === id))) throw new Error("Invalid metrics team order");
  const result: Metrics = { label: raw.label, reason: typeof raw.reason === "string" ? raw.reason : "", supported, teams: [order[0], order[1]], cols: 0, rows: 0, teamId: "", ticks: [] };
  if (!supported) {
    if (raw.ticks.length) throw new Error("Unsupported tracking returned metric ticks");
    return result;
  }
  const layout = raw.gridLayout;
  if (!object(layout) || layout.order !== "row-major" || layout.origin !== "bottom-left" || !time(layout.cols) || !time(layout.rows) || layout.cols < 1 || layout.rows < 1 || layout.cols * layout.rows > 4096 || typeof layout.teamId !== "string" || !replay.match.teams.some(team => team.id === layout.teamId)) throw new Error("Invalid control grid layout");
  result.cols = layout.cols; result.rows = layout.rows; result.teamId = layout.teamId;
  let previous = replay.match.startMs - 1;
  for (const rawTick of raw.ticks) {
    if (!object(rawTick) || !time(rawTick.timeMs) || rawTick.timeMs <= previous || rawTick.timeMs < replay.match.startMs || rawTick.timeMs > replay.match.endMs || !unit(rawTick.entropy) || !(rawTick.pressing === null || unit(rawTick.pressing)) || !object(rawTick.teams) || !Array.isArray(rawTick.grid) || rawTick.grid.length !== result.cols * result.rows || !rawTick.grid.every(unit)) throw new Error("Invalid metric tick");
    const teams: Record<string, TeamTick> = {};
    for (const team of replay.match.teams) {
      const values = rawTick.teams[team.id];
      if (!object(values) || !unit(values.finalThird) || !unit(values.index)) throw new Error("Invalid team metrics");
      const indexDelta = values.indexDelta ?? null;
      if (indexDelta !== null && !(finite(indexDelta) && indexDelta >= -1 && indexDelta <= 1)) throw new Error("Invalid index difference");
      teams[team.id] = { finalThird: values.finalThird, indexDelta };
    }
    let carrier: Tick["carrier"] = null;
    if (rawTick.carrier !== null) {
      const value = rawTick.carrier;
      if (!object(value) || typeof value.playerId !== "string" || typeof value.teamId !== "string" || !replay.match.players.some(player => player.id === value.playerId && player.teamId === value.teamId)) throw new Error("Invalid carrier reference");
      carrier = { playerId: value.playerId, teamId: value.teamId };
    }
    result.ticks.push({ timeMs: rawTick.timeMs, entropy: rawTick.entropy, pressing: rawTick.pressing, carrier, teams, grid: rawTick.grid });
    previous = rawTick.timeMs;
  }
  if (!result.ticks.length) throw new Error("Missing supported metric ticks");
  return result;
}

function decodeMoments(raw: unknown, replay: Replay, scenario: string): Moment[] {
  if (!object(raw) || raw.model !== "time-to-reach-control-v1" || raw.matchId !== replay.match.id || raw.scenario !== scenario || !Array.isArray(raw.moments)) throw new Error("Invalid moments response");
  const knownEvents = new Set(replay.events.map(event => event.id));
  return raw.moments.map((value: unknown): Moment => {
    if (!object(value) || (value.type !== "SET_PIECE_SHOT" && value.type !== "SUSTAINED_PRESSURE" && value.type !== "CONTROL_SWING") || typeof value.teamId !== "string" || !replay.match.teams.some(team => team.id === value.teamId)) throw new Error("Invalid moment identity");
    if (!time(value.timeMs) || value.timeMs < replay.match.startMs || value.timeMs > replay.match.endMs || !time(value.windowStartMs) || !time(value.windowEndMs) || value.windowStartMs > value.windowEndMs || value.windowEndMs > value.timeMs) throw new Error("Invalid moment window");
    const momentTime = value.timeMs;
    if (!strings(value.reasons) || !value.reasons.every(id => knownEvents.has(id)) || !strings(value.contextEventIds) || !value.contextEventIds.every(id => knownEvents.has(id))) throw new Error("Invalid moment event references");
    if (!Array.isArray(value.tickTimesMs) || !value.tickTimesMs.every(item => time(item) && item >= replay.match.startMs && item <= momentTime)) throw new Error("Invalid tick evidence");
    if (!object(value.values)) throw new Error("Invalid moment values");
    const values: Record<string, number> = {};
    for (const [name, number] of Object.entries(value.values)) {
      if (!finite(number)) throw new Error("Invalid moment value");
      values[name] = number;
    }
    const tickEvidence = value.type === "CONTROL_SWING";
    if (value.evidenceKind !== (tickEvidence ? "tick" : "event") || (tickEvidence ? value.reasons.length !== 0 || value.tickTimesMs.length === 0 : value.reasons.length === 0)) throw new Error("Incorrect moment evidence kind");
    return { type: value.type, teamId: value.teamId, timeMs: value.timeMs, windowStartMs: value.windowStartMs, windowEndMs: value.windowEndMs, evidenceKind: tickEvidence ? "tick" : "event", reasons: value.reasons, tickTimesMs: value.tickTimesMs, values };
  }).sort((a, b) => a.timeMs - b.timeMs || a.type.localeCompare(b.type) || a.teamId.localeCompare(b.teamId));
}

export function momentName(moment: Moment): string {
  return { SET_PIECE_SHOT: "Set-piece shot", SUSTAINED_PRESSURE: "Sustained pressure", CONTROL_SWING: "Control swing" }[moment.type];
}

export function createAnalytics(replay: Replay, scenario: string, hooks: Hooks) {
  const controlToggle = element<HTMLInputElement>("#control-toggle");
  const summaries = Array.from(document.querySelectorAll<HTMLElement>("#summary-series [data-cutoff]"));
  const controlLayer = element<SVGGElement>("#control-layer");
  const metricsLabel = element("#metrics-label");
  const metricsState = element("#metrics-state");
  const momentList = element<HTMLOListElement>("#moment-list");
  const momentsState = element("#moments-state");
  const evidenceList = element<HTMLOListElement>("#evidence-list");
  const valuesList = element<HTMLDListElement>("#moment-values");
  const valuesLabel = element("#moment-values-label");
  const indexTeams = element("#metric-index-teams");
  // The experience draws C7 state lines (state-line.ts); /legacy keeps its plain text.
  const experience = document.body.classList.contains("experience");
  const momentCount = element("#moment-count");
  // The experience hero (absent on /legacy) restates the same tick's indexDelta.
  const hero = document.querySelector<HTMLElement>(".match-hero");
  let heroKey = "";
  // Sign of the last headline delta, so a flip can tint the headline once (DIRECTION §3.3, row 5).
  let heroSign = 0;
  let tintRun = 0;
  // The server painted the start tick; keep it until /api/metrics settles.
  let metricsSettled = false;
  const banner = element("#moment-banner");
  let bannerKey = "";
  const rangeMarker = element("#evidence-range-marker");
  const pressurePanel = element("#pressure-insight");
  const pressureEvidence = element<HTMLButtonElement>("#pressure-evidence");
  let pressureMoment: Moment | undefined;
  let pressureKey = "";
  pressureEvidence.addEventListener("click", () => { if (pressureMoment) hooks.playMoment(pressureMoment); });
  let metrics: Metrics | undefined;
  let moments: Moment[] = [];
  let momentsLoaded = false;
  let lastSummary: HTMLElement | undefined;
  let lastTick: Tick | undefined;
  let field: ControlField | undefined;
  let lastField: ControlField | undefined;
  let evidenceKey = "";
  // The experience draws the trail as a rail: source events as rows, metric ticks behind one
  // disclosure (DIRECTION C4). /legacy keeps one card per entry.
  const evidenceRail = document.body.classList.contains("experience");
  let trailRows: { timeMs: number; nodes: HTMLElement[] }[] = [];
  let activeTrail: HTMLElement[] = [];
  let rangeKey = "";
  let growRun = 0;
  const rows: { moment: Moment; row: HTMLLIElement; button: HTMLButtonElement }[] = [];
  const cells: SVGRectElement[] = [];
  // The legacy view keeps its original overlay palette; the experience uses each team's own colour.
  const controlFill = document.body.classList.contains("experience") ? ["var(--team-home)", "var(--team-away)"] : ["#f47761", "#48bed3"];
  const write = (id: string, text: string) => { element(id).textContent = text; };
  const teamName = (id: string) => replay.match.teams.find(team => team.id === id)?.name ?? id;
  const valueLabels: Record<string, string> = { deltaFrom: "Index difference before", deltaTo: "Index difference after", signal: "Change", actions: "Final-third actions", finalThird: "Final-third control" };

  controlToggle.addEventListener("change", hooks.repaint);

  async function request(path: string): Promise<unknown> {
    const response = await fetch(`${path}?scenario=${encodeURIComponent(scenario)}${path === "/api/metrics" ? "&grid=1" : ""}`);
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response.json() as Promise<unknown>;
  }
  async function loadMetrics(): Promise<void> {
    try {
      metrics = decodeMetrics(await request("/api/metrics"), replay, scenario);
      controlToggle.disabled = !metrics.supported;
      controlToggle.checked = metrics.supported && !document.body.classList.contains("experience");
      metricsLabel.textContent = metrics.supported ? metrics.label : "Tracking metrics unavailable";
      metricsState.textContent = metrics.supported ? metrics.label : metrics.reason;
      if (experience && !metrics.supported) {
        // Name the real cause on Live and in the pane; the raw reason goes in <details>.
        const { key, values } = trackingState(metrics.reason, hooks.matchTime);
        // Keyed like the state lines, so a locale change re-renders it (i18n.ts).
        metricsLabel.setAttribute("data-i18n", key);
        for (const [name, value] of Object.entries(values)) metricsLabel.setAttribute(`data-i18n-arg-${name}`, value);
        metricsLabel.textContent = t(key, values);
        renderState(metricsState, "no-tracking", key, values, metrics.reason);
        for (const node of document.querySelectorAll<HTMLElement>("#pane-control .metric-values, #pane-control h4")) node.hidden = true;
      }
      if (metrics.supported) {
        for (let row = 0; row < metrics.rows; row++) for (let col = 0; col < metrics.cols; col++) {
          const cell = document.createElementNS("http://www.w3.org/2000/svg", "rect");
          cell.setAttribute("x", String(32 + col / metrics.cols * 986));
          cell.setAttribute("y", String(20 + (1 - (row + 1) / metrics.rows) * 640));
          cell.setAttribute("width", String(986 / metrics.cols));
          cell.setAttribute("height", String(640 / metrics.rows));
          controlLayer.append(cell); cells.push(cell);
        }
      }
    } catch (error: unknown) {
      metrics = undefined;
      controlToggle.checked = false; controlToggle.disabled = true;
      metricsLabel.textContent = "Metrics unavailable";
      if (experience) renderState(metricsState, "error", "Metrics unavailable");
      else metricsState.textContent = "Metrics unavailable";
      console.warn("Metrics unavailable", error);
    } finally {
      metricsSettled = true;
    }
    hooks.repaint();
  }
  async function loadMoments(): Promise<void> {
    try {
      moments = decodeMoments(await request("/api/moments"), replay, scenario);
      momentsLoaded = true;
      for (const moment of moments) {
        const row = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button"; button.className = "moment-button";
        button.dataset.momentType = moment.type; button.dataset.momentTime = String(moment.timeMs);
        button.setAttribute("aria-label", `Replay ${momentName(moment)} at ${hooks.matchTime(moment.timeMs)}`);
        const title = document.createElement("strong"); title.textContent = momentName(moment);
        const detail = document.createElement("span"); detail.textContent = `${hooks.matchTime(moment.timeMs)} / ${teamName(moment.teamId)}`;
        button.append(createElement(ListVideo, { width: 16, height: 16, "aria-hidden": "true" }), title, detail);
        button.addEventListener("click", () => hooks.playMoment(moment));
        row.append(button);
        if (document.body.classList.contains("experience")) {
          const compare = document.createElement("button");
          compare.type = "button"; compare.className = "icon-button compare-moment";
          compare.title = t("Compare windows"); compare.setAttribute("aria-label", t("Compare windows"));
          compare.append(createElement(ArrowLeftRight, {width:16, height:16, "aria-hidden":"true"}));
          compare.addEventListener("click", () => document.dispatchEvent(new CustomEvent("pulse:compare-moment", {detail:{timeMs:moment.timeMs, teamId:moment.teamId}})));
          row.append(compare);
        }
        row.hidden = true; momentList.append(row); rows.push({ moment, row, button });
      }
    } catch (error: unknown) {
      if (experience) renderState(momentsState, "error", "Moments unavailable");
      else momentsState.textContent = "Moments unavailable";
      console.warn("Moments unavailable", error);
    }
    hooks.repaint();
  }

  function renderSummary(clock: number): void {
    const summary = [...summaries].reverse().find(item => Number(item.dataset.cutoff) <= clock);
    if (!summary || (summary === lastSummary && summary.dataset.renderedLocale === locale())) return;
    lastSummary = summary;
    summary.dataset.renderedLocale = locale();
    const values = summary.dataset;
    const passes = Number(values.passes), attempts = Number(values.attempts);
    write("#summary-actions", t("stats.of", {count:values.actions ?? 0, total:replay.events.length}));
    write("#summary-passes", t("stats.of", {count:passes, total:attempts}));
    element<HTMLElement>("#summary-pass-fill").style.width = `${attempts ? 100 * passes / attempts : 0}%`;
    write("#summary-attacks", t("stats.attacks", {entries:values.entries ?? 0, entry:t(values.entries === "1" ? "entry" : "entries"), shots:values.shots ?? 0, shot:t(values.shots === "1" ? "shot" : "shots")}));
    write("#summary-conversion", Number(values.entries) ? t("stats.converted", {count:values.converted ?? 0, total:values.entries ?? 0}) : "N/A");
    if (experience) {
      // Zero counts read as one line each, never "0 of 0" or "N/A".
      const noPasses = attempts === 0, noAttacks = !Number(values.entries) && !Number(values.shots);
      element("#summary-passes").hidden = noPasses;
      element("#summary-pass-fill").parentElement!.hidden = noPasses;
      element("#summary-passes-state").hidden = !noPasses;
      element("#summary-attacks").hidden = noAttacks;
      element("#summary-attacks-state").hidden = !noAttacks;
      element("#summary-conversion").hidden = !Number(values.entries);
    }
    for (const side of ["home", "away"] as const) {
      const count = Number(values[side]);
      write(`#${side}-pass-share`, t("stats.passes", {count, pass:t(count === 1 ? "pass" : "passes")}));
      write(`#${side}-pass-share-mobile`, `${count} ${t(count === 1 ? "pass" : "passes")}`);
      element<HTMLElement>(`#${side}-pass-fill`).style.width = `${passes ? count / passes * 100 : 0}%`;
    }
  }

  function renderMetrics(clock: number): ControlField | undefined {
    const tick = metrics?.ticks.slice().reverse().find(item => item.timeMs <= clock);
    if (tick !== lastTick) {
      lastTick = tick;
      if (tick && metrics) {
        write("#metrics-clock", hooks.matchTime(tick.timeMs));
        element("#metrics-clock").dataset.timeMs = String(tick.timeMs);
        write("#metric-entropy", tick.entropy.toFixed(4));
        write("#metric-pressing", tick.pressing === null ? "N/A" : tick.pressing.toFixed(4));
        write("#metric-carrier", tick.carrier ? replay.match.players.find(player => player.id === tick.carrier?.playerId)?.name ?? "N/A" : "N/A");
        replay.match.teams.forEach((team, index) => {
          write(`#metric-${index === 0 ? "home" : "away"}-third`, tick.teams[team.id].finalThird.toFixed(4));
        });
        const [first, second] = metrics.teams, delta = tick.teams[first].indexDelta;
        write("#metric-index-delta", delta?.toFixed(4) ?? "N/A");
        indexTeams.textContent = delta === null ? "" : `${teamName(first)} − ${teamName(second)}`;
        indexTeams.hidden = delta === null;
        field = { cols: metrics.cols, rows: metrics.rows, values: tick.grid, homeTeamGrid: metrics.teamId === replay.match.teams[0].id };
      } else {
        field = undefined;
        write("#metric-index-delta", "N/A");
        indexTeams.textContent = ""; indexTeams.hidden = true;
      }
    }
    renderHero(tick);
    const visible = controlToggle.checked ? field : undefined;
    if (visible !== lastField) {
      lastField = visible;
      controlLayer.toggleAttribute("hidden", !visible);
      if (visible) cells.forEach((cell, i) => {
        const value = visible.values[i];
        const home = (value >= .5) === visible.homeTeamGrid;
        cell.style.fill = home ? controlFill[0] : controlFill[1];
        cell.setAttribute("fill-opacity", String(Math.abs(value - .5) * .55));
      });
    }
    return visible;
  }

  function renderHero(tick: Tick | undefined): void {
    if (!hero || !metricsSettled) return;
    const key = `${locale()}:${metrics?.supported ?? "failed"}:${tick?.timeMs ?? "none"}`;
    if (key === heroKey) return;
    heroKey = key;
    const delta = tick && metrics ? tick.teams[metrics.teams[0]].indexDelta : null;
    const result = indexHeadline(delta, metrics?.teams ?? ["", ""], teamName, locale(), metrics?.supported ?? true);
    write("#hero-index-headline", t(result.headline.key, result.headline.values));
    const sign = Math.sign(delta ?? 0);
    if (sign && heroSign && sign !== heroSign) tintHeadline();
    if (sign) heroSign = sign;
    write("#hero-index-delta", result.signed);
    element("#hero-index-delta").hidden = !result.label;
    hero.dataset.index = result.label ? "value" : "none";
    const teams = element("#hero-index-teams"), chip = element("#hero-index-chip");
    teams.textContent = result.label; teams.hidden = !result.label;
    chip.textContent = t(result.chip); chip.hidden = !result.chip;
  }

  // A 200 ms background tint on the headline only; no counting animation. CSS drops it
  // under reduced motion. The class goes when it ends, so re-showing Live does not replay it.
  function tintHeadline(): void {
    const headline = element("#hero-index-headline");
    headline.classList.remove("sign-flipped");
    void headline.offsetWidth;
    headline.classList.add("sign-flipped");
    const run = ++tintRun;
    void Promise.allSettled(headline.getAnimations().map((animation) => animation.finished)).then(() => { if (run === tintRun) headline.classList.remove("sign-flipped"); });
  }

  function renderEvidence(cue: Cue | undefined, selected: Moment | undefined, clip: boolean): void {
    const key = `${locale()}:${clip}:${selected ? `${selected.type}:${selected.teamId}:${selected.timeMs}` : cue?.id ?? "none"}`;
    if (key === evidenceKey) return;
    evidenceKey = key;
    const modelValues = Object.entries(selected?.values ?? {});
    evidenceList.replaceChildren(); valuesList.replaceChildren(); valuesList.hidden = !selected; valuesLabel.hidden = !modelValues.length;
    write("#evidence-kind", selected?.type === "SUSTAINED_PRESSURE" ? "Source events & metric ticks" : selected?.evidenceKind === "tick" ? "Metric ticks" : selected || cue ? "Source events" : "No selection");
    write("#evidence-state", selected ? t("evidence.moment", { moment: t(momentName(selected)), team: teamName(selected.teamId) }) : cue ? "Insight source events" : "No evidence selected");
    if (selected) {
      for (const [name, value] of modelValues) {
        const row = document.createElement("div"), term = document.createElement("dt"), number = document.createElement("dd");
        term.textContent = t(valueLabels[name] ?? name); number.textContent = String(value); row.append(term, number); valuesList.append(row);
      }
    }
    const entries = selected?.evidenceKind === "tick"
      ? selected.tickTimesMs.map(timeMs => ({ timeMs, id: "", title: t("evidence.tickAt", { clock: hooks.matchTime(timeMs) }) }))
      : (selected?.reasons ?? cue?.eventIds ?? []).flatMap(id => {
        const event = replay.events.find(item => item.id === id);
        return event ? [{ timeMs: event.timeMs, id: event.id, title: hooks.eventSentence(event) }] : [];
      });
    if (selected?.type === "SUSTAINED_PRESSURE") entries.push(...selected.tickTimesMs.map(timeMs => ({ timeMs, id: "", title: t("evidence.tickAt", { clock: hooks.matchTime(timeMs) }) })));
    trailRows = []; activeTrail = [];
    const tickRows: HTMLLIElement[] = [];
    const ticksSummary = document.createElement("summary");
    for (const entry of entries) {
      const row = document.createElement("li"), button = document.createElement("button");
      row.className = "evidence-card"; button.type = "button"; button.className = "source-event-button";
      if (entry.id) button.dataset.sourceEvent = entry.id;
      else button.dataset.sourceTick = String(entry.timeMs);
      button.setAttribute("aria-label", entry.id ? `Inspect ${entry.id} at ${hooks.matchTime(entry.timeMs)}` : entry.title);
      if (evidenceRail) {
        const span = (className: string, text: string) => { const node = document.createElement("span"); node.className = className; node.textContent = text; return node; };
        button.append(span("evidence-id", entry.id || t("Tick")), span("evidence-time", hooks.matchTime(entry.timeMs)), span("evidence-desc", entry.title));
      } else {
        const title = document.createElement("strong"), description = document.createElement("span");
        title.textContent = `${entry.id || t("Tick")} / ${hooks.matchTime(entry.timeMs)}`; description.textContent = entry.title;
        button.append(createElement(ListVideo, { width: 16, height: 16, "aria-hidden": "true" }), title, description);
      }
      button.addEventListener("click", () => hooks.inspectTime(entry.timeMs, entry.id || undefined));
      row.append(button);
      if (evidenceRail && !entry.id) tickRows.push(row);
      else evidenceList.append(row);
      if (evidenceRail) trailRows.push({ timeMs: entry.timeMs, nodes: entry.id ? [button] : [button, ticksSummary] });
    }
    // The ticks stay in the DOM (every [data-source-tick] node) and collapse into one row whose
    // count and range are the API's tickTimesMs.
    if (tickRows.length) {
      const group = document.createElement("li"), details = document.createElement("details"), label = document.createElement("span"), chip = document.createElement("span"), list = document.createElement("ol");
      const times = selected?.tickTimesMs ?? [];
      group.className = "evidence-card evidence-ticks"; label.className = "evidence-ticks-label"; chip.className = "estimate-chip"; list.className = "evidence-tick-list";
      label.textContent = times.length === 1
        ? t("evidence.tickOne", { count: 1, clock: hooks.matchTime(times[0]) })
        : t("evidence.ticks", { count: times.length, start: hooks.matchTime(times[0]), end: hooks.matchTime(times[times.length - 1]) });
      chip.textContent = t("model estimate, uncalibrated");
      ticksSummary.append(label, chip); list.append(...tickRows); details.append(ticksSummary, list); group.append(details);
      evidenceList.append(group);
    }
    const start = selected?.windowStartMs ?? cue?.replayStartMs;
    const end = selected?.windowEndMs ?? cue?.replayEndMs;
    rangeMarker.hidden = start === undefined || end === undefined;
    if (start !== undefined && end !== undefined) {
      const duration = replay.match.endMs - replay.match.startMs;
      const lo = Math.max(replay.match.startMs, start), hi = Math.min(replay.match.endMs, end);
      rangeMarker.style.left = `${(lo - replay.match.startMs) / duration * 100}%`;
      rangeMarker.style.width = `${(hi - lo) / duration * 100}%`;
      rangeMarker.title = `${hooks.matchTime(lo)} - ${hooks.matchTime(hi)}`;
      // Only a starting clip grows the marker; an active cue just shows its range.
      const range = clip ? `${lo}:${hi}` : "";
      if (evidenceRail && range && range !== rangeKey) growMarker();
      rangeKey = range;
    } else rangeKey = "";
  }

  // Row 3 of DIRECTION §3.3: the marker grows from the clip start over 320 ms. CSS drops the
  // animation under reduced motion; the class goes when it ends, so a re-render does not replay it.
  function growMarker(): void {
    rangeMarker.classList.remove("is-growing");
    void rangeMarker.offsetWidth;
    rangeMarker.classList.add("is-growing");
    const run = ++growRun;
    void Promise.allSettled(rangeMarker.getAnimations().map((animation) => animation.finished)).then(() => { if (run === growRun) rangeMarker.classList.remove("is-growing"); });
  }

  // The latest trail row the clock has passed is tinted; a tick also tints its collapsed row.
  function markTrail(clock: number): void {
    let latest: { timeMs: number; nodes: HTMLElement[] } | undefined;
    for (const row of trailRows) if (row.timeMs <= clock && (!latest || row.timeMs >= latest.timeMs)) latest = row;
    const next = latest?.nodes ?? [];
    if (next.length === activeTrail.length && next.every((node, i) => node === activeTrail[i])) return;
    for (const node of activeTrail) delete node.dataset.active;
    for (const node of next) node.dataset.active = "true";
    activeTrail = next;
  }

  return {
    async load(): Promise<void> { await Promise.all([loadMetrics(), loadMoments()]); },
    findMoment(type:string,timeMs:number,teamId:string):Moment|undefined { return moments.find(moment=>moment.type===type && moment.timeMs===timeMs && moment.teamId===teamId); },
    render(clock: number, cue: Cue | undefined, selected: Moment | undefined, clip = false): ControlField | undefined {
      renderSummary(clock);
      const control = renderMetrics(clock);
      let count = 0;
      for (const { moment, row, button } of rows) {
        row.hidden = moment.timeMs > clock && moment !== selected;
        button.setAttribute("aria-pressed", String(moment === selected));
        if (!row.hidden) count++;
      }
      write("#moment-count", String(count));
      if (experience) {
        momentCount.hidden = count === 0;
        if (momentsLoaded && count) clearState(momentsState);
        else if (momentsLoaded) renderState(momentsState, "empty", moments.length ? "No moments yet" : "No moments detected");
      } else if (momentsLoaded) momentsState.textContent = count ? "" : moments.length ? "No moments yet" : "No moments detected";
      const active = selected ?? [...moments].reverse().find(moment => clock >= moment.timeMs && clock < moment.timeMs + 3500);
      banner.hidden = !active;
      const nextBannerKey = active ? `${locale()}:${active.type}:${active.teamId}:${active.timeMs}` : "";
      if (active && nextBannerKey !== bannerKey) {
        write("#moment-banner-title", momentName(active));
        const detail = element("#moment-banner-detail");
        detail.textContent = `${teamName(active.teamId)} / ${hooks.matchTime(active.timeMs)}`;
        if (active.evidenceKind === "tick" || active.type === "SUSTAINED_PRESSURE") {
          const chip = document.createElement("span");
          chip.className = "estimate-chip";
          chip.textContent = t("model estimate, uncalibrated");
          detail.append(" / ", chip);
        }
        banner.dataset.teamKit = teamKit(active.teamId, replay.match.teams.map(team => team.id));
      }
      bannerKey = nextBannerKey;
      const pressure = selected ?? [...moments].reverse().find(moment => moment.type === "SUSTAINED_PRESSURE" && clock >= moment.timeMs && clock < moment.timeMs + 10000);
      const narration = pressure && pressureNarration(pressure, replay, document.body.dataset.persona ?? "CASUAL");
      pressurePanel.hidden = !narration;
      element(".insight-panel").hidden = Boolean(narration);
      pressureMoment = narration ? pressure : undefined;
      const nextPressureKey = narration ? `${locale()}:${narration.key}:${pressure!.timeMs}` : "";
      if (nextPressureKey !== pressureKey) {
        pressureKey = nextPressureKey;
        if (narration) {
          pressurePanel.dataset.eventIds = narration.eventIds.join(" ");
          pressurePanel.dataset.tickTimes = narration.tickTimesMs.join(" ");
          pressurePanel.dataset.startMs = String(narration.startMs);
          pressurePanel.dataset.endMs = String(narration.endMs);
          write("#pressure-text", t(narration.key, { team: narration.team, count: narration.count, control: narration.control,
            start: hooks.matchTime(narration.startMs), end: hooks.matchTime(narration.endMs) }));
          write("#pressure-window", `${hooks.matchTime(narration.startMs)} - ${hooks.matchTime(narration.endMs)} / ${narration.eventIds.join(", ")}`);
        }
      }
      renderEvidence(cue, selected, clip);
      markTrail(clock);
      return control;
    },
  };
}
