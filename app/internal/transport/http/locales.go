package transporthttp

import (
	"encoding/json"
	"net/http"
	"os"
	"strings"

	"github.com/alexwafula/pulse/app/internal/domain"
)

// requestLocale is the single locale allowlist for locale-aware endpoints:
// supported locales pass through and anything else, including a missing or
// garbage value, falls back to en-GB rather than failing the request.
func requestLocale(r *http.Request) string {
	if locale := r.URL.Query().Get("locale"); domain.SupportedLocale(locale) {
		return locale
	}
	return "en-GB"
}

type uiCatalog map[string]map[string]string

func loadUICatalog(path string) (uiCatalog, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var catalog uiCatalog
	err = json.Unmarshal(data, &catalog)
	return catalog, err
}

func (catalog uiCatalog) text(locale, key string, values map[string]string) string {
	text := catalog[locale][key]
	if text == "" {
		text = catalog["en-GB"][key]
	}
	if text == "" {
		text = key
	}
	for key, value := range values {
		text = strings.ReplaceAll(text, "{"+key+"}", value)
	}
	return text
}
