package transporthttp

import (
	"fmt"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/alexwafula/pulse/app/internal/engine/metrics"
	"github.com/alexwafula/pulse/app/internal/simulator"
)

func TestComparisonWindowsAreEqualDisjointAndClockBound(t *testing.T) {
	replay, _ := simulator.Load("../../../../data/samples/first-sequence.json")
	// Include events exactly at the shared boundary and just beyond the cutoff.
	for i, offset := range []int64{0, 9999, 10000, 10001, 19999, 20000, 20001} {
		replay.Events[i].TimeMS = replay.Match.StartMS + offset
	}
	attacks, err := metrics.AttackSeries(replay)
	if err != nil {
		t.Fatal(err)
	}
	page := pageData{Attacks: attacks}
	at := replay.Match.StartMS + 20000
	for _, team := range replay.Match.Teams {
		view := compareWindows(replay, page, at, 10000, team.ID)
		if !view.Available || view.Before.EndMS-view.Before.StartMS != 10000 || view.After.EndMS-view.After.StartMS != 10000 || view.Before.EndMS != view.After.StartMS {
			t.Fatal("unequal comparison windows")
		}
		if view.Before.ReplayEndMS != view.Before.EndMS-1 || view.After.ReplayEndMS != view.After.EndMS {
			t.Fatal("earlier replay would include the recent boundary action")
		}
		seen := map[string]bool{}
		for _, window := range []comparisonWindow{view.Before, view.After} {
			for _, id := range window.EventIDs {
				if seen[id] {
					t.Fatal("shared boundary was counted twice")
				}
				seen[id] = true
				for _, event := range replay.Events {
					if event.ID == id && (event.TeamID != team.ID || event.TimeMS > at) {
						t.Fatal("wrong team or future evidence")
					}
					if event.ID == id && (event.TimeMS < window.StartMS || event.TimeMS > window.ReplayEndMS) {
						t.Fatal("evidence outside its own window")
					}
				}
			}
		}
		if seen[replay.Events[6].ID] {
			t.Fatal("future event included")
		}
		if view.Before.Passes+view.After.Passes != 2 && team.ID == replay.Events[0].TeamID {
			t.Fatal("completed passes not counted from replay")
		}
		if len(view.Rows) != 6 {
			t.Fatal("missing metric or lane rows")
		}
	}
	if compareWindows(replay, page, replay.Match.StartMS+19999, 10000, replay.Match.Teams[0].ID).Available {
		t.Fatal("partial windows treated as equal complete windows")
	}
}

func TestComparisonPanelValidationAndNoFutureEvidence(t *testing.T) {
	replay, _ := simulator.Load("../../../../data/samples/first-sequence.json")
	handler, err := NewDemoHandler(replay, "../../../web", "")
	if err != nil {
		t.Fatal(err)
	}
	for _, window := range []string{"bad", "10000.5", "-1", "0", "1", "60000", "9223372036854775807"} {
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequest("GET", fmt.Sprintf("/experience/panel?panel=comparison&atMs=%d&windowMs=%s", replay.Match.EndMS, window), nil))
		if rec.Code != 400 {
			t.Fatalf("bad window %s accepted", window)
		}
	}
	for _, at := range []int64{replay.Match.StartMS, replay.Match.StartMS + 20000, replay.Match.EndMS, replay.Match.StartMS} {
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequest("GET", fmt.Sprintf("/experience/panel?panel=comparison&scenario=corner&atMs=%d", at), nil))
		if rec.Code != 200 || rec.Header().Get("Cache-Control") != "no-store" {
			t.Fatal("comparison panel unavailable or cached")
		}
		for _, event := range replay.Events {
			if event.TimeMS > at && strings.Contains(rec.Body.String(), event.ID) {
				t.Fatal("future evidence leaked on seek/rewind")
			}
		}
	}
}
