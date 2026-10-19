package transporthttp

import (
	"fmt"
	"net/http"
	"path/filepath"
	"sort"
	"strings"

	"github.com/alexwafula/pulse/app/internal/domain"
	"github.com/alexwafula/pulse/app/internal/simulator"
	"github.com/alexwafula/pulse/app/internal/simulator/scenarios"
)

func NewDemoHandler(base domain.Replay, webDir, agentsURL string) (http.Handler, error) {
	catalog, err := scenarios.Catalog(base)
	if err != nil {
		return nil, err
	}
	for _, name := range []string{"late-siege", "calm-midfield"} {
		for _, dir := range []string{"data/scenarios", "../../../../data/scenarios", "../../../data/scenarios", "../../data/scenarios"} {
			if replay, err := simulator.Load(dir + "/" + name + ".json"); err == nil {
				catalog[name] = replay
				break
			}
		}
	}
	handlers := make(map[string]http.Handler)
	for id, replay := range catalog {
		handler, err := newScenarioHandler(id, replay, webDir, agentsURL)
		if err != nil {
			return nil, err
		}
		handlers[id] = handler
	}
	known := make([]string, 0, len(handlers))
	for id := range handlers {
		known = append(known, id)
	}
	sort.Strings(known)
	library, err := scenarioLibrary(catalog, webDir)
	if err != nil {
		return nil, err
	}
	library = gzipResponses(library)
	assets := http.StripPrefix("/static/", staticAssets(filepath.Join(webDir, "static")))
	return withBuild(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/static/") {
			assets.ServeHTTP(w, r)
			return
		}
		if r.URL.Path == "/version" {
			serveVersion(w, r)
			return
		}
		if r.URL.Path == "/scenarios" {
			library.ServeHTTP(w, r)
			return
		}
		id := r.URL.Query().Get("scenario")
		if id == "" {
			id = "corner"
			if (r.URL.Path == "/" || r.URL.Path == "/experience") && handlers["late-siege"] != nil {
				id = "late-siege"
			}
		}
		handler := handlers[id]
		if handler == nil {
			http.Error(w, fmt.Sprintf("unknown scenario %q; known: %s", id, strings.Join(known, ", ")), http.StatusNotFound)
			return
		}
		handler.ServeHTTP(w, r)
	})), nil
}
