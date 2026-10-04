package transporthttp

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

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
}
