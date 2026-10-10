# Deterministic scenario generator and 11v11 movement model

## Context and problem

The current fixture (`data/samples/first-sequence.json`) contains only 8 players (4v4), 9 sparse tracking frames across 60 seconds (up to 9 seconds between frames), and unphysical ball dynamics (a 36 m corner kick taking 6 seconds, averaging ~6 m/s). 

Phase 2 deliverables require:
- Coarse-grid pitch control calculations every 500 ms.
- Pressing intensity metrics measuring defender arrival within ~1.5 s.
- Pass Difficulty Rating (PDR) based on defensive pressure, trajectory, and interception risk.
- Tactical entropy and the Control vs Chaos index.

Computing these metrics on 4v4 sparse data is unviable. We require a deterministic scenario generator: script in, validated contract-v2 match out. Given the same script and seed, the generator must produce byte-identical JSON output with 22 players (11v11) and continuous tracking at exactly 200 ms cadence (5 Hz).

---

## 1. Script format (`data/scenarios/<name>.script.json`)

The script defines the macro narrative and tactical setup, leaving micro-physics, player kinematics, and tracking frames to the deterministic generator.

```json
{
  "schemaVersion": "2.0.0",
  "name": "late-siege",
  "matchId": "match-vale-bastion-siege",
  "seed": 42,
  "period": 2,
  "startMs": 5280000,
  "endMs": 5360000,
  "pitch": { "lengthM": 105.0, "widthM": 68.0 },
  "teams": [
    {
      "id": "vale",
      "name": "Aurora Vale",
      "attackingDirection": "RIGHT",
      "formation": "4-4-2",
      "lineHeightM": 68.0,
      "compactness": 0.85
    },
    {
      "id": "bastion",
      "name": "Bastion City",
      "attackingDirection": "LEFT",
      "formation": "4-4-2",
      "lineHeightM": 22.0,
      "compactness": 0.70
    }
  ],
  "players": [
    { "id": "vale-1", "teamId": "vale", "name": "Nia", "number": 1, "role": "GK", "slot": "GK" },
    { "id": "vale-2", "teamId": "vale", "name": "Kofi", "number": 2, "role": "DF", "slot": "RB" },
    { "id": "vale-3", "teamId": "vale", "name": "Musa", "number": 4, "role": "DF", "slot": "RCB" }
  ],
  "beats": [
    {
      "id": "beat-01",
      "kind": "PASS",
      "actorId": "vale-8",
      "recipientId": "vale-10",
      "target": { "x": 78.5, "y": 42.0 },
      "holdTimeMs": 600,
      "outcome": "COMPLETE"
    },
    {
      "id": "beat-02",
      "kind": "CARRY",
      "actorId": "vale-10",
      "target": { "x": 86.0, "y": 40.5 },
      "holdTimeMs": 200,
      "outcome": "COMPLETE"
    },
    {
      "id": "beat-03",
      "kind": "SHOT",
      "actorId": "vale-10",
      "target": { "x": 105.0, "y": 35.5 },
      "holdTimeMs": 400,
      "outcome": "BLOCKED"
    }
  ]
}
```

### Script elements
- **Formations**: Standard formations (`4-4-2`, `4-3-3`, `3-5-2`) define default relative anchor positions on a normalized $[0, 1] \times [0, 1]$ grid per team.
- **Line height**: Base horizontal position of the defensive line in metres from the team's defending goal line.
- **Beats**: Ordered actions using existing v2 event kinds (`PASS`, `CARRY`, `CROSS`, `CLEARANCE`, `CORNER`, `SHOT`).
- **Hold time**: Dwell duration before initiating the action, representing ball control, scanning, or setting up a pass/cross.

---

## 2. Movement and physics model

### Player kinematics
- **Formation anchors**: Base positions are assigned by formation slots mapped to team attacking direction and pitch dimensions ($105 \times 68\text{ m}$).
- **Dynamic shifts**:
  - Horizontal line shift: Formation anchors shift along $x$ in response to ball progression (attacking team pushes up to sustain pressure; defending team drops into a compact low or mid block).
  - Lateral shift: Teams shift toward the ball's $y$ coordinate to compress space on the active side of the pitch.
  - Role-specific attraction:
    - Ball carrier moves to maintain possession or carry toward target.
    - Designated receiver tracks the anticipated ball arrival point.
    - Closest defenders close down the ball carrier (pressing radius).
    - Off-ball players maintain tactical spacing relative to their dynamic anchors.
