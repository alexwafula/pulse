import { createIcons, Activity, Radio, BookOpen, ChartNoAxesCombined, FileText, LayoutDashboard, ListVideo, Download, RotateCcw, Map, Crosshair, Network, Route, PictureInPicture2, Maximize2, X, Clapperboard, Play, ArrowLeftRight } from "lucide";
import { paintExperienceGraphics } from "./experience-graphics";
import { t } from "./i18n";
const dropdownOpen = (): boolean => document.querySelector(".select2-container--open .select2-dropdown") !== null;

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
const localeInput = form.elements.namedItem("locale") as HTMLInputElement;
const status = document.querySelector<HTMLElement>("#panel-status")!;
const retry = document.querySelector<HTMLButtonElement>("#panel-retry")!;
let pendingRefresh: ReturnType<typeof setTimeout> | undefined;
let lastRefresh = 0;
let refreshQueued = false;
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

const icons = (): void => createIcons({ icons: { Activity, Radio, BookOpen, ChartNoAxesCombined, FileText, LayoutDashboard, ListVideo, Download, RotateCcw, Map, Crosshair, Network, Route, PictureInPicture2, Maximize2, X, Clapperboard, Play, ArrowLeftRight } });
icons();

const library = document.querySelector<HTMLElement>("#scenario-library")!;
const libraryDialog = document.querySelector<HTMLDialogElement>("#scenario-dialog")!;
const librarySearch = document.querySelector<HTMLInputElement>("#scenario-search")!;
const libraryRetry = document.querySelector<HTMLButtonElement>("#scenario-library-retry")!;
let scenarioFilter = "all";
function filterScenarios(): void {
  let count = 0;
  const term = librarySearch.value.trim().toLocaleLowerCase();
  for (const tile of library.querySelectorAll<HTMLElement>("[data-scenario-id]")) {
    tile.hidden = (scenarioFilter !== "all" && tile.dataset.scenarioKind !== scenarioFilter) || !tile.textContent?.toLocaleLowerCase().includes(term);
    tile.setAttribute("aria-current", String(tile.dataset.scenarioId === document.querySelector<HTMLSelectElement>("#scenario")!.value));
    if (!tile.hidden) count++;
  }
  document.querySelector<HTMLElement>("#scenario-library-empty")!.hidden = count > 0 || !library.querySelector(".scenario-tile");
}
document.querySelector("#scenario-library-open")!.addEventListener("click", () => {
  document.dispatchEvent(new CustomEvent("pulse:library-open"));
  libraryDialog.showModal(); librarySearch.focus();
  if (!library.querySelector(".scenario-tile")) library.dispatchEvent(new CustomEvent("pulse:library"));
  else filterScenarios();
});
document.querySelector("#scenario-library-close")!.addEventListener("click", () => libraryDialog.close());
libraryDialog.addEventListener("click", event => { if (event.target === libraryDialog) {
  const r=libraryDialog.getBoundingClientRect();
  if (event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom) libraryDialog.close();
}});
librarySearch.addEventListener("input", filterScenarios);
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-scenario-filter]")) button.addEventListener("click", () => {
  scenarioFilter = button.dataset.scenarioFilter!;
  for (const item of document.querySelectorAll("[data-scenario-filter]")) item.setAttribute("aria-pressed", String(item === button));
  filterScenarios();
});
libraryRetry.addEventListener("click", () => library.dispatchEvent(new CustomEvent("pulse:library")));
library.addEventListener("click", event => {
  const link = (event.target as Element).closest<HTMLAnchorElement>("[data-scenario-link]");
  if (!link) return;
  const url = new URL(link.href);
  for (const key of ["locale", "persona", "view"]) {
    const value = new URL(location.href).searchParams.get(key);
    if (value) url.searchParams.set(key, value);
  }
  link.href = url.href;
});
document.addEventListener("pulse:demo-complete", () => selectSection("recap"));
document.addEventListener("pulse:open-recap", () => selectSection("recap"));

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
  document.querySelector<HTMLElement>("#workspace-title")!.textContent = t(({ live: "Live", story: "Story", insights: "Insights", recap: "Recap" })[next]);
}

