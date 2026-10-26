# 0034: Scenario briefings, two-sided play and broadcast measurements

Status: Reviewed locally; approved for merge to main. Azure rollout follows main CI.
Date: 2026-10-23

Alex authorized this isolated UI/scenario improvement pass after the research
review. On 2026-10-26 Alex reviewed the local preview and requested that PR #49
be merged to main to build the submission demo. Deployment is not considered
complete until the release workflow and `/version` confirm it.

## Scope

- Six scenario cards now include an editorial setup and a spoiler-free watch-for
  prompt. The same briefing is expandable in Live.
- `end-to-end` is a new, fictional 90-second 11v11 replay. Both teams pass, carry
  and attempt a shot. It uses the existing six event kinds and v2 payloads.
- A generator-only `shapeModel: balanced-v1` selects mirrored, ball-relative
  support/defensive targets. Possession-side selection uses the scripted actor's
  team, never its attacking direction. Existing acceleration/speed constraints
  apply. Old scripts default to their original movement; their fixtures are
  unchanged. Reserved lineHeightM/compactness settings remain reserved.
- Main experience starts at 1x. Guided demo pacing and /legacy remain unchanged.
  The initial Broadcast overview is superseded by the approved animation/camera
  follow-up in ADR 0035; Tactical retains the complete-pitch overview.
- `/api/match-details?scenario=...` is presentation data calculated in Go:
  shot distance to the opposing goal centre, angle between nominal 7.32 m
  goalposts, inclusive trailing-20-second team completed/attempted pass counts,
  and cumulative player pass attempts and counts. It is not an agent fact pack
  or an xG/scoring-probability model. Snapshots include expiry cutoffs so rewind
  and window expiry are exact.
- The recent-play card shows completed/attempted passes for its 20-second window;
  pass completion and each team's completed-pass total below it are labelled as
  cumulative through the current replay clock.
- Shot lens shows the source outcome and measured geometry on the pitch and in
  a tactical inset. It appears only after that shot, and can replay its action
  using the existing evidence controls. Rewind removes future information.
- Player Spotlight extends presentation only: choose a player, highlight them,
  see their trailing eight seconds of recorded/interpolated movement and Go
  counts, then inspect their recent source events. It is not a new agent persona.
- New controls follow mobile layout and disappear in the watch dock. Existing
  synthetic labels, metric-estimate labels, cue gate and agent modes are retained.

## Boundaries

No shared schemas, Go/Python wire models, agent prompts, dependencies, CI or
Azure configuration changed. Recorded/template mode remains the review mode.
No paid model calls or resources were used. New interface translations are drafts;
new English scenario briefings currently use English fallback in other locales.
This is a scripted illustration, not a validated full-match simulation.

## Verification

Focused Go checks cover both goal directions, geometry boundaries, trailing
window cutoffs, no opening future counts, endpoint methods and deterministic
reproduction/physical quality of the new replay. `match-lab-browser.mjs` checks
briefings, shot measurements, Spotlight, rewind, all three renderers and desktop /
mobile layouts. The existing library suite now checks all six scenarios, three
11v11 and three short sequences; no source-fixture expectation was removed.
Full regression results are reported with the completed local review.

### Local review results

Passed on Windows: full Go tests and vet; new replay generation/reproduction and
checkdata; 43 Python unit tests; all 40 offline fake-backend evaluation cases;
TypeScript check/build; focused new-feature browser tests; and the existing
library, experience, analytics and controls browser suites. The controls suite
covers 320/390/768/1440 px; the feature suite covers SVG/Pixi/Three at 1440/390 px.
Desktop/mobile screenshots were visually reviewed. No Azure deployment or live
model evaluation was performed by this change. New fixture: 17 events, 22 players,
451 tracking frames, max measured player speed 6.80 m/s, minimum separation 0.57 m.

### Review follow-up (2026-10-26)

The local pass-stat follow-up adds team attempts to the recent window and player
attempts to cumulative Spotlight counts. `scenario-pass-stats-browser.mjs`
compares recent counts at five replay positions and cumulative totals at the end
of all six scenarios. `motion-browser.mjs` checks Broadcast framing at 21 points
in each scenario on desktop and mobile, and all three camera modes across the
full End to end replay. Go detail tests, `npm run check:web`, `npm run build:web`,
and both browser checks passed. The current framing and stat labels were reviewed
locally; the main release remains pending.
