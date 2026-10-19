package transporthttp

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/alexwafula/pulse/app/internal/domain"
	"github.com/alexwafula/pulse/app/internal/facts"
	"github.com/alexwafula/pulse/app/internal/simulator"
)

func TestInspectionUsesSameGateAndOnlyOneRemoteCall(t *testing.T) {
	replay, err := simulator.Load("../../../../data/samples/first-sequence.json")
	if err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile("../../../../agents/recordings/corner-casual.en-GB.json")
	if err != nil {
		t.Fatal(err)
	}
	var recorded struct {
		Response domain.InsightResponse `json:"response"`
	}
	if err := json.Unmarshal(data, &recorded); err != nil {
		t.Fatal(err)
	}
	for _, forged := range []bool{false, true} {
		calls := 0
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			calls++
			response := recorded.Response
			if forged {
				response.Draft.Text = "The corner produced 2 shots."
			}
			w.Header().Set("X-Pulse-Agent-Mode", "recorded")
			_ = json.NewEncoder(w).Encode(response)
		}))
		handler, err := NewHandlerWithAgents(replay, "../../../web", server.URL)
		if err != nil {
			server.Close()
			t.Fatal(err)
		}
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequest("GET", "/api/agent-inspection", nil))
		server.Close()
		var result inspectionFeed
		if rec.Code != 200 || json.Unmarshal(rec.Body.Bytes(), &result) != nil {
			t.Fatalf("inspection: %d %s", rec.Code, rec.Body.String())
		}
		if calls != 1 || len(result.Inspections) != 1 || len(result.Feed.Cues) != 1 {
			t.Fatal("inspection changed the delivery count")
		}
		item := result.Inspections[0]
		if !item.GatePassed || !item.Safety.Rejected || !item.Safety.FallbackPassed || item.DeliveryMS < 0 {
			t.Fatal("unchecked inspection")
		}
		if strings.Contains(result.Feed.Cues[0].Text, "2 shots") {
			t.Fatal("test or forged prose reached the cue feed")
		}
		if forged && (item.Source != "go-template" || item.RemoteOutcome != "rejected" || item.Reference != nil) {
			t.Fatal("forged response was not independently rejected")
		}
		if !forged && (item.Source != "python-recorded" || item.Reference == nil || len(item.Reference.Observations) != 3) {
			t.Fatal("recorded response lacks matching reference evidence")
		}
	}
}

func TestInspectionValidationAndEmptyFeed(t *testing.T) {
	replay, _ := simulator.Load("../../../../data/samples/first-sequence.json")
	handler, err := NewDemoHandler(replay, "../../../web", "")
	if err != nil {
		t.Fatal(err)
	}
	for _, test := range []struct {
		method, path string
		status       int
	}{
		{"POST", "/api/agent-inspection", 405}, {"HEAD", "/api/agent-inspection", 405},
		{"GET", "/api/agent-inspection?persona=SPOTLIGHT", 400}, {"GET", "/api/agent-inspection?scenario=missing", 404},
		{"GET", "/api/agent-inspection?scenario=calm-midfield", 200},
	} {
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequest(test.method, test.path, nil))
		if rec.Code != test.status {
			t.Fatalf("%s %s: %d", test.method, test.path, rec.Code)
		}
		if test.status == 200 && (!strings.Contains(rec.Body.String(), `"cues":[]`) || !strings.Contains(rec.Body.String(), `"inspections":[]`) || rec.Header().Get("Cache-Control") != "no-store") {
			t.Fatal("empty inspection must stay empty and uncached")
		}
	}
}

func TestReferenceMustMatchAudienceFactsAndCheckedOutputs(t *testing.T) {
	replay, _ := simulator.Load("../../../../data/samples/first-sequence.json")
	packs, _ := facts.CornerPacks(replay)
	reference := loadAgentReference("../../../web")
	if reference == nil {
		t.Fatal("reference run not packaged")
	}
	if matchingReference(reference, replay, packs[0], reference.Response, "en-GB", "CASUAL") == nil {
		t.Fatal("approved reference did not match")
	}
	if matchingReference(reference, replay, packs[0], reference.Response, "sw-KE", "CASUAL") != nil || matchingReference(reference, replay, packs[0], reference.Response, "en-GB", "ANALYST") != nil {
		t.Fatal("reference crossed audience")
	}
	reference.Observations[0].Output = json.RawMessage(`{"text":"invented"}`)
	if matchingReference(reference, replay, packs[0], reference.Response, "en-GB", "CASUAL") != nil {
		t.Fatal("reference accepted tampered stage output")
	}
}
