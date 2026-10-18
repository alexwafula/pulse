package transporthttp

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"regexp"
	"testing"

	"github.com/alexwafula/pulse/app/internal/domain"
	"github.com/alexwafula/pulse/app/internal/simulator"
)

// kitColours reads the light kit colours from the .experience block of tokens.css,
// so the test checks the whole chain from team id to the colour on screen.
func kitColours(t *testing.T) map[string]string {
	t.Helper()
	css, err := os.ReadFile(filepath.Join("..", "..", "..", "web", "static", "tokens.css"))
	if err != nil {
		t.Fatal(err)
	}
	colours := map[string]string{}
	for _, match := range regexp.MustCompile(`--c-team-([ab]):\s*(#[0-9a-f]{6})`).FindAllSubmatch(css, -1) {
		if _, seen := colours[string(match[1])]; !seen {
			colours[string(match[1])] = string(match[2])
		}
	}
	return colours
}

// renderedKits returns the body's positional kit attributes and each team strip's kit.
func renderedKits(t *testing.T, body string) (home, away string, teams map[string]string) {
	t.Helper()
	root := regexp.MustCompile(`<body class="experience"[^>]*\sdata-home-kit="([ab])" data-away-kit="([ab])"`).FindStringSubmatch(body)
	if root == nil {
		t.Fatalf("the experience root does not carry data-home-kit/data-away-kit:\n%.600s", body[bytes.Index([]byte(body), []byte("<body")):])
	}
	teams = map[string]string{}
	for _, match := range regexp.MustCompile(`class="team-name (?:home|away)" data-team-id="([^"]+)" data-team-kit="([ab])"`).FindAllStringSubmatch(body, -1) {
		teams[match[1]] = match[2]
	}
	return root[1], root[2], teams
}

func TestExperienceRendersTeamColourFromTeamID(t *testing.T) {
	colours := kitColours(t)
	if colours["a"] != "#b8374d" || colours["b"] != "#2e68b3" {
		t.Fatalf("tokens.css kit colours = %v, want a=#b8374d b=#2e68b3", colours)
	}
	demo, all := apiScenarios(t)
	for _, scenario := range []string{"late-siege", "corner"} {
		for _, path := range []string{"/?scenario=" + scenario, "/experience?scenario=" + scenario} {
			body := get(t, demo, path, nil).Body.String()
			home, away, teams := renderedKits(t, body)
			order := all[scenario].Match.Teams
			if teams[order[0].ID] != home || teams[order[1].ID] != away || len(teams) != 2 {
				t.Fatalf("%s: root kits %s/%s disagree with team strips %v", path, home, away, teams)
			}
			if colours[teams["vale"]] != "#b8374d" || colours[teams["bastion"]] != "#2e68b3" {
				t.Fatalf("%s: vale -> %s, bastion -> %s; want #b8374d and #2e68b3", path, colours[teams["vale"]], colours[teams["bastion"]])
			}
		}
	}
	// /legacy keeps its positional palette and gets no kit attributes on its root.
	if legacy := get(t, demo, "/legacy?scenario=late-siege", nil).Body.String(); regexp.MustCompile(`<body[^>]*data-home-kit`).MatchString(legacy) {
		t.Fatal("/legacy must not carry experience kit attributes")
	}
}

// renamed swaps a team id everywhere it is referenced, keeping the replay valid.
func renamed(t *testing.T, replay domain.Replay, from, to string) domain.Replay {
	t.Helper()
	raw, err := json.Marshal(replay)
	if err != nil {
		t.Fatal(err)
	}
	var out domain.Replay
	if err := json.Unmarshal(bytes.ReplaceAll(raw, []byte(`"`+from+`"`), []byte(`"`+to+`"`)), &out); err != nil {
		t.Fatal(err)
	}
	return out
}

