package transporthttp

import (
	"bytes"
	"compress/gzip"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/alexwafula/pulse/app/internal/simulator"
)

func TestJSONGzipNegotiation(t *testing.T) {
	handler, _ := apiScenarios(t)
	for _, endpoint := range []string{"/api/replay", "/api/insights", "/api/fact-packs", "/api/metrics?grid=1", "/api/moments"} {
		path := endpoint
		if endpoint == "/api/metrics?grid=1" {
			path += "&scenario=late-siege"
		} else {
			path += "?scenario=late-siege"
		}
		plain := get(t, handler, path, nil)
		for _, encoding := range []string{"gzip", "br, gzip;q=0.5", "*;q=1"} {
			zipped := get(t, handler, path, map[string]string{"Accept-Encoding": encoding})
			if zipped.Code != 200 || zipped.Header().Get("Content-Encoding") != "gzip" || zipped.Header().Get("Vary") != "Accept-Encoding" {
				t.Fatalf("%s with %q: incorrect gzip headers/status", path, encoding)
			}
			reader, err := gzip.NewReader(bytes.NewReader(zipped.Body.Bytes()))
			if err != nil {
				t.Fatal(err)
			}
			body, err := io.ReadAll(reader)
			reader.Close()
			if err != nil || !bytes.Equal(body, plain.Body.Bytes()) {
				t.Fatalf("%s changed JSON or was double-compressed", path)
			}
		}
		for _, encoding := range []string{"gzip;q=0", "*;q=1, gzip;q=0", "br"} {
			rec := get(t, handler, path, map[string]string{"Accept-Encoding": encoding})
			if rec.Header().Get("Content-Encoding") != "" || !bytes.Equal(rec.Body.Bytes(), plain.Body.Bytes()) {
				t.Fatalf("%s ignored gzip refusal", path)
			}
		}
	}
	bad := get(t, handler, "/api/insights?persona=INVALID", map[string]string{"Accept-Encoding": "gzip"})
	if bad.Code != 400 || bad.Header().Get("Content-Encoding") != "" {
		t.Fatal("error response changed")
	}
	health := get(t, handler, "/healthz", map[string]string{"Accept-Encoding": "gzip"})
	if health.Header().Get("Content-Encoding") != "" {
		t.Fatal("non-JSON path was compressed")
	}
}

func BenchmarkReplayCompression(b *testing.B) {
	replay, err := simulator.Load("../../../../data/scenarios/late-siege.json")
	if err != nil {
		b.Fatal(err)
	}
	handler, err := NewHandler(replay, "../../../web")
	if err != nil {
		b.Fatal(err)
	}
	for _, encoding := range []string{"identity", "gzip"} {
		b.Run(encoding, func(b *testing.B) {
			b.ReportAllocs()
			for i := 0; i < b.N; i++ {
				req := httptest.NewRequest(http.MethodGet, "/api/replay", nil)
				req.Header.Set("Accept-Encoding", encoding)
				rec := httptest.NewRecorder()
				handler.ServeHTTP(rec, req)
				b.ReportMetric(float64(rec.Body.Len()), "bytes/response")
			}
		})
	}
}
