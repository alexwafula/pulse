// The hero's Control vs Chaos line (DIRECTION C1). It restates the API's own
// indexDelta and never computes one: `delta` is teams[0]'s indexDelta, which
// /api/metrics defines as teams[0]'s index minus teams[1]'s. Kept free of the
// DOM so it can be unit tested; the caller translates `headline` with t().

export const MODEL_LABEL = "model estimate, uncalibrated";

export type IndexHeadline = {
  /** A catalog key and its values. */
  headline: { key: string; values: Record<string, string> };
  /** The exact API value with its sign, or "N/A". */
  signed: string;
  /** "teams[0] − teams[1]" in the API's order; empty without a value. */
  label: string;
  /** The canonical estimate label; empty without a value. */
  chip: string;
};

export function indexHeadline(delta: number | null, teams: readonly [string, string], name: (teamId: string) => string, supported = true): IndexHeadline {
  if (delta === null) return { headline: { key: supported ? "Index difference" : "Tracking metrics unavailable", values: {} }, signed: "N/A", label: "", chip: "" };
  const [first, second] = teams;
  // The API rounds to four decimals, so this shows its value unchanged.
  const magnitude = Math.abs(delta).toFixed(4);
  const level = magnitude === (0).toFixed(4);
  return {
    headline: level ? { key: "index.level", values: {} } : { key: "index.higher", values: { team: name(delta > 0 ? first : second), value: magnitude } },
    signed: level ? magnitude : `${delta > 0 ? "+" : "-"}${magnitude}`,
    label: `${name(first)} − ${name(second)}`,
    chip: MODEL_LABEL,
  };
}
