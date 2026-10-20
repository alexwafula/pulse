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
	View, Clock, Locale    string
	Mode, Persona, MapMode string
	TimeMS                 int64
	Complete               bool
	Summary                summarySnapshot
	Actions                []storyAction
	Recap                  []recapItem
	Focus                  *domain.Player
	PlayerStats            playerStoryStats
	// FocusActive marks a focus player with an involvement anywhere in the replay.
	FocusActive bool
	Analytics   experienceAnalytics
	Comparison  comparisonView
}

type storyAction struct {
	ID, Clock, Kind, Team, Text, Outcome string
	Phase, Coordinates                   string
}

type playerStoryStats struct {
	Involvements, PassAttempts, Passes, Received, Shots int
}

type experienceOptions struct {
	mode, persona, playerID, teamID, mapMode, locale string
	windowMS                                         int64
}

func storyPanel(replay domain.Replay, page pageData, view string, at int64, options experienceOptions) experiencePanel {
	if options.locale == "" {
		options.locale = "en-GB"
	}
	panel := experiencePanel{View: view, TimeMS: at, Clock: clockText(at), Complete: at == replay.Match.EndMS,
		Mode: options.mode, Persona: options.persona, MapMode: options.mapMode, Locale: options.locale}
	if view == "analytics" {
		panel.Analytics = analyticsPanel(replay, page, at, options.teamID)
		return panel
	}
	if view == "comparison" {
		panel.Comparison = compareWindows(replay, page, at, options.windowMS, options.teamID)
		return panel
	}
	for _, summary := range page.Summaries {
		if summary.TimeMS <= at {
			panel.Summary = summary
		}
	}
	players := make(map[string]string)
	for _, player := range replay.Match.Players {
		players[player.ID] = player.Name
		if options.mode == "player" && player.ID == options.playerID {
			focus := player
			panel.Focus = &focus
			_, involvements := domain.ActionCounts(replay)
			panel.FocusActive = involvements[player.ID] > 0
		}
	}
	teams := make(map[string]string)
	for _, team := range replay.Match.Teams {
		teams[team.ID] = team.Name
	}
	for _, event := range replay.Events {
		if event.TimeMS > at {
			break
		}
		if options.mode == "highlights" && event.Type != "SHOT" && event.Type != "CORNER" && event.Type != "CROSS" {
			continue
		}
		if panel.Focus != nil {
			if event.ActorID != panel.Focus.ID && event.RecipientID != panel.Focus.ID {
				continue
			}
			panel.PlayerStats.Involvements++
			if event.ActorID == panel.Focus.ID {
				if event.Type == "PASS" {
					panel.PlayerStats.PassAttempts++
					if event.Outcome == "COMPLETE" {
						panel.PlayerStats.Passes++
					}
				}
				if event.Type == "SHOT" {
					panel.PlayerStats.Shots++
				}
			}
			if event.Type == "PASS" && event.Outcome == "COMPLETE" && event.RecipientID == panel.Focus.ID {
				panel.PlayerStats.Received++
			}
		}
		actor := players[event.ActorID]
		text := actor + " " + strings.ToLower(event.Type)
		switch event.Type {
		case "PASS":
			text = actor + " attempts a pass."
			if event.RecipientID != "" {
				text = fmt.Sprintf("%s attempts a pass to %s.", actor, players[event.RecipientID])
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
		if options.locale != "en-GB" {
			key := "story." + strings.ToLower(event.Type)
			if event.Type == "PASS" && event.RecipientID == "" {
				key = "story.passOnly"
			}
			text = page.catalog.text(options.locale, key, map[string]string{"actor": actor, "recipient": players[event.RecipientID]})
		}
		outcome := shotOutcome(event.Outcome)
		if event.Type != "SHOT" {
			outcome = strings.ToLower(event.Outcome)
		}
		outcome = page.catalog.text(options.locale, outcome, nil)
		// The same sentence-case key the Live timeline uses ("Pass"), never the enum ("PASS").
		kind := page.catalog.text(options.locale, event.Type[:1]+strings.ToLower(event.Type[1:]), nil)
		panel.Actions = append(panel.Actions, storyAction{ID: event.ID, Clock: clockText(event.TimeMS), Kind: kind,
			Team: teams[event.TeamID], Text: text, Outcome: outcome, Phase: event.PhaseID,
			Coordinates: fmt.Sprintf("(%.1f, %.1f) to (%.1f, %.1f) m", event.From.X, event.From.Y, event.To.X, event.To.Y)})
	}
	// The panel is a rolling source-event log, not model-generated narration.
	if options.mode == "live" && len(panel.Actions) > 5 {
		panel.Actions = panel.Actions[len(panel.Actions)-5:]
	}
	if panel.Complete {
		panel.Recap = page.Recap
		if options.locale != "en-GB" {
			panel.Recap = localizedRecap(replay, page.catalog, options.locale)
		}
	}
	return panel
}

func experiencePanelHandler(page *template.Template, replay domain.Replay, view pageData) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !allowGetHead(w, r) {
			return
		}
		kind := r.URL.Query().Get("panel")
		if kind != "story" && kind != "recap" && kind != "analytics" && kind != "comparison" {
			http.Error(w, "unsupported panel", http.StatusBadRequest)
			return
		}
		at, err := strconv.ParseInt(r.URL.Query().Get("atMs"), 10, 64)
		if err != nil || at < replay.Match.StartMS || at > replay.Match.EndMS {
			http.Error(w, "atMs must be an elapsed match millisecond within this replay", http.StatusBadRequest)
			return
		}
		options := experienceOptions{mode: r.URL.Query().Get("mode"), persona: r.URL.Query().Get("persona"),
			playerID: r.URL.Query().Get("playerId"), teamID: r.URL.Query().Get("teamId"), mapMode: r.URL.Query().Get("map"), locale: requestLocale(r)}
		options.windowMS = 10000
		if raw := r.URL.Query().Get("windowMs"); raw != "" {
			options.windowMS, err = strconv.ParseInt(raw, 10, 64)
			if err != nil || (options.windowMS != 10000 && options.windowMS != 20000 && options.windowMS != 30000) {
				http.Error(w, "unsupported comparison window", http.StatusBadRequest)
				return
			}
		}
		if options.mode == "" {
			options.mode = "live"
		}
		if options.persona == "" {
			options.persona = "CASUAL"
		}
		if options.playerID == "" {
			options.playerID = view.Focus.PlayerID
		}
		if options.teamID == "" {
			options.teamID = view.Focus.TeamID
		}
		if options.mapMode == "" {
			options.mapMode = "occupancy"
		}
		validPlayer, validTeam := false, false
		for _, player := range replay.Match.Players {
			validPlayer = validPlayer || player.ID == options.playerID
		}
		for _, team := range replay.Match.Teams {
			validTeam = validTeam || team.ID == options.teamID
		}
		if !validPlayer || !validTeam ||
			(options.persona != "CASUAL" && options.persona != "ANALYST") ||
			(options.mode != "live" && options.mode != "catchup" && options.mode != "highlights" && options.mode != "player") ||
			(options.mapMode != "occupancy" && options.mapMode != "shots" && options.mapMode != "network") {
			http.Error(w, "unsupported story or map selection", http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		if err := page.ExecuteTemplate(w, "experience-panel", storyPanel(replay, view, kind, at, options)); err != nil {
			return
		}
	}
}
