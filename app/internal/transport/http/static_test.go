package transporthttp

import (
	"bytes"
	"compress/gzip"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"testing"
	"time"
)

func TestStaticRevalidationAndCompression(t *testing.T) {
	root := t.TempDir()
	body := bytes.Repeat([]byte("const message = 'Pulse';\n"), 100)
	file := filepath.Join(root, "pitch.js")
	if err := os.WriteFile(file, body, 0600); err != nil {
		t.Fatal(err)
	}
	handler := staticAssets(root)
	request := func(method, path string, headers map[string]string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, nil)
		for key, value := range headers {
			req.Header.Set(key, value)
		}
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		return rec
	}
	plain := request("GET", "/pitch.js", nil)
	if plain.Code != 200 || !bytes.Equal(plain.Body.Bytes(), body) || plain.Header().Get("ETag") == "" || plain.Header().Get("Last-Modified") == "" || plain.Header().Get("Cache-Control") != "public, max-age=0, must-revalidate" {
		t.Fatal("plain asset must support conditional revalidation")
	}
	for _, encoding := range []string{"gzip", "br, gzip;q=0.5", "*;q=1"} {
		zipped := request("GET", "/pitch.js", map[string]string{"Accept-Encoding": encoding})
		if zipped.Code != 200 || zipped.Header().Get("Content-Encoding") != "gzip" || zipped.Header().Get("Vary") != "Accept-Encoding" || zipped.Header().Get("ETag") == plain.Header().Get("ETag") {
			t.Fatal("compressed asset needs representation-specific validators")
		}
		reader, err := gzip.NewReader(zipped.Body)
		if err != nil {
			t.Fatal(err)
		}
		decoded, err := io.ReadAll(reader)
		reader.Close()
		if err != nil || !bytes.Equal(decoded, body) {
			t.Fatal("gzip changed the source asset")
		}
		cached := request("GET", "/pitch.js", map[string]string{"Accept-Encoding": encoding, "If-None-Match": zipped.Header().Get("ETag")})
		if cached.Code != 304 || cached.Body.Len() != 0 {
			t.Fatal("unchanged compressed asset was not revalidated")
		}
		head := request("HEAD", "/pitch.js", map[string]string{"Accept-Encoding": encoding})
		if head.Code != 200 || head.Body.Len() != 0 || head.Header().Get("Content-Encoding") != "gzip" || head.Header().Get("Content-Length") != strconv.Itoa(len(handlerBody(t, handler, encoding))) {
			t.Fatal("HEAD must describe the same compressed representation as GET")
		}
	}
	for _, encoding := range []string{"br", "gzip;q=0", "*;q=1, gzip;q=0"} {
		rec := request("GET", "/pitch.js", map[string]string{"Accept-Encoding": encoding})
		if rec.Header().Get("Content-Encoding") != "" || !bytes.Equal(rec.Body.Bytes(), body) {
			t.Fatal("gzip refusal was ignored")
		}
	}
	conditional := request("GET", "/pitch.js", map[string]string{"If-Modified-Since": plain.Header().Get("Last-Modified")})
	if conditional.Code != 304 {
		t.Fatal("Last-Modified must permit conditional requests")
	}
	ranged := request("GET", "/pitch.js", map[string]string{"Accept-Encoding": "gzip", "Range": "bytes=0-4"})
	if ranged.Code != 206 || ranged.Body.String() != "const" || ranged.Header().Get("Content-Encoding") != "" {
		t.Fatal("range requests must use identity bytes")
	}
	updated := bytes.Repeat([]byte("const message = 'Updated';\n"), 100)
	if err := os.WriteFile(file, updated, 0600); err != nil {
		t.Fatal(err)
	}
	future := time.Now().Add(2 * time.Second)
	if err := os.Chtimes(file, future, future); err != nil {
		t.Fatal(err)
	}
	changed := request("GET", "/pitch.js", map[string]string{"If-None-Match": plain.Header().Get("ETag")})
	if changed.Code != 200 || !bytes.Equal(changed.Body.Bytes(), updated) || changed.Header().Get("ETag") == plain.Header().Get("ETag") {
		t.Fatal("local asset edits must invalidate the cache")
	}
	for _, path := range []string{"/", "/missing.js", "/../secret", "/..\\secret"} {
		rec := request("GET", path, nil)
		if rec.Code != 404 || rec.Header().Get("Cache-Control") != "no-store" {
			t.Fatalf("%s must not expose or cache missing paths", path)
		}
	}
	if rec := request(http.MethodPost, "/pitch.js", nil); rec.Code != 405 || rec.Header().Get("Allow") != "GET, HEAD" {
		t.Fatal("static files accept GET and HEAD only")
	}
}

func handlerBody(t *testing.T, handler http.Handler, encoding string) []byte {
	t.Helper()
	req := httptest.NewRequest("GET", "/pitch.js", nil)
	req.Header.Set("Accept-Encoding", encoding)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec.Body.Bytes()
}
