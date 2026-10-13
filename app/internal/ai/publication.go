package ai

import (
	"fmt"
	"reflect"

	"github.com/alexwafula/pulse/app/internal/domain"
)

const PublicationReason = "Supported by the computed corner-shot fact."

// ApprovedWordings deliberately covers only the single source-backed corner fact.
func ApprovedWordings(persona string) []string {
	if persona == "CASUAL" {
		return []string{"The corner produced 1 shot.",
			"A shot followed the corner: 1 shot in this sequence.",
			"From corner to shot: 1 shot recorded."}
	}
	if persona == "ANALYST" {
		return []string{"Set-piece sequence: 1 shot following the corner.",
			"Corner sequence: 1 recorded shot, supported by the corner and shot events.",
			"The corner-to-shot window contains 1 shot."}
	}
	return nil
}

func validateResponse(pack domain.FactPack, response domain.InsightResponse, locale, persona string) error {
	if response.Verification.Status == "FALLBACK_TEMPLATE" {
		return ValidateTemplateResponse(pack, response, locale, persona)
	}
	trusted, err := Template(pack, locale, persona)
	if err != nil {
		return err
	}
	if response.SchemaVersion != domain.SchemaVersion || response.Verification.Status != "VERIFIED" {
		return fmt.Errorf("cue gate: only verified claims or the trusted fallback may publish")
	}
	allowed := false
	for _, text := range ApprovedWordings(persona) {
		if response.Draft.Text == text {
			allowed = true
		}
	}
	if !allowed {
		return fmt.Errorf("cue gate: narration is outside the approved source-backed language")
	}
	trusted.Draft.Text = response.Draft.Text
	trusted.Draft.Claims[0].Text = response.Draft.Text
	if !reflect.DeepEqual(trusted.Draft, response.Draft) {
		return fmt.Errorf("cue gate: narration identity, audience, claim or complete evidence differs")
	}
	if err := response.Verification.Validate(response.Draft); err != nil {
		return err
	}
	for _, result := range response.Verification.Claims {
		if !reflect.DeepEqual(result.EventIDs, pack.Facts[0].EventIDs) ||
			result.Reason != PublicationReason {
			return fmt.Errorf("cue gate: verifier omitted evidence or supplied an invalid reason")
		}
	}
	return nil
}
