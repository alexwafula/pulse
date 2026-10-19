// The lower third (DIRECTION C2) is one caption bar at the bottom of the pitch. Its
// rows, the active moment (analytics.ts) and the latest shot result (pitch.ts), are
// shown and hidden by their owners through `hidden`; this keeps the bar in step so it
// enters and leaves as one overlay (DIRECTION §3.3, row 1). The motion itself is CSS:
// the bar rises and fades in when shown, and fades out while `data-state="leaving"`,
// during which the rows that were showing stay drawn (`data-leaving`).
export function mountLowerThird(bar: HTMLElement): void {
  const rows = Array.from(bar.querySelectorAll<HTMLElement>(".lower-third-row"));
  let exit: number | undefined;
  let lastVisible: HTMLElement[] = [];

  const finishLeaving = (): void => {
    exit = undefined;
    bar.hidden = true;
    delete bar.dataset.state;
    bar.removeAttribute("aria-hidden");
    for (const row of rows) delete row.dataset.leaving;
  };

  const sync = (): void => {
    const visible = rows.filter((row) => !row.hidden);
    if (visible.length) {
      if (exit !== undefined) { clearTimeout(exit); finishLeaving(); }
      bar.hidden = false;
      lastVisible = visible;
      return;
    }
    if (bar.hidden || exit !== undefined) return;
    // Keep the last rows drawn while the bar fades out, hidden from assistive tech.
    bar.dataset.state = "leaving";
    bar.setAttribute("aria-hidden", "true");
    for (const row of lastVisible) row.dataset.leaving = "true";
    exit = window.setTimeout(finishLeaving, transitionMs(bar));
  };

  const observer = new MutationObserver(sync);
  for (const row of rows) observer.observe(row, { attributes: true, attributeFilter: ["hidden"] });
  sync();
}

// The longest opacity transition CSS set for the leaving state, so timing stays in CSS.
function transitionMs(element: HTMLElement): number {
  const style = getComputedStyle(element);
  const seconds = (list: string) => list.split(",").map((item) => parseFloat(item) * (item.trim().endsWith("ms") ? 1 : 1000));
  const durations = seconds(style.transitionDuration), delays = seconds(style.transitionDelay);
  return Math.max(0, ...durations.map((duration, i) => duration + (delays[i % delays.length] || 0)));
}
