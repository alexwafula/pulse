package transporthttp

import (
	"bytes"
	"compress/gzip"
	"crypto/sha256"
	"fmt"
	"io"
	"mime"
	"net/http"
	"path"
	"strconv"
	"strings"
	"sync"
	"time"
)

type staticAsset struct {
	modified time.Time
	size     int64
	plain    []byte
	zipped   []byte
	etag     string
	gzipETag string
}

// Unfingerprinted asset URLs must revalidate across releases, not stay immutable.
func staticAssets(root string) http.Handler {
	files := http.Dir(root)
	var mutex sync.Mutex
	cache := make(map[string]*staticAsset)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		name := strings.TrimPrefix(r.URL.Path, "/")
		if name == "" || strings.ContainsAny(name, "\\:\x00") || path.Clean(name) != name || strings.HasPrefix(name, "../") {
			http.NotFound(w, r)
			return
		}
		file, err := files.Open(name)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		defer file.Close()
		info, err := file.Stat()
		if err != nil || info.IsDir() {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Cache-Control", "public, max-age=0, must-revalidate")
		if info.Size() > 16<<20 {
			http.ServeContent(w, r, info.Name(), info.ModTime(), file)
			return
		}
		mutex.Lock()
		asset := cache[name]
		if asset == nil || asset.size != info.Size() || !asset.modified.Equal(info.ModTime()) {
			body, readErr := io.ReadAll(io.LimitReader(file, (16<<20)+1))
			if readErr != nil || len(body) > 16<<20 {
				mutex.Unlock()
				w.Header().Set("Cache-Control", "no-store")
				http.Error(w, "asset unavailable", http.StatusInternalServerError)
				return
			}
			asset = &staticAsset{modified: info.ModTime(), size: info.Size(), plain: body, etag: fmt.Sprintf(`"%x"`, sha256.Sum256(body))}
			switch strings.ToLower(path.Ext(name)) {
			case ".js", ".css", ".json", ".svg", ".txt":
				var zipped bytes.Buffer
				writer, _ := gzip.NewWriterLevel(&zipped, gzip.BestSpeed)
				_, _ = writer.Write(body)
				_ = writer.Close()
				if zipped.Len() < len(body) {
					asset.zipped = zipped.Bytes()
					asset.gzipETag = fmt.Sprintf(`"%x"`, sha256.Sum256(asset.zipped))
				}
			}
			cache[name] = asset
		}
		mutex.Unlock()
		body, etag := asset.plain, asset.etag
		if len(asset.zipped) > 0 {
			w.Header().Add("Vary", "Accept-Encoding")
			if r.Header.Get("Range") == "" && acceptsGzip(r.Header.Get("Accept-Encoding")) {
				body, etag = asset.zipped, asset.gzipETag
				w.Header().Set("Content-Encoding", "gzip")
			}
		}
		w.Header().Set("ETag", etag)
		w.Header().Set("Content-Length", strconv.Itoa(len(body)))
		if contentType := mime.TypeByExtension(path.Ext(name)); contentType != "" {
			w.Header().Set("Content-Type", contentType)
		}
		http.ServeContent(w, r, info.Name(), asset.modified, bytes.NewReader(body))
	})
}
