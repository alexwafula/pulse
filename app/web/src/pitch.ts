export {};

import { createIcons, createElement, Play, Pause, RotateCcw, Maximize, Scan, Camera, ListVideo, Undo2, Download, Layers, Copy, Presentation, X } from "lucide";
import type { PitchRenderer, SceneState, RenderPlayer } from "./renderers/types";
import { createAnalytics, type Moment } from "./analytics";
import { locale, localize, observeLocalization, supportedLocale, t } from "./i18n";
import { closeDropdowns, initializeSelects, syncSelects } from "./selects";
import { renderFactCheck } from "./fact-check";
import { renderInspector, type Inspection } from "./agent-inspector";
import { teamColour, teamKit } from "./team-colour";
import { setBadge } from "./status-badge";
import { mountLowerThird } from "./lower-third";
import { actionPlaybackRange, advancePlayback, evidencePlaybackRange, trackingFrameIndex, type PlaybackRange } from "./playback";
import { evidenceURL, readEvidenceLink, replayKey, type EvidenceLink, type LinkSelection } from "./evidence-link";
import { createPresentation } from "./broadcast";

const scrollBehavior = (): ScrollBehavior => matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

type ThreeModule = typeof import("./renderers/three");
type PixiModule = typeof import("./renderers/pixi");

type Point = { x: number; y: number };
type Ball = Point & { z: number };
type Team = { id: string; name: string; attackingDirection: "LEFT" | "RIGHT" };
type Player = { id: string; teamId: string; name: string; number: number };
type Match = {
  id: string;
  period?: number;
  startMs: number;
  endMs: number;
  pitch: { lengthM: number; widthM: number };
  teams: Team[];
  players: Player[];
};
type Event = {
  id: string;
  timeMs: number;
  type: "PASS" | "CARRY" | "CROSS" | "CLEARANCE" | "CORNER" | "SHOT";
  teamId: string;
  actorId: string;
  recipientId?: string;
  from: Point;
  to: Point;
  outcome: "COMPLETE" | "INCOMPLETE" | "BLOCKED";
};
type TrackedPlayer = Point & { playerId: string };
type Frame = { timeMs: number; ball: Ball; players: TrackedPlayer[] };
export type Replay = { schemaVersion: string; match: Match; events: Event[]; tracking: Frame[] };
export type Cue = { id: string; startMs: number; endMs: number; replayStartMs: number; replayEndMs: number; text: string; factIds: string[]; eventIds: string[]; verification: { status: string; claimsChecked: number; claimsPassed: number; claims: { claimId: string; supported: boolean; reason: string; eventIds: string[] }[] } };
type CueFeed = { schemaVersion: string; cues: Cue[] };

const svgNS = "http://www.w3.org/2000/svg";
const field = { x: 32, y: 20, width: 986, height: 640 };

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}

const playerLayer = required<SVGGElement>("#player-layer");
const ball = required<SVGCircleElement>("#ball");
const ballShadow = required<SVGCircleElement>("#ball-shadow");
const eventPathLayer = required<SVGGElement>("#event-path-layer");
const eventPath = required<SVGLineElement>("#event-path");
const eventStart = required<SVGCircleElement>("#event-start");
const playButton = required<HTMLButtonElement>("#play-button");
const restartButton = required<HTMLButtonElement>("#restart-button");
const seek = required<HTMLInputElement>("#seek");
const clockDisplay = required<HTMLElement>("#match-clock");
const currentAction = required<HTMLElement>("#current-action");
const eventList = required<HTMLOListElement>("#event-list");
const detailTitle = required<HTMLElement>("#detail-title");
const detailDescription = required<HTMLElement>("#detail-description");
const eventCount = required<HTMLElement>("#event-count");
const pitchStamp = required<HTMLElement>("#pitch-stamp");
const startLabel = required<HTMLElement>("#start-label");
const endLabel = required<HTMLElement>("#end-label");
const speedButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-speed]"));
const viewButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-view]"));
const canvasHost = required<HTMLElement>("#canvas-host");
const svgPitch = required<SVGSVGElement>("#pitch");
const cameraReset = required<HTMLButtonElement>("#camera-reset");
const fullscreen = required<HTMLButtonElement>("#fullscreen-button");
const rendererStatus = required<HTMLElement>("#renderer-status");
const actionResult = required<HTMLElement>("#action-result");
const resultTitle = required<HTMLElement>("#result-title");
const resultDetail = required<HTMLElement>("#result-detail");
// /legacy keeps its two separately positioned overlays; the experience shows one caption bar.
if (document.body.classList.contains("experience")) mountLowerThird(required<HTMLElement>("#lower-third"));
const insightText = required<HTMLElement>("#insight-text");
const insightStatus = required<HTMLElement>("#insight-status");
const insightEvidence = required<HTMLElement>("#insight-evidence");
const insightWindow = required<HTMLElement>("#insight-window");
const evidenceButton = required<HTMLButtonElement>("#evidence-button");
const evidenceReturn = required<HTMLButtonElement>("#evidence-return");
const playbackStatus = required<HTMLElement>("#playback-status");
const playbackHeading = required<HTMLElement>("#playback-heading");
const playbackDetail = required<HTMLElement>("#playback-detail");
const sequenceActions = required<HTMLElement>("#sequence-actions");
// While an evidence clip (a moment's or the insight's) plays, the experience shows the trail under the pitch on Live
// rather than far down the drawer (DIRECTION C4). /legacy has no slot and keeps it in place.
const evidenceTrail = required<HTMLElement>("#evidence-trail");
const evidenceTrailHome = evidenceTrail.parentElement!;
const clipTrailSlot = document.querySelector<HTMLElement>("#clip-trail-slot");
const evidenceMoved = document.querySelector<HTMLElement>("#evidence-moved");
function placeEvidenceTrail(underPitch: boolean): void {
  if (!clipTrailSlot || !evidenceMoved) return;
  if (underPitch) clipTrailSlot.append(evidenceTrail);
  else evidenceTrailHome.append(evidenceTrail);
  clipTrailSlot.hidden = !underPitch;
  evidenceMoved.hidden = !underPitch;
}
// Once a clip has started on Live, scroll just enough that the trail's first row is fully in
// view, but never so far that less than 80% of the pitch stays visible.
function revealEvidenceTrail(): void {
  if (!clipTrailSlot || clipTrailSlot.hidden) return;
  requestAnimationFrame(() => {
    const row = clipTrailSlot.querySelector("#evidence-list > li")?.getBoundingClientRect();
    const shell = required<HTMLElement>(".pitch-shell").getBoundingClientRect();
    if (!row || clipTrailSlot.closest("#experience-watch-dock")) return;
    const margin = 8;
    const needed = row.bottom + margin - innerHeight;
    const allowed = shell.top + shell.height * 0.2;
    const by = Math.min(needed, allowed);
    if (by > 0) window.scrollBy({ top: by, behavior: scrollBehavior() });
  });
}
const pitchLoading = document.querySelector<HTMLElement>("#pitch-loading");
const pitchError = document.querySelector<HTMLElement>("#pitch-error");
const retryButton = document.querySelector<HTMLButtonElement>("#pitch-retry");
const runDemoButton = document.querySelector<HTMLButtonElement>("#run-demo-button");
let cues: Cue[] = [];
let inspections: Inspection[] = [];
let insightSource = "";
let evidenceCue: Cue | undefined;
let momentClip: Moment | undefined;
let clipRange: PlaybackRange | undefined;
let inspectedAction: Event | undefined;
let finalActionRange: PlaybackRange | undefined;
let analytics: ReturnType<typeof createAnalytics> | undefined;
let returnClock = 0;
let displayedCueID: string | undefined;
let persona = "CASUAL";
let insightRequest = 0;
let userSelectedTab: string | null = null;
let drawerTabs: HTMLButtonElement[] = [];
let drawerPanes: HTMLElement[] = [];

