package transporthttp

import (
	"fmt"
	"reflect"
	"sort"
	"strings"
	"testing"

	"github.com/alexwafula/pulse/app/internal/simulator"
)

func TestPassingViewsShowOnlyPlayersWithCompletedPasses(t *testing.T) {
	for _, fixture := range []string{"../../../../data/samples/first-sequence.json", "../../../../data/scenarios/late-siege.json", "../../../../data/scenarios/calm-midfield.json"} {
		replay, err := simulator.Load(fixture)
		if err != nil {
			t.Fatal(err)
		}
		views, err := passingViews(replay)
		if err != nil {
			t.Fatal(err)
		}
		again, _ := passingViews(replay)
		if !reflect.DeepEqual(views, again) {
			t.Fatalf("%s: passing layout is nondeterministic", fixture)
		}
		for _, view := range views {
			for ti, team := range view.Teams {
				// The Insights pitch-map network is the reference rule for which players appear.
				nodes, _ := pitchNetwork(replay, view.TimeMS, replay.Match.Teams[ti].ID)
				var want, got []string
				for _, node := range nodes {
					want = append(want, node.ID)
				}
				for _, node := range team.Nodes {
					got = append(got, node.ID)
					if node.Sent+node.Received == 0 {
						t.Fatalf("%s at %d: %s has no completed pass", fixture, view.TimeMS, node.Name)
					}
				}
				sort.Strings(want)
				sort.Strings(got)
				if !reflect.DeepEqual(got, want) {
					t.Fatalf("%s at %d, %s: drawer nodes %v, Insights nodes %v", fixture, view.TimeMS, team.Name, got, want)
				}
				if len(team.Nodes) == 0 && (team.Width != 0 || team.Height != 0 || len(team.Edges) != 0) {
					t.Fatalf("%s at %d, %s: an empty team has a graph", fixture, view.TimeMS, team.Name)
				}
			}
		}
	}
}

func TestLayoutRingKeepsLabelsClearForEveryNodeCount(t *testing.T) {
	for _, name := range []string{"Ari", "Malik", "Abcdefghijklmnop"} {
		for count := 1; count <= 11; count++ {
			nodes := make([]graphNode, count)
			for i := range nodes {
				nodes[i] = graphNode{ID: fmt.Sprint(i), Name: name, Number: 10 + i}
			}
			width, height := layoutRing(nodes)
			var circles, labels []box
			for _, node := range nodes {
				r := nodeRadius + nodeStroke/2
				circles = append(circles, box{node.X - r, node.Y - r, node.X + r, node.Y + r})
				w := labelCharWidth * float64(len(nodeLabel(node)))
				left := map[string]float64{"start": node.LabelX, "middle": node.LabelX - w/2, "end": node.LabelX - w}[node.Anchor]
				label := box{left, node.LabelY - labelHeight/2, left + w, node.LabelY + labelHeight/2}
				labels = append(labels, label)
				if label.left < 0 || label.top < 0 || label.right > float64(width) || label.bottom > float64(height) {
					t.Fatalf("%s x%d: label %+v outside %dx%d", name, count, label, width, height)
				}
			}
			if !ringClear(circles, labels) {
				t.Fatalf("%s x%d: labels overlap", name, count)
			}
		}
	}
}

func TestPassingTemplateDrawsNoEmptyGraph(t *testing.T) {
	replay, err := simulator.Load("../../../../data/samples/first-sequence.json")
	if err != nil {
		t.Fatal(err)
	}
	views, _ := passingViews(replay)
	last := views[len(views)-1]
	if len(last.Teams[1].Nodes) != 0 || len(last.Teams[0].Nodes) != 3 || len(last.Teams[1].Roster) != 4 || last.Teams[0].Idle != 1 {
		t.Fatalf("corner end: want 3 Aurora Vale nodes (1 idle) and no Bastion City nodes from a roster of 4, got %+v", last.Teams)
	}
	handler, err := NewHandler(replay, "../../../web")
	if err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{"/", "/legacy"} {
		body := get(t, handler, path, nil).Body.String()
		if strings.Contains(body, `viewBox="0 0 280 220"`) || strings.Contains(body, `viewBox="0 0 0 0"`) {
			t.Fatalf("%s: a fixed or empty passing viewBox is still drawn", path)
		}
		// Experience pages show the shared C7 state for a team without passes; /legacy keeps its line.
		want := `data-i18n="state.noneInSequence" data-i18n-arg-name="Bastion City"`
		if path == "/legacy" {
			want = `<li class="passing-empty">No completed passes yet</li>`
		}
		if !strings.Contains(body, want) {
			t.Fatalf("%s: missing %s", path, want)
		}
	}
}
