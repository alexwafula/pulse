package transporthttp

import (
	"bytes"
	"compress/gzip"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"

	"github.com/alexwafula/pulse/app/internal/domain"
	trackmetrics "github.com/alexwafula/pulse/app/internal/metrics"
	"github.com/alexwafula/pulse/app/internal/moments"
)

// apiCacheControl: bodies are deterministic for a given build and fixture,
// and the ETag lets clients revalidate cheaply after max-age.
const apiCacheControl = "public, max-age=300"

// gridLayout describes the optional per-tick grid (grid=1).
type gridLayout struct {
	Order  string `json:"order"`
	Cols   int    `json:"cols"`
	Rows   int    `json:"rows"`
	TeamID string `json:"teamId"`
	Origin string `json:"origin"`
}

// tickOut is one metrics tick as served; Grid only with grid=1.
type tickOut struct {
	trackmetrics.Tick
	Grid []float64 `json:"grid,omitempty"`
}

type metricsResponse struct {
	Model           string              `json:"model"`
	Label           string              `json:"label"`
	Scenario        string              `json:"scenario"`
	MatchID         string              `json:"matchId"`
	TrackingMetrics string              `json:"trackingMetrics"`
	Reason          string              `json:"reason,omitempty"`
	Teams           []string            `json:"teams"`
	Params          trackmetrics.Params `json:"params"`
	GridLayout      *gridLayout         `json:"gridLayout,omitempty"`
	Ticks           []tickOut           `json:"ticks"`
}

type momentsResponse struct {
	Model           string           `json:"model"`
	Label           string           `json:"label"`
	Scenario        string           `json:"scenario"`
	MatchID         string           `json:"matchId"`
	TrackingMetrics string           `json:"trackingMetrics"`
	Reason          string           `json:"reason,omitempty"`
	Moments         []moments.Moment `json:"moments"`
}

// cachedBody is one encoded response, kept raw and gzipped.
type cachedBody struct {
	raw, gz      []byte
	etag, gzEtag string
}

func newCachedBody(v any) (cachedBody, error) {
	raw, err := json.Marshal(v)
	if err != nil {
		return cachedBody{}, fmt.Errorf("encode: %w", err)
	}
	var buf bytes.Buffer
	zw, err := gzip.NewWriterLevel(&buf, gzip.BestCompression)
	if err != nil {
		return cachedBody{}, err
	}
	if _, err := zw.Write(raw); err != nil {
		return cachedBody{}, fmt.Errorf("gzip: %w", err)
	}
	if err := zw.Close(); err != nil {
		return cachedBody{}, fmt.Errorf("gzip: %w", err)
	}
	sum := sha256.Sum256(raw)
	tag := hex.EncodeToString(sum[:16])
	return cachedBody{raw: raw, gz: buf.Bytes(), etag: `"` + tag + `"`, gzEtag: `"` + tag + `-gzip"`}, nil
}

// metricsAPI serves /api/metrics and /api/moments for one scenario. The
// replay is computed once, on first request, and every response is served
// from the encoded cache.
type metricsAPI struct {
	scenario string
	replay   domain.Replay
	once     sync.Once
	computes atomic.Int32

	err                           error
	metrics, metricsGrid, moments cachedBody
}

func newMetricsAPI(scenario string, replay domain.Replay) *metricsAPI {
	return &metricsAPI{scenario: scenario, replay: replay}
}

func round4(v float64) float64 {
	r := math.Round(v*1e4) / 1e4
	if r == 0 {
		return 0
	}
	return r
}

