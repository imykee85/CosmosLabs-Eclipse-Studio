import test from "node:test";
import assert from "node:assert/strict";
import { PREMIUM_COLLECTIONS, findCollection, premiumItems } from "../../src/lib/premium";
import { premiumPrompts } from "../../src/lib/premium-prompts";
import { planAllows } from "../../src/lib/access-table";

test("premium collections are for Growth and Scale only", () => {
  assert.equal(planAllows("free", "premium"), false);
  assert.equal(planAllows("starter", "premium"), false);
  assert.equal(planAllows("growth", "premium"), true);
  assert.equal(planAllows("scale", "premium"), true);
});

test("collection slugs are unique and findable", () => {
  const slugs = PREMIUM_COLLECTIONS.map((c) => c.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const c of PREMIUM_COLLECTIONS) assert.equal(findCollection(c.slug)?.name, c.name);
});

test("every item has a unique id, a file under /premium and a prompt", () => {
  for (const [slug, items] of Object.entries(premiumItems)) {
    assert.ok(findCollection(slug), `unknown collection ${slug}`);
    const ids = items.map((i) => i.id);
    assert.equal(new Set(ids).size, ids.length, `duplicate id in ${slug}`);
    for (const i of items) {
      assert.match(i.id, /^[a-z0-9-]+$/);
      assert.ok(i.src.startsWith(`/premium/${slug}/`), `${slug}/${i.id} file path`);
      assert.ok(premiumPrompts[`${slug}/${i.id}`], `${slug}/${i.id} has no prompt`);
    }
  }
});