function setDrawerTab(tabId: string, isUser = false, section?: "live"): void {
  if (isUser) userSelectedTab = tabId;
  for (const tab of drawerTabs) {
    const active = tab.dataset.tab === tabId;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  }
  for (const pane of drawerPanes) {
    pane.classList.toggle("active", pane.dataset.pane === tabId);
  }
  document.dispatchEvent(new CustomEvent("pulse:pane-selected", { detail: { pane: tabId, section } }));
}

const localePicker = required<HTMLSelectElement>("#locale");
const scenarioPicker = required<HTMLSelectElement>("#scenario");
const requestedURL = new URL(location.href);
const preferences = requestedURL.searchParams;
let replayFingerprint="";
let sharedLink:EvidenceLink|undefined;
function savedPreference(key: string): string | null {
  try { return localStorage.getItem(`pulse:${key}`); } catch { return null; }
}
// A supported ?locale= wins over storage; unsupported values are ignored and
// saveAudience() overwrites a stale stored value with the locale actually used.
localePicker.value = [preferences.get("locale"), savedPreference("locale")].find(supportedLocale) ?? "en-GB";
persona = (preferences.get("persona") ?? savedPreference("persona")) === "ANALYST" ? "ANALYST" : "CASUAL";
let audienceInitialized=false;
function saveAudience(): void {
  document.body.dataset.locale = localePicker.value;
  document.body.dataset.persona = persona;
  document.documentElement.lang = localePicker.value.split("-")[0];
  for (const button of document.querySelectorAll<HTMLButtonElement>("button[data-persona]")) button.setAttribute("aria-pressed", String(button.dataset.persona === persona));
  const url = new URL(location.href);
  for (const [key, value, fallback] of [["locale", localePicker.value, "en-GB"], ["persona", persona, "CASUAL"]]) {
    if (!preferences.has("share") || audienceInitialized) {
      if (value === fallback && !preferences.has("share")) url.searchParams.delete(key); else url.searchParams.set(key, value);
    }
    try { localStorage.setItem(`pulse:${key}`, value); } catch { /* Storage can be disabled in private contexts. */ }
  }
  history.replaceState(null, "", url);
  localize();
  syncSelects();
  const build = document.querySelector<HTMLElement>("#build-label");
  if (build) build.textContent = t("build.label", { sha: build.dataset.build || "unknown" });
}
saveAudience();
audienceInitialized=true;
observeLocalization();
initializeSelects();
function scenarioQuery(): string { return `scenario=${encodeURIComponent(scenarioPicker.value)}`; }

function clearEvidence(): void {
  evidenceCue = undefined;
  momentClip = undefined;
  clipRange = undefined;
  inspectedAction = undefined;
  previousFrameTime = 0;
  evidenceReturn.hidden = true;
  placeEvidenceTrail(false);
  for (const button of speedButtons) { button.disabled = false; button.setAttribute("aria-pressed", String(Number(button.dataset.speed) === speed)); }
  for (const button of eventButtons.values()) button.classList.remove("evidence-event");
}

function setClip(range: PlaybackRange): void {
  clipRange = range;
  previousFrameTime = 0;
  evidenceReturn.hidden = false;
  for (const button of speedButtons) {
    button.disabled = true;
    button.setAttribute("aria-pressed", String(button.dataset.speed === "1"));
  }
}

function inspectAt(timeMs: number, eventId?: string, showLive = true): void {
  const action = eventId ? replay.events.find(event => event.id === eventId) : undefined;
  if (eventId && !action) return;
  const at = action?.timeMs ?? timeMs;
  if (!Number.isFinite(at) || at < replay.match.startMs || at > replay.match.endMs) return;
  stopDemo();
  if (!clipRange) returnClock = clock;
  clearEvidence();
  playing = false;
  clock = at;
  if (action) {
    inspectedAction = action;
    setClip(actionPlaybackRange(replay, action));
    eventButtons.get(action.id)?.classList.add("evidence-event");
  }
  setDrawerTab(action ? "timeline" : "control", true, showLive ? "live" : undefined);
  render();
}

function renderInsight(): void {
  const cue = evidenceCue ?? [...cues].reverse().find((item) => clock >= item.startMs && clock <= item.endMs);
  const id = cue?.id ?? "";
  if (displayedCueID === id) return;
  displayedCueID = id;
  insightText.textContent = cue?.text ?? "Awaiting next moment";
  const inspection=inspections.find(item=>item.cueId===cue?.id);
  const source=inspection?.source ?? insightSource;
  const verified = cue?.verification.status === "VERIFIED", recorded = verified && source === "python-recorded";
  if (!cue) setBadge(insightStatus, "waiting", "Waiting");
  else setBadge(insightStatus, verified ? "verified" : "template", verified ? (recorded ? "Verified (recorded)" : "Verified") : "Template", recorded);
  insightEvidence.hidden = !cue;
  renderFactCheck(cue, source, matchTime);
  renderInspector(cue, inspection);
  if (cue) insightWindow.textContent = t("insight.window", { start: matchTime(cue.replayStartMs), end: matchTime(cue.replayEndMs), count: cue.eventIds.length, events: t(cue.eventIds.length === 1 ? "event" : "events") });
}

async function loadInsights(): Promise<void> {
  const request = ++insightRequest;
  try {
    const response = await fetch(`/api/agent-inspection?${scenarioQuery()}&persona=${persona}&locale=${localePicker.value}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Insight request failed: ${response.status}`);
    const envelope = await response.json() as {version:string; feed:CueFeed; inspections:Inspection[]};
    if (envelope.version !== "pulse-inspection-v1" || !Array.isArray(envelope.inspections)) throw new Error("Unsupported inspection feed");
    const feed = envelope.feed;
    if (request !== insightRequest) return;
    if (feed.schemaVersion !== "2.0.0" || !Array.isArray(feed.cues)) throw new Error("Unsupported cue feed");
    cues = feed.cues;
    inspections = envelope.inspections;
    insightSource = response.headers.get("X-Pulse-Insight-Source") ?? "";
    if (!cues.length) { insightText.textContent = "No corner-shot moment in this sequence"; setBadge(insightStatus, "none", "No moment"); }
    else { displayedCueID = undefined; renderInsight(); }
  } catch (error: unknown) {
    if (request !== insightRequest) return;
    console.warn("Insight feed unavailable", error);
    insightText.textContent = "Insights unavailable";
    setBadge(insightStatus, "unavailable", "Unavailable");
  }
}
let pitchRenderer: PitchRenderer | undefined;
let sceneState: SceneState = { players: new Map(), velocities: new Map(), ball: { x: 0, y: 0 } };
let switchingView = false;
let playLabel = "";

