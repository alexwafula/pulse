package transporthttp

import (
	"strings"
	"testing"

	"github.com/alexwafula/pulse/app/internal/engine/metrics"
)

func TestReplaySummaryMatchesEvents(t *testing.T) {
	handler, all := apiScenarios(t)
	for name, replay := range all {
		t.Run(name, func(t *testing.T) {
			attacks, err := metrics.AttackSeries(replay)
			if err != nil {
				t.Fatal(err)
			}
			series := summaryViews(replay, attacks)
			for i, snapshot := range series {
				actions, passes, attempts := 0, 0, 0
				for _, event := range replay.Events {
					if event.TimeMS > snapshot.TimeMS {
						continue
					}
					actions++
					if event.Type == "PASS" {
						attempts++
						if event.Outcome == "COMPLETE" {
							passes++
						}
					}
				}
				if snapshot.Actions != actions || snapshot.Passes != passes || snapshot.PassAttempts != attempts || snapshot.HomePasses+snapshot.AwayPasses != passes {
					t.Fatalf("summary at %d does not match events: %+v", snapshot.TimeMS, snapshot)
				}
				entries, shots, converted := 0, 0, 0
				for _, team := range attacks[i].Teams {
					entries += team.BoxEntries
					shots += team.Shots
					converted += team.EntryShots
				}
				if snapshot.BoxEntries != entries || snapshot.Shots != shots || snapshot.ConvertedEntries != converted {
					t.Fatalf("summary at %d does not match attack metrics: %+v", snapshot.TimeMS, snapshot)
				}
			}
			last := series[len(series)-1]
			if last.Actions != len(replay.Events) {
				t.Fatal("summary lost events")
			}
			page := get(t, handler, "/?scenario="+name, nil)
			body := page.Body.String()
			for _, team := range replay.Match.Teams {
				if !strings.Contains(body, team.Name) {
					t.Fatalf("missing team %s", team.Name)
				}
			}
			if !strings.Contains(body, `aria-label="Score unavailable"`) || strings.Contains(body, "shot blocked by Mina") || strings.Contains(body, "14.2m") {
				t.Fatal("missing honest score placeholder or fabricated evidence remains")
			}
			if !strings.Contains(body, clockText(replay.Match.StartMS)+" - "+clockText(replay.Match.EndMS)) {
				t.Fatal("incorrect replay window")
			}
		})
	}
}
