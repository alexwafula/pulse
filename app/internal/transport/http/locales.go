package transporthttp

import (
	"encoding/json"
	"os"
	"strings"
)

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
