package ai

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"reflect"
	"testing"

	"github.com/alexwafula/pulse/app/internal/domain"
	"github.com/alexwafula/pulse/app/internal/facts"
	"github.com/alexwafula/pulse/app/internal/simulator"
)

func TestTemplateCueGate(t *testing.T) {
	r, err := simulator.Load("../../../data/samples/first-sequence.json")
	if err != nil {
		t.Fatal(err)
	}
	packs, _ := facts.CornerPacks(r)
	pack := packs[0]
	response, err := Template(pack, "en-GB", "CASUAL")
	if err != nil {
		t.Fatal(err)
	}
	cue, err := Cue(r, pack, response, "en-GB", "CASUAL")
	if err != nil || cue.Text != "The corner produced 1 shot." || cue.StartMS != 1678000 || cue.ReplayStartMS != 1672000 {
		t.Fatalf("cue: %+v, %v", cue, err)
	}
	for _, tc := range []struct {
		name   string
		change func(*domain.InsightResponse)
	}{
		{"invented number", func(r *domain.InsightResponse) { r.Draft.Text = "The corner produced 9 shots." }},
		{"unknown event", func(r *domain.InsightResponse) { r.Draft.Claims[0].EventIDs = []string{"evt-unknown"} }},
		{"unverified claim", func(r *domain.InsightResponse) { r.Verification.Status = "VERIFIED" }},
		{"wrong persona", func(r *domain.InsightResponse) { r.Draft.Persona = "ANALYST" }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			altered, _ := Template(pack, "en-GB", "CASUAL")
			tc.change(&altered)
			if _, err := Cue(r, pack, altered, "en-GB", "CASUAL"); err == nil {
				t.Fatal("unsafe cue published")
			}
		})
	}
	pack.Facts[0].Value = 9
	if _, err := Cue(r, pack, response, "en-GB", "CASUAL"); err == nil {
		t.Fatal("fabricated fact pack accepted")
	}
}

func TestPythonHTTPBoundary(t *testing.T) {
	data, err := os.ReadFile("../../../contracts/examples/insight-request.json")
	if err != nil {
		t.Fatal(err)
	}
	var request domain.InsightRequest
	if err := json.Unmarshal(data, &request); err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" || r.URL.Path != "/insights" {
			t.Error("wrong boundary")
		}
		var got domain.InsightRequest
		if json.NewDecoder(r.Body).Decode(&got) != nil || got.FactPack.ID != request.FactPack.ID {
			t.Error("fact pack not delivered")
		}
		result, _ := Template(got.FactPack, got.Locale, got.Persona)
		json.NewEncoder(w).Encode(result)
	}))
	defer server.Close()
	response, err := Request(context.Background(), server.URL, request.FactPack, request.Locale, request.Persona)
	if err != nil || response.Draft.Text != "The corner produced 1 shot." {
		t.Fatalf("response: %+v, %v", response, err)
	}
}

func TestSharedInsightCases(t *testing.T) {
	read := func(name string) []byte {
		data, err := os.ReadFile("../../../contracts/examples/" + name)
		if err != nil {
			t.Fatal(err)
		}
		return data
	}
	var request domain.InsightRequest
	json.Unmarshal(read("insight-request.json"), &request)
	var response domain.InsightResponse
	json.Unmarshal(read("insight-response.json"), &response)
	expected, err := Template(request.FactPack, request.Locale, request.Persona)
	if err != nil || !reflect.DeepEqual(expected, response) {
		t.Fatalf("shared template drift: %v", err)
	}
	var manifest struct {
		Cases []struct {
			Name   string `json:"name"`
			Target string `json:"target"`
			Path   []any  `json:"path"`
			Value  any    `json:"value"`
		} `json:"cases"`
	}
	if err := json.Unmarshal(read("invalid-insight-cases.json"), &manifest); err != nil {
		t.Fatal(err)
	}
	for _, tc := range manifest.Cases {
		t.Run(tc.Name, func(t *testing.T) {
			var target any
			name := "insight-request.json"
			if tc.Target == "response" {
				name = "insight-response.json"
			}
			json.Unmarshal(read(name), &target)
			node := target
			for _, key := range tc.Path[:len(tc.Path)-1] {
				switch key := key.(type) {
				case string:
					node = node.(map[string]any)[key]
				case float64:
					node = node.([]any)[int(key)]
				}
			}
			key := tc.Path[len(tc.Path)-1].(string)
			node.(map[string]any)[key] = tc.Value
			data, _ := json.Marshal(target)
			if tc.Target == "request" {
				var altered domain.InsightRequest
				json.Unmarshal(data, &altered)
				if _, err := Template(altered.FactPack, altered.Locale, altered.Persona); err == nil {
					t.Fatal("invalid request accepted")
				}
			} else {
				var altered domain.InsightResponse
				json.Unmarshal(data, &altered)
				if ValidateTemplateResponse(request.FactPack, altered, request.Locale, request.Persona) == nil {
					t.Fatal("invalid response accepted")
				}
			}
		})
	}
}
