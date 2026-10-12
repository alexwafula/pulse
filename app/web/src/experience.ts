import { createIcons, Activity, Radio, BookOpen, ChartNoAxesCombined, FileText, LayoutDashboard, ListVideo, Download, RotateCcw } from "lucide";

type Section = "live" | "story" | "insights" | "recap";
type ClockEvent = { timeMs: number; playing: boolean; scenario: string };
const navigation = Array.from(document.querySelectorAll<HTMLButtonElement>(".experience-navigation button"));
const panel = document.querySelector<HTMLElement>("#experience-panel")!;
const content = document.querySelector<HTMLElement>("#experience-content")!;
const form = document.querySelector<HTMLFormElement>("#experience-inputs")!;
const atInput = form.elements.namedItem("atMs") as HTMLInputElement;
const panelInput = form.elements.namedItem("panel") as HTMLInputElement;
const status = document.querySelector<HTMLElement>("#panel-status")!;
const retry = document.querySelector<HTMLButtonElement>("#panel-retry")!;
let pendingRefresh: ReturnType<typeof setTimeout> | undefined;
let lastRefresh = 0;

const icons = (): void => createIcons({ icons: { Activity, Radio, BookOpen, ChartNoAxesCombined, FileText, LayoutDashboard, ListVideo, Download, RotateCcw } });
icons();

function refresh(): void {
  clearTimeout(pendingRefresh);
  pendingRefresh = undefined;
  if (panel.hidden) return;
  lastRefresh = performance.now();
  document.body.dispatchEvent(new CustomEvent("pulse:refresh"));
}

function selectSection(next: Section, changePane = true): void {
  document.body.dataset.section = next;
  panel.hidden = next !== "story" && next !== "recap";
  document.querySelector<HTMLElement>(".drawer-main")!.hidden = !panel.hidden;
  for (const button of navigation) {
    if (button.dataset.section === next) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  }
  if (!panel.hidden) {
    panelInput.value = next;
    refresh();
  } else if (changePane) {
    document.dispatchEvent(new CustomEvent("pulse:select-pane", { detail: { pane: next === "insights" ? "control" : "timeline" } }));
  }
}

for (const button of navigation) button.addEventListener("click", () => selectSection(button.dataset.section as Section));
document.addEventListener("pulse:clock", (event) => {
  const clock = (event as CustomEvent<ClockEvent>).detail;
  atInput.value = String(clock.timeMs);
  if (panel.hidden) return;
  if (!clock.playing) refresh();
  else if (pendingRefresh === undefined) pendingRefresh = setTimeout(() => { pendingRefresh = undefined; refresh(); }, Math.max(0, 1000 - (performance.now() - lastRefresh)));
});
document.addEventListener("pulse:pane-selected", (event) => {
  const pane = (event as CustomEvent<{ pane: string }>).detail.pane;
  if (pane === "evidence") selectSection("insights", false);
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
  if ((event.target as Element).id === content.id) icons();
});