- **Kinematic limits**:
  - Sprint cap: $7.5\text{ m/s}$ is the data-quality limit checked on output. The generator clamps each player's final 200 ms step to $1.26\text{ m}$ ($6.3\text{ m/s}$) **after** repulsion, receiver anticipation and boundary clamping, so no later force can add displacement. Measured max on `late-siege.json`: $6.73\text{ m/s}$.
  - Speed derived from 1-dp coordinates can exceed the internal $6.3\text{ m/s}$ clamp by rounding alone, up to $(1.26 + 0.1\sqrt{2}) / 0.2 \approx 7.01\text{ m/s}$, still below the $7.5\text{ m/s}$ cap.
  - Maximum acceleration: $3.5\text{ m/s}^2$.
  - Maximum deceleration: $4.5\text{ m/s}^2$.
  - Spatial collision buffer: minimum $0.5\text{ m}$ separation between players, resolved by a deterministic repulsive potential field.
  - Temporal smoothing: Critically damped spring or exponential smoothing across 200 ms steps to eliminate twitching and discontinuous leaps.

### Ball kinematics and event timing
**Event start and duration times are strictly COMPUTED from physical distance and speed, never manually authored:**
- **Ground pass**: Speed range $12.0 - 20.0\text{ m/s}$ ($v_{\text{nom}} = 15.0\text{ m/s}$). Duration $\Delta t = \text{round\_to\_200ms}(\text{dist} / v)$. $z(t) = 0$.
- **Cross**: Speed range $18.0 - 25.0\text{ m/s}$ ($v_{\text{nom}} = 20.0\text{ m/s}$). Parabolic vertical trajectory:
  $$z(t) = 4 h_{\text{peak}} \frac{t}{\Delta t} \left(1 - \frac{t}{\Delta t}\right)$$
  with peak height $h_{\text{peak}} \in [2.5, 4.5]\text{ m}$.
- **Shot**: Speed range $22.0 - 30.0\text{ m/s}$ ($79 - 108\text{ km/h}$). Straight or low-arc trajectory.
- **Clearance**: Speed range $20.0 - 28.0\text{ m/s}$ with high clearance arc ($h_{\text{peak}} \in [4.0, 8.0]\text{ m}$).
- **Carry**: Ball locked with player position ($v \le 6.5\text{ m/s}$, $z = 0$).
- **Receiver synchronization**: The receiver begins moving toward the reception target early enough to arrive at $t_{\text{end}}$ without exceeding the $7.5\text{ m/s}$ sprint cap.

---

## 3. Output format and cadence

- **Schema compliance**: Output is a valid `contracts/schemas/replay-message.schema.json` match payload (containing `match`, `events`, `tracking`).
- **Cadence**: Frame interval is exactly $200\text{ ms}$ ($5\text{ Hz}$).
- **Coordinate precision**: Floats rounded to exactly 1 decimal place (`0.1 m` resolution).
- **Determinism**: 
  - Standard `math/rand` with an isolated, explicitly seeded `rand.New(rand.NewSource(seed))`.
  - Zero usage of `time.Now()` or global random state.
  - Deterministic entity iteration (all maps converted to sorted slices prior to simulation steps).
  - Byte-identical output on repeated runs across platforms.

---

---

## 4. Contract semantics, ONE `to` rule, and fixture fixes

### 4.1 ONE `to` rule for all event kinds
To ensure absolute semantic consistency across all 6 event kinds (`PASS`, `CARRY`, `CROSS`, `CLEARANCE`, `CORNER`, `SHOT`), ADR 0009 establishes **ONE universal rule for `to`**:
- `to` is strictly the **terminal physical coordinate where the ball action concludes** in that event's lifecycle.
  - `PASS`: reception point (if `COMPLETE`) or interception point (if `INCOMPLETE`).
  - `CARRY`: the final resting position of the carry where the carrier releases or stops the ball.
  - `CROSS` / `CORNER`: point of landing, clearance contact, or goalkeeper claim.
  - `CLEARANCE`: landing point or out-of-bounds boundary point.
  - `SHOT`: point of block contact (if `BLOCKED`), goalkeeper save coordinate, or the point where the ball crosses the goal line or touchline.
- **Ball at event end == `to` (to 1 decimal place, $\pm 0.1\text{ m}$)**: Across all kinds, the physical ball trajectory in tracking frames must arrive at `to` at event completion. There are no secondary fields (such as `blockedAt`) or divergent semantics per event kind.

