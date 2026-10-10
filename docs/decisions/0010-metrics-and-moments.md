# 0010: Metrics v1 and moment detection

Status: **Proposed (G2 Stage 0, revised after first review)**. Pipeline area only. No
contract change.

## Context

Phase 2 needs deterministic metrics and moments on the 5 Hz `late-siege` replay (PR #8).
Agents may only cite facts that Go computed. So every metric must be:
- reproducible;
- documented ([docs/metrics.md](../metrics.md));
- labelled for what it is: `model: "time-to-reach-control-v1"`,
  `label: "model estimate, uncalibrated"`.

## Decisions

1. **One model, honestly named.** We use our own time-to-reach control (docs/metrics.md §2),
   not a published model. We make no accuracy claims.
2. **Ticks.**
   - Every 500 ms from `startMs`.
   - Positions are interpolated linearly to the tick (weight always 0 or 0.5).
   - Velocity is a central difference over 400 ms, one-sided at the first and last tick.
   - Quantisation noise from 0.1 m rounding:
     - worst case 0.25 m/s per axis;
     - typical ~0.10 m/s;
     - worst-case effect on a cell's control ≤ 0.018.
3. **Bit-exact mirror by construction.**
   - Integer-decimetre positions.
   - Offsets evaluated as `(c − p) − v·τ`, never `c − (p + v·τ)`.
   - Full-pitch sums in commutative mirror pairs.
   - Final-third column sums from the goal line outward, for both attack directions.
   - Exact rules in docs/metrics.md §2, §2.1 and §8.
4. **Tracking support flag.**
   - Every metrics and moments response has `trackingMetrics: "supported" | "unsupported"`,
     plus `reason` when unsupported.
   - Unsupported replays get HTTP 200, no tracking-derived values, and their event-only
     moments (`SET_PIECE_SHOT`).
5. **Carrier from tracking only:**
   - nearest player within 1.5 m of a ball at height ≤ 1.0 m, ties broken by ID;
   - otherwise `null`;
   - event tags are never used, which keeps pressing non-circular (ADR 0009, issue #10).
6. **Ball in flight: hold `press` for up to 2 s (chosen over a 3-tick median).**
   - **Why:** a 30 m ground pass at the 15 m/s nominal speed takes 2 s, so the ball is
     carrier-less for 4 ticks. A 3-tick median only removes isolated 1-tick gaps, so it
     would not fix the common case (passes and crosses of 2-4 ticks). It would also delay
     every real swing by one tick.
   - Holding covers passes up to ~30 m at nominal speed and crosses up to ~40 m at
     20 m/s. It touches only the index's `press` component.
   - The raw `pressing` output stays `null`, so nothing is invented.
   - Every held value is flagged with `pressHeldFromMs`.
   - After 2 s the weights renormalise and the step is visible as `press: null`. This
     residual case (long clearances) is a known limitation.
7. **`CONTROL_SWING` on `Δ_T = index_T − index_opp`.**
   - The shared `structure` term cancels, and `Δ_opp = −Δ_T` exactly, so detecting rises
     only fires once per swing.
   - `Delta` is 0.30 and the re-arm range is 0.10, both double the first proposal, because
     the difference moves about twice as fast as a single index.
   - Set before any run.
8. **Final-third actions** count `COMPLETE` PASS, CARRY, CROSS and CORNER events whose `to`
   lies in the team's attacking third. Shots are excluded (D5).
9. **finalThird is never compared across teams.** The two teams' final thirds are
   different cells, so a cross-team difference could pass on geometry alone. Tests compare a
   team only with itself over time (T9).
10. **Evidence for tick-derived values.**
    - The schema requires `eventIds` with `minItems: 1`. Shares, entropy, pressing and the
      index come from ticks, not events.
    - They must not cite unrelated action events just to satisfy the schema.
    - `CONTROL_SWING.reasons` is always `[]`. Its evidence is `tickTimesMs` and `values`.
      Events inside the swing window go to a separate `contextEventIds` field, documented
      as **not evidence** (PR #16 review). Agents and the Verifier must never cite them.
    - See the FactPack proposal and contract item C1 below.
11. **Deferred:**
    - pass difficulty rating;
    - `PRESSING_TRAP` and `COUNTER_ATTACK` (v2.1);
    - shot-quality model.
12. **Packages.**
    - `app/internal/metrics` holds pure functions plus the single `Params` struct, including
      moment thresholds.
    - `app/internal/moments` holds the detectors.
    - The existing `app/internal/engine/metrics` (passing, attack routes) is untouched. The
      handler imports the new package under an alias.

## Calm-midfield fixture (D2): expected outcome, written before generating

Script `data/scenarios/calm-midfield.script.json`, generated with the PR #8 generator and
the shared squad:
- period 1, 60 s, seed 7;
- vale in possession throughout, circulating with ground passes and carries;
- every event `from.x` and `to.x` within [35, 65], which is outside both final thirds;
- no shot, cross, corner, clearance or possession change;
- bastion holds a mid-block.

**Expected before any metric is computed:**
- **No moment of any type fires**: no `SET_PIECE_SHOT`, no `SUSTAINED_PRESSURE` for either
  team, no `CONTROL_SWING` for either team.
- Mechanism expected for `SUSTAINED_PRESSURE`: zero completed final-third actions, so the K
  condition (≥ 3) cannot hold, whatever the shares do. If it fires anyway, that is a bug.
- The script is not changed after the first metric run to make T11 pass. If T11 fails, I
  report and ask.

The scenario is registered in the demo router and added to `TestDemoHandler_ScenarioRouting`.
`/api/insights?scenario=calm-midfield` must return its own `matchId` and zero cues, since
it contains no corner.

## Tests (written before tuning, Stage 1)

All tests read `metrics.DefaultParams()`. Toy replays are built in code.

| # | Test | Assertion |
|---|---|---|
| T1 | Mirror-symmetric toy: B is A mirrored in x, velocities negated, ball on the halfway line | share_A = share_B (bit-exact); \|share_A − 0.5\| ≤ 1e-12 |
| T2 | Coincident toy: each B player on the same spot with the same velocity as an A player | every cell is exactly 0.5; \|entropy − 1\| ≤ 1e-15; shares 0.5 |
| T3 | Lone attacker at (80, 34), all defenders beyond 40 m | control_A ≥ 0.9 in every cell within 5 m of the attacker |
| T4 | Property: all late-siege and calm-midfield ticks plus the toys | 0 ≤ entropy ≤ 1; \|share_A + share_B − 1\| ≤ 1e-12; every cell in [0, 1] |
| T5 | One defender 1 m from the carrier, closing at 6 m/s | intensity > 0.9 (hand value 0.972) |
| T6 | One defender 15 m away, standing / closing at 6 m/s | intensity < 0.05 (0.013 / 0.034) |
| T6b | **Ten defenders at 15 m**, standing / closing at 6 m/s | intensity ∈ [0.11, 0.14] / [0.27, 0.32] (0.122 / 0.296). This documents accumulation |
| T7 | No player within 1.5 m of the ball, or ball z > 1.0 m | `pressing` is `null`; index `press` is held up to 2 s with `pressHeldFromMs`, then `null` |
| T8 | **Mirror:** late-siege and calm-midfield, roles and `attackingDirection` swapped, x → 105 − x | every per-team value of team X equals the original for team X bit for bit; entropy identical; same moments, reasons and ticks |
| T9a | **Late-siege, within-team contrast** | mean finalThird_vale over the siege window [5290000, 5325000] − mean finalThird_vale over the pre-siege window [5280000, 5289500] **≥ 0.10** |
| T9b | **Late-siege moments** | `SUSTAINED_PRESSURE` fires for vale with `timeMs` inside [5290000, 5325000], and never for bastion anywhere in the replay |
| T10 | Unsupported: `corner`, `central`, `exchange` | `trackingMetrics: "unsupported"` with a `reason`; no tracking values; `SET_PIECE_SHOT` returned for `corner` |
| T11 | Calm-midfield | no `SUSTAINED_PRESSURE` and no `CONTROL_SWING` for either team (and no moment at all, per the expected outcome above) |
| T12 | Hysteresis: synthetic series crossing the thresholds twice inside the cooldown | exactly one `SUSTAINED_PRESSURE` / one `CONTROL_SWING` |
| T13 | Golden: late-siege per-tick output at 4 dp vs `app/testdata/metrics/late-siege.golden.json` | byte-identical; CI fails on drift |
| T14 | Determinism: compute twice, and once with players shuffled in every frame | identical bytes |
| T15 | API: `/api/metrics` and `/api/moments` for every scenario including calm-midfield; unknown scenario | `model`, `label` and `trackingMetrics` in every response; routing as in `TestDemoHandler_ScenarioRouting`; unknown gives 404 |

**T9 windows.**
- Both windows are defined from events, not metrics.
- The siege window starts at the first vale event after which every vale event starts and
  ends at x ≥ 70: `evt-04` (5289695 ms), first tick 5290000. It ends at the last vale event,
  `evt-27` (5325317 ms), last tick 5325000.
- The pre-siege window is every tick before that: 5280000-5289500, 20 ticks.
- Both bounds (T9a ≥ 0.10, T9b) are stated before computing anything.
- If either fails, I report the measured value and ask. Neither the bound nor the windows
  will be changed silently.

## Proposal only: metrics into the FactPack (not implemented)

Rule: **a fact cites only events that are actually its inputs.**

- **Event-derived facts can go in now, under v2.**
  - `set_piece_shots` cites `[corner, shot]`.
  - `final_third_actions` (the K count behind `SUSTAINED_PRESSURE`) cites exactly those K
    actions.
- **Tick-derived facts wait for v2.1.**
  - Covers `control_share`, `final_third_control_share`, `tactical_entropy`,
    `pressing_intensity`, `control_chaos_index` and the index components.
  - Under v2 they would need `eventIds` of at least 1 item, and citing nearby passes as
    evidence for a share value would be false provenance. So they stay out of FactPacks.
  - Until then the UI may show them as data-only values with the uncalibrated label.
- **Contract item C1 (for you and the agents engineer; v2.1, not changed here):** a "tick
  evidence kind" for facts. For example, an evidence entry of kind `TICK` with
  `tickTimesMs`, `model` and `paramsHash`, accepted instead of `eventIds` for tick-derived
  metrics. The Verifier then checks values against recomputed ticks. `contracts/` is not
  touched in G2.
- `attributes` (already in v2) carries `model` and `label` on every metrics-related fact.

## API shape (Stage 2)

- `GET /api/metrics?scenario=<id>[&grid=1]` returns
  `{model, label, scenario, trackingMetrics, reason?, params, ticks:[{timeMs, teams:{<id>:{share, finalThird, index, components, weightsUsed, pressHeldFromMs?}}, entropy, carrier:{playerId,teamId}|null, pressing|null, grid?}]}`.
  - The grid (row-major `cols*rows`, team-A control) is included only with `grid=1`.
  - On an unsupported replay, `ticks` is `[]`.
- `GET /api/moments?scenario=<id>` returns
  `{model, label, scenario, trackingMetrics, reason?, moments:[{type, teamId, timeMs, windowStartMs, windowEndMs, evidenceKind, reasons, contextEventIds, tickTimesMs, values}]}`.
  - Unsupported replays still return their `SET_PIECE_SHOT` moments.
- An unknown scenario gives 404 (existing demo router).

## Limitations

- **Thresholds are set against two fixtures only** (`late-siege` and `calm-midfield`), both
  generated by our own generator. Passing on them shows the detectors separate those two
  scripted stories. It says nothing about general football.
- **Every post-run change to a parameter, threshold, window or fixture gets a before/after
  line** in the change log below, with the reason and the measured value that prompted it.
- Pressing intensity accumulates with defender count (docs/metrics.md §4). Low blocks read as
  moderate pressure.
- A ball in flight longer than 2 s still steps the index through renormalisation (flagged).
- Cross-architecture bit equality of `math.Exp`/`math.Log`/`math.Hypot` is **unverified**.
  The golden file must be checked once on amd64 and once on arm64.

## Stage 1 implementation notes

- **Routing registration deferred to Stage 2.** Stage 1 has no API, so calm-midfield is not
  yet in the demo router or `TestDemoHandler_ScenarioRouting`. That moves to Stage 2 with T15.
- **The generator does not build a mid-block.** `sim/formations.go` and
  `computePlayerTargetPos` use fixed templates: the team attacking RIGHT (vale) keeps its back
  line at x ≈ 64-66 and forwards at x ≥ 86, and the team attacking LEFT (bastion) holds its
  defensive line near x ≈ 88.
  `lineHeightM`/`compactness` in the script are never read. So the spec item "bastion holds a
  mid-block" is **not met**, and vale's share stays above 0.70 in calm-midfield too. The
  generator was not changed: that is out of scope and would change the late-siege bytes.
  Tracked in **issue #17**. Both committed scripts set the fields (late-siege: vale 68.0/0.85,
  bastion 22.0/0.70), so implementing or rejecting them must keep late-siege byte-identical.
- **checkdata and calm-midfield (resolved in the PR #16 fix pass).** Scripts may set
  `expect.minShots` (default 1). Only calm-midfield sets 0, and checkdata prints "shot rule
  waived by script" when it applies. A script without the field still fails on zero shots
  (`TestShotRule_ScriptExpectation`). `scripts/check.sh` now runs checkdata over every
  generated scenario in `data/scenarios`.
- **checkdata rejects calm-midfield.** `sim/quality.go` requires at least one shot
  (`insane shot count: 0 (expected at least 1)`). The calm spec forbids shots. The checker
  was not weakened. With only that rule skipped locally (not committed), every physical check
  passed: 301 frames at 200 ms, max player speed 6.80 m/s, max ball 15.14 m/s, min player
  distance 0.61 m. This needs a decision (see the PR).
- **T8 passed bit-exact on the first run**; no tolerance was added and no evaluation-order fix
  was needed.
- **Golden file** generated on amd64 only; arm64 is unchecked.

### Recorded limitations (PR #16 review)

1. **Swing count is fragile.** The late-siege CONTROL_SWING signals are 0.3026 and 0.3148
   against `Swing.Delta` = 0.30 (margins 0.0026 / 0.0148). The number of swings on this
   replay can change with small input changes; it is not asserted by any test.
2. **Pressing is unverified in the mid-range on real fixtures.** Hand-checked values are
   toys (T5, T6, T6b). late-siege has 25 of 68 non-null ticks in [0.2, 0.8), none checked
   independently; calm-midfield peaks at 0.0081.
3. **Absolute shares reflect formation geometry** because the generator ignores
   `lineHeightM`/`compactness` (issue #17). **Shares must not be shown as headline
   numbers**; use them only as within-team change over time, with the uncalibrated label.

## Parameter change log

Initial values are those in docs/metrics.md as of this ADR. Every later change gets a line.

| Date | Parameter | Before | After | Reason | Measured value that prompted it |
|---|---|---|---|---|---|
| 2026-10-10 (pre-run, review) | `Swing` input | index_T | index_T − index_opp | `structure` is shared by both teams (review change 2) | none (no run yet) |
| 2026-10-10 (pre-run, review) | `Swing.Delta` / re-arm range | 0.15 / ±0.05 | 0.30 / 0.10 | rescaled for the difference signal | none (no run yet) |
| 2026-10-10 (pre-run, review) | T9 | cross-team finalThird difference ≥ 0.10 | within-team siege vs pre-siege ≥ 0.10, plus T9b | cross-team comparison passes on geometry (review change 1) | none (no run yet) |
| 2026-10-10 (Stage 1, first run) | none | all ADR values | unchanged | T1-T14 passed on the first run | T9a difference 0.2239; T9b vale SUSTAINED_PRESSURE at 5291500, none for bastion |

## Decisions resolved

- D1 accepted (T1/T2 split).
- D2 accepted (calm-midfield, expected outcome above).
- D3 accepted as 200 with `trackingMetrics` + `reason`.
- D4 replaced by T9a/T9b.
- D5 accepted.
