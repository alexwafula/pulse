package transporthttp

import (
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/alexwafula/pulse/app/internal/domain"
	"github.com/alexwafula/pulse/app/internal/engine/metrics"
	"github.com/alexwafula/pulse/app/internal/simulator"
)

func TestStateLineUsesCatalogKeysAndRejectsUnknownInput(t *testing.T) {
	catalog, err := loadUICatalog(filepath.Join("..", "..", "..", "web", "static", "locales.json"))
	if err != nil {
		t.Fatal(err)
	}
	line, err := catalog.state(stateEmpty, "state.windowNone", "team", "Aurora Vale", "start", "89:00", "end", "89:20")
	if err != nil {
		t.Fatal(err)
	}
	if line.Text != "Aurora Vale: no completed passes, carries or shots from 89:00 to 89:20" || line.Team != "Aurora Vale" || line.Start != "89:00" {
		t.Fatalf("unexpected line %+v", line)
	}
	if line, _ := catalog.state(stateNoTracking, "Tracking metrics unavailable", "detail", "frame gap"); line.Detail != "frame gap" || line.Text != "Tracking metrics unavailable" {
		t.Fatalf("a literal key renders itself and keeps the raw detail: %+v", line)
	}
	if line, _ := catalog.state(stateEmpty, "state.idlePlayers", "count", 9); line.Text != "9 players with no passes" || line.Count != "9" {
		t.Fatalf("counts render as text: %+v", line)
	}
	for _, bad := range [][]any{{"team"}, {"colour", "red"}} {
		if _, err := catalog.state(stateEmpty, "state.teamNone", bad...); err == nil {
			t.Fatalf("arguments %v must fail", bad)
		}
	}
	if _, err := catalog.state("spinner", "Loading metrics"); err == nil {
		t.Fatal("an unknown kind must fail")
	}
}

func TestZeroDetection(t *testing.T) {
	busy, idle := idleNodes([]graphNode{{Name: "a"}, {Name: "b", Sent: 1}, {Name: "c", Received: 2}, {Name: "d"}})
	if len(busy) != 2 || busy[0].Name != "b" || busy[1].Name != "c" || idle != 2 {
		t.Fatalf("idle nodes: %+v %d", busy, idle)
	}
	if _, idle := idleNodes(nil); idle != 0 {
		t.Fatal("no nodes are no idle nodes")
	}
	for _, test := range []struct {
		window comparisonWindow
		empty  bool
	}{
		{comparisonWindow{}, true},
		{comparisonWindow{EventIDs: []string{}}, true},
		{comparisonWindow{Passes: 1}, false},
		{comparisonWindow{Entries: 1}, false},
		{comparisonWindow{Shots: 1}, false},
		{comparisonWindow{Lanes: [3]int{0, 0, 1}}, false},
		{comparisonWindow{EventIDs: []string{"evt-01"}}, false},
	} {
		if windowEmpty(test.window) != test.empty {
			t.Fatalf("windowEmpty(%+v) != %v", test.window, test.empty)
		}
	}
	if !chartsEmpty(nil) || !chartsEmpty([]experienceChart{{}, {}}) || chartsEmpty([]experienceChart{{}, {Away: 1}}) {
		t.Fatal("charts are empty only while every count is zero")
	}
	if !lanesEmpty(nil) || !lanesEmpty([]metrics.LaneCount{{Name: "Left"}}) || lanesEmpty([]metrics.LaneCount{{Name: "Left"}, {Name: "Right", Count: 1}}) {
		t.Fatal("lanes are empty only while every count is zero")
	}
	active := activeTeams(domain.Replay{Events: []domain.Event{{Type: "CLEARANCE", TeamID: "home"}, {Type: "PASS", TeamID: "away"}}})
	if active["home"] || !active["away"] {
		t.Fatalf("a clearance alone does not make a team active: %v", active)
	}
}

// The page's selects and a panel request without teamId/playerId open on the same
// focus, so server-rendered HTML and HTMX swaps agree.
func TestDefaultFocusAgreesAcrossPageAndPanels(t *testing.T) {
	base, err := simulator.Load("../../../../data/samples/first-sequence.json")
	if err != nil {
		t.Fatal(err)
	}
	handler, err := NewDemoHandler(base, "../../../web", "")
	if err != nil {
		t.Fatal(err)
	}
	get := func(path string) string {
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, httptest.NewRequest("GET", path, nil))
		if response.Code != 200 {
			t.Fatalf("%s: %d", path, response.Code)
		}
		return response.Body.String()
	}
	for _, test := range []struct{ scenario, player, name string }{
		{"corner", "vale-8", "Tayo"}, {"central", "vale-8", "Tayo"}, {"exchange", "vale-7", "Imani"},
		{"late-siege", "vale-10", "Dax"}, {"calm-midfield", "vale-3", "Musa"},
	} {
		t.Run(test.scenario, func(t *testing.T) {
			page := get("/?scenario=" + test.scenario)
			if !strings.Contains(page, `<option value="vale" selected>`) || !strings.Contains(page, fmt.Sprintf(`<option value="%s" selected>`, test.player)) {
				t.Fatal("the page's selects must open on the default focus")
			}
			var replay domain.Replay
			if err := json.Unmarshal([]byte(get("/api/replay?scenario="+test.scenario)), &replay); err != nil {
				t.Fatal(err)
			}
			end := replay.Match.EndMS
			if body := get(fmt.Sprintf("/experience/panel?scenario=%s&panel=analytics&atMs=%d", test.scenario, end)); !strings.Contains(body, `data-analytics-team="vale"`) {
				t.Fatal("analytics must default to vale")
			}
			if body := get(fmt.Sprintf("/experience/panel?scenario=%s&panel=comparison&atMs=%d", test.scenario, end)); !strings.Contains(body, `data-comparison-team="vale"`) {
				t.Fatal("comparison must default to vale")
			}
			if body := get(fmt.Sprintf("/experience/panel?scenario=%s&panel=story&mode=player&atMs=%d", test.scenario, end)); !strings.Contains(body, "<h3>"+test.name+"</h3>") || !strings.Contains(body, "player-story-summary") {
				t.Fatalf("player focus must default to %s with involvements", test.name)
			}
			if body := get(fmt.Sprintf("/experience/panel?scenario=%s&panel=story&mode=player&atMs=%d", test.scenario, replay.Match.StartMS)); !strings.Contains(body, `data-i18n="state.playerNoneYet"`) || strings.Contains(body, "player-story-summary") {
				t.Fatal("a player without involvements yet reads as one line")
			}
		})
	}
}
