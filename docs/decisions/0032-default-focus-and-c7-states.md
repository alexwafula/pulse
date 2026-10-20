# 0032: Default team and player, and C7 states

Date: 2026-10-19
Status: Implemented on review branch (D4b-1, `feat/d4b-states`); teammate review pending

## Context

The IA audit (e9b5554) found the experience opening on `Match.Teams[0]` and
`Match.Players[0]`. In late-siege and calm-midfield that is bastion, which has no pass,
carry or shot in any scenario, so Insights, Story's Player focus and both drawer
tables opened on zeros. Zero values were drawn as data everywhere: "0 of 0", "N/A",
22 zero passing rows, 0→0 comparison rows over two empty pitches, a 0 px drawer Recap
pane, and the raw tracking `reason` as the only explanation for missing metrics.

## Decision

**Default focus (domain).** `domain.DefaultFocus(replay)` is pure. Per team it counts
PASS, CARRY and SHOT events of any outcome over the full replay; clearances and other
types do not count. The highest count wins; a tie or two zeros keeps `Teams[0]` (API
order). The player is the default team's player with the most involvements (a pass
made, a completed pass received, a carry or a shot); ties keep roster order, and a team
without involvements opens on its first player. `domain.ActionCounts` exposes the
counts. The result is vale in all five scenarios: corner vale-8 (Tayo, 3), central
vale-8 (Tayo, 3), exchange vale-7 (Imani, 3), late-siege vale-10 (Dax, 6; tied with
Imani and Tayo, first in roster order) and calm-midfield vale-3 (Musa, 6).

`replayPage` computes the focus once per scenario. The page marks those options
`selected` in the team and player selects, and `/experience/panel` uses the same values
when `teamId` or `playerId` is missing, so server-rendered HTML and HTMX panel requests
agree. API order is unchanged everywhere else: the hero label, chart legends, the share
bar and `/api/*` still list teams as the API does.

**One state partial.** `{{define "state"}}` in `experience.html` draws every C7 state:
an icon and one line of text, and for raw data a closed `<details>`. Kinds differ by
icon shape as well as colour, following the status-badge rules (ADR 0027):
`empty` circle-minus, `loading` loader-circle (spins unless reduced motion),
`error` circle-alert (as the Unavailable badge) and `no-tracking` triangle-alert. The
icon is `aria-hidden`; the text is the accessible name. Lines have no role; hosts
whose state changes (`#metrics-state`, `#moments-state`, `#panel-status`) are persistent
`role="status"` regions, so a swapped line is announced once. The `state` template func
builds lines from catalog keys (en-GB text, `data-i18n` plus `data-i18n-arg-*` in the
caller's order), so the page localizer re-renders them per locale. Scripts hold no
markup: they clone `<template id="state-templates">` (`state-line.ts`).
`app/testdata/states/state-lines.json` pins the partial's output for every line the
scripts draw; `TestStateLinesGolden` checks the Go side and `states-browser.mjs` checks
that the scripts' lines serialize identically.

**Where it applies (experience only; `/legacy` is unchanged and pixel-checked).**

| Surface | Zero rendering before | Now |
|---|---|---|
| Left rail | "0 of 0", "0 entries / 0 shots", "N/A" | "No passes yet", "No box entries or shots yet"; conversion hidden without entries |
| Drawer Passing | graph and 11 zero rows per team | team with no pass/carry/shot in the replay: one line; no completed pass yet: one line; otherwise zero players share "N players with no passes" |
| Drawer Routes | 0-of-0 meters, "Entry to shot N/A" | one team line as above, or "{team}: no completed passes, carries or shots yet"; "No box entries yet" instead of N/A |
| Control pane | raw reason, N/A rows, "Detected moments 0" | loading/error lines; no-tracking line naming the gap, raw reason in `<details>`, N/A rows hidden; zero moment count hidden with "No moments yet/detected" |
| Live metrics label | "Tracking metrics unavailable" | the same no-tracking line, for example "Control metrics unavailable: tracking has a gap of 8.0 s at 27:08" |
| Drawer Recap | 0 px pane before the end | the Recap section's "Recap available at the end of the sequence." |
| Story Player focus | 0 / 0 / 0 / 0 | "{player}: no passes, carries or shots yet", or "…in this sequence" for a player with none |
| Insights charts | three flat 0·0 charts | one line while all are zero; a zero chart keeps its title with "None yet" |
| Insights maps and lanes | empty pitch, zero meters | inactive team: its pass-network and shot maps and its lanes are one team line, while its tracking heatmap (real player-time) stays; active team: zero lanes are one line, and maps keep their pitch with the existing "…yet" line |
| What changed? | six 0→0 rows over two empty pitches | inactive team: one line; two empty windows: "{team}: no completed passes, carries or shots from {start} to {end}"; otherwise only rows with a non-zero side, plus "N metrics with none in either window" |
| Panel status | "Updating" / failure text | loading and error lines |

The no-tracking line parses the Go check's `frame gap of <ms> ms at <ms>` reason, the
case every sparse fixture hits; any other reason shows a general line. The API and its
`reason` are unchanged.

## Not changed

`/api/*` bodies (byte-identical before and after for every scenario), contracts, metric
outputs, the hero (headline, U+2212 value, API-order label, chip), Verified narration,
evidence, evals and status-badge text. The live Story summary keeps "0 / 0" at the start
(`experience-browser.mjs` asserts it); per-value nulls in the Control pane for supported
tracking (pressing or carrier "N/A") are unchanged. Passing-network layout, hidden-pane
render gating, panel caching and URL state are out of scope.

## Tests

`go test ./app/internal/domain` (DefaultFocus rules and all five scenarios with counts),
`go test ./app/internal/transport/http` (state builder, zero detection, page/panel focus
agreement, collapsed analytics at the start), and `tests/integration/states-browser.mjs`
(five scenarios at start, mid and end at 1440 and 390 px; tracking-gap line; collapsed
tables, windows and Recap pane; loading/error; locale keys; `/legacy`).
