package metrics_test

import (
	"bytes"
	"encoding/json"
	"flag"
	"math"
	"math/rand"
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/alexwafula/pulse/app/internal/domain"
	"github.com/alexwafula/pulse/app/internal/metrics"
	"github.com/alexwafula/pulse/app/internal/moments"
	"github.com/alexwafula/pulse/app/internal/simulator"
	"github.com/alexwafula/pulse/app/internal/simulator/scenarios"
)

var update = flag.Bool("update", false, "rewrite the metrics golden file")

func flipX(x float64) float64 { return float64(1050-math.Round(x*10)) / 10 }

// mirror swaps the teams' attacking directions and flips x for players, ball
// and event endpoints. Team identities are unchanged.
func mirror(t *testing.T, r domain.Replay) domain.Replay {
	t.Helper()
	var m domain.Replay
	if err := json.Unmarshal(mustJSON(t, r), &m); err != nil {
		t.Fatal(err)
	}
	for i := range m.Match.Teams {
		if m.Match.Teams[i].AttackingDirection == "RIGHT" {
			m.Match.Teams[i].AttackingDirection = "LEFT"
		} else {
			m.Match.Teams[i].AttackingDirection = "RIGHT"
		}
	}
	for i := range m.Tracking {
		m.Tracking[i].Ball.X = flipX(m.Tracking[i].Ball.X)
		for j := range m.Tracking[i].Players {
			m.Tracking[i].Players[j].X = flipX(m.Tracking[i].Players[j].X)
		}
	}
	for i := range m.Events {
		m.Events[i].From.X = flipX(m.Events[i].From.X)
		m.Events[i].To.X = flipX(m.Events[i].To.X)
	}
	return m
}

func detect(t *testing.T, r domain.Replay, res metrics.Result) []moments.Moment {
	t.Helper()
	ms, err := moments.Detect(r, res, metrics.DefaultParams())
	if err != nil {
		t.Fatalf("detect %s: %v", r.Match.ID, err)
	}
	return ms
}

// T8: the mirror is exact. No tolerance anywhere in this test.
func TestT8_MirrorExact(t *testing.T) {
	p := metrics.DefaultParams()
	for _, name := range []string{"late-siege", "calm-midfield"} {
		t.Run(name, func(t *testing.T) {
			r := loadScenario(t, name)
			mr := mirror(t, r)
			a, b := mustCompute(t, r), mustCompute(t, mr)
			if len(a.Ticks) == 0 || len(a.Ticks) != len(b.Ticks) {
				t.Fatalf("tick counts %d / %d", len(a.Ticks), len(b.Ticks))
			}
			for k := range a.Ticks {
				ta, tb := a.Ticks[k], b.Ticks[k]
				if ta.TimeMS != tb.TimeMS || ta.Entropy != tb.Entropy ||
					!reflect.DeepEqual(ta.Carrier, tb.Carrier) || !reflect.DeepEqual(ta.Pressing, tb.Pressing) {
					t.Fatalf("tick %d: entropy %.17g/%.17g carrier %v/%v pressing %v/%v",
						ta.TimeMS, ta.Entropy, tb.Entropy, ta.Carrier, tb.Carrier, ta.Pressing, tb.Pressing)
				}
				for id, va := range ta.Teams {
					if vb := tb.Teams[id]; !reflect.DeepEqual(va, vb) {
						t.Fatalf("tick %d team %s:\n orig   %+v\n mirror %+v", ta.TimeMS, id, va, vb)
					}
				}
				for team := 0; team < 2; team++ {
					for i := 0; i < p.Grid.Cols; i++ {
						for j := 0; j < p.Grid.Rows; j++ {
							ca := ta.Surface.Control[team][i*p.Grid.Rows+j]
							cb := tb.Surface.Control[team][(p.Grid.Cols-1-i)*p.Grid.Rows+j]
							if ca != cb {
								t.Fatalf("tick %d team %d cell (%d,%d): %.17g vs mirrored %.17g", ta.TimeMS, team, i, j, ca, cb)
							}
						}
					}
				}
			}
			if ma, mb := detect(t, r, a), detect(t, mr, b); !reflect.DeepEqual(ma, mb) {
				t.Fatalf("moments differ:\n orig   %+v\n mirror %+v", ma, mb)
			}
		})
	}
}

