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
title (kept for assistive tech and tests) and the team strip. It holds:

- the scenario name, so the viewer knows which replay is showing;
- the team names with swatches and attacking direction;
- the clock and "Score unavailable" (see below);
- one headline restating `/api/metrics`' `indexDelta` for `teams[0]`, at the same
  tick as `#metric-index-delta`.

The headline reads:

- Delta that rounds to a non-zero 2-dp value: "<team>'s control index is N higher".
  N is the magnitude at 2 dp, halves rounded away from zero in the API's 4-dp units.
  `<team>` is `teams[0]` for a positive delta and `teams[1]` for a negative one.
- Delta that rounds to 0.00 (for example 0 or ±0.00004): "Neither team's control
  index is higher".
- No tick yet, or the metrics request failed: "Index difference". Unsupported
  tracking (corner): "Tracking metrics unavailable". Neither shows a number,
  label or chip.

Below the headline: the exact API value with `+` or U+2212 (shortest form, at least
4 dp, for example `−0.5537`), the label "teams[0] − teams[1]" in API order, and the
chip "model estimate, uncalibrated". The sign and label agree: `+` means the label's
first team is higher, `−` its second. There is no score glyph, absolute share,
two-colour bar or prediction wording. Completed passes moved to a rail card as
counts; the two-colour track is hidden.

**Server-rendered first paint.** The page handler reads the start tick from
`metricsAPI.startTick()`. That is the same cached, 4-dp-rounded result
`/api/metrics` encodes, so the value is not calculated twice.
`index_headline.go` formats the line in the request's locale (`?locale=`), and
`index-headline.ts` formats later ticks with `Intl.NumberFormat`. For en-GB,
sw-KE and hi-IN, Intl writes Latin digits and "." and a U+002D minus, which the
code replaces with U+2212. Go therefore needs no per-locale digit table. Both
languages are tested against one golden,
`app/testdata/hero/index-headline.json`. The script leaves the server's hero
untouched until `/api/metrics` settles, then takes over; if the request fails it
falls back to the placeholder.

**"Score unavailable".** The text sits in the hero's clock column. A replay has no
recorded result, so the card says so instead of leaving a gap that reads like a
missing 0:0. It reuses the term already defined in `docs/LOCALE-REVIEW.md`
("Score unavailable: no recorded result; must not become 0:0 or a goal"). It also
matches the element's existing `aria-label`, which `experience-browser.mjs` and
`summary_test.go` assert. It follows the catalog's literal "… unavailable" keys
("Tracking metrics unavailable", "Metrics unavailable").

On mobile the header becomes two 44px rows (brand + Scenarios; audience +
language). The view switch and Control toggle follow the transport, under the
pitch, so the pitch starts within 360px.

## Consequences

- First paint needs no script for the headline. The cost is that the page handler
  computes metrics on the first page request rather than on the first
  `/api/metrics` request; it is cached either way.
- Three new catalog keys: `index.higher`, `index.level` and `Score unavailable`.
  sw-KE and hi-IN hold the English text, marked NEEDS TRANSLATION in
  `docs/I18N-BACKLOG.md`.
- Tests: `team_kit_test.go` (handler: kit attributes for late-siege/corner and the
  unknown-id fallback, HEAD), `index_headline_test.go` (golden; the served first paint equals
  the API start tick in three locales, both team orders), `tests/integration/index-headline.test.mjs`
  (same golden, sign/label/team agreement, U+2212) and `tests/integration/hero-browser.mjs`. The browser
  test covers colours before scripts, at DOMContentLoaded and after the first htmx
  swap in all three renderers; the headline against `/api/metrics`; layout; and a
  paused renderer switch drawing 0 frames.
