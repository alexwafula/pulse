export {};

import { createIcons, createElement, Play, Pause, RotateCcw, Maximize, Scan, ListVideo, Undo2 } from "lucide";
import { createThree } from "./renderers/three";
import { createPixi } from "./renderers/pixi";
import type { PitchRenderer, SceneState, RenderPlayer } from "./renderers/types";

type Point = { x: number; y: number };
type Ball = Point & { z: number };
type Team = { id: string; name: string; attackingDirection: "LEFT" | "RIGHT" };
type Player = { id: string; teamId: string; name: string; number: number };
type Match = {
  id: string;
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
type Replay = { schemaVersion: string; match: Match; events: Event[]; tracking: Frame[] };
type Cue = { id: string; startMs: number; endMs: number; replayStartMs: number; replayEndMs: number; text: string; eventIds: string[]; verification: { status: string } };
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
const speedButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-speed]")];
const viewButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-view]")];
const canvasHost = required<HTMLElement>("#canvas-host");
const svgPitch = required<SVGSVGElement>("#pitch");
const cameraReset = required<HTMLButtonElement>("#camera-reset");
const fullscreen = required<HTMLButtonElement>("#fullscreen-button");
const rendererStatus = required<HTMLElement>("#renderer-status");
const actionResult = required<HTMLElement>("#action-result");
const resultTitle = required<HTMLElement>("#result-title");
const resultDetail = required<HTMLElement>("#result-detail");
const insightText = required<HTMLElement>("#insight-text");
const insightStatus = required<HTMLElement>("#insight-status");
const insightEvidence = required<HTMLElement>("#insight-evidence");
const insightWindow = required<HTMLElement>("#insight-window");
const evidenceButton = required<HTMLButtonElement>("#evidence-button");
const evidenceReturn = required<HTMLButtonElement>("#evidence-return");
let cues: Cue[] = [];
let evidenceCue: Cue | undefined;
let returnClock = 0;
let displayedCueID: string | undefined;

function clearEvidence(): void {
  evidenceCue = undefined;
  evidenceReturn.hidden = true;
  for (const button of speedButtons) { button.disabled = false; button.setAttribute("aria-pressed", String(Number(button.dataset.speed) === speed)); }
  for (const button of eventButtons.values()) button.classList.remove("evidence-event");
}

function renderInsight(): void {
  const cue = evidenceCue ?? [...cues].reverse().find((item) => clock >= item.startMs && clock <= item.endMs);
  const id = cue?.id ?? "";
  if (displayedCueID === id) return;
  displayedCueID = id;
  insightText.textContent = cue?.text ?? "Awaiting next moment";
  insightStatus.textContent = cue ? "Template" : "Waiting";
  insightEvidence.hidden = !cue;
  if (cue) insightWindow.textContent = `${matchTime(cue.replayStartMs)}–${matchTime(cue.replayEndMs)} · ${cue.eventIds.length} events`;
}

