// Package moments detects SET_PIECE_SHOT, SUSTAINED_PRESSURE and
// CONTROL_SWING moments from events and metrics ticks (ADR 0010).
package moments

import (
	"fmt"
	"math"
	"sort"

	"github.com/alexwafula/pulse/app/internal/domain"
	"github.com/alexwafula/pulse/app/internal/facts"
	"github.com/alexwafula/pulse/app/internal/metrics"
)

const (
	SetPieceShot      = "SET_PIECE_SHOT"
	SustainedPressure = "SUSTAINED_PRESSURE"
	ControlSwing      = "CONTROL_SWING"

	// EvidenceEvent: the moment's reasons are the events that caused it.
	EvidenceEvent = "event"
	// EvidenceTick: the moment is derived from metric ticks. Its reasons are
	// empty; tickTimesMs is the evidence.
	EvidenceTick = "tick"
)

// Moment is one detected significant point with its evidence.
//
// Reasons are evidence: the events the moment is computed from. ContextEventIDs
// are NOT evidence: events that merely happened inside the window of a
// tick-derived moment, for display only. They must never be cited as support.
type Moment struct {
	Type            string             `json:"type"`
	TeamID          string             `json:"teamId"`
	TimeMS          int64              `json:"timeMs"`
	WindowStartMS   int64              `json:"windowStartMs"`
	WindowEndMS     int64              `json:"windowEndMs"`
	EvidenceKind    string             `json:"evidenceKind"`
	Reasons         []string           `json:"reasons"`
	ContextEventIDs []string           `json:"contextEventIds"`
	TickTimesMS     []int64            `json:"tickTimesMs"`
	Values          map[string]float64 `json:"values"`
}

// Action is a completed final-third action counted toward K.
type Action struct {
	ID     string
	TimeMS int64
}

func ms(seconds float64) int64 { return int64(math.Round(seconds * 1000)) }

func round4(v float64) float64 {
	r := math.Round(v*1e4) / 1e4
	if r == 0 {
		return 0
	}
	return r
}

// Detect returns every moment in the replay, sorted by time, type, team.
// SET_PIECE_SHOT is event-only and is returned for unsupported replays too.
func Detect(replay domain.Replay, res metrics.Result, p metrics.Params) ([]Moment, error) {
	packs, err := facts.CornerPacks(replay)
	if err != nil {
		return nil, fmt.Errorf("corner packs: %w", err)
	}
	out := []Moment{}
	for _, pack := range packs {
		for _, f := range pack.Facts {
			out = append(out, Moment{Type: SetPieceShot, TeamID: f.TeamID, TimeMS: f.TimeEndMS,
				WindowStartMS: f.TimeStartMS, WindowEndMS: f.TimeEndMS, EvidenceKind: EvidenceEvent,
				Reasons: append([]string{}, f.EventIDs...), ContextEventIDs: []string{}, TickTimesMS: []int64{},
				Values: map[string]float64{}})
		}
	}
	if res.TrackingMetrics == metrics.TrackingSupported {
		attacksRight := map[string]bool{}
		for _, t := range replay.Match.Teams {
			attacksRight[t.ID] = t.AttackingDirection == "RIGHT"
		}
		for _, team := range res.Teams {
			times := make([]int64, len(res.Ticks))
			third := make([]float64, len(res.Ticks))
			delta := make([]float64, len(res.Ticks))
			for k, tk := range res.Ticks {
				times[k], third[k], delta[k] = tk.TimeMS, tk.Teams[team].FinalThird, tk.Teams[team].IndexDelta
			}
			actions := FinalThirdActions(replay.Events, team, attacksRight[team], p)
			out = append(out, SustainedPressureFor(team, times, third, actions, p)...)
			out = append(out, ControlSwingFor(team, times, delta, replay.Events, p)...)
		}
	}
	sort.SliceStable(out, func(a, b int) bool {
		if out[a].TimeMS != out[b].TimeMS {
			return out[a].TimeMS < out[b].TimeMS
		}
		if out[a].Type != out[b].Type {
			return out[a].Type < out[b].Type
		}
		return out[a].TeamID < out[b].TeamID
	})
	return out, nil
}

// FinalThirdActions lists the team's COMPLETE PASS, CARRY, CROSS and CORNER
// events whose `to` lies in its attacking final third (shots excluded). The
// boundary is the final-third column edge, compared in integer decimetres.
func FinalThirdActions(events []domain.Event, teamID string, attacksRight bool, p metrics.Params) []Action {
	cols := p.Grid.Cols
	k := cols / 3
	right := float64((cols-k)*1050) / float64(cols)
	left := float64(k*1050) / float64(cols)
	var out []Action
	for _, e := range events {
		if e.TeamID != teamID || e.Outcome != "COMPLETE" {
			continue
		}
		switch e.Type {
		case "PASS", "CARRY", "CROSS", "CORNER":
		default:
			continue
		}
		x := math.Round(e.To.X * 10)
		if (attacksRight && x >= right) || (!attacksRight && x <= left) {
			out = append(out, Action{ID: e.ID, TimeMS: e.TimeMS})
		}
	}
	return out
}

