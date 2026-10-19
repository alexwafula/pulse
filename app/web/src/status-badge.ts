// Insight status badges (DIRECTION C3). Each status differs by icon and shape as well
// as colour: Verified is a tinted pill with a check, Template an outlined pill with a
// document, Unavailable an error icon with text, and Waiting / No moment plain text.
// The visible text is the caller's (tests and translations read it unchanged); the
// icon is decorative, so the badge's accessible name is that same text.
export type BadgeStatus = "verified" | "template" | "waiting" | "none" | "unavailable";

// Lucide 1.x paths (check, file-text, circle-alert), inlined so the check can be drawn.
const ICONS: Partial<Record<BadgeStatus, { name: string; paths: string[]; circle?: boolean }>> = {
  verified: { name: "check", paths: ["M20 6 9 17l-5-5"] },
  template: { name: "file-text", paths: ["M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", "M14 2v4a2 2 0 0 0 2 2h4", "M10 13H8", "M16 17H8"] },
  unavailable: { name: "circle-alert", paths: ["M12 8v4", "M12 16h.01"], circle: true },
};
// Describes what was checked, never who checked it: a recording, not a model.
const RECORDED_TOOLTIP = "content-checked recording";
const SVG = "http://www.w3.org/2000/svg";
// The English text each badge last showed; its DOM text may since have been translated.
const shown = new WeakMap<HTMLElement, string>();
// Each badge's latest settle, so an older one finishing does not end a newer one.
const settles = new WeakMap<HTMLElement, number>();

function icon(status: BadgeStatus): SVGSVGElement | undefined {
  const spec = ICONS[status];
  if (!spec) return undefined;
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("class", "status-icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.dataset.icon = spec.name;
  if (spec.circle) {
    const circle = document.createElementNS(SVG, "circle");
    for (const [name, value] of [["cx", "12"], ["cy", "12"], ["r", "10"]]) circle.setAttribute(name, value);
    svg.append(circle);
  }
  for (const d of spec.paths) {
    const path = document.createElementNS(SVG, "path");
    path.setAttribute("d", d);
    // A unit path length lets CSS draw the check with stroke-dashoffset 1 -> 0.
    if (status === "verified") path.setAttribute("pathLength", "1");
    svg.append(path);
  }
  return svg;
}

/** Shows `text` (English; the page localizer translates it) with the status's icon and shape. */
export function setBadge(badge: HTMLElement, status: BadgeStatus, text: string, recorded = false): void {
  if (badge.dataset.status === status && shown.get(badge) === text) return;
  const settling = badge.dataset.status === "waiting" && (status === "verified" || status === "template");
  badge.dataset.status = status;
  shown.set(badge, text);
  badge.setAttribute("aria-label", text);
  if (recorded) badge.setAttribute("title", RECORDED_TOOLTIP);
  else badge.removeAttribute("title");
  const svg = icon(status);
  badge.replaceChildren(...(svg ? [svg] : []), document.createTextNode(text));
  badge.classList.remove("is-settling");
  if (settling) settle(badge);
}

// Waiting -> Verified or Template (DIRECTION §3.3, row 2): a 200 ms fade, then the check
// draws (CSS). The class goes once those finish, so showing the panel again does not
// replay them; under reduced motion CSS sets no animation and it goes at once.
function settle(badge: HTMLElement): void {
  const run = (settles.get(badge) ?? 0) + 1;
  settles.set(badge, run);
  badge.classList.add("is-settling");
  void Promise.allSettled(badge.getAnimations({ subtree: true }).map((animation) => animation.finished)).then(() => {
    if (settles.get(badge) === run) badge.classList.remove("is-settling");
  });
}
