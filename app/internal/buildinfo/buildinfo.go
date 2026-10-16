// Package buildinfo reports the source revision baked in at build time:
//
//	go build -ldflags "-X github.com/alexwafula/pulse/app/internal/buildinfo.SHA=<sha> \
//	  -X github.com/alexwafula/pulse/app/internal/buildinfo.BuiltAt=<RFC 3339 time> \
//	  -X github.com/alexwafula/pulse/app/internal/buildinfo.Ref=<git ref>"
//
// Local builds without these flags report "unknown" rather than failing.
package buildinfo

import "strings"

// Set only through -ldflags -X; tests may assign them directly.
var SHA, BuiltAt, Ref string

const unknown = "unknown"

type Info struct {
	SHA      string `json:"sha"`
	ShortSHA string `json:"shortSha"`
	BuiltAt  string `json:"builtAt"`
	Ref      string `json:"ref"`
}

func Current() Info {
	info := Info{SHA: value(SHA), BuiltAt: value(BuiltAt), Ref: value(Ref)}
	info.ShortSHA = info.SHA
	if info.SHA != unknown && len(info.SHA) > 7 {
		info.ShortSHA = info.SHA[:7]
	}
	return info
}

func value(text string) string {
	if text = strings.TrimSpace(text); text != "" {
		return text
	}
	return unknown
}
