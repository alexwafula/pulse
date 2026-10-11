package transporthttp

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/alexwafula/pulse/app/internal/ai"
	"github.com/alexwafula/pulse/app/internal/domain"
	"github.com/alexwafula/pulse/app/internal/facts"
	"github.com/alexwafula/pulse/app/internal/simulator"
)

func TestMatchPageAndReplayAPI(t *testing.T) {
	fixture := filepath.Join("..", "..", "..", "..", "data", "samples", "first-sequence.json")
	replay, err := simulator.Load(fixture)
	if err != nil {
		t.Fatal(err)
	}
	webDir := filepath.Join("..", "..", "..", "web")
	handler, err := NewHandler(replay, webDir)
	if err != nil {
		t.Fatal(err)
	}

	page := httptest.NewRecorder()
	handler.ServeHTTP(page, httptest.NewRequest(http.MethodGet, "/", nil))
	if page.Code != http.StatusOK || !strings.Contains(page.Body.String(), "Aurora Vale") {
		t.Fatalf("match page: status %d", page.Code)
	}
	if !strings.Contains(page.Body.String(), `data-pass-evidence="evt-01"`) || strings.Count(page.Body.String(), `class="passing-snapshot"`) != 3 || strings.Contains(page.Body.String(), `data-pass-evidence="evt-06"`) {
		t.Fatal("passing snapshots or evidence incorrect")
	}

	api := httptest.NewRecorder()
	handler.ServeHTTP(api, httptest.NewRequest(http.MethodGet, "/api/replay", nil))
	var result domain.Replay
	if api.Code != http.StatusOK || json.Unmarshal(api.Body.Bytes(), &result) != nil ||
		result.Match.ID != replay.Match.ID || len(result.Tracking) != len(replay.Tracking) {
		t.Fatalf("replay API: status %d", api.Code)
	}

	asset := httptest.NewRecorder()
	handler.ServeHTTP(asset, httptest.NewRequest(http.MethodGet, "/static/pitch.js", nil))
	if asset.Code != http.StatusOK || !strings.Contains(asset.Body.String(), "/api/replay") {
		t.Fatalf("browser asset: status %d", asset.Code)
	}

	// /design should return 404 when PULSE_DEV is not set
	os.Unsetenv("PULSE_DEV")
	designUnset := httptest.NewRecorder()
	handler.ServeHTTP(designUnset, httptest.NewRequest(http.MethodGet, "/design", nil))
	if designUnset.Code != http.StatusNotFound {
		t.Fatalf("design page without PULSE_DEV: expected 404, got %d", designUnset.Code)
	}

	// /design should return 200 when PULSE_DEV=1
	t.Setenv("PULSE_DEV", "1")
	design := httptest.NewRecorder()
	handler.ServeHTTP(design, httptest.NewRequest(http.MethodGet, "/design", nil))
	if design.Code != http.StatusOK || !strings.Contains(design.Body.String(), "Pulse Design System") {
		t.Fatalf("design page with PULSE_DEV=1: status %d", design.Code)
	}
}

func TestInsightFeedAndFallback(t *testing.T) {
	replay, err := simulator.Load("../../../../data/samples/first-sequence.json")
	if err != nil {
		t.Fatal(err)
	}
	for _, mode := range []string{"local", "python", "malicious", "unavailable"} {
		t.Run(mode, func(t *testing.T) {
			endpoint := ""
			if mode != "local" {
				server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					if mode == "unavailable" {
						http.Error(w, "down", 503)
						return
					}
					var request domain.InsightRequest
					if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
						t.Error(err)
					}
					response, _ := ai.Template(request.FactPack, request.Locale, request.Persona)
					if mode == "malicious" {
						response.Draft.Text = "The corner produced 9 shots."
					}
					json.NewEncoder(w).Encode(response)
				}))
				defer server.Close()
				endpoint = server.URL
			}
			handler, err := NewHandlerWithAgents(replay, "../../../web", endpoint)
			if err != nil {
				t.Fatal(err)
			}
			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, httptest.NewRequest("GET", "/api/insights", nil))
			var feed domain.CueFeed
			if recorder.Code != 200 || json.Unmarshal(recorder.Body.Bytes(), &feed) != nil || len(feed.Cues) != 1 {
				t.Fatalf("feed: %d %s", recorder.Code, recorder.Body.String())
			}
			if feed.Cues[0].Text != "The corner produced 1 shot." || feed.Cues[0].Verification.Status != "FALLBACK_TEMPLATE" {
				t.Fatal("unsafe insight published")
			}
			want := "go-template"
			if mode == "python" {
				want = "python-template"
			}
			if recorder.Header().Get("X-Pulse-Insight-Source") != want {
				t.Fatal("wrong insight source")
			}
			bad := httptest.NewRecorder()
			handler.ServeHTTP(bad, httptest.NewRequest("GET", "/api/insights?persona=UNKNOWN", nil))
			if bad.Code != 400 {
				t.Fatal("unsupported persona accepted")
			}
		})
	}
}