function refresh(): void {
  clearTimeout(pendingRefresh);
  pendingRefresh = undefined;
  if (panel.hidden || content.hidden || dropdownOpen() || refreshQueued) return;
  refreshQueued = true;
  queueMicrotask(() => {
    refreshQueued = false;
    if (panel.hidden || content.hidden || dropdownOpen()) return;
    personaInput.value = document.body.dataset.persona ?? "CASUAL";
    localeInput.value = document.body.dataset.locale ?? "en-GB";
    lastRefresh = performance.now();
    document.body.dispatchEvent(new CustomEvent("pulse:refresh"));
  });
}

function selectSection(next: Section, changePane = true): void {
  document.body.dataset.section = next;
  if (next === "insights" && changePane) insightView = "charts";
  const details = next === "insights" && !["charts", "maps", "comparison"].includes(insightView);
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
    panelInput.value = next === "insights" ? insightView === "comparison" ? "comparison" : "analytics" : next;
    refresh();
  } else if (changePane) {
    document.dispatchEvent(new CustomEvent("pulse:select-pane", { detail: { pane: next === "insights" ? "control" : "timeline" } }));
  }
  const url = new URL(location.href);
  if (next === "live") url.searchParams.delete("section");
  else url.searchParams.set("section", next);
  history.replaceState(null, "", url);
}

function openAnalysis(pane: string): void {
  insightView = pane;
  selectSection("insights", false);
  document.dispatchEvent(new CustomEvent("pulse:select-pane", { detail: { pane } }));
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
document.addEventListener("pulse:audience", () => {
  layout(document.body.dataset.section as Section);
  refresh();
});
document.addEventListener("pulse:dropdown", (event) => {
  if (!(event as CustomEvent<{open:boolean}>).detail.open) refresh();
});
document.addEventListener("htmx:beforeSwap", event => {
  const detail = (event as CustomEvent<{target:HTMLElement; shouldSwap:boolean}>).detail;
  if (detail.target === content && dropdownOpen()) detail.shouldSwap = false;
});
// Only callers that ask for Live (clips, inspection) change the section; a drawer tab never does.
document.addEventListener("pulse:pane-selected", (event) => {
  const { pane, section } = (event as CustomEvent<{ pane: string; section?: "live" }>).detail;
  if (section === "live") {
    selectSection("live", false);
    pitch.scrollIntoView({block: "nearest"});
  } else if (document.body.dataset.section === "insights" && content.hidden) {
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
  if (button?.dataset.compareStart) {
    selectSection("live", false);
    document.dispatchEvent(new CustomEvent("pulse:replay-window", {detail:{startMs:Number(button.dataset.compareStart), endMs:Number(button.dataset.compareEnd)}}));
  } else if (button?.dataset.inspectEvent) {
    selectSection("live");
    document.dispatchEvent(new CustomEvent("pulse:inspect", { detail: { eventId: button.dataset.inspectEvent } }));
  } else if (button?.hasAttribute("data-download-recap")) {
    document.dispatchEvent(new CustomEvent("pulse:download-recap"));
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
  if (detail.elt === library) {
    libraryRetry.hidden = detail.successful;
    if (!detail.successful) {
      const message = library.querySelector(".library-message");
      if (message) message.textContent = t("Replays unavailable");
    }
    return;
  }
  if (detail.elt !== content) return;
  content.setAttribute("aria-busy", "false");
  status.textContent = detail.successful ? "" : "Update unavailable. Last loaded view retained.";
  retry.hidden = detail.successful;
});
document.addEventListener("htmx:afterSwap", (event) => {
  if ((event.target as Element).id === content.id) { icons(); graphics(); }
  if ((event.target as Element).id === library.id) { icons(); filterScenarios(); }
});
document.addEventListener("pulse:map-inspect", (event) => {
  selectSection("live");
  document.dispatchEvent(new CustomEvent("pulse:inspect", { detail: (event as CustomEvent<{ eventId: string }>).detail }));
});

document.addEventListener("pulse:compare-moment", event => {
  const detail = (event as CustomEvent<{timeMs: number; teamId: string}>).detail;
  const team = form.elements.namedItem("teamId") as HTMLSelectElement;
  team.value = detail.teamId;
  team.dispatchEvent(new CustomEvent("pulse:selection", {bubbles:true}));
  document.dispatchEvent(new CustomEvent("pulse:inspect", {detail:{timeMs:detail.timeMs}}));
  insightView = "comparison";
  selectSection("insights", false);
});
graphics();
const initialSection = new URL(location.href).searchParams.get("section");
if (initialSection === "story" || initialSection === "insights" || initialSection === "recap") selectSection(initialSection);
