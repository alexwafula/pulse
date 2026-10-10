package transporthttp

import (
	"net/http"

	"github.com/alexwafula/pulse/app/internal/domain"
	"github.com/alexwafula/pulse/app/internal/simulator"
	"github.com/alexwafula/pulse/app/internal/simulator/scenarios"
)

func NewDemoHandler(base domain.Replay, webDir, agentsURL string) (http.Handler, error) {
	catalog, err := scenarios.Catalog(base)
	if err != nil {
		return nil, err
	}
	for _, lateSiegePath := range []string{
		"data/scenarios/late-siege.json",
		"../../../../data/scenarios/late-siege.json",
		"../../../data/scenarios/late-siege.json",
		"../../data/scenarios/late-siege.json",
	} {
		if lateSiege, err := simulator.Load(lateSiegePath); err == nil {
			catalog["late-siege"] = lateSiege
			break
		}
	}
	handlers := make(map[string]http.Handler)
	for id, replay := range catalog {
		handler, err := NewHandlerWithAgents(replay, webDir, agentsURL)
		if err != nil {
			return nil, err
		}
		handlers[id] = handler
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.URL.Query().Get("scenario")
		if id == "" {
			id = "corner"
		}
		handler := handlers[id]
		if handler == nil {
			http.Error(w, "unknown scenario", 400)
			return
		}
		handler.ServeHTTP(w, r)
	}), nil
}
