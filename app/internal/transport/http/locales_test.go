package transporthttp

import (
	"encoding/json"
	"net/http/httptest"
	"net/url"
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
}

// Unknown or garbage locales fall back to en-GB on both locale-aware
// endpoints; the three supported locales pass through unchanged.
func TestUnknownLocaleFallsBackToEnglish(t *testing.T) {
	replay, _ := simulator.Load("../../../../data/samples/first-sequence.json")
	handler, err := NewDemoHandler(replay, "../../../web", "")
	if err != nil {
		t.Fatal(err)
	}
	cases := []struct{ requested, served string }{
		{"en-GB", "en-GB"}, {"sw-KE", "sw-KE"}, {"hi-IN", "hi-IN"},
		{"", "en-GB"}, {"fr-FR", "en-GB"}, {"en", "en-GB"}, {"sw", "en-GB"}, {"EN-gb", "en-GB"},
		{"x<script>", "en-GB"}, {"hi-IN,sw-KE", "en-GB"},
	}
	for _, tc := range cases {
		query := url.QueryEscape(tc.requested)
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, httptest.NewRequest("GET", "/api/insights?scenario=corner&locale="+query, nil))
		var feed domain.CueFeed
		if response.Code != 200 || json.Unmarshal(response.Body.Bytes(), &feed) != nil || len(feed.Cues) != 1 || feed.Cues[0].Locale != tc.served {
			t.Fatalf("/api/insights locale %q: status %d, want cue locale %s: %s", tc.requested, response.Code, tc.served, response.Body.String())
		}
		panel := httptest.NewRecorder()
		handler.ServeHTTP(panel, httptest.NewRequest("GET", "/experience/panel?scenario=corner&panel=story&atMs=1678000&locale="+query, nil))
		if panel.Code != 200 || !strings.Contains(panel.Body.String(), `data-locale="`+tc.served+`"`) {
			t.Fatalf("/experience/panel locale %q: status %d, want data-locale %s", tc.requested, panel.Code, tc.served)
		}
	}
	for _, locale := range []string{"en-GB", "sw-KE", "hi-IN"} {
		if requestLocale(httptest.NewRequest("GET", "/?locale="+locale, nil)) != locale {
			t.Fatalf("supported locale %s was not passed through", locale)
		}
	}
}
