# 0025: Gzip HTML pages and panels

Date: 2026-10-18
Status: Implemented on review branch; teammate review pending

## Decision

The buffered gzip middleware from decision 0011 (`compression.go`, renamed
`gzipResponses`) now also covers `/`, `/experience`, `/legacy`,
`/experience/panel` and `/scenarios`, and compresses `text/html` as well as
`application/json`. `/scenarios` is served outside the per-scenario mux, so
`NewDemoHandler` wraps the library handler with the same middleware.

Behaviour is unchanged otherwise:

- Only `200` responses with a body are compressed. Errors, `/version`,
  `/healthz` and unknown paths stay plain.
- `Vary: Accept-Encoding` is sent on every response from a listed path, and
  `gzip;q=0` or a gzip-free `Accept-Encoding` gets the plain body.
- Cache-Control is untouched: the pages send none, while `/scenarios`, the
  panels and `/version` stay `no-store`. `X-Pulse-Build` is still set.
- `Content-Length` is the compressed length.
- htmx requests (`HX-Request`) get the same body as other requests, so
  partials compress the same way.
- `/static/*` keeps its own cached gzip and ETags from decision 0023.
  Metrics/moments keep theirs from decision 0011, so nothing is compressed
  twice.

The pages are rendered per request and not cached. Compression uses
`gzip.BestSpeed`, the same level as the JSON routes.

## Evidence

Local server, `curl --compressed -w '%{size_download}'`, bytes transferred:

| Route | Before | After |
|---|---:|---:|
| `/` | 272,401 | 22,936 |
| `/experience` | 272,401 | 22,936 |
| `/legacy` | 64,145 | 9,355 |
| `/scenarios` | 13,262 | 1,552 |
| `/experience/panel?panel=story&atMs=5300000&scenario=late-siege` | 2,346 | 579 |
| `/experience/panel?panel=analytics&atMs=5300000&scenario=late-siege` | 28,439 | 4,966 |

Trade-off, measured on loopback with 50 requests to `/`: total time is
unchanged (median 26.9 ms plain vs 25.2 ms gzip), but time to first byte
rises from 1.5 ms to 29.5 ms. The plain response streams while the template
renders; the gzip path buffers the whole render first. Over a real network
the 91% smaller body should outweigh this. That is not measured here.

`/api/*` was already compressed and is unchanged. For example,
`/api/replay?scenario=late-siege` is 37,922 bytes before and after.

Go tests in `html_compression_test.go` cover negotiation, byte-identical
decompression, refusals, unchanged headers, htmx partials, the Content-Length
on a real server, and uncompressed error responses.
