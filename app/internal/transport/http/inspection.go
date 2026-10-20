package transporthttp

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/alexwafula/pulse/app/internal/ai"
	"github.com/alexwafula/pulse/app/internal/domain"
)

// Inspection is a presentation envelope, not an extension of the v2 cue contract.
// Historical agent execution is unknown unless the original trace was retained.
type insightInspection struct {
	CueID         string                 `json:"cueId"`
	Source        string                 `json:"source"`
	DeliveryMS    int64                  `json:"deliveryMs"`
	RemoteOutcome string                 `json:"remoteOutcome"`
	FactPack      domain.FactPack        `json:"factPack"`
	Response      domain.InsightResponse `json:"response"`
	GatePassed    bool                   `json:"gatePassed"`
	Safety        inspectionSafety       `json:"safety"`
	Reference     *agentReference        `json:"reference,omitempty"`
}

type inspectionSafety struct {
	InjectedText   string `json:"injectedText"`
	Rejected       bool   `json:"rejected"`
	FallbackPassed bool   `json:"fallbackPassed"`
}

type inspectionFeed struct {
	Version     string              `json:"version"`
	Feed        domain.CueFeed      `json:"feed"`
	Inspections []insightInspection `json:"inspections"`
}

// Both routes execute the same delivery and publication checks. The browser
// requests the envelope once; opening the Inspector makes no extra agent call.
func insightHandler(replay domain.Replay, packs []domain.FactPack, agentsURL string, inspect bool, references ...*agentReference) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.Header().Set("Allow", "GET")
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		persona := r.URL.Query().Get("persona")
		if persona == "" {
			persona = "CASUAL"
		}
		if persona != "CASUAL" && persona != "ANALYST" {
			http.Error(w, "unsupported persona", http.StatusBadRequest)
			return
		}
		locale := requestLocale(r)
		result := inspectionFeed{Version: "pulse-inspection-v1", Feed: domain.CueFeed{SchemaVersion: domain.SchemaVersion, Cues: []domain.OverlayCue{}}, Inspections: []insightInspection{}}
		feedSource := ""
		for _, pack := range packs {
			start := time.Now()
			response, err := ai.Template(pack, locale, persona)
			if err != nil {
				http.Error(w, "unsupported fact pack", http.StatusInternalServerError)
				return
			}
			source, outcome := "go-template", "not-configured"
			if agentsURL != "" {
				remote, mode, remoteErr := ai.RequestWithMode(r.Context(), agentsURL, pack, locale, persona)
				outcome = "unavailable"
				if remoteErr == nil {
					_, remoteErr = ai.Cue(replay, pack, remote, locale, persona)
					outcome = "rejected"
					if remoteErr == nil {
						response, source, outcome = remote, "python-template", "accepted"
						if remote.Verification.Status == "VERIFIED" {
							source = "python-verified"
							if mode == "recorded" {
								source = "python-recorded"
							}
						}
					}
				}
				if remoteErr != nil {
					log.Printf("Python insight rejected/unavailable; using Go template: %v", remoteErr)
				}
			}
			cue, err := ai.Cue(replay, pack, response, locale, persona)
			if err != nil {
				http.Error(w, "cue validation failed", http.StatusInternalServerError)
				return
			}
			result.Feed.Cues = append(result.Feed.Cues, cue)
			if feedSource == "" {
				feedSource = source
			} else if feedSource != source {
				feedSource = "mixed"
			}
			if inspect {
				var reference *agentReference
				for _, candidate := range references {
					if matched := matchingReference(candidate, replay, pack, response, locale, persona); matched != nil {
						reference = matched
						break
					}
				}
				result.Inspections = append(result.Inspections, insightInspection{CueID: cue.ID, Source: source,
					DeliveryMS: time.Since(start).Milliseconds(), RemoteOutcome: outcome, FactPack: pack,
					Response: response, GatePassed: true, Safety: checkInjectedClaim(replay, pack, locale, persona),
					Reference: reference})
			}
		}
		if len(packs) == 0 {
			feedSource = "go-template"
		}
		w.Header().Set("X-Pulse-Insight-Source", feedSource)
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		if inspect {
			_ = json.NewEncoder(w).Encode(result)
		} else {
			_ = json.NewEncoder(w).Encode(result.Feed)
		}
	}
}

func checkInjectedClaim(replay domain.Replay, pack domain.FactPack, locale, persona string) inspectionSafety {
	// Isolated test input is never appended to a cue feed or model prompt.
	template, err := ai.Template(pack, locale, persona)
	if err != nil {
		return inspectionSafety{}
	}
	_, fallbackErr := ai.Cue(replay, pack, template, locale, persona)
	text := "The corner produced 2 shots."
	if pack.Facts[0].Metric == "open_play_passes_before_shot" {
		text = "There were 99 completed passes before the shot."
	}
	template.Draft.Text = text
	template.Draft.Claims[0].Text = text
	template.Verification.Status = "VERIFIED"
	template.Verification.ClaimsChecked, template.Verification.ClaimsPassed = 1, 1
	template.Verification.Claims = []domain.ClaimResult{{ClaimID: template.Draft.Claims[0].ID, Supported: true,
		EventIDs: append([]string{}, template.Draft.Claims[0].EventIDs...), Reason: ai.PublicationReasonFor(pack)}}
	_, rejected := ai.Cue(replay, pack, template, locale, persona)
	return inspectionSafety{InjectedText: text, Rejected: rejected != nil, FallbackPassed: fallbackErr == nil}
}
