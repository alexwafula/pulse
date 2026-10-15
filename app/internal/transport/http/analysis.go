package transporthttp

import (
	"fmt"
	"github.com/alexwafula/pulse/app/internal/domain"
	"github.com/alexwafula/pulse/app/internal/engine/metrics"
)

type recapItem struct {
	Text     string
	EventIDs []string
}

func recap(replay domain.Replay) []recapItem {
	items := []recapItem{}
	series, _ := metrics.AttackSeries(replay)
	last := series[len(series)-1]
	for _, team := range last.Teams {
		if team.Shots > 0 {
			noun := "shot attempts"
			if team.Shots == 1 {
				noun = "shot attempt"
			}
			items = append(items, recapItem{Text: fmt.Sprintf("%s recorded %d %s in this sequence.", team.Team.Name, team.Shots, noun), EventIDs: team.ShotEventIDs})
		}
	}
	for _, event := range replay.Events {
		if event.Type == "SHOT" {
			text := "The shot was completed; no goal outcome is recorded."
			if event.Outcome == "BLOCKED" {
				text = "The shot was blocked."
			} else if event.Outcome == "INCOMPLETE" {
				text = "The shot was unsuccessful."
			}
			for _, player := range replay.Match.Players {
				if player.ID == event.ActorID {
					text = player.Name + ": " + text
					break
				}
			}
			items = append(items, recapItem{Text: text, EventIDs: []string{event.ID}})
		}
	}
	return items
}

func localizedRecap(replay domain.Replay, catalog uiCatalog, locale string) []recapItem {
	items := []recapItem{}
	series, _ := metrics.AttackSeries(replay)
	for _, team := range series[len(series)-1].Teams {
		if team.Shots > 0 {
			items = append(items, recapItem{Text: catalog.text(locale, "recap.count", map[string]string{"team": team.Team.Name, "count": fmt.Sprint(team.Shots)}), EventIDs: team.ShotEventIDs})
		}
	}
	for _, event := range replay.Events {
		if event.Type != "SHOT" {
			continue
		}
		key := "recap.completed"
		if event.Outcome == "BLOCKED" {
			key = "recap.blocked"
		} else if event.Outcome == "INCOMPLETE" {
			key = "recap.incomplete"
		}
		text := catalog.text(locale, key, nil)
		for _, player := range replay.Match.Players {
			if player.ID == event.ActorID {
				text = player.Name + ": " + text
				break
			}
		}
		items = append(items, recapItem{Text: text, EventIDs: []string{event.ID}})
	}
	return items
}
