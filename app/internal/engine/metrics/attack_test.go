package metrics

import (
	"github.com/alexwafula/pulse/app/internal/domain"
	"github.com/alexwafula/pulse/app/internal/simulator"
	"reflect"
	"testing"
)

func TestAttackSeries(t *testing.T) {
	r, err := simulator.Load("../../../../data/samples/first-sequence.json")
	if err != nil {
		t.Fatal(err)
	}
	series, err := AttackSeries(r)
	if err != nil {
		t.Fatal(err)
	}
	last := series[len(series)-1].Teams[0]
	if last.Lanes[0].Count != 0 || last.Lanes[1].Count != 2 || last.Lanes[2].Count != 1 || last.Shots != 1 || last.BoxEntries != 0 {
		t.Fatalf("unexpected metrics: %+v", last)
	}
	again, _ := AttackSeries(r)
	if !reflect.DeepEqual(series, again) {
		t.Fatal("nondeterministic attack metrics")
	}
	if series[0].Teams[0].Shots != 0 {
		t.Fatal("future shot leaked")
	}
	// A completed pass into the box followed by a same-phase shot.
	r.Events[5].Type = "PASS"
	r.Events[5].To = domain.Point{X: 94, Y: 34}
	r.Events[5].From = domain.Point{X: 82, Y: 34}
	s, _ := AttackSeries(r)
	last = s[len(s)-1].Teams[0]
	if last.BoxEntries != 1 || last.EntryShots != 1 || last.Conversion != 100 {
		t.Fatalf("entry conversion wrong: %+v", last)
	}
	r.Events[6].PhaseID = "different"
	s, _ = AttackSeries(r)
	if s[len(s)-1].Teams[0].EntryShots != 0 {
		t.Fatal("unrelated-phase shot attributed to entry")
	}
	if !insideBox(domain.Point{X: 10, Y: 34}, "LEFT") || insideBox(domain.Point{X: 90, Y: 34}, "LEFT") {
		t.Fatal("opposite attack direction not normalized")
	}
}
