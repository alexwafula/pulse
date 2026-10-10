package transporthttp

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"io"
	"math"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"reflect"
	"regexp"
	"strings"
	"sync"
	"testing"

	"github.com/alexwafula/pulse/app/internal/domain"
	trackmetrics "github.com/alexwafula/pulse/app/internal/metrics"
	"github.com/alexwafula/pulse/app/internal/moments"
	"github.com/alexwafula/pulse/app/internal/simulator"
	"github.com/alexwafula/pulse/app/internal/simulator/scenarios"
)

// apiScenarios is every scenario the demo router serves, with its replay.
func apiScenarios(t *testing.T) (http.Handler, map[string]domain.Replay) {
	t.Helper()
	base, err := simulator.Load(filepath.Join("..", "..", "..", "..", "data", "samples", "first-sequence.json"))
	if err != nil {
		t.Fatal(err)
	}
	all, err := scenarios.Catalog(base)
	if err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"late-siege", "calm-midfield"} {
		r, err := simulator.Load(filepath.Join("..", "..", "..", "..", "data", "scenarios", name+".json"))
		if err != nil {
			t.Fatal(err)
		}
		all[name] = r
	}
	demo, err := NewDemoHandler(base, filepath.Join("..", "..", "..", "web"), "")
	if err != nil {
		t.Fatal(err)
	}
	return demo, all
}