async function loadInsights(): Promise<void> {
  try {
    const response = await fetch("/api/insights", { cache: "no-store" });
    if (!response.ok) throw new Error(`Insight request failed: ${response.status}`);
    const feed = await response.json() as CueFeed;
    if (feed.schemaVersion !== "2.0.0" || !Array.isArray(feed.cues)) throw new Error("Unsupported cue feed");
    cues = feed.cues;
    if (!cues.length) { insightText.textContent = "No corner-shot moment in this sequence"; insightStatus.textContent = "No moment"; }
    else { displayedCueID = undefined; renderInsight(); }
  } catch (error: unknown) {
    console.warn("Insight feed unavailable", error);
    insightText.textContent = "Insights unavailable";
    insightStatus.textContent = "Unavailable";
  }
}
let pitchRenderer: PitchRenderer | undefined;
let sceneState: SceneState = { players: new Map(), ball: { x: 0, y: 0 } };
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
    const players: RenderPlayer[] = replay.match.players.map((player) => ({
      ...player, home: player.teamId === replay.match.teams[0].id,
    }));
    if (view === "three") pitchRenderer = createThree(canvasHost, players);
    else if (view === "pixi") pitchRenderer = await createPixi(canvasHost, players);
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
let currentEventId: string | null = null;
const playerElements = new Map<string, SVGGElement>();
const eventButtons = new Map<string, HTMLButtonElement>();
const framePlayers = new Map<number, Map<string, TrackedPlayer>>();

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
  return type.charAt(0) + type.slice(1).toLowerCase();
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
    case "PASS": return `${actor} passes to ${recipient}`;
    case "CARRY": return `${actor} carries the ball`;
    case "CROSS": return `${actor} sends a cross`;
    case "CLEARANCE": return `${actor} clears the ball`;
    case "CORNER": return `${actor} delivers a corner to ${recipient}`;
    case "SHOT": return event.outcome === "BLOCKED" ? `${actor}'s shot is blocked` : event.outcome === "INCOMPLETE" ? `${actor}'s shot is unsuccessful` : `${actor} takes a shot`;
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
    button.append(time, copy);
    button.addEventListener("click", () => {
      clearEvidence();
      playing = false;
      clock = event.timeMs;
      render();
    });
    item.append(button);
    eventList.append(item);
    eventButtons.set(event.id, button);
  }
}

function interpolate(a: number, b: number, fraction: number): number {
  return a + (b - a) * fraction;
}

function renderPositions(): void {
  const frames = replay.tracking;
  let index = 0;
  while (index + 1 < frames.length && frames[index + 1].timeMs <= clock) index++;
  const first = frames[index];
  const second = frames[Math.min(index + 1, frames.length - 1)];
  const duration = second.timeMs - first.timeMs;
  const fraction = duration > 0 ? (clock - first.timeMs) / duration : 0;
  const nextPlayers = framePlayers.get(second.timeMs)!;
  sceneState.players.clear();

  for (const tracked of first.players) {
    const next = nextPlayers.get(tracked.playerId) ?? tracked;
    const position = {
      x: interpolate(tracked.x, next.x, fraction),
      y: interpolate(tracked.y, next.y, fraction),
    };
    sceneState.players.set(tracked.playerId, position);
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
    }
    if (currentEventId) eventButtons.get(currentEventId)?.removeAttribute("aria-current");
    if (event) {
      currentAction.textContent = `${label(event.type)} · ${eventSentence(event)}`;
      detailTitle.textContent = `${label(event.type)} at ${matchTime(event.timeMs)}`;
      detailDescription.textContent = `${teamName(event.teamId)} · ${event.outcome}`;
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
      currentAction.textContent = `${replay.match.teams[0].name} building the attack`;
      detailTitle.textContent = "Awaiting first action";
      detailDescription.textContent = `The sequence starts at ${matchTime(replay.match.startMs)}.`;
    }
    currentEventId = nextID;
  }
  eventPathLayer.style.display = event && clock - event.timeMs < 6500 ? "" : "none";
  sceneState.path = event && clock - event.timeMs < 6500 ? { from: event.from, to: event.to } : undefined;
}

function render(): void {
  renderPositions();
  renderEvent();
  renderInsight();
  clockDisplay.textContent = matchTime(clock);
  seek.value = String(Math.round(((clock - replay.match.startMs) / (replay.match.endMs - replay.match.startMs)) * 1000));
  const nextPlayLabel = playing ? "Pause" : evidenceCue && clock >= evidenceCue.replayEndMs ? "Replay evidence" : clock >= replay.match.endMs ? "Replay" : "Play";
  if (playLabel !== nextPlayLabel) {
    playLabel = nextPlayLabel;
    playButton.replaceChildren(createElement(playing ? Pause : Play));
    playButton.setAttribute("aria-label", playLabel);
    playButton.title = playLabel;
  }
  pitchRenderer?.update(sceneState);
  pitchRenderer?.draw();
}

function animate(time: number): void {
  if (playing) {
    if (previousFrameTime) {
      const end = evidenceCue?.replayEndMs ?? replay.match.endMs;
      clock = Math.min(end, clock + Math.min(time - previousFrameTime, 100) * (evidenceCue ? 1 : speed));
      if (clock >= end) playing = false;
      render();
    }
    previousFrameTime = time;
  } else {
    previousFrameTime = 0;
  }
  if (!playing) pitchRenderer?.draw();
  requestAnimationFrame(animate);
}

