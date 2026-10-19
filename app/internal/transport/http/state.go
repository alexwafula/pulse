package transporthttp

import (
	"fmt"
	"html/template"

	"github.com/alexwafula/pulse/app/internal/domain"
	"github.com/alexwafula/pulse/app/internal/engine/metrics"
)

// stateLine is one C7 state (loading, error, no tracking or nothing to show)
// rendered by the "state" partial. Key names the catalog entry, Text is its
// en-GB rendering and the fixed arguments feed data-i18n-arg-* so the page
// localizer can re-render it. Detail holds raw data, such as an API reason,
// that is shown untranslated inside <details>.
type stateLine struct {
	Kind, Key, Text                 string
	Team, Player, Count, Start, End string
	Detail                          string
}

// State kinds. Each has its own icon and shape (status-badge rules, ADR 0027).
const (
	stateLoading    = "loading"
	stateError      = "error"
	stateNoTracking = "no-tracking"
	stateEmpty      = "empty"
)

// state builds a line for the "state" partial: kind, a catalog key and
// name/value pairs (team, player, count, start, end or detail). Text is the
// key's en-GB rendering; the page localizer re-renders it from data-i18n.
func (catalog uiCatalog) state(kind, key string, pairs ...any) (stateLine, error) {
	if len(pairs)%2 != 0 {
		return stateLine{}, fmt.Errorf("state %s: odd name/value pairs", key)
	}
	if kind != stateLoading && kind != stateError && kind != stateNoTracking && kind != stateEmpty {
		return stateLine{}, fmt.Errorf("state %s: unknown kind %q", key, kind)
	}
	line := stateLine{Kind: kind, Key: key}
	fields := map[string]*string{"team": &line.Team, "player": &line.Player, "count": &line.Count,
		"start": &line.Start, "end": &line.End, "detail": &line.Detail}
	values := make(map[string]string)
	for i := 0; i < len(pairs); i += 2 {
		name, _ := pairs[i].(string)
		field, ok := fields[name]
		if !ok {
			return stateLine{}, fmt.Errorf("state %s: unknown argument %v", key, pairs[i])
		}
		*field = fmt.Sprint(pairs[i+1])
		if name != "detail" {
			values[name] = *field
		}
	}
	line.Text = catalog.text("en-GB", key, values)
	return line, nil
}

// stateFuncs exposes state to every template set that parses experience.html.
func stateFuncs(catalog uiCatalog) template.FuncMap {
	return template.FuncMap{"state": catalog.state}
}

// activeTeams reports the teams with at least one pass, carry or shot over the
// full replay. A team without one collapses to a single line on every surface.
func activeTeams(replay domain.Replay) map[string]bool {
	counts, _ := domain.ActionCounts(replay)
	active := make(map[string]bool, len(counts))
	for id, count := range counts {
		active[id] = count > 0
	}
	return active
}

// idleNodes splits passing nodes into those that sent or received a completed
// pass and the count of those that did neither, which share one line.
func idleNodes(nodes []graphNode) ([]graphNode, int) {
	busy := make([]graphNode, 0, len(nodes))
	for _, node := range nodes {
		if node.Sent > 0 || node.Received > 0 {
			busy = append(busy, node)
		}
	}
	return busy, len(nodes) - len(busy)
}

// windowEmpty reports a comparison window without any counted source action.
func windowEmpty(w comparisonWindow) bool {
	return w.Passes == 0 && w.Entries == 0 && w.Shots == 0 && w.Lanes == [3]int{} && len(w.EventIDs) == 0
}

// chartsEmpty reports charts whose every team count is still zero.
func chartsEmpty(charts []experienceChart) bool {
	for _, chart := range charts {
		if chart.Home > 0 || chart.Away > 0 {
			return false
		}
	}
	return true
}

// lanesEmpty reports lane counts that are all zero.
func lanesEmpty(lanes []metrics.LaneCount) bool {
	for _, lane := range lanes {
		if lane.Count > 0 {
			return false
		}
	}
	return true
}
