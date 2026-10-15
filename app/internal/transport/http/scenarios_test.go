package transporthttp

import (
	"fmt"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestScenarioLibraryUsesReplayData(t *testing.T) {
	handler, catalog := apiScenarios(t)
	previews := scenarioPreviews(catalog)
	if len(previews) != len(catalog) || previews[0].ID != "late-siege" {
		t.Fatal("library must list every available replay, with the default first")
	}
	for _, preview := range previews {
		replay := catalog[preview.ID]
		frame := replay.Tracking[0]
		if preview.Players != len(replay.Match.Players) || preview.Events != len(replay.Events) || preview.Frames != len(replay.Tracking) || preview.Duration != clockText(replay.Match.EndMS-replay.Match.StartMS) {
			t.Fatalf("invented replay metadata for %s", preview.ID)
		}
		for i, position := range preview.Positions {
			if position.X != frame.Players[i].X || position.Y != replay.Match.Pitch.WidthM-frame.Players[i].Y {
				t.Fatal("thumbnail must use the first recorded tracking frame")
			}
		}
		if preview.BallX != frame.Ball.X || preview.BallY != replay.Match.Pitch.WidthM-frame.Ball.Y {
			t.Fatal("thumbnail ball is not replay-backed")
		}
	}
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest("GET", "/scenarios", nil))
	if response.Code != 200 || response.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("scenario library unavailable")
	}
	body := response.Body.String()
	for id, replay := range catalog {
		if !strings.Contains(body, `data-scenario-id="`+id+`"`) || !strings.Contains(body, fmt.Sprintf(`data-event-count="%d"`, len(replay.Events))) || !strings.Contains(body, "scenario="+id+"&amp;demo=1") {
			t.Fatalf("missing replay metadata or demo link: %s", id)
		}
	}
	for _, unsupported := range []string{"scoreline", "GOAL", "Verified"} {
		if strings.Contains(body, unsupported) {
			t.Fatalf("library made an unsupported claim: %s", unsupported)
		}
	}
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest("POST", "/scenarios", nil))
	if response.Code != 405 || response.Header().Get("Allow") != "GET" {
		t.Fatal("scenario library accepted a write")
	}
}