func TestUnknownTeamTakesTheColourItsOpponentDoesNotWear(t *testing.T) {
	base, err := simulator.Load(filepath.Join("..", "..", "..", "..", "data", "samples", "first-sequence.json"))
	if err != nil {
		t.Fatal(err)
	}
	if base.Match.Teams[0].ID != "vale" || base.Match.Teams[1].ID != "bastion" {
		t.Fatalf("fixture team order changed: %v", base.Match.Teams)
	}
	for _, tc := range []struct {
		name   string
		replay domain.Replay
		want   map[string]string
	}{
		{"unknown second, known vale first", renamed(t, base, "bastion", "harbour"), map[string]string{"vale": "a", "harbour": "b"}},
		{"unknown first, known bastion second", renamed(t, base, "vale", "harbour"), map[string]string{"harbour": "a", "bastion": "b"}},
		{"bastion first, unknown second", swapped(renamed(t, base, "vale", "harbour")), map[string]string{"bastion": "b", "harbour": "a"}},
		{"both unknown fall back to position", renamed(t, renamed(t, base, "vale", "harbour"), "bastion", "summit"), map[string]string{"harbour": "a", "summit": "b"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			handler, err := NewHandler(tc.replay, filepath.Join("..", "..", "..", "web"))
			if err != nil {
				t.Fatal(err)
			}
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, httptest.NewRequest("GET", "/experience", nil))
			home, away, teams := renderedKits(t, rec.Body.String())
			if len(teams) != 2 || teams[tc.replay.Match.Teams[0].ID] != home || teams[tc.replay.Match.Teams[1].ID] != away {
				t.Fatalf("root kits %s/%s disagree with team strips %v", home, away, teams)
			}
			for id, kit := range tc.want {
				if teams[id] != kit {
					t.Errorf("%s wears kit %q, want %q (all: %v)", id, teams[id], kit, teams)
				}
			}
			if home == away {
				t.Fatalf("both teams wear kit %s", home)
			}
		})
	}
}

// swapped lists the second team first.
func swapped(replay domain.Replay) domain.Replay {
	replay.Match.Teams = []domain.Team{replay.Match.Teams[1], replay.Match.Teams[0]}
	return replay
}

// headMatchesKitPage checks that HEAD describes the same kit-bearing page as GET
// (#37): same status and headers, identical Content-Length per encoding, no body.
func headMatchesKitPage(t *testing.T, server *httptest.Server, path string) {
	t.Helper()
	for _, encoding := range []string{"", "gzip"} {
		headers := map[string]string{}
		if encoding != "" {
			headers["Accept-Encoding"] = encoding
		}
		get, page := wireRequest(t, server, http.MethodGet, path, headers)
		head, body := wireRequest(t, server, http.MethodHead, path, headers)
		if encoding == "" {
			renderedKits(t, string(page)) // the GET body HEAD describes carries the kits
		}
		if get.StatusCode != http.StatusOK || head.StatusCode != http.StatusOK || len(body) != 0 {
			t.Fatalf("HEAD %s (%q): status %d/%d, %d body bytes", path, encoding, get.StatusCode, head.StatusCode, len(body))
		}
		for _, name := range headHeaders {
			if g, h := get.Header.Values(name), head.Header.Values(name); len(g) != len(h) || (len(g) > 0 && g[0] != h[0]) {
				t.Errorf("HEAD %s (%q): %s = %v, GET has %v", path, encoding, name, h, g)
			}
		}
		if head.Header.Get("Cache-Control") != "no-cache" {
			t.Errorf("HEAD %s (%q): Cache-Control %q, want no-cache", path, encoding, head.Header.Get("Cache-Control"))
		}
	}
}

func TestTeamKitPagesAnswerHead(t *testing.T) {
	demo, _ := apiScenarios(t)
	server := httptest.NewServer(demo)
	defer server.Close()
	for _, path := range []string{"/?scenario=late-siege", "/experience?scenario=late-siege", "/?scenario=corner", "/experience?scenario=corner"} {
		headMatchesKitPage(t, server, path)
	}
	base, err := simulator.Load(filepath.Join("..", "..", "..", "..", "data", "samples", "first-sequence.json"))
	if err != nil {
		t.Fatal(err)
	}
	unknown, err := NewHandler(renamed(t, base, "bastion", "harbour"), filepath.Join("..", "..", "..", "web"))
	if err != nil {
		t.Fatal(err)
	}
	fallback := httptest.NewServer(unknown)
	defer fallback.Close()
	headMatchesKitPage(t, fallback, "/experience")
}
