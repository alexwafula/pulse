package metrics

import (
	"reflect"
	"testing"

	"github.com/alexwafula/pulse/app/internal/simulator"
)

func TestPassingSeries(t *testing.T) {
	r, err := simulator.Load("../../../../data/samples/first-sequence.json")
	if err != nil {
		t.Fatal(err)
	}
	series, err := PassingSeries(r)
	if err != nil {
		t.Fatal(err)
	}
	if len(series) != 3 || series[0].Teams[0].Total != 0 || series[1].Teams[0].Total != 1 || series[2].Teams[0].Total != 2 {
		t.Fatalf("unexpected series: %+v", series)
	}
	if series[1].TimeMS != r.Events[0].TimeMS || !reflect.DeepEqual(series[1].Teams[0].Edges[0].EventIDs, []string{"evt-01"}) {
		t.Fatal("future pass leaked or evidence wrong")
	}
	if series[2].Teams[1].Total != 0 || len(series[2].Teams[0].Nodes) != 4 {
		t.Fatal("team isolation or roster wrong")
	}
	again, _ := PassingSeries(r)
	if !reflect.DeepEqual(series, again) {
		t.Fatal("non-deterministic output")
	}
	r.Events[2].ActorID = r.Events[0].ActorID
	r.Events[2].RecipientID = r.Events[0].RecipientID
	weighted, err := PassingSeries(r)
	if err != nil {
		t.Fatal(err)
	}
	last := weighted[len(weighted)-1].Teams[0]
	if len(last.Edges) != 1 || len(last.Edges[0].EventIDs) != 2 || last.Nodes[1].Sent != 2 || last.Nodes[2].Received != 2 {
		t.Fatalf("wrong weighted degrees: %+v", last)
	}
	r.Events[2].Outcome = "INCOMPLETE"
	incomplete, _ := PassingSeries(r)
	if len(incomplete) != 2 {
		t.Fatal("incomplete pass counted")
	}
	r.Events[4].Type = "PASS"
	r.Events[4].RecipientID = "bastion-1"
	opponent, err := PassingSeries(r)
	if err != nil {
		t.Fatal(err)
	}
	end := opponent[len(opponent)-1]
	if end.Teams[0].Total != 1 || end.Teams[1].Total != 1 || end.Teams[1].Edges[0].EventIDs[0] != "evt-05" {
		t.Fatal("opponent pass mixed into the home graph")
	}
	r.Events[0].RecipientID = "missing"
	if _, err := PassingSeries(r); err == nil {
		t.Fatal("invalid replay accepted")
	}
}

func TestPassingSameClockAndStart(t *testing.T) {
	r, err := simulator.Load("../../../../data/samples/first-sequence.json")
	if err != nil {
		t.Fatal(err)
	}
	r.Events[0].TimeMS = r.Match.StartMS
	r.Events[1].TimeMS = r.Match.StartMS
	r.Events[2].TimeMS = r.Match.StartMS
	series, err := PassingSeries(r)
	if err != nil {
		t.Fatal(err)
	}
	if len(series) != 1 || series[0].Teams[0].Total != 2 {
		t.Fatal("same-clock passes must be included once in the initial snapshot")
	}
}
