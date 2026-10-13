package ai

import (
	"encoding/json"
	"os"
	"strings"
	"testing"

	"github.com/alexwafula/pulse/app/internal/domain"
	"github.com/alexwafula/pulse/app/internal/facts"
	"github.com/alexwafula/pulse/app/internal/simulator"
)

func verifiedResponse(t *testing.T, pack domain.FactPack, persona, text string) domain.InsightResponse {
	t.Helper()
	r, err := Template(pack, "en-GB", persona)
	if err != nil {
		t.Fatal(err)
	}
	r.Draft.Text = text
	r.Draft.Claims[0].Text = text
	r.Verification.Status = "VERIFIED"
	r.Verification.ClaimsChecked, r.Verification.ClaimsPassed = 1, 1
	r.Verification.Claims = []domain.ClaimResult{{ClaimID: r.Draft.Claims[0].ID, Supported: true,
		EventIDs: append([]string{}, pack.Facts[0].EventIDs...), Reason: "Supported by the computed corner-shot fact."}}
	return r
}

func TestSharedPublicationLanguage(t *testing.T) {
	replay, err := simulator.Load("../../../data/samples/first-sequence.json")
	if err != nil {
		t.Fatal(err)
	}
	packs, err := facts.CornerPacks(replay)
	if err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile("../../../tests/evaluations/publication-cases.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases []struct {
		Persona, Text string
		Accepted      bool
	}
	if err := json.Unmarshal(data, &cases); err != nil {
		t.Fatal(err)
	}
	for _, tc := range cases {
		t.Run(tc.Persona+"/"+tc.Text, func(t *testing.T) {
			response := verifiedResponse(t, packs[0], tc.Persona, tc.Text)
			cue, err := Cue(replay, packs[0], response, "en-GB", tc.Persona)
			if (err == nil) != tc.Accepted {
				t.Fatalf("accepted=%v, want %v: %v", err == nil, tc.Accepted, err)
			}
			if tc.Accepted && (cue.Text != tc.Text || cue.Verification.Status != "VERIFIED") {
				t.Fatal("verified text not preserved")
			}
		})
	}
}

func TestVerifiedCueRejectsUnsupportedMetadata(t *testing.T) {
	replay, err := simulator.Load("../../../data/samples/first-sequence.json")
	if err != nil {
		t.Fatal(err)
	}
	packs, _ := facts.CornerPacks(replay)
	for _, tc := range []struct {
		name   string
		mutate func(*domain.InsightResponse)
	}{
		{"claim not narration", func(r *domain.InsightResponse) { r.Draft.Claims[0].Text = "A goal was scored." }},
		{"missing draft evidence", func(r *domain.InsightResponse) { r.Draft.Claims[0].EventIDs = r.Draft.Claims[0].EventIDs[:1] }},
		{"missing verifier evidence", func(r *domain.InsightResponse) {
			r.Verification.Claims[0].EventIDs = r.Verification.Claims[0].EventIDs[:1]
		}},
		{"reordered evidence", func(r *domain.InsightResponse) {
			r.Verification.Claims[0].EventIDs[0], r.Verification.Claims[0].EventIDs[1] = r.Verification.Claims[0].EventIDs[1], r.Verification.Claims[0].EventIDs[0]
		}},
		{"wrong persona", func(r *domain.InsightResponse) { r.Draft.Persona = "ANALYST" }},
		{"wrong version", func(r *domain.InsightResponse) { r.SchemaVersion = "1.0.0" }},
		{"empty reason", func(r *domain.InsightResponse) { r.Verification.Claims[0].Reason = "  " }},
		{"long reason", func(r *domain.InsightResponse) { r.Verification.Claims[0].Reason = strings.Repeat("x", 241) }},
		{"invented verifier prose", func(r *domain.InsightResponse) { r.Verification.Claims[0].Reason = "The player scored 9 goals." }},
		{"false approval", func(r *domain.InsightResponse) { r.Verification.Claims[0].Supported = false }},
		{"fallback disguise", func(r *domain.InsightResponse) {
			r.Verification.Status = "FALLBACK_TEMPLATE"
			r.Verification.Claims = nil
			r.Verification.ClaimsChecked = 0
			r.Verification.ClaimsPassed = 0
		}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := verifiedResponse(t, packs[0], "CASUAL", ApprovedWordings("CASUAL")[1])
			tc.mutate(&r)
			if _, err := Cue(replay, packs[0], r, "en-GB", "CASUAL"); err == nil {
				t.Fatal("unsafe verified response published")
			}
		})
	}
}
