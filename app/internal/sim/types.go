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
	// Expect narrows data-quality rules for this script only. Absent fields
	// keep the default rule.
	Expect *Expectations `json:"expect,omitempty"`
}

// Expectations are per-script data-quality expectations read by checkdata.
type Expectations struct {
	// MinShots is the minimum SHOT event count. Default 1. A script that
	// is meant to contain no shot (calm-midfield) sets 0.
	MinShots *int `json:"minShots,omitempty"`
}

// DefaultMinShots is the shot rule applied when a script does not set
// expect.minShots.
const DefaultMinShots = 1

// QualityOptions returns the checkdata options implied by the script.
func (s Script) QualityOptions() QualityOptions {
	opts := DefaultQualityOptions()
	if s.Expect != nil && s.Expect.MinShots != nil {
		opts.MinShots = *s.Expect.MinShots
	}
	return opts
}

// SquadFile defines the shared squad data format stored in data/squads/.
type SquadFile struct {
	SchemaVersion string          `json:"schemaVersion"`
	Teams         []SquadTeamData `json:"teams"`
}

// SquadTeamData contains team roster and default tactical parameters.
type SquadTeamData struct {
	ID                 string `json:"id"`
	Name               string `json:"name"`
	AttackingDirection string `json:"attackingDirection"`
	Formation          string `json:"formation"`
	// LineHeightM and Compactness are reserved, not implemented (issue #17).
	// They are parsed but never read by the generator.
	LineHeightM float64        `json:"lineHeightM"`
	Compactness float64        `json:"compactness"`
	Players     []PlayerConfig `json:"players"`
}

// TeamConfig specifies team parameters, tactics, and formation.
type TeamConfig struct {
	ID                 string `json:"id"`
	Name               string `json:"name"`
	AttackingDirection string `json:"attackingDirection"`
	Formation          string `json:"formation"`
	// LineHeightM and Compactness are reserved, not implemented (issue #17).
	// They are parsed but never read: team shape comes from the formation
	// templates. Setting them has no effect and Script.ReservedFieldWarnings
	// reports them.
	LineHeightM float64 `json:"lineHeightM"`
	Compactness float64 `json:"compactness"`
}

// ReservedFieldWarnings lists every reserved-but-unimplemented setting the
// script sets (issue #17). The generator CLI prints them; output is unchanged.
func (s Script) ReservedFieldWarnings() []string {
	var out []string
	for _, t := range s.Teams {
		if t.LineHeightM != 0 {
			out = append(out, fmt.Sprintf("team %s: lineHeightM=%g is reserved, not implemented (issue #17); ignored", t.ID, t.LineHeightM))
		}
		if t.Compactness != 0 {
			out = append(out, fmt.Sprintf("team %s: compactness=%g is reserved, not implemented (issue #17); ignored", t.ID, t.Compactness))
		}
	}
	return out
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
