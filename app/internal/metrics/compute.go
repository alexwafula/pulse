package metrics

import (
	"fmt"
	"math"
	"sort"

	"github.com/alexwafula/pulse/app/internal/domain"
)

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

// track is the replay's tracking in integer decimetres, players sorted by ID.
type track struct {
	f0, frameMS int64
	ids         []string
	teamOf      []string
	x, y        [][]float64 // [frame][player]
	ball        []BallState
}

func toDM(m float64) float64 { return math.Round(m * 10) }

// newTrack checks tracking support (§0) and converts coordinates. A non-empty
// reason means the replay is unsupported.
func newTrack(replay domain.Replay, p Params) (*track, string) {
	frames := replay.Tracking
	if len(frames) < 2 {
		return nil, fmt.Sprintf("tracking has %d frames; at least 2 at %d ms are required", len(frames), p.FrameMS)
	}
	teamOf := map[string]string{}
	for _, pl := range replay.Match.Players {
		teamOf[pl.ID] = pl.TeamID
	}
	tr := &track{f0: frames[0].TimeMS, frameMS: p.FrameMS}
	for _, tp := range frames[0].Players {
		tr.ids = append(tr.ids, tp.PlayerID)
	}
	sort.Strings(tr.ids)
	slot := make(map[string]int, len(tr.ids))
	for k, id := range tr.ids {
		if _, dup := slot[id]; dup {
			return nil, fmt.Sprintf("player %s appears twice in the first frame", id)
		}
		slot[id] = k
		tr.teamOf = append(tr.teamOf, teamOf[id])
	}
	for f, fr := range frames {
		if f > 0 && fr.TimeMS-frames[f-1].TimeMS != p.FrameMS {
			return nil, fmt.Sprintf("frame gap of %d ms at %d; %d Hz tracking (%d ms) is required",
				fr.TimeMS-frames[f-1].TimeMS, fr.TimeMS, 1000/p.FrameMS, p.FrameMS)
		}
		if len(fr.Players) != len(tr.ids) {
			return nil, fmt.Sprintf("frame %d has %d players; the first frame has %d", fr.TimeMS, len(fr.Players), len(tr.ids))
		}
		xs, ys := make([]float64, len(tr.ids)), make([]float64, len(tr.ids))
		seen := make([]bool, len(tr.ids))
		for _, tp := range fr.Players {
			k, ok := slot[tp.PlayerID]
			if !ok || seen[k] {
				return nil, fmt.Sprintf("frame %d changes the player set (%s)", fr.TimeMS, tp.PlayerID)
			}
			seen[k] = true
			xs[k], ys[k] = toDM(tp.X), toDM(tp.Y)
		}
		tr.x, tr.y = append(tr.x, xs), append(tr.y, ys)
		tr.ball = append(tr.ball, BallState{X: toDM(fr.Ball.X), Y: toDM(fr.Ball.Y), Z: toDM(fr.Ball.Z)})
	}
	last := frames[len(frames)-1].TimeMS
	m := replay.Match
	if m.StartMS < tr.f0 || m.EndMS > last {
		return nil, fmt.Sprintf("tracking %d-%d does not cover the match %d-%d", tr.f0, last, m.StartMS, m.EndMS)
	}
	if half := p.FrameMS / 2; p.TickMS%half != 0 || (m.StartMS-tr.f0)%half != 0 {
		return nil, fmt.Sprintf("%d ms ticks from %d do not align to frames or half-frames", p.TickMS, m.StartMS)
	}
	return tr, ""
}

func (tr *track) last() int64 { return tr.f0 + int64(len(tr.x)-1)*tr.frameMS }

// at returns positions at t: a frame, or the exact midpoint of two frames.
func (tr *track) at(t int64) (xs, ys []float64, ball BallState) {
	off := t - tr.f0
	f, rem := off/tr.frameMS, off%tr.frameMS
	if rem == 0 {
		return tr.x[f], tr.y[f], tr.ball[f]
	}
	n := len(tr.ids)
	xs, ys = make([]float64, n), make([]float64, n)
	for k := 0; k < n; k++ {
		xs[k] = (tr.x[f][k] + tr.x[f+1][k]) * 0.5
		ys[k] = (tr.y[f][k] + tr.y[f+1][k]) * 0.5
	}
	a, b := tr.ball[f], tr.ball[f+1]
	return xs, ys, BallState{X: (a.X + b.X) * 0.5, Y: (a.Y + b.Y) * 0.5, Z: (a.Z + b.Z) * 0.5}
}

// snapshot builds the tick state: positions at t and the central-difference
// velocity over t±frame (one-sided at the replay boundaries).
func (tr *track) snapshot(t int64) Snapshot {
	xs, ys, ball := tr.at(t)
	lo, hi := t-tr.frameMS, t+tr.frameMS
	if lo < tr.f0 {
		lo = t
	}
	if hi > tr.last() {
		hi = t
	}
	x0, y0, _ := tr.at(lo)
	x1, y1, _ := tr.at(hi)
	span := float64(hi-lo) / 1000
	players := make([]PlayerState, len(tr.ids))
	for k, id := range tr.ids {
		players[k] = PlayerState{ID: id, TeamID: tr.teamOf[k], X: xs[k], Y: ys[k],
			VX: float64(x1[k]-x0[k]) / span, VY: float64(y1[k]-y0[k]) / span}
	}
	return Snapshot{Players: players, Ball: ball}
}

