# Pulse contracts v2

These JSON Schemas are the handoff between the Go engine, Python insight
service and browser. The runnable replay fixture is
`data/samples/first-sequence.json`; example fact pack and cue payloads are in
`contracts/examples/`. The example fact pack and cue are authored fixtures,
not calculated or verified output yet.
The replay stream envelope is defined in
`contracts/schemas/replay-message.schema.json`: a `MATCH` message comes
first, followed by `TRACKING` and `EVENT` messages.

## Coordinate and clock rules

- Pitch coordinates are metres on a 105 x 68 pitch. `x=0` is the left goal
  line and `y=0` is the bottom touchline. The browser inverts y when drawing. Ball `z`
  is height above the surface in metres.
- `timeMs`, window bounds and cue bounds use elapsed match milliseconds,
  with `period` identifying the half. The sample runs from 27:00 to 28:00
  of period 1. Playback waits relative to `match.startMs`.
- Each team's `attackingDirection` describes its direction in this period.
  A later multi-period fixture must specify direction per period.
- A tracking frame is a snapshot. A renderer may interpolate between frames;
  it must keep events and cues on the same match clock.
- IDs are stable within a match. Fact `eventIds` identify source events;
  cue `factIds` and `eventIds` carry the evidence trail into the browser.
- Cue `startMs`/`endMs` control display. `replayStartMs`/
  `replayEndMs` identify the evidence clip and may start earlier.
- Every independently exchanged payload carries `schemaVersion: "2.0.0"`.
  Breaking changes require a new version.

## Agent handoff

Phase 0 uses the existing six event kinds: PASS, CARRY, CROSS, CLEARANCE,
CORNER and SHOT. Do not remove the corner scenario to fit a future event list.
Other event kinds need agreed schemas and examples before implementation.

All field names are camelCase. Enums are UPPER_SNAKE; locales are `en-GB`
and `sw-KE`, personas are `CASUAL` and `ANALYST`. IDs match
`[A-Za-z0-9_.:-]{1,64}`. Match clocks remain elapsed milliseconds, not UTC
timestamps. Future wall-clock fields must use UTC ISO-8601 with milliseconds.

The first agent boundary is HTTP `POST /insights`, defined by
`insight-request.schema.json` and `insight-response.schema.json`. The input
envelope carries a FactPack plus explicit persona and locale.
Explainer produces supported claims, Narrator produces a NarrationDraft, and
Verifier produces a VerificationResult. The Go producer will assemble the cue.
Only COMMENTARY cues are contracted for the first golden path, with text capped
at 240 characters. Additional cue kinds and personas remain future work.

Go and Python message models and tests share `narration-draft.json`,
`verification-result.json` and their `invalid-*` counterparts. These checks
reject unknown fact/evidence references and inconsistent verification counts.
They do not prove that arbitrary prose is true. The first Go cue gate also
recomputes the fact pack from the replay and accepts only canonical template
output. Python currently uses standard-library
TypedDict models; Pydantic needs dependency approval before adoption.

Every example is authored, including the VERIFIED example. It demonstrates
the contract shape, not a completed model verification run. FALLBACK_TEMPLATE
is reserved for trusted deterministic templates, never arbitrary model text.

Run the shared business-rule examples from the repository root:

```powershell
go test ./app/internal/domain ./app/internal/simulator
py -m unittest discover -s agents/tests -v
```

Version 2 replaces v1 outright for this pre-release repository. External
consumers must migrate field names/enums/locales, and convert y to `68 - y`.
No v1 compatibility adapter is provided.

## First computed insight

`app/internal/facts.CornerPacks` computes one first-shot fact per qualifying
corner: same team/phase, completed corner, no intervening opponent event or
new corner, maximum 12 seconds. The sample's blocked shot counts as an attempt.
Computed pack/fact IDs derive deterministically from match/corner/shot IDs.
The browser schedules the cue at the shot timestamp, never before it. The
offline HTTP APIs expose the full precomputed replay and packs, not a live feed.

`cue-feed.schema.json` describes Go's offline replay feed. The browser schedules
each cue on the same match clock and pins it only during explicit evidence
replay. This is HTTP fixture delivery, not SSE or a live-server match clock.

`insight-request.json` / `insight-response.json` are authored handoff examples.
`invalid-insight-cases.json` contains shared mutations exercised by Go and
Python. The runnable Go API produces its own deterministic packs and cues.
The local Python adapter validates request structure and template inputs with
standard-library code; it is not a generic JSON Schema validation service.
Template capability is currently en-GB only, despite sw-KE being reserved in
the schemas. The three Python stages are replacement points, not real agents.

The Go loader also checks facts that JSON Schema cannot express across the
fixture: matching IDs and period, two opposite attacking directions,
chronological events and frames, complete player tracking, pitch bounds and
coverage of the complete replay window.
