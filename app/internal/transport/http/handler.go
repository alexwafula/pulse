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
	"github.com/alexwafula/pulse/app/internal/facts"
)

type pageData struct {
	Match domain.Match
}

func NewHandler(replay domain.Replay, webDir string) (http.Handler, error) {
	return NewHandlerWithAgents(replay, webDir, "")
}

func NewHandlerWithAgents(replay domain.Replay, webDir, agentsURL string) (http.Handler, error) {
	packs, err := facts.CornerPacks(replay)
	if err != nil {
		return nil, err
	}
	page, err := template.ParseFiles(filepath.Join(webDir, "templates", "pages", "match.html"))
	if err != nil {
		return nil, err
	}
	staticDir := filepath.Join(webDir, "static")
	for _, name := range []string{"pitch.css", "pitch.js"} {
		if _, err := os.Stat(filepath.Join(staticDir, name)); err != nil {
			return nil, err
		}
	}

	mux := http.NewServeMux()
	mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir(staticDir))))
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
		feed := domain.CueFeed{SchemaVersion: domain.SchemaVersion, Cues: []domain.OverlayCue{}}
		source := "go-template"
		for _, pack := range packs {
			response, err := ai.Template(pack, "en-GB", persona)
			if err != nil {
				http.Error(w, "unsupported fact pack", 500)
				return
			}
			if agentsURL != "" {
				remote, remoteErr := ai.Request(r.Context(), agentsURL, pack, "en-GB", persona)
				if remoteErr == nil {
					_, remoteErr = ai.Cue(replay, pack, remote, "en-GB", persona)
					if remoteErr == nil {
						response = remote
						source = "python-template"
					}
				}
				if remoteErr != nil {
					log.Printf("Python insight rejected/unavailable; using Go template: %v", remoteErr)
				}
			}
			cue, err := ai.Cue(replay, pack, response, "en-GB", persona)
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
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		if r.Method != http.MethodGet {
			w.Header().Set("Allow", http.MethodGet)
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		if err := page.Execute(w, pageData{Match: replay.Match}); err != nil {
			return
		}
	})
	return mux, nil
}
