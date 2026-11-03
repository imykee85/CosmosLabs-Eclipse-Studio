import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_LIGHT, QUICK, clean, relightPrompt, heightWords, sideWords, strengthWords, colorWords } from "../../src/lib/relight/prompt";

test("a light becomes words", () => {
  assert.match(sideWords(180), /behind/); assert.match(sideWords(90), /right side/); assert.match(sideWords(270), /left side/);
  assert.match(heightWords(80), /overhead/); assert.match(heightWords(-40), /below/); assert.match(heightWords(0), /level/);
  assert.match(strengthWords(9), /very strong/); assert.match(strengthWords(1), /dim/);
  assert.equal(colorWords("#ffffff"), "neutral white"); assert.equal(colorWords("#5bc8f5"), "cool blue"); assert.match(colorWords("#12ab34"), /#12ab34/);
});

test("the prompt keeps everything but the light and lists every light", () => {
  const p = relightPrompt([{ ...DEFAULT_LIGHT, rotate: 270, elevation: 30, intensity: 8, color: "#ee7a47" }, { ...DEFAULT_LIGHT, rotate: 180 }], "make it moody");
  assert.match(p, /Light 1: a strong orange light high above, from the subject's left side/);
  assert.match(p, /Light 2: .*behind/);
  assert.match(p, /exactly the same as image 1/); assert.match(p, /moody/);
  assert.equal(relightPrompt([DEFAULT_LIGHT]), relightPrompt([DEFAULT_LIGHT]));
  assert.doesNotMatch(relightPrompt([DEFAULT_LIGHT]), /Light 1:/);
});

test("values are cleaned and the quick buttons place the light", () => {
  assert.deepEqual(clean({ rotate: -10, elevation: 200, intensity: 99, color: "nope" }), { rotate: 350, elevation: 90, intensity: 10, color: "#ffffff" });
  const top = QUICK.find((q) => q.id === "top")!.patch({ ...DEFAULT_LIGHT, rotate: 120 });
  assert.equal(top.elevation, 80); assert.equal(top.rotate, 120);
  assert.equal(QUICK.find((q) => q.id === "back")!.patch(DEFAULT_LIGHT).rotate, 180);
});
