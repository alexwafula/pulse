package transporthttp

import (
	"encoding/json"
	"html"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/alexwafula/pulse/app/internal/simulator"
)

type headlineGolden struct {
	Locales []string          `json:"locales"`
	Names   map[string]string `json:"names"`
	Cases   []struct {
		Delta  float64  `json:"delta"`
		Teams  []string `json:"teams"`
		Key    string   `json:"key"`
		Team   string   `json:"team"`
		Value  string   `json:"value"`
		Signed string   `json:"signed"`
		Label  string   `json:"label"`
	} `json:"cases"`
}

func loadHeadlineGolden(t *testing.T) headlineGolden {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join("..", "..", "..", "testdata", "hero", "index-headline.json"))
	if err != nil {
		t.Fatal(err)
	}
	var golden headlineGolden
	if err := json.Unmarshal(raw, &golden); err != nil {
		t.Fatal(err)
	}
	return golden
}

// agrees checks the rule a reader relies on: the label is "first − second" in
// API order, so a + sign means the first team's index is higher, a − sign the
// second's, and a level line names nobody.
func agrees(t *testing.T, where string, team, signed, label string, level bool) {
	t.Helper()
	first, second, ok := strings.Cut(label, " − ")
	if !ok {
		t.Fatalf("%s: label %q is not \"first − second\"", where, label)
	}
	if strings.Contains(signed, "-") {
		t.Errorf("%s: signed %q uses U+002D; minus must be U+2212", where, signed)
	}
	switch {
	case level:
		if team != "" {
			t.Errorf("%s: level line names %q", where, team)
		}
	case strings.HasPrefix(signed, "+"):
		if team != first {
			t.Errorf("%s: %s with label %q names %q as higher, want %q", where, signed, label, team, first)
		}
	case strings.HasPrefix(signed, "−"):
		if team != second {
			t.Errorf("%s: %s with label %q names %q as higher, want %q", where, signed, label, team, second)
		}
	default:
		t.Errorf("%s: a non-level headline has unsigned value %q", where, signed)
	}
}

func TestIndexHeadlineGolden(t *testing.T) {
	golden := loadHeadlineGolden(t)
	name := func(id string) string { return golden.Names[id] }
	for _, locale := range golden.Locales {
		for _, c := range golden.Cases {
			got := newIndexHeadline(&c.Delta, c.Teams, name, true)
			where := locale + " " + strings.Join(c.Teams, "/") + " " + c.Signed
			if got.Key != c.Key || got.Team != c.Team || got.Value != c.Value || got.Signed != c.Signed || got.Label != c.Label || got.Chip != canonicalModelLabel {
				t.Errorf("%s: got %+v", where, got)
			}
			agrees(t, where, got.Team, got.Signed, got.Label, got.Key == "index.level")
		}
	}
	for _, supported := range []bool{true, false} {
		got := newIndexHeadline(nil, []string{"vale", "bastion"}, name, supported)
		if got.Signed != "N/A" || got.Label != "" || got.Chip != "" || got.Team != "" {
			t.Errorf("no delta (supported=%v): got %+v", supported, got)
		}
	}
}

var heroField = map[string]*regexp.Regexp{
	"headline": regexp.MustCompile(`<p id="hero-index-headline"[^>]*>([^<]*)</p>`),
	"signed":   regexp.MustCompile(`<span id="hero-index-delta"[^>]*>([^<]*)</span>`),
	"label":    regexp.MustCompile(`<span id="hero-index-teams"[^>]*>([^<]*)</span>`),
	"chip":     regexp.MustCompile(`<span id="hero-index-chip"[^>]*?( hidden)?>([^<]*)</span>`),
}

func heroText(t *testing.T, body, field string) string {
	t.Helper()
	match := heroField[field].FindStringSubmatch(body)
	if match == nil {
		t.Fatalf("no %s in the hero", field)
	}
	return html.UnescapeString(match[len(match)-1])
}

