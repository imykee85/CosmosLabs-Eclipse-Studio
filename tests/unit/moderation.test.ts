import { test } from "node:test";
import assert from "node:assert/strict";
import { checkPrompt } from "../../src/lib/moderation";

test("ordinary creative prompts pass", () => {
  for (const p of ["a red fox in fresh snow, golden hour", "studio portrait of a model in a black jacket", "a bottle of perfume on marble, soft light", "children's book illustration of a friendly dragon"]) {
    assert.equal(checkPrompt(p).ok, true, p);
  }
});

test("clear violations are refused with the right category", () => {
  const cases: [string, string][] = [
    ["a nude child", "minors"],
    ["fake passport with my photo", "forgery"],
    ["terrorist propaganda poster", "harm"],
  ];
  for (const [prompt, category] of cases) {
    const r = checkPrompt(prompt);
    assert.equal(r.ok, false, prompt);
    if (!r.ok) assert.equal(r.category, category, prompt);
  }
});

test("a sexual image of a real person is refused", () => {
  assert.equal(checkPrompt("naked deepfake of my ex").ok, false);
});

test("obfuscated spellings are read through", () => {
  assert.equal(checkPrompt("n a k e d  c h i l d").ok, false);
  assert.equal(checkPrompt("n4k3d kid").ok, false);
  assert.equal(checkPrompt("n.a.k.e.d child").ok, false);
});

test("a letter-by-letter disguise cannot hide both words (a gap found by these tests)", () => {
  assert.equal(checkPrompt("n a k e d  c h i l d").ok, false);
  assert.equal(checkPrompt("n a k e d c h i l d").ok, false);
});

test("spaced capitals in an ordinary prompt are left alone", () => {
  assert.equal(checkPrompt("A B C D E F G H").ok, true);
  assert.equal(checkPrompt("I M A G E of Essex castle at dawn").ok, true);
});
