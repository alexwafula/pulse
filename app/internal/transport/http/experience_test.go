package transporthttp

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/alexwafula/pulse/app/internal/simulator"
)

func TestExperiencePanelsFollowReplayClock(t *testing.T) {
	replay, err := simulator.Load("../../../../data/samples/first-sequence.json")
	if err != nil {
		t.Fatal(err)
	}
	handler, err := NewDemoHandler(replay, "../../../web", "")
	if err != nil {
		t.Fatal(err)
	}
	for _, scenario := range []string{"corner", "central", "exchange", "late-siege", "calm-midfield"} {
		t.Run(scenario, func(t *testing.T) {
			// Exercise the same scenario dispatch as the JSON APIs, including seeded fixtures.
			page := httptest.NewRecorder()
			handler.ServeHTTP(page, httptest.NewRequest("GET", "/experience?scenario="+scenario, nil))
			if page.Code != 200 || !strings.Contains(page.Body.String(), `class="experience"`) || !strings.Contains(page.Body.String(), `hx-get="/experience/panel"`) {
				t.Fatalf("experience page: %d", page.Code)
			}
		})
	}
	for _, at := range []int64{replay.Match.StartMS, replay.Events[0].TimeMS, replay.Match.EndMS, replay.Match.StartMS} {
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, httptest.NewRequest("GET", fmt.Sprintf("/experience/panel?scenario=corner&panel=story&atMs=%d", at), nil))
		if response.Code != 200 || response.Header().Get("Cache-Control") != "no-store" || !strings.HasPrefix(response.Header().Get("Content-Type"), "text/html") {
			t.Fatalf("panel response: %d %s", response.Code, response.Body.String())
		}
		for _, event := range replay.Events {
			if event.TimeMS > at && strings.Contains(response.Body.String(), event.ID) {
				t.Fatalf("future event %s exposed at %d", event.ID, at)
			}
		}
	}
	for _, complete := range []bool{false, true} {
		at := replay.Match.StartMS
		if complete {
			at = replay.Match.EndMS
		}
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, httptest.NewRequest("GET", fmt.Sprintf("/experience/panel?panel=recap&atMs=%d", at), nil))
		body := response.Body.String()
		if !complete && (strings.Contains(body, "data-inspect-event") || !strings.Contains(body, "available at the end")) {
			t.Fatal("recap leaked future evidence")
		}
		if complete && (!strings.Contains(body, "data-inspect-event") || !strings.Contains(body, "shot was blocked")) {
			t.Fatal("recap lacks evidence or implies an unsupported goal")
		}
	}
}

func TestExperiencePanelValidationAndEscaping(t *testing.T) {
	replay, err := simulator.Load("../../../../data/samples/first-sequence.json")
	if err != nil {
		t.Fatal(err)
	}
	for i := range replay.Match.Players {
		if replay.Match.Players[i].ID == replay.Events[0].ActorID {
			replay.Match.Players[i].Name = "<script>alert(1)</script>"
		}
	}
	handler, err := NewHandler(replay, "../../../web")
	if err != nil {
		t.Fatal(err)
	}
	for _, test := range []struct {
		method, path string
		status       int
	}{
		{"POST", "/experience", 405},
		{"POST", "/experience/panel", 405},
		{"GET", "/experience/panel?panel=unknown&atMs=1620000", 400},
		{"GET", "/experience/panel?panel=story", 400},
		{"GET", "/experience/panel?panel=story&atMs=bad", 400},
		{"GET", "/experience/panel?panel=story&atMs=1620000.5", 400},
		{"GET", "/experience/panel?panel=story&atMs=1619999", 400},
		{"GET", "/experience/panel?panel=story&atMs=1680001", 400},
		{"GET", "/experience/unknown", 404},
	} {
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, httptest.NewRequest(test.method, test.path, nil))
		if response.Code != test.status {
			t.Errorf("%s %s: got %d, want %d", test.method, test.path, response.Code, test.status)
		}
	}
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, fmt.Sprintf("/experience/panel?panel=story&atMs=%d", replay.Events[0].TimeMS), nil))
	if strings.Contains(response.Body.String(), "<script>") || !strings.Contains(response.Body.String(), "&lt;script&gt;") {
		t.Fatal("source names must be HTML-escaped")
	}
	for i := range replay.Events {
		if replay.Events[i].Type == "SHOT" {
			replay.Events[i].Outcome = "COMPLETE"
		}
	}
	handler, err = NewHandler(replay, "../../../web")
	if err != nil {
		t.Fatal(err)
	}
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest("GET", fmt.Sprintf("/experience/panel?panel=story&atMs=%d", replay.Match.EndMS), nil))
	if !strings.Contains(response.Body.String(), "no goal outcome recorded") {
		t.Fatal("completed shot must not imply a goal")
	}
}
