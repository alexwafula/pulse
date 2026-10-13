import { createIcons, Activity, Radio, BookOpen, ChartNoAxesCombined, FileText, LayoutDashboard, ListVideo, Download, RotateCcw, Map, Crosshair, Network, Route, PictureInPicture2, Maximize2, X } from "lucide";
import { paintExperienceGraphics } from "./experience-graphics";

type Section = "live" | "story" | "insights" | "recap";
type ClockEvent = { timeMs: number; playing: boolean; scenario: string };
const navigation = Array.from(document.querySelectorAll<HTMLButtonElement>(".experience-navigation button"));
const panel = document.querySelector<HTMLElement>("#experience-panel")!;
const content = document.querySelector<HTMLElement>("#experience-content")!;
const form = document.querySelector<HTMLFormElement>("#experience-inputs")!;
const atInput = form.elements.namedItem("atMs") as HTMLInputElement;
const panelInput = form.elements.namedItem("panel") as HTMLInputElement;
const modeInput = form.elements.namedItem("mode") as HTMLInputElement;
const mapInput = form.elements.namedItem("map") as HTMLInputElement;
const personaInput = form.elements.namedItem("persona") as HTMLInputElement;
const status = document.querySelector<HTMLElement>("#panel-status")!;
const retry = document.querySelector<HTMLButtonElement>("#panel-retry")!;
let pendingRefresh: ReturnType<typeof setTimeout> | undefined;
let lastRefresh = 0;
let insightView = "charts";
let watchVisible = false;
const pitch = document.querySelector<HTMLElement>(".pitch-column")!;
const pitchParent = pitch.parentElement!;
const rail = document.querySelector<HTMLElement>(".right-drawer")!;
const transport = pitch.querySelector<HTMLElement>(".transport")!;
const clipControls = pitch.querySelector<HTMLElement>(".clip-controls")!;
const nowPlaying = pitch.querySelector<HTMLElement>(".now-playing")!;
const transportBar = document.querySelector<HTMLElement>("#experience-transport")!;
const watchDock = document.querySelector<HTMLElement>("#experience-watch-dock")!;
const watchButton = document.querySelector<HTMLButtonElement>("#watch-toggle")!;
let disposeGraphics: (() => void) | undefined;

const icons = (): void => createIcons({ icons: { Activity, Radio, BookOpen, ChartNoAxesCombined, FileText, LayoutDashboard, ListVideo, Download, RotateCcw, Map, Crosshair, Network, Route, PictureInPicture2, Maximize2, X } });
icons();

function graphics(): void {
  disposeGraphics?.();
  disposeGraphics = paintExperienceGraphics(content);
}

function updateInsightView(): void {
  document.body.dataset.insightView = document.body.dataset.section === "insights" ? insightView : "";
  for (const button of document.querySelectorAll<HTMLButtonElement>("#map-controls [data-insight-view], #map-controls [data-analysis-pane]")) {
    button.setAttribute("aria-pressed", String((button.dataset.insightView ?? button.dataset.analysisPane) === insightView));
  }
}

function setWatch(visible: boolean): void {
  watchVisible = visible;
  watchDock.hidden = document.body.dataset.section === "live" || !visible;
  watchButton.setAttribute("aria-pressed", String(visible));
  watchButton.title = visible ? "Hide match player" : "Show match player";
  watchButton.setAttribute("aria-label", watchButton.title);
}

function layout(next: Section): void {
  const live = next === "live";
  if (live) {
    pitchParent.insertBefore(pitch, rail);
    pitch.insertBefore(transport, nowPlaying);
    pitch.insertBefore(clipControls, nowPlaying);
  } else {
    watchDock.append(pitch);
    transportBar.append(transport, clipControls);
  }
  transportBar.hidden = live;
  watchButton.hidden = live;
  watchDock.hidden = live || !watchVisible;
  document.querySelector<HTMLElement>("#workspace-title")!.textContent = ({ live: "Live", story: "Story", insights: "Insights", recap: "Recap" })[next];
}

function refresh(): void {
  clearTimeout(pendingRefresh);
  pendingRefresh = undefined;
  if (panel.hidden || content.hidden) return;
  personaInput.value = document.querySelector<HTMLButtonElement>('[data-persona][aria-pressed="true"]')?.dataset.persona ?? "CASUAL";
  lastRefresh = performance.now();
  document.body.dispatchEvent(new CustomEvent("pulse:refresh"));
}

function selectSection(next: Section, changePane = true): void {
  document.body.dataset.section = next;
  if (next === "insights" && changePane) insightView = "charts";
  const details = next === "insights" && insightView !== "charts" && insightView !== "maps";
  panel.hidden = next === "live";
  content.hidden = details;
  document.querySelector<HTMLElement>(".drawer-main")!.hidden = next !== "live" && !details;
  document.querySelector<HTMLElement>("#story-controls")!.hidden = next !== "story";
  document.querySelector<HTMLElement>("#map-controls")!.hidden = next !== "insights";
  updateInsightView();
  layout(next);
  for (const button of navigation) {
    if (button.dataset.section === next) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  }
  if (!panel.hidden) {
    panelInput.value = next === "insights" ? "analytics" : next;
    refresh();
  } else if (changePane) {
    document.dispatchEvent(new CustomEvent("pulse:select-pane", { detail: { pane: next === "insights" ? "control" : "timeline" } }));
  }
  const url = new URL(location.href);
  if (next === "live") url.searchParams.delete("section");
  else url.searchParams.set("section", next);
  history.replaceState(null, "", url);
}

