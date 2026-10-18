# Frontend integration handoff

Base branch: `main`. Homepage: `/` (defaults to late-siege).
`/experience?scenario=late-siege` remains an alias. Existing dashboard:
`/legacy?scenario=late-siege`. All use the same Go engine.

The preview's Three.js scene now uses the supplied HTML's stadium/character
presentation: stands and crowd, articulated bodies, textured jerseys, patterned
ball and close perspective cameras. PixiJS uses the brighter striped turf and
patterned ball in tactical 2D. Original capsule/number visuals remain on `/legacy`.
Control starts off in the preview so turf and players remain clear; the same
Go-calculated field can be enabled with the checkbox.
The current preview matches the supplied prototype's neutral/blue shell, sidebar,
segmented views and typography across all working screens. Fonts are local.
Dedicated Story/Insights/Recap screens reuse the pitch in an optional watch dock
and keep the original playback controls in a shared toolbar. No second renderer
or clock is created. `section=story|insights|recap` opens a screen directly.

## Start and contribute

Windows: `.\scripts\start-local.ps1` starts both services in template mode,
selects unused ports and prints their URLs/PIDs/logs. Committed browser assets
can be used with `-SkipWebBuild`. Full meeting checklist:
[collaborator meeting](COLLABORATOR-MEETING.md).

```powershell
git switch main
git switch -c feature/frontend-change
npm ci
npm run check:web
npm run build:web
go run ./app/cmd/server -addr 127.0.0.1:8080
```

Open `http://127.0.0.1:8080/`. Committed assets also
allow running Go directly without npm. Optional Python template service:

```powershell
py agents/run.py --host 127.0.0.1 --port 8090 --mode template
go run ./app/cmd/server -addr 127.0.0.1:8080 -agents-url http://127.0.0.1:8090
```

Create a feature branch from current main for your changes, then open a PR for
team review. Main runtime changes automatically build and deploy after the CI
and container smoke gates pass.

## API boundary

All Go endpoints are same-origin, read-only GET. Choose one scenario consistently:
`corner`, `central`, `exchange`, `late-siege`, `calm-midfield`. Unknown scenarios
return 404. Append `scenario=...` to every request; the default is `corner`.

| Endpoint | Response / use |
|---|---|
| `/api/replay?scenario=late-siege` | v2 replay: match metadata, source events, tracking frames |
| `/api/metrics?scenario=late-siege&grid=1` | Go-calculated ticks and row-major control grid; grid omitted unless requested |
| `/api/moments?scenario=late-siege` | Detected moments with event or tick evidence and model metadata |
| `/api/fact-packs?scenario=corner` | Go-built corner-to-shot facts for the agent engineer |
| `/api/insights?scenario=corner&persona=CASUAL&locale=en-GB` | Go-gated cue feed; `ANALYST` also supported |
| `/experience/panel?scenario=late-siege&panel=story&atMs=5280000` | HTML fragment: source-event story at elapsed match clock |
| `/experience/panel?scenario=late-siege&panel=recap&atMs=5360000` | HTML recap, unavailable before the end of that replay |
| `/experience/panel?scenario=late-siege&panel=analytics&atMs=5316000&map=occupancy` | HTML cumulative charts, tracking occupancy and attacking lanes |

HTML panel selectors (not new shared v2 contracts):

- `panel`: `story`, `recap`, `analytics`.
- `mode`: `live` (last five events), `catchup` (all elapsed events), `highlights`
  (elapsed SHOT/CORNER/CROSS), `player` (actor or named recipient involvement).
- `persona`: `CASUAL` or `ANALYST`; analyst source logs add IDs, phase and coordinates.
- `playerId`: a match player; defaults to the first metadata player. Only the
  Player focus view filters by it. This is not the unimplemented SPOTLIGHT persona.
- `teamId`: a match team; defaults to the first metadata team. Selects maps/lanes,
  while the cumulative charts always compare both teams.