func get(t *testing.T, h http.Handler, path string, header map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	for k, v := range header {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

type apiMoment struct {
	Type            string    `json:"type"`
	TeamID          string    `json:"teamId"`
	TimeMS          int64     `json:"timeMs"`
	EvidenceKind    string    `json:"evidenceKind"`
	Reasons         *[]string `json:"reasons"`
	ContextEventIDs *[]string `json:"contextEventIds"`
	TickTimesMS     *[]int64  `json:"tickTimesMs"`
}

type apiMoments struct {
	Model           string       `json:"model"`
	Label           string       `json:"label"`
	Scenario        string       `json:"scenario"`
	MatchID         string       `json:"matchId"`
	TrackingMetrics string       `json:"trackingMetrics"`
	Reason          string       `json:"reason"`
	Moments         *[]apiMoment `json:"moments"`
}

type apiMetrics struct {
	Model           string            `json:"model"`
	Label           string            `json:"label"`
	Scenario        string            `json:"scenario"`
	MatchID         string            `json:"matchId"`
	TrackingMetrics string            `json:"trackingMetrics"`
	Reason          string            `json:"reason"`
	Teams           []string          `json:"teams"`
	Ticks           *[]map[string]any `json:"ticks"`
	GridLayout      *struct {
		Order  string `json:"order"`
		Cols   int    `json:"cols"`
		Rows   int    `json:"rows"`
		TeamID string `json:"teamId"`
	} `json:"gridLayout"`
}

func decode[T any](t *testing.T, rec *httptest.ResponseRecorder) T {
	t.Helper()
	var v T
	if err := json.Unmarshal(rec.Body.Bytes(), &v); err != nil {
		t.Fatalf("decode %q: %v", rec.Body.String(), err)
	}
	return v
}

// nullable lists the only keys allowed to be JSON null (docs/metrics.md §4-5).
var nullable = map[string]bool{"carrier": true, "pressing": true, "press": true, "shotQuality": true}

var camel = regexp.MustCompile(`^[a-z][a-zA-Z0-9]*$`)

// walkJSON enforces: no null except the nullable keys (so empty lists are []),
// camelCase keys (except team-ID map keys), and floats at most 4 dp.
func walkJSON(t *testing.T, where string, key string, v any, idMap bool) {
	t.Helper()
	switch x := v.(type) {
	case nil:
		if !nullable[key] {
			t.Errorf("%s: %q is null; lists must be [] and objects present", where, key)
		}
	case map[string]any:
		for k, child := range x {
			if !idMap && !camel.MatchString(k) {
				t.Errorf("%s: key %q is not camelCase", where, k)
			}
			walkJSON(t, where+"."+k, k, child, k == "teams" && isObject(child))
		}
	case []any:
		for _, child := range x {
			walkJSON(t, where+"[]", key, child, false)
		}
	case float64:
		if math.Round(x*1e4)/1e4 != x {
			t.Errorf("%s: %v has more than 4 decimals", where, x)
		}
	}
}

func isObject(v any) bool { _, ok := v.(map[string]any); return ok }

func checkBodyStyle(t *testing.T, where string, body []byte) {
	t.Helper()
	var v any
	if err := json.Unmarshal(body, &v); err != nil {
		t.Fatalf("%s: %v", where, err)
	}
	walkJSON(t, where, "", v, false)
}

// T15: model+label on every response; routing for every scenario; unknown 404.
func TestT15_MetricsAndMomentsAPI(t *testing.T) {
	demo, all := apiScenarios(t)
	p := trackmetrics.DefaultParams()
	for name, replay := range all {
		t.Run(name, func(t *testing.T) {
			res, err := trackmetrics.Compute(replay, p)
			if err != nil {
				t.Fatal(err)
			}
			want, err := moments.Detect(replay, res, p)
			if err != nil {
				t.Fatal(err)
			}

			mrec := get(t, demo, "/api/metrics?scenario="+name, nil)
			if mrec.Code != http.StatusOK {
				t.Fatalf("/api/metrics: %d %s", mrec.Code, mrec.Body.String())
			}
			if ct := mrec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
				t.Errorf("metrics Content-Type %q", ct)
			}
			m := decode[apiMetrics](t, mrec)
			if m.Model != trackmetrics.Model || m.Label != trackmetrics.Label {
				t.Errorf("metrics model/label %q/%q", m.Model, m.Label)
			}
			if m.Scenario != name || m.MatchID != replay.Match.ID || m.TrackingMetrics != res.TrackingMetrics {
				t.Errorf("metrics routed wrong: scenario %q matchId %q trackingMetrics %q", m.Scenario, m.MatchID, m.TrackingMetrics)
			}
			if m.Ticks == nil || len(*m.Ticks) != len(res.Ticks) {
				t.Errorf("metrics ticks %v, want %d", m.Ticks, len(res.Ticks))
			}
			if m.GridLayout != nil {
				t.Error("gridLayout present without grid=1")
			}
			checkBodyStyle(t, name+" metrics", mrec.Body.Bytes())

			orec := get(t, demo, "/api/moments?scenario="+name, nil)
			if orec.Code != http.StatusOK {
				t.Fatalf("/api/moments: %d %s", orec.Code, orec.Body.String())
			}
			o := decode[apiMoments](t, orec)
			if o.Model != trackmetrics.Model || o.Label != trackmetrics.Label {
				t.Errorf("moments model/label %q/%q", o.Model, o.Label)
			}
			if o.Scenario != name || o.MatchID != replay.Match.ID || o.TrackingMetrics != res.TrackingMetrics {
				t.Errorf("moments routed wrong: scenario %q matchId %q", o.Scenario, o.MatchID)
			}
			if o.Moments == nil || len(*o.Moments) != len(want) {
				t.Fatalf("moments %v, want %d", o.Moments, len(want))
			}
			for k, got := range *o.Moments {
				w := want[k]
				if got.Type != w.Type || got.TeamID != w.TeamID || got.TimeMS != w.TimeMS ||
					got.Reasons == nil || !reflect.DeepEqual(*got.Reasons, w.Reasons) {
					t.Errorf("moment %d: got %+v, want %+v (not this scenario's detection)", k, got, w)
				}
				checkEvidence(t, got)
			}
			checkBodyStyle(t, name+" moments", orec.Body.Bytes())
		})
	}

	t.Run("omitted scenario uses the demo default", func(t *testing.T) {
		for _, path := range []string{"/api/metrics", "/api/moments"} {
			omitted := get(t, demo, path, nil)
			corner := get(t, demo, path+"?scenario=corner", nil)
			if omitted.Code != http.StatusOK || !bytes.Equal(omitted.Body.Bytes(), corner.Body.Bytes()) {
				t.Errorf("%s without scenario (%d) differs from scenario=corner", path, omitted.Code)
			}
		}
	})

	t.Run("unknown scenario", func(t *testing.T) {
		for _, path := range []string{"/api/metrics?scenario=nope", "/api/moments?scenario=nope", "/api/metrics?scenario=nope&grid=1"} {
			rec := get(t, demo, path, nil)
			if rec.Code != http.StatusNotFound || !strings.Contains(rec.Body.String(), `unknown scenario "nope"`) {
				t.Errorf("%s: %d %q, want 404 with the demo router error", path, rec.Code, rec.Body.String())
			}
		}
	})

	t.Run("method not allowed", func(t *testing.T) {
		for _, path := range []string{"/api/metrics?scenario=late-siege", "/api/moments?scenario=late-siege"} {
			rec := httptest.NewRecorder()
			demo.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, path, nil))
			if rec.Code != http.StatusMethodNotAllowed || rec.Header().Get("Allow") != http.MethodGet {
				t.Errorf("POST %s: %d Allow=%q", path, rec.Code, rec.Header().Get("Allow"))
			}
		}
	})
}

