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

func TestOpenPlayTemplateCountAgreement(t *testing.T) {
	r, err := simulator.Load("../../../data/scenarios/late-siege.json")
	if err != nil {
		t.Fatal(err)
	}
	packs, _ := facts.OpenPlayPacks(r)
	single := packs[0]
	if single.Facts[0].Value != 1 {
		t.Fatalf("late-siege open-play count changed: %v", single.Facts[0].Value)
	}
	plural := single
	plural.Facts = []domain.Fact{single.Facts[0]}
	plural.Facts[0].Value = 2
	for _, tc := range []struct {
		pack            domain.FactPack
		locale, persona string
		want            string
	}{
		// en-GB must stay byte-identical: the recorded capture is bound to it.
		{single, "en-GB", "CASUAL", "1 completed pass came before the first shot in this open-play window."},
		{single, "en-GB", "ANALYST", "Open-play window: 1 completed pass before its first shot."},
		{single, "sw-KE", "CASUAL", "Pasi 1 iliyokamilika ilitangulia shuti la kwanza katika kipindi hiki cha mchezo wazi."},
		{single, "sw-KE", "ANALYST", "Kipindi cha mchezo wazi: pasi 1 iliyokamilika kabla ya shuti lake la kwanza."},
		{plural, "sw-KE", "CASUAL", "Pasi 2 zilizokamilika zilitangulia shuti la kwanza katika kipindi hiki cha mchezo wazi."},
		{plural, "sw-KE", "ANALYST", "Kipindi cha mchezo wazi: pasi 2 zilizokamilika kabla ya shuti lake la kwanza."},
		{single, "hi-IN", "CASUAL", "इस खुले खेल की अवधि में पहले शॉट से पहले 1 सफल पास दर्ज हुआ।"},
		{single, "hi-IN", "ANALYST", "खुले खेल की अवधि: पहले शॉट से पहले 1 सफल पास।"},
		{plural, "hi-IN", "CASUAL", "इस खुले खेल की अवधि में पहले शॉट से पहले 2 सफल पास दर्ज हुए।"},
		{plural, "hi-IN", "ANALYST", "खुले खेल की अवधि: पहले शॉट से पहले 2 सफल पास।"},
	} {
		got, err := openPlayTemplate(tc.pack, tc.locale, tc.persona)
		if err != nil || got != tc.want {
			t.Errorf("%v %s/%s = %q, %v; want %q", tc.pack.Facts[0].Value, tc.locale, tc.persona, got, err, tc.want)
		}
	}
}

func TestOpenPlayTemplateRejectsUnknownAudience(t *testing.T) {
	r, err := simulator.Load("../../../data/scenarios/late-siege.json")
	if err != nil {
		t.Fatal(err)
	}
	packs, _ := facts.OpenPlayPacks(r)
	for _, tc := range []struct{ locale, persona string }{{"fr-FR", "CASUAL"}, {"en-GB", "NEWCOMER"}, {"", ""}} {
		if text, err := openPlayTemplate(packs[0], tc.locale, tc.persona); err == nil || text != "" {
			t.Errorf("%s/%s = %q, %v; want an error", tc.locale, tc.persona, text, err)
		}
	}
}
