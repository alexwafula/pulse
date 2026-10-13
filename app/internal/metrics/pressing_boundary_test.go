package metrics_test

import (
	"reflect"
	"testing"

	"github.com/alexwafula/pulse/app/internal/metrics"
	"github.com/alexwafula/pulse/app/internal/simulator"
)

func TestPressingUsesTrackingNotEventTags(t *testing.T) {
	replay, err := simulator.Load("../../../data/scenarios/late-siege.json")
	if err != nil {
		t.Fatal(err)
	}
	withEvents, err := metrics.Compute(replay, metrics.DefaultParams())
	if err != nil {
		t.Fatal(err)
	}
	replay.Events = replay.Events[:1]
	replay.Events[0].Type = "CARRY"
	replay.Events[0].RecipientID = ""
	withoutEvents, err := metrics.Compute(replay, metrics.DefaultParams())
	if err != nil {
		t.Fatal(err)
	}
	if len(withEvents.Ticks) == 0 || len(withEvents.Ticks) != len(withoutEvents.Ticks) {
		t.Fatal("missing supported tracking ticks")
	}
	for i, tick := range withEvents.Ticks {
		other := withoutEvents.Ticks[i]
		if tick.TimeMS != other.TimeMS || !reflect.DeepEqual(tick.Pressing, other.Pressing) || !reflect.DeepEqual(tick.Carrier, other.Carrier) {
			t.Fatalf("event retagging/removal changed pressing/carrier at %d", tick.TimeMS)
		}
	}
}
