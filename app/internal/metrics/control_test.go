package metrics_test

import (
	"encoding/json"
	"fmt"
	"math"
	"path/filepath"
	"testing"

	"github.com/alexwafula/pulse/app/internal/domain"
	"github.com/alexwafula/pulse/app/internal/metrics"
	"github.com/alexwafula/pulse/app/internal/simulator"
)

// dm converts metres to the decimetre units used inside the metrics package.
func dm(metres float64) float64 { return metres * 10 }

func repoPath(parts ...string) string {
	return filepath.Join(append([]string{"..", "..", ".."}, parts...)...)
}

func loadScenario(t *testing.T, name string) domain.Replay {
	t.Helper()
	r, err := simulator.Load(repoPath("data", "scenarios", name+".json"))
	if err != nil {
		t.Fatalf("load %s: %v", name, err)
	}
	return r
}

func mustCompute(t *testing.T, r domain.Replay) metrics.Result {
	t.Helper()
	res, err := metrics.Compute(r, metrics.DefaultParams())
	if err != nil {
		t.Fatalf("compute %s: %v", r.Match.ID, err)
	}
	return res
}

func toySides() [2]metrics.TeamSide {
	return [2]metrics.TeamSide{{ID: "a", AttacksRight: true}, {ID: "b", AttacksRight: false}}
}

// cellCentreM returns a cell centre in metres for the default 21x14 grid.
func cellCentreM(i, j int) (float64, float64) {
	return (float64(i) + 0.5) * 5.0, (float64(j) + 0.5) * 68.0 / 14.0
}

func mustJSON(t *testing.T, v any) []byte {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	return b
}

// toyReplay builds a valid contract-v2 replay with one player per team and
// frames every 200 ms from 600000 to endMS. ball(t) supplies the ball.
func toyReplay(endMS int64, ball func(t int64) domain.Ball) domain.Replay {
	const start = int64(600000)
	m := domain.Match{
		SchemaVersion: domain.SchemaVersion, ID: "match-toy", Period: 1, StartMS: start, EndMS: endMS,
		Pitch: domain.Pitch{LengthM: 105, WidthM: 68},
		Teams: []domain.Team{{ID: "a", Name: "Toy A", AttackingDirection: "RIGHT"}, {ID: "b", Name: "Toy B", AttackingDirection: "LEFT"}},
		Players: []domain.Player{
			{ID: "a1", TeamID: "a", Name: "Toy A One", Number: 1},
			{ID: "b1", TeamID: "b", Name: "Toy B One", Number: 1},
		},
	}
	r := domain.Replay{SchemaVersion: domain.SchemaVersion, Match: m,
		Events: []domain.Event{{SchemaVersion: domain.SchemaVersion, ID: "evt-01", MatchID: m.ID, PhaseID: "ph-1",
			Period: 1, TimeMS: start, Type: "CARRY", TeamID: "a", ActorID: "a1",
			From: domain.Point{X: 50, Y: 34}, To: domain.Point{X: 50, Y: 34}, Outcome: "COMPLETE"}}}
	for t := start; t <= endMS; t += 200 {
		r.Tracking = append(r.Tracking, domain.TrackingFrame{SchemaVersion: domain.SchemaVersion, MatchID: m.ID,
			Period: 1, TimeMS: t, Ball: ball(t), Players: []domain.TrackedPlayer{
				{PlayerID: "a1", X: 50, Y: 34}, {PlayerID: "b1", X: 60, Y: 34}}})
	}
	return r
}

// T1: mirror-symmetric toy gives equal shares, bit for bit.
func TestT1_MirrorSymmetricToyEqualShares(t *testing.T) {
	p := metrics.DefaultParams()
	base := []struct{ x, y, vx, vy float64 }{
		{30, 20, 1.5, 0}, {45, 34, 0, 2}, {20, 50, -1, 1}, {50, 10, 3, 0.5}, {8, 34, 0, 0},
	}
	var players []metrics.PlayerState
	for i, b := range base {
		players = append(players,
			metrics.PlayerState{ID: fmt.Sprintf("a%d", i), TeamID: "a", X: dm(b.x), Y: dm(b.y), VX: dm(b.vx), VY: dm(b.vy)},
			metrics.PlayerState{ID: fmt.Sprintf("b%d", i), TeamID: "b", X: 1050 - dm(b.x), Y: dm(b.y), VX: -dm(b.vx), VY: dm(b.vy)})
	}
	s := metrics.ControlSurface(metrics.Snapshot{Players: players, Ball: metrics.BallState{X: 525, Y: 340}}, toySides(), p)
	if s.Share(0) != s.Share(1) {
		t.Fatalf("shares differ: %.17g vs %.17g", s.Share(0), s.Share(1))
	}
	if math.Abs(s.Share(0)-0.5) > 1e-12 {
		t.Fatalf("share %.17g not within 1e-12 of 0.5", s.Share(0))
	}
	if s.FinalThird(0) != s.FinalThird(1) {
		t.Fatalf("final thirds differ: %.17g vs %.17g", s.FinalThird(0), s.FinalThird(1))
	}
}

