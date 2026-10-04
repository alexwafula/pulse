package domain

import (
	"fmt"
	"math"
)

const SchemaVersion = "1.0.0"

type Point struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type Ball struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}

type Pitch struct {
	LengthM float64 `json:"length_m"`
	WidthM  float64 `json:"width_m"`
}

type Team struct {
	ID                 string `json:"id"`
	Name               string `json:"name"`
	AttackingDirection string `json:"attacking_direction"`
}

type Player struct {
	ID     string `json:"id"`
	TeamID string `json:"team_id"`
	Name   string `json:"name"`
	Number int    `json:"number"`
}

type Match struct {
	SchemaVersion string   `json:"schema_version"`
	ID            string   `json:"id"`
	Period        int      `json:"period"`
	StartMS       int64    `json:"start_ms"`
	EndMS         int64    `json:"end_ms"`
	Pitch         Pitch    `json:"pitch"`
	Teams         []Team   `json:"teams"`
	Players       []Player `json:"players"`
}

type Event struct {
	SchemaVersion string `json:"schema_version"`
	ID            string `json:"id"`
	MatchID       string `json:"match_id"`
	PhaseID       string `json:"phase_id"`
	Period        int    `json:"period"`
	TimeMS        int64  `json:"time_ms"`
	Type          string `json:"type"`
	TeamID        string `json:"team_id"`
	ActorID       string `json:"actor_id"`
	RecipientID   string `json:"recipient_id,omitempty"`
	From          Point  `json:"from"`
	To            Point  `json:"to"`
	Outcome       string `json:"outcome"`
}

type TrackedPlayer struct {
	PlayerID string  `json:"player_id"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
}

type TrackingFrame struct {
	SchemaVersion string          `json:"schema_version"`
	MatchID       string          `json:"match_id"`
	Period        int             `json:"period"`
	TimeMS        int64           `json:"time_ms"`
	Ball          Ball            `json:"ball"`
	Players       []TrackedPlayer `json:"players"`
}

type Replay struct {
	SchemaVersion string          `json:"schema_version"`
	Match         Match           `json:"match"`
	Events        []Event         `json:"events"`
	Tracking      []TrackingFrame `json:"tracking"`
}

// Validate checks references, coordinates and the shared match clock before replay.
func (r Replay) Validate() error {
	m := r.Match
	if r.SchemaVersion != SchemaVersion || m.SchemaVersion != SchemaVersion {
		return fmt.Errorf("unsupported replay or match schema version")
	}
	if m.ID == "" || m.Period < 1 || m.StartMS < 0 || m.EndMS <= m.StartMS {
		return fmt.Errorf("invalid match identity or time window")
	}
	if !finitePositive(m.Pitch.LengthM) || !finitePositive(m.Pitch.WidthM) {
		return fmt.Errorf("invalid pitch dimensions")
	}
	if len(m.Teams) != 2 || m.Teams[0].ID == m.Teams[1].ID {
		return fmt.Errorf("match must have two distinct teams")
	}
	teams := make(map[string]bool, 2)
	for _, team := range m.Teams {
		if team.ID == "" || team.Name == "" || (team.AttackingDirection != "left" && team.AttackingDirection != "right") {
			return fmt.Errorf("invalid team %q", team.ID)
		}
		teams[team.ID] = true
	}
	if m.Teams[0].AttackingDirection == m.Teams[1].AttackingDirection {
		return fmt.Errorf("teams must attack opposite directions")
	}
	players := make(map[string]string, len(m.Players))
	for _, player := range m.Players {
		if player.ID == "" || player.Name == "" || !teams[player.TeamID] || players[player.ID] != "" {
			return fmt.Errorf("invalid or duplicate player %q", player.ID)
		}
		players[player.ID] = player.TeamID
	}
	if len(players) == 0 || len(r.Events) == 0 || len(r.Tracking) < 2 {
		return fmt.Errorf("replay requires players, events and at least two tracking frames")
	}
	ids := make(map[string]bool, len(r.Events))
	last := m.StartMS
	for _, event := range r.Events {
		if event.SchemaVersion != SchemaVersion || event.ID == "" || ids[event.ID] ||
			event.MatchID != m.ID || event.Period != m.Period ||
			event.TimeMS < last || event.TimeMS > m.EndMS ||
			event.PhaseID == "" || !teams[event.TeamID] ||
			players[event.ActorID] != event.TeamID ||
			(event.RecipientID != "" && players[event.RecipientID] != event.TeamID) ||
			!validPoint(event.From, m.Pitch) || !validPoint(event.To, m.Pitch) ||
			!validEventType(event.Type) || !validOutcome(event.Outcome) {
			return fmt.Errorf("invalid event %q at %d ms", event.ID, event.TimeMS)
		}
		ids[event.ID] = true
		last = event.TimeMS
	}
	last = m.StartMS
	for i, frame := range r.Tracking {
		if frame.SchemaVersion != SchemaVersion || frame.MatchID != m.ID || frame.Period != m.Period ||
			frame.TimeMS < last || frame.TimeMS > m.EndMS ||
			(i > 0 && frame.TimeMS == last) ||
			!validPoint(Point{frame.Ball.X, frame.Ball.Y}, m.Pitch) ||
			math.IsNaN(frame.Ball.Z) || math.IsInf(frame.Ball.Z, 0) || frame.Ball.Z < 0 {
			return fmt.Errorf("invalid tracking frame at %d ms", frame.TimeMS)
		}
		seen := make(map[string]bool, len(frame.Players))
		for _, player := range frame.Players {
			if players[player.PlayerID] == "" || seen[player.PlayerID] ||
				!validPoint(Point{player.X, player.Y}, m.Pitch) {
				return fmt.Errorf("invalid tracked player %q at %d ms", player.PlayerID, frame.TimeMS)
			}
			seen[player.PlayerID] = true
		}
		if len(seen) != len(players) {
			return fmt.Errorf("tracking frame at %d ms must include every player", frame.TimeMS)
		}
		last = frame.TimeMS
	}
	if r.Tracking[0].TimeMS != m.StartMS || last != m.EndMS {
		return fmt.Errorf("tracking must cover the complete match window")
	}
	return nil
}

func finitePositive(v float64) bool {
	return !math.IsNaN(v) && !math.IsInf(v, 0) && v > 0
}

func validPoint(p Point, pitch Pitch) bool {
	return !math.IsNaN(p.X) && !math.IsInf(p.X, 0) && !math.IsNaN(p.Y) && !math.IsInf(p.Y, 0) &&
		p.X >= 0 && p.X <= pitch.LengthM && p.Y >= 0 && p.Y <= pitch.WidthM
}

func validEventType(v string) bool {
	switch v {
	case "pass", "carry", "cross", "clearance", "corner", "shot":
		return true
	}
	return false
}

func validOutcome(v string) bool {
	return v == "complete" || v == "incomplete" || v == "blocked"
}
