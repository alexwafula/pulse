package transporthttp

import (
	"encoding/json"
	"html/template"
	"net/http"
	"os"
	"path/filepath"

	"github.com/alexwafula/pulse/app/internal/domain"
)

type pageData struct {
	Match domain.Match
}

func NewHandler(replay domain.Replay, webDir string) (http.Handler, error) {
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