- `map`: `occupancy`, `shots` or `network`. Shot dots use the event's `from` coordinates;
  each has a source-event evidence button. No xG, on-target or goal classification.
- Passing-map nodes average each player's completed-pass origins/received
  destinations up to the clock, computed in Go. These are pass-involvement
  locations, not general touches or average tracking positions. Directed edges
  preserve their source event IDs; incomplete passes, crosses and corners are out.

Every fragment uses `Cache-Control: no-store`. Missing/out-of-window/non-integer
`atMs` and unknown selectors return 400; non-GET methods return 405. Recap still
unlocks only at the end. The existing JSON routes supply the underlying data
for contributors using a separate development UI.

Example JSON consumer:

```typescript
const scenario = "late-siege";
const response = await fetch(`/api/replay?scenario=${scenario}`);
if (!response.ok) throw new Error(`Replay unavailable: ${response.status}`);
const replay = await response.json();
if (replay.schemaVersion !== "2.0.0") throw new Error("Unsupported replay");
// Interpolate adjacent tracking frames at the single replay clock.
// Never re-simulate actions or recompute football metrics in the frontend.
```

An independently hosted development UI should proxy `/api` to the Go server
through its dev server. CORS is not enabled; do not add wildcard access or put
Azure/Foundry credentials in browser code. Python's `POST /insights` is a
server-to-server boundary, not a browser endpoint.

## Units and evidence

- IDs are strings. Events use uppercase enums and `schemaVersion: "2.0.0"`.
- `timeMs`, match bounds, cue windows and tracking times are elapsed match
  milliseconds, not wall-clock timestamps or seconds since the clip began.
- Pitch: 105 x 68 metres, origin bottom-left. SVG/canvas must invert Y; Three.js
  currently maps metres to `(x - 52.5, height, 34 - y)`.
- Render only ticks, events and cumulative snapshots at or before the clock.
  Rewind must remove future numbers, stories, moments and highlights.
