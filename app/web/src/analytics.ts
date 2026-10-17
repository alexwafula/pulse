import { createElement, ListVideo } from "lucide";
import { locale, t } from "./i18n";
import type { Replay, Cue } from "./pitch";
import type { ControlField } from "./renderers/types";

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
  const banner = element("#moment-banner");
  const rangeMarker = element("#evidence-range-marker");
  let metrics: Metrics | undefined;
  let moments: Moment[] = [];
  let momentsLoaded = false;
  let lastSummary: HTMLElement | undefined;
  let lastTick: Tick | undefined;
  let field: ControlField | undefined;
  let lastField: ControlField | undefined;
  let evidenceKey = "";
  const rows: { moment: Moment; row: HTMLLIElement; button: HTMLButtonElement }[] = [];
  const cells: SVGRectElement[] = [];
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
      metricsState.textContent = "Metrics unavailable";
      console.warn("Metrics unavailable", error);
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
        row.append(button); row.hidden = true; momentList.append(row); rows.push({ moment, row, button });
      }
    } catch (error: unknown) {
      momentsState.textContent = "Moments unavailable";
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
    const visible = controlToggle.checked ? field : undefined;
    if (visible !== lastField) {
      lastField = visible;
      controlLayer.toggleAttribute("hidden", !visible);
      if (visible) cells.forEach((cell, i) => {
        const value = visible.values[i];
        const home = (value >= .5) === visible.homeTeamGrid;
        cell.setAttribute("fill", home ? "#f47761" : "#48bed3");
        cell.setAttribute("fill-opacity", String(Math.abs(value - .5) * .55));
      });
    }
    return visible;
  }

  function renderEvidence(cue: Cue | undefined, selected: Moment | undefined): void {
    const key = `${locale()}:${selected ? `${selected.type}:${selected.teamId}:${selected.timeMs}` : cue?.id ?? "none"}`;
    if (key === evidenceKey) return;
    evidenceKey = key;
    const modelValues = Object.entries(selected?.values ?? {});
    evidenceList.replaceChildren(); valuesList.replaceChildren(); valuesList.hidden = !selected; valuesLabel.hidden = !modelValues.length;
    write("#evidence-kind", selected?.evidenceKind === "tick" ? "Metric ticks" : selected || cue ? "Source events" : "No selection");
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
    for (const entry of entries) {
      const row = document.createElement("li"), button = document.createElement("button"), title = document.createElement("strong"), description = document.createElement("span");
      row.className = "evidence-card"; button.type = "button"; button.className = "source-event-button";
      if (entry.id) button.dataset.sourceEvent = entry.id;
      else button.dataset.sourceTick = String(entry.timeMs);
      button.setAttribute("aria-label", entry.id ? `Inspect ${entry.id} at ${hooks.matchTime(entry.timeMs)}` : entry.title);
      title.textContent = `${entry.id || t("Tick")} / ${hooks.matchTime(entry.timeMs)}`; description.textContent = entry.title;
      button.append(createElement(ListVideo, { width: 16, height: 16, "aria-hidden": "true" }), title, description);
      button.addEventListener("click", () => hooks.inspectTime(entry.timeMs, entry.id || undefined));
      row.append(button); evidenceList.append(row);
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
    }
  }

  return {
    async load(): Promise<void> { await Promise.all([loadMetrics(), loadMoments()]); },
    render(clock: number, cue: Cue | undefined, selected: Moment | undefined): ControlField | undefined {
      renderSummary(clock);
      const control = renderMetrics(clock);
      let count = 0;
      for (const { moment, row, button } of rows) {
        row.hidden = moment.timeMs > clock && moment !== selected;
        button.setAttribute("aria-pressed", String(moment === selected));
        if (!row.hidden) count++;
      }
      write("#moment-count", String(count));
      if (momentsLoaded) momentsState.textContent = count ? "" : moments.length ? "No moments yet" : "No moments detected";
      const active = selected ?? [...moments].reverse().find(moment => clock >= moment.timeMs && clock < moment.timeMs + 3500);
      banner.hidden = !active;
      if (active) {
        write("#moment-banner-title", momentName(active));
        write("#moment-banner-detail", `${teamName(active.teamId)} / ${hooks.matchTime(active.timeMs)}${active.evidenceKind === "tick" || active.type === "SUSTAINED_PRESSURE" ? ` / ${t("model estimate, uncalibrated")}` : ""}`);
      }
      renderEvidence(cue, selected);
      return control;
    },
  };
}