async function switchView(view: string): Promise<void> {
  if (switchingView) return;
  switchingView = true;
  viewButtons.forEach((button) => { button.disabled = true; });
  pitchRenderer?.destroy();
  pitchRenderer = undefined;
  canvasHost.replaceChildren();
  canvasHost.hidden = view === "svg";
  svgPitch.style.display = view === "svg" ? "" : "none";
  rendererStatus.hidden = true;
  try {
    const teamIds = replay.match.teams.map((team) => team.id);
    const players: RenderPlayer[] = replay.match.players.map((player) => ({
      ...player, home: player.teamId === teamIds[0],
      kit: teamKit(player.teamId, teamIds), colour: teamColour(player.teamId, teamIds),
    }));
    if (view === "three") {
      const { createThree } = (await import("./three-renderer.js" as string)) as unknown as ThreeModule;
      pitchRenderer = createThree(canvasHost, players);
    } else if (view === "pixi") {
      const { createPixi } = (await import("./pixi-renderer.js" as string)) as unknown as PixiModule;
      pitchRenderer = await createPixi(canvasHost, players);
    }
  } catch (error: unknown) {
    console.warn("Pitch renderer unavailable", error);
    canvasHost.replaceChildren();
    canvasHost.hidden = true;
    svgPitch.style.display = "";
    view = "svg";
    rendererStatus.textContent = "Graphics unavailable. SVG view is active.";
    rendererStatus.hidden = false;
  } finally {
    cameraReset.hidden = view !== "three";
    const cameraOptions = document.querySelector<HTMLElement>("#camera-options");
    if (cameraOptions) cameraOptions.hidden = view !== "three";
    const mode = document.querySelector<HTMLSelectElement>("#camera-mode")?.value;
    if (mode === "broadcast" || mode === "tactical" || mode === "follow") pitchRenderer?.setCamera?.(mode);
    viewButtons.forEach((button) => {
      button.disabled = false;
      button.setAttribute("aria-pressed", String(button.dataset.view === view));
    });
    document.querySelector(".pitch-shell")?.setAttribute("data-renderer", view);
    switchingView = false;
    render();
  }
}

let replay: Replay;
let clock = 0;
let speed = 4;
let playing = false;
let previousFrameTime = 0;
let frame = 0;
let drawPending = false;
let pitchVisible = true;
let currentEventId: string | null = null;
const playerElements = new Map<string, SVGGElement>();
const eventButtons = new Map<string, HTMLButtonElement>();
const passingSnapshots = Array.from(document.querySelectorAll<HTMLElement>(".passing-snapshot"));
const passingClock = required<HTMLElement>("#passing-clock");
let activePassingSnapshot: HTMLElement | undefined;
const attackSnapshots = Array.from(document.querySelectorAll<HTMLElement>(".attack-snapshot"));
const attackClock = required<HTMLElement>("#attack-clock");
let activeAttackSnapshot: HTMLElement | undefined;
// Only /legacy has the drawer Recap pane; experience pages show Recap, and its pending
// state, in the sidebar Recap section.
const recapPanel = document.querySelector<HTMLElement>("#recap-panel");
const framePlayers = new Map<number, Map<string, TrackedPlayer>>();
let publishedClock = "";
const presentation=createPresentation(render);
let presentationSpeed:number|undefined;
document.addEventListener("pulse:presentation",event=>{
  const active=(event as CustomEvent<{active:boolean}>).detail.active;
  if(active){presentationSpeed=speed;speed=1;}
  else if(presentationSpeed!==undefined){speed=presentationSpeed;presentationSpeed=undefined;}
  previousFrameTime=0;
  for(const button of speedButtons) button.setAttribute("aria-pressed",String(Number(button.dataset.speed)===(clipRange?1:speed)));
});

function shareCurrentEvidence():void {
  if (!replay || !replayFingerprint) return;
  let selection:LinkSelection|undefined;
  if(inspectedAction) selection={eventId:inspectedAction.id};
  else if(evidenceCue) selection={cueId:evidenceCue.id};
  else if(momentClip) selection={momentType:momentClip.type,momentAt:momentClip.timeMs,teamId:momentClip.teamId};
  else if(clipRange) selection={startMs:clipRange.startMs,endMs:clipRange.endMs};
  const state:EvidenceLink={scenario:scenarioPicker.value,matchId:replay.match.id,replayKey:replayFingerprint,timeMs:Math.floor(clock),
    locale:locale(),persona,view:document.querySelector<HTMLElement>(".pitch-shell")?.dataset.renderer ?? "svg",
    camera:document.querySelector<HTMLSelectElement>("#camera-mode")?.value ?? "broadcast",control:required<HTMLInputElement>("#control-toggle").checked,
    broadcast:presentation.active(),section:document.body.dataset.section ?? "live",selection,returnMs:selection?Math.floor(returnClock):undefined};
  void presentation.copy(evidenceURL(location.href,state));
}

function restoreSharedEvidence(link:EvidenceLink):void {
  clearEvidence(); playing=false; clock=link.timeMs; returnClock=link.returnMs ?? link.timeMs;
  const selection=link.selection;
  if(selection) {
    if("eventId" in selection) {
      const event=replay.events.find(item=>item.id===selection.eventId)!;
      const range=actionPlaybackRange(replay,event);
      if(clock<range.startMs || clock>range.endMs) throw new Error("Shared evidence unavailable");
      inspectedAction=event;setClip(range);eventButtons.get(event.id)?.classList.add("evidence-event");
    } else if("cueId" in selection) {
      const cue=cues.find(item=>item.id===selection.cueId);
      if(!cue) throw new Error("Shared evidence unavailable");
      const range=evidencePlaybackRange(replay,{startMs:cue.replayStartMs,endMs:cue.replayEndMs},cue.eventIds);
      if(clock<range.startMs || clock>range.endMs) throw new Error("Shared evidence unavailable");
      evidenceCue=cue;setClip(range);for(const id of cue.eventIds) eventButtons.get(id)?.classList.add("evidence-event");
    } else if("momentType" in selection) {
      const moment=analytics?.findMoment(selection.momentType,selection.momentAt,selection.teamId);
      if(!moment) throw new Error("Shared evidence unavailable");
      const original={startMs:Math.max(replay.match.startMs,moment.windowStartMs),endMs:moment.windowEndMs};
      const range=moment.type==="SET_PIECE_SHOT"?evidencePlaybackRange(replay,original,moment.reasons):original;
      if(clock<range.startMs || clock>range.endMs) throw new Error("Shared evidence unavailable");
      momentClip=moment;setClip(range);for(const id of moment.reasons) eventButtons.get(id)?.classList.add("evidence-event");
    } else setClip(selection);
    // Like a clicked moment or insight clip, a shared one shows the trail under the pitch on the Evidence tab.
    if(momentClip || evidenceCue) placeEvidenceTrail(true);
    setDrawerTab(momentClip || evidenceCue?"evidence":"timeline",true,"live");
  }
  const control=required<HTMLInputElement>("#control-toggle");
  if(link.control && control.disabled) throw new Error("Shared evidence unavailable");
  control.checked=link.control;
  const camera=document.querySelector<HTMLSelectElement>("#camera-mode");if(camera){camera.value=link.camera;syncSelects();}
  pitchRenderer?.setCamera?.(link.camera as "broadcast"|"tactical"|"follow");
  if(link.broadcast) presentation.enter();
  render();
  if(momentClip || evidenceCue) revealEvidenceTrail();
}

