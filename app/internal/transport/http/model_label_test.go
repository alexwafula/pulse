package transporthttp

import (
	"encoding/json"
	"io"
	"net/http/httptest"
	"os"
	"regexp"
	"strings"
	"testing"

	"github.com/alexwafula/pulse/app/internal/simulator"
)

// canonicalModelLabel is the only wording allowed for model-derived values.
const canonicalModelLabel = "model estimate, uncalibrated"

// retiredModelLabel matches the wordings the canonical label replaced.
var retiredModelLabel = regexp.MustCompile(`(?i)\bexperimental\b|formation-sensitive|not calibrated|calibrated match probabilit|\bmodel estimates?\b`)

func modelLabelViolations(body string) []string {
	return retiredModelLabel.FindAllString(strings.ReplaceAll(body, canonicalModelLabel, ""), -1)
}

func TestModelLabelIsCanonicalInServedHTMLAndBundles(t *testing.T) {
	replay, _ := simulator.Load("../../../../data/samples/first-sequence.json")
	handler, err := NewDemoHandler(replay, "../../../web", "")
	if err != nil {
		t.Fatal(err)
	}
	paths := []string{"/", "/legacy", "/experience", "/?scenario=late-siege", "/legacy?scenario=late-siege",
		"/static/pitch.js", "/static/experience.js", "/static/three-renderer.js", "/static/pixi-renderer.js"}
	for _, locale := range []string{"en-GB", "sw-KE", "hi-IN"} {
		for _, panel := range []string{"story", "recap", "analytics"} {
			for _, scenario := range []string{"corner", "late-siege"} {
				paths = append(paths, "/experience/panel?scenario="+scenario+"&panel="+panel+"&atMs=5360000&locale="+locale,
					"/experience/panel?scenario="+scenario+"&panel="+panel+"&atMs=1678000&locale="+locale)
			}
		}
	}
	served := 0
	for _, path := range paths {
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, httptest.NewRequest("GET", path, nil))
		if response.Code == 400 {
			continue // atMs outside this scenario's replay window
		}
		if response.Code != 200 {
			t.Fatalf("%s: status %d", path, response.Code)
		}
		body, _ := io.ReadAll(response.Body)
		if found := modelLabelViolations(string(body)); len(found) > 0 {
			t.Errorf("%s: non-canonical model label wording %q", path, found)
		}
		served++
	}
	if served < 20 {
		t.Fatalf("only %d pages were scanned", served)
	}

	page := httptest.NewRecorder()
	handler.ServeHTTP(page, httptest.NewRequest("GET", "/?scenario=late-siege", nil))
	if !strings.Contains(page.Body.String(), canonicalModelLabel) {
		t.Fatal("the Control vs Chaos section does not show the canonical model label")
	}
}

// The label has one catalog key; each locale's wording for it is the only
// model-label wording in that locale.
func TestModelLabelHasOneCatalogKey(t *testing.T) {
	data, err := os.ReadFile("../../../web/static/locales.json")
	if err != nil {
		t.Fatal(err)
	}
	var catalog map[string]map[string]string
	if err := json.Unmarshal(data, &catalog); err != nil {
		t.Fatal(err)
	}
	for _, locale := range []string{"sw-KE", "hi-IN"} {
		label := catalog[locale][canonicalModelLabel]
		if label == "" {
			t.Fatalf("%s has no translation for the canonical model label", locale)
		}
		stem := strings.SplitN(label, ",", 2)[0]
		for key, value := range catalog[locale] {
			if key == canonicalModelLabel {
				continue
			}
			if found := modelLabelViolations(key + "\n" + value); len(found) > 0 {
				t.Errorf("%s key %q uses non-canonical wording %q", locale, key, found)
			}
			if strings.Contains(value, stem) {
				t.Errorf("%s key %q repeats the model label outside its canonical key: %q", locale, key, value)
			}
		}
	}
}
