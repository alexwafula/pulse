package transporthttp

import (
	"encoding/json"
	"html/template"
	"net/http"
	"os"
	"path/filepath"

	"github.com/alexwafula/pulse/app/internal/buildinfo"
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
	TeamKits     []string
	Hero         heroView
	Summaries    []summarySnapshot
	TotalEvents  int
	Window       string
	StartClock   string
	EndClock     string
	Experience   bool
	Build        string
	Story        experiencePanel
	catalog      uiCatalog
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
	return scenarioHandler(scenario, replay, webDir, agentsURL, newMetricsAPI(scenario, replay))
}

// scenarioHandler serves one replay with tracking as its metrics cache, which
// the page and the metrics API share.
func scenarioHandler(scenario string, replay domain.Replay, webDir, agentsURL string, tracking *metricsAPI) (http.Handler, error) {
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
	view.catalog, err = loadUICatalog(filepath.Join(staticDir, "locales.json"))
	if err != nil {
		return nil, err
	}
	view.Story = storyPanel(replay, view, "story", replay.Match.StartMS, experienceOptions{mode: "live", persona: "CASUAL"})

	mux := http.NewServeMux()
	mux.HandleFunc("/api/metrics", tracking.serveMetrics)
	mux.HandleFunc("/api/moments", tracking.serveMoments)
	mux.HandleFunc("/experience/panel", experiencePanelHandler(page, replay, view))
	mux.Handle("/static/", http.StripPrefix("/static/", staticAssets(staticDir)))
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
	reference := loadAgentReference(webDir)
	mux.HandleFunc("/api/insights", insightHandler(replay, packs, agentsURL, false, nil))
	mux.HandleFunc("/api/agent-inspection", insightHandler(replay, packs, agentsURL, true, reference))
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
	mux.HandleFunc("/version", serveVersion)
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		if !allowGetHead(w, r) {
			return
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" && r.URL.Path != "/experience" && r.URL.Path != "/legacy" {
			http.NotFound(w, r)
			return
		}
		if !allowGetHead(w, r) {
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		if r.URL.Path != "/legacy" {
			w.Header().Set("Cache-Control", "no-cache")
		}
		data := view
		data.Experience = r.URL.Path != "/legacy"
		if data.Experience {
			data.Hero = heroFor(tracking, view.catalog, requestLocale(r))
		}
		data.Build = buildinfo.Current().ShortSHA
		if err := page.Execute(w, data); err != nil {
			return
		}
	})
	return withBuild(gzipResponses(mux)), nil
}

// allowGetHead admits GET and HEAD. HEAD runs the GET path unchanged and
// net/http drops the body, so the headers always match.
func allowGetHead(w http.ResponseWriter, r *http.Request) bool {
	if r.Method == http.MethodGet || r.Method == http.MethodHead {
		return true
	}
	w.Header().Set("Allow", "GET, HEAD")
	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	return false
}
