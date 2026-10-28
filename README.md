# Pulse

An explainable football insights engine built using synthetic match events
and tracking data.

## Live demo

[Open Pulse on Azure](https://pulse-web.redflower-fe41736a.southafricanorth.azurecontainerapps.io/)
or [inspect the verified corner insight](https://pulse-web.redflower-fe41736a.southafricanorth.azurecontainerapps.io/?scenario=corner&view=three).

## Demo video

[Watch the Pulse hackathon demo on YouTube](https://youtu.be/260f1t1QPBw).

Go and Python are deployed in South Africa North. The public demo uses reviewed,
recorded corner output, labelled `Verified (recorded)`, with template fallback.
It makes no runtime model calls; Azure hosting still consumes credits. Python
insights require a server-side service token. See the
[deployment record](docs/AZURE-LIVE-STATUS.md) for checks, source images and limits.
Runtime changes on `main` are checked, container-tested and automatically deployed
by **Build Azure Images**. The homepage is the prototype-inspired experience;
`/experience` remains an alias and `/legacy` preserves the original view (no longer linked from the nav).

Start with the [judge instructions](docs/JUDGE-INSTRUCTIONS.md). The
[submission checklist](docs/SUBMISSION-READINESS.md) tracks native review,
prototype reuse permission and the [recording provenance audit](docs/RECORDING-PROVENANCE.md).
The recording's provider/model metadata is declared, not independently attested.
The [demo storyboard and local video](docs/DEMO-VIDEO.md) show only working,
fictional replay with honest recorded/template labels.

### Agent Inspector and comparison

**Agent Inspector** appears beneath a displayed
corner insight and **Insights -> What changed?** for equal, same-team 10/20/30-second
windows. Inspector exposes actual delivered artifacts and Go checks, plus a clearly
labelled injected-claim test. Its Oct 19 Foundry reference is a new three-role
reproduction with retained provider IDs, not an original trace or fresh generation
on each page visit. Comparison counts/pitch paths come from replay source actions,
with event evidence and bounded window replay. Alex approved merging these features
on Oct 19; the main release workflow determines when they reach Azure.
See [ADR 0028](docs/decisions/0028-agent-inspector-and-window-comparison.md).

Source-event evidence opens Live at the exact action timestamp and prepares a
bounded 1x replay. Corner evidence finishes the recorded shot movement without
changing its fact window. Tracking-only tails and completed sequences offer
replay, recap and scenario controls. Sparse authored tracking remains unchanged.
See [ADR 0029](docs/decisions/0029-evidence-replay-alignment-and-completion.md).

Run the new desktop/mobile checks against a local **recorded** setup:
`node tests/integration/inspection-comparison-browser.mjs`.
Replay alignment and ending checks: `node tests/integration/replay-browser.mjs`.

### Pattern, sharing and broadcast preview

PR #44 adds a second agent-supported
statistic: completed passes before the first shot in a precisely bounded
open-play window. In Late siege the rebound contains one completed pass, a carry
and a shot. Its recorded English CASUAL response retains the original provider
IDs and all three role outputs, separately from the old corner reproduction.
Go still recomputes and gates every published count and source reference.

The Copy evidence link icon preserves the replay, exact paused position, selected
evidence, language, persona, renderer and camera. Broadcast mode reuses that same
pitch fullscreen with clock-timed, honestly labelled captions. Escape returns to
the workspace. Main releases deploy these additions with recorded mode and a
zero model-request cap; check the released SHA on the public URL before a demo.
See [ADR 0031](docs/decisions/0031-open-play-pattern-sharing-and-broadcast.md).
Checks: `node --test tests/integration/evidence-link.test.mjs` and
`node tests/integration/sharing-broadcast-browser.mjs` with local recorded Python.

## Team

Four registered members: Jefferson (pipeline), Alex (agents), Ved (design) and Dhruvi Parekh (product, QA and submission readiness). Ownership is in [AGENTS.md](AGENTS.md#11-ownership-and-handoffs). Ved designed the Matchlens prototype that the UI is based on ([ADR 0015](docs/decisions/0015-prototype-visual-system.md#fonts-and-provenance)).

## Planned stack
- Go: simulator, statistics, replay and HTTP/SSE server
- HTMX: server-rendered interface updates
- TypeScript + SVG: animated pitch and evidence replay
- Python: analysis, storytelling and verification agents
- Microsoft Foundry and Azure: AI and deployment

## Structure
- contracts/: shared schemas and example payloads
- app/: Go application and web interface
- agents/: Python AI service
- data/: synthetic scenarios and sample matches
- tests/: integration tests and AI evaluations
- infra/: deployment configuration
- docs/: architecture, metrics and decisions

## Planning documents

- [Architecture Decision Brief](docs/Pulse-Architecture-Decision-Brief.docx)
- [Hackathon Team Plan](docs/Pulse-Hackathon-Team-Plan.pdf)
- [Delivery phases and current status](PHASES.md)

Both are team drafts. Current implementation choices and open recommendations
are recorded in [docs/decisions](docs/decisions).

## Run the browser pitch

Windows two-service startup (Go + Python, free template mode, automatic free ports):

```powershell
.\scripts\start-local.ps1
```

The printed Pulse URL and process IDs are authoritative. Use
`-SkipWebBuild` for committed assets. See [collaborator meeting](docs/COLLABORATOR-MEETING.md)
for prerequisites, checks, owners and the demo walkthrough.

Use `-AgentMode recorded` to replay the checked corner response without
a key or paid model calls. The cue is labelled `Verified (recorded)`; unmatched
requests use templates. Live mode is separate, opt-in and narrowly constrained.

Go 1.23 or newer is required. From the repository root:

```powershell
go run ./app/cmd/server
```

Open `http://127.0.0.1:8080`. The homepage defaults to the fictional 11v11 Late
siege replay. Use `/?scenario=corner` for the short 27:00-28:00 sequence.
Both have animated players and ball, a match clock, event timeline, play
and pause, seeking and speed controls. The page is served by Go; its pitch
renderer is TypeScript compiled to `app/web/static/pitch.js`.

The local renderer comparison has three views: 3D (Three.js, default), 2D
(PixiJS), and the original SVG. They share the same fixture, clock and replay
controls. Drag or pinch the 3D view to adjust the camera; its reset button
restores the initial view. WebGL initialization failures fall back to SVG.
Direct comparison URLs are `/?view=three`, `/?view=pixi` and `/?view=svg`.
Each canvas renderer is a separate lazy-loaded bundle; the SVG replay does
not load either renderer. Choosing a primary renderer remains a later decision.

### Match experience

On `main`, open `http://127.0.0.1:8080/`. The match experience adapts the
teammate's Live/Story/Insights layout to Go templates and locally bundled HTMX,
using Three.js, PixiJS and SVG. The preview ports the supplied stadium's stands,
articulated players, textured kits and patterned ball; the original renderer
remains at `/legacy` for comparison. Broadcast, Tactical and Follow ball perspective
cameras use recorded data. Running poses follow tracking velocity and the match
clock, so pause and rewind freeze/reproduce them. Control is opt-in on this route.
Story offers Live story, Catch up, recorded Highlights and Player focus, with
Casual/Analyst detail. These are source-event views, not model-generated prose.
Insights adds cumulative pass/shot/entry charts, attack-relative lanes, team
tracking heatmaps and shot locations with evidence. Heatmaps measure player-time,
not touches or pressure. The sequence recap unlocks at the end, and narrative
insights still pass through the existing Go cue gate.
The prototype's visual system now covers every working preview screen: neutral
canvas, blue navigation, local Outfit/Jakarta typography, red/blue teams and
canvas charts/maps. Story/Insights/Recap are dedicated pages with a shared replay
toolbar and optional mini-player. Navigation preserves the renderer. Passing
maps use Go-calculated pass-involvement positions; soft heat shading keeps the
underlying cell durations. SVG fallback remains available. Host-only prototype
AI/social/game features are not implemented by this visual port.

Frontend contributors can use the existing JSON APIs and the documented DOM
events without creating another simulator. See the
[frontend API handoff](docs/FRONTEND-INTEGRATION.md) for routes, units, ownership,
examples and meeting walkthrough. With a running server:

```powershell
$env:PULSE_URL = 'http://127.0.0.1:8080'
npm run test:experience
```

To edit the pitch renderer, install Node.js 20 or newer and run:

```powershell
npm ci
npm run check:web
npm run build:web
```

The compiled browser asset is committed so the Go server runs without an
`npm` step. To run the terminal replay instead:

```powershell
go run ./app/cmd/simulate -speed 10 -human
go test ./...
```

The command replays a fictional 27:00-28:00 sequence in six seconds. Omit
`-human` to print newline-delimited JSON messages for downstream services.
Use `-speed 0` to emit all messages immediately, or
`-fixture path/to/file.json` for another fixture. On this machine Go is installed at
`C:\Users\kwoba\tools\go\bin\go.exe`; use
`& "C:\Users\kwoba\tools\go\bin\go.exe" run ./app/cmd/simulate -speed 10 -human`
if `go` is not yet on your PATH.

See [contracts/README.md](contracts/README.md) for the coordinate, clock and
evidence-reference rules. Authored examples are contract fixtures; the running
Go server separately computes the corner fact pack from the replay.

## Status
Shared contracts, local replay, the browser pitch and one computed corner-shot
insight are working. The browser loads an offline fixture and a gated cue feed
from Go, sharing one playback clock. Go/Python cloud hosting now works; SSE/live
delivery remains future work. The opt-in model publishing path is mock-tested and one
separately approved live Foundry corner workflow has passed both gates.

Contract v2 follows the Markdown conventions: camelCase, uppercase enums,
regional locales and bottom-left pitch coordinates. Go and Python now share
FactPack, NarrationDraft and VerificationResult models plus valid/invalid
message examples. The Python HTTP endpoint now has separate deterministic
Explainer/Narrator/Verifier stages. Template mode makes no model calls. An explicit
Foundry mode wires all three roles and may publish independently checked wording
for the corner fact. One live CASUAL corner workflow was verified on 2026-10-13;
this is not a broad model-quality evaluation.

Check the dependency-free Python contract foundation with:

```powershell
py -m unittest discover -s agents/tests -v
```

## Run the insight flow

From the repository root, start the Python service (Python 3.11+):

```powershell
py agents/run.py --port 8090
```

In a second terminal:

```powershell
go run ./app/cmd/server -agents-url http://127.0.0.1:8090
```

Open `http://127.0.0.1:8080/?scenario=corner`. At 27:58 the insight and a shot-outcome banner
appear. The current final shot is blocked. Scores are not recorded in the
replay contract, so the header shows a neutral unavailable-score placeholder.
Evidence replays
27:52-27:58 at 1x, highlights the corner and shot, and stops at the clip end.
Return to match restores your previous clock. Restart clears the insight until
the moment occurs again. CASUAL and ANALYST templates are supported in all three
locales. English, Kiswahili and Hindi interfaces and deterministic templates are available
locally. Translations are drafts requiring native-speaker review before the demo;
model-backed publishing remains English-only.

Go calculates the first shot after a completed corner, in the same possession
phase and within 12 seconds, before any opponent event or another corner. A
blocked shot is still a shot attempt, not a goal. This is a deliberately narrow
moment detector, not a full set-piece attribution model.

- `GET /api/fact-packs`: computed corner fact packs.
- `POST /insights` on Python: `contracts/examples/insight-request.json` to `insight-response.json`.
- `GET /api/insights?persona=CASUAL` on Go: gated cue feed (`ANALYST` is also supported).
- `X-Pulse-Insight-Source`: `python-verified`, `python-template` or `go-template` for the current one-moment fixture.

If Python is unavailable or returns unsafe content, Go uses its own canonical
template through the same gate. `FALLBACK_TEMPLATE` means deterministic output,
not completed LLM verification. `VERIFIED` output must match one of the approved
corner-shot strings for the requested persona with the exact claim and full
evidence. Python and Go check independently; Go recalculates the pack. A model
approval alone cannot publish arbitrary prose. No shared v2 schema changed.

## Passing network and agent preparation

Below the pitch, Go-calculated passing networks show each team's completed
passes, directed links and sent/received totals. They follow the match clock;
rewinding removes future links. Click a pass timestamp to inspect its action.
The two-pass sample is intentionally small: no influence or centrality claims.

The three prompt files and bounded async workflow use the existing Foundry
backend in opt-in `foundry` mode. Narrator retries once, then falls back on
unsupported content or timeout. `foundry-shadow` remains template-only. Successful
verified cues show Verified in the browser; deterministic fallbacks show Template.
The first publishing policy permits wording selection, not open-ended tactical
analysis. Broader factual coverage needs a separately reviewed change.

```powershell
py tests/evaluations/run_agents.py
py tests/integration/agents-flow.py
```

These recorded, fake-backend checks exercise both publishing and fallback,
not model quality. The HTTP smoke test starts actual Python and Go servers without
paid calls. See [readiness decision](docs/decisions/0016-meeting-readiness.md).

## Core demo additions

The scenario selector offers Corner chance, Central entry, Passing exchange,
Late siege and Calm midfield. The first three are authored fixture variants;
the latter two use the deterministic 11v11 generator. These are synthetic
stories, not evidence of validated football intelligence. Go calculates
attacking-relative lane counts for completed passes/carries, penalty-area
entries and entry-to-shot conversion. Statistics follow rewind and evidence
playback; conversion is N/A when there are no qualifying entries.

Casual/Analyst buttons request the corresponding English insight wording.
Kiswahili and Hindi select translated templates without model calls. At the sequence end,
a deterministic recap appears with event evidence and a text download. No
goal outcome has been added pending shared-contract approval.

Additional browser check: `node tests/integration/core-browser.mjs` with
`PULSE_URL` pointing to the running server. The offline agent evaluation now
has 30 recorded cases, not a live model accuracy measurement.

Foundry is opt-in and bounded by a per-process request cap. The
default mode makes no model calls. See [Foundry/Azure setup](docs/FOUNDRY-AZURE-SETUP.md)
for credentials, shadow/publishing modes, Docker Compose and deployment steps.
Dockerfiles and `compose.yaml` are prepared but not yet container-tested here.
See [project-page copy](docs/PROJECT-PAGE.md) and [uploadable media](docs/media/README.md).

## Replay-backed analytics

Team labels, completed-pass totals, event counts, box entries, shots and
evidence descriptions now come from the selected replay. These follow the
same clock as the pitch, including rewind and bounded evidence clips. The
header pass bar compares completed passes, not possession. No goal is inferred.

The Control tab shows Go-calculated metrics and detected moments. Supported
5 Hz tracking replays have a clock-synchronised control overlay in SVG,
Three.js and PixiJS. Legacy fixtures show tracking metrics as unavailable,
while retaining their event-only set-piece moments.

- `GET /api/metrics?scenario=late-siege&grid=1`: cached metric ticks and a
  row-major, bottom-left control grid.
- `GET /api/moments?scenario=late-siege`: moment windows and their evidence.
- CONTROL_SWING evidence is metric ticks; nearby context events are never
  presented as its source evidence. Set-piece moments cite actual event IDs.

Tracking-derived values are **model estimates, uncalibrated**. The experimental
index is not a validated football measure, and the generator's formation
limitations still apply. These data-only overlays do not publish new AI cues
or add tick-derived facts to the v2 agent contract.

JSON replay, insight and fact-pack responses and the HTML pages (`/`,
`/experience`, `/legacy`, `/scenarios`, `/experience/panel`) support negotiated
gzip. Cached metrics/moments already support gzip and ETags; they are not
compressed twice.
Streaming transport is still pending. See [decision 0011](docs/decisions/0011-replay-backed-analytics.md)
for scope and the local compression benchmark, and [decision 0025](docs/decisions/0025-gzip-html.md)
for HTML.

## Language and control review

Select2 dropdowns are bundled and served locally with searchable options,
keyboard controls and one open menu at a time. Replay-panel refreshes are deferred
while a menu is open. Header and view controls wrap on narrow screens.
Language/persona choices persist across navigation, scenarios and reloads.
Casual keeps source-event wording concise; Analyst adds event IDs, phases and
coordinates. Changing either preserves the replay clock and ordinary playback.

The opt-in `hi-IN` locale extends the existing v2 locale enum alongside `en-GB`
and `sw-KE`. Both Go and Python use the shared six-case template examples and
retain complete fact/event references. Translated output is template-only,
not fresh model analysis or a claim of reviewed language quality.
Run `node tests/integration/controls-browser.mjs` against the local server.
See [decision 0021](docs/decisions/0021-localized-interface-and-controls.md).

With the Go server running, check all renderers and mobile layouts:

```powershell
$env:PULSE_URL = 'http://127.0.0.1:8080'
node tests/integration/analytics-browser.mjs
```

## Third-party software

The browser bundles and fonts include third-party software. Names, versions,
licences and upstream links are in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
The font licence files are in [app/web/static/fonts](app/web/static/fonts).

## Scenario and broadcast review

The local scenario/broadcast feature adds **End to end**, a fictional 90-second
11v11 passage with actions and shot attempts from both sides. Open
`/?scenario=end-to-end` after local startup. The original five fixtures remain
available. Expand **Match briefing**, play at 1x, then use **Read the game** below
the pitch for a trailing-20-second comparison, Player Spotlight and Shot lens.
Shot lens shows geometry and the recorded outcome; it does not estimate goal
probability. Spotlight highlights the chosen player with an eight-second movement
trail and source-event links. Pause, seeking and the evidence return control all
use the existing replay clock. See ADR 0034 for calculation/translation limits.

Focused browser check against the running local server:

```powershell
$env:PULSE_URL = 'http://127.0.0.1:8180'
node tests/integration/match-lab-browser.mjs
```


The same review branch also improves 3D pitch movement and cameras (ADR 0035).
Use **Broadcast** for a moving view of the play, **Tactical** for an orthographic
team-shape overview, or **Follow ball** for a closer angle. Drag to orbit manually;
the camera reset restores automatic framing. Player poses use source travel and
recorded kick/first-touch cues. The avatars remain procedural and the scripted
football routes are unchanged.

Motion validation:

```powershell
node tests/integration/replay-motion.mjs
node tests/integration/character-poses.mjs
node tests/integration/motion-browser.mjs
```
