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
// It writes positions in place and returns the viewBox size that fits them all.
func layoutRing(nodes []graphNode) (int, int) {
	if len(nodes) == 0 {
		return 0, 0
	}
	var circles, labels []box
	// A ring of 2000 units is far beyond any roster; the cap only guards the loop.
	for ring := 0.0; ring < 2000; ring += 2 {
		circles, labels = circles[:0], labels[:0]
		for i := range nodes {
			angle := 2*math.Pi*float64(i)/float64(len(nodes)) - math.Pi/2
			if len(nodes) == 1 {
				angle = math.Pi / 2 // a lone node keeps its label below
			}
			node := &nodes[i]
			node.X, node.Y = ring*math.Cos(angle), ring*math.Sin(angle)
			r := nodeRadius + nodeStroke/2
			circle := box{node.X - r, node.Y - r, node.X + r, node.Y + r}
			reach := r + labelGap
			label := placeLabel(node, angle, reach)
			for label.overlaps(circle) {
				reach++
				label = placeLabel(node, angle, reach)
			}
			circles, labels = append(circles, circle), append(labels, label)
		}
		if ringClear(circles, labels) {
			break
		}
	}
	bounds := box{math.Inf(1), math.Inf(1), math.Inf(-1), math.Inf(-1)}
	for _, b := range append(circles, labels...) {
		bounds = box{math.Min(bounds.left, b.left), math.Min(bounds.top, b.top), math.Max(bounds.right, b.right), math.Max(bounds.bottom, b.bottom)}
	}
	dx, dy := graphMargin-bounds.left, graphMargin-bounds.top
	for i := range nodes {
		nodes[i].X, nodes[i].Y = round2(nodes[i].X+dx), round2(nodes[i].Y+dy)
		nodes[i].LabelX, nodes[i].LabelY = round2(nodes[i].LabelX+dx), round2(nodes[i].LabelY+dy)
	}
	return int(math.Ceil(bounds.right - bounds.left + 2*graphMargin)), int(math.Ceil(bounds.bottom - bounds.top + 2*graphMargin))
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
