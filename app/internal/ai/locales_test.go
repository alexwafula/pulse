package ai

import (
	"encoding/json"
	"os"
	"reflect"
	"testing"

	"github.com/alexwafula/pulse/app/internal/facts"
	"github.com/alexwafula/pulse/app/internal/simulator"
)

func TestSharedLocaleTemplates(t *testing.T) {
	data, err := os.ReadFile("../../../contracts/examples/locale-template-cases.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases struct {
		Cases          []struct{ Locale, Persona, Text string }
		InvalidLocales []string
	}
	if err := json.Unmarshal(data, &cases); err != nil {
		t.Fatal(err)
	}
	replay, err := simulator.Load("../../../data/samples/first-sequence.json")
	if err != nil {
		t.Fatal(err)
	}
	packs, _ := facts.CornerPacks(replay)
	for _, test := range cases.Cases {
		t.Run(test.Locale+"/"+test.Persona, func(t *testing.T) {
			response, err := Template(packs[0], test.Locale, test.Persona)
			if err != nil || response.Draft.Text != test.Text {
				t.Fatalf("template %v: %v", response, err)
			}
			cue, err := Cue(replay, packs[0], response, test.Locale, test.Persona)
			if err != nil || cue.Verification.Status != "FALLBACK_TEMPLATE" || !reflect.DeepEqual(cue.EventIDs, packs[0].Facts[0].EventIDs) {
				t.Fatalf("invalid translated evidence: %v", err)
			}
			response.Draft.Text += " 9"
			if _, err := Cue(replay, packs[0], response, test.Locale, test.Persona); err == nil {
				t.Fatal("altered translated text accepted")
			}
		})
	}
	for _, locale := range cases.InvalidLocales {
		if _, err := Template(packs[0], locale, "CASUAL"); err == nil {
			t.Fatalf("unsupported locale accepted: %q", locale)
		}
	}
	for _, locale := range []string{"sw-KE", "hi-IN"} {
		response := verifiedResponse(t, packs[0], "CASUAL", "The corner produced 1 shot.")
		response.Draft.Locale = locale
		if _, err := Cue(replay, packs[0], response, locale, "CASUAL"); err == nil {
			t.Fatal("unreviewed model locale accepted as verified")
		}
	}
}
