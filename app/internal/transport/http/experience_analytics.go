package transporthttp

import (
	"fmt"
	"math"
	"strings"

	"github.com/alexwafula/pulse/app/internal/domain"
	"github.com/alexwafula/pulse/app/internal/engine/metrics"
)

type experienceChart struct {
	Name, HomePath, AwayPath string
	HomeArea, AwayArea       string
	EndX, HomeY, AwayY       float64
	Max, Home, Away          int
}

type chartCount struct {
	timeMS     int64
	home, away int
}

type heatCell struct {
	X, Y, Opacity float64
	Seconds       string
	SourceY       float64
	Detail        string
}

type shotPoint struct {
	ID, Clock, Player, Outcome string
	X, Y                       float64
}

type mapNetworkNode struct {
	ID, Name      string
	Evidence      string
	Number, Count int
	X, Y, Radius  float64
}

type mapNetworkEdge struct {
	From, To, Path string
	Count          int
	EventIDs       []string
}

type experienceAnalytics struct {
	Team                      domain.Team
	HomeName, AwayName        string
	StartClock, EndClock      string
	Charts                    []experienceChart
	Lanes                     []metrics.LaneCount
	LaneMax                   int
	Cells                     []heatCell
	Shots                     []shotPoint
	PlayerSeconds, MaxSeconds string
	SampleGap                 string
	TrackingEmpty             bool
	TeamIndex                 int
	NetworkNodes              []mapNetworkNode
	NetworkEdges              []mapNetworkEdge
}

func analyticsPanel(replay domain.Replay, page pageData, at int64, teamID string) experienceAnalytics {
	view := experienceAnalytics{HomeName: replay.Match.Teams[0].Name, AwayName: replay.Match.Teams[1].Name,
		StartClock: clockText(replay.Match.StartMS), EndClock: clockText(replay.Match.EndMS), LaneMax: 1}
	teamIndex := 0
	for i, team := range replay.Match.Teams {
		if team.ID == teamID {
			view.Team, teamIndex = team, i
		}
	}
	view.TeamIndex = teamIndex
	var passes, shots, entries []chartCount
	for _, snapshot := range page.Graphs {
		if snapshot.TimeMS > at {
			break
		}
		passes = append(passes, chartCount{snapshot.TimeMS, snapshot.Teams[0].Total, snapshot.Teams[1].Total})
	}
	for _, snapshot := range page.Attacks {
		if snapshot.TimeMS > at {
			break
		}
		shots = append(shots, chartCount{snapshot.TimeMS, snapshot.Teams[0].Shots, snapshot.Teams[1].Shots})
		entries = append(entries, chartCount{snapshot.TimeMS, snapshot.Teams[0].BoxEntries, snapshot.Teams[1].BoxEntries})
		view.Lanes = snapshot.Teams[teamIndex].Lanes
	}
	view.Charts = []experienceChart{
		countChart("Completed passes", replay.Match, at, passes),
		countChart("Shot attempts", replay.Match, at, shots),
		countChart("Box entries", replay.Match, at, entries),
	}
	for _, lane := range view.Lanes {
		view.LaneMax = max(view.LaneMax, lane.Count)
	}
	grid, err := metrics.TrackingOccupancy(replay, at, teamID, "")
	if err == nil {
		view.TrackingEmpty = grid.TotalPlayerMS == 0
		view.PlayerSeconds = fmt.Sprintf("%.1f", float64(grid.TotalPlayerMS)/1000)
		view.MaxSeconds = fmt.Sprintf("%.1f", float64(grid.MaxPlayerMS)/1000)
		view.SampleGap = fmt.Sprintf("%.1f", float64(grid.MaxSampleGapMS)/1000)
		for i, value := range grid.PlayerMS {
			if value == 0 {
				continue
			}
			x, y := float64(i%grid.Cols)*5, float64(i/grid.Cols)*4
			seconds := fmt.Sprintf("%.1f", float64(value)/1000)
			view.Cells = append(view.Cells, heatCell{X: x, Y: 68 - y - 4, SourceY: y,
				Opacity: 0.15 + 0.8*float64(value)/float64(grid.MaxPlayerMS), Seconds: seconds,
				Detail: fmt.Sprintf("x %.0f-%.0f m, y %.0f-%.0f m: %s player-seconds", x, x+5, y, y+4, seconds)})
		}
	}
	players := make(map[string]string)
	for _, player := range replay.Match.Players {
		players[player.ID] = player.Name
	}
	for _, event := range replay.Events {
		if event.TimeMS > at {
			break
		}
		if event.Type == "SHOT" && event.TeamID == teamID {
			view.Shots = append(view.Shots, shotPoint{ID: event.ID, Clock: clockText(event.TimeMS), Player: players[event.ActorID],
				Outcome: shotOutcome(event.Outcome), X: event.From.X, Y: replay.Match.Pitch.WidthM - event.From.Y})
		}
	}
	view.NetworkNodes, view.NetworkEdges = pitchNetwork(replay, at, teamID)
	return view
}