// Compute runs every tracking metric over a replay. Replays without 5 Hz
// tracking return TrackingMetrics "unsupported" and no ticks.
func Compute(replay domain.Replay, p Params) (Result, error) {
	if err := replay.Validate(); err != nil {
		return Result{}, fmt.Errorf("validate replay: %w", err)
	}
	m := replay.Match
	if len(m.Teams) != 2 {
		return Result{}, fmt.Errorf("metrics need exactly 2 teams, got %d", len(m.Teams))
	}
	var sides [2]TeamSide
	for k, t := range m.Teams {
		sides[k] = TeamSide{ID: t.ID, AttacksRight: t.AttackingDirection == "RIGHT"}
	}
	res := Result{Model: Model, Label: Label, TrackingMetrics: TrackingSupported,
		Teams: []string{sides[0].ID, sides[1].ID}, Params: p, Ticks: []Tick{}}
	tr, reason := newTrack(replay, p)
	if reason != "" {
		res.TrackingMetrics, res.Reason = TrackingUnsupported, reason
		return res, nil
	}

	holdMS := int64(math.Round(p.Index.PressHoldS * 1000))
	var lastPress [2]float64
	lastCarrierMS, haveCarrier := int64(0), false
	for t := m.StartMS; t <= m.EndMS; t += p.TickMS {
		snap := tr.snapshot(t)
		surf := ControlSurface(snap, sides, p)
		tick := Tick{TimeMS: t, Teams: make(map[string]TeamTick, 2), Entropy: surf.Entropy(), Surface: &surf}

		var press [2]*float64
		var heldFrom *int64
		if c, ok := FindCarrier(snap, p); ok {
			intensity := PressingIntensity(c, snap, p)
			tick.Carrier = &Carrier{PlayerID: c.ID, TeamID: c.TeamID}
			tick.Pressing = &intensity
			for k := range sides {
				v := intensity
				if sides[k].ID == c.TeamID {
					v = 1 - intensity
				}
				lastPress[k] = v
				press[k] = &lastPress[k]
			}
			lastCarrierMS, haveCarrier = t, true
		} else if haveCarrier && t-lastCarrierMS <= holdMS {
			from := lastCarrierMS
			heldFrom = &from
			for k := range sides {
				press[k] = &lastPress[k]
			}
		}

		var index [2]float64
		var teamTicks [2]TeamTick
		for k := range sides {
			comp := Components{Share: surf.Share(k), FinalThird: surf.FinalThird(k), Structure: 1 - tick.Entropy}
			if press[k] != nil {
				v := *press[k]
				comp.Press = &v
			}
			idx, used := indexOf(comp, p.Index)
			index[k] = idx
			teamTicks[k] = TeamTick{Share: comp.Share, FinalThird: comp.FinalThird, Index: idx,
				Components: comp, WeightsUsed: used, PressHeldFromMS: heldFrom}
		}
		for k := range sides {
			teamTicks[k].IndexDelta = index[k] - index[1-k]
			tick.Teams[sides[k].ID] = teamTicks[k]
		}
		res.Ticks = append(res.Ticks, tick)
	}
	return res, nil
}

// indexOf is Σ w·x / Σ w over non-null components, in table order (§5).
func indexOf(c Components, w IndexParams) (index, used float64) {
	num := float64(w.WShare*c.Share) + float64(w.WFinalThird*c.FinalThird)
	num += float64(w.WStructure * c.Structure)
	used = w.WShare + w.WFinalThird + w.WStructure
	if c.Press != nil {
		num += float64(w.WPress * *c.Press)
		used += w.WPress
	}
	if c.ShotQuality != nil {
		num += float64(w.WShotQuality * *c.ShotQuality)
		used += w.WShotQuality
	}
	return num / used, used
}

func round(v float64, scale float64) float64 {
	r := math.Round(v*scale) / scale
	if r == 0 {
		return 0 // normalise −0
	}
	return r
}

func roundPtr(v *float64, scale float64) *float64 {
	if v == nil {
		return nil
	}
	r := round(*v, scale)
	return &r
}

// Rounded returns a deep copy with every float rounded to dp decimals and
// surfaces dropped. Params are returned unchanged.
func (r Result) Rounded(dp int) Result {
	scale := math.Pow(10, float64(dp))
	out := r
	out.Teams = append([]string(nil), r.Teams...)
	out.Ticks = make([]Tick, len(r.Ticks))
	for i, tk := range r.Ticks {
		nt := Tick{TimeMS: tk.TimeMS, Entropy: round(tk.Entropy, scale), Pressing: roundPtr(tk.Pressing, scale),
			Teams: make(map[string]TeamTick, len(tk.Teams))}
		if tk.Carrier != nil {
			c := *tk.Carrier
			nt.Carrier = &c
		}
		for id, tt := range tk.Teams {
			n := TeamTick{Share: round(tt.Share, scale), FinalThird: round(tt.FinalThird, scale),
				Index: round(tt.Index, scale), IndexDelta: round(tt.IndexDelta, scale),
				WeightsUsed: round(tt.WeightsUsed, scale),
				Components: Components{Share: round(tt.Components.Share, scale),
					FinalThird: round(tt.Components.FinalThird, scale), Structure: round(tt.Components.Structure, scale),
					Press: roundPtr(tt.Components.Press, scale), ShotQuality: roundPtr(tt.Components.ShotQuality, scale)}}
			if tt.PressHeldFromMS != nil {
				v := *tt.PressHeldFromMS
				n.PressHeldFromMS = &v
			}
			nt.Teams[id] = n
		}
		out.Ticks[i] = nt
	}
	return out
}
