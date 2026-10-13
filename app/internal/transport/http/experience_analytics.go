package transporthttp

import (
	"fmt"
	"strings"

	"github.com/alexwafula/pulse/app/internal/domain"
	"github.com/alexwafula/pulse/app/internal/engine/metrics"
)

type experienceChart struct {
	Name, HomePath, AwayPath string
	Max, Home, Away          int
}

type chartCount struct {
	timeMS     int64
	home, away int
}

type heatCell struct {
	X, Y, Opacity float64
	Seconds       string
}

type shotPoint struct {
	ID, Clock, Player, Outcome string
	X, Y                       float64
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
			view.Cells = append(view.Cells, heatCell{X: float64(i%grid.Cols) * 5, Y: 68 - float64(i/grid.Cols+1)*4,
				Opacity: 0.15 + 0.8*float64(value)/float64(grid.MaxPlayerMS), Seconds: fmt.Sprintf("%.1f", float64(value)/1000)})
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
	return view
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
	return view
}

func shotOutcome(outcome string) string {
	if outcome == "COMPLETE" {
		return "Completed shot; no goal outcome recorded"
	}
	return strings.ToLower(outcome)
}
