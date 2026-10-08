package domain

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func example(t *testing.T, name string, target any) {
	t.Helper()
	data, err := os.ReadFile(filepath.Join("..", "..", "..", "contracts", "examples", name+".json"))
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(data, target); err != nil {
		t.Fatal(err)
	}
}

func TestSharedAgentExamples(t *testing.T) {
	var pack FactPack
	example(t, "fact-pack", &pack)
	var draft NarrationDraft
	example(t, "narration-draft", &draft)
	for _, tc := range []struct {
		name  string
		valid bool
	}{{"narration-draft", true}, {"invalid-narration-draft", false}} {
		t.Run(tc.name, func(t *testing.T) {
			var value NarrationDraft
			example(t, tc.name, &value)
			if err := value.Validate(pack); (err == nil) != tc.valid {
				t.Fatalf("valid=%v: %v", tc.valid, err)
			}
		})
	}
	for _, tc := range []struct {
		name  string
		valid bool
	}{{"verification-result", true}, {"invalid-verification-result", false}} {
		t.Run(tc.name, func(t *testing.T) {
			var value VerificationResult
			example(t, tc.name, &value)
			if err := value.Validate(draft); (err == nil) != tc.valid {
				t.Fatalf("valid=%v: %v", tc.valid, err)
			}
		})
	}
}

func TestVerificationRejectsUnsupportedAndMissingClaims(t *testing.T) {
	var draft NarrationDraft
	example(t, "narration-draft", &draft)
	for _, mutate := range []func(*VerificationResult){
		func(v *VerificationResult) { v.Claims[0].Supported = false; v.ClaimsPassed = 0 },
		func(v *VerificationResult) { v.Claims[0].EventIDs = []string{"evt-unknown"} },
		func(v *VerificationResult) { v.Claims = nil; v.ClaimsChecked = 0; v.ClaimsPassed = 0 },
	} {
		var value VerificationResult
		example(t, "verification-result", &value)
		mutate(&value)
		if value.Validate(draft) == nil {
			t.Fatal("invalid verification accepted")
		}
	}
}