// T8b: the x-mirror is exact for off-grid velocities too. On the fixtures,
// positions are on a 0.5 dm grid and velocities on a 1.25 dm/s grid, so v·τ is
// exactly representable and p + v·τ never rounds; T8 alone cannot detect the
// forbidden c − (p + v·τ) order. Here velocities have many significant bits and
// p and 1050 − p fall in different binades, so that order breaks the mirror.
func TestT8b_MirrorExactOffGridVelocities(t *testing.T) {
	p := metrics.DefaultParams()
	base := []struct{ x, y, vx, vy float64 }{
		{30.5, 20, 1.37, -0.91}, {41.5, 34, -2.713, 0.333}, {12, 50.5, 3.141, 1.618}, {70.5, 10, -1.234567, 2.71828},
		{88, 34, 0.577, -0.1}, {52.5, 60, 4.4444, 0.7071}, {25, 5, -0.3, 3.3}, {95.5, 47, 2.2, -2.9},
	}
	var players, mirrored []metrics.PlayerState
	for i, b := range base {
		team := "a"
		if i%2 == 1 {
			team = "b"
		}
		pl := metrics.PlayerState{ID: fmt.Sprintf("p%d", i), TeamID: team, X: dm(b.x), Y: dm(b.y), VX: dm(b.vx), VY: dm(b.vy)}
		players = append(players, pl)
		m := pl
		m.X, m.VX = 1050-pl.X, -pl.VX
		mirrored = append(mirrored, m)
	}
	ball := metrics.BallState{X: dm(41.5), Y: dm(34.5)}
	mball := ball
	mball.X = 1050 - ball.X
	sides := toySides()
	msides := [2]metrics.TeamSide{{ID: "a", AttacksRight: false}, {ID: "b", AttacksRight: true}}
	s := metrics.ControlSurface(metrics.Snapshot{Players: players, Ball: ball}, sides, p)
	ms := metrics.ControlSurface(metrics.Snapshot{Players: mirrored, Ball: mball}, msides, p)
	for team := 0; team < 2; team++ {
		for i := 0; i < p.Grid.Cols; i++ {
			for j := 0; j < p.Grid.Rows; j++ {
				a := s.Control[team][i*p.Grid.Rows+j]
				b := ms.Control[team][(p.Grid.Cols-1-i)*p.Grid.Rows+j]
				if a != b {
					t.Fatalf("team %d cell (%d,%d): %.17g vs mirrored %.17g", team, i, j, a, b)
				}
			}
		}
		if s.Share(team) != ms.Share(team) || s.FinalThird(team) != ms.FinalThird(team) {
			t.Fatalf("team %d share/finalThird %.17g/%.17g vs %.17g/%.17g",
				team, s.Share(team), s.FinalThird(team), ms.Share(team), ms.FinalThird(team))
		}
	}
	if s.Entropy() != ms.Entropy() {
		t.Fatalf("entropy %.17g vs %.17g", s.Entropy(), ms.Entropy())
	}
	c, ok := metrics.FindCarrier(metrics.Snapshot{Players: players, Ball: ball}, p)
	mc, mok := metrics.FindCarrier(metrics.Snapshot{Players: mirrored, Ball: mball}, p)
	if !ok || !mok || c.ID != mc.ID {
		t.Fatalf("carrier %v/%v %q/%q", ok, mok, c.ID, mc.ID)
	}
	pa := metrics.PressingIntensity(c, metrics.Snapshot{Players: players, Ball: ball}, p)
	pb := metrics.PressingIntensity(mc, metrics.Snapshot{Players: mirrored, Ball: mball}, p)
	if pa != pb {
		t.Fatalf("pressing %.17g vs mirrored %.17g", pa, pb)
	}
}

