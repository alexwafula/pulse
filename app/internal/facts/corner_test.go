package facts

import (
	"reflect"
	"testing"

	"github.com/alexwafula/pulse/app/internal/domain"
	"github.com/alexwafula/pulse/app/internal/simulator"
)

func TestCornerPacks(t *testing.T) {
	load := func() domain.Replay {
		r, err := simulator.Load("../../../data/samples/first-sequence.json")
		if err != nil {
			t.Fatal(err)
		}
		return r
	}
	r := load()
	packs, err := CornerPacks(r)
	if err != nil || len(packs) != 1 {
		t.Fatalf("packs: %v, %v", packs, err)
	}
	fact := packs[0].Facts[0]
	if fact.Value != 1 || !reflect.DeepEqual(fact.EventIDs, []string{"evt-06", "evt-07"}) || packs[0].WindowStartMS != 1672000 || packs[0].WindowEndMS != 1678000 {
		t.Fatalf("wrong corner evidence: %+v", packs[0])
	}
	again, _ := CornerPacks(r)
	if !reflect.DeepEqual(again, packs) {
		t.Fatal("builder is not deterministic")
	}
	for _, tc := range []struct {
		name   string
		change func(*domain.Replay)
	}{
		{"no corner", func(r *domain.Replay) { r.Events[5].Type = "CROSS" }},
		{"incomplete corner", func(r *domain.Replay) { r.Events[5].Outcome = "INCOMPLETE" }},
		{"no shot", func(r *domain.Replay) { r.Events[6].Type = "CARRY" }},
		{"late shot", func(r *domain.Replay) { r.Events[5].TimeMS = 1663000 }},
		{"phase changed", func(r *domain.Replay) { r.Events[6].PhaseID = "other-phase" }},
		{"opponent shot", func(r *domain.Replay) { r.Events[6].TeamID = "bastion"; r.Events[6].ActorID = "bastion-2" }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := load()
			tc.change(&r)
			got, err := CornerPacks(r)
			if err != nil || len(got) != 0 {
				t.Fatalf("unexpected packs: %v, %v", got, err)
			}
		})
	}

	r = load()
	opponent := r.Events[6]
	opponent.ID = "evt-opponent-touch"
	opponent.Type = "CARRY"
	opponent.TeamID = "bastion"
	opponent.ActorID = "bastion-2"
	opponent.TimeMS = 1674000
	r.Events = append(r.Events[:6], opponent, r.Events[6])
	broken, err := CornerPacks(r)
	if err != nil || len(broken) != 0 {
		t.Fatalf("opponent touch must break sequence: %v, %v", broken, err)
	}
}
