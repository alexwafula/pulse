package sim_test

import (
	"encoding/json"
	"path/filepath"
	"strings"
	"testing"

	"github.com/alexwafula/pulse/app/internal/sim"
	"github.com/alexwafula/pulse/app/internal/simulator"
)

func scenarioPath(name string) string {
	return filepath.Join("..", "..", "..", "data", "scenarios", name)
}

// A script without expect.minShots keeps the default shot rule, so a replay
// with zero shots still fails. Only an explicit minShots: 0 waives it.
func TestShotRule_ScriptExpectation(t *testing.T) {
	calm, err := simulator.Load(scenarioPath("calm-midfield.json"))
	if err != nil {
		t.Fatal(err)
	}

	var bare sim.Script
	if err := json.Unmarshal([]byte(`{"name":"no-expect","beats":[]}`), &bare); err != nil {
		t.Fatal(err)
	}
	siege, err := sim.LoadScript(scenarioPath("late-siege.script.json"))
	if err != nil {
		t.Fatal(err)
	}
	var emptyExpect sim.Script
	if err := json.Unmarshal([]byte(`{"name":"empty-expect","expect":{}}`), &emptyExpect); err != nil {
		t.Fatal(err)
	}
	for name, s := range map[string]sim.Script{"inline script, no expect": bare,
		"late-siege script": siege, "expect without minShots": emptyExpect} {
		opts := s.QualityOptions()
		if opts.MinShots != sim.DefaultMinShots {
			t.Errorf("%s: MinShots %d, want default %d", name, opts.MinShots, sim.DefaultMinShots)
		}
		_, err := sim.ValidateQualityWith(&calm, opts)
		if err == nil || !strings.Contains(err.Error(), "insane shot count: 0") {
			t.Errorf("%s: zero-shot replay must fail the shot rule, got %v", name, err)
		}
	}

	if _, err := sim.ValidateQuality(&calm); err == nil {
		t.Error("ValidateQuality (default rules) must reject a zero-shot replay")
	}

	calmScript, err := sim.LoadScript(scenarioPath("calm-midfield.script.json"))
	if err != nil {
		t.Fatal(err)
	}
	m, err := sim.ValidateQualityWith(&calm, calmScript.QualityOptions())
	if err != nil {
		t.Fatalf("calm-midfield with its own expectations: %v", err)
	}
	if !m.ShotRuleWaived {
		t.Error("calm-midfield: ShotRuleWaived must be reported")
	}

	if _, err := sim.ValidateQualityWith(&calm, sim.QualityOptions{MinShots: -1}); err == nil {
		t.Error("negative minShots must be rejected")
	}
}
