package transporthttp

import (
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"

	"github.com/alexwafula/pulse/app/internal/simulator"
)

func TestPageCopy(t *testing.T) {
	replay, _ := simulator.Load("../../../../data/samples/first-sequence.json")
	handler, err := NewDemoHandler(replay, "../../../web", "")
	if err != nil {
		t.Fatal(err)
	}
	wrongPlural := regexp.MustCompile(`\b1 passes sent\b`)
	singular := 0
	for _, scenario := range []string{"corner", "central", "exchange", "late-siege", "calm-midfield"} {
		for _, path := range []string{"/?scenario=" + scenario, "/legacy?scenario=" + scenario} {
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, httptest.NewRequest("GET", path, nil))
			body := response.Body.String()
			if response.Code != 200 {
				t.Fatalf("%s: status %d", path, response.Code)
			}
			if wrongPlural.MatchString(body) {
				t.Errorf("%s: says \"1 passes sent\"", path)
			}
			singular += strings.Count(body, "1 pass sent")
			if strings.HasPrefix(path, "/legacy") {
				continue // the experience nav, and its Legacy link, are not rendered on /legacy
			}
			link := regexp.MustCompile(`<a class="dashboard-link"[^>]*>`).FindString(body)
			if !strings.Contains(link, `href="/legacy?scenario=`+scenario+`"`) || !strings.Contains(link, " hidden") ||
				!strings.Contains(link, `title="Open the original view"`) || strings.Contains(strings.ToLower(link), "dashboard\"") {
				t.Errorf("%s: Legacy nav link must be hidden, keep its /legacy href and not call it a dashboard: %s", path, link)
			}
		}
	}
	if singular == 0 {
		t.Fatal("no passing node with exactly one pass sent was rendered; the plural check is vacuous")
	}
	legacy := httptest.NewRecorder()
	handler.ServeHTTP(legacy, httptest.NewRequest("GET", "/legacy?scenario=corner", nil))
	if legacy.Code != 200 {
		t.Fatalf("/legacy route must stay: status %d", legacy.Code)
	}
}
