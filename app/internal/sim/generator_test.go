package sim_test

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/alexwafula/pulse/app/internal/sim"
)

func loadScript(t *testing.T) sim.Script {
	t.Helper()
	path := filepath.Join("..", "..", "..", "data", "scenarios", "late-siege.script.json")
	script, err := sim.LoadScript(path)
	if err != nil {
		t.Fatalf("loading script: %v", err)
	}
	return script
}

func TestGenerate_Determinism(t *testing.T) {
	script := loadScript(t)

	replay1, err := sim.Generate(script, 42)
	if err != nil {
		t.Fatalf("generation 1 failed: %v", err)
	}

	replay2, err := sim.Generate(script, 42)
	if err != nil {
		t.Fatalf("generation 2 failed: %v", err)
	}

	bytes1, err := json.Marshal(replay1)
	if err != nil {
		t.Fatalf("marshaling replay 1: %v", err)
	}

	bytes2, err := json.Marshal(replay2)
	if err != nil {
		t.Fatalf("marshaling replay 2: %v", err)
	}

	if !bytes.Equal(bytes1, bytes2) {
		t.Errorf("expected deterministic identical byte output for same seed, but outputs differed")
	}
}

func TestGenerate_QualityValidation(t *testing.T) {
	script := loadScript(t)

	replay, err := sim.Generate(script, 42)
	if err != nil {
		t.Fatalf("generation failed: %v", err)
	}

	metrics, err := sim.ValidateQuality(replay)
	if err != nil {
		t.Fatalf("validation failed: %v", err)
	}

	if metrics.MaxPlayerSpeed > 7.5 {
		t.Errorf("max player speed %f exceeds 7.5 m/s", metrics.MaxPlayerSpeed)
	}
	if metrics.MinPlayerDist < 0.5 {
		t.Errorf("min player distance %f < 0.5m", metrics.MinPlayerDist)
	}
}

func TestGenerate_EmittedJSONHasNoRoleOrSlot(t *testing.T) {
	script := loadScript(t)
	replay, err := sim.Generate(script, 42)
	if err != nil {
		t.Fatalf("generation failed: %v", err)
	}

	data, err := json.Marshal(replay)
	if err != nil {
		t.Fatalf("marshaling replay: %v", err)
	}

	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		t.Fatalf("unmarshaling to generic map: %v", err)
	}

	match, ok := raw["match"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected match object in emitted JSON")
	}

	players, ok := match["players"].([]interface{})
	if !ok || len(players) == 0 {
		t.Fatalf("expected players list in emitted match")
	}

	for i, p := range players {
		pMap, ok := p.(map[string]interface{})
		if !ok {
			t.Fatalf("player %d is not an object", i)
		}
		if _, hasRole := pMap["role"]; hasRole {
			t.Errorf("player %d contains forbidden 'role' field: %+v", i, pMap)
		}
		if _, hasSlot := pMap["slot"]; hasSlot {
			t.Errorf("player %d contains forbidden 'slot' field: %+v", i, pMap)
		}
	}
}

func TestGenerate_GoldenByteComparison(t *testing.T) {
	script := loadScript(t)
	replay, err := sim.Generate(script, 42)
	if err != nil {
		t.Fatalf("generation failed: %v", err)
	}

	genBytes, err := json.MarshalIndent(replay, "", "  ")
	if err != nil {
		t.Fatalf("marshaling generated replay: %v", err)
	}

	fixturePath := filepath.Join("..", "..", "..", "data", "scenarios", "late-siege.json")
	fixtureBytes, err := os.ReadFile(fixturePath)
	if err != nil {
		t.Fatalf("reading fixture: %v", err)
	}

	if !bytes.Equal(genBytes, fixtureBytes) {
		t.Errorf("generated replay does not match golden fixture %s byte-for-byte", fixturePath)
	}
}
