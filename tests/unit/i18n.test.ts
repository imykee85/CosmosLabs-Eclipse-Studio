import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { currencyForCountry, detectLang, langFromAcceptLanguage, langForCountry } from "../../src/lib/i18n/geo";
import { approxPrice } from "../../src/lib/i18n/format";
import { hash, lift, restore, skipPath, translatable } from "../../src/lib/i18n/text";
import { isLang, LANGS } from "../../src/lib/i18n/languages";

test("a visitor from Colombia gets Spanish and pesos; unknown and English-speaking countries stay English", () => {
  assert.equal(detectLang("CO", "en-US,en;q=0.9"), "es"); // the ad was seen on an English phone: the country decides
  assert.equal(currencyForCountry("CO"), "COP");
  assert.equal(detectLang("BR", null), "pt");
  assert.equal(currencyForCountry("BR"), "BRL");
  assert.equal(detectLang("DE", null), "de");
  assert.equal(currencyForCountry("DE"), "EUR");
  assert.equal(detectLang("US", "en-US"), "en");
  assert.equal(currencyForCountry("US"), "USD");
  assert.equal(detectLang("", "fr-CA,fr;q=0.9"), "fr"); // no country (local test): the browser language
  assert.equal(detectLang(undefined, undefined), "en");
  assert.equal(langForCountry("GB"), null);
});

test("countries that mix languages follow the browser when it is a supported one", () => {
  assert.equal(detectLang("CH", "fr-CH,fr;q=0.9"), "fr");
  assert.equal(detectLang("CH", "ar"), "en"); // unsupported browser language: nothing to pick
  assert.equal(detectLang("IN", "en-IN,en;q=0.9"), "en");
  assert.equal(detectLang("IN", "hi-IN"), "hi");
});

test("Accept-Language is read by weight and unsupported (right-to-left) languages are skipped", () => {
  assert.equal(langFromAcceptLanguage("ar,es;q=0.8,en;q=0.5"), "es");
  assert.equal(langFromAcceptLanguage("xx"), null);
  assert.equal(isLang("ar"), false);
  assert.equal(isLang("es"), true);
  assert.ok(LANGS.every((l) => l.native && l.name));
});

test("the local price badge: rounded estimate in the local currency, nothing for dollars or an unknown rate", () => {
  assert.equal(approxPrice(19, "USD", 1, "en"), null);
  assert.equal(approxPrice(19, "COP", 0, "es"), null);
  const cop = approxPrice(19, "COP", 4100, "es-CO")!;
  assert.match(cop, /^≈ COP/);
  assert.match(cop.replace(/[.,\s]/g, ""), /77900$/); // 19 x 4100 = 77,900
  assert.match(approxPrice(49, "EUR", 0.92, "de")!, /EUR/);
  assert.match(approxPrice(19, "JPY", 150, "ja")!, /JPY/);
  assert.equal(approxPrice(19, "XXX", 2, "en") !== null, true); // an odd code never throws
});

test("numbers are lifted out of text and put back; a translation that loses one is refused", () => {
  const { template, nums } = lift("Created 12 min ago, 3 images");
  assert.equal(template, "Created {0} min ago, {1} images");
  assert.deepEqual(nums, ["12", "3"]);
  assert.equal(restore("Creado hace {0} min, {1} imágenes", nums), "Creado hace 12 min, 3 imágenes");
  assert.equal(restore("Creado hace {0} min", nums), null);
  assert.equal(lift("1:30 left").template, "{0} left");
  assert.equal(hash("a"), hash("a"));
  assert.notEqual(hash("a"), hash("b"));
});

test("what is worth translating", () => {
  assert.equal(translatable("Generate"), true);
  assert.equal(translatable("12"), false);
  assert.equal(translatable("a"), false);
  assert.equal(translatable("https://example.com/x"), false);
  assert.equal(translatable("me@example.com"), false);
  assert.equal(translatable("soul-2-20261008.png"), false);
  assert.equal(translatable("x".repeat(500)), false);
  assert.equal(skipPath("/terms"), true);
  assert.equal(skipPath("/privacy"), true);
  assert.equal(skipPath("/admin/health"), true);
  assert.equal(skipPath("/create"), false);
});

test("the committed translation manifest matches the code (run `npm run i18n:extract` after changing wording)", () => {
  const r = spawnSync(process.execPath, ["--import", "tsx", "scripts/i18n-extract.mjs", "--check"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr || r.stdout);
});
