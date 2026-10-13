package transporthttp

import (
	"fmt"
	"math"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"

	"github.com/alexwafula/pulse/app/internal/engine/metrics"
	"github.com/alexwafula/pulse/app/internal/simulator"
)

func TestExperiencePanelsFollowReplayClock(t *testing.T) {
	replay, err := simulator.Load("../../../../data/samples/first-sequence.json")
	if err != nil {
		t.Fatal(err)
	}
	handler, err := NewDemoHandler(replay, "../../../web", "")
	if err != nil {
		t.Fatal(err)
	}
	for _, scenario := range []string{"corner", "central", "exchange", "late-siege", "calm-midfield"} {
		t.Run(scenario, func(t *testing.T) {
			// Exercise the same scenario dispatch as the JSON APIs, including seeded fixtures.
			page := httptest.NewRecorder()
			handler.ServeHTTP(page, httptest.NewRequest("GET", "/experience?scenario="+scenario, nil))
			if page.Code != 200 || !strings.Contains(page.Body.String(), `class="experience"`) || !strings.Contains(page.Body.String(), `hx-get="/experience/panel"`) {
				t.Fatalf("experience page: %d", page.Code)
			}
		})
	}
	for _, at := range []int64{replay.Match.StartMS, replay.Events[0].TimeMS, replay.Match.EndMS, replay.Match.StartMS} {
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, httptest.NewRequest("GET", fmt.Sprintf("/experience/panel?scenario=corner&panel=story&atMs=%d", at), nil))
		if response.Code != 200 || response.Header().Get("Cache-Control") != "no-store" || !strings.HasPrefix(response.Header().Get("Content-Type"), "text/html") {
			t.Fatalf("panel response: %d %s", response.Code, response.Body.String())
		}
		for _, event := range replay.Events {
			if event.TimeMS > at && strings.Contains(response.Body.String(), event.ID) {
				t.Fatalf("future event %s exposed at %d", event.ID, at)
			}
		}
	}
	for _, complete := range []bool{false, true} {
		at := replay.Match.StartMS
		if complete {
			at = replay.Match.EndMS
		}
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, httptest.NewRequest("GET", fmt.Sprintf("/experience/panel?panel=recap&atMs=%d", at), nil))
		body := response.Body.String()
		if !complete && (strings.Contains(body, "data-inspect-event") || !strings.Contains(body, "available at the end")) {
			t.Fatal("recap leaked future evidence")
		}
		if complete && (!strings.Contains(body, "data-inspect-event") || !strings.Contains(body, "shot was blocked")) {
			t.Fatal("recap lacks evidence or implies an unsupported goal")
		}
	}
}

func TestExperiencePanelValidationAndEscaping(t *testing.T) {
	replay, err := simulator.Load("../../../../data/samples/first-sequence.json")
	if err != nil {
		t.Fatal(err)
	}
	for i := range replay.Match.Players {
		if replay.Match.Players[i].ID == replay.Events[0].ActorID {
			replay.Match.Players[i].Name = "<script>alert(1)</script>"
		}
	}
	handler, err := NewHandler(replay, "../../../web")
	if err != nil {
		t.Fatal(err)
	}
	for _, test := range []struct {
		method, path string
		status       int
	}{
		{"POST", "/experience", 405},
		{"POST", "/experience/panel", 405},
		{"GET", "/experience/panel?panel=unknown&atMs=1620000", 400},
		{"GET", "/experience/panel?panel=story", 400},
		{"GET", "/experience/panel?panel=story&atMs=bad", 400},
		{"GET", "/experience/panel?panel=story&atMs=1620000.5", 400},
		{"GET", "/experience/panel?panel=story&atMs=1619999", 400},
		{"GET", "/experience/panel?panel=story&atMs=1680001", 400},
		{"GET", "/experience/panel?panel=story&atMs=1680000&mode=booth", 400},
		{"GET", "/experience/panel?panel=story&atMs=1680000&persona=SPOTLIGHT", 400},
		{"GET", "/experience/panel?panel=story&atMs=1680000&playerId=missing", 400},
		{"GET", "/experience/panel?panel=analytics&atMs=1680000&teamId=missing", 400},
		{"GET", "/experience/panel?panel=analytics&atMs=1680000&map=pressure", 400},
		{"GET", "/experience/unknown", 404},
	} {
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, httptest.NewRequest(test.method, test.path, nil))
		if response.Code != test.status {
			t.Errorf("%s %s: got %d, want %d", test.method, test.path, response.Code, test.status)
		}
	}
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, fmt.Sprintf("/experience/panel?panel=story&atMs=%d", replay.Events[0].TimeMS), nil))
	if strings.Contains(response.Body.String(), "<script>") || !strings.Contains(response.Body.String(), "&lt;script&gt;") {
		t.Fatal("source names must be HTML-escaped")
	}
	for i := range replay.Events {
		if replay.Events[i].Type == "SHOT" {
			replay.Events[i].Outcome = "COMPLETE"
		}
	}
	handler, err = NewHandler(replay, "../../../web")
	if err != nil {
		t.Fatal(err)
	}
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest("GET", fmt.Sprintf("/experience/panel?panel=story&atMs=%d", replay.Match.EndMS), nil))
	if !strings.Contains(response.Body.String(), "no goal outcome recorded") {
		t.Fatal("completed shot must not imply a goal")
	}
}

