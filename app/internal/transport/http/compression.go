package transporthttp

import (
	"bytes"
	"compress/gzip"
	"net/http"
	"strconv"
	"strings"
)

type bufferedResponse struct {
	header http.Header
	status int
	body   bytes.Buffer
}

func (w *bufferedResponse) Header() http.Header { return w.header }
func (w *bufferedResponse) WriteHeader(status int) {
	if w.status == 0 {
		w.status = status
	}
}
func (w *bufferedResponse) Write(body []byte) (int, error) {
	w.WriteHeader(http.StatusOK)
	return w.body.Write(body)
}

// Only these bounded JSON and HTML responses are buffered. Cached metrics
// encode themselves; static assets and future streaming endpoints are left alone.
func gzipResponses(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/replay", "/api/insights", "/api/fact-packs", "/", "/experience", "/legacy", "/experience/panel", "/scenarios":
		default:
			next.ServeHTTP(w, r)
			return
		}
		w.Header().Add("Vary", "Accept-Encoding")
		if r.Method != http.MethodGet || !acceptsGzip(r.Header.Get("Accept-Encoding")) {
			next.ServeHTTP(w, r)
			return
		}
		buffer := &bufferedResponse{header: make(http.Header)}
		next.ServeHTTP(buffer, r)
		for key, values := range buffer.header {
			w.Header()[key] = append([]string(nil), values...)
		}
		status := buffer.status
		if status == 0 {
			status = http.StatusOK
		}
		body := buffer.body.Bytes()
		contentType := buffer.header.Get("Content-Type")
		if status == http.StatusOK && len(body) > 0 && (strings.HasPrefix(contentType, "application/json") || strings.HasPrefix(contentType, "text/html")) && buffer.header.Get("Content-Encoding") == "" {
			var compressed bytes.Buffer
			writer, err := gzip.NewWriterLevel(&compressed, gzip.BestSpeed)
			if err != nil {
				http.Error(w, "compression unavailable", http.StatusInternalServerError)
				return
			}
			_, writeErr := writer.Write(body)
			closeErr := writer.Close()
			if writeErr != nil || closeErr != nil {
				http.Error(w, "compression unavailable", http.StatusInternalServerError)
				return
			}
			body = compressed.Bytes()
			w.Header().Set("Content-Encoding", "gzip")
			w.Header().Set("Content-Length", strconv.Itoa(len(body)))
		}
		w.WriteHeader(status)
		_, _ = w.Write(body)
	})
}