function renderBroadcast():void {
  const cue=evidenceCue ?? [...cues].reverse().find(item=>clock>=item.startMs && clock<=item.endMs);
  if(cue && clock>=cue.startMs && clock<=Math.min(cue.endMs,cue.startMs+12000)) {
    const verified=cue.verification.status==="VERIFIED",recorded=(inspections.find(item=>item.cueId===cue.id)?.source ?? insightSource)==="python-recorded";
    presentation.render(matchTime(clock),{key:cue.id,text:cue.text,status:verified?"verified":"template",label:verified?recorded?"Verified (recorded)":"Verified":"Template",recorded:verified&&recorded,evidence:()=>evidenceButton.click()});
    return;
  }
  const pressure=required<HTMLElement>("#pressure-insight"),at=Number(pressure.dataset.endMs);
  if(!pressure.hidden && Number.isFinite(at) && clock>=at && clock<at+10000) {
    presentation.render(matchTime(clock),{key:`pressure-${at}`,text:required<HTMLElement>("#pressure-text").textContent ?? "",status:"template",label:"Template",estimate:true,evidence:()=>required<HTMLButtonElement>("#pressure-evidence").click()});
    return;
  }
  const event=[...replay.events].reverse().find(item=>item.timeMs<=clock);
  const text=clock>=replay.match.endMs?t("Sequence complete"):event?.type==="SHOT" && clock<event.timeMs+6000?eventSentence(event):"";
  presentation.render(matchTime(clock),text?{key:clock>=replay.match.endMs?"complete":event!.id,text,status:"none",label:""}:undefined);
}

function pitchPoint(point: Point): Point {
  return {
    x: field.x + (point.x / replay.match.pitch.lengthM) * field.width,
    y: field.y + (1 - point.y / replay.match.pitch.widthM) * field.height,
  };
}

function matchTime(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

function label(type: Event["type"]): string {
  return t(type.charAt(0) + type.slice(1).toLowerCase());
}

function playerName(id: string): string {
  return replay.match.players.find((player) => player.id === id)?.name ?? id;
}

function teamName(id: string): string {
  return replay.match.teams.find((team) => team.id === id)?.name ?? id;
}

function eventSentence(event: Event): string {
  const actor = playerName(event.actorId);
  const recipient = event.recipientId ? playerName(event.recipientId) : "";
  switch (event.type) {
    case "PASS": return t("event.pass", {actor, recipient});
    case "CARRY": return t("event.carry", {actor});
    case "CROSS": return t("event.cross", {actor});
    case "CLEARANCE": return t("event.clearance", {actor});
    case "CORNER": return t("event.corner", {actor, recipient});
    case "SHOT": return t(event.outcome === "BLOCKED" ? "event.blocked" : event.outcome === "INCOMPLETE" ? "event.incomplete" : "event.shot", {actor});
  }
}

function createPlayers(): void {
  const homeID = replay.match.teams[0].id;
  for (const player of replay.match.players) {
    const group = document.createElementNS(svgNS, "g");
    const circle = document.createElementNS(svgNS, "circle");
    circle.setAttribute("r", "15");
    circle.setAttribute("class", player.teamId === homeID ? "player-home" : "player-away");
    const number = document.createElementNS(svgNS, "text");
    number.setAttribute("class", "player-number");
    number.textContent = String(player.number);
    const title = document.createElementNS(svgNS, "title");
    title.textContent = `${player.name}, ${teamName(player.teamId)}`;
    group.append(circle, number, title);
    playerLayer.append(group);
    playerElements.set(player.id, group);
  }
}

function createTimeline(): void {
  // The experience's timeline is a rail with one dot per row in the team's server-rendered kit (DIRECTION C6).
  const teamDots = document.body.classList.contains("experience");
  const teamIds = replay.match.teams.map((team) => team.id);
  for (const event of replay.events) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", `Jump to ${matchTime(event.timeMs)}: ${eventSentence(event)}`);
    const time = document.createElement("span");
    time.className = "event-time";
    time.textContent = matchTime(event.timeMs);
    const copy = document.createElement("span");
    copy.className = "event-copy";
    const type = document.createElement("strong");
    type.textContent = label(event.type);
    const description = document.createElement("span");
    description.textContent = eventSentence(event);
    copy.append(type, description);
    button.append(time);
    if (teamDots) {
      const dot = document.createElement("span");
      dot.className = "event-team-dot";
      dot.dataset.teamId = event.teamId;
      dot.dataset.teamKit = teamKit(event.teamId, teamIds);
      dot.setAttribute("aria-hidden", "true");
      button.append(dot);
    }
    button.append(copy);
    button.addEventListener("click", () => {
      inspectAt(event.timeMs, event.id);
    });
    item.append(button);
    eventList.append(item);
    eventButtons.set(event.id, button);
  }
}

function refreshReplayText(): void {
  eventCount.textContent = t("stats.actions", {count:replay.events.length});
  const clockPeriod = document.querySelector<HTMLElement>(".clock-period");
  if (clockPeriod) clockPeriod.textContent = t(replay.match.period === 2 ? "2nd Half" : "1st Half");
  const home = replay.match.teams[0];
  pitchStamp.textContent = t("team.stamp", {team:home.name.toUpperCase(), direction:t(home.attackingDirection)});
  document.querySelectorAll<HTMLElement>(".team-sub").forEach((element,index) => {
    const team = replay.match.teams[index];
    if (team) element.textContent = t("team.direction", {team:team.name, direction:t(team.attackingDirection)});
  });
  const phase = document.querySelector<HTMLElement>(".left-rail .rail-card .rail-sub");
  if (phase) phase.textContent = t("stats.window", {start:matchTime(replay.match.startMs), end:matchTime(replay.match.endMs)});
  const events = document.querySelector<HTMLElement>("#summary-actions")?.parentElement?.querySelector<HTMLElement>(".rail-sub");
  if (events) events.textContent = t("stats.eventMeta", {count:replay.events.length, length:replay.match.pitch.lengthM, width:replay.match.pitch.widthM});
}

function interpolate(a: number, b: number, fraction: number): number {
  return a + (b - a) * fraction;
}

