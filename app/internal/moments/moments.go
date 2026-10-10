// Package moments detects SET_PIECE_SHOT, SUSTAINED_PRESSURE and
// CONTROL_SWING moments from events and metrics ticks (ADR 0010).
package moments

import (
	"errors"

	"github.com/alexwafula/pulse/app/internal/domain"
	"github.com/alexwafula/pulse/app/internal/metrics"
)

var errNotImplemented = errors.New("moments: not implemented")

const (
	SetPieceShot      = "SET_PIECE_SHOT"
	SustainedPressure = "SUSTAINED_PRESSURE"
	ControlSwing      = "CONTROL_SWING"

	EvidenceEvent = "event"
	EvidenceTick  = "tick"
)

// Moment is one detected significant point with its evidence.
type Moment struct {
	Type          string             `json:"type"`
	TeamID        string             `json:"teamId"`
	TimeMS        int64              `json:"timeMs"`
	WindowStartMS int64              `json:"windowStartMs"`
	WindowEndMS   int64              `json:"windowEndMs"`
	EvidenceKind  string             `json:"evidenceKind"`
	Reasons       []string           `json:"reasons"`
	TickTimesMS   []int64            `json:"tickTimesMs"`
	Values        map[string]float64 `json:"values"`
}

// Action is a completed final-third action counted toward K.
type Action struct {
	ID     string
	TimeMS int64
}

// Detect returns every moment in the replay, sorted by time, type, team.
func Detect(replay domain.Replay, res metrics.Result, p metrics.Params) ([]Moment, error) {
	return nil, errNotImplemented
}

// SustainedPressureFor runs the SUSTAINED_PRESSURE detector for one team.
func SustainedPressureFor(teamID string, times []int64, finalThird []float64, actions []Action, p metrics.Params) []Moment {
	return nil
}

// SwingSignal is Δ(t) − min(Δ over [t − W, t]) per tick.
func SwingSignal(times []int64, delta []float64, p metrics.Params) []float64 {
	return make([]float64, len(times))
}

// ControlSwingFor runs the CONTROL_SWING detector for one team on its index
// difference series.
func ControlSwingFor(teamID string, times []int64, delta []float64, events []domain.Event, p metrics.Params) []Moment {
	return nil
}
