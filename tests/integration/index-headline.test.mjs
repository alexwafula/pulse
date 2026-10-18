// The hero's Control vs Chaos headline (DIRECTION C1): a plain line from the API's
// indexDelta, its exact signed value, the "teams[0] − teams[1]" label in the API's
// order and the canonical estimate chip. No absolute share, no prediction wording.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { build } from "esbuild";

const compiled = await build({entryPoints:["app/web/src/index-headline.ts"], bundle:true, platform:"node", format:"esm", write:false});
const { indexHeadline } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`);
const catalog = JSON.parse(readFileSync("app/web/static/locales.json", "utf8"));
const names = { vale: "Aurora Vale", bastion: "Bastion City" };
const name = id => names[id];
const english = ({ key, values }) => (catalog["en-GB"][key] ?? key).replace(/\{([a-zA-Z]+)\}/g, (_, field) => String(values[field]));
const banned = /\b(winning|ahead|likely|lead(s|ing)?|favou?rites?|odds|chance|probabilit|share|%)/i;

function check(result, { headline, signed, label }) {
  assert.equal(english(result.headline), headline);
  assert.equal(result.signed, signed);
  assert.equal(result.label, label);
  assert.equal(result.chip, "model estimate, uncalibrated");
  assert.doesNotMatch(english(result.headline), banned);
}

test("negative delta: the second API team's index is higher, by the exact magnitude", () => {
  check(indexHeadline(-0.4287, ["bastion", "vale"], name), {
    headline: "Aurora Vale's control index is 0.4287 higher", signed: "-0.4287", label: "Bastion City − Aurora Vale" });
});

test("positive delta: the first API team's index is higher", () => {
  check(indexHeadline(0.5537, ["vale", "bastion"], name), {
    headline: "Aurora Vale's control index is 0.5537 higher", signed: "+0.5537", label: "Aurora Vale − Bastion City" });
});

test("swapping the API team order flips the sign and the label, never the team named higher", () => {
  const first = indexHeadline(0.1203, ["bastion", "vale"], name);
  const swapped = indexHeadline(-0.1203, ["vale", "bastion"], name);
  check(first, { headline: "Bastion City's control index is 0.1203 higher", signed: "+0.1203", label: "Bastion City − Aurora Vale" });
  check(swapped, { headline: "Bastion City's control index is 0.1203 higher", signed: "-0.1203", label: "Aurora Vale − Bastion City" });
});

test("zero delta: a neutral line, no team named as higher", () => {
  for (const zero of [0, -0]) {
    const result = indexHeadline(zero, ["bastion", "vale"], name);
    check(result, { headline: "Neither team's control index is higher", signed: "0.0000", label: "Bastion City − Aurora Vale" });
    assert.ok(!Object.values(result.headline.values).some(value => Object.values(names).includes(value)), "the zero line names no team");
  }
});

test("values keep the API's four decimals; nothing is rounded to a different number", () => {
  assert.equal(indexHeadline(-0.0001, ["bastion", "vale"], name).signed, "-0.0001");
  assert.equal(english(indexHeadline(-0.0001, ["bastion", "vale"], name).headline), "Aurora Vale's control index is 0.0001 higher");
  assert.equal(indexHeadline(1, ["vale", "bastion"], name).signed, "+1.0000");
});

test("no index difference: no number, no label, no chip and no team named", () => {
  for (const [supported, headline] of [[true, "Index difference"], [false, "Tracking metrics unavailable"]]) {
    const result = indexHeadline(null, ["vale", "bastion"], name, supported);
    assert.equal(english(result.headline), headline);
    assert.equal(result.signed, "N/A");
    assert.equal(result.label, "");
    assert.equal(result.chip, "");
  }
});

test("every headline key is in all three catalogs with the same placeholders", () => {
  for (const key of ["index.higher", "index.level"]) for (const locale of ["en-GB", "sw-KE", "hi-IN"]) assert.ok(catalog[locale][key], `${locale}: ${key}`);
  assert.equal(catalog["en-GB"]["index.higher"], "{team}'s control index is {value} higher");
});
