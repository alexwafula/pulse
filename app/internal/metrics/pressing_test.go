package metrics_test

import (
	"fmt"
	"math"
	"testing"

	"github.com/alexwafula/pulse/app/internal/domain"
	"github.com/alexwafula/pulse/app/internal/metrics"
)

func carrierSnap(defenders ...metrics.PlayerState) (metrics.PlayerState, metrics.Snapshot) {
	carrier := metrics.PlayerState{ID: "a0", TeamID: "a", X: dm(50), Y: dm(34)}
	players := append([]metrics.PlayerState{carrier}, defenders...)
	return carrier, metrics.Snapshot{Players: players, Ball: metrics.BallState{X: dm(50), Y: dm(34)}}
}

// T5: one defender 1 m away closing at 6 m/s gives intensity > 0.9.
func TestT5_CloseDefenderHighPressing(t *testing.T) {
	c, s := carrierSnap(metrics.PlayerState{ID: "b0", TeamID: "b", X: dm(49), Y: dm(34), VX: dm(6)})
	got := metrics.PressingIntensity(c, s, metrics.DefaultParams())
	t.Logf("intensity %.4f (hand value 0.9722)", got)
	if got <= 0.9 {
		t.Fatalf("intensity %.4f, want > 0.9", got)
	}
}

// T6: one defender 15 m away gives intensity < 0.05, standing or closing.
func TestT6_FarDefenderLowPressing(t *testing.T) {
	for _, tc := range []struct {
		name string
		vx   float64
		hand float64
	}{{"standing", 0, 0.0130}, {"closing", 6, 0.0344}} {
		c, s := carrierSnap(metrics.PlayerState{ID: "b0", TeamID: "b", X: dm(35), Y: dm(34), VX: dm(tc.vx)})
		got := metrics.PressingIntensity(c, s, metrics.DefaultParams())
		t.Logf("%s: intensity %.4f (hand value %.4f)", tc.name, got, tc.hand)
		if got <= 0 || got >= 0.05 {
			t.Errorf("%s: intensity %.4f, want in (0, 0.05)", tc.name, got)
		}
	}
}

// T6b: ten defenders at 15 m accumulate (documented caveat).
func TestT6b_TenDefendersAccumulate(t *testing.T) {
	for _, tc := range []struct {
		name     string
		speed    float64
		lo, hi   float64
		handNote string
	}{{"standing", 0, 0.11, 0.14, "0.122"}, {"closing", 6, 0.27, 0.32, "0.296"}} {
		var defenders []metrics.PlayerState
		for k := 0; k < 10; k++ {
			a := 2 * math.Pi * float64(k) / 10
			dx, dy := math.Cos(a), math.Sin(a)
			defenders = append(defenders, metrics.PlayerState{ID: fmt.Sprintf("b%02d", k), TeamID: "b",
				X: dm(50 + 15*dx), Y: dm(34 + 15*dy), VX: dm(-tc.speed * dx), VY: dm(-tc.speed * dy)})
		}
		c, s := carrierSnap(defenders...)
		got := metrics.PressingIntensity(c, s, metrics.DefaultParams())
		t.Logf("%s: intensity %.4f (hand value %s)", tc.name, got, tc.handNote)
		if got < tc.lo || got > tc.hi {
			t.Errorf("%s: intensity %.4f, want in [%.2f, %.2f]", tc.name, got, tc.lo, tc.hi)
		}
	}
}

// T7a: carrier identification from tracking only.
func TestT7_CarrierRule(t *testing.T) {
	p := metrics.DefaultParams()
	players := []metrics.PlayerState{
		{ID: "a0", TeamID: "a", X: dm(50), Y: dm(34)},
		{ID: "b0", TeamID: "b", X: dm(53), Y: dm(34)},
	}
	for _, tc := range []struct {
		name string
		ball metrics.BallState
		want string
	}{
		{"at a0", metrics.BallState{X: dm(50.5), Y: dm(34)}, "a0"},
		{"in the air", metrics.BallState{X: dm(50.5), Y: dm(34), Z: dm(1.1)}, ""},
		{"loose, 1.6 m from a0", metrics.BallState{X: dm(50), Y: dm(35.6)}, ""},
		{"z exactly 1.0 m", metrics.BallState{X: dm(50.5), Y: dm(34), Z: dm(1.0)}, "a0"},
		{"radius exactly 1.5 m from both, tie broken by ID", metrics.BallState{X: dm(51.5), Y: dm(34)}, "a0"},
	} {
		c, ok := metrics.FindCarrier(metrics.Snapshot{Players: players, Ball: tc.ball}, p)
		got := ""
		if ok {
			got = c.ID
		}
		if got != tc.want {
			t.Errorf("%s: carrier %q, want %q", tc.name, got, tc.want)
		}
	}
}

// T7b: press is held up to and INCLUDING +2.0 s after the last carrier tick,
// then null; the raw pressing value is never held.
func TestT7_PressHoldInclusive(t *testing.T) {
	const lastCarrier = int64(601000)
	r := toyReplay(607000, func(t int64) domain.Ball {
		if t <= lastCarrier || t >= 605000 {
			return domain.Ball{X: 50, Y: 34}
		}
		return domain.Ball{X: 55, Y: 34, Z: 3}
	})
	res := mustCompute(t, r)
	byTime := map[int64]metrics.Tick{}
	for _, tk := range res.Ticks {
		byTime[tk.TimeMS] = tk
	}
	ref, ok := byTime[lastCarrier]
	if !ok || ref.Pressing == nil || ref.Carrier == nil || ref.Carrier.PlayerID != "a1" {
		t.Fatalf("tick %d must have carrier a1 and pressing", lastCarrier)
	}
	for _, team := range []string{"a", "b"} {
		if math.Abs(ref.Teams[team].WeightsUsed-1) > 1e-12 {
			t.Fatalf("%s weightsUsed %.17g at carrier tick, want 1", team, ref.Teams[team].WeightsUsed)
		}
	}
	for _, at := range []int64{601500, 602000, 602500, 603000} {
		tk := byTime[at]
		if tk.Pressing != nil || tk.Carrier != nil {
			t.Errorf("%d: raw pressing/carrier must be null in flight", at)
		}
		for _, team := range []string{"a", "b"} {
			tt := tk.Teams[team]
			if tt.Components.Press == nil || ref.Teams[team].Components.Press == nil ||
				*tt.Components.Press != *ref.Teams[team].Components.Press {
				t.Errorf("%d %s: press not held from %d", at, team, lastCarrier)
			}
			if tt.PressHeldFromMS == nil || *tt.PressHeldFromMS != lastCarrier {
				t.Errorf("%d %s: pressHeldFromMs %v, want %d", at, team, tt.PressHeldFromMS, lastCarrier)
			}
		}
	}
	after := byTime[603500]
	for _, team := range []string{"a", "b"} {
		tt := after.Teams[team]
		if tt.Components.Press != nil || tt.PressHeldFromMS != nil {
			t.Errorf("603500 %s: press must be null after +2.0 s", team)
		}
		if math.Abs(tt.WeightsUsed-0.80) > 1e-12 {
			t.Errorf("603500 %s: weightsUsed %.17g, want 0.80", team, tt.WeightsUsed)
		}
	}
	if back := byTime[605000]; back.Carrier == nil || back.Teams["a"].PressHeldFromMS != nil {
		t.Errorf("605000: carrier must be back and press not held")
	}
}
