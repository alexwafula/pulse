package transporthttp

import (
	"fmt"
	"strings"

	"github.com/alexwafula/pulse/app/internal/domain"
)

type comparisonWindow struct {
	Label                  string
	StartMS, EndMS         int64
	ReplayEndMS            int64
	StartClock, EndClock   string
	Passes, Entries, Shots int
	Lanes                  [3]int
	EventIDs               []string
	Paths                  []comparisonPath
}

type comparisonPath struct {
	ID, Kind       string
	X1, Y1, X2, Y2 float64
}

type comparisonRow struct {
	Name, Delta                            string
	Before, After, BeforeWidth, AfterWidth int
}

type comparisonView struct {
	Available     bool
	Team          domain.Team
	TeamIndex     int
	Seconds       int64
	Before, After comparisonWindow
	Rows          []comparisonRow
}

func compareWindows(replay domain.Replay, page pageData, at, windowMS int64, teamID string) comparisonView {
	view := comparisonView{Seconds: windowMS / 1000}
	for i, team := range replay.Match.Teams {
		if team.ID == teamID {
			view.Team, view.TeamIndex = team, i
		}
	}
	if windowMS <= 0 || at-replay.Match.StartMS < 2*windowMS {
		return view
	}
	view.Available = true
	view.Before = comparisonEvents(replay, page, teamID, at-2*windowMS, at-windowMS, false)
	view.After = comparisonEvents(replay, page, teamID, at-windowMS, at, true)
	view.Before.Label, view.After.Label = "Earlier", "Recent"
	for _, metric := range []struct {
		name          string
		before, after int
	}{
		{"Completed passes", view.Before.Passes, view.After.Passes},
		{"Box entries", view.Before.Entries, view.After.Entries},
		{"Shot attempts", view.Before.Shots, view.After.Shots},
		{"Left", view.Before.Lanes[0], view.After.Lanes[0]},
		{"Centre", view.Before.Lanes[1], view.After.Lanes[1]},
		{"Right", view.Before.Lanes[2], view.After.Lanes[2]},
	} {
		maximum := max(1, metric.before, metric.after)
		view.Rows = append(view.Rows, comparisonRow{Name: metric.name, Before: metric.before, After: metric.after,
			Delta: fmt.Sprintf("%+d", metric.after-metric.before), BeforeWidth: metric.before * 100 / maximum, AfterWidth: metric.after * 100 / maximum})
	}
	return view
}

// Half-open earlier window and closed recent window assign the shared boundary
// exactly once. Entry and lane membership reuse the existing Go metric series.
func comparisonEvents(replay domain.Replay, page pageData, teamID string, start, end int64, inclusiveEnd bool) comparisonWindow {
	w := comparisonWindow{StartMS: start, EndMS: end, StartClock: clockText(start), EndClock: clockText(end), EventIDs: []string{}, Paths: []comparisonPath{}}
	w.ReplayEndMS = end
	if !inclusiveEnd {
		w.ReplayEndMS--
	}
	entries := map[string]bool{}
	lanes := map[string]int{}
	for _, snapshot := range page.Attacks {
		if snapshot.TimeMS > end {
			break
		}
		for _, team := range snapshot.Teams {
			if team.Team.ID != teamID {
				continue
			}
			for _, id := range team.EntryEventIDs {
				entries[id] = true
			}
			for index, lane := range team.Lanes {
				for _, id := range lane.EventIDs {
					lanes[id] = index
				}
			}
		}
	}
	for _, e := range replay.Events {
		if e.TimeMS > end {
			break
		}
		if e.TeamID != teamID || e.TimeMS < start || (e.TimeMS == end && !inclusiveEnd) {
			continue
		}
		if e.Type == "PASS" && e.Outcome == "COMPLETE" {
			w.Passes++
		}
		if e.Type == "SHOT" {
			w.Shots++
		}
		if entries[e.ID] {
			w.Entries++
		}
		if lane, ok := lanes[e.ID]; ok {
			w.Lanes[lane]++
		}
		if (e.Type == "PASS" || e.Type == "CARRY") && e.Outcome == "COMPLETE" || e.Type == "SHOT" {
			w.EventIDs = append(w.EventIDs, e.ID)
			w.Paths = append(w.Paths, comparisonPath{ID: e.ID, Kind: strings.ToLower(e.Type), X1: e.From.X, Y1: replay.Match.Pitch.WidthM - e.From.Y, X2: e.To.X, Y2: replay.Match.Pitch.WidthM - e.To.Y})
		}
	}
	return w
}
