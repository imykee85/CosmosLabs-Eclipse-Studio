import test from "node:test";
import assert from "node:assert/strict";
import { cleanDraft, parseSocials, safeHref, slugify, validSlug } from "../../src/lib/portfolio";
import { newCode, normalizeCode } from "../../src/lib/certificates";

test("slugify and validSlug", () => {
  assert.equal(slugify("  Ana María's Studio! "), "ana-mar-a-s-studio");
  assert.equal(validSlug("ana-studio"), null);
  assert.match(validSlug("ab") ?? "", /3 to 40/);
  assert.match(validSlug("-bad") ?? "", /lowercase/);
  assert.match(validSlug("bad--double") ?? "", /lowercase/);
  assert.match(validSlug("admin") ?? "", /reserved/);
  assert.match(validSlug("a".repeat(41)) ?? "", /3 to 40/);
});

test("safeHref allows only http(s)", () => {
  assert.equal(safeHref("studio.com"), "https://studio.com/");
  assert.equal(safeHref("http://x.com/a"), "http://x.com/a");
  assert.equal(safeHref("javascript:alert(1)"), null);
  assert.equal(safeHref("data:text/html,<b>"), null);
  assert.equal(safeHref("  "), null);
  assert.equal(safeHref("ftp://x.com"), null);
});

test("parseSocials drops unsafe links but keeps the name", () => {
  const s = parseSocials("Instagram | instagram.com/you\nBad | javascript:alert(1)\nJust text");
  assert.deepEqual(s, [{ name: "Instagram", href: "https://instagram.com/you" }, { name: "Bad", href: null }, { name: "Just text", href: null }]);
});

test("cleanDraft cuts lengths, filters photos and project ids", () => {
  const good = "data:image/jpeg;base64,/9j/4AAQ";
  const d = cleanDraft({ headline: "x".repeat(500), theme: "weird", projectIds: ["a", "a", 5, "b", ""], photos: { Cover: good, About: "data:image/svg+xml;base64,AAAA", Contact: "https://evil/x.jpg", Extra: good }, about: 7 });
  assert.equal(d.headline.length, 80);
  assert.equal(d.theme, "dark");
  assert.deepEqual(d.projectIds, ["a", "b"]);
  assert.deepEqual(Object.keys(d.photos), ["Cover"]);
  assert.equal(d.about, "");
  assert.deepEqual(cleanDraft(null).projectIds, []);
});

test("certificate codes", () => {
  const c = newCode();
  assert.match(c, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  assert.equal(normalizeCode(c.toLowerCase().replace(/-/g, " ")), c);
  assert.equal(normalizeCode("short"), null);
  assert.notEqual(newCode(), newCode());
});
