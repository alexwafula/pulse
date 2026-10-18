# 0026: Hero index headline and server-rendered team kit

Date: 2026-10-18
Status: Implemented on review branch (D3a, `design/hero-d3a`); teammate review pending

## Decision

**Team kit on first paint.** The server maps each team id to a kit in one place,
`app/internal/transport/http/team_kit.go`. `vale` wears kit A, `bastion` kit B.
An unknown id takes the kit its opponent does not wear; two unknown ids follow
position. The experience root renders `data-home-kit`/`data-away-kit`, and each
team strip renders `data-team-kit`. CSS points `--team-home`/`--team-away` at
`--c-team-a`/`--c-team-b` from those attributes. The hex values stay in
`tokens.css`, so D2b can theme them. `team-colour.ts` reads `data-team-kit` and
keeps no copy of the mapping. Before this change, `experience.css` defaulted the
slots to kit A/B by position and `pitch.ts` corrected them only when its module
ran. In late-siege, Bastion City (listed first) painted red until hydration.
`/legacy` renders no kit attributes and keeps its positional palette.

**Hero (DIRECTION C1, "Quiet ledger").** On Live, a hero card replaces the "Live"
title and the team strip. The title stays in the DOM for assistive tech and tests.
The card holds the team names with swatches, the clock, "Score not recorded" and
one headline restating the API's `indexDelta` for `teams[0]` (the same tick as
`#metric-index-delta`):

- delta ≠ 0: "<team>'s control index is N higher". `<team>` is `teams[0]` when
  the delta is positive and `teams[1]` when it is negative. N is the magnitude at
  the API's four decimals.
- delta = 0: "Neither team's control index is higher".
- No tick yet: "Index difference". Unsupported tracking: "Tracking metrics unavailable".
  Neither shows a number, label or chip.

Below the headline: the exact signed value (`+`/`-`, four decimals), the label
"teams[0] − teams[1]" in the API's order, and the chip "model estimate, uncalibrated".
There is no score glyph, absolute share, two-colour bar or prediction wording. The
completed-pass share moved from the strip to a rail card as counts only; its
two-colour track is hidden.

`index-headline.ts` builds the line without touching the DOM and is unit tested.
On mobile the header becomes two 44px rows (brand + Scenarios; audience +
language), and the view switch and Control toggle follow the transport under the
pitch, so the pitch starts within 360px.

## Consequences

- The headline arrives with `/api/metrics`. Until then the hero shows "Index
  difference" without a number. The server does not render the first headline,
  so the line is not built in two languages.
- Three new catalog keys: `index.higher`, `index.level` and `Score not recorded`.
  sw-KE and hi-IN hold the English text, marked NEEDS TRANSLATION in
  `docs/I18N-BACKLOG.md`.
- Tests: `team_kit_test.go` (handler: kit attributes for late-siege/corner and the
  unknown-id fallback), `tests/integration/index-headline.test.mjs` (signs, zero,
  team order, label, chip) and `tests/integration/hero-browser.mjs`. The browser
  test covers colours before scripts, at DOMContentLoaded and after the first htmx
  swap in all three renderers; the headline against `/api/metrics`; layout; and a
  paused renderer switch drawing 0 frames.