async function start(): Promise<void> {
  const response = await fetch("/api/replay", { cache: "no-store" });
  if (!response.ok) throw new Error(`Replay request failed: ${response.status}`);
  replay = await response.json() as Replay;
  if (replay.schemaVersion !== "2.0.0" || replay.tracking.length < 2) {
    throw new Error("Unsupported replay data");
  }
  for (const frame of replay.tracking) {
    framePlayers.set(frame.timeMs, new Map(frame.players.map((player) => [player.playerId, player])));
  }
  clock = replay.match.startMs;
  eventCount.textContent = `${replay.events.length} actions`;
  startLabel.textContent = matchTime(replay.match.startMs);
  endLabel.textContent = matchTime(replay.match.endMs);
  pitchStamp.textContent = `${replay.match.teams[0].name.toUpperCase()} ATTACKING ${replay.match.teams[0].attackingDirection.toUpperCase()}`;
  createPlayers();
  createTimeline();
  createIcons({ icons: { Play, RotateCcw, Maximize, Scan, ListVideo, Undo2 } });
  evidenceButton.addEventListener("click", () => {
    const cue = evidenceCue ?? [...cues].reverse().find((item) => clock >= item.startMs && clock <= item.endMs);
    if (!cue) return;
    if (!evidenceCue) returnClock = clock;
    clearEvidence(); evidenceCue = cue;
    for (const button of speedButtons) { button.disabled = true; button.setAttribute("aria-pressed", String(button.dataset.speed === "1")); }
    clock = cue.replayStartMs; playing = true; previousFrameTime = 0;
    evidenceReturn.hidden = false;
    for (const id of cue.eventIds) eventButtons.get(id)?.classList.add("evidence-event");
    render();
  });
  evidenceReturn.addEventListener("click", () => { clearEvidence(); clock = returnClock; playing = false; previousFrameTime = 0; render(); });
  for (const button of viewButtons) button.addEventListener("click", () => { void switchView(button.dataset.view ?? "svg"); });
  cameraReset.addEventListener("click", () => pitchRenderer?.resetCamera());
  fullscreen.addEventListener("click", () => {
    const shell = required<HTMLElement>(".pitch-shell");
    const operation = document.fullscreenElement ? document.exitFullscreen() : shell.requestFullscreen();
    void operation.catch(() => {
      rendererStatus.textContent = "Fullscreen is unavailable in this browser.";
      rendererStatus.hidden = false;
    });
  });

  playButton.addEventListener("click", () => {
    if (evidenceCue && clock >= evidenceCue.replayEndMs) clock = evidenceCue.replayStartMs;
    if (clock >= replay.match.endMs) clock = replay.match.startMs;
    playing = !playing;
    render();
  });
  restartButton.addEventListener("click", () => {
    clearEvidence();
    clock = replay.match.startMs;
    playing = true;
    render();
  });
  seek.addEventListener("input", () => {
    clearEvidence();
    clock = replay.match.startMs + (Number(seek.value) / 1000) * (replay.match.endMs - replay.match.startMs);
    render();
  });
  for (const button of speedButtons) {
    button.addEventListener("click", () => {
      speed = Number(button.dataset.speed);
      for (const option of speedButtons) option.setAttribute("aria-pressed", String(option === button));
    });
  }
  playing = true;
  render();
  const preferredView = new URLSearchParams(location.search).get("view") ?? "three";
  await switchView(["three", "pixi", "svg"].includes(preferredView) ? preferredView : "three");
  requestAnimationFrame(animate);
  void loadInsights();
}

start().catch((error: unknown) => {
  currentAction.textContent = "Replay unavailable";
  detailTitle.textContent = "Could not load the match";
  detailDescription.textContent = error instanceof Error ? error.message : String(error);
  playButton.disabled = true;
  restartButton.disabled = true;
  seek.disabled = true;
});
