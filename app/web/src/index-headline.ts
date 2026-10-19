// The hero's Control vs Chaos line (DIRECTION C1). It restates the API's own
// indexDelta and never computes one: `delta` is teams[0]'s indexDelta, which
// /api/metrics defines as teams[0]'s index minus teams[1]'s. The server paints
// the first line with the same rules (index_headline.go); both are checked
// against app/testdata/hero/index-headline.json. Free of the DOM so it can be
// unit tested; the caller translates `headline` with t().

export const MODEL_LABEL = "model estimate, uncalibrated";

export type IndexHeadline = {
  /** A catalog key and its values. */
  headline: { key: string; values: Record<string, string> };
  /** The exact API value with + or U+2212, or "N/A". */
  signed: string;
  /** "teams[0] − teams[1]" in the API's order; empty without a value. */
  label: string;
  /** The canonical estimate label; empty without a value. */
  chip: string;
};

const MINUS = "−";

/** |delta| at 2 dp, halves away from zero, rounded in the API's 4-dp units so float noise cannot move a half. */
function hundredths(delta: number): number {
  return Math.floor((Math.round(Math.abs(delta) * 1e4) + 50) / 100);
}

export function indexHeadline(delta: number | null, teams: readonly [string, string], name: (teamId: string) => string, locale: string, supported = true): IndexHeadline {
  if (delta === null) return { headline: { key: supported ? "Index difference" : "Tracking metrics unavailable", values: {} }, signed: "N/A", label: "", chip: "" };
  const [first, second] = teams;
  // Intl writes U+002D for minus in these locales; the label uses U+2212.
  const signed = new Intl.NumberFormat(locale, { minimumFractionDigits: 4, maximumFractionDigits: 20, signDisplay: "exceptZero" })
    .format(delta).replace("-", MINUS);
  const rounded = hundredths(delta);
  const headline: IndexHeadline["headline"] = rounded === 0 ? { key: "index.level", values: {} } : {
    key: "index.higher",
    values: { team: name(delta > 0 ? first : second), value: new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(rounded / 100) },
  };
  return { headline, signed, label: `${name(first)} − ${name(second)}`, chip: MODEL_LABEL };
}
