# 0011: Replay-backed analytics and pitch overlays

Date: 2026-10-11

## Decision

Reuse the metrics/moments API from the reviewed G2 API work (PR #18), rather
than recalculate model values in the browser. Work is isolated on
`feat/replay-backed-analytics` before integration with main.

The Go page builder derives cumulative summary snapshots from source events
and the existing attacking-route series. The TypeScript island uses the same
replay clock for summaries, players, ball, metric ticks, moments and evidence.
Team names, ordering, directions, initials and time windows come from the
selected replay. Completed-pass shares are labelled as passes, not possession.

## Evidence and estimates

- Display the latest metric tick at or before the replay clock; never a future
  tick. Rewind restores prior metrics and removes future moments.
- Use the API's row-major, bottom-left grid and team ID in all three renderers.
  Heatmap cells are data overlays, not another independent simulation.
- Display tracking values as `model estimate, uncalibrated`. The experimental
  index and formation-sensitive control values are not accuracy claims.
- Keep tick-based CONTROL_SWING evidence separate from event-based evidence.
  Its empty `reasons` is deliberate; `contextEventIds` is not evidence.
- Moment clips run at 1x and stop at their source window end. Return to match
  restores the previous clock. Event/tick evidence buttons inspect source time.
- Unsupported tracking and API failures leave the replay usable with explicit
  unavailable values. Event-only set-piece moments still work on old fixtures.
- No shared schema, agent model, prompt or Go cue-gate change. Tick-derived
  facts and model-backed narration require the separate v2.1 contract work.

## Assigned issues

- #9: scores are not present in the replay contract. Render a neutral
  unavailable-score placeholder instead of inventing a 0:0 score or goal.
- #11: negotiate standard-library gzip on replay, insight and fact-pack JSON.
  Preserve `Vary: Accept-Encoding`, error statuses and cache/source headers.
  Metrics/moments retain their own cached gzip/ETag handling. Static files,
  health checks and future streaming endpoints are outside this middleware.
- #13: preserve true millisecond event scheduling independently of the 200 ms
  tracking grid. Tests shift a beat by 1 ms across three seeds, check unchanged
  tracking timestamps and verify event-to-arrival duration calculations.
  Quality reports count off-grid events and the maximum nearest-frame offset;
  they reject events outside coverage or more than 100 ms from a frame. A
  naturally grid-aligned event is valid, not proof of artificial quantisation.

## Measured Compression

Local Windows amd64, Go 1.27.1, Intel Core Ultra 7 155H, 500 ms benchmark per
case, `late-siege` replay, httptest recorder (not network or SSE latency):

| Encoding | Bytes/response | Mean ns/op | Allocated bytes/op |
|---|---:|---:|---:|
| Identity | 418,693 | 2,655,811 | 529,320 |
| gzip BestSpeed | 36,671 | 4,447,896 | 2,622,496 |

This run reduced response bytes by 91.2% with about 1.8 ms additional handler
time and higher allocations. Results depend on machine, fixture and load.
No brotli dependency was added. Live streaming is not implemented, so no
streaming benchmark or production-latency claim is made.

```powershell
go test ./app/internal/transport/http -run '^$' -bench BenchmarkReplayCompression -benchtime=500ms -benchmem
```

## Checks

Go tests cover summary counters, attacking totals, gzip negotiation, unchanged
JSON, compression exclusions and event timing. TypeScript strict checking
covers the island and all renderers. Browser tests check all five scenarios,
metric clock cutoffs, rewind, tick versus event evidence, bounded clips,
canvas pixel changes, unavailable/error states and desktop/mobile overflow.

The metrics model, moment thresholds and deterministic fixtures are unchanged.
The generator's reserved formation fields (issue #17), real agent calls,
Swahili review, SSE and Azure deployment remain separate work.
