package transporthttp

import (
	"encoding/json"
	"math"
	"testing"
)

// The Control vs Chaos headline shows teams[0]'s indexDelta labelled
// "teams[0] − teams[1]". That is only honest if /api/metrics defines teams as
// two distinct match teams and each tick's indexDelta for teams[0] is its
// index minus teams[1]'s (and the negation for teams[1]).
func TestMetricsTeamOrderDefinesIndexDelta(t *testing.T) {
	demo, all := apiScenarios(t)
	supported := 0
	for name, replay := range all {
		var body struct {
			TrackingMetrics string   `json:"trackingMetrics"`
			Teams           []string `json:"teams"`
			Ticks           []struct {
				Teams map[string]struct {
					Index      float64  `json:"index"`
					IndexDelta *float64 `json:"indexDelta"`
				} `json:"teams"`
			} `json:"ticks"`
		}
		rec := get(t, demo, "/api/metrics?scenario="+name, nil)
		if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		known := map[string]bool{}
		for _, team := range replay.Match.Teams {
			known[team.ID] = true
		}
		if len(body.Teams) != 2 || body.Teams[0] == body.Teams[1] || !known[body.Teams[0]] || !known[body.Teams[1]] {
			t.Fatalf("%s: teams %v must be two distinct match teams", name, body.Teams)
		}
		if body.TrackingMetrics == "supported" {
			supported++
		}
		first, second := body.Teams[0], body.Teams[1]
		for i, tick := range body.Ticks {
			a, b := tick.Teams[first], tick.Teams[second]
			if a.IndexDelta == nil || b.IndexDelta == nil {
				t.Fatalf("%s tick %d: missing indexDelta", name, i)
			}
			if math.Abs(*a.IndexDelta-(a.Index-b.Index)) > 1e-4+1e-12 || math.Abs(*a.IndexDelta+*b.IndexDelta) > 1e-12 {
				t.Fatalf("%s tick %d: indexDelta %v/%v does not match %s index %v minus %s index %v",
					name, i, *a.IndexDelta, *b.IndexDelta, first, a.Index, second, b.Index)
			}
		}
	}
	if supported < 2 {
		t.Fatalf("only %d scenarios have tracking metrics; the sign check needs at least two", supported)
	}
}
