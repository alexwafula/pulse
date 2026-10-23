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
	replay := catalog["end-to-end"]
	details := buildMatchDetails(replay)
	if len(details.Shots) != 2 {
		t.Fatal("both teams' shots must be described")
	}
	first := replay.Events[0]
	for _, window := range details.Windows {
		for _, team := range replay.Match.Teams {
			want := detailCounts{}
			for _, event := range replay.Events {
				if event.TimeMS <= window.TimeMS && event.TimeMS >= window.TimeMS-20000 && event.TeamID == team.ID {
					if event.Type == "PASS" && event.Outcome == "COMPLETE" {
						want.Passes++
					}
					if event.Type == "SHOT" {
						want.Shots++
					}
				}
			}
			if window.Teams[team.ID] != want {
				t.Fatalf("wrong window at %d", window.TimeMS)
			}
		}
	}
	if details.Windows[0].Players[first.ActorID].Passes != 0 {
		t.Fatal("future pass leaked into opening snapshot")
	}
	handler := matchDetailsHandler(replay)
	response := httptest.NewRecorder()
	handler(response, httptest.NewRequest("POST", "/api/match-details", nil))
	if response.Code != 405 {
		t.Fatal("endpoint accepted a write")
	}
}
