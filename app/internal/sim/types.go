package sim

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/alexwafula/pulse/app/internal/domain"
)

// Script defines the scenario script format for generating deterministic matches.
type Script struct {
	SchemaVersion string         `json:"schemaVersion"`
	Name          string         `json:"name"`
	MatchID       string         `json:"matchId"`
	Seed          int64          `json:"seed"`
	Period        int            `json:"period"`
	StartMS       int64          `json:"startMs"`
	EndMS         int64          `json:"endMs"`
	Pitch         domain.Pitch   `json:"pitch"`
	SquadPath     string         `json:"squadPath,omitempty"`
	Teams         []TeamConfig   `json:"teams"`
	Players       []PlayerConfig `json:"players,omitempty"`
	Beats         []Beat         `json:"beats"`
}

// SquadFile defines the shared squad data format stored in data/squads/.
type SquadFile struct {
	SchemaVersion string          `json:"schemaVersion"`
	Teams         []SquadTeamData `json:"teams"`
}

// SquadTeamData contains team roster and default tactical parameters.
type SquadTeamData struct {
	ID                 string         `json:"id"`
	Name               string         `json:"name"`
	AttackingDirection string         `json:"attackingDirection"`
	Formation          string         `json:"formation"`
	LineHeightM        float64        `json:"lineHeightM"`
	Compactness        float64        `json:"compactness"`
	Players            []PlayerConfig `json:"players"`
}

// TeamConfig specifies team parameters, tactics, and formation.
type TeamConfig struct {
	ID                 string  `json:"id"`
	Name               string  `json:"name"`
	AttackingDirection string  `json:"attackingDirection"`
	Formation          string  `json:"formation"`
	LineHeightM        float64 `json:"lineHeightM"`
	Compactness        float64 `json:"compactness"`
}

// PlayerConfig defines a player's tactical role and formation slot.
type PlayerConfig struct {
	ID     string `json:"id"`
	TeamID string `json:"teamId"`
	Name   string `json:"name"`
	Number int    `json:"number"`
	Role   string `json:"role"`
	Slot   string `json:"slot"`
}

// Beat represents one discrete football action in the scripted narrative.
type Beat struct {
	ID          string        `json:"id"`
	Kind        string        `json:"kind"`
	PhaseID     string        `json:"phaseId"`
	ActorID     string        `json:"actorId"`
	RecipientID string        `json:"recipientId,omitempty"`
	From        *domain.Point `json:"from,omitempty"`
	Target      domain.Point  `json:"target"`
	HoldTimeMS  int64         `json:"holdTimeMs"`
	Outcome     string        `json:"outcome"`
}

// LoadScript reads and parses a scenario script JSON, resolving shared squads if referenced.
func LoadScript(path string) (Script, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return Script{}, fmt.Errorf("reading script %s: %w", path, err)
	}

	var script Script
	if err := json.Unmarshal(data, &script); err != nil {
		return Script{}, fmt.Errorf("unmarshaling script %s: %w", path, err)
	}

	squadPath := script.SquadPath
	if squadPath == "" && len(script.Players) == 0 {
		squadPath = filepath.Join("data", "squads", "fictional-league.json")
	}

	if squadPath != "" {
		resolvedSquadPath := squadPath
		if !filepath.IsAbs(resolvedSquadPath) {
			// Try candidate relative to script directory
			candidate := filepath.Join(filepath.Dir(path), resolvedSquadPath)
			if _, err := os.Stat(candidate); err == nil {
				resolvedSquadPath = candidate
			} else if _, err := os.Stat(resolvedSquadPath); err != nil {
				// Search upwards from script directory to find repo root / squad file
				found := false
				for dir := filepath.Dir(path); dir != "" && dir != "."; dir = filepath.Dir(dir) {
					c := filepath.Join(dir, resolvedSquadPath)
					if _, err := os.Stat(c); err == nil {
						resolvedSquadPath = c
						found = true
						break
					}
					parent := filepath.Dir(dir)
					if parent == dir {
						break
					}
				}
				if !found {
					// Search upwards from working directory
					if cwd, err := os.Getwd(); err == nil {
						for dir := cwd; dir != "" && dir != "/"; dir = filepath.Dir(dir) {
							c := filepath.Join(dir, resolvedSquadPath)
							if _, err := os.Stat(c); err == nil {
								resolvedSquadPath = c
								found = true
								break
							}
							parent := filepath.Dir(dir)
							if parent == dir {
								break
							}
						}
					}
				}
			}
		}

		squadData, err := os.ReadFile(resolvedSquadPath)
		if err != nil {
			return Script{}, fmt.Errorf("reading squad file %s: %w", resolvedSquadPath, err)
		}

		var squad SquadFile
		if err := json.Unmarshal(squadData, &squad); err != nil {
			return Script{}, fmt.Errorf("unmarshaling squad file %s: %w", resolvedSquadPath, err)
		}

		teamPlayerMap := make(map[string][]PlayerConfig)
		for _, st := range squad.Teams {
			teamPlayerMap[st.ID] = st.Players
		}

		if len(script.Players) == 0 {
			for _, team := range script.Teams {
				if pl, ok := teamPlayerMap[team.ID]; ok {
					script.Players = append(script.Players, pl...)
				}
			}
		}
	}

	return script, nil
}
