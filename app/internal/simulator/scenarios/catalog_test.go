package scenarios

import (
	"github.com/alexwafula/pulse/app/internal/engine/metrics"
	"github.com/alexwafula/pulse/app/internal/simulator"
	"reflect"
	"testing"
)

func TestCatalog(t *testing.T) {
	r, err := simulator.Load("../../../../data/samples/first-sequence.json")
	if err != nil {
		t.Fatal(err)
	}
	catalog, err := Catalog(r)
	if err != nil {
		t.Fatal(err)
	}
	if len(catalog) != 3 || !reflect.DeepEqual(catalog["corner"], r) {
		t.Fatal("base changed or scenarios missing")
	}
	again, _ := Catalog(r)
	if !reflect.DeepEqual(catalog, again) {
		t.Fatal("nondeterministic scenarios")
	}
	central, _ := metrics.AttackSeries(catalog["central"])
	last := central[len(central)-1].Teams[0]
	if last.BoxEntries != 1 || last.EntryShots != 1 || last.Shots != 2 {
		t.Fatalf("central scenario metrics: %+v", last)
	}
	exchange, _ := metrics.PassingSeries(catalog["exchange"])
	if exchange[len(exchange)-1].Teams[0].Total != 3 {
		t.Fatal("exchange passes missing")
	}
}