function renderPositions(): void {
  const frames = replay.tracking;
  const index = trackingFrameIndex(frames, clock);
  const first = frames[index];
  const second = frames[Math.min(index + 1, frames.length - 1)];
  const duration = second.timeMs - first.timeMs;
  const fraction = duration > 0 ? (clock - first.timeMs) / duration : 0;
  const nextPlayers = framePlayers.get(second.timeMs)!;
  sceneState.players.clear();
  sceneState.velocities?.clear();
  sceneState.timeMs = clock;

  for (const tracked of first.players) {
    const next = nextPlayers.get(tracked.playerId) ?? tracked;
    const position = {
      x: interpolate(tracked.x, next.x, fraction),
      y: interpolate(tracked.y, next.y, fraction),
    };
    sceneState.players.set(tracked.playerId, position);
    sceneState.velocities?.set(tracked.playerId, { x: duration > 0 ? (next.x - tracked.x) * 1000 / duration : 0, y: duration > 0 ? (next.y - tracked.y) * 1000 / duration : 0 });
    const point = pitchPoint(position);
    playerElements.get(tracked.playerId)?.setAttribute("transform", `translate(${point.x} ${point.y})`);
  }

  sceneState.ball = {
    x: interpolate(first.ball.x, second.ball.x, fraction),
    y: interpolate(first.ball.y, second.ball.y, fraction),
    z: interpolate(first.ball.z, second.ball.z, fraction),
  };
  const ballPoint = pitchPoint(sceneState.ball);
  ball.setAttribute("cx", String(ballPoint.x));
  ball.setAttribute("cy", String(ballPoint.y));
  ballShadow.setAttribute("cx", String(ballPoint.x + 4));
  ballShadow.setAttribute("cy", String(ballPoint.y + 5));
}

function renderEvent(): void {
  const event = [...replay.events].reverse().find((candidate) => candidate.timeMs <= clock);
  const nextID = event?.id ?? "";
  if (nextID !== currentEventId) {
    actionResult.hidden = event?.type !== "SHOT";
    if (event?.type === "SHOT") {
      resultTitle.textContent = event.outcome === "BLOCKED" ? "Shot blocked" : event.outcome === "INCOMPLETE" ? "Unsuccessful shot" : "Shot completed";
      resultDetail.textContent = `${playerName(event.actorId)} · ${teamName(event.teamId)} · ${matchTime(event.timeMs)}`;
      actionResult.dataset.teamKit = teamKit(event.teamId, replay.match.teams.map((team) => team.id));
    }
    if (currentEventId) eventButtons.get(currentEventId)?.removeAttribute("aria-current");
    if (event) {
      currentAction.textContent = `${label(event.type)} · ${eventSentence(event)}`;
      detailTitle.textContent = t("event.at", {kind:label(event.type), clock:matchTime(event.timeMs)});
      detailDescription.textContent = `${teamName(event.teamId)} · ${t(event.outcome)}`;
      if (persona === "ANALYST") detailDescription.textContent += ` · ${event.id} · ${event.from.x.toFixed(1)}, ${event.from.y.toFixed(1)} → ${event.to.x.toFixed(1)}, ${event.to.y.toFixed(1)} m`;
      eventButtons.get(nextID)?.setAttribute("aria-current", "true");
      const from = pitchPoint(event.from);
      const to = pitchPoint(event.to);
      eventPath.setAttribute("x1", String(from.x));
      eventPath.setAttribute("y1", String(from.y));
      eventPath.setAttribute("x2", String(to.x));
      eventPath.setAttribute("y2", String(to.y));
      eventStart.setAttribute("cx", String(from.x));
      eventStart.setAttribute("cy", String(from.y));
    } else {
      currentAction.textContent = t("event.building", {team:replay.match.teams[0].name});
      detailTitle.textContent = "Awaiting first action";
      detailDescription.textContent = t("event.start", {clock:matchTime(replay.match.startMs)});
    }
    currentEventId = nextID;
  }
  const focused = event && (clock - event.timeMs < 6500 || event === inspectedAction);
  eventPathLayer.style.display = focused ? "" : "none";
  sceneState.path = focused ? { from: event.from, to: event.to } : undefined;
  sceneState.selectedPlayer = focused ? event.actorId : undefined;
}

function renderPlaybackStatus(): void {
  const complete = !clipRange && clock >= replay.match.endMs;
  const tail = !clipRange && !complete && finalActionRange && clock >= finalActionRange.endMs + 1500;
  playbackStatus.hidden = !clipRange && !complete && !tail;
  const state = clipRange ? clock >= clipRange.endMs ? "clip-complete" : playing ? "clip-playing" : "action-ready" : complete ? "sequence-complete" : tail ? "tracking-tail" : "match";
  playbackStatus.dataset.state = state;
  sequenceActions.hidden = Boolean(clipRange) || (!complete && !tail);
  let heading = "", detail = "";
  if (clipRange) {
    heading = state === "clip-complete" ? t("Evidence replay complete") : inspectedAction ? t("Selected action") : t("Evidence replay");
    detail = `${inspectedAction ? `${eventSentence(inspectedAction)} · ${inspectedAction.id} · ` : ""}${t("playback.window", {start: matchTime(clipRange.startMs), end: matchTime(clipRange.endMs)})}`;
    const factEnd = evidenceCue?.replayEndMs ?? momentClip?.windowEndMs;
    if (factEnd !== undefined && clipRange.endMs > factEnd) detail += ` · ${t("playback.postroll", {end: matchTime(clipRange.endMs)})}`;
  } else if (complete || tail) {
    heading = t(complete ? "Sequence complete" : "All actions recorded");
    const last = replay.events[replay.events.length - 1];
    detail = last ? `${eventSentence(last)} · ${matchTime(last.timeMs)}` : t("No actions recorded");
    if (last?.type === "SHOT" && last.outcome === "COMPLETE") detail += ` · ${t("Completed shot; no goal outcome recorded")}`;
    if (tail) detail += ` · ${t("playback.trackingTail", {end: matchTime(replay.match.endMs)})}`;
  }
  if (playbackHeading.textContent !== heading) playbackHeading.textContent = heading;
  if (playbackDetail.textContent !== detail) playbackDetail.textContent = detail;
  const shell = required<HTMLElement>(".pitch-shell");
  shell.dataset.timeMs = String(clock);
  shell.dataset.eventId = currentEventId ?? "";
  shell.dataset.playbackState = playing ? "playing" : state;
}

