package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"reflect"
	"strings"
	"time"

	"github.com/alexwafula/pulse/app/internal/domain"
	"github.com/alexwafula/pulse/app/internal/facts"
)

// Template is intentionally narrow: arbitrary prose cannot pass the initial gate.
func Template(pack domain.FactPack, locale, persona string) (domain.InsightResponse, error) {
	if locale != "en-GB" || (persona != "CASUAL" && persona != "ANALYST") {
		return domain.InsightResponse{}, fmt.Errorf("unsupported template audience")
	}
	if pack.SchemaVersion != domain.SchemaVersion || len(pack.Facts) != 1 || pack.Period < 1 || pack.Period > 4 || pack.WindowStartMS < 0 || pack.WindowEndMS < pack.WindowStartMS {
		return domain.InsightResponse{}, fmt.Errorf("template requires one computed corner fact")
	}
	fact := pack.Facts[0]
	count, ok := fact.Value.(int)
	if !ok {
		if value, number := fact.Value.(float64); number && value == 1 {
			count, ok = 1, true
		}
	}
	if !ok || count != 1 || fact.Metric != "set_piece_shots" || fact.Unit != "shots" || len(fact.EventIDs) != 2 {
		return domain.InsightResponse{}, fmt.Errorf("unsupported corner fact")
	}
	text := "The corner produced 1 shot."
	if persona == "ANALYST" {
		text = "Set-piece sequence: 1 shot following the corner."
	}
	draft := domain.NarrationDraft{SchemaVersion: domain.SchemaVersion, ID: "draft-" + pack.ID,
		FactPackID: pack.ID, Locale: locale, Persona: persona, Text: text,
		Claims: []domain.Claim{{ID: "claim-" + fact.ID, Text: text, FactIDs: []string{fact.ID}, EventIDs: append([]string{}, fact.EventIDs...)}}}
	if err := draft.Validate(pack); err != nil {
		return domain.InsightResponse{}, err
	}
	return domain.InsightResponse{SchemaVersion: domain.SchemaVersion, Draft: draft,
		Verification: domain.VerificationResult{SchemaVersion: domain.SchemaVersion, DraftID: draft.ID,
			Status: "FALLBACK_TEMPLATE", Claims: []domain.ClaimResult{}}}, nil
}

func ValidateTemplateResponse(pack domain.FactPack, response domain.InsightResponse, locale, persona string) error {
	trusted, err := Template(pack, locale, persona)
	if err != nil {
		return err
	}
	if !reflect.DeepEqual(response, trusted) {
		return fmt.Errorf("cue gate: response is not the trusted template")
	}
	if err := response.Draft.Validate(pack); err != nil {
		return err
	}
	return response.Verification.Validate(response.Draft)
}

func Request(ctx context.Context, endpoint string, pack domain.FactPack, locale, persona string) (domain.InsightResponse, error) {
	body, err := json.Marshal(domain.InsightRequest{SchemaVersion: domain.SchemaVersion, FactPack: pack, Locale: locale, Persona: persona})
	if err != nil {
		return domain.InsightResponse{}, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(endpoint, "/")+"/insights", bytes.NewReader(body))
	if err != nil {
		return domain.InsightResponse{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 2 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		return domain.InsightResponse{}, fmt.Errorf("agent request: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return domain.InsightResponse{}, fmt.Errorf("agent HTTP status %d", res.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(res.Body, 65537))
	if err != nil || len(data) > 65536 {
		return domain.InsightResponse{}, fmt.Errorf("invalid agent response size")
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	var response domain.InsightResponse
	if err := decoder.Decode(&response); err != nil {
		return response, fmt.Errorf("decode insight: %w", err)
	}
	var extra any
	if decoder.Decode(&extra) != io.EOF {
		return response, fmt.Errorf("extra agent response data")
	}
	return response, nil
}

// Cue is the Phase 1 publishing gate. It accepts only the canonical template
// with complete source evidence, never an arbitrary model's fallback claim.
func Cue(replay domain.Replay, pack domain.FactPack, response domain.InsightResponse, locale, persona string) (domain.OverlayCue, error) {
	computed, err := facts.CornerPacks(replay)
	if err != nil {
		return domain.OverlayCue{}, err
	}
	matched := false
	for _, actual := range computed {
		if reflect.DeepEqual(pack, actual) {
			matched = true
		}
	}
	if !matched {
		return domain.OverlayCue{}, fmt.Errorf("cue gate: fact pack does not match replay calculation")
	}
	if err := ValidateTemplateResponse(pack, response, locale, persona); err != nil {
		return domain.OverlayCue{}, err
	}
	if pack.MatchID != replay.Match.ID || pack.Period != replay.Match.Period || pack.WindowStartMS < replay.Match.StartMS || pack.WindowEndMS < pack.WindowStartMS || pack.WindowEndMS > replay.Match.EndMS {
		return domain.OverlayCue{}, fmt.Errorf("cue gate: invalid fact window")
	}
	fact := pack.Facts[0]
	var corner, shot *domain.Event
	for i := range replay.Events {
		e := &replay.Events[i]
		if e.ID == fact.EventIDs[0] {
			corner = e
		}
		if e.ID == fact.EventIDs[1] {
			shot = e
		}
	}
	if corner == nil || shot == nil || corner.Type != "CORNER" || corner.Outcome != "COMPLETE" || shot.Type != "SHOT" ||
		corner.TeamID != fact.TeamID || shot.TeamID != fact.TeamID || corner.PhaseID != shot.PhaseID ||
		corner.TimeMS != pack.WindowStartMS || shot.TimeMS != pack.WindowEndMS || shot.TimeMS-corner.TimeMS > 12000 ||
		fact.TimeStartMS != corner.TimeMS || fact.TimeEndMS != shot.TimeMS {
		return domain.OverlayCue{}, fmt.Errorf("cue gate: invalid source events")
	}
	if err := response.Draft.Validate(pack); err != nil {
		return domain.OverlayCue{}, err
	}
	if err := response.Verification.Validate(response.Draft); err != nil {
		return domain.OverlayCue{}, err
	}
	return domain.OverlayCue{SchemaVersion: domain.SchemaVersion, ID: "cue-" + pack.ID, MatchID: pack.MatchID,
		Period: pack.Period, StartMS: pack.WindowEndMS, EndMS: replay.Match.EndMS,
		ReplayStartMS: pack.WindowStartMS, ReplayEndMS: pack.WindowEndMS,
		Locale: locale, Persona: persona, Kind: "COMMENTARY", Priority: 5,
		Text: response.Draft.Text, FactIDs: []string{fact.ID}, EventIDs: append([]string{}, fact.EventIDs...), Verification: response.Verification}, nil
}
