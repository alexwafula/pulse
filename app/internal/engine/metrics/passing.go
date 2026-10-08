package metrics

import (
	"fmt"
	"sort"

	"github.com/alexwafula/pulse/app/internal/domain"
)

// PassingSnapshot is an internal metric, not an agent exchange contract.
type PassingSnapshot struct {
	TimeMS int64
	Teams  []PassingTeam
}

type PassingTeam struct {
	Team  domain.Team
	Nodes []PassingNode
	Edges []PassingEdge
	Total int
}

type PassingNode struct {
	Player         domain.Player
	Sent, Received int
}

type PassingEdge struct {
	FromID, ToID string
	EventIDs     []string
}

// PassingSeries records cumulative directed counts at each completed PASS.
// Corners, crosses and incomplete passes are deliberately excluded.
func PassingSeries(replay domain.Replay) ([]PassingSnapshot, error) {
	if err := replay.Validate(); err != nil {
		return nil, fmt.Errorf("passing graph: %w", err)
	}
	series := []PassingSnapshot{passingAt(replay, replay.Match.StartMS)}
	last := replay.Match.StartMS
	for _, event := range replay.Events {
		if event.Type == "PASS" && event.Outcome == "COMPLETE" && event.TimeMS != last {
			series = append(series, passingAt(replay, event.TimeMS))
			last = event.TimeMS
		}
	}
	return series, nil
}

func passingAt(replay domain.Replay, cutoff int64) PassingSnapshot {
	snapshot := PassingSnapshot{TimeMS: cutoff}
	for _, team := range replay.Match.Teams {
		graph := PassingTeam{Team: team}
		nodes := make(map[string]*PassingNode)
		for _, player := range replay.Match.Players {
			if player.TeamID == team.ID {
				nodes[player.ID] = &PassingNode{Player: player}
			}
		}
		type pair struct{ from, to string }
		edges := make(map[pair]*PassingEdge)
		for _, event := range replay.Events {
			if event.TimeMS > cutoff {
				break
			}
			if event.TeamID != team.ID || event.Type != "PASS" || event.Outcome != "COMPLETE" {
				continue
			}
			key := pair{event.ActorID, event.RecipientID}
			if edges[key] == nil {
				edges[key] = &PassingEdge{FromID: key.from, ToID: key.to}
			}
			edges[key].EventIDs = append(edges[key].EventIDs, event.ID)
			nodes[key.from].Sent++
			nodes[key.to].Received++
			graph.Total++
		}
		for _, node := range nodes {
			graph.Nodes = append(graph.Nodes, *node)
		}
		sort.Slice(graph.Nodes, func(i, j int) bool { return graph.Nodes[i].Player.ID < graph.Nodes[j].Player.ID })
		for _, edge := range edges {
			graph.Edges = append(graph.Edges, *edge)
		}
		sort.Slice(graph.Edges, func(i, j int) bool {
			a, b := graph.Edges[i], graph.Edges[j]
			if a.FromID != b.FromID {
				return a.FromID < b.FromID
			}
			return a.ToID < b.ToID
		})
		snapshot.Teams = append(snapshot.Teams, graph)
	}
	return snapshot
}