### 4.2 Fixture fixes (`data/samples/first-sequence.json`)
The existing sample fixture contains historical inconsistencies that must be addressed under this standard:
1. **`evt-07` BLOCKED shot `to` target**:
   - In `first-sequence.json`, `evt-07` specifies `to: { "x": 105, "y": 37 }` (goal line) despite `outcome: "BLOCKED"` and tracking frame 1680000 showing the ball blocked by Bastion at `(98, 35)`. Under the ONE `to` rule, `evt-07`'s `to` must be corrected to `{ "x": 98, "y": 35 }`.
2. **Actor attribution in set-piece sequence**:
   - In `first-sequence.json`, `evt-06` (CORNER) is taken by Leni (`vale-4`) and received by Nia (`vale-1`), followed by `evt-07` (SHOT) by Nia (`vale-1`). Previous mockups erroneously captioned "Nia's delivery"; documentation, facts, and cues must strictly cite Leni as deliverer and Nia as shooter.
3. **Tracking frame cadence & unphysical ball flight**:
   - `first-sequence.json` has only 9 tracking frames across 60 seconds (up to 9s gaps). The corner kick in `evt-06` travels 36 m over 6 seconds (~6 m/s, unphysical for a corner kick). The new 11v11 scenario generator replaces this with continuous 200 ms (5 Hz) tracking and realistic physics ($18-25\text{ m/s}$).

### 4.3 PRESSURE non-circularity
- **Continuous kinematics vs discrete events**: Pressing intensity in Pulse is computed strictly and deterministically from continuous tracking player velocities and spatial proximity: an active defender closing within $1.5\text{ m}$ of a ball carrier at sprint velocity $\ge 3.0\text{ m/s}$ within $\sim 1.5\text{ s}$.
- **Non-circularity requirement**: Pressing metrics are **never** circularly inferred from discrete event tags or annotations. Event tags (e.g. `PRESSURE` or `TACKLE`) are outputs or discrete markers; the metrics engine computes pressing pressure from continuous tracking kinematics first. This preserves the core pipeline principle: **facts and deterministic physics first, event tags and LLMs second**.

---

## 5. Storylines evaluation and prioritization

### 1. Late Siege (Implemented in Stage 1)
- **Status**: Prioritized for immediate implementation.
- **Feasibility**: Uses **only** the six existing contract v2.0 event kinds (`PASS`, `CARRY`, `CROSS`, `CLEARANCE`, `CORNER`, `SHOT`).
- **Football arc**: Aurora Vale trailing or needing a goal in the 88th-90th minute. High line ($x \approx 68\text{ m}$), compact attacking presence around Bastion City's low block ($x \approx 20\text{ m}$). Sequence: sustained possession on the edge of the box -> blocked shot -> clearance -> recycled corner delivery -> header/volley on target.
- **Duration**: 75-90 seconds (~375-450 tracking frames, 22 players).

### 2. Pressing Trap and Counter-Attack (Deferred to v2.1)
- **Status**: Deferred.
- **Rationale**: A convincing pressing trap requires explicit tracking of pressing intensity triggers and immediate turnover recognition. Without `PRESSURE` and `POSSESSION_CHANGE` events in contract v2.0, the fact pack builder cannot accurately cite source events for pressing moments without fabricating intermediate proxy events.

### 3. Red-Card Tactical Swing (Deferred)
- **Status**: Deferred.
- **Rationale**: Requires modeling 10v11 structural deformation and card/whistle event types not present in v2.0. Prioritizing 11v11 late siege provides the highest value for Phase 2 metrics validation.

---

## 6. Implementation plan

- **Stage 1**: Generator in `app/internal/sim/` (pure package, no I/O) and CLI `app/cmd/gen/` (`-script`, `-seed`, `-out`). Author `late-siege.script.json` and generate `late-siege.json`. Keep existing authored scenarios intact.
- **Stage 2**: Data-quality validator in `app/internal/sim/quality/` and CLI. Verify pitch bounds, 200 ms spacing, speed/acceleration caps, actor proximity ($\le 1.5\text{ m}$), receiver arrival, separation ($\ge 0.5\text{ m}$), and contract validity. Unit tests proving failure on corrupted inputs.
- **Stage 3**: Pipeline integration. Verify `app/internal/loader`, `facts.CornerPacks`, cue gate, and web UI with the new 22-player 450-frame scenario. Add to scenario selector. Golden regression test in CI.
