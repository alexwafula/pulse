package sim_test

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/alexwafula/pulse/app/internal/sim"
)

// lineHeightM/compactness are reserved, not implemented (issue #17): every
// use is reported, and an unset script gets no warning.
func TestReservedFieldWarnings(t *testing.T) {
	siege, err := sim.LoadScript(scenarioPath("late-siege.script.json"))
	if err != nil {
		t.Fatal(err)
	}
	w := siege.ReservedFieldWarnings()
	if len(w) != 4 {
		t.Fatalf("late-siege sets lineHeightM and compactness on two teams; got %d warnings: %v", len(w), w)
	}
	for _, msg := range w {
		if !strings.Contains(msg, "reserved, not implemented (issue #17)") {
			t.Errorf("warning %q lacks the reserved notice", msg)
		}
	}
	var bare sim.Script
	if err := json.Unmarshal([]byte(`{"teams":[{"id":"a"},{"id":"b"}]}`), &bare); err != nil {
		t.Fatal(err)
	}
	if got := bare.ReservedFieldWarnings(); len(got) != 0 {
		t.Errorf("unset fields produced warnings: %v", got)
	}
}
