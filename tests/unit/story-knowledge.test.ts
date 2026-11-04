import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { DIRECTOR_CRAFT, wantsDirector } from "../../src/lib/director-knowledge";
import { SHORT_FORM_CRAFT, SCREEN_CRAFT, wantsShortForm, wantsScreenwriting } from "../../src/lib/story-knowledge";

const K = "docs/prompt-engines/knowledge/";
const doc = (f: string) => readFileSync(K + f, "utf8").trim();
const m = (t: string) => [{ content: t }];

test("code equals the docs and originals are kept", () => {
  assert.equal(DIRECTOR_CRAFT, doc("director-craft.md"));
  assert.equal(SHORT_FORM_CRAFT, doc("short-form-craft.md"));
  assert.equal(SCREEN_CRAFT, doc("screenwriting-craft.md"));
  for (const f of ["director-craft/SKILL.md", "filmmaking-short-form/anti-slop-SKILL.md", "screenwriting/sw-dialogue.md"]) assert.ok(existsSync(K + "original/" + f), f);
});

test("topic gates", () => {
  assert.equal(wantsDirector(m("my video keeps morphing"), ""), true);
  assert.equal(wantsDirector(m("a red apple"), ""), false);
  assert.equal(wantsShortForm(m("write a hook for my reel"), ""), true);
  assert.equal(wantsShortForm(m("a red apple"), ""), false);
  assert.equal(wantsScreenwriting(m("help with the dialogue in my scene"), ""), true);
  assert.equal(wantsScreenwriting(m("a red apple"), ""), false);
});

test("no outside tool or brand names", () => {
  for (const t of [DIRECTOR_CRAFT, SHORT_FORM_CRAFT, SCREEN_CRAFT]) assert.doesNotMatch(t, /higgsfield|scenario|claude code|@\w+ tag/i);
});
