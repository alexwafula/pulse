package transporthttp

import (
	"fmt"

	"github.com/alexwafula/pulse/app/internal/domain"
	"github.com/alexwafula/pulse/app/internal/engine/metrics"
)

type summarySnapshot struct {
	TimeMS                              int64
	Actions, PassAttempts, Passes       int
	HomePasses, AwayPasses              int
	BoxEntries, Shots, ConvertedEntries int
}

func summaryViews(replay domain.Replay, attacks []metrics.AttackSnapshot) []summarySnapshot {
	out := make([]summarySnapshot, 0, len(attacks))
	counts := summarySnapshot{}
	next := 0
	for _, attack := range attacks {
		for next < len(replay.Events) && replay.Events[next].TimeMS <= attack.TimeMS {
			e := replay.Events[next]
			counts.Actions++
			if e.Type == "PASS" {
				counts.PassAttempts++
				if e.Outcome == "COMPLETE" {
					counts.Passes++
					if e.TeamID == replay.Match.Teams[0].ID {
						counts.HomePasses++
					} else {
						counts.AwayPasses++
					}
				}
			}
			next++
		}
		s := counts
		s.TimeMS = attack.TimeMS
		for _, team := range attack.Teams {
			s.BoxEntries += team.BoxEntries
			s.Shots += team.Shots
			s.ConvertedEntries += team.EntryShots
		}
		out = append(out, s)
	}
	return out
}

func clockText(ms int64) string {
	seconds := ms / 1000
	return fmt.Sprintf("%02d:%02d", seconds/60, seconds%60)
}

func replayPage(replay domain.Replay, graphs []graphSnapshot, attacks []metrics.AttackSnapshot, scenario string) pageData {
	if scenario == "" {
		scenario = "corner"
	}
	name := scenarioName(scenario)
	initials := make([]string, len(replay.Match.Teams))
	for i, team := range replay.Match.Teams {
		if chars := []rune(team.Name); len(chars) > 0 {
			initials[i] = string(chars[0])
		}
	}
	return pageData{Match: replay.Match, Graphs: graphs, Attacks: attacks, Recap: recap(replay), Scenario: scenario,
		ScenarioName: name, TeamInitials: initials, Summaries: summaryViews(replay, attacks),
		TotalEvents: len(replay.Events), Window: clockText(replay.Match.StartMS) + " - " + clockText(replay.Match.EndMS),
		StartClock: clockText(replay.Match.StartMS), EndClock: clockText(replay.Match.EndMS)}
}