func TestStoryViewsAndChartsUseOnlyElapsedSources(t *testing.T) {
	replay, err := simulator.Load("../../../../data/samples/first-sequence.json")
	if err != nil {
		t.Fatal(err)
	}
	graphs, _ := passingViews(replay)
	attacks, _ := metrics.AttackSeries(replay)
	page := replayPage(replay, graphs, attacks, "corner")
	player := replay.Match.Players[0]
	for _, at := range []int64{replay.Match.StartMS, replay.Match.StartMS + 35000, replay.Match.EndMS, replay.Match.StartMS} {
		var passes, shots [2]int
		for _, event := range replay.Events {
			if event.TimeMS > at {
				break
			}
			i := 0
			if event.TeamID == replay.Match.Teams[1].ID {
				i = 1
			}
			if event.Type == "PASS" && event.Outcome == "COMPLETE" {
				passes[i]++
			}
			if event.Type == "SHOT" {
				shots[i]++
			}
		}
		for _, mode := range []string{"live", "catchup", "highlights", "player"} {
			options := experienceOptions{mode: mode, persona: "ANALYST", playerID: player.ID, teamID: player.TeamID, mapMode: "occupancy"}
			panel := storyPanel(replay, page, "story", at, options)
			var expected []string
			for _, event := range replay.Events {
				if event.TimeMS > at {
					break
				}
				if mode == "highlights" && event.Type != "SHOT" && event.Type != "CORNER" && event.Type != "CROSS" {
					continue
				}
				if mode == "player" && event.ActorID != player.ID && event.RecipientID != player.ID {
					continue
				}
				expected = append(expected, event.ID)
			}
			if mode == "live" && len(expected) > 5 {
				expected = expected[len(expected)-5:]
			}
			var ids []string
			for _, action := range panel.Actions {
				ids = append(ids, action.ID)
			}
			if !reflect.DeepEqual(ids, expected) {
				t.Errorf("%s at %d: got %v, want %v", mode, at, ids, expected)
			}
			if mode == "player" && (panel.Focus == nil || panel.PlayerStats.Involvements != len(ids)) {
				t.Fatal("player focus is not source-backed")
			}
		}
		analytics := analyticsPanel(replay, page, at, player.TeamID)
		if analytics.Charts[0].Home != passes[0] || analytics.Charts[0].Away != passes[1] || analytics.Charts[1].Home != shots[0] || analytics.Charts[1].Away != shots[1] {
			t.Fatal("charts disagree with source events")
		}
		for _, point := range analytics.Shots {
			found := false
			for _, event := range replay.Events {
				if event.ID == point.ID {
					found = event.TimeMS <= at && event.TeamID == player.TeamID && point.X == event.From.X && point.Y == 68-event.From.Y
				}
			}
			if !found {
				t.Fatal("shot map is future, wrong-team or incorrectly oriented")
			}
		}
		if at == replay.Match.StartMS && (len(analytics.Cells) != 0 || analytics.PlayerSeconds != "0.0") {
			t.Fatal("heatmap leaked future time")
		}
	}
	// A graph ends at the cutoff, leaving the future part of the fixed clock axis blank.
	chart := countChart("test", replay.Match, replay.Match.StartMS+30000, []chartCount{{replay.Match.StartMS + 10000, 2, 1}})
	if chart.HomePath != "M 14 88 H 56.00 V 16.00 H 140.00" || chart.AwayPath != "M 14 88 H 56.00 V 52.00 H 140.00" {
		t.Fatalf("unexpected step paths: %+v", chart)
	}
}

func TestAnalyticsHTMLIsClockBounded(t *testing.T) {
	replay, err := simulator.Load("../../../../data/samples/first-sequence.json")
	if err != nil {
		t.Fatal(err)
	}
	handler, err := NewHandler(replay, "../../../web")
	if err != nil {
		t.Fatal(err)
	}
	for _, mode := range []string{"occupancy", "shots", "network"} {
		for _, at := range []int64{replay.Match.StartMS, replay.Match.EndMS} {
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, httptest.NewRequest("GET", fmt.Sprintf("/experience/panel?panel=analytics&atMs=%d&map=%s", at, mode), nil))
			if response.Code != 200 || !strings.Contains(response.Body.String(), `data-chart="Completed passes"`) || !strings.Contains(response.Body.String(), `class="pitch-map"`) {
				t.Fatalf("analytics template failed: %d %s", response.Code, response.Body.String())
			}
			if at == replay.Match.StartMS && strings.Contains(response.Body.String(), "data-shot-event=") {
				t.Fatal("future shot exposed in HTML")
			}
		}
	}
}

