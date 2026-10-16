package transporthttp

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/alexwafula/pulse/app/internal/buildinfo"
	"github.com/alexwafula/pulse/app/internal/simulator"
)

func versionTestHandler(t *testing.T) http.Handler {
	t.Helper()
	replay, err := simulator.Load("../../../../data/samples/first-sequence.json")
	if err != nil {
		t.Fatal(err)
	}
	handler, err := NewDemoHandler(replay, "../../../web", "")
	if err != nil {
		t.Fatal(err)
	}
	return handler
}

// setBuild injects build values as -ldflags would and restores them afterwards.
func setBuild(t *testing.T, sha, builtAt, ref string) {
	t.Helper()
	old := [3]string{buildinfo.SHA, buildinfo.BuiltAt, buildinfo.Ref}
	buildinfo.SHA, buildinfo.BuiltAt, buildinfo.Ref = sha, builtAt, ref
	t.Cleanup(func() { buildinfo.SHA, buildinfo.BuiltAt, buildinfo.Ref = old[0], old[1], old[2] })
}

func TestVersionEndpoint(t *testing.T) {
	for _, test := range []struct {
		name, sha, builtAt, ref string
		want                    map[string]string
	}{
		{"local build without ldflags", "", "", "", map[string]string{
			"sha": "unknown", "shortSha": "unknown", "builtAt": "unknown", "ref": "unknown"}},
		{"release build", "0123456789abcdef0123456789abcdef01234567", "2026-10-16T12:00:00Z", "refs/heads/main", map[string]string{
			"sha": "0123456789abcdef0123456789abcdef01234567", "shortSha": "0123456", "builtAt": "2026-10-16T12:00:00Z", "ref": "refs/heads/main"}},
	} {
		t.Run(test.name, func(t *testing.T) {
			setBuild(t, test.sha, test.builtAt, test.ref)
			handler := versionTestHandler(t)
			// An unknown scenario must not turn /version into a scenario 404.
			for _, path := range []string{"/version", "/version?scenario=nope"} {
				rec := httptest.NewRecorder()
				handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
				if rec.Code != http.StatusOK || rec.Header().Get("Location") != "" {
					t.Fatalf("%s: status %d location %q; want 200 with no redirect", path, rec.Code, rec.Header().Get("Location"))
				}
				if got := rec.Header().Get("Cache-Control"); got != "no-store" {
					t.Fatalf("%s: Cache-Control %q; want no-store", path, got)
				}
				if !strings.HasPrefix(rec.Header().Get("Content-Type"), "application/json") {
					t.Fatalf("%s: Content-Type %q", path, rec.Header().Get("Content-Type"))
				}
				var body map[string]string
				if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
					t.Fatalf("%s: invalid JSON %q: %v", path, rec.Body.String(), err)
				}
				if len(body) != len(test.want) {
					t.Fatalf("%s: fields %v; want exactly %v", path, body, test.want)
				}
				for key, want := range test.want {
					if body[key] != want {
						t.Fatalf("%s: %s = %q; want %q", path, key, body[key], want)
					}
				}
			}
			post := httptest.NewRecorder()
			handler.ServeHTTP(post, httptest.NewRequest(http.MethodPost, "/version", nil))
			if post.Code != http.StatusMethodNotAllowed || post.Header().Get("Allow") != http.MethodGet {
				t.Fatalf("POST /version: status %d Allow %q", post.Code, post.Header().Get("Allow"))
			}
		})
	}
}

func TestBuildHeaderOnEveryResponse(t *testing.T) {
	for _, test := range []struct{ sha, short string }{
		{"", "unknown"},
		{"fedcba9876543210fedcba9876543210fedcba98", "fedcba9"},
	} {
		setBuild(t, test.sha, "", "")
		handler := versionTestHandler(t)
		for _, request := range []struct{ method, path string }{
			{http.MethodGet, "/"},
			{http.MethodGet, "/experience"},
			{http.MethodGet, "/legacy"},
			{http.MethodGet, "/healthz"},
			{http.MethodGet, "/version"},
			{http.MethodGet, "/scenarios"},
			{http.MethodGet, "/api/replay?scenario=corner"},
			{http.MethodGet, "/api/metrics?scenario=late-siege"},
			{http.MethodGet, "/static/pitch.js"},
			{http.MethodGet, "/experience/panel"},
			{http.MethodGet, "/no-such-page"},
			{http.MethodGet, "/?scenario=nope"},
			{http.MethodPost, "/api/replay"},
		} {
			rec := httptest.NewRecorder()
			req := httptest.NewRequest(request.method, request.path, nil)
			req.Header.Set("Accept-Encoding", "gzip")
			handler.ServeHTTP(rec, req)
			if got := rec.Header().Get("X-Pulse-Build"); got != test.short {
				t.Fatalf("%s %s (status %d): X-Pulse-Build %q; want %q", request.method, request.path, rec.Code, got, test.short)
			}
		}
	}
}

func TestPageRendersBuildLabel(t *testing.T) {
	setBuild(t, "0123456789abcdef0123456789abcdef01234567", "", "")
	handler := versionTestHandler(t)
	for _, path := range []string{"/", "/legacy"} {
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		if !strings.Contains(rec.Body.String(), `id="build-label" data-build="0123456"`) || !strings.Contains(rec.Body.String(), ">build 0123456<") {
			t.Fatalf("%s: build label missing or wrong", path)
		}
	}
}