function render(): void {
  renderPositions();
  renderEvent();
  renderInsight();
  const cue = evidenceCue ?? [...cues].reverse().find(item => clock >= item.startMs && clock <= item.endMs);
  sceneState.control = analytics?.render(clock, cue, momentClip, evidenceCue !== undefined || momentClip !== undefined);
  renderBroadcast();
  const snapshot = [...passingSnapshots].reverse().find((item) => Number(item.dataset.cutoff) <= clock);
  if (snapshot !== activePassingSnapshot) {
    if (activePassingSnapshot) activePassingSnapshot.hidden = true;
    if (snapshot) snapshot.hidden = false;
    activePassingSnapshot = snapshot;
  }
  passingClock.textContent = `${matchTime(replay.match.startMs)} - ${matchTime(clock)}`;
  const attack = [...attackSnapshots].reverse().find((item) => Number(item.dataset.cutoff) <= clock);
  if (attack !== activeAttackSnapshot) {
    if (activeAttackSnapshot) activeAttackSnapshot.hidden = true;
    if (attack) attack.hidden = false;
    activeAttackSnapshot = attack;
  }
  attackClock.textContent = matchTime(clock);
  if (recapPanel) recapPanel.hidden = clock < replay.match.endMs;
  if (recapPanel && clock >= replay.match.endMs && !userSelectedTab && !momentClip) {
    setDrawerTab("recap");
  } else if (!userSelectedTab && evidenceCue) {
    setDrawerTab("timeline");
  }
  clockDisplay.textContent = matchTime(clock);
  seek.value = String(Math.round(((clock - replay.match.startMs) / (replay.match.endMs - replay.match.startMs)) * 1000));
  const clipEnd = clipRange?.endMs;
  const nextPlayLabel = playing ? "Pause" : clipEnd !== undefined && clock >= clipEnd ? "Replay evidence" : clock >= replay.match.endMs ? "Replay" : "Play";
  if (playLabel !== nextPlayLabel) {
    playLabel = nextPlayLabel;
    playButton.replaceChildren(createElement(playing ? Pause : Play));
    playButton.setAttribute("aria-label", t(playLabel));
    playButton.title = t(playLabel);
  }
  renderPlaybackStatus();
  paint();
  if (playing) wake();
  const publication = `${playing ? Math.floor(clock / 1000) : clock}:${playing}:${currentEventId}`;
  if (publication !== publishedClock) {
    publishedClock = publication;
    document.dispatchEvent(new CustomEvent("pulse:clock", { detail: { timeMs: Math.floor(clock), playing, scenario: scenarioPicker.value } }));
  }
}

// Draw on demand: the scene changes only through render(), resizes and camera
// input, so a paused, hidden or off-screen pitch costs no frames.
function paint(): void {
  if (!pitchRenderer) { drawPending = false; return; }
  drawPending = true;
  if (document.hidden) return;
  // Navigation can remount the pitch before IntersectionObserver catches up.
  if (!pitchVisible) {
    const bounds = canvasHost.getBoundingClientRect();
    if (canvasHost.hidden || bounds.width === 0 || bounds.height === 0 || bounds.bottom <= 0 || bounds.top >= innerHeight) return;
    pitchVisible = true;
  }
  drawPending = false;
  pitchRenderer.update(sceneState);
  // A true result means the orbit camera is still easing after input.
  if (pitchRenderer.draw()) requestDraw();
}

function requestDraw(): void {
  drawPending = true;
  wake();
}

function wake(): void {
  if (!frame && replay && !document.hidden) frame = requestAnimationFrame(animate);
}

function animate(time: number): void {
  frame = 0;
  if (document.hidden) return;
  if (playing) {
    if (previousFrameTime) {
      const end = clipRange?.endMs ?? replay.match.endMs;
      clock = advancePlayback(clock, time - previousFrameTime, clipRange ? 1 : speed, end);
      if (clock >= end) playing = false;
      render();
    }
    previousFrameTime = time;
  } else {
    previousFrameTime = 0;
  }
  if (drawPending && !playing) paint();
  if (playing || (drawPending && pitchVisible)) wake();
}

let demoRunning = false;
let demoAbortController: AbortController | null = null;

function stopDemo(): void {
  if (!demoRunning) return;
  demoRunning = false;
  if (demoAbortController) {
    demoAbortController.abort();
    demoAbortController = null;
  }
  if (runDemoButton) {
    runDemoButton.textContent = "Run demo";
    runDemoButton.setAttribute("aria-pressed", "false");
    runDemoButton.hidden = document.body.classList.contains("experience");
  }
}

async function startDemo(): Promise<void> {
  if (demoRunning) {
    stopDemo();
    return;
  }
  demoRunning = true;
  if (runDemoButton) {
    runDemoButton.hidden = false;
    runDemoButton.textContent = "Stop demo";
    runDemoButton.setAttribute("aria-pressed", "true");
  }
  const controller = new AbortController();
  demoAbortController = controller;
  const { signal } = controller;

  const waitMs = (ms: number) => new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new Error("Demo aborted"));
    });
  });

  try {
    clearEvidence();
    clock = replay.match.startMs;
    speed = 4;
    for (const option of speedButtons) option.setAttribute("aria-pressed", String(option.dataset.speed === "4"));
    playing = true;
    render();

    if (!cues.length) {
      await loadInsights();
    }
    const momentCue = cues[0];
    const targetMomentMs = momentCue ? momentCue.startMs : replay.match.startMs + 8000;

    while (clock < targetMomentMs && playing && !signal.aborted) {
      await waitMs(100);
    }
    if (signal.aborted) return;

    if (momentCue) {
      if (!evidenceCue) returnClock = clock;
      clearEvidence();
      evidenceCue = momentCue;
      setClip(evidencePlaybackRange(replay, {startMs: momentCue.replayStartMs, endMs: momentCue.replayEndMs}, momentCue.eventIds));
      clock = momentCue.replayStartMs;
      playing = true;
      previousFrameTime = 0;
      evidenceReturn.hidden = false;
      for (const id of momentCue.eventIds) eventButtons.get(id)?.classList.add("evidence-event");
      render();

      while (clock < clipRange!.endMs && playing && !signal.aborted) {
        await waitMs(100);
      }
      if (signal.aborted) return;

      await waitMs(1200);
      if (signal.aborted) return;

      clearEvidence();
      clock = returnClock;
      playing = true;
      speed = 10;
      for (const option of speedButtons) option.setAttribute("aria-pressed", String(option.dataset.speed === "10"));
      previousFrameTime = 0;
      render();
    }

    while (clock < replay.match.endMs && playing && !signal.aborted) {
      await waitMs(100);
    }
    if (signal.aborted) return;

    playing = false;
    clock = replay.match.endMs;
    render();
    if (document.body.classList.contains("experience")) document.dispatchEvent(new CustomEvent("pulse:demo-complete"));
    else recapPanel?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
  } catch (_e) {
    // Aborted or cancelled
  } finally {
    demoRunning = false;
    demoAbortController = null;
    if (runDemoButton) {
      runDemoButton.textContent = "Run demo";
      runDemoButton.setAttribute("aria-pressed", "false");
      runDemoButton.hidden = document.body.classList.contains("experience");
    }
  }
}

