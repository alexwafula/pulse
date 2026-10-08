# Pulse

An explainable football insights engine built using synthetic match events
and tracking data.

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

Both are team drafts. Current implementation choices and open recommendations
are recorded in [docs/decisions](docs/decisions).

## Run the browser pitch

Go 1.23 or newer is required. From the repository root:

```powershell
go run ./app/cmd/server
```

Open `http://127.0.0.1:8080`. The browser replays the fictional 27:00-28:00
sequence with animated players and ball, a match clock, event timeline, play
and pause, seeking and speed controls. The page is served by Go; its pitch
renderer is TypeScript compiled to `app/web/static/pitch.js`.

The local renderer comparison has three views: 3D (Three.js, default), 2D
(PixiJS), and the original SVG. They share the same fixture, clock and replay
controls. Drag or pinch the 3D view to adjust the camera; its reset button
restores the initial view. WebGL initialization failures fall back to SVG.
Direct comparison URLs are `/?view=three`, `/?view=pixi` and `/?view=svg`.
Both canvas renderers are currently bundled together for the comparison;
choosing a primary renderer or splitting the bundle is a later decision.

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
evidence-reference rules. The sample fact pack and cue are contract examples,
not output from a fact builder yet.

## Status
Shared contracts, local replay, the browser pitch and one computed corner-shot
insight are working. The browser loads an offline fixture and a gated cue feed
from Go, sharing one playback clock. SSE/live delivery and model-backed agents
remain future work.

Contract v2 follows the Markdown conventions: camelCase, uppercase enums,
regional locales and bottom-left pitch coordinates. Go and Python now share
FactPack, NarrationDraft and VerificationResult models plus valid/invalid
message examples. The Python HTTP endpoint now has separate deterministic
Explainer/Narrator/Verifier-shaped stages. They are template stubs, not LLM
agents; no model calls are made.

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

Open `http://127.0.0.1:8080`. At 27:58 the insight and a shot-outcome banner
appear. The current final shot is blocked; the scoreboard remains 0:0. Evidence replays
27:52-27:58 at 1x, highlights the corner and shot, and stops at the clip end.
Return to match restores your previous clock. Restart clears the insight until
the moment occurs again. The template supports English CASUAL and ANALYST;
Kiswahili remains unsupported until language review and glossary work.

Go calculates the first shot after a completed corner, in the same possession
phase and within 12 seconds, before any opponent event or another corner. A
blocked shot is still a shot attempt, not a goal. This is a deliberately narrow
moment detector, not a full set-piece attribution model.

- `GET /api/fact-packs`: computed corner fact packs.
- `POST /insights` on Python: `contracts/examples/insight-request.json` to `insight-response.json`.
- `GET /api/insights?persona=CASUAL` on Go: gated cue feed (`ANALYST` is also supported).
- `X-Pulse-Insight-Source`: `python-template` or `go-template` for the current one-moment fixture.

If Python is unavailable or returns unsafe content, Go uses its own canonical
template through the same gate. `FALLBACK_TEMPLATE` means deterministic output,
not completed LLM verification. The gate currently rejects all noncanonical
prose, including model output labelled VERIFIED. Expand it only alongside the
real agent verification work and adversarial evaluations.
