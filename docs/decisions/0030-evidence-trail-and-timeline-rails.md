# 0030: Evidence trail and event timeline as rails

Date: 2026-10-19
Status: Implemented on review branch (D4a, `design/evidence-trail-d4a`); teammate review pending

## Decision

**Evidence trail (DIRECTION C4).** In the experience, `#evidence-list` is a timeline
rail. Each source event is one row: an ID chip, its clock time with tabular figures,
and the event sentence in `--c-ink-muted` (6.69:1 on the surface). Source events keep
their API order (`reasons`, or the cue's `eventIds`), so late-siege's pressure trail
starts evt-03, evt-04, evt-05.

Metric ticks collapse into one row, a native `<details>`/`<summary>`. The summary reads
`<n> metric ticks <first>–<last>` with the estimate chip "model estimate, uncalibrated".
`n` is `tickTimesMs.length` and the range is its first and last entry, in the same
`mm:ss` clock as elsewhere, joined by an en dash. One tick reads `1 metric tick <clock>`.
`<details>` gives Enter/Space toggling and the open state for free. Every
`[data-source-tick]` button stays in the DOM inside the disclosure, so tests that count
or read the ticks are unchanged. CONTROL_SWING trails are ticks only: its context
events are never shown as evidence.

**Trail under the pitch during a clip.** When an evidence clip starts, `pitch.ts`
moves `#evidence-trail` into `#clip-trail-slot` at the foot of `.pitch-column`. That covers
a moment's clip (`playMoment`, from the Control tab or the pressure panel's Evidence
button) and the insight's clip (`#evidence-button`, next to the Fact check, the
judge-path trigger of §3.3 row 3). Both keep Live and the pitch in view. The slot
comes after the transport, the Return button, "On the pitch" and the playback status (ADR 0029). A moment clip still opens
the Evidence tab, which says "Evidence trail shown under the pitch". The insight clip
still opens the Timeline tab with its events highlighted, as before. `clearEvidence()` moves the trail
back. Moving the node, rather than rendering a copy, keeps one set of ids and the same
listeners. The same pattern already moves the transport between Live and the watch
dock. In the experience trail, the source-event list now comes before the model values, and ADR 0029's
playback status stays between the pitch block and the trail. When a clip starts,
`revealEvidenceTrail()` scrolls just enough that the first trail row is fully in view,
but never so far that less than 80% of the pitch stays visible (`behavior: "auto"`
under reduced motion). At 1440×900 that is 76px: the pitch is at 14–481px and the first
row at 838–892px. At 390×844 no extra scroll is needed (row at 652–706px). The values label still sits
directly before `#moment-values`. This reorder is not named in C4 or C6. It is
a decision for review.

**Event timeline (DIRECTION C6).** Each timeline row has a fixed 44px tabular time
column, a 10px team dot on a vertical rail, then the copy. The description is 13px in
`--c-ink-muted`. The dot's `data-team-kit` comes from `teamKit()`, which reads the
server-rendered kit (`team_kit.go`, ADR 0026), so the colour follows the team id, never
its position in `match.teams`. Dots measure 5.0–5.7:1 against their row, including the
selected row's accent tint, which is unchanged.

**Motion row 3 (DIRECTION §3.3).** When a clip starts, `#evidence-range-marker` grows
from the clip start to its width over `--dur-3` (320ms) with `--ease-in-out`. A cue that
is merely active shows its range without growing. The class is removed when the
animation ends, so a re-render does not replay it. The row the clock last passed gets
`data-active` and an accent tint with a 120ms (`--dur-1`) `background-color` transition.
A tick also tints its collapsed row.

Under reduced motion, the marker has no animation and no transition, so it is full width
on its first frame. `tokens.css` clamps every transition to 0.01ms and leaves the
property at `all`. As in ADR 0027, the scoped rules restate the 120ms colour fade on the
trail rows and drop the marker's transitions. Token values are unchanged.

`/legacy` is unchanged. It has no slot, keeps one card per evidence entry and has no
team dots.

## Consequences

- `tests/integration/evidence-trail-browser.mjs` covers order, the single disclosure,
  the API-derived label (including a routed single-tick feed), keyboard toggling, pitch
  visibility during the moment and insight clips at both viewports, contrast, dot kit colours in late-siege
  and corner, and motion with and without reduced motion.
- New i18n keys: `evidence.ticks`, `evidence.tickOne` and `Evidence trail shown under the
  pitch` (sw-KE and hi-IN NEEDS TRANSLATION, `docs/I18N-BACKLOG.md`).
- While the clip plays, the Evidence tab shows only that note. On a section other than
  Live, the slot is hidden with the watch dock's other Live-only parts.
