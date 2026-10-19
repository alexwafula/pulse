package facts

import (
	"crypto/sha256"
	"fmt"
	"sort"

	"github.com/alexwafula/pulse/app/internal/domain"
)

// OpenPlayPacks counts completed passes in the 20 seconds before a phase's first
// shot. A team or phase change starts a new chain. An incomplete or blocked
// action, a CORNER or a CLEARANCE disqualifies the rest of that phase: no pack
// is built for its shot. CORNER is the only restart type in the v2 event enum.
func OpenPlayPacks(replay domain.Replay) ([]domain.FactPack, error) {
	if err := replay.Validate(); err != nil {
		return nil, fmt.Errorf("validate replay: %w", err)
	}
	packs := make([]domain.FactPack, 0)
	var chain []domain.Event
	phase, team := "", ""
	closed := false
	seenShots := make(map[string]bool)
	for _, event := range replay.Events {
		phaseKey := event.TeamID + "/" + event.PhaseID
		previousShot := seenShots[phaseKey]
		if event.Type == "SHOT" {
			seenShots[phaseKey] = true
		}
		if event.PhaseID != phase || event.TeamID != team {
			phase, team, chain, closed = event.PhaseID, event.TeamID, nil, false
		}
		if closed || (event.Type == "SHOT" && previousShot) {
			continue
		}
		if event.Type == "SHOT" {
			closed = true
			first, count := -1, 0
			for i, prior := range chain {
				if event.TimeMS-prior.TimeMS <= 20000 && prior.Type == "PASS" {
					if first < 0 {
						first = i
					}
					count++
				}
			}
			if first < 0 || count > 32 {
				continue
			}
			evidence := make([]string, 0, len(chain)-first+1)
			for _, prior := range chain[first:] {
				evidence = append(evidence, prior.ID)
			}
			evidence = append(evidence, event.ID)
			start := chain[first].TimeMS
			hash := sha256.Sum256([]byte(replay.Match.ID + ":" + chain[first].ID + ":" + event.ID))
			key := fmt.Sprintf("%x", hash[:8])
			packs = append(packs, domain.FactPack{SchemaVersion: domain.SchemaVersion, ID: "pack-open-" + key, MatchID: replay.Match.ID, Period: replay.Match.Period,
				WindowStartMS: start, WindowEndMS: event.TimeMS, Facts: []domain.Fact{{ID: "fact-open-" + key, Metric: "open_play_passes_before_shot", Value: count, Unit: "passes", TeamID: team,
					TimeStartMS: start, TimeEndMS: event.TimeMS, EventIDs: evidence, Attributes: map[string]any{"phaseId": phase}}}})
			continue
		}
		if event.Type == "CORNER" || event.Type == "CLEARANCE" || event.Outcome != "COMPLETE" {
			chain = nil
			closed = true
			continue
		}
		chain = append(chain, event)
	}
	return packs, nil
}

// PatternPacks is the complete, clock-ordered publication input, not new metrics.
func PatternPacks(replay domain.Replay) ([]domain.FactPack, error) {
	corner, err := CornerPacks(replay)
	if err != nil {
		return nil, err
	}
	open, err := OpenPlayPacks(replay)
	if err != nil {
		return nil, err
	}
	packs := append(corner, open...)
	sort.Slice(packs, func(i, j int) bool {
		if packs[i].WindowEndMS == packs[j].WindowEndMS {
			return packs[i].ID < packs[j].ID
		}
		return packs[i].WindowEndMS < packs[j].WindowEndMS
	})
	return packs, nil
}
