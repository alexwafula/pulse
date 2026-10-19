package transporthttp

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/alexwafula/pulse/app/internal/ai"
	"github.com/alexwafula/pulse/app/internal/domain"
	"github.com/alexwafula/pulse/app/internal/facts"
	"github.com/alexwafula/pulse/app/internal/simulator"
)

func TestCapturedOpenPlayReferenceBinding(t *testing.T) {
	r, err := simulator.Load("../../../../data/scenarios/late-siege.json")
	if err != nil {
		t.Fatal(err)
	}
	packs, err := facts.OpenPlayPacks(r)
	if err != nil || len(packs) != 1 {
		t.Fatalf("packs: %v", err)
	}
	ref := loadReferenceFile("../../../web", "open-play-casual.en-GB.json", "captured-agent-run")
	if ref == nil {
		t.Fatal("captured trace did not load")
	}
	if matchingReference(ref, r, packs[0], ref.Response, "en-GB", "CASUAL") == nil {
		t.Fatal("captured run did not match recomputed source pack")
	}
	ref.Observations[0].Output = []byte(`{"text":"invented"}`)
	if matchingReference(ref, r, packs[0], ref.Response, "en-GB", "CASUAL") != nil {
		t.Fatal("forged Explainer output was exposed")
	}
}

func TestMixedFeedPreservesPerCueProvenance(t *testing.T) {
	r, err := simulator.Load("../../../../data/scenarios/late-siege.json")
	if err != nil {
		t.Fatal(err)
	}
	ref := loadReferenceFile("../../../web", "open-play-casual.en-GB.json", "captured-agent-run")
	if ref == nil {
		t.Fatal("missing captured trace")
	}
	agent := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request domain.InsightRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Error(err)
			w.WriteHeader(400)
			return
		}
		response, err := ai.Template(request.FactPack, request.Locale, request.Persona)
		if err != nil {
			t.Error(err)
			w.WriteHeader(400)
			return
		}
		if request.FactPack.Facts[0].Metric == "open_play_passes_before_shot" {
			response = ref.Response
			w.Header().Set("X-Pulse-Agent-Mode", "recorded")
		}
		json.NewEncoder(w).Encode(response)
	}))
	defer agent.Close()
	handler, err := newScenarioHandler("late-siege", r, "../../../web", agent.URL)
	if err != nil {
		t.Fatal(err)
	}
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, httptest.NewRequest("GET", "/api/agent-inspection", nil))
	if w.Code != 200 || w.Header().Get("X-Pulse-Insight-Source") != "mixed" {
		t.Fatalf("mixed feed: %d %s", w.Code, w.Body.String())
	}
	var feed inspectionFeed
	if err := json.Unmarshal(w.Body.Bytes(), &feed); err != nil {
		t.Fatal(err)
	}
	if len(feed.Inspections) != 2 || feed.Inspections[0].Source != "python-template" || feed.Inspections[1].Source != "python-recorded" {
		t.Fatalf("wrong individual provenance: %+v", feed.Inspections)
	}
}
