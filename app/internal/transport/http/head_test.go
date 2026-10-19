package transporthttp

import (
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"regexp"
	"testing"
)

// headHeaders must match between GET and HEAD for the same request.
// Content-Length is compared as a list, so "absent on GET" must also be absent on HEAD.
var headHeaders = []string{"Content-Type", "Content-Encoding", "Content-Length", "ETag", "Cache-Control", "Vary"}

func wireRequest(t *testing.T, server *httptest.Server, method, path string, headers map[string]string) (*http.Response, []byte) {
	t.Helper()
	req, err := http.NewRequest(method, server.URL+path, nil)
	if err != nil {
		t.Fatal(err)
	}
	for key, value := range headers {
		req.Header.Set(key, value)
	}
	client := &http.Client{Transport: &http.Transport{DisableCompression: true}}
	resp, err := client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	return resp, body
}

// experiencePanelPath copies the hidden inputs the homepage form sends with hx-include.
func experiencePanelPath(t *testing.T, server *httptest.Server) string {
	t.Helper()
	_, page := wireRequest(t, server, http.MethodGet, "/", nil)
	form := regexp.MustCompile(`(?s)<form id="experience-inputs">(.*?)</form>`).FindSubmatch(page)
	if form == nil {
		t.Fatal("homepage has no #experience-inputs form")
	}
	query := url.Values{}
	for _, input := range regexp.MustCompile(`<input type="hidden" name="([^"]+)" value="([^"]*)">`).FindAllSubmatch(form[1], -1) {
		query.Set(string(input[1]), string(input[2]))
	}
	if query.Get("panel") == "" || query.Get("atMs") == "" {
		t.Fatalf("#experience-inputs lacks panel/atMs: %v", query)
	}
	return "/experience/panel?" + query.Encode()
}

func TestHeadMatchesGet(t *testing.T) {
	server := httptest.NewServer(versionTestHandler(t))
	defer server.Close()
	// The six GET/HEAD routes by name, plus one static asset that already allowed HEAD.
	routes := []struct{ name, path string }{
		{"/", "/"},
		{"/experience", "/experience"},
		{"/legacy", "/legacy"},
		{"/healthz", "/healthz"},
		{"/version", "/version"},
		{"/experience/panel", experiencePanelPath(t, server)},
		{"/static/pitch.css", "/static/pitch.css"},
	}
	for _, route := range routes {
		path := route.path
		for _, encoding := range []string{"", "gzip"} {
			headers := map[string]string{}
			if encoding != "" {
				headers["Accept-Encoding"] = encoding
			}
			get, _ := wireRequest(t, server, http.MethodGet, path, headers)
			head, body := wireRequest(t, server, http.MethodHead, path, headers)
			if get.StatusCode != http.StatusOK {
				t.Fatalf("GET %s (%q): status %d", path, encoding, get.StatusCode)
			}
			if head.StatusCode != get.StatusCode {
				t.Errorf("HEAD %s (%q): status %d; GET %d", path, encoding, head.StatusCode, get.StatusCode)
				continue
			}
			if len(body) != 0 {
				t.Errorf("HEAD %s (%q): %d-byte body", path, encoding, len(body))
			}
			for _, name := range headHeaders {
				if got, want := head.Header.Values(name), get.Header.Values(name); !equalStrings(got, want) {
					t.Errorf("HEAD %s (%q): %s %q; GET %q", path, encoding, name, got, want)
				}
			}
		}
	}
}

func equalStrings(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func TestHTMLPagesRevalidate(t *testing.T) {
	server := httptest.NewServer(versionTestHandler(t))
	defer server.Close()
	for _, path := range []string{"/", "/experience"} {
		for _, encoding := range []string{"", "gzip"} {
			resp, _ := wireRequest(t, server, http.MethodGet, path, map[string]string{"Accept-Encoding": encoding})
			if got := resp.Header.Get("Cache-Control"); got != "no-cache" {
				t.Errorf("GET %s (%q): Cache-Control %q; want no-cache", path, encoding, got)
			}
			if encoding == "gzip" && resp.Header.Get("Content-Encoding") == "gzip" && resp.Header.Get("Vary") != "Accept-Encoding" {
				t.Errorf("GET %s: gzipped without Vary: Accept-Encoding", path)
			}
		}
	}
}

func TestHeadConditionalStaticAsset(t *testing.T) {
	server := httptest.NewServer(versionTestHandler(t))
	defer server.Close()
	for _, encoding := range []string{"", "gzip"} {
		get, _ := wireRequest(t, server, http.MethodGet, "/static/pitch.css", map[string]string{"Accept-Encoding": encoding})
		etag := get.Header.Get("ETag")
		if etag == "" {
			t.Fatalf("GET /static/pitch.css (%q): no ETag", encoding)
		}
		head, body := wireRequest(t, server, http.MethodHead, "/static/pitch.css", map[string]string{"Accept-Encoding": encoding, "If-None-Match": etag})
		if head.StatusCode != http.StatusNotModified || len(body) != 0 {
			t.Errorf("HEAD /static/pitch.css (%q) If-None-Match: status %d, %d bytes; want 304", encoding, head.StatusCode, len(body))
		}
		if got := head.Header.Get("ETag"); got != etag {
			t.Errorf("HEAD /static/pitch.css (%q) 304: ETag %q; want %q", encoding, got, etag)
		}
		if got, want := head.Header.Get("Cache-Control"), "public, max-age=0, must-revalidate"; got != want {
			t.Errorf("HEAD /static/pitch.css (%q) 304: Cache-Control %q; want %q", encoding, got, want)
		}
	}
}

func TestPostHomepageStillRejected(t *testing.T) {
	server := httptest.NewServer(versionTestHandler(t))
	defer server.Close()
	resp, _ := wireRequest(t, server, http.MethodPost, "/", nil)
	if resp.StatusCode != http.StatusMethodNotAllowed {
		t.Fatalf("POST /: status %d; want 405", resp.StatusCode)
	}
	if got := resp.Header.Get("Allow"); got != "GET, HEAD" {
		t.Errorf("POST /: Allow %q; want \"GET, HEAD\"", got)
	}
}

// /api/* is out of scope: HEAD on insights keeps main's 405 with Allow: GET.
func TestHeadInsightsUnchanged(t *testing.T) {
	server := httptest.NewServer(versionTestHandler(t))
	defer server.Close()
	resp, _ := wireRequest(t, server, http.MethodHead, "/api/insights", nil)
	if resp.StatusCode != http.StatusMethodNotAllowed || resp.Header.Get("Allow") != "GET" {
		t.Fatalf("HEAD /api/insights: status %d Allow %q; want 405 Allow \"GET\"", resp.StatusCode, resp.Header.Get("Allow"))
	}
}
