package transporthttp

import (
	"encoding/json"
	"github.com/alexwafula/pulse/app/internal/domain"
	"math"
	"net/http"
	"sort"
)

// Presentation-only data; these estimates are not agent facts or v2 cues.
type shotDetail struct {
	EventID      string          `json:"eventId"`
	DistanceM    float64         `json:"distanceM"`
	AngleDegrees float64         `json:"angleDegrees"`
	Posts        [2]domain.Point `json:"posts"`
}
type detailCounts struct {
	Passes   int `json:"passes"`
	Shots    int `json:"shots"`
	Received int `json:"received"`
}
type detailWindow struct {
	TimeMS  int64                   `json:"timeMs"`
	Teams   map[string]detailCounts `json:"teams"`
	Players map[string]detailCounts `json:"players"`
}
type matchDetails struct {
	Shots   []shotDetail   `json:"shots"`
	Windows []detailWindow `json:"windows"`
}

func calculateShot(event domain.Event, team domain.Team, pitch domain.Pitch) shotDetail {
	goal := domain.Point{X: pitch.LengthM, Y: pitch.WidthM / 2}
	if team.AttackingDirection == "LEFT" {
		goal.X = 0
	}
	// Nominal 7.32 m goal, identical to the pitch renderers; no xG estimate.
	posts := [2]domain.Point{{X: goal.X, Y: goal.Y - 3.66}, {X: goal.X, Y: goal.Y + 3.66}}
	ax, ay := posts[0].X-event.From.X, posts[0].Y-event.From.Y
	bx, by := posts[1].X-event.From.X, posts[1].Y-event.From.Y
	return shotDetail{event.ID, math.Hypot(goal.X-event.From.X, goal.Y-event.From.Y), math.Atan2(math.Abs(ax*by-ay*bx), ax*bx+ay*by) * 180 / math.Pi, posts}
}

func buildMatchDetails(replay domain.Replay) matchDetails {
	result := matchDetails{Shots: make([]shotDetail, 0), Windows: make([]detailWindow, 0)}
	cutoffs := map[int64]bool{replay.Match.StartMS: true}
	for _, event := range replay.Events {
		cutoffs[event.TimeMS] = true
		// Inclusive lower window bound: an action expires at event + 20s + 1ms.
		if expires := event.TimeMS + 20001; expires <= replay.Match.EndMS {
			cutoffs[expires] = true
		}
		if event.Type == "SHOT" {
			for _, team := range replay.Match.Teams {
				if team.ID == event.TeamID {
					result.Shots = append(result.Shots, calculateShot(event, team, replay.Match.Pitch))
					break
				}
			}
		}
	}
	times := make([]int64, 0, len(cutoffs))
	for at := range cutoffs {
		times = append(times, at)
	}
	sort.Slice(times, func(i, j int) bool { return times[i] < times[j] })
	for _, at := range times {
		window := detailWindow{at, make(map[string]detailCounts), make(map[string]detailCounts)}
		for _, team := range replay.Match.Teams {
			window.Teams[team.ID] = detailCounts{}
		}
		for _, player := range replay.Match.Players {
			window.Players[player.ID] = detailCounts{}
		}
		for _, event := range replay.Events {
			if event.TimeMS > at {
				break
			}
			player := window.Players[event.ActorID]
			if event.Type == "PASS" && event.Outcome == "COMPLETE" {
				player.Passes++
				recipient := window.Players[event.RecipientID]
				recipient.Received++
				window.Players[event.RecipientID] = recipient
			}
			if event.Type == "SHOT" {
				player.Shots++
			}
			window.Players[event.ActorID] = player
			if event.TimeMS < at-20000 {
				continue
			}
			team := window.Teams[event.TeamID]
			if event.Type == "PASS" && event.Outcome == "COMPLETE" {
				team.Passes++
			}
			if event.Type == "SHOT" {
				team.Shots++
			}
			window.Teams[event.TeamID] = team
		}
		result.Windows = append(result.Windows, window)
	}
	return result
}

func matchDetailsHandler(replay domain.Replay) http.HandlerFunc {
	details := buildMatchDetails(replay)
	return func(w http.ResponseWriter, r *http.Request) {
		if !allowGetHead(w, r) {
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		_ = json.NewEncoder(w).Encode(details)
	}
}
