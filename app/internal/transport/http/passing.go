package transporthttp

import (
	"fmt"
	"math"

	"github.com/alexwafula/pulse/app/internal/domain"
	"github.com/alexwafula/pulse/app/internal/engine/metrics"
)

type graphNode struct {
	Name                   string
	Number, Sent, Received int
	X, Y                   float64
}
type graphEdge struct {
	From, To, Path string
	Count, Width   int
	EventIDs       []string
}
type graphTeam struct {
	Name, Marker string
	Total        int
	Nodes        []graphNode
	Edges        []graphEdge
}
type graphSnapshot struct {
	TimeMS int64
	Teams  []graphTeam
}

func passingViews(replay domain.Replay) ([]graphSnapshot, error) {
	series, err := metrics.PassingSeries(replay)
	if err != nil {
		return nil, err
	}
	views := make([]graphSnapshot, 0, len(series))
	for si, snapshot := range series {
		view := graphSnapshot{TimeMS: snapshot.TimeMS}
		for ti, team := range snapshot.Teams {
			graph := graphTeam{Name: team.Team.Name, Marker: fmt.Sprintf("graph-arrow-%d-%d", si, ti), Total: team.Total}
			positions := make(map[string]graphNode)
			for i, node := range team.Nodes {
				a := 2*math.Pi*float64(i)/float64(len(team.Nodes)) - math.Pi/2
				n := graphNode{Name: node.Player.Name, Number: node.Player.Number, Sent: node.Sent, Received: node.Received, X: 140 + 88*math.Cos(a), Y: 110 + 78*math.Sin(a)}
				positions[node.Player.ID] = n
				graph.Nodes = append(graph.Nodes, n)
			}
			for _, edge := range team.Edges {
				a, b := positions[edge.FromID], positions[edge.ToID]
				dx, dy := b.X-a.X, b.Y-a.Y
				d := math.Hypot(dx, dy)
				path := fmt.Sprintf("M %.2f %.2f Q %.2f %.2f %.2f %.2f", a.X+20*dx/d, a.Y+20*dy/d, (a.X+b.X)/2-18*dy/d, (a.Y+b.Y)/2+18*dx/d, b.X-24*dx/d, b.Y-24*dy/d)
				if d == 0 {
					path = fmt.Sprintf("M %.2f %.2f C %.2f %.2f %.2f %.2f %.2f %.2f", a.X-14, a.Y-14, a.X-60, a.Y-65, a.X+60, a.Y-65, a.X+14, a.Y-14)
				}
				graph.Edges = append(graph.Edges, graphEdge{From: a.Name, To: b.Name, Path: path, Count: len(edge.EventIDs), Width: min(8, 2+len(edge.EventIDs)), EventIDs: edge.EventIDs})
			}
			view.Teams = append(view.Teams, graph)
		}
		views = append(views, view)
	}
	return views, nil
}
