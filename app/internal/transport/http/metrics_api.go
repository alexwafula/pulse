package transporthttp

import (
	"net/http"
	"sync/atomic"

	"github.com/alexwafula/pulse/app/internal/domain"
)

// metricsAPI serves /api/metrics and /api/moments for one scenario.
// STUB (G2 Stage 2 tests-first commit); implemented in the next commit.
type metricsAPI struct {
	scenario string
	replay   domain.Replay
	computes atomic.Int32
}

func newMetricsAPI(scenario string, replay domain.Replay) *metricsAPI {
	return &metricsAPI{scenario: scenario, replay: replay}
}

func (a *metricsAPI) serveMetrics(w http.ResponseWriter, r *http.Request) {
	http.Error(w, "not implemented", http.StatusNotImplemented)
}

func (a *metricsAPI) serveMoments(w http.ResponseWriter, r *http.Request) {
	http.Error(w, "not implemented", http.StatusNotImplemented)
}