func meanFinalThird(res metrics.Result, team string, from, to int64) (float64, int) {
	sum, n := 0.0, 0
	for _, tk := range res.Ticks {
		if tk.TimeMS >= from && tk.TimeMS <= to {
			sum += tk.Teams[team].FinalThird
			n++
		}
	}
	return sum / float64(n), n
}

// T9a: within-team contrast, siege vs pre-siege. Bound stated in ADR 0010
// before any metric was computed.
func TestT9a_LateSiegeWithinTeamContrast(t *testing.T) {
	res := mustCompute(t, loadScenario(t, "late-siege"))
	pre, nPre := meanFinalThird(res, "vale", 5280000, 5289500)
	siege, nSiege := meanFinalThird(res, "vale", 5290000, 5325000)
	t.Logf("MEASURED finalThird_vale: pre-siege %.4f (%d ticks), siege %.4f (%d ticks), difference %.4f (bound >= 0.10)",
		pre, nPre, siege, nSiege, siege-pre)
	if nPre != 20 || nSiege != 71 {
		t.Fatalf("window tick counts %d/%d, want 20/71", nPre, nSiege)
	}
	if siege-pre < 0.10 {
		t.Fatalf("T9a FAILED: difference %.4f < 0.10", siege-pre)
	}
}

// T9b: SUSTAINED_PRESSURE fires for vale inside the siege window, never for bastion.
func TestT9b_LateSiegeSustainedPressure(t *testing.T) {
	r := loadScenario(t, "late-siege")
	ms := detect(t, r, mustCompute(t, r))
	vale := false
	for _, m := range ms {
		t.Logf("MEASURED moment %s team=%s t=%d window=[%d,%d] evidence=%s reasons=%v context=%v ticks=%v values=%v",
			m.Type, m.TeamID, m.TimeMS, m.WindowStartMS, m.WindowEndMS, m.EvidenceKind, m.Reasons, m.ContextEventIDs, m.TickTimesMS, m.Values)
		if m.EvidenceKind == moments.EvidenceTick && len(m.Reasons) != 0 {
			t.Errorf("%s at %d: tick-derived moment has reasons %v; nearby events belong in contextEventIds", m.Type, m.TimeMS, m.Reasons)
		}
		if m.Type != moments.SustainedPressure {
			continue
		}
		if m.TeamID == "bastion" {
			t.Errorf("T9b FAILED: SUSTAINED_PRESSURE fired for bastion at %d", m.TimeMS)
		}
		if m.TeamID == "vale" && m.TimeMS >= 5290000 && m.TimeMS <= 5325000 {
			vale = true
		}
	}
	if !vale {
		t.Errorf("T9b FAILED: no SUSTAINED_PRESSURE for vale inside [5290000, 5325000]")
	}
}

// T10: replays without 5 Hz tracking are unsupported; event moments remain.
func TestT10_UnsupportedReplays(t *testing.T) {
	base, err := simulator.Load(repoPath("data", "samples", "first-sequence.json"))
	if err != nil {
		t.Fatal(err)
	}
	catalog, err := scenarios.Catalog(base)
	if err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"corner", "central", "exchange"} {
		r := catalog[name]
		res := mustCompute(t, r)
		if res.TrackingMetrics != metrics.TrackingUnsupported || res.Reason == "" || len(res.Ticks) != 0 ||
			res.Model != metrics.Model || res.Label != metrics.Label {
			t.Errorf("%s: got trackingMetrics=%q reason=%q ticks=%d model=%q label=%q",
				name, res.TrackingMetrics, res.Reason, len(res.Ticks), res.Model, res.Label)
		}
		ms := detect(t, r, res)
		setPiece := 0
		for _, m := range ms {
			if m.Type != moments.SetPieceShot {
				t.Errorf("%s: tick moment %s on unsupported replay", name, m.Type)
				continue
			}
			setPiece++
			if m.EvidenceKind != moments.EvidenceEvent || len(m.Reasons) != 2 {
				t.Errorf("%s: set-piece evidence %q reasons %v", name, m.EvidenceKind, m.Reasons)
			}
		}
		if name == "corner" && setPiece != 1 {
			t.Errorf("corner: %d SET_PIECE_SHOT, want 1", setPiece)
		}
		t.Logf("%s: reason=%q moments=%d", name, res.Reason, len(ms))
	}

	// A single 400 ms gap is enough to make a replay unsupported.
	gap := toyReplay(602000, func(int64) domain.Ball { return domain.Ball{X: 50, Y: 34} })
	gap.Tracking = append(gap.Tracking[:3], gap.Tracking[4:]...)
	if res := mustCompute(t, gap); res.TrackingMetrics != metrics.TrackingUnsupported || res.Reason == "" {
		t.Errorf("gap replay: trackingMetrics %q reason %q", res.TrackingMetrics, res.Reason)
	}
}

