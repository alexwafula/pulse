package transporthttp

import (
	"fmt"
	"github.com/alexwafula/pulse/app/internal/domain"
	"github.com/alexwafula/pulse/app/internal/engine/metrics"
)

type recapItem struct {
	Text     string
	EventIDs []string
	// Key, Line, Actor, Team and Count let the page re-render the English
	// recap through the UI catalog: Line is Key's en-GB text and Actor, when
	// set, prefixes it as "Actor: Line".
	Key, Line, Actor, Team string
	Count                  int
}

func recap(replay domain.Replay) []recapItem {
	items := []recapItem{}
	series, _ := metrics.AttackSeries(replay)
	last := series[len(series)-1]
	for _, team := range last.Teams {
		if team.Shots > 0 {
			noun, key := "shot attempts", "recap.count"
			if team.Shots == 1 {
				noun, key = "shot attempt", "recap.countOne"
			}
			text := fmt.Sprintf("%s recorded %d %s in this sequence.", team.Team.Name, team.Shots, noun)
			items = append(items, recapItem{Text: text, EventIDs: team.ShotEventIDs, Key: key, Line: text, Team: team.Team.Name, Count: team.Shots})
		}
	}
	for _, event := range replay.Events {
		if event.Type == "SHOT" {
			text, key := "The shot was completed; no goal outcome is recorded.", "recap.completed"
			if event.Outcome == "BLOCKED" {
				text, key = "The shot was blocked.", "recap.blocked"
			} else if event.Outcome == "INCOMPLETE" {
				text, key = "The shot was unsuccessful.", "recap.incomplete"
			}
			item := recapItem{Text: text, EventIDs: []string{event.ID}, Key: key, Line: text}
			for _, player := range replay.Match.Players {
				if player.ID == event.ActorID {
					item.Text, item.Actor = player.Name+": "+text, player.Name
					break
				}
			}
			items = append(items, item)
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
