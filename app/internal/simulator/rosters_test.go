package simulator_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/alexwafula/pulse/app/internal/domain"
	"github.com/alexwafula/pulse/app/internal/sim"
	"github.com/alexwafula/pulse/app/internal/simulator"
	"github.com/alexwafula/pulse/app/internal/simulator/scenarios"
)

func TestDemoFixturesUseCanonicalPlayerIdentities(t *testing.T) {
	data, err := os.ReadFile("../../../data/squads/fictional-league.json")
	if err != nil {
		t.Fatal(err)
	}
	var squads sim.SquadFile
	if err := json.Unmarshal(data, &squads); err != nil {
		t.Fatal(err)
	}
	canonical := make(map[string]domain.Player)
	for _, team := range squads.Teams {
		for _, p := range team.Players {
			canonical[p.ID] = domain.Player{ID: p.ID, TeamID: p.TeamID, Name: p.Name, Number: p.Number}
		}
	}
	check := func(t *testing.T, replay domain.Replay) {
		t.Helper()
		for _, p := range replay.Match.Players {
			if want, ok := canonical[p.ID]; !ok || p != want {
				t.Errorf("player %+v differs from canonical %+v", p, want)
			}
		}
		if err := replay.Validate(); err != nil {
			t.Fatal(err)
		}
	}
	for _, dir := range []string{"../../../data/samples", "../../../data/scenarios"} {
		paths, err := filepath.Glob(filepath.Join(dir, "*.json"))
		if err != nil {
			t.Fatal(err)
		}
		for _, path := range paths {
			if filepath.Ext(path[:len(path)-len(".json")]) == ".script" {
				continue
			}
			t.Run(filepath.Base(path), func(t *testing.T) {
				replay, err := simulator.Load(path)
				if err != nil {
					t.Fatal(err)
				}
				check(t, replay)
				catalog, err := scenarios.Catalog(replay)
				if err != nil {
					t.Fatal(err)
				}
				for _, variant := range catalog {
					check(t, variant)
				}
			})
		}
	}
}
