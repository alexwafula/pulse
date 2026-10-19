package transporthttp

import (
	"bytes"
	"compress/gzip"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
)

// htmlRoutes pins each HTML route to its Cache-Control; compression must not
// change it. The homepage and /experience revalidate; /legacy is unchanged.
var htmlRoutes = []struct{ path, cacheControl string }{
	{"/", "no-cache"},
	{"/experience", "no-cache"},
	{"/legacy", ""},
	{"/?scenario=corner", "no-cache"},
	{"/scenarios", "no-store"},
	{"/experience/panel?panel=story&atMs=5300000&scenario=late-siege", "no-store"},
	{"/experience/panel?panel=recap&atMs=5300000&scenario=late-siege", "no-store"},
	{"/experience/panel?panel=analytics&atMs=5300000&scenario=late-siege", "no-store"},
}

func gunzip(t *testing.T, path string, body []byte) []byte {
	t.Helper()
	reader, err := gzip.NewReader(bytes.NewReader(body))
	if err != nil {
		t.Fatalf("%s: not gzip: %v", path, err)
	}
	defer reader.Close()
	plain, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("%s: corrupt gzip: %v", path, err)
	}
	return plain
}

func checkContentLength(t *testing.T, label string, rec *httptest.ResponseRecorder) {
	t.Helper()
	if got := rec.Header().Get("Content-Length"); got != "" && got != strconv.Itoa(rec.Body.Len()) {
		t.Errorf("%s: Content-Length %s for a %d-byte body", label, got, rec.Body.Len())
	}
}

func TestHTMLGzipNegotiation(t *testing.T) {
	setBuild(t, "0123456789abcdef0123456789abcdef01234567", "", "")
	handler := versionTestHandler(t)
	for _, route := range htmlRoutes {
		plain := get(t, handler, route.path, nil)
		if plain.Code != http.StatusOK || plain.Body.Len() == 0 {
			t.Fatalf("%s: status %d, %d bytes", route.path, plain.Code, plain.Body.Len())
		}
		if plain.Header().Get("Content-Encoding") != "" {
			t.Errorf("%s: compressed without Accept-Encoding", route.path)
		}
		again := get(t, handler, route.path, nil)
		if !bytes.Equal(plain.Body.Bytes(), again.Body.Bytes()) {
			t.Fatalf("%s: page is not deterministic; byte comparison is meaningless", route.path)
		}
		checkContentLength(t, route.path+" plain", plain)
		for _, encoding := range []string{"gzip", "gzip, deflate, br", "br, gzip;q=0.5", "*"} {
			zipped := get(t, handler, route.path, map[string]string{"Accept-Encoding": encoding})
			label := route.path + " with " + strconv.Quote(encoding)
			if zipped.Code != http.StatusOK || zipped.Header().Get("Content-Encoding") != "gzip" || zipped.Header().Get("Vary") != "Accept-Encoding" {
				t.Fatalf("%s: status %d, headers %v", label, zipped.Code, zipped.Header())
			}
			if zipped.Body.Len() >= plain.Body.Len() {
				t.Errorf("%s: gzip %d bytes not smaller than %d", label, zipped.Body.Len(), plain.Body.Len())
			}
			if !bytes.Equal(gunzip(t, label, zipped.Body.Bytes()), plain.Body.Bytes()) {
				t.Fatalf("%s: decompressed body differs from the plain response", label)
			}
			checkContentLength(t, label, zipped)
			for _, name := range []string{"Cache-Control", "Content-Type", "X-Pulse-Build"} {
				if zipped.Header().Get(name) != plain.Header().Get(name) {
					t.Errorf("%s: %s %q, plain %q", label, name, zipped.Header().Get(name), plain.Header().Get(name))
				}
			}
			if got := zipped.Header().Get("Cache-Control"); got != route.cacheControl {
				t.Errorf("%s: Cache-Control %q; want %q", label, got, route.cacheControl)
			}
			if zipped.Header().Get("X-Pulse-Build") != "0123456" {
				t.Errorf("%s: X-Pulse-Build missing", label)
			}
		}
		for _, encoding := range []string{"gzip;q=0", "*;q=1, gzip;q=0", "br", "identity"} {
			rec := get(t, handler, route.path, map[string]string{"Accept-Encoding": encoding})
			if rec.Header().Get("Content-Encoding") != "" || !bytes.Equal(rec.Body.Bytes(), plain.Body.Bytes()) {
				t.Errorf("%s: ignored refusal %q", route.path, encoding)
			}
		}
	}
}

