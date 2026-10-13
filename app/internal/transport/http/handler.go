package transporthttp

import (
	"encoding/json"
	"html/template"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/alexwafula/pulse/app/internal/ai"
	"github.com/alexwafula/pulse/app/internal/domain"
	"github.com/alexwafula/pulse/app/internal/engine/metrics"
	"github.com/alexwafula/pulse/app/internal/facts"
)

type pageData struct {
	Match        domain.Match
	Graphs       []graphSnapshot
	Attacks      []metrics.AttackSnapshot
	Recap        []recapItem
	Scenario     string
	ScenarioName string
	TeamInitials []string
	Summaries    []summarySnapshot
	TotalEvents  int
	Window       string
	StartClock   string
	EndClock     string
	Experience   bool
	Story        experiencePanel
}

func NewHandler(replay domain.Replay, webDir string) (http.Handler, error) {
	return NewHandlerWithAgents(replay, webDir, "")
}

func NewHandlerWithAgents(replay domain.Replay, webDir, agentsURL string) (http.Handler, error) {
	return newScenarioHandler("", replay, webDir, agentsURL)
}

// newScenarioHandler serves one replay. scenario is the demo router's ID and
// is echoed by /api/metrics and /api/moments.
func newScenarioHandler(scenario string, replay domain.Replay, webDir, agentsURL string) (http.Handler, error) {
	packs, err := facts.CornerPacks(replay)
	if err != nil {
		return nil, err
	}
	graphs, err := passingViews(replay)
	if err != nil {
		return nil, err
	}
	attacks, err := metrics.AttackSeries(replay)
	if err != nil {
		return nil, err
	}
	page, err := template.ParseFiles(filepath.Join(webDir, "templates", "pages", "match.html"), filepath.Join(webDir, "templates", "partials", "experience.html"))
	if err != nil {
		return nil, err
	}
	designPath := filepath.Join(webDir, "templates", "pages", "design.html")
	var designPage *template.Template
	if _, err := os.Stat(designPath); err == nil {
		designPage, _ = template.ParseFiles(designPath)
	}
	staticDir := filepath.Join(webDir, "static")
	for _, name := range []string{"pitch.css", "pitch.js", "tokens.css"} {
		if _, err := os.Stat(filepath.Join(staticDir, name)); err != nil {
			return nil, err
		}
	}
	view := replayPage(replay, graphs, attacks, scenario)
	view.Story = storyPanel(replay, view, "story", replay.Match.StartMS, experienceOptions{mode: "live", persona: "CASUAL"})

	mux := http.NewServeMux()
	tracking := newMetricsAPI(scenario, replay)
	mux.HandleFunc("/api/metrics", tracking.serveMetrics)
	mux.HandleFunc("/api/moments", tracking.serveMoments)
	mux.HandleFunc("/experience/panel", experiencePanelHandler(page, replay, view))
	mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir(staticDir))))
	mux.HandleFunc("/design", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.Header().Set("Allow", http.MethodGet)
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if os.Getenv("PULSE_DEV") != "1" || designPage == nil {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_ = designPage.Execute(w, view)
	})
	mux.HandleFunc("/api/fact-packs", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.Header().Set("Allow", "GET")
			http.Error(w, "method not allowed", 405)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		json.NewEncoder(w).Encode(packs)
	})
	mux.HandleFunc("/api/insights", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.Header().Set("Allow", "GET")
			http.Error(w, "method not allowed", 405)
			return
		}
		persona := r.URL.Query().Get("persona")
		if persona == "" {
			persona = "CASUAL"
		}
		if persona != "CASUAL" && persona != "ANALYST" {
			http.Error(w, "unsupported persona", 400)
			return
		}
		locale := r.URL.Query().Get("locale")
		if locale == "" {
			locale = "en-GB"
		}
		if locale != "en-GB" {
			http.Error(w, "locale awaiting review", 400)
			return
		}
		feed := domain.CueFeed{SchemaVersion: domain.SchemaVersion, Cues: []domain.OverlayCue{}}
		source := "go-template"
		for _, pack := range packs {
			response, err := ai.Template(pack, locale, persona)
			if err != nil {
				http.Error(w, "unsupported fact pack", 500)
				return
			}
			if agentsURL != "" {
				remote, remoteErr := ai.Request(r.Context(), agentsURL, pack, locale, persona)
				if remoteErr == nil {
					_, remoteErr = ai.Cue(replay, pack, remote, locale, persona)
					if remoteErr == nil {
						response = remote
						source = "python-template"
					}
				}
				if remoteErr != nil {
					log.Printf("Python insight rejected/unavailable; using Go template: %v", remoteErr)
				}
			}
			cue, err := ai.Cue(replay, pack, response, locale, persona)
			if err != nil {
				http.Error(w, "cue validation failed", 500)
				return
			}
			feed.Cues = append(feed.Cues, cue)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Pulse-Insight-Source", source)
		json.NewEncoder(w).Encode(feed)
	})
	mux.HandleFunc("/api/replay", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.Header().Set("Allow", http.MethodGet)
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		if err := json.NewEncoder(w).Encode(replay); err != nil {
			return
		}
	})
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.Header().Set("Allow", http.MethodGet)
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" && r.URL.Path != "/experience" {
			http.NotFound(w, r)
			return
		}
		if r.Method != http.MethodGet {
			w.Header().Set("Allow", http.MethodGet)
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		data := view
		data.Experience = r.URL.Path == "/experience"
		if err := page.Execute(w, data); err != nil {
			return
		}
	})
	return gzipJSON(mux), nil
}