async function start(): Promise<void> {
  if (pitchLoading) pitchLoading.hidden = false;
  if (pitchError) pitchError.hidden = true;
  try {
    const response = await fetch(`/api/replay?${scenarioQuery()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Replay request failed: ${response.status}`);
    replay = await response.json() as Replay;
    if (replay.schemaVersion !== "2.0.0" || replay.tracking.length < 2) {
      throw new Error("Unsupported replay data");
    }
    for (const frame of replay.tracking) {
      framePlayers.set(frame.timeMs, new Map(frame.players.map((player) => [player.playerId, player])));
    }
    const finalAction = replay.events[replay.events.length - 1];
    finalActionRange = finalAction ? actionPlaybackRange(replay, finalAction) : undefined;
    clock = replay.match.startMs;
    try {replayFingerprint=await replayKey(replay);}
    catch {const share=required<HTMLButtonElement>("#share-button");share.disabled=true;share.title=t("Evidence sharing unavailable");required<HTMLButtonElement>("#broadcast-copy").disabled=true;}
    try {sharedLink=readEvidenceLink(requestedURL,replay,replayFingerprint,scenarioPicker.value);if(sharedLink) clock=sharedLink.timeMs;}
    catch {required<HTMLElement>("#shared-position-error").hidden=false;}
    eventCount.textContent = t("stats.actions", {count:replay.events.length});
    startLabel.textContent = matchTime(replay.match.startMs);
    endLabel.textContent = matchTime(replay.match.endMs);
    refreshReplayText();
    const halfLabel = document.querySelector<HTMLElement>(".half-label");
    if (halfLabel) {
      halfLabel.textContent = replay.match.period === 2 ? "Second half" : "First half";
    }
    createPlayers();
    createTimeline();
    document.addEventListener("pulse:replay-window", event => {
      const detail = (event as CustomEvent<{startMs:number;endMs:number}>).detail;
      if (!detail || !Number.isSafeInteger(detail.startMs) || !Number.isSafeInteger(detail.endMs) || detail.startMs < replay.match.startMs || detail.endMs > clock || detail.endMs <= detail.startMs) return;
      stopDemo();
      if (!clipRange) returnClock = clock;
      clearEvidence();
      setClip(detail);
      clock = detail.startMs; playing = true; previousFrameTime = 0;
      setDrawerTab("timeline", true, "live"); render();
    });
    document.addEventListener("pulse:inspect", (event) => {
      const detail = (event as CustomEvent<{ eventId?: string; timeMs?: number }>).detail;
      if (!detail) return;
      inspectAt(detail.timeMs ?? NaN, detail.eventId, Boolean(detail.eventId));
    });
    document.addEventListener("pulse:select-pane", (event) => {
      const pane = (event as CustomEvent<{ pane?: string }>).detail?.pane;
      if (pane && ["timeline", "passing", "control", "routes", "recap", "evidence"].includes(pane)) setDrawerTab(pane, true);
    });
    document.addEventListener("pulse:camera", (event) => {
      const mode = (event as CustomEvent<{ mode?: string }>).detail?.mode;
      if (mode === "broadcast" || mode === "tactical" || mode === "follow") { pitchRenderer?.setCamera?.(mode); render(); }
    });
    analytics = createAnalytics(replay, scenarioPicker.value, {
      repaint: render, matchTime, eventSentence,
      playMoment: (moment) => {
        stopDemo();
        if (!clipRange) returnClock = clock;
        clearEvidence();
        momentClip = moment;
        const range = {startMs: Math.max(replay.match.startMs, moment.windowStartMs), endMs: moment.windowEndMs};
        setClip(moment.type === "SET_PIECE_SHOT" ? evidencePlaybackRange(replay, range, moment.reasons) : range);
        clock = Math.max(replay.match.startMs, moment.windowStartMs);
        playing = true; previousFrameTime = 0;
        for (const id of moment.reasons) eventButtons.get(id)?.classList.add("evidence-event");
        evidenceReturn.hidden = false;
        placeEvidenceTrail(true);
        setDrawerTab("evidence", true, "live");
        render();
        revealEvidenceTrail();
      },
      inspectTime: (timeMs, eventId) => {
        inspectAt(timeMs, eventId);
      },
    });
    drawerTabs = Array.from(document.querySelectorAll<HTMLButtonElement>(".drawer-tab"));
    drawerPanes = Array.from(document.querySelectorAll<HTMLElement>(".drawer-pane"));
    for (const tab of drawerTabs) {
      tab.addEventListener("click", () => {
        if (tab.dataset.tab) setDrawerTab(tab.dataset.tab, true);
      });
      tab.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const index = drawerTabs.indexOf(tab);
        const next = event.key === "Home" ? 0 : event.key === "End" ? drawerTabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + drawerTabs.length) % drawerTabs.length;
        const target = drawerTabs[next];
        if (target.dataset.tab) setDrawerTab(target.dataset.tab, true);
        target.focus();
      });
    }
    setDrawerTab("timeline");
    scenarioPicker.addEventListener("change", () => {
      stopDemo();
      const url = new URL(location.href); url.searchParams.set("scenario", scenarioPicker.value); location.assign(url);
    });
    document.addEventListener("pulse:library-open", () => { stopDemo(); playing = false; previousFrameTime = 0; render(); });
    document.querySelector("#fact-check")!.addEventListener("click", event => {
      const id = (event.target as Element).closest<HTMLButtonElement>("[data-fact-source]")?.dataset.factSource;
      if (id) eventButtons.get(id)?.click();
    });
    for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>("[data-pass-evidence]"))) {
      const id = button.dataset.passEvidence ?? "";
      const event = replay.events.find((item) => item.id === id);
      if (event) {
        button.textContent = matchTime(event.timeMs);
        button.setAttribute("aria-label", `Show events at ${matchTime(event.timeMs)}`);
      }
      button.addEventListener("click", () => {
        inspectAt(NaN, id);
      });
    }
    createIcons({ icons: { Play, RotateCcw, Maximize, Scan, Camera, ListVideo, Undo2, Download, Layers, Copy, Presentation, X } });
    required<HTMLButtonElement>("#share-button").addEventListener("click",shareCurrentEvidence);
    required<HTMLButtonElement>("#broadcast-copy").addEventListener("click",shareCurrentEvidence);
    for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>("[data-recap-evidence]"))) {
      const event = replay.events.find((item) => item.id === button.dataset.recapEvidence);
      if (event) {
        const span = button.querySelector("span");
        if (span) span.textContent = matchTime(event.timeMs);
        button.setAttribute("aria-label", `Show events at ${matchTime(event.timeMs)}`);
      }
      button.addEventListener("click", () => {
        inspectAt(NaN, button.dataset.recapEvidence ?? "");
      });
    }
    // The sidebar Recap section asks for the download by event; /legacy has its own button.
    const downloadRecap = (): void => {
      const source = document.querySelector('.story-content[data-panel="recap"]') ?? recapPanel;
      if (!source) return;
      const lines = Array.from(source.querySelectorAll("li p")).map((item) => item.textContent ?? "");
      const text = [`Pulse - ${replay.match.teams[0].name} vs ${replay.match.teams[1].name}`, t("Synthetic sequence recap"), `${matchTime(replay.match.startMs)} - ${matchTime(replay.match.endMs)}`, ...lines].join("\n");
      const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
      const link = document.createElement("a"); link.href = url; link.download = "pulse-sequence-recap.txt"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    document.querySelector<HTMLButtonElement>("#download-recap")?.addEventListener("click", downloadRecap);
    document.addEventListener("pulse:download-recap", downloadRecap);
    function changeAudience(nextPersona: string): void {
        stopDemo();
        // A cue belongs to an audience; a detector moment does not.
        if (evidenceCue) { clock = returnClock; playing = false; clearEvidence(); }
        closeDropdowns();
        persona = nextPersona;
        saveAudience();
        for (const event of replay.events) {
          const button = eventButtons.get(event.id)!;
          button.querySelector("strong")!.textContent = label(event.type);
          button.querySelector(".event-copy > span")!.textContent = eventSentence(event);
          button.setAttribute("aria-label", `Jump to ${matchTime(event.timeMs)}: ${eventSentence(event)}`);
        }
        if (currentEventId) eventButtons.get(currentEventId)?.removeAttribute("aria-current");
        currentEventId = null; playLabel = "";
        refreshReplayText();
        cues = []; inspections = []; displayedCueID = undefined; render(); void loadInsights();
        document.dispatchEvent(new CustomEvent("pulse:audience", { detail: { persona, locale: locale() } }));
    }
    for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>("button[data-persona]"))) {
      button.addEventListener("click", () => changeAudience(button.dataset.persona ?? "CASUAL"));
    }
    localePicker.addEventListener("change", () => changeAudience(persona));
    document.dispatchEvent(new CustomEvent("pulse:audience", { detail: { persona, locale: locale() } }));
    evidenceButton.addEventListener("click", () => {
      stopDemo();
      const cue = evidenceCue ?? [...cues].reverse().find((item) => clock >= item.startMs && clock <= item.endMs);
      if (!cue) return;
      if (!clipRange) returnClock = clock;
      clearEvidence(); evidenceCue = cue;
      setClip(evidencePlaybackRange(replay, {startMs: cue.replayStartMs, endMs: cue.replayEndMs}, cue.eventIds));
      clock = cue.replayStartMs; playing = true; previousFrameTime = 0;
      for (const id of cue.eventIds) eventButtons.get(id)?.classList.add("evidence-event");
      // Like a moment clip: the trail goes under the pitch and the drawer shows the Evidence tab.
      placeEvidenceTrail(true);
      setDrawerTab("evidence", true, "live");
      render();
      revealEvidenceTrail();
    });
    evidenceReturn.addEventListener("click", () => {
      stopDemo();
      clearEvidence();
      clock = returnClock;
      playing = false;
      previousFrameTime = 0;
      if (recapPanel && clock >= replay.match.endMs && !userSelectedTab) setDrawerTab("recap");
      else if (userSelectedTab) setDrawerTab(userSelectedTab);
      render();
    });
    for (const button of viewButtons) button.addEventListener("click", () => { void switchView(button.dataset.view ?? "svg"); });
    cameraReset.addEventListener("click", () => { pitchRenderer?.resetCamera(); requestDraw(); });
    // Resizes clear the WebGL buffer; orbit input moves the camera outside render().
    new ResizeObserver(requestDraw).observe(canvasHost);
    window.addEventListener("resize", requestDraw);
    const orbit = (event: PointerEvent | WheelEvent): void => { if (event.type !== "pointermove" || event.buttons) requestDraw(); };
    for (const type of ["pointerdown", "pointermove", "wheel"] as const) canvasHost.addEventListener(type, orbit, { passive: true });
    new IntersectionObserver((entries) => {
      pitchVisible = entries.some(entry => entry.isIntersecting);
      if (pitchVisible && drawPending) wake();
    }).observe(canvasHost);
    document.addEventListener("visibilitychange", () => {
      previousFrameTime = 0;
      if (!document.hidden && (playing || drawPending)) wake();
    });
    fullscreen.addEventListener("click", () => {
      const shell = required<HTMLElement>(presentation.active()?".pitch-column":".pitch-shell");
      const operation = document.fullscreenElement ? document.exitFullscreen() : shell.requestFullscreen();
      void operation.catch(() => {
        rendererStatus.textContent = "Fullscreen is unavailable in this browser.";
        rendererStatus.hidden = false;
      });
    });

    playButton.addEventListener("click", () => {
      stopDemo();
      const clipEnd = clipRange?.endMs;
      if (clipEnd !== undefined && clock >= clipEnd) clock = clipRange!.startMs;
      else if (clock >= replay.match.endMs) clock = replay.match.startMs;
      playing = !playing;
      previousFrameTime = 0;
      render();
    });
    restartButton.addEventListener("click", () => {
      stopDemo();
      clearEvidence();
      userSelectedTab = null;
      setDrawerTab("timeline", true, "live");
      clock = replay.match.startMs;
      playing = true;
      render();
    });
    seek.addEventListener("input", () => {
      stopDemo();
      clearEvidence();
      playing = false;
      clock = replay.match.startMs + (Number(seek.value) / 1000) * (replay.match.endMs - replay.match.startMs);
      render();
    });
    for (const button of speedButtons) {
      button.addEventListener("click", () => {
        stopDemo();
        speed = Number(button.dataset.speed);
        previousFrameTime = 0;
        for (const option of speedButtons) option.setAttribute("aria-pressed", String(option === button));
      });
    }
    runDemoButton?.addEventListener("click", () => {
      void (demoRunning ? stopDemo() : startDemo());
    });
    required<HTMLButtonElement>("#sequence-restart").addEventListener("click", () => restartButton.click());
    required<HTMLButtonElement>("#sequence-recap").addEventListener("click", () => {
      stopDemo(); clearEvidence(); playing = false; clock = replay.match.endMs; render();
      if (document.body.classList.contains("experience")) document.dispatchEvent(new CustomEvent("pulse:open-recap"));
      else { setDrawerTab("recap", true); recapPanel?.scrollIntoView({behavior: scrollBehavior(), block: "start"}); }
    });
    const scenarios = required<HTMLButtonElement>("#sequence-scenarios");
    scenarios.hidden = !document.body.classList.contains("experience");
    scenarios.addEventListener("click", () => document.querySelector<HTMLButtonElement>("#scenario-library-open")?.click());
    playing = !preferences.has("share");
    render();
    const preferredView = sharedLink?.view ?? preferences.get("view") ?? "three";
    await switchView(["three", "pixi", "svg"].includes(preferredView) ? preferredView : "three");
    if (pitchLoading) pitchLoading.hidden = true;
    wake();
    if(preferences.has("share")) {
      await Promise.all([loadInsights(),analytics.load()]);
      if(sharedLink) {
        try {restoreSharedEvidence(sharedLink);}
        catch {clearEvidence();clock=replay.match.startMs;playing=false;required<HTMLElement>("#shared-position-error").hidden=false;render();}
      }
    } else if (preferences.get("demo") === "1") {
      const url = new URL(location.href); url.searchParams.delete("demo"); history.replaceState(null, "", url);
      void startDemo();
    } else void loadInsights();
    if(!preferences.has("share")) void analytics.load();
  } catch (error: unknown) {
    if (pitchLoading) pitchLoading.hidden = true;
    if (pitchError) {
      pitchError.hidden = false;
      const textEl = pitchError.querySelector(".pitch-error-text");
      if (textEl) textEl.textContent = error instanceof Error ? error.message : String(error);
    }
    currentAction.textContent = "Replay unavailable";
    detailTitle.textContent = "Could not load the match";
    detailDescription.textContent = error instanceof Error ? error.message : String(error);
    playButton.disabled = true;
    restartButton.disabled = true;
    seek.disabled = true;
  }
}

retryButton?.addEventListener("click", () => location.reload());
void start();
