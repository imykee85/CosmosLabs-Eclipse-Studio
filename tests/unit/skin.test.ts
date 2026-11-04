import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SKIN, FEATURE_NAME, PRESETS, clean, detailWords, grainWords, sharpenWords, skinPrompt } from "../../src/lib/skin/prompt";

test("the three versions build different instructions and always keep the person and skin tone", () => {
  const f = skinPrompt({ ...DEFAULT_SKIN, version: "faithful", detail: 99 });
  const c = skinPrompt({ ...DEFAULT_SKIN, version: "creative" });
  const x = skinPrompt({ ...DEFAULT_SKIN, version: "flexible", preset: "real" });
  assert.match(f, /Skin detail level 99/); assert.match(f, /pronounced/);
  assert.match(c, /clarity, contrast/);
  assert.match(x, /photorealistic person/);
  for (const p of [f, c, x]) { assert.match(p, /Do not change the skin tone or undertone/); assert.match(p, /exactly the same person/); assert.match(p, /image 1/); }
  assert.equal(PRESETS.length, 5);
});

test("the sliders turn into words and zero means nothing added", () => {
  assert.equal(sharpenWords(0), ""); assert.match(sharpenWords(10), /very slight/); assert.match(sharpenWords(100), /strong/);
  assert.match(grainWords(0), /no added grain/); assert.match(grainWords(8), /8 percent/); assert.match(grainWords(60), /visible film grain/);
  assert.match(detailWords(18), /smooth/); assert.match(detailWords(75), /pores/);
  assert.equal(FEATURE_NAME, "Skin Enhancer");
});

test("values are cleaned and the same inputs give the same prompt", () => {
  assert.deepEqual(clean({ version: "nope" as never, preset: "x" as never, detail: 200, sharpen: -5, grain: 2.4 }), { version: "flexible", preset: "skin", detail: 100, sharpen: 0, grain: 2 });
  assert.equal(skinPrompt(DEFAULT_SKIN), skinPrompt(DEFAULT_SKIN));
  assert.match(skinPrompt(DEFAULT_SKIN, "keep the freckles"), /freckles/);
});