// T2: coincident players give exactly 0.5 everywhere and entropy 1.
func TestT2_CoincidentToyMaxEntropy(t *testing.T) {
	p := metrics.DefaultParams()
	var players []metrics.PlayerState
	for i, xy := range [][2]float64{{30, 20}, {52.5, 34}, {70, 50}, {10, 34}} {
		v := float64(i) - 1.5
		players = append(players,
			metrics.PlayerState{ID: fmt.Sprintf("a%d", i), TeamID: "a", X: dm(xy[0]), Y: dm(xy[1]), VX: dm(v), VY: dm(-v)},
			metrics.PlayerState{ID: fmt.Sprintf("b%d", i), TeamID: "b", X: dm(xy[0]), Y: dm(xy[1]), VX: dm(v), VY: dm(-v)})
	}
	s := metrics.ControlSurface(metrics.Snapshot{Players: players}, toySides(), p)
	if len(s.Control[0]) != p.Grid.Cols*p.Grid.Rows || len(s.Control[1]) != p.Grid.Cols*p.Grid.Rows {
		t.Fatalf("grid sizes %d/%d, want %d", len(s.Control[0]), len(s.Control[1]), p.Grid.Cols*p.Grid.Rows)
	}
	for k := range s.Control[0] {
		if s.Control[0][k] != 0.5 || s.Control[1][k] != 0.5 {
			t.Fatalf("cell %d: %.17g / %.17g, want exactly 0.5", k, s.Control[0][k], s.Control[1][k])
		}
	}
	if math.Abs(s.Entropy()-1) > 1e-15 {
		t.Fatalf("entropy %.17g, want 1 within 1e-15", s.Entropy())
	}
	if s.Share(0) != 0.5 || s.Share(1) != 0.5 {
		t.Fatalf("shares %.17g / %.17g, want 0.5", s.Share(0), s.Share(1))
	}
}

// T3: a lone attacker with defenders beyond 40 m controls its own region.
func TestT3_LoneAttackerControlsOwnRegion(t *testing.T) {
	p := metrics.DefaultParams()
	players := []metrics.PlayerState{{ID: "a0", TeamID: "a", X: dm(80), Y: dm(34)}}
	for k := 0; k < 11; k++ {
		players = append(players, metrics.PlayerState{ID: fmt.Sprintf("b%02d", k), TeamID: "b", X: dm(35), Y: dm(4 + 6*float64(k))})
	}
	s := metrics.ControlSurface(metrics.Snapshot{Players: players}, toySides(), p)
	checked := 0
	for i := 0; i < p.Grid.Cols; i++ {
		for j := 0; j < p.Grid.Rows; j++ {
			x, y := cellCentreM(i, j)
			if math.Hypot(x-80, y-34) > 5 {
				continue
			}
			checked++
			if len(s.Control[0]) == 0 {
				t.Fatal("empty surface")
			}
			if c := s.Control[0][i*p.Grid.Rows+j]; c < 0.9 {
				t.Errorf("cell (%d,%d) control %.4f < 0.9", i, j, c)
			}
		}
	}
	if checked == 0 {
		t.Fatal("no cells within 5 m of the attacker")
	}
}

// T4: entropy in [0,1], shares sum to 1, cells in [0,1] on every tick.
func TestT4_Properties(t *testing.T) {
	for _, tc := range []struct {
		name  string
		ticks int
	}{{"late-siege", 161}, {"calm-midfield", 121}} {
		t.Run(tc.name, func(t *testing.T) {
			res := mustCompute(t, loadScenario(t, tc.name))
			if res.TrackingMetrics != metrics.TrackingSupported || len(res.Ticks) != tc.ticks {
				t.Fatalf("trackingMetrics %q, %d ticks; want supported, %d", res.TrackingMetrics, len(res.Ticks), tc.ticks)
			}
			for _, tk := range res.Ticks {
				if tk.Entropy < 0 || tk.Entropy > 1 {
					t.Fatalf("%d: entropy %.17g", tk.TimeMS, tk.Entropy)
				}
				a, b := tk.Teams[res.Teams[0]], tk.Teams[res.Teams[1]]
				if math.Abs(a.Share+b.Share-1) > 1e-12 {
					t.Fatalf("%d: shares sum %.17g", tk.TimeMS, a.Share+b.Share)
				}
				if tk.Surface == nil {
					t.Fatalf("%d: no surface", tk.TimeMS)
				}
				for k := range tk.Surface.Control[0] {
					for team := 0; team < 2; team++ {
						if c := tk.Surface.Control[team][k]; c < 0 || c > 1 {
							t.Fatalf("%d: cell %d control %.17g", tk.TimeMS, k, c)
						}
					}
				}
			}
		})
	}
}
