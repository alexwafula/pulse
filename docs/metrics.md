# Pulse metrics v1

Every value on this page is a **model estimate, uncalibrated**. None of them has been fitted
or validated against real football. They describe the synthetic replay that produced them,
nothing more. API responses carry `model: "time-to-reach-control-v1"` and
`label: "model estimate, uncalibrated"`.

Status: **proposal (G2 Stage 0)**. No code exists yet. All parameters below are initial
values. Any change made to pass a test is recorded in
[ADR 0010](decisions/0010-metrics-and-moments.md). Measured outputs are added in Stage 2.

All parameters live in one Go struct, `metrics.Params` (`app/internal/metrics`), with
`metrics.DefaultParams()`. Tests read the struct and never repeat literals.

---

## 0. Inputs, ticks and support

| Item | Definition |
|---|---|
| Input | One contract-v2 `domain.Replay`: tracking frames, events, match teams and `attackingDirection` |
| Supported replay | Every consecutive frame gap is exactly 200 ms, and every frame contains the same player set as the first frame. Otherwise the whole replay is **unsupported** |
| Unsupported result | `supported: false` with a `reason`, and no metric values. The authored 4v4 fixtures (`corner`, `central`, `exchange`) are unsupported because their frames are 6-10 s apart |
| Tick | Every 500 ms from `match.startMs` up to and including `match.endMs`. `late-siege`: 5280000 to 5360000, so 161 ticks |
| Position at tick | Linear interpolation between the two frames that bracket the tick. A 500 ms tick either falls on a frame (`…000`) or exactly halfway between two frames (`…500`), so the weight is always 0 or 0.5 |
| Velocity at tick | Central difference over 400 ms: `v(t) = (p(t+200) - p(t-200)) / 0.4 s`, with `p` interpolated as above. At the first and last tick a one-sided 200 ms difference is used |
| Coordinates | Metres, pitch 105 x 68, origin bottom-left. Internally, positions are converted to integer decimetres (`round(x*10)`) before any arithmetic. This makes mirroring exact (see §8) |

### Velocity quantisation noise

Tracking coordinates are rounded to 0.1 m, so each coordinate carries an error of at most
±0.05 m (σ = 0.1/√12 ≈ 0.029 m if the error is uniform).

- **Worst case** for a 400 ms central difference: 0.1 m / 0.4 s = **0.25 m/s per axis**,
  0.35 m/s as a vector.
- **Typical** (independent uniform errors): σ ≈ 0.029·√2 / 0.4 ≈ **0.10 m/s per axis**.
- **Effect on pitch control** (worst case): the projected position `p + v·τ` moves by at most
  0.35 × 0.3 = 0.106 m. That changes `t_i` by at most 0.018 s. A cell's control changes by at
  most `2 × 0.018 / (4s)` ≈ **0.018**.
- At the one-sided boundary ticks, every figure above doubles.

---

## 1. Grid

| Parameter | Value | Unit |
|---|---|---|
| `Grid.Cols` x `Grid.Rows` | 21 x 14 (294 cells) | cells |
| Cell size | 105/21 = 5.0 by 68/14 ≈ 4.857 | m |
| Cell centre | `c(i,j) = ((i+0.5)·5.0, (j+0.5)·68/14)` | m |
| Final third | The 7 columns (35 m) nearest the opponent goal: columns 14-20 for a team attacking RIGHT, 0-6 for LEFT | cells |

---

## 2. Time-to-reach control ("time-to-reach-control-v1")

This is our own simple model, **not** a published pitch-control model.

For player *i* with position *p* and velocity *v* at the tick, and cell centre *c*:

```
t_i(c)    = τ + | c − (p + v·τ) | / v_max
t_team(c) = min over all players of the team (goalkeeper included) of t_i(c)
d(c)      = (t_B(c) − t_A(c)) / s
control_A(c) = 1 / (1 + exp(−d(c)))         control_B(c) = 1 − control_A(c)
```

| Parameter | Value | Unit | Meaning |
|---|---|---|---|
| `Control.TauS` (τ) | 0.3 | s | Reaction time; the player keeps moving at *v* during it |
| `Control.VMaxMS` (v_max) | 6.0 | m/s | Running speed after reaction |
| `Control.SigmaS` (s) | 0.5 | s | How sharply a time advantage turns into control |

- **Range:** each cell is within [0, 1], and control_A + control_B = 1 exactly in every cell.
  This is implemented as `u = 1/(1+exp(−|d|))` for the faster team and `1 − u` for the other.
  `1 − u` is exact for u in [0.5, 1].
- **Caveats:** no ball travel time, no player orientation, no acceleration limit, no
  difference between players. Every player has the same v_max. Off-pitch cells don't exist.

### 2.1 Control share

```
share_T       = mean over all 294 cells of control_T(c)
finalThird_T  = mean over the 98 cells of T's attacking final third of control_T(c)
```

Sums are formed as mirror-symmetric pairs, `Σ_{i<10} (C_i + C_{20−i}) + C_10`, where `C_i`
is the sum of column *i*. This makes the result exactly mirror-invariant (§8).

- **Range:** [0, 1]. share_A + share_B = 1 within 1e-12; floating-point summation is not
  exact.
- **Caveat:** `finalThird_A` and `finalThird_B` cover different cells (opposite ends of the
  pitch), so they do not sum to 1.

---

## 3. Tactical entropy

```
H(c)    = −[ u ln u + (1−u) ln(1−u) ] / ln 2      (0·ln 0 := 0, u = max(control_A, control_B))
entropy = mean over all cells of H(c), clamped to [0, 1]
```

- 0 means every cell is owned outright (fully structured). 1 means every cell is exactly 50/50
  (fully contested).