function openAnalysis(pane: string, dispatch = true): void {
  insightView = pane;
  selectSection("insights", false);
  if (dispatch) document.dispatchEvent(new CustomEvent("pulse:select-pane", { detail: { pane } }));
}

for (const button of navigation) button.addEventListener("click", () => selectSection(button.dataset.section as Section));
for (const button of document.querySelectorAll<HTMLButtonElement>(".story-modes [data-story-mode]")) button.addEventListener("click", () => {
  modeInput.value = button.dataset.storyMode!;
  for (const item of document.querySelectorAll<HTMLButtonElement>(".story-modes [data-story-mode]")) item.setAttribute("aria-pressed", String(item === button));
  document.querySelector<HTMLElement>("#story-player-label")!.hidden = modeInput.value !== "player";
  refresh();
});
for (const button of document.querySelectorAll<HTMLButtonElement>(".story-modes [data-map-mode]")) button.addEventListener("click", () => {
  mapInput.value = button.dataset.mapMode!;
  for (const item of document.querySelectorAll<HTMLButtonElement>(".story-modes [data-map-mode]")) item.setAttribute("aria-pressed", String(item === button));
  refresh();
});
form.addEventListener("change", refresh);
form.addEventListener("click", (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>("button");
  if (button?.dataset.insightView) {
    insightView = button.dataset.insightView;
    selectSection("insights", false);
  } else if (button?.dataset.analysisPane) openAnalysis(button.dataset.analysisPane);
  else if (button?.hasAttribute("data-open-recap")) selectSection("recap");
});
watchButton.addEventListener("click", () => setWatch(!watchVisible));
document.querySelector<HTMLButtonElement>("#watch-close")!.addEventListener("click", () => setWatch(false));
document.querySelector<HTMLButtonElement>("#watch-expand")!.addEventListener("click", () => selectSection("live"));
document.querySelector<HTMLButtonElement>("[data-open-charts]")!.addEventListener("click", () => selectSection("insights"));
document.addEventListener("pulse:clock", (event) => {
  const clock = (event as CustomEvent<ClockEvent>).detail;
  atInput.value = String(clock.timeMs);
  document.querySelector<HTMLElement>("#experience-clock")!.textContent = `${String(Math.floor(clock.timeMs / 60000)).padStart(2, "0")}:${String(Math.floor(clock.timeMs / 1000) % 60).padStart(2, "0")}`;
  if (panel.hidden) return;
  if (!clock.playing) refresh();
  else if (pendingRefresh === undefined) pendingRefresh = setTimeout(() => { pendingRefresh = undefined; refresh(); }, Math.max(0, 1000 - (performance.now() - lastRefresh)));
});
document.addEventListener("pulse:pane-selected", (event) => {
  const pane = (event as CustomEvent<{ pane: string }>).detail.pane;
  if (pane === "evidence") openAnalysis(pane, false);
  else if (document.body.dataset.section === "insights" && content.hidden) {
    insightView = pane;
    updateInsightView();
  }
});
document.querySelector<HTMLSelectElement>("#camera-mode")!.addEventListener("change", (event) => {
  document.dispatchEvent(new CustomEvent("pulse:camera", { detail: { mode: (event.target as HTMLSelectElement).value } }));
});

// Delegation also covers buttons arriving in HTMX fragments.
content.addEventListener("click", (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>("button");
  if (button?.dataset.inspectEvent) {
    selectSection("live");
    document.dispatchEvent(new CustomEvent("pulse:inspect", { detail: { eventId: button.dataset.inspectEvent } }));
  } else if (button?.hasAttribute("data-download-recap")) {
    document.querySelector<HTMLButtonElement>("#download-recap")!.click();
  } else if (button?.dataset.analysisPane) {
    openAnalysis(button.dataset.analysisPane);
  }
});
retry.addEventListener("click", refresh);
document.addEventListener("htmx:beforeRequest", (event) => {
  if ((event.target as Element).id !== content.id) return;
  status.textContent = "Updating"; content.setAttribute("aria-busy", "true"); retry.hidden = true;
});
document.addEventListener("htmx:afterRequest", (event) => {
  const detail = (event as CustomEvent<{ elt: HTMLElement; successful: boolean }>).detail;
  if (detail.elt !== content) return;
  content.setAttribute("aria-busy", "false");
  status.textContent = detail.successful ? "" : "Update unavailable. Last loaded view retained.";
  retry.hidden = detail.successful;
});
document.addEventListener("htmx:afterSwap", (event) => {
  if ((event.target as Element).id === content.id) { icons(); graphics(); }
});
document.addEventListener("pulse:map-inspect", (event) => {
  selectSection("live");
  document.dispatchEvent(new CustomEvent("pulse:inspect", { detail: (event as CustomEvent<{ eventId: string }>).detail }));
});
graphics();
const initialSection = new URL(location.href).searchParams.get("section");
if (initialSection === "story" || initialSection === "insights" || initialSection === "recap") selectSection(initialSection);