func TestPitchNetworkUsesCompletedPassSourcePositions(t *testing.T) {
	replay, err := simulator.Load("../../../../data/samples/first-sequence.json")
	if err != nil {
		t.Fatal(err)
	}
	for _, at := range []int64{replay.Match.StartMS, replay.Match.StartMS + 35000, replay.Match.EndMS, replay.Match.StartMS} {
		for _, team := range replay.Match.Teams {
			nodes, edges := pitchNetwork(replay, at, team.ID)
			counts := make(map[string]int)
			xs, ys := make(map[string]float64), make(map[string]float64)
			var expectedIDs []string
			for _, event := range replay.Events {
				if event.TimeMS > at {
					break
				}
				if event.TeamID != team.ID || event.Type != "PASS" || event.Outcome != "COMPLETE" {
					continue
				}
				expectedIDs = append(expectedIDs, event.ID)
				counts[event.ActorID]++
				counts[event.RecipientID]++
				xs[event.ActorID] += event.From.X
				ys[event.ActorID] += event.From.Y
				xs[event.RecipientID] += event.To.X
				ys[event.RecipientID] += event.To.Y
			}
			if len(nodes) != len(counts) {
				t.Fatal("network includes players without elapsed completed passes")
			}
			for _, node := range nodes {
				count := counts[node.ID]
				var involved []string
				for _, event := range replay.Events {
					if event.TimeMS <= at && event.TeamID == team.ID && event.Type == "PASS" && event.Outcome == "COMPLETE" && (event.ActorID == node.ID || event.RecipientID == node.ID) {
						involved = append(involved, event.ID)
					}
				}
				if node.Evidence != strings.Join(involved, " ") {
					t.Fatal("player inspection cites unrelated or future evidence")
				}
				if node.Count != count || math.Abs(node.X-xs[node.ID]/float64(count)) > 1e-9 || math.Abs(node.Y-(68-ys[node.ID]/float64(count))) > 1e-9 {
					t.Fatalf("incorrect source average: %+v", node)
				}
			}
			seen := make(map[string]bool)
			for _, edge := range edges {
				if edge.Count != len(edge.EventIDs) {
					t.Fatal("edge count disagrees with evidence")
				}
				for _, id := range edge.EventIDs {
					if seen[id] {
						t.Fatal("pass attributed twice")
					}
					seen[id] = true
				}
			}
			if len(seen) != len(expectedIDs) {
				t.Fatal("network lost source evidence")
			}
			for _, id := range expectedIDs {
				if !seen[id] {
					t.Fatal("network contains unsupported evidence")
				}
			}
			againNodes, againEdges := pitchNetwork(replay, at, team.ID)
			if !reflect.DeepEqual(nodes, againNodes) || !reflect.DeepEqual(edges, againEdges) {
				t.Fatal("network presentation is nondeterministic")
			}
		}
	}
}

func TestPlayerFocusCountsAttemptsAndSuccessfulReceipts(t *testing.T) {
	replay, err := simulator.Load("../../../../data/samples/first-sequence.json")
	if err != nil {
		t.Fatal(err)
	}
	graphs, _ := passingViews(replay)
	attacks, _ := metrics.AttackSeries(replay)
	page := replayPage(replay, graphs, attacks, "corner")
	for _, player := range replay.Match.Players {
		var expected playerStoryStats
		for _, event := range replay.Events {
			if event.ActorID == player.ID || event.RecipientID == player.ID {
				expected.Involvements++
			}
			if event.ActorID == player.ID && event.Type == "PASS" {
				expected.PassAttempts++
				if event.Outcome == "COMPLETE" {
					expected.Passes++
				}
			}
			if event.Type == "PASS" && event.Outcome == "COMPLETE" && event.RecipientID == player.ID {
				expected.Received++
			}
			if event.ActorID == player.ID && event.Type == "SHOT" {
				expected.Shots++
			}
		}
		panel := storyPanel(replay, page, "story", replay.Match.EndMS, experienceOptions{mode: "player", persona: "CASUAL", playerID: player.ID})
		if panel.PlayerStats != expected {
			t.Errorf("%s: got %+v, want %+v", player.ID, panel.PlayerStats, expected)
		}
	}
	for i := range replay.Events {
		if replay.Events[i].Type == "PASS" && replay.Events[i].RecipientID != "" {
			replay.Events[i].Outcome = "INCOMPLETE"
			playerID := replay.Events[i].RecipientID
			panel := storyPanel(replay, page, "story", replay.Events[i].TimeMS, experienceOptions{mode: "player", playerID: playerID})
			if panel.PlayerStats.Received != 0 {
				t.Fatal("failed first pass was counted as received")
			}
			break
		}
	}
}
