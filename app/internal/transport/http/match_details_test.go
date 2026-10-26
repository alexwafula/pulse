package transporthttp

import (
	"github.com/alexwafula/pulse/app/internal/domain"
	"math"
	"net/http/httptest"
	"testing"
)

func TestShotDetailsGeometryAndDirections(t *testing.T) {
	event := domain.Event{ID: "shot", From: domain.Point{X: 94, Y: 34}}
	pitch := domain.Pitch{LengthM: 105, WidthM: 68}
	right := calculateShot(event, domain.Team{AttackingDirection: "RIGHT"}, pitch)
	if right.DistanceM != 11 || math.Abs(right.AngleDegrees-2*math.Atan(3.66/11)*180/math.Pi) > 1e-10 {
		t.Fatal(right)
	}
	event.From.X = 11
	left := calculateShot(event, domain.Team{AttackingDirection: "LEFT"}, pitch)
	if left.DistanceM != right.DistanceM || left.AngleDegrees != right.AngleDegrees || left.Posts[0].X != 0 {
		t.Fatal(left)
	}
	event.From = domain.Point{X: 105, Y: 34}
	line := calculateShot(event, domain.Team{AttackingDirection: "RIGHT"}, pitch)
	if math.IsNaN(line.AngleDegrees) || line.AngleDegrees != 180 {
		t.Fatal(line)
	}
}

func TestMatchDetailsWindowCutoffsAndRewind(t *testing.T) {
	_, catalog := apiScenarios(t)
	for name, replay := range catalog {
		t.Run(name, func(t *testing.T) {
			details := buildMatchDetails(replay)
			if name == "end-to-end" && len(details.Shots) != 2 {
				t.Fatal("both teams' shots must be described")
			}
			for _, snapshot := range details.Windows {
				wantPlayers := make(map[string]detailCounts, len(replay.Match.Players))
				for _, player := range replay.Match.Players {
					wantPlayers[player.ID] = detailCounts{}
				}
				wantTeams := make(map[string]detailCounts, len(replay.Match.Teams))
				for _, team := range replay.Match.Teams {
					wantTeams[team.ID] = detailCounts{}
				}
				for _, event := range replay.Events {
					if event.TimeMS > snapshot.TimeMS {
						continue
					}
					player := wantPlayers[event.ActorID]
					if event.Type == "PASS" {
						player.PassAttempts++
						if event.Outcome == "COMPLETE" {
							player.Passes++
							recipient := wantPlayers[event.RecipientID]
							recipient.Received++
							wantPlayers[event.RecipientID] = recipient
						}
					}
					if event.Type == "SHOT" {
						player.Shots++
					}
					wantPlayers[event.ActorID] = player
					if event.TimeMS < snapshot.TimeMS-20000 {
						continue
					}
					team := wantTeams[event.TeamID]
					if event.Type == "PASS" {
						team.PassAttempts++
						if event.Outcome == "COMPLETE" {
							team.Passes++
						}
					}
					if event.Type == "SHOT" {
						team.Shots++
					}
					wantTeams[event.TeamID] = team
				}
				for _, team := range replay.Match.Teams {
					if snapshot.Teams[team.ID] != wantTeams[team.ID] {
						t.Fatalf("wrong team window at %d for %s: got %+v want %+v", snapshot.TimeMS, team.ID, snapshot.Teams[team.ID], wantTeams[team.ID])
					}
				}
				for _, player := range replay.Match.Players {
					if snapshot.Players[player.ID] != wantPlayers[player.ID] {
						t.Fatalf("wrong player totals at %d for %s: got %+v want %+v", snapshot.TimeMS, player.ID, snapshot.Players[player.ID], wantPlayers[player.ID])
					}
				}
			}
			first := replay.Events[0]
			if details.Windows[0].Players[first.ActorID].Passes != 0 || details.Windows[0].Players[first.ActorID].PassAttempts != 0 {
				t.Fatal("future pass leaked into opening snapshot")
			}
		})
	}
	replay := catalog["end-to-end"]
	handler := matchDetailsHandler(replay)
	response := httptest.NewRecorder()
	handler(response, httptest.NewRequest("POST", "/api/match-details", nil))
	if response.Code != 405 {
		t.Fatal("endpoint accepted a write")
	}
}
