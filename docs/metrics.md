# Pulse metrics v1

Every value on this page is a **model estimate, uncalibrated**. None of them has been fitted
or validated against real football. They describe the synthetic replay that produced them,
nothing more. API responses carry `model: "time-to-reach-control-v1"` and
`label: "model estimate, uncalibrated"`.

Status: **proposal (G2 Stage 0, revised after review)**. No code exists yet. All parameters
below are initial values, chosen before any metric was computed. Any change made after a
run is logged with before/after values in
[ADR 0010](decisions/0010-metrics-and-moments.md#parameter-change-log). Measured outputs are
added in Stage 2.

All parameters live in one Go struct, `metrics.Params` (`app/internal/metrics`), with
`metrics.DefaultParams()`. Tests read the struct and never repeat literals.

---

## 0. Inputs, ticks and support

| Item | Definition |
|---|---|
| Input | One contract-v2 `domain.Replay`: tracking frames, events, match teams and `attackingDirection` |
| Tracking support | `trackingMetrics: "supported"` when every consecutive frame gap is exactly 200 ms and every frame contains the same player set as the first frame. Otherwise `trackingMetrics: "unsupported"` plus a `reason`, and no tracking-derived values at all |
| Unsupported replays | The authored 4v4 fixtures (`corner`, `central`, `exchange`) are unsupported because their frames are 6-10 s apart. Event-only moments (`SET_PIECE_SHOT`) are still detected and returned for them |
| Tick | Every 500 ms from `match.startMs` up to and including `match.endMs`. `late-siege`: 5280000 to 5360000, so 161 ticks |
| Position at tick | Linear interpolation between the two frames that bracket the tick. A 500 ms tick either falls on a frame (`…000`) or exactly halfway between two (`…500`), so the weight is always 0 or 0.5 |
| Velocity at tick | Central difference over 400 ms: `v(t) = (p(t+200) − p(t−200)) / 0.4 s`, with `p` interpolated as above. At the first and last tick a one-sided 200 ms difference is used |
| Coordinates | Metres, pitch 105 x 68, origin bottom-left. Internally, positions are converted to integer decimetres (`round(x*10)`) before any arithmetic, so the x-mirror `1050 − x` is exact (§8) |

### Velocity quantisation noise

Tracking coordinates are rounded to 0.1 m, so each coordinate carries an error of at most
±0.05 m (σ = 0.1/√12 ≈ 0.029 m if the error is uniform).

- **Worst case** for a 400 ms central difference: 0.1 m / 0.4 s = **0.25 m/s per axis**,
  0.35 m/s as a vector.
- **Typical** (independent uniform errors): σ ≈ 0.029·√2 / 0.4 ≈ **0.10 m/s per axis**.
- **Effect on pitch control** (worst case): the projected position moves by at most
  0.35 × 0.3 = 0.106 m. That changes `t_i` by at most 0.018 s. A cell's control changes by at
  most `0.25 × 2 × 0.018 / s` ≈ **0.018**.
- At the one-sided boundary ticks, every figure above doubles.

---

## 1. Grid

| Parameter | Value | Unit |
|---|---|---|
| `Grid.Cols` x `Grid.Rows` | 21 x 14 (294 cells) | cells |
| Cell size | 105/21 = 5.0 by 68/14 ≈ 4.857 | m |
| Cell centre | `cx(i) = 25 + 50·i` dm (an exact integer); `cy(j) = (j+0.5)·680/14` dm | dm |
| Final third | The 7 columns (35 m) nearest the opponent goal: columns 14-20 for a team attacking RIGHT, 0-6 for LEFT | cells |

---

## 2. Time-to-reach control ("time-to-reach-control-v1")

This is our own simple model, **not** a published pitch-control model.

For player *i* with position *p* and velocity *v* at the tick, and cell centre *c*:

```
t_i(c)    = τ + | c − (p + v·τ) | / v_max            (mathematical form)
t_team(c) = min over all players of the team (goalkeeper included) of t_i(c)
```

**Exact evaluation order.** This is required for the bit-exact mirror test (§8):

```
dx = float64(cx − px) − float64(vx·τ)        // (c − p) − v·τ ; NEVER c − (p + v·τ)
dy = float64(cy − py) − float64(vy·τ)
t_i = τ + math.Hypot(dx, dy) / v_max
d   = |t_B − t_A| / s
u   = 1 / (1 + exp(−d))                      // u ∈ [0.5, 1]
control(faster team) = u ;  control(other team) = 1 − u      // exact for u ∈ [0.5, 1]
```

- `cx − px` is an exact integer subtraction. Mirroring negates it exactly, and IEEE
  round-to-nearest is sign-symmetric, so mirrored `dx` is exactly `−dx`.
- `c − (p + v·τ)` would round `p + v·τ` first, at a different magnitude after the mirror,
  and break exactness.
- If `t_A == t_B`, both teams get exactly 0.5.

| Parameter | Value | Unit | Meaning |
|---|---|---|---|
| `Control.TauS` (τ) | 0.3 | s | Reaction time; the player keeps moving at *v* during it |
| `Control.VMaxMS` (v_max) | 6.0 | m/s | Running speed after reaction |
| `Control.SigmaS` (s) | 0.5 | s | How sharply a time advantage turns into control |

`v_max` = 6.0 m/s is deliberately below the generator's 7.5 m/s data-quality cap. The model
has no acceleration phase, so 6.0 stands for the average speed over a ~1-2 s run, not a
peak sprint.

- **Range:** each cell is within [0, 1], and the two teams' control sums to 1 exactly in
  every cell.
- **Caveats:** no ball travel time, no player orientation, no acceleration limit, no
  difference between players. Every player has the same v_max.

### 2.1 Control share

```
share_T       = (Σ over all cells of control_T) / 294
finalThird_T  = (Σ over the 98 cells of T's attacking final third of control_T) / 98
```

**Summation order** (required for §8):
- `C_i` is the sum over rows `j = 0..13`, in that order, of column *i*.
- Full pitch (shares and entropy): `Σ_{i=0..9} (C_i + C_{20−i}) + C_10`. IEEE addition is
  commutative, so each mirrored pair sums identically.
- Final third: columns are added **from the goal line outward**, for both attack directions.
  RIGHT: `C_20 + C_19 + … + C_14`. LEFT: `C_0 + C_1 + … + C_6`. The mirror then visits
  identical values in identical order.

- **Range:** [0, 1]. share_A + share_B = 1 within 1e-12; floating-point summation is not
  exact.
- **Caveat:** `finalThird_A` and `finalThird_B` cover different cells (opposite ends of the
  pitch). They do not sum to 1, and **they must not be compared across teams**. Geometry
  alone (where the empty space is) can make one larger. Compare a team's finalThird only
  with itself over time.

---

## 3. Tactical entropy

```
H(c)    = −[ u ln u + (1−u) ln(1−u) ] / ln 2      (0·ln 0 := 0; u as in §2)
entropy = (pair-ordered sum of H(c), §2.1) / 294, clamped to [0, 1]
```

- 0 means every cell is owned outright (fully structured). 1 means every cell is exactly 50/50
  (fully contested).
- **Caveat:** uncontested empty space far from everyone still scores high entropy if both
  teams are roughly equally far from it. Entropy measures how contested the space is, not
  where the action is.
- Entropy is shared by both teams. This is why `CONTROL_SWING` works on the index
  difference (§6).

---

## 4. Pressing intensity at the ball carrier

**Carrier, from tracking only (never from event tags):**
1. The player nearest the ball, if within `Pressing.CarrierRadiusM` = 1.5 m and with ball
   `z ≤ Pressing.CarrierMaxBallZM` = 1.0 m.
2. Ties are broken by player ID.
3. If no player qualifies (ball in flight or loose), there is **no carrier** and the value is
   `null`.

The carrier's team is in possession. Every player of the other team is a defender.

```
dx, dy as in §2 with c = carrier position:  (c − p_j) − v_j·τ
t_j  = τ + hypot(dx, dy) / v_max
x_j  = (T − t_j) / w
p_j  = σ(x_j);   1 − p_j computed directly as σ(−x_j)
intensity = 1 − Π_j σ(−x_j)              (defenders multiplied in player-ID order)
```

| Parameter | Value | Unit |
|---|---|---|
| `Pressing.ReachS` (T) | 1.5 | s |
| `Pressing.WidthS` (w) | 0.3 | s |
| `Pressing.CarrierRadiusM` | 1.5 | m |
| `Pressing.CarrierMaxBallZM` | 1.0 | m |

- **Range:** [0, 1], or `null` when there is no carrier.

**Worked values** (hand-calculated; Stage 1 tests assert them):

| Defenders | t_j | p_j | Intensity |
|---|---|---|---|
| 1 at 1 m, closing at 6 m/s | 0.433 s | 0.972 | 0.972 |
| 1 at 15 m, standing | 2.8 s | 0.013 | 0.013 |
| 1 at 15 m, closing at 6 m/s | 2.5 s | 0.034 | 0.034 |
| **10 at 15 m, standing** | 2.8 s | 0.013 each | **≈ 0.122** |
| **10 at 15 m, closing at 6 m/s** | 2.5 s | 0.034 each | **≈ 0.295** |

**Caveats:**
- This is the chance that at least one defender *can* reach the carrier within about 1.5 s,
  not whether anyone tries.
- **It accumulates with defender count.** The product treats defenders as independent. Ten
  defenders, none of whom can reach the carrier in time, still read as ~0.12 standing or
  ~0.30 closing. A compact low block therefore shows "pressure" even when no one is pressing.
  The value is comparable across ticks of one match, not as an absolute level.
- It is unrelated to the discrete `PRESSURE` event type (issue #10).
- The carrier's own movement is ignored.

---

## 5. Control vs Chaos index (from team T's side)

| Component | Value for team T | Default weight |
|---|---|---|
| `share` | share_T | `Index.WShare` = 0.35 |
| `finalThird` | finalThird_T | `Index.WFinalThird` = 0.25 |
| `structure` | 1 − entropy | `Index.WStructure` = 0.20 |
| `press` | If T has the carrier: 1 − intensity. If the opponent has it: intensity. If there is no carrier: the **held** value (below), or `null` | `Index.WPress` = 0.20 |
| `shotQuality` | Always `null` (no model yet) | `Index.WShotQuality` = **0** |

```
index_T = Σ_k w_k·x_k / Σ_k w_k        over components k whose value is not null, in table order
```

**Press hold.**
- When there is no carrier, `press` keeps the last non-null value for up to
  `Index.PressHoldS` = 2.0 s (4 ticks), and the response sets `pressHeldFromMs`.
- After 2 s without a carrier, `press` becomes `null` and the weights are renormalised.
- The raw `pressing` intensity output is **never** held; it stays `null` while the ball is in
  flight.
- Before the first carrier of the replay, `press` is `null`.
- Why hold rather than a median filter: see ADR 0010, decision 6.

- **Range:** [0, 1].
- Every response exposes all components, their weights, the weights actually used, and
  `pressHeldFromMs` when it applies.
- **Caveats:**
  - The weights are a design choice, not fitted.
  - index_A + index_B is **not** 1, because structure is shared by both teams.
  - The finalThird component compares different cells per team (§2.1).
  - A ball in flight for more than 2 s (long clearances) still steps the index through
    renormalisation. That step is flagged by `press: null`.

---

## 6. Moments

Every moment carries:
- `reasons`: source event IDs
- `tickTimesMs`: the ticks used
- `windowStartMs` and `windowEndMs`

| Type | Fires when | Reasons |
|---|---|---|
| `SET_PIECE_SHOT` | The existing rule in `facts.CornerPacks`: a COMPLETE corner, then a shot by the same team in the same phase within 12 s, with no other team touching the ball in between. Event-only, so it also runs on unsupported replays | `[cornerId, shotId]`, no ticks |
| `SUSTAINED_PRESSURE` | For team T: `finalThird_T ≥ OnShare` for `N` consecutive ticks, **and** at least `K` completed final-third actions by T in the `W` seconds ending at the last of those ticks | The K-window action event IDs and the N tick times |
| `CONTROL_SWING` | For team T, on the **difference** `Δ_T = index_T − index_opp`: `Δ_T(t) − min(Δ_T over [t − W, t]) ≥ Delta` | The events whose `timeMs` lies in `[t_min, t]` (empty list allowed, see ADR 0010 decision 10) and the two tick times |

**Completed final-third action:** an event by T with `outcome = COMPLETE`, type PASS, CARRY,
CROSS or CORNER, and `to` inside T's attacking final third. Shots are excluded.

**Swing details:**
- `Δ_opp = −Δ_T` exactly (IEEE subtraction is anti-symmetric), so only **rises** are
  detected. A swing toward T fires once, for T.
- The shared `structure` term cancels in the difference.

| Parameter (`Moments.*`) | Initial value |
|---|---|
| `Pressure.OnShare` | 0.40 |
| `Pressure.OffShare` (re-arm below) | 0.30 for 4 consecutive ticks |
| `Pressure.N` | 6 ticks (3 s) |
| `Pressure.K` / `Pressure.WindowS` | 3 actions / 15 s |
| `Pressure.CooldownS` | 30 s |
| `Swing.Delta` (on Δ_T, range [−1, 1]) | 0.30 |
| `Swing.WindowS` | 5 s (10 ticks) |
| `Swing.RearmBand` | max − min of Δ_T over 4 consecutive ticks ≤ 0.10 (it has settled, at any level) |
| `Swing.CooldownS` | 20 s |

`Swing.Delta` and `RearmBand` are double the earlier 0.15 / ±0.05. The difference moves
about twice as fast as a single index: for example `share_T − share_opp = 2·share_T − 1`.
This was set before any run (ADR 0010, decision 7).

**Hysteresis:** after a moment fires for team T, the same type cannot fire again for T until
the re-arm condition holds **and** the cooldown has elapsed. One episode gives one moment.

**Deferred:**
- Pass difficulty rating (PDR): needs an interception model; not in v1.
- `PRESSING_TRAP` and `COUNTER_ATTACK`: contract v2.1.
- Shot quality: weight 0 until a model exists.

---

## 7. Determinism

- The metric code is pure: no I/O, no wall clock, no randomness.
- Explicit `float64()` around every compound `a*b+c`, matching the generator's guard against
  fused multiply-add.
- Iteration over sorted player IDs and fixed cell order; no map-order dependence.
- A golden file `app/testdata/metrics/late-siege.golden.json` holds the per-tick output
  (4 dp). CI fails on any drift.
- **Cross-architecture (unverified):** Go's `math.Exp`, `math.Log` and `math.Hypot` may
  use architecture-specific implementations that can differ in the last bit between amd64
  and arm64. Rounding to 4 dp hides most such differences, but not values sitting on a
  rounding boundary. The golden file must be checked once on both amd64 and arm64 before we
  rely on it across machines. The mirror test (§8) compares two runs on the same machine and
  is unaffected.

## 8. Mirror property

Swap the two teams' roles (A↔B, `attackingDirection` swapped) and flip `x → 105 − x` for
every player and the ball. Then every per-team metric of team A in the original must equal
the same metric of team A in the mirror **bit for bit**, entropy must be identical, and the
same moments must fire with the same reasons and ticks.

This holds because:
- positions are integer decimetres, so `1050 − x` is exact;
- offsets are evaluated as `(c − p) − v·τ` (§2);
- negation, `|·|`, `min` and `hypot` of a negated argument are exact;
- the faster team always gets `u`;
- full-pitch sums use commutative mirror pairs;
- final-third sums run from the goal line outward (§2.1);
- defenders are ordered by ID, not by side.

## 9. Measured outputs

To be filled in at Stage 2: per-scenario ranges, moment table, payload sizes, compute time.
