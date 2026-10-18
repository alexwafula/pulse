import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const catalog = JSON.parse(readFileSync(new URL("../../app/web/static/locales.json", import.meta.url), "utf8"));
const tokens = value => [...value.matchAll(/\{([a-zA-Z]+)\}/g)].map(match => match[1]).sort();
// English literal keys intentionally fall back to themselves in i18n.ts.
const keys = [...new Set(Object.values(catalog).flatMap(entries => Object.keys(entries)))].sort();

for (const locale of ["sw-KE", "hi-IN"]) {
  test(`${locale}: every interface draft preserves catalog keys and variable placeholders`, () => {
    assert.deepEqual(Object.keys(catalog[locale]).sort(), keys);
    for (const key of keys) {
      const english = catalog["en-GB"][key] ?? key;
      if (/^[a-z]+\.[a-zA-Z]+$/.test(key)) assert.ok(catalog["en-GB"][key], `format key needs an English value: ${key}`);
      const translated = catalog[locale][key];
      assert.equal(typeof translated, "string", key);
      assert.ok(translated.trim(), key);
      assert.deepEqual(tokens(translated), tokens(english), `${locale}: ${key}`);
    }
  });
}