// Positions average only completed-pass involvement locations, not inferred touches.
func pitchNetwork(replay domain.Replay, at int64, teamID string) ([]mapNetworkNode, []mapNetworkEdge) {
	positions := make(map[string]domain.Point)
	counts := make(map[string]int)
	evidence := make(map[string][]string)
	type pair struct{ from, to string }
	links := make(map[pair][]string)
	order := []pair{}
	for _, event := range replay.Events {
		if event.TimeMS > at {
			break
		}
		if event.TeamID != teamID || event.Type != "PASS" || event.Outcome != "COMPLETE" {
			continue
		}
		for _, involvement := range []struct {
			id    string
			point domain.Point
		}{{event.ActorID, event.From}, {event.RecipientID, event.To}} {
			position := positions[involvement.id]
			position.X += involvement.point.X
			position.Y += involvement.point.Y
			positions[involvement.id] = position
			counts[involvement.id]++
			evidence[involvement.id] = append(evidence[involvement.id], event.ID)
		}
		key := pair{event.ActorID, event.RecipientID}
		if len(links[key]) == 0 {
			order = append(order, key)
		}
		links[key] = append(links[key], event.ID)
	}
	maximum := 1
	for _, count := range counts {
		maximum = max(maximum, count)
	}
	var nodes []mapNetworkNode
	lookup := make(map[string]mapNetworkNode)
	for _, player := range replay.Match.Players {
		count := counts[player.ID]
		if count == 0 {
			continue
		}
		position := positions[player.ID]
		node := mapNetworkNode{ID: player.ID, Name: player.Name, Number: player.Number, Count: count,
			Evidence: strings.Join(evidence[player.ID], " "),
			X:        position.X / float64(count), Y: 68 - position.Y/float64(count), Radius: 1.6 + 1.6*math.Sqrt(float64(count)/float64(maximum))}
		nodes = append(nodes, node)
		lookup[player.ID] = node
	}
	var edges []mapNetworkEdge
	for _, key := range order {
		from, to := lookup[key.from], lookup[key.to]
		edges = append(edges, mapNetworkEdge{From: from.Name, To: to.Name, Count: len(links[key]), EventIDs: links[key],
			Path: fmt.Sprintf("M %.3f %.3f L %.3f %.3f", from.X, from.Y, to.X, to.Y)})
	}
	return nodes, edges
}

func countChart(name string, match domain.Match, at int64, counts []chartCount) experienceChart {
	view := experienceChart{Name: name, Max: 1}
	for _, count := range counts {
		view.Max = max(view.Max, count.home, count.away)
		view.Home, view.Away = count.home, count.away
	}
	x := func(ms int64) float64 { return 14 + 252*float64(ms-match.StartMS)/float64(match.EndMS-match.StartMS) }
	y := func(count int) float64 { return 88 - 72*float64(count)/float64(view.Max) }
	paths := []*string{&view.HomePath, &view.AwayPath}
	for team, path := range paths {
		var b strings.Builder
		fmt.Fprintf(&b, "M 14 88")
		for _, count := range counts {
			value := count.home
			if team == 1 {
				value = count.away
			}
			fmt.Fprintf(&b, " H %.2f V %.2f", x(count.timeMS), y(value))
		}
		fmt.Fprintf(&b, " H %.2f", x(at))
		*path = b.String()
	}
	view.EndX, view.HomeY, view.AwayY = x(at), y(view.Home), y(view.Away)
	view.HomeArea = fmt.Sprintf("%s L %.2f 88 H 14 Z", view.HomePath, view.EndX)
	view.AwayArea = fmt.Sprintf("%s L %.2f 88 H 14 Z", view.AwayPath, view.EndX)
	return view
}

func shotOutcome(outcome string) string {
	if outcome == "COMPLETE" {
		return "Completed shot; no goal outcome recorded"
	}
	return strings.ToLower(outcome)
}
