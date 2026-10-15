package transporthttp

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/alexwafula/pulse/app/internal/domain"
	"github.com/alexwafula/pulse/app/internal/simulator"
)

func TestLocalizedInsightsAndStory(t *testing.T) {
	replay, _ := simulator.Load("../../../../data/samples/first-sequence.json")
	handler, err := NewDemoHandler(replay, "../../../web", "")
	if err != nil {
		t.Fatal(err)
	}
	for _, locale := range []string{"en-GB", "sw-KE", "hi-IN"} {
		for _, persona := range []string{"CASUAL", "ANALYST"} {
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, httptest.NewRequest("GET", "/api/insights?scenario=corner&locale="+locale+"&persona="+persona, nil))
			var feed domain.CueFeed
			if response.Code != 200 || json.Unmarshal(response.Body.Bytes(), &feed) != nil || len(feed.Cues) != 1 || feed.Cues[0].Locale != locale || feed.Cues[0].Persona != persona {
				t.Fatalf("audience rejected %s %s", locale, persona)
			}
			panel := httptest.NewRecorder()
			handler.ServeHTTP(panel, httptest.NewRequest("GET", "/experience/panel?scenario=corner&panel=story&atMs=1678000&locale="+locale+"&persona="+persona, nil))
			if panel.Code != 200 || !strings.Contains(panel.Body.String(), `data-locale="`+locale+`"`) || strings.Contains(panel.Body.String(), `class="story-details"`) != (persona == "ANALYST") {
				t.Fatal("story audience mismatch")
			}
			if locale != "en-GB" && strings.Contains(panel.Body.String(), "attempts a shot") {
				t.Fatal("story text not translated")
			}
		}
	}
	for _, path := range []string{"/api/insights?locale=fr-FR", "/experience/panel?scenario=corner&panel=story&atMs=1678000&locale=fr-FR"} {
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, httptest.NewRequest("GET", path, nil))
		if response.Code != 400 {
			t.Fatal("unsupported locale accepted")
		}
	}
}
