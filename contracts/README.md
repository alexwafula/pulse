# Pulse contracts v1

These JSON Schemas are the handoff between the Go engine, Python insight
service and browser. The runnable replay fixture is
`data/samples/first-sequence.json`; example fact pack and cue payloads are in
`contracts/examples/`. The example fact pack and cue are authored fixtures,
not calculated or verified output yet.
The replay stream envelope is defined in
`contracts/schemas/replay-message.schema.json`: a `match` message comes
first, followed by `tracking` and `event` messages.

## Coordinate and clock rules

- Pitch coordinates are metres on a 105 x 68 pitch. `x=0` is the left goal
  line and `y=0` is the top touchline in the browser pitch view. Ball `z`
  is height above the surface in metres.
- `time_ms`, window bounds and cue bounds use elapsed match milliseconds,
  with `period` identifying the half. The sample runs from 27:00 to 28:00
  of period 1. Playback waits relative to `match.start_ms`.
- Each team's `attacking_direction` describes its direction in this period.
  A later multi-period fixture must specify direction per period.
- A tracking frame is a snapshot. A renderer may interpolate between frames;
  it must keep events and cues on the same match clock.
- IDs are stable within a match. Fact `event_ids` identify source events;
  cue `fact_ids` and `event_ids` carry the evidence trail into the browser.
- Cue `start_ms`/`end_ms` control display. `replay_start_ms`/
  `replay_end_ms` identify the evidence clip and may start earlier.
- Every independently exchanged payload carries `schema_version: "1.0.0"`.
  Breaking changes require a new version.

The Go loader also checks facts that JSON Schema cannot express across the
fixture: matching IDs and period, two opposite attacking directions,
chronological events and frames, complete player tracking, pitch bounds and
coverage of the complete replay window.
