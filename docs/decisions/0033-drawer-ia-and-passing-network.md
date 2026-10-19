# 0033: Drawer tabs, Recap entry points and the passing-network layout

Date: 2026-10-19
Status: Implemented on review branch (D4b-2, `feat/d4b-ia`); draft PR, teammate review pending

## Context

The IA audit on `e9b5554` found duplicated routes on experience pages. Recap was reachable
from five places, two of which (the drawer Recap pane and the HTMX Recap panel) rendered
the same `page.Recap`. Clicking the drawer's Evidence tab moved the page to Insights
(`experience.ts`, `pulse:pane-selected`). The Insights `.analytics-links` row repeated the
`[data-analysis-pane]` chips. The drawer passing graph drew every roster player on a fixed
88×78 ellipse in a 280×220 viewBox, with 13px labels inside the circles. With 11 players,
labels overlapped each other and the circles.

The D4a evidence trail (ADR 0030) lives in the drawer Evidence pane, `#pane-evidence`. It
moves under the pitch only while a clip plays, so the Evidence tab and pane stay.

## Decision

**Tabs.** On experience pages (`/`, `/experience`) the drawer tabs are Timeline, Passing,
Control, Routes, Evidence. Arrow keys still wrap and Home/End still jump, and Control +
ArrowRight still selects Routes. A drawer tab never changes `body[data-section]` or
`?section=`: `pulse:pane-selected` changes the section only when its caller asks for
Live (a moment clip, the insight clip, source-event inspection).

**Evidence.** The insight card's Evidence button now ends like moment Play: Live,
Evidence tab, trail under the pitch. Trail content, evidence ids, narration and clip
bounds are unchanged.

**Recap.** Experience pages render no drawer Recap tab or pane (`{{if not .Experience}}`).
The sidebar, the Story "Recap" chip, `#sequence-recap` and demo completion all open the
sidebar Recap section. Its Download dispatches `pulse:download-recap` instead of clicking
the drawer's `#download-recap`. When there is no Recap pane, `pitch.ts` stops
auto-selecting a Recap tab at the replay end. `/legacy` keeps its Recap tab, pane, the
end-of-replay auto-select and the `setDrawerTab("recap")` fallback.

**Analytics links.** `.analytics-links` (Passing network / Metric evidence / Route
evidence) is removed. The `[data-analysis-pane]` chips and the Story Recap chip stay.

**Passing network (presentation only).** `passingViews` (`transport/http/passing.go`)
omits players with no completed pass sent or received. That is the same rule the
Insights pitch-map network uses (`pitchNetwork`, completed-pass involvements), so both
show the same players. The audit's corner difference came from this rule: at the end the
drawer drew 4 Aurora Vale nodes, including #9 Dax with 0 sent and 0 received, and
Insights drew 3. Both now draw 3 (#8 Imani, #10 Tayo, #11 Malik).
`metrics.PassingSeries`, `/api/*` and the Insights network are unchanged.

`layoutRing` places the nodes clockwise from the top on the smallest ring where every
check passes:
- Each label sits radially outside its circle. Side labels are anchored `start`/`end`
  and top/bottom labels are centred.
- No label box (estimated at 9 units per character, 18 high, 3 padding) overlaps another
  label or any circle box, including the 3.5-unit hover stroke.
- Circles keep a 32-unit gap so an edge and its arrowhead show.

The viewBox is the bounding box plus an 8-unit margin. The SVG is drawn at that size,
centred, and scaled down only to fit (`max-width: 100%; height: auto`). Experience
labels take `--c-ink`, because they now sit on the light canvas. A team with no nodes
shows one line, "No players with completed passes yet", instead of the graph, table
and link list.

## Consequences

- `tests/integration/drawer-ia-browser.mjs` checks:
  - Label boxes against each other, against every circle and against the SVG box, for
    all 5 scenarios × both teams × mid replay and end × 1440×900 and 390×844: 0 overlaps.
  - The node set equals both the replay's completed-pass players and the Insights
    network.
  - Tab order, wrapping, focus, and an unchanged section for every tab on Live and in
    Insights, on `/` and `/experience`.
  - The insight Evidence button: Live, Evidence tab, trail under the pitch, cue
    `eventIds`.
  - Each Recap entry point, and the Download content.
  - `/legacy` Recap.
  - `.analytics-links` is gone.
- `passing_test.go` checks the same node rule against `pitchNetwork` at every snapshot of
  three fixtures, and checks layouts of 1 to 11 nodes with 3- to 16-character names.
- No scenario has more than 9 Aurora Vale passers. Bastion City completes no pass in any
  of the five scenarios, so in the browser it always shows the empty line. Layouts of 10
  and 11 nodes are covered only by the Go estimate.
- The 9-node late-siege graph is 417×314 natural. In the 350–358px drawer it renders at
  about 0.85 scale, which puts its 13px labels near 11px.
- i18n: added `No players with completed passes yet` (sw-KE/hi-IN NEEDS TRANSLATION).
  Removed `Metric evidence` and `Route evidence`. Reconcile the empty line with D4b-1's
  empty states when that merges.