// htmx swaps send HX-Request; the partial must still decode to the same HTML.
func TestHTMXPartialsCompressed(t *testing.T) {
	handler := versionTestHandler(t)
	htmx := map[string]string{"HX-Request": "true", "HX-Target": "experience-panel", "HX-Current-URL": "http://127.0.0.1/"}
	for _, route := range htmlRoutes[5:] {
		plain := get(t, handler, route.path, htmx)
		headers := map[string]string{"Accept-Encoding": "gzip, deflate, br"}
		for k, v := range htmx {
			headers[k] = v
		}
		zipped := get(t, handler, route.path, headers)
		if plain.Code != http.StatusOK || zipped.Code != http.StatusOK || zipped.Header().Get("Content-Encoding") != "gzip" {
			t.Fatalf("%s: htmx partial status %d/%d, encoding %q", route.path, plain.Code, zipped.Code, zipped.Header().Get("Content-Encoding"))
		}
		if !bytes.Equal(gunzip(t, route.path, zipped.Body.Bytes()), plain.Body.Bytes()) {
			t.Fatalf("%s: htmx partial changed by compression", route.path)
		}
		if zipped.Header().Get("Cache-Control") != "no-store" {
			t.Errorf("%s: htmx partial Cache-Control %q", route.path, zipped.Header().Get("Cache-Control"))
		}
	}
}

// The recorder only shows headers handlers set; a real server shows what the
// wire carries, including any Content-Length net/http adds itself.
func TestHTMLContentLengthOnWire(t *testing.T) {
	server := httptest.NewServer(versionTestHandler(t))
	defer server.Close()
	client := &http.Client{Transport: &http.Transport{DisableCompression: true}}
	for _, route := range append(htmlRoutes, struct{ path, cacheControl string }{"/version", "no-store"}) {
		for _, encoding := range []string{"", "gzip"} {
			req, err := http.NewRequest(http.MethodGet, server.URL+route.path, nil)
			if err != nil {
				t.Fatal(err)
			}
			if encoding != "" {
				req.Header.Set("Accept-Encoding", encoding)
			}
			resp, err := client.Do(req)
			if err != nil {
				t.Fatal(err)
			}
			body, err := io.ReadAll(resp.Body)
			resp.Body.Close()
			if err != nil {
				t.Fatal(err)
			}
			if resp.ContentLength != -1 && resp.ContentLength != int64(len(body)) {
				t.Errorf("%s (%q): Content-Length %d for %d bytes on the wire", route.path, encoding, resp.ContentLength, len(body))
			}
			if got := resp.Header.Get("Cache-Control"); got != route.cacheControl {
				t.Errorf("%s (%q): Cache-Control %q; want %q", route.path, encoding, got, route.cacheControl)
			}
			if resp.Header.Get("X-Pulse-Build") == "" {
				t.Errorf("%s (%q): X-Pulse-Build missing", route.path, encoding)
			}
		}
	}
}

// Errors and non-HTML routes keep their existing, uncompressed responses.
func TestHTMLCompressionLeavesOtherResponsesAlone(t *testing.T) {
	handler := versionTestHandler(t)
	gz := map[string]string{"Accept-Encoding": "gzip"}
	for _, path := range []string{
		"/version", "/healthz", "/no-such-page", "/?scenario=nope",
		"/experience/panel?panel=bogus&atMs=5300000&scenario=late-siege",
		"/experience/panel?panel=story&atMs=0&scenario=late-siege",
	} {
		rec := get(t, handler, path, gz)
		if rec.Header().Get("Content-Encoding") != "" {
			t.Errorf("%s (status %d): unexpectedly compressed", path, rec.Code)
		}
	}
	if got := get(t, handler, "/version", gz).Header().Get("Cache-Control"); got != "no-store" {
		t.Errorf("/version Cache-Control %q; want no-store", got)
	}
	post := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/scenarios", nil)
	req.Header.Set("Accept-Encoding", "gzip")
	handler.ServeHTTP(post, req)
	if post.Code != http.StatusMethodNotAllowed || post.Header().Get("Content-Encoding") != "" {
		t.Errorf("POST /scenarios: status %d, encoding %q", post.Code, post.Header().Get("Content-Encoding"))
	}
}
