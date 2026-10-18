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

// lazyBody is one API response, encoded and gzipped once, on its first request.
type lazyBody struct {
	once    sync.Once
	encodes atomic.Int32
	body    cachedBody
	err     error
}

func (b *lazyBody) get(total *atomic.Int32, build func() any) (cachedBody, error) {
	b.once.Do(func() {
		b.encodes.Add(1)
		total.Add(1)
		b.body, b.err = newCachedBody(build())
	})
	return b.body, b.err
}

// metricsAPI serves /api/metrics and /api/moments for one scenario. The
// replay is computed once, on the first page or API request. Each response
// body is encoded once, on its first API request, so a page render (which
// reads only the computed result) never pays for encoding.
type metricsAPI struct {
	scenario string
	replay   domain.Replay
	once     sync.Once
	computes atomic.Int32
	encodes  atomic.Int32

	err     error
	params  trackmetrics.Params
	res     trackmetrics.Result // unrounded; holds the control surfaces
	rounded trackmetrics.Result // what /api/metrics serves
	found   []moments.Moment

	metrics, metricsGrid, moments lazyBody
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
	a.params = trackmetrics.DefaultParams()
	res, err := trackmetrics.Compute(a.replay, a.params)
	if err != nil {
		a.err = fmt.Errorf("metrics %s: %w", a.scenario, err)
		return
	}
	found, err := moments.Detect(a.replay, res, a.params)
	if err != nil {
		a.err = fmt.Errorf("moments %s: %w", a.scenario, err)
		return
	}
	a.res, a.rounded, a.found = res, res.Rounded(4), found
}

// metricsResponse builds the /api/metrics body; grid adds the per-tick grid.
func (a *metricsAPI) metricsResponse(grid bool) any {
	out := metricsResponse{Model: a.res.Model, Label: a.res.Label, Scenario: a.scenario, MatchID: a.replay.Match.ID,
		TrackingMetrics: a.res.TrackingMetrics, Reason: a.res.Reason, Teams: a.rounded.Teams, Params: a.res.Params,
		Ticks: make([]tickOut, len(a.rounded.Ticks))}
	if grid && len(a.res.Teams) > 0 {
		out.GridLayout = &gridLayout{Order: "row-major", Cols: a.params.Grid.Cols, Rows: a.params.Grid.Rows,
			TeamID: a.res.Teams[0], Origin: "bottom-left"}
	}
	for k, tk := range a.rounded.Ticks {
		out.Ticks[k] = tickOut{Tick: tk}
		if grid {
			out.Ticks[k].Grid = rowMajorGrid(a.res.Ticks[k].Surface)
		}
	}
	return out
}

func (a *metricsAPI) momentsResponse() any {
	return momentsResponse{Model: a.res.Model, Label: a.res.Label, Scenario: a.scenario,
		MatchID: a.replay.Match.ID, TrackingMetrics: a.res.TrackingMetrics, Reason: a.res.Reason, Moments: a.found}
}

// startTick returns the served result and its last tick at or before the
// replay start, the client's first clock. It reads the same cached
// computation /api/metrics encodes, so the page never recomputes a value.
func (a *metricsAPI) startTick() (trackmetrics.Result, *trackmetrics.Tick, error) {
	a.once.Do(a.compute)
	if a.err != nil {
		return trackmetrics.Result{}, nil, a.err
	}
	var at *trackmetrics.Tick
	for i := range a.rounded.Ticks {
		if a.rounded.Ticks[i].TimeMS > a.replay.Match.StartMS {
			break
		}
		at = &a.rounded.Ticks[i]
	}
	return a.rounded, at, nil
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
	grid := r.URL.Query().Get("grid") == "1"
	body := &a.metrics
	if grid {
		body = &a.metricsGrid
	}
	a.serve(w, r, body, func() any { return a.metricsResponse(grid) })
}

func (a *metricsAPI) serveMoments(w http.ResponseWriter, r *http.Request) {
	a.serve(w, r, &a.moments, a.momentsResponse)
}

func (a *metricsAPI) serve(w http.ResponseWriter, r *http.Request, lazy *lazyBody, build func() any) {
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
	body, err := lazy.get(&a.encodes, build)
	if err != nil {
		http.Error(w, "metrics unavailable", http.StatusInternalServerError)
		return
	}
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