func (a *metricsAPI) compute() {
	a.computes.Add(1)
	p := trackmetrics.DefaultParams()
	res, err := trackmetrics.Compute(a.replay, p)
	if err != nil {
		a.err = fmt.Errorf("metrics %s: %w", a.scenario, err)
		return
	}
	found, err := moments.Detect(a.replay, res, p)
	if err != nil {
		a.err = fmt.Errorf("moments %s: %w", a.scenario, err)
		return
	}
	rounded := res.Rounded(4)
	base := metricsResponse{Model: res.Model, Label: res.Label, Scenario: a.scenario, MatchID: a.replay.Match.ID,
		TrackingMetrics: res.TrackingMetrics, Reason: res.Reason, Teams: rounded.Teams, Params: res.Params,
		Ticks: make([]tickOut, len(rounded.Ticks))}
	withGrid := base
	withGrid.Ticks = make([]tickOut, len(rounded.Ticks))
	if len(res.Teams) > 0 {
		withGrid.GridLayout = &gridLayout{Order: "row-major", Cols: p.Grid.Cols, Rows: p.Grid.Rows,
			TeamID: res.Teams[0], Origin: "bottom-left"}
	}
	for k, tk := range rounded.Ticks {
		base.Ticks[k] = tickOut{Tick: tk}
		withGrid.Ticks[k] = tickOut{Tick: tk, Grid: rowMajorGrid(res.Ticks[k].Surface)}
	}
	if a.metrics, err = newCachedBody(base); err == nil {
		if a.metricsGrid, err = newCachedBody(withGrid); err == nil {
			a.moments, err = newCachedBody(momentsResponse{Model: res.Model, Label: res.Label, Scenario: a.scenario,
				MatchID: a.replay.Match.ID, TrackingMetrics: res.TrackingMetrics, Reason: res.Reason, Moments: found})
		}
	}
	a.err = err
}

// rowMajorGrid returns team A's control as grid[j*cols+i] (row j from the
// bottom touchline, column i from the left goal line), rounded to 4 dp.
func rowMajorGrid(s *trackmetrics.Surface) []float64 {
	if s == nil {
		return []float64{}
	}
	out := make([]float64, s.Cols*s.Rows)
	for i := 0; i < s.Cols; i++ {
		for j := 0; j < s.Rows; j++ {
			out[j*s.Cols+i] = round4(s.Control[0][i*s.Rows+j])
		}
	}
	return out
}

func (a *metricsAPI) serveMetrics(w http.ResponseWriter, r *http.Request) {
	a.serve(w, r, func() cachedBody {
		if r.URL.Query().Get("grid") == "1" {
			return a.metricsGrid
		}
		return a.metrics
	})
}

func (a *metricsAPI) serveMoments(w http.ResponseWriter, r *http.Request) {
	a.serve(w, r, func() cachedBody { return a.moments })
}

func (a *metricsAPI) serve(w http.ResponseWriter, r *http.Request, pick func() cachedBody) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	a.once.Do(a.compute)
	if a.err != nil {
		http.Error(w, "metrics unavailable", http.StatusInternalServerError)
		return
	}
	body := pick()
	payload, etag := body.raw, body.etag
	h := w.Header()
	h.Set("Content-Type", "application/json")
	h.Set("Cache-Control", apiCacheControl)
	h.Add("Vary", "Accept-Encoding")
	gz := acceptsGzip(r.Header.Get("Accept-Encoding"))
	if gz {
		payload, etag = body.gz, body.gzEtag
	}
	h.Set("ETag", etag)
	if matchesETag(r.Header.Get("If-None-Match"), etag) {
		w.WriteHeader(http.StatusNotModified)
		return
	}
	if gz {
		h.Set("Content-Encoding", "gzip")
	}
	h.Set("Content-Length", strconv.Itoa(len(payload)))
	_, _ = w.Write(payload)
}

// acceptsGzip reports whether the client accepts gzip (RFC 9110 §12.5.3):
// an explicit gzip token wins; otherwise "*" applies; q=0 refuses.
func acceptsGzip(header string) bool {
	star := false
	for _, part := range strings.Split(header, ",") {
		name, params, _ := strings.Cut(strings.TrimSpace(part), ";")
		q := 1.0
		for _, p := range strings.Split(params, ";") {
			if k, v, ok := strings.Cut(strings.TrimSpace(p), "="); ok && strings.EqualFold(k, "q") {
				if f, err := strconv.ParseFloat(v, 64); err == nil {
					q = f
				}
			}
		}
		switch strings.ToLower(strings.TrimSpace(name)) {
		case "gzip":
			return q > 0
		case "*":
			star = q > 0
		}
	}
	return star
}

func matchesETag(header, etag string) bool {
	for _, part := range strings.Split(header, ",") {
		tag := strings.TrimPrefix(strings.TrimSpace(part), "W/")
		if tag == etag || tag == "*" {
			return true
		}
	}
	return false
}
