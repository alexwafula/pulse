package transporthttp

import (
	"math"
	"strconv"
	"strings"
)

// estimateLabel is the canonical wording for model-derived values.
const estimateLabel = "model estimate, uncalibrated"

// indexHeadline is the hero's Control vs Chaos line (DIRECTION C1). It
// restates /api/metrics' own indexDelta for teams[0] and never computes one.
// app/web/src/index-headline.ts builds the same strings for later ticks; both
// are checked against app/testdata/hero/index-headline.json.
type indexHeadline struct {
	Key    string // catalog key for the line
	Team   string // the team whose index is higher; empty for a level line
	Value  string // headline magnitude at 2 dp
	Signed string // exact API value, + or U+2212; "N/A" without a value
	Label  string // "teams[0] − teams[1]" in API order; empty without a value
	Chip   string // canonical estimate label; empty without a value
}

// newIndexHeadline formats delta, teams[0]'s indexDelta, or reports no value.
// Intl.NumberFormat writes the same digits for en-GB, sw-KE and hi-IN (Latin
// digits, "." decimal; the shared golden checks every locale in both
// languages), so here locale changes only the catalog text, in heroFor.
func newIndexHeadline(delta *float64, teams []string, name func(string) string, supported bool) indexHeadline {
	if delta == nil || len(teams) != 2 {
		key := "Index difference"
		if !supported {
			key = "Tracking metrics unavailable"
		}
		return indexHeadline{Key: key, Signed: "N/A"}
	}
	out := indexHeadline{Key: "index.level", Signed: signedValue(*delta),
		Label: name(teams[0]) + " − " + name(teams[1]), Chip: estimateLabel}
	if hundredths := headlineHundredths(*delta); hundredths > 0 {
		out.Key, out.Value, out.Team = "index.higher", strconv.FormatFloat(float64(hundredths)/100, 'f', 2, 64), name(teams[0])
		if *delta < 0 {
			out.Team = name(teams[1])
		}
	}
	return out
}

// headlineHundredths is |delta| at 2 dp, halves away from zero. It rounds the
// API's 4-dp value in whole units, so float noise cannot move a half.
func headlineHundredths(delta float64) int64 {
	units := int64(math.Round(math.Abs(delta) * 1e4))
	return (units + 50) / 100
}

// signedValue is the exact value (shortest form, at least 4 dp) with + or
// U+2212, matching the label's minus; zero has no sign.
func signedValue(delta float64) string {
	digits := strconv.FormatFloat(math.Abs(delta), 'f', -1, 64)
	whole, fraction, _ := strings.Cut(digits, ".")
	if len(fraction) < 4 {
		fraction += strings.Repeat("0", 4-len(fraction))
	}
	digits = whole + "." + fraction
	switch {
	case delta > 0:
		return "+" + digits
	case delta < 0:
		return "−" + digits
	}
	return digits
}

// heroView is the hero as first painted, in the request's locale.
type heroView struct {
	Headline, Signed, Label, Chip string
	HasValue                      bool
}

// heroFor renders the hero at the replay start from tracking's served
// result. Without metrics it shows the same placeholder the script starts with.
func heroFor(tracking *metricsAPI, catalog uiCatalog, locale string) heroView {
	result, tick, err := tracking.startTick()
	var line indexHeadline
	if err != nil {
		line = newIndexHeadline(nil, nil, nil, true)
	} else {
		name := func(id string) string {
			for _, team := range tracking.replay.Match.Teams {
				if team.ID == id {
					return team.Name
				}
			}
			return id
		}
		var delta *float64
		if tick != nil && len(result.Teams) == 2 {
			if team, ok := tick.Teams[result.Teams[0]]; ok {
				delta = &team.IndexDelta
			}
		}
		line = newIndexHeadline(delta, result.Teams, name, result.TrackingMetrics == "supported")
	}
	view := heroView{Headline: catalog.text(locale, line.Key, map[string]string{"team": line.Team, "value": line.Value}),
		Signed: line.Signed, Label: line.Label, HasValue: line.Label != ""}
	if line.Chip != "" {
		view.Chip = catalog.text(locale, line.Chip, nil)
	}
	return view
}
