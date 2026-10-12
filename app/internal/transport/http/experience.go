package transporthttp

import (
	"fmt"
	"html/template"
	"net/http"
	"strconv"
	"strings"

	"github.com/alexwafula/pulse/app/internal/domain"
)

// Presentation data only: the shared v2 contracts and cue gate stay unchanged.
type experiencePanel struct {
	View, Clock string
	TimeMS      int64
	Complete    bool
	Summary     summarySnapshot
	Actions     []storyAction
	Recap       []recapItem
}

type storyAction struct {
	ID, Clock, Kind, Team, Text, Outcome string
}

func storyPanel(replay domain.Replay, page pageData, view string, at int64) experiencePanel {
	panel := experiencePanel{View: view, TimeMS: at, Clock: clockText(at), Complete: at == replay.Match.EndMS}
	for _, summary := range page.Summaries {
		if summary.TimeMS <= at {
			panel.Summary = summary
		}
	}
	players := make(map[string]string)
	for _, player := range replay.Match.Players {
		players[player.ID] = player.Name
	}
	teams := make(map[string]string)
	for _, team := range replay.Match.Teams {
		teams[team.ID] = team.Name
	}
	for _, event := range replay.Events {
		if event.TimeMS > at {
			break
		}
		actor := players[event.ActorID]
		text := actor + " " + strings.ToLower(event.Type)
		switch event.Type {
		case "PASS":
			text = actor + " attempts a pass."
			if event.RecipientID != "" {
				text = fmt.Sprintf("%s passes to %s.", actor, players[event.RecipientID])
			}
		case "CARRY":
			text = actor + " carries the ball."
		case "CROSS":
			text = actor + " delivers a cross."
		case "CLEARANCE":
			text = actor + " clears the ball."
		case "CORNER":
			text = actor + " takes a corner."
		case "SHOT":
			text = actor + " attempts a shot."
		}
		outcome := strings.ToLower(event.Outcome)
		if event.Type == "SHOT" && event.Outcome == "COMPLETE" {
			outcome = "Completed shot; no goal outcome recorded"
		}
		panel.Actions = append(panel.Actions, storyAction{ID: event.ID, Clock: clockText(event.TimeMS), Kind: event.Type,
			Team: teams[event.TeamID], Text: text, Outcome: outcome})
	}
	// The panel is a rolling source-event log, not model-generated narration.
	if len(panel.Actions) > 5 {
		panel.Actions = panel.Actions[len(panel.Actions)-5:]
	}
	if panel.Complete {
		panel.Recap = page.Recap
	}
	return panel
}

func experiencePanelHandler(page *template.Template, replay domain.Replay, view pageData) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.Header().Set("Allow", http.MethodGet)
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		kind := r.URL.Query().Get("panel")
		if kind != "story" && kind != "recap" {
			http.Error(w, "unsupported panel", http.StatusBadRequest)
			return
		}
		at, err := strconv.ParseInt(r.URL.Query().Get("atMs"), 10, 64)
		if err != nil || at < replay.Match.StartMS || at > replay.Match.EndMS {
			http.Error(w, "atMs must be an elapsed match millisecond within this replay", http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		if err := page.ExecuteTemplate(w, "experience-panel", storyPanel(replay, view, kind, at)); err != nil {
			return
		}
	}
}
