package moments_test

import (
	"strconv"
	"testing"

	"github.com/alexwafula/pulse/app/internal/domain"
	"github.com/alexwafula/pulse/app/internal/metrics"
	"github.com/alexwafula/pulse/app/internal/moments"
)

type seg = struct {
	v float64
	n int
}

// series lays segments end to end on a 500 ms tick grid starting at 0.
func series(segments ...seg) ([]int64, []float64) {
	var times []int64
	var values []float64
	for _, s := range segments {
		for k := 0; k < s.n; k++ {
			times = append(times, int64(len(times))*500)
			values = append(values, s.v)
		}
	}
	return times, values
}

func everySecond(untilMS int64) []moments.Action {
	var a []moments.Action
	for t := int64(0); t <= untilMS; t += 1000 {
		a = append(a, moments.Action{ID: "evt-" + strconv.FormatInt(t, 10), TimeMS: t})
	}
	return a
}

// T12a: SUSTAINED_PRESSURE fires once per episode (hysteresis + cooldown).
// First firing is at tick 5 (2500 ms): six ticks >= OnShare and three actions.
func TestT12_SustainedPressureHysteresis(t *testing.T) {
	p := metrics.DefaultParams()
	for _, tc := range []struct {
		name    string
		segs    []seg
		actions bool
		want    int
	}{
		{"dip to 0.35 does not re-arm", []seg{{0.5, 8}, {0.35, 2}, {0.5, 100}}, true, 1},
		{"re-armed but inside 30 s cooldown", []seg{{0.5, 8}, {0.2, 4}, {0.5, 20}}, true, 1},
		{"re-armed after cooldown fires again", []seg{{0.5, 8}, {0.2, 4}, {0.5, 100}}, true, 2},
		{"K not met", []seg{{0.5, 40}}, false, 0},
	} {
		times, values := series(tc.segs...)
		var actions []moments.Action
		if tc.actions {
			actions = everySecond(times[len(times)-1])
		}
		got := moments.SustainedPressureFor("a", times, values, actions, p)
		if len(got) != tc.want {
			t.Errorf("%s: %d moments, want %d: %+v", tc.name, len(got), tc.want, got)
			continue
		}
		if len(got) > 0 {
			m := got[0]
			if m.TimeMS != 2500 || len(m.TickTimesMS) != p.Moments.Pressure.N || m.EvidenceKind != moments.EvidenceEvent ||
				len(m.Reasons) < p.Moments.Pressure.K || m.Type != moments.SustainedPressure || m.TeamID != "a" {
				t.Errorf("%s: first moment %+v", tc.name, m)
			}
		}
	}
}

// Both SUSTAINED_PRESSURE conditions are necessary on their own.
func TestSustainedPressure_BothConditionsRequired(t *testing.T) {
	p := metrics.DefaultParams()
	q := p.Moments.Pressure

	// High final-third share on every tick, but the only actions are
	// unrelated: none is a completed final-third action, so none is passed in.
	times, high := series(seg{0.9, 120})
	if got := moments.SustainedPressureFor("a", times, high, nil, p); len(got) != 0 {
		t.Errorf("high share, no actions: %d moments, want 0: %+v", len(got), got)
	}

	// Plenty of completed final-third actions (one per second, far above K),
	// but share stays just below OnShare.
	times, low := series(seg{q.OnShare - 0.01, 120})
	actions := everySecond(times[len(times)-1])
	if len(actions) < 4*q.K {
		t.Fatalf("toy has only %d actions", len(actions))
	}
	if got := moments.SustainedPressureFor("a", times, low, actions, p); len(got) != 0 {
		t.Errorf("actions, low share: %d moments, want 0: %+v", len(got), got)
	}

	// Control: the same actions with share at OnShare exactly do fire (>=).
	times, at := series(seg{q.OnShare, 120})
	if got := moments.SustainedPressureFor("a", times, at, actions, p); len(got) == 0 {
		t.Error("control: share == OnShare with actions must fire")
	}
}

// T12b: CONTROL_SWING fires once per swing, carries evidenceKind "tick",
// empty reasons and the window's events as contextEventIds.
func TestT12_ControlSwingHysteresis(t *testing.T) {
	p := metrics.DefaultParams()
	inWindow := []domain.Event{{ID: "evt-in", TimeMS: 4800}, {ID: "evt-out", TimeMS: 100}}
	for _, tc := range []struct {
		name   string
		segs   []seg
		events []domain.Event
		want   int
	}{
		{"second rise inside cooldown", []seg{{0, 10}, {0.4, 10}, {0, 4}, {0.4, 10}}, inWindow, 1},
		{"second rise after cooldown and settle", []seg{{0, 10}, {0.4, 10}, {0, 40}, {0.4, 10}}, inWindow, 2},
		{"rise below Delta", []seg{{0, 10}, {0.25, 20}}, nil, 0},
		{"no events in window", []seg{{0, 10}, {0.4, 10}}, nil, 1},
	} {
		times, delta := series(tc.segs...)
		got := moments.ControlSwingFor("a", times, delta, tc.events, p)
		if len(got) != tc.want {
			t.Errorf("%s: %d moments, want %d: %+v", tc.name, len(got), tc.want, got)
			continue
		}
		if len(got) == 0 {
			continue
		}
		m := got[0]
		if m.Type != moments.ControlSwing || m.EvidenceKind != moments.EvidenceTick || m.TimeMS != 5000 ||
			len(m.TickTimesMS) != 2 || m.ContextEventIDs == nil {
			t.Errorf("%s: first moment %+v", tc.name, m)
		}
		// Tick-derived: reasons are never populated, even when events sit in the window.
		if m.Reasons == nil || len(m.Reasons) != 0 {
			t.Errorf("%s: reasons %v, want [] (non-nil, empty)", tc.name, m.Reasons)
		}
		if tc.events != nil && (len(m.ContextEventIDs) != 1 || m.ContextEventIDs[0] != "evt-in") {
			t.Errorf("%s: contextEventIds %v, want [evt-in]", tc.name, m.ContextEventIDs)
		}
		if tc.events == nil && len(m.ContextEventIDs) != 0 {
			t.Errorf("%s: contextEventIds %v, want empty", tc.name, m.ContextEventIDs)
		}
	}
}

func TestSwingSignal(t *testing.T) {
	times, delta := series(seg{0.1, 4}, seg{-0.2, 2}, seg{0.3, 3})
	got := moments.SwingSignal(times, delta, metrics.DefaultParams())
	want := []float64{0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5}
	for k := range want {
		if d := got[k] - want[k]; d > 1e-12 || d < -1e-12 {
			t.Fatalf("signal[%d] = %.17g, want %.17g", k, got[k], want[k])
		}
	}
}