- Score is unavailable. A COMPLETE shot is not proof of a goal.
- Metrics are **model estimate, uncalibrated**. Show that wording, from the one
  `model estimate, uncalibrated` catalog key, beside any model value; no other
  label wording is allowed. Formation geometry biases absolute shares (issue
  #17), so the Control vs Chaos headline is the API's `indexDelta` for
  `/api/metrics` `teams[0]` ("Index difference", labelled `teams[0] − teams[1]`
  from that same API order), never an absolute per-team index or share. It is
  not recomputed in the browser; it shows N/A, with no team label, when
  `indexDelta` is missing or the replay has no tracking metrics. Do not make headline probability claims or move
  tracking estimates into v2 FactPacks.
- Event moments cite `reasons`. CONTROL_SWING uses `tickTimes` as evidence,
  with empty `reasons`; `contextEventIds` are context, never evidence.
- Insight text comes only from `/api/insights` after the Go cue gate. Current
  `FALLBACK_TEMPLATE` output is deterministic, not real AI verification.
- CASUAL/ANALYST templates work in `en-GB`, `sw-KE` and `hi-IN`. Translations are
  drafts for native-speaker review, not new model-backed analysis. Use `locale`
  on insight/panel requests; any other value falls back to `en-GB`. The page
  uses a supported `?locale=`, then a supported stored choice, then `en-GB`.
  Raw replay and metric values are never translated. Server-rendered text with
  values uses `data-i18n` plus `data-i18n-arg-*`/`data-i18n-term-*` attributes;
  untranslated attribute strings are tracked in `docs/I18N-BACKLOG.md`.
- Occupancy sums recorded player milliseconds in 21 x 17 cells (5 x 4 metres),
  holding each position until the next frame or the cutoff. No future positions
  are used. Team totals sum all selected players' time, so they can exceed elapsed
  match time. It is not a touch, possession, pressure or threat heatmap.
- Heat intensity is relative to the map's current maximum; use the legend when
  comparing teams/times. Longest included sampling interval is displayed because
  sparse fixtures provide a much coarser approximation than the seeded 5 Hz clips.
- The preview's canvas uses radial shading of those source cells for the supplied
  prototype's softer look. Colour is relative display density, not a calibrated
  probability or literal cell duration. Hover reads the underlying cell's exact
  displayed player-seconds; peak cell and total time remain numeric. Canvas failure
  leaves the unsmoothed Go SVG visible and removes the smoothing label.
- Chart paths use existing Go passing/attacking snapshots. Their match-clock axis
  is fixed to the replay window, with the future part blank and no interpolated
  action counts. Box entries are not goals; lane counts are attack-relative.

Authority: [contracts](../contracts/README.md). Useful fixtures:
[replay](../data/samples/first-sequence.json),
[fact pack](../contracts/examples/fact-pack.json),
[insight request](../contracts/examples/insight-request.json),
[insight response](../contracts/examples/insight-response.json),
[overlay cue](../contracts/examples/overlay-cue.json).
API model details and limitations: [metrics](metrics.md).

## HTMX and pitch ownership

`match.html` serves both routes. Preview-only CSS/JS is loaded on `/experience`.
HTMX's `hx-get` requests the fragment above, including all selectors and
`atMs` from `#experience-inputs`. Only `#experience-content` is swapped, with
replace-on-new-request synchronization. Updates are throttled while playing;
paused clock changes refresh immediately. Failure retains the dated snapshot
and offers Retry; playback continues independently. Follow the
[HTMX docs](https://htmx.org/docs/) when adding another HTML panel.

The existing pitch controller remains the sole clock owner. Contributors can
use these document events without accessing its private state:

```typescript
document.addEventListener("pulse:clock", event => {
  const { timeMs, playing, scenario } = (event as CustomEvent).detail;
  // Update your panel inputs; never start a second playback timer.
});
document.dispatchEvent(new CustomEvent("pulse:inspect", {
  detail: { eventId: "evt-03" }, // Or { timeMs: <elapsed match ms> }
}));
document.dispatchEvent(new CustomEvent("pulse:select-pane", {
  detail: { pane: "passing" },
}));
document.dispatchEvent(new CustomEvent("pulse:camera", {
  detail: { mode: "tactical" }, // broadcast | tactical | follow (Three.js only)
}));
```

`pulse:inspect` pauses at a validated source event/time. `pulse:clock` publishes
on clock-second/event/play-state changes, with exact paused seek time. Pane
options: `timeline`, `passing`, `control`, `routes`, `recap`, `evidence`.
`pulse:pane-selected` reports `{ pane }`. This DOM bridge is presentation-only,
not a new shared football contract or streaming API.

| Contributor area | Files |
|---|---|
| Experience navigation / HTML refresh | `app/web/src/experience.ts` |
| Prototype canvas charts / maps | `app/web/src/experience-graphics.ts` |
| Layout / mobile polish | `app/web/static/experience.css` |
| Shared shell / fragment markup | `app/web/templates/pages/match.html`, `partials/experience.html` |
| Bounded HTML presentation | `app/internal/transport/http/experience.go` |
| Go chart/map presentation | `app/internal/transport/http/experience_analytics.go` |
| Tracking occupancy aggregation | `app/internal/engine/metrics/occupancy.go` |
| Shared playback / evidence / overlays | `app/web/src/pitch.ts`, `analytics.ts` |
| Rendering only | `app/web/src/renderers/three.ts`, `pixi.ts` |
| Ported stadium / player anatomy | `app/web/src/renderers/stadium.ts`, `characters.ts` |

Never HTMX-swap the canvas, playback controls, analytics inspector or gated cue
region. Keep the supplied HTML's browser engine and host-specific AI/storage
calls outside Pulse. Agree shared contract changes with both engine/agent owners.
`experience.ts` moves the existing pitch/transport DOM nodes when navigating and
restores them on Live. Avoid cached parent assumptions. Map canvases dispatch
`pulse:map-inspect` with `{ eventId }`, which navigation turns into the existing
`pulse:inspect` command. Canvas observers are disposed on each HTMX swap; SVG and
source evidence buttons remain the fallback. Do not calculate football in canvas.

Map cells and passing players now support touch/click selection plus the Select2
`#map-selection` inspector. `#map-detail` announces the selected source detail;
passing-player evidence comes from elapsed completed-pass involvements in Go.
Heatmap cells carry player-time only and must never fabricate event evidence.
Selection is scoped by scenario/team/map and cleared when rewinding removes it.
These selectors and evidence controls remain usable with the SVG fallback.

Cue status is sourced from `verification.status`: VERIFIED is shown as Verified,
FALLBACK_TEMPLATE as Template. The opt-in agent publishing policy remains narrow;
do not relabel deterministic source summaries as AI output.

`SceneState.timeMs` and `velocities` are presentation inputs from adjacent replay
tracking frames, not shared-contract changes or new statistics. Character roots
and ball height remain recorded positions; only limbs and ball rotation are
cosmetic. A name tag identifies the latest source event's actor, not a claimed
possessor. No synthetic ball arcs, kicks or goals are inferred by the renderer.

## Meeting walkthrough and checks

1. Open late-siege in 3D, pause, select Broadcast/Tactical/Follow ball.
2. Switch to PixiJS 2D, then return to 3D; all positions use the same clock.
3. Open Story, compare Live/Catch up/Highlights/Player focus, switch Casual/Analyst,
   seek forward then backward and inspect an event's Evidence.
4. Open Insights, compare Match graphs and Pitch maps (pass network, team heatmaps,
   shot locations). Use Passing detail, Model & moments or Routes for the existing
   inspectors; source evidence buttons remain available.
   Charts & maps returns to the overview. Inspect a shot's source evidence.
5. Seek to the end, open Recap and download its source-event summary.
6. On any non-Live screen, show/hide the watch dock and return to Live; the
   original renderer and playback state must survive.
7. Select Corner chance, advance to the end, compare Casual/Analyst and replay
   the gated insight's evidence. Return to the original dashboard for comparison.

```powershell
go test ./...
go vet ./...
npm run check:web
npm run build:web
$env:PULSE_URL = 'http://127.0.0.1:8080'
node tests/integration/pitch-browser.mjs
node tests/integration/core-browser.mjs
node tests/integration/analytics-browser.mjs
npm run test:controls
npm run test:library
npm run test:experience
```

Chrome must be installed; set `CHROME_PATH` if necessary. The preview test uses
real mobile viewports, checks nonblank/moving canvas pixels and saves screenshots
to the temporary `pulse-experience-preview` folder (override `PULSE_SCREENSHOTS`).
No live model calls, paid services or cloud deployment are required for this demo.
Competition fit and unimplemented prototype features:
[Story and maps decision](decisions/0014-story-views-and-replay-maps.md).
Full visual port: [prototype presentation decision](decisions/0015-prototype-visual-system.md).

## Replay library and dropdown lifecycle

`GET /scenarios` returns HTML from Go's available fixture catalog. The Scenarios
dialog loads it once through HTMX; it does not fetch entire replays for every
thumbnail or recreate the running pitch. Links retain audience and renderer.
`?demo=1` starts the guided flow once and is removed from the URL afterward.

Enhance selects on `htmx:afterSettle`, not after swap: HTMX otherwise restores
class/style and reveals native controls alongside Select2. Destroy instances
before cleanup. A `pulse:selection` event from a native select synchronizes its
widget without changing the match clock or requesting a new fragment.

Fact check renders the gated cue's existing verification/fact/event metadata.
Do not turn template output into a Verified badge. See the
[prototype audit and cloud checklist](PROTOTYPE-REVIEW-2026-10-15.md).