// checkEvidence: event moments cite non-empty reasons; CONTROL_SWING is tick
// evidence with reasons [] and contextEventIds present.
func checkEvidence(t *testing.T, m apiMoment) {
	t.Helper()
	if m.Reasons == nil || m.ContextEventIDs == nil || m.TickTimesMS == nil {
		t.Errorf("%s at %d: reasons/contextEventIds/tickTimesMs must be lists, not null/absent", m.Type, m.TimeMS)
		return
	}
	switch m.Type {
	case moments.SetPieceShot, moments.SustainedPressure:
		if m.EvidenceKind != moments.EvidenceEvent || len(*m.Reasons) == 0 {
			t.Errorf("%s at %d: evidenceKind %q reasons %v", m.Type, m.TimeMS, m.EvidenceKind, *m.Reasons)
		}
	case moments.ControlSwing:
		if m.EvidenceKind != moments.EvidenceTick || len(*m.Reasons) != 0 {
			t.Errorf("CONTROL_SWING at %d: evidenceKind %q reasons %v", m.TimeMS, m.EvidenceKind, *m.Reasons)
		}
	default:
		t.Errorf("unknown moment type %q", m.Type)
	}
}

// Unsupported replays: 200, trackingMetrics "unsupported" + reason, ticks [],
// and their SET_PIECE_SHOT still returned.
func TestMetricsAPI_UnsupportedScenarios(t *testing.T) {
	demo, _ := apiScenarios(t)
	for _, name := range []string{"corner", "central", "exchange"} {
		mrec := get(t, demo, "/api/metrics?scenario="+name+"&grid=1", nil)
		m := decode[apiMetrics](t, mrec)
		if mrec.Code != http.StatusOK || m.TrackingMetrics != trackmetrics.TrackingUnsupported || m.Reason == "" {
			t.Errorf("%s metrics: %d trackingMetrics %q reason %q", name, mrec.Code, m.TrackingMetrics, m.Reason)
		}
		if !bytes.Contains(mrec.Body.Bytes(), []byte(`"ticks":[]`)) {
			t.Errorf("%s metrics: ticks must serialise as []: %s", name, mrec.Body.String())
		}
		orec := get(t, demo, "/api/moments?scenario="+name, nil)
		o := decode[apiMoments](t, orec)
		if orec.Code != http.StatusOK || o.TrackingMetrics != trackmetrics.TrackingUnsupported || o.Reason == "" {
			t.Errorf("%s moments: %d trackingMetrics %q reason %q", name, orec.Code, o.TrackingMetrics, o.Reason)
		}
		setPiece := 0
		for _, mo := range *o.Moments {
			if mo.Type == moments.SetPieceShot {
				setPiece++
			}
		}
		if setPiece == 0 {
			t.Errorf("%s: SET_PIECE_SHOT missing on unsupported replay", name)
		}
	}
}

