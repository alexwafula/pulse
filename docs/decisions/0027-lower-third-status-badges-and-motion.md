# 0027: Lower third, status badges, transport targets and motion

Date: 2026-10-19
Status: Implemented on review branch (D3b, `design/lower-third-d3b`); teammate review pending

## Decision

**Lower third (DIRECTION C2).** The moment banner and the shot result are now rows of
one caption bar, `#lower-third`, at the bottom of the pitch. The bar uses `--c-overlay`
with 15/13px text. Each row has a 3px rule in its own team's colour. The colour comes
from `teamKit()` in `team-colour.ts`, which reads the server-rendered `data-team-kit`
(`team_kit.go`), so no positional team token is involved. The rows keep their ids
(`#moment-banner`, `#action-result`) and their text. The estimate label is an inline
`.estimate-chip` with the exact text "model estimate, uncalibrated", still at the end
of `#moment-banner-detail`. At the corner end state, both rows share the one bar.
`lower-third.ts` keeps the bar in step with its rows; their owners still set `hidden`.
The pitch stamp is hidden while the bar shows because they share the bottom-left
corner. The hero states each team's attacking direction. `/legacy` keeps both overlays
in their original positions (`.lower-third { display: contents }`).

**Status badges (DIRECTION C3).** `status-badge.ts` sets `data-status`, the icon, the
accessible name and the tooltip together. Statuses differ by icon and shape as well as
colour:

| Status | Text (unchanged) | Shape | Icon | Colour pair | Ratio |
|---|---|---|---|---|---|
| `verified` | Verified / Verified (recorded) | tinted pill | check | `--c-verified` on `--c-verified-tint` | 5.55 |
| `template` | Template | 1px outlined pill | file-text | `--c-template` on `--c-canvas` | 5.24 |
| `unavailable` | Unavailable | plain | circle-alert | `--c-error` on `--c-canvas` | 6.02 |
| `waiting`, `none` | Waiting, No moment | plain | none | `--c-ink-muted` on `--c-canvas` | 6.02 |

`--c-error` on `--c-surface` measures 6.69. Each badge has `role="status"` and an
`aria-label` equal to its visible text, so every status has its own accessible name.
The tooltip "content-checked recording" appears only on "Verified (recorded)". It
describes what was checked, and names no model. A plain "Verified" (live publishing)
gets no tooltip, because it is not a recording. `#pressure-insight` and its badge carry
`data-status="template"`.

**Transport targets.** Play, restart and the three speed buttons are 44 × 44 at every
width in the experience. On main, the mobile speed buttons were 29 px wide and play and
restart were 36 px tall. The transport sits under the pitch, so the hero does not move.

**Motion (DIRECTION §3.3).** Rows 1, 2, 4 and 5 are implemented. Row 3 (evidence marker
and trail tint) moves to D4a.

| Row | Default | Reduced motion |
|---|---|---|
| 1 Lower third | rises 8px and fades in (`--dur-2`, `--ease-out`); fades out over 160ms (`--ease-exit`) | opacity only, 120ms |
| 2 Badge settles (Waiting → Verified/Template) | 200ms fade, then the check draws over 320ms | instant swap, no draw |
| 4 Scroll to pitch | smooth | `behavior: "auto"` (already at every call site in `pitch.ts`) |
| 5 Index sign flips | 200ms background tint on the headline only, no counting | none |

The token values in `tokens.css` are unchanged. Rows 2 and 5 use a class that is
removed when the animation ends, so showing the panel or Live again does not replay
them.

## Consequences

- None of the generated scenarios has an `indexDelta` that changes sign, so row 5 is
  tested with a routed, test-only metrics feed.
- `tests/integration/lower-third-browser.mjs` covers the overlay count, badges,
  targets, motion with and without reduced motion, and the hero at start, 88:11 and
  end of late-siege.
- New i18n key: `content-checked recording` (sw-KE and hi-IN NEEDS TRANSLATION,
  `docs/I18N-BACKLOG.md`).