- **Caveat:** uncontested empty space far from everyone still scores high entropy if both
  teams are roughly equally far from it. Entropy measures how contested the space is, not
  where the action is.

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
t_j  = τ + | c_carrier − (p_j + v_j·τ) | / v_max            (same τ, v_max as §2)
p_j  = σ( (T − t_j) / w ),   σ(x) = 1/(1+e^{−x})
intensity = 1 − Π_j (1 − p_j)          (defenders taken in player-ID order)
```

| Parameter | Value | Unit |
|---|---|---|
| `Pressing.ReachS` (T) | 1.5 | s |
| `Pressing.WidthS` (w) | 0.3 | s |
| `Pressing.CarrierRadiusM` | 1.5 | m |
| `Pressing.CarrierMaxBallZM` | 1.0 | m |

- `1 − p_j` is computed directly as `σ(−x)` for precision.
- **Range:** [0, 1], or `null` when there is no carrier.
- **Worked values** (single defender):
  - 1 m away closing at 6 m/s gives t = 0.433 s and p ≈ 0.972.
  - 15 m away standing still gives t = 2.8 s and p ≈ 0.013.
  - 15 m away closing at 6 m/s gives t = 2.5 s and p ≈ 0.034.
- **Caveats:** this is the chance that at least one defender *can* reach the carrier within
  about 1.5 s, not whether anyone tries. It is unrelated to the discrete `PRESSURE` event type
  (see issue #10). The carrier's own movement is ignored.

---

## 5. Control vs Chaos index (from team T's side)

| Component | Value for team T | Default weight |
|---|---|---|
| `share` | share_T | `Index.WShare` = 0.35 |
| `finalThird` | finalThird_T | `Index.WFinalThird` = 0.25 |
| `structure` | 1 − entropy | `Index.WStructure` = 0.20 |
| `press` | If T has the carrier: 1 − intensity. If the opponent has it: intensity. Otherwise `null` | `Index.WPress` = 0.20 |
| `shotQuality` | Always `null` (no model yet) | `Index.WShotQuality` = **0** |

```
index_T = Σ_k w_k·x_k / Σ_k w_k        over components k whose value is not null
```

- **Range:** [0, 1].
- Every response exposes all components, their weights and the weights actually used.
  This lets the Explainer cite each one separately.
- **Caveats:**
  - The weights are a design choice, not fitted.
  - index_A + index_B is **not** 1, because structure is shared by both teams.
  - When `press` is null, the remaining weights are renormalised, which can step the index
    by itself. Every response reports `press: null` explicitly when that happens.

---

## 6. Moments

Every moment carries:
- `reasons`: source event IDs
- `tickTimesMs`: the ticks used
- `windowStartMs` and `windowEndMs`

| Type | Fires when | Reasons |
|---|---|---|
| `SET_PIECE_SHOT` | The existing rule in `facts.CornerPacks`: a COMPLETE corner, then a shot by the same team in the same phase within 12 s, with no other team touching the ball in between. Event-based; it also runs on unsupported (4v4) replays | `[cornerId, shotId]`, no ticks |
| `SUSTAINED_PRESSURE` | For team T: `finalThird_T ≥ OnShare` for `N` consecutive ticks, **and** at least `K` completed final-third actions by T in the `W` seconds ending at the last of those ticks | The action event IDs and the N tick times |
| `CONTROL_SWING` | For team T: `index_T(t) − min(index_T over [t − W, t]) ≥ Delta` | The events in `[t_min, t]` and the two tick times |

A **completed final-third action** is an event by T with `outcome = COMPLETE`, type PASS,
CARRY, CROSS or CORNER, and `to` inside T's attacking final third. Shots are excluded from K.

| Parameter (`Moments.*`) | Initial value |
|---|---|
| `Pressure.OnShare` | 0.40 |
| `Pressure.OffShare` (re-arm below) | 0.30 for 4 consecutive ticks |
| `Pressure.N` | 6 ticks (3 s) |
| `Pressure.K` / `Pressure.WindowS` | 3 actions / 15 s |
| `Pressure.CooldownS` | 30 s |
| `Swing.Delta` | 0.15 |
| `Swing.WindowS` | 5 s (10 ticks) |
| `Swing.RearmBand` | index stays within ±0.05 for 4 ticks |
| `Swing.CooldownS` | 20 s |

**Hysteresis:** after a moment fires for team T, the same type cannot fire again for T until
the re-arm condition holds **and** the cooldown has elapsed. One episode gives one moment.

**Deferred:**
- Pass difficulty rating (PDR): needs an interception model; not in v1.
- `PRESSING_TRAP` and `COUNTER_ATTACK`: contract v2.1.
- Shot quality: weight 0 until a model exists.

---

## 7. Determinism

- The metric code is pure: no I/O, no wall clock, no randomness.
- Explicit `float64()` around every compound `a*b+c`, matching the generator's FMA guard.
- Iteration over sorted player IDs and fixed cell order; no map-order dependence.
- A golden file `app/testdata/metrics/late-siege.golden.json` holds the per-tick output
  (4 dp). CI fails on any drift.

## 8. Mirror property

Swap the two teams' roles (A↔B, `attackingDirection` swapped) and flip `x → 105 − x` for
every player and the ball. Then every per-team metric of team A in the original must equal
the same metric of team A in the mirror **bit for bit**, and entropy must be identical.

This holds because:
- positions are integer decimetres, so `1050 − x` is exact;
- negation and `|·|` are exact in IEEE-754;
- the faster team always gets `u`;
- column sums are added as commutative mirror pairs;
- defenders are ordered by ID, not by side.

## 9. Measured outputs

To be filled in at Stage 2: per-scenario ranges, moment table, payload sizes, compute time.
