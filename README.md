# Pulse

An explainable football insights engine built using synthetic match events
and tracking data.

## Planned stack
- Go: simulator, statistics, replay and HTTP/WebSocket server
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

## Run the browser pitch

Go 1.23 or newer is required. From the repository root:

```powershell
go run ./app/cmd/server
```

Open `http://127.0.0.1:8080`. The browser replays the fictional 27:00-28:00
sequence with animated players and ball, a match clock, event timeline, play
and pause, seeking and speed controls. The page is served by Go; its pitch
renderer is TypeScript compiled to `app/web/static/pitch.js`.

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
Shared contracts, a local Go replay and the browser pitch are working. The
pitch currently loads the authored fixture from Go and interpolates its
tracking frames in the browser. Live delivery, fact calculation and Python
insights are the next milestones.