// Calm-midfield routing: its own matchId on /api/replay, [] cues, [] moments.
func TestDemoHandler_CalmMidfieldRouting(t *testing.T) {
	demo, all := apiScenarios(t)
	calm := all["calm-midfield"]

	rrec := get(t, demo, "/api/replay?scenario=calm-midfield", nil)
	if rrec.Code != http.StatusOK {
		t.Fatalf("/api/replay: %d %s", rrec.Code, rrec.Body.String())
	}
	if r := decode[domain.Replay](t, rrec); r.Match.ID != calm.Match.ID || r.Match.ID != "match-vale-bastion-calm" {
		t.Errorf("/api/replay matchId %q, want %q", r.Match.ID, calm.Match.ID)
	}

	irec := get(t, demo, "/api/insights?scenario=calm-midfield", nil)
	if irec.Code != http.StatusOK || !bytes.Contains(irec.Body.Bytes(), []byte(`"cues":[]`)) {
		t.Errorf("/api/insights: %d %s; want cues []", irec.Code, irec.Body.String())
	}

	orec := get(t, demo, "/api/moments?scenario=calm-midfield", nil)
	if orec.Code != http.StatusOK || !bytes.Contains(orec.Body.Bytes(), []byte(`"moments":[]`)) {
		t.Errorf("/api/moments: %d %s; want moments []", orec.Code, orec.Body.String())
	}
	if o := decode[apiMoments](t, orec); o.MatchID != calm.Match.ID || o.TrackingMetrics != trackmetrics.TrackingSupported {
		t.Errorf("/api/moments matchId %q trackingMetrics %q", o.MatchID, o.TrackingMetrics)
	}
}

// grid=1 adds a row-major cols*rows team-A control grid per tick.
func TestMetricsAPI_Grid(t *testing.T) {
	demo, all := apiScenarios(t)
	p := trackmetrics.DefaultParams()
	rec := get(t, demo, "/api/metrics?scenario=late-siege&grid=1", nil)
	m := decode[apiMetrics](t, rec)
	if m.GridLayout == nil || m.GridLayout.Order != "row-major" || m.GridLayout.Cols != p.Grid.Cols ||
		m.GridLayout.Rows != p.Grid.Rows || m.GridLayout.TeamID != m.Teams[0] {
		t.Fatalf("gridLayout %+v teams %v", m.GridLayout, m.Teams)
	}
	res, err := trackmetrics.Compute(all["late-siege"], p)
	if err != nil {
		t.Fatal(err)
	}
	for k, tk := range *m.Ticks {
		g, ok := tk["grid"].([]any)
		if !ok || len(g) != p.Grid.Cols*p.Grid.Rows {
			t.Fatalf("tick %d grid %T len %d", k, tk["grid"], len(g))
		}
		s := res.Ticks[k].Surface
		for _, cell := range [][2]int{{0, 0}, {20, 0}, {0, 13}, {7, 5}, {20, 13}} {
			i, j := cell[0], cell[1]
			want := math.Round(s.Control[0][i*s.Rows+j]*1e4) / 1e4
			if got := g[j*p.Grid.Cols+i].(float64); got != want {
				t.Fatalf("tick %d cell (%d,%d): %v, want %v (row-major index j*cols+i)", k, i, j, got, want)
			}
		}
	}
	checkBodyStyle(t, "late-siege metrics grid", rec.Body.Bytes())
	plain := decode[apiMetrics](t, get(t, demo, "/api/metrics?scenario=late-siege", nil))
	if plain.GridLayout != nil {
		t.Error("gridLayout present without grid=1")
	}
	for k, tk := range *plain.Ticks {
		if _, ok := tk["grid"]; ok {
			t.Fatalf("tick %d has a grid without grid=1", k)
		}
	}
}

