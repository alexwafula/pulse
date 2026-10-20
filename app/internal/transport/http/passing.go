package transporthttp

import (
	"fmt"
	"math"

	"github.com/alexwafula/pulse/app/internal/domain"
	"github.com/alexwafula/pulse/app/internal/engine/metrics"
)

// Drawer passing-graph geometry, in SVG user units. Labels are 13px bold text
// (pitch.css); the per-character width over-estimates that font so that the
// estimated boxes used for spacing are never smaller than the rendered ones.
const (
	nodeRadius     = 18.0
	nodeStroke     = 3.5 // the hover/focus stroke, the widest the circle gets
	labelGap       = 6.0
	labelCharWidth = 9.0
	labelHeight    = 18.0
	labelPadding   = 3.0
	graphMargin    = 8.0
	edgeRoom       = 32.0 // the least gap between two circles, so an edge and its arrowhead show
	// maxGraphWidth fits the narrowest drawer (358px at 390px wide, 350px at
	// 1440px), so the graph is drawn unscaled.
	maxGraphWidth = 340.0
)

type graphNode struct {
	ID, Name               string
	Number, Sent, Received int
	X, Y                   float64
	LabelX, LabelY         float64
	Anchor                 string
}
type graphEdge struct {
	From, To, Path string
	Count, Width   int
	EventIDs       []string
}
type graphTeam struct {
	ID, Name, Marker string
	Total            int
	Width, Height    int
	// Nodes are the players with a completed pass sent or received, laid out
	// for the graph; Roster keeps every player for /legacy's table and Idle
	// counts the rest, which the experience's table shows as one line.
	Nodes  []graphNode
	Roster []graphNode
	Edges  []graphEdge
	Idle   int
}
type graphSnapshot struct {
	TimeMS int64
	Teams  []graphTeam
}

type box struct{ left, top, right, bottom float64 }

// centreGap is the clear distance between the circles inscribed in two equal square boxes.
func (a box) centreGap(b box) float64 {
	return math.Hypot((a.left+a.right-b.left-b.right)/2, (a.top+a.bottom-b.top-b.bottom)/2) - (a.right - a.left)
}

func (a box) overlaps(b box) bool {
	return math.Min(a.right, b.right) > math.Max(a.left, b.left) && math.Min(a.bottom, b.bottom) > math.Max(a.top, b.top)
}

// passingViews is presentation only: it omits players with no completed pass sent or
// received (the Insights pitch-map rule) and lays out the rest; metrics are unchanged.
func passingViews(replay domain.Replay) ([]graphSnapshot, error) {
	series, err := metrics.PassingSeries(replay)
	if err != nil {
		return nil, err
	}
	views := make([]graphSnapshot, 0, len(series))
	for si, snapshot := range series {
		view := graphSnapshot{TimeMS: snapshot.TimeMS}
		for ti, team := range snapshot.Teams {
			graph := graphTeam{ID: team.Team.ID, Name: team.Team.Name, Marker: fmt.Sprintf("graph-arrow-%d-%d", si, ti), Total: team.Total}
			for _, node := range team.Nodes {
				graph.Roster = append(graph.Roster, graphNode{ID: node.Player.ID, Name: node.Player.Name, Number: node.Player.Number, Sent: node.Sent, Received: node.Received})
			}
			graph.Nodes, graph.Idle = idleNodes(graph.Roster)
			graph.Width, graph.Height = layoutRing(graph.Nodes)
			positions := make(map[string]graphNode, len(graph.Nodes))
			for _, node := range graph.Nodes {
				positions[node.ID] = node
			}
			for _, edge := range team.Edges {
				a, b := positions[edge.FromID], positions[edge.ToID]
				dx, dy := b.X-a.X, b.Y-a.Y
				d := math.Hypot(dx, dy)
				path := fmt.Sprintf("M %.2f %.2f C %.2f %.2f %.2f %.2f %.2f %.2f", a.X-14, a.Y-14, a.X-60, a.Y-65, a.X+60, a.Y-65, a.X+14, a.Y-14)
				if d != 0 {
					path = fmt.Sprintf("M %.2f %.2f Q %.2f %.2f %.2f %.2f", a.X+20*dx/d, a.Y+20*dy/d, (a.X+b.X)/2-18*dy/d, (a.Y+b.Y)/2+18*dx/d, b.X-24*dx/d, b.Y-24*dy/d)
				}
				graph.Edges = append(graph.Edges, graphEdge{From: a.Name, To: b.Name, Path: path, Count: len(edge.EventIDs), Width: min(8, 2+len(edge.EventIDs)), EventIDs: edge.EventIDs})
			}
			view.Teams = append(view.Teams, graph)
		}
		views = append(views, view)
	}
	return views, nil
}

func nodeLabel(node graphNode) string { return fmt.Sprintf("#%d %s", node.Number, node.Name) }

