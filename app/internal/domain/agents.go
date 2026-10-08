package domain

import "fmt"

type Fact struct {
	ID          string         `json:"id"`
	Metric      string         `json:"metric"`
	Value       any            `json:"value"`
	Unit        string         `json:"unit"`
	TeamID      string         `json:"teamId"`
	TimeStartMS int64          `json:"timeStartMs"`
	TimeEndMS   int64          `json:"timeEndMs"`
	EventIDs    []string       `json:"eventIds"`
	Attributes  map[string]any `json:"attributes,omitempty"`
}

type FactPack struct {
	SchemaVersion string `json:"schemaVersion"`
	ID            string `json:"id"`
	MatchID       string `json:"matchId"`
	Period        int    `json:"period"`
	WindowStartMS int64  `json:"windowStartMs"`
	WindowEndMS   int64  `json:"windowEndMs"`
	Facts         []Fact `json:"facts"`
}

type Claim struct {
	ID       string   `json:"id"`
	Text     string   `json:"text"`
	FactIDs  []string `json:"factIds"`
	EventIDs []string `json:"eventIds"`
}

type NarrationDraft struct {
	SchemaVersion string  `json:"schemaVersion"`
	ID            string  `json:"id"`
	FactPackID    string  `json:"factPackId"`
	Locale        string  `json:"locale"`
	Persona       string  `json:"persona"`
	Text          string  `json:"text"`
	Claims        []Claim `json:"claims"`
}

type ClaimResult struct {
	ClaimID   string   `json:"claimId"`
	Supported bool     `json:"supported"`
	EventIDs  []string `json:"eventIds"`
	Reason    string   `json:"reason"`
}

type VerificationResult struct {
	SchemaVersion string        `json:"schemaVersion"`
	DraftID       string        `json:"draftId"`
	Status        string        `json:"status"`
	ClaimsChecked int           `json:"claimsChecked"`
	ClaimsPassed  int           `json:"claimsPassed"`
	Claims        []ClaimResult `json:"claims"`
}

func (d NarrationDraft) Validate(pack FactPack) error {
	if d.SchemaVersion != SchemaVersion || !validID(d.ID) || d.FactPackID != pack.ID ||
		(d.Locale != "en-GB" && d.Locale != "sw-KE") || (d.Persona != "CASUAL" && d.Persona != "ANALYST") ||
		!validText(d.Text) || len(d.Claims) == 0 {
		return fmt.Errorf("invalid narration draft")
	}
	facts := make(map[string]Fact, len(pack.Facts))
	for _, fact := range pack.Facts {
		facts[fact.ID] = fact
	}
	seen := make(map[string]bool)
	for _, claim := range d.Claims {
		if !validID(claim.ID) || seen[claim.ID] || !validText(claim.Text) || !uniqueIDs(claim.FactIDs) || !uniqueIDs(claim.EventIDs) {
			return fmt.Errorf("invalid claim %q", claim.ID)
		}
		seen[claim.ID] = true
		evidence := make(map[string]bool)
		for _, id := range claim.FactIDs {
			fact, ok := facts[id]
			if !ok {
				return fmt.Errorf("unknown fact %q", id)
			}
			for _, eventID := range fact.EventIDs {
				evidence[eventID] = true
			}
		}
		for _, id := range claim.EventIDs {
			if !evidence[id] {
				return fmt.Errorf("unsupported evidence %q", id)
			}
		}
	}
	return nil
}

func (v VerificationResult) Validate(draft NarrationDraft) error {
	if v.SchemaVersion != SchemaVersion || v.DraftID != draft.ID || v.ClaimsChecked < 0 ||
		v.ClaimsPassed < 0 || v.ClaimsPassed > v.ClaimsChecked || v.ClaimsChecked != len(v.Claims) {
		return fmt.Errorf("invalid verification counts or identity")
	}
	if v.Status == "FALLBACK_TEMPLATE" {
		if v.ClaimsChecked != 0 || v.ClaimsPassed != 0 {
			return fmt.Errorf("fallback cannot claim model verification")
		}
		return nil
	}
	if v.Status != "VERIFIED" && v.Status != "REJECTED" {
		return fmt.Errorf("invalid verification status")
	}
	claims := make(map[string]Claim)
	for _, claim := range draft.Claims {
		claims[claim.ID] = claim
	}
	seen := make(map[string]bool)
	passed := 0
	for _, result := range v.Claims {
		claim, ok := claims[result.ClaimID]
		if !ok || seen[result.ClaimID] || result.Reason == "" {
			return fmt.Errorf("invalid checked claim")
		}
		seen[result.ClaimID] = true
		if result.Supported {
			if !uniqueIDs(result.EventIDs) {
				return fmt.Errorf("supported claim requires evidence")
			}
			passed++
		}
		for _, id := range result.EventIDs {
			found := false
			for _, evidence := range claim.EventIDs {
				if evidence == id {
					found = true
				}
			}
			if !found {
				return fmt.Errorf("verification cites unrelated event")
			}
		}
	}
	if passed != v.ClaimsPassed || len(seen) != len(draft.Claims) {
		return fmt.Errorf("verification must check every claim")
	}
	if v.Status == "VERIFIED" && (passed == 0 || passed != v.ClaimsChecked) {
		return fmt.Errorf("verified result must pass every claim")
	}
	if v.Status == "REJECTED" && passed == v.ClaimsChecked {
		return fmt.Errorf("rejected result must contain a failed claim")
	}
	return nil
}

func validText(text string) bool { return len([]rune(text)) > 0 && len([]rune(text)) <= 240 }

func uniqueIDs(ids []string) bool {
	if len(ids) == 0 {
		return false
	}
	seen := make(map[string]bool)
	for _, id := range ids {
		if !validID(id) || seen[id] {
			return false
		}
		seen[id] = true
	}
	return true
}
