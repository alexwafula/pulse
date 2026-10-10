package transporthttp

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/alexwafula/pulse/app/internal/ai"
	"github.com/alexwafula/pulse/app/internal/domain"
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

	design := httptest.NewRecorder()
	handler.ServeHTTP(design, httptest.NewRequest(http.MethodGet, "/design", nil))
	if design.Code != http.StatusOK || !strings.Contains(design.Body.String(), "Pulse Design System") {
		t.Fatalf("design page: status %d", design.Code)
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
