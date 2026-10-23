package transporthttp

import (
	"html/template"
	"net/http"
	"path/filepath"
	"sort"

	"github.com/alexwafula/pulse/app/internal/domain"
)

type scenarioPlayer struct {
	X, Y float64
	Fill string
}

type scenarioPreview struct {
	ID, Name, Home, Away, Duration, Window, Kind string
	Brief                                        scenarioBrief
	Players, Events, Frames                      int
	Positions                                    []scenarioPlayer
	BallX, BallY                                 float64
}

func scenarioName(id string) string {
	names := map[string]string{"corner": "Corner chance", "central": "Central entry", "exchange": "Passing exchange", "late-siege": "Late siege", "calm-midfield": "Calm midfield", "end-to-end": "End to end"}
	if name := names[id]; name != "" {
		return name
	}
	return "Match replay"
}

func scenarioPreviews(catalog map[string]domain.Replay) []scenarioPreview {
	views := make([]scenarioPreview, 0, len(catalog))
	for id, replay := range catalog {
		match := replay.Match
		view := scenarioPreview{ID: id, Name: scenarioName(id), Home: match.Teams[0].Name, Away: match.Teams[1].Name,
			Duration: clockText(match.EndMS - match.StartMS), Window: clockText(match.StartMS) + " - " + clockText(match.EndMS),
			Players: len(match.Players), Events: len(replay.Events), Frames: len(replay.Tracking), Kind: "short"}
		view.Brief = briefingFor(id)
		colours := make(map[string]string, len(match.Players))
		counts := make(map[string]int)
		for _, player := range match.Players {
			counts[player.TeamID]++
			colours[player.ID] = "#e14862"
			if player.TeamID == match.Teams[1].ID {
				colours[player.ID] = "#3084ca"
			}
		}
		if counts[match.Teams[0].ID] == 11 && counts[match.Teams[1].ID] == 11 {
			view.Kind = "full"
		}
		frame := replay.Tracking[0]
		view.BallX, view.BallY = frame.Ball.X, match.Pitch.WidthM-frame.Ball.Y
		for _, player := range frame.Players {
			view.Positions = append(view.Positions, scenarioPlayer{X: player.X, Y: match.Pitch.WidthM - player.Y, Fill: colours[player.PlayerID]})
		}
		views = append(views, view)
	}
	sort.Slice(views, func(i, j int) bool {
		if (views[i].ID == "late-siege") != (views[j].ID == "late-siege") {
			return views[i].ID == "late-siege"
		}
		if (views[i].ID == "end-to-end") != (views[j].ID == "end-to-end") {
			return views[i].ID == "end-to-end"
		}
		return views[i].Name < views[j].Name
	})
	return views
}

func scenarioLibrary(catalog map[string]domain.Replay, webDir string) (http.Handler, error) {
	// The library uses only the mini pitch; its states never render, so no catalog.
	page, err := template.New("scenarios.html").Funcs(stateFuncs(nil)).
		ParseFiles(filepath.Join(webDir, "templates", "partials", "scenarios.html"), filepath.Join(webDir, "templates", "partials", "experience.html"))
	if err != nil {
		return nil, err
	}
	views := scenarioPreviews(catalog)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.Header().Set("Allow", "GET")
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		_ = page.Execute(w, views)
	}), nil
}