// gzip, ETag, Cache-Control and 304 revalidation.
func TestMetricsAPI_CachingHeadersAndGzip(t *testing.T) {
	demo, _ := apiScenarios(t)
	for _, path := range []string{"/api/metrics?scenario=late-siege", "/api/metrics?scenario=late-siege&grid=1", "/api/moments?scenario=late-siege"} {
		plain := get(t, demo, path, nil)
		zipped := get(t, demo, path, map[string]string{"Accept-Encoding": "gzip, deflate, br"})
		if plain.Code != http.StatusOK || zipped.Code != http.StatusOK {
			t.Fatalf("%s: %d / %d", path, plain.Code, zipped.Code)
		}
		if plain.Header().Get("Content-Encoding") != "" {
			t.Errorf("%s: identity response has Content-Encoding %q", path, plain.Header().Get("Content-Encoding"))
		}
		if zipped.Header().Get("Content-Encoding") != "gzip" || !strings.Contains(zipped.Header().Get("Vary"), "Accept-Encoding") {
			t.Errorf("%s: gzip response headers %v", path, zipped.Header())
		}
		zr, err := gzip.NewReader(bytes.NewReader(zipped.Body.Bytes()))
		if err != nil {
			t.Fatalf("%s: %v", path, err)
		}
		unzipped, err := io.ReadAll(zr)
		if err != nil || !bytes.Equal(unzipped, plain.Body.Bytes()) {
			t.Errorf("%s: gunzipped body differs from identity body (%v)", path, err)
		}
		if zipped.Body.Len() >= plain.Body.Len() {
			t.Errorf("%s: gzip %d bytes not smaller than raw %d", path, zipped.Body.Len(), plain.Body.Len())
		}
		if q0 := get(t, demo, path, map[string]string{"Accept-Encoding": "gzip;q=0"}); q0.Header().Get("Content-Encoding") != "" {
			t.Errorf("%s: gzip sent despite q=0", path)
		}

		etag := plain.Header().Get("ETag")
		if etag == "" || zipped.Header().Get("ETag") == "" || etag == zipped.Header().Get("ETag") {
			t.Errorf("%s: ETags %q / %q must be set and differ per encoding", path, etag, zipped.Header().Get("ETag"))
		}
		if again := get(t, demo, path, nil); again.Header().Get("ETag") != etag || !bytes.Equal(again.Body.Bytes(), plain.Body.Bytes()) {
			t.Errorf("%s: not deterministic across requests", path)
		}
		if cc := plain.Header().Get("Cache-Control"); !strings.Contains(cc, "max-age=") {
			t.Errorf("%s: Cache-Control %q", path, cc)
		}
		nm := get(t, demo, path, map[string]string{"If-None-Match": etag})
		if nm.Code != http.StatusNotModified || nm.Body.Len() != 0 || nm.Header().Get("ETag") != etag {
			t.Errorf("%s: If-None-Match gave %d with %d bytes", path, nm.Code, nm.Body.Len())
		}
	}
	m1 := get(t, demo, "/api/metrics?scenario=late-siege", nil).Header().Get("ETag")
	m2 := get(t, demo, "/api/metrics?scenario=calm-midfield", nil).Header().Get("ETag")
	g1 := get(t, demo, "/api/metrics?scenario=late-siege&grid=1", nil).Header().Get("ETag")
	if m1 == m2 || m1 == g1 {
		t.Errorf("ETags must differ per scenario and per grid: %q %q %q", m1, m2, g1)
	}
}

// Computed once per scenario, safe under concurrency (run with -race).
func TestMetricsAPI_ComputeOnceConcurrent(t *testing.T) {
	r, err := simulator.Load(filepath.Join("..", "..", "..", "..", "data", "scenarios", "late-siege.json"))
	if err != nil {
		t.Fatal(err)
	}
	api := newMetricsAPI("late-siege", r)
	paths := []string{"/api/metrics", "/api/metrics?grid=1", "/api/moments"}
	const workers = 24
	bodies := make([][]byte, workers)
	var wg sync.WaitGroup
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			path := paths[i%len(paths)]
			rec := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, path, nil)
			if strings.HasPrefix(path, "/api/moments") {
				api.serveMoments(rec, req)
			} else {
				api.serveMetrics(rec, req)
			}
			if rec.Code == http.StatusOK {
				bodies[i] = rec.Body.Bytes()
			}
		}(i)
	}
	wg.Wait()
	if n := api.computes.Load(); n != 1 {
		t.Fatalf("computed %d times, want exactly 1", n)
	}
	for i := range bodies {
		if bodies[i] == nil || !bytes.Equal(bodies[i], bodies[i%len(paths)]) {
			t.Fatalf("worker %d: body differs from worker %d (or not 200)", i, i%len(paths))
		}
	}
}
