# 0010: Metrics v1 and moment detection

Status: **Proposed (G2 Stage 0)**. Pipeline area only. No contract change.

## Context

Phase 2 needs deterministic metrics and moments on the 5 Hz `late-siege` replay (PR #8).
Agents may only cite facts that Go computed. So every metric must be:
- reproducible;
- documented ([docs/metrics.md](../metrics.md));
- labelled for what it is: `model: "time-to-reach-control-v1"`,
  `label: "model estimate, uncalibrated"`.

## Decisions

1. **One model, honestly named.** We use our own time-to-reach control (formula in
   docs/metrics.md §2), not a published model. We make no accuracy claims.
2. **Ticks.**
   - Every 500 ms from `startMs`.
   - Positions are interpolated linearly to the tick. Because 500 = 2.5 × 200, a tick always
     lies on a frame or exactly halfway between two, so the weight is 0 or 0.5.
   - Velocity is a central difference over 400 ms (`p(t±200)`, interpolated the same way),
     one-sided at the first and last tick.
   - Quantisation noise from 0.1 m rounding:
     - worst case 0.25 m/s per axis;
     - typical ~0.10 m/s;
     - worst-case effect on a cell's control ≤ 0.018 (docs/metrics.md §0).
3. **Integer-decimetre arithmetic.** Positions become `int64` decimetres before any maths.
   This makes the x-mirror (`1050 − x`) exact, which makes the mirror test bit-exact rather
   than tolerance-based.
4. **Unsupported, never invented.**
   - A replay whose frame gaps are not all 200 ms, or whose player set changes between frames,
     gets `supported: false` with a reason.
   - The authored 4v4 fixtures fall in this group.
   - `SET_PIECE_SHOT` is event-only and still runs on them.
5. **Carrier from tracking only:**
   - nearest player within 1.5 m of a ball at height ≤ 1.0 m, ties broken by ID;
   - otherwise `null`;
   - event tags are never used, which keeps pressing non-circular (ADR 0009, issue #10).
6. **Control vs Chaos index.**
   - Weights: share 0.35, final third 0.25, structure 0.20, press 0.20, shot quality 0.
   - Weights of null components are renormalised away.
   - Every component, weight and weight actually used is exposed.
7. **Moments.**
   - `SET_PIECE_SHOT`: reuse the `facts.CornerPacks` rule unchanged.
   - `SUSTAINED_PRESSURE`: final-third share ≥ 0.40 for 6 ticks AND ≥ 3 completed
     final-third actions in 15 s. Re-arm below 0.30 for 4 ticks, cooldown 30 s.
   - `CONTROL_SWING`: index rise ≥ 0.15 within 5 s. Re-arm when the index stays within ±0.05
     for 4 ticks, cooldown 20 s.
   - All thresholds are initial values in `metrics.Params.Moments`.
8. **Deferred:**
   - pass difficulty rating;
   - `PRESSING_TRAP` and `COUNTER_ATTACK` (v2.1);
   - shot-quality model.
9. **Packages.**
   - `app/internal/metrics` holds pure functions plus the single `Params` struct, including
     moment thresholds, so there is one config.
   - `app/internal/moments` holds the detectors.
   - The existing `app/internal/engine/metrics` (passing, attack routes) stays where it is.
     The HTTP handler imports the new package under an alias. Merging the two is out of scope.

## Tests (written before tuning, Stage 1)

All tests read `metrics.DefaultParams()`. Toy replays are built in code, not in files.

| # | Test | Assertion |
|---|---|---|
| T1 | Mirror-symmetric toy: team B's players are team A's mirrored in x, velocities negated, ball on the halfway line | share_A = share_B (bit-exact); share_A ∈ [0.5 − 1e-12, 0.5 + 1e-12] |
| T2 | Coincident toy: each B player on the same spot with the same velocity as an A player | every cell is exactly 0.5; entropy = 1 within 1e-15; shares 0.5 |
| T3 | Lone attacker at (80, 34), all 11 defenders beyond 40 m | control_A ≥ 0.9 in every cell within 5 m of the attacker |
| T4 | Property, all late-siege ticks plus the toys | 0 ≤ entropy ≤ 1; share_A + share_B = 1 within 1e-12; every cell in [0, 1] |
| T5 | Pressing: one defender 1 m from the carrier, closing at 6 m/s | intensity > 0.9 (expected 0.972) |
| T6 | Pressing: one defender 15 m away, standing still / closing at 6 m/s | intensity < 0.05 (expected 0.013 / 0.034) |
| T7 | Pressing: no player within 1.5 m of the ball, or ball z > 1.0 m | intensity is `null` |
| T8 | **Mirror:** late-siege, with teams' roles and `attackingDirection` swapped and x → 105 − x | every per-team value of team X equals the original for team X, bit for bit; entropy identical; same moments with the same reasons and ticks |
| T9 | **Late-siege bound** (stated now, see below) | mean finalThird_vale − mean finalThird_bastion ≥ **0.10** over the siege window |
| T10 | Unsupported: `corner`, `central`, `exchange` | `supported: false`; no metric values; `SET_PIECE_SHOT` still fires on `corner` |
| T11 | Calm fixture | `SUSTAINED_PRESSURE` does not fire (see decision D2) |
| T12 | Hysteresis: a synthetic share series that crosses 0.40 twice within 30 s | exactly one `SUSTAINED_PRESSURE` |
| T13 | Golden: late-siege per-tick output at 4 dp vs `app/testdata/metrics/late-siege.golden.json` | byte-identical; CI fails on drift |
| T14 | Determinism: compute twice, and once with players shuffled in every frame | identical bytes |
| T15 | API: `/api/metrics`, `/api/moments` for each scenario; unknown scenario | `model` and `label` present in every response; scenario routing as in `TestDemoHandler_ScenarioRouting`; unknown gives 404 |

**Siege window (T9).**
- Defined from events, not from metrics.
- It starts at the first vale event after which every vale event starts and ends at x ≥ 70.
  That is `evt-04` (5289695 ms, 73 → 72; `evt-03` starts at 68), so the first tick is 5290000.
- It ends at the last vale event, `evt-27` (5325317 ms), so the last tick is 5325000.
- The bound ≥ 0.10 is set from reasoning, before computing anything.
- If it fails, I will report the measured value and ask. I will not loosen it silently.

## Proposal only: metrics into the FactPack (not implemented)

- One `FactPack` per detected moment, using the existing `domain.FactPack` and `domain.Fact`
  unchanged.
- Facts: `control_share`, `final_third_control_share`, `tactical_entropy`,
  `pressing_intensity`, `control_chaos_index` and each index component. Values are rounded to
  2 dp, with `unit: "ratio"` and `teamId` set.
- Each fact's `timeStartMs`/`timeEndMs` is the tick span used.
- Each fact's `eventIds` lists the moment's reason events. Every fact therefore cites at
  least one source event, as the cue rules require.
- `attributes` holds `model`, `label`, `tickTimesMs` and the parameter values used. The
  Verifier can then check the numbers and the Narrator must keep the caveat.
- This needs agreement from the agents engineer before Stage 2 wires it in.

## API shape (Stage 2)

- `GET /api/metrics?scenario=<id>[&grid=1]` returns
  `{model, label, scenario, supported, reason?, params, ticks:[{timeMs, teams:{<id>:{share, finalThird, index, components, weightsUsed}}, entropy, carrier:{playerId,teamId}|null, pressing|null, grid?}]}`.
  The grid is a row-major `cols*rows` array of team-A control, included only with `grid=1`.
- `GET /api/moments?scenario=<id>` returns `{model, label, scenario, supported, moments:[{type, teamId, timeMs, windowStartMs, windowEndMs, reasons, tickTimesMs, values}]}`.
- An unknown scenario gives 404, which the existing demo router already does.
- An unsupported replay gives **200 with `supported: false`** (see decision D3).

## Decisions needed from you

- **D1. The entropy expectation was not quite right.** Mirror-symmetric positions give equal
  shares but **not** maximum entropy. Entropy is 1 only when every cell is exactly 50/50. I
  split that test into T1 (symmetric gives equal shares) and T2 (coincident players give
  entropy = 1). Accept?
- **D2. No calm 5 Hz fixture exists.** The authored fixtures are 4v4 and unsupported, so they
  can't fire anything; T11 on them would pass trivially. I propose adding
  `data/scenarios/calm-midfield.script.json` (generated with the PR #8 generator: midfield
  circulation, no final-third entries) and running T11 on it. Accept, or keep the trivial
  version?
- **D3. Unsupported replays:** 200 with `supported: false` (recommended: the UI can show
  "metrics unavailable"), or 422?
- **D4. The T9 bound** (≥ 0.10 difference over the siege window, as defined above): accept?
- **D5. Final-third actions** exclude shots and count only `COMPLETE` outcomes. Accept?
