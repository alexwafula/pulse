package metrics

import (
	"math"
	"sort"
)

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

// columnSums returns C_i = Σ_j v[i*Rows+j], rows summed in ascending order.
func (s Surface) columnSums(v []float64) []float64 {
	sums := make([]float64, s.Cols)
	for i := 0; i < s.Cols; i++ {
		sum := 0.0
		for j := 0; j < s.Rows; j++ {
			sum += v[i*s.Rows+j]
		}
		sums[i] = sum
	}
	return sums
}

// pairSum adds columns as Σ_{i<cols/2} (C_i + C_{cols-1-i}) + C_mid. Each
// mirrored pair sums identically, which keeps the x-mirror exact (§2.1).
func pairSum(c []float64) float64 {
	n := len(c)
	sum := 0.0
	for i := 0; i < n/2; i++ {
		sum += c[i] + c[n-1-i]
	}
	if n%2 == 1 {
		sum += c[n/2]
	}
	return sum
}

// Share is the team's mean control over all cells.
func (s Surface) Share(team int) float64 {
	if len(s.Control[team]) == 0 {
		return 0
	}
	return pairSum(s.columnSums(s.Control[team])) / float64(s.Cols*s.Rows)
}

// FinalThird is the team's mean control over its attacking final third.
// Columns are added from the goal line outward for both directions.
func (s Surface) FinalThird(team int) float64 {
	if len(s.Control[team]) == 0 {
		return 0
	}
	c := s.columnSums(s.Control[team])
	k := s.Cols / 3
	sum := 0.0
	for n := 0; n < k; n++ {
		if s.Teams[team].AttacksRight {
			sum += c[s.Cols-1-n]
		} else {
			sum += c[n]
		}
	}
	return sum / float64(k*s.Rows)
}

// Entropy is the mean normalised binary entropy of the surface, in [0, 1].
func (s Surface) Entropy() float64 {
	if len(s.Control[0]) == 0 {
		return 0
	}
	h := make([]float64, len(s.Control[0]))
	for k, u := range s.Control[0] {
		h[k] = binaryEntropy(u, s.Control[1][k])
	}
	e := pairSum(s.columnSums(h)) / float64(s.Cols*s.Rows)
	return math.Min(1, math.Max(0, e))
}

// binaryEntropy is −(u ln u + v ln v)/ln 2 with 0·ln 0 := 0. Terms are added
// larger-first so the value does not depend on which team holds u.
func binaryEntropy(u, v float64) float64 {
	a, b := u, v
	if b > a {
		a, b = b, a
	}
	sum := float64(a * math.Log(a))
	if b > 0 {
		sum += float64(b * math.Log(b))
	}
	return -sum / math.Ln2
}

// reachTime is τ + |(c − p) − v·τ| / v_max in seconds; c, p in dm, v in dm/s.
// The offset is evaluated as (c − p) − v·τ, never c − (p + v·τ) (§2).
func reachTime(cx, cy float64, pl PlayerState, p Params) float64 {
	tau := p.Control.TauS
	dx := float64(cx-pl.X) - float64(pl.VX*tau)
	dy := float64(cy-pl.Y) - float64(pl.VY*tau)
	return tau + float64(math.Hypot(dx, dy)/(p.Control.VMaxMS*10))
}

// ControlSurface computes time-to-reach control for every grid cell.
func ControlSurface(snap Snapshot, teams [2]TeamSide, p Params) Surface {
	cols, rows := p.Grid.Cols, p.Grid.Rows
	s := Surface{Cols: cols, Rows: rows, Teams: teams,
		Control: [2][]float64{make([]float64, cols*rows), make([]float64, cols*rows)}}
	for i := 0; i < cols; i++ {
		cx := (float64(i) + 0.5) * 1050 / float64(cols)
		for j := 0; j < rows; j++ {
			cy := (float64(j) + 0.5) * 680 / float64(rows)
			best := [2]float64{math.Inf(1), math.Inf(1)}
			for _, pl := range snap.Players {
				k := teamIndex(teams, pl.TeamID)
				if k < 0 {
					continue
				}
				best[k] = math.Min(best[k], reachTime(cx, cy, pl, p))
			}
			idx := i*rows + j
			ta, tb := best[0], best[1]
			if ta == tb {
				s.Control[0][idx], s.Control[1][idx] = 0.5, 0.5
				continue
			}
			u := 1 / (1 + math.Exp(-math.Abs(tb-ta)/p.Control.SigmaS))
			if ta < tb {
				s.Control[0][idx], s.Control[1][idx] = u, 1-u
			} else {
				s.Control[0][idx], s.Control[1][idx] = 1-u, u
			}
		}
	}
	return s
}

func teamIndex(teams [2]TeamSide, id string) int {
	for k, t := range teams {
		if t.ID == id {
			return k
		}
	}
	return -1
}

// byID returns a copy of the players sorted by ID.
func byID(players []PlayerState) []PlayerState {
	out := append([]PlayerState(nil), players...)
	sort.Slice(out, func(a, b int) bool { return out[a].ID < out[b].ID })
	return out
}

// FindCarrier returns the ball carrier, if any (docs/metrics.md §4): the
// nearest player within CarrierRadiusM with ball z ≤ CarrierMaxBallZM. Ties go
// to the lowest player ID.
func FindCarrier(snap Snapshot, p Params) (PlayerState, bool) {
	if snap.Ball.Z > p.Pressing.CarrierMaxBallZM*10 {
		return PlayerState{}, false
	}
	radius := p.Pressing.CarrierRadiusM * 10
	var best PlayerState
	bestD, found := math.Inf(1), false
	for _, pl := range byID(snap.Players) {
		d := math.Hypot(snap.Ball.X-pl.X, snap.Ball.Y-pl.Y)
		if d <= radius && d < bestD {
			best, bestD, found = pl, d, true
		}
	}
	return best, found
}

// sigmoid is a numerically stable logistic function.
func sigmoid(x float64) float64 {
	if x >= 0 {
		return 1 / (1 + math.Exp(-x))
	}
	e := math.Exp(x)
	return e / (1 + e)
}

// PressingIntensity is the chance that at least one opponent of the carrier
// can reach it within Pressing.ReachS. Defenders are multiplied in ID order.
func PressingIntensity(carrier PlayerState, snap Snapshot, p Params) float64 {
	prod := 1.0
	for _, pl := range byID(snap.Players) {
		if pl.TeamID == carrier.TeamID {
			continue
		}
		t := reachTime(carrier.X, carrier.Y, pl, p)
		x := (p.Pressing.ReachS - t) / p.Pressing.WidthS
		prod *= sigmoid(-x)
	}
	return 1 - prod
}
