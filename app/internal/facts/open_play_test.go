package facts

import (
	"reflect"
	"testing"

	"github.com/alexwafula/pulse/app/internal/domain"
	"github.com/alexwafula/pulse/app/internal/simulator"
)

func TestOpenPlayPacksSourceWindow(t *testing.T) {
	r, err := simulator.Load("../../../data/scenarios/late-siege.json")
	if err != nil {
		t.Fatal(err)
	}
	packs, err := OpenPlayPacks(r)
	if err != nil || len(packs) != 1 {
		t.Fatalf("packs=%+v err=%v", packs, err)
	}
	pack := packs[0]
	fact := pack.Facts[0]
	if fact.Value != 1 || pack.WindowStartMS != 5323830 || pack.WindowEndMS != 5325317 || !reflect.DeepEqual(fact.EventIDs, []string{"evt-25", "evt-26", "evt-27"}) {
		t.Fatalf("wrong source fact: %+v", pack)
	}
	again, _ := OpenPlayPacks(r)
	if !reflect.DeepEqual(packs, again) {
		t.Fatal("not deterministic")
	}
	all, _ := PatternPacks(r)
	if len(all) != 2 || all[0].Facts[0].Metric != "set_piece_shots" || all[1].Facts[0].Metric != fact.Metric {
		t.Fatalf("wrong publication order: %+v", all)
	}
}

func TestOpenPlayPacksRejectBrokenChains(t *testing.T) {
	for _, tc := range []struct {
		name   string
		change func(*domain.Replay)
	}{
		{"no pass", func(r *domain.Replay) { r.Events[24].Type = "CARRY"; r.Events[24].RecipientID = "" }},
		{"incomplete pass", func(r *domain.Replay) { r.Events[24].Outcome = "INCOMPLETE" }},
		{"set piece", func(r *domain.Replay) { r.Events[24].Type = "CORNER" }},
		{"phase change", func(r *domain.Replay) { r.Events[26].PhaseID = "different-phase" }},
		{"opponent touch", func(r *domain.Replay) {
			r.Events[25].TeamID = r.Events[20].TeamID
			r.Events[25].ActorID = r.Events[20].ActorID
		}},
		{"outside lookback", func(r *domain.Replay) { r.Events[26].TimeMS = r.Match.EndMS }},
		{"earlier shot", func(r *domain.Replay) { r.Events[23].Type = "SHOT" }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r, err := simulator.Load("../../../data/scenarios/late-siege.json")
			if err != nil {
				t.Fatal(err)
			}
			tc.change(&r)
			packs, err := OpenPlayPacks(r)
			if err != nil {
				t.Fatal(err)
			}
			if len(packs) != 0 {
				t.Fatalf("unsupported chain published: %+v", packs)
			}
		})
	}
}