func TestNewDemoHandler_LateSiege(t *testing.T) {
	fixture := filepath.Join("..", "..", "..", "..", "data", "samples", "first-sequence.json")
	replay, err := simulator.Load(fixture)
	if err != nil {
		t.Fatal(err)
	}
	webDir := filepath.Join("..", "..", "..", "web")
	demoHandler, err := NewDemoHandler(replay, webDir, "")
	if err != nil {
		t.Fatalf("NewDemoHandler error: %v", err)
	}

	// Request late-siege scenario
	rec := httptest.NewRecorder()
	demoHandler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/?scenario=late-siege", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for late-siege, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "late-siege") {
		t.Fatalf("expected page body to contain late-siege")
	}

	// Request late-siege replay API
	apiRec := httptest.NewRecorder()
	demoHandler.ServeHTTP(apiRec, httptest.NewRequest(http.MethodGet, "/api/replay?scenario=late-siege", nil))
	if apiRec.Code != http.StatusOK {
		t.Fatalf("expected 200 for /api/replay?scenario=late-siege, got %d", apiRec.Code)
	}
	var siegeReplay domain.Replay
	if err := json.Unmarshal(apiRec.Body.Bytes(), &siegeReplay); err != nil {
		t.Fatalf("failed to decode replay JSON: %v", err)
	}
	if len(siegeReplay.Events) != 27 || len(siegeReplay.Tracking) != 401 {
		t.Fatalf("expected 27 events and 401 frames, got %d events and %d frames", len(siegeReplay.Events), len(siegeReplay.Tracking))
	}
}

// TestDemoHandler_ScenarioRouting proves the scenario query selects the
// matching replay's fact pack and that unknown scenarios never fall back.
// Routing for /api/metrics and /api/moments is covered by T15
// (metrics_api_test.go).
func TestDemoHandler_ScenarioRouting(t *testing.T) {
	base, err := simulator.Load(filepath.Join("..", "..", "..", "..", "data", "samples", "first-sequence.json"))
	if err != nil {
		t.Fatal(err)
	}
	siege, err := simulator.Load(filepath.Join("..", "..", "..", "..", "data", "scenarios", "late-siege.json"))
	if err != nil {
		t.Fatal(err)
	}
	demo, err := NewDemoHandler(base, filepath.Join("..", "..", "..", "web"), "")
	if err != nil {
		t.Fatal(err)
	}

	type cueJSON struct {
		MatchID      string   `json:"matchId"`
		EventIDs     []string `json:"eventIds"`
		FactIDs      []string `json:"factIds"`
		Verification struct {
			DraftID string `json:"draftId"`
			Status  string `json:"status"`
		} `json:"verification"`
	}
	fetch := func(t *testing.T, scenario string) []cueJSON {
		t.Helper()
		rec := httptest.NewRecorder()
		demo.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/insights?scenario="+scenario, nil))
		if rec.Code != http.StatusOK {
			t.Fatalf("%s: status %d: %s", scenario, rec.Code, rec.Body.String())
		}
		var feed struct {
			Cues []cueJSON `json:"cues"`
		}
		if err := json.Unmarshal(rec.Body.Bytes(), &feed); err != nil {
			t.Fatal(err)
		}
		if len(feed.Cues) == 0 {
			t.Fatalf("%s: no cues", scenario)
		}
		return feed.Cues
	}

	for _, tc := range []struct {
		scenario string
		replay   domain.Replay
	}{{"corner", base}, {"late-siege", siege}} {
		t.Run(tc.scenario, func(t *testing.T) {
			packs, err := facts.CornerPacks(tc.replay)
			if err != nil {
				t.Fatal(err)
			}
			packEvents := map[string]bool{}
			draftIDs := map[string]bool{}
			for _, p := range packs {
				draftIDs["draft-"+p.ID] = true
				for _, f := range p.Facts {
					for _, id := range f.EventIDs {
						packEvents[id] = true
					}
				}
			}
			for _, cue := range fetch(t, tc.scenario) {
				if cue.MatchID != tc.replay.Match.ID {
					t.Errorf("matchId %q, want %q", cue.MatchID, tc.replay.Match.ID)
				}
				if !draftIDs[cue.Verification.DraftID] {
					t.Errorf("draftId %q not from %s fact pack (%v)", cue.Verification.DraftID, tc.scenario, draftIDs)
				}
				if cue.Verification.Status != "FALLBACK_TEMPLATE" {
					t.Errorf("template cue status %q, want FALLBACK_TEMPLATE", cue.Verification.Status)
				}
				for _, id := range cue.EventIDs {
					if !packEvents[id] {
						t.Errorf("evidence %q not in %s fact pack", id, tc.scenario)
					}
				}
			}
		})
	}

	cornerCues, siegeCues := fetch(t, "corner"), fetch(t, "late-siege")
	if cornerCues[0].Verification.DraftID == siegeCues[0].Verification.DraftID {
		t.Fatalf("late-siege returned the corner draft %q", siegeCues[0].Verification.DraftID)
	}

	for _, path := range []string{"/api/insights?scenario=nope", "/api/replay?scenario=nope", "/?scenario=nope"} {
		rec := httptest.NewRecorder()
		demo.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		if rec.Code != http.StatusNotFound {
			t.Errorf("%s: status %d, want 404", path, rec.Code)
		}
		if !strings.Contains(rec.Body.String(), `unknown scenario "nope"`) {
			t.Errorf("%s: body %q lacks clear error", path, rec.Body.String())
		}
	}
}
