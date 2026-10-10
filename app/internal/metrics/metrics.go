package metrics

import (
	"errors"

	"github.com/alexwafula/pulse/app/internal/domain"
)

// errNotImplemented marks Stage 1 stubs; removed by the implementation commits.
var errNotImplemented = errors.New("metrics: not implemented")

// PlayerState is one player at one tick. Positions are decimetres (exact
// multiples of 0.5 after interpolation); velocity is decimetres per second.
type PlayerState struct {
	ID     string
	TeamID string
	X, Y   float64
	VX, VY float64
}

// BallState is the ball at one tick, in decimetres.
type BallState struct {
	X, Y, Z float64
}

// Snapshot is everything the per-tick metrics need.
type Snapshot struct {
	Players []PlayerState
	Ball    BallState
}

// TeamSide identifies a team and the goal it attacks.
type TeamSide struct {
	ID           string
	AttacksRight bool
}

// Surface is the control grid for one tick. Control[k][i*Rows+j] is team k's
// control of the cell in column i, row j (column-major).
type Surface struct {
	Cols, Rows int
	Teams      [2]TeamSide
	Control    [2][]float64
}

// Share is the team's mean control over all cells.
func (s Surface) Share(team int) float64 { return 0 }

// FinalThird is the team's mean control over its attacking final third.
func (s Surface) FinalThird(team int) float64 { return 0 }

// Entropy is the mean normalised binary entropy of the surface, in [0, 1].
func (s Surface) Entropy() float64 { return 0 }

// ControlSurface computes time-to-reach control for every grid cell.
func ControlSurface(snap Snapshot, teams [2]TeamSide, p Params) Surface { return Surface{} }

// FindCarrier returns the ball carrier, if any (docs/metrics.md §4).
func FindCarrier(snap Snapshot, p Params) (PlayerState, bool) { return PlayerState{}, false }

// PressingIntensity is the chance that at least one opponent of the carrier
// can reach it within Pressing.ReachS.
func PressingIntensity(carrier PlayerState, snap Snapshot, p Params) float64 { return 0 }

// Carrier identifies the ball carrier at a tick.
type Carrier struct {
	PlayerID string `json:"playerId"`
	TeamID   string `json:"teamId"`
}

// Components are the Control vs Chaos index inputs for one team.
type Components struct {
	Share       float64  `json:"share"`
	FinalThird  float64  `json:"finalThird"`
	Structure   float64  `json:"structure"`
	Press       *float64 `json:"press"`
	ShotQuality *float64 `json:"shotQuality"`
}

// TeamTick holds one team's values at one tick.
type TeamTick struct {
	Share           float64    `json:"share"`
	FinalThird      float64    `json:"finalThird"`
	Index           float64    `json:"index"`
	IndexDelta      float64    `json:"indexDelta"`
	Components      Components `json:"components"`
	WeightsUsed     float64    `json:"weightsUsed"`
	PressHeldFromMS *int64     `json:"pressHeldFromMs,omitempty"`
}

// Tick holds all values at one 500 ms tick.
type Tick struct {
	TimeMS   int64               `json:"timeMs"`
	Teams    map[string]TeamTick `json:"teams"`
	Entropy  float64             `json:"entropy"`
	Carrier  *Carrier            `json:"carrier"`
	Pressing *float64            `json:"pressing"`
	Surface  *Surface            `json:"-"`
}

// Result is the full metrics output for one replay.
type Result struct {
	Model           string   `json:"model"`
	Label           string   `json:"label"`
	TrackingMetrics string   `json:"trackingMetrics"`
	Reason          string   `json:"reason,omitempty"`
	Teams           []string `json:"teams"`
	Params          Params   `json:"params"`
	Ticks           []Tick   `json:"ticks"`
}

// Compute runs every tracking metric over a replay. Replays without 5 Hz
// tracking return TrackingMetrics "unsupported" and no ticks.
func Compute(replay domain.Replay, p Params) (Result, error) {
	return Result{}, errNotImplemented
}

// Rounded returns a copy with every float rounded to dp decimals.
func (r Result) Rounded(dp int) Result { return r }
