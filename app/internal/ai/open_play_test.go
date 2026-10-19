package ai

import (
	"encoding/json"
	"os"
	"testing"

	"github.com/alexwafula/pulse/app/internal/domain"
	"github.com/alexwafula/pulse/app/internal/facts"
	"github.com/alexwafula/pulse/app/internal/simulator"
)

func TestOpenPlaySharedBoundary(t *testing.T) {
	data, err := os.ReadFile("../../../contracts/examples/open-play-pattern.json")
	if err != nil {
		t.Fatal(err)
	}
	var sample struct {
		Request   domain.InsightRequest
		Templates map[string]map[string]string
		Invalid   []struct {
			Field string
			Value any
		}
	}
	if err := json.Unmarshal(data, &sample); err != nil {
		t.Fatal(err)
	}
	for locale, personas := range sample.Templates {
		for persona, text := range personas {
			response, err := Template(sample.Request.FactPack, locale, persona)
			if err != nil || response.Draft.Text != text {
				t.Fatalf("%s/%s: %+v %v", locale, persona, response, err)
			}
		}
	}
	for _, bad := range sample.Invalid {
		var raw map[string]any
		json.Unmarshal(data, &raw)
		request := raw["request"].(map[string]any)
		pack := request["factPack"].(map[string]any)
		pack["facts"].([]any)[0].(map[string]any)[bad.Field] = bad.Value
		body, _ := json.Marshal(request)
		var altered domain.InsightRequest
		json.Unmarshal(body, &altered)
		if _, err := Template(altered.FactPack, "en-GB", "CASUAL"); err == nil {
			t.Fatalf("invalid fact accepted: %s=%v", bad.Field, bad.Value)
		}
	}
}

func TestOpenPlayIndependentCueGate(t *testing.T) {
	r, err := simulator.Load("../../../data/scenarios/late-siege.json")
	if err != nil {
		t.Fatal(err)
	}
	packs, _ := facts.OpenPlayPacks(r)
	pack := packs[0]
	for _, persona := range []string{"CASUAL", "ANALYST"} {
		for _, text := range ApprovedPackWordings(pack, persona) {
			response, _ := Template(pack, "en-GB", persona)
			response.Draft.Text = text
			response.Draft.Claims[0].Text = text
			response.Verification = domain.VerificationResult{SchemaVersion: domain.SchemaVersion, DraftID: response.Draft.ID, Status: "VERIFIED", ClaimsChecked: 1, ClaimsPassed: 1, Claims: []domain.ClaimResult{{ClaimID: response.Draft.Claims[0].ID, Supported: true, EventIDs: append([]string{}, pack.Facts[0].EventIDs...), Reason: PublicationReasonFor(pack)}}}
			if _, err := Cue(r, pack, response, "en-GB", persona); err != nil {
				t.Fatal(err)
			}
			response.Draft.Text = "The pass created a goal."
			if _, err := Cue(r, pack, response, "en-GB", persona); err == nil {
				t.Fatal("invented causal claim passed")
			}
		}
	}
	response, _ := Template(pack, "en-GB", "CASUAL")
	pack.Facts[0].Value = 2
	if _, err := Cue(r, pack, response, "en-GB", "CASUAL"); err == nil {
		t.Fatal("forged count passed independent replay check")
	}
}
