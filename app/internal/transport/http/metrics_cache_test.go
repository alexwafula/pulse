package transporthttp

import (
	"bytes"
	"compress/gzip"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"testing"

	"github.com/alexwafula/pulse/app/internal/simulator"
)

// lateSiegeHandler serves late-siege with a metricsAPI the test can inspect.
func lateSiegeHandler(t *testing.T) (http.Handler, *metricsAPI) {
	t.Helper()
	replay, err := simulator.Load(filepath.Join("..", "..", "..", "..", "data", "scenarios", "late-siege.json"))
	if err != nil {
		t.Fatal(err)
	}
	tracking := newMetricsAPI("late-siege", replay)
	handler, err := scenarioHandler("late-siege", replay, filepath.Join("..", "..", "..", "web"), "", tracking)
	if err != nil {
		t.Fatal(err)
	}
	return handler, tracking
}

// The page reads the computed result only; encoding an API body is left to
// the first request for that body.
func TestPageRenderDoesNotEncodeAPIBodies(t *testing.T) {
	handler, tracking := lateSiegeHandler(t)
	for _, path := range []string{"/", "/experience", "/?locale=sw-KE", "/legacy"} {
		if rec := get(t, handler, path, map[string]string{"Accept-Encoding": "gzip"}); rec.Code != http.StatusOK {
			t.Fatalf("%s: status %d", path, rec.Code)
		}
	}
	if n := tracking.computes.Load(); n != 1 {
		t.Fatalf("page renders computed %d times, want 1", n)
	}
	if n := tracking.encodes.Load(); n != 0 {
		t.Fatalf("page renders encoded %d API bodies, want 0", n)
	}
	for i, path := range []string{"/api/metrics", "/api/metrics?grid=1", "/api/moments", "/api/metrics", "/api/metrics?grid=1", "/api/moments"} {
		if rec := get(t, handler, path, map[string]string{"Accept-Encoding": "gzip"}); rec.Code != http.StatusOK {
			t.Fatalf("%s: status %d", path, rec.Code)
		}
		want := int32(min(i+1, 3))
		if n := tracking.encodes.Load(); n != want {
			t.Fatalf("after %d API requests (last %s): %d bodies encoded, want %d", i+1, path, n, want)
		}
	}
	if n := tracking.computes.Load(); n != 1 {
		t.Fatalf("computed %d times, want 1", n)
	}
}

// Every API body is byte-identical to what main fcf275a served, raw and
// gzipped at the same level, with the same ETags and lengths.
func TestMetricsAPIBodiesMatchMain(t *testing.T) {
	raw, err := os.ReadFile(filepath.Join("..", "..", "..", "testdata", "metrics", "api-bodies-fcf275a.json"))
	if err != nil {
		t.Fatal(err)
	}
	var golden struct {
		Bodies map[string]struct {
			SHA256 string `json:"sha256"`
			Length int    `json:"length"`
		} `json:"bodies"`
	}
	if err := json.Unmarshal(raw, &golden); err != nil {
		t.Fatal(err)
	}
	if len(golden.Bodies) != 9 {
		t.Fatalf("golden has %d bodies, want 9", len(golden.Bodies))
	}
	demo, _ := apiScenarios(t)
	// Render the page first so the cache is filled by the page path, then by the API.
	for _, scenario := range []string{"corner", "late-siege", "calm-midfield"} {
		get(t, demo, "/?scenario="+scenario, nil)
	}
	for path, want := range golden.Bodies {
		identity := get(t, demo, path, nil)
		body := identity.Body.Bytes()
		sum := sha256.Sum256(body)
		if hex.EncodeToString(sum[:]) != want.SHA256 || len(body) != want.Length {
			t.Errorf("%s: %d bytes sha256 %x, main served %d bytes %s", path, len(body), sum, want.Length, want.SHA256)
			continue
		}
		if etag := `"` + hex.EncodeToString(sum[:16]) + `"`; identity.Header().Get("ETag") != etag || identity.Header().Get("Content-Length") != strconv.Itoa(len(body)) {
			t.Errorf("%s: ETag %q Content-Length %q", path, identity.Header().Get("ETag"), identity.Header().Get("Content-Length"))
		}
		zipped := get(t, demo, path, map[string]string{"Accept-Encoding": "gzip"})
		var level bytes.Buffer
		zw, _ := gzip.NewWriterLevel(&level, gzip.BestCompression)
		zw.Write(body)
		zw.Close()
		if !bytes.Equal(zipped.Body.Bytes(), level.Bytes()) {
			t.Errorf("%s: gzip body is not BestCompression of the raw body", path)
		}
		zr, err := gzip.NewReader(bytes.NewReader(zipped.Body.Bytes()))
		if err != nil {
			t.Fatalf("%s: %v", path, err)
		}
		if unzipped, _ := io.ReadAll(zr); !bytes.Equal(unzipped, body) {
			t.Errorf("%s: gzip body does not decompress to the raw body", path)
		}
	}
}
