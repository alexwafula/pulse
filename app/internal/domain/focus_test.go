package domain_test

import (
	"testing"

	"github.com/alexwafula/pulse/app/internal/domain"
	"github.com/alexwafula/pulse/app/internal/simulator"
	"github.com/alexwafula/pulse/app/internal/simulator/scenarios"
)

func TestDefaultFocusPicksTheTeamWithEventsInEveryScenario(t *testing.T) {
	base, err := simulator.Load("../../../data/samples/first-sequence.json")
	if err != nil {
		t.Fatal(err)
	}
	catalog, err := scenarios.Catalog(base)
	if err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"late-siege", "calm-midfield"} {
		if catalog[name], err = simulator.Load("../../../data/scenarios/" + name + ".json"); err != nil {
			t.Fatal(err)
		}
	}
	// Counts are passes, carries and shots; player counts add completed passes received.
	// Late siege ties Dax, Imani and Tayo on 6; roster order picks Dax (vale-10).
	for _, test := range []struct {
		scenario, team, player          string
		teamActions, playerInvolvements int
	}{
		{"corner", "vale", "vale-8", 4, 3},
		{"central", "vale", "vale-8", 5, 3},
		{"exchange", "vale", "vale-7", 4, 3},
		{"late-siege", "vale", "vale-10", 24, 6},
		{"calm-midfield", "vale", "vale-3", 15, 6},
	} {
		t.Run(test.scenario, func(t *testing.T) {
			replay, ok := catalog[test.scenario]
			if !ok {
				t.Fatalf("scenario %s missing from the catalog", test.scenario)
			}
			teams, players := domain.ActionCounts(replay)
			focus := domain.DefaultFocus(replay)
			if focus.TeamID != test.team || teams[test.team] != test.teamActions {
				t.Fatalf("default team %q, want %q with %d actions; actions per team %v", focus.TeamID, test.team, test.teamActions, teams)
			}
			if focus.PlayerID != test.player || players[test.player] != test.playerInvolvements {
				t.Fatalf("default player %q, want %q with %d involvements; involvements %v", focus.PlayerID, test.player, test.playerInvolvements, players)
			}
		})
	}
}

func TestDefaultFocusRules(t *testing.T) {
	match := domain.Match{
		Teams: []domain.Team{{ID: "home"}, {ID: "away"}},
		Players: []domain.Player{
			{ID: "home-1", TeamID: "home"}, {ID: "home-2", TeamID: "home"},
			{ID: "away-1", TeamID: "away"}, {ID: "away-2", TeamID: "away"},
		},
	}
	for _, test := range []struct {
		name         string
		events       []domain.Event
		team, player string
	}{
		{"no events falls back to the first team and its first player", nil, "home", "home-1"},
		{"only the second team has actions", []domain.Event{{Type: "CARRY", TeamID: "away", ActorID: "away-2"}}, "away", "away-2"},
		{"a tie keeps API order", []domain.Event{{Type: "PASS", TeamID: "away", ActorID: "away-1"}, {Type: "SHOT", TeamID: "home", ActorID: "home-2"}}, "home", "home-2"},
		{"the highest count wins", []domain.Event{{Type: "SHOT", TeamID: "home", ActorID: "home-1"}, {Type: "PASS", TeamID: "away", ActorID: "away-1"}, {Type: "CARRY", TeamID: "away", ActorID: "away-1"}}, "away", "away-1"},
		{"a team with only clearances loses to a team with one pass", []domain.Event{{Type: "CLEARANCE", TeamID: "home", ActorID: "home-1"}, {Type: "CLEARANCE", TeamID: "home", ActorID: "home-2"}, {Type: "PASS", TeamID: "away", ActorID: "away-2"}}, "away", "away-2"},
		{"clearances alone leave API order and the first player", []domain.Event{{Type: "CLEARANCE", TeamID: "away", ActorID: "away-2"}}, "home", "home-1"},
		{"a completed pass received counts as an involvement", []domain.Event{{Type: "PASS", Outcome: "COMPLETE", TeamID: "away", ActorID: "away-1", RecipientID: "away-2"}, {Type: "CARRY", TeamID: "away", ActorID: "away-2"}}, "away", "away-2"},
		{"an incomplete pass gives the intended recipient nothing", []domain.Event{{Type: "PASS", Outcome: "INCOMPLETE", TeamID: "away", ActorID: "away-2", RecipientID: "away-1"}}, "away", "away-2"},
		{"most involvements ties in roster order", []domain.Event{{Type: "CARRY", TeamID: "away", ActorID: "away-2"}, {Type: "CARRY", TeamID: "away", ActorID: "away-1"}}, "away", "away-1"},
	} {
		t.Run(test.name, func(t *testing.T) {
			focus := domain.DefaultFocus(domain.Replay{Match: match, Events: test.events})
			if focus.TeamID != test.team || focus.PlayerID != test.player {
				t.Fatalf("got %+v, want team %s player %s", focus, test.team, test.player)
			}
		})
	}
}