// layoutRing places the nodes clockwise from the top on the smallest ring whose
// labels, set radially outside their circles, clear every other label and circle.
// Past maxGraphWidth the ring stops widening and grows taller instead, so the
// drawer shows the graph at its own size and the labels keep their 13px.
// It writes positions in place and returns the viewBox size that fits them all.
func layoutRing(nodes []graphNode) (int, int) {
	if len(nodes) == 0 {
		return 0, 0
	}
	var circles, labels []box
	var bounds box
	width := func() float64 { return bounds.right - bounds.left + 2*graphMargin }
	// Radii of 2000 units are far beyond any roster; the caps only guard the loops.
	// 1. A ring, while it fits the width.
	fits, rx := false, -1.0
	for ring := 0.0; ring < 2000; ring += 2 {
		circles, labels, bounds = placeRing(nodes, ring, 0, circles[:0], labels[:0])
		if width() > maxGraphWidth {
			break
		}
		rx = ring
		if fits = ringClear(circles, labels); fits {
			break
		}
	}
	// 2. Then the widest ring that fitted, stretched into a taller stadium.
	// Labels on the straight sides point straight out, so rx may have to shrink.
	for h := 2.0; rx >= 0 && !fits && h < 2000; h += 2 {
		circles, labels, bounds = placeRing(nodes, rx, h, circles[:0], labels[:0])
		for width() > maxGraphWidth && rx > 0 {
			rx = math.Max(0, rx-2)
			circles, labels, bounds = placeRing(nodes, rx, h, circles[:0], labels[:0])
		}
		fits = width() <= maxGraphWidth && ringClear(circles, labels)
	}
	// 3. Names too long for the width at any height keep the plain ring.
	for ring := 0.0; !fits && ring < 2000; ring += 2 {
		circles, labels, bounds = placeRing(nodes, ring, 0, circles[:0], labels[:0])
		fits = ringClear(circles, labels)
	}
	dx, dy := graphMargin-bounds.left, graphMargin-bounds.top
	for i := range nodes {
		nodes[i].X, nodes[i].Y = round2(nodes[i].X+dx), round2(nodes[i].Y+dy)
		nodes[i].LabelX, nodes[i].LabelY = round2(nodes[i].LabelX+dx), round2(nodes[i].LabelY+dy)
	}
	return int(math.Ceil(bounds.right - bounds.left + 2*graphMargin)), int(math.Ceil(bounds.bottom - bounds.top + 2*graphMargin))
}

// placeRing puts the nodes clockwise from the top at equal arc lengths on a
// stadium: two semicircles of radius rx joined by straight sides of length 2h.
// With h = 0 it is a circle; a taller stadium spreads the nodes down its sides.
// Each label is pushed out along the outward normal until it clears its own
// circle. It returns the circle and label boxes and their bounds.
func placeRing(nodes []graphNode, rx, h float64, circles, labels []box) ([]box, []box, box) {
	bounds := box{math.Inf(1), math.Inf(1), math.Inf(-1), math.Inf(-1)}
	for i := range nodes {
		node := &nodes[i]
		var angle float64
		node.X, node.Y, angle = stadiumPoint(rx, h, float64(i)/float64(len(nodes)))
		if len(nodes) == 1 {
			node.X, node.Y, angle = 0, 0, math.Pi/2 // a lone node keeps its label below
		}
		r := nodeRadius + nodeStroke/2
		circle := box{node.X - r, node.Y - r, node.X + r, node.Y + r}
		reach := r + labelGap
		label := placeLabel(node, angle, reach)
		for label.overlaps(circle) {
			reach++
			label = placeLabel(node, angle, reach)
		}
		circles, labels = append(circles, circle), append(labels, label)
		for _, b := range []box{circle, label} {
			bounds = box{math.Min(bounds.left, b.left), math.Min(bounds.top, b.top), math.Max(bounds.right, b.right), math.Max(bounds.bottom, b.bottom)}
		}
	}
	return circles, labels, bounds
}

// stadiumPoint returns the point a fraction f of the way round the stadium,
// clockwise from the top centre, and the angle of its outward normal.
func stadiumPoint(rx, h, f float64) (x, y, angle float64) {
	quarter, side := math.Pi/2*rx, 2*h
	s := f * (4*quarter + 2*side)
	arc := func(cx, cy, from, length float64) (float64, float64, float64) {
		a := from
		if rx > 0 {
			a += length / rx
		}
		return cx + rx*math.Cos(a), cy + rx*math.Sin(a), a
	}
	switch {
	case s < quarter: // top cap, right half
		return arc(0, -h, -math.Pi/2, s)
	case s < quarter+side: // right side, downwards
		return rx, -h + (s - quarter), 0
	case s < 3*quarter+side: // bottom cap
		return arc(0, h, 0, s-quarter-side)
	case s < 3*quarter+2*side: // left side, upwards
		return -rx, h - (s - 3*quarter - side), math.Pi
	default: // top cap, left half
		return arc(0, -h, math.Pi, s-3*quarter-2*side)
	}
}

// placeLabel sets the node's label point at distance reach along angle and returns
// its padded box. Side labels grow away from the ring; top and bottom labels are
// centred on it, and every label's centre moves outwards by half its height.
func placeLabel(node *graphNode, angle, reach float64) box {
	cos, sin := math.Cos(angle), math.Sin(angle)
	width := labelCharWidth * float64(len([]rune(nodeLabel(*node))))
	node.LabelX, node.LabelY = node.X+reach*cos, node.Y+reach*sin+sin*labelHeight/2
	left := node.LabelX - width/2
	node.Anchor = "middle"
	switch {
	case cos > 0.3:
		node.Anchor, left = "start", node.LabelX
	case cos < -0.3:
		node.Anchor, left = "end", node.LabelX-width
	}
	return box{left - labelPadding, node.LabelY - labelHeight/2 - labelPadding, left + width + labelPadding, node.LabelY + labelHeight/2 + labelPadding}
}

func ringClear(circles, labels []box) bool {
	for i := range labels {
		for j := range labels {
			if i < j && circles[i].centreGap(circles[j]) < edgeRoom || labels[i].overlaps(circles[j]) || i < j && labels[i].overlaps(labels[j]) {
				return false
			}
		}
	}
	return true
}

func round2(value float64) float64 { return math.Round(value*100) / 100 }
