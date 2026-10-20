package transporthttp

import (
	"bytes"
	"encoding/json"
	"flag"
	"html/template"
	"os"
	"path/filepath"
	"testing"
)

var updateStates = flag.Bool("update-states", false, "rewrite app/testdata/states/state-lines.json")

// stateGoldenCases are every state line the scripts draw (state-line.ts), with the
// arguments in the order the scripts pass them. states-browser.mjs captures the
// scripts' lines for the same cases and compares them with these renderings.
var stateGoldenCases = []struct {
	Name, Kind, Key string
	Pairs           []any
}{
	{"tracking-gap", stateNoTracking, "state.trackingGap", []any{"seconds", "8.0", "clock", "27:08", "detail", "frame gap of 8000 ms at 1628000; 5 Hz tracking (200 ms) is required"}},
	{"metrics-error", stateError, "Metrics unavailable", nil},
	{"moments-error", stateError, "Moments unavailable", nil},
	{"moments-yet", stateEmpty, "No moments yet", nil},
	{"moments-none", stateEmpty, "No moments detected", nil},
	{"panel-loading", stateLoading, "Updating", nil},
	{"panel-error", stateError, "Update unavailable. Last loaded view retained.", nil},
}

// The Go partial is the single source of state markup; this golden pins its output
// for the cases the scripts render, so a drift on either side fails a test.
func TestStateLinesGolden(t *testing.T) {
	catalog, err := loadUICatalog(filepath.Join("..", "..", "..", "web", "static", "locales.json"))
	if err != nil {
		t.Fatal(err)
	}
	page, err := template.New("experience.html").Funcs(stateFuncs(catalog)).
		ParseFiles(filepath.Join("..", "..", "..", "web", "templates", "partials", "experience.html"))
	if err != nil {
		t.Fatal(err)
	}
	type rendered struct {
		Name, HTML string
	}
	golden := struct {
		About string     `json:"about"`
		Lines []rendered `json:"lines"`
	}{About: "Go's \"state\" partial for every state line scripts draw. states-browser.mjs compares the scripts' lines with these, after the browser's own HTML serialization. Regenerate: go test ./app/internal/transport/http -run StateLinesGolden -update-states"}
	for _, c := range stateGoldenCases {
		line, err := catalog.state(c.Kind, c.Key, c.Pairs...)
		if err != nil {
			t.Fatalf("%s: %v", c.Name, err)
		}
		var b bytes.Buffer
		if err := page.ExecuteTemplate(&b, "state", line); err != nil {
			t.Fatalf("%s: %v", c.Name, err)
		}
		golden.Lines = append(golden.Lines, rendered{c.Name, b.String()})
	}
	got, err := json.MarshalIndent(golden, "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	got = append(got, '\n')
	path := filepath.Join("..", "..", "..", "testdata", "states", "state-lines.json")
	if *updateStates {
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, got, 0o644); err != nil {
			t.Fatal(err)
		}
	}
	want, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read golden (run with -update-states after review): %v", err)
	}
	if !bytes.Equal(got, want) {
		t.Fatalf("state partial drifted from %s:\n%s", path, got)
	}
}

// Lines never carry a live-region role; the host that stays in the page does, so
// a line swapped into it is announced once.
func TestStateLinesHaveNoRole(t *testing.T) {
	catalog, err := loadUICatalog(filepath.Join("..", "..", "..", "web", "static", "locales.json"))
	if err != nil {
		t.Fatal(err)
	}
	page, err := template.New("experience.html").Funcs(stateFuncs(catalog)).
		ParseFiles(filepath.Join("..", "..", "..", "web", "templates", "partials", "experience.html"))
	if err != nil {
		t.Fatal(err)
	}
	for _, kind := range []string{stateLoading, stateError, stateNoTracking, stateEmpty} {
		line, _ := catalog.state(kind, "None yet")
		var b bytes.Buffer
		if err := page.ExecuteTemplate(&b, "state", line); err != nil {
			t.Fatal(err)
		}
		if bytes.Contains(b.Bytes(), []byte("role=")) {
			t.Fatalf("%s line has a role: %s", kind, b.String())
		}
	}
}