// The page's first paint states /api/metrics' own start tick, with no script.
func TestHeroHeadlineIsServerRenderedFromTheMetricsAPI(t *testing.T) {
	demo, all := apiScenarios(t)
	base, err := simulator.Load(filepath.Join("..", "..", "..", "..", "data", "scenarios", "late-siege.json"))
	if err != nil {
		t.Fatal(err)
	}
	reversed, err := NewHandler(swapped(base), filepath.Join("..", "..", "..", "web"))
	if err != nil {
		t.Fatal(err)
	}
	catalog, err := loadUICatalog(filepath.Join("..", "..", "..", "web", "static", "locales.json"))
	if err != nil {
		t.Fatal(err)
	}
	type target struct {
		name   string
		get    func(path string) string
		page   string
		api    string
		teams0 string
	}
	targets := []target{
		{"late-siege", func(p string) string { return get(t, demo, p, nil).Body.String() }, "/?scenario=late-siege", "/api/metrics?scenario=late-siege", "bastion"},
		{"calm-midfield", func(p string) string { return get(t, demo, p, nil).Body.String() }, "/?scenario=calm-midfield", "/api/metrics?scenario=calm-midfield", "bastion"},
		{"late-siege, vale listed first", func(p string) string { return get(t, reversed, p, nil).Body.String() }, "/experience", "/api/metrics", "vale"},
	}
	for _, tg := range targets {
		var body struct {
			Teams []string `json:"teams"`
			Ticks []struct {
				TimeMS int64 `json:"timeMs"`
				Teams  map[string]struct {
					IndexDelta float64 `json:"indexDelta"`
				} `json:"teams"`
			} `json:"ticks"`
		}
		if err := json.Unmarshal([]byte(tg.get(tg.api)), &body); err != nil {
			t.Fatalf("%s: %v", tg.name, err)
		}
		if body.Teams[0] != tg.teams0 {
			t.Fatalf("%s: API teams %v, want %s first", tg.name, body.Teams, tg.teams0)
		}
		replay := all["late-siege"]
		if tg.name == "calm-midfield" {
			replay = all["calm-midfield"]
		}
		start := replay.Match.StartMS
		var delta *float64
		for _, tick := range body.Ticks {
			if tick.TimeMS <= start {
				d := tick.Teams[body.Teams[0]].IndexDelta
				delta = &d
			}
		}
		if delta == nil {
			t.Fatalf("%s: /api/metrics has no tick at the replay start", tg.name)
		}
		name := func(id string) string {
			for _, team := range replay.Match.Teams {
				if team.ID == id {
					return team.Name
				}
			}
			return id
		}
		for _, locale := range []string{"en-GB", "sw-KE", "hi-IN"} {
			path := tg.page
			if locale != "en-GB" {
				path += map[bool]string{true: "&", false: "?"}[strings.Contains(path, "?")] + "locale=" + locale
			}
			page := tg.get(path)
			want := newIndexHeadline(delta, body.Teams, name, true)
			headline := heroText(t, page, "headline")
			where := tg.name + " " + locale
			if headline != catalog.text(locale, want.Key, map[string]string{"team": want.Team, "value": want.Value}) {
				t.Errorf("%s: headline %q, want the API start tick (%v) as %+v", where, headline, *delta, want)
			}
			if !regexp.MustCompile(`\d\.\d\d`).MatchString(headline) {
				t.Errorf("%s: no number in the server-rendered headline %q", where, headline)
			}
			signed, label := heroText(t, page, "signed"), heroText(t, page, "label")
			if signed != want.Signed || label != want.Label || heroText(t, page, "chip") != catalog.text(locale, canonicalModelLabel, nil) {
				t.Errorf("%s: ledger %q / %q, want %q / %q", where, signed, label, want.Signed, want.Label)
			}
			agrees(t, where, want.Team, signed, label, want.Key == "index.level")
		}
	}
	corner := get(t, demo, "/?scenario=corner", nil).Body.String()
	if heroText(t, corner, "headline") != "Tracking metrics unavailable" || heroText(t, corner, "signed") != "N/A" || heroText(t, corner, "label") != "" {
		t.Errorf("corner (no tracking) must not show a number: %q", heroText(t, corner, "headline"))
	}
}
