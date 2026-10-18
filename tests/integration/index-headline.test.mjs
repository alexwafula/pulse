// The hero's Control vs Chaos headline (DIRECTION C1): a plain line from the API's
// indexDelta (2 dp), its exact signed value (U+2212 for minus), the "teams[0] −
// teams[1]" label in the API's order and the canonical estimate chip. The cases are
// shared with the Go server renderer (app/testdata/hero/index-headline.json).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { build } from "esbuild";

const compiled = await build({entryPoints:["app/web/src/index-headline.ts"], bundle:true, platform:"node", format:"esm", write:false});
const { indexHeadline } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`);
const catalog = JSON.parse(readFileSync("app/web/static/locales.json", "utf8"));
const golden = JSON.parse(readFileSync("app/testdata/hero/index-headline.json", "utf8"));
const name = id => golden.names[id];
const render = (locale, { key, values }) => (catalog[locale][key] ?? catalog["en-GB"][key] ?? key).replace(/\{([a-zA-Z]+)\}/g, (_, field) => String(values[field]));
const banned = /\b(winning|ahead|likely|lead(s|ing)?|favou?rites?|odds|chance|probabilit|share|%)/i;
const MINUS = 0x2212, HYPHEN = 0x2d;
const codePoints = text => [...text].map(char => char.codePointAt(0));

// The reader's rule: label is "first − second" (API order); + means first is higher, − means second; level names nobody.
function assertAgreement(result, where) {
  const [first, second] = result.label.split(" − ");
  assert.ok(first && second, `${where}: label "${result.label}" is not "first − second"`);
  assert.ok(!codePoints(result.signed).includes(HYPHEN), `${where}: signed "${result.signed}" contains U+002D`);
  const team = result.headline.values.team;
  if (result.headline.key === "index.level") assert.equal(team, undefined, `${where}: level line names a team`);
  else if (result.signed.startsWith("+")) assert.equal(team, first, `${where}: + must name the first label team`);
  else if (codePoints(result.signed)[0] === MINUS) assert.equal(team, second, `${where}: − must name the second label team`);
  else assert.fail(`${where}: a non-level line has an unsigned value ${result.signed}`);
}

test("golden cases match the server in every locale (2 dp headline, exact signed value, label, chip)", () => {
  for (const locale of golden.locales) for (const c of golden.cases) {
    const where = `${locale} ${c.teams.join("/")} ${c.delta}`;
    const result = indexHeadline(c.delta, c.teams, name, locale);
    assert.equal(result.headline.key, c.key, where);
    assert.equal(result.headline.values.team ?? "", c.team, where);
    assert.equal(result.headline.values.value ?? "", c.value, where);
    assert.equal(result.signed, c.signed, where);
    assert.equal(result.label, c.label, where);
    assert.equal(result.chip, "model estimate, uncalibrated", where);
    assert.doesNotMatch(render("en-GB", result.headline), banned, where);
    assertAgreement(result, where);
  }
});

test("headline team, sign and label agree for both API team orders", () => {
  for (const teams of [["bastion", "vale"], ["vale", "bastion"]]) {
    for (let units = -10000; units <= 10000; units += 37) {
      const delta = units / 1e4;
      assertAgreement(indexHeadline(delta, teams, name, "en-GB"), `${teams.join("/")} ${delta}`);
    }
    // Swapping the order of the same two indexes flips sign and label, never the team named higher.
    const ab = indexHeadline(-0.5537, teams, name, "en-GB"), ba = indexHeadline(0.5537, [teams[1], teams[0]], name, "en-GB");
    assert.equal(ab.headline.values.team, ba.headline.values.team);
    assert.notEqual(ab.label, ba.label);
  }
});

test("required values: 0, ±0.00004, ±0.5537; the minus is U+2212", () => {
  const at = delta => indexHeadline(delta, ["bastion", "vale"], name, "en-GB");
  assert.equal(render("en-GB", at(0).headline), "Neither team's control index is higher");
  assert.equal(at(0).signed, "0.0000");
  assert.equal(at(-0).signed, "0.0000");
  assert.equal(render("en-GB", at(0.00004).headline), "Neither team's control index is higher", "rounds to 0.00 → level");
  assert.equal(render("en-GB", at(-0.00004).headline), "Neither team's control index is higher", "rounds to 0.00 → level");
  assert.deepEqual(codePoints(at(-0.00004).signed).slice(0, 1), [MINUS]);
  assert.equal(at(0.00004).signed, "+0.00004");
  assert.equal(render("en-GB", at(0.5537).headline), "Bastion City's control index is 0.55 higher");
  assert.equal(at(0.5537).signed, "+0.5537");
  assert.equal(render("en-GB", at(-0.5537).headline), "Aurora Vale's control index is 0.55 higher");
  assert.equal(at(-0.5537).signed, "−0.5537");
  assert.deepEqual(codePoints(at(-0.5537).signed).slice(0, 2), [MINUS, 0x30]);
  assert.equal(codePoints(at(-0.5537).label).filter(point => point === MINUS).length, 1, "label minus is U+2212 too");
});

test("no index difference: no number, no label, no chip and no team named", () => {
  for (const [supported, headline] of [[true, "Index difference"], [false, "Tracking metrics unavailable"]]) {
    const result = indexHeadline(null, ["vale", "bastion"], name, "en-GB", supported);
    assert.equal(render("en-GB", result.headline), headline);
    assert.equal(result.signed, "N/A");
    assert.equal(result.label, "");
    assert.equal(result.chip, "");
  }
});

test("headline keys are in all three catalogs with the same placeholders", () => {
  for (const key of ["index.higher", "index.level"]) for (const locale of ["en-GB", "sw-KE", "hi-IN"]) assert.ok(catalog[locale][key], `${locale}: ${key}`);
  assert.equal(catalog["en-GB"]["index.higher"], "{team}'s control index is {value} higher");
  assert.equal(catalog["en-GB"]["index.level"], "Neither team's control index is higher");
});
