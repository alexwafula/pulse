package transporthttp

import (
	"encoding/json"
	"net/http"

	"github.com/alexwafula/pulse/app/internal/buildinfo"
)

// serveVersion reports the running build; it is never cached or redirected.
func serveVersion(w http.ResponseWriter, r *http.Request) {
	if !allowGetHead(w, r) {
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	_ = json.NewEncoder(w).Encode(buildinfo.Current())
}

// withBuild tags every response, errors included, with the short build SHA.
func withBuild(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Pulse-Build", buildinfo.Current().ShortSHA)
		next.ServeHTTP(w, r)
	})
}
