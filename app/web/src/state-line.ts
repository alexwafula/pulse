import { t } from "./i18n";

// C7 states drawn by scripts. The markup is the server's "state" partial: match.html
// holds one copy per kind in <template id="state-templates">, so the icon, shape and
// structure match the server-rendered lines exactly (ADR 0032); states-browser.mjs
// compares these lines with app/testdata/states/state-lines.json. Arguments are written
// in the caller's order, as the Go partial writes them.
export type StateKind = "loading" | "error" | "no-tracking" | "empty";
const rendered = new WeakMap<HTMLElement, string>();

/** Replaces host's content with one state line; `key` is a catalog key, `detail` raw untranslated data. */
export function renderState(host: HTMLElement, kind: StateKind, key: string, values: Record<string, string | number> = {}, detail = ""): void {
  const signature = JSON.stringify([kind, key, values, detail]);
  if (rendered.get(host) === signature && host.firstElementChild) return;
  const source = document.querySelector<HTMLTemplateElement>("#state-templates")?.content.querySelector<HTMLElement>(`[data-state="${kind}"]`);
  if (!source) return;
  const line = source.cloneNode(true) as HTMLElement;
  const text = line.querySelector<HTMLElement>(".state-text")!;
  text.setAttribute("data-i18n", key);
  for (const [name, value] of Object.entries(values)) text.setAttribute(`data-i18n-arg-${name}`, String(value));
  text.textContent = t(key, values);
  const details = line.querySelector<HTMLElement>(".state-detail");
  if (details && detail) details.querySelector("code")!.textContent = detail;
  else details?.remove();
  host.replaceChildren(line);
  rendered.set(host, signature);
}

/** Empties a state host, for when real content replaces the state. */
export function clearState(host: HTMLElement): void {
  host.replaceChildren();
  rendered.delete(host);
}

// The API's reason is prose from the Go tracking check; a frame gap is the case the
// fixtures hit, so it is named in words and the raw reason stays in <details>.
const GAP = /^frame gap of (\d+) ms at (\d+);/;

/** The visible line for unsupported tracking: the gap and when it starts, or a general reason. */
export function trackingState(reason: string, matchTime: (ms: number) => string): { key: string; values: Record<string, string> } {
  const gap = GAP.exec(reason);
  if (!gap) return { key: "state.trackingUnsupported", values: {} };
  return { key: "state.trackingGap", values: { seconds: (Number(gap[1]) / 1000).toFixed(1), clock: matchTime(Number(gap[2])) } };
}
