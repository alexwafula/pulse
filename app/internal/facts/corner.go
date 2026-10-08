package facts

import (
	"crypto/sha256"
	"fmt"

	"github.com/alexwafula/pulse/app/internal/domain"
)

// CornerPacks detects the first shot within 12 seconds of a corner, before
// another team touches the ball or the possession phase changes.
func CornerPacks(replay domain.Replay) ([]domain.FactPack, error) {
	if err := replay.Validate(); err != nil {
		return nil, fmt.Errorf("validate replay: %w", err)
	}
	packs := make([]domain.FactPack, 0)
	for i, corner := range replay.Events {
		if corner.Type != "CORNER" || corner.Outcome != "COMPLETE" {
			continue
		}
		for _, event := range replay.Events[i+1:] {
			if event.TimeMS-corner.TimeMS > 12000 || event.TeamID != corner.TeamID || event.PhaseID != corner.PhaseID || event.Type == "CORNER" {
				break
			}
			if event.Type != "SHOT" {
				continue
			}
			hash := sha256.Sum256([]byte(replay.Match.ID + ":" + corner.ID + ":" + event.ID))
			key := fmt.Sprintf("%x", hash[:8])
			packs = append(packs, domain.FactPack{
				SchemaVersion: domain.SchemaVersion, ID: "pack-corner-" + key,
				MatchID: replay.Match.ID, Period: replay.Match.Period,
				WindowStartMS: corner.TimeMS, WindowEndMS: event.TimeMS,
				Facts: []domain.Fact{{ID: "fact-corner-" + key, Metric: "set_piece_shots", Value: 1,
					Unit: "shots", TeamID: corner.TeamID, TimeStartMS: corner.TimeMS,
					TimeEndMS: event.TimeMS, EventIDs: []string{corner.ID, event.ID}}},
			})
			break
		}
	}
	return packs, nil
}