// T11: calm-midfield fires no moment of any type.
func TestT11_CalmMidfieldNoMoments(t *testing.T) {
	r := loadScenario(t, "calm-midfield")
	res := mustCompute(t, r)
	p := metrics.DefaultParams()
	for _, team := range res.Teams {
		lo, hi, flo, fhi := 1.0, 0.0, 1.0, 0.0
		var times []int64
		var delta []float64
		for _, tk := range res.Ticks {
			v := tk.Teams[team]
			lo, hi = math.Min(lo, v.Share), math.Max(hi, v.Share)
			flo, fhi = math.Min(flo, v.FinalThird), math.Max(fhi, v.FinalThird)
			times = append(times, tk.TimeMS)
			delta = append(delta, v.IndexDelta)
		}
		maxSig, at := 0.0, int64(0)
		for k, s := range moments.SwingSignal(times, delta, p) {
			if s > maxSig {
				maxSig, at = s, times[k]
			}
		}
		t.Logf("MEASURED %s: share [%.4f, %.4f] finalThird [%.4f, %.4f] max swing signal %.4f at %d (Delta %.2f)",
			team, lo, hi, flo, fhi, maxSig, at, p.Moments.Swing.Delta)
	}
	if ms := detect(t, r, res); len(ms) != 0 {
		for _, m := range ms {
			t.Errorf("T11 FAILED: %s for %s at %d reasons %v", m.Type, m.TeamID, m.TimeMS, m.Reasons)
		}
	}
}

type golden struct {
	Scenario string           `json:"scenario"`
	Metrics  metrics.Result   `json:"metrics"`
	Moments  []moments.Moment `json:"moments"`
}

// T13: per-tick output at 4 dp matches the committed golden file.
func TestT13_Golden(t *testing.T) {
	r := loadScenario(t, "late-siege")
	res := mustCompute(t, r)
	g := golden{Scenario: "late-siege", Metrics: res.Rounded(4), Moments: detect(t, r, res)}
	got, err := json.MarshalIndent(g, "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	got = append(got, '\n')
	path := filepath.Join("..", "..", "testdata", "metrics", "late-siege.golden.json")
	if *update {
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, got, 0o644); err != nil {
			t.Fatal(err)
		}
	}
	want, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read golden (run with -update after tests pass): %v", err)
	}
	if !bytes.Equal(got, want) {
		t.Fatalf("golden drift: %s (%d bytes) differs from computed output (%d bytes)", path, len(want), len(got))
	}
}

// T14: identical bytes on recompute and with players shuffled in every frame.
func TestT14_Determinism(t *testing.T) {
	r := loadScenario(t, "late-siege")
	res1 := mustCompute(t, r)
	first := mustJSON(t, struct {
		R metrics.Result
		M []moments.Moment
	}{res1, detect(t, r, res1)})
	if len(res1.Ticks) == 0 {
		t.Fatal("no ticks")
	}
	res2 := mustCompute(t, r)
	if again := mustJSON(t, struct {
		R metrics.Result
		M []moments.Moment
	}{res2, detect(t, r, res2)}); !bytes.Equal(first, again) {
		t.Fatal("recompute differs")
	}
	shuffled := loadScenario(t, "late-siege")
	rng := rand.New(rand.NewSource(1))
	for i := range shuffled.Tracking {
		ps := shuffled.Tracking[i].Players
		rng.Shuffle(len(ps), func(a, b int) { ps[a], ps[b] = ps[b], ps[a] })
	}
	rng.Shuffle(len(shuffled.Match.Players), func(a, b int) {
		shuffled.Match.Players[a], shuffled.Match.Players[b] = shuffled.Match.Players[b], shuffled.Match.Players[a]
	})
	res3 := mustCompute(t, shuffled)
	if third := mustJSON(t, struct {
		R metrics.Result
		M []moments.Moment
	}{res3, detect(t, shuffled, res3)}); !bytes.Equal(first, third) {
		t.Fatal("player order changes the output")
	}
}
