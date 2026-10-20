package transporthttp

import (
	"bytes"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"reflect"
	"time"

	"github.com/alexwafula/pulse/app/internal/ai"
	"github.com/alexwafula/pulse/app/internal/domain"
)

type referenceObservation struct {
	Role       string `json:"role"`
	ResponseID string `json:"responseId"`
	Model      string `json:"model"`
	ObservedAt string `json:"observedAt"`
	DurationMS int64  `json:"durationMs"`
	Usage      struct {
		Prompt     int `json:"prompt_tokens"`
		Completion int `json:"completion_tokens"`
	} `json:"usage"`
	Output json.RawMessage `json:"output"`
}

type agentReference struct {
	Version      string                 `json:"version"`
	Kind         string                 `json:"kind"`
	CapturedAt   string                 `json:"capturedAt"`
	Deployment   string                 `json:"deployment"`
	Request      domain.InsightRequest  `json:"request"`
	Response     domain.InsightResponse `json:"response"`
	Accepted     bool                   `json:"accepted"`
	ModelCalls   int                    `json:"modelCalls"`
	Observations []referenceObservation `json:"observations"`
}

func loadAgentReference(webDir string) *agentReference {
	return loadReferenceFile(webDir, "corner-casual.en-GB.json", "reproduction-not-original-capture")
}

func loadAgentReferences(webDir string) []*agentReference {
	return []*agentReference{loadAgentReference(webDir), loadReferenceFile(webDir, "open-play-casual.en-GB.json", "captured-agent-run")}
}

func loadReferenceFile(webDir, name, kind string) *agentReference {
	file, err := os.Open(filepath.Join(webDir, "..", "..", "agents", "inspections", name))
	if err != nil {
		return nil
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, 65537))
	if err != nil || len(data) > 65536 {
		return nil
	}
	var reference agentReference
	if json.Unmarshal(data, &reference) != nil || reference.Version != "pulse-agent-reference-v1" ||
		reference.Kind != kind || !reference.Accepted ||
		reference.ModelCalls != 3 || len(reference.Observations) != 3 {
		return nil
	}
	if _, err := time.Parse(time.RFC3339Nano, reference.CapturedAt); err != nil {
		return nil
	}
	for i, role := range []string{"explainer", "narrator", "verifier"} {
		item := reference.Observations[i]
		if item.Role != role || len(item.ResponseID) < 1 || len(item.ResponseID) > 128 || len(item.Model) < 1 || len(item.Model) > 128 ||
			item.DurationMS < 0 || item.DurationMS > 60000 || item.Usage.Prompt < 0 || item.Usage.Completion < 0 || item.Usage.Completion > 512 {
			return nil
		}
	}
	return &reference
}

func matchingReference(reference *agentReference, replay domain.Replay, pack domain.FactPack, response domain.InsightResponse, locale, persona string) *agentReference {
	if reference == nil || reference.Request.Locale != locale || reference.Request.Persona != persona ||
		!sameJSON(reference.Request.FactPack, pack) || !reflect.DeepEqual(reference.Response, response) {
		return nil
	}
	if _, err := ai.Cue(replay, pack, reference.Response, locale, persona); err != nil {
		return nil
	}
	claim := response.Draft.Claims[0]
	template, err := ai.Template(pack, "en-GB", "CASUAL")
	if err != nil {
		return nil
	}
	claim.Text = template.Draft.Text
	if !sameJSON(reference.Observations[0].Output, claim) || !sameJSON(reference.Observations[1].Output, response.Draft) {
		return nil
	}
	var checked domain.VerificationResult
	if json.Unmarshal(reference.Observations[2].Output, &checked) != nil || checked.Validate(response.Draft) != nil {
		return nil
	}
	for i := range checked.Claims {
		checked.Claims[i].Reason = ai.PublicationReasonFor(pack)
	}
	if !reflect.DeepEqual(checked, response.Verification) {
		return nil
	}
	return reference
}

func sameJSON(a, b any) bool {
	encode := func(value any) []byte {
		data, err := json.Marshal(value)
		if err != nil {
			return nil
		}
		var normalized any
		if json.Unmarshal(data, &normalized) != nil {
			return nil
		}
		data, _ = json.Marshal(normalized)
		return data
	}
	left, right := encode(a), encode(b)
	return left != nil && right != nil && bytes.Equal(left, right)
}