// SustainedPressureFor runs the SUSTAINED_PRESSURE detector for one team:
// N consecutive ticks with finalThird ≥ OnShare and at least K actions in the
// W seconds ending at the last of them. After firing it re-arms only once
// finalThird has stayed below OffShare for OffTicks ticks AND the cooldown
// has elapsed.
func SustainedPressureFor(teamID string, times []int64, finalThird []float64, actions []Action, p metrics.Params) []Moment {
	q := p.Moments.Pressure
	window, cooldown := ms(q.WindowS), ms(q.CooldownS)
	out := []Moment{}
	armed, settled := true, false
	run, offRun := 0, 0
	var lastFire int64
	for k, t := range times {
		v := finalThird[k]
		if v >= q.OnShare {
			run++
		} else {
			run = 0
		}
		if !armed {
			if v < q.OffShare {
				offRun++
			} else {
				offRun = 0
			}
			if offRun >= q.OffTicks {
				settled = true
			}
			if settled && t-lastFire >= cooldown {
				armed = true
			}
		}
		if !armed || run < q.N {
			continue
		}
		reasons := []string{}
		for _, a := range actions {
			if a.TimeMS >= t-window && a.TimeMS <= t {
				reasons = append(reasons, a.ID)
			}
		}
		if len(reasons) < q.K {
			continue
		}
		out = append(out, Moment{Type: SustainedPressure, TeamID: teamID, TimeMS: t,
			WindowStartMS: t - window, WindowEndMS: t, EvidenceKind: EvidenceEvent, Reasons: reasons,
			ContextEventIDs: []string{},
			TickTimesMS:     append([]int64{}, times[k-q.N+1:k+1]...),
			Values:          map[string]float64{"finalThird": round4(v), "actions": float64(len(reasons))}})
		armed, settled, offRun, lastFire = false, false, 0, t
	}
	return out
}

// swingAt returns Δ[k] − min(Δ over [t−W, t]) and the index of the LATEST
// tick holding that minimum.
func swingAt(k int, times []int64, delta []float64, window int64) (float64, int) {
	jmin := k
	for j := k; j >= 0 && times[j] >= times[k]-window; j-- {
		if delta[j] < delta[jmin] {
			jmin = j
		}
	}
	return delta[k] - delta[jmin], jmin
}

// SwingSignal is Δ(t) − min(Δ over [t − W, t]) per tick.
func SwingSignal(times []int64, delta []float64, p metrics.Params) []float64 {
	out := make([]float64, len(times))
	window := ms(p.Moments.Swing.WindowS)
	for k := range times {
		out[k], _ = swingAt(k, times, delta, window)
	}
	return out
}

// ControlSwingFor runs the CONTROL_SWING detector for one team on its index
// difference series. Evidence is always "tick": reasons are empty and the
// events in [t_min, t] go to ContextEventIDs (not evidence). After firing it
// re-arms once RearmTicks consecutive ticks after the firing span at most
// RearmRange AND the cooldown has elapsed.
func ControlSwingFor(teamID string, times []int64, delta []float64, events []domain.Event, p metrics.Params) []Moment {
	s := p.Moments.Swing
	window, cooldown := ms(s.WindowS), ms(s.CooldownS)
	out := []Moment{}
	armed, settled := true, false
	var lastFire int64
	for k, t := range times {
		if !armed {
			if first := k - s.RearmTicks + 1; first >= 0 && times[first] > lastFire {
				lo, hi := delta[first], delta[first]
				for _, v := range delta[first : k+1] {
					lo, hi = math.Min(lo, v), math.Max(hi, v)
				}
				if hi-lo <= s.RearmRange {
					settled = true
				}
			}
			if settled && t-lastFire >= cooldown {
				armed = true
			}
		}
		if !armed {
			continue
		}
		signal, jmin := swingAt(k, times, delta, window)
		if signal < s.Delta {
			continue
		}
		tMin := times[jmin]
		context := []string{}
		for _, e := range events {
			if e.TimeMS >= tMin && e.TimeMS <= t {
				context = append(context, e.ID)
			}
		}
		out = append(out, Moment{Type: ControlSwing, TeamID: teamID, TimeMS: t,
			WindowStartMS: tMin, WindowEndMS: t, EvidenceKind: EvidenceTick, Reasons: []string{},
			ContextEventIDs: context, TickTimesMS: []int64{tMin, t},
			Values: map[string]float64{"signal": round4(signal), "deltaFrom": round4(delta[jmin]),
				"deltaTo": round4(delta[k])}})
		armed, settled, lastFire = false, false, t
	}
	return out
}
