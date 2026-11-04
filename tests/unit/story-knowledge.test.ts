import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { UGC_CRAFT, STYLE_TEMPLATE_CRAFT, wantsUgc, wantsStyleTemplate } from "../../src/lib/craft-knowledge";
import { SEEDANCE_PRODUCTION } from "../../src/lib/seedance-knowledge";
import { MOTION_CRAFT, wantsMotion } from "../../src/lib/motion-knowledge";
import { DIRECTOR_CRAFT, wantsDirector } from "../../src/lib/director-knowledge";
import { SHORT_FORM_CRAFT, SCREEN_CRAFT, BRAINSTORM_CRAFT, PRODUCTION_CRAFT, wantsShortForm, wantsScreenwriting, wantsBrainstorm, wantsProduction, DOCUMENTARY_CRAFT, wantsDocumentary } from "../../src/lib/story-knowledge";

const K = "docs/prompt-engines/knowledge/";
const doc = (f: string) => readFileSync(K + f, "utf8").trim();
const m = (t: string) => [{ content: t }];

test("code equals the docs and originals are kept", () => {
  assert.equal(DIRECTOR_CRAFT, doc("director-craft.md"));
  assert.equal(SHORT_FORM_CRAFT, doc("short-form-craft.md"));
  assert.equal(SCREEN_CRAFT, doc("screenwriting-craft.md"));
  assert.equal(BRAINSTORM_CRAFT, doc("brainstorm-craft.md"));
  assert.equal(PRODUCTION_CRAFT, doc("production-pack-craft.md"));
  assert.equal(MOTION_CRAFT, doc("motion-film-craft.md"));
  assert.equal(DOCUMENTARY_CRAFT, doc("documentary-craft.md"));
  assert.equal(UGC_CRAFT, doc("ugc-ads-craft.md"));
  assert.equal(STYLE_TEMPLATE_CRAFT, doc("reference-video-template-craft.md"));
  assert.equal(SEEDANCE_PRODUCTION, doc("seedance-production-notes.md"));
  for (const f of ["director-craft/SKILL.md", "filmmaking-short-form/anti-slop-SKILL.md", "screenwriting/sw-dialogue.md", "brainstorming/SKILL.md", "filmmaking-producer/SKILL.md", "motion-direction/motionmaxxing-LICENSE", "seedance-production/SKILL.md", "ugc-ads/make-ugc-SKILL.md", "documentary/produce-documentary-SKILL.md", "reference-video/SKILL.md"]) assert.ok(existsSync(K + "original/" + f), f);
});

test("topic gates", () => {
  assert.equal(wantsDirector(m("my video keeps morphing"), ""), true);
  assert.equal(wantsDirector(m("a red apple"), ""), false);
  assert.equal(wantsShortForm(m("write a hook for my reel"), ""), true);
  assert.equal(wantsShortForm(m("a red apple"), ""), false);
  assert.equal(wantsScreenwriting(m("help with the dialogue in my scene"), ""), true);
  assert.equal(wantsScreenwriting(m("a red apple"), ""), false);
  assert.equal(wantsBrainstorm(m("help me start, I am not sure"), ""), true);
  assert.equal(wantsBrainstorm(m("a red apple"), ""), false);
  assert.equal(wantsProduction(m("write a shot list and budget"), ""), true);
  assert.equal(wantsProduction(m("a red apple"), ""), false);
  assert.equal(wantsMotion(m("make a launch video"), ""), true);
  assert.equal(wantsMotion(m("a red apple"), ""), false);
  assert.equal(wantsDocumentary(m("plan a documentary with interviews"), ""), true);
  assert.equal(wantsDocumentary(m("a red apple"), ""), false);
  assert.equal(wantsUgc(m("write a UGC testimonial ad"), ""), true);
  assert.equal(wantsUgc(m("a red apple"), ""), false);
  assert.equal(wantsStyleTemplate(m("break this down into a template: make videos like this"), ""), true);
  assert.equal(wantsStyleTemplate(m("a red apple"), ""), false);
});

test("no outside tool or brand names", () => {
  for (const t of [DIRECTOR_CRAFT, SHORT_FORM_CRAFT, SCREEN_CRAFT, BRAINSTORM_CRAFT, PRODUCTION_CRAFT, MOTION_CRAFT, DOCUMENTARY_CRAFT, UGC_CRAFT, STYLE_TEMPLATE_CRAFT, SEEDANCE_PRODUCTION]) assert.doesNotMatch(t, /higgsfield|scenario|claude code|@\w+ tag/i);
});
