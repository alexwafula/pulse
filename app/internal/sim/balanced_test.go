package sim_test

import (
	"encoding/json"
	"github.com/alexwafula/pulse/app/internal/domain"
	"github.com/alexwafula/pulse/app/internal/sim"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestEndToEndReplayQualityAndReproducibility(t *testing.T) {
	root := filepath.Join("..", "..", "..", "data", "scenarios")
	script, err := sim.LoadScript(filepath.Join(root, "end-to-end.script.json"))
	if err != nil {
		t.Fatal(err)
	}
	replay, err := sim.Generate(script, script.Seed)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := sim.ValidateQuality(replay); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(filepath.Join(root, "end-to-end.json"))
	if err != nil {
		t.Fatal(err)
	}
	var committed domain.Replay
	if err := json.Unmarshal(data, &committed); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(*replay, committed) {
		t.Fatal("committed replay does not reproduce from its script")
	}
	shots, passes := map[string]int{}, map[string]int{}
	for _, event := range replay.Events {
		if event.Type == "SHOT" {
			shots[event.TeamID]++
		}
		if event.Type == "PASS" {
			passes[event.TeamID]++
		}
	}
	if len(replay.Match.Players) != 22 || len(replay.Tracking) != 451 {
		t.Fatal("expected complete 11v11 tracking at 5Hz")
	}
	for _, team := range replay.Match.Teams {
		if shots[team.ID] < 1 || passes[team.ID] < 2 {
			t.Fatalf("%s has no meaningful attacking sequence", team.ID)
		}
	}
	for i, event := range replay.Events {
		if i > 0 && event.From != replay.Events[i-1].To {
			t.Fatal("ball teleports between phases")
		}
	}
}

func TestUnknownMovementModelIsRejected(t *testing.T) {
	script := loadScript(t)
	script.ShapeModel = "unknown"
	if _, err := sim.Generate(script, 42); err == nil {
		t.Fatal("unknown movement model accepted")
	}
}
